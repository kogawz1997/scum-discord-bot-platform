'use strict';

const {
  getTenantFeatureAccess,
  listPlatformAgentRuntimes,
} = require('./platformService');
const {
  getPlatformTenantConfig,
} = require('./platformTenantConfigService');
const {
  buildTenantProductEntitlements,
} = require('../domain/billing/productEntitlementService');

const MODULE_CATALOG = Object.freeze([
  Object.freeze({
    featureKey: 'bot_delivery',
    title: 'Delivery workflows',
    dependencies: Object.freeze(['orders_module', 'execute_agent']),
    actionHref: '/tenant/orders',
    actionLabel: 'Open orders',
    dependencyActions: Object.freeze({
      orders_module: Object.freeze({ href: '/tenant/orders', label: 'Open orders' }),
      execute_agent: Object.freeze({ href: '/tenant/delivery-agents', label: 'Open Delivery Agent' }),
    }),
    runtimeRole: 'execute',
    runtimeHref: '/tenant/delivery-agents',
  }),
  Object.freeze({
    featureKey: 'bot_log',
    title: 'Server log sync',
    dependencies: Object.freeze(['sync_agent']),
    actionHref: '/tenant/logs-sync',
    actionLabel: 'Open logs & sync',
    dependencyActions: Object.freeze({
      sync_agent: Object.freeze({ href: '/tenant/server-bots', label: 'Open Server Bot' }),
    }),
    runtimeRole: 'sync',
    runtimeHref: '/tenant/server-bots',
  }),
  Object.freeze({
    featureKey: 'donation_module',
    title: 'Supporter tiers',
    dependencies: Object.freeze(['orders_module', 'player_module']),
    actionHref: '/tenant/donations',
    actionLabel: 'Open donations',
    dependencyActions: Object.freeze({
      orders_module: Object.freeze({ href: '/tenant/orders', label: 'Open orders' }),
      player_module: Object.freeze({ href: '/tenant/players', label: 'Open players' }),
    }),
  }),
  Object.freeze({
    featureKey: 'event_module',
    title: 'Community events',
    dependencies: Object.freeze([]),
    actionHref: '/tenant/events',
    actionLabel: 'Open events',
  }),
  Object.freeze({
    featureKey: 'wallet_module',
    title: 'Wallet flows',
    dependencies: Object.freeze(['orders_module', 'player_module']),
    actionHref: '/tenant/orders',
    actionLabel: 'Open orders',
    dependencyActions: Object.freeze({
      orders_module: Object.freeze({ href: '/tenant/orders', label: 'Open orders' }),
      player_module: Object.freeze({ href: '/tenant/players', label: 'Open players' }),
    }),
  }),
  Object.freeze({
    featureKey: 'ranking_module',
    title: 'Rankings & stats',
    dependencies: Object.freeze(['player_module']),
    actionHref: '/tenant/players',
    actionLabel: 'Open players',
    dependencyActions: Object.freeze({
      player_module: Object.freeze({ href: '/tenant/players', label: 'Open players' }),
    }),
  }),
  Object.freeze({
    featureKey: 'support_module',
    title: 'Support tools',
    dependencies: Object.freeze(['discord_integration']),
    actionHref: '/tenant/players',
    actionLabel: 'Open player tools',
    dependencyActions: Object.freeze({
      discord_integration: Object.freeze({ href: '/tenant/settings', label: 'Open settings' }),
    }),
  }),
  Object.freeze({
    featureKey: 'analytics_module',
    title: 'Analytics workspace',
    dependencies: Object.freeze([]),
    actionHref: '/tenant/analytics',
    actionLabel: 'Open analytics',
  }),
]);

function normalizeText(value) {
  return String(value || '').trim();
}

