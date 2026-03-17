const {
  createTicket,
  getTicketByChannel,
  claimTicket,
  closeTicket,
  listTickets,
} = require('../store/ticketStore');

function normalizeText(value) {
  return String(value || '').trim();
}

function buildScopeOptions(params = {}) {
  return {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
}

function createSupportTicket(params = {}) {
  const guildId = normalizeText(params.guildId);
  const userId = normalizeText(params.userId);
  const channelId = normalizeText(params.channelId);
  const category = normalizeText(params.category);
  const reason = normalizeText(params.reason);

  if (!guildId || !userId || !channelId || !category || !reason) {
    return { ok: false, reason: 'invalid-input' };
  }

  const scopeOptions = buildScopeOptions(params);
  const ticket = createTicket({
    guildId,
    userId,
    channelId,
    category,
    reason,
  }, scopeOptions);
  return { ok: true, ticket };
}

function getTicketByChannelId(channelId, options = {}) {
  const normalized = normalizeText(channelId);
  if (!normalized) return null;
  return getTicketByChannel(normalized, options);
}

function findOpenTicketForUserInGuild(params = {}) {
  const guildId = normalizeText(params.guildId);
  const userId = normalizeText(params.userId);
  if (!guildId || !userId) return null;

  const scopeOptions = buildScopeOptions(params);
  return listTickets(scopeOptions).find(
    (ticket) =>
      String(ticket?.guildId || '') === guildId
      && String(ticket?.userId || '') === userId
      && String(ticket?.status || '') !== 'closed',
  ) || null;
}

function claimSupportTicket(params = {}) {
  const channelId = normalizeText(params.channelId);
  const staffId = normalizeText(params.staffId);
  if (!channelId || !staffId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const ticket = claimTicket(channelId, staffId, buildScopeOptions(params));
  if (!ticket) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, ticket };
}

function closeSupportTicket(params = {}) {
  const channelId = normalizeText(params.channelId);
  if (!channelId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const ticket = closeTicket(channelId, buildScopeOptions(params));
  if (!ticket) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, ticket };
}

module.exports = {
  createSupportTicket,
  getTicketByChannelId,
  findOpenTicketForUserInGuild,
  claimSupportTicket,
  closeSupportTicket,
};
