'use strict';

require('dotenv').config();

const { runWithDeliveryPersistenceScope } = require('../src/services/deliveryPersistenceDb');

function parseArgs(argv = []) {
  const options = {
    apply: false,
    tenantId: String(process.env.PLATFORM_DEFAULT_TENANT_ID || '').trim() || null,
    archiveAgeMs: 60 * 60 * 1000,
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
    if (token.startsWith('--archiveAgeMs=')) {
      const value = Number(token.slice('--archiveAgeMs='.length));
      if (Number.isFinite(value) && value > 0) {
        options.archiveAgeMs = Math.trunc(value);
      }
      continue;
    }
    if (token === '--archiveAgeMs') {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        options.archiveAgeMs = Math.trunc(value);
      }
      index += 1;
    }
  }

  return options;
}

function trimText(value) {
  return String(value || '').trim();
}

function parseMetaJson(value) {
  const raw = trimText(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function inferErrorCode(deadLetter) {
  const meta = parseMetaJson(deadLetter?.metaJson);
  const direct = trimText(meta?.errorCode);
  if (direct) return direct;
  const reason = trimText(deadLetter?.reason);
  const match = reason.match(/^\[([A-Z0-9_:-]+)\]/);
  return match ? trimText(match[1]) : '';
}

function minutesSince(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function normalizeFixtureText(value) {
  return String(value || '').trim().toLowerCase();
}

function looksLikeFixtureIdentifier(value) {
  const normalized = normalizeFixtureText(value).replace(/[_\s]+/g, '-');
  if (!normalized) return false;
  return /(?:^|[-.])(test|fixture)(?:[-.]|$)/.test(normalized);
}

function looksLikeFixtureLabel(value) {
  const text = normalizeFixtureText(value);
  if (!text) return false;
  return /(?:\((test|fixture)\)|\[(test|fixture)\]|(?:^|[\s-])(test|fixture)(?:$|[\s-]))/.test(text);
}

function looksLikeFixtureDescription(value) {
  const text = normalizeFixtureText(value);
  if (!text) return false;
  return /\b(test item|fixture item|integration test|for delivery test)\b/.test(text);
}

function isFixtureItem(item = {}) {
  return (
    looksLikeFixtureIdentifier(item.id)
    || looksLikeFixtureLabel(item.name)
    || looksLikeFixtureDescription(item.description)
  );
}

function describeCandidate(candidate) {
  return {
    purchaseCode: candidate.purchaseCode,
    userId: candidate.userId,
    itemId: candidate.itemId,
    errorCode: candidate.errorCode,
    purchaseStatus: candidate.purchaseStatus,
    ageMinutes: candidate.ageMinutes,
    resolution: candidate.resolution,
  };
}

async function collectCandidates(options = {}) {
  const tenantId = trimText(options.tenantId);
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  return runWithDeliveryPersistenceScope(tenantId, async (db) => {
    const deadLetters = await db.deliveryDeadLetter.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const candidates = [];
    for (const deadLetter of deadLetters) {
      const [purchase, queue, link, item] = await Promise.all([
        db.purchase.findFirst({ where: { code: deadLetter.purchaseCode } }).catch(() => null),
        db.deliveryQueueJob.findUnique({ where: { purchaseCode: deadLetter.purchaseCode } }).catch(() => null),
        db.link.findFirst({ where: { userId: deadLetter.userId || '' } }).catch(() => null),
        db.shopItem.findUnique({ where: { id: deadLetter.itemId || '' } }).catch(() => null),
      ]);

      if (!purchase || queue || trimText(purchase.status) !== 'delivery_failed') {
        continue;
      }

      const errorCode = inferErrorCode(deadLetter);
      const ageMinutes = minutesSince(deadLetter.updatedAt || deadLetter.createdAt);
      const ageMs = ageMinutes * 60 * 1000;
      let resolution = null;

      if (errorCode === 'DELIVERY_STEAM_LINK_MISSING') {
        if (trimText(link?.steamId)) {
          resolution = 'steam-link-now-exists';
        } else if (ageMs >= Number(options.archiveAgeMs || 0)) {
          resolution = 'stale-missing-steam-link';
        }
      }

      if (
        !resolution
        && ageMs >= Number(options.archiveAgeMs || 0)
        && isFixtureItem({
          id: deadLetter.itemId || purchase.itemId || item?.id,
          name: deadLetter.itemName || item?.name,
          description: item?.description,
        })
      ) {
        resolution = errorCode === 'DELIVERY_NATIVE_PROOF_PLAYER_NOT_FOUND'
          ? 'fixture-player-not-found'
          : 'fixture-delivery-failed';
      }

      if (!resolution) {
        continue;
      }

      candidates.push({
        purchaseCode: deadLetter.purchaseCode,
        userId: deadLetter.userId || null,
        itemId: deadLetter.itemId || purchase.itemId || null,
        errorCode,
        purchaseStatus: purchase.status,
        ageMinutes,
        resolution,
      });
    }

    return candidates;
  });
}

async function applyCandidates(options = {}) {
  const tenantId = trimText(options.tenantId);
  const apply = options.apply === true;
  const candidates = await collectCandidates(options);
  if (!apply) {
    return candidates.map((candidate) => ({
      ...describeCandidate(candidate),
      applied: false,
    }));
  }

  return runWithDeliveryPersistenceScope(tenantId, async (db) => {
    const results = [];
    for (const candidate of candidates) {
      await db.deliveryDeadLetter.deleteMany({
        where: {
          purchaseCode: candidate.purchaseCode,
        },
      });
      results.push({
        ...describeCandidate(candidate),
        applied: true,
      });
    }
    return results;
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.tenantId) {
    throw new Error('No tenantId provided and PLATFORM_DEFAULT_TENANT_ID is empty');
  }

  const results = await applyCandidates(options);
  const summary = {
    tenantId: options.tenantId,
    apply: options.apply,
    archiveAgeMs: options.archiveAgeMs,
    totalCandidates: results.length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[cleanup-dead-letters] failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  collectCandidates,
  applyCandidates,
  inferErrorCode,
  isFixtureItem,
  parseArgs,
};
