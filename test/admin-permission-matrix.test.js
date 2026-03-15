const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRoleMatrix,
  getAdminPermissionForPath,
  getAdminPermissionMatrixSummary,
  hasRoleAtLeast,
} = require('../src/utils/adminPermissionMatrix');

test('admin permission matrix marks sensitive routes with step-up auth', () => {
  const restorePermission = getAdminPermissionForPath('/admin/api/backup/restore', 'POST');
  assert.equal(restorePermission?.minRole, 'owner');
  assert.equal(restorePermission?.stepUp, true);

  const configPatchPermission = getAdminPermissionForPath('/admin/api/config/patch', 'POST');
  assert.equal(configPatchPermission?.minRole, 'admin');
  assert.equal(configPatchPermission?.stepUp, true);

  const genericPermission = getAdminPermissionForPath('/admin/api/wallet/set', 'POST');
  assert.equal(genericPermission?.minRole, 'admin');
  assert.equal(genericPermission?.stepUp, false);
});

test('admin role matrix expands permissions by role level', () => {
  assert.equal(hasRoleAtLeast('owner', 'admin'), true);
  assert.equal(hasRoleAtLeast('mod', 'admin'), false);

  const summary = getAdminPermissionMatrixSummary();
  assert.ok(summary.totalPermissions >= 5);
  assert.ok(summary.stepUpPermissions >= 3);

  const roles = buildRoleMatrix();
  const mod = roles.find((entry) => entry.role === 'mod');
  const owner = roles.find((entry) => entry.role === 'owner');
  assert.ok(Array.isArray(mod?.permissions));
  assert.ok(Array.isArray(owner?.permissions));
  assert.ok(owner.permissions.length > mod.permissions.length);
});
