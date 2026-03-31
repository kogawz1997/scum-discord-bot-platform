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
    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงเจ้าของระบบ',
        workspaceLabel: 'ศูนย์ควบคุมแพลตฟอร์ม',
        environmentLabel: 'ระดับแพลตฟอร์ม',
        navGroups: cloneNavGroups(NAV_GROUPS, currentRoute),
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
      railCards: [
        { title: 'ภาพรวมเชิงพาณิชย์', body: expiringCount > 0 ? `${formatNumber(expiringCount, '0')} รายการใกล้ต่ออายุหรือหมดอายุ` : 'ตอนนี้ยังไม่เห็นแรงกดดันด้านการต่ออายุที่ต้องรีบจัดการ', meta: Number(subscriptions.mrr) > 0 ? `รายได้ที่ติดตามได้ ฿${formatNumber(subscriptions.mrr, '0')}` : 'ใช้หน้านี้ทบทวนแพ็กเกจและการสมัครใช้', tone: expiringCount > 0 ? 'danger' : 'success' },
        { title: 'งานดูแลลูกค้า', body: state.supportCase && state.supportCase.signals ? `${formatNumber(state.supportCase.signals.total, '0')} สัญญาณถูกผูกกับเคสที่กำลังดูอยู่` : 'ตอนนี้งานดูแลลูกค้าค่อนข้างสงบ', meta: 'เปิดดูงานดูแลลูกค้าและวินิจฉัยระบบก่อนแตะสถานะบริการหรือโควตา', tone: state.supportCase ? 'warning' : 'muted' },
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

  function buildOwnerDashboardV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : createOwnerDashboardV4Model({});
    return [
      '<div class="odv4-app"><header class="odv4-topbar"><div class="odv4-brand-row">',
      `<div class="odv4-brand-mark">${escapeHtml(safeModel.shell.brand || 'SCUM')}</div>`,
      `<div class="odv4-brand-copy"><span class="odv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel || '')}</span><strong class="odv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel || '')}</strong></div>`,
      '</div><div class="odv4-topbar-actions">',
      `<span class="odv4-badge odv4-badge-muted">${escapeHtml(safeModel.shell.environmentLabel || '')}</span>`,
      '<a class="odv4-button odv4-button-secondary" href="#tenants">ลูกค้า</a>',
      '<a class="odv4-button odv4-button-secondary" href="#runtime-health">บริการ</a>',
      '</div></header>',
      '<div class="odv4-shell"><aside class="odv4-sidebar"><div class="odv4-stack"><span class="odv4-sidebar-title">เมนูเจ้าของระบบ</span><p class="odv4-sidebar-copy">ใช้หน้านี้เพื่อตัดสินใจเรื่องลูกค้า รายได้ ความปลอดภัย และความพร้อมของบริการ โดยไม่ต้องไล่เปิดหลายส่วนของระบบ</p></div>',
      renderNavGroups(safeModel.shell.navGroups),
      '</aside><main class="odv4-main">',
      '<div id="overview" class="odv4-focus-target" data-owner-focus-route="overview dashboard">',
      '<section class="odv4-pagehead"><div class="odv4-stack"><span class="odv4-section-kicker">ศูนย์ควบคุมเจ้าของระบบ</span>',
      `<h1 class="odv4-page-title">${escapeHtml(safeModel.header.title || '')}</h1><p class="odv4-page-subtitle">${escapeHtml(safeModel.header.subtitle || '')}</p><div class="odv4-chip-row">${renderChips(safeModel.header.statusChips)}</div></div>`,
      `<div class="odv4-pagehead-actions"><a class="odv4-button odv4-button-secondary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label || 'Open')}</a></div></section>`,
      '</div>',
      `<section class="odv4-kpi-strip">${renderKpis(safeModel.kpis)}</section>`,
      renderDecisionPanel(safeModel.decisionPanel),
      '<div id="settings" class="odv4-focus-target" data-owner-focus-route="settings">',
      '<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">ตัวเลือกอื่น</span><h2 class="odv4-section-title">เลือกงานที่ต้องทำต่อ</h2><p class="odv4-section-copy">เลือกเส้นทางที่ตรงกับงานที่กำลังทำได้เลย</p></div>',
      `<div class="odv4-task-grid">${renderActionGroups(safeModel.actionGroups)}</div></section>`,
      '</div>',
      '<div class="odv4-split-grid"><section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">ต้องดูต่อ</span><h2 class="odv4-section-title">ลูกค้าที่ควรเปิดดูก่อน</h2><p class="odv4-section-copy">ลิสต์สั้นสำหรับเปิดงานต่อทันที</p></div>',
      `<div class="odv4-list">${renderAttentionRows(safeModel.attentionRows)}</div></section>`,
      '<section class="odv4-panel"><div class="odv4-section-head"><span class="odv4-section-kicker">สัญญาณล่าสุด</span><h2 class="odv4-section-title">เหตุการณ์และการแจ้งเตือนล่าสุด</h2><p class="odv4-section-copy">รวมสัญญาณหลักที่ควรรู้ก่อน</p></div>',
      `<div class="odv4-feed">${renderFeed(safeModel.incidentFeed)}</div></section></div></main>`,
      `<aside class="odv4-rail"><div class="odv4-rail-sticky"><div class="odv4-rail-header">บริบทเจ้าของระบบ</div><p class="odv4-rail-copy">ดูรายได้ งานดูแลลูกค้า และจุดเสี่ยงได้จากด้านขวา</p>${renderRailCards(safeModel.railCards)}</div></aside>`,
      '</div></div>',
    ].join('');
  }

  function renderOwnerDashboardV4(target, source, options) {
    if (!target) throw new Error('Owner dashboard V4 target is required');
    target.innerHTML = buildOwnerDashboardV4Html(createOwnerDashboardV4Model(source, options));
    return target;
  }

  return {
    createOwnerDashboardV4Model,
    buildOwnerDashboardV4Html,
    renderOwnerDashboardV4,
  };
});
