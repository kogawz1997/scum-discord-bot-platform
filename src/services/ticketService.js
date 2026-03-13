const {
  createTicket,
  getTicketByChannel,
  claimTicket,
  closeTicket,
  tickets,
} = require('../store/ticketStore');

function normalizeText(value) {
  return String(value || '').trim();
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

  const ticket = createTicket({
    guildId,
    userId,
    channelId,
    category,
    reason,
  });
  return { ok: true, ticket };
}

function getTicketByChannelId(channelId) {
  const normalized = normalizeText(channelId);
  if (!normalized) return null;
  return getTicketByChannel(normalized);
}

function findOpenTicketForUserInGuild(params = {}) {
  const guildId = normalizeText(params.guildId);
  const userId = normalizeText(params.userId);
  if (!guildId || !userId) return null;

  return Array.from(tickets.values()).find(
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
  const ticket = claimTicket(channelId, staffId);
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
  const ticket = closeTicket(channelId);
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
