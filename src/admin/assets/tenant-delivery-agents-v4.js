(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantDeliveryAgentsV4 = factory();
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
        { label: 'ผู้เล่น', href: '#players' },
      ],
    },
    {
      label: 'ระบบและรันไทม์',
      items: [
        { label: 'Delivery Agents', href: '#delivery-agents', current: true },
        { label: 'Server Bots', href: '#server-bots' },
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
        { label: 'บันทึกและหลักฐาน', href: '#audit' },
      ],
    },
  ];

  const EXECUTE_SIGNALS = ['execute', 'delivery', 'dispatch', 'command', 'console-agent', 'announce', 'write'];

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
    if (!value) return 'ยังไม่เห็น heartbeat';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ยังไม่เห็น heartbeat';
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

  function inferAgentKind(row) {
    const text = signalText(row);
    if (EXECUTE_SIGNALS.some((token) => text.includes(token))) return 'delivery-agent';
    return 'other';
  }

  function isDeliveryAgent(row) {
    const meta = row && row.meta && typeof row.meta === 'object' ? row.meta : {};
    const explicitRole = String(meta.agentRole || meta.role || row?.role || '').trim().toLowerCase();
    const explicitScope = String(meta.agentScope || meta.scope || row?.scope || '').trim().toLowerCase();
    if (['execute'].includes(explicitRole)) return true;
    if (['execute_only', 'execute-only', 'executeonly'].includes(explicitScope)) return true;
    return inferAgentKind(row) === 'delivery-agent';
  }

  function statusTone(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['online', 'ready', 'healthy', 'active'].includes(normalized)) return 'success';
    if (['pending_activation', 'pending-activation', 'draft', 'provisioned', 'degraded'].includes(normalized)) return 'warning';
    if (['offline', 'revoked', 'outdated', 'error', 'failed'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function serverLabel(row) {
    const meta = row && row.meta && typeof row.meta === 'object' ? row.meta : {};
    return firstNonEmpty([meta.serverId, row?.serverId, row?.tenantServerId, 'ยังไม่ผูกเซิร์ฟเวอร์']);
  }

  function versionLabel(row) {
    return firstNonEmpty([row?.version, row?.meta?.version, '-']);
  }

  function bindingLabel(row) {
    const meta = row && row.meta && typeof row.meta === 'object' ? row.meta : {};
    return firstNonEmpty([
      meta.machineFingerprint,
      meta.deviceFingerprint,
      meta.deviceId,
      meta.bindingState,
      'ยังไม่เห็นการผูกเครื่อง',
    ]);
  }

  function currentIssue(row) {
    const status = String(row?.status || '').trim().toLowerCase();
    if (status === 'pending_activation' || status === 'provisioned') return 'รอ activate บนเครื่องจริง';
    if (status === 'offline') return 'ตัวส่งของออฟไลน์';
    if (status === 'outdated') return 'เวอร์ชันต่ำกว่าขั้นต่ำ';
    if (status === 'revoked') return 'credential ถูกเพิกถอน';
    return firstNonEmpty([
      row?.reason,
      row?.meta?.warning,
      row?.meta?.lastError,
      'พร้อมรับงานส่งของ',
    ]);
  }

  function createTenantDeliveryAgentsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantName = firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);
    const rows = Array.isArray(state?.agents) ? state.agents.filter(isDeliveryAgent) : [];
    const online = rows.filter((row) => statusTone(row.status) === 'success').length;
    const offline = rows.filter((row) => String(row?.status || '').trim().toLowerCase() === 'offline').length;
    const pending = rows.filter((row) => ['pending_activation', 'pending-activation', 'provisioned', 'draft'].includes(String(row?.status || '').trim().toLowerCase())).length;
    const outdated = rows.filter((row) => String(row?.status || '').trim().toLowerCase() === 'outdated').length;
    const selected = rows[0] || null;

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
        title: 'Delivery Agents',
        subtitle: 'ดูตัวส่งของในเกม ออก setup ใหม่ ตรวจ binding และเช็กว่าพร้อมรับงานส่งของจริงหรือไม่จากหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(online, '0')} ตัวออนไลน์`, tone: online > 0 ? 'success' : 'muted' },
          { label: `${formatNumber(offline, '0')} ตัวออฟไลน์`, tone: offline > 0 ? 'danger' : 'muted' },
          { label: `${formatNumber(pending, '0')} ตัวรอ activate`, tone: pending > 0 ? 'warning' : 'muted' },
          { label: `${formatNumber(outdated, '0')} ตัวต้องอัปเดต`, tone: outdated > 0 ? 'warning' : 'muted' },
        ],
        primaryAction: { label: 'สร้าง Delivery Agent', href: '#delivery-agents-new' },
      },
      summaryStrip: [
        { label: 'ออนไลน์', value: formatNumber(online, '0'), detail: 'รันไทม์ที่มองเห็น heartbeat ล่าสุด', tone: online > 0 ? 'success' : 'muted' },
        { label: 'รอ activate', value: formatNumber(pending, '0'), detail: 'มี token แล้วแต่ยังไม่ผูกเครื่อง', tone: pending > 0 ? 'warning' : 'muted' },
        { label: 'คิวส่งของ', value: formatNumber(listCount(state?.queueItems), '0'), detail: 'ปริมาณงานที่รอหรือกำลังวิ่งอยู่', tone: listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
        { label: 'งานที่ล้มเหลว', value: formatNumber(listCount(state?.deadLetters), '0'), detail: 'คำสั่งซื้อที่ล้มเหลวและต้องตรวจต่อ', tone: listCount(state?.deadLetters) > 0 ? 'danger' : 'muted' },
      ],
      rows: rows.map((row) => ({
        name: firstNonEmpty([row?.meta?.agentLabel, row?.runtimeKey, row?.name, 'Delivery Agent']),
        server: serverLabel(row),
        status: firstNonEmpty([row?.status, 'unknown']),
        scope: firstNonEmpty([row?.meta?.agentScope, row?.meta?.agentRole, row?.scope, row?.role, 'execute_only']),
        version: versionLabel(row),
        binding: bindingLabel(row),
        lastSeenAt: formatDateTime(row?.lastSeenAt),
        issue: currentIssue(row),
      })),
      selected: selected
        ? {
            name: firstNonEmpty([selected?.meta?.agentLabel, selected?.runtimeKey, selected?.name, 'Delivery Agent']),
            runtimeKey: firstNonEmpty([selected?.runtimeKey, '-']),
            server: serverLabel(selected),
            status: firstNonEmpty([selected?.status, 'unknown']),
            scope: firstNonEmpty([selected?.meta?.agentScope, selected?.meta?.agentRole, selected?.scope, selected?.role, 'execute_only']),
            version: versionLabel(selected),
            binding: bindingLabel(selected),
            lastSeenAt: formatDateTime(selected?.lastSeenAt),
            issue: currentIssue(selected),
          }
        : null,
      readiness: {
        runtimeStatus: firstNonEmpty([
          state?.deliveryRuntime?.delivery?.status,
          state?.deliveryRuntime?.status,
          state?.deliveryRuntime?.mode,
          online > 0 ? 'ready' : 'waiting-runtime',
        ]),
        runtimeMode: firstNonEmpty([
          state?.deliveryRuntime?.delivery?.mode,
          state?.deliveryRuntime?.mode,
          'agent',
        ]),
        queueCount: formatNumber(listCount(state?.queueItems), '0'),
        deadLetterCount: formatNumber(listCount(state?.deadLetters), '0'),
      },
      railCards: [
        {
          title: 'Provisioning checklist',
          body: 'สร้าง runtime · ดาวน์โหลด bootstrap · activate บนเครื่องจริง · ตรวจ heartbeat',
          meta: 'ใช้ flow นี้ทุกครั้งเมื่อต้องออกตัวส่งของใหม่หรือเปลี่ยนเครื่อง',
          tone: 'info',
        },
        {
          title: 'งานที่ควรทำต่อ',
          body: pending > 0 ? 'รีบตามตัวที่ยังไม่ activate ก่อน' : 'ตรวจเวอร์ชันและ binding ของตัวที่ออนไลน์อยู่',
          meta: pending > 0
            ? 'ถ้ายังไม่ผูกเครื่อง ระบบยังส่งงานจริงไม่ได้แม้จะสร้าง runtime record แล้ว'
            : 'ถ้ามีผู้เล่นแจ้งของไม่เข้า ให้ดู queue กับ dead-letter ต่อจากหน้านี้ได้เลย',
          tone: pending > 0 ? 'warning' : 'muted',
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

  function renderRuntimeRow(row, selectedName) {
    const current = row.name === selectedName ? ' tdv4-data-row-current' : '';
    return [
      `<article class="tdv4-data-row${current}">`,
      `<div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong><div class="code">${escapeHtml(row.server)}</div></div>`,
      `<div>${renderBadge(row.status, statusTone(row.status))}</div>`,
      `<div class="code">${escapeHtml(row.scope)}</div>`,
      `<div class="code">${escapeHtml(row.version)}</div>`,
      `<div class="code">${escapeHtml(row.binding)}</div>`,
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

  function buildTenantDeliveryAgentsV4Html(model) {
    const safeModel = model || createTenantDeliveryAgentsV4Model({});
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
      renderBadge('Delivery Agents', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-runtime-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">ศูนย์งานสำหรับตัวส่งของในเกม ใช้ดูความพร้อม ออก setup ใหม่ และตามเคสที่อาจกระทบการส่งของจริง</div>',
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
      '<div class="tdv4-section-kicker">รันไทม์ที่มองเห็น</div>',
      '<h2 class="tdv4-section-title">ตาราง Delivery Agents</h2>',
      '<div class="tdv4-data-header"><span>Runtime</span><span>Status</span><span>Scope</span><span>Version</span><span>Binding</span><span>Last seen</span><span>Issue</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.rows) && safeModel.rows.length
        ? safeModel.rows.map((row) => renderRuntimeRow(row, safeModel.selected?.name))
        : ['<div class="tdv4-empty-state"><strong>ยังไม่มี Delivery Agent</strong><span>สร้างตัวรันส่งของก่อน เพื่อให้ระบบส่งไอเทมและประกาศในเกมได้จริง</span><a class="tdv4-button tdv4-button-primary" href="#delivery-agents-new">สร้าง Delivery Agent</a></div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">รายละเอียดตัวที่เลือก</div>',
      '<h2 class="tdv4-section-title">สรุป binding และความพร้อม</h2>',
      (safeModel.selected
        ? [
            '<div class="tdv4-selected-runtime">',
            `<strong>${escapeHtml(safeModel.selected.name)}</strong>`,
            `<div>${renderBadge(safeModel.selected.status, statusTone(safeModel.selected.status))}</div>`,
            `<div class="tdv4-kpi-detail">Runtime key ${escapeHtml(safeModel.selected.runtimeKey)} · server ${escapeHtml(safeModel.selected.server)}</div>`,
            `<div class="tdv4-kpi-detail">Scope ${escapeHtml(safeModel.selected.scope)} · version ${escapeHtml(safeModel.selected.version)}</div>`,
            `<div class="tdv4-kpi-detail">Binding ${escapeHtml(safeModel.selected.binding)}</div>`,
            `<div class="tdv4-kpi-detail">Last seen ${escapeHtml(safeModel.selected.lastSeenAt)}</div>`,
            `<div class="tdv4-kpi-detail">Issue ${escapeHtml(safeModel.selected.issue)}</div>`,
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state"><strong>ยังไม่ได้เลือก Delivery Agent</strong><span>เลือกตัวรันส่งของจากตารางก่อน เพื่อดู binding เครื่องและความพร้อมในการรับงาน</span></div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Readiness</div>',
      '<h2 class="tdv4-section-title">คิวและสถานะรันไทม์ที่กระทบการส่งของ</h2>',
      '<div class="tdv4-runtime-readiness-grid">',
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Runtime status</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.readiness.runtimeStatus)}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Execution mode</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.readiness.runtimeMode)}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">งานรอส่ง</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.readiness.queueCount)}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">งานที่ล้มเหลว</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.readiness.deadLetterCount)}</div></article>`,
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">ใช้ rail นี้เป็น checklist สำหรับออก setup ใหม่ รีเซ็ต binding หรืออธิบายให้ operator เห็นว่าต้องทำอะไรต่อ</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantDeliveryAgentsV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantDeliveryAgentsV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.rows)
      ? source
      : createTenantDeliveryAgentsV4Model(source);
    rootElement.innerHTML = buildTenantDeliveryAgentsV4Html(model);
    return model;
  }

  return {
    buildTenantDeliveryAgentsV4Html,
    createTenantDeliveryAgentsV4Model,
    renderTenantDeliveryAgentsV4,
  };
});