function asPositiveInt(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function normalizeFeatureSet(values) {
  return new Set(
    Array.isArray(values)
      ? values.map((value) => normalizeText(value)).filter(Boolean)
      : [],
  );
}

function buildRuntimeHealth(rows = []) {
  const runtimes = Array.isArray(rows) ? rows : [];
  const syncRows = runtimes.filter((row) => normalizeText(row?.role).toLowerCase() === 'sync');
  const executeRows = runtimes.filter((row) => normalizeText(row?.role).toLowerCase() === 'execute');
  const onlineStatuses = new Set(['online', 'degraded', 'outdated']);
  return {
    syncCount: syncRows.length,
    executeCount: executeRows.length,
    syncOnline: syncRows.some((row) => onlineStatuses.has(normalizeText(row?.status).toLowerCase())),
    executeOnline: executeRows.some((row) => onlineStatuses.has(normalizeText(row?.status).toLowerCase())),
  };
}

function resolveRuntimeIssue(entry, runtimeHealth, effectiveEnabled) {
  if (!effectiveEnabled || !entry?.runtimeRole) return null;
  if (entry.runtimeRole === 'sync' && !runtimeHealth.syncOnline) {
    return {
      label: 'Server Bot is not connected',
      detail: 'This module needs a connected Server Bot before it can run reliably.',
      href: entry.runtimeHref || '/tenant/server-bots',
      actionLabel: 'Open Server Bot',
    };
  }
  if (entry.runtimeRole === 'execute' && !runtimeHealth.executeOnline) {
    return {
      label: 'Delivery Agent is not connected',
      detail: 'This module needs a connected Delivery Agent before it can run reliably.',
      href: entry.runtimeHref || '/tenant/delivery-agents',
      actionLabel: 'Open Delivery Agent',
    };
  }
  return null;
}

function resolveStateLabel(input) {
  if (!input.manageable) {
    return {
      label: 'Upgrade required',
      detail: 'This module is outside the current package and cannot be enabled yet.',
      tone: 'warning',
    };
  }
  if (input.missingDependencies.length > 0) {
    return {
      label: 'Dependency required',
      detail: `Missing: ${input.missingDependencies.join(', ')}`,
      tone: 'warning',
    };
  }
  if (input.runtimeIssue) {
    return {
      label: input.runtimeIssue.label,
      detail: input.runtimeIssue.detail,
      tone: 'warning',
    };
  }
  if (input.effectiveEnabled) {
    return {
      label: 'Ready',
      detail: 'This module is enabled and ready for day-to-day use.',
      tone: 'success',
    };
  }
  if (input.packageEnabled) {
    return {
      label: 'Ready to enable',
      detail: 'This module is included in the package and can be enabled now.',
      tone: 'info',
    };
  }
  return {
    label: 'Locked',
    detail: 'This module is not included in the current package.',
    tone: 'muted',
  };
}

function resolveNextAction(entry) {
  if (entry.missingDependencies.length > 0) {
    const dependencyKey = entry.missingDependencies[0];
    const dependencyAction = entry.dependencyActions?.[dependencyKey];
    return {
      href: dependencyAction?.href || '/tenant/modules',
      label: dependencyAction?.label || `Open ${dependencyKey}`,
      detail: `Complete ${dependencyKey} before enabling ${entry.title}.`,
    };
  }
  if (entry.runtimeIssue) {
    return {
      href: entry.runtimeIssue.href,
      label: entry.runtimeIssue.actionLabel,
      detail: entry.runtimeIssue.detail,
    };
  }
  if (!entry.manageable) {
    return {
      href: '/tenant/billing',
      label: 'Upgrade package',
      detail: 'This module stays locked until the package includes it.',
    };
  }
  return {
    href: entry.actionHref || '/tenant/modules',
    label: entry.actionLabel || 'Open workspace',
    detail: entry.effectiveEnabled
      ? 'Open the workspace that uses this module in daily operations.'
      : 'Open the related workspace and enable this module when ready.',
  };
}

function buildReadiness(summary, runtimeHealth, modules, lockReason) {
  const steps = [
    {
      key: 'package',
      label: 'Unlock at least one module',
      done: summary.packageEnabledModules > 0 || summary.activeModules > 0,
      detail: summary.packageEnabledModules > 0 || summary.activeModules > 0
        ? 'At least one module is included in the current package.'
        : lockReason || 'No module-capable package features are available yet.',
      href: '/tenant/billing',
      actionLabel: 'Open billing',
    },
    {
      key: 'enable',
      label: 'Enable the first module',
      done: summary.activeModules > 0,
      detail: summary.activeModules > 0
        ? 'At least one module is already enabled.'
        : 'Turn on the first module from the module workspace.',
      href: '/tenant/modules',
      actionLabel: 'Open modules',
    },
  ];

  const needsSyncRuntime = modules.some((row) => row.runtimeRole === 'sync' && (row.packageEnabled || row.effectiveEnabled));
  const needsExecuteRuntime = modules.some((row) => row.runtimeRole === 'execute' && (row.packageEnabled || row.effectiveEnabled));

  if (needsSyncRuntime) {
    steps.push({
      key: 'server-bot',
      label: 'Connect Server Bot',
      done: runtimeHealth.syncOnline,
      detail: runtimeHealth.syncOnline
        ? 'A Server Bot is connected for sync-driven modules.'
        : 'Connect a Server Bot so sync-driven modules can operate.',
      href: '/tenant/server-bots',
      actionLabel: 'Open Server Bot',
    });
  }

  if (needsExecuteRuntime) {
    steps.push({
      key: 'delivery-agent',
      label: 'Connect Delivery Agent',
      done: runtimeHealth.executeOnline,
      detail: runtimeHealth.executeOnline
        ? 'A Delivery Agent is connected for execution-driven modules.'
        : 'Connect a Delivery Agent so execution-driven modules can operate.',
      href: '/tenant/delivery-agents',
      actionLabel: 'Open Delivery Agent',
    });
  }

  const completed = steps.filter((step) => step.done).length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    percent,
    completed,
    total,
    steps,
    nextRequiredStep: steps.find((step) => !step.done) || null,
  };
}

