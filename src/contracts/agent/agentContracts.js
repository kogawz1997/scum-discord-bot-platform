'use strict';

const crypto = require('node:crypto');

const AGENT_ROLES = Object.freeze(['sync', 'execute', 'hybrid']);
const AGENT_SCOPES = Object.freeze(['sync_only', 'execute_only', 'sync_execute']);
const STRICT_AGENT_ROLES = Object.freeze(['sync', 'execute']);
const STRICT_AGENT_SCOPES = Object.freeze(['sync_only', 'execute_only']);
const AGENT_STATUSES = Object.freeze(['pending', 'active', 'offline', 'revoked']);
const SERVER_STATUSES = Object.freeze(['active', 'disabled', 'maintenance']);

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function createId(prefix = 'cp') {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

function normalizeEnum(value, allowed, fallback) {
  const text = trimText(value, 120).toLowerCase();
  if (allowed.includes(text)) return text;
  return fallback;
}

function normalizeRole(value, fallback = 'hybrid') {
  return normalizeEnum(value, AGENT_ROLES, fallback);
}

function normalizeScope(value, fallback = 'sync_execute') {
  const normalized = normalizeEnum(value, AGENT_SCOPES, fallback);
  if (normalized === 'sync_only') return 'sync_only';
  if (normalized === 'execute_only') return 'execute_only';
  return 'sync_execute';
}

function normalizeRuntimeKind(value) {
  const text = trimText(value, 80).toLowerCase();
  if (!text) return '';
  if (['server-bot', 'server-bots', 'sync', 'sync_only', 'sync-only'].includes(text)) {
    return 'server-bots';
  }
  if (['delivery-agent', 'delivery-agents', 'execute', 'execute_only', 'execute-only'].includes(text)) {
    return 'delivery-agents';
  }
  return '';
}

function resolveStrictAgentRoleScope(input = {}, options = {}) {
  const meta = parseObject(input.meta) || parseObject(input.metadata) || {};
  const runtimeKind = normalizeRuntimeKind(
    input.runtimeKind
      || input.kind
      || meta.kind
      || meta.runtimeKind,
  );
  if (runtimeKind === 'server-bots') {
    return {
      ok: true,
      runtimeKind,
      role: 'sync',
      scope: 'sync_only',
      legacy: false,
    };
  }
  if (runtimeKind === 'delivery-agents') {
    return {
      ok: true,
      runtimeKind,
      role: 'execute',
      scope: 'execute_only',
      legacy: false,
    };
  }

  const role = normalizeRole(input.role, '');
  const scope = normalizeScope(input.scope, '');
  if (role === 'sync' || scope === 'sync_only') {
    return {
      ok: true,
      runtimeKind: 'server-bots',
      role: 'sync',
      scope: 'sync_only',
      legacy: false,
    };
  }
  if (role === 'execute' || scope === 'execute_only') {
    return {
      ok: true,
      runtimeKind: 'delivery-agents',
      role: 'execute',
      scope: 'execute_only',
      legacy: false,
    };
  }

  if (options.allowLegacyHybrid === true && (role === 'hybrid' || scope === 'sync_execute')) {
    return {
      ok: true,
      runtimeKind: '',
      role: 'hybrid',
      scope: 'sync_execute',
      legacy: true,
    };
  }

  return {
    ok: false,
    reason: 'strict-agent-role-scope-required',
  };
}

function normalizeStatus(value, allowed = AGENT_STATUSES, fallback = 'active') {
  return normalizeEnum(value, allowed, fallback);
}

function normalizeServerStatus(value) {
  return normalizeEnum(value, SERVER_STATUSES, 'active');
}

function parseObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeStringArray(value, maxItems = 16, maxLen = 160) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];
  return Array.from(new Set(
    source
      .map((entry) => trimText(entry, maxLen))
      .filter(Boolean),
  )).slice(0, maxItems);
}

function normalizeAgentRegistrationInput(input = {}) {
  const meta = parseObject(input.meta) || {};
  const requestedRole = normalizeRole(
    input.role
      || meta.role
      || meta.agentRole
      || 'hybrid',
    'hybrid',
  );
  const requestedScopeSource = input.scope
    || meta.scope
    || meta.agentScope
    || (requestedRole === 'sync'
      ? 'sync_only'
      : requestedRole === 'execute'
        ? 'execute_only'
        : 'sync_execute');
  const requestedScope = normalizeScope(
    requestedScopeSource,
    'sync_execute',
  );
  return {
    id: trimText(input.id, 120) || createId('agent'),
    tenantId: trimText(input.tenantId, 120),
    serverId: trimText(input.serverId, 120),
    guildId: trimText(input.guildId, 120),
    agentId: trimText(input.agentId, 120) || trimText(input.runtimeKey, 160) || createId('agent'),
    runtimeKey: trimText(input.runtimeKey, 160),
    displayName: trimText(input.displayName || input.name, 160),
    role: requestedRole,
    scope: requestedScope,
    channel: trimText(input.channel, 80) || null,
    version: trimText(input.version, 80) || null,
    minimumVersion: trimText(input.minimumVersion || input.minRequiredVersion, 80) || null,
    status: normalizeStatus(input.status, AGENT_STATUSES, 'active'),
    baseUrl: trimText(input.baseUrl || meta.baseUrl, 400) || null,
    hostname: trimText(input.hostname || meta.hostname, 160) || null,
    metadata: meta,
  };
}

