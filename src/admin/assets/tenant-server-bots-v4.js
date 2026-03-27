(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantServerBotsV4 = factory();
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
      label: 'ระบบและรันไทม์',
      items: [
        { label: 'Delivery Agents', href: '#delivery-agents' },
        { label: 'Server Bots', href: '#server-bots', current: true },
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
        { label: 'บันทึกและหลักฐาน', href: '#audit' },
      ],
    },
  ];

  const SYNC_SIGNALS = ['sync', 'watcher', 'watch', 'log', 'config', 'restart', 'read', 'monitor'];

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
    if (!value) return 'ยังไม่เห็นการ sync';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ยังไม่เห็นการ sync';
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

  function normalizeCapabilities(value) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[,\n]+/g)
        : [];
    return raw
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function signalText(row) {
    const meta = row && row.meta && typeof row.meta === 'object' ? row.meta : {};
    return [
      row?.runtimeKey,
      row?.channel,
      row?.name,
      row?.status,
      row?.role,
      row?.scope,
      meta.agentRole,
      meta.agentScope,
      meta.role,
      meta.scope,
      meta.kind,
      meta.mode,
      meta.type,
      meta.agentLabel,
      ...(normalizeCapabilities(meta.capabilities || meta.features)),
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
  }

  function isServerBot(row) {
    const meta = row && row.meta && typeof row.meta === 'object' ? row.meta : {};
    const explicitRole = String(meta.agentRole || meta.role || row?.role || '').trim().toLowerCase();
    const explicitScope = String(meta.agentScope || meta.scope || row?.scope || '').trim().toLowerCase();
    if (['sync', 'hybrid'].includes(explicitRole)) return true;
    if (['sync_only', 'sync-only', 'synconly', 'sync_execute', 'sync-execute'].includes(explicitScope)) return true;
    const text = signalText(row);
    return SYNC_SIGNALS.some((token) => text.includes(token));
  }

  function statusTone(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['online', 'ready', 'healthy', 'active'].includes(normalized)) return 'success';
    if (['pending_activation', 'pending-activation', 'draft', 'provisioned', 'degraded', 'stale'].includes(normalized)) return 'warning';
    if (['offline', 'revoked', 'outdated', 'error', 'failed'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function serverLabel(row) {
    const meta = row && row.meta && typeof row.meta === 'object' ? row.meta : {};
    return firstNonEmpty([meta.serverId, row?.serverId, row?.tenantServerId, 'ยังไม่ผูกเซิร์ฟเวอร์']);
  }

  function freshnessLabel(row) {
    if (!row?.lastSeenAt) return 'ยังไม่เคย sync';
    const diffMs = Date.now() - new Date(row.lastSeenAt).getTime();
    if (!Number.isFinite(diffMs)) return 'ยังไม่เคย sync';
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 5) return 'สด';
    if (diffMinutes < 30) return `${diffMinutes} นาทีที่แล้ว`;
    return 'เริ่ม stale';
  }

  function configCapability(row) {
    const text = signalText(row);
    return text.includes('config') || text.includes('ini') || text.includes('apply')
      ? 'พร้อมแก้ config'
      : 'ยังไม่ชัดเจน';
  }

  function restartCapability(row) {
    const text = signalText(row);
    return text.includes('restart') || text.includes('service') || text.includes('script')
      ? 'พร้อม restart'
      : 'ยังไม่ชัดเจน';
  }

  function createTenantServerBotsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantName = firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);
    const rows = Array.isArray(state?.agents) ? state.agents.filter(isServerBot) : [];
    const online = rows.filter((row) => statusTone(row.status) === 'success').length;
    const stale = rows.filter((row) => freshnessLabel(row) === 'เริ่ม stale').length;
    const selected = rows[0] || null;
    const supervisorItems = Array.isArray(state?.runtimeSupervisor?.items) ? state.runtimeSupervisor.items : [];
    const missingBot = Math.max(0, Number(state?.overview?.serverCount || 0) - rows.length);

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
        title: 'Server Bots',
        subtitle: 'ดูตัวดูแลเซิร์ฟเวอร์สำหรับ log sync, config, และ restart โดยแยกจาก Delivery Agent ชัดเจน',
        statusChips: [
          { label: `${formatNumber(online, '0')} ตัวออนไลน์`, tone: online > 0 ? 'success' : 'muted' },
          { label: `${formatNumber(stale, '0')} ตัวเริ่ม stale`, tone: stale > 0 ? 'warning' : 'muted' },
          { label: `${formatNumber(missingBot, '0')} เซิร์ฟเวอร์ที่ยังไม่มี bot`, tone: missingBot > 0 ? 'warning' : 'muted' },
          { label: `${formatNumber(listCount(supervisorItems), '0')} runtime ใน supervisor`, tone: 'info' },
        ],
        primaryAction: { label: 'สร้าง Server Bot', href: '#server-bots-new' },
      },
      summaryStrip: [
        { label: 'ออนไลน์', value: formatNumber(online, '0'), detail: 'พร้อมอ่าน log และตอบงานจาก control plane', tone: online > 0 ? 'success' : 'muted' },
        { label: 'เซิร์ฟเวอร์ที่ยังไม่มี Bot', value: formatNumber(missingBot, '0'), detail: 'เซิร์ฟเวอร์ที่อาจยังไม่มี runtime ประจำ', tone: missingBot > 0 ? 'warning' : 'muted' },
        { label: 'งานรอจัดการ', value: formatNumber(listCount(state?.queueItems), '0'), detail: 'ใช้ดูผลกระทบก่อนแก้ config หรือ restart', tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
        { label: 'งานที่ล้มเหลว', value: formatNumber(listCount(state?.deadLetters), '0'), detail: 'ภาระที่ควรเคลียร์ก่อน maintenance', tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'muted' },
      ],
      rows: rows.map((row) => ({
        name: firstNonEmpty([row?.meta?.agentLabel, row?.runtimeKey, row?.name, 'Server Bot']),
        server: serverLabel(row),
        status: firstNonEmpty([row?.status, 'unknown']),
        freshness: freshnessLabel(row),
        config: configCapability(row),
        restart: restartCapability(row),
        lastSeenAt: formatDateTime(row?.lastSeenAt),
        issue: firstNonEmpty([row?.reason, row?.meta?.warning, row?.meta?.lastError, 'พร้อมทำงานระดับเซิร์ฟเวอร์']),
      })),
      selected: selected
        ? {
            name: firstNonEmpty([selected?.meta?.agentLabel, selected?.runtimeKey, selected?.name, 'Server Bot']),
            server: serverLabel(selected),
            status: firstNonEmpty([selected?.status, 'unknown']),
            freshness: freshnessLabel(selected),
            config: configCapability(selected),
            restart: restartCapability(selected),
            lastSeenAt: formatDateTime(selected?.lastSeenAt),
          }
        : null,
      diagnostics: {
        queueCount: formatNumber(listCount(state?.queueItems), '0'),
        deadLetterCount: formatNumber(listCount(state?.deadLetters), '0'),
        reconcileAlerts: formatNumber(Number(state?.reconcile?.summary?.alerts || 0), '0'),
        syncSignals: formatNumber(listCount(state?.notifications), '0'),
      },
      railCards: [
        {
          title: 'Checklist พร้อมใช้งาน',
          body: 'online · sync สด · path พร้อม · restart method พร้อม',
          meta: 'ให้ใช้ rail นี้เป็น quick read ก่อนเข้าไปหน้าตั้งค่าเซิร์ฟเวอร์หรือ restart control',
          tone: 'info',
        },
        {
          title: 'สิ่งที่ควรทำต่อ',
          body: stale > 0 ? 'เปิดดู sync/logs ก่อน' : 'ถ้ายังไม่มีปัญหา ให้ตรวจ readiness ของ config และ restart ต่อ',
          meta: stale > 0
            ? 'runtime ที่เริ่ม stale มักกระทบทั้ง logs, config, และ restart workflow พร้อมกัน'
            : 'ถ้าผู้ดูแลจะเปลี่ยน config หรือ restart ให้หน้านี้เป็นจุดตรวจสุขภาพก่อนเริ่มงาน',
          tone: stale > 0 ? 'warning' : 'muted',
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

  function renderBotRow(row, selectedName) {
    const current = row.name === selectedName ? ' tdv4-data-row-current' : '';
    return [
      `<article class="tdv4-data-row${current}">`,
      `<div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong><div class="code">${escapeHtml(row.server)}</div></div>`,
      `<div>${renderBadge(row.status, statusTone(row.status))}</div>`,
      `<div>${escapeHtml(row.freshness)}</div>`,
      `<div>${escapeHtml(row.config)}</div>`,
      `<div>${escapeHtml(row.restart)}</div>`,
      `<div class="code">${escapeHtml(row.lastSeenAt)}</div>`,
      `<div>${escapeHtml(row.issue)}</div>`,
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

  function buildTenantServerBotsV4Html(model) {
    const safeModel = model || createTenantServerBotsV4Model({});
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
      renderBadge('Server Bots', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-runtime-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">ศูนย์งานของตัวดูแลเซิร์ฟเวอร์ ใช้ดู sync, config, และ restart posture ก่อนทำงานเปลี่ยนแปลงฝั่งเซิร์ฟเวอร์</div>',
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
      '<section class="tdv4-kpi-strip tdv4-runtime-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-dual-grid tdv4-runtime-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Server runtime</div>',
      '<h2 class="tdv4-section-title">ตาราง Server Bots</h2>',
      '<div class="tdv4-data-header"><span>Runtime</span><span>Status</span><span>Sync freshness</span><span>Config</span><span>Restart</span><span>Last seen</span><span>Issue</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.rows) && safeModel.rows.length
        ? safeModel.rows.map((row) => renderBotRow(row, safeModel.selected?.name))
        : ['<div class="tdv4-empty-state"><strong>ยังไม่มี Server Bot</strong><span>สร้างตัวดูแลเซิร์ฟเวอร์ก่อน เพื่อให้ระบบอ่าน log จัดการ config และสั่ง restart ได้จริง</span><a class="tdv4-button tdv4-button-primary" href="#server-bots-new">สร้าง Server Bot</a></div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ตัวที่เลือก</div>',
      '<h2 class="tdv4-section-title">สรุป sync และความพร้อมระดับเซิร์ฟเวอร์</h2>',
      (safeModel.selected
        ? [
            '<div class="tdv4-selected-runtime">',
            `<strong>${escapeHtml(safeModel.selected.name)}</strong>`,
            `<div>${renderBadge(safeModel.selected.status, statusTone(safeModel.selected.status))}</div>`,
            `<div class="tdv4-kpi-detail">Server ${escapeHtml(safeModel.selected.server)} · freshness ${escapeHtml(safeModel.selected.freshness)}</div>`,
            `<div class="tdv4-kpi-detail">Config ${escapeHtml(safeModel.selected.config)} · Restart ${escapeHtml(safeModel.selected.restart)}</div>`,
            `<div class="tdv4-kpi-detail">Last seen ${escapeHtml(safeModel.selected.lastSeenAt)}</div>`,
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state"><strong>ยังไม่ได้เลือก Server Bot</strong><span>เลือกตัวดูแลเซิร์ฟเวอร์จากตารางก่อน เพื่อดูความสดของ sync และความพร้อมในการแก้ config หรือ restart</span></div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Diagnostics</div>',
      '<h2 class="tdv4-section-title">ภาระงานและสัญญาณที่ควรดูต่อ</h2>',
      '<div class="tdv4-runtime-readiness-grid">',
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">งานรอจัดการ</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.diagnostics.queueCount)}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">งานที่ล้มเหลว</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.diagnostics.deadLetterCount)}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">สัญญาณจาก sync check</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.diagnostics.reconcileAlerts)}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">การแจ้งเตือนล่าสุด</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.diagnostics.syncSignals)}</div></article>`,
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">ใช้ rail นี้เป็น quick diagnostics ก่อนขยับไป Logs & Sync, Server Config, หรือ Restart Control</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantServerBotsV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantServerBotsV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.rows)
      ? source
      : createTenantServerBotsV4Model(source);
    rootElement.innerHTML = buildTenantServerBotsV4Html(model);
    return model;
  }

  return {
    buildTenantServerBotsV4Html,
    createTenantServerBotsV4Model,
    renderTenantServerBotsV4,
  };
});
