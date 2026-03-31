'use strict';

const {
  buildTenantActorAccessSummary,
} = require('../../services/platformTenantAccessService');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function getTenantPermissionEntry(auth, permissionKey) {
  const access = buildTenantActorAccessSummary({
    role: auth?.role,
    status: auth?.tenantMembershipStatus || 'active',
  });
  return {
    access,
    permission: access.permissions?.[trimText(permissionKey, 120)] || null,
  };
}

function sendTenantPermissionDenied(sendJson, res, auth, permissionKey, options = {}) {
  const { access, permission } = getTenantPermissionEntry(auth, permissionKey);
  const message = trimText(options.message, 240)
    || trimText(permission?.description, 240)
    || 'This tenant role cannot run the requested action.';
  sendJson(res, 403, {
    ok: false,
    error: options.error || 'permission-denied',
    data: {
      permissionKey: trimText(permissionKey, 120) || null,
      role: access.role,
      status: access.status,
      message,
      reason: message,
      manageableRoles: access.manageableRoles,
      assignableRoles: access.assignableRoles,
      enabledPermissionKeys: access.enabledPermissionKeys,
      permissions: access.permissions,
    },
  });
  return true;
}

function requireTenantPermission({
  sendJson,
  res,
  auth,
  permissionKey,
  message,
}) {
  if (typeof sendJson !== 'function' || !res || !trimText(permissionKey, 120)) {
    return { allowed: true, access: null, permission: null };
  }
  const { access, permission } = getTenantPermissionEntry(auth, permissionKey);
  if (permission?.allowed) {
    return { allowed: true, access, permission };
  }
  sendTenantPermissionDenied(sendJson, res, auth, permissionKey, { message });
  return { allowed: false, access, permission };
}

module.exports = {
  getTenantPermissionEntry,
  requireTenantPermission,
  sendTenantPermissionDenied,
};
