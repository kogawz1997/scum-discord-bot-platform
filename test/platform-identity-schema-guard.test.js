const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/test.db';
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = process.env.PRISMA_SCHEMA_PROVIDER || 'sqlite';

const {
  ensurePlatformIdentityTables,
  ensurePlatformUserPasswordColumn,
  invalidateIdentitySchemaCaches,
} = require('../src/services/platformIdentityService');

const REQUIRED_TABLES = [
  'platform_users',
  'platform_user_identities',
  'platform_memberships',
  'platform_password_reset_tokens',
  'platform_verification_tokens',
  'platform_player_profiles',
];

function renderRawSql(input) {
  if (Array.isArray(input?.raw)) {
    return input.raw.join('?');
  }
  return String(input || '');
}

function createMockDb(options = {}) {
  const runtime = options.runtime || 'sqlite';
  const tables = new Set(Array.isArray(options.tables) ? options.tables : []);
  const columns = new Map(
    Object.entries(options.columns || {}).map(([tableName, values]) => [
      tableName,
      new Set(Array.isArray(values) ? values : []),
    ]),
  );
  const calls = [];

  function ensureColumnSet(tableName) {
    if (!columns.has(tableName)) {
      columns.set(tableName, new Set());
    }
    return columns.get(tableName);
  }

  function addDefaultColumnsForTable(tableName) {
    const target = ensureColumnSet(tableName);
    if (tableName === 'platform_users') {
      target.add('id');
      target.add('primaryEmail');
      target.add('displayName');
      target.add('passwordHash');
      target.add('locale');
      target.add('status');
      target.add('metadataJson');
      target.add('createdAt');
      target.add('updatedAt');
      return;
    }
    if (tableName === 'platform_verification_tokens') {
      target.add('id');
      target.add('userId');
      target.add('previewAccountId');
      target.add('email');
      target.add('purpose');
      target.add('tokenType');
      target.add('tokenPrefix');
      target.add('tokenHash');
      target.add('target');
      target.add('expiresAt');
      target.add('consumedAt');
      target.add('metadataJson');
      target.add('createdAt');
      target.add('updatedAt');
    }
  }

  return {
    calls,
    tables,
    columns,
    async $queryRawUnsafe(sql) {
      const query = String(sql || '');
      calls.push({ method: '$queryRawUnsafe', query });
      if (runtime === 'sqlite' && query.includes('sqlite_master')) {
        const match = query.match(/name = '([^']+)'/);
        const tableName = match ? match[1] : '';
        return tables.has(tableName) ? [{ name: tableName }] : [];
      }
      if (runtime === 'sqlite' && query.startsWith('PRAGMA table_info')) {
        const match = query.match(/PRAGMA table_info\('([^']+)'\)/);
        const tableName = match ? match[1] : '';
        return Array.from(columns.get(tableName) || []).map((name) => ({ name }));
      }
      if (runtime === 'postgresql' && query.includes('information_schema.tables')) {
        const match = query.match(/table_name = '([^']+)'/);
        const tableName = match ? match[1] : '';
        return tables.has(tableName) ? [{ name: tableName }] : [];
      }
      if (runtime === 'postgresql' && query.includes('information_schema.columns')) {
        const tableMatch = query.match(/table_name = '([^']+)'/);
        const columnMatch = query.match(/column_name = '([^']+)'/);
        const tableName = tableMatch ? tableMatch[1] : '';
        const columnName = columnMatch ? columnMatch[1] : '';
        return (columns.get(tableName) || new Set()).has(columnName) ? [{ name: columnName }] : [];
      }
      return [];
    },
    async $executeRawUnsafe(sql) {
      const query = String(sql || '');
      calls.push({ method: '$executeRawUnsafe', query });
      const createMatches = Array.from(query.matchAll(/CREATE TABLE IF NOT EXISTS ([a-zA-Z0-9_]+)/g));
      createMatches.forEach((match) => {
        const tableName = String(match[1] || '').trim();
        if (tableName) {
          tables.add(tableName);
          addDefaultColumnsForTable(tableName);
        }
      });
      if (/ALTER TABLE platform_users ADD COLUMN passwordHash TEXT/i.test(query)) {
        tables.add('platform_users');
        ensureColumnSet('platform_users').add('passwordHash');
      }
      const verificationTokenColumnMatch = query.match(/ALTER TABLE platform_verification_tokens ADD COLUMN ([a-zA-Z0-9_]+) /i);
      if (verificationTokenColumnMatch) {
        tables.add('platform_verification_tokens');
        ensureColumnSet('platform_verification_tokens').add(String(verificationTokenColumnMatch[1] || ''));
      }
      return 0;
    },
    async $executeRaw(...args) {
      calls.push({ method: '$executeRaw', query: renderRawSql(args[0]) });
      return 0;
    },
    async $queryRaw(...args) {
      calls.push({ method: '$queryRaw', query: renderRawSql(args[0]) });
      return [];
    },
  };
}

