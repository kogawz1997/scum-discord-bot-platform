const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/raidService.js');
const tenantScopePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');
const dbEnginePath = path.resolve(__dirname, '../src/utils/dbEngine.js');

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
  const state = {
    requests: [],
    windows: [],
    summaries: [],
  };
  let requestId = 1;
  let windowId = 1;
  let summaryId = 1;
  const calls = [];

  const delegates = {
    platformRaidRequest: {
      async findMany({ where = {} } = {}) {
        calls.push({ delegate: 'request', method: 'findMany', where });
        return state.requests.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
      },
      async findUnique({ where = {} } = {}) {
        calls.push({ delegate: 'request', method: 'findUnique', where });
        return state.requests.find((row) => row.id === where.id) || null;
      },
      async create({ data = {} } = {}) {
        calls.push({ delegate: 'request', method: 'create', data });
        const row = {
          id: requestId++,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.requests.push(row);
        return row;
      },
      async update({ where = {}, data = {} } = {}) {
        calls.push({ delegate: 'request', method: 'update', where, data });
        const index = state.requests.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('not-found');
        state.requests[index] = {
          ...state.requests[index],
          ...data,
          updatedAt: new Date(),
        };
        return state.requests[index];
      },
    },
    platformRaidWindow: {
      async findMany({ where = {} } = {}) {
        calls.push({ delegate: 'window', method: 'findMany', where });
        return state.windows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
      },
      async create({ data = {} } = {}) {
        calls.push({ delegate: 'window', method: 'create', data });
        const row = {
          id: windowId++,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.windows.push(row);
        return row;
      },
      async update({ where = {}, data = {} } = {}) {
        calls.push({ delegate: 'window', method: 'update', where, data });
        const index = state.windows.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('not-found');
        state.windows[index] = {
          ...state.windows[index],
          ...data,
          updatedAt: new Date(),
        };
        return state.windows[index];
      },
    },
    platformRaidSummary: {
      async findMany({ where = {} } = {}) {
        calls.push({ delegate: 'summary', method: 'findMany', where });
        return state.summaries.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
      },
      async create({ data = {} } = {}) {
        calls.push({ delegate: 'summary', method: 'create', data });
        const row = {
          id: summaryId++,
          createdAt: new Date(),
          ...data,
        };
        state.summaries.push(row);
        return row;
      },
    },
  };

  return { state, calls, delegates };
}

function loadService({ runtime, scope }) {
  clearModule(servicePath);
  installMock(dbEnginePath, {
    resolveDatabaseRuntime() {
      return runtime;
    },
  });
  installMock(tenantScopePath, {
    normalizeServerScopeId(value) {
      return String(value || '').trim() || null;
    },
    resolveTenantStoreScope() {
      return scope;
    },
  });
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(tenantScopePath);
  clearModule(dbEnginePath);
});

test('raid service uses prisma delegates on server-engine runtimes', async () => {
  const harness = createDelegateHarness();
  const service = loadService({
    runtime: { isServerEngine: true, engine: 'postgresql', provider: 'postgresql' },
    scope: {
      tenantId: 'tenant-raid',
      datasourceKey: 'tenant-raid',
      db: harness.delegates,
    },
  });

  const createdRequest = await service.createRaidRequest({
    tenantId: 'tenant-raid',
    requesterUserId: 'discord-1',
    requesterName: 'Mira',
    requestText: 'West compound push',
    serverId: 'server-1',
  });
  assert.equal(createdRequest.ok, true);
  assert.equal(createdRequest.request.tenantId, 'tenant-raid');

  const createdWindow = await service.createRaidWindow({
    tenantId: 'tenant-raid',
    requestId: createdRequest.request.id,
    title: 'Friday window',
    startsAt: '2026-04-01T15:00:00.000Z',
    actor: 'admin-web',
    serverId: 'server-1',
  });
  assert.equal(createdWindow.ok, true);
  assert.equal(createdWindow.window.tenantId, 'tenant-raid');

  const reviewed = await service.reviewRaidRequest({
    tenantId: 'tenant-raid',
    id: createdRequest.request.id,
    status: 'approved',
    reviewedBy: 'tenant-admin',
  });
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.request.status, 'approved');

  const createdSummary = await service.createRaidSummary({
    tenantId: 'tenant-raid',
    requestId: createdRequest.request.id,
    windowId: createdWindow.window.id,
    outcome: 'Raid completed',
    createdBy: 'tenant-admin',
    serverId: 'server-1',
  });
  assert.equal(createdSummary.ok, true);
  assert.equal(createdSummary.summary.tenantId, 'tenant-raid');

  const snapshot = await service.listRaidActivitySnapshot({
    tenantId: 'tenant-raid',
    serverId: 'server-1',
  });
  assert.equal(snapshot.requests.length, 1);
  assert.equal(snapshot.windows.length, 1);
  assert.equal(snapshot.summaries.length, 1);
  assert.equal(harness.calls.some((entry) => entry.method === 'create'), true);
});

test('raid service requires prisma delegates on server-engine runtimes', async () => {
  const service = loadService({
    runtime: { isServerEngine: true, engine: 'postgresql', provider: 'postgresql' },
    scope: {
      tenantId: 'tenant-raid',
      datasourceKey: 'tenant-raid',
      db: {},
    },
  });

  await assert.rejects(
    () => service.ensureRaidTables({ tenantId: 'tenant-raid' }),
    (error) => String(error?.code || '') === 'PLATFORM_RAID_SCHEMA_REQUIRED',
  );
});
