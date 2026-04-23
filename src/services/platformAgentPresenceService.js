'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { atomicWriteJson, getFilePath } = require('../store/_persist');
const { resolveControlPlaneBaseUrl } = require('../integrations/scum/adapters/controlPlaneSyncClient');
const {
  decryptAgentStateToken,
  encryptAgentStateToken,
  resolveAgentStateSecret,
} = require('../utils/agentStateSecret');

function trimText(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function asInt(value, fallback, minValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minValue, Math.trunc(numeric));
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function ensureParentDirectory(filePath) {
  const folder = path.dirname(filePath);
  fs.mkdirSync(folder, { recursive: true });
}

function envFlag(value, fallback = false) {
  if (value == null || String(value).trim() === '') return fallback;
  const text = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(text);
}

function resolveStatePersistence(runtimeKey, env = process.env) {
  const explicit = trimText(env.PLATFORM_AGENT_STATE_FILE || env.SCUM_PLATFORM_AGENT_STATE_FILE, 600);
  if (explicit) {
    return {
      mode: 'encrypted-file',
      filePath: explicit,
    };
  }
  if (!envFlag(env.PLATFORM_AGENT_STATE_PERSIST || env.SCUM_PLATFORM_AGENT_STATE_PERSIST, false)) {
    return {
      mode: 'none',
      filePath: null,
    };
  }
  const safeRuntimeKey = trimText(runtimeKey, 120).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase() || 'platform-agent';
  return {
    mode: 'encrypted-file',
    filePath: getFilePath(`platform-agent-${safeRuntimeKey}.json`),
  };
}

function buildBearerToken(env, state, runtimeKeyOverride = null) {
  const runtimeKey = trimText(
    runtimeKeyOverride || env.PLATFORM_AGENT_RUNTIME_KEY || env.SCUM_AGENT_RUNTIME_KEY || 'platform-agent',
    160,
  ) || 'platform-agent';
  const encryptedStateToken = decryptAgentStateToken(state?.encryptedRawKey, env, runtimeKey);
  return trimText(
    env.PLATFORM_AGENT_TOKEN
    || env.SCUM_SYNC_AGENT_TOKEN
    || env.SCUM_AGENT_TOKEN
    || encryptedStateToken
    || state?.rawKey,
    1200,
  );
}

function createPlatformAgentPresenceService(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;
  const runtimeKey = trimText(options.runtimeKey || env.PLATFORM_AGENT_RUNTIME_KEY || env.SCUM_AGENT_RUNTIME_KEY, 160)
    || 'platform-agent';
  const role = trimText(options.role, 40) || 'sync';
  const scope = trimText(options.scope, 40) || 'sync_only';
  const channel = trimText(options.channel || env.SCUM_AGENT_CHANNEL, 80) || 'stable';
  const version = trimText(options.version || env.SCUM_AGENT_VERSION || env.SCUM_SYNC_AGENT_VERSION, 80) || '0.0.0-local';
  const minimumVersion = trimText(options.minimumVersion || env.PLATFORM_AGENT_MIN_VERSION, 80) || null;
  const tenantId = trimText(options.tenantId || env.PLATFORM_TENANT_ID || env.TENANT_ID, 160) || null;
  const serverId = trimText(options.serverId || env.PLATFORM_SERVER_ID || env.SCUM_SERVER_ID, 160) || null;
  const guildId = trimText(options.guildId || env.DISCORD_GUILD_ID, 160) || null;
  const agentId = trimText(options.agentId || env.PLATFORM_AGENT_ID || env.SCUM_AGENT_ID || runtimeKey, 160) || runtimeKey;
  const displayName = trimText(options.displayName || env.PLATFORM_AGENT_DISPLAY_NAME, 160) || runtimeKey;
  const hostname = trimText(options.hostname, 160) || os.hostname();
  const machineFingerprint = trimText(options.machineFingerprint || `${hostname}:${runtimeKey}`, 240);
  const localBaseUrl = trimText(options.localBaseUrl, 400) || null;
  const baseUrl = trimText(options.baseUrl, 400) || resolveControlPlaneBaseUrl(env);
  const setupToken = trimText(env.PLATFORM_AGENT_SETUP_TOKEN || env.SCUM_PLATFORM_SETUP_TOKEN, 800);
  const stateSecretConfigured = Boolean(resolveAgentStateSecret(env));
  const heartbeatIntervalMs = asInt(env.PLATFORM_AGENT_HEARTBEAT_INTERVAL_MS, 30000, 5000);
  const statePersistence = resolveStatePersistence(runtimeKey, env);
  const stateFilePath = statePersistence.filePath;
  let heartbeatTimer = null;
  let state = stateFilePath ? readJsonFile(stateFilePath) : {};
  let transientToken = '';
  let stateNeedsPersist = false;

  // Migrate legacy plaintext state into encrypted-at-rest storage when a local
  // secret is configured, while keeping the current process alive with an
  // in-memory fallback if secure persistence is not yet configured.
  const legacyRawKey = trimText(state?.rawKey, 1200);
  if (legacyRawKey) {
    transientToken = legacyRawKey;
    state = {
      ...state,
      encryptedRawKey: stateSecretConfigured
        ? (encryptAgentStateToken(legacyRawKey, env, runtimeKey) || state.encryptedRawKey || null)
        : null,
      rawKey: null,
      tokenPersistence: stateSecretConfigured && stateFilePath ? 'encrypted' : 'memory-only',
    };
    stateNeedsPersist = true;
  }

  function persistState() {
    if (!stateFilePath) {
      return;
    }
    ensureParentDirectory(stateFilePath);
    const snapshot = {
      ...state,
    };
    if (!snapshot.rawKey) {
      delete snapshot.rawKey;
    }
    if (!snapshot.encryptedRawKey) {
      delete snapshot.encryptedRawKey;
    }
    if (!snapshot.tokenPersistence) {
      delete snapshot.tokenPersistence;
    }
    atomicWriteJson(stateFilePath, snapshot);
  }

  if (stateNeedsPersist) {
    persistState();
  }

  async function requestJson(method, pathname, payload, token) {
    if (!baseUrl || typeof fetchImpl !== 'function') {
      return { ok: false, error: 'control-plane-unavailable' };
    }
    const response = await fetchImpl(`${baseUrl}${pathname}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.ok === false) {
      return {
        ok: false,
        status: response.status,
        error: trimText(json?.error || `http-${response.status}`, 300),
        data: json?.data || null,
      };
    }
    return {
      ok: true,
      data: json?.data || null,
    };
  }

  function buildRegistrationPayload(extra = {}) {
    return {
      tenantId,
      serverId,
      guildId,
      agentId,
      runtimeKey,
      displayName,
      role,
      scope,
      channel,
      version,
      minimumVersion,
      baseUrl: localBaseUrl,
      hostname,
      meta: extra.meta && typeof extra.meta === 'object' ? extra.meta : {},
    };
  }

  function resolveServerConfigScope() {
    if (role !== 'sync' || scope !== 'sync_only') {
      return {
        ok: false,
        error: 'platform-agent-server-bot-required',
      };
    }
    if (!tenantId || !serverId || !runtimeKey) {
      return {
        ok: false,
        error: 'platform-agent-server-config-scope-required',
      };
    }
    return {
      ok: true,
      tenantId,
      serverId,
      runtimeKey,
    };
  }

  async function ensureActivated() {
    const existingToken = buildBearerToken(env, {
      ...state,
      rawKey: transientToken || state?.rawKey,
    }, runtimeKey);
    if (existingToken) return { ok: true, token: existingToken };
    if (!setupToken) {
      return { ok: false, error: 'platform-agent-token-missing' };
    }
    const activation = await requestJson('POST', '/platform/api/v1/agent/activate', {
      setupToken,
      machineFingerprint,
      runtimeKey,
      displayName,
      hostname,
      version,
      channel,
      baseUrl: localBaseUrl,
      metadata: {
        runtimeKey,
        role,
        scope,
      },
    });
    if (!activation.ok) return activation;
    const activatedRawKey = trimText(activation.data?.rawKey, 1200) || null;
    transientToken = activatedRawKey || '';
    state = {
      ...state,
      activatedAt: new Date().toISOString(),
      activation: activation.data || null,
      encryptedRawKey: activatedRawKey && stateSecretConfigured
        ? encryptAgentStateToken(activatedRawKey, env, runtimeKey) || null
        : null,
      rawKey: null,
      tokenPersistence: activatedRawKey
        ? (stateSecretConfigured && stateFilePath ? 'encrypted' : 'memory-only')
        : null,
    };
    persistState();
    return {
      ok: true,
      token: buildBearerToken(env, {
        ...state,
        rawKey: transientToken,
      }, runtimeKey),
    };
  }

  async function register(extra = {}) {
    const activation = await ensureActivated();
    if (!activation.ok) return activation;
    const response = await requestJson(
      'POST',
      '/platform/api/v1/agent/register',
      buildRegistrationPayload(extra),
      activation.token,
    );
    if (response.ok) {
      state = {
        ...state,
        registeredAt: new Date().toISOString(),
        lastRegister: response.data || null,
      };
      persistState();
    }
    return response;
  }

  async function sendSession(extra = {}) {
    const activation = await ensureActivated();
    if (!activation.ok) return activation;
    const response = await requestJson(
      'POST',
      '/platform/api/v1/agent/session',
      {
        ...buildRegistrationPayload(extra),
        sessionId: trimText(extra.sessionId, 160) || `${runtimeKey}-${Date.now()}`,
        heartbeatAt: new Date().toISOString(),
        diagnostics: extra.diagnostics && typeof extra.diagnostics === 'object' ? extra.diagnostics : {},
      },
      activation.token,
    );
    if (response.ok) {
      state = {
        ...state,
        lastHeartbeatAt: new Date().toISOString(),
        lastSession: response.data || null,
      };
      persistState();
    }
    return response;
  }

  async function postSync(payload = {}) {
    const activation = await ensureActivated();
    if (!activation.ok) return activation;
    return requestJson(
      'POST',
      '/platform/api/v1/agent/sync',
      {
        ...payload,
        tenantId: payload.tenantId || tenantId,
        serverId: payload.serverId || serverId,
        guildId: payload.guildId || guildId,
        agentId: payload.agentId || agentId,
        runtimeKey: payload.runtimeKey || runtimeKey,
        role: payload.role || role,
        scope: payload.scope || scope,
        channel: payload.channel || channel,
        version: payload.version || version,
        heartbeatAt: payload.heartbeatAt || new Date().toISOString(),
      },
      activation.token,
    );
  }

  async function uploadServerConfigSnapshot(snapshot = {}) {
    const configScope = resolveServerConfigScope();
    if (!configScope.ok) return configScope;
    const activation = await ensureActivated();
    if (!activation.ok) return activation;
    return requestJson(
      'POST',
      '/platform/api/v1/server-config/snapshot',
      {
        tenantId: configScope.tenantId,
        serverId: configScope.serverId,
        runtimeKey: configScope.runtimeKey,
        snapshot,
      },
      activation.token,
    );
  }

  async function claimNextServerConfigJob() {
    const configScope = resolveServerConfigScope();
    if (!configScope.ok) return configScope;
    const activation = await ensureActivated();
    if (!activation.ok) return activation;
    const query = `?tenantId=${encodeURIComponent(configScope.tenantId)}&serverId=${encodeURIComponent(configScope.serverId)}&runtimeKey=${encodeURIComponent(configScope.runtimeKey)}`;
    return requestJson('GET', `/platform/api/v1/server-config/jobs/next${query}`, null, activation.token);
  }

  async function reportServerConfigJobResult(payload = {}) {
    const configScope = resolveServerConfigScope();
    if (!configScope.ok) return configScope;
    const activation = await ensureActivated();
    if (!activation.ok) return activation;
    return requestJson(
      'POST',
      '/platform/api/v1/server-config/jobs/result',
      {
        ...payload,
        tenantId: configScope.tenantId,
        serverId: configScope.serverId,
        runtimeKey: configScope.runtimeKey,
      },
      activation.token,
    );
  }

  async function start(optionsInput = {}) {
    if (!baseUrl) {
      return { ok: false, error: 'control-plane-base-url-missing' };
    }
    const registered = await register({
      meta: optionsInput.meta,
    });
    if (!registered.ok) return registered;
    await sendSession({
      diagnostics: optionsInput.diagnostics && typeof optionsInput.diagnostics === 'object'
        ? optionsInput.diagnostics
        : {},
    }).catch(() => null);
    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => {
        void sendSession({
          diagnostics: optionsInput.getDiagnostics ? optionsInput.getDiagnostics() : {},
        }).catch(() => null);
      }, heartbeatIntervalMs);
    }
    return { ok: true };
  }

  async function close() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  return {
    agentId,
    baseUrl,
    role,
    runtimeKey,
    scope,
    serverId,
    tenantId,
    close,
    claimNextServerConfigJob,
    ensureActivated,
    postSync,
    register,
    reportServerConfigJobResult,
    sendSession,
    start,
    uploadServerConfigSnapshot,
  };
}

module.exports = {
  createPlatformAgentPresenceService,
};
