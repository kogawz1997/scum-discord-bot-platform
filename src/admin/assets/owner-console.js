(function () {
  'use strict';

  const {
    api,
    connectLiveStream,
    escapeHtml,
    formatDateTime,
    formatNumber,
    localizeAdminNotification,
    makePill,
    renderList,
    renderStats,
    renderTable,
    setBusy,
    showToast,
    wireCommandPalette,
    wireSidebarShell,
    wireWorkspaceSwitcher,
  } = window.ConsoleSurface;

  const {
    getConfigApplyOperationalPhase,
    getRestoreOperationalPhase,
  } = window.AdminOperationalStateModel || {};

  const t = (key, fallback, params) => window.AdminUiI18n?.t?.(key, fallback, params) ?? fallback ?? key;

  // UI-only state for the owner surface.
  // If you want to reorder or simplify pages later, start here and then trace
  // the matching render* function further down in this file.
  const state = {
    me: null,
    overview: null,
    observability: null,
    deliveryLifecycle: null,
    reconcile: null,
    opsState: null,
    tenants: [],
    subscriptions: [],
    licenses: [],
    apiKeys: [],
    webhooks: [],
    agents: [],
    marketplaceOffers: [],
    tenantQuotaSnapshots: [],
    notifications: [],
    incidentInbox: [],
    securityEvents: [],
    runtimeSupervisor: null,
    dashboardCards: null,
    requestLogs: { metrics: {}, items: [] },
    roleMatrix: { summary: {}, permissions: [] },
    controlPanelSettings: null,
    restoreState: null,
    backupFiles: [],
    restorePreview: null,
    sessions: [],
    users: [],
    audit: null,
    rotationReport: null,
    auditFilters: {
      view: 'wallet',
      userId: '',
      query: '',
      windowMs: '604800000',
    },
    supportCase: null,
    incidentFilters: {
      severity: '',
      acknowledged: 'false',
      kind: '',
    },
    assetResult: null,
    liveEvents: [],
    automationReport: null,
    controlApplyResult: null,
  };

  let liveConnection = null;
  let refreshTimer = null;
  let intervalHandle = null;
  let workspaceController = null;
  let sidebarController = null;

  // Small metric cards shown on the observability page.
  // Keep this list short so the owner surface stays readable instead of turning
  // back into the old everything-at-once dashboard.

  function deliveryLifecycleSignalLabel(key) {
    const labels = {
      healthy: t('deliveryLifecycle.signal.healthy', 'Stable'),
      overdue: t('deliveryLifecycle.signal.overdue', 'Overdue'),
      retryHeavy: t('deliveryLifecycle.signal.retryHeavy', 'Retry Heavy'),
      poisonCandidate: t('deliveryLifecycle.signal.poisonCandidate', 'Poison Candidate'),
      retryableDeadLetter: t('deliveryLifecycle.signal.retryableDeadLetter', 'Retryable Dead Letter'),
      nonRetryableDeadLetter: t('deliveryLifecycle.signal.nonRetryableDeadLetter', 'Non-Retryable Dead Letter'),
      queued: t('deliveryLifecycle.signal.queued', 'Queued'),
      deadLetter: t('deliveryLifecycle.signal.deadLetter', 'Dead Letter'),
    };
    return labels[key] || key || t('deliveryLifecycle.signal.queued', 'Queued');
  }

  function deliveryLifecycleSignalTone(key, fallbackTone) {
    if (key === 'healthy') return 'success';
    if (key === 'poisonCandidate' || key === 'nonRetryableDeadLetter') return 'danger';
    if (key === 'overdue' || key === 'retryHeavy' || key === 'retryableDeadLetter' || key === 'deadLetter') return 'warning';
    return fallbackTone || 'info';
  }

  function deliveryLifecycleActionLabel(key) {
    const labels = {
      'review-runtime-before-retry': t('deliveryLifecycle.action.reviewRuntimeBeforeRetry', 'Review runtime before retry'),
      'retry-queue-batch': t('deliveryLifecycle.action.retryQueueBatch', 'Retry queue batch'),
      'retry-dead-letter-batch': t('deliveryLifecycle.action.retryDeadLetterBatch', 'Retry dead-letter batch'),
      'hold-poison-candidates': t('deliveryLifecycle.action.holdPoisonCandidates', 'Hold poison candidates'),
      'inspect-top-error': t('deliveryLifecycle.action.inspectTopError', 'Inspect top error'),
      'lifecycle-stable': t('deliveryLifecycle.action.lifecycleStable', 'Lifecycle looks stable'),
    };
    return labels[key] || key || t('deliveryLifecycle.action.lifecycleStable', 'Lifecycle looks stable');
  }

  function deliveryLifecycleActionDetail(action) {
    const key = String(action?.key || '').trim();
    if (key === 'review-runtime-before-retry') {
      return t(
        'deliveryLifecycle.action.ownerReviewRuntimeDetail',
        'Review runtime health and automation state before asking a tenant operator to replay queued work.',
      );
    }
    if (key === 'retry-queue-batch') {
      return t(
        'deliveryLifecycle.action.ownerRetryQueueBatchDetail',
        'Retryable queue jobs are visible. Confirm runtime stability, then hand off to the tenant recovery flow if replay is still needed.',
      );
    }
    if (key === 'retry-dead-letter-batch') {
      return t(
        'deliveryLifecycle.action.ownerRetryDeadLetterBatchDetail',
        'Retryable dead-letter entries are present. Export the lifecycle snapshot and verify tenant context before replay.',
      );
    }
    if (key === 'hold-poison-candidates') {
      return t(
        'deliveryLifecycle.action.ownerHoldPoisonCandidatesDetail',
        'Potential poison jobs are present. Keep them in review, export evidence, and open a tenant support case instead of forcing replay.',
      );
    }
    if (key === 'inspect-top-error') {
      return t(
        'deliveryLifecycle.action.ownerInspectTopErrorDetail',
        'Use observability and support tooling to understand the most repeated error signature before any manual intervention.',
      );
    }
    return t(
      'deliveryLifecycle.action.ownerLifecycleStableDetail',
      'No immediate owner intervention is recommended from the current lifecycle snapshot.',
    );
  }

  // These phase presenters keep owner labels/details in one place so the HTML
  // can stay simple and we do not scatter lifecycle wording across renderers.
  function getRestorePhasePresentation(restoreState, restorePreview) {
    const phase = typeof getRestoreOperationalPhase === 'function'
      ? getRestoreOperationalPhase(restoreState, restorePreview)
      : { key: 'idle', tone: 'neutral' };
    const labels = {
      idle: {
        label: t('owner.recovery.phase.idle', 'Idle'),
        detail: t('owner.recovery.phase.idleDetail', 'No restore preview or restore execution is active right now.'),
      },
      previewed: {
        label: t('owner.recovery.phase.previewed', 'Previewed'),
        detail: t('owner.recovery.phase.previewedDetail', 'A dry-run preview exists and is ready for operator review before any restore execution.'),
      },
      executing: {
        label: t('owner.recovery.phase.executing', 'Executing'),
        detail: t('owner.recovery.phase.executingDetail', 'A restore workflow is actively running and should be watched until verification finishes.'),
      },
      completed: {
        label: t('owner.recovery.phase.completed', 'Completed'),
        detail: t('owner.recovery.phase.completedDetail', 'The latest restore run completed successfully and verification can be reviewed below.'),
      },
      'rolled-back': {
        label: t('owner.recovery.phase.rolledBack', 'Rolled Back'),
        detail: t('owner.recovery.phase.rolledBackDetail', 'The latest restore failed and rollback completed, so operators should review the failure before retrying.'),
      },
      failed: {
        label: t('owner.recovery.phase.failed', 'Failed'),
        detail: t('owner.recovery.phase.failedDetail', 'The latest restore failed and needs operator attention before recovery continues.'),
      },
    };
    const selected = labels[phase.key] || labels.idle;
    return { ...phase, ...selected };
  }

  function getConfigApplyPhasePresentation(applyState) {
    const phase = typeof getConfigApplyOperationalPhase === 'function'
      ? getConfigApplyOperationalPhase(applyState)
      : { key: 'idle', tone: 'neutral' };
    const labels = {
      idle: {
        label: t('owner.control.apply.phase.idle', 'Idle'),
        detail: t('owner.control.apply.phase.idleDetail', 'No guarded config apply has been recorded in this browser session yet.'),
      },
      validated: {
        label: t('owner.control.apply.phase.validated', 'Validated'),
        detail: t('owner.control.apply.phase.validatedDetail', 'The latest submit validated successfully but did not change any editable environment keys.'),
      },
      applied: {
        label: t('owner.control.apply.phase.applied', 'Applied'),
        detail: t('owner.control.apply.phase.appliedDetail', 'The latest guarded config patch applied successfully and did not require a runtime restart.'),
      },
      'requires-restart': {
        label: t('owner.control.apply.phase.requiresRestart', 'Requires Restart'),
        detail: t('owner.control.apply.phase.requiresRestartDetail', 'The latest config patch applied successfully, but one or more runtime services still need restart.'),
      },
      'applied-restarted': {
        label: t('owner.control.apply.phase.appliedRestarted', 'Applied + Restarted'),
        detail: t('owner.control.apply.phase.appliedRestartedDetail', 'The latest config patch applied successfully and the selected runtime services were restarted.'),
      },
      'rolled-back': {
        label: t('owner.control.apply.phase.rolledBack', 'Rolled Back'),
        detail: t('owner.control.apply.phase.rolledBackDetail', 'The latest config apply was rolled back in the current operator session.'),
      },
    };
    const selected = labels[phase.key] || labels.idle;
    return { ...phase, ...selected };
  }
  const OBSERVABILITY_SERIES_META = [
    { key: 'deliveryQueueLength', titleKey: 'owner.series.deliveryQueue', fallback: 'Delivery Queue', mode: 'integer' },
    { key: 'deliveryFailRate', titleKey: 'owner.series.deliveryFailRate', fallback: 'Delivery Fail Rate', mode: 'percent' },
    { key: 'deliveryDeadLetters', titleKey: 'owner.series.deadLetters', fallback: 'Dead Letters', mode: 'integer' },
    { key: 'webhookErrorRate', titleKey: 'owner.series.webhookErrors', fallback: 'Webhook Errors', mode: 'percent' },
    { key: 'loginFailures', titleKey: 'owner.series.loginFailures', fallback: 'Login Failures', mode: 'integer' },
    { key: 'adminRequestErrors', titleKey: 'owner.series.requestErrors', fallback: 'Request Errors', mode: 'integer' },
    { key: 'runtimeDegraded', titleKey: 'owner.series.degradedRuntime', fallback: 'Degraded Runtime', mode: 'integer' },
  ];

  function normalizeRuntimeRows(snapshot) {
    const services = snapshot?.services;
    if (Array.isArray(services)) return services;
    if (services && typeof services === 'object') {
      return Object.entries(services).map(([name, row]) => ({
        name,
        ...(row && typeof row === 'object' ? row : {}),
      }));
    }
    return [];
  }

  async function safeApi(path, fallback) {
    try {
      return await api(path);
    } catch {
      return fallback;
    }
  }

  function openTenantSupportCaseExport(tenantId, format = 'json') {
    const scopedTenantId = String(tenantId || '').trim();
    if (!scopedTenantId) return;
    const query = new URLSearchParams({
      tenantId: scopedTenantId,
      format: String(format || 'json').trim() || 'json',
    });
    window.open(
      `/admin/api/platform/tenant-support-case/export?${query.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );
    showToast(
      t('owner.toast.tenantSupportCaseExportStarted', 'Tenant support case export opened.'),
      'success',
    );
  }

  function openTenantDiagnosticsExport(tenantId, format = 'json') {
    const scopedTenantId = String(tenantId || '').trim();
    if (!scopedTenantId) return false;
    const query = new URLSearchParams({
      tenantId: scopedTenantId,
      format: String(format || 'json').trim() || 'json',
    });
    window.open(
      `/admin/api/platform/tenant-diagnostics/export?${query.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );
    showToast(
      t('owner.toast.tenantDiagnosticsExportStarted', 'Tenant diagnostics export opened.'),
      'success',
    );
    return true;
  }

  function openRotationExport(format = 'json') {
    const normalizedFormat = String(format || 'json').trim().toLowerCase() || 'json';
    window.open(
      `/admin/api/security/rotation-check/export?format=${encodeURIComponent(normalizedFormat)}`,
      '_blank',
      'noopener,noreferrer',
    );
    showToast(
      t('owner.toast.rotationExportStarted', 'Secret rotation export opened.'),
      'success',
    );
  }

  function openDeliveryLifecycleExport(format = 'json') {
    const normalizedFormat = String(format || 'json').trim().toLowerCase() || 'json';
    window.open(
      `/admin/api/delivery/lifecycle/export?format=${encodeURIComponent(normalizedFormat)}`,
      '_blank',
      'noopener,noreferrer',
    );
    showToast(
      t('owner.toast.deliveryLifecycleExportStarted', 'Delivery lifecycle export opened.'),
      'info',
    );
  }

  function listFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function getRotationSignalCounts() {
    return {
      warnings: Array.isArray(state.rotationReport?.warnings) ? state.rotationReport.warnings.length : 0,
      errors: Array.isArray(state.rotationReport?.errors) ? state.rotationReport.errors.length : 0,
    };
  }

  function openOwnerTarget(sectionId, options = {}) {
    if (workspaceController) {
      workspaceController.openSection(sectionId, options);
      return;
    }
    const targetId = options.targetId || sectionId;
    document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: options.block || 'start',
    });
  }

  function ownerNavLabel(sectionId) {
    return String(document.querySelector(`#ownerNavList a[href="#${sectionId}"]`)?.textContent || '').trim() || sectionId;
  }

  function parseOptionalJson(raw, label) {
    const text = String(raw || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  function maskTail(value, keep = 8) {
    const text = String(value || '').trim();
    if (!text) return '-';
    if (text.length <= keep) return text;
    return `...${text.slice(-keep)}`;
  }

  function makeClientId(prefix) {
    const safePrefix = String(prefix || 'asset').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'asset';
    return `${safePrefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function getControlEnvEntry(scope, key) {
    return state.controlPanelSettings?.env?.[scope]?.[key] || null;
  }

  function getControlEnvValue(scope, key, fallback = '') {
    const entry = getControlEnvEntry(scope, key);
    if (!entry) return fallback;
    if (entry.type === 'boolean') {
      return entry.value === true ? 'true' : 'false';
    }
    if (entry.value == null) return fallback;
    return String(entry.value);
  }

  function formatMetricValue(value, mode = 'integer') {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    if (mode === 'percent') return `${(number * 100).toFixed(2)}%`;
    return formatNumber(number, '0');
  }

  function getAutomationState() {
    const opsAutomation = state.opsState?.automation;
    if (opsAutomation && typeof opsAutomation === 'object') return opsAutomation;
    const overviewAutomation = state.overview?.automationState;
    if (overviewAutomation && typeof overviewAutomation === 'object') return overviewAutomation;
    return {};
  }

  function summarizeQuotaEntry(entry) {
    if (!entry || typeof entry !== 'object') return '-';
    if (entry.unlimited) return `${formatNumber(entry.used, '0')} / unlimited`;
    return `${formatNumber(entry.used, '0')} / ${formatNumber(entry.limit, '0')}`;
  }

  function quotaEntryTone(entry) {
    if (!entry || typeof entry !== 'object') return 'neutral';
    if (entry.exceeded === true) return 'danger';
    if (entry.unlimited) return 'info';
    const limit = Number(entry.limit || 0);
    const used = Number(entry.used || 0);
    if (!Number.isFinite(limit) || limit <= 0) return 'neutral';
    if (used >= limit) return 'danger';
    if (used / limit >= 0.75) return 'warning';
    return 'success';
  }

  function summarizePlanQuotas(plan) {
    const quotas = plan?.quotas && typeof plan.quotas === 'object' ? plan.quotas : {};
    const labels = Object.entries(quotas).map(([key, value]) => {
      const title = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase());
      return `${title}: ${value == null ? 'unlimited' : value}`;
    });
    return labels.length > 0 ? labels.join(' | ') : 'No explicit plan quotas';
  }

  function supportToneToPill(tone) {
    if (tone === 'danger') return 'danger';
    if (tone === 'warning') return 'warning';
    if (tone === 'success') return 'success';
    return 'info';
  }

  function supportPhaseLabel(key) {
    const normalized = String(key || '').trim().toLowerCase();
    if (normalized === 'blocked') return t('owner.support.phase.blocked', 'Blocked');
    if (normalized === 'commercial-gate') return t('owner.support.phase.commercialGate', 'Commercial Gate');
    if (normalized === 'trial') return t('owner.support.phase.trial', 'Trial');
    if (normalized === 'attention') return t('owner.support.phase.attention', 'Needs Attention');
    if (normalized === 'active') return t('owner.support.phase.active', 'Active');
    return t('owner.support.phase.setup', 'Setup');
  }

  function supportChecklistLabel(key) {
    const labels = {
      'tenant-record': t('owner.support.step.tenantRecord', 'Tenant Record'),
      'operational-gate': t('owner.support.step.operationalGate', 'Operational Gate'),
      subscription: t('owner.support.step.subscription', 'Subscription'),
      license: t('owner.support.step.license', 'License'),
      'api-credential': t('owner.support.step.apiCredential', 'API Credential'),
      'webhook-route': t('owner.support.step.webhookRoute', 'Webhook Route'),
      'agent-runtime': t('owner.support.step.agentRuntime', 'Agent Runtime'),
    };
    return labels[key] || key || '-';
  }

  function supportChecklistStatusLabel(status, required) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'done') return t('owner.support.status.done', 'Done');
    if (normalized === 'blocked') return t('owner.support.status.blocked', 'Blocked');
    if (normalized === 'warning') return t('owner.support.status.warning', 'Warning');
    if (normalized === 'optional') {
      return required
        ? t('owner.support.status.missing', 'Missing')
        : t('owner.support.status.optional', 'Optional');
    }
    return t('owner.support.status.missing', 'Missing');
  }

  function supportChecklistStatusTone(status, required) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'done') return 'success';
    if (normalized === 'blocked') return 'danger';
    if (normalized === 'warning') return 'warning';
    if (normalized === 'optional' && !required) return 'neutral';
    return 'warning';
  }

  function supportSignalLabel(key) {
    const labels = {
      'commercial-gate': t('owner.support.signal.commercialGate', 'Commercial Gate'),
      'dead-letters': t('owner.support.signal.deadLetters', 'Dead Letters'),
      'delivery-anomalies': t('owner.support.signal.deliveryAnomalies', 'Delivery Anomalies'),
      'runtime-degraded': t('owner.support.signal.runtimeDegraded', 'Runtime Degraded'),
      'request-errors': t('owner.support.signal.requestErrors', 'Request Errors'),
      'open-alerts': t('owner.support.signal.openAlerts', 'Open Alerts'),
      'quota-hotspots': t('owner.support.signal.quotaHotspots', 'Quota Hotspots'),
      'abuse-signals': t('owner.support.signal.abuseSignals', 'Abuse Signals'),
    };
    return labels[key] || key || '-';
  }

  function supportActionLabel(key) {
    const labels = {
      'review-commercial-gate': t('owner.support.action.reviewCommercialGate', 'Review Commercial Gate'),
      'inspect-dead-letters': t('owner.support.action.inspectDeadLetters', 'Inspect Dead Letters'),
      'reconcile-delivery': t('owner.support.action.reconcileDelivery', 'Reconcile Delivery'),
      'review-runtime': t('owner.support.action.reviewRuntime', 'Review Runtime'),
      'review-request-errors': t('owner.support.action.reviewRequestErrors', 'Review Request Errors'),
      'clear-alerts': t('owner.support.action.clearAlerts', 'Clear Open Alerts'),
      'confirm-integrations': t('owner.support.action.confirmIntegrations', 'Confirm Integrations'),
      'case-quiet': t('owner.support.action.caseQuiet', 'Case Looks Quiet'),
    };
    return labels[key] || key || '-';
  }

  function buildQuotaPressureRows() {
    return state.tenantQuotaSnapshots
      .map((snapshot) => {
        const entries = Object.entries(snapshot?.quotas || {});
        const hot = entries.filter(([, value]) => quotaEntryTone(value) !== 'success' && quotaEntryTone(value) !== 'info');
        return {
          tenantId: snapshot?.tenantId || snapshot?.tenant?.id || '',
          tenantName: snapshot?.tenant?.name || snapshot?.tenant?.slug || snapshot?.tenantId || '-',
          planName: snapshot?.plan?.name || snapshot?.subscription?.planId || '-',
          hot,
          entries,
        };
      })
      .sort((left, right) => right.hot.length - left.hot.length)
      .slice(0, 10);
  }

  function buildSparkBars(points = [], tone = 'info') {
    const values = (Array.isArray(points) ? points : [])
      .map((point) => Number(point?.value || 0))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return '<div class="empty-state">No series yet.</div>';
    }
    const max = Math.max(...values, 1);
    return `<div class="sparkline">${
      values.slice(-12).map((value) => {
        const height = Math.max(12, Math.round((value / max) * 72));
        return `<span class="spark-bar ${escapeHtml(tone)}" style="height:${height}px"></span>`;
      }).join('')
    }</div>`;
  }

  function renderSeriesCards() {
    const wrap = document.getElementById('ownerSeriesCards');
    if (!wrap) return;
    const timeSeries = state.observability?.timeSeries || {};
    wrap.innerHTML = OBSERVABILITY_SERIES_META.map((meta) => {
      const points = Array.isArray(timeSeries?.[meta.key]) ? timeSeries[meta.key] : [];
      const latest = points.length > 0 ? points[points.length - 1].value : 0;
      const tone =
        meta.key === 'deliveryFailRate' || meta.key === 'webhookErrorRate'
          ? 'warning'
          : meta.key === 'runtimeDegraded' || meta.key === 'adminRequestErrors'
            ? 'danger'
            : 'info';
      return [
        '<article class="series-card">',
        `<span class="section-kicker">${escapeHtml(meta.key)}</span>`,
        `<h4>${escapeHtml(t(meta.titleKey, meta.fallback))}</h4>`,
        `<strong class="series-value">${escapeHtml(formatMetricValue(latest, meta.mode))}</strong>`,
        buildSparkBars(points, tone),
        `<div class="series-meta">${makePill(`${points.length} points`, 'neutral')}</div>`,
        '</article>',
      ].join('');
    }).join('');
  }

  function describeUserAgent(userAgent) {
    const text = String(userAgent || '').trim();
    if (!text) return 'Unknown device';
    const lowered = text.toLowerCase();
    const browser =
      lowered.includes('edg/') ? 'Edge'
        : lowered.includes('chrome/') ? 'Chrome'
          : lowered.includes('firefox/') ? 'Firefox'
            : lowered.includes('safari/') ? 'Safari'
              : lowered.includes('discordbot') ? 'Discord Bot'
                : 'Browser';
    const platform =
      lowered.includes('windows') ? 'Windows'
        : lowered.includes('android') ? 'Android'
          : lowered.includes('iphone') || lowered.includes('ipad') || lowered.includes('ios') ? 'iOS'
            : lowered.includes('mac os') || lowered.includes('macintosh') ? 'macOS'
              : lowered.includes('linux') ? 'Linux'
                : 'Unknown OS';
    return `${browser} on ${platform}`;
  }

  function buildDeviceRows(requests = []) {
    const map = new Map();
    for (const row of Array.isArray(requests) ? requests : []) {
      const user = String(row?.user || 'unknown').trim() || 'unknown';
      const ip = String(row?.ip || 'unknown').trim() || 'unknown';
      const userAgent = String(row?.userAgent || '').trim();
      const key = `${user}|${ip}|${userAgent}`;
      const entry = map.get(key) || {
        user,
        role: String(row?.role || '').trim() || '-',
        ip,
        userAgent,
        deviceLabel: describeUserAgent(userAgent),
        hits: 0,
        lastSeenAt: row?.at || null,
      };
      entry.hits += 1;
      if (!entry.lastSeenAt || new Date(row?.at || 0) > new Date(entry.lastSeenAt || 0)) {
        entry.lastSeenAt = row?.at || entry.lastSeenAt;
      }
      map.set(key, entry);
    }
    return Array.from(map.values())
      .sort((left, right) => new Date(right.lastSeenAt || 0) - new Date(left.lastSeenAt || 0))
      .slice(0, 16);
  }

  function formatAuditCell(key, value) {
    if (value == null || value === '') return '-';
    if (Array.isArray(value)) {
      return value.join(', ') || '-';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    if (/(?:At|time|date)$/i.test(String(key || ''))) {
      return formatDateTime(value);
    }
    return String(value);
  }

  function buildAuditQueryString(filters = {}, extra = {}) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...extra };
    Object.entries(merged).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim();
      if (!normalized) return;
      params.set(key, normalized);
    });
    return params.toString();
  }

  function buildIncidentQueryString(filters = {}, extra = {}) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...extra };
    Object.entries(merged).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim();
      if (!normalized && normalized !== 'false') return;
      params.set(key, normalized);
    });
    return params.toString();
  }

  function setBanner(title, detail, tags, tone) {
    const banner = document.getElementById('ownerStatusBanner');
    const tagWrap = document.getElementById('ownerStatusTags');
    document.getElementById('ownerStatusTitle').textContent = title;
    document.getElementById('ownerStatusDetail').textContent = detail;
    banner.className = `status-banner banner-${tone || 'info'}`;
    tagWrap.innerHTML = (Array.isArray(tags) ? tags : []).filter(Boolean).map((tag) => makePill(tag)).join('');
  }

  function buildIncidentItems() {
    const requestItems = Array.isArray(state.requestLogs?.items)
      ? state.requestLogs.items.map((item) => ({
          source: 'requests',
          severity: item.statusCode >= 500 ? 'danger' : 'warning',
          title: `${item.method || 'REQ'} ${item.path || item.routeGroup || 'request'}`,
          detail: `${item.statusCode || '-'} ${item.error || item.summary || item.requestId || ''}`.trim(),
          time: item.at || item.createdAt,
        }))
      : [];
    const notificationItems = state.notifications.map((item) => {
      const localized = localizeAdminNotification(item);
      return {
        source: 'alerts',
        severity: item.severity || 'warning',
        title: localized.title,
        detail: localized.detail,
        time: item.createdAt || item.at,
      };
    });
    const securityItems = state.securityEvents.map((item) => ({
      source: 'security',
      severity: item.severity || 'info',
      title: item.type || 'Security event',
      detail: item.detail || item.reason || '',
      time: item.createdAt || item.at,
    }));

    return [...notificationItems, ...securityItems, ...requestItems]
      .sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime())
      .slice(0, 12);
  }

  // Owner overview is the "front page" of the console.
  // Keep it limited to a few summary cards so the owner can scan platform
  // health quickly before diving into a deeper page from the sidebar.
  function renderOverview() {
    const analytics = state.overview?.analytics || {};
    const tenants = analytics.tenants || {};
    const delivery = analytics.delivery || {};
    const subscriptions = analytics.subscriptions || {};
    const runtimeRows = normalizeRuntimeRows(state.runtimeSupervisor);
    const readyServices = runtimeRows.filter((row) => String(row.status || '').toLowerCase() === 'ready').length;
    const degradedServices = runtimeRows.filter((row) => {
      const status = String(row.status || '').toLowerCase();
      return status && status !== 'ready';
    }).length;
    const requestErrors = Array.isArray(state.requestLogs?.items) ? state.requestLogs.items.length : 0;

    renderStats(document.getElementById('ownerOverviewStats'), [
      {
        kicker: t('owner.overview.tenants.kicker', 'Tenants'),
        value: formatNumber(tenants.total || state.tenants.length, '0'),
        title: t('owner.overview.tenants.title', 'Active platform tenants'),
        detail: t('owner.overview.tenants.detail', 'Includes trialing and reseller entries visible from the owner scope.'),
        tags: [
          t('owner.overview.tenants.activeTag', 'active {count}', { count: formatNumber(tenants.active, '0') }),
          t('owner.overview.tenants.trialTag', 'trial {count}', { count: formatNumber(tenants.trialing, '0') }),
          t('owner.overview.tenants.resellerTag', 'reseller {count}', { count: formatNumber(tenants.reseller, '0') }),
        ],
      },
      {
        kicker: t('owner.overview.delivery.kicker', 'Delivery'),
        value: `${formatNumber(delivery.successRate, '0')}%`,
        title: t('owner.overview.delivery.title', '30-day delivery success'),
        detail: t('owner.overview.delivery.detail', 'Platform-wide purchase-to-delivery signal.'),
        tags: [
          t('owner.overview.delivery.purchasesTag', 'purchases {count}', { count: formatNumber(delivery.purchaseCount30d, '0') }),
          t('owner.overview.delivery.queueTag', 'queue {count}', { count: formatNumber(delivery.queueJobs, '0') }),
          t('owner.overview.delivery.deadTag', 'dead {count}', { count: formatNumber(delivery.deadLetters, '0') }),
        ],
      },
      {
        kicker: t('owner.overview.runtime.kicker', 'Runtime'),
        value: `${formatNumber(readyServices, '0')}/${formatNumber(runtimeRows.length, '0')}`,
        title: t('owner.overview.runtime.title', 'Managed services ready'),
        detail: t('owner.overview.runtime.detail', 'Bot, worker, watcher, admin web, and auxiliary services.'),
        tags: [
          t('owner.overview.runtime.degradedTag', 'degraded {count}', { count: formatNumber(degradedServices, '0') }),
          t('owner.overview.runtime.agentsTag', 'agents {count}', { count: formatNumber(state.agents.length, '0') }),
        ],
      },
      {
        kicker: t('owner.overview.incidents.kicker', 'Incidents'),
        value: formatNumber(state.notifications.length + requestErrors, '0'),
        title: t('owner.overview.incidents.title', 'Open owner attention items'),
        detail: t('owner.overview.incidents.detail', 'Aggregates notifications and latest request anomalies.'),
        tags: [
          t('owner.overview.incidents.alertsTag', 'alerts {count}', { count: formatNumber(state.notifications.length, '0') }),
          t('owner.overview.incidents.requestErrorsTag', 'request errors {count}', { count: formatNumber(requestErrors, '0') }),
          t('owner.overview.incidents.subsTag', 'subs {count}', { count: formatNumber(subscriptions.active, '0') }),
        ],
      },
    ]);
    renderQuickActions();
  }

  function renderQuickActions() {
    const container = document.getElementById('ownerQuickActions');
    if (!container) return;
    const items = [
      {
        key: 'delivery-stuck',
        tone: 'warning',
        tag: t('owner.quickAction.tag.runtime', 'runtime'),
        title: t('owner.quickAction.deliveryStuck.title', 'Delivery stuck'),
        detail: t('owner.quickAction.deliveryStuck.detail', 'Open delivery lifecycle watch first, then decide whether the issue needs tenant support, export evidence, or runtime review.'),
        button: t('owner.quickAction.deliveryStuck.button', 'Open delivery watch'),
      },
      {
        key: 'wallet-mismatch',
        tone: 'info',
        tag: t('owner.quickAction.tag.audit', 'audit'),
        title: t('owner.quickAction.walletMismatch.title', 'Wallet mismatch'),
        detail: t('owner.quickAction.walletMismatch.detail', 'Jump straight to the wallet audit view when coins, rewards, or ledger changes need owner-level review.'),
        button: t('owner.quickAction.walletMismatch.button', 'Open wallet audit'),
      },
      {
        key: 'steam-link-issue',
        tone: 'warning',
        tag: t('owner.quickAction.tag.support', 'support'),
        title: t('owner.quickAction.steamLink.title', 'Steam link issue'),
        detail: t('owner.quickAction.steamLink.detail', 'Open the tenant support case flow first when the issue is player identity, Steam readiness, or onboarding drift.'),
        button: t('owner.quickAction.steamLink.button', 'Open support case'),
      },
      {
        key: 'restart-announcement',
        tone: 'info',
        tag: t('owner.quickAction.tag.control', 'control'),
        title: t('owner.quickAction.restartAnnouncement.title', 'Restart announcement'),
        detail: t('owner.quickAction.restartAnnouncement.detail', 'Open the control center restart flow when you need a guided maintenance and service restart handoff.'),
        button: t('owner.quickAction.restartAnnouncement.button', 'Open restart preset'),
      },
    ];
    container.innerHTML = items.map((item) => [
      '<article class="quick-action-card">',
      `<div class="feed-meta">${makePill(item.tag, item.tone)}</div>`,
      `<strong>${escapeHtml(item.title)}</strong>`,
      `<p>${escapeHtml(item.detail)}</p>`,
      `<div class="button-row"><button type="button" class="button button-primary" data-owner-quick-action="${escapeHtml(item.key)}">${escapeHtml(item.button)}</button></div>`,
      '</article>',
    ].join('')).join('');
  }

  function focusOwnerAuditView(view) {
    const nextView = String(view || 'wallet').trim() || 'wallet';
    state.auditFilters = {
      ...state.auditFilters,
      view: nextView,
    };
    renderAudit();
    openOwnerTarget('audit', { targetId: 'ownerAuditQueryForm', block: 'center' });
  }

  function runOwnerQuickAction(actionKey) {
    const key = String(actionKey || '').trim();
    if (key === 'delivery-stuck') {
      openOwnerTarget('observability', { targetId: 'ownerDeliveryLifecycleActions', block: 'center' });
      return;
    }
    if (key === 'wallet-mismatch') {
      focusOwnerAuditView('wallet');
      showToast(t('owner.toast.walletAuditFocused', 'Wallet audit view focused.'), 'info');
      return;
    }
    if (key === 'steam-link-issue') {
      openOwnerTarget('fleet', { targetId: 'ownerSupportCaseForm', block: 'center' });
      return;
    }
    if (key === 'restart-announcement') {
      openOwnerTarget('control', { targetId: 'ownerRestartForm', block: 'center' });
    }
  }

  function renderTenantTable() {
    renderTable(document.getElementById('ownerTenantTable'), {
      emptyText: t('owner.table.empty.tenants', 'No tenants found.'),
      columns: [
        {
          label: t('owner.table.tenant', 'Tenant'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.slug || row.id || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.id || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.table.type', 'Type'),
          render: (row) => escapeHtml(row.type || row.plan || '-'),
        },
        {
          label: t('owner.table.owner', 'Owner'),
          render: (row) => [
            `<div>${escapeHtml(row.ownerName || '-')}</div>`,
            row.ownerEmail ? `<div class="muted">${escapeHtml(row.ownerEmail)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.updated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</span>`,
        },
        {
          // Keep support review a one-click workflow from the fleet view.
          // If you want a richer drawer later, start from this action column.
          label: t('owner.table.actions', 'Actions'),
          render: (row) => {
            const tenantId = String(row.id || '').trim();
            if (!tenantId) return '<span class="muted">-</span>';
            return `<button type="button" class="button table-inline-action" data-owner-support-case="${escapeHtml(tenantId)}">${escapeHtml(t('owner.table.openCase', 'Open Case'))}</button>`;
          },
        },
      ],
      rows: state.tenants.slice(0, 20),
    });
  }

  function renderSupportCase() {
    const select = document.getElementById('ownerSupportTenantSelect');
    const statsWrap = document.getElementById('ownerSupportCaseStats');
    const metaWrap = document.getElementById('ownerSupportCaseMeta');
    const checklistWrap = document.getElementById('ownerSupportCaseChecklist');
    const signalsWrap = document.getElementById('ownerSupportCaseSignals');
    const actionsWrap = document.getElementById('ownerSupportCaseActions');
    const exportJsonBtn = document.getElementById('ownerSupportCaseExportJsonBtn');
    const exportCsvBtn = document.getElementById('ownerSupportCaseExportCsvBtn');
    const selectedTenantId = String(state.supportCase?.tenantId || select?.value || '').trim();

    if (select) {
      const current = selectedTenantId;
      select.innerHTML = [
        `<option value="">${escapeHtml(t('owner.form.chooseTenant', 'Choose tenant'))}</option>`,
        ...state.tenants.map((row) => {
          const tenantId = String(row.id || '').trim();
          const label = row.name || row.slug || tenantId || '-';
          const selected = tenantId && tenantId === current ? ' selected' : '';
          return `<option value="${escapeHtml(tenantId)}"${selected}>${escapeHtml(label)} (${escapeHtml(tenantId)})</option>`;
        }),
      ].join('');
      if (current) {
        select.value = current;
      }
    }

    if (exportJsonBtn) exportJsonBtn.disabled = !selectedTenantId;
    if (exportCsvBtn) exportCsvBtn.disabled = !selectedTenantId;

    if (!state.supportCase) {
      statsWrap.innerHTML = '';
      metaWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('owner.support.empty', 'Choose a tenant to load lifecycle, onboarding, and support context.'))}</div>`;
      checklistWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('owner.support.emptyChecklist', 'No support checklist loaded yet.'))}</div>`;
      signalsWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('owner.support.emptySignals', 'No support signals loaded yet.'))}</div>`;
      actionsWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('owner.support.emptyActions', 'No recommended next steps yet.'))}</div>`;
      return;
    }

    const bundle = state.supportCase;
    const onboarding = bundle?.onboarding || {};
    const signals = bundle?.signals || {};
    const lifecycle = bundle?.lifecycle || {};
    const diagnostics = bundle?.diagnostics || {};
    const ownerContact = [
      diagnostics?.tenant?.ownerName || diagnostics?.tenant?.ownerEmail || '',
      diagnostics?.tenant?.ownerEmail && diagnostics?.tenant?.ownerEmail !== diagnostics?.tenant?.ownerName
        ? diagnostics.tenant.ownerEmail
        : '',
    ].filter(Boolean).join(' | ') || '-';

    renderStats(statsWrap, [
      {
        kicker: t('owner.support.summary.phase', 'Phase'),
        title: supportPhaseLabel(lifecycle.key),
        detail: lifecycle.detail || '-',
      },
      {
        kicker: t('owner.support.summary.required', 'Required Ready'),
        title: `${formatNumber(onboarding.requiredCompleted, '0')} / ${formatNumber(onboarding.requiredTotal, '0')}`,
        detail: t('owner.support.summary.requiredDetail', 'Required onboarding checks completed'),
      },
      {
        kicker: t('owner.support.summary.signals', 'Signals'),
        title: formatNumber(signals.total, '0'),
        detail: t('owner.support.summary.signalsDetail', 'Open support or incident signals'),
      },
      {
        kicker: t('owner.support.summary.exports', 'Export'),
        title: formatDateTime(bundle.generatedAt),
        detail: t('owner.support.summary.exportsDetail', 'Latest owner support snapshot time'),
      },
    ]);

    metaWrap.innerHTML = [
      '<article class="panel-card">',
      `<h3>${escapeHtml(t('owner.support.caseOverview', 'Case Overview'))}</h3>`,
      `<p>${escapeHtml(lifecycle.detail || '-')}</p>`,
      `<div class="tag-row">${[
        makePill(supportPhaseLabel(lifecycle.key), supportToneToPill(lifecycle.tone)),
        makePill(`${t('owner.support.meta.tenantStatus', 'tenant')} ${lifecycle.tenantStatus || '-'}`, 'neutral'),
        makePill(`${t('owner.support.meta.subscriptionStatus', 'subscription')} ${lifecycle.subscriptionStatus || '-'}`, 'neutral'),
        makePill(`${t('owner.support.meta.licenseStatus', 'license')} ${lifecycle.licenseStatus || '-'}`, 'neutral'),
      ].join(' ')}</div>`,
      '</article>',
      '<article class="panel-card">',
      `<h3>${escapeHtml(t('owner.support.caseMeta', 'Case Metadata'))}</h3>`,
      `<div class="feed-item"><strong>${escapeHtml(t('owner.support.meta.tenantId', 'Tenant ID'))}</strong><div class="muted code">${escapeHtml(bundle.tenantId || '-')}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('owner.support.meta.owner', 'Owner Contact'))}</strong><div class="muted">${escapeHtml(ownerContact)}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('owner.support.meta.monitoring', 'Last Monitoring'))}</strong><div class="muted">${escapeHtml(formatDateTime(diagnostics?.platform?.lastMonitoringAt))}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('owner.support.meta.reconcile', 'Last Reconcile'))}</strong><div class="muted">${escapeHtml(formatDateTime(diagnostics?.platform?.lastReconcileAt))}</div></div>`,
      '</article>',
    ].join('');

    renderList(
      checklistWrap,
      Array.isArray(onboarding.items) ? onboarding.items : [],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(supportChecklistStatusLabel(item.status, item.required), supportChecklistStatusTone(item.status, item.required))}${item.required ? ` ${makePill(t('owner.support.required', 'required'), 'info')}` : ` ${makePill(t('owner.support.optional', 'optional'), 'neutral')}`}</div>`,
        `<strong>${escapeHtml(supportChecklistLabel(item.key))}</strong>`,
        `<div class="muted">${escapeHtml(item.detail || '-')}</div>`,
        '</article>',
      ].join(''),
      t('owner.support.emptyChecklist', 'No support checklist loaded yet.'),
    );

    renderList(
      signalsWrap,
      Array.isArray(signals.items) ? signals.items : [],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(supportSignalLabel(item.key), supportToneToPill(item.tone))} ${makePill(formatNumber(item.count, '0'), 'neutral')}</div>`,
        `<strong>${escapeHtml(supportSignalLabel(item.key))}</strong>`,
        `<div class="muted">${escapeHtml(item.detail || '-')}</div>`,
        '</article>',
      ].join(''),
      t('owner.support.emptySignalsLoaded', 'No active support signals for this tenant.'),
    );

    renderList(
      actionsWrap,
      Array.isArray(bundle.actions) ? bundle.actions : [],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(supportActionLabel(item.key), supportToneToPill(item.tone))}</div>`,
        `<strong>${escapeHtml(supportActionLabel(item.key))}</strong>`,
        `<div class="muted">${escapeHtml(item.detail || '-')}</div>`,
        '</article>',
      ].join(''),
      t('owner.support.emptyActions', 'No recommended next steps yet.'),
    );
  }

  function getOwnerSupportScopedTenantId() {
    return String(
      state.supportCase?.tenantId
      || document.getElementById('ownerSupportTenantSelect')?.value
      || ''
    ).trim();
  }

  // Keep owner support shortcuts intentionally small: load one tenant case,
  // export diagnostics, inspect lifecycle posture, or step into maintenance.
  function renderOwnerSupportToolkit() {
    const container = document.getElementById('ownerSupportToolkit');
    if (!container) return;
    const scopedTenantId = getOwnerSupportScopedTenantId();
    const hasTenantContext = Boolean(scopedTenantId);
    const items = [
      {
        key: 'support-case',
        tone: 'warning',
        tag: t('owner.supportToolkit.tag.support', 'support'),
        title: t('owner.supportToolkit.supportCase.title', 'Open tenant support case'),
        detail: hasTenantContext
          ? t('owner.supportToolkit.supportCase.detailActive', 'Continue working on tenant {tenantId} with onboarding, signals, and next-step guidance already in view.', { tenantId: scopedTenantId })
          : t('owner.supportToolkit.supportCase.detail', 'Start from one tenant case before you export evidence or jump into deeper runtime tools.'),
        button: t('owner.supportToolkit.supportCase.button', 'Open support case'),
      },
      {
        key: 'diagnostics',
        tone: 'info',
        tag: t('owner.supportToolkit.tag.diagnostics', 'diagnostics'),
        title: t('owner.supportToolkit.diagnostics.title', 'Export tenant diagnostics'),
        detail: hasTenantContext
          ? t('owner.supportToolkit.diagnostics.detailActive', 'Export the current tenant diagnostics bundle for support handoff or incident notes.')
          : t('owner.supportToolkit.diagnostics.detail', 'Choose a tenant support case first, then export the diagnostics bundle without opening raw API routes manually.'),
        button: t('owner.supportToolkit.diagnostics.button', 'Export diagnostics'),
      },
      {
        key: 'lifecycle',
        tone: 'warning',
        tag: t('owner.supportToolkit.tag.runtime', 'runtime'),
        title: t('owner.supportToolkit.lifecycle.title', 'Inspect delivery lifecycle'),
        detail: t('owner.supportToolkit.lifecycle.detail', 'Jump to the lifecycle watch when queue pressure, retries, or poison candidates need owner review before tenant replay.'),
        button: t('owner.supportToolkit.lifecycle.button', 'Open lifecycle watch'),
      },
      {
        key: 'restart',
        tone: 'danger',
        tag: t('owner.supportToolkit.tag.maintenance', 'maintenance'),
        title: t('owner.supportToolkit.restart.title', 'Open restart workflow'),
        detail: t('owner.supportToolkit.restart.detail', 'Use the existing maintenance flow when you need restart communication or a planned downtime runbook.'),
        button: t('owner.supportToolkit.restart.button', 'Open restart flow'),
      },
    ];

    container.innerHTML = items.map((item) => [
      '<article class="quick-action-card">',
      `<div class="feed-meta">${makePill(item.tag, item.tone)}</div>`,
      `<strong>${escapeHtml(item.title)}</strong>`,
      `<p>${escapeHtml(item.detail)}</p>`,
      `<div class="button-row"><button type="button" class="button button-primary" data-owner-support-tool="${escapeHtml(item.key)}">${escapeHtml(item.button)}</button></div>`,
      '</article>',
    ].join('')).join('');
  }

  function runOwnerSupportToolkitAction(actionKey) {
    const key = String(actionKey || '').trim();
    const scopedTenantId = getOwnerSupportScopedTenantId();
    if (key === 'support-case') {
      openOwnerTarget('fleet', {
        targetId: scopedTenantId ? 'ownerSupportCaseStats' : 'ownerSupportCaseForm',
        block: 'center',
      });
      if (!scopedTenantId) {
        showToast(t('owner.toast.supportToolkitNeedsTenant', 'Choose a tenant support case first.'), 'info');
      }
      return;
    }
    if (key === 'diagnostics') {
      if (openTenantDiagnosticsExport(scopedTenantId, 'json')) {
        return;
      }
      openOwnerTarget('fleet', { targetId: 'ownerSupportCaseForm', block: 'center' });
      showToast(t('owner.toast.supportToolkitNeedsTenant', 'Choose a tenant support case first.'), 'info');
      return;
    }
    if (key === 'lifecycle') {
      openOwnerTarget('observability', { targetId: 'ownerDeliveryLifecycleActions', block: 'center' });
      return;
    }
    if (key === 'restart') {
      showToast(t('owner.toast.restartFlowOpened', 'Restart flow opened.'), 'info');
      openOwnerTarget('control', { targetId: 'ownerRestartForm', block: 'center' });
    }
  }

  function renderFleetAssets() {
    // These tables map directly to the owner-only commercial/integration
    // surface. If you want to hide or reorder one asset type, edit this
    // function first before touching the HTML.
    const tenantSelects = Array.from(document.querySelectorAll('.owner-tenant-select'));
    tenantSelects.forEach((select) => {
      const current = String(select.value || '').trim();
      select.innerHTML = [
        `<option value="">${escapeHtml(t('owner.form.chooseTenant', 'Choose tenant'))}</option>`,
        ...state.tenants.map((row) => {
          const tenantId = String(row.id || '').trim();
          const label = row.name || row.slug || tenantId || '-';
          const selected = tenantId && tenantId === current ? ' selected' : '';
          return `<option value="${escapeHtml(tenantId)}"${selected}>${escapeHtml(label)} (${escapeHtml(tenantId)})</option>`;
        }),
      ].join('');
      if (current && state.tenants.some((row) => String(row.id || '').trim() === current)) {
        select.value = current;
      }
    });

    renderTable(document.getElementById('ownerSubscriptionTable'), {
      emptyText: t('owner.table.empty.subscriptions', 'No subscriptions found.'),
      columns: [
        {
          label: t('owner.table.tenant', 'Tenant'),
          render: (row) => [
            `<strong>${escapeHtml(row.tenantName || row.tenantId || '-')}</strong>`,
            row.tenantId ? `<div class="muted code">${escapeHtml(row.tenantId)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.plan', 'Plan'),
          render: (row) => escapeHtml(row.planId || row.planName || '-'),
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.table.billing', 'Billing'),
          render: (row) => escapeHtml(row.billingCycle || row.currency || '-'),
        },
        {
          label: t('owner.table.renews', 'Renews'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.renewsAt || row.startedAt))}</span>`,
        },
      ],
      rows: state.subscriptions.slice(0, 12),
    });

    renderTable(document.getElementById('ownerLicenseTable'), {
      emptyText: t('owner.table.empty.licenses', 'No licenses found.'),
      columns: [
        {
          label: t('owner.table.tenant', 'Tenant'),
          render: (row) => [
            `<strong>${escapeHtml(row.tenantName || row.tenantId || '-')}</strong>`,
            row.tenantId ? `<div class="muted code">${escapeHtml(row.tenantId)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.license', 'License'),
          render: (row) => `<span class="code">${escapeHtml(maskTail(row.licenseKey || row.id || '-'))}</span>`,
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.table.seats', 'Seats'),
          render: (row) => formatNumber(row.seats, '-'),
        },
        {
          label: t('owner.table.expires', 'Expires'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.expiresAt || row.updatedAt))}</span>`,
        },
      ],
      rows: state.licenses.slice(0, 12),
    });

    renderTable(document.getElementById('ownerApiKeyTable'), {
      emptyText: t('owner.table.empty.apiKeys', 'No API keys found.'),
      columns: [
        {
          label: t('owner.table.tenant', 'Tenant'),
          render: (row) => [
            `<strong>${escapeHtml(row.tenantName || row.tenantId || '-')}</strong>`,
            row.tenantId ? `<div class="muted code">${escapeHtml(row.tenantId)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.key', 'Key'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.id || 'API key')}</strong>`,
            `<div class="muted code">${escapeHtml(maskTail(row.key || row.id || row.name || '-'))}</div>`,
          ].join(''),
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.table.scopes', 'Scopes'),
          render: (row) => escapeHtml(Array.isArray(row.scopes) ? row.scopes.join(', ') : '-'),
        },
      ],
      rows: state.apiKeys.slice(0, 12),
    });

    renderTable(document.getElementById('ownerWebhookTable'), {
      emptyText: t('owner.table.empty.webhooks', 'No webhook endpoints found.'),
      columns: [
        {
          label: t('owner.table.tenant', 'Tenant'),
          render: (row) => [
            `<strong>${escapeHtml(row.tenantName || row.tenantId || '-')}</strong>`,
            row.tenantId ? `<div class="muted code">${escapeHtml(row.tenantId)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.endpoint', 'Endpoint'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.id || 'Webhook')}</strong>`,
            row.url ? `<div class="muted">${escapeHtml(row.url)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.event', 'Event'),
          render: (row) => escapeHtml(row.eventType || row.type || '-'),
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
      ],
      rows: state.webhooks.slice(0, 12),
    });

    const resultWrap = document.getElementById('ownerAssetResult');
    const result = state.assetResult;
    if (!resultWrap) return;
    if (!result) {
      resultWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('owner.assetResult.empty', 'Create an asset or run a webhook test to see the latest owner action result here.'))}</div>`;
      return;
    }
    const tags = [
      result.kind || 'asset',
      result.tenantId || 'tenant -',
      result.createdAt ? `at ${formatDateTime(result.createdAt)}` : 'ready',
    ];
    resultWrap.innerHTML = [
      '<article class="panel-card">',
      `<h3>${escapeHtml(result.title || t('owner.assetResult.title', 'Owner asset result'))}</h3>`,
      result.detail ? `<p>${escapeHtml(result.detail)}</p>` : '',
      `<div class="tag-row">${tags.map((tag) => makePill(tag, 'info')).join('')}</div>`,
      '</article>',
      ...(Array.isArray(result.rows) && result.rows.length
        ? result.rows.map((row) => [
            '<article class="feed-item">',
            `<strong>${escapeHtml(row.label || 'Value')}</strong>`,
            `<div class="muted ${row.code ? 'code' : ''}">${escapeHtml(row.value || '-')}</div>`,
            '</article>',
          ].join(''))
        : [`<div class="empty-state">${escapeHtml(t('owner.assetResult.noDetails', 'No result details.'))}</div>`]),
    ].join('');
  }

  function renderRuntimeTables() {
    renderTable(document.getElementById('ownerRuntimeTable'), {
      emptyText: t('owner.table.empty.runtime', 'No runtime services reported.'),
      columns: [
        {
          label: t('owner.table.service', 'Service'),
          render: (row) => [
            `<strong>${escapeHtml(row.label || row.name || row.service || '-')}</strong>`,
            row.required === true ? `<div class="muted">${escapeHtml(t('owner.table.requiredRuntime', 'required runtime'))}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.table.detail', 'Detail'),
          render: (row) => escapeHtml(row.detail || row.reason || row.summary || '-'),
        },
        {
          label: t('owner.table.updated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.checkedAt || row.lastSeenAt))}</span>`,
        },
      ],
      rows: normalizeRuntimeRows(state.runtimeSupervisor),
    });

    renderTable(document.getElementById('ownerAgentsTable'), {
      emptyText: t('owner.table.empty.agents', 'No agent runtimes reported yet.'),
      columns: [
        {
          label: t('owner.table.runtime', 'Runtime'),
          render: (row) => [
            `<strong>${escapeHtml(row.runtimeKey || row.name || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.channel || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.table.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.table.version', 'Version'),
          render: (row) => escapeHtml(row.version || '-'),
        },
        {
          label: t('owner.table.lastSeen', 'Last Seen'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.lastSeenAt))}</span>`,
        },
      ],
      rows: state.agents.slice(0, 20),
    });
  }

  function renderIncidentCenter() {
    const form = document.getElementById('ownerIncidentQueryForm');
    if (form) {
      form.elements.severity.value = state.incidentFilters.severity || '';
      form.elements.acknowledged.value = state.incidentFilters.acknowledged ?? 'false';
      form.elements.kind.value = state.incidentFilters.kind || '';
    }

    const openNotifications = state.notifications.length;
    const inboxRows = state.incidentInbox;
    const acknowledgedRows = inboxRows.filter((row) => row.acknowledgedAt).length;
    const kinds = Array.from(new Set(inboxRows.map((row) => row.kind || row.type).filter(Boolean)));

    renderStats(document.getElementById('ownerIncidentStats'), [
      {
        kicker: 'Open',
        value: formatNumber(openNotifications, '0'),
        title: 'Open owner notifications',
        detail: 'Current unacknowledged notifications from monitoring, backup, reconcile, and security-adjacent operational signals.',
      },
      {
        kicker: 'Inbox',
        value: formatNumber(inboxRows.length, '0'),
        title: 'Filtered incident inbox size',
        detail: 'Matches the current incident query form filters.',
      },
      {
        kicker: 'Acknowledged',
        value: formatNumber(acknowledgedRows, '0'),
        title: 'Acknowledged entries in filter',
        detail: 'Useful for exporting and cleaning up handled incidents.',
      },
      {
        kicker: 'Kinds',
        value: formatNumber(kinds.length, '0'),
        title: 'Distinct alert kinds',
        detail: kinds.slice(0, 3).join(', ') || 'No incident kinds in current filter.',
      },
    ]);

    renderList(
      document.getElementById('ownerIncidentFeed'),
      inboxRows,
      (item) => {
        const localized = localizeAdminNotification(item);
        return [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.severity || 'info')} ${item.kind ? `<span class="code">${escapeHtml(item.kind)}</span>` : ''}</div>`,
        `<strong>${escapeHtml(localized.title || t('owner.incidents.itemDefault', 'Incident'))}</strong>`,
        localized.detail ? `<div class="muted">${escapeHtml(localized.detail)}</div>` : '',
        `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.createdAt))}</span>${item.acknowledgedAt ? `<span>${escapeHtml(t('owner.incidents.ackAt', 'ack {value}', { value: formatDateTime(item.acknowledgedAt) }))}</span>` : `<span>${escapeHtml(t('owner.incidents.open', 'open'))}</span>`}</div>`,
        '</article>',
      ].join('');
      },
      t('owner.incidents.emptyQuery', 'No incidents matched the current query.')
    );

    const runbookKinds = kinds.slice(0, 3);
    document.getElementById('ownerIncidentRunbooks').innerHTML = (
      runbookKinds.length > 0
        ? runbookKinds
        : ['queue-pressure', 'delivery-reconcile-anomaly', 'tenant-quota-near-limit']
    ).map((kind) => {
      const text =
        kind === 'queue-pressure'
          ? 'Review queue depth, dead letters, and the latest runtime status before intervening. Use delivery tooling only after confirming it is not a transient spike.'
          : kind === 'delivery-reconcile-anomaly'
            ? 'Export the incident set, inspect reconcile sample codes, and confirm whether queue/runtime/audit state disagrees before retrying or restoring.'
            : kind === 'tenant-quota-near-limit' || kind === 'tenant-quota-exceeded'
              ? 'Review tenant plan posture, active keys/webhooks/agents/offers, and decide whether to raise plan limits or clean up unused assets.'
              : 'Review the incident detail, correlate with runtime and security feeds, then export evidence before making any destructive change.';
      return [
        '<article class="kv-card">',
        `<h4>${escapeHtml(kind)}</h4>`,
        `<p>${escapeHtml(text)}</p>`,
        '</article>',
      ].join('');
    }).join('');
  }

  function renderDeliveryLifecycle() {
    const report = state.deliveryLifecycle || {};
    const summary = report.summary || {};
    const runtime = report.runtime || {};

    renderStats(document.getElementById('ownerDeliveryLifecycleStats'), [
      {
        kicker: t('deliveryLifecycle.stats.queue.kicker', 'Queue'),
        value: formatNumber(summary.queueCount, '0'),
        title: t('deliveryLifecycle.stats.queue.title', 'Queued jobs'),
        detail: t('deliveryLifecycle.stats.queue.detail', 'Live queue depth inside the current scoped delivery lifecycle sample.'),
        tags: [
          t('deliveryLifecycle.stats.inFlightTag', 'in flight {count}', { count: formatNumber(summary.inFlightCount, '0') }),
          t('deliveryLifecycle.stats.modeTag', 'mode {value}', { value: runtime.executionMode || 'unknown' }),
        ],
      },
      {
        kicker: t('deliveryLifecycle.stats.dead.kicker', 'Dead'),
        value: formatNumber(summary.deadLetterCount, '0'),
        title: t('deliveryLifecycle.stats.dead.title', 'Dead-letter entries'),
        detail: t('deliveryLifecycle.stats.dead.detail', 'Items that already left the live queue and now need guided follow-up.'),
        tags: [
          t('deliveryLifecycle.stats.retryableTag', 'retryable {count}', { count: formatNumber(summary.retryableDeadLetters, '0') }),
          t('deliveryLifecycle.stats.nonRetryableTag', 'non-retryable {count}', { count: formatNumber(summary.nonRetryableDeadLetters, '0') }),
        ],
      },
      {
        kicker: t('deliveryLifecycle.stats.poison.kicker', 'Poison'),
        value: formatNumber(summary.poisonCandidateCount, '0'),
        title: t('deliveryLifecycle.stats.poison.title', 'Poison candidates'),
        detail: t('deliveryLifecycle.stats.poison.detail', 'Jobs that should not be replayed blindly because retry history or flags look unsafe.'),
        tags: [
          t('deliveryLifecycle.stats.retryHeavyTag', 'retry-heavy {count}', { count: formatNumber(summary.retryHeavyCount, '0') }),
        ],
      },
      {
        kicker: t('deliveryLifecycle.stats.overdue.kicker', 'Overdue'),
        value: formatNumber(summary.overdueCount, '0'),
        title: t('deliveryLifecycle.stats.overdue.title', 'Overdue queue items'),
        detail: t('deliveryLifecycle.stats.overdue.detail', 'Queue jobs that have been waiting longer than the configured owner/tenant threshold.'),
        tags: [
          runtime.workerBusy
            ? t('deliveryLifecycle.stats.workerBusyTag', 'worker busy')
            : t('deliveryLifecycle.stats.workerIdleTag', 'worker idle'),
          t('deliveryLifecycle.stats.recentSuccessTag', 'recent ok {count}', { count: formatNumber(summary.recentSuccessCount, '0') }),
        ],
      },
    ]);

    renderList(
      document.getElementById('ownerDeliveryLifecycleSignals'),
      Array.isArray(report.signals) ? report.signals : [],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(deliveryLifecycleSignalLabel(item.key), deliveryLifecycleSignalTone(item.key, item.tone))} ${makePill(formatNumber(item.count, '0'), 'neutral')}</div>`,
        `<strong>${escapeHtml(deliveryLifecycleSignalLabel(item.key))}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('deliveryLifecycle.emptySignals', 'No delivery lifecycle signals are active right now.'),
    );

    renderList(
      document.getElementById('ownerDeliveryLifecycleErrors'),
      Array.isArray(report.topErrors) ? report.topErrors : [],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(t('deliveryLifecycle.errors.count', '{count} hits', { count: formatNumber(item.count, '0') }), item.tone || 'warning')}</div>`,
        `<strong class="code">${escapeHtml(item.key || 'UNKNOWN')}</strong>`,
        `<div class="muted">${escapeHtml(t('deliveryLifecycle.errors.detail', 'Top repeated delivery error signature across queue and dead-letter state.'))}</div>`,
        '</article>',
      ].join(''),
      t('deliveryLifecycle.emptyErrors', 'No repeated delivery error signatures in the sampled lifecycle state.'),
    );

    renderList(
      document.getElementById('ownerDeliveryLifecycleActions'),
      Array.isArray(report.actionPlan?.actions) ? report.actionPlan.actions : [],
      (item) => {
        const actionButtons = [];
        if (item.key === 'review-runtime-before-retry' || item.key === 'inspect-top-error') {
          actionButtons.push(
            `<button type="button" class="button" data-owner-lifecycle-nav="observability" data-owner-lifecycle-target="ownerOpsStateStats">${escapeHtml(t('deliveryLifecycle.action.openObservability', 'Open Observability'))}</button>`,
          );
        }
        if (item.key === 'retry-queue-batch' || item.key === 'retry-dead-letter-batch') {
          actionButtons.push(
            `<button type="button" class="button" data-owner-lifecycle-nav="incidents" data-owner-lifecycle-target="ownerReconcileFeed">${escapeHtml(t('deliveryLifecycle.action.openIncidents', 'Open Incidents'))}</button>`,
          );
          actionButtons.push(
            `<button type="button" class="button" data-owner-lifecycle-export="json">${escapeHtml(t('deliveryLifecycle.action.exportJson', 'Export JSON'))}</button>`,
          );
        }
        if (item.key === 'hold-poison-candidates') {
          actionButtons.push(
            `<button type="button" class="button" data-owner-lifecycle-nav="fleet" data-owner-lifecycle-target="ownerSupportCaseStats">${escapeHtml(t('deliveryLifecycle.action.openSupport', 'Open Support'))}</button>`,
          );
          actionButtons.push(
            `<button type="button" class="button button-warning" data-owner-lifecycle-export="csv">${escapeHtml(t('deliveryLifecycle.action.exportCsv', 'Export CSV'))}</button>`,
          );
        }
        if (item.key === 'lifecycle-stable') {
          actionButtons.push(
            `<button type="button" class="button" data-owner-lifecycle-nav="observability" data-owner-lifecycle-target="ownerDeliveryLifecycleStats">${escapeHtml(t('deliveryLifecycle.action.openObservability', 'Open Observability'))}</button>`,
          );
        }
        return [
          '<article class="feed-item">',
          `<div class="feed-meta">${makePill(deliveryLifecycleActionLabel(item.key), item.tone || 'info')} ${makePill(formatNumber(item.count, '0'), 'neutral')}</div>`,
          `<strong>${escapeHtml(deliveryLifecycleActionLabel(item.key))}</strong>`,
          `<div class="muted">${escapeHtml(deliveryLifecycleActionDetail(item))}</div>`,
          item.topErrorKey ? `<div class="muted code">${escapeHtml(item.topErrorKey)}</div>` : '',
          actionButtons.length ? `<div class="button-row button-row-compact">${actionButtons.join('')}</div>` : '',
          '</article>',
        ].join('');
      },
      t('deliveryLifecycle.emptyActions', 'No lifecycle actions are suggested right now.'),
    );
  }

  function renderObservability() {
    const data = state.observability || {};
    const delivery = data.delivery || {};
    const login = data.adminLogin || {};
    const webhook = data.webhook || {};
    const requestLog = data.requestLog || {};
    const runtimeCounts = state.runtimeSupervisor?.counts || data.runtimeSupervisor?.counts || {};
    const reconcile = state.reconcile || {};
    const latestAutomationReport = state.automationReport;
    const automationConfig =
      latestAutomationReport?.automationConfig
      || state.opsState?.automationConfig
      || state.overview?.automationConfig
      || null;
    const automation = getAutomationState();
    const recoveryResults = Object.entries(automation?.lastRecoveryResultByKey || {})
      .map(([serviceKey, row]) => ({
        serviceKey,
        ...(row && typeof row === 'object' ? row : {}),
      }))
      .sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0));
    const activeBudgetCount = Object.values(automation?.recoveryAttemptsByKey || {})
      .filter((value) => Number(value) > 0)
      .length;
    const trackedRuntimeCount = Object.keys(automation?.lastRecoveryAtByKey || {}).length;
    const automationActions = Array.isArray(latestAutomationReport?.actions) ? latestAutomationReport.actions : [];
    const automationPolicyTags = [
      makePill(
        automationConfig?.enabled === false
          ? t('owner.automation.policyDisabled', 'disabled')
          : t('owner.automation.policyLoaded', 'policy loaded'),
        automationConfig?.enabled === false ? 'danger' : 'info'
      ),
      automationConfig
        ? makePill(
            t('owner.automation.policyActions', 'max actions {count}', {
              count: formatNumber(automationConfig.maxActionsPerCycle, '0'),
            }),
            'neutral'
          )
        : '',
      automationConfig
        ? makePill(
            t('owner.automation.policyServices', 'services {count}', {
              count: formatNumber(automationConfig.restartServices?.length || 0, '0'),
            }),
            'neutral'
          )
        : '',
      automationConfig?.runMonitoringAfterRecovery === true
        ? makePill(t('owner.automation.policyFollowup', 'monitor after recovery'), 'success')
        : '',
    ].filter(Boolean);

    renderDeliveryLifecycle();

    renderStats(document.getElementById('ownerObservabilityStats'), [
      {
        kicker: t('owner.observability.deliveryKicker', 'Delivery'),
        value: formatMetricValue(delivery.queueLength, 'integer'),
        title: t('owner.observability.deliveryTitle', 'Queue depth'),
        detail: t('owner.observability.deliveryDetail', 'Current queue depth across delivery execution paths.'),
        tags: [
          t('owner.observability.deliveryFailTag', 'fail {value}', { value: formatMetricValue(delivery.failRate, 'percent') }),
          t('owner.observability.deliveryDeadTag', 'dead {value}', { value: formatMetricValue(data.deliveryRuntime?.deadLetterCount, 'integer') }),
        ],
      },
      {
        kicker: t('owner.observability.webhookKicker', 'Webhook'),
        value: formatMetricValue(webhook.errorRate, 'percent'),
        title: t('owner.observability.webhookTitle', 'Webhook error rate'),
        detail: t('owner.observability.webhookDetail', 'Recent SCUM webhook delivery error ratio.'),
        tags: [
          t('owner.observability.webhookAttemptsTag', 'attempts {value}', { value: formatMetricValue(webhook.attempts, 'integer') }),
          t('owner.observability.webhookErrorsTag', 'errors {value}', { value: formatMetricValue(webhook.errors, 'integer') }),
        ],
      },
      {
        kicker: t('owner.observability.securityKicker', 'Security'),
        value: formatMetricValue(login.failures, 'integer'),
        title: t('owner.observability.securityTitle', 'Login failures'),
        detail: t('owner.observability.securityDetail', 'Admin login failure pressure in the current observation window.'),
        tags: [
          t('owner.observability.securityHotIpsTag', 'hot IPs {value}', { value: formatMetricValue(Array.isArray(login.hotIps) ? login.hotIps.length : 0, 'integer') }),
          t('owner.observability.windowMinutesTag', 'window {value} min', { value: formatMetricValue(Math.round(Number(login.windowMs || 0) / 60000), 'integer') }),
        ],
      },
      {
        kicker: t('owner.observability.requestsKicker', 'Requests'),
        value: formatMetricValue(requestLog.errors, 'integer'),
        title: t('owner.observability.requestsTitle', 'Admin request errors'),
        detail: t('owner.observability.requestsDetail', 'Recent request-log anomaly count.'),
        tags: [
          t('owner.observability.requests5xxTag', '5xx {value}', { value: formatMetricValue(requestLog.serverErrors, 'integer') }),
          t('owner.observability.requests401Tag', '401 {value}', { value: formatMetricValue(requestLog.unauthorized, 'integer') }),
        ],
      },
      {
        kicker: t('owner.observability.runtimeKicker', 'Runtime'),
        value: formatMetricValue(Number(runtimeCounts.degraded || 0) + Number(runtimeCounts.offline || 0), 'integer'),
        title: t('owner.observability.runtimeTitle', 'Degraded or offline services'),
        detail: t('owner.observability.runtimeDetail', 'Managed runtime supervision state.'),
        tags: [
          t('owner.observability.runtimeDegradedTag', 'degraded {value}', { value: formatMetricValue(runtimeCounts.degraded, 'integer') }),
          t('owner.observability.runtimeOfflineTag', 'offline {value}', { value: formatMetricValue(runtimeCounts.offline, 'integer') }),
        ],
      },
      {
        kicker: t('owner.observability.reconcileKicker', 'Reconcile'),
        value: formatMetricValue(reconcile.summary?.anomalies, 'integer'),
        title: t('owner.observability.reconcileTitle', 'Platform anomalies'),
        detail: t('owner.observability.reconcileDetail', 'Latest delivery reconcile findings and abuse heuristics.'),
        tags: [
          t('owner.observability.reconcileAbuseTag', 'abuse {value}', { value: formatMetricValue(reconcile.summary?.abuseFindings, 'integer') }),
          t('owner.observability.windowMinutesTag', 'window {value} min', { value: formatMetricValue(Math.round(Number(reconcile.summary?.windowMs || 0) / 60000), 'integer') }),
        ],
      },
    ]);

    renderSeriesCards();

    const reconcileItems = [
      ...(Array.isArray(reconcile.anomalies) ? reconcile.anomalies : []).map((item) => ({
        tone: item.severity === 'error' ? 'danger' : 'warning',
        title: item.type || 'anomaly',
        detail: `${item.code || '-'} | ${item.detail || ''}`.trim(),
        at: state.opsState?.lastReconcileAt || state.opsState?.updatedAt || state.observability?.generatedAt,
      })),
      ...(Array.isArray(reconcile.abuseFindings) ? reconcile.abuseFindings : []).map((item) => ({
        tone: 'warning',
        title: item.type || 'abuse-finding',
        detail: `${item.userId || item.itemId || '-'} | count=${item.count || '-'} threshold=${item.threshold || '-'}`,
        at: state.opsState?.lastReconcileAt || state.opsState?.updatedAt || state.observability?.generatedAt,
      })),
    ].slice(0, 12);

    renderList(
      document.getElementById('ownerReconcileFeed'),
      reconcileItems,
      (item) => [
        `<article class="timeline-item ${escapeHtml(item.tone || 'info')}">`,
        `<div class="feed-meta">${makePill(item.title || 'finding')} <span class="code">${escapeHtml(formatDateTime(item.at))}</span></div>`,
        `<strong>${escapeHtml(item.title || 'Finding')}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('owner.observability.reconcileEmpty', 'No reconcile anomalies or abuse signals right now.')
    );

    renderStats(document.getElementById('ownerOpsStateStats'), [
      {
        kicker: t('owner.observability.monitoringKicker', 'Monitoring'),
        value: state.opsState?.lastMonitoringAt ? t('owner.observability.stateRecent', 'recent') : t('owner.observability.stateIdle', 'idle'),
        title: t('owner.observability.monitoringTitle', 'Last monitoring cycle'),
        detail: state.opsState?.lastMonitoringAt
          ? formatDateTime(state.opsState.lastMonitoringAt)
          : t('owner.observability.monitoringEmpty', 'No monitoring cycle recorded yet.'),
      },
      {
        kicker: t('owner.observability.backupKicker', 'Backup'),
        value: state.opsState?.lastAutoBackupAt ? t('owner.observability.stateCreated', 'created') : t('owner.observability.statePending', 'pending'),
        title: t('owner.observability.backupTitle', 'Last auto backup'),
        detail: state.opsState?.lastAutoBackupAt
          ? formatDateTime(state.opsState.lastAutoBackupAt)
          : t('owner.observability.backupEmpty', 'No automatic backup recorded yet.'),
      },
      {
        kicker: t('owner.observability.reconcileKicker', 'Reconcile'),
        value: state.opsState?.lastReconcileAt ? t('owner.observability.stateRun', 'run') : t('owner.observability.statePending', 'pending'),
        title: t('owner.observability.reconcileCycleTitle', 'Last reconcile cycle'),
        detail: state.opsState?.lastReconcileAt
          ? formatDateTime(state.opsState.lastReconcileAt)
          : t('owner.observability.reconcileCycleEmpty', 'Reconcile has not run yet in ops state.'),
      },
      {
        kicker: t('owner.observability.alertsKicker', 'Alerts'),
        value: formatMetricValue(Object.keys(state.opsState?.lastAlertAtByKey || {}).length, 'integer'),
        title: t('owner.observability.alertsTitle', 'Tracked alert keys'),
        detail: t('owner.observability.alertsDetail', 'Cooldown state retained by the platform monitoring service.'),
      },
    ]);

    renderStats(document.getElementById('ownerAutomationStats'), [
      {
        kicker: t('owner.automation.lastCycle', 'Automation'),
        value: automation?.lastAutomationAt ? t('owner.automation.recent', 'recent') : t('owner.automation.idle', 'idle'),
        title: t('owner.automation.lastCycleTitle', 'Last automation cycle'),
        detail: automation?.lastAutomationAt
          ? formatDateTime(automation.lastAutomationAt)
          : t('owner.automation.lastCycleDetail', 'No automation cycle has been recorded yet.'),
      },
      {
        kicker: t('owner.automation.followup', 'Follow-up'),
        value: automation?.lastForcedMonitoringAt ? t('owner.automation.run', 'run') : t('owner.automation.pending', 'pending'),
        title: t('owner.automation.followupTitle', 'Last forced monitoring'),
        detail: automation?.lastForcedMonitoringAt
          ? formatDateTime(automation.lastForcedMonitoringAt)
          : t('owner.automation.followupDetail', 'No forced monitoring follow-up has been recorded yet.'),
      },
      {
        kicker: t('owner.automation.targets', 'Targets'),
        value: formatMetricValue(trackedRuntimeCount, 'integer'),
        title: t('owner.automation.targetsTitle', 'Tracked recovery runtimes'),
        detail: t('owner.automation.targetsDetail', 'Services with recorded automated recovery history or cooldown state.'),
      },
      {
        kicker: t('owner.automation.budget', 'Budget'),
        value: formatMetricValue(activeBudgetCount, 'integer'),
        title: t('owner.automation.budgetTitle', 'Active attempt windows'),
        detail: t('owner.automation.budgetDetail', 'Services currently carrying recovery-attempt counters in the active automation window.'),
      },
    ]);

    const automationPolicyWrap = document.getElementById('ownerAutomationPolicy');
    if (automationPolicyWrap) {
      automationPolicyWrap.innerHTML = automationPolicyTags.length > 0
        ? automationPolicyTags.join('')
        : makePill(t('owner.automation.policyUnknown', 'run a dry run to inspect policy'), 'neutral');
    }

    const automationFeedItems = automationActions.length > 0
      ? automationActions.map((action) => ({
          title: action.runtimeLabel || action.runtimeKey || action.serviceKey || t('owner.automation.action', 'Automation action'),
          detail: [
            action.serviceKey ? `${t('owner.automation.service', 'service')} ${action.serviceKey}` : '',
            action.reason ? `${t('owner.automation.reason', 'reason')} ${action.reason}` : '',
            latestAutomationReport?.dryRun === true ? t('owner.automation.dryRunResult', 'dry run') : '',
          ].filter(Boolean).join(' | '),
          at: action.at || latestAutomationReport?.generatedAt,
          ok: action.ok === true,
        }))
      : recoveryResults.map((row) => ({
          title: row.runtimeKey || row.serviceKey || t('owner.automation.action', 'Automation action'),
          detail: [
            row.serviceKey ? `${t('owner.automation.service', 'service')} ${row.serviceKey}` : '',
            row.status ? `${t('owner.automation.status', 'status')} ${row.status}` : '',
            row.reason ? `${t('owner.automation.reason', 'reason')} ${row.reason}` : '',
          ].filter(Boolean).join(' | '),
          at: row.at,
          ok: row.ok === true,
        }));

    renderList(
      document.getElementById('ownerAutomationFeed'),
      automationFeedItems.slice(0, 10),
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.ok ? t('owner.automation.resultOk', 'ok') : t('owner.automation.resultFailed', 'failed'), item.ok ? 'success' : 'danger')} <span class="code">${escapeHtml(formatDateTime(item.at))}</span></div>`,
        `<strong>${escapeHtml(item.title || t('owner.automation.action', 'Automation action'))}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('owner.automation.feedEmpty', 'No automation recovery history yet.')
    );

    renderTable(document.getElementById('ownerObservabilityRequestTable'), {
      emptyText: 'No recent requests in observability snapshot.',
      columns: [
        {
          label: 'Request',
          render: (row) => [
            `<strong>${escapeHtml(row.method || 'GET')} ${escapeHtml(row.path || '-')}</strong>`,
            row.requestId ? `<div class="muted code">${escapeHtml(row.requestId)}</div>` : '',
          ].join(''),
        },
        {
          label: 'Status',
          render: (row) => makePill(String(row.statusCode || '-'), Number(row.statusCode || 0) >= 500 ? 'danger' : Number(row.statusCode || 0) >= 400 ? 'warning' : 'success'),
        },
        {
          label: 'Latency',
          render: (row) => `${formatMetricValue(row.latencyMs, 'integer')} ms`,
        },
        {
          label: 'Actor',
          render: (row) => [
            `<div>${escapeHtml(row.user || row.authMode || 'anonymous')}</div>`,
            `<div class="muted">${escapeHtml(row.ip || '-')}</div>`,
          ].join(''),
        },
        {
          label: 'Time',
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.at))}</span>`,
        },
      ],
      rows: Array.isArray(data.recentRequests) ? data.recentRequests.slice(0, 12) : [],
    });
  }

  function renderCommercial() {
    const plans = Array.isArray(state.overview?.plans)
      ? state.overview.plans
      : Array.isArray(state.overview?.publicOverview?.billing?.plans)
        ? state.overview.publicOverview.billing.plans
        : [];
    const marketplace = state.marketplaceOffers.slice(0, 12);
    const quotaRows = buildQuotaPressureRows();
    const subscriptionsByStatus = state.subscriptions.reduce((map, row) => {
      const key = String(row?.status || 'unknown').trim() || 'unknown';
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());
    const pressuredTenants = quotaRows.filter((row) => row.hot.length > 0).length;

    renderStats(document.getElementById('ownerCommercialStats'), [
      {
        kicker: t('owner.commercial.plansKicker', 'Plans'),
        value: formatNumber(plans.length, '0'),
        title: t('owner.commercial.plansTitle', 'Cataloged billing plans'),
        detail: t('owner.commercial.plansDetail', 'Long-lived plan definitions used by tenant subscriptions and allowance snapshots.'),
        tags: plans.slice(0, 3).map((plan) => plan.id || plan.name || '-'),
      },
      {
        kicker: t('owner.commercial.subscriptionsKicker', 'Subscriptions'),
        value: formatNumber(state.subscriptions.length, '0'),
        title: t('owner.commercial.subscriptionsTitle', 'Tracked tenant subscriptions'),
        detail: t('owner.commercial.subscriptionsDetail', 'Lifecycle view across trialing, active, paused, and past-due tenant agreements.'),
        tags: Array.from(subscriptionsByStatus.entries()).slice(0, 3).map(([key, count]) => `${key} ${count}`),
      },
      {
        kicker: t('owner.commercial.marketplaceKicker', 'Marketplace'),
        value: formatNumber(marketplace.length, '0'),
        title: t('owner.commercial.marketplaceTitle', 'Visible extension offers'),
        detail: t('owner.commercial.marketplaceDetail', 'Tenant-facing offers for commercial upsell, extensions, and service bundles.'),
        tags: [
          t('owner.commercial.draftTag', 'draft {value}', { value: formatNumber(marketplace.filter((row) => row.status === 'draft').length, '0') }),
          t('owner.commercial.activeTag', 'active {value}', { value: formatNumber(marketplace.filter((row) => row.status === 'active').length, '0') }),
        ],
      },
      {
        kicker: t('owner.commercial.quotaKicker', 'Quota'),
        value: formatNumber(pressuredTenants, '0'),
        title: t('owner.commercial.quotaTitle', 'Tenants under quota pressure'),
        detail: t('owner.commercial.quotaDetail', 'Top visible tenants where allowance usage is nearing or exceeding plan limits.'),
        tags: [
          t('owner.commercial.sampleTag', 'sample {value}', { value: formatNumber(state.tenantQuotaSnapshots.length, '0') }),
          t('owner.commercial.pressuredTag', 'pressured {value}', { value: formatNumber(pressuredTenants, '0') }),
        ],
      },
    ]);

    renderTable(document.getElementById('ownerPlanTable'), {
      emptyText: t('owner.commercial.planEmpty', 'No plan catalog entries found.'),
      columns: [
        {
          label: t('owner.commercial.tablePlan', 'Plan'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.id || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.id || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.commercial.tableBilling', 'Billing'),
          render: (row) => escapeHtml(row.billingCycle || '-'),
        },
        {
          label: t('owner.commercial.tableQuotas', 'Quotas'),
          render: (row) => `<div class="muted">${escapeHtml(summarizePlanQuotas(row))}</div>`,
        },
      ],
      rows: plans,
    });

    renderList(
      document.getElementById('ownerQuotaFeed'),
      quotaRows,
      (row) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(row.planName || 'plan', 'info')} <span class="code">${escapeHtml(row.tenantId || '-')}</span></div>`,
          `<strong>${escapeHtml(row.tenantName || t('owner.commercial.tenantLabel', 'Tenant'))}</strong>`,
        row.hot.length
          ? `<div class="tag-row">${row.hot.slice(0, 4).map(([key, value]) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
              return makePill(`${label} ${summarizeQuotaEntry(value)}`, quotaEntryTone(value));
            }).join('')}</div>`
          : `<div class="muted">${escapeHtml(t('owner.commercial.noQuotaPressure', 'No active quota pressure in the sampled allowance set.'))}</div>`,
        '</article>',
      ].join(''),
      t('owner.commercial.quotaEmpty', 'No quota pressure found in the sampled tenant allowance set.')
    );

    const permissionCatalog = Array.isArray(state.overview?.permissionCatalog)
      ? state.overview.permissionCatalog
      : [];

    renderTable(document.getElementById('ownerPermissionCatalogTable'), {
      emptyText: t('owner.commercial.permissionCatalogEmpty', 'No permission catalog entries found.'),
      shellClass: 'compact-scroll catalog-table',
      columns: [
        {
          label: t('owner.commercial.tableScopeGroup', 'Scope Group'),
          render: (row) => [
            `<strong>${escapeHtml(row.title || row.key || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.key || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.commercial.tableScopes', 'Scopes'),
          render: (row) => escapeHtml(Array.isArray(row.scopes) ? row.scopes.join(', ') : '-'),
        },
      ],
      rows: permissionCatalog,
    });

    renderTable(document.getElementById('ownerMarketplaceTable'), {
      emptyText: t('owner.commercial.marketplaceEmpty', 'No marketplace offers found.'),
      columns: [
        {
          label: t('owner.commercial.tableOffer', 'Offer'),
          render: (row) => [
            `<strong>${escapeHtml(row.title || row.id || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.id || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.commercial.tableTenant', 'Tenant'),
          render: (row) => escapeHtml(row.tenantName || row.tenantId || '-'),
        },
        {
          label: t('owner.commercial.tableStatus', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('owner.commercial.tablePrice', 'Price'),
          render: (row) => escapeHtml(`${formatNumber(row.priceCents, '0')} ${row.currency || ''}`.trim()),
        },
      ],
      rows: marketplace,
    });

    document.getElementById('ownerCommercialNotes').innerHTML = [
      {
        title: t('owner.commercial.noteSeparationTitle', 'Commercial separation'),
        text: t('owner.commercial.noteSeparationText', 'Billing lifecycle and plan allowances stay in the owner console so tenants can see their plan posture without editing global plan definitions.'),
      },
      {
        title: t('owner.commercial.noteExtensionTitle', 'Extension readiness'),
        text: t('owner.commercial.noteExtensionText', 'Marketplace offers act as a scalable extension surface without changing the tenant runtime contract or introducing a new plugin engine.'),
      },
      {
        title: t('owner.commercial.noteGovernanceTitle', 'Permission governance'),
        text: t('owner.commercial.noteGovernanceText', 'Scope-group visibility keeps API, webhook, and future extension access aligned with the existing role and tenant separation model.'),
      },
    ].map((card) => [
      '<article class="kv-card">',
      `<h4>${escapeHtml(card.title)}</h4>`,
      `<p>${escapeHtml(card.text)}</p>`,
      '</article>',
    ].join('')).join('');
  }

  function renderNotifications() {
    renderList(
      document.getElementById('ownerNotificationFeed'),
      buildIncidentItems(),
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.severity || 'info')} <span class="code">${escapeHtml(item.source || 'ops')}</span></div>`,
        `<strong>${escapeHtml(item.title || 'Incident')}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.time))}</span></div>`,
        '</article>',
      ].join(''),
      t('owner.notifications.empty', 'No open incidents.')
    );
  }

  function renderRequestFeed() {
    renderList(
      document.getElementById('ownerRequestFeed'),
      Array.isArray(state.requestLogs?.items) ? state.requestLogs.items.slice(0, 8) : [],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.statusCode >= 500 ? 'error' : 'warning')} <span class="code">${escapeHtml(item.method || 'GET')}</span></div>`,
        `<strong>${escapeHtml(item.path || item.routeGroup || item.requestId || 'request')}</strong>`,
        `<div class="muted">${escapeHtml(`${item.statusCode || '-'} ${item.error || item.summary || ''}`.trim())}</div>`,
        `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.at || item.createdAt))}</span></div>`,
        '</article>',
      ].join(''),
      'No recent request anomalies.'
    );
  }

  function rotationStatusTone(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'ready') return 'success';
    if (normalized === 'unused') return 'neutral';
    if (normalized === 'placeholder') return 'warning';
    return 'danger';
  }

  function rotationStatusLabel(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'ready') return t('owner.rotation.ready', 'ready');
    if (normalized === 'unused') return t('owner.rotation.unused', 'unused');
    if (normalized === 'placeholder') return t('owner.rotation.placeholder', 'placeholder');
    return t('owner.rotation.missing', 'missing');
  }

  function renderSecurity() {
    renderList(
      document.getElementById('ownerSecurityFeed'),
      state.securityEvents,
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.severity || 'info')} ${item.type ? `<span class="code">${escapeHtml(item.type)}</span>` : ''}</div>`,
        `<strong>${escapeHtml(item.detail || item.reason || 'Security event')}</strong>`,
        `<div class="muted">${escapeHtml(item.actor || item.targetUser || 'system')}</div>`,
        `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.createdAt || item.at))}</span></div>`,
        '</article>',
      ].join(''),
      'No recent security events.'
    );

    const summary = state.roleMatrix?.summary || {};
    const permissions = Array.isArray(state.roleMatrix?.permissions) ? state.roleMatrix.permissions.length : 0;
    document.getElementById('ownerPolicyCards').innerHTML = [
      {
        title: t('owner.security.roleMatrixTitle', 'Role Matrix'),
        text: t('owner.security.roleMatrixText', 'Visible permission entries: {count}. Use the owner surface for role posture, elevated access review, and security-sensitive controls.', { count: formatNumber(permissions, '0') }),
      },
      {
        title: t('owner.security.tenantSeparationTitle', 'Tenant Separation'),
        text: t('owner.security.tenantSeparationText', 'Tenant-scoped admins are redirected into /tenant. Owner-only views keep platform security and governance outside the tenant workflow.'),
      },
      {
        title: t('owner.security.sessionStepupTitle', 'Session + Step-up'),
        text: t('owner.security.sessionStepupText', 'Role matrix summary loaded. Step-up and session policy stay inside the owner security and access pages.'),
      },
    ].map((card) => [
      '<article class="panel-card">',
      `<h3>${escapeHtml(card.title)}</h3>`,
      `<p>${escapeHtml(card.text)}</p>`,
      summary.roles ? `<div class="tag-row">${Object.keys(summary.roles).slice(0, 4).map((role) => makePill(role, 'info')).join('')}</div>` : '',
      '</article>',
    ].join('')).join('');

    const rotationReport = state.rotationReport || { data: { secrets: [], reloadMatrix: [] }, warnings: [], errors: [] };
    const rotationSecrets = Array.isArray(rotationReport?.data?.secrets) ? rotationReport.data.secrets : [];
    const rotationReload = Array.isArray(rotationReport?.data?.reloadMatrix) ? rotationReport.data.reloadMatrix : [];
    const rotationRequired = rotationSecrets.filter((row) => row.required).length;
    const rotationReady = rotationSecrets.filter((row) => row.required && row.status === 'ready').length;
    renderStats(document.getElementById('ownerRotationStats'), [
      {
        kicker: t('owner.rotation.summaryRequired', 'Required'),
        title: formatNumber(rotationRequired, '0'),
        detail: t('owner.rotation.summaryRequiredDetail', '{count} ready required secrets', { count: formatNumber(rotationReady, '0') }),
      },
      {
        kicker: t('owner.rotation.summaryReloadTargets', 'Reload'),
        title: formatNumber(rotationReload.length, '0'),
        detail: t('owner.rotation.summaryReloadTargetsDetail', 'Runtime targets after rotation'),
      },
      {
        kicker: t('owner.rotation.summaryWarnings', 'Warnings'),
        title: formatNumber(rotationReport?.warnings?.length || 0, '0'),
        detail: t('owner.rotation.summaryWarningsDetail', 'Validation drift that still needs review'),
      },
      {
        kicker: t('owner.rotation.summaryErrors', 'Errors'),
        title: formatNumber(rotationReport?.errors?.length || 0, '0'),
        detail: t('owner.rotation.summaryErrorsDetail', 'Blocking issues before reopen'),
      },
    ]);

    renderTable(document.getElementById('ownerRotationMatrix'), {
      emptyText: t('owner.rotation.emptyMatrix', 'No secret rotation entries reported.'),
      shellClass: 'compact-scroll',
      columns: [
        {
          label: t('owner.rotation.secret', 'Secret'),
          render: (row) => [
            `<strong>${escapeHtml(row.id || '-')}</strong>`,
            row.label ? `<div class="muted">${escapeHtml(row.label)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.rotation.status', 'Status'),
          render: (row) => [
            makePill(rotationStatusLabel(row.status), rotationStatusTone(row.status)),
            row.required ? makePill(t('owner.rotation.required', 'required'), 'info') : '',
          ].filter(Boolean).join(' '),
        },
        {
          label: t('owner.rotation.reload', 'Reload Targets'),
          render: (row) => Array.isArray(row.reloadTargets) && row.reloadTargets.length > 0
            ? row.reloadTargets.map((item) => makePill(item, 'neutral')).join(' ')
            : '-',
        },
        {
          label: t('owner.rotation.validation', 'Validation'),
          render: (row) => Array.isArray(row.validation) && row.validation.length > 0
            ? `<div class="muted">${escapeHtml(row.validation.join(' | '))}</div>`
            : '-',
        },
      ],
      rows: rotationSecrets,
    });

    renderList(
      document.getElementById('ownerRotationIssues'),
      [
        ...(Array.isArray(rotationReport?.errors) ? rotationReport.errors.map((message) => ({ level: 'error', message })) : []),
        ...(Array.isArray(rotationReport?.warnings) ? rotationReport.warnings.map((message) => ({ level: 'warning', message })) : []),
      ],
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.level === 'error' ? t('owner.rotation.issueCritical', 'critical') : t('owner.rotation.issueWarning', 'warning'), item.level === 'error' ? 'danger' : 'warning')}</div>`,
        `<strong>${escapeHtml(item.message || '-')}</strong>`,
        '<div class="muted">secret-rotation-check</div>',
        '</article>',
      ].join(''),
      t('owner.rotation.emptyIssues', 'No active rotation drift found.'),
    );

    renderTable(document.getElementById('ownerDeviceTable'), {
      emptyText: t('owner.security.deviceEmpty', 'No recent request footprints available.'),
      shellClass: 'compact-scroll',
      columns: [
        {
          label: t('owner.security.tableActor', 'Actor'),
          render: (row) => [
            `<strong>${escapeHtml(row.user || '-')}</strong>`,
            `<div class="muted">${escapeHtml(row.role || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.security.tableDevice', 'Device'),
          render: (row) => [
            `<div>${escapeHtml(row.deviceLabel || t('owner.security.unknownDevice', 'Unknown device'))}</div>`,
            row.userAgent ? `<div class="muted">${escapeHtml(row.userAgent)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.security.tableIp', 'IP'),
          render: (row) => `<span class="code">${escapeHtml(row.ip || '-')}</span>`,
        },
        {
          label: t('owner.security.tableSeen', 'Seen'),
          render: (row) => [
            `<div>${escapeHtml(formatDateTime(row.lastSeenAt))}</div>`,
            `<div class="muted">${escapeHtml(t('owner.security.hitsValue', '{count} hits', { count: formatMetricValue(row.hits, 'integer') }))}</div>`,
          ].join(''),
        },
      ],
      rows: buildDeviceRows(state.observability?.recentRequests || []),
    });

    renderTable(document.getElementById('ownerPermissionTable'), {
      emptyText: t('owner.security.permissionEmpty', 'No permission matrix entries found.'),
      shellClass: 'compact-scroll policy-table',
      columns: [
        {
          label: t('owner.security.tablePath', 'Path'),
          render: (row) => `<span class="code">${escapeHtml(row.path || '-')}</span>`,
        },
        {
          label: t('owner.security.tablePermission', 'Permission'),
          render: (row) => escapeHtml(row.permission || '-'),
        },
        {
          label: t('owner.security.tableRole', 'Role'),
          render: (row) => makePill(row.minRole || 'mod', row.minRole === 'owner' ? 'danger' : row.minRole === 'admin' ? 'warning' : 'info'),
        },
        {
          label: t('owner.security.tableFlags', 'Flags'),
          render: (row) => [
            makePill(row.category || 'general', 'neutral'),
            row.stepUp ? makePill(t('owner.security.stepUp', 'step-up'), 'warning') : '',
          ].filter(Boolean).join(' '),
        },
      ],
      rows: Array.isArray(state.roleMatrix?.permissions) ? state.roleMatrix.permissions.slice(0, 24) : [],
    });
  }

  function renderAccessCenter() {
    renderTable(document.getElementById('ownerSessionsTable'), {
      emptyText: t('owner.access.sessionsEmpty', 'No admin sessions reported.'),
      columns: [
        {
          label: t('owner.access.tableSession', 'Session'),
          render: (row) => [
            `<strong>${escapeHtml(row.username || row.user || row.actor || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.id || row.sessionId || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.access.tableRole', 'Role'),
          render: (row) => makePill(row.role || 'unknown'),
        },
        {
          label: t('owner.access.tableTenant', 'Tenant'),
          render: (row) => escapeHtml(row.tenantId || t('owner.access.globalTenant', 'global')),
        },
        {
          label: t('owner.access.tableUpdated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.lastSeenAt || row.createdAt))}</span>`,
        },
      ],
      rows: state.sessions.slice(0, 16),
    });

    renderTable(document.getElementById('ownerUsersTable'), {
      emptyText: t('owner.access.usersEmpty', 'No admin users found.'),
      columns: [
        {
          label: t('owner.access.tableUser', 'User'),
          render: (row) => [
            `<strong>${escapeHtml(row.username || row.user || '-')}</strong>`,
            row.id ? `<div class="muted code">${escapeHtml(row.id)}</div>` : '',
          ].join(''),
        },
        {
          label: t('owner.access.tableRole', 'Role'),
          render: (row) => makePill(row.role || 'unknown'),
        },
        {
          label: t('owner.access.tableTenant', 'Tenant'),
          render: (row) => escapeHtml(row.tenantId || t('owner.access.globalTenant', 'global')),
        },
        {
          label: t('owner.access.tableStatus', 'Status'),
          render: (row) => makePill(row.isActive === false ? t('owner.access.inactive', 'inactive') : t('owner.access.active', 'active')),
        },
      ],
      rows: state.users.slice(0, 16),
    });
  }

  function renderAudit() {
    const dataset = state.audit || {};
    const filters = state.auditFilters || {};
    const form = document.getElementById('ownerAuditQueryForm');
    if (form) {
      form.elements.view.value = filters.view || 'wallet';
      form.elements.userId.value = filters.userId || '';
      form.elements.query.value = filters.query || '';
      form.elements.windowMs.value = filters.windowMs == null ? '' : String(filters.windowMs);
    }

    renderStats(
      document.getElementById('ownerAuditStats'),
      (Array.isArray(dataset.cards) ? dataset.cards : []).map(([label, value]) => ({
        kicker: String(dataset.view || 'audit').toUpperCase(),
        value: String(value ?? '-'),
        title: String(label || t('owner.audit.summaryTitle', 'Audit summary')),
        detail: t('owner.audit.summaryDetail', 'Returned {returned} of {total} rows.', {
          returned: formatMetricValue(dataset.returned, 'integer'),
          total: formatMetricValue(dataset.total, 'integer'),
        }),
      }))
    );

    const rows = Array.isArray(dataset.tableRows) ? dataset.tableRows : [];
    const keys = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];
    renderTable(document.getElementById('ownerAuditTable'), {
      emptyText: t('owner.audit.empty', 'No audit rows matched the current filters.'),
      columns: keys.map((key) => ({
        label: key,
        render: (row) => `<span class="${/(?:id|code|reference)/i.test(key) ? 'code' : ''}">${escapeHtml(formatAuditCell(key, row?.[key]))}</span>`,
      })),
      rows,
    });
  }

  function renderRecovery() {
    const restore = state.restoreState || {};
    const phase = getRestorePhasePresentation(restore, state.restorePreview);
    const warnings = Array.isArray(restore.warnings) ? restore.warnings.length : 0;
    const verificationReady = restore.verification?.ready === true;
    renderStats(document.getElementById('ownerRestoreStateStats'), [
      {
        kicker: t('owner.recovery.phaseKicker', 'Phase'),
        value: phase.label,
        title: t('owner.recovery.phaseTitle', 'Restore lifecycle'),
        detail: restore.lastError || phase.detail,
        tags: [
          t('owner.recovery.rollbackTag', 'rollback {value}', { value: restore.rollbackStatus || 'none' }),
          t('owner.recovery.warningsTag', 'warnings {count}', { count: formatNumber(warnings, '0') }),
        ],
      },
      {
        kicker: t('owner.recovery.backupKicker', 'Backup'),
        value: restore.backup || 'none',
        title: t('owner.recovery.backupTitle', 'Target backup'),
        detail: restore.startedAt
          ? t('owner.recovery.backupStarted', 'Started {time}', { time: formatDateTime(restore.startedAt) })
          : t('owner.recovery.backupDetail', 'No restore currently running.'),
      },
      {
        kicker: t('owner.recovery.previewKicker', 'Preview'),
        value: restore.previewBackup || state.restorePreview?.backup || 'none',
        title: t('owner.recovery.previewTitle', 'Latest preview source'),
        detail: restore.previewExpiresAt
          ? t('owner.recovery.previewExpires', 'Preview expires {time}', { time: formatDateTime(restore.previewExpiresAt) })
          : t('owner.recovery.previewDetail', 'Run a dry-run preview before using the full recovery workbench.'),
      },
      {
        kicker: t('owner.recovery.verificationKicker', 'Verification'),
        value: verificationReady
          ? t('owner.recovery.verificationReady', 'Ready')
          : t('owner.recovery.verificationPending', 'Pending'),
        title: t('owner.recovery.verificationTitle', 'Latest verification state'),
        detail: restore.verification?.checkedAt
          ? t('owner.recovery.verificationChecked', 'Checked {time}', { time: formatDateTime(restore.verification.checkedAt) })
          : t('owner.recovery.verificationDetail', 'Verification has not run in this restore cycle yet.'),
      },
    ]);

    renderTable(document.getElementById('ownerBackupTable'), {
      emptyText: t('owner.recovery.backupEmptyTable', 'No backup files found.'),
      columns: [
        {
          label: t('owner.recovery.tableBackup', 'Backup'),
          render: (row) => [
            `<strong>${escapeHtml(row.id || row.file || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.file || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('owner.recovery.tableSize', 'Size'),
          render: (row) => `${formatNumber(Math.round(Number(row.sizeBytes || 0) / 1024), '0')} KB`,
        },
        {
          label: t('owner.recovery.tableUpdated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</span>`,
        },
      ],
      rows: state.backupFiles.slice(0, 18),
    });

    const backupSelect = document.getElementById('ownerBackupSelect');
    if (backupSelect) {
      const current = String(backupSelect.value || '').trim();
      const options = [
        `<option value="">${escapeHtml(t('owner.recovery.chooseBackup', 'Choose a backup'))}</option>`,
        ...state.backupFiles.map((row) => {
          const file = String(row.file || row.id || '').trim();
          const selected = file && file === current ? ' selected' : '';
          return `<option value="${escapeHtml(file)}"${selected}>${escapeHtml(file)} | ${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</option>`;
        }),
      ];
      backupSelect.innerHTML = options.join('');
      if (current && state.backupFiles.some((row) => String(row.file || row.id || '').trim() === current)) {
        backupSelect.value = current;
      }
    }

    const previewWrap = document.getElementById('ownerBackupPreviewResult');
    const preview = state.restorePreview;
    if (!previewWrap) return;
    if (!preview) {
      previewWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('owner.recovery.previewEmpty', 'Run a dry-run restore preview to inspect counts, warnings, and verification checks.'))}</div>`;
      return;
    }

    const warningItems = Array.isArray(preview.warnings) ? preview.warnings : [];
    const verificationChecks = Array.isArray(preview.verificationPlan?.checks) ? preview.verificationPlan.checks : [];
    previewWrap.innerHTML = [
      '<article class="panel-card">',
      `<h3>${escapeHtml(preview.backup || t('owner.recovery.previewTitleFallback', 'Restore preview'))}</h3>`,
      `<p>${escapeHtml(preview.note || t('owner.recovery.previewGenerated', 'Dry-run preview generated from the selected backup.'))}</p>`,
      `<div class="tag-row">${[
        t('owner.recovery.schemaTag', 'schema {value}', { value: preview.schemaVersion || '-' }),
        preview.compatibilityMode || 'current',
        preview.previewExpiresAt ? t('owner.recovery.expiresTag', 'expires {value}', { value: formatDateTime(preview.previewExpiresAt) }) : t('owner.recovery.previewReadyTag', 'preview ready'),
      ].map((tag) => makePill(tag, 'info')).join('')}</div>`,
      '</article>',
      '<article class="panel-card">',
      `<h3>${escapeHtml(t('owner.recovery.previewCounts', 'Preview Counts'))}</h3>`,
      `<div class="tag-row">${[
        t('owner.recovery.targetGroupsTag', 'target {value} groups', { value: formatNumber(Object.keys(preview.counts || {}).length, '0') }),
        t('owner.recovery.currentGroupsTag', 'current {value} groups', { value: formatNumber(Object.keys(preview.currentCounts || {}).length, '0') }),
        t('owner.recovery.warningsCountTag', 'warnings {value}', { value: formatNumber(warningItems.length, '0') }),
      ].map((tag) => makePill(tag)).join('')}</div>`,
      warningItems.length
        ? `<div class="list-feed">${warningItems.slice(0, 6).map((item) => `<article class="feed-item"><strong>${escapeHtml(item)}</strong></article>`).join('')}</div>`
        : `<div class="empty-state">${escapeHtml(t('owner.recovery.noPreviewWarnings', 'No preview warnings.'))}</div>`,
      '</article>',
      '<article class="panel-card">',
      `<h3>${escapeHtml(t('owner.recovery.verificationPlan', 'Verification Plan'))}</h3>`,
      verificationChecks.length
        ? `<div class="list-feed">${verificationChecks.slice(0, 8).map((item) => [
            '<article class="feed-item">',
            `<strong>${escapeHtml(item.label || item.id || t('owner.recovery.checkFallback', 'check'))}</strong>`,
            item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
            '</article>',
          ].join('')).join('')}</div>`
        : `<div class="empty-state">${escapeHtml(t('owner.recovery.noVerificationEntries', 'No verification plan entries were returned.'))}</div>`,
      '</article>',
    ].join('');
  }

  function fillOwnerConfigForms() {
    const runtimeForm = document.getElementById('ownerRuntimeFlagsForm');
    if (runtimeForm) {
      runtimeForm.elements.DISCORD_GUILD_ID.value = getControlEnvValue('root', 'DISCORD_GUILD_ID', '');
      runtimeForm.elements.DELIVERY_EXECUTION_MODE.value = getControlEnvValue('root', 'DELIVERY_EXECUTION_MODE', 'rcon') || 'rcon';
      runtimeForm.elements.BOT_ENABLE_ADMIN_WEB.value = getControlEnvValue('root', 'BOT_ENABLE_ADMIN_WEB', 'true') || 'true';
      runtimeForm.elements.BOT_ENABLE_DELIVERY_WORKER.value = getControlEnvValue('root', 'BOT_ENABLE_DELIVERY_WORKER', 'false') || 'false';
      runtimeForm.elements.WORKER_ENABLE_DELIVERY.value = getControlEnvValue('root', 'WORKER_ENABLE_DELIVERY', 'true') || 'true';
      runtimeForm.elements.BOT_ENABLE_SCUM_WEBHOOK.value = getControlEnvValue('root', 'BOT_ENABLE_SCUM_WEBHOOK', 'true') || 'true';
      runtimeForm.elements.SCUM_WATCHER_ENABLED.value = getControlEnvValue('root', 'SCUM_WATCHER_ENABLED', 'true') || 'true';
    }

    const portalForm = document.getElementById('ownerPortalAccessForm');
    if (portalForm) {
      portalForm.elements.WEB_PORTAL_BASE_URL.value = getControlEnvValue('portal', 'WEB_PORTAL_BASE_URL', '');
      portalForm.elements.WEB_PORTAL_PLAYER_OPEN_ACCESS.value = getControlEnvValue('portal', 'WEB_PORTAL_PLAYER_OPEN_ACCESS', 'false') || 'false';
      portalForm.elements.WEB_PORTAL_REQUIRE_GUILD_MEMBER.value = getControlEnvValue('portal', 'WEB_PORTAL_REQUIRE_GUILD_MEMBER', 'true') || 'true';
      portalForm.elements.ADMIN_WEB_2FA_ENABLED.value = getControlEnvValue('root', 'ADMIN_WEB_2FA_ENABLED', 'true') || 'true';
      portalForm.elements.ADMIN_WEB_STEP_UP_ENABLED.value = getControlEnvValue('root', 'ADMIN_WEB_STEP_UP_ENABLED', 'true') || 'true';
      portalForm.elements.WEB_PORTAL_SECURE_COOKIE.value = getControlEnvValue('portal', 'WEB_PORTAL_SECURE_COOKIE', 'true') || 'true';
      portalForm.elements.ADMIN_WEB_ALLOWED_ORIGINS.value = getControlEnvValue('root', 'ADMIN_WEB_ALLOWED_ORIGINS', '');
    }

    const rconForm = document.getElementById('ownerRconAgentForm');
    if (rconForm) {
      rconForm.elements.RCON_HOST.value = getControlEnvValue('root', 'RCON_HOST', '');
      rconForm.elements.RCON_PORT.value = getControlEnvValue('root', 'RCON_PORT', '');
      rconForm.elements.RCON_PROTOCOL.value = getControlEnvValue('root', 'RCON_PROTOCOL', '');
      rconForm.elements.SCUM_CONSOLE_AGENT_BASE_URL.value = getControlEnvValue('root', 'SCUM_CONSOLE_AGENT_BASE_URL', '');
      rconForm.elements.SCUM_CONSOLE_AGENT_REQUIRED.value = getControlEnvValue('root', 'SCUM_CONSOLE_AGENT_REQUIRED', 'false') || 'false';
      rconForm.elements.RCON_PASSWORD.value = '';
      rconForm.elements.SCUM_CONSOLE_AGENT_TOKEN.value = '';
    }

    const securityForm = document.getElementById('ownerSecurityPolicyForm');
    if (securityForm) {
      securityForm.elements.ADMIN_WEB_SESSION_TTL_HOURS.value = getControlEnvValue('root', 'ADMIN_WEB_SESSION_TTL_HOURS', '');
      securityForm.elements.ADMIN_WEB_SESSION_IDLE_MINUTES.value = getControlEnvValue('root', 'ADMIN_WEB_SESSION_IDLE_MINUTES', '');
      securityForm.elements.ADMIN_WEB_SESSION_MAX_PER_USER.value = getControlEnvValue('root', 'ADMIN_WEB_SESSION_MAX_PER_USER', '');
      securityForm.elements.ADMIN_WEB_LOGIN_WINDOW_MS.value = getControlEnvValue('root', 'ADMIN_WEB_LOGIN_WINDOW_MS', '');
      securityForm.elements.ADMIN_WEB_LOGIN_MAX_ATTEMPTS.value = getControlEnvValue('root', 'ADMIN_WEB_LOGIN_MAX_ATTEMPTS', '');
      securityForm.elements.ADMIN_WEB_LOGIN_SPIKE_WINDOW_MS.value = getControlEnvValue('root', 'ADMIN_WEB_LOGIN_SPIKE_WINDOW_MS', '');
      securityForm.elements.ADMIN_WEB_LOGIN_SPIKE_THRESHOLD.value = getControlEnvValue('root', 'ADMIN_WEB_LOGIN_SPIKE_THRESHOLD', '');
      securityForm.elements.ADMIN_WEB_LOGIN_SPIKE_IP_THRESHOLD.value = getControlEnvValue('root', 'ADMIN_WEB_LOGIN_SPIKE_IP_THRESHOLD', '');
      securityForm.elements.ADMIN_WEB_LOGIN_SPIKE_ALERT_COOLDOWN_MS.value = getControlEnvValue('root', 'ADMIN_WEB_LOGIN_SPIKE_ALERT_COOLDOWN_MS', '');
    }

    const monitoringForm = document.getElementById('ownerMonitoringPolicyForm');
    if (monitoringForm) {
      monitoringForm.elements.DELIVERY_QUEUE_ALERT_THRESHOLD.value = getControlEnvValue('root', 'DELIVERY_QUEUE_ALERT_THRESHOLD', '');
      monitoringForm.elements.DELIVERY_FAIL_RATE_ALERT_THRESHOLD.value = getControlEnvValue('root', 'DELIVERY_FAIL_RATE_ALERT_THRESHOLD', '');
      monitoringForm.elements.SCUM_QUEUE_ALERT_THRESHOLD.value = getControlEnvValue('root', 'SCUM_QUEUE_ALERT_THRESHOLD', '');
      monitoringForm.elements.SCUM_ALERT_COOLDOWN_MS.value = getControlEnvValue('root', 'SCUM_ALERT_COOLDOWN_MS', '');
      monitoringForm.elements.SCUM_WEBHOOK_ERROR_ALERT_THRESHOLD.value = getControlEnvValue('root', 'SCUM_WEBHOOK_ERROR_ALERT_THRESHOLD', '');
      monitoringForm.elements.SCUM_WEBHOOK_ERROR_ALERT_MIN_ATTEMPTS.value = getControlEnvValue('root', 'SCUM_WEBHOOK_ERROR_ALERT_MIN_ATTEMPTS', '');
      monitoringForm.elements.SCUM_WEBHOOK_ERROR_ALERT_WINDOW_MS.value = getControlEnvValue('root', 'SCUM_WEBHOOK_ERROR_ALERT_WINDOW_MS', '');
    }

    const opsLogLanguageForm = document.getElementById('ownerOpsLogLanguageForm');
    if (opsLogLanguageForm) {
      opsLogLanguageForm.elements.ADMIN_LOG_LANGUAGE.value =
        getControlEnvValue('root', 'ADMIN_LOG_LANGUAGE', 'th') || 'th';
    }
  }

  async function saveControlEnvPatch(patch, contextLabel) {
    const response = await api('/admin/api/control-panel/env', {
      method: 'POST',
      body: patch,
    });
    const reloadRequired = response?.reloadRequired === true;
    const restartTarget = String(document.getElementById('ownerRestartTarget')?.value || '').trim();
    let restarted = false;
    if (reloadRequired && restartTarget) {
      const services = restartTarget === 'all'
        ? (Array.isArray(state.controlPanelSettings?.managedServices)
          ? state.controlPanelSettings.managedServices.map((row) => row.key).filter(Boolean)
          : [])
        : [restartTarget];
      if (services.length > 0) {
        await api('/admin/api/runtime/restart-service', {
          method: 'POST',
          body: services.length === 1 ? { service: services[0] } : { services },
        });
        restarted = true;
      }
    }
    state.controlApplyResult = {
      contextLabel,
      changedCount: Number(response?.applySummary?.totalChanged || 0),
      restartRequired: response?.reloadRequired === true,
      restarted,
      rollback: false,
      changedFiles: Array.isArray(response?.applySummary?.changedFiles) ? response.applySummary.changedFiles : [],
      restartRequiredCount: Number(response?.applySummary?.restartRequiredCount || 0),
      reloadSafeCount: Number(response?.applySummary?.reloadSafeCount || 0),
      appliedAt: new Date().toISOString(),
    };
    renderControlCenter();
    showToast(
      reloadRequired
        ? (restarted
          ? t('owner.toast.controlSavedRestarted', '{context} saved and restarted selected runtime.', { context: contextLabel })
          : t('owner.toast.controlSavedRestartRequired', '{context} saved (restart still required).', { context: contextLabel }))
        : t('owner.toast.controlSaved', '{context} saved.', { context: contextLabel }),
      'success'
    );
  }

  function renderControlCenter() {
    const settings = state.controlPanelSettings || {};
    const applyPhase = getConfigApplyPhasePresentation(state.controlApplyResult);
    const rootCatalog = Array.isArray(settings.envCatalog?.root) ? settings.envCatalog.root : [];
    const portalCatalog = Array.isArray(settings.envCatalog?.portal) ? settings.envCatalog.portal : [];
    const managedServices = Array.isArray(settings.managedServices) ? settings.managedServices : [];
    const editableCount = [...rootCatalog, ...portalCatalog].filter((row) => row.editable !== false).length;
    const reloadSafeCount = [...rootCatalog, ...portalCatalog].filter((row) => row.applyMode === 'reload-safe').length;

    renderStats(document.getElementById('ownerControlSummaryStats'), [
      {
        kicker: t('owner.control.applyKicker', 'Config Apply'),
        value: applyPhase.label,
        title: t('owner.control.applyTitle', 'Latest guarded config apply'),
        detail: state.controlApplyResult?.contextLabel
          ? `${applyPhase.detail} (${state.controlApplyResult.contextLabel})`
          : applyPhase.detail,
        tags: [
          t('owner.control.apply.changedTag', 'changed {count}', {
            count: formatNumber(Number(state.controlApplyResult?.changedCount || 0), '0'),
          }),
          state.controlApplyResult?.restartRequired
            ? t('owner.control.apply.restartTag', 'restart {count}', {
                count: formatNumber(Number(state.controlApplyResult?.restartRequiredCount || 0), '0'),
              })
            : t('owner.control.apply.reloadSafeTag', 'reload-safe {count}', {
                count: formatNumber(Number(state.controlApplyResult?.reloadSafeCount || 0), '0'),
              }),
        ],
      },
      {
        kicker: 'Env Catalog',
        value: formatNumber(rootCatalog.length + portalCatalog.length, '0'),
        title: 'Editable env keys',
        detail: `${formatNumber(editableCount, '0')} keys writable from the owner scope.`,
      },
      {
        kicker: 'Reload Safe',
        value: formatNumber(reloadSafeCount, '0'),
        title: 'Hot-reload capable keys',
        detail: 'Fields marked reload-safe can avoid full runtime restarts.',
      },
      {
        kicker: 'Runtime',
        value: formatNumber(managedServices.length, '0'),
        title: 'Managed services',
        detail: 'Services available for guarded restart from this surface.',
      },
    ]);

    renderTable(document.getElementById('ownerManagedServiceTable'), {
      emptyText: 'No managed services found.',
      columns: [
        {
          label: 'Service',
          render: (row) => [
            `<strong>${escapeHtml(row.label || row.key || '-')}</strong>`,
            row.pm2Name ? `<div class="muted code">${escapeHtml(row.pm2Name)}</div>` : '',
          ].join(''),
        },
        {
          label: 'Key',
          render: (row) => `<span class="code">${escapeHtml(row.key || '-')}</span>`,
        },
        {
          label: 'Required',
          render: (row) => makePill(row.required === false ? 'optional' : 'required', row.required === false ? 'info' : 'success'),
        },
      ],
      rows: managedServices,
    });

    const restartTarget = document.getElementById('ownerRestartTarget');
    if (restartTarget) {
      const current = String(restartTarget.value || '').trim();
      restartTarget.innerHTML = [
        '<option value="">Select a runtime service</option>',
        '<option value="all">All managed services</option>',
        ...managedServices.map((row) => {
          const key = String(row.key || '').trim();
          const selected = key && key === current ? ' selected' : '';
          return `<option value="${escapeHtml(key)}"${selected}>${escapeHtml(row.label || key)} (${escapeHtml(row.pm2Name || key)})</option>`;
        }),
      ].join('');
      if (current && (current === 'all' || managedServices.some((row) => row.key === current))) {
        restartTarget.value = current;
      }
    }

    fillOwnerConfigForms();
  }

  function renderLiveFeed() {
    renderList(
      document.getElementById('ownerLiveFeed'),
      state.liveEvents.slice(0, 16),
      (item) => [
        `<article class="timeline-item ${escapeHtml(item.tone || 'info')}">`,
        `<div class="feed-meta">${makePill(item.type || 'event')} <span class="code">${escapeHtml(formatDateTime(item.at))}</span></div>`,
        `<strong>${escapeHtml(item.title || t('owner.feed.liveEvent', 'Live event'))}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('owner.feed.waiting', 'Waiting for live events.')
    );
  }

  // One owner render pass updates every visible page fragment, then runs the
  // literal translator so text injected by JS still follows the selected
  // language without touching backend payloads.
  function renderAll() {
    const runtimeRows = normalizeRuntimeRows(state.runtimeSupervisor);
    const degraded = runtimeRows.filter((row) => {
      const status = String(row.status || '').trim().toLowerCase();
      return status && status !== 'ready';
    }).length;
    const unresolvedCount = state.notifications.length;
    const automation = getAutomationState();
    const { warnings: rotationWarnings, errors: rotationErrors } = getRotationSignalCounts();
    const automationConfig =
      state.automationReport?.automationConfig
      || state.opsState?.automationConfig
      || state.overview?.automationConfig
      || null;
    setBanner(
      state.me?.user ? t('owner.banner.signedIn', 'Signed in as {user}', { user: state.me.user }) : t('owner.banner.ready', 'Owner console ready'),
      t('owner.banner.detail', 'Platform-wide operations are isolated from tenant-facing work. Use this surface for global health, security, and governance.'),
      [
        t('owner.banner.tag.role', 'role {value}', { value: state.me?.role || '-' }),
        t('owner.banner.tag.tenants', 'tenants {count}', { count: formatNumber(state.tenants.length, '0') }),
        t('owner.banner.tag.alerts', 'alerts {count}', { count: formatNumber(unresolvedCount, '0') }),
        t('owner.banner.tag.degraded', 'degraded {count}', { count: formatNumber(degraded, '0') }),
        automationConfig?.enabled === false
          ? t('owner.banner.tag.automationDisabled', 'automation off')
          : t('owner.banner.tag.automationEnabled', 'automation on'),
        automation?.lastAutomationAt
          ? t('owner.banner.tag.automationRecent', 'last auto {time}', {
              time: formatDateTime(automation.lastAutomationAt),
            })
          : t('owner.banner.tag.automationIdle', 'automation idle'),
        rotationErrors > 0
          ? t('owner.banner.tag.rotationErrors', 'rotation errors {count}', { count: formatNumber(rotationErrors, '0') })
          : '',
        rotationWarnings > 0
          ? t('owner.banner.tag.rotationWarnings', 'rotation warnings {count}', { count: formatNumber(rotationWarnings, '0') })
          : '',
      ],
      degraded > 0 || unresolvedCount > 0 || rotationErrors > 0 ? 'warning' : 'success'
    );
    renderOverview();
    renderTenantTable();
    renderSupportCase();
    renderOwnerSupportToolkit();
    renderFleetAssets();
    renderRuntimeTables();
    renderIncidentCenter();
    renderCommercial();
    renderObservability();
    renderNotifications();
    renderRequestFeed();
    renderSecurity();
    renderAccessCenter();
    renderAudit();
    renderLiveFeed();
    renderRecovery();
    renderControlCenter();
    window.AdminUiI18n?.translateLiterals?.(document);
  }

  function scheduleRefresh(delayMs = 1200) {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
    }
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      refreshSurface({ silent: true });
    }, delayMs);
  }

  function pushLiveEvent(type, payload) {
    const title = payload?.payload?.summary
      || payload?.payload?.detail
      || payload?.payload?.message
      || payload?.payload?.type
      || type;
    const detail = payload?.payload?.reason
      || payload?.payload?.status
      || payload?.payload?.code
      || payload?.payload?.runtimeKey
      || '';
    state.liveEvents.unshift({
      type,
      title,
      detail,
      tone: type.includes('dead-letter') || type.includes('ops-alert')
        ? 'danger'
        : type.includes('delivery') || type.includes('restart')
          ? 'warning'
          : type === 'connected'
            ? 'success'
            : 'info',
      at: payload?.at || new Date().toISOString(),
    });
    state.liveEvents = state.liveEvents.slice(0, 24);
    renderLiveFeed();
  }

  function connectLive() {
    if (liveConnection) return;
    liveConnection = connectLiveStream({
      events: [
        'connected',
        'heartbeat',
        'admin-action',
        'platform-event',
        'scum-status',
        'scum-player',
        'scum-kill',
        'scum-restart',
        'delivery-queue',
        'delivery-dead-letter',
        'ops-alert',
      ],
      onEvent(type, payload) {
        pushLiveEvent(type, payload);
        if (type !== 'heartbeat') {
          scheduleRefresh(900);
        }
      },
      onOpen() {
        pushLiveEvent('connected', {
          at: new Date().toISOString(),
          payload: { summary: 'Owner live stream connected' },
        });
      },
      onError() {
        pushLiveEvent('ops-alert', {
          at: new Date().toISOString(),
          payload: { summary: 'Live stream interrupted, falling back to refresh.' },
        });
      },
    });
  }

  async function refreshSurface(options = {}) {
    const refreshButton = document.getElementById('ownerRefreshBtn');
    if (!options.silent) {
      setBusy(refreshButton, true, t('common.refreshing', 'Refreshing...'));
    }
    try {
      const me = await api('/admin/api/me');
      if (me?.tenantId) {
        window.location.href = '/tenant';
        return;
      }

      const [
        overview,
        observability,
        deliveryLifecycle,
        reconcile,
        opsState,
        tenants,
        subscriptions,
        licenses,
        apiKeys,
        webhooks,
        agents,
        marketplace,
        notifications,
        incidentInbox,
        securityEvents,
        runtimeSupervisor,
        dashboardCards,
        requestLogs,
        roleMatrix,
        rotationReport,
        controlPanelSettings,
        restoreState,
        backupFiles,
        sessions,
        users,
        audit,
      ] = await Promise.all([
        safeApi('/admin/api/platform/overview', {}),
        safeApi('/admin/api/observability?windowMs=21600000', {}),
        safeApi('/admin/api/delivery/lifecycle?limit=120&pendingOverdueMs=1200000', {}),
        safeApi('/admin/api/platform/reconcile?windowMs=3600000&pendingOverdueMs=1200000', {}),
        safeApi('/admin/api/platform/ops-state', {}),
        safeApi('/admin/api/platform/tenants?limit=20', []),
        safeApi('/admin/api/platform/subscriptions?limit=12', []),
        safeApi('/admin/api/platform/licenses?limit=12', []),
        safeApi('/admin/api/platform/apikeys?limit=12', []),
        safeApi('/admin/api/platform/webhooks?limit=12', []),
        safeApi('/admin/api/platform/agents?limit=20', []),
        safeApi('/admin/api/platform/marketplace?limit=12', []),
        safeApi('/admin/api/notifications?acknowledged=false&limit=10', { items: [] }),
        safeApi(`/admin/api/notifications?${buildIncidentQueryString({
          limit: 20,
          severity: state.incidentFilters.severity,
          acknowledged: state.incidentFilters.acknowledged,
          kind: state.incidentFilters.kind,
        })}`, { items: [] }),
        safeApi('/admin/api/auth/security-events?limit=10', []),
        safeApi('/admin/api/runtime/supervisor', null),
        safeApi('/admin/api/dashboard/cards', null),
        safeApi('/admin/api/observability/requests?limit=8&onlyErrors=true', { metrics: {}, items: [] }),
        safeApi('/admin/api/auth/role-matrix', { summary: {}, permissions: [] }),
        safeApi('/admin/api/security/rotation-check', { data: { secrets: [], reloadMatrix: [] }, warnings: [], errors: [] }),
        safeApi('/admin/api/control-panel/settings', {}),
        safeApi('/admin/api/backup/restore/status', {}),
        safeApi('/admin/api/backup/list', []),
        safeApi('/admin/api/auth/sessions', []),
        safeApi('/admin/api/auth/users', []),
        safeApi(`/admin/api/audit/query?${buildAuditQueryString({
          view: state.auditFilters.view,
          userId: state.auditFilters.userId,
          q: state.auditFilters.query,
          windowMs: state.auditFilters.windowMs,
          pageSize: 8,
        })}`, { cards: [], tableRows: [] }),
      ]);

      state.me = me;
      state.overview = overview || {};
      state.observability = observability || {};
      state.deliveryLifecycle = deliveryLifecycle || {};
      state.reconcile = reconcile || {};
      state.opsState = opsState || {};
      state.tenants = Array.isArray(tenants) ? tenants : [];
      state.subscriptions = Array.isArray(subscriptions) ? subscriptions : [];
      state.licenses = Array.isArray(licenses) ? licenses : [];
      state.apiKeys = Array.isArray(apiKeys) ? apiKeys : [];
      state.webhooks = Array.isArray(webhooks) ? webhooks : [];
      state.agents = Array.isArray(agents) ? agents : [];
      state.marketplaceOffers = Array.isArray(marketplace) ? marketplace : [];
      state.notifications = Array.isArray(notifications?.items) ? notifications.items : [];
      state.incidentInbox = Array.isArray(incidentInbox?.items) ? incidentInbox.items : [];
      state.securityEvents = Array.isArray(securityEvents) ? securityEvents : [];
      state.runtimeSupervisor = runtimeSupervisor;
      state.dashboardCards = dashboardCards;
      state.requestLogs = requestLogs || { metrics: {}, items: [] };
      state.roleMatrix = roleMatrix || { summary: {}, permissions: [] };
      state.rotationReport = rotationReport || { data: { secrets: [], reloadMatrix: [] }, warnings: [], errors: [] };
      state.controlPanelSettings = controlPanelSettings || {};
      state.restoreState = restoreState || {};
      state.backupFiles = Array.isArray(backupFiles) ? backupFiles : [];
      state.sessions = Array.isArray(sessions) ? sessions : [];
      state.users = Array.isArray(users) ? users : [];
      state.audit = audit || { cards: [], tableRows: [] };
      state.tenantQuotaSnapshots = await Promise.all(
        state.tenants.slice(0, 8).map((row) => safeApi(
          `/admin/api/platform/quota?tenantId=${encodeURIComponent(String(row.id || '').trim())}`,
          {
            tenantId: row.id || '',
            tenant: { id: row.id || '', name: row.name || row.slug || row.id || '' },
            quotas: {},
          },
        )),
      );
      {
        const selectedSupportTenantId = String(
          state.supportCase?.tenantId
          || document.getElementById('ownerSupportTenantSelect')?.value
          || '',
        ).trim();
        if (selectedSupportTenantId) {
          state.supportCase = await safeApi(
            `/admin/api/platform/tenant-support-case?tenantId=${encodeURIComponent(selectedSupportTenantId)}`,
            state.supportCase,
          );
        }
      }
      renderAll();
      connectLive();
    } catch (error) {
      setBanner(
        'Owner console failed to load',
        String(error.message || error),
        ['retry available'],
        'danger'
      );
    } finally {
      if (!options.silent) {
        setBusy(refreshButton, false);
      }
    }
  }

  async function loadTenantSupportCase(tenantId, options = {}) {
    const scopedTenantId = String(tenantId || '').trim();
    const select = document.getElementById('ownerSupportTenantSelect');
    const button = options.button || document.getElementById('ownerSupportCaseLoadBtn');
    if (!scopedTenantId) {
      state.supportCase = null;
      renderSupportCase();
      return false;
    }
    try {
      if (button) setBusy(button, true, t('owner.support.loading', 'Loading Case...'));
      state.supportCase = await api(`/admin/api/platform/tenant-support-case?tenantId=${encodeURIComponent(scopedTenantId)}`);
      if (select) select.value = scopedTenantId;
      renderSupportCase();
      if (options.focus !== false) {
        openOwnerTarget('fleet', { targetId: 'ownerSupportCaseStats', block: 'center' });
      }
      if (options.toast !== false) {
        showToast(t('owner.toast.tenantSupportCaseLoaded', 'Tenant support case loaded.'), 'success');
      }
      return true;
    } catch (error) {
      setBanner('Support case load failed', String(error.message || error), ['support'], 'danger');
      return false;
    } finally {
      if (button) setBusy(button, false);
    }
  }

  async function runMonitoring() {
    const button = document.getElementById('ownerMonitoringBtn');
    setBusy(button, true, t('common.running', 'Running...'));
    try {
      await api('/admin/api/platform/monitoring/run', {
        method: 'POST',
        body: {},
      });
      showToast(t('owner.toast.monitoringCompleted', 'Platform monitoring cycle completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Monitoring run failed', String(error.message || error), ['monitoring'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function refreshRotationCheck() {
    const button = document.getElementById('ownerRotationRefreshBtn');
    setBusy(button, true, t('common.refreshing', 'Refreshing...'));
    try {
      state.rotationReport = await api('/admin/api/security/rotation-check');
      renderSecurity();
      showToast(
        t('owner.toast.rotationCheckRefreshed', 'Secret rotation check refreshed.'),
        'success',
      );
    } catch (error) {
      setBanner('Rotation check refresh failed', String(error.message || error), ['security'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  // Automation stays owner-only and guarded: dry run first, then execute.
  async function runAutomation(dryRun) {
    const button = document.getElementById(dryRun ? 'ownerAutomationDryRunBtn' : 'ownerAutomationRunBtn');
    setBusy(
      button,
      true,
      dryRun
        ? t('owner.observability.automationDryRunBusy', 'Running dry run...')
        : t('owner.observability.automationRunBusy', 'Running automation...')
    );
    try {
      const response = await api('/admin/api/platform/automation/run', {
        method: 'POST',
        body: {
          force: true,
          dryRun: dryRun === true,
        },
      });
      state.automationReport = response || null;
      if (response?.stateAfter) {
        state.opsState = {
          ...(state.opsState || {}),
          automation: response.stateAfter,
        };
      }
      renderObservability();
      showToast(
        dryRun
          ? t('owner.toast.automationDryRunCompleted', 'Automation dry run completed ({count} actions reviewed).', {
              count: formatNumber(Array.isArray(response?.actions) ? response.actions.length : 0, '0'),
            })
          : t('owner.toast.automationRunCompleted', 'Automation cycle completed ({count} actions executed).', {
              count: formatNumber(Array.isArray(response?.actions) ? response.actions.length : 0, '0'),
            }),
        'success'
      );
      await refreshSurface({ silent: true });
    } catch (error) {
      setBanner(
        dryRun
          ? t('owner.observability.automationDryRunFailedTitle', 'Automation dry run failed')
          : t('owner.observability.automationRunFailedTitle', 'Automation run failed'),
        String(error.message || error),
        [t('owner.observability.automation', 'Automation Control')],
        'danger'
      );
    } finally {
      setBusy(button, false);
    }
  }

  async function clearAlerts() {
    const button = document.getElementById('ownerClearAlertsBtn');
    if (!window.confirm('Clear current admin notifications?')) {
      return;
    }
    setBusy(button, true, t('common.clearing', 'Clearing...'));
    try {
      await api('/admin/api/notifications/clear', {
        method: 'POST',
        body: {},
      });
      showToast(t('owner.toast.notificationsCleared', 'Owner notifications cleared.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Clear alerts failed', String(error.message || error), ['alerts'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function loadIncidentInbox(event) {
    if (event) event.preventDefault();
    const form = document.getElementById('ownerIncidentQueryForm');
    const button = form?.querySelector('button[type="submit"]');
    if (form) {
      state.incidentFilters = {
        severity: String(form.elements.severity.value || '').trim(),
        acknowledged: String(form.elements.acknowledged.value || '').trim(),
        kind: String(form.elements.kind.value || '').trim(),
      };
    }
    try {
      if (button) setBusy(button, true, t('common.loading', 'Loading...'));
      const payload = await api(`/admin/api/notifications?${buildIncidentQueryString({
        limit: 20,
        severity: state.incidentFilters.severity,
        acknowledged: state.incidentFilters.acknowledged,
        kind: state.incidentFilters.kind,
      })}`);
      state.incidentInbox = Array.isArray(payload?.items) ? payload.items : [];
      renderIncidentCenter();
      showToast(t('owner.toast.incidentInboxUpdated', 'Incident inbox updated.'), 'success');
    } catch (error) {
      setBanner('Incident query failed', String(error.message || error), ['incidents'], 'danger');
    } finally {
      if (button) setBusy(button, false);
    }
  }

  function exportIncidentInbox(format) {
    const query = buildIncidentQueryString({
      limit: 500,
      severity: state.incidentFilters.severity,
      acknowledged: state.incidentFilters.acknowledged,
      kind: state.incidentFilters.kind,
      format,
    });
    window.open(`/admin/api/notifications/export?${query}`, '_blank', 'noopener,noreferrer');
  }

  async function clearAcknowledgedAlerts() {
    const button = document.getElementById('ownerClearAckedAlertsBtn');
    if (!window.confirm('Clear acknowledged admin notifications only?')) {
      return;
    }
    try {
      setBusy(button, true, t('common.clearing', 'Clearing...'));
      await api('/admin/api/notifications/clear', {
        method: 'POST',
        body: { acknowledgedOnly: true },
      });
      showToast(t('owner.toast.acknowledgedCleared', 'Acknowledged notifications cleared.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Clear acknowledged alerts failed', String(error.message || error), ['incidents'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleRestartSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const target = String(form.elements.service.value || '').trim();
    if (!target) {
      setBanner('Restart target missing', 'Choose a managed service before restarting runtime.', ['runtime'], 'danger');
      return;
    }
    const managedServices = Array.isArray(state.controlPanelSettings?.managedServices)
      ? state.controlPanelSettings.managedServices
      : [];
    const services = target === 'all'
      ? managedServices.map((row) => row.key).filter(Boolean)
      : [target];
    if (services.length === 0) {
      setBanner('Restart target invalid', 'No managed service keys were resolved from the current control panel settings.', ['runtime'], 'danger');
      return;
    }
    if (!window.confirm(`Restart ${target === 'all' ? 'all managed services' : target}?`)) return;
    try {
      setBusy(button, true, t('common.restarting', 'Restarting...'));
      await api('/admin/api/runtime/restart-service', {
        method: 'POST',
        body: services.length === 1 ? { service: services[0] } : { services },
      });
      showToast(t('owner.toast.runtimeRestartCompleted', 'Runtime restart request completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Runtime restart failed', String(error.message || error), ['runtime'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleBackupCreateSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const note = String(form.elements.note.value || '').trim();
    const includeSnapshot = String(form.elements.includeSnapshot.value || 'true') !== 'false';
    if (!window.confirm('Create a new platform backup now?')) return;
    try {
      setBusy(button, true, t('common.creating', 'Creating...'));
      await api('/admin/api/backup/create', {
        method: 'POST',
        body: {
          note: note || null,
          includeSnapshot,
        },
      });
      form.reset();
      showToast(t('owner.toast.backupCreated', 'Backup created successfully.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Backup creation failed', String(error.message || error), ['backup'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleBackupPreviewSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const backup = String(form.elements.backup.value || '').trim();
    if (!backup) {
      setBanner('Backup preview is incomplete', 'Choose a backup file before running a dry-run preview.', ['backup'], 'danger');
      return;
    }
    try {
      setBusy(button, true, t('common.previewing', 'Previewing...'));
      const preview = await api('/admin/api/backup/restore', {
        method: 'POST',
        body: {
          backup,
          dryRun: true,
        },
      });
      state.restorePreview = preview || null;
      renderRecovery();
      showToast(t('owner.toast.restorePreviewCompleted', 'Dry-run restore preview completed.'), 'success');
    } catch (error) {
      state.restorePreview = null;
      renderRecovery();
      setBanner('Restore preview failed', String(error.message || error), ['backup'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleTenantCreateSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const payload = {
      id: String(form.elements.id.value || '').trim(),
      slug: String(form.elements.slug.value || '').trim(),
      name: String(form.elements.name.value || '').trim(),
      type: String(form.elements.type.value || '').trim(),
      status: String(form.elements.status.value || '').trim(),
      locale: String(form.elements.locale.value || '').trim(),
      ownerName: String(form.elements.ownerName.value || '').trim(),
      ownerEmail: String(form.elements.ownerEmail.value || '').trim(),
      parentTenantId: String(form.elements.parentTenantId.value || '').trim() || null,
      metadata: null,
    };
    if (!payload.id || !payload.slug || !payload.name || !payload.type || !payload.status || !payload.locale || !payload.ownerName || !payload.ownerEmail) {
      setBanner('Tenant creation is incomplete', 'Fill all required tenant identity and owner fields before creating the tenant record.', ['tenant'], 'danger');
      return;
    }
    try {
      payload.metadata = parseOptionalJson(form.elements.metadata.value, 'Metadata');
      if (!window.confirm(`Create tenant ${payload.slug}?`)) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      await api('/admin/api/platform/tenant', {
        method: 'POST',
        body: payload,
      });
      form.reset();
      showToast(t('owner.toast.tenantCreated', 'Tenant record created successfully.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Tenant creation failed', String(error.message || error), ['tenant'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleSubscriptionSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tenantId = String(form.elements.tenantId.value || '').trim();
    const planId = String(form.elements.planId.value || '').trim();
    if (!tenantId || !planId) {
      setBanner('Subscription form is incomplete', 'Choose a tenant and provide a plan id before creating a subscription.', ['subscription'], 'danger');
      return;
    }
    try {
      if (!window.confirm(`Create subscription for ${tenantId}?`)) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      const result = await api('/admin/api/platform/subscription', {
        method: 'POST',
        body: {
          id: makeClientId('sub'),
          tenantId,
          planId,
          billingCycle: String(form.elements.billingCycle.value || 'monthly').trim(),
          status: String(form.elements.status.value || 'active').trim(),
          currency: String(form.elements.currency.value || 'THB').trim(),
          amountCents: Number(form.elements.amountCents.value || 0),
          intervalDays: form.elements.intervalDays.value ? Number(form.elements.intervalDays.value) : null,
          startedAt: String(form.elements.startedAt.value || '').trim() || null,
          renewsAt: String(form.elements.renewsAt.value || '').trim() || null,
          externalRef: String(form.elements.externalRef.value || '').trim() || null,
        },
      });
      state.assetResult = {
        kind: 'subscription',
        title: 'Subscription created',
        detail: 'The tenant subscription record was created successfully.',
        tenantId,
        createdAt: new Date().toISOString(),
        rows: [
          { label: 'Subscription ID', value: result.id || '-', code: true },
          { label: 'Plan ID', value: result.planId || planId, code: true },
          { label: 'Status', value: result.status || '-', code: false },
          { label: 'Renews At', value: formatDateTime(result.renewsAt), code: false },
        ],
      };
      form.reset();
      form.elements.billingCycle.value = 'monthly';
      form.elements.status.value = 'active';
      showToast(t('owner.toast.subscriptionCreated', 'Subscription created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Subscription create failed', String(error.message || error), ['subscription'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleLicenseSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tenantId = String(form.elements.tenantId.value || '').trim();
    if (!tenantId) {
      setBanner('License form is incomplete', 'Choose a tenant before issuing a license.', ['license'], 'danger');
      return;
    }
    try {
      if (!window.confirm(`Issue license for ${tenantId}?`)) return;
      setBusy(button, true, t('common.issuing', 'Issuing...'));
      const result = await api('/admin/api/platform/license', {
        method: 'POST',
        body: {
          id: makeClientId('license'),
          tenantId,
          licenseKey: String(form.elements.licenseKey.value || '').trim(),
          status: String(form.elements.status.value || 'active').trim(),
          seats: Number(form.elements.seats.value || 1),
          issuedAt: String(form.elements.issuedAt.value || '').trim() || null,
          expiresAt: String(form.elements.expiresAt.value || '').trim() || null,
          legalDocVersion: String(form.elements.legalDocVersion.value || 'v1').trim(),
        },
      });
      state.assetResult = {
        kind: 'license',
        title: 'License issued',
        detail: 'The tenant license record was created successfully.',
        tenantId,
        createdAt: new Date().toISOString(),
        rows: [
          { label: 'License ID', value: result.id || '-', code: true },
          { label: 'License Key', value: result.licenseKey || '-', code: true },
          { label: 'Seats', value: String(result.seats || '-'), code: false },
          { label: 'Expires At', value: formatDateTime(result.expiresAt), code: false },
        ],
      };
      form.reset();
      form.elements.status.value = 'active';
      form.elements.seats.value = '1';
      showToast(t('owner.toast.licenseIssued', 'License issued.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('License issue failed', String(error.message || error), ['license'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleApiKeySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tenantId = String(form.elements.tenantId.value || '').trim();
    const name = String(form.elements.name.value || '').trim();
    if (!tenantId || !name) {
      setBanner('API key form is incomplete', 'Choose a tenant and provide a key name before creating an API key.', ['apikey'], 'danger');
      return;
    }
    try {
      if (!window.confirm(`Create API key for ${tenantId}?`)) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      const result = await api('/admin/api/platform/apikey', {
        method: 'POST',
        body: {
          id: makeClientId('apikey'),
          tenantId,
          name,
          status: String(form.elements.status.value || 'active').trim(),
          scopes: String(form.elements.scopes.value || '').split(',').map((entry) => entry.trim()).filter(Boolean),
        },
      });
      state.assetResult = {
        kind: 'api-key',
        title: 'API key created',
        detail: 'Store the raw key now. It will not be shown again by the listing endpoint.',
        tenantId,
        createdAt: new Date().toISOString(),
        rows: [
          { label: 'API Key ID', value: result.apiKey?.id || result.id || '-', code: true },
          { label: 'Raw Key', value: result.rawKey || '-', code: true },
          { label: 'Scopes', value: Array.isArray(result.apiKey?.scopes) ? result.apiKey.scopes.join(', ') : String(form.elements.scopes.value || '').trim() || '-', code: false },
        ],
      };
      form.reset();
      form.elements.status.value = 'active';
      showToast(t('owner.toast.apiKeyCreated', 'API key created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('API key create failed', String(error.message || error), ['apikey'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleWebhookSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tenantId = String(form.elements.tenantId.value || '').trim();
    const name = String(form.elements.name.value || '').trim();
    const targetUrl = String(form.elements.targetUrl.value || '').trim();
    if (!tenantId || !name || !targetUrl) {
      setBanner('Webhook form is incomplete', 'Choose a tenant and provide both name and target URL before creating a webhook.', ['webhook'], 'danger');
      return;
    }
    try {
      if (!window.confirm(`Create webhook for ${tenantId}?`)) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      const result = await api('/admin/api/platform/webhook', {
        method: 'POST',
        body: {
          id: makeClientId('hook'),
          tenantId,
          name,
          eventType: String(form.elements.eventType.value || '*').trim() || '*',
          targetUrl,
          secretValue: String(form.elements.secretValue.value || '').trim(),
          enabled: String(form.elements.enabled.value || 'true') === 'true',
        },
      });
      state.assetResult = {
        kind: 'webhook',
        title: 'Webhook created',
        detail: 'Store the webhook secret now if one was returned in full.',
        tenantId,
        createdAt: new Date().toISOString(),
        rows: [
          { label: 'Webhook ID', value: result.id || '-', code: true },
          { label: 'Target URL', value: result.targetUrl || targetUrl, code: false },
          { label: 'Event Type', value: result.eventType || String(form.elements.eventType.value || '*').trim(), code: false },
          { label: 'Secret', value: result.secretValue || String(form.elements.secretValue.value || '').trim() || '(generated and hidden)', code: true },
        ],
      };
      form.reset();
      form.elements.enabled.value = 'true';
      showToast(t('owner.toast.webhookCreated', 'Webhook created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Webhook create failed', String(error.message || error), ['webhook'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleWebhookTestSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tenantId = String(form.elements.tenantId.value || '').trim();
    if (!tenantId) {
      setBanner('Webhook test is incomplete', 'Choose a tenant before dispatching a webhook test event.', ['webhook'], 'danger');
      return;
    }
    try {
      if (!window.confirm(`Dispatch webhook test for ${tenantId}?`)) return;
      setBusy(button, true, t('common.dispatching', 'Dispatching...'));
      const payloadText = String(form.elements.payload.value || '').trim();
      const result = await api('/admin/api/platform/webhook/test', {
        method: 'POST',
        body: {
          tenantId,
          eventType: String(form.elements.eventType.value || 'platform.admin.test').trim() || 'platform.admin.test',
          payload: payloadText ? parseOptionalJson(payloadText, 'Webhook payload') : null,
        },
      });
      state.assetResult = {
        kind: 'webhook-test',
        title: 'Webhook test dispatched',
        detail: 'The platform dispatched a test webhook event for the selected tenant.',
        tenantId,
        createdAt: new Date().toISOString(),
        rows: [
          { label: 'Event Type', value: result.eventType || '-', code: false },
          { label: 'Result Count', value: String(Array.isArray(result.results) ? result.results.length : 0), code: false },
          { label: 'Dispatch Summary', value: Array.isArray(result.results) ? result.results.map((entry) => `${entry.name || entry.id || 'hook'}:${entry.ok === false ? 'fail' : 'ok'}`).join(', ') : '-', code: false },
        ],
      };
      showToast(t('owner.toast.webhookTestDispatched', 'Webhook test dispatched.'), 'success');
      renderFleetAssets();
    } catch (error) {
      setBanner('Webhook test failed', String(error.message || error), ['webhook'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleMarketplaceSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tenantId = String(form.elements.tenantId.value || '').trim();
    const title = String(form.elements.title.value || '').trim();
    if (!tenantId || !title) {
      setBanner('Marketplace form is incomplete', 'Choose a tenant and provide an offer title before creating a marketplace offer.', ['marketplace'], 'danger');
      return;
    }
    try {
      const meta = parseOptionalJson(form.elements.meta.value, 'Marketplace meta');
      if (!window.confirm(`Create marketplace offer for ${tenantId}?`)) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      const result = await api('/admin/api/platform/marketplace', {
        method: 'POST',
        body: {
          id: makeClientId('offer'),
          tenantId,
          title,
          kind: String(form.elements.kind.value || 'service').trim() || 'service',
          priceCents: Number(form.elements.priceCents.value || 0),
          currency: String(form.elements.currency.value || 'THB').trim() || 'THB',
          status: String(form.elements.status.value || 'active').trim() || 'active',
          locale: String(form.elements.locale.value || 'th-TH').trim() || 'th-TH',
          meta,
        },
      });
      state.assetResult = {
        kind: 'marketplace-offer',
        title: 'Marketplace offer created',
        detail: 'The tenant offer is now available to the marketplace surface according to its status.',
        tenantId,
        createdAt: new Date().toISOString(),
        rows: [
          { label: 'Offer ID', value: result.id || '-', code: true },
          { label: 'Offer Title', value: result.title || title, code: false },
          { label: 'Status', value: result.status || '-', code: false },
          { label: 'Price', value: `${formatNumber(result.priceCents, '0')} ${result.currency || 'THB'}`, code: false },
        ],
      };
      form.reset();
      form.elements.status.value = 'active';
      showToast(t('owner.toast.marketplaceOfferCreated', 'Marketplace offer created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Marketplace create failed', String(error.message || error), ['marketplace'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleRuntimeFlagsSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      if (!window.confirm('Save runtime flag changes?')) return;
      setBusy(button, true, t('common.saving', 'Saving...'));
      await saveControlEnvPatch({
        root: {
          DISCORD_GUILD_ID: String(form.elements.DISCORD_GUILD_ID.value || '').trim(),
          DELIVERY_EXECUTION_MODE: String(form.elements.DELIVERY_EXECUTION_MODE.value || 'rcon').trim(),
          BOT_ENABLE_ADMIN_WEB: String(form.elements.BOT_ENABLE_ADMIN_WEB.value || 'true') === 'true',
          BOT_ENABLE_DELIVERY_WORKER: String(form.elements.BOT_ENABLE_DELIVERY_WORKER.value || 'false') === 'true',
          WORKER_ENABLE_DELIVERY: String(form.elements.WORKER_ENABLE_DELIVERY.value || 'true') === 'true',
          BOT_ENABLE_SCUM_WEBHOOK: String(form.elements.BOT_ENABLE_SCUM_WEBHOOK.value || 'true') === 'true',
          SCUM_WATCHER_ENABLED: String(form.elements.SCUM_WATCHER_ENABLED.value || 'true') === 'true',
        },
      }, 'Runtime Flags');
      await refreshSurface();
    } catch (error) {
      setBanner('Runtime flag save failed', String(error.message || error), ['config'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handlePortalAccessSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      if (!window.confirm('Save portal and access policy changes?')) return;
      setBusy(button, true, t('common.saving', 'Saving...'));
      await saveControlEnvPatch({
        root: {
          ADMIN_WEB_2FA_ENABLED: String(form.elements.ADMIN_WEB_2FA_ENABLED.value || 'true') === 'true',
          ADMIN_WEB_STEP_UP_ENABLED: String(form.elements.ADMIN_WEB_STEP_UP_ENABLED.value || 'true') === 'true',
          ADMIN_WEB_ALLOWED_ORIGINS: String(form.elements.ADMIN_WEB_ALLOWED_ORIGINS.value || '').trim(),
        },
        portal: {
          WEB_PORTAL_BASE_URL: String(form.elements.WEB_PORTAL_BASE_URL.value || '').trim(),
          WEB_PORTAL_PLAYER_OPEN_ACCESS: String(form.elements.WEB_PORTAL_PLAYER_OPEN_ACCESS.value || 'false') === 'true',
          WEB_PORTAL_REQUIRE_GUILD_MEMBER: String(form.elements.WEB_PORTAL_REQUIRE_GUILD_MEMBER.value || 'true') === 'true',
          WEB_PORTAL_SECURE_COOKIE: String(form.elements.WEB_PORTAL_SECURE_COOKIE.value || 'true') === 'true',
        },
      }, 'Portal + Access');
      await refreshSurface();
    } catch (error) {
      setBanner('Portal/access save failed', String(error.message || error), ['config'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleRconAgentSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      if (!window.confirm('Save RCON and console-agent changes?')) return;
      setBusy(button, true, t('common.saving', 'Saving...'));
      await saveControlEnvPatch({
        root: {
          RCON_HOST: String(form.elements.RCON_HOST.value || '').trim(),
          RCON_PORT: String(form.elements.RCON_PORT.value || '').trim(),
          RCON_PROTOCOL: String(form.elements.RCON_PROTOCOL.value || '').trim(),
          RCON_PASSWORD: String(form.elements.RCON_PASSWORD.value || '').trim(),
          SCUM_CONSOLE_AGENT_BASE_URL: String(form.elements.SCUM_CONSOLE_AGENT_BASE_URL.value || '').trim(),
          SCUM_CONSOLE_AGENT_TOKEN: String(form.elements.SCUM_CONSOLE_AGENT_TOKEN.value || '').trim(),
          SCUM_CONSOLE_AGENT_REQUIRED: String(form.elements.SCUM_CONSOLE_AGENT_REQUIRED.value || 'false') === 'true',
        },
      }, 'RCON + Agent');
      await refreshSurface();
    } catch (error) {
      setBanner('RCON/agent save failed', String(error.message || error), ['config'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleSecurityPolicySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      if (!window.confirm('Save admin session and login policy changes?')) return;
      setBusy(button, true, t('common.saving', 'Saving...'));
      await saveControlEnvPatch({
        root: {
          ADMIN_WEB_SESSION_TTL_HOURS: String(form.elements.ADMIN_WEB_SESSION_TTL_HOURS.value || '').trim(),
          ADMIN_WEB_SESSION_IDLE_MINUTES: String(form.elements.ADMIN_WEB_SESSION_IDLE_MINUTES.value || '').trim(),
          ADMIN_WEB_SESSION_MAX_PER_USER: String(form.elements.ADMIN_WEB_SESSION_MAX_PER_USER.value || '').trim(),
          ADMIN_WEB_LOGIN_WINDOW_MS: String(form.elements.ADMIN_WEB_LOGIN_WINDOW_MS.value || '').trim(),
          ADMIN_WEB_LOGIN_MAX_ATTEMPTS: String(form.elements.ADMIN_WEB_LOGIN_MAX_ATTEMPTS.value || '').trim(),
          ADMIN_WEB_LOGIN_SPIKE_WINDOW_MS: String(form.elements.ADMIN_WEB_LOGIN_SPIKE_WINDOW_MS.value || '').trim(),
          ADMIN_WEB_LOGIN_SPIKE_THRESHOLD: String(form.elements.ADMIN_WEB_LOGIN_SPIKE_THRESHOLD.value || '').trim(),
          ADMIN_WEB_LOGIN_SPIKE_IP_THRESHOLD: String(form.elements.ADMIN_WEB_LOGIN_SPIKE_IP_THRESHOLD.value || '').trim(),
          ADMIN_WEB_LOGIN_SPIKE_ALERT_COOLDOWN_MS: String(form.elements.ADMIN_WEB_LOGIN_SPIKE_ALERT_COOLDOWN_MS.value || '').trim(),
        },
      }, 'Session + Login Policy');
      await refreshSurface();
    } catch (error) {
      setBanner('Security policy save failed', String(error.message || error), ['security'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleMonitoringPolicySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      if (!window.confirm('Save monitoring and alert threshold changes?')) return;
      setBusy(button, true, t('common.saving', 'Saving...'));
      await saveControlEnvPatch({
        root: {
          DELIVERY_QUEUE_ALERT_THRESHOLD: String(form.elements.DELIVERY_QUEUE_ALERT_THRESHOLD.value || '').trim(),
          DELIVERY_FAIL_RATE_ALERT_THRESHOLD: String(form.elements.DELIVERY_FAIL_RATE_ALERT_THRESHOLD.value || '').trim(),
          SCUM_QUEUE_ALERT_THRESHOLD: String(form.elements.SCUM_QUEUE_ALERT_THRESHOLD.value || '').trim(),
          SCUM_ALERT_COOLDOWN_MS: String(form.elements.SCUM_ALERT_COOLDOWN_MS.value || '').trim(),
          SCUM_WEBHOOK_ERROR_ALERT_THRESHOLD: String(form.elements.SCUM_WEBHOOK_ERROR_ALERT_THRESHOLD.value || '').trim(),
          SCUM_WEBHOOK_ERROR_ALERT_MIN_ATTEMPTS: String(form.elements.SCUM_WEBHOOK_ERROR_ALERT_MIN_ATTEMPTS.value || '').trim(),
          SCUM_WEBHOOK_ERROR_ALERT_WINDOW_MS: String(form.elements.SCUM_WEBHOOK_ERROR_ALERT_WINDOW_MS.value || '').trim(),
        },
      }, 'Monitoring + Alert Policy');
      await refreshSurface();
    } catch (error) {
      setBanner('Monitoring policy save failed', String(error.message || error), ['monitoring'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleOpsLogLanguageSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const nextLanguage =
      String(form.elements.ADMIN_LOG_LANGUAGE.value || 'th').trim().toLowerCase() === 'en'
        ? 'en'
        : 'th';
    try {
      if (!window.confirm(t('owner.control.discordLogLanguageConfirm', 'Save Discord admin-log language?'))) return;
      setBusy(button, true, t('common.saving', 'Saving...'));
      await saveControlEnvPatch({
        root: {
          ADMIN_LOG_LANGUAGE: nextLanguage,
        },
      }, t('owner.control.discordLogLanguageContext', 'Discord Admin Log Language'));
      await refreshSurface();
    } catch (error) {
      setBanner(
        t('owner.banner.discordLogLanguageFailed', 'Discord admin-log language save failed'),
        String(error.message || error),
        ['control'],
        'danger',
      );
    } finally {
      setBusy(button, false);
    }
  }

  async function handleSessionRevokeSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const sessionId = String(form.elements.sessionId.value || '').trim();
    const targetUser = String(form.elements.targetUser.value || '').trim();
    const reason = String(form.elements.reason.value || '').trim() || 'manual-revoke';
    const current = String(form.elements.current.value || 'false') === 'true';
    if (!sessionId && !targetUser && !current) {
      setBanner('Session revoke target missing', 'Provide a session id, target user, or choose current session revoke.', ['security'], 'danger');
      return;
    }
    if (!window.confirm('Revoke the selected session scope?')) return;
    try {
      setBusy(button, true, t('common.revoking', 'Revoking...'));
      await api('/admin/api/auth/session/revoke', {
        method: 'POST',
        body: { sessionId, targetUser, reason, current },
      });
      form.reset();
      form.elements.current.value = 'false';
      showToast(t('owner.toast.sessionRevokeCompleted', 'Session revoke completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Session revoke failed', String(error.message || error), ['security'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleAdminUserSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const username = String(form.elements.username.value || '').trim();
    const role = String(form.elements.role.value || 'mod').trim();
    const tenantId = String(form.elements.tenantId.value || '').trim();
    const password = String(form.elements.password.value || '').trim();
    const isActive = String(form.elements.isActive.value || 'true') === 'true';
    if (!username) {
      setBanner('Admin user form is incomplete', 'Username is required before saving an admin user.', ['rbac'], 'danger');
      return;
    }
    if (!window.confirm(`Save admin user ${username}?`)) return;
    try {
      setBusy(button, true, t('common.saving', 'Saving...'));
      await api('/admin/api/auth/user', {
        method: 'POST',
        body: {
          username,
          role,
          tenantId: tenantId || null,
          password,
          isActive,
        },
      });
      form.reset();
      form.elements.role.value = 'mod';
      form.elements.isActive.value = 'true';
      showToast(t('owner.toast.adminUserSaved', 'Admin user saved.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner('Admin user save failed', String(error.message || error), ['rbac'], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function loadAuditView(filters = {}, options = {}) {
    const merged = {
      ...state.auditFilters,
      ...filters,
    };
    state.auditFilters = {
      view: merged.view || 'wallet',
      userId: merged.userId || '',
      query: merged.query || '',
      windowMs: merged.windowMs == null ? '' : String(merged.windowMs),
    };
    const queryString = buildAuditQueryString({
      view: state.auditFilters.view,
      userId: state.auditFilters.userId,
      q: state.auditFilters.query,
      windowMs: state.auditFilters.windowMs,
      pageSize: 8,
    });
    const button = options.button || null;
    try {
      if (button) setBusy(button, true, t('common.loading', 'Loading...'));
      state.audit = await api(`/admin/api/audit/query?${queryString}`);
      renderAudit();
      if (options.toast === true) {
      showToast(t('owner.toast.auditLoaded', 'Audit view loaded.'), 'success');
      }
      return true;
    } catch (error) {
      state.audit = { cards: [], tableRows: [] };
      renderAudit();
      setBanner('Audit query failed', String(error.message || error), ['audit'], 'danger');
      return false;
    } finally {
      if (button) setBusy(button, false);
    }
  }

  async function handleAuditQuerySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    await loadAuditView({
      view: String(form.elements.view.value || 'wallet').trim(),
      userId: String(form.elements.userId.value || '').trim(),
      query: String(form.elements.query.value || '').trim(),
      windowMs: String(form.elements.windowMs.value || '').trim(),
    }, { button, toast: true });
  }

  function exportAudit(format) {
    const queryString = buildAuditQueryString({
      view: state.auditFilters.view,
      userId: state.auditFilters.userId,
      q: state.auditFilters.query,
      windowMs: state.auditFilters.windowMs,
      format,
    });
    window.open(`/admin/api/audit/export?${queryString}`, '_blank', 'noopener,noreferrer');
  }

  window.AdminUiI18n?.init?.(['ownerLanguageSelect']);

  workspaceController = wireWorkspaceSwitcher({
    switchId: 'ownerWorkspaceSwitch',
    summaryId: 'ownerWorkspaceSummary',
    hintId: 'ownerWorkspaceHint',
    navListId: 'ownerNavList',
    defaultWorkspace: 'command',
    workspaces: [
      {
        key: 'command',
        label: t('owner.workspace.command.label', 'Command'),
        short: 'fleet',
        title: t('owner.workspace.command.title', 'Platform command workspace'),
        description: t('owner.workspace.command.description', 'Snapshot, tenant roster, subscriptions, licenses, keys, and webhooks stay grouped here so the owner can orient quickly.'),
        sidebarHint: t('owner.workspace.command.sidebar', 'Use this workspace for platform snapshot, tenant roster, subscriptions, licenses, keys, and webhook footprint.'),
        tag: t('owner.workspace.command.tag', 'owner'),
      },
      {
        key: 'runtime',
        label: t('owner.workspace.runtime.label', 'Runtime'),
        short: 'live',
        title: t('owner.workspace.runtime.title', 'Runtime and incident workspace'),
        description: t('owner.workspace.runtime.description', 'Incidents, runtime posture, and observability stay together for faster operational scanning without burying the page under low-value stream noise.'),
        sidebarHint: t('owner.workspace.runtime.sidebar', 'Use this workspace for incidents, runtime readiness, and request pressure.'),
        tag: t('owner.workspace.runtime.tag', 'ops'),
      },
      {
        key: 'security',
        label: t('owner.workspace.security.label', 'Security'),
        short: 'audit',
        title: t('owner.workspace.security.title', 'Security and audit workspace'),
        description: t('owner.workspace.security.description', 'Security events, permission posture, admin sessions, and audit trails stay grouped without commercial or config noise.'),
        sidebarHint: t('owner.workspace.security.sidebar', 'Use this workspace for access posture, permission review, admin sessions, and audit investigation.'),
        tag: t('owner.workspace.security.tag', 'guarded'),
      },
      {
        key: 'governance',
        label: t('owner.workspace.change.label', 'Change'),
        short: 'change',
        title: t('owner.workspace.change.title', 'Recovery and guarded change workspace'),
        description: t('owner.workspace.change.description', 'Commercial policy, recovery, and guarded control stay isolated so high-friction tasks are deliberate.'),
        sidebarHint: t('owner.workspace.change.sidebar', 'Use this workspace for billing policy, recovery, service control, and tenant creation.'),
        tag: t('owner.workspace.change.tag', 'high-friction'),
      },
    ],
    sectionsByWorkspace: {
      command: ['overview', 'fleet', 'fleet-assets'],
      runtime: ['runtime', 'incidents', 'observability'],
      security: ['security', 'access', 'audit'],
      governance: ['control', 'commercial', 'recovery'],
    },
  });
  sidebarController = wireSidebarShell({
    sidebarId: 'ownerSidebar',
    navListId: 'ownerNavList',
    toggleButtonId: 'ownerSidebarToggleBtn',
    backdropId: 'ownerSidebarBackdrop',
  });
  document.getElementById('ownerSidebarHint').textContent = t('owner.sidebarHint', 'Use the area tabs above to switch context. The menu on the left only shows the pages that belong to the active owner area.');

  const palette = wireCommandPalette({
    openButtonId: 'ownerPaletteBtn',
    closeButtonId: 'ownerPaletteCloseBtn',
    panelId: 'ownerPalette',
    searchId: 'ownerPaletteSearch',
    listId: 'ownerPaletteList',
    emptyId: 'ownerPaletteEmpty',
    getActions() {
      const sectionMeta = t('owner.palette.meta.sections', 'Owner pages');
      const actionMeta = t('owner.palette.meta.actions', 'Owner actions');
      return [
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('overview') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('overview'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('fleet') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('fleet'),
        },
        {
          label: t('owner.palette.focusSupportCase', 'Focus tenant support case'),
          meta: actionMeta,
          run: () => openOwnerTarget('fleet', { targetId: 'ownerSupportCaseStats', block: 'center' }),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('fleet-assets') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('fleet-assets'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('incidents') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('incidents'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('runtime') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('runtime'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('commercial') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('commercial'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('observability') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('observability'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('security') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('security'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('access') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('access'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('recovery') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('recovery'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('audit') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('audit'),
        },
        {
          label: t('owner.palette.openPage', 'Open {page}', { page: ownerNavLabel('control') }),
          meta: sectionMeta,
          run: () => openOwnerTarget('control'),
        },
        {
          label: t('owner.palette.focusAssets', 'Focus asset provisioning'),
          meta: actionMeta,
          run: () => openOwnerTarget('fleet-assets', { targetId: 'ownerSubscriptionForm', block: 'center' }),
        },
        {
          label: t('owner.palette.focusMarketplace', 'Focus marketplace offer form'),
          meta: actionMeta,
          run: () => openOwnerTarget('commercial', { targetId: 'ownerMarketplaceForm', block: 'center' }),
        },
        {
          label: t('owner.palette.focusBackup', 'Focus backup preview'),
          meta: actionMeta,
          run: () => openOwnerTarget('recovery', { targetId: 'ownerBackupPreviewForm', block: 'center' }),
        },
        {
          label: t('owner.palette.focusSessions', 'Focus session control'),
          meta: actionMeta,
          run: () => openOwnerTarget('access', { targetId: 'ownerSessionRevokeForm', block: 'center' }),
        },
        {
          label: t('owner.palette.focusRotation', 'Focus secret rotation readiness'),
          meta: actionMeta,
          run: () => openOwnerTarget('security', { targetId: 'ownerRotationStats', block: 'center' }),
        },
        {
          label: t('owner.palette.focusIncidents', 'Focus incident query'),
          meta: actionMeta,
          run: () => openOwnerTarget('incidents', { targetId: 'ownerIncidentQueryForm', block: 'center' }),
        },
        {
          label: t('owner.palette.focusAudit', 'Focus audit query'),
          meta: actionMeta,
          run: () => openOwnerTarget('audit', { targetId: 'ownerAuditQueryForm', block: 'center' }),
        },
        {
          label: t('owner.palette.runMonitoring', 'Run monitoring cycle'),
          meta: actionMeta,
          run: runMonitoring,
        },
        {
          label: t('owner.palette.runRotationCheck', 'Refresh secret rotation check'),
          meta: actionMeta,
          run: refreshRotationCheck,
        },
        {
          label: t('owner.palette.runAutomationDry', 'Run automation dry run'),
          meta: actionMeta,
          run: () => runAutomation(true),
        },
        {
          label: t('owner.palette.runAutomationNow', 'Run automation now'),
          meta: actionMeta,
          run: () => runAutomation(false),
        },
        {
          label: t('owner.palette.clearAlerts', 'Clear current alerts'),
          meta: actionMeta,
          run: clearAlerts,
        },
        {
          label: t('owner.palette.refresh', 'Refresh owner console'),
          meta: actionMeta,
          run: () => refreshSurface(),
        },
      ];
    },
  });

  document.getElementById('ownerRefreshBtn').addEventListener('click', () => refreshSurface());
  document.getElementById('ownerSupportCaseForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const tenantId = String(form.elements.tenantId.value || '').trim();
    await loadTenantSupportCase(tenantId, {
      button: document.getElementById('ownerSupportCaseLoadBtn'),
      focus: true,
      toast: true,
    });
  });
  document.getElementById('ownerTenantTable').addEventListener('click', (event) => {
    const button = event.target.closest('[data-owner-support-case]');
    if (!button) return;
    loadTenantSupportCase(button.getAttribute('data-owner-support-case'), {
      button,
      focus: true,
      toast: true,
    });
  });
  document.getElementById('ownerSupportCaseExportJsonBtn')?.addEventListener('click', () => {
    openTenantSupportCaseExport(state.supportCase?.tenantId || document.getElementById('ownerSupportTenantSelect')?.value, 'json');
  });
  document.getElementById('ownerSupportCaseExportCsvBtn')?.addEventListener('click', () => {
    openTenantSupportCaseExport(state.supportCase?.tenantId || document.getElementById('ownerSupportTenantSelect')?.value, 'csv');
  });
  document.getElementById('ownerQuickActions')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-owner-quick-action]');
    if (!button) return;
    runOwnerQuickAction(button.getAttribute('data-owner-quick-action'));
  });
  document.getElementById('ownerSupportToolkit')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-owner-support-tool]');
    if (!button) return;
    runOwnerSupportToolkitAction(button.getAttribute('data-owner-support-tool'));
  });
  document.getElementById('ownerDeliveryLifecycleExportJsonBtn')?.addEventListener('click', () => openDeliveryLifecycleExport('json'));
  document.getElementById('ownerDeliveryLifecycleExportCsvBtn')?.addEventListener('click', () => openDeliveryLifecycleExport('csv'));
  document.getElementById('ownerDeliveryLifecycleActions')?.addEventListener('click', (event) => {
    const navButton = event.target.closest('[data-owner-lifecycle-nav]');
    if (navButton) {
      openOwnerTarget(
        navButton.getAttribute('data-owner-lifecycle-nav'),
        {
          targetId: navButton.getAttribute('data-owner-lifecycle-target') || undefined,
          block: 'center',
        },
      );
      return;
    }
    const exportButton = event.target.closest('[data-owner-lifecycle-export]');
    if (exportButton) {
      openDeliveryLifecycleExport(exportButton.getAttribute('data-owner-lifecycle-export'));
    }
  });
  document.getElementById('ownerRotationRefreshBtn')?.addEventListener('click', refreshRotationCheck);
  document.getElementById('ownerRotationExportJsonBtn')?.addEventListener('click', () => openRotationExport('json'));
  document.getElementById('ownerRotationExportCsvBtn')?.addEventListener('click', () => openRotationExport('csv'));
  document.getElementById('ownerMonitoringBtn').addEventListener('click', runMonitoring);
  document.getElementById('ownerAutomationDryRunBtn')?.addEventListener('click', () => runAutomation(true));
  document.getElementById('ownerAutomationRunBtn')?.addEventListener('click', () => runAutomation(false));
  document.getElementById('ownerClearAlertsBtn').addEventListener('click', clearAlerts);
  document.getElementById('ownerIncidentQueryForm').addEventListener('submit', loadIncidentInbox);
  document.getElementById('ownerIncidentExportJsonBtn').addEventListener('click', () => exportIncidentInbox('json'));
  document.getElementById('ownerIncidentExportCsvBtn').addEventListener('click', () => exportIncidentInbox('csv'));
  document.getElementById('ownerClearAckedAlertsBtn').addEventListener('click', clearAcknowledgedAlerts);
  document.getElementById('ownerSubscriptionForm').addEventListener('submit', handleSubscriptionSubmit);
  document.getElementById('ownerLicenseForm').addEventListener('submit', handleLicenseSubmit);
  document.getElementById('ownerApiKeyForm').addEventListener('submit', handleApiKeySubmit);
  document.getElementById('ownerWebhookForm').addEventListener('submit', handleWebhookSubmit);
  document.getElementById('ownerWebhookTestForm').addEventListener('submit', handleWebhookTestSubmit);
  document.getElementById('ownerMarketplaceForm').addEventListener('submit', handleMarketplaceSubmit);
  document.getElementById('ownerRestartForm').addEventListener('submit', handleRestartSubmit);
  document.getElementById('ownerRuntimeFlagsForm')?.addEventListener('submit', handleRuntimeFlagsSubmit);
  document.getElementById('ownerPortalAccessForm')?.addEventListener('submit', handlePortalAccessSubmit);
  document.getElementById('ownerRconAgentForm')?.addEventListener('submit', handleRconAgentSubmit);
  document.getElementById('ownerSecurityPolicyForm').addEventListener('submit', handleSecurityPolicySubmit);
  document.getElementById('ownerMonitoringPolicyForm').addEventListener('submit', handleMonitoringPolicySubmit);
  document.getElementById('ownerOpsLogLanguageForm')?.addEventListener('submit', handleOpsLogLanguageSubmit);
  document.getElementById('ownerSessionRevokeForm').addEventListener('submit', handleSessionRevokeSubmit);
  document.getElementById('ownerAdminUserForm').addEventListener('submit', handleAdminUserSubmit);
  document.getElementById('ownerAuditQueryForm').addEventListener('submit', handleAuditQuerySubmit);
  document.getElementById('ownerAuditExportJsonBtn').addEventListener('click', () => exportAudit('json'));
  document.getElementById('ownerAuditExportCsvBtn').addEventListener('click', () => exportAudit('csv'));
  document.getElementById('ownerBackupCreateForm').addEventListener('submit', handleBackupCreateSubmit);
  document.getElementById('ownerBackupPreviewForm').addEventListener('submit', handleBackupPreviewSubmit);
  document.getElementById('ownerTenantCreateForm').addEventListener('submit', handleTenantCreateSubmit);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshSurface({ silent: true });
      palette.refresh();
    }
  });

  intervalHandle = window.setInterval(() => {
    if (!document.hidden) {
      refreshSurface({ silent: true });
    }
  }, 45000);

  window.addEventListener('beforeunload', () => {
    if (liveConnection) {
      liveConnection.close();
    }
    if (intervalHandle) {
      window.clearInterval(intervalHandle);
    }
  });

  window.addEventListener('ui-language-change', () => {
    workspaceController?.refresh?.();
    sidebarController?.refresh?.();
    palette.refresh();
    renderAll();
  });

  refreshSurface();
})();
