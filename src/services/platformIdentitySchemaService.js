'use strict';

const { prisma } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { resolveLegacyRuntimeBootstrapPolicy } = require('../utils/legacyRuntimeBootstrapPolicy');
const {
  bootstrapPlatformIdentityTablesLegacy,
  bootstrapPlatformUserPasswordColumnLegacy,
  bootstrapPlatformVerificationTokenColumnsLegacy,
  queryIdentityColumnExists,
  queryIdentityTableExists,
} = require('./platformIdentityLegacyBootstrapService');

const PLATFORM_IDENTITY_TABLES = Object.freeze([
  'platform_users',
  'platform_user_identities',
  'platform_memberships',
  'platform_password_reset_tokens',
  'platform_verification_tokens',
  'platform_player_profiles',
]);

const PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV = 'PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP';

let cachedIdentitySchemaState = null;
let cachedIdentitySchemaKey = '';
let cachedPlatformUserPasswordColumnState = null;
let cachedPlatformUserPasswordColumnKey = '';
let cachedVerificationTokenColumnState = null;
let cachedVerificationTokenColumnKey = '';

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function isPrismaClientLike(db) {
  return Boolean(
    db
    && typeof db === 'object'
    && typeof db.$transaction === 'function'
    && typeof db.$disconnect === 'function',
  );
}

function getIdentityDelegates(db) {
  if (!db || typeof db !== 'object') return null;
  const delegates = [
    db.platformUser,
    db.platformUserIdentity,
    db.platformMembership,
    db.platformPlayerProfile,
    db.platformVerificationToken,
    db.platformPasswordResetToken,
  ];
  return delegates.every((delegate) => delegate && typeof delegate === 'object')
    ? delegates
    : null;
}

function hasExplicitDelegateBackedIdentityPersistence(db, runtime) {
  if (!getIdentityDelegates(db)) return false;
  if (!runtime?.isServerEngine && isPrismaClientLike(db)) {
    return false;
  }
  return true;
}

function getIdentitySchemaCacheKey(env = process.env, db = prisma) {
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const bootstrapPolicy = resolveIdentityRuntimeBootstrapPolicy(env, db, runtime);
  const persistenceTarget = hasExplicitDelegateBackedIdentityPersistence(db, runtime)
    ? 'delegate'
    : isPrismaClientLike(db)
      ? 'prisma-client'
      : 'raw';
  return JSON.stringify({
    engine: runtime.engine,
    provider: runtime.provider,
    rawUrl: runtime.rawUrl,
    nodeEnv: trimText(env.NODE_ENV, 32).toLowerCase(),
    runtimeBootstrap: bootstrapPolicy.explicitValue || '',
    runtimeBootstrapAllowed: bootstrapPolicy.allowed,
    runtimeBootstrapReason: bootstrapPolicy.reason,
    persistenceTarget,
  });
}

function resolveIdentityRuntimeBootstrapPolicy(env = process.env, db = prisma, runtime = null) {
  const effectiveRuntime = runtime || resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  return resolveLegacyRuntimeBootstrapPolicy({
    env,
    envName: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
    runtime: effectiveRuntime,
    prismaClientLike: isPrismaClientLike(db),
    policy: 'platform-identity-schema',
  });
}

function buildIdentitySchemaRequiredError(details = {}) {
  const error = new Error(
    'Platform identity schema is not ready. Run the database migrations or temporarily enable runtime bootstrap for local/dev.',
  );
  error.code = 'PLATFORM_IDENTITY_SCHEMA_REQUIRED';
  error.statusCode = 500;
  error.identitySchema = details;
  return error;
}

function buildIdentityPasswordColumnRequiredError(details = {}) {
  const error = new Error(
    'Platform identity auth schema is not ready. The platform_users.passwordHash column is required before enabling password-based auth.',
  );
  error.code = 'PLATFORM_IDENTITY_PASSWORD_COLUMN_REQUIRED';
  error.statusCode = 500;
  error.identitySchema = details;
  return error;
}

