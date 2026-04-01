(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerControlV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat('th-TH').format(numeric)
      : fallback;
  }

  function formatCurrencyCents(value, currency = 'THB') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: String(currency || 'THB').trim().toUpperCase() || 'THB',
      maximumFractionDigits: 2,
    }).format(numeric / 100);
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    return date
      ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
      : 'ยังไม่ทราบเวลา';
  }

  function formatRelative(value) {
    const date = parseDate(value);
    if (!date) return 'ยังไม่มีสัญญาณล่าสุด';
    const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 60) return `${formatNumber(diffMinutes)} นาทีที่แล้ว`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${formatNumber(diffHours)} ชั่วโมงที่แล้ว`;
    return `${formatNumber(Math.round(diffHours / 24))} วันที่แล้ว`;
  }

  function toLocalDateTimeInputValue(value) {
    const date = parseDate(value);
    if (!date) return '';
    const adjusted = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return adjusted.toISOString().slice(0, 16);
  }

  function trimText(value, maxLen) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (Number.isFinite(maxLen) && maxLen > 0 && text.length > maxLen) {
      return text.slice(0, maxLen);
    }
    return text;
  }

  function firstNonEmpty(values, fallback = '') {
    for (const value of Array.isArray(values) ? values : []) {
      const text = trimText(value);
      if (text) return text;
    }
    return fallback;
  }

  const OWNER_CONTROL_TRANSLATIONS = {
    'Discord SSO': 'Discord SSO',
    'Session TTL': 'อายุเซสชัน',
    'Billing provider': 'ผู้ให้บริการชำระเงิน',
    'Platform public base URL': 'URL หลักของแพลตฟอร์ม',
    'Stripe secret key': 'คีย์ลับ Stripe',
    'Require database persistence': 'บังคับใช้ฐานข้อมูลสำหรับการเก็บข้อมูล',
    'Delivery execution mode': 'โหมดการส่งของ',
    'Platform local': 'แพลตฟอร์มภายใน',
    Stripe: 'Stripe',
    RCON: 'RCON',
    configured: 'ตั้งค่าแล้ว',
    'Enable Discord sign-in for owner accounts.': 'เปิดให้บัญชีเจ้าของระบบใช้ Discord ในการเข้าสู่ระบบ',
    'Hours before session expires.': 'จำนวนชั่วโมงก่อนที่เซสชันจะหมดอายุ',
    'Billing provider used for package purchase and renewal flows.': 'ผู้ให้บริการชำระเงินที่ใช้กับการซื้อแพ็กเกจและการต่ออายุ',
    'Canonical public URL used in billing redirects.': 'URL สาธารณะหลักที่ใช้ในการ redirect ของระบบชำระเงิน',
    'Stripe secret key used for checkout and webhook operations.': 'คีย์ลับ Stripe ที่ใช้กับ checkout และ webhook',
    'Require database persistence at runtime.': 'บังคับใช้การเก็บข้อมูลผ่านฐานข้อมูลขณะระบบทำงาน',
    'Delivery backend selection.': 'ตัวเลือก backend สำหรับงานส่งของ',
    'Player portal base URL.': 'URL หลักของพอร์ทัลผู้เล่น',
    'Active': 'ใช้งานอยู่',
    'Inactive': 'ไม่ใช้งาน',
    'Platform-wide': 'ทั้งแพลตฟอร์ม',
    'Owner web frontend': 'หน้าเว็บเจ้าของระบบ',
    'No admin users yet': 'ยังไม่มีบัญชีผู้ดูแล',
    'No managed services available': 'ยังไม่มีบริการที่ระบบดูแลอยู่',
  };

  Object.assign(OWNER_CONTROL_TRANSLATIONS, {
    'Expiring soon': 'ใกล้หมดอายุ',
    'Current package': 'แพ็กเกจปัจจุบัน',
    'Runtime status': 'สถานะบอท',
    'Support signals': 'สัญญาณงานดูแลลูกค้า',
    'Support context loaded': 'โหลดบริบทงานดูแลลูกค้าแล้ว',
    'Loading support context': 'กำลังโหลดบริบทงานดูแลลูกค้า',
    'Support context not loaded yet': 'ยังไม่ได้โหลดบริบทงานดูแลลูกค้า',
    'No subscription yet': 'ยังไม่มีการสมัครใช้งาน',
    'Customer detail': 'รายละเอียดลูกค้า',
    'Customer operations and commercial controls': 'จัดการลูกค้าและการควบคุมเชิงพาณิชย์',
    Acknowledge: 'รับทราบ',
    Acknowledged: 'รับทราบแล้ว',
    notification: 'การแจ้งเตือน',
    'security-event': 'เหตุการณ์ความปลอดภัย',
    requests: 'คำขอ',
    alerts: 'การแจ้งเตือน',
    direct: 'ขายตรง',
    trial: 'ทดลองใช้',
    reseller: 'ตัวแทนขาย',
    demo: 'สาธิต',
    active: 'ใช้งานอยู่',
    trialing: 'กำลังทดลองใช้',
    paused: 'พักไว้',
    suspended: 'ระงับไว้',
    pending: 'รอดำเนินการ',
    pending_activation: 'รอเปิดใช้งาน',
    past_due: 'ค้างชำระ',
    canceled: 'ยกเลิกแล้ว',
    expired: 'หมดอายุแล้ว',
    paid: 'ชำระแล้ว',
    succeeded: 'สำเร็จ',
    failed: 'ล้มเหลว',
    online: 'ออนไลน์',
    offline: 'ออฟไลน์',
    healthy: 'พร้อมใช้งาน',
    degraded: 'เสื่อมประสิทธิภาพ',
    warning: 'เตือน',
    critical: 'วิกฤต',
    high: 'สูง',
    medium: 'กลาง',
    low: 'ต่ำ',
    info: 'ข้อมูล',
    'Platform Event: agent heartbeat': 'เหตุการณ์แพลตฟอร์ม: สัญญาณการทำงานของบอท',
    'Delivery Reconcile Anomaly': 'ความผิดปกติของการกระทบยอดการส่งของ',
  });

  Object.assign(OWNER_CONTROL_TRANSLATIONS, {
    'Delivery Agent': 'บอทส่งของ',
    'Server Bot': 'บอทเซิร์ฟเวอร์',
    Runtime: 'บอท',
    Type: 'ประเภท',
    Status: 'สถานะ',
    Version: 'เวอร์ชัน',
    'Last seen': 'พบล่าสุด',
    Actions: 'การทำงาน',
    'Open support case': 'เปิดเคสดูแลลูกค้า',
    'No managed runtimes are registered for this customer yet.': 'ยังไม่มีบอทที่ลงทะเบียนไว้สำหรับลูกค้ารายนี้',
    'No Delivery Agent or Server Bot is registered for this customer yet.': 'ยังไม่มีบอทส่งของหรือบอทเซิร์ฟเวอร์สำหรับลูกค้ารายนี้',
    'Edit customer metadata': 'แก้ไขข้อมูลลูกค้า',
    'Assign or change package': 'กำหนดหรือเปลี่ยนแพ็กเกจ',
    'Customer name': 'ชื่อลูกค้า',
    Slug: 'สลัก',
    'Owner name': 'ชื่อผู้ดูแลหลัก',
    'Owner email': 'อีเมลผู้ดูแลหลัก',
    Locale: 'ภาษา',
    'Parent tenant': 'ลูกค้าต้นทาง',
    Package: 'แพ็กเกจ',
    'Plan ID': 'รหัสแผน',
    'Billing cycle': 'รอบการชำระ',
    'Subscription status': 'สถานะการสมัครใช้',
    'Amount (cents)': 'ยอดเงิน (สตางค์)',
    Currency: 'สกุลเงิน',
    'Renews at': 'ต่ออายุเมื่อ',
    'External ref': 'อ้างอิงภายนอก',
    'Save customer record': 'บันทึกข้อมูลลูกค้า',
    'Reactivate customer': 'เปิดใช้งานลูกค้าอีกครั้ง',
    'Suspend customer': 'ระงับลูกค้า',
    'Save package assignment': 'บันทึกการกำหนดแพ็กเกจ',
    'Support case not found': 'ไม่พบเคสดูแลลูกค้า',
    'Open customer list': 'เปิดรายชื่อลูกค้า',
    'No immediate support actions': 'ยังไม่มีงานที่ต้องทำทันที',
    'The current support bundle does not suggest a follow-up action right now.': 'ชุดข้อมูลช่วยเหลือปัจจุบันยังไม่มีงานติดตามที่ต้องทำทันที',
    Retry: 'ลองส่งใหม่',
    Clear: 'ล้างรายการ',
    Alert: 'การแจ้งเตือน',
    Severity: 'ระดับ',
    When: 'เวลา',
    Method: 'วิธีเรียก',
    Path: 'เส้นทาง',
    Detail: 'รายละเอียด',
    Signal: 'สัญญาณ',
    Count: 'จำนวน',
    'Onboarding step': 'ขั้นตอนเริ่มต้น',
    Scope: 'ขอบเขต',
    Required: 'จำเป็น',
    Optional: 'เพิ่มเติม',
    'No support signals in the current bundle': 'ยังไม่มีสัญญาณช่วยเหลือจากชุดข้อมูลปัจจุบัน',
    'No onboarding checklist available yet': 'ยังไม่มีรายการตรวจสอบการเริ่มต้นใช้งาน',
    Analytics: 'การวิเคราะห์',
    'Platform and business analytics': 'ภาพรวมแพลตฟอร์มและธุรกิจ',
    'Total customers': 'ลูกค้าทั้งหมด',
    'Active customers': 'ลูกค้าที่ใช้งานอยู่',
    'Services online': 'บริการที่ออนไลน์',
    'Failed jobs': 'งานที่ล้มเหลว',
    'Customer count': 'จำนวนลูกค้า',
    Features: 'ฟีเจอร์',
    'No package description yet.': 'ยังไม่มีคำอธิบายแพ็กเกจ',
    Yes: 'มี',
    No: 'ไม่มี',
  });

  function translateOwnerControlText(value) {
    const text = trimText(value, 400);
    if (!text) return '';
    if (OWNER_CONTROL_TRANSLATIONS[text]) return OWNER_CONTROL_TRANSLATIONS[text];
    return text
      .replaceAll('Platform Event:', 'เหตุการณ์แพลตฟอร์ม:')
      .replaceAll('agent heartbeat', 'สัญญาณการทำงานของบอท')
      .replaceAll('Current status:', 'สถานะปัจจุบัน:')
      .replaceAll('support case', 'เคสดูแลลูกค้า')
      .replaceAll('subscription', 'การสมัครใช้งาน')
      .replaceAll('service rows', 'แถวบริการ')
      .replaceAll('dead letters', 'งานค้างผิดพลาด')
      .replaceAll('request errors', 'คำขอผิดพลาด')
      .replaceAll('queue depth', 'คิวค้าง')
      .replaceAll('online', 'ออนไลน์')
      .replaceAll('pending', 'รอดำเนินการ')
      .replaceAll('active', 'ใช้งานอยู่')
      .replaceAll('trialing', 'กำลังทดลองใช้')
      .replaceAll('runtime', 'บอท')
      .replaceAll('alerts', 'การแจ้งเตือน')
      .replaceAll('requests', 'คำขอ')
      .replaceAll('apiKeys', 'คีย์ API')
      .replaceAll('webhooks', 'เว็บฮุก')
      .replaceAll('invoice', 'ใบแจ้งหนี้')
      .replaceAll('platform-api', 'ระบบ API แพลตฟอร์ม');
  }

  const OWNER_PACKAGE_DISPLAY_LABELS = Object.freeze({
    BOT_LOG: 'บันทึกบอท',
    BOT_LOG_DELIVERY: 'บันทึกบอท + ส่งของ',
    FULL_OPTION: 'จัดการเต็มรูปแบบ',
    SERVER_ONLY: 'เฉพาะเซิร์ฟเวอร์',
    TRIAL: 'ทดลองใช้',
    PRO: 'โปร',
    'Bot Log': 'บันทึกบอท',
    'Bot Log + Delivery': 'บันทึกบอท + ส่งของ',
    'Full Option': 'จัดการเต็มรูปแบบ',
    'Server Only': 'เฉพาะเซิร์ฟเวอร์',
    Trial: 'ทดลองใช้',
    Pro: 'โปร',
    'Trial 14 days': 'ทดลองใช้ 14 วัน',
    'Pro Monthly': 'โปร รายเดือน',
  });

  const OWNER_PROVIDER_DISPLAY_LABELS = Object.freeze({
    platform_local: 'ระบบภายในแพลตฟอร์ม',
    stripe: 'Stripe',
    configured: 'ตั้งค่าแล้ว',
    sandbox: 'โหมดทดสอบ',
    live: 'ใช้งานจริง',
  });

  const OWNER_VALUE_DISPLAY_LABELS = Object.freeze({
    monthly: 'รายเดือน',
    quarterly: 'รายไตรมาส',
    yearly: 'รายปี',
    draft: 'แบบร่าง',
    archived: 'เก็บถาวร',
    'Server Hosting': 'โฮสต์เซิร์ฟเวอร์',
    'Server Settings': 'ค่าตั้งเซิร์ฟเวอร์',
    'Server Status': 'สถานะเซิร์ฟเวอร์',
    'Discord Integration': 'เชื่อมต่อ Discord',
    'Log Dashboard': 'หน้าดูบันทึก',
    'Delivery Dashboard': 'หน้าดูการส่งของ',
    'Shop Module': 'โมดูลร้านค้า',
    'Orders Module': 'โมดูลคำสั่งซื้อ',
    'Player Module': 'โมดูลผู้เล่น',
    'Donation Module': 'โมดูลโดเนชัน',
    'Event Module': 'โมดูลอีเวนต์',
    'Event Auto Reward': 'แจกรางวัลอัตโนมัติ',
    'Wallet Module': 'โมดูลกระเป๋าเงิน',
    'Promo Module': 'โมดูลโปรโมชั่น',
    'Ranking Module': 'โมดูลจัดอันดับ',
    'Restart Announce Module': 'โมดูลประกาศรีสตาร์ต',
    'Support Module': 'โมดูลช่วยเหลือ',
    'Staff Roles': 'บทบาททีมงาน',
    'Analytics Module': 'โมดูลวิเคราะห์',
    'Sync Agent': 'บอทซิงก์',
    'Execute Agent': 'บอทส่งของ',
    'Entry plan': 'แผนเริ่มต้น',
    'Full plan': 'แผนครบชุด',
    'Discord log sync and basic operational visibility.': 'ซิงก์บันทึก Discord และดูภาพรวมการทำงานขั้นพื้นฐาน',
    'Managed delivery plus player-facing commerce and sync.': 'จัดการการส่งของพร้อมระบบซื้อขายและการซิงก์สำหรับผู้เล่น',
    'Full managed server operations with hosting, settings, and delivery.': 'ดูแลเซิร์ฟเวอร์เต็มรูปแบบทั้งโฮสต์ ค่าตั้ง และการส่งของ',
    'Managed server controls without log and delivery add-ons.': 'ควบคุมเซิร์ฟเวอร์โดยไม่รวมส่วนเสริมบันทึกและการส่งของ',
  });

  function buildOwnerPackageOptionLabel(entry) {
    const packageId = trimText(entry && entry.id, 120);
    const fallbackValue = trimText(entry && entry.value, 120);
    const rawLabel = firstNonEmpty([
      entry && entry.title,
      entry && entry.label,
      packageId,
      fallbackValue,
    ], '');
    return OWNER_PACKAGE_DISPLAY_LABELS[rawLabel]
      || OWNER_PACKAGE_DISPLAY_LABELS[packageId]
      || translateOwnerControlText(rawLabel)
      || rawLabel
      || packageId
      || fallbackValue;
  }

  function buildOwnerPackageLabelLookup(packageCatalog) {
    const lookup = new Map();
    (Array.isArray(packageCatalog) ? packageCatalog : []).forEach((entry) => {
      const packageId = trimText(entry && entry.id, 120);
      if (!packageId) return;
      lookup.set(packageId, buildOwnerPackageOptionLabel(entry));
    });
    return lookup;
  }

  function formatOwnerPackageDisplayLabel(value, packageLookup) {
    const text = trimText(value, 200);
    if (!text) return '-';
    if (packageLookup instanceof Map && packageLookup.has(text)) return packageLookup.get(text);
    return OWNER_PACKAGE_DISPLAY_LABELS[text] || translateOwnerControlText(text) || text;
  }

  function formatOwnerProviderDisplayLabel(value) {
    const text = trimText(value, 200);
    if (!text) return '-';
    return OWNER_PROVIDER_DISPLAY_LABELS[text.toLowerCase()] || translateOwnerControlText(text) || text;
  }

  function formatOwnerDisplayValue(value) {
    const text = trimText(value, 240);
    if (!text) return '-';
    return OWNER_VALUE_DISPLAY_LABELS[text] || translateOwnerControlText(text) || text;
  }

  function parseObject(value) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function toneForStatus(value) {
    const raw = trimText(value).toLowerCase();
    if (['active', 'licensed', 'healthy', 'online', 'ready', 'paid', 'success'].includes(raw)) return 'success';
    if (['trialing', 'trial', 'warning', 'pending', 'pending_activation', 'past_due', 'expiring', 'degraded'].includes(raw)) return 'warning';
    if (['suspended', 'inactive', 'revoked', 'failed', 'offline', 'expired', 'error'].includes(raw)) return 'danger';
    return 'muted';
  }

  function normalizeOwnerControlRoute(rawRoute) {
    const route = trimText(rawRoute).toLowerCase();
    if (!route || route === 'overview' || route === 'dashboard') return 'overview';
    if (route === 'tenants' || route === 'create-tenant') return 'tenants';
    if (route.startsWith('tenant-')) return 'tenant-detail';
    if (route.startsWith('support-')) return 'support-detail';
    if (route === 'packages') return 'packages';
    if (route === 'subscriptions' || route === 'billing') return 'subscriptions';
    if (route === 'analytics' || route === 'observability') return 'analytics';
    if (route === 'audit' || route === 'security') return 'audit';
    if (route === 'settings') return 'settings';
    if (route === 'runtime' || route === 'runtime-health' || route === 'incidents' || route === 'jobs' || route === 'support') {
      return 'runtime';
    }
    return 'overview';
  }

  function ownerTenantHref(tenantId) {
    return `/owner/tenants/${encodeURIComponent(String(tenantId || '').trim())}`;
  }

  function ownerSupportHref(tenantId) {
    return `/owner/support/${encodeURIComponent(String(tenantId || '').trim())}`;
  }

  function buildSubscriptionLookup(subscriptions) {
    const map = new Map();
    (Array.isArray(subscriptions) ? subscriptions : []).forEach((row) => {
      const tenantId = trimText(row && (row.tenantId || row.ownerTenantId), 160);
      if (!tenantId || map.has(tenantId)) return;
      map.set(tenantId, row);
    });
    return map;
  }

  function buildQuotaLookup(snapshots) {
    const map = new Map();
    (Array.isArray(snapshots) ? snapshots : []).forEach((row) => {
      const tenantId = trimText(row && (row.tenantId || row.tenant && row.tenant.id), 160);
      if (tenantId) map.set(tenantId, row);
    });
    return map;
  }

  function summarizeQuota(snapshot) {
    const quotas = snapshot && snapshot.quotas && typeof snapshot.quotas === 'object'
      ? snapshot.quotas
      : {};
    const activeEntries = Object.entries(quotas).filter(([, value]) => value && typeof value === 'object');
    if (!activeEntries.length) {
      return {
        tone: 'muted',
        text: 'ยังไม่มีข้อมูลโควตาล่าสุด',
      };
    }
    const warnings = activeEntries.filter(([, value]) => {
      if (value.unlimited) return false;
      const limit = Number(value.limit || 0);
      const used = Number(value.used || 0);
      return limit > 0 && used / limit >= 0.75;
    });
    return {
      tone: warnings.length ? 'warning' : 'success',
      text: activeEntries.slice(0, 2).map(([key, value]) => {
        const used = formatNumber(value && value.used, '0');
        const limit = value && value.unlimited ? 'ไม่จำกัด' : formatNumber(value && value.limit, '0');
        return `${key}: ${used}/${limit}`;
      }).join(' · '),
    };
  }

  function extractPackageId(subscription, catalog) {
    const metadata = parseObject(subscription && (subscription.metadata || subscription.metadataJson || subscription.meta));
    const requested = firstNonEmpty([
      metadata.packageId,
      subscription && subscription.packageId,
      subscription && subscription.packageName,
      subscription && subscription.planPackageId,
    ], '');
    if (!requested) return '';
    const normalized = requested.trim().toUpperCase();
    const matched = (Array.isArray(catalog) ? catalog : []).find((entry) => {
      const id = trimText(entry && entry.id, 120).toUpperCase();
      const title = trimText(entry && entry.title, 180).toUpperCase();
      return normalized === id || normalized === title;
    });
    return matched ? matched.id : normalized;
  }

  function buildTenantRows(state, packageCatalog) {
    const tenants = Array.isArray(state.tenants) ? state.tenants : [];
    const subscriptions = buildSubscriptionLookup(state.subscriptions);
    const quotaLookup = buildQuotaLookup(state.tenantQuotaSnapshots);
    const invoices = Array.isArray(state.billingInvoices) ? state.billingInvoices : [];
    return tenants.map((tenant) => {
      const tenantId = trimText(tenant && tenant.id, 160);
      const subscription = subscriptions.get(tenantId) || null;
      const packageId = extractPackageId(subscription, packageCatalog);
      const quota = summarizeQuota(quotaLookup.get(tenantId));
      const tenantInvoices = invoices.filter((row) => trimText(row && row.tenantId, 160) === tenantId);
      const latestInvoice = tenantInvoices[0] || null;
      return {
        tenantId,
        tenant,
        subscription,
        packageId,
        packageLabel: firstNonEmpty([
          packageId,
          subscription && subscription.packageName,
          subscription && subscription.planId,
          tenant && tenant.type,
          'ยังไม่ได้กำหนดแพ็กเกจ',
        ]),
        status: firstNonEmpty([
          subscription && subscription.status,
          tenant && tenant.status,
          'active',
        ]),
        statusTone: toneForStatus(firstNonEmpty([
          subscription && subscription.status,
          tenant && tenant.status,
          'active',
        ])),
        ownerLabel: firstNonEmpty([
          tenant && tenant.ownerName,
          tenant && tenant.ownerEmail,
          '-',
        ]),
        invoiceLabel: latestInvoice
          ? `${firstNonEmpty([latestInvoice.status], 'draft')} · ${formatCurrencyCents(latestInvoice.amountCents || 0, latestInvoice.currency || 'THB')}`
          : 'ยังไม่มี invoice ล่าสุด',
        quota,
      };
    });
  }

  function buildPackageUsageRows(tenantRows, packageCatalog) {
    return (Array.isArray(packageCatalog) ? packageCatalog : []).map((pkg) => {
      const usage = (Array.isArray(tenantRows) ? tenantRows : []).filter((row) => row.packageId === pkg.id);
      return {
        id: pkg.id,
        title: pkg.title || pkg.id,
        description: pkg.description || '',
        status: trimText(pkg.status, 80) || 'active',
        position: Number.isFinite(Number(pkg.position)) ? Number(pkg.position) : 0,
        isSystem: pkg.isSystem === true,
        features: Array.isArray(pkg.features) ? pkg.features : [],
        tenantCount: usage.length,
        updatedAt: pkg.updatedAt || '',
      };
    });
  }

  function buildInvoiceSummary(invoices, paymentAttempts) {
    const rows = Array.isArray(invoices) ? invoices : [];
    const attempts = Array.isArray(paymentAttempts) ? paymentAttempts : [];
    const now = new Date();
    let revenueTodayCents = 0;
    let revenueMonthCents = 0;
    let openInvoiceCount = 0;
    let disputedInvoiceCount = 0;
    let refundedInvoiceCount = 0;
    rows.forEach((row) => {
      const status = trimText(row && row.status).toLowerCase();
      const timestamp = parseDate(row && (row.paidAt || row.updatedAt || row.createdAt || row.issuedAt));
      if (['draft', 'open', 'past_due'].includes(status)) {
        openInvoiceCount += 1;
      }
      if (status === 'disputed') {
        disputedInvoiceCount += 1;
      }
      if (status === 'refunded') {
        refundedInvoiceCount += 1;
      }
      if (status !== 'paid' || !timestamp) return;
      const amount = Number(row && row.amountCents) || 0;
      if (
        timestamp.getFullYear() === now.getFullYear()
        && timestamp.getMonth() === now.getMonth()
        && timestamp.getDate() === now.getDate()
      ) {
        revenueTodayCents += amount;
      }
      if (timestamp.getFullYear() === now.getFullYear() && timestamp.getMonth() === now.getMonth()) {
        revenueMonthCents += amount;
      }
    });
    return {
      revenueTodayCents,
      revenueMonthCents,
      openInvoiceCount,
      disputedInvoiceCount,
      refundedInvoiceCount,
      failedPaymentCount: attempts.filter((row) => trimText(row && row.status).toLowerCase() === 'failed').length,
    };
  }

  function buildBillingRecoveryQueue(tenantRows, invoices, paymentAttempts) {
    const rows = Array.isArray(tenantRows) ? tenantRows : [];
    const invoiceRows = Array.isArray(invoices) ? invoices : [];
    const attemptRows = Array.isArray(paymentAttempts) ? paymentAttempts : [];
    const tenantLookup = new Map(rows.map((row) => [trimText(row && row.tenantId, 160), row]));
    const invoiceLookup = new Map(invoiceRows.map((row) => [trimText(row && row.id, 160), row]));
    const seen = new Set();
    const queue = [];

    function tenantNameFor(tenantId) {
      const row = tenantLookup.get(trimText(tenantId, 160));
      return firstNonEmpty([
        row && row.tenant && (row.tenant.name || row.tenant.slug),
        row && row.tenantId,
        tenantId,
      ], '-');
    }

    function buildLifecycleContext(tenantId, invoiceRow, subscriptionRow, fallbackAmountCents, fallbackCurrency) {
      const tenantRow = tenantLookup.get(trimText(tenantId, 160)) || null;
      const subscription = subscriptionRow || (tenantRow && tenantRow.subscription) || {};
      const metadata = parseObject(invoiceRow && (invoiceRow.metadata || invoiceRow.metadataJson || invoiceRow.meta));
      return {
        tenantId: trimText(tenantId, 160),
        invoiceId: trimText(invoiceRow && invoiceRow.id, 160),
        subscriptionId: trimText(invoiceRow && invoiceRow.subscriptionId, 160) || trimText(subscription && subscription.id, 160),
        planId: firstNonEmpty([metadata.targetPlanId, invoiceRow && invoiceRow.planId, subscription && subscription.planId], ''),
        packageId: firstNonEmpty([metadata.targetPackageId, invoiceRow && invoiceRow.packageId, tenantRow && tenantRow.packageId, subscription && subscription.packageId], ''),
        billingCycle: firstNonEmpty([metadata.targetBillingCycle, invoiceRow && invoiceRow.billingCycle, subscription && subscription.billingCycle], 'monthly'),
        amountCents: Number(invoiceRow && invoiceRow.amountCents) || Number(fallbackAmountCents) || Number(subscription && subscription.amountCents) || 0,
        currency: trimText(invoiceRow && invoiceRow.currency, 12) || trimText(fallbackCurrency, 12) || trimText(subscription && subscription.currency, 12) || 'THB',
        externalRef: trimText(subscription && subscription.externalRef, 200),
      };
    }

    function pushItem(item) {
      const key = trimText(item && item.key, 200);
      if (!key || seen.has(key)) return;
      seen.add(key);
      queue.push(item);
    }

    attemptRows.forEach((row) => {
      const status = trimText(row && row.status, 40).toLowerCase();
      const tenantId = trimText(row && row.tenantId, 160);
      const attemptId = trimText(row && row.id, 160);
      if (status !== 'failed' || !tenantId || !attemptId) return;
      const invoiceRow = invoiceLookup.get(trimText(row && row.invoiceId, 160)) || null;
      const context = buildLifecycleContext(tenantId, invoiceRow, null, row && row.amountCents, row && row.currency);
      pushItem({
        key: `attempt-${attemptId}`,
        weight: 400,
        tone: 'danger',
        label: 'Failed payment attempt',
        title: tenantNameFor(tenantId),
        detail: `Attempt ${attemptId} failed for ${formatCurrencyCents(row && row.amountCents || 0, row && row.currency || 'THB')}. Last activity ${formatDateTime(row && (row.completedAt || row.attemptedAt || row.updatedAt || row.createdAt))}.`,
        actions: [
          `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-payment-attempt-status" data-tenant-id="${escapeHtml(tenantId)}" data-attempt-id="${escapeHtml(attemptId)}" data-target-status="succeeded">Mark succeeded</button>`,
          context.invoiceId
            ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(context.tenantId)}" data-invoice-id="${escapeHtml(context.invoiceId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-currency="${escapeHtml(context.currency)}">Retry checkout</button>`
            : '',
        ].filter(Boolean).join(''),
      });
    });

    invoiceRows.forEach((row) => {
      const tenantId = trimText(row && row.tenantId, 160);
      const invoiceId = trimText(row && row.id, 160);
      const status = trimText(row && row.status, 40).toLowerCase();
      if (!tenantId || !invoiceId || !['open', 'past_due', 'disputed', 'refunded'].includes(status)) return;
      const context = buildLifecycleContext(tenantId, row, null);
      const baseDetail = `${invoiceId} · ${formatCurrencyCents(row && row.amountCents || 0, row && row.currency || 'THB')} · ${formatDateTime(row && (row.dueAt || row.updatedAt || row.createdAt || row.issuedAt))}`;
      if (status === 'disputed') {
        pushItem({
          key: `invoice-${invoiceId}`,
          weight: 320,
          tone: 'danger',
          label: 'Disputed invoice',
          title: tenantNameFor(tenantId),
          detail: `Invoice ${baseDetail} was marked disputed and needs an owner decision.`,
          actions: [
            `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="paid">Mark paid</button>`,
            `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="refunded">Mark refunded</button>`,
          ].join(''),
        });
        return;
      }
      if (status === 'refunded') {
        pushItem({
          key: `invoice-${invoiceId}`,
          weight: 180,
          tone: 'warning',
          label: 'Refund follow-up',
          title: tenantNameFor(tenantId),
          detail: `Invoice ${baseDetail} was refunded. Review whether the subscription should stay active or be recovered.`,
          actions: context.subscriptionId
            ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(context.tenantId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-currency="${escapeHtml(context.currency)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-external-ref="${escapeHtml(context.externalRef)}">Reactivate subscription</button>`
            : '',
        });
        return;
      }
      pushItem({
        key: `invoice-${invoiceId}`,
        weight: status === 'past_due' ? 300 : 240,
        tone: status === 'past_due' ? 'danger' : 'warning',
        label: status === 'past_due' ? 'Past-due invoice' : 'Open invoice',
        title: tenantNameFor(tenantId),
        detail: `Invoice ${baseDetail} is still waiting for collection.`,
        actions: [
          `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="paid">Mark paid</button>`,
          `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(context.tenantId)}" data-invoice-id="${escapeHtml(context.invoiceId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-currency="${escapeHtml(context.currency)}">Retry checkout</button>`,
        ].join(''),
      });
    });

    rows.forEach((row) => {
      const subscription = row && row.subscription ? row.subscription : {};
      const subscriptionId = trimText(subscription && subscription.id, 160);
      const status = trimText(subscription && subscription.status, 40).toLowerCase();
      if (!subscriptionId || !['canceled', 'expired', 'past_due'].includes(status)) return;
      pushItem({
        key: `subscription-${subscriptionId}`,
        weight: status === 'past_due' ? 220 : 160,
        tone: status === 'past_due' ? 'warning' : 'info',
        label: status === 'past_due' ? 'Subscription at risk' : 'Recover subscription',
        title: firstNonEmpty([row && row.tenant && (row.tenant.name || row.tenant.slug), row && row.tenantId], '-'),
        detail: `Subscription ${subscriptionId} is ${formatOwnerDisplayValue(status)}. Plan ${firstNonEmpty([subscription && subscription.planId, row && row.packageId], '-')}.`,
        actions: `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(trimText(row && row.tenantId, 160))}" data-subscription-id="${escapeHtml(subscriptionId)}" data-plan-id="${escapeHtml(trimText(subscription && subscription.planId, 120))}" data-package-id="${escapeHtml(trimText(row && row.packageId || subscription && subscription.packageId, 120))}" data-billing-cycle="${escapeHtml(trimText(subscription && subscription.billingCycle, 40) || 'monthly')}" data-currency="${escapeHtml(trimText(subscription && subscription.currency, 12) || 'THB')}" data-amount-cents="${escapeHtml(String(Number(subscription && subscription.amountCents) || 0))}" data-external-ref="${escapeHtml(trimText(subscription && subscription.externalRef, 200))}">Reactivate subscription</button>`,
      });
    });

    return queue
      .sort((left, right) => (Number(right && right.weight) || 0) - (Number(left && left.weight) || 0))
      .slice(0, 6);
  }

  function buildExpiringRows(tenantRows) {
    const soon = Date.now() + (14 * 24 * 60 * 60 * 1000);
    return (Array.isArray(tenantRows) ? tenantRows : []).filter((row) => {
      const renewsAt = parseDate(row.subscription && (row.subscription.renewsAt || row.subscription.expiresAt || row.subscription.endsAt));
      if (!renewsAt) return false;
      return renewsAt.getTime() <= soon;
    }).map((row) => ({
      tenantId: row.tenantId,
      name: row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId,
      packageLabel: row.packageLabel,
      status: row.status,
      renewsAt: row.subscription && (row.subscription.renewsAt || row.subscription.expiresAt || row.subscription.endsAt),
      amountLabel: formatCurrencyCents(row.subscription && row.subscription.amountCents || 0, row.subscription && row.subscription.currency || 'THB'),
    }));
  }

  function matchByTenantAgentRuntime(row, tenantId, serverId, agentId, runtimeKey) {
    const rowTenantId = trimText(row && row.tenantId, 160);
    const rowServerId = trimText(row && row.serverId, 160);
    const rowAgentId = trimText(row && row.agentId, 160);
    const rowRuntimeKey = trimText(row && row.runtimeKey, 160);
    return rowTenantId === tenantId
      && (!serverId || rowServerId === serverId)
      && (!agentId || rowAgentId === agentId)
      && (!runtimeKey || rowRuntimeKey === runtimeKey);
  }

  function buildRuntimeRows(state) {
    const tenants = new Map((Array.isArray(state.tenants) ? state.tenants : []).map((row) => [trimText(row && row.id, 160), row]));
    const registry = Array.isArray(state.agentRegistry) ? state.agentRegistry : [];
    const provisionings = Array.isArray(state.agentProvisioning) ? state.agentProvisioning : [];
    const devices = Array.isArray(state.agentDevices) ? state.agentDevices : [];
    const credentials = Array.isArray(state.agentCredentials) ? state.agentCredentials : [];
    const runtimes = Array.isArray(state.agents) ? state.agents : [];
    const rows = new Map();

    function upsert(key, patch) {
      const previous = rows.get(key) || {
        key,
        tenantId: '',
        tenantName: '',
        serverId: '',
        guildId: '',
        agentId: '',
        runtimeKey: '',
        displayName: '',
        role: '',
        scope: '',
        version: '',
        status: 'offline',
        machineName: '',
        lastSeenAt: '',
        apiKeyId: '',
        deviceId: '',
        provisionTokenId: '',
        provisionStatus: '',
        minimumVersion: '',
        canProvision: false,
        provisioningSource: null,
      };
      const next = {
        ...previous,
        ...patch,
      };
      if (!next.tenantName) {
        next.tenantName = firstNonEmpty([
          tenants.get(next.tenantId) && (tenants.get(next.tenantId).name || tenants.get(next.tenantId).slug),
          next.tenantId,
          '-',
        ]);
      }
      rows.set(key, next);
      return next;
    }

    registry.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      const key = `${tenantId}::${serverId}::${agentId || runtimeKey || 'runtime'}`;
      const runtime = entry && entry.runtime && typeof entry.runtime === 'object' ? entry.runtime : {};
      const latestSession = Array.isArray(entry && entry.sessions) && entry.sessions.length ? entry.sessions[0] : {};
      const binding = Array.isArray(entry && entry.bindings) && entry.bindings.length ? entry.bindings[0] : {};
      upsert(key, {
        tenantId,
        serverId,
        guildId: trimText(entry && entry.guildId, 160),
        agentId,
        runtimeKey,
        displayName: firstNonEmpty([
          entry && entry.displayName,
          entry && entry.name,
          runtime && runtime.runtimeKey,
          runtimeKey,
          agentId,
        ], 'Runtime'),
        role: firstNonEmpty([entry && entry.role, runtime && runtime.meta && runtime.meta.agentRole], '-'),
        scope: firstNonEmpty([entry && entry.scope, runtime && runtime.meta && runtime.meta.agentScope], '-'),
        version: firstNonEmpty([runtime && runtime.version, latestSession && latestSession.version], '-'),
        status: firstNonEmpty([runtime && runtime.status, entry && entry.status, 'offline']),
        machineName: firstNonEmpty([
          runtime && runtime.meta && runtime.meta.hostname,
          latestSession && latestSession.hostname,
        ], ''),
        lastSeenAt: firstNonEmpty([
          runtime && (runtime.lastSeenAt || runtime.updatedAt || runtime.heartbeatAt),
          latestSession && (latestSession.heartbeatAt || latestSession.lastSeenAt),
          entry && entry.updatedAt,
        ], ''),
        apiKeyId: trimText(binding && binding.apiKeyId, 160),
        minimumVersion: firstNonEmpty([binding && binding.minVersion, entry && entry.minimumVersion], ''),
      });
    });

    runtimes.forEach((entry) => {
      const meta = entry && entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = firstNonEmpty([entry && entry.serverId, meta.serverId], '');
      const agentId = firstNonEmpty([entry && entry.agentId, meta.agentId], '');
      const runtimeKey = firstNonEmpty([entry && entry.runtimeKey, meta.runtimeKey], '');
      const key = `${tenantId}::${serverId}::${agentId || runtimeKey || 'runtime'}`;
      upsert(key, {
        tenantId,
        serverId,
        guildId: firstNonEmpty([entry && entry.guildId, meta.guildId], ''),
        agentId,
        runtimeKey,
        displayName: firstNonEmpty([entry && entry.displayName, runtimeKey, agentId], 'Runtime'),
        role: firstNonEmpty([meta.agentRole, entry && entry.role], '-'),
        scope: firstNonEmpty([meta.agentScope, entry && entry.scope], '-'),
        version: firstNonEmpty([entry && entry.version], '-'),
        status: firstNonEmpty([entry && entry.status], 'offline'),
        machineName: firstNonEmpty([meta.hostname], ''),
        lastSeenAt: firstNonEmpty([entry && (entry.lastSeenAt || entry.updatedAt)], ''),
      });
    });

    credentials.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      const key = `${tenantId}::${serverId}::${agentId || runtimeKey || trimText(entry && entry.apiKeyId, 160)}`;
      upsert(key, {
        tenantId,
        serverId,
        guildId: trimText(entry && entry.guildId, 160),
        agentId,
        runtimeKey,
        displayName: firstNonEmpty([entry && entry.displayName, runtimeKey, agentId], 'Runtime'),
        role: firstNonEmpty([entry && entry.role], '-'),
        scope: firstNonEmpty([entry && entry.scope], '-'),
        apiKeyId: trimText(entry && entry.apiKeyId, 160),
        deviceId: trimText(entry && entry.deviceId, 160),
        minimumVersion: firstNonEmpty([entry && entry.minVersion], ''),
      });
    });

    devices.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      const key = `${tenantId}::${serverId}::${agentId || runtimeKey || trimText(entry && entry.id, 160)}`;
      upsert(key, {
        tenantId,
        serverId,
        guildId: trimText(entry && entry.guildId, 160),
        agentId,
        runtimeKey,
        deviceId: trimText(entry && entry.id, 160),
        machineName: firstNonEmpty([entry && entry.hostname], ''),
        lastSeenAt: firstNonEmpty([entry && entry.lastSeenAt], ''),
      });
    });

    provisionings.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      const key = `${tenantId}::${serverId}::${agentId || runtimeKey || trimText(entry && entry.id, 160)}`;
      upsert(key, {
        tenantId,
        serverId,
        guildId: trimText(entry && entry.guildId, 160),
        agentId,
        runtimeKey,
        displayName: firstNonEmpty([entry && entry.displayName, entry && entry.name, runtimeKey, agentId], 'Runtime'),
        role: firstNonEmpty([entry && entry.role], '-'),
        scope: firstNonEmpty([entry && entry.scope], '-'),
        provisionTokenId: trimText(entry && (entry.tokenId || entry.id), 160),
        provisionStatus: firstNonEmpty([entry && entry.status], ''),
        minimumVersion: firstNonEmpty([entry && entry.minVersion], ''),
        canProvision: Boolean(tenantId && serverId && agentId),
        provisioningSource: entry,
      });
    });

    return Array.from(rows.values()).map((row) => {
      const boundDevice = row.deviceId
        ? devices.find((entry) => trimText(entry && entry.id, 160) === row.deviceId)
        : devices.find((entry) => matchByTenantAgentRuntime(entry, row.tenantId, row.serverId, row.agentId, row.runtimeKey));
      const lastSeenAt = firstNonEmpty([
        row.lastSeenAt,
        boundDevice && boundDevice.lastSeenAt,
      ], '');
      const machineName = firstNonEmpty([
        row.machineName,
        boundDevice && boundDevice.hostname,
      ], 'ยังไม่ bind เครื่อง');
      let status = trimText(row.status).toLowerCase();
      if (!status && trimText(row.provisionStatus).toLowerCase() === 'pending_activation') {
        status = 'pending_activation';
      }
      if (!status) status = row.apiKeyId ? 'offline' : 'pending_activation';
      return {
        ...row,
        lastSeenAt,
        machineName,
        status,
        statusTone: toneForStatus(status),
        runtimeKind: row.role === 'execute' ? 'delivery-agents' : 'server-bots',
        canResetBinding: Boolean(row.deviceId),
        canRevokeRuntime: Boolean(row.apiKeyId || row.provisionTokenId),
        canReissueToken: Boolean(row.canProvision || (row.tenantId && row.serverId && row.agentId && row.role)),
      };
    }).sort((left, right) => {
      const weight = { danger: 3, warning: 2, success: 1, muted: 0 };
      return (weight[right.statusTone] || 0) - (weight[left.statusTone] || 0);
    });
  }

  function renderMetricCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odvc4-metric-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-table-label">${escapeHtml(translateOwnerControlText(item.label || ''))}</span>`,
      `<strong>${escapeHtml(translateOwnerControlText(item.value || '-'))}</strong>`,
      item.detail ? `<p>${escapeHtml(translateOwnerControlText(item.detail))}</p>` : '',
      '</article>',
    ].join('')).join('');
  }

  function buildTenantRuntimeRows(runtimeRows, tenantId) {
    const scopedTenantId = trimText(tenantId, 160);
    return (Array.isArray(runtimeRows) ? runtimeRows : [])
      .filter((row) => trimText(row && row.tenantId, 160) === scopedTenantId);
  }

  function renderRuntimeActionButtons(row) {
    if (!row || typeof row !== 'object') return '';
    return [
      `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="inspect-runtime" data-runtime-key="${escapeHtml(row.runtimeKey)}">ตรวจบริการ</button>`,
      row.canReissueToken
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reissue-runtime-token" data-runtime-key="${escapeHtml(row.runtimeKey)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-server-id="${escapeHtml(row.serverId)}" data-guild-id="${escapeHtml(row.guildId)}" data-agent-id="${escapeHtml(row.agentId)}" data-role="${escapeHtml(row.role)}" data-scope="${escapeHtml(row.scope)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}" data-display-name="${escapeHtml(row.displayName)}" data-minimum-version="${escapeHtml(row.minimumVersion)}">ออกโทเค็นใหม่</button>`
        : '',
      row.canResetBinding
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reset-runtime-binding" data-device-id="${escapeHtml(row.deviceId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">รีเซ็ตการผูกเครื่อง</button>`
        : '',
      row.apiKeyId
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-runtime" data-api-key-id="${escapeHtml(row.apiKeyId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">ยกเลิกสิทธิ์บริการ</button>`
        : row.provisionTokenId
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-runtime" data-token-id="${escapeHtml(row.provisionTokenId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">ยกเลิกสิทธิ์บริการ</button>`
          : '',
    ].join('');
  }

  function renderTenantRuntimeTable(runtimeRows, options = {}) {
    const rows = Array.isArray(runtimeRows) ? runtimeRows : [];
    const emptyMessage = trimText(options && options.emptyMessage, 240) || 'ยังไม่มีบอทที่ลงทะเบียนไว้สำหรับลูกค้ารายนี้';
    const tableRows = rows.map((row) => [
      '<tr>',
      `<td><strong>${escapeHtml(row.displayName || row.runtimeKey || row.agentId)}</strong><div class="odvc4-table-note">${escapeHtml(row.runtimeKey || row.agentId || '-')}</div></td>`,
      `<td>${escapeHtml(row.runtimeKind === 'delivery-agents' ? 'บอทส่งของ' : 'บอทเซิร์ฟเวอร์')}</td>`,
      `<td><span class="odv4-pill odv4-pill-${escapeHtml(row.statusTone)}">${escapeHtml(translateOwnerControlText(row.status))}</span><div class="odvc4-table-note">${escapeHtml(row.machineName || '-')}</div></td>`,
      `<td>${escapeHtml(firstNonEmpty([row.version, '-']))}</td>`,
      `<td>${escapeHtml(row.lastSeenAt ? formatRelative(row.lastSeenAt) : '-')}</td>`,
      `<td><div class="odvc4-inline-actions">${renderRuntimeActionButtons(row)}</div></td>`,
      '</tr>',
    ].join('')).join('');
    return [
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>บอท</th><th>ประเภท</th><th>สถานะ</th><th>เวอร์ชัน</th><th>พบล่าสุด</th><th>การทำงาน</th></tr></thead><tbody>',
      tableRows || `<tr><td colspan="6">${escapeHtml(emptyMessage)}</td></tr>`,
      '</tbody></table></div>',
    ].join('');
  }

  function renderSelectOptions(items, currentValue) {
    return (Array.isArray(items) ? items : []).map((item) => {
      const value = trimText(item && item.value, 160);
      const selected = value === trimText(currentValue, 160) ? ' selected' : '';
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(translateOwnerControlText(firstNonEmpty([item && item.label, value], value)))}</option>`;
    }).join('');
  }

  function renderFormField(field) {
    const type = trimText(field && field.type, 40) || 'text';
    const name = trimText(field && field.name, 120);
    const value = field && field.value != null ? field.value : '';
    const description = translateOwnerControlText(field && field.description);
    const required = field && field.required ? ' required' : '';
    const label = translateOwnerControlText(field && field.label) || name;
    const explicitAutocomplete = trimText(field && field.autocomplete, 80);
    const autocompleteValue = explicitAutocomplete || (
      type === 'password'
        ? 'new-password'
        : type === 'email'
          ? 'email'
          : 'off'
    );
    const autocompleteAttr = autocompleteValue ? ` autocomplete="${escapeHtml(autocompleteValue)}"` : '';
    if (type === 'hidden') {
      return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
    }
    let control = '';
    if (type === 'select') {
      control = `<select name="${escapeHtml(name)}"${required}${autocompleteAttr}>${renderSelectOptions(field && field.options, value)}</select>`;
    } else if (type === 'textarea') {
      control = `<textarea name="${escapeHtml(name)}" rows="3"${required}${autocompleteAttr}>${escapeHtml(value)}</textarea>`;
    } else {
      control = `<input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${required}${autocompleteAttr}>`;
    }
    return [
      '<label class="odvc4-field">',
      `<span class="odvc4-field-label">${escapeHtml(label)}</span>`,
      control,
      description ? `<span class="odvc4-field-note">${escapeHtml(description)}</span>` : '',
      '</label>',
    ].join('');
  }

  function mapBooleanOptions(currentValue) {
    return [
      { value: 'true', label: 'เปิดใช้งาน' },
      { value: 'false', label: 'ปิดใช้งาน' },
    ].map((entry) => ({
      ...entry,
      selected: String(currentValue) === entry.value,
    }));
  }

  function buildEnvFieldDescription(entry) {
    const notes = [];
    const description = translateOwnerControlText(entry && entry.description);
    if (description) notes.push(description);
    const applyMode = trimText(entry && entry.applyMode, 80);
    if (applyMode === 'restart-required') {
      notes.push('บันทึกแล้วต้องรีสตาร์ต');
    } else if (applyMode === 'reload-safe') {
      notes.push('บันทึกแล้วรีโหลดได้ทันที');
    }
    if (entry && entry.secret && entry.configured) {
      notes.push('ตั้งค่าไว้แล้ว กรอกใหม่เฉพาะตอนหมุนคีย์');
    }
    return notes.join(' · ');
  }

  function renderEnvField(fileKey, key, entry) {
    if (!entry || entry.editable !== true) return '';
    const name = `${fileKey}.${key}`;
    const type = trimText(entry.type, 40).toLowerCase();
    const options = Array.isArray(entry.options) ? entry.options : [];
    const description = buildEnvFieldDescription(entry);
    if (type === 'boolean') {
      return renderFormField({
        name,
        label: entry.label || key,
        type: 'select',
        value: entry.value === true ? 'true' : 'false',
        options: mapBooleanOptions(entry.value === true ? 'true' : 'false'),
        description,
      });
    }
    if (options.length > 0) {
      return renderFormField({
        name,
        label: entry.label || key,
        type: 'select',
        value: entry.value,
        options: options.map((option) => ({
          value: option && option.value,
          label: option && option.label,
        })),
        description,
      });
    }
    return renderFormField({
      name,
      label: entry.label || key,
      type: type === 'secret' ? 'password' : (type || 'text'),
      value: type === 'secret' ? '' : entry.value,
      description,
    });
  }

  function pickEditableEntries(section, keys) {
    const source = section && typeof section === 'object' ? section : {};
    return (Array.isArray(keys) ? keys : []).map((key) => ({
      key,
      entry: source[key] || null,
    })).filter((row) => row.entry && row.entry.editable === true);
  }

  function renderEnvSettingsPanel(config) {
    const {
      id,
      kicker,
      title,
      copy,
      fileKey,
      section,
      keys,
      submitLabel,
      note,
    } = config || {};
    const entries = pickEditableEntries(section, keys);
    if (!entries.length) {
      return [
        `<section class="odv4-panel odvc4-panel" id="${escapeHtml(id || 'owner-settings-empty')}">`,
        `<div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(kicker || 'Settings')}</span><h2 class="odv4-section-title">${escapeHtml(title || 'No editable settings')}</h2><p class="odv4-section-copy">${escapeHtml(copy || 'No editable settings are available in this section right now.')}</p></div>`,
        '</section>',
      ].join('');
    }
    return [
      `<section class="odv4-panel odvc4-panel" id="${escapeHtml(id || 'owner-settings-panel')}">`,
      `<div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(kicker || 'Settings')}</span><h2 class="odv4-section-title">${escapeHtml(title || 'Edit settings')}</h2><p class="odv4-section-copy">${escapeHtml(copy || '')}</p></div>`,
      '<form class="odvc4-form" data-owner-form="update-control-panel-env">',
      '<div class="odvc4-form-grid">',
      entries.map((row) => renderEnvField(fileKey, row.key, row.entry)).join(''),
      '</div>',
      `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">${escapeHtml(submitLabel || 'Save settings')}</button><span class="odvc4-inline-note">${escapeHtml(note || 'Changes stay inside the existing control-plane flow and do not write files from the browser directly.')}</span></div>`,
      '</form>',
      '</section>',
    ].join('');
  }

  function renderAdminUsersTable(adminUsers) {
    const rows = (Array.isArray(adminUsers) ? adminUsers : []).slice(0, 16).map((row) => [
      '<tr>',
      `<td>${escapeHtml(firstNonEmpty([row && row.username, '-']))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([row && row.role, '-']))}</td>`,
      `<td>${escapeHtml(row && row.isActive === false ? 'ไม่ใช้งาน' : 'ใช้งานอยู่')}</td>`,
      `<td>${escapeHtml(firstNonEmpty([row && row.tenantId, 'ทั้งแพลตฟอร์ม']))}</td>`,
      '</tr>',
    ].join('')).join('');
    return rows || '<tr><td colspan="4">ยังไม่มีบัญชีผู้ดูแล</td></tr>';
  }

  function renderManagedServicesTable(services) {
    const rows = (Array.isArray(services) ? services : []).map((service) => [
      '<tr>',
      `<td><strong>${escapeHtml(translateOwnerControlText(service.label || service.key))}</strong><div class="odvc4-table-note">${escapeHtml(translateOwnerControlText(service.description || service.pm2Name || ''))}</div></td>`,
      `<td>${escapeHtml(service.pm2Name || '-')}</td>`,
      `<td><button class="odv4-button odv4-button-secondary" type="button" data-owner-action="restart-managed-service" data-service-key="${escapeHtml(service.key)}" data-service-label="${escapeHtml(service.label || service.key)}">รีสตาร์ตบริการ</button></td>`,
      '</tr>',
    ].join('')).join('');
    return rows || '<tr><td colspan="3">ยังไม่มีบริการที่ระบบดูแลอยู่</td></tr>';
  }

  function buildOwnerControlV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : {};
    const sectionHtml = Array.isArray(safeModel.sections) ? safeModel.sections.join('') : '';
    if (!sectionHtml) return '';
    return [
      `<section id="owner-control-workspace" class="odvc4-stack" data-owner-control-page="${escapeHtml(safeModel.routeKind || 'overview')}" data-owner-primary-label="${escapeHtml(safeModel.headerAction && safeModel.headerAction.label || '')}" data-owner-primary-href="${escapeHtml(safeModel.headerAction && safeModel.headerAction.href || '')}" data-owner-primary-local-focus="${safeModel.headerAction && safeModel.headerAction.localFocus ? '1' : '0'}">`,
      sectionHtml,
      '</section>',
    ].join('');
  }

  function renderOverviewWorkspace(state, tenantRows, invoiceSummary, runtimeRows) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const analytics = overview.analytics && typeof overview.analytics === 'object' ? overview.analytics : {};
    const tenantAnalytics = analytics.tenants && typeof analytics.tenants === 'object' ? analytics.tenants : {};
    const subscriptionAnalytics = analytics.subscriptions && typeof analytics.subscriptions === 'object' ? analytics.subscriptions : {};
    const deliveryAnalytics = analytics.delivery && typeof analytics.delivery === 'object' ? analytics.delivery : {};
    const expiringRows = buildExpiringRows(tenantRows);
    const onlineRuntimeCount = runtimeRows.filter((row) => row.statusTone === 'success').length;
    return [
      '<section class="odv4-panel odvc4-panel" data-owner-focus-route="overview">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานของเจ้าของระบบ</span><h2 class="odv4-section-title">งานแพลตฟอร์มที่ควรทำก่อน</h2><p class="odv4-section-copy">เริ่มจากงานที่กระทบรายได้ ลูกค้า และสถานะบริการก่อนลงลึกในมุมอื่น</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
    { label: 'ลูกค้าทั้งหมด', value: formatNumber(tenantAnalytics.total || tenantRows.length, '0'), detail: 'จำนวนลูกค้าทั้งหมดบนแพลตฟอร์ม', tone: 'info' },
    { label: 'ลูกค้าที่ใช้งานอยู่', value: formatNumber(tenantAnalytics.active || tenantRows.filter((row) => row.statusTone === 'success').length, '0'), detail: 'ลูกค้าที่บริการยังเดินต่อได้', tone: 'success' },
        { label: 'รายได้วันนี้', value: formatCurrencyCents(invoiceSummary.revenueTodayCents), detail: 'ยอดรับเงินวันนี้จาก invoice ที่จ่ายแล้ว', tone: 'success' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents || subscriptionAnalytics.mrrCents || 0), detail: 'ยอดรับเงินเดือนนี้ / MRR ล่าสุด', tone: 'info' },
        { label: 'Expiring soon', value: formatNumber(expiringRows.length, '0'), detail: 'subscription ที่ใกล้ต่ออายุภายใน 14 วัน', tone: expiringRows.length ? 'warning' : 'muted' },
        { label: 'บริการที่ออนไลน์', value: formatNumber(onlineRuntimeCount, '0'), detail: 'บอตส่งของและบอตเซิร์ฟเวอร์ที่ออนไลน์อยู่จริง', tone: onlineRuntimeCount ? 'success' : 'warning' },
        { label: 'Disputed invoices', value: formatNumber(invoiceSummary.disputedInvoiceCount, '0'), detail: 'Invoices waiting for billing review', tone: invoiceSummary.disputedInvoiceCount ? 'danger' : 'success' },
        { label: 'Refunded invoices', value: formatNumber(invoiceSummary.refundedInvoiceCount, '0'), detail: 'Invoices already refunded', tone: invoiceSummary.refundedInvoiceCount ? 'warning' : 'muted' },
        { label: 'Disputed invoices', value: formatNumber(invoiceSummary.disputedInvoiceCount, '0'), detail: 'Invoices waiting for billing review', tone: invoiceSummary.disputedInvoiceCount ? 'danger' : 'success' },
        { label: 'Refunded invoices', value: formatNumber(invoiceSummary.refundedInvoiceCount, '0'), detail: 'Invoices already refunded', tone: invoiceSummary.refundedInvoiceCount ? 'warning' : 'muted' },
        { label: 'Disputed invoices', value: formatNumber(invoiceSummary.disputedInvoiceCount, '0'), detail: 'Invoices waiting for billing review', tone: invoiceSummary.disputedInvoiceCount ? 'danger' : 'success' },
        { label: 'Refunded invoices', value: formatNumber(invoiceSummary.refundedInvoiceCount, '0'), detail: 'Invoices already refunded', tone: invoiceSummary.refundedInvoiceCount ? 'warning' : 'muted' },
      ])}</div>`,
      '<div class="odvc4-action-row">',
    '<a class="odv4-button odv4-button-primary" href="/owner/tenants">สร้างลูกค้า</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/subscriptions">ดูลูกค้าที่ใกล้ต่ออายุ</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">เปิดทะเบียนบริการ</a>',
      '</div>',
      `<div class="odvc4-note-card"><strong>สัญญาณการปฏิบัติการ</strong><p>งานที่ล้มเหลว: ${escapeHtml(formatNumber(deliveryAnalytics.failedJobs || 0, '0'))} · คิวงานค้าง: ${escapeHtml(formatNumber(deliveryAnalytics.queueDepth || 0, '0'))} · invoice ที่ยังไม่ปิด: ${escapeHtml(formatNumber(invoiceSummary.openInvoiceCount, '0'))}</p></div>`,
      '</section>',
    ].join('');
  }

  function renderTenantCreateWorkspace(packageCatalog) {
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-tenants-workspace" data-owner-focus-route="tenants create-tenant">',
    '<div class="odv4-section-head"><span class="odv4-section-kicker">จัดการลูกค้า</span><h2 class="odv4-section-title">สร้างลูกค้า</h2><p class="odv4-section-copy">เริ่มจากข้อมูลลูกค้าหลัก แล้วค่อยเข้าไปกำหนดแพ็กเกจและการสมัครใช้ในหน้ารายละเอียด</p></div>',
      '<form class="odvc4-form" data-owner-form="create-tenant">',
      '<div class="odvc4-form-grid">',
    renderFormField({ name: 'name', label: 'ชื่อลูกค้า', type: 'text', required: true, autocomplete: 'organization' }),
      renderFormField({ name: 'slug', label: 'Slug', type: 'text', description: 'ถ้าเว้นไว้ระบบจะ derive จากชื่อให้อัตโนมัติ', autocomplete: 'off' }),
      renderFormField({ name: 'ownerName', label: 'ชื่อผู้ดูแลหลัก', type: 'text', autocomplete: 'name' }),
      renderFormField({ name: 'ownerEmail', label: 'อีเมลผู้ดูแลหลัก', type: 'email', autocomplete: 'email' }),
      renderFormField({ name: 'type', label: 'ประเภท', type: 'select', value: 'trial', options: [
        { value: 'direct', label: 'ขายตรง' },
        { value: 'trial', label: 'ทดลองใช้' },
        { value: 'reseller', label: 'ตัวแทนขาย' },
        { value: 'demo', label: 'สาธิต' },
      ] }),
      renderFormField({ name: 'status', label: 'สถานะ', type: 'select', value: 'trialing', options: [
        { value: 'trialing', label: 'กำลังทดลองใช้' },
        { value: 'active', label: 'ใช้งานอยู่' },
        { value: 'paused', label: 'พักไว้' },
        { value: 'suspended', label: 'ระงับไว้' },
        { value: 'inactive', label: 'ไม่ใช้งาน' },
      ] }),
      renderFormField({ name: 'locale', label: 'ภาษา', type: 'select', value: 'th', options: [
        { value: 'th', label: 'ไทย' },
        { value: 'en', label: 'English' },
      ] }),
      renderFormField({ name: 'packageHint', label: 'แพ็กเกจแนะนำ', type: 'select', options: packageCatalog.map((entry) => ({ value: entry.id, label: buildOwnerPackageOptionLabel(entry) })) }),
      '</div>',
    '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">สร้างลูกค้า</button><span class="odvc4-inline-note">หลังสร้างเสร็จให้เข้าไปกำหนดแพ็กเกจและการสมัครใช้ต่อในหน้ารายละเอียดลูกค้า</span></div>',
      '</form>',
      '</section>',
    ].join('');
  }

  function renderTenantDetailWorkspace(tenantRow, packageCatalog, planOptions, runtimeRows) {
    if (!tenantRow) {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-empty">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">รายละเอียดลูกค้า</span><h2 class="odv4-section-title">ยังไม่พบลูกค้ารายนี้</h2><p class="odv4-section-copy">กลับไปที่รายชื่อลูกค้าแล้วเลือกใหม่จากทะเบียนของเจ้าของระบบ</p></div>',
        '<div class="odvc4-action-row"><a class="odv4-button odv4-button-primary" href="/owner/tenants">เปิดรายชื่อลูกค้า</a></div>',
        '</section>',
      ].join('');
    }
    const tenant = tenantRow.tenant || {};
    const subscription = tenantRow.subscription || {};
    const selectedPackageId = firstNonEmpty([tenantRow.packageId, packageCatalog[0] && packageCatalog[0].id], '');
    const packageLabelLookup = buildOwnerPackageLabelLookup(packageCatalog);
    const tenantRuntimeRows = runtimeRows.filter((row) => row.tenantId === tenantRow.tenantId);
    const runtimeOnline = tenantRuntimeRows.filter((row) => row.statusTone === 'success').length;
    const runtimePending = tenantRuntimeRows.filter((row) => row.status === 'pending_activation').length;
    const currentStatus = trimText(tenant.status || 'active').toLowerCase() || 'active';
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-summary" data-owner-focus-route="tenant-detail">',
    '<div class="odv4-section-head"><span class="odv4-section-kicker">รายละเอียดลูกค้า</span><h2 class="odv4-section-title">จัดการลูกค้า</h2><p class="odv4-section-copy">เจ้าของระบบใช้หน้านี้ดูแพ็กเกจ การสมัครใช้ ภาพรวมบริการ และเปลี่ยนสถานะเชิงแพลตฟอร์มของลูกค้ารายนี้</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
    { label: 'ลูกค้า', value: tenant.name || tenant.slug || tenantRow.tenantId, detail: tenant.ownerEmail || tenant.ownerName || '-', tone: 'info' },
        { label: 'Current package', value: formatOwnerPackageDisplayLabel(firstNonEmpty([tenantRow.packageLabel, selectedPackageId], '-'), packageLabelLookup), detail: subscription.planId || 'ยังไม่มี subscription', tone: 'success' },
        { label: 'Subscription', value: firstNonEmpty([subscription.status, tenant.status, 'active']), detail: subscription.renewsAt ? formatDateTime(subscription.renewsAt) : 'ยังไม่มีรอบต่ออายุ', tone: tenantRow.statusTone },
        { label: 'ภาพรวมบริการ', value: `${formatNumber(runtimeOnline, '0')} ออนไลน์ / ${formatNumber(runtimePending, '0')} รอเปิดใช้งาน`, detail: `ทั้งหมด ${formatNumber(tenantRuntimeRows.length, '0')} บริการ`, tone: runtimePending > 0 ? 'warning' : 'info' },
        { label: 'โควตา', value: tenantRow.quota.text, detail: tenantRow.invoiceLabel, tone: tenantRow.quota.tone },
        { label: 'สถานะ', value: firstNonEmpty([tenant.status, 'active']), detail: `อัปเดตล่าสุด ${formatRelative(tenant.updatedAt || tenant.createdAt)}`, tone: toneForStatus(tenant.status || 'active') },
      ])}</div>`,
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-form">',
    '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">แก้ไขข้อมูลลูกค้า</h2><p class="odv4-section-copy">แก้ไข metadata ผู้ติดต่อหลัก ภาษา และสถานะลูกค้า โดยไม่เข้าไปแตะงานปฏิบัติการของเซิร์ฟเวอร์</p></div>',
      '<form class="odvc4-form" data-owner-form="update-tenant">',
      renderFormField({ name: 'id', type: 'hidden', value: tenantRow.tenantId }),
      '<div class="odvc4-form-grid">',
    renderFormField({ name: 'name', label: 'Customer name', type: 'text', required: true, value: tenant.name || '', autocomplete: 'organization' }),
      renderFormField({ name: 'slug', label: 'Slug', type: 'text', required: true, value: tenant.slug || '', autocomplete: 'off' }),
      renderFormField({ name: 'ownerName', label: 'Owner name', type: 'text', value: tenant.ownerName || '', autocomplete: 'name' }),
      renderFormField({ name: 'ownerEmail', label: 'Owner email', type: 'email', value: tenant.ownerEmail || '', autocomplete: 'email' }),
      renderFormField({ name: 'type', label: 'Type', type: 'select', value: tenant.type || 'direct', options: [
        { value: 'direct', label: 'Direct' },
        { value: 'trial', label: 'Trial' },
        { value: 'reseller', label: 'Reseller' },
        { value: 'demo', label: 'Demo' },
      ] }),
      renderFormField({ name: 'status', label: 'Status', type: 'select', value: tenant.status || 'active', options: [
        { value: 'active', label: 'Active' },
        { value: 'trialing', label: 'Trialing' },
        { value: 'paused', label: 'Paused' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'inactive', label: 'Inactive' },
      ] }),
      renderFormField({ name: 'locale', label: 'Locale', type: 'select', value: tenant.locale || 'th', options: [
        { value: 'th', label: 'Thai' },
        { value: 'en', label: 'English' },
      ] }),
      renderFormField({ name: 'parentTenantId', label: 'Parent tenant', type: 'text', value: tenant.parentTenantId || '' }),
      '</div>',
      '<div class="odvc4-form-actions">',
    '<button class="odv4-button odv4-button-primary" type="submit">บันทึกข้อมูลลูกค้า</button>',
    `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="set-tenant-status" data-tenant-id="${escapeHtml(tenantRow.tenantId)}" data-target-status="${currentStatus === 'suspended' ? 'active' : 'suspended'}">${escapeHtml(currentStatus === 'suspended' ? 'Reactivate customer' : 'Suspend customer')}</button>`,
      '</div>',
      '</form>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-subscription-form">',
    '<div class="odv4-section-head"><span class="odv4-section-kicker">การควบคุมเชิงพาณิชย์</span><h2 class="odv4-section-title">กำหนดหรือเปลี่ยนแพ็กเกจ</h2><p class="odv4-section-copy">ใช้แค็ตตาล็อกแพ็กเกจเดิมเป็นข้อมูลอ้างอิงหลัก แล้วแก้แผนและสถานะการชำระของลูกค้ารายนี้ได้จากหน้าเจ้าของระบบโดยตรง</p></div>',
      '<form class="odvc4-form" data-owner-form="update-subscription">',
      renderFormField({ name: 'tenantId', type: 'hidden', value: tenantRow.tenantId }),
      renderFormField({ name: 'subscriptionId', type: 'hidden', value: subscription.id || '' }),
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'packageId', label: 'Package', type: 'select', value: selectedPackageId, options: packageCatalog.map((entry) => ({ value: entry.id, label: buildOwnerPackageOptionLabel(entry) })) }),
      renderFormField({ name: 'planId', label: 'Plan ID', type: 'select', value: subscription.planId || selectedPackageId, options: planOptions }),
      renderFormField({ name: 'billingCycle', label: 'Billing cycle', type: 'select', value: subscription.billingCycle || 'monthly', options: [
        { value: 'trial', label: 'Trial' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'yearly', label: 'Yearly' },
      ] }),
      renderFormField({ name: 'status', label: 'Subscription status', type: 'select', value: subscription.status || 'active', options: [
        { value: 'active', label: 'Active' },
        { value: 'trialing', label: 'Trialing' },
        { value: 'pending', label: 'Pending' },
        { value: 'past_due', label: 'Past due' },
        { value: 'canceled', label: 'Canceled' },
        { value: 'expired', label: 'Expired' },
      ] }),
      renderFormField({ name: 'amountCents', label: 'Amount (cents)', type: 'number', value: subscription.amountCents || 0 }),
      renderFormField({ name: 'currency', label: 'Currency', type: 'text', value: subscription.currency || 'THB' }),
      renderFormField({ name: 'renewsAt', label: 'Renews at', type: 'datetime-local', value: toLocalDateTimeInputValue(subscription.renewsAt || subscription.expiresAt || subscription.endsAt) }),
      renderFormField({ name: 'externalRef', label: 'External ref', type: 'text', value: subscription.externalRef || '' }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">บันทึกการกำหนดแพ็กเกจ</button><a class="odv4-button odv4-button-secondary" href="/owner/runtime">ตรวจบริการของลูกค้า</a></div>',
      '</form>',
      '</section>',
    ].join('');
  }

  function renderTenantSupportWorkspace(tenantRow, supportCase, loading = false) {
    if (!tenantRow) {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-empty" data-owner-focus-route="support-detail">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">งานดูแลลูกค้า</span><h2 class="odv4-section-title">ไม่พบเคสของลูกค้านี้</h2><p class="odv4-section-copy">กลับไปที่รายชื่อลูกค้า แล้วเปิดงานดูแลลูกค้าใหม่จากแถวของลูกค้ารายนั้น</p></div>',
        '<div class="odvc4-action-row"><a class="odv4-button odv4-button-primary" href="/owner/tenants">เปิดรายชื่อลูกค้า</a></div>',
        '</section>',
      ].join('');
    }

    const tenant = tenantRow.tenant || {};
    const bundle = supportCase && trimText(supportCase.tenantId, 160) === tenantRow.tenantId
      ? supportCase
      : null;
    const lifecycle = bundle && bundle.lifecycle && typeof bundle.lifecycle === 'object'
      ? bundle.lifecycle
      : {};
    const onboarding = bundle && bundle.onboarding && typeof bundle.onboarding === 'object'
      ? bundle.onboarding
      : { completed: 0, total: 0, requiredCompleted: 0, requiredTotal: 0, items: [] };
    const signalItems = Array.isArray(bundle && bundle.signals && bundle.signals.items)
      ? bundle.signals.items
      : [];
    const actionItems = Array.isArray(bundle && bundle.actions)
      ? bundle.actions
      : [];
    const diagnostics = bundle && bundle.diagnostics && typeof bundle.diagnostics === 'object'
      ? bundle.diagnostics
      : {};
    const exportBase = `/admin/api/platform/tenant-support-case/export?tenantId=${encodeURIComponent(tenantRow.tenantId)}`;
    const signalRows = signalItems.map((item) => [
      '<tr>',
      `<td>${escapeHtml(firstNonEmpty([item && item.key], '-'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.tone], '-'))}</td>`,
      `<td>${escapeHtml(formatNumber(item && item.count, '0'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.detail], '-'))}</td>`,
      '</tr>',
    ].join('')).join('');
    const onboardingRows = (Array.isArray(onboarding.items) ? onboarding.items : []).map((item) => [
      '<tr>',
      `<td>${escapeHtml(firstNonEmpty([item && item.key], '-'))}</td>`,
      `<td>${escapeHtml(item && item.required ? 'Required' : 'Optional')}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.status], '-'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.detail], '-'))}</td>`,
      '</tr>',
    ].join('')).join('');
    const supportActionCards = actionItems.map((item) => [
      `<article class="odvc4-metric-card odv4-tone-${escapeHtml(item && item.tone || 'muted')}">`,
      `<span class="odv4-table-label">${escapeHtml(firstNonEmpty([item && item.key], 'งานถัดไป'))}</span>`,
      `<strong>${escapeHtml(firstNonEmpty([item && item.detail], 'ยังไม่มีรายละเอียดเพิ่มเติม'))}</strong>`,
      '</article>',
    ].join('')).join('');

    return [
      `<section class="odv4-panel odvc4-panel" id="owner-tenant-support-workspace" data-owner-focus-route="support-detail support-${escapeHtml(tenantRow.tenantId)}">`,
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานดูแลลูกค้า</span><h2 class="odv4-section-title">เคสดูแลลูกค้า</h2><p class="odv4-section-copy">ใช้หน้านี้ดูบริบทพร้อมช่วยเหลือของลูกค้ารายนี้ ทั้งจุดติด onboarding สัญญาณความเสี่ยง สถานะวิเคราะห์ และงานถัดไปที่ควรทำ</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        {
          label: 'ลูกค้า',
          value: tenant.name || tenant.slug || tenantRow.tenantId,
          detail: firstNonEmpty([tenant.ownerEmail, tenant.ownerName], '-'),
          tone: 'info',
        },
        {
          label: 'วงจรสถานะ',
          value: firstNonEmpty([lifecycle.label], loading ? 'กำลังโหลดเคสดูแลลูกค้า...' : 'ยังไม่มีข้อมูล'),
          detail: firstNonEmpty([lifecycle.detail], loading ? 'กำลังรวบรวมบริบทช่วยเหลืออยู่ตอนนี้' : 'ตอนนี้ยังไม่มีชุดข้อมูลช่วยเหลือของลูกค้ารายนี้'),
          tone: firstNonEmpty([lifecycle.tone], loading ? 'info' : 'muted'),
        },
        {
          label: 'Onboarding ที่จำเป็น',
          value: `${formatNumber(onboarding.requiredCompleted, '0')} / ${formatNumber(onboarding.requiredTotal, '0')}`,
          detail: 'จำนวนรายการ onboarding ที่จำเป็นและทำเสร็จแล้ว',
          tone: onboarding.requiredTotal > 0 && onboarding.requiredCompleted < onboarding.requiredTotal ? 'warning' : 'success',
        },
        {
          label: 'สัญญาณที่ต้องดู',
          value: formatNumber(bundle && bundle.signals && bundle.signals.total, '0'),
          detail: `${formatNumber(diagnostics.delivery && diagnostics.delivery.deadLetters, '0')} dead letters · ${formatNumber(diagnostics.delivery && diagnostics.delivery.anomalies, '0')} delivery anomalies`,
          tone: signalItems.length > 0 ? 'warning' : 'success',
        },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      `<a class="odv4-button odv4-button-primary" href="${escapeHtml(ownerTenantHref(tenantRow.tenantId))}">เปิดรายละเอียดลูกค้า</a>`,
      `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${exportBase}&format=json`)}">ส่งออก JSON</a>`,
      `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${exportBase}&format=csv`)}">ส่งออก CSV</a>`,
      '</div>',
      bundle
        ? `<div class="odvc4-note-card"><strong>${escapeHtml(firstNonEmpty([bundle.headline && bundle.headline.tenant], tenant.name || tenant.slug || tenantRow.tenantId))}</strong><p>${escapeHtml(firstNonEmpty([lifecycle.detail], 'โหลดชุดข้อมูลช่วยเหลือของลูกค้ารายนี้แล้ว'))}</p></div>`
        : `<div class="odvc4-note-card"><strong>${loading ? 'กำลังโหลดเคสดูแลลูกค้า' : 'ยังไม่มีชุดข้อมูลช่วยเหลือ'}</strong><p>${loading ? 'กำลังรวบรวมบริบท onboarding การส่งของ บริการ และการแจ้งเตือนของลูกค้ารายนี้อยู่' : 'ตอนนี้ยังโหลดชุดข้อมูลช่วยเหลือไม่สำเร็จ คุณยังกลับไปหน้าลูกค้าหรือรีเฟรชจากหน้านี้ได้'}</p></div>`,
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-actions">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">งานดูแลที่ควรเริ่มก่อน</h2><p class="odv4-section-copy">เริ่มจากงานที่ระบบสรุปจากชุดข้อมูลช่วยเหลือก่อน แล้วค่อยลงลึกไปหน้า runtime หรือการเงินเมื่อจำเป็น</p></div>',
      `<div class="odvc4-card-grid">${supportActionCards || '<div class="odvc4-note-card"><strong>ตอนนี้ยังไม่มีงานเร่งด่วน</strong><p>ชุดข้อมูลช่วยเหลือปัจจุบันยังไม่แนะนำงานถัดไปเพิ่มเติม</p></div>'}</div>`,
      '</section>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>สัญญาณ</th><th>ระดับ</th><th>จำนวน</th><th>รายละเอียด</th></tr></thead><tbody>',
      signalRows || '<tr><td colspan="4">ตอนนี้ยังไม่มีสัญญาณช่วยเหลือในชุดข้อมูลนี้</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ขั้นตอน Onboarding</th><th>ขอบเขต</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>',
      onboardingRows || '<tr><td colspan="4">ตอนนี้ยังไม่มีเช็กลิสต์ onboarding ให้แสดง</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderTenantDetailWorkspaceLive(
    tenantRow,
    packageCatalog,
    planOptions,
    runtimeRows,
    supportCase,
    supportCaseLoading = false,
  ) {
    if (!tenantRow) {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-empty-live">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Customer detail</span><h2 class="odv4-section-title">Customer not found</h2><p class="odv4-section-copy">Go back to the owner tenant list and reopen the customer you want to manage.</p></div>',
        '<div class="odvc4-action-row"><a class="odv4-button odv4-button-primary" href="/owner/tenants">เปิดรายชื่อลูกค้า</a></div>',
        '</section>',
      ].join('');
    }
    const tenant = tenantRow.tenant || {};
    const subscription = tenantRow.subscription || {};
    const selectedPackageId = firstNonEmpty([tenantRow.packageId, packageCatalog[0] && packageCatalog[0].id], '');
    const packageLabelLookup = buildOwnerPackageLabelLookup(packageCatalog);
    const tenantRuntimeRows = buildTenantRuntimeRows(runtimeRows, tenantRow.tenantId);
    const runtimeOnline = tenantRuntimeRows.filter((row) => row.statusTone === 'success').length;
    const runtimePending = tenantRuntimeRows.filter((row) => row.status === 'pending_activation').length;
    const currentStatus = trimText(tenant.status || 'active').toLowerCase() || 'active';
    const bundle = supportCase && trimText(supportCase.tenantId, 160) === tenantRow.tenantId
      ? supportCase
      : null;
    const lifecycle = bundle && bundle.lifecycle && typeof bundle.lifecycle === 'object'
      ? bundle.lifecycle
      : {};
    const diagnostics = bundle && bundle.diagnostics && typeof bundle.diagnostics === 'object'
      ? bundle.diagnostics
      : {};
    const notificationCount = Array.isArray(diagnostics.notifications) ? diagnostics.notifications.length : 0;
    const requestErrorCount = Number(diagnostics.requestErrors && diagnostics.requestErrors.summary && diagnostics.requestErrors.summary.total) || 0;
    const deadLetterCount = Number(diagnostics.delivery && diagnostics.delivery.deadLetters) || 0;

    return [
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-summary" data-owner-focus-route="tenant-detail">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">รายละเอียดลูกค้า</span><h2 class="odv4-section-title">การจัดการลูกค้าและการควบคุมเชิงพาณิชย์</h2><p class="odv4-section-copy">ใช้หน้านี้จัดการข้อมูลลูกค้า การกำหนดแพ็กเกจ และบริบทบอทของลูกค้า โดยไม่ต้องออกจากการทำงานฝั่ง Owner</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'Customer', value: tenant.name || tenant.slug || tenantRow.tenantId, detail: tenant.ownerEmail || tenant.ownerName || '-', tone: 'info' },
        { label: 'Current package', value: formatOwnerPackageDisplayLabel(firstNonEmpty([tenantRow.packageLabel, selectedPackageId], '-'), packageLabelLookup), detail: subscription.planId || 'No subscription yet', tone: 'success' },
        { label: 'Subscription', value: firstNonEmpty([subscription.status, tenant.status, 'active']), detail: subscription.renewsAt ? formatDateTime(subscription.renewsAt) : 'No renewal date yet', tone: tenantRow.statusTone },
        { label: 'Runtime status', value: `${formatNumber(runtimeOnline, '0')} online / ${formatNumber(runtimePending, '0')} pending`, detail: `${formatNumber(tenantRuntimeRows.length, '0')} runtime rows`, tone: runtimePending > 0 ? 'warning' : 'info' },
        { label: 'Quota', value: tenantRow.quota.text, detail: tenantRow.invoiceLabel, tone: tenantRow.quota.tone },
        { label: 'Support signals', value: formatNumber(deadLetterCount + notificationCount + requestErrorCount, '0'), detail: `${formatNumber(deadLetterCount, '0')} dead letters · ${formatNumber(notificationCount, '0')} alerts · ${formatNumber(requestErrorCount, '0')} request errors`, tone: deadLetterCount > 0 || notificationCount > 0 || requestErrorCount > 0 ? 'warning' : 'success' },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      `<a class="odv4-button odv4-button-primary" href="${escapeHtml(ownerSupportHref(tenantRow.tenantId))}">เปิดเคสดูแลลูกค้า</a>`,
      '<a class="odv4-button odv4-button-secondary" href="/owner/subscriptions">เปิดหน้าการเงิน</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">เปิดทะเบียนบริการ</a>',
      '</div>',
      bundle
        ? `<div class="odvc4-note-card"><strong>${escapeHtml(firstNonEmpty([lifecycle.label], 'โหลดบริบทงานดูแลลูกค้าแล้ว'))}</strong><p>${escapeHtml(firstNonEmpty([lifecycle.detail], 'เปิดเคสดูแลลูกค้าเพื่อจัดการงานค้างผิดพลาด การแจ้งเตือน และคำขอที่มีปัญหาของลูกค้ารายนี้'))}</p></div>`
        : `<div class="odvc4-note-card"><strong>${supportCaseLoading ? 'กำลังโหลดบริบทงานดูแลลูกค้า' : 'ยังไม่ได้โหลดบริบทงานดูแลลูกค้า'}</strong><p>${escapeHtml(supportCaseLoading ? 'กำลังรวบรวมบริบทการส่งของ การแจ้งเตือน และการเริ่มต้นใช้งานของลูกค้ารายนี้' : 'ใช้หน้าเคสดูแลลูกค้าเมื่อคุณต้องตรวจงานค้างผิดพลาด การแจ้งเตือนของลูกค้า หรือคำขอฝั่ง Owner ที่เพิ่งล้มเหลว')}</p></div>`,
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-runtime-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">บอท</span><h2 class="odv4-section-title">บริบทบอทของลูกค้า</h2><p class="odv4-section-copy">ตรวจบอทส่งของและบอทเซิร์ฟเวอร์ของลูกค้ารายนี้ แล้วออกโทเค็นใหม่หรือยกเลิกสิทธิ์ได้จากหน้านี้ทันทีเมื่อจำเป็น</p></div>',
      renderTenantRuntimeTable(tenantRuntimeRows, {
        emptyMessage: 'ยังไม่มีบอทส่งของหรือบอทเซิร์ฟเวอร์สำหรับลูกค้ารายนี้',
      }),
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-detail-form">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ข้อมูลลูกค้า</span><h2 class="odv4-section-title">แก้ไขข้อมูลลูกค้า</h2><p class="odv4-section-copy">อัปเดตข้อมูลติดต่อ ภาษา และสถานะของแพลตฟอร์มได้จากหน้านี้ โดยไม่ต้องเข้าไปทำงานในหน้าฝั่งลูกค้า</p></div>',
      '<form class="odvc4-form" data-owner-form="update-tenant">',
      renderFormField({ name: 'id', type: 'hidden', value: tenantRow.tenantId }),
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'name', label: 'Customer name', type: 'text', required: true, value: tenant.name || '', autocomplete: 'organization' }),
      renderFormField({ name: 'slug', label: 'Slug', type: 'text', required: true, value: tenant.slug || '', autocomplete: 'off' }),
      renderFormField({ name: 'ownerName', label: 'Owner name', type: 'text', value: tenant.ownerName || '', autocomplete: 'name' }),
      renderFormField({ name: 'ownerEmail', label: 'Owner email', type: 'email', value: tenant.ownerEmail || '', autocomplete: 'email' }),
      renderFormField({ name: 'type', label: 'Type', type: 'select', value: tenant.type || 'direct', options: [
        { value: 'direct', label: 'Direct' },
        { value: 'trial', label: 'Trial' },
        { value: 'reseller', label: 'Reseller' },
        { value: 'demo', label: 'Demo' },
      ] }),
      renderFormField({ name: 'status', label: 'Status', type: 'select', value: tenant.status || 'active', options: [
        { value: 'active', label: 'Active' },
        { value: 'trialing', label: 'Trialing' },
        { value: 'paused', label: 'Paused' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'inactive', label: 'Inactive' },
      ] }),
      renderFormField({ name: 'locale', label: 'Locale', type: 'select', value: tenant.locale || 'th', options: [
        { value: 'th', label: 'Thai' },
        { value: 'en', label: 'English' },
      ] }),
      renderFormField({ name: 'parentTenantId', label: 'Parent tenant', type: 'text', value: tenant.parentTenantId || '' }),
      '</div>',
      '<div class="odvc4-form-actions">',
      '<button class="odv4-button odv4-button-primary" type="submit">บันทึกข้อมูลลูกค้า</button>',
      `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="set-tenant-status" data-tenant-id="${escapeHtml(tenantRow.tenantId)}" data-target-status="${currentStatus === 'suspended' ? 'active' : 'suspended'}">${escapeHtml(currentStatus === 'suspended' ? 'เปิดใช้งานลูกค้าอีกครั้ง' : 'ระงับลูกค้า')}</button>`,
      '</div>',
      '</form>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-subscription-form-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การควบคุมเชิงพาณิชย์</span><h2 class="odv4-section-title">กำหนดหรือเปลี่ยนแพ็กเกจ</h2><p class="odv4-section-copy">อัปเดตแพ็กเกจ แผน รอบบิล และสถานะการสมัครใช้ของลูกค้ารายนี้ได้ตรงจากหน้าการทำงานของ Owner</p></div>',
      '<form class="odvc4-form" data-owner-form="update-subscription">',
      renderFormField({ name: 'tenantId', type: 'hidden', value: tenantRow.tenantId }),
      renderFormField({ name: 'subscriptionId', type: 'hidden', value: subscription.id || '' }),
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'packageId', label: 'Package', type: 'select', value: selectedPackageId, options: packageCatalog.map((entry) => ({ value: entry.id, label: buildOwnerPackageOptionLabel(entry) })) }),
      renderFormField({ name: 'planId', label: 'Plan ID', type: 'select', value: subscription.planId || selectedPackageId, options: planOptions }),
      renderFormField({ name: 'billingCycle', label: 'Billing cycle', type: 'select', value: subscription.billingCycle || 'monthly', options: [
        { value: 'trial', label: 'Trial' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'yearly', label: 'Yearly' },
      ] }),
      renderFormField({ name: 'status', label: 'Subscription status', type: 'select', value: subscription.status || 'active', options: [
        { value: 'active', label: 'Active' },
        { value: 'trialing', label: 'Trialing' },
        { value: 'pending', label: 'Pending' },
        { value: 'past_due', label: 'Past due' },
        { value: 'canceled', label: 'Canceled' },
        { value: 'expired', label: 'Expired' },
      ] }),
      renderFormField({ name: 'amountCents', label: 'Amount (cents)', type: 'number', value: subscription.amountCents || 0 }),
      renderFormField({ name: 'currency', label: 'Currency', type: 'text', value: subscription.currency || 'THB' }),
      renderFormField({ name: 'renewsAt', label: 'Renews at', type: 'datetime-local', value: toLocalDateTimeInputValue(subscription.renewsAt || subscription.expiresAt || subscription.endsAt) }),
      renderFormField({ name: 'externalRef', label: 'External ref', type: 'text', value: subscription.externalRef || '' }),
      '</div>',
      `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">บันทึกการกำหนดแพ็กเกจ</button><a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerSupportHref(tenantRow.tenantId))}">เปิดเคสดูแลลูกค้า</a></div>`,
      '</form>',
      '</section>',
    ].join('');
  }

  function renderTenantSupportWorkspaceLive(
    tenantRow,
    supportCase,
    runtimeRows,
    deadLetters,
    loading = false,
    deadLettersLoading = false,
  ) {
    if (!tenantRow) {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-empty-live" data-owner-focus-route="support-detail">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">เคสดูแลลูกค้า</span><h2 class="odv4-section-title">ไม่พบเคสดูแลลูกค้า</h2><p class="odv4-section-copy">กลับไปที่รายชื่อลูกค้าแล้วเปิดเคสดูแลลูกค้าจากแถวนั้นอีกครั้ง</p></div>',
        '<div class="odvc4-action-row"><a class="odv4-button odv4-button-primary" href="/owner/tenants">เปิดรายชื่อลูกค้า</a></div>',
        '</section>',
      ].join('');
    }

    const tenant = tenantRow.tenant || {};
    const bundle = supportCase && trimText(supportCase.tenantId, 160) === tenantRow.tenantId
      ? supportCase
      : null;
    const lifecycle = bundle && bundle.lifecycle && typeof bundle.lifecycle === 'object'
      ? bundle.lifecycle
      : {};
    const onboarding = bundle && bundle.onboarding && typeof bundle.onboarding === 'object'
      ? bundle.onboarding
      : { completed: 0, total: 0, requiredCompleted: 0, requiredTotal: 0, items: [] };
    const signalItems = Array.isArray(bundle && bundle.signals && bundle.signals.items)
      ? bundle.signals.items
      : [];
    const actionItems = Array.isArray(bundle && bundle.actions)
      ? bundle.actions
      : [];
    const diagnostics = bundle && bundle.diagnostics && typeof bundle.diagnostics === 'object'
      ? bundle.diagnostics
      : {};
    const exportBase = `/admin/api/platform/tenant-support-case/export?tenantId=${encodeURIComponent(tenantRow.tenantId)}`;
    const tenantRuntimeRows = buildTenantRuntimeRows(runtimeRows, tenantRow.tenantId);
    const notificationItems = Array.isArray(diagnostics.notifications)
      ? diagnostics.notifications
      : Array.isArray(bundle && bundle.notifications)
        ? bundle.notifications
        : [];
    const requestErrorItems = Array.isArray(diagnostics.requestErrors && diagnostics.requestErrors.items)
      ? diagnostics.requestErrors.items
      : [];
    const supportDeadLetters = Array.isArray(deadLetters)
      ? deadLetters
      : [];
    const signalRows = signalItems.map((item) => [
      '<tr>',
      `<td>${escapeHtml(firstNonEmpty([item && item.key], '-'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.tone], '-'))}</td>`,
      `<td>${escapeHtml(formatNumber(item && item.count, '0'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.detail], '-'))}</td>`,
      '</tr>',
    ].join('')).join('');
    const onboardingRows = (Array.isArray(onboarding.items) ? onboarding.items : []).map((item) => [
      '<tr>',
      `<td>${escapeHtml(firstNonEmpty([item && item.key], '-'))}</td>`,
      `<td>${escapeHtml(item && item.required ? 'จำเป็น' : 'เพิ่มเติม')}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.status], '-'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([item && item.detail], '-'))}</td>`,
      '</tr>',
    ].join('')).join('');
    const supportActionCards = actionItems.map((item) => [
      `<article class="odvc4-metric-card odv4-tone-${escapeHtml(item && item.tone || 'muted')}">`,
      `<span class="odv4-table-label">${escapeHtml(firstNonEmpty([item && item.key], 'งานถัดไป'))}</span>`,
      `<strong>${escapeHtml(firstNonEmpty([item && item.detail], 'ยังไม่มีรายละเอียดเพิ่มเติม'))}</strong>`,
      '</article>',
    ].join('')).join('');
    const deadLetterRows = supportDeadLetters.map((row) => {
      const purchaseCode = firstNonEmpty([row && row.purchaseCode, row && row.code], '-');
      const itemLabel = firstNonEmpty([row && row.itemName, row && row.itemId, row && row.gameItemId], '-');
      const errorLabel = firstNonEmpty([row && row.lastErrorCode, row && row.reason, row && row.lastError], '-');
      const detailLabel = firstNonEmpty([row && row.lastError, row && row.recoveryHint, row && row.reason], '-');
      return [
        '<tr>',
        `<td><strong>${escapeHtml(purchaseCode)}</strong><div class="odvc4-table-note">${escapeHtml(itemLabel)}</div></td>`,
        `<td>${escapeHtml(errorLabel)}</td>`,
        `<td>${escapeHtml(row && row.updatedAt ? formatRelative(row.updatedAt) : row && row.createdAt ? formatRelative(row.createdAt) : '-')}</td>`,
        `<td>${escapeHtml(detailLabel)}</td>`,
        '<td><div class="odvc4-inline-actions">',
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-dead-letter" data-tenant-id="${escapeHtml(tenantRow.tenantId)}" data-purchase-code="${escapeHtml(purchaseCode)}" data-guild-id="${escapeHtml(firstNonEmpty([row && row.guildId], ''))}">ลองส่งใหม่</button>`,
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-dead-letter" data-tenant-id="${escapeHtml(tenantRow.tenantId)}" data-purchase-code="${escapeHtml(purchaseCode)}" data-guild-id="${escapeHtml(firstNonEmpty([row && row.guildId], ''))}">ล้างรายการ</button>`,
        '</div></td>',
        '</tr>',
      ].join('');
    }).join('');
    const notificationRows = notificationItems.map((row) => {
      const notificationId = trimText(row && row.id, 160);
      return [
        '<tr>',
        `<td><strong>${escapeHtml(translateOwnerControlText(firstNonEmpty([row && row.title, row && row.label], 'notification')))}</strong><div class="odvc4-table-note">${escapeHtml(translateOwnerControlText(firstNonEmpty([row && row.message, row && row.detail], '-')))}</div></td>`,
        `<td>${escapeHtml(translateOwnerControlText(firstNonEmpty([row && row.severity], '-')))}</td>`,
        `<td>${escapeHtml(firstNonEmpty([row && row.createdAt ? formatDateTime(row.createdAt) : '', row && row.at ? formatDateTime(row.at) : '', '-']))}</td>`,
        `<td>${row && row.acknowledged === true ? '<span class="odv4-pill odv4-pill-muted">รับทราบแล้ว</span>' : notificationId ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="acknowledge-notification" data-notification-id="${escapeHtml(notificationId)}" data-return-route="${escapeHtml(ownerSupportHref(tenantRow.tenantId))}">รับทราบ</button>` : '-'}</td>`,
        '</tr>',
      ].join('');
    }).join('');
    const requestRows = requestErrorItems.map((row) => [
      '<tr>',
      `<td>${escapeHtml(firstNonEmpty([row && row.method], 'REQ'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([row && row.path, row && row.routeGroup], '/'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([row && row.statusCode], '-'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([row && row.error, row && row.message, row && row.detail], '-'))}</td>`,
      `<td>${escapeHtml(firstNonEmpty([row && row.at ? formatDateTime(row.at) : '', row && row.createdAt ? formatDateTime(row.createdAt) : '', '-']))}</td>`,
      '</tr>',
    ].join('')).join('');

    return [
      `<section class="odv4-panel odvc4-panel" id="owner-tenant-support-workspace" data-owner-focus-route="support-detail support-${escapeHtml(tenantRow.tenantId)}">`,
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานดูแลลูกค้า</span><h2 class="odv4-section-title">เคสดูแลลูกค้า</h2><p class="odv4-section-copy">ใช้หน้านี้ดูบริบทพร้อมช่วยเหลือของลูกค้ารายนี้ ทั้งจุดติด onboarding สัญญาณความเสี่ยง สถานะวิเคราะห์ และงานถัดไปที่ควรทำ</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        {
          label: 'Customer',
          value: tenant.name || tenant.slug || tenantRow.tenantId,
          detail: firstNonEmpty([tenant.ownerEmail, tenant.ownerName], '-'),
          tone: 'info',
        },
        {
          label: 'Lifecycle',
          value: firstNonEmpty([lifecycle.label], loading ? 'กำลังโหลดเคสดูแลลูกค้า...' : 'ยังไม่โหลด'),
          detail: firstNonEmpty([lifecycle.detail], loading ? 'กำลังรวบรวมชุดข้อมูลช่วยเหลือ' : 'ยังไม่มีชุดข้อมูลช่วยเหลือ'),
          tone: firstNonEmpty([lifecycle.tone], loading ? 'info' : 'muted'),
        },
        {
          label: 'Required onboarding',
          value: `${formatNumber(onboarding.requiredCompleted, '0')} / ${formatNumber(onboarding.requiredTotal, '0')}`,
          detail: 'งานเริ่มต้นที่จำเป็นซึ่งลูกค้ารายนี้ทำแล้ว',
          tone: onboarding.requiredTotal > 0 && onboarding.requiredCompleted < onboarding.requiredTotal ? 'warning' : 'success',
        },
        {
          label: 'Support signals',
          value: formatNumber(bundle && bundle.signals && bundle.signals.total, '0'),
          detail: `${formatNumber(diagnostics.delivery && diagnostics.delivery.deadLetters, '0')} dead letters · ${formatNumber(diagnostics.delivery && diagnostics.delivery.anomalies, '0')} delivery anomalies`,
          tone: signalItems.length > 0 ? 'warning' : 'success',
        },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      `<a class="odv4-button odv4-button-primary" href="${escapeHtml(ownerTenantHref(tenantRow.tenantId))}">เปิดหน้าลูกค้า</a>`,
      '<a class="odv4-button odv4-button-secondary" href="/owner/subscriptions">เปิดหน้าการเงิน</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">เปิดทะเบียนบริการ</a>',
      `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${exportBase}&format=json`)}">ส่งออก JSON</a>`,
      `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${exportBase}&format=csv`)}">ส่งออก CSV</a>`,
      '</div>',
      bundle
        ? `<div class="odvc4-note-card"><strong>${escapeHtml(firstNonEmpty([bundle.headline && bundle.headline.tenant], tenant.name || tenant.slug || tenantRow.tenantId))}</strong><p>${escapeHtml(firstNonEmpty([lifecycle.detail], 'โหลดชุดข้อมูลช่วยเหลือสำหรับลูกค้ารายนี้แล้ว'))}</p></div>`
        : `<div class="odvc4-note-card"><strong>${loading ? 'กำลังโหลดเคสดูแลลูกค้า' : 'ยังไม่มีชุดข้อมูลช่วยเหลือ'}</strong><p>${loading ? 'กำลังรวบรวมบริบท onboarding การส่งของ บอท และการแจ้งเตือนของลูกค้ารายนี้' : 'ยังโหลดชุดข้อมูลช่วยเหลือไม่สำเร็จ แต่เมื่อข้อมูลพร้อมแล้วคุณยังใช้เครื่องมือส่งของและการแจ้งเตือนจากหน้านี้ต่อได้'}</p></div>`,
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-actions-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">งานดูแลที่ควรเริ่มก่อน</h2><p class="odv4-section-copy">เริ่มจากงานที่ระบบสรุปจากชุดข้อมูลช่วยเหลือก่อน แล้วค่อยลงลึกไปหน้า runtime หรือการเงินเมื่อจำเป็น</p></div>',
      `<div class="odvc4-card-grid">${supportActionCards || '<div class="odvc4-note-card"><strong>ยังไม่มีงานที่ต้องทำทันที</strong><p>ชุดข้อมูลช่วยเหลือปัจจุบันยังไม่มีงานติดตามที่ต้องทำทันที</p></div>'}</div>`,
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-dead-letters-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การส่งของ</span><h2 class="odv4-section-title">งานค้างผิดปกติและการลองส่งใหม่</h2><p class="odv4-section-copy">ลองส่งงานที่ค้างผิดปกติใหม่หรือล้างรายการที่ไม่ต้องการได้จากเคสดูแลลูกค้านี้โดยตรง</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Purchase</th><th>Error</th><th>Updated</th><th>Detail</th><th>Action</th></tr></thead><tbody>',
      deadLetterRows || `<tr><td colspan="5">${deadLettersLoading ? 'กำลังโหลดงานค้างผิดปกติ...' : 'ยังไม่มีงานค้างผิดปกติของลูกค้ารายนี้'}</td></tr>`,
      '</tbody></table></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-alerts-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การแจ้งเตือน</span><h2 class="odv4-section-title">การแจ้งเตือนของลูกค้า</h2><p class="odv4-section-copy">รับทราบการแจ้งเตือนที่ผูกกับลูกค้ารายนี้จากหน้านี้ได้เลย เพื่อให้เคสดูแลสงบลงหลังจัดการเสร็จ</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Alert</th><th>Severity</th><th>When</th><th>Action</th></tr></thead><tbody>',
      notificationRows || '<tr><td colspan="4">ยังไม่มีการแจ้งเตือนที่เปิดค้างของลูกค้ารายนี้</td></tr>',
      '</tbody></table></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-runtime-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">บอท</span><h2 class="odv4-section-title">บริบทบอทของลูกค้า</h2><p class="odv4-section-copy">ตรวจบอทส่งของและบอทเซิร์ฟเวอร์ของลูกค้ารายนี้ก่อนสรุปว่าปัญหาได้รับการแก้แล้ว</p></div>',
      renderTenantRuntimeTable(tenantRuntimeRows, {
        emptyMessage: 'ยังไม่มีบอทส่งของหรือบอทเซิร์ฟเวอร์สำหรับลูกค้ารายนี้',
      }),
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-request-errors-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">คำขอที่ล้มเหลว</span><h2 class="odv4-section-title">คำขอของ Owner ที่ล้มเหลวล่าสุด</h2><p class="odv4-section-copy">เช็กคำขอฝั่ง Owner ที่ล้มเหลวและผูกกับลูกค้ารายนี้ก่อนสรุปว่างานล่าสุดทำสำเร็จแล้ว</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>วิธีเรียก</th><th>เส้นทาง</th><th>สถานะ</th><th>รายละเอียด</th><th>เวลา</th></tr></thead><tbody>',
      requestRows || '<tr><td colspan="5">ยังไม่มีคำขอที่ล้มเหลวล่าสุดของลูกค้ารายนี้</td></tr>',
      '</tbody></table></div>',
      '</section>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>สัญญาณ</th><th>ระดับ</th><th>จำนวน</th><th>รายละเอียด</th></tr></thead><tbody>',
      signalRows || '<tr><td colspan="4">ยังไม่มีสัญญาณช่วยเหลือจากชุดข้อมูลปัจจุบัน</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ขั้นตอนเริ่มต้น</th><th>ขอบเขต</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>',
      onboardingRows || '<tr><td colspan="4">ยังไม่มีรายการตรวจสอบการเริ่มต้นใช้งาน</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderPackagesWorkspace(packageUsageRows, featureCatalog) {
    const packageCards = packageUsageRows.map((pkg) => [
      '<article class="odvc4-package-card">',
      `<span class="odv4-table-label">${escapeHtml(pkg.id)}</span>`,
      `<strong>${escapeHtml(pkg.title)}</strong>`,
      `<p>${escapeHtml(pkg.description)}</p>`,
      `<div class="odvc4-inline-meta"><span>${escapeHtml(`${formatNumber(pkg.tenantCount, '0')} tenants`)}</span><span>${escapeHtml(`${formatNumber(pkg.features.length, '0')} features`)}</span></div>`,
      '</article>',
    ].join('')).join('');
    const featureRows = (Array.isArray(featureCatalog) ? featureCatalog : []).map((feature) => [
      '<tr>',
      `<td>${escapeHtml(feature.title || feature.key)}</td>`,
      ...packageUsageRows.map((pkg) => `<td>${pkg.features.includes(feature.key) ? 'Yes' : 'No'}</td>`),
      '</tr>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-packages-workspace" data-owner-focus-route="packages">',
    '<div class="odv4-section-head"><span class="odv4-section-kicker">การจัดการแพ็กเกจ</span><h2 class="odv4-section-title">แค็ตตาล็อกแพ็กเกจและการใช้งาน</h2><p class="odv4-section-copy">หน้านี้ใช้ดูแค็ตตาล็อกแพ็กเกจ ความครอบคลุมของฟีเจอร์ และจำนวนลูกค้าที่อยู่แต่ละแผน ส่วนการแก้ catalog ยังเป็น config-managed ใน build นี้</p></div>',
      `<div class="odvc4-card-grid">${packageCards}</div>`,
      '<div class="odvc4-note-card"><strong>Current build note</strong><p>Package catalog ถูกจัดการจาก config catalog เดิมในระบบตอนนี้ จึงยังไม่ได้เปิด CRUD แพ็กเกจในหน้า Owner รอบนี้</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-feature-table"><thead><tr><th>Feature</th>',
      packageUsageRows.map((pkg) => `<th>${escapeHtml(pkg.id)}</th>`).join(''),
      '</tr></thead><tbody>',
      featureRows || '<tr><td colspan="5">ยังไม่มี feature catalog</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderSubscriptionsWorkspace(expiringRows, invoiceSummary, tenantRows, packageCatalog, planOptions) {
    const rows = Array.isArray(tenantRows) ? tenantRows : [];
    const actionableRows = rows
      .filter((row) => row && row.subscription)
      .sort((left, right) => {
        const leftDate = parseDate(left && left.subscription && left.subscription.renewsAt);
        const rightDate = parseDate(right && right.subscription && right.subscription.renewsAt);
        return (leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER)
          - (rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER);
      })
      .slice(0, 6);
    const quickForms = actionableRows.map((row) => {
      const subscription = row.subscription || {};
      const packageId = firstNonEmpty([row.packageId, subscription.packageId, packageCatalog[0] && packageCatalog[0].id], '');
      const planId = firstNonEmpty([subscription.planId, packageId], '');
      return [
        '<article class="odvc4-package-card">',
        `<span class="odv4-table-label">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</span>`,
        `<strong>${escapeHtml(firstNonEmpty([row.packageLabel, packageId], 'Subscription'))}</strong>`,
        `<p>${escapeHtml(firstNonEmpty([
          subscription.renewsAt ? `Renews ${formatDateTime(subscription.renewsAt)}` : '',
          `Current status: ${row.status}`,
        ], 'Review and save subscription terms from this card.'))}</p>`,
        '<form class="odvc4-form" data-owner-form="quick-update-subscription">',
        renderFormField({ name: 'tenantId', type: 'hidden', value: row.tenantId }),
        renderFormField({ name: 'subscriptionId', type: 'hidden', value: subscription.id || '' }),
        renderFormField({ name: 'packageId', type: 'hidden', value: packageId }),
        renderFormField({ name: 'planId', type: 'hidden', value: planId }),
        renderFormField({ name: 'currency', type: 'hidden', value: subscription.currency || 'THB' }),
        renderFormField({ name: 'externalRef', type: 'hidden', value: subscription.externalRef || '' }),
        '<div class="odvc4-form-grid">',
        renderFormField({ name: 'status', label: 'Status', type: 'select', value: subscription.status || 'active', options: [
          { value: 'active', label: 'Active' },
          { value: 'trialing', label: 'Trialing' },
          { value: 'pending', label: 'Pending' },
          { value: 'past_due', label: 'Past due' },
          { value: 'canceled', label: 'Canceled' },
          { value: 'expired', label: 'Expired' },
        ] }),
        renderFormField({ name: 'billingCycle', label: 'Billing cycle', type: 'select', value: subscription.billingCycle || 'monthly', options: [
          { value: 'trial', label: 'Trial' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' },
        ] }),
        renderFormField({ name: 'amountCents', label: 'Amount (cents)', type: 'number', value: subscription.amountCents || 0 }),
        renderFormField({ name: 'renewsAt', label: 'Renews at', type: 'datetime-local', value: toLocalDateTimeInputValue(subscription.renewsAt || subscription.expiresAt || subscription.endsAt) }),
        '</div>',
        `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">บันทึกการสมัครใช้</button><a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerTenantHref(row.tenantId))}">เปิดหน้าลูกค้า</a></div>`,
        '</form>',
        '</article>',
      ].join('');
    }).join('');
    const subscriptionTableRows = rows.slice(0, 16).map((row) => [
      '<tr>',
      `<td><a href="${escapeHtml(ownerTenantHref(row.tenantId))}">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</a></td>`,
      `<td>${escapeHtml(formatOwnerPackageDisplayLabel(row.packageLabel, packageLabelLookup))}</td>`,
      `<td>${escapeHtml(formatOwnerDisplayValue(row.status))}</td>`,
      `<td>${escapeHtml(formatOwnerDisplayValue(row.subscription && (row.subscription.billingCycle || '-')))}</td>`,
      `<td>${escapeHtml(row.subscription && (row.subscription.renewsAt ? formatDateTime(row.subscription.renewsAt) : '-'))}</td>`,
      `<td>${escapeHtml(formatCurrencyCents(row.subscription && row.subscription.amountCents || 0, row.subscription && row.subscription.currency || 'THB'))}</td>`,
      '</tr>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-workspace" data-owner-focus-route="subscriptions billing">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การสมัครใช้งาน</span><h2 class="odv4-section-title">ภาพรวมการสมัครใช้งานและรายได้</h2><p class="odv4-section-copy">รวมรายการใกล้ต่ออายุ ยอดรับเงิน และสุขภาพของใบแจ้งหนี้ไว้ให้ตัดสินใจเชิงธุรกิจได้จากหน้าเดียว</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'รายได้วันนี้', value: formatCurrencyCents(invoiceSummary.revenueTodayCents), detail: 'ยอดรับเงินวันนี้จากใบแจ้งหนี้ที่จ่ายแล้ว', tone: 'success' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents), detail: 'ยอดรับเงินเดือนนี้', tone: 'info' },
        { label: 'ใบแจ้งหนี้ที่ยังเปิดอยู่', value: formatNumber(invoiceSummary.openInvoiceCount, '0'), detail: 'ใบแจ้งหนี้ที่ยังไม่ปิด', tone: invoiceSummary.openInvoiceCount ? 'warning' : 'success' },
        { label: 'การชำระเงินที่ล้มเหลว', value: formatNumber(invoiceSummary.failedPaymentCount, '0'), detail: 'ความพยายามชำระเงินที่ล้มเหลว', tone: invoiceSummary.failedPaymentCount ? 'danger' : 'success' },
      ])}</div>`,
      '<div class="odvc4-note-card"><strong>บัญชีที่ใกล้หมดอายุ</strong><p>',
      expiringRows.length
        ? escapeHtml(expiringRows.slice(0, 3).map((row) => `${row.name} · ${formatDateTime(row.renewsAt)}`).join(' · '))
        : 'ตอนนี้ยังไม่พบ subscription ที่ใกล้หมดอายุภายใน 14 วัน',
      '</p></div>',
      '<section class="odv4-panel odvc4-panel" id="owner-billing-recovery-queue" data-owner-billing-recovery-queue>',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Recovery queue</span><h2 class="odv4-section-title">Resolve billing issues before they grow</h2><p class="odv4-section-copy">Prioritized billing follow-up items surface the owner actions that already exist in the workspace so support can recover revenue faster.</p></div>',
      recoveryQueueCards
        ? `<div class="odvc4-card-grid">${recoveryQueueCards}</div>`
        : '<div class="odvc4-note-card"><strong>No urgent billing recovery work</strong><p>No urgent billing recovery work is waiting right now.</p></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-actions">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">อัปเดตการต่ออายุได้จากหน้านี้ทันที</h2><p class="odv4-section-copy">ใช้ส่วนนี้ตามรายการที่ใกล้ต่ออายุหรือค้างชำระก่อน แล้วค่อยเปิดหน้ารายละเอียดลูกค้าเมื่อจำเป็น</p></div>',
      `<div class="odvc4-card-grid">${quickForms || '<div class="odvc4-note-card"><strong>ยังไม่มีการสมัครใช้งาน</strong><p>เปิดหน้าลูกค้าเพื่อสร้างการสมัครใช้งานครั้งแรกให้บัญชีนั้นได้ทันที</p></div>'}</div>`,
      '</section>',
    '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>แพ็กเกจ</th><th>สถานะ</th><th>รอบชำระ</th><th>ต่ออายุเมื่อ</th><th>จำนวนเงิน</th><th>การทำงาน</th></tr></thead><tbody>',
      subscriptionTableRows || '<tr><td colspan="7">ยังไม่มีรายการสมัครใช้งาน</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderRuntimeWorkspace(runtimeRows, selectedRuntime, runtimeBootstrap) {
    const runtimeTableRows = runtimeRows.map((row) => [
      '<tr>',
      `<td><strong>${escapeHtml(row.displayName || row.runtimeKey || row.agentId)}</strong><div class="odvc4-table-note">${escapeHtml(row.tenantName)}</div></td>`,
      `<td>${escapeHtml(row.runtimeKind === 'delivery-agents' ? 'บอตส่งของ' : 'บอตเซิร์ฟเวอร์')}</td>`,
      `<td><span class="odv4-pill odv4-pill-${escapeHtml(row.statusTone)}">${escapeHtml(row.status)}</span><div class="odvc4-table-note">${escapeHtml(row.machineName)}</div></td>`,
      `<td>${escapeHtml(firstNonEmpty([row.version, '-']))}</td>`,
      `<td>${escapeHtml(row.lastSeenAt ? formatRelative(row.lastSeenAt) : 'ยังไม่มี')}</td>`,
      '<td><div class="odvc4-inline-actions">',
      `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="inspect-runtime" data-runtime-key="${escapeHtml(row.runtimeKey)}">ตรวจบริการ</button>`,
      row.canReissueToken
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reissue-runtime-token" data-runtime-key="${escapeHtml(row.runtimeKey)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-server-id="${escapeHtml(row.serverId)}" data-guild-id="${escapeHtml(row.guildId)}" data-agent-id="${escapeHtml(row.agentId)}" data-role="${escapeHtml(row.role)}" data-scope="${escapeHtml(row.scope)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}" data-display-name="${escapeHtml(row.displayName)}" data-minimum-version="${escapeHtml(row.minimumVersion)}">ออกโทเค็นใหม่</button>`
        : '',
      row.canResetBinding
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reset-runtime-binding" data-device-id="${escapeHtml(row.deviceId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">รีเซ็ตการผูกเครื่อง</button>`
        : '',
      row.apiKeyId
      ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-runtime" data-api-key-id="${escapeHtml(row.apiKeyId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">ยกเลิกสิทธิ์บริการ</button>`
        : row.provisionTokenId
      ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-runtime" data-token-id="${escapeHtml(row.provisionTokenId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">ยกเลิกสิทธิ์บริการ</button>`
          : '',
      '</div></td>',
      '</tr>',
    ].join('')).join('');
    const inspector = selectedRuntime
      ? [
          '<section class="odv4-panel odvc4-panel">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ตัวตรวจบริการ</span><h2 class="odv4-section-title">ตรวจบริการ</h2><p class="odv4-section-copy">เจ้าของระบบใช้ส่วนนี้ดูการผูกเครื่อง สถานะ การพบล่าสุด และวงจรชีวิตโทเค็นของบริการ โดยไม่ลงไปคุมงานเซิร์ฟเวอร์รายวัน</p></div>',
          `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'บริการ', value: selectedRuntime.displayName || selectedRuntime.runtimeKey || selectedRuntime.agentId, detail: selectedRuntime.tenantName, tone: 'info' },
            { label: 'สถานะ', value: selectedRuntime.status, detail: selectedRuntime.lastSeenAt ? formatDateTime(selectedRuntime.lastSeenAt) : 'ยังไม่มี heartbeat', tone: selectedRuntime.statusTone },
        { label: 'เครื่อง', value: selectedRuntime.machineName, detail: selectedRuntime.deviceId || 'ยังไม่ผูกเครื่อง', tone: selectedRuntime.deviceId ? 'success' : 'warning' },
            { label: 'เวอร์ชัน', value: firstNonEmpty([selectedRuntime.version, '-']), detail: firstNonEmpty([selectedRuntime.minimumVersion, 'ยังไม่กำหนดเวอร์ชันขั้นต่ำ']), tone: 'muted' },
          ])}</div>`,
      `<div class="odvc4-note-card"><strong>ตัวระบุ</strong><p>คีย์บอต: ${escapeHtml(selectedRuntime.runtimeKey || '-')} · Agent ID: ${escapeHtml(selectedRuntime.agentId || '-')} · Server ID: ${escapeHtml(selectedRuntime.serverId || '-')}</p></div>`,
          '</section>',
        ].join('')
      : '';
    const bootstrapCard = runtimeBootstrap && runtimeBootstrap.rawSetupToken
      ? [
          '<section class="odv4-panel odvc4-panel odvc4-bootstrap-card">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">setup token ที่ออกใหม่</span><h2 class="odv4-section-title">setup token แบบใช้ครั้งเดียว</h2><p class="odv4-section-copy">ส่ง token นี้ให้ทีมติดตั้งบอต แล้วเริ่ม activate ใหม่บนเครื่องที่ต้องการผูกใช้งาน</p></div>',
          `<div class="odvc4-secret-box">${escapeHtml(runtimeBootstrap.rawSetupToken)}</div>`,
      `<div class="odvc4-table-note">คีย์บอต: ${escapeHtml(runtimeBootstrap.bootstrap && runtimeBootstrap.bootstrap.runtimeKey || '-')} · Agent ID: ${escapeHtml(runtimeBootstrap.bootstrap && runtimeBootstrap.bootstrap.agentId || '-')}</div>`,
          '</section>',
        ].join('')
      : '';
    return [
      bootstrapCard,
      inspector,
      '<section class="odv4-panel odvc4-panel" id="owner-runtime-workspace" data-owner-focus-route="runtime runtime-health jobs incidents">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ภาพรวมบริการ</span><h2 class="odv4-section-title">ทะเบียนบริการและการควบคุมโทเค็น</h2><p class="odv4-section-copy">Owner เห็นบอตส่งของและบอตเซิร์ฟเวอร์ทั้งแพลตฟอร์มจากมุม registry, binding และวงจรชีวิตของโทเค็น โดยไม่ปนกับปุ่มคุมเซิร์ฟเวอร์รายวัน</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>บริการ</th><th>ประเภท</th><th>สถานะ</th><th>เวอร์ชัน</th><th>พบล่าสุด</th><th>การทำงาน</th></tr></thead><tbody>',
      runtimeTableRows || '<tr><td colspan="6">ยังไม่มีรายการบริการ</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderAnalyticsWorkspace(state, packageUsageRows, runtimeRows, invoiceSummary) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const analytics = overview.analytics && typeof overview.analytics === 'object' ? overview.analytics : {};
    const tenantAnalytics = analytics.tenants && typeof analytics.tenants === 'object' ? analytics.tenants : {};
    const subscriptionAnalytics = analytics.subscriptions && typeof analytics.subscriptions === 'object' ? analytics.subscriptions : {};
    const deliveryAnalytics = analytics.delivery && typeof analytics.delivery === 'object' ? analytics.delivery : {};
    const runtimeOnline = runtimeRows.filter((row) => row.statusTone === 'success').length;
    const packageRows = packageUsageRows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(formatNumber(row.tenantCount, '0'))}</td><td>${escapeHtml(formatNumber(row.features.length, '0'))}</td></tr>`).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-analytics-workspace" data-owner-focus-route="analytics observability">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Analytics</span><h2 class="odv4-section-title">Platform and business analytics</h2><p class="odv4-section-copy">รวม tenant growth, package usage, revenue visibility และ service health ให้เจ้าของระบบใช้ตัดสินใจเชิงธุรกิจได้เร็ว</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
    { label: 'Total customers', value: formatNumber(tenantAnalytics.total || 0, '0'), detail: 'จำนวนลูกค้าทั้งหมด', tone: 'info' },
    { label: 'Active customers', value: formatNumber(tenantAnalytics.active || 0, '0'), detail: 'ลูกค้าที่ active อยู่', tone: 'success' },
        { label: 'MRR', value: formatCurrencyCents(subscriptionAnalytics.mrrCents || 0), detail: 'ค่า recurring revenue ล่าสุด', tone: 'info' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents), detail: 'ยอดรับเงินเดือนนี้', tone: 'success' },
        { label: 'Services online', value: formatNumber(runtimeOnline, '0'), detail: `${formatNumber(runtimeRows.length, '0')} service rows`, tone: runtimeOnline ? 'success' : 'warning' },
        { label: 'Failed jobs', value: formatNumber(deliveryAnalytics.failedJobs || 0, '0'), detail: `Queue depth ${formatNumber(deliveryAnalytics.queueDepth || 0, '0')}`, tone: Number(deliveryAnalytics.failedJobs || 0) > 0 ? 'danger' : 'muted' },
      ])}</div>`,
    '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Package</th><th>Customer count</th><th>Features</th></tr></thead><tbody>',
      packageRows || '<tr><td colspan="3">ยังไม่มี package usage</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderAuditWorkspace(state) {
    const securityEvents = Array.isArray(state.securityEvents) ? state.securityEvents : [];
    const notifications = Array.isArray(state.notifications) ? state.notifications : [];
    const requestItems = Array.isArray(state.requestLogs && state.requestLogs.items) ? state.requestLogs.items : [];
    const securityRows = securityEvents.slice(0, 8).map((row) => `<tr><td>${escapeHtml(translateOwnerControlText(trimText(row && row.type) || 'security-event'))}</td><td>${escapeHtml(translateOwnerControlText(trimText(row && row.severity) || '-'))}</td><td>${escapeHtml(formatDateTime(row && (row.createdAt || row.at)))}</td></tr>`).join('');
    const notificationRows = notifications.slice(0, 8).map((row) => `<tr><td>${escapeHtml(translateOwnerControlText(firstNonEmpty([row && row.title, row && row.label], 'notification')))}</td><td>${escapeHtml(translateOwnerControlText(trimText(row && row.severity) || '-'))}</td><td>${escapeHtml(formatDateTime(row && (row.createdAt || row.at)))}</td></tr>`).join('');
    const requestRows = requestItems.slice(0, 8).map((row) => `<tr><td>${escapeHtml(trimText(row && row.method) || 'REQ')}</td><td>${escapeHtml(trimText(row && (row.path || row.routeGroup)) || '/')}</td><td>${escapeHtml(trimText(row && row.statusCode) || '-')}</td><td>${escapeHtml(formatDateTime(row && (row.at || row.createdAt)))}</td></tr>`).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-audit-workspace" data-owner-focus-route="audit security">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ออดิทและความปลอดภัย</span><h2 class="odv4-section-title">สัญญาณความปลอดภัยและหลักฐานออดิท</h2><p class="odv4-section-copy">เจ้าของระบบใช้มุมนี้ดูเหตุการณ์ความปลอดภัย การแจ้งเตือนของแพลตฟอร์ม และหลักฐานคำขอก่อนตัดสินใจเรื่องเสี่ยง</p></div>',
      '<div class="odvc4-split-grid">',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>Security event</th><th>Severity</th><th>When</th></tr></thead><tbody>',
      securityRows || '<tr><td colspan="3">ยังไม่มี security events</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>Alert</th><th>Severity</th><th>When</th></tr></thead><tbody>',
      notificationRows || '<tr><td colspan="3">ยังไม่มี alerts</td></tr>',
      '</tbody></table></div>',
      '</div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>Method</th><th>Path</th><th>Status</th><th>When</th></tr></thead><tbody>',
      requestRows || '<tr><td colspan="4">ยังไม่มี request evidence</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderAuditWorkspaceV2(state) {
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const securityEvents = Array.isArray(state.securityEvents) ? state.securityEvents : [];
    const notifications = Array.isArray(state.notifications) ? state.notifications : [];
    const requestItems = Array.isArray(state.requestLogs && state.requestLogs.items) ? state.requestLogs.items : [];
    const openAlerts = notifications.filter((row) => row && row.acknowledged !== true);
    const acknowledgedAlerts = notifications.filter((row) => row && row.acknowledged === true);
    const failedRequests = requestItems.filter((row) => Number(row && row.statusCode) >= 500);
    const sessionRows = sessions.slice(0, 8).map((row) => {
      const sessionId = trimText(row && row.id, 160);
      const current = row && row.current === true;
      const actionCell = current
        ? '<span class="odv4-tag odv4-tag-success">เซสชันปัจจุบัน</span>'
        : `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-admin-session" data-session-id="${escapeHtml(sessionId)}" data-session-user="${escapeHtml(trimText(row && row.user, 160))}">ยกเลิกเซสชัน</button>`;
      return `<tr><td>${escapeHtml(firstNonEmpty([row && row.user], '-'))}</td><td>${escapeHtml(firstNonEmpty([row && row.role], '-'))}</td><td>${escapeHtml(firstNonEmpty([row && row.authMethod], '-'))}</td><td>${escapeHtml(firstNonEmpty([row && row.ip], '-'))}</td><td>${escapeHtml(formatDateTime(row && (row.lastSeenAt || row.createdAt)))}</td><td>${actionCell}</td></tr>`;
    }).join('');
    const securityRows = securityEvents.slice(0, 8).map((row) => `<tr><td>${escapeHtml(trimText(row && row.type) || 'security-event')}</td><td>${escapeHtml(trimText(row && row.severity) || '-')}</td><td>${escapeHtml(firstNonEmpty([row && row.actor, row && row.targetUser], '-'))}</td><td>${escapeHtml(formatDateTime(row && (row.createdAt || row.at)))}</td></tr>`).join('');
    const notificationRows = notifications.slice(0, 8).map((row) => {
      const notificationId = trimText(row && row.id, 160);
      const actionCell = row && row.acknowledged === true
        ? '<span class="odv4-tag odv4-tag-success">รับทราบแล้ว</span>'
        : notificationId
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="acknowledge-notification" data-notification-id="${escapeHtml(notificationId)}">รับทราบ</button>`
          : '<span class="odv4-tag odv4-tag-muted">ไม่มีการทำงาน</span>';
      return `<tr><td>${escapeHtml(firstNonEmpty([row && row.title, row && row.label], 'notification'))}</td><td>${escapeHtml(trimText(row && row.severity) || '-')}</td><td>${escapeHtml(formatDateTime(row && (row.createdAt || row.at)))}</td><td>${actionCell}</td></tr>`;
    }).join('');
    const requestRows = requestItems.slice(0, 8).map((row) => `<tr><td>${escapeHtml(trimText(row && row.method) || 'REQ')}</td><td>${escapeHtml(trimText(row && (row.path || row.routeGroup)) || '/')}</td><td>${escapeHtml(trimText(row && row.statusCode) || '-')}</td><td>${escapeHtml(formatDateTime(row && (row.at || row.createdAt)))}</td></tr>`).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-audit-workspace" data-owner-focus-route="audit security">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ออดิทและความปลอดภัย</span><h2 class="odv4-section-title">สัญญาณความปลอดภัยและหลักฐานออดิท</h2><p class="odv4-section-copy">ใช้ workspace นี้เพื่อตัดเซสชันที่ยังใช้งาน รับทราบการแจ้งเตือน และตรวจหลักฐานก่อนที่ปัญหาระดับแพลตฟอร์มจะลุกลาม</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'เซสชันที่ใช้งานอยู่', value: formatNumber(sessions.length, '0'), detail: 'บัญชีผู้ดูแลที่ยังล็อกอินอยู่', tone: sessions.length > 3 ? 'warning' : 'info' },
        { label: 'การแจ้งเตือนที่ยังเปิดอยู่', value: formatNumber(openAlerts.length, '0'), detail: 'การแจ้งเตือนที่ยังไม่ได้รับทราบ', tone: openAlerts.length ? 'warning' : 'success' },
        { label: 'เหตุการณ์ความปลอดภัย', value: formatNumber(securityEvents.length, '0'), detail: 'หลักฐานความปลอดภัยล่าสุด', tone: securityEvents.length ? 'warning' : 'muted' },
        { label: 'คำขอที่ล้มเหลว', value: formatNumber(failedRequests.length, '0'), detail: 'หลักฐานคำขอ 5xx ล่าสุด', tone: failedRequests.length ? 'danger' : 'success' },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      acknowledgedAlerts.length
        ? '<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-acknowledged-notifications">ล้างการแจ้งเตือนที่รับทราบแล้ว</button>'
        : '<span class="odvc4-inline-note">ยังไม่มีการแจ้งเตือนที่รับทราบแล้วรอให้ล้าง</span>',
      '</div>',
      '<div class="odvc4-split-grid">',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>ผู้ใช้ในเซสชัน</th><th>บทบาท</th><th>วิธีเข้าใช้</th><th>IP</th><th>พบล่าสุด</th><th>การทำงาน</th></tr></thead><tbody>',
      sessionRows || '<tr><td colspan="6">ยังไม่มีเซสชันที่ใช้งานอยู่</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>การแจ้งเตือน</th><th>ระดับ</th><th>เวลา</th><th>การทำงาน</th></tr></thead><tbody>',
      notificationRows || '<tr><td colspan="4">ยังไม่มีการแจ้งเตือน</td></tr>',
      '</tbody></table></div>',
      '</div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>เหตุการณ์ความปลอดภัย</th><th>ระดับ</th><th>ผู้กระทำ</th><th>เวลา</th></tr></thead><tbody>',
      securityRows || '<tr><td colspan="4">ยังไม่มีเหตุการณ์ความปลอดภัย</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table"><thead><tr><th>วิธีเรียก</th><th>เส้นทาง</th><th>สถานะ</th><th>เวลา</th></tr></thead><tbody>',
      requestRows || '<tr><td colspan="4">ยังไม่มีหลักฐานคำขอ</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderSettingsWorkspace(state) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const billingProvider = state.billingOverview && state.billingOverview.provider && typeof state.billingOverview.provider === 'object'
      ? state.billingOverview.provider
      : {};
    const automationConfig = overview.automationConfig && typeof overview.automationConfig === 'object'
      ? overview.automationConfig
      : {};
    const opsState = overview.opsState && typeof overview.opsState === 'object'
      ? overview.opsState
      : {};
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-settings-workspace" data-owner-focus-route="settings">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ตั้งค่าระบบ</span><h2 class="odv4-section-title">นโยบายแพลตฟอร์มและการตั้งค่าระบบ</h2><p class="odv4-section-copy">หน้านี้สรุปการตั้งค่าระดับแพลตฟอร์ม งานอัตโนมัติ และผู้ให้บริการชำระเงินที่เจ้าของระบบใช้ตรวจความพร้อมของระบบ</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'ผู้ให้บริการชำระเงิน', value: formatOwnerProviderDisplayLabel(firstNonEmpty([billingProvider.provider, 'platform_local'])), detail: formatOwnerProviderDisplayLabel(firstNonEmpty([billingProvider.mode, 'ยังไม่ตั้งค่า'])), tone: 'info' },
        { label: 'งานอัตโนมัติ', value: automationConfig.enabled === false ? 'ปิดใช้งาน' : 'เปิดใช้งาน', detail: `สูงสุด ${formatNumber(automationConfig.maxActionsPerCycle || 0, '0')} งานต่อรอบ`, tone: automationConfig.enabled === false ? 'warning' : 'success' },
        { label: 'การติดตามระบบ', value: opsState.lastMonitoringAt ? formatDateTime(opsState.lastMonitoringAt) : 'ยังไม่ทราบ', detail: 'รอบล่าสุดของการติดตามแพลตฟอร์ม', tone: 'info' },
        { label: 'แค็ตตาล็อกสิทธิ์', value: formatNumber(Array.isArray(overview.permissionCatalog) ? overview.permissionCatalog.length : 0, '0'), detail: 'รายการสิทธิ์ระดับแพลตฟอร์มที่มีอยู่', tone: 'muted' },
      ])}</div>`,
      '<div class="odvc4-note-card"><strong>ขอบเขตของหน้านี้</strong><p>หน้าตั้งค่าเจ้าของระบบในรอบนี้เน้นการตรวจและกำกับระบบกลางก่อน ส่วนแม่แบบคำสั่ง นโยบายหมุนคีย์ลับ และค่าแวดล้อมระดับลึกยังคงผูกกับการตั้งค่าระบบกลางเดิม</p></div>',
      '</section>',
    ].join('');
  }

  function renderPackagesWorkspace(packageUsageRows, featureCatalog) {
    const rows = Array.isArray(packageUsageRows) ? packageUsageRows : [];
    const packageLabelLookup = buildOwnerPackageLabelLookup(rows);
    const createForm = [
      '<section class="odv4-panel odvc4-panel" id="owner-packages-create-form">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">สร้างแพ็กเกจ</h2><p class="odv4-section-copy">สร้างแพ็กเกจเชิงพาณิชย์ใหม่ เลือกชุดฟีเจอร์ และเก็บไว้เป็นแบบร่างจนกว่าจะพร้อมเปิดขาย</p></div>',
      '<form class="odvc4-form" data-owner-form="create-package">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'id', label: 'รหัสแพ็กเกจ', type: 'text', required: true, description: 'รหัสตัวพิมพ์ใหญ่ที่ใช้ใน subscription และการกำหนดแพ็กเกจ' }),
      renderFormField({ name: 'title', label: 'ชื่อแพ็กเกจ', type: 'text', required: true }),
      renderFormField({ name: 'status', label: 'Status', type: 'select', value: 'draft', options: [
        { value: 'draft', label: 'แบบร่าง' },
        { value: 'active', label: 'ใช้งานอยู่' },
        { value: 'archived', label: 'เก็บถาวร' },
      ] }),
      renderFormField({ name: 'position', label: 'ลำดับการแสดง', type: 'number', value: '100' }),
      renderFormField({ name: 'description', label: 'คำอธิบาย', type: 'textarea', value: '' }),
      renderFormField({
        name: 'featureText',
        label: 'ฟีเจอร์',
        type: 'textarea',
        value: '',
        description: 'ใส่คีย์ฟีเจอร์ทีละบรรทัด หรือคั่นด้วยเครื่องหมายจุลภาค',
        required: true,
      }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">สร้างแพ็กเกจ</button></div>',
      '</form>',
      '</section>',
    ].join('');
    const packageCards = rows.map((pkg) => [
      '<article class="odvc4-package-card">',
      `<span class="odv4-table-label">${escapeHtml(formatOwnerPackageDisplayLabel(pkg.id, packageLabelLookup))}</span>`,
      `<strong>${escapeHtml(formatOwnerPackageDisplayLabel(firstNonEmpty([pkg.title, pkg.id], pkg.id), packageLabelLookup))}</strong>`,
      `<p>${escapeHtml(formatOwnerDisplayValue(pkg.description || 'No package description yet.'))}</p>`,
      `<div class="odvc4-inline-meta"><span>${escapeHtml(`${formatNumber(pkg.tenantCount, '0')} ลูกค้า`)}</span><span>${escapeHtml(`${formatNumber(pkg.features.length, '0')} ฟีเจอร์`)}</span><span>${escapeHtml(pkg.isSystem ? 'แพ็กเกจระบบ' : 'แพ็กเกจกำหนดเอง')}</span></div>`,
      '<form class="odvc4-form" data-owner-form="update-package">',
      renderFormField({ name: 'id', type: 'hidden', value: pkg.id }),
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'title', label: 'ชื่อแพ็กเกจ', type: 'text', value: pkg.title || '', required: true }),
      renderFormField({ name: 'status', label: 'Status', type: 'select', value: pkg.status || 'active', options: [
        { value: 'draft', label: 'แบบร่าง' },
        { value: 'active', label: 'ใช้งานอยู่' },
        { value: 'archived', label: 'เก็บถาวร' },
      ] }),
      renderFormField({ name: 'position', label: 'ลำดับการแสดง', type: 'number', value: Number.isFinite(Number(pkg.position)) ? String(pkg.position) : '0' }),
      renderFormField({ name: 'description', label: 'คำอธิบาย', type: 'textarea', value: pkg.description || '' }),
      renderFormField({
        name: 'featureText',
        label: 'ฟีเจอร์',
        type: 'textarea',
        value: Array.isArray(pkg.features) ? pkg.features.join('\n') : '',
        description: 'ใช้เฉพาะคีย์ฟีเจอร์ที่ถูกต้อง แต่ละบรรทัดจะกลายเป็น entitlement หนึ่งรายการ',
        required: true,
      }),
      '</div>',
      `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">บันทึกแพ็กเกจ</button>${pkg.isSystem ? '<span class="odvc4-inline-note">แพ็กเกจระบบแก้ไขได้ แต่ลบไม่ได้</span>' : `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="delete-package" data-package-id="${escapeHtml(pkg.id)}" data-package-title="${escapeHtml(pkg.title || pkg.id)}">ลบแพ็กเกจ</button>`}</div>`,
      '</form>',
      `<div class="odvc4-table-note">อัปเดตล่าสุด ${escapeHtml(pkg.updatedAt ? formatDateTime(pkg.updatedAt) : 'ไม่ทราบ')}</div>`,
      '</article>',
    ].join('')).join('');
    const featureRows = (Array.isArray(featureCatalog) ? featureCatalog : []).map((feature) => [
      '<tr>',
      `<td>${escapeHtml(formatOwnerDisplayValue(feature.title || feature.key))}</td>`,
      ...rows.map((pkg) => `<td>${pkg.features.includes(feature.key) ? 'มี' : 'ไม่มี'}</td>`),
      '</tr>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-packages-workspace" data-owner-focus-route="packages">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การจัดการแพ็กเกจ</span><h2 class="odv4-section-title">แค็ตตาล็อกแพ็กเกจและการใช้งาน</h2><p class="odv4-section-copy">สร้าง อัปเดต และเก็บถาวรแพ็กเกจเชิงพาณิชย์จากหน้า Owner โดยยังคุมรหัสแพ็กเกจและสิทธิ์ฟีเจอร์ไว้ที่แพลตฟอร์ม</p></div>',
      createForm,
      `<div class="odvc4-card-grid">${packageCards || '<div class="odvc4-note-card"><strong>ยังไม่มีแพ็กเกจ</strong><p>เริ่มสร้างแพ็กเกจแรกจากฟอร์มด้านบนได้เลย</p></div>'}</div>`,
      '<div class="odvc4-note-card"><strong>กติกาการลบ</strong><p>แพ็กเกจระบบลบไม่ได้ ส่วนแพ็กเกจกำหนดเองควรถูกลบเมื่อไม่ได้ผูกกับลูกค้าที่ใช้งานอยู่หรือแผนต่ออายุแล้วเท่านั้น</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-feature-table"><thead><tr><th>ฟีเจอร์</th>',
      rows.map((pkg) => `<th>${escapeHtml(formatOwnerPackageDisplayLabel(pkg.id, packageLabelLookup))}</th>`).join(''),
      '</tr></thead><tbody>',
      featureRows || '<tr><td colspan="5">ยังไม่มีรายการฟีเจอร์</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderSubscriptionsWorkspaceV2(expiringRows, invoiceSummary, tenantRows, packageCatalog, planOptions) {
    const rows = Array.isArray(tenantRows) ? tenantRows : [];
    const packageLabelLookup = buildOwnerPackageLabelLookup(packageCatalog);
    const actionableRows = rows
      .filter((row) => row && row.subscription)
      .sort((left, right) => {
        const leftDate = parseDate(left && left.subscription && left.subscription.renewsAt);
        const rightDate = parseDate(right && right.subscription && right.subscription.renewsAt);
        return (leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER)
          - (rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER);
      })
      .slice(0, 6);
    const quickForms = actionableRows.map((row) => {
      const subscription = row.subscription || {};
      const packageId = firstNonEmpty([row.packageId, subscription.packageId, packageCatalog[0] && packageCatalog[0].id], '');
      const planId = firstNonEmpty([
        subscription.planId,
        planOptions.find((option) => option.value === packageId) && packageId,
        packageId,
      ], '');
      return [
        '<article class="odvc4-package-card">',
        `<span class="odv4-table-label">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</span>`,
      `<strong>${escapeHtml(formatOwnerPackageDisplayLabel(firstNonEmpty([row.packageLabel, packageId], 'การสมัครใช้งาน'), packageLabelLookup))}</strong>`,
        `<p>${escapeHtml(firstNonEmpty([
          subscription.renewsAt ? `Renews ${formatDateTime(subscription.renewsAt)}` : '',
          `Current status: ${row.status}`,
        ], 'Review and save subscription terms from this card.'))}</p>`,
        '<form class="odvc4-form" data-owner-form="quick-update-subscription">',
        renderFormField({ name: 'tenantId', type: 'hidden', value: row.tenantId }),
        renderFormField({ name: 'subscriptionId', type: 'hidden', value: subscription.id || '' }),
        renderFormField({ name: 'packageId', type: 'hidden', value: packageId }),
        renderFormField({ name: 'planId', type: 'hidden', value: planId }),
        renderFormField({ name: 'currency', type: 'hidden', value: subscription.currency || 'THB' }),
        renderFormField({ name: 'externalRef', type: 'hidden', value: subscription.externalRef || '' }),
        '<div class="odvc4-form-grid">',
        renderFormField({ name: 'status', label: 'Status', type: 'select', value: subscription.status || 'active', options: [
          { value: 'active', label: 'Active' },
          { value: 'trialing', label: 'Trialing' },
          { value: 'pending', label: 'Pending' },
          { value: 'past_due', label: 'Past due' },
          { value: 'canceled', label: 'Canceled' },
          { value: 'expired', label: 'Expired' },
        ] }),
        renderFormField({ name: 'billingCycle', label: 'Billing cycle', type: 'select', value: subscription.billingCycle || 'monthly', options: [
          { value: 'trial', label: 'Trial' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' },
        ] }),
        renderFormField({ name: 'amountCents', label: 'Amount (cents)', type: 'number', value: subscription.amountCents || 0 }),
        renderFormField({ name: 'renewsAt', label: 'Renews at', type: 'datetime-local', value: toLocalDateTimeInputValue(subscription.renewsAt || subscription.expiresAt || subscription.endsAt) }),
        '</div>',
        `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">บันทึกการสมัครใช้งาน</button><a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerTenantHref(row.tenantId))}">เปิดหน้าลูกค้า</a></div>`,
        '</form>',
        '</article>',
      ].join('');
    }).join('');
    const subscriptionTableRows = rows.slice(0, 16).map((row) => [
      '<tr>',
      `<td><a href="${escapeHtml(ownerTenantHref(row.tenantId))}">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</a></td>`,
      `<td>${escapeHtml(formatOwnerPackageDisplayLabel(row.packageLabel, packageLabelLookup))}</td>`,
      `<td>${escapeHtml(formatOwnerDisplayValue(row.status))}</td>`,
      `<td>${escapeHtml(formatOwnerDisplayValue(row.subscription && (row.subscription.billingCycle || '-')))}</td>`,
      `<td>${escapeHtml(row.subscription && (row.subscription.renewsAt ? formatDateTime(row.subscription.renewsAt) : '-'))}</td>`,
      `<td>${escapeHtml(formatCurrencyCents(row.subscription && row.subscription.amountCents || 0, row.subscription && row.subscription.currency || 'THB'))}</td>`,
      '</tr>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-workspace" data-owner-focus-route="subscriptions billing">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การสมัครใช้งาน</span><h2 class="odv4-section-title">ภาพรวมการสมัครใช้งานและรายได้</h2><p class="odv4-section-copy">รวมการต่ออายุ ความเสี่ยงด้านรายได้ และสุขภาพของใบแจ้งหนี้ไว้ในหน้าเดียว เพื่อให้เจ้าของระบบตัดสินใจได้เร็วขึ้น</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'รายได้วันนี้', value: formatCurrencyCents(invoiceSummary.revenueTodayCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้ววันนี้', tone: 'success' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้วเดือนนี้', tone: 'info' },
        { label: 'ใบแจ้งหนี้ที่ยังเปิดอยู่', value: formatNumber(invoiceSummary.openInvoiceCount, '0'), detail: 'ใบแจ้งหนี้ที่ยังรอการชำระ', tone: invoiceSummary.openInvoiceCount ? 'warning' : 'success' },
        { label: 'การชำระเงินที่ล้มเหลว', value: formatNumber(invoiceSummary.failedPaymentCount, '0'), detail: 'รายการที่ควรตรวจสอบเพิ่มเติม', tone: invoiceSummary.failedPaymentCount ? 'danger' : 'success' },
      ])}</div>`,
      '<div class="odvc4-note-card"><strong>บัญชีที่ใกล้ต่ออายุ</strong><p>',
      expiringRows.length
        ? escapeHtml(expiringRows.slice(0, 3).map((row) => `${row.name} · ${formatDateTime(row.renewsAt)}`).join(' · '))
        : 'ยังไม่มีรายการสมัครใช้งานที่ใกล้หมดอายุใน 14 วันข้างหน้า',
      '</p></div>',
      '<section class="odv4-panel odvc4-panel" id="owner-billing-recovery-queue" data-owner-billing-recovery-queue>',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Recovery queue</span><h2 class="odv4-section-title">Resolve billing issues before they grow</h2><p class="odv4-section-copy">Prioritized billing follow-up items surface the owner actions that already exist in the workspace so support can recover revenue faster.</p></div>',
      recoveryQueueCards
        ? `<div class="odvc4-card-grid">${recoveryQueueCards}</div>`
        : '<div class="odvc4-note-card"><strong>No urgent billing recovery work</strong><p>No urgent billing recovery work is waiting right now.</p></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-actions">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">อัปเดตการต่ออายุได้จากหน้านี้ทันที</h2><p class="odv4-section-copy">จัดการบัญชีที่ใกล้หมดอายุ ค้างชำระ หรือมีความเสี่ยงก่อน แล้วค่อยเปิดประวัติลูกค้าเมื่อจำเป็นต้องดูรายละเอียดเพิ่ม</p></div>',
      `<div class="odvc4-card-grid">${quickForms || '<div class="odvc4-note-card"><strong>ยังไม่มีประวัติลูกค้า</strong><p>สร้างลูกค้ารายแรกก่อน แล้วค่อยจัดการการสมัครใช้จากหน้านี้</p></div>'}</div>`,
      '</section>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>แพ็กเกจ</th><th>สถานะ</th><th>รอบชำระ</th><th>ต่ออายุเมื่อ</th><th>จำนวนเงิน</th><th>การทำงาน</th></tr></thead><tbody>',
      subscriptionTableRows || '<tr><td colspan="7">ยังไม่มีรายการการสมัครใช้</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderSubscriptionsWorkspaceV2(expiringRows, invoiceSummary, tenantRows, packageCatalog, planOptions) {
    const rows = Array.isArray(tenantRows) ? tenantRows : [];
    const packageLabelLookup = buildOwnerPackageLabelLookup(packageCatalog);
    const packageOptions = (Array.isArray(packageCatalog) ? packageCatalog : [])
      .filter((entry) => trimText(entry && entry.id, 120))
      .filter((entry) => trimText(entry && entry.status, 40).toLowerCase() !== 'archived')
      .map((entry) => ({
        value: trimText(entry.id, 120),
        label: `${trimText(entry.id, 120)} · ${firstNonEmpty([entry.title, entry.id], trimText(entry.id, 120))}`,
      }));
    const planIdOptions = (Array.isArray(planOptions) ? planOptions : [])
      .filter((option) => trimText(option && option.value, 120))
      .map((option) => ({
        value: trimText(option.value, 120),
        label: firstNonEmpty([option.label, option.title, option.value], trimText(option.value, 120)),
      }));
    const localizedPackageOptions = packageOptions.map((entry) => ({
      value: entry.value,
      label: buildOwnerPackageOptionLabel(entry),
    }));
    const actionableRows = rows
      .filter(Boolean)
      .sort((left, right) => {
        const leftHasSubscription = left && left.subscription ? 0 : 1;
        const rightHasSubscription = right && right.subscription ? 0 : 1;
        if (leftHasSubscription !== rightHasSubscription) return leftHasSubscription - rightHasSubscription;
        const leftDate = parseDate(left && left.subscription && left.subscription.renewsAt);
        const rightDate = parseDate(right && right.subscription && right.subscription.renewsAt);
        return (leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER)
          - (rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER);
      })
      .slice(0, 6);
    const quickForms = actionableRows.map((row) => {
      const subscription = row.subscription || {};
      const hasSubscription = Boolean(subscription && (subscription.id || subscription.planId || subscription.renewsAt || subscription.status));
      const packageId = firstNonEmpty([
        packageOptions.find((entry) => entry.value === row.packageId)?.value,
        packageOptions.find((entry) => entry.value === trimText(subscription.packageId, 120))?.value,
        packageOptions[0] && packageOptions[0].value,
      ], '');
      const planId = firstNonEmpty([
        trimText(subscription.planId, 120),
        planIdOptions.find((entry) => entry.value === packageId)?.value,
        packageId,
      ], '');
      const effectivePlanOptions = planIdOptions.length
        ? planIdOptions
        : localizedPackageOptions.map((entry) => ({ value: entry.value, label: entry.label }));
      return [
        '<article class="odvc4-package-card">',
        `<span class="odv4-table-label">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</span>`,
      `<strong>${escapeHtml(firstNonEmpty([row.packageLabel, packageId], 'การสมัครใช้งาน'))}</strong>`,
        `<p>${escapeHtml(firstNonEmpty([
          hasSubscription && subscription.renewsAt ? `ต่ออายุ ${formatDateTime(subscription.renewsAt)}` : '',
          hasSubscription ? `สถานะปัจจุบัน: ${translateOwnerControlText(row.status)}` : '',
        ], hasSubscription ? 'ตรวจและบันทึกเงื่อนไขการต่ออายุได้จากการ์ดนี้ทันที' : 'สร้างการสมัครใช้งานครั้งแรกของลูกค้ารายนี้จากการ์ดนี้ได้เลย'))}</p>`,
        '<form class="odvc4-form" data-owner-form="quick-update-subscription">',
        renderFormField({ name: 'tenantId', type: 'hidden', value: row.tenantId }),
        renderFormField({ name: 'subscriptionId', type: 'hidden', value: subscription.id || '' }),
        renderFormField({ name: 'currency', type: 'hidden', value: subscription.currency || 'THB' }),
        renderFormField({ name: 'externalRef', type: 'hidden', value: subscription.externalRef || '' }),
        '<div class="odvc4-form-grid">',
        renderFormField({ name: 'packageId', label: 'Package', type: 'select', value: packageId, options: localizedPackageOptions }),
        renderFormField({ name: 'planId', label: 'Plan', type: 'select', value: planId, options: effectivePlanOptions }),
        renderFormField({ name: 'status', label: 'Status', type: 'select', value: subscription.status || 'active', options: [
          { value: 'active', label: 'Active' },
          { value: 'trialing', label: 'Trialing' },
          { value: 'pending', label: 'Pending' },
          { value: 'past_due', label: 'Past due' },
          { value: 'canceled', label: 'Canceled' },
          { value: 'expired', label: 'Expired' },
        ] }),
        renderFormField({ name: 'billingCycle', label: 'Billing cycle', type: 'select', value: subscription.billingCycle || 'monthly', options: [
          { value: 'trial', label: 'Trial' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' },
        ] }),
        renderFormField({ name: 'amountCents', label: 'Amount (cents)', type: 'number', value: subscription.amountCents || 0 }),
        renderFormField({ name: 'renewsAt', label: 'Renews at', type: 'datetime-local', value: toLocalDateTimeInputValue(subscription.renewsAt || subscription.expiresAt || subscription.endsAt) }),
        '</div>',
        `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">${hasSubscription ? 'บันทึกการสมัครใช้งาน' : 'สร้างการสมัครใช้งาน'}</button><a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerTenantHref(row.tenantId))}">เปิดหน้าลูกค้า</a></div>`,
        '</form>',
        '</article>',
      ].join('');
    }).join('');
    const subscriptionTableRows = rows.slice(0, 16).map((row) => [
      '<tr>',
      `<td><a href="${escapeHtml(ownerTenantHref(row.tenantId))}">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</a></td>`,
      `<td>${escapeHtml(formatOwnerPackageDisplayLabel(row.packageLabel, packageLabelLookup))}</td>`,
      `<td>${escapeHtml(formatOwnerDisplayValue(row.status))}</td>`,
      `<td>${escapeHtml(formatOwnerDisplayValue(row.subscription && (row.subscription.billingCycle || '-')))}</td>`,
      `<td>${escapeHtml(row.subscription && (row.subscription.renewsAt ? formatDateTime(row.subscription.renewsAt) : '-'))}</td>`,
      `<td>${escapeHtml(formatCurrencyCents(row.subscription && row.subscription.amountCents || 0, row.subscription && row.subscription.currency || 'THB'))}</td>`,
      '</tr>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-workspace" data-owner-focus-route="subscriptions billing">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การสมัครใช้งาน</span><h2 class="odv4-section-title">ภาพรวมการสมัครใช้งานและรายได้</h2><p class="odv4-section-copy">รวมการต่ออายุ ความเสี่ยงด้านรายได้ และสุขภาพของใบแจ้งหนี้ไว้ในหน้าเดียว เพื่อให้เจ้าของระบบตัดสินใจได้เร็วขึ้น</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'รายได้วันนี้', value: formatCurrencyCents(invoiceSummary.revenueTodayCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้ววันนี้', tone: 'success' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้วเดือนนี้', tone: 'info' },
        { label: 'ใบแจ้งหนี้ที่ยังเปิดอยู่', value: formatNumber(invoiceSummary.openInvoiceCount, '0'), detail: 'ใบแจ้งหนี้ที่ยังรอการชำระ', tone: invoiceSummary.openInvoiceCount ? 'warning' : 'success' },
        { label: 'การชำระเงินที่ล้มเหลว', value: formatNumber(invoiceSummary.failedPaymentCount, '0'), detail: 'รายการที่ควรตรวจสอบเพิ่มเติม', tone: invoiceSummary.failedPaymentCount ? 'danger' : 'success' },
      ])}</div>`,
      '<div class="odvc4-note-card"><strong>บัญชีที่ใกล้หมดอายุ</strong><p>',
      expiringRows.length
        ? escapeHtml(expiringRows.slice(0, 3).map((row) => `${row.name} · ${formatDateTime(row.renewsAt)}`).join(' · '))
        : 'ยังไม่มีการสมัครใช้รายการใดที่จะหมดอายุใน 14 วันข้างหน้า',
      '</p></div>',
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-actions">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">อัปเดตการต่ออายุจากหน้านี้</h2><p class="odv4-section-copy">จัดการบัญชีที่ใกล้หมดอายุ ค้างชำระ หรือเสี่ยงสูงก่อน แล้วค่อยเปิดหน้าลูกค้าเมื่อจำเป็น</p></div>',
      `<div class="odvc4-card-grid">${quickForms || '<div class="odvc4-note-card"><strong>ยังไม่มีข้อมูลลูกค้า</strong><p>สร้างลูกค้ารายแรกก่อน แล้วค่อยกลับมาจัดการการสมัครใช้งานจากหน้านี้</p></div>'}</div>`,
      '</section>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>แพ็กเกจ</th><th>สถานะ</th><th>รอบบิล</th><th>ต่ออายุเมื่อ</th><th>จำนวนเงิน</th><th>การทำงาน</th></tr></thead><tbody>',
      subscriptionTableRows || '<tr><td colspan="7">ยังไม่มีรายการสมัครใช้งาน</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderSubscriptionsWorkspaceV3(expiringRows, invoiceSummary, tenantRows, packageCatalog, planOptions, billingInvoices, billingPaymentAttempts) {
    const rows = Array.isArray(tenantRows) ? tenantRows : [];
    const invoices = Array.isArray(billingInvoices) ? billingInvoices : [];
    const paymentAttempts = Array.isArray(billingPaymentAttempts) ? billingPaymentAttempts : [];
    const recoveryQueue = buildBillingRecoveryQueue(rows, invoices, paymentAttempts);
    const riskSpotlightItems = [
      invoiceSummary.failedPaymentCount
        ? `${formatNumber(invoiceSummary.failedPaymentCount, '0')} failed payment attempts need recovery`
        : '',
      invoiceSummary.openInvoiceCount
        ? `${formatNumber(invoiceSummary.openInvoiceCount, '0')} invoices are still open or past due`
        : '',
      invoiceSummary.disputedInvoiceCount
        ? `${formatNumber(invoiceSummary.disputedInvoiceCount, '0')} invoices were marked disputed`
        : '',
      invoiceSummary.refundedInvoiceCount
        ? `${formatNumber(invoiceSummary.refundedInvoiceCount, '0')} invoices were marked refunded`
        : '',
    ].filter(Boolean);
    const billingExportBaseUrl = '/owner/api/platform/billing/export';
    const packageLabelLookup = buildOwnerPackageLabelLookup(packageCatalog);
    const packageOptions = (Array.isArray(packageCatalog) ? packageCatalog : [])
      .filter((entry) => trimText(entry && entry.id, 120))
      .filter((entry) => trimText(entry && entry.status, 40).toLowerCase() !== 'archived')
      .map((entry) => ({
        value: trimText(entry.id, 120),
        label: `${trimText(entry.id, 120)} · ${firstNonEmpty([entry.title, entry.id], trimText(entry.id, 120))}`,
      }));
    const planIdOptions = (Array.isArray(planOptions) ? planOptions : [])
      .filter((option) => trimText(option && option.value, 120))
      .map((option) => ({
        value: trimText(option.value, 120),
        label: firstNonEmpty([option.label, option.title, option.value], trimText(option.value, 120)),
      }));
    const localizedPackageOptions = packageOptions.map((entry) => ({
      value: entry.value,
      label: buildOwnerPackageOptionLabel(entry),
    }));
    const actionableRows = rows
      .filter(Boolean)
      .sort((left, right) => {
        const leftHasSubscription = left && left.subscription ? 0 : 1;
        const rightHasSubscription = right && right.subscription ? 0 : 1;
        if (leftHasSubscription !== rightHasSubscription) return leftHasSubscription - rightHasSubscription;
        const leftDate = parseDate(left && left.subscription && left.subscription.renewsAt);
        const rightDate = parseDate(right && right.subscription && right.subscription.renewsAt);
        return (leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER)
          - (rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER);
      })
      .slice(0, 6);
    const tenantLookup = new Map(rows.map((row) => [trimText(row && row.tenantId, 160), row]));
    const invoiceLookup = new Map(invoices.map((row) => [trimText(row && row.id, 160), row]));
    const recoveryQueueCards = recoveryQueue.map((item) => [
      `<article class="odvc4-note-card" data-owner-billing-recovery-item="${escapeHtml(item.key)}">`,
      `<div class="odvc4-action-row"><span class="odv4-pill odv4-pill-${escapeHtml(item.tone || 'warning')}">${escapeHtml(item.label || 'Recovery item')}</span></div>`,
      `<strong>${escapeHtml(item.title || 'Billing recovery')}</strong>`,
      `<p>${escapeHtml(item.detail || '')}</p>`,
      item.actions
        ? `<div class="odvc4-action-row">${item.actions}</div>`
        : '<div class="odvc4-inline-note">No immediate action configured.</div>',
      '</article>',
    ].join('')).join('');
    const recoveryQueuePanel = [
      '<section class="odv4-panel odvc4-panel" id="owner-billing-recovery-queue" data-owner-billing-recovery-queue>',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Recovery queue</span><h2 class="odv4-section-title">Resolve billing issues before they grow</h2><p class="odv4-section-copy">Prioritized billing follow-up items surface the owner actions that already exist in the workspace so support can recover revenue faster.</p></div>',
      recoveryQueueCards
        ? `<div class="odvc4-card-grid">${recoveryQueueCards}</div>`
        : '<div class="odvc4-note-card"><strong>No urgent billing recovery work</strong><p>No urgent billing recovery work is waiting right now.</p></div>',
      '</section>',
    ].join('');
    const quickActionCards = actionableRows.map((row) => {
      const subscription = row.subscription || {};
      const hasSubscription = Boolean(subscription && (subscription.id || subscription.planId || subscription.renewsAt || subscription.status));
      const packageId = firstNonEmpty([
        packageOptions.find((entry) => entry.value === row.packageId)?.value,
        packageOptions.find((entry) => entry.value === trimText(subscription.packageId, 120))?.value,
        packageOptions[0] && packageOptions[0].value,
      ], '');
      const planId = firstNonEmpty([
        trimText(subscription.planId, 120),
        planIdOptions.find((entry) => entry.value === packageId)?.value,
        packageId,
      ], '');
      const effectivePlanOptions = planIdOptions.length
        ? planIdOptions
        : localizedPackageOptions.map((entry) => ({ value: entry.value, label: entry.label }));
      return [
        '<article class="odvc4-package-card">',
        `<span class="odv4-table-label">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</span>`,
      `<strong>${escapeHtml(firstNonEmpty([row.packageLabel, packageId], 'การสมัครใช้งาน'))}</strong>`,
        `<p>${escapeHtml(firstNonEmpty([
          hasSubscription && subscription.renewsAt ? `Renews ${formatDateTime(subscription.renewsAt)}` : '',
          hasSubscription ? `Current status: ${row.status}` : '',
        ], hasSubscription ? 'Review and save subscription terms from this card.' : 'Create the first subscription for this customer from this card.'))}</p>`,
        '<form class="odvc4-form" data-owner-form="quick-update-subscription">',
        renderFormField({ name: 'tenantId', type: 'hidden', value: row.tenantId }),
        renderFormField({ name: 'subscriptionId', type: 'hidden', value: subscription.id || '' }),
        renderFormField({ name: 'currency', type: 'hidden', value: subscription.currency || 'THB' }),
        renderFormField({ name: 'externalRef', type: 'hidden', value: subscription.externalRef || '' }),
        '<div class="odvc4-form-grid">',
        renderFormField({ name: 'packageId', label: 'แพ็กเกจ', type: 'select', value: packageId, options: localizedPackageOptions }),
        renderFormField({ name: 'planId', label: 'แผน', type: 'select', value: planId, options: effectivePlanOptions }),
        renderFormField({ name: 'status', label: 'สถานะ', type: 'select', value: subscription.status || 'active', options: [
          { value: 'active', label: 'ใช้งานอยู่' },
          { value: 'trialing', label: 'กำลังทดลองใช้' },
          { value: 'pending', label: 'รอดำเนินการ' },
          { value: 'past_due', label: 'ค้างชำระ' },
          { value: 'canceled', label: 'ยกเลิกแล้ว' },
          { value: 'expired', label: 'หมดอายุ' },
        ] }),
        renderFormField({ name: 'billingCycle', label: 'รอบบิล', type: 'select', value: subscription.billingCycle || 'monthly', options: [
          { value: 'trial', label: 'ทดลองใช้' },
          { value: 'monthly', label: 'รายเดือน' },
          { value: 'quarterly', label: 'รายไตรมาส' },
          { value: 'yearly', label: 'รายปี' },
        ] }),
        renderFormField({ name: 'amountCents', label: 'จำนวนเงิน (สตางค์)', type: 'number', value: subscription.amountCents || 0 }),
        renderFormField({ name: 'renewsAt', label: 'ต่ออายุเมื่อ', type: 'datetime-local', value: toLocalDateTimeInputValue(subscription.renewsAt || subscription.expiresAt || subscription.endsAt) }),
        '</div>',
        `<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">${hasSubscription ? 'บันทึกการสมัครใช้งาน' : 'สร้างการสมัครใช้งาน'}</button><a class="odv4-button odv4-button-secondary" href="${escapeHtml(ownerTenantHref(row.tenantId))}">เปิดหน้าลูกค้า</a></div>`,
        '</form>',
        '</article>',
      ].join('');
    }).join('');
    const quickForms = `${recoveryQueuePanel}${quickActionCards}`;
    const subscriptionTableRows = rows.slice(0, 16).map((row) => {
      const subscription = row.subscription || {};
      const subscriptionStatus = trimText(subscription.status || row.status, 40).toLowerCase();
      const actionButtons = [
        subscription && subscription.id && subscriptionStatus !== 'canceled'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="cancel-billing-subscription" data-tenant-id="${escapeHtml(row.tenantId)}" data-subscription-id="${escapeHtml(trimText(subscription.id, 160))}" data-plan-id="${escapeHtml(trimText(subscription.planId, 120))}" data-package-id="${escapeHtml(trimText(row.packageId || subscription.packageId, 120))}" data-billing-cycle="${escapeHtml(trimText(subscription.billingCycle, 40) || 'monthly')}" data-currency="${escapeHtml(trimText(subscription.currency, 12) || 'THB')}" data-amount-cents="${escapeHtml(String(Number(subscription.amountCents) || 0))}" data-external-ref="${escapeHtml(trimText(subscription.externalRef, 200))}">Cancel subscription</button>`
          : '',
        subscription && subscription.id && ['canceled', 'past_due', 'expired'].includes(subscriptionStatus)
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(row.tenantId)}" data-subscription-id="${escapeHtml(trimText(subscription.id, 160))}" data-plan-id="${escapeHtml(trimText(subscription.planId, 120))}" data-package-id="${escapeHtml(trimText(row.packageId || subscription.packageId, 120))}" data-billing-cycle="${escapeHtml(trimText(subscription.billingCycle, 40) || 'monthly')}" data-currency="${escapeHtml(trimText(subscription.currency, 12) || 'THB')}" data-amount-cents="${escapeHtml(String(Number(subscription.amountCents) || 0))}" data-external-ref="${escapeHtml(trimText(subscription.externalRef, 200))}">Reactivate subscription</button>`
          : '',
      ].filter(Boolean).join('');
      return [
        '<tr>',
        `<td><a href="${escapeHtml(ownerTenantHref(row.tenantId))}">${escapeHtml(row.tenant && (row.tenant.name || row.tenant.slug) || row.tenantId)}</a></td>`,
        `<td>${escapeHtml(row.packageLabel)}</td>`,
        `<td>${escapeHtml(row.status)}</td>`,
        `<td>${escapeHtml(subscription && (subscription.billingCycle || '-'))}</td>`,
        `<td>${escapeHtml(subscription && (subscription.renewsAt ? formatDateTime(subscription.renewsAt) : '-'))}</td>`,
        `<td>${escapeHtml(formatCurrencyCents(subscription && subscription.amountCents || 0, subscription && subscription.currency || 'THB'))}</td>`,
        `<td><div class="odvc4-action-row">${actionButtons || '<span class="odvc4-inline-note">No extra actions</span>'}</div></td>`,
        '</tr>',
      ].join('');
    }).join('');
    const invoiceRows = invoices.slice(0, 10).map((row) => {
      const tenantId = trimText(row && row.tenantId, 160);
      const invoiceId = trimText(row && row.id, 160);
      const metadata = parseObject(row && (row.metadata || row.metadataJson || row.meta));
      const tenantRow = tenantLookup.get(tenantId) || null;
      const subscription = tenantRow && tenantRow.subscription ? tenantRow.subscription : {};
      const planId = firstNonEmpty([metadata.targetPlanId, row && row.planId, subscription.planId], '');
      const packageId = firstNonEmpty([metadata.targetPackageId, row && row.packageId, tenantRow && tenantRow.packageId], '');
      const billingCycle = firstNonEmpty([metadata.targetBillingCycle, row && row.billingCycle, subscription.billingCycle], 'monthly');
      const actionButtons = [
        trimText(row && row.status, 40).toLowerCase() !== 'paid'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="paid">บันทึกว่าชำระแล้ว</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'past_due'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="past_due">บันทึกว่าค้างชำระ</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'disputed'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="disputed">Mark disputed</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'refunded'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="refunded">Mark refunded</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'void'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="void">ยกเลิกใบแจ้งหนี้</button>`
          : '',
        tenantId
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-subscription-id="${escapeHtml(trimText(row && row.subscriptionId, 160) || trimText(subscription.id, 160))}" data-plan-id="${escapeHtml(planId)}" data-package-id="${escapeHtml(packageId)}" data-billing-cycle="${escapeHtml(billingCycle)}" data-amount-cents="${escapeHtml(String(Number(row && row.amountCents) || 0))}" data-currency="${escapeHtml(trimText(row && row.currency, 12) || 'THB')}">ลอง checkout ใหม่</button>`
          : '',
      ].filter(Boolean).join('');
      return [
        '<tr>',
        `<td>${tenantId ? `<a href="${escapeHtml(ownerTenantHref(tenantId))}">${escapeHtml(tenantRow && tenantRow.tenant && (tenantRow.tenant.name || tenantRow.tenant.slug) || tenantId)}</a>` : '-'}</td>`,
        `<td>${escapeHtml(invoiceId || '-')}</td>`,
        `<td>${escapeHtml(formatOwnerDisplayValue(trimText(row && row.status, 40) || '-'))}</td>`,
        `<td>${escapeHtml(formatCurrencyCents(row && row.amountCents || 0, row && row.currency || 'THB'))}</td>`,
        `<td>${escapeHtml(formatDateTime(row && (row.dueAt || row.paidAt || row.updatedAt || row.createdAt)))}</td>`,
        `<td><div class="odvc4-action-row">${actionButtons || '<span class="odvc4-inline-note">ไม่มีการทำงานเพิ่มเติม</span>'}</div></td>`,
        '</tr>',
      ].join('');
    }).join('');
    const paymentAttemptRows = paymentAttempts.slice(0, 10).map((row) => {
      const tenantId = trimText(row && row.tenantId, 160);
      const attemptId = trimText(row && row.id, 160);
      const invoice = invoiceLookup.get(trimText(row && row.invoiceId, 160)) || null;
      const tenantRow = tenantLookup.get(tenantId) || null;
      const invoiceMeta = parseObject(invoice && (invoice.metadata || invoice.metadataJson || invoice.meta));
      const subscription = tenantRow && tenantRow.subscription ? tenantRow.subscription : {};
      const planId = firstNonEmpty([invoiceMeta.targetPlanId, invoice && invoice.planId, subscription.planId], '');
      const packageId = firstNonEmpty([invoiceMeta.targetPackageId, invoice && invoice.packageId, tenantRow && tenantRow.packageId], '');
      const billingCycle = firstNonEmpty([invoiceMeta.targetBillingCycle, invoice && invoice.billingCycle, subscription.billingCycle], 'monthly');
      const actionButtons = [
        trimText(row && row.status, 40).toLowerCase() !== 'succeeded'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-payment-attempt-status" data-tenant-id="${escapeHtml(tenantId)}" data-attempt-id="${escapeHtml(attemptId)}" data-target-status="succeeded">บันทึกว่าสำเร็จ</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'failed'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-payment-attempt-status" data-tenant-id="${escapeHtml(tenantId)}" data-attempt-id="${escapeHtml(attemptId)}" data-target-status="failed">บันทึกว่าล้มเหลว</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'canceled'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-payment-attempt-status" data-tenant-id="${escapeHtml(tenantId)}" data-attempt-id="${escapeHtml(attemptId)}" data-target-status="canceled">ยกเลิกรายการนี้</button>`
          : '',
        tenantId
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(trimText(row && row.invoiceId, 160) || trimText(invoice && invoice.id, 160))}" data-subscription-id="${escapeHtml(trimText(invoice && invoice.subscriptionId, 160) || trimText(subscription.id, 160))}" data-plan-id="${escapeHtml(planId)}" data-package-id="${escapeHtml(packageId)}" data-billing-cycle="${escapeHtml(billingCycle)}" data-amount-cents="${escapeHtml(String(Number(row && row.amountCents) || Number(invoice && invoice.amountCents) || 0))}" data-currency="${escapeHtml(trimText(row && row.currency, 12) || trimText(invoice && invoice.currency, 12) || 'THB')}">ลอง checkout ใหม่</button>`
          : '',
      ].filter(Boolean).join('');
      return [
        '<tr>',
        `<td>${tenantId ? `<a href="${escapeHtml(ownerTenantHref(tenantId))}">${escapeHtml(tenantRow && tenantRow.tenant && (tenantRow.tenant.name || tenantRow.tenant.slug) || tenantId)}</a>` : '-'}</td>`,
        `<td>${escapeHtml(attemptId || '-')}</td>`,
        `<td>${escapeHtml(formatOwnerProviderDisplayLabel(trimText(row && row.provider, 40) || '-'))}</td>`,
        `<td>${escapeHtml(formatOwnerDisplayValue(trimText(row && row.status, 40) || '-'))}</td>`,
        `<td>${escapeHtml(formatCurrencyCents(row && row.amountCents || 0, row && row.currency || 'THB'))}</td>`,
        `<td>${escapeHtml(formatDateTime(row && (row.attemptedAt || row.completedAt || row.updatedAt || row.createdAt)))}</td>`,
        `<td><div class="odvc4-action-row">${actionButtons || '<span class="odvc4-inline-note">ไม่มีการทำงานเพิ่มเติม</span>'}</div></td>`,
        '</tr>',
      ].join('');
    }).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-workspace" data-owner-focus-route="subscriptions billing">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การสมัครใช้งาน</span><h2 class="odv4-section-title">ภาพรวมการสมัครใช้งานและรายได้</h2><p class="odv4-section-copy">รวมการต่ออายุ ความเสี่ยงด้านรายได้ และสุขภาพของใบแจ้งหนี้ไว้ในหน้าเดียว เพื่อให้เจ้าของระบบตัดสินใจได้เร็วขึ้น</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'รายได้วันนี้', value: formatCurrencyCents(invoiceSummary.revenueTodayCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้ววันนี้', tone: 'success' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้วเดือนนี้', tone: 'info' },
        { label: 'ใบแจ้งหนี้ที่ยังเปิดอยู่', value: formatNumber(invoiceSummary.openInvoiceCount, '0'), detail: 'ใบแจ้งหนี้ที่ยังรอการชำระ', tone: invoiceSummary.openInvoiceCount ? 'warning' : 'success' },
        { label: 'การชำระเงินที่ล้มเหลว', value: formatNumber(invoiceSummary.failedPaymentCount, '0'), detail: 'รายการที่ควรตรวจสอบเพิ่มเติม', tone: invoiceSummary.failedPaymentCount ? 'danger' : 'success' },
      ])}</div>`,
      '<div class="odvc4-card-grid">',
      `<div class="odvc4-note-card" data-owner-billing-risk-spotlight><strong>Risk spotlight</strong><p>${escapeHtml(riskSpotlightItems.length ? riskSpotlightItems.join(' · ') : 'No urgent billing recovery signals right now.')}</p></div>`,
      `<div class="odvc4-note-card" data-owner-billing-export-actions><strong>Export billing evidence</strong><p>${escapeHtml(`${formatNumber(invoices.length, '0')} invoices and ${formatNumber(paymentAttempts.length, '0')} payment attempts are available for export.`)}</p><div class="odvc4-action-row"><a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${billingExportBaseUrl}?format=csv`)}" download>Export CSV</a><a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${billingExportBaseUrl}?format=json`)}" download>Export JSON</a></div></div>`,
      '</div>',
      '<div class="odvc4-note-card"><strong>บัญชีที่ใกล้หมดอายุ</strong><p>',
      expiringRows.length
        ? escapeHtml(expiringRows.slice(0, 3).map((row) => `${row.name} · ${formatDateTime(row.renewsAt)}`).join(' · '))
        : 'ยังไม่มีการสมัครใช้รายการใดที่จะหมดอายุใน 14 วันข้างหน้า',
      '</p></div>',
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-actions">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">อัปเดตการต่ออายุได้จากหน้านี้ทันที</h2><p class="odv4-section-copy">จัดการบัญชีที่ใกล้หมดอายุ ค้างชำระ หรือมีความเสี่ยงก่อน แล้วค่อยเปิดประวัติลูกค้าเมื่อจำเป็นต้องดูรายละเอียดเพิ่ม</p></div>',
      `<div class="odvc4-card-grid">${quickForms || '<div class="odvc4-note-card"><strong>ยังไม่มีประวัติลูกค้า</strong><p>สร้างลูกค้ารายแรกก่อน แล้วค่อยจัดการการสมัครใช้จากหน้านี้</p></div>'}</div>`,
      '</section>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>แพ็กเกจ</th><th>สถานะ</th><th>รอบชำระ</th><th>ต่ออายุเมื่อ</th><th>จำนวนเงิน</th><th>การทำงาน</th></tr></thead><tbody>',
      subscriptionTableRows || '<tr><td colspan="7">ยังไม่มีรายการการสมัครใช้</td></tr>',
      '</tbody></table></div>',
      '<section class="odv4-panel odvc4-panel" id="owner-billing-invoices-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานด้านการเงิน</span><h2 class="odv4-section-title">ติดตามใบแจ้งหนี้</h2><p class="odv4-section-copy">เปลี่ยนสถานะใบแจ้งหนี้หรือเริ่มการชำระใหม่ได้จากหน้านี้ โดยไม่ต้องออกจากพื้นที่งานของเจ้าของระบบ</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>ใบแจ้งหนี้</th><th>สถานะ</th><th>จำนวนเงิน</th><th>ครบกำหนด / ชำระแล้ว</th><th>การทำงาน</th></tr></thead><tbody>',
      invoiceRows || '<tr><td colspan="6">ยังไม่มีใบแจ้งหนี้</td></tr>',
      '</tbody></table></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-billing-attempts-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ความพยายามชำระเงิน</span><h2 class="odv4-section-title">ตรวจรายการพยายามชำระเงิน</h2><p class="odv4-section-copy">บันทึกผลการชำระหรือเริ่ม checkout ใหม่เมื่อลูกค้าต้องการลิงก์ชำระเงินชุดใหม่</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>รายการ</th><th>ผู้ให้บริการ</th><th>สถานะ</th><th>จำนวนเงิน</th><th>เวลา</th><th>การทำงาน</th></tr></thead><tbody>',
      paymentAttemptRows || '<tr><td colspan="7">ยังไม่มีความพยายามชำระเงิน</td></tr>',
      '</tbody></table></div>',
      '</section>',
      '</section>',
    ].join('');
  }

  function renderSettingsWorkspaceV2(state) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const billingProvider = state.billingOverview && state.billingOverview.provider && typeof state.billingOverview.provider === 'object'
      ? state.billingOverview.provider
      : {};
    const automationConfig = overview.automationConfig && typeof overview.automationConfig === 'object'
      ? overview.automationConfig
      : {};
    const opsState = overview.opsState && typeof overview.opsState === 'object'
      ? overview.opsState
      : {};
    const controlPanelSettings = state.controlPanelSettings && typeof state.controlPanelSettings === 'object'
      ? state.controlPanelSettings
      : {};
    const env = controlPanelSettings.env && typeof controlPanelSettings.env === 'object'
      ? controlPanelSettings.env
      : {};
    const adminUsers = Array.isArray(controlPanelSettings.adminUsers)
      ? controlPanelSettings.adminUsers
      : [];
    const managedServices = Array.isArray(controlPanelSettings.managedServices)
      ? controlPanelSettings.managedServices
      : [];
    const accessPolicyPanel = renderEnvSettingsPanel({
      id: 'owner-settings-access-policy',
      kicker: 'งานหลัก',
      title: 'อัปเดตนโยบายสิทธิ์ของเจ้าของระบบ',
      copy: 'ปรับสิทธิ์การเข้าถึงของเจ้าของระบบ นโยบายเซสชัน และกติกาความปลอดภัยได้จากหน้าเว็บนี้โดยตรง',
      fileKey: 'root',
      section: env.root,
      keys: [
        'ADMIN_WEB_SSO_DISCORD_ENABLED',
        'ADMIN_WEB_SSO_DEFAULT_ROLE',
        'ADMIN_WEB_2FA_ENABLED',
        'ADMIN_WEB_STEP_UP_ENABLED',
        'ADMIN_WEB_STEP_UP_TTL_MINUTES',
        'ADMIN_WEB_SESSION_TTL_HOURS',
        'ADMIN_WEB_SESSION_IDLE_MINUTES',
        'ADMIN_WEB_SESSION_MAX_PER_USER',
        'ADMIN_WEB_SECURE_COOKIE',
        'ADMIN_WEB_HSTS_ENABLED',
        'ADMIN_WEB_ENFORCE_ORIGIN_CHECK',
        'ADMIN_WEB_ALLOWED_ORIGINS',
        'ADMIN_LOG_LANGUAGE',
      ],
      submitLabel: 'บันทึกนโยบายสิทธิ์',
      note: 'ระบบจะเขียนเฉพาะคีย์ที่อนุญาตในระบบกลาง และยังคงคำแนะนำเรื่องการรีสตาร์ตตามข้อมูลกำกับเดิม',
    });
    const portalPolicyPanel = renderEnvSettingsPanel({
      id: 'owner-settings-portal-policy',
      kicker: 'งานรอง',
      title: 'อัปเดตนโยบายพอร์ทัลผู้เล่น',
      copy: 'จัดการกติกาการเข้าใช้งาน cookie และเงื่อนไขการเข้าเล่นให้ตรงกับนโยบายปัจจุบัน',
      fileKey: 'portal',
      section: env.portal,
      keys: [
        'WEB_PORTAL_BASE_URL',
        'WEB_PORTAL_ALLOWED_DISCORD_IDS',
        'WEB_PORTAL_PLAYER_OPEN_ACCESS',
        'WEB_PORTAL_REQUIRE_GUILD_MEMBER',
        'WEB_PORTAL_SECURE_COOKIE',
        'WEB_PORTAL_ENFORCE_ORIGIN_CHECK',
        'WEB_PORTAL_SESSION_TTL_HOURS',
        'WEB_PORTAL_COOKIE_SAMESITE',
      ],
      submitLabel: 'บันทึกนโยบายพอร์ทัล',
      note: 'ค่าของพอร์ทัลยังใช้ flow เดิมที่ผูกกับ environment และจะแจ้งคำแนะนำเรื่อง restart เมื่อจำเป็น',
    });
    const billingPolicyPanel = renderEnvSettingsPanel({
      id: 'owner-settings-billing-policy',
      kicker: 'งานรอง',
      title: 'อัปเดตนโยบายการชำระเงินและเช็กเอาต์',
      copy: 'ดูแลผู้ให้บริการชำระเงิน URL พื้นฐานของการเช็กเอาต์ และคีย์ Stripe ให้ตรงกับขั้นตอนเชิงพาณิชย์ที่ใช้งานจริง',
      fileKey: 'root',
      section: env.root,
      keys: [
        'PLATFORM_BILLING_PROVIDER',
        'PLATFORM_PUBLIC_BASE_URL',
        'PLATFORM_BILLING_STRIPE_PUBLISHABLE_KEY',
        'PLATFORM_BILLING_STRIPE_SECRET_KEY',
        'PLATFORM_BILLING_WEBHOOK_SECRET',
      ],
      submitLabel: 'บันทึกนโยบายการชำระเงิน',
      note: 'ช่องคีย์ลับที่ปล่อยว่างจะคงค่าปัจจุบันไว้ จึงกรอกเฉพาะเวลาที่ต้องหมุนคีย์เท่านั้น',
    });
    const runtimePolicyPanel = renderEnvSettingsPanel({
      id: 'owner-settings-runtime-policy',
      kicker: 'งานรอง',
      title: 'อัปเดตนโยบายความปลอดภัยของบริการ',
      copy: 'ควบคุมพฤติกรรมการเก็บข้อมูล การทำงาน และการซิงก์ของบริการส่วนกลางได้โดยไม่ต้องแก้ env บนเครื่องเซิร์ฟเวอร์',
      fileKey: 'root',
      section: env.root,
      keys: [
        'PERSIST_REQUIRE_DB',
        'PERSIST_LEGACY_SNAPSHOTS',
        'DELIVERY_EXECUTION_MODE',
        'SCUM_CONSOLE_AGENT_REQUIRED',
        'SCUM_WATCHER_REQUIRED',
        'SCUM_SYNC_TRANSPORT',
      ],
      submitLabel: 'บันทึกนโยบายบริการ',
      note: 'ใช้แผงนี้กับค่ากลางของแพลตฟอร์มเท่านั้น งานปฏิบัติการเฉพาะเซิร์ฟเวอร์ยังอยู่ในพื้นที่ผู้ดูแลลูกค้า',
    });
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-settings-workspace" data-owner-focus-route="settings">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">ตั้งค่าระบบ</span><h2 class="odv4-section-title">นโยบายแพลตฟอร์มและการตั้งค่าระบบ</h2><p class="odv4-section-copy">ใช้หน้านี้เพื่ออัปเดตกติกาสิทธิ์ของเจ้าของระบบ นโยบายพอร์ทัลผู้เล่น บัญชีผู้ดูแล และบริการส่วนกลาง โดยไม่ต้องแก้ไฟล์ฝั่งเซิร์ฟเวอร์โดยตรง</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'ผู้ให้บริการชำระเงิน', value: formatOwnerProviderDisplayLabel(firstNonEmpty([billingProvider.provider, 'platform_local'])), detail: formatOwnerProviderDisplayLabel(firstNonEmpty([billingProvider.mode, 'ยังไม่ตั้งค่า'])), tone: 'info' },
        { label: 'ระบบอัตโนมัติ', value: automationConfig.enabled === false ? 'ปิดใช้งาน' : 'เปิดใช้งาน', detail: `สูงสุด ${formatNumber(automationConfig.maxActionsPerCycle || 0, '0')} งานต่อรอบ`, tone: automationConfig.enabled === false ? 'warning' : 'success' },
        { label: 'การเฝ้าระวัง', value: opsState.lastMonitoringAt ? formatDateTime(opsState.lastMonitoringAt) : 'ยังไม่ทราบ', detail: 'รอบล่าสุดของการเฝ้าระวังแพลตฟอร์ม', tone: 'info' },
        { label: 'บัญชีผู้ดูแล', value: formatNumber(adminUsers.length, '0'), detail: 'บัญชีของเจ้าของระบบและทีมปฏิบัติการแพลตฟอร์ม', tone: adminUsers.length ? 'info' : 'warning' },
      ])}</div>`,
      '<div class="odvc4-note-card"><strong>ขอบเขตของหน้านี้</strong><p>หน้าตั้งค่าเจ้าของระบบใช้สำหรับนโยบายแพลตฟอร์ม สิทธิ์ และบริการส่วนกลางเท่านั้น งานของลูกค้าแต่ละรายยังอยู่ในพื้นที่ผู้ดูแลลูกค้า</p></div>',
      accessPolicyPanel,
      portalPolicyPanel,
      billingPolicyPanel,
      runtimePolicyPanel,
      '<section class="odv4-panel odvc4-panel" id="owner-settings-admin-users">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานรอง</span><h2 class="odv4-section-title">จัดการบัญชีเจ้าของระบบ</h2><p class="odv4-section-copy">สร้างหรืออัปเดตบัญชีของเจ้าของระบบและทีมปฏิบัติการแพลตฟอร์มได้โดยไม่ต้องเปิดฐานข้อมูลโดยตรง</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>สถานะ</th><th>ขอบเขตลูกค้า</th></tr></thead><tbody>',
      renderAdminUsersTable(adminUsers),
      '</tbody></table></div>',
      '<form class="odvc4-form" data-owner-form="upsert-admin-user">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'username', label: 'ชื่อผู้ใช้', type: 'text', required: true, value: '', autocomplete: 'username' }),
      renderFormField({ name: 'role', label: 'บทบาท', type: 'select', value: 'admin', options: [
        { value: 'owner', label: 'เจ้าของระบบ' },
        { value: 'admin', label: 'ผู้ดูแล' },
        { value: 'mod', label: 'ปฏิบัติการ' },
      ] }),
      renderFormField({ name: 'password', label: 'รหัสผ่าน', type: 'password', value: '', description: 'ปล่อยว่างได้เฉพาะกรณีที่เปลี่ยนบทบาทหรือสถานะโดยไม่ต้องหมุนรหัสผ่าน', autocomplete: 'new-password' }),
      renderFormField({ name: 'isActive', label: 'สถานะ', type: 'select', value: 'true', options: [
        { value: 'true', label: 'ใช้งานอยู่' },
        { value: 'false', label: 'ไม่ใช้งาน' },
      ] }),
      renderFormField({ name: 'tenantId', label: 'ขอบเขตลูกค้า', type: 'text', value: '', description: 'ปล่อยว่างไว้หากให้เข้าถึงได้ทั้งแพลตฟอร์ม กรอกเฉพาะเมื่อต้องการจำกัดบัญชีไว้กับลูกค้ารายเดียว', autocomplete: 'off' }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">บันทึกบัญชีผู้ดูแล</button></div>',
      '</form>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-settings-managed-services">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">รายละเอียด / ประวัติ</span><h2 class="odv4-section-title">บริการที่ดูแลโดยระบบ</h2><p class="odv4-section-copy">รีสตาร์ตบริการส่วนกลางจากฝั่ง Owner เฉพาะเมื่อมีการเปลี่ยนค่า config หรือเกิดปัญหาที่ต้องจัดการเท่านั้น</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>บริการ</th><th>ชื่อใน PM2</th><th>การทำงาน</th></tr></thead><tbody>',
      renderManagedServicesTable(managedServices),
      '</tbody></table></div>',
      '</section>',
      '</section>',
    ].join('');
  }

  return {
    normalizeOwnerControlRoute,
    createOwnerControlV4Model: function createOwnerControlV4Model(source, options) {
      const state = source && typeof source === 'object' ? source : {};
      const settings = options && typeof options === 'object' ? options : {};
      const rawRoute = trimText(settings.currentRoute).toLowerCase();
      const routeKind = normalizeOwnerControlRoute(rawRoute);
      const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
      const packageCatalog = Array.isArray(overview.packages) && overview.packages.length
        ? overview.packages
        : [];
      const featureCatalog = Array.isArray(overview.features) && overview.features.length
        ? overview.features
        : [];
      const planOptions = Array.isArray(overview.plans) && overview.plans.length
        ? overview.plans.map((plan) => ({
            value: firstNonEmpty([plan.id, plan.planId, plan.code], ''),
            label: firstNonEmpty([plan.title, plan.name, plan.id, plan.planId], ''),
          }))
        : packageCatalog.map((entry) => ({ value: entry.id, label: entry.id }));
      const tenantRows = buildTenantRows(state, packageCatalog);
      const invoiceSummary = buildInvoiceSummary(state.billingInvoices, state.billingPaymentAttempts);
      const packageUsageRows = buildPackageUsageRows(tenantRows, packageCatalog);
      const runtimeRows = buildRuntimeRows(state);
      const selectedTenantId = rawRoute.startsWith('support-')
        ? rawRoute.slice('support-'.length)
        : rawRoute.startsWith('tenant-')
          ? rawRoute.slice('tenant-'.length)
          : '';
      const selectedTenant = (routeKind === 'tenant-detail' || routeKind === 'support-detail')
        ? tenantRows.find((row) => row.tenantId === selectedTenantId) || null
        : null;
      const selectedSupportCase = selectedTenant
        ? (
          settings.supportCase
          && trimText(settings.supportCase.tenantId, 160) === selectedTenantId
            ? settings.supportCase
            : null
        )
        : null;
      const selectedSupportDeadLetters = routeKind === 'support-detail' && Array.isArray(settings.supportDeadLetters)
        ? settings.supportDeadLetters
        : [];
      const selectedRuntime = trimText(settings.selectedRuntimeKey, 160)
        ? runtimeRows.find((row) => row.runtimeKey === trimText(settings.selectedRuntimeKey, 160))
        : null;
      const sections = [];
  let headerAction = { label: 'สร้างลูกค้า', href: '#owner-control-workspace', localFocus: true };

      if (routeKind === 'overview') {
        sections.push(renderOverviewWorkspace(state, tenantRows, invoiceSummary, runtimeRows));
      } else if (routeKind === 'tenants') {
        sections.push(renderTenantCreateWorkspace(packageCatalog));
      } else if (routeKind === 'tenant-detail') {
        sections.push(renderTenantDetailWorkspaceLive(
          selectedTenant,
          packageCatalog,
          planOptions,
          runtimeRows,
          selectedSupportCase,
          settings.supportCaseLoading === true,
        ));
        headerAction = { label: 'แก้ไขลูกค้า', href: '#owner-tenant-detail-form', localFocus: true };
      } else if (routeKind === 'support-detail') {
        sections.push(renderTenantSupportWorkspaceLive(
          selectedTenant,
          selectedSupportCase,
          runtimeRows,
          selectedSupportDeadLetters,
          settings.supportCaseLoading === true,
          settings.supportDeadLettersLoading === true,
        ));
        headerAction = { label: 'เปิดเคสดูแลลูกค้า', href: '#owner-tenant-support-workspace', localFocus: true };
      } else if (routeKind === 'packages') {
        sections.push(renderPackagesWorkspace(packageUsageRows, featureCatalog));
        headerAction = { label: 'สร้างแพ็กเกจ', href: '#owner-packages-create-form', localFocus: true };
      } else if (routeKind === 'subscriptions') {
        sections.push(renderSubscriptionsWorkspaceV3(
          buildExpiringRows(tenantRows),
          invoiceSummary,
          tenantRows,
          packageCatalog,
          planOptions,
          state.billingInvoices,
          state.billingPaymentAttempts,
        ));
        headerAction = { label: 'ดูลูกค้าที่ใกล้ต่ออายุ', href: '#owner-subscriptions-workspace', localFocus: true };
      } else if (routeKind === 'runtime') {
        sections.push(renderRuntimeWorkspace(runtimeRows, selectedRuntime, settings.runtimeBootstrap));
      headerAction = { label: 'เปิดทะเบียนบริการ', href: '#owner-runtime-workspace', localFocus: true };
      } else if (routeKind === 'analytics') {
        sections.push(renderAnalyticsWorkspace(state, packageUsageRows, runtimeRows, invoiceSummary));
        headerAction = { label: 'ดูตัวชี้วัดธุรกิจ', href: '#owner-analytics-workspace', localFocus: true };
      } else if (routeKind === 'audit') {
        sections.push(renderAuditWorkspaceV2(state));
        headerAction = { label: 'ดูสัญญาณความปลอดภัย', href: '#owner-audit-workspace', localFocus: true };
      } else if (routeKind === 'settings') {
        sections.push(renderSettingsWorkspaceV2(state));
        headerAction = { label: 'เปิดการตั้งค่าแพลตฟอร์ม', href: '#owner-settings-workspace', localFocus: true };
      }

      return {
        routeKind,
        sections,
        headerAction,
      };
    },
    buildOwnerControlV4Html,
  };
});
