'use strict';

const {
  buildTenantProductEntitlements,
  normalizeFeatureAccess,
} = require('../../domain/billing/productEntitlementService');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

async function loadTenantProductEntitlements(getTenantFeatureAccess, buildEntitlements, tenantId) {
  const normalizedTenantId = trimText(tenantId, 160);
  if (!normalizedTenantId) {
    return buildTenantProductEntitlements({
      tenantId: null,
      enabledFeatureKeys: [],
    });
  }
  if (typeof getTenantFeatureAccess !== 'function') {
    return buildTenantProductEntitlements({
      tenantId: normalizedTenantId,
      enabledFeatureKeys: [],
    });
  }
  const rawAccess = await getTenantFeatureAccess(normalizedTenantId, {
    cache: false,
    allowFallback: true,
  });
  const normalizedAccess = normalizeFeatureAccess(rawAccess || {
    tenantId: normalizedTenantId,
    enabledFeatureKeys: [],
  });
  const buildFn = typeof buildEntitlements === 'function'
    ? buildEntitlements
    : buildTenantProductEntitlements;
  return buildFn(normalizedAccess);
}

function getTenantActionEntitlement(entitlements, actionKey) {
  const key = trimText(actionKey, 120);
  if (!key) return null;
  return entitlements?.actions?.[key] || null;
}

function sendTenantFeatureDenied(sendJson, res, entitlements, actionKey, options = {}) {
  const entitlement = getTenantActionEntitlement(entitlements, actionKey);
  const featureKeys = Array.isArray(entitlement?.requiredFeatures)
    ? entitlement.requiredFeatures.filter(Boolean)
    : [];
  const message = trimText(options.message, 240)
    || trimText(entitlement?.reason, 240)
    || 'This action is not enabled for the current tenant package.';
  sendJson(res, 403, {
    ok: false,
    error: options.error || 'feature-not-enabled',
    data: {
      actionKey: trimText(actionKey, 120) || null,
      message,
      reason: trimText(entitlement?.reason, 240) || message,
      requiredFeatures: featureKeys,
      upgradeCta: entitlement?.upgradeCta || null,
      enabledFeatureKeys: Array.isArray(entitlements?.enabledFeatureKeys)
        ? entitlements.enabledFeatureKeys
        : [],
      tenantId: entitlements?.tenantId || null,
      package: entitlements?.package || null,
      entitlements,
    },
  });
  return true;
}

async function requireTenantActionEntitlement({
  sendJson,
  res,
  getTenantFeatureAccess,
  buildTenantProductEntitlements: buildEntitlements,
  tenantId,
  actionKey,
  message,
}) {
  if (typeof sendJson !== 'function' || !res || !trimText(tenantId, 160) || !trimText(actionKey, 120)) {
    return { allowed: true, entitlements: null };
  }
  if (typeof getTenantFeatureAccess !== 'function') {
    return { allowed: true, entitlements: null };
  }
  const entitlements = await loadTenantProductEntitlements(
    getTenantFeatureAccess,
    buildEntitlements,
    tenantId,
  );
  const entitlement = getTenantActionEntitlement(entitlements, actionKey);
  if (!entitlement?.locked) {
    return { allowed: true, entitlements, entitlement };
  }
  sendTenantFeatureDenied(sendJson, res, entitlements, actionKey, { message });
  return { allowed: false, entitlements, entitlement };
}

module.exports = {
  getTenantActionEntitlement,
  loadTenantProductEntitlements,
  requireTenantActionEntitlement,
  sendTenantFeatureDenied,
};
