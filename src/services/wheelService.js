const { getWallet } = require('../store/memoryStore');
const { getLinkByUserId } = require('../store/linkStore');
const {
  recordWheelSpin,
  rollbackWheelSpin,
} = require('../store/luckyWheelStore');
const { creditCoins } = require('./coinService');
const { createQueuedPurchase } = require('./shopService');
const { resolveItemIconUrl } = require('./itemIconService');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAmount(value, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.trunc(amount));
}

function normalizeQuantity(value, fallback = 1) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return fallback;
  return Math.max(1, Math.trunc(quantity));
}

function normalizeReward(raw = {}) {
  const id = normalizeText(raw.id) || 'reward';
  const label = normalizeText(raw.label || raw.name) || id;
  const rawType = normalizeText(raw.type || 'coins').toLowerCase();
  const type = rawType === 'item' ? 'item' : rawType === 'none' ? 'none' : 'coins';
  const amount = normalizeAmount(raw.amount, 0);
  const quantity = normalizeQuantity(raw.quantity, 1);
  const itemId = normalizeText(raw.itemId || raw.gameItemId || raw.id) || null;
  const gameItemId = normalizeText(raw.gameItemId || raw.itemId || raw.id) || null;
  const iconUrl = normalizeText(raw.iconUrl)
    || resolveItemIconUrl({
      id: itemId || gameItemId || id,
      gameItemId,
      name: label,
    })
    || null;
  return {
    id,
    label,
    type,
    amount: type === 'coins' ? amount : 0,
    quantity: type === 'item' ? quantity : 0,
    itemId: type === 'item' ? itemId : null,
    gameItemId: type === 'item' ? gameItemId : null,
    iconUrl,
  };
}

function buildWheelRewardMessage(result) {
  const reward = result?.reward || {};
  const label = normalizeText(reward.label) || 'รางวัลพิเศษ';
  if (reward.type === 'coins' && reward.amount > 0) {
    return `หมุนวงล้อสำเร็จ! ได้รับ ${label} (+${Number(reward.amount).toLocaleString()} Coins)`;
  }
  if (reward.type === 'item') {
    if (reward.deliveryQueued) {
      return `หมุนวงล้อสำเร็จ! ได้รับ ${label} x${reward.quantity} (ออเดอร์ ${reward.purchaseCode || '-'})`;
    }
    return `หมุนวงล้อสำเร็จ! ได้รับ ${label} x${reward.quantity} (ออเดอร์ ${reward.purchaseCode || '-'} | รอคิวส่งของ)`;
  }
  return `หมุนวงล้อสำเร็จ! ผลลัพธ์: ${label}`;
}

async function awardWheelRewardForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const actor = normalizeText(params.actor) || 'system';
  const source = normalizeText(params.source) || 'wheel-service';
  const reward = normalizeReward(params.reward);
  const rewardAt = params.now instanceof Date
    ? params.now.toISOString()
    : normalizeText(params.at) || new Date().toISOString();

  const recordWheelSpinFn = params.recordWheelSpinFn || recordWheelSpin;
  const rollbackWheelSpinFn = params.rollbackWheelSpinFn || rollbackWheelSpin;
  const creditCoinsFn = params.creditCoinsFn || creditCoins;
  const createQueuedPurchaseFn = params.createQueuedPurchaseFn || createQueuedPurchase;
  const getWalletFn = params.getWalletFn || getWallet;
  const resolveSteamLinkFn = params.resolveSteamLinkFn || getLinkByUserId;

  if (!userId || !reward?.id || !reward?.label) {
    return { ok: false, reason: 'invalid-input' };
  }

  if (reward.type === 'item') {
    if (!reward.itemId || !reward.gameItemId) {
      return { ok: false, reason: 'wheel-item-reward-invalid' };
    }
    const link = await resolveSteamLinkFn(userId);
    if (!link?.steamId) {
      return { ok: false, reason: 'steam-link-required-for-item-wheel' };
    }
  }

  const rewardEntry = {
    id: reward.id,
    label: reward.label,
    type: reward.type,
    amount: reward.amount,
    quantity: reward.type === 'item' ? reward.quantity : 0,
    itemId: reward.type === 'item' ? reward.itemId : null,
    gameItemId: reward.type === 'item' ? reward.gameItemId : null,
    iconUrl: reward.iconUrl,
    at: rewardAt,
  };

  const recorded = await recordWheelSpinFn(userId, rewardEntry);
  if (!recorded?.ok) {
    return {
      ok: false,
      reason: recorded?.reason || 'wheel-record-failed',
    };
  }

  let walletBalance = normalizeAmount((await getWalletFn(userId))?.balance, 0);
  let awardedCoins = 0;
  let purchaseCode = null;
  let deliveryQueued = false;
  let deliveryQueueReason = null;

  try {
    if (reward.type === 'coins' && reward.amount > 0) {
      const credit = await creditCoinsFn({
        userId,
        amount: reward.amount,
        reason: params.creditReason || 'wheel_spin_reward',
        actor,
        reference: `wheel:${reward.id}`,
        meta: {
          source,
          rewardId: reward.id,
          rewardLabel: reward.label,
          rewardType: reward.type,
          rewardAmount: reward.amount,
        },
      });
      if (!credit.ok) {
        throw new Error(credit.reason || 'wheel-credit-failed');
      }
      walletBalance = normalizeAmount(credit.balance, 0);
      awardedCoins = reward.amount;
    }

    if (reward.type === 'item') {
      const queueResult = await createQueuedPurchaseFn({
        userId,
        item: {
          id: reward.itemId,
          name: reward.label,
          price: 0,
          kind: 'item',
          gameItemId: reward.gameItemId,
          quantity: reward.quantity,
          iconUrl: reward.iconUrl,
          deliveryItems: [
            {
              gameItemId: reward.gameItemId,
              quantity: reward.quantity,
              iconUrl: reward.iconUrl,
            },
          ],
        },
        guildId: params.guildId || null,
        deliveryOptions: {
          source,
          itemName: reward.label,
          iconUrl: reward.iconUrl,
          itemKind: 'item',
          gameItemId: reward.gameItemId,
          quantity: reward.quantity,
          deliveryItems: [
            {
              gameItemId: reward.gameItemId,
              quantity: reward.quantity,
              iconUrl: reward.iconUrl,
            },
          ],
        },
      });
      purchaseCode = normalizeText(queueResult?.purchase?.code) || null;
      deliveryQueued = Boolean(queueResult?.delivery?.queued);
      deliveryQueueReason = normalizeText(queueResult?.delivery?.reason) || null;
    }
  } catch (error) {
    await rollbackWheelSpinFn(userId, rewardEntry).catch(() => null);
    return {
      ok: false,
      reason: reward.type === 'item'
        ? 'wheel-item-grant-failed'
        : 'wheel-credit-failed',
      error: String(error?.message || error),
      rolledBack: true,
    };
  }

  const out = {
    ok: true,
    walletBalance,
    reward: {
      ...rewardEntry,
      purchaseCode,
      deliveryQueued,
      deliveryQueueReason,
      awardedCoins,
    },
  };
  out.message = buildWheelRewardMessage(out);
  return out;
}

module.exports = {
  normalizeReward,
  buildWheelRewardMessage,
  awardWheelRewardForUser,
};
