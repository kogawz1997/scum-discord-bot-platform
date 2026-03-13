'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/prisma');
const {
  repairMojibakeText,
  repairJsonText,
} = require('../src/utils/textRepair');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');

function lowerFirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function resolveSqliteFile() {
  const raw = String(process.env.DATABASE_URL || '').trim();
  if (!raw.startsWith('file:')) return null;
  const filePath = raw.slice('file:'.length).replace(/^"|"$/g, '');
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
}

function ensureBackup(dbFile) {
  if (!dbFile || !fs.existsSync(dbFile)) return null;
  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    backupDir,
    `text-repair-${stamp}${path.extname(dbFile) || '.db'}`,
  );
  fs.copyFileSync(dbFile, backupPath);
  return backupPath;
}

function buildWhereFromRow(model, row) {
  const idFields = model.primaryKey?.fields?.length
    ? model.primaryKey.fields
    : model.fields.filter((field) => field.isId).map((field) => field.name);

  if (idFields.length === 0) {
    return null;
  }

  const where = {};
  for (const field of idFields) {
    where[field] = row[field];
  }
  return where;
}

function repairFieldValue(fieldName, value) {
  if (value == null || typeof value !== 'string') {
    return { changed: false, value };
  }

  if (fieldName.endsWith('Json')) {
    return repairJsonText(value);
  }

  return repairMojibakeText(value);
}

async function main() {
  const dmmfModels = Prisma.dmmf.datamodel.models;
  const summaries = [];
  let changedRows = 0;
  let changedFields = 0;
  let backupPath = null;

  if (writeMode) {
    backupPath = ensureBackup(resolveSqliteFile());
  }

  try {
    for (const model of dmmfModels) {
      const delegateName = lowerFirst(model.name);
      const delegate = prisma[delegateName];
      if (!delegate || typeof delegate.findMany !== 'function') continue;

      const stringFields = model.fields.filter(
        (field) => field.kind === 'scalar' && field.type === 'String',
      );
      if (stringFields.length === 0) continue;

      const rows = await delegate.findMany();
      let modelRowChanges = 0;
      let modelFieldChanges = 0;

      for (const row of rows) {
        const updates = {};

        for (const field of stringFields) {
          const currentValue = row[field.name];
          const repaired = repairFieldValue(field.name, currentValue);
          if (repaired.changed && repaired.value !== currentValue) {
            updates[field.name] = repaired.value;
            modelFieldChanges += 1;
          }
        }

        if (Object.keys(updates).length === 0) continue;

        modelRowChanges += 1;
        if (writeMode) {
          const where = buildWhereFromRow(model, row);
          if (!where) continue;
          await delegate.updateMany({
            where,
            data: updates,
          });
        }
      }

      if (modelRowChanges > 0) {
        summaries.push({
          model: model.name,
          rows: modelRowChanges,
          fields: modelFieldChanges,
        });
        changedRows += modelRowChanges;
        changedFields += modelFieldChanges;
      }
    }

    console.log(
      `[text-repair] mode=${writeMode ? 'write' : 'scan'} rows=${changedRows} fields=${changedFields}`,
    );
    if (backupPath) {
      console.log(`[text-repair] backup=${backupPath}`);
    }
    for (const summary of summaries) {
      console.log(
        `[text-repair] ${summary.model}: rows=${summary.rows} fields=${summary.fields}`,
      );
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[text-repair] failed:', error.message);
  process.exit(1);
});
