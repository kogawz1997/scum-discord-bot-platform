'use strict';

const crypto = require('node:crypto');

const { prisma } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');

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

function normalizeEmail(value) {
  return trimText(value, 200).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'platform') {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function createRawToken(prefix = 'rst') {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}.${crypto.randomBytes(20).toString('hex')}`;
}

function escapeSqlLiteral(value) {
  return String(value || '').replaceAll("'", "''");
}

function getIdentitySchemaCacheKey(env = process.env) {
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  return JSON.stringify({
    engine: runtime.engine,
    provider: runtime.provider,
    rawUrl: runtime.rawUrl,
    nodeEnv: trimText(env.NODE_ENV, 32).toLowerCase(),
    runtimeBootstrap: trimText(env[PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV], 32).toLowerCase(),
  });
}

function isRuntimeIdentityBootstrapAllowed(env = process.env) {
  const explicit = trimText(env[PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV], 32).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(explicit)) return true;
  if (['0', 'false', 'no', 'off'].includes(explicit)) return false;
  const nodeEnv = trimText(env.NODE_ENV, 32).toLowerCase();
  return nodeEnv !== 'production';
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
  const cacheKey = getIdentitySchemaCacheKey(env);
  if (cachedIdentitySchemaKey === cacheKey && cachedIdentitySchemaState) {
    return cachedIdentitySchemaState;
  }
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const missingTables = [];
  for (const tableName of PLATFORM_IDENTITY_TABLES) {
    const exists = await queryTableExists(db, runtime, tableName);
    if (!exists) {
      missingTables.push(tableName);
    }
  }
  const state = Object.freeze({
    runtime,
    missingTables,
    ready: missingTables.length === 0,
    runtimeBootstrapAllowed: isRuntimeIdentityBootstrapAllowed(env),
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
  const cacheKey = getIdentitySchemaCacheKey(env);
  if (cachedPlatformUserPasswordColumnKey === cacheKey && cachedPlatformUserPasswordColumnState) {
    return cachedPlatformUserPasswordColumnState;
  }
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const exists = await queryColumnExists(db, runtime, 'platform_users', 'passwordHash');
  const state = Object.freeze({
    runtime,
    exists,
    runtimeBootstrapAllowed: isRuntimeIdentityBootstrapAllowed(env),
  });
  cachedPlatformUserPasswordColumnKey = cacheKey;
  cachedPlatformUserPasswordColumnState = state;
  return state;
}

async function getVerificationTokenColumnState(db = prisma, env = process.env) {
  const cacheKey = getIdentitySchemaCacheKey(env);
  if (cachedVerificationTokenColumnKey === cacheKey && cachedVerificationTokenColumnState) {
    return cachedVerificationTokenColumnState;
  }
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const requiredColumns = ['previewAccountId', 'purpose', 'tokenType', 'target'];
  const missingColumns = [];
  for (const columnName of requiredColumns) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await queryColumnExists(db, runtime, 'platform_verification_tokens', columnName);
    if (!exists) {
      missingColumns.push(columnName);
    }
  }
  const state = Object.freeze({
    runtime,
    missingColumns,
    ready: missingColumns.length === 0,
    runtimeBootstrapAllowed: isRuntimeIdentityBootstrapAllowed(env),
  });
  cachedVerificationTokenColumnKey = cacheKey;
  cachedVerificationTokenColumnState = state;
  return state;
}

async function ensurePlatformVerificationTokenColumns(db = prisma, options = {}) {
  const env = options.env || process.env;
  const columnState = await getVerificationTokenColumnState(db, env);
  if (columnState.ready) {
    return {
      ok: true,
      bootstrapped: false,
      columns: columnState,
    };
  }
  if (!columnState.runtimeBootstrapAllowed) {
    throw buildIdentityVerificationTokenSchemaRequiredError({
      table: 'platform_verification_tokens',
      missingColumns: columnState.missingColumns,
      runtime: columnState.runtime,
      env: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
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
      if (
        !message.includes('duplicate column')
        && !message.includes('already exists')
        && !message.includes('duplicate_column')
      ) {
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
    return {
      ok: true,
      bootstrapped: false,
      column: passwordColumnState,
    };
  }
  if (!passwordColumnState.runtimeBootstrapAllowed) {
    throw buildIdentityPasswordColumnRequiredError({
      column: 'platform_users.passwordHash',
      runtime: passwordColumnState.runtime,
      env: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
    });
  }
  try {
    await db.$executeRawUnsafe('ALTER TABLE platform_users ADD COLUMN passwordHash TEXT');
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (
      !message.includes('duplicate column')
      && !message.includes('already exists')
      && !message.includes('duplicate_column')
    ) {
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
    return {
      ok: true,
      bootstrapped: false,
      schema: schemaState,
    };
  }
  if (!schemaState.runtimeBootstrapAllowed) {
    throw buildIdentitySchemaRequiredError({
      missingTables: schemaState.missingTables,
      runtime: schemaState.runtime,
      env: PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP_ENV,
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

function parseJsonObject(value) {
  if (value == null || String(value).trim() === '') return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRowLookupKey(value) {
  return String(value || '')
    .trim()
    .replace(/[_\s-]+/g, '')
    .toLowerCase();
}

function getRowValue(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined) {
      return row[key];
    }
  }
  const lookup = new Map();
  for (const [key, value] of Object.entries(row)) {
    lookup.set(normalizeRowLookupKey(key), value);
  }
  for (const key of keys) {
    const resolved = lookup.get(normalizeRowLookupKey(key));
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    primaryEmail: normalizeEmail(getRowValue(row, 'primaryEmail')),
    displayName: trimText(getRowValue(row, 'displayName'), 200) || null,
    locale: trimText(getRowValue(row, 'locale'), 16) || 'en',
    status: trimText(getRowValue(row, 'status'), 40) || 'active',
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizeIdentityRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    provider: trimText(getRowValue(row, 'provider'), 80) || null,
    providerUserId: trimText(getRowValue(row, 'providerUserId'), 200) || null,
    providerEmail: normalizeEmail(getRowValue(row, 'providerEmail')),
    displayName: trimText(getRowValue(row, 'displayName'), 200) || null,
    avatarUrl: trimText(getRowValue(row, 'avatarUrl'), 600) || null,
    verifiedAt: getRowValue(row, 'verifiedAt') ? new Date(getRowValue(row, 'verifiedAt')).toISOString() : null,
    linkedAt: getRowValue(row, 'linkedAt') ? new Date(getRowValue(row, 'linkedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
  };
}

function normalizeMembershipRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    tenantId: trimText(getRowValue(row, 'tenantId'), 160) || null,
    membershipType: trimText(getRowValue(row, 'membershipType'), 80) || 'tenant',
    role: trimText(getRowValue(row, 'role'), 80) || 'member',
    status: trimText(getRowValue(row, 'status'), 40) || 'active',
    isPrimary: getRowValue(row, 'isPrimary') === true || Number(getRowValue(row, 'isPrimary')) === 1,
    acceptedAt: getRowValue(row, 'acceptedAt') ? new Date(getRowValue(row, 'acceptedAt')).toISOString() : null,
    revokedAt: getRowValue(row, 'revokedAt') ? new Date(getRowValue(row, 'revokedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizePlayerProfileRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    tenantId: trimText(getRowValue(row, 'tenantId'), 160) || null,
    discordUserId: trimText(getRowValue(row, 'discordUserId'), 200) || null,
    steamId: trimText(getRowValue(row, 'steamId'), 200) || null,
    inGameName: trimText(getRowValue(row, 'inGameName'), 200) || null,
    verificationState: trimText(getRowValue(row, 'verificationState'), 80) || 'unverified',
    linkedAt: getRowValue(row, 'linkedAt') ? new Date(getRowValue(row, 'linkedAt')).toISOString() : null,
    lastSeenAt: getRowValue(row, 'lastSeenAt') ? new Date(getRowValue(row, 'lastSeenAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizeTokenRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    previewAccountId: trimText(getRowValue(row, 'previewAccountId'), 160) || null,
    email: normalizeEmail(getRowValue(row, 'email')) || null,
    purpose: trimText(getRowValue(row, 'purpose'), 80) || null,
    tokenPrefix: trimText(getRowValue(row, 'tokenPrefix'), 120) || null,
    expiresAt: getRowValue(row, 'expiresAt') ? new Date(getRowValue(row, 'expiresAt')).toISOString() : null,
    consumedAt: getRowValue(row, 'consumedAt') ? new Date(getRowValue(row, 'consumedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

async function findUserById(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, primaryEmail, displayName, locale, status, metadataJson, createdAt, updatedAt
    FROM platform_users
    WHERE id = ${normalizedUserId}
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function findUserByPrimaryEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, primaryEmail, displayName, locale, status, metadataJson, createdAt, updatedAt
    FROM platform_users
    WHERE primaryEmail = ${normalizedEmail}
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function findIdentityByProvider(db, provider, providerUserId) {
  const normalizedProvider = trimText(provider, 80).toLowerCase();
  const normalizedProviderUserId = trimText(providerUserId, 200);
  if (!normalizedProvider || !normalizedProviderUserId) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, userId, provider, providerUserId, providerEmail, displayName, avatarUrl, verifiedAt, linkedAt, metadataJson
    FROM platform_user_identities
    WHERE provider = ${normalizedProvider}
      AND providerUserId = ${normalizedProviderUserId}
    LIMIT 1
  `;
  return normalizeIdentityRow(Array.isArray(rows) ? rows[0] : null);
}

