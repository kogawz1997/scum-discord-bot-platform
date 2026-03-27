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
      label: 'ภาพรวมงานหลัก',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
        { label: 'สถานะเซิร์ฟเวอร์', href: '#server-status' },
        { label: 'ควบคุมการรีสตาร์ต', href: '#restart-control', current: true },
      ],
    },
    {
      label: 'ระบบและรันไทม์',
      items: [
        { label: 'Delivery Agents', href: '#delivery-agents' },
        { label: 'Server Bots', href: '#server-bots' },
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
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

  function formatDateTime(value) {
    if (!value) return 'ยังไม่มีข้อมูล';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ยังไม่มีข้อมูล';
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

  function statusTone(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['ready', 'ok', 'healthy', 'online', 'active'].includes(normalized)) return 'success';
    if (['warning', 'queued', 'pending', 'maintenance', 'scheduled'].includes(normalized)) return 'warning';
    if (['offline', 'failed', 'degraded', 'error', 'blocked'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function buildAnnouncementPlan(delaySeconds) {
    const checkpoints = [300, 60, 30, 10].filter((seconds) => seconds <= delaySeconds);
    return checkpoints.map((seconds) => ({
      delaySeconds: seconds,
      message: `เซิร์ฟเวอร์จะรีสตาร์ตในอีก ${seconds} วินาที`,
    }));
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
    if (String(runtimeStatus).toLowerCase() !== 'ready') blockers.push('Delivery runtime ยังไม่พร้อมสำหรับ announce flow');
    if (listCount(state?.queueItems) > 0) blockers.push('ยังมี queue jobs ค้างอยู่');
    if (listCount(state?.deadLetters) > 0) blockers.push('มี dead-letter ค้างอยู่ ควรตรวจต่อก่อน restart');
    if (state?.serverBotReady === false) blockers.push('Server Bot ยังไม่พร้อมทำ restart');

    const history = Array.isArray(state?.restartHistory) ? state.restartHistory : [];
    const modeCards = [
      {
        title: 'Restart Now',
        detail: 'ใช้เมื่อระบบพร้อมและไม่ต้องสื่อสารล่วงหน้า',
        guard: 'ควรใช้เฉพาะตอน queue โล่งและทีมรับทราบแล้ว',
        tone: 'danger',
      },
      {
        title: 'Restart in 1 minute',
        detail: 'เหมาะกับ downtime สั้นและต้องประกาศเร็ว',
        guard: 'ให้แน่ใจว่า Delivery Agent ออนไลน์ถ้าต้องส่ง #Announce',
        tone: 'warning',
      },
      {
        title: 'Restart in 5 minutes',
        detail: 'เหมาะกับ maintenance ที่ต้องให้เวลาผู้เล่นออกจากเกม',
        guard: 'ใช้เมื่ออยากให้ประกาศครบ 5m / 1m / 30s / 10s',
        tone: 'success',
      },
      {
        title: 'Safe Restart',
        detail: 'ใช้เมื่อยังต้องเช็ก queue และ post-restart verification อย่างเป็นขั้นตอน',
        guard: 'โหมดนี้ควรเป็น default ของงานประจำวัน',
        tone: 'info',
      },
      {
        title: 'Schedule Restart',
        detail: 'กำหนดเวลาไว้ล่วงหน้าเพื่อรอช่วง maintenance ที่เหมาะสม',
        guard: 'เหมาะกับงานที่ต้องมีประวัติและคนเกี่ยวข้องหลายฝ่าย',
        tone: 'muted',
      },
    ];

    const recommendedMode = modeCards.find((item) => item.title === 'Safe Restart') || modeCards[0] || null;
    const secondaryModes = modeCards.filter((item) => item !== recommendedMode);

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
        title: 'Restart Control',
        subtitle: 'ศูนย์ควบคุมการรีสตาร์ตแบบมี guardrails แยกงาน maintenance ออกจากงานตรวจ queue และการประกาศให้ผู้เล่นชัดเจน',
        statusChips: [
          { label: `server ${firstNonEmpty([state?.serverStatus, 'ready'])}`, tone: statusTone(firstNonEmpty([state?.serverStatus, 'ready'])) },
          { label: `delivery ${runtimeStatus}`, tone: statusTone(runtimeStatus) },
          { label: `queue ${formatNumber(listCount(state?.queueItems), '0')}`, tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
          { label: `maintenance ${maintenanceState}`, tone: statusTone(maintenanceState) },
        ],
        primaryAction: { label: 'เปิด flow รีสตาร์ต', href: '#restart-open-flow' },
        primaryAction: recommendedMode
          ? { label: 'Safe Restart (แนะนำ)', href: '#restart-safe' }
          : { label: 'เปิด flow รีสตาร์ต', href: '#restart-open-flow' },
      },
      summaryStrip: [
        { label: 'Server readiness', value: firstNonEmpty([state?.serverStatus, 'ready']), detail: 'ความพร้อมระดับการควบคุมเซิร์ฟเวอร์', tone: statusTone(firstNonEmpty([state?.serverStatus, 'ready'])) },
        { label: 'Delivery / announce', value: runtimeStatus, detail: 'ใช้ชี้ว่าประกาศในเกมทำได้หรือไม่', tone: statusTone(runtimeStatus) },
        { label: 'Queue pressure', value: formatNumber(listCount(state?.queueItems), '0'), detail: 'ภาระงานที่ควรตรวจสอบก่อนกดรีสตาร์ต', tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
        { label: 'Last restart', value: history[0] ? formatDateTime(history[0].at) : 'ยังไม่มี', detail: history[0] ? firstNonEmpty([history[0].mode, history[0].result, '-']) : 'ยังไม่มีประวัติในมุมมองนี้', tone: history[0] ? 'info' : 'muted' },
      ],
      blockers,
      announcementPlan: buildAnnouncementPlan(300),
      recommendedMode,
      secondaryModes,
      modeCards,
      history: history.slice(0, 4).map((item) => ({
        at: formatDateTime(item?.at),
        mode: firstNonEmpty([item?.mode, 'unknown']),
        result: firstNonEmpty([item?.result, item?.status, 'unknown']),
        actor: firstNonEmpty([item?.actor, item?.requestedBy, '-']),
      })),
      railCards: [
        {
          title: 'Checklist ก่อน restart',
          body: 'ดู queue · ยืนยัน announce · ตรวจ Server Bot · วาง post-check',
          meta: 'ถ้ายังตอบ 4 ข้อนี้ไม่ได้ อย่าเพิ่งเริ่ม flow รีสตาร์ตจริง',
          tone: 'info',
        },
        {
          title: 'ประกาศล่วงหน้า 5 นาที',
          body: '5m · 1m · 30s · 10s',
          meta: 'ใช้เป็น preset กลางสำหรับ maintenance ปกติที่ต้องการให้ผู้เล่นเห็นข้อความครบ',
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

  function renderModeCard(item) {
    return [
      `<article class="tdv4-panel tdv4-mode-card tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-section-kicker">Restart mode</div>`,
      `<h3 class="tdv4-mode-title">${escapeHtml(item.title)}</h3>`,
      `<p class="tdv4-kpi-detail">${escapeHtml(item.detail)}</p>`,
      `<div class="tdv4-rail-detail">${escapeHtml(item.guard)}</div>`,
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
      renderBadge('Restart Control', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-restart-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">ห้องควบคุม maintenance ใช้ประเมินความพร้อมก่อนรีสตาร์ต สื่อสาร downtime และตามผลหลังงานเสร็จ</div>',
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
      '<section class="tdv4-kpi-strip tdv4-restart-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-panel tdv4-restart-primary">',
      '<div class="tdv4-section-kicker">Recommended action</div>',
      '<h2 class="tdv4-section-title">Safe Restart เป็นตัวเลือกที่แนะนำ</h2>',
      '<p class="tdv4-section-copy">เริ่มจากโหมดนี้ก่อนเมื่อไม่ได้มีเหตุฉุกเฉิน เพราะช่วยเช็กคิวงาน การประกาศ และขั้นตอนหลังรีสตาร์ตได้ครบกว่า</p>',
      '<div class="tdv4-restart-primary-grid">',
      (safeModel.recommendedMode ? renderModeCard(safeModel.recommendedMode) : ''),
      '<div class="tdv4-panel tdv4-restart-primary-actions tdv4-tone-info">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h3 class="tdv4-mode-title">เริ่ม Safe Restart ก่อน</h3>',
      '<p class="tdv4-kpi-detail">ถ้าสถานะระบบยังไม่ชัด ให้ดู blockers และ announcement checklist ใต้หน้านี้ก่อนกดรีสตาร์ตจริง</p>',
      '<div class="tdv4-action-list">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label || '')}</a>`,
      '<a class="tdv4-button tdv4-button-secondary" href="#server-status">ดูสถานะเซิร์ฟเวอร์</a>',
      '</div>',
      '</div>',
      '</div>',
      '</section>',
      '<details class="tdv4-panel tdv4-more-options">',
      '<summary class="tdv4-more-options-summary">More options</summary>',
      '<div class="tdv4-section-kicker">Restart modes</div>',
      '<h2 class="tdv4-section-title">เลือกโหมดรีสตาร์ตที่เหมาะกับสถานการณ์</h2>',
      '<div class="tdv4-mode-grid">',
      ...(Array.isArray(safeModel.secondaryModes) ? safeModel.secondaryModes.map(renderModeCard) : []),
      '</div>',
      '</details>',
      '<section class="tdv4-dual-grid tdv4-restart-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Announcement checklist</div>',
      '<h2 class="tdv4-section-title">ลำดับการประกาศและการตรวจพร้อมก่อนกดเริ่ม</h2>',
      '<div class="tdv4-list">',
      ...(Array.isArray(safeModel.announcementPlan)
        ? safeModel.announcementPlan.map((item) => `<div class="tdv4-list-item"><strong>${escapeHtml(item.delaySeconds)}s</strong><p>${escapeHtml(item.message)}</p></div>`)
        : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Blockers</div>',
      '<h2 class="tdv4-section-title">สิ่งที่ควรเคลียร์ก่อน restart</h2>',
      (Array.isArray(safeModel.blockers) && safeModel.blockers.length
        ? `<div class="tdv4-list">${safeModel.blockers.map((item) => `<div class="tdv4-list-item"><strong>คำเตือน</strong><p>${escapeHtml(item)}</p></div>`).join('')}</div>`
        : '<div class="tdv4-empty-state">ไม่พบ blocker สำคัญในมุมมองตัวอย่างนี้</div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Recent activity</div>',
      '<h2 class="tdv4-section-title">ประวัติ restart ล่าสุด</h2>',
      (Array.isArray(safeModel.history) && safeModel.history.length
        ? `<div class="tdv4-history-grid">${safeModel.history.map((item) => `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">${escapeHtml(item.mode)}</div><div class="tdv4-mini-stat-value">${escapeHtml(item.result)}</div><div class="tdv4-kpi-detail">${escapeHtml(item.at)} · ${escapeHtml(item.actor)}</div></article>`).join('')}</div>`
        : '<div class="tdv4-empty-state">ยังไม่มีประวัติ restart ในมุมมองนี้</div>'),
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">แยก checklist ของงาน maintenance ไว้ด้านขวา เพื่อให้หน้าหลักเหลือเฉพาะการตัดสินใจและสภาพระบบ</div>',
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
