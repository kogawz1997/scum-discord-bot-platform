const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantDashboardV4Html,
  createTenantDashboardV4Model,
} = require('../src/admin/assets/tenant-dashboard-v4.js');

test('tenant dashboard v4 accepts injected nav groups and notice banner', () => {
  const model = createTenantDashboardV4Model({
    me: { tenantId: 'tenant-prod-001' },
    tenantConfig: { name: 'Tenant Demo' },
    __surfaceShell: {
      navGroups: [
        {
          label: 'Overview',
          items: [{ label: 'Dashboard', href: '#dashboard', current: true }],
        },
      ],
    },
    __surfaceNotice: {
      tone: 'warning',
      title: 'Feature locked',
      detail: 'The current tenant package does not enable this workspace yet.',
    },
  });

  assert.equal(model.shell.navGroups[0].label, 'Overview');
  assert.equal(model.notice.title, 'Feature locked');

  const html = buildTenantDashboardV4Html(model);
  assert.match(html, /Feature locked/);
  assert.match(html, /The current tenant package does not enable this workspace yet\./);
});
