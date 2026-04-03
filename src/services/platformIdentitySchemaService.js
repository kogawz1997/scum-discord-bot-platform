'use strict';

const { prisma } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { resolveLegacyRuntimeBootstrapPolicy } = require('../utils/legacyRuntimeBootstrapPolicy');

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

function escapeSqlLiteral(value) {
  return String(value || '').replaceAll("'", "''");
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

async function queryTableExists(db, runtime, tableName) {
  const escapedTable = escapeSqlLiteral(tableName);
  if (runtime.engine === 'postgresql') {
    const rows = await db.$queryRawUnsafe(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = '${escapedTable}'
      LIMIT 1
    `);
    return Array.isArray(rows) && rows.length > 0;
  }
  if (runtime.engine === 'sqlite') {
    const rows = await db.$queryRawUnsafe(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = '${escapedTable}'
      LIMIT 1
    `);
    return Array.isArray(rows) && rows.length > 0;
  }
  return true;
}

async function queryColumnExists(db, runtime, tableName, columnName) {
  const escapedTable = escapeSqlLiteral(tableName);
  const escapedColumn = escapeSqlLiteral(columnName);
  if (runtime.engine === 'postgresql') {
    const rows = await db.$queryRawUnsafe(`
      SELECT column_name AS name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = '${escapedTable}'
        AND column_name = '${escapedColumn}'
      LIMIT 1
    `);
    return Array.isArray(rows) && rows.length > 0;
  }
  if (runtime.engine === 'sqlite') {
    const rows = await db.$queryRawUnsafe(`PRAGMA table_info('${escapedTable}')`);
    return Array.isArray(rows) && rows.some((row) => trimText(row?.name, 160) === columnName);
  }
  return true;
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
    // eslint-disable-next-line no-await-in-loop
    const exists = await queryTableExists(db, runtime, tableName);
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
  const exists = await queryColumnExists(db, runtime, 'platform_users', 'passwordHash');
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
    // eslint-disable-next-line no-await-in-loop
    const exists = await queryColumnExists(db, runtime, 'platform_verification_tokens', columnName);
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
  const alterStatements = {
    previewAccountId: 'ALTER TABLE platform_verification_tokens ADD COLUMN previewAccountId TEXT',
    purpose: "ALTER TABLE platform_verification_tokens ADD COLUMN purpose TEXT DEFAULT 'email_verification'",
    tokenType: 'ALTER TABLE platform_verification_tokens ADD COLUMN tokenType TEXT',
    target: 'ALTER TABLE platform_verification_tokens ADD COLUMN target TEXT',
  };
  for (const columnName of columnState.missingColumns) {
    const sql = alterStatements[columnName];
    if (!sql) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.$executeRawUnsafe(sql);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (!message.includes('duplicate column') && !message.includes('already exists') && !message.includes('duplicate_column')) {
        throw error;
      }
    }
  }
  await db.$executeRawUnsafe(`
    UPDATE platform_verification_tokens
    SET purpose = COALESCE(NULLIF(purpose, ''), NULLIF(tokenType, ''), 'email_verification')
    WHERE purpose IS NULL OR purpose = ''
  `);
  await db.$executeRawUnsafe(`
    UPDATE platform_verification_tokens
    SET tokenType = COALESCE(NULLIF(tokenType, ''), NULLIF(purpose, ''), 'email_verification')
    WHERE tokenType IS NULL OR tokenType = ''
  `);
  await db.$executeRawUnsafe(`
    UPDATE platform_verification_tokens
    SET target = COALESCE(NULLIF(target, ''), email)
    WHERE (target IS NULL OR target = '')
      AND email IS NOT NULL
  `);
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS platform_verification_tokens_email_hash_key ON platform_verification_tokens(email, tokenHash)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_verification_tokens_preview_exp_idx ON platform_verification_tokens(previewAccountId, expiresAt)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_verification_tokens_user_purpose_exp_idx ON platform_verification_tokens(userId, purpose, expiresAt)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_verification_tokens_email_purpose_exp_idx ON platform_verification_tokens(email, purpose, expiresAt)');
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
  try {
    await db.$executeRawUnsafe('ALTER TABLE platform_users ADD COLUMN passwordHash TEXT');
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message.includes('duplicate column') && !message.includes('already exists') && !message.includes('duplicate_column')) {
      throw error;
    }
  }
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
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      primaryEmail TEXT UNIQUE,
      displayName TEXT,
      passwordHash TEXT,
      locale TEXT NOT NULL DEFAULT 'en',
      status TEXT NOT NULL DEFAULT 'active',
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_user_identities (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerUserId TEXT NOT NULL,
      providerEmail TEXT,
      displayName TEXT,
      avatarUrl TEXT,
      verifiedAt TEXT,
      linkedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS platform_user_identities_provider_providerUserId_key ON platform_user_identities(provider, providerUserId)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_user_identities_userId_linkedAt_idx ON platform_user_identities(userId, linkedAt)');
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_memberships (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tenantId TEXT,
      membershipType TEXT NOT NULL DEFAULT 'tenant',
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      isPrimary INTEGER NOT NULL DEFAULT 0,
      invitedAt TEXT,
      acceptedAt TEXT,
      revokedAt TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_memberships_userId_updatedAt_idx ON platform_memberships(userId, updatedAt)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_memberships_tenantId_role_updatedAt_idx ON platform_memberships(tenantId, role, updatedAt)');
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_password_reset_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT,
      previewAccountId TEXT,
      email TEXT NOT NULL,
      tokenPrefix TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      consumedAt TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS platform_password_reset_tokens_email_hash_key ON platform_password_reset_tokens(email, tokenHash)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_password_reset_tokens_preview_exp_idx ON platform_password_reset_tokens(previewAccountId, expiresAt)');
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_verification_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT,
      previewAccountId TEXT,
      email TEXT,
      purpose TEXT NOT NULL DEFAULT 'email_verification',
      tokenType TEXT,
      tokenPrefix TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      target TEXT,
      expiresAt TEXT NOT NULL,
      consumedAt TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS platform_verification_tokens_email_hash_key ON platform_verification_tokens(email, tokenHash)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_verification_tokens_preview_exp_idx ON platform_verification_tokens(previewAccountId, expiresAt)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_verification_tokens_user_purpose_exp_idx ON platform_verification_tokens(userId, purpose, expiresAt)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_verification_tokens_email_purpose_exp_idx ON platform_verification_tokens(email, purpose, expiresAt)');
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_player_profiles (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tenantId TEXT,
      discordUserId TEXT,
      steamId TEXT,
      inGameName TEXT,
      verificationState TEXT NOT NULL DEFAULT 'unverified',
      linkedAt TEXT,
      lastSeenAt TEXT,
      metadataJson TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_player_profiles_userId_updatedAt_idx ON platform_player_profiles(userId, updatedAt)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_player_profiles_tenantId_steamId_idx ON platform_player_profiles(tenantId, steamId)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_player_profiles_tenantId_discordUserId_idx ON platform_player_profiles(tenantId, discordUserId)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_player_profiles_verificationState_updatedAt_idx ON platform_player_profiles(verificationState, updatedAt)');
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
