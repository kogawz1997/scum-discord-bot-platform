const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminSsoRoleMappingEnvLines,
  getAdminSsoRoleMappingSummary,
} = require('../src/utils/adminSsoRoleMapping');

test('admin SSO role mapping summary reports explicit mapping counts', () => {
  const summary = getAdminSsoRoleMappingSummary({
    ADMIN_WEB_SSO_DISCORD_ENABLED: 'true',
    ADMIN_WEB_SSO_DEFAULT_ROLE: 'admin',
    ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_IDS: '111,222',
    ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_IDS: '333',
    ADMIN_WEB_SSO_DISCORD_MOD_ROLE_IDS: '444,555',
  });

  assert.equal(summary.enabled, true);
  assert.equal(summary.defaultRole, 'admin');
  assert.equal(summary.hasExplicitMappings, true);
  assert.equal(summary.hasElevatedMappings, true);
  assert.deepEqual(summary.ownerRoleIds, ['111', '222']);
  assert.deepEqual(summary.adminRoleIds, ['333']);
  assert.deepEqual(summary.modRoleIds, ['444', '555']);
  assert.equal(summary.totalMappedRoleIds, 5);
});

test('admin SSO role mapping summary treats explicit role names as mappings', () => {
  const summary = getAdminSsoRoleMappingSummary({
    ADMIN_WEB_SSO_DISCORD_ENABLED: 'true',
    ADMIN_WEB_SSO_DEFAULT_ROLE: 'mod',
    ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_NAMES: 'owner',
    ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_NAMES: 'admin',
    ADMIN_WEB_SSO_DISCORD_MOD_ROLE_NAMES: 'moderator,helper',
  });

  assert.equal(summary.hasExplicitMappings, true);
  assert.equal(summary.hasElevatedMappings, true);
  assert.deepEqual(summary.ownerRoleNames, ['owner']);
  assert.deepEqual(summary.adminRoleNames, ['admin']);
  assert.deepEqual(summary.modRoleNames, ['moderator', 'helper']);
  assert.equal(summary.totalMappedRoleNames, 4);
});

test('admin SSO role mapping helper resolves Discord role names into env lines', () => {
  const roles = [
    { id: '11', name: 'Owner Role' },
    { id: '22', name: 'Senior Admin' },
    { id: '33', name: 'Moderator Team' },
  ];
  const mapping = buildAdminSsoRoleMappingEnvLines(roles, {
    owner: 'Owner Role',
    admin: 'Senior Admin',
    mod: 'Moderator',
  });

  assert.deepEqual(mapping.ownerRoleIds, ['11']);
  assert.deepEqual(mapping.adminRoleIds, ['22']);
  assert.deepEqual(mapping.modRoleIds, ['33']);
  assert.deepEqual(mapping.envLines, [
    'ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_IDS=11',
    'ADMIN_WEB_SSO_DISCORD_ADMIN_ROLE_IDS=22',
    'ADMIN_WEB_SSO_DISCORD_MOD_ROLE_IDS=33',
  ]);
});
