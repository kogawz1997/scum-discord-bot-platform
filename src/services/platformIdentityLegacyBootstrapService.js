'use strict';

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function escapeSqlLiteral(value) {
  return String(value || '').replaceAll("'", "''");
}

async function queryIdentityTableExists(db, runtime, tableName) {
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

async function queryIdentityColumnExists(db, runtime, tableName, columnName) {
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

async function bootstrapPlatformVerificationTokenColumnsLegacy(db, missingColumns = []) {
  const alterStatements = {
    previewAccountId: 'ALTER TABLE platform_verification_tokens ADD COLUMN previewAccountId TEXT',
    purpose: "ALTER TABLE platform_verification_tokens ADD COLUMN purpose TEXT DEFAULT 'email_verification'",
    tokenType: 'ALTER TABLE platform_verification_tokens ADD COLUMN tokenType TEXT',
    target: 'ALTER TABLE platform_verification_tokens ADD COLUMN target TEXT',
  };

  for (const columnName of missingColumns) {
    const sql = alterStatements[columnName];
    if (!sql) continue;
    try {
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
}

async function bootstrapPlatformUserPasswordColumnLegacy(db) {
  try {
    await db.$executeRawUnsafe('ALTER TABLE platform_users ADD COLUMN passwordHash TEXT');
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message.includes('duplicate column') && !message.includes('already exists') && !message.includes('duplicate_column')) {
      throw error;
    }
  }
}

async function bootstrapPlatformIdentityTablesLegacy(db) {
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
}

module.exports = {
  bootstrapPlatformIdentityTablesLegacy,
  bootstrapPlatformUserPasswordColumnLegacy,
  bootstrapPlatformVerificationTokenColumnsLegacy,
  queryIdentityColumnExists,
  queryIdentityTableExists,
};
