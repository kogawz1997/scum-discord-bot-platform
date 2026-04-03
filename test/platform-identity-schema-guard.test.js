const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/test.db';
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = process.env.PRISMA_SCHEMA_PROVIDER || 'sqlite';

const {
  completeEmailVerification,
  ensurePlatformIdentityTables,
  ensurePlatformUserIdentity,
  ensurePlatformUserPasswordColumn,
  issueEmailVerificationToken,
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
    ...(options.delegates || {}),
  };
}

function createPrismaClientLikeRawDb(options = {}) {
  const db = createMockDb(options);
  db.$transaction = async (work) => work(db);
  db.$disconnect = async () => {};
  return db;
}

function matchesWhere(row, where) {
  if (!where || typeof where !== 'object') return true;
  if (Array.isArray(where.OR) && where.OR.length > 0 && !where.OR.some((entry) => matchesWhere(row, entry))) {
    return false;
  }
  if (Array.isArray(where.AND) && where.AND.length > 0 && !where.AND.every((entry) => matchesWhere(row, entry))) {
    return false;
  }
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR' || key === 'AND') return true;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return false;
    }
    return (row?.[key] ?? null) === value;
  });
}

function sortRows(rows, orderBy) {
  if (!orderBy || typeof orderBy !== 'object') {
    return [...rows];
  }
  const [[field, direction]] = Object.entries(orderBy);
  const factor = String(direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = left?.[field] instanceof Date ? left[field].getTime() : left?.[field];
    const rightValue = right?.[field] instanceof Date ? right[field].getTime() : right?.[field];
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1 * factor;
    if (rightValue == null) return -1 * factor;
    if (leftValue < rightValue) return -1 * factor;
    if (leftValue > rightValue) return 1 * factor;
    return 0;
  });
}

