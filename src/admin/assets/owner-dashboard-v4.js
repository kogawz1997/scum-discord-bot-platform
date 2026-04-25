(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerDashboardV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const MOJIBAKE_TOKEN_PATTERN = /[\u00C3\u00C2\u00E0\u00E2][^<>"'=\s]*/g;
  const UTF8_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;
  const MOJIBAKE_REPLACEMENTS = [];
  const CP1252_REVERSE_MAP = new Map([
    [0x20AC, 0x80],
    [0x201A, 0x82],
    [0x0192, 0x83],
    [0x201E, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02C6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8A],
    [0x2039, 0x8B],
    [0x0152, 0x8C],
    [0x017D, 0x8E],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201C, 0x93],
    [0x201D, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02DC, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9A],
    [0x203A, 0x9B],
    [0x0153, 0x9C],
    [0x017E, 0x9E],
    [0x0178, 0x9F],
  ]);

  function decodeLatin1Utf8(text) {
    const source = String(text ?? '');
    try {
      if (!UTF8_DECODER) return source;
      const decoded = UTF8_DECODER.decode(Uint8Array.from(Array.from(source, (ch) => {
        const codePoint = ch.codePointAt(0);
        return CP1252_REVERSE_MAP.get(codePoint) ?? (codePoint & 0xff);
      })));
      return decoded.replace(/[\u0000-\u001f]/g, '');
    } catch {
      return source;
    }
  }

  function repairMojibakeText(value) {
    let output = String(value ?? '');
    for (let index = 0; index < 3; index += 1) {
      const next = output.replace(MOJIBAKE_TOKEN_PATTERN, (token) => decodeLatin1Utf8(token));
      if (next === output) break;
      output = next;
    }
    for (const [needle, replacement] of MOJIBAKE_REPLACEMENTS) {
      output = output.replaceAll(needle, replacement);
    }
    return output;
  }

  const NAV_GROUPS = [
    { label: 'แพลตฟอร์ม', items: [
      { label: 'ภาพรวม', href: '#overview', current: true },
      { label: 'ลูกค้า', href: '#tenants' },
      { label: 'แพ็กเกจ', href: '#packages' },
      { label: 'การสมัครใช้', href: '#subscriptions' },
    ] },
    { label: 'ปฏิบัติการ', items: [
      { label: 'สถานะบริการ', href: '#runtime-health' },
      { label: 'เหตุการณ์', href: '#incidents' },
      { label: 'งานคิว', href: '#jobs' },
      { label: 'บันทึกและออดิท', href: '#audit' },
    ] },
    { label: 'ธุรกิจ', items: [
      { label: 'การเงิน', href: '#billing' },
      { label: 'งานดูแลลูกค้า', href: '#support' },
      { label: 'ความปลอดภัย', href: '#security' },
      { label: 'ตั้งค่า', href: '#settings' },
    ] },
  ];

  const ACTION_GROUPS = [
    { tone: 'warning', tag: 'งานด่วน', title: 'งานดูแลลูกค้าและเหตุการณ์', detail: 'เริ่มจากเรื่องที่กระทบลูกค้าก่อน', actions: [
      { label: 'เปิดกล่องเหตุการณ์', href: '#incidents', primary: true },
      { label: 'เปิดงานดูแลลูกค้า', href: '#support' },
      { label: 'ดูงานรอและบอท', href: '#jobs' },
    ] },
    { tone: 'info', tag: 'หลักฐาน', title: 'ความปลอดภัยและบันทึก', detail: 'ใช้เมื่ออยากยืนยันสิทธิ์หรือย้อนดูหลักฐาน', actions: [
      { label: 'เปิดบันทึกออดิท', href: '#audit', primary: true },
      { label: 'ดูเซสชันและสิทธิ์', href: '#security' },
      { label: 'ดูสถานะบริการ', href: '#runtime-health' },
    ] },
    { tone: 'success', tag: 'ธุรกิจ', title: 'รายได้และสถานะการขาย', detail: 'ใช้ดูการต่ออายุ โควตา และแผนของลูกค้า', actions: [
      { label: 'ดูลูกค้า', href: '#tenants', primary: true },
      { label: 'เช็กการต่ออายุ', href: '#subscriptions' },
      { label: 'เปิดหน้าแพ็กเกจ', href: '#packages' },
    ] },
  ];

  const SETTINGS_ACTION_GROUPS = [
    { tone: 'info', tag: 'นโยบาย', title: 'ตั้งค่าและมาตรฐานกลาง', detail: 'ใช้เมื่อต้องตั้งกติกาที่มีผลกับลูกค้าหลายราย', actions: [
      { label: 'เปิดหน้าตั้งค่า', href: '#settings', primary: true },
      { label: 'ดูความปลอดภัย', href: '#security' },
      { label: 'เปิดบันทึกออดิท', href: '#audit' },
    ] },
    { tone: 'warning', tag: 'สิทธิ์', title: 'สิทธิ์และการเข้าถึง', detail: 'ใช้ตรวจสิทธิ์ เซสชัน และหลักฐานก่อนเปลี่ยนนโยบาย', actions: [
      { label: 'เปิดความปลอดภัย', href: '#security', primary: true },
      { label: 'เปิดออดิท', href: '#audit' },
      { label: 'ดูสถานะบริการ', href: '#runtime-health' },
    ] },
    { tone: 'success', tag: 'ผลกระทบ', title: 'ลูกค้าและแพ็กเกจที่เกี่ยวข้อง', detail: 'ใช้ดูว่าการเปลี่ยนนโยบายจะกระทบลูกค้ารายใดหรือแผนใดก่อนลงมือ', actions: [
      { label: 'ดูลูกค้า', href: '#tenants', primary: true },
      { label: 'ดูแพ็กเกจ', href: '#packages' },
      { label: 'ดูการสมัครใช้', href: '#subscriptions' },
    ] },
  ];

  const DASHBOARD_CLASS_MENUS = [
    {
      id: 'commercial',
      kicker: 'Class 01',
      label: 'Customer & Revenue',
      summary: 'Tenants, packages, renewals, billing, and customer follow-up.',
      items: [
        { label: 'Lane briefing', href: '#lane-commercial', localFocus: true },
        { label: 'Tenant portfolio', href: '#tenants' },
        { label: 'Packages', href: '#packages' },
        { label: 'Subscriptions', href: '#subscriptions' },
        { label: 'Billing', href: '#billing' },
        { label: 'Support', href: '#support' },
      ],
    },
    {
      id: 'operations',
      kicker: 'Class 02',
      label: 'Operations & Governance',
      summary: 'Runtime health, incidents, jobs, audit, security, and platform policy.',
      items: [
        { label: 'Lane briefing', href: '#lane-operations', localFocus: true },
        { label: 'Runtime', href: '#runtime-health' },
        { label: 'Incidents', href: '#incidents' },
        { label: 'Jobs', href: '#jobs' },
        { label: 'Audit', href: '#audit' },
        { label: 'Security', href: '#security' },
        { label: 'Settings', href: '#settings' },
      ],
    },
  ];

  const COMMERCIAL_DASHBOARD_ROUTES = new Set([
    'overview',
    'dashboard',
    'commercial',
    'tenants',
    'packages',
    'subscriptions',
    'billing',
    'support',
    'quota',
  ]);

  const OPERATIONS_DASHBOARD_ROUTES = new Set([
    'settings',
    'runtime',
    'runtime-health',
    'agents-bots',
    'fleet-diagnostics',
    'incidents',
    'jobs',
    'audit',
    'security',
    'automation',
    'recovery',
    'control',
    'access',
    'diagnostics',
    'analytics',
    'observability',
  ]);

  function cloneNavGroups(groups, currentRoute) {
    const route = String(currentRoute || 'overview').trim().toLowerCase() || 'overview';
    return (Array.isArray(groups) ? groups : []).map((group) => ({
      ...group,
      items: (Array.isArray(group.items) ? group.items : []).map((item) => {
        const itemRoute = String(item && item.href || '').replace(/^#/, '').trim().toLowerCase();
        return {
          ...item,
          current: itemRoute === route,
        };
      }),
    }));
  }

  function resolveDashboardClassForRoute(currentRoute) {
    const route = String(currentRoute || '').trim().toLowerCase();
    if (OPERATIONS_DASHBOARD_ROUTES.has(route)) return 'operations';
    return 'commercial';
  }

  function cloneDashboardClassMenus(groups, currentRoute, activeClass) {
    const route = String(currentRoute || 'overview').trim().toLowerCase() || 'overview';
    const selectedClass = String(activeClass || resolveDashboardClassForRoute(route)).trim().toLowerCase() || 'commercial';
    return (Array.isArray(groups) ? groups : []).map((group) => {
      const groupId = String(group && group.id || '').trim().toLowerCase();
      const items = (Array.isArray(group.items) ? group.items : []).map((item) => {
        const itemRoute = item && item.localFocus
          ? ''
          : String(item && item.href || '').replace(/^#/, '').trim().toLowerCase();
        return {
          ...item,
          current: Boolean(itemRoute) && itemRoute === route,
        };
      });
      return {
        ...group,
        current: groupId === selectedClass || items.some((item) => item.current),
        expanded: groupId === selectedClass,
        items,
      };
    });
  }

  function escapeHtml(value) {
    return repairMojibakeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
  function localizeOwnerDashboardText(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const exact = {
      requests: 'คำขอ',
      alerts: 'การแจ้งเตือน',
      security: 'ความปลอดภัย',
      direct: 'ขายตรง',
      trial: 'ทดลองใช้',
      reseller: 'ตัวแทนขาย',
      demo: 'สาธิต',
      active: 'ใช้งานอยู่',
      trialing: 'กำลังทดลองใช้',
      suspended: 'ระงับไว้',
      'Platform Event: agent heartbeat': 'เหตุการณ์แพลตฟอร์ม: สัญญาณการทำงานของบอท',
      'Delivery Reconcile Anomaly': 'ความผิดปกติของการกระทบยอดการส่งของ',
    };
    if (exact[text]) return exact[text];
    return text
      .replaceAll('Platform Event:', 'เหตุการณ์แพลตฟอร์ม:')
      .replaceAll('agent heartbeat', 'สัญญาณการทำงานของบอท')
      .replaceAll('support', 'งานดูแลลูกค้า')
      .replaceAll('diagnostics', 'วินิจฉัยระบบ')
      .replaceAll('runtime', 'บอท')
      .replaceAll('direct', 'ขายตรง')
      .replaceAll('trial', 'ทดลองใช้')
      .replaceAll('requests', 'คำขอ')
      .replaceAll('alerts', 'การแจ้งเตือน')
      .replaceAll('apiKeys', 'คีย์ API')
      .replaceAll('webhooks', 'เว็บฮุก')
      .replaceAll('invoice', 'ใบแจ้งหนี้')
      .replaceAll('platform-api', 'ระบบ API แพลตฟอร์ม');
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
    if (requestPath.startsWith('/admin/api/runtime/')) return `${method} บริการระบบ · ${requestPath}`;
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
      name: tenant.name || tenant.slug || tenantId || 'ลูกค้าที่ไม่ทราบชื่อ',
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

  function createOwnerDashboardV4Model(source, options = {}) {
    const state = source && typeof source === 'object' ? source : {};
    const currentRoute = String(options.currentRoute || 'overview').trim().toLowerCase() || 'overview';
    const activeClass = resolveDashboardClassForRoute(currentRoute);
    const runtimeRows = normalizeRuntimeRows(state.runtimeSupervisor);
    const readyRuntimes = runtimeRows.filter((row) => toneForStatus(row.status) === 'success').length;
    const analytics = state.overview && state.overview.analytics ? state.overview.analytics : {};
    const tenants = analytics.tenants || {};
    const delivery = analytics.delivery || {};
    const subscriptions = analytics.subscriptions || {};
    const hotspot = buildHotspot(state);
    const feed = buildIncidentFeed(state);
    const attentionRows = buildAttentionRows(state);
    const expiringCount = (Array.isArray(state.subscriptions) ? state.subscriptions : []).filter((row) => {
      const renewsAt = parseDate(row.renewsAt || row.expiresAt || row.endsAt);
      return renewsAt && (renewsAt.getTime() - Date.now()) <= 1000 * 60 * 60 * 24 * 14;
    }).length;
    const degradedRuntimeCount = Math.max(runtimeRows.length - readyRuntimes, 0);
    const openSignalCount = listCount(state.notifications) + listCount(state.incidentInbox) + listCount(state.securityEvents);
    const settingsRoute = currentRoute === 'settings';
    const primaryAction = expiringCount > 0
      ? { label: 'ดูรายการใกล้ต่ออายุ (แนะนำ)', href: '#subscriptions' }
      : feed.length > 0
        ? { label: 'เปิดกล่องเหตุการณ์ (แนะนำ)', href: '#incidents' }
        : { label: 'เปิดรายชื่อลูกค้า', href: '#tenants' };
    let decisionPanel = expiringCount > 0
      ? {
          title: 'เริ่มจากรายการใกล้ต่ออายุ',
          detail: 'ตรวจรายการที่ใกล้หมดอายุก่อน เพื่อไม่ให้บริการสะดุดและไม่ให้งานดูแลลูกค้าเพิ่ม',
          primaryAction,
          secondaryActions: [
            { label: 'ดูลูกค้าที่ต้องติดตาม', href: '#tenants' },
            { label: 'ดูสถานะบริการ', href: '#runtime-health' },
            { label: 'เปิดบันทึกออดิท', href: '#audit' },
          ],
          checkpoints: [
            { label: 'ใกล้ต่ออายุ', value: `${formatNumber(expiringCount, '0')} ราย`, detail: 'ควรเปิดดูก่อน', tone: 'danger' },
            { label: 'ลูกค้าที่ต้องตาม', value: `${formatNumber(attentionRows.length, '0')} ราย`, detail: 'ลิสต์สั้นที่ควรเปิดต่อ', tone: attentionRows.length > 0 ? 'warning' : 'muted' },
            { label: 'สัญญาณเปิดอยู่', value: `${formatNumber(openSignalCount, '0')} รายการ`, detail: 'รวมแจ้งเตือนหลัก', tone: openSignalCount > 0 ? 'warning' : 'success' },
          ],
        }
      : degradedRuntimeCount > 0
        ? {
            title: 'มีบริการที่ยังไม่พร้อม',
            detail: 'ตรวจบริการที่ยังมีปัญหาก่อนแตะคิวลูกค้าหรือสั่งงานต่อ',
            primaryAction,
            secondaryActions: [
              { label: 'ดูเหตุการณ์ล่าสุด', href: '#incidents' },
              { label: 'ดูลูกค้าที่ได้รับผลกระทบ', href: '#tenants' },
              { label: 'เปิดหน้าความปลอดภัย', href: '#security' },
            ],
            checkpoints: [
              { label: 'บริการที่ต้องตาม', value: `${formatNumber(degradedRuntimeCount, '0')} บริการ`, detail: 'ยืนยัน heartbeat ก่อน', tone: 'warning' },
              { label: 'สัญญาณใหม่', value: `${formatNumber(feed.length, '0')} รายการ`, detail: 'มีเรื่องที่ควรเปิดดู', tone: feed.length > 0 ? 'warning' : 'muted' },
              { label: 'ลูกค้าที่ใช้งานอยู่', value: `${formatNumber(tenants.active || listCount(state.tenants), '0')} ราย`, detail: 'ใช้ประเมินผลกระทบ', tone: 'info' },
            ],
          }
        : {
            title: 'ภาพรวมวันนี้พร้อมดูแล',
            detail: 'ถ้าไม่มีเรื่องเร่งด่วน ให้เริ่มจากลูกค้าที่ต้องติดตามหรือรายการธุรกิจสำคัญ',
            primaryAction,
            secondaryActions: [
              { label: 'เปิดรายชื่อลูกค้า', href: '#tenants' },
              { label: 'ดูแพ็กเกจและการสมัครใช้', href: '#subscriptions' },
              { label: 'เปิดกล่องเหตุการณ์', href: '#incidents' },
            ],
            checkpoints: [
              { label: 'รายได้ที่ติดตามได้', value: Number(subscriptions.mrr) > 0 ? `฿${formatNumber(subscriptions.mrr, '0')}` : 'ยังไม่มีข้อมูล', detail: 'รายได้ประจำของแพลตฟอร์ม', tone: 'success' },
              { label: 'ลูกค้าที่ใช้งานอยู่', value: `${formatNumber(tenants.active || listCount(state.tenants), '0')} ราย`, detail: 'ลูกค้าที่กำลังเปิดบริการ', tone: 'info' },
              { label: 'สัญญาณใหม่', value: `${formatNumber(openSignalCount, '0')} รายการ`, detail: 'ถ้าไม่มี ให้เดินงานต่อได้', tone: openSignalCount > 0 ? 'warning' : 'success' },
            ],
          };
    if (settingsRoute) {
      decisionPanel = {
        title: 'เริ่มจากนโยบายและค่าที่ต้องคุมให้ตรงกัน',
        detail: 'ใช้หน้าตั้งค่าเมื่อต้องกำหนดกติกากลาง สิทธิ์ และมาตรฐานที่กระทบลูกค้าหลายรายพร้อมกัน ไม่ใช่แก้เคสเฉพาะราย',
        primaryAction: { label: 'เปิดหน้าตั้งค่า (แนะนำ)', href: '#settings' },
        secondaryActions: [
          { label: 'ดูความปลอดภัย', href: '#security' },
          { label: 'เปิดออดิท', href: '#audit' },
          { label: 'ดูกลุ่มลูกค้าที่ได้รับผล', href: '#tenants' },
        ],
        checkpoints: [
          { label: 'นโยบายที่ต้องทบทวน', value: `${formatNumber(openSignalCount, '0')} ประเด็น`, detail: 'รวมสัญญาณที่ควรยืนยันก่อนเปลี่ยนนโยบาย', tone: openSignalCount > 0 ? 'warning' : 'muted' },
          { label: 'ลูกค้าที่อาจได้รับผล', value: `${formatNumber(attentionRows.length, '0')} ราย`, detail: 'ใช้ดูผลกระทบก่อนเปลี่ยนค่าแบบกว้าง', tone: attentionRows.length > 0 ? 'info' : 'muted' },
          { label: 'บริการที่ต้องระวัง', value: `${formatNumber(degradedRuntimeCount, '0')} บริการ`, detail: 'ยืนยันสุขภาพบริการก่อนใช้การเปลี่ยนแปลงกับทั้งระบบ', tone: degradedRuntimeCount > 0 ? 'warning' : 'success' },
        ],
      };
    }
    const commercialCards = [
      {
        title: 'Renewal pressure',
        body: expiringCount > 0
          ? `${formatNumber(expiringCount, '0')} subscriptions need review within 14 days.`
          : 'No urgent renewals are currently stacked against the commercial lane.',
        meta: Number(subscriptions.mrr) > 0
          ? `Tracked recurring revenue ฿${formatNumber(subscriptions.mrr, '0')}`
          : 'Recurring revenue is not populated yet.',
        tone: expiringCount > 0 ? 'warning' : 'success',
      },
      {
        title: 'Customer follow-up',
        body: attentionRows.length > 0
          ? `${formatNumber(attentionRows.length, '0')} accounts need operator review before they drift.`
          : 'Customer follow-up is currently quiet.',
        meta: state.supportCase && state.supportCase.signals
          ? `${formatNumber(state.supportCase.signals.total, '0')} support-linked signals are open.`
          : 'Support signals are not pulling extra pressure right now.',
        tone: attentionRows.length > 0 ? 'info' : 'muted',
      },
    ];
    const operationsCards = [
      {
        title: 'Runtime watch',
        body: degradedRuntimeCount > 0
          ? `${formatNumber(degradedRuntimeCount, '0')} services need attention before platform work expands.`
          : 'Core runtime services are currently steady.',
        meta: runtimeRows.length > 0
          ? `${formatNumber(readyRuntimes, '0')}/${formatNumber(runtimeRows.length, '0')} runtime services are ready.`
          : 'Runtime inventory has not been loaded yet.',
        tone: degradedRuntimeCount > 0 ? 'warning' : 'success',
      },
      {
        title: 'Signal pressure',
        body: feed.length > 0
          ? `${formatNumber(feed.length, '0')} open signals are waiting for triage or verification.`
          : 'No open platform signals are currently queued.',
        meta: hotspot
          ? `Slowest path ${hotspot.routeGroup || hotspot.samplePath || '/'} at ${formatNumber(hotspot.p95LatencyMs, '0')} ms p95.`
          : 'No hotspot route has been promoted into the dashboard yet.',
        tone: feed.length > 0 || degradedRuntimeCount > 0 ? 'warning' : 'muted',
      },
    ];
    const classSections = [
      {
        id: 'commercial',
        anchorId: 'lane-commercial',
        focusRoutes: 'overview dashboard tenants packages subscriptions billing support',
        kicker: 'Class 01',
        title: 'Customer & Revenue lane',
        subtitle: 'Keep tenant portfolio, package fit, renewals, billing, and customer follow-up in one working lane.',
        switchLabel: 'Open operations lane',
        switchTarget: 'operations',
        metrics: [
          { label: 'Recurring revenue', value: Number(subscriptions.mrr) > 0 ? `฿${formatNumber(subscriptions.mrr, '0')}` : 'No feed', detail: 'Tracked monthly revenue baseline', tone: Number(subscriptions.mrr) > 0 ? 'success' : 'muted' },
          { label: 'Renewals in 14 days', value: formatNumber(expiringCount, '0'), detail: expiringCount > 0 ? 'Accounts that should be handled next' : 'No near-term renewal pressure', tone: expiringCount > 0 ? 'warning' : 'success' },
          { label: 'Accounts to review', value: formatNumber(attentionRows.length, '0'), detail: 'Portfolio items already showing friction', tone: attentionRows.length > 0 ? 'info' : 'muted' },
        ],
        actionGroups: [
          {
            tone: 'success',
            tag: 'Portfolio',
            title: 'Tenant portfolio',
            detail: 'Move between the customer list, package mix, and portfolio health without leaving the lane.',
            actions: [
              { label: 'Open tenants', href: '#tenants', primary: true },
              { label: 'Open packages', href: '#packages' },
              { label: 'Open subscriptions', href: '#subscriptions' },
            ],
          },
          {
            tone: 'warning',
            tag: 'Revenue',
            title: 'Renewals and billing',
            detail: 'Check expiring subscriptions, invoice pressure, and payment recovery from one block.',
            actions: [
              { label: 'Open billing', href: '#billing', primary: true },
              { label: 'Review renewals', href: '#subscriptions' },
              { label: 'Open support', href: '#support' },
            ],
          },
        ],
        primaryPanel: {
          kicker: 'Needs review',
          title: 'Accounts to open next',
          copy: 'A short list of customers that are closest to needing direct owner attention.',
          type: 'attention',
        },
        secondaryPanel: {
          kicker: 'Commercial context',
          title: 'Customer lane context',
          copy: 'Use the side cards to see whether the commercial lane is a revenue problem, a support problem, or both.',
          cards: commercialCards,
        },
      },
      {
        id: 'operations',
        anchorId: 'lane-operations',
        focusRoutes: 'settings runtime runtime-health agents-bots fleet-diagnostics incidents jobs audit security automation recovery control access diagnostics analytics observability',
        kicker: 'Class 02',
        title: 'Operations & Governance lane',
        subtitle: 'Hold runtime health, incidents, audit evidence, security posture, and policy changes in a separate operator lane.',
        switchLabel: 'Back to customer lane',
        switchTarget: 'commercial',
        metrics: [
          { label: 'Runtime ready', value: `${formatNumber(readyRuntimes, '0')}/${formatNumber(runtimeRows.length, '0')}`, detail: 'Services reporting healthy state now', tone: readyRuntimes === runtimeRows.length ? 'success' : 'warning' },
          { label: 'Open signals', value: formatNumber(openSignalCount, '0'), detail: 'Notifications, incidents, and security signals', tone: openSignalCount > 0 ? 'warning' : 'muted' },
          { label: 'Incident feed', value: formatNumber(feed.length, '0'), detail: feed.length > 0 ? 'Signals that still need triage' : 'No new feed items in this snapshot', tone: feed.length > 0 ? 'info' : 'success' },
        ],
        actionGroups: [
          {
            tone: 'info',
            tag: 'Runtime',
            title: 'Runtime control',
            detail: 'Open runtime inventory, diagnostics, and recovery without mixing it into the customer lane.',
            actions: [
              { label: 'Open runtime', href: '#runtime-health', primary: true },
              { label: 'Agents & bots', href: '#agents-bots' },
              { label: 'Fleet diagnostics', href: '#fleet-diagnostics' },
            ],
          },
          {
            tone: 'warning',
            tag: 'Response',
            title: 'Incidents and recovery',
            detail: 'Use the response lane for incident triage, queued jobs, and recovery work.',
            actions: [
              { label: 'Open incidents', href: '#incidents', primary: true },
              { label: 'Open jobs', href: '#jobs' },
              { label: 'Open recovery', href: '#recovery' },
            ],
          },
          {
            tone: 'muted',
            tag: 'Governance',
            title: 'Audit and policy',
            detail: 'Keep security, audit, and settings in the same governance lane.',
            actions: [
              { label: 'Open audit', href: '#audit', primary: true },
              { label: 'Open security', href: '#security' },
              { label: 'Open settings', href: '#settings' },
            ],
          },
        ],
        primaryPanel: {
          kicker: 'Signal feed',
          title: 'Recent incidents and alerts',
          copy: 'A tighter feed for platform signals, incident notices, and runtime anomalies.',
          type: 'feed',
        },
        secondaryPanel: {
          kicker: 'Operations context',
          title: 'Platform lane context',
          copy: 'Keep the operational lane focused on service readiness, signal pressure, and route hotspots.',
          cards: operationsCards,
        },
      },
    ];
    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงเจ้าของระบบ',
        workspaceLabel: 'ศูนย์ควบคุมแพลตฟอร์ม',
        environmentLabel: 'ระดับแพลตฟอร์ม',
        navGroups: cloneNavGroups(NAV_GROUPS, currentRoute),
        navClasses: cloneDashboardClassMenus(DASHBOARD_CLASS_MENUS, currentRoute, activeClass),
        activeClass,
      },
      header: {
        title: 'ภาพรวมเจ้าของระบบ',
        subtitle: 'ดูลูกค้า รายได้ สุขภาพระบบ และเรื่องที่ควรจัดการก่อนจากหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(tenants.total || listCount(state.tenants), '0')} ลูกค้า`, tone: 'info' },
          { label: `${formatNumber(readyRuntimes, '0')}/${formatNumber(runtimeRows.length, '0')} บริการพร้อม`, tone: readyRuntimes === runtimeRows.length ? 'success' : 'warning' },
          { label: `${formatNumber(feed.length, '0')} สัญญาณที่ยังเปิดอยู่`, tone: feed.length > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(expiringCount, '0')} รายใกล้ต่ออายุ`, tone: expiringCount > 0 ? 'danger' : 'muted' },
        ],
        primaryAction,
      },
      kpis: [
        { label: 'รายได้ประจำ', value: Number(subscriptions.mrr) > 0 ? `฿${formatNumber(subscriptions.mrr, '0')}` : 'ยังไม่มีข้อมูล', detail: expiringCount > 0 ? `${formatNumber(expiringCount, '0')} รายใกล้ต่ออายุ` : 'รายได้ที่ติดตามได้', tone: expiringCount > 0 ? 'danger' : 'info' },
        { label: 'ลูกค้าที่ใช้งานอยู่', value: formatNumber(tenants.active || listCount(state.tenants), '0'), detail: `${formatNumber(tenants.trialing, '0')} ทดลอง · ${formatNumber(tenants.reseller, '0')} ตัวแทน`, tone: 'info' },
        { label: 'ใกล้ต่ออายุ', value: formatNumber(expiringCount, '0'), detail: expiringCount > 0 ? 'ควรเปิดดูก่อน' : 'ยังไม่มีรายการเร่งด่วน', tone: expiringCount > 0 ? 'danger' : 'success' },
        { label: 'บริการพร้อม', value: `${formatNumber(readyRuntimes, '0')}/${formatNumber(runtimeRows.length, '0')}`, detail: 'บริการหลักของแพลตฟอร์ม', tone: readyRuntimes === runtimeRows.length ? 'success' : 'warning' },
        { label: 'สัญญาณเปิดอยู่', value: formatNumber(openSignalCount, '0'), detail: `${formatNumber(listCount(state.securityEvents), '0')} สัญญาณความปลอดภัย`, tone: openSignalCount > 0 ? 'warning' : 'muted' },
        { label: 'อัตราส่งของสำเร็จ', value: `${formatNumber(delivery.successRate, '0')}%`, detail: `${formatNumber(delivery.purchaseCount30d, '0')} คำสั่งซื้อในช่วง 30 วัน`, tone: 'success' },
      ],
      decisionPanel,
      actionGroups: settingsRoute ? SETTINGS_ACTION_GROUPS : ACTION_GROUPS,
      attentionRows,
      incidentFeed: feed,
      classSections,
      railCards: [
        { title: 'ภาพรวมเชิงพาณิชย์', body: expiringCount > 0 ? `${formatNumber(expiringCount, '0')} รายการใกล้ต่ออายุหรือหมดอายุ` : 'ตอนนี้ยังไม่เห็นแรงกดดันด้านการต่ออายุที่ต้องรีบจัดการ', meta: Number(subscriptions.mrr) > 0 ? `รายได้ที่ติดตามได้ ฿${formatNumber(subscriptions.mrr, '0')}` : 'ใช้หน้านี้ทบทวนแพ็กเกจและการสมัครใช้', tone: expiringCount > 0 ? 'danger' : 'success' },
        { title: 'งานดูแลลูกค้า', body: state.supportCase && state.supportCase.signals ? `${formatNumber(state.supportCase.signals.total, '0')} สัญญาณถูกผูกกับเคสที่กำลังดูอยู่` : 'ตอนนี้งานดูแลลูกค้าค่อนข้างสงบ', meta: 'เปิดดูงานดูแลลูกค้าและวินิจฉัยระบบก่อนแตะสถานะบริการหรือโควตา', tone: state.supportCase ? 'warning' : 'muted' },
        { title: 'เส้นทางที่ช้าที่สุดตอนนี้', body: hotspot ? `${hotspot.routeGroup || hotspot.samplePath || '/'} ใช้เวลาประมาณ ${formatNumber(hotspot.p95LatencyMs, '0')} ms` : 'ยังไม่มีสรุปเส้นทางที่ช้าจากคำขอชุดล่าสุด', meta: hotspot ? `${formatNumber(hotspot.requests, '0')} คำขอ | ${formatNumber(hotspot.errors, '0')} ข้อผิดพลาด` : 'รีเฟรชหน้าสถานะเพื่อเติมข้อมูลส่วนนี้', tone: hotspot && hotspot.errors > 0 ? 'warning' : 'info' },
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
  function renderRouteLink(item) {
    const className = item.current ? 'odv4-nav-link odv4-nav-link-current' : 'odv4-nav-link';
    const localFocusAttr = item.localFocus ? ' data-owner-local-focus="1"' : '';
    const localRouteAttr = item.localFocus ? ' data-ownerLocalFocus="1"' : '';
    return `<a class="${className}" href="${escapeHtml(item.href || '#')}"${localFocusAttr}${localRouteAttr}>${escapeHtml(item.label || '')}</a>`;
  }
  function renderSidebarClassMenu(groups) {
    return (Array.isArray(groups) ? groups : []).map((group) => {
      const expanded = group.expanded ? 'true' : 'false';
      return [
        `<section class="odv4-nav-class" data-odv4-nav-class="${escapeHtml(group.id || '')}" data-expanded="${expanded}">`,
        `<button class="odv4-nav-class-toggle" type="button" data-odv4-class-toggle="${escapeHtml(group.id || '')}" aria-expanded="${expanded}">`,
        '<span class="odv4-nav-class-copy">',
        `<span class="odv4-nav-class-kicker">${escapeHtml(group.kicker || '')}</span>`,
        `<strong class="odv4-nav-class-title">${escapeHtml(group.label || '')}</strong>`,
        `<span class="odv4-nav-class-summary">${escapeHtml(group.summary || '')}</span>`,
        '</span>',
        `<span class="odv4-nav-class-caret" aria-hidden="true"></span>`,
        '</button>',
        '<div class="odv4-nav-class-body-wrap">',
        '<div class="odv4-nav-class-body">',
        ...(Array.isArray(group.items) ? group.items.map((item) => renderRouteLink(item)) : []),
        '</div>',
        '</div>',
        '</section>',
      ].join('');
    }).join('');
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
      ...(Array.isArray(item.actions) ? item.actions : []).map((action) => [
        '<div class="odv4-action-entry">',
        action.primary ? '<span class="odv4-action-recommend">แนะนำ</span>' : '',
        `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`,
        '</div>',
      ].join('')),
      '</div></article>',
    ].join('')).join('');
  }
  function renderAttentionRows(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state"><strong>ยังไม่มีลูกค้าที่ต้องเปิดดูก่อน</strong><p>ตอนนี้ยังไม่พบสัญญาณเร่งด่วนจากโควตาหรือการต่ออายุ</p><a class="odv4-button odv4-button-secondary" href="#tenants">เปิดรายชื่อลูกค้า</a></div>';
    return items.map((item) => [
      `<article class="odv4-list-item odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="odv4-list-main"><strong>${escapeHtml(localizeOwnerDashboardText(item.name || '-'))}</strong><p>${escapeHtml(localizeOwnerDashboardText(item.detail || ''))}</p></div>`,
      `<div class="odv4-list-side"><span class="odv4-pill odv4-pill-${escapeHtml(item.tone || 'muted')}">${escapeHtml(localizeOwnerDashboardText(item.packageName || '-'))}</span><span class="odv4-list-meta">${escapeHtml(localizeOwnerDashboardText(item.meta || ''))}</span></div>`,
      '</article>',
    ].join('')).join('');
  }
  function renderFeed(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state"><strong>ยังไม่มีสัญญาณใหม่</strong><p>ถ้าต้องการตรวจต่อ ให้เปิดสถานะบริการหรือบันทึกออดิทได้เลย</p><a class="odv4-button odv4-button-secondary" href="#runtime-health">ดูสถานะบริการ</a></div>';
    return items.map((item) => [
      `<article class="odv4-feed-item odv4-tone-${escapeHtml(toneForStatus(item.severity || 'warning'))}">`,
      `<div class="odv4-feed-meta"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(item.severity || 'warning'))}">${escapeHtml(localizeOwnerDashboardText(item.source || 'signal'))}</span><span>${escapeHtml(formatDateTime(item.time))}</span></div>`,
      `<strong>${escapeHtml(localizeOwnerDashboardText(item.title || 'Signal'))}</strong>`,
      item.detail ? `<p>${escapeHtml(localizeOwnerDashboardText(item.detail))}</p>` : '',
      '</article>',
    ].join('')).join('');
  }
  function renderDecisionPanel(panel) {
    if (!panel) return '';
    return [
      '<section class="odv4-panel odv4-priority-panel">',
      '<div class="odv4-priority-grid">',
      '<div class="odv4-stack">',
      '<span class="odv4-section-kicker">ควรเริ่มตรงไหนก่อน</span>',
      `<h2 class="odv4-section-title">${escapeHtml(panel.title || '')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(panel.detail || '')}</p>`,
      '<div class="odv4-priority-checkpoints">',
      ...(Array.isArray(panel.checkpoints) ? panel.checkpoints.map((item) => [
        `<article class="odv4-priority-item odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
        `<span class="odv4-kpi-label">${escapeHtml(item.label || '')}</span>`,
        `<strong class="odv4-kpi-value">${escapeHtml(item.value || '-')}</strong>`,
        `<p class="odv4-kpi-detail">${escapeHtml(item.detail || '')}</p>`,
        '</article>',
      ].join('')) : []),
      '</div>',
      '</div>',
      '<div class="odv4-stack odv4-priority-actions">',
      '<span class="odv4-action-recommend">แนะนำ</span>',
      `<a class="odv4-button odv4-button-primary" href="${escapeHtml(panel.primaryAction && panel.primaryAction.href || '#')}">${escapeHtml(panel.primaryAction && panel.primaryAction.label || 'เปิดต่อ')}</a>`,
      '<div class="odv4-priority-secondary">',
      ...(Array.isArray(panel.secondaryActions) ? panel.secondaryActions.map((action) => `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`) : []),
      '</div>',
      '</div>',
      '</div>',
      '</section>',
    ].join('');
  }
  function renderRailCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-rail-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<h4 class="odv4-rail-title">${escapeHtml(localizeOwnerDashboardText(item.title || ''))}</h4>`,
      `<p class="odv4-rail-copy">${escapeHtml(localizeOwnerDashboardText(item.body || ''))}</p>`,
      `<div class="odv4-rail-detail">${escapeHtml(localizeOwnerDashboardText(item.meta || ''))}</div>`,
      '</article>',
    ].join('')).join('');
  }
  function renderClassChoiceCards(items, activeClass) {
    return (Array.isArray(items) ? items : []).map((item) => {
      const active = item.id === activeClass;
      return [
        `<button class="odv4-class-choice${active ? ' is-active' : ''}" type="button" data-odv4-class-filter="${escapeHtml(item.id || '')}" aria-pressed="${active ? 'true' : 'false'}">`,
        `<span class="odv4-class-choice-kicker">${escapeHtml(item.kicker || '')}</span>`,
        `<strong class="odv4-class-choice-title">${escapeHtml(item.title || '')}</strong>`,
        `<p class="odv4-class-choice-copy">${escapeHtml(item.subtitle || '')}</p>`,
        '<div class="odv4-class-choice-metrics">',
        ...(Array.isArray(item.metrics) ? item.metrics.map((metric) => [
          `<span class="odv4-class-choice-metric odv4-tone-${escapeHtml(metric.tone || 'muted')}">`,
          `<strong>${escapeHtml(metric.value || '-')}</strong>`,
          `<span>${escapeHtml(metric.label || '')}</span>`,
          '</span>',
        ].join('')) : []),
        '</div>',
        '</button>',
      ].join('');
    }).join('');
  }
  function renderClassMetrics(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-class-metric odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-kpi-label">${escapeHtml(item.label || '')}</span>`,
      `<strong class="odv4-kpi-value">${escapeHtml(item.value || '-')}</strong>`,
      `<p class="odv4-kpi-detail">${escapeHtml(item.detail || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }
  function renderContextCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-context-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-kpi-label">${escapeHtml(item.title || '')}</span>`,
      `<strong class="odv4-context-title">${escapeHtml(item.body || '')}</strong>`,
      `<p class="odv4-kpi-detail">${escapeHtml(item.meta || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }
  function renderClassSection(section, model) {
    if (!section) return '';
    const primaryType = section.primaryPanel && section.primaryPanel.type;
    const primaryContent = primaryType === 'feed'
      ? `<div class="odv4-feed">${renderFeed(model.incidentFeed)}</div>`
      : `<div class="odv4-list">${renderAttentionRows(model.attentionRows)}</div>`;
    const localTarget = `#${escapeHtml(section.anchorId || '')}`;
    return [
      `<section id="${escapeHtml(section.anchorId || '')}" class="odv4-class-section odv4-focus-target" data-odv4-class-section="${escapeHtml(section.id || '')}" data-owner-focus-route="${escapeHtml(section.focusRoutes || '')}">`,
      section.id === 'operations' ? '<span id="settings" class="odv4-route-anchor" aria-hidden="true"></span>' : '',
      '<div class="odv4-class-hero">',
      '<div class="odv4-class-header">',
      `<span class="odv4-section-kicker">${escapeHtml(section.kicker || '')}</span>`,
      `<h2 class="odv4-class-title">${escapeHtml(section.title || '')}</h2>`,
      `<p class="odv4-class-copy">${escapeHtml(section.subtitle || '')}</p>`,
      `<div class="odv4-class-actions"><a class="odv4-button odv4-button-secondary" href="${localTarget}" data-ownerLocalFocus="1">Focus section</a></div>`,
      '</div>',
      `<div class="odv4-class-metrics">${renderClassMetrics(section.metrics)}</div>`,
      '</div>',
      `<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">Workflow</span><h3 class="odv4-section-title">${escapeHtml(section.title || '')}</h3><p class="odv4-section-copy">Use this section for a focused working set inside the full Owner surface.</p></div><div class="odv4-task-grid">${renderActionGroups(section.actionGroups)}</div></section>`,
      '<div class="odv4-split-grid">',
      `<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(section.primaryPanel && section.primaryPanel.kicker || '')}</span><h3 class="odv4-section-title">${escapeHtml(section.primaryPanel && section.primaryPanel.title || '')}</h3><p class="odv4-section-copy">${escapeHtml(section.primaryPanel && section.primaryPanel.copy || '')}</p></div>${primaryContent}</section>`,
      `<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(section.secondaryPanel && section.secondaryPanel.kicker || '')}</span><h3 class="odv4-section-title">${escapeHtml(section.secondaryPanel && section.secondaryPanel.title || '')}</h3><p class="odv4-section-copy">${escapeHtml(section.secondaryPanel && section.secondaryPanel.copy || '')}</p></div><div class="odv4-context-grid">${renderContextCards(section.secondaryPanel && section.secondaryPanel.cards)}</div></section>`,
      '</div>',
      '</section>',
    ].join('');
  }

  function buildOwnerDashboardV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : createOwnerDashboardV4Model({});
    return repairMojibakeText([
      `<div class="odv4-app" data-odv4-dashboard="1" data-odv4-default-class="${escapeHtml(safeModel.shell.activeClass || 'commercial')}"><header class="odv4-topbar"><div class="odv4-brand-row">`,
      `<div class="odv4-brand-mark">${escapeHtml(safeModel.shell.brand || 'SCUM')}</div>`,
      `<div class="odv4-brand-copy"><span class="odv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel || '')}</span><strong class="odv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel || '')}</strong></div>`,
      '</div><div class="odv4-topbar-actions">',
      `<span class="odv4-badge odv4-badge-muted">${escapeHtml(safeModel.shell.environmentLabel || '')}</span>`,
      '<a class="odv4-button odv4-button-secondary" href="#tenants">ลูกค้า</a>',
      '<a class="odv4-button odv4-button-secondary" href="#runtime-health">บริการ</a>',
      '</div></header>',
      '<div class="odv4-shell"><aside class="odv4-sidebar"><div class="odv4-stack"><span class="odv4-sidebar-title">เมนูเจ้าของระบบ</span><p class="odv4-sidebar-copy">ใช้หน้านี้เพื่อตัดสินใจเรื่องลูกค้า รายได้ ความปลอดภัย และความพร้อมของบริการ โดยไม่ต้องไล่เปิดหลายส่วนของระบบ</p></div>',
      '</aside><main class="odv4-main">',
      '<div id="overview" class="odv4-focus-target" data-owner-focus-route="overview dashboard">',
      '<section class="odv4-pagehead"><div class="odv4-stack"><span class="odv4-section-kicker">ศูนย์ควบคุมเจ้าของระบบ</span>',
      `<h1 class="odv4-page-title">${escapeHtml(safeModel.header.title || '')}</h1><p class="odv4-page-subtitle">${escapeHtml(safeModel.header.subtitle || '')}</p><div class="odv4-chip-row">${renderChips(safeModel.header.statusChips)}</div></div>`,
      `<div class="odv4-pagehead-actions"><a class="odv4-button odv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label || 'เปิดต่อ')}</a></div></section>`,
      '</div>',
      `<section class="odv4-kpi-strip">${renderKpis(safeModel.kpis)}</section>`,
      renderDecisionPanel(safeModel.decisionPanel),
      '<div class="odv4-class-section-stack">',
      ...(Array.isArray(safeModel.classSections) ? safeModel.classSections.map((section) => renderClassSection(section, safeModel)) : []),
      '</div></main>',
      `<aside class="odv4-rail"><div class="odv4-rail-sticky"><div class="odv4-rail-header">บริบทเจ้าของระบบ</div><p class="odv4-rail-copy">ดูรายได้ งานดูแลลูกค้า และจุดเสี่ยงได้จากด้านขวา</p>${renderRailCards(safeModel.railCards)}</div></aside>`,
      '</div></div>',
    ].join(''));
  }

  function readExpandedDashboardClasses(target, fallbackClass) {
    const raw = String(target && target.dataset && target.dataset.odv4ExpandedClasses || '').trim();
    const expanded = new Set(raw.split(',').map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
    if (expanded.size === 0 && fallbackClass) expanded.add(String(fallbackClass).trim().toLowerCase());
    return expanded;
  }

  function writeExpandedDashboardClasses(target, classes) {
    target.dataset.odv4ExpandedClasses = Array.from(classes).join(',');
  }

  function applyOwnerDashboardV4State(target) {
    if (!target) return;
    const dashboardRoot = target.querySelector('[data-odv4-dashboard="1"]');
    if (!dashboardRoot) return;
    const defaultClass = String(dashboardRoot.dataset.odv4DefaultClass || 'commercial').trim().toLowerCase() || 'commercial';
    const activeClass = String(target.dataset.odv4ActiveClass || defaultClass).trim().toLowerCase() || defaultClass;
    const expandedClasses = readExpandedDashboardClasses(target, defaultClass);
    target.dataset.odv4ActiveClass = activeClass;
    dashboardRoot.setAttribute('data-odv4-active-class', activeClass);
    writeExpandedDashboardClasses(target, expandedClasses);
    dashboardRoot.querySelectorAll('[data-odv4-class-section]').forEach((section) => {
      section.hidden = false;
      section.setAttribute('data-visible', '1');
    });
    dashboardRoot.querySelectorAll('[data-odv4-class-filter]').forEach((button) => {
      const selected = String(button.getAttribute('data-odv4-class-filter') || '') === activeClass;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    dashboardRoot.querySelectorAll('[data-odv4-nav-class]').forEach((group) => {
      const classId = String(group.getAttribute('data-odv4-nav-class') || '').trim().toLowerCase();
      const expanded = expandedClasses.has(classId);
      group.setAttribute('data-expanded', expanded ? 'true' : 'false');
      const toggle = group.querySelector('[data-odv4-class-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function setupOwnerDashboardV4Interactions(target) {
    if (!target || target.__ownerDashboardV4Bound) return;
    target.__ownerDashboardV4Bound = true;
    target.addEventListener('click', (event) => {
      const trigger = event.target instanceof Element
        ? event.target.closest('[data-odv4-class-filter], [data-odv4-class-jump], [data-odv4-class-toggle]')
        : null;
      if (!trigger) return;
      const classId = String(
        trigger.getAttribute('data-odv4-class-filter')
        || trigger.getAttribute('data-odv4-class-jump')
        || trigger.getAttribute('data-odv4-class-toggle')
        || ''
      ).trim().toLowerCase();
      if (!classId) return;
      event.preventDefault();
      target.dataset.odv4ActiveClass = classId;
      const expandedClasses = readExpandedDashboardClasses(target, classId);
      if (trigger.hasAttribute('data-odv4-class-toggle')) {
        if (expandedClasses.has(classId)) {
          expandedClasses.delete(classId);
        } else {
          expandedClasses.add(classId);
        }
      } else {
        expandedClasses.add(classId);
      }
      writeExpandedDashboardClasses(target, expandedClasses);
      applyOwnerDashboardV4State(target);
      if (!trigger.hasAttribute('data-odv4-class-toggle')) {
        const focusTarget = target.querySelector(`#lane-${classId}`);
        focusTarget?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }
    });
  }

  function renderOwnerDashboardV4(target, source, options) {
    if (!target) throw new Error('Owner dashboard V4 target is required');
    const model = createOwnerDashboardV4Model(source, options);
    const routeKey = String(options && options.currentRoute || 'overview').trim().toLowerCase() || 'overview';
    target.innerHTML = buildOwnerDashboardV4Html(model);
    if (target.dataset.odv4LastRoute !== routeKey || !target.dataset.odv4ActiveClass) {
      target.dataset.odv4ActiveClass = String(model && model.shell && model.shell.activeClass || 'commercial').trim().toLowerCase() || 'commercial';
      target.dataset.odv4ExpandedClasses = target.dataset.odv4ActiveClass;
    }
    target.dataset.odv4LastRoute = routeKey;
    setupOwnerDashboardV4Interactions(target);
    applyOwnerDashboardV4State(target);
    return target;
  }

  return {
    createOwnerDashboardV4Model,
    buildOwnerDashboardV4Html,
    renderOwnerDashboardV4,
  };
});
