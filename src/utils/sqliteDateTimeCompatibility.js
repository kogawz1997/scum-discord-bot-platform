'use strict';

const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

function trimText(value) {
  return String(value || '').trim();
}

function quoteIdentifier(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function getCompatibilityClientKey(db) {
  if (!db || typeof db !== 'object') return null;
  return db._originalClient || db;
}

function quoteLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function parseEpochDate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const absolute = Math.abs(numeric);
  if (absolute >= 100000000000) {
    const date = new Date(numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (absolute >= 1000000000) {
    const date = new Date(numeric * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function normalizeSqliteDateTimeIso(value) {
  if (value == null) {
    return { ok: true, value: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false, value: null };
    return { ok: true, value: value.toISOString() };
  }

  if (typeof value === 'number') {
    const epochDate = parseEpochDate(value);
    if (!epochDate) return { ok: false, value: null };
    return { ok: true, value: epochDate.toISOString() };
  }

  const text = trimText(value);
  if (!text) {
    return { ok: true, value: null };
  }

  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const epochDate = parseEpochDate(Number(text));
    if (!epochDate) return { ok: false, value: null };
    return { ok: true, value: epochDate.toISOString() };
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
    const date = new Date(text.replace(' ', 'T') + 'Z');
    if (!Number.isNaN(date.getTime())) {
      return { ok: true, value: date.toISOString() };
    }
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) {
    const date = new Date(`${text}Z`);
    if (!Number.isNaN(date.getTime())) {
      return { ok: true, value: date.toISOString() };
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, value: null };
  }
  return { ok: true, value: parsed.toISOString() };
}

function toComparableDateText(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const text = trimText(value);
  return text || null;
}

async function reconcileSqliteDateColumns(db, options = {}) {
  const tableName = trimText(options.tableName);
  const idColumn = trimText(options.idColumn || 'id');
  const dateColumns = Array.isArray(options.dateColumns)
    ? options.dateColumns.map((entry) => trimText(entry)).filter(Boolean)
    : [];

  if (!db || typeof db.$queryRawUnsafe !== 'function' || typeof db.$executeRawUnsafe !== 'function') {
    throw new Error('sqlite-date-time-compatibility-db-invalid');
  }
  if (!tableName || !idColumn || dateColumns.length === 0) {
    return {
      tableName,
      scannedRows: 0,
      updatedRows: 0,
      updatedFields: 0,
    };
  }

  const selectColumns = [idColumn, ...dateColumns].map(quoteIdentifier).join(', ');
  const rows = await db.$queryRawUnsafe(`SELECT ${selectColumns} FROM ${quoteIdentifier(tableName)}`);
  let updatedRows = 0;
  let updatedFields = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const rowId = row?.[idColumn];
    if (rowId == null || trimText(rowId) === '') continue;

    const nextValues = {};
    for (const columnName of dateColumns) {
      const normalized = normalizeSqliteDateTimeIso(row?.[columnName]);
      if (!normalized.ok || normalized.value == null) continue;
      if (normalized.value === toComparableDateText(row?.[columnName])) continue;
      nextValues[columnName] = normalized.value;
    }

    const changedColumns = Object.keys(nextValues);
    if (changedColumns.length === 0) continue;

    const sql = `UPDATE ${quoteIdentifier(tableName)} SET ${changedColumns.map((columnName) => `${quoteIdentifier(columnName)} = ?`).join(', ')} WHERE ${quoteIdentifier(idColumn)} = ?`;
    await db.$executeRawUnsafe(sql, ...changedColumns.map((columnName) => nextValues[columnName]), rowId);
    updatedRows += 1;
    updatedFields += changedColumns.length;
  }

  return {
    tableName,
    scannedRows: Array.isArray(rows) ? rows.length : 0,
    updatedRows,
    updatedFields,
  };
}

function getSqliteTableInfo(db, tableName) {
  return db.prepare(`PRAGMA table_info(${quoteLiteral(tableName)})`).all();
}

function hasCompatibleDateTimeColumns(tableInfo = [], dateColumns = []) {
  const columnMap = new Map(
    (Array.isArray(tableInfo) ? tableInfo : [])
      .map((row) => [trimText(row?.name).toLowerCase(), trimText(row?.type).toUpperCase()]),
  );
  return dateColumns.every((columnName) => {
    const columnType = columnMap.get(trimText(columnName).toLowerCase());
    return columnType === 'DATETIME' || columnType === 'TIMESTAMP' || columnType === 'TIMESTAMP(3)';
  });
}

function buildSqliteDateTimeSelectExpression(columnName) {
  const identifier = quoteIdentifier(columnName);
  const textValue = `TRIM(CAST(${identifier} AS TEXT))`;
  const digitsOnly = `${textValue} <> '' AND ${textValue} NOT GLOB '*[^0-9]*'`;
  return `
    CASE
      WHEN ${identifier} IS NULL OR ${textValue} = '' THEN NULL
      WHEN TYPEOF(${identifier}) IN ('integer', 'real') AND ABS(${identifier}) >= 100000000000
        THEN STRFTIME('%Y-%m-%dT%H:%M:%fZ', ${identifier} / 1000.0, 'unixepoch')
      WHEN TYPEOF(${identifier}) IN ('integer', 'real') AND ABS(${identifier}) >= 1000000000
        THEN STRFTIME('%Y-%m-%dT%H:%M:%fZ', ${identifier}, 'unixepoch')
      WHEN ${digitsOnly} AND LENGTH(${textValue}) >= 12
        THEN STRFTIME('%Y-%m-%dT%H:%M:%fZ', CAST(${textValue} AS REAL) / 1000.0, 'unixepoch')
      WHEN ${digitsOnly} AND LENGTH(${textValue}) >= 10
        THEN STRFTIME('%Y-%m-%dT%H:%M:%fZ', CAST(${textValue} AS REAL), 'unixepoch')
      WHEN INSTR(${textValue}, ' ') > 0 AND INSTR(${textValue}, 'T') = 0
        THEN REPLACE(SUBSTR(${textValue}, 1, 19), ' ', 'T') || '.000Z'
      WHEN INSTR(${textValue}, 'T') > 0 AND INSTR(${textValue}, 'Z') = 0 AND INSTR(${textValue}, '+') = 0
        THEN ${textValue} || 'Z'
      ELSE ${textValue}
    END AS ${identifier}
  `.trim();
}

function buildSqliteCompatibilitySelectList(columnNames = [], dateColumns = []) {
  const dateSet = new Set((Array.isArray(dateColumns) ? dateColumns : []).map((entry) => trimText(entry).toLowerCase()));
  return (Array.isArray(columnNames) ? columnNames : [])
    .map((columnName) => {
      const normalized = trimText(columnName);
      if (!normalized) return null;
      if (!dateSet.has(normalized.toLowerCase())) {
        return quoteIdentifier(normalized);
      }
      return buildSqliteDateTimeSelectExpression(normalized);
    })
    .filter(Boolean)
    .join(', ');
}

function ensureSqliteDateTimeSchemaCompatibility(databaseFilePath, configs = []) {
  const normalizedPath = trimText(databaseFilePath);
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return {
      ok: false,
      reason: 'sqlite-database-missing',
      tables: [],
    };
  }

  const db = new DatabaseSync(normalizedPath);
  const summary = [];
  try {
    db.exec('BEGIN IMMEDIATE');
    for (const config of Array.isArray(configs) ? configs : []) {
      const tableName = trimText(config?.tableName);
      const columns = Array.isArray(config?.columns) ? config.columns.map((entry) => trimText(entry)).filter(Boolean) : [];
      const dateColumns = Array.isArray(config?.dateColumns) ? config.dateColumns.map((entry) => trimText(entry)).filter(Boolean) : [];
      const createTableSql = trimText(config?.createTableSql);
      const indexSql = Array.isArray(config?.indexSql) ? config.indexSql.map((entry) => trimText(entry)).filter(Boolean) : [];
      if (!tableName || columns.length === 0 || !createTableSql) continue;

      const tableInfo = getSqliteTableInfo(db, tableName);
      if (tableInfo.length === 0) {
        summary.push({ tableName, rebuilt: false, reason: 'table-missing' });
        continue;
      }
      if (hasCompatibleDateTimeColumns(tableInfo, dateColumns)) {
        summary.push({ tableName, rebuilt: false, reason: 'already-compatible' });
        continue;
      }

      const legacyTableName = `${tableName}__compat_old_${Date.now()}`;
      const selectList = buildSqliteCompatibilitySelectList(columns, dateColumns);
      db.exec(`ALTER TABLE ${quoteIdentifier(tableName)} RENAME TO ${quoteIdentifier(legacyTableName)};`);
      db.exec(createTableSql);
      db.exec(`INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) SELECT ${selectList} FROM ${quoteIdentifier(legacyTableName)};`);
      db.exec(`DROP TABLE ${quoteIdentifier(legacyTableName)};`);
      for (const statement of indexSql) {
        db.exec(statement);
      }
      summary.push({ tableName, rebuilt: true, reason: 'date-time-columns-retyped' });
    }
    db.exec('COMMIT');
    return {
      ok: true,
      tables: summary,
    };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback failure on already-aborted transactions
    }
    throw error;
  } finally {
    db.close();
  }
}

module.exports = {
  getCompatibilityClientKey,
  normalizeSqliteDateTimeIso,
  reconcileSqliteDateColumns,
  ensureSqliteDateTimeSchemaCompatibility,
};
