(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantOrdersV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Server status', href: '#server-status' },
        { label: 'Restart control', href: '#restart-control' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Orders', href: '#orders', current: true },
        { label: 'Delivery', href: '#delivery' },
        { label: 'Players', href: '#players' },
      ],
    },
    {
      label: 'Runtime',
      items: [
        { label: 'Server config', href: '#server-config' },
        { label: 'Server Bot', href: '#server-bots' },
        { label: 'Delivery Agent', href: '#delivery-agents' },
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

  function formatMoney(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return 'No time available';
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

  function toneForStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['delivered', 'completed', 'success', 'verified'].includes(normalized)) return 'success';
    if (['failed', 'dead-letter', 'error', 'cancelled', 'canceled'].includes(normalized)) return 'danger';
    if (['pending', 'queued', 'processing', 'executing'].includes(normalized)) return 'warning';
    return 'muted';
  }

  function purchaseCodeOf(row) {
    return firstNonEmpty([row?.code, row?.purchaseCode]);
  }

  function normalizeOrderStatus(row) {
    return String(firstNonEmpty([row?.statusText, row?.status, 'unknown'])).trim().toLowerCase();
  }

  function hasDeadLetterForCode(state, code) {
    const rows = Array.isArray(state?.deadLetters) ? state.deadLetters : [];
    return rows.some((entry) => {
      const values = [
        entry?.purchaseCode,
        entry?.code,
        entry?.jobCode,
        entry?.purchase?.code,
        entry?.payload?.code,
      ].map((value) => String(value || '').trim());
      return values.includes(code);
    });
  }

  function canRetryOrder(row) {
    const status = normalizeOrderStatus(row);
    return ['failed', 'dead-letter', 'error'].includes(status) || Boolean(row?.hasDeadLetter);
  }

  function canCancelOrder(row) {
    const status = normalizeOrderStatus(row);
    return ['queued', 'pending', 'processing', 'executing'].includes(status);
  }

  function buildSelectedOrder(state) {
    const items = Array.isArray(state?.purchaseLookup?.items) ? state.purchaseLookup.items : [];
    const selectedCode = String(state?.selectedPurchaseCode || '').trim();
    const selected = items.find((item) => purchaseCodeOf(item) === selectedCode) || items[0] || null;
    if (!selected) return null;
    const code = purchaseCodeOf(selected);
    const detail = state?.deliveryCase && purchaseCodeOf(state.deliveryCase) === code ? state.deliveryCase : null;
    const hasDeadLetter = Boolean((detail && detail?.deadLetter) || hasDeadLetterForCode(state, code));
    return {
      code,
      itemName: firstNonEmpty([selected?.itemName, selected?.itemId, selected?.productName, 'Unknown item']),
      status: firstNonEmpty([selected?.statusText, selected?.status, 'unknown']),
      player: firstNonEmpty([selected?.userId, selected?.discordId, state?.purchaseLookup?.userId, '-']),
      amount: formatMoney(selected?.totalPrice || selected?.price || selected?.amount),
      createdAt: formatDateTime(selected?.createdAt || selected?.updatedAt),
      detail,
      hasDeadLetter,
      canRetry: hasDeadLetter || canRetryOrder(selected),
      canCancel: canCancelOrder(selected),
    };
  }

  function buildDeliveryCaseSummary(state, selectedOrder) {
    const detail = selectedOrder?.detail || state?.deliveryCase || null;
    if (!detail) {
      return {
        title: 'No delivery case selected yet',
        detail: 'Search for a player, choose an order, then inspect delivery evidence and run retry or cancel from this workspace.',
        facts: [],
        actions: [
          'Search for the affected player first',
          'Open the selected order to inspect delivery evidence',
          'Only retry failed delivery after reading the latest failure reason',
        ],
      };
    }

    const timelineCount = listCount(detail?.timeline);
    const auditCount = listCount(detail?.auditRows);
    const lastError = firstNonEmpty([
      detail?.deadLetter?.reason,
      detail?.queueJob?.lastError,
      detail?.latestCommandSummary,
      '-',
    ]);

    return {
      title: `Delivery case ${escapeHtml(detail.purchaseCode || selectedOrder?.code || '-')}`,
      detail: 'Use this section to verify what happened, confirm failure details, and decide whether retry or cancel is the safer action.',
      facts: [
        { label: 'Order status', value: firstNonEmpty([detail?.purchase?.status, selectedOrder?.status, '-']) },
        { label: 'Queue job', value: detail?.queueJob ? firstNonEmpty([detail?.queueJob?.status, 'queued']) : '-' },
        { label: 'Dead-letter', value: detail?.deadLetter ? firstNonEmpty([detail?.deadLetter?.reason, 'present']) : '-' },
        { label: 'Timeline', value: formatNumber(timelineCount, '0') },
        { label: 'Audit rows', value: formatNumber(auditCount, '0') },
        { label: 'Latest error', value: lastError },
      ],
      actions: detail?.deadLetter
        ? [
            'Read the dead-letter reason before retrying',
            'Confirm the linked player identity and Steam match',
            'Check runtime health before resubmitting delivery',
          ]
        : [
            'Review the latest timeline entry',
            'Confirm queue state before changing anything',
            'Use audit evidence if you need to answer the player',
          ],
    };
  }

  function createTenantOrdersV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantName = firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);
    const orders = Array.isArray(state?.purchaseLookup?.items) ? state.purchaseLookup.items : [];
    const knownStatuses = Array.isArray(state?.purchaseStatusCatalog?.knownStatuses)
      ? state.purchaseStatusCatalog.knownStatuses
      : [];
    const selectedOrder = buildSelectedOrder(state);
    const delivery = state?.overview?.analytics?.delivery || {};
    const deliveryCase = buildDeliveryCaseSummary(state, selectedOrder);

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
        title: 'Orders and delivery',
        subtitle: 'Search orders, inspect delivery evidence, retry failed delivery, and cancel valid pending work from one page.',
        statusChips: [
          { label: `${formatNumber(orders.length, '0')} orders in view`, tone: 'info' },
          { label: `${formatNumber(listCount(state?.queueItems), '0')} in queue`, tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(listCount(state?.deadLetters), '0')} failed`, tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'muted' },
          { label: `success ${formatNumber(delivery?.successRate, '0')}%`, tone: 'success' },
        ],
        primaryAction: { label: 'Search orders', href: '#order-search' },
      },
      summaryStrip: [
        { label: 'Orders in view', value: formatNumber(orders.length, '0'), detail: 'Current search result set', tone: 'info' },
        { label: 'Queue pressure', value: formatNumber(listCount(state?.queueItems), '0'), detail: 'Pending or processing delivery work', tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
        { label: 'Failed work', value: formatNumber(listCount(state?.deadLetters), '0'), detail: 'Dead-letter items needing operator attention', tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'muted' },
        { label: 'Latest success rate', value: `${formatNumber(delivery?.successRate, '0')}%`, detail: `${formatNumber(delivery?.purchaseCount30d, '0')} recent purchases`, tone: 'success' },
      ],
      filters: {
        userId: firstNonEmpty([state?.selectedUserId, state?.purchaseLookup?.userId], ''),
        status: firstNonEmpty([state?.selectedPurchaseStatus, state?.purchaseLookup?.status], ''),
        statuses: knownStatuses,
      },
      orders: orders.map((row) => {
        const code = purchaseCodeOf(row) || '-';
        const hasDeadLetter = hasDeadLetterForCode(state, code);
        return {
          code,
          itemName: firstNonEmpty([row?.itemName, row?.itemId, row?.productName, '-']),
          status: firstNonEmpty([row?.statusText, row?.status, 'unknown']),
          player: firstNonEmpty([row?.userId, row?.discordId, state?.purchaseLookup?.userId, '-']),
          amount: formatMoney(row?.totalPrice || row?.price || row?.amount),
          createdAt: formatDateTime(row?.createdAt || row?.updatedAt),
          hasDeadLetter,
          canRetry: hasDeadLetter || canRetryOrder(row),
          canCancel: canCancelOrder(row),
        };
      }),
      selectedOrder,
      deliveryCase,
      railCards: [
        {
          title: 'Use this like a case workspace',
          body: 'Search, select, inspect, then retry or cancel.',
          meta: 'The page is no longer just a table. The selected order becomes the working case.',
          tone: 'info',
        },
        {
          title: 'Escalate carefully',
          body: listCount(state?.deadLetters) > 0 ? 'Read failure evidence before retrying.' : 'Use queue status before canceling.',
          meta: listCount(state?.deadLetters) > 0
            ? 'Retry failed delivery only after checking dead-letter context.'
            : 'Cancel only when the order is still queued or processing.',
          tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'warning',
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

  function renderRailCard(item) {
    return [
      `<article class="tdv4-panel tdv4-rail-card tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-rail-title">${escapeHtml(item.title)}</div>`,
      `<strong class="tdv4-rail-body">${escapeHtml(item.body)}</strong>`,
      `<div class="tdv4-rail-detail">${escapeHtml(item.meta)}</div>`,
      '</article>',
    ].join('');
  }

  function renderOrderRow(row, selectedCode) {
    const current = row.code === selectedCode ? ' tdv4-data-row-current' : '';
    return [
      `<article class="tdv4-data-row${current}">`,
      `<div class="tdv4-data-main"><strong class="code">${escapeHtml(row.code)}</strong><div>${escapeHtml(row.itemName)}</div></div>`,
      `<div>${renderBadge(row.status, toneForStatus(row.status))}</div>`,
      `<div>${escapeHtml(row.player)}</div>`,
      `<div>${escapeHtml(row.amount)}</div>`,
      `<div class="code">${escapeHtml(row.createdAt)}</div>`,
      '<div class="tdv4-action-list">',
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-order-select data-code="${escapeHtml(row.code)}" data-user-id="${escapeHtml(row.player)}">Open case</button>`,
      '</div>',
      '</article>',
    ].join('');
  }

  function renderFact(item) {
    return [
      '<article class="tdv4-mini-stat">',
      `<div class="tdv4-mini-stat-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-mini-stat-value">${escapeHtml(item.value)}</div>`,
      '</article>',
    ].join('');
  }

  function buildSelectedOrderActions(selectedOrder) {
    if (!selectedOrder) {
      return '<div class="tdv4-empty-state">Choose an order first to unlock management actions.</div>';
    }
    return [
      '<div class="tdv4-action-list">',
      `<button class="tdv4-button tdv4-button-primary" type="button" data-order-action="inspect-order" data-code="${escapeHtml(selectedOrder.code)}" data-user-id="${escapeHtml(selectedOrder.player)}">Inspect order</button>`,
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-order-action="inspect-delivery" data-code="${escapeHtml(selectedOrder.code)}" data-user-id="${escapeHtml(selectedOrder.player)}">Inspect delivery result</button>`,
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-order-action="retry" data-code="${escapeHtml(selectedOrder.code)}" data-user-id="${escapeHtml(selectedOrder.player)}" data-order-has-dead-letter="${selectedOrder.hasDeadLetter ? 'true' : 'false'}"${selectedOrder.canRetry ? '' : ' disabled'}>Retry failed delivery</button>`,
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-order-action="cancel" data-code="${escapeHtml(selectedOrder.code)}" data-user-id="${escapeHtml(selectedOrder.player)}"${selectedOrder.canCancel ? '' : ' disabled'}>Cancel delivery</button>`,
      '</div>',
    ].join('');
  }

  function buildTenantOrdersV4Html(model) {
    const safeModel = model || createTenantOrdersV4Model({});
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
      renderBadge('Orders', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-orders-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">This page is the daily order and delivery workspace for operators. Search first, then work from the selected case.</div>',
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
      `<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label)}</a></div>`,
      '</section>',
      '<section class="tdv4-kpi-strip tdv4-orders-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-dual-grid tdv4-orders-filter-grid">',
      '<section class="tdv4-panel" id="order-search">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Search orders</h2>',
      '<p class="tdv4-section-copy">Search by player ID first, then narrow by status if needed.</p>',
      '<form class="tdv4-runtime-form" data-order-filter-form>',
      '<div class="tdv4-runtime-form-fields">',
      `<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Discord or player ID</div><div class="tdv4-basic-field-detail">Required for the current search API</div></div><input class="tdv4-basic-input" type="text" name="userId" value="${escapeHtml(safeModel.filters.userId)}" placeholder="1234567890"></label>`,
      `<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Status</div><div class="tdv4-basic-field-detail">Optional filter for the order list</div></div><select class="tdv4-basic-input" name="status"><option value="">All statuses</option>${(Array.isArray(safeModel.filters.statuses) ? safeModel.filters.statuses : []).map((status) => `<option value="${escapeHtml(status)}"${status === safeModel.filters.status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label>`,
      '</div>',
      '<div class="tdv4-action-list">',
      '<button class="tdv4-button tdv4-button-primary" type="submit">Search orders</button>',
      '</div>',
      '</form>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Selected order actions</h2>',
      '<p class="tdv4-section-copy">Inspect the selected case, retry failed delivery when supported, or cancel valid pending work.</p>',
      (safeModel.selectedOrder
        ? [
            '<div class="tdv4-selected-order">',
            `<strong class="code">${escapeHtml(safeModel.selectedOrder.code)}</strong>`,
            `<div>${escapeHtml(safeModel.selectedOrder.itemName)}</div>`,
            `<div>${renderBadge(safeModel.selectedOrder.status, toneForStatus(safeModel.selectedOrder.status))}</div>`,
            `<div class="tdv4-kpi-detail">Player ${escapeHtml(safeModel.selectedOrder.player)} · ${escapeHtml(safeModel.selectedOrder.amount)} · ${escapeHtml(safeModel.selectedOrder.createdAt)}</div>`,
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state">No order selected yet.</div>'),
      buildSelectedOrderActions(safeModel.selectedOrder),
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid tdv4-orders-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Status</div>',
      '<h2 class="tdv4-section-title">Order list</h2>',
      '<p class="tdv4-section-copy">Choose one order to turn it into the active case for inspection and operator actions.</p>',
      '<div class="tdv4-data-header"><span>Purchase</span><span>Status</span><span>Player</span><span>Amount</span><span>Created</span><span>Action</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.orders) && safeModel.orders.length
        ? safeModel.orders.map((row) => renderOrderRow(row, safeModel.selectedOrder?.code))
        : ['<div class="tdv4-empty-state">No orders found for the current search.</div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Delivery case</h2>',
      `<p class="tdv4-section-copy">${safeModel.deliveryCase.detail}</p>`,
      '<div class="tdv4-mini-stat-grid">',
      ...(Array.isArray(safeModel.deliveryCase.facts) ? safeModel.deliveryCase.facts.map(renderFact) : []),
      '</div>',
      `<div class="tdv4-list tdv4-case-actions" data-order-case-panel>${(Array.isArray(safeModel.deliveryCase.actions) ? safeModel.deliveryCase.actions.map((action) => `<article class="tdv4-list-item tdv4-tone-muted"><div class="tdv4-list-main"><strong>${escapeHtml(action)}</strong></div></article>`).join('') : '')}</div>`,
      '</section>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">Keep order search, selected-case actions, and delivery evidence close together so support decisions stay fast.</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantOrdersV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantOrdersV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.orders)
      ? source
      : createTenantOrdersV4Model(source);
    rootElement.innerHTML = buildTenantOrdersV4Html(model);
    return model;
  }

  return {
    buildTenantOrdersV4Html,
    createTenantOrdersV4Model,
    renderTenantOrdersV4,
  };
});
