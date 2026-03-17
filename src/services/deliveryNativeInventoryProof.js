'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function trimText(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function sleep(ms) {
  const delay = Math.max(0, Math.trunc(Number(ms) || 0));
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function normalizeInventoryNativeItemId(value) {
  return trimText(value, 160)
    .replace(/^bp_/i, '')
    .replace(/_es$/i, '')
    .replace(/_c$/i, '')
    .toLowerCase();
}

function resolveFilePath(value) {
  const raw = trimText(value, 1200);
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function inferScumSavefileDbPath(env = process.env) {
  const explicit =
    resolveFilePath(env.DELIVERY_NATIVE_PROOF_SCUM_DB_PATH)
    || resolveFilePath(env.SCUM_SAVEFILE_DB_PATH);
  if (explicit) return explicit;

  const logPath = resolveFilePath(env.SCUM_LOG_PATH);
  if (!logPath) return '';
  const logsDir = path.dirname(logPath);
  const savedDir = path.dirname(logsDir);
  return path.join(savedDir, 'SaveFiles', 'SCUM.db');
}

function listSqliteExecutableCandidates(env = process.env) {
  const candidates = [
    resolveFilePath(env.SCUM_SQLITE3_BIN),
    resolveFilePath(env.SQLITE3_BIN),
    'sqlite3.exe',
    'sqlite3',
    'C:\\Users\\IT\\AppData\\Local\\Microsoft\\WinGet\\Packages\\SQLite.SQLite_Microsoft.Winget.Source_8wekyb3d8bbwe\\sqlite3.exe',
    'C:\\Program Files\\SQLite\\sqlite3.exe',
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

function canExecuteSqlite(binaryPath) {
  const result = spawnSync(binaryPath, ['-version'], {
    windowsHide: true,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.error) return false;
  return Number(result.status || 0) === 0;
}

function findSqliteExecutable(env = process.env) {
  for (const candidate of listSqliteExecutableCandidates(env)) {
    if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) {
      continue;
    }
    if (canExecuteSqlite(candidate)) {
      return candidate;
    }
  }
  return '';
}

function escapeSqliteText(value) {
  return String(value || '').replace(/'/g, "''");
}

function buildPlayerLookupSql(steamId) {
  const id = escapeSqliteText(steamId);
  return `
    SELECT
      u.id AS steamId,
      COALESCE(NULLIF(u.name, ''), NULLIF(up.name, ''), NULLIF(up.fake_name, ''), 'unknown') AS playerName,
      up.id AS userProfileId,
      up.prisoner_id AS prisonerId,
      pe.entity_id AS prisonerEntityId,
      p.is_alive AS isAlive
    FROM user u
    INNER JOIN user_profile up ON up.user_id = u.id
    INNER JOIN prisoner p ON p.id = up.prisoner_id
    INNER JOIN prisoner_entity pe ON pe.prisoner_id = p.id
    WHERE u.id = '${id}'
    ORDER BY COALESCE(up.last_login_time, u.last_login_time) DESC
    LIMIT 1;
  `;
}

function buildInventoryLookupSql(steamId, maxDepth = 8) {
  const id = escapeSqliteText(steamId);
  const safeDepth = Math.max(1, Math.min(32, Math.trunc(Number(maxDepth || 8) || 8)));
  return `
    WITH RECURSIVE inventory_items(entity_id, depth) AS (
      SELECT
        entry.entity_id,
        0 AS depth
      FROM user u
      INNER JOIN user_profile up ON up.user_id = u.id
      INNER JOIN prisoner p ON p.id = up.prisoner_id
      INNER JOIN prisoner_entity pe ON pe.prisoner_id = p.id
      INNER JOIN entity_component inv ON inv.entity_id = pe.entity_id AND inv.name = 'Inventory'
      INNER JOIN entity_inventory_component_entry entry ON entry.entity_component_id = inv.id
      WHERE u.id = '${id}'

      UNION ALL

      SELECT
        child.entity_id,
        inventory_items.depth + 1
      FROM inventory_items
      INNER JOIN entity_component inv ON inv.entity_id = inventory_items.entity_id AND inv.name = 'Inventory'
      INNER JOIN entity_inventory_component_entry child ON child.entity_component_id = inv.id
      WHERE inventory_items.depth < ${safeDepth}
    )
    SELECT
      inventory_items.entity_id AS entityId,
      inventory_items.depth AS depth,
      e.class AS className,
      e.reason AS entityReason,
      COALESCE(stack.quantity, 1) AS quantity,
      item.xml AS itemXml
    FROM inventory_items
    INNER JOIN entity e ON e.id = inventory_items.entity_id
    LEFT JOIN item_entity item ON item.entity_id = inventory_items.entity_id
    LEFT JOIN entity_component stack_component ON stack_component.entity_id = inventory_items.entity_id AND stack_component.name = 'Stackable'
    LEFT JOIN stackable_component_entry stack ON stack.entity_component_id = stack_component.id
    ORDER BY inventory_items.depth ASC, inventory_items.entity_id ASC;
  `;
}

function buildMaxEntityIdSql() {
  return 'SELECT MAX(id) AS maxEntityId FROM entity;';
}

function buildAdminSpawnDeltaSql(minEntityId = 0, maxRows = 200) {
  const safeMinEntityId = Math.max(0, Math.trunc(Number(minEntityId || 0) || 0));
  const safeMaxRows = Math.max(1, Math.min(1000, Math.trunc(Number(maxRows || 200) || 200)));
  return `
    SELECT
      e.id AS entityId,
      e.class AS className,
      e.reason AS entityReason,
      e.owning_entity_id AS owningEntityId,
      e.parent_entity_id AS parentEntityId,
      item.xml AS itemXml
    FROM entity e
    LEFT JOIN item_entity item ON item.entity_id = e.id
    WHERE e.id > ${safeMinEntityId}
      AND e.reason = 'UAdminCommand_SpawnItem::SpawnActorFromClass'
    ORDER BY e.id ASC
    LIMIT ${safeMaxRows};
  `;
}

function runSqliteJsonQuery(databasePath, sql, env = process.env) {
  const sqliteBinary = findSqliteExecutable(env);
  if (!sqliteBinary) {
    const error = new Error('sqlite3 executable not found');
    error.code = 'SQLITE3_NOT_FOUND';
    throw error;
  }
  const result = spawnSync(
    sqliteBinary,
    ['-readonly', '-json', '-cmd', '.timeout 2000', databasePath, sql],
    {
      windowsHide: true,
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.error) {
    const error = new Error(result.error.message);
    error.code = result.error.code || 'SQLITE3_EXEC_FAILED';
    throw error;
  }
  if (Number(result.status || 0) !== 0) {
    const error = new Error(trimText(result.stderr || result.stdout || 'sqlite query failed', 500));
    error.code = 'SQLITE3_QUERY_FAILED';
    throw error;
  }
  const text = trimText(result.stdout, 4 * 1024 * 1024);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    error.code = 'SQLITE3_INVALID_JSON';
    throw error;
  }
}

function parseLastAccessTime(xml) {
  const match = String(xml || '').match(/_lastAccessTime="(\d+)"/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeObservedInventoryRows(rows = [], options = {}) {
  const nowUnix = Math.trunc((Number(options.nowMs) || Date.now()) / 1000);
  const recentWindowMs = Math.max(
    0,
    Math.trunc(Number(options.recentWindowMs || (15 * 60 * 1000)) || (15 * 60 * 1000)),
  );
  const recentCutoff = recentWindowMs > 0 ? nowUnix - Math.trunc(recentWindowMs / 1000) : null;

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const normalizedItemId = normalizeInventoryNativeItemId(row?.className);
      if (!normalizedItemId) return null;
      const quantity = Math.max(1, Math.trunc(Number(row?.quantity || 1) || 1));
      const lastAccessTime = parseLastAccessTime(row?.itemXml);
      const recent = recentCutoff == null
        ? true
        : Number.isFinite(lastAccessTime) && lastAccessTime >= recentCutoff;
      const spawnedViaAdminCommand = /UAdminCommand_SpawnItem::SpawnActorFromClass/i.test(
        String(row?.entityReason || ''),
      );
      return {
        entityId: Number(row?.entityId || 0) || null,
        depth: Math.max(0, Math.trunc(Number(row?.depth || 0) || 0)),
        className: trimText(row?.className, 200) || null,
        normalizedItemId,
        quantity,
        entityReason: trimText(row?.entityReason, 240) || null,
        lastAccessTime,
        recent,
        spawnedViaAdminCommand,
      };
    })
    .filter(Boolean);
}

function summarizeObservedInventory(rows = []) {
  const byItemId = new Map();
  for (const row of rows) {
    const key = row.normalizedItemId;
    if (!key) continue;
    const current = byItemId.get(key) || {
      itemId: key,
      totalQuantity: 0,
      recentQuantity: 0,
      recentSpawnedQuantity: 0,
      examples: [],
    };
    current.totalQuantity += row.quantity;
    if (row.recent) current.recentQuantity += row.quantity;
    if (row.recent && row.spawnedViaAdminCommand) {
      current.recentSpawnedQuantity += row.quantity;
    }
    if (current.examples.length < 5) {
      current.examples.push({
        entityId: row.entityId,
        className: row.className,
        quantity: row.quantity,
        depth: row.depth,
        recent: row.recent,
        spawnedViaAdminCommand: row.spawnedViaAdminCommand,
        lastAccessTime: row.lastAccessTime,
      });
    }
    byItemId.set(key, current);
  }
  return Array.from(byItemId.values()).sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function normalizeObservedSpawnDeltaRows(rows = [], options = {}) {
  const nowUnix = Math.trunc((Number(options.nowMs) || Date.now()) / 1000);
  const recentWindowMs = Math.max(
    0,
    Math.trunc(Number(options.recentWindowMs || (15 * 60 * 1000)) || (15 * 60 * 1000)),
  );
  const recentCutoff = recentWindowMs > 0 ? nowUnix - Math.trunc(recentWindowMs / 1000) : null;

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const normalizedItemId = normalizeInventoryNativeItemId(row?.className);
      if (!normalizedItemId) return null;
      const lastAccessTime = parseLastAccessTime(row?.itemXml);
      const recent = recentCutoff == null
        ? true
        : Number.isFinite(lastAccessTime) && lastAccessTime >= recentCutoff;
      return {
        entityId: Number(row?.entityId || 0) || null,
        className: trimText(row?.className, 200) || null,
        normalizedItemId,
        entityReason: trimText(row?.entityReason, 240) || null,
        owningEntityId: Number(row?.owningEntityId || 0) || null,
        parentEntityId: Number(row?.parentEntityId || 0) || null,
        lastAccessTime,
        recent,
      };
    })
    .filter(Boolean);
}

function normalizeObservedInventorySummary(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const itemId = normalizeInventoryNativeItemId(row?.itemId || row?.className);
      if (!itemId) return null;
      return {
        itemId,
        totalQuantity: Math.max(0, Math.trunc(Number(row?.totalQuantity || 0) || 0)),
        recentQuantity: Math.max(0, Math.trunc(Number(row?.recentQuantity || 0) || 0)),
        recentSpawnedQuantity: Math.max(
          0,
          Math.trunc(Number(row?.recentSpawnedQuantity || 0) || 0),
        ),
        examples: Array.isArray(row?.examples) ? row.examples.slice(0, 5) : [],
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function summarizeExpectedItems(expectedItems = []) {
  const byItemId = new Map();
  for (const entry of Array.isArray(expectedItems) ? expectedItems : []) {
    const itemId = normalizeInventoryNativeItemId(entry?.gameItemId);
    if (!itemId) continue;
    const quantity = Math.max(1, Math.trunc(Number(entry?.quantity || 1) || 1));
    byItemId.set(itemId, (byItemId.get(itemId) || 0) + quantity);
  }
  return Array.from(byItemId.entries())
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function verifyExpectedInventory(expectedItems = [], observedRows = []) {
  const expected = summarizeExpectedItems(expectedItems);
  const observed = summarizeObservedInventory(observedRows);
  const observedMap = new Map(observed.map((row) => [row.itemId, row]));
  const matched = [];
  const missing = [];
  const ambiguous = [];

  for (const entry of expected) {
    const current = observedMap.get(entry.itemId) || {
      itemId: entry.itemId,
      totalQuantity: 0,
      recentQuantity: 0,
      recentSpawnedQuantity: 0,
    };
    if (current.recentSpawnedQuantity >= entry.quantity) {
      matched.push({
        itemId: entry.itemId,
        expectedQuantity: entry.quantity,
        matchedQuantity: current.recentSpawnedQuantity,
        mode: 'recent-spawned',
      });
      continue;
    }
    if (current.totalQuantity >= entry.quantity) {
      ambiguous.push({
        itemId: entry.itemId,
        expectedQuantity: entry.quantity,
        totalQuantity: current.totalQuantity,
        recentSpawnedQuantity: current.recentSpawnedQuantity,
      });
      continue;
    }
    missing.push({
      itemId: entry.itemId,
      expectedQuantity: entry.quantity,
      totalQuantity: current.totalQuantity,
      recentSpawnedQuantity: current.recentSpawnedQuantity,
    });
  }

  return {
    ok: missing.length === 0 && ambiguous.length === 0,
    expected,
    observed,
    matched,
    missing,
    ambiguous,
  };
}

function verifyExpectedInventoryDelta(expectedItems = [], baselineObserved = [], observedSummary = []) {
  const expected = summarizeExpectedItems(expectedItems);
  const baseline = normalizeObservedInventorySummary(baselineObserved);
  const observed = normalizeObservedInventorySummary(observedSummary);
  const baselineMap = new Map(baseline.map((row) => [row.itemId, row]));
  const observedMap = new Map(observed.map((row) => [row.itemId, row]));
  const matched = [];
  const missing = [];
  const ambiguous = [];

  for (const entry of expected) {
    const before = baselineMap.get(entry.itemId) || {
      itemId: entry.itemId,
      totalQuantity: 0,
      recentQuantity: 0,
      recentSpawnedQuantity: 0,
    };
    const after = observedMap.get(entry.itemId) || {
      itemId: entry.itemId,
      totalQuantity: 0,
      recentQuantity: 0,
      recentSpawnedQuantity: 0,
    };
    const deltaTotal = Math.max(0, after.totalQuantity - before.totalQuantity);
    const deltaRecentSpawned = Math.max(
      0,
      after.recentSpawnedQuantity - before.recentSpawnedQuantity,
    );

    if (deltaTotal >= entry.quantity) {
      matched.push({
        itemId: entry.itemId,
        expectedQuantity: entry.quantity,
        beforeQuantity: before.totalQuantity,
        afterQuantity: after.totalQuantity,
        deltaQuantity: deltaTotal,
        deltaRecentSpawnedQuantity: deltaRecentSpawned,
        mode: deltaRecentSpawned >= entry.quantity ? 'baseline-delta-spawned' : 'baseline-delta',
      });
      continue;
    }

    if (after.totalQuantity >= entry.quantity) {
      ambiguous.push({
        itemId: entry.itemId,
        expectedQuantity: entry.quantity,
        beforeQuantity: before.totalQuantity,
        afterQuantity: after.totalQuantity,
        deltaQuantity: deltaTotal,
        deltaRecentSpawnedQuantity: deltaRecentSpawned,
      });
      continue;
    }

    missing.push({
      itemId: entry.itemId,
      expectedQuantity: entry.quantity,
      beforeQuantity: before.totalQuantity,
      afterQuantity: after.totalQuantity,
      deltaQuantity: deltaTotal,
      deltaRecentSpawnedQuantity: deltaRecentSpawned,
    });
  }

  return {
    ok: missing.length === 0 && ambiguous.length === 0,
    expected,
    baseline,
    observed,
    matched,
    missing,
    ambiguous,
  };
}

function verifyExpectedSpawnDelta(expectedItems = [], spawnedRows = []) {
  const expected = summarizeExpectedItems(expectedItems);
  const grouped = new Map();
  for (const row of Array.isArray(spawnedRows) ? spawnedRows : []) {
    const key = row.normalizedItemId;
    if (!key) continue;
    const current = grouped.get(key) || {
      itemId: key,
      count: 0,
      examples: [],
    };
    current.count += 1;
    if (current.examples.length < 5) {
      current.examples.push({
        entityId: row.entityId,
        className: row.className,
        owningEntityId: row.owningEntityId,
        parentEntityId: row.parentEntityId,
        lastAccessTime: row.lastAccessTime,
        recent: row.recent,
      });
    }
    grouped.set(key, current);
  }

  const matched = [];
  const missing = [];
  for (const entry of expected) {
    const current = grouped.get(entry.itemId) || {
      itemId: entry.itemId,
      count: 0,
      examples: [],
    };
    if (current.count >= entry.quantity) {
      matched.push({
        itemId: entry.itemId,
        expectedQuantity: entry.quantity,
        matchedQuantity: current.count,
        mode: 'world-spawn-delta',
        examples: current.examples,
      });
      continue;
    }
    missing.push({
      itemId: entry.itemId,
      expectedQuantity: entry.quantity,
      matchedQuantity: current.count,
      examples: current.examples,
    });
  }

  return {
    ok: missing.length === 0,
    expected,
    observed: Array.from(grouped.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    matched,
    missing,
    ambiguous: [],
  };
}

function normalizePlayerRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    steamId: trimText(row.steamId, 120) || null,
    playerName: trimText(row.playerName, 180) || null,
    userProfileId: Number(row.userProfileId || 0) || null,
    prisonerId: Number(row.prisonerId || 0) || null,
    prisonerEntityId: Number(row.prisonerEntityId || 0) || null,
    isAlive: Number(row.isAlive || 0) === 1,
  };
}

function buildNativeProofResult(base = {}) {
  return {
    ok: base.ok === true,
    code: trimText(base.code, 120) || (base.ok ? 'READY' : 'DELIVERY_NATIVE_PROOF_FAILED'),
    proofType: 'inventory-state',
    detail: trimText(base.detail, 500) || (base.ok ? 'Inventory proof passed' : 'Inventory proof failed'),
    warnings: Array.isArray(base.warnings)
      ? base.warnings.map((entry) => trimText(entry, 300)).filter(Boolean)
      : [],
    evidence: base.evidence && typeof base.evidence === 'object' ? base.evidence : {},
  };
}

function buildInventoryProofCode(verification = {}) {
  if (verification.ok) return 'READY';
  if (Array.isArray(verification.missing) && verification.missing.length > 0) {
    return 'DELIVERY_NATIVE_PROOF_ITEMS_MISSING';
  }
  return 'DELIVERY_NATIVE_PROOF_AMBIGUOUS_MATCH';
}

function buildInventoryProofDetail(verification = {}, options = {}) {
  const expectedCount = Array.isArray(verification.expected) ? verification.expected.length : 0;
  const matchedCount = Array.isArray(verification.matched) ? verification.matched.length : 0;
  const strategy = String(options.strategy || '').trim();
  if (verification.ok) {
    if (strategy === 'baseline-delta') {
      return `Inventory proof matched ${matchedCount}/${expectedCount} expected item classes using pre/post inventory delta`;
    }
    if (strategy === 'world-spawn-delta') {
      return `Game-state proof matched ${matchedCount}/${expectedCount} expected item classes using post-baseline spawned entity delta`;
    }
    return `Inventory proof matched ${matchedCount}/${expectedCount} expected item classes`;
  }
  if (Array.isArray(verification.missing) && verification.missing.length > 0) {
    if (strategy === 'baseline-delta') {
      return `Inventory proof is missing ${verification.missing.length} expected item classes after comparing pre/post inventory state`;
    }
    if (strategy === 'world-spawn-delta') {
      return `Game-state proof did not observe ${verification.missing.length} expected item classes among entities spawned after the baseline cursor`;
    }
    return `Inventory proof is missing ${verification.missing.length} expected item classes`;
  }
  if (strategy === 'baseline-delta') {
    return 'Inventory proof found expected items but inventory delta did not confirm they were added by this delivery';
  }
  if (strategy === 'world-spawn-delta') {
    return 'Game-state proof found expected items but did not observe a matching spawned entity after the baseline cursor';
  }
  return 'Inventory proof found expected items but could not confirm they were newly spawned by admin command';
}

function buildInventoryProofWarnings(verification = {}, options = {}) {
  const warnings = [];
  const strategy = String(options.strategy || '').trim();
  if (Array.isArray(verification.ambiguous) && verification.ambiguous.length > 0) {
    warnings.push(
      strategy === 'baseline-delta'
        ? 'Some expected items exist after delivery, but the inventory delta does not prove they were added by this run.'
        : strategy === 'world-spawn-delta'
          ? 'Some expected items exist in game state, but the spawned entity delta did not prove they were created by this run.'
        : 'Some expected items exist in player inventory but were not observed as recent admin-spawned entities.',
    );
  }
  return warnings;
}

async function loadScumSavefileInventoryState(steamId, options = {}) {
  const env = options.env || process.env;
  const id = trimText(steamId, 120);
  if (!id) {
    return {
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_STEAM_ID_REQUIRED',
      detail: 'steamId is required for savefile inventory proof',
      evidence: {},
    };
  }

  const dbPath = inferScumSavefileDbPath(env);
  if (!dbPath || !fs.existsSync(dbPath)) {
    return {
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_DB_MISSING',
      detail: `SCUM savefile database not found: ${dbPath || '(not configured)'}`,
      evidence: {
        databasePath: dbPath || null,
      },
    };
  }

  let playerRows = [];
  let inventoryRows = [];
  let maxEntityRows = [];
  try {
    playerRows = runSqliteJsonQuery(dbPath, buildPlayerLookupSql(id), env);
    inventoryRows = runSqliteJsonQuery(dbPath, buildInventoryLookupSql(id), env);
    maxEntityRows = runSqliteJsonQuery(dbPath, buildMaxEntityIdSql(), env);
  } catch (error) {
    return {
      ok: false,
      code: trimText(error?.code, 120) || 'DELIVERY_NATIVE_PROOF_DB_QUERY_FAILED',
      detail: trimText(error?.message, 500) || 'Failed to query SCUM savefile database',
      evidence: {
        databasePath: dbPath,
      },
    };
  }

  const player = normalizePlayerRow(Array.isArray(playerRows) ? playerRows[0] : null);
  if (!player) {
    return {
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_PLAYER_NOT_FOUND',
      detail: `Player not found in SCUM savefile for steamId=${id}`,
      evidence: {
        databasePath: dbPath,
        steamId: id,
      },
    };
  }

  if (!player.isAlive) {
    return {
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_PLAYER_NOT_ALIVE',
      detail: `Player ${player.playerName || id} is not alive in current save state`,
      evidence: {
        databasePath: dbPath,
        player,
      },
    };
  }

  const observedRows = normalizeObservedInventoryRows(inventoryRows, {
    nowMs: options.nowMs,
    recentWindowMs:
      options.recentWindowMs
      || env.DELIVERY_NATIVE_PROOF_RECENT_WINDOW_MS
      || (15 * 60 * 1000),
  });

  return {
    ok: true,
    code: 'READY',
    detail: `Loaded inventory state for ${player.playerName || id}`,
    databasePath: dbPath,
    player,
    entityCursor: {
      maxEntityId: Number(maxEntityRows?.[0]?.maxEntityId || 0) || 0,
    },
    observedRows,
    observed: summarizeObservedInventory(observedRows),
  };
}

async function runScumSavefileInventoryProof(payload = {}, options = {}) {
  const env = options.env || process.env;
  const hasBaselineInput =
    Object.prototype.hasOwnProperty.call(payload || {}, 'baselineObserved')
    || (
      payload?.baselineInventory
      && typeof payload.baselineInventory === 'object'
      && Object.prototype.hasOwnProperty.call(payload.baselineInventory, 'observed')
    );
  const baselineObserved = normalizeObservedInventorySummary(
    payload?.baselineInventory?.observed || payload?.baselineObserved,
  );
  const baselineEntityCursor = Number(
    payload?.baselineInventory?.entityCursor?.maxEntityId
    || payload?.baselineEntityCursor?.maxEntityId
    || 0,
  ) || 0;
  async function evaluateOnce() {
    const state = await loadScumSavefileInventoryState(payload?.steamId, options);
    if (!state.ok) {
      return {
        state,
        result: buildNativeProofResult({
          ok: false,
          code: state.code,
          detail: state.detail,
          evidence: state.evidence,
        }),
      };
    }

    const verification = verifyExpectedInventory(payload?.expectedItems || [], state.observedRows);
    const deltaVerification = hasBaselineInput
      ? verifyExpectedInventoryDelta(payload?.expectedItems || [], baselineObserved, state.observed)
      : null;
    let spawnDeltaVerification = null;
    if (baselineEntityCursor > 0) {
      try {
        const spawnDeltaRows = runSqliteJsonQuery(
          state.databasePath,
          buildAdminSpawnDeltaSql(baselineEntityCursor),
          env,
        );
        spawnDeltaVerification = verifyExpectedSpawnDelta(
          payload?.expectedItems || [],
          normalizeObservedSpawnDeltaRows(spawnDeltaRows, options),
        );
      } catch (error) {
        spawnDeltaVerification = {
          ok: false,
          expected: summarizeExpectedItems(payload?.expectedItems || []),
          observed: [],
          matched: [],
          missing: summarizeExpectedItems(payload?.expectedItems || []).map((entry) => ({
            itemId: entry.itemId,
            expectedQuantity: entry.quantity,
            matchedQuantity: 0,
          })),
          ambiguous: [],
          error: {
            code: trimText(error?.code, 120) || 'DELIVERY_NATIVE_PROOF_SPAWN_DELTA_FAILED',
            detail: trimText(error?.message, 500) || 'Failed to query admin spawn delta',
          },
        };
      }
    }
    const activeVerification = deltaVerification?.ok
      ? deltaVerification
      : spawnDeltaVerification?.ok
        ? spawnDeltaVerification
        : verification;
    const strategy = deltaVerification?.ok
      ? 'baseline-delta'
      : spawnDeltaVerification?.ok
        ? 'world-spawn-delta'
        : 'recent-spawned';

    return {
      state,
      strategy,
      verification,
      deltaVerification,
      spawnDeltaVerification,
      result: buildNativeProofResult({
        ok: activeVerification.ok,
        code: buildInventoryProofCode(activeVerification),
        detail: buildInventoryProofDetail(activeVerification, { strategy }),
        warnings: buildInventoryProofWarnings(activeVerification, { strategy }),
        evidence: {
          databasePath: state.databasePath,
          player: state.player,
          purchaseCode: trimText(payload?.purchaseCode, 120) || null,
          strategy,
          expected: activeVerification.expected,
          matched: activeVerification.matched,
          missing: activeVerification.missing,
          ambiguous: activeVerification.ambiguous,
          observed: state.observed,
          baselineObserved,
          baselineEntityCursor: baselineEntityCursor || null,
          deltaVerification,
          spawnDeltaVerification,
          recentSpawnVerification: verification,
        },
      }),
    };
  }

  let evaluation = await evaluateOnce();
  const maxWaitMs = Math.max(
    0,
    Math.trunc(
      Number(
        options.maxWaitMs
        || env.DELIVERY_NATIVE_PROOF_WAIT_FOR_STATE_MS
        || env.DELIVERY_NATIVE_PROOF_TIMEOUT_MS
        || 0,
      ) || 0,
    ),
  );
  const pollIntervalMs = Math.max(
    500,
    Math.trunc(Number(options.pollIntervalMs || env.DELIVERY_NATIVE_PROOF_POLL_INTERVAL_MS || 1500) || 1500),
  );

  if (
    evaluation?.result?.ok !== true
    && hasBaselineInput
    && maxWaitMs > 0
  ) {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      const remainingMs = deadline - Date.now();
      await sleep(Math.min(pollIntervalMs, remainingMs));
      evaluation = await evaluateOnce();
      if (evaluation?.result?.ok === true) {
        break;
      }
    }
  }

  return evaluation.result;
}

module.exports = {
  buildAdminSpawnDeltaSql,
  buildInventoryLookupSql,
  buildMaxEntityIdSql,
  buildPlayerLookupSql,
  findSqliteExecutable,
  inferScumSavefileDbPath,
  loadScumSavefileInventoryState,
  normalizeInventoryNativeItemId,
  normalizeObservedInventoryRows,
  normalizeObservedInventorySummary,
  normalizeObservedSpawnDeltaRows,
  parseLastAccessTime,
  runScumSavefileInventoryProof,
  summarizeExpectedItems,
  summarizeObservedInventory,
  verifyExpectedInventoryDelta,
  verifyExpectedInventory,
  verifyExpectedSpawnDelta,
};
