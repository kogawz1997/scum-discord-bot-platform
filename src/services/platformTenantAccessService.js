'use strict';

const TENANT_PERMISSION_CATALOG = Object.freeze([
  Object.freeze({
    key: 'edit_config',
    label: 'Edit config',
    description: 'Save tenant settings and server configuration changes.',
  }),
  Object.freeze({
    key: 'restart_server',
    label: 'Restart server',
    description: 'Start, stop, and restart the SCUM server from the tenant workspace.',
  }),
  Object.freeze({
    key: 'manage_runtimes',
    label: 'Manage runtimes',
    description: 'Create, rotate, revoke, and test Delivery Agents and Server Bots.',
  }),
  Object.freeze({
    key: 'manage_players',
    label: 'Manage players',
    description: 'Run player support, moderation, wallet, and identity actions.',
  }),
  Object.freeze({
    key: 'manage_orders',
    label: 'Manage orders',
    description: 'Retry deliveries, cancel valid jobs, and resolve order issues.',
  }),
  Object.freeze({
    key: 'manage_donations',
    label: 'Manage donations',
    description: 'Create and update donation packages and supporter rewards.',
  }),
  Object.freeze({
    key: 'manage_events',
    label: 'Manage events',
    description: 'Create, schedule, activate, and close tenant events.',
  }),
  Object.freeze({
    key: 'manage_staff',
    label: 'Manage staff',
    description: 'Invite teammates, change roles, disable access, and revoke memberships.',
  }),
]);

const TENANT_ROLE_DEFINITIONS = Object.freeze([
  Object.freeze({
    role: 'owner',
    label: 'Owner',
    description: 'Full tenant control, including staff access and high-risk operational actions.',
    permissionKeys: Object.freeze(TENANT_PERMISSION_CATALOG.map((entry) => entry.key)),
    manageableRoles: Object.freeze(['owner', 'admin', 'staff', 'viewer']),
    assignableRoles: Object.freeze(['owner', 'admin', 'staff', 'viewer']),
  }),
  Object.freeze({
    role: 'admin',
    label: 'Admin',
    description: 'Daily operations control without owner-only escalation or primary-owner changes.',
    permissionKeys: Object.freeze([
      'edit_config',
      'restart_server',
      'manage_runtimes',
      'manage_players',
      'manage_orders',
      'manage_donations',
      'manage_events',
      'manage_staff',
    ]),
    manageableRoles: Object.freeze(['staff', 'viewer']),
    assignableRoles: Object.freeze(['staff', 'viewer']),
  }),
  Object.freeze({
    role: 'staff',
    label: 'Staff',
    description: 'Operational support for players, orders, donations, and events.',
    permissionKeys: Object.freeze([
      'manage_players',
      'manage_orders',
      'manage_donations',
      'manage_events',
    ]),
    manageableRoles: Object.freeze([]),
    assignableRoles: Object.freeze([]),
  }),
  Object.freeze({
    role: 'viewer',
    label: 'Viewer',
    description: 'Read-only access for oversight and support context.',
    permissionKeys: Object.freeze([]),
    manageableRoles: Object.freeze([]),
    assignableRoles: Object.freeze([]),
  }),
]);

const TENANT_ROLE_ORDER = Object.freeze(
  TENANT_ROLE_DEFINITIONS.reduce((acc, entry, index) => {
    acc[entry.role] = index;
    return acc;
  }, {})
);

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeTenantRole(value) {
  const normalized = trimText(value, 80).toLowerCase();
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'staff' || normalized === 'viewer') {
    return normalized;
  }
  if (normalized === 'manager') return 'admin';
  if (normalized === 'support' || normalized === 'moderator' || normalized === 'mod' || normalized === 'editor') {
    return 'staff';
  }
  if (normalized === 'member') return 'viewer';
  return 'viewer';
}

function normalizeTenantMembershipStatus(value) {
  const normalized = trimText(value, 80).toLowerCase();
  if (normalized === 'active' || normalized === 'invited' || normalized === 'disabled' || normalized === 'revoked') {
    return normalized;
  }
  if (normalized === 'accepted') return 'active';
  if (normalized === 'pending') return 'invited';
  if (normalized === 'suspended' || normalized === 'deactivated' || normalized === 'inactive') {
    return 'disabled';
  }
  return 'active';
}

function getTenantPermissionCatalog() {
  return TENANT_PERMISSION_CATALOG.map((entry) => ({ ...entry }));
}

function getTenantRoleDefinitions() {
  return TENANT_ROLE_DEFINITIONS.map((entry) => ({
    role: entry.role,
    label: entry.label,
    description: entry.description,
    permissionKeys: entry.permissionKeys.slice(),
    manageableRoles: entry.manageableRoles.slice(),
    assignableRoles: entry.assignableRoles.slice(),
  }));
}

function getTenantRoleDefinition(role) {
  const normalizedRole = normalizeTenantRole(role);
  return TENANT_ROLE_DEFINITIONS.find((entry) => entry.role === normalizedRole) || TENANT_ROLE_DEFINITIONS[3];
}

function buildTenantPermissionMap(role, options = {}) {
  const normalizedRole = normalizeTenantRole(role);
  const normalizedStatus = normalizeTenantMembershipStatus(options.status || 'active');
  const roleDefinition = getTenantRoleDefinition(normalizedRole);
  const enabledKeys = normalizedStatus === 'active'
    ? new Set(roleDefinition.permissionKeys)
    : new Set();
  return TENANT_PERMISSION_CATALOG.reduce((acc, entry) => {
    acc[entry.key] = enabledKeys.has(entry.key);
    return acc;
  }, {});
}

