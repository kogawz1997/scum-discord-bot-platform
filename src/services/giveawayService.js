const crypto = require('node:crypto');
const {
  createGiveaway,
  getGiveaway,
  listGiveaways,
  addEntrant,
  removeGiveaway,
} = require('../store/giveawayStore');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

function buildScopeOptions(params = {}) {
  return {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
}

function shuffleInPlace(list, randomIntFn = crypto.randomInt) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = randomIntFn(0, i + 1);
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function startGiveawayForMessage(params = {}) {
  const messageId = normalizeText(params.messageId);
  const channelId = normalizeText(params.channelId);
  const guildId = normalizeText(params.guildId);
  const prize = normalizeText(params.prize);
  const winnersCount = normalizePositiveInt(params.winnersCount, 1);
  const endsAt = params.endsAt instanceof Date ? params.endsAt : new Date(params.endsAt || 0);

  if (!messageId || !channelId || !guildId || !prize || Number.isNaN(endsAt.getTime())) {
    return { ok: false, reason: 'invalid-input' };
  }

  const giveaway = createGiveaway({
    messageId,
    channelId,
    guildId,
    prize,
    winnersCount,
    endsAt,
  }, buildScopeOptions(params));
  if (!giveaway) {
    return { ok: false, reason: 'create-failed' };
  }

  return { ok: true, giveaway };
}

function getGiveawayByMessageId(messageId) {
  const normalized = normalizeText(messageId);
  if (!normalized) return null;
  return getGiveaway(normalized);
}

function listGiveawayMessages(options = {}) {
  return listGiveaways(options);
}

function enterGiveawayForUser(params = {}) {
  const messageId = normalizeText(params.messageId);
  const userId = normalizeText(params.userId);
  if (!messageId || !userId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const giveaway = getGiveaway(messageId, scopeOptions);
  if (!giveaway) {
    return { ok: false, reason: 'not-found' };
  }
  if (giveaway.endsAt && giveaway.endsAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired', giveaway };
  }
  if (giveaway.entrants.has(userId)) {
    return { ok: true, alreadyJoined: true, giveaway };
  }

  const updated = addEntrant(messageId, userId, scopeOptions);
  if (!updated) {
    return { ok: false, reason: 'join-failed' };
  }

  return {
    ok: true,
    giveaway: updated,
    entrantsCount: updated.entrants.size,
  };
}

function settleGiveawayForMessage(params = {}) {
  const messageId = normalizeText(params.messageId);
  if (!messageId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const giveaway = getGiveaway(messageId, scopeOptions);
  if (!giveaway) {
    return { ok: false, reason: 'not-found' };
  }

  const entrants = Array.from(giveaway.entrants || []);
  if (entrants.length === 0) {
    removeGiveaway(messageId, scopeOptions);
    return {
      ok: true,
      giveaway,
      entrants: [],
      winnerIds: [],
      noEntrants: true,
    };
  }

  const shuffled = shuffleInPlace(entrants.slice(), params.randomIntFn || crypto.randomInt);
  const winnerIds = shuffled.slice(0, Math.max(1, Number(giveaway.winnersCount || 1)));
  removeGiveaway(messageId, scopeOptions);

  return {
    ok: true,
    giveaway,
    entrants,
    winnerIds,
    noEntrants: false,
  };
}

module.exports = {
  startGiveawayForMessage,
  getGiveawayByMessageId,
  listGiveawayMessages,
  enterGiveawayForUser,
  settleGiveawayForMessage,
};
