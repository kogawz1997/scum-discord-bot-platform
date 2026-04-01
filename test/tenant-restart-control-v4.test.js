const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantRestartControlV4Html,
  createTenantRestartControlV4Model,
} = require('../src/admin/assets/tenant-restart-control-v4.js');

test('tenant restart control v4 model builds blockers and mode cards', () => {
  const model = createTenantRestartControlV4Model({
    tenantConfig: { name: 'SCUM TH Production' },
    serverStatus: 'ready',
    deliveryRuntime: { status: 'degraded', mode: 'agent' },
    queueItems: [{}, {}],
    deadLetters: [{}],
    serverBotReady: false,
    restartHistory: [{ at: '2026-03-26T08:00:00+07:00', mode: 'safe-restart', result: 'success', actor: 'owner' }],
  });

  assert.equal(typeof model.header.title, 'string');
  assert.equal(model.modeCards.length, 5);
  assert.ok(model.blockers.length >= 3);
  assert.equal(model.history.length, 1);
});

test('tenant restart control v4 html includes action buttons and blockers', () => {
  const html = buildTenantRestartControlV4Html(createTenantRestartControlV4Model({ tenantConfig: { name: 'Tenant Demo' } }));

  assert.match(html, /tdv4-mode-grid/);
  assert.match(html, /tdv4-restart-summary-strip/);
  assert.match(html, /Scheduled \/ verification/);
  assert.match(html, /Blockers/);
  assert.match(html, /tdv4-action-list/);
  assert.match(html, /data-restart-action-button/);
});

test('tenant restart control v4 derives history from restart plans and executions', () => {
  const model = createTenantRestartControlV4Model({
    restartPlans: [{
      id: 'rplan-1',
      requestedBy: 'owner',
      restartMode: 'safe_restart',
      scheduledFor: '2026-03-26T08:00:00+07:00',
      status: 'executed',
    }],
    restartExecutions: [{
      id: 'rexec-1',
      planId: 'rplan-1',
      action: 'restart',
      resultStatus: 'succeeded',
      completedAt: '2026-03-26T08:03:00+07:00',
    }],
  });

  assert.equal(model.history.length, 1);
  const lastRestart = model.summaryStrip.find((item) => item.label === 'Last restart');
  assert.equal(lastRestart.detail, 'restart');
});

test('tenant restart control v4 derives blocked and verification monitoring state', () => {
  const model = createTenantRestartControlV4Model({
    restartPlans: [
      {
        id: 'rplan-blocked',
        status: 'blocked',
        restartMode: 'safe_restart',
        scheduledFor: '2026-03-26T08:00:00+07:00',
      },
      {
        id: 'rplan-pending-verify',
        status: 'completed',
        healthStatus: 'pending_verification',
        scheduledFor: '2026-03-26T09:00:00+07:00',
      },
      {
        id: 'rplan-scheduled',
        status: 'scheduled',
        restartMode: 'delayed',
        scheduledFor: '2026-03-26T10:00:00+07:00',
      },
    ],
    restartAnnouncements: [
      {
        id: 'rann-1',
        status: 'pending',
        scheduledFor: '2026-03-26T09:55:00+07:00',
        checkpointSeconds: 300,
      },
    ],
  });

  assert.equal(model.monitoring.blockedCount, 1);
  assert.equal(model.monitoring.pendingVerificationCount, 1);
  assert.match(model.monitoring.nextScheduledRestart.at, /26/);
  assert.match(model.monitoring.nextAnnouncement.checkpointLabel, /300/);
  assert.ok(model.blockers.some((item) => /blocked/i.test(item)));
  assert.ok(model.blockers.some((item) => /health verification/i.test(item)));
});

test('tenant restart control preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-restart-control-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-restart-control-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-restart-control-v4\.js/);
  assert.match(html, /tenantRestartControlV4PreviewRoot/);
});
