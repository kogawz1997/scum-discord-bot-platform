const test = require('node:test');
const assert = require('node:assert/strict');

const storeScopePath = require.resolve('../src/store/tenantStoreScope');
const servicePath = require.resolve('../src/services/killFeedService');
const originalStoreScopeModule = require(storeScopePath);

function loadKillFeedServiceWithScope(scope) {
  delete require.cache[servicePath];
  require.cache[storeScopePath].exports = {
    ...originalStoreScopeModule,
    resolveTenantServerStoreScope() {
      return scope;
    },
  };
  return require(servicePath);
}

function restoreModules() {
  require.cache[storeScopePath].exports = originalStoreScopeModule;
  delete require.cache[servicePath];
}

test('listKillFeedEntries returns empty list when tenant kill feed table is missing', async (t) => {
  t.after(restoreModules);
  const missingTableError = Object.assign(
    new Error('The table `tenant_demo.kill_feed_events` does not exist in the current database.'),
    {
      code: 'P2021',
      meta: {
        table: 'tenant_demo.kill_feed_events',
      },
    },
  );
  const killFeedService = loadKillFeedServiceWithScope({
    tenantId: 'tenant-demo',
    serverId: 'server-demo',
    db: {
      killFeedEvent: {
        async findMany() {
          throw missingTableError;
        },
      },
    },
  });

  const items = await killFeedService.listKillFeedEntries({
    tenantId: 'tenant-demo',
    serverId: 'server-demo',
    limit: 20,
  });

  assert.deepEqual(items, []);
});

test('listKillFeedEntries rethrows unexpected database failures', async (t) => {
  t.after(restoreModules);
  const dbError = Object.assign(new Error('database temporarily unavailable'), {
    code: 'P1001',
  });
  const killFeedService = loadKillFeedServiceWithScope({
    tenantId: 'tenant-demo',
    serverId: 'server-demo',
    db: {
      killFeedEvent: {
        async findMany() {
          throw dbError;
        },
      },
    },
  });

  await assert.rejects(
    () => killFeedService.listKillFeedEntries({
      tenantId: 'tenant-demo',
      serverId: 'server-demo',
      limit: 20,
    }),
    /database temporarily unavailable/,
  );
});
