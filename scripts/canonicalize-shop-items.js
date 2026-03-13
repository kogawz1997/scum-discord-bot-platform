require('dotenv').config();

const { prisma } = require('../src/prisma');
const {
  resolveCanonicalItemId,
  resolveItemIconUrl,
} = require('../src/services/itemIconService');

function normalizeQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

function normalizeDeliveryItems(rawValue, fallback = {}) {
  const source = [];
  if (Array.isArray(rawValue)) {
    source.push(...rawValue);
  } else if (typeof rawValue === 'string' && rawValue.trim()) {
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        source.push(...parsed);
      }
    } catch {
      // ignore broken JSON and rely on fallback
    }
  } else if (rawValue && typeof rawValue === 'object') {
    source.push(rawValue);
  }

  if (source.length === 0 && fallback.gameItemId) {
    source.push({
      gameItemId: fallback.gameItemId,
      quantity: fallback.quantity,
      iconUrl: fallback.iconUrl,
    });
  }

  const out = [];
  const seen = new Map();
  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const requestedId = String(entry.gameItemId || entry.id || '').trim();
    if (!requestedId) continue;
    const gameItemId =
      resolveCanonicalItemId({
        gameItemId: requestedId,
        id: requestedId,
        name: entry.name,
      }) || requestedId;
    const quantity = normalizeQuantity(entry.quantity);
    const iconUrl =
      String(entry.iconUrl || '').trim()
      || resolveItemIconUrl({ gameItemId, id: gameItemId, name: entry.name })
      || null;
    const key = gameItemId.toLowerCase();
    if (!seen.has(key)) {
      const normalized = { gameItemId, quantity, iconUrl };
      seen.set(key, normalized);
      out.push(normalized);
      continue;
    }
    const existing = seen.get(key);
    existing.quantity += quantity;
    if (!existing.iconUrl && iconUrl) {
      existing.iconUrl = iconUrl;
    }
  }
  return out;
}

async function main() {
  const write = process.argv.includes('--write');
  const rows = await prisma.shopItem.findMany({
    where: { kind: 'item' },
    orderBy: { id: 'asc' },
  });

  const changes = [];

  for (const row of rows) {
    const deliveryItems = normalizeDeliveryItems(row.deliveryItemsJson, {
      gameItemId: row.gameItemId,
      quantity: row.quantity,
      iconUrl: row.iconUrl,
    });
    if (deliveryItems.length === 0) continue;

    const primary = deliveryItems[0];
    const next = {
      gameItemId: primary.gameItemId,
      quantity: primary.quantity,
      iconUrl: primary.iconUrl || row.iconUrl || null,
      deliveryItemsJson: JSON.stringify(deliveryItems),
    };

    const currentDeliveryJson = String(row.deliveryItemsJson || '').trim();
    const changed =
      String(row.gameItemId || '') !== String(next.gameItemId || '')
      || Number(row.quantity || 1) !== Number(next.quantity || 1)
      || String(row.iconUrl || '') !== String(next.iconUrl || '')
      || currentDeliveryJson !== next.deliveryItemsJson;

    if (!changed) continue;

    changes.push({
      id: row.id,
      name: row.name,
      before: {
        gameItemId: row.gameItemId,
        quantity: row.quantity,
        iconUrl: row.iconUrl,
        deliveryItemsJson: row.deliveryItemsJson,
      },
      after: next,
    });
  }

  if (write) {
    for (const change of changes) {
      await prisma.shopItem.update({
        where: { id: change.id },
        data: change.after,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        write,
        changedCount: changes.length,
        changes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