async function findMembership(db, userId, tenantId, membershipType = 'tenant') {
  const normalizedUserId = trimText(userId, 160);
  const normalizedTenantId = trimText(tenantId, 160);
  const normalizedMembershipType = trimText(membershipType, 80) || 'tenant';
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, userId, tenantId, membershipType, role, status, isPrimary, acceptedAt, revokedAt, metadataJson, createdAt, updatedAt
    FROM platform_memberships
    WHERE userId = ${normalizedUserId}
      AND membershipType = ${normalizedMembershipType}
      AND (
        (${normalizedTenantId} IS NULL AND tenantId IS NULL)
        OR tenantId = ${normalizedTenantId}
      )
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizeMembershipRow(Array.isArray(rows) ? rows[0] : null);
}

async function listIdentitiesForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return [];
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, userId, provider, providerUserId, providerEmail, displayName, avatarUrl, verifiedAt, linkedAt, metadataJson
    FROM platform_user_identities
    WHERE userId = ${normalizedUserId}
    ORDER BY linkedAt ASC
  `;
  return Array.isArray(rows) ? rows.map(normalizeIdentityRow).filter(Boolean) : [];
}

async function listMembershipsForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return [];
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, userId, tenantId, membershipType, role, status, isPrimary, acceptedAt, revokedAt, metadataJson, createdAt, updatedAt
    FROM platform_memberships
    WHERE userId = ${normalizedUserId}
    ORDER BY updatedAt DESC
  `;
  return Array.isArray(rows) ? rows.map(normalizeMembershipRow).filter(Boolean) : [];
}

