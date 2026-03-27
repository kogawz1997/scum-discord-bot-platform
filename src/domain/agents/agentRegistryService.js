'use strict';

const crypto = require('node:crypto');

const {
  deriveScopesForAgent,
  normalizeAgentRegistrationInput,
  normalizeAgentSessionInput,
  trimText,
} = require('../../contracts/agent/agentContracts');
const {
  listAgents,
  listAgentCredentials,
  listAgentDevices,
  listAgentProvisioningTokens,
  listAgentSessions,
  listAgentTokenBindings,
  listServers,
  recordAgentSession,
  revokeAgentCredential,
  revokeAgentDevice,
  revokeAgentProvisioningToken,
  revokeAgentTokenBinding,
  upsertAgent,
  upsertAgentCredential,
  upsertAgentDevice,
  upsertAgentProvisioningToken,
  upsertAgentTokenBinding,
} = require('../../data/repositories/controlPlaneRegistryRepository');

function createAgentRegistryService(deps = {}) {
  const {
    createPlatformApiKey,
    listPlatformApiKeys,
    listPlatformAgentRuntimes,
    recordPlatformAgentHeartbeat,
    revokePlatformApiKey,
    rotatePlatformApiKey,
    getPlatformTenantById,
  } = deps;

  const tenantApiKeyCache = new Map();
  const tenantRuntimeCache = new Map();

  function sha256(value) {
    return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
  }

  function createOneTimeSetupToken() {
    const prefix = `stp_${crypto.randomBytes(6).toString('hex')}`;
    const secret = crypto.randomBytes(24).toString('hex');
    return `${prefix}.${secret}`;
  }

  function buildDeviceId(agentId, machineFingerprint) {
    return [
      trimText(agentId, 120) || 'agent',
      sha256(machineFingerprint).slice(0, 12),
    ].join('-');
  }

  function findProvisioningTokenByRawToken(rawToken) {
    const token = trimText(rawToken, 500);
    if (!token) return null;
    const tokenPrefix = token.slice(0, 16);
    const tokenHash = sha256(token);
    const matches = listAgentProvisioningTokens({ tokenPrefix });
    return matches.find((row) => String(row?.tokenHash || '') === tokenHash) || null;
  }

  async function assertTenantExists(tenantId) {
    const tenant = await getPlatformTenantById?.(tenantId);
    if (!tenant) return { ok: false, reason: 'tenant-not-found' };
    return { ok: true, tenant };
  }

  async function createAgentToken(input = {}, actor = 'system') {
    const normalized = normalizeAgentRegistrationInput(input);
    if (!normalized.tenantId || !normalized.serverId || !normalized.agentId) {
      return { ok: false, reason: 'invalid-agent-token' };
    }
    const tenantCheck = await assertTenantExists(normalized.tenantId);
    if (!tenantCheck.ok) return tenantCheck;
    const tokenResult = await createPlatformApiKey({
      id: input.apiKeyId,
      tenantId: normalized.tenantId,
      name: trimText(input.name, 160) || `agent-${normalized.agentId}-${normalized.scope}`,
      status: 'active',
      scopes: deriveScopesForAgent(normalized.role, normalized.scope),
    }, actor);
    if (!tokenResult.ok) return tokenResult;
    const bindingResult = upsertAgentTokenBinding({
      id: tokenResult.apiKey?.id,
      tenantId: normalized.tenantId,
      serverId: normalized.serverId,
      guildId: normalized.guildId,
      agentId: normalized.agentId,
      apiKeyId: tokenResult.apiKey?.id,
      role: normalized.role,
      scope: normalized.scope,
      minVersion: normalized.minimumVersion,
      status: 'active',
    }, actor);
    if (!bindingResult.ok) return bindingResult;
    const agentResult = upsertAgent({
      ...normalized,
      status: 'active',
    }, actor);
    return {
      ok: true,
      agent: agentResult.agent,
      binding: bindingResult.binding,
      apiKey: tokenResult.apiKey,
      rawKey: tokenResult.rawKey,
    };
  }

  async function createAgentProvisioningToken(input = {}, actor = 'system') {
    const normalized = normalizeAgentRegistrationInput(input);
    if (!normalized.tenantId || !normalized.serverId || !normalized.agentId) {
      return { ok: false, reason: 'invalid-agent-provisioning-token' };
    }
    const tenantCheck = await assertTenantExists(normalized.tenantId);
    if (!tenantCheck.ok) return tenantCheck;
    const server = listServers({
      tenantId: normalized.tenantId,
      serverId: normalized.serverId,
    })[0] || null;
    if (!server) return { ok: false, reason: 'server-not-found' };

    const activeProvisioningTokens = listAgentProvisioningTokens({
      tenantId: normalized.tenantId,
      serverId: normalized.serverId,
      agentId: normalized.agentId,
      status: 'pending_activation',
    });
    for (const row of activeProvisioningTokens) {
      revokeAgentProvisioningToken(row.id, actor, {
        revokeReason: 'superseded-by-new-token',
      });
    }

    const rawSetupToken = createOneTimeSetupToken();
    const tokenResult = upsertAgentProvisioningToken({
      id: trimText(input.tokenId, 120) || trimText(input.id, 120) || normalized.id,
      tenantId: normalized.tenantId,
      serverId: normalized.serverId,
      guildId: normalized.guildId || server.guildId || null,
      agentId: normalized.agentId,
      runtimeKey: normalized.runtimeKey,
      role: normalized.role,
      scope: normalized.scope,
      tokenPrefix: rawSetupToken.slice(0, 16),
      tokenHash: sha256(rawSetupToken),
      minVersion: normalized.minimumVersion,
      expiresAt: trimText(input.expiresAt, 80) || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      metadata: input.metadata,
      status: 'pending_activation',
    }, actor);
    if (!tokenResult.ok) return tokenResult;

    const agentResult = upsertAgent({
      ...normalized,
      guildId: normalized.guildId || server.guildId || null,
      status: 'pending',
    }, actor);

    return {
      ok: true,
      token: tokenResult.token,
      rawSetupToken,
      bootstrap: {
        setupToken: rawSetupToken,
        tenantId: normalized.tenantId,
        serverId: normalized.serverId,
        guildId: normalized.guildId || server.guildId || null,
        agentId: normalized.agentId,
        agentType: normalized.role,
        role: normalized.role,
        scope: normalized.scope,
        runtimeKey: normalized.runtimeKey || null,
      },
      agent: agentResult.agent,
    };
  }

  async function activateAgent(input = {}, actor = 'platform-agent') {
    const rawSetupToken = trimText(input.setupToken || input.setup_token, 500);
    const machineFingerprint = trimText(input.machineFingerprint || input.machine_fingerprint, 240);
    if (!rawSetupToken || !machineFingerprint) {
      return { ok: false, reason: 'invalid-agent-activation' };
    }
    const provisioningToken = findProvisioningTokenByRawToken(rawSetupToken);
    if (!provisioningToken) return { ok: false, reason: 'invalid-setup-token' };
    if (String(provisioningToken.status || '') === 'revoked') {
      return { ok: false, reason: 'setup-token-revoked' };
    }
    if (String(provisioningToken.status || '') === 'consumed') {
      return { ok: false, reason: 'setup-token-consumed' };
    }
    if (provisioningToken.expiresAt && new Date(provisioningToken.expiresAt).getTime() < Date.now()) {
      return { ok: false, reason: 'setup-token-expired' };
    }

    const server = listServers({
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
    })[0] || null;
    if (!server) return { ok: false, reason: 'server-not-found' };

    const machineFingerprintHash = sha256(machineFingerprint);
    const existingDevices = listAgentDevices({
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
      agentId: provisioningToken.agentId,
    });
    const boundDevice = existingDevices.find((row) => String(row?.status || '') !== 'revoked') || null;
    if (boundDevice && String(boundDevice.machineFingerprintHash || '') !== machineFingerprintHash) {
      return { ok: false, reason: 'agent-device-already-bound' };
    }

    const credential = await createPlatformApiKey({
      tenantId: provisioningToken.tenantId,
      name: trimText(input.name, 160) || `agent-${provisioningToken.agentId}-${provisioningToken.scope}`,
      status: 'active',
      scopes: deriveScopesForAgent(provisioningToken.role, provisioningToken.scope),
    }, actor);
    if (!credential.ok) return credential;

    const now = new Date().toISOString();
    const deviceId = boundDevice?.id || buildDeviceId(provisioningToken.agentId, machineFingerprint);
    const deviceResult = upsertAgentDevice({
      id: deviceId,
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
      guildId: provisioningToken.guildId || server.guildId || null,
      agentId: provisioningToken.agentId,
      runtimeKey: trimText(input.runtimeKey, 160) || provisioningToken.runtimeKey || null,
      machineFingerprintHash,
      hostname: trimText(input.hostname, 160) || null,
      status: 'online',
      credentialId: credential.apiKey?.id || null,
      metadata: input.metadata,
      firstSeenAt: boundDevice?.firstSeenAt || now,
      lastSeenAt: now,
    }, actor);
    if (!deviceResult.ok) return deviceResult;

    const credentialResult = upsertAgentCredential({
      id: credential.apiKey?.id,
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
      guildId: provisioningToken.guildId || server.guildId || null,
      agentId: provisioningToken.agentId,
      apiKeyId: credential.apiKey?.id,
      keyPrefix: String(credential.rawKey || '').slice(0, 16),
      role: provisioningToken.role,
      scope: provisioningToken.scope,
      minVersion: provisioningToken.minVersion,
      deviceId,
      lastIssuedAt: now,
      metadata: {
        activatedFromSetupTokenId: provisioningToken.id,
      },
    }, actor);
    if (!credentialResult.ok) return credentialResult;

    const bindingResult = upsertAgentTokenBinding({
      id: credential.apiKey?.id,
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
      guildId: provisioningToken.guildId || server.guildId || null,
      agentId: provisioningToken.agentId,
      apiKeyId: credential.apiKey?.id,
      role: provisioningToken.role,
      scope: provisioningToken.scope,
      minVersion: provisioningToken.minVersion,
      status: 'active',
    }, actor);
    if (!bindingResult.ok) return bindingResult;

    const agentResult = upsertAgent({
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
      guildId: provisioningToken.guildId || server.guildId || null,
      agentId: provisioningToken.agentId,
      runtimeKey: trimText(input.runtimeKey, 160) || provisioningToken.runtimeKey || `${provisioningToken.agentId}-runtime`,
      displayName: trimText(input.displayName, 160) || null,
      role: provisioningToken.role,
      scope: provisioningToken.scope,
      channel: trimText(input.channel, 80) || null,
      version: trimText(input.version, 80) || null,
      minimumVersion: provisioningToken.minVersion,
      baseUrl: trimText(input.baseUrl, 400) || null,
      hostname: trimText(input.hostname, 160) || null,
      metadata: input.metadata,
      status: 'pending',
    }, actor);
    if (!agentResult.ok) return agentResult;

    upsertAgentProvisioningToken({
      ...provisioningToken,
      status: 'consumed',
      consumedAt: now,
      activatedDeviceId: deviceId,
      activatedCredentialId: credential.apiKey?.id || null,
    }, actor);

    const staleProvisioningTokens = listAgentProvisioningTokens({
      tenantId: provisioningToken.tenantId,
      serverId: provisioningToken.serverId,
      agentId: provisioningToken.agentId,
      status: 'pending_activation',
    }).filter((row) => String(row?.id || '') !== String(provisioningToken.id || ''));
    for (const row of staleProvisioningTokens) {
      revokeAgentProvisioningToken(row.id, actor, {
        revokeReason: 'superseded-after-activation',
      });
    }

    return {
      ok: true,
      agent: agentResult.agent,
      device: deviceResult.device,
      credential: credentialResult.credential,
      apiKey: credential.apiKey,
      rawKey: credential.rawKey,
      binding: bindingResult.binding,
    };
  }

  async function revokeAgentToken(input = {}, actor = 'system') {
    const apiKeyId = trimText(input.apiKeyId, 120);
    if (!apiKeyId) return { ok: false, reason: 'invalid-api-key-id' };
    const credential = listAgentCredentials({ apiKeyId })[0] || null;
    const binding = listAgentTokenBindings({ apiKeyId })[0] || null;
    const scopedTenantId = trimText(input.tenantId, 120);
    const bindingTenantId = trimText(binding?.tenantId, 120);
    const credentialTenantId = trimText(credential?.tenantId, 120);
    const effectiveTenantId = credentialTenantId || bindingTenantId || '';
    if (scopedTenantId && effectiveTenantId && effectiveTenantId !== scopedTenantId) {
      return { ok: false, reason: 'tenant-scope-mismatch' };
    }
    if (typeof revokePlatformApiKey === 'function') {
      const result = await revokePlatformApiKey(apiKeyId, actor);
      if (!result.ok) return result;
    }
    const bindingResult = revokeAgentTokenBinding(apiKeyId, actor);
    if (!bindingResult.ok) return bindingResult;
    if (credential?.id) {
      revokeAgentCredential(credential.id, actor, {
        revokeReason: 'api-key-revoked',
      });
    }
    return bindingResult;
  }

  async function rotateAgentToken(input = {}, actor = 'system') {
    const apiKeyId = trimText(input.apiKeyId, 120);
    if (!apiKeyId) return { ok: false, reason: 'invalid-api-key-id' };
    const binding = listAgentTokenBindings({ apiKeyId })[0] || null;
    if (!binding) return { ok: false, reason: 'agent-token-binding-not-found' };
    const scopedTenantId = trimText(input.tenantId, 120);
    if (scopedTenantId && String(binding.tenantId || '') !== scopedTenantId) {
      return { ok: false, reason: 'tenant-scope-mismatch' };
    }
    if (typeof rotatePlatformApiKey === 'function') {
      const rotated = await rotatePlatformApiKey({
        apiKeyId,
        tenantId: binding.tenantId,
        name: trimText(input.name, 160) || null,
      }, actor);
      if (!rotated.ok) return rotated;
      upsertAgentTokenBinding({
        ...binding,
        id: rotated.apiKey?.id,
        apiKeyId: rotated.apiKey?.id,
        status: 'active',
        revokedAt: null,
      }, actor);
      const previousCredential = listAgentCredentials({ apiKeyId })[0] || null;
      upsertAgentCredential({
        id: rotated.apiKey?.id,
        tenantId: binding.tenantId,
        serverId: binding.serverId,
        guildId: binding.guildId || null,
        agentId: binding.agentId,
        apiKeyId: rotated.apiKey?.id,
        keyPrefix: String(rotated.rawKey || '').slice(0, 16),
        role: binding.role,
        scope: binding.scope,
        minVersion: binding.minVersion,
        deviceId: previousCredential?.deviceId || null,
        lastIssuedAt: new Date().toISOString(),
        lastRotatedAt: new Date().toISOString(),
        metadata: {
          rotatedFromApiKeyId: apiKeyId,
        },
      }, actor);
      if (previousCredential?.id) {
        revokeAgentCredential(previousCredential.id, actor, {
          revokeReason: 'api-key-rotated',
          rotatedToApiKeyId: rotated.apiKey?.id || null,
        });
      }
      revokeAgentTokenBinding(apiKeyId, actor);
      return {
        ok: true,
        apiKey: rotated.apiKey,
        rawKey: rotated.rawKey,
      };
    }
    const scopes = binding.scope ? deriveScopesForAgent(binding.role, binding.scope) : [];
    const created = await createPlatformApiKey({
      tenantId: binding.tenantId,
      name: trimText(input.name, 160) || `agent-${binding.agentId}-${binding.scope}`,
      scopes,
      status: 'active',
    }, actor);
    if (!created.ok) return created;
    upsertAgentTokenBinding({
      ...binding,
      id: created.apiKey?.id,
      apiKeyId: created.apiKey?.id,
      status: 'active',
      revokedAt: null,
    }, actor);
    const previousCredential = listAgentCredentials({ apiKeyId })[0] || null;
    upsertAgentCredential({
      id: created.apiKey?.id,
      tenantId: binding.tenantId,
      serverId: binding.serverId,
      guildId: binding.guildId || null,
      agentId: binding.agentId,
      apiKeyId: created.apiKey?.id,
      keyPrefix: String(created.rawKey || '').slice(0, 16),
      role: binding.role,
      scope: binding.scope,
      minVersion: binding.minVersion,
      deviceId: previousCredential?.deviceId || null,
      lastIssuedAt: new Date().toISOString(),
      lastRotatedAt: new Date().toISOString(),
      metadata: {
        rotatedFromApiKeyId: apiKeyId,
      },
    }, actor);
    if (typeof revokePlatformApiKey === 'function') {
      await revokePlatformApiKey(apiKeyId, actor).catch(() => null);
    }
    if (previousCredential?.id) {
      revokeAgentCredential(previousCredential.id, actor, {
        revokeReason: 'api-key-rotated',
        rotatedToApiKeyId: created.apiKey?.id || null,
      });
    }
    revokeAgentTokenBinding(apiKeyId, actor);
    return {
      ok: true,
      apiKey: created.apiKey,
      rawKey: created.rawKey,
    };
  }

  async function revokeProvisioningToken(input = {}, actor = 'system') {
    const tokenId = trimText(input.tokenId || input.id, 120);
    if (!tokenId) return { ok: false, reason: 'invalid-agent-provisioning-token-id' };
    const token = listAgentProvisioningTokens({ tokenId })[0] || null;
    if (!token) return { ok: false, reason: 'agent-provisioning-token-not-found' };
    const scopedTenantId = trimText(input.tenantId, 120);
    if (scopedTenantId && String(token.tenantId || '') !== scopedTenantId) {
      return { ok: false, reason: 'tenant-scope-mismatch' };
    }
    return revokeAgentProvisioningToken(tokenId, actor, {
      revokeReason: trimText(input.revokeReason, 120) || 'manual-revoke',
    });
  }

  async function revokeManagedAgentDevice(input = {}, actor = 'system') {
    const deviceId = trimText(input.deviceId || input.id, 120);
    if (!deviceId) return { ok: false, reason: 'invalid-agent-device-id' };
    const device = listAgentDevices({ deviceId })[0] || null;
    if (!device) return { ok: false, reason: 'agent-device-not-found' };
    const scopedTenantId = trimText(input.tenantId, 120);
    if (scopedTenantId && String(device.tenantId || '') !== scopedTenantId) {
      return { ok: false, reason: 'tenant-scope-mismatch' };
    }
    const result = revokeAgentDevice(deviceId, actor, {
      revokeReason: trimText(input.revokeReason, 120) || 'manual-revoke',
    });
    if (!result.ok) return result;

    const credentialRows = listAgentCredentials({
      tenantId: device.tenantId,
      serverId: device.serverId,
      agentId: device.agentId,
    }).filter((row) => String(row?.deviceId || '') === String(deviceId));
    for (const row of credentialRows) {
      revokeAgentCredential(row.id, actor, {
        revokeReason: 'device-revoked',
        deviceId,
      });
      if (row.apiKeyId) {
        revokeAgentTokenBinding(row.apiKeyId, actor);
        if (typeof revokePlatformApiKey === 'function') {
          await revokePlatformApiKey(row.apiKeyId, actor).catch(() => null);
        }
      }
    }
    return result;
  }

  async function registerAgent(input = {}, auth = {}, actor = 'platform-agent') {
    const normalized = normalizeAgentRegistrationInput({
      ...input,
      tenantId: input.tenantId || auth.tenantId,
    });
    if (!normalized.tenantId || !normalized.serverId || !normalized.agentId || !normalized.runtimeKey) {
      return { ok: false, reason: 'invalid-agent-registration' };
    }
    const binding = listAgentTokenBindings({
      apiKeyId: auth.apiKeyId,
      tenantId: normalized.tenantId,
    })[0] || null;
    if (!binding) return { ok: false, reason: 'agent-token-binding-not-found' };
    if (binding.serverId !== normalized.serverId || binding.agentId !== normalized.agentId) {
      return { ok: false, reason: 'agent-registration-scope-mismatch' };
    }
    const result = upsertAgent({
      ...normalized,
      role: binding.role || normalized.role,
      scope: binding.scope || normalized.scope,
      status: 'active',
      guildId: normalized.guildId || binding.guildId || null,
      minimumVersion: binding.minVersion || normalized.minimumVersion || null,
    }, actor);
    await recordPlatformAgentHeartbeat?.({
      tenantId: normalized.tenantId,
      runtimeKey: normalized.runtimeKey,
      channel: normalized.channel,
      version: normalized.version || '0.0.0',
      minRequiredVersion: binding.minVersion || normalized.minimumVersion || null,
      status: 'online',
      meta: {
        ...normalized.metadata,
        agentId: normalized.agentId,
        serverId: normalized.serverId,
        guildId: normalized.guildId || binding.guildId || null,
        agentRole: binding.role || normalized.role,
        agentScope: binding.scope || normalized.scope,
        baseUrl: normalized.baseUrl || null,
        hostname: normalized.hostname || null,
      },
    }, actor).catch(() => null);
    return {
      ok: true,
      agent: result.agent,
      binding,
    };
  }

  async function recordSession(input = {}, auth = {}, actor = 'platform-agent') {
    const normalized = normalizeAgentSessionInput({
      ...input,
      tenantId: input.tenantId || auth.tenantId,
    });
    const agent = listAgents({
      tenantId: normalized.tenantId,
      serverId: normalized.serverId,
      agentId: normalized.agentId,
    })[0] || null;
    if (!agent) return { ok: false, reason: 'agent-not-registered' };
    const session = recordAgentSession({
      ...normalized,
      role: agent.role,
      scope: agent.scope,
      guildId: normalized.guildId || agent.guildId || null,
    }, actor);
    const credential = listAgentCredentials({ apiKeyId: auth.apiKeyId })[0] || null;
    const currentDevice = credential?.deviceId
      ? listAgentDevices({ deviceId: credential.deviceId })[0] || null
      : null;
    if (credential?.deviceId && currentDevice?.machineFingerprintHash) {
      upsertAgentDevice({
        id: credential.deviceId,
        tenantId: agent.tenantId,
        serverId: agent.serverId,
        guildId: agent.guildId || null,
        agentId: agent.agentId,
        runtimeKey: normalized.runtimeKey || agent.runtimeKey,
        machineFingerprintHash: currentDevice.machineFingerprintHash,
        hostname: normalized.hostname || agent.hostname || null,
        status: 'online',
        credentialId: credential.id,
        metadata: {
          ...(currentDevice.metadata || {}),
          lastSessionId: session.session?.sessionId || normalized.sessionId,
        },
        firstSeenAt: currentDevice.firstSeenAt,
        lastSeenAt: normalized.heartbeatAt || new Date().toISOString(),
        createdAt: currentDevice.createdAt,
      }, actor);
    }
    await recordPlatformAgentHeartbeat?.({
      tenantId: normalized.tenantId,
      runtimeKey: normalized.runtimeKey,
      channel: normalized.channel || agent.channel || null,
      version: normalized.version || agent.version || '0.0.0',
      minRequiredVersion: agent.minimumVersion || null,
      status: 'online',
      meta: {
        ...(agent.metadata || {}),
        baseUrl: normalized.baseUrl || agent.baseUrl || null,
        hostname: normalized.hostname || agent.hostname || null,
        agentId: agent.agentId,
        serverId: agent.serverId,
        guildId: agent.guildId || null,
        agentRole: agent.role,
        agentScope: agent.scope,
        diagnostics: normalized.diagnostics,
      },
    }, actor).catch(() => null);
    return {
      ok: true,
      session: session.session,
      agent,
    };
  }

  async function listAgentRegistry(options = {}) {
    const agents = listAgents(options);
    const readApiKeysForTenant = async (tenantId) => {
      if (tenantApiKeyCache.has(tenantId)) {
        return tenantApiKeyCache.get(tenantId);
      }
      const rows = typeof listPlatformApiKeys === 'function'
        ? await listPlatformApiKeys({ tenantId, limit: 200 })
        : [];
      tenantApiKeyCache.set(tenantId, rows);
      return rows;
    };
    const readAgentRuntimesForTenant = async (tenantId) => {
      if (tenantRuntimeCache.has(tenantId)) {
        return tenantRuntimeCache.get(tenantId);
      }
      const rows = typeof listPlatformAgentRuntimes === 'function'
        ? await listPlatformAgentRuntimes({ tenantId, limit: 200 })
        : [];
      tenantRuntimeCache.set(tenantId, rows);
      return rows;
    };
    const matchRuntimeForAgent = (agent, runtimes = []) => {
      const runtimeKey = trimText(agent?.runtimeKey, 160);
      const agentId = trimText(agent?.agentId, 120);
      const serverId = trimText(agent?.serverId, 120);
      const guildId = trimText(agent?.guildId, 120);
      return runtimes.find((row) => {
        const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
        if (runtimeKey && String(row?.runtimeKey || '') === runtimeKey) return true;
        if (agentId && String(meta.agentId || '') === agentId) {
          if (serverId && String(meta.serverId || '') && String(meta.serverId || '') !== serverId) {
            return false;
          }
          if (guildId && String(meta.guildId || '') && String(meta.guildId || '') !== guildId) {
            return false;
          }
          return true;
        }
        return false;
      }) || null;
    };
    return Promise.all(agents.map(async (agent) => {
      const sessions = listAgentSessions({
        tenantId: agent.tenantId,
        serverId: agent.serverId,
        agentId: agent.agentId,
      });
      const bindings = listAgentTokenBindings({
        tenantId: agent.tenantId,
        serverId: agent.serverId,
        agentId: agent.agentId,
      });
      const [apiKeys, runtimes] = await Promise.all([
        readApiKeysForTenant(agent.tenantId),
        readAgentRuntimesForTenant(agent.tenantId),
      ]);
      const bindingViews = bindings.map((binding) => ({
        ...binding,
        apiKey: apiKeys.find((row) => String(row?.id || '') === String(binding.apiKeyId || '')) || null,
      }));
      return {
        ...agent,
        bindings: bindingViews,
        sessions: sessions.slice(0, 10),
        runtime: matchRuntimeForAgent(agent, runtimes),
      };
    }));
  }

  async function listProvisioningTokens(options = {}) {
    return listAgentProvisioningTokens(options);
  }

  async function listManagedAgentDevices(options = {}) {
    return listAgentDevices(options);
  }

  async function listManagedAgentCredentials(options = {}) {
    const credentials = listAgentCredentials(options);
    const grouped = new Map();
    for (const row of credentials) {
      if (!grouped.has(row.tenantId)) {
        grouped.set(row.tenantId, await (typeof listPlatformApiKeys === 'function'
          ? listPlatformApiKeys({ tenantId: row.tenantId, limit: 500 })
          : []));
      }
    }
    return credentials.map((row) => ({
      ...row,
      apiKey: (grouped.get(row.tenantId) || []).find((entry) => String(entry?.id || '') === String(row.apiKeyId || '')) || null,
    }));
  }

  return {
    activateAgent,
    createAgentProvisioningToken,
    createAgentToken,
    listAgentRegistry,
    listManagedAgentCredentials,
    listManagedAgentDevices,
    listProvisioningTokens,
    recordSession,
    registerAgent,
    revokeManagedAgentDevice,
    revokeProvisioningToken,
    revokeAgentToken,
    rotateAgentToken,
  };
}

module.exports = {
  createAgentRegistryService,
};
