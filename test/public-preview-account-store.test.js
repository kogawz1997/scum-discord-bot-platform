const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/publicPreviewAccountStore.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function createDelegateHarness() {
  const rows = new Map();

  function clone(row) {
    return row ? JSON.parse(JSON.stringify(row)) : row;
  }

  return {
    delegate: {
      async findMany() {
        return Array.from(rows.values()).sort((left, right) => {
          return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
        }).map(clone);
      },
      async findUnique({ where }) {
        if (where?.id) {
          return clone(rows.get(String(where.id)));
        }
        if (where?.email) {
          return clone(
            Array.from(rows.values()).find((row) => String(row.email || '') === String(where.email || '')) || null,
          );
        }
        return null;
      },
      async create({ data }) {
        const duplicate = Array.from(rows.values()).find((row) => row.email === data.email);
        if (duplicate) {
          const error = new Error('unique');
          error.code = 'P2002';
          throw error;
        }
        const now = new Date().toISOString();
        const row = {
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        rows.set(String(row.id), clone(row));
        return clone(row);
      },
      async update({ where, data }) {
        const current = rows.get(String(where.id));
        if (!current) {
          const error = new Error('missing');
          error.code = 'P2025';
          throw error;
        }
        const duplicate = Array.from(rows.values()).find((row) => {
          return row.id !== current.id && row.email === data.email;
        });
        if (duplicate) {
          const error = new Error('unique');
          error.code = 'P2002';
          throw error;
        }
        const next = {
          ...current,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        rows.set(String(next.id), clone(next));
        return clone(next);
      },
    },
    snapshot() {
      return Array.from(rows.values()).map(clone);
    },
  };
}

function loadStoreWithMocks(delegate) {
  clearModule(storePath);
  installMock(prismaPath, {
    prisma: {
      platformPreviewAccount: delegate,
    },
  });
  return require(storePath);
}

test.afterEach(() => {
  clearModule(storePath);
  clearModule(prismaPath);
});

test('public preview account store persists preview accounts through the prisma delegate when available', async () => {
  const harness = createDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  const created = await store.createPreviewAccount({
    id: 'preview-1',
    email: 'demo@example.com',
    passwordHash: 'scrypt$abc$def',
    displayName: 'Demo',
    communityName: 'Demo Community',
    locale: 'th',
    packageId: 'BOT_LOG_DELIVERY',
    linkedIdentities: {
      discordLinked: true,
      steamLinked: false,
      playerMatched: false,
      discordVerified: false,
      fullyVerified: false,
    },
  });

  assert.equal(created.email, 'demo@example.com');
  assert.equal(created.displayName, 'Demo');
  assert.equal(created.linkedIdentities.discordLinked, true);

  const rawByEmail = await store.getPreviewAccountByEmail('demo@example.com');
  assert.equal(rawByEmail.passwordHash, 'scrypt$abc$def');
  assert.equal(rawByEmail.communityName, 'Demo Community');

  const updated = await store.updatePreviewAccount('preview-1', {
    lastLoginAt: '2026-03-28T00:00:00.000Z',
    linkedIdentities: {
      steamLinked: true,
    },
  });

  assert.equal(updated.lastLoginAt, '2026-03-28T00:00:00.000Z');
  assert.equal(updated.linkedIdentities.discordLinked, true);
  assert.equal(updated.linkedIdentities.steamLinked, true);

  const rawById = await store.getPreviewAccountById('preview-1');
  assert.equal(rawById.passwordHash, 'scrypt$abc$def');
  assert.equal(rawById.linkedIdentities.steamLinked, true);

  const listed = await store.listPreviewAccounts();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].email, 'demo@example.com');
  assert.equal(harness.snapshot().length, 1);
});

test('public preview account store fails fast when prisma delegate is unavailable', async () => {
  const store = loadStoreWithMocks(null);

  await assert.rejects(
    () => store.listPreviewAccounts(),
    /platform-preview-account-delegate-unavailable/,
  );
});
