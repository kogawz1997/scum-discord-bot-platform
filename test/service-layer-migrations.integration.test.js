const test = require('node:test');
const assert = require('node:assert/strict');

const {
  bindSteamLinkForUser,
  getSteamLinkByUserId,
  getSteamLinkBySteamId,
  removeSteamLink,
} = require('../src/services/linkService');
const { createPunishmentEntry } = require('../src/services/moderationService');
const {
  startGiveawayForMessage,
  enterGiveawayForUser,
  settleGiveawayForMessage,
} = require('../src/services/giveawayService');
const { prisma } = require('../src/prisma');
const { flushLinkStoreWrites } = require('../src/store/linkStore');
const { flushModerationStoreWrites } = require('../src/store/moderationStore');
const { flushGiveawayStoreWrites } = require('../src/store/giveawayStore');

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('linkService enforces one-time self bind and supports admin removal', async () => {
  const userId = uniqueId('link-user');
  const steamIdA = '76561199000000001';
  const steamIdB = '76561199000000002';

  try {
    const first = await bindSteamLinkForUser({
      userId,
      steamId: steamIdA,
      inGameName: 'Tester A',
      allowReplace: false,
      allowSteamReuse: false,
    });
    assert.equal(first.ok, true);
    assert.equal(typeof first.identity?.userId, 'string');

    const duplicate = await bindSteamLinkForUser({
      userId,
      steamId: steamIdA,
      allowReplace: false,
      allowSteamReuse: false,
    });
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.alreadyLinked, true);

    const blockedRelink = await bindSteamLinkForUser({
      userId,
      steamId: steamIdB,
      allowReplace: false,
      allowSteamReuse: false,
    });
    assert.equal(blockedRelink.ok, false);
    assert.equal(blockedRelink.reason, 'user-already-linked');

    await flushLinkStoreWrites();
    assert.equal(String(getSteamLinkByUserId(userId)?.steamId || ''), steamIdA);
    assert.equal(String(getSteamLinkBySteamId(steamIdA)?.userId || ''), userId);

    const removed = await removeSteamLink({ userId });
    assert.equal(removed.ok, true);
    await flushLinkStoreWrites();
    assert.equal(getSteamLinkByUserId(userId), null);
  } finally {
    const identityRows = await prisma.platformUserIdentity.findMany({
      where: {
        OR: [
          { providerUserId: userId },
          { providerUserId: { in: [steamIdA, steamIdB] } },
        ],
      },
    }).catch(() => []);
    const platformUserIds = [...new Set(identityRows.map((row) => row.userId).filter(Boolean))];
    await prisma.link.deleteMany({ where: { userId } }).catch(() => null);
    await prisma.playerAccount.deleteMany({ where: { discordId: userId } }).catch(() => null);
    await prisma.platformPlayerProfile.deleteMany({
      where: {
        OR: [
          { discordUserId: userId },
          { steamId: { in: [steamIdA, steamIdB] } },
          ...(platformUserIds.length > 0 ? [{ userId: { in: platformUserIds } }] : []),
        ],
      },
    }).catch(() => null);
    await prisma.platformMembership.deleteMany({
      where: platformUserIds.length > 0 ? { userId: { in: platformUserIds } } : { id: '__none__' },
    }).catch(() => null);
    await prisma.platformUserIdentity.deleteMany({ where: { OR: [{ providerUserId: userId }, { providerUserId: { in: [steamIdA, steamIdB] } }] } }).catch(() => null);
    await prisma.platformUser.deleteMany({
      where: platformUserIds.length > 0 ? { id: { in: platformUserIds } } : { id: '__none__' },
    }).catch(() => null);
  }
});

test('moderationService creates punishment entries through service layer', async () => {
  const userId = uniqueId('punish-user');

  try {
    const result = createPunishmentEntry({
      userId,
      type: 'warn',
      reason: 'integration-test-warning',
      staffId: 'test-suite',
      durationMinutes: null,
    });
    assert.equal(result.ok, true);
    assert.equal(String(result.entry?.type || ''), 'warn');

    await flushModerationStoreWrites();
    const rows = await prisma.punishment.findMany({ where: { userId } });
    assert.equal(rows.length >= 1, true);
    assert.equal(String(rows.at(-1)?.reason || ''), 'integration-test-warning');
  } finally {
    await prisma.punishment.deleteMany({ where: { userId } }).catch(() => null);
  }
});

test('giveawayService start/join/settle flow works via service layer', async () => {
  const messageId = uniqueId('giveaway-message');
  const channelId = uniqueId('giveaway-channel');
  const guildId = uniqueId('giveaway-guild');
  const userIdA = uniqueId('giveaway-user-a');
  const userIdB = uniqueId('giveaway-user-b');

  try {
    const start = startGiveawayForMessage({
      messageId,
      channelId,
      guildId,
      prize: 'AK Set',
      winnersCount: 1,
      endsAt: new Date(Date.now() + 60_000),
    });
    assert.equal(start.ok, true);

    const joinA = enterGiveawayForUser({ messageId, userId: userIdA });
    const joinB = enterGiveawayForUser({ messageId, userId: userIdB });
    assert.equal(joinA.ok, true);
    assert.equal(joinB.ok, true);

    const settled = settleGiveawayForMessage({
      messageId,
      randomIntFn: () => 1,
    });
    assert.equal(settled.ok, true);
    assert.equal(settled.noEntrants, false);
    assert.equal(settled.winnerIds.length, 1);
    assert.equal(settled.winnerIds[0], userIdA);

    await flushGiveawayStoreWrites();
    const row = await prisma.giveaway.findUnique({ where: { messageId } });
    assert.equal(row, null);
  } finally {
    await prisma.giveawayEntrant.deleteMany({ where: { messageId } }).catch(() => null);
    await prisma.giveaway.deleteMany({ where: { messageId } }).catch(() => null);
  }
});
