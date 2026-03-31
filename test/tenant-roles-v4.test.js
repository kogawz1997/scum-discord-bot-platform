const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantRolesV4Model,
  buildTenantRolesV4Html,
} = require('../src/admin/assets/tenant-roles-v4.js');

test('tenant roles v4 model builds role assignment summary', () => {
  const model = createTenantRolesV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    me: { role: 'owner', tenantAccess: { role: 'owner', roleLabel: 'Owner', permissionCount: 8, permissions: { manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' } } } },
    tenantRoleMatrix: {
      currentAccess: {
        role: 'owner',
        roleLabel: 'Owner',
        permissionCount: 8,
        permissions: {
          manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' },
        },
      },
      roles: [
        { role: 'owner', label: 'Owner', description: 'Full control.', manageableRoles: ['owner', 'admin', 'staff', 'viewer'], assignableRoles: ['owner', 'admin', 'staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }, { key: 'restart_server', label: 'Restart server', allowed: true }] },
        { role: 'admin', label: 'Admin', description: 'Daily operations.', manageableRoles: ['staff', 'viewer'], assignableRoles: ['staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }] },
        { role: 'staff', label: 'Staff', description: 'Support tools.', manageableRoles: [], assignableRoles: [], permissions: [{ key: 'manage_orders', label: 'Manage orders', allowed: true }] },
        { role: 'viewer', label: 'Viewer', description: 'Read only.', manageableRoles: [], assignableRoles: [], permissions: [] },
      ],
    },
    staffMemberships: [
      { membershipId: 'm-1', userId: 'u-1', role: 'owner', status: 'active', management: { canManage: false, reason: 'At least one active owner must remain on this tenant.', roleOptions: ['owner'], statusOptions: ['active'] }, access: { permissions: { manage_staff: { allowed: true, label: 'Manage staff' } } } },
      { membershipId: 'm-2', userId: 'u-2', role: 'staff', status: 'active', management: { canManage: true, roleOptions: ['owner', 'admin', 'staff', 'viewer'], statusOptions: ['active', 'disabled', 'revoked'] }, access: { permissions: { manage_orders: { allowed: true, label: 'Manage orders' } } } },
    ],
  });

  assert.equal(model.header.title, 'Roles & Permissions');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.memberships.length, 2);
  assert.equal(model.permissionRows.length >= 2, true);
  assert.equal(model.roles[0].permissionLabels.includes('Manage staff'), true);
});

test('tenant roles v4 html includes role definitions, permission coverage, and row restrictions', () => {
  const html = buildTenantRolesV4Html(createTenantRolesV4Model({
    me: { role: 'admin', tenantAccess: { role: 'admin', roleLabel: 'Admin', permissionCount: 8, permissions: { manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' } } } },
    tenantRoleMatrix: {
      currentAccess: {
        role: 'admin',
        roleLabel: 'Admin',
        permissionCount: 8,
        permissions: {
          manage_staff: { allowed: true, label: 'Manage staff', description: 'Invite teammates and change roles.' },
        },
      },
      roles: [
        { role: 'owner', label: 'Owner', description: 'Full control.', manageableRoles: ['owner', 'admin', 'staff', 'viewer'], assignableRoles: ['owner', 'admin', 'staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }] },
        { role: 'admin', label: 'Admin', description: 'Daily operations.', manageableRoles: ['staff', 'viewer'], assignableRoles: ['staff', 'viewer'], permissions: [{ key: 'manage_staff', label: 'Manage staff', allowed: true }] },
        { role: 'staff', label: 'Staff', description: 'Support tools.', manageableRoles: [], assignableRoles: [], permissions: [{ key: 'manage_orders', label: 'Manage orders', allowed: true }] },
        { role: 'viewer', label: 'Viewer', description: 'Read only.', manageableRoles: [], assignableRoles: [], permissions: [] },
      ],
    },
    staffMemberships: [
      { membershipId: 'm-1', userId: 'u-1', role: 'owner', status: 'active', management: { canManage: false, reason: 'Admins can manage only staff and viewer accounts.', roleOptions: ['owner'], statusOptions: ['active'] }, access: { permissions: { manage_staff: { allowed: true, label: 'Manage staff' } } } },
    ],
  }));

  assert.match(html, /Role definitions/);
  assert.match(html, /Permission coverage/);
  assert.match(html, /Assign role/);
  assert.match(html, /data-tenant-staff-role-update/);
  assert.match(html, /data-tenant-staff-manageable="false"/);
  assert.match(html, /Admins can manage only staff and viewer accounts\./);
});
