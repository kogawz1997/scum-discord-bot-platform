(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerControlRiskV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function createOwnerControlRiskV4(deps) {
    const escapeHtml = deps && deps.escapeHtml;
    const trimText = deps && deps.trimText;
    const firstNonEmpty = deps && deps.firstNonEmpty;
    const parseObject = deps && deps.parseObject;
    const formatNumber = deps && deps.formatNumber;
    const formatDateTime = deps && deps.formatDateTime;
    const ownerSupportHref = deps && deps.ownerSupportHref;
    const ownerTenantHref = deps && deps.ownerTenantHref;

    function getOwnerNotificationData(row) {
      return parseObject(row && (row.data || row.payload || row.meta));
    }

    function getOwnerNotificationKind(row) {
      const data = getOwnerNotificationData(row);
      return firstNonEmpty([
        trimText(row && row.kind, 120),
        trimText(row && row.type, 120),
        trimText(data && data.kind, 120),
      ], '');
    }

    function getOwnerNotificationTenantId(row) {
      const data = getOwnerNotificationData(row);
      return firstNonEmpty([
        trimText(row && row.tenantId, 160),
        trimText(data && data.tenantId, 160),
      ], '');
    }

    function buildOwnerRiskQueueItems(state, tenantRows) {
      const notifications = Array.isArray(state && state.notifications) ? state.notifications : [];
      const securityEvents = Array.isArray(state && state.securityEvents) ? state.securityEvents : [];
      const requestItems = Array.isArray(state && state.requestLogs && state.requestLogs.items) ? state.requestLogs.items : [];
      const deliveryLifecycle = parseObject(state && state.deliveryLifecycle);
      const deliverySummary = parseObject(deliveryLifecycle.summary);
      const deliveryActionPlan = parseObject(deliveryLifecycle.actionPlan);
      const deliveryRuntime = parseObject(deliveryLifecycle.runtime);
      const tenantLookup = new Map((Array.isArray(tenantRows) ? tenantRows : []).map((row) => [
        trimText(row && row.tenantId, 160),
        row,
      ]));
      const queue = [];
      const seen = new Set();

      function pushItem(item) {
        const key = trimText(item && item.key, 200);
        if (!key || seen.has(key)) return;
        seen.add(key);
        queue.push({
          weight: Number(item && item.weight) || 0,
          tone: trimText(item && item.tone, 40) || 'warning',
          label: trimText(item && item.label, 160) || 'Risk item',
          title: trimText(item && item.title, 240) || '-',
          detail: trimText(item && item.detail, 400) || '-',
          actions: trimText(item && item.actions, 4000) || '',
          key,
        });
      }

      function buildTenantLinks(tenantId, notificationId) {
        const safeTenantId = trimText(tenantId, 160);
        const actions = [];
        if (safeTenantId) {
          actions.push(`<a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerSupportHref(safeTenantId))}">Open support case</a>`);
          actions.push(`<a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerTenantHref(safeTenantId))}">Open tenant detail</a>`);
        }
        if (notificationId) {
          actions.push(`<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="acknowledge-notification" data-notification-id="${escapeHtml(notificationId)}" data-return-route="/owner/analytics">Acknowledge</button>`);
        }
        return actions.join('');
      }

      notifications.forEach((row) => {
        const notificationId = trimText(row && row.id, 160);
        const kind = getOwnerNotificationKind(row).toLowerCase();
        const severity = trimText(row && row.severity, 40).toLowerCase();
        const tenantId = getOwnerNotificationTenantId(row);
        const tenantRow = tenantLookup.get(tenantId) || null;
        const data = getOwnerNotificationData(row);
        const tenantLabel = firstNonEmpty([
          tenantRow && tenantRow.tenant && (tenantRow.tenant.name || tenantRow.tenant.slug),
          tenantRow && tenantRow.name,
          tenantRow && tenantRow.slug,
          tenantId,
        ], 'Shared platform');
        const tone = ['critical', 'error', 'danger'].includes(severity)
          ? 'danger'
          : (kind === 'delivery-abuse-suspected' || kind === 'runtime-offline' ? 'danger' : 'warning');
        const detail = firstNonEmpty([
          trimText(row && row.message, 240),
          trimText(row && row.detail, 240),
          Array.isArray(data && data.sample) && data.sample.length > 0
            ? `${trimText(data.sample[0] && data.sample[0].type, 80) || 'sample'}`
            : '',
        ], 'Operator review is required.');
        if (['delivery-abuse-suspected', 'delivery-reconcile-anomaly', 'runtime-offline', 'runtime-degraded', 'agent-runtime-stale', 'agent-version-outdated', 'agent-circuit-open', 'platform-webhook-failed', 'login-failure-spike', 'queue-pressure', 'fail-rate', 'dead-letter-threshold'].includes(kind)) {
          const runtimeAction = ['runtime-offline', 'runtime-degraded', 'agent-runtime-stale', 'agent-version-outdated', 'agent-circuit-open'].includes(kind)
            ? '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Open runtime health</a>'
            : '';
          pushItem({
            key: `notification-${notificationId || kind}`,
            weight: kind === 'delivery-abuse-suspected' ? 340 : kind === 'runtime-offline' ? 320 : kind === 'delivery-reconcile-anomaly' ? 300 : 240,
            tone,
            label: kind === 'delivery-abuse-suspected' ? 'Abuse signal' : kind === 'delivery-reconcile-anomaly' ? 'Delivery anomaly' : 'Platform risk',
            title: `${tenantLabel} - ${firstNonEmpty([trimText(row && row.title, 160), trimText(kind, 80)], 'Notification')}`,
            detail,
            actions: `${buildTenantLinks(tenantId, notificationId)}${runtimeAction}`,
          });
        }
      });

      securityEvents.forEach((row) => {
        const type = trimText(row && row.type, 160);
        const severity = trimText(row && row.severity, 40).toLowerCase();
        if (!type || (!/(fail|anomaly|mismatch|revoked|denied|blocked|expired|step_up|rate)/i.test(type) && !['warning', 'error', 'critical'].includes(severity))) {
          return;
        }
        pushItem({
          key: `security-${type}-${trimText(row && (row.createdAt || row.at), 80)}`,
          weight: severity === 'error' || severity === 'critical' ? 230 : 180,
          tone: severity === 'error' || severity === 'critical' ? 'danger' : 'warning',
          label: 'Security anomaly',
          title: type,
          detail: firstNonEmpty([
            trimText(row && row.detail, 240),
            trimText(row && row.actor, 120),
            trimText(row && row.targetUser, 120),
          ], 'Review audit evidence and security events.'),
          actions: '<a class="odv4-button odv4-button-secondary" href="/owner/audit">Open audit</a>',
        });
      });

      requestItems.forEach((row) => {
        const statusCode = Number(row && row.statusCode);
        if (!Number.isFinite(statusCode) || statusCode < 500) return;
        pushItem({
          key: `request-${trimText(row && row.method, 40)}-${trimText(row && (row.path || row.routeGroup), 160)}-${trimText(row && (row.at || row.createdAt), 80)}`,
          weight: 170,
          tone: 'danger',
          label: 'Request anomaly',
          title: `${trimText(row && row.method, 40) || 'REQ'} ${trimText(row && (row.path || row.routeGroup), 160) || '/'}`,
          detail: `Status ${trimText(row && row.statusCode, 20) || '-'} at ${formatDateTime(row && (row.at || row.createdAt))}`,
          actions: '<a class="odv4-button odv4-button-secondary" href="/owner/audit">Inspect request evidence</a>',
        });
      });

      if (
        Number(deliverySummary.overdueCount || 0) > 0
        || Number(deliverySummary.poisonCandidateCount || 0) > 0
        || Number(deliverySummary.nonRetryableDeadLetters || 0) > 0
        || deliveryRuntime.workerStarted === false
      ) {
        const actionKeys = Array.isArray(deliveryActionPlan.actions)
          ? deliveryActionPlan.actions.map((row) => trimText(row && row.key, 80)).filter(Boolean)
          : [];
        pushItem({
          key: 'delivery-lifecycle-risk',
          weight: 260,
          tone: Number(deliverySummary.poisonCandidateCount || 0) > 0 || deliveryRuntime.workerStarted === false ? 'danger' : 'warning',
          label: 'Delivery lifecycle risk',
          title: 'Shared delivery backlog',
          detail: [
            `overdue ${formatNumber(deliverySummary.overdueCount || 0, '0')}`,
            `poison ${formatNumber(deliverySummary.poisonCandidateCount || 0, '0')}`,
            `dead letters ${formatNumber(deliverySummary.nonRetryableDeadLetters || 0, '0')}`,
            actionKeys.length ? `actions ${actionKeys.join(', ')}` : '',
          ].filter(Boolean).join(' | '),
          actions: '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Open runtime health</a><a class="odv4-button odv4-button-secondary" href="/owner/audit">Open audit</a>',
        });
      }

      return queue
        .sort((left, right) => (Number(right && right.weight) || 0) - (Number(left && left.weight) || 0))
        .slice(0, 8);
    }

    function renderOwnerRiskQueue(state, tenantRows) {
      const items = buildOwnerRiskQueueItems(state, tenantRows);
      const cards = items.map((item) => [
        `<article class="odvc4-note-card" data-owner-risk-item="${escapeHtml(item.key)}">`,
        `<div class="odvc4-action-row"><span class="odv4-pill odv4-pill-${escapeHtml(item.tone || 'warning')}">${escapeHtml(item.label || 'Risk item')}</span></div>`,
        `<strong>${escapeHtml(item.title || '-')}</strong>`,
        `<p>${escapeHtml(item.detail || '-')}</p>`,
        item.actions ? `<div class="odvc4-inline-actions">${item.actions}</div>` : '',
        '</article>',
      ].join('')).join('');
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-risk-queue" data-owner-risk-queue="true" data-owner-focus-route="analytics risk abuse">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Risk and abuse</span><h2 class="odv4-section-title">Owner risk queue</h2><p class="odv4-section-copy">Review abuse signals, delivery anomalies, security anomalies, and request failures from one queue before sending work back into tenant operations.</p></div>',
        cards
          ? `<div class="odvc4-card-grid">${cards}</div>`
          : '<div class="odvc4-note-card"><strong>No open risk items</strong><p>No abuse, delivery, security, or request anomalies are waiting in the current owner snapshot.</p></div>',
        '</section>',
      ].join('');
    }

    return {
      buildOwnerRiskQueueItems,
      renderOwnerRiskQueue,
    };
  }

  return {
    createOwnerControlRiskV4,
  };
});