function withEnv(overrides, work) {
  const snapshot = {};
  for (const [key, value] of Object.entries(overrides)) {
    snapshot[key] = process.env[key];
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  invalidateIdentitySchemaCaches();
  return Promise.resolve()
    .then(work)
    .finally(() => {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      invalidateIdentitySchemaCaches();
    });
}

test('identity schema guard rejects runtime table bootstrap in production when the schema is missing', async () => {
  const db = createMockDb({
    runtime: 'sqlite',
    tables: [],
    columns: {},
  });

  await withEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'file:./identity-prod-missing.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    await assert.rejects(
      ensurePlatformIdentityTables(db),
      (error) => error?.code === 'PLATFORM_IDENTITY_SCHEMA_REQUIRED',
    );
  });

  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && entry.query.includes('CREATE TABLE IF NOT EXISTS')),
    false,
  );
});

test('identity schema guard allows runtime bootstrap outside production for local or test flows', async () => {
  const db = createMockDb({
    runtime: 'sqlite',
    tables: [],
    columns: {},
  });

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-test-bootstrap.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const result = await ensurePlatformIdentityTables(db);
    assert.equal(result.ok, true);
    assert.equal(result.bootstrapped, true);
  });

  REQUIRED_TABLES.forEach((tableName) => {
    assert.equal(db.tables.has(tableName), true);
  });
});

test('workspace auth refuses to add platform_users.passwordHash at runtime in production', async () => {
  const db = createMockDb({
    runtime: 'sqlite',
    tables: REQUIRED_TABLES,
    columns: {
      platform_users: ['id', 'primaryEmail'],
      platform_verification_tokens: ['id', 'userId', 'previewAccountId', 'email', 'purpose', 'tokenType', 'tokenPrefix', 'tokenHash', 'target', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    },
  });

  await withEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'file:./identity-password-prod.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    await assert.rejects(
      ensurePlatformUserPasswordColumn(db),
      (error) => error?.code === 'PLATFORM_IDENTITY_PASSWORD_COLUMN_REQUIRED',
    );
  });

  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && /ALTER TABLE platform_users ADD COLUMN passwordHash TEXT/i.test(entry.query)),
    false,
  );
});

test('identity schema guard rejects verification token compatibility bootstrap in production', async () => {
  const db = createMockDb({
    runtime: 'sqlite',
    tables: REQUIRED_TABLES,
    columns: {
      platform_verification_tokens: ['id', 'userId', 'email', 'tokenPrefix', 'tokenHash', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    },
  });

  await withEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'file:./identity-verification-prod.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    await assert.rejects(
      ensurePlatformIdentityTables(db),
      (error) => error?.code === 'PLATFORM_IDENTITY_VERIFICATION_TOKEN_SCHEMA_REQUIRED',
    );
  });
});

test('identity schema guard can add verification token compatibility columns outside production', async () => {
  const db = createMockDb({
    runtime: 'sqlite',
    tables: REQUIRED_TABLES,
    columns: {
      platform_verification_tokens: ['id', 'userId', 'email', 'tokenPrefix', 'tokenHash', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    },
  });

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-verification-test.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const result = await ensurePlatformIdentityTables(db);
    assert.equal(result.ok, true);
  });

  ['previewAccountId', 'purpose', 'tokenType', 'target'].forEach((columnName) => {
    assert.equal((db.columns.get('platform_verification_tokens') || new Set()).has(columnName), true);
  });
});

test('workspace auth can add platform_users.passwordHash outside production when local schema is old', async () => {
  const db = createMockDb({
    runtime: 'sqlite',
    tables: REQUIRED_TABLES,
    columns: {
      platform_users: ['id', 'primaryEmail'],
      platform_verification_tokens: ['id', 'userId', 'previewAccountId', 'email', 'purpose', 'tokenType', 'tokenPrefix', 'tokenHash', 'target', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    },
  });

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-password-test.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const result = await ensurePlatformUserPasswordColumn(db);
    assert.equal(result.ok, true);
  });

  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && /ALTER TABLE platform_users ADD COLUMN passwordHash TEXT/i.test(entry.query)),
    true,
  );
  assert.equal((db.columns.get('platform_users') || new Set()).has('passwordHash'), true);
});
