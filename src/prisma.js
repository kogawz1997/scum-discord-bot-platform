const fs = require('node:fs');
const path = require('node:path');
const {
  PrismaClient,
  getGeneratedClientMetadata,
  resolveClientModulePath,
} = require('./prismaClientLoader');
const { resolveDatabaseRuntime } = require('./utils/dbEngine');
const { resolveTenantDatabaseTarget } = require('./utils/tenantDatabaseTopology');
const {
  clearProvisionedTenantDatabaseTargets,
  ensureTenantDatabaseTargetProvisioned,
  shouldAutoProvisionTenantDatabaseTarget,
} = require('./utils/tenantDatabaseProvisioning');

const SOURCE_SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

function normalizeText(value) {
  return String(value || '').trim();
}

function isNodeTestRuntime() {
  if (normalizeText(process.env.NODE_ENV).toLowerCase() === 'test') {
    return true;
  }
  return process.execArgv.some((arg) => String(arg || '').startsWith('--test'));
}

function normalizeFileDatabasePath(databaseUrl) {
  const raw = normalizeText(databaseUrl);
  if (!raw.startsWith('file:')) return '';
  const filePath = raw.slice('file:'.length).replace(/^"|"$/g, '');
  if (!filePath) return '';
  return path.resolve(process.cwd(), 'prisma', filePath);
}

function shouldForceIsolatedTestDatabase() {
  if (!isNodeTestRuntime()) return false;
  const rawUrl = normalizeText(process.env.DATABASE_URL);
  if (!rawUrl) return true;
  if (/^postgres(?:ql)?:\/\//i.test(rawUrl) || /^mysql:\/\//i.test(rawUrl)) {
    return true;
  }
  if (!rawUrl.startsWith('file:')) {
    return true;
  }
  const resolvedPath = normalizeFileDatabasePath(rawUrl);
  const sharedDbPaths = new Set([
    path.resolve(process.cwd(), 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'production.db'),
    path.resolve(process.cwd(), 'prisma', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'prisma', 'production.db'),
    path.resolve(process.cwd(), 'prisma', 'test.db'),
  ]);
  return !resolvedPath || sharedDbPaths.has(resolvedPath);
}

