'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const rconDeliveryPath = path.join(rootDir, 'src', 'services', 'rconDelivery.js');
const depPaths = {
  config: path.join(rootDir, 'src', 'config.js'),
  prisma: path.join(rootDir, 'src', 'prisma.js'),
  linkStore: path.join(rootDir, 'src', 'store', 'linkStore.js'),
  deliveryAuditStore: path.join(rootDir, 'src', 'store', 'deliveryAuditStore.js'),
  deliveryEvidenceStore: path.join(rootDir, 'src', 'store', 'deliveryEvidenceStore.js'),
  memoryStore: path.join(rootDir, 'src', 'store', 'memoryStore.js'),
  adminLiveBus: path.join(rootDir, 'src', 'services', 'adminLiveBus.js'),
  itemIconService: path.join(rootDir, 'src', 'services', 'itemIconService.js'),
  wikiWeaponCatalog: path.join(rootDir, 'src', 'services', 'wikiWeaponCatalog.js'),
  wikiItemManifestCatalog: path.join(rootDir, 'src', 'services', 'wikiItemManifestCatalog.js'),
  scumAdminCommandCatalog: path.join(rootDir, 'src', 'services', 'scumAdminCommandCatalog.js'),
  commandTemplate: path.join(rootDir, 'src', 'utils', 'commandTemplate.js'),
  deliveryNativeProof: path.join(rootDir, 'src', 'services', 'deliveryNativeProof.js'),
  deliveryPersistenceDb: path.join(rootDir, 'src', 'services', 'deliveryPersistenceDb.js'),
  agentExecutionRoutingService: path.join(rootDir, 'src', 'domain', 'delivery', 'agentExecutionRoutingService.js'),
  consoleAgentClient: path.join(rootDir, 'src', 'integrations', 'scum', 'adapters', 'consoleAgentClient.js'),
};

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

function loadRconDeliveryWithMocks(mocks) {
  clearModule(rconDeliveryPath);
  for (const [key, modulePath] of Object.entries(depPaths)) {
    installMock(modulePath, mocks[key]);
  }
  return require(rconDeliveryPath);
}

function buildMockSet(scopeCalls) {
  return {
    config: {
      channels: {},
      delivery: {
        auto: {
          enabled: false,
          queueIntervalMs: 100,
          maxRetries: 1,
          retryDelayMs: 10,
          retryBackoff: 1,
          commandTimeoutMs: 500,
          failedStatus: 'delivery_failed',
          itemCommands: {},
        },
      },
    },
    prisma: {
      prisma: {
        deliveryQueueJob: { findMany: async () => [], upsert: async () => null, deleteMany: async () => null },
        deliveryDeadLetter: { findMany: async () => [], upsert: async () => null, deleteMany: async () => null },
      },
    },
    linkStore: {
      getLinkByUserId: () => null,
    },
    deliveryAuditStore: {
      addDeliveryAudit: () => null,
      listDeliveryAudit: () => [],
    },
    deliveryEvidenceStore: {
      appendDeliveryEvidenceEvent: () => null,
      getDeliveryEvidence: () => null,
    },
    memoryStore: {
      findPurchaseByCode: async () => null,
      setPurchaseStatusByCode: async () => null,
      getShopItemById: async () => null,
      getShopItemByName: async () => null,
      listPurchaseStatusHistory: () => [],
    },
    adminLiveBus: {
      publishAdminLiveUpdate: () => null,
    },
    itemIconService: {
      resolveItemIconUrl: () => null,
      normalizeItemIconKey: (value) => value,
      resolveCanonicalItemId: (value) => value,
    },
    wikiWeaponCatalog: {
      resolveWikiWeaponCommandTemplate: () => null,
    },
    wikiItemManifestCatalog: {
      resolveManifestItemCommandTemplate: () => null,
    },
    scumAdminCommandCatalog: {
      getBuiltInScumAdminCommandCapability: () => null,
      listBuiltInScumAdminCommandCapabilities: () => [],
      normalizeCommandTemplates: (value) => value,
    },
    commandTemplate: {
      executeCommandTemplate: async () => ({ ok: true }),
      validateCommandTemplate: () => ({ ok: true }),
    },
    deliveryNativeProof: {
      captureNativeProofBaseline: async () => null,
      normalizeDeliveryNativeProofMode: (value) => value,
      resolveConfiguredNativeProofScript: () => null,
      runDeliveryNativeProof: async () => ({ ok: true }),
    },
    deliveryPersistenceDb: {
      normalizeTenantId: (value) => {
        const text = String(value || '').trim();
        return text || null;
      },
      runWithDeliveryPersistenceScope: async (_tenantId, work) => work({
        deliveryQueueJob: { upsert: async () => null, deleteMany: async () => null },
        deliveryDeadLetter: { upsert: async () => null, deleteMany: async () => null },
      }),
      readAcrossDeliveryPersistenceScopes: async (_work, options = {}) => {
        scopeCalls.push({
          allowGlobal: options.allowGlobal,
          operation: options.operation,
        });
        return [];
      },
      groupRowsByTenant: () => new Map(),
    },
    agentExecutionRoutingService: {
      createAgentExecutionRoutingService: () => ({}),
    },
    consoleAgentClient: {
      requestConsoleAgent: async () => ({ ok: false, error: 'not-configured' }),
    },
  };
}

test('delivery persistence hydration declares explicit allowGlobal for queue and dead-letter reads', async () => {
  const scopeCalls = [];
  const api = loadRconDeliveryWithMocks(buildMockSet(scopeCalls));

  try {
    await api.initDeliveryPersistenceStore();
    assert.equal(scopeCalls.length >= 2, true);
    assert.deepEqual(
      scopeCalls.slice(0, 2),
      [
        {
          allowGlobal: true,
          operation: 'delivery queue persistence read',
        },
        {
          allowGlobal: true,
          operation: 'delivery dead-letter persistence read',
        },
      ],
    );
  } finally {
    clearModule(rconDeliveryPath);
    for (const modulePath of Object.values(depPaths)) {
      clearModule(modulePath);
    }
  }
});