function buildTenantPermissionEntries(role, options = {}) {
  const permissionMap = buildTenantPermissionMap(role, options);
  return TENANT_PERMISSION_CATALOG.map((entry) => ({
    key: entry.key,
    label: entry.label,
    description: entry.description,
    allowed: Boolean(permissionMap[entry.key]),
  }));
}

function buildTenantActorAccessSummary(input = {}) {
  const role = normalizeTenantRole(input.role);
  const status = normalizeTenantMembershipStatus(input.status || 'active');
  const roleDefinition = getTenantRoleDefinition(role);
  const permissionEntries = buildTenantPermissionEntries(role, { status });
  const permissionMap = permissionEntries.reduce((acc, entry) => {
    acc[entry.key] = {
      allowed: entry.allowed,
      label: entry.label,
      description: entry.description,
    };
    return acc;
  }, {});
  const enabledPermissionKeys = permissionEntries.filter((entry) => entry.allowed).map((entry) => entry.key);
  return {
    role,
    status,
    roleLabel: roleDefinition.label,
    roleDescription: roleDefinition.description,
    permissionCount: enabledPermissionKeys.length,
    enabledPermissionKeys,
    permissions: permissionMap,
    manageableRoles: roleDefinition.manageableRoles.slice(),
    assignableRoles: roleDefinition.assignableRoles.slice(),
    canManageStaff: Boolean(permissionMap.manage_staff?.allowed),
  };
}

function buildTenantRoleMatrix() {
  return TENANT_ROLE_DEFINITIONS.map((entry) => {
    const access = buildTenantActorAccessSummary({ role: entry.role, status: 'active' });
    return {
      role: entry.role,
      label: entry.label,
      description: entry.description,
      permissionCount: access.permissionCount,
      permissionKeys: access.enabledPermissionKeys.slice(),
      manageableRoles: access.manageableRoles.slice(),
      assignableRoles: access.assignableRoles.slice(),
      permissions: buildTenantPermissionEntries(entry.role, { status: 'active' }),
    };
  });
}

function getTenantRoleOrder(role) {
  return TENANT_ROLE_ORDER[normalizeTenantRole(role)] || 0;
}

function compareTenantRoles(leftRole, rightRole) {
  return getTenantRoleOrder(leftRole) - getTenantRoleOrder(rightRole);
}

function getAssignableRoleOptions(actorRole) {
  return buildTenantActorAccessSummary({ role: actorRole }).assignableRoles;
}

function getManageableRoleTargets(actorRole) {
  return buildTenantActorAccessSummary({ role: actorRole }).manageableRoles;
}

function buildTenantStatusOptions(currentStatus) {
  const normalizedStatus = normalizeTenantMembershipStatus(currentStatus || 'active');
  const values = ['active', 'disabled', 'revoked'];
  if (normalizedStatus === 'invited') {
    values.unshift('invited');
  }
  return values;
}

function canActorManageTenantMembership(input = {}) {
  const actorRole = normalizeTenantRole(input.actorRole);
  const actorStatus = normalizeTenantMembershipStatus(input.actorStatus || 'active');
  const targetRole = normalizeTenantRole(input.targetRole);
  const desiredRole = trimText(input.desiredRole, 80)
    ? normalizeTenantRole(input.desiredRole)
    : targetRole;
  const actorIdentity = trimText(input.actorIdentity, 200).toLowerCase();
  const targetIdentity = trimText(input.targetIdentity, 200).toLowerCase();
  const action = trimText(input.action, 80).toLowerCase() || 'update';
  const roleAccess = buildTenantActorAccessSummary({ role: actorRole, status: actorStatus });

  if (!roleAccess.canManageStaff) {
    return {
      allowed: false,
      reason: 'Your tenant role cannot manage staff access.',
    };
  }

  if (actorIdentity && targetIdentity && actorIdentity === targetIdentity) {
    return {
      allowed: false,
      reason: 'Change your own access from another owner account to avoid locking yourself out.',
    };
  }

  if (actorRole === 'admin') {
    if (!roleAccess.manageableRoles.includes(targetRole)) {
      return {
        allowed: false,
        reason: 'Admins can manage only staff and viewer accounts.',
      };
    }
    if (!roleAccess.assignableRoles.includes(desiredRole)) {
      return {
        allowed: false,
        reason: 'Admins can assign only staff or viewer roles.',
      };
    }
  }

  if (action === 'invite' && !roleAccess.assignableRoles.includes(desiredRole)) {
    return {
      allowed: false,
      reason: 'This tenant role cannot send invites for the requested access level.',
    };
  }

  return {
    allowed: true,
    reason: '',
  };
}

module.exports = {
  TENANT_PERMISSION_CATALOG,
  TENANT_ROLE_DEFINITIONS,
  TENANT_ROLE_ORDER,
  buildTenantActorAccessSummary,
  buildTenantPermissionEntries,
  buildTenantPermissionMap,
  buildTenantRoleMatrix,
  buildTenantStatusOptions,
  canActorManageTenantMembership,
  compareTenantRoles,
  getAssignableRoleOptions,
  getManageableRoleTargets,
  getTenantPermissionCatalog,
  getTenantRoleDefinition,
  getTenantRoleDefinitions,
  getTenantRoleOrder,
  normalizeTenantMembershipStatus,
  normalizeTenantRole,
};