async function findPlayerProfile(db, userId, tenantId = null) {
  const normalizedUserId = trimText(userId, 160);
  const normalizedTenantId = trimText(tenantId, 160) || null;
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT
      id,
      userId,
      tenantId,
      discordUserId,
      steamId,
      inGameName,
      verificationState,
      linkedAt,
      lastSeenAt,
      metadataJson,
      createdAt,
      updatedAt
    FROM platform_player_profiles
    WHERE userId = ${normalizedUserId}
      AND (
        (CAST(${normalizedTenantId} AS TEXT) IS NULL AND tenantId IS NULL)
        OR tenantId = CAST(${normalizedTenantId} AS TEXT)
      )
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizePlayerProfileRow(Array.isArray(rows) ? rows[0] : null);
}

async function findPlayerProfileByExternalIds(db, input = {}) {
  const tenantId = trimText(input.tenantId, 160) || null;
  const discordUserId = trimText(input.discordUserId, 200) || null;
  const steamId = trimText(input.steamId, 200) || null;
  if (!discordUserId && !steamId) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT
      id,
      userId,
      tenantId,
      discordUserId,
      steamId,
      inGameName,
      verificationState,
      linkedAt,
      lastSeenAt,
      metadataJson,
      createdAt,
      updatedAt
    FROM platform_player_profiles
    WHERE (CAST(${tenantId} AS TEXT) IS NULL OR tenantId = CAST(${tenantId} AS TEXT))
      AND (
        (CAST(${discordUserId} AS TEXT) IS NOT NULL AND discordUserId = CAST(${discordUserId} AS TEXT))
        OR (CAST(${steamId} AS TEXT) IS NOT NULL AND steamId = CAST(${steamId} AS TEXT))
      )
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizePlayerProfileRow(Array.isArray(rows) ? rows[0] : null);
}

