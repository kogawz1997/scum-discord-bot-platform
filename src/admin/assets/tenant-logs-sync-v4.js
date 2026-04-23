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

  function parseTimestamp(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function joinParts(parts) {
    return (Array.isArray(parts) ? parts : [])
      .filter(function (part) { return String(part || '').trim(); })
      .join(' · ');
  }

  function statusTone(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['online', 'ready', 'healthy', 'active', 'success', 'completed', 'done', 'verified', 'resolved'].includes(normalized)) return 'success';
    if (['pending', 'queued', 'running', 'stale', 'warning', 'degraded', 'reviewing', 'pending-verification', 'pending-player-reply'].includes(normalized)) return 'warning';
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

  function humanizeIdentifier(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (match) { return match.toUpperCase(); });
  }

  function formatSupportIntentLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'bind') return 'Bind';
    if (normalized === 'unlink') return 'Unlink';
    if (normalized === 'relink') return 'Relink';
    if (normalized === 'conflict') return 'Conflict';
    if (normalized === 'review') return 'Review';
    return humanizeIdentifier(normalized || 'review');
  }

  function normalizeOperationalStatus(value, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['queued', 'pending', 'scheduled'].includes(normalized)) return 'pending';
    if (['processing', 'running', 'retrying', 'in_progress', 'in-progress'].includes(normalized)) return 'running';
    if (['failed', 'cancelled', 'dead-letter', 'error', 'offline', 'revoked'].includes(normalized)) return 'failed';
    if (['done', 'completed', 'complete', 'success', 'succeeded', 'ready', 'active', 'online', 'verified', 'resolved'].includes(normalized)) return 'done';
    if (['reviewing', 'pending-verification', 'pending-player-reply'].includes(normalized)) return 'pending';
    return fallback || 'pending';
  }

  function formatOperationalStatusLabel(value) {
    const normalized = normalizeOperationalStatus(value, 'pending');
    if (normalized === 'running') return 'running';
    if (normalized === 'failed') return 'failed';
    if (normalized === 'done') return 'done';
    return 'pending';
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
      meta: firstNonEmpty([row.scope, row.serverId, row.runtimeKey], ''),
      sourceLabel: 'Sync run',
    };
  }

  function summarizeEvent(row) {
    return {
      title: firstNonEmpty([row.kind, row.title, row.eventType, row.code], 'Sync event'),
      status: firstNonEmpty([row.status, row.severity, row.healthStatus], 'info'),
      at: firstNonEmpty([row.occurredAt, row.createdAt, row.updatedAt], ''),
      detail: firstNonEmpty([row.detail, row.message, row.summary, row.runtimeKey, row.serverId], 'No event detail available'),
      meta: firstNonEmpty([row.runtimeKey, row.serverId], ''),
      sourceLabel: 'Sync event',
    };
  }

  function describeConfigJobTitle(row) {
    const jobType = String(row?.jobType || '').trim().toLowerCase();
    if (jobType === 'config_update') return 'Config changes';
    if (jobType === 'apply') return 'Apply saved settings';
    if (jobType === 'rollback') return 'Rollback config backup';
    if (jobType === 'server_start') return 'Start server';
    if (jobType === 'server_stop') return 'Stop server';
    if (jobType === 'probe_sync') return 'Test sync';
    if (jobType === 'probe_config_access') return 'Test config access';
    if (jobType === 'probe_restart') return 'Test restart';
    return humanizeIdentifier(jobType || 'config job');
  }

  function summarizeConfigJob(row) {
    const queueStatus = normalizeOperationalStatus(row.queueStatus || row.status, 'pending');
    const jobType = String(row?.jobType || '').trim().toLowerCase();
    const applyMode = String(row?.applyMode || '').trim().toLowerCase();
    const needsRestartControl = applyMode === 'save_restart' || ['server_start', 'server_stop', 'probe_restart'].includes(jobType);
    return {
      id: firstNonEmpty([row.id], ''),
      serverId: firstNonEmpty([row.serverId], ''),
      title: firstNonEmpty([row?.meta?.displayName, describeConfigJobTitle(row)], 'Config job'),
      status: formatOperationalStatusLabel(queueStatus),
      at: firstNonEmpty([row.completedAt, row.claimedAt, row.requestedAt], ''),
      detail: firstNonEmpty([
        row.error,
        row?.result?.detail,
        row?.meta?.reason,
        row?.claimedByRuntimeKey,
        row?.requestedBy,
      ], 'No job detail available'),
      retryable: row?.retryable === true,
      needsRestartControl: needsRestartControl,
      meta: firstNonEmpty([row.applyMode, row.jobType], ''),
      sourceLabel: 'Config job',
    };
  }

  function summarizeRestartJob(row) {
    const status = normalizeOperationalStatus(row?.resultStatus || row?.status, 'pending');
    return {
      title: firstNonEmpty([humanizeIdentifier(row?.action), 'Restart action'], 'Restart action'),
      status: formatOperationalStatusLabel(status),
      at: firstNonEmpty([row.completedAt, row.startedAt, row.createdAt], ''),
      detail: firstNonEmpty([
        row.detail,
        row?.metadata?.jobType,
        row?.runtimeKey,
      ], 'No restart detail available'),
      meta: firstNonEmpty([row.runtimeKey, row?.metadata?.jobType], ''),
      sourceLabel: 'Restart',
    };
  }

  function summarizeDeliveryWatch(row, fallbackTitle) {
    const status = normalizeOperationalStatus(row?.status, row?.signalKey === 'deadLetter' ? 'failed' : 'pending');
    return {
      title: firstNonEmpty([row.purchaseCode, fallbackTitle], fallbackTitle || 'Delivery job'),
      status: formatOperationalStatusLabel(status),
      at: firstNonEmpty([row.at, row.updatedAt, row.createdAt], ''),
      detail: firstNonEmpty([
        row.detail,
        row.errorCode,
        row.signalKey,
      ], 'No delivery issue detail available'),
      meta: firstNonEmpty([row.signalKey], ''),
      sourceLabel: 'Delivery',
    };
  }

  function summarizeNotification(row) {
    const eventType = firstNonEmpty([row?.data?.eventType, row?.kind], '').trim().toLowerCase();
    if (eventType === 'platform.player.identity.support') {
      const supportIntent = formatSupportIntentLabel(firstNonEmpty([row?.data?.supportIntent, row?.data?.action], 'review'));
      const supportOutcome = firstNonEmpty([row?.data?.supportOutcome, row?.status, row?.severity], 'reviewing');
      const supportSource = firstNonEmpty([row?.data?.supportSource, row?.source], 'tenant');
      const followupAction = firstNonEmpty([row?.data?.followupAction], '');
      return {
        title: `Identity support: ${supportIntent}`,
        status: supportOutcome,
        at: firstNonEmpty([row.createdAt, row.updatedAt, row?.data?.occurredAt], ''),
        detail: joinParts([
          firstNonEmpty([row?.data?.supportReason, row.detail, row.message], 'Identity support action recorded'),
          supportSource ? `Source ${supportSource}` : '',
          followupAction ? `Next ${formatSupportIntentLabel(followupAction)}` : '',
        ]),
        meta: joinParts([
          firstNonEmpty([row?.data?.userId], '') ? `User ${firstNonEmpty([row?.data?.userId], '')}` : '',
          firstNonEmpty([row?.data?.steamId], '') ? `Steam ${firstNonEmpty([row?.data?.steamId], '')}` : '',
        ]),
        sourceLabel: 'Support',
      };
    }
    return {
      title: firstNonEmpty([row.title, row.kind], 'Operational alert'),
      status: firstNonEmpty([row.severity, row.status], 'info'),
      at: firstNonEmpty([row.createdAt, row.updatedAt], ''),
      detail: firstNonEmpty([row.detail, row.message], 'No alert detail available'),
      meta: firstNonEmpty([row.kind], ''),
      sourceLabel: 'Alert',
    };
  }

  function buildOperationalTimelineRows(rows) {
    return normalizeRows(rows)
      .filter(function (row) { return row && firstNonEmpty([row.at, row.startedAt, row.detail, row.title], ''); })
      .sort(function (left, right) {
        return parseTimestamp(right?.at || right?.startedAt) - parseTimestamp(left?.at || left?.startedAt);
      })
      .slice(0, 10)
      .map(function (row) {
        return {
          title: firstNonEmpty([row.title], 'Timeline item'),
          status: firstNonEmpty([row.status], 'info'),
          at: firstNonEmpty([row.at, row.startedAt], ''),
          detail: firstNonEmpty([row.detail], 'Operational activity recorded'),
          meta: firstNonEmpty([row.meta], ''),
          sourceLabel: firstNonEmpty([row.sourceLabel], ''),
        };
      });
  }

  function createTenantLogsSyncV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const syncRuns = normalizeRows(state.syncRuns).map(summarizeRun);
    const syncEvents = normalizeRows(state.syncEvents).map(summarizeEvent);
    const configJobs = normalizeRows(state.serverConfigJobs).map(summarizeConfigJob);
    const restartJobs = normalizeRows(state.restartExecutions).map(summarizeRestartJob);
    const queueWatch = normalizeRows(state?.deliveryLifecycle?.queueWatch).map(function (row) {
      return summarizeDeliveryWatch(row, 'Delivery queue');
    });
    const deadLetterWatch = normalizeRows(state?.deliveryLifecycle?.deadLetterWatch).map(function (row) {
      return summarizeDeliveryWatch(row, 'Dead-letter item');
    });
    const deliveryWatch = deadLetterWatch.concat(queueWatch).slice(0, 8);
    const notificationRows = normalizeRows(state.notifications).map(summarizeNotification);
    const auditRows = normalizeRows(state.audit).map(function (row) {
      return {
        title: firstNonEmpty([row.action, row.kind, row.title], 'Audit event'),
        status: firstNonEmpty([row.status, row.severity], 'info'),
        at: firstNonEmpty([row.createdAt, row.updatedAt, row.occurredAt], ''),
        detail: firstNonEmpty([row.detail, row.message, row.summary, row.actor], 'No audit detail available'),
        meta: firstNonEmpty([row.actor], ''),
        sourceLabel: 'Audit',
      };
    });
    const timelineRows = buildOperationalTimelineRows(
      notificationRows
        .concat(auditRows)
        .concat(syncRuns)
        .concat(syncEvents)
        .concat(configJobs)
        .concat(restartJobs)
        .concat(deliveryWatch),
    );
    const latestRun = syncRuns[0] || null;
    const latestEvent = syncEvents[0] || null;
    const latestAudit = auditRows[0] || null;
    const lifecycleSummary = state?.deliveryLifecycle?.summary && typeof state.deliveryLifecycle.summary === 'object'
      ? state.deliveryLifecycle.summary
      : {};
    const sectionLock = state.featureEntitlements && state.featureEntitlements.sections && state.featureEntitlements.sections.logs_sync;
    const locked = Boolean(sectionLock && sectionLock.locked);
    const pendingJobs = configJobs.filter(function (row) { return row.status === 'pending'; }).length
      + restartJobs.filter(function (row) { return row.status === 'pending'; }).length
      + Number(lifecycleSummary.queueCount || 0);
    const runningJobs = configJobs.filter(function (row) { return row.status === 'running'; }).length
      + restartJobs.filter(function (row) { return row.status === 'running'; }).length
      + Number(lifecycleSummary.inFlightCount || 0);
    const failedJobs = configJobs.filter(function (row) { return row.status === 'failed'; }).length
      + restartJobs.filter(function (row) { return row.status === 'failed'; }).length
      + Number(lifecycleSummary.deadLetterCount || 0);
    const doneJobs = configJobs.filter(function (row) { return row.status === 'done'; }).length
      + restartJobs.filter(function (row) { return row.status === 'done'; }).length
      + Number(lifecycleSummary.recentSuccessCount || 0);

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
        subtitle: 'Use this page to track sync health, config jobs, restart results, and delivery recovery signals from one place.',
        statusChips: [
          { label: locked ? 'locked by package' : 'visible to operators', tone: locked ? 'warning' : 'success' },
          { label: latestRun ? ('last run ' + formatDateTime(latestRun.startedAt, 'unknown')) : 'no sync runs yet', tone: latestRun ? statusTone(latestRun.status) : 'muted' },
        ],
      },
      locked: locked,
      lockReason: firstNonEmpty([sectionLock && sectionLock.reason], ''),
      summaryStrip: [
        { label: 'Sync runs', value: formatNumber(syncRuns.length), detail: latestRun ? latestRun.detail : 'No sync runs captured yet', tone: latestRun ? statusTone(latestRun.status) : 'muted' },
        { label: 'Pending jobs', value: formatNumber(pendingJobs), detail: runningJobs > 0 ? (formatNumber(runningJobs) + ' running now') : 'No jobs are running right now', tone: pendingJobs > 0 || runningJobs > 0 ? 'warning' : 'success' },
        { label: 'Failed jobs', value: formatNumber(failedJobs), detail: failedJobs > 0 ? 'Review failed config, restart, or delivery work before the next action.' : 'No failed jobs are visible right now', tone: failedJobs > 0 ? 'danger' : 'success' },
        { label: 'Completed jobs', value: formatNumber(doneJobs), detail: doneJobs > 0 ? 'Recent successful work and recovery signals are recorded here.' : 'No completed jobs recorded yet', tone: doneJobs > 0 ? 'success' : 'muted' },
        { label: 'Next action', value: locked ? 'Upgrade' : 'Refresh', detail: locked ? (firstNonEmpty([sectionLock && sectionLock.reason], 'Upgrade package to unlock sync support.')) : 'Refresh this page or open Server Bot for deeper runtime management.', tone: locked ? 'warning' : 'info' },
      ],
      syncRuns: syncRuns.slice(0, 8),
      syncEvents: syncEvents.slice(0, 8),
      configJobs: configJobs.slice(0, 8),
      restartJobs: restartJobs.slice(0, 8),
      deliveryWatch: deliveryWatch,
      notificationRows: notificationRows.slice(0, 8),
      auditRows: auditRows.slice(0, 8),
      timelineRows: timelineRows,
    };
  }

  function buildRow(row) {
    const chips = [renderBadge(row.status, statusTone(row.status))];
    if (row.sourceLabel) chips.push(renderBadge(row.sourceLabel, 'muted'));
    return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(statusTone(row.status)) + '"><div class="tdv4-list-main"><strong>' + escapeHtml(row.title) + '</strong><p>' + escapeHtml(row.detail) + '</p>' + (row.meta ? '<div class="tdv4-kpi-detail">' + escapeHtml(row.meta) + '</div>' : '') + '<div class="tdv4-kpi-detail">' + escapeHtml(formatDateTime(row.startedAt || row.at, 'Unknown time')) + '</div></div><div class="tdv4-chip-row">' + chips.join('') + '</div></article>';
  }

  function buildConfigJobRow(row) {
    return [
      '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(statusTone(row.status)) + '">',
      '<div class="tdv4-list-main">',
      '<strong>' + escapeHtml(row.title) + '</strong>',
      '<p>' + escapeHtml(row.detail) + '</p>',
      '<div class="tdv4-kpi-detail">' + escapeHtml(formatDateTime(row.at, 'Unknown time')) + '</div>',
      '</div>',
      '<div class="tdv4-chip-row">',
      renderBadge(row.status, statusTone(row.status)),
      row.retryable
        ? '<button class="tdv4-button tdv4-button-secondary" type="button" data-config-job-retry data-job-id="' + escapeHtml(row.id) + '" data-server-id="' + escapeHtml(row.serverId) + '" data-job-needs-restart-control="' + escapeHtml(row.needsRestartControl ? 'true' : 'false') + '">Retry failed job</button>'
        : '',
      '</div>',
      '</article>',
    ].join('');
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
      '<div class="tdv4-section-kicker">Operational alerts</div>',
      '<h2 class="tdv4-section-title">Latest alerts</h2>',
      safe.notificationRows.length ? safe.notificationRows.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No alerts yet</strong><p>Runtime, billing, and config alerts will show up here after the first operational signal is recorded.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Audit timeline</div>',
      '<h2 class="tdv4-section-title" data-tenant-logs-sync-timeline>Audit timeline</h2>',
      '<p class="tdv4-section-copy">Merge alerts, audit evidence, support trails, sync activity, config jobs, and restart recovery into one newest-first operator timeline.</p>',
      safe.timelineRows.length ? safe.timelineRows.map(buildRow).join('') : '<div class="tdv4-empty-state"><strong>No audit timeline yet</strong><p>Recent operational activity will appear here once sync, support, or recovery work starts recording timestamps.</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">History</div>',
      '<h2 class="tdv4-section-title">Config jobs and control tasks</h2>',
      '<p class="tdv4-section-copy">Use this list to see whether config apply, rollback, and Server Bot control jobs are pending, running, failed, or done.</p>',
      safe.configJobs.length ? safe.configJobs.map(buildConfigJobRow).join('') : '<div class="tdv4-empty-state"><strong>No config jobs yet</strong><p>Save settings, apply changes, or run a Server Bot test to create the first job.</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Restart / delivery history</div>',
      '<h2 class="tdv4-section-title">Restart results and delivery recovery</h2>',
      (safe.restartJobs.length || safe.deliveryWatch.length)
        ? '<div class="tdv4-stack">' + safe.restartJobs.map(buildRow).join('') + safe.deliveryWatch.map(buildRow).join('') + '</div>'
        : '<div class="tdv4-empty-state"><strong>No recovery signals yet</strong><p>Restart results and delivery recovery signals will appear here after the first operational jobs run.</p></div>',
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