function buildIssues(summary, readiness) {
  const issues = [];
  if (summary.packageEnabledModules === 0 && summary.activeModules === 0) {
    issues.push({
      key: 'modules-locked',
      tone: 'warning',
      title: 'No module is available yet',
      detail: 'The current package does not unlock any module-capable feature yet.',
      href: '/tenant/billing',
      actionLabel: 'Open billing',
    });
  }
  if (summary.runtimeBlocked > 0) {
    issues.push({
      key: 'runtime-blocked',
      tone: 'warning',
      title: 'Module runtime setup is incomplete',
      detail: `${summary.runtimeBlocked} module(s) are waiting on Server Bot or Delivery Agent connectivity.`,
      href: '/tenant/server-bots',
      actionLabel: 'Review runtimes',
    });
  }
  if (summary.dependencyBlocked > 0) {
    issues.push({
      key: 'dependency-blocked',
      tone: 'warning',
      title: 'Dependencies are still missing',
      detail: `${summary.dependencyBlocked} module(s) are blocked by another feature that must be enabled first.`,
      href: '/tenant/modules',
      actionLabel: 'Open modules',
    });
  }
  if (summary.activeModules === 0 && readiness.nextRequiredStep) {
    issues.push({
      key: 'no-active-modules',
      tone: 'info',
      title: 'No module is enabled yet',
      detail: readiness.nextRequiredStep.detail,
      href: readiness.nextRequiredStep.href,
      actionLabel: readiness.nextRequiredStep.actionLabel,
    });
  }
  return issues;
}

