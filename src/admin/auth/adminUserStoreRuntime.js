'use strict';

/**
 * Admin user persistence/bootstrap helpers. Keep the database and password
 * handling out of the main admin server entrypoint so HTTP wiring stays focused
 * on request flow and gating.
 */

const ADMIN_WEB_RUNTIME_BOOTSTRAP_ENV = 'ADMIN_WEB_RUNTIME_BOOTSTRAP';
const { resolveLegacyRuntimeBootstrapPolicy } = require('../../utils/legacyRuntimeBootstrapPolicy');
const {
  getCompatibilityClientKey,
  ensureSqliteDateTimeSchemaCompatibility,
  reconcileSqliteDateColumns,
} = require('../../utils/sqliteDateTimeCompatibility');

const sharedAdminUsersSqliteCompatibilityReady = new WeakSet();
const sharedAdminUsersSqliteCompatibilityPending = new WeakMap();

function createAdminUserStoreRuntime(options = {}) {
  const {
    prisma,
    crypto,
    secureEqual,
    normalizeRole,
    resolveDatabaseRuntime,
    adminWebUser,
    adminWebUserRole,
    adminWebUsersJson,
    logger = console,
  } = options;

  let resolvedToken = null;
  let resolvedLoginPassword = null;
  let adminUsersReadyPromise = null;
  let envFallbackMode = false;
  let envUserRows = null;
  const ADMIN_USERS_SQLITE_COMPATIBILITY_TABLES = [
    {
      tableName: 'admin_web_users',
      columns: ['username', 'password_hash', 'role', 'tenant_id', 'is_active', 'created_at', 'updated_at'],
      dateColumns: ['created_at', 'updated_at'],
      createTableSql: `
        CREATE TABLE "admin_web_users" (
          "username" TEXT NOT NULL PRIMARY KEY COLLATE NOCASE,
          "password_hash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'mod',
          "tenant_id" TEXT,
          "is_active" INTEGER NOT NULL DEFAULT 1,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `,
      indexSql: [],
    },
  ];

  function isPrismaClientLike(client) {
    return Boolean(
      client
      && typeof client === 'object'
      && typeof client.$transaction === 'function'
      && typeof client.$disconnect === 'function',
    );
  }

  function isTruthy(value) {
    const text = String(value || '').trim().toLowerCase();
    return text === '1' || text === 'true' || text === 'yes' || text === 'on';
  }

  function shouldAllowEphemeralAdminCredentials() {
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
    if (nodeEnv !== 'production') return true;
    return isTruthy(process.env.ADMIN_WEB_LOCAL_RECOVERY);
  }

  function getAdminToken() {
    if (resolvedToken) return resolvedToken;
    const fromEnv = String(process.env.ADMIN_WEB_TOKEN || '').trim();
    if (fromEnv) {
      resolvedToken = fromEnv;
      return resolvedToken;
    }
    if (!shouldAllowEphemeralAdminCredentials()) {
      throw new Error(
        'ADMIN_WEB_TOKEN is required in production; refusing to generate an ephemeral admin token.',
      );
    }
    resolvedToken = crypto.randomBytes(18).toString('hex');
    logger.warn('[admin-web] ยังไม่ได้ตั้งค่า ADMIN_WEB_TOKEN จึงสร้างโทเค็นเซสชันชั่วคราว:');
    logger.warn('[admin-web] ADMIN_WEB_TOKEN is not configured; generated an ephemeral token for this process only.');
    return resolvedToken;
  }

  function getAdminLoginPassword() {
    if (resolvedLoginPassword) return resolvedLoginPassword;

    const fromEnv = String(process.env.ADMIN_WEB_PASSWORD || '').trim();
    if (fromEnv) {
      resolvedLoginPassword = fromEnv;
      return resolvedLoginPassword;
    }

    if (!shouldAllowEphemeralAdminCredentials()) {
      throw new Error(
        'ADMIN_WEB_PASSWORD is required in production; refusing to reuse ADMIN_WEB_TOKEN as the admin password.',
      );
    }

    resolvedLoginPassword = getAdminToken();
    return resolvedLoginPassword;
  }

  function parseAdminUsersFromEnv() {
    let users = [];
    if (adminWebUsersJson) {
      try {
        const parsed = JSON.parse(adminWebUsersJson);
        if (Array.isArray(parsed)) {
          users = parsed
            .map((row) => {
              if (!row || typeof row !== 'object') return null;
              const username = String(row.username || '').trim();
              const password = String(row.password || '').trim();
              if (!username || !password) return null;
              return {
                username,
                password,
                role: normalizeRole(row.role || 'mod'),
                tenantId: String(row.tenantId || '').trim() || null,
              };
            })
            .filter(Boolean);
        }
      } catch (error) {
        logger.warn('[admin-web] ADMIN_WEB_USERS_JSON parse failed:', error.message);
      }
    }

    if (users.length === 0) {
      users.push({
        username: adminWebUser,
        password: getAdminLoginPassword(),
        role: adminWebUserRole,
        tenantId: null,
      });
    }

    return users;
  }

  function getEnvAdminUserRows() {
    if (Array.isArray(envUserRows)) {
      return envUserRows;
    }
    envUserRows = parseAdminUsersFromEnv().map((user) => ({
      username: String(user.username || '').trim(),
      passwordHash: String(user.password || '').trim(),
      role: normalizeRole(user.role || 'mod'),
      tenantId: String(user.tenantId || '').trim() || null,
      isActive: true,
      createdAt: null,
      updatedAt: null,
    }));
    return envUserRows;
  }

  function getAdminUsersDatabaseEngine() {
    const runtime = resolveDatabaseRuntime();
    return runtime.engine === 'unsupported' ? 'sqlite' : runtime.engine;
  }

  function getLegacyAdminUsersRuntimeBootstrapPolicy() {
    return resolveLegacyRuntimeBootstrapPolicy({
      env: process.env,
      envName: ADMIN_WEB_RUNTIME_BOOTSTRAP_ENV,
      runtime: resolveDatabaseRuntime(),
      prismaClientLike: isPrismaClientLike(prisma),
      policy: 'admin-web-users',
    });
  }

  function isLegacyAdminUsersRuntimeBootstrapAllowed() {
    return getLegacyAdminUsersRuntimeBootstrapPolicy().allowed;
  }

  function buildAdminUsersSchemaRequiredError(details = {}) {
    const error = new Error(
      'Admin web user schema is not ready. Run the database migrations before enabling password-based admin auth, or explicitly enable local runtime bootstrap for compatibility only.',
    );
    error.code = 'ADMIN_WEB_USERS_SCHEMA_REQUIRED';
    error.statusCode = 500;
    error.adminUserSchema = details;
    return error;
  }

  function getAdminUserDelegate() {
    const delegate = prisma && typeof prisma === 'object' ? prisma.adminWebUser : null;
    if (!delegate || typeof delegate.findUnique !== 'function') {
      return null;
    }
    return delegate;
  }

  function isIgnorableAdminUsersSchemaError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('duplicate column')
      || message.includes('already exists')
      || message.includes('(typname, typnamespace)=(admin_web_users');
  }

  function shouldFallbackToLegacyAdminUserPersistence(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    if (code === 'P2021' || code === 'P2022') {
      return true;
    }
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('adminwebuser')
      || message.includes('admin_web_users')
      || message.includes('no such table')
      || message.includes('does not exist')
      || message.includes('could not convert value');
  }

  function shouldUseEnvAdminUsersFallback(error) {
    if (shouldFallbackToLegacyAdminUserPersistence(error)) {
      return true;
    }
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('error validating datasource')
      || message.includes('must start with the protocol')
      || message.includes('prismaclientinitializationerror')
      || message.includes('can\'t reach database server')
      || message.includes('connection refused')
      || message.includes('authentication failed');
  }

  function isSqliteCompatibilityLockError(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    const message = String(error?.message || error || '').toLowerCase();
    return code === 'ERR_SQLITE_ERROR'
      && message.includes('database is locked');
  }

  function isSharedAdminUsersPrismaClient(client = prisma) {
    if (!client || !prisma) return false;
    if (client === prisma) return true;
    const clientOriginal = client && typeof client === 'object' ? client._originalClient : null;
    const sharedOriginal = prisma && typeof prisma === 'object' ? prisma._originalClient : null;
    return Boolean(clientOriginal && sharedOriginal && clientOriginal === sharedOriginal);
  }

  function hasSharedAdminUsersSqliteCompatibility(client = prisma) {
    const key = getCompatibilityClientKey(client);
    return Boolean(key && sharedAdminUsersSqliteCompatibilityReady.has(key));
  }

  async function ensureSharedAdminUsersSqliteCompatibility(client = prisma) {
    const runtime = resolveDatabaseRuntime();
    const engine = String(runtime?.engine || '').trim().toLowerCase();
    const isSqlite = runtime?.isSqlite === true || engine === 'sqlite' || engine === 'unsupported';
    if (!isSqlite) return { ok: false, reason: 'runtime-not-sqlite' };
    if (!isSharedAdminUsersPrismaClient(client)) {
      return { ok: false, reason: 'shared-admin-users-client-unavailable' };
    }
    if (
      !client
      || typeof client.$queryRawUnsafe !== 'function'
      || typeof client.$executeRawUnsafe !== 'function'
    ) {
      return { ok: false, reason: 'sqlite-compatibility-db-unavailable' };
    }
    const delegate = getAdminUserDelegate();
    if (!delegate) {
      return { ok: false, reason: 'admin-users-delegate-unavailable' };
    }
    const key = getCompatibilityClientKey(client);
    if (key && sharedAdminUsersSqliteCompatibilityReady.has(key)) {
      return { ok: true, reused: true, tables: [] };
    }
    if (key && sharedAdminUsersSqliteCompatibilityPending.has(key)) {
      return sharedAdminUsersSqliteCompatibilityPending.get(key);
    }
    const work = (async () => {
      if (runtime?.filePath) {
        try {
          ensureSqliteDateTimeSchemaCompatibility(runtime.filePath, ADMIN_USERS_SQLITE_COMPATIBILITY_TABLES);
        } catch (error) {
          if (isSqliteCompatibilityLockError(error)) {
            return { ok: false, reason: 'admin-users-compatibility-locked' };
          }
          throw error;
        }
      }
      let table = null;
      try {
        table = await reconcileSqliteDateColumns(client, {
          tableName: 'admin_web_users',
          idColumn: 'username',
          dateColumns: ['created_at', 'updated_at'],
        });
      } catch (error) {
        if (shouldFallbackToLegacyAdminUserPersistence(error)) {
          return { ok: false, reason: 'admin-users-compatibility-unavailable' };
        }
        throw error;
      }
      if (key) {
        sharedAdminUsersSqliteCompatibilityReady.add(key);
      }
      return { ok: true, reused: false, tables: [table] };
    })().finally(() => {
      if (key) {
        sharedAdminUsersSqliteCompatibilityPending.delete(key);
      }
    });
    if (key) {
      sharedAdminUsersSqliteCompatibilityPending.set(key, work);
    }
    return work;
  }

  function assertLegacyAdminUsersRuntimeBootstrapAllowed(error) {
    const bootstrapPolicy = getLegacyAdminUsersRuntimeBootstrapPolicy();
    if (bootstrapPolicy.allowed) {
      return;
    }
    throw buildAdminUsersSchemaRequiredError({
      env: ADMIN_WEB_RUNTIME_BOOTSTRAP_ENV,
      engine: getAdminUsersDatabaseEngine(),
      reason: String(error?.message || error || '').trim() || null,
      bootstrapPolicy,
    });
  }

  function normalizeAdminUserRow(row) {
    if (!row) return null;
    return {
      username: String(row.username || '').trim(),
      passwordHash: String(row.passwordHash || '').trim(),
      role: normalizeRole(row.role || 'mod'),
      tenantId: String(row.tenantId || '').trim() || null,
      isActive: row.isActive === true || Number(row.isActive || 0) === 1,
      createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }

  function createAdminPasswordHash(password) {
    const pass = String(password || '');
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(pass, salt, 64);
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  function verifyAdminPassword(password, passwordHash) {
    const pass = String(password || '');
    const stored = String(passwordHash || '').trim();
    if (!stored) return false;

    if (!stored.startsWith('scrypt$')) {
      return secureEqual(pass, stored);
    }

    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const saltHex = parts[1];
    const hashHex = parts[2];
    if (!saltHex || !hashHex) return false;

    let salt;
    let expected;
    try {
      salt = Buffer.from(saltHex, 'hex');
      expected = Buffer.from(hashHex, 'hex');
    } catch {
      return false;
    }
    if (!salt.length || !expected.length) return false;

    const actual = crypto.scryptSync(pass, salt, expected.length);
    return secureEqual(actual.toString('hex'), expected.toString('hex'));
  }

  async function ensureAdminUsersLegacyTable() {
    const engine = getAdminUsersDatabaseEngine();
    try {
      if (engine === 'postgresql') {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS admin_web_users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'mod',
            tenant_id TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } else {
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
    } catch (error) {
      if (!isIgnorableAdminUsersSchemaError(error)) {
        throw error;
      }
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE admin_web_users
        ADD COLUMN tenant_id TEXT;
      `);
    } catch (error) {
      if (!isIgnorableAdminUsersSchemaError(error)) {
        throw error;
      }
    }
  }

  async function seedAdminUsersFromEnv() {
    const users = parseAdminUsersFromEnv();
    const delegate = getAdminUserDelegate();
    if (delegate) {
      await ensureSharedAdminUsersSqliteCompatibility(prisma);
      try {
        for (const user of users) {
          await delegate.upsert({
            where: { username: String(user.username || '').trim() },
            update: {},
            create: {
              username: String(user.username || '').trim(),
              passwordHash: createAdminPasswordHash(user.password),
              role: normalizeRole(user.role),
              tenantId: String(user.tenantId || '').trim() || null,
              isActive: true,
            },
          });
        }
        return { mode: 'delegate' };
      } catch (error) {
        if (!shouldFallbackToLegacyAdminUserPersistence(error)) {
          throw error;
        }
        assertLegacyAdminUsersRuntimeBootstrapAllowed(error);
      }
    }
    await ensureAdminUsersLegacyTable();
    for (const user of users) {
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
          ${String(user.username || '').trim()},
          ${createAdminPasswordHash(user.password)},
          ${normalizeRole(user.role)},
          ${String(user.tenantId || '').trim() || null},
          ${true},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (username) DO NOTHING
      `;
    }
    return { mode: 'legacy' };
  }

  async function listAdminUsersFromDb(limit = 100, options = {}) {
    if (envFallbackMode) {
      const normalizedLimit = Math.max(1, Math.trunc(Number(limit || 100)));
      const activeOnly = options?.activeOnly !== false;
      return getEnvAdminUserRows()
        .filter((row) => (activeOnly ? row.isActive === true : true))
        .slice(0, normalizedLimit)
        .map((row) => ({
          username: row.username,
          role: row.role,
          tenantId: row.tenantId,
          isActive: row.isActive,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }));
    }
    const { activeOnly = true } = options;
    const normalizedLimit = Math.max(1, Math.trunc(Number(limit || 100)));
    const delegate = getAdminUserDelegate();
    if (delegate) {
      await ensureSharedAdminUsersSqliteCompatibility(prisma);
      try {
        const rows = await delegate.findMany({
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { username: 'asc' },
          take: normalizedLimit,
        });
        return Array.isArray(rows)
          ? rows.map(normalizeAdminUserRow).filter(Boolean).map((row) => ({
            username: row.username,
            role: row.role,
            tenantId: row.tenantId,
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }))
          : [];
      } catch (error) {
        if (!shouldFallbackToLegacyAdminUserPersistence(error)) {
          throw error;
        }
        assertLegacyAdminUsersRuntimeBootstrapAllowed(error);
      }
    }
    const rows = activeOnly
      ? await prisma.$queryRaw`
        SELECT
          username,
          role,
          tenant_id AS "tenantId",
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM admin_web_users
        WHERE is_active = ${true}
        ORDER BY username ASC
        LIMIT ${normalizedLimit}
      `
      : await prisma.$queryRaw`
        SELECT
          username,
          role,
          tenant_id AS "tenantId",
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM admin_web_users
        ORDER BY username ASC
        LIMIT ${normalizedLimit}
      `;

    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const normalized = normalizeAdminUserRow(row);
      return {
        username: normalized.username,
        role: normalized.role,
        tenantId: normalized.tenantId,
        isActive: normalized.isActive,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
      };
    });
  }

  async function getAdminUserByUsername(username) {
    const name = String(username || '').trim();
    if (!name) return null;
    if (envFallbackMode) {
      return normalizeAdminUserRow(
        getEnvAdminUserRows().find((row) => row.username === name) || null,
      );
    }
    const delegate = getAdminUserDelegate();
    if (delegate) {
      await ensureSharedAdminUsersSqliteCompatibility(prisma);
      try {
        const row = await delegate.findUnique({
          where: { username: name },
        });
        return normalizeAdminUserRow(row);
      } catch (error) {
        if (!shouldFallbackToLegacyAdminUserPersistence(error)) {
          throw error;
        }
        assertLegacyAdminUsersRuntimeBootstrapAllowed(error);
      }
    }
    const rows = await prisma.$queryRaw`
      SELECT
        username,
        password_hash AS "passwordHash",
        role,
        tenant_id AS "tenantId",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM admin_web_users
      WHERE username = ${name}
      LIMIT 1
    `;
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return normalizeAdminUserRow(row);
  }

  async function countActiveOwnerUsers() {
    const delegate = getAdminUserDelegate();
    if (delegate) {
      await ensureSharedAdminUsersSqliteCompatibility(prisma);
      try {
        return await delegate.count({
          where: {
            isActive: true,
            role: 'owner',
          },
        });
      } catch (error) {
        if (!shouldFallbackToLegacyAdminUserPersistence(error)) {
          throw error;
        }
        assertLegacyAdminUsersRuntimeBootstrapAllowed(error);
      }
    }
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM admin_web_users
      WHERE is_active = ${true}
        AND lower(role) = 'owner'
    `;
    const total = Array.isArray(rows) && rows.length > 0
      ? Number(rows[0]?.total || 0)
      : 0;
    return Number.isFinite(total) ? total : 0;
  }

  function normalizeAdminUsername(value) {
    const username = String(value || '').trim();
    if (!username) return '';
    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) return '';
    return username;
  }

  async function upsertAdminUserInDb(input = {}) {
    const username = normalizeAdminUsername(input.username);
    const role = normalizeRole(input.role || 'mod');
    const isActive = input.isActive !== false;
    const password = String(input.password || '').trim();
    const tenantId = String(input.tenantId || '').trim() || null;
    if (!username) {
      throw new Error('Invalid username');
    }

    await ensureAdminUsersReady();
    if (envFallbackMode) {
      throw new Error('Admin user persistence is unavailable while the database is offline.');
    }
    const existing = await getAdminUserByUsername(username);
    if (!existing && !password) {
      throw new Error('Password is required for a new admin user');
    }

    const willRemainOwner = role === 'owner' && isActive;
    if (
      existing
      && existing.role === 'owner'
      && existing.isActive
      && !willRemainOwner
    ) {
      const ownerCount = await countActiveOwnerUsers();
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the last active owner');
      }
    }

    const delegate = getAdminUserDelegate();
    if (delegate) {
      await ensureSharedAdminUsersSqliteCompatibility(prisma);
      try {
        const passwordHash = password ? createAdminPasswordHash(password) : null;
        if (!existing) {
          await delegate.create({
            data: {
              username,
              passwordHash,
              role,
              tenantId,
              isActive,
            },
          });
        } else {
          await delegate.update({
            where: { username },
            data: {
              role,
              tenantId,
              isActive,
              ...(passwordHash ? { passwordHash } : {}),
            },
          });
        }
        return getAdminUserByUsername(username);
      } catch (error) {
        if (!shouldFallbackToLegacyAdminUserPersistence(error)) {
          throw error;
        }
        assertLegacyAdminUsersRuntimeBootstrapAllowed(error);
      }
    }

    if (!existing) {
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
          ${username},
          ${createAdminPasswordHash(password)},
          ${role},
          ${tenantId},
          ${isActive},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    } else if (password) {
      await prisma.$executeRaw`
        UPDATE admin_web_users
        SET password_hash = ${createAdminPasswordHash(password)},
            role = ${role},
            tenant_id = ${tenantId},
            is_active = ${isActive},
            updated_at = CURRENT_TIMESTAMP
        WHERE username = ${username}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE admin_web_users
        SET role = ${role},
            tenant_id = ${tenantId},
            is_active = ${isActive},
            updated_at = CURRENT_TIMESTAMP
        WHERE username = ${username}
      `;
    }

    return getAdminUserByUsername(username);
  }

  async function ensureAdminUsersReady() {
    if (adminUsersReadyPromise) return adminUsersReadyPromise;

    adminUsersReadyPromise = (async () => {
      try {
        await seedAdminUsersFromEnv();
        envFallbackMode = false;
        const users = await listAdminUsersFromDb(1);
        if (!users.length) {
          throw new Error('No active admin users in database');
        }
        return;
      } catch (error) {
        if (!shouldUseEnvAdminUsersFallback(error)) {
          throw error;
        }
        const envUsers = getEnvAdminUserRows().filter((row) => row.isActive === true);
        if (!envUsers.length) {
          throw error;
        }
        envFallbackMode = true;
        logger.warn('[admin-web] falling back to env-backed admin users:', error.message);
      }
    })().catch((error) => {
      adminUsersReadyPromise = null;
      throw error;
    });

    return adminUsersReadyPromise;
  }

  async function getUserByCredentials(username, password) {
    const name = String(username || '').trim();
    const pass = String(password || '');
    if (!name || !pass) return null;

    await ensureAdminUsersReady();
    const row = await getAdminUserByUsername(name);
    if (!row || row.isActive !== true) return null;
    if (!verifyAdminPassword(pass, row.passwordHash)) return null;

    return {
      username: row.username,
      role: row.role,
      tenantId: row.tenantId,
      authMethod: 'password-db',
    };
  }

  async function resolveAdminSessionAccessContext(input = {}) {
    const username = String(input.username || input.user || '').trim();
    if (!username) {
      return { ok: false, reason: 'admin-user-required' };
    }

    await ensureAdminUsersReady();
    const row = await getAdminUserByUsername(username);
    if (!row?.username) {
      return { ok: false, reason: 'admin-user-not-found' };
    }
    if (row.isActive !== true) {
      return {
        ok: false,
        reason: 'admin-user-inactive',
        user: row,
      };
    }

    return {
      ok: true,
      user: row,
      authContext: {
        user: row.username,
        role: row.role,
        tenantId: row.tenantId || null,
        authMethod: String(input.authMethod || 'password-db').trim() || 'password-db',
      },
    };
  }

  return {
    ensureAdminUsersReady,
    getAdminLoginPassword,
    getAdminToken,
    getUserByCredentials,
    resolveAdminSessionAccessContext,
    listAdminUsersFromDb,
    upsertAdminUserInDb,
  };
}

module.exports = {
  createAdminUserStoreRuntime,
};