function ensureTestDatabaseDefaults() {
  if (!isNodeTestRuntime()) return;
  process.env.NODE_ENV = 'test';
  const explicitTestDatabaseUrl = normalizeText(process.env.PRISMA_TEST_DATABASE_URL);
  if (explicitTestDatabaseUrl) {
    process.env.DATABASE_URL = explicitTestDatabaseUrl;
    process.env.DATABASE_PROVIDER = normalizeText(process.env.PRISMA_TEST_DATABASE_PROVIDER) || 'postgresql';
    process.env.PRISMA_SCHEMA_PROVIDER = normalizeText(process.env.PRISMA_TEST_DATABASE_PROVIDER) || 'postgresql';
    return;
  }
  const forceIsolatedDatabase = shouldForceIsolatedTestDatabase();
  if (forceIsolatedDatabase) {
    process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'prisma', 'test.db')}`;
  }
  if (forceIsolatedDatabase || !normalizeText(process.env.DATABASE_PROVIDER)) {
    process.env.DATABASE_PROVIDER = 'sqlite';
  }
  if (forceIsolatedDatabase || !normalizeText(process.env.PRISMA_SCHEMA_PROVIDER)) {
    process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';
  }
}

function readSourceSchemaProvider(schemaPath = SOURCE_SCHEMA_PATH) {
  try {
    const text = fs.readFileSync(schemaPath, 'utf8');
    const match = text.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/m);
    return normalizeText(match?.[1]).toLowerCase() || 'sqlite';
  } catch {
    return 'sqlite';
  }
}

function getPrismaRuntimeProfile(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const projectRoot = options.projectRoot || process.cwd();
  const schemaPath = options.schemaPath || path.join(projectRoot, 'prisma', 'schema.prisma');
  const databaseUrl = options.databaseUrl == null ? env.DATABASE_URL : options.databaseUrl;
  const requestedProvider = normalizeText(
    options.provider
      || env.PRISMA_SCHEMA_PROVIDER
      || env.DATABASE_PROVIDER,
  ).toLowerCase();
  const runtime = resolveDatabaseRuntime({
    projectRoot,
    schemaPath,
    databaseUrl,
    provider: requestedProvider,
  });
  const sourceSchemaProvider = readSourceSchemaProvider(schemaPath);
  const generatedClientMetadata = options.generatedClientMetadata === undefined
    ? getGeneratedClientMetadata()
    : options.generatedClientMetadata;
  const generatedClientProvider = normalizeText(
    options.generatedClientProvider
      || generatedClientMetadata?.provider
      || requestedProvider
      || runtime.provider,
  ).toLowerCase() || runtime.provider;
  const generatedClientOutputPath = normalizeText(
    options.generatedClientOutputPath
      || generatedClientMetadata?.outputPath,
    4000,
  ) || null;
  const clientModulePath = options.clientModulePath === undefined
    ? resolveClientModulePath()
    : options.clientModulePath;
  const usesProviderRenderedSchema = sourceSchemaProvider !== runtime.provider;
  const runtimeMode = usesProviderRenderedSchema
    ? 'provider-rendered-runtime'
    : 'sqlite-compatibility';

  return {
    sourceSchemaPath: schemaPath,
    sourceSchemaProvider,
    requestedProvider: requestedProvider || runtime.provider,
    runtimeDatabaseUrl: runtime.rawUrl,
    runtimeEngine: runtime.engine,
    runtimeProvider: runtime.provider,
    generatedClientProvider,
    generatedClientOutputPath,
    clientModulePath: clientModulePath || null,
    usesProviderRenderedSchema,
    runtimeMode,
    summary: usesProviderRenderedSchema
      ? `Checked-in source schema stays ${sourceSchemaProvider} for compatibility while runtime uses ${runtime.provider} via rendered Prisma schema/client.`
      : `Checked-in source schema and runtime both use ${runtime.provider}.`,
  };
}

let cachedClient = null;
let cachedKey = '';
const scopedClientCache = new Map();

function buildManagedDatasourceUrl(rawInput = process.env.DATABASE_URL, options = {}) {
  ensureTestDatabaseDefaults();
  const rawUrl = normalizeText(rawInput || process.env.DATABASE_URL);
  if (!/^postgres(?:ql)?:\/\//i.test(rawUrl) && !/^mysql:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (!normalizeText(parsed.searchParams.get('connection_limit'))) {
    const defaultLimit = normalizeText(options.connectionLimit)
      || normalizeText(process.env.PRISMA_CONNECTION_LIMIT)
      || (isNodeTestRuntime() ? '2' : '5');
    parsed.searchParams.set(
      'connection_limit',
      defaultLimit,
    );
  }

  if (!normalizeText(parsed.searchParams.get('pool_timeout'))) {
    const defaultPoolTimeout = normalizeText(options.poolTimeout)
      || normalizeText(process.env.PRISMA_POOL_TIMEOUT)
      || (isNodeTestRuntime() ? '10' : '20');
    parsed.searchParams.set(
      'pool_timeout',
      defaultPoolTimeout,
    );
  }

  return parsed.toString();
}

function getClientKey() {
  const managedUrl = buildManagedDatasourceUrl();
  return JSON.stringify({
    databaseUrl: managedUrl,
    provider: String(process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || '').trim(),
    nodeEnv: String(process.env.NODE_ENV || '').trim(),
  });
}

function createPrismaClient() {
  const managedUrl = buildManagedDatasourceUrl();
  if (!managedUrl) {
    return new PrismaClient();
  }
  return new PrismaClient({
    datasources: {
      db: {
        url: managedUrl,
      },
    },
  });
}

function createScopedPrismaClient(databaseUrl, options = {}) {
  const managedUrl = buildManagedDatasourceUrl(databaseUrl, options);
  if (!managedUrl) {
    return new PrismaClient();
  }
  return new PrismaClient({
    datasources: {
      db: {
        url: managedUrl,
      },
    },
  });
}

function getScopedClientPoolOptions(options = {}) {
  return {
    connectionLimit: normalizeText(options.connectionLimit)
      || normalizeText(process.env.PRISMA_SCOPED_CONNECTION_LIMIT)
      || '1',
    poolTimeout: normalizeText(options.poolTimeout)
      || normalizeText(process.env.PRISMA_SCOPED_POOL_TIMEOUT)
      || '10',
  };
}

function getPrismaClient() {
  const nextKey = getClientKey();
  if (!cachedClient || cachedKey !== nextKey) {
    if (cachedClient) {
      cachedClient.$disconnect().catch(() => {});
    }
    cachedClient = createPrismaClient();
    cachedKey = nextKey;
  }
  return cachedClient;
}

function getScopedPrismaClient(databaseUrl) {
  const scopedPoolOptions = getScopedClientPoolOptions();
  const managedUrl = buildManagedDatasourceUrl(databaseUrl, scopedPoolOptions);
  const cacheKey = managedUrl || '__default__';
  if (!scopedClientCache.has(cacheKey)) {
    scopedClientCache.set(cacheKey, createScopedPrismaClient(databaseUrl, scopedPoolOptions));
  }
  return scopedClientCache.get(cacheKey);
}

function resolveTenantScopedDatasourceUrl(tenantId, options = {}) {
  const id = normalizeText(tenantId);
  if (!id) return buildManagedDatasourceUrl();
  const env = options.env || process.env;
  const target = resolveTenantDatabaseTarget({
    tenantId: id,
    env,
    databaseUrl: options.databaseUrl || env.DATABASE_URL,
    mode: options.mode || env.TENANT_DB_TOPOLOGY_MODE,
    provider: options.provider || env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  return buildManagedDatasourceUrl(target.datasourceUrl || env.DATABASE_URL);
}

function resolveDefaultTenantId(options = {}) {
  const env = options.env || process.env;
  const direct = normalizeText(options.tenantId || options.defaultTenantId);
  if (direct) return direct;
  return normalizeText(env.PLATFORM_DEFAULT_TENANT_ID || env.DEFAULT_TENANT_ID);
}

function getTenantScopedPrismaClient(tenantId, options = {}) {
  const id = normalizeText(tenantId);
  if (!id) return getPrismaClient();
  const env = options.env || process.env;
  const datasourceUrl = resolveTenantScopedDatasourceUrl(id, options);
  const defaultDatasourceUrl = buildManagedDatasourceUrl(options.databaseUrl || process.env.DATABASE_URL);
  if (!datasourceUrl || datasourceUrl === defaultDatasourceUrl) {
    return getPrismaClient();
  }
  if (shouldAutoProvisionTenantDatabaseTarget({
    env,
    autoProvision: options.autoProvision,
    isTestRuntime: isNodeTestRuntime(),
  })) {
    ensureTenantDatabaseTargetProvisioned(id, {
      env,
      databaseUrl: options.databaseUrl || env.DATABASE_URL,
      mode: options.mode || env.TENANT_DB_TOPOLOGY_MODE,
      provider: options.provider || env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
    });
  }
  if (options.cache === false || options.transient === true) {
    return createScopedPrismaClient(datasourceUrl, getScopedClientPoolOptions({
      connectionLimit: normalizeText(process.env.PRISMA_TRANSIENT_SCOPED_CONNECTION_LIMIT) || '1',
      poolTimeout: normalizeText(process.env.PRISMA_TRANSIENT_SCOPED_POOL_TIMEOUT) || '10',
    }));
  }
  return getScopedPrismaClient(datasourceUrl);
}

async function withTenantScopedPrismaClient(tenantId, options, work) {
  let runtimeOptions = options;
  let callback = work;
  if (typeof runtimeOptions === 'function') {
    callback = runtimeOptions;
    runtimeOptions = {};
  }
  if (typeof callback !== 'function') {
    throw new TypeError('withTenantScopedPrismaClient requires a callback');
  }
  const normalizedOptions = runtimeOptions && typeof runtimeOptions === 'object'
    ? runtimeOptions
    : {};
  const client = getTenantScopedPrismaClient(tenantId, normalizedOptions);
  const shouldDisconnectClient = client !== getPrismaClient()
    && (normalizedOptions.cache === false || normalizedOptions.transient === true);
  try {
    return await callback(client);
  } finally {
    if (shouldDisconnectClient && typeof client?.$disconnect === 'function') {
      await client.$disconnect().catch(() => {});
    }
  }
}

function getDefaultTenantScopedPrismaClient(options = {}) {
  const tenantId = resolveDefaultTenantId(options);
  if (!tenantId) return getPrismaClient();
  return getTenantScopedPrismaClient(tenantId, options);
}

async function disconnectPrismaClient() {
  if (!cachedClient) return;
  const client = cachedClient;
  cachedClient = null;
  cachedKey = '';
  await client.$disconnect();
}

async function disconnectAllPrismaClients() {
  const disconnects = [];
  if (cachedClient) {
    disconnects.push(disconnectPrismaClient());
  }
  for (const client of scopedClientCache.values()) {
    disconnects.push(client.$disconnect().catch(() => {}));
  }
  scopedClientCache.clear();
  clearProvisionedTenantDatabaseTargets();
  await Promise.all(disconnects);
}

const prisma = new Proxy({}, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set(_target, property, value) {
    const client = getPrismaClient();
    client[property] = value;
    return true;
  },
  has(_target, property) {
    const client = getPrismaClient();
    return property in client;
  },
  ownKeys() {
    return Reflect.ownKeys(getPrismaClient());
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Object.getOwnPropertyDescriptor(getPrismaClient(), property);
    if (descriptor) return descriptor;
    return {
      configurable: true,
      enumerable: true,
      writable: false,
      value: getPrismaClient()[property],
    };
  },
});

module.exports = {
  prisma,
  SOURCE_SCHEMA_PATH,
  getPrismaClient,
  getPrismaRuntimeProfile,
  getDefaultTenantScopedPrismaClient,
  getTenantScopedPrismaClient,
  readSourceSchemaProvider,
  withTenantScopedPrismaClient,
  resolveDefaultTenantId,
  resolveTenantScopedDatasourceUrl,
  disconnectPrismaClient,
  disconnectAllPrismaClients,
};
