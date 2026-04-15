const test = require('node:test');
const assert = require('node:assert/strict');

const { createOwnerControlRiskV4 } = require('../src/admin/assets/owner-control-risk-v4.js');

function trimText(value, maxLen) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (Number.isFinite(maxLen) && maxLen > 0 && text.length > maxLen) {
    return text.slice(0, maxLen);
  }
  return text;
}

function firstNonEmpty(values, fallback = '') {
  for (const value of Array.isArray(values) ? values : []) {
    const text = trimText(value);
    if (text) return text;
  }
  return fallback;
}

function parseObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value, fallback = '0') {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : fallback;
}

function formatDateTime(value) {
  return trimText(value, 80) || '-';
}

function createRenderer() {
  return createOwnerControlRiskV4({
    escapeHtml,
    trimText,
    firstNonEmpty,
    parseObject,
    formatNumber,
    formatDateTime,
    ownerSupportHref: (tenantId) => `/owner/support/${tenantId}`,
    ownerTenantHref: (tenantId) => `/owner/tenants/${tenantId}`,
  });
}

test('owner control risk module builds prioritized owner risk queue items', () => {
  const renderer = createRenderer();
  const items = renderer.buildOwnerRiskQueueItems({
    notifications: [
      {
        id: 'note-abuse',
        kind: 'delivery-abuse-suspected',
        severity: 'warning',
        tenantId: 'tenant-1',
        title: 'Queue abuse',
        message: 'Repeated claim attempts',
      },
      {
        id: 'note-runtime',
        kind: 'runtime-offline',
        severity: 'critical',
        tenantId: 'tenant-1',
        title: 'Runtime offline',
        detail: 'Agent heartbeat missing',
      },
    ],
    securityEvents: [
      {
        type: 'auth-failure-spike',
        severity: 'warning',
        detail: 'Failed admin logins increased',
      },
    ],
    requestLogs: {
      items: [
        { method: 'GET', path: '/owner/runtime', statusCode: 502, at: '2026-04-09T10:00:00.000Z' },
      ],
    },
    deliveryLifecycle: {
      summary: { overdueCount: 2, poisonCandidateCount: 1, nonRetryableDeadLetters: 0 },
      actionPlan: { actions: [{ key: 'hold-poison-candidates' }] },
      runtime: { workerStarted: true },
    },
  }, [
    { tenantId: 'tenant-1', tenant: { name: 'Prime' } },
  ]);

  assert.equal(items[0].key, 'notification-note-abuse');
  assert.ok(items.some((item) => item.key === 'notification-note-runtime'));
  assert.ok(items.some((item) => item.key === 'security-auth-failure-spike-'));
  assert.ok(items.some((item) => item.key === 'request-GET-/owner/runtime-2026-04-09T10:00:00.000Z'));
  assert.ok(items.some((item) => item.key === 'delivery-lifecycle-risk'));
});

test('owner control risk module renders queue cards with actions', () => {
  const renderer = createRenderer();
  const html = renderer.renderOwnerRiskQueue({
    notifications: [
      {
        id: 'note-abuse',
        kind: 'delivery-abuse-suspected',
        severity: 'warning',
        tenantId: 'tenant-1',
        title: 'Queue abuse',
        message: 'Repeated claim attempts',
      },
    ],
    securityEvents: [],
    requestLogs: { items: [] },
    deliveryLifecycle: {},
  }, [
    { tenantId: 'tenant-1', tenant: { name: 'Prime' } },
  ]);

  assert.match(html, /data-owner-risk-queue="true"/);
  assert.match(html, /data-owner-risk-item="notification-note-abuse"/);
  assert.match(html, /Open support case/);
  assert.match(html, /\/owner\/support\/tenant-1/);
  assert.match(html, /\/owner\/tenants\/tenant-1/);
});
