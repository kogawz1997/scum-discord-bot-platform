const {
  createTicket,
  getTicketByChannel,
  claimTicket,
  closeTicket,
  listTickets,
} = require('../store/ticketStore');
const { resolveDefaultTenantId } = require('../prisma');
const { assertTenantDbIsolationScope, getTenantDbIsolationRuntime } = require('../utils/tenantDbIsolation');

function normalizeText(value) {
  return String(value || '').trim();
}

function createPortalTicketId() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `portal-ticket-${Date.now()}-${suffix}`;
}

function normalizePortalTicketCategory(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return 'support';
  if (['support', 'identity', 'delivery', 'billing', 'appeal'].includes(text)) {
    return text;
  }
  return 'support';
}

function buildPortalTicketGuildId(tenantId) {
  return `portal:${normalizeText(tenantId) || 'shared'}`;
}

function buildScopeOptions(params = {}, operation = 'support ticket operation') {
  const env = params.env;
  const explicitTenantId = normalizeText(params.tenantId) || normalizeText(params.defaultTenantId) || null;
  const runtime = getTenantDbIsolationRuntime(env);
  const tenantId = explicitTenantId || (runtime.strict ? (resolveDefaultTenantId({ env }) || null) : null);
  const scope = assertTenantDbIsolationScope({
    tenantId,
    operation,
    env,
  });
  return {
    tenantId: scope.tenantId,
    defaultTenantId: scope.tenantId,
    env,
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

  const scopeOptions = buildScopeOptions(params, 'create support ticket');
  const ticket = createTicket({
    guildId,
    userId,
    channelId,
    category,
    reason,
  }, scopeOptions);
  return { ok: true, ticket };
}

function createPlayerSupportTicket(params = {}) {
  const userId = normalizeText(params.userId);
  const reason = normalizeText(params.reason);
  const category = normalizePortalTicketCategory(params.category);
  if (!userId || !reason) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scopeOptions = buildScopeOptions(params, 'create player support ticket');
  const guildId = buildPortalTicketGuildId(scopeOptions.tenantId);
  const existing = findOpenTicketForUserInGuild({
    guildId,
    userId,
    tenantId: scopeOptions.tenantId,
    defaultTenantId: scopeOptions.defaultTenantId,
    env: scopeOptions.env,
  });
  if (existing) {
    return {
      ok: false,
      reason: 'ticket-already-open',
      ticket: existing,
    };
  }

  const ticket = createTicket({
    guildId,
    userId,
    channelId: createPortalTicketId(),
    category,
    reason,
  }, scopeOptions);
  if (!ticket) {
    return { ok: false, reason: 'ticket-create-failed' };
  }
  return { ok: true, ticket };
}

function getTicketByChannelId(channelId, options = {}) {
  const normalized = normalizeText(channelId);
  if (!normalized) return null;
  return getTicketByChannel(normalized, buildScopeOptions(options, 'read support ticket'));
}

function listSupportTicketsForUser(params = {}) {
  const userId = normalizeText(params.userId);
  if (!userId) return [];
  const scopeOptions = buildScopeOptions(params, 'list player support tickets');
  const limit = Number.isFinite(Number(params.limit))
    ? Math.max(1, Math.min(50, Math.trunc(Number(params.limit))))
    : 12;
  return listTickets(scopeOptions)
    .filter((ticket) => normalizeText(ticket?.userId) === userId)
    .sort((left, right) => {
      const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

function findOpenTicketForUserInGuild(params = {}) {
  const guildId = normalizeText(params.guildId);
  const userId = normalizeText(params.userId);
  if (!guildId || !userId) return null;

  const scopeOptions = buildScopeOptions(params, 'list open support tickets');
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
  const ticket = claimTicket(channelId, staffId, buildScopeOptions(params, 'claim support ticket'));
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
  const ticket = closeTicket(channelId, buildScopeOptions(params, 'close support ticket'));
  if (!ticket) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, ticket };
}

function closeSupportTicketForUser(params = {}) {
  const channelId = normalizeText(params.channelId);
  const userId = normalizeText(params.userId);
  if (!channelId || !userId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scopeOptions = buildScopeOptions(params, 'close player support ticket');
  const ticket = getTicketByChannel(channelId, scopeOptions);
  if (!ticket) {
    return { ok: false, reason: 'not-found' };
  }
  if (normalizeText(ticket.userId) !== userId) {
    return { ok: false, reason: 'forbidden' };
  }
  if (normalizeText(ticket.status).toLowerCase() === 'closed') {
    return { ok: true, ticket };
  }
  const closed = closeTicket(channelId, scopeOptions);
  if (!closed) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, ticket: closed };
}

module.exports = {
  createSupportTicket,
  createPlayerSupportTicket,
  getTicketByChannelId,
  findOpenTicketForUserInGuild,
  listSupportTicketsForUser,
  claimSupportTicket,
  closeSupportTicket,
  closeSupportTicketForUser,
};