function createDelegateIdentityDb(runtime = 'postgresql', options = {}) {
  const tables = Array.isArray(options.tables) ? options.tables : REQUIRED_TABLES;
  const columns = options.columns || {
    platform_users: ['id', 'primaryEmail', 'displayName', 'passwordHash', 'locale', 'status', 'metadataJson', 'createdAt', 'updatedAt'],
    platform_user_identities: ['id', 'userId', 'provider', 'providerUserId', 'providerEmail', 'displayName', 'avatarUrl', 'verifiedAt', 'linkedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    platform_memberships: ['id', 'userId', 'tenantId', 'membershipType', 'role', 'status', 'isPrimary', 'acceptedAt', 'revokedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    platform_password_reset_tokens: ['id', 'userId', 'previewAccountId', 'email', 'tokenPrefix', 'tokenHash', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    platform_verification_tokens: ['id', 'userId', 'previewAccountId', 'email', 'purpose', 'tokenType', 'tokenPrefix', 'tokenHash', 'target', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
    platform_player_profiles: ['id', 'userId', 'tenantId', 'discordUserId', 'steamId', 'inGameName', 'verificationState', 'linkedAt', 'lastSeenAt', 'metadataJson', 'createdAt', 'updatedAt'],
  };
  const state = {
    users: [],
    identities: [],
    memberships: [],
    profiles: [],
    verificationTokens: [],
    passwordResetTokens: [],
  };

  function stampCreate(data) {
    const createdAt = new Date();
    return {
      ...data,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function stampUpdate(existing, data) {
    return {
      ...existing,
      ...data,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
  }

  function createCollectionDelegate(target, options = {}) {
    return {
      async findUnique(args = {}) {
        const where = args.where || {};
        if (where.id) {
          return target.find((entry) => entry.id === where.id) || null;
        }
        if (where.primaryEmail) {
          return target.find((entry) => entry.primaryEmail === where.primaryEmail) || null;
        }
        if (where.provider_providerUserId) {
          const composite = where.provider_providerUserId;
          return target.find((entry) => entry.provider === composite.provider && entry.providerUserId === composite.providerUserId) || null;
        }
        return null;
      },
      async findFirst(args = {}) {
        const rows = sortRows(target.filter((entry) => matchesWhere(entry, args.where || {})), args.orderBy);
        return rows[0] || null;
      },
      async findMany(args = {}) {
        return sortRows(target.filter((entry) => matchesWhere(entry, args.where || {})), args.orderBy);
      },
      async create(args = {}) {
        const row = stampCreate(args.data || {});
        target.push(row);
        return row;
      },
      async update(args = {}) {
        const where = args.where || {};
        const index = target.findIndex((entry) => entry.id === where.id);
        if (index < 0) {
          throw new Error('record-not-found');
        }
        const row = stampUpdate(target[index], args.data || {});
        target[index] = row;
        return row;
      },
      async updateMany(args = {}) {
        let count = 0;
        target.forEach((entry, index) => {
          if (!matchesWhere(entry, args.where || {})) return;
          target[index] = stampUpdate(entry, args.data || {});
          count += 1;
        });
        return { count };
      },
      ...options,
    };
  }

  const db = createMockDb({
    runtime,
    tables,
    columns,
    delegates: {
      platformUser: createCollectionDelegate(state.users),
      platformUserIdentity: createCollectionDelegate(state.identities),
      platformMembership: createCollectionDelegate(state.memberships),
      platformPlayerProfile: createCollectionDelegate(state.profiles),
      platformVerificationToken: createCollectionDelegate(state.verificationTokens),
      platformPasswordResetToken: createCollectionDelegate(state.passwordResetTokens),
    },
  });

  return {
    db,
    state,
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

test('identity service prefers prisma delegates for server-engine user and membership writes', async () => {
  const { db, state } = createDelegateIdentityDb();

  await withEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://identity.example/test',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const result = await ensurePlatformUserIdentity({
      provider: 'email_preview',
      providerUserId: 'preview-account-delegate-test',
      email: 'delegate-identity@example.com',
      displayName: 'Delegate Identity',
      tenantId: 'tenant-delegate-test',
      membershipType: 'tenant',
      role: 'owner',
      identityMetadata: { source: 'delegate-test' },
      membershipMetadata: { source: 'delegate-test' },
    }, db);

    assert.equal(result.ok, true);
    assert.equal(String(result.user?.primaryEmail || ''), 'delegate-identity@example.com');
    assert.equal(state.users.length, 1);
    assert.equal(state.identities.length, 1);
    assert.equal(state.memberships.length, 1);
  });

  assert.equal(db.calls.some((entry) => entry.method === '$executeRaw'), false);
});

test('identity service prefers prisma delegates for verification token lifecycle on server engines', async () => {
  const { db, state } = createDelegateIdentityDb();
  state.users.push({
    id: 'user-verify-1',
    primaryEmail: 'delegate-verify@example.com',
    displayName: 'Delegate Verify',
    locale: 'en',
    status: 'active',
    metadataJson: '{}',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  state.identities.push({
    id: 'ident-verify-1',
    userId: 'user-verify-1',
    provider: 'email_preview',
    providerUserId: 'delegate-verify-preview',
    providerEmail: 'delegate-verify@example.com',
    displayName: 'Delegate Verify',
    avatarUrl: null,
    verifiedAt: null,
    linkedAt: new Date(),
    metadataJson: '{}',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await withEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://identity.example/test',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const issued = await issueEmailVerificationToken({
      email: 'delegate-verify@example.com',
      userId: 'user-verify-1',
    }, db);
    assert.equal(issued.ok, true);
    assert.equal(state.verificationTokens.length, 1);

    const completed = await completeEmailVerification({
      token: issued.rawToken,
      email: 'delegate-verify@example.com',
    }, db);
    assert.equal(completed.ok, true);
    assert.ok(state.verificationTokens[0].consumedAt instanceof Date);
    assert.ok(state.identities[0].verifiedAt instanceof Date);
  });

  assert.equal(db.calls.some((entry) => entry.method === '$executeRaw'), false);
});

test('identity service prefers prisma delegates when sqlite runtimes expose generated delegates', async () => {
  const { db, state } = createDelegateIdentityDb('sqlite');

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-delegate-sqlite.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const ensured = await ensurePlatformUserIdentity({
      provider: 'email_preview',
      providerUserId: 'delegate-sqlite-preview',
      email: 'delegate-sqlite@example.com',
      displayName: 'Delegate SQLite',
      tenantId: 'tenant-sqlite-test',
      membershipType: 'tenant',
      role: 'owner',
    }, db);
    assert.equal(ensured.ok, true);

    const issued = await issueEmailVerificationToken({
      email: 'delegate-sqlite@example.com',
      userId: ensured.user.id,
    }, db);
    assert.equal(issued.ok, true);

    const completed = await completeEmailVerification({
      token: issued.rawToken,
      email: 'delegate-sqlite@example.com',
    }, db);
    assert.equal(completed.ok, true);
    assert.equal(state.users.length, 1);
    assert.equal(state.identities.length, 1);
    assert.equal(state.memberships.length, 1);
    assert.equal(state.verificationTokens.length, 1);
    assert.ok(state.identities[0].verifiedAt instanceof Date);
  });

  assert.equal(db.calls.some((entry) => entry.method === '$executeRaw'), false);
  assert.equal(db.calls.some((entry) => entry.method === '$queryRaw'), false);
});

test('identity schema guard skips runtime bootstrap when explicit sqlite delegates are available', async () => {
  const { db } = createDelegateIdentityDb('sqlite', {
    tables: [],
    columns: {},
  });

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-delegate-schema-sqlite.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    const schema = await ensurePlatformIdentityTables(db);
    assert.equal(schema.ok, true);
    assert.equal(schema.bootstrapped, false);

    const passwordColumn = await ensurePlatformUserPasswordColumn(db);
    assert.equal(passwordColumn.ok, true);
    assert.equal(passwordColumn.bootstrapped, false);
  });

  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && entry.query.includes('CREATE TABLE IF NOT EXISTS')),
    false,
  );
  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && /ALTER TABLE platform_users ADD COLUMN passwordHash TEXT/i.test(entry.query)),
    false,
  );
  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && /ALTER TABLE platform_verification_tokens ADD COLUMN/i.test(entry.query)),
    false,
  );
});

