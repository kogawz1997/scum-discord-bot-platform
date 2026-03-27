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
      label: 'ภาพรวมงานหลัก',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
        { label: 'สถานะเซิร์ฟเวอร์', href: '#server-status' },
        { label: 'ควบคุมการรีสตาร์ต', href: '#restart-control' },
      ],
    },
    {
      label: 'คำสั่งซื้อและผู้เล่น',
      items: [
        { label: 'คำสั่งซื้อ', href: '#orders', current: true },
        { label: 'การส่งของ', href: '#delivery' },
        { label: 'ผู้เล่น', href: '#players' },
      ],
    },
    {
      label: 'ระบบและหลักฐาน',
      items: [
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
        { label: 'Server Bot', href: '#server-bots' },
        { label: 'Delivery Agent', href: '#delivery-agents' },
        { label: 'บันทึกและหลักฐาน', href: '#audit' },
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
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numeric);
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return 'ไม่ทราบเวลา';
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
    if (['failed', 'dead-letter', 'error'].includes(normalized)) return 'danger';
    if (['pending', 'queued', 'processing', 'executing'].includes(normalized)) return 'warning';
    return 'muted';
  }

  function purchaseCodeOf(row) {
    return firstNonEmpty([row?.code, row?.purchaseCode]);
  }

  function buildSelectedOrder(state) {
    const items = Array.isArray(state?.purchaseLookup?.items) ? state.purchaseLookup.items : [];
    const selected = items[0] || null;
    if (!selected) return null;
    const code = purchaseCodeOf(selected);
    const detail = state?.deliveryCase && purchaseCodeOf(state.deliveryCase) === code ? state.deliveryCase : null;
    return {
      code,
      itemName: firstNonEmpty([selected?.itemName, selected?.itemId, selected?.productName, 'ไม่ทราบรายการ']),
      status: firstNonEmpty([selected?.statusText, selected?.status, 'unknown']),
      player: firstNonEmpty([selected?.userId, selected?.discordId, state?.purchaseLookup?.userId, '-']),
      amount: formatMoney(selected?.totalPrice || selected?.price || selected?.amount),
      createdAt: formatDateTime(selected?.createdAt || selected?.updatedAt),
      detail,
    };
  }

  function buildDeliveryCaseSummary(state, selectedOrder) {
    const detail = selectedOrder?.detail || state?.deliveryCase || null;
    if (!detail) {
      return {
        title: 'ยังไม่ได้เปิดเคสการส่งของ',
        detail: 'เลือกคำสั่งซื้อจากรายการด้านซ้ายก่อน เพื่อดู timeline, หลักฐาน, และคำแนะนำการแก้ปัญหา',
        facts: [],
        actions: [
          'ค้นหาคำสั่งซื้อที่มีปัญหา',
          'เปิดดู dead-letter หากผู้เล่นแจ้งว่ายังไม่ได้รับของ',
          'ตรวจสถานะคิวส่งของก่อน replay',
        ],
      };
    }

    const timelineCount = listCount(detail?.timeline);
    const auditCount = listCount(detail?.auditRows);
    const lastError = firstNonEmpty([detail?.deadLetter?.reason, detail?.queueJob?.lastError, detail?.latestCommandSummary, '-']);

    return {
      title: `เคส ${escapeHtml(detail.purchaseCode || selectedOrder?.code || '-')}`,
      detail: 'รวมบริบทของคำสั่งซื้อ การส่งของ และหลักฐานที่เกี่ยวข้องไว้ในจุดเดียวเพื่อใช้ตอบผู้เล่นหรือแก้ปัญหาต่อ',
      facts: [
        { label: 'สถานะคำสั่งซื้อ', value: firstNonEmpty([detail?.purchase?.status, selectedOrder?.status, '-']) },
        { label: 'queue job', value: detail?.queueJob ? firstNonEmpty([detail?.queueJob?.status, 'queued']) : '-' },
        { label: 'dead-letter', value: detail?.deadLetter ? firstNonEmpty([detail?.deadLetter?.reason, detail?.deadLetter?.errorCode, 'present']) : '-' },
        { label: 'timeline', value: formatNumber(timelineCount, '0') },
        { label: 'audit', value: formatNumber(auditCount, '0') },
        { label: 'error ล่าสุด', value: lastError },
      ],
      actions: detail?.deadLetter
        ? ['อ่านสาเหตุ dead-letter ก่อน replay', 'ยืนยันตัวผู้เล่นและ Steam link', 'ตรวจ runtime ก่อนสั่ง retry']
        : ['ตรวจ timeline ล่าสุด', 'ยืนยันสถานะใน queue/dead-letter', 'ดู audit ก่อนแก้สถานะด้วยมือ'],
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
      surfaceLabel: 'แผงผู้เช่า',
        workspaceLabel: tenantName,
      environmentLabel: 'พื้นที่ผู้เช่า',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : NAV_GROUPS,
      },
      header: {
        title: 'คำสั่งซื้อและการส่งของ',
        subtitle: 'ค้นหาคำสั่งซื้อ ดูสถานะการส่งของ และเปิดเคสแก้ปัญหาให้ผู้เล่นจากหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(orders.length, '0')} คำสั่งซื้อในมุมมองนี้`, tone: 'info' },
          { label: `${formatNumber(listCount(state?.queueItems), '0')} รายการอยู่ในคิว`, tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(listCount(state?.deadLetters), '0')} รายการใน dead-letter`, tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'muted' },
          { label: `สำเร็จ ${formatNumber(delivery?.successRate, '0')}%`, tone: 'success' },
        ],
        primaryAction: { label: 'ค้นหาคำสั่งซื้อ', href: '#order-search' },
      },
      summaryStrip: [
        { label: 'คำสั่งซื้อที่มองเห็น', value: formatNumber(orders.length, '0'), detail: 'ผลลัพธ์จากตัวกรองปัจจุบัน', tone: 'info' },
        { label: 'คิวส่งของ', value: formatNumber(listCount(state?.queueItems), '0'), detail: 'รายการที่รอหรือกำลังประมวลผล', tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
        { label: 'dead-letter', value: formatNumber(listCount(state?.deadLetters), '0'), detail: 'รายการที่ล้มเหลวและต้องตรวจต่อ', tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'muted' },
        { label: 'อัตราสำเร็จล่าสุด', value: `${formatNumber(delivery?.successRate, '0')}%`, detail: `${formatNumber(delivery?.purchaseCount30d, '0')} คำสั่งซื้อช่วงล่าสุด`, tone: 'success' },
      ],
      filters: {
        userId: firstNonEmpty([state?.purchaseLookup?.userId], ''),
        status: firstNonEmpty([state?.purchaseLookup?.status], ''),
        statuses: knownStatuses,
      },
      orders: orders.map((row) => ({
        code: purchaseCodeOf(row) || '-',
        itemName: firstNonEmpty([row?.itemName, row?.itemId, row?.productName, '-']),
        status: firstNonEmpty([row?.statusText, row?.status, 'unknown']),
        player: firstNonEmpty([row?.userId, row?.discordId, state?.purchaseLookup?.userId, '-']),
        amount: formatMoney(row?.totalPrice || row?.price || row?.amount),
        createdAt: formatDateTime(row?.createdAt || row?.updatedAt),
      })),
      selectedOrder,
      deliveryCase,
      railCards: [
        {
          title: 'ทางลัดซัพพอร์ต',
          body: 'Wallet · Steam · Delivery Lab',
          meta: 'ใช้เมื่อต้องเช็กปัญหาเรื่องกระเป๋าเงิน, การเชื่อม Steam หรือการส่งของที่ยังไม่สมบูรณ์',
          tone: 'info',
        },
        {
          title: 'คำอธิบายสถานะ',
          body: knownStatuses.length > 0 ? knownStatuses.join(' · ') : 'queued · processing · delivered · failed',
          meta: 'ใช้เป็น legend เร็ว ๆ ก่อนตัดสินใจเปิดเคสหรือเปลี่ยนมุมมอง',
          tone: 'muted',
        },
        {
          title: 'สิ่งที่ควรทำต่อ',
          body: listCount(state?.deadLetters) > 0 ? 'เริ่มจาก dead-letter ก่อน' : 'ดูคำสั่งซื้อที่ยังค้างในคิว',
          meta: listCount(state?.deadLetters) > 0
            ? 'ถ้ามีผู้เล่นแจ้งว่ายังไม่ได้รับของ ให้เปิดเคสจากรายการที่ล้มเหลวก่อน'
            : 'ถ้ายังไม่มีรายการล้มเหลว ให้ไล่จากคำสั่งซื้อที่ค้างใน queue หรือ processing',
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
      ...(Array.isArray(group.items) ? group.items.map((item) => {
        const currentClass = item.current ? ' tdv4-nav-link-current' : '';
        return `<a class="tdv4-nav-link${currentClass}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`;
      }) : []),
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
      `<div><a class="tdv4-inline-link" href="#case-${escapeHtml(row.code)}">เปิดเคส</a></div>`,
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
      '<div class="tdv4-sidebar-copy">พื้นที่ทำงานของทีมซัพพอร์ตสำหรับตามคำสั่งซื้อ แก้ปัญหาการส่งของ และพาไปเครื่องมือที่เกี่ยวข้องเร็วที่สุด</div>',
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
      '<div class="tdv4-pagehead-actions">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label)}</a>`,
      '</div>',
      '</section>',
      '<section class="tdv4-kpi-strip tdv4-orders-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-dual-grid tdv4-orders-filter-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ค้นหาและกรอง</div>',
      '<h2 class="tdv4-section-title">เริ่มจากคำสั่งซื้อที่กำลังตามอยู่</h2>',
      '<p class="tdv4-section-copy">ใช้ user id และสถานะ เพื่อค่อยลดรายการให้เหลือเฉพาะเคสที่ต้องเปิดดูต่อ</p>',
      '<div class="tdv4-filter-grid">',
      `<label class="tdv4-form-field"><span>Discord หรือ player id</span><input class="tdv4-input" value="${escapeHtml(safeModel.filters.userId)}" readonly></label>`,
      `<label class="tdv4-form-field"><span>สถานะ</span><input class="tdv4-input" value="${escapeHtml(safeModel.filters.status || 'ทั้งหมด')}" readonly></label>`,
      '</div>',
      '<div class="tdv4-chip-row">',
      ...(Array.isArray(safeModel.filters.statuses) ? safeModel.filters.statuses.map((status) => renderBadge(status, toneForStatus(status))) : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">คำอธิบายการใช้งาน</div>',
      '<h2 class="tdv4-section-title">วิธีไล่งานแบบไม่งง</h2>',
      '<p class="tdv4-section-copy">ดูจากตารางก่อน แล้วอ่าน selected order summary ด้านขวา ถ้ายังไม่จบให้ลงมาที่ delivery case ด้านล่าง</p>',
      '<div class="tdv4-list tdv4-compact-list">',
      '<article class="tdv4-list-item tdv4-tone-muted"><div class="tdv4-list-main"><strong>queued / processing</strong><p>มักต้องเริ่มจาก queue และ runtime ก่อน</p></div></article>',
      '<article class="tdv4-list-item tdv4-tone-danger"><div class="tdv4-list-main"><strong>failed / dead-letter</strong><p>ควรเปิดเคสและอ่านหลักฐานก่อน replay เสมอ</p></div></article>',
      '<article class="tdv4-list-item tdv4-tone-success"><div class="tdv4-list-main"><strong>delivered / verified</strong><p>ใช้ยืนยันกับผู้เล่นและข้ามไป audit หากต้องการหลักฐานต่อ</p></div></article>',
      '</div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid tdv4-orders-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">รายการคำสั่งซื้อ</div>',
      '<h2 class="tdv4-section-title">ตารางคำสั่งซื้อ</h2>',
      '<div class="tdv4-data-header"><span>Purchase</span><span>Status</span><span>Player</span><span>Amount</span><span>Created</span><span>Action</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.orders) && safeModel.orders.length
        ? safeModel.orders.map((row) => renderOrderRow(row, safeModel.selectedOrder?.code))
        : ['<div class="tdv4-empty-state">ยังไม่มีคำสั่งซื้อในมุมมองนี้</div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">คำสั่งซื้อที่เลือก</div>',
      '<h2 class="tdv4-section-title">สรุปคำสั่งซื้อ</h2>',
      (safeModel.selectedOrder
        ? [
            '<div class="tdv4-selected-order">',
            `<strong class="code">${escapeHtml(safeModel.selectedOrder.code)}</strong>`,
            `<div>${escapeHtml(safeModel.selectedOrder.itemName)}</div>`,
            `<div>${renderBadge(safeModel.selectedOrder.status, toneForStatus(safeModel.selectedOrder.status))}</div>`,
            `<div class="tdv4-kpi-detail">ผู้เล่น ${escapeHtml(safeModel.selectedOrder.player)} · ${escapeHtml(safeModel.selectedOrder.amount)} · ${escapeHtml(safeModel.selectedOrder.createdAt)}</div>`,
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state">เลือกคำสั่งซื้อจากตารางก่อน</div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Delivery case workspace</div>',
      `<h2 class="tdv4-section-title">${safeModel.deliveryCase.title}</h2>`,
      `<p class="tdv4-section-copy">${safeModel.deliveryCase.detail}</p>`,
      '<div class="tdv4-mini-stat-grid">',
      ...(Array.isArray(safeModel.deliveryCase.facts) ? safeModel.deliveryCase.facts.map(renderFact) : []),
      '</div>',
      '<div class="tdv4-list tdv4-case-actions">',
      ...(Array.isArray(safeModel.deliveryCase.actions)
        ? safeModel.deliveryCase.actions.map((action) => `<article class="tdv4-list-item tdv4-tone-muted"><div class="tdv4-list-main"><strong>${escapeHtml(action)}</strong></div></article>`)
        : []),
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">ตัวช่วยตัดสินใจและทางลัดที่ใช้บ่อย เมื่อต้องตอบผู้เล่นหรือแก้ปัญหาการส่งของต่อ</div>',
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
