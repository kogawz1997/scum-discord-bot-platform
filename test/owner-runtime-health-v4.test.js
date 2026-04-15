const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildOwnerRuntimeHealthV4Html,
  createOwnerRuntimeHealthV4Model,
} = require('../src/admin/assets/owner-runtime-health-v4.js');

test('owner runtime health v4 model maps runtime, incident, and hotspot state', () => {
  const model = createOwnerRuntimeHealthV4Model({
    runtimeSupervisor: {
      services: [
        { name: 'bot', status: 'ready' },
        { name: 'watcher', status: 'degraded' },
      ],
    },
    agents: [
      {
        runtimeKey: 'execute-alpha',
        status: 'online',
        lastSeenAt: '2026-03-26T11:29:00+07:00',
        tenantId: 'tenant-alpha',
        tenantName: 'Alpha Tenant',
        meta: {
          agentRole: 'execute',
          agentScope: 'execute_only',
          serverName: 'Alpha Prime',
        },
      },
      {
        runtimeKey: 'sync-alpha',
        status: 'degraded',
        lastSeenAt: '2026-03-26T11:21:00+07:00',
        tenantId: 'tenant-beta',
        tenantName: 'Beta Tenant',
        meta: {
          agentRole: 'sync',
          agentScope: 'sync_only',
          serverName: 'Beta Core',
        },
      },
    ],
    notifications: [
      { severity: 'warning', title: 'Watcher sync is behind', createdAt: '2026-03-26T11:18:00+07:00' },
    ],
    requestLogs: {
      items: [{ method: 'GET', path: '/admin/api/platform/overview', statusCode: 503, error: 'timeout', at: '2026-03-26T11:12:00+07:00' }],
      metrics: {
        slowRequests: 12,
        routeHotspots: [{ routeGroup: 'admin.platform', requests: 164, errors: 3, p95LatencyMs: 842 }],
      },
    },
    deliveryLifecycle: { summary: { deadLetterCount: 3 } },
  });

  assert.equal(model.header.title, 'สถานะระบบและเหตุการณ์');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.runtimeRows.length, 2);
  assert.equal(model.agentRows.length, 2);
  const executeRow = model.agentRows.find((row) => row.runtime === 'execute-alpha');
  const syncRow = model.agentRows.find((row) => row.runtime === 'sync-alpha');
  assert.equal(executeRow.runtimeKind, 'delivery-agents');
  assert.equal(executeRow.handoffHref, '/tenant/runtimes/delivery-agents?tenantId=tenant-alpha');
  assert.equal(syncRow.runtimeKind, 'server-bots');
  assert.equal(syncRow.handoffHref, '/tenant/runtimes/server-bots?tenantId=tenant-beta');
  assert.equal(model.hotspots.length, 1);
});

test('owner runtime health v4 model builds fleet watch and attention queue from registry state', () => {
  const model = createOwnerRuntimeHealthV4Model({
    tenants: [
      { id: 'tenant-alpha', name: 'Alpha Tenant' },
      { id: 'tenant-beta', name: 'Beta Tenant' },
    ],
    agentRegistry: [
      {
        tenantId: 'tenant-alpha',
        tenantName: 'Alpha Tenant',
        serverId: 'server-alpha',
        serverName: 'Alpha Prime',
        agentId: 'agent-execute-1',
        runtimeKey: 'execute-alpha',
        role: 'execute',
        scope: 'execute_only',
        bindings: [{ apiKeyId: 'api-key-alpha', minVersion: '1.5.0' }],
        runtime: {
          runtimeKey: 'execute-alpha',
          status: 'online',
          version: '1.4.2',
          lastSeenAt: '2026-03-26T11:29:00+07:00',
          channel: 'beta',
          meta: { agentRole: 'execute', agentScope: 'execute_only' },
        },
      },
    ],
    agentProvisioning: [
      {
        id: 'token-beta',
        tenantId: 'tenant-beta',
        serverId: 'server-beta',
        agentId: 'agent-sync-1',
        runtimeKey: 'sync-beta',
        displayName: 'Sync Beta',
        role: 'sync',
        scope: 'sync_only',
        status: 'pending_activation',
      },
      {
        id: 'token-orphan',
        serverId: 'server-gamma',
        agentId: 'agent-execute-2',
        runtimeKey: 'execute-orphan',
        displayName: 'Execute Orphan',
        role: 'execute',
        scope: 'execute_only',
        status: 'pending_activation',
      },
    ],
    agentDevices: [
      {
        id: 'device-alpha',
        tenantId: 'tenant-alpha',
        serverId: 'server-alpha',
        agentId: 'agent-execute-1',
        runtimeKey: 'execute-alpha',
        hostname: 'machine-a',
        lastSeenAt: '2026-03-26T11:28:00+07:00',
      },
    ],
  });

  assert.equal(model.fleetWatch.length, 6);
  assert.equal(model.attentionRows.length, 3);
  assert.equal(model.attentionGroups.length, 5);
  assert.equal(model.fleetWatch[1].value, '2');
  assert.equal(model.fleetWatch[3].value, '1');
  assert.equal(model.fleetWatch[4].value, '1');
  assert.equal(model.attentionRows[0].attentionKey, 'missing-tenant-scope');
  assert.equal(model.attentionRows[1].attentionKey, 'version-gap');
  assert.equal(model.attentionRows[2].attentionKey, 'binding-gap');
  assert.deepEqual(model.attentionGroups.map((group) => group.key), ['pending-activation', 'binding-gap', 'version-gap', 'scope-issues', 'offline-or-stale']);
});

