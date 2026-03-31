const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantStaffV4Model,
  buildTenantStaffV4Html,
} = require('../src/admin/assets/tenant-staff-v4.js');

test('tenant staff v4 model summarizes staff memberships', () => {
  const model = createTenantStaffV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    me: { role: 'admin', tenantAccess: { role: 'admin', roleLabel: 'Admin', permissionCount: 8, permissions: { manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' } }, assignableRoles: ['staff', 'viewer'] } },
    tenantRoleMatrix: {
      currentAccess: {
        role: 'admin',
        roleLabel: 'Admin',
        permissionCount: 8,
        permissions: {
          manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' },
        },
        assignableRoles: ['staff', 'viewer'],
      },
      roles: [
        { role: 'owner', label: 'Owner', description: 'Full control.', manageableRoles: ['owner', 'admin', 'staff', 'viewer'], assignableRoles: ['owner', 'admin', 'staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }] },
        { role: 'admin', label: 'Admin', description: 'Daily operations.', manageableRoles: ['staff', 'viewer'], assignableRoles: ['staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }] },
        { role: 'staff', label: 'Staff', description: 'Support tools.', manageableRoles: [], assignableRoles: [], permissions: [{ key: 'manage_orders', label: 'Manage orders', allowed: true }] },
        { role: 'viewer', label: 'Viewer', description: 'Read only.', manageableRoles: [], assignableRoles: [], permissions: [] },
      ],
    },
    staffMemberships: [
      { membershipId: 'm-1', userId: 'u-1', displayName: 'Ops Lead', primaryEmail: 'ops@example.com', role: 'admin', status: 'active', management: { canManage: true, roleOptions: ['staff', 'viewer'], statusOptions: ['active', 'disabled', 'revoked'] }, access: { permissions: { manage_staff: { allowed: true, label: 'Manage staff' } } } },
      { membershipId: 'm-2', userId: 'u-2', displayName: 'Moderator', primaryEmail: 'mod@example.com', role: 'viewer', status: 'invited', management: { canManage: true, roleOptions: ['staff', 'viewer'], statusOptions: ['invited', 'active', 'disabled', 'revoked'] } },
    ],
  });

  assert.equal(model.header.title, 'Staff');
  assert.equal(model.memberships.length, 2);
  assert.equal(model.canManage, true);
  assert.equal(model.summaryStrip[1].value, '1');
  assert.deepEqual(model.inviteRoleOptions, ['staff', 'viewer']);
  assert.equal(model.memberships[0].permissionSummary, '1 permissions');
});

test('tenant staff v4 html includes invite form, role-aware options, and row management state', () => {
  const html = buildTenantStaffV4Html(createTenantStaffV4Model({
    me: { role: 'admin', tenantAccess: { role: 'admin', roleLabel: 'Admin', permissionCount: 8, permissions: { manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' } }, assignableRoles: ['staff', 'viewer'] } },
    tenantRoleMatrix: {
      currentAccess: {
        role: 'admin',
        roleLabel: 'Admin',
        permissionCount: 8,
        permissions: {
          manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' },
        },
        assignableRoles: ['staff', 'viewer'],
      },
      roles: [
        { role: 'admin', label: 'Admin', description: 'Daily operations.', manageableRoles: ['staff', 'viewer'], assignableRoles: ['staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }] },
        { role: 'staff', label: 'Staff', description: 'Support tools.', manageableRoles: [], assignableRoles: [], permissions: [{ key: 'manage_orders', label: 'Manage orders', allowed: true }] },
        { role: 'viewer', label: 'Viewer', description: 'Read only.', manageableRoles: [], assignableRoles: [], permissions: [] },
      ],
    },
    staffMemberships: [
      { membershipId: 'm-1', userId: 'u-1', displayName: 'Ops Lead', primaryEmail: 'ops@example.com', role: 'admin', status: 'active', management: { canManage: false, reason: 'Admins can manage only staff and viewer accounts.', roleOptions: ['admin'], statusOptions: ['active'] }, access: { permissions: { manage_staff: { allowed: true, label: 'Manage staff' } } } },
    ],
  }));

  assert.match(html, /Invite user/);
  assert.match(html, /data-tenant-staff-invite-form/);
  assert.match(html, /data-tenant-staff-role-update/);
  assert.match(html, /data-tenant-staff-revoke/);
  assert.doesNotMatch(html, /<option value="owner">/);
  assert.match(html, /data-tenant-staff-manageable="false"/);
  assert.match(html, /Admins can manage only staff and viewer accounts\./);
});
