const { resolveTenantStoreScope } = require('./tenantStoreScope');

const MAX_HISTORY_PER_USER = 80;

function getLuckyWheelDb(options = {}) {
  return resolveTenantStoreScope(options).db;
}

function normalizeUserId(userId) {
  const id = String(userId || '').trim();
  return id || null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeRewardEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim() || 'unknown';
  const label = String(raw.label || '').trim() || id;
  const type = String(raw.type || 'coins').trim().toLowerCase() || 'coins';
  const amount = Number(raw.amount);
  const quantity = Number(raw.quantity);
  const itemId = String(raw.itemId || '').trim() || null;
  const gameItemId = String(raw.gameItemId || '').trim() || null;
  const iconUrl = String(raw.iconUrl || '').trim() || null;
  return {
    id,
    label,
    type,
    amount: Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0,
    quantity: Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0,
    itemId,
    gameItemId,
    iconUrl,
    at: normalizeTimestamp(raw.at) || new Date().toISOString(),
  };
}

function parseHistoryJson(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeRewardEntry(row))
      .filter(Boolean)
      .slice(0, MAX_HISTORY_PER_USER);
  } catch {
    return [];
  }
}

function toHistoryJson(history) {
  try {
    return JSON.stringify(Array.isArray(history) ? history : []);
  } catch {
    return '[]';
  }
}

function toStateView(userId, row, limit = 20) {
  const take = Math.max(1, Math.min(100, Math.trunc(Number(limit || 20))));
  const history = parseHistoryJson(row?.historyJson);
  return {
    userId: String(userId || ''),
    lastSpinAt: row?.lastSpinAt ? new Date(row.lastSpinAt).toISOString() : null,
    totalSpins: Number(row?.totalSpins || 0),
    history: history.slice(0, take),
  };
}

async function getUserWheelState(userId, limit = 20, options = {}) {
  const id = normalizeUserId(userId);
  if (!id) return null;
  const row = await getLuckyWheelDb(options).luckyWheelState.findUnique({
    where: { userId: id },
  });
  return toStateView(id, row, limit);
}

async function canSpinWheel(userId, cooldownMs, nowMs = Date.now(), options = {}) {
  const id = normalizeUserId(userId);
  if (!id) return { ok: false, reason: 'invalid-user-id', remainingMs: 0 };

  const cooldown = Math.max(0, Math.trunc(Number(cooldownMs || 0)));
  if (cooldown <= 0) {
    return { ok: true, remainingMs: 0, lastSpinAt: null, nextSpinAt: null };
  }

  const row = await getLuckyWheelDb(options).luckyWheelState.findUnique({
    where: { userId: id },
    select: { lastSpinAt: true },
  });

  if (!row?.lastSpinAt) {
    return { ok: true, remainingMs: 0, lastSpinAt: null, nextSpinAt: null };
  }

  const lastSpinMs = new Date(row.lastSpinAt).getTime();
  if (Number.isNaN(lastSpinMs)) {
    return { ok: true, remainingMs: 0, lastSpinAt: null, nextSpinAt: null };
  }

  const diff = Math.max(0, nowMs - lastSpinMs);
  if (diff >= cooldown) {
    return {
      ok: true,
      remainingMs: 0,
      lastSpinAt: new Date(row.lastSpinAt).toISOString(),
      nextSpinAt: new Date(lastSpinMs + cooldown).toISOString(),
    };
  }

  const remainingMs = cooldown - diff;
  return {
    ok: false,
    reason: 'cooldown',
    remainingMs,
    lastSpinAt: new Date(row.lastSpinAt).toISOString(),
    nextSpinAt: new Date(lastSpinMs + cooldown).toISOString(),
  };
}

