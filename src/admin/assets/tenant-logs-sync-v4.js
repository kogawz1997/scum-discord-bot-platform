(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantLogsSyncV4 = factory();
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

  function formatDateTime(value, fallback) {
    if (!value) return fallback || 'No data yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? (fallback || 'No data yet')
      : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function statusTone(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['online', 'ready', 'healthy', 'active', 'success', 'completed'].includes(normalized)) return 'success';
    if (['pending', 'queued', 'running', 'stale', 'warning', 'degraded'].includes(normalized)) return 'warning';
    if (['failed', 'offline', 'error', 'revoked'].includes(normalized)) return 'danger';
    return 'muted';
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

  function normalizeRows(value) {
    return Array.isArray(value)
      ? value
      : (value && Array.isArray(value.items) ? value.items : []);
  }

  function summarizeRun(row) {
    return {
      title: firstNonEmpty([row.name, row.kind, row.scope, row.serverId, row.agentId], 'Sync run'),
      status: firstNonEmpty([row.status, row.resultStatus, row.healthStatus], 'unknown'),
      startedAt: firstNonEmpty([row.startedAt, row.requestedAt, row.createdAt], ''),
      detail: firstNonEmpty([row.summary, row.message, row.reason, row.detail, row.runtimeKey], 'No extra detail yet'),
    };
  }

  function summarizeEvent(row) {
    return {
      title: firstNonEmpty([row.kind, row.title, row.eventType, row.code], 'Sync event'),
      status: firstNonEmpty([row.status, row.severity, row.healthStatus], 'info'),
      at: firstNonEmpty([row.occurredAt, row.createdAt, row.updatedAt], ''),
      detail: firstNonEmpty([row.detail, row.message, row.summary, row.runtimeKey, row.serverId], 'No event detail available'),
    };
  }

  function createTenantLogsSyncV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const syncRuns = normalizeRows(state.syncRuns).map(summarizeRun);
    const syncEvents = normalizeRows(state.syncEvents).map(summarizeEvent);
    const auditRows = normalizeRows(state.audit).map(function (row) {
      return {
        title: firstNonEmpty([row.action, row.kind, row.title], 'Audit event'),
        status: firstNonEmpty([row.status, row.severity], 'info'),
        at: firstNonEmpty([row.createdAt, row.updatedAt, row.occurredAt], ''),
        detail: firstNonEmpty([row.detail, row.message, row.summary, row.actor], 'No audit detail available'),
      };
    });
    const latestRun = syncRuns[0] || null;
    const latestEvent = syncEvents[0] || null;
    const latestAudit = auditRows[0] || null;
    const sectionLock = state.featureEntitlements && state.featureEntitlements.sections && state.featureEntitlements.sections.logs_sync;
    const locked = Boolean(sectionLock && sectionLock.locked);

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
        title: 'Logs & Sync',
        subtitle: 'Use this page to see whether the Server Bot is still syncing log and control signals into the platform.',
        statusChips: [
          { label: locked ? 'locked by package' : 'visible to operators', tone: locked ? 'warning' : 'success' },
          { label: latestRun ? ('last run ' + formatDateTime(latestRun.startedAt, 'unknown')) : 'no sync runs yet', tone: latestRun ? statusTone(latestRun.status) : 'muted' },
        ],
      },
      locked: locked,
      lockReason: firstNonEmpty([sectionLock && sectionLock.reason], ''),
      summaryStrip: [
        { label: 'Sync runs', value: formatNumber(syncRuns.length), detail: latestRun ? latestRun.detail : 'No sync runs captured yet', tone: latestRun ? statusTone(latestRun.status) : 'muted' },
        { label: 'Sync events', value: formatNumber(syncEvents.length), detail: latestEvent ? latestEvent.detail : 'No sync events captured yet', tone: latestEvent ? statusTone(latestEvent.status) : 'muted' },
        { label: 'Audit signals', value: formatNumber(auditRows.length), detail: latestAudit ? latestAudit.detail : 'No audit items loaded yet', tone: latestAudit ? statusTone(latestAudit.status) : 'muted' },
        { label: 'Next action', value: locked ? 'Upgrade' : 'Refresh', detail: locked ? (firstNonEmpty([sectionLock && sectionLock.reason], 'Upgrade package to unlock sync support.')) : 'Refresh this page or open Server Bot for deeper runtime management.', tone: locked ? 'warning' : 'info' },
      ],
      syncRuns: syncRuns.slice(0, 8),
      syncEvents: syncEvents.slice(0, 8),
      auditRows: auditRows.slice(0, 8),
    };
  }

  function buildRow(row) {
    return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(statusTone(row.status)) + '"><div class="tdv4-list-main"><strong>' + escapeHtml(row.title) + '</strong><p>' + escapeHtml(row.detail) + '</p><div class="tdv4-kpi-detail">' + escapeHtml(formatDateTime(row.startedAt || row.at, 'Unknown time')) + '</div></div>' + renderBadge(row.status, statusTone(row.status)) + '</article>';
  }

  function buildTenantLogsSyncV4Html(model) {
    const safe = model || createTenantLogsSyncV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><button class="tdv4-button tdv4-button-primary" type="button" data-tenant-logs-sync-refresh' + (safe.locked ? ' disabled' : '') + '>Refresh sync status</button></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Refresh sync status</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(safe.locked ? (safe.lockReason || 'Upgrade package to unlock Server Bot sync support.') : 'Refresh to re-read the latest sync runs, sync events, and audit evidence.') + '</p>',
      '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" href="/tenant/runtimes/server-bots">Open Server Bot</a><a class="tdv4-button tdv4-button-secondary" href="/tenant/server/config">Open Server Settings</a></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Latest sync runs</h2>',
      safe.syncRuns.length ? safe.syncRuns.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No sync runs yet</strong><p>Wait for the Server Bot to start syncing or refresh this page after installation.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Recent sync events</h2>',
      safe.syncEvents.length ? safe.syncEvents.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No sync events yet</strong><p>Sync events will appear here after the Server Bot starts reporting.</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">History</div>',
      '<h2 class="tdv4-section-title">Related audit items</h2>',
      safe.auditRows.length ? safe.auditRows.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No audit items yet</strong><p>Recent operational audit items will show up here once sync activity is recorded.</p></div>',
      '</section>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantLogsSyncV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantLogsSyncV4 requires a root element');
    const model = source && source.header && Array.isArray(source.syncRuns)
      ? source
      : createTenantLogsSyncV4Model(source);
    rootElement.innerHTML = buildTenantLogsSyncV4Html(model);
    return model;
  }

  return {
    buildTenantLogsSyncV4Html: buildTenantLogsSyncV4Html,
    createTenantLogsSyncV4Model: createTenantLogsSyncV4Model,
    renderTenantLogsSyncV4: renderTenantLogsSyncV4,
  };
});
