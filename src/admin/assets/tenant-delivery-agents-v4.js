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
        { label: 'เซิร์ฟเวอร์', href: '#server-status' },
        { label: 'รีสตาร์ต', href: '#restart-control' },
      ],
    },
    {
      label: 'งานปฏิบัติการ',
      items: [
        { label: 'คำสั่งซื้อ', href: '#orders' },
        { label: 'ผู้เล่น', href: '#players' },
      ],
    },
    {
      label: 'บอต',
      items: [
        { label: 'บอตส่งของ', href: '#delivery-agents', current: true },
        { label: 'บอตเซิร์ฟเวอร์', href: '#server-bots' },
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
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : fallback;
  }

  function formatDateTime(value, fallback = 'ยังไม่มีกิจกรรมล่าสุด') {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? fallback
      : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function statusTone(status) {
    const text = trimText(status, 80).toLowerCase();
    if (['online', 'ready', 'healthy', 'active'].includes(text)) return 'success';
    if (['pending_activation', 'pending-activation', 'draft', 'provisioned', 'degraded', 'stale'].includes(text)) return 'warning';
    if (['offline', 'revoked', 'outdated', 'error', 'failed', 'disabled'].includes(text)) return 'danger';
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
      row?.displayName,
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

  function getAgentId(row) {
    return firstNonEmpty([row?.meta?.agentId, row?.agentId], '');
  }

  function getServerId(row) {
    return firstNonEmpty([row?.meta?.serverId, row?.serverId, row?.tenantServerId], '');
  }

  function getRuntimeKey(row) {
    return firstNonEmpty([row?.runtimeKey, row?.meta?.runtimeKey], '');
  }

  function matchesRuntimeEntry(entry, runtimeRow) {
    const runtimeAgentId = getAgentId(runtimeRow);
    const runtimeServerId = getServerId(runtimeRow);
    const runtimeKey = getRuntimeKey(runtimeRow);
    const entryAgentId = trimText(entry?.agentId, 120);
    const entryServerId = trimText(entry?.serverId, 120);
    const entryRuntimeKey = trimText(entry?.runtimeKey, 160);

    if (runtimeAgentId && entryAgentId && runtimeAgentId === entryAgentId) {
      return !runtimeServerId || !entryServerId || runtimeServerId === entryServerId;
    }
    if (runtimeKey && entryRuntimeKey && runtimeKey === entryRuntimeKey) {
      return !runtimeServerId || !entryServerId || runtimeServerId === entryServerId;
    }
    return false;
  }

  function buildRuntimeHistory(state, runtimeRows, selectedServerId) {
    const sessions = Array.isArray(state?.agentSessions) ? state.agentSessions : [];
    return sessions
      .filter((entry) => {
        if (runtimeRows.some((runtimeRow) => matchesRuntimeEntry(entry, runtimeRow))) return true;
        if (selectedServerId && trimText(entry?.serverId, 160) !== selectedServerId) return false;
        return isDeliveryAgent(entry);
      })
      .slice(0, 6)
      .map((entry) => ({
        name: firstNonEmpty([entry?.displayName, entry?.runtimeKey, entry?.agentId, 'บอตส่งของ']),
        machine: firstNonEmpty([entry?.hostname, entry?.metadata?.hostname, 'ไม่ทราบชื่อเครื่อง']),
        status: firstNonEmpty([entry?.status, 'active']),
        version: firstNonEmpty([entry?.version, '-']),
        heartbeatAt: formatDateTime(entry?.heartbeatAt),
        sessionId: firstNonEmpty([entry?.sessionId, entry?.id, '-']),
      }));
  }

  function renderRuntimeActions(kind, row) {
    const buttons = [];
    if (row.apiKeyId) {
      buttons.push(
        `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="rotate-token" data-runtime-api-key-id="${escapeHtml(row.apiKeyId)}" data-runtime-name="${escapeHtml(row.name)}">หมุนคีย์บอต</button>`,
      );
      buttons.push(
        `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="revoke-token" data-runtime-api-key-id="${escapeHtml(row.apiKeyId)}" data-runtime-name="${escapeHtml(row.name)}">ยกเลิกสิทธิ์บอต</button>`,
      );
    }
    if (row.deviceId) {
      buttons.push(
        `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="revoke-device" data-runtime-device-id="${escapeHtml(row.deviceId)}" data-runtime-name="${escapeHtml(row.name)}">รีเซ็ตการผูกเครื่อง</button>`,
      );
    }
    if (!buttons.length) {
      return '<div class="tdv4-runtime-inline-note">รอให้บอตเชื่อมต่อและรับคีย์ก่อน แล้วจึงค่อยจัดการจากหน้านี้</div>';
    }
    return `<div class="tdv4-runtime-inline-note">${escapeHtml(row.issue)}</div><div class="tdv4-runtime-action-row">${buttons.join('')}</div>`;
  }

  function renderProvisioningActions(kind, row) {
    return [
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="reissue-provision" data-runtime-token-id="${escapeHtml(row.tokenId)}" data-runtime-server-id-value="${escapeHtml(row.serverId)}" data-runtime-display-name-value="${escapeHtml(row.name)}" data-runtime-runtime-key-value="${escapeHtml(row.runtimeKey)}">ออก setup token ใหม่</button>`,
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="revoke-provision" data-runtime-token-id="${escapeHtml(row.tokenId)}" data-runtime-name="${escapeHtml(row.name)}">ยกเลิก setup token</button>`,
    ].join('');
  }

  function buildResultPanel(kind, result) {
    if (!result?.instructions) return '';
    const instructions = result.instructions;
    const tone = trimText(instructions.tone, 40) || 'success';
    const command = trimText(instructions.command, 4000);
    const steps = Array.isArray(instructions.steps) ? instructions.steps.filter(Boolean) : [];
    const facts = Array.isArray(instructions.facts)
      ? instructions.facts.filter((entry) => entry && (entry.label || entry.value))
      : [];
    const downloads = Array.isArray(instructions.downloads)
      ? instructions.downloads.filter((entry) => entry && (entry.key || entry.label))
      : [];
    return [
      `<article class="tdv4-panel tdv4-runtime-result tdv4-tone-${escapeHtml(tone)}">`,
      `<div class="tdv4-section-kicker">${escapeHtml(command ? 'พร้อมติดตั้ง' : 'อัปเดตล่าสุด')}</div>`,
      `<h3 class="tdv4-section-title">${escapeHtml(instructions.title || 'ผลลัพธ์ล่าสุด')}</h3>`,
      `<p class="tdv4-section-copy">${escapeHtml(instructions.detail || '')}</p>`,
      steps.length
        ? `<ol class="tdv4-runtime-step-list">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
        : '',
      facts.length
        ? `<div class="tdv4-list-grid">${facts.map((fact) => `<article class="tdv4-panel tdv4-tone-info"><div class="tdv4-section-kicker">${escapeHtml(fact.label || 'รายละเอียด')}</div><p class="tdv4-section-copy">${escapeHtml(fact.value || '')}</p></article>`).join('')}</div>`
        : '',
      downloads.length
        ? `<div class="tdv4-action-list">${downloads.map((entry, index) => `<button class="tdv4-button ${index === 0 ? 'tdv4-button-primary' : 'tdv4-button-secondary'}" type="button" data-runtime-download-kind="${escapeHtml(kind)}" data-runtime-download-key="${escapeHtml(entry.key || '')}">${escapeHtml(entry.label || 'ดาวน์โหลดไฟล์')}</button>`).join('')}</div>`
        : '',
      command ? `<textarea class="tdv4-editor tdv4-runtime-command" readonly>${escapeHtml(command)}</textarea>` : '',
      '</article>',
    ].join('');
  }

  function buildEmptyState(kind, title, detail, actionLabel, actionHref) {
    return {
      kind: trimText(kind, 80) || 'general',
      title: firstNonEmpty([title], ''),
      detail: firstNonEmpty([detail], ''),
      actionLabel: firstNonEmpty([actionLabel], ''),
      actionHref: firstNonEmpty([actionHref], '#delivery-agents'),
    };
  }

  function createTenantDeliveryAgentsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const runtimeRows = (Array.isArray(state.agents) ? state.agents : []).filter(isDeliveryAgent);
    const provisioning = Array.isArray(state.agentProvisioning) ? state.agentProvisioning.filter(isDeliveryAgent) : [];
    const devices = Array.isArray(state.agentDevices) ? state.agentDevices : [];
    const credentials = Array.isArray(state.agentCredentials) ? state.agentCredentials : [];
    const online = runtimeRows.filter((row) => statusTone(row.status) === 'success').length;
    const selectedServerId = String(state?.activeServer?.id || state?.servers?.[0]?.id || '').trim();
    const queueCount = Array.isArray(state.queueItems) ? state.queueItems.length : 0;
    const failedCount = Array.isArray(state.deadLetters) ? state.deadLetters.length : 0;
    const result = state?.__provisioningResult?.['delivery-agents'] || null;
    const hasServers = Array.isArray(state.servers) && state.servers.length > 0;
    const history = buildRuntimeHistory(state, runtimeRows, selectedServerId);

    const rows = runtimeRows.map((row) => {
      const device = devices.find((entry) => matchesRuntimeEntry(entry, row) && String(entry?.status || '').trim() !== 'revoked') || null;
      const credential = credentials.find((entry) => matchesRuntimeEntry(entry, row) && String(entry?.status || '').trim() !== 'revoked') || null;
      return {
        name: firstNonEmpty([row?.meta?.agentLabel, row?.displayName, row?.name, row?.runtimeKey, 'บอตส่งของ']),
        server: firstNonEmpty([row?.meta?.serverId, row?.serverId, row?.tenantServerId, 'ยังไม่ผูกเซิร์ฟเวอร์']),
        machine: firstNonEmpty([device?.hostname, row?.hostname, row?.meta?.hostname, row?.meta?.machineFingerprint, 'รอชื่อเครื่อง']),
        status: firstNonEmpty([row?.status, 'unknown']),
        lastSeenAt: formatDateTime(row?.lastSeenAt),
        version: firstNonEmpty([row?.version, row?.meta?.version, '-']),
        issue: firstNonEmpty([row?.reason, row?.meta?.warning, row?.meta?.lastError, 'พร้อมสำหรับงานส่งของและประกาศในเกม']),
        deviceId: trimText(device?.id, 160),
        apiKeyId: trimText(credential?.apiKeyId || credential?.id, 160),
      };
    });

    const tokens = provisioning.slice(0, 8).map((row) => ({
      tokenId: trimText(row?.id, 160),
      serverId: trimText(row?.serverId, 160),
      name: firstNonEmpty([row?.displayName, row?.name, row?.runtimeKey, 'บอตส่งของ']),
      expiresAt: formatDateTime(row?.expiresAt, 'ยังไม่มีเวลาหมดอายุ'),
      status: firstNonEmpty([row?.status, 'pending_activation']),
      runtimeKey: firstNonEmpty([row?.runtimeKey, row?.agentId, '-']),
    }));
    const selectedServerTokens = tokens.filter((row) => !selectedServerId || row.serverId === selectedServerId);
    const createEmptyState = hasServers
      ? null
      : buildEmptyState(
          'missing-server',
          'ยังไม่มีเซิร์ฟเวอร์',
          'สร้างหรือผูกเซิร์ฟเวอร์ก่อน แล้วค่อยออก setup token ให้เครื่องที่ใช้ส่งของในเกม',
          'เปิดหน้าเซิร์ฟเวอร์',
          '#server-status',
        );
    const listEmptyState = rows.length
      ? null
      : selectedServerTokens.length
        ? buildEmptyState(
            'pending-install',
            'กำลังรอติดตั้งบอตส่งของ',
            'มี setup token อยู่แล้ว ให้นำคำสั่งไปติดตั้งบนเครื่องส่งของ แล้วรีเฟรชหน้านี้อีกครั้ง',
            'ดู setup token',
            '#delivery-agents',
          )
        : hasServers
          ? buildEmptyState(
              'create-first',
              'ยังไม่มีบอตส่งของ',
      'ออก setup token แล้วติดตั้งบอตบนเครื่องที่เปิด SCUM ไว้สำหรับส่งของ',
              'สร้างบอตส่งของ',
              '#delivery-agents-provision',
            )
          : createEmptyState;

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงผู้เช่า',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'พื้นที่ผู้เช่า',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : FALLBACK_NAV_GROUPS,
      },
      header: {
        title: 'บอตส่งของ',
      subtitle: 'สร้างและจัดการบอตที่ทำงานส่งของบนเครื่องที่เปิด SCUM อยู่',
        chips: [
          { label: `${formatNumber(online)} ออนไลน์`, tone: online ? 'success' : 'muted' },
          { label: `${formatNumber(rows.length - online)} ออฟไลน์`, tone: rows.length > online ? 'warning' : 'muted' },
          { label: `${formatNumber(tokens.length)} setup token`, tone: tokens.length ? 'warning' : 'muted' },
        ],
      },
      summary: [
        {
          label: 'พร้อมส่งของ',
          value: formatNumber(online),
        detail: online ? 'มีบอตส่งของออนไลน์อย่างน้อยหนึ่งตัวแล้ว' : 'ยังไม่มี heartbeat จากบอตส่งของ',
          tone: online ? 'success' : 'warning',
        },
        {
          label: 'งานที่รอคิว',
          value: formatNumber(queueCount),
        detail: queueCount ? 'ยังมีงานส่งของค้างคิวและต้องรอบอตมารับงาน' : 'ตอนนี้ไม่มีงานส่งของค้างคิว',
          tone: queueCount ? 'warning' : 'success',
        },
        {
          label: 'งานที่มีปัญหา',
          value: formatNumber(failedCount),
          detail: failedCount ? 'ตรวจงานส่งของที่ล้มเหลวก่อนกดทำซ้ำจำนวนมาก' : 'ตอนนี้ยังไม่เห็นงานส่งของที่ล้มเหลว',
          tone: failedCount ? 'danger' : 'muted',
        },
      ],
      servers: Array.isArray(state.servers) ? state.servers : [],
      selectedServerId,
      rows,
      history,
      tokens,
      result,
      createEmptyState,
      listEmptyState,
    };
  }

  function buildTenantDeliveryAgentsV4Html(model) {
    const safe = model && typeof model === 'object' ? model : createTenantDeliveryAgentsV4Model({});
    const pageheadActionHref = safe.servers.length ? '#delivery-agents-provision' : '#server-status';
    const pageheadActionLabel = safe.servers.length ? 'สร้างบอตส่งของ' : 'เปิดหน้าเซิร์ฟเวอร์';
    const serverOptions = safe.servers
      .map((server) => `<option value="${escapeHtml(server.id)}"${server.id === safe.selectedServerId ? ' selected' : ''}>${escapeHtml(firstNonEmpty([server.name, server.slug, server.id]))}</option>`)
      .join('');
    const createPanelBody = safe.createEmptyState
      ? [
          `<div class="tdv4-empty-state" data-runtime-empty-kind="${escapeHtml(safe.createEmptyState.kind)}">`,
          `<strong>${escapeHtml(safe.createEmptyState.title)}</strong>`,
          `<p>${escapeHtml(safe.createEmptyState.detail)}</p>`,
          `<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" data-runtime-empty-action="delivery-agents" href="${escapeHtml(safe.createEmptyState.actionHref)}">${escapeHtml(safe.createEmptyState.actionLabel)}</a></div>`,
          '</div>',
        ].join('')
      : [
          '<div class="tdv4-runtime-form"><div class="tdv4-runtime-form-fields">',
          '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">เซิร์ฟเวอร์</div><div class="tdv4-basic-field-detail">เลือกเซิร์ฟเวอร์ที่เครื่องส่งของนี้จะผูกอยู่ด้วย</div></div>',
          `<select class="tdv4-basic-input" data-runtime-server-id="delivery-agents">${serverOptions || '<option value="">ยังไม่มีเซิร์ฟเวอร์</option>'}</select></label>`,
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">ชื่อที่ใช้แสดง</div><div class="tdv4-basic-field-detail">ใช้แสดงในสถานะบอตและประวัติการตั้งค่า</div></div>',
          '<input class="tdv4-basic-input" type="text" data-runtime-display-name="delivery-agents" value="บอตส่งของ"></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">คีย์บอต</div><div class="tdv4-basic-field-detail">รหัสอ้างอิงถาวรที่ control plane ใช้ระบุตัวบอต</div></div>',
          '<input class="tdv4-basic-input" type="text" data-runtime-runtime-key="delivery-agents" value="delivery-agent"></label>',
          '</div><div class="tdv4-action-list">',
          `<button class="tdv4-button tdv4-button-primary" type="button" data-runtime-provision-button="delivery-agents"${safe.servers.length ? '' : ' disabled'}>สร้างบอตส่งของ</button>`,
          '</div></div>',
        ].join('');
    const listEmptyState = safe.listEmptyState || buildEmptyState(
      'create-first',
      'ยังไม่มีบอตส่งของ',
      'ออก setup token แล้วติดตั้งบอตบนเครื่องส่งของก่อน',
      'สร้างบอตส่งของ',
      '#delivery-agents-provision',
    );

    return [
      '<div class="tdv4-app"><div class="tdv4-topbar"><div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div>`,
      '</div></div></div>',
      '<div class="tdv4-shell tdv4-runtime-shell">',
      `<aside class="tdv4-sidebar">${(Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups : []).map(renderNavGroup).join('')}</aside>`,
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead"><div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p>`,
      `<div class="tdv4-chip-row">${safe.header.chips.map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div>`,
      '</div><div class="tdv4-pagehead-actions">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(pageheadActionHref)}">${escapeHtml(pageheadActionLabel)}</a>`,
      '</div></section>',
      `<section class="tdv4-kpi-strip tdv4-runtime-summary-strip">${safe.summary.map((item) => `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone)}"><div class="tdv4-kpi-label">${escapeHtml(item.label)}</div><div class="tdv4-kpi-value">${escapeHtml(item.value)}</div><div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div></article>`).join('')}</section>`,
      '<section class="tdv4-dual-grid tdv4-runtime-main-grid">',
      '<article class="tdv4-panel" id="delivery-agents-provision">',
      '<div class="tdv4-section-kicker">งานหลัก</div>',
      '<h2 class="tdv4-section-title">สร้างบอตส่งของ</h2>',
      '<p class="tdv4-section-copy">ออก one-time setup token นำคำสั่งไปติดตั้งบนเครื่องส่งของ แล้วรอให้ activate และส่ง heartbeat กลับมา</p>',
      createPanelBody,
      buildResultPanel('delivery-agents', safe.result),
      '</article>',
      '<article class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สถานะ</div>',
      '<h2 class="tdv4-section-title">บอตส่งของที่ลงทะเบียนแล้ว</h2>',
      '<p class="tdv4-section-copy">ตรวจสถานะบอตจริง การผูกเครื่อง เวอร์ชัน และปุ่มจัดการของแต่ละเครื่องส่งของได้จากหน้านี้</p>',
      safe.rows.length
        ? `<div class="tdv4-data-table"><div class="tdv4-data-header"><span>ชื่อ</span><span>เซิร์ฟเวอร์</span><span>เครื่อง</span><span>สถานะ</span><span>พบล่าสุด</span><span>เวอร์ชัน</span><span>จัดการ</span></div>${safe.rows.map((row, index) => `<article class="tdv4-data-row${index === 0 ? ' tdv4-data-row-current' : ''}"><div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong><span class="tdv4-kpi-detail">${escapeHtml(row.server)}</span></div><span>${escapeHtml(row.server)}</span><span>${escapeHtml(row.machine)}</span><span>${renderBadge(row.status, statusTone(row.status))}</span><span>${escapeHtml(row.lastSeenAt)}</span><span>${escapeHtml(row.version)}</span><div class="tdv4-runtime-manage-cell">${renderRuntimeActions('delivery-agents', row)}</div></article>`).join('')}</div>`
        : `<div class="tdv4-empty-state" data-runtime-empty-kind="${escapeHtml(listEmptyState.kind)}"><strong>${escapeHtml(listEmptyState.title)}</strong><p>${escapeHtml(listEmptyState.detail)}</p><div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" data-runtime-empty-action="delivery-agents" href="${escapeHtml(listEmptyState.actionHref)}">${escapeHtml(listEmptyState.actionLabel)}</a></div></div>`,
      '</article></section>',
      '<section class="tdv4-panel" id="delivery-agents-history">',
      '<div class="tdv4-section-kicker">รายละเอียด / ประวัติ</div>',
      '<h2 class="tdv4-section-title">ความเคลื่อนไหวล่าสุดของบอต</h2>',
      '<p class="tdv4-section-copy">ประวัติ heartbeat ล่าสุดช่วยยืนยันว่าเครื่องไหน activate ก่อน เครื่องไหนยังผูกอยู่ และตอนนี้รายงานเวอร์ชันใดกลับมา</p>',
      safe.history.length
        ? `<div class="tdv4-list-grid">${safe.history.map((entry) => `<article class="tdv4-panel tdv4-tone-info"><div class="tdv4-section-kicker">${escapeHtml(entry.status)}</div><h3 class="tdv4-section-title">${escapeHtml(entry.name)}</h3><p class="tdv4-section-copy">${escapeHtml(entry.machine)} · ${escapeHtml(entry.heartbeatAt)}</p><p class="tdv4-kpi-detail">Session ${escapeHtml(entry.sessionId)} · v${escapeHtml(entry.version)}</p></article>`).join('')}</div>`
      : '<div class="tdv4-empty-state"><strong>ยังไม่มี heartbeat</strong><p>เมื่อบอตเชื่อมต่อและเริ่มส่ง session แล้ว ประวัติเครื่องล่าสุดและเวอร์ชันจะขึ้นตรงนี้</p></div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail"><div class="tdv4-rail-sticky">',
      '<article class="tdv4-panel tdv4-rail-card tdv4-tone-info"><div class="tdv4-rail-title">ขั้นตอนติดตั้ง</div><strong class="tdv4-rail-body">สร้าง ติดตั้ง activate และยืนยันผล</strong><div class="tdv4-rail-detail">สร้างบอตจากหน้านี้ คัดลอกคำสั่งไปติดตั้งบนเครื่องที่เปิด SCUM แล้วรอให้ heartbeat ออนไลน์กลับมา</div></article>',
      '<article class="tdv4-panel tdv4-rail-card tdv4-tone-warning"><div class="tdv4-rail-title">กติกาการผูกเครื่อง</div><strong class="tdv4-rail-body">หนึ่ง setup token ต่อหนึ่งเครื่อง</strong><div class="tdv4-rail-detail">เครื่องแรกที่ activate สำเร็จจะกลายเป็นเครื่องที่ถูกผูกไว้ ถ้าจะย้ายบอตไปเครื่องอื่นต้องรีเซ็ตการผูกเครื่องก่อน</div></article>',
      '<article class="tdv4-panel tdv4-rail-card tdv4-tone-warning"><div class="tdv4-rail-title">setup token ที่รอใช้งาน</div>',
      safe.tokens.length
      ? safe.tokens.map((row) => `<div class="tdv4-list-item"><div class="tdv4-list-main"><strong>${escapeHtml(row.name)}</strong><p>คีย์บอต: ${escapeHtml(row.runtimeKey)}</p><p>หมดอายุ: ${escapeHtml(row.expiresAt)}</p></div><div class="tdv4-list-item-actions">${renderProvisioningActions('delivery-agents', row)}</div></div>`).join('')
      : '<div class="tdv4-empty-state"><strong>ยังไม่มี setup token ที่รอใช้งาน</strong><p>setup token ใหม่จะค้างอยู่ตรงนี้จนกว่าจะมีบอตจริงนำไปใช้</p></div>',
      '</article></div></aside>',
      '</div></div>',
    ].join('');
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
