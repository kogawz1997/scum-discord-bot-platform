'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const LOCAL_OWNER_LOGIN_DEFAULTS = Object.freeze({
  username: 'admin',
  password: 'local-owner-dev-password',
  role: 'owner',
  tenantId: null,
});

const DEFAULT_LOCAL_DATABASE_URLS = Object.freeze([
  `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'dev.db').replace(/\\/g, '/')}`,
  `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'test.db').replace(/\\/g, '/')}`,
]);

function createAdminPasswordHash(password) {
  const pass = String(password || '');
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pass, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyAdminPasswordHash(password, passwordHash) {
  const pass = String(password || '');
  const stored = String(passwordHash || '').trim();
  if (!stored.startsWith('scrypt$')) {
    return stored.length > 0 && crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(stored));
  }

  const parts = stored.split('$');
  if (parts.length !== 3) return false;

  let expected;
  let salt;
  try {
    salt = Buffer.from(parts[1], 'hex');
    expected = Buffer.from(parts[2], 'hex');
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;

  const actual = crypto.scryptSync(pass, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function assertLocalSqliteUrl(databaseUrl) {
  const normalized = String(databaseUrl || '').trim().replace(/\\/g, '/').toLowerCase();
  if (!normalized.startsWith('file:')) {
    throw new Error('Refusing to seed local owner login for non-file database URL.');
  }
  if (!normalized.includes('/prisma/prisma/') && !normalized.includes('/appdata/local/temp/')) {
    throw new Error('Refusing to seed local owner login outside local SQLite artifacts.');
  }
}

async function ensureAdminWebUsersTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_web_users (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'mod',
      tenant_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function normalizeSeedInput(input = {}) {
  return {
    username: String(input.username || process.env.LOCAL_OWNER_USERNAME || LOCAL_OWNER_LOGIN_DEFAULTS.username).trim()
      || LOCAL_OWNER_LOGIN_DEFAULTS.username,
    password: String(
      input.password
        || process.env.LOCAL_OWNER_PASSWORD
        || process.env.ADMIN_WEB_PASSWORD
        || LOCAL_OWNER_LOGIN_DEFAULTS.password,
    ),
    role: String(input.role || LOCAL_OWNER_LOGIN_DEFAULTS.role).trim() || LOCAL_OWNER_LOGIN_DEFAULTS.role,
    tenantId: input.tenantId === undefined ? LOCAL_OWNER_LOGIN_DEFAULTS.tenantId : input.tenantId,
  };
}

async function seedLocalOwnerLogin(options = {}) {
  const databaseUrl = String(options.databaseUrl || '').trim();
  if (!databaseUrl) {
    throw new Error('databaseUrl is required');
  }
  assertLocalSqliteUrl(databaseUrl);

  const input = normalizeSeedInput(options);
  const prisma = options.prisma || new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const shouldDisconnect = !options.prisma;
  const passwordHash = createAdminPasswordHash(input.password);
  const tenantId = input.tenantId ? String(input.tenantId).trim() : null;

  try {
    await ensureAdminWebUsersTable(prisma);
    await prisma.$executeRaw`
      INSERT INTO admin_web_users (
        username,
        password_hash,
        role,
        tenant_id,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        ${input.username},
        ${passwordHash},
        ${input.role},
        ${tenantId},
        ${true},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        tenant_id = excluded.tenant_id,
        is_active = excluded.is_active,
        updated_at = CURRENT_TIMESTAMP
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        username,
        role,
        tenant_id AS "tenantId",
        is_active AS "isActive"
      FROM admin_web_users
      WHERE username = ${input.username}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      username: String(row?.username || input.username),
      role: String(row?.role || input.role),
      tenantId: row?.tenantId || null,
      isActive: row?.isActive === true || Number(row?.isActive || 0) === 1,
      databaseUrl,
    };
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

async function seedConfiguredLocalOwnerLogins(databaseUrls = DEFAULT_LOCAL_DATABASE_URLS, options = {}) {
  const results = [];
  for (const databaseUrl of databaseUrls) {
    results.push(await seedLocalOwnerLogin({
      ...options,
      databaseUrl,
    }));
  }
  return results;
}

async function main() {
  const results = await seedConfiguredLocalOwnerLogins();
  for (const result of results) {
    console.log(`[local-owner-login] ready username=${result.username} role=${result.role} db=${result.databaseUrl}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[local-owner-login] failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_LOCAL_DATABASE_URLS,
  LOCAL_OWNER_LOGIN_DEFAULTS,
  createAdminPasswordHash,
  seedConfiguredLocalOwnerLogins,
  seedLocalOwnerLogin,
  verifyAdminPasswordHash,
};
