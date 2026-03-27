(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantPlayersV4 = factory();
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
        { label: 'คำสั่งซื้อ', href: '#orders' },
        { label: 'การส่งของ', href: '#delivery' },
        { label: 'ผู้เล่น', href: '#players', current: true },
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

  function playerStatusLabel(player) {
    if (player?.isActive === false) return 'inactive';
    return 'active';
  }

  function toneForStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['active', 'linked', 'verified'].includes(normalized)) return 'success';
    if (['warning', 'needs-support', 'missing-steam'].includes(normalized)) return 'warning';
    if (['inactive', 'failed', 'error'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function extractPlayerName(player) {
    return firstNonEmpty([
      player?.displayName,
      player?.username,
      player?.user,
      player?.discordName,
      player?.discordId,
      'ไม่ทราบชื่อผู้เล่น',
    ]);
  }

  function extractTenantName(state) {
    return firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);
  }

  function buildSelectedPlayer(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const selected = players[0] || null;
    if (!selected) return null;

    const userId = firstNonEmpty([selected?.discordId, selected?.userId, selected?.id]);
    const purchases = Array.isArray(state?.purchaseLookup?.items)
      ? state.purchaseLookup.items.filter((item) => String(item?.userId || item?.discordId || '').trim() === userId)
      : [];
    const lastPurchase = purchases[0] || null;

    return {
      name: extractPlayerName(selected),
      discordId: firstNonEmpty([selected?.discordId, selected?.userId, '-']),
      steamId: firstNonEmpty([selected?.steamId, '-']),
      inGameName: firstNonEmpty([selected?.inGameName, selected?.steamName, '-']),
      status: playerStatusLabel(selected),
      updatedAt: formatDateTime(selected?.updatedAt || selected?.createdAt),
      linked: Boolean(selected?.steamId || selected?.steam?.id),
      lastPurchase,
      recentDeliveryIssue: state?.deliveryCase && String(state.deliveryCase?.purchase?.userId || '').trim() === userId
        ? firstNonEmpty([state.deliveryCase?.deadLetter?.reason, state.deliveryCase?.latestCommandSummary, 'มีเคสส่งของที่เกี่ยวข้อง'])
        : '',
    };
  }

  function createTenantPlayersV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantName = extractTenantName(state);
    const players = Array.isArray(state?.players) ? state.players : [];
    const linkedCount = players.filter((item) => item?.steamId || item?.steam?.id).length;
    const activeCount = players.filter((item) => item?.isActive !== false).length;
    const needsSupportCount = players.filter((item) => !item?.steamId || state?.deliveryCase && String(state.deliveryCase?.purchase?.userId || '').trim() === String(item?.discordId || item?.userId || '').trim()).length;
    const selected = buildSelectedPlayer(state);

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
        title: 'ผู้เล่น',
        subtitle: 'ค้นหาผู้เล่น ดูการเชื่อมบัญชี และเปิดงานซัพพอร์ตที่เกี่ยวข้องจากหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(players.length, '0')} ผู้เล่นในระบบ`, tone: 'info' },
          { label: `${formatNumber(linkedCount, '0')} คนผูก Steam แล้ว`, tone: 'success' },
          { label: `${formatNumber(needsSupportCount, '0')} คนอาจต้องช่วยเหลือ`, tone: needsSupportCount > 0 ? 'warning' : 'muted' },
        ],
        primaryAction: { label: 'ค้นหาผู้เล่น', href: '#player-search' },
      },
      summaryStrip: [
        { label: 'ผู้เล่นที่รู้จัก', value: formatNumber(players.length, '0'), detail: 'รายชื่อที่ระบบ tenant นี้รู้จัก', tone: 'info' },
        { label: 'ผูก Steam แล้ว', value: formatNumber(linkedCount, '0'), detail: 'ใช้ยืนยันตัวตนก่อนดูคำสั่งซื้อหรือ delivery', tone: 'success' },
        { label: 'ยัง active', value: formatNumber(activeCount, '0'), detail: 'สถานะ player ที่ระบบมองว่ายังใช้งานอยู่', tone: 'success' },
        { label: 'อาจต้องช่วยเหลือ', value: formatNumber(needsSupportCount, '0'), detail: 'ยังไม่ผูกบัญชีหรือมีสัญญาณปัญหาค้างอยู่', tone: needsSupportCount > 0 ? 'warning' : 'muted' },
      ],
      players: players.map((row) => ({
        name: extractPlayerName(row),
        discordId: firstNonEmpty([row?.discordId, row?.userId, '-']),
        steam: firstNonEmpty([row?.steamId, row?.inGameName, '-']),
        status: playerStatusLabel(row),
        updatedAt: formatDateTime(row?.updatedAt || row?.createdAt),
      })),
      selected,
      railCards: [
        {
          title: 'ทางลัดซัพพอร์ต',
          body: 'Wallet · Steam · Orders · Delivery',
          meta: 'ใช้พาผู้ดูแลไปหน้าที่เกี่ยวข้องทันที เมื่อเจอปัญหาผู้เล่นด้าน identity, เงิน, คำสั่งซื้อ หรือการส่งของ',
          tone: 'info',
        },
        {
          title: 'สิ่งที่ควรดูต่อ',
          body: selected
            ? `${selected.name} · ${selected.linked ? 'ผูกบัญชีแล้ว' : 'ยังไม่ผูก Steam'}`
            : 'เลือกผู้เล่นจากตารางก่อน',
          meta: selected?.recentDeliveryIssue
            ? `มีสัญญาณที่เกี่ยวข้องกับ delivery: ${selected.recentDeliveryIssue}`
            : 'ถัดไปให้เปิดดู order history หรือ wallet support ของผู้เล่นที่เลือก',
          tone: selected?.recentDeliveryIssue ? 'warning' : 'muted',
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

  function renderPlayerRow(row, selectedId) {
    const current = row.discordId === selectedId ? ' tdv4-data-row-current' : '';
    return [
      `<article class="tdv4-data-row${current}">`,
      `<div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong></div>`,
      `<div class="code">${escapeHtml(row.discordId)}</div>`,
      `<div>${escapeHtml(row.steam)}</div>`,
      `<div>${renderBadge(row.status, toneForStatus(row.status))}</div>`,
      `<div class="code">${escapeHtml(row.updatedAt)}</div>`,
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

  function buildTenantPlayersV4Html(model) {
    const safeModel = model || createTenantPlayersV4Model({});
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
      renderBadge('Players', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-players-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">ศูนย์กลางงานดูแลผู้เล่น ใช้ค้นหาตัวตน เช็กการเชื่อมบัญชี และพาไปงานซัพพอร์ตที่เกี่ยวข้องเร็วที่สุด</div>',
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
      '<section class="tdv4-kpi-strip tdv4-players-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-dual-grid tdv4-players-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">รายชื่อผู้เล่น</div>',
      '<h2 class="tdv4-section-title">ตารางผู้เล่น</h2>',
      '<div class="tdv4-data-header"><span>Player</span><span>Discord</span><span>Steam / In-game</span><span>Status</span><span>Updated</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.players) && safeModel.players.length
        ? safeModel.players.map((row) => renderPlayerRow(row, safeModel.selected?.discordId))
        : ['<div class="tdv4-empty-state">ยังไม่พบผู้เล่นใน tenant นี้</div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ผู้เล่นที่เลือก</div>',
      '<h2 class="tdv4-section-title">สรุปตัวตนและบริบท</h2>',
      (safeModel.selected
        ? [
            '<div class="tdv4-selected-player">',
            `<strong>${escapeHtml(safeModel.selected.name)}</strong>`,
            `<div>${renderBadge(safeModel.selected.status, toneForStatus(safeModel.selected.status))}</div>`,
            `<div class="tdv4-kpi-detail">Discord ${escapeHtml(safeModel.selected.discordId)} · Steam ${escapeHtml(safeModel.selected.steamId)} · In-game ${escapeHtml(safeModel.selected.inGameName)}</div>`,
            `<div class="tdv4-kpi-detail">อัปเดตล่าสุด ${escapeHtml(safeModel.selected.updatedAt)}</div>`,
            `<div class="tdv4-chip-row">${renderBadge(safeModel.selected.linked ? 'ผูกบัญชีแล้ว' : 'ยังไม่ผูก Steam', safeModel.selected.linked ? 'success' : 'warning')}${safeModel.selected.recentDeliveryIssue ? renderBadge('มีประเด็น delivery', 'warning') : ''}</div>`,
            safeModel.selected.lastPurchase ? `<div class="tdv4-kpi-detail">คำสั่งซื้อล่าสุด ${escapeHtml(firstNonEmpty([safeModel.selected.lastPurchase.code, safeModel.selected.lastPurchase.purchaseCode, '-']))} · ${escapeHtml(firstNonEmpty([safeModel.selected.lastPurchase.status, '-']))}</div>` : '<div class="tdv4-kpi-detail">ยังไม่พบคำสั่งซื้อที่โยงกับผู้เล่นคนนี้ในมุมมองปัจจุบัน</div>',
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state">เลือกผู้เล่นจากตารางก่อน</div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">บริบทและงานซัพพอร์ต</div>',
      '<h2 class="tdv4-section-title">ใช้หน้านี้เป็นจุดเริ่มก่อนเปิดงานต่อ</h2>',
      '<div class="tdv4-support-grid">',
      '<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">บัญชี Discord</div><div class="tdv4-mini-stat-value">' + escapeHtml(safeModel.selected ? safeModel.selected.discordId : '-') + '</div></article>',
      '<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">บัญชี Steam</div><div class="tdv4-mini-stat-value">' + escapeHtml(safeModel.selected ? safeModel.selected.steamId : '-') + '</div></article>',
      '<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">ประเด็นล่าสุด</div><div class="tdv4-mini-stat-value">' + escapeHtml(safeModel.selected?.recentDeliveryIssue || 'ยังไม่พบประเด็นที่ค้างอยู่') + '</div></article>',
      '<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">ทางต่อที่แนะนำ</div><div class="tdv4-mini-stat-value">' + escapeHtml(safeModel.selected?.lastPurchase ? 'เปิด order history หรือ delivery case' : 'เริ่มที่ Steam support หรือค้นหา order') + '</div></article>',
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">ทางลัดช่วยตัดสินใจว่าเคสนี้ควรเปิดต่อที่ wallet, Steam, orders หรือ delivery</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantPlayersV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantPlayersV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.players)
      ? source
      : createTenantPlayersV4Model(source);
    rootElement.innerHTML = buildTenantPlayersV4Html(model);
    return model;
  }

  return {
    buildTenantPlayersV4Html,
    createTenantPlayersV4Model,
    renderTenantPlayersV4,
  };
});