async function recordWheelSpin(userId, rewardEntry, options = {}) {
  const id = normalizeUserId(userId);
  if (!id) return { ok: false, reason: 'invalid-user-id' };

  const reward = normalizeRewardEntry(rewardEntry);
  if (!reward) return { ok: false, reason: 'invalid-reward-entry' };

  const next = await getLuckyWheelDb(options).$transaction(async (tx) => {
    const existing = await tx.luckyWheelState.findUnique({
      where: { userId: id },
    });

    const history = parseHistoryJson(existing?.historyJson);
    history.unshift(reward);
    if (history.length > MAX_HISTORY_PER_USER) {
      history.length = MAX_HISTORY_PER_USER;
    }

    return tx.luckyWheelState.upsert({
      where: { userId: id },
      update: {
        lastSpinAt: new Date(reward.at),
        totalSpins: Number(existing?.totalSpins || 0) + 1,
        historyJson: toHistoryJson(history),
      },
      create: {
        userId: id,
        lastSpinAt: new Date(reward.at),
        totalSpins: 1,
        historyJson: toHistoryJson(history),
      },
    });
  });

  return {
    ok: true,
    data: {
      userId: id,
      lastSpinAt: next.lastSpinAt ? new Date(next.lastSpinAt).toISOString() : null,
      totalSpins: Number(next.totalSpins || 0),
      reward,
    },
  };
}

async function rollbackWheelSpin(userId, rewardEntry, options = {}) {
  const id = normalizeUserId(userId);
  if (!id) return { ok: false, reason: 'invalid-user-id' };

  const reward = normalizeRewardEntry(rewardEntry);
  if (!reward) return { ok: false, reason: 'invalid-reward-entry' };

  const next = await getLuckyWheelDb(options).$transaction(async (tx) => {
    const existing = await tx.luckyWheelState.findUnique({
      where: { userId: id },
    });
    if (!existing) return null;

    const history = parseHistoryJson(existing.historyJson);
    const index = history.findIndex((row) => row
      && row.id === reward.id
      && row.at === reward.at
      && row.type === reward.type
      && row.amount === reward.amount
      && row.quantity === reward.quantity
      && row.itemId === reward.itemId
      && row.gameItemId === reward.gameItemId);

    if (index < 0) {
      return null;
    }

    history.splice(index, 1);
    const nextLastSpinAt = history[0]?.at ? new Date(history[0].at) : null;
    return tx.luckyWheelState.update({
      where: { userId: id },
      data: {
        lastSpinAt: nextLastSpinAt,
        totalSpins: Math.max(0, Number(existing.totalSpins || 0) - 1),
        historyJson: toHistoryJson(history),
      },
    });
  });

  if (!next) {
    return { ok: false, reason: 'reward-entry-not-found' };
  }

  return {
    ok: true,
    data: {
      userId: id,
      lastSpinAt: next.lastSpinAt ? new Date(next.lastSpinAt).toISOString() : null,
      totalSpins: Number(next.totalSpins || 0),
    },
  };
}

async function listLuckyWheelStates(limit = 1000, options = {}) {
  const rows = await getLuckyWheelDb(options).luckyWheelState.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.max(1, Number(limit || 1000)),
  });
  return rows.map((row) => ({
    userId: row.userId,
    lastSpinAt: row.lastSpinAt ? new Date(row.lastSpinAt).toISOString() : null,
    totalSpins: Number(row.totalSpins || 0),
    history: parseHistoryJson(row.historyJson),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
}

async function replaceLuckyWheelStates(nextRows = [], options = {}) {
  await getLuckyWheelDb(options).$transaction(async (tx) => {
    await tx.luckyWheelState.deleteMany();
    for (const row of Array.isArray(nextRows) ? nextRows : []) {
      if (!row || typeof row !== 'object') continue;
      const userId = normalizeUserId(row.userId);
      if (!userId) continue;
      const history = Array.isArray(row.history)
        ? row.history.map((entry) => normalizeRewardEntry(entry)).filter(Boolean)
        : [];
      await tx.luckyWheelState.create({
        data: {
          userId,
          lastSpinAt: row.lastSpinAt ? new Date(row.lastSpinAt) : null,
          totalSpins: Math.max(0, Number(row.totalSpins || 0)),
          historyJson: toHistoryJson(history),
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        },
      });
    }
  });
}

module.exports = {
  getUserWheelState,
  canSpinWheel,
  recordWheelSpin,
  rollbackWheelSpin,
  listLuckyWheelStates,
  replaceLuckyWheelStates,
};
