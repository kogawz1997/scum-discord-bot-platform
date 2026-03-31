(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantServerStatusV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    {
      label: 'ภาพรวมงานหลัก',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
        { label: 'สถานะเซิร์ฟเวอร์', href: '#server-status', current: true },
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

  function formatRelative(value) {
    const date = parseDate(value);
    if (!date) return 'ยังไม่มีข้อมูล';
    const deltaMs = Date.now() - date.getTime();
    const deltaMinutes = Math.max(1, Math.round(deltaMs / 60000));
    if (deltaMinutes < 60) return `${formatNumber(deltaMinutes)} นาทีที่แล้ว`;
    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) return `${formatNumber(deltaHours)} ชั่วโมงที่แล้ว`;
    return `${formatNumber(Math.round(deltaHours / 24))} วันที่แล้ว`;
  }

  function normalizeStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'unknown';
    if (['online', 'ready', 'healthy', 'active', 'ok', 'connected'].includes(raw)) return 'online';
    if (['warning', 'degraded', 'slow', 'stale'].includes(raw)) return 'degraded';
    if (['offline', 'stopped', 'failed', 'error', 'revoked'].includes(raw)) return 'offline';
    if (['provisioned', 'pending', 'pending_activation', 'draft'].includes(raw)) return 'pending';
    return raw;
  }

  function statusLabel(value) {
    const normalized = normalizeStatus(value);
    if (normalized === 'online') return 'พร้อมใช้งาน';
    if (normalized === 'degraded') return 'ต้องจับตา';
    if (normalized === 'offline') return 'ไม่พร้อมใช้งาน';
    if (normalized === 'pending') return 'รอดำเนินการ';
    return 'ยังไม่มีข้อมูล';
  }

  function toneForStatus(value) {
    const normalized = normalizeStatus(value);
    if (normalized === 'online') return 'success';
    if (normalized === 'degraded') return 'warning';
    if (normalized === 'offline') return 'danger';
    return 'muted';
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

  function findWorkspaceSettingValue(state, settingKey) {
    const targetKey = String(settingKey || '').trim().toLowerCase();
    if (!targetKey) return '';
    const workspace = state?.serverConfigWorkspace && typeof state.serverConfigWorkspace === 'object'
      ? state.serverConfigWorkspace
      : null;
    const categories = Array.isArray(workspace?.categories) ? workspace.categories : [];
    for (const category of categories) {
      const groups = Array.isArray(category?.groups) ? category.groups : [];
      for (const group of groups) {
        const settings = Array.isArray(group?.settings) ? group.settings : [];
        for (const setting of settings) {
          if (String(setting?.key || '').trim().toLowerCase() !== targetKey) continue;
          const value = String(setting?.currentValue ?? setting?.value ?? '').trim();
          if (value) return value;
        }
      }
    }
    return '';
  }

  function buildControlReadiness(state) {
    const startConfigured = Boolean(findWorkspaceSettingValue(state, 'SCUM_SERVER_START_TEMPLATE'));
    const stopConfigured = Boolean(findWorkspaceSettingValue(state, 'SCUM_SERVER_STOP_TEMPLATE'));
    const restartConfigured = Boolean(
      findWorkspaceSettingValue(state, 'SCUM_SERVER_RESTART_TEMPLATE')
      || findWorkspaceSettingValue(state, 'SCUM_SERVER_APPLY_TEMPLATE'),
    );
    const items = [
      {
        label: startConfigured ? 'Start command ready' : 'Start command needs setup',
        tone: startConfigured ? 'success' : 'warning',
      },
      {
        label: stopConfigured ? 'Stop command ready' : 'Stop command needs setup',
        tone: stopConfigured ? 'success' : 'warning',
      },
      {
        label: restartConfigured ? 'Restart command ready' : 'Restart command needs setup',
        tone: restartConfigured ? 'success' : 'warning',
      },
    ];
    const missingCount = items.filter((item) => item.tone !== 'success').length;
    return {
      startConfigured,
      stopConfigured,
      restartConfigured,
      items,
      detail: missingCount
        ? 'Set the missing Server Bot command templates from Server Config before using the disabled controls.'
        : 'Server control templates are configured and ready for daily operations.',
    };
  }

  function findAgentStatus(agents, matcher) {
    const rows = Array.isArray(agents) ? agents : [];
    const found = rows.find((item) => matcher(String(item?.role || item?.kind || item?.type || '').trim().toLowerCase()));
    return found ? normalizeStatus(found.status || found.state) : 'unknown';
  }

  function extractTenantName(state) {
    return firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);
  }

  function extractLastSync(state) {
    return firstNonEmpty([
      state?.deliveryRuntime?.lastSyncAt,
      state?.overview?.analytics?.delivery?.lastSyncAt,
      state?.reconcile?.lastRunAt,
      state?.notifications?.[0]?.createdAt,
    ]);
  }

  function buildIncidentRows(state) {
    const rows = [];
    const deadLetters = listCount(state?.deadLetters);
    const queueDepth = listCount(state?.queueItems);
    const anomalies = Number(state?.reconcile?.summary?.anomalies || 0);
    const abuseFindings = Number(state?.reconcile?.summary?.abuseFindings || 0);
    const notifications = Array.isArray(state?.notifications) ? state.notifications.slice(0, 3) : [];

    if (deadLetters > 0) {
      rows.push({
        tone: 'danger',
        title: 'มีรายการส่งของตกค้างใน dead-letter',
        detail: 'ควรเปิดหน้าการส่งของเพื่อตรวจสาเหตุ ก่อนตัดสินใจ replay หรือดำเนินการกับผู้เล่นต่อ',
        meta: `${formatNumber(deadLetters)} รายการ`,
      });
    }
    if (queueDepth > 5) {
      rows.push({
        tone: 'warning',
        title: 'คิวส่งของกำลังสะสม',
        detail: 'ภาระงานของ Delivery Agent สูงกว่าปกติและอาจทำให้คำสั่งซื้อใหม่รอนานขึ้น',
        meta: `${formatNumber(queueDepth)} รายการ`,
      });
    }
    if (anomalies > 0 || abuseFindings > 0) {
      rows.push({
        tone: anomalies > 0 ? 'warning' : 'danger',
        title: 'งานตรวจสอบพบความผิดปกติ',
        detail: 'ควรดูหน้า Diagnostics หรือ Audit ต่อเพื่อยืนยันว่าปัญหากระทบผู้เล่นหรือความพร้อมของระบบจริงหรือไม่',
        meta: `anomalies ${formatNumber(anomalies)} · abuse ${formatNumber(abuseFindings)}`,
      });
    }

    notifications.forEach((item) => {
      rows.push({
        tone: toneForStatus(item?.severity || item?.tone || 'degraded'),
        title: firstNonEmpty([item?.title, item?.label, 'การแจ้งเตือนล่าสุด']),
        detail: firstNonEmpty([item?.detail, item?.message, 'ติดตามเหตุล่าสุดจากระบบ']),
        meta: formatRelative(item?.createdAt),
      });
    });

    if (rows.length === 0) {
      rows.push({
        tone: 'success',
        title: 'ยังไม่พบเหตุที่ต้องรีบจัดการ',
        detail: 'ทั้ง queue, dead-letter และการแจ้งเตือนหลักอยู่ในเกณฑ์ปกติสำหรับงานประจำวัน',
        meta: 'ภาพรวมปกติ',
      });
    }

    return rows.slice(0, 5);
  }

  function buildTimeline(state) {
    const rows = [];
    const notifications = Array.isArray(state?.notifications) ? state.notifications : [];
    const auditItems = Array.isArray(state?.audit?.items) ? state.audit.items : [];

    notifications.slice(0, 4).forEach((item) => {
      rows.push({
        tone: toneForStatus(item?.severity || item?.tone || 'degraded'),
        title: firstNonEmpty([item?.title, item?.label, 'เหตุล่าสุดจากระบบ']),
        detail: firstNonEmpty([item?.detail, item?.message, 'ระบบมีเหตุที่ควรให้ผู้ดูแลรับรู้']),
        meta: formatDateTime(item?.createdAt),
      });
    });

    auditItems.slice(0, 3).forEach((item) => {
      rows.push({
        tone: 'muted',
        title: firstNonEmpty([item?.action, item?.title, 'กิจกรรมของผู้ดูแล']),
        detail: firstNonEmpty([item?.detail, item?.summary, 'มีการเปลี่ยนแปลงจากฝั่งผู้ดูแล']),
        meta: formatDateTime(item?.createdAt || item?.timestamp),
      });
    });

    if (rows.length === 0) {
      rows.push({
        tone: 'muted',
        title: 'ยังไม่มีไทม์ไลน์ล่าสุด',
        detail: 'เมื่อมีเหตุหรือกิจกรรมใหม่ของ tenant จะปรากฏที่ส่วนนี้',
        meta: 'รอข้อมูล',
      });
    }
    return rows.slice(0, 6);
  }

  function deriveRestartHistory(state) {
    if (Array.isArray(state?.restartHistory) && state.restartHistory.length > 0) {
      return state.restartHistory;
    }
    const executions = Array.isArray(state?.restartExecutions) ? state.restartExecutions : [];
    const plans = Array.isArray(state?.restartPlans) ? state.restartPlans : [];
    const planMap = new Map(
      plans
        .filter((entry) => entry && entry.id)
        .map((entry) => [String(entry.id), entry]),
    );
    return executions.map((execution) => {
      const plan = planMap.get(String(execution?.planId || '').trim()) || null;
      return {
        at: execution?.completedAt || execution?.startedAt || plan?.scheduledFor || null,
        mode: execution?.action || plan?.restartMode || 'restart',
        result: execution?.resultStatus || plan?.status || 'unknown',
        actor: plan?.requestedBy || execution?.runtimeKey || '-',
      };
    }).slice(0, 6);
  }

  function createTenantServerStatusV4Model(legacyState) {
    const state = legacyState && typeof legacyState === 'object' ? legacyState : {};
    const tenantName = extractTenantName(state);
    const controlReadiness = buildControlReadiness(state);
    const serverStatus = normalizeStatus(
      state?.overview?.serverStatus
      || state?.dashboardCards?.serverStatus
      || state?.deliveryRuntime?.serverStatus,
    );
    const executeStatus = findAgentStatus(state?.agents, (role) => role.includes('execute') || role.includes('delivery') || role.includes('console'));
    const syncStatus = findAgentStatus(state?.agents, (role) => role.includes('sync') || role.includes('server') || role.includes('watcher'));
    const lastSyncAt = extractLastSync(state);
    const reconcileAt = firstNonEmpty([state?.reconcile?.lastRunAt]);
    const queueDepth = listCount(state?.queueItems);
    const deadLetters = listCount(state?.deadLetters);
    const incidents = buildIncidentRows(state);
    const restartHistory = deriveRestartHistory(state);
    const analytics = state?.overview?.analytics || {};
    const delivery = analytics?.delivery || {};
    const runtimeMode = firstNonEmpty([
      state?.deliveryRuntime?.mode,
      state?.deliveryRuntime?.delivery?.mode,
      state?.deliveryRuntime?.status,
      'managed',
    ]);

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
        title: 'สถานะเซิร์ฟเวอร์',
        subtitle: 'ดูความพร้อมของ runtime, queue, การ sync และปัญหาที่กระทบงานประจำวันจากหน้าเดียว',
        statusChips: [
          { label: `เซิร์ฟเวอร์ ${statusLabel(serverStatus)}`, tone: toneForStatus(serverStatus) },
          { label: `Delivery Agent ${statusLabel(executeStatus)}`, tone: toneForStatus(executeStatus) },
          { label: `Server Bot ${statusLabel(syncStatus)}`, tone: toneForStatus(syncStatus) },
          { label: `sync ล่าสุด ${formatRelative(lastSyncAt)}`, tone: 'muted' },
        ],
        primaryAction: { label: 'Safe restart', restartMode: 'safe_restart', delaySeconds: 0 },
        secondaryActions: [
          { label: 'Restart now', restartMode: 'immediate', delaySeconds: 0 },
          { label: 'Restart in 5 minutes', restartMode: 'delayed', delaySeconds: 300 },
          { label: 'Start server', serverAction: 'start' },
          { label: 'Stop server', serverAction: 'stop' },
        ],
      },
      statusStrip: [
        { label: 'ความพร้อมของเซิร์ฟเวอร์', value: statusLabel(serverStatus), detail: 'พร้อมเปิดงานประจำวันหรือไม่', tone: toneForStatus(serverStatus) },
        { label: 'Delivery Runtime', value: statusLabel(executeStatus), detail: 'ตัวส่งของในเกม', tone: toneForStatus(executeStatus) },
        { label: 'ความสดของข้อมูล sync', value: formatRelative(lastSyncAt), detail: formatDateTime(lastSyncAt), tone: 'muted' },
        { label: 'แรงกดดันจากคิว', value: formatNumber(queueDepth, '0'), detail: `${formatNumber(deadLetters, '0')} รายการใน dead-letter`, tone: deadLetters > 0 ? 'warning' : 'success' },
        { label: 'เหตุที่ต้องตามต่อ', value: formatNumber(incidents.length, '0'), detail: 'ดูจากกล่องเหตุและไทม์ไลน์ด้านล่าง', tone: incidents.some((item) => item.tone === 'danger') ? 'danger' : 'warning' },
      ],
      incidentRows: incidents,
      runtimePanels: [
        {
          label: 'Delivery Agent',
          value: statusLabel(executeStatus),
          detail: `โหมด ${runtimeMode} · อัปเดต ${formatRelative(state?.deliveryRuntime?.updatedAt || state?.deliveryRuntime?.lastSyncAt)}`,
          tone: toneForStatus(executeStatus),
        },
        {
          label: 'Server Bot',
          value: statusLabel(syncStatus),
          detail: `sync ล่าสุด ${formatRelative(lastSyncAt)} · ตรวจล่าสุด ${formatDateTime(reconcileAt)}`,
          tone: toneForStatus(syncStatus),
        },
      ],
      queuePanel: {
        stats: [
          { label: 'คิวส่งของ', value: formatNumber(queueDepth, '0') },
          { label: 'dead-letter', value: formatNumber(deadLetters, '0') },
          { label: 'อัตราสำเร็จ', value: `${formatNumber(delivery.successRate, '0')}%` },
          { label: 'คำสั่งซื้อช่วงล่าสุด', value: formatNumber(delivery.purchaseCount30d, '0') },
        ],
        detail: 'ใช้ยืนยันว่าการส่งของยังเดินตามปกติหรือเริ่มมีคิวสะสมจนต้องเปิดตรวจต่อ',
      },
      syncPanel: {
        stats: [
          { label: 'sync ล่าสุด', value: formatRelative(lastSyncAt) },
          { label: 'reconcile ล่าสุด', value: formatRelative(reconcileAt) },
          { label: 'anomalies', value: formatNumber(state?.reconcile?.summary?.anomalies, '0') },
          { label: 'การแจ้งเตือน', value: formatNumber(listCount(state?.notifications), '0') },
        ],
        detail: 'ใช้ดูว่าข้อมูลจากเกมยังสดพอสำหรับหน้าเว็บ การส่งของ และงานซัพพอร์ตหรือไม่',
      },
      controlReadiness,
      restartHistory: restartHistory.map((item) => ({
        at: formatDateTime(item?.at),
        mode: firstNonEmpty([item?.mode, 'restart']),
        result: firstNonEmpty([item?.result, 'unknown']),
        actor: firstNonEmpty([item?.actor, '-']),
      })),
      timeline: buildTimeline(state),
      railCards: [
        incidents[0]
          ? {
              title: 'สิ่งที่ควรทำต่อ',
              body: incidents[0].title,
              meta: incidents[0].detail,
              tone: incidents[0].tone,
            }
          : {
              title: 'สิ่งที่ควรทำต่อ',
              body: 'ภาพรวมระบบยังอยู่ในเกณฑ์พร้อมใช้',
              meta: 'ถัดไปให้เปิดดูคิวส่งของล่าสุดหรือยืนยันรอบ sync ว่ายังมาในเวลาเดิม',
              tone: 'success',
            },
        {
          title: 'ทางลัดที่ใช้บ่อย',
          body: 'Diagnostics · Delivery · Config · Restart',
          meta: 'สี่หน้าที่ควรเข้าต่อเมื่อมีเหตุสะสมหรือผู้เล่นแจ้งปัญหา',
          tone: 'info',
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

  function renderMetricCard(item) {
    return [
      `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-kpi-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-kpi-value">${escapeHtml(item.value)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function renderIssue(item) {
    return [
      `<article class="tdv4-list-item tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      '<div class="tdv4-list-main">',
      `<strong>${escapeHtml(item.title)}</strong>`,
      `<p>${escapeHtml(item.detail)}</p>`,
      '</div>',
      `<div class="tdv4-list-meta">${escapeHtml(item.meta)}</div>`,
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

  function renderMiniStat(item) {
    return [
      '<article class="tdv4-mini-stat">',
      `<div class="tdv4-mini-stat-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-mini-stat-value">${escapeHtml(item.value)}</div>`,
      '</article>',
    ].join('');
  }

  function renderRestartHistoryItem(item) {
    return [
      '<article class="tdv4-mini-stat">',
      `<div class="tdv4-mini-stat-label">${escapeHtml(item.mode)}</div>`,
      `<div class="tdv4-mini-stat-value">${escapeHtml(item.result)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(item.at)} · ${escapeHtml(item.actor)}</div>`,
      '</article>',
    ].join('');
  }

  function buildTenantServerStatusV4Html(model) {
    const safeModel = model || createTenantServerStatusV4Model({});
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
      renderBadge('Status', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">หน้าเดียวสำหรับตอบคำถามว่าเซิร์ฟเวอร์พร้อมใช้งานไหม และถ้าไม่พร้อมควรไปหน้าต่อไปที่ไหน</div>',
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
      `<button class="tdv4-button tdv4-button-primary" type="button" data-server-restart-button data-restart-mode="${escapeHtml(safeModel.header.primaryAction.restartMode || 'safe_restart')}" data-restart-delay-seconds="${escapeHtml(safeModel.header.primaryAction.delaySeconds || 0)}">${escapeHtml(safeModel.header.primaryAction.label)}</button>`,
      '</div>',
      '</section>',
      '<section class="tdv4-kpi-strip tdv4-status-strip">',
      ...(Array.isArray(safeModel.statusStrip) ? safeModel.statusStrip.map(renderMetricCard) : []),
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Server actions</h2>',
      '<p class="tdv4-section-copy">Use this page for daily server control. Restart, start, and stop are all available from the same workspace.</p>',
      '<div class="tdv4-action-list">',
      ...(Array.isArray(safeModel.header.secondaryActions)
        ? safeModel.header.secondaryActions.map((action) => action.serverAction
          ? `<button class="tdv4-button tdv4-button-secondary" type="button" data-server-control-button data-server-control-action="${escapeHtml(action.serverAction)}">${escapeHtml(action.label)}</button>`
          : `<button class="tdv4-button tdv4-button-secondary" type="button" data-server-restart-button data-restart-mode="${escapeHtml(action.restartMode || 'safe_restart')}" data-restart-delay-seconds="${escapeHtml(action.delaySeconds || 0)}">${escapeHtml(action.label)}</button>`)
        : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Control readiness</h2>',
      `<p class="tdv4-section-copy">${escapeHtml(safeModel.controlReadiness?.detail || '')}</p>`,
      '<div class="tdv4-chip-row">',
      ...((Array.isArray(safeModel.controlReadiness?.items) ? safeModel.controlReadiness.items : []).map((chip) => renderBadge(chip.label, chip.tone))),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Restart history</h2>',
      '<p class="tdv4-section-copy">Review the latest restart attempts here before sending another restart job.</p>',
      (Array.isArray(safeModel.restartHistory) && safeModel.restartHistory.length
        ? `<div class="tdv4-history-grid">${safeModel.restartHistory.map(renderRestartHistoryItem).join('')}</div>`
        : '<div class="tdv4-empty-state">No restart history is visible yet for this tenant.</div>'),
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">เหตุที่ต้องตามต่อ</div>',
      '<h2 class="tdv4-section-title">สรุปเหตุขัดข้องของ tenant นี้</h2>',
      '<p class="tdv4-section-copy">เริ่มที่ส่วนนี้เมื่อคุณต้องตัดสินใจว่าอะไรควรเปิดทำก่อน เพื่อไม่ให้ผู้เล่นหรือคำสั่งซื้อค้างต่อ</p>',
      '<div class="tdv4-list">',
      ...(Array.isArray(safeModel.incidentRows) ? safeModel.incidentRows.map(renderIssue) : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ความพร้อมของรันไทม์</div>',
      '<h2 class="tdv4-section-title">ดูว่า Delivery Agent และ Server Bot พร้อมหรือไม่</h2>',
      '<p class="tdv4-section-copy">ใช้ยืนยันว่าปัญหามาจาก runtime, ความสดของข้อมูล, หรือคิวงานที่สะสม</p>',
      '<div class="tdv4-context-grid tdv4-status-ready-grid">',
      ...(Array.isArray(safeModel.runtimePanels) ? safeModel.runtimePanels.map(renderMetricCard) : []),
      '</div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สุขภาพของคิวและการส่งของ</div>',
      '<h2 class="tdv4-section-title">แรงกดดันของงานส่งของ</h2>',
      `<p class="tdv4-section-copy">${escapeHtml(safeModel.queuePanel.detail)}</p>`,
      '<div class="tdv4-mini-stat-grid">',
      ...(Array.isArray(safeModel.queuePanel.stats) ? safeModel.queuePanel.stats.map(renderMiniStat) : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ความสดของข้อมูลจากเกม</div>',
      '<h2 class="tdv4-section-title">การ sync และการตรวจสอบล่าสุด</h2>',
      `<p class="tdv4-section-copy">${escapeHtml(safeModel.syncPanel.detail)}</p>`,
      '<div class="tdv4-mini-stat-grid">',
      ...(Array.isArray(safeModel.syncPanel.stats) ? safeModel.syncPanel.stats.map(renderMiniStat) : []),
      '</div>',
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ลำดับเหตุการณ์</div>',
      '<h2 class="tdv4-section-title">กิจกรรมและเหตุล่าสุด</h2>',
      '<p class="tdv4-section-copy">ใช้ยืนยันว่าปัญหาเริ่มเมื่อไร ใครเพิ่งแก้ค่าอะไร และมีเหตุใดตามมาใน tenant นี้บ้าง</p>',
      '<div class="tdv4-list">',
      ...(Array.isArray(safeModel.timeline) ? safeModel.timeline.map(renderIssue) : []),
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">สรุปสั้น ๆ สำหรับตัดสินใจว่าเปิดงานต่อหน้าดีที่สุดจากตรงไหน</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantServerStatusV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantServerStatusV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.statusStrip)
      ? source
      : createTenantServerStatusV4Model(source);
    rootElement.innerHTML = buildTenantServerStatusV4Html(model);
    return model;
  }

  return {
    buildTenantServerStatusV4Html,
    createTenantServerStatusV4Model,
    renderTenantServerStatusV4,
  };
});
