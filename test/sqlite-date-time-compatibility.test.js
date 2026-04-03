const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const {
  ensureSqliteDateTimeSchemaCompatibility,
} = require('../src/utils/sqliteDateTimeCompatibility');

test('sqlite date time compatibility rebuild preserves ISO text while converting numeric epochs', async (t) => {
  const dbPath = path.join(os.tmpdir(), `codex-sqlite-datetime-${process.pid}-${Date.now()}.db`);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE "compat_events" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "scheduledAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
  `);
  db.exec(`
    INSERT INTO "compat_events" ("id", "scheduledAt", "createdAt", "updatedAt") VALUES
      ('event-ms', '1774951200000', '1774951200000', '1774951200000'),
      ('event-iso', '2026-03-31T10:00:00.000Z', '2026-03-31T10:00:00.000Z', '2026-03-31T10:00:00.000Z'),
      ('event-space', '2026-03-31 10:00:00', '2026-03-31 10:00:00', '2026-03-31 10:00:00');
  `);
  db.close();

  t.after(() => {
    fs.rmSync(dbPath, { force: true });
  });

  const result = ensureSqliteDateTimeSchemaCompatibility(dbPath, [{
    tableName: 'compat_events',
    columns: ['id', 'scheduledAt', 'createdAt', 'updatedAt'],
    dateColumns: ['scheduledAt', 'createdAt', 'updatedAt'],
    createTableSql: `
      CREATE TABLE "compat_events" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "scheduledAt" DATETIME,
        "createdAt" DATETIME NOT NULL,
        "updatedAt" DATETIME NOT NULL
      );
    `,
    indexSql: [],
  }]);

  assert.equal(result.ok, true);
  assert.equal(result.tables.some((entry) => entry.tableName === 'compat_events' && entry.rebuilt), true);

  const verifyDb = new DatabaseSync(dbPath, { readOnly: true });
  const columns = verifyDb.prepare('PRAGMA table_info("compat_events")').all();
  const rows = verifyDb.prepare('SELECT id, scheduledAt, createdAt, updatedAt FROM "compat_events" ORDER BY id ASC').all();
  verifyDb.close();

  const columnMap = new Map(columns.map((row) => [String(row.name), String(row.type)]));
  assert.equal(columnMap.get('scheduledAt'), 'DATETIME');
  assert.equal(columnMap.get('createdAt'), 'DATETIME');
  assert.equal(columnMap.get('updatedAt'), 'DATETIME');

  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.get('event-ms').scheduledAt, new Date(1774951200000).toISOString());
  assert.equal(byId.get('event-ms').createdAt, new Date(1774951200000).toISOString());
  assert.equal(byId.get('event-iso').scheduledAt, '2026-03-31T10:00:00.000Z');
  assert.equal(byId.get('event-iso').createdAt, '2026-03-31T10:00:00.000Z');
  assert.equal(byId.get('event-space').scheduledAt, '2026-03-31T10:00:00.000Z');
  assert.equal(byId.get('event-space').createdAt, '2026-03-31T10:00:00.000Z');
});
