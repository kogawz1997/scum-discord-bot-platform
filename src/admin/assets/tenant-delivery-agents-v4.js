(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantDeliveryAgentsV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const FALLBACK_NAV_GROUPS = [
    {
      label: 'ภาพรวม',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
        { label: 'สถานะเซิร์ฟเวอร์', href: '#server-status' },
        { label: 'รีสตาร์ต', href: '#restart-control' },
      ],
    },
    {
      label: 'งานประจำวัน',
      items: [
        { label: 'คำสั่งซื้อ', href: '#orders' },
        { label: 'ผู้เล่น', href: '#players' },
      ],
    },
    {
      label: 'รันไทม์',
      items: [
        { label: 'Delivery Agent', href: '#delivery-agents', current: true },
        { label: 'Server Bot', href: '#server-bots' },
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
      ],
    },
  ];

  const EXECUTE_SIGNALS = ['execute', 'delivery', 'dispatch', 'command', 'console-agent', 'announce', 'write'];

  function trimText(value, maxLen = 300) {
    const text = String(value ?? '').trim();
    return !text ? '' : text.slice(0, maxLen);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function firstNonEmpty(values, fallback = '') {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const text = trimText(value, 240);
      if (text) return text;
    }
    return fallback;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : fallback;
  }

  function formatDateTime(value, fallback = 'ยังไม่เห็น heartbeat') {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? fallback
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function statusTone(status) {
    const text = trimText(status, 80).toLowerCase();
    if (['online', 'ready', 'healthy', 'active'].includes(text)) return 'success';
    if (['pending_activation', 'pending-activation', 'draft', 'provisioned', 'degraded', 'stale'].includes(text)) return 'warning';
    if (['offline', 'revoked', 'outdated', 'error', 'failed'].includes(text)) return 'danger';
    return 'muted';
  }

  function normalizeCapabilities(value) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[,\n]+/g)
        : [];
    return raw.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
  }

  function isDeliveryAgent(row) {
    const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
    const role = trimText(meta.agentRole || meta.role || row.role, 80).toLowerCase();
    const scope = trimText(meta.agentScope || meta.scope || row.scope, 80).toLowerCase();
    if (role === 'execute' || ['execute_only', 'execute-only', 'executeonly'].includes(scope)) return true;
    const text = [
      row?.runtimeKey,
      row?.channel,
      row?.name,
      row?.status,
      row?.role,
      row?.scope,
      meta.agentRole,
      meta.agentScope,
      ...normalizeCapabilities(meta.capabilities || meta.features),
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
    return EXECUTE_SIGNALS.some((token) => text.includes(token));
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return `<section class="tdv4-nav-group"><div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div><div class="tdv4-nav-items">${(Array.isArray(group.items) ? group.items : []).map((item) => `<a class="tdv4-nav-link${item.current ? ' tdv4-nav-link-current' : ''}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`).join('')}</div></section>`;
  }

  function createTenantDeliveryAgentsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const rows = (Array.isArray(state.agents) ? state.agents : []).filter(isDeliveryAgent);
    const provisioning = Array.isArray(state.agentProvisioning) ? state.agentProvisioning.filter(isDeliveryAgent) : [];
    const online = rows.filter((row) => statusTone(row.status) === 'success').length;
    const selectedServerId = String(state?.activeServer?.id || state?.servers?.[0]?.id || '').trim();
    const queueCount = Array.isArray(state.queueItems) ? state.queueItems.length : 0;
    const failedCount = Array.isArray(state.deadLetters) ? state.deadLetters.length : 0;
    const result = state?.__provisioningResult?.['delivery-agents'] || null;

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงผู้เช่า',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'Tenant Workspace',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : FALLBACK_NAV_GROUPS,
      },
      header: {
        title: 'Delivery Agent',
        subtitle: 'ใช้สำหรับงานส่งของและคำสั่งที่ต้องทำบนเครื่องเกมของผู้เล่นหรือทีมงาน',
        chips: [
          { label: `${formatNumber(online)} ตัวออนไลน์`, tone: online ? 'success' : 'muted' },
          { label: `${formatNumber(rows.length - online)} ตัวออฟไลน์`, tone: rows.length > online ? 'warning' : 'muted' },
          { label: `${formatNumber(provisioning.length)} token รอเปิดใช้`, tone: provisioning.length ? 'warning' : 'muted' },
        ],
      },
      summary: [
        {
          label: 'พร้อมส่งของ',
          value: formatNumber(online),
          detail: online ? 'มีเครื่องที่รับงานได้แล้ว' : 'ยังไม่มีเครื่องที่ออนไลน์',
          tone: online ? 'success' : 'warning',
        },
        {
          label: 'งานรอทำ',
          value: formatNumber(queueCount),
          detail: queueCount ? 'มีงานที่ยังรอส่งของ' : 'ไม่มีงานค้างในคิว',
          tone: queueCount ? 'warning' : 'success',
        },
        {
          label: 'งานล้มเหลว',
          value: formatNumber(failedCount),
          detail: failedCount ? 'ควรตรวจเครื่องที่ทำงานไม่ผ่านก่อน retry' : 'ยังไม่มีงานล้มเหลว',
          tone: failedCount ? 'danger' : 'muted',
        },
      ],
      servers: Array.isArray(state.servers) ? state.servers : [],
      selectedServerId,
      rows: rows.map((row) => ({
        name: firstNonEmpty([row?.meta?.agentLabel, row?.runtimeKey, row?.name, 'Delivery Agent']),
        server: firstNonEmpty([row?.meta?.serverId, row?.serverId, row?.tenantServerId, 'ยังไม่ผูกเซิร์ฟเวอร์']),
        machine: firstNonEmpty([row?.hostname, row?.meta?.hostname, row?.meta?.machineFingerprint, 'ยังไม่เห็นชื่อเครื่อง']),
        status: firstNonEmpty([row?.status, 'unknown']),
        lastSeenAt: formatDateTime(row?.lastSeenAt),
        version: firstNonEmpty([row?.version, row?.meta?.version, '-']),
        issue: firstNonEmpty([row?.reason, row?.meta?.warning, row?.meta?.lastError, 'พร้อมรับงานส่งของ']),
      })),
      tokens: provisioning.slice(0, 5).map((row) => ({
        name: firstNonEmpty([row?.displayName, row?.name, row?.runtimeKey, 'Delivery Agent']),
        expiresAt: formatDateTime(row?.expiresAt, 'ยังไม่กำหนดเวลา'),
        status: firstNonEmpty([row?.status, 'pending_activation']),
        runtimeKey: firstNonEmpty([row?.runtimeKey, row?.agentId, '-']),
      })),
      result,
    };
  }

  function buildTenantDeliveryAgentsV4Html(model) {
    const safe = model && typeof model === 'object' ? model : createTenantDeliveryAgentsV4Model({});
    const serverOptions = safe.servers
      .map((server) => `<option value="${escapeHtml(server.id)}"${server.id === safe.selectedServerId ? ' selected' : ''}>${escapeHtml(firstNonEmpty([server.name, server.slug, server.id]))}</option>`)
      .join('');
    const result = safe.result && safe.result.instructions
      ? `<article class="tdv4-panel tdv4-runtime-result tdv4-tone-success"><div class="tdv4-section-kicker">พร้อมติดตั้ง</div><h3 class="tdv4-section-title">${escapeHtml(safe.result.instructions.title)}</h3><p class="tdv4-section-copy">${escapeHtml(safe.result.instructions.detail || 'คัดลอกคำสั่งนี้ไปใช้บนเครื่องจริงได้ทันที')}</p><textarea class="tdv4-editor tdv4-runtime-command" readonly>${escapeHtml(safe.result.instructions.command || '')}</textarea></article>`
      : '';

    return `<div class="tdv4-app"><div class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div><div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div></div></div></div><div class="tdv4-shell tdv4-runtime-shell"><aside class="tdv4-sidebar">${(Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups : []).map(renderNavGroup).join('')}</aside><main class="tdv4-main tdv4-stack"><section class="tdv4-pagehead"><div><h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1><p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p><div class="tdv4-chip-row">${safe.header.chips.map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div></div><div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="#delivery-agents-provision">สร้าง Delivery Agent</a></div></section><section class="tdv4-kpi-strip tdv4-runtime-summary-strip">${safe.summary.map((item) => `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone)}"><div class="tdv4-kpi-label">${escapeHtml(item.label)}</div><div class="tdv4-kpi-value">${escapeHtml(item.value)}</div><div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div></article>`).join('')}</section><section class="tdv4-dual-grid tdv4-runtime-main-grid"><article class="tdv4-panel"><div class="tdv4-section-kicker">Create runtime</div><h2 class="tdv4-section-title">สร้าง Delivery Agent ใหม่</h2><p class="tdv4-section-copy">เลือกเซิร์ฟเวอร์ ตั้งชื่อ แล้วออก setup token เพื่อนำไปติดตั้งบนเครื่องที่ใช้ส่งของในเกม</p><div class="tdv4-runtime-form"><div class="tdv4-runtime-form-fields"><label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">เซิร์ฟเวอร์</div><div class="tdv4-basic-field-detail">ผูก agent ตัวนี้กับเซิร์ฟเวอร์ที่ต้องส่งของ</div></div><select class="tdv4-basic-input" data-runtime-server-id="delivery-agents">${serverOptions || '<option value="">ยังไม่มีเซิร์ฟเวอร์</option>'}</select></label><label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">ชื่อที่ใช้เรียก</div><div class="tdv4-basic-field-detail">ชื่อที่ทีมงานจะเห็นในหน้ารันไทม์</div></div><input class="tdv4-basic-input" type="text" data-runtime-display-name="delivery-agents" value="Delivery Agent"></label><label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Runtime Key</div><div class="tdv4-basic-field-detail">คีย์อ้างอิงของตัว runtime บนเครื่องจริง</div></div><input class="tdv4-basic-input" type="text" data-runtime-runtime-key="delivery-agents" value="delivery-agent"></label></div><div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="button" data-runtime-provision-button="delivery-agents"${safe.servers.length ? '' : ' disabled'}>สร้าง Delivery Agent</button></div></div>${result}</article><article class="tdv4-panel"><div class="tdv4-section-kicker">Current runtimes</div><h2 class="tdv4-section-title">รายการ Delivery Agent</h2><p class="tdv4-section-copy">ใช้หน้านี้ดูว่าเครื่องใดออนไลน์ พร้อมรับงาน และเครื่องใดต้องตามต่อ</p>${safe.rows.length ? `<div class="tdv4-data-table"><div class="tdv4-data-header"><span>ชื่อ</span><span>เซิร์ฟเวอร์</span><span>เครื่อง</span><span>สถานะ</span><span>ล่าสุด</span><span>เวอร์ชัน</span><span>หมายเหตุ</span></div>${safe.rows.map((row, index) => `<article class="tdv4-data-row${index === 0 ? ' tdv4-data-row-current' : ''}"><div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong><span class="tdv4-kpi-detail">${escapeHtml(row.server)}</span></div><span>${escapeHtml(row.server)}</span><span>${escapeHtml(row.machine)}</span><span>${renderBadge(row.status, statusTone(row.status))}</span><span>${escapeHtml(row.lastSeenAt)}</span><span>${escapeHtml(row.version)}</span><span>${escapeHtml(row.issue)}</span></article>`).join('')}</div>` : '<div class="tdv4-empty-state"><strong>ยังไม่มี Delivery Agent</strong><p>เริ่มจากกดปุ่ม “สร้าง Delivery Agent” เพื่อออก token และคำสั่งติดตั้งบนเครื่องจริง</p></div>'}</article></section></main><aside class="tdv4-rail"><div class="tdv4-rail-sticky"><article class="tdv4-panel tdv4-rail-card tdv4-tone-info"><div class="tdv4-rail-title">ลำดับติดตั้ง</div><strong class="tdv4-rail-body">สร้าง · ติดตั้ง · Activate</strong><div class="tdv4-rail-detail">หลังออก token แล้ว ให้รันคำสั่งบนเครื่องเกม จากนั้นรอ heartbeat กลับเข้าระบบ</div></article><article class="tdv4-panel tdv4-rail-card tdv4-tone-warning"><div class="tdv4-rail-title">Token ที่ยังรอใช้</div>${safe.tokens.length ? safe.tokens.map((row) => `<div class="tdv4-list-item"><div class="tdv4-list-main"><strong>${escapeHtml(row.name)}</strong><p>Runtime: ${escapeHtml(row.runtimeKey)}</p></div><div class="tdv4-list-meta">${escapeHtml(row.expiresAt)}</div></div>`).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มี token ค้าง</strong><p>เมื่อสร้าง token ใหม่ ระบบจะแสดงไว้ที่นี่จนกว่าจะ activate</p></div>'}</article></div></aside></div></div>`;
  }

  function renderTenantDeliveryAgentsV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantDeliveryAgentsV4 requires a root element');
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
