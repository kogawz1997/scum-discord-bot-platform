const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/prisma');
const {
  buildServerScopedUserKey,
} = require('../src/store/tenantStoreScope');
const {
  setCoins,
  getWallet,
  listWalletLedger,
  listShopItems,
  createPurchase,
  listUserPurchases,
  listPurchaseStatusHistory,
} = require('../src/store/memoryStore');
const {
  addCartItem,
  listCartItems,
  flushCartStoreWrites,
} = require('../src/store/cartStore');
const {
  addKill,
  getStats,
  flushStatsStoreWrites,
} = require('../src/store/statsStore');
const {
  recordWheelSpin,
  getUserWheelState,
  listLuckyWheelStates,
} = require('../src/store/luckyWheelStore');

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

test('player-facing stores keep wallet/cart/stats/wheel isolated per server within the same tenant', async (t) => {
  const userId = uniqueId('server-scope-user');
  const serverA = uniqueId('server-a');
  const serverB = uniqueId('server-b');
  const scopedUserA = buildServerScopedUserKey(userId, { serverId: serverA });
  const scopedUserB = buildServerScopedUserKey(userId, { serverId: serverB });
  const purchaseCodes = [];

  t.after(async () => {
    if (purchaseCodes.length > 0) {
      await prisma.purchaseStatusHistory.deleteMany({
        where: { purchaseCode: { in: purchaseCodes } },
      }).catch(() => null);
      await prisma.purchase.deleteMany({
        where: { code: { in: purchaseCodes } },
      }).catch(() => null);
    }
    await prisma.walletLedger.deleteMany({
      where: { userId: { in: [scopedUserA, scopedUserB] } },
    }).catch(() => null);
    await prisma.userWallet.deleteMany({
      where: { userId: { in: [scopedUserA, scopedUserB] } },
    }).catch(() => null);
    await prisma.cartEntry.deleteMany({
      where: { userId: { in: [scopedUserA, scopedUserB] } },
    }).catch(() => null);
    await prisma.stats.deleteMany({
      where: { userId: { in: [scopedUserA, scopedUserB] } },
    }).catch(() => null);
    await prisma.luckyWheelState.deleteMany({
      where: { userId: { in: [scopedUserA, scopedUserB] } },
    }).catch(() => null);
  });

  await setCoins(userId, 120, { serverId: serverA, reason: 'test-init-a', actor: 'test-suite' });
  await setCoins(userId, 45, { serverId: serverB, reason: 'test-init-b', actor: 'test-suite' });

  const walletA = await getWallet(userId, { serverId: serverA });
  const walletB = await getWallet(userId, { serverId: serverB });
  assert.equal(walletA.balance, 120);
  assert.equal(walletB.balance, 45);
  assert.equal(walletA.userId, userId);
  assert.equal(walletB.userId, userId);
  assert.equal(walletA.serverId, serverA);
  assert.equal(walletB.serverId, serverB);

  const ledgerA = await listWalletLedger(userId, 10, { serverId: serverA });
  const ledgerB = await listWalletLedger(userId, 10, { serverId: serverB });
  assert.equal(ledgerA.length, 1);
  assert.equal(ledgerB.length, 1);
  assert.equal(ledgerA[0].serverId, serverA);
  assert.equal(ledgerB[0].serverId, serverB);

  addCartItem(userId, 'vip-7d', 1, { serverId: serverA });
  addCartItem(userId, 'loot-box', 2, { serverId: serverB });
  await flushCartStoreWrites({ serverId: serverA });
  await flushCartStoreWrites({ serverId: serverB });

  assert.deepEqual(listCartItems(userId, { serverId: serverA }), [{ itemId: 'vip-7d', quantity: 1 }]);
  assert.deepEqual(listCartItems(userId, { serverId: serverB }), [{ itemId: 'loot-box', quantity: 2 }]);

  addKill(userId, 3, { serverId: serverA });
  addKill(userId, 1, { serverId: serverB });
  await flushStatsStoreWrites({ serverId: serverA });
  await flushStatsStoreWrites({ serverId: serverB });

  assert.equal(getStats(userId, { serverId: serverA }).kills, 3);
  assert.equal(getStats(userId, { serverId: serverB }).kills, 1);

  const spinA = await recordWheelSpin(
    userId,
    { id: 'coins-a', label: 'Coins A', type: 'coins', amount: 100, at: new Date().toISOString() },
    { serverId: serverA },
  );
  const spinB = await recordWheelSpin(
    userId,
    { id: 'coins-b', label: 'Coins B', type: 'coins', amount: 50, at: new Date().toISOString() },
    { serverId: serverB },
  );

  assert.equal(spinA.ok, true);
  assert.equal(spinB.ok, true);

  const wheelA = await getUserWheelState(userId, 10, { serverId: serverA });
  const wheelB = await getUserWheelState(userId, 10, { serverId: serverB });
  assert.equal(wheelA.totalSpins, 1);
  assert.equal(wheelB.totalSpins, 1);
  assert.equal(wheelA.serverId, serverA);
  assert.equal(wheelB.serverId, serverB);

  const listedA = await listLuckyWheelStates(50, { serverId: serverA });
  const listedB = await listLuckyWheelStates(50, { serverId: serverB });
  assert.equal(listedA.some((row) => row.userId === userId && row.serverId === serverA), true);
  assert.equal(listedB.some((row) => row.userId === userId && row.serverId === serverB), true);

  const [item] = await listShopItems();
  assert.ok(item?.id);

  const purchaseA = await createPurchase(userId, item, { serverId: serverA });
  const purchaseB = await createPurchase(userId, item, { serverId: serverB });
  purchaseCodes.push(purchaseA.code, purchaseB.code);

  const purchasesA = await listUserPurchases(userId, { serverId: serverA });
  const purchasesB = await listUserPurchases(userId, { serverId: serverB });
  assert.equal(purchasesA.some((row) => row.code === purchaseA.code), true);
  assert.equal(purchasesA.some((row) => row.code === purchaseB.code), false);
  assert.equal(purchasesB.some((row) => row.code === purchaseB.code), true);
  assert.equal(purchasesB.some((row) => row.code === purchaseA.code), false);

  const purchaseAHistory = await listPurchaseStatusHistory(purchaseA.code, 10, { serverId: serverA });
  const purchaseBHistory = await listPurchaseStatusHistory(purchaseA.code, 10, { serverId: serverB });
  assert.equal(purchaseAHistory.length > 0, true);
  assert.equal(purchaseBHistory.length, 0);
});
