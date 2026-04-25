const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminPlatformPostRoutes,
} = require('../src/admin/api/adminPlatformPostRoutes');
const {
  buildTenantProductEntitlements,
} = require('../src/domain/billing/productEntitlementService');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = null) {
      this.ended = true;
      this.body = body;
    },
  };
}

function buildRoutes(overrides = {}) {
  return createAdminPlatformPostRoutes({
    sendJson(res, statusCode, payload, headers = {}) {
      res.writeHead(statusCode, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(payload));
    },
    requiredString(value, key) {
      if (value && typeof value === 'object' && key) {
        return String(value[key] || '').trim();
      }
      return String(value || '').trim();
    },
    parseStringArray: () => [],
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [
        'server_settings',
        'restart_control',
        'sync_agent',
        'execute_agent',
        'staff_roles',
      ],
    }),
    buildTenantProductEntitlements,
    consumeAdminActionRateLimit: () => ({ limited: false, retryAfterMs: 0 }),
    getClientIp: () => '127.0.0.1',
    publishAdminLiveUpdate: () => {},
    listPlatformSubscriptions: async () => [],
    ...overrides,
  });
}

test('server config save route records governance audit and passes request metadata to config service', async () => {
  const auditCalls = [];
  let seenInput = null;
  const handler = buildRoutes({
    createServerConfigSaveJob: async (input) => {
      seenInput = input;
      return { ok: true, job: { id: 'cfgjob-1', meta: { audit: { jobId: 'cfgjob-1' } } } };
    },
    recordAdminSecuritySignal: (type, payload) => auditCalls.push({ type, payload }),
  });
  const res = createMockRes();

  const handled = await handler({
    req: {
      method: 'POST',
      headers: {},
      __adminRequestMeta: { requestId: 'req-config-1' },
    },
    res,
    pathname: '/admin/api/platform/servers/server-1/config/save',
    body: {
      tenantId: 'tenant-1',
      applyMode: 'save_only',
      reason: 'operator tune',
      changes: [{ file: 'ServerSettings.ini', section: 'General', key: 'ServerName', value: 'Alpha' }],
    },
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seenInput.requestId, 'req-config-1');
  assert.equal(seenInput.actorRole, 'admin');
  assert.equal(seenInput.reason, 'operator tune');
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].type, 'server.config.save');
  assert.equal(auditCalls[0].payload.data.governance, true);
  assert.equal(auditCalls[0].payload.data.actionType, 'server.config.save');
  assert.equal(auditCalls[0].payload.data.tenantId, 'tenant-1');
  assert.equal(auditCalls[0].payload.data.serverId, 'server-1');
  assert.equal(auditCalls[0].payload.data.requestId, 'req-config-1');
  assert.equal(auditCalls[0].payload.data.resultStatus, 'queued');
});

test('agent provisioning route emits governance audit without leaking raw setup token', async () => {
  const auditCalls = [];
  const handler = buildRoutes({
    createPlatformAgentProvisioningToken: async () => ({
      ok: true,
      token: { id: 'setup-1', tenantId: 'tenant-1', serverId: 'server-1' },
      rawSetupToken: 'stp_secret.secret',
      bootstrap: { setupToken: 'stp_secret.secret' },
    }),
    recordAdminSecuritySignal: (type, payload) => auditCalls.push({ type, payload }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: {
      method: 'POST',
      headers: {},
      __adminRequestMeta: { requestId: 'req-agent-1' },
    },
    res,
    pathname: '/admin/api/platform/agent-provision',
    body: {
      tenantId: 'tenant-1',
      serverId: 'server-1',
      guildId: 'guild-1',
      agentId: 'sync-1',
      runtimeKey: 'sync-runtime',
      role: 'sync',
      scope: 'sync_only',
      runtimeKind: 'server-bots',
      name: 'Server Bot',
      displayName: 'Server Bot',
      minimumVersion: '1.0.0',
    },
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(auditCalls.length, 1);
  const auditJson = JSON.stringify(auditCalls[0]);
  assert.equal(auditCalls[0].type, 'agent.provision.issue');
  assert.equal(auditCalls[0].payload.data.governance, true);
  assert.equal(auditCalls[0].payload.data.targetId, 'setup-1');
  assert.equal(auditCalls[0].payload.data.runtimeKey, 'sync-runtime');
  assert.doesNotMatch(auditJson, /stp_secret/);
});

test('platform package and staff role mutations emit governance audit events', async () => {
  const auditCalls = [];
  const handler = buildRoutes({
    updatePackageCatalogEntry: async (input) => ({ ok: true, package: { id: input.id, status: input.status } }),
    updateTenantStaffRole: async (input) => ({ ok: true, staff: { id: input.membershipId, role: input.role } }),
    recordAdminSecuritySignal: (type, payload) => auditCalls.push({ type, payload }),
  });

  const packageRes = createMockRes();
  await handler({
    req: { method: 'POST', headers: {}, __adminRequestMeta: { requestId: 'req-package-1' } },
    res: packageRes,
    pathname: '/admin/api/platform/package/update',
    body: {
      id: 'FULL_OPTION',
      title: 'Full Option',
      status: 'active',
      currency: 'THB',
      billingCycle: 'monthly',
    },
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  const staffRes = createMockRes();
  await handler({
    req: { method: 'POST', headers: {}, __adminRequestMeta: { requestId: 'req-staff-1' } },
    res: staffRes,
    pathname: '/admin/api/platform/tenant-staff/role',
    body: {
      tenantId: 'tenant-1',
      membershipId: 'member-1',
      userId: 'user-1',
      role: 'operator',
      status: 'active',
    },
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(packageRes.statusCode, 200);
  assert.equal(staffRes.statusCode, 200);
  assert.deepEqual(auditCalls.map((entry) => entry.type), [
    'package.update',
    'staff.role.change',
  ]);
  assert.equal(auditCalls[0].payload.data.targetType, 'package');
  assert.equal(auditCalls[0].payload.data.targetId, 'FULL_OPTION');
  assert.equal(auditCalls[1].payload.data.tenantId, 'tenant-1');
  assert.equal(auditCalls[1].payload.data.targetType, 'tenant_staff');
  assert.equal(auditCalls[1].payload.data.requestId, 'req-staff-1');
});