function buildIdentityVerificationTokenSchemaRequiredError(details = {}) {
  const error = new Error(
    'Platform identity token schema is not ready. The platform_verification_tokens compatibility columns are required before enabling workspace auth.',
  );
  error.code = 'PLATFORM_IDENTITY_VERIFICATION_TOKEN_SCHEMA_REQUIRED';
  error.statusCode = 500;
  error.identitySchema = details;
  return error;
}

async function getPlatformIdentitySchemaState(db = prisma, env = process.env) {
  const cacheKey = getIdentitySchemaCacheKey(env, db);
  if (cachedIdentitySchemaKey === cacheKey && cachedIdentitySchemaState) {
    return cachedIdentitySchemaState;
  }
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const runtimeBootstrapPolicy = resolveIdentityRuntimeBootstrapPolicy(env, db, runtime);
  if (hasExplicitDelegateBackedIdentityPersistence(db, runtime)) {
    const state = Object.freeze({
      runtime,
      missingTables: [],
      ready: true,
      runtimeBootstrapAllowed: false,
      runtimeBootstrapPolicy,
      persistenceTarget: 'delegate',
    });
    cachedIdentitySchemaKey = cacheKey;
    cachedIdentitySchemaState = state;
    return state;
  }
  const missingTables = [];
  for (const tableName of PLATFORM_IDENTITY_TABLES) {
    const exists = await queryIdentityTableExists(db, runtime, tableName);
    if (!exists) missingTables.push(tableName);
  }
  const state = Object.freeze({
    runtime,
    missingTables,
    ready: missingTables.length === 0,
    runtimeBootstrapAllowed: runtimeBootstrapPolicy.allowed,
    runtimeBootstrapPolicy,
  });
  cachedIdentitySchemaKey = cacheKey;
  cachedIdentitySchemaState = state;
  return state;
}

function invalidateIdentitySchemaCaches() {
  cachedIdentitySchemaKey = '';
  cachedIdentitySchemaState = null;
  cachedPlatformUserPasswordColumnKey = '';
  cachedPlatformUserPasswordColumnState = null;
  cachedVerificationTokenColumnKey = '';
  cachedVerificationTokenColumnState = null;
}

async function getPlatformUserPasswordColumnState(db = prisma, env = process.env) {
  const cacheKey = getIdentitySchemaCacheKey(env, db);
  if (cachedPlatformUserPasswordColumnKey === cacheKey && cachedPlatformUserPasswordColumnState) {
    return cachedPlatformUserPasswordColumnState;
  }
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const runtimeBootstrapPolicy = resolveIdentityRuntimeBootstrapPolicy(env, db, runtime);
  if (hasExplicitDelegateBackedIdentityPersistence(db, runtime)) {
    const state = Object.freeze({
      runtime,
      exists: true,
      runtimeBootstrapAllowed: false,
      runtimeBootstrapPolicy,
      persistenceTarget: 'delegate',
    });
    cachedPlatformUserPasswordColumnKey = cacheKey;
    cachedPlatformUserPasswordColumnState = state;
    return state;
  }
  const exists = await queryIdentityColumnExists(db, runtime, 'platform_users', 'passwordHash');
  const state = Object.freeze({
    runtime,
    exists,
    runtimeBootstrapAllowed: runtimeBootstrapPolicy.allowed,
    runtimeBootstrapPolicy,
  });
  cachedPlatformUserPasswordColumnKey = cacheKey;
  cachedPlatformUserPasswordColumnState = state;
  return state;
}

