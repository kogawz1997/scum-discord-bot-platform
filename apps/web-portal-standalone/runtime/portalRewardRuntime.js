'use strict';

function createPortalRewardRuntime(options = {}) {
  const {
    crypto,
    config,
    canSpinWheel,
    getUserWheelState,
    normalizeText,
    normalizeAmount,
    normalizeQuantity,
    normalizeHttpUrl,
    resolveItemIconUrl,
  } = options;

  const defaultWheelRewards = [
    { id: 'coin-100', label: '100 Coins', type: 'coins', amount: 100, weight: 30 },
    { id: 'coin-250', label: '250 Coins', type: 'coins', amount: 250, weight: 24 },
    { id: 'coin-500', label: '500 Coins', type: 'coins', amount: 500, weight: 16 },
    { id: 'coin-1000', label: '1,000 Coins', type: 'coins', amount: 1000, weight: 9 },
    { id: 'coin-2000', label: '2,000 Coins', type: 'coins', amount: 2000, weight: 4 },
    { id: 'miss', label: 'พลาดรางวัล', type: 'none', amount: 0, weight: 17 },
  ];

  const defaultPlayerTips = [
    'ผูก SteamID ให้เรียบร้อยก่อนซื้อไอเทมในเกม',
    'อ่านกฎเซิร์ฟเวอร์ให้ครบก่อนเริ่มเล่น',
    'อย่าแชร์บัญชี Discord/Steam และอย่าเปิดเผยรหัสผ่าน',
    'หากพบปัญหาส่งของ ให้ใช้เลขออเดอร์แจ้งแอดมิน',
  ];

  function normalizePurchaseStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeWheelReward(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const id = normalizeText(raw.id || `reward-${index + 1}`).toLowerCase();
    const label = normalizeText(raw.label || raw.name || id);
    const rawType = normalizeText(raw.type || 'coins').toLowerCase();
    const type = rawType === 'item' || rawType === 'shop_item' || rawType === 'game_item'
      ? 'item'
      : rawType === 'none'
        ? 'none'
        : 'coins';
    const amount = normalizeAmount(raw.amount, 0);
    const weight = Math.max(1, normalizeAmount(raw.weight, 1));
    const itemId = normalizeText(raw.itemId || raw.shopItemId || raw.item);
    const gameItemId = normalizeText(raw.gameItemId || raw.scumItemId || itemId);
    const quantity = normalizeQuantity(raw.quantity, 1);
    const iconUrl = normalizeHttpUrl(raw.iconUrl)
      || resolveItemIconUrl({
        id: itemId || gameItemId || id,
        gameItemId,
        name: label,
      })
      || null;
    if (!id || !label) return null;
    if (type === 'item' && !itemId && !gameItemId) return null;
    return {
      id,
      label,
      type: type || 'coins',
      amount: type === 'coins' ? amount : 0,
      weight,
      itemId: type === 'item' ? (itemId || gameItemId) : null,
      gameItemId: type === 'item' ? (gameItemId || itemId || null) : null,
      quantity: type === 'item' ? quantity : 0,
      iconUrl,
    };
  }

  function getLuckyWheelConfig() {
    const luckyWheel = config.luckyWheel || {};
    const rewardsRaw = Array.isArray(luckyWheel.rewards) && luckyWheel.rewards.length > 0
      ? luckyWheel.rewards
      : defaultWheelRewards;
    const rewards = rewardsRaw
      .map((row, index) => normalizeWheelReward(row, index))
      .filter(Boolean);
    const cooldownMs = Math.max(
      60 * 1000,
      normalizeAmount(luckyWheel.cooldownMs, 6 * 60 * 60 * 1000),
    );
    const tips = Array.isArray(luckyWheel.tips) && luckyWheel.tips.length > 0
      ? luckyWheel.tips.map((line) => normalizeText(line)).filter(Boolean)
      : defaultPlayerTips;
    return {
      enabled: luckyWheel.enabled !== false,
      cooldownMs,
      rewards: rewards.length > 0 ? rewards : defaultWheelRewards,
      tips,
    };
  }

  function pickLuckyWheelReward(rewards) {
    const rows = Array.isArray(rewards) ? rewards : [];
    const normalized = rows
      .map((row, index) => normalizeWheelReward(row, index))
      .filter(Boolean);
    if (normalized.length === 0) {
      return normalizeWheelReward(defaultWheelRewards[0], 0);
    }

    const totalWeight = normalized.reduce((sum, row) => sum + row.weight, 0);
    if (totalWeight <= 0) return normalized[0];

    let cursor = crypto.randomInt(totalWeight);
    for (const row of normalized) {
      cursor -= row.weight;
      if (cursor < 0) return row;
    }
    return normalized[normalized.length - 1];
  }

  function msToHoursMinutes(ms) {
    const totalMinutes = Math.ceil(Number(ms || 0) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes} นาที`;
    return `${hours} ชม. ${minutes} นาที`;
  }

  function msToDaysHours(ms) {
    const totalHours = Math.ceil(Number(ms || 0) / (60 * 60 * 1000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days <= 0) return `${hours} ชม.`;
    return `${days} วัน ${hours} ชม.`;
  }

  function msToCountdownText(ms) {
    const value = Math.max(0, normalizeAmount(ms, 0));
    if (value <= 0) return 'พร้อมหมุน';
    if (value < 60 * 60 * 1000) return msToHoursMinutes(value);
    return msToDaysHours(value);
  }

  async function buildWheelStatePayload(discordId, wheelConfig, limit = 20, runtimeOptions = {}) {
    const [check, stateRaw] = await Promise.all([
      canSpinWheel(discordId, wheelConfig.cooldownMs, Date.now(), runtimeOptions),
      getUserWheelState(discordId, limit, runtimeOptions),
    ]);
    const state = stateRaw || {
      userId: String(discordId || ''),
      lastSpinAt: null,
      totalSpins: 0,
      history: [],
    };
    return {
      enabled: Boolean(wheelConfig.enabled),
      cooldownMs: normalizeAmount(wheelConfig.cooldownMs, 0),
      canSpin: Boolean(wheelConfig.enabled) && Boolean(check.ok),
      remainingMs: Boolean(check.ok) ? 0 : normalizeAmount(check.remainingMs, 0),
      remainingText: Boolean(check.ok)
        ? 'พร้อมหมุน'
        : msToCountdownText(check.remainingMs),
      nextSpinAt: check.nextSpinAt || null,
      lastSpinAt: state.lastSpinAt || null,
      totalSpins: normalizeAmount(state.totalSpins, 0),
      history: Array.isArray(state.history) ? state.history : [],
      rewards: wheelConfig.rewards.map((row) => ({
        id: row.id,
        label: row.label,
        type: row.type,
        amount: row.amount,
        weight: row.weight,
        itemId: row.itemId || null,
        gameItemId: row.gameItemId || null,
        quantity: row.quantity || 0,
        iconUrl: row.iconUrl || null,
      })),
    };
  }

  function getRentTimezone() {
    return normalizeText(config.rentBike?.timezone) || 'Asia/Phnom_Penh';
  }

  function getDatePartsInTimezone(date, timezone) {
    const safeDate = date instanceof Date ? date : new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(safeDate);
    const out = {};
    for (const part of parts) {
      out[part.type] = part.value;
    }
    return out;
  }

  function getDateKeyInTimezone(timezone, date = new Date()) {
    const parts = getDatePartsInTimezone(date, timezone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function getNextMidnightIsoInTimezone(timezone, date = new Date()) {
    try {
      const currentLocal = new Date(
        date.toLocaleString('en-US', { timeZone: timezone }),
      );
      if (Number.isNaN(currentLocal.getTime())) return null;
      const nextLocalMidnight = new Date(currentLocal);
      nextLocalMidnight.setHours(24, 0, 0, 0);
      const diffMs = nextLocalMidnight.getTime() - currentLocal.getTime();
      return new Date(date.getTime() + diffMs).toISOString();
    } catch {
      return null;
    }
  }

  return {
    buildWheelStatePayload,
    getDateKeyInTimezone,
    getLuckyWheelConfig,
    getNextMidnightIsoInTimezone,
    getRentTimezone,
    msToCountdownText,
    msToDaysHours,
    msToHoursMinutes,
    normalizePurchaseStatus,
    pickLuckyWheelReward,
  };
}

module.exports = {
  createPortalRewardRuntime,
};
