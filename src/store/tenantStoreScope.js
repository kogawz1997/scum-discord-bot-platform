const {
  prisma,
  getTenantScopedPrismaClient,
  resolveDefaultTenantId,
  resolveTenantScopedDatasourceUrl,
} = require('../prisma');
const {
  assertTenantDbIsolationScope,
  getTenantDbIsolationRuntime,
} = require('../utils/tenantDbIsolation');

const SERVER_SCOPED_USER_KEY_PREFIX = '__scum_server__';

function resolveTenantStoreScope(options = {}) {
  const env = options.env || process.env;
  const explicitTenantId = String(options.tenantId || options.defaultTenantId || '').trim() || null;
  const runtime = getTenantDbIsolationRuntime(env);
  const tenantId = explicitTenantId || (runtime.strict ? (resolveDefaultTenantId({ env }) || null) : null);
  const scope = assertTenantDbIsolationScope({
    tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: String(options.operation || '').trim() || 'tenant store scope',
    env,
  });
  if (!scope.tenantId) {
    return {
      tenantId: null,
      datasourceKey: '__default__',
      db: prisma,
    };
  }

  return {
    tenantId: scope.tenantId,
    datasourceKey: resolveTenantScopedDatasourceUrl(scope.tenantId, options) || scope.tenantId,
    db: getTenantScopedPrismaClient(scope.tenantId, options),
  };
}

function normalizeServerScopeId(value) {
  const text = String(value || '').trim();
  return text || null;
}

function parseServerScopedUserKey(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith(`${SERVER_SCOPED_USER_KEY_PREFIX}::`)) {
    return {
      raw,
      userId: raw,
      serverId: null,
      isScoped: false,
    };
  }

  const parts = raw.split('::');
  if (parts.length < 3) {
    return {
      raw,
      userId: raw,
      serverId: null,
      isScoped: false,
    };
  }

  const serverId = normalizeServerScopeId(parts[1]);
  const userId = String(parts.slice(2).join('::') || '').trim();
  if (!serverId || !userId) {
    return {
      raw,
      userId: raw,
      serverId: null,
      isScoped: false,
    };
  }

  return {
    raw,
    userId,
    serverId,
    isScoped: true,
  };
}

function buildServerScopedUserKey(userId, options = {}) {
  const parsed = parseServerScopedUserKey(userId);
  if (parsed.isScoped) {
    return parsed.raw;
  }

  const id = String(userId || '').trim();
  if (!id) return '';
  const serverId = normalizeServerScopeId(options.serverId);
  if (!serverId) return id;
  return `${SERVER_SCOPED_USER_KEY_PREFIX}::${serverId}::${id}`;
}

function matchesServerScope(value, options = {}) {
  const requestedServerId = normalizeServerScopeId(options.serverId);
  const parsed = parseServerScopedUserKey(value);
  if (!requestedServerId) {
    return true;
  }
  return parsed.serverId === requestedServerId;
}

function resolveTenantServerStoreScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  const serverId = normalizeServerScopeId(options.serverId);
  return {
    ...scope,
    serverId,
    playerScopeKey: `${scope.datasourceKey}::${serverId || '__all_servers__'}`,
  };
}

module.exports = {
  resolveTenantStoreScope,
  resolveTenantServerStoreScope,
  normalizeServerScopeId,
  buildServerScopedUserKey,
  parseServerScopedUserKey,
  matchesServerScope,
};
