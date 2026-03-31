const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantActorAccessSummary,
  buildTenantRoleMatrix,
  canActorManageTenantMembership,
  normalizeTenantMembershipStatus,
  normalizeTenantRole,
} = require('../src/services/platformTenantAccessService');

test('tenant access service normalizes legacy roles and membership statuses', () => {
  assert.equal(normalizeTenantRole('manager'), 'admin');
  assert.equal(normalizeTenantRole('support'), 'staff');
  assert.equal(normalizeTenantRole('member'), 'viewer');
  assert.equal(normalizeTenantMembershipStatus('accepted'), 'active');
  assert.equal(normalizeTenantMembershipStatus('pending'), 'invited');
  assert.equal(normalizeTenantMembershipStatus('suspended'), 'disabled');
});

test('tenant access summary returns the fixed permission set for admin and staff roles', () => {
  const adminAccess = buildTenantActorAccessSummary({ role: 'admin', status: 'active' });
  const staffAccess = buildTenantActorAccessSummary({ role: 'staff', status: 'active' });

  assert.equal(adminAccess.permissions.manage_staff.allowed, true);
  assert.equal(adminAccess.permissions.edit_config.allowed, true);
  assert.equal(staffAccess.permissions.manage_staff.allowed, false);
  assert.equal(staffAccess.permissions.manage_orders.allowed, true);
  assert.equal(staffAccess.permissions.restart_server.allowed, false);
});

test('tenant role matrix exposes four fixed roles with permission coverage', () => {
  const matrix = buildTenantRoleMatrix();
  assert.equal(matrix.length, 4);
  assert.deepEqual(matrix.map((entry) => entry.role), ['owner', 'admin', 'staff', 'viewer']);
  assert.ok(matrix.find((entry) => entry.role === 'owner')?.permissions.some((entry) => entry.allowed));
});

test('tenant access policy blocks admin from managing owner memberships and self changes', () => {
  const adminToOwner = canActorManageTenantMembership({
    actorRole: 'admin',
    actorIdentity: 'admin@example.com',
    targetRole: 'owner',
    targetIdentity: 'owner@example.com',
    desiredRole: 'staff',
    action: 'update',
  });
  const selfChange = canActorManageTenantMembership({
    actorRole: 'owner',
    actorIdentity: 'owner@example.com',
    targetRole: 'owner',
    targetIdentity: 'owner@example.com',
    desiredRole: 'admin',
    action: 'update',
  });

  assert.equal(adminToOwner.allowed, false);
  assert.match(String(adminToOwner.reason || ''), /staff and viewer/i);
  assert.equal(selfChange.allowed, false);
  assert.match(String(selfChange.reason || ''), /locking yourself out/i);
});

test('tenant access policy allows admins to invite staff and viewer roles', () => {
  const inviteStaff = canActorManageTenantMembership({
    actorRole: 'admin',
    actorIdentity: 'admin@example.com',
    desiredRole: 'staff',
    targetIdentity: 'staff@example.com',
    action: 'invite',
  });
  const inviteViewer = canActorManageTenantMembership({
    actorRole: 'admin',
    actorIdentity: 'admin@example.com',
    desiredRole: 'viewer',
    targetIdentity: 'viewer@example.com',
    action: 'invite',
  });

  assert.equal(inviteStaff.allowed, true);
  assert.equal(inviteViewer.allowed, true);
});