test('identity schema guard requires migrated schema for sqlite Prisma client runtimes unless bootstrap is explicitly enabled', async () => {
  const db = createPrismaClientLikeRawDb({
    runtime: 'sqlite',
    tables: [],
    columns: {},
  });

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-prisma-client-sqlite.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    await assert.rejects(
      ensurePlatformIdentityTables(db),
      (error) => {
        assert.equal(error?.code, 'PLATFORM_IDENTITY_SCHEMA_REQUIRED');
        assert.equal(error?.identitySchema?.bootstrapPolicy?.reason, 'prisma-client-runtime');
        assert.equal(error?.identitySchema?.bootstrapPolicy?.env, 'PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP');
        return true;
      },
    );
  });

  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && entry.query.includes('CREATE TABLE IF NOT EXISTS')),
    false,
  );
});

test('identity schema guard can still bootstrap sqlite Prisma client runtimes when explicitly enabled', async () => {
  const db = createPrismaClientLikeRawDb({
    runtime: 'sqlite',
    tables: [],
    columns: {},
  });

  await withEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./identity-prisma-client-bootstrap.db',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: '1',
  }, async () => {
    const result = await ensurePlatformIdentityTables(db);
    assert.equal(result.ok, true);
    assert.equal(result.bootstrapped, true);
  });

  assert.equal(
    db.calls.some((entry) => entry.method === '$executeRawUnsafe' && entry.query.includes('CREATE TABLE IF NOT EXISTS platform_users')),
    true,
  );
});

test('identity service refuses server-engine CRUD when prisma delegates are unavailable', async () => {
  const db = createMockDb({
    runtime: 'postgresql',
    tables: REQUIRED_TABLES,
    columns: {
      platform_users: ['id', 'primaryEmail', 'displayName', 'passwordHash', 'locale', 'status', 'metadataJson', 'createdAt', 'updatedAt'],
      platform_user_identities: ['id', 'userId', 'provider', 'providerUserId', 'providerEmail', 'displayName', 'avatarUrl', 'verifiedAt', 'linkedAt', 'metadataJson', 'createdAt', 'updatedAt'],
      platform_memberships: ['id', 'userId', 'tenantId', 'membershipType', 'role', 'status', 'isPrimary', 'acceptedAt', 'revokedAt', 'metadataJson', 'createdAt', 'updatedAt'],
      platform_password_reset_tokens: ['id', 'userId', 'previewAccountId', 'email', 'tokenPrefix', 'tokenHash', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
      platform_verification_tokens: ['id', 'userId', 'previewAccountId', 'email', 'purpose', 'tokenType', 'tokenPrefix', 'tokenHash', 'target', 'expiresAt', 'consumedAt', 'metadataJson', 'createdAt', 'updatedAt'],
      platform_player_profiles: ['id', 'userId', 'tenantId', 'discordUserId', 'steamId', 'inGameName', 'verificationState', 'linkedAt', 'lastSeenAt', 'metadataJson', 'createdAt', 'updatedAt'],
    },
  });

  await withEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://identity.example/test',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP: null,
  }, async () => {
    await assert.rejects(
      () => ensurePlatformUserIdentity({
        provider: 'email_preview',
        providerUserId: 'delegate-required-test',
        email: 'delegate-required@example.com',
        displayName: 'Delegate Required',
        tenantId: 'tenant-required-test',
      }, db),
      (error) => String(error?.code || '') === 'PLATFORM_IDENTITY_DELEGATES_REQUIRED',
    );
  });

  assert.equal(db.calls.some((entry) => entry.method === '$executeRaw'), false);
  assert.equal(db.calls.some((entry) => entry.method === '$queryRaw'), false);
});