async function buildTenantModuleOverview(options = {}) {
  const tenantId = normalizeText(options.tenantId);
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const getTenantFeatureAccessFn = options.getTenantFeatureAccessFn || getTenantFeatureAccess;
  const getPlatformTenantConfigFn = options.getPlatformTenantConfigFn || getPlatformTenantConfig;
  const listPlatformAgentRuntimesFn = options.listPlatformAgentRuntimesFn || listPlatformAgentRuntimes;
  const buildTenantProductEntitlementsFn = options.buildTenantProductEntitlementsFn || buildTenantProductEntitlements;

  const [featureAccess, tenantConfig, agentRuntimes] = await Promise.all([
    Promise.resolve(getTenantFeatureAccessFn(tenantId, {})).catch(() => null),
    Promise.resolve(getPlatformTenantConfigFn(tenantId)).catch(() => null),
    Promise.resolve(listPlatformAgentRuntimesFn({ tenantId, limit: 100 })).catch(() => []),
  ]);

  const packageFeatureSet = normalizeFeatureSet(featureAccess?.package?.features || featureAccess?.enabledFeatureKeys);
  const effectiveFeatureSet = normalizeFeatureSet(featureAccess?.enabledFeatureKeys);
  const featureFlags = tenantConfig?.featureFlags && typeof tenantConfig.featureFlags === 'object'
    ? tenantConfig.featureFlags
    : {};
  const runtimeHealth = buildRuntimeHealth(agentRuntimes);
  const entitlements = buildTenantProductEntitlementsFn(featureAccess || {});
  const lockReason = normalizeText(entitlements?.actions?.can_use_modules?.reason);

  const modules = MODULE_CATALOG.map((entry) => {
    const packageEnabled = packageFeatureSet.has(entry.featureKey);
    const effectiveEnabled = effectiveFeatureSet.has(entry.featureKey);
    const manageable = packageEnabled || effectiveEnabled;
    const missingDependencies = entry.dependencies.filter((dependency) => !effectiveFeatureSet.has(dependency));
    const runtimeIssue = resolveRuntimeIssue({
      ...entry,
      packageEnabled,
      effectiveEnabled,
      manageable,
      missingDependencies,
    }, runtimeHealth, effectiveEnabled);
    const state = resolveStateLabel({
      packageEnabled,
      effectiveEnabled,
      manageable,
      missingDependencies,
      runtimeIssue,
    });
    return {
      ...entry,
      packageEnabled,
      effectiveEnabled,
      manageable,
      missingDependencies,
      runtimeIssue,
      overrideState: Object.prototype.hasOwnProperty.call(featureFlags, entry.featureKey)
        ? featureFlags[entry.featureKey]
        : null,
      stateLabel: state.label,
      stateDetail: state.detail,
      stateTone: state.tone,
      nextAction: resolveNextAction({
        ...entry,
        packageEnabled,
        effectiveEnabled,
        manageable,
        missingDependencies,
        runtimeIssue,
      }),
    };
  });

  const summary = {
    totalCatalogModules: modules.length,
    packageEnabledModules: modules.filter((row) => row.packageEnabled).length,
    activeModules: modules.filter((row) => row.effectiveEnabled).length,
    readyNow: modules.filter((row) => row.manageable && !row.effectiveEnabled && row.missingDependencies.length === 0 && !row.runtimeIssue).length,
    dependencyBlocked: modules.filter((row) => row.missingDependencies.length > 0).length,
    runtimeBlocked: modules.filter((row) => Boolean(row.runtimeIssue)).length,
    upgradeRequired: modules.filter((row) => !row.manageable).length,
    overridesEnabled: Object.values(featureFlags).filter((value) => value === true).length,
    overridesDisabled: Object.values(featureFlags).filter((value) => value === false).length,
    syncRuntimesOnline: runtimeHealth.syncOnline ? 1 : 0,
    executeRuntimesOnline: runtimeHealth.executeOnline ? 1 : 0,
  };

  const readiness = buildReadiness(summary, runtimeHealth, modules, lockReason);
  const issues = buildIssues(summary, readiness);
  const topActions = modules
    .filter((row) => !row.effectiveEnabled || row.runtimeIssue || row.missingDependencies.length > 0 || !row.manageable)
    .slice(0, Math.max(1, Math.min(8, asPositiveInt(options.limit, 6))))
    .map((row) => ({
      featureKey: row.featureKey,
      title: row.title,
      stateLabel: row.stateLabel,
      action: row.nextAction,
    }));

  return {
    tenantId,
    generatedAt: new Date().toISOString(),
    summary,
    readiness,
    issues,
    topActions,
    runtimeHealth,
    featureFlags,
    packageFeatures: Array.from(packageFeatureSet),
    enabledFeatureKeys: Array.from(effectiveFeatureSet),
  };
}

module.exports = {
  buildTenantModuleOverview,
};