test('owner runtime health v4 html includes runtime matrix and hotspot table', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({}));
  assert.match(html, /บริการที่ต้องเฝ้าดู/);
  assert.match(html, /สัญญาณที่เจ้าของระบบควรรู้ตอนนี้/);
  assert.match(html, /จุดร้อนของคำขอ/);
});

test('owner runtime health v4 html exposes tenant runtime handoff actions', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({
    agents: [
      {
        runtimeKey: 'execute-alpha',
        status: 'online',
        lastSeenAt: '2026-03-26T11:29:00+07:00',
        tenantId: 'tenant-alpha',
        tenantName: 'Alpha Tenant',
        meta: {
          agentRole: 'execute',
          agentScope: 'execute_only',
          serverName: 'Alpha Prime',
        },
      },
      {
        runtimeKey: 'sync-beta',
        status: 'ready',
        lastSeenAt: '2026-03-26T11:31:00+07:00',
        tenantId: 'tenant-beta',
        tenantName: 'Beta Tenant',
        meta: {
          agentRole: 'sync',
          agentScope: 'sync_only',
          serverName: 'Beta Core',
        },
      },
    ],
  }));

  assert.match(html, /data-owner-runtime-handoff="delivery-agents"/);
  assert.match(html, /data-owner-runtime-handoff="server-bots"/);
  assert.match(html, /\/tenant\/runtimes\/delivery-agents\?tenantId=tenant-alpha/);
  assert.match(html, /\/tenant\/runtimes\/server-bots\?tenantId=tenant-beta/);
});

test('owner runtime health v4 html exposes owner fleet watch and attention queue', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({
    tenants: [{ id: 'tenant-alpha', name: 'Alpha Tenant' }],
    agentProvisioning: [
      {
        id: 'token-alpha',
        tenantId: 'tenant-alpha',
        serverId: 'server-alpha',
        agentId: 'agent-sync-1',
        runtimeKey: 'sync-alpha',
        displayName: 'Sync Alpha',
        role: 'sync',
        scope: 'sync_only',
        status: 'pending_activation',
      },
    ],
  }));

  assert.match(html, /data-owner-runtime-fleet-watch="jobs"/);
  assert.match(html, /data-owner-runtime-attention-table="true"/);
  assert.match(html, /data-owner-runtime-attention-filters="true"/);
  assert.match(html, /data-owner-runtime-attention-filter="pending-activation"/);
  assert.match(html, /data-owner-runtime-attention-group="pending-activation"/);
  assert.match(html, /data-owner-runtime-action="tenant-runtime"/);
  assert.match(html, /data-owner-runtime-action="tenant-detail"/);
  assert.match(html, /\/owner\/tenants\/tenant-alpha/);
  assert.match(html, /Runtime fleet management/);
  assert.match(html, /Owner attention queue/);
});

