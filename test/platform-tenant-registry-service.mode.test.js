const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlatformTenantRegistryService,
} = require('../src/services/platformTenantRegistryService');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null;
}

function normalizeTenantType(value) {
  const text = String(value || '').trim().toLowerCase();
  return ['direct', 'trial', 'reseller', 'demo'].includes(text) ? text : 'direct';
}

function normalizeStatus(value, allowed = ['active']) {
  const text = String(value || '').trim().toLowerCase();
  return allowed.includes(text) ? text : allowed[0];
}

function normalizeLocale(value) {
  return String(value || '').trim().toLowerCase() || 'th';
}

test('platform tenant registry requires explicit allowGlobal for global listing in strict mode', async () => {
  const calls = [];
  const service = createPlatformTenantRegistryService({
    prisma: {
      platformTenant: {
        findMany: async (args) => {
          calls.push(args);
          return [];
        },
      },
    },
    trimText,
    createId: () => 'tenant-id',
    normalizeSlug,
    normalizeTenantType,
    normalizeStatus,
    normalizeLocale,
    stringifyMeta: (value) => value,
    sanitizeTenantRow: (row) => row,
    assertTenantDbIsolationScope({ tenantId, allowGlobal, operation }) {
      if (!tenantId && allowGlobal !== true) {
        const error = new Error(`${operation} requires tenantId`);
        error.code = 'TENANT_DB_SCOPE_REQUIRED';
        throw error;
      }
      return { tenantId: tenantId || null, allowGlobal: allowGlobal === true };
    },
    getTenantDatabaseTopologyMode: () => 'shared',
    ensureTenantDatabaseTargetProvisioned: () => {},
    emitPlatformEvent: async () => {},
  });

  await assert.rejects(
    () => service.listPlatformTenants({ limit: 10 }),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.equal(calls.length, 0);

  await service.listPlatformTenants({ allowGlobal: true, limit: 10 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.where || {}, {});
});

test('platform tenant registry scopes tenant listing by tenantId when provided', async () => {
  const calls = [];
  const service = createPlatformTenantRegistryService({
    prisma: {
      platformTenant: {
        findMany: async (args) => {
          calls.push(args);
          return [{ id: 'tenant-a' }];
        },
      },
    },
    trimText,
    createId: () => 'tenant-id',
    normalizeSlug,
    normalizeTenantType,
    normalizeStatus,
    normalizeLocale,
    stringifyMeta: (value) => value,
    sanitizeTenantRow: (row) => row,
    assertTenantDbIsolationScope({ tenantId, allowGlobal }) {
      return { tenantId: tenantId || null, allowGlobal: allowGlobal === true };
    },
    getTenantDatabaseTopologyMode: () => 'shared',
    ensureTenantDatabaseTargetProvisioned: () => {},
    emitPlatformEvent: async () => {},
  });

  const rows = await service.listPlatformTenants({ tenantId: 'tenant-a', limit: 5 });
  assert.equal(rows.length, 1);
  assert.equal(String(calls[0]?.where?.id || ''), 'tenant-a');
});
