(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantBillingV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function firstNonEmpty(values, fallback) {
    const rows = Array.isArray(values) ? values : [values];
    for (const value of rows) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return fallback || '';
  }

  function formatNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : (fallback || '0');
  }

  function formatMoney(cents, currency) {
    const amount = Number(cents || 0) / 100;
    const normalizedCurrency = String(currency || 'USD').trim().toUpperCase() || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: normalizedCurrency }).format(amount);
    } catch {
      return normalizedCurrency + ' ' + amount.toFixed(2);
    }
  }

  function formatDateTime(value, fallback) {
    if (!value) return fallback || 'No date yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? (fallback || 'No date yet')
      : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function renderBadge(label, tone) {
    return '<span class="tdv4-badge tdv4-badge-' + escapeHtml(tone || 'muted') + '">' + escapeHtml(label) + '</span>';
  }

  function renderNavGroup(group) {
    return [
      '<section class="tdv4-nav-group">',
      '<div class="tdv4-nav-group-label">' + escapeHtml(group.label) + '</div>',
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items.map(function (item) {
        return '<a class="tdv4-nav-link' + (item.current ? ' tdv4-nav-link-current' : '') + '" href="' + escapeHtml(item.href || '#') + '">' + escapeHtml(item.label) + '</a>';
      }) : []),
      '</div>',
      '</section>',
    ].join('');
  }

  function renderSummaryCard(item) {
    return [
      '<article class="tdv4-kpi tdv4-tone-' + escapeHtml(item.tone || 'muted') + '">',
      '<div class="tdv4-kpi-label">' + escapeHtml(item.label) + '</div>',
      '<div class="tdv4-kpi-value">' + escapeHtml(item.value) + '</div>',
      '<div class="tdv4-kpi-detail">' + escapeHtml(item.detail) + '</div>',
      '</article>',
    ].join('');
  }

  function createTenantBillingV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const subscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
    const billingOverview = state.billingOverview && typeof state.billingOverview === 'object' ? state.billingOverview : {};
    const invoices = Array.isArray(state.billingInvoices) ? state.billingInvoices : [];
    const attempts = Array.isArray(state.billingPaymentAttempts) ? state.billingPaymentAttempts : [];
    const packageInfo = state.overview && state.overview.tenantFeatureAccess && state.overview.tenantFeatureAccess.package
      ? state.overview.tenantFeatureAccess.package
      : {};
    const lockedActions = Object.entries(state.featureEntitlements && state.featureEntitlements.actions || {})
      .filter(function (entry) { return entry[1] && entry[1].locked; })
      .map(function (entry) {
        return {
          key: entry[0],
          reason: firstNonEmpty([entry[1].reason], 'Locked by package'),
        };
      });

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state.tenantLabel,
          state.tenantConfig && state.tenantConfig.name,
          state.overview && state.overview.tenantName,
          state.me && state.me.tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state.__surfaceShell && state.__surfaceShell.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Billing',
        subtitle: 'Review subscription health, locked features, and recent invoice history before asking the team to upgrade.',
        statusChips: [
          { label: firstNonEmpty([packageInfo.name, packageInfo.id, subscriptions[0] && subscriptions[0].planId], 'No package data'), tone: 'info' },
          { label: subscriptions.length ? firstNonEmpty([subscriptions[0].status], 'active') : 'No subscription', tone: subscriptions.length ? 'success' : 'warning' },
        ],
      },
      summaryStrip: [
        { label: 'Current package', value: firstNonEmpty([packageInfo.name, packageInfo.id], 'Unknown'), detail: 'Package features shown below come from the current tenant entitlement set', tone: 'info' },
        { label: 'Collected', value: formatMoney(billingOverview.summary && billingOverview.summary.collectedCents || 0, subscriptions[0] && subscriptions[0].currency || 'USD'), detail: 'Paid invoices seen in the billing lifecycle store', tone: 'success' },
        { label: 'Open invoices', value: formatNumber(billingOverview.summary && billingOverview.summary.openInvoiceCount || 0), detail: 'Invoices still waiting for payment or resolution', tone: (billingOverview.summary && billingOverview.summary.openInvoiceCount) ? 'warning' : 'muted' },
        { label: 'Locked actions', value: formatNumber(lockedActions.length), detail: lockedActions.length ? 'Use this page to understand what an upgrade would unlock' : 'No action locks reported right now', tone: lockedActions.length ? 'warning' : 'success' },
      ],
      subscriptions: subscriptions.slice(0, 6),
      invoices: invoices.slice(0, 8),
      attempts: attempts.slice(0, 8),
      lockedActions: lockedActions.slice(0, 10),
    };
  }

  function buildTenantBillingV4Html(model) {
    const safe = model || createTenantBillingV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="/pricing">Upgrade package</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Upgrade package</h2>',
      '<p class="tdv4-section-copy">This action opens package options without removing the current tenant context. Use it when locked actions are slowing daily operations.</p>',
      '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-primary" href="/pricing">Review package options</a><button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-billing-refresh>Refresh billing data</button></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Subscriptions</h2>',
      safe.subscriptions.length ? safe.subscriptions.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-info"><div class="tdv4-list-main"><strong>' + escapeHtml(firstNonEmpty([row.planId, row.id], 'Subscription')) + '</strong><p>Billing cycle: ' + escapeHtml(firstNonEmpty([row.billingCycle], '-')) + ' | Renews: ' + escapeHtml(formatDateTime(row.renewsAt, 'No renewal date')) + '</p></div><div class="tdv4-chip-row">' + renderBadge(firstNonEmpty([row.status], 'unknown'), 'info') + renderBadge(formatMoney(row.amountCents, row.currency), 'success') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>No subscription rows yet</strong><p>The billing lifecycle store has not returned subscription data for this tenant.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Invoices</div>',
      '<h2 class="tdv4-section-title">Recent invoices</h2>',
      safe.invoices.length ? safe.invoices.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-info"><div class="tdv4-list-main"><strong>' + escapeHtml(firstNonEmpty([row.id], 'Invoice')) + '</strong><p>Due ' + escapeHtml(formatDateTime(row.dueAt, 'No due date')) + ' | Paid ' + escapeHtml(formatDateTime(row.paidAt, 'Not paid yet')) + '</p></div><div class="tdv4-chip-row">' + renderBadge(firstNonEmpty([row.status], 'unknown'), 'info') + renderBadge(formatMoney(row.amountCents, row.currency), 'success') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>No invoices yet</strong><p>Invoice history will show up here after the first billing cycle runs.</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Locked states</div>',
      '<h2 class="tdv4-section-title">Actions blocked by package</h2>',
      safe.lockedActions.length ? safe.lockedActions.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-warning"><div class="tdv4-list-main"><strong>' + escapeHtml(row.key) + '</strong><p>' + escapeHtml(row.reason) + '</p></div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>No action locks</strong><p>The current package is not reporting blocked tenant actions right now.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Payment attempts</div>',
      '<h2 class="tdv4-section-title">Recent payment attempts</h2>',
      safe.attempts.length ? safe.attempts.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(String(row.status || '').trim().toLowerCase() === 'failed' ? 'warning' : 'info') + '"><div class="tdv4-list-main"><strong>' + escapeHtml(firstNonEmpty([row.provider, row.id], 'Attempt')) + '</strong><p>' + escapeHtml(firstNonEmpty([row.errorDetail, row.errorCode, 'No payment error recorded'])) + '</p></div><div class="tdv4-chip-row">' + renderBadge(firstNonEmpty([row.status], 'unknown'), 'info') + renderBadge(formatMoney(row.amountCents, row.currency), 'success') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>No payment attempts yet</strong><p>Payment attempt history will appear here when the billing lifecycle records it.</p></div>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantBillingV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantBillingV4 requires a root element');
    const model = source && source.header && Array.isArray(source.subscriptions)
      ? source
      : createTenantBillingV4Model(source);
    rootElement.innerHTML = buildTenantBillingV4Html(model);
    return model;
  }

  return {
    buildTenantBillingV4Html: buildTenantBillingV4Html,
    createTenantBillingV4Model: createTenantBillingV4Model,
    renderTenantBillingV4: renderTenantBillingV4,
  };
});