test('owner runtime health v4 attention queue exposes remediation actions by attention type', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({
    tenants: [
      { id: 'tenant-alpha', name: 'Alpha Tenant' },
      { id: 'tenant-beta', name: 'Beta Tenant' },
    ],
    agentRegistry: [
      {
        tenantId: 'tenant-alpha',
        tenantName: 'Alpha Tenant',
        serverId: 'server-alpha',
        serverName: 'Alpha Prime',
        agentId: 'agent-execute-1',
        runtimeKey: 'execute-alpha',
        role: 'execute',
        scope: 'execute_only',
        bindings: [{ apiKeyId: 'api-key-alpha', minVersion: '1.5.0' }],
        runtime: {
          runtimeKey: 'execute-alpha',
          status: 'online',
          version: '1.4.2',
          lastSeenAt: '2026-03-26T11:29:00+07:00',
          channel: 'beta',
          meta: { agentRole: 'execute', agentScope: 'execute_only' },
        },
      },
    ],
    agentProvisioning: [
      {
        id: 'token-orphan',
        serverId: 'server-gamma',
        agentId: 'agent-execute-2',
        runtimeKey: 'execute-orphan',
        displayName: 'Execute Orphan',
        role: 'execute',
        scope: 'execute_only',
        status: 'pending_activation',
      },
    ],
    agentDevices: [
      {
        id: 'device-alpha',
        tenantId: 'tenant-alpha',
        serverId: 'server-alpha',
        agentId: 'agent-execute-1',
        runtimeKey: 'execute-alpha',
        hostname: 'machine-a',
        lastSeenAt: '2026-03-26T11:28:00+07:00',
      },
    ],
  }));

  assert.match(html, /data-owner-runtime-action="support"/);
  assert.match(html, /data-owner-runtime-action="observability"/);
  assert.match(html, /data-owner-runtime-action="incidents"/);
  assert.match(html, /\/owner\/support\/tenant-alpha/);
  assert.match(html, /#observability/);
  assert.match(html, /#incidents/);
});

test('owner runtime health v4 model exposes recovery strip and backup metadata for the recovery route', () => {
  const model = createOwnerRuntimeHealthV4Model({
    restoreState: {
      status: 'failed',
      previewBackup: 'backup-shared-1.json',
      previewToken: 'preview-token-1',
      previewExpiresAt: '2026-04-07T15:00:00+07:00',
    },
    backupFiles: [
      {
        id: 'backup-1',
        file: 'backup-shared-1.json',
        sizeBytes: 4096,
        createdAt: '2026-04-07T14:00:00+07:00',
        updatedAt: '2026-04-07T14:05:00+07:00',
      },
    ],
    restoreHistory: [
      {
        operationId: 'restore-1',
        status: 'succeeded',
        backup: 'backup-shared-1.json',
        recordedAt: '2026-04-07T14:10:00+07:00',
        verification: { ready: true },
      },
    ],
  }, { currentRoute: 'recovery' });

  assert.equal(model.routeView.blockOrder[0], 'recovery');
  assert.equal(model.recoveryStrip.length, 4);
  assert.equal(model.backupFiles.length, 1);
  assert.equal(model.restoreHistory.length, 1);
});

test('owner runtime health v4 html exposes the recovery workbench on the recovery route', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({
    restoreState: {
      status: 'idle',
      previewBackup: 'backup-shared-1.json',
      previewToken: 'preview-token-1',
    },
    restorePreview: {
      backup: 'backup-shared-1.json',
      previewToken: 'preview-token-1',
      warnings: ['Review wallet counts'],
      verificationPlan: {
        checks: [{ id: 'wallets', label: 'Wallet counts' }],
      },
    },
    backupFiles: [
      {
        id: 'backup-1',
        file: 'backup-shared-1.json',
        sizeBytes: 4096,
        createdAt: '2026-04-07T14:00:00+07:00',
        updatedAt: '2026-04-07T14:05:00+07:00',
      },
    ],
    restoreHistory: [
      {
        operationId: 'restore-1',
        status: 'succeeded',
        backup: 'backup-shared-1.json',
        recordedAt: '2026-04-07T14:10:00+07:00',
        verification: { ready: true },
      },
    ],
  }, { currentRoute: 'recovery' }));

  assert.match(html, /data-owner-runtime-recovery="true"/);
  assert.match(html, /data-owner-form="backup-create"/);
  assert.match(html, /data-owner-form="backup-preview"/);
  assert.match(html, /data-owner-form="backup-restore"/);
  assert.match(html, /data-owner-runtime-preview-card="true"/);
  assert.match(html, /data-owner-runtime-backup-table="true"/);
  assert.match(html, /data-owner-runtime-restore-history="true"/);
  assert.match(html, /Backup \/ Restore Manager/);
});

test('owner runtime health v4 highlights the selected owner sidebar route and exposes focus targets', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({}, { currentRoute: 'security' }));
  assert.match(html, /id="runtime-health"/);
  assert.match(html, /id="jobs"/);
  assert.match(html, /id="incidents"/);
  assert.match(html, /id="observability"/);
  assert.match(html, /odv4-nav-link odv4-nav-link-current" href="#security"/);
});

test('owner runtime preview references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'owner-runtime-health-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');
  assert.match(html, /\.\.\/assets\/owner-runtime-health-v4\.css/);
  assert.match(html, /\.\.\/assets\/owner-runtime-health-v4\.js/);
  assert.match(html, /ownerRuntimeHealthV4PreviewRoot/);
});