async function getVerificationTokenColumnState(db = prisma, env = process.env) {
  const cacheKey = getIdentitySchemaCacheKey(env, db);
  if (cachedVerificationTokenColumnKey === cacheKey && cachedVerificationTokenColumnState) {
    return cachedVerificationTokenColumnState;
  }
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const runtimeBootstrapPolicy = resolveIdentityRuntimeBootstrapPolicy(env, db, runtime);
  if (hasExplicitDelegateBackedIdentityPersistence(db, runtime)) {
    const state = Object.freeze({
      runtime,
      missingColumns: [],
      ready: true,
      runtimeBootstrapAllowed: false,
      runtimeBootstrapPolicy,
      persistenceTarget: 'delegate',
    });
    cachedVerificationTokenColumnKey = cacheKey;
    cachedVerificationTokenColumnState = state;
    return state;
  }
  const requiredColumns = ['previewAccountId', 'purpose', 'tokenType', 'target'];
  const missingColumns = [];
  for (const columnName of requiredColumns) {
    const exists = await queryIdentityColumnExists(db, runtime, 'platform_verification_tokens', columnName);
    if (!exists) missingColumns.push(columnName);
  }
  const state = Object.freeze({
    runtime,
    missingColumns,
    ready: missingColumns.length === 0,
    runtimeBootstrapAllowed: runtimeBootstrapPolicy.allowed,
    runtimeBootstrapPolicy,
  });
  cachedVerificationTokenColumnKey = cacheKey;
  cachedVerificationTokenColumnState = state;
  return state;
}

async function ensurePlatformVerificationTokenColumns(db = prisma, options = {}) {
  const env = options.env || process.env;
  const columnState = await getVerificationTokenColumnState(db, env);
  if (columnState.ready) {
    return { ok: true, bootstrapped: false, columns: columnState };
  }
  if (columnState.runtime?.isServerEngine || !columnState.runtimeBootstrapAllowed) {
    throw buildIdentityVerificationTokenSchemaRequiredError({
      table: 'platform_verification_tokens',
      missingColumns: columnState.missingColumns,
      runtime: columnState.runtime,
      env: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
      bootstrapPolicy: columnState.runtimeBootstrapPolicy,
    });
  }
  await bootstrapPlatformVerificationTokenColumnsLegacy(db, columnState.missingColumns);
  invalidateIdentitySchemaCaches();
  return {
    ok: true,
    bootstrapped: true,
    columns: await getVerificationTokenColumnState(db, env),
  };
}

async function ensurePlatformUserPasswordColumn(db = prisma, options = {}) {
  const env = options.env || process.env;
  await ensurePlatformIdentityTables(db, { env });
  const passwordColumnState = await getPlatformUserPasswordColumnState(db, env);
  if (passwordColumnState.exists) {
    return { ok: true, bootstrapped: false, column: passwordColumnState };
  }
  if (passwordColumnState.runtime?.isServerEngine || !passwordColumnState.runtimeBootstrapAllowed) {
    throw buildIdentityPasswordColumnRequiredError({
      column: 'platform_users.passwordHash',
      runtime: passwordColumnState.runtime,
      env: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
      bootstrapPolicy: passwordColumnState.runtimeBootstrapPolicy,
    });
  }
  await bootstrapPlatformUserPasswordColumnLegacy(db);
  invalidateIdentitySchemaCaches();
  return {
    ok: true,
    bootstrapped: true,
    column: await getPlatformUserPasswordColumnState(db, env),
  };
}

async function ensurePlatformIdentityTables(db = prisma, options = {}) {
  const env = options.env || process.env;
  const schemaState = await getPlatformIdentitySchemaState(db, env);
  if (schemaState.ready) {
    await ensurePlatformVerificationTokenColumns(db, { env });
    return { ok: true, bootstrapped: false, schema: schemaState };
  }
  if (schemaState.runtime?.isServerEngine || !schemaState.runtimeBootstrapAllowed) {
    throw buildIdentitySchemaRequiredError({
      missingTables: schemaState.missingTables,
      runtime: schemaState.runtime,
      env: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
      bootstrapPolicy: schemaState.runtimeBootstrapPolicy,
    });
  }
  await bootstrapPlatformIdentityTablesLegacy(db);
  invalidateIdentitySchemaCaches();
  await ensurePlatformVerificationTokenColumns(db, { env });
  return {
    ok: true,
    bootstrapped: true,
    schema: await getPlatformIdentitySchemaState(db, env),
  };
}

module.exports = {
  PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
  ensurePlatformIdentityTables,
  ensurePlatformUserPasswordColumn,
  getPlatformIdentitySchemaState,
  getPlatformUserPasswordColumnState,
  invalidateIdentitySchemaCaches,
  resolveIdentityRuntimeBootstrapPolicy,
};
