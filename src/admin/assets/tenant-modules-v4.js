(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantModulesV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const MODULE_CATALOG = [
    {
      featureKey: 'bot_delivery',
      title: 'Delivery',
      description: 'Controls delivery jobs and player-facing item handoff.',
      dependencies: ['orders_module', 'execute_agent'],
    },
    {
      featureKey: 'bot_log',
      title: 'Log sync',
      description: 'Keeps SCUM.log activity visible to the platform.',
      dependencies: ['sync_agent'],
    },
    {
      featureKey: 'donation_module',
      title: 'Donation',
      description: 'Adds donation-facing products and supporter flows.',
      dependencies: ['orders_module', 'player_module'],
    },
    {
      featureKey: 'event_module',
      title: 'Events',
      description: 'Adds event scheduling and event participation tools.',
      dependencies: [],
    },
    {
      featureKey: 'wallet_module',
      title: 'Wallet',
      description: 'Keeps balance-based rewards and purchases working.',
      dependencies: ['orders_module', 'player_module'],
    },
    {
      featureKey: 'ranking_module',
      title: 'Ranking',
      description: 'Enables ranking, leaderboard, and activity summaries.',
      dependencies: ['player_module'],
    },
    {
      featureKey: 'support_module',
      title: 'Notifications',
      description: 'Keeps support and notification-related helpers available.',
      dependencies: ['discord_integration'],
    },
    {
      featureKey: 'analytics_module',
      title: 'Analytics',
      description: 'Adds reporting and operational analytics.',
      dependencies: [],
    },
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function firstNonEmpty(values, fallback = '') {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : fallback;
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return [
      '<section class="tdv4-nav-group">',
      `<div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div>`,
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items.map((item) => {
        const currentClass = item.current ? ' tdv4-nav-link-current' : '';
        return `<a class="tdv4-nav-link${currentClass}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`;
      }) : []),
      '</div>',
      '</section>',
    ].join('');
  }

  function renderSummaryCard(item) {
    return [
      `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-kpi-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-kpi-value">${escapeHtml(item.value)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function createTenantModulesV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const packageFeatureSet = new Set(
      Array.isArray(state?.overview?.tenantFeatureAccess?.package?.features)
        ? state.overview.tenantFeatureAccess.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const effectiveFeatureSet = new Set(
      Array.isArray(state?.overview?.tenantFeatureAccess?.enabledFeatureKeys)
        ? state.overview.tenantFeatureAccess.enabledFeatureKeys.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const featureFlags = state?.tenantConfig?.featureFlags && typeof state.tenantConfig.featureFlags === 'object'
      ? state.tenantConfig.featureFlags
      : {};
    const locked = Boolean(state?.featureEntitlements?.actions?.can_use_modules?.locked);
    const lockReason = String(state?.featureEntitlements?.actions?.can_use_modules?.reason || '').trim();
    const modules = MODULE_CATALOG.map((entry) => {
      const packageEnabled = packageFeatureSet.has(entry.featureKey);
      const effectiveEnabled = effectiveFeatureSet.has(entry.featureKey);
      const manageable = packageEnabled || effectiveEnabled;
      const missingDependencies = entry.dependencies.filter((dependency) => !effectiveFeatureSet.has(dependency));
      return {
        ...entry,
        packageEnabled,
        effectiveEnabled,
        manageable,
        missingDependencies,
        overrideState: Object.prototype.hasOwnProperty.call(featureFlags, entry.featureKey)
          ? featureFlags[entry.featureKey]
          : null,
      };
    });

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Bot modules',
        subtitle: 'Enable or disable tenant modules without mixing package upgrades into day-to-day operations.',
        statusChips: [
          { label: `${formatNumber(modules.filter((row) => row.effectiveEnabled).length)} enabled`, tone: 'success' },
          { label: `${formatNumber(modules.filter((row) => row.manageable).length)} manageable`, tone: 'info' },
          { label: locked ? 'package locked' : 'ready to save', tone: locked ? 'warning' : 'success' },
        ],
        primaryAction: { label: 'Save module changes', href: '#tenant-modules-save' },
      },
      summaryStrip: [
        { label: 'Enabled now', value: formatNumber(modules.filter((row) => row.effectiveEnabled).length), detail: 'Modules currently active for this tenant', tone: 'success' },
        { label: 'Locked by package', value: formatNumber(modules.filter((row) => !row.manageable).length), detail: locked ? lockReason || 'Locked modules need a package upgrade.' : 'Package-aware locks stay visible here.', tone: modules.some((row) => !row.manageable) ? 'warning' : 'muted' },
        { label: 'Dependency watch', value: formatNumber(modules.filter((row) => row.effectiveEnabled && row.missingDependencies.length > 0).length), detail: 'Save is blocked when enabled modules still miss dependencies.', tone: 'info' },
        { label: 'Config source', value: 'Feature flags', detail: 'This page writes tenant feature flags only. It does not change the package.', tone: 'info' },
      ],
      locked,
      lockReason,
      modules,
    };
  }

  function buildTenantModulesV4Html(model) {
    const safe = model || createTenantModulesV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div>`,
      '</div></div></header>',
      '<div class="tdv4-shell">',
      `<aside class="tdv4-sidebar">${(Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups : []).map(renderNavGroup).join('')}</aside>`,
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p>`,
      `<div class="tdv4-chip-row">${safe.header.statusChips.map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div>`,
      '</div>',
      `<div class="tdv4-pagehead-actions"><button id="tenant-modules-save" class="tdv4-button tdv4-button-primary" type="button" data-tenant-modules-save${safe.locked ? ' disabled' : ''}>${escapeHtml(safe.header.primaryAction.label)}</button></div>`,
      '</section>',
      `<section class="tdv4-kpi-strip">${safe.summaryStrip.map(renderSummaryCard).join('')}</section>`,
      `<section class="tdv4-panel tdv4-tone-${safe.locked ? 'warning' : 'info'}"><div class="tdv4-section-kicker">Rules</div><h2 class="tdv4-section-title">Dependency-aware module controls</h2><p class="tdv4-section-copy">This page only changes tenant feature flags. Package-locked modules stay visible but cannot be enabled here.</p>${safe.locked ? `<div class="tdv4-chip-row">${renderBadge(safe.lockReason || 'Upgrade package to unlock more modules.', 'warning')}</div>` : ''}</section>`,
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Module list</h2>',
      '<p class="tdv4-section-copy">Save after changing module state. Reset returns the view to package defaults before saving.</p>',
      '<div class="tdv4-action-list">',
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-modules-reset${safe.locked ? ' disabled' : ''}>Reset to package defaults</button>`,
      '</div>',
      safe.modules.map((row) => [
        `<article class="tdv4-panel tdv4-tone-${row.manageable ? (row.effectiveEnabled ? 'success' : 'muted') : 'warning'}">`,
        `<div class="tdv4-section-kicker">${escapeHtml(row.featureKey)}</div>`,
        `<h3 class="tdv4-section-title">${escapeHtml(row.title)}</h3>`,
        `<p class="tdv4-section-copy">${escapeHtml(row.description)}</p>`,
        '<div class="tdv4-chip-row">',
        renderBadge(row.packageEnabled ? 'in package' : 'upgrade required', row.packageEnabled ? 'info' : 'warning'),
        renderBadge(row.effectiveEnabled ? 'enabled' : 'disabled', row.effectiveEnabled ? 'success' : 'muted'),
        row.overrideState === true ? renderBadge('override on', 'success') : '',
        row.overrideState === false ? renderBadge('override off', 'warning') : '',
        '</div>',
        `<div class="tdv4-kpi-detail">Dependencies: ${escapeHtml(row.dependencies.length ? row.dependencies.join(', ') : 'none')}</div>`,
        row.missingDependencies.length
          ? `<div class="tdv4-kpi-detail">Missing right now: ${escapeHtml(row.missingDependencies.join(', '))}</div>`
          : '<div class="tdv4-kpi-detail">Dependencies currently satisfied.</div>',
        '<label class="tdv4-basic-field">',
        '<div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Enabled</div><div class="tdv4-basic-field-detail">Locked modules stay visible here and require a package upgrade.</div></div>',
        `<input type="checkbox" data-module-toggle data-module-feature-key="${escapeHtml(row.featureKey)}" data-module-package-enabled="${row.packageEnabled ? 'true' : 'false'}" data-module-depends-on="${escapeHtml(row.dependencies.join(','))}"${row.effectiveEnabled ? ' checked' : ''}${(!row.manageable || safe.locked) ? ' disabled' : ''}>`,
        '</label>',
        '</article>',
      ].join('')).join(''),
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantModulesV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantModulesV4 requires a root element');
    const model = source && source.header && Array.isArray(source.modules)
      ? source
      : createTenantModulesV4Model(source);
    rootElement.innerHTML = buildTenantModulesV4Html(model);
    return model;
  }

  return {
    buildTenantModulesV4Html,
    createTenantModulesV4Model,
    renderTenantModulesV4,
  };
});
