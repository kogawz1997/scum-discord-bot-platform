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

  function encodeHrefParam(value) {
    return encodeURIComponent(String(value ?? '').trim());
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

  function summarizeCurrentJob(row) {
    if (!row || typeof row !== 'object') return null;
    return {
      title: firstNonEmpty([row.displayName, row.jobType], 'Server Bot job'),
      status: firstNonEmpty([row.status], 'queued'),
      startedAt: firstNonEmpty([row.claimedAt, row.requestedAt], ''),
      completedAt: firstNonEmpty([row.completedAt], ''),
      detail: firstNonEmpty([
        row.error,
        row.result && row.result.detail,
        row.result && row.result.summary,
        row.meta && row.meta.detail,
        row.jobType ? `${row.jobType} job is ${row.status || 'queued'}` : '',
      ], 'No job detail available'),
    };
  }

  function summarizeSupportSignal(row) {
    return {
      key: firstNonEmpty([row.key], 'signal'),
      label: firstNonEmpty([row.label, row.key], 'Signal'),
      count: Number.isFinite(Number(row.count)) ? String(row.count) : '',
      detail: firstNonEmpty([row.detail], 'No follow-up detail available'),
      tone: firstNonEmpty([row.tone], 'warning'),
    };
  }

  function summarizeRecommendedAction(row) {
    return {
      key: firstNonEmpty([row.key], 'follow-up'),
      label: firstNonEmpty([row.label, row.key], 'Recommended action'),
      detail: firstNonEmpty([row.detail], 'No follow-up detail available'),
      tone: firstNonEmpty([row.tone], 'info'),
    };
  }

  function createTenantLogsSyncV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantId = firstNonEmpty([
      state.tenantId,
      state.tenantConfig && state.tenantConfig.tenantId,
      state.me && state.me.tenantId,
    ]);
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
    const supportCase = state.tenantSupportCase && typeof state.tenantSupportCase === 'object'
      ? state.tenantSupportCase
      : null;
    const supportSignals = normalizeRows(supportCase && supportCase.signals).map(summarizeSupportSignal);
    const recommendedActions = normalizeRows(supportCase && supportCase.actions).map(summarizeRecommendedAction);
    const lifecycle = supportCase && supportCase.lifecycle && typeof supportCase.lifecycle === 'object'
      ? supportCase.lifecycle
      : null;
    const currentJob = summarizeCurrentJob(
      state.serverConfigWorkspace
      && state.serverConfigWorkspace.currentJob
      && typeof state.serverConfigWorkspace.currentJob === 'object'
        ? state.serverConfigWorkspace.currentJob
        : null,
    );
    const sectionLock = state.featureEntitlements && state.featureEntitlements.sections && state.featureEntitlements.sections.logs_sync;
    const locked = Boolean(sectionLock && sectionLock.locked);
    const exportBase = tenantId
      ? `/admin/api/platform/tenant-support-case/export?tenantId=${encodeHrefParam(tenantId)}`
      : '';

    return {
      tenantId: tenantId || '',
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
          lifecycle ? { label: `support phase ${firstNonEmpty([lifecycle.label], 'unknown')}`, tone: firstNonEmpty([lifecycle.tone], 'info') } : null,
        ],
      },
      locked: locked,
      lockReason: firstNonEmpty([sectionLock && sectionLock.reason], ''),
      summaryStrip: [
        { label: 'Sync runs', value: formatNumber(syncRuns.length), detail: latestRun ? latestRun.detail : 'No sync runs captured yet', tone: latestRun ? statusTone(latestRun.status) : 'muted' },
        { label: 'Sync events', value: formatNumber(syncEvents.length), detail: latestEvent ? latestEvent.detail : 'No sync events captured yet', tone: latestEvent ? statusTone(latestEvent.status) : 'muted' },
        { label: 'Audit signals', value: formatNumber(auditRows.length), detail: latestAudit ? latestAudit.detail : 'No audit items loaded yet', tone: latestAudit ? statusTone(latestAudit.status) : 'muted' },
        { label: 'Support signals', value: formatNumber(supportSignals.length), detail: supportSignals[0] ? supportSignals[0].detail : 'No support signals loaded yet', tone: supportSignals[0] ? supportSignals[0].tone : 'muted' },
        { label: 'Current job', value: currentJob ? currentJob.status : (locked ? 'locked' : 'idle'), detail: currentJob ? currentJob.detail : (locked ? firstNonEmpty([sectionLock && sectionLock.reason], 'Upgrade package to unlock sync support.') : 'Run a probe or refresh this page to inspect the next workflow step.'), tone: currentJob ? statusTone(currentJob.status) : (locked ? 'warning' : 'info') },
      ],
      lifecycle: lifecycle,
      currentJob: currentJob,
      supportSignals: supportSignals.slice(0, 6),
      recommendedActions: recommendedActions.slice(0, 6),
      syncRuns: syncRuns.slice(0, 8),
      syncEvents: syncEvents.slice(0, 8),
      auditRows: auditRows.slice(0, 8),
      exports: exportBase
        ? {
          jsonHref: `${exportBase}&format=json`,
          csvHref: `${exportBase}&format=csv`,
        }
        : null,
    };
  }

  function buildRow(row) {
    return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(statusTone(row.status)) + '"><div class="tdv4-list-main"><strong>' + escapeHtml(row.title) + '</strong><p>' + escapeHtml(row.detail) + '</p><div class="tdv4-kpi-detail">' + escapeHtml(formatDateTime(row.startedAt || row.at, 'Unknown time')) + '</div></div>' + renderBadge(row.status, statusTone(row.status)) + '</article>';
  }

  function buildSignalRow(row) {
    const countLabel = row.count ? `${row.count} open` : row.label;
    return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(row.tone || 'warning') + '"><div class="tdv4-list-main"><strong>' + escapeHtml(row.label) + '</strong><p>' + escapeHtml(row.detail) + '</p></div>' + renderBadge(countLabel, row.tone || 'warning') + '</article>';
  }

  function buildRecommendedActionRow(row) {
    return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(row.tone || 'info') + '"><div class="tdv4-list-main"><strong>' + escapeHtml(row.label) + '</strong><p>' + escapeHtml(row.detail) + '</p></div>' + renderBadge(firstNonEmpty([row.tone], 'info'), row.tone || 'info') + '</article>';
  }

  function buildTenantLogsSyncV4Html(model) {
    const safe = model || createTenantLogsSyncV4Model({});
    const statusChips = Array.isArray(safe.header.statusChips)
      ? safe.header.statusChips.filter(Boolean)
      : [];
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><button class="tdv4-button tdv4-button-primary" type="button" data-tenant-logs-sync-refresh' + (safe.locked ? ' disabled' : '') + '>Refresh sync status</button>' + (safe.exports ? '<a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(safe.exports.jsonHref) + '">Export JSON</a><a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(safe.exports.csvHref) + '">Export CSV</a>' : '') + '</div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Run Server Bot checks</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(safe.locked ? (safe.lockReason || 'Upgrade package to unlock Server Bot sync support.') : 'Refresh to re-read the latest sync evidence, or queue a focused Server Bot probe when operators need proof that sync, config access, or restart readiness still work.') + '</p>',
      '<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="button" data-server-bot-probe-action="sync">Run sync probe</button><button class="tdv4-button tdv4-button-secondary" type="button" data-server-bot-probe-action="config-access">Run config access probe</button><button class="tdv4-button tdv4-button-secondary" type="button" data-server-bot-probe-action="restart">Run restart readiness probe</button><a class="tdv4-button tdv4-button-secondary" href="/tenant/runtimes/server-bots">Open Server Bot</a><a class="tdv4-button tdv4-button-secondary" href="/tenant/server/config">Open Server Settings</a></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Latest job and sync history</h2>',
      safe.currentJob ? buildRow(safe.currentJob) : '<div class="tdv4-empty-state"><strong>No active job yet</strong><p>Queue a probe from this page or refresh after the Server Bot claims the next job.</p></div>',
      safe.syncRuns.length ? safe.syncRuns.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No sync runs yet</strong><p>Wait for the Server Bot to start syncing or refresh this page after installation.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Recent runtime signals</div>',
      '<h2 class="tdv4-section-title">Recent sync events</h2>',
      safe.syncEvents.length ? safe.syncEvents.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No sync events yet</strong><p>Sync events will appear here after the Server Bot starts reporting.</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Follow-up</div>',
      '<h2 class="tdv4-section-title">Support signals and next steps</h2>',
      safe.supportSignals.length ? safe.supportSignals.map(buildSignalRow).join('') : '<div class="tdv4-empty-state"><strong>No support signals loaded yet</strong><p>Refresh this page after the latest tenant support case bundle is available.</p></div>',
      safe.recommendedActions.length ? safe.recommendedActions.map(buildRecommendedActionRow).join('') : '<div class="tdv4-empty-state"><strong>No recommended next steps yet</strong><p>The current support case looks quiet, or no support case bundle was loaded for this tenant yet.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Evidence</div>',
      '<h2 class="tdv4-section-title">Related audit items</h2>',
      safe.auditRows.length ? safe.auditRows.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No audit items yet</strong><p>Recent operational audit items will show up here once sync activity is recorded.</p></div>',
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
