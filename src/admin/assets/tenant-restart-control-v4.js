(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantRestartControlV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Server status', href: '#server-status' },
        { label: 'Restart control', href: '#restart-control', current: true },
      ],
    },
    {
      label: 'Runtime',
      items: [
        { label: 'Delivery Agents', href: '#delivery-agents' },
        { label: 'Server Bots', href: '#server-bots' },
        { label: 'Server config', href: '#server-config' },
        { label: 'Audit', href: '#audit' },
      ],
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

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return new Intl.NumberFormat('th-TH').format(numeric);
  }

  function formatDateTime(value) {
    if (!value) return 'No data yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No data yet';
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function firstNonEmpty(values, fallback = '') {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function listCount(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function parseOptionalDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function deriveRestartHistory(state) {
    if (Array.isArray(state?.restartHistory) && state.restartHistory.length > 0) {
      return state.restartHistory;
    }
    const executions = Array.isArray(state?.restartExecutions) ? state.restartExecutions : [];
    const plans = Array.isArray(state?.restartPlans) ? state.restartPlans : [];
    const planMap = new Map(
      plans
        .filter((entry) => entry && entry.id)
        .map((entry) => [String(entry.id), entry]),
    );
    return executions.map((execution) => {
      const plan = planMap.get(String(execution?.planId || '').trim()) || null;
      return {
        at: execution?.completedAt || execution?.startedAt || plan?.scheduledFor || null,
        mode: execution?.action || plan?.restartMode || 'restart',
        result: execution?.resultStatus || plan?.status || 'unknown',
        actor: plan?.requestedBy || execution?.runtimeKey || '-',
      };
    });
  }

  function deriveRestartMonitoring(state) {
    const restartPlans = Array.isArray(state?.restartPlans) ? state.restartPlans.filter(Boolean) : [];
    const restartAnnouncements = Array.isArray(state?.restartAnnouncements) ? state.restartAnnouncements.filter(Boolean) : [];
    const blockedPlans = restartPlans.filter((plan) => String(plan?.status || '').trim().toLowerCase() === 'blocked');
    const pendingVerificationPlans = restartPlans.filter((plan) => {
      const healthStatus = String(plan?.healthStatus || '').trim().toLowerCase();
      const status = String(plan?.status || '').trim().toLowerCase();
      return healthStatus === 'pending_verification' || ((status === 'completed' || status === 'executed') && !plan?.healthVerifiedAt);
    });
    const nextScheduledPlan = restartPlans
      .filter((plan) => ['scheduled', 'running'].includes(String(plan?.status || '').trim().toLowerCase()) && parseOptionalDate(plan?.scheduledFor))
      .sort((left, right) => parseOptionalDate(left?.scheduledFor) - parseOptionalDate(right?.scheduledFor))[0] || null;
    const nextAnnouncement = restartAnnouncements
      .filter((entry) => String(entry?.status || '').trim().toLowerCase() === 'pending' && parseOptionalDate(entry?.scheduledFor))
      .sort((left, right) => parseOptionalDate(left?.scheduledFor) - parseOptionalDate(right?.scheduledFor))[0] || null;

    return {
      blockedPlans,
      pendingVerificationPlans,
      nextScheduledPlan,
      nextAnnouncement,
      blockedCount: blockedPlans.length,
      pendingVerificationCount: pendingVerificationPlans.length,
    };
  }

  function statusTone(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['ready', 'ok', 'healthy', 'online', 'active'].includes(normalized)) return 'success';
    if (['warning', 'queued', 'pending', 'maintenance', 'scheduled', 'stale'].includes(normalized)) return 'warning';
    if (['offline', 'failed', 'degraded', 'error', 'blocked', 'revoked'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function buildAnnouncementPlan(delaySeconds) {
    const checkpoints = [300, 60, 30, 10].filter((seconds) => seconds <= delaySeconds);
    return checkpoints.map((seconds) => ({
      delaySeconds: seconds,
      message: `Server will restart in ${seconds} seconds.`,
    }));
  }

  function createModeCard(definition) {
    return {
      title: definition.title,
      detail: definition.detail,
      guard: definition.guard,
      tone: definition.tone,
      restartMode: definition.restartMode,
      delaySeconds: definition.delaySeconds,
      buttonLabel: definition.buttonLabel,
    };
  }

  function createTenantRestartControlV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantName = firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);
    const runtimeStatus = firstNonEmpty([
      state?.deliveryRuntime?.delivery?.status,
      state?.deliveryRuntime?.status,
      'ready',
    ]);
    const maintenanceState = firstNonEmpty([state?.maintenance?.status, state?.restartState?.status, 'idle']);
    const blockers = [];
    const monitoring = deriveRestartMonitoring(state);
    if (!['ready', 'active', 'online', 'healthy'].includes(String(runtimeStatus || '').trim().toLowerCase())) {
      blockers.push('Delivery Agent is not fully ready for in-game announcements.');
    }
    if (listCount(state?.queueItems) > 0) {
      blockers.push('There is still pending work in the delivery queue.');
    }
    if (listCount(state?.deadLetters) > 0) {
      blockers.push('Failed delivery jobs are still present. Review them before restarting.');
    }
    if (state?.serverBotReady === false) {
      blockers.push('Server Bot is not ready to execute restart workflows.');
    }
    if (monitoring.blockedCount > 0) {
      blockers.push('A safe restart is currently blocked. Clear blockers and schedule it again.');
    }
    if (monitoring.pendingVerificationCount > 0) {
      blockers.push('The previous restart still needs post-restart health verification.');
    }

    const history = deriveRestartHistory(state);
    const modeCards = [
      createModeCard({
        title: 'Restart now',
        detail: 'Use this only for urgent incidents when the team already expects immediate downtime.',
        guard: 'Best for emergency action only.',
        tone: 'danger',
        restartMode: 'immediate',
        delaySeconds: 0,
        buttonLabel: 'Restart now',
      }),
      createModeCard({
        title: 'Restart in 1 minute',
        detail: 'Gives a short heads-up when downtime must happen quickly.',
        guard: 'Use when Delivery Agent can still send announcements.',
        tone: 'warning',
        restartMode: 'delayed',
        delaySeconds: 60,
        buttonLabel: 'Restart in 1 minute',
      }),
      createModeCard({
        title: 'Restart in 5 minutes',
        detail: 'Best default for normal maintenance windows and planned downtime.',
        guard: 'Sends the full 5m / 1m / 30s / 10s countdown plan.',
        tone: 'success',
        restartMode: 'delayed',
        delaySeconds: 300,
        buttonLabel: 'Restart in 5 minutes',
      }),
      createModeCard({
        title: 'Safe restart',
        detail: 'Recommended default. It keeps the restart workflow focused on operational checks first.',
        guard: 'Use this for day-to-day restart operations.',
        tone: 'info',
        restartMode: 'safe_restart',
        delaySeconds: 0,
        buttonLabel: 'Safe restart',
      }),
      createModeCard({
        title: 'Restart in 15 minutes',
        detail: 'A longer delayed restart for bigger maintenance windows without leaving this page.',
        guard: 'This is still delay-based, not calendar scheduling.',
        tone: 'muted',
        restartMode: 'delayed',
        delaySeconds: 900,
        buttonLabel: 'Restart in 15 minutes',
      }),
    ];
    const recommendedMode = modeCards.find((item) => item.restartMode === 'safe_restart') || modeCards[0] || null;
    const secondaryModes = modeCards.filter((item) => item !== recommendedMode);

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: tenantName,
        environmentLabel: 'Tenant workspace',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : NAV_GROUPS,
      },
      header: {
        title: 'Restart control',
        subtitle: 'Run daily restart operations from one place without mixing them into passive dashboard widgets.',
        statusChips: [
          { label: `server ${firstNonEmpty([state?.serverStatus, 'ready'])}`, tone: statusTone(firstNonEmpty([state?.serverStatus, 'ready'])) },
          { label: `announcements ${runtimeStatus}`, tone: statusTone(runtimeStatus) },
          { label: `queue ${formatNumber(listCount(state?.queueItems), '0')}`, tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
          { label: `maintenance ${maintenanceState}`, tone: statusTone(maintenanceState) },
          { label: `blocked ${formatNumber(monitoring.blockedCount, '0')}`, tone: monitoring.blockedCount > 0 ? 'danger' : 'success' },
          { label: `verify ${formatNumber(monitoring.pendingVerificationCount, '0')}`, tone: monitoring.pendingVerificationCount > 0 ? 'warning' : 'success' },
        ],
        primaryAction: recommendedMode
          ? {
              label: `${recommendedMode.buttonLabel} (Recommended)`,
              restartMode: recommendedMode.restartMode,
              delaySeconds: recommendedMode.delaySeconds,
            }
          : { label: 'Safe restart (Recommended)', restartMode: 'safe_restart', delaySeconds: 0 },
      },
      summaryStrip: [
        {
          label: 'Server readiness',
          value: firstNonEmpty([state?.serverStatus, 'ready']),
          detail: 'Current operational state of the server.',
          tone: statusTone(firstNonEmpty([state?.serverStatus, 'ready'])),
        },
        {
          label: 'Announcement path',
          value: runtimeStatus,
          detail: 'Used to decide if delayed restart announcements can run.',
          tone: statusTone(runtimeStatus),
        },
        {
          label: 'Pending work',
          value: formatNumber(listCount(state?.queueItems), '0'),
          detail: 'Queue items that may be affected by a restart.',
          tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Next scheduled restart',
          value: monitoring.nextScheduledPlan ? formatDateTime(monitoring.nextScheduledPlan.scheduledFor) : 'No restart queued',
          detail: monitoring.nextScheduledPlan
            ? firstNonEmpty([
                monitoring.nextScheduledPlan.restartMode,
                monitoring.nextScheduledPlan.status,
                'Scheduled',
              ])
            : 'Nothing is queued to run right now.',
          tone: monitoring.nextScheduledPlan ? statusTone(monitoring.nextScheduledPlan.status || 'scheduled') : 'muted',
        },
        {
          label: 'Health verification',
          value: monitoring.pendingVerificationCount > 0 ? `${formatNumber(monitoring.pendingVerificationCount, '0')} pending` : 'Up to date',
          detail: monitoring.pendingVerificationCount > 0
            ? 'Review the most recent restart checks before the next maintenance window.'
            : 'No restart plans are waiting on verification.',
          tone: monitoring.pendingVerificationCount > 0 ? 'warning' : 'success',
        },
        {
          label: 'Last restart',
          value: history[0] ? formatDateTime(history[0].at) : 'No history yet',
          detail: history[0] ? firstNonEmpty([history[0].mode, history[0].result, '-']) : 'No restart history visible yet',
          tone: history[0] ? 'info' : 'muted',
        },
      ],
      blockers,
      monitoring: {
        nextScheduledRestart: monitoring.nextScheduledPlan
          ? {
              at: formatDateTime(monitoring.nextScheduledPlan.scheduledFor),
              mode: firstNonEmpty([monitoring.nextScheduledPlan.restartMode, monitoring.nextScheduledPlan.status, 'scheduled']),
              tone: statusTone(monitoring.nextScheduledPlan.status || 'scheduled'),
            }
          : null,
        nextAnnouncement: monitoring.nextAnnouncement
          ? {
              at: formatDateTime(monitoring.nextAnnouncement.scheduledFor),
              checkpointLabel: `${formatNumber(monitoring.nextAnnouncement.checkpointSeconds, '0')} seconds`,
              tone: statusTone(monitoring.nextAnnouncement.status || 'pending'),
            }
          : null,
        blockedCount: monitoring.blockedCount,
        pendingVerificationCount: monitoring.pendingVerificationCount,
      },
      announcementPlan: buildAnnouncementPlan(300),
      recommendedMode,
      secondaryModes,
      secondaryActions: secondaryModes.map((item) => ({
        label: item.buttonLabel,
        restartMode: item.restartMode,
        delaySeconds: item.delaySeconds,
      })),
      modeCards,
      history: history.slice(0, 4).map((item) => ({
        at: formatDateTime(item?.at),
        mode: firstNonEmpty([item?.mode, 'unknown']),
        result: firstNonEmpty([item?.result, item?.status, 'unknown']),
        actor: firstNonEmpty([item?.actor, item?.requestedBy, '-']),
      })),
      railCards: [
        {
          title: 'Checklist before restart',
          body: 'Review queue, confirm announcements, verify Server Bot, then restart.',
          meta: 'Use this page to make restart decisions, not just to look at status.',
          tone: 'info',
        },
        {
          title: 'Countdown plan',
          body: '5m · 1m · 30s · 10s',
          meta: 'The delayed restart buttons use this announcement order when the runtime can announce in-game.',
          tone: 'warning',
        },
      ],
    };
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return [
      '<section class="tdv4-nav-group">',
      `<div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div>`,
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(group.items)
        ? group.items.map((item) => {
            const currentClass = item.current ? ' tdv4-nav-link-current' : '';
            return `<a class="tdv4-nav-link${currentClass}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`;
          })
        : []),
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

  function renderRestartButton(action, variant) {
    return `<button class="tdv4-button tdv4-button-${escapeHtml(variant || 'secondary')}" type="button" data-restart-action-button data-restart-mode="${escapeHtml(action.restartMode || 'safe_restart')}" data-restart-delay-seconds="${escapeHtml(action.delaySeconds || 0)}">${escapeHtml(action.label)}</button>`;
  }

  function renderModeCard(item) {
    return [
      `<article class="tdv4-panel tdv4-mode-card tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      '<div class="tdv4-section-kicker">Secondary action</div>',
      `<h3 class="tdv4-mode-title">${escapeHtml(item.title)}</h3>`,
      `<p class="tdv4-kpi-detail">${escapeHtml(item.detail)}</p>`,
      `<div class="tdv4-rail-detail">${escapeHtml(item.guard)}</div>`,
      `<div class="tdv4-action-list">${renderRestartButton({
        label: item.buttonLabel || item.title,
        restartMode: item.restartMode,
        delaySeconds: item.delaySeconds,
      }, 'secondary')}</div>`,
      '</article>',
    ].join('');
  }

  function renderRailCard(item) {
    return [
      `<article class="tdv4-panel tdv4-rail-card tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-rail-title">${escapeHtml(item.title)}</div>`,
      `<strong class="tdv4-rail-body">${escapeHtml(item.body)}</strong>`,
      `<div class="tdv4-rail-detail">${escapeHtml(item.meta)}</div>`,
      '</article>',
    ].join('');
  }

  function buildTenantRestartControlV4Html(model) {
    const safeModel = model || createTenantRestartControlV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar">',
      '<div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safeModel.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '</div>',
      '</div>',
      '<div class="tdv4-topbar-actions">',
      renderBadge(safeModel.shell.environmentLabel, 'info'),
      renderBadge('Restart control', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-restart-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">Use this workspace to run safe restarts, delayed restarts, and review restart history without leaving daily operations.</div>',
      ...(Array.isArray(safeModel.shell.navGroups) ? safeModel.shell.navGroups.map(renderNavGroup) : []),
      '</aside>',
      '<main class="tdv4-main">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safeModel.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safeModel.header.subtitle)}</p>`,
      '<div class="tdv4-chip-row">',
      ...(Array.isArray(safeModel.header.statusChips) ? safeModel.header.statusChips.map((chip) => renderBadge(chip.label, chip.tone)) : []),
      '</div>',
      '</div>',
      `<div class="tdv4-pagehead-actions">${renderRestartButton(safeModel.header.primaryAction, 'primary')}</div>`,
      '</section>',
      '<section class="tdv4-kpi-strip tdv4-restart-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-panel tdv4-restart-primary">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Safe restart is the recommended daily operation</h2>',
      '<p class="tdv4-section-copy">Use safe restart first unless you are handling an urgent incident that needs faster downtime.</p>',
      '<div class="tdv4-restart-primary-grid">',
      (safeModel.recommendedMode ? renderModeCard(safeModel.recommendedMode) : ''),
      '<div class="tdv4-panel tdv4-restart-primary-actions tdv4-tone-info">',
      '<div class="tdv4-section-kicker">Run now</div>',
      '<h3 class="tdv4-mode-title">Start the guided restart path</h3>',
      '<p class="tdv4-kpi-detail">This action uses the tenant-safe restart route already wired into the control plane.</p>',
      `<div class="tdv4-action-list">${renderRestartButton(safeModel.header.primaryAction, 'primary')}<a class="tdv4-button tdv4-button-secondary" href="#server-status">Open server status</a></div>`,
      '</div>',
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Common restart options</h2>',
      '<p class="tdv4-section-copy">Pick a delayed restart when you want time for in-game announcements before downtime begins.</p>',
      '<div class="tdv4-action-list">',
      ...(Array.isArray(safeModel.secondaryActions)
        ? safeModel.secondaryActions.map((action) => renderRestartButton(action, 'secondary'))
        : []),
      '</div>',
      '</section>',
      '<details class="tdv4-panel tdv4-more-options">',
      '<summary class="tdv4-more-options-summary">More options</summary>',
      '<div class="tdv4-section-kicker">Restart modes</div>',
      '<h2 class="tdv4-section-title">Mode details</h2>',
      '<div class="tdv4-mode-grid">',
      ...(Array.isArray(safeModel.secondaryModes) ? safeModel.secondaryModes.map(renderModeCard) : []),
      '</div>',
      '</details>',
      '<section class="tdv4-dual-grid tdv4-restart-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Status</div>',
      '<h2 class="tdv4-section-title">Announcement checklist</h2>',
      '<div class="tdv4-list">',
      ...(Array.isArray(safeModel.announcementPlan)
        ? safeModel.announcementPlan.map((item) => `<div class="tdv4-list-item"><strong>${escapeHtml(item.delaySeconds)} seconds</strong><p>${escapeHtml(item.message)}</p></div>`)
        : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Status</div>',
      '<h2 class="tdv4-section-title">Blockers</h2>',
      (Array.isArray(safeModel.blockers) && safeModel.blockers.length
        ? `<div class="tdv4-list">${safeModel.blockers.map((item) => `<div class="tdv4-list-item"><strong>Warning</strong><p>${escapeHtml(item)}</p></div>`).join('')}</div>`
        : '<div class="tdv4-empty-state">No major blockers are visible right now.</div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid tdv4-restart-monitoring-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Scheduled / verification</div>',
      '<h2 class="tdv4-section-title">Upcoming restart operations</h2>',
      '<div class="tdv4-list">',
      `<div class="tdv4-list-item"><strong>Next scheduled restart</strong><p>${escapeHtml(safeModel.monitoring?.nextScheduledRestart ? `${safeModel.monitoring.nextScheduledRestart.at} · ${safeModel.monitoring.nextScheduledRestart.mode}` : 'No restart is queued right now.')}</p></div>`,
      `<div class="tdv4-list-item"><strong>Next announcement checkpoint</strong><p>${escapeHtml(safeModel.monitoring?.nextAnnouncement ? `${safeModel.monitoring.nextAnnouncement.at} · ${safeModel.monitoring.nextAnnouncement.checkpointLabel}` : 'No pending announcement is waiting to be sent.')}</p></div>`,
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Scheduled / verification</div>',
      '<h2 class="tdv4-section-title">Health verification</h2>',
      '<div class="tdv4-list">',
      `<div class="tdv4-list-item"><strong>Blocked plans</strong><p>${escapeHtml(formatNumber(safeModel.monitoring?.blockedCount, '0'))} safe restart plans currently blocked.</p></div>`,
      `<div class="tdv4-list-item"><strong>Verification pending</strong><p>${escapeHtml(formatNumber(safeModel.monitoring?.pendingVerificationCount, '0'))} restart plans still need post-restart checks.</p></div>`,
      '</div>',
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Recent restart history</h2>',
      (Array.isArray(safeModel.history) && safeModel.history.length
        ? `<div class="tdv4-history-grid">${safeModel.history.map((item) => `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">${escapeHtml(item.mode)}</div><div class="tdv4-mini-stat-value">${escapeHtml(item.result)}</div><div class="tdv4-kpi-detail">${escapeHtml(item.at)} · ${escapeHtml(item.actor)}</div></article>`).join('')}</div>`
        : '<div class="tdv4-empty-state">No restart history is visible yet.</div>'),
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">Restart decisions stay action-first here: current status, one primary action, secondary restart options, and history.</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantRestartControlV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantRestartControlV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.summaryStrip)
      ? source
      : createTenantRestartControlV4Model(source);
    rootElement.innerHTML = buildTenantRestartControlV4Html(model);
    return model;
  }

  return {
    buildTenantRestartControlV4Html,
    createTenantRestartControlV4Model,
    renderTenantRestartControlV4,
  };
});
