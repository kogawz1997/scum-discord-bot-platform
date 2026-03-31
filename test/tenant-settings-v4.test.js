const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantSettingsV4Model,
  buildTenantSettingsV4Html,
} = require('../src/admin/assets/tenant-settings-v4.js');

test('tenant settings v4 model exposes config patch and discord links', () => {
  const model = createTenantSettingsV4Model({
    tenantConfig: {
      name: 'Tenant Demo',
      configPatch: { supportEmail: 'ops@example.com' },
      portalEnvPatch: { theme: 'scum' },
      featureFlags: { donation_module: true },
    },
    servers: [{ id: 'server-1', name: 'Main Server' }],
    serverDiscordLinks: [{ serverId: 'server-1', guildId: '123', status: 'active', updatedAt: '2026-03-29T10:00:00+07:00' }],
  });

  assert.equal(model.header.title, 'Settings');
  assert.equal(model.serverOptions.length, 1);
  assert.equal(model.links.length, 1);
  assert.match(model.configPatchJson, /supportEmail/);
});

test('tenant settings v4 html includes save form and discord link action', () => {
  const html = buildTenantSettingsV4Html(createTenantSettingsV4Model({}));

  assert.match(html, /Save workspace settings/);
  assert.match(html, /data-tenant-settings-form/);
  assert.match(html, /data-server-discord-link-create/);
  assert.match(html, /data-server-discord-link-create[^>]*disabled/);
  assert.match(html, /Add a server first/);
});
