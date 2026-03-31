'use strict';

require('dotenv').config();

const { getTenantScopedPrismaClient } = require('../src/prisma');
const { setPurchaseStatusByCode } = require('../src/store/memoryStore');
const { getMembership, setMembership } = require('../src/store/vipStore');
const { getVipPlan } = require('../src/services/vipService');

function parseArgs(argv = []) {
  const options = {
    apply: false,
    tenantId: String(process.env.PLATFORM_DEFAULT_TENANT_ID || '').trim() || null,
    pendingOverdueMs: 20 * 60 * 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (!token) continue;
    if (token === '--apply') {
      options.apply = true;
      continue;
    }
    if (token.startsWith('--tenantId=')) {
      options.tenantId = token.slice('--tenantId='.length).trim() || null;
      continue;
    }
    if (token === '--tenantId') {
      options.tenantId = String(argv[index + 1] || '').trim() || null;
      index += 1;
      continue;
    }
    if (token.startsWith('--pendingOverdueMs=')) {
      const value = Number(token.slice('--pendingOverdueMs='.length));
      if (Number.isFinite(value) && value > 0) {
        options.pendingOverdueMs = Math.trunc(value);
      }
      continue;
    }
    if (token === '--pendingOverdueMs') {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        options.pendingOverdueMs = Math.trunc(value);
      }
      index += 1;
    }
  }

  return options;
}

function normalizeShopKind(value) {
  return String(value || 'item').trim().toLowerCase() || 'item';
}

function isVipKind(value) {
  return normalizeShopKind(value) === 'vip';
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildRepairMeta(base = {}) {
  return {
    repairedAt: new Date().toISOString(),
    ...base,
  };
}

function describeCandidate(candidate) {
  return {
    purchaseCode: candidate.purchase.code,
    userId: candidate.purchase.userId,
    itemId: candidate.purchase.itemId,
    itemKind: candidate.itemKind,
    ageMinutes: candidate.ageMinutes,
    createdAt: candidate.createdAt,
    action: candidate.action,
  };
}

async function collectCandidates(tenantId, pendingOverdueMs) {
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const db = getTenantScopedPrismaClient(tenantId);
  const cutoff = new Date(Date.now() - pendingOverdueMs);
  const purchases = await db.purchase.findMany({
    where: {
      status: {
        in: ['pending', 'delivering'],
      },
      createdAt: {
        lte: cutoff,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const candidates = [];
  for (const purchase of purchases) {
    const [queue, deadLetter, item] = await Promise.all([
      db.deliveryQueueJob.findUnique({ where: { purchaseCode: purchase.code } }).catch(() => null),
      db.deliveryDeadLetter.findUnique({ where: { purchaseCode: purchase.code } }).catch(() => null),
      db.shopItem.findUnique({ where: { id: purchase.itemId } }).catch(() => null),
    ]);

    if (queue || deadLetter) {
      continue;
    }

    const itemKind = normalizeShopKind(item?.kind);
    const createdAt = toIso(purchase.createdAt);
    const ageMinutes = Math.max(
      0,
      Math.round((Date.now() - new Date(purchase.createdAt).getTime()) / 60000),
    );
    candidates.push({
      purchase,
      item,
      itemKind,
      createdAt,
      ageMinutes,
      action: isVipKind(itemKind) ? 'deliver-vip' : 'fail-stale-item',
    });
  }

  return candidates;
}

function applyVipMembershipRepair(userId, itemId, tenantId) {
  const vipPlan = getVipPlan(itemId);
  if (!vipPlan) {
    throw new Error(`vip-plan-not-found:${itemId}`);
  }

  const now = new Date();
  const previousMembership = getMembership(userId, { tenantId });
  const membershipBaseAt =
    previousMembership?.expiresAt instanceof Date
    && previousMembership.expiresAt.getTime() > now.getTime()
      ? previousMembership.expiresAt
      : now;
  const expiresAt = new Date(
    membershipBaseAt.getTime() + Number(vipPlan.durationDays || 0) * 24 * 60 * 60 * 1000,
  );
  const membership = setMembership(userId, vipPlan.id, expiresAt, { tenantId });
  if (!membership) {
    throw new Error(`vip-membership-write-failed:${userId}:${itemId}`);
  }
  return {
    membership,
    vipPlan,
  };
}

async function reconcileCandidate(candidate, options = {}) {
  const tenantId = options.tenantId;
  const apply = options.apply === true;
  const summary = describeCandidate(candidate);
  if (!apply) {
    return {
      ...summary,
      ok: true,
      applied: false,
    };
  }

  if (candidate.action === 'deliver-vip') {
    const repaired = applyVipMembershipRepair(
      candidate.purchase.userId,
      candidate.purchase.itemId,
      tenantId,
    );
    const purchase = await setPurchaseStatusByCode(candidate.purchase.code, 'delivered', {
      tenantId,
      actor: 'system-reconcile',
      reason: 'vip-reconciled-stale-pending',
      meta: buildRepairMeta({
        repairType: 'vip-stale-pending',
        pendingOverdueMs: options.pendingOverdueMs,
        originalStatus: candidate.purchase.status,
        vipPlanId: repaired.vipPlan.id,
        vipDurationDays: Number(repaired.vipPlan.durationDays || 0),
      }),
    });
    return {
      ...summary,
      ok: true,
      applied: true,
      purchaseStatus: purchase?.status || 'delivered',
      membershipPlanId: repaired.vipPlan.id,
      membershipExpiresAt: toIso(repaired.membership?.expiresAt),
    };
  }

  const purchase = await setPurchaseStatusByCode(candidate.purchase.code, 'delivery_failed', {
    tenantId,
    actor: 'system-reconcile',
    reason: 'delivery-reconcile-stale-runtime-state',
    meta: buildRepairMeta({
      repairType: 'item-stale-pending',
      pendingOverdueMs: options.pendingOverdueMs,
      originalStatus: candidate.purchase.status,
      failureClass: 'stuck-without-runtime-state',
    }),
  });
  return {
    ...summary,
    ok: true,
    applied: true,
    purchaseStatus: purchase?.status || 'delivery_failed',
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.tenantId) {
    throw new Error('No tenantId provided and PLATFORM_DEFAULT_TENANT_ID is empty');
  }

  const candidates = await collectCandidates(options.tenantId, options.pendingOverdueMs);
  const results = [];
  for (const candidate of candidates) {
    results.push(await reconcileCandidate(candidate, options));
  }

  const summary = {
    tenantId: options.tenantId,
    apply: options.apply,
    pendingOverdueMs: options.pendingOverdueMs,
    totalCandidates: results.length,
    deliveredVip: results.filter((row) => row.applied && row.action === 'deliver-vip').length,
    failedItems: results.filter((row) => row.applied && row.action === 'fail-stale-item').length,
    previewOnly: results.filter((row) => !row.applied).length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[reconcile-stale-purchases] failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  collectCandidates,
  reconcileCandidate,
  parseArgs,
};
