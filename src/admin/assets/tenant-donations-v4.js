(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantDonationsV4 = factory();
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

  function formatPrice(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    return new Intl.NumberFormat('en-US').format(amount) + ' coins';
  }

  function formatDateTime(value, fallback) {
    if (!value) return fallback || 'No activity yet';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return fallback || 'No activity yet';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase() === 'disabled' ? 'disabled' : 'active';
  }

  function toneForPurchaseStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['delivered', 'completed', 'success'].includes(normalized)) return 'success';
    if (['pending', 'delivering', 'queued', 'processing'].includes(normalized)) return 'warning';
    if (['delivery_failed', 'failed', 'refunded', 'canceled', 'cancelled'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function renderMiniRow(row) {
    return [
      '<article class="tdv4-panel tdv4-tone-' + escapeHtml(row.tone || 'info') + '">',
      '<div class="tdv4-section-kicker">' + escapeHtml(row.kicker || 'Overview') + '</div>',
      '<h3 class="tdv4-section-title">' + escapeHtml(row.title || 'Untitled') + '</h3>',
      '<p class="tdv4-section-copy">' + escapeHtml(row.detail || '') + '</p>',
      row.meta ? '<div class="tdv4-chip-row">' + renderBadge(row.meta, row.metaTone || 'muted') + '</div>' : '',
      row.action
        ? '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(row.action.href || '#') + '">' + escapeHtml(row.action.label || 'Open') + '</a></div>'
        : '',
      '</article>',
    ].join('');
  }

  function buildReadinessRows(readiness) {
    const steps = Array.isArray(readiness && readiness.steps) ? readiness.steps : [];
    return steps.map(function (step) {
      return {
        kicker: step.done ? 'Done' : 'Next step',
        title: step.label || 'Checklist step',
        detail: step.detail || '',
        meta: step.done ? 'done' : 'not done',
        metaTone: step.done ? 'success' : 'warning',
        tone: step.done ? 'success' : 'warning',
        action: step.done ? null : {
          href: step.href || '#',
          label: step.actionLabel || 'Open',
        },
      };
    });
  }

  function buildIssueRows(issues) {
    return (Array.isArray(issues) ? issues : []).map(function (issue) {
      return {
        kicker: 'Needs attention',
        title: issue.title || 'Operational issue',
        detail: issue.detail || '',
        meta: issue.tone || 'warning',
        metaTone: issue.tone || 'warning',
        tone: issue.tone || 'warning',
        action: issue.actionLabel ? {
          href: issue.href || '#',
          label: issue.actionLabel,
        } : null,
      };
    });
  }

  function buildTopPackageRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row) {
      return {
        kicker: row.kind || 'package',
        title: row.name || row.id || 'Package',
        detail: formatNumber(row.purchases30d, '0') + ' purchases · '
          + formatPrice(row.revenueCoins30d || 0)
          + ' · last status '
          + String(row.latestStatus || 'unknown'),
        meta: row.lastPurchaseAt ? formatDateTime(row.lastPurchaseAt, 'No orders yet') : 'No orders yet',
        metaTone: toneForPurchaseStatus(row.latestStatus),
        tone: row.isSupporter ? 'success' : 'info',
        action: {
          href: '#tenant-donation-packages',
          label: 'Review package',
        },
      };
    });
  }

  function buildRecentActivityRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(function (row) {
      return {
        kicker: row.code || 'Order',
        title: (row.itemName || row.itemId || 'Package') + ' · ' + (row.userId || '-'),
        detail: (row.status || 'unknown') + ' · ' + formatPrice(row.price || 0),
        meta: formatDateTime(row.createdAt, 'No purchase timestamp'),
        metaTone: toneForPurchaseStatus(row.status),
        tone: toneForPurchaseStatus(row.status),
        action: {
          href: '/tenant/orders?code=' + encodeURIComponent(row.code || ''),
          label: 'Open order',
        },
      };
    });
  }

  function createTenantDonationsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const items = Array.isArray(state.shopItems) ? state.shopItems : [];
    const donationsOverview = state.donationsOverview && typeof state.donationsOverview === 'object'
      ? state.donationsOverview
      : {};
    const overviewSummary = donationsOverview.summary && typeof donationsOverview.summary === 'object'
      ? donationsOverview.summary
      : {};
    const readiness = donationsOverview.readiness && typeof donationsOverview.readiness === 'object'
      ? donationsOverview.readiness
      : { percent: 0, completed: 0, total: 0, steps: [], nextRequiredStep: null };
    const locked = Boolean(state?.featureEntitlements?.actions?.can_manage_donations?.locked);
    const lockReason = String(state?.featureEntitlements?.actions?.can_manage_donations?.reason || '').trim();
    const vipCount = items.filter(function (row) { return String(row.kind || '').trim().toLowerCase() === 'vip'; }).length;
    const itemCount = items.filter(function (row) { return String(row.kind || '').trim().toLowerCase() !== 'vip'; }).length;
    const activeCount = items.filter(function (row) { return normalizeStatus(row.status) !== 'disabled'; }).length;
    const disabledCount = Math.max(0, items.length - activeCount);

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
        title: 'Donations',
        subtitle: 'Create donation packages, monitor supporter activity, and check whether the supporter flow is ready for players right now.',
        statusChips: [
          { label: formatNumber(items.length) + ' packages', tone: 'info' },
          { label: formatNumber(overviewSummary.recentPurchases30d, '0') + ' recent orders', tone: overviewSummary.recentPurchases30d ? 'success' : 'muted' },
          { label: formatNumber(readiness.percent, '0') + '% ready', tone: readiness.percent >= 75 ? 'success' : 'warning' },
          { label: locked ? 'locked by package' : 'management ready', tone: locked ? 'warning' : 'success' },
        ],
      },
      locked: locked,
      lockReason: lockReason,
      summaryStrip: [
        { label: 'Packages', value: formatNumber(items.length), detail: 'Donation-facing packages currently visible in the tenant shop', tone: 'info' },
        { label: 'Supporter tiers', value: formatNumber(vipCount), detail: 'Membership or supporter packages', tone: vipCount ? 'success' : 'muted' },
        { label: 'Recent orders', value: formatNumber(overviewSummary.recentPurchases30d, '0'), detail: formatPrice(overviewSummary.supporterRevenueCoins30d || 0) + ' in the last reporting window', tone: overviewSummary.recentPurchases30d ? 'success' : 'muted' },
        { label: 'Delivery pending', value: formatNumber(overviewSummary.deliveryPending30d, '0'), detail: overviewSummary.deliveryPending30d ? 'Orders still waiting on delivery work' : 'No pending supporter delivery work', tone: overviewSummary.deliveryPending30d ? 'warning' : 'success' },
        { label: 'Active supporters', value: formatNumber(overviewSummary.activeSupporters30d, '0'), detail: overviewSummary.lastPurchaseAt ? 'Last purchase ' + formatDateTime(overviewSummary.lastPurchaseAt, 'No purchase yet') : 'No supporter purchases yet', tone: overviewSummary.activeSupporters30d ? 'success' : 'muted' },
        { label: 'Disabled', value: formatNumber(disabledCount), detail: activeCount ? formatNumber(activeCount) + ' packages are active now' : 'Use enable / disable to control package visibility', tone: disabledCount ? 'warning' : 'success' },
      ],
      readiness: {
        percent: Number(readiness.percent || 0) || 0,
        completed: Number(readiness.completed || 0) || 0,
        total: Number(readiness.total || 0) || 0,
        rows: buildReadinessRows(readiness),
        nextRequiredStep: readiness.nextRequiredStep || null,
      },
      issues: buildIssueRows(donationsOverview.issues),
      topPackages: buildTopPackageRows(donationsOverview.topPackages),
      recentActivity: buildRecentActivityRows(donationsOverview.recentActivity),
      items: items.map(function (row) {
        return {
          id: firstNonEmpty([row.id], ''),
          name: firstNonEmpty([row.name, row.id], 'Package'),
          kind: firstNonEmpty([row.kind], 'item'),
          price: Number(row.price || 0) || 0,
          description: firstNonEmpty([row.description], ''),
          gameItemId: firstNonEmpty([row.gameItemId], ''),
          quantity: Number(row.quantity || 1) || 1,
          status: normalizeStatus(row.status),
        };
      }),
    };
  }

  function buildDonationCard(row, locked) {
    var isDisabled = row.status === 'disabled';
    return [
      '<article class="tdv4-panel tdv4-tone-info" data-tenant-donation-card data-item-id="' + escapeHtml(row.id) + '">',
      '<div class="tdv4-section-kicker">' + escapeHtml(row.id) + '</div>',
      '<h3 class="tdv4-section-title">' + escapeHtml(row.name) + '</h3>',
      '<p class="tdv4-section-copy">' + escapeHtml(row.description || 'No description yet') + '</p>',
      '<div class="tdv4-chip-row">' + renderBadge(row.kind, 'info') + renderBadge(formatPrice(row.price), 'success') + renderBadge(isDisabled ? 'disabled' : 'active', isDisabled ? 'warning' : 'success') + (row.gameItemId ? renderBadge(row.gameItemId + ' x' + row.quantity, 'muted') : '') + '</div>',
      '<div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Name</div><div class="tdv4-basic-field-detail">Player-facing package name</div></div><input class="tdv4-basic-input" type="text" data-tenant-donation-name value="' + escapeHtml(row.name) + '"' + (locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Kind</div><div class="tdv4-basic-field-detail">Use item for in-game delivery, vip for membership style packages</div></div><select class="tdv4-basic-input" data-tenant-donation-kind' + (locked ? ' disabled' : '') + '><option value="item"' + (row.kind === 'item' ? ' selected' : '') + '>item</option><option value="vip"' + (row.kind === 'vip' ? ' selected' : '') + '>vip</option></select></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Price</div><div class="tdv4-basic-field-detail">Coin cost used by the current commerce flow</div></div><input class="tdv4-basic-input" type="number" min="1" step="1" data-tenant-donation-price value="' + escapeHtml(String(row.price)) + '"' + (locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">SCUM item id</div><div class="tdv4-basic-field-detail">Required only for item-based packages</div></div><input class="tdv4-basic-input" type="text" data-tenant-donation-game-item-id value="' + escapeHtml(row.gameItemId) + '"' + (locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Quantity</div><div class="tdv4-basic-field-detail">Used when the package kind is item</div></div><input class="tdv4-basic-input" type="number" min="1" step="1" data-tenant-donation-quantity value="' + escapeHtml(String(row.quantity)) + '"' + (locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field tdv4-form-field-span"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Description</div><div class="tdv4-basic-field-detail">Shown to players during purchase</div></div><textarea class="tdv4-editor" rows="4" data-tenant-donation-description' + (locked ? ' disabled' : '') + '>' + escapeHtml(row.description) + '</textarea></label>',
      '</div>',
      '<div class="tdv4-action-list">',
      '<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-donation-save data-item-id="' + escapeHtml(row.id) + '"' + (locked ? ' disabled' : '') + '>Save package</button>',
      '<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-donation-delete data-item-id="' + escapeHtml(row.id) + '"' + (locked ? ' disabled' : '') + '>Delete package</button>',
      '<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-donation-toggle-status data-item-id="' + escapeHtml(row.id) + '" data-next-status="' + escapeHtml(isDisabled ? 'active' : 'disabled') + '"' + (locked ? ' disabled' : '') + '>' + escapeHtml(isDisabled ? 'Enable package' : 'Disable package') + '</button>',
      '</div>',
      '</article>',
    ].join('');
  }

  function buildTenantDonationsV4Html(model) {
    const safe = model || createTenantDonationsV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="#tenant-donation-create">Create donation package</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" data-tenant-donation-readiness>',
      '<div class="tdv4-section-kicker">Readiness</div>',
      '<h2 class="tdv4-section-title">Supporter readiness and next actions</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(
        safe.readiness.nextRequiredStep
          ? 'Complete the next required step, then keep an eye on live supporter activity from this same workspace.'
          : 'The supporter flow has a healthy baseline. Use this page to keep packages, activity, and delivery signals aligned.'
      ) + '</p>',
      '<div class="tdv4-chip-row">' + renderBadge(formatNumber(safe.readiness.percent, '0') + '% ready', safe.readiness.percent >= 75 ? 'success' : 'warning') + renderBadge(formatNumber(safe.readiness.completed, '0') + ' / ' + formatNumber(safe.readiness.total, '0') + ' checklist steps', 'info') + '</div>',
      (Array.isArray(safe.readiness.rows) && safe.readiness.rows.length
        ? safe.readiness.rows.map(renderMiniRow).join('')
        : '<div class="tdv4-empty-state"><strong>No readiness data yet</strong><p>Refresh the tenant workspace to rebuild donation readiness.</p></div>'),
      '</section>',
      '<section class="tdv4-panel" data-tenant-donation-activity>',
      '<div class="tdv4-section-kicker">Recent activity</div>',
      '<h2 class="tdv4-section-title">Supporter activity and operator signals</h2>',
      '<p class="tdv4-section-copy">Review recent supporter orders, package performance, and the operational issues that still need follow-up.</p>',
      (Array.isArray(safe.issues) && safe.issues.length
        ? safe.issues.map(renderMiniRow).join('')
        : '<div class="tdv4-empty-state"><strong>No urgent issues</strong><p>The current donation window has no warnings or failures that need immediate follow-up.</p></div>'),
      (Array.isArray(safe.recentActivity) && safe.recentActivity.length
        ? safe.recentActivity.map(renderMiniRow).join('')
        : '<div class="tdv4-empty-state"><strong>No supporter activity yet</strong><p>Recent supporter orders will appear here as soon as players start buying packages.</p></div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel" data-tenant-donation-top-packages>',
      '<div class="tdv4-section-kicker">Package performance</div>',
      '<h2 class="tdv4-section-title">Top packages in the current reporting window</h2>',
      '<p class="tdv4-section-copy">Use this list to see which supporter packages are active, which ones are actually converting, and which packages should be cleaned up.</p>',
      (Array.isArray(safe.topPackages) && safe.topPackages.length
        ? safe.topPackages.map(renderMiniRow).join('')
        : '<div class="tdv4-empty-state"><strong>No package activity yet</strong><p>Package performance will show up here after the first supporter purchases land.</p></div>'),
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" id="tenant-donation-create">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Create donation package</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(safe.locked ? (safe.lockReason || 'Upgrade package to unlock donation tools.') : 'Create a new tenant package without leaving the admin workspace.') + '</p>',
      '<form class="tdv4-runtime-form" data-tenant-donation-create-form>',
      '<div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Package id</div><div class="tdv4-basic-field-detail">Stable id used by the commerce system</div></div><input class="tdv4-basic-input" type="text" name="id" placeholder="starter-crate"' + (safe.locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Name</div><div class="tdv4-basic-field-detail">Player-facing package name</div></div><input class="tdv4-basic-input" type="text" name="name" placeholder="Starter crate"' + (safe.locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Kind</div><div class="tdv4-basic-field-detail">Use vip for membership or supporter style packages</div></div><select class="tdv4-basic-input" name="kind"' + (safe.locked ? ' disabled' : '') + '><option value="item">item</option><option value="vip">vip</option></select></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Price</div><div class="tdv4-basic-field-detail">Coin cost used by the current commerce flow</div></div><input class="tdv4-basic-input" type="number" min="1" step="1" name="price" value="1000"' + (safe.locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">SCUM item id</div><div class="tdv4-basic-field-detail">Required for item-based packages</div></div><input class="tdv4-basic-input" type="text" name="gameItemId" placeholder="BP_AmmoBox_01"' + (safe.locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Quantity</div><div class="tdv4-basic-field-detail">How many items should be delivered</div></div><input class="tdv4-basic-input" type="number" min="1" step="1" name="quantity" value="1"' + (safe.locked ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field tdv4-form-field-span"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Description</div><div class="tdv4-basic-field-detail">Shown to players before checkout</div></div><textarea class="tdv4-editor" rows="4" name="description"' + (safe.locked ? ' disabled' : '') + '></textarea></label>',
      '</div>',
      '<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-donation-create' + (safe.locked ? ' disabled' : '') + '>Create donation package</button></div>',
      '</form>',
      '</section>',
      '<section class="tdv4-panel" id="tenant-donation-packages">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Current donation packages</h2>',
      '<p class="tdv4-section-copy">Save changes to update package fields, or enable / disable packages without removing them from history.</p>',
      safe.items.length ? safe.items.map(function (row) { return buildDonationCard(row, safe.locked); }).join('') : '<div class="tdv4-empty-state"><strong>No donation packages yet</strong><p>Create the first package from the form on the left.</p></div>',
      '</section>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantDonationsV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantDonationsV4 requires a root element');
    const model = source && source.header && Array.isArray(source.items)
      ? source
      : createTenantDonationsV4Model(source);
    rootElement.innerHTML = buildTenantDonationsV4Html(model);
    return model;
  }

  return {
    buildTenantDonationsV4Html: buildTenantDonationsV4Html,
    createTenantDonationsV4Model: createTenantDonationsV4Model,
    renderTenantDonationsV4: renderTenantDonationsV4,
  };
});
