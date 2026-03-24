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
    getDeliveryCaseOperationalPhase,
  } = window.AdminOperationalStateModel || {};

  const t = (key, fallback, params) => window.AdminUiI18n?.t?.(key, fallback, params) ?? fallback ?? key;

  // UI-only state for the tenant surface.
  // When editing this page later, follow the pattern:
  // state -> render* function -> matching HTML section.
  const state = {
    me: null,
    overview: null,
    reconcile: null,
    quota: null,
    tenantConfig: null,
    subscriptions: [],
    licenses: [],
    apiKeys: [],
    webhooks: [],
    agents: [],
    dashboardCards: null,
    shopItems: [],
    queueItems: [],
    deadLetters: [],
    deliveryLifecycle: null,
    players: [],
    notifications: [],
    deliveryRuntime: null,
    purchaseStatusCatalog: { knownStatuses: [], allowedTransitions: [] },
    purchaseLookup: {
      userId: '',
      status: '',
      items: [],
    },
    deliveryCase: null,
    deliveryLabResult: null,
    integrationResult: null,
    bulkDeliveryResult: null,
    audit: null,
    auditFilters: {
      view: 'wallet',
      userId: '',
      query: '',
      windowMs: '604800000',
    },
    incidentFilters: {
      severity: '',
      kind: '',
      source: '',
    },
    configPreview: null,
    configEditorDirty: false,
    liveEvents: [],
  };

  let liveConnection = null;
  let refreshTimer = null;
  let intervalHandle = null;
  let workspaceController = null;
  let sidebarController = null;

  function getTenantId() {
    return encodeURIComponent(String(state.me?.tenantId || '').trim());
  }

  async function safeApi(path, fallback) {
    try {
      return await api(path);
    } catch {
      return fallback;
    }
  }

  function listFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  // Delivery lifecycle is intentionally summarized separately from the raw
  // queue/dead-letter tables so operators can get one quick read first.
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

  // Action planner keys come from the shared lifecycle report so the UI can
  // stay consistent without duplicating queue/dead-letter heuristics here.
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
        'deliveryLifecycle.action.reviewRuntimeBeforeRetryDetail',
        'Check runtime readiness, delivery lab, and queue pressure before replaying overdue work.',
      );
    }
    if (key === 'retry-queue-batch') {
      return t(
        'deliveryLifecycle.action.retryQueueBatchDetail',
        'Populate the bulk recovery form with queue jobs that look retryable after runtime review.',
      );
    }
    if (key === 'retry-dead-letter-batch') {
      return t(
        'deliveryLifecycle.action.retryDeadLetterBatchDetail',
        'Populate the bulk recovery form with dead-letter entries that are still marked retryable.',
      );
    }
    if (key === 'hold-poison-candidates') {
      return t(
        'deliveryLifecycle.action.holdPoisonCandidatesDetail',
        'Do not replay these blindly. Export the lifecycle snapshot and inspect one delivery case first.',
      );
    }
    if (key === 'inspect-top-error') {
      return t(
        'deliveryLifecycle.action.inspectTopErrorDetail',
        'Use Delivery Lab and runtime evidence to understand the most repeated error signature before retrying.',
      );
    }
    return t(
      'deliveryLifecycle.action.lifecycleStableDetail',
      'No immediate queue or dead-letter intervention is recommended from this lifecycle snapshot.',
    );
  }

  function openTenantTarget(sectionId, options = {}) {
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

  function openDeliveryLifecycleExport(format = 'json') {
    const query = new URLSearchParams({
      tenantId: String(state.me?.tenantId || '').trim(),
      format: String(format || 'json').trim() || 'json',
    });
    window.open(
      `/admin/api/delivery/lifecycle/export?${query.toString()}`,
      '_blank',
      'noopener,noreferrer',
    );
    showToast(
      t('tenant.toast.deliveryLifecycleExportStarted', 'Delivery lifecycle export opened.'),
      'info',
    );
  }

  function populateBulkDeliveryForm(action, codes) {
    const form = document.getElementById('tenantDeliveryBulkForm');
    const list = Array.from(new Set((Array.isArray(codes) ? codes : []).map((value) => String(value || '').trim()).filter(Boolean)));
    if (!form || list.length === 0) {
      showToast(t('tenant.toast.noLifecycleCodes', 'No lifecycle codes are ready for this action yet.'), 'info');
      return;
    }
    form.elements.action.value = action;
    form.elements.codes.value = list.join('\n');
    openTenantTarget('actions', { targetId: 'tenantDeliveryBulkForm', block: 'center' });
    showToast(t('tenant.toast.bulkRecoveryPrepared', 'Bulk recovery form prepared.'), 'success');
  }

  function tenantNavLabel(sectionId) {
    return String(document.querySelector(`#tenantNavList a[href="#${sectionId}"]`)?.textContent || '').trim() || sectionId;
  }

  function stringifyJson(value) {
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
      return '';
    }
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  function summarizeQuotaEntry(entry) {
    if (!entry || typeof entry !== 'object') return '-';
    if (entry.unlimited) return `${formatNumber(entry.used, '0')} / unlimited`;
    return `${formatNumber(entry.used, '0')} / ${formatNumber(entry.limit, '0')}`;
  }

  function quotaTone(entry) {
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

  function normalizeIncidentSeverity(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'warning') return 'warn';
    if (text === 'danger' || text === 'failed') return 'error';
    return text || 'info';
  }

  function getTenantRuntimeStatus() {
    return String(
      state.deliveryRuntime?.delivery?.status
      || state.deliveryRuntime?.status
      || state.deliveryRuntime?.mode
      || 'ready'
    ).trim();
  }

  function isHealthyTenantRuntimeStatus(value) {
    return ['ready', 'ok', 'healthy', 'connected', 'active'].includes(String(value || '').trim().toLowerCase());
  }

  function formatTenantRuntimeStatus(value) {
    const status = String(value || '').trim();
    const normalized = status.toLowerCase();
    if (!status) return t('tenant.runtime.status.unknown', 'unknown');
    if (['ready', 'ok', 'healthy', 'connected', 'active'].includes(normalized)) {
      return t('tenant.runtime.status.ready', 'ready');
    }
    if (['warn', 'warning', 'pending', 'degraded', 'queued', 'review', 'delivering'].includes(normalized)) {
      return t('tenant.runtime.status.attention', 'attention');
    }
    if (['error', 'failed', 'offline', 'inactive', 'disconnected', 'danger'].includes(normalized)) {
      return t('tenant.runtime.status.critical', 'critical');
    }
    return status;
  }

  function getTenantScopedNotifications() {
    const tenantId = String(state.me?.tenantId || '').trim();
    if (!tenantId) return [];
    return state.notifications.filter((item) => {
      const itemTenantId = String(
        item?.tenantId
        || item?.data?.tenantId
        || item?.data?.tenant?.id
        || ''
      ).trim();
      return itemTenantId === tenantId;
    });
  }

  // Incident rows are composed from existing tenant-scoped sources only.
  // This keeps the tenant inbox useful without leaking owner-only signals.
  function buildTenantIncidentRows() {
    const reconcileGeneratedAt = state.reconcile?.generatedAt || new Date().toISOString();
    const rows = [
      ...getTenantScopedNotifications().map((item) => {
        const localized = localizeAdminNotification(item);
        return {
          id: item.id || null,
          source: 'notification',
          kind: item.kind || item.type || 'notification',
          severity: normalizeIncidentSeverity(item.severity),
          title: localized.title || t('tenant.incident.notification', 'Tenant notification'),
          detail: localized.detail || '',
          code: item.entityKey || item.id || '-',
          at: item.createdAt || item.at || reconcileGeneratedAt,
        };
      }),
      ...(Array.isArray(state.reconcile?.anomalies) ? state.reconcile.anomalies : []).map((item) => ({
        id: null,
        source: 'reconcile',
        kind: item.type || 'anomaly',
        severity: normalizeIncidentSeverity(item.severity === 'error' ? 'error' : 'warn'),
        title: item.type || t('tenant.incident.reconcileAnomaly', 'reconcile anomaly'),
        detail: item.detail || t('tenant.incident.reconcileAnomalyDetail', 'Reconcile reported an anomaly that needs tenant review.'),
        code: item.code || '-',
        at: reconcileGeneratedAt,
      })),
      ...(Array.isArray(state.reconcile?.abuseFindings) ? state.reconcile.abuseFindings : []).map((item) => ({
        id: null,
        source: 'reconcile',
        kind: item.type || 'abuse-finding',
        severity: 'warn',
        title: item.type || t('tenant.incident.abuseFinding', 'abuse finding'),
        detail: `count=${item.count || '-'} threshold=${item.threshold || '-'} user=${item.userId || '-'} item=${item.itemId || '-'}`,
        code: item.userId || item.itemId || '-',
        at: reconcileGeneratedAt,
      })),
      ...state.queueItems.map((item) => ({
        id: null,
        source: 'queue',
        kind: item.status || 'queued',
        severity: 'warn',
        title: item.purchaseCode || item.code || t('tenant.incident.queuedDelivery', 'Queued delivery'),
        detail: item.reason || item.status || t('tenant.incident.queuedDeliveryDetail', 'Queued delivery still waiting for completion.'),
        code: item.purchaseCode || item.code || '-',
        at: item.updatedAt || item.createdAt || reconcileGeneratedAt,
      })),
      ...state.deadLetters.map((item) => ({
        id: null,
        source: 'dead-letter',
        kind: item.type || 'dead-letter',
        severity: 'error',
        title: item.purchaseCode || item.code || t('tenant.incident.deadLetter', 'Dead letter'),
        detail: item.reason || item.errorCode || t('tenant.incident.deadLetterDetail', 'Delivery moved to dead-letter state.'),
        code: item.purchaseCode || item.code || '-',
        at: item.updatedAt || item.createdAt || reconcileGeneratedAt,
      })),
    ];

    const runtimeStatus = String(
      state.deliveryRuntime?.delivery?.status
      || state.deliveryRuntime?.status
      || state.deliveryRuntime?.mode
      || ''
    ).trim();
    const runtimeTone = normalizeIncidentSeverity(runtimeStatus);
    if (runtimeStatus && !['ready', 'ok', 'healthy', 'connected', 'active'].includes(runtimeStatus.toLowerCase())) {
      rows.push({
        id: null,
        source: 'runtime',
        kind: 'runtime-state',
        severity: runtimeTone === 'info' ? 'warn' : runtimeTone,
        title: t('tenant.incident.runtimeAttention', 'Delivery runtime needs attention'),
        detail: t(
          'tenant.incident.runtimeAttentionDetail',
          'Runtime reported {status}. Review queue pressure and delivery lab before retrying purchases.',
          { status: runtimeStatus }
        ),
        code: String(state.deliveryRuntime?.delivery?.mode || state.deliveryRuntime?.mode || 'runtime').trim(),
        at: state.deliveryRuntime?.updatedAt || reconcileGeneratedAt,
      });
    }

    return rows
      .filter(Boolean)
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime());
  }

  function getFilteredTenantIncidents() {
    const filters = state.incidentFilters || {};
    const severity = normalizeIncidentSeverity(filters.severity);
    const kind = String(filters.kind || '').trim().toLowerCase();
    const source = String(filters.source || '').trim().toLowerCase();
    return buildTenantIncidentRows().filter((item) => {
      if (severity && normalizeIncidentSeverity(item.severity) !== severity) return false;
      if (kind && !`${item.kind || ''} ${item.title || ''}`.toLowerCase().includes(kind)) return false;
      if (source && String(item.source || '').trim().toLowerCase() !== source) return false;
      return true;
    });
  }

  function buildTenantIncidentCsv(rows = []) {
    const headers = ['severity', 'source', 'kind', 'title', 'detail', 'code', 'at'];
    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [
      headers.join(','),
      ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(',')),
    ].join('\n');
  }

  // Keep the top-line tenant pressure logic in one place so the header banner
  // and snapshot cards stay aligned when we tune the console later.
  function getTenantOperationalSnapshot() {
    const queueDepth = state.queueItems.length;
    const deadCount = state.deadLetters.length;
    const alertCount = getTenantScopedNotifications().length;
    const runtimeStatus = getTenantRuntimeStatus();
    const runtimeHealthy = isHealthyTenantRuntimeStatus(runtimeStatus);
    const runtimeLabel = formatTenantRuntimeStatus(runtimeStatus);
    const summary = state.reconcile?.summary || {};
    const anomalyCount = Number(summary.anomalies || 0);
    const abuseCount = Number(summary.abuseFindings || 0);
    const incidentRows = buildTenantIncidentRows();
    const incidentCount = incidentRows.length;
    const criticalCount = incidentRows.filter((item) => normalizeIncidentSeverity(item.severity) === 'error').length;
    const warningCount = incidentRows.filter((item) => normalizeIncidentSeverity(item.severity) === 'warn').length;
    const tone = criticalCount > 0 || deadCount > 0 || !runtimeHealthy
      ? 'danger'
      : queueDepth > 0 || anomalyCount > 0 || alertCount > 0 || warningCount > 0
        ? 'warning'
        : 'success';
    return {
      queueDepth,
      deadCount,
      alertCount,
      anomalyCount,
      abuseCount,
      incidentCount,
      criticalCount,
      warningCount,
      runtimeStatus,
      runtimeLabel,
      runtimeHealthy,
      tone,
    };
  }

  function tenantIncidentActionForItem(item) {
    const source = String(item?.source || '').trim().toLowerCase();
    if (source === 'dead-letter' || source === 'queue') {
      return { label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('commerce') }), targetId: 'commerce' };
    }
    if (source === 'reconcile') {
      return { label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('audit') }), targetId: 'audit' };
    }
    if (source === 'runtime') {
      return { label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('sandbox') }), targetId: 'sandbox' };
    }
    return { label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('operations') }), targetId: 'operations' };
  }

  function downloadClientFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  function renderResultPanel(container, result, emptyText) {
    if (!container) return;
    if (!result) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(emptyText || t('tenant.result.empty', 'No result yet.'))}</div>`;
      return;
    }
    const rows = Array.isArray(result.rows) ? result.rows : [];
    container.innerHTML = [
      '<article class="feed-item">',
      `<div class="feed-meta">${makePill(result.kind || 'result', 'info')} <span class="code">${escapeHtml(formatDateTime(result.createdAt))}</span></div>`,
      `<strong>${escapeHtml(result.title || 'Result')}</strong>`,
      result.detail ? `<div class="muted">${escapeHtml(result.detail)}</div>` : '',
      '</article>',
      ...(rows.length > 0
        ? rows.map((row) => [
            '<article class="feed-item">',
            `<strong>${escapeHtml(row.label || 'Value')}</strong>`,
            `<div class="${row.code ? 'code muted' : 'muted'}">${escapeHtml(row.value || '-')}</div>`,
            '</article>',
          ].join(''))
        : [`<div class="empty-state">${escapeHtml(t('tenant.result.detailsEmpty', 'No result details.'))}</div>`]),
    ].join('');
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

  function formatAuditCell(key, value) {
    if (value == null || value === '') return '-';
    if (Array.isArray(value)) return value.join(', ') || '-';
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

  function setBanner(title, detail, tags, tone) {
    const banner = document.getElementById('tenantStatusBanner');
    const tagWrap = document.getElementById('tenantStatusTags');
    document.getElementById('tenantStatusTitle').textContent = title;
    document.getElementById('tenantStatusDetail').textContent = detail;
    banner.className = `status-banner banner-${tone || 'info'}`;
    tagWrap.innerHTML = (Array.isArray(tags) ? tags : []).map((tag) => makePill(tag)).join('');
  }

  function fillConfigForm(force = false) {
    const form = document.getElementById('tenantConfigForm');
    if (!form) return;
    if (state.configEditorDirty && !force) return;
    form.elements.featureFlags.value = stringifyJson(state.tenantConfig?.featureFlags);
    form.elements.configPatch.value = stringifyJson(state.tenantConfig?.configPatch);
    form.elements.portalEnvPatch.value = stringifyJson(state.tenantConfig?.portalEnvPatch);
    state.configPreview = null;
    state.configEditorDirty = false;
    renderConfigPreview();
  }

  function summarizeConfigDiff(currentValue, draftValue, label) {
    if (draftValue == null) {
      return null;
    }
    const current = currentValue && typeof currentValue === 'object' ? currentValue : {};
    const draft = draftValue && typeof draftValue === 'object' ? draftValue : {};
    const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(draft)]));
    const changedKeys = keys.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(draft[key]));
    return {
      label,
      changedKeys,
      changedCount: changedKeys.length,
      draftKeys: Object.keys(draft).length,
    };
  }

  function buildConfigPreview() {
    const form = document.getElementById('tenantConfigForm');
    if (!form) return null;
    const featureFlags = parseOptionalJson(form.elements.featureFlags.value, 'Feature Flags');
    const configPatch = parseOptionalJson(form.elements.configPatch.value, 'Config Patch');
    const portalEnvPatch = parseOptionalJson(form.elements.portalEnvPatch.value, 'Portal Env Patch');
    const sections = [
      summarizeConfigDiff(state.tenantConfig?.featureFlags, featureFlags, 'Feature Flags'),
      summarizeConfigDiff(state.tenantConfig?.configPatch, configPatch, 'Config Patch'),
      summarizeConfigDiff(state.tenantConfig?.portalEnvPatch, portalEnvPatch, 'Portal Env Patch'),
    ].filter(Boolean);
    return {
      createdAt: new Date().toISOString(),
      sections,
      hasChanges: sections.some((section) => section.changedCount > 0),
    };
  }

  function renderConfigPreview() {
    const wrap = document.getElementById('tenantConfigPreview');
    if (!wrap) return;
    const preview = state.configPreview;
    if (!preview) {
      wrap.innerHTML = '<div class="empty-state">Preview tenant config changes here before saving. Live values stay in place until you confirm.</div>';
      return;
    }
    if (!preview.sections.length) {
      wrap.innerHTML = '<div class="empty-state">No JSON patch groups were provided. Leave a field empty to skip it, or add valid JSON to preview changes.</div>';
      return;
    }
    wrap.innerHTML = preview.sections.map((section) => {
      const tone = section.changedCount > 0 ? 'warning' : 'success';
      return [
        '<article class="kv-card">',
        `<div class="feed-meta">${makePill(section.label, tone)} <span class="code">${escapeHtml(formatDateTime(preview.createdAt))}</span></div>`,
        `<strong>${escapeHtml(section.changedCount > 0 ? `${section.changedCount} top-level changes` : 'No live diff detected')}</strong>`,
        `<div class="muted">Draft keys: ${escapeHtml(formatNumber(section.draftKeys, '0'))}</div>`,
        section.changedKeys.length
          ? `<div class="tag-row">${section.changedKeys.slice(0, 8).map((key) => makePill(key, 'info')).join('')}</div>`
          : '<div class="muted">Draft matches current live values for this section.</div>',
        '</article>',
      ].join('');
    }).join('');
  }

  // Tenant overview stays intentionally narrow: identity, commerce pressure,
  // player support context, and quota posture. Anything deeper lives in the
  // dedicated pages behind the left menu.
  function renderOverview() {
    const analytics = state.overview?.analytics || {};
    const delivery = analytics.delivery || {};
    const quota = state.quota?.quotas || {};
    const ops = getTenantOperationalSnapshot();
    const linkedPlayers = state.players.filter((item) => item?.steamId || item?.steam_id || item?.steam?.id).length;
    renderStats(document.getElementById('tenantOverviewStats'), [
      {
        kicker: t('tenant.overview.identity.kicker', 'Tenant'),
        value: state.tenantConfig?.name || state.me?.tenantId || '-',
        title: t('tenant.overview.identity.title', 'Scoped tenant identity'),
        detail: t('tenant.overview.identity.detail', 'Every action on this surface stays bound to the signed-in tenant scope.'),
        tags: [
          t('tenant.overview.identity.roleTag', 'role {role}', { role: state.me?.role || '-' }),
          state.me?.tenantId || t('tenant.overview.identity.scopeTag', 'tenant scoped'),
        ],
      },
      {
        kicker: t('tenant.overview.operations.kicker', 'Operations'),
        value: formatNumber(ops.incidentCount, '0'),
        title: t('tenant.overview.operations.title', 'Open tenant attention items'),
        detail: ops.tone === 'success'
          ? t('tenant.overview.operations.detailCalm', 'Runtime is ready and no tenant-safe incidents are currently open.')
          : t('tenant.overview.operations.detailBusy', 'Runtime attention, queue pressure, reconcile findings, and tenant alerts are grouped here first.'),
        tags: [
          t('tenant.overview.operations.runtimeTag', 'runtime {status}', { status: ops.runtimeLabel }),
          t('tenant.overview.operations.alertsTag', 'alerts {count}', { count: formatNumber(ops.alertCount, '0') }),
          t('tenant.overview.operations.criticalTag', 'critical {count}', { count: formatNumber(ops.criticalCount, '0') }),
        ],
      },
      {
        kicker: t('tenant.overview.commerce.kicker', 'Commerce'),
        value: formatNumber(state.dashboardCards?.metrics?.purchaseCount, formatNumber(delivery.purchaseCount30d, '0')),
        title: t('tenant.overview.commerce.title', 'Visible purchase workload'),
        detail: t('tenant.overview.commerce.detail', 'Recent tenant purchase and delivery pressure.'),
        tags: [
          t('tenant.overview.commerce.queueTag', 'queue {count}', { count: formatNumber(state.queueItems.length, '0') }),
          t('tenant.overview.commerce.deadTag', 'dead {count}', { count: formatNumber(state.deadLetters.length, '0') }),
          t('tenant.overview.commerce.successTag', 'success {value}%', { value: formatNumber(delivery.successRate, '0') }),
        ],
      },
      {
        kicker: t('tenant.overview.players.kicker', 'Players'),
        value: formatNumber(state.players.length, '0'),
        title: t('tenant.overview.players.title', 'Known player accounts'),
        detail: t('tenant.overview.players.detail', 'Use for support, Steam-link follow-up, and transaction tracing.'),
        tags: [
          t('tenant.overview.players.catalogTag', 'catalog {count}', { count: formatNumber(state.shopItems.length, '0') }),
          t('tenant.overview.players.linkedTag', 'linked {count}', { count: formatNumber(linkedPlayers, '0') }),
        ],
      },
      {
        kicker: t('tenant.overview.quota.kicker', 'Quota'),
        value: quota?.apiKeys ? `${formatNumber(quota.apiKeys.used, '0')}/${formatNumber(quota.apiKeys.limit, 'unlimited')}` : '-',
        title: t('tenant.overview.quota.title', 'Tenant quota posture'),
        detail: t('tenant.overview.quota.detail', 'API keys, webhooks, runtimes, and related scoped platform allowances.'),
        tags: [
          quota?.webhooks
            ? t('tenant.overview.quota.hooksTag', 'hooks {used}/{limit}', {
                used: formatNumber(quota.webhooks.used, '0'),
                limit: formatNumber(quota.webhooks.limit, 'unlimited'),
              })
            : t('tenant.overview.quota.hooksEmpty', 'hooks -'),
          quota?.agentRuntimes
            ? t('tenant.overview.quota.runtimesTag', 'runtimes {used}/{limit}', {
                used: formatNumber(quota.agentRuntimes.used, '0'),
                limit: formatNumber(quota.agentRuntimes.limit, 'unlimited'),
              })
            : t('tenant.overview.quota.runtimesEmpty', 'runtimes -'),
        ],
      },
    ]);
    renderQuickActions();
  }

  function renderQuickActions() {
    const container = document.getElementById('tenantQuickActions');
    if (!container) return;
    const items = [
      {
        key: 'delivery-stuck',
        tone: 'warning',
        tag: t('tenant.quickAction.tag.delivery', 'delivery'),
        title: t('tenant.quickAction.deliveryStuck.title', 'Delivery stuck'),
        detail: t('tenant.quickAction.deliveryStuck.detail', 'Open one delivery case first, then decide whether to retry, use delivery lab, or gather audit evidence.'),
        button: t('tenant.quickAction.deliveryStuck.button', 'Open delivery case'),
      },
      {
        key: 'wallet-mismatch',
        tone: 'info',
        tag: t('tenant.quickAction.tag.support', 'support'),
        title: t('tenant.quickAction.walletMismatch.title', 'Wallet mismatch'),
        detail: t('tenant.quickAction.walletMismatch.detail', 'Jump straight to the wallet support form for scoped balance fixes or ledger follow-up.'),
        button: t('tenant.quickAction.walletMismatch.button', 'Open wallet support'),
      },
      {
        key: 'steam-link-issue',
        tone: 'warning',
        tag: t('tenant.quickAction.tag.support', 'support'),
        title: t('tenant.quickAction.steamLink.title', 'Steam link issue'),
        detail: t('tenant.quickAction.steamLink.detail', 'Open the Steam link support form first when in-game delivery readiness depends on player identity data.'),
        button: t('tenant.quickAction.steamLink.button', 'Open Steam support'),
      },
      {
        key: 'restart-announcement',
        tone: 'info',
        tag: t('tenant.quickAction.tag.actions', 'actions'),
        title: t('tenant.quickAction.restartAnnouncement.title', 'Restart announcement'),
        detail: t('tenant.quickAction.restartAnnouncement.detail', 'Use the guided restart preset in this console before you announce downtime or run maintenance checks.'),
        button: t('tenant.quickAction.restartAnnouncement.button', 'Open restart preset'),
      },
    ];
    container.innerHTML = items.map((item) => [
      '<article class="quick-action-card">',
      `<div class="feed-meta">${makePill(item.tag, item.tone)}</div>`,
      `<strong>${escapeHtml(item.title)}</strong>`,
      `<p>${escapeHtml(item.detail)}</p>`,
      `<div class="button-row"><button type="button" class="button button-primary" data-tenant-quick-action="${escapeHtml(item.key)}">${escapeHtml(item.button)}</button></div>`,
      '</article>',
    ].join('')).join('');
  }

  function runTenantQuickAction(actionKey) {
    const key = String(actionKey || '').trim();
    if (key === 'delivery-stuck') {
      openTenantTarget('transactions', { targetId: 'tenantDeliveryCaseForm', block: 'center' });
      return;
    }
    if (key === 'wallet-mismatch') {
      openTenantTarget('support-tools', { targetId: 'tenantWalletForm', block: 'center' });
      showToast(t('tenant.toast.walletSupportFocused', 'Wallet support form focused.'), 'info');
      return;
    }
    if (key === 'steam-link-issue') {
      openTenantTarget('support-tools', { targetId: 'tenantSteamLinkForm', block: 'center' });
      showToast(t('tenant.toast.steamSupportFocused', 'Steam support form focused.'), 'info');
      return;
    }
    if (key === 'restart-announcement') {
      openTenantTarget('support-tools', { targetId: 'tenantRestartPresetBtn', block: 'center' });
    }
  }

  function renderInsights() {
    const reconcile = state.reconcile || {};
    const summary = reconcile.summary || {};
    const analytics = state.overview?.analytics || {};
    const delivery = analytics.delivery || {};

    renderStats(document.getElementById('tenantInsightStats'), [
      {
        kicker: t('tenant.insight.reconcile.kicker', 'Reconcile'),
        value: formatNumber(summary.anomalies, '0'),
        title: t('tenant.insight.reconcile.title', 'Active anomalies'),
        detail: t('tenant.insight.reconcile.detail', 'Tenant-only reconcile findings for purchase, queue, dead-letter, and audit posture.'),
        tags: [
          t('tenant.insight.reconcile.abuseTag', 'abuse {count}', { count: formatNumber(summary.abuseFindings, '0') }),
          t('tenant.insight.reconcile.queueTag', 'queue {count}', { count: formatNumber(summary.queueJobs, '0') }),
        ],
      },
      {
        kicker: t('tenant.insight.delivery.kicker', 'Delivery'),
        value: `${formatNumber(delivery.successRate, '0')}%`,
        title: t('tenant.insight.delivery.title', 'Recent delivery success'),
        detail: t('tenant.insight.delivery.detail', 'Tenant analytics success signal across scoped purchases.'),
        tags: [
          t('tenant.insight.delivery.windowTag', '30d {count} purchases', { count: formatNumber(delivery.purchaseCount30d, '0') }),
          t('tenant.insight.delivery.deadTag', 'dead {count}', { count: formatNumber(summary.deadLetters, '0') }),
        ],
      },
      {
        kicker: t('tenant.insight.webhookQuota.kicker', 'Quota'),
        value: state.quota?.quotas?.webhooks
          ? `${formatNumber(state.quota.quotas.webhooks.used, '0')}/${formatNumber(state.quota.quotas.webhooks.limit, 'unlimited')}`
          : '-',
        title: t('tenant.insight.webhookQuota.title', 'Webhook quota posture'),
        detail: t('tenant.insight.webhookQuota.detail', 'Useful when integrations, alerts, or external feeds are nearing tenant allowance.'),
      },
      {
        kicker: t('tenant.insight.window.kicker', 'Window'),
        value: summary.windowMs ? `${formatNumber(Math.round(Number(summary.windowMs || 0) / 60000), '0')}m` : '-',
        title: t('tenant.insight.window.title', 'Current reconcile window'),
        detail: t('tenant.insight.window.detail', 'Scoped abuse heuristics and anomaly grouping are window-bound.'),
      },
    ]);

    const findingRows = [
      ...(Array.isArray(reconcile.anomalies) ? reconcile.anomalies : []).map((item) => ({
        tone: item.severity === 'error' ? 'danger' : 'warning',
        title: item.type || 'anomaly',
        detail: `${item.code || '-'} | ${item.detail || ''}`.trim(),
        at: reconcile.generatedAt,
      })),
      ...(Array.isArray(reconcile.abuseFindings) ? reconcile.abuseFindings : []).map((item) => ({
        tone: 'warning',
        title: item.type || 'abuse-finding',
        detail: `${item.userId || item.itemId || '-'} | count=${item.count || '-'} threshold=${item.threshold || '-'}`,
        at: reconcile.generatedAt,
      })),
    ].slice(0, 12);

    renderList(
      document.getElementById('tenantReconcileFeed'),
      findingRows,
      (item) => [
        `<article class="timeline-item ${escapeHtml(item.tone || 'info')}">`,
        `<div class="feed-meta">${makePill(item.title || t('tenant.insights.findingTag', 'finding'))} <span class="code">${escapeHtml(formatDateTime(item.at))}</span></div>`,
        `<strong>${escapeHtml(item.title || t('tenant.insights.findingTitle', 'Finding'))}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('tenant.insights.empty', 'No reconcile anomalies or abuse signals for this tenant right now.')
    );

    document.getElementById('tenantInsightCards').innerHTML = [
      {
        title: t('tenant.insights.queueHealthTitle', 'Queue Health'),
        text: t('tenant.insights.queueHealthText', 'Queue jobs: {queue}. Dead letters: {dead}. Use Delivery Recovery for direct intervention.', {
          queue: formatNumber(summary.queueJobs, '0'),
          dead: formatNumber(summary.deadLetters, '0'),
        }),
      },
      {
        title: t('tenant.insights.auditPostureTitle', 'Audit Posture'),
        text: t('tenant.insights.auditPostureText', 'Delivered-without-audit and stuck-without-runtime-state are treated as tenant attention items so operators can react before players escalate.'),
      },
      {
        title: t('tenant.insights.quotaContextTitle', 'Quota Context'),
        text: t('tenant.insights.quotaContextText', 'API key, webhook, and agent-runtime quota posture stays visible on this surface without exposing platform-wide tenancy data.'),
      },
    ].map((card) => [
      '<article class="kv-card">',
      `<h3>${escapeHtml(card.title)}</h3>`,
      `<p>${escapeHtml(card.text)}</p>`,
      '</article>',
    ].join('')).join('');
  }

  function renderDeliveryLifecycle() {
    const report = state.deliveryLifecycle || {};
    const summary = report.summary || {};
    const runtime = report.runtime || {};

    renderStats(document.getElementById('tenantDeliveryLifecycleStats'), [
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
      document.getElementById('tenantDeliveryLifecycleSignals'),
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
      document.getElementById('tenantDeliveryLifecycleErrors'),
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
      document.getElementById('tenantDeliveryLifecycleActions'),
      Array.isArray(report.actionPlan?.actions) ? report.actionPlan.actions : [],
      (item) => {
        const codes = Array.isArray(item.codes) ? item.codes.filter(Boolean) : [];
        const firstCode = codes[0] || '';
        const actionButtons = [];
        if (item.key === 'review-runtime-before-retry' || item.key === 'inspect-top-error') {
          actionButtons.push(
            `<button type="button" class="button" data-tenant-lifecycle-nav="sandbox">${escapeHtml(t('deliveryLifecycle.action.openDeliveryLab', 'Open Delivery Lab'))}</button>`,
          );
        }
        if (item.key === 'retry-queue-batch' && codes.length > 0) {
          actionButtons.push(
            `<button type="button" class="button button-warning" data-tenant-lifecycle-bulk="retry-many" data-codes="${escapeHtml(codes.join(','))}">${escapeHtml(t('deliveryLifecycle.action.fillQueueRetry', 'Fill Queue Retry'))}</button>`,
          );
        }
        if (item.key === 'retry-dead-letter-batch' && codes.length > 0) {
          actionButtons.push(
            `<button type="button" class="button button-warning" data-tenant-lifecycle-bulk="dead-letter-retry-many" data-codes="${escapeHtml(codes.join(','))}">${escapeHtml(t('deliveryLifecycle.action.fillDeadRetry', 'Fill Dead-letter Retry'))}</button>`,
          );
        }
        if (item.key === 'hold-poison-candidates') {
          if (firstCode) {
            actionButtons.push(
              `<button type="button" class="button" data-tenant-lifecycle-case="${escapeHtml(firstCode)}">${escapeHtml(t('deliveryLifecycle.action.openDeliveryCase', 'Open Delivery Case'))}</button>`,
            );
          }
          actionButtons.push(
            `<button type="button" class="button" data-tenant-lifecycle-export="json">${escapeHtml(t('deliveryLifecycle.action.exportJson', 'Export JSON'))}</button>`,
          );
        }
        if (item.key === 'lifecycle-stable') {
          actionButtons.push(
            `<button type="button" class="button" data-tenant-lifecycle-nav="transactions">${escapeHtml(t('deliveryLifecycle.action.openTransactions', 'Open Transactions'))}</button>`,
          );
        }
        const codePreview = codes.length
          ? `<div class="code-preview-row">${codes.slice(0, 4).map((code) => makePill(code, 'neutral')).join('')}${codes.length > 4 ? makePill(`+${formatNumber(codes.length - 4, '0')}`, 'info') : ''}</div>`
          : '';
        return [
          '<article class="feed-item">',
          `<div class="feed-meta">${makePill(deliveryLifecycleActionLabel(item.key), item.tone || 'info')} ${makePill(formatNumber(item.count, '0'), 'neutral')}</div>`,
          `<strong>${escapeHtml(deliveryLifecycleActionLabel(item.key))}</strong>`,
          `<div class="muted">${escapeHtml(deliveryLifecycleActionDetail(item))}</div>`,
          item.topErrorKey ? `<div class="muted code">${escapeHtml(item.topErrorKey)}</div>` : '',
          codePreview,
          actionButtons.length ? `<div class="button-row button-row-compact">${actionButtons.join('')}</div>` : '',
          '</article>',
        ].join('');
      },
      t('deliveryLifecycle.emptyActions', 'No lifecycle actions are suggested right now.'),
    );
  }

  function renderPlanIntegrations() {
    const quotaEntries = Object.entries(state.quota?.quotas || {});
    const pressuredQuotaCount = quotaEntries.filter(([, entry]) => {
      const tone = quotaTone(entry);
      return tone === 'warning' || tone === 'danger';
    }).length;
    renderStats(document.getElementById('tenantPlanStats'), [
      {
        kicker: t('tenant.planStats.planKicker', 'Plan'),
        value: state.quota?.plan?.name || state.quota?.subscription?.planId || t('tenant.planStats.noPlan', 'No plan'),
        title: t('tenant.planStats.planTitle', 'Current commercial plan'),
        detail: state.quota?.subscription?.status
          ? t('tenant.planStats.planDetailActive', 'Subscription is {status}.', { status: state.quota.subscription.status })
          : t('tenant.planStats.planDetailEmpty', 'No active subscription metadata visible in this tenant snapshot.'),
      },
      {
        kicker: t('tenant.planStats.licenseKicker', 'License'),
        value: state.quota?.license?.status || t('tenant.planStats.none', 'none'),
        title: t('tenant.planStats.licenseTitle', 'License state'),
        detail: state.quota?.license?.expiresAt
          ? t('tenant.planStats.licenseDetailExpiry', 'Expires {time}.', { time: formatDateTime(state.quota.license.expiresAt) })
          : t('tenant.planStats.licenseDetailEmpty', 'No license expiry is currently visible for this tenant.'),
      },
      {
        kicker: t('tenant.planStats.quotaKicker', 'Quota'),
        value: formatNumber(pressuredQuotaCount, '0'),
        title: t('tenant.planStats.quotaTitle', 'Allowance groups under pressure'),
        detail: t('tenant.planStats.quotaDetail', 'Useful for API key, webhook, and agent planning before the tenant hits its limit.'),
      },
      {
        kicker: t('tenant.planStats.integrationsKicker', 'Integrations'),
        value: formatNumber(state.webhooks.length + state.agents.length, '0'),
        title: t('tenant.planStats.integrationsTitle', 'Visible runtime integrations'),
        detail: t(
          'tenant.planStats.integrationsDetail',
          '{webhooks} webhooks and {agents} agent runtimes are currently visible.',
          {
            webhooks: formatNumber(state.webhooks.length, '0'),
            agents: formatNumber(state.agents.length, '0'),
          },
        ),
      },
    ]);

    renderTable(document.getElementById('tenantPlanTable'), {
      emptyText: t('tenant.planTable.empty', 'No plan or license snapshot is available for this tenant.'),
      columns: [
        {
          label: t('tenant.planTable.asset', 'Asset'),
          render: (row) => `<strong>${escapeHtml(row.label || '-')}</strong>`,
        },
        {
          label: t('tenant.planTable.value', 'Value'),
          render: (row) => escapeHtml(row.value || '-'),
        },
        {
          label: t('tenant.planTable.detail', 'Detail'),
          render: (row) => `<span class="${row.code ? 'code' : ''}">${escapeHtml(row.detail || '-')}</span>`,
        },
      ],
      rows: [
        {
          label: t('tenant.planTable.planLabel', 'Plan'),
          value: state.quota?.plan?.name || state.quota?.subscription?.planId || '-',
          detail: state.quota?.plan?.billingCycle || '-',
        },
        {
          label: t('tenant.planTable.subscriptionLabel', 'Subscription'),
          value: state.quota?.subscription?.status || '-',
          detail: formatDateTime(state.quota?.subscription?.renewsAt || state.quota?.subscription?.startedAt),
        },
        {
          label: t('tenant.planTable.licenseLabel', 'License'),
          value: state.quota?.license?.status || '-',
          detail: state.quota?.license?.licenseKey || state.quota?.license?.id || '-',
          code: true,
        },
      ],
    });

    renderTable(document.getElementById('tenantQuotaTable'), {
      emptyText: t('tenant.quotaTable.empty', 'No quota allowances found for this tenant.'),
      columns: [
        {
          label: t('tenant.quotaTable.quota', 'Quota'),
          render: ([key]) => `<strong>${escapeHtml(key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()))}</strong>`,
        },
        {
          label: t('tenant.quotaTable.usage', 'Usage'),
          render: ([, entry]) => escapeHtml(summarizeQuotaEntry(entry)),
        },
        {
          label: t('tenant.quotaTable.state', 'State'),
          render: ([, entry]) => makePill(
            entry?.unlimited
              ? t('tenant.quotaTable.unlimited', 'unlimited')
              : entry?.exceeded
                ? t('tenant.quotaTable.limitReached', 'limit reached')
                : t('tenant.quotaTable.tracked', 'tracked'),
            quotaTone(entry),
          ),
        },
      ],
      rows: quotaEntries,
    });

    renderTenantPlanGuides();

    renderTable(document.getElementById('tenantApiKeyTable'), {
      emptyText: t('tenant.apiKeyTable.empty', 'No API keys visible from this tenant scope.'),
      columns: [
        {
          label: t('tenant.apiKeyTable.key', 'Key'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.id || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.id || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('tenant.apiKeyTable.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('tenant.apiKeyTable.scopes', 'Scopes'),
          render: (row) => escapeHtml(Array.isArray(row.scopes) ? row.scopes.join(', ') : '-'),
        },
      ],
      rows: state.apiKeys.slice(0, 12),
    });

    renderTable(document.getElementById('tenantWebhookTable'), {
      emptyText: t('tenant.webhookTable.empty', 'No webhooks found for this tenant.'),
      columns: [
        {
          label: t('tenant.webhookTable.webhook', 'Webhook'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.id || '-')}</strong>`,
            `<div class="muted">${escapeHtml(row.eventType || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('tenant.webhookTable.status', 'Status'),
          render: (row) => makePill(row.enabled === false ? 'disabled' : row.status || 'active'),
        },
        {
          label: t('tenant.webhookTable.target', 'Target'),
          render: (row) => `<span class="code">${escapeHtml(row.targetUrl || '-')}</span>`,
        },
      ],
      rows: state.webhooks.slice(0, 12),
    });

    renderTable(document.getElementById('tenantAgentTable'), {
      emptyText: t('tenant.agentTable.empty', 'No tenant agent runtimes reported.'),
      columns: [
        {
          label: t('tenant.agentTable.runtime', 'Runtime'),
          render: (row) => [
            `<strong>${escapeHtml(row.runtimeKey || row.name || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.channel || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('tenant.agentTable.status', 'Status'),
          render: (row) => makePill(row.status || 'unknown'),
        },
        {
          label: t('tenant.agentTable.lastSeen', 'Last Seen'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.lastSeenAt || row.updatedAt))}</span>`,
        },
      ],
      rows: state.agents.slice(0, 12),
    });

    renderResultPanel(
      document.getElementById('tenantIntegrationResult'),
      state.integrationResult,
      t('tenant.integrationResult.empty', 'Create an API key or webhook to inspect the latest integration result.')
    );
  }

  function renderTenantPlanGuides() {
    const presetWrap = document.getElementById('tenantPresetGuides');
    const moduleWrap = document.getElementById('tenantModuleGuides');
    const presetItems = [
      {
        key: 'minimal-commerce',
        tone: 'success',
        tag: t('tenant.preset.tag.recommended', 'recommended'),
        title: t('tenant.preset.minimal.title', 'Minimal commerce'),
        detail: t('tenant.preset.minimal.detail', 'Start with wallet, shop, orders, and Steam link only. Use this when the tenant wants the shortest path to a stable player experience.'),
        button: t('tenant.preset.minimal.button', 'Open scoped config'),
      },
      {
        key: 'shop-vip',
        tone: 'info',
        tag: t('tenant.preset.tag.growth', 'growth'),
        title: t('tenant.preset.commerceVip.title', 'Shop + VIP starter'),
        detail: t('tenant.preset.commerceVip.detail', 'Focus on catalog, pricing, VIP access, and redeem flow when the tenant is ready for monetization but not full community automation yet.'),
        button: t('tenant.preset.commerceVip.button', 'Open commerce tools'),
      },
      {
        key: 'support-ready',
        tone: 'warning',
        tag: t('tenant.preset.tag.support', 'support'),
        title: t('tenant.preset.supportReady.title', 'Support-ready setup'),
        detail: t('tenant.preset.supportReady.detail', 'Prioritize delivery case, wallet support, Steam support, and audit visibility when operators need to resolve player issues quickly.'),
        button: t('tenant.preset.supportReady.button', 'Open support tools'),
      },
      {
        key: 'community-advanced',
        tone: 'info',
        tag: t('tenant.preset.tag.advanced', 'advanced'),
        title: t('tenant.preset.community.title', 'Community-heavy setup'),
        detail: t('tenant.preset.community.detail', 'Use the main tenant surface for core operations first, then expand into players, support, and optional modules only when the tenant needs them.'),
        button: t('tenant.preset.community.button', 'Open support tools'),
      },
    ];
    const moduleItems = [
      {
        key: 'wallet-shop',
        tone: 'success',
        tag: t('tenant.module.tag.core', 'core'),
        title: t('tenant.module.walletShop.title', 'Wallet + shop'),
        detail: t('tenant.module.walletShop.detail', 'Essential economy layer for balance visibility, catalog management, and purchase handling.'),
        button: t('tenant.module.walletShop.button', 'Open commerce'),
      },
      {
        key: 'vip',
        tone: 'info',
        tag: t('tenant.module.tag.optional', 'optional'),
        title: t('tenant.module.vip.title', 'VIP access'),
        detail: t('tenant.module.vip.detail', 'Add VIP grants and revokes only if the tenant is actively selling or managing premium access.'),
        button: t('tenant.module.vip.button', 'Open VIP tools'),
      },
      {
        key: 'redeem',
        tone: 'info',
        tag: t('tenant.module.tag.optional', 'optional'),
        title: t('tenant.module.redeem.title', 'Redeem codes'),
        detail: t('tenant.module.redeem.detail', 'Use redeem tooling when the tenant needs campaigns, giveaways, or manual code distribution without exposing owner controls.'),
        button: t('tenant.module.redeem.button', 'Open redeem tools'),
      },
      {
        key: 'steam-support',
        tone: 'warning',
        tag: t('tenant.module.tag.support', 'support'),
        title: t('tenant.module.steam.title', 'Steam identity support'),
        detail: t('tenant.module.steam.detail', 'Keep this module visible when delivery reliability depends on Steam linking and player identity hygiene.'),
        button: t('tenant.module.steam.button', 'Open Steam support'),
      },
      {
        key: 'community-pack',
        tone: 'neutral',
        tag: t('tenant.module.tag.advanced', 'advanced'),
        title: t('tenant.module.community.title', 'Community add-ons'),
        detail: t('tenant.module.community.detail', 'Treat advanced community flows as an add-on pack. Reach for them only after the tenant is comfortable with commerce, support, and delivery basics.'),
        button: t('tenant.module.community.button', 'Open advanced tools'),
      },
    ];
    if (presetWrap) {
      presetWrap.innerHTML = presetItems.map((item) => [
        '<article class="quick-action-card">',
        `<div class="feed-meta">${makePill(item.tag, item.tone)}</div>`,
        `<strong>${escapeHtml(item.title)}</strong>`,
        `<p>${escapeHtml(item.detail)}</p>`,
        `<div class="button-row"><button type="button" class="button button-primary" data-tenant-preset-action="${escapeHtml(item.key)}">${escapeHtml(item.button)}</button></div>`,
        '</article>',
      ].join('')).join('');
    }
    if (moduleWrap) {
      moduleWrap.innerHTML = moduleItems.map((item) => [
        '<article class="quick-action-card">',
        `<div class="feed-meta">${makePill(item.tag, item.tone)}</div>`,
        `<strong>${escapeHtml(item.title)}</strong>`,
        `<p>${escapeHtml(item.detail)}</p>`,
        `<div class="button-row"><button type="button" class="button" data-tenant-module-action="${escapeHtml(item.key)}">${escapeHtml(item.button)}</button></div>`,
        '</article>',
      ].join('')).join('');
    }
  }

  function runTenantPresetAction(actionKey) {
    const key = String(actionKey || '').trim();
    if (key === 'minimal-commerce') {
      openTenantTarget('config', { targetId: 'tenantConfigForm', block: 'center' });
      showToast(t('tenant.toast.presetConfigFocused', 'Scoped config editor focused.'), 'info');
      return;
    }
    if (key === 'shop-vip') {
      openTenantTarget('commerce', { targetId: 'tenantShopCreateForm', block: 'center' });
      showToast(t('tenant.toast.presetCommerceFocused', 'Commerce tools focused.'), 'info');
      return;
    }
    if (key === 'support-ready') {
      openTenantTarget('support-tools', { targetId: 'tenantWalletForm', block: 'center' });
      showToast(t('tenant.toast.presetSupportFocused', 'Support tools focused.'), 'info');
      return;
    }
    if (key === 'community-advanced') {
      openTenantTarget('support-tools');
    }
  }

  function runTenantModuleAction(actionKey) {
    const key = String(actionKey || '').trim();
    if (key === 'wallet-shop') {
      openTenantTarget('commerce', { targetId: 'tenantShopCreateForm', block: 'center' });
      return;
    }
    if (key === 'vip') {
      openTenantTarget('support-tools', { targetId: 'tenantVipForm', block: 'center' });
      return;
    }
    if (key === 'redeem') {
      openTenantTarget('support-tools', { targetId: 'tenantRedeemForm', block: 'center' });
      return;
    }
    if (key === 'steam-support') {
      openTenantTarget('support-tools', { targetId: 'tenantSteamLinkForm', block: 'center' });
      return;
    }
    if (key === 'community-pack') {
      openTenantTarget('players');
    }
  }

  function renderTables() {
    renderTable(document.getElementById('tenantShopTable'), {
      emptyText: t('tenant.table.shopEmpty', 'No shop items in this tenant.'),
      columns: [
        {
          label: t('tenant.table.item', 'Item'),
          render: (row) => [
            `<strong>${escapeHtml(row.name || row.id || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.id || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('tenant.table.kind', 'Kind'),
          render: (row) => makePill(row.kind || 'item', row.kind === 'vip' ? 'info' : 'neutral'),
        },
        {
          label: t('tenant.table.price', 'Price'),
          render: (row) => formatNumber(row.price, '0'),
        },
        {
          label: t('tenant.table.delivery', 'Delivery'),
          render: (row) => escapeHtml(row.deliveryProfile || row.gameItemId || '-'),
        },
      ],
      rows: state.shopItems.slice(0, 24),
    });

    renderTable(document.getElementById('tenantQueueTable'), {
      emptyText: t('tenant.table.queueEmpty', 'Delivery queue is empty.'),
      columns: [
        {
          label: t('tenant.table.purchase', 'Purchase'),
          render: (row) => [
            `<strong class="code">${escapeHtml(row.purchaseCode || row.code || '-')}</strong>`,
            row.userId ? `<div class="muted">${escapeHtml(row.userId)}</div>` : '',
          ].join(''),
        },
        {
          label: t('tenant.table.status', 'Status'),
          render: (row) => makePill(row.status || 'queued'),
        },
        {
          label: t('tenant.table.attempts', 'Attempts'),
          render: (row) => formatNumber(row.attempts, '0'),
        },
        {
          label: t('tenant.table.updated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</span>`,
        },
      ],
      rows: state.queueItems.slice(0, 20),
    });

    renderTable(document.getElementById('tenantDeadLetterTable'), {
      emptyText: t('tenant.table.deadLetterEmpty', 'No dead-letter entries.'),
      columns: [
        {
          label: t('tenant.table.purchase', 'Purchase'),
          render: (row) => `<strong class="code">${escapeHtml(row.purchaseCode || row.code || '-')}</strong>`,
        },
        {
          label: t('tenant.form.reason', 'Reason'),
          render: (row) => escapeHtml(row.reason || row.errorCode || '-'),
        },
        {
          label: t('tenant.table.attempts', 'Attempts'),
          render: (row) => formatNumber(row.attempts, '0'),
        },
        {
          label: t('tenant.table.updated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</span>`,
        },
      ],
      rows: state.deadLetters.slice(0, 20),
    });

    renderTable(document.getElementById('tenantPlayersTable'), {
      emptyText: t('tenant.table.playersEmpty', 'No player accounts found.'),
      columns: [
        {
          label: t('tenant.table.player', 'Player'),
          render: (row) => [
            `<strong>${escapeHtml(row.displayName || row.username || row.user || row.discordId || '-')}</strong>`,
            `<div class="muted code">${escapeHtml(row.discordId || row.userId || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('tenant.table.steam', 'Steam'),
          render: (row) => escapeHtml(row.steamId || row.inGameName || '-'),
        },
        {
          label: t('tenant.table.status', 'Status'),
          render: (row) => makePill(row.isActive === false ? 'inactive' : 'active'),
        },
        {
          label: t('tenant.table.updated', 'Updated'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.updatedAt || row.createdAt))}</span>`,
        },
      ],
      rows: state.players.slice(0, 20),
    });
  }

  function renderPurchaseStatusOptions() {
    const knownStatuses = Array.isArray(state.purchaseStatusCatalog?.knownStatuses)
      ? state.purchaseStatusCatalog.knownStatuses
      : [];
    const filterSelect = document.getElementById('tenantPurchaseFilterStatus');
    const targetSelect = document.getElementById('tenantPurchaseTargetStatus');
    if (filterSelect) {
      const current = String(filterSelect.value || state.purchaseLookup.status || '').trim();
      filterSelect.innerHTML = [
        `<option value="">${escapeHtml(t('tenant.transactions.allStatuses', 'All statuses'))}</option>`,
        ...knownStatuses.map((status) => {
          const normalized = String(status || '').trim();
          const selected = normalized && normalized === current ? ' selected' : '';
          return `<option value="${escapeHtml(normalized)}"${selected}>${escapeHtml(normalized)}</option>`;
        }),
      ].join('');
      if (current) filterSelect.value = current;
    }
    if (targetSelect) {
      const current = String(targetSelect.value || '').trim();
      targetSelect.innerHTML = [
        `<option value="">${escapeHtml(t('tenant.transactions.chooseStatus', 'Choose a status'))}</option>`,
        ...knownStatuses.map((status) => {
          const normalized = String(status || '').trim();
          const selected = normalized && normalized === current ? ' selected' : '';
          return `<option value="${escapeHtml(normalized)}"${selected}>${escapeHtml(normalized)}</option>`;
        }),
      ].join('');
      if (current) targetSelect.value = current;
    }
  }

  function renderPurchaseInspector() {
    renderPurchaseStatusOptions();
    const lookupForm = document.getElementById('tenantPurchaseLookupForm');
    if (lookupForm) {
      lookupForm.elements.userId.value = state.purchaseLookup.userId || '';
      lookupForm.elements.status.value = state.purchaseLookup.status || '';
    }
    renderTable(document.getElementById('tenantPurchaseTable'), {
      emptyText: state.purchaseLookup.userId
        ? t('tenant.transactions.emptyFiltered', 'No purchases found for this player and filter.')
        : t('tenant.transactions.emptyPrompt', 'Load purchases for a player to review transaction state.'),
      columns: [
        {
          label: t('tenant.table.purchase', 'Purchase'),
          render: (row) => [
            `<strong class="code">${escapeHtml(row.code || row.purchaseCode || '-')}</strong>`,
            `<div class="muted">${escapeHtml(row.itemName || row.itemId || row.productName || '-')}</div>`,
          ].join(''),
        },
        {
          label: t('tenant.table.status', 'Status'),
          render: (row) => makePill(row.statusText || row.status || 'unknown'),
        },
        {
          label: t('tenant.table.player', 'Player'),
          render: (row) => [
            `<div>${escapeHtml(row.userId || row.discordId || state.purchaseLookup.userId || '-')}</div>`,
            row.username ? `<div class="muted">${escapeHtml(row.username)}</div>` : '',
          ].join(''),
        },
        {
          label: t('tenant.form.amount', 'Amount'),
          render: (row) => escapeHtml(formatNumber(row.totalPrice || row.price || row.amount, '-')),
        },
        {
          label: t('tenant.table.created', 'Created'),
          render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.createdAt || row.updatedAt))}</span>`,
        },
        {
          label: t('tenant.table.actions', 'Actions'),
          render: (row) => {
            const code = String(row.code || row.purchaseCode || '').trim();
            if (!code) return `<span class="muted">${escapeHtml(t('common.none', '-'))}</span>`;
            return `<button type="button" class="button table-inline-action" data-delivery-case-code="${escapeHtml(code)}">${escapeHtml(t('tenant.deliveryCase.openInline', 'Open Case'))}</button>`;
          },
        },
      ],
      rows: Array.isArray(state.purchaseLookup.items) ? state.purchaseLookup.items : [],
    });
  }

  function getDeliveryCasePhase(detail) {
    const phase = typeof getDeliveryCaseOperationalPhase === 'function'
      ? getDeliveryCaseOperationalPhase(detail)
      : { key: 'created', tone: 'info' };
    const phaseLabels = {
      'dead-letter': {
        label: t('tenant.deliveryCase.phase.deadLetter', 'Dead Letter'),
        detail: t('tenant.deliveryCase.phase.deadLetterDetail', 'Delivery moved to dead-letter state and needs root-cause review before retry.'),
      },
      failed: {
        label: t('tenant.deliveryCase.phase.failed', 'Failed'),
        detail: t('tenant.deliveryCase.phase.failedDetail', 'Purchase is marked failed and needs operator follow-up.'),
      },
      queued: {
        label: t('tenant.deliveryCase.phase.queued', 'Queued'),
        detail: t('tenant.deliveryCase.phase.queuedDetail', 'Purchase is still waiting in queue or pending runtime execution.'),
      },
      executing: {
        label: t('tenant.deliveryCase.phase.executing', 'Executing'),
        detail: t('tenant.deliveryCase.phase.executingDetail', 'Runtime execution started and is still in progress.'),
      },
      verified: {
        label: t('tenant.deliveryCase.phase.verified', 'Verified'),
        detail: t('tenant.deliveryCase.phase.verifiedDetail', 'Delivered status has audit evidence attached.'),
      },
      delivered: {
        label: t('tenant.deliveryCase.phase.delivered', 'Delivered'),
        detail: t('tenant.deliveryCase.phase.deliveredDetail', 'Delivered status is set but audit evidence is still thin or incomplete.'),
      },
      created: {
        label: t('tenant.deliveryCase.phase.created', 'Created'),
        detail: t('tenant.deliveryCase.phase.createdDetail', 'Purchase exists but runtime evidence has not started yet.'),
      },
    };
    return {
      key: phase.key,
      tone: phase.tone,
      ...(phaseLabels[phase.key] || phaseLabels.created),
    };
  }

  function buildDeliveryCaseActions(detail) {
    const phase = getDeliveryCasePhase(detail);
    const actions = [];
    const pushAction = (key, tone, detailText) => {
      if (actions.some((item) => item.key === key)) return;
      actions.push({ key, tone, detail: detailText });
    };

    if (phase.key === 'dead-letter') {
      pushAction('review-dead-letter', 'danger', t('tenant.deliveryCase.action.reviewDeadLetterDetail', 'Read the dead-letter reason first, then retry only after the root cause is understood.'));
      pushAction('validate-player-context', 'warning', t('tenant.deliveryCase.action.validatePlayerContextDetail', 'Verify Steam link, player identity, and item context before replaying this purchase.'));
    } else if (phase.key === 'queued' || phase.key === 'executing') {
      pushAction('check-runtime', 'warning', t('tenant.deliveryCase.action.checkRuntimeDetail', 'Check runtime readiness and queue pressure before forcing another action.'));
      pushAction('use-delivery-lab', 'info', t('tenant.deliveryCase.action.useDeliveryLabDetail', 'Use Delivery Lab or preflight before touching live delivery state.'));
    } else if (phase.key === 'failed') {
      pushAction('reconcile-purchase', 'danger', t('tenant.deliveryCase.action.reconcilePurchaseDetail', 'Compare purchase status, queue, and audit evidence before changing status manually.'));
    } else if (phase.key === 'delivered') {
      pushAction('confirm-audit', 'warning', t('tenant.deliveryCase.action.confirmAuditDetail', 'Cross-check audit evidence and player-visible outcome before closing the case.'));
    } else if (phase.key === 'verified') {
      pushAction('case-quiet', 'success', t('tenant.deliveryCase.action.caseQuietDetail', 'The lifecycle looks complete. Export the case if you need a shareable support snapshot.'));
    } else {
      pushAction('watch-pending', 'info', t('tenant.deliveryCase.action.watchPendingDetail', 'Keep watching purchase status and queue state before intervening.'));
    }

    return actions;
  }

  // Delivery case keeps one purchase code in focus and translates raw detail
  // into a human-readable lifecycle summary for tenant operators.
  function renderDeliveryCase() {
    const form = document.getElementById('tenantDeliveryCaseForm');
    const statsWrap = document.getElementById('tenantDeliveryCaseStats');
    const metaWrap = document.getElementById('tenantDeliveryCaseMeta');
    const timelineWrap = document.getElementById('tenantDeliveryCaseTimeline');
    const actionsWrap = document.getElementById('tenantDeliveryCaseActions');
    const exportBtn = document.getElementById('tenantDeliveryCaseExportBtn');
    const detail = state.deliveryCase;
    const currentCode = String(detail?.purchaseCode || form?.elements?.purchaseCode?.value || '').trim();

    if (form) {
      form.elements.purchaseCode.value = currentCode || '';
    }
    if (exportBtn) exportBtn.disabled = !currentCode;

    if (!detail) {
      renderStats(statsWrap, []);
      metaWrap.innerHTML = `<div class="empty-state">${escapeHtml(t('tenant.deliveryCase.empty', 'Load one purchase code to inspect lifecycle and evidence.'))}</div>`;
      renderList(timelineWrap, [], () => '', t('tenant.deliveryCase.emptyTimeline', 'No delivery case timeline loaded yet.'));
      renderList(actionsWrap, [], () => '', t('tenant.deliveryCase.emptyActions', 'No recommended next steps yet.'));
      return;
    }

    const phase = getDeliveryCasePhase(detail);
    const actions = buildDeliveryCaseActions(detail);
    const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];
    const auditCount = Array.isArray(detail.auditRows) ? detail.auditRows.length : 0;
    const statusHistoryCount = Array.isArray(detail.statusHistory) ? detail.statusHistory.length : 0;
    const latestError = detail?.deadLetter?.reason || detail?.queueJob?.lastError || detail?.latestCommandSummary || '';

    renderStats(statsWrap, [
      {
        kicker: t('tenant.deliveryCase.summary.phase', 'Phase'),
        value: phase.label,
        title: t('tenant.deliveryCase.summary.phaseTitle', 'Current delivery state'),
        detail: phase.detail,
      },
      {
        kicker: t('tenant.deliveryCase.summary.timeline', 'Timeline'),
        value: formatNumber(timeline.length, '0'),
        title: t('tenant.deliveryCase.summary.timelineTitle', 'Timeline events'),
        detail: t('tenant.deliveryCase.summary.timelineDetail', '{count} status/audit events available.', { count: formatNumber(timeline.length, '0') }),
      },
      {
        kicker: t('tenant.deliveryCase.summary.audit', 'Audit'),
        value: formatNumber(auditCount, '0'),
        title: t('tenant.deliveryCase.summary.auditTitle', 'Audit rows'),
        detail: t('tenant.deliveryCase.summary.auditDetail', '{count} audit rows and {history} status changes.', {
          count: formatNumber(auditCount, '0'),
          history: formatNumber(statusHistoryCount, '0'),
        }),
      },
      {
        kicker: t('tenant.deliveryCase.summary.runtime', 'Runtime'),
        value: detail.queueJob ? t('tenant.deliveryCase.runtime.queue', 'queue') : detail.deadLetter ? t('tenant.deliveryCase.runtime.dead', 'dead-letter') : t('tenant.deliveryCase.runtime.none', 'quiet'),
        title: t('tenant.deliveryCase.summary.runtimeTitle', 'Runtime artifact'),
        detail: latestError || t('tenant.deliveryCase.summary.runtimeDetail', 'No immediate runtime error captured.'),
      },
    ]);

    metaWrap.innerHTML = [
      '<article class="panel-card">',
      `<h3>${escapeHtml(t('tenant.deliveryCase.meta.purchase', 'Purchase Context'))}</h3>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.form.purchaseCode', 'Purchase Code'))}</strong><div class="muted code">${escapeHtml(detail.purchaseCode || '-')}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.deliveryCase.meta.status', 'Current Status'))}</strong><div class="muted">${escapeHtml(detail.purchase?.status || '-')}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.deliveryCase.meta.player', 'Player'))}</strong><div class="muted">${escapeHtml(detail.purchase?.userId || detail.link?.discordId || '-')}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.deliveryCase.meta.steam', 'Steam / In-game'))}</strong><div class="muted">${escapeHtml(detail.link?.steamId || detail.link?.inGameName || '-')}</div></div>`,
      '</article>',
      '<article class="panel-card">',
      `<h3>${escapeHtml(t('tenant.deliveryCase.meta.runtime', 'Runtime Artifacts'))}</h3>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.deliveryCase.meta.queue', 'Queue Job'))}</strong><div class="muted">${escapeHtml(detail.queueJob ? (detail.queueJob.status || detail.queueJob.purchaseCode || t('tenant.deliveryCase.meta.queued', 'queued')) : '-')}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.deliveryCase.meta.deadLetter', 'Dead Letter'))}</strong><div class="muted">${escapeHtml(detail.deadLetter ? (detail.deadLetter.reason || detail.deadLetter.errorCode || t('tenant.deliveryCase.meta.present', 'present')) : '-')}</div></div>`,
      `<div class="feed-item"><strong>${escapeHtml(t('tenant.deliveryCase.meta.evidence', 'Evidence'))}</strong><div class="muted">${escapeHtml(detail.latestCommandSummary || '-')}</div></div>`,
      '</article>',
    ].join('');

    renderList(
      timelineWrap,
      timeline,
      (item) => [
        `<article class="timeline-item ${escapeHtml(item.status === 'failed' ? 'danger' : item.status === 'completed' ? 'success' : item.status === 'warning' ? 'warning' : 'info')}">`,
        `<div class="feed-meta">${makePill(item.stage || item.source || 'event', 'neutral')} ${makePill(item.status || 'ok', item.status === 'failed' ? 'danger' : item.status === 'completed' ? 'success' : 'warning')} <span class="code">${escapeHtml(formatDateTime(item.at))}</span></div>`,
        `<strong>${escapeHtml(item.title || item.step || 'Delivery event')}</strong>`,
        item.message ? `<div class="muted">${escapeHtml(item.message)}</div>` : '',
        item.errorCode ? `<div class="muted code">${escapeHtml(item.errorCode)}</div>` : '',
        '</article>',
      ].join(''),
      t('tenant.deliveryCase.emptyTimeline', 'No delivery case timeline loaded yet.'),
    );

    renderList(
      actionsWrap,
      actions,
      (item) => [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(t(`tenant.deliveryCase.action.${item.key}`, item.key), item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : 'info')}</div>`,
        `<strong>${escapeHtml(t(`tenant.deliveryCase.action.${item.key}`, item.key))}</strong>`,
        `<div class="muted">${escapeHtml(item.detail || '-')}</div>`,
        '</article>',
      ].join(''),
      t('tenant.deliveryCase.emptyActions', 'No recommended next steps yet.'),
    );
  }

  function renderNotifications() {
    const notifications = getTenantScopedNotifications();
    renderList(
      document.getElementById('tenantNotificationFeed'),
      notifications,
      (item) => {
        const localized = localizeAdminNotification(item);
        return [
        '<article class="feed-item">',
        `<div class="feed-meta">${makePill(item.severity || 'info')} ${item.type ? `<span class="code">${escapeHtml(item.type)}</span>` : ''}</div>`,
        `<strong>${escapeHtml(localized.title || t('admin.notifications.defaultTitle', 'Notification'))}</strong>`,
        localized.detail ? `<div class="muted">${escapeHtml(localized.detail)}</div>` : '',
        `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.createdAt || item.at))}</span></div>`,
        '</article>',
      ].join('');
      },
      t('tenant.notifications.empty', 'No active notifications for this tenant.')
    );
  }

  function renderIncidentCenter() {
    const form = document.getElementById('tenantIncidentQueryForm');
    if (form) {
      form.elements.severity.value = state.incidentFilters.severity || '';
      form.elements.kind.value = state.incidentFilters.kind || '';
      form.elements.source.value = state.incidentFilters.source || '';
    }

    const allRows = buildTenantIncidentRows();
    const filteredRows = getFilteredTenantIncidents();
    const notificationCount = getTenantScopedNotifications().length;
    const errorCount = allRows.filter((item) => normalizeIncidentSeverity(item.severity) === 'error').length;
    const queueCount = allRows.filter((item) => item.source === 'queue').length;
    const deadLetterCount = allRows.filter((item) => item.source === 'dead-letter').length;

    renderStats(document.getElementById('tenantIncidentStats'), [
      {
        kicker: t('tenant.incidents.inboxKicker', 'Inbox'),
        value: formatNumber(filteredRows.length, '0'),
        title: t('tenant.incidents.inboxTitle', 'Visible incidents after filters'),
        detail: t('tenant.incidents.inboxDetail', '{count} total tenant-safe incident rows are currently available.', { count: formatNumber(allRows.length, '0') }),
      },
      {
        kicker: t('tenant.incidents.errorsKicker', 'Errors'),
        value: formatNumber(errorCount, '0'),
        title: t('tenant.incidents.errorsTitle', 'High severity incidents'),
        detail: t('tenant.incidents.errorsDetail', 'Dead letters and hard runtime failures are counted here first.'),
      },
      {
        kicker: t('tenant.incidents.queueKicker', 'Queue'),
        value: formatNumber(queueCount, '0'),
        title: t('tenant.incidents.queueTitle', 'Queued deliveries under review'),
        detail: t('tenant.incidents.queueDetail', '{count} dead letters are currently visible.', { count: formatNumber(deadLetterCount, '0') }),
      },
      {
        kicker: t('tenant.incidents.alertsKicker', 'Alerts'),
        value: formatNumber(notificationCount, '0'),
        title: t('tenant.incidents.alertsTitle', 'Tenant-tagged notifications'),
        detail: t('tenant.incidents.alertsDetail', 'Only notifications explicitly tagged to this tenant are shown here.'),
      },
    ]);

    document.getElementById('tenantIncidentRunbooks').innerHTML = [
      {
        title: t('tenant.incidents.runbookQueueTitle', 'Queue Pressure'),
        text: queueCount > 0
          ? t('tenant.incidents.runbookQueueActive', 'Open Commerce + Delivery to inspect queued purchases, then use Delivery Lab or bulk retry only after the runtime looks healthy.')
          : t('tenant.incidents.runbookQueueQuiet', 'Queue pressure is quiet right now. Keep watching the delivery lab before making live changes.'),
      },
      {
        title: t('tenant.incidents.runbookDeadLetterTitle', 'Dead Letter Response'),
        text: deadLetterCount > 0
          ? t('tenant.incidents.runbookDeadLetterActive', 'Dead letters are visible. Review the reason, verify Steam link or player data, then use scoped retry only after the root cause is understood.')
          : t('tenant.incidents.runbookDeadLetterQuiet', 'No dead letters are currently visible for this tenant.'),
      },
      {
        title: t('tenant.incidents.runbookTrustTitle', 'Reconcile + Trust'),
        text: Number(state.reconcile?.summary?.anomalies || 0) > 0
          ? t('tenant.incidents.runbookTrustActive', 'Reconcile findings are active. Cross-check purchase codes against audit and player support tools before editing any config.')
          : t('tenant.incidents.runbookTrustQuiet', 'No active reconcile anomalies are reported in the current window.'),
      },
    ].map((card) => [
      '<article class="kv-card">',
      `<h3>${escapeHtml(card.title)}</h3>`,
      `<p>${escapeHtml(card.text)}</p>`,
      '</article>',
    ].join('')).join('');

    renderList(
      document.getElementById('tenantIncidentFeed'),
      filteredRows,
      (item) => {
        const action = tenantIncidentActionForItem(item);
        return [
          `<article class="timeline-item ${escapeHtml(item.severity === 'error' ? 'danger' : item.severity === 'warn' ? 'warning' : 'info')}">`,
          `<div class="feed-meta">${makePill(item.severity || 'info')} ${makePill(item.source || 'incident', 'info')} <span class="code">${escapeHtml(item.code || '-')}</span></div>`,
          `<strong>${escapeHtml(item.title || item.kind || 'Incident')}</strong>`,
          item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
          `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.at))}</span>${item.kind ? ` <span class="code">${escapeHtml(item.kind)}</span>` : ''}</div>`,
          `<div class="button-row"><button type="button" class="button" data-incident-target="${escapeHtml(action.targetId)}">${escapeHtml(action.label)}</button></div>`,
          '</article>',
        ].join('');
      },
      t('tenant.incidents.empty', 'No tenant incidents match the current filters.')
    );
  }

  function renderDeliveryLab() {
    const result = state.deliveryLabResult;
    const raw = document.getElementById('tenantDeliveryLabRaw');
    if (!result) {
      renderStats(document.getElementById('tenantDeliveryLabStats'), []);
      renderList(
        document.getElementById('tenantDeliveryLabFeed'),
        [],
        () => '',
        t('tenant.lab.empty', 'Run a preview, preflight, simulate, or test-send request to inspect delivery behavior.')
      );
      if (raw) {
        raw.textContent = t('tenant.lab.rawEmpty', 'Run a lab action to inspect checks, timeline, and raw payload.');
      }
      return;
    }

    const data = result.data || {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    const timeline = Array.isArray(data.timeline) ? data.timeline : [];
    const commands = Array.isArray(data.commands) ? data.commands : [];
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    const feedItems = [
      ...checks.map((item) => ({
        title: item.label || item.id || t('tenant.lab.check', 'check'),
        detail: item.detail || item.reason || '',
        tone: item.ok === false ? 'danger' : item.ready === false ? 'warning' : 'success',
        tag: 'check',
      })),
      ...warnings.map((item) => ({
        title: t('tenant.lab.warning', 'warning'),
        detail: String(item || ''),
        tone: 'warning',
        tag: 'warning',
      })),
      ...timeline.map((item) => ({
        title: item.label || item.step || item.type || t('tenant.lab.timeline', 'timeline'),
        detail: item.detail || item.message || item.status || '',
        tone: String(item.status || '').toLowerCase() === 'failed' ? 'danger' : 'info',
        tag: 'timeline',
      })),
    ].slice(0, 12);

    renderStats(document.getElementById('tenantDeliveryLabStats'), [
      {
        kicker: t('tenant.lab.statAction', 'Action'),
        value: result.action || '-',
        title: t('tenant.lab.statActionTitle', 'Lab mode'),
        detail: result.action === 'test-send'
          ? t('tenant.lab.statActionDetailLive', 'Live command execution path.')
          : t('tenant.lab.statActionDetailSafe', 'Safe validation path.'),
      },
      {
        kicker: t('tenant.lab.statChecks', 'Checks'),
        value: formatNumber(checks.length, '0'),
        title: t('tenant.lab.statChecksTitle', 'Preflight / validation checks'),
        detail: t('tenant.lab.statChecksDetail', 'Present for preflight and similar report-like responses.'),
      },
      {
        kicker: t('tenant.lab.statCommands', 'Commands'),
        value: formatNumber(commands.length || outputs.length, '0'),
        title: t('tenant.lab.statCommandsTitle', 'Commands or outputs'),
        detail: t('tenant.lab.statCommandsDetail', 'Preview returns commands, test-send returns outputs.'),
      },
      {
        kicker: t('tenant.lab.statWarnings', 'Warnings'),
        value: formatNumber(warnings.length, '0'),
        title: t('tenant.lab.statWarningsTitle', 'Warnings'),
        detail: timeline.length > 0
          ? t('tenant.lab.timelineCount', '{count} timeline entries', { count: formatNumber(timeline.length, '0') })
          : t('tenant.lab.noTimeline', 'No timeline returned.'),
      },
    ]);

    renderList(
      document.getElementById('tenantDeliveryLabFeed'),
      feedItems,
      (item) => [
        `<article class="timeline-item ${escapeHtml(item.tone || 'info')}">`,
        `<div class="feed-meta">${makePill(item.tag || 'detail')} ${item.tone ? makePill(item.tone) : ''}</div>`,
        `<strong>${escapeHtml(item.title || t('tenant.lab.resultTitle', 'Result'))}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('tenant.lab.emptyStructured', 'No structured checks, warnings, or timeline entries were returned.')
    );

    if (raw) {
      raw.textContent = JSON.stringify(data, null, 2);
    }
  }

  function renderAudit() {
    const dataset = state.audit || {};
    const filters = state.auditFilters || {};
    const form = document.getElementById('tenantAuditQueryForm');
    if (form) {
      form.elements.view.value = filters.view || 'wallet';
      form.elements.userId.value = filters.userId || '';
      form.elements.query.value = filters.query || '';
      form.elements.windowMs.value = filters.windowMs == null ? '' : String(filters.windowMs);
    }

    renderStats(
      document.getElementById('tenantAuditStats'),
      (Array.isArray(dataset.cards) ? dataset.cards : []).map(([label, value]) => ({
        kicker: String(dataset.view || 'audit').toUpperCase(),
        value: String(value ?? '-'),
        title: String(label || t('tenant.audit.postureTitle', 'Audit Posture')),
        detail: t('tenant.audit.summaryDetail', 'Returned {returned} of {total} rows.', {
          returned: formatNumber(dataset.returned, '0'),
          total: formatNumber(dataset.total, '0'),
        }),
      }))
    );

    const rows = Array.isArray(dataset.tableRows) ? dataset.tableRows : [];
    const keys = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];
    renderTable(
      document.getElementById('tenantAuditTable'),
      keys.map((key) => ({
        label: key,
        render: (row) => `<span class="${/(?:id|code|reference)/i.test(key) ? 'code' : ''}">${escapeHtml(formatAuditCell(key, row?.[key]))}</span>`,
      })),
      rows,
      t('tenant.audit.emptyScoped', 'No audit rows matched the current tenant-scoped filters.')
    );
  }

  function renderPresets() {
    document.getElementById('tenantPresetCards').innerHTML = [
      {
        title: t('tenant.presetCard.config.title', 'Guided config first'),
        text: t('tenant.presetCard.config.detail', 'Preview config diffs here before saving. Stay in the scoped config pages unless a maintainer explicitly asks for fallback tooling.'),
        action: '<a class="ghost-link" href="#config">Stay in scoped config</a>',
      },
      {
        title: t('tenant.presetCard.plan.title', 'Plan + integrations'),
        text: t('tenant.presetCard.plan.detail', 'Current plan posture, allowances, API keys, webhooks, and tenant offers now live directly in this console.'),
        action: '<a class="ghost-link" href="#plan-integrations">Review plan posture</a>',
      },
      {
        title: t('tenant.presetCard.restart.title', 'Restart + maintenance preset'),
        text: t('tenant.presetCard.restart.detail', 'Use the guided restart preset before you announce downtime so maintenance communication and delivery checks stay in one scoped flow.'),
        action: '<a class="ghost-link" href="#support-tools">Open restart preset</a>',
      },
      {
        title: t('tenant.presetCard.legacy.title', 'Advanced delivery review'),
        text: t('tenant.presetCard.legacy.detail', 'Delivery capability presets, complex overrides, and recovery checks now stay grouped in the scoped delivery pages.'),
        action: '<a class="ghost-link" href="#sandbox">Open delivery lab</a>',
      },
    ].map((card) => [
      '<article class="panel-card">',
      `<h3>${escapeHtml(card.title)}</h3>`,
      `<p>${escapeHtml(card.text)}</p>`,
      card.action,
      '</article>',
    ].join('')).join('');
  }

  function renderSupportToolkit() {
    const toolkit = document.getElementById('tenantSupportToolkit');
    const checklist = document.getElementById('tenantRestartPresetChecklist');
    if (toolkit) {
      const items = [
        {
          key: 'delivery-case',
          tone: 'warning',
          tag: t('tenant.supportToolkit.tag.delivery', 'delivery'),
          title: t('tenant.supportToolkit.delivery.title', 'Open delivery case'),
          detail: t('tenant.supportToolkit.delivery.detail', 'Start from one concrete purchase code when a player reports a missing or delayed item.'),
          button: t('tenant.supportToolkit.delivery.button', 'Open delivery case'),
        },
        {
          key: 'wallet',
          tone: 'info',
          tag: t('tenant.supportToolkit.tag.wallet', 'wallet'),
          title: t('tenant.supportToolkit.wallet.title', 'Wallet support'),
          detail: t('tenant.supportToolkit.wallet.detail', 'Go straight to scoped wallet actions when balance or ledger history needs manual follow-up.'),
          button: t('tenant.supportToolkit.wallet.button', 'Open wallet support'),
        },
        {
          key: 'steam',
          tone: 'warning',
          tag: t('tenant.supportToolkit.tag.steam', 'steam'),
          title: t('tenant.supportToolkit.steam.title', 'Steam support'),
          detail: t('tenant.supportToolkit.steam.detail', 'Use this first when delivery readiness depends on Steam identity, linking, or player context.'),
          button: t('tenant.supportToolkit.steam.button', 'Open Steam support'),
        },
        {
          key: 'restart',
          tone: 'danger',
          tag: t('tenant.supportToolkit.tag.maintenance', 'maintenance'),
          title: t('tenant.supportToolkit.restart.title', 'Restart announcement'),
          detail: t('tenant.supportToolkit.restart.detail', 'Use the restart preset when you need to communicate downtime and then step into the deeper workbench flow.'),
          button: t('tenant.supportToolkit.restart.button', 'Open restart preset'),
        },
      ];
      toolkit.innerHTML = items.map((item) => [
        '<article class="quick-action-card">',
        `<div class="feed-meta">${makePill(item.tag, item.tone)}</div>`,
        `<strong>${escapeHtml(item.title)}</strong>`,
        `<p>${escapeHtml(item.detail)}</p>`,
        `<div class="button-row"><button type="button" class="button button-primary" data-tenant-support-tool="${escapeHtml(item.key)}">${escapeHtml(item.button)}</button></div>`,
        '</article>',
      ].join('')).join('');
    }
    if (checklist) {
      const steps = [
        {
          tone: 'info',
          title: t('tenant.restartPreset.step1.title', 'Check queue and delivery posture'),
          detail: t('tenant.restartPreset.step1.detail', 'Review delivery lifecycle first so you know whether queue pressure or dead letters are already high before announcing downtime.'),
        },
        {
          tone: 'warning',
          title: t('tenant.restartPreset.step2.title', 'Announce with one flow'),
          detail: t('tenant.restartPreset.step2.detail', 'Use one communication path for restart timing instead of mixing ad hoc messages across multiple admin tools.'),
        },
        {
          tone: 'info',
          title: t('tenant.restartPreset.step3.title', 'Recheck delivery after maintenance'),
          detail: t('tenant.restartPreset.step3.detail', 'Come back to delivery case, lifecycle, and support tools after the restart so stuck purchases do not linger silently.'),
        },
      ];
      renderList(
        checklist,
        steps,
        (item) => [
          '<article class="feed-item">',
          `<div class="feed-meta">${makePill(item.tone === 'warning' ? t('tenant.supportToolkit.tag.maintenance', 'maintenance') : t('tenant.supportToolkit.tag.support', 'support'), item.tone)}</div>`,
          `<strong>${escapeHtml(item.title)}</strong>`,
          `<div class="muted">${escapeHtml(item.detail)}</div>`,
          '</article>',
        ].join(''),
        t('tenant.restartPreset.empty', 'No restart guidance loaded.'),
      );
    }
  }

  function runTenantSupportToolkitAction(actionKey) {
    const key = String(actionKey || '').trim();
    if (key === 'delivery-case') {
      openTenantTarget('transactions', { targetId: 'tenantDeliveryCaseForm', block: 'center' });
      showToast(t('tenant.toast.deliverySupportFocused', 'Delivery case form focused.'), 'info');
      return;
    }
    if (key === 'wallet') {
      openTenantTarget('support-tools', { targetId: 'tenantWalletForm', block: 'center' });
      showToast(t('tenant.toast.walletSupportFocused', 'Wallet support form focused.'), 'info');
      return;
    }
    if (key === 'steam') {
      openTenantTarget('support-tools', { targetId: 'tenantSteamLinkForm', block: 'center' });
      showToast(t('tenant.toast.steamSupportFocused', 'Steam support form focused.'), 'info');
      return;
    }
    if (key === 'restart') {
      openTenantTarget('support-tools', { targetId: 'tenantRestartPresetChecklist', block: 'center' });
      showToast(t('tenant.toast.restartPresetFocused', 'Restart preset focused.'), 'info');
    }
  }

  function buildActivityItems() {
    const scopedNotifications = getTenantScopedNotifications();
    const queued = state.queueItems.slice(0, 4).map((item) => ({
      tone: 'warning',
      type: 'queue',
      title: item.purchaseCode || item.code || t('tenant.activity.queueJob', 'Queue job'),
      detail: item.status || t('tenant.activity.queued', 'queued'),
      at: item.updatedAt || item.createdAt,
    }));
    const dead = state.deadLetters.slice(0, 4).map((item) => ({
      tone: 'danger',
      type: 'dead-letter',
      title: item.purchaseCode || item.code || t('tenant.activity.deadLetter', 'Dead letter'),
      detail: item.reason || item.errorCode || '',
      at: item.updatedAt || item.createdAt,
    }));
    const alerts = scopedNotifications.slice(0, 4).map((item) => ({
      tone: item.severity === 'error' ? 'danger' : item.severity || 'warning',
      type: item.type || 'alert',
      title: item.title || item.detail || t('tenant.activity.alertFallback', 'Tenant alert'),
      detail: item.detail || item.message || '',
      at: item.createdAt || item.at,
    }));

    return [...state.liveEvents, ...alerts, ...dead, ...queued]
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())
      .slice(0, 14);
  }

  function renderActivity() {
    renderList(
      document.getElementById('tenantActivityFeed'),
      buildActivityItems(),
      (item) => [
        `<article class="timeline-item ${escapeHtml(item.tone || 'info')}">`,
        `<div class="feed-meta">${makePill(item.type || 'event')} <span class="code">${escapeHtml(formatDateTime(item.at))}</span></div>`,
        `<strong>${escapeHtml(item.title || t('tenant.activity.title', 'Activity'))}</strong>`,
        item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
        '</article>',
      ].join(''),
      t('tenant.activity.empty', 'Waiting for tenant activity.')
    );
  }

  // Tenant render pass keeps the page shell, data widgets, and language
  // overlays synchronized after each refresh without changing backend shape.
  function renderAll() {
    const ops = getTenantOperationalSnapshot();
    document.getElementById('tenantScopeText').textContent =
      t('tenant.banner.scope', 'Tenant ID: {tenantId} | role: {role} | user: {user}', {
        tenantId: state.me?.tenantId || '-',
        role: state.me?.role || '-',
        user: state.me?.user || '-',
      });
    setBanner(
      state.tenantConfig?.name || t('tenant.banner.title', 'Tenant {tenantId}', { tenantId: state.me?.tenantId || '' }),
      t('tenant.banner.detail', 'Tenant-facing operations stay isolated from owner-only platform controls and recovery workflows.'),
      [
        t('tenant.banner.tag.queue', 'queue {count}', { count: formatNumber(ops.queueDepth, '0') }),
        t('tenant.banner.tag.dead', 'dead {count}', { count: formatNumber(ops.deadCount, '0') }),
        t('tenant.banner.tag.incidents', 'incidents {count}', { count: formatNumber(ops.incidentCount, '0') }),
        t('tenant.banner.tag.delivery', 'delivery {value}', { value: ops.runtimeLabel }),
      ],
      ops.tone
    );
    fillConfigForm();
    renderOverview();
    renderIncidentCenter();
    renderInsights();
    renderDeliveryLifecycle();
    renderPlanIntegrations();
    renderTables();
    renderNotifications();
    renderDeliveryLab();
    renderPresets();
    renderSupportToolkit();
    renderActivity();
    renderPurchaseInspector();
    renderDeliveryCase();
    renderAudit();
    renderConfigPreview();
    renderResultPanel(
      document.getElementById('tenantBulkDeliveryResult'),
      state.bulkDeliveryResult,
      t('tenant.bulk.empty', 'Run a bulk queue or dead-letter action to inspect the latest batch result.')
    );
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
      || '';
    state.liveEvents.unshift({
      type,
      title,
      detail,
      tone: type.includes('dead-letter')
        ? 'danger'
        : type.includes('delivery') || type.includes('ops-alert') || type.includes('restart')
          ? 'warning'
          : type === 'connected'
            ? 'success'
            : 'info',
      at: payload?.at || new Date().toISOString(),
    });
    state.liveEvents = state.liveEvents.slice(0, 20);
    renderActivity();
  }

  function connectLive() {
    if (liveConnection) return;
    liveConnection = connectLiveStream({
      events: [
        'connected',
        'heartbeat',
        'delivery-queue',
        'delivery-dead-letter',
        'ops-alert',
        'platform-event',
        'admin-action',
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
          payload: { summary: t('tenant.live.connected', 'Tenant live stream connected') },
        });
      },
      onError() {
        pushLiveEvent('ops-alert', {
          at: new Date().toISOString(),
          payload: { summary: t('tenant.live.interrupted', 'Live stream interrupted, falling back to refresh.') },
        });
      },
    });
  }

  async function refreshSurface(options = {}) {
    const refreshButton = document.getElementById('tenantRefreshBtn');
    if (!options.silent) {
      setBusy(refreshButton, true, t('common.refreshing', 'Refreshing...'));
    }
    try {
      const me = await api('/admin/api/me');
      if (!me?.tenantId) {
        window.location.href = '/owner';
        return;
      }
      state.me = me;
      const tenantId = getTenantId();
      const [
        overview,
        reconcile,
        quota,
        tenantConfig,
        subscriptions,
        licenses,
        apiKeys,
        webhooks,
        agents,
        dashboardCards,
        shopItems,
        queueItems,
        deadLetters,
        deliveryLifecycle,
        players,
        notifications,
        deliveryRuntime,
        purchaseStatusCatalog,
        audit,
      ] = await Promise.all([
        safeApi(`/admin/api/platform/overview?tenantId=${tenantId}`, {}),
        safeApi(`/admin/api/platform/reconcile?tenantId=${tenantId}&windowMs=3600000&pendingOverdueMs=1200000`, {}),
        safeApi(`/admin/api/platform/quota?tenantId=${tenantId}`, {}),
        safeApi(`/admin/api/platform/tenant-config?tenantId=${tenantId}`, {}),
        safeApi(`/admin/api/platform/subscriptions?tenantId=${tenantId}&limit=6`, []),
        safeApi(`/admin/api/platform/licenses?tenantId=${tenantId}&limit=6`, []),
        safeApi(`/admin/api/platform/apikeys?tenantId=${tenantId}&limit=12`, []),
        safeApi(`/admin/api/platform/webhooks?tenantId=${tenantId}&limit=12`, []),
        safeApi(`/admin/api/platform/agents?tenantId=${tenantId}&limit=12`, []),
        safeApi(`/admin/api/dashboard/cards?tenantId=${tenantId}`, null),
        safeApi(`/admin/api/shop/list?tenantId=${tenantId}&limit=24`, { items: [] }),
        safeApi(`/admin/api/delivery/queue?tenantId=${tenantId}&limit=20`, { items: [] }),
        safeApi(`/admin/api/delivery/dead-letter?tenantId=${tenantId}&limit=20`, { items: [] }),
        safeApi(`/admin/api/delivery/lifecycle?tenantId=${tenantId}&limit=80&pendingOverdueMs=1200000`, {}),
        safeApi(`/admin/api/player/accounts?tenantId=${tenantId}&limit=20`, { items: [] }),
        safeApi('/admin/api/notifications?acknowledged=false&limit=10', { items: [] }),
        safeApi('/admin/api/delivery/runtime', {}),
        safeApi('/admin/api/purchase/statuses', { knownStatuses: [], allowedTransitions: [] }),
        safeApi(`/admin/api/audit/query?${buildAuditQueryString({
          tenantId: state.me?.tenantId || me?.tenantId || '',
          view: state.auditFilters.view,
          userId: state.auditFilters.userId,
          q: state.auditFilters.query,
          windowMs: state.auditFilters.windowMs,
          pageSize: 8,
        })}`, { cards: [], tableRows: [] }),
      ]);

      state.overview = overview || {};
      state.reconcile = reconcile || {};
      state.quota = quota || {};
      state.tenantConfig = tenantConfig || me.tenantConfig || {};
      state.subscriptions = listFromPayload(subscriptions);
      state.licenses = listFromPayload(licenses);
      state.apiKeys = listFromPayload(apiKeys);
      state.webhooks = listFromPayload(webhooks);
      state.agents = listFromPayload(agents);
      state.dashboardCards = dashboardCards;
      state.shopItems = listFromPayload(shopItems);
      state.queueItems = listFromPayload(queueItems);
      state.deadLetters = listFromPayload(deadLetters);
      state.deliveryLifecycle = deliveryLifecycle || {};
      state.players = listFromPayload(players);
      state.notifications = listFromPayload(notifications);
      state.deliveryRuntime = deliveryRuntime || {};
      state.purchaseStatusCatalog = purchaseStatusCatalog || { knownStatuses: [], allowedTransitions: [] };
      state.audit = audit || { cards: [], tableRows: [] };
      {
        const selectedDeliveryCode = String(
          state.deliveryCase?.purchaseCode
          || document.getElementById('tenantDeliveryCaseForm')?.elements?.purchaseCode?.value
          || '',
        ).trim();
        if (selectedDeliveryCode) {
          state.deliveryCase = await safeApi(
            `/admin/api/delivery/detail?tenantId=${tenantId}&code=${encodeURIComponent(selectedDeliveryCode)}&limit=80`,
            state.deliveryCase,
          );
        }
      }
      renderAll();
      connectLive();
    } catch (error) {
      setBanner(
        t('tenant.banner.loadFailedTitle', 'Tenant console failed to load'),
        String(error.message || error),
        [t('tenant.banner.retryAvailable', 'retry available')],
        'danger'
      );
    } finally {
      if (!options.silent) {
        setBusy(refreshButton, false);
      }
    }
  }

  function parseOptionalJson(raw, fieldLabel) {
    const text = String(raw || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(t('tenant.error.validJson', '{field} must be valid JSON', { field: fieldLabel }));
    }
  }

  async function handleTenantConfigSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      const featureFlags = parseOptionalJson(form.elements.featureFlags.value, t('tenant.config.fieldFeatureFlags', 'Feature Flags'));
      const configPatch = parseOptionalJson(form.elements.configPatch.value, t('tenant.config.fieldConfigPatch', 'Config Patch'));
      const portalEnvPatch = parseOptionalJson(form.elements.portalEnvPatch.value, t('tenant.config.fieldPortalEnvPatch', 'Portal Env Patch'));
      if (!featureFlags && !configPatch && !portalEnvPatch) {
        throw new Error(t('tenant.config.requirePatch', 'Provide at least one JSON patch before saving'));
      }
      if (!window.confirm(t('tenant.confirm.saveConfig', 'Save tenant configuration changes for this tenant?'))) {
        return;
      }
      setBusy(button, true, t('common.saving', 'Saving...'));
      await api('/admin/api/platform/tenant-config', {
        method: 'POST',
        body: {
          tenantId: state.me.tenantId,
          featureFlags,
          configPatch,
          portalEnvPatch,
        },
      });
      state.configEditorDirty = false;
      state.configPreview = null;
      showToast(t('tenant.toast.configSaved', 'Tenant configuration saved.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.configUpdateFailed', 'Tenant config update failed'), String(error.message || error), [t('tenant.tag.config', 'config')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  function previewTenantConfig() {
    try {
      state.configPreview = buildConfigPreview();
      renderConfigPreview();
      showToast(t('tenant.toast.configPreviewUpdated', 'Config preview updated.'), 'info');
    } catch (error) {
      setBanner(t('tenant.banner.configPreviewFailed', 'Config preview failed'), String(error.message || error), [t('tenant.tag.config', 'config')], 'danger');
    }
  }

  function resetTenantConfigForm() {
    fillConfigForm(true);
      showToast(t('tenant.toast.configResetToLive', 'Tenant config form reset to live values.'), 'info');
  }

  async function handleWalletSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const action = String(form.elements.action.value || '').trim();
    const userId = String(form.elements.userId.value || '').trim();
    const amount = Number(form.elements.amount.value);
    if (!userId || !Number.isFinite(amount)) {
      setBanner(t('tenant.banner.walletIncompleteTitle', 'Wallet action is incomplete'), t('tenant.banner.walletIncompleteDetail', 'Provide a Discord user ID and a numeric amount.'), [t('tenant.tag.wallet', 'wallet')], 'danger');
      return;
    }
    const endpoint = action === 'set'
      ? '/admin/api/wallet/set'
      : action === 'remove'
        ? '/admin/api/wallet/remove'
        : '/admin/api/wallet/add';
    if (!window.confirm(t('tenant.confirm.walletAction', 'Confirm {action} for user {userId}?', { action, userId }))) return;
    const button = form.querySelector('button[type="submit"]');
    try {
      setBusy(button, true, t('common.applying', 'Applying...'));
      await api(endpoint, {
        method: 'POST',
        body: action === 'set'
          ? { userId, balance: Math.trunc(amount) }
          : { userId, amount: Math.trunc(amount) },
      });
      form.reset();
      showToast(t('tenant.toast.walletApplied', 'Wallet action applied.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.walletFailed', 'Wallet action failed'), String(error.message || error), [t('tenant.tag.wallet', 'wallet')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleDeliverySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(form.elements.code.value || '').trim();
    const action = String(form.elements.action.value || '').trim();
    if (!code) {
      setBanner(t('tenant.banner.deliveryIncompleteTitle', 'Delivery action is incomplete'), t('tenant.banner.deliveryIncompleteDetail', 'Provide a purchase code before running a recovery action.'), [t('tenant.tag.delivery', 'delivery')], 'danger');
      return;
    }
    const endpoint = action === 'dead-letter-retry'
      ? '/admin/api/delivery/dead-letter/retry'
      : action === 'cancel'
        ? '/admin/api/delivery/cancel'
        : '/admin/api/delivery/retry';
    if (!window.confirm(t('tenant.confirm.deliveryAction', 'Run {action} for {code}?', { action, code }))) return;
    const button = form.querySelector('button[type="submit"]');
    try {
      setBusy(button, true, t('common.running', 'Running...'));
      await api(endpoint, {
        method: 'POST',
        body: { code },
      });
      form.reset();
      showToast(t('tenant.toast.deliveryRecoveryCompleted', 'Delivery recovery action completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.deliveryFailed', 'Delivery action failed'), String(error.message || error), [t('tenant.tag.delivery', 'delivery')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleShopCreateSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const kind = String(form.elements.kind.value || 'item').trim();
    const payload = {
      tenantId: state.me?.tenantId,
      kind,
      id: String(form.elements.id.value || '').trim(),
      name: String(form.elements.name.value || '').trim(),
      price: Math.trunc(Number(form.elements.price.value || 0)),
      description: String(form.elements.description.value || '').trim(),
      gameItemId: String(form.elements.gameItemId.value || '').trim(),
      quantity: Math.max(1, Math.trunc(Number(form.elements.quantity.value || 1) || 1)),
      iconUrl: String(form.elements.iconUrl.value || '').trim(),
    };
    if (!payload.id || !payload.name || !Number.isFinite(payload.price)) {
      setBanner(t('tenant.banner.catalogIncompleteTitle', 'Catalog entry is incomplete'), t('tenant.banner.catalogIncompleteDetail', 'Provide kind, item ID, display name, and a numeric price before saving.'), [t('tenant.tag.catalog', 'catalog')], 'danger');
      return;
    }
    if (kind === 'item' && !payload.gameItemId) {
      setBanner(t('tenant.banner.gameItemRequiredTitle', 'Game Item ID required'), t('tenant.banner.gameItemRequiredDetail', 'Item catalog entries need a SCUM game item id so delivery can be resolved.'), [t('tenant.tag.catalog', 'catalog')], 'danger');
      return;
    }
    if (!window.confirm(t('tenant.confirm.catalogCreate', 'Add catalog entry {id}?', { id: payload.id }))) return;
    try {
      setBusy(button, true, t('common.saving', 'Saving...'));
      await api('/admin/api/shop/add', {
        method: 'POST',
        body: payload,
      });
      form.reset();
      form.elements.kind.value = 'item';
      form.elements.quantity.value = '1';
      showToast(t('tenant.toast.catalogCreated', 'Catalog entry created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.catalogCreateFailed', 'Catalog create failed'), String(error.message || error), [t('tenant.tag.catalog', 'catalog')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleShopPriceSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const idOrName = String(form.elements.idOrName.value || '').trim();
    const price = Math.trunc(Number(form.elements.price.value || 0));
    if (!idOrName || !Number.isFinite(price)) {
      setBanner(t('tenant.banner.priceIncompleteTitle', 'Price update is incomplete'), t('tenant.banner.priceIncompleteDetail', 'Provide a catalog id/name and a numeric price.'), [t('tenant.tag.catalog', 'catalog')], 'danger');
      return;
    }
    if (!window.confirm(t('tenant.confirm.priceUpdate', 'Update price for {idOrName}?', { idOrName }))) return;
    try {
      setBusy(button, true, t('common.updating', 'Updating...'));
      await api('/admin/api/shop/price', {
        method: 'POST',
        body: {
          tenantId: state.me?.tenantId,
          idOrName,
          price,
        },
      });
      form.reset();
      showToast(t('tenant.toast.catalogPriceUpdated', 'Catalog price updated.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.priceUpdateFailed', 'Price update failed'), String(error.message || error), [t('tenant.tag.catalog', 'catalog')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleShopDeleteSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const idOrName = String(form.elements.idOrName.value || '').trim();
    if (!idOrName) {
      setBanner(t('tenant.banner.deleteTargetMissingTitle', 'Delete target missing'), t('tenant.banner.deleteTargetMissingDetail', 'Provide the catalog id or name to remove.'), [t('tenant.tag.catalog', 'catalog')], 'danger');
      return;
    }
    if (!window.confirm(t('tenant.confirm.catalogDelete', 'Delete catalog entry {idOrName}?', { idOrName }))) return;
    try {
      setBusy(button, true, t('common.deleting', 'Deleting...'));
      await api('/admin/api/shop/delete', {
        method: 'POST',
        body: {
          tenantId: state.me?.tenantId,
          idOrName,
        },
      });
      form.reset();
      showToast(t('tenant.toast.catalogRemoved', 'Catalog entry removed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.catalogDeleteFailed', 'Catalog delete failed'), String(error.message || error), [t('tenant.tag.catalog', 'catalog')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleTenantApiKeySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const name = String(form.elements.name.value || '').trim();
    if (!name) {
      setBanner(t('tenant.banner.apiKeyIncompleteTitle', 'API key form is incomplete'), t('tenant.banner.apiKeyIncompleteDetail', 'Provide a key name before creating a tenant API key.'), [t('tenant.tag.integrations', 'integrations')], 'danger');
      return;
    }
    try {
      if (!window.confirm(t('tenant.confirm.apiKeyCreate', 'Create tenant API key {name}?', { name }))) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      const result = await api('/admin/api/platform/apikey', {
        method: 'POST',
        body: {
          id: `tenant-key-${Date.now()}`,
          tenantId: state.me?.tenantId,
          name,
          status: String(form.elements.status.value || 'active').trim(),
          scopes: String(form.elements.scopes.value || '').split(',').map((entry) => entry.trim()).filter(Boolean),
        },
      });
      state.integrationResult = {
        kind: 'api-key',
        title: t('tenant.integrationResult.apiKeyCreatedTitle', 'Tenant API key created'),
        detail: t('tenant.integrationResult.apiKeyCreatedDetail', 'Store the raw key now. Listing endpoints will not show the secret again.'),
        createdAt: new Date().toISOString(),
        rows: [
          { label: t('tenant.integrationResult.keyId', 'Key ID'), value: result.apiKey?.id || result.id || '-', code: true },
          { label: t('tenant.integrationResult.rawKey', 'Raw Key'), value: result.rawKey || '-', code: true },
          { label: t('tenant.form.scopes', 'Scopes'), value: Array.isArray(result.apiKey?.scopes) ? result.apiKey.scopes.join(', ') : String(form.elements.scopes.value || '').trim() || '-', code: false },
        ],
      };
      form.reset();
      form.elements.status.value = 'active';
      showToast(t('tenant.toast.apiKeyCreated', 'Tenant API key created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.apiKeyCreateFailed', 'API key create failed'), String(error.message || error), [t('tenant.tag.integrations', 'integrations')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleTenantWebhookSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const name = String(form.elements.name.value || '').trim();
    const targetUrl = String(form.elements.targetUrl.value || '').trim();
    if (!name || !targetUrl) {
      setBanner(t('tenant.banner.webhookIncompleteTitle', 'Webhook form is incomplete'), t('tenant.banner.webhookIncompleteDetail', 'Provide both name and target URL before creating a tenant webhook.'), [t('tenant.tag.integrations', 'integrations')], 'danger');
      return;
    }
    try {
      if (!window.confirm(t('tenant.confirm.webhookCreate', 'Create tenant webhook {name}?', { name }))) return;
      setBusy(button, true, t('common.creating', 'Creating...'));
      const result = await api('/admin/api/platform/webhook', {
        method: 'POST',
        body: {
          id: `tenant-hook-${Date.now()}`,
          tenantId: state.me?.tenantId,
          name,
          eventType: String(form.elements.eventType.value || '*').trim() || '*',
          targetUrl,
          secretValue: String(form.elements.secretValue.value || '').trim(),
          enabled: String(form.elements.enabled.value || 'true') === 'true',
        },
      });
      state.integrationResult = {
        kind: 'webhook',
        title: t('tenant.integrationResult.webhookCreatedTitle', 'Tenant webhook created'),
        detail: t('tenant.integrationResult.webhookCreatedDetail', 'If a raw secret was returned, store it now.'),
        createdAt: new Date().toISOString(),
        rows: [
          { label: t('tenant.integrationResult.webhookId', 'Webhook ID'), value: result.id || '-', code: true },
          { label: t('tenant.form.eventType', 'Event Type'), value: result.eventType || '-', code: false },
          { label: t('tenant.form.targetUrl', 'Target URL'), value: result.targetUrl || targetUrl, code: false },
          { label: t('tenant.form.secret', 'Secret'), value: result.secretValue || String(form.elements.secretValue.value || '').trim() || t('tenant.integrationResult.generatedHidden', '(generated and hidden)'), code: true },
        ],
      };
      form.reset();
      form.elements.enabled.value = 'true';
      showToast(t('tenant.toast.webhookCreated', 'Tenant webhook created.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.webhookCreateFailed', 'Webhook create failed'), String(error.message || error), [t('tenant.tag.integrations', 'integrations')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleTenantWebhookTestSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    try {
      if (!window.confirm(t('tenant.confirm.webhookTest', 'Dispatch tenant webhook test event?'))) return;
      setBusy(button, true, t('common.dispatching', 'Dispatching...'));
      const payloadText = String(form.elements.payload.value || '').trim();
      const result = await api('/admin/api/platform/webhook/test', {
        method: 'POST',
        body: {
          tenantId: state.me?.tenantId,
          eventType: String(form.elements.eventType.value || 'platform.admin.test').trim() || 'platform.admin.test',
          payload: payloadText ? parseOptionalJson(payloadText, t('tenant.form.webhookPayload', 'Webhook payload')) : null,
        },
      });
      state.integrationResult = {
        kind: 'webhook-test',
        title: t('tenant.integrationResult.webhookTestTitle', 'Webhook test dispatched'),
        detail: t('tenant.integrationResult.webhookTestDetail', 'The tenant-scoped webhook dispatch completed.'),
        createdAt: new Date().toISOString(),
        rows: [
          { label: t('tenant.form.eventType', 'Event Type'), value: result.eventType || '-', code: false },
          { label: t('tenant.integrationResult.resultCount', 'Result Count'), value: String(Array.isArray(result.results) ? result.results.length : 0), code: false },
        ],
      };
      showToast(t('tenant.toast.webhookTestDispatched', 'Tenant webhook test dispatched.'), 'success');
      renderPlanIntegrations();
    } catch (error) {
      setBanner(t('tenant.banner.webhookTestFailed', 'Webhook test failed'), String(error.message || error), [t('tenant.tag.integrations', 'integrations')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  function parseCodesInput(raw) {
    return Array.from(new Set(
      String(raw || '')
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ));
  }

  async function handleBulkDeliverySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const action = String(form.elements.action.value || 'retry-many').trim();
    const codes = parseCodesInput(form.elements.codes.value);
    if (codes.length === 0) {
      setBanner(
        t('tenant.banner.bulkDeliveryIncompleteTitle', 'Bulk delivery action is incomplete'),
        t('tenant.banner.bulkDeliveryIncompleteDetail', 'Provide at least one purchase code before running a batch action.'),
        [t('tenant.tag.delivery', 'delivery')],
        'danger'
      );
      return;
    }
    const endpoint = action === 'dead-letter-retry-many'
      ? '/admin/api/delivery/dead-letter/retry-many'
      : '/admin/api/delivery/retry-many';
    try {
      if (!window.confirm(t('tenant.confirm.bulkDelivery', 'Run {action} for {count} purchase codes?', { action, count: String(codes.length) }))) return;
      setBusy(button, true, t('common.running', 'Running...'));
      const result = await api(endpoint, {
        method: 'POST',
        body: {
          tenantId: state.me?.tenantId,
          codes,
        },
      });
      const count = Array.isArray(result) ? result.length : Array.isArray(result?.results) ? result.results.length : codes.length;
      state.bulkDeliveryResult = {
        kind: action,
        title: t('tenant.actions.bulkCompletedTitle', 'Bulk delivery action completed'),
        detail: t('tenant.actions.bulkCompletedDetail', 'Processed {count} code(s) inside the current tenant scope.', { count: String(count) }),
        createdAt: new Date().toISOString(),
        rows: [
          { label: t('tenant.form.action', 'Action'), value: action, code: false },
          { label: t('tenant.actions.codes', 'Codes'), value: codes.join(', '), code: true },
          { label: t('tenant.actions.processed', 'Processed'), value: String(count), code: false },
        ],
      };
      showToast(t('tenant.toast.bulkDeliveryCompleted', 'Bulk delivery action completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.bulkDeliveryFailed', 'Bulk delivery action failed'), String(error.message || error), [t('tenant.tag.delivery', 'delivery')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function loadPurchases(userId, status, options = {}) {
    const { button = null, showSuccess = false } = options;
    if (!userId) {
      setBanner(
        t('tenant.banner.purchaseLookupIncompleteTitle', 'Purchase lookup is incomplete'),
        t('tenant.banner.purchaseLookupIncompleteDetail', 'Provide a Discord user ID before loading purchase history.'),
        [t('tenant.tag.purchase', 'purchase')],
        'danger'
      );
      return false;
    }
    try {
      if (button) {
      setBusy(button, true, t('common.loading', 'Loading...'));
      }
      const tenantId = getTenantId();
      const encodedUser = encodeURIComponent(userId);
      const encodedStatus = status ? `&status=${encodeURIComponent(status)}` : '';
      const purchases = await api(`/admin/api/purchase/list?tenantId=${tenantId}&userId=${encodedUser}&limit=20${encodedStatus}`);
      state.purchaseLookup = {
        userId,
        status,
        items: listFromPayload(purchases),
      };
      renderPurchaseInspector();
      if (showSuccess) {
      showToast(t('tenant.toast.purchaseListLoaded', 'Purchase list loaded.'), 'success');
      }
      return true;
    } catch (error) {
      state.purchaseLookup = { userId, status, items: [] };
      renderPurchaseInspector();
      setBanner(t('tenant.banner.purchaseLookupFailed', 'Purchase lookup failed'), String(error.message || error), [t('tenant.tag.purchase', 'purchase')], 'danger');
      return false;
    } finally {
      if (button) {
        setBusy(button, false);
      }
    }
  }

  async function loadDeliveryCase(purchaseCode, options = {}) {
    const code = String(purchaseCode || '').trim();
    const button = options.button || document.getElementById('tenantDeliveryCaseLoadBtn');
    if (!code) {
      state.deliveryCase = null;
      renderDeliveryCase();
      return false;
    }
    try {
      if (button) setBusy(button, true, t('common.loading', 'Loading...'));
      state.deliveryCase = await api(`/admin/api/delivery/detail?tenantId=${getTenantId()}&code=${encodeURIComponent(code)}&limit=80`);
      renderDeliveryCase();
      if (options.focus !== false) {
        openTenantTarget('transactions', { targetId: 'tenantDeliveryCaseStats', block: 'center' });
      }
      if (options.toast !== false) {
        showToast(t('tenant.toast.deliveryCaseLoaded', 'Delivery case loaded.'), 'success');
      }
      return true;
    } catch (error) {
      state.deliveryCase = null;
      renderDeliveryCase();
      setBanner(t('tenant.banner.deliveryCaseFailed', 'Delivery case failed to load'), String(error.message || error), [t('tenant.tag.deliveryCase', 'delivery-case')], 'danger');
      return false;
    } finally {
      if (button) setBusy(button, false);
    }
  }

  async function handlePurchaseLookupSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const userId = String(form.elements.userId.value || '').trim();
    const status = String(form.elements.status.value || '').trim();
    await loadPurchases(userId, status, { button, showSuccess: true });
  }

  async function handlePurchaseStatusSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const code = String(form.elements.code.value || '').trim();
    const status = String(form.elements.status.value || '').trim();
    const reason = String(form.elements.reason.value || '').trim() || 'tenant-console-manual-update';
    if (!code || !status) {
      setBanner(
        t('tenant.banner.statusUpdateIncompleteTitle', 'Status update is incomplete'),
        t('tenant.banner.statusUpdateIncompleteDetail', 'Provide both purchase code and target status before applying a change.'),
        [t('tenant.tag.purchase', 'purchase')],
        'danger'
      );
      return;
    }
    if (!window.confirm(t('tenant.confirm.setPurchaseStatus', 'Set {code} to {status}?', { code, status }))) return;
    try {
      setBusy(button, true, t('common.applying', 'Applying...'));
      await api('/admin/api/purchase/status', {
        method: 'POST',
        body: {
          tenantId: state.me?.tenantId,
          code,
          status,
          reason,
        },
      });
      showToast(t('tenant.toast.purchaseStatusUpdated', 'Purchase status updated.'), 'success');
      if (code && state.deliveryCase?.purchaseCode === code) {
        await loadDeliveryCase(code, { toast: false, focus: false });
      }
      if (state.purchaseLookup.userId) {
        await loadPurchases(state.purchaseLookup.userId, state.purchaseLookup.status || '', { showSuccess: false });
      } else {
        await refreshSurface();
      }
    } catch (error) {
      setBanner(t('tenant.banner.statusUpdateFailed', 'Status update failed'), String(error.message || error), [t('tenant.tag.purchase', 'purchase')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleSteamLinkSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const action = String(form.elements.action.value || 'set').trim();
    const userId = String(form.elements.userId.value || '').trim();
    const steamId = String(form.elements.steamId.value || '').trim();
    const inGameName = String(form.elements.inGameName.value || '').trim();
    if (!userId) {
      setBanner(
        t('tenant.banner.steamLinkIncompleteTitle', 'Steam link action is incomplete'),
        t('tenant.banner.steamLinkIncompleteDetail', 'Provide a Discord user ID before running support link actions.'),
        [t('tenant.tag.support', 'support')],
        'danger'
      );
      return;
    }
    if (action === 'set' && !steamId) {
      setBanner(
        t('tenant.banner.steamIdRequiredTitle', 'Steam ID required'),
        t('tenant.banner.steamIdRequiredDetail', 'Set action requires a Steam ID.'),
        [t('tenant.tag.support', 'support')],
        'danger'
      );
      return;
    }
    if (!window.confirm(t('tenant.confirm.steamLinkAction', 'Run {action} steam link support action for {userId}?', { action, userId }))) return;
    try {
      setBusy(button, true, t('common.applying', 'Applying...'));
      await api(action === 'remove' ? '/admin/api/link/remove' : '/admin/api/link/set', {
        method: 'POST',
        body: action === 'remove'
          ? { userId, steamId }
          : { userId, steamId, inGameName },
      });
      form.reset();
      form.elements.action.value = 'set';
      showToast(t('tenant.toast.steamLinkCompleted', 'Steam link support action completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.steamLinkFailed', 'Steam link support failed'), String(error.message || error), [t('tenant.tag.support', 'support')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleVipSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const action = String(form.elements.action.value || 'set').trim();
    const userId = String(form.elements.userId.value || '').trim();
    const planId = String(form.elements.planId.value || '').trim();
    const durationDays = Math.trunc(Number(form.elements.durationDays.value || 0));
    if (!userId) {
      setBanner(
        t('tenant.banner.vipIncompleteTitle', 'VIP action is incomplete'),
        t('tenant.banner.vipIncompleteDetail', 'Provide a Discord user ID before updating VIP state.'),
        [t('tenant.tag.support', 'support')],
        'danger'
      );
      return;
    }
    if (action === 'set' && (!planId || !Number.isFinite(durationDays) || durationDays <= 0)) {
      setBanner(
        t('tenant.banner.vipGrantIncompleteTitle', 'VIP grant is incomplete'),
        t('tenant.banner.vipGrantIncompleteDetail', 'Grant action requires both plan id and duration days.'),
        [t('tenant.tag.support', 'support')],
        'danger'
      );
      return;
    }
    if (!window.confirm(t('tenant.confirm.vipAction', 'Run {action} VIP action for {userId}?', { action, userId }))) return;
    try {
      setBusy(button, true, t('common.applying', 'Applying...'));
      await api(action === 'remove' ? '/admin/api/vip/remove' : '/admin/api/vip/set', {
        method: 'POST',
        body: action === 'remove'
          ? { userId }
          : { userId, planId, durationDays },
      });
      form.reset();
      form.elements.action.value = 'set';
      form.elements.durationDays.value = '30';
      showToast(t('tenant.toast.vipCompleted', 'VIP action completed.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.vipFailed', 'VIP action failed'), String(error.message || error), [t('tenant.tag.support', 'support')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleRedeemSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const action = String(form.elements.action.value || 'add').trim();
    const code = String(form.elements.code.value || '').trim();
    const type = String(form.elements.type.value || 'coins').trim();
    const amountText = String(form.elements.amount.value || '').trim();
    const itemId = String(form.elements.itemId.value || '').trim();
    if (!code) {
      setBanner(
        t('tenant.banner.redeemIncompleteTitle', 'Redeem action is incomplete'),
        t('tenant.banner.redeemIncompleteDetail', 'Provide the redeem code before applying support changes.'),
        [t('tenant.tag.support', 'support')],
        'danger'
      );
      return;
    }
    if (action === 'add') {
      if (!type) {
        setBanner(
          t('tenant.banner.redeemTypeRequiredTitle', 'Redeem type required'),
          t('tenant.banner.redeemTypeRequiredDetail', 'Choose a redeem code type before creating the code.'),
          [t('tenant.tag.support', 'support')],
          'danger'
        );
        return;
      }
      if (type === 'coins' && !amountText) {
        setBanner(
          t('tenant.banner.redeemAmountRequiredTitle', 'Redeem amount required'),
          t('tenant.banner.redeemAmountRequiredDetail', 'Coin redeem codes require an amount.'),
          [t('tenant.tag.support', 'support')],
          'danger'
        );
        return;
      }
      if (type === 'item' && !itemId) {
        setBanner(
          t('tenant.banner.redeemItemRequiredTitle', 'Redeem item required'),
          t('tenant.banner.redeemItemRequiredDetail', 'Item redeem codes require an item id.'),
          [t('tenant.tag.support', 'support')],
          'danger'
        );
        return;
      }
    }
    if (!window.confirm(t('tenant.confirm.redeemAction', 'Run redeem action {action} for {code}?', { action, code }))) return;
    try {
      setBusy(button, true, t('common.applying', 'Applying...'));
      const endpoint = action === 'delete'
        ? '/admin/api/redeem/delete'
        : action === 'reset-usage'
          ? '/admin/api/redeem/reset-usage'
          : '/admin/api/redeem/add';
      const body = action === 'add'
        ? {
            code,
            type,
            amount: amountText ? Math.trunc(Number(amountText)) : null,
            itemId,
          }
        : { code };
      await api(endpoint, {
        method: 'POST',
        body,
      });
      form.reset();
      form.elements.action.value = 'add';
      form.elements.type.value = 'coins';
      showToast(t('tenant.toast.redeemCompleted', 'Redeem support action completed.'), 'success');
    } catch (error) {
      setBanner(t('tenant.banner.redeemFailed', 'Redeem support action failed'), String(error.message || error), [t('tenant.tag.support', 'support')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  async function handleDeliveryLabSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const action = String(form.elements.action.value || 'preview').trim();
    const itemId = String(form.elements.itemId.value || '').trim();
    const gameItemId = String(form.elements.gameItemId.value || '').trim();
    const purchaseCode = String(form.elements.purchaseCode.value || '').trim();
    const userId = String(form.elements.userId.value || '').trim();
    const payload = {
      tenantId: state.me?.tenantId,
      itemId,
      gameItemId,
      itemName: String(form.elements.itemName.value || '').trim(),
      quantity: String(form.elements.quantity.value || '').trim(),
      purchaseCode,
      userId,
      steamId: String(form.elements.steamId.value || '').trim(),
      inGameName: String(form.elements.inGameName.value || '').trim(),
      teleportMode: String(form.elements.teleportMode.value || '').trim(),
      teleportTarget: String(form.elements.teleportTarget.value || '').trim(),
      returnTarget: String(form.elements.returnTarget.value || '').trim(),
    };
    const endpointMap = {
      preview: '/admin/api/delivery/preview',
      preflight: '/admin/api/delivery/preflight',
      simulate: '/admin/api/delivery/simulate',
      'test-send': '/admin/api/delivery/test-send',
    };
    if (action === 'preview' || action === 'simulate' || action === 'test-send') {
      if (!itemId && !gameItemId) {
        setBanner(
          t('tenant.banner.deliveryLabIncompleteTitle', 'Delivery lab is incomplete'),
          t('tenant.banner.deliveryLabItemDetail', 'Preview, simulate, and test-send require item id or game item id.'),
          [t('tenant.tag.deliveryLab', 'delivery-lab')],
          'danger'
        );
        return;
      }
    }
    if (action === 'preflight' && !itemId && !gameItemId && !purchaseCode) {
      setBanner(
        t('tenant.banner.deliveryLabIncompleteTitle', 'Delivery lab is incomplete'),
        t('tenant.banner.deliveryLabPreflightDetail', 'Preflight requires purchase code or item/game item context.'),
        [t('tenant.tag.deliveryLab', 'delivery-lab')],
        'danger'
      );
      return;
    }
    if (action === 'test-send' && !window.confirm(t('tenant.confirm.deliveryLabTestSend', 'Run live test-send against the delivery runtime?'))) {
      return;
    }
    try {
      setBusy(button, true, action === 'test-send' ? t('common.sending', 'Sending...') : t('common.running', 'Running...'));
      const data = await api(endpointMap[action], {
        method: 'POST',
        body: payload,
      });
      state.deliveryLabResult = { action, data };
      renderDeliveryLab();
      showToast(
        t('tenant.toast.deliveryLabCompleted', 'Delivery lab {action} completed.', {
          action: t(`tenant.labAction.${action}`, action),
        }),
        action === 'test-send' ? 'warning' : 'success'
      );
    } catch (error) {
      state.deliveryLabResult = { action, data: { error: String(error.message || error) } };
      renderDeliveryLab();
      setBanner(t('tenant.banner.deliveryLabFailed', 'Delivery lab failed'), String(error.message || error), [t('tenant.tag.deliveryLab', 'delivery-lab')], 'danger');
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
      tenantId: state.me?.tenantId || '',
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
        showToast(t('tenant.toast.auditLoaded', 'Tenant audit view loaded.'), 'success');
      }
      return true;
    } catch (error) {
      state.audit = { cards: [], tableRows: [] };
      renderAudit();
      setBanner(t('tenant.banner.auditQueryFailed', 'Tenant audit query failed'), String(error.message || error), [t('tenant.tag.audit', 'audit')], 'danger');
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
      tenantId: state.me?.tenantId || '',
      view: state.auditFilters.view,
      userId: state.auditFilters.userId,
      q: state.auditFilters.query,
      windowMs: state.auditFilters.windowMs,
      format,
    });
    window.open(`/admin/api/audit/export?${queryString}`, '_blank', 'noopener,noreferrer');
  }

  async function acknowledgeAlerts() {
    const button = document.getElementById('tenantAckAlertsBtn');
    const ids = getTenantScopedNotifications().map((item) => item.id).filter(Boolean);
    if (ids.length === 0) {
      showToast(t('tenant.toast.noAlertsToAcknowledge', 'No alerts to acknowledge.'), 'info');
      return;
    }
    if (!window.confirm(t('tenant.confirm.acknowledgeAlerts', 'Acknowledge current tenant notifications?'))) {
      return;
    }
      setBusy(button, true, t('common.acknowledging', 'Acknowledging...'));
    try {
      await api('/admin/api/notifications/ack', {
        method: 'POST',
        body: { ids },
      });
      showToast(t('tenant.toast.alertsAcknowledged', 'Tenant alerts acknowledged.'), 'success');
      await refreshSurface();
    } catch (error) {
      setBanner(t('tenant.banner.acknowledgeAlertsFailed', 'Acknowledge alerts failed'), String(error.message || error), [t('tenant.tag.alerts', 'alerts')], 'danger');
    } finally {
      setBusy(button, false);
    }
  }

  window.AdminUiI18n?.init?.(['tenantLanguageSelect']);

  workspaceController = wireWorkspaceSwitcher({
    switchId: 'tenantWorkspaceSwitch',
    summaryId: 'tenantWorkspaceSummary',
    hintId: 'tenantWorkspaceHint',
    navListId: 'tenantNavList',
    defaultWorkspace: 'operations',
    workspaces: [
      {
        key: 'operations',
        label: t('tenant.workspace.operations.label', 'Operations'),
        short: 'live',
        title: t('tenant.workspace.operations.title', 'Operations workspace'),
        description: t('tenant.workspace.operations.description', 'Start here for tenant status, runtime alerts, incident review, and health insights before acting on commerce or support.'),
        sidebarHint: t('tenant.workspace.operations.sidebar', 'Use this workspace for tenant snapshot, runtime alerts, incident review, and scoped insights.'),
        tag: t('tenant.workspace.operations.tag', 'tenant'),
      },
      {
        key: 'commerce',
        label: t('tenant.workspace.commerce.label', 'Commerce'),
        short: 'orders',
        title: t('tenant.workspace.commerce.title', 'Commerce workspace'),
        description: t('tenant.workspace.commerce.description', 'Plan posture, integrations, catalog management, purchase handling, and delivery controls stay grouped here for daily commerce work.'),
        sidebarHint: t('tenant.workspace.commerce.sidebar', 'Use this workspace for plans, integrations, commerce, catalog tools, and transaction handling.'),
        tag: t('tenant.workspace.commerce.tag', 'commerce'),
      },
      {
        key: 'support',
        label: t('tenant.workspace.support.label', 'Support'),
        short: 'players',
        title: t('tenant.workspace.support.title', 'Player support workspace'),
        description: t('tenant.workspace.support.description', 'Player activity, support tools, and audit traces stay together so tenant operators can resolve requests without config noise.'),
        sidebarHint: t('tenant.workspace.support.sidebar', 'Use this workspace for player activity, support actions, and audit review.'),
        tag: t('tenant.workspace.support.tag', 'support'),
      },
      {
        key: 'config',
        label: t('tenant.workspace.config.label', 'Config'),
        short: 'safe',
        title: t('tenant.workspace.config.title', 'Config and safe actions workspace'),
        description: t('tenant.workspace.config.description', 'Delivery lab, scoped config editing, and guarded tenant actions stay isolated for safer change management.'),
        sidebarHint: t('tenant.workspace.config.sidebar', 'Use this workspace for sandbox checks, tenant config editing, and safe actions.'),
        tag: t('tenant.workspace.config.tag', 'guarded'),
      },
    ],
    sectionsByWorkspace: {
      operations: ['overview', 'operations', 'incidents', 'insights'],
      commerce: ['commerce', 'plan-integrations', 'catalog-tools', 'transactions'],
      support: ['support-tools', 'players', 'audit'],
      config: ['config', 'sandbox', 'actions'],
    },
  });
  sidebarController = wireSidebarShell({
    sidebarId: 'tenantSidebar',
    navListId: 'tenantNavList',
    toggleButtonId: 'tenantSidebarToggleBtn',
    backdropId: 'tenantSidebarBackdrop',
  });
  document.getElementById('tenantSidebarHint').textContent = t('tenant.sidebarHint', 'Use the area tabs above to switch context. The menu on the left only shows the pages that belong to the active tenant area.');

  const palette = wireCommandPalette({
    openButtonId: 'tenantPaletteBtn',
    closeButtonId: 'tenantPaletteCloseBtn',
    panelId: 'tenantPalette',
    searchId: 'tenantPaletteSearch',
    listId: 'tenantPaletteList',
    emptyId: 'tenantPaletteEmpty',
    getActions() {
      const sectionMeta = t('tenant.palette.meta.sections', 'Tenant pages');
      const actionMeta = t('tenant.palette.meta.actions', 'Tenant actions');
      return [
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('overview') }),
          meta: sectionMeta,
          run: () => openTenantTarget('overview'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('operations') }),
          meta: sectionMeta,
          run: () => openTenantTarget('operations'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('incidents') }),
          meta: sectionMeta,
          run: () => openTenantTarget('incidents'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('insights') }),
          meta: sectionMeta,
          run: () => openTenantTarget('insights'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('plan-integrations') }),
          meta: sectionMeta,
          run: () => openTenantTarget('plan-integrations'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('commerce') }),
          meta: sectionMeta,
          run: () => openTenantTarget('commerce'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('sandbox') }),
          meta: sectionMeta,
          run: () => openTenantTarget('sandbox'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('catalog-tools') }),
          meta: sectionMeta,
          run: () => openTenantTarget('catalog-tools'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('transactions') }),
          meta: sectionMeta,
          run: () => openTenantTarget('transactions'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('support-tools') }),
          meta: sectionMeta,
          run: () => openTenantTarget('support-tools'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('config') }),
          meta: sectionMeta,
          run: () => openTenantTarget('config'),
        },
        {
          label: t('tenant.palette.openPage', 'Open {page}', { page: tenantNavLabel('audit') }),
          meta: sectionMeta,
          run: () => openTenantTarget('audit'),
        },
        {
          label: t('tenant.palette.refresh', 'Refresh tenant console'),
          meta: actionMeta,
          run: () => refreshSurface(),
        },
        {
          label: t('tenant.palette.acknowledgeAlerts', 'Acknowledge alerts'),
          meta: actionMeta,
          run: acknowledgeAlerts,
        },
        {
          label: t('tenant.palette.focusLab', 'Focus delivery lab'),
          meta: actionMeta,
          run: () => openTenantTarget('sandbox', { targetId: 'tenantDeliveryLabForm', block: 'center' }),
        },
        {
          label: t('tenant.palette.focusDeliveryCase', 'Focus delivery case'),
          meta: actionMeta,
          run: () => openTenantTarget('transactions', { targetId: 'tenantDeliveryCaseForm', block: 'center' }),
        },
        {
          label: t('tenant.palette.focusAudit', 'Focus audit query'),
          meta: actionMeta,
          run: () => openTenantTarget('audit', { targetId: 'tenantAuditQueryForm', block: 'center' }),
        },
        {
          label: t('tenant.palette.focusIncidents', 'Focus incident query'),
          meta: actionMeta,
          run: () => openTenantTarget('incidents', { targetId: 'tenantIncidentQueryForm', block: 'center' }),
        },
      ];
    },
  });

  document.getElementById('tenantRefreshBtn').addEventListener('click', () => refreshSurface());
  document.getElementById('tenantAckAlertsBtn').addEventListener('click', acknowledgeAlerts);
  document.getElementById('tenantIncidentQueryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    state.incidentFilters.severity = String(form.elements.severity.value || '').trim();
    state.incidentFilters.kind = String(form.elements.kind.value || '').trim();
    state.incidentFilters.source = String(form.elements.source.value || '').trim();
    renderIncidentCenter();
        showToast(t('tenant.toast.incidentViewUpdated', 'Tenant incident view updated.'), 'info');
  });
  document.getElementById('tenantIncidentExportJsonBtn').addEventListener('click', () => {
    const rows = getFilteredTenantIncidents();
    if (!rows.length) {
      showToast(t('tenant.toast.noIncidentsToExport', 'No tenant incidents to export.'), 'info');
      return;
    }
    downloadClientFile(
      `tenant-incidents-${String(state.me?.tenantId || 'tenant')}.json`,
      `${JSON.stringify(rows, null, 2)}\n`,
      'application/json;charset=utf-8'
    );
  });
  document.getElementById('tenantIncidentExportCsvBtn').addEventListener('click', () => {
    const rows = getFilteredTenantIncidents();
    if (!rows.length) {
      showToast(t('tenant.toast.noIncidentsToExport', 'No tenant incidents to export.'), 'info');
      return;
    }
    downloadClientFile(
      `tenant-incidents-${String(state.me?.tenantId || 'tenant')}.csv`,
      buildTenantIncidentCsv(rows),
      'text/csv;charset=utf-8'
    );
  });
  document.getElementById('tenantIncidentFeed').addEventListener('click', (event) => {
    const button = event.target.closest('[data-incident-target]');
    if (!button) return;
    const targetId = String(button.dataset.incidentTarget || '').trim();
    if (targetId) {
      openTenantTarget(targetId);
    }
  });
  document.getElementById('tenantQuickActions')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tenant-quick-action]');
    if (!button) return;
    runTenantQuickAction(button.getAttribute('data-tenant-quick-action'));
  });
  document.getElementById('tenantPresetGuides')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tenant-preset-action]');
    if (!button) return;
    runTenantPresetAction(button.getAttribute('data-tenant-preset-action'));
  });
  document.getElementById('tenantModuleGuides')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tenant-module-action]');
    if (!button) return;
    runTenantModuleAction(button.getAttribute('data-tenant-module-action'));
  });
  document.getElementById('tenantSupportToolkit')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tenant-support-tool]');
    if (!button) return;
    runTenantSupportToolkitAction(button.getAttribute('data-tenant-support-tool'));
  });
  document.getElementById('tenantRestartPresetBtn')?.addEventListener('click', () => {
    showToast(t('tenant.toast.restartPresetOpened', 'Restart flow opened.'), 'info');
    openTenantTarget('support-tools', { targetId: 'tenantRestartPresetChecklist', block: 'center' });
  });
  document.getElementById('tenantDeliveryLifecycleExportJsonBtn')?.addEventListener('click', () => {
    openDeliveryLifecycleExport('json');
  });
  document.getElementById('tenantDeliveryLifecycleActions')?.addEventListener('click', async (event) => {
    const navButton = event.target.closest('[data-tenant-lifecycle-nav]');
    if (navButton) {
      openTenantTarget(navButton.getAttribute('data-tenant-lifecycle-nav'));
      return;
    }
    const bulkButton = event.target.closest('[data-tenant-lifecycle-bulk]');
    if (bulkButton) {
      populateBulkDeliveryForm(
        String(bulkButton.getAttribute('data-tenant-lifecycle-bulk') || '').trim(),
        String(bulkButton.getAttribute('data-codes') || '').split(','),
      );
      return;
    }
    const exportButton = event.target.closest('[data-tenant-lifecycle-export]');
    if (exportButton) {
      openDeliveryLifecycleExport(exportButton.getAttribute('data-tenant-lifecycle-export'));
      return;
    }
    const caseButton = event.target.closest('[data-tenant-lifecycle-case]');
    if (caseButton) {
      const purchaseCode = String(caseButton.getAttribute('data-tenant-lifecycle-case') || '').trim();
      if (!purchaseCode) return;
      await loadDeliveryCase(purchaseCode, {
        button: caseButton,
        focus: true,
        toast: true,
      });
    }
  });
  document.getElementById('tenantConfigPreviewBtn').addEventListener('click', previewTenantConfig);
  document.getElementById('tenantConfigResetBtn').addEventListener('click', resetTenantConfigForm);
  document.getElementById('tenantConfigForm').addEventListener('submit', handleTenantConfigSubmit);
  document.getElementById('tenantConfigForm').addEventListener('input', () => {
    state.configEditorDirty = true;
  });
  document.getElementById('tenantWalletForm').addEventListener('submit', handleWalletSubmit);
  document.getElementById('tenantDeliveryForm').addEventListener('submit', handleDeliverySubmit);
  document.getElementById('tenantDeliveryBulkForm').addEventListener('submit', handleBulkDeliverySubmit);
  document.getElementById('tenantShopCreateForm').addEventListener('submit', handleShopCreateSubmit);
  document.getElementById('tenantShopPriceForm').addEventListener('submit', handleShopPriceSubmit);
  document.getElementById('tenantShopDeleteForm').addEventListener('submit', handleShopDeleteSubmit);
  document.getElementById('tenantApiKeyForm').addEventListener('submit', handleTenantApiKeySubmit);
  document.getElementById('tenantWebhookForm').addEventListener('submit', handleTenantWebhookSubmit);
  document.getElementById('tenantWebhookTestForm').addEventListener('submit', handleTenantWebhookTestSubmit);
  document.getElementById('tenantPurchaseLookupForm').addEventListener('submit', handlePurchaseLookupSubmit);
  document.getElementById('tenantDeliveryCaseForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const purchaseCode = String(form.elements.purchaseCode.value || '').trim();
    await loadDeliveryCase(purchaseCode, {
      button: document.getElementById('tenantDeliveryCaseLoadBtn'),
      focus: true,
      toast: true,
    });
  });
  document.getElementById('tenantDeliveryCaseExportBtn').addEventListener('click', () => {
    const purchaseCode = String(state.deliveryCase?.purchaseCode || document.getElementById('tenantDeliveryCaseForm')?.elements?.purchaseCode?.value || '').trim();
    if (!purchaseCode) {
      showToast(t('tenant.toast.deliveryCaseMissing', 'Choose a purchase code first.'), 'info');
      return;
    }
    window.open(
      `/admin/api/delivery/detail?tenantId=${getTenantId()}&code=${encodeURIComponent(purchaseCode)}&limit=80`,
      '_blank',
      'noopener,noreferrer',
    );
    showToast(t('tenant.toast.deliveryCaseExportStarted', 'Delivery case JSON opened.'), 'info');
  });
  document.getElementById('tenantPurchaseTable').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delivery-case-code]');
    if (!button) return;
    const purchaseCode = String(button.getAttribute('data-delivery-case-code') || '').trim();
    loadDeliveryCase(purchaseCode, {
      button,
      focus: true,
      toast: true,
    });
  });
  document.getElementById('tenantPurchaseStatusForm').addEventListener('submit', handlePurchaseStatusSubmit);
  document.getElementById('tenantSteamLinkForm').addEventListener('submit', handleSteamLinkSubmit);
  document.getElementById('tenantVipForm').addEventListener('submit', handleVipSubmit);
  document.getElementById('tenantRedeemForm').addEventListener('submit', handleRedeemSubmit);
  document.getElementById('tenantDeliveryLabForm').addEventListener('submit', handleDeliveryLabSubmit);
  document.getElementById('tenantAuditQueryForm').addEventListener('submit', handleAuditQuerySubmit);
  document.getElementById('tenantAuditExportJsonBtn').addEventListener('click', () => exportAudit('json'));
  document.getElementById('tenantAuditExportCsvBtn').addEventListener('click', () => exportAudit('csv'));
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
