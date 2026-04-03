const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const adminSnapshotServiceModulePath = require.resolve('../src/services/adminSnapshotService');
const ticketStoreModulePath = require.resolve('../src/store/ticketStore');
const statsStoreModulePath = require.resolve('../src/store/statsStore');
const giveawayStoreModulePath = require.resolve('../src/store/giveawayStore');

function clearSnapshotModules() {
  delete require.cache[adminSnapshotServiceModulePath];
  delete require.cache[ticketStoreModulePath];
  delete require.cache[statsStoreModulePath];
  delete require.cache[giveawayStoreModulePath];
}

test('buildAdminSnapshot hydrates lazy stores before serializing backup data', async (t) => {
  clearSnapshotModules();
  const { prisma } = require('../src/prisma');
  const ticketChannelId = `snapshot-ticket-${Date.now()}`;
  const statsUserId = `snapshot-stats-${Date.now()}`;
  const giveawayMessageId = `snapshot-giveaway-${Date.now()}`;

  t.after(async () => {
    await prisma.giveawayEntrant.deleteMany({ where: { messageId: giveawayMessageId } }).catch(() => null);
    await prisma.giveaway.deleteMany({ where: { messageId: giveawayMessageId } }).catch(() => null);
    await prisma.ticketRecord.deleteMany({ where: { channelId: ticketChannelId } }).catch(() => null);
    await prisma.stats.deleteMany({ where: { userId: statsUserId } }).catch(() => null);
    clearSnapshotModules();
  });

  await prisma.ticketRecord.upsert({
    where: { channelId: ticketChannelId },
    update: {
      id: 900001,
      guildId: 'snapshot-guild',
      userId: 'snapshot-user',
      category: 'support',
      reason: 'snapshot regression',
      status: 'open',
      claimedBy: null,
      createdAt: new Date('2026-03-17T00:00:00.000Z'),
      closedAt: null,
    },
    create: {
      channelId: ticketChannelId,
      id: 900001,
      guildId: 'snapshot-guild',
      userId: 'snapshot-user',
      category: 'support',
      reason: 'snapshot regression',
      status: 'open',
      claimedBy: null,
      createdAt: new Date('2026-03-17T00:00:00.000Z'),
      closedAt: null,
    },
  });
  await prisma.stats.upsert({
    where: { userId: statsUserId },
    update: {
      kills: 9,
      deaths: 2,
      playtimeMinutes: 180,
      squad: 'alpha',
    },
    create: {
      userId: statsUserId,
      kills: 9,
      deaths: 2,
      playtimeMinutes: 180,
      squad: 'alpha',
    },
  });
  await prisma.giveaway.upsert({
    where: { messageId: giveawayMessageId },
    update: {
      channelId: 'snapshot-channel',
      guildId: 'snapshot-guild',
      prize: 'snapshot-prize',
      winnersCount: 1,
      endsAt: new Date('2026-03-18T00:00:00.000Z'),
    },
    create: {
      messageId: giveawayMessageId,
      channelId: 'snapshot-channel',
      guildId: 'snapshot-guild',
      prize: 'snapshot-prize',
      winnersCount: 1,
      endsAt: new Date('2026-03-18T00:00:00.000Z'),
    },
  });
  await prisma.giveawayEntrant.upsert({
    where: {
      messageId_userId: {
        messageId: giveawayMessageId,
        userId: 'snapshot-entrant',
      },
    },
    update: {},
    create: {
      messageId: giveawayMessageId,
      userId: 'snapshot-entrant',
    },
  });

  clearSnapshotModules();
  const { buildAdminSnapshot } = require('../src/services/adminSnapshotService');
  const snapshot = await buildAdminSnapshot();

  assert.ok(snapshot.tickets.some((row) => row.channelId === ticketChannelId));
  assert.ok(snapshot.stats.some((row) => row.userId === statsUserId && Number(row.kills || 0) === 9));
  assert.ok(snapshot.giveaways.some((row) => row.messageId === giveawayMessageId));
});

