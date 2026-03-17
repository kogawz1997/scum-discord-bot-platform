const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  findSqliteExecutable,
  inferScumSavefileDbPath,
  normalizeInventoryNativeItemId,
  normalizeObservedInventorySummary,
  normalizeObservedSpawnDeltaRows,
  parseLastAccessTime,
  runScumSavefileInventoryProof,
  verifyExpectedInventoryDelta,
  verifyExpectedInventory,
  verifyExpectedSpawnDelta,
} = require('../src/services/deliveryNativeInventoryProof');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'native-proof-'));
}

function writeSqliteFixtureDatabase(dbPath) {
  const sqlite = findSqliteExecutable(process.env);
  if (!sqlite) {
    return false;
  }
  const nowUnix = Math.trunc(Date.now() / 1000);
  const oldUnix = nowUnix - (24 * 60 * 60);
  const sql = `
    CREATE TABLE user(id TEXT PRIMARY KEY, name TEXT, provider TEXT, last_login_time TEXT);
    CREATE TABLE user_profile(id INTEGER PRIMARY KEY, user_id TEXT, name TEXT, prisoner_id INTEGER, last_login_time TEXT, fake_name TEXT);
    CREATE TABLE prisoner(id INTEGER PRIMARY KEY, user_profile_id INTEGER, is_alive INTEGER);
    CREATE TABLE prisoner_entity(entity_id INTEGER PRIMARY KEY, prisoner_id INTEGER);
    CREATE TABLE entity(id INTEGER PRIMARY KEY, entity_system_id INTEGER, class TEXT, owning_entity_id INTEGER, parent_entity_id INTEGER, reason TEXT);
    CREATE TABLE entity_component(id INTEGER PRIMARY KEY, entity_id INTEGER, name TEXT, class TEXT, flags INTEGER, data BLOB);
    CREATE TABLE entity_inventory_component_entry(entity_component_id INTEGER NOT NULL, entity_id INTEGER NOT NULL, data INTEGER NOT NULL, PRIMARY KEY(entity_component_id, entity_id));
    CREATE TABLE item_entity(entity_id INTEGER PRIMARY KEY, xml TEXT);
    CREATE TABLE stackable_component_entry(entity_component_id INTEGER PRIMARY KEY, quantity INTEGER);

    INSERT INTO user(id, name, provider, last_login_time) VALUES ('76561190000000001', 'Tester', 'Server', '2026-03-17T10:00:00Z');
    INSERT INTO user_profile(id, user_id, name, prisoner_id, last_login_time, fake_name) VALUES (1, '76561190000000001', 'Tester', 1, '2026-03-17T10:00:00Z', '');
    INSERT INTO prisoner(id, user_profile_id, is_alive) VALUES (1, 1, 1);
    INSERT INTO prisoner_entity(entity_id, prisoner_id) VALUES (40004, 1);
    INSERT INTO entity(id, entity_system_id, class, owning_entity_id, parent_entity_id, reason) VALUES
      (40004, 1, 'BP_Prisoner_ES', NULL, NULL, NULL),
      (40005, 1, 'InventoryComponent', 40004, 40004, NULL),
      (50171, 1, 'Water_05l_ES', 40004, 40004, 'UAdminCommand_SpawnItem::SpawnActorFromClass'),
      (50172, 1, 'Weapon_AK47_ES', 40004, 40004, 'UAdminCommand_SpawnItem::SpawnActorFromClass'),
      (50173, 1, 'Magazine_M1911_ES', 40004, 40004, 'UAdminCommand_SpawnItem::SpawnActorFromClass');
    INSERT INTO entity_component(id, entity_id, name, class, flags, data) VALUES
      (40005, 40004, 'Inventory', '', 2, NULL),
      (50174, 50173, 'Stackable', '', 0, NULL);
    INSERT INTO entity_inventory_component_entry(entity_component_id, entity_id, data) VALUES
      (40005, 50171, 0),
      (40005, 50172, 0),
      (40005, 50173, 0);
    INSERT INTO item_entity(entity_id, xml) VALUES
      (50171, '<Item _lastAccessTime="${nowUnix}" />'),
      (50172, '<Item _lastAccessTime="${oldUnix}" />'),
      (50173, '<Item _lastAccessTime="${nowUnix}" />');
    INSERT INTO stackable_component_entry(entity_component_id, quantity) VALUES (50174, 4);
  `;
  const result = spawnSync(sqlite, [dbPath, sql], {
    windowsHide: true,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.error || Number(result.status || 0) !== 0) {
    throw new Error(result.error?.message || result.stderr || 'failed to create sqlite fixture');
  }
  return true;
}

test('normalizeInventoryNativeItemId strips BP_ and _ES markers', () => {
  assert.equal(normalizeInventoryNativeItemId('BP_Weapon_AK47'), 'weapon_ak47');
  assert.equal(normalizeInventoryNativeItemId('Magazine_M1911_ES'), 'magazine_m1911');
});

test('inferScumSavefileDbPath derives SCUM.db from SCUM_LOG_PATH', () => {
  const resolved = inferScumSavefileDbPath({
    SCUM_LOG_PATH: 'Z:\\SteamLibrary\\steamapps\\common\\SCUM Server\\SCUM\\Saved\\Logs\\SCUM.log',
  });
  assert.equal(
    resolved,
    'Z:\\SteamLibrary\\steamapps\\common\\SCUM Server\\SCUM\\Saved\\SaveFiles\\SCUM.db',
  );
});

test('parseLastAccessTime extracts unix timestamps from item xml', () => {
  assert.equal(parseLastAccessTime('<Item _lastAccessTime="1770000000" />'), 1770000000);
  assert.equal(parseLastAccessTime('<Item />'), null);
});

test('verifyExpectedInventory distinguishes matched, ambiguous, and missing rows', () => {
  const result = verifyExpectedInventory(
    [
      { gameItemId: 'Water_05l', quantity: 1 },
      { gameItemId: 'Weapon_AK47', quantity: 1 },
      { gameItemId: 'Magazine_M1911', quantity: 5 },
    ],
    [
      {
        normalizedItemId: 'water_05l',
        quantity: 1,
        recent: true,
        spawnedViaAdminCommand: true,
      },
      {
        normalizedItemId: 'weapon_ak47',
        quantity: 1,
        recent: false,
        spawnedViaAdminCommand: true,
      },
      {
        normalizedItemId: 'magazine_m1911',
        quantity: 4,
        recent: true,
        spawnedViaAdminCommand: true,
      },
    ],
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.matched.map((row) => row.itemId), ['water_05l']);
  assert.deepEqual(result.ambiguous.map((row) => row.itemId), ['weapon_ak47']);
  assert.deepEqual(result.missing.map((row) => row.itemId), ['magazine_m1911']);
});

test('verifyExpectedInventoryDelta matches inventory growth even without recent timestamps', () => {
  const result = verifyExpectedInventoryDelta(
    [{ gameItemId: 'Weapon_AK47', quantity: 1 }],
    [],
    normalizeObservedInventorySummary([
      {
        itemId: 'weapon_ak47',
        totalQuantity: 1,
        recentQuantity: 0,
        recentSpawnedQuantity: 0,
      },
    ]),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.matched.map((row) => row.itemId), ['weapon_ak47']);
});

test('verifyExpectedSpawnDelta matches new world-spawned entities after baseline cursor', () => {
  const result = verifyExpectedSpawnDelta(
    [{ gameItemId: 'Water_05l', quantity: 1 }],
    normalizeObservedSpawnDeltaRows([
      {
        entityId: 9001,
        className: 'Water_05l_ES',
        entityReason: 'UAdminCommand_SpawnItem::SpawnActorFromClass',
        owningEntityId: null,
        parentEntityId: null,
        itemXml: '<Item _lastAccessTime="1770000000" />',
      },
    ]),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.matched.map((row) => row.itemId), ['water_05l']);
});

test('runScumSavefileInventoryProof reads a live-style SCUM sqlite savefile', async (t) => {
  const tempDir = createTempDir();
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const dbPath = path.join(tempDir, 'SCUM.db');
  const sqliteAvailable = writeSqliteFixtureDatabase(dbPath);
  if (!sqliteAvailable) {
    t.skip('sqlite3 executable is not available');
    return;
  }

  const okResult = await runScumSavefileInventoryProof(
    {
      steamId: '76561190000000001',
      purchaseCode: 'P-NATIVE-1',
      expectedItems: [
        { gameItemId: 'Water_05l', quantity: 1 },
        { gameItemId: 'Magazine_M1911', quantity: 4 },
      ],
    },
    {
      env: {
        DELIVERY_NATIVE_PROOF_SCUM_DB_PATH: dbPath,
      },
      nowMs: Date.now(),
      recentWindowMs: 10 * 60 * 1000,
    },
  );

  assert.equal(okResult.ok, true);
  assert.equal(okResult.code, 'READY');
  assert.equal(okResult.evidence.player.steamId, '76561190000000001');

  const ambiguousResult = await runScumSavefileInventoryProof(
    {
      steamId: '76561190000000001',
      purchaseCode: 'P-NATIVE-2',
      expectedItems: [
        { gameItemId: 'Weapon_AK47', quantity: 1 },
      ],
    },
    {
      env: {
        DELIVERY_NATIVE_PROOF_SCUM_DB_PATH: dbPath,
      },
      nowMs: Date.now(),
      recentWindowMs: 10 * 60 * 1000,
    },
  );

  assert.equal(ambiguousResult.ok, false);
  assert.equal(ambiguousResult.code, 'DELIVERY_NATIVE_PROOF_AMBIGUOUS_MATCH');

  const deltaResult = await runScumSavefileInventoryProof(
    {
      steamId: '76561190000000001',
      purchaseCode: 'P-NATIVE-3',
      expectedItems: [
        { gameItemId: 'Weapon_AK47', quantity: 1 },
      ],
      baselineInventory: {
        observed: [],
      },
    },
    {
      env: {
        DELIVERY_NATIVE_PROOF_SCUM_DB_PATH: dbPath,
      },
      nowMs: Date.now(),
      recentWindowMs: 10 * 60 * 1000,
    },
  );

  assert.equal(deltaResult.ok, true);
  assert.equal(deltaResult.code, 'READY');
  assert.equal(deltaResult.evidence.strategy, 'baseline-delta');

  const worldSpawnDeltaResult = await runScumSavefileInventoryProof(
    {
      steamId: '76561190000000001',
      purchaseCode: 'P-NATIVE-4',
      expectedItems: [
        { gameItemId: 'Weapon_AK47', quantity: 1 },
      ],
      baselineInventory: {
        observed: [
          {
            itemId: 'weapon_ak47',
            totalQuantity: 1,
            recentQuantity: 0,
            recentSpawnedQuantity: 0,
          },
        ],
        entityCursor: {
          maxEntityId: 50171,
        },
      },
    },
    {
      env: {
        DELIVERY_NATIVE_PROOF_SCUM_DB_PATH: dbPath,
      },
      nowMs: Date.now(),
      recentWindowMs: 10 * 60 * 1000,
    },
  );

  assert.equal(worldSpawnDeltaResult.ok, true);
  assert.equal(worldSpawnDeltaResult.code, 'READY');
  assert.equal(worldSpawnDeltaResult.evidence.strategy, 'world-spawn-delta');
});
