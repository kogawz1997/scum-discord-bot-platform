const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminSnapshot,
  normalizeAdminBackupPayload,
  restoreAdminSnapshotData,
} = require('../src/services/adminSnapshotService');

function waitForAsyncStoreFlush(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('admin snapshot restore remains compatible when older backups omit newer auth/runtime collections', async (t) => {
  const baseline = await buildAdminSnapshot();
  const legacyCompatibleSnapshot = JSON.parse(JSON.stringify(baseline));

  delete legacyCompatibleSnapshot.adminSecurityEvents;
  delete legacyCompatibleSnapshot.adminNotifications;
  delete legacyCompatibleSnapshot.adminCommandCapabilityPresets;
  delete legacyCompatibleSnapshot.platformOpsState;
  delete legacyCompatibleSnapshot.backupRestore;
  delete legacyCompatibleSnapshot.deliveryRuntime;
  delete legacyCompatibleSnapshot.runtimeSupervisor;
  delete legacyCompatibleSnapshot.adminRequestLogs;

  t.after(async () => {
    await waitForAsyncStoreFlush();
    await restoreAdminSnapshotData(baseline);
    await waitForAsyncStoreFlush();
  });

  await restoreAdminSnapshotData(legacyCompatibleSnapshot);
  await waitForAsyncStoreFlush();
  const restored = await buildAdminSnapshot();

  assert.ok(Array.isArray(restored.adminSecurityEvents));
  assert.ok(Array.isArray(restored.adminNotifications));
  assert.ok(Array.isArray(restored.adminCommandCapabilityPresets));
  assert.equal(typeof restored.platformOpsState, 'object');
  assert.equal(typeof restored.backupRestore, 'object');
});

test('normalizeAdminBackupPayload accepts current and legacy backup shapes', async () => {
  const baseline = await buildAdminSnapshot();

  const currentPayload = normalizeAdminBackupPayload({
    schemaVersion: 1,
    createdAt: '2026-03-15T00:00:00.000Z',
    createdBy: 'test-user',
    note: 'current',
    snapshot: baseline,
  });
  assert.equal(currentPayload.schemaVersion, 1);
  assert.equal(currentPayload.compatibilityMode, 'current');
  assert.equal(typeof currentPayload.snapshot, 'object');

  const legacyWrappedPayload = normalizeAdminBackupPayload({
    createdAt: '2026-03-14T00:00:00.000Z',
    note: 'legacy-wrapped',
    snapshot: baseline,
  });
  assert.equal(legacyWrappedPayload.schemaVersion, 0);
  assert.equal(legacyWrappedPayload.compatibilityMode, 'legacy-wrapped');

  const legacyUnwrappedPayload = normalizeAdminBackupPayload(baseline);
  assert.equal(legacyUnwrappedPayload.schemaVersion, 0);
  assert.equal(legacyUnwrappedPayload.compatibilityMode, 'legacy-unwrapped');
});

test('normalizeAdminBackupPayload rejects unsupported future schemaVersion', () => {
  assert.throws(
    () => normalizeAdminBackupPayload({
      schemaVersion: 2,
      snapshot: {},
    }),
    /schemaVersion is not supported/i,
  );
});
