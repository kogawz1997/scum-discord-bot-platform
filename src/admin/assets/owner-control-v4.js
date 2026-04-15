(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./owner-control-risk-v4.js'));
    return;
  }
  root.OwnerControlV4 = factory(root.OwnerControlRiskV4);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (ownerControlRiskV4) {
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

  function escapeHtml(value) {
    return repairMojibakeText(value)
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

  function formatByteSize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '0 KB';
    if (numeric >= 1024 * 1024 * 1024) {
      return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(numeric / (1024 * 1024 * 1024))} GB`;
    }
    if (numeric >= 1024 * 1024) {
      return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(numeric / (1024 * 1024))} MB`;
    }
    return `${formatNumber(Math.max(1, Math.round(numeric / 1024)), '0')} KB`;
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
    'Admin Web': 'เว็บผู้ดูแล',
    'Standalone owner and tenant admin web runtime': 'รันไทม์เว็บฝั่งเจ้าของระบบและผู้ดูแลลูกค้าแบบแยก',
    'Discord Bot': 'บอท Discord',
    'Discord command and automation runtime': 'รันไทม์คำสั่ง Discord และระบบอัตโนมัติ',
    Worker: 'ตัวประมวลผลงาน',
    'Delivery and background job worker': 'ตัวประมวลผลงานส่งของและงานเบื้องหลัง',
    'SCUM Watcher': 'ตัวติดตาม SCUM.log',
    'SCUM log watcher and sync runtime': 'รันไทม์ติดตามและซิงก์ SCUM.log',
    'Server-side sync, config, backup, and server control runtime': 'รันไทม์สำหรับการซิงก์ คอนฟิก สำรองข้อมูล และควบคุมเซิร์ฟเวอร์',
    'Player Portal': 'พอร์ทัลผู้เล่น',
    'Standalone public and player portal': 'เว็บสาธารณะและพอร์ทัลผู้เล่นแบบแยก',
    'Execution runtime for in-game delivery and managed SCUM commands': 'รันไทม์สำหรับการส่งของในเกมและคำสั่ง SCUM แบบควบคุม',
    'Expiring soon': 'ใกล้หมดอายุ',
    'Disputed invoices': 'ใบแจ้งหนี้ที่มีข้อโต้แย้ง',
    'Refunded invoices': 'ใบแจ้งหนี้ที่คืนเงินแล้ว',
    'Invoices waiting for billing review': 'ใบแจ้งหนี้ที่รอฝ่ายการเงินตรวจสอบ',
    'Invoices already refunded': 'ใบแจ้งหนี้ที่คืนเงินแล้ว',
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
    if (route.startsWith('package-')) return 'package-detail';
    if (route === 'packages') return 'packages';
    if (route === 'packages-create' || route === 'packages-entitlements') return route;
    if (route === 'package-detail') return 'package-detail';
    if (route.startsWith('subscription-')) return 'subscription-detail';
    if (route === 'subscriptions' || route === 'subscriptions-registry' || route === 'subscription-detail') return route;
    if (route.startsWith('invoice-')) return 'invoice-detail';
    if (route.startsWith('attempt-')) return 'attempt-detail';
    if (route === 'billing' || route === 'billing-attempts' || route === 'billing-recovery' || route === 'invoice-detail' || route === 'attempt-detail') return route;
    if (route === 'recovery') return 'recovery';
    if (route === 'recovery-create' || route === 'recovery-preview' || route === 'recovery-restore' || route === 'recovery-history') return route;
    if (route === 'analytics' || route === 'observability') return 'analytics';
    if (route === 'analytics-risk' || route === 'analytics-packages') return route;
    if (route === 'audit' || route === 'security' || route === 'access' || route === 'diagnostics') return route;
    if (route === 'runtime' || route === 'runtime-health') return 'runtime';
    if (route === 'settings'
      || route === 'control'
      || route === 'automation'
      || route === 'settings-admin-users'
      || route === 'settings-services'
      || route === 'settings-access-policy'
      || route === 'settings-portal-policy'
      || route === 'settings-billing-policy'
      || route === 'settings-runtime-policy') return route;
    if (route === 'runtime-create-server' || route === 'runtime-provision-runtime' || route === 'incidents' || route === 'jobs' || route === 'support' || route === 'agents-bots' || route === 'fleet-diagnostics') return route;
    return 'overview';
  }

  function ownerTenantHref(tenantId) {
    return `/owner/tenants/${encodeURIComponent(String(tenantId || '').trim())}`;
  }

  function ownerSupportHref(tenantId) {
    return `/owner/support/${encodeURIComponent(String(tenantId || '').trim())}`;
  }

  function buildTenantPlayerIdentityHref(tenantId, options = {}) {
    const params = new URLSearchParams();
    const scopedTenantId = trimText(tenantId, 160);
    const userId = trimText(options.userId, 160);
    const identityAction = trimText(options.identityAction, 80);
    const supportReason = trimText(options.supportReason, 400);
    const supportSource = trimText(options.supportSource, 80);
    const supportOutcome = trimText(options.supportOutcome, 80);
    if (scopedTenantId) params.set('tenantId', scopedTenantId);
    if (userId) params.set('userId', userId);
    if (identityAction) params.set('identityAction', identityAction);
    if (supportReason) params.set('supportReason', supportReason);
    if (supportSource) params.set('supportSource', supportSource);
    if (supportOutcome) params.set('supportOutcome', supportOutcome);
    const query = params.toString();
    return query ? `/tenant/players?${query}` : '/tenant/players';
  }

  function deriveOwnerIdentityAction(row) {
    const status = trimText(row && row.status, 120).toLowerCase();
    const detail = trimText(row && row.detail, 400).toLowerCase();
    if (status === 'missing-steam') return 'bind';
    if (status.includes('steam-mismatch') || status.includes('steam-conflict')) return 'relink';
    if (status.includes('discord-mismatch') || status.includes('identity-conflict')) return 'conflict';
    if (detail.includes('different steam ids') || detail.includes('steam identity does not match')) {
      return 'relink';
    }
    if (detail.includes('discord identity') && detail.includes('does not match')) {
      return 'conflict';
    }
    return 'review';
  }

  function deriveOwnerIdentityActionLabel(action) {
    switch (trimText(action, 40).toLowerCase()) {
      case 'bind':
        return 'Prepare Steam bind';
      case 'unlink':
        return 'Prepare Steam unlink';
      case 'relink':
        return 'Prepare Steam relink';
      case 'conflict':
        return 'Review conflict handoff';
      default:
        return 'Review handoff';
    }
  }

  function deriveOwnerIdentityTrailAction(row) {
    const followupAction = trimText(row && row.followupAction, 80).toLowerCase();
    if (followupAction) return followupAction;
    const supportIntent = trimText(row && row.supportIntent, 80).toLowerCase();
    if (supportIntent) return supportIntent;
    return 'review';
  }

  function formatOwnerIdentitySupportOutcome(value) {
    const normalized = trimText(value, 80).toLowerCase();
    if (normalized === 'resolved') return 'Resolved';
    if (normalized === 'pending-verification') return 'Pending verification';
    if (normalized === 'pending-player-reply') return 'Pending player reply';
    return 'Reviewing';
  }

  const ownerRiskQueueRenderer = ownerControlRiskV4 && typeof ownerControlRiskV4.createOwnerControlRiskV4 === 'function'
    ? ownerControlRiskV4.createOwnerControlRiskV4({
        escapeHtml,
        trimText,
        firstNonEmpty,
        parseObject,
        formatNumber,
        formatDateTime,
        ownerSupportHref,
        ownerTenantHref,
      })
    : {
        buildOwnerRiskQueueItems: function buildOwnerRiskQueueItemsFallback() {
          return [];
        },
        renderOwnerRiskQueue: function renderOwnerRiskQueueFallback() {
          return '';
        },
      };

  function isOwnerIdentitySupportNotification(row) {
    return trimText(row && ((row.data && row.data.eventType) || row.kind), 160).toLowerCase() === 'platform.player.identity.support';
  }

  function resolveOwnerSupportActionTarget(actionKey, tenantId) {
    const normalizedKey = trimText(actionKey, 160);
    const tenantHref = ownerTenantHref(tenantId);
    switch (normalizedKey) {
      case 'review-player-identity':
        return { href: '#owner-tenant-support-identity-live', label: 'Open identity context' };
      case 'inspect-dead-letters':
      case 'reconcile-delivery':
        return { href: '#owner-tenant-support-dead-letters-live', label: 'Open delivery issues' };
      case 'clear-alerts':
        return { href: '#owner-tenant-support-alerts-live', label: 'Open alerts' };
      case 'review-request-errors':
        return { href: '#owner-tenant-support-request-errors-live', label: 'Open request errors' };
      case 'review-runtime':
        return { href: '#owner-tenant-support-runtime-live', label: 'Open runtime context' };
      case 'review-commercial-gate':
        return { href: '#owner-tenant-support-commercial-live', label: 'Open commercial context' };
      case 'confirm-integrations':
        return { href: tenantHref, label: 'Open customer detail' };
      default:
        return null;
    }
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
    const paymentAttempts = Array.isArray(state.billingPaymentAttempts) ? state.billingPaymentAttempts : [];
    return tenants.map((tenant) => {
      const tenantId = trimText(tenant && tenant.id, 160);
      const subscription = subscriptions.get(tenantId) || null;
      const packageId = extractPackageId(subscription, packageCatalog);
      const quota = summarizeQuota(quotaLookup.get(tenantId));
      const tenantInvoices = invoices.filter((row) => trimText(row && row.tenantId, 160) === tenantId);
      const tenantPaymentAttempts = paymentAttempts.filter((row) => trimText(row && row.tenantId, 160) === tenantId);
      const latestInvoice = tenantInvoices[0] || null;
      const latestPaymentAttempt = tenantPaymentAttempts[0] || null;
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
        commercial: {
          latestInvoice,
          latestPaymentAttempt,
          invoiceCount: tenantInvoices.length,
          paymentAttemptCount: tenantPaymentAttempts.length,
        },
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
            ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(context.tenantId)}" data-invoice-id="${escapeHtml(context.invoiceId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-currency="${escapeHtml(context.currency)}">เปิดลิงก์ชำระเงินใหม่</button>`
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
            `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="paid">บันทึกว่าชำระแล้ว</button>`,
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
          label: 'ติดตามผลการคืนเงิน',
          title: tenantNameFor(tenantId),
          detail: `ใบแจ้งหนี้ ${baseDetail} ถูกคืนเงินแล้ว โปรดตรวจสอบว่าควรรักษาการสมัครใช้งานไว้หรือเปิดคืนสถานะใหม่`,
          actions: context.subscriptionId
            ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(context.tenantId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-currency="${escapeHtml(context.currency)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-external-ref="${escapeHtml(context.externalRef)}">เปิดการสมัครใช้งานอีกครั้ง</button>`
            : '',
        });
        return;
      }
      pushItem({
        key: `invoice-${invoiceId}`,
        weight: status === 'past_due' ? 300 : 240,
        tone: status === 'past_due' ? 'danger' : 'warning',
        label: status === 'past_due' ? 'ใบแจ้งหนี้ค้างชำระ' : 'ใบแจ้งหนี้ที่ยังเปิดอยู่',
        title: tenantNameFor(tenantId),
        detail: `ใบแจ้งหนี้ ${baseDetail} ยังรอการเรียกเก็บเงิน`,
        actions: [
          `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="paid">บันทึกว่าชำระแล้ว</button>`,
          `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(context.tenantId)}" data-invoice-id="${escapeHtml(context.invoiceId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-currency="${escapeHtml(context.currency)}">เปิดลิงก์ชำระเงินใหม่</button>`,
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
        label: status === 'past_due' ? 'การสมัครใช้งานเสี่ยงสะดุด' : 'กู้คืนการสมัครใช้งาน',
        title: firstNonEmpty([row && row.tenant && (row.tenant.name || row.tenant.slug), row && row.tenantId], '-'),
        detail: `การสมัครใช้งาน ${subscriptionId} อยู่ในสถานะ${formatOwnerDisplayValue(status)} แผน ${firstNonEmpty([subscription && subscription.planId, row && row.packageId], '-')}`,
        actions: `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(trimText(row && row.tenantId, 160))}" data-subscription-id="${escapeHtml(subscriptionId)}" data-plan-id="${escapeHtml(trimText(subscription && subscription.planId, 120))}" data-package-id="${escapeHtml(trimText(row && row.packageId || subscription && subscription.packageId, 120))}" data-billing-cycle="${escapeHtml(trimText(subscription && subscription.billingCycle, 40) || 'monthly')}" data-currency="${escapeHtml(trimText(subscription && subscription.currency, 12) || 'THB')}" data-amount-cents="${escapeHtml(String(Number(subscription && subscription.amountCents) || 0))}" data-external-ref="${escapeHtml(trimText(subscription && subscription.externalRef, 200))}">เปิดการสมัครใช้งานอีกครั้ง</button>`,
      });
    });

    return queue
      .sort((left, right) => (Number(right && right.weight) || 0) - (Number(left && left.weight) || 0))
      .slice(0, 6);
  }

  function buildTenantCommercialActionContext(tenantRow) {
    const commercial = tenantRow && tenantRow.commercial && typeof tenantRow.commercial === 'object'
      ? tenantRow.commercial
      : {};
    const invoice = commercial.latestInvoice && typeof commercial.latestInvoice === 'object'
      ? commercial.latestInvoice
      : null;
    const paymentAttempt = commercial.latestPaymentAttempt && typeof commercial.latestPaymentAttempt === 'object'
      ? commercial.latestPaymentAttempt
      : null;
    const subscription = tenantRow && tenantRow.subscription && typeof tenantRow.subscription === 'object'
      ? tenantRow.subscription
      : {};
    const invoiceMetadata = parseObject(invoice && (invoice.metadata || invoice.metadataJson || invoice.meta));
    return {
      tenantId: trimText(tenantRow && tenantRow.tenantId, 160),
      invoiceId: trimText(invoice && invoice.id, 160),
      paymentAttemptId: trimText(paymentAttempt && paymentAttempt.id, 160),
      subscriptionId: trimText(invoice && invoice.subscriptionId, 160) || trimText(subscription && subscription.id, 160),
      planId: firstNonEmpty([invoiceMetadata.targetPlanId, invoice && invoice.planId, subscription && subscription.planId], ''),
      packageId: firstNonEmpty([invoiceMetadata.targetPackageId, invoice && invoice.packageId, tenantRow && tenantRow.packageId, subscription && subscription.packageId], ''),
      billingCycle: firstNonEmpty([invoiceMetadata.targetBillingCycle, invoice && invoice.billingCycle, subscription && subscription.billingCycle], 'monthly'),
      amountCents: Number(invoice && invoice.amountCents) || Number(paymentAttempt && paymentAttempt.amountCents) || Number(subscription && subscription.amountCents) || 0,
      currency: trimText(invoice && invoice.currency, 12) || trimText(paymentAttempt && paymentAttempt.currency, 12) || trimText(subscription && subscription.currency, 12) || 'THB',
      externalRef: trimText(subscription && subscription.externalRef, 200),
      invoice,
      paymentAttempt,
      subscription,
      commercial,
    };
  }

  function renderTenantCommercialRecoveryWorkspace(tenantRow, options) {
    if (!tenantRow) return '';
    const settings = options && typeof options === 'object' ? options : {};
    const mode = trimText(settings.mode, 40).toLowerCase();
    const sectionId = mode === 'support'
      ? 'owner-tenant-support-commercial-live'
      : 'owner-tenant-commercial-live';
    const context = buildTenantCommercialActionContext(tenantRow);
    const exportBase = `/owner/api/platform/billing/export?tenantId=${encodeURIComponent(context.tenantId)}`;
    const queue = buildBillingRecoveryQueue(
      [tenantRow],
      context.invoice ? [context.invoice] : [],
      context.paymentAttempt ? [context.paymentAttempt] : [],
    );
    const queueCards = queue.map((item) => [
      `<article class="odvc4-metric-card odv4-tone-${escapeHtml(item && item.tone || 'muted')}">`,
      `<span class="odv4-table-label">${escapeHtml(firstNonEmpty([item && item.label], 'Billing item'))}</span>`,
      `<strong>${escapeHtml(firstNonEmpty([item && item.title], tenantRow && tenantRow.tenant && (tenantRow.tenant.name || tenantRow.tenant.slug) || context.tenantId || '-'))}</strong>`,
      `<p>${escapeHtml(firstNonEmpty([item && item.detail], 'Review the latest billing signal for this tenant.'))}</p>`,
      item && item.actions ? `<div class="odvc4-action-row">${item.actions}</div>` : '',
      '</article>',
    ].join('')).join('');
    const summaryRows = [
      context.invoiceId
        ? `Latest invoice ${context.invoiceId} · ${trimText(context.invoice && context.invoice.status, 40) || '-'} · ${formatCurrencyCents(context.amountCents, context.currency)}`
        : 'ยังไม่มีข้อมูลใบแจ้งหนี้ล่าสุด',
      context.paymentAttemptId
        ? `ความพยายามชำระเงินล่าสุด ${context.paymentAttemptId} · ${trimText(context.paymentAttempt && context.paymentAttempt.status, 40) || '-'}`
        : 'ยังไม่มีข้อมูลความพยายามชำระเงินที่ล้มเหลว',
      `การสมัครใช้งาน ${context.subscriptionId || '-'} · ${trimText(context.subscription && context.subscription.status, 40) || trimText(tenantRow && tenantRow.status, 40) || '-'}`,
    ];
    const ownerActions = [
      context.invoiceId
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(context.tenantId)}" data-invoice-id="${escapeHtml(context.invoiceId)}" data-target-status="paid">บันทึกว่าชำระแล้ว</button>`
        : '',
      context.invoiceId
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-billing-checkout" data-tenant-id="${escapeHtml(context.tenantId)}" data-invoice-id="${escapeHtml(context.invoiceId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-currency="${escapeHtml(context.currency)}">เปิดลิงก์ชำระเงินใหม่</button>`
        : '',
      context.subscriptionId
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(context.tenantId)}" data-subscription-id="${escapeHtml(context.subscriptionId)}" data-plan-id="${escapeHtml(context.planId)}" data-package-id="${escapeHtml(context.packageId)}" data-billing-cycle="${escapeHtml(context.billingCycle)}" data-currency="${escapeHtml(context.currency)}" data-amount-cents="${escapeHtml(String(context.amountCents))}" data-external-ref="${escapeHtml(context.externalRef)}">เปิดการสมัครใช้งานอีกครั้ง</button>`
        : '',
    ].filter(Boolean).join('');
    const html = [
      `<section class="odv4-panel odvc4-panel" id="${escapeHtml(sectionId)}">`,
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การเงิน</span><h2 class="odv4-section-title">พื้นที่ติดตามการกู้คืนรายได้</h2><p class="odv4-section-copy">ใช้คำสั่งด้านการเงินที่มีอยู่ตรงนี้ก่อน แล้วค่อยเปิดประวัติการสมัครใช้งานเชิงลึกเมื่อจำเป็น</p></div>',
      `<div class="odvc4-note-card" id="owner-subscriptions-expiring-note"><strong>ภาพรวมเชิงพาณิชย์</strong><p>${escapeHtml(summaryRows.join(' · '))}</p></div>`,
      ownerActions
        ? `<div class="odvc4-action-row">${ownerActions}</div>`
        : '<div class="odvc4-note-card"><strong>ยังไม่มีคำสั่งด้านการเงินที่ต้องทำทันที</strong><p>ภาพรวมล่าสุดของลูกค้ารายนี้ยังไม่ต้องทำรายการด้านการเงินเพิ่มเติมในตอนนี้</p></div>',
      queueCards
        ? `<div class="odvc4-card-grid">${queueCards}</div>`
        : '',
      `<div class="odvc4-note-card" id="owner-billing-export-actions" data-owner-billing-export-actions><strong>Export billing evidence</strong><p>${escapeHtml(`${formatNumber(context.commercial && context.commercial.invoiceCount, '0')} invoices and ${formatNumber(context.commercial && context.commercial.paymentAttemptCount, '0')} payment attempts are available for export.`)}</p><div class="odvc4-action-row"><a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${exportBase}&format=csv`)}" download>Export CSV</a><a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${exportBase}&format=json`)}" download>Export JSON</a></div></div>`,
      '</section>',
    ].join('');
    return html;
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

  function renderOwnerExportActions(baseUrl, formats = ['csv', 'json']) {
    const normalizedBaseUrl = trimText(baseUrl, 400);
    if (!normalizedBaseUrl) return '';
    return (Array.isArray(formats) ? formats : ['csv', 'json']).map((format) => {
      const normalizedFormat = trimText(format, 20).toLowerCase();
      if (!normalizedFormat) return '';
      const separator = normalizedBaseUrl.includes('?') ? '&' : '?';
      return `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${normalizedBaseUrl}${separator}format=${normalizedFormat}`)}" download>Export ${escapeHtml(normalizedFormat.toUpperCase())}</a>`;
    }).join('');
  }

  function renderAuditExportWorkbench(state) {
    const tenants = Array.isArray(state.tenants) ? state.tenants : [];
    const fallbackTenantId = firstNonEmpty([
      tenants[0] && tenants[0].id,
      tenants[0] && tenants[0].tenantId,
    ], '');
    const requestLogs = parseObject(state.requestLogs);
    const requestItems = Array.isArray(requestLogs.items) ? requestLogs.items : [];
    const requestMetrics = parseObject(requestLogs.metrics);
    const deliveryLifecycle = parseObject(state.deliveryLifecycle);
    const deliveryItems = Array.isArray(deliveryLifecycle.items) ? deliveryLifecycle.items : [];
    const deliverySummary = parseObject(deliveryLifecycle.summary);
    const opsState = parseObject(state.overview && state.overview.opsState);
    const retentionNotes = [
      `${formatNumber(requestItems.length, '0')} failed request samples loaded into this workspace`,
      `${formatNumber(deliveryItems.length, '0')} delivery lifecycle rows are available in the current operator view`,
      Number.isFinite(Number(requestMetrics.windowMs))
        ? `Current request evidence window: ${formatNumber(Math.max(1, Math.round(Number(requestMetrics.windowMs) / 60000)), '0')} minutes`
        : '',
      Number.isFinite(Number(deliverySummary.pendingOverdueMs))
        ? `Delivery overdue threshold: ${formatNumber(Math.max(1, Math.round(Number(deliverySummary.pendingOverdueMs) / 60000)), '0')} minutes`
        : '',
      opsState.lastMonitoringAt
        ? `Last platform monitoring: ${formatDateTime(opsState.lastMonitoringAt)}`
        : '',
    ].filter(Boolean);
    const exportCards = [
      {
        key: 'observability',
        title: 'Observability export',
        detail: 'Export platform-wide request pressure and metrics snapshots for investigations or retention handoff.',
        actions: renderOwnerExportActions('/owner/api/observability/export'),
      },
      {
        key: 'security',
        title: 'Security evidence export',
        detail: 'Download security events and secret rotation checks before owner-side reviews or incident follow-up.',
        actions: `${renderOwnerExportActions('/owner/api/auth/security-events/export')}${renderOwnerExportActions('/owner/api/security/rotation-check/export')}`,
      },
      {
        key: 'notifications',
        title: 'Notification and snapshot export',
        detail: 'Keep a point-in-time copy of owner alerts and the shared runtime snapshot before remediation.',
        actions: `${renderOwnerExportActions('/owner/api/notifications/export')}${renderOwnerExportActions('/owner/api/snapshot/export', ['json'])}`,
      },
      {
        key: 'delivery',
        title: 'Delivery lifecycle export',
        detail: 'Capture the shared delivery queue before replay, cleanup, or package-level customer follow-up.',
        actions: renderOwnerExportActions('/owner/api/delivery/lifecycle/export'),
      },
    ].map((card) => [
      `<article class="odvc4-note-card" data-owner-audit-export-card="${escapeHtml(card.key)}">`,
      `<strong>${escapeHtml(card.title)}</strong>`,
      `<p>${escapeHtml(card.detail)}</p>`,
      `<div class="odvc4-action-row">${card.actions}</div>`,
      '</article>',
    ].join('')).join('');
    const diagnosticsForm = [
      '<form class="odvc4-form" data-owner-form="export-tenant-diagnostics" method="get" action="/owner/api/platform/tenant-diagnostics/export" target="_blank">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'tenantId', label: 'Tenant ID', type: 'text', value: fallbackTenantId, required: true, description: 'Export one tenant diagnostics bundle at a time.' }),
      renderFormField({ name: 'limit', label: 'Row limit', type: 'number', value: '25', description: 'Limit the number of issue rows in the export bundle.' }),
      renderFormField({ name: 'windowMs', label: 'Window (ms)', type: 'number', value: '86400000', description: 'Optional time window for diagnostics evidence.' }),
      renderFormField({ name: 'format', label: 'Format', type: 'select', value: 'json', options: [
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
      ] }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">Export tenant diagnostics</button><span class="odvc4-inline-note">Use this when owner support or platform operations need a tenant-scoped evidence bundle.</span></div>',
      '</form>',
    ].join('');
    const supportCaseForm = [
      '<form class="odvc4-form" data-owner-form="export-tenant-support-case" method="get" action="/owner/api/platform/tenant-support-case/export" target="_blank">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'tenantId', label: 'Tenant ID', type: 'text', value: fallbackTenantId, required: true, description: 'Tenant scope is required for support-case exports.' }),
      renderFormField({ name: 'orderCode', label: 'Order code', type: 'text', value: '', description: 'Optional filter for a specific support order.' }),
      renderFormField({ name: 'playerId', label: 'Player ID', type: 'text', value: '', description: 'Optional filter for one player handoff.' }),
      renderFormField({ name: 'includeAudit', label: 'Include audit trail', type: 'select', value: 'true', options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ] }),
      renderFormField({ name: 'format', label: 'Format', type: 'select', value: 'json', options: [
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
      ] }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">Export support case</button><span class="odvc4-inline-note">Use case export for owner-to-tenant handoff or escalation review.</span></div>',
      '</form>',
    ].join('');
    const deliveryForm = [
      '<form class="odvc4-form" data-owner-form="export-delivery-lifecycle" method="get" action="/owner/api/delivery/lifecycle/export" target="_blank">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'tenantId', label: 'Tenant ID', type: 'text', value: '', description: 'Leave blank to export the shared delivery backlog.' }),
      renderFormField({ name: 'limit', label: 'Row limit', type: 'number', value: '120', description: 'Maximum number of lifecycle rows to export.' }),
      renderFormField({ name: 'pendingOverdueMs', label: 'Pending overdue (ms)', type: 'number', value: '1200000', description: 'Highlight rows that stay pending too long.' }),
      renderFormField({ name: 'format', label: 'Format', type: 'select', value: 'json', options: [
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
      ] }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">Export delivery lifecycle</button><span class="odvc4-inline-note">This form keeps the export scope explicit before operator cleanup or recovery work.</span></div>',
      '</form>',
    ].join('');
    let html = [
      '<section class="odv4-panel odvc4-panel" id="owner-audit-export-console" data-owner-focus-route="audit security export retention">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Export and retention</span><h2 class="odv4-section-title">Owner audit export console</h2><p class="odv4-section-copy">Collect owner-safe evidence bundles, keep tenant exports scoped, and preserve the current audit window before running risky platform actions.</p></div>',
      `<div class="odvc4-card-grid">${exportCards}</div>`,
      `<div class="odvc4-note-card" data-owner-audit-retention-summary><strong>Retention summary</strong><p>${escapeHtml(retentionNotes.join(' · ') || 'No audit retention signals are loaded yet.')}</p></div>`,
      '<div class="odvc4-split-grid">',
      diagnosticsForm,
      supportCaseForm,
      '</div>',
      deliveryForm,
      '</section>',
    ].join('');
    return html;
  }

  function buildOwnerRiskQueueItems(state, tenantRows) {
    return ownerRiskQueueRenderer.buildOwnerRiskQueueItems(state, tenantRows);
    /* Legacy in-file implementation retired after owner-control-risk-v4 split.

    notifications.forEach((row) => {
      const notificationId = trimText(row && row.id, 160);
      const kind = getOwnerNotificationKind(row).toLowerCase();
      const severity = trimText(row && row.severity, 40).toLowerCase();
      const tenantId = getOwnerNotificationTenantId(row);
      const tenantRow = tenantLookup.get(tenantId) || null;
      const data = getOwnerNotificationData(row);
      const tenantLabel = firstNonEmpty([
        tenantRow && tenantRow.tenant && (tenantRow.tenant.name || tenantRow.tenant.slug),
        tenantRow && tenantRow.name,
        tenantRow && tenantRow.slug,
        tenantId,
      ], 'Shared platform');
      const tone = ['critical', 'error', 'danger'].includes(severity)
        ? 'danger'
        : (kind === 'delivery-abuse-suspected' || kind === 'runtime-offline' ? 'danger' : 'warning');
      const detail = firstNonEmpty([
        trimText(row && row.message, 240),
        trimText(row && row.detail, 240),
        Array.isArray(data && data.sample) && data.sample.length > 0
          ? `${trimText(data.sample[0] && data.sample[0].type, 80) || 'sample'}`
          : '',
      ], 'Operator review is required.');
      if (['delivery-abuse-suspected', 'delivery-reconcile-anomaly', 'runtime-offline', 'runtime-degraded', 'agent-runtime-stale', 'agent-version-outdated', 'agent-circuit-open', 'platform-webhook-failed', 'login-failure-spike', 'queue-pressure', 'fail-rate', 'dead-letter-threshold'].includes(kind)) {
        const runtimeAction = ['runtime-offline', 'runtime-degraded', 'agent-runtime-stale', 'agent-version-outdated', 'agent-circuit-open'].includes(kind)
          ? `<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Open runtime health</a>`
          : '';
        pushItem({
          key: `notification-${notificationId || kind}`,
          weight: kind === 'delivery-abuse-suspected' ? 340 : kind === 'runtime-offline' ? 320 : kind === 'delivery-reconcile-anomaly' ? 300 : 240,
          tone,
          label: kind === 'delivery-abuse-suspected' ? 'Abuse signal' : kind === 'delivery-reconcile-anomaly' ? 'Delivery anomaly' : 'Platform risk',
          title: `${tenantLabel} · ${firstNonEmpty([trimText(row && row.title, 160), trimText(kind, 80)], 'Notification')}`,
          detail,
          actions: `${buildTenantLinks(tenantId, notificationId)}${runtimeAction}`,
        });
      }
    });

    securityEvents.forEach((row) => {
      const type = trimText(row && row.type, 160);
      const severity = trimText(row && row.severity, 40).toLowerCase();
      if (!type || !/(fail|anomaly|mismatch|revoked|denied|blocked|expired|step_up|rate)/i.test(type) && !['warning', 'error', 'critical'].includes(severity)) {
        return;
      }
      pushItem({
        key: `security-${type}-${trimText(row && (row.createdAt || row.at), 80)}`,
        weight: severity === 'error' || severity === 'critical' ? 230 : 180,
        tone: severity === 'error' || severity === 'critical' ? 'danger' : 'warning',
        label: 'Security anomaly',
        title: type,
        detail: firstNonEmpty([
          trimText(row && row.detail, 240),
          trimText(row && row.actor, 120),
          trimText(row && row.targetUser, 120),
        ], 'Review audit evidence and security events.'),
        actions: '<a class="odv4-button odv4-button-secondary" href="/owner/audit">Open audit</a>',
      });
    });

    requestItems.forEach((row) => {
      const statusCode = Number(row && row.statusCode);
      if (!Number.isFinite(statusCode) || statusCode < 500) return;
      pushItem({
        key: `request-${trimText(row && row.method, 40)}-${trimText(row && (row.path || row.routeGroup), 160)}-${trimText(row && (row.at || row.createdAt), 80)}`,
        weight: 170,
        tone: 'danger',
        label: 'Request anomaly',
        title: `${trimText(row && row.method, 40) || 'REQ'} ${trimText(row && (row.path || row.routeGroup), 160) || '/'}`,
        detail: `Status ${trimText(row && row.statusCode, 20) || '-'} at ${formatDateTime(row && (row.at || row.createdAt))}`,
        actions: '<a class="odv4-button odv4-button-secondary" href="/owner/audit">Inspect request evidence</a>',
      });
    });

    if (
      Number(deliverySummary.overdueCount || 0) > 0
      || Number(deliverySummary.poisonCandidateCount || 0) > 0
      || Number(deliverySummary.nonRetryableDeadLetters || 0) > 0
      || deliveryRuntime.workerStarted === false
    ) {
      const actionKeys = Array.isArray(deliveryActionPlan.actions)
        ? deliveryActionPlan.actions.map((row) => trimText(row && row.key, 80)).filter(Boolean)
        : [];
      pushItem({
        key: 'delivery-lifecycle-risk',
        weight: 260,
        tone: Number(deliverySummary.poisonCandidateCount || 0) > 0 || deliveryRuntime.workerStarted === false ? 'danger' : 'warning',
        label: 'Delivery lifecycle risk',
        title: 'Shared delivery backlog',
        detail: [
          `overdue ${formatNumber(deliverySummary.overdueCount || 0, '0')}`,
          `poison ${formatNumber(deliverySummary.poisonCandidateCount || 0, '0')}`,
          `dead letters ${formatNumber(deliverySummary.nonRetryableDeadLetters || 0, '0')}`,
          actionKeys.length ? `actions ${actionKeys.join(', ')}` : '',
        ].filter(Boolean).join(' · '),
        actions: '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Open runtime health</a><a class="odv4-button odv4-button-secondary" href="/owner/audit">Open audit</a>',
      });
    }

    return queue
      .sort((left, right) => (Number(right && right.weight) || 0) - (Number(left && left.weight) || 0))
      .slice(0, 8);
    */
  }

  function renderOwnerRiskQueue(state, tenantRows) {
    return ownerRiskQueueRenderer.renderOwnerRiskQueue(state, tenantRows);
    /* Legacy in-file implementation retired after owner-control-risk-v4 split.
    const items = buildOwnerRiskQueueItems(state, tenantRows);
    const cards = items.map((item) => [
      `<article class="odvc4-note-card" data-owner-risk-item="${escapeHtml(item.key)}">`,
      `<div class="odvc4-action-row"><span class="odv4-pill odv4-pill-${escapeHtml(item.tone || 'warning')}">${escapeHtml(item.label || 'Risk item')}</span></div>`,
      `<strong>${escapeHtml(item.title || '-')}</strong>`,
      `<p>${escapeHtml(item.detail || '-')}</p>`,
      item.actions ? `<div class="odvc4-inline-actions">${item.actions}</div>` : '',
      '</article>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-risk-queue" data-owner-risk-queue="true" data-owner-focus-route="analytics risk abuse">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Risk and abuse</span><h2 class="odv4-section-title">Owner risk queue</h2><p class="odv4-section-copy">Review abuse signals, delivery anomalies, security anomalies, and request failures from one queue before sending work back into tenant operations.</p></div>',
      cards
        ? `<div class="odvc4-card-grid">${cards}</div>`
        : '<div class="odvc4-note-card"><strong>No open risk items</strong><p>No abuse, delivery, security, or request anomalies are waiting in the current owner snapshot.</p></div>',
      '</section>',
    ].join('');
    */
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

  function formatAutomationDecisionLabel(decision) {
    const normalized = trimText(decision, 80).toLowerCase();
    if (normalized === 'restart') return 'ตัวเลือกที่ควรรีสตาร์ต';
    if (normalized === 'skip') return 'ข้ามไว้';
    return normalized || '-';
  }

  function formatAutomationReasonLabel(reason) {
    const normalized = trimText(reason, 240);
    if (!normalized) return '-';
    const reasonMap = {
      'platform-automation-disabled': 'ระบบอัตโนมัติถูกปิดไว้',
      'runtime-not-required': 'รันไทม์นี้ยังไม่จำเป็นต้องจัดการ',
      'self-restart-disabled': 'ปิดการรีสตาร์ตตัวเองไว้',
      'service-not-enabled-for-automation': 'บริการนี้ยังไม่เปิดให้ระบบอัตโนมัติจัดการ',
      'restart-cooldown-active': 'อยู่ในช่วงคูลดาวน์การรีสตาร์ต',
      'max-restart-attempts-reached': 'ถึงจำนวนครั้งรีสตาร์ตสูงสุดแล้ว',
      'runtime-offline': 'รันไทม์ออฟไลน์อยู่',
      'console-agent-degraded': 'เอเจนต์คอนโซลเริ่มเสื่อมสภาพ',
      'cycle-action-budget-exhausted': 'ใช้โควตาการทำงานของรอบนี้หมดแล้ว',
    };
    return reasonMap[normalized] || normalized;
  }

  function buildAutomationRecoveryRows(automationState) {
    const recoveryMap = automationState && typeof automationState.lastRecoveryResultByKey === 'object'
      ? automationState.lastRecoveryResultByKey
      : {};
    return Object.entries(recoveryMap)
      .map(([serviceKey, result]) => {
        const entry = result && typeof result === 'object' ? result : {};
        return {
          serviceKey,
          at: trimText(entry.at, 80),
          ok: entry.ok === true,
          action: trimText(entry.action, 120) || 'restart-managed-service',
          runtimeKey: trimText(entry.runtimeKey, 120) || serviceKey,
          status: trimText(entry.status, 80) || '-',
          reason: trimText(entry.reason, 240) || '-',
          exitCode: Number.isFinite(Number(entry.exitCode)) ? Math.trunc(Number(entry.exitCode)) : null,
        };
      })
      .sort((left, right) => String(right.at || '').localeCompare(String(left.at || '')));
  }

  function renderAutomationRecoveryTable(rows) {
    const body = (Array.isArray(rows) ? rows : []).map((row) => [
      '<tr>',
      `<td><strong>${escapeHtml(row.serviceKey || '-')}</strong><div class="odvc4-table-note">${escapeHtml(row.runtimeKey || '-')}</div></td>`,
      `<td><span class="odv4-pill odv4-pill-${row.ok ? 'success' : 'danger'}">${escapeHtml(row.ok ? 'Succeeded' : 'Failed')}</span><div class="odvc4-table-note">${escapeHtml(row.action || '-')}</div></td>`,
      `<td>${escapeHtml(row.status || '-')}<div class="odvc4-table-note">${escapeHtml(formatAutomationReasonLabel(row.reason))}</div></td>`,
      `<td>${escapeHtml(row.at ? formatDateTime(row.at) : '-')}<div class="odvc4-table-note">${escapeHtml(row.exitCode == null ? 'exit -' : `exit ${row.exitCode}`)}</div></td>`,
      '</tr>',
    ].join('')).join('');
    return body || '<tr><td colspan="4">No recovery history recorded yet.</td></tr>';
  }

  function renderAutomationPreview(preview) {
    if (!preview || typeof preview !== 'object') {
      return '<div class="odvc4-note-card" data-owner-automation-preview-empty><strong>No manual automation report</strong><p>Run a dry-run preview to inspect candidates before forcing a live cycle.</p></div>';
    }
    const evaluated = Array.isArray(preview.evaluated) ? preview.evaluated : [];
    const actions = Array.isArray(preview.actions) ? preview.actions : [];
    const runtimeSupervisor = preview.runtimeSupervisor && typeof preview.runtimeSupervisor === 'object'
      ? preview.runtimeSupervisor
      : {};
    const runtimeCounts = runtimeSupervisor.counts && typeof runtimeSupervisor.counts === 'object'
      ? runtimeSupervisor.counts
      : {};
    const actionRows = actions.map((row) => [
      '<tr>',
      `<td><strong>${escapeHtml(row.runtimeLabel || row.runtimeKey || row.serviceKey || '-')}</strong><div class="odvc4-table-note">${escapeHtml(row.serviceKey || '-')}</div></td>`,
      `<td>${escapeHtml(row.status || '-')}</td>`,
      `<td>${escapeHtml(formatAutomationReasonLabel(row.reason))}</td>`,
      `<td><span class="odv4-pill odv4-pill-${row.ok === true ? 'success' : 'warning'}">${escapeHtml(row.dryRun ? 'Dry run' : row.ok === true ? 'Executed' : 'Failed')}</span></td>`,
      '</tr>',
    ].join('')).join('');
    const decisionRows = evaluated.slice(0, 12).map((row) => [
      '<tr>',
      `<td><strong>${escapeHtml(row.runtimeLabel || row.runtimeKey || '-')}</strong><div class="odvc4-table-note">${escapeHtml(row.serviceKey || '-')}</div></td>`,
      `<td>${escapeHtml(formatAutomationDecisionLabel(row.decision))}</td>`,
      `<td>${escapeHtml(formatAutomationReasonLabel(row.reason))}</td>`,
      '</tr>',
    ].join('')).join('');
    return [
      '<section class="odv4-panel odvc4-panel" id="owner-settings-automation-preview" data-owner-automation-preview>',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Manual report</span><h2 class="odv4-section-title">Latest automation report</h2><p class="odv4-section-copy">This report is kept in local owner UI state so operators can compare dry-run output with the persisted shared automation state.</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'Mode', value: preview.dryRun ? 'Dry run' : 'Live run', detail: preview.generatedAt ? formatDateTime(preview.generatedAt) : 'No timestamp', tone: preview.dryRun ? 'info' : 'warning' },
        { label: 'Evaluated', value: formatNumber(evaluated.length, '0'), detail: `Supervisor ${firstNonEmpty([runtimeSupervisor.overall, 'unknown'])}`, tone: 'info' },
        { label: 'Actions', value: formatNumber(actions.length, '0'), detail: preview.skipped ? formatAutomationReasonLabel(preview.reason) : 'Candidates promoted into this report', tone: actions.length ? 'warning' : 'success' },
        { label: 'Online runtimes', value: formatNumber(runtimeCounts.online || 0, '0'), detail: `Offline ${formatNumber(runtimeCounts.offline || 0, '0')} / degraded ${formatNumber(runtimeCounts.degraded || 0, '0')}`, tone: 'info' },
      ])}</div>`,
      `<div class="odvc4-note-card"><strong>Automation config</strong><p>Enabled: ${escapeHtml(preview.automationConfig && preview.automationConfig.enabled === false ? 'No' : 'Yes')} · Max actions/cycle: ${escapeHtml(formatNumber(preview.automationConfig && preview.automationConfig.maxActionsPerCycle || 0, '0'))} · Max attempts/runtime: ${escapeHtml(formatNumber(preview.automationConfig && preview.automationConfig.maxAttemptsPerRuntime || 0, '0'))}</p></div>`,
      '<div class="odvc4-table-wrap"><table class="odvc4-table" data-owner-automation-actions><thead><tr><th>Runtime</th><th>Status</th><th>Reason</th><th>Outcome</th></tr></thead><tbody>',
      actionRows || '<tr><td colspan="4">No actions were produced by the latest report.</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table" data-owner-automation-decisions><thead><tr><th>Runtime</th><th>Decision</th><th>Reason</th></tr></thead><tbody>',
      decisionRows || '<tr><td colspan="3">No runtime evaluations were recorded in the latest report.</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function buildOwnerControlV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : {};
    const sectionHtml = Array.isArray(safeModel.sections) ? safeModel.sections.join('') : '';
    if (!sectionHtml) return '';
    const polishedSectionHtml = repairMojibakeText(sectionHtml).replaceAll(' · ', ' / ');
    return [
      `<section id="owner-control-workspace" class="odvc4-stack" data-owner-control-page="${escapeHtml(safeModel.routeKind || 'overview')}" data-owner-primary-label="${escapeHtml(safeModel.headerAction && safeModel.headerAction.label || '')}" data-owner-primary-href="${escapeHtml(safeModel.headerAction && safeModel.headerAction.href || '')}" data-owner-primary-local-focus="${safeModel.headerAction && safeModel.headerAction.localFocus ? '1' : '0'}">`,
      polishedSectionHtml,
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
        { label: 'Expiring soon', value: formatNumber(expiringRows.length, '0'), detail: 'การสมัครใช้งานที่ใกล้ต่ออายุภายใน 14 วัน', tone: expiringRows.length ? 'warning' : 'muted' },
        { label: 'บริการที่ออนไลน์', value: formatNumber(onlineRuntimeCount, '0'), detail: 'บอตส่งของและบอตเซิร์ฟเวอร์ที่ออนไลน์อยู่จริง', tone: onlineRuntimeCount ? 'success' : 'warning' },
        { label: 'Disputed invoices', value: formatNumber(invoiceSummary.disputedInvoiceCount, '0'), detail: 'Invoices waiting for billing review', tone: invoiceSummary.disputedInvoiceCount ? 'danger' : 'success' },
        { label: 'Refunded invoices', value: formatNumber(invoiceSummary.refundedInvoiceCount, '0'), detail: 'Invoices already refunded', tone: invoiceSummary.refundedInvoiceCount ? 'warning' : 'muted' },
      ])}</div>`,
      '<div class="odvc4-action-row">',
    '<a class="odv4-button odv4-button-primary" href="/owner/tenants">สร้างลูกค้า</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/subscriptions">ดูลูกค้าที่ใกล้ต่ออายุ</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">เปิดทะเบียนบริการ</a>',
      '</div>',
      `<div class="odvc4-note-card"><strong>สัญญาณการปฏิบัติการ</strong><p>งานที่ล้มเหลว: ${escapeHtml(formatNumber(deliveryAnalytics.failedJobs || 0, '0'))} · คิวงานค้าง: ${escapeHtml(formatNumber(deliveryAnalytics.queueDepth || 0, '0'))} · ใบแจ้งหนี้ที่ยังไม่ปิด: ${escapeHtml(formatNumber(invoiceSummary.openInvoiceCount, '0'))}</p></div>`,
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
    const identity = bundle && bundle.identity && typeof bundle.identity === 'object'
      ? bundle.identity
      : diagnostics && diagnostics.identity && typeof diagnostics.identity === 'object'
        ? diagnostics.identity
        : { total: 0, linked: 0, missingSteam: 0, inactive: 0, needsSupport: 0, items: [] };
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
      renderTenantCommercialRecoveryWorkspace(tenantRow),
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
    const identity = bundle && bundle.identity && typeof bundle.identity === 'object'
      ? bundle.identity
      : diagnostics && diagnostics.identity && typeof diagnostics.identity === 'object'
        ? diagnostics.identity
        : { total: 0, linked: 0, missingSteam: 0, inactive: 0, needsSupport: 0, items: [] };
    const exportBase = `/admin/api/platform/tenant-support-case/export?tenantId=${encodeURIComponent(tenantRow.tenantId)}`;
    const tenantRuntimeRows = buildTenantRuntimeRows(runtimeRows, tenantRow.tenantId);
    const rawNotificationItems = Array.isArray(diagnostics.notifications)
      ? diagnostics.notifications
      : Array.isArray(bundle && bundle.notifications)
        ? bundle.notifications
        : [];
    const notificationItems = rawNotificationItems.filter((row) => !isOwnerIdentitySupportNotification(row));
    const requestErrorItems = Array.isArray(diagnostics.requestErrors && diagnostics.requestErrors.items)
      ? diagnostics.requestErrors.items
      : [];
    const supportDeadLetters = Array.isArray(deadLetters)
      ? deadLetters
      : [];
    const identityItems = Array.isArray(identity.items)
      ? identity.items
      : [];
    const identityTrailItems = Array.isArray(identity.trail)
      ? identity.trail
      : [];
    const identityLead = identityItems.find((row) => firstNonEmpty([row && row.status], '') !== 'linked') || identityItems[0] || null;
    const identityTrailLead = identityTrailItems[0] || null;
    const identityFocusLead = identityTrailLead || identityLead || null;
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
    const identityRows = identityItems.map((row) => {
      const userId = firstNonEmpty([row && row.discordId], '');
      const identityAction = deriveOwnerIdentityAction(row);
      const identityActionLabel = deriveOwnerIdentityActionLabel(identityAction);
      const identityHref = buildTenantPlayerIdentityHref(tenantRow.tenantId, {
        userId,
        identityAction,
        supportReason: firstNonEmpty([row && row.detail], ''),
        supportSource: 'owner',
      });
      const ordersHref = userId
        ? `/tenant/orders?tenantId=${encodeURIComponent(tenantRow.tenantId)}&userId=${encodeURIComponent(userId)}`
        : '/tenant/orders';
      return [
        '<tr>',
        `<td><strong>${escapeHtml(firstNonEmpty([row && row.displayName], 'player'))}</strong><div class="odvc4-table-note">${escapeHtml(firstNonEmpty([row && row.detail], '-'))}</div></td>`,
        `<td>${escapeHtml(firstNonEmpty([row && row.discordId], '-'))}</td>`,
        `<td>${escapeHtml(firstNonEmpty([row && row.steamId], '-'))}</td>`,
        `<td>${escapeHtml(firstNonEmpty([row && row.status], '-'))}</td>`,
        `<td>${escapeHtml(firstNonEmpty([row && row.updatedAt ? formatDateTime(row.updatedAt) : '', '-']))}</td>`,
        `<td><div class="odvc4-inline-actions"><a class="odv4-button odv4-button-primary" href="${escapeHtml(identityHref)}">${escapeHtml(identityActionLabel)}</a><a class="odv4-button odv4-button-secondary" href="${escapeHtml(ordersHref)}">Open orders</a></div></td>`,
        '</tr>',
      ].join('');
    }).join('');
    const identityTrailRows = identityTrailItems.map((row) => {
      const userId = firstNonEmpty([row && row.userId], '');
      const nextAction = deriveOwnerIdentityTrailAction(row);
      const notificationId = trimText(row && row.notificationId, 160);
      const acknowledged = row && (row.acknowledged === true || trimText(row && row.acknowledgedAt, 80));
      const supportIntent = firstNonEmpty([row && row.supportIntent], 'review');
      const supportOutcome = firstNonEmpty([row && row.supportOutcome], 'reviewing');
      const supportReason = firstNonEmpty([row && row.supportReason], '');
      const displayName = firstNonEmpty([row && row.displayName], 'player');
      const allowOwnerFollowupAction = Boolean(userId) && trimText(supportOutcome, 80).toLowerCase() !== 'resolved';
      const identityHref = buildTenantPlayerIdentityHref(tenantRow.tenantId, {
        userId,
        identityAction: nextAction,
        supportReason,
        supportSource: 'owner',
        supportOutcome,
      });
      const ownerFollowupActionAttrs = [
        `data-tenant-id="${escapeHtml(tenantRow.tenantId)}"`,
        `data-user-id="${escapeHtml(userId)}"`,
        `data-player-label="${escapeHtml(displayName)}"`,
        `data-steam-id="${escapeHtml(firstNonEmpty([row && row.steamId], ''))}"`,
        `data-support-intent="${escapeHtml(supportIntent)}"`,
        `data-support-outcome="${escapeHtml(supportOutcome)}"`,
        `data-support-reason="${escapeHtml(supportReason)}"`,
        `data-followup-action="${escapeHtml(nextAction)}"`,
        `data-notification-id="${escapeHtml(notificationId)}"`,
        `data-acknowledged="${acknowledged ? '1' : '0'}"`,
        `data-return-route="${escapeHtml(ownerSupportHref(tenantRow.tenantId))}"`,
      ].join(' ');
      return [
        '<tr>',
        `<td><strong>${escapeHtml(displayName)}</strong><div class="odvc4-table-note">${escapeHtml(supportReason || '-')}</div></td>`,
        `<td>${escapeHtml(deriveOwnerIdentityActionLabel(supportIntent))}</td>`,
        `<td>${escapeHtml(formatOwnerIdentitySupportOutcome(supportOutcome))}</td>`,
        `<td>${escapeHtml(deriveOwnerIdentityActionLabel(nextAction))}</td>`,
        `<td>${escapeHtml(firstNonEmpty([row && row.supportSource], '-'))}<div class="odvc4-table-note">${escapeHtml(firstNonEmpty([row && row.createdAt ? formatDateTime(row.createdAt) : '', '-']))}</div><div class="odvc4-table-note">${escapeHtml(acknowledged ? `Acknowledged ${firstNonEmpty([row && row.acknowledgedAt ? formatDateTime(row.acknowledgedAt) : '', ''])}`.trim() : 'Follow-up open')}</div></td>`,
        `<td><div class="odvc4-inline-actions"><a class="odv4-button odv4-button-primary" href="${escapeHtml(identityHref)}">${escapeHtml(deriveOwnerIdentityActionLabel(nextAction))}</a>${userId ? `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(`/tenant/orders?tenantId=${encodeURIComponent(tenantRow.tenantId)}&userId=${encodeURIComponent(userId)}`)}">Open orders</a>` : ''}${allowOwnerFollowupAction ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="resolve-identity-followup" ${ownerFollowupActionAttrs}>Resolve follow-up</button><button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reassign-identity-followup" ${ownerFollowupActionAttrs}>Reassign to tenant</button>` : ''}${!acknowledged && notificationId ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="acknowledge-notification" data-notification-id="${escapeHtml(notificationId)}" data-return-route="${escapeHtml(ownerSupportHref(tenantRow.tenantId))}">Acknowledge follow-up</button>` : acknowledged ? '<span class="odv4-pill odv4-pill-muted">Follow-up acknowledged</span>' : ''}</div></td>`,
        '</tr>',
      ].join('');
    }).join('');

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
        {
          label: 'Identity gaps',
          value: formatNumber(identity.needsSupport, '0'),
          detail: `${formatNumber(identity.linked, '0')} linked · ${formatNumber(identity.missingSteam, '0')} missing Steam`,
          tone: identity.needsSupport > 0 ? 'warning' : 'success',
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
      renderTenantCommercialRecoveryWorkspace(tenantRow, { mode: 'support' }),
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-actions-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">งานดูแลที่ควรเริ่มก่อน</h2><p class="odv4-section-copy">เริ่มจากงานที่ระบบสรุปจากชุดข้อมูลช่วยเหลือก่อน แล้วค่อยลงลึกไปหน้า runtime หรือการเงินเมื่อจำเป็น</p></div>',
      `<div class="odvc4-card-grid">${supportActionCards || '<div class="odvc4-note-card"><strong>ยังไม่มีงานที่ต้องทำทันที</strong><p>ชุดข้อมูลช่วยเหลือปัจจุบันยังไม่มีงานติดตามที่ต้องทำทันที</p></div>'}</div>`,
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-tenant-support-identity-live">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Identity</span><h2 class="odv4-section-title">Player identity and support context</h2><p class="odv4-section-copy">Keep Steam linking posture and player account recovery evidence beside delivery and billing tools so support does not lose context during escalations.</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        {
          label: 'Players known',
          value: formatNumber(identity.total, '0'),
          detail: 'Player accounts visible for this tenant support case',
          tone: 'info',
        },
        {
          label: 'Steam linked',
          value: formatNumber(identity.linked, '0'),
          detail: 'Accounts ready for Steam-linked delivery follow-up',
          tone: 'success',
        },
        {
          label: 'Missing Steam',
          value: formatNumber(identity.missingSteam, '0'),
          detail: 'Accounts that still need Steam linking help',
          tone: identity.missingSteam > 0 ? 'warning' : 'success',
        },
        {
          label: 'Inactive players',
          value: formatNumber(identity.inactive, '0'),
          detail: 'Accounts that may need review before support closes the case',
          tone: identity.inactive > 0 ? 'warning' : 'muted',
        },
        {
          label: 'Support trail',
          value: formatNumber(identity.trailTotal, Array.isArray(identityTrailItems) ? identityTrailItems.length : '0'),
          detail: 'Recent identity review and relink events recorded for this tenant',
          tone: identityTrailItems.length > 0 ? 'info' : 'muted',
        },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      `<a class="odv4-button odv4-button-primary" href="${escapeHtml(ownerTenantHref(tenantRow.tenantId))}">Open tenant detail</a>`,
      identityFocusLead
        ? `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(buildTenantPlayerIdentityHref(tenantRow.tenantId, {
          userId: firstNonEmpty([identityFocusLead && (identityFocusLead.userId || identityFocusLead.discordId)], ''),
          identityAction: identityFocusLead && identityFocusLead.userId
            ? deriveOwnerIdentityTrailAction(identityFocusLead)
            : deriveOwnerIdentityAction(identityFocusLead),
          supportReason: firstNonEmpty([identityFocusLead && (identityFocusLead.supportReason || identityFocusLead.detail)], ''),
          supportSource: 'owner',
          supportOutcome: firstNonEmpty([identityFocusLead && identityFocusLead.supportOutcome], ''),
        }))}">Continue identity workflow</a>`
        : '',
      '<a class="odv4-button odv4-button-secondary" href="/owner/tenants">Open tenant list</a>',
      '</div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table" id="owner-tenant-support-identity-trail-live"><thead><tr><th>Player</th><th>Current step</th><th>Outcome</th><th>Next step</th><th>Source</th><th>Action</th></tr></thead><tbody>',
      identityTrailRows || '<tr><td colspan="6">No identity support trail has been recorded for this tenant yet.</td></tr>',
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Player</th><th>Discord</th><th>Steam</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>',
      identityRows || '<tr><td colspan="6">No player identity context is available for this tenant yet.</td></tr>',
      '</tbody></table></div>',
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

  function renderPackagesWorkspaceLegacy(packageUsageRows, featureCatalog) {
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
    let html = [
      '<section class="odv4-panel odvc4-panel" id="owner-packages-workspace" data-owner-focus-route="packages catalog">',
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

  function buildOwnerRuntimeRoutePresentation(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    const focusRoutes = 'runtime runtime-health runtime-create-server runtime-provision-runtime incidents jobs support agents-bots fleet-diagnostics';
    if (route === 'runtime-create-server') {
      return {
        focusRoutes,
        kicker: 'Create server record',
        title: 'Register the server before runtime bind',
        copy: 'Create the control-plane server record on its own page, then move to Provision runtime once you have the server ID.',
      };
    }
    if (route === 'runtime-provision-runtime') {
      return {
        focusRoutes,
        kicker: 'Provision runtime',
        title: 'Issue a one-time setup token',
        copy: 'Provision Delivery Agent and Server Bot runtimes from a dedicated page so role separation stays clear during activation.',
      };
    }
    if (route === 'jobs') {
      return {
        focusRoutes,
        kicker: 'Shared operations',
        title: 'Restart and recovery controls',
        copy: 'Keep shared service restart, automation, and recovery work on its own page instead of mixing it with provisioning or registry review.',
      };
    }
    if (route === 'incidents') {
      return {
        focusRoutes,
        kicker: 'Incidents',
        title: 'Runtime incident recovery',
        copy: 'Keep runtime provisioning, restart controls, and shared recovery actions in one place while you work through owner-facing incidents.',
      };
    }
    if (route === 'support') {
      return {
        focusRoutes,
        kicker: 'Support escalation',
        title: 'Owner support and runtime recovery',
        copy: 'When a case escalates to Owner, issue a fresh setup token, restart shared services, and jump to recovery or audit without leaving the page.',
      };
    }
    if (route === 'agents-bots') {
      return {
        focusRoutes,
        kicker: 'Agents and bots',
        title: 'Delivery Agent and Server Bot registry',
        copy: 'Inspect Delivery Agent and Server Bot bindings on their own page after provisioning is already complete.',
      };
    }
    if (route === 'fleet-diagnostics') {
      return {
        focusRoutes,
        kicker: 'Fleet diagnostics',
        title: 'Fleet diagnostics and recovery',
        copy: 'Use the same owner workspace to inspect runtime health, restart shared services, and prepare recovery actions when the fleet is degraded.',
      };
    }
    return {
      focusRoutes,
      kicker: 'Service overview',
      title: 'Runtime service overview',
      copy: 'Review Delivery Agent and Server Bot posture on a clean overview page, then jump into create-server or provision-only subpages when you need to mutate state.',
    };
  }

  function resolveOwnerRuntimeWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'runtime-create-server') return 'create-server';
    if (route === 'runtime-provision-runtime') return 'provision';
    if (route === 'agents-bots') return 'inventory';
    if (route === 'fleet-diagnostics') return 'diagnostics';
    if (route === 'incidents') return 'incidents';
    if (route === 'jobs') return 'jobs';
    if (route === 'support') return 'support';
    return 'overview';
  }

  function resolveOwnerAuditWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'security') return 'security';
    if (route === 'access') return 'access';
    if (route === 'diagnostics') return 'diagnostics';
    return 'audit';
  }

  function resolveOwnerBillingWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'subscriptions-registry' || route === 'subscription-detail') return 'registry';
    if (route === 'billing-recovery') return 'recovery';
    if (route === 'billing-attempts' || route === 'attempt-detail') return 'attempts';
    if (route === 'billing' || route === 'invoice-detail') return 'billing';
    return 'subscriptions';
  }

  function resolveOwnerPackagesWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'packages-create') return 'create';
    if (route === 'packages-entitlements') return 'entitlements';
    return 'catalog';
  }

  function resolveOwnerAnalyticsWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'analytics-risk') return 'risk';
    if (route === 'analytics-packages') return 'packages';
    return 'overview';
  }

  function resolveOwnerRecoveryWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'recovery-create') return 'create';
    if (route === 'recovery-preview') return 'preview';
    if (route === 'recovery-restore') return 'restore';
    if (route === 'recovery-history') return 'history';
    return 'overview';
  }

  function resolveOwnerSettingsWorkspaceMode(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (route === 'control') return 'control';
    if (route === 'automation') return 'automation';
    if (route === 'settings-admin-users') return 'admin-users';
    if (route === 'settings-services') return 'services';
    if (route === 'settings-access-policy') return 'access-policy';
    if (route === 'settings-portal-policy') return 'portal-policy';
    if (route === 'settings-billing-policy') return 'billing-policy';
    if (route === 'settings-runtime-policy') return 'runtime-policy';
    return 'settings';
  }

  function selectRuntimeRowsForWorkspace(runtimeRows, workspaceMode) {
    const rows = Array.isArray(runtimeRows) ? runtimeRows : [];
    if (workspaceMode === 'diagnostics' || workspaceMode === 'incidents' || workspaceMode === 'support') {
      const attentionRows = rows.filter((row) => row.statusTone !== 'success' || row.status === 'pending_activation');
      return attentionRows.length ? attentionRows : rows;
    }
    return rows;
  }

  function renderOwnerRuntimeRouteSummary(state, runtimeRows, workspaceMode) {
    const rows = Array.isArray(runtimeRows) ? runtimeRows : [];
    const deliveryRows = rows.filter((row) => row.runtimeKind === 'delivery-agents');
    const serverRows = rows.filter((row) => row.runtimeKind === 'server-bots');
    const offlineRows = rows.filter((row) => row.statusTone === 'danger');
    const warningRows = rows.filter((row) => row.statusTone === 'warning');
    const pendingRows = rows.filter((row) => row.status === 'pending_activation');
    const notifications = Array.isArray(state && state.notifications) ? state.notifications : [];
    const unacknowledgedNotifications = notifications.filter((row) => row && row.acknowledged !== true);
    const requestLogs = parseObject(state && state.requestLogs);
    const requestItems = Array.isArray(requestLogs.items) ? requestLogs.items : [];
    const requestErrors = requestItems.filter((row) => Number(row && row.statusCode) >= 500);
    const deliveryLifecycle = parseObject(state && state.deliveryLifecycle);
    const deliverySummary = parseObject(deliveryLifecycle.summary);

    if (workspaceMode === 'create-server') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Server onboarding</span><h2 class="odv4-section-title">Create the server record first</h2><p class="odv4-section-copy">Separate server registration from runtime token issuance so Owner can confirm the control-plane record before any machine binds.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Tenants ready', value: formatNumber((Array.isArray(state && state.tenants) ? state.tenants.length : 0), '0'), detail: 'Tenants available in the owner registry', tone: 'info' },
          { label: 'Server Bot rows', value: formatNumber(serverRows.length, '0'), detail: 'Existing server-side runtimes already registered', tone: serverRows.length ? 'info' : 'muted' },
          { label: 'Delivery Agent rows', value: formatNumber(deliveryRows.length, '0'), detail: 'Execution runtimes already registered', tone: deliveryRows.length ? 'info' : 'muted' },
          { label: 'Next step', value: 'Provision runtime', detail: 'Move to the next subpage once the server ID exists', tone: 'success' },
        ])}</div>`,
        '<div class="odvc4-note-card"><strong>Suggested flow</strong><p>1) Create server record  2) Open Provision runtime  3) Issue the setup token for the correct role.</p></div>',
        '</section>',
      ].join('');
    }

    if (workspaceMode === 'provision') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Runtime token issue</span><h2 class="odv4-section-title">Provision one runtime role at a time</h2><p class="odv4-section-copy">Issue setup tokens from a dedicated page so Delivery Agent and Server Bot credentials never get mixed with registry or diagnostics work.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Pending activation', value: formatNumber(pendingRows.length, '0'), detail: 'Tokens issued but not bound yet', tone: pendingRows.length ? 'warning' : 'success' },
          { label: 'Delivery Agents', value: formatNumber(deliveryRows.length, '0'), detail: `${formatNumber(deliveryRows.filter((row) => row.statusTone === 'success').length, '0')} online`, tone: deliveryRows.length ? 'info' : 'muted' },
          { label: 'Server Bots', value: formatNumber(serverRows.length, '0'), detail: `${formatNumber(serverRows.filter((row) => row.statusTone === 'success').length, '0')} online`, tone: serverRows.length ? 'info' : 'muted' },
          { label: 'Role split', value: 'Enforced', detail: 'Delivery Agent and Server Bot setup stays separated here', tone: 'success' },
        ])}</div>`,
        '</section>',
      ].join('');
    }

    if (workspaceMode === 'overview') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Service overview</span><h2 class="odv4-section-title">Platform runtime posture</h2><p class="odv4-section-copy">Use this overview page to assess service mix and decide whether you need server registration, runtime provisioning, registry review, or diagnostics next.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Delivery Agents', value: formatNumber(deliveryRows.length, '0'), detail: `${formatNumber(deliveryRows.filter((row) => row.statusTone === 'success').length, '0')} online`, tone: deliveryRows.length ? 'info' : 'muted' },
          { label: 'Server Bots', value: formatNumber(serverRows.length, '0'), detail: `${formatNumber(serverRows.filter((row) => row.statusTone === 'success').length, '0')} online`, tone: serverRows.length ? 'info' : 'muted' },
          { label: 'Pending activation', value: formatNumber(pendingRows.length, '0'), detail: 'Provisioned runtimes waiting for first bind', tone: pendingRows.length ? 'warning' : 'success' },
          { label: 'Needs attention', value: formatNumber(offlineRows.length + warningRows.length, '0'), detail: 'Offline or degraded runtimes in the registry', tone: offlineRows.length ? 'danger' : warningRows.length ? 'warning' : 'success' },
        ])}</div>`,
        '<div class="odvc4-note-card"><strong>Choose the next page</strong><p>Open Create server record when the control-plane server does not exist yet. Open Provision runtime when the server ID already exists and you need a one-time setup token.</p></div>',
        '</section>',
      ].join('');
    }

    if (workspaceMode === 'inventory') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Runtime mix</span><h2 class="odv4-section-title">Delivery Agents and Server Bots</h2><p class="odv4-section-copy">This route stays focused on registry inspection after provisioning is already complete.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Delivery Agents', value: formatNumber(deliveryRows.length, '0'), detail: `${formatNumber(deliveryRows.filter((row) => row.statusTone === 'success').length, '0')} online`, tone: deliveryRows.length ? 'info' : 'muted' },
          { label: 'Server Bots', value: formatNumber(serverRows.length, '0'), detail: `${formatNumber(serverRows.filter((row) => row.statusTone === 'success').length, '0')} online`, tone: serverRows.length ? 'info' : 'muted' },
          { label: 'Pending activation', value: formatNumber(pendingRows.length, '0'), detail: 'Provisioned runtimes waiting for first bind', tone: pendingRows.length ? 'warning' : 'success' },
          { label: 'Needs attention', value: formatNumber(offlineRows.length + warningRows.length, '0'), detail: 'Offline or degraded runtimes in the registry', tone: offlineRows.length ? 'danger' : warningRows.length ? 'warning' : 'success' },
        ])}</div>`,
        '</section>',
      ].join('');
    }

    if (workspaceMode === 'diagnostics') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Diagnostics</span><h2 class="odv4-section-title">Fleet diagnostics summary</h2><p class="odv4-section-copy">Use this route to focus on runtime health drift before you trigger shared recovery actions.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Offline', value: formatNumber(offlineRows.length, '0'), detail: 'Runtimes with danger state right now', tone: offlineRows.length ? 'danger' : 'success' },
          { label: 'Degraded', value: formatNumber(warningRows.length, '0'), detail: 'Warning state or stale runtime rows', tone: warningRows.length ? 'warning' : 'success' },
          { label: 'Pending bind', value: formatNumber(pendingRows.length, '0'), detail: 'Tokens issued but not activated yet', tone: pendingRows.length ? 'warning' : 'success' },
          { label: 'Request errors', value: formatNumber(requestErrors.length, '0'), detail: 'Recent owner-side request failures', tone: requestErrors.length ? 'danger' : 'muted' },
        ])}</div>`,
        '</section>',
      ].join('');
    }

    if (workspaceMode === 'jobs') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Queue pressure</span><h2 class="odv4-section-title">Job and delivery pressure</h2><p class="odv4-section-copy">This route prioritizes queue depth, dead letters, and overdue work over runtime provisioning.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Queue depth', value: formatNumber(deliverySummary.queueCount || 0, '0'), detail: `${formatNumber(deliverySummary.inFlightCount || 0, '0')} in flight`, tone: Number(deliverySummary.queueCount || 0) > 0 ? 'warning' : 'success' },
          { label: 'Dead letters', value: formatNumber(deliverySummary.deadLetterCount || 0, '0'), detail: `${formatNumber(deliverySummary.retryableDeadLetters || 0, '0')} retryable`, tone: Number(deliverySummary.deadLetterCount || 0) > 0 ? 'danger' : 'success' },
          { label: 'Overdue', value: formatNumber(deliverySummary.overdueCount || 0, '0'), detail: 'Jobs beyond the pending threshold', tone: Number(deliverySummary.overdueCount || 0) > 0 ? 'warning' : 'success' },
          { label: 'Failed jobs', value: formatNumber(((state && state.overview && state.overview.analytics && state.overview.analytics.delivery && state.overview.analytics.delivery.failedJobs) || 0), '0'), detail: 'Latest delivery analytics snapshot', tone: Number(((state && state.overview && state.overview.analytics && state.overview.analytics.delivery && state.overview.analytics.delivery.failedJobs) || 0)) > 0 ? 'danger' : 'muted' },
        ])}</div>`,
        '</section>',
      ].join('');
    }

    if (workspaceMode === 'incidents') {
      return [
        '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
        '<div class="odv4-section-head"><span class="odv4-section-kicker">Incident focus</span><h2 class="odv4-section-title">Owner incident summary</h2><p class="odv4-section-copy">This route narrows the page to incidents, request failures, and runtimes that are already in trouble.</p></div>',
        `<div class="odvc4-metric-grid">${renderMetricCards([
          { label: 'Unacknowledged alerts', value: formatNumber(unacknowledgedNotifications.length, '0'), detail: 'Owner notifications still waiting for review', tone: unacknowledgedNotifications.length ? 'warning' : 'success' },
          { label: 'Request failures', value: formatNumber(requestErrors.length, '0'), detail: 'Recent owner request failures', tone: requestErrors.length ? 'danger' : 'success' },
          { label: 'Offline runtimes', value: formatNumber(offlineRows.length, '0'), detail: 'Danger-state runtimes in the fleet', tone: offlineRows.length ? 'danger' : 'success' },
          { label: 'Pending recovery', value: formatNumber(warningRows.length + pendingRows.length, '0'), detail: 'Warning-state or activation-pending runtimes', tone: (warningRows.length + pendingRows.length) ? 'warning' : 'success' },
        ])}</div>`,
        '</section>',
      ].join('');
    }

    return [
      '<section class="odv4-panel odvc4-panel" id="owner-runtime-route-summary">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Support context</span><h2 class="odv4-section-title">Support-ready runtime context</h2><p class="odv4-section-copy">Keep the support route focused on alerts, request evidence, and runtimes that may block a customer response.</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'Open alerts', value: formatNumber(unacknowledgedNotifications.length, '0'), detail: 'Owner notifications waiting for acknowledgement', tone: unacknowledgedNotifications.length ? 'warning' : 'success' },
        { label: 'Request evidence', value: formatNumber(requestErrors.length, '0'), detail: 'Recent request failures available for support context', tone: requestErrors.length ? 'warning' : 'muted' },
        { label: 'Pending runtimes', value: formatNumber(pendingRows.length, '0'), detail: 'Provisioned runtimes that still need activation', tone: pendingRows.length ? 'warning' : 'success' },
        { label: 'Offline runtimes', value: formatNumber(offlineRows.length, '0'), detail: 'Danger-state runtimes to review before replying', tone: offlineRows.length ? 'danger' : 'success' },
      ])}</div>`,
      '</section>',
    ].join('');
  }

  function buildOwnerRuntimeTenantOptions(state) {
    return (Array.isArray(state && state.tenants) ? state.tenants : [])
      .map((row) => ({
        value: trimText(row && (row.id || row.tenantId), 160),
        label: firstNonEmpty([
          row && row.name,
          row && row.slug,
          row && row.id,
          row && row.tenantId,
        ], ''),
      }))
      .filter((row) => row.value);
  }

  function buildOwnerRuntimeTopicEntries(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    const activeRoute = route === 'runtime-health' ? 'runtime' : route;
    return [
      {
        route: 'runtime',
        href: '/owner/runtime',
        label: 'Service overview',
        badge: 'Overview',
        copy: 'Assess Delivery Agent and Server Bot posture before choosing the next operational step.',
      },
      {
        route: 'runtime-create-server',
        href: '/owner/runtime/create-server',
        label: 'Create server record',
        badge: 'Step 1',
        copy: 'Register the control-plane server first so runtime credentials always bind to an existing server.',
      },
      {
        route: 'runtime-provision-runtime',
        href: '/owner/runtime/provision-runtime',
        label: 'Provision runtime',
        badge: 'Step 2',
        copy: 'Issue a one-time setup token for Delivery Agent or Server Bot from a dedicated provisioning page.',
      },
      {
        route: 'agents-bots',
        href: '/owner/runtime/agents-bots',
        label: 'Runtime overview',
        badge: 'Registry',
        copy: 'Inspect registered runtimes, device binding, and current runtime posture without provisioning controls.',
      },
      {
        route: 'jobs',
        href: '/owner/jobs',
        label: 'Shared operations',
        badge: 'Ops',
        copy: 'Handle managed-service restart, automation preview, and recovery launch from a dedicated operations page.',
      },
      {
        route: 'fleet-diagnostics',
        href: '/owner/runtime/fleet-diagnostics',
        label: 'Fleet diagnostics',
        badge: 'Diagnostics',
        copy: 'Focus on degraded, offline, and pending runtimes before you trigger recovery actions.',
      },
    ].map((item) => ({
      ...item,
      isCurrent: item.route === activeRoute,
    }));
  }

  function renderOwnerRuntimeTopicNav(rawRoute) {
    return '';
  }

  function normalizeOwnerFamilyTopicActiveRoute(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase();
    if (!route) return '';
    if (route === 'create-tenant' || route.startsWith('tenant-')) return 'tenants';
    if (route === 'package-detail') return 'packages';
    if (route === 'subscription-detail') return 'subscriptions';
    if (route === 'invoice-detail' || route === 'attempt-detail') return 'billing';
    if (route === 'observability') return 'analytics';
    if (route === 'backup-detail') return 'recovery';
    if (route.startsWith('support-')) return 'support';
    return route;
  }

  function buildOwnerFamilyTopicConfig(routeKind, rawRoute) {
    if (routeKind === 'tenants' || routeKind === 'packages' || routeKind === 'tenant-detail') {
      return {
        id: 'owner-commercial-topic-nav',
        title: 'Commercial topics',
        copy: 'Move between tenant, package, subscription, and billing work without mixing unrelated tasks.',
        entries: [
          { route: 'tenants', href: '/owner/tenants', label: 'Tenant list', badge: 'Tenants', copy: 'Customer registry and onboarding entry point.' },
          { route: 'packages', href: '/owner/packages', label: 'Packages', badge: 'Catalog', copy: 'Feature and entitlement catalog for saleable plans.' },
          { route: 'subscriptions', href: '/owner/subscriptions', label: 'Subscriptions', badge: 'Lifecycle', copy: 'Renewal, churn, and follow-up queue.' },
          { route: 'billing', href: '/owner/billing', label: 'Billing', badge: 'Revenue', copy: 'Invoices, payment attempts, and revenue risk.' },
        ],
      };
    }
    if (routeKind === 'subscriptions') {
      return {
        id: 'owner-subscriptions-topic-nav',
        title: 'Revenue topics',
        copy: 'Split subscription follow-up from invoice and payment work inside the revenue family.',
        entries: [
          { route: 'subscriptions', href: '/owner/subscriptions', label: 'Subscriptions', badge: 'Lifecycle', copy: 'Track renewals, expirations, and recovery queue.' },
          { route: 'billing', href: '/owner/billing', label: 'Billing', badge: 'Invoices', copy: 'Focus on invoice detail and payment attempts.' },
          { route: 'packages', href: '/owner/packages', label: 'Packages', badge: 'Catalog', copy: 'Review package fit before changing plan assignments.' },
        ],
      };
    }
    if (routeKind === 'settings') {
      return {
        id: 'owner-settings-topic-nav',
        title: 'Platform control topics',
        copy: 'Keep platform settings, guarded controls, and automation in separate pages inside the same family.',
        entries: [
          { route: 'settings', href: '/owner/settings', label: 'Settings', badge: 'Policy', copy: 'Environment, access, and platform defaults.' },
          { route: 'control', href: '/owner/control', label: 'Platform controls', badge: 'Control', copy: 'Guarded platform-level actions and service controls.' },
          { route: 'automation', href: '/owner/automation', label: 'Automation', badge: 'Automation', copy: 'Manual runs, preview, and automation recovery signals.' },
        ],
      };
    }
    if (routeKind === 'audit') {
      return {
        id: 'owner-audit-topic-nav',
        title: 'Security topics',
        copy: 'Separate audit evidence, security signals, access posture, and diagnostics exports into focused views.',
        entries: [
          { route: 'audit', href: '/owner/audit', label: 'Audit trail', badge: 'Audit', copy: 'Operator actions and evidence timeline.' },
          { route: 'security', href: '/owner/security', label: 'Security', badge: 'Security', copy: 'Security events and suspicious activity signals.' },
          { route: 'access', href: '/owner/access', label: 'Access posture', badge: 'Access', copy: 'Session review and privileged access surface.' },
          { route: 'diagnostics', href: '/owner/diagnostics', label: 'Diagnostics', badge: 'Evidence', copy: 'Request evidence and export workbench.' },
        ],
      };
    }
    if (routeKind === 'analytics' || routeKind === 'recovery' || routeKind === 'support-detail') {
      return {
        id: 'owner-operations-topic-nav',
        title: 'Operations topics',
        copy: 'Switch between analytics, shared operations, support, and recovery without carrying every block on one page.',
        entries: [
          { route: 'analytics', href: '/owner/analytics', label: 'Analytics', badge: 'Signals', copy: 'Platform and business telemetry.' },
          { route: 'jobs', href: '/owner/jobs', label: 'Shared operations', badge: 'Ops', copy: 'Restart, automation, and recovery controls.' },
          { route: 'support', href: '/owner/support', label: 'Support', badge: 'Support', copy: 'Escalation context and customer-facing runtime evidence.' },
          { route: 'recovery', href: '/owner/recovery', label: 'Recovery', badge: 'Recovery', copy: 'Backups, dry-run restore, and restore history.' },
        ],
      };
    }
    return null;
  }

  function renderOwnerFamilyTopicNav(routeKind, rawRoute) {
    return '';
  }

  function renderRuntimeWorkspace(state, runtimeRows, selectedRuntime, settings = {}) {
    const runtimeBootstrap = settings && settings.runtimeBootstrap;
    const automationPreview = settings && settings.automationPreview;
    const workspaceMode = resolveOwnerRuntimeWorkspaceMode(settings && settings.currentRoute);
    const routePresentation = buildOwnerRuntimeRoutePresentation(settings && settings.currentRoute);
    const controlPanelSettings = parseObject(state && state.controlPanelSettings);
    const managedServices = Array.isArray(controlPanelSettings.managedServices) ? controlPanelSettings.managedServices : [];
    const overview = parseObject(state && state.overview);
    const automationState = parseObject(overview.automationState);
    const automationConfig = parseObject(overview.automationConfig);
    const automationRecoveryRows = buildAutomationRecoveryRows(automationState);
    const routeSummaryPanel = renderOwnerRuntimeRouteSummary(state, runtimeRows, workspaceMode);
    const displayRuntimeRows = selectRuntimeRowsForWorkspace(runtimeRows, workspaceMode);
    const tenantOptions = buildOwnerRuntimeTenantOptions(state);
    const bootstrapPayload = runtimeBootstrap && typeof runtimeBootstrap === 'object'
      ? parseObject(runtimeBootstrap.bootstrap)
      : {};
    const defaultRuntimeKind = trimText(
      firstNonEmpty([
        selectedRuntime && selectedRuntime.runtimeKind,
        bootstrapPayload.runtimeKind,
        'server-bots',
      ], 'server-bots'),
      80,
    ) || 'server-bots';
    const defaultTenantId = trimText(
      firstNonEmpty([
        selectedRuntime && selectedRuntime.tenantId,
        bootstrapPayload.tenantId,
        tenantOptions[0] && tenantOptions[0].value,
      ], ''),
      160,
    );
    const defaultServerId = trimText(firstNonEmpty([
      selectedRuntime && selectedRuntime.serverId,
      bootstrapPayload.serverId,
    ], ''), 160);
    const defaultGuildId = trimText(firstNonEmpty([
      selectedRuntime && selectedRuntime.guildId,
      bootstrapPayload.guildId,
    ], ''), 160);
    const defaultAgentId = trimText(firstNonEmpty([
      selectedRuntime && selectedRuntime.agentId,
      bootstrapPayload.agentId,
    ], ''), 160);
    const defaultRuntimeKey = trimText(firstNonEmpty([
      selectedRuntime && selectedRuntime.runtimeKey,
      bootstrapPayload.runtimeKey,
    ], ''), 160);
    const defaultDisplayName = trimText(firstNonEmpty([
      selectedRuntime && selectedRuntime.displayName,
      bootstrapPayload.displayName,
      defaultRuntimeKey,
      defaultAgentId,
    ], ''), 160);
    const defaultMinimumVersion = trimText(firstNonEmpty([
      selectedRuntime && selectedRuntime.minimumVersion,
      bootstrapPayload.minimumVersion,
      '1.0.0',
    ], '1.0.0'), 80) || '1.0.0';
    const runtimeTableRows = displayRuntimeRows.map((row) => [
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
    const runtimeProvisionPanel = [
      '<section class="odv4-panel odvc4-panel" id="owner-runtime-server-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Create server record</span><h2 class="odv4-section-title">Register a server before issuing runtime credentials</h2><p class="odv4-section-copy">If this tenant does not have a control-plane server record yet, create it here first so the runtime setup token can bind against a real server ID.</p></div>',
      '<form class="odvc4-form" data-owner-form="create-platform-server">',
      '<div class="odvc4-form-grid">',
      renderFormField({
        name: 'tenantId',
        label: 'Tenant',
        type: 'select',
        required: true,
        value: defaultTenantId,
        options: tenantOptions.length
          ? tenantOptions
          : [{ value: '', label: 'No tenant loaded' }],
      }),
      renderFormField({ name: 'name', label: 'Server name', type: 'text', required: true, value: '', description: 'Display name for the SCUM server in owner and tenant views.' }),
      renderFormField({ name: 'slug', label: 'Server slug', type: 'text', value: '', description: 'Optional stable slug. Leave blank to let the backend normalize it.' }),
      renderFormField({ name: 'status', label: 'Status', type: 'select', value: 'active', options: [
        { value: 'active', label: 'Active' },
        { value: 'pending', label: 'Pending' },
        { value: 'paused', label: 'Paused' },
      ] }),
      renderFormField({ name: 'locale', label: 'Locale', type: 'select', value: 'th', options: [
        { value: 'th', label: 'Thai' },
        { value: 'en', label: 'English' },
      ] }),
      renderFormField({ name: 'guildId', label: 'Guild ID', type: 'text', value: defaultGuildId, description: 'Optional Discord guild link to attach during server creation.' }),
      '</div>',
      '<div class="odvc4-form-actions">',
      '<button class="odv4-button odv4-button-secondary" type="submit">Create server record</button>',
      '<span class="odvc4-inline-note">After the server is created, continue to Provision runtime so the setup token is issued against the new server ID.</span>',
      '</div>',
      '</form>',
      '</section>',
    ].join('');
    const runtimeProvisionTokenPanel = [
      '<section class="odv4-panel odvc4-panel" id="owner-runtime-provisioning-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Provision runtime</span><h2 class="odv4-section-title">Issue setup token and bind a runtime</h2><p class="odv4-section-copy">Create or replace a one-time setup token for a Delivery Agent or Server Bot without waiting for an existing runtime row to appear first.</p></div>',
      '<form class="odvc4-form" data-owner-form="provision-runtime">',
      '<div class="odvc4-form-grid">',
      renderFormField({
        name: 'tenantId',
        label: 'Tenant',
        type: 'select',
        required: true,
        value: defaultTenantId,
        options: tenantOptions.length
          ? tenantOptions
          : [{ value: '', label: 'No tenant loaded' }],
        description: tenantOptions.length
          ? 'Choose the tenant that owns this runtime.'
          : 'Load tenant data first, or refresh if bootstrap data is stale.',
      }),
      renderFormField({
        name: 'runtimeKind',
        label: 'Runtime role',
        type: 'select',
        required: true,
        value: defaultRuntimeKind,
        options: [
          { value: 'server-bots', label: 'Server Bot' },
          { value: 'delivery-agents', label: 'Delivery Agent' },
        ],
        description: 'This keeps server-side management separate from in-game delivery execution.',
      }),
      renderFormField({ name: 'serverId', label: 'Server ID', type: 'text', required: true, value: defaultServerId, description: 'Existing server record ID in the control plane.' }),
      renderFormField({ name: 'guildId', label: 'Guild ID', type: 'text', value: defaultGuildId, description: 'Optional Discord guild scope for the runtime.' }),
      renderFormField({ name: 'agentId', label: 'Agent ID', type: 'text', required: true, value: defaultAgentId, description: 'Stable machine-side agent identifier.' }),
      renderFormField({ name: 'runtimeKey', label: 'Runtime key', type: 'text', required: true, value: defaultRuntimeKey, description: 'Unique runtime key used by the registry and monitoring flows.' }),
      renderFormField({ name: 'displayName', label: 'Display name', type: 'text', required: true, value: defaultDisplayName, description: 'Human-readable label shown in Owner and tenant dashboards.' }),
      renderFormField({ name: 'minimumVersion', label: 'Minimum version', type: 'text', required: true, value: defaultMinimumVersion, description: 'Agents below this version are flagged for upgrade before activation.' }),
      '</div>',
      '<div class="odvc4-form-actions">',
      '<button class="odv4-button odv4-button-primary" type="submit">Issue setup token</button>',
      '<span class="odvc4-inline-note">The setup token is shown immediately on this page after creation so the install team can activate the runtime.</span>',
      '</div>',
      '</form>',
      '</section>',
    ].join('');
    const sharedOpsPanel = [
      '<section class="odv4-panel odvc4-panel" id="owner-runtime-shared-ops">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Shared operations</span><h2 class="odv4-section-title">Restart and recovery controls</h2><p class="odv4-section-copy">Owner can restart shared platform services and run automation or recovery without dropping into a separate internal console.</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        {
          label: 'Managed services',
          value: formatNumber(managedServices.length, '0'),
          detail: managedServices.length ? 'Shared services available for restart' : 'No shared services configured',
          tone: managedServices.length ? 'info' : 'warning',
        },
        {
          label: 'Automation',
          value: automationConfig.enabled === false ? 'Disabled' : 'Enabled',
          detail: `Max ${formatNumber(automationConfig.maxActionsPerCycle || 0, '0')} action(s) per cycle`,
          tone: automationConfig.enabled === false ? 'warning' : 'success',
        },
        {
          label: 'Last automation',
          value: automationState.lastAutomationAt ? formatDateTime(automationState.lastAutomationAt) : 'Not recorded',
          detail: automationState.lastForcedMonitoringAt ? `Forced monitoring ${formatDateTime(automationState.lastForcedMonitoringAt)}` : 'No forced monitoring yet',
          tone: 'info',
        },
        {
          label: 'Recovery history',
          value: formatNumber(automationRecoveryRows.length, '0'),
          detail: automationRecoveryRows.length ? 'Recent restart outcomes are available below' : 'No recovery outcomes recorded yet',
          tone: automationRecoveryRows.length ? 'warning' : 'muted',
        },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      '<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="run-platform-automation" data-dry-run="true">Preview automation</button>',
      '<button class="odv4-button odv4-button-primary" type="button" data-owner-action="run-platform-automation" data-dry-run="false">Run automation now</button>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/recovery">Open recovery</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/audit">Open audit</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/settings">Platform settings</a>',
      '</div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Service</th><th>PM2 name</th><th>Action</th></tr></thead><tbody>',
      renderManagedServicesTable(managedServices),
      '</tbody></table></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table" data-owner-runtime-recovery-table><thead><tr><th>Service</th><th>Latest result</th><th>Runtime state</th><th>Recorded at</th></tr></thead><tbody>',
      renderAutomationRecoveryTable(automationRecoveryRows),
      '</tbody></table></div>',
      automationPreview ? renderAutomationPreview(automationPreview) : '',
      '</section>',
    ].join('');
    const showCreateServerPanel = workspaceMode === 'create-server';
    const showProvisioningPanel = workspaceMode === 'provision';
    const showSharedOpsPanel = workspaceMode === 'jobs';
    const showRuntimeInventory = workspaceMode === 'inventory' || workspaceMode === 'diagnostics' || workspaceMode === 'incidents' || workspaceMode === 'support';
    const showInspector = !!selectedRuntime && (workspaceMode === 'inventory' || workspaceMode === 'diagnostics' || workspaceMode === 'incidents' || workspaceMode === 'support');
    const showBootstrapCard = workspaceMode === 'provision';
    return [
      routeSummaryPanel,
      showBootstrapCard ? bootstrapCard : '',
      showInspector ? inspector : '',
      showCreateServerPanel ? runtimeProvisionPanel : '',
      showProvisioningPanel ? runtimeProvisionTokenPanel : '',
      showSharedOpsPanel ? sharedOpsPanel : '',
      ...(showRuntimeInventory ? [
        `<section class="odv4-panel odvc4-panel" id="owner-runtime-workspace" data-owner-focus-route="${escapeHtml(routePresentation.focusRoutes)}">`,
        `<div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(routePresentation.kicker)}</span><h2 class="odv4-section-title">${escapeHtml(routePresentation.title)}</h2><p class="odv4-section-copy">${escapeHtml(routePresentation.copy)}</p></div>`,
        '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Service</th><th>Role</th><th>Status</th><th>Version</th><th>Last seen</th><th>Action</th></tr></thead><tbody>',
        runtimeTableRows || '<tr><td colspan="6">No runtime services available yet.</td></tr>',
        '</tbody></table></div>',
        '</section>',
      ] : []),
    ].join('');
  }

  function normalizeOwnerRecoveryBackupFiles(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        id: trimText(item && item.id, 160),
        file: trimText(item && item.file, 260),
        sizeBytes: Number(item && item.sizeBytes || 0),
        createdAt: item && item.createdAt,
        updatedAt: item && item.updatedAt,
      }))
      .filter((item) => item.file || item.id)
      .sort((left, right) => (parseDate(right.updatedAt || right.createdAt)?.getTime() || 0) - (parseDate(left.updatedAt || left.createdAt)?.getTime() || 0));
  }

  function normalizeOwnerRecoveryHistory(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        operationId: trimText(item && item.operationId, 160),
        status: trimText(item && item.status, 80).toLowerCase() || 'idle',
        backup: trimText(item && item.backup, 260),
        confirmBackup: trimText(item && item.confirmBackup, 260),
        rollbackBackup: trimText(item && item.rollbackBackup, 260),
        rollbackStatus: trimText(item && item.rollbackStatus, 80).toLowerCase() || 'none',
        lastError: trimText(item && item.lastError, 400),
        actor: trimText(item && item.actor, 160),
        recordedAt: item && (item.recordedAt || item.endedAt || item.updatedAt || item.startedAt),
        warnings: Array.isArray(item && item.warnings) ? item.warnings.filter(Boolean).slice(0, 3) : [],
        verification: item && item.verification && typeof item.verification === 'object' ? item.verification : null,
      }))
      .filter((item) => item.backup || item.operationId)
      .sort((left, right) => (parseDate(right.recordedAt)?.getTime() || 0) - (parseDate(left.recordedAt)?.getTime() || 0));
  }

  function buildOwnerRecoveryPhase(restoreState, restorePreview) {
    const state = parseObject(restoreState);
    const preview = parseObject(restorePreview);
    const status = trimText(state.status, 80).toLowerCase();
    if (status === 'running') {
      return {
        label: 'Restore running',
        tone: 'warning',
        detail: firstNonEmpty([
          trimText(state.backup, 260) ? `Applying ${trimText(state.backup, 260)} to the shared control plane.` : '',
          'A restore cycle is active. Keep operators out of sensitive actions until verification completes.',
        ], 'A restore cycle is active.'),
      };
    }
    if (status === 'succeeded') {
      const verified = state.verification && state.verification.ready === true;
      return {
        label: verified ? 'Restore verified' : 'Restore completed',
        tone: verified ? 'success' : 'warning',
        detail: verified
          ? 'Latest restore passed verification checks.'
          : 'Latest restore completed. Review verification details before declaring recovery complete.',
      };
    }
    if (status === 'failed') {
      return {
        label: 'Restore failed',
        tone: 'danger',
        detail: firstNonEmpty([
          trimText(state.lastError, 320),
          'The latest restore attempt failed. Review preview warnings and history before retrying.',
        ], 'The latest restore attempt failed.'),
      };
    }
    if (trimText(preview.previewToken, 260) || trimText(state.previewToken, 260)) {
      return {
        label: 'Preview ready',
        tone: 'info',
        detail: firstNonEmpty([
          trimText(preview.backup, 260) ? `Preview is ready for ${trimText(preview.backup, 260)}.` : '',
          trimText(state.previewBackup, 260) ? `Preview is ready for ${trimText(state.previewBackup, 260)}.` : '',
          'A guarded restore preview is ready. Confirm the selected backup name to apply it.',
        ], 'A guarded restore preview is ready.'),
      };
    }
    return {
      label: 'Ready',
      tone: 'muted',
      detail: 'Create a fresh backup or run a dry-run preview before applying a restore.',
    };
  }

  function renderOwnerRecoveryPreviewSummary(restoreState, restorePreview) {
    const state = parseObject(restoreState);
    const preview = parseObject(restorePreview);
    const backup = trimText(firstNonEmpty([preview.backup, state.previewBackup], ''), 260);
    const token = trimText(firstNonEmpty([preview.previewToken, state.previewToken], ''), 260);
    const warnings = Array.isArray(preview.warnings) ? preview.warnings.filter(Boolean).slice(0, 3) : [];
    const verificationChecks = Array.isArray(preview.verificationPlan && preview.verificationPlan.checks)
      ? preview.verificationPlan.checks.slice(0, 4)
      : [];
    if (!backup && !token) {
      return '<div class="odv4-empty-state" data-owner-recovery-preview="empty"><strong>No restore preview yet</strong><p>Run a dry-run preview to inspect warnings, verification checks, and the guarded preview token.</p></div>';
    }
    return [
      '<article class="odvc4-note-card" data-owner-recovery-preview="true">',
      `<strong>${escapeHtml(backup || 'Restore preview')}</strong>`,
      `<p>${escapeHtml(firstNonEmpty([
        trimText(preview.note, 320),
        state.previewExpiresAt ? `Preview expires ${formatDateTime(state.previewExpiresAt)}.` : '',
        'Dry-run preview generated from the selected shared backup.',
      ], 'Dry-run preview generated from the selected shared backup.'))}</p>`,
      `<div class="odvc4-chip-row">${[
        { label: backup || 'Backup not selected', tone: backup ? 'info' : 'warning' },
        { label: token ? 'Preview token ready' : 'Preview token missing', tone: token ? 'success' : 'warning' },
        { label: preview.schemaVersion ? `Schema ${preview.schemaVersion}` : 'Current schema', tone: 'muted' },
      ].map((item) => `<span class="odv4-pill odv4-pill-${escapeHtml(item.tone)}">${escapeHtml(item.label)}</span>`).join('')}</div>`,
      warnings.length
        ? `<div class="odvc4-stack"><span class="odvc4-field-label">Warnings</span>${warnings.map((item) => `<div class="odvc4-inline-note">${escapeHtml(item)}</div>`).join('')}</div>`
        : '<div class="odvc4-inline-note">No preview warnings were returned.</div>',
      verificationChecks.length
        ? `<div class="odvc4-stack"><span class="odvc4-field-label">Verification plan</span>${verificationChecks.map((item) => `<div class="odvc4-inline-note">${escapeHtml(firstNonEmpty([item.label, item.id], 'check'))}${item.detail ? ` / ${escapeHtml(item.detail)}` : ''}</div>`).join('')}</div>`
        : '<div class="odvc4-inline-note">No verification plan entries were returned.</div>',
      '</article>',
    ].join('');
  }

  function renderOwnerRecoveryBackupRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<tr><td colspan="4">No shared backups recorded yet.</td></tr>';
    }
    return items.slice(0, 12).map((item) => [
      '<tr>',
      `<td><strong>${escapeHtml(firstNonEmpty([item.file, item.id], '-'))}</strong><div class="odvc4-table-note">${escapeHtml(item.id || '-')}</div></td>`,
      `<td>${escapeHtml(formatDateTime(item.updatedAt || item.createdAt))}</td>`,
      `<td>${escapeHtml(formatByteSize(item.sizeBytes))}</td>`,
      `<td class="odvc4-table-note">${escapeHtml(item.createdAt ? `Created ${formatDateTime(item.createdAt)}` : 'Shared backup inventory entry')}</td>`,
      '</tr>',
    ].join('')).join('');
  }

  function renderOwnerRecoveryHistoryRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<tr><td colspan="5">No restore history recorded yet.</td></tr>';
    }
    return items.slice(0, 8).map((item) => [
      '<tr>',
      `<td><strong>${escapeHtml(formatDateTime(item.recordedAt))}</strong><div class="odvc4-table-note">${escapeHtml(firstNonEmpty([item.actor, item.operationId], '-'))}</div></td>`,
      `<td><strong>${escapeHtml(firstNonEmpty([item.backup, '-']))}</strong>${item.rollbackBackup ? `<div class="odvc4-table-note">Rollback ${escapeHtml(item.rollbackBackup)}</div>` : ''}</td>`,
      `<td><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(item.status))}">${escapeHtml(item.status || 'idle')}</span>${item.rollbackStatus && item.rollbackStatus !== 'none' ? `<div class="odvc4-table-note">Rollback ${escapeHtml(item.rollbackStatus)}</div>` : ''}</td>`,
      `<td>${item.verification && item.verification.ready === true ? '<span class="odv4-pill odv4-pill-success">Ready</span>' : '<span class="odv4-pill odv4-pill-warning">Pending</span>'}</td>`,
      `<td class="odvc4-table-note">${escapeHtml(firstNonEmpty([
        item.lastError,
        item.warnings && item.warnings.length ? item.warnings[0] : '',
        'Shared restore cycle recorded.',
      ], 'Shared restore cycle recorded.'))}</td>`,
      '</tr>',
    ].join('')).join('');
  }

  function renderRecoveryWorkspaceV2(state, settings = {}) {
    const restoreState = parseObject(state && state.restoreState);
    const restorePreview = parseObject(settings && settings.restorePreview);
    const backupFiles = normalizeOwnerRecoveryBackupFiles(state && state.backupFiles);
    const restoreHistory = normalizeOwnerRecoveryHistory(state && state.restoreHistory);
    const phase = buildOwnerRecoveryPhase(restoreState, restorePreview);
    const previewBackup = trimText(firstNonEmpty([
      restorePreview.backup,
      restoreState.previewBackup,
      backupFiles[0] && backupFiles[0].file,
    ], ''), 260);
    const previewToken = trimText(firstNonEmpty([
      restorePreview.previewToken,
      restoreState.previewToken,
    ], ''), 260);
    const backupOptions = backupFiles.length
      ? backupFiles.map((item) => ({
          value: item.file,
          label: `${item.file} / ${formatDateTime(item.updatedAt || item.createdAt)}`,
        }))
      : [{ value: '', label: 'No shared backups available yet' }];
    const latestHistory = restoreHistory[0] || null;
    const workspaceMode = resolveOwnerRecoveryWorkspaceMode(settings && settings.currentRoute);
    let html = [
      '<section class="odv4-panel odvc4-panel" id="owner-recovery-workspace" data-owner-focus-route="recovery runtime diagnostics audit">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Recovery</span><h2 class="odv4-section-title">Shared backup and restore workbench</h2><p class="odv4-section-copy">Use the same Owner shell to create backups, preview guarded restores, and apply a verified restore without dropping into a separate runtime-only surface.</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'Recovery phase', value: phase.label, detail: phase.detail, tone: phase.tone },
        { label: 'Shared backups', value: formatNumber(backupFiles.length, '0'), detail: backupFiles.length ? `Latest backup ${formatDateTime(backupFiles[0].updatedAt || backupFiles[0].createdAt)}` : 'Create a fresh backup before restore', tone: backupFiles.length ? 'success' : 'warning' },
        { label: 'Restore history', value: formatNumber(restoreHistory.length, '0'), detail: latestHistory ? `Latest cycle ${formatDateTime(latestHistory.recordedAt)}` : 'No restore cycle recorded yet', tone: latestHistory ? toneForStatus(latestHistory.status) : 'muted' },
        { label: 'Preview token', value: previewToken ? 'Ready' : 'Missing', detail: previewToken ? trimText(previewToken, 48) : 'Run a dry-run preview to issue a guarded token', tone: previewToken ? 'success' : 'warning' },
      ])}</div>`,
      '<div class="odvc4-action-row">',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Runtime</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/diagnostics">Diagnostics</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/audit">Audit</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/settings">Platform settings</a>',
      '</div>',
      renderOwnerRecoveryPreviewSummary(restoreState, restorePreview),
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-recovery-create-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Create backup</span><h2 class="odv4-section-title">Record a fresh shared backup</h2><p class="odv4-section-copy">Create a control-plane backup before preview or restore so the inventory and history stay current.</p></div>',
      '<form class="odvc4-form" data-owner-form="backup-create">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'note', label: 'Operator note', type: 'text', value: '', description: 'Optional note to explain why this backup was created.' }),
      renderFormField({ name: 'includeSnapshot', label: 'Include snapshot', type: 'select', value: 'true', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], description: 'Include a runtime snapshot in the shared backup payload.' }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-secondary" type="submit">Create backup now</button></div>',
      '</form>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-recovery-preview-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Dry-run preview</span><h2 class="odv4-section-title">Preview a restore before applying it</h2><p class="odv4-section-copy">Issue a guarded preview token, inspect warnings, and validate the selected backup before any restore is allowed.</p></div>',
      '<form class="odvc4-form" data-owner-form="backup-preview">',
      '<div class="odvc4-form-grid">',
      renderFormField({ name: 'backup', label: 'Backup', type: 'select', required: true, value: previewBackup, options: backupOptions, description: backupFiles.length ? 'Select a shared backup from the current inventory.' : 'Create a backup first to populate this list.' }),
      '</div>',
      '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">Run dry-run preview</button></div>',
      '</form>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-recovery-restore-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Apply restore</span><h2 class="odv4-section-title">Restore the previewed backup</h2><p class="odv4-section-copy">Restore stays guarded behind the preview token. Confirm the exact backup name before applying it to the shared control plane.</p></div>',
      previewBackup && previewToken
        ? [
            '<form class="odvc4-form" data-owner-form="backup-restore">',
            renderFormField({ name: 'backup', type: 'hidden', value: previewBackup }),
            renderFormField({ name: 'previewToken', type: 'hidden', value: previewToken }),
            '<div class="odvc4-form-grid">',
            renderFormField({ name: 'confirmBackup', label: 'Confirm backup name', type: 'text', required: true, value: '', description: `Type ${previewBackup} to confirm the guarded restore.` }),
            '</div>',
            `<div class="odvc4-note-card"><strong>Selected preview</strong><p>${escapeHtml(previewBackup)} / ${escapeHtml(trimText(previewToken, 48))}</p></div>`,
            '<div class="odvc4-form-actions"><button class="odv4-button odv4-button-primary" type="submit">Restore previewed backup</button></div>',
            '</form>',
          ].join('')
        : '<div class="odv4-empty-state"><strong>Preview required</strong><p>Run the preview form first. The restore action stays locked until a preview token exists for the selected backup.</p></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-recovery-inventory-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Inventory</span><h2 class="odv4-section-title">Shared backup inventory</h2><p class="odv4-section-copy">Current backups available to the Owner recovery flow.</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table" data-owner-recovery-backup-table><thead><tr><th>Backup</th><th>Updated</th><th>Size</th><th>Detail</th></tr></thead><tbody>',
      renderOwnerRecoveryBackupRows(backupFiles),
      '</tbody></table></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-recovery-history-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">History</span><h2 class="odv4-section-title">Restore history</h2><p class="odv4-section-copy">Latest restore cycles and verification outcomes recorded by the shared recovery flow.</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table" data-owner-recovery-history-table><thead><tr><th>When</th><th>Backup</th><th>Status</th><th>Verification</th><th>Notes</th></tr></thead><tbody>',
      renderOwnerRecoveryHistoryRows(restoreHistory),
      '</tbody></table></div>',
      '</section>',
    ].join('');
    if (workspaceMode === 'create') {
      html = stripDirectSectionById(html, 'owner-recovery-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-preview-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-restore-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-inventory-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-history-workspace');
      return html.replace('data-owner-focus-route="recovery runtime diagnostics audit"', 'data-owner-focus-route="recovery create backup"');
    }
    if (workspaceMode === 'preview') {
      html = stripDirectSectionById(html, 'owner-recovery-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-create-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-restore-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-inventory-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-history-workspace');
      return html.replace('data-owner-focus-route="recovery runtime diagnostics audit"', 'data-owner-focus-route="recovery preview validate"');
    }
    if (workspaceMode === 'restore') {
      html = stripDirectSectionById(html, 'owner-recovery-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-create-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-preview-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-inventory-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-history-workspace');
      return html.replace('data-owner-focus-route="recovery runtime diagnostics audit"', 'data-owner-focus-route="recovery restore guarded"');
    }
    if (workspaceMode === 'history') {
      html = stripDirectSectionById(html, 'owner-recovery-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-create-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-preview-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-restore-workspace');
      html = stripDirectSectionById(html, 'owner-recovery-inventory-workspace');
      return html.replace('data-owner-focus-route="recovery runtime diagnostics audit"', 'data-owner-focus-route="recovery history verification"');
    }
    html = stripDirectSectionById(html, 'owner-recovery-create-workspace');
    html = stripDirectSectionById(html, 'owner-recovery-preview-workspace');
    html = stripDirectSectionById(html, 'owner-recovery-restore-workspace');
    html = stripDirectSectionById(html, 'owner-recovery-inventory-workspace');
    html = stripDirectSectionById(html, 'owner-recovery-history-workspace');
    return html.replace('data-owner-focus-route="recovery runtime diagnostics audit"', 'data-owner-focus-route="recovery overview"');
  }

  function renderAnalyticsWorkspace(state, packageUsageRows, runtimeRows, invoiceSummary, settings = {}) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const analytics = overview.analytics && typeof overview.analytics === 'object' ? overview.analytics : {};
    const tenantAnalytics = analytics.tenants && typeof analytics.tenants === 'object' ? analytics.tenants : {};
    const subscriptionAnalytics = analytics.subscriptions && typeof analytics.subscriptions === 'object' ? analytics.subscriptions : {};
    const deliveryAnalytics = analytics.delivery && typeof analytics.delivery === 'object' ? analytics.delivery : {};
    const tenantRows = Array.isArray(state.tenants) ? state.tenants : [];
    const runtimeOnline = runtimeRows.filter((row) => row.statusTone === 'success').length;
    const packageRows = packageUsageRows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(formatNumber(row.tenantCount, '0'))}</td><td>${escapeHtml(formatNumber(row.features.length, '0'))}</td></tr>`).join('');
    const workspaceMode = resolveOwnerAnalyticsWorkspaceMode(settings && settings.currentRoute);
    let html = [
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
      '<div class="odvc4-action-row">',
      '<a class="odv4-button odv4-button-primary" href="/owner/subscriptions">Open subscriptions</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/billing">Open billing</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Open runtime health</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/diagnostics#owner-audit-export-console">Open diagnostics exports</a>',
      '</div>',
      '</section>',
      renderOwnerRiskQueue(state, tenantRows),
      '<section class="odv4-panel odvc4-panel" id="owner-analytics-packages-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Package usage</span><h2 class="odv4-section-title">Package usage by customer count</h2><p class="odv4-section-copy">Review package adoption separately from the risk queue and top-line owner summary.</p></div>',
    '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Package</th><th>Customer count</th><th>Features</th></tr></thead><tbody>',
      packageRows || '<tr><td colspan="3">ยังไม่มี package usage</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
  }

  function renderAnalyticsWorkspaceV2(state, packageUsageRows, runtimeRows, invoiceSummary, settings = {}) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const analytics = overview.analytics && typeof overview.analytics === 'object' ? overview.analytics : {};
    const tenantAnalytics = analytics.tenants && typeof analytics.tenants === 'object' ? analytics.tenants : {};
    const subscriptionAnalytics = analytics.subscriptions && typeof analytics.subscriptions === 'object' ? analytics.subscriptions : {};
    const deliveryAnalytics = analytics.delivery && typeof analytics.delivery === 'object' ? analytics.delivery : {};
    const tenantRows = Array.isArray(state.tenants) ? state.tenants : [];
    const runtimeOnline = runtimeRows.filter((row) => row.statusTone === 'success').length;
    const packageRows = packageUsageRows.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(formatNumber(row.tenantCount, '0'))}</td><td>${escapeHtml(formatNumber(row.features.length, '0'))}</td></tr>`).join('');
    const workspaceMode = resolveOwnerAnalyticsWorkspaceMode(settings && settings.currentRoute);
    let html = [
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
      '<div class="odvc4-action-row">',
      '<a class="odv4-button odv4-button-primary" href="/owner/subscriptions">Open subscriptions</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/billing">Open billing</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/runtime">Open runtime health</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/diagnostics#owner-audit-export-console">Open diagnostics exports</a>',
      '</div>',
      '</section>',
      renderOwnerRiskQueue(state, tenantRows),
      '<section class="odv4-panel odvc4-panel" id="owner-analytics-packages-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Package usage</span><h2 class="odv4-section-title">Package usage by customer count</h2><p class="odv4-section-copy">Review package adoption separately from the risk queue and top-line owner summary.</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>Package</th><th>Customer count</th><th>Features</th></tr></thead><tbody>',
      packageRows || '<tr><td colspan="3">ยังไม่มี package usage</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
    if (workspaceMode === 'risk') {
      html = stripDirectSectionById(html, 'owner-analytics-workspace');
      html = stripDirectSectionById(html, 'owner-analytics-packages-workspace');
      return html;
    }
    if (workspaceMode === 'packages') {
      html = stripDirectSectionById(html, 'owner-analytics-workspace');
      html = stripDirectSectionById(html, 'owner-risk-queue');
      return html.replace('data-owner-focus-route="analytics risk abuse"', 'data-owner-focus-route="analytics packages package-usage"');
    }
    html = stripDirectSectionById(html, 'owner-risk-queue');
    html = stripDirectSectionById(html, 'owner-analytics-packages-workspace');
    return html.replace('data-owner-focus-route="analytics observability"', 'data-owner-focus-route="analytics overview observability"');
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

  function renderAuditWorkspaceV2(state, settings) {
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const securityEvents = Array.isArray(state.securityEvents) ? state.securityEvents : [];
    const notifications = Array.isArray(state.notifications) ? state.notifications : [];
    const requestItems = Array.isArray(state.requestLogs && state.requestLogs.items) ? state.requestLogs.items : [];
    const openAlerts = notifications.filter((row) => row && row.acknowledged !== true);
    const acknowledgedAlerts = notifications.filter((row) => row && row.acknowledged === true);
    const failedRequests = requestItems.filter((row) => Number(row && row.statusCode) >= 500);
    const workspaceMode = resolveOwnerAuditWorkspaceMode(settings && settings.currentRoute);
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
    const workspaceLinks = [
      workspaceMode !== 'access'
        ? '<a class="odv4-button odv4-button-secondary" href="/owner/access">Open access sessions</a>'
        : '',
      workspaceMode !== 'security'
        ? '<a class="odv4-button odv4-button-secondary" href="/owner/security">Open security events</a>'
        : '',
      '<a class="odv4-button odv4-button-secondary" href="/owner/settings#owner-settings-access-policy">Open access policy</a>',
      '<a class="odv4-button odv4-button-secondary" href="/owner/diagnostics#owner-audit-export-console">Open diagnostics exports</a>',
    ].filter(Boolean).join('');
    const auditActionRow = [
      '<div class="odvc4-action-row">',
      acknowledgedAlerts.length
        ? '<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-acknowledged-notifications">Clear acknowledged alerts</button>'
        : '<span class="odvc4-inline-note">No acknowledged alerts to clear yet</span>',
      workspaceLinks,
      '</div>',
    ].join('');
    let html = [
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
    html = html.replace(/<div class="odvc4-action-row">[\s\S]*?<\/div>/, auditActionRow);
    const auditBlocks = html.match(/<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-audit-table">[\s\S]*?<\/tbody><\/table><\/div>/g) || [];
    if (workspaceMode === 'security' && auditBlocks[3]) {
      html = html.replace(auditBlocks[3], '');
    } else if (workspaceMode === 'access') {
      if (auditBlocks[2]) html = html.replace(auditBlocks[2], '');
      if (auditBlocks[3]) html = html.replace(auditBlocks[3], '');
    } else if (workspaceMode === 'diagnostics') {
      if (auditBlocks[0]) html = html.replace(auditBlocks[0], '');
      if (auditBlocks[1]) html = html.replace(auditBlocks[1], '');
      if (auditBlocks[2]) html = html.replace(auditBlocks[2], '');
      html = html.replace('<div class="odvc4-split-grid"></div>', '');
      html = html.replace(/<div class="odvc4-action-row">[\s\S]*?<\/div>/, '');
    }
    html = html.replace('data-owner-focus-route="audit security"', `data-owner-focus-route="${escapeHtml(
      workspaceMode === 'diagnostics'
        ? 'diagnostics audit export retention'
        : workspaceMode === 'access'
          ? 'access audit security'
          : workspaceMode === 'security'
            ? 'audit security access'
            : 'audit security access diagnostics'
    )}"`);
    return html;
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

  function renderPackagesWorkspace(packageUsageRows, featureCatalog, settings = {}) {
    const rows = Array.isArray(packageUsageRows) ? packageUsageRows : [];
    const packageLabelLookup = buildOwnerPackageLabelLookup(rows);
    const workspaceMode = resolveOwnerPackagesWorkspaceMode(settings && settings.currentRoute);
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
    let html = [
      '<section class="odv4-panel odvc4-panel" id="owner-packages-workspace" data-owner-focus-route="packages catalog">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การจัดการแพ็กเกจ</span><h2 class="odv4-section-title">แค็ตตาล็อกแพ็กเกจและการใช้งาน</h2><p class="odv4-section-copy">สร้าง อัปเดต และเก็บถาวรแพ็กเกจเชิงพาณิชย์จากหน้า Owner โดยยังคุมรหัสแพ็กเกจและสิทธิ์ฟีเจอร์ไว้ที่แพลตฟอร์ม</p></div>',
      `<div class="odvc4-card-grid">${packageCards || '<div class="odvc4-note-card"><strong>ยังไม่มีแพ็กเกจ</strong><p>เริ่มสร้างแพ็กเกจแรกจากฟอร์มด้านบนได้เลย</p></div>'}</div>`,
      '<div class="odvc4-note-card"><strong>กติกาการลบ</strong><p>แพ็กเกจระบบลบไม่ได้ ส่วนแพ็กเกจกำหนดเองควรถูกลบเมื่อไม่ได้ผูกกับลูกค้าที่ใช้งานอยู่หรือแผนต่ออายุแล้วเท่านั้น</p></div>',
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-packages-entitlements-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Entitlements</span><h2 class="odv4-section-title">Feature entitlement matrix</h2><p class="odv4-section-copy">Review which commercial features are exposed by each package before changing catalog posture.</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table odvc4-feature-table"><thead><tr><th>ฟีเจอร์</th>',
      rows.map((pkg) => `<th>${escapeHtml(formatOwnerPackageDisplayLabel(pkg.id, packageLabelLookup))}</th>`).join(''),
      '</tr></thead><tbody>',
      featureRows || '<tr><td colspan="5">ยังไม่มีรายการฟีเจอร์</td></tr>',
      '</tbody></table></div>',
      '</section>',
    ].join('');
    if (workspaceMode === 'create') {
      return createForm;
    }
    if (workspaceMode === 'entitlements') {
      html = stripDirectSectionById(html, 'owner-packages-workspace');
      return html.replace('data-owner-focus-route="packages catalog"', 'data-owner-focus-route="packages entitlements feature-matrix"');
    }
    html = stripDirectSectionById(html, 'owner-packages-entitlements-workspace');
    return html.replace('data-owner-focus-route="packages catalog"', 'data-owner-focus-route="packages catalog adoption"');
  }

  function renderSubscriptionsWorkspaceLegacyV2(expiringRows, invoiceSummary, tenantRows, packageCatalog, planOptions) {
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

  function renderSubscriptionsWorkspaceV3(expiringRows, invoiceSummary, tenantRows, packageCatalog, planOptions, billingInvoices, billingPaymentAttempts, settings) {
    const rows = Array.isArray(tenantRows) ? tenantRows : [];
    const invoices = Array.isArray(billingInvoices) ? billingInvoices : [];
    const paymentAttempts = Array.isArray(billingPaymentAttempts) ? billingPaymentAttempts : [];
    const recoveryQueue = buildBillingRecoveryQueue(rows, invoices, paymentAttempts);
    const riskSpotlightItems = [
      invoiceSummary.failedPaymentCount
        ? `${formatNumber(invoiceSummary.failedPaymentCount, '0')} รายการชำระเงินล้มเหลวและต้องติดตาม`
        : '',
      invoiceSummary.openInvoiceCount
        ? `${formatNumber(invoiceSummary.openInvoiceCount, '0')} ใบแจ้งหนี้ยังเปิดอยู่หรือค้างชำระ`
        : '',
      invoiceSummary.disputedInvoiceCount
        ? `${formatNumber(invoiceSummary.disputedInvoiceCount, '0')} ใบแจ้งหนี้ถูกทำเครื่องหมายว่ามีข้อโต้แย้ง`
        : '',
      invoiceSummary.refundedInvoiceCount
        ? `${formatNumber(invoiceSummary.refundedInvoiceCount, '0')} ใบแจ้งหนี้ถูกคืนเงินแล้ว`
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
    const quickForms = quickActionCards;
    const subscriptionTableRows = rows.slice(0, 16).map((row) => {
      const subscription = row.subscription || {};
      const subscriptionStatus = trimText(subscription.status || row.status, 40).toLowerCase();
      const actionButtons = [
        subscription && subscription.id && subscriptionStatus !== 'canceled'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="cancel-billing-subscription" data-tenant-id="${escapeHtml(row.tenantId)}" data-subscription-id="${escapeHtml(trimText(subscription.id, 160))}" data-plan-id="${escapeHtml(trimText(subscription.planId, 120))}" data-package-id="${escapeHtml(trimText(row.packageId || subscription.packageId, 120))}" data-billing-cycle="${escapeHtml(trimText(subscription.billingCycle, 40) || 'monthly')}" data-currency="${escapeHtml(trimText(subscription.currency, 12) || 'THB')}" data-amount-cents="${escapeHtml(String(Number(subscription.amountCents) || 0))}" data-external-ref="${escapeHtml(trimText(subscription.externalRef, 200))}">ยกเลิกการสมัครใช้งาน</button>`
          : '',
        subscription && subscription.id && ['canceled', 'past_due', 'expired'].includes(subscriptionStatus)
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reactivate-billing-subscription" data-tenant-id="${escapeHtml(row.tenantId)}" data-subscription-id="${escapeHtml(trimText(subscription.id, 160))}" data-plan-id="${escapeHtml(trimText(subscription.planId, 120))}" data-package-id="${escapeHtml(trimText(row.packageId || subscription.packageId, 120))}" data-billing-cycle="${escapeHtml(trimText(subscription.billingCycle, 40) || 'monthly')}" data-currency="${escapeHtml(trimText(subscription.currency, 12) || 'THB')}" data-amount-cents="${escapeHtml(String(Number(subscription.amountCents) || 0))}" data-external-ref="${escapeHtml(trimText(subscription.externalRef, 200))}">เปิดการสมัครใช้งานอีกครั้ง</button>`
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
        `<td><div class="odvc4-action-row">${actionButtons || '<span class="odvc4-inline-note">ไม่มีคำสั่งเพิ่มเติม</span>'}</div></td>`,
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
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="disputed">บันทึกว่าโต้แย้งการชำระ</button>`
          : '',
        trimText(row && row.status, 40).toLowerCase() !== 'refunded'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(tenantId)}" data-invoice-id="${escapeHtml(invoiceId)}" data-target-status="refunded">บันทึกว่าเงินคืนแล้ว</button>`
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
    let html = [
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-workspace" data-owner-focus-route="subscriptions billing">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">การสมัครใช้งาน</span><h2 class="odv4-section-title">ภาพรวมการสมัครใช้งานและรายได้</h2><p class="odv4-section-copy">รวมการต่ออายุ ความเสี่ยงด้านรายได้ และสุขภาพของใบแจ้งหนี้ไว้ในหน้าเดียว เพื่อให้เจ้าของระบบตัดสินใจได้เร็วขึ้น</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'รายได้วันนี้', value: formatCurrencyCents(invoiceSummary.revenueTodayCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้ววันนี้', tone: 'success' },
        { label: 'รายได้เดือนนี้', value: formatCurrencyCents(invoiceSummary.revenueMonthCents), detail: 'ใบแจ้งหนี้ที่ชำระแล้วเดือนนี้', tone: 'info' },
        { label: 'ใบแจ้งหนี้ที่ยังเปิดอยู่', value: formatNumber(invoiceSummary.openInvoiceCount, '0'), detail: 'ใบแจ้งหนี้ที่ยังรอการชำระ', tone: invoiceSummary.openInvoiceCount ? 'warning' : 'success' },
        { label: 'การชำระเงินที่ล้มเหลว', value: formatNumber(invoiceSummary.failedPaymentCount, '0'), detail: 'รายการที่ควรตรวจสอบเพิ่มเติม', tone: invoiceSummary.failedPaymentCount ? 'danger' : 'success' },
      ])}</div>`,
      '<div class="odvc4-card-grid">',
      `<div class="odvc4-note-card" id="owner-billing-risk-spotlight" data-owner-billing-risk-spotlight><strong>Risk spotlight</strong><p>${escapeHtml(riskSpotlightItems.length ? riskSpotlightItems.join(' · ') : 'No urgent billing recovery signals right now.')}</p></div>`,
      `<div class="odvc4-note-card" data-owner-billing-export-actions><strong>Export billing evidence</strong><p>${escapeHtml(`${formatNumber(invoices.length, '0')} invoices and ${formatNumber(paymentAttempts.length, '0')} payment attempts are available for export.`)}</p><div class="odvc4-action-row"><a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${billingExportBaseUrl}?format=csv`)}" download>Export CSV</a><a class="odv4-button odv4-button-secondary" href="${escapeHtml(`${billingExportBaseUrl}?format=json`)}" download>Export JSON</a></div></div>`,
      '</div>',
      recoveryQueuePanel,
      '<div class="odvc4-note-card" id="owner-subscriptions-expiring-note"><strong>บัญชีที่ใกล้หมดอายุ</strong><p>',
      expiringRows.length
        ? escapeHtml(expiringRows.slice(0, 3).map((row) => `${row.name} · ${formatDateTime(row.renewsAt)}`).join(' · '))
        : 'ยังไม่มีการสมัครใช้รายการใดที่จะหมดอายุใน 14 วันข้างหน้า',
      '</p></div>',
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-actions">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">งานหลัก</span><h2 class="odv4-section-title">อัปเดตการต่ออายุได้จากหน้านี้ทันที</h2><p class="odv4-section-copy">จัดการบัญชีที่ใกล้หมดอายุ ค้างชำระ หรือมีความเสี่ยงก่อน แล้วค่อยเปิดประวัติลูกค้าเมื่อจำเป็นต้องดูรายละเอียดเพิ่ม</p></div>',
      `<div class="odvc4-card-grid">${quickForms || '<div class="odvc4-note-card"><strong>ยังไม่มีประวัติลูกค้า</strong><p>สร้างลูกค้ารายแรกก่อน แล้วค่อยจัดการการสมัครใช้จากหน้านี้</p></div>'}</div>`,
      '</section>',
      '<section class="odv4-panel odvc4-panel" id="owner-subscriptions-registry-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Subscription registry</span><h2 class="odv4-section-title">Review the subscription registry</h2><p class="odv4-section-copy">Inspect package, billing cycle, renewal timing, and current value without mixing invoice or payment-attempt work.</p></div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table"><thead><tr><th>ลูกค้า</th><th>แพ็กเกจ</th><th>สถานะ</th><th>รอบชำระ</th><th>ต่ออายุเมื่อ</th><th>จำนวนเงิน</th><th>การทำงาน</th></tr></thead><tbody>',
      subscriptionTableRows || '<tr><td colspan="7">ยังไม่มีรายการการสมัครใช้</td></tr>',
      '</tbody></table></div>',
      '</section>',
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
    const workspaceMode = resolveOwnerBillingWorkspaceMode(settings && settings.currentRoute);
    if (workspaceMode === 'subscriptions') {
      html = stripDirectElementById(html, 'owner-billing-risk-spotlight');
      html = stripDirectElementById(html, 'owner-billing-export-actions');
      html = stripDirectSectionById(html, 'owner-billing-recovery-queue');
      html = stripDirectSectionById(html, 'owner-subscriptions-registry-workspace');
      html = stripDirectSectionById(html, 'owner-billing-invoices-workspace');
      html = stripDirectSectionById(html, 'owner-billing-attempts-workspace');
      return html.replace('data-owner-focus-route="subscriptions billing"', 'data-owner-focus-route="subscriptions renewal customer-success"');
    }
    if (workspaceMode === 'registry') {
      html = stripDirectElementById(html, 'owner-billing-risk-spotlight');
      html = stripDirectElementById(html, 'owner-billing-export-actions');
      html = stripDirectElementById(html, 'owner-subscriptions-expiring-note');
      html = stripDirectSectionById(html, 'owner-billing-recovery-queue');
      html = stripNestedSectionBeforeSibling(html, 'owner-subscriptions-actions', 'owner-subscriptions-registry-workspace');
      html = stripDirectSectionById(html, 'owner-billing-invoices-workspace');
      html = stripDirectSectionById(html, 'owner-billing-attempts-workspace');
      return html.replace('data-owner-focus-route="subscriptions billing"', 'data-owner-focus-route="subscriptions registry"');
    }
    if (workspaceMode === 'recovery') {
      html = stripDirectElementById(html, 'owner-billing-risk-spotlight');
      html = stripDirectElementById(html, 'owner-billing-export-actions');
      html = stripDirectElementById(html, 'owner-subscriptions-expiring-note');
      html = stripDirectSectionById(html, 'owner-subscriptions-actions');
      html = stripDirectSectionById(html, 'owner-subscriptions-registry-workspace');
      html = stripDirectSectionById(html, 'owner-billing-invoices-workspace');
      html = stripDirectSectionById(html, 'owner-billing-attempts-workspace');
      return html.replace('data-owner-focus-route="subscriptions billing"', 'data-owner-focus-route="billing recovery attempts"');
    }
    html = stripNestedSectionBeforeSibling(html, 'owner-subscriptions-actions', 'owner-subscriptions-registry-workspace');
    html = stripDirectSectionById(html, 'owner-subscriptions-registry-workspace');
    if (workspaceMode === 'attempts') {
      html = stripDirectElementById(html, 'owner-billing-risk-spotlight');
      html = stripDirectElementById(html, 'owner-billing-export-actions');
      html = stripDirectElementById(html, 'owner-subscriptions-expiring-note');
      html = stripDirectSectionById(html, 'owner-billing-recovery-queue');
      html = stripDirectSectionById(html, 'owner-billing-invoices-workspace');
      return html.replace('data-owner-focus-route="subscriptions billing"', 'data-owner-focus-route="billing attempts"');
    }
    html = stripDirectElementById(html, 'owner-subscriptions-expiring-note');
    html = stripDirectSectionById(html, 'owner-billing-recovery-queue');
    html = stripDirectSectionById(html, 'owner-billing-attempts-workspace');
    return html.replace('data-owner-focus-route="subscriptions billing"', 'data-owner-focus-route="billing invoices"');
  }

  function renderSettingsWorkspaceV2(state, settings) {
    const overview = state.overview && typeof state.overview === 'object' ? state.overview : {};
    const billingProvider = state.billingOverview && state.billingOverview.provider && typeof state.billingOverview.provider === 'object'
      ? state.billingOverview.provider
      : {};
    const automationConfig = overview.automationConfig && typeof overview.automationConfig === 'object'
      ? overview.automationConfig
      : {};
    const automationState = overview.automationState && typeof overview.automationState === 'object'
      ? overview.automationState
      : {};
    const opsState = overview.opsState && typeof overview.opsState === 'object'
      ? overview.opsState
      : {};
    const automationPreview = settings && settings.automationPreview && typeof settings.automationPreview === 'object'
      ? settings.automationPreview
      : null;
    const automationRecoveryRows = buildAutomationRecoveryRows(automationState);
    const workspaceMode = resolveOwnerSettingsWorkspaceMode(settings && settings.currentRoute);
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
    const automationPanel = [
      '<section class="odv4-panel odvc4-panel" id="owner-settings-automation-workspace">',
      '<div class="odv4-section-head"><span class="odv4-section-kicker">Automation Rules</span><h2 class="odv4-section-title">Automation rules and recovery</h2><p class="odv4-section-copy">Review shared automation posture, inspect recent recovery outcomes, and run a dry-run preview before forcing a live shared cycle.</p></div>',
      `<div class="odvc4-metric-grid">${renderMetricCards([
        { label: 'Automation', value: automationConfig.enabled === false ? 'Disabled' : 'Enabled', detail: `Max ${formatNumber(automationConfig.maxActionsPerCycle || 0, '0')} actions per cycle`, tone: automationConfig.enabled === false ? 'warning' : 'success' },
        { label: 'Last cycle', value: automationState.lastAutomationAt ? formatDateTime(automationState.lastAutomationAt) : 'Not recorded', detail: `Force monitoring ${automationState.lastForcedMonitoringAt ? formatDateTime(automationState.lastForcedMonitoringAt) : 'not recorded'}`, tone: 'info' },
        { label: 'Recovery keys', value: formatNumber(automationRecoveryRows.length, '0'), detail: `Cooldown ${formatNumber(Math.round((automationConfig.recoveryCooldownMs || 0) / 1000), '0')} sec`, tone: automationRecoveryRows.length ? 'warning' : 'muted' },
        { label: 'Platform monitoring', value: opsState.lastMonitoringAt ? formatDateTime(opsState.lastMonitoringAt) : 'Not recorded', detail: `Attempts/runtime ${formatNumber(automationConfig.maxAttemptsPerRuntime || 0, '0')}`, tone: 'info' },
      ])}</div>`,
      '<div class="odvc4-card-grid">',
      `<div class="odvc4-note-card"><strong>Current policy</strong><p>Restart services: ${escapeHtml(Array.isArray(automationConfig.restartServices) ? automationConfig.restartServices.join(', ') : '-')} · Monitoring after recovery: ${escapeHtml(automationConfig.runMonitoringAfterRecovery === false ? 'No' : 'Yes')}</p></div>`,
      '<div class="odvc4-note-card"><strong>Operator guidance</strong><p>Use dry-run first when the supervisor shows stale or degraded runtimes. Force a live cycle only when you are ready for managed-service restarts on the shared control plane.</p></div>',
      '</div>',
      '<div class="odvc4-action-row">',
      '<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="run-platform-automation" data-dry-run="true">Dry-run preview</button>',
      '<button class="odv4-button odv4-button-primary" type="button" data-owner-action="run-platform-automation" data-dry-run="false">Run automation now</button>',
      '</div>',
      '<div class="odvc4-table-wrap"><table class="odvc4-table" data-owner-automation-recovery><thead><tr><th>Service</th><th>Latest result</th><th>Runtime state</th><th>Recorded at</th></tr></thead><tbody>',
      renderAutomationRecoveryTable(automationRecoveryRows),
      '</tbody></table></div>',
      renderAutomationPreview(automationPreview),
      '</section>',
    ].join('');
    let html = [
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
      automationPanel,
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
    if (workspaceMode === 'control') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings control automation"');
    }
    if (workspaceMode === 'admin-users') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-managed-services');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings admin-users access-control"');
    }
    if (workspaceMode === 'services') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings services managed-runtime"');
    }
    if (workspaceMode === 'automation') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      html = stripDirectSectionById(html, 'owner-settings-managed-services');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings automation control"');
    }
    if (workspaceMode === 'access-policy') {
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      html = stripDirectSectionById(html, 'owner-settings-managed-services');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings access-policy security"');
    }
    if (workspaceMode === 'portal-policy') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      html = stripDirectSectionById(html, 'owner-settings-managed-services');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings portal-policy player-portal"');
    }
    if (workspaceMode === 'billing-policy') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      html = stripDirectSectionById(html, 'owner-settings-managed-services');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings billing-policy commercial"');
    }
    if (workspaceMode === 'runtime-policy') {
      html = stripDirectSectionById(html, 'owner-settings-access-policy');
      html = stripDirectSectionById(html, 'owner-settings-portal-policy');
      html = stripDirectSectionById(html, 'owner-settings-billing-policy');
      html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
      html = stripDirectSectionById(html, 'owner-settings-admin-users');
      html = stripDirectSectionById(html, 'owner-settings-managed-services');
      return html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings runtime-policy orchestration"');
    }
    html = stripDirectSectionById(html, 'owner-settings-access-policy');
    html = stripDirectSectionById(html, 'owner-settings-portal-policy');
    html = stripDirectSectionById(html, 'owner-settings-billing-policy');
    html = stripDirectSectionById(html, 'owner-settings-runtime-policy');
    html = stripDirectSectionById(html, 'owner-settings-automation-workspace');
    html = stripDirectSectionById(html, 'owner-settings-admin-users');
    html = stripDirectSectionById(html, 'owner-settings-managed-services');
    html = html.replace('data-owner-focus-route="settings"', 'data-owner-focus-route="settings overview governance"');
    return html;
  }

  function escapeOwnerControlPattern(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function stripNestedSectionBeforeSibling(html, id, nextId) {
    const pattern = new RegExp(
      `<section class="odv4-panel odvc4-panel" id="${escapeOwnerControlPattern(id)}"(?:\\s+[^>]*)?>[\\s\\S]*?(?=<section class="odv4-panel odvc4-panel" id="${escapeOwnerControlPattern(nextId)}"(?:\\s+[^>]*)?>)`,
      'g'
    );
    return String(html || '').replace(pattern, '');
  }

  function stripDirectSectionById(html, id) {
    const pattern = new RegExp(`<section class="odv4-panel odvc4-panel" id="${escapeOwnerControlPattern(id)}"(?:\\s+[^>]*)?>[\\s\\S]*?<\\/section>`, 'g');
    return String(html || '').replace(pattern, '');
  }

  function stripDirectElementById(html, id) {
    const pattern = new RegExp(`<([a-z0-9:-]+)([^>]*?)\\sid="${escapeOwnerControlPattern(id)}"(?:\\s+[^>]*)?>[\\s\\S]*?<\\/\\1>`, 'gi');
    return String(html || '').replace(pattern, '');
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
      const isRevenueRoute = routeKind === 'subscriptions'
        || routeKind === 'subscriptions-registry'
        || routeKind === 'subscription-detail'
        || routeKind === 'billing'
        || routeKind === 'billing-recovery'
        || routeKind === 'billing-attempts'
        || routeKind === 'invoice-detail'
        || routeKind === 'attempt-detail';
      const isRuntimeRoute = routeKind === 'runtime'
        || routeKind === 'runtime-create-server'
        || routeKind === 'runtime-provision-runtime'
        || routeKind === 'incidents'
        || routeKind === 'jobs'
        || routeKind === 'support'
        || routeKind === 'agents-bots'
        || routeKind === 'fleet-diagnostics';
      const isAuditRoute = routeKind === 'audit' || routeKind === 'security' || routeKind === 'access' || routeKind === 'diagnostics';
      const isSettingsRoute = routeKind === 'settings'
        || routeKind === 'control'
        || routeKind === 'automation'
        || routeKind === 'settings-admin-users'
        || routeKind === 'settings-services'
        || routeKind === 'settings-access-policy'
        || routeKind === 'settings-portal-policy'
        || routeKind === 'settings-billing-policy'
        || routeKind === 'settings-runtime-policy';
      let headerAction = { label: 'Create tenant', href: '#owner-control-workspace', localFocus: true };

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
        headerAction = { label: 'Open tenant form', href: '#owner-tenant-detail-form', localFocus: true };
      } else if (routeKind === 'support-detail') {
        sections.push(renderTenantSupportWorkspaceLive(
          selectedTenant,
          selectedSupportCase,
          runtimeRows,
          selectedSupportDeadLetters,
          settings.supportCaseLoading === true,
          settings.supportDeadLettersLoading === true,
        ));
        headerAction = { label: 'Open support case', href: '#owner-tenant-support-workspace', localFocus: true };
      } else if (routeKind === 'packages' || routeKind === 'packages-create' || routeKind === 'packages-entitlements' || routeKind === 'package-detail') {
        sections.push(renderPackagesWorkspace(packageUsageRows, featureCatalog, settings));
        headerAction = routeKind === 'packages-create'
          ? { label: 'Open package form', href: '#owner-packages-create-form', localFocus: true }
          : routeKind === 'packages-entitlements'
            ? { label: 'Open entitlement matrix', href: '#owner-packages-entitlements-workspace', localFocus: true }
            : { label: 'Open package catalog', href: '#owner-packages-workspace', localFocus: true };
      } else if (isRevenueRoute) {
        sections.push(renderSubscriptionsWorkspaceV3(
          buildExpiringRows(tenantRows),
          invoiceSummary,
          tenantRows,
          packageCatalog,
          planOptions,
          state.billingInvoices,
          state.billingPaymentAttempts,
          settings,
        ));
        headerAction = routeKind === 'subscriptions-registry' || routeKind === 'subscription-detail'
          ? { label: 'Open subscription registry', href: '#owner-subscriptions-registry-workspace', localFocus: true }
          : routeKind === 'billing-recovery'
            ? { label: 'Open billing recovery queue', href: '#owner-billing-recovery-queue', localFocus: true }
          : routeKind === 'billing-attempts' || routeKind === 'attempt-detail'
            ? { label: 'Open payment attempts', href: '#owner-billing-attempts-workspace', localFocus: true }
            : routeKind === 'billing' || routeKind === 'invoice-detail'
              ? { label: 'Open invoice workspace', href: '#owner-billing-invoices-workspace', localFocus: true }
              : { label: 'Open subscription actions', href: '#owner-subscriptions-actions', localFocus: true };
      } else if (routeKind === 'recovery' || routeKind === 'recovery-create' || routeKind === 'recovery-preview' || routeKind === 'recovery-restore' || routeKind === 'recovery-history') {
        sections.push(renderRecoveryWorkspaceV2(state, settings));
        headerAction = routeKind === 'recovery-create'
          ? { label: 'Open backup creation', href: '#owner-recovery-create-workspace', localFocus: true }
          : routeKind === 'recovery-preview'
            ? { label: 'Open restore preview', href: '#owner-recovery-preview-workspace', localFocus: true }
            : routeKind === 'recovery-restore'
              ? { label: 'Open guarded restore', href: '#owner-recovery-restore-workspace', localFocus: true }
              : routeKind === 'recovery-history'
                ? { label: 'Open restore history', href: '#owner-recovery-history-workspace', localFocus: true }
                : { label: 'Open recovery workspace', href: '#owner-recovery-workspace', localFocus: true };
      } else if (isRuntimeRoute) {
        sections.push(renderRuntimeWorkspace(state, runtimeRows, selectedRuntime, settings));
        const runtimeWorkspaceMode = resolveOwnerRuntimeWorkspaceMode(rawRoute);
        if (runtimeWorkspaceMode === 'create-server') {
          headerAction = { label: 'Open create server form', href: '#owner-runtime-server-workspace', localFocus: true };
        } else if (runtimeWorkspaceMode === 'provision') {
          headerAction = { label: 'Open provisioning form', href: '#owner-runtime-provisioning-workspace', localFocus: true };
        } else if (runtimeWorkspaceMode === 'jobs') {
          headerAction = { label: 'Open shared operations', href: '#owner-runtime-shared-ops', localFocus: true };
        } else if (runtimeWorkspaceMode === 'overview') {
          headerAction = { label: 'Open runtime overview', href: '#owner-runtime-route-summary', localFocus: true };
        } else {
          headerAction = { label: 'Open runtime registry', href: '#owner-runtime-workspace', localFocus: true };
        }
      } else if (routeKind === 'analytics' || routeKind === 'analytics-risk' || routeKind === 'analytics-packages') {
        sections.push(renderAnalyticsWorkspaceV2(state, packageUsageRows, runtimeRows, invoiceSummary, settings));
        headerAction = routeKind === 'analytics-risk'
          ? { label: 'Open risk queue', href: '#owner-risk-queue', localFocus: true }
          : routeKind === 'analytics-packages'
            ? { label: 'Open package usage', href: '#owner-analytics-packages-workspace', localFocus: true }
            : { label: 'Open analytics workspace', href: '#owner-analytics-workspace', localFocus: true };
      } else if (isAuditRoute) {
        const workspaceMode = resolveOwnerAuditWorkspaceMode(rawRoute);
        sections.push(renderAuditWorkspaceV2(state, settings));
        if (workspaceMode === 'diagnostics') {
          sections.push(renderAuditExportWorkbench(state));
        }
        headerAction = { label: 'Open audit workspace', href: '#owner-audit-workspace', localFocus: true };
      } else if (isSettingsRoute) {
        sections.push(renderSettingsWorkspaceV2(state, settings));
        headerAction = routeKind === 'automation'
          ? { label: 'Open automation workspace', href: '#owner-settings-automation-workspace', localFocus: true }
          : routeKind === 'settings-admin-users'
            ? { label: 'Open admin users', href: '#owner-settings-admin-users', localFocus: true }
            : routeKind === 'settings-services'
              ? { label: 'Open managed services', href: '#owner-settings-managed-services', localFocus: true }
            : routeKind === 'settings-access-policy'
              ? { label: 'Open access policy', href: '#owner-settings-access-policy', localFocus: true }
            : routeKind === 'settings-portal-policy'
              ? { label: 'Open portal policy', href: '#owner-settings-portal-policy', localFocus: true }
            : routeKind === 'settings-billing-policy'
              ? { label: 'Open billing policy', href: '#owner-settings-billing-policy', localFocus: true }
            : routeKind === 'settings-runtime-policy'
              ? { label: 'Open runtime policy', href: '#owner-settings-runtime-policy', localFocus: true }
          : routeKind === 'control'
            ? { label: 'Open platform controls', href: '#owner-settings-managed-services', localFocus: true }
            : { label: 'Open platform settings', href: '#owner-settings-workspace', localFocus: true };
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
