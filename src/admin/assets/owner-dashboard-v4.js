(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerDashboardV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    { label: 'แพลตฟอร์ม', items: [
      { label: 'ภาพรวม', href: '#overview', current: true },
      { label: 'ผู้เช่า', href: '#tenants' },
      { label: 'แพ็กเกจ', href: '#packages' },
      { label: 'การสมัครใช้', href: '#subscriptions' },
    ] },
    { label: 'ปฏิบัติการ', items: [
      { label: 'สุขภาพรันไทม์', href: '#runtime-health' },
      { label: 'เหตุการณ์', href: '#incidents' },
      { label: 'งานคิว', href: '#jobs' },
      { label: 'บันทึกและออดิท', href: '#audit' },
    ] },
    { label: 'ธุรกิจ', items: [
      { label: 'การเงิน', href: '#billing' },
      { label: 'ซัพพอร์ต', href: '#support' },
      { label: 'ความปลอดภัย', href: '#security' },
      { label: 'ตั้งค่า', href: '#settings' },
    ] },
  ];

  const ACTION_GROUPS = [
    { tone: 'warning', tag: 'งานด่วน', title: 'ซัพพอร์ตและเหตุการณ์', detail: 'เริ่มที่นี่เมื่อมีผู้เช่าแจ้งปัญหา คิวงานค้าง หรือมีสัญญาณที่เจ้าของระบบควรเปิดดูก่อนอย่างอื่น', actions: [
      { label: 'เปิดกล่องเหตุการณ์', href: '#incidents', primary: true },
      { label: 'เปิดคิวซัพพอร์ต', href: '#support' },
      { label: 'ตรวจเส้นทางการส่งของ', href: '#jobs' },
    ] },
    { tone: 'info', tag: 'หลักฐาน', title: 'ความปลอดภัยและออดิท', detail: 'ใช้เมื่อจำเป็นต้องย้อนดูหลักฐาน ตรวจสิทธิ์การเข้าถึง หรือยืนยันว่าเส้นทางการทำงานยังปลอดภัยก่อนเปลี่ยนค่าระบบ', actions: [
      { label: 'เปิดบันทึกออดิท', href: '#audit', primary: true },
      { label: 'ดูเซสชันและสิทธิ์', href: '#security' },
      { label: 'ดูสุขภาพรันไทม์', href: '#runtime-health' },
    ] },
    { tone: 'success', tag: 'ธุรกิจ', title: 'รายได้และสถานะการขาย', detail: 'คุมการต่ออายุ โควตา และแพ็กเกจให้เห็นก่อน เพื่อไม่ให้ปัญหาของผู้เช่ากลายเป็น churn หรือรายได้หายโดยไม่รู้ตัว', actions: [
      { label: 'ดูผู้เช่า', href: '#tenants', primary: true },
      { label: 'เช็กการต่ออายุ', href: '#subscriptions' },
      { label: 'เปิดหน้าแพ็กเกจ', href: '#packages' },
    ] },
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : fallback;
  }
  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function formatDateTime(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'ยังไม่ทราบเวลา';
  }
  function formatRelative(value) {
    const date = parseDate(value);
    if (!date) return 'ยังไม่มีสัญญาณล่าสุด';
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) return `${formatNumber(minutes)} นาทีที่แล้ว`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${formatNumber(hours)} ชั่วโมงที่แล้ว`;
    return `${formatNumber(Math.round(hours / 24))} วันที่แล้ว`;
  }
  function firstNonEmpty(values, fallback = '') {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }
  function looksLikeJsonText(value) {
    const text = String(value ?? '').trim();
    return text.startsWith('{') || text.startsWith('[');
  }
  function extractReadableText(value, fallback = '') {
    if (value == null) return fallback;
    if (typeof value === 'string') {
      const text = String(value).trim();
      if (!text) return fallback;
      if (looksLikeJsonText(text)) {
        try {
          return extractReadableText(JSON.parse(text), fallback);
        } catch {
          return text;
        }
      }
      return text;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => extractReadableText(item, ''))
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ');
      return firstNonEmpty([joined], fallback);
    }
    if (typeof value === 'object') {
      return firstNonEmpty([
        value.title,
        value.label,
        value.message,
        value.detail,
        value.summary,
        value.reason,
        value.source,
        value.path,
        value.code,
      ], fallback);
    }
    return fallback;
  }
  function humanizeSecurityTitle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'เหตุการณ์ด้านความปลอดภัย';
    if (raw === 'login-succeeded') return 'เข้าสู่ระบบสำเร็จ';
    if (raw === 'login-failed') return 'เข้าสู่ระบบไม่สำเร็จ';
    if (raw === 'session-created') return 'สร้างเซสชันผู้ดูแล';
    if (raw === 'session-revoked') return 'เพิกถอนเซสชันผู้ดูแล';
    if (raw === 'step-up-failed') return 'ยืนยันตัวตนขั้นสูงไม่สำเร็จ';
    if (raw === 'step-up-succeeded') return 'ยืนยันตัวตนขั้นสูงสำเร็จ';
    if (raw === 'operational-alert') return 'คำเตือนการปฏิบัติการ';
    if (raw.includes('security')) return 'เหตุการณ์ด้านความปลอดภัย';
    return firstNonEmpty([String(value || '').trim()], 'เหตุการณ์ด้านความปลอดภัย');
  }
  function humanizeRequestTitle(item) {
    const method = String(item?.method || 'REQ').trim().toUpperCase();
    const requestPath = String(item?.path || item?.routeGroup || '').trim();
    if (requestPath === '/admin/api/login') return 'คำขอเข้าสู่ระบบผู้ดูแล';
    if (requestPath === '/admin/api/logout') return 'คำขอออกจากระบบผู้ดูแล';
    if (requestPath.startsWith('/admin/api/platform/')) return `${method} แพลตฟอร์ม · ${requestPath}`;
    if (requestPath.startsWith('/admin/api/delivery/')) return `${method} งานส่งของ · ${requestPath}`;
    if (requestPath.startsWith('/admin/api/runtime/')) return `${method} รันไทม์ · ${requestPath}`;
    return `${method} ${requestPath || 'คำขอของระบบ'}`;
  }
  function listCount(list) {
    return Array.isArray(list) ? list.length : 0;
  }
  function toneForStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['ready', 'healthy', 'active', 'online'].includes(raw)) return 'success';
    if (['warning', 'degraded', 'stale', 'slow', 'outdated'].includes(raw)) return 'warning';
    if (['offline', 'failed', 'error', 'expired', 'suspended'].includes(raw)) return 'danger';
    return 'muted';
  }
  function normalizeRuntimeRows(snapshot) {
    const services = snapshot && snapshot.services;
    if (Array.isArray(services)) return services;
    if (services && typeof services === 'object') {
      return Object.entries(services).map(([name, row]) => ({ name, ...(row && typeof row === 'object' ? row : {}) }));
    }
    return [];
  }
  function buildIncidentFeed(state) {
    const requestItems = Array.isArray(state.requestLogs && state.requestLogs.items)
      ? state.requestLogs.items.map((item) => ({
          source: 'requests',
          severity: Number(item.statusCode || 0) >= 500 ? 'danger' : 'warning',
          title: humanizeRequestTitle(item),
          detail: `${item.statusCode || '-'} ${item.error || item.summary || item.requestId || ''}`.trim(),
          time: item.at || item.createdAt,
        }))
      : [];
    const alertItems = (Array.isArray(state.notifications) ? state.notifications : []).map((item) => ({
      source: 'alerts',
      severity: item.severity || 'warning',
      title: firstNonEmpty([item.title, item.label, 'การแจ้งเตือนของแพลตฟอร์ม']),
      detail: firstNonEmpty([
        extractReadableText(item.detail, ''),
        extractReadableText(item.message, ''),
        'ระบบมอนิเตอร์ตรวจพบสัญญาณที่เจ้าของระบบควรเปิดดู',
      ]),
      time: item.createdAt || item.at,
    }));
    const securityItems = (Array.isArray(state.securityEvents) ? state.securityEvents : []).map((item) => ({
      source: 'security',
      severity: item.severity || 'info',
      title: humanizeSecurityTitle(item.type),
      detail: firstNonEmpty([
        extractReadableText(item.detail, ''),
        extractReadableText(item.reason, ''),
        extractReadableText(item.meta, ''),
      ]),
      time: item.createdAt || item.at,
    }));
    return alertItems.concat(securityItems).concat(requestItems)
      .sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime())
      .slice(0, 8);
  }
  function buildAttentionRows(state) {
    const tenants = Array.isArray(state.tenants) ? state.tenants : [];
    const subscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
    const quotaSnapshots = Array.isArray(state.tenantQuotaSnapshots) ? state.tenantQuotaSnapshots : [];
    const quotaMap = new Map(quotaSnapshots.map((row) => [String(row.tenantId || row.tenant && row.tenant.id || ''), row]));
    return tenants.map((tenant) => {
      const tenantId = String(tenant.id || '').trim();
      const subscription = subscriptions.find((row) => String(row.tenantId || row.ownerTenantId || '').trim() === tenantId) || {};
      const renewsAt = parseDate(subscription.renewsAt || subscription.expiresAt || subscription.endsAt);
      const quota = quotaMap.get(tenantId);
      const quotaText = quota && quota.quotas ? Object.entries(quota.quotas).slice(0, 2).map(([key, value]) => {
        const used = formatNumber(value && value.used, '0');
        const limit = value && value.unlimited ? 'unlimited' : formatNumber(value && value.limit, '0');
        return `${key}: ${used}/${limit}`;
      }).join(' · ') : 'โควตาอยู่ในเกณฑ์ปกติ';
      const expiringSoon = renewsAt ? (renewsAt.getTime() - Date.now()) <= 1000 * 60 * 60 * 24 * 14 : false;
      const tone = quota && quotaText !== 'โควตาอยู่ในเกณฑ์ปกติ' ? 'warning' : expiringSoon ? 'danger' : 'success';
      return {
        name: tenant.name || tenant.slug || tenantId || 'ผู้เช่าที่ไม่ทราบชื่อ',
        packageName: firstNonEmpty([subscription.packageName, subscription.planName, tenant.plan, tenant.type, 'ยังไม่กำหนดแพ็กเกจ']),
        detail: quota && quotaText !== 'โควตาอยู่ในเกณฑ์ปกติ' ? `โควตาใกล้ชนเพดาน · ${quotaText}` : expiringSoon ? `ต่ออายุภายใน ${formatDateTime(renewsAt)}` : `สถานะ ${firstNonEmpty([subscription.status, tenant.status, 'active'])}`,
        meta: renewsAt ? formatRelative(renewsAt) : formatRelative(tenant.updatedAt || tenant.createdAt),
        tone,
      };
    }).sort((left, right) => ({ danger: 3, warning: 2, success: 1 }[right.tone] || 0) - ({ danger: 3, warning: 2, success: 1 }[left.tone] || 0)).slice(0, 6);
  }
  function buildHotspot(state) {
    return Array.isArray(state.requestLogs && state.requestLogs.metrics && state.requestLogs.metrics.routeHotspots)
      ? state.requestLogs.metrics.routeHotspots[0]
      : null;
  }

  function createOwnerDashboardV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const runtimeRows = normalizeRuntimeRows(state.runtimeSupervisor);
    const readyRuntimes = runtimeRows.filter((row) => toneForStatus(row.status) === 'success').length;
    const analytics = state.overview && state.overview.analytics ? state.overview.analytics : {};
    const tenants = analytics.tenants || {};
    const delivery = analytics.delivery || {};
    const subscriptions = analytics.subscriptions || {};
    const hotspot = buildHotspot(state);
    const feed = buildIncidentFeed(state);
    const expiringCount = (Array.isArray(state.subscriptions) ? state.subscriptions : []).filter((row) => {
      const renewsAt = parseDate(row.renewsAt || row.expiresAt || row.endsAt);
      return renewsAt && (renewsAt.getTime() - Date.now()) <= 1000 * 60 * 60 * 24 * 14;
    }).length;
    const primaryAction = expiringCount > 0
      ? { label: 'ดูรายการใกล้ต่ออายุ (แนะนำ)', href: '#subscriptions' }
      : feed.length > 0
        ? { label: 'เปิดกล่องเหตุการณ์ (แนะนำ)', href: '#incidents' }
        : { label: 'เปิดรายชื่อผู้เช่า', href: '#tenants' };
    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงเจ้าของระบบ',
        workspaceLabel: 'ศูนย์ควบคุมแพลตฟอร์ม',
        environmentLabel: 'ระดับแพลตฟอร์ม',
        navGroups: NAV_GROUPS,
      },
      header: {
        title: 'ภาพรวมเจ้าของระบบ',
        subtitle: 'เห็นสุขภาพของผู้เช่า รันไทม์ ความเสี่ยง และเรื่องที่ควรจัดการก่อนจากศูนย์ควบคุมหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(tenants.total || listCount(state.tenants), '0')} ผู้เช่า`, tone: 'info' },
          { label: `${formatNumber(readyRuntimes, '0')}/${formatNumber(runtimeRows.length, '0')} รันไทม์พร้อม`, tone: readyRuntimes === runtimeRows.length ? 'success' : 'warning' },
          { label: `${formatNumber(feed.length, '0')} สัญญาณที่ยังเปิดอยู่`, tone: feed.length > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(expiringCount, '0')} รายใกล้ต่ออายุ`, tone: expiringCount > 0 ? 'danger' : 'muted' },
        ],
        primaryAction: { label: 'เปิดกล่องเหตุการณ์', href: '#incidents' },
        primaryAction,
      },
      kpis: [
        { label: 'ผู้เช่าที่ใช้งานอยู่', value: formatNumber(tenants.active || listCount(state.tenants), '0'), detail: `${formatNumber(tenants.trialing, '0')} ทดลอง · ${formatNumber(tenants.reseller, '0')} ตัวแทน`, tone: 'info' },
        { label: 'ความพร้อมของรันไทม์', value: `${formatNumber(readyRuntimes, '0')}/${formatNumber(runtimeRows.length, '0')}`, detail: 'บริการที่เจ้าของระบบต้องดูแลโดยตรง', tone: readyRuntimes === runtimeRows.length ? 'success' : 'warning' },
        { label: 'เอเจนต์ที่ออนไลน์', value: formatNumber((Array.isArray(state.agents) ? state.agents : []).filter((row) => toneForStatus(row.status) === 'success').length, '0'), detail: `${formatNumber(listCount(state.agents), '0')} รันไทม์ที่ลงทะเบียนไว้`, tone: 'success' },
        { label: 'เหตุการณ์ที่เปิดอยู่', value: formatNumber(listCount(state.notifications) + listCount(state.incidentInbox), '0'), detail: `${formatNumber(listCount(state.securityEvents), '0')} สัญญาณด้านความปลอดภัย`, tone: listCount(state.notifications) > 0 ? 'warning' : 'muted' },
        { label: 'อัตราส่งของสำเร็จ', value: `${formatNumber(delivery.successRate, '0')}%`, detail: `${formatNumber(delivery.purchaseCount30d, '0')} คำสั่งซื้อในช่วง 30 วัน`, tone: 'success' },
        { label: 'มุมมองเชิงพาณิชย์', value: Number(subscriptions.mrr) > 0 ? `฿${formatNumber(subscriptions.mrr, '0')}` : formatNumber(expiringCount, '0'), detail: Number(subscriptions.mrr) > 0 ? 'รายได้ประจำที่ตรวจจับได้' : 'มีรายการที่ใกล้ต่ออายุ', tone: expiringCount > 0 ? 'danger' : 'info' },
      ],
      actionGroups: ACTION_GROUPS,
      attentionRows: buildAttentionRows(state),
      incidentFeed: feed,
      railCards: [
        { title: 'ภาพรวมเชิงพาณิชย์', body: expiringCount > 0 ? `${formatNumber(expiringCount, '0')} รายการใกล้ต่ออายุหรือหมดอายุ` : 'ตอนนี้ยังไม่เห็นแรงกดดันด้านการต่ออายุที่ต้องรีบจัดการ', meta: Number(subscriptions.mrr) > 0 ? `รายได้ที่ติดตามได้ ฿${formatNumber(subscriptions.mrr, '0')}` : 'ใช้หน้านี้ทบทวนแพ็กเกจและการสมัครใช้', tone: expiringCount > 0 ? 'danger' : 'success' },
        { title: 'คิวซัพพอร์ต', body: state.supportCase && state.supportCase.signals ? `${formatNumber(state.supportCase.signals.total, '0')} สัญญาณถูกผูกกับเคสที่กำลังดูอยู่` : 'ตอนนี้คิวซัพพอร์ตค่อนข้างสงบ', meta: 'เปิดดู support และ diagnostics ก่อนแตะ runtime หรือโควตา', tone: state.supportCase ? 'warning' : 'muted' },
        { title: 'จุดร้อนของระบบสังเกตการณ์', body: hotspot ? `${hotspot.routeGroup || hotspot.samplePath || '/'} · p95 ${formatNumber(hotspot.p95LatencyMs, '0')} ms` : 'ยังไม่มีสรุป hotspot จากตัวอย่างคำขอชุดล่าสุด', meta: hotspot ? `${formatNumber(hotspot.requests, '0')} คำขอ · ${formatNumber(hotspot.errors, '0')} ข้อผิดพลาด` : 'รีเฟรชหน้าสังเกตการณ์เพื่อเติมข้อมูลส่วนนี้', tone: hotspot && hotspot.errors > 0 ? 'warning' : 'info' },
      ],
    };
  }

  function renderNavGroups(groups) {
    return (Array.isArray(groups) ? groups : []).map((group) => [
      '<section class="odv4-nav-group">',
      `<span class="odv4-nav-group-label">${escapeHtml(group.label || '')}</span>`,
      '<div class="odv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items : []).map((item) => {
        const className = item.current ? 'odv4-nav-link odv4-nav-link-current' : 'odv4-nav-link';
        return `<a class="${className}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label || '')}</a>`;
      }),
      '</div></section>',
    ].join('')).join('');
  }
  function renderChips(items) {
    return (Array.isArray(items) ? items : []).map((item) => `<span class="odv4-badge odv4-badge-${escapeHtml(item.tone || 'muted')}">${escapeHtml(item.label || '')}</span>`).join('');
  }
  function renderKpis(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-kpi odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-kpi-label">${escapeHtml(item.label || '')}</span>`,
      `<strong class="odv4-kpi-value">${escapeHtml(item.value || '-')}</strong>`,
      `<p class="odv4-kpi-detail">${escapeHtml(item.detail || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }
  function renderActionGroups(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-task-group odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-task-tag">${escapeHtml(item.tag || '')}</span>`,
      `<h3 class="odv4-section-title">${escapeHtml(item.title || '')}</h3>`,
      `<p class="odv4-section-copy">${escapeHtml(item.detail || '')}</p>`,
      '<div class="odv4-action-list">',
      ...(Array.isArray(item.actions) ? item.actions : []).map((action) => `<a class="${action.primary ? 'odv4-button odv4-button-primary' : 'odv4-button odv4-button-secondary'}" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`),
      '</div></article>',
    ].join('')).join('');
  }
  function renderAttentionRows(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state">ยังไม่มีผู้เช่าที่ต้องจับตาในตัวอย่างปัจจุบัน</div>';
    return items.map((item) => [
      `<article class="odv4-list-item odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="odv4-list-main"><strong>${escapeHtml(item.name || '-')}</strong><p>${escapeHtml(item.detail || '')}</p></div>`,
      `<div class="odv4-list-side"><span class="odv4-pill odv4-pill-${escapeHtml(item.tone || 'muted')}">${escapeHtml(item.packageName || '-')}</span><span class="odv4-list-meta">${escapeHtml(item.meta || '')}</span></div>`,
      '</article>',
    ].join('')).join('');
  }
  function renderFeed(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state">ยังไม่มีสัญญาณใหม่ที่เจ้าของระบบต้องเปิดดูในตัวอย่างปัจจุบัน</div>';
    return items.map((item) => [
      `<article class="odv4-feed-item odv4-tone-${escapeHtml(toneForStatus(item.severity || 'warning'))}">`,
      `<div class="odv4-feed-meta"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(item.severity || 'warning'))}">${escapeHtml(item.source || 'signal')}</span><span>${escapeHtml(formatDateTime(item.time))}</span></div>`,
      `<strong>${escapeHtml(item.title || 'Signal')}</strong>`,
      item.detail ? `<p>${escapeHtml(item.detail)}</p>` : '',
      '</article>',
    ].join('')).join('');
  }
  function renderRailCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-rail-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<h4 class="odv4-rail-title">${escapeHtml(item.title || '')}</h4>`,
      `<p class="odv4-rail-copy">${escapeHtml(item.body || '')}</p>`,
      `<div class="odv4-rail-detail">${escapeHtml(item.meta || '')}</div>`,
      '</article>',
    ].join('')).join('');
  }

  function buildOwnerDashboardV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : createOwnerDashboardV4Model({});
    return [
      '<div class="odv4-app"><header class="odv4-topbar"><div class="odv4-brand-row">',
      `<div class="odv4-brand-mark">${escapeHtml(safeModel.shell.brand || 'SCUM')}</div>`,
      `<div class="odv4-brand-copy"><span class="odv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel || '')}</span><strong class="odv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel || '')}</strong></div>`,
      '</div><div class="odv4-topbar-actions">',
      `<span class="odv4-badge odv4-badge-muted">${escapeHtml(safeModel.shell.environmentLabel || '')}</span>`,
      '<a class="odv4-button odv4-button-secondary" href="#tenants">ผู้เช่า</a>',
      '<a class="odv4-button odv4-button-secondary" href="#runtime-health">รันไทม์</a>',
      '</div></header>',
      '<div class="odv4-shell"><aside class="odv4-sidebar"><div class="odv4-stack"><span class="odv4-sidebar-title">เมนูเจ้าของระบบ</span><p class="odv4-sidebar-copy">ใช้หน้านี้เพื่อตัดสินใจเรื่องผู้เช่า รายได้ ความปลอดภัย และความพร้อมของรันไทม์ โดยไม่ต้องไล่เปิดหลายส่วนของระบบ</p></div>',
      renderNavGroups(safeModel.shell.navGroups),
      '</aside><main class="odv4-main">',
      '<section class="odv4-pagehead"><div class="odv4-stack"><span class="odv4-section-kicker">ศูนย์ควบคุมเจ้าของระบบ</span>',
      `<h1 class="odv4-page-title">${escapeHtml(safeModel.header.title || '')}</h1><p class="odv4-page-subtitle">${escapeHtml(safeModel.header.subtitle || '')}</p><div class="odv4-chip-row">${renderChips(safeModel.header.statusChips)}</div></div>`,
      `<div class="odv4-pagehead-actions"><a class="odv4-button odv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label || 'Open')}</a></div></section>`,
      `<section class="odv4-kpi-strip">${renderKpis(safeModel.kpis)}</section>`,
      '<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">เริ่มจากตรงนี้</span><h2 class="odv4-section-title">เลือก workflow ให้ตรงกับงาน</h2><p class="odv4-section-copy">แต่ละกลุ่มด้านล่างถูกจัดไว้เพื่อลดการเดา เริ่มจากเส้นทางที่ตรงกับปัญหาที่กำลังเจอแทนการเปิดทุกหน้าไล่ดู</p></div>',
      `<div class="odv4-task-grid">${renderActionGroups(safeModel.actionGroups)}</div></section>`,
      '<div class="odv4-split-grid"><section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">ต้องดูต่อ</span><h2 class="odv4-section-title">ผู้เช่าที่เจ้าของระบบควรเปิดดูก่อน</h2><p class="odv4-section-copy">ลิสต์สั้นนี้ช่วยตอบทันทีว่าใครควรได้รับการดูแลต่อ โดยไม่ต้องไล่เปิดทั้ง registry</p></div>',
      `<div class="odv4-list">${renderAttentionRows(safeModel.attentionRows)}</div></section>`,
      '<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">สัญญาณล่าสุด</span><h2 class="odv4-section-title">เหตุการณ์และการแจ้งเตือนที่เพิ่งเกิดขึ้น</h2><p class="odv4-section-copy">รวมเหตุการณ์จาก monitoring, request pressure และสัญญาณด้านความปลอดภัยที่เจ้าของระบบควรรู้ก่อน</p></div>',
      `<div class="odv4-feed">${renderFeed(safeModel.incidentFeed)}</div></section></div></main>`,
      `<aside class="odv4-rail"><div class="odv4-rail-sticky"><div class="odv4-rail-header">บริบทเจ้าของระบบ</div><p class="odv4-rail-copy">คุมแรงกดดันด้านรายได้ ซัพพอร์ต และจุดเสี่ยงของแพลตฟอร์มไว้ข้างมือระหว่างทำงาน</p>${renderRailCards(safeModel.railCards)}</div></aside>`,
      '</div></div>',
    ].join('');
  }

  function renderOwnerDashboardV4(target, source) {
    if (!target) throw new Error('Owner dashboard V4 target is required');
    target.innerHTML = buildOwnerDashboardV4Html(createOwnerDashboardV4Model(source));
    return target;
  }

  return {
    createOwnerDashboardV4Model,
    buildOwnerDashboardV4Html,
    renderOwnerDashboardV4,
  };
});
