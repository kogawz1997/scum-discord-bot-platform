const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantOnboardingV4Model,
  buildTenantOnboardingV4Html,
} = require('../src/admin/assets/tenant-onboarding-v4.js');

test('tenant onboarding v4 model builds checklist from runtime readiness', () => {
  const model = createTenantOnboardingV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    activeServer: { id: 'server-1', name: 'Server 1' },
    agents: [
      { role: 'sync', status: 'online' },
      { role: 'execute', status: 'pending_activation' },
    ],
    serverConfigWorkspace: { categories: [{ key: 'general' }] },
  });

  assert.equal(model.header.title, 'Onboarding');
  assert.equal(model.checklist.length, 5);
  assert.equal(model.checklist.filter((item) => item.done).length, 4);
  assert.equal(model.header.primaryAction.href, '/tenant/runtimes/delivery-agents');
});

test('tenant onboarding v4 html includes checklist and primary action', () => {
  const html = buildTenantOnboardingV4Html(createTenantOnboardingV4Model({}));

  assert.match(html, /Onboarding/);
  assert.match(html, /Setup checklist/);
  assert.match(html, /Create Server Bot/);
  assert.match(html, /Open daily overview|Create Server Bot|Finish Server Bot setup/);
});
