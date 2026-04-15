(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerVNext = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    {
      title: 'Platform',
      items: [
        { label: 'Overview', href: '/owner', routes: ['overview', 'dashboard'] },
        { label: 'Tenants', href: '/owner/tenants', routes: ['tenants'] },
        { label: 'Packages', href: '/owner/packages', routes: ['packages'] },
        { label: 'Subscriptions', href: '/owner/subscriptions', routes: ['subscriptions'] },
        { label: 'Billing', href: '/owner/billing', routes: ['billing'] },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Runtime health', href: '/owner/runtime', routes: ['runtime', 'runtime-health'] },
        { label: 'Incidents', href: '/owner/incidents', routes: ['incidents'] },
        { label: 'Observability', href: '/owner/analytics', routes: ['observability', 'analytics'] },
        { label: 'Queues & jobs', href: '/owner/jobs', routes: ['jobs'] },
        { label: 'Support', href: '/owner/support', routes: ['support'] },
      ],
    },
    {
      title: 'Governance',
      items: [
        { label: 'Audit', href: '/owner/audit', routes: ['audit'] },
        { label: 'Security', href: '/owner/security', routes: ['security'] },
        { label: 'Access', href: '/owner/access', routes: ['access'] },
        { label: 'Diagnostics', href: '/owner/diagnostics', routes: ['diagnostics'] },
        { label: 'Settings', href: '/owner/settings', routes: ['settings'] },
        { label: 'Platform controls', href: '/owner/control', routes: ['control'] },
        { label: 'Recovery', href: '/owner/recovery', routes: ['recovery'] },
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

  function trimText(value, maxLen = 240) {
    const text = String(value ?? '').trim();
    return !text ? '' : text.slice(0, maxLen);
  }

  function currentLocale() {
    const rawLocale = trimText(
      globalThis.document?.getElementById?.('ownerLanguageSelect')?.value
      || globalThis.AdminUiI18n?.getLocale?.()
      || globalThis.document?.documentElement?.lang
      || '',
      32
    ).toLowerCase();
    return rawLocale.startsWith('th') ? 'th' : 'en';
  }

  function currentIntlLocale() {
    return currentLocale() === 'th' ? 'th-TH' : 'en-US';
  }

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

  function repairMojibakeText(value) {
    const text = String(value ?? '');
    if (!text) return '';
    if (!/(\u00C3|\u00C2|\u00E0|\u00E2)/.test(text)) return text;
    if (typeof globalThis.TextDecoder !== 'function') return text;
    try {
      const bytes = Uint8Array.from(Array.from(text, (char) => {
        const codePoint = char.codePointAt(0);
        return CP1252_REVERSE_MAP.get(codePoint) ?? (codePoint & 0xff);
      }));
      const decoded = new globalThis.TextDecoder('utf-8').decode(bytes);
      return /[\u0E00-\u0E7F]/.test(decoded) ? decoded : text;
    } catch {
      return text;
    }
  }

  function ownerText(english, thai) {
    return currentLocale() === 'th'
      ? repairMojibakeText(thai)
      : repairMojibakeText(english);
  }

  const OWNER_LITERAL_TRANSLATIONS = {
    th: {
      'Tenants and commercial posture': 'ลูกค้าและภาพรวมเชิงพาณิชย์',
      'Commercial and tenant registry': 'ทะเบียนลูกค้าและสถานะเชิงพาณิชย์',
      'Package governance': 'กำกับดูแลแพ็กเกจ',
      'Revenue and billing operations': 'รายได้และปฏิบัติการด้านการเงิน',
      'Billing operations': 'ปฏิบัติการด้านการเงิน',
      'Runtime health and fleet posture': 'สถานะรันไทม์และความพร้อมของฟลีต',
      'Runtime command': 'ศูนย์สั่งการรันไทม์',
      'Incidents and active signals': 'เหตุการณ์และสัญญาณที่กำลังเกิดขึ้น',
      'Incident command': 'ศูนย์สั่งการเหตุการณ์',
      'Requests, latency, and telemetry': 'คำขอ ความหน่วง และเทเลเมทรี',
      'Queues, provisioning, and runtime backlog': 'คิว การ provision และงานค้างของรันไทม์',
      'Runtime queues': 'คิวของรันไทม์',
      'Support command': 'ศูนย์สั่งการงานดูแลลูกค้า',
      'Audit log and operator sessions': 'บันทึกตรวจสอบและเซสชันผู้ปฏิบัติงาน',
      'Security and access posture': 'สถานะความปลอดภัยและสิทธิ์เข้าถึง',
      'Security posture': 'สถานะความปลอดภัย',
      'Backup, restore, and recovery': 'สำรองข้อมูล กู้คืน และฟื้นฟูระบบ',
      'Maintenance and recovery': 'บำรุงรักษาและกู้คืน',
      Platform: 'แพลตฟอร์ม',
      Overview: 'ภาพรวม',
      Tenants: 'ลูกค้า',
      Packages: 'แพ็กเกจ',
      Subscriptions: 'การสมัครใช้',
      Operations: 'ปฏิบัติการ',
      'Runtime health': 'สถานะบริการ',
      Incidents: 'เหตุการณ์',
      Observability: 'การเฝ้าระวัง',
      'Queues & jobs': 'คิวและงาน',
      Support: 'งานดูแลลูกค้า',
      Governance: 'กำกับดูแล',
      Audit: 'ตรวจสอบ',
      Security: 'ความปลอดภัย',
      Settings: 'ตั้งค่า',
      Recovery: 'กู้คืน',
      Billing: 'การเงิน',
      Access: 'สิทธิ์เข้าถึง',
      Diagnostics: 'การวินิจฉัย',
      'Owner control plane': 'ศูนย์ควบคุมเจ้าของระบบ',
      'SCUM Operator': 'ศูนย์ปฏิบัติการ SCUM',
      'Production-safe frontend layer over the existing Owner routes, auth, and API contracts.': 'ชั้น UI ใหม่ที่ยังคงใช้เส้นทาง สิทธิ์เข้าใช้งาน และสัญญา API เดิมของฝั่งเจ้าของระบบทั้งหมด',
      'Platform watch': 'สถานะแพลตฟอร์ม',
      'Commercial watch': 'สถานะเชิงพาณิชย์',
      'Runtime split': 'แยกรันไทม์',
      'Partial data loaded': 'โหลดข้อมูลได้บางส่วน',
      'No recent signal': 'ยังไม่มีสัญญาณล่าสุด',
      'No timestamp': 'ไม่มีเวลาอ้างอิง',
      'Within normal usage': 'การใช้งานอยู่ในเกณฑ์ปกติ',
      'No outstanding': 'ไม่มีค้างชำระ',
      'No description provided.': 'ยังไม่มีรายละเอียด',
      'Support context loaded.': 'โหลดบริบทงานดูแลลูกค้าแล้ว',
      'Selected tenant': 'ลูกค้าที่เลือก',
      'Tenant dossier': 'แฟ้มข้อมูลลูกค้า',
      'Open tenant controls': 'เปิดเครื่องมือลูกค้า',
      'Support context': 'บริบทงานดูแลลูกค้า',
      'Customer support dossier': 'แฟ้มงานดูแลลูกค้า',
      'Open support actions': 'เปิดคำสั่งงานดูแลลูกค้า',
      'Platform overview': 'ภาพรวมแพลตฟอร์ม',
      'Open tenant registry': 'เปิดทะเบียนลูกค้า',
      'Packages and entitlements': 'แพ็กเกจและสิทธิ์ใช้งาน',
      'Edit package catalog': 'แก้ไขแค็ตตาล็อกแพ็กเกจ',
      'Support and diagnostics': 'งานดูแลลูกค้าและวินิจฉัย',
      'Focus support lane': 'โฟกัสช่องงานดูแลลูกค้า',
      'Settings and automation': 'ตั้งค่าและระบบอัตโนมัติ',
      'Platform policy': 'นโยบายแพลตฟอร์ม',
      'Shared settings and automation': 'การตั้งค่ากลางและระบบอัตโนมัติ',
      'Review env policy, managed services, admin users, and automation posture while keeping the current backend contract intact.': 'ทบทวนนโยบาย env บริการที่จัดการอยู่ บัญชีผู้ดูแล และสถานะระบบอัตโนมัติ โดยยังคงสัญญา backend เดิมไว้',
      'Platform controls': 'การควบคุมแพลตฟอร์ม',
      'Open platform controls': 'เปิดการควบคุมแพลตฟอร์ม',
      'Tenant onboarding': 'การเริ่มต้นลูกค้าใหม่',
      'Create and activate tenant': 'สร้างและเปิดใช้งานลูกค้า',
      'Start new tenant creation here, then use the existing owner control workspace for the real mutation and activation flow.': 'เริ่มสร้างลูกค้าใหม่จากหน้านี้ แล้วใช้ workspace เดิมของ Owner สำหรับการบันทึกและเปิดใช้งานจริง',
      'Open create-tenant controls': 'เปิดฟอร์มสร้างลูกค้า',
      'Tenants, packages, and renewals': 'ลูกค้า แพ็กเกจ และการต่ออายุ',
      'Use one surface for customer records, plan assignment, billing watchlists, and tenant-specific follow-through.': 'ใช้หน้าจอนี้รวมข้อมูลลูกค้า การผูกแผน รายการเฝ้าระวังการเงิน และงานติดตามของลูกค้าแต่ละรายไว้ในที่เดียว',
      'Plans and entitlements': 'แผนและสิทธิ์ใช้งาน',
      'Review package definitions, feature exposure, and how many tenants each plan actually touches before you change it.': 'ทบทวนคำนิยามแพ็กเกจ ฟีเจอร์ที่เปิดใช้ และจำนวนลูกค้าที่ได้รับผลกระทบจริงก่อนแก้ไขแผน',
      'Invoices and payment attempts': 'ใบแจ้งหนี้และความพยายามชำระเงิน',
      'Inspect invoice state, payment attempts, checkout recovery, and outstanding balances in one place.': 'ตรวจสถานะใบแจ้งหนี้ ความพยายามชำระเงิน การกู้คืนขั้นตอนจ่ายเงิน และยอดค้างในจุดเดียว',
      'Delivery Agents and Server Bots': 'บอตส่งของและบอตเซิร์ฟเวอร์',
      'Live platform anomalies': 'ความผิดปกติของแพลตฟอร์มที่กำลังเกิดขึ้น',
      'Request and delivery telemetry': 'เทเลเมทรีของคำขอและการส่งของ',
      'Provisioning and delivery execution': 'การ provision และการประมวลผลงานส่งของ',
      'Evidence export and platform review': 'การส่งออกหลักฐานและการทบทวนแพลตฟอร์ม',
      'Sessions and access evidence': 'เซสชันและหลักฐานสิทธิ์เข้าถึง',
      'Shared settings and service controls': 'การตั้งค่ากลางและการควบคุมบริการ',
      'Use dry-run restore previews, backup inventory, and recent restore history before applying shared recovery actions.': 'ใช้พรีวิวการกู้คืนแบบ dry-run รายการแบ็กอัป และประวัติการกู้คืนล่าสุดก่อนสั่งงานกู้คืนจริง',
      'All tenants': 'ลูกค้าทั้งหมด',
      'This table stays dense on purpose: it is the fastest path from tenant status to the next owner action.': 'ตารางนี้ตั้งใจให้ข้อมูลแน่น เพื่อให้ไล่จากสถานะลูกค้าไปยังการตัดสินใจถัดไปของเจ้าของระบบได้เร็วที่สุด',
      'Active plan definitions': 'แพ็กเกจที่เปิดใช้งานอยู่',
      'Feature exposure across plans': 'การเปิดใช้ฟีเจอร์ในแต่ละแผน',
      'Invoice watchlist': 'รายการใบแจ้งหนี้ที่ต้องเฝ้าดู',
      'Use invoice state and payment attempts to decide whether the problem is billing, entitlement, or support.': 'ใช้สถานะใบแจ้งหนี้และประวัติการชำระเงินเพื่อตัดสินใจว่าปัญหาอยู่ที่การเงิน สิทธิ์ใช้งาน หรือซัพพอร์ต',
      'Payment attempts stay visible next to invoice state so the Owner can recover revenue without changing the backend billing flow.': 'แสดงความพยายามชำระเงินไว้ข้างสถานะใบแจ้งหนี้ เพื่อให้กู้รายได้ได้โดยไม่ต้องเปลี่ยนขั้นตอนการเงินของระบบหลังบ้าน',
      'Delivery Agents': 'บอตส่งของ',
      'Server Bots': 'บอตเซิร์ฟเวอร์',
      'Request errors': 'คำขอที่ผิดพลาด',
      'Queues and jobs': 'คิวและงาน',
      'Provisioning, queue pressure, and dead letters': 'การ provision แรงกดดันของคิว และงานตกค้าง',
      'In flight': 'กำลังดำเนินการ',
      'No queue watch rows are currently loaded.': 'ยังไม่มีข้อมูลคิวที่โหลดเข้ามา',
      'No dead-letter rows are currently loaded.': 'ยังไม่มีข้อมูลงานตกค้างที่โหลดเข้ามา',
      'Delivery Agent fleet': 'ฟลีตบอตส่งของ',
      'These rows stay focused on delivery execution, game-client-side readiness, and token / device actionability.': 'ตารางนี้โฟกัสเฉพาะการส่งของ ความพร้อมของฝั่งเกมไคลเอนต์ และการใช้งาน token / device',
      'No Delivery Agent records are loaded.': 'ยังไม่มีข้อมูลบอตส่งของที่โหลดเข้ามา',
      'Server Bot fleet': 'ฟลีตบอตเซิร์ฟเวอร์',
      'These rows stay focused on server-side runtime health, binding state, and restart / sync readiness.': 'ตารางนี้โฟกัสเฉพาะสุขภาพรันไทม์ฝั่งเซิร์ฟเวอร์ สถานะการผูกเครื่อง และความพร้อมด้านรีสตาร์ต / ซิงก์',
      'No Server Bot records are loaded.': 'ยังไม่มีข้อมูลบอตเซิร์ฟเวอร์ที่โหลดเข้ามา',
      'Incident feed': 'ฟีดเหตุการณ์',
      'Recent platform anomalies': 'ความผิดปกติของแพลตฟอร์มล่าสุด',
      'Telemetry': 'เทเลเมทรี',
      'Requests and error hotspots': 'คำขอและจุดผิดพลาดที่ควรจับตา',
      'Optional observability reads hydrate this section without blocking the rest of the Owner surface.': 'ข้อมูลการเฝ้าระวังแบบเลือกโหลดจะเข้ามาเติมส่วนนี้โดยไม่ขวางการใช้งานส่วนอื่นของหน้าเจ้าของระบบ',
      'No overdue, poison-candidate, or dead-letter pressure was detected in the sampled lifecycle state.': 'ไม่พบแรงกดดันจากงานเลยเวลา งานเสี่ยงเสีย หรือ dead letter ในตัวอย่างสถานะ lifecycle ล่าสุด',
      'Admin sessions': 'เซสชันผู้ดูแล',
      'Currently loaded sessions': 'เซสชันที่โหลดอยู่ตอนนี้',
      'Export and retention': 'การส่งออกและการเก็บรักษา',
      'Observability export': 'ส่งออกข้อมูลการเฝ้าระวัง',
      'Export platform-wide request pressure and metrics snapshots for investigations or retention handoff.': 'ส่งออกแรงกดดันของคำขอและ snapshot ของ metric ทั้งแพลตฟอร์มไว้ใช้สืบค้นหรือส่งต่อการเก็บรักษา',
      'Security evidence export': 'ส่งออกหลักฐานด้านความปลอดภัย',
      'Download security events and secret rotation checks before Owner-side reviews or incident follow-up.': 'ดาวน์โหลดเหตุการณ์ด้านความปลอดภัยและผลตรวจการหมุน secret ก่อนทบทวนหรือไล่งานเหตุการณ์ต่อ',
      Backups: 'แบ็กอัป',
      'Restore history': 'ประวัติการกู้คืน',
      'Restore preview': 'พรีวิวการกู้คืน',
      'Backup inventory': 'รายการแบ็กอัป',
      'Available backups': 'แบ็กอัปที่พร้อมใช้งาน',
      'Backups loaded from the current backend inventory.': 'แบ็กอัปที่โหลดมาจากคลังข้อมูลของระบบหลังบ้านปัจจุบัน',
      'No backups are currently loaded.': 'ยังไม่มีแบ็กอัปที่โหลดเข้ามา',
      'Recent restore operations': 'รายการกู้คืนล่าสุด',
      'Use restore history to verify whether a previous recovery already ran before launching another one.': 'ใช้ประวัติการกู้คืนตรวจสอบก่อนว่ามีการกู้คืนรอบก่อนหน้ารันไปแล้วหรือไม่ ก่อนเริ่มรอบใหม่',
      'No restore history is currently loaded.': 'ยังไม่มีประวัติการกู้คืนที่โหลดเข้ามา',
      'Use the recovery forms in the injected control workspace to create previews and apply restores safely.': 'ใช้ฟอร์มกู้คืนในพื้นที่งานควบคุมที่ฝังไว้เพื่อสร้างพรีวิวและกู้คืนอย่างปลอดภัย',
      'Review active plans before assigning a new tenant to a package.': 'ทบทวนแผนที่เปิดใช้อยู่ก่อนผูกลูกค้าใหม่เข้ากับแพ็กเกจ',
      'Use current customer posture as the baseline for onboarding.': 'ใช้สถานะลูกค้าปัจจุบันเป็นฐานเทียบก่อนเริ่ม onboarding',
      'Existing renewals often show the same package and quota questions a new tenant will ask.': 'เคสต่ออายุที่มีอยู่มักสะท้อนคำถามเรื่องแพ็กเกจและโควตาแบบเดียวกับที่ลูกค้าใหม่จะถาม',
      'Clear commercial debt before activating more load on the platform.': 'เคลียร์ภาระเชิงพาณิชย์ที่ค้างอยู่ก่อนเพิ่มโหลดใหม่ให้แพลตฟอร์ม',
      'Review abuse signals, ความผิดปกติของการส่งของ, security anomalies, and request failures from one queue before sending work back into tenant operations.': 'ตรวจสัญญาณการใช้งานผิดปกติ ความผิดปกติของการส่งของ เหตุการณ์ด้านความปลอดภัย และคำขอที่ล้มเหลวจากคิวเดียวกันก่อนส่งงานกลับไปยังฝั่งผู้เช่า',
      'Use this lane for failed delivery jobs and support-side replay decisions.': 'ใช้ส่วนนี้กับงานส่งของที่ล้มเหลวและการตัดสินใจ replay ฝั่งซัพพอร์ต',
      'No support route selected': 'ยังไม่ได้เลือกเส้นทางซัพพอร์ต',
      'Open a tenant support route to load customer evidence and follow-up controls here.': 'เปิดเส้นทางซัพพอร์ตของลูกค้าเพื่อโหลดหลักฐานและเครื่องมือติดตามงานไว้ตรงนี้',
      'Use the incident lane to decide what affects the platform now, then drill into the owning runtime or tenant.': 'ใช้ช่องเหตุการณ์เพื่อตัดสินใจก่อนว่าอะไรส่งผลต่อแพลตฟอร์มตอนนี้ แล้วค่อยเจาะไปยังรันไทม์หรือลูกค้าที่เกี่ยวข้อง',
      'Review request hotspots, delivery lag, and platform signals before escalating into a deeper recovery step.': 'ตรวจจุดร้อนของคำขอ ความล่าช้าในการส่งของ และสัญญาณของแพลตฟอร์มก่อนยกระดับไปยังขั้นตอนกู้คืนที่ลึกกว่า',
      'Track provisioning tokens, device binding, and delayed delivery work without blending runtime roles together.': 'ติดตาม token สำหรับการจัดเตรียมระบบ การผูกอุปกรณ์ และงานส่งของที่ล่าช้าโดยไม่ปะปนบทบาทของรันไทม์',
      'Review sessions, security events, and follow-up actions before revoking access or escalating an incident.': 'ตรวจเซสชัน เหตุการณ์ด้านความปลอดภัย และงานติดตามก่อนเพิกถอนสิทธิ์หรือยกระดับเหตุการณ์',
      'Keep customer context, dead letters, notifications, and evidence together before handing off to a tenant.': 'รวมบริบทลูกค้า dead letter การแจ้งเตือน และหลักฐานไว้ด้วยกันก่อนส่งงานกลับให้ผู้เช่า',
      'Inspect who changed what, which sessions are still active, and which signals need acknowledgment.': 'ตรวจว่าใครแก้อะไร เซสชันใดยังเปิดอยู่ และสัญญาณใดที่ยังรอการรับทราบ',
      'Collect request evidence, notification backlog, and export-ready diagnostics without changing the existing backend flows.': 'รวบหลักฐานคำขอ งานแจ้งเตือนค้าง และชุดวินิจฉัยที่พร้อมส่งออกโดยไม่เปลี่ยนขั้นตอนเดิมของระบบหลังบ้าน',
      'Keep service restarts, admin users, and platform-wide settings inside the existing owner control workspace.': 'รวมการรีสตาร์ตบริการ บัญชีผู้ดูแล และการตั้งค่าระดับแพลตฟอร์มไว้ในพื้นที่งานควบคุมเดิมของเจ้าของระบบ',
      'These roles remain separate in every table and action path even though they share the same Owner surface.': 'แม้จะอยู่บนหน้า Owner เดียวกัน แต่สองบทบาทนี้ยังถูกแยกชัดในทุกตารางและทุกเส้นทางคำสั่ง',
      'Current telemetry errors loaded for Owner review.': 'คำขอผิดพลาดที่โหลดไว้ให้ Owner ตรวจตอนนี้',
      'Signals still waiting for acknowledgment.': 'สัญญาณที่ยังรอการรับทราบ',
      'Owner-side telemetry anomalies currently loaded.': 'ความผิดปกติของเทเลเมทรีฝั่ง Owner ที่โหลดอยู่ตอนนี้',
      'Delivery Agent and Server Bot responsibilities remain separate in language, tables, and actions.': 'หน้าที่ของบอตส่งของและบอตเซิร์ฟเวอร์ยังถูกแยกชัดทั้งในภาษา ตาราง และคำสั่ง',
      'Incident discipline': 'วินัยการจัดการเหตุการณ์',
      'Evidence, severity, and follow-up stay visible without forcing a backend change.': 'คงมองเห็นหลักฐาน ระดับความรุนแรง และงานติดตามได้โดยไม่ต้องเปลี่ยนระบบหลังบ้าน',
      'Support posture': 'สถานะงานซัพพอร์ต',
      'Support context stays platform-scoped until you explicitly reassign back to tenant operations.': 'บริบทซัพพอร์ตจะยังอยู่ในขอบเขตแพลตฟอร์มจนกว่าจะสั่งส่งงานกลับไปฝั่งผู้เช่าอย่างชัดเจน',
      'Keep dry-run and live automation separate so the Owner can inspect impact before forcing platform actions.': 'แยก dry-run กับการรันจริงออกจากกัน เพื่อให้ Owner ตรวจผลกระทบก่อนสั่งงานระดับแพลตฟอร์ม',
      'Run dry-run': 'รันแบบ dry-run',
      'Run live automation': 'รันระบบอัตโนมัติจริง',
      'Restore preview ready': 'พรีวิวการกู้คืนพร้อมแล้ว',
      'A dry-run restore preview is loaded in memory for the current Owner session.': 'โหลดพรีวิวการกู้คืนแบบ dry-run ไว้ในหน่วยความจำของเซสชัน Owner นี้แล้ว',
      'No restore preview': 'ยังไม่มีพรีวิวการกู้คืน',
      'Dry-run preview and restore history stay visible beside the action forms.': 'พรีวิวแบบ dry-run และประวัติการกู้คืนจะแสดงคู่กับฟอร์มคำสั่งเสมอ',
      'Review abuse signals, delivery anomalies, security anomalies, and request failures from one queue before sending work back into tenant operations.': 'ตรวจสัญญาณการใช้งานผิดปกติ ความผิดปกติของการส่งของ เหตุการณ์ด้านความปลอดภัย และคำขอที่ล้มเหลวจากคิวเดียวกันก่อนส่งงานกลับไปฝั่งผู้เช่า',
      'Risk and abuse': 'ความเสี่ยงและการใช้งานผิดปกติ',
      'Delivery lifecycle risk': 'ความเสี่ยงในวงจรการส่งของ',
      'Shared delivery backlog': 'งานส่งของค้างรวม',
      'Security anomaly': 'ความผิดปกติด้านความปลอดภัย',
      'Open audit': 'เปิดหน้าออดิท',
      'Open bot health': 'เปิดหน้าสุขภาพบอต',
      'Renewals': 'การต่ออายุ',
      'Subscription watchlist': 'รายการสมัครใช้ที่ต้องจับตา',
      'Tenant operations': 'งานปฏิบัติการฝั่งลูกค้า',
      'Registry, package drift, subscription renewal, and quota pressure stay together in this workspace.': 'ทะเบียนลูกค้า ความคลาดเคลื่อนของแพ็กเกจ การต่ออายุ และแรงกดดันด้านโควตาถูกรวมไว้ใน workspace นี้',
      'Tenants with billing follow-up': 'ลูกค้าที่ต้องติดตามเรื่องการเงิน',
      'Next action': 'การดำเนินการถัดไป',
      'Customer escalation and diagnostics': 'การยกระดับเคสลูกค้าและการวินิจฉัย',
      'Keep platform-owned support evidence close to notifications and delivery backlog without leaving the Owner surface.': 'เก็บหลักฐานซัพพอร์ตระดับแพลตฟอร์มไว้ใกล้กับการแจ้งเตือนและงานส่งของค้าง โดยไม่ต้องออกจากหน้าเจ้าของระบบ',
      'Notifications remain actionable here without changing the backend notification flow.': 'การแจ้งเตือนยังดำเนินการต่อจากตรงนี้ได้ โดยไม่ต้องเปลี่ยนขั้นตอนการแจ้งเตือนของระบบหลังบ้าน',
      'Audit and sessions': 'ออดิทและเซสชัน',
      'Access and suspicious activity': 'สิทธิ์เข้าถึงและความเคลื่อนไหวที่น่าสงสัย',
      'Review active sessions, access posture, and security signals before revoking or escalating.': 'ตรวจเซสชันที่ยังใช้งานอยู่ สถานะสิทธิ์เข้าถึง และสัญญาณความปลอดภัยก่อนเพิกถอนหรือยกระดับ',
      'Backup and restore posture': 'สถานะการสำรองข้อมูลและการกู้คืน',
      'Recovery stays evidence-first: preview the restore, inspect history, then use existing backend flows for the final mutation.': 'งานกู้คืนยังยึดหลักฐานเป็นหลักเสมอ: พรีวิวก่อน ตรวจประวัติ แล้วค่อยใช้ขั้นตอนเดิมของระบบหลังบ้านกับคำสั่งจริง',
      'Recovery context': 'บริบทการกู้คืน',
      'Persist Require DB': 'บังคับใช้ฐานข้อมูล',
      'Require database persistence at bot · บันทึกแล้วต้องรีสตาร์ต': 'บังคับให้บอตใช้การจัดเก็บผ่านฐานข้อมูล · บันทึกแล้วต้องรีสตาร์ต',
      'Persist Legacy Snapshots': 'เก็บ snapshot แบบเก่า',
      'Allow legacy file snapshots · บันทึกแล้วต้องรีสตาร์ต': 'อนุญาตให้ใช้ snapshot แบบไฟล์เดิม · บันทึกแล้วต้องรีสตาร์ต',
      'Delivery Execution Mode': 'โหมดประมวลผลงานส่งของ',
      'Delivery backend selection: rcon or agent · บันทึกแล้วต้องรีสตาร์ต': 'เลือกกลไกการส่งของระหว่าง rcon หรือ agent · บันทึกแล้วต้องรีสตาร์ต',
      'Treat console-agent readiness as required · บันทึกแล้วต้องรีสตาร์ต': 'ถือว่าความพร้อมของ console-agent เป็นเงื่อนไขบังคับ · บันทึกแล้วต้องรีสตาร์ต',
      'Treat watcher readiness as required · บันทึกแล้วต้องรีสตาร์ต': 'ถือว่าความพร้อมของ watcher เป็นเงื่อนไขบังคับ · บันทึกแล้วต้องรีสตาร์ต',
      'Platform Public Base URL': 'URL หลักสาธารณะของแพลตฟอร์ม',
      'Canonical public URL used in billing and shared platform redirects · บันทึกแล้วรีโหลดได้ทันที': 'URL สาธารณะหลักที่ใช้กับขั้นตอนการเงินและการเปลี่ยนเส้นทางร่วมของแพลตฟอร์ม · บันทึกแล้วรีโหลดได้ทันที',
      'Platform billing Stripe Publishable Key': 'Stripe Publishable Key ของระบบการเงินแพลตฟอร์ม',
      'Stripe publishable key exposed to checkout flows · บันทึกแล้วรีโหลดได้ทันที': 'Stripe publishable key ที่ใช้กับขั้นตอน checkout · บันทึกแล้วรีโหลดได้ทันที',
      'Platform billing Stripe Secret Key': 'Stripe Secret Key ของระบบการเงินแพลตฟอร์ม',
      'Stripe secret key used for checkout and webhook operations · บันทึกแล้วรีโหลดได้ทันที': 'Stripe secret key ที่ใช้กับ checkout และการทำงานของ webhook · บันทึกแล้วรีโหลดได้ทันที',
      'Platform billing Webhook Secret': 'Webhook Secret ของระบบการเงินแพลตฟอร์ม',
      'Stripe webhook verification secret for billing events · บันทึกแล้วรีโหลดได้ทันที': 'secret สำหรับตรวจสอบ webhook ของเหตุการณ์ด้านการเงิน · บันทึกแล้วรีโหลดได้ทันที',
      Webhook: 'เว็บฮุค',
      'Control plane': 'ชุดควบคุมกลาง',
      Dual: 'ทั้งสองแบบ',
      'Review packages': 'ดูแพ็กเกจ',
      'Tenant owner': 'ผู้ดูแลลูกค้า',
      'Next renewal': 'การต่ออายุถัดไป',
      'Current quota': 'โควตาปัจจุบัน',
      'Owner handoff lane': 'ช่องส่งต่องานของเจ้าของระบบ',
      'Move from tenant context to support, package review, or the existing control forms without losing commercial posture.': 'ขยับจากบริบทของลูกค้าไปยังซัพพอร์ต การทบทวนแพ็กเกจ หรือฟอร์มควบคุมเดิมได้โดยไม่เสียบริบทธุรกิจ',
      'Support context': 'บริบทงานซัพพอร์ต',
      'Owner support handoff': 'ช่องส่งต่องานซัพพอร์ตของเจ้าของระบบ',
      'Tenant follow-through': 'งานติดตามของลูกค้า',
      'Close the loop between support evidence, delivery retries, and the tenant dossier before moving work back to operations.': 'ปิดงานระหว่างหลักฐานซัพพอร์ต การลองส่งใหม่ และแฟ้มลูกค้าก่อนส่งงานกลับไปยังฝั่งปฏิบัติการ',
      'Access posture': 'สถานะสิทธิ์เข้าถึง',
      'Sessions and access review': 'ตรวจเซสชันและสิทธิ์เข้าถึง',
      'Use this lane to review active operator access before you revoke, reassign, or escalate.': 'ใช้ส่วนนี้ตรวจสิทธิ์ของผู้ปฏิบัติงานที่ยังใช้งานอยู่ก่อนเพิกถอน เปลี่ยนผู้รับผิดชอบ หรือยกระดับเหตุการณ์',
      'Review sessions': 'ตรวจเซสชัน',
      'Review security signals': 'ตรวจสัญญาณความปลอดภัย',
      'Evidence and export posture': 'สถานะหลักฐานและการส่งออกข้อมูล',
      'Review operational evidence here, then use the existing owner workspace for exports and deeper diagnostics actions.': 'ตรวจหลักฐานเชิงปฏิบัติการจากหน้านี้ แล้วใช้พื้นที่งานเดิมของเจ้าของระบบสำหรับการส่งออกและงานวินิจฉัยเชิงลึก',
      'Open export controls': 'เปิดเครื่องมือส่งออกข้อมูล',
      'Open support lane': 'เปิดช่องงานซัพพอร์ต',
      'Service control and policy actions': 'การควบคุมบริการและนโยบาย',
      'Use this lane when you need restart-capable services, env policy, and automation entry points close to the existing owner control workspace.': 'ใช้ส่วนนี้เมื่อต้องจัดการบริการที่รีสตาร์ตได้ นโยบาย env และจุดเริ่มงานอัตโนมัติให้ใกล้กับพื้นที่งานเดิมของเจ้าของระบบ',
      'Jump to managed services': 'ไปที่บริการที่จัดการอยู่',
      'Package choices': 'ตัวเลือกแพ็กเกจ',
      'Active tenants': 'ลูกค้าที่ใช้งานอยู่',
      'Outstanding follow-up': 'งานติดตามค้างอยู่',
      'Feature rows': 'รายการฟีเจอร์',
      Assignments: 'การผูกใช้งาน',
      'Tenants currently pinned to a plan': 'ลูกค้าที่ผูกกับแผนนี้อยู่ตอนนี้',
      'Commercial follow-up before plan changes': 'งานติดตามเชิงธุรกิจก่อนเปลี่ยนแผน',
      Paused: 'หยุดชั่วคราว',
      'Contracts that need owner review': 'สัญญาที่ Owner ควรตรวจ',
      Invoices: 'ใบแจ้งหนี้',
      Requests: 'คำขอ',
      Retryable: 'ลองใหม่ได้',
      'Queue depth': 'ปริมาณคิว',
      'Top errors': 'ข้อผิดพลาดหลัก',
      'Current invoice watchlist': 'รายการใบแจ้งหนี้ที่ต้องเฝ้าดู',
      'Payment attempts': 'ความพยายามชำระเงิน',
      'Checkout recovery lane': 'ช่องกู้คืนการชำระเงิน',
      'Tenants with debt exposure': 'ลูกค้าที่มีความเสี่ยงด้านหนี้ค้าง',
      'Plans available for assignment': 'แผนที่พร้อมให้เลือกใช้',
      'Useful onboarding comparison set': 'ชุดเปรียบเทียบที่ช่วยในงานเริ่มต้นลูกค้า',
      'Commercial debt still open': 'ภาระเชิงธุรกิจที่ยังค้างอยู่',
      'Signals awaiting acknowledgment': 'สัญญาณที่ยังรอการรับทราบ',
      'Cross-surface escalation context': 'บริบทยกระดับเหตุการณ์ข้ามระบบ',
      'Current telemetry rows': 'รายการเทเลเมทรีปัจจุบัน',
      'Pending delivery work': 'งานส่งของที่ยังรออยู่',
      'Aggregated delivery error families': 'กลุ่มข้อผิดพลาดการส่งของที่รวมแล้ว',
      'Current delivery execution': 'สถานะการส่งของปัจจุบัน',
      'Dead letters with replay path': 'งานตกค้างที่ยังลองซ้ำได้',
      'Current owner/operator accounts': 'บัญชี Owner และ Operator ปัจจุบัน',
      'Current tenant support dossier': 'แฟ้มงานซัพพอร์ตของลูกค้าปัจจุบัน',
      'Current platform footprint': 'ขนาดการใช้งานแพลตฟอร์มปัจจุบัน',
      'Billing focus': 'โฟกัสด้านการเงิน',
      'Payment attempts are available for recovery review on this page.': 'หน้านี้แสดงความพยายามชำระเงินที่ใช้ตรวจและกู้คืนรายการได้',
      'Package focus': 'โฟกัสด้านแพ็กเกจ',
      'Review plan impact before changing entitlements or moving tenants across packages.': 'ตรวจผลกระทบของแผนก่อนเปลี่ยนสิทธิ์ใช้งานหรือย้ายลูกค้าข้ามแพ็กเกจ',
      'Onboarding flow': 'ลำดับงานเริ่มต้น',
      'Use existing controls': 'ใช้ฟอร์มควบคุมเดิม',
      'This page prepares the package and commercial context, then hands the actual mutation to the existing owner control workspace.': 'หน้านี้ใช้เตรียมบริบทด้านแพ็กเกจและธุรกิจ ก่อนส่งการแก้ไขจริงไปยังพื้นที่งานควบคุมเดิมของเจ้าของระบบ',
      'Access focus': 'โฟกัสด้านสิทธิ์เข้าถึง',
      'owner/operator accounts are available for access review.': 'บัญชี Owner และ Operator พร้อมให้ตรวจสอบสิทธิ์ใช้งาน',
      'Diagnostics focus': 'โฟกัสด้านการวินิจฉัย',
      'Control focus': 'โฟกัสด้านการควบคุม',
      'Access and operator sessions': 'สิทธิ์เข้าถึงและเซสชันผู้ปฏิบัติงาน',
      'Diagnostics and evidence': 'การวินิจฉัยและหลักฐาน',
      'Backups and restore posture': 'สถานะสำรองข้อมูลและการกู้คืน',
      'Owner command surface': 'ศูนย์บัญชาการของเจ้าของระบบ',
      'Platform command overview': 'ภาพรวมศูนย์ควบคุมแพลตฟอร์ม',
      'Track tenants, commercial posture, runtime split, and the incidents that need intervention first.': 'ติดตามลูกค้า ภาพรวมรายได้ การแยกหน้าที่ของบอตส่งของและบอตเซิร์ฟเวอร์ และเหตุการณ์ที่ต้องรีบจัดการก่อน',
      'Current subscription baseline': 'ฐานรายได้จากการสมัครใช้ในปัจจุบัน',
      'Open signals': 'สัญญาณที่ยังต้องติดตาม',
      'Notifications, request errors, security': 'การแจ้งเตือน คำขอผิดพลาด และสัญญาณด้านความปลอดภัย',
      'Use this lane for the current managed-service view: tenants, runtime split, revenue posture, and live anomalies.': 'ใช้ส่วนนี้ดูภาพรวมบริการที่ดูแลอยู่ ทั้งลูกค้า ภาพรวมรายได้ สถานะของบอตส่งของและบอตเซิร์ฟเวอร์ และความผิดปกติที่กำลังเกิดขึ้น',
      'This view keeps invoice status, payment failures, and retry actions close to the affected tenant.': 'มุมนี้วางสถานะใบแจ้งหนี้ การชำระเงินที่ล้มเหลว และการลองทำรายการใหม่ไว้ใกล้กับลูกค้าที่ได้รับผลกระทบ',
      'Keep Delivery Agent and Server Bot posture clearly separated while still seeing the full platform health picture.': 'คงการแยกบทบาทของบอตส่งของและบอตเซิร์ฟเวอร์ให้ชัดเจน ขณะเดียวกันยังเห็นภาพรวมสุขภาพของแพลตฟอร์มได้ครบ',
      'Use this page for lifecycle pressure, retry posture, and provisioning-related drift without blending Delivery Agent and Server Bot responsibilities.': 'ใช้หน้านี้ดูแรงกดดันของวงจรงาน สถานะการลองทำรายการใหม่ และความคลาดเคลื่อนของการจัดเตรียมระบบ โดยไม่ปะปนหน้าที่ของบอตส่งของกับบอตเซิร์ฟเวอร์',
      'Subscription lifecycle': 'วงจรการสมัครใช้งาน',
      'Renewals and billing watch': 'การต่ออายุและการเฝ้าระวังการเงิน',
      'Subscriptions and renewals': 'การสมัครใช้งานและการต่ออายุ',
      'Follow contracts that are expiring, suspended, or at risk before they become service-impacting incidents.': 'ติดตามสัญญาที่ใกล้หมดอายุ ถูกระงับ หรือเริ่มมีความเสี่ยงก่อนจะกลายเป็นปัญหาที่กระทบบริการ',
      'Open renewal controls': 'เปิดเครื่องมือจัดการการต่ออายุ',
      'Commercial risk': 'ความเสี่ยงเชิงพาณิชย์',
      'Billing follow-up': 'รายการติดตามการเงิน',
      'Expiring soon': 'ใกล้หมดอายุ',
      'Within 14 days': 'ภายใน 14 วัน',
      'Package catalog': 'แค็ตตาล็อกแพ็กเกจ',
      'Active package definitions': 'แพ็กเกจที่เปิดใช้อยู่',
      'Review package usage before changing entitlement definitions or moving tenants across plans.': 'ทบทวนการใช้งานแพ็กเกจก่อนเปลี่ยนสิทธิ์หรือย้ายลูกค้าข้ามแผน',
      'Use this registry to move between customer records, entitlement posture, renewals, and support context.': 'ใช้ทะเบียนนี้สลับดูข้อมูลลูกค้า สิทธิ์ใช้งาน การต่ออายุ และบริบทงานดูแลลูกค้าได้จากจุดเดียว',
      'No tenant selected': 'ยังไม่ได้เลือกลูกค้า',
      'Open a tenant route from the registry to load a focused tenant dossier here.': 'เปิดหน้าของลูกค้าจากทะเบียนเพื่อโหลดแฟ้มข้อมูลที่ต้องโฟกัสไว้ตรงนี้',
      'Open a tenant route from the registry to load a focused tenant handoff lane here.': 'เปิดหน้าของลูกค้าจากทะเบียนเพื่อโหลดช่องส่งต่องานที่ต้องโฟกัสไว้ตรงนี้',
      Open: 'เปิด',
      Support: 'งานดูแลลูกค้า',
      'Open tenant': 'เปิดหน้าลูกค้า',
      'Open support context': 'เปิดบริบทงานดูแลลูกค้า',
      'Recovery queue': 'คิวกู้คืนรายได้',
      'Resolve billing issues before they grow': 'จัดการปัญหาการเงินก่อนลุกลาม',
      'Prioritized billing follow-up items surface the owner actions that already exist in the workspace so support can recover revenue faster.': 'รายการติดตามการเงินที่จัดลำดับแล้วจะพาไปยัง action เดิมใน workspace เพื่อให้ทีมงานกู้รายได้ได้เร็วขึ้น',
      'No urgent billing recovery work': 'ยังไม่มีงานกู้รายได้เร่งด่วน',
      'No urgent billing recovery work is waiting right now.': 'ตอนนี้ยังไม่มีงานกู้รายได้เร่งด่วนที่รออยู่',
      'Expiring, paused, or active subscriptions can be reviewed here before you open tenant-specific controls.': 'ทบทวนการสมัครใช้งานที่ใกล้หมดอายุ ถูกพัก หรือยังใช้งานอยู่ได้จากหน้านี้ก่อนค่อยเปิดเครื่องมือของลูกค้าแต่ละราย',
      'Commercial attention': 'รายการเชิงพาณิชย์ที่ต้องจับตา',
      'Tenants that need action': 'ลูกค้าที่ต้องดำเนินการ',
      'This watchlist keeps billing, quota, and package pressure close to the tenant records that need intervention first.': 'รายการเฝ้าระวังนี้รวบเรื่องบิล โควตา และแรงกดดันจากแพ็กเกจไว้ใกล้ข้อมูลลูกค้าที่ต้องรีบจัดการ',
      'No tenant is currently breaching billing or quota thresholds.': 'ขณะนี้ยังไม่มีลูกค้ารายใดเกินเกณฑ์บิลหรือโควตา',
      'Active signals': 'สัญญาณที่กำลังเกิดขึ้น',
      'Recent incident feed': 'เหตุการณ์ล่าสุด',
      'The Owner surface should make active incidents obvious even before you drill into runtime or support.': 'หน้านี้ต้องทำให้เห็นเหตุการณ์ที่ยังเปิดอยู่ได้ทันที แม้ยังไม่ได้เจาะไปดูรายละเอียดระบบหรือเคสลูกค้า',
      'This view is tuned for fast platform triage rather than tenant-level editing.': 'มุมมองนี้ปรับไว้เพื่อคัดแยกปัญหาระดับแพลตฟอร์มอย่างรวดเร็ว ไม่ใช่สำหรับแก้ไขรายละเอียดรายลูกค้า',
      'Owner scope': 'ขอบเขตของเจ้าของระบบ',
      'Move from tenant list to renewal action without leaving the Owner command surface.': 'ไล่จากรายชื่อลูกค้าไปยังงานต่ออายุได้ทันทีโดยไม่ต้องออกจากศูนย์บัญชาการของเจ้าของระบบ',
      'session-created': 'สร้างเซสชัน',
      'session-revoked': 'ยกเลิกเซสชัน',
      'Admin session created': 'สร้างเซสชันผู้ดูแลแล้ว',
      'Admin Security Event': 'เหตุการณ์ความปลอดภัยของผู้ดูแล',
      'Admin session revoked': 'ยกเลิกเซสชันผู้ดูแลแล้ว',
      'Admin login succeeded': 'ผู้ดูแลเข้าสู่ระบบสำเร็จ',
      'Operational Alert': 'การแจ้งเตือนเชิงปฏิบัติการ',
      'Current platform posture': 'สถานะแพลตฟอร์มตอนนี้',
      'Tenant footprint': 'ฐานลูกค้า',
      'Subscription posture': 'สถานะการสมัครใช้',
      'Delivery pressure': 'แรงกดดันงานส่งของ',
      'Tenant': 'ลูกค้า',
      'Quota / license': 'โควตา / ใบอนุญาต',
      Outstanding: 'ยอดค้างชำระ',
      Actions: 'การดำเนินการ',
      Renewal: 'ต่ออายุ',
      'Status / package': 'สถานะ / แพ็กเกจ',
      Amount: 'ยอดเงิน',
      Created: 'สร้างเมื่อ',
      Provider: 'ผู้ให้บริการ',
      'Last signal': 'สัญญาณล่าสุด',
      'Last activity': 'ใช้งานล่าสุด',
      Action: 'คำสั่ง',
      Signal: 'สัญญาณ',
      Severity: 'ความรุนแรง',
      At: 'เวลา',
      Billing: 'การเงิน',
      'No feature summary': 'ยังไม่มีสรุปฟีเจอร์',
      'Focused tenant dossier': 'แฟ้มลูกค้าที่เลือก',
      'Tenant registry': 'ทะเบียนลูกค้า',
      'No tenants are loaded.': 'ยังไม่มีข้อมูลลูกค้า',
      'No package catalog': 'ยังไม่มีแค็ตตาล็อกแพ็กเกจ',
      'No package definitions are currently available from the overview payload.': 'ยังไม่มีข้อมูลแพ็กเกจจาก payload ภาพรวม',
      'No subscriptions are loaded.': 'ยังไม่มีข้อมูลการสมัครใช้',
      'No invoices are loaded.': 'ยังไม่มีข้อมูลใบแจ้งหนี้',
      'No payment attempts are loaded.': 'ยังไม่มีข้อมูลรายการชำระเงิน',
      'No version': 'ไม่มีเวอร์ชัน',
      'No minimum': 'ไม่มีเวอร์ชันขั้นต่ำ',
      'No signal': 'ไม่มีสัญญาณ',
      'No detail': 'ไม่มีรายละเอียด',
      'Delivery Agents vs Server Bots': 'บอตส่งของเทียบกับบอตเซิร์ฟเวอร์',
      'Queue entry': 'รายการในคิว',
      Attempts: 'จำนวนครั้ง',
      Age: 'อายุงาน',
      'Dead letter': 'งานค้างผิดปกติ',
      'Delivery Agent': 'บอตส่งของ',
      'Server Bot': 'บอตเซิร์ฟเวอร์',
      'Request errors, notifications, and security events are grouped here to keep triage fast.': 'รวมคำขอผิดพลาด การแจ้งเตือน และเหตุการณ์ความปลอดภัยไว้ด้วยกันเพื่อให้คัดแยกได้เร็ว',
      'Inspect runtime': 'ตรวจรายละเอียดรันไทม์',
      'Reissue token': 'ออกโทเค็นใหม่',
      'Reset binding': 'รีเซ็ตการผูกเครื่อง',
      Revoke: 'เพิกถอน',
      Retry: 'ลองใหม่',
      Clear: 'ล้าง',
      Acknowledge: 'รับทราบ',
      Acknowledged: 'รับทราบแล้ว',
      'Clear acknowledged': 'ล้างรายการที่รับทราบแล้ว',
      'Clear acknowledged notifications': 'ล้างการแจ้งเตือนที่รับทราบแล้ว',
      'Revoke session': 'เพิกถอนเซสชัน',
      'No incidents': 'ยังไม่มีเหตุการณ์',
      'No incident feed is currently loaded.': 'ยังไม่มี feed เหตุการณ์ที่โหลดเข้ามา',
      Request: 'คำขอ',
      'Error / summary': 'ข้อผิดพลาด / สรุป',
      'Top error': 'ข้อผิดพลาดหลัก',
      Count: 'จำนวน',
      'No request telemetry is loaded.': 'ยังไม่มีข้อมูล telemetry ของคำขอ',
      'No aggregated delivery errors are currently loaded.': 'ยังไม่มีข้อมูลข้อผิดพลาดงานส่งของแบบสรุป',
      'Loading support context': 'กำลังโหลดบริบทงานดูแลลูกค้า',
      'The support dossier is being fetched from the current backend route.': 'กำลังดึงแฟ้มงานดูแลลูกค้าจาก backend route ปัจจุบัน',
      'Loaded evidence': 'หลักฐานที่โหลดแล้ว',
      'Context loaded': 'โหลดบริบทแล้ว',
      'Owner support context remains platform-scoped.': 'บริบทงานดูแลลูกค้าของ Owner ยังคงอยู่ในขอบเขตแพลตฟอร์ม',
      'No support case loaded': 'ยังไม่ได้โหลดเคสงานดูแลลูกค้า',
      'Open a tenant support route to hydrate customer evidence here.': 'เปิด route งานดูแลลูกค้าของลูกค้าเพื่อโหลดหลักฐานเข้ามาที่นี่',
      'Loading dead letters': 'กำลังโหลดงานค้างผิดปกติ',
      'The support dead-letter queue is being fetched for the selected tenant.': 'กำลังดึงคิวงานค้างผิดปกติสำหรับลูกค้าที่เลือก',
      'No dead-letter items are loaded for this support context.': 'ยังไม่มีรายการงานค้างผิดปกติสำหรับบริบทนี้',
      'No notifications are currently loaded.': 'ยังไม่มีการแจ้งเตือนที่โหลดเข้ามา',
      'No admin sessions are loaded.': 'ยังไม่มีเซสชันผู้ดูแลที่โหลดเข้ามา',
      'Security events': 'เหตุการณ์ความปลอดภัย',
      'No security events are currently loaded.': 'ยังไม่มีเหตุการณ์ความปลอดภัยที่โหลดเข้ามา',
      'Notification backlog': 'คิวการแจ้งเตือน',
      'Open notifications': 'การแจ้งเตือนที่ยังเปิดอยู่',
      'Owner-side telemetry anomalies currently loaded.': 'ข้อมูลผิดปกติฝั่ง Owner ที่โหลดเข้ามาในตอนนี้',
      'Execution-side runtime posture': 'สถานะรันไทม์ฝั่งปฏิบัติการส่งของ',
      'Server-side runtime posture': 'สถานะรันไทม์ฝั่งเซิร์ฟเวอร์',
      'Signals that need acknowledgment': 'สัญญาณที่ต้องรับทราบ',
      'Delivery follow-up backlog': 'คิวติดตามงานส่งของ',
      'Admin users': 'บัญชีผู้ดูแล',
      'Reload policy': 'นโยบายการโหลดใหม่',
      'Policy context': 'บริบทของนโยบาย',
      'Settings changes still flow through existing env and auth mutations.': 'การเปลี่ยนค่าตั้งค่ายังคงวิ่งผ่าน mutation ของ env และ auth เดิม',
      'Bot Log': 'บันทึกบอต',
      'Bot Log + Delivery': 'บันทึกบอต + ส่งของ',
      'Full Option': 'ตัวเลือกเต็มรูปแบบ',
      'Server Only': 'เฉพาะเซิร์ฟเวอร์',
      'Discord log sync and basic operational visibility.': 'ซิงก์บันทึก Discord และเห็นสถานะการปฏิบัติการพื้นฐาน',
      'Managed delivery plus player-facing commerce and sync.': 'จัดการงานส่งของ พร้อมระบบร้านค้าและการซิงก์ฝั่งผู้เล่น',
      'Full managed server operations with hosting, settings, and delivery.': 'จัดการเซิร์ฟเวอร์แบบเต็มรูปแบบ รวมโฮสต์ การตั้งค่า และงานส่งของ',
      'Managed server controls without log and delivery add-ons.': 'ควบคุมเซิร์ฟเวอร์ได้โดยไม่รวมส่วนเสริมด้านบันทึกและการส่งของ',
      'Managed services': 'บริการที่จัดการอยู่',
      'Restart service': 'รีสตาร์ตบริการ',
      'Automation report': 'รายงานระบบอัตโนมัติ',
      'Manual automation preview is loaded.': 'โหลดผลพรีวิวระบบอัตโนมัติแล้ว',
      'Evaluated runtimes': 'รันไทม์ที่ประเมินแล้ว',
      'No automation report': 'ยังไม่มีรายงานระบบอัตโนมัติ',
      'Run a dry-run preview to inspect automation decisions without changing backend behavior.': 'รันพรีวิวแบบ dry-run เพื่อตรวจผลตัดสินใจของระบบอัตโนมัติโดยไม่เปลี่ยนพฤติกรรม backend',
      'Platform settings': 'การตั้งค่าแพลตฟอร์ม',
      'Shared platform settings': 'การตั้งค่ากลางของแพลตฟอร์ม',
      'This section surfaces managed services, admin users, and automation posture while leaving existing control forms intact.': 'ส่วนนี้สรุปบริการที่ดูแลอยู่ บัญชีผู้ดูแล และสถานะระบบอัตโนมัติ โดยยังคงใช้ฟอร์มควบคุมเดิมทั้งหมด',
      'Accounts loaded from current control-panel settings.': 'บัญชีที่โหลดมาจากการตั้งค่าปัจจุบันของ control panel',
      'Reload or restart required after env changes.': 'ต้อง reload หรือ restart หลังแก้ env',
      'No forced reload currently flagged.': 'ยังไม่มี flag บังคับ reload',
      Automation: 'ระบบอัตโนมัติ',
      'Latest preview loaded.': 'โหลดผลพรีวิวล่าสุดแล้ว',
      'No manual preview yet.': 'ยังไม่มีพรีวิวแบบ manual',
      'Service restart controls': 'การควบคุมการรีสตาร์ตบริการ',
      'Restart actions still flow through the existing owner runtime endpoint.': 'คำสั่งรีสตาร์ตยังคงวิ่งผ่าน owner runtime endpoint เดิม',
      'No managed services are configured.': 'ยังไม่ได้ตั้งค่าบริการที่จัดการอยู่',
      'Owner and operator accounts': 'บัญชีเจ้าของระบบและผู้ปฏิบัติงาน',
      'Account creation and edits still happen in the injected control workspace directly below the KPI strip.': 'การสร้างและแก้ไขบัญชียังคงทำใน control workspace ที่ฝังไว้ใต้แถบ KPI',
      'No admin users are currently loaded.': 'ยังไม่มีบัญชีผู้ดูแลที่โหลดเข้ามา',
      'Automation preview and execution': 'พรีวิวและการรันระบบอัตโนมัติ',
      'Keep dry-run and live automation separate so the Owner can inspect impact before forcing platform actions.': 'แยก dry-run กับ live ออกจากกันเพื่อให้ Owner ตรวจผลกระทบก่อนสั่งงานจริง',
      'Run dry-run': 'รัน dry-run',
      'Run live automation': 'รันระบบอัตโนมัติจริง',
      'Open settings controls': 'เปิดเครื่องมือตั้งค่า',
      Service: 'บริการ',
      'PM2 name': 'ชื่อ PM2',
      Action: 'การทำงาน',
      Username: 'ชื่อผู้ใช้',
      Role: 'บทบาท',
      State: 'สถานะ',
      Active: 'ใช้งานอยู่',
      Inactive: 'ไม่ใช้งาน',
      Platform: 'ทั้งแพลตฟอร์ม',
      'Tenant scope': 'ขอบเขตลูกค้า',
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
      'No action': 'ไม่มีการทำงาน',
      'Loading support context': 'กำลังโหลดบริบทงานดูแลลูกค้า',
      'Loading dead letters': 'กำลังโหลดงานค้างผิดปกติ',
      'Restore preview ready': 'พรีวิวการกู้คืนพร้อมแล้ว',
      'A dry-run restore preview is loaded in memory for the current Owner session.': 'โหลดพรีวิวการกู้คืนแบบ dry-run ไว้ในหน่วยความจำของเซสชัน Owner นี้แล้ว',
      'Restore state': 'สถานะการกู้คืน',
      idle: 'ว่าง',
      'No recovery message': 'ไม่มีข้อความการกู้คืน',
      'Last update': 'อัปเดตล่าสุด',
      'Current backend restore status snapshot.': 'ภาพรวมสถานะการกู้คืนล่าสุดจากระบบหลังบ้าน',
      'No restore preview': 'ยังไม่มีพรีวิวการกู้คืน',
      'Use the recovery forms in the injected control workspace to create previews and apply restores safely.': 'ใช้ฟอร์มกู้คืนใน control workspace ที่ฝังไว้เพื่อสร้างพรีวิวและกู้คืนอย่างปลอดภัย',
      'Available backups': 'รายการแบ็กอัปที่มี',
      'Backups loaded from the current backend inventory.': 'แบ็กอัปที่โหลดมาจากคลัง backend ปัจจุบัน',
      'No backups are currently loaded.': 'ยังไม่มีแบ็กอัปที่โหลดเข้ามา',
      'Recent restore operations': 'รายการกู้คืนล่าสุด',
      'Use restore history to verify whether a previous recovery already ran before launching another one.': 'ใช้ประวัติการกู้คืนเพื่อตรวจสอบก่อนว่ามีการกู้คืนก่อนหน้าเกิดขึ้นแล้วหรือยัง',
      'No restore history is currently loaded.': 'ยังไม่มีประวัติการกู้คืนที่โหลดเข้ามา',
      'Current contract count': 'จำนวนสัญญาปัจจุบัน',
      'Execution runtimes': 'รันไทม์ฝั่งส่งงาน',
      'Server-side runtimes': 'รันไทม์ฝั่งเซิร์ฟเวอร์',
      'Incident feed entries': 'จำนวนเหตุการณ์ที่เปิดอยู่',
      'Current telemetry errors': 'จำนวนข้อผิดพลาดจากระบบติดตาม',
      Notifications: 'การแจ้งเตือน',
      'Owner support signals': 'สัญญาณงานดูแลลูกค้าฝั่ง Owner',
      'Dead letters': 'งานค้างผิดปกติ',
      'Selected support queue': 'คิวงานดูแลลูกค้าที่เลือก',
      'Current tenant support dossier': 'แฟ้มงานดูแลลูกค้าของลูกค้าปัจจุบัน',
      Ready: 'พร้อม',
      Loading: 'กำลังโหลด',
      Idle: 'ว่าง',
      'Signals near support flow': 'สัญญาณใกล้เคียงกับงานดูแลลูกค้า',
      'Recent access signals': 'สัญญาณการเข้าถึงล่าสุด',
      'Awaiting acknowledgment': 'รอการรับทราบ',
      'Operational evidence': 'หลักฐานเชิงปฏิบัติการ',
      'Restart-capable services': 'บริการที่สั่งรีสตาร์ตได้',
      'Owner and ops accounts': 'บัญชีเจ้าของระบบและทีมปฏิบัติการ',
      'Dry-run/live report state': 'สถานะรายงาน dry-run/live',
      Required: 'ต้องดำเนินการ',
      Safe: 'ปลอดภัย',
      'Current env apply posture': 'สถานะการนำ env ไปใช้',
      'Available recovery points': 'จุดกู้คืนที่พร้อมใช้',
      'Recent recovery events': 'เหตุการณ์กู้คืนล่าสุด',
      'Dry-run state': 'สถานะ dry-run',
      'Keep recovery evidence close': 'เก็บหลักฐานการกู้คืนไว้ใกล้มือ',
      'Support dossier': 'แฟ้มงานดูแลลูกค้า',
      'Automation preview': 'พรีวิวระบบอัตโนมัติ',
      'Latest manual automation preview': 'พรีวิวระบบอัตโนมัติแบบ manual ล่าสุด',
      'Dry-run preview loaded': 'โหลดพรีวิวแบบ dry-run แล้ว',
      active: 'ใช้งานอยู่',
      trialing: 'ทดลองใช้',
      healthy: 'ปกติ',
      online: 'ออนไลน์',
      offline: 'ออฟไลน์',
      paid: 'ชำระแล้ว',
      succeeded: 'สำเร็จ',
      resolved: 'แก้ไขแล้ว',
      warning: 'เตือน',
      degraded: 'เสื่อมสภาพ',
      stale: 'ข้อมูลเก่า',
      slow: 'ช้า',
      outdated: 'ล้าสมัย',
      pending: 'รอดำเนินการ',
      trial: 'ทดลอง',
      open: 'เปิดอยู่',
      failed: 'ล้มเหลว',
      error: 'ผิดพลาด',
      expired: 'หมดอายุ',
      suspended: 'ระงับ',
      past_due: 'ค้างชำระ',
      canceled: 'ยกเลิกแล้ว',
      critical: 'วิกฤต',
      preview: 'พรีวิว',
      draft: 'ร่าง',
      'No action': 'ไม่มีคำสั่ง',
      'No top error': 'ยังไม่มีข้อผิดพลาดหลัก',
      'No codes': 'ยังไม่มีรหัส',
      'No data': 'ยังไม่มีข้อมูล',
      'Nothing to show yet.': 'ยังไม่มีข้อมูลให้แสดง',
    },
  };

  const OWNER_LITERAL_PATTERNS = [
    {
      pattern: /^([\d,]+) min ago$/,
      replace: (match, value) => `${value} นาทีก่อน`,
    },
    {
      pattern: /^([\d,]+) hr ago$/,
      replace: (match, value) => `${value} ชั่วโมงก่อน`,
    },
    {
      pattern: /^([\d,]+) d ago$/,
      replace: (match, value) => `${value} วันก่อน`,
    },
    {
      pattern: /^min\s+(.+)$/i,
      replace: (match, value) => `ขั้นต่ำ ${value}`,
    },
    {
      pattern: /^([\d,]+) Delivery Agents · ([\d,]+) Server Bots$/,
      replace: (match, deliveryCount, serverCount) => `${deliveryCount} บอตส่งของ · ${serverCount} บอตเซิร์ฟเวอร์`,
    },
    {
      pattern: /^([\d,]+) tenants with outstanding billing · ([\d,]+) expiring soon$/,
      replace: (match, billingCount, expiringCount) => `${billingCount} ลูกค้ามียอดค้างชำระ · ${expiringCount} รายใกล้หมดอายุ`,
    },
    {
      pattern: /^([\d,]+) open notifications$/,
      replace: (match, value) => `${value} การแจ้งเตือนที่ยังเปิดอยู่`,
    },
    {
      pattern: /^([\d,]+) actions$/u,
      replace: (match, value) => `${value} การทำงาน`,
    },
    {
      pattern: /^([\d,]+) acknowledged$/u,
      replace: (match, value) => `${value} รับทราบแล้ว`,
    },
    {
      pattern: /^([\d,]+) Delivery Agents$/u,
      replace: (match, value) => `${value} บอทส่งของ`,
    },
    {
      pattern: /^([\d,]+) Server Bots$/u,
      replace: (match, value) => `${value} บอทเซิร์ฟเวอร์`,
    },
    {
      pattern: /^([\d,]+) retryable$/,
      replace: (match, value) => `${value} รายการที่ลองใหม่ได้`,
    },
    {
      pattern: /^([\d,]+) tenants$/,
      replace: (match, value) => `${value} ลูกค้า`,
    },
    {
      pattern: /^([\d,]+) overdue$/,
      replace: (match, value) => `${value} รายการเกินเวลา`,
    },
    {
      pattern: /^([\d,]+) recent success$/,
      replace: (match, value) => `${value} รายการที่สำเร็จล่าสุด`,
    },
    {
      pattern: /^([\d,]+) request errors$/,
      replace: (match, value) => `${value} คำขอที่ผิดพลาด`,
    },
    {
      pattern: /^([\d,]+) subscriptions · ([\d,]+) active$/,
      replace: (match, totalCount, activeCount) => `${totalCount} การสมัครใช้ · ${activeCount} ใช้งานอยู่`,
    },
    {
      pattern: /^([\d,]+) actions$/,
      replace: (match, value) => `${value} คำสั่ง`,
    },
    {
      pattern: /^([\d,]+) active$/,
      replace: (match, value) => `${value} ใช้งานอยู่`,
    },
    {
      pattern: /^([\d,]+) active · ([\d,]+) trialing$/,
      replace: (match, activeCount, trialingCount) => `${activeCount} ใช้งานอยู่ · ${trialingCount} ทดลองใช้`,
    },
    {
      pattern: /^([\d,]+) acknowledged$/,
      replace: (match, value) => `${value} รายการที่รับทราบแล้ว`,
    },
    {
      pattern: /^([\d,]+) Delivery Agents$/,
      replace: (match, value) => `${value} บอตส่งของ`,
    },
    {
      pattern: /^([\d,]+) DA \/ ([\d,]+) SB$/,
      replace: (match, deliveryCount, serverCount) => `${deliveryCount} บอตส่งของ / ${serverCount} บอตเซิร์ฟเวอร์`,
    },
    {
      pattern: /^([\d,]+) Server Bots$/,
      replace: (match, value) => `${value} บอตเซิร์ฟเวอร์`,
    },
    {
      pattern: /^([\d,]+) healthy$/,
      replace: (match, value) => `${value} ปกติ`,
    },
    {
      pattern: /^([\d,]+) offline$/,
      replace: (match, value) => `${value} ออฟไลน์`,
    },
    {
      pattern: /^([\d,]+) active$/,
      replace: (match, value) => `${value} ใช้งานอยู่`,
    },
    {
      pattern: /^([\d,]+) request errors \/ ([\d,]+) security events currently loaded\.$/,
      replace: (match, requestCount, securityCount) => `${requestCount} คำขอที่ผิดพลาด / ${securityCount} เหตุการณ์ความปลอดภัยที่โหลดอยู่ตอนนี้`,
    },
    {
      pattern: /^([\d,]+) failed jobs · ([\d.,]+)%$/,
      replace: (match, failedCount, failureRate) => `${failedCount} งานล้มเหลว · ${failureRate}%`,
    },
    {
      pattern: /^([\d,]+) Server Bots remain separate in every table and action path\.$/,
      replace: (match, value) => `${value} บอตเซิร์ฟเวอร์ยังถูกแยกออกชัดเจนในทุกตารางและทุกเส้นทางคำสั่ง`,
    },
    {
      pattern: /^Renews (.+)$/u,
      replace: (match, value) => `ต่ออายุ ${value}`,
    },
  ];

  function translateOwnerLiteral(value) {
    const locale = currentLocale();
    const text = String(value ?? '');
    if (locale !== 'th') return repairMojibakeText(text);
    const repairedText = repairMojibakeText(text);
    const trimmed = trimText(repairedText, 600);
    if (!trimmed) return repairedText;
    const table = OWNER_LITERAL_TRANSLATIONS[locale] || {};
    if (Object.prototype.hasOwnProperty.call(table, trimmed)) {
      return repairedText.replace(trimmed, repairMojibakeText(table[trimmed]));
    }
    for (const rule of OWNER_LITERAL_PATTERNS) {
      const match = trimmed.match(rule.pattern);
      if (match) {
        const next = repairMojibakeText(rule.replace(...match));
        return repairedText.replace(trimmed, next);
      }
    }
    return repairedText;
  }

  function translateOwnerShell(rootNode) {
    if (!rootNode || currentLocale() !== 'th' || typeof document === 'undefined' || typeof NodeFilter === 'undefined') {
      return;
    }
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const nextValue = translateOwnerLiteral(node.nodeValue);
      if (nextValue !== node.nodeValue) {
        node.nodeValue = nextValue;
      }
      node = walker.nextNode();
    }
    rootNode.querySelectorAll('[title],[aria-label],[placeholder]').forEach((element) => {
      ['title', 'aria-label', 'placeholder'].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const nextValue = translateOwnerLiteral(element.getAttribute(attribute));
        if (nextValue !== element.getAttribute(attribute)) {
          element.setAttribute(attribute, nextValue);
        }
      });
    });
  }

  function arrayOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function firstNonEmpty(values, fallback = '') {
    const list = Array.isArray(values) ? values : [];
    for (const value of list) {
      const text = trimText(value, 320);
      if (text) return text;
    }
    return fallback;
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function compareDateDesc(left, right) {
    const leftAt = parseDate(left)?.getTime() || 0;
    const rightAt = parseDate(right)?.getTime() || 0;
    return rightAt - leftAt;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat(currentIntlLocale()).format(numeric)
      : fallback;
  }

  function formatPercent(value, fallback = '0%') {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? `${new Intl.NumberFormat(currentIntlLocale(), { maximumFractionDigits: 1 }).format(numeric)}%`
      : fallback;
  }

  function formatCurrencyCents(value, currency = 'THB') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat(currentIntlLocale(), {
      style: 'currency',
      currency: trimText(currency, 12).toUpperCase() || 'THB',
      maximumFractionDigits: 2,
    }).format(numeric / 100);
  }

  function formatDateTime(value, fallback = '-') {
    const date = parseDate(value);
    return date
      ? new Intl.DateTimeFormat(currentIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date)
      : fallback;
  }

  function formatRelative(value, fallback = 'No recent signal') {
    const date = parseDate(value);
    if (!date) return fallback;
    const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 60) return currentLocale() === 'th'
      ? `${formatNumber(diffMinutes)} นาทีก่อน`
      : `${formatNumber(diffMinutes)} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return currentLocale() === 'th'
      ? `${formatNumber(diffHours)} ชั่วโมงก่อน`
      : `${formatNumber(diffHours)} hr ago`;
    return currentLocale() === 'th'
      ? `${formatNumber(Math.round(diffHours / 24))} วันก่อน`
      : `${formatNumber(Math.round(diffHours / 24))} d ago`;
  }

  function toneForStatus(value) {
    const raw = trimText(value, 80).toLowerCase();
    if (['ready', 'healthy', 'active', 'online', 'paid', 'succeeded', 'resolved'].includes(raw)) return 'success';
    if (['warning', 'degraded', 'stale', 'slow', 'outdated', 'pending', 'trialing', 'trial', 'open'].includes(raw)) return 'warning';
    if (['offline', 'failed', 'error', 'expired', 'suspended', 'past_due', 'canceled', 'void', 'critical'].includes(raw)) return 'danger';
    if (['preview', 'info', 'draft'].includes(raw)) return 'info';
    return 'muted';
  }

  function chip(label, tone) {
    return `<span class="ownerx-chip" data-tone="${escapeHtml(tone || 'muted')}">${escapeHtml(translateOwnerLiteral(label || '-'))}</span>`;
  }

  function buildQuotaSummary(snapshot) {
    const quotas = snapshot && typeof snapshot.quotas === 'object' ? snapshot.quotas : {};
    const hot = Object.entries(quotas).filter(([, row]) => {
      const limit = Number(row && row.limit || 0);
      const used = Number(row && row.used || 0);
      return Number.isFinite(limit) && limit > 0 && used / limit >= 0.75;
    });
    if (!hot.length) {
      return { text: 'Within normal usage', tone: 'success' };
    }
    const summary = hot.slice(0, 2).map(([name, row]) => {
      const limit = row && row.unlimited ? 'unlimited' : formatNumber(row && row.limit, '0');
      return `${name}: ${formatNumber(row && row.used, '0')}/${limit}`;
    }).join(' · ');
    const hasExceeded = hot.some(([, row]) => Number(row && row.used || 0) >= Number(row && row.limit || 0));
    return { text: summary, tone: hasExceeded ? 'danger' : 'warning' };
  }

  function buildTenantRows(state) {
    const tenants = arrayOf(state.tenants);
    const subscriptions = arrayOf(state.subscriptions);
    const licenses = arrayOf(state.licenses);
    const invoices = arrayOf(state.billingInvoices);
    const attempts = arrayOf(state.billingPaymentAttempts);
    const quotaSnapshots = arrayOf(state.tenantQuotaSnapshots);
    const quotaMap = new Map(quotaSnapshots.map((row) => [trimText(row && (row.tenantId || row.tenant && row.tenant.id), 160), row]));

    return tenants.map((tenant) => {
      const tenantId = trimText(tenant && tenant.id, 160);
      const subscription = subscriptions.find((row) => trimText(row && (row.tenantId || row.ownerTenantId), 160) === tenantId) || {};
      const license = licenses.find((row) => trimText(row && (row.tenantId || row.ownerTenantId), 160) === tenantId) || {};
      const tenantInvoices = invoices.filter((row) => trimText(row && row.tenantId, 160) === tenantId);
      const tenantAttempts = attempts.filter((row) => trimText(row && row.tenantId, 160) === tenantId);
      const latestInvoice = tenantInvoices[0] || null;
      const latestAttempt = tenantAttempts[0] || null;
      const outstandingCents = tenantInvoices
        .filter((row) => ['draft', 'open', 'past_due'].includes(trimText(row && row.status, 40).toLowerCase()))
        .reduce((sum, row) => sum + Number(row && row.amountCents || 0), 0);
      const collectedCents = tenantInvoices
        .filter((row) => trimText(row && row.status, 40).toLowerCase() === 'paid')
        .reduce((sum, row) => sum + Number(row && row.amountCents || 0), 0);
      const quota = buildQuotaSummary(quotaMap.get(tenantId));

      return {
        tenantId,
        slug: trimText(tenant && tenant.slug, 120),
        name: firstNonEmpty([tenant && tenant.name, tenant && tenant.slug, tenantId], 'Unknown tenant'),
        owner: firstNonEmpty([tenant && tenant.ownerName, tenant && tenant.ownerEmail], '-'),
        packageName: firstNonEmpty([
          subscription && subscription.packageName,
          subscription && subscription.planName,
          tenant && tenant.plan,
          tenant && tenant.type,
        ], 'Not assigned'),
        status: firstNonEmpty([subscription && subscription.status, tenant && tenant.status], 'active'),
        statusTone: toneForStatus(firstNonEmpty([subscription && subscription.status, tenant && tenant.status], 'active')),
        licenseState: firstNonEmpty([license && license.status, license && license.state], 'unassigned'),
        renewsAt: firstNonEmpty([subscription && subscription.renewsAt, subscription && subscription.expiresAt, subscription && subscription.endsAt], ''),
        outstandingCents,
        collectedCents,
        invoiceState: latestInvoice ? firstNonEmpty([latestInvoice.status], 'open') : 'none',
        paymentAttemptState: latestAttempt ? firstNonEmpty([latestAttempt.status, latestAttempt.provider], '-') : '-',
        quotaText: quota.text,
        quotaTone: quota.tone,
        locale: firstNonEmpty([tenant && tenant.locale], 'th'),
        updatedAt: firstNonEmpty([tenant && tenant.updatedAt, tenant && tenant.createdAt], ''),
      };
    }).sort((left, right) => compareDateDesc(left.updatedAt, right.updatedAt));
  }

  function buildPackageRows(state, tenantRows) {
    const overview = state.overview || {};
    const packages = arrayOf(overview.packages);
    const plans = arrayOf(overview.plans);
    const publicPlans = arrayOf(overview.publicOverview && overview.publicOverview.billing && overview.publicOverview.billing.plans);
    const source = packages.length ? packages : plans.length ? plans : publicPlans;
    const subscriptions = arrayOf(state.subscriptions);

    return source.map((row, index) => {
      const packageId = trimText(row && (row.id || row.packageId || row.code), 120) || `package-${index + 1}`;
      const packageTitle = firstNonEmpty([row && row.title, row && row.name, row && row.label, packageId], packageId);
      const features = [];
      if (Array.isArray(row && row.features)) {
        row.features.forEach((item) => {
          const label = firstNonEmpty([item && item.label, item && item.name, item], '');
          if (label) features.push(label);
        });
      }
      if (!features.length && trimText(row && row.featureText, 800)) {
        trimText(row.featureText, 800).split(/\r?\n|,/g).forEach((item) => {
          const label = trimText(item, 120);
          if (label) features.push(label);
        });
      }
      const activeTenants = tenantRows.filter((tenant) => trimText(tenant.packageName, 160).toLowerCase() === packageTitle.toLowerCase()).length
        || subscriptions.filter((subscription) => trimText(subscription && (subscription.packageId || subscription.planId), 120).toLowerCase() === packageId.toLowerCase()).length;
      return {
        id: packageId,
        title: packageTitle,
        status: firstNonEmpty([row && row.status, row && row.state], 'active'),
        position: Number(row && row.position || index + 1) || index + 1,
        features: features.slice(0, 8),
        activeTenants,
        description: firstNonEmpty([row && row.description], 'No description provided.'),
        isSystem: row && row.isSystem === true,
      };
    }).sort((left, right) => (left.position - right.position) || String(left.title).localeCompare(String(right.title)));
  }

  function buildSubscriptionRows(state, tenantRows) {
    const tenantsById = new Map(tenantRows.map((row) => [row.tenantId, row]));
    const invoices = arrayOf(state.billingInvoices);
    const attempts = arrayOf(state.billingPaymentAttempts);
    return arrayOf(state.subscriptions).map((row) => {
      const tenantId = trimText(row && (row.tenantId || row.ownerTenantId), 160);
      const tenant = tenantsById.get(tenantId) || null;
      const invoice = invoices.find((entry) => trimText(entry && entry.tenantId, 160) === tenantId) || null;
      const attempt = attempts.find((entry) => trimText(entry && entry.tenantId, 160) === tenantId) || null;
      return {
        id: trimText(row && row.id, 160),
        tenantId,
        tenantName: tenant ? tenant.name : tenantId || 'Unknown tenant',
        status: firstNonEmpty([row && row.status], 'active'),
        packageId: trimText(row && row.packageId, 120),
        planId: trimText(row && row.planId, 120),
        packageName: firstNonEmpty([row && row.packageName, row && row.planName, tenant && tenant.packageName], '-'),
        billingCycle: firstNonEmpty([row && row.billingCycle], 'monthly'),
        amountCents: Number(row && row.amountCents || 0),
        currency: firstNonEmpty([row && row.currency], 'THB'),
        renewsAt: firstNonEmpty([row && row.renewsAt, row && row.expiresAt, row && row.endsAt], ''),
        invoiceId: trimText(invoice && invoice.id, 160),
        invoiceStatus: firstNonEmpty([invoice && invoice.status], 'none'),
        attemptId: trimText(attempt && attempt.id, 160),
        attemptStatus: firstNonEmpty([attempt && attempt.status], '-'),
        externalRef: firstNonEmpty([row && row.externalRef], ''),
      };
    }).sort((left, right) => compareDateDesc(left.renewsAt, right.renewsAt));
  }

  function buildInvoiceRows(state, tenantRows) {
    const tenantMap = new Map(tenantRows.map((row) => [row.tenantId, row]));
    return arrayOf(state.billingInvoices).map((row) => {
      const tenantId = trimText(row && row.tenantId, 160);
      const tenant = tenantMap.get(tenantId) || null;
      return {
        id: trimText(row && row.id, 160),
        tenantId,
        tenantName: tenant ? tenant.name : tenantId || 'Unknown tenant',
        status: firstNonEmpty([row && row.status], 'open'),
        amountCents: Number(row && row.amountCents || 0),
        currency: firstNonEmpty([row && row.currency], 'THB'),
        subscriptionId: trimText(row && row.subscriptionId, 160),
        packageId: trimText(row && row.packageId, 120),
        planId: trimText(row && row.planId, 120),
        billingCycle: firstNonEmpty([row && row.billingCycle], 'monthly'),
        createdAt: firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''),
      };
    }).sort((left, right) => compareDateDesc(left.createdAt, right.createdAt));
  }

  function buildPaymentRows(state, tenantRows) {
    const tenantMap = new Map(tenantRows.map((row) => [row.tenantId, row]));
    const subscriptionMap = new Map(arrayOf(state.subscriptions).map((row) => [trimText(row && row.id, 160), row]));
    return arrayOf(state.billingPaymentAttempts).map((row) => {
      const tenantId = trimText(row && row.tenantId, 160);
      const tenant = tenantMap.get(tenantId) || null;
      const subscription = subscriptionMap.get(trimText(row && row.subscriptionId, 160)) || {};
      return {
        id: trimText(row && row.id, 160),
        tenantId,
        tenantName: tenant ? tenant.name : tenantId || 'Unknown tenant',
        status: firstNonEmpty([row && row.status], 'pending'),
        amountCents: Number(row && row.amountCents || subscription.amountCents || 0),
        currency: firstNonEmpty([row && row.currency, subscription.currency], 'THB'),
        invoiceId: trimText(row && row.invoiceId, 160),
        subscriptionId: trimText(row && row.subscriptionId, 160),
        packageId: trimText(row && row.packageId || subscription.packageId, 120),
        planId: trimText(row && row.planId || subscription.planId, 120),
        billingCycle: firstNonEmpty([row && row.billingCycle, subscription.billingCycle], 'monthly'),
        provider: firstNonEmpty([row && row.provider], '-'),
        createdAt: firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''),
      };
    }).sort((left, right) => compareDateDesc(left.createdAt, right.createdAt));
  }

  function inferRuntimeKind(row) {
    const role = trimText(row && row.role || row && row.meta && row.meta.agentRole, 80).toLowerCase();
    const scope = trimText(row && row.scope || row && row.meta && row.meta.agentScope, 80).toLowerCase();
    if (role === 'sync' || ['sync_only', 'sync-only', 'synconly'].includes(scope)) return 'server-bots';
    if (role === 'execute' || ['execute_only', 'execute-only', 'executeonly'].includes(scope)) return 'delivery-agents';
    const text = [
      row && row.runtimeKey,
      row && row.name,
      row && row.displayName,
      row && row.channel,
      row && row.runtimeKind,
      row && row.role,
      row && row.scope,
      row && row.meta && row.meta.agentRole,
      row && row.meta && row.meta.agentScope,
    ].map((entry) => trimText(entry, 80).toLowerCase()).join(' ');
    if (['sync', 'watch', 'watcher', 'log', 'config', 'restart', 'monitor', 'server-bot'].some((token) => text.includes(token))) {
      return 'server-bots';
    }
    return 'delivery-agents';
  }

  function buildRuntimeRows(state) {
    const collections = [
      { source: 'agents', rows: arrayOf(state.agents) },
      { source: 'registry', rows: arrayOf(state.agentRegistry) },
      { source: 'provisioning', rows: arrayOf(state.agentProvisioning) },
      { source: 'devices', rows: arrayOf(state.agentDevices) },
      { source: 'credentials', rows: arrayOf(state.agentCredentials) },
    ];
    const map = new Map();
    collections.forEach((bucket) => {
      bucket.rows.forEach((row, index) => {
        const key = firstNonEmpty([
          row && row.runtimeKey,
          row && row.agentId,
          row && row.deviceId,
          row && row.provisionTokenId,
          row && row.apiKeyId,
          `${bucket.source}-${index + 1}`,
        ], `${bucket.source}-${index + 1}`);
        const current = map.get(key) || { mergeSources: [] };
        current.mergeSources = current.mergeSources.concat(bucket.source);
        Object.assign(current, row);
        current.runtimeKey = firstNonEmpty([current.runtimeKey, key], key);
        current.tenantId = firstNonEmpty([current.tenantId, current.ownerTenantId, current.meta && current.meta.tenantId], '');
        current.displayName = firstNonEmpty([current.displayName, current.name, current.runtimeKey, current.agentId], current.runtimeKey);
        current.runtimeKind = firstNonEmpty([current.runtimeKind, inferRuntimeKind(current)], 'delivery-agents');
        current.status = firstNonEmpty([
          current.status,
          current.health,
          current.connectionStatus,
          current.deviceStatus,
          current.tokenStatus,
          current.state,
        ], 'unknown');
        current.lastSeenAt = firstNonEmpty([
          current.lastSeenAt,
          current.lastHeartbeatAt,
          current.heartbeatAt,
          current.updatedAt,
          current.createdAt,
        ], '');
        current.version = firstNonEmpty([current.version, current.runtimeVersion, current.meta && current.meta.version], '');
        current.minimumVersion = firstNonEmpty([current.minimumVersion, current.meta && current.meta.minimumVersion], '');
        map.set(key, current);
      });
    });
    return Array.from(map.values())
      .map((row) => ({
        runtimeKey: trimText(row.runtimeKey, 160),
        displayName: trimText(row.displayName, 200) || trimText(row.runtimeKey, 160),
        tenantId: trimText(row.tenantId, 160),
        runtimeKind: trimText(row.runtimeKind, 80) || inferRuntimeKind(row),
        status: trimText(row.status, 80) || 'unknown',
        role: trimText(row.role || row.meta && row.meta.agentRole, 80),
        scope: trimText(row.scope || row.meta && row.meta.agentScope, 80),
        version: trimText(row.version, 80),
        minimumVersion: trimText(row.minimumVersion, 80),
        lastSeenAt: trimText(row.lastSeenAt, 80),
        deviceId: trimText(row.deviceId, 160),
        provisionTokenId: trimText(row.provisionTokenId || row.tokenId, 160),
        apiKeyId: trimText(row.apiKeyId, 160),
        serverId: trimText(row.serverId, 160),
        guildId: trimText(row.guildId, 160),
        agentId: trimText(row.agentId, 160),
        mergeSources: arrayOf(row.mergeSources),
      }))
      .sort((left, right) => compareDateDesc(left.lastSeenAt, right.lastSeenAt));
  }

  function humanizeOwnerIncidentDetail(value) {
    function parseJsonText(valueToParse) {
      const text = trimText(valueToParse, 4000);
      if (!text || !/^[\[{]/u.test(text)) return null;
      try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }

    function summarizeStructuredIncident(payload) {
      if (!payload || typeof payload !== 'object') return '';
      const kind = trimText(payload.kind || payload.type || payload.eventType, 120);
      const tenant = firstNonEmpty([payload.tenantSlug, payload.tenantId], '');
      const source = trimText(payload.source, 120);
      if (kind === 'tenant-quota-near-limit') {
        const quotaKey = trimText(payload.quotaKey, 120) || ownerText('quota', 'โควตา');
        const used = Number.isFinite(Number(payload.used)) ? formatNumber(payload.used) : '-';
        const limit = Number.isFinite(Number(payload.limit)) ? formatNumber(payload.limit) : '-';
        const remaining = Number.isFinite(Number(payload.remaining)) ? formatNumber(payload.remaining) : '';
        return ownerText(
          `${tenant || 'Tenant'} quota ${quotaKey}: ${used}/${limit}${remaining ? ` · ${remaining} remaining` : ''}`,
          `${tenant || 'ลูกค้า'} โควตา ${quotaKey}: ใช้ ${used}/${limit}${remaining ? ` · เหลือ ${remaining}` : ''}`
        );
      }
      if (tenant || source || kind) {
        const subject = ownerText(
          kind || 'Operational signal',
          translateOwnerLiteral(kind) || kind || 'สัญญาณเชิงปฏิบัติการ'
        );
        const suffix = [tenant, source].filter(Boolean).join(' · ');
        return suffix ? `${subject} · ${suffix}` : subject;
      }
      return '';
    }

    function summarizePipeIncident(text) {
      const parts = String(text || '').split('|').map((part) => trimText(part, 400)).filter(Boolean);
      if (parts.length < 2) return '';
      const head = currentLocale() === 'th'
        ? (translateOwnerLiteral(parts[0]) || parts[0])
        : parts[0];
      const labels = {
        actor: ['actor', 'ผู้ดำเนินการ'],
        target: ['target', 'เป้าหมาย'],
        ip: ['IP', 'IP'],
        reason: ['reason', 'สาเหตุ'],
      };
      const details = parts.slice(1).map((part) => {
        const separator = part.indexOf('=');
        if (separator === -1) {
          return currentLocale() === 'th' ? (translateOwnerLiteral(part) || part) : part;
        }
        const key = trimText(part.slice(0, separator), 80).toLowerCase();
        const parsedValue = trimText(part.slice(separator + 1), 200);
        const label = labels[key];
        if (!label) return `${key}: ${parsedValue}`;
        return ownerText(`${label[0]}: ${parsedValue}`, `${label[1]}: ${parsedValue}`);
      });
      return [head].concat(details).join(' · ');
    }

    const text = trimText(value, 4000);
    if (!text) return '-';
    const structured = summarizeStructuredIncident(parseJsonText(text));
    if (structured) return structured;
    const piped = summarizePipeIncident(text);
    return piped || text;
  }

  function buildIncidentRows(state) {
    function parseJsonText(value) {
      const text = trimText(value, 4000);
      if (!text || !/^[\[{]/u.test(text)) return null;
      try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }

    function summarizeStructuredIncident(payload) {
      if (!payload || typeof payload !== 'object') return '';
      const kind = trimText(payload.kind || payload.type || payload.eventType, 120);
      const tenant = firstNonEmpty([payload.tenantSlug, payload.tenantId], '');
      const source = trimText(payload.source, 120);
      if (kind === 'tenant-quota-near-limit') {
        const quotaKey = trimText(payload.quotaKey, 120) || ownerText('quota', 'โควตา');
        const used = Number.isFinite(Number(payload.used)) ? formatNumber(payload.used) : '-';
        const limit = Number.isFinite(Number(payload.limit)) ? formatNumber(payload.limit) : '-';
        const remaining = Number.isFinite(Number(payload.remaining)) ? formatNumber(payload.remaining) : '';
        return ownerText(
          `${tenant || 'Tenant'} quota ${quotaKey}: ${used}/${limit}${remaining ? ` · ${remaining} remaining` : ''}`,
          `${tenant || 'ลูกค้า'} โควตา ${quotaKey}: ใช้ ${used}/${limit}${remaining ? ` · เหลือ ${remaining}` : ''}`
        );
      }
      if (tenant || source || kind) {
        const subject = ownerText(
          kind || 'Operational signal',
          translateOwnerLiteral(kind) || kind || 'สัญญาณเชิงปฏิบัติการ'
        );
        const suffix = [tenant, source].filter(Boolean).join(' · ');
        return suffix ? `${subject} · ${suffix}` : subject;
      }
      return '';
    }

    function summarizePipeIncident(text) {
      const parts = String(text || '').split('|').map((part) => trimText(part, 400)).filter(Boolean);
      if (parts.length < 2) return '';
      const head = currentLocale() === 'th'
        ? (translateOwnerLiteral(parts[0]) || parts[0])
        : parts[0];
      const labels = {
        actor: ['actor', 'ผู้ดำเนินการ'],
        target: ['target', 'เป้าหมาย'],
        ip: ['IP', 'IP'],
        reason: ['reason', 'สาเหตุ'],
      };
      const details = parts.slice(1).map((part) => {
        const separator = part.indexOf('=');
        if (separator === -1) {
          return currentLocale() === 'th' ? (translateOwnerLiteral(part) || part) : part;
        }
        const key = trimText(part.slice(0, separator), 80).toLowerCase();
        const value = trimText(part.slice(separator + 1), 200);
        const label = labels[key];
        if (!label) return `${key}: ${value}`;
        return ownerText(`${label[0]}: ${value}`, `${label[1]}: ${value}`);
      });
      return [head].concat(details).join(' · ');
    }

    function humanizeIncidentDetail(value) {
      const text = trimText(value, 4000);
      if (!text) return '-';
      const structured = summarizeStructuredIncident(parseJsonText(text));
      if (structured) return structured;
      const piped = summarizePipeIncident(text);
      return piped || text;
    }

    const rows = [];
    arrayOf(state.requestLogs && state.requestLogs.items).forEach((row) => {
      rows.push({
        tone: Number(row && row.statusCode || 0) >= 500 ? 'danger' : 'warning',
        title: `${trimText(row && row.method, 12) || 'REQ'} ${trimText(row && (row.path || row.routeGroup), 160) || 'request'}`,
        detail: humanizeIncidentDetail(firstNonEmpty([row && row.error, row && row.summary, row && row.requestId], '-')),
        at: firstNonEmpty([row && row.at, row && row.createdAt], ''),
      });
    });
    arrayOf(state.notifications).forEach((row) => {
      rows.push({
        tone: row && row.acknowledged === true ? 'muted' : 'warning',
        title: firstNonEmpty([row && row.title, row && row.type], 'Notification'),
        detail: humanizeIncidentDetail(firstNonEmpty([row && row.message, row && row.summary], '-')),
        at: firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''),
      });
    });
    arrayOf(state.securityEvents).forEach((row) => {
      rows.push({
        tone: toneForStatus(firstNonEmpty([row && row.severity, row && row.status], 'warning')),
        title: firstNonEmpty([row && row.title, row && row.type, row && row.eventType], 'Security event'),
        detail: humanizeIncidentDetail(firstNonEmpty([row && row.detail, row && row.message, row && row.ip], '-')),
        at: firstNonEmpty([row && row.at, row && row.createdAt], ''),
      });
    });
    return rows.sort((left, right) => compareDateDesc(left.at, right.at)).slice(0, 24);
  }

  function buildSupportCaseSummary(bundle) {
    if (!bundle || typeof bundle !== 'object') return null;
    const summary = firstNonEmpty([bundle.summary, bundle.title, bundle.message], '');
    const counts = Object.entries(bundle)
      .filter(([, value]) => Array.isArray(value) && value.length)
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${formatNumber(value.length)}`);
    const tenant = firstNonEmpty([
      bundle.tenant && bundle.tenant.name,
      bundle.tenant && bundle.tenant.slug,
      bundle.tenantId,
    ], '');
    return {
      summary: summary || 'Support context loaded.',
      tenant,
      counts,
    };
  }

  function buildModel(state, rawRoute) {
    const overview = state.overview || {};
    const deliveryLifecycle = state.deliveryLifecycle && typeof state.deliveryLifecycle === 'object'
      ? state.deliveryLifecycle
      : {};
    const tenantRows = buildTenantRows(state);
    const packageRows = buildPackageRows(state, tenantRows);
    const subscriptionRows = buildSubscriptionRows(state, tenantRows);
    const invoiceRows = buildInvoiceRows(state, tenantRows);
    const paymentRows = buildPaymentRows(state, tenantRows);
    const runtimeRows = buildRuntimeRows(state);
    const deliveryAgents = runtimeRows.filter((row) => row.runtimeKind === 'delivery-agents');
    const serverBots = runtimeRows.filter((row) => row.runtimeKind === 'server-bots');
    const selectedTenantId = rawRoute.startsWith('tenant-')
      ? trimText(rawRoute.slice('tenant-'.length), 160)
      : rawRoute.startsWith('support-')
        ? trimText(rawRoute.slice('support-'.length), 160)
        : '';
    const selectedTenant = tenantRows.find((row) => row.tenantId.toLowerCase() === selectedTenantId.toLowerCase()) || null;
    const supportCase = state.ownerUi && state.ownerUi.supportCase;
    const supportSummary = buildSupportCaseSummary(supportCase);
    const analytics = overview.analytics || {};
    const outstandingTenants = tenantRows.filter((row) => row.outstandingCents > 0).length;
    const expiringTenants = tenantRows.filter((row) => {
      const date = parseDate(row.renewsAt);
      return date && ((date.getTime() - Date.now()) / 86400000) <= 14;
    }).length;
    return {
      warnings: arrayOf(state.__loadWarnings),
      overview,
      analytics,
      tenantRows,
      packageRows,
      subscriptionRows,
      invoiceRows,
      paymentRows,
      runtimeRows,
      deliveryAgents,
      serverBots,
      incidents: buildIncidentRows(state),
      requestRows: arrayOf(state.requestLogs && state.requestLogs.items).slice(0, 12),
      notifications: arrayOf(state.notifications),
      securityEvents: arrayOf(state.securityEvents),
      sessions: arrayOf(state.sessions),
      backupFiles: arrayOf(state.backupFiles),
      restoreHistory: arrayOf(state.restoreHistory),
      restoreState: state.restoreState || {},
      selectedTenantId,
      selectedTenant,
      supportSummary,
      supportCaseLoading: Boolean(state.ownerUi && state.ownerUi.supportCaseLoading),
      supportDeadLetters: arrayOf(state.ownerUi && state.ownerUi.supportDeadLetters),
      supportDeadLettersLoading: Boolean(state.ownerUi && state.ownerUi.supportDeadLettersLoading),
      automationPreview: state.ownerUi && state.ownerUi.automationPreview,
      restorePreview: state.ownerUi && state.ownerUi.restorePreview,
      deliveryLifecycle,
      deliveryRuntime: deliveryLifecycle.runtime || {},
      deliverySummary: deliveryLifecycle.summary || {},
      deliverySignals: arrayOf(deliveryLifecycle.signals),
      queueWatch: arrayOf(deliveryLifecycle.queueWatch),
      deadLetterWatch: arrayOf(deliveryLifecycle.deadLetterWatch),
      deliveryActions: arrayOf(deliveryLifecycle.actionPlan && deliveryLifecycle.actionPlan.actions),
      deliveryTopErrors: arrayOf(deliveryLifecycle.topErrors),
      controlPanelSettings: state.controlPanelSettings || {},
      managedServices: arrayOf(state.controlPanelSettings && state.controlPanelSettings.managedServices),
      adminUsers: arrayOf(state.controlPanelSettings && state.controlPanelSettings.adminUsers),
      outstandingTenants,
      expiringTenants,
      totals: {
        tenants: tenantRows.length,
        activeTenants: tenantRows.filter((row) => row.statusTone === 'success').length,
        packages: packageRows.length,
        subscriptions: subscriptionRows.length,
        sessions: arrayOf(state.sessions).length,
        notifications: arrayOf(state.notifications).filter((row) => row && row.acknowledged !== true).length,
        requestErrors: arrayOf(state.requestLogs && state.requestLogs.items).filter((row) => Number(row && row.statusCode || 0) >= 500).length,
      },
    };
  }

  function resolveRouteGroup(rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'overview';
    if (route === 'settings' || route === 'control') return 'settings';
    if (route === 'recovery') return 'recovery';
    if (route === 'audit' || route === 'security' || route === 'access' || route === 'diagnostics') return 'governance';
    if (route === 'support' || route.startsWith('support-')) return 'support';
    if (route === 'tenants' || route === 'packages' || route === 'subscriptions' || route === 'billing' || route === 'create-tenant' || route.startsWith('tenant-')) {
      return 'tenants';
    }
    if (route === 'runtime' || route === 'runtime-health' || route === 'incidents' || route === 'observability' || route === 'analytics' || route === 'jobs') {
      return 'runtime';
    }
    return 'overview';
  }

  function routeMeta(rawRoute, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'overview';
    const selectedTenantLabel = model.selectedTenant
      ? model.selectedTenant.name
      : model.selectedTenantId || 'Selected tenant';
    if (route.startsWith('tenant-')) {
      return {
        workspace: 'Tenant dossier',
        kicker: 'Tenant command context',
        title: selectedTenantLabel,
        subtitle: 'Review package state, renewals, quota pressure, runtime posture, and the next action without leaving Owner.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open tenant controls',
        primaryLocalFocus: true,
        railTitle: 'Tenant context',
        railCopy: 'This route keeps support, billing, and entitlement context close to the selected tenant.',
      };
    }
    if (route.startsWith('support-')) {
      return {
        workspace: 'Support context',
        kicker: 'Customer support dossier',
        title: selectedTenantLabel,
        subtitle: 'Keep evidence, follow-up actions, dead letters, and identity review together while working a tenant case.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open support actions',
        primaryLocalFocus: true,
        railTitle: 'Support context',
        railCopy: 'The Owner surface stays in platform scope while loading tenant-specific support evidence here.',
      };
    }
    const map = {
      overview: {
        workspace: 'Owner command surface',
        kicker: 'Platform command overview',
        title: 'Platform overview',
        subtitle: 'Track tenants, commercial posture, runtime split, and the incidents that need intervention first.',
        primaryHref: '/owner/tenants',
        primaryLabel: 'Open tenant registry',
        railTitle: 'Owner scope',
        railCopy: 'This view is tuned for fast platform triage rather than tenant-level editing.',
      },
      tenants: {
        workspace: 'Commercial and tenant registry',
        kicker: 'Tenants, packages, and renewals',
        title: 'Tenants and commercial posture',
        subtitle: 'Use one surface for customer records, plan assignment, billing watchlists, and tenant-specific follow-through.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open tenant controls',
        primaryLocalFocus: true,
        railTitle: 'Tenant operations',
        railCopy: 'Registry, package drift, subscription renewal, and quota pressure stay together in this workspace.',
      },
      packages: {
        workspace: 'Package governance',
        kicker: 'Plans and entitlements',
        title: 'Packages and entitlements',
        subtitle: 'Review package definitions, feature exposure, and how many tenants each plan actually touches before you change it.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Edit package catalog',
        primaryLocalFocus: true,
        railTitle: 'Entitlement posture',
        railCopy: 'Backend-driven package logic remains intact while this view makes plan impact legible.',
      },
      subscriptions: {
        workspace: 'Subscription lifecycle',
        kicker: 'Renewals and billing watch',
        title: 'Subscriptions and renewals',
        subtitle: 'Follow contracts that are expiring, suspended, or at risk before they become service-impacting incidents.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open renewal controls',
        primaryLocalFocus: true,
        railTitle: 'Commercial risk',
        railCopy: 'Move from tenant list to renewal action without leaving the Owner command surface.',
      },
      billing: {
        workspace: 'Billing operations',
        kicker: 'Invoices and payment attempts',
        title: 'Revenue and billing operations',
        subtitle: 'Inspect invoice state, payment attempts, checkout recovery, and outstanding balances in one place.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open billing controls',
        primaryLocalFocus: true,
        railTitle: 'Revenue protection',
        railCopy: 'This view keeps invoice status, payment failures, and retry actions close to the affected tenant.',
      },
      'runtime-health': {
        workspace: 'Runtime command',
        kicker: 'Delivery Agents and Server Bots',
        title: 'Runtime health and fleet posture',
        subtitle: 'Keep Delivery Agent and Server Bot posture clearly separated while still seeing the full platform health picture.',
        primaryHref: '#jobs',
        primaryLabel: 'Jump to runtime queues',
        railTitle: 'Runtime split',
        railCopy: 'Delivery Agent and Server Bot responsibilities remain separate in language, tables, and actions.',
      },
      incidents: {
        workspace: 'Incident command',
        kicker: 'Live platform anomalies',
        title: 'Incidents and active signals',
        subtitle: 'Use the incident lane to decide what affects the platform now, then drill into the owning runtime or tenant.',
        primaryHref: '#incidents',
        primaryLabel: 'Focus active incident lane',
        primaryLocalFocus: true,
        railTitle: 'Incident discipline',
        railCopy: 'Evidence, severity, and follow-up stay visible without forcing a backend change.',
      },
      observability: {
        workspace: 'Observability',
        kicker: 'Request and delivery telemetry',
        title: 'Requests, latency, and telemetry',
        subtitle: 'Review request hotspots, delivery lag, and platform signals before escalating into a deeper recovery step.',
        primaryHref: '#observability',
        primaryLabel: 'Focus telemetry lane',
        primaryLocalFocus: true,
        railTitle: 'Telemetry',
        railCopy: 'Optional reads hydrate here without blocking the rest of the Owner surface.',
      },
      analytics: {
        workspace: 'Observability',
        kicker: 'Request and delivery telemetry',
        title: 'Requests, latency, and telemetry',
        subtitle: 'Review request hotspots, delivery lag, and platform signals before escalating into a deeper recovery step.',
        primaryHref: '#observability',
        primaryLabel: 'Focus telemetry lane',
        primaryLocalFocus: true,
        railTitle: 'Telemetry',
        railCopy: 'Optional reads hydrate here without blocking the rest of the Owner surface.',
      },
      jobs: {
        workspace: 'Runtime queues',
        kicker: 'Provisioning and delivery execution',
        title: 'Queues, provisioning, and runtime backlog',
        subtitle: 'Track provisioning tokens, device binding, and delayed delivery work without blending runtime roles together.',
        primaryHref: '#jobs',
        primaryLabel: 'Focus backlog lane',
        primaryLocalFocus: true,
        railTitle: 'Queue posture',
        railCopy: 'Pending work, stale tokens, and dead-letter follow-up stay visible alongside the runtime split.',
      },
      support: {
        workspace: 'Support command',
        kicker: 'Customer escalation and diagnostics',
        title: 'Support and diagnostics',
        subtitle: 'Keep customer context, dead letters, notifications, and evidence together before handing off to a tenant.',
        primaryHref: '#support',
        primaryLabel: 'Focus support lane',
        primaryLocalFocus: true,
        railTitle: 'Support posture',
        railCopy: 'Support context stays platform-scoped until you explicitly reassign back to tenant operations.',
      },
      audit: {
        workspace: 'Governance',
        kicker: 'Audit and sessions',
        title: 'Audit log and operator sessions',
        subtitle: 'Inspect who changed what, which sessions are still active, and which signals need acknowledgment.',
        primaryHref: '#audit',
        primaryLabel: 'Focus audit lane',
        primaryLocalFocus: true,
        railTitle: 'Governance',
        railCopy: 'Audit, notification, and security posture remain visible without leaving Owner context.',
      },
      security: {
        workspace: 'Security posture',
        kicker: 'Access and suspicious activity',
        title: 'Security and access posture',
        subtitle: 'Review sessions, security events, and follow-up actions before revoking access or escalating an incident.',
        primaryHref: '#security',
        primaryLabel: 'Focus security lane',
        primaryLocalFocus: true,
        railTitle: 'Security posture',
        railCopy: 'Use this view to separate suspicious behavior from routine support noise.',
      },
      settings: {
        workspace: 'Platform policy',
        kicker: 'Shared settings and automation',
        title: 'Settings and automation',
        subtitle: 'Review env policy, managed services, admin users, and automation posture while keeping the current backend contract intact.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open settings controls',
        primaryLocalFocus: true,
        railTitle: 'Policy context',
        railCopy: 'Settings changes still flow through existing env and auth mutations.',
      },
      control: {
        workspace: 'Platform controls',
        kicker: 'Shared settings and service controls',
        title: 'Platform controls',
        subtitle: 'Keep service restarts, admin users, and platform-wide settings inside the existing owner control workspace.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open platform controls',
        primaryLocalFocus: true,
        railTitle: 'Control context',
        railCopy: 'Legacy control routes stay wired to the same settings and automation backend flows.',
      },
      access: {
        workspace: 'Access posture',
        kicker: 'Sessions and access evidence',
        title: 'Access and operator sessions',
        subtitle: 'Review active sessions, access posture, and security signals before revoking or escalating.',
        primaryHref: '#audit',
        primaryLabel: 'Focus access lane',
        primaryLocalFocus: true,
        railTitle: 'Access context',
        railCopy: 'Legacy access routes stay connected to the current audit and security evidence flow.',
      },
      diagnostics: {
        workspace: 'Diagnostics and evidence',
        kicker: 'Evidence export and platform review',
        title: 'Diagnostics and evidence',
        subtitle: 'Collect request evidence, notification backlog, and export-ready diagnostics without changing the existing backend flows.',
        primaryHref: '#audit',
        primaryLabel: 'Focus diagnostics lane',
        primaryLocalFocus: true,
        railTitle: 'Diagnostics context',
        railCopy: 'Legacy diagnostics routes stay mapped to the current audit, notification, and export surfaces.',
      },
      recovery: {
        workspace: 'Maintenance and recovery',
        kicker: 'Backups and restore posture',
        title: 'Backup, restore, and recovery',
        subtitle: 'Use dry-run restore previews, backup inventory, and recent restore history before applying shared recovery actions.',
        primaryHref: '#owner-control-workspace',
        primaryLabel: 'Open recovery controls',
        primaryLocalFocus: true,
        railTitle: 'Recovery context',
        railCopy: 'Dry-run preview and restore history stay visible beside the action forms.',
      },
    };
    return map[route] || map.overview;
  }

  function renderButton(href, label, options) {
    const config = options || {};
    const attrs = [];
    if (config.localFocus) attrs.push('data-owner-local-focus="1"');
    return `<a class="odv4-button ${escapeHtml(config.primary ? 'odv4-button-primary' : 'odv4-button-secondary')}" href="${escapeHtml(href)}" ${attrs.join(' ')}>${escapeHtml(translateOwnerLiteral(label))}</a>`;
  }

  function renderMetricCard(label, value, detail, tone) {
    return [
      '<article class="ownerx-metric-card">',
      `<div class="ownerx-metric-label">${escapeHtml(translateOwnerLiteral(label))}</div>`,
      `<div class="ownerx-metric-value">${escapeHtml(translateOwnerLiteral(value))}</div>`,
      `<div class="ownerx-metric-detail">${chip(detail, tone || 'muted')}</div>`,
      '</article>',
    ].join('');
  }

  function renderSection(id, focusRoute, kicker, title, copy, body, actionsHtml) {
    const attrs = [];
    if (id) attrs.push(`id="${escapeHtml(id)}"`);
    if (focusRoute) attrs.push(`data-owner-focus-route="${escapeHtml(focusRoute)}"`);
    return [
      `<section class="ownerx-section odv4-focus-target" ${attrs.join(' ')}>`,
      '<div class="ownerx-section-head">',
      '<div class="ownerx-pagehead-copy">',
      `<div class="ownerx-section-kicker odv4-section-kicker">${escapeHtml(translateOwnerLiteral(kicker || ''))}</div>`,
      `<h2 class="ownerx-section-title odv4-section-title">${escapeHtml(translateOwnerLiteral(title || ''))}</h2>`,
      `<p class="ownerx-section-copy odv4-section-copy">${escapeHtml(translateOwnerLiteral(copy || ''))}</p>`,
      '</div>',
      actionsHtml ? `<div class="ownerx-button-row">${actionsHtml}</div>` : '',
      '</div>',
      body || '',
      '</section>',
    ].join('');
  }

  function renderTable(headers, rows, emptyText) {
    if (!rows.length) {
      return `<div class="ownerx-empty"><strong>${escapeHtml(translateOwnerLiteral('No data'))}</strong><div class="ownerx-empty-copy">${escapeHtml(translateOwnerLiteral(emptyText || 'Nothing to show yet.'))}</div></div>`;
    }
    return [
      '<div class="ownerx-table-wrap">',
      '<table class="ownerx-table">',
      '<thead><tr>',
      headers.map((header) => `<th>${escapeHtml(translateOwnerLiteral(header))}</th>`).join(''),
      '</tr></thead>',
      '<tbody>',
      rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join(''),
      '</tbody>',
      '</table>',
      '</div>',
    ].join('');
  }

  function renderSidebar(rawRoute, group, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'overview';
    const isActive = (item) => item.routes.includes(route)
      || ((route === 'create-tenant' || route.startsWith('tenant-')) && item.routes.includes('tenants'))
      || (route.startsWith('support-') && item.routes.includes('support'))
      || (route === 'control' && item.routes.includes('settings'))
      || (route === 'access' && item.routes.includes('security'))
      || (route === 'diagnostics' && item.routes.includes('audit'));
    const navCount = (itemLabel) => {
      if (itemLabel === 'Tenants') return formatNumber(model.totals.tenants);
      if (itemLabel === 'Packages') return formatNumber(model.packageRows.length);
      if (itemLabel === 'Subscriptions') return formatNumber(model.totals.subscriptions);
      if (itemLabel === 'Billing') return formatNumber(model.invoiceRows.length);
      if (itemLabel === 'Runtime health') return formatNumber(model.runtimeRows.length);
      if (itemLabel === 'Incidents') return formatNumber(model.incidents.length);
      if (itemLabel === 'Observability') return formatNumber(model.requestRows.length);
      if (itemLabel === 'Queues & jobs') return formatNumber(model.queueWatch.length + model.deadLetterWatch.length);
      if (itemLabel === 'Support') return formatNumber(model.notifications.length);
      if (itemLabel === 'Audit') return formatNumber(model.totals.sessions);
      if (itemLabel === 'Security') return formatNumber(model.securityEvents.length);
      if (itemLabel === 'Access') return formatNumber(model.sessions.length);
      if (itemLabel === 'Diagnostics') return formatNumber(model.totals.requestErrors + model.totals.notifications);
      if (itemLabel === 'Platform controls') return formatNumber(model.managedServices.length);
      if (itemLabel === 'Recovery') return formatNumber(model.backupFiles.length);
      return '';
    };
    return [
      '<aside class="ownerx-sidebar odv4-sidebar">',
      '<div class="ownerx-brand-block">',
      '<div class="ownerx-nav-eyebrow">Owner control plane</div>',
      '<h2 class="ownerx-brand-title">SCUM Operator</h2>',
      '<div class="ownerx-brand-copy">Production-safe frontend layer over the existing Owner routes, auth, and API contracts.</div>',
      '</div>',
      NAV_GROUPS.map((groupItem) => [
        '<section class="ownerx-nav-group">',
        `<div class="ownerx-nav-eyebrow">${escapeHtml(groupItem.title)}</div>`,
        '<nav class="ownerx-nav-list">',
        groupItem.items.map((item) => [
          `<a class="ownerx-nav-link ${isActive(item) ? 'is-active' : ''}" href="${escapeHtml(item.href)}">`,
          `<span>${escapeHtml(item.label)}</span>`,
          `<span class="ownerx-nav-count">${escapeHtml(navCount(item.label))}</span>`,
          '</a>',
        ].join('')).join(''),
        '</nav>',
        '</section>',
      ].join('')).join(''),
      '<section class="ownerx-nav-summary">',
      `<div class="ownerx-nav-eyebrow">${escapeHtml(group === 'runtime' ? 'Runtime split' : group === 'tenants' ? 'Commercial watch' : 'Platform watch')}</div>`,
      `<div class="ownerx-list-meta">${escapeHtml(
        group === 'runtime'
          ? `${formatNumber(model.deliveryAgents.length)} Delivery Agents · ${formatNumber(model.serverBots.length)} Server Bots`
          : `${formatNumber(model.outstandingTenants)} tenants with outstanding billing · ${formatNumber(model.expiringTenants)} expiring soon`
      )}</div>`,
      '<div class="ownerx-chip-row">',
      chip(`${formatNumber(model.totals.notifications)} open notifications`, model.totals.notifications ? 'warning' : 'success'),
      chip(`${formatNumber(model.totals.requestErrors)} request errors`, model.totals.requestErrors ? 'danger' : 'success'),
      '</div>',
      '</section>',
      '</aside>',
    ].join('');
  }

  function renderPageHead(rawRoute, meta, model) {
    const warningHtml = model.warnings.length
      ? `<div class="ownerx-callout" data-tone="warning"><strong>${escapeHtml(translateOwnerLiteral('Partial data loaded'))}</strong><div>${escapeHtml(model.warnings.map((item) => translateOwnerLiteral(item)).join(', '))}</div></div>`
      : '';
    return [
      `<section class="ownerx-pagehead odv4-pagehead odv4-focus-target" id="${escapeHtml(trimText(rawRoute, 160) || 'overview')}" data-owner-focus-route="${escapeHtml(trimText(rawRoute, 160) || 'overview')}">`,
      '<div class="ownerx-pagehead-top">',
      '<div class="ownerx-pagehead-copy">',
      `<div class="odv4-workspace-label">${escapeHtml(translateOwnerLiteral(meta.workspace))}</div>`,
      `<div class="ownerx-section-kicker odv4-section-kicker">${escapeHtml(translateOwnerLiteral(meta.kicker))}</div>`,
      `<h1 class="ownerx-page-title odv4-page-title">${escapeHtml(translateOwnerLiteral(meta.title))}</h1>`,
      `<p class="ownerx-page-subtitle odv4-page-subtitle">${escapeHtml(translateOwnerLiteral(meta.subtitle))}</p>`,
      '</div>',
      `<div class="odv4-pagehead-actions ownerx-pagehead-actions">${renderButton(meta.primaryHref, meta.primaryLabel, { primary: true, localFocus: meta.primaryLocalFocus })}</div>`,
      '</div>',
      warningHtml,
      '</section>',
    ].join('');
  }

  function renderOverviewGroup(model) {
    const analytics = model.analytics || {};
    const tenantAnalytics = analytics.tenants || {};
    const subscriptionAnalytics = analytics.subscriptions || {};
    const deliveryAnalytics = analytics.delivery || {};
    const attentionRows = model.tenantRows
      .filter((row) => row.outstandingCents > 0 || row.quotaTone === 'warning' || row.quotaTone === 'danger')
      .slice(0, 8)
      .map((row) => ([
        `<strong>${escapeHtml(row.name)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.owner)}</div>`,
        `${chip(row.status, row.statusTone)}<div class="ownerx-table-subcopy">${escapeHtml(row.packageName)}</div>`,
        `${chip(row.quotaText, row.quotaTone)}<div class="ownerx-table-subcopy">${escapeHtml(row.licenseState)}</div>`,
        `${escapeHtml(row.outstandingCents > 0 ? formatCurrencyCents(row.outstandingCents) : 'No outstanding')}`,
        `<div class="ownerx-button-row"><a class="ownerx-link" href="/owner/tenants/${encodeURIComponent(row.tenantId)}">Open tenant</a><a class="ownerx-link" href="/owner/support/${encodeURIComponent(row.tenantId)}">Support</a></div>`,
      ]));
    const incidents = model.incidents.slice(0, 5).map((row) => [
      '<div class="ownerx-list-item">',
      `<div class="ownerx-inline">${chip(row.title, row.tone)}<span class="ownerx-muted">${escapeHtml(formatRelative(row.at, 'No timestamp'))}</span></div>`,
      `<strong>${escapeHtml(row.detail)}</strong>`,
      '</div>',
    ].join(''));

    return [
      renderSection(
        'overview',
        'overview',
        'Platform overview',
        'Current platform posture',
        'Use this lane for the current managed-service view: tenants, runtime split, revenue posture, and live anomalies.',
        [
          '<div class="ownerx-card-grid">',
          `<div class="ownerx-card"><div class="ownerx-panel-label">Tenant footprint</div><strong>${formatNumber(tenantAnalytics.total || model.totals.tenants)}</strong><div class="ownerx-muted">${formatNumber(tenantAnalytics.active || model.totals.activeTenants)} active · ${formatNumber(tenantAnalytics.trialing || model.expiringTenants)} trialing</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Subscription posture</div><strong>${formatCurrencyCents(subscriptionAnalytics.mrrCents || 0)}</strong><div class="ownerx-muted">${formatNumber(subscriptionAnalytics.total || model.subscriptionRows.length)} subscriptions · ${formatNumber(subscriptionAnalytics.active || model.subscriptionRows.filter((row) => toneForStatus(row.status) === 'success').length)} active</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Runtime split</div><strong>${formatNumber(model.deliveryAgents.length + model.serverBots.length)}</strong><div class="ownerx-muted">${formatNumber(model.deliveryAgents.length)} Delivery Agents · ${formatNumber(model.serverBots.length)} Server Bots</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Delivery pressure</div><strong>${formatNumber(deliveryAnalytics.queueDepth || 0)}</strong><div class="ownerx-muted">${formatNumber(deliveryAnalytics.failedJobs || 0)} failed jobs · ${formatPercent(deliveryAnalytics.failureRatePct || 0)}</div></div>`,
          '</div>',
        ].join('')
      ),
      renderSection(
        'commercial-watch',
        '',
        'Commercial attention',
        'Tenants that need action',
        'This watchlist keeps billing, quota, and package pressure close to the tenant records that need intervention first.',
        renderTable(
          ['Tenant', 'Status', 'Quota / license', 'Outstanding', 'Actions'],
          attentionRows,
          'No tenant is currently breaching billing or quota thresholds.'
        )
      ),
      renderSection(
        'incident-brief',
        '',
        'Active signals',
        'Recent incident feed',
        'The Owner surface should make active incidents obvious even before you drill into runtime or support.',
        incidents.length
          ? `<div class="ownerx-list">${incidents.join('')}</div>`
          : '<div class="ownerx-empty"><strong>No incident feed</strong><div class="ownerx-empty-copy">No recent request, notification, or security signal is loaded.</div></div>'
      ),
    ].join('');
  }

  function renderTenantDetailCard(row) {
    if (!row) {
      return '<div class="ownerx-empty"><strong>No tenant selected</strong><div class="ownerx-empty-copy">Open a tenant route from the registry to load a focused tenant dossier here.</div></div>';
    }
    const nextRenewal = row.renewsAt ? formatDateTime(row.renewsAt, 'Not scheduled') : 'Not scheduled';
    return [
      '<div class="ownerx-card-grid">',
      `<div class="ownerx-card"><div class="ownerx-panel-label">Tenant</div><strong>${escapeHtml(row.name)}</strong><div class="ownerx-muted">${escapeHtml(row.owner)}</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Package</div><strong>${escapeHtml(row.packageName)}</strong><div class="ownerx-muted">${chip(row.status, row.statusTone)}</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Renewal</div><strong>${escapeHtml(nextRenewal)}</strong><div class="ownerx-muted">${escapeHtml(row.locale.toUpperCase())}</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Billing</div><strong>${escapeHtml(row.outstandingCents > 0 ? formatCurrencyCents(row.outstandingCents) : 'No outstanding')}</strong><div class="ownerx-muted">${escapeHtml(row.licenseState)}</div></div>`,
      '</div>',
      '<div class="ownerx-button-row">',
      `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="set-tenant-status" data-tenant-id="${escapeHtml(row.tenantId)}" data-target-status="${escapeHtml(row.status.toLowerCase() === 'suspended' ? 'active' : 'suspended')}">${escapeHtml(row.status.toLowerCase() === 'suspended' ? 'Reactivate tenant' : 'Suspend tenant')}</button>`,
      `<a class="odv4-button odv4-button-secondary" href="/owner/support/${encodeURIComponent(row.tenantId)}">Open support context</a>`,
      '</div>',
    ].join('');
  }

  function renderTenantsGroup(rawRoute, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'tenants';
    const tenantRows = model.tenantRows.slice(0, 24).map((row) => ([
      `<strong>${escapeHtml(row.name)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.owner)}</div>`,
      `${chip(row.status, row.statusTone)}<div class="ownerx-table-subcopy">${escapeHtml(row.packageName)}</div>`,
      `${escapeHtml(row.renewsAt ? formatDateTime(row.renewsAt) : 'Not scheduled')}`,
      `${escapeHtml(row.outstandingCents > 0 ? formatCurrencyCents(row.outstandingCents) : 'No outstanding')}`,
      `${chip(row.quotaText, row.quotaTone)}`,
      `<div class="ownerx-button-row"><a class="ownerx-link" href="/owner/tenants/${encodeURIComponent(row.tenantId)}">Open</a><a class="ownerx-link" href="/owner/support/${encodeURIComponent(row.tenantId)}">Support</a></div>`,
    ]));
    const packageCards = model.packageRows.slice(0, 8).map((row) => [
      '<article class="ownerx-card">',
      `<div class="ownerx-panel-label">${escapeHtml(row.id)}</div>`,
      `<strong>${escapeHtml(row.title)}</strong>`,
      `<div class="ownerx-muted">${escapeHtml(row.description)}</div>`,
      `<div class="ownerx-chip-row">${chip(row.status, toneForStatus(row.status))}${chip(`${formatNumber(row.activeTenants)} tenants`, row.activeTenants ? 'info' : 'muted')}</div>`,
      `<div class="ownerx-list-meta">${escapeHtml(row.features.slice(0, 3).join(' · ') || 'No feature summary')}</div>`,
      '</article>',
    ].join(''));
    const subscriptionRows = model.subscriptionRows.slice(0, 16).map((row) => ([
      `<strong>${escapeHtml(row.tenantName)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.packageName)}</div>`,
      `${chip(row.status, toneForStatus(row.status))}<div class="ownerx-table-subcopy">${escapeHtml(row.billingCycle)}</div>`,
      `${escapeHtml(row.renewsAt ? formatDateTime(row.renewsAt) : 'Not scheduled')}`,
      `${escapeHtml(formatCurrencyCents(row.amountCents, row.currency))}`,
      `<div class="ownerx-button-row"><a class="ownerx-link" href="/owner/tenants/${encodeURIComponent(row.tenantId)}">Tenant</a><a class="ownerx-link" href="/owner/subscriptions">Billing</a></div>`,
    ]));
    const billingRows = model.invoiceRows.slice(0, 12).map((row) => ([
      `<strong>${escapeHtml(row.tenantName)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.id)}</div>`,
      chip(row.status, toneForStatus(row.status)),
      escapeHtml(formatCurrencyCents(row.amountCents, row.currency)),
      escapeHtml(formatDateTime(row.createdAt)),
      `<div class="ownerx-button-row">${
        trimText(row.status, 40).toLowerCase() !== 'paid'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-billing-invoice-status" data-tenant-id="${escapeHtml(row.tenantId)}" data-invoice-id="${escapeHtml(row.id)}" data-target-status="paid">Mark paid</button>`
          : ''
      }</div>`,
    ]));
    const paymentAttemptRows = model.paymentRows.slice(0, 12).map((row) => ([
      `<strong>${escapeHtml(row.tenantName)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.id || row.invoiceId || '-')}</div>`,
      chip(row.status, toneForStatus(row.status)),
      escapeHtml(firstNonEmpty([row.provider], '-')),
      escapeHtml(formatCurrencyCents(row.amountCents, row.currency)),
      escapeHtml(formatDateTime(row.createdAt)),
      `<div class="ownerx-button-row">${
        trimText(row.status, 40).toLowerCase() !== 'succeeded'
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="update-payment-attempt-status" data-tenant-id="${escapeHtml(row.tenantId)}" data-attempt-id="${escapeHtml(row.id)}" data-target-status="succeeded">Mark succeeded</button>`
          : ''
      }</div>`,
    ]));
    const createTenantBody = [
      '<div class="ownerx-card-grid">',
      `<div class="ownerx-card"><div class="ownerx-panel-label">Package choices</div><strong>${escapeHtml(formatNumber(model.packageRows.length))}</strong><div class="ownerx-muted">Review active plans before assigning a new tenant to a package.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Active tenants</div><strong>${escapeHtml(formatNumber(model.totals.activeTenants))}</strong><div class="ownerx-muted">Use current customer posture as the baseline for onboarding.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Expiring soon</div><strong>${escapeHtml(formatNumber(model.expiringTenants))}</strong><div class="ownerx-muted">Existing renewals often show the same package and quota questions a new tenant will ask.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Outstanding follow-up</div><strong>${escapeHtml(formatNumber(model.outstandingTenants))}</strong><div class="ownerx-muted">Clear commercial debt before activating more load on the platform.</div></div>`,
      '</div>',
    ].join('');
    const tenantHandoffBody = model.selectedTenant
      ? [
          '<div class="ownerx-card-grid">',
          `<div class="ownerx-card"><div class="ownerx-panel-label">Tenant owner</div><strong>${escapeHtml(model.selectedTenant.owner)}</strong><div class="ownerx-muted">${escapeHtml(model.selectedTenant.tenantId)}</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Next renewal</div><strong>${escapeHtml(model.selectedTenant.renewsAt ? formatDateTime(model.selectedTenant.renewsAt, 'Not scheduled') : 'Not scheduled')}</strong><div class="ownerx-muted">${escapeHtml(model.selectedTenant.licenseState)}</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Current quota</div><strong>${escapeHtml(model.selectedTenant.quotaText)}</strong><div class="ownerx-muted">${escapeHtml(model.selectedTenant.packageName)}</div></div>`,
          '</div>',
          `<div class="ownerx-button-row">${renderButton(`/owner/support/${encodeURIComponent(model.selectedTenant.tenantId)}`, 'Open support context', {})}${renderButton('#owner-control-workspace', 'Open tenant controls', { primary: true, localFocus: true })}</div>`,
        ].join('')
      : '<div class="ownerx-empty"><strong>No tenant selected</strong><div class="ownerx-empty-copy">Open a tenant route from the registry to load a focused tenant handoff lane here.</div></div>';

    const sections = {
      createTenant: renderSection(
        'create-tenant',
        'create-tenant',
        'Tenant onboarding',
        'Create and activate tenant',
        'Start new tenant creation here, then use the existing owner control workspace for the real mutation and activation flow.',
        createTenantBody,
        `${renderButton('#owner-control-workspace', 'Open create-tenant controls', { primary: true, localFocus: true })}${renderButton('/owner/packages', 'Review packages', {})}`
      ),
      tenantFocus: renderSection(
        model.selectedTenant ? `tenant-${model.selectedTenant.tenantId}` : 'tenants',
        model.selectedTenant ? `tenant-${model.selectedTenant.tenantId}` : 'tenants',
        'Tenant registry',
        model.selectedTenant ? 'Focused tenant dossier' : 'Tenant registry',
        model.selectedTenant
          ? 'The selected tenant stays pinned here while package, renewal, and support actions remain available below.'
          : 'Use this registry to move between customer records, entitlement posture, renewals, and support context.',
        renderTenantDetailCard(model.selectedTenant)
      ),
      registry: renderSection(
        'tenants',
        'tenants',
        'Tenant registry',
        'All tenants',
        'This table stays dense on purpose: it is the fastest path from tenant status to the next owner action.',
        renderTable(['Tenant', 'Status / package', 'Renewal', 'Outstanding', 'Quota', 'Actions'], tenantRows, 'No tenants are loaded.')
      ),
      packages: renderSection(
        'packages',
        'packages',
        'Package catalog',
        'Active package definitions',
        'Review package usage before changing entitlement definitions or moving tenants across plans.',
        packageCards.length ? `<div class="ownerx-card-grid">${packageCards.join('')}</div>` : '<div class="ownerx-empty"><strong>No package catalog</strong><div class="ownerx-empty-copy">No package definitions are currently available from the overview payload.</div></div>'
      ),
      subscriptions: renderSection(
        'subscriptions',
        'subscriptions',
        'Renewals',
        'Subscription watchlist',
        'Expiring, paused, or active subscriptions can be reviewed here before you open tenant-specific controls.',
        renderTable(['Tenant', 'Status', 'Renews at', 'Amount', 'Actions'], subscriptionRows, 'No subscriptions are loaded.')
      ),
      billing: renderSection(
        'billing',
        'billing',
        'Billing',
        'Invoice watchlist',
        'Use invoice state and payment attempts to decide whether the problem is billing, entitlement, or support.',
        renderTable(['Tenant', 'Status', 'Amount', 'Created', 'Actions'], billingRows, 'No invoices are loaded.')
      ),
      payments: renderSection(
        'payment-attempts',
        'billing',
        'Payment attempts',
        'Checkout recovery lane',
        'Payment attempts stay visible next to invoice state so the Owner can recover revenue without changing the backend billing flow.',
        renderTable(['Tenant', 'Status', 'Provider', 'Amount', 'Created', 'Actions'], paymentAttemptRows, 'No payment attempts are loaded.')
      ),
      handoff: renderSection(
        'tenant-handoff',
        route.startsWith('tenant-') ? route : 'tenants',
        'Next action',
        'Owner handoff lane',
        'Move from tenant context to support, package review, or the existing control forms without losing commercial posture.',
        tenantHandoffBody
      ),
    };
    const order = route === 'packages'
      ? ['packages', 'registry', 'subscriptions', 'billing', 'payments', 'tenantFocus', 'handoff']
      : route === 'subscriptions'
        ? ['subscriptions', 'billing', 'payments', 'registry', 'packages', 'tenantFocus', 'handoff']
        : route === 'billing'
          ? ['billing', 'payments', 'subscriptions', 'registry', 'packages', 'tenantFocus', 'handoff']
          : route === 'create-tenant'
            ? ['createTenant', 'packages', 'registry', 'subscriptions', 'billing', 'payments']
            : route.startsWith('tenant-')
              ? ['tenantFocus', 'handoff', 'subscriptions', 'billing', 'packages', 'registry', 'payments']
              : ['tenantFocus', 'registry', 'packages', 'subscriptions', 'billing', 'payments'];
    return order.map((key) => sections[key]).join('');
  }

  function renderRuntimeActionButtons(row) {
    const buttons = [
      `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="inspect-runtime" data-runtime-key="${escapeHtml(row.runtimeKey)}">Inspect runtime</button>`,
    ];
    if (row.tenantId) {
      buttons.push(`<a class="odv4-button odv4-button-secondary" href="/owner/tenants/${encodeURIComponent(row.tenantId)}">Tenant</a>`);
    }
    if (row.runtimeKey) {
      buttons.push(
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reissue-runtime-token" data-runtime-key="${escapeHtml(row.runtimeKey)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-server-id="${escapeHtml(row.serverId)}" data-guild-id="${escapeHtml(row.guildId)}" data-agent-id="${escapeHtml(row.agentId)}" data-role="${escapeHtml(row.role)}" data-scope="${escapeHtml(row.scope)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}" data-display-name="${escapeHtml(row.displayName)}" data-minimum-version="${escapeHtml(row.minimumVersion)}">Reissue token</button>`
      );
    }
    if (row.deviceId) {
      buttons.push(
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="reset-runtime-binding" data-device-id="${escapeHtml(row.deviceId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">Reset binding</button>`
      );
    }
    if (row.apiKeyId || row.provisionTokenId) {
      buttons.push(
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-runtime" data-api-key-id="${escapeHtml(row.apiKeyId)}" data-token-id="${escapeHtml(row.provisionTokenId)}" data-tenant-id="${escapeHtml(row.tenantId)}" data-runtime-kind="${escapeHtml(row.runtimeKind)}">Revoke</button>`
      );
    }
    return `<div class="ownerx-button-row">${buttons.join('')}</div>`;
  }

  function renderRuntimeGroup(rawRoute, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'runtime-health';
    const deliveryRows = model.deliveryAgents.slice(0, 16).map((row) => ([
      `<strong>${escapeHtml(row.displayName)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.runtimeKey)}</div>`,
      chip(row.status, toneForStatus(row.status)),
      escapeHtml(row.tenantId || '-'),
      `${escapeHtml(row.version || 'No version')}<div class="ownerx-table-subcopy">${escapeHtml(row.minimumVersion ? `min ${row.minimumVersion}` : 'No minimum')}</div>`,
      escapeHtml(formatRelative(row.lastSeenAt, 'No signal')),
      renderRuntimeActionButtons(row),
    ]));
    const botRows = model.serverBots.slice(0, 16).map((row) => ([
      `<strong>${escapeHtml(row.displayName)}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.runtimeKey)}</div>`,
      chip(row.status, toneForStatus(row.status)),
      escapeHtml(row.tenantId || '-'),
      `${escapeHtml(row.version || 'No version')}<div class="ownerx-table-subcopy">${escapeHtml(row.minimumVersion ? `min ${row.minimumVersion}` : 'No minimum')}</div>`,
      escapeHtml(formatRelative(row.lastSeenAt, 'No signal')),
      renderRuntimeActionButtons(row),
    ]));
    const incidentFeed = model.incidents.slice(0, 8).map((row) => [
      '<div class="ownerx-list-item">',
      `<div class="ownerx-inline">${chip(row.title, row.tone)}<span class="ownerx-muted">${escapeHtml(formatRelative(row.at, 'No timestamp'))}</span></div>`,
      `<strong>${escapeHtml(row.detail)}</strong>`,
      '</div>',
    ].join(''));
    const requestRows = model.requestRows.slice(0, 10).map((row) => ([
      `<strong>${escapeHtml(`${trimText(row && row.method, 12) || 'REQ'} ${trimText(row && (row.path || row.routeGroup), 160) || ''}`)}</strong>`,
      chip(String(row && row.statusCode || '-'), Number(row && row.statusCode || 0) >= 500 ? 'danger' : 'warning'),
      escapeHtml(firstNonEmpty([row && row.error, row && row.summary], '-')),
      escapeHtml(formatDateTime(firstNonEmpty([row && row.at, row && row.createdAt], ''))),
    ]));
    const queueRows = model.queueWatch.slice(0, 12).map((row) => ([
      `<strong>${escapeHtml(row.purchaseCode || '-')}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.detail || row.errorCode || 'No detail')}</div>`,
      chip(row.signalKey || row.status || 'queued', row.tone || toneForStatus(row.status)),
      escapeHtml(formatNumber(row.attempts)),
      escapeHtml(row.tenantId || '-'),
      escapeHtml(formatRelative(row.at, 'No signal')),
    ]));
    const deadLetterRows = model.deadLetterWatch.slice(0, 12).map((row) => ([
      `<strong>${escapeHtml(row.purchaseCode || '-')}</strong><div class="ownerx-table-subcopy">${escapeHtml(row.detail || row.errorCode || 'No detail')}</div>`,
      chip(row.signalKey || row.status || 'dead-letter', row.tone || toneForStatus(row.status)),
      escapeHtml(formatNumber(row.attempts)),
      escapeHtml(row.tenantId || '-'),
      `<div class="ownerx-button-row">${
        row.tenantId && row.purchaseCode
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-dead-letter" data-tenant-id="${escapeHtml(row.tenantId)}" data-purchase-code="${escapeHtml(row.purchaseCode)}" data-return-route="/owner/jobs">Retry</button><button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-dead-letter" data-tenant-id="${escapeHtml(row.tenantId)}" data-purchase-code="${escapeHtml(row.purchaseCode)}" data-return-route="/owner/jobs">Clear</button>`
          : '<span class="ownerx-muted">No action</span>'
      }</div>`,
    ]));
    const actionCards = model.deliveryActions.slice(0, 6).map((row) => [
      '<article class="ownerx-card">',
      `<div class="ownerx-panel-label">${escapeHtml(row.key || 'action')}</div>`,
      `<strong>${escapeHtml(formatNumber(row.count))}</strong>`,
      `<div class="ownerx-chip-row">${chip(row.topErrorKey || 'No top error', row.tone || 'muted')}${chip((row.codes || []).slice(0, 2).join(' · ') || 'No codes', 'info')}</div>`,
      '</article>',
    ].join(''));
    const signalCards = model.deliverySignals.slice(0, 6).map((row) => [
      '<article class="ownerx-card">',
      `<div class="ownerx-panel-label">${escapeHtml(row.key || 'signal')}</div>`,
      `<strong>${escapeHtml(formatNumber(row.count))}</strong>`,
      `<div class="ownerx-muted">${escapeHtml(firstNonEmpty([row.detail], 'No detail'))}</div>`,
      '</article>',
    ].join(''));
    const topErrorRows = model.deliveryTopErrors.slice(0, 8).map((row) => ([
      `<strong>${escapeHtml(row.key || 'UNKNOWN')}</strong>`,
      chip(formatNumber(row.count), row.tone || 'warning'),
    ]));

    const sections = {
      runtime: renderSection(
        'runtime-health',
        'runtime runtime-health',
        'Runtime split',
        'Delivery Agents vs Server Bots',
        'These roles remain separate in every table and action path even though they share the same Owner surface.',
        [
          '<div class="ownerx-split">',
          `<div class="ownerx-card"><div class="ownerx-panel-label">Delivery Agents</div><strong>${formatNumber(model.deliveryAgents.length)}</strong><div class="ownerx-chip-row">${chip(`${formatNumber(model.deliveryAgents.filter((row) => toneForStatus(row.status) === 'success').length)} healthy`, 'success')}${chip(`${formatNumber(model.deliveryAgents.filter((row) => toneForStatus(row.status) === 'danger').length)} offline`, model.deliveryAgents.some((row) => toneForStatus(row.status) === 'danger') ? 'danger' : 'muted')}</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Server Bots</div><strong>${formatNumber(model.serverBots.length)}</strong><div class="ownerx-chip-row">${chip(`${formatNumber(model.serverBots.filter((row) => toneForStatus(row.status) === 'success').length)} healthy`, 'success')}${chip(`${formatNumber(model.serverBots.filter((row) => toneForStatus(row.status) === 'danger').length)} offline`, model.serverBots.some((row) => toneForStatus(row.status) === 'danger') ? 'danger' : 'muted')}</div></div>`,
          '</div>',
        ].join('')
      ),
      jobs: renderSection(
        'jobs',
        'jobs',
        'Queues and jobs',
        'Provisioning, queue pressure, and dead letters',
        'Use this page for lifecycle pressure, retry posture, and provisioning-related drift without blending Delivery Agent and Server Bot responsibilities.',
        [
          '<div class="ownerx-card-grid">',
          `<div class="ownerx-card"><div class="ownerx-panel-label">Queue depth</div><strong>${escapeHtml(formatNumber(model.deliverySummary.queueCount || 0))}</strong><div class="ownerx-muted">${escapeHtml(formatNumber(model.deliverySummary.overdueCount || 0))} overdue</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Dead letters</div><strong>${escapeHtml(formatNumber(model.deliverySummary.deadLetterCount || 0))}</strong><div class="ownerx-muted">${escapeHtml(formatNumber(model.deliverySummary.retryableDeadLetters || 0))} retryable</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">In flight</div><strong>${escapeHtml(formatNumber(model.deliverySummary.inFlightCount || 0))}</strong><div class="ownerx-muted">${escapeHtml(formatNumber(model.deliverySummary.recentSuccessCount || 0))} recent success</div></div>`,
          '</div>',
          actionCards.length ? `<div class="ownerx-card-grid">${actionCards.join('')}</div>` : '',
          renderTable(['Queue entry', 'Signal', 'Attempts', 'Tenant', 'Age'], queueRows, 'No queue watch rows are currently loaded.'),
          renderTable(['Dead letter', 'Signal', 'Attempts', 'Tenant', 'Action'], deadLetterRows, 'No dead-letter rows are currently loaded.'),
        ].join('')
      ),
      deliveryAgents: renderSection(
        'delivery-agents',
        'jobs',
        'Delivery Agent fleet',
        'Execution-side runtime posture',
        'These rows stay focused on delivery execution, game-client-side readiness, and token / device actionability.',
        renderTable(['Delivery Agent', 'Status', 'Tenant', 'Version', 'Last signal', 'Actions'], deliveryRows, 'No Delivery Agent records are loaded.')
      ),
      serverBots: renderSection(
        'server-bots',
        '',
        'Server Bot fleet',
        'Server-side runtime posture',
        'These rows stay focused on server-side runtime health, binding state, and restart / sync readiness.',
        renderTable(['Server Bot', 'Status', 'Tenant', 'Version', 'Last signal', 'Actions'], botRows, 'No Server Bot records are loaded.')
      ),
      incidents: renderSection(
        'incidents',
        'incidents',
        'Incident feed',
        'Recent platform anomalies',
        'Request errors, notifications, and security events are grouped here to keep triage fast.',
        incidentFeed.length ? `<div class="ownerx-list">${incidentFeed.join('')}</div>` : '<div class="ownerx-empty"><strong>No incidents</strong><div class="ownerx-empty-copy">No incident feed is currently loaded.</div></div>'
      ),
      observability: renderSection(
        'observability',
        'observability analytics',
        'Telemetry',
        'Requests and error hotspots',
        'Optional observability reads hydrate this section without blocking the rest of the Owner surface.',
        [
          signalCards.length ? `<div class="ownerx-card-grid">${signalCards.join('')}</div>` : '',
          renderTable(['Request', 'Status', 'Error / summary', 'At'], requestRows, 'No request telemetry is loaded.'),
          renderTable(['Top error', 'Count'], topErrorRows, 'No aggregated delivery errors are currently loaded.'),
        ].join('')
      ),
    };
    const order = route === 'jobs'
      ? ['jobs', 'runtime', 'deliveryAgents', 'serverBots', 'incidents', 'observability']
      : route === 'incidents'
        ? ['incidents', 'jobs', 'runtime', 'deliveryAgents', 'serverBots', 'observability']
        : route === 'observability' || route === 'analytics'
          ? ['observability', 'incidents', 'jobs', 'runtime', 'deliveryAgents', 'serverBots']
          : ['runtime', 'jobs', 'deliveryAgents', 'serverBots', 'incidents', 'observability'];
    return order.map((key) => sections[key]).join('');
  }

  function renderSupportGroup(rawRoute, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'support';
    const selectedTenantLabel = model.selectedTenant
      ? model.selectedTenant.name
      : model.supportSummary && model.supportSummary.tenant
        ? model.supportSummary.tenant
        : 'No tenant selected';
    const supportSummaryBody = model.supportCaseLoading
      ? '<div class="ownerx-callout" data-tone="info"><strong>Loading support context</strong><div>The support dossier is being fetched from the current backend route.</div></div>'
      : model.supportSummary
        ? [
            '<div class="ownerx-card-grid">',
            `<div class="ownerx-card"><div class="ownerx-panel-label">Tenant</div><strong>${escapeHtml(selectedTenantLabel)}</strong><div class="ownerx-muted">${escapeHtml(model.supportSummary.summary)}</div></div>`,
            `<div class="ownerx-card"><div class="ownerx-panel-label">Loaded evidence</div><strong>${escapeHtml(model.supportSummary.counts.length ? model.supportSummary.counts.join(' / ') : 'Context loaded')}</strong><div class="ownerx-muted">Owner support context remains platform-scoped.</div></div>`,
            '</div>',
          ].join('')
        : '<div class="ownerx-empty"><strong>No support case loaded</strong><div class="ownerx-empty-copy">Open a tenant support route to hydrate customer evidence here.</div></div>';

    const notificationRows = model.notifications.slice(0, 20).map((row) => {
      const notificationId = trimText(row && row.id, 160);
      const title = firstNonEmpty([row && row.title, row && row.type], 'Notification');
      const detail = firstNonEmpty([row && row.message, row && row.summary], '-');
      const severity = firstNonEmpty([row && row.severity, row && row.status, row && row.type], 'open');
      const returnRoute = model.selectedTenantId
        ? `/owner/support/${encodeURIComponent(model.selectedTenantId)}`
        : '/owner/audit';
      const actions = row && row.acknowledged === true
        ? chip('Acknowledged', 'muted')
        : notificationId
          ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="acknowledge-notification" data-notification-id="${escapeHtml(notificationId)}" data-return-route="${escapeHtml(returnRoute)}">Acknowledge</button>`
          : '';
      return [
        `<strong>${escapeHtml(title)}</strong><div class="ownerx-table-subcopy">${escapeHtml(detail)}</div>`,
        chip(severity, toneForStatus(severity)),
        escapeHtml(formatDateTime(firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''))),
        actions || '<span class="ownerx-muted">No action</span>',
      ];
    });

    const deadLetterBody = model.supportDeadLettersLoading
      ? '<div class="ownerx-callout" data-tone="info"><strong>Loading dead letters</strong><div>The support dead-letter queue is being fetched for the selected tenant.</div></div>'
      : renderTable(
          ['Purchase / code', 'State', 'Created', 'Actions'],
          model.supportDeadLetters.slice(0, 12).map((row) => {
            const code = firstNonEmpty([row && row.purchaseCode, row && row.code], '-');
            const status = firstNonEmpty([row && row.status, row && row.reason], 'queued');
            const tenantId = trimText(row && row.tenantId, 160) || model.selectedTenantId;
            const guildId = trimText(row && row.guildId, 160);
            const actions = tenantId && code && code !== '-'
              ? `<div class="ownerx-button-row"><button class="odv4-button odv4-button-secondary" type="button" data-owner-action="retry-dead-letter" data-tenant-id="${escapeHtml(tenantId)}" data-purchase-code="${escapeHtml(code)}" data-guild-id="${escapeHtml(guildId)}">Retry</button><button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-dead-letter" data-tenant-id="${escapeHtml(tenantId)}" data-purchase-code="${escapeHtml(code)}" data-guild-id="${escapeHtml(guildId)}">Clear</button></div>`
              : '<span class="ownerx-muted">No action</span>';
            return [
              `<strong>${escapeHtml(code)}</strong><div class="ownerx-table-subcopy">${escapeHtml(firstNonEmpty([row && row.reason, row && row.message], '-'))}</div>`,
              chip(status, toneForStatus(status)),
              escapeHtml(formatDateTime(firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''))),
              actions,
            ];
          }),
          'No dead-letter items are loaded for this support context.'
        );
    const handoffBody = model.selectedTenantId
      ? [
          '<div class="ownerx-card-grid">',
          `<div class="ownerx-card"><div class="ownerx-panel-label">Selected tenant</div><strong>${escapeHtml(selectedTenantLabel)}</strong><div class="ownerx-muted">${escapeHtml(model.selectedTenantId)}</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Support context</div><strong>${escapeHtml(model.supportSummary ? 'Ready' : model.supportCaseLoading ? 'Loading' : 'Idle')}</strong><div class="ownerx-muted">${escapeHtml(model.supportSummary ? model.supportSummary.summary : 'Use the selected route to pull customer evidence into Owner.')}</div></div>`,
          `<div class="ownerx-card"><div class="ownerx-panel-label">Dead letters</div><strong>${escapeHtml(formatNumber(model.supportDeadLetters.length))}</strong><div class="ownerx-muted">Replay, clear, and support-side follow-up stay in this lane.</div></div>`,
          '</div>',
          `<div class="ownerx-button-row">${renderButton(`/owner/tenants/${encodeURIComponent(model.selectedTenantId)}`, 'Open tenant dossier', {})}${renderButton('#owner-control-workspace', 'Open support actions', { primary: true, localFocus: true })}</div>`,
        ].join('')
      : '<div class="ownerx-empty"><strong>No support route selected</strong><div class="ownerx-empty-copy">Open a tenant support route to load customer evidence and follow-up controls here.</div></div>';

    const sections = {
      support: renderSection(
        'support',
        'support',
        'Support command',
        'Support context',
        'Keep platform-owned support evidence close to notifications and delivery backlog without leaving the Owner surface.',
        supportSummaryBody
      ),
      notifications: renderSection(
        'support-notifications',
        '',
        'Notifications',
        'Signals that need acknowledgment',
        'Notifications remain actionable here without changing the backend notification flow.',
        renderTable(['Signal', 'Severity', 'At', 'Action'], notificationRows, 'No notifications are currently loaded.'),
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-acknowledged-notifications">Clear acknowledged</button>`
      ),
      deadLetters: renderSection(
        'support-dead-letters',
        '',
        'Dead letters',
        'Delivery follow-up backlog',
        'Use this lane for failed delivery jobs and support-side replay decisions.',
        deadLetterBody
      ),
      handoff: renderSection(
        'support-handoff',
        route.startsWith('support-') ? route : 'support',
        'Tenant follow-through',
        'Owner support handoff',
        'Close the loop between support evidence, delivery retries, and the tenant dossier before moving work back to operations.',
        handoffBody
      ),
    };
    const order = route.startsWith('support-')
      ? ['support', 'handoff', 'deadLetters', 'notifications']
      : ['support', 'notifications', 'deadLetters', 'handoff'];
    return order.map((key) => sections[key]).join('');
  }

  function renderGovernanceGroup(rawRoute, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'audit';
    const sessionRows = model.sessions.slice(0, 20).map((row) => {
      const sessionId = trimText(row && row.id, 160);
      const userLabel = firstNonEmpty([row && row.username, row && row.userName, row && row.email], 'Unknown operator');
      const scope = firstNonEmpty([row && row.role, row && row.tenantId], 'platform');
      const createdAt = firstNonEmpty([row && row.createdAt, row && row.lastSeenAt, row && row.issuedAt], '');
      const action = sessionId
        ? `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="revoke-admin-session" data-session-id="${escapeHtml(sessionId)}" data-session-user="${escapeHtml(userLabel)}">Revoke session</button>`
        : '<span class="ownerx-muted">No action</span>';
      return [
        `<strong>${escapeHtml(userLabel)}</strong><div class="ownerx-table-subcopy">${escapeHtml(firstNonEmpty([row && row.ip, row && row.userAgent], '-'))}</div>`,
        chip(scope, toneForStatus(scope)),
        escapeHtml(formatDateTime(createdAt)),
        action,
      ];
    });

    const securityRows = model.securityEvents.slice(0, 20).map((row) => {
      const title = firstNonEmpty([row && row.title, row && row.type, row && row.eventType], 'Security event');
      const severity = firstNonEmpty([row && row.severity, row && row.status], 'warning');
      return [
        `<strong>${escapeHtml(title)}</strong><div class="ownerx-table-subcopy">${escapeHtml(humanizeOwnerIncidentDetail(firstNonEmpty([row && row.detail, row && row.message, row && row.ip], '-')))}</div>`,
        chip(severity, toneForStatus(severity)),
        escapeHtml(formatDateTime(firstNonEmpty([row && row.at, row && row.createdAt], ''))),
      ];
    });
    const accessBody = [
      '<div class="ownerx-card-grid">',
      `<div class="ownerx-card"><div class="ownerx-panel-label">Loaded sessions</div><strong>${escapeHtml(formatNumber(model.sessions.length))}</strong><div class="ownerx-muted">Revoke live sessions from the table below when access looks wrong.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Admin users</div><strong>${escapeHtml(formatNumber(model.adminUsers.length))}</strong><div class="ownerx-muted">Cross-check operator inventory before revoking access.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Security events</div><strong>${escapeHtml(formatNumber(model.securityEvents.length))}</strong><div class="ownerx-muted">Separate suspicious access from routine support chatter.</div></div>`,
      '</div>',
      `<div class="ownerx-button-row">${renderButton('#audit', 'Review sessions', { localFocus: true })}${renderButton('#security', 'Review security signals', { localFocus: true })}</div>`,
    ].join('');
    const diagnosticsBody = [
      '<div class="ownerx-card-grid">',
      `<div class="ownerx-card"><div class="ownerx-panel-label">Request errors</div><strong>${escapeHtml(formatNumber(model.totals.requestErrors))}</strong><div class="ownerx-muted">Current telemetry errors loaded for Owner review.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Open notifications</div><strong>${escapeHtml(formatNumber(model.totals.notifications))}</strong><div class="ownerx-muted">Signals still waiting for acknowledgment.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Security events</div><strong>${escapeHtml(formatNumber(model.securityEvents.length))}</strong><div class="ownerx-muted">Security evidence stays next to audit exports here.</div></div>`,
      '</div>',
      `<div class="ownerx-button-row">${renderButton('#owner-control-workspace', 'Open export controls', { primary: true, localFocus: true })}${renderButton('/owner/support', 'Open support lane', {})}</div>`,
    ].join('');

    const sections = {
      access: renderSection(
        'access',
        'access',
        'Access posture',
        'Sessions and access review',
        'Use this lane to review active operator access before you revoke, reassign, or escalate.',
        accessBody
      ),
      audit: renderSection(
        'audit',
        'audit',
        'Audit',
        'Operator sessions',
        'Review who is still active on the platform before changing policy or revoking access.',
        renderTable(['Operator', 'Scope', 'Last activity', 'Action'], sessionRows, 'No admin sessions are loaded.')
      ),
      security: renderSection(
        'security',
        'security',
        'Security',
        'Security events',
        'Separate suspicious access and security signals from routine support or runtime noise.',
        renderTable(['Signal', 'Severity', 'At'], securityRows, 'No security events are currently loaded.')
      ),
      notifications: renderSection(
        'governance-notifications',
        '',
        'Notification backlog',
        'Unresolved owner notifications',
        'This is the governance-side view of the same notification system exposed by the backend.',
        `<div class="ownerx-card-grid"><div class="ownerx-card"><div class="ownerx-panel-label">Open notifications</div><strong>${escapeHtml(formatNumber(model.totals.notifications))}</strong><div class="ownerx-muted">${escapeHtml(formatNumber(model.notifications.filter((row) => row && row.acknowledged === true).length))} acknowledged</div></div><div class="ownerx-card"><div class="ownerx-panel-label">Request errors</div><strong>${escapeHtml(formatNumber(model.totals.requestErrors))}</strong><div class="ownerx-muted">Owner-side telemetry anomalies currently loaded.</div></div></div>`,
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="clear-acknowledged-notifications">Clear acknowledged notifications</button>`
      ),
      diagnostics: renderSection(
        'diagnostics',
        'diagnostics',
        'Diagnostics',
        'Evidence and export posture',
        'Review operational evidence here, then use the existing owner workspace for exports and deeper diagnostics actions.',
        diagnosticsBody
      ),
    };
    const order = route === 'security'
      ? ['security', 'access', 'audit', 'notifications']
      : route === 'access'
        ? ['access', 'security', 'audit', 'notifications']
      : route === 'diagnostics'
        ? ['diagnostics', 'notifications', 'audit', 'security', 'access']
        : ['audit', 'security', 'access', 'notifications'];
    return order.map((key) => sections[key]).join('');
  }

  function renderSettingsGroup(rawRoute, model) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'settings';
    const reloadRequired = model.controlPanelSettings && model.controlPanelSettings.reloadRequired === true;
    const serviceRows = model.managedServices.slice(0, 20).map((row) => {
      const key = firstNonEmpty([row && row.key], '-');
      const label = firstNonEmpty([row && row.label, row && row.key], key);
      return [
        `<strong>${escapeHtml(label)}</strong><div class="ownerx-table-subcopy">${escapeHtml(firstNonEmpty([row && row.description, row && row.pm2Name], '-'))}</div>`,
        escapeHtml(firstNonEmpty([row && row.pm2Name], '-')),
        `<button class="odv4-button odv4-button-secondary" type="button" data-owner-action="restart-managed-service" data-service-key="${escapeHtml(key)}" data-service-label="${escapeHtml(label)}">Restart service</button>`,
      ];
    });
    const adminRows = model.adminUsers.slice(0, 20).map((row) => ([
      `<strong>${escapeHtml(firstNonEmpty([row && row.username], '-'))}</strong>`,
      chip(firstNonEmpty([row && row.role], 'admin'), 'info'),
      escapeHtml(row && row.isActive === false ? 'Inactive' : 'Active'),
      escapeHtml(firstNonEmpty([row && row.tenantId], 'Platform')),
    ]));
    const automationActions = arrayOf(model.automationPreview && model.automationPreview.actions);
    const automationEvaluated = arrayOf(model.automationPreview && model.automationPreview.evaluated);
    const automationBody = model.automationPreview
      ? `<div class="ownerx-card-grid"><div class="ownerx-card"><div class="ownerx-panel-label">Automation report</div><strong>${escapeHtml(formatNumber(automationActions.length))}</strong><div class="ownerx-muted">${escapeHtml(trimText(model.automationPreview.reason, 200) || 'Manual automation preview is loaded.')}</div></div><div class="ownerx-card"><div class="ownerx-panel-label">Evaluated runtimes</div><strong>${escapeHtml(formatNumber(automationEvaluated.length))}</strong><div class="ownerx-muted">${escapeHtml(formatDateTime(model.automationPreview.generatedAt || model.automationPreview.at || '', 'No timestamp'))}</div></div></div>`
      : '<div class="ownerx-empty"><strong>No automation report</strong><div class="ownerx-empty-copy">Run a dry-run preview to inspect automation decisions without changing backend behavior.</div></div>';
    const controlBody = [
      '<div class="ownerx-card-grid">',
      `<div class="ownerx-card"><div class="ownerx-panel-label">Managed services</div><strong>${escapeHtml(formatNumber(model.managedServices.length))}</strong><div class="ownerx-muted">Restart-capable services exposed by the existing control runtime.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Reload policy</div><strong>${escapeHtml(reloadRequired ? 'Required' : 'Safe')}</strong><div class="ownerx-muted">Current env-apply posture from platform settings.</div></div>`,
      `<div class="ownerx-card"><div class="ownerx-panel-label">Automation preview</div><strong>${escapeHtml(model.automationPreview ? 'Ready' : 'Idle')}</strong><div class="ownerx-muted">Run dry-run first when platform scope is unclear.</div></div>`,
      '</div>',
      `<div class="ownerx-button-row">${renderButton('#owner-control-workspace', 'Open platform controls', { primary: true, localFocus: true })}${renderButton('#settings-services', 'Jump to managed services', { localFocus: true })}</div>`,
    ].join('');

    const sections = {
      settings: renderSection(
        'settings',
        'settings',
        'Platform settings',
        'Shared platform settings',
        'This section surfaces managed services, admin users, and automation posture while leaving existing control forms intact.',
        `<div class="ownerx-card-grid"><div class="ownerx-card"><div class="ownerx-panel-label">Admin users</div><strong>${escapeHtml(formatNumber(model.adminUsers.length))}</strong><div class="ownerx-muted">Accounts loaded from current control-panel settings.</div></div><div class="ownerx-card"><div class="ownerx-panel-label">Managed services</div><strong>${escapeHtml(formatNumber(model.managedServices.length))}</strong><div class="ownerx-muted">${escapeHtml(reloadRequired ? 'Reload or restart required after env changes.' : 'No forced reload currently flagged.')}</div></div><div class="ownerx-card"><div class="ownerx-panel-label">Automation</div><strong>${escapeHtml(model.automationPreview ? formatNumber(automationActions.length) : '0')}</strong><div class="ownerx-muted">${escapeHtml(model.automationPreview ? 'Latest preview loaded.' : 'No manual preview yet.')}</div></div></div>`
      ),
      control: renderSection(
        'control',
        'control',
        'Platform controls',
        'Service control and policy actions',
        'Use this lane when you need restart-capable services, env policy, and automation entry points close to the existing owner control workspace.',
        controlBody
      ),
      services: renderSection(
        'settings-services',
        '',
        'Managed services',
        'Service restart controls',
        'Restart actions still flow through the existing owner runtime endpoint.',
        renderTable(['Service', 'PM2 name', 'Action'], serviceRows, 'No managed services are configured.')
      ),
      adminUsers: renderSection(
        'settings-admin-users',
        '',
        'Admin users',
        'Owner and operator accounts',
        'Account creation and edits still happen in the injected control workspace directly below the KPI strip.',
        renderTable(['Username', 'Role', 'State', 'Tenant scope'], adminRows, 'No admin users are currently loaded.')
      ),
      automation: renderSection(
        'settings-automation',
        '',
        'Automation',
        'Automation preview and execution',
        'Keep dry-run and live automation separate so the Owner can inspect impact before forcing platform actions.',
        automationBody,
        `<div class="ownerx-button-row"><button class="odv4-button odv4-button-secondary" type="button" data-owner-action="run-platform-automation" data-dry-run="true">Run dry-run</button><button class="odv4-button odv4-button-primary" type="button" data-owner-action="run-platform-automation" data-dry-run="false">Run live automation</button></div>`
      ),
    };
    const order = route === 'control'
      ? ['control', 'services', 'adminUsers', 'automation', 'settings']
      : ['settings', 'services', 'adminUsers', 'automation'];
    return order.map((key) => sections[key]).join('');
  }

  function renderRecoveryGroup(model) {
    const backupRows = model.backupFiles.slice(0, 20).map((row) => ([
      `<strong>${escapeHtml(firstNonEmpty([row && row.backup, row && row.name, row && row.file], '-'))}</strong><div class="ownerx-table-subcopy">${escapeHtml(firstNonEmpty([row && row.note, row && row.summary], '-'))}</div>`,
      chip(firstNonEmpty([row && row.type, row && row.status], 'backup'), 'info'),
      escapeHtml(formatDateTime(firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''))),
    ]));
    const historyRows = model.restoreHistory.slice(0, 12).map((row) => ([
      `<strong>${escapeHtml(firstNonEmpty([row && row.backup, row && row.name], '-'))}</strong><div class="ownerx-table-subcopy">${escapeHtml(firstNonEmpty([row && row.previewToken, row && row.message], '-'))}</div>`,
      chip(firstNonEmpty([row && row.status, row && row.phase], 'unknown'), toneForStatus(firstNonEmpty([row && row.status, row && row.phase], 'unknown'))),
      escapeHtml(formatDateTime(firstNonEmpty([row && row.createdAt, row && row.updatedAt], ''))),
    ]));
    const restorePreviewBody = model.restorePreview
      ? `<div class="ownerx-callout" data-tone="warning"><strong>Restore preview ready</strong><div>${escapeHtml(trimText(model.restorePreview.summary, 240) || trimText(model.restorePreview.message, 240) || 'A dry-run restore preview is loaded in memory for the current Owner session.')}</div></div>`
      : model.restoreState && Object.keys(model.restoreState).length
        ? `<div class="ownerx-card-grid"><div class="ownerx-card"><div class="ownerx-panel-label">Restore state</div><strong>${escapeHtml(firstNonEmpty([model.restoreState.status, model.restoreState.phase], 'idle'))}</strong><div class="ownerx-muted">${escapeHtml(trimText(model.restoreState.message, 220) || 'No recovery message')}</div></div><div class="ownerx-card"><div class="ownerx-panel-label">Last update</div><strong>${escapeHtml(formatDateTime(firstNonEmpty([model.restoreState.updatedAt, model.restoreState.at], '')))}</strong><div class="ownerx-muted">Current backend restore status snapshot.</div></div></div>`
        : '<div class="ownerx-empty"><strong>No restore preview</strong><div class="ownerx-empty-copy">Use the recovery forms in the injected control workspace to create previews and apply restores safely.</div></div>';

    return [
      renderSection(
        'recovery',
        'recovery',
        'Recovery',
        'Backup and restore posture',
        'Recovery stays evidence-first: preview the restore, inspect history, then use existing backend flows for the final mutation.',
        restorePreviewBody
      ),
      renderSection(
        'recovery-backups',
        '',
        'Backup inventory',
        'Available backups',
        'Backups loaded from the current backend inventory.',
        renderTable(['Backup', 'Type', 'Created'], backupRows, 'No backups are currently loaded.')
      ),
      renderSection(
        'recovery-history',
        '',
        'Restore history',
        'Recent restore operations',
        'Use restore history to verify whether a previous recovery already ran before launching another one.',
        renderTable(['Backup', 'State', 'At'], historyRows, 'No restore history is currently loaded.')
      ),
    ].join('');
  }

  function renderKpis(group, model, rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'overview';
    if (group === 'tenants') {
      if (route === 'packages') {
        const totalFeatures = model.packageRows.reduce((sum, row) => sum + arrayOf(row.features).length, 0);
        const activeAssignments = model.packageRows.reduce((sum, row) => sum + Number(row.activeTenants || 0), 0);
        return [
          renderMetricCard('Packages', formatNumber(model.packageRows.length), 'Active plan definitions', 'info'),
          renderMetricCard('Feature rows', formatNumber(totalFeatures), 'Feature exposure across plans', 'info'),
          renderMetricCard('Assignments', formatNumber(activeAssignments), 'Tenants currently pinned to a plan', activeAssignments ? 'success' : 'muted'),
          renderMetricCard('Outstanding', formatNumber(model.outstandingTenants), 'Commercial follow-up before plan changes', model.outstandingTenants ? 'warning' : 'success'),
        ].join('');
      }
      if (route === 'subscriptions') {
        const paused = model.subscriptionRows.filter((row) => trimText(row.status, 40).toLowerCase() === 'paused').length;
        return [
          renderMetricCard('Subscriptions', formatNumber(model.subscriptionRows.length), 'Current contract count', 'info'),
          renderMetricCard('Expiring soon', formatNumber(model.expiringTenants), 'Within 14 days', model.expiringTenants ? 'warning' : 'success'),
          renderMetricCard('Paused', formatNumber(paused), 'Contracts that need owner review', paused ? 'warning' : 'success'),
          renderMetricCard('Outstanding', formatNumber(model.outstandingTenants), 'Tenants with billing follow-up', model.outstandingTenants ? 'warning' : 'success'),
        ].join('');
      }
      if (route === 'billing') {
        return [
          renderMetricCard('Invoices', formatNumber(model.invoiceRows.length), 'Current invoice watchlist', 'info'),
          renderMetricCard('Payment attempts', formatNumber(model.paymentRows.length), 'Checkout recovery lane', 'info'),
          renderMetricCard('Outstanding', formatNumber(model.outstandingTenants), 'Tenants with debt exposure', model.outstandingTenants ? 'warning' : 'success'),
          renderMetricCard('MRR', formatCurrencyCents(model.analytics && model.analytics.subscriptions && model.analytics.subscriptions.mrrCents || 0), 'Current subscription baseline', 'info'),
        ].join('');
      }
      if (route === 'create-tenant') {
        return [
          renderMetricCard('Package choices', formatNumber(model.packageRows.length), 'Plans available for assignment', 'info'),
          renderMetricCard('Active tenants', formatNumber(model.totals.activeTenants), 'Current platform footprint', 'success'),
          renderMetricCard('Expiring soon', formatNumber(model.expiringTenants), 'Useful onboarding comparison set', model.expiringTenants ? 'warning' : 'success'),
          renderMetricCard('Outstanding', formatNumber(model.outstandingTenants), 'Commercial debt still open', model.outstandingTenants ? 'warning' : 'success'),
        ].join('');
      }
      return [
        renderMetricCard('Tenants', formatNumber(model.totals.tenants), `${formatNumber(model.totals.activeTenants)} active`, 'success'),
        renderMetricCard('Outstanding', formatNumber(model.outstandingTenants), 'Billing follow-up', model.outstandingTenants ? 'warning' : 'success'),
        renderMetricCard('Expiring soon', formatNumber(model.expiringTenants), 'Within 14 days', model.expiringTenants ? 'warning' : 'success'),
        renderMetricCard('Subscriptions', formatNumber(model.subscriptionRows.length), 'Current contract count', 'info'),
      ].join('');
    }
    if (group === 'runtime') {
      if (route === 'incidents') {
        return [
          renderMetricCard('Open signals', formatNumber(model.incidents.length), 'Incident feed entries', model.incidents.length ? 'warning' : 'success'),
          renderMetricCard('Request errors', formatNumber(model.totals.requestErrors), 'Current telemetry errors', model.totals.requestErrors ? 'danger' : 'success'),
          renderMetricCard('Notifications', formatNumber(model.totals.notifications), 'Signals awaiting acknowledgment', model.totals.notifications ? 'warning' : 'success'),
          renderMetricCard('Security events', formatNumber(model.securityEvents.length), 'Cross-surface escalation context', model.securityEvents.length ? 'warning' : 'success'),
        ].join('');
      }
      if (route === 'observability' || route === 'analytics') {
        return [
          renderMetricCard('Requests', formatNumber(model.requestRows.length), 'Current telemetry rows', 'info'),
          renderMetricCard('Request errors', formatNumber(model.totals.requestErrors), 'Current telemetry errors', model.totals.requestErrors ? 'danger' : 'success'),
          renderMetricCard('Queue depth', formatNumber(model.deliverySummary.queueCount || 0), 'Pending delivery work', model.deliverySummary.queueCount ? 'warning' : 'success'),
          renderMetricCard('Top errors', formatNumber(model.deliveryTopErrors.length), 'Aggregated delivery error families', model.deliveryTopErrors.length ? 'warning' : 'success'),
        ].join('');
      }
      if (route === 'jobs') {
        return [
          renderMetricCard('Queue depth', formatNumber(model.deliverySummary.queueCount || 0), 'Pending delivery work', model.deliverySummary.queueCount ? 'warning' : 'success'),
          renderMetricCard('Dead letters', formatNumber(model.deliverySummary.deadLetterCount || 0), 'Recovery lane volume', model.deliverySummary.deadLetterCount ? 'danger' : 'success'),
          renderMetricCard('In flight', formatNumber(model.deliverySummary.inFlightCount || 0), 'Current delivery execution', 'info'),
          renderMetricCard('Retryable', formatNumber(model.deliverySummary.retryableDeadLetters || 0), 'Dead letters with replay path', model.deliverySummary.retryableDeadLetters ? 'warning' : 'success'),
        ].join('');
      }
      return [
        renderMetricCard('Delivery Agents', formatNumber(model.deliveryAgents.length), 'Execution runtimes', 'info'),
        renderMetricCard('Server Bots', formatNumber(model.serverBots.length), 'Server-side runtimes', 'info'),
        renderMetricCard('Open signals', formatNumber(model.incidents.length), 'Incident feed entries', model.incidents.length ? 'warning' : 'success'),
        renderMetricCard('Request errors', formatNumber(model.totals.requestErrors), 'Current telemetry errors', model.totals.requestErrors ? 'danger' : 'success'),
      ].join('');
    }
    if (group === 'support') {
      if (route.startsWith('support-')) {
        return [
          renderMetricCard('Support context', model.supportSummary ? 'Ready' : model.supportCaseLoading ? 'Loading' : 'Idle', 'Current tenant support dossier', model.supportSummary ? 'success' : model.supportCaseLoading ? 'info' : 'muted'),
          renderMetricCard('Dead letters', formatNumber(model.supportDeadLetters.length), 'Selected support queue', model.supportDeadLetters.length ? 'warning' : 'success'),
          renderMetricCard('Notifications', formatNumber(model.notifications.length), 'Owner support signals', model.notifications.length ? 'warning' : 'success'),
          renderMetricCard('Security events', formatNumber(model.securityEvents.length), 'Signals near support flow', model.securityEvents.length ? 'warning' : 'success'),
        ].join('');
      }
      return [
        renderMetricCard('Notifications', formatNumber(model.notifications.length), 'Owner support signals', model.notifications.length ? 'warning' : 'success'),
        renderMetricCard('Dead letters', formatNumber(model.supportDeadLetters.length), 'Selected support queue', model.supportDeadLetters.length ? 'warning' : 'success'),
        renderMetricCard('Support context', model.supportSummary ? 'Ready' : model.supportCaseLoading ? 'Loading' : 'Idle', 'Current tenant support dossier', model.supportSummary ? 'success' : model.supportCaseLoading ? 'info' : 'muted'),
        renderMetricCard('Security events', formatNumber(model.securityEvents.length), 'Signals near support flow', model.securityEvents.length ? 'warning' : 'success'),
      ].join('');
    }
    if (group === 'governance') {
      if (route === 'access') {
        return [
          renderMetricCard('Admin sessions', formatNumber(model.sessions.length), 'Currently loaded sessions', model.sessions.length ? 'info' : 'muted'),
          renderMetricCard('Admin users', formatNumber(model.adminUsers.length), 'Current owner/operator accounts', 'info'),
          renderMetricCard('Security events', formatNumber(model.securityEvents.length), 'Recent access signals', model.securityEvents.length ? 'warning' : 'success'),
          renderMetricCard('Open notifications', formatNumber(model.totals.notifications), 'Awaiting acknowledgment', model.totals.notifications ? 'warning' : 'success'),
        ].join('');
      }
      if (route === 'diagnostics') {
        return [
          renderMetricCard('Request errors', formatNumber(model.totals.requestErrors), 'Operational evidence', model.totals.requestErrors ? 'danger' : 'success'),
          renderMetricCard('Open notifications', formatNumber(model.totals.notifications), 'Awaiting acknowledgment', model.totals.notifications ? 'warning' : 'success'),
          renderMetricCard('Security events', formatNumber(model.securityEvents.length), 'Recent access signals', model.securityEvents.length ? 'warning' : 'success'),
          renderMetricCard('Admin sessions', formatNumber(model.sessions.length), 'Currently loaded sessions', model.sessions.length ? 'info' : 'muted'),
        ].join('');
      }
      return [
        renderMetricCard('Admin sessions', formatNumber(model.sessions.length), 'Currently loaded sessions', model.sessions.length ? 'info' : 'muted'),
        renderMetricCard('Security events', formatNumber(model.securityEvents.length), 'Recent access signals', model.securityEvents.length ? 'warning' : 'success'),
        renderMetricCard('Open notifications', formatNumber(model.totals.notifications), 'Awaiting acknowledgment', model.totals.notifications ? 'warning' : 'success'),
        renderMetricCard('Request errors', formatNumber(model.totals.requestErrors), 'Operational evidence', model.totals.requestErrors ? 'danger' : 'success'),
      ].join('');
    }
    if (group === 'settings') {
      return [
        renderMetricCard('Managed services', formatNumber(model.managedServices.length), 'Restart-capable services', 'info'),
        renderMetricCard('Admin users', formatNumber(model.adminUsers.length), 'Owner and ops accounts', 'info'),
        renderMetricCard('Automation preview', model.automationPreview ? 'Ready' : 'Idle', 'Dry-run/live report state', model.automationPreview ? 'warning' : 'muted'),
        renderMetricCard('Reload policy', model.controlPanelSettings && model.controlPanelSettings.reloadRequired === true ? 'Required' : 'Safe', 'Current env apply posture', model.controlPanelSettings && model.controlPanelSettings.reloadRequired === true ? 'warning' : 'success'),
      ].join('');
    }
    if (group === 'recovery') {
      return [
        renderMetricCard('Backups', formatNumber(model.backupFiles.length), 'Available recovery points', model.backupFiles.length ? 'info' : 'muted'),
        renderMetricCard('Restore history', formatNumber(model.restoreHistory.length), 'Recent recovery events', model.restoreHistory.length ? 'info' : 'muted'),
        renderMetricCard('Restore preview', model.restorePreview ? 'Ready' : 'Idle', 'Dry-run state', model.restorePreview ? 'warning' : 'muted'),
        renderMetricCard('Open signals', formatNumber(model.incidents.length), 'Keep recovery evidence close', model.incidents.length ? 'warning' : 'success'),
      ].join('');
    }
    return [
      renderMetricCard('Tenants', formatNumber(model.totals.tenants), `${formatNumber(model.totals.activeTenants)} active`, 'success'),
      renderMetricCard('MRR', formatCurrencyCents(model.analytics && model.analytics.subscriptions && model.analytics.subscriptions.mrrCents || 0), 'Current subscription baseline', 'info'),
      renderMetricCard('Runtime split', formatNumber(model.runtimeRows.length), `${formatNumber(model.deliveryAgents.length)} DA / ${formatNumber(model.serverBots.length)} SB`, 'info'),
      renderMetricCard('Open signals', formatNumber(model.incidents.length), 'Notifications, request errors, security', model.incidents.length ? 'warning' : 'success'),
    ].join('');
  }

  function renderRail(meta, group, model, rawRoute) {
    const route = trimText(rawRoute, 160).toLowerCase() || 'overview';
    const notes = [];
    if (model.warnings.length) {
      notes.push(`<div class="ownerx-callout" data-tone="warning"><strong>Partial data</strong><div>${escapeHtml(model.warnings.join(', '))}</div></div>`);
    }
    if (route === 'billing') {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Billing focus</div><strong>${escapeHtml(formatNumber(model.invoiceRows.length))} invoices loaded</strong><div class="ownerx-rail-copy">${escapeHtml(formatNumber(model.paymentRows.length))} payment attempts are available for recovery review on this page.</div></div>`);
    } else if (route === 'packages') {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Package focus</div><strong>${escapeHtml(formatNumber(model.packageRows.length))} plan definitions</strong><div class="ownerx-rail-copy">Review plan impact before changing entitlements or moving tenants across packages.</div></div>`);
    } else if (route === 'create-tenant') {
      notes.push('<div class="ownerx-rail-item"><div class="ownerx-panel-label">Onboarding flow</div><strong>Use existing controls</strong><div class="ownerx-rail-copy">This page prepares the package and commercial context, then hands the actual mutation to the existing owner control workspace.</div></div>');
    } else if (route === 'access') {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Access focus</div><strong>${escapeHtml(formatNumber(model.sessions.length))} sessions loaded</strong><div class="ownerx-rail-copy">${escapeHtml(formatNumber(model.adminUsers.length))} owner/operator accounts are available for access review.</div></div>`);
    } else if (route === 'diagnostics') {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Diagnostics focus</div><strong>${escapeHtml(formatNumber(model.totals.requestErrors))} request errors</strong><div class="ownerx-rail-copy">${escapeHtml(formatNumber(model.totals.notifications))} notifications and ${formatNumber(model.securityEvents.length)} security events are staged for export follow-up.</div></div>`);
    } else if (route === 'control') {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Control focus</div><strong>${escapeHtml(formatNumber(model.managedServices.length))} managed services</strong><div class="ownerx-rail-copy">Service restarts, admin-user changes, and automation entry points stay wired to the existing backend flows.</div></div>`);
    }
    if (group === 'support' && model.supportSummary) {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Support dossier</div><strong>${escapeHtml(model.supportSummary.tenant || 'Selected tenant')}</strong><div class="ownerx-rail-copy">${escapeHtml(model.supportSummary.summary)}</div></div>`);
    } else if (group === 'settings' && model.automationPreview) {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Automation preview</div><strong>${escapeHtml(formatNumber(arrayOf(model.automationPreview.actions).length))} actions</strong><div class="ownerx-rail-copy">${escapeHtml(trimText(model.automationPreview.reason, 220) || 'Latest manual automation preview')}</div></div>`);
    } else if (group === 'recovery' && model.restorePreview) {
      notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Restore preview</div><strong>Ready</strong><div class="ownerx-rail-copy">${escapeHtml(trimText(model.restorePreview.summary, 220) || trimText(model.restorePreview.message, 220) || 'Dry-run preview loaded')}</div></div>`);
    }
    notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Platform watch</div><strong>${escapeHtml(formatNumber(model.totals.notifications))} open notifications</strong><div class="ownerx-rail-copy">${escapeHtml(formatNumber(model.totals.requestErrors))} request errors / ${escapeHtml(formatNumber(model.securityEvents.length))} security events currently loaded.</div></div>`);
    notes.push(`<div class="ownerx-rail-item"><div class="ownerx-panel-label">Runtime split</div><strong>${escapeHtml(formatNumber(model.deliveryAgents.length))} Delivery Agents</strong><div class="ownerx-rail-copy">${escapeHtml(formatNumber(model.serverBots.length))} Server Bots remain separate in every table and action path.</div></div>`);
    return [
      '<aside class="ownerx-rail odv4-rail">',
      '<div class="ownerx-rail-stack">',
      `<section class="ownerx-context-card"><div class="ownerx-panel-label odv4-rail-header">${escapeHtml(meta.railTitle)}</div><p class="ownerx-rail-copy odv4-rail-copy">${escapeHtml(meta.railCopy)}</p></section>`,
      notes.join(''),
      '</div>',
      '</aside>',
    ].join('');
  }

  function renderContent(rawRoute, group, model) {
    if (group === 'tenants') return renderTenantsGroup(rawRoute, model);
    if (group === 'runtime') return renderRuntimeGroup(rawRoute, model);
    if (group === 'support') return renderSupportGroup(rawRoute, model);
    if (group === 'governance') return renderGovernanceGroup(rawRoute, model);
    if (group === 'settings') return renderSettingsGroup(rawRoute, model);
    if (group === 'recovery') return renderRecoveryGroup(model);
    return renderOverviewGroup(model);
  }

  function renderOwnerVNext(target, payload, options) {
    if (!target) return;
    const state = payload && typeof payload === 'object' ? payload : {};
    const config = options && typeof options === 'object' ? options : {};
    const rawRoute = trimText(config.currentRoute, 160).toLowerCase() || 'overview';
    const model = buildModel(state, rawRoute);
    const group = resolveRouteGroup(rawRoute);
    const meta = routeMeta(rawRoute, model);

    target.innerHTML = [
      '<div class="ownerx-shell odv4-shell" data-owner-vnext-surface="1">',
      renderSidebar(rawRoute, group, model),
      '<div class="ownerx-main odv4-main">',
      renderPageHead(rawRoute, meta, model),
      `<section class="ownerx-kpi-strip odv4-kpi-strip">${renderKpis(group, model, rawRoute)}</section>`,
      renderContent(rawRoute, group, model),
      '</div>',
      renderRail(meta, group, model, rawRoute),
      '</div>',
    ].join('');
    translateOwnerShell(target.querySelector('.ownerx-shell'));

    return { group, meta, model };
  }

  return {
    renderOwnerVNext,
  };
});