test('restoreAdminBackup rolls back when restore fails after writes start', async (t) => {
  clearSnapshotModules();
  const {
    buildAdminSnapshot,
    createAdminBackup,
    getAdminRestoreState,
    jsonReplacer,
    previewAdminBackupRestore,
    restoreAdminBackup,
  } = require('../src/services/adminSnapshotService');

  const baseline = await buildAdminSnapshot();
  const expectedOnlinePlayers = Number(baseline.status?.onlinePlayers || 0);
  const targetSnapshot = JSON.parse(JSON.stringify(baseline));
  targetSnapshot.status = {
    ...(targetSnapshot.status || {}),
    onlinePlayers: expectedOnlinePlayers + 7,
  };
  targetSnapshot.config = 123;

  const backup = await createAdminBackup({
    actor: 'snapshot-regression',
    role: 'owner',
    note: 'rollback-regression',
    includeSnapshot: false,
  });
  const backupPayload = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    createdBy: 'snapshot-regression',
    role: 'owner',
    note: 'rollback-regression',
    snapshot: targetSnapshot,
  };
  fs.writeFileSync(backup.absolutePath, JSON.stringify(backupPayload, jsonReplacer, 2), 'utf8');
  const preview = await previewAdminBackupRestore(backup.file, {
    actor: 'snapshot-regression',
    role: 'owner',
    issuePreviewToken: true,
  });

  t.after(() => {
    const restoreState = getAdminRestoreState();
    if (backup.absolutePath) {
      fs.rmSync(backup.absolutePath, { force: true });
    }
    if (restoreState.rollbackBackup) {
      const rollbackPath = backup.absolutePath.replace(backup.file, restoreState.rollbackBackup);
      fs.rmSync(rollbackPath, { force: true });
    }
    clearSnapshotModules();
  });

  await assert.rejects(
    () => restoreAdminBackup(backup.file, {
      actor: 'snapshot-regression',
      role: 'owner',
      confirmBackup: backup.file,
      previewToken: preview.previewToken,
    }),
    /Backup restore failed/i,
  );

  const restoreState = getAdminRestoreState();
  assert.equal(restoreState.status, 'failed');
  assert.equal(restoreState.rollbackStatus, 'succeeded');

  const restored = await buildAdminSnapshot();
  assert.equal(Number(restored.status?.onlinePlayers || 0), expectedOnlinePlayers);
});

test('restoreAdminBackup verifies delivery audit counts by logical unique ids', async (t) => {
  clearSnapshotModules();
  const {
    buildAdminSnapshot,
    createAdminBackup,
    getAdminRestoreState,
    jsonReplacer,
    previewAdminBackupRestore,
    restoreAdminBackup,
    restoreAdminSnapshotData,
  } = require('../src/services/adminSnapshotService');

  const baseline = await buildAdminSnapshot();
  const targetSnapshot = JSON.parse(JSON.stringify(baseline));
  const duplicateAuditId = `snapshot-dup-audit-${Date.now()}`;
  targetSnapshot.deliveryAudit = [
    ...(Array.isArray(targetSnapshot.deliveryAudit) ? targetSnapshot.deliveryAudit : []),
    {
      id: duplicateAuditId,
      createdAt: '2026-04-03T00:00:00.000Z',
      level: 'info',
      action: 'restore-regression',
      message: 'first',
    },
    {
      id: duplicateAuditId,
      createdAt: '2026-04-03T00:01:00.000Z',
      level: 'info',
      action: 'restore-regression',
      message: 'latest',
    },
  ];

  const backup = await createAdminBackup({
    actor: 'snapshot-regression',
    role: 'owner',
    note: 'dedupe-regression',
    includeSnapshot: false,
  });
  const backupPayload = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    createdBy: 'snapshot-regression',
    role: 'owner',
    note: 'dedupe-regression',
    snapshot: targetSnapshot,
  };
  fs.writeFileSync(backup.absolutePath, JSON.stringify(backupPayload, jsonReplacer, 2), 'utf8');
  const preview = await previewAdminBackupRestore(backup.file, {
    actor: 'snapshot-regression',
    role: 'owner',
    issuePreviewToken: true,
  });

  t.after(async () => {
    await restoreAdminSnapshotData(baseline);
    const restoreState = getAdminRestoreState();
    if (backup.absolutePath) {
      fs.rmSync(backup.absolutePath, { force: true });
    }
    if (restoreState.rollbackBackup) {
      const rollbackPath = backup.absolutePath.replace(backup.file, restoreState.rollbackBackup);
      fs.rmSync(rollbackPath, { force: true });
    }
    clearSnapshotModules();
  });

  const restored = await restoreAdminBackup(backup.file, {
    actor: 'snapshot-regression',
    role: 'owner',
    confirmBackup: backup.file,
    previewToken: preview.previewToken,
  });

  assert.equal(restored.restored, true);
  assert.equal(Boolean(restored.verification?.ready), true);
  assert.equal(Boolean(restored.verification?.countsMatch), true);

  const after = await buildAdminSnapshot();
  const matching = (after.deliveryAudit || []).filter(
    (row) => String(row?.id || '') === duplicateAuditId,
  );
  assert.equal(matching.length, 1);
  assert.equal(String(matching[0]?.message || ''), 'latest');
});
