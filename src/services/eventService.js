const {
  createEvent,
  listEvents,
  joinEvent,
  updateEvent,
  startEvent,
  endEvent,
  getParticipants,
  flushEventStoreWrites,
} = require('../store/eventStore');
const { creditCoins } = require('./coinService');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.trunc(amount));
}

function normalizeEventId(value) {
  const id = Number(value);
  if (!Number.isFinite(id)) return null;
  const normalized = Math.trunc(id);
  return normalized > 0 ? normalized : null;
}

function buildScopeOptions(params = {}) {
  return {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
}

async function createServerEvent(params = {}) {
  const name = normalizeText(params.name);
  const time = normalizeText(params.time);
  const reward = normalizeText(params.reward);
  if (!name || !time || !reward) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const event = createEvent({ name, time, reward }, scopeOptions);
  await flushEventStoreWrites(scopeOptions);
  return { ok: true, event };
}

function listServerEvents(options = {}) {
  return listEvents(options);
}

async function joinServerEvent(params = {}) {
  const id = normalizeEventId(params.id);
  const userId = normalizeText(params.userId);
  if (!id || !userId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const result = joinEvent(id, userId, scopeOptions);
  if (!result) {
    return { ok: false, reason: 'not-found' };
  }

  await flushEventStoreWrites(scopeOptions);
  return {
    ok: true,
    event: result.ev,
    participants: Array.from(result.participants || []),
    participantsCount: Number(result.participants?.size || 0),
  };
}

async function startServerEvent(params = {}) {
  const id = normalizeEventId(params.id);
  if (!id) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const event = startEvent(id, scopeOptions);
  if (!event) {
    return { ok: false, reason: 'not-found' };
  }

  await flushEventStoreWrites(scopeOptions);
  return { ok: true, event };
}

async function updateServerEvent(params = {}) {
  const id = normalizeEventId(params.id);
  const name = normalizeText(params.name);
  const time = normalizeText(params.time);
  const reward = normalizeText(params.reward);
  if (!id || !name || !time || !reward) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const event = updateEvent(id, { name, time, reward }, scopeOptions);
  if (!event) {
    return { ok: false, reason: 'not-found' };
  }

  await flushEventStoreWrites(scopeOptions);
  return { ok: true, event };
}

async function finishServerEvent(params = {}) {
  const id = normalizeEventId(params.id);
  const winnerUserId = normalizeText(params.winnerUserId);
  const coins = normalizeAmount(params.coins);
  if (!id) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const event = endEvent(id, scopeOptions);
  if (!event) {
    return { ok: false, reason: 'not-found' };
  }

  await flushEventStoreWrites(scopeOptions);
  const participants = getParticipants(id, scopeOptions);
  if (!winnerUserId || coins <= 0) {
    return {
      ok: true,
      event,
      participants,
      rewardGranted: false,
      winnerUserId: winnerUserId || null,
      coins,
    };
  }

  const rewardResult = await creditCoins({
    userId: winnerUserId,
    amount: coins,
    reason: 'event_reward',
    actor: normalizeText(params.actor) || 'system',
    ...scopeOptions,
    meta: {
      eventId: event.id,
      eventName: event.name,
    },
  });

  if (!rewardResult.ok) {
    return {
      ok: true,
      event,
      participants,
      rewardGranted: false,
      winnerUserId,
      coins,
      rewardError: rewardResult.reason || 'credit-failed',
    };
  }

  return {
    ok: true,
    event,
    participants,
    rewardGranted: true,
    winnerUserId,
    coins,
    rewardBalance: rewardResult.balance,
  };
}

module.exports = {
  createServerEvent,
  listServerEvents,
  joinServerEvent,
  updateServerEvent,
  startServerEvent,
  finishServerEvent,
};