async function ensurePlatformUserIdentity(input = {}, db = prisma) {
  const provider = trimText(input.provider || 'email_preview', 80).toLowerCase();
  const providerUserId = trimText(input.providerUserId || input.email, 200);
  const email = normalizeEmail(input.email || input.providerEmail);
  const displayName = trimText(input.displayName, 200) || null;
  const locale = trimText(input.locale, 16) || 'en';
  const tenantId = trimText(input.tenantId, 160) || null;
  const role = trimText(input.role, 80) || 'owner';
  const membershipType = trimText(input.membershipType, 80) || (tenantId ? 'tenant' : 'preview');
  const hasVerifiedAt = Object.prototype.hasOwnProperty.call(input, 'verifiedAt');
  const verifiedAt = !hasVerifiedAt
    ? nowIso()
    : input.verifiedAt
      ? new Date(input.verifiedAt).toISOString()
      : null;
  const identityMetadata = input.identityMetadata && typeof input.identityMetadata === 'object' && !Array.isArray(input.identityMetadata)
    ? input.identityMetadata
    : {};
  const membershipMetadata = input.membershipMetadata && typeof input.membershipMetadata === 'object' && !Array.isArray(input.membershipMetadata)
    ? input.membershipMetadata
    : {};
  const preferredUserId = trimText(input.preferredUserId, 160) || null;

  if (!provider || !providerUserId) {
    return { ok: false, reason: 'identity-provider-required' };
  }

  await ensurePlatformIdentityTables(db);
  let identity = await findIdentityByProvider(db, provider, providerUserId);
  let user = identity ? await findUserById(db, identity.userId) : null;

  if (!user && email) {
    user = await findUserByPrimaryEmail(db, email);
  }
  if (!user && preferredUserId) {
    user = await findUserById(db, preferredUserId);
  }

  if (!user) {
    const userId = createId('user');
    await db.$executeRaw`
      INSERT INTO platform_users (
        id, primaryEmail, displayName, locale, status, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${userId},
        ${email || null},
        ${displayName},
        ${locale},
        ${'active'},
        ${JSON.stringify(input.userMetadata && typeof input.userMetadata === 'object' ? input.userMetadata : {})},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    user = await findUserByPrimaryEmail(db, email) || {
      id: userId,
      primaryEmail: email || null,
      displayName,
      locale,
      status: 'active',
      metadata: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  } else {
    await db.$executeRaw`
      UPDATE platform_users
      SET
        primaryEmail = COALESCE(${email || null}, primaryEmail),
        displayName = COALESCE(${displayName}, displayName),
        locale = COALESCE(${locale}, locale),
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;
    user = await findUserByPrimaryEmail(db, email || user.primaryEmail) || user;
  }

  if (!identity) {
    const identityId = createId('ident');
    await db.$executeRaw`
      INSERT INTO platform_user_identities (
        id, userId, provider, providerUserId, providerEmail, displayName, avatarUrl, verifiedAt, linkedAt, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${identityId},
        ${user.id},
        ${provider},
        ${providerUserId},
        ${email || null},
        ${displayName},
        ${trimText(input.avatarUrl, 600) || null},
        ${verifiedAt},
        CURRENT_TIMESTAMP,
        ${JSON.stringify(identityMetadata)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    identity = await findIdentityByProvider(db, provider, providerUserId);
  } else {
    await db.$executeRaw`
      UPDATE platform_user_identities
      SET
        userId = ${user.id},
        providerEmail = COALESCE(${email || null}, providerEmail),
        displayName = COALESCE(${displayName}, displayName),
        avatarUrl = COALESCE(${trimText(input.avatarUrl, 600) || null}, avatarUrl),
        verifiedAt = COALESCE(${verifiedAt}, verifiedAt),
        metadataJson = ${JSON.stringify(identityMetadata)},
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${identity.id}
    `;
    identity = await findIdentityByProvider(db, provider, providerUserId);
  }

  let membership = null;
  if (tenantId || membershipType === 'preview') {
    membership = await findMembership(db, user.id, tenantId, membershipType);
    if (!membership) {
      const membershipId = createId('mship');
      await db.$executeRaw`
        INSERT INTO platform_memberships (
          id, userId, tenantId, membershipType, role, status, isPrimary, acceptedAt, metadataJson, createdAt, updatedAt
        )
        VALUES (
          ${membershipId},
          ${user.id},
          ${tenantId},
          ${membershipType},
          ${role},
          ${'active'},
          ${1},
          CURRENT_TIMESTAMP,
          ${JSON.stringify(membershipMetadata)},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      membership = await findMembership(db, user.id, tenantId, membershipType);
    } else {
      await db.$executeRaw`
        UPDATE platform_memberships
        SET
          role = COALESCE(${role}, role),
          status = ${'active'},
          isPrimary = CASE WHEN isPrimary = 1 THEN 1 ELSE ${membership.isPrimary ? 1 : 1} END,
          acceptedAt = COALESCE(acceptedAt, CAST(CURRENT_TIMESTAMP AS TEXT)),
          metadataJson = ${JSON.stringify(membershipMetadata)},
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${membership.id}
      `;
      membership = await findMembership(db, user.id, tenantId, membershipType);
    }
  }

  return {
    ok: true,
    user,
    identity,
    membership,
    identities: await listIdentitiesForUser(db, user.id),
    memberships: await listMembershipsForUser(db, user.id),
  };
}

