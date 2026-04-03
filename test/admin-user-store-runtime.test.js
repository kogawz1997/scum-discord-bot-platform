const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  createAdminUserStoreRuntime,
} = require('../src/admin/auth/adminUserStoreRuntime');

function createMockPrisma() {
  const rows = new Map();
  let rawInsertCalls = 0;
  let rawQueryCalls = 0;
  let rawUnsafeCalls = 0;

  const prisma = {
    adminWebUser: {
      async upsert({ where, create }) {
        const username = String(where?.username || '').trim();
        if (!rows.has(username)) {
          rows.set(username, {
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return rows.get(username);
      },
      async findMany({ where, orderBy, take } = {}) {
        const activeOnly = where?.isActive === true;
        const sorted = [...rows.values()]
          .filter((row) => (activeOnly ? row.isActive === true : true))
          .sort((left, right) => String(left.username || '').localeCompare(String(right.username || '')));
        return sorted.slice(0, take || sorted.length);
      },
      async findUnique({ where } = {}) {
        return rows.get(String(where?.username || '').trim()) || null;
      },
      async count({ where } = {}) {
        return [...rows.values()].filter((row) => {
          if (where?.isActive === true && row.isActive !== true) return false;
          if (where?.role && String(row.role || '') !== String(where.role || '')) return false;
          return true;
        }).length;
      },
      async create({ data }) {
        rows.set(data.username, {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return rows.get(data.username);
      },
      async update({ where, data }) {
        const username = String(where?.username || '').trim();
        const current = rows.get(username);
        if (!current) {
          throw new Error(`missing admin user: ${username}`);
        }
        rows.set(username, {
          ...current,
          ...data,
          updatedAt: new Date(),
        });
        return rows.get(username);
      },
    },
    async $executeRawUnsafe() {
      rawUnsafeCalls += 1;
    },
    async $executeRaw() {
      rawInsertCalls += 1;
      return [];
    },
    async $queryRaw() {
      rawQueryCalls += 1;
      return [];
    },
  };

  return {
    prisma,
    getSnapshot() {
      return {
        rows: [...rows.values()].map((row) => ({
          username: row.username,
          role: row.role,
          tenantId: row.tenantId || null,
          isActive: row.isActive === true,
          passwordHash: row.passwordHash,
        })),
        rawInsertCalls,
        rawQueryCalls,
        rawUnsafeCalls,
      };
    },
  };
}

function createPrismaClientLikeFallbackHarness(options = {}) {
  let rawUnsafeCalls = 0;
  let rawInsertCalls = 0;
  let rawQueryCalls = 0;
  const legacyRows = Array.isArray(options.legacyRows) ? options.legacyRows : [];
  const delegateError = options.delegateError || (() => {
    const error = new Error('no such table: admin_web_users');
    error.code = 'P2021';
    return error;
  })();

  return {
    prisma: {
      adminWebUser: {
        async upsert() {
          throw delegateError;
        },
        async findMany() {
          throw delegateError;
        },
        async findUnique() {
          throw delegateError;
        },
        async count() {
          throw delegateError;
        },
        async create() {
          throw delegateError;
        },
        async update() {
          throw delegateError;
        },
      },
      async $executeRawUnsafe() {
        rawUnsafeCalls += 1;
        return [];
      },
      async $executeRaw() {
        rawInsertCalls += 1;
        return [];
      },
      async $queryRaw() {
        rawQueryCalls += 1;
        return legacyRows;
      },
      async $transaction(work) {
        return work(this);
      },
      async $disconnect() {},
    },
    getSnapshot() {
      return {
        rawUnsafeCalls,
        rawInsertCalls,
        rawQueryCalls,
      };
    },
  };
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ['owner', 'admin', 'mod'].includes(role) ? role : 'mod';
}

test('admin user store seeds and authenticates through Prisma delegate when available', async () => {
  const mock = createMockPrisma();
  const runtime = createAdminUserStoreRuntime({
    prisma: mock.prisma,
    crypto,
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole,
    resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
    adminWebUser: 'fallback_owner',
    adminWebUserRole: 'owner',
    adminWebUsersJson: JSON.stringify([
      {
        username: 'owner_one',
        password: 'secret-pass',
        role: 'owner',
      },
    ]),
    logger: { warn() {} },
  });

  await runtime.ensureAdminUsersReady();
  const users = await runtime.listAdminUsersFromDb();
  const auth = await runtime.getUserByCredentials('owner_one', 'secret-pass');
  const snapshot = mock.getSnapshot();

  assert.equal(users.length, 1);
  assert.equal(users[0].username, 'owner_one');
  assert.equal(auth?.username, 'owner_one');
  assert.equal(auth?.role, 'owner');
  assert.equal(snapshot.rawInsertCalls, 0);
  assert.equal(snapshot.rawQueryCalls, 0);
  assert.equal(snapshot.rawUnsafeCalls, 0);
});

test('admin user store updates existing admin users through Prisma delegate', async () => {
  const mock = createMockPrisma();
  const runtime = createAdminUserStoreRuntime({
    prisma: mock.prisma,
    crypto,
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole,
    resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
    adminWebUser: 'fallback_owner',
    adminWebUserRole: 'owner',
    adminWebUsersJson: JSON.stringify([
      {
        username: 'tenant_admin',
        password: 'first-pass',
        role: 'admin',
      },
    ]),
    logger: { warn() {} },
  });

  await runtime.ensureAdminUsersReady();
  await runtime.upsertAdminUserInDb({
    username: 'tenant_admin',
    role: 'owner',
    tenantId: 'tenant-alpha',
    isActive: true,
  });

  const users = await runtime.listAdminUsersFromDb();
  const auth = await runtime.getUserByCredentials('tenant_admin', 'first-pass');

  assert.equal(users.length, 1);
  assert.equal(users[0].role, 'owner');
  assert.equal(users[0].tenantId, 'tenant-alpha');
  assert.equal(auth?.role, 'owner');
  assert.equal(auth?.tenantId, 'tenant-alpha');
});

test('admin user store falls back to env-backed users when prisma is unavailable', async () => {
  const runtime = createAdminUserStoreRuntime({
    prisma: {
      async $executeRawUnsafe() {
        throw new Error('Error validating datasource `db`: the URL must start with the protocol `file:`.');
      },
      async $executeRaw() {
        throw new Error('Error validating datasource `db`: the URL must start with the protocol `file:`.');
      },
      async $queryRaw() {
        throw new Error('Error validating datasource `db`: the URL must start with the protocol `file:`.');
      },
    },
    crypto,
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole,
    resolveDatabaseRuntime: () => ({ engine: 'postgresql' }),
    adminWebUser: 'fallback_owner',
    adminWebUserRole: 'owner',
    adminWebUsersJson: JSON.stringify([
      {
        username: 'env_owner',
        password: 'env-secret',
        role: 'owner',
      },
    ]),
    logger: { warn() {} },
  });

  await runtime.ensureAdminUsersReady();
  const users = await runtime.listAdminUsersFromDb();
  const auth = await runtime.getUserByCredentials('env_owner', 'env-secret');

  assert.equal(users.length, 1);
  assert.equal(users[0].username, 'env_owner');
  assert.equal(users[0].role, 'owner');
  assert.equal(auth?.username, 'env_owner');
  assert.equal(auth?.role, 'owner');
});

test('admin user store bootstraps legacy table path only when delegate persistence falls back', async () => {
  let rawUnsafeCalls = 0;
  let rawInsertCalls = 0;
  const runtime = createAdminUserStoreRuntime({
    prisma: {
      adminWebUser: {
        async upsert() {
          const error = new Error('no such table: admin_web_users');
          error.code = 'P2021';
          throw error;
        },
      },
      async $executeRawUnsafe() {
        rawUnsafeCalls += 1;
        return [];
      },
      async $executeRaw() {
        rawInsertCalls += 1;
        return [];
      },
      async $queryRaw() {
        return [{
          username: 'legacy_owner',
          role: 'owner',
          tenantId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }];
      },
    },
    crypto,
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole,
    resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
    adminWebUser: 'fallback_owner',
    adminWebUserRole: 'owner',
    adminWebUsersJson: JSON.stringify([
      {
        username: 'legacy_owner',
        password: 'legacy-secret',
        role: 'owner',
      },
    ]),
    logger: { warn() {} },
  });

  await runtime.ensureAdminUsersReady();
  assert.ok(rawUnsafeCalls >= 1);
  assert.ok(rawInsertCalls >= 1);
});

test('admin user store requires migrated schema for prisma-client runtimes unless bootstrap is explicitly enabled', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBootstrap = process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP;
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP;

  try {
    const harness = createPrismaClientLikeFallbackHarness();
    const runtime = createAdminUserStoreRuntime({
      prisma: harness.prisma,
      crypto,
      secureEqual: (left, right) => String(left) === String(right),
      normalizeRole,
      resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
      adminWebUser: 'fallback_owner',
      adminWebUserRole: 'owner',
      adminWebUsersJson: JSON.stringify([
        {
          username: 'schema_owner',
          password: 'schema-secret',
          role: 'owner',
        },
      ]),
      logger: { warn() {} },
    });

    await assert.rejects(
      () => runtime.ensureAdminUsersReady(),
      (error) => {
        assert.equal(error?.code, 'ADMIN_WEB_USERS_SCHEMA_REQUIRED');
        assert.equal(error?.adminUserSchema?.bootstrapPolicy?.reason, 'prisma-client-runtime');
        assert.equal(error?.adminUserSchema?.bootstrapPolicy?.env, 'ADMIN_WEB_RUNTIME_BOOTSTRAP');
        return true;
      },
    );

    const snapshot = harness.getSnapshot();
    assert.equal(snapshot.rawUnsafeCalls, 0);
    assert.equal(snapshot.rawInsertCalls, 0);
  } finally {
    if (originalNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalBootstrap == null) {
      delete process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP;
    } else {
      process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP = originalBootstrap;
    }
  }
});

test('admin user store can still bootstrap legacy table path for prisma-client runtimes when explicitly enabled', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBootstrap = process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP;
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP = '1';

  try {
    const harness = createPrismaClientLikeFallbackHarness({
      delegateError: Object.assign(new Error('no such table: admin_web_users'), { code: 'P2021' }),
      legacyRows: [{
        username: 'legacy_schema_owner',
        role: 'owner',
        tenantId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    });
    const runtime = createAdminUserStoreRuntime({
      prisma: harness.prisma,
      crypto,
      secureEqual: (left, right) => String(left) === String(right),
      normalizeRole,
      resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
      adminWebUser: 'fallback_owner',
      adminWebUserRole: 'owner',
      adminWebUsersJson: JSON.stringify([
        {
          username: 'legacy_schema_owner',
          password: 'legacy-secret',
          role: 'owner',
        },
      ]),
      logger: { warn() {} },
    });

    await runtime.ensureAdminUsersReady();
    const snapshot = harness.getSnapshot();
    assert.ok(snapshot.rawUnsafeCalls >= 1);
    assert.ok(snapshot.rawInsertCalls >= 1);
  } finally {
    if (originalNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalBootstrap == null) {
      delete process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP;
    } else {
      process.env.ADMIN_WEB_RUNTIME_BOOTSTRAP = originalBootstrap;
    }
  }
});

test('admin user store refuses ephemeral token and password fallback in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAdminToken = process.env.ADMIN_WEB_TOKEN;
  const originalAdminPassword = process.env.ADMIN_WEB_PASSWORD;
  const originalLocalRecovery = process.env.ADMIN_WEB_LOCAL_RECOVERY;

  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_WEB_TOKEN;
  delete process.env.ADMIN_WEB_PASSWORD;
  process.env.ADMIN_WEB_LOCAL_RECOVERY = 'false';

  try {
    const runtime = createAdminUserStoreRuntime({
      prisma: { adminWebUser: null },
      crypto,
      secureEqual: (left, right) => String(left) === String(right),
      normalizeRole,
      resolveDatabaseRuntime: () => ({ engine: 'postgresql' }),
      adminWebUser: 'fallback_owner',
      adminWebUserRole: 'owner',
      adminWebUsersJson: '',
      logger: { warn() {} },
    });

    assert.throws(
      () => runtime.getAdminToken(),
      /ADMIN_WEB_TOKEN is required in production/i,
    );
    assert.throws(
      () => runtime.getAdminLoginPassword(),
      /ADMIN_WEB_PASSWORD is required in production/i,
    );
  } finally {
    if (originalNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalAdminToken == null) {
      delete process.env.ADMIN_WEB_TOKEN;
    } else {
      process.env.ADMIN_WEB_TOKEN = originalAdminToken;
    }
    if (originalAdminPassword == null) {
      delete process.env.ADMIN_WEB_PASSWORD;
    } else {
      process.env.ADMIN_WEB_PASSWORD = originalAdminPassword;
    }
    if (originalLocalRecovery == null) {
      delete process.env.ADMIN_WEB_LOCAL_RECOVERY;
    } else {
      process.env.ADMIN_WEB_LOCAL_RECOVERY = originalLocalRecovery;
    }
  }
});

test('admin user store resolves active admin session access context from persisted users', async () => {
  const mock = createMockPrisma();
  const runtime = createAdminUserStoreRuntime({
    prisma: mock.prisma,
    crypto,
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole,
    resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
    adminWebUser: 'fallback_owner',
    adminWebUserRole: 'owner',
    adminWebUsersJson: JSON.stringify([
      {
        username: 'owner_runtime',
        password: 'secret-pass',
        role: 'owner',
      },
    ]),
    logger: { warn() {} },
  });

  await runtime.ensureAdminUsersReady();
  const resolved = await runtime.resolveAdminSessionAccessContext({
    username: 'owner_runtime',
    authMethod: 'password-db',
  });

  assert.equal(resolved?.ok, true);
  assert.equal(resolved?.authContext?.user, 'owner_runtime');
  assert.equal(resolved?.authContext?.role, 'owner');
  assert.equal(resolved?.authContext?.tenantId, null);
  assert.equal(resolved?.authContext?.authMethod, 'password-db');
});

test('admin user store rejects inactive admin session access context', async () => {
  const mock = createMockPrisma();
  const runtime = createAdminUserStoreRuntime({
    prisma: mock.prisma,
    crypto,
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole,
    resolveDatabaseRuntime: () => ({ engine: 'sqlite' }),
    adminWebUser: 'fallback_owner',
    adminWebUserRole: 'owner',
    adminWebUsersJson: JSON.stringify([
      {
        username: 'owner_disabled',
        password: 'secret-pass',
        role: 'owner',
      },
      {
        username: 'owner_backup',
        password: 'backup-pass',
        role: 'owner',
      },
    ]),
    logger: { warn() {} },
  });

  await runtime.ensureAdminUsersReady();
  await runtime.upsertAdminUserInDb({
    username: 'owner_disabled',
    role: 'owner',
    isActive: false,
  });

  const resolved = await runtime.resolveAdminSessionAccessContext({
    username: 'owner_disabled',
    authMethod: 'password-db',
  });

  assert.equal(resolved?.ok, false);
  assert.equal(resolved?.reason, 'admin-user-inactive');
});
