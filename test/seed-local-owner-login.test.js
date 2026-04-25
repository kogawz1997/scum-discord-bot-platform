const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const {
  LOCAL_OWNER_LOGIN_DEFAULTS,
  createAdminPasswordHash,
  seedLocalOwnerLogin,
  verifyAdminPasswordHash,
} = require('../scripts/seed-local-owner-login');

function tempSqliteUrl(name) {
  const filePath = path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  return {
    filePath,
    databaseUrl: `file:${filePath.replace(/\\/g, '/')}`,
  };
}

async function createAdminUserTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE admin_web_users (
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

test('local owner login defaults are scoped to the development admin user', () => {
  assert.equal(LOCAL_OWNER_LOGIN_DEFAULTS.username, 'admin');
  assert.equal(LOCAL_OWNER_LOGIN_DEFAULTS.role, 'owner');
  assert.equal(LOCAL_OWNER_LOGIN_DEFAULTS.tenantId, null);
  assert.match(LOCAL_OWNER_LOGIN_DEFAULTS.password, /local/i);
});

test('local owner password hashing uses scrypt and verifies the configured password', () => {
  const password = 'local-owner-password-for-test';
  const hash = createAdminPasswordHash(password);

  assert.match(hash, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.equal(hash.includes(password), false);
  assert.equal(verifyAdminPasswordHash(password, hash), true);
  assert.equal(verifyAdminPasswordHash('wrong-password', hash), false);
});

test('seedLocalOwnerLogin upserts and repairs the local owner user row', async () => {
  const { filePath, databaseUrl } = tempSqliteUrl('seed-local-owner-login');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await createAdminUserTable(prisma);
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
        ${'admin'},
        ${'old-password'},
        ${'mod'},
        ${'tenant-a'},
        ${false},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    const result = await seedLocalOwnerLogin({
      databaseUrl,
      username: 'admin',
      password: 'local-owner-password-for-test',
    });

    assert.equal(result.username, 'admin');
    assert.equal(result.role, 'owner');
    assert.equal(result.tenantId, null);
    assert.equal(result.isActive, true);

    const rows = await prisma.$queryRaw`
      SELECT username, password_hash AS "passwordHash", role, tenant_id AS "tenantId", is_active AS "isActive"
      FROM admin_web_users
      WHERE username = ${'admin'}
    `;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].role, 'owner');
    assert.equal(rows[0].tenantId, null);
    assert.equal(Number(rows[0].isActive), 1);
    assert.equal(verifyAdminPasswordHash('local-owner-password-for-test', rows[0].passwordHash), true);
  } finally {
    await prisma.$disconnect();
    fs.rmSync(filePath, { force: true });
  }
});

test('seedLocalOwnerLogin falls back to ADMIN_WEB_PASSWORD for local owner password', async () => {
  const { filePath, databaseUrl } = tempSqliteUrl('seed-local-owner-login-env-password');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const originalLocalOwnerPassword = process.env.LOCAL_OWNER_PASSWORD;
  const originalAdminWebPassword = process.env.ADMIN_WEB_PASSWORD;

  try {
    delete process.env.LOCAL_OWNER_PASSWORD;
    process.env.ADMIN_WEB_PASSWORD = 'admin-web-password-for-local-login-test';

    const result = await seedLocalOwnerLogin({ databaseUrl });

    assert.equal(result.username, 'admin');
    assert.equal(result.role, 'owner');

    const rows = await prisma.$queryRaw`
      SELECT password_hash AS "passwordHash"
      FROM admin_web_users
      WHERE username = ${'admin'}
    `;
    assert.equal(rows.length, 1);
    assert.equal(
      verifyAdminPasswordHash('admin-web-password-for-local-login-test', rows[0].passwordHash),
      true,
    );
  } finally {
    if (originalLocalOwnerPassword === undefined) {
      delete process.env.LOCAL_OWNER_PASSWORD;
    } else {
      process.env.LOCAL_OWNER_PASSWORD = originalLocalOwnerPassword;
    }
    if (originalAdminWebPassword === undefined) {
      delete process.env.ADMIN_WEB_PASSWORD;
    } else {
      process.env.ADMIN_WEB_PASSWORD = originalAdminWebPassword;
    }
    await prisma.$disconnect();
    fs.rmSync(filePath, { force: true });
  }
});