async function upsertPlatformPlayerProfile(input = {}, db = prisma) {
  const userId = trimText(input.userId, 160);
  const tenantId = trimText(input.tenantId, 160) || null;
  const discordUserId = trimText(input.discordUserId, 200) || null;
  const steamId = trimText(input.steamId, 200) || null;
  const inGameName = trimText(input.inGameName, 200) || null;
  const verificationState = trimText(input.verificationState, 80) || 'unverified';
  const linkedAt = input.linkedAt ? new Date(input.linkedAt).toISOString() : null;
  const lastSeenAt = input.lastSeenAt ? new Date(input.lastSeenAt).toISOString() : nowIso();
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
    ? input.metadata
    : {};

  if (!userId) {
    return { ok: false, reason: 'player-profile-user-required' };
  }

  await ensurePlatformIdentityTables(db);
  let existing = await findPlayerProfile(db, userId, tenantId);
  if (!existing) {
    const profileId = createId('pprof');
    await db.$executeRaw`
      INSERT INTO platform_player_profiles (
        id, userId, tenantId, discordUserId, steamId, inGameName, verificationState, linkedAt, lastSeenAt, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${profileId},
        ${userId},
        ${tenantId},
        ${discordUserId},
        ${steamId},
        ${inGameName},
        ${verificationState},
        ${linkedAt || nowIso()},
        ${lastSeenAt},
        ${JSON.stringify(metadata)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    existing = await findPlayerProfile(db, userId, tenantId);
  } else {
    await db.$executeRaw`
      UPDATE platform_player_profiles
      SET
        discordUserId = COALESCE(${discordUserId}, discordUserId),
        steamId = COALESCE(${steamId}, steamId),
        inGameName = COALESCE(${inGameName}, inGameName),
        verificationState = COALESCE(${verificationState}, verificationState),
        linkedAt = COALESCE(${linkedAt}, linkedAt),
        lastSeenAt = COALESCE(${lastSeenAt}, lastSeenAt),
        metadataJson = ${JSON.stringify(metadata)},
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${existing.id}
    `;
    existing = await findPlayerProfile(db, userId, tenantId);
  }

  return {
    ok: true,
    profile: existing,
  };
}

async function ensurePlatformPlayerIdentity(input = {}, db = prisma) {
  const existingProfile = await findPlayerProfileByExternalIds(db, input);
  const discordIdentity = !existingProfile && input.provider !== 'discord' && input.discordUserId
    ? await findIdentityByProvider(db, 'discord', input.discordUserId)
    : null;
  const steamIdentity = !existingProfile && input.provider !== 'steam' && input.steamId
    ? await findIdentityByProvider(db, 'steam', input.steamId)
    : null;
  const preferredUserId = existingProfile?.userId || discordIdentity?.userId || steamIdentity?.userId || null;
  const identity = await ensurePlatformUserIdentity({
    provider: input.provider,
    providerUserId: input.providerUserId,
    preferredUserId,
    email: input.email,
    providerEmail: input.providerEmail,
    displayName: input.displayName,
    locale: input.locale,
    tenantId: input.tenantId,
    role: input.role || 'player',
    membershipType: input.membershipType || (input.tenantId ? 'tenant' : 'player'),
    verifiedAt: input.verifiedAt,
    avatarUrl: input.avatarUrl,
    userMetadata: input.userMetadata,
    identityMetadata: input.identityMetadata,
    membershipMetadata: input.membershipMetadata,
  }, db);
  if (!identity?.ok || !identity.user?.id) {
    return identity;
  }
  const profile = await upsertPlatformPlayerProfile({
    userId: identity.user.id,
    tenantId: input.tenantId,
    discordUserId: input.discordUserId || (input.provider === 'discord' ? input.providerUserId : null),
    steamId: input.steamId || (input.provider === 'steam' ? input.providerUserId : null),
    inGameName: input.inGameName,
    verificationState: input.verificationState,
    linkedAt: input.linkedAt,
    lastSeenAt: input.lastSeenAt,
    metadata: input.profileMetadata,
  }, db);
  return {
    ...identity,
    profile: profile?.profile || null,
  };
}

async function getIdentitySummaryForPreviewAccount(account = {}, db = prisma) {
  const email = normalizeEmail(account.email);
  const previewAccountId = trimText(account.id, 160);
  if (!email && !previewAccountId) return null;
  await ensurePlatformIdentityTables(db);
  const user = email ? await findUserByPrimaryEmail(db, email) : null;
  if (!user) return null;
  return {
    user,
    identities: await listIdentitiesForUser(db, user.id),
    memberships: await listMembershipsForUser(db, user.id),
    previewAccountId: previewAccountId || null,
  };
}

async function issuePasswordResetToken(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: 'invalid-email' };
  await ensurePlatformIdentityTables(db);
  const rawToken = createRawToken('rst');
  const tokenHash = sha256(rawToken);
  const tokenPrefix = rawToken.split('.')[0];
  const ttlMinutes = Math.max(5, Math.min(24 * 60, Number(input.ttlMinutes || 30) || 30));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const rowId = createId('rst');
  await db.$executeRaw`
    INSERT INTO platform_password_reset_tokens (
      id, userId, previewAccountId, email, tokenPrefix, tokenHash, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${rowId},
      ${trimText(input.userId, 160) || null},
      ${trimText(input.previewAccountId, 160) || null},
      ${email},
      ${tokenPrefix},
      ${tokenHash},
      ${expiresAt},
      ${null},
      ${JSON.stringify(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return {
    ok: true,
    rawToken,
    token: {
      id: rowId,
      email,
      tokenPrefix,
      expiresAt,
    },
  };
}

async function issueEmailVerificationToken(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: 'invalid-email' };
  await ensurePlatformIdentityTables(db);
  const rawToken = createRawToken('vfy');
  const tokenHash = sha256(rawToken);
  const tokenPrefix = rawToken.split('.')[0];
  const ttlMinutes = Math.max(5, Math.min(7 * 24 * 60, Number(input.ttlMinutes || 60) || 60));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const rowId = createId('vfy');
  await db.$executeRaw`
    INSERT INTO platform_verification_tokens (
      id, userId, previewAccountId, email, purpose, tokenType, tokenPrefix, tokenHash, target, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${rowId},
      ${trimText(input.userId, 160) || null},
      ${trimText(input.previewAccountId, 160) || null},
      ${email},
      ${'email_verification'},
      ${'email_verification'},
      ${tokenPrefix},
      ${tokenHash},
      ${email},
      ${expiresAt},
      ${null},
      ${JSON.stringify(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return {
    ok: true,
    rawToken,
    token: {
      id: rowId,
      email,
      purpose: 'email_verification',
      tokenPrefix,
      expiresAt,
    },
  };
}

async function findPasswordResetTokenByHash(db, tokenHash, email = null) {
  const normalizedHash = trimText(tokenHash, 120);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedHash) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, userId, previewAccountId, email, tokenPrefix, tokenHash, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
    FROM platform_password_reset_tokens
    WHERE tokenHash = ${normalizedHash}
      AND (${normalizedEmail} IS NULL OR email = ${normalizedEmail})
    ORDER BY createdAt DESC
    LIMIT 1
  `;
  return normalizeTokenRow(Array.isArray(rows) ? rows[0] : null);
}

async function findVerificationTokenByHash(db, tokenHash, purpose = 'email_verification', email = null) {
  const normalizedHash = trimText(tokenHash, 120);
  const normalizedPurpose = trimText(purpose, 80) || 'email_verification';
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedHash) return null;
  await ensurePlatformIdentityTables(db);
  const rows = await db.$queryRaw`
    SELECT id, userId, previewAccountId, email, purpose, tokenPrefix, tokenHash, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
    FROM platform_verification_tokens
    WHERE tokenHash = ${normalizedHash}
      AND purpose = ${normalizedPurpose}
      AND (${normalizedEmail} IS NULL OR email = ${normalizedEmail})
    ORDER BY createdAt DESC
    LIMIT 1
  `;
  return normalizeTokenRow(Array.isArray(rows) ? rows[0] : null);
}

function validateConsumableToken(tokenRow, now = new Date()) {
  if (!tokenRow) return { ok: false, reason: 'token-not-found' };
  if (tokenRow.consumedAt) return { ok: false, reason: 'token-already-used' };
  const expiresAt = tokenRow.expiresAt ? new Date(tokenRow.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'token-expired' };
  }
  return { ok: true };
}

async function completePasswordReset(input = {}, db = prisma) {
  const rawToken = trimText(input.token || input.rawToken, 512);
  const email = normalizeEmail(input.email);
  if (!rawToken) return { ok: false, reason: 'token-required' };
  const token = await findPasswordResetTokenByHash(db, sha256(rawToken), email);
  const tokenCheck = validateConsumableToken(token);
  if (!tokenCheck.ok) return tokenCheck;
  const consumedAt = nowIso();
  await db.$executeRaw`
    UPDATE platform_password_reset_tokens
    SET
      consumedAt = ${consumedAt},
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${token.id}
  `;
  return {
    ok: true,
    token: {
      ...token,
      consumedAt,
    },
  };
}

async function completeEmailVerification(input = {}, db = prisma) {
  const rawToken = trimText(input.token || input.rawToken, 512);
  const email = normalizeEmail(input.email);
  if (!rawToken) return { ok: false, reason: 'token-required' };
  const token = await findVerificationTokenByHash(db, sha256(rawToken), 'email_verification', email);
  const tokenCheck = validateConsumableToken(token);
  if (!tokenCheck.ok) return tokenCheck;
  const consumedAt = nowIso();
  await db.$executeRaw`
    UPDATE platform_verification_tokens
    SET
      consumedAt = ${consumedAt},
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${token.id}
  `;
  if (token.userId || token.email) {
    await db.$executeRaw`
      UPDATE platform_users
      SET
        primaryEmail = COALESCE(primaryEmail, ${token.email || null}),
        updatedAt = CURRENT_TIMESTAMP
      WHERE (${token.userId || null} IS NOT NULL AND id = ${token.userId || null})
         OR (${token.userId || null} IS NULL AND primaryEmail = ${token.email || null})
    `;
    await db.$executeRaw`
      UPDATE platform_user_identities
      SET
        verifiedAt = COALESCE(verifiedAt, ${consumedAt}),
        updatedAt = CURRENT_TIMESTAMP
      WHERE (
        (${token.userId || null} IS NOT NULL AND userId = ${token.userId || null})
        OR (${token.email || null} IS NOT NULL AND providerEmail = ${token.email || null})
      )
        AND (provider = 'email_preview' OR providerEmail = ${token.email || null})
    `;
  }
  return {
    ok: true,
    verification: {
      ...token,
      consumedAt,
    },
  };
}

module.exports = {
  completeEmailVerification,
  completePasswordReset,
  ensurePlatformIdentityTables,
  ensurePlatformPlayerIdentity,
  ensurePlatformUserPasswordColumn,
  ensurePlatformUserIdentity,
  getPlatformUserPasswordColumnState,
  getIdentitySummaryForPreviewAccount,
  invalidateIdentitySchemaCaches,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  upsertPlatformPlayerProfile,
};
