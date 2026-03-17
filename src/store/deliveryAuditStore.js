const crypto = require('node:crypto');
const { prisma } = require('../prisma');
const {
  normalizeTenantId,
  runWithDeliveryPersistenceScope,
  readAcrossDeliveryPersistenceScopes,
  groupRowsByTenant,
} = require('../services/deliveryPersistenceDb');

const MAX_AUDIT_ITEMS = 3000;
const audits = [];

let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;
let isHydrating = false;

function normalizeAudit(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
  const generatedId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const id = String(entry.id || `audit-${generatedId}`);
  return {
    id,
    createdAt,
    tenantId: entry.tenantId ? String(entry.tenantId) : null,
    level: String(entry.level || 'info'),
    action: String(entry.action || 'event'),
    purchaseCode: entry.purchaseCode ? String(entry.purchaseCode) : null,
    itemId: entry.itemId ? String(entry.itemId) : null,
    userId: entry.userId ? String(entry.userId) : null,
    steamId: entry.steamId ? String(entry.steamId) : null,
    attempt: entry.attempt == null ? null : Number(entry.attempt),
    message: entry.message ? String(entry.message) : '',
    meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : null,
  };
}

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      if (initPromise && !isHydrating) {
        await initPromise;
      }
      await work();
    })
    .catch((error) => {
      console.error(`[deliveryAuditStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

function buildAuditWhere(options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  return tenantId ? { tenantId } : {};
}

async function trimOldAuditRows(options = {}) {
  const where = buildAuditWhere(options);
  const total = await runWithDeliveryPersistenceScope(options.tenantId, (db) =>
    db.deliveryAudit.count({ where }));
  if (total <= MAX_AUDIT_ITEMS) return;
  const overflow = total - MAX_AUDIT_ITEMS;
  const rows = await runWithDeliveryPersistenceScope(options.tenantId, (db) =>
    db.deliveryAudit.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: overflow,
    }));
  if (rows.length === 0) return;
  await runWithDeliveryPersistenceScope(options.tenantId, (db) =>
    db.deliveryAudit.deleteMany({
      where: {
        ...where,
        id: {
          in: rows.map((row) => row.id),
        },
      },
    }));
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  isHydrating = true;
  try {
    const rows = (await readAcrossDeliveryPersistenceScopes((db, scope) =>
      db.deliveryAudit.findMany({
        where: scope.whereTenant,
        orderBy: { createdAt: 'asc' },
        take: MAX_AUDIT_ITEMS,
      })))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-MAX_AUDIT_ITEMS);
    if (rows.length === 0) {
      if (audits.length > 0) {
        const groups = groupRowsByTenant(audits);
        await queueDbWrite(
          async () => {
            for (const [tenantId, tenantEntries] of groups.entries()) {
              await runWithDeliveryPersistenceScope(tenantId, async (db) => {
                for (const entry of tenantEntries) {
                  await db.deliveryAudit.upsert({
                    where: { id: entry.id },
                    update: {
                      createdAt: entry.createdAt,
                      tenantId: entry.tenantId,
                      level: entry.level,
                      action: entry.action,
                      purchaseCode: entry.purchaseCode,
                      itemId: entry.itemId,
                      userId: entry.userId,
                      steamId: entry.steamId,
                      attempt: entry.attempt,
                      message: entry.message,
                      metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
                    },
                    create: {
                      id: entry.id,
                      createdAt: entry.createdAt,
                      tenantId: entry.tenantId,
                      level: entry.level,
                      action: entry.action,
                      purchaseCode: entry.purchaseCode,
                      itemId: entry.itemId,
                      userId: entry.userId,
                      steamId: entry.steamId,
                      attempt: entry.attempt,
                      message: entry.message,
                      metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
                    },
                  });
                }
              });
              await trimOldAuditRows({ tenantId });
            }
          },
          'backfill',
        );
      }
      return;
    }

    const hydrated = [];
    for (const row of rows) {
      const parsed = normalizeAudit({
        id: row.id,
        createdAt: row.createdAt,
        tenantId: row.tenantId,
        level: row.level,
        action: row.action,
        purchaseCode: row.purchaseCode,
        itemId: row.itemId,
        userId: row.userId,
        steamId: row.steamId,
        attempt: row.attempt,
        message: row.message,
        meta: row.metaJson ? JSON.parse(row.metaJson) : null,
      });
      if (!parsed) continue;
      hydrated.push(parsed);
    }

    if (startVersion === mutationVersion) {
      audits.length = 0;
      for (const entry of hydrated) {
        audits.push(entry);
      }
      if (audits.length > MAX_AUDIT_ITEMS) {
        audits.splice(0, audits.length - MAX_AUDIT_ITEMS);
      }
      return;
    }

    const existingIds = new Set(audits.map((entry) => entry.id));
    for (const entry of hydrated) {
      if (!existingIds.has(entry.id)) {
        audits.push(entry);
      }
    }
    audits.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (audits.length > MAX_AUDIT_ITEMS) {
      audits.splice(0, audits.length - MAX_AUDIT_ITEMS);
    }
  } catch (error) {
    console.error('[deliveryAuditStore] failed to hydrate from prisma:', error.message);
  } finally {
    isHydrating = false;
  }
}

function initDeliveryAuditStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

function flushDeliveryAuditStoreWrites() {
  return dbWriteQueue;
}

function addDeliveryAudit(entry) {
  const normalized = normalizeAudit(entry);
  if (!normalized) return null;
  audits.push(normalized);
  if (audits.length > MAX_AUDIT_ITEMS) {
    audits.splice(0, audits.length - MAX_AUDIT_ITEMS);
  }
  mutationVersion += 1;

  queueDbWrite(
    async () => {
      await runWithDeliveryPersistenceScope(normalized.tenantId, (db) =>
        db.deliveryAudit.upsert({
          where: { id: normalized.id },
          update: {
            createdAt: normalized.createdAt,
            tenantId: normalized.tenantId,
            level: normalized.level,
            action: normalized.action,
            purchaseCode: normalized.purchaseCode,
            itemId: normalized.itemId,
            userId: normalized.userId,
            steamId: normalized.steamId,
            attempt: normalized.attempt,
            message: normalized.message,
            metaJson: normalized.meta ? JSON.stringify(normalized.meta) : null,
          },
          create: {
            id: normalized.id,
            createdAt: normalized.createdAt,
            tenantId: normalized.tenantId,
            level: normalized.level,
            action: normalized.action,
            purchaseCode: normalized.purchaseCode,
            itemId: normalized.itemId,
            userId: normalized.userId,
            steamId: normalized.steamId,
            attempt: normalized.attempt,
            message: normalized.message,
            metaJson: normalized.meta ? JSON.stringify(normalized.meta) : null,
          },
        }));
      await trimOldAuditRows({ tenantId: normalized.tenantId });
    },
    'add-delivery-audit',
  );
  return normalized;
}

function listDeliveryAudit(limit = 500, options = {}) {
  const max = Math.max(1, Number(limit || 500));
  const tenantId = normalizeTenantId(options.tenantId);
  return audits
    .slice()
    .filter((entry) => !tenantId || entry.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, max)
    .map((a) => ({ ...a }));
}

function clearDeliveryAudit(options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  if (!tenantId) {
    audits.length = 0;
  } else {
    for (let i = audits.length - 1; i >= 0; i -= 1) {
      if (audits[i]?.tenantId === tenantId) {
        audits.splice(i, 1);
      }
    }
  }
  mutationVersion += 1;
  queueDbWrite(
    async () => {
      await runWithDeliveryPersistenceScope(tenantId, (db) =>
        db.deliveryAudit.deleteMany({ where: buildAuditWhere({ tenantId }) }));
    },
    'clear-delivery-audit',
  );
}

function replaceDeliveryAudit(nextAudits = [], options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  if (!tenantId) {
    audits.length = 0;
  } else {
    for (let i = audits.length - 1; i >= 0; i -= 1) {
      if (audits[i]?.tenantId === tenantId) {
        audits.splice(i, 1);
      }
    }
  }
  mutationVersion += 1;
  for (const row of Array.isArray(nextAudits) ? nextAudits : []) {
    const normalized = normalizeAudit(row);
    if (!normalized) continue;
    if (tenantId && normalized.tenantId !== tenantId) continue;
    audits.push(normalized);
  }
  if (audits.length > MAX_AUDIT_ITEMS) {
    audits.splice(0, audits.length - MAX_AUDIT_ITEMS);
  }

  queueDbWrite(
    async () => {
      if (tenantId) {
        await runWithDeliveryPersistenceScope(tenantId, async (db) => {
          await db.deliveryAudit.deleteMany({ where: { tenantId } });
          for (const entry of audits.filter((row) => row.tenantId === tenantId)) {
            await db.deliveryAudit.create({
              data: {
                id: entry.id,
                createdAt: entry.createdAt,
                tenantId: entry.tenantId,
                level: entry.level,
                action: entry.action,
                purchaseCode: entry.purchaseCode,
                itemId: entry.itemId,
                userId: entry.userId,
                steamId: entry.steamId,
                attempt: entry.attempt,
                message: entry.message,
                metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
              },
            });
          }
        });
        return;
      }

      const groups = groupRowsByTenant(audits);
      const sharedRows = groups.get(null) || [];
      await prisma.deliveryAudit.deleteMany({});
      for (const entry of sharedRows) {
        await prisma.deliveryAudit.create({
          data: {
            id: entry.id,
            createdAt: entry.createdAt,
            tenantId: entry.tenantId,
            level: entry.level,
            action: entry.action,
            purchaseCode: entry.purchaseCode,
            itemId: entry.itemId,
            userId: entry.userId,
            steamId: entry.steamId,
            attempt: entry.attempt,
            message: entry.message,
            metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
          },
        });
      }
      for (const [scopedTenantId, tenantRows] of groups.entries()) {
        if (!scopedTenantId) continue;
        await runWithDeliveryPersistenceScope(scopedTenantId, async (db) => {
          await db.deliveryAudit.deleteMany({ where: { tenantId: scopedTenantId } });
          for (const entry of tenantRows) {
            await db.deliveryAudit.create({
              data: {
                id: entry.id,
                createdAt: entry.createdAt,
                tenantId: entry.tenantId,
                level: entry.level,
                action: entry.action,
                purchaseCode: entry.purchaseCode,
                itemId: entry.itemId,
                userId: entry.userId,
                steamId: entry.steamId,
                attempt: entry.attempt,
                message: entry.message,
                metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
              },
            });
          }
        });
      }
    },
    'replace-delivery-audit',
  );
  return audits.length;
}

initDeliveryAuditStore();

module.exports = {
  addDeliveryAudit,
  listDeliveryAudit,
  clearDeliveryAudit,
  replaceDeliveryAudit,
  initDeliveryAuditStore,
  flushDeliveryAuditStoreWrites,
};
