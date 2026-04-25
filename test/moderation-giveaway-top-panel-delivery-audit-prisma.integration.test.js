const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addPunishment,
  replacePunishments,
  flushModerationStoreWrites,
} = require('../src/store/moderationStore');
const {
  createGiveaway,
  addEntrant,
  removeGiveaway,
  flushGiveawayStoreWrites,
} = require('../src/store/giveawayStore');
const {
  setTopPanelMessage,
  removeTopPanelMessage,
  flushTopPanelStoreWrites,
} = require('../src/store/topPanelStore');
const {
  addDeliveryAudit,
  clearDeliveryAudit,
  flushDeliveryAuditStoreWrites,
} = require('../src/store/deliveryAuditStore');
const { prisma, getTenantScopedPrismaClient } = require('../src/prisma');

const TEST_TENANT_ID = 'tenant-moderation-giveaway-top-panel-integration';

function scope() {
  return { tenantId: TEST_TENANT_ID };
}

function uniqueText(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('moderation/giveaway/top-panel/delivery-audit stores write through to prisma', async () => {
  const userId = uniqueText('mod-user');
  const messageId = uniqueText('ga-msg');
  const guildId = uniqueText('guild');
  const channelId = uniqueText('channel');
  const panelGuild = uniqueText('panel-guild');
  const panelChannel = uniqueText('panel-channel');
  const panelMessage = uniqueText('panel-message');
  const auditId = uniqueText('audit-id');
  const tenantDb = getTenantScopedPrismaClient(TEST_TENANT_ID);

  try {
    addPunishment(userId, 'warn', 'test warn', 'staff-1', null, scope());
    await flushModerationStoreWrites(scope());

    let punishmentRows = await tenantDb.punishment.findMany({
      where: { userId },
    });
    assert.equal(punishmentRows.length >= 1, true);
    assert.equal(punishmentRows[0].type, 'warn');

    replacePunishments([], scope());
    await flushModerationStoreWrites(scope());
    punishmentRows = await tenantDb.punishment.findMany({ where: { userId } });
    assert.equal(punishmentRows.length, 0);

    createGiveaway({
      messageId,
      channelId,
      guildId,
      prize: 'VIP 7 วัน',
      winnersCount: 1,
      endsAt: new Date(Date.now() + 3600_000),
    }, scope());
    addEntrant(messageId, userId, scope());
    await flushGiveawayStoreWrites(scope());

    let giveawayRow = await tenantDb.giveaway.findUnique({ where: { messageId } });
    assert.ok(giveawayRow);
    let entrantRow = await tenantDb.giveawayEntrant.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });
    assert.ok(entrantRow);

    removeGiveaway(messageId, scope());
    await flushGiveawayStoreWrites(scope());
    giveawayRow = await tenantDb.giveaway.findUnique({ where: { messageId } });
    entrantRow = await tenantDb.giveawayEntrant.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
    });
    assert.equal(giveawayRow, null);
    assert.equal(entrantRow, null);

    setTopPanelMessage(
      panelGuild,
      'topKiller',
      panelChannel,
      panelMessage,
      scope(),
    );
    await flushTopPanelStoreWrites(scope());
    let panelRow = await tenantDb.topPanelMessage.findUnique({
      where: {
        guildId_panelType: {
          guildId: panelGuild,
          panelType: 'topKiller',
        },
      },
    });
    assert.ok(panelRow);
    assert.equal(panelRow.channelId, panelChannel);
    assert.equal(panelRow.messageId, panelMessage);

    removeTopPanelMessage(panelGuild, 'topKiller', scope());
    await flushTopPanelStoreWrites(scope());
    panelRow = await tenantDb.topPanelMessage.findUnique({
      where: {
        guildId_panelType: {
          guildId: panelGuild,
          panelType: 'topKiller',
        },
      },
    });
    assert.equal(panelRow, null);

    addDeliveryAudit({
      id: auditId,
      level: 'info',
      action: 'delivery_test',
      userId,
      message: 'integration delivery audit',
      meta: { source: 'test' },
    });
    await flushDeliveryAuditStoreWrites();
    let auditRow = await prisma.deliveryAudit.findUnique({
      where: { id: auditId },
    });
    assert.ok(auditRow);
    assert.equal(auditRow.action, 'delivery_test');

    clearDeliveryAudit();
    await flushDeliveryAuditStoreWrites();
    auditRow = await prisma.deliveryAudit.findUnique({
      where: { id: auditId },
    });
    assert.equal(auditRow, null);
  } finally {
    await tenantDb.punishment.deleteMany({ where: { userId } }).catch(() => null);
    await tenantDb.giveawayEntrant.deleteMany({ where: { messageId } }).catch(() => null);
    await tenantDb.giveaway.deleteMany({ where: { messageId } }).catch(() => null);
    await tenantDb.topPanelMessage.deleteMany({
      where: {
        guildId: panelGuild,
      },
    }).catch(() => null);
    await prisma.deliveryAudit.deleteMany({ where: { id: auditId } });
  }
});
