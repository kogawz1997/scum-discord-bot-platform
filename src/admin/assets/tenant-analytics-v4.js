(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantAnalyticsV4 = factory();
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

  function firstNonEmpty(values, fallback = '') {
    const rows = Array.isArray(values) ? values : [values];
    for (const value of rows) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return fallback;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : fallback;
  }

  function formatPercent(value, fallback = '0%') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${formatNumber(numeric, '0')}%` : fallback;
  }

  function formatMoney(cents, currency) {
    const amount = Number(cents || 0) / 100;
    const normalizedCurrency = String(currency || 'USD').trim().toUpperCase() || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: normalizedCurrency }).format(amount);
    } catch {
      return `${normalizedCurrency} ${amount.toFixed(2)}`;
    }
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value, fallback = 'No timestamp yet') {
    const date = parseDate(value);
    return date
      ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
      : fallback;
  }

  function formatRelative(value, fallback = 'No timestamp yet') {
    const date = parseDate(value);
    if (!date) return fallback;
    const deltaMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (deltaMinutes < 60) return `${formatNumber(deltaMinutes, '0')} min ago`;
    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) return `${formatNumber(deltaHours, '0')} hr ago`;
    const deltaDays = Math.round(deltaHours / 24);
    return `${formatNumber(deltaDays, '0')} day ago`;
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

  function normalizeStatus(value, fallback = 'unknown') {
    const text = String(value || '').trim().toLowerCase();
    return text || fallback;
  }

  function toneForStatus(value) {
    const normalized = normalizeStatus(value);
    if (['active', 'online', 'healthy', 'ready', 'completed', 'succeeded', 'sent', 'success'].includes(normalized)) return 'success';
    if (['scheduled', 'running', 'pending', 'trial', 'processing', 'queued', 'warning', 'degraded', 'past_due'].includes(normalized)) return 'warning';
    if (['failed', 'error', 'blocked', 'offline', 'canceled', 'cancelled', 'disputed', 'void', 'refunded'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function humanizeKey(value) {
    return String(value || '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, function (match) { return match.toUpperCase(); }) || 'Unknown';
  }

  function normalizeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function buildDeliverySignalRows(report) {
    return normalizeList(report && report.signals).slice(0, 6).map(function (row) {
      return {
        title: humanizeKey(row && row.key),
        detail: firstNonEmpty([row && row.detail, row && row.message], 'Delivery lifecycle signal from the queue monitor.'),
        meta: `${formatNumber(row && row.count, '0')} hits`,
        tone: row && row.tone ? row.tone : 'info',
      };
    });
  }

  function buildActionPlanRows(report) {
    return normalizeList(report && report.actionPlan && report.actionPlan.actions).slice(0, 6).map(function (row) {
      return {
        title: humanizeKey(row && row.key),
        detail: firstNonEmpty([row && row.detail, row && row.reason], 'Recommended next action from the delivery lifecycle report.'),
        meta: `${formatNumber(row && row.count, '0')} affected`,
        tone: row && row.tone ? row.tone : 'warning',
      };
    });
  }

  function buildTopErrorRows(report) {
    return normalizeList(report && report.topErrors).slice(0, 6).map(function (row) {
      return {
        title: firstNonEmpty([row && row.key], 'Unknown error'),
        detail: firstNonEmpty([row && row.detail], 'Recurring error signature from queue or dead-letter records.'),
        meta: `${formatNumber(row && row.count, '0')} rows`,
        tone: 'danger',
      };
    });
  }

  function buildRestartRows(state) {
    const plans = normalizeList(state && state.restartPlans).slice(0, 4).map(function (row) {
      return {
        title: `Plan ${firstNonEmpty([row && row.restartMode], 'restart')}`,
        detail: `${firstNonEmpty([row && row.status], 'unknown')} · ${formatDateTime(row && (row.scheduledFor || row.createdAt), 'No schedule')}`,
        meta: firstNonEmpty([row && row.reason, row && row.healthStatus], 'Restart plan'),
        tone: toneForStatus(row && row.status),
      };
    });
    const executions = normalizeList(state && state.restartExecutions).slice(0, 4).map(function (row) {
      return {
        title: `Execution ${firstNonEmpty([row && row.resultStatus], 'unknown')}`,
        detail: `${firstNonEmpty([row && row.runtimeKey], 'runtime')} · ${formatDateTime(row && (row.finishedAt || row.startedAt || row.createdAt), 'No execution time')}`,
        meta: firstNonEmpty([row && row.detail, row && row.actor], 'Restart execution'),
        tone: toneForStatus(row && row.resultStatus),
      };
    });
    return plans.concat(executions).slice(0, 8);
  }

  function buildSyncRows(state) {
    const runs = normalizeList(state && state.syncRuns).slice(0, 4).map(function (row) {
      return {
        title: `Sync ${firstNonEmpty([row && row.status], 'run')}`,
        detail: formatDateTime(row && (row.finishedAt || row.startedAt || row.createdAt), 'No sync timestamp'),
        meta: firstNonEmpty([row && row.scope, row && row.serverId, row && row.runtimeKey], 'Sync run'),
        tone: toneForStatus(row && row.status),
      };
    });
    const events = normalizeList(state && state.syncEvents).slice(0, 4).map(function (row) {
      return {
        title: firstNonEmpty([row && row.kind, row && row.eventType], 'Sync event'),
        detail: formatDateTime(row && (row.createdAt || row.occurredAt), 'No event timestamp'),
        meta: firstNonEmpty([row && row.detail, row && row.summary, row && row.serverId], 'Sync event'),
        tone: toneForStatus(row && row.status),
      };
    });
    return runs.concat(events).slice(0, 8);
  }

  function buildBillingRows(state) {
    const invoices = normalizeList(state && state.billingInvoices).slice(0, 4).map(function (row) {
      return {
        title: firstNonEmpty([row && row.id], 'Invoice'),
        detail: `${firstNonEmpty([row && row.status], 'unknown')} · ${formatMoney(row && row.amountCents, row && row.currency)}`,
        meta: `Due ${formatDateTime(row && row.dueAt, 'No due date')}`,
        tone: toneForStatus(row && row.status),
      };
    });
    const attempts = normalizeList(state && state.billingPaymentAttempts)
      .filter(function (row) { return !['succeeded', 'paid', 'captured'].includes(normalizeStatus(row && row.status)); })
      .slice(0, 4)
      .map(function (row) {
        return {
          title: `Attempt ${firstNonEmpty([row && row.status], 'unknown')}`,
          detail: `${firstNonEmpty([row && row.provider], 'provider')} · ${formatMoney(row && row.amountCents, row && row.currency)}`,
          meta: firstNonEmpty([row && row.errorCode, row && row.detail], 'Payment attempt'),
          tone: toneForStatus(row && row.status),
        };
      });
    return invoices.concat(attempts).slice(0, 8);
  }

  function buildCommunityRows(state) {
    const killfeed = normalizeList(state && state.killfeed).slice(0, 4).map(function (row) {
      return {
        title: `${firstNonEmpty([row && row.killerName], 'Unknown')} eliminated ${firstNonEmpty([row && row.victimName], 'Unknown')}`,
        detail: `${firstNonEmpty([row && row.weapon], 'Unknown weapon')} · ${formatDateTime(row && row.occurredAt, 'No combat time')}`,
        meta: firstNonEmpty([row && row.sector, row && row.hitZone], 'Kill feed'),
        tone: 'danger',
      };
    });
    const events = normalizeList(state && state.events).slice(0, 2).map(function (row) {
      return {
        title: firstNonEmpty([row && row.title, row && row.name], 'Live event'),
        detail: firstNonEmpty([row && row.summary, row && row.description], 'Configured event entry'),
        meta: firstNonEmpty([row && row.status, row && row.kind], 'Event'),
        tone: toneForStatus(row && row.status),
      };
    });
    const raids = []
      .concat(normalizeList(state && state.raids && state.raids.windows).slice(0, 1))
      .concat(normalizeList(state && state.raids && state.raids.summaries).slice(0, 1))
      .map(function (row) {
        return {
          title: firstNonEmpty([row && row.title, row && row.summary, row && row.status], 'Raid activity'),
          detail: firstNonEmpty([row && row.detail, row && row.notes], 'Raid timeline item'),
          meta: firstNonEmpty([row && row.status, row && row.windowLabel], 'Raid'),
          tone: toneForStatus(row && row.status),
        };
      });
    return killfeed.concat(events).concat(raids).slice(0, 8);
  }

  function buildNotificationRows(state) {
    const notifications = normalizeList(state && state.notifications).slice(0, 4).map(function (row) {
      return {
        title: firstNonEmpty([row && row.title, row && row.kind], 'Notification'),
        detail: firstNonEmpty([row && row.detail, row && row.message], 'Operational notification'),
        meta: formatDateTime(row && row.createdAt, 'No notification time'),
        tone: toneForStatus(row && row.severity),
      };
    });
    const auditRows = normalizeList(state && state.audit && state.audit.items).slice(0, 4).map(function (row) {
      return {
        title: firstNonEmpty([row && row.action], 'Audit entry'),
        detail: firstNonEmpty([row && row.detail, row && row.summary], 'Audit evidence'),
        meta: formatDateTime(row && row.createdAt, 'No audit timestamp'),
        tone: 'info',
      };
    });
    return notifications.concat(auditRows).slice(0, 8);
  }

  function renderInsightList(rows, emptyTitle, emptyDetail) {
    return rows.length
      ? rows.map(function (row) {
        return [
          '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(row.tone || 'muted') + '">',
          '<div class="tdv4-list-main">',
          '<strong>' + escapeHtml(row.title) + '</strong>',
          '<p>' + escapeHtml(row.detail) + '</p>',
          '</div>',
          '<div class="tdv4-chip-row">' + renderBadge(row.meta || '-', row.tone || 'muted') + '</div>',
          '</article>',
        ].join('');
      }).join('')
      : '<div class="tdv4-empty-state"><strong>' + escapeHtml(emptyTitle) + '</strong><p>' + escapeHtml(emptyDetail) + '</p></div>';
  }

  function createTenantAnalyticsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const delivery = state && state.overview && state.overview.analytics && state.overview.analytics.delivery
      ? state.overview.analytics.delivery
      : {};
    const deliveryLifecycle = state && state.deliveryLifecycle && typeof state.deliveryLifecycle === 'object'
      ? state.deliveryLifecycle
      : {};
    const deliverySummary = deliveryLifecycle.summary && typeof deliveryLifecycle.summary === 'object'
      ? deliveryLifecycle.summary
      : {};
    const billingOverview = state && state.billingOverview && typeof state.billingOverview === 'object'
      ? state.billingOverview
      : {};
    const billingSummary = billingOverview.summary && typeof billingOverview.summary === 'object'
      ? billingOverview.summary
      : {};
    const restartPlans = normalizeList(state && state.restartPlans);
    const restartExecutions = normalizeList(state && state.restartExecutions);
    const notifications = normalizeList(state && state.notifications);
    const auditRows = normalizeList(state && state.audit && state.audit.items);
    const syncRuns = normalizeList(state && state.syncRuns);
    const syncEvents = normalizeList(state && state.syncEvents);
    const killfeed = normalizeList(state && state.killfeed);
    const events = normalizeList(state && state.events);
    const raidRequests = normalizeList(state && state.raids && state.raids.requests);
    const raidWindows = normalizeList(state && state.raids && state.raids.windows);
    const raidSummaries = normalizeList(state && state.raids && state.raids.summaries);
    const invoices = normalizeList(state && state.billingInvoices);
    const paymentAttempts = normalizeList(state && state.billingPaymentAttempts);
    const openInvoiceCount = Number.isFinite(Number(billingSummary.openInvoiceCount))
      ? Number(billingSummary.openInvoiceCount)
      : invoices.filter(function (row) { return !['paid', 'succeeded'].includes(normalizeStatus(row && row.status)); }).length;
    const failedAttemptCount = paymentAttempts.filter(function (row) {
      return ['failed', 'past_due', 'canceled', 'cancelled', 'disputed'].includes(normalizeStatus(row && row.status));
    }).length;
    const blockedRestartCount = restartPlans.filter(function (row) { return normalizeStatus(row && row.status) === 'blocked'; }).length;
    const pendingRestartCount = restartPlans.filter(function (row) {
      return ['scheduled', 'running', 'pending'].includes(normalizeStatus(row && row.status));
    }).length;
    const verificationPendingCount = restartPlans.filter(function (row) {
      return normalizeStatus(row && row.healthStatus) === 'pending_verification';
    }).length;
    const failedRestartCount = restartExecutions.filter(function (row) {
      return ['failed', 'error'].includes(normalizeStatus(row && row.resultStatus));
    }).length;
    const lastSyncAt = firstNonEmpty([
      delivery.lastSyncAt,
      syncRuns[0] && (syncRuns[0].finishedAt || syncRuns[0].startedAt || syncRuns[0].createdAt),
      syncEvents[0] && (syncEvents[0].createdAt || syncEvents[0].occurredAt),
    ], '');
    const communityActivityCount = killfeed.length + events.length + raidRequests.length + raidWindows.length + raidSummaries.length;
    const tenantId = firstNonEmpty([state && state.tenantId, state && state.me && state.me.tenantId], '');
    const deliveryExportHref = tenantId
      ? `/admin/api/delivery/lifecycle/export?tenantId=${encodeURIComponent(tenantId)}&limit=80&pendingOverdueMs=1200000&format=csv`
      : '/admin/api/delivery/lifecycle/export?format=csv';

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state && state.tenantLabel,
          state && state.tenantConfig && state.tenantConfig.name,
          state && state.overview && state.overview.tenantName,
          tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state && state.__surfaceShell && state.__surfaceShell.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Analytics',
        subtitle: 'Track delivery pressure, restart outcomes, billing signals, and community activity from one daily reporting workspace.',
        statusChips: [
          { label: firstNonEmpty([state && state.activeServer && state.activeServer.name, state && state.activeServer && state.activeServer.id], 'No server selected'), tone: 'info' },
          { label: lastSyncAt ? `Last sync ${formatRelative(lastSyncAt)}` : 'No sync timestamp', tone: lastSyncAt ? 'success' : 'warning' },
          { label: `${formatNumber(blockedRestartCount, '0')} blocked restarts`, tone: blockedRestartCount > 0 ? 'danger' : 'success' },
          { label: `${formatNumber(notifications.length, '0')} notifications`, tone: notifications.length > 0 ? 'warning' : 'muted' },
        ],
      },
      summaryStrip: [
        { label: 'Orders (30d)', value: formatNumber(delivery.purchaseCount30d, '0'), detail: 'Purchase volume from tenant analytics', tone: 'info' },
        { label: 'Delivery success', value: formatPercent(delivery.successRate, '0%'), detail: `${formatNumber(deliverySummary.recentSuccessCount, '0')} recent successes tracked`, tone: 'success' },
        { label: 'Queue pressure', value: formatNumber(deliverySummary.queueCount, formatNumber(normalizeList(state && state.queueItems).length, '0')), detail: `${formatNumber(deliverySummary.deadLetterCount, formatNumber(normalizeList(state && state.deadLetters).length, '0'))} dead letters need review`, tone: Number(deliverySummary.deadLetterCount) > 0 ? 'warning' : 'info' },
        { label: 'Restart follow-up', value: formatNumber(pendingRestartCount + verificationPendingCount, '0'), detail: `${formatNumber(blockedRestartCount, '0')} blocked · ${formatNumber(failedRestartCount, '0')} failed`, tone: blockedRestartCount + failedRestartCount > 0 ? 'danger' : 'success' },
        { label: 'Open invoices', value: formatNumber(openInvoiceCount, '0'), detail: `${formatNumber(failedAttemptCount, '0')} payment attempts need attention`, tone: openInvoiceCount > 0 || failedAttemptCount > 0 ? 'warning' : 'success' },
        { label: 'Community activity', value: formatNumber(communityActivityCount, '0'), detail: `${formatNumber(killfeed.length, '0')} kill feed · ${formatNumber(events.length, '0')} events · ${formatNumber(raidWindows.length, '0')} raid windows`, tone: communityActivityCount > 0 ? 'info' : 'muted' },
      ],
      deliverySignals: buildDeliverySignalRows(deliveryLifecycle),
      deliveryActions: buildActionPlanRows(deliveryLifecycle),
      topErrors: buildTopErrorRows(deliveryLifecycle),
      restartRows: buildRestartRows(state),
      syncRows: buildSyncRows(state),
      billingRows: buildBillingRows(state),
      communityRows: buildCommunityRows(state),
      notificationRows: buildNotificationRows(state),
      links: {
        orders: '/tenant/orders',
        billing: '/tenant/billing',
        restart: '/tenant/server/restarts',
        events: '/tenant/events',
        deliveryExport: deliveryExportHref,
      },
      facts: {
        collected: formatMoney(billingSummary.collectedCents, firstNonEmpty([state && state.subscriptions && state.subscriptions[0] && state.subscriptions[0].currency], 'USD')),
        auditCount: formatNumber(auditRows.length, '0'),
        syncRunCount: formatNumber(syncRuns.length, '0'),
        syncEventCount: formatNumber(syncEvents.length, '0'),
      },
    };
  }

  function buildTenantAnalyticsV4Html(model) {
    const safe = model || createTenantAnalyticsV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions">',
      '<a class="tdv4-button tdv4-button-primary" href="' + escapeHtml(safe.links.deliveryExport) + '">Export delivery CSV</a>',
      '<a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(safe.links.orders) + '">Open orders</a>',
      '</div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" data-tenant-analytics-delivery>',
      '<div class="tdv4-section-kicker">Delivery and jobs</div>',
      '<h2 class="tdv4-section-title">Delivery and job health</h2>',
      '<p class="tdv4-section-copy">Use this section to spot queue pressure, dead-letter buildup, and the recovery steps the platform is already recommending.</p>',
      renderInsightList(safe.deliverySignals, 'No delivery signals yet', 'Delivery lifecycle signals will appear here after queue and dead-letter reporting is available.'),
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Recommended actions</div>',
      '<h2 class="tdv4-section-title">What to do next</h2>',
      '<p class="tdv4-section-copy">These actions come from the delivery lifecycle report so operators can move from reporting into a concrete next step quickly.</p>',
      renderInsightList(safe.deliveryActions, 'No recommended actions', 'The current delivery report is not asking for any queue action right now.'),
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" data-tenant-analytics-restart>',
      '<div class="tdv4-section-kicker">Restart and runtime</div>',
      '<h2 class="tdv4-section-title">Restart outcomes and sync activity</h2>',
      '<p class="tdv4-section-copy">Recent restart plans, restart executions, sync runs, and sync events stay visible here so the team can correlate bot health with restart timing.</p>',
      renderInsightList(safe.restartRows, 'No restart history yet', 'Restart plans and execution evidence will appear here after the first scheduled or immediate restart.'),
      '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(safe.links.restart) + '">Open restart control</a></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Sync evidence</div>',
      '<h2 class="tdv4-section-title">Sync runs and events</h2>',
      '<p class="tdv4-section-copy">Keep a short readout of log sync and reporting activity here instead of jumping across server bot pages to understand recency.</p>',
      renderInsightList(safe.syncRows, 'No sync activity yet', 'Sync runs and sync events will appear here once the server bot starts reporting activity.'),
      '<div class="tdv4-chip-row">' + renderBadge(`${escapeHtml(safe.facts.syncRunCount)} sync runs`, 'info') + renderBadge(`${escapeHtml(safe.facts.syncEventCount)} sync events`, 'muted') + '</div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" data-tenant-analytics-billing>',
      '<div class="tdv4-section-kicker">Revenue and package</div>',
      '<h2 class="tdv4-section-title">Billing signals</h2>',
      '<p class="tdv4-section-copy">Open invoices, failed attempts, and recent collection state stay on one page so package or payment friction is visible before it blocks operators.</p>',
      renderInsightList(safe.billingRows, 'No billing activity yet', 'Invoice and payment attempt history will appear here after the tenant starts billing through the platform.'),
      '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(safe.links.billing) + '">Open billing</a></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Top errors</div>',
      '<h2 class="tdv4-section-title">Recurring failure signatures</h2>',
      '<p class="tdv4-section-copy">This highlights the error keys repeated most often in queue and dead-letter flows so the operator can focus on the real bottleneck.</p>',
      renderInsightList(safe.topErrors, 'No recurring error signatures', 'The lifecycle report has not detected a repeated queue or dead-letter signature yet.'),
      '<div class="tdv4-chip-row">' + renderBadge(`Collected ${safe.facts.collected}`, 'success') + renderBadge(`${escapeHtml(safe.facts.auditCount)} audit rows`, 'info') + '</div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" data-tenant-analytics-community>',
      '<div class="tdv4-section-kicker">Community activity</div>',
      '<h2 class="tdv4-section-title">Events, raids, and recent combat</h2>',
      '<p class="tdv4-section-copy">Pull community momentum into the same workspace by keeping kill feed, event activity, and raid milestones visible alongside the operational metrics.</p>',
      renderInsightList(safe.communityRows, 'No community activity yet', 'Kill feed, events, and raids will appear here once the community systems start reporting data.'),
      '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-secondary" href="' + escapeHtml(safe.links.events) + '">Open events</a></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Notifications and audit</div>',
      '<h2 class="tdv4-section-title">Follow-up queue</h2>',
      '<p class="tdv4-section-copy">Keep the latest notifications and audit evidence close to the analytics view so the operator can validate what changed without leaving the page.</p>',
      renderInsightList(safe.notificationRows, 'No notifications or audit rows yet', 'Notifications and audit evidence will appear here after the first alert or operator action is recorded.'),
      '</section>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantAnalyticsV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantAnalyticsV4 requires a root element');
    const model = source && source.header && Array.isArray(source.summaryStrip)
      ? source
      : createTenantAnalyticsV4Model(source);
    rootElement.innerHTML = buildTenantAnalyticsV4Html(model);
    return model;
  }

  return {
    buildTenantAnalyticsV4Html: buildTenantAnalyticsV4Html,
    createTenantAnalyticsV4Model: createTenantAnalyticsV4Model,
    renderTenantAnalyticsV4: renderTenantAnalyticsV4,
  };
});
