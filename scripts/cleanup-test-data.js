require('dotenv').config();

const { prisma } = require('../src/prisma');

const TEST_ITEM_PREFIXES = [
  'agent-test-',
  'agent-live-',
];

function startsWithAny(value, prefixes) {
  const text = String(value || '');
  return prefixes.some((prefix) => text.startsWith(prefix));
}

async function collectTargets() {
  const [shopItems, purchases] = await Promise.all([
    prisma.shopItem.findMany(),
    prisma.purchase.findMany(),
  ]);

  const targetItemIds = shopItems
    .map((row) => row.id)
    .filter((id) => startsWithAny(id, TEST_ITEM_PREFIXES));

  const targetPurchaseCodes = purchases
    .filter((row) => startsWithAny(row.itemId, TEST_ITEM_PREFIXES))
    .map((row) => row.code);

  return {
    targetItemIds,
    targetPurchaseCodes,
  };
}

async function main() {
  const write = process.argv.includes('--write');
  const targets = await collectTargets();

  const summary = {
    itemPrefixes: TEST_ITEM_PREFIXES,
    itemCount: targets.targetItemIds.length,
    purchaseCount: targets.targetPurchaseCodes.length,
    itemIds: targets.targetItemIds,
    purchaseCodes: targets.targetPurchaseCodes,
    write,
  };

  if (!write) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (targets.targetPurchaseCodes.length > 0) {
      await tx.deliveryQueueJob.deleteMany({
        where: { purchaseCode: { in: targets.targetPurchaseCodes } },
      });
      await tx.deliveryDeadLetter.deleteMany({
        where: { purchaseCode: { in: targets.targetPurchaseCodes } },
      });
      await tx.deliveryAudit.deleteMany({
        where: { purchaseCode: { in: targets.targetPurchaseCodes } },
      });
      await tx.purchase.deleteMany({
        where: { code: { in: targets.targetPurchaseCodes } },
      });
    }

    if (targets.targetItemIds.length > 0) {
      await tx.shopItem.deleteMany({
        where: { id: { in: targets.targetItemIds } },
      });
    }
  });

  console.log(
    JSON.stringify(
      {
        ...summary,
        cleaned: true,
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