function normalizeAgentSessionInput(input = {}) {
  const base = normalizeAgentRegistrationInput(input);
  return {
    ...base,
    sessionId: trimText(input.sessionId, 120) || createId('ags'),
    heartbeatAt: trimText(input.heartbeatAt, 80) || new Date().toISOString(),
    diagnostics: parseObject(input.diagnostics) || null,
    source: trimText(input.source, 120) || 'agent',
  };
}

function normalizeAgentSyncPayload(input = {}) {
  const session = normalizeAgentSessionInput(input);
  const payload = parseObject(input.payload) || {};
  const syncEvents = Array.isArray(input.events)
    ? input.events
    : Array.isArray(payload.events)
      ? payload.events
      : [];
  const snapshot = parseObject(input.snapshot) || parseObject(payload.snapshot) || null;
  return {
    ...session,
    syncRunId: trimText(input.syncRunId, 120) || createId('sync'),
    sourceType: trimText(input.sourceType || input.source || payload.sourceType, 120) || 'log',
    sourcePath: trimText(input.sourcePath || payload.sourcePath, 320) || null,
    freshnessAt: trimText(input.freshnessAt || payload.freshnessAt, 80) || new Date().toISOString(),
    eventCount: Math.max(0, Number(input.eventCount || syncEvents.length || 0) || 0),
    snapshot,
    events: syncEvents.slice(0, 200),
    payload,
    errors: normalizeStringArray(input.errors || payload.errors, 32, 300),
  };
}

function normalizeServerInput(input = {}) {
  return {
    id: trimText(input.id, 120) || createId('server'),
    tenantId: trimText(input.tenantId, 120),
    slug: trimText(input.slug, 160),
    name: trimText(input.name, 180),
    status: normalizeServerStatus(input.status),
    locale: trimText(input.locale, 24) || 'th',
    guildId: trimText(input.guildId, 120) || null,
    metadata: parseObject(input.metadata) || {},
  };
}

function normalizeServerDiscordLinkInput(input = {}) {
  return {
    id: trimText(input.id, 120) || createId('guildlink'),
    tenantId: trimText(input.tenantId, 120),
    serverId: trimText(input.serverId, 120),
    guildId: trimText(input.guildId, 120),
    status: normalizeStatus(input.status, ['active', 'disabled'], 'active'),
    metadata: parseObject(input.metadata) || {},
  };
}

function deriveScopesForAgent(role, scope) {
  const normalizedRole = normalizeRole(role, 'hybrid');
  const normalizedScope = normalizeScope(scope, 'sync_execute');
  const scopes = new Set(['tenant:read', 'server:read', 'agent:register', 'agent:session', 'agent:write']);
  if (normalizedRole === 'sync' || normalizedScope === 'sync_only' || normalizedScope === 'sync_execute') {
    scopes.add('agent:sync');
    scopes.add('analytics:read');
    scopes.add('config:read');
    scopes.add('config:write');
    scopes.add('server:control');
    scopes.add('backup:write');
  }
  if (normalizedRole === 'execute' || normalizedScope === 'execute_only' || normalizedScope === 'sync_execute') {
    scopes.add('agent:execute');
  }
  return Array.from(scopes);
}

module.exports = {
  AGENT_ROLES,
  AGENT_SCOPES,
  STRICT_AGENT_ROLES,
  STRICT_AGENT_SCOPES,
  AGENT_STATUSES,
  SERVER_STATUSES,
  createId,
  deriveScopesForAgent,
  normalizeAgentRegistrationInput,
  normalizeAgentSessionInput,
  normalizeAgentSyncPayload,
  normalizeRole,
  normalizeScope,
  normalizeServerDiscordLinkInput,
  normalizeServerInput,
  normalizeServerStatus,
  normalizeStatus,
  normalizeStringArray,
  normalizeRuntimeKind,
  parseObject,
  resolveStrictAgentRoleScope,
  trimText,
};
