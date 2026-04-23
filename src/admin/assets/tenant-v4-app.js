(function () {
  'use strict';

  const PAGE_ALIASES = {
    '': 'dashboard',
    overview: 'dashboard',
    dashboard: 'dashboard',
    onboarding: 'onboarding',
    status: 'server-status',
    'server-status': 'server-status',
    config: 'server-config',
    'server-config': 'server-config',
    orders: 'orders',
    commerce: 'orders',
    transactions: 'orders',
    delivery: 'orders',
    donations: 'donations',
    analytics: 'analytics',
    reports: 'analytics',
    events: 'events',
    modules: 'modules',
    players: 'players',
    staff: 'staff',
    roles: 'roles',
    'support-tools': 'players',
    'delivery-agents': 'delivery-agents',
    'server-bots': 'server-bots',
    'logs-sync': 'logs-sync',
    settings: 'settings',
    billing: 'billing',
    actions: 'restart-control',
    'restart-control': 'restart-control',
  };

  const PAGE_TITLE_KEYS = {
    dashboard: 'tenant.app.page.dashboard',
    onboarding: 'tenant.app.page.onboarding',
    'server-status': 'tenant.app.page.server-status',
    'server-config': 'tenant.app.page.server-config',
    'logs-sync': 'tenant.app.page.logs-sync',
    orders: 'tenant.app.page.orders',
    donations: 'tenant.app.page.donations',
    analytics: 'tenant.app.page.analytics',
    events: 'tenant.app.page.events',
    modules: 'tenant.app.page.modules',
    players: 'tenant.app.page.players',
    staff: 'tenant.app.page.staff',
    roles: 'tenant.app.page.roles',
    settings: 'tenant.app.page.settings',
    billing: 'tenant.app.page.billing',
    'delivery-agents': 'tenant.app.page.delivery-agents',
    'server-bots': 'tenant.app.page.server-bots',
    'restart-control': 'tenant.app.page.restart-control',
  };

  const PAGE_FEATURE_RULES = {
    dashboard: [],
    onboarding: [],
    'server-status': ['server_status'],
    'server-config': ['server_settings'],
    'logs-sync': ['bot_log', 'sync_agent'],
    orders: ['orders_module'],
    donations: ['donation_module'],
    analytics: ['analytics_module'],
    events: ['event_module'],
    modules: ['support_module', 'analytics_module', 'event_module', 'donation_module'],
    players: ['player_module'],
    staff: ['staff_roles'],
    roles: ['staff_roles'],
    settings: [],
    billing: [],
    'delivery-agents': ['execute_agent'],
    'server-bots': ['sync_agent'],
    'restart-control': ['server_hosting'],
  };

  const PAGE_SECTION_KEYS = {
    dashboard: null,
    onboarding: 'onboarding',
    'server-status': 'server',
    'server-config': 'server_config',
    'logs-sync': 'logs_sync',
    orders: 'orders',
    donations: 'donations',
    analytics: 'analytics',
    events: 'events',
    modules: 'modules',
    players: 'players',
    staff: 'staff',
    roles: 'roles',
    settings: 'settings',
    billing: 'billing',
    'delivery-agents': 'delivery_agents',
    'server-bots': 'server_bots',
    'restart-control': 'restart_control',
  };

  const PATH_PAGE_ALIASES = {
    '': 'dashboard',
    onboarding: 'onboarding',
    server: 'server-status',
    config: 'server-config',
    restarts: 'restart-control',
    'delivery-agents': 'delivery-agents',
    'server-bots': 'server-bots',
    'logs-sync': 'logs-sync',
    players: 'players',
    orders: 'orders',
    donations: 'donations',
    analytics: 'analytics',
    events: 'events',
    modules: 'modules',
    staff: 'staff',
    roles: 'roles',
    settings: 'settings',
    billing: 'billing',
  };

  const NAV_GROUP_LABELS = {
    Overview: 'ภาพรวม',
    Home: 'หน้าแรก',
    Server: 'เซิร์ฟเวอร์',
    Operations: 'งานประจำวัน',
    Community: 'ชุมชน',
    Team: 'ทีมงาน',
    Runtimes: 'เครื่องมือ',
    Account: 'บัญชี',
  };

  const state = {
    payload: null,
    refreshing: false,
    provisioningResult: {
      'delivery-agents': null,
      'server-bots': null,
    },
  };

  function resolveTenantLabel(tenantId, me, overview, tenantConfig) {
    return firstNonEmpty([
      overview?.tenantName,
      overview?.tenantSlug,
      tenantConfig?.name,
      me?.tenantName,
      me?.tenantSlug,
      tenantId,
    ], '');
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
    const rows = Array.isArray(values) ? values : [values];
    for (const value of rows) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return fallback;
  }

  function getNotificationTenantId(row) {
    return firstNonEmpty([
      row && row.tenantId,
      row && row.data && row.data.tenantId,
      row && row.data && row.data.tenant && row.data.tenant.id,
    ], '');
  }

  function filterTenantNotifications(rows, tenantId) {
    const scopedTenantId = firstNonEmpty([tenantId], '');
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
      return getNotificationTenantId(row) === scopedTenantId;
    });
  }

  function root() {
    return document.getElementById('tenantV4AppRoot');
  }

  function statusNode() {
    return document.getElementById('tenantV4Status');
  }

  function t(key, fallback, params) {
    return window.AdminUiI18n?.t?.(key, fallback, params) || fallback || key;
  }

  function applyI18n(rootNode = document) {
    window.AdminUiI18n?.apply?.(rootNode);
  }

  const TENANT_ACTIVE_TEXT_MAP = {
    Ready: 'พร้อมใช้งาน',
    'Loading tenant workspace...': 'กำลังโหลดพื้นที่ผู้เช่า...',
    'Preparing tenant data': 'กำลังเตรียมข้อมูลผู้เช่า',
    'Loading server status, orders, players, and support tools for this tenant.': 'กำลังโหลดสถานะเซิร์ฟเวอร์ คำสั่งซื้อ ผู้เล่น และเครื่องมือดูแลของผู้เช่านี้',
    'Could not load tenant workspace': 'โหลดพื้นที่ผู้เช่าไม่สำเร็จ',
    'Load failed': 'โหลดไม่สำเร็จ',
    'No tenant data yet': 'ยังไม่มีข้อมูลผู้เช่า',
    'Wait for the latest tenant data to load.': 'รอให้ระบบดึงข้อมูลผู้เช่าล่าสุดก่อน',
    'Daily overview': 'ภาพรวมประจำวัน',
    Access: 'การเข้าถึง',
    'Some actions are locked': 'บางการทำงานยังถูกล็อกอยู่',
    'Some config actions are locked': 'บางการตั้งค่าถูกล็อกอยู่',
    'Locked action': 'การทำงานที่ถูกล็อก',
    'This action is locked in the current package.': 'การทำงานนี้ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน',
    'Upgrade package': 'อัปเกรดแพ็กเกจ',
    'Review role access': 'ตรวจสิทธิ์ของบทบาท',
    Onboarding: 'เริ่มต้นใช้งาน',
    'Logs & sync': 'บันทึกและซิงก์',
    Donations: 'โดเนต',
    'Bot modules': 'โมดูลบอท',
    'Server Bot': 'บอทเซิร์ฟเวอร์',
    'Delivery Agent': 'บอทส่งของ',
    'Download install script (.ps1)': 'ดาวน์โหลดสคริปต์ติดตั้ง (.ps1)',
    'Download quick install (.cmd)': 'ดาวน์โหลดไฟล์ติดตั้งด่วน (.cmd)',
    'Download setup notes (.txt)': 'ดาวน์โหลดโน้ตการติดตั้ง (.txt)',
    'Saving...': 'กำลังบันทึก...',
    'Creating...': 'กำลังสร้าง...',
    'Deleting...': 'กำลังลบ...',
    'Inviting...': 'กำลังเชิญ...',
    'Revoking...': 'กำลังเพิกถอน...',
    'Refreshing...': 'กำลังรีเฟรช...',
    'Retrying...': 'กำลังลองส่งใหม่...',
    'Cancelling...': 'กำลังยกเลิก...',
    'Starting...': 'กำลังเริ่มทำงาน...',
    'Enabling...': 'กำลังเปิดใช้งาน...',
    'Disabling...': 'กำลังปิดใช้งาน...',
    'Guild ID is required.': 'ต้องกรอก Guild ID',
    'Choose a server before saving the guild mapping.': 'เลือกเซิร์ฟเวอร์ก่อนบันทึกการผูก Guild',
    'Discord guild mapping saved.': 'บันทึกการผูก Discord Guild แล้ว',
    'Tenant settings saved.': 'บันทึกการตั้งค่าผู้เช่าแล้ว',
    'Tenant settings could not find the tenant scope.': 'ไม่พบขอบเขตผู้เช่าสำหรับบันทึกการตั้งค่า',
    'Email is required to invite tenant staff.': 'ต้องกรอกอีเมลก่อนเชิญทีมงานผู้เช่า',
    'Tenant staff invitation created.': 'สร้างคำเชิญทีมงานผู้เช่าแล้ว',
    'Tenant staff access updated.': 'อัปเดตสิทธิ์ทีมงานผู้เช่าแล้ว',
    'Tenant staff access revoked.': 'เพิกถอนสิทธิ์ทีมงานผู้เช่าแล้ว',
    'Revoke access for this tenant staff member?': 'เพิกถอนสิทธิ์ของทีมงานผู้เช่าคนนี้ใช่หรือไม่?',
    'Your tenant role cannot manage staff access.': 'บทบาทของคุณไม่มีสิทธิ์จัดการทีมงานผู้เช่า',
    'This tenant role cannot change the selected membership.': 'บทบาทนี้ไม่สามารถเปลี่ยนสิทธิ์สมาชิกที่เลือกได้',
    'This tenant role cannot remove the selected membership.': 'บทบาทนี้ไม่สามารถลบสมาชิกที่เลือกได้',
    'Preview tenants cannot invite staff yet.': 'ผู้เช่าแบบพรีวิวยังเชิญทีมงานไม่ได้',
    'Preview tenants cannot change staff access yet.': 'ผู้เช่าแบบพรีวิวยังเปลี่ยนสิทธิ์ทีมงานไม่ได้',
    'Preview tenants cannot revoke staff access yet.': 'ผู้เช่าแบบพรีวิวยังเพิกถอนสิทธิ์ทีมงานไม่ได้',
    'Preview mode cannot change Discord guild mappings.': 'โหมดพรีวิวไม่สามารถแก้การผูก Discord Guild ได้',
    'Preview mode cannot save tenant settings.': 'โหมดพรีวิวไม่สามารถบันทึกการตั้งค่าผู้เช่าได้',
    'Preview mode cannot manage donation packages.': 'โหมดพรีวิวไม่สามารถจัดการแพ็กเกจโดเนตได้',
    'Preview mode cannot manage live events.': 'โหมดพรีวิวไม่สามารถจัดการกิจกรรมจริงได้',
    'Preview mode cannot run order actions.': 'โหมดพรีวิวไม่สามารถสั่งงานคำสั่งซื้อได้',
    'Preview mode cannot inspect live order data.': 'โหมดพรีวิวไม่สามารถดูข้อมูลคำสั่งซื้อจริงได้',
    'Preview mode cannot change module state.': 'โหมดพรีวิวไม่สามารถเปลี่ยนสถานะโมดูลได้',
    'Preview mode cannot load live sync signals.': 'โหมดพรีวิวไม่สามารถโหลดสัญญาณซิงก์จริงได้',
    'Preview mode cannot send restart jobs.': 'โหมดพรีวิวไม่สามารถส่งงานรีสตาร์ตได้',
    'Preview mode cannot control the server.': 'โหมดพรีวิวไม่สามารถควบคุมเซิร์ฟเวอร์ได้',
    'Provide id, name, price, and description before creating a donation package.': 'กรอก id ชื่อ ราคา และคำอธิบายก่อนสร้างแพ็กเกจโดเนต',
    'Name, price, and description are required before saving the package.': 'ต้องกรอกชื่อ ราคา และคำอธิบายก่อนบันทึกแพ็กเกจ',
    'Item-based donation packages still need a SCUM game item id.': 'แพ็กเกจโดเนตแบบไอเท็มยังต้องมีรหัสไอเท็มเกม SCUM',
    'Finish the first-time setup, then move into daily operations.': 'ตั้งค่าเริ่มต้นให้ครบก่อน แล้วค่อยไปทำงานประจำวัน',
    'No server connected': 'ยังไม่มีเซิร์ฟเวอร์เชื่อมต่อ',
    Checklist: 'เช็กลิสต์',
    Missing: 'ยังขาด',
    Status: 'สถานะ',
    online: 'ออนไลน์',
    stale: 'ค้าง',
    'Setup checklist': 'เช็กลิสต์การตั้งค่า',
    'What happens after setup': 'หลังตั้งค่าแล้วจะเกิดอะไรต่อ',
    'Then move into daily operations': 'แล้วค่อยไปทำงานประจำวัน',
    'Details / history': 'รายละเอียด / ประวัติ',
    'Review Server Settings': 'ตรวจการตั้งค่าเซิร์ฟเวอร์',
    'Setup steps completed inside this tenant': 'ขั้นที่ตั้งค่าเสร็จแล้วภายในผู้เช่านี้',
    'Create or connect a server first': 'สร้างหรือเชื่อมต่อเซิร์ฟเวอร์ก่อน',
    'Latest update': 'อัปเดตล่าสุด',
    'Server Bot installer ready': 'แพ็กเกจติดตั้งบอทเซิร์ฟเวอร์พร้อมแล้ว',
    'Download the installer package for the target machine.': 'ดาวน์โหลดแพ็กเกจติดตั้งไปใช้บนเครื่องปลายทางได้เลย',
    'Ready to sync': 'พร้อมซิงก์',
    'Queue pressure': 'ภาระคิวงาน',
    'Failed work': 'งานที่ล้มเหลว',
    'No queue pressure detected right now.': 'ตอนนี้ยังไม่พบแรงกดดันของคิวงาน',
    'No failed jobs are currently visible.': 'ตอนนี้ยังไม่พบงานล้มเหลว',
    'Binding rule': 'กติกาการผูกเครื่อง',
    'Config access probe ready': 'พร้อมทดสอบการอ่านค่าตั้งค่า',
    'Restart probe needs restart template': 'ยังต้องตั้งคำสั่งรีสตาร์ต',
    'Action': 'การทำงาน',
    Version: 'เวอร์ชัน',
    Server: 'เซิร์ฟเวอร์',
    'Rotate bot key': 'หมุนคีย์บอตใหม่',
    'Revoke bot access': 'เพิกถอนสิทธิ์บอต',
    'Reset binding': 'รีเซ็ตการผูกเครื่อง',
    'Sync probe ready': 'พร้อมทดสอบการซิงก์',
    'Test sync': 'ทดสอบการซิงก์',
    'Test config access': 'ทดสอบการอ่านค่าตั้งค่า',
    'Test restart': 'ทดสอบความพร้อมรีสตาร์ต',
    'Open server': 'เปิดหน้าเซิร์ฟเวอร์',
    'Guild ID': 'Guild ID',
    'Choose which server this bot should manage': 'เลือกเซิร์ฟเวอร์ที่บอทนี้ต้องดูแล',
    'Choose the server that owns this guild binding': 'เลือกเซิร์ฟเวอร์ที่เป็นเจ้าของการผูก Guild นี้',
    'Paste the Discord guild ID for this tenant community': 'วาง Discord Guild ID ของชุมชนผู้เช่านี้',
  };

  function translateTenantActiveText(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (TENANT_ACTIVE_TEXT_MAP[text]) return TENANT_ACTIVE_TEXT_MAP[text];
    return text
      .replace(/^Preview mode cannot create bots yet\\.$/u, 'โหมดพรีวิวยังสร้างบอทไม่ได้')
      .replace(/^Preview mode cannot manage bots yet\\.$/u, 'โหมดพรีวิวยังจัดการบอทไม่ได้')
      .replace(/^Preview mode cannot roll back live config\\.$/u, 'โหมดพรีวิวยังโรลกลับค่าจริงไม่ได้')
      .replace(/^Preview mode cannot send Server Bot test jobs\\.$/u, 'โหมดพรีวิวยังส่งงานทดสอบ Server Bot ไม่ได้')
      .replace(/^Create or reconnect a Server Bot before running this test\\.$/u, 'สร้างหรือเชื่อมต่อ Server Bot ก่อนรันการทดสอบนี้')
      .replace(/^Create or reconnect a Server Bot before controlling the server\\.$/u, 'สร้างหรือเชื่อมต่อ Server Bot ก่อนควบคุมเซิร์ฟเวอร์')
      .replace(/^Your tenant role cannot manage Delivery Agents\\.$/u, 'บทบาทของคุณไม่มีสิทธิ์จัดการ Delivery Agent')
      .replace(/^Your tenant role cannot manage Server Bots\\.$/u, 'บทบาทของคุณไม่มีสิทธิ์จัดการ Server Bot')
      .replace(/^Delivery Agent setup is locked in the current package\\.$/u, 'การตั้งค่า Delivery Agent ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Server Bot setup is locked in the current package\\.$/u, 'การตั้งค่า Server Bot ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Logs & Sync refresh is locked in the current package\\.$/u, 'การรีเฟรช Logs & Sync ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Your tenant role cannot change bot modules\\.$/u, 'บทบาทของคุณไม่มีสิทธิ์เปลี่ยนโมดูลบอท')
      .replace(/^Donation package (.+) created\.$/u, 'สร้างแพ็กเกจโดเนต $1 แล้ว')
      .replace(/^Donation package (.+) saved\.$/u, 'บันทึกแพ็กเกจโดเนต $1 แล้ว')
      .replace(/^Donation package (.+) deleted\.$/u, 'ลบแพ็กเกจโดเนต $1 แล้ว')
      .replace(/^Donation package (.+) disabled\.$/u, 'ปิดใช้งานแพ็กเกจโดเนต $1 แล้ว')
      .replace(/^Donation package (.+) enabled\.$/u, 'เปิดใช้งานแพ็กเกจโดเนต $1 แล้ว')
      .replace(/^(\d+) of (\d+) complete$/u, '$1 จาก $2 ขั้นเสร็จแล้ว')
      .replace(/^(\d+) online$/u, '$1 ออนไลน์')
      .replace(/^(\d+) stale$/u, '$1 ค้าง')
      .replace(/^(\d+) setup tokens$/u, '$1 setup token')
      .replace(/^Create (บอท.+)$/u, 'สร้าง$1')
      .replace(/^Connect (บอท.+)$/u, 'เชื่อมต่อ$1')
      .replace(/^Finish (บอท.+) setup$/u, 'ตั้งค่า$1ให้เสร็จ')
      .replace(/^Needed for config apply, sync, and restart jobs$/u, 'จำเป็นสำหรับงานบันทึกค่า ซิงก์ และรีสตาร์ต')
      .replace(/^Needed for live in-game item handoff$/u, 'จำเป็นสำหรับการส่งไอเท็มในเกมแบบสด')
      .replace(/^Finish the missing steps in order\. Each step opens the real workspace you will use every day after setup\.$/u, 'ทำขั้นที่ยังขาดตามลำดับ แต่ละขั้นจะพาไปยังหน้าทำงานจริงที่ใช้ทุกวันหลังตั้งค่าเสร็จ')
      .replace(/^needs setup$/u, 'ต้องตั้งค่า')
      .replace(/^Issue the setup token for the machine that can read SCUM\.log and edit server config\.$/u, 'ออก setup token ให้เครื่องที่อ่าน SCUM.log และแก้ค่าตั้งเซิร์ฟเวอร์ได้')
      .replace(/^The bot should come online before config apply and restart actions become dependable\.$/u, 'บอทควรออนไลน์ก่อน เพื่อให้การบันทึกค่าและรีสตาร์ตเชื่อถือได้')
      .replace(/^Issue the setup token for the machine that can keep the SCUM client open for deliveries\.$/u, 'ออก setup token ให้เครื่องที่เปิดไคลเอนต์ SCUM ค้างไว้เพื่อส่งของได้')
      .replace(/^The delivery machine should come online before live order delivery becomes reliable\.$/u, 'เครื่องส่งของควรออนไลน์ก่อน เพื่อให้การส่งของจริงเชื่อถือได้')
      .replace(/^Open the config workspace, confirm the current values, and save when ready\.$/u, 'เปิดหน้าตั้งค่า ยืนยันค่าปัจจุบัน แล้วบันทึกเมื่อพร้อม')
      .replace(/ first$/u, ' ก่อน')
      .replace(/ second$/u, ' ลำดับถัดไป')
      .replace(/^After setup, the Server, Orders, Players, and Events pages become the daily workspace\.$/u, 'หลังตั้งค่าเสร็จ หน้าเซิร์ฟเวอร์ คำสั่งซื้อ ผู้เล่น และกิจกรรม จะกลายเป็นพื้นที่ทำงานประจำวัน')
      .replace(/^Config save, apply, backup, and restart actions depend on the บอทเซิร์ฟเวอร์ being online\.$/u, 'การบันทึกค่า ใช้งานค่า สำรอง และรีสตาร์ต ขึ้นกับการที่บอทเซิร์ฟเวอร์ออนไลน์อยู่')
      .replace(/^Orders can exist before it, but reliable in-game delivery starts only after the บอทส่งของ connects\.$/u, 'คำสั่งซื้ออาจมีได้ก่อน แต่การส่งของในเกมที่เชื่อถือได้จะเริ่มหลังบอทส่งของเชื่อมต่อแล้วเท่านั้น')
      .replace(/^Ready to inspect logs, config, backup, and restart control\.$/u, 'พร้อมตรวจบันทึกค่า อ่านค่าตั้ง สำรอง และควบคุมการรีสตาร์ต')
      .replace(/^Set a restart or apply command template in Server Config before running the restart readiness check\.$/u, 'ตั้งคำสั่งรีสตาร์ตหรือคำสั่ง apply ในหน้าตั้งค่าเซิร์ฟเวอร์ก่อนรันทดสอบความพร้อมรีสตาร์ต')
      .replace(/^Queue a control-plane sync probe and confirm the bot can still report fresh activity\.$/u, 'ส่งงานทดสอบการซิงก์ แล้วตรวจว่าบอทยังรายงานสถานะล่าสุดกลับมาได้')
      .replace(/^Run a restart-readiness check before sending a live restart job\.$/u, 'รันทดสอบความพร้อมรีสตาร์ตก่อนส่งงานรีสตาร์ตจริง')
      .replace(/^Finish the first-time setup, then move into daily operations\.$/u, 'ตั้งค่าเริ่มต้นให้ครบก่อน แล้วค่อยไปทำงานประจำวัน')
      .replace(/^Server control is locked in the current package\.$/u, 'การควบคุมเซิร์ฟเวอร์ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Restart actions are locked in the current package\.$/u, 'การสั่งรีสตาร์ตถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Config save actions are locked in the current package\.$/u, 'การบันทึกค่าเซิร์ฟเวอร์ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Restart-required config actions are locked in the current package\.$/u, 'การบันทึกค่าที่ต้องรีสตาร์ตถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Delivery Agent actions are locked in the current package\.$/u, 'การจัดการบอทส่งของถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Server Bot actions are locked in the current package\.$/u, 'การจัดการบอทเซิร์ฟเวอร์ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Sync tests are locked in the current package\.$/u, 'การทดสอบซิงก์ถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Config access tests are locked in the current package\.$/u, 'การทดสอบสิทธิ์เข้าถึงค่าตั้งถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Restart tests are locked in the current package\.$/u, 'การทดสอบรีสตาร์ตถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Order actions are locked in the current package\.$/u, 'การทำงานของคำสั่งซื้อถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Donation package actions are locked in the current package\.$/u, 'การจัดการแพ็กเกจโดเนตถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Event actions are locked in the current package\.$/u, 'การจัดการกิจกรรมถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Module controls are locked in the current package\.$/u, 'การควบคุมโมดูลถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Staff management is locked in the current package\.$/u, 'การจัดการทีมงานถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Tenant settings changes are locked in the current package\.$/u, 'การเปลี่ยนการตั้งค่าผู้เช่าถูกล็อกอยู่ในแพ็กเกจปัจจุบัน')
      .replace(/^Download install script \((.+)\)$/u, 'ดาวน์โหลดสคริปต์ติดตั้ง ($1)')
      .replace(/^Download quick install \((.+)\)$/u, 'ดาวน์โหลดไฟล์ติดตั้งด่วน ($1)')
      .replace(/^Download setup notes \((.+)\)$/u, 'ดาวน์โหลดโน้ตการติดตั้ง ($1)')
      .replace(/Delivery Agent/gu, 'บอทส่งของ')
      .replace(/Server Bot/gu, 'บอทเซิร์ฟเวอร์')
      .replace(/Bot modules/gu, 'โมดูลบอท')
      .replace(/Logs & sync/gu, 'บันทึกและซิงก์')
      .replace(/Onboarding/gu, 'เริ่มต้นใช้งาน');
  }

  function localizeTenantElement(node) {
    if (!(node instanceof Element)) return;
    const textTags = new Set(['A', 'BUTTON', 'TH', 'TD', 'LABEL', 'OPTION', 'P', 'SPAN', 'STRONG', 'SMALL', 'H1', 'H2', 'H3', 'H4', 'DIV']);
    if (textTags.has(node.tagName) && node.children.length === 0) {
      const rawText = String(node.textContent ?? '').trim();
      const translated = translateTenantActiveText(rawText);
      if (translated && translated !== rawText) {
        node.textContent = translated;
      }
    }
    ['title', 'placeholder', 'aria-label'].forEach((attribute) => {
      if (!node.hasAttribute(attribute)) return;
      const rawValue = String(node.getAttribute(attribute) || '').trim();
      const translated = translateTenantActiveText(rawValue);
      if (translated && translated !== rawValue) {
        node.setAttribute(attribute, translated);
      }
    });
  }

  function localizeTenantActivePage(scopeNode = document) {
    if (!(scopeNode instanceof Element || scopeNode instanceof Document)) return;
    scopeNode.querySelectorAll('*').forEach((node) => localizeTenantElement(node));
  }

  function setStatus(message, tone) {
    const node = statusNode();
    if (!node) return;
    node.textContent = translateTenantActiveText(String(message || '').trim());
    node.dataset.tone = tone || 'muted';
  }

  function renderMessageCard(title, detail) {
    const target = root();
    if (!target) return null;
    target.innerHTML = [
      '<section style="padding:32px;border:1px solid rgba(212,186,113,.18);border-radius:24px;background:rgba(13,17,14,.92);box-shadow:0 24px 56px rgba(0,0,0,.28)">',
      `<h1 style="margin:0 0 12px;font:700 32px/1.05 'IBM Plex Sans Thai','Segoe UI',sans-serif;color:#f4efe4">${escapeHtml(translateTenantActiveText(title))}</h1>`,
      `<p style="margin:0;color:rgba(244,239,228,.74);font:400 15px/1.7 'IBM Plex Sans Thai','Segoe UI',sans-serif">${escapeHtml(translateTenantActiveText(detail))}</p>`,
      '</section>',
    ].join('');
  }

  async function apiRequest(path, options = {}, fallback) {
    const method = String(options?.method || 'GET').trim().toUpperCase() || 'GET';
    const headers = {
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers && typeof options.headers === 'object' ? options.headers : {}),
    };
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      if (response.status === 401) {
        window.location.href = buildTenantLoginRedirectUrl();
        return fallback;
      }
      throw new Error(String(
        payload?.data?.message
        || payload?.message
        || payload?.error
        || `Request failed (${response.status})`,
      ));
    }
    return payload?.data ?? fallback;
  }

  async function api(path, fallback) {
    return apiRequest(path, {}, fallback);
  }

  function parseConfigJsonInput(raw, fieldLabel, options = {}) {
    const text = String(raw || '').trim();
    if (!text) {
      return options.emptyAsObject ? {} : null;
    }
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${fieldLabel} ต้องเป็น JSON object`);
      }
      return parsed;
    } catch (error) {
      throw new Error(String(error?.message || `${fieldLabel} ต้องเป็น JSON ที่ถูกต้อง`));
    }
  }

  function resolveTenantPageKey(rawTarget) {
    const raw = String(rawTarget || '').trim().toLowerCase();
    if (!raw) return 'dashboard';
    return PAGE_ALIASES[raw] || 'dashboard';
  }

  function currentPage() {
    return resolveTenantPageKeyFromPath(window.location.pathname || '') || 'dashboard';
  }

  function getRawPathRoute() {
    const path = String(window.location.pathname || '').trim().toLowerCase();
    if (!path.startsWith('/tenant')) return '';
    const relative = path.slice('/tenant'.length).replace(/^\/+/, '');
    if (!relative) return '';
    const segments = relative.split('/').filter(Boolean);
    if (!segments.length) return '';
    if (segments[0] === 'server' && segments[1] === 'config') return 'config';
    if (segments[0] === 'server' && segments[1] === 'restarts') return 'restarts';
    if (segments[0] === 'runtimes' && segments[1] === 'delivery-agents') return 'delivery-agents';
    if (segments[0] === 'runtimes' && segments[1] === 'server-bots') return 'server-bots';
    return segments[segments.length - 1] || segments[0];
  }

  function buildCanonicalTenantPath(pageKey) {
    switch (pageKey) {
      case 'onboarding':
        return '/tenant/onboarding';
      case 'server-status':
        return '/tenant/server';
      case 'server-config':
        return '/tenant/server/config';
      case 'restart-control':
        return '/tenant/server/restarts';
      case 'delivery-agents':
        return '/tenant/runtimes/delivery-agents';
      case 'server-bots':
        return '/tenant/runtimes/server-bots';
      case 'logs-sync':
        return '/tenant/logs-sync';
      case 'orders':
        return '/tenant/orders';
      case 'donations':
        return '/tenant/donations';
      case 'analytics':
        return '/tenant/analytics';
      case 'events':
        return '/tenant/events';
      case 'modules':
        return '/tenant/modules';
      case 'players':
        return '/tenant/players';
      case 'staff':
        return '/tenant/staff';
      case 'roles':
        return '/tenant/roles';
      case 'settings':
        return '/tenant/settings';
      case 'billing':
        return '/tenant/billing';
      default:
        return '/tenant';
    }
  }

  function readTenantScopeFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('tenantId') || '').trim();
  }

  function buildCanonicalTenantHref(pageKey, extraParams = {}) {
    const canonicalPath = buildCanonicalTenantPath(pageKey);
    const url = new URL(window.location.href);
    url.pathname = canonicalPath;
    url.hash = '';

    const authTenantId = String(state.payload?.me?.tenantId || '').trim();
    const scopedTenantId = String(state.payload?.tenantId || readTenantScopeFromUrl() || '').trim();
    if (!authTenantId && scopedTenantId) {
      url.searchParams.set('tenantId', scopedTenantId);
    } else {
      url.searchParams.delete('tenantId');
    }

    Object.entries(extraParams && typeof extraParams === 'object' ? extraParams : {}).forEach(([key, value]) => {
      const normalizedValue = String(value || '').trim();
      if (normalizedValue) {
        url.searchParams.set(key, normalizedValue);
      } else {
        url.searchParams.delete(key);
      }
    });

    return `${url.pathname}${url.search}`;
  }

  function resolveTenantPageKeyFromPath(pathname) {
    const path = String(pathname || '').trim().toLowerCase();
    if (!path.startsWith('/tenant')) return '';
    const relative = path.slice('/tenant'.length).replace(/^\/+/, '');
    if (!relative) return 'dashboard';
    const segments = relative.split('/').filter(Boolean);
    if (!segments.length) return 'dashboard';
    if (segments[0] === 'server' && segments[1] === 'config') return 'server-config';
    if (segments[0] === 'server' && segments[1] === 'restarts') return 'restart-control';
    if (segments[0] === 'runtimes' && segments[1] === 'delivery-agents') return 'delivery-agents';
    if (segments[0] === 'runtimes' && segments[1] === 'server-bots') return 'server-bots';
    return PATH_PAGE_ALIASES[segments[segments.length - 1]] || 'dashboard';
  }

  function bootstrapLegacyTenantRoute() {
    const rawHash = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!rawHash || !Object.prototype.hasOwnProperty.call(PAGE_ALIASES, rawHash)) return;
    const pageKey = resolveTenantPageKey(rawHash);
    const nextUrl = buildCanonicalTenantHref(pageKey);
    window.history.replaceState({}, '', nextUrl);
  }

  function canonicalizeTenantLinks(scopeNode) {
    const rootNode = scopeNode instanceof Element ? scopeNode : document;
    rootNode.querySelectorAll('a[href^="#"], a[href^="/tenant"]').forEach((link) => {
      const target = String(link.getAttribute('href') || '').trim();
      if (!target || target === '#') return;
      let pageKey = '';
      if (target.startsWith('/tenant')) {
        pageKey = resolveTenantPageKeyFromPath(target);
      } else {
        const rawHash = target.replace(/^#/, '').trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(PAGE_ALIASES, rawHash)) return;
        pageKey = resolveTenantPageKey(rawHash);
      }
      if (!pageKey) return;
      const canonicalPath = buildCanonicalTenantHref(pageKey);
      if (canonicalPath && target !== canonicalPath) {
        link.setAttribute('href', canonicalPath);
      }
    });
  }

  function writeTenantUrlState(nextParams = {}) {
    const url = new URL(window.location.href);
    Object.entries(nextParams).forEach(([key, value]) => {
      const normalizedValue = String(value || '').trim();
      if (normalizedValue) {
        url.searchParams.set(key, normalizedValue);
      } else {
        url.searchParams.delete(key);
      }
    });
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  const tenantPlayerWorkflow = window.TenantPlayerWorkflowV4?.createTenantPlayerWorkflowV4?.({
    getCurrentUrl: () => new URL(window.location.href),
    writeTenantUrlState,
  }) || null;

  function buildTenantLoginRedirectUrl(options = {}) {
    const params = new URLSearchParams();
    if (options && options.switch === true) {
      params.set('switch', '1');
    }
    const nextUrl = `${window.location.pathname || '/tenant'}${window.location.search || ''}`;
    if (
      nextUrl
      && nextUrl.startsWith('/tenant')
      && !nextUrl.startsWith('//')
      && nextUrl !== '/tenant'
      && nextUrl !== '/tenant/'
    ) {
      params.set('next', nextUrl);
    }
    const query = params.toString();
    return `/tenant/login${query ? `?${query}` : ''}`;
  }

  function navigateTenantRoute(nextTarget) {
    const rawTarget = String(nextTarget || '').trim();
    if (!rawTarget || rawTarget === '#') return;
    let pageKey = 'dashboard';
    if (rawTarget.startsWith('/tenant/')) {
      const relative = rawTarget.slice('/tenant/'.length).split('/').filter(Boolean);
      if (!relative.length) {
        pageKey = 'dashboard';
      } else if (relative[0] === 'server' && relative[1] === 'config') {
        pageKey = 'server-config';
      } else if (relative[0] === 'server' && relative[1] === 'restarts') {
        pageKey = 'restart-control';
      } else if (relative[0] === 'runtimes' && relative[1] === 'delivery-agents') {
        pageKey = 'delivery-agents';
      } else if (relative[0] === 'runtimes' && relative[1] === 'server-bots') {
        pageKey = 'server-bots';
      } else {
        pageKey = PATH_PAGE_ALIASES[relative[relative.length - 1]] || 'dashboard';
      }
    } else {
      pageKey = resolveTenantPageKey(rawTarget.replace(/^#/, ''));
    }
    const canonicalHref = buildCanonicalTenantHref(pageKey);
    if (`${window.location.pathname}${window.location.search}` !== canonicalHref) {
      window.history.pushState({}, '', canonicalHref);
      const surfaceState = renderCurrentPage();
      if (!surfaceState?.notice && state.payload && !state.refreshing) {
        setStatus(t('tenant.app.status.ready', 'Ready'), 'success');
      }
      return;
    }
    const surfaceState = renderCurrentPage();
    if (!surfaceState?.notice && state.payload && !state.refreshing) {
      setStatus(t('tenant.app.status.ready', 'Ready'), 'success');
    }
  }

  function createEmptyFeatureAccess(tenantId) {
    return {
      tenantId: tenantId || null,
      enabledFeatureKeys: [],
      featureOverrides: { enabled: [], disabled: [] },
      plan: null,
      package: null,
    };
  }

  function normalizeFeatureAccess(raw, tenantId, previewMode) {
    const enabledFeatureKeys = Array.isArray(raw?.enabledFeatureKeys)
      ? raw.enabledFeatureKeys.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    return {
      tenantId: String(raw?.tenantId || tenantId || '').trim() || null,
      enabledFeatureKeys,
      featureSet: new Set(enabledFeatureKeys),
      previewMode: Boolean(previewMode),
    };
  }

  function hasAnyTenantFeature(featureAccess, requiredFeatures) {
    if (!Array.isArray(requiredFeatures) || !requiredFeatures.length) return true;
    return requiredFeatures.some((key) => featureAccess.featureSet.has(String(key || '').trim()));
  }

  function buildNavItemLabel(baseLabel, accessState) {
    const label = String(baseLabel || '').trim();
    if (!label) return '';
    if (accessState?.preview) return `${label} (${t('tenant.app.tag.preview', 'ดูตัวอย่าง')})`;
    if (accessState?.locked) return `${label} (${t('tenant.app.tag.upgrade', 'ต้องอัปเกรด')})`;
    return label;
  }

  function buildTenantSurfaceState(payload, requestedPage) {
    const previewMode = Boolean(
      payload?.tenantConfig?.previewMode
      || payload?.overview?.tenantConfig?.previewMode
      || payload?.overview?.opsState?.previewMode
      || payload?.overview?.opsState?.preview,
    );
    const canonicalEntitlements = payload?.featureEntitlements && typeof payload.featureEntitlements === 'object'
      ? payload.featureEntitlements
      : null;
    const featureAccess = normalizeFeatureAccess(
      payload?.overview?.tenantFeatureAccess || createEmptyFeatureAccess(payload?.tenantId),
      payload?.tenantId,
      previewMode,
    );
    const pageAccess = Object.fromEntries(
      Object.entries(PAGE_FEATURE_RULES).map(([pageKey, requiredFeatures]) => {
        const sectionKey = PAGE_SECTION_KEYS[pageKey];
        const sectionEntitlement = sectionKey
          ? canonicalEntitlements?.sections?.[sectionKey] || null
          : null;
        const enabledByPackage = hasAnyTenantFeature(featureAccess, requiredFeatures);
        const enabled = previewMode
          ? true
          : sectionEntitlement
            ? sectionEntitlement.enabled !== false
            : enabledByPackage;
        return [pageKey, {
          enabled,
          locked: !enabled,
          preview: previewMode && !enabledByPackage,
          requiredFeatures: [...requiredFeatures],
          reason: sectionEntitlement?.reason || null,
          upgradeCta: sectionEntitlement?.upgradeCta || null,
          sectionKey,
        }];
      }),
    );
    const knownPage = Object.prototype.hasOwnProperty.call(PAGE_TITLE_KEYS, requestedPage) || requestedPage === 'dashboard';
    const resolvedPage = knownPage ? requestedPage : 'dashboard';
    const navGroups = [
      {
        label: 'หน้าแรก',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.dashboard, 'ภาพรวมงานประจำวัน'), pageAccess.dashboard),
            href: buildCanonicalTenantHref('dashboard'),
            current: resolvedPage === 'dashboard',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.onboarding, 'ตั้งค่าเริ่มต้น'), pageAccess.onboarding),
            href: buildCanonicalTenantHref('onboarding'),
            current: resolvedPage === 'onboarding',
          },
        ],
      },
      {
        label: 'เซิร์ฟเวอร์',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS['server-status'], 'สถานะเซิร์ฟเวอร์'), pageAccess['server-status']),
            href: buildCanonicalTenantHref('server-status'),
            current: resolvedPage === 'server-status',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS['server-config'], 'ตั้งค่าเซิร์ฟเวอร์'), pageAccess['server-config']),
            href: buildCanonicalTenantHref('server-config'),
            current: resolvedPage === 'server-config',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS['restart-control'], 'ควบคุมการรีสตาร์ต'), pageAccess['restart-control']),
            href: buildCanonicalTenantHref('restart-control'),
            current: resolvedPage === 'restart-control',
          },
        ],
      },
      {
        label: 'งานปฏิบัติการ',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS['logs-sync'], 'บันทึกและการซิงก์'), pageAccess['logs-sync']),
            href: buildCanonicalTenantHref('logs-sync'),
            current: resolvedPage === 'logs-sync',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.orders, 'คำสั่งซื้อและการส่งของ'), pageAccess.orders),
            href: buildCanonicalTenantHref('orders'),
            current: resolvedPage === 'orders',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.analytics, 'การวิเคราะห์และรายงาน'), pageAccess.analytics),
            href: buildCanonicalTenantHref('analytics'),
            current: resolvedPage === 'analytics',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.players, 'ผู้เล่นและการช่วยเหลือ'), pageAccess.players),
            href: buildCanonicalTenantHref('players'),
            current: resolvedPage === 'players',
          },
        ],
      },
      {
        label: 'ชุมชน',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.donations, 'แพ็กเกจสนับสนุน'), pageAccess.donations),
            href: buildCanonicalTenantHref('donations'),
            current: resolvedPage === 'donations',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.events, 'กิจกรรม'), pageAccess.events),
            href: buildCanonicalTenantHref('events'),
            current: resolvedPage === 'events',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.modules, 'โมดูลบอต'), pageAccess.modules),
            href: buildCanonicalTenantHref('modules'),
            current: resolvedPage === 'modules',
          },
        ],
      },
      {
        label: 'บอต',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS['delivery-agents'], 'บอตส่งของ'), pageAccess['delivery-agents']),
            href: buildCanonicalTenantHref('delivery-agents'),
            current: resolvedPage === 'delivery-agents',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS['server-bots'], 'บอตเซิร์ฟเวอร์'), pageAccess['server-bots']),
            href: buildCanonicalTenantHref('server-bots'),
            current: resolvedPage === 'server-bots',
          },
        ],
      },
      {
        label: 'ทีมงาน',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.staff, 'ทีมงาน'), pageAccess.staff),
            href: buildCanonicalTenantHref('staff'),
            current: resolvedPage === 'staff',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.roles, 'บทบาทและสิทธิ์'), pageAccess.roles),
            href: buildCanonicalTenantHref('roles'),
            current: resolvedPage === 'roles',
          },
        ],
      },
      {
        label: 'บัญชี',
        items: [
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.settings, 'ตั้งค่า'), pageAccess.settings),
            href: buildCanonicalTenantHref('settings'),
            current: resolvedPage === 'settings',
          },
          {
            label: buildNavItemLabel(t(PAGE_TITLE_KEYS.billing, 'แพ็กเกจและการชำระเงิน'), pageAccess.billing),
            href: buildCanonicalTenantHref('billing'),
            current: resolvedPage === 'billing',
          },
        ],
      },
    ];
    const visibleNavGroups = navGroups.map((group) => ({
      ...group,
      label: NAV_GROUP_LABELS[group.label] || group.label,
      items: Array.isArray(group.items) ? group.items : [],
    }));
    const notice = !knownPage
      ? {
          tone: 'warning',
          title: t('tenant.notice.unknownTitle', 'We could not match that page'),
          detail: t('tenant.notice.unknownDetail', 'The requested tenant page does not exist, so the workspace opened the daily overview instead.'),
        }
      : pageAccess[resolvedPage]?.locked
        ? {
            tone: previewMode ? 'info' : 'warning',
            title: t('tenant.notice.lockedTitle', 'This page is visible but some actions are locked'),
            detail: previewMode
              ? t('tenant.notice.previewDetail', 'Preview tenants can open this page, but live actions stay disabled until setup is complete.')
              : firstNonEmpty([
                pageAccess[resolvedPage]?.reason,
                t('tenant.notice.lockedDetail', 'The page stays visible so you can understand the feature, but some actions require a package upgrade.'),
              ], t('tenant.notice.lockedDetail', 'The page stays visible so you can understand the feature, but some actions require a package upgrade.')),
            upgradeCta: pageAccess[resolvedPage]?.upgradeCta || null,
          }
        : null;

    return {
      featureAccess,
      pageAccess,
      navGroups: visibleNavGroups,
      resolvedPage,
      notice,
    };
  }

  function readUserIdFromUrl() {
    return tenantPlayerWorkflow?.readUserIdFromUrl?.() || String(new URL(window.location.href).searchParams.get('userId') || '').trim();
  }

  function readIdentityActionFromUrl() {
    return tenantPlayerWorkflow?.readIdentityActionFromUrl?.() || String(new URL(window.location.href).searchParams.get('identityAction') || '').trim();
  }

  function readSupportReasonFromUrl() {
    return tenantPlayerWorkflow?.readSupportReasonFromUrl?.() || String(new URL(window.location.href).searchParams.get('supportReason') || '').trim();
  }

  function readSupportSourceFromUrl() {
    return tenantPlayerWorkflow?.readSupportSourceFromUrl?.() || String(new URL(window.location.href).searchParams.get('supportSource') || '').trim();
  }

  function readSupportOutcomeFromUrl() {
    return tenantPlayerWorkflow?.readSupportOutcomeFromUrl?.() || String(new URL(window.location.href).searchParams.get('supportOutcome') || '').trim();
  }

  function readPurchaseCodeFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('code') || '').trim();
  }

  function readPurchaseStatusFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('status') || '').trim();
  }

  function writeUserIdToUrl(userId) {
    if (tenantPlayerWorkflow?.writeUserIdToUrl) {
      tenantPlayerWorkflow.writeUserIdToUrl(userId);
      return;
    }
    writeTenantUrlState({
      userId,
      identityAction: '',
      supportReason: '',
      supportSource: '',
      supportOutcome: '',
      code: '',
    });
  }

  function writePlayerIdentityWorkflowToUrl(userId, identityAction, supportReason, supportSource, supportOutcome) {
    if (tenantPlayerWorkflow?.writePlayerIdentityWorkflowToUrl) {
      tenantPlayerWorkflow.writePlayerIdentityWorkflowToUrl(userId, identityAction, supportReason, supportSource, supportOutcome);
      return;
    }
    writeTenantUrlState({
      userId,
      identityAction,
      supportReason,
      supportSource,
      supportOutcome,
      code: '',
    });
  }

  function normalizeIdentitySupportIntent(value, fallbackIntent = 'review') {
    return tenantPlayerWorkflow?.normalizeIdentitySupportIntent?.(value, fallbackIntent)
      || String(fallbackIntent || 'review').trim().toLowerCase()
      || 'review';
  }

  function resolveIdentitySupportFormAction(intent) {
    return tenantPlayerWorkflow?.resolveIdentitySupportFormAction?.(intent)
      || 'review';
  }

  function describeIdentitySupportIntent(intent) {
    return tenantPlayerWorkflow?.describeIdentitySupportIntent?.(intent)
      || 'ตรวจทาน identity handoff';
  }

  function resolveIdentityFollowupAction(intent, submittedAction, requestedFollowupAction) {
    return tenantPlayerWorkflow?.resolveIdentityFollowupAction?.(intent, submittedAction, requestedFollowupAction)
      || 'review';
  }

  function buildIdentitySupportSuccessMessage(intent, submittedAction, userId, followupAction) {
    return tenantPlayerWorkflow?.buildIdentitySupportSuccessMessage?.(intent, submittedAction, userId, followupAction)
      || `บันทึก identity action ของผู้เล่น ${userId} แล้ว`;
  }

  function normalizeIdentitySupportOutcome(value, fallback = 'reviewing') {
    return tenantPlayerWorkflow?.normalizeIdentitySupportOutcome?.(value, fallback)
      || String(fallback || 'reviewing').trim().toLowerCase()
      || 'reviewing';
  }

  function writePurchaseSelectionToUrl(userId, code) {
    writeTenantUrlState({
      userId,
      code,
    });
  }

  function writePurchaseFiltersToUrl(userId, status) {
    writeTenantUrlState({
      userId,
      status,
      code: '',
    });
  }

  function pickFirstPlayerId(players) {
    const rows = Array.isArray(players) ? players : [];
    const selected = rows.find((row) => String(row?.discordId || row?.userId || '').trim());
    return String(selected?.discordId || selected?.userId || '').trim();
  }

  function pickFirstPurchaseCode(purchases) {
    const rows = Array.isArray(purchases) ? purchases : [];
    const selected = rows.find((row) => String(row?.purchaseCode || row?.code || '').trim());
    return String(selected?.purchaseCode || selected?.code || '').trim();
  }

  function redirectForMissingTenantScope(me) {
    const nextUrl = buildTenantLoginRedirectUrl({ switch: true });
    window.location.replace(nextUrl);
  }

  async function refreshState(options = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    if (!options.silent) {
      setStatus(t('tenant.app.status.loading', 'Loading tenant workspace...'), 'info');
      renderMessageCard(
        t('tenant.app.card.loadingTitle', 'Preparing tenant data'),
        t('tenant.app.card.loadingDetail', 'Loading server status, orders, players, and support tools for this tenant.'),
      );
    }
    try {
      const me = await api('/tenant/api/me', null);
      const requestedTenantId = readTenantScopeFromUrl();
      const scopedTenantId = String(me?.tenantId || (me ? requestedTenantId : '') || '').trim();
      const requestedPage = currentPage();

      if (!scopedTenantId) {
        redirectForMissingTenantScope(me);
        return;
      }

      const [
        overview,
        reconcile,
        quota,
        tenantConfig,
        servers,
        subscriptions,
        licenses,
        apiKeys,
        webhooks,
        agents,
        agentProvisioning,
        agentDevices,
        agentCredentials,
        agentSessions,
        dashboardCards,
        shopItems,
        donationsOverview,
        modulesOverview,
        queueItems,
        deadLetters,
        deliveryLifecycle,
        players,
        staffMemberships,
        tenantRoleMatrix,
        notifications,
        deliveryRuntime,
        purchaseStatuses,
        audit,
        featureEntitlements,
        events,
        raids,
      ] = await Promise.all([
        api(`/admin/api/platform/overview?tenantId=${encodeURIComponent(scopedTenantId)}`, {}).catch(() => ({})),
        api(`/admin/api/platform/reconcile?tenantId=${encodeURIComponent(scopedTenantId)}&windowMs=3600000&pendingOverdueMs=1200000`, {}).catch(() => ({})),
        api(
          `/admin/api/platform/quota?tenantId=${encodeURIComponent(scopedTenantId)}`,
          {
            ok: false,
            reason: 'quota-unavailable',
            tenantId: scopedTenantId,
            tenant: null,
            plan: null,
            subscription: null,
            license: null,
            package: null,
            features: [],
            enabledFeatureKeys: [],
            featureOverrides: {
              enabled: [],
              disabled: [],
            },
            quotas: {},
          },
        ).catch(() => ({
          ok: false,
          reason: 'quota-unavailable',
          tenantId: scopedTenantId,
          tenant: null,
          plan: null,
          subscription: null,
          license: null,
          package: null,
          features: [],
          enabledFeatureKeys: [],
          featureOverrides: {
            enabled: [],
            disabled: [],
          },
          quotas: {},
        })),
        api(`/admin/api/platform/tenant-config?tenantId=${encodeURIComponent(scopedTenantId)}`, {}).catch(() => ({})),
        api(`/admin/api/platform/servers?tenantId=${encodeURIComponent(scopedTenantId)}`, []).catch(() => []),
        api(`/admin/api/platform/subscriptions?tenantId=${encodeURIComponent(scopedTenantId)}&limit=6`, []).catch(() => []),
        api(`/admin/api/platform/licenses?tenantId=${encodeURIComponent(scopedTenantId)}&limit=6`, []).catch(() => []),
        api(`/admin/api/platform/apikeys?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`, []).catch(() => []),
        api(`/admin/api/platform/webhooks?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`, []).catch(() => []),
        api(`/admin/api/platform/agents?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, []).catch(() => []),
        api(`/admin/api/platform/agent-provisioning?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []).catch(() => []),
        api(`/admin/api/platform/agent-devices?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []).catch(() => []),
        api(`/admin/api/platform/agent-credentials?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []).catch(() => []),
        api(`/admin/api/platform/agent-sessions?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []).catch(() => []),
        api(`/admin/api/dashboard/cards?tenantId=${encodeURIComponent(scopedTenantId)}`, null).catch(() => null),
        api(`/admin/api/shop/list?tenantId=${encodeURIComponent(scopedTenantId)}&limit=24`, { items: [] }).catch(() => ({ items: [] })),
        api(`/admin/api/donations/overview?tenantId=${encodeURIComponent(scopedTenantId)}&days=30&limit=8`, {}).catch(() => ({})),
        api(`/admin/api/modules/overview?tenantId=${encodeURIComponent(scopedTenantId)}&limit=6`, {}).catch(() => ({})),
        api(`/admin/api/delivery/queue?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }),
        api(`/admin/api/delivery/dead-letter?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }),
        api(`/admin/api/delivery/lifecycle?tenantId=${encodeURIComponent(scopedTenantId)}&limit=80&pendingOverdueMs=1200000`, {}),
        api(`/admin/api/player/accounts?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }).catch(() => ({ items: [] })),
        api(`/admin/api/platform/tenant-staff?tenantId=${encodeURIComponent(scopedTenantId)}&limit=50`, []).catch(() => []),
        api(`/admin/api/platform/tenant-role-matrix?tenantId=${encodeURIComponent(scopedTenantId)}`, { roles: [], currentAccess: null }).catch(() => ({ roles: [], currentAccess: null })),
        api(`/admin/api/notifications?tenantId=${encodeURIComponent(scopedTenantId)}&acknowledged=false&limit=10`, { items: [] }),
        api('/admin/api/delivery/runtime', {}),
        api('/admin/api/purchase/statuses', { knownStatuses: [], allowedTransitions: [] }),
        api(`/admin/api/audit/query?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }).catch(() => ({ items: [] })),
        api(`/admin/api/feature-access?tenantId=${encodeURIComponent(scopedTenantId)}`, null).catch(() => null),
        api(`/admin/api/event/list?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, []).catch(() => []),
        api(`/admin/api/raid/list?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { requests: [], windows: [], summaries: [] }).catch(() => ({ requests: [], windows: [], summaries: [] })),
      ]);

      const serverRows = Array.isArray(servers) ? servers : [];
      const activeServer = serverRows[0] || null;
      const [
        serverConfigWorkspace,
        serverConfigJobs,
        restartPlans,
        restartExecutions,
        serverDiscordLinks,
        syncRuns,
        syncEvents,
        billingOverview,
        billingInvoices,
        billingPaymentAttempts,
        killfeed,
      ] = activeServer?.id
        ? await Promise.all([
          api(
            `/admin/api/platform/servers/${encodeURIComponent(activeServer.id)}/config?tenantId=${encodeURIComponent(scopedTenantId)}`,
            null,
          ).catch(() => null),
          api(
            `/admin/api/platform/servers/${encodeURIComponent(activeServer.id)}/config/jobs?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`,
            [],
          ).catch(() => []),
          api(
            `/admin/api/platform/restart-plans?tenantId=${encodeURIComponent(scopedTenantId)}&serverId=${encodeURIComponent(activeServer.id)}&limit=12`,
            [],
          ).catch(() => []),
          api(
            `/admin/api/platform/restart-executions?tenantId=${encodeURIComponent(scopedTenantId)}&serverId=${encodeURIComponent(activeServer.id)}&limit=12`,
            [],
          ).catch(() => []),
          api(
            `/admin/api/platform/server-discord-links?tenantId=${encodeURIComponent(scopedTenantId)}&serverId=${encodeURIComponent(activeServer.id)}`,
            [],
          ).catch(() => []),
          api(
            `/admin/api/platform/sync-runs?tenantId=${encodeURIComponent(scopedTenantId)}&serverId=${encodeURIComponent(activeServer.id)}`,
            [],
          ).catch(() => []),
          api(
            `/admin/api/platform/sync-events?tenantId=${encodeURIComponent(scopedTenantId)}&serverId=${encodeURIComponent(activeServer.id)}`,
            [],
          ).catch(() => []),
          Promise.resolve({}),
          Promise.resolve([]),
          Promise.resolve([]),
          api(
            `/admin/api/killfeed/list?tenantId=${encodeURIComponent(scopedTenantId)}&serverId=${encodeURIComponent(activeServer.id)}&limit=20`,
            { items: [] },
          ).catch(() => ({ items: [] })),
        ])
        : [null, [], [], [], [], [], [], {}, [], [], { items: [] }];

      const [
        tenantBillingOverview,
        tenantBillingInvoices,
        tenantBillingPaymentAttempts,
      ] = await Promise.all([
        api(
          `/admin/api/platform/billing/overview?tenantId=${encodeURIComponent(scopedTenantId)}`,
          {},
        ).catch(() => ({})),
        api(
          `/admin/api/platform/billing/invoices?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`,
          [],
        ).catch(() => []),
        api(
          `/admin/api/platform/billing/payment-attempts?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`,
          [],
        ).catch(() => []),
      ]);

      const playerRows = Array.isArray(players?.items) ? players.items : [];
      const selectedUserId = readUserIdFromUrl() || pickFirstPlayerId(playerRows);
      const selectedIdentityAction = readIdentityActionFromUrl();
      const selectedSupportReason = readSupportReasonFromUrl();
      const selectedSupportSource = readSupportSourceFromUrl();
      const selectedSupportOutcome = readSupportOutcomeFromUrl();
      const selectedStatus = readPurchaseStatusFromUrl();
      const purchaseLookup = selectedUserId
        ? await api(
          `/admin/api/purchase/list?tenantId=${encodeURIComponent(scopedTenantId)}&userId=${encodeURIComponent(selectedUserId)}&status=${encodeURIComponent(selectedStatus)}&limit=20`,
          { items: [], userId: selectedUserId, status: selectedStatus },
        ).catch(() => ({ items: [], userId: selectedUserId, status: selectedStatus }))
        : { items: [], userId: '', status: '' };
      const selectedPlayerIdentity = requestedPage === 'players' && selectedUserId
        ? await api(
          `/admin/api/player/identity?tenantId=${encodeURIComponent(scopedTenantId)}&userId=${encodeURIComponent(selectedUserId)}`,
          null,
        ).catch(() => null)
        : null;
      const selectedCode = readPurchaseCodeFromUrl() || pickFirstPurchaseCode(purchaseLookup?.items);
      const deliveryCase = selectedCode
        ? await api(`/admin/api/delivery/detail?tenantId=${encodeURIComponent(scopedTenantId)}&code=${encodeURIComponent(selectedCode)}&limit=80`, null).catch(() => null)
        : null;

      state.payload = {
        me,
        tenantId: scopedTenantId,
        tenantLabel: resolveTenantLabel(scopedTenantId, me, overview, tenantConfig),
        servers: serverRows,
        activeServer,
        serverConfigWorkspace,
        serverConfigJobs: Array.isArray(serverConfigJobs) ? serverConfigJobs : [],
        restartPlans: Array.isArray(restartPlans) ? restartPlans : [],
        restartExecutions: Array.isArray(restartExecutions) ? restartExecutions : [],
        serverDiscordLinks: Array.isArray(serverDiscordLinks) ? serverDiscordLinks : [],
        syncRuns: Array.isArray(syncRuns) ? syncRuns : [],
        syncEvents: Array.isArray(syncEvents) ? syncEvents : [],
        overview,
        reconcile,
        quota,
        tenantConfig,
        subscriptions,
        licenses,
        apiKeys,
        webhooks,
        agents,
        agentProvisioning: Array.isArray(agentProvisioning) ? agentProvisioning : [],
        agentDevices: Array.isArray(agentDevices) ? agentDevices : [],
        agentCredentials: Array.isArray(agentCredentials) ? agentCredentials : [],
        agentSessions: Array.isArray(agentSessions) ? agentSessions : [],
        dashboardCards,
        shopItems: Array.isArray(shopItems?.items) ? shopItems.items : [],
        donationsOverview: donationsOverview && typeof donationsOverview === 'object' ? donationsOverview : {},
        modulesOverview: modulesOverview && typeof modulesOverview === 'object' ? modulesOverview : {},
        queueItems: Array.isArray(queueItems?.items) ? queueItems.items : [],
        deadLetters: Array.isArray(deadLetters?.items) ? deadLetters.items : [],
        deliveryLifecycle,
        players: playerRows,
        staffMemberships: Array.isArray(staffMemberships) ? staffMemberships : [],
        tenantRoleMatrix: tenantRoleMatrix && typeof tenantRoleMatrix === 'object'
          ? tenantRoleMatrix
          : { roles: [], currentAccess: null },
        notifications: filterTenantNotifications(
          Array.isArray(notifications?.items) ? notifications.items : [],
          scopedTenantId,
        ),
        deliveryRuntime,
        purchaseStatuses,
        audit,
        featureEntitlements,
        events: Array.isArray(events) ? events : [],
        raids: raids && typeof raids === 'object'
          ? {
            requests: Array.isArray(raids.requests) ? raids.requests : [],
            windows: Array.isArray(raids.windows) ? raids.windows : [],
            summaries: Array.isArray(raids.summaries) ? raids.summaries : [],
          }
          : { requests: [], windows: [], summaries: [] },
        billingOverview: tenantBillingOverview && typeof tenantBillingOverview === 'object' ? tenantBillingOverview : {},
        billingInvoices: Array.isArray(tenantBillingInvoices) ? tenantBillingInvoices : [],
        billingPaymentAttempts: Array.isArray(tenantBillingPaymentAttempts) ? tenantBillingPaymentAttempts : [],
        killfeed: Array.isArray(killfeed?.items) ? killfeed.items : (Array.isArray(killfeed) ? killfeed : []),
        purchaseLookup,
        deliveryCase,
        selectedUserId,
        selectedPlayerIdentity,
        selectedIdentityAction,
        selectedSupportReason,
        selectedSupportSource,
        selectedSupportOutcome,
        selectedPurchaseCode: selectedCode,
        selectedPurchaseStatus: selectedStatus,
      };

      const surfaceState = renderCurrentPage();
      setStatus(
        surfaceState?.notice ? surfaceState.notice.detail : t('tenant.app.status.ready', 'Ready'),
        surfaceState?.notice ? (surfaceState.notice.tone || 'warning') : 'success',
      );
    } catch (error) {
      renderMessageCard(
        t('tenant.app.card.loadFailedTitle', 'Could not load tenant workspace'),
        String(error?.message || error),
      );
      setStatus(t('tenant.app.status.loadFailed', 'Load failed'), 'danger');
    } finally {
      state.refreshing = false;
    }
  }

  function renderCurrentPage() {
    const target = root();
    if (!target) return;
    if (!state.payload) {
      renderMessageCard(
        t('tenant.app.card.emptyTitle', 'No tenant data yet'),
        t('tenant.app.card.emptyDetail', 'Wait for the latest tenant data to load.'),
      );
      return;
    }

    const requestedPage = currentPage();
    const surfaceState = buildTenantSurfaceState(state.payload, requestedPage);
    const renderState = {
      ...state.payload,
      __surfaceShell: {
        navGroups: surfaceState.navGroups,
      },
      __surfaceNotice: surfaceState.notice,
      __surfaceAccess: surfaceState.pageAccess,
      __provisioningResult: state.provisioningResult,
    };
    const page = surfaceState.resolvedPage;
    document.body.dataset.tenantPage = page;
    document.body.dataset.tenantRoute = requestedPage || page;
    const renderers = {
      dashboard: () => window.TenantDashboardV4.renderTenantDashboardV4(target, renderState),
      onboarding: () => window.TenantOnboardingV4.renderTenantOnboardingV4(target, renderState),
      'server-status': () => window.TenantServerStatusV4.renderTenantServerStatusV4(target, renderState),
      'server-config': () => window.TenantServerConfigV4.renderTenantServerConfigV4(target, renderState),
      'logs-sync': () => window.TenantLogsSyncV4.renderTenantLogsSyncV4(target, renderState),
      orders: () => window.TenantOrdersV4.renderTenantOrdersV4(target, renderState),
      donations: () => window.TenantDonationsV4.renderTenantDonationsV4(target, renderState),
      analytics: () => window.TenantAnalyticsV4.renderTenantAnalyticsV4(target, renderState),
      events: () => window.TenantEventsV4.renderTenantEventsV4(target, renderState),
      modules: () => window.TenantModulesV4.renderTenantModulesV4(target, renderState),
      players: () => window.TenantPlayersV4.renderTenantPlayersV4(target, renderState),
      staff: () => window.TenantStaffV4.renderTenantStaffV4(target, renderState),
      roles: () => window.TenantRolesV4.renderTenantRolesV4(target, renderState),
      settings: () => window.TenantSettingsV4.renderTenantSettingsV4(target, renderState),
      billing: () => window.TenantBillingV4.renderTenantBillingV4(target, renderState),
      'delivery-agents': () => window.TenantDeliveryAgentsV4.renderTenantDeliveryAgentsV4(target, renderState),
      'server-bots': () => window.TenantServerBotsV4.renderTenantServerBotsV4(target, renderState),
      'restart-control': () => window.TenantRestartControlV4.renderTenantRestartControlV4(target, renderState),
    };
    (renderers[page] || renderers.dashboard)();
    const canonicalPath = buildCanonicalTenantPath(page);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', `${canonicalPath}${window.location.search || ''}`);
    }
    canonicalizeTenantLinks(target);
    wirePageInteractions(page, renderState, surfaceState);
    applyTenantLockPresentation(page, renderState);
    if (surfaceState.notice) {
      window.setTimeout(() => {
        setStatus(surfaceState.notice.detail, surfaceState.notice.tone || 'warning');
      }, 0);
    }
    applyI18n(target);
    localizeTenantActivePage(target);
    document.title = `SCUM TH Platform | Tenant | ${translateTenantActiveText(t(PAGE_TITLE_KEYS[page] || 'tenant.app.page.dashboard', 'Daily overview'))}`;
    return surfaceState;
  }

  function setActionButtonBusy(button, busy, label) {
    if (!button) return;
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || '';
    }
    button.disabled = busy;
    button.textContent = busy
      ? translateTenantActiveText(label)
      : translateTenantActiveText(button.dataset.originalLabel);
  }

  function getServerConfigFieldNodes() {
    return Array.from(document.querySelectorAll('[data-server-config-field][data-setting-file][data-setting-key]'));
  }

  function normalizeLineListEntries(value) {
    if (Array.isArray(value)) {
      return value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return normalizeLineListEntries(parsed);
      } catch {
        return value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
      }
    }
    return [];
  }

  function readTypedFieldValue(node) {
    const type = String(node?.getAttribute('data-setting-type') || '').trim().toLowerCase();
    if (type === 'line-list') {
      return normalizeLineListEntries(node?.value || '');
    }
    if (type === 'boolean') {
      return Boolean(node?.checked);
    }
    if (type === 'number') {
      const numeric = Number(node?.value);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return String(node?.value || '');
  }

  function readOriginalFieldValue(node) {
    const type = String(node?.getAttribute('data-setting-type') || '').trim().toLowerCase();
    const raw = String(node?.getAttribute('data-current-value') || '');
    if (type === 'line-list') {
      return normalizeLineListEntries(raw);
    }
    if (type === 'boolean') {
      return raw === 'true';
    }
    if (type === 'number') {
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return raw;
  }

  function valuesEqual(left, right, type) {
    if (type === 'line-list') {
      const leftList = normalizeLineListEntries(left);
      const rightList = normalizeLineListEntries(right);
      return leftList.length === rightList.length && leftList.every((value, index) => value === rightList[index]);
    }
    if (type === 'number') {
      return Number(left) === Number(right);
    }
    return String(left) === String(right);
  }

  function buildServerConfigChangesFromUi() {
    return getServerConfigFieldNodes().map((node) => {
      const type = String(node.getAttribute('data-setting-type') || '').trim().toLowerCase();
      const value = readTypedFieldValue(node);
      const currentValue = readOriginalFieldValue(node);
      return {
        node,
        file: String(node.getAttribute('data-setting-file') || '').trim(),
        section: String(node.getAttribute('data-setting-section') || '').trim(),
        key: String(node.getAttribute('data-setting-key') || '').trim(),
        type,
        value,
        currentValue,
        changed: !valuesEqual(value, currentValue, type),
      };
    }).filter((entry) => entry.file && entry.key);
  }

  function syncLineListFieldValue(node) {
    if (!node) return;
    const card = node.closest('[data-setting-card]');
    const inputs = Array.from(card?.querySelectorAll('[data-line-list-entry]') || []);
    const entries = normalizeLineListEntries(inputs.map((input) => input.value));
    node.value = JSON.stringify(entries);
    const countNode = card?.querySelector('[data-line-list-count]');
    if (countNode) {
      countNode.textContent = entries.length ? `${entries.length} รายการ` : 'ยังไม่มีรายการ';
    }
  }

  function createLineListRow(value = '', disabled = false) {
    const row = document.createElement('div');
    row.className = 'tdv4-line-list-row';

    const input = document.createElement('input');
    input.className = 'tdv4-basic-input tdv4-line-list-input';
    input.type = 'text';
    input.value = value;
    input.setAttribute('data-line-list-entry', '');

    const button = document.createElement('button');
    button.className = 'tdv4-button tdv4-button-secondary tdv4-line-list-remove';
    button.type = 'button';
    button.setAttribute('data-line-list-remove', '');
    button.textContent = 'ลบ';

    if (disabled) {
      input.disabled = true;
      button.disabled = true;
    }

    row.appendChild(input);
    row.appendChild(button);
    return row;
  }

  function wireLineListField(node, previewMode) {
    const card = node?.closest('[data-setting-card]');
    const list = card?.querySelector('[data-line-list-list]');
    const addButton = card?.querySelector('[data-line-list-add]');
    if (!card || !list || !addButton) return;

    if (previewMode) {
      addButton.disabled = true;
      list.querySelectorAll('[data-line-list-entry], [data-line-list-remove]').forEach((element) => {
        element.disabled = true;
      });
    }

    list.addEventListener('input', (event) => {
      const input = event.target.closest('[data-line-list-entry]');
      if (!input) return;
      syncLineListFieldValue(node);
      updateServerConfigFieldState(node);
      updateServerConfigHelpFromField(node);
      updateServerConfigSavebar();
      window.__tenantServerConfigApplyFilters?.();
      setStatus('มีการแก้ไขค่าจริงที่ยังไม่บันทึก', 'warning');
    });

    list.addEventListener('focusin', (event) => {
      if (event.target.closest('[data-line-list-entry]')) {
        updateServerConfigHelpFromField(node);
      }
    });

    list.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-line-list-remove]');
      if (!removeButton || previewMode) return;
      const row = removeButton.closest('.tdv4-line-list-row');
      if (row) {
        row.remove();
      }
      if (!list.querySelector('[data-line-list-entry]')) {
        list.appendChild(createLineListRow(''));
      }
      syncLineListFieldValue(node);
      updateServerConfigFieldState(node);
      updateServerConfigHelpFromField(node);
      updateServerConfigSavebar();
      window.__tenantServerConfigApplyFilters?.();
      setStatus('มีการแก้ไขค่าจริงที่ยังไม่บันทึก', 'warning');
    });

    addButton.addEventListener('click', () => {
      if (previewMode) return;
      const row = createLineListRow('');
      list.appendChild(row);
      row.querySelector('[data-line-list-entry]')?.focus();
      syncLineListFieldValue(node);
      updateServerConfigFieldState(node);
      updateServerConfigHelpFromField(node);
      updateServerConfigSavebar();
      window.__tenantServerConfigApplyFilters?.();
      setStatus('มีการแก้ไขค่าจริงที่ยังไม่บันทึก', 'warning');
    });

    syncLineListFieldValue(node);
  }

  function updateServerConfigFieldState(node) {
    const card = node?.closest('[data-setting-card]');
    if (!card) return;
    const type = String(node.getAttribute('data-setting-type') || '').trim().toLowerCase();
    const changed = !valuesEqual(readTypedFieldValue(node), readOriginalFieldValue(node), type);
    card.classList.toggle('is-dirty', changed);
  }

  function updateServerConfigHelpFromField(node) {
    const helpTitle = document.querySelector('[data-server-config-help-title]');
    const helpDescription = document.querySelector('[data-server-config-help-description]');
    const helpMeta = document.querySelector('[data-server-config-help-meta]');
    const badgeRow = helpTitle?.parentElement?.querySelector('.tdv4-config-key-row');
    if (!node) {
      if (helpTitle) {
        helpTitle.textContent = 'เลือกค่าที่ต้องการ';
      }
      if (helpDescription) {
        helpDescription.textContent = 'ใช้ช่องค้นหา ตัวกรอง และแท็บหมวดด้านบนเพื่อหาค่าที่ต้องการแก้';
      }
      if (helpMeta) {
        helpMeta.textContent = 'ยังไม่มีค่าที่ตรงกับตัวกรองในหมวดที่กำลังเปิดอยู่';
      }
      if (badgeRow) {
        badgeRow.innerHTML = '';
      }
      return;
    }
    if (helpTitle) {
      helpTitle.textContent = String(node.getAttribute('data-setting-label') || '').trim() || 'ค่าที่เลือก';
    }
    if (helpDescription) {
      helpDescription.textContent = String(node.getAttribute('data-setting-description') || '').trim() || 'ยังไม่มีคำอธิบายเพิ่มเติม';
    }
    if (helpMeta) {
      const fileLabel = String(node.getAttribute('data-setting-file-label') || '').trim() || '-';
      const rawKey = String(node.getAttribute('data-setting-raw-key') || '').trim() || '-';
      const restart = String(node.getAttribute('data-setting-requires-restart') || '').trim() === 'true'
        ? 'ค่าชุดนี้ต้องรีสตาร์ต'
        : 'ค่าชุดนี้ใช้ได้โดยไม่ต้องรีสตาร์ต';
      helpMeta.textContent = `ไฟล์ ${fileLabel} · ${rawKey} · ${restart}`;
    }
    if (badgeRow) {
      const currentLabel = String(node.getAttribute('data-setting-current-label') || '').trim() || '-';
      const defaultLabel = String(node.getAttribute('data-setting-default-label') || '').trim() || '-';
      badgeRow.innerHTML = [
        `<span class="tdv4-badge tdv4-badge-info">ค่าปัจจุบัน: ${escapeHtml(currentLabel)}</span>`,
        `<span class="tdv4-badge tdv4-badge-muted">ค่าเริ่มต้น: ${escapeHtml(defaultLabel)}</span>`,
        String(node.getAttribute('data-setting-requires-restart') || '').trim() === 'true'
          ? '<span class="tdv4-badge tdv4-badge-warning">ต้องรีสตาร์ต</span>'
          : '',
      ].join('');
    }
  }

  function normalizeServerConfigSearchQuery(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function countServerConfigCards(scopeNode) {
    return Array.from(scopeNode?.querySelectorAll?.('[data-setting-card]') || []);
  }

  function findFirstVisibleServerConfigField(scopeNode) {
    const fields = Array.from(scopeNode?.querySelectorAll?.('[data-server-config-field]') || []);
    return fields.find((field) => {
      const card = field.closest('[data-setting-card]');
      const group = field.closest('[data-config-group]');
      const panel = field.closest('[data-config-category-panel]');
      return !card?.hidden && !group?.hidden && !panel?.hidden;
    }) || null;
  }

  function formatServerConfigCountLabel(visibleCount, totalCount) {
    const visible = Number(visibleCount) || 0;
    const total = Number(totalCount) || 0;
    if (total <= 0) return '0 ค่า';
    if (visible >= total) return `${total} ค่า`;
    return `${visible} / ${total} ค่า`;
  }

  function updateServerConfigSavebar() {
    const changeNode = document.querySelector('[data-server-config-change-count]');
    const restartNode = document.querySelector('[data-server-config-restart-count]');
    const changedEntries = buildServerConfigChangesFromUi().filter((entry) => entry.changed);
    const changedCount = changedEntries.length;
    if (changeNode) {
      changeNode.textContent = changedCount
        ? `มีค่าที่แก้ค้างอยู่ ${changedCount} จุด`
        : 'ยังไม่มีค่าที่แก้ค้างอยู่';
    }
    if (restartNode) {
      const restartCount = changedEntries.filter((entry) => String(entry?.node?.getAttribute('data-setting-requires-restart') || '').trim() === 'true').length;
      restartNode.hidden = restartCount === 0;
      restartNode.textContent = restartCount > 0
        ? `${restartCount} จุดต้องรีสตาร์ต`
        : 'ต้องรีสตาร์ต';
    }
  }

  function switchServerConfigCategory(categoryKey) {
    const tabs = Array.from(document.querySelectorAll('[data-config-category-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-config-category-panel]'));
    const nextKey = String(categoryKey || '').trim();
    const requestedTab = tabs.find((tab) => String(tab.getAttribute('data-config-category-tab') || '').trim() === nextKey);
    const activeTab = requestedTab && !requestedTab.hidden
      ? requestedTab
      : tabs.find((tab) => tab.classList.contains('is-current') && !tab.hidden)
      || tabs.find((tab) => !tab.hidden)
      || null;
    const activeKey = String(activeTab?.getAttribute('data-config-category-tab') || '').trim();
    const globalEmptyVisible = document.querySelector('[data-config-results-empty]')?.hidden === false;
    tabs.forEach((tab) => {
      const current = String(tab.getAttribute('data-config-category-tab') || '').trim() === activeKey;
      tab.classList.toggle('is-current', current);
      tab.setAttribute('aria-pressed', current ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const current = !globalEmptyVisible && String(panel.getAttribute('data-config-category-panel') || '').trim() === activeKey;
      panel.hidden = !current;
      panel.classList.toggle('tdv4-config-category-panel-current', current);
    });
    const activePanel = !globalEmptyVisible && activeKey
      ? document.querySelector(`[data-config-category-panel="${activeKey}"]`)
      : null;
    const firstField = findFirstVisibleServerConfigField(activePanel);
    updateServerConfigHelpFromField(firstField);
  }

  function slugifyRuntimeKey(value, fallbackPrefix) {
    const base = String(value || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const safeBase = base || `${fallbackPrefix}-${Date.now()}`;
    return safeBase.length <= 80 ? safeBase : safeBase.slice(0, 80);
  }

  function escapePowerShellValue(value) {
    return String(value ?? '')
      .replace(/`/g, '``')
      .replace(/"/g, '`"');
  }

  function buildPowerShellEnvLine(name, value) {
    return `$env:${String(name || '').trim()}="${escapePowerShellValue(value)}"`;
  }

  function escapePowerShellSingleQuote(value) {
    return String(value ?? '').replace(/'/g, "''");
  }

  function buildPowerShellQuotedValue(value) {
    return `'${escapePowerShellSingleQuote(value)}'`;
  }

  function downloadClientFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  function triggerServerDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = String(filename || '').trim();
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
    }, 0);
  }

  async function requestServerDownload(filename, content, mimeType) {
    const prepared = await apiRequest('/admin/api/platform/runtime-download/prepare', {
      method: 'POST',
      body: {
        filename,
        content,
        mimeType,
      },
    }, null);
    const downloadEndpoint = String(prepared?.downloadEndpoint || '').trim();
    const downloadToken = String(prepared?.downloadToken || '').trim();
    if (!downloadEndpoint || !downloadToken) {
      throw new Error('ยังไม่สามารถเตรียมไฟล์ดาวน์โหลดได้');
    }
    const response = await fetch(downloadEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: downloadToken,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(String(payload?.error || 'ดาวน์โหลดไฟล์ไม่สำเร็จ'));
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    triggerServerDownload(objectUrl, prepared?.filename || filename);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    return prepared;
  }

  function buildRuntimeInstallFileBaseName(kind, displayName, runtimeKey) {
    const fallbackPrefix = kind === 'server-bots' ? 'server-bot' : 'delivery-agent';
    const basis = [displayName, runtimeKey].filter(Boolean).join(' ');
    return slugifyRuntimeKey(basis, fallbackPrefix);
  }

  function buildRuntimeInstallLauncher(scriptFilename, runtimeLabel) {
    return [
      '@echo off',
      'setlocal',
      `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0${scriptFilename}"`,
      'set "exit_code=%ERRORLEVEL%"',
      'echo.',
      'if not "%exit_code%"=="0" (',
      `  echo ${runtimeLabel} install failed. Review the PowerShell output above.`,
      '  pause',
      '  exit /b %exit_code%',
      ')',
      `echo ${runtimeLabel} install finished.`,
      'pause',
    ].join('\r\n');
  }

  function buildRuntimeInstallReadme(kind, payload, platformUrl, displayName, runtimeKey) {
    const bootstrap = payload?.bootstrap || {};
    const runtimeLabel = kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent';
    const setupToken = String(payload?.rawSetupToken || '').trim();
    const agentId = String(bootstrap.agentId || runtimeKey || '').trim() || '-';
    const serverId = String(bootstrap.serverId || '').trim() || '-';
    const tenantId = String(bootstrap.tenantId || '').trim() || '-';
    const lines = [
      `${runtimeLabel} installer package`,
      '================================',
      '',
      `Display name: ${displayName || runtimeLabel}`,
      `Runtime key: ${runtimeKey || '-'}`,
      `Agent ID: ${agentId}`,
      `Tenant ID: ${tenantId}`,
      `Server ID: ${serverId}`,
      `Control plane URL: ${platformUrl}`,
      `Setup token: ${setupToken || '-'}`,
      '',
      'How to use',
      '----------',
      '1. Download both files to the target Windows machine.',
      '2. Keep the .cmd and .ps1 files in the same folder.',
      '3. Double-click the .cmd file to run the installer.',
      '4. Return to Tenant web and refresh this page to confirm online status.',
      '',
      'Assumptions',
      '-----------',
      '- The runtime repository already exists on the target machine at C:\\new.',
      '- Node.js is already installed on that machine.',
      '',
    ];
    if (kind === 'server-bots') {
      lines.push(
        'Server Bot notes',
        '----------------',
        '- The installer will ask for the SCUM config folder if C:\\SCUM\\Config is not found.',
        '- After install, the script starts Server Bot automatically.',
        '- Config editing, backup, and restart flows continue from the web after the bot comes online.',
      );
    } else {
      lines.push(
        'Delivery Agent notes',
        '--------------------',
        '- The installer will ask for the shared Delivery Agent token on first run if you have not baked it into the file yet.',
        '- The default command template uses C:\\new\\scripts\\send-scum-admin-command.ps1 and assumes the SCUM window title/process name is "SCUM".',
        '- If your machine uses a different window title, adjust the generated delivery-agent env file after install.',
      );
    }
    return `${lines.join('\r\n')}\r\n`;
  }

  function buildServerBotInstallScript(payload, platformUrl, displayName, runtimeKey) {
    const bootstrap = payload?.bootstrap || {};
    const agentId = String(bootstrap.agentId || runtimeKey || '').trim() || runtimeKey;
    return [
      "$ErrorActionPreference = 'Stop'",
      '# Generated by Tenant Panel runtime provisioning',
      "$repoRoot = 'C:\\new'",
      "$installerPath = Join-Path $repoRoot 'scripts\\install-server-bot.ps1'",
      'if (-not (Test-Path $installerPath)) {',
      "  throw 'C:\\new\\scripts\\install-server-bot.ps1 was not found on this machine.'",
      '}',
      "$configRoot = 'C:\\SCUM\\Config'",
      'if (-not (Test-Path $configRoot)) {',
      "  Write-Host ''",
      "  Write-Host 'Default config folder was not found.' -ForegroundColor Yellow",
      "  $configRoot = Read-Host 'Enter the SCUM config folder'",
      '}',
      '& $installerPath `',
      '  -ControlPlaneUrl ' + buildPowerShellQuotedValue(platformUrl) + ' `',
      '  -SetupToken ' + buildPowerShellQuotedValue(String(payload?.rawSetupToken || '').trim()) + ' `',
      '  -TenantId ' + buildPowerShellQuotedValue(String(bootstrap.tenantId || '').trim()) + ' `',
      '  -ServerId ' + buildPowerShellQuotedValue(String(bootstrap.serverId || '').trim()) + ' `',
      '  -RuntimeKey ' + buildPowerShellQuotedValue(runtimeKey) + ' `',
      '  -AgentId ' + buildPowerShellQuotedValue(agentId) + ' `',
      '  -DisplayName ' + buildPowerShellQuotedValue(displayName) + ' `',
      '  -ConfigRoot $configRoot `',
      '  -StartBot',
      "Write-Host ''",
      "Write-Host 'Server Bot install finished. Refresh Tenant web to confirm runtime status.' -ForegroundColor Green",
      '',
    ].join('\r\n');
  }

  function buildDeliveryAgentInstallScript(payload, platformUrl, displayName, runtimeKey) {
    const bootstrap = payload?.bootstrap || {};
    const agentId = String(bootstrap.agentId || runtimeKey || '').trim() || runtimeKey;
    const defaultExecTemplate = 'powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\new\\scripts\\send-scum-admin-command.ps1" -WindowTitle "SCUM" -WindowProcessName "SCUM" -Command "{command}"';
    return [
      "$ErrorActionPreference = 'Stop'",
      '# Generated by Tenant Panel runtime provisioning',
      "$repoRoot = 'C:\\new'",
      "$installerPath = Join-Path $repoRoot 'scripts\\install-delivery-agent.ps1'",
      'if (-not (Test-Path $installerPath)) {',
      "  throw 'C:\\new\\scripts\\install-delivery-agent.ps1 was not found on this machine.'",
      '}',
      "$consoleAgentToken = ''",
      'if ([string]::IsNullOrWhiteSpace($consoleAgentToken)) {',
      "  Write-Host ''",
      "  Write-Host 'Enter the shared Delivery Agent token for this machine.' -ForegroundColor Yellow",
      "  $consoleAgentToken = Read-Host 'Delivery Agent token'",
      '}',
      `$defaultExecTemplate = ${buildPowerShellQuotedValue(defaultExecTemplate)}`,
      '& $installerPath `',
      `  -ControlPlaneUrl ${buildPowerShellQuotedValue(platformUrl)} \``,
      `  -SetupToken ${buildPowerShellQuotedValue(String(payload?.rawSetupToken || '').trim())} \``,
      `  -TenantId ${buildPowerShellQuotedValue(String(bootstrap.tenantId || '').trim())} \``,
      `  -ServerId ${buildPowerShellQuotedValue(String(bootstrap.serverId || '').trim())} \``,
      `  -RuntimeKey ${buildPowerShellQuotedValue(runtimeKey)} \``,
      `  -AgentId ${buildPowerShellQuotedValue(agentId)} \``,
      `  -DisplayName ${buildPowerShellQuotedValue(displayName)} \``,
      '  -ConsoleAgentToken $consoleAgentToken `',
      '  -ExecTemplate $defaultExecTemplate `',
      '  -StartBot',
      "Write-Host ''",
      "Write-Host 'Delivery Agent install finished. Refresh Tenant web to confirm runtime status.' -ForegroundColor Green",
      "Write-Host 'If your SCUM window title differs from \"SCUM\", update .runtime\\delivery-agent.env after install.' -ForegroundColor Yellow",
      '',
    ].join('\r\n');
  }

  function buildProvisioningDownloads(kind, payload, platformUrl, displayName, runtimeKey) {
    const runtimeLabel = kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent';
    const fileBaseName = buildRuntimeInstallFileBaseName(kind, displayName, runtimeKey);
    const installScriptFilename = `${fileBaseName}.ps1`;
    const quickInstallFilename = `${fileBaseName}.cmd`;
    const readmeFilename = `${fileBaseName}-README.txt`;
    const installScript = kind === 'server-bots'
      ? buildServerBotInstallScript(payload, platformUrl, displayName, runtimeKey)
      : buildDeliveryAgentInstallScript(payload, platformUrl, displayName, runtimeKey);
    return [
      {
        key: 'install-ps1',
        label: 'Download install script (.ps1)',
        filename: installScriptFilename,
        mimeType: 'text/plain;charset=utf-8',
        content: installScript,
      },
      {
        key: 'quick-install-cmd',
        label: 'Download quick install (.cmd)',
        filename: quickInstallFilename,
        mimeType: 'text/plain;charset=utf-8',
        content: buildRuntimeInstallLauncher(installScriptFilename, runtimeLabel),
      },
      {
        key: 'install-readme',
        label: 'Download setup notes (.txt)',
        filename: readmeFilename,
        mimeType: 'text/plain;charset=utf-8',
        content: buildRuntimeInstallReadme(kind, payload, platformUrl, displayName, runtimeKey),
      },
    ];
  }

  function buildProvisioningInstructions(kind, payload) {
    const bootstrap = payload?.bootstrap || {};
    const setupToken = String(payload?.rawSetupToken || '').trim();
    const runtimeKey = String(bootstrap.runtimeKey || '').trim();
    const platformUrl = `${window.location.protocol}//${window.location.host}`;
    const displayName = String(
      payload?.agent?.displayName
      || payload?.agent?.name
      || payload?.token?.displayName
      || bootstrap.displayName
      || (kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent'),
    ).trim();
    if (!setupToken || !runtimeKey) return null;
    const downloads = buildProvisioningDownloads(kind, payload, platformUrl, displayName, runtimeKey);
    const commonLines = [
      buildPowerShellEnvLine('PLATFORM_API_BASE_URL', platformUrl),
      buildPowerShellEnvLine('PLATFORM_AGENT_SETUP_TOKEN', setupToken),
      buildPowerShellEnvLine('PLATFORM_TENANT_ID', String(bootstrap.tenantId || '').trim()),
      buildPowerShellEnvLine('PLATFORM_SERVER_ID', String(bootstrap.serverId || '').trim()),
      buildPowerShellEnvLine('PLATFORM_AGENT_DISPLAY_NAME', displayName),
    ];
    if (kind === 'server-bots') {
      return {
        title: 'คำสั่งติดตั้ง Server Bot',
        command: [
          ...commonLines,
          buildPowerShellEnvLine('SCUM_SERVER_BOT_AGENT_ID', String(bootstrap.agentId || runtimeKey).trim()),
          buildPowerShellEnvLine('SCUM_SERVER_BOT_RUNTIME_KEY', runtimeKey),
          buildPowerShellEnvLine('SCUM_SERVER_BOT_NAME', displayName),
          buildPowerShellEnvLine('SCUM_SERVER_CONFIG_ROOT', 'C:\\SCUM\\Config'),
          'node C:\\new\\apps\\server-bot\\server.js',
        ].join('\n'),
        detail: 'รันบนเครื่องเซิร์ฟเวอร์ที่เข้าถึง SCUM.log, config files, backup และคำสั่ง restart/start/stop ได้',
        tone: 'success',
        steps: [
          'คัดลอกคำสั่งนี้ไปรันบนเครื่องเซิร์ฟเวอร์จริง',
          'Server Bot จะใช้ one-time setup token เพื่อ activate กับ control plane',
          'เครื่องแรกที่ใช้ token นี้สำเร็จจะถูกผูกเป็นเครื่องหลักของบอทนี้',
          'หลัง activate สำเร็จ bot จะ register, ส่ง heartbeat และอัปเดตสถานะกลับมาที่หน้านี้',
        ],
        downloads,
        facts: [
          {
            label: 'Binding rule',
            value: 'เครื่องแรกที่ activate สำเร็จจะเป็นเครื่องที่ถูกผูกไว้จนกว่าจะกด Reset binding',
          },
          {
            label: 'What this bot handles',
            value: 'Log sync, config jobs, backups และ restart/start/stop orchestration',
          },
        ],
      };
    }
    return {
      title: 'คำสั่งติดตั้ง Delivery Agent',
      command: [
        ...commonLines,
        buildPowerShellEnvLine('SCUM_AGENT_ID', String(bootstrap.agentId || runtimeKey).trim()),
        buildPowerShellEnvLine('SCUM_AGENT_RUNTIME_KEY', runtimeKey),
        buildPowerShellEnvLine('SCUM_CONSOLE_AGENT_NAME', displayName),
        'node C:\\new\\apps\\agent\\server.js',
      ].join('\n'),
      detail: 'รันบนเครื่องที่ใช้ส่งของในเกมและมี SCUM client เปิดอยู่ตลอดเวลาที่ต้องส่งของ',
      tone: 'success',
      steps: [
        'คัดลอกคำสั่งนี้ไปรันบนเครื่องที่มี SCUM client เปิดอยู่',
        'Delivery Agent จะ activate ด้วย one-time setup token และขอคีย์ใช้งานจริงจาก control plane',
        'เครื่องแรกที่ activate สำเร็จจะถูกผูกกับบอทนี้โดยอัตโนมัติ',
        'หลังจากนั้น agent จะ register, ส่ง heartbeat และพร้อมรับงานส่งของจากระบบ',
      ],
      downloads,
      facts: [
        {
          label: 'Binding rule',
          value: 'หากต้องย้ายไปอีกเครื่อง ให้กด Reset binding ก่อนออก setup token ใหม่',
        },
        {
          label: 'What this bot handles',
          value: 'Delivery jobs, in-game execution และ announce ที่ต้องรันบนเครื่องเกม',
        },
        {
          label: 'Installer note',
          value: 'ไฟล์ติดตั้งจะถามหา shared console-agent token ตอนรันครั้งแรก เพื่อให้เครื่องเกมเชื่อมกับระบบส่งของได้',
        },
      ],
    };
  }

  function collectServerConfigDraft() {
    syncFeatureFlagsTextareaFromUi(state.payload);
    syncConfigPatchTextareaFromUi();
    syncPortalEnvPatchTextareaFromUi();
    const featureFlagsNode = document.getElementById('tdv4-editor-featureFlags');
    const configPatchNode = document.getElementById('tdv4-editor-configPatch');
    const portalEnvPatchNode = document.getElementById('tdv4-editor-portalEnvPatch');
    return {
      featureFlags: parseConfigJsonInput(featureFlagsNode?.value, 'Feature Flags', { emptyAsObject: true }),
      configPatch: parseConfigJsonInput(configPatchNode?.value, 'Server settings changes', { emptyAsObject: true }),
      portalEnvPatch: parseConfigJsonInput(portalEnvPatchNode?.value, 'Portal settings', { emptyAsObject: true }),
    };
  }

  function getFeatureFlagToggleNodes() {
    return Array.from(document.querySelectorAll('[data-feature-flag-toggle][data-feature-flag-key]'));
  }

  function getConfigPatchFieldNodes() {
    return Array.from(document.querySelectorAll('[data-config-patch-field][data-field-type]'));
  }

  function getPortalEnvFieldNodes() {
    return Array.from(document.querySelectorAll('[data-portal-env-field][data-field-type]'));
  }

  function buildFeatureFlagPatchFromUi(renderState) {
    const featureFlagsNode = document.getElementById('tdv4-editor-featureFlags');
    const draft = parseConfigJsonInput(featureFlagsNode?.value, 'Feature Flags', { emptyAsObject: true });
    const toggles = getFeatureFlagToggleNodes();
    if (!toggles.length) return draft;
    const baseFeatureSet = new Set(
      Array.isArray(renderState?.overview?.tenantFeatureAccess?.package?.features)
        ? renderState.overview.tenantFeatureAccess.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const nextPatch = {};
    const toggleKeys = new Set(toggles.map((node) => String(node.getAttribute('data-feature-flag-key') || '').trim()).filter(Boolean));
    Object.entries(draft || {}).forEach(([key, value]) => {
      if (!toggleKeys.has(key)) {
        nextPatch[key] = value;
      }
    });
    toggles.forEach((node) => {
      const key = String(node.getAttribute('data-feature-flag-key') || '').trim();
      if (!key) return;
      const packageEnabled = baseFeatureSet.has(key);
      const effectiveEnabled = Boolean(node.checked);
      if (effectiveEnabled !== packageEnabled) {
        nextPatch[key] = effectiveEnabled;
      }
    });
    return nextPatch;
  }

  function syncFeatureFlagsTextareaFromUi(renderState) {
    const featureFlagsNode = document.getElementById('tdv4-editor-featureFlags');
    if (!featureFlagsNode) return;
    const nextPatch = buildFeatureFlagPatchFromUi(renderState);
    featureFlagsNode.value = JSON.stringify(nextPatch, null, 2);
  }

  function syncFeatureFlagTogglesFromTextarea(renderState) {
    const featureFlagsNode = document.getElementById('tdv4-editor-featureFlags');
    const toggles = getFeatureFlagToggleNodes();
    if (!featureFlagsNode || !toggles.length) return;
    const draft = parseConfigJsonInput(featureFlagsNode.value, 'Feature Flags', { emptyAsObject: true });
    const baseFeatureSet = new Set(
      Array.isArray(renderState?.overview?.tenantFeatureAccess?.package?.features)
        ? renderState.overview.tenantFeatureAccess.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    toggles.forEach((node) => {
      const key = String(node.getAttribute('data-feature-flag-key') || '').trim();
      if (!key) return;
      const packageEnabled = baseFeatureSet.has(key);
      const overrideValue = Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : packageEnabled;
      node.checked = Boolean(overrideValue);
    });
  }

  function buildConfigPatchFromUi() {
    const configPatchNode = document.getElementById('tdv4-editor-configPatch');
    const draft = parseConfigJsonInput(configPatchNode?.value, 'Server settings changes', { emptyAsObject: true });
    const fields = getConfigPatchFieldNodes();
    if (!fields.length) return draft;
    const nextPatch = {};
    const controlledKeys = new Set(fields.map((node) => String(node.getAttribute('data-config-patch-field') || '').trim()).filter(Boolean));
    Object.entries(draft || {}).forEach(([key, value]) => {
      if (!controlledKeys.has(key)) {
        nextPatch[key] = value;
      }
    });
    fields.forEach((node) => {
      const key = String(node.getAttribute('data-config-patch-field') || '').trim();
      const type = String(node.getAttribute('data-field-type') || 'text').trim();
      const defaultValueRaw = String(node.getAttribute('data-default-value') || '').trim();
      if (!key) return;
      if (type === 'boolean') {
        const nextValue = Boolean(node.checked);
        const defaultValue = defaultValueRaw === 'true';
        if (nextValue !== defaultValue) {
          nextPatch[key] = nextValue;
        }
        return;
      }
      const rawValue = String(node.value || '').trim();
      if (!rawValue) return;
      if (type === 'number') {
        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric)) return;
        const normalized = Math.trunc(numeric);
        if (String(normalized) !== defaultValueRaw) {
          nextPatch[key] = normalized;
        }
        return;
      }
      if (rawValue !== defaultValueRaw) {
        nextPatch[key] = rawValue;
      }
    });
    return nextPatch;
  }

  function syncConfigPatchTextareaFromUi() {
    const configPatchNode = document.getElementById('tdv4-editor-configPatch');
    if (!configPatchNode) return;
    const nextPatch = buildConfigPatchFromUi();
    configPatchNode.value = JSON.stringify(nextPatch, null, 2);
  }

  function syncConfigPatchFieldsFromTextarea() {
    const configPatchNode = document.getElementById('tdv4-editor-configPatch');
    const fields = getConfigPatchFieldNodes();
    if (!configPatchNode || !fields.length) return;
    const draft = parseConfigJsonInput(configPatchNode.value, 'Server settings changes', { emptyAsObject: true });
    fields.forEach((node) => {
      const key = String(node.getAttribute('data-config-patch-field') || '').trim();
      const type = String(node.getAttribute('data-field-type') || 'text').trim();
      const defaultValueRaw = String(node.getAttribute('data-default-value') || '').trim();
      if (!key) return;
      const nextValue = Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : defaultValueRaw;
      if (type === 'boolean') {
        node.checked = nextValue === true || String(nextValue).trim().toLowerCase() === 'true';
        const hint = node.parentElement?.querySelector('.tdv4-basic-toggle-hint');
        if (hint) {
          hint.textContent = node.checked ? 'เปิด' : 'ปิด';
        }
        return;
      }
      if (type === 'number') {
        node.value = Number.isFinite(Number(nextValue)) ? String(Math.trunc(Number(nextValue))) : defaultValueRaw;
        return;
      }
      node.value = String(nextValue ?? '');
    });
  }

  function buildPortalEnvPatchFromUi() {
    const portalEnvPatchNode = document.getElementById('tdv4-editor-portalEnvPatch');
    const draft = parseConfigJsonInput(portalEnvPatchNode?.value, 'Portal settings', { emptyAsObject: true });
    const fields = getPortalEnvFieldNodes();
    if (!fields.length) return draft;
    const nextPatch = {};
    const controlledKeys = new Set(fields.map((node) => String(node.getAttribute('data-portal-env-field') || '').trim()).filter(Boolean));
    Object.entries(draft || {}).forEach(([key, value]) => {
      if (!controlledKeys.has(key)) {
        nextPatch[key] = value;
      }
    });
    fields.forEach((node) => {
      const key = String(node.getAttribute('data-portal-env-field') || '').trim();
      const type = String(node.getAttribute('data-field-type') || 'text').trim();
      const defaultValueRaw = String(node.getAttribute('data-default-value') || '').trim();
      if (!key) return;
      if (type === 'boolean') {
        const nextValue = Boolean(node.checked);
        const defaultValue = defaultValueRaw === 'true';
        if (nextValue !== defaultValue) {
          nextPatch[key] = nextValue;
        }
        return;
      }
      const rawValue = String(node.value || '').trim();
      if (!rawValue) return;
      if (type === 'number') {
        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric)) return;
        const normalized = Math.trunc(numeric);
        if (String(normalized) !== defaultValueRaw) {
          nextPatch[key] = normalized;
        }
        return;
      }
      if (rawValue !== defaultValueRaw) {
        nextPatch[key] = rawValue;
      }
    });
    return nextPatch;
  }

  function syncPortalEnvPatchTextareaFromUi() {
    const portalEnvPatchNode = document.getElementById('tdv4-editor-portalEnvPatch');
    if (!portalEnvPatchNode) return;
    const nextPatch = buildPortalEnvPatchFromUi();
    portalEnvPatchNode.value = JSON.stringify(nextPatch, null, 2);
  }

  function syncPortalEnvPatchFieldsFromTextarea() {
    const portalEnvPatchNode = document.getElementById('tdv4-editor-portalEnvPatch');
    const fields = getPortalEnvFieldNodes();
    if (!portalEnvPatchNode || !fields.length) return;
    const draft = parseConfigJsonInput(portalEnvPatchNode.value, 'Portal settings', { emptyAsObject: true });
    fields.forEach((node) => {
      const key = String(node.getAttribute('data-portal-env-field') || '').trim();
      const type = String(node.getAttribute('data-field-type') || 'text').trim();
      const defaultValueRaw = String(node.getAttribute('data-default-value') || '').trim();
      if (!key) return;
      const nextValue = Object.prototype.hasOwnProperty.call(draft, key) ? draft[key] : defaultValueRaw;
      if (type === 'boolean') {
        node.checked = nextValue === true || String(nextValue).trim().toLowerCase() === 'true';
        const hint = node.parentElement?.querySelector('.tdv4-basic-toggle-hint');
        if (hint) {
          hint.textContent = node.checked ? 'เปิด' : 'ปิด';
        }
        return;
      }
      if (type === 'number') {
        node.value = Number.isFinite(Number(nextValue)) ? String(Math.trunc(Number(nextValue))) : defaultValueRaw;
        return;
      }
      node.value = String(nextValue ?? '');
    });
  }

  async function saveTenantServerConfig(renderState, mode, triggerButton) {
    const scopedTenantId = String(renderState?.tenantConfig?.tenantId || renderState?.tenantId || renderState?.me?.tenantId || '').trim();
    if (!scopedTenantId) {
      throw new Error('ยังไม่พบ tenant ที่ใช้บันทึกค่า');
    }
    const draft = collectServerConfigDraft();
    const savingLabel = mode === 'restart'
      ? 'กำลังบันทึกและเปิด flow รีสตาร์ต...'
      : mode === 'apply'
        ? 'กำลังบันทึกและใช้ค่า...'
        : 'กำลังบันทึก...';
    setActionButtonBusy(triggerButton, true, savingLabel);
    await apiRequest('/admin/api/platform/tenant-config', {
      method: 'POST',
      body: {
        tenantId: scopedTenantId,
        updateScope: 'server-config',
        featureFlags: draft.featureFlags,
        configPatch: draft.configPatch,
        portalEnvPatch: draft.portalEnvPatch,
      },
    }, null);
    if (mode === 'restart') {
      setStatus('บันทึกค่าแล้ว กำลังพาไปหน้ารีสตาร์ต', 'warning');
      navigateTenantRoute('/tenant/server/restarts');
      await refreshState({ silent: false });
      return;
    }
    await refreshState({ silent: false });
    setStatus(
      mode === 'apply'
        ? 'บันทึกค่าและโหลดค่าล่าสุดเข้าพื้นที่ผู้เช่าแล้ว'
        : 'บันทึกค่าของผู้เช่าเรียบร้อยแล้ว',
      'success',
    );
  }

  function createRuntimeLocalId(prefix) {
    const safePrefix = String(prefix || 'runtime').trim() || 'runtime';
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${safePrefix}-${window.crypto.randomUUID()}`;
    }
    return `${safePrefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function getRenderTenantId(renderState) {
    return String(renderState?.tenantConfig?.tenantId || renderState?.tenantId || renderState?.me?.tenantId || '').trim();
  }

  function getRenderServerId(renderState) {
    return String(renderState?.activeServer?.id || renderState?.servers?.[0]?.id || '').trim();
  }

  async function queueServerConfigSave(renderState, applyMode, triggerButton) {
    const tenantId = getRenderTenantId(renderState);
    const serverId = getRenderServerId(renderState);
    if (!tenantId || !serverId) {
      throw new Error('ยังไม่พบเซิร์ฟเวอร์ที่ใช้บันทึกค่า');
    }

    const normalizedApplyMode = ['save_only', 'save_apply', 'save_restart'].includes(String(applyMode || '').trim())
      ? String(applyMode || '').trim()
      : 'save_only';
    const changedEntries = buildServerConfigChangesFromUi().filter((entry) => entry.changed);
    const requiresRestart = changedEntries.some((entry) => String(entry?.node?.getAttribute('data-setting-requires-restart') || '').trim() === 'true');
    const busyLabel = normalizedApplyMode === 'save_restart'
      ? 'กำลังบันทึกและรีสตาร์ต...'
      : normalizedApplyMode === 'save_apply'
        ? 'กำลังบันทึกและใช้ค่า...'
        : 'กำลังบันทึก...';

    setActionButtonBusy(triggerButton, true, busyLabel);
    try {
      if (!changedEntries.length) {
        if (normalizedApplyMode === 'save_only') {
          setStatus('ยังไม่มีค่าที่เปลี่ยนจากค่าปัจจุบัน', 'muted');
          return null;
        }
        const applyResult = await apiRequest(
          `/admin/api/platform/servers/${encodeURIComponent(serverId)}/config/apply`,
          {
            method: 'POST',
            body: {
              tenantId,
              applyMode: normalizedApplyMode,
            },
          },
          null,
        );
        await refreshState({ silent: true });
        setStatus(
          normalizedApplyMode === 'save_restart'
            ? 'ส่งคำขอ apply และ restart ไปยัง Server Bot แล้ว'
            : 'ส่งคำขอ apply ไปยัง Server Bot แล้ว',
          'success',
        );
        return applyResult;
      }

      const patchResult = await apiRequest(
        `/admin/api/platform/servers/${encodeURIComponent(serverId)}/config`,
        {
          method: 'PATCH',
          body: {
            tenantId,
            applyMode: normalizedApplyMode,
            changes: changedEntries.map((entry) => ({
              file: entry.file,
              section: entry.section,
              key: entry.key,
              value: entry.value,
            })),
          },
        },
        null,
      );
      await refreshState({ silent: true });
      setStatus(
        normalizedApplyMode === 'save_restart'
          ? 'บันทึกค่าแล้ว และส่งงานรีสตาร์ตไปยัง Server Bot แล้ว'
          : normalizedApplyMode === 'save_apply'
            ? 'บันทึกค่าแล้ว และส่งงาน apply ไปยัง Server Bot แล้ว'
            : requiresRestart
              ? 'บันทึกค่าแล้ว บางค่ายังต้องรีสตาร์ตจึงจะมีผล'
              : 'บันทึกค่าแล้ว',
        requiresRestart && normalizedApplyMode === 'save_only' ? 'warning' : 'success',
      );
      return patchResult;
    } finally {
      setActionButtonBusy(triggerButton, false);
    }
  }

  async function queueServerConfigRollback(renderState, backupId, triggerButton) {
    const tenantId = getRenderTenantId(renderState);
    const serverId = getRenderServerId(renderState);
    const normalizedBackupId = String(backupId || '').trim();
    if (!tenantId || !serverId || !normalizedBackupId) {
      throw new Error('ยังไม่พบข้อมูลสำรองที่ต้องการกู้คืน');
    }
    setActionButtonBusy(triggerButton, true, 'กำลังกู้คืน...');
    try {
      const result = await apiRequest(
        `/admin/api/platform/servers/${encodeURIComponent(serverId)}/config/rollback`,
        {
          method: 'POST',
          body: {
            tenantId,
            backupId: normalizedBackupId,
            applyMode: 'save_restart',
          },
        },
        null,
      );
      await refreshState({ silent: true });
      setStatus('ส่งคำขอกู้คืนและรีสตาร์ตไปยัง Server Bot แล้ว', 'success');
      return result;
    } finally {
      setActionButtonBusy(triggerButton, false);
    }
  }

  function buildRestartAnnouncementPlan(delaySeconds) {
    const normalizedDelay = Math.max(0, Math.trunc(Number(delaySeconds) || 0));
    return [300, 60, 30, 10]
      .filter((seconds) => seconds <= normalizedDelay)
      .map((seconds) => ({
        delaySeconds: seconds,
        message: `เซิร์ฟเวอร์จะรีสตาร์ตในอีก ${seconds} วินาที`,
      }));
  }

  async function queueServerRestart(renderState, triggerButton, options = {}) {
    const tenantId = getRenderTenantId(renderState);
    const serverId = getRenderServerId(renderState);
    const serverRow = resolveProvisioningServer(renderState, serverId);
    if (!tenantId || !serverId) {
      throw new Error('ยังไม่พบเซิร์ฟเวอร์ที่ใช้จัดการการรีสตาร์ต');
    }

    const restartMode = String(options.restartMode || triggerButton?.getAttribute('data-restart-mode') || 'safe_restart').trim();
    const delaySeconds = Math.max(0, Math.trunc(Number(options.delaySeconds ?? triggerButton?.getAttribute('data-restart-delay-seconds') ?? 0) || 0));
    const actionLabel = restartMode === 'immediate'
      ? 'กำลังสั่งรีสตาร์ตทันที...'
      : restartMode === 'safe_restart'
        ? 'กำลังสั่ง safe restart...'
        : 'กำลังตั้งเวลารีสตาร์ต...';
    const requestReason = String(options.reason || triggerButton?.getAttribute('data-restart-reason') || '').trim()
      || (restartMode === 'safe_restart'
        ? 'tenant-safe-restart'
        : restartMode === 'immediate'
          ? 'tenant-immediate-restart'
          : `tenant-delayed-restart-${delaySeconds}s`);

    setActionButtonBusy(triggerButton, true, actionLabel);
    try {
      const result = await apiRequest(
        `/admin/api/platform/servers/${encodeURIComponent(serverId)}/restart`,
        {
          method: 'POST',
          body: {
            tenantId,
            guildId: getServerGuildId(serverRow) || serverId,
            restartMode,
            controlMode: 'service',
            delaySeconds,
            reason: requestReason,
            announcementPlan: buildRestartAnnouncementPlan(delaySeconds),
            metadata: {
              source: 'tenant-web',
              surface: 'tenant-v4',
            },
          },
        },
        null,
      );
      await refreshState({ silent: true });
      setStatus(
        restartMode === 'immediate'
          ? 'ส่งคำสั่งรีสตาร์ตทันทีไปยังระบบแล้ว'
          : restartMode === 'safe_restart'
            ? 'ส่งคำขอ safe restart ไปยังระบบแล้ว'
            : `ตั้งเวลารีสตาร์ตอีก ${delaySeconds} วินาทีเรียบร้อยแล้ว`,
        restartMode === 'immediate' ? 'warning' : 'success',
      );
      return result;
    } finally {
      setActionButtonBusy(triggerButton, false);
    }
  }

  async function queueServerControlAction(renderState, triggerButton) {
    const tenantId = getRenderTenantId(renderState);
    const serverId = getRenderServerId(renderState);
    if (!tenantId || !serverId) {
      throw new Error('ยังไม่พบเซิร์ฟเวอร์ที่ใช้จัดการคำสั่งนี้');
    }
    const action = String(triggerButton?.getAttribute('data-server-control-action') || '').trim().toLowerCase();
    if (!['start', 'stop'].includes(action)) {
      throw new Error('ยังไม่รู้จักคำสั่งควบคุมเซิร์ฟเวอร์นี้');
    }
    setActionButtonBusy(
      triggerButton,
      true,
      action === 'start' ? 'กำลังสั่งเปิดเซิร์ฟเวอร์...' : 'กำลังสั่งปิดเซิร์ฟเวอร์...',
    );
    try {
      const result = await apiRequest(
        `/admin/api/platform/servers/${encodeURIComponent(serverId)}/control/${encodeURIComponent(action)}`,
        {
          method: 'POST',
          body: {
            tenantId,
          },
        },
        null,
      );
      await refreshState({ silent: true });
      setStatus(
        action === 'start'
          ? 'ส่งคำสั่งเปิดเซิร์ฟเวอร์ไปยัง Server Bot แล้ว'
          : 'ส่งคำสั่งปิดเซิร์ฟเวอร์ไปยัง Server Bot แล้ว',
        action === 'stop' ? 'warning' : 'success',
      );
      return result;
    } finally {
      setActionButtonBusy(triggerButton, false);
    }
  }

  function resolveProvisioningServer(renderState, serverId) {
    const rows = Array.isArray(renderState?.servers) ? renderState.servers : [];
    return rows.find((row) => String(row?.id || '').trim() === serverId) || null;
  }

  function getServerGuildId(serverRow) {
    return String(
      serverRow?.guildId
      || serverRow?.metadata?.guildId
      || serverRow?.meta?.guildId
      || '',
    ).trim();
  }

  function buildRuntimeProvisioningPayload(kind, renderState, serverId, displayName, runtimeKeyInput) {
    const tenantId = getRenderTenantId(renderState);
    const serverRow = resolveProvisioningServer(renderState, serverId);
    if (!tenantId) {
      throw new Error('ยังไม่พบ tenant สำหรับออก token');
    }
    if (!serverRow) {
      throw new Error('เลือกเซิร์ฟเวอร์ก่อนสร้างบอท');
    }

    const runtimeKey = slugifyRuntimeKey(
      runtimeKeyInput || displayName || `${kind}-${serverId}`,
      kind === 'server-bots' ? 'server-bot' : 'delivery-agent',
    );
    const isServerBot = kind === 'server-bots';

    return {
      id: createRuntimeLocalId(isServerBot ? 'srvprov' : 'dlvprov'),
      tokenId: createRuntimeLocalId('setuptoken'),
      tenantId,
      serverId: String(serverRow.id || '').trim(),
      guildId: getServerGuildId(serverRow) || String(serverRow.id || '').trim(),
      agentId: createRuntimeLocalId(isServerBot ? 'srvbot' : 'dagent'),
      runtimeKey,
      role: isServerBot ? 'sync' : 'execute',
      scope: isServerBot ? 'sync_only' : 'execute_only',
      name: displayName,
      displayName,
      minimumVersion: '0.0.0',
      expiresAt: new Date(Date.now() + (72 * 60 * 60 * 1000)).toISOString(),
      metadata: {
        kind,
        source: 'tenant-web',
        surface: 'tenant-v4',
      },
    };
  }

  async function queueRuntimeProvisioning(kind, renderState, triggerButton, overrides = {}) {
    const serverNode = document.querySelector(`[data-runtime-server-id="${kind}"]`);
    const displayNode = document.querySelector(`[data-runtime-display-name="${kind}"]`);
    const runtimeKeyNode = document.querySelector(`[data-runtime-runtime-key="${kind}"]`);
    const serverId = String(overrides.serverId || serverNode?.value || '').trim();
    const displayName = String(overrides.displayName || displayNode?.value || '').trim() || (kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent');
    const runtimeKey = String(overrides.runtimeKey || runtimeKeyNode?.value || '').trim();
    const payload = buildRuntimeProvisioningPayload(kind, renderState, serverId, displayName, runtimeKey);

    setActionButtonBusy(
      triggerButton,
      true,
      kind === 'server-bots' ? 'กำลังสร้าง Server Bot...' : 'กำลังสร้าง Delivery Agent...',
    );
    try {
      const result = await apiRequest(
        '/admin/api/platform/agent-provision',
        {
          method: 'POST',
          body: payload,
        },
        null,
      );
      state.provisioningResult[kind] = {
        ...result,
        instructions: buildProvisioningInstructions(kind, result),
      };
      renderCurrentPage();
      await refreshState({ silent: true });
      setStatus(
        kind === 'server-bots'
          ? 'สร้าง Server Bot และออก setup token เรียบร้อยแล้ว'
          : 'สร้าง Delivery Agent และออก setup token เรียบร้อยแล้ว',
        'success',
      );
      return result;
    } finally {
      setActionButtonBusy(triggerButton, false);
    }
  }

  function buildRuntimeCredentialInstructions(kind, payload) {
    const rawKey = String(payload?.rawKey || '').trim();
    if (!rawKey) return null;
    const runtimeLabel = kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent';
    const startCommand = kind === 'server-bots'
      ? 'node C:\\new\\apps\\server-bot\\server.js'
      : 'node C:\\new\\apps\\agent\\server.js';
    return {
      title: `คีย์ใหม่ของ ${runtimeLabel} พร้อมแล้ว`,
      detail: `นำคีย์นี้ไปแทนค่า PLATFORM_AGENT_TOKEN บนเครื่องเดิม แล้วเริ่มบริการใหม่อีกครั้ง`,
      command: [
        buildPowerShellEnvLine('PLATFORM_AGENT_TOKEN', rawKey),
        startCommand,
      ].join('\n'),
      tone: 'success',
      steps: [
        'คัดลอกคีย์ใหม่ไปแทนค่า PLATFORM_AGENT_TOKEN บนเครื่องเดิม',
        'เริ่มบอทนี้ใหม่อีกครั้ง',
        'ตรวจสอบว่าหน้า Tenant กลับมาเห็น heartbeat ล่าสุดจากเครื่องเดิม',
      ],
    };
  }

  function buildRuntimeActionNotice(title, detail, tone = 'info') {
    return {
      title,
      detail,
      tone,
      command: '',
    };
  }

  async function queueRuntimeManagementAction(kind, renderState, triggerButton) {
    const tenantId = getRenderTenantId(renderState);
    if (!tenantId) {
      throw new Error('ยังไม่พบ tenant ที่ใช้จัดการเครื่องนี้');
    }
    const action = String(triggerButton?.getAttribute('data-runtime-action') || '').trim();
    const runtimeName = String(triggerButton?.getAttribute('data-runtime-name') || '').trim() || (kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent');

    if (action === 'reissue-provision') {
      return queueRuntimeProvisioning(
        kind,
        renderState,
        triggerButton,
        {
          serverId: String(triggerButton?.getAttribute('data-runtime-server-id-value') || '').trim(),
          displayName: String(triggerButton?.getAttribute('data-runtime-display-name-value') || '').trim() || runtimeName,
          runtimeKey: String(triggerButton?.getAttribute('data-runtime-runtime-key-value') || '').trim(),
        },
      );
    }

    if (action === 'revoke-provision') {
      const tokenId = String(triggerButton?.getAttribute('data-runtime-token-id') || '').trim();
      if (!tokenId) {
        throw new Error('ยังไม่พบโทเค็นที่ต้องการยกเลิก');
      }
      setActionButtonBusy(triggerButton, true, 'กำลังยกเลิกโทเค็น...');
      try {
        const result = await apiRequest('/admin/api/platform/agent-provision/revoke', {
          method: 'POST',
          body: {
            tenantId,
            runtimeKind: kind,
            tokenId,
            revokeReason: 'tenant-ui-manual-revoke',
          },
        }, null);
        state.provisioningResult[kind] = {
          instructions: buildRuntimeActionNotice(
            `ยกเลิกโทเค็นของ ${runtimeName} แล้ว`,
            'โทเค็นนี้จะใช้ติดตั้งหรือ activate ไม่ได้อีก',
            'warning',
          ),
          raw: result,
        };
        await refreshState({ silent: true });
        setStatus(`ยกเลิกโทเค็นของ ${runtimeName} เรียบร้อยแล้ว`, 'success');
        return result;
      } finally {
        setActionButtonBusy(triggerButton, false);
      }
    }

    if (action === 'revoke-device') {
      const deviceId = String(triggerButton?.getAttribute('data-runtime-device-id') || '').trim();
      if (!deviceId) {
        throw new Error('ยังไม่พบเครื่องที่ต้องการรีเซ็ตการผูก');
      }
      setActionButtonBusy(triggerButton, true, 'กำลังรีเซ็ตการผูกเครื่อง...');
      try {
        const result = await apiRequest('/admin/api/platform/agent-device/revoke', {
          method: 'POST',
          body: {
            tenantId,
            runtimeKind: kind,
            deviceId,
            revokeReason: 'tenant-ui-reset-binding',
          },
        }, null);
        state.provisioningResult[kind] = {
          instructions: buildRuntimeActionNotice(
            `รีเซ็ตการผูกเครื่องของ ${runtimeName} แล้ว`,
            'เครื่องเดิมจะเชื่อมต่อไม่ได้จนกว่าจะออกโทเค็นใหม่และติดตั้งอีกครั้ง',
            'warning',
          ),
          raw: result,
        };
        await refreshState({ silent: true });
        setStatus(`รีเซ็ตการผูกเครื่องของ ${runtimeName} แล้ว`, 'success');
        return result;
      } finally {
        setActionButtonBusy(triggerButton, false);
      }
    }

    if (action === 'revoke-runtime') {
      const deviceId = String(triggerButton?.getAttribute('data-runtime-device-id') || '').trim();
      const apiKeyId = String(triggerButton?.getAttribute('data-runtime-api-key-id') || '').trim();
      if (!deviceId && !apiKeyId) {
        throw new Error('ยังไม่พบข้อมูล runtime ที่ต้องการยกเลิก');
      }
      setActionButtonBusy(triggerButton, true, 'กำลังยกเลิก runtime...');
      try {
        const result = await apiRequest('/admin/api/platform/agent-runtime/revoke', {
          method: 'POST',
          body: {
            tenantId,
            runtimeKind: kind,
            deviceId,
            apiKeyId,
            revokeReason: 'tenant-ui-runtime-revoke',
          },
        }, null);
        state.provisioningResult[kind] = {
          instructions: buildRuntimeActionNotice(
            `ยกเลิก ${runtimeName} แล้ว`,
            'เครื่องและคีย์ของ runtime นี้จะถูกเพิกถอน หากต้องการใช้งานอีกครั้งให้สร้าง setup token ใหม่และติดตั้งใหม่บนเครื่องที่ต้องการ',
            'warning',
          ),
          raw: result,
        };
        await refreshState({ silent: true });
        setStatus(`ยกเลิก ${runtimeName} เรียบร้อยแล้ว`, 'success');
        return result;
      } finally {
        setActionButtonBusy(triggerButton, false);
      }
    }

    if (action === 'revoke-token') {
      const apiKeyId = String(triggerButton?.getAttribute('data-runtime-api-key-id') || '').trim();
      if (!apiKeyId) {
        throw new Error('ยังไม่พบคีย์ที่ต้องการเพิกถอน');
      }
      setActionButtonBusy(triggerButton, true, 'กำลังเพิกถอนคีย์...');
      try {
        const result = await apiRequest('/admin/api/platform/agent-token/revoke', {
          method: 'POST',
          body: {
            tenantId,
            runtimeKind: kind,
            apiKeyId,
          },
        }, null);
        state.provisioningResult[kind] = {
          instructions: buildRuntimeActionNotice(
            `เพิกถอนคีย์ของ ${runtimeName} แล้ว`,
            'ถ้าต้องการให้เครื่องเดิมเชื่อมต่ออีกครั้ง ให้กดออกคีย์ใหม่หรือสร้างโทเค็นติดตั้งใหม่',
            'warning',
          ),
          raw: result,
        };
        await refreshState({ silent: true });
        setStatus(`เพิกถอนคีย์ของ ${runtimeName} แล้ว`, 'success');
        return result;
      } finally {
        setActionButtonBusy(triggerButton, false);
      }
    }

    if (action === 'rotate-token') {
      const apiKeyId = String(triggerButton?.getAttribute('data-runtime-api-key-id') || '').trim();
      if (!apiKeyId) {
        throw new Error('ยังไม่พบคีย์ที่ต้องการออกใหม่');
      }
      setActionButtonBusy(triggerButton, true, 'กำลังออกคีย์ใหม่...');
      try {
        const result = await apiRequest('/admin/api/platform/agent-token/rotate', {
          method: 'POST',
          body: {
            tenantId,
            runtimeKind: kind,
            apiKeyId,
            name: runtimeName,
          },
        }, null);
        state.provisioningResult[kind] = {
          instructions: buildRuntimeCredentialInstructions(kind, result?.data || result) || buildRuntimeActionNotice(
            `ออกคีย์ใหม่ของ ${runtimeName} แล้ว`,
            'คัดลอกคีย์ใหม่ไปใส่บนเครื่องเดิมแล้วเริ่มบริการใหม่อีกครั้ง',
            'success',
          ),
          raw: result,
        };
        await refreshState({ silent: true });
        setStatus(`ออกคีย์ใหม่ของ ${runtimeName} แล้ว`, 'success');
        return result;
      } finally {
        setActionButtonBusy(triggerButton, false);
      }
    }

    throw new Error('ยังไม่รู้จักคำสั่งจัดการรายการนี้');
  }

  function wireServerConfigPage(renderState, surfaceState) {
    const overrideButtons = Array.from(document.querySelectorAll('[data-config-action]'));
    const saveButtons = Array.from(document.querySelectorAll('[data-server-config-save-mode]'));
    const rollbackButtons = Array.from(document.querySelectorAll('[data-server-config-rollback]'));
    const categoryTabs = Array.from(document.querySelectorAll('[data-config-category-tab]'));
    const fieldNodes = getServerConfigFieldNodes();
    const previewMode = Boolean(surfaceState?.featureAccess?.previewMode);
    const editConfigLocked = Boolean(getTenantActionEntitlement(renderState, 'can_edit_config')?.locked);
    const restartConfigLocked = Boolean(getTenantActionEntitlement(renderState, 'can_restart_server')?.locked);
    const editConfigLockReason = getTenantActionLockReason(
      renderState,
      'can_edit_config',
      'Config save actions are locked in the current package.',
    );
    const restartConfigLockReason = getTenantActionLockReason(
      renderState,
      'can_restart_server',
      'Restart-required config actions are locked in the current package.',
    );
    const featureFlagsNode = document.getElementById('tdv4-editor-featureFlags');
    const configPatchNode = document.getElementById('tdv4-editor-configPatch');
    const portalEnvPatchNode = document.getElementById('tdv4-editor-portalEnvPatch');
    const modeButtons = Array.from(document.querySelectorAll('[data-config-mode-tab]'));
    const modeSections = Array.from(document.querySelectorAll('[data-config-mode-section]'));
    const scopeButtons = Array.from(document.querySelectorAll('[data-config-scope-tab]'));
    const filterButtons = Array.from(document.querySelectorAll('[data-config-filter-tab]'));
    const searchInput = document.querySelector('[data-config-search-input]');
    const clearSearchButton = document.querySelector('[data-config-search-clear]');
    const filterSummaryNode = document.querySelector('[data-config-filter-summary]');
    const resultsEmptyNode = document.querySelector('[data-config-results-empty]');
    const configUiState = {
      scope: 'basic',
      filter: 'all',
      search: '',
    };

    if (!overrideButtons.length && !saveButtons.length && !fieldNodes.length) return;

    function setServerConfigMode(mode) {
      const nextMode = String(mode || '').trim().toLowerCase() === 'advanced' ? 'advanced' : 'basic';
      modeButtons.forEach((button) => {
        const current = String(button.getAttribute('data-config-mode-tab') || '').trim() === nextMode;
        button.classList.toggle('is-current', current);
        button.setAttribute('aria-pressed', current ? 'true' : 'false');
      });

      document.querySelectorAll('[data-config-category-mode]').forEach((node) => {
        const nodeMode = String(node.getAttribute('data-config-category-mode') || 'basic').trim().toLowerCase();
        if (nodeMode === 'advanced') {
          node.hidden = nextMode !== 'advanced';
          if (nextMode !== 'advanced' && node.classList.contains('is-current')) {
            node.classList.remove('is-current');
            node.setAttribute('aria-pressed', 'false');
          }
          if (nextMode !== 'advanced' && node.classList.contains('tdv4-config-category-panel-current')) {
            node.classList.remove('tdv4-config-category-panel-current');
          }
        }
      });

      modeSections.forEach((node) => {
        const sectionMode = String(node.getAttribute('data-config-mode-section') || 'basic').trim().toLowerCase();
        node.hidden = sectionMode === 'advanced' ? nextMode !== 'advanced' : false;
      });

      const currentVisibleTab = categoryTabs.find((tab) => tab.classList.contains('is-current') && !tab.hidden);
      if (!currentVisibleTab) {
        const firstVisibleTab = categoryTabs.find((tab) => !tab.hidden);
        const fallbackCategory = String(firstVisibleTab?.getAttribute('data-config-category-tab') || '').trim();
        if (fallbackCategory) {
          switchServerConfigCategory(fallbackCategory);
        }
      }
      window.__tenantServerConfigApplyFilters?.();
    }

    function applyServerConfigWorkspaceFilters() {
      const query = normalizeServerConfigSearchQuery(configUiState.search);
      const workspaceTabs = categoryTabs.filter((tab) => String(tab.getAttribute('data-config-category-mode') || 'basic').trim().toLowerCase() !== 'advanced');
      const workspacePanels = Array.from(document.querySelectorAll('[data-config-category-panel]'))
        .filter((panel) => String(panel.getAttribute('data-config-category-mode') || 'basic').trim().toLowerCase() !== 'advanced');
      const scopeTotal = workspaceTabs.reduce((sum, tab) => {
        const count = configUiState.scope === 'all'
          ? Number(tab.getAttribute('data-config-category-total') || 0)
          : Number(tab.getAttribute('data-config-category-basic') || 0);
        return sum + (Number.isFinite(count) ? count : 0);
      }, 0);
      let visibleSettingCount = 0;

      scopeButtons.forEach((button) => {
        const current = String(button.getAttribute('data-config-scope-tab') || '').trim() === configUiState.scope;
        button.classList.toggle('is-current', current);
        button.setAttribute('aria-pressed', current ? 'true' : 'false');
      });
      filterButtons.forEach((button) => {
        const current = String(button.getAttribute('data-config-filter-tab') || '').trim() === configUiState.filter;
        button.classList.toggle('is-current', current);
        button.setAttribute('aria-pressed', current ? 'true' : 'false');
      });
      if (clearSearchButton) {
        clearSearchButton.disabled = !query;
      }

      workspacePanels.forEach((panel) => {
        const groups = Array.from(panel.querySelectorAll('[data-config-group]'));
        let panelVisibleCount = 0;
        groups.forEach((group) => {
          const cards = countServerConfigCards(group);
          let groupVisibleCount = 0;
          cards.forEach((card) => {
            const isBasic = String(card.getAttribute('data-setting-basic') || 'true').trim() !== 'false';
            const requiresRestart = String(card.getAttribute('data-setting-requires-restart') || '').trim() === 'true';
            const searchText = String(card.getAttribute('data-setting-search') || '').trim().toLowerCase();
            const matchesScope = configUiState.scope === 'all' || isBasic;
            const matchesFilter = configUiState.filter === 'dirty'
              ? card.classList.contains('is-dirty')
              : configUiState.filter === 'restart'
                ? requiresRestart
                : true;
            const matchesSearch = !query || searchText.includes(query);
            const visible = matchesScope && matchesFilter && matchesSearch;
            card.hidden = !visible;
            if (visible) {
              groupVisibleCount += 1;
            }
          });
          group.hidden = groupVisibleCount === 0;
          panelVisibleCount += groupVisibleCount;
          const groupCountNode = group.querySelector('[data-config-group-count]');
          const groupScopeTotal = configUiState.scope === 'all'
            ? Number(group.getAttribute('data-group-total-count') || cards.length)
            : Number(group.getAttribute('data-group-basic-count') || cards.length);
          if (groupCountNode) {
            groupCountNode.textContent = formatServerConfigCountLabel(groupVisibleCount, groupScopeTotal);
          }
        });

        visibleSettingCount += panelVisibleCount;
        const emptyNode = panel.querySelector('[data-config-category-empty]');
        if (emptyNode) {
          emptyNode.hidden = panelVisibleCount > 0;
        }
        panel.setAttribute('data-visible-setting-count', String(panelVisibleCount));

        const categoryKey = String(panel.getAttribute('data-config-category-panel') || '').trim();
        const tab = workspaceTabs.find((node) => String(node.getAttribute('data-config-category-tab') || '').trim() === categoryKey);
        if (tab) {
          const metaNode = tab.querySelector('[data-config-category-meta]');
          const categoryScopeTotal = configUiState.scope === 'all'
            ? Number(tab.getAttribute('data-config-category-total') || panelVisibleCount)
            : Number(tab.getAttribute('data-config-category-basic') || panelVisibleCount);
          tab.hidden = false;
          tab.classList.toggle('is-empty', panelVisibleCount === 0);
          tab.setAttribute('data-config-category-visible-count', String(panelVisibleCount));
          if (metaNode) {
            metaNode.textContent = formatServerConfigCountLabel(panelVisibleCount, categoryScopeTotal);
          }
        }
      });

      if (filterSummaryNode) {
        const fragments = [`กำลังดู${configUiState.scope === 'all' ? 'ค่าจริงทั้งหมด' : 'ค่าพื้นฐาน'} ${visibleSettingCount} จาก ${scopeTotal} ค่า`];
        if (configUiState.filter === 'dirty') {
          fragments.push('เฉพาะที่แก้ค้าง');
        } else if (configUiState.filter === 'restart') {
          fragments.push('เฉพาะค่าที่ต้องรีสตาร์ต');
        }
        if (query) {
          fragments.push(`ค้นหา "${String(searchInput?.value || '').trim()}"`);
        }
        filterSummaryNode.textContent = fragments.join(' · ');
      }

      if (resultsEmptyNode) {
        resultsEmptyNode.hidden = visibleSettingCount > 0;
      }
      const currentVisibleTab = workspaceTabs.find((tab) => tab.classList.contains('is-current')) || workspaceTabs[0];
      const currentCategory = String(currentVisibleTab?.getAttribute('data-config-category-tab') || '').trim();
      if (currentCategory) {
        switchServerConfigCategory(currentCategory);
      }
    }

    getFeatureFlagToggleNodes().forEach((node) => {
      if (previewMode || editConfigLocked) {
        node.disabled = true;
      }
      node.addEventListener('change', () => {
        syncFeatureFlagsTextareaFromUi(renderState);
        setStatus('มีการแก้ไขที่ยังไม่บันทึก', 'warning');
      });
    });
    getConfigPatchFieldNodes().forEach((node) => {
      if (previewMode || editConfigLocked) {
        node.disabled = true;
      }
      const eventName = String(node.getAttribute('data-field-type') || '') === 'boolean' ? 'change' : 'input';
      node.addEventListener(eventName, () => {
        syncConfigPatchTextareaFromUi();
        if (String(node.getAttribute('data-field-type') || '') === 'boolean') {
          const hint = node.parentElement?.querySelector('.tdv4-basic-toggle-hint');
          if (hint) {
            hint.textContent = node.checked ? 'เปิด' : 'ปิด';
          }
        }
        setStatus('มีการแก้ไขที่ยังไม่บันทึก', 'warning');
      });
    });
    getPortalEnvFieldNodes().forEach((node) => {
      if (previewMode || editConfigLocked) {
        node.disabled = true;
      }
      const eventName = String(node.getAttribute('data-field-type') || '') === 'boolean' ? 'change' : 'input';
      node.addEventListener(eventName, () => {
        syncPortalEnvPatchTextareaFromUi();
        if (String(node.getAttribute('data-field-type') || '') === 'boolean') {
          const hint = node.parentElement?.querySelector('.tdv4-basic-toggle-hint');
          if (hint) {
            hint.textContent = node.checked ? 'เปิด' : 'ปิด';
          }
        }
        setStatus('มีการแก้ไขที่ยังไม่บันทึก', 'warning');
      });
    });

    categoryTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const categoryKey = String(tab.getAttribute('data-config-category-tab') || '').trim();
        if (!categoryKey) return;
        switchServerConfigCategory(categoryKey);
      });
    });

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setServerConfigMode(button.getAttribute('data-config-mode-tab'));
      });
    });
    scopeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextScope = String(button.getAttribute('data-config-scope-tab') || '').trim();
        configUiState.scope = nextScope === 'all' ? 'all' : 'basic';
        applyServerConfigWorkspaceFilters();
      });
    });
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextFilter = String(button.getAttribute('data-config-filter-tab') || '').trim();
        configUiState.filter = ['dirty', 'restart'].includes(nextFilter) ? nextFilter : 'all';
        applyServerConfigWorkspaceFilters();
      });
    });
    searchInput?.addEventListener('input', () => {
      configUiState.search = String(searchInput.value || '');
      applyServerConfigWorkspaceFilters();
    });
    clearSearchButton?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
      }
      configUiState.search = '';
      applyServerConfigWorkspaceFilters();
      searchInput?.focus();
    });

    fieldNodes.forEach((node) => {
      if (previewMode || editConfigLocked) {
        node.disabled = true;
      }
      const settingType = String(node.getAttribute('data-setting-type') || '').trim().toLowerCase();
      if (settingType === 'line-list') {
        wireLineListField(node, previewMode);
        updateServerConfigFieldState(node);
        return;
      }
      node.addEventListener('focus', () => {
        updateServerConfigHelpFromField(node);
      });
      const eventName = settingType === 'boolean' ? 'change' : 'input';
      node.addEventListener(eventName, () => {
        updateServerConfigFieldState(node);
        updateServerConfigHelpFromField(node);
        updateServerConfigSavebar();
        applyServerConfigWorkspaceFilters();
        setStatus('มีการแก้ไขค่าจริงที่ยังไม่บันทึก', 'warning');
      });
      updateServerConfigFieldState(node);
    });

    featureFlagsNode?.addEventListener('input', () => {
      try {
        syncFeatureFlagTogglesFromTextarea(renderState);
      } catch {
        // Keep existing toggle state while the operator is typing invalid JSON.
      }
    });
    configPatchNode?.addEventListener('input', () => {
      try {
        syncConfigPatchFieldsFromTextarea();
      } catch {
        // Keep existing basic field state while the operator is typing invalid JSON.
      }
    });
    portalEnvPatchNode?.addEventListener('input', () => {
      try {
        syncPortalEnvPatchFieldsFromTextarea();
      } catch {
        // Keep existing basic field state while the operator is typing invalid JSON.
      }
    });

    overrideButtons.forEach((button) => {
      const action = String(button.getAttribute('data-config-action') || '').trim();
      if (previewMode || editConfigLocked) {
        button.disabled = true;
        button.title = previewMode ? 'Preview mode cannot save tenant settings yet.' : editConfigLockReason;
        return;
      }
      button.addEventListener('click', async () => {
        try {
          const confirmMessage = action === 'restart'
            ? 'บันทึกค่าชุดนี้แล้วเปิดหน้ารีสตาร์ตต่อเลยหรือไม่'
            : action === 'apply'
              ? 'บันทึกค่าและโหลดค่าล่าสุดเข้าระบบตอนนี้หรือไม่'
              : 'บันทึกค่าของ tenant นี้ตอนนี้หรือไม่';
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await saveTenantServerConfig(renderState, action || 'save', button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
          setActionButtonBusy(button, false);
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });

    saveButtons.forEach((button) => {
      const applyMode = String(button.getAttribute('data-server-config-save-mode') || '').trim();
      if (previewMode || editConfigLocked || (applyMode === 'save_restart' && restartConfigLocked)) {
        button.disabled = true;
        button.title = previewMode
          ? 'Preview mode cannot save Server Config changes.'
          : editConfigLocked
            ? editConfigLockReason
            : restartConfigLockReason;
        return;
      }
      button.addEventListener('click', async () => {
        try {
          const changedEntries = buildServerConfigChangesFromUi().filter((entry) => entry.changed);
          const requiresRestart = changedEntries.some((entry) => String(entry?.node?.getAttribute('data-setting-requires-restart') || '').trim() === 'true');
          const confirmMessage = changedEntries.length
            ? applyMode === 'save_restart'
              ? 'บันทึกค่าชุดนี้และรีสตาร์ตเซิร์ฟเวอร์ต่อเลยหรือไม่'
              : applyMode === 'save_apply'
                ? 'บันทึกค่าชุดนี้และส่งงาน apply ไปยัง Server Bot ตอนนี้หรือไม่'
                : requiresRestart
                  ? 'บันทึกค่าชุดนี้หรือไม่ บางค่ายังต้องรีสตาร์ตจึงจะมีผล'
                  : 'บันทึกค่าชุดนี้ตอนนี้หรือไม่'
            : applyMode === 'save_restart'
              ? 'ยังไม่มีค่าที่เปลี่ยน แต่ต้องการสั่ง apply และรีสตาร์ตเลยหรือไม่'
              : 'ยังไม่มีค่าที่เปลี่ยน ต้องการสั่ง apply ค่าปัจจุบันเลยหรือไม่';
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueServerConfigSave(renderState, applyMode, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });

    rollbackButtons.forEach((button) => {
      const backupId = String(button.getAttribute('data-server-config-rollback') || '').trim();
      if (previewMode || editConfigLocked || restartConfigLocked || !backupId) {
        if (previewMode || editConfigLocked || restartConfigLocked) {
          button.disabled = true;
          button.title = previewMode
            ? 'Preview mode cannot roll back live config.'
            : editConfigLocked
              ? editConfigLockReason
              : restartConfigLockReason;
        }
        return;
      }
      button.addEventListener('click', async () => {
        try {
          if (!window.confirm('กู้คืนจาก backup นี้และสั่งรีสตาร์ตเซิร์ฟเวอร์เลยหรือไม่')) {
            return;
          }
          await queueServerConfigRollback(renderState, backupId, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });

    document.querySelectorAll('.tdv4-editor').forEach((node) => {
      node.addEventListener('input', () => {
        setStatus('มีการแก้ไขที่ยังไม่บันทึก', 'warning');
      });
    });
    syncConfigPatchFieldsFromTextarea();
    syncPortalEnvPatchFieldsFromTextarea();
    updateServerConfigSavebar();
    window.__tenantServerConfigApplyFilters = applyServerConfigWorkspaceFilters;
    setServerConfigMode('basic');
    applyServerConfigWorkspaceFilters();
    if (categoryTabs.length) {
      const currentTab = categoryTabs.find((tab) => tab.classList.contains('is-current') && !tab.hidden)
        || categoryTabs.find((tab) => !tab.hidden)
        || categoryTabs[0];
      const currentCategory = String(currentTab?.getAttribute('data-config-category-tab') || '').trim();
      if (currentCategory) {
        switchServerConfigCategory(currentCategory);
      }
    } else if (fieldNodes.length) {
      updateServerConfigHelpFromField(fieldNodes[0]);
    }
  }

  function wireRuntimeProvisioningPage(kind, renderState, surfaceState) {
    const button = document.querySelector(`[data-runtime-provision-button="${kind}"]`);
    const managementButtons = Array.from(document.querySelectorAll(`[data-runtime-action-kind="${kind}"][data-runtime-action]`));
    const downloadButtons = Array.from(document.querySelectorAll(`[data-runtime-download-kind="${kind}"][data-runtime-download-key]`));
    if (!button && !managementButtons.length && !downloadButtons.length) return;
    downloadButtons.forEach((node) => {
      node.addEventListener('click', async () => {
        try {
          const downloadKey = String(node.getAttribute('data-runtime-download-key') || '').trim();
          const downloads = Array.isArray(state.provisioningResult[kind]?.instructions?.downloads)
            ? state.provisioningResult[kind].instructions.downloads
            : [];
          const match = downloads.find((entry) => String(entry?.key || '').trim() === downloadKey);
          if (!match?.content || !match?.filename) {
            setStatus('ยังไม่พบไฟล์ติดตั้งล่าสุดสำหรับรายการนี้', 'warning');
            return;
          }
          await requestServerDownload(match.filename, match.content, match.mimeType);
          setStatus(`ดาวน์โหลด ${match.filename} แล้ว`, 'success');
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });
    const previewMode = Boolean(surfaceState?.featureAccess?.previewMode);
    const actionKey = kind === 'server-bots' ? 'can_create_server_bot' : 'can_create_delivery_agent';
    const lockReason = getTenantActionLockReason(
      renderState,
      actionKey,
      kind === 'server-bots'
        ? 'Server Bot actions are locked in the current package.'
        : 'Delivery Agent actions are locked in the current package.',
    );
    if (previewMode || getTenantActionEntitlement(renderState, actionKey)?.locked) {
      if (button) {
        button.disabled = true;
        button.title = previewMode ? 'Preview mode cannot create bots yet.' : lockReason;
      }
      managementButtons.forEach((node) => {
        node.disabled = true;
        node.title = previewMode ? 'Preview mode cannot manage bots yet.' : lockReason;
      });
      return;
    }
    if (button) {
      button.addEventListener('click', async () => {
        try {
          const confirmMessage = kind === 'server-bots'
            ? 'สร้าง Server Bot ใหม่สำหรับเซิร์ฟเวอร์นี้หรือไม่'
            : 'สร้าง Delivery Agent ใหม่สำหรับเซิร์ฟเวอร์นี้หรือไม่';
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueRuntimeProvisioning(kind, renderState, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    }
    managementButtons.forEach((node) => {
      node.addEventListener('click', async () => {
        try {
          const action = String(node.getAttribute('data-runtime-action') || '').trim();
          const runtimeName = String(node.getAttribute('data-runtime-name') || '').trim() || (kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent');
          const confirmMessage = action === 'revoke-provision'
            ? `ยกเลิกโทเค็นของ ${runtimeName} ใช่หรือไม่`
            : action === 'revoke-device'
              ? `รีเซ็ตการผูกเครื่องของ ${runtimeName} ใช่หรือไม่`
              : action === 'revoke-runtime'
                ? `ยกเลิก ${runtimeName} ทั้งเครื่องและคีย์ที่ผูกอยู่ ใช่หรือไม่`
              : action === 'revoke-token'
                ? `เพิกถอนคีย์ของ ${runtimeName} ใช่หรือไม่`
                : action === 'rotate-token'
                  ? `ออกคีย์ใหม่ของ ${runtimeName} ใช่หรือไม่`
                  : kind === 'server-bots'
                    ? `ออกโทเค็นใหม่ของ Server Bot ตัวนี้ใช่หรือไม่`
                    : `ออกโทเค็นใหม่ของ Delivery Agent ตัวนี้ใช่หรือไม่`;
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueRuntimeManagementAction(kind, renderState, node);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });
  }

  function hasActiveServerBot(renderState) {
    const activeServerId = getRenderServerId(renderState);
    const agentRows = Array.isArray(renderState?.agents) ? renderState.agents : [];
    return agentRows.some((row) => {
      const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
      const role = String(meta.agentRole || meta.role || row.role || '').trim().toLowerCase();
      const scope = String(meta.agentScope || meta.scope || row.scope || '').trim().toLowerCase();
      const serverId = String(meta.serverId || row.serverId || row.tenantServerId || '').trim();
      if (activeServerId && serverId && serverId !== activeServerId) return false;
      return role === 'sync' || ['sync_only', 'sync-only'].includes(scope);
    });
  }

  function getServerBotProbeLockReason(renderState, action) {
    if (action === 'sync') {
      return getTenantActionLockReason(
        renderState,
        'can_view_sync_status',
        'Sync checks are not available in the current package.',
      );
    }
    if (action === 'config-access') {
      return getTenantActionLockReason(
        renderState,
        'can_edit_config',
        'Config access checks are not available in the current package.',
      );
    }
    return getTenantActionLockReason(
      renderState,
      'can_restart_server',
      'Restart checks are not available in the current package.',
    );
  }

  async function queueServerBotProbe(renderState, triggerButton) {
    const tenantId = getRenderTenantId(renderState);
    const serverId = getRenderServerId(renderState);
    if (!tenantId || !serverId) {
      throw new Error('ยังไม่พบเซิร์ฟเวอร์ที่ใช้ตรวจสอบ Server Bot');
    }
    const action = String(triggerButton?.getAttribute('data-server-bot-probe-action') || '').trim().toLowerCase();
    if (!['sync', 'config-access', 'restart'].includes(action)) {
      throw new Error('ยังไม่รู้จักการทดสอบ Server Bot นี้');
    }
    setActionButtonBusy(triggerButton, true, 'กำลังส่งงานทดสอบ...');
    try {
      const result = await apiRequest(
        `/admin/api/platform/servers/${encodeURIComponent(serverId)}/probes/${encodeURIComponent(action)}`,
        {
          method: 'POST',
          body: {
            tenantId,
          },
        },
        null,
      );
      state.provisioningResult['server-bots'] = {
        instructions: buildRuntimeActionNotice(
          action === 'sync'
            ? 'Queued sync test'
            : action === 'config-access'
              ? 'Queued config access test'
              : 'Queued restart readiness test',
          'Server Bot will pick up this job from the control plane. Refresh this page and Logs & Sync to inspect the latest result.',
          'info',
        ),
        raw: result,
      };
      renderCurrentPage();
      await refreshState({ silent: true });
      setStatus(
        action === 'sync'
          ? 'ส่งงานทดสอบ sync ไปยัง Server Bot แล้ว'
          : action === 'config-access'
            ? 'ส่งงานทดสอบ config access ไปยัง Server Bot แล้ว'
            : 'ส่งงานทดสอบ restart readiness ไปยัง Server Bot แล้ว',
        'success',
      );
      return result;
    } finally {
      setActionButtonBusy(triggerButton, false);
    }
  }

  function wireServerBotProbeActions(renderState, surfaceState) {
    const buttons = Array.from(document.querySelectorAll('[data-server-bot-probe-action]'));
    if (!buttons.length) return;
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const hasBot = hasActiveServerBot(renderState);
    buttons.forEach((button) => {
      const action = String(button.getAttribute('data-server-bot-probe-action') || '').trim().toLowerCase();
      const commandReadiness = getServerBotCommandReadiness(renderState);
      const entitlementLocked = action
        ? Boolean(
          (action === 'sync'
            ? getTenantActionEntitlement(renderState, 'can_view_sync_status')
            : action === 'config-access'
              ? getTenantActionEntitlement(renderState, 'can_edit_config')
              : getTenantActionEntitlement(renderState, 'can_restart_server'))?.locked,
        )
        : false;
      const restartTemplateMissing = action === 'restart' && !commandReadiness.restartConfigured;
      if (previewMode || entitlementLocked || !hasBot || restartTemplateMissing) {
        button.disabled = true;
        button.title = previewMode
          ? 'Preview mode cannot send Server Bot test jobs.'
          : entitlementLocked
            ? getServerBotProbeLockReason(renderState, action)
            : !hasBot
              ? 'Create or reconnect a Server Bot before running this test.'
              : 'Set SCUM_SERVER_RESTART_TEMPLATE or SCUM_SERVER_APPLY_TEMPLATE in Server Config before running this test.';
        return;
      }
      button.addEventListener('click', async () => {
        try {
          const confirmMessage = action === 'sync'
            ? 'ส่งงานทดสอบ sync ไปยัง Server Bot ใช่หรือไม่'
            : action === 'config-access'
              ? 'ส่งงานทดสอบ config access ไปยัง Server Bot ใช่หรือไม่'
              : 'ส่งงานทดสอบ restart readiness ไปยัง Server Bot ใช่หรือไม่';
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueServerBotProbe(renderState, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });
  }

  function wireServerBotDiscordLinksPage(renderState, surfaceState) {
    const button = document.querySelector('[data-server-discord-link-create]');
    if (!button) return;
    const fieldNodes = [
      document.querySelector('[data-server-discord-link-server]'),
      document.querySelector('[data-server-discord-link-guild]'),
      document.querySelector('[data-server-discord-link-status]'),
      button,
    ];
    if (Boolean(surfaceState?.featureAccess?.previewMode)) {
      disableActionNodes(fieldNodes, 'Preview mode cannot change Discord guild mappings.');
      return;
    }
    if (!Array.isArray(renderState?.servers) || renderState.servers.length === 0) {
      disableActionNodes(fieldNodes, 'Add a server before saving a Discord guild mapping.');
      return;
    }
    button.addEventListener('click', async () => {
      const tenantId = String(renderState?.tenantId || '').trim();
      const serverId = String(document.querySelector('[data-server-discord-link-server]')?.value || '').trim();
      const guildId = String(document.querySelector('[data-server-discord-link-guild]')?.value || '').trim();
      const status = String(document.querySelector('[data-server-discord-link-status]')?.value || 'active').trim();
      if (!serverId) {
        setStatus('Choose a server before saving the guild mapping.', 'warning');
        return;
      }
      if (!guildId) {
        setStatus('Guild ID is required.', 'warning');
        return;
      }
      setActionButtonBusy(button, true, 'Saving...');
      try {
        await apiRequest('/admin/api/platform/server-discord-link', {
          method: 'POST',
          body: {
            tenantId,
            serverId,
            guildId,
            status,
            metadata: {
              source: 'tenant-server-bots-ui',
            },
          },
        });
        const guildNode = document.querySelector('[data-server-discord-link-guild]');
        const statusNode = document.querySelector('[data-server-discord-link-status]');
        if (guildNode) guildNode.value = '';
        if (statusNode) statusNode.value = 'active';
        setStatus('Discord guild mapping saved.', 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(button, false);
      }
    });
  }

  function isSurfacePreview(surfaceState, renderState) {
    return Boolean(
      surfaceState?.featureAccess?.previewMode
      || renderState?.tenantConfig?.previewMode
      || renderState?.overview?.tenantConfig?.previewMode
      || renderState?.overview?.opsState?.previewMode,
    );
  }

  function getTenantActionEntitlement(renderState, actionKey) {
    const key = String(actionKey || '').trim();
    return key ? renderState?.featureEntitlements?.actions?.[key] || null : null;
  }

  function getTenantActionLockReason(renderState, actionKey, fallback) {
    const entitlement = getTenantActionEntitlement(renderState, actionKey);
    if (entitlement?.locked && entitlement?.reason) {
      return translateTenantActiveText(entitlement.reason);
    }
    return translateTenantActiveText(String(fallback || '').trim());
  }

  function getTenantRoleAccess(renderState) {
    return renderState?.tenantRoleMatrix?.currentAccess
      || renderState?.me?.tenantAccess
      || null;
  }

  function getTenantPermissionEntry(renderState, permissionKey) {
    const key = String(permissionKey || '').trim();
    if (!key) return null;
    return getTenantRoleAccess(renderState)?.permissions?.[key] || null;
  }

  function getTenantPermissionLockReason(renderState, permissionKey, fallback) {
    const permission = getTenantPermissionEntry(renderState, permissionKey);
    if (permission && permission.allowed === false) {
      return translateTenantActiveText(String(permission.description || fallback || '').trim());
    }
    return translateTenantActiveText(String(fallback || '').trim());
  }

  function hasTenantPermission(renderState, permissionKey) {
    const permission = getTenantPermissionEntry(renderState, permissionKey);
    return permission ? permission.allowed === true : true;
  }

  function getTenantSectionEntitlement(renderState, sectionKey) {
    const key = String(sectionKey || '').trim();
    return key ? renderState?.featureEntitlements?.sections?.[key] || null : null;
  }

  function getPageSectionEntitlement(renderState, pageKey) {
    const sectionKey = PAGE_SECTION_KEYS[String(pageKey || '').trim()] || '';
    return getTenantSectionEntitlement(renderState, sectionKey);
  }

  function createLockedButtonLabel(label) {
    const text = String(label || '').trim();
    if (!text) return '&#128274;';
    if (text.includes('&#128274;') || text.includes('ถูกล็อก')) return text;
    return `&#128274; ${escapeHtml(translateTenantActiveText(text))}`;
  }

  function markLockedActionNode(node, reason) {
    if (!node) return;
    const normalizedReason = String(reason || '').trim();
    const isButtonLike = node.matches?.('button, a, input, select, textarea');
    if (isButtonLike && 'disabled' in node) {
      node.disabled = true;
    }
    node.setAttribute('aria-disabled', 'true');
    node.setAttribute('data-package-locked', 'true');
    if (normalizedReason) {
      node.setAttribute('title', normalizedReason);
    }
    if ((node.tagName === 'BUTTON' || node.tagName === 'A') && !node.dataset.lockedLabelApplied) {
      node.dataset.lockedLabelApplied = 'true';
      node.innerHTML = createLockedButtonLabel(node.textContent || '');
    }
  }

  function pushPermissionLockEntry(entries, renderState, permissionKey, label, fallback) {
    if (hasTenantPermission(renderState, permissionKey)) return;
    entries.push({
      label: translateTenantActiveText(label || 'Role access'),
      reason: getTenantPermissionLockReason(renderState, permissionKey, fallback),
      upgradeCta: { href: '/tenant/roles', label: translateTenantActiveText('Review role access') },
    });
  }

  function collectActionLockEntries(pageKey, renderState) {
    const page = String(pageKey || '').trim();
    const entries = [];
    const sectionEntitlement = getPageSectionEntitlement(renderState, page);
    if (sectionEntitlement?.locked) {
      entries.push({
        label: 'Page access',
        reason: sectionEntitlement.reason || 'This page is visible, but the current package keeps its actions locked.',
        upgradeCta: sectionEntitlement.upgradeCta || null,
      });
    }
    if (page === 'server-status' || page === 'restart-control') {
      pushPermissionLockEntry(entries, renderState, 'restart_server', 'Role access', 'Your tenant role cannot control restart actions.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_restart_server');
      if (entitlement?.locked) {
        entries.push({
          label: page === 'server-status' ? 'Server control' : 'Restart actions',
          reason: entitlement.reason || 'Restart actions are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'server-config') {
      pushPermissionLockEntry(entries, renderState, 'edit_config', 'Role access', 'Your tenant role cannot edit server configuration.');
      pushPermissionLockEntry(entries, renderState, 'restart_server', 'Role access', 'Your tenant role cannot run restart-required config actions.');
      const editEntitlement = getTenantActionEntitlement(renderState, 'can_edit_config');
      if (editEntitlement?.locked) {
        entries.push({
          label: 'Config save actions',
          reason: editEntitlement.reason || 'Server Config save actions are locked in the current package.',
          upgradeCta: editEntitlement.upgradeCta || null,
        });
      }
      const restartEntitlement = getTenantActionEntitlement(renderState, 'can_restart_server');
      if (restartEntitlement?.locked) {
        entries.push({
          label: 'Restart-required actions',
          reason: 'Save and Restart and rollback stay visible here, but they require restart control in the current package.',
          upgradeCta: restartEntitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'delivery-agents') {
      pushPermissionLockEntry(entries, renderState, 'manage_runtimes', 'Role access', 'Your tenant role cannot manage Delivery Agents.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_create_delivery_agent');
      if (entitlement?.locked) {
        entries.push({
          label: 'Delivery Agent actions',
          reason: entitlement.reason || 'Delivery Agent setup is locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'server-bots') {
      pushPermissionLockEntry(entries, renderState, 'manage_runtimes', 'Role access', 'Your tenant role cannot manage Server Bots.');
      const botEntitlement = getTenantActionEntitlement(renderState, 'can_create_server_bot');
      if (botEntitlement?.locked) {
        entries.push({
          label: 'Server Bot actions',
          reason: botEntitlement.reason || 'Server Bot setup is locked in the current package.',
          upgradeCta: botEntitlement.upgradeCta || null,
        });
      }
      const syncEntitlement = getTenantActionEntitlement(renderState, 'can_view_sync_status');
      if (syncEntitlement?.locked) {
        entries.push({
          label: 'Sync test',
          reason: syncEntitlement.reason || 'Sync tests are locked in the current package.',
          upgradeCta: syncEntitlement.upgradeCta || null,
        });
      }
      const editEntitlement = getTenantActionEntitlement(renderState, 'can_edit_config');
      if (editEntitlement?.locked) {
        entries.push({
          label: 'Config access test',
          reason: editEntitlement.reason || 'Config access tests are locked in the current package.',
          upgradeCta: editEntitlement.upgradeCta || null,
        });
      }
      const restartEntitlement = getTenantActionEntitlement(renderState, 'can_restart_server');
      if (restartEntitlement?.locked) {
        entries.push({
          label: 'Restart test',
          reason: restartEntitlement.reason || 'Restart tests are locked in the current package.',
          upgradeCta: restartEntitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'logs-sync') {
      const entitlement = getTenantSectionEntitlement(renderState, 'logs_sync');
      if (entitlement?.locked) {
        entries.push({
          label: 'Refresh sync status',
          reason: entitlement.reason || 'Logs & Sync refresh is locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'orders') {
      pushPermissionLockEntry(entries, renderState, 'manage_orders', 'Role access', 'Your tenant role cannot manage orders or delivery actions.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_manage_orders');
      if (entitlement?.locked) {
        entries.push({
          label: 'Order actions',
          reason: entitlement.reason || 'Retry and cancel actions are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'donations') {
      pushPermissionLockEntry(entries, renderState, 'manage_donations', 'Role access', 'Your tenant role cannot manage donation packages.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_manage_donations');
      if (entitlement?.locked) {
        entries.push({
          label: 'Donation package actions',
          reason: entitlement.reason || 'Donation package actions are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'events') {
      pushPermissionLockEntry(entries, renderState, 'manage_events', 'Role access', 'Your tenant role cannot manage events.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_manage_events');
      if (entitlement?.locked) {
        entries.push({
          label: 'Event actions',
          reason: entitlement.reason || 'Event actions are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'modules') {
      pushPermissionLockEntry(entries, renderState, 'manage_runtimes', 'Role access', 'Your tenant role cannot change bot modules.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_use_modules');
      if (entitlement?.locked) {
        entries.push({
          label: 'Module controls',
          reason: entitlement.reason || 'Module controls are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'staff' || page === 'roles') {
      pushPermissionLockEntry(entries, renderState, 'manage_staff', 'Role access', 'Your tenant role cannot change staff access.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_manage_staff');
      if (entitlement?.locked) {
        entries.push({
          label: page === 'staff' ? 'Staff access changes' : 'Role assignment actions',
          reason: entitlement.reason || 'Staff management is locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'settings') {
      pushPermissionLockEntry(entries, renderState, 'edit_config', 'Role access', 'Your tenant role cannot save tenant settings.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_edit_config');
      if (entitlement?.locked) {
        entries.push({
          label: 'Settings save action',
          reason: entitlement.reason || 'Tenant settings changes are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    if (page === 'players') {
      pushPermissionLockEntry(entries, renderState, 'manage_players', 'Role access', 'Your tenant role cannot run player management actions.');
      const entitlement = getTenantActionEntitlement(renderState, 'can_manage_players');
      if (entitlement?.locked) {
        entries.push({
          label: 'Player tools',
          reason: entitlement.reason || 'Player management tools are locked in the current package.',
          upgradeCta: entitlement.upgradeCta || null,
        });
      }
    }
    return entries;
  }

  function renderTenantLockBanner(pageKey, entries) {
    const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!rows.length) return '';
    const firstUpgradeCta = rows.find((entry) => entry?.upgradeCta)?.upgradeCta || null;
    return [
      '<section class="tdv4-panel tdv4-tone-warning tdv4-entitlement-banner" data-tenant-lock-banner>',
      '<div class="tdv4-lock-banner-copy">',
      `<div class="tdv4-section-kicker">${escapeHtml(translateTenantActiveText('Access'))}</div>`,
      `<h2 class="tdv4-section-title">&#128274; ${escapeHtml(translateTenantActiveText(pageKey === 'server-config' ? 'Some config actions are locked' : 'Some actions are locked'))}</h2>`,
      '<div class="tdv4-lock-list">',
      ...rows.map((entry) => [
        '<div class="tdv4-lock-list-item">',
        `<strong>${escapeHtml(translateTenantActiveText(entry.label || 'Locked action'))}</strong>`,
        `<span>${escapeHtml(translateTenantActiveText(entry.reason || 'This action is locked in the current package.'))}</span>`,
        '</div>',
      ].join('')),
      '</div>',
      '</div>',
      firstUpgradeCta
        ? `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(firstUpgradeCta.href || '/tenant/billing')}">${escapeHtml(translateTenantActiveText(firstUpgradeCta.label || 'Upgrade package'))}</a>`
        : '',
      '</section>',
    ].join('');
  }

  function injectTenantLockBanner(pageKey, renderState) {
    const target = root();
    if (!target) return;
    const entries = collectActionLockEntries(pageKey, renderState);
    if (!entries.length) return;
    const pageHead = target.querySelector('.tdv4-pagehead');
    const html = renderTenantLockBanner(pageKey, entries);
    if (!html) return;
    if (pageHead?.insertAdjacentHTML) {
      pageHead.insertAdjacentHTML('afterend', html);
      return;
    }
    const main = target.querySelector('.tdv4-main');
    if (main?.insertAdjacentHTML) {
      main.insertAdjacentHTML('afterbegin', html);
    }
  }

  function applyTenantLockPresentation(pageKey, renderState) {
    injectTenantLockBanner(pageKey, renderState);
    const page = String(pageKey || '').trim();
    const lockNodeGroups = [];
    if (page === 'server-status') {
      const reason = getTenantActionLockReason(renderState, 'can_restart_server', 'Server control is locked in the current package.');
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-server-control-button]')),
          ...Array.from(document.querySelectorAll('[data-server-restart-button]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) || !hasTenantPermission(renderState, 'restart_server'),
        reason,
      });
    }
    if (page === 'restart-control') {
      const reason = getTenantActionLockReason(renderState, 'can_restart_server', 'Restart actions are locked in the current package.');
      lockNodeGroups.push({
        nodes: Array.from(document.querySelectorAll('[data-restart-action-button]')),
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) || !hasTenantPermission(renderState, 'restart_server'),
        reason,
      });
    }
    if (page === 'server-config') {
      const editReason = getTenantActionLockReason(renderState, 'can_edit_config', 'Config save actions are locked in the current package.');
      const restartReason = getTenantActionLockReason(renderState, 'can_restart_server', 'Restart-required config actions are locked in the current package.');
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-server-config-field]')),
          ...Array.from(document.querySelectorAll('[data-feature-flag-toggle]')),
          ...Array.from(document.querySelectorAll('[data-config-patch-field]')),
          ...Array.from(document.querySelectorAll('[data-portal-env-field]')),
          ...Array.from(document.querySelectorAll('[data-config-action]')),
          ...Array.from(document.querySelectorAll('[data-server-config-save-mode="save_only"]')),
          ...Array.from(document.querySelectorAll('[data-server-config-save-mode="save_apply"]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_edit_config')?.locked) || !hasTenantPermission(renderState, 'edit_config'),
        reason: !hasTenantPermission(renderState, 'edit_config')
          ? getTenantPermissionLockReason(renderState, 'edit_config', editReason)
          : editReason,
      });
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-server-config-save-mode="save_restart"]')),
          ...Array.from(document.querySelectorAll('[data-server-config-rollback]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) || !hasTenantPermission(renderState, 'restart_server'),
        reason: !hasTenantPermission(renderState, 'restart_server')
          ? getTenantPermissionLockReason(renderState, 'restart_server', restartReason)
          : restartReason,
      });
    }
    if (page === 'delivery-agents') {
      const reason = getTenantActionLockReason(renderState, 'can_create_delivery_agent', 'Delivery Agent actions are locked in the current package.');
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-runtime-provision-button="delivery-agents"]')),
          ...Array.from(document.querySelectorAll('[data-runtime-action-kind="delivery-agents"][data-runtime-action]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_create_delivery_agent')?.locked) || !hasTenantPermission(renderState, 'manage_runtimes'),
        reason: !hasTenantPermission(renderState, 'manage_runtimes')
          ? getTenantPermissionLockReason(renderState, 'manage_runtimes', reason)
          : reason,
      });
    }
    if (page === 'server-bots') {
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-runtime-provision-button="server-bots"]')),
          ...Array.from(document.querySelectorAll('[data-runtime-action-kind="server-bots"][data-runtime-action]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_create_server_bot')?.locked) || !hasTenantPermission(renderState, 'manage_runtimes'),
        reason: !hasTenantPermission(renderState, 'manage_runtimes')
          ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Server Bot actions are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_create_server_bot', 'Server Bot actions are locked in the current package.'),
      });
      lockNodeGroups.push({
        nodes: Array.from(document.querySelectorAll('[data-server-bot-probe-action="sync"]')),
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_view_sync_status')?.locked) || !hasTenantPermission(renderState, 'manage_runtimes'),
        reason: !hasTenantPermission(renderState, 'manage_runtimes')
          ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Sync tests are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_view_sync_status', 'Sync tests are locked in the current package.'),
      });
      lockNodeGroups.push({
        nodes: Array.from(document.querySelectorAll('[data-server-bot-probe-action="config-access"]')),
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_edit_config')?.locked) || !hasTenantPermission(renderState, 'manage_runtimes'),
        reason: !hasTenantPermission(renderState, 'manage_runtimes')
          ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Config access tests are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_edit_config', 'Config access tests are locked in the current package.'),
      });
      lockNodeGroups.push({
        nodes: Array.from(document.querySelectorAll('[data-server-bot-probe-action="restart"]')),
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) || !hasTenantPermission(renderState, 'manage_runtimes'),
        reason: !hasTenantPermission(renderState, 'manage_runtimes')
          ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Restart tests are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_restart_server', 'Restart tests are locked in the current package.'),
      });
    }
    if (page === 'logs-sync') {
      const entitlement = getTenantSectionEntitlement(renderState, 'logs_sync');
      lockNodeGroups.push({
        nodes: Array.from(document.querySelectorAll('[data-tenant-logs-sync-refresh]')),
        locked: Boolean(entitlement?.locked),
        reason: entitlement?.reason || 'Logs & Sync refresh is locked in the current package.',
      });
    }
    if (page === 'orders') {
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-order-action="retry"]')),
          ...Array.from(document.querySelectorAll('[data-order-action="cancel"]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_manage_orders')?.locked) || !hasTenantPermission(renderState, 'manage_orders'),
        reason: !hasTenantPermission(renderState, 'manage_orders')
          ? getTenantPermissionLockReason(renderState, 'manage_orders', 'Order actions are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_manage_orders', 'Order actions are locked in the current package.'),
      });
    }
    if (page === 'donations') {
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-tenant-donation-create]')),
          ...Array.from(document.querySelectorAll('[data-tenant-donation-save]')),
          ...Array.from(document.querySelectorAll('[data-tenant-donation-delete]')),
          ...Array.from(document.querySelectorAll('[data-tenant-donation-toggle-status]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_manage_donations')?.locked) || !hasTenantPermission(renderState, 'manage_donations'),
        reason: !hasTenantPermission(renderState, 'manage_donations')
          ? getTenantPermissionLockReason(renderState, 'manage_donations', 'Donation package actions are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_manage_donations', 'Donation package actions are locked in the current package.'),
      });
    }
    if (page === 'events') {
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-tenant-event-create]')),
          ...Array.from(document.querySelectorAll('[data-tenant-event-action]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_manage_events')?.locked) || !hasTenantPermission(renderState, 'manage_events'),
        reason: !hasTenantPermission(renderState, 'manage_events')
          ? getTenantPermissionLockReason(renderState, 'manage_events', 'Event actions are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_manage_events', 'Event actions are locked in the current package.'),
      });
    }
    if (page === 'modules') {
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-tenant-modules-save]')),
          ...Array.from(document.querySelectorAll('[data-tenant-modules-reset]')),
          ...Array.from(document.querySelectorAll('[data-module-toggle]')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_use_modules')?.locked) || !hasTenantPermission(renderState, 'manage_runtimes'),
        reason: !hasTenantPermission(renderState, 'manage_runtimes')
          ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Module controls are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_use_modules', 'Module controls are locked in the current package.'),
      });
    }
    if (page === 'staff' || page === 'roles') {
      lockNodeGroups.push({
        nodes: [
          ...Array.from(document.querySelectorAll('[data-tenant-staff-invite-submit]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-role-update]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-revoke]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-role]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-status]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-revoke-reason]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-invite-form] input')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-invite-form] select')),
        ],
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_manage_staff')?.locked) || !hasTenantPermission(renderState, 'manage_staff'),
        reason: !hasTenantPermission(renderState, 'manage_staff')
          ? getTenantPermissionLockReason(renderState, 'manage_staff', 'Staff management is locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_manage_staff', 'Staff management is locked in the current package.'),
      });
    }
    if (page === 'settings') {
      lockNodeGroups.push({
        nodes: Array.from(document.querySelectorAll('[data-tenant-settings-save]')),
        locked: Boolean(getTenantActionEntitlement(renderState, 'can_edit_config')?.locked) || !hasTenantPermission(renderState, 'edit_config'),
        reason: !hasTenantPermission(renderState, 'edit_config')
          ? getTenantPermissionLockReason(renderState, 'edit_config', 'Tenant settings changes are locked in the current package.')
          : getTenantActionLockReason(renderState, 'can_edit_config', 'Tenant settings changes are locked in the current package.'),
      });
    }
    lockNodeGroups
      .filter((entry) => entry.locked)
      .forEach((entry) => {
        entry.nodes.forEach((node) => markLockedActionNode(node, entry.reason));
      });
  }

  function disableActionNodes(nodes, reason) {
    (Array.isArray(nodes) ? nodes : []).forEach((node) => {
      if (!node) return;
      node.disabled = true;
      if (reason) {
        node.title = translateTenantActiveText(reason);
      }
    });
  }

  function scrollToNode(selector) {
    const target = document.querySelector(selector);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function normalizeOrderStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function collectModuleFeatureFlags(renderState) {
    return renderState?.tenantConfig?.featureFlags && typeof renderState.tenantConfig.featureFlags === 'object'
      ? { ...renderState.tenantConfig.featureFlags }
      : {};
  }

  function findWorkspaceSettingValue(renderState, settingKey) {
    const targetKey = String(settingKey || '').trim().toLowerCase();
    if (!targetKey) return '';
    const workspace = renderState?.serverConfigWorkspace && typeof renderState.serverConfigWorkspace === 'object'
      ? renderState.serverConfigWorkspace
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

  function getServerBotCommandReadiness(renderState) {
    const startConfigured = Boolean(findWorkspaceSettingValue(renderState, 'SCUM_SERVER_START_TEMPLATE'));
    const stopConfigured = Boolean(findWorkspaceSettingValue(renderState, 'SCUM_SERVER_STOP_TEMPLATE'));
    const restartConfigured = Boolean(
      findWorkspaceSettingValue(renderState, 'SCUM_SERVER_RESTART_TEMPLATE')
      || findWorkspaceSettingValue(renderState, 'SCUM_SERVER_APPLY_TEMPLATE'),
    );
    return {
      startConfigured,
      stopConfigured,
      restartConfigured,
    };
  }

  function computeModuleSaveState(renderState) {
    const toggles = Array.from(document.querySelectorAll('[data-module-toggle][data-module-feature-key]'));
    const baseFeatureSet = new Set(
      Array.isArray(renderState?.overview?.tenantFeatureAccess?.package?.features)
        ? renderState.overview.tenantFeatureAccess.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const nextFeatureFlags = collectModuleFeatureFlags(renderState);
    const moduleKeys = new Set();

    toggles.forEach((toggle) => {
      const featureKey = String(toggle.getAttribute('data-module-feature-key') || '').trim();
      const packageEnabled = String(toggle.getAttribute('data-module-package-enabled') || '').trim() === 'true';
      if (!featureKey) return;
      moduleKeys.add(featureKey);
      if (toggle.disabled) return;
      if (toggle.checked === packageEnabled) {
        delete nextFeatureFlags[featureKey];
      } else {
        nextFeatureFlags[featureKey] = toggle.checked;
      }
    });

    const effectiveFeatureSet = new Set(baseFeatureSet);
    Object.entries(nextFeatureFlags).forEach(([featureKey, rawValue]) => {
      if (rawValue === true) effectiveFeatureSet.add(featureKey);
      if (rawValue === false) effectiveFeatureSet.delete(featureKey);
    });

    const dependencyIssues = toggles.reduce((rows, toggle) => {
      const featureKey = String(toggle.getAttribute('data-module-feature-key') || '').trim();
      const dependsOnRaw = String(toggle.getAttribute('data-module-depends-on') || '').trim();
      const dependsOn = dependsOnRaw ? dependsOnRaw.split(',').map((value) => String(value || '').trim()).filter(Boolean) : [];
      if (!featureKey || !toggle.checked || !dependsOn.length) return rows;
      const missing = dependsOn.filter((dependency) => !effectiveFeatureSet.has(dependency));
      if (!missing.length) return rows;
      rows.push({
        featureKey,
        missing,
      });
      return rows;
    }, []);

    moduleKeys.forEach((featureKey) => {
      if (!Object.prototype.hasOwnProperty.call(nextFeatureFlags, featureKey)) return;
      const rawValue = nextFeatureFlags[featureKey];
      if (rawValue !== true && rawValue !== false) {
        delete nextFeatureFlags[featureKey];
      }
    });

    return {
      nextFeatureFlags,
      dependencyIssues,
    };
  }

  function wireServerStatusPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const restartButtons = Array.from(document.querySelectorAll('[data-server-restart-button]'));
    const controlButtons = Array.from(document.querySelectorAll('[data-server-control-button]'));
    const hasBot = hasActiveServerBot(renderState);
    const commandReadiness = getServerBotCommandReadiness(renderState);
    const restartLockReason = getTenantActionLockReason(
      renderState,
      'can_restart_server',
      'Restart actions are not available in the current package.',
    );

    if (previewMode || getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) {
      disableActionNodes(restartButtons, previewMode ? 'Preview mode cannot send restart jobs.' : restartLockReason);
      disableActionNodes(controlButtons, previewMode ? 'Preview mode cannot control the server.' : restartLockReason);
      return;
    }

    controlButtons.forEach((button) => {
      const action = String(button.getAttribute('data-server-control-action') || '').trim().toLowerCase();
      const actionConfigured = action === 'start'
        ? commandReadiness.startConfigured
        : commandReadiness.stopConfigured;
      const missingReason = action === 'start'
        ? 'Set SCUM_SERVER_START_TEMPLATE in Server Config before starting the server from this page.'
        : 'Set SCUM_SERVER_STOP_TEMPLATE in Server Config before stopping the server from this page.';
      if (!hasBot || !actionConfigured) {
        button.disabled = true;
        button.title = !hasBot
          ? 'Create or reconnect a Server Bot before controlling the server.'
          : missingReason;
      }
    });

    restartButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const restartMode = String(button.getAttribute('data-restart-mode') || 'safe_restart').trim();
          const delaySeconds = Math.max(0, Math.trunc(Number(button.getAttribute('data-restart-delay-seconds') || 0) || 0));
          const confirmMessage = restartMode === 'immediate'
            ? 'รีสตาร์ตเซิร์ฟเวอร์ทันทีใช่หรือไม่'
            : restartMode === 'safe_restart'
              ? 'เริ่ม safe restart สำหรับเซิร์ฟเวอร์นี้ใช่หรือไม่'
              : `ตั้งเวลารีสตาร์ตอีก ${delaySeconds} วินาทีใช่หรือไม่`;
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueServerRestart(renderState, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });

    controlButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const action = String(button.getAttribute('data-server-control-action') || '').trim().toLowerCase();
          const confirmMessage = action === 'start'
            ? 'เปิดเซิร์ฟเวอร์นี้ตอนนี้ใช่หรือไม่'
            : 'ปิดเซิร์ฟเวอร์นี้ตอนนี้ใช่หรือไม่';
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueServerControlAction(renderState, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });
  }

  function wireRestartControlPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const actionButtons = Array.from(document.querySelectorAll('[data-restart-action-button]'));
    const restartLockReason = getTenantActionLockReason(
      renderState,
      'can_restart_server',
      'Restart actions are not available in the current package.',
    );
    if (previewMode || getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) {
      disableActionNodes(actionButtons, previewMode ? 'Preview mode cannot send restart jobs.' : restartLockReason);
      return;
    }

    actionButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const restartMode = String(button.getAttribute('data-restart-mode') || 'safe_restart').trim();
          const delaySeconds = Math.max(0, Math.trunc(Number(button.getAttribute('data-restart-delay-seconds') || 0) || 0));
          const confirmMessage = restartMode === 'immediate'
            ? 'ยืนยันรีสตาร์ตทันทีใช่หรือไม่'
            : restartMode === 'safe_restart'
              ? 'ยืนยันเริ่ม safe restart ใช่หรือไม่'
              : `ยืนยันตั้งเวลารีสตาร์ตอีก ${delaySeconds} วินาทีใช่หรือไม่`;
          if (!window.confirm(confirmMessage)) {
            return;
          }
          await queueServerRestart(renderState, button);
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        }
      });
    });
  }

  function wireOrdersPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const tenantId = String(renderState?.tenantId || '').trim();
    const filterForm = document.querySelector('[data-order-filter-form]');
    const selectButtons = Array.from(document.querySelectorAll('[data-order-select][data-code]'));
    const actionButtons = Array.from(document.querySelectorAll('[data-order-action][data-code]'));
    const manageLockReason = getTenantActionLockReason(
      renderState,
      'can_manage_orders',
      'Order actions are locked in the current package.',
    );

    if (previewMode || getTenantActionEntitlement(renderState, 'can_manage_orders')?.locked) {
      disableActionNodes(actionButtons, previewMode ? 'Preview mode cannot run order actions.' : manageLockReason);
      if (previewMode) {
        disableActionNodes(selectButtons, 'Preview mode cannot inspect live order data.');
      } else {
        actionButtons
          .filter((button) => {
            const action = String(button.getAttribute('data-order-action') || '').trim();
            return action === 'inspect-order' || action === 'inspect-delivery';
          })
          .forEach((button) => {
            button.disabled = false;
            button.removeAttribute('aria-disabled');
            button.removeAttribute('data-package-locked');
            button.removeAttribute('title');
          });
      }
      return;
    }

    filterForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(filterForm);
      const userId = String(formData.get('userId') || '').trim();
      const status = String(formData.get('status') || '').trim();
      if (!userId) {
        setStatus('เลือกผู้เล่นก่อนค้นหาคำสั่งซื้อ', 'warning');
        return;
      }
      writePurchaseFiltersToUrl(userId, status);
      await refreshState({ silent: false });
    });

    selectButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const code = String(button.getAttribute('data-code') || '').trim();
        const userId = String(button.getAttribute('data-user-id') || '').trim() || String(renderState?.purchaseLookup?.userId || '').trim();
        if (!code || !userId) return;
        writePurchaseSelectionToUrl(userId, code);
        await refreshState({ silent: true });
        setStatus(`เปิดคำสั่งซื้อ ${code} แล้ว`, 'success');
      });
    });

    actionButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const action = String(button.getAttribute('data-order-action') || '').trim();
        const code = String(button.getAttribute('data-code') || '').trim();
        if (!tenantId || !code) return;
        if (action === 'inspect-order') {
          const userId = String(button.getAttribute('data-user-id') || '').trim() || String(renderState?.purchaseLookup?.userId || '').trim();
          writePurchaseSelectionToUrl(userId, code);
          await refreshState({ silent: true });
          setStatus(`กำลังดูคำสั่งซื้อ ${code}`, 'info');
          return;
        }
        if (action === 'inspect-delivery') {
          scrollToNode('[data-order-case-panel]');
          setStatus(`เปิดผลการส่งของของ ${code}`, 'info');
          return;
        }

        setActionButtonBusy(button, true, action === 'retry' ? 'Retrying...' : 'Cancelling...');
        try {
          if (action === 'retry') {
            const hasDeadLetter = String(button.getAttribute('data-order-has-dead-letter') || '').trim() === 'true';
            await apiRequest(
              hasDeadLetter ? '/admin/api/delivery/dead-letter/retry' : '/admin/api/delivery/retry',
              {
                method: 'POST',
                body: {
                  tenantId,
                  code,
                  guildId: getServerGuildId(renderState?.activeServer) || undefined,
                },
              },
              null,
            );
            setStatus(`ส่งคำขอ retry ของ ${code} แล้ว`, 'success');
          } else if (action === 'cancel') {
            await apiRequest(
              '/admin/api/delivery/cancel',
              {
                method: 'POST',
                body: {
                  tenantId,
                  code,
                  reason: 'tenant-orders-ui',
                },
              },
              null,
            );
            setStatus(`ยกเลิกงานส่งของของ ${code} แล้ว`, 'success');
          }
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });
  }

  function wireEventsPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const tenantId = String(renderState?.tenantId || '').trim();
    const serverId = String(renderState?.activeServer?.id || '').trim() || null;
    const createButton = document.querySelector('[data-tenant-event-create]');
    const createForm = document.querySelector('[data-tenant-event-form]');
    const eventButtons = Array.from(document.querySelectorAll('[data-tenant-event-action][data-event-id]'));
    const raidReviewButtons = Array.from(document.querySelectorAll('[data-tenant-raid-review][data-raid-request-id]'));
    const raidWindowForm = document.querySelector('[data-tenant-raid-window-form]');
    const raidWindowButton = document.querySelector('[data-tenant-raid-window-save]');
    const raidSummaryForm = document.querySelector('[data-tenant-raid-summary-form]');
    const raidSummaryButton = document.querySelector('[data-tenant-raid-summary-save]');
    const manageLockReason = getTenantActionLockReason(
      renderState,
      'can_manage_events',
      'การจัดการกิจกรรมถูกล็อกไว้ตามแพ็กเกจปัจจุบัน',
    );

    if (previewMode || getTenantActionEntitlement(renderState, 'can_manage_events')?.locked) {
      disableActionNodes(
        [createButton, ...eventButtons, ...raidReviewButtons, raidWindowButton, raidSummaryButton],
        previewMode ? 'โหมดดูตัวอย่างยังจัดการกิจกรรมจริงไม่ได้' : manageLockReason,
      );
      return;
    }

    createForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(createForm);
      const name = String(formData.get('name') || '').trim();
      const time = String(formData.get('time') || '').trim();
      const reward = String(formData.get('reward') || '').trim();
      if (!name || !time || !reward) {
        setStatus('กรอกชื่อกิจกรรม เวลา และรางวัลก่อนสร้างกิจกรรม', 'warning');
        return;
      }
      setActionButtonBusy(createButton, true, 'กำลังสร้าง...');
      try {
        await apiRequest('/admin/api/event/create', {
          method: 'POST',
          body: {
            tenantId,
            name,
            time,
            reward,
          },
        }, null);
        createForm.reset();
        setStatus(`สร้างกิจกรรม ${name} แล้ว`, 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(createButton, false);
      }
    });

    eventButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const eventId = String(button.getAttribute('data-event-id') || '').trim();
        const action = String(button.getAttribute('data-tenant-event-action') || '').trim();
        const card = button.closest('[data-tenant-event-card]');
        if (!eventId || !action) return;
        setActionButtonBusy(button, true, action === 'start' ? 'กำลังเริ่มกิจกรรม...' : 'กำลังบันทึก...');
        try {
          if (action === 'update') {
            await apiRequest('/admin/api/event/update', {
              method: 'POST',
              body: {
                tenantId,
                id: Number(eventId),
                name: String(card?.querySelector('[data-event-name]')?.value || '').trim(),
                time: String(card?.querySelector('[data-event-time]')?.value || '').trim(),
                reward: String(card?.querySelector('[data-event-reward]')?.value || '').trim(),
              },
            }, null);
            setStatus(`บันทึกรายละเอียดกิจกรรม #${eventId} แล้ว`, 'success');
          } else if (action === 'start') {
            await apiRequest('/admin/api/event/start', {
              method: 'POST',
              body: {
                tenantId,
                id: Number(eventId),
              },
            }, null);
            setStatus(`เปิดใช้งานกิจกรรม #${eventId} แล้ว`, 'success');
          } else if (action === 'end') {
            await apiRequest('/admin/api/event/end', {
              method: 'POST',
              body: {
                tenantId,
                id: Number(eventId),
                winnerUserId: String(card?.querySelector('[data-event-winner-user-id]')?.value || '').trim(),
                coins: Number(card?.querySelector('[data-event-reward-coins]')?.value || 0) || 0,
              },
            }, null);
            setStatus(`ปิดกิจกรรม #${eventId} แล้ว`, 'success');
          }
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });

    raidReviewButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const requestId = String(button.getAttribute('data-raid-request-id') || '').trim();
        const status = String(button.getAttribute('data-tenant-raid-review') || '').trim().toLowerCase();
        const card = button.closest('[data-tenant-raid-request-card]');
        if (!requestId || !['approved', 'rejected', 'pending'].includes(status)) return;
        setActionButtonBusy(button, true, status === 'approved' ? 'Approving...' : 'Saving...');
        try {
          await apiRequest('/admin/api/raid/request/review', {
            method: 'POST',
            body: {
              tenantId,
              serverId,
              id: Number(requestId),
              status,
              decisionNote: String(card?.querySelector('[data-raid-request-note]')?.value || '').trim(),
            },
          }, null);
          setStatus(
            status === 'approved'
              ? `อนุมัติคำขอเรด #${requestId} แล้ว`
              : `ไม่อนุมัติคำขอเรด #${requestId} แล้ว`,
            status === 'approved' ? 'success' : 'warning',
          );
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });

    raidWindowForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(raidWindowForm);
      const title = String(formData.get('title') || '').trim();
      const startsAt = String(formData.get('startsAt') || '').trim();
      if (!title || !startsAt) {
        setStatus('กรอกชื่อช่วงเวลาเรดและเวลาเริ่มก่อนบันทึก', 'warning');
        return;
      }
      setActionButtonBusy(raidWindowButton, true, 'กำลังบันทึก...');
      try {
        await apiRequest('/admin/api/raid/window/create', {
          method: 'POST',
          body: {
            tenantId,
            serverId,
            requestId: Number(formData.get('requestId') || 0) || null,
            title,
            startsAt,
            endsAt: String(formData.get('endsAt') || '').trim(),
            notes: String(formData.get('notes') || '').trim(),
          },
        }, null);
        raidWindowForm.reset();
        setStatus(`สร้างช่วงเวลาเรด ${title} แล้ว`, 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(raidWindowButton, false);
      }
    });

    raidSummaryForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(raidSummaryForm);
      const outcome = String(formData.get('outcome') || '').trim();
      if (!outcome) {
        setStatus('กรอกผลลัพธ์ของเรดก่อนเผยแพร่สรุป', 'warning');
        return;
      }
      setActionButtonBusy(raidSummaryButton, true, 'กำลังบันทึก...');
      try {
        await apiRequest('/admin/api/raid/summary/create', {
          method: 'POST',
          body: {
            tenantId,
            serverId,
            requestId: Number(formData.get('requestId') || 0) || null,
            windowId: Number(formData.get('windowId') || 0) || null,
            outcome,
            notes: String(formData.get('notes') || '').trim(),
          },
        }, null);
        raidSummaryForm.reset();
        setStatus('เผยแพร่สรุปผลเรดแล้ว', 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(raidSummaryButton, false);
      }
    });
  }

  function wireModulesPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const saveButton = document.querySelector('[data-tenant-modules-save]');
    const resetButton = document.querySelector('[data-tenant-modules-reset]');
    const toggles = Array.from(document.querySelectorAll('[data-module-toggle][data-module-feature-key]'));
    const manageLockReason = getTenantActionLockReason(
      renderState,
      'can_use_modules',
      'Module controls are locked in the current package.',
    );

    if (previewMode || getTenantActionEntitlement(renderState, 'can_use_modules')?.locked) {
      disableActionNodes([saveButton, resetButton, ...toggles], previewMode ? 'Preview mode cannot change module state.' : manageLockReason);
      return;
    }

    toggles.forEach((toggle) => {
      toggle.addEventListener('change', () => {
        const { dependencyIssues } = computeModuleSaveState(renderState);
        if (dependencyIssues.length > 0) {
          const issue = dependencyIssues[0];
          setStatus(`โมดูล ${issue.featureKey} ยังขาด dependency: ${issue.missing.join(', ')}`, 'warning');
          return;
        }
        setStatus('มีการแก้ไขโมดูลที่ยังไม่บันทึก', 'warning');
      });
    });

    resetButton?.addEventListener('click', () => {
      toggles.forEach((toggle) => {
        const packageEnabled = String(toggle.getAttribute('data-module-package-enabled') || '').trim() === 'true';
        if (!toggle.disabled) {
          toggle.checked = packageEnabled;
        }
      });
      setStatus('คืนค่าโมดูลกลับตามแพ็กเกจแล้ว กด Save หากต้องการบันทึก', 'info');
    });

    saveButton?.addEventListener('click', async () => {
      const tenantId = getRenderTenantId(renderState);
      if (!tenantId) {
        setStatus('ยังไม่พบ tenant สำหรับบันทึกโมดูล', 'danger');
        return;
      }
      const { nextFeatureFlags, dependencyIssues } = computeModuleSaveState(renderState);
      if (dependencyIssues.length > 0) {
        const issue = dependencyIssues[0];
        setStatus(`บันทึกไม่ได้ เพราะ ${issue.featureKey} ยังขาด dependency: ${issue.missing.join(', ')}`, 'danger');
        return;
      }
      setActionButtonBusy(saveButton, true, 'Saving...');
      try {
        await apiRequest('/admin/api/platform/tenant-config', {
          method: 'POST',
          body: {
            tenantId,
            updateScope: 'modules',
            featureFlags: nextFeatureFlags,
          },
        }, null);
        setStatus('บันทึกสถานะโมดูลแล้ว', 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(saveButton, false);
      }
    });
  }

  function wireLogsSyncPage(renderState, surfaceState) {
    const refreshButton = document.querySelector('[data-tenant-logs-sync-refresh]');
    const retryButtons = Array.from(document.querySelectorAll('[data-config-job-retry][data-job-id][data-server-id]'));
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const lockReason = firstNonEmpty([
      renderState?.featureEntitlements?.sections?.logs_sync?.reason,
      'Logs & Sync is locked in the current package.',
    ], 'Logs & Sync is locked in the current package.');
    const configLockReason = getTenantActionLockReason(
      renderState,
      'can_edit_config',
      'Server Config actions are locked in the current package.',
    );
    const restartLockReason = getTenantActionLockReason(
      renderState,
      'can_restart_server',
      'Restart actions are locked in the current package.',
    );
    if (previewMode || renderState?.featureEntitlements?.sections?.logs_sync?.locked) {
      disableActionNodes(
        [refreshButton, ...retryButtons],
        previewMode ? 'Preview mode cannot load live sync signals.' : lockReason,
      );
      return;
    }
    refreshButton?.addEventListener('click', async () => {
      setActionButtonBusy(refreshButton, true, 'Refreshing...');
      try {
        await refreshState({ silent: false });
      } finally {
        setActionButtonBusy(refreshButton, false);
      }
    });

    retryButtons.forEach((button) => {
      const needsRestartControl = String(button.getAttribute('data-job-needs-restart-control') || '').trim() === 'true';
      if (getTenantActionEntitlement(renderState, 'can_edit_config')?.locked) {
        button.disabled = true;
        button.title = configLockReason;
        return;
      }
      if (needsRestartControl && getTenantActionEntitlement(renderState, 'can_restart_server')?.locked) {
        button.disabled = true;
        button.title = restartLockReason;
        return;
      }
      button.addEventListener('click', async () => {
        const tenantId = getRenderTenantId(renderState);
        const serverId = String(button.getAttribute('data-server-id') || '').trim();
        const jobId = String(button.getAttribute('data-job-id') || '').trim();
        if (!tenantId || !serverId || !jobId) {
          setStatus('Config job retry could not find the tenant or job context.', 'danger');
          return;
        }
        const confirmMessage = needsRestartControl
          ? 'Retry this failed config job and allow restart-required follow-up again?'
          : 'Retry this failed config job?';
        if (!window.confirm(confirmMessage)) {
          return;
        }
        setActionButtonBusy(button, true, 'Retrying...');
        try {
          await apiRequest(
            `/admin/api/platform/servers/${encodeURIComponent(serverId)}/config/jobs/${encodeURIComponent(jobId)}/retry`,
            {
              method: 'POST',
              body: { tenantId },
            },
            null,
          );
          setStatus(`Queued a retry for config job ${jobId}.`, 'success');
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });
  }

  function wireSettingsPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const form = document.querySelector('[data-tenant-settings-form]');
    const saveButton = document.querySelector('[data-tenant-settings-save]');
    const configLockReason = getTenantActionLockReason(
      renderState,
      'can_edit_config',
      'Tenant settings changes are locked in the current package.',
    );
    if (previewMode || getTenantActionEntitlement(renderState, 'can_edit_config')?.locked) {
      disableActionNodes([saveButton], previewMode ? 'Preview mode cannot save tenant settings.' : configLockReason);
      return;
    }

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const tenantId = getRenderTenantId(renderState);
      if (!tenantId) {
        setStatus('Tenant settings could not find the tenant scope.', 'danger');
        return;
      }
      try {
        const configPatch = parseConfigJsonInput(
          document.querySelector('[data-tenant-settings-config-patch]')?.value,
          'Tenant settings changes',
          { emptyAsObject: true },
        );
        const portalEnvPatch = parseConfigJsonInput(
          document.querySelector('[data-tenant-settings-portal-env-patch]')?.value,
          'Portal settings',
          { emptyAsObject: true },
        );
        setActionButtonBusy(saveButton, true, 'Saving...');
        await apiRequest('/admin/api/platform/tenant-config', {
          method: 'POST',
          body: {
            tenantId,
            updateScope: 'settings',
            configPatch,
            portalEnvPatch,
            featureFlags: renderState?.tenantConfig?.featureFlags && typeof renderState.tenantConfig.featureFlags === 'object'
              ? renderState.tenantConfig.featureFlags
              : {},
          },
        }, null);
        setStatus('Tenant settings saved.', 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(saveButton, false);
      }
    });
  }

  function wireBillingPage(renderState) {
    const refreshButtons = Array.from(document.querySelectorAll('[data-tenant-billing-refresh]'));
    refreshButtons.forEach((refreshButton) => {
      refreshButton.addEventListener('click', async () => {
        setActionButtonBusy(refreshButton, true, 'Refreshing...');
        try {
          await refreshState({ silent: false });
        } finally {
          setActionButtonBusy(refreshButton, false);
        }
      });
    });

    const checkoutButtons = Array.from(document.querySelectorAll('[data-tenant-billing-checkout][data-plan-id]'));
    checkoutButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const tenantId = getRenderTenantId(renderState);
        const planId = String(button.getAttribute('data-plan-id') || '').trim();
        const subscriptionId = String(
          button.getAttribute('data-subscription-id')
          || renderState?.quota?.subscription?.id
          || renderState?.subscriptions?.[0]?.id
          || '',
        ).trim();
        if (!tenantId || !planId || !subscriptionId) {
          setStatus('ยังไม่พบข้อมูล tenant หรือการสมัครใช้สำหรับเปิดหน้าชำระเงิน', 'warning');
          return;
        }
        setActionButtonBusy(button, true, 'Preparing checkout...');
        try {
          const result = await apiRequest('/admin/api/platform/billing/checkout-session', {
            method: 'POST',
            body: {
              tenantId,
              subscriptionId,
              planId,
              successUrl: '/tenant/billing',
              cancelUrl: '/tenant/billing',
              checkoutUrl: '/payment-result',
            },
          }, null);
          const checkoutUrl = String(result?.session?.checkoutUrl || '').trim();
          if (!checkoutUrl) {
            throw new Error('ระบบยังไม่ส่งลิงก์ชำระเงินกลับมา');
          }
          setStatus('กำลังเปิดหน้าชำระเงิน...', 'info');
          window.location.assign(checkoutUrl);
        } catch (error) {
          setStatus(String(error?.message || error || 'ไม่สามารถเปิดหน้าชำระเงินได้'), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });
  }

  function wireDonationsPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const createForm = document.querySelector('[data-tenant-donation-create-form]');
    const createButton = document.querySelector('[data-tenant-donation-create]');
    const saveButtons = Array.from(document.querySelectorAll('[data-tenant-donation-save][data-item-id]'));
    const deleteButtons = Array.from(document.querySelectorAll('[data-tenant-donation-delete][data-item-id]'));
    const toggleButtons = Array.from(document.querySelectorAll('[data-tenant-donation-toggle-status][data-item-id]'));
    const manageLockReason = getTenantActionLockReason(
      renderState,
      'can_manage_donations',
      'Donation tools are locked in the current package.',
    );
      if (previewMode || getTenantActionEntitlement(renderState, 'can_manage_donations')?.locked) {
        disableActionNodes(
          [createButton, ...saveButtons, ...deleteButtons, ...toggleButtons],
          previewMode ? 'Preview mode cannot manage donation packages.' : manageLockReason,
        );
        return;
      }

    createForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(createForm);
      const tenantId = getRenderTenantId(renderState);
      const id = String(formData.get('id') || '').trim();
      const name = String(formData.get('name') || '').trim();
      const kind = String(formData.get('kind') || 'item').trim();
      const price = Number(formData.get('price') || 0) || 0;
      const description = String(formData.get('description') || '').trim();
      const gameItemId = String(formData.get('gameItemId') || '').trim();
      const quantity = Number(formData.get('quantity') || 1) || 1;
      if (!tenantId || !id || !name || !description || price <= 0) {
        setStatus('Provide id, name, price, and description before creating a donation package.', 'warning');
        return;
      }
      if (kind === 'item' && !gameItemId) {
        setStatus('Item-based donation packages still need a SCUM game item id.', 'warning');
        return;
      }
      setActionButtonBusy(createButton, true, 'Creating...');
      try {
        await apiRequest('/admin/api/shop/add', {
          method: 'POST',
          body: {
            tenantId,
            id,
            name,
            kind,
            price,
            description,
            gameItemId: kind === 'item' ? gameItemId : null,
            quantity: kind === 'item' ? quantity : 1,
            status: 'active',
          },
        }, null);
        createForm.reset();
        const kindField = createForm.querySelector('[name="kind"]');
        const quantityField = createForm.querySelector('[name="quantity"]');
        if (kindField) kindField.value = 'item';
        if (quantityField) quantityField.value = '1';
        setStatus(`Donation package ${name} created.`, 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(createButton, false);
      }
    });

    saveButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const tenantId = getRenderTenantId(renderState);
        const itemId = String(button.getAttribute('data-item-id') || '').trim();
        const card = button.closest('[data-tenant-donation-card]');
        if (!tenantId || !itemId || !card) return;
        const payload = {
          tenantId,
          idOrName: itemId,
          name: String(card.querySelector('[data-tenant-donation-name]')?.value || '').trim(),
          kind: String(card.querySelector('[data-tenant-donation-kind]')?.value || 'item').trim(),
          price: Number(card.querySelector('[data-tenant-donation-price]')?.value || 0) || 0,
          description: String(card.querySelector('[data-tenant-donation-description]')?.value || '').trim(),
          gameItemId: String(card.querySelector('[data-tenant-donation-game-item-id]')?.value || '').trim(),
          quantity: Number(card.querySelector('[data-tenant-donation-quantity]')?.value || 1) || 1,
        };
        if (!payload.name || !payload.description || payload.price <= 0) {
          setStatus('Name, price, and description are required before saving the package.', 'warning');
          return;
        }
        if (payload.kind === 'item' && !payload.gameItemId) {
          setStatus('Item-based donation packages still need a SCUM game item id.', 'warning');
          return;
        }
        setActionButtonBusy(button, true, 'Saving...');
        try {
          await apiRequest('/admin/api/shop/update', {
            method: 'POST',
            body: payload,
          }, null);
          setStatus(`Donation package ${itemId} saved.`, 'success');
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });

      deleteButtons.forEach((button) => {
        button.addEventListener('click', async () => {
        const tenantId = getRenderTenantId(renderState);
        const itemId = String(button.getAttribute('data-item-id') || '').trim();
        if (!tenantId || !itemId) return;
        if (!window.confirm(`Delete donation package ${itemId}?`)) {
          return;
        }
        setActionButtonBusy(button, true, 'Deleting...');
        try {
          await apiRequest('/admin/api/shop/delete', {
            method: 'POST',
            body: {
              tenantId,
              idOrName: itemId,
            },
          }, null);
          setStatus(`Donation package ${itemId} deleted.`, 'success');
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
        });
      });

      toggleButtons.forEach((button) => {
        button.addEventListener('click', async () => {
          const tenantId = getRenderTenantId(renderState);
          const itemId = String(button.getAttribute('data-item-id') || '').trim();
          const nextStatus = String(button.getAttribute('data-next-status') || '').trim().toLowerCase();
          if (!tenantId || !itemId || !nextStatus) return;
          const confirmMessage = nextStatus === 'disabled'
            ? `Disable donation package ${itemId}?`
            : `Enable donation package ${itemId}?`;
          if (!window.confirm(confirmMessage)) {
            return;
          }
          setActionButtonBusy(button, true, nextStatus === 'disabled' ? 'Disabling...' : 'Enabling...');
          try {
            await apiRequest('/admin/api/shop/status', {
              method: 'POST',
              body: {
                tenantId,
                idOrName: itemId,
                status: nextStatus,
              },
            }, null);
            setStatus(
              nextStatus === 'disabled'
                ? `Donation package ${itemId} disabled.`
                : `Donation package ${itemId} enabled.`,
              'success',
            );
            await refreshState({ silent: true });
          } catch (error) {
            setStatus(String(error?.message || error), 'danger');
          } finally {
            setActionButtonBusy(button, false);
          }
        });
      });
    }

  function wirePageInteractions(page, renderState, surfaceState) {
    if (page === 'onboarding') {
      return;
    }
    if (page === 'server-status') {
      wireServerStatusPage(renderState, surfaceState);
      return;
    }
    if (page === 'restart-control') {
      wireRestartControlPage(renderState, surfaceState);
      return;
    }
    if (page === 'server-config') {
      wireServerConfigPage(renderState, surfaceState);
      return;
    }
    if (page === 'logs-sync') {
      wireLogsSyncPage(renderState, surfaceState);
      return;
    }
    if (page === 'orders') {
      wireOrdersPage(renderState, surfaceState);
      return;
    }
    if (page === 'donations') {
      wireDonationsPage(renderState, surfaceState);
      return;
    }
    if (page === 'events') {
      wireEventsPage(renderState, surfaceState);
      return;
    }
    if (page === 'modules') {
      wireModulesPage(renderState, surfaceState);
      return;
    }
    if (page === 'players') {
      wirePlayersPage(renderState, surfaceState);
      return;
    }
    if (page === 'staff' || page === 'roles') {
      wirePlayersPage(renderState, surfaceState);
      return;
    }
    if (page === 'settings') {
      wireSettingsPage(renderState, surfaceState);
      wireServerBotDiscordLinksPage(renderState, surfaceState);
      return;
    }
    if (page === 'billing') {
      wireBillingPage(renderState);
      return;
    }
    if (page === 'delivery-agents') {
      wireRuntimeProvisioningPage('delivery-agents', renderState, surfaceState);
      return;
    }
    if (page === 'server-bots') {
      wireRuntimeProvisioningPage('server-bots', renderState, surfaceState);
      wireServerBotProbeActions(renderState, surfaceState);
      wireServerBotDiscordLinksPage(renderState, surfaceState);
    }
  }

  function wirePlayersPage(renderState, surfaceState) {
    const previewMode = isSurfacePreview(surfaceState, renderState);
    const managePlayersLocked = Boolean(getTenantActionEntitlement(renderState, 'can_manage_players')?.locked)
      || !hasTenantPermission(renderState, 'manage_players');
    const managePlayersLockReason = !hasTenantPermission(renderState, 'manage_players')
      ? getTenantPermissionLockReason(
        renderState,
        'manage_players',
        'Your tenant role cannot run player management actions.',
      )
      : getTenantActionLockReason(
        renderState,
        'can_manage_players',
        'Player management tools are locked in the current package.',
      );
    const manageStaffLocked = Boolean(getTenantActionEntitlement(renderState, 'can_manage_staff')?.locked)
      || !hasTenantPermission(renderState, 'manage_staff');
    const manageStaffLockReason = !hasTenantPermission(renderState, 'manage_staff')
      ? getTenantPermissionLockReason(
        renderState,
        'manage_staff',
        'Your tenant role cannot manage staff access.',
      )
      : getTenantActionLockReason(
        renderState,
        'can_manage_staff',
        'Staff management is locked in the current package.',
      );
    const tenantId = String(renderState?.tenantId || '').trim();
    const inviteForm = document.querySelector('[data-tenant-staff-invite-form]');
    const inviteButton = inviteForm?.querySelector('[data-tenant-staff-invite-submit]');
    const playerSelectButtons = Array.from(document.querySelectorAll('[data-tenant-player-select]'));
    const playerOrderButtons = Array.from(document.querySelectorAll('[data-tenant-player-open-orders]'));
    const playerSupportButtons = Array.from(document.querySelectorAll('[data-tenant-player-identity-action]'));
    const playerSupportForm = document.querySelector('[data-tenant-player-support-form]');
    const playerSupportSubmit = playerSupportForm?.querySelector('[data-tenant-player-support-submit]');
    const playerSupportActionField = playerSupportForm?.querySelector('[data-tenant-player-support-action]');
    const playerSupportIntentField = playerSupportForm?.querySelector('[name="supportIntent"]');
    const playerSupportOutcomeField = playerSupportForm?.querySelector('[name="supportOutcome"]');
    const playerSupportFollowupField = playerSupportForm?.querySelector('[name="followupAction"]');
    const playerSupportSteamField = playerSupportForm?.querySelector('[data-tenant-player-support-steam]');

    playerSelectButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const userId = String(button.getAttribute('data-tenant-player-select') || '').trim();
        if (!userId) return;
        writeUserIdToUrl(userId);
        await refreshState({ silent: true });
        setStatus(`เปิดบริบทของผู้เล่น ${userId} แล้ว`, 'success');
      });
    });

    playerOrderButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const userId = String(button.getAttribute('data-tenant-player-open-orders') || '').trim();
        if (!userId) return;
        writePurchaseFiltersToUrl(userId, '');
        window.location.assign(buildCanonicalTenantHref('orders', { userId }));
      });
    });

    playerSupportButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const requestedAction = String(button.getAttribute('data-tenant-player-identity-action') || '').trim().toLowerCase();
        const userId = String(
          button.getAttribute('data-tenant-player-user-id')
          || renderState?.selectedUserId
          || '',
        ).trim();
        const reason = String(
          button.getAttribute('data-tenant-player-support-reason')
          || renderState?.selectedSupportReason
          || '',
        ).trim();
        const source = String(
          button.getAttribute('data-tenant-player-support-source')
          || renderState?.selectedSupportSource
          || 'tenant',
        ).trim();
        const outcome = normalizeIdentitySupportOutcome(
          button.getAttribute('data-tenant-player-support-outcome')
          || renderState?.selectedSupportOutcome
          || 'reviewing',
        );
        if (!userId) return;
        writePlayerIdentityWorkflowToUrl(userId, requestedAction, reason, source, outcome);
        const normalizedIntent = normalizeIdentitySupportIntent(
          requestedAction,
          renderState?.selectedIdentityAction,
        );
        if (playerSupportActionField) {
          playerSupportActionField.value = resolveIdentitySupportFormAction(normalizedIntent);
        }
        if (playerSupportIntentField) {
          playerSupportIntentField.value = normalizedIntent;
        }
        if (playerSupportOutcomeField) {
          playerSupportOutcomeField.value = outcome;
        }
        if (playerSupportFollowupField) {
          playerSupportFollowupField.value = resolveIdentityFollowupAction(
            normalizedIntent,
            resolveIdentitySupportFormAction(normalizedIntent),
          );
        }
        if (playerSupportSteamField && resolveIdentitySupportFormAction(normalizedIntent) === 'set') {
          playerSupportSteamField.focus();
          playerSupportSteamField.select?.();
        } else {
          scrollToNode('[data-tenant-player-support-form]');
        }
        const nextLabel = describeIdentitySupportIntent(normalizedIntent);
        setStatus(`${nextLabel} สำหรับ ${userId}`, 'info');
      });
    });

    playerSupportActionField?.addEventListener('change', () => {
      const selectedAction = String(playerSupportActionField.value || 'review').trim().toLowerCase();
      const currentIntent = normalizeIdentitySupportIntent(
        playerSupportIntentField?.value,
        renderState?.selectedIdentityAction,
      );
      const nextIntent = ['relink', 'conflict'].includes(currentIntent)
        ? currentIntent
        : (selectedAction === 'remove' ? 'unlink' : selectedAction === 'set' ? 'bind' : 'review');
      if (playerSupportIntentField) {
        playerSupportIntentField.value = nextIntent;
      }
      if (playerSupportFollowupField) {
        playerSupportFollowupField.value = resolveIdentityFollowupAction(nextIntent, selectedAction);
      }
      if (selectedAction === 'set') {
        playerSupportSteamField?.focus();
        playerSupportSteamField?.select?.();
      }
    });

    if (previewMode || managePlayersLocked) {
      disableActionNodes(
        [
          playerSupportSubmit,
          ...Array.from(document.querySelectorAll('[data-tenant-player-support-form] input, [data-tenant-player-support-form] select, [data-tenant-player-support-form] textarea')),
          ...playerSupportButtons,
        ],
        previewMode ? 'Preview tenants cannot change player identity yet.' : managePlayersLockReason,
      );
    }

    playerSupportForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (previewMode || managePlayersLocked) {
        setStatus(previewMode ? 'Preview tenants cannot change player identity yet.' : managePlayersLockReason, 'warning');
        return;
      }
      const formData = new FormData(playerSupportForm);
      const action = String(formData.get('action') || 'review').trim().toLowerCase();
      const userId = String(formData.get('userId') || '').trim();
      const steamId = String(formData.get('steamId') || '').trim();
      const inGameName = String(formData.get('inGameName') || '').trim();
      const supportIntent = normalizeIdentitySupportIntent(
        formData.get('supportIntent'),
        action === 'remove' ? 'unlink' : action === 'set' ? 'bind' : 'review',
      );
      const followupAction = resolveIdentityFollowupAction(
        supportIntent,
        action,
        formData.get('followupAction'),
      );
      const supportReason = String(formData.get('supportReason') || '').trim();
      const supportSource = String(
        formData.get('supportSource')
        || renderState?.selectedSupportSource
        || 'tenant',
      ).trim() || 'tenant';
      const supportOutcome = normalizeIdentitySupportOutcome(
        formData.get('supportOutcome')
        || renderState?.selectedSupportOutcome
        || 'reviewing',
      );
      if (!userId) {
        setStatus('เลือกผู้เล่นก่อนทำ identity support action', 'warning');
        return;
      }
      if (action === 'set' && !steamId) {
        setStatus('ต้องกรอก Steam ID ก่อนผูกบัญชีให้ผู้เล่น', 'warning');
        playerSupportSteamField?.focus();
        return;
      }
      const identityRoute = action === 'remove'
        ? '/admin/api/player/steam/unbind'
        : action === 'set'
          ? '/admin/api/player/steam/bind'
          : '/admin/api/player/identity/review';
      setActionButtonBusy(
        playerSupportSubmit,
        true,
        action === 'remove' ? 'Unlinking...' : action === 'set' ? 'Binding...' : 'Recording...',
      );
      try {
        await apiRequest(identityRoute, {
          method: 'POST',
          body: action === 'remove'
            ? {
              tenantId,
              userId,
              steamId,
              supportIntent,
              supportOutcome,
              supportReason,
              supportSource,
              followupAction,
            }
            : action === 'set'
              ? {
              tenantId,
              userId,
              steamId,
              inGameName,
              supportIntent,
              supportOutcome,
              supportReason,
              supportSource,
              followupAction,
            }
              : {
              tenantId,
              userId,
              steamId,
              inGameName,
              supportIntent,
              supportOutcome,
              supportReason,
              supportSource,
              followupAction,
            },
        });
        const nextIdentityAction = resolveIdentityFollowupAction(supportIntent, action, followupAction);
        writePlayerIdentityWorkflowToUrl(
          userId,
          nextIdentityAction,
          supportReason,
          supportSource,
          supportOutcome,
        );
        setStatus(buildIdentitySupportSuccessMessage(supportIntent, action, userId, followupAction), 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(playerSupportSubmit, false);
      }
    });

    if (previewMode || manageStaffLocked) {
      disableActionNodes(
        [
          inviteButton,
          ...Array.from(document.querySelectorAll('[data-tenant-staff-role-update]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-revoke]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-role]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-status]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-revoke-reason]')),
          ...Array.from(document.querySelectorAll('[data-tenant-staff-invite-form] input, [data-tenant-staff-invite-form] select')),
        ],
        previewMode ? 'Preview mode cannot change staff access yet.' : manageStaffLockReason,
      );
    }

    inviteForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (previewMode || manageStaffLocked) {
        setStatus(previewMode ? 'Preview tenants cannot invite staff yet.' : manageStaffLockReason, 'warning');
        return;
      }
      const formData = new FormData(inviteForm);
      const email = String(formData.get('email') || '').trim();
      if (!email) {
        setStatus('Email is required to invite tenant staff.', 'warning');
        return;
      }
      const roleField = inviteForm.querySelector('[name="role"]');
      const localeField = inviteForm.querySelector('[name="locale"]');
      setActionButtonBusy(inviteButton, true, 'Inviting...');
      try {
        await apiRequest('/admin/api/platform/tenant-staff', {
          method: 'POST',
          body: {
            tenantId,
            email,
            displayName: String(formData.get('displayName') || '').trim(),
            role: String(formData.get('role') || roleField?.value || 'staff').trim(),
            locale: String(formData.get('locale') || localeField?.value || 'en').trim(),
          },
        });
        inviteForm.reset();
        if (roleField) {
          const defaultOption = roleField.querySelector('option');
          roleField.value = defaultOption ? String(defaultOption.value || 'staff').trim() : 'staff';
        }
        if (localeField) localeField.value = 'en';
        setStatus('Tenant staff invitation created.', 'success');
        await refreshState({ silent: true });
      } catch (error) {
        setStatus(String(error?.message || error), 'danger');
      } finally {
        setActionButtonBusy(inviteButton, false);
      }
    });

    document.querySelectorAll('[data-tenant-staff-role-update]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (previewMode || manageStaffLocked) {
          setStatus(previewMode ? 'Preview tenants cannot change staff access yet.' : manageStaffLockReason, 'warning');
          return;
        }
        const card = button.closest('[data-tenant-staff-card]');
        if (!card) return;
        const rowManageable = String(card.getAttribute('data-tenant-staff-manageable') || '').trim() === 'true';
        const rowManageReason = String(card.getAttribute('data-tenant-staff-manage-reason') || '').trim();
        if (!rowManageable) {
          setStatus(rowManageReason || 'This tenant role cannot change the selected membership.', 'warning');
          return;
        }
        const membershipId = String(card.getAttribute('data-membership-id') || '').trim();
        const userId = String(card.getAttribute('data-user-id') || '').trim();
        const role = String(card.querySelector('[data-tenant-staff-role]')?.value || 'viewer').trim();
        const status = String(card.querySelector('[data-tenant-staff-status]')?.value || 'active').trim();
        setActionButtonBusy(button, true, 'Saving...');
        try {
          await apiRequest('/admin/api/platform/tenant-staff/role', {
            method: 'POST',
            body: {
              tenantId,
              membershipId,
              userId,
              role,
              status,
            },
          });
          setStatus('Tenant staff access updated.', 'success');
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });

    document.querySelectorAll('[data-tenant-staff-revoke]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (previewMode || manageStaffLocked) {
          setStatus(previewMode ? 'Preview tenants cannot revoke staff access yet.' : manageStaffLockReason, 'warning');
          return;
        }
        const card = button.closest('[data-tenant-staff-card]');
        if (!card) return;
        const rowManageable = String(card.getAttribute('data-tenant-staff-manageable') || '').trim() === 'true';
        const rowManageReason = String(card.getAttribute('data-tenant-staff-manage-reason') || '').trim();
        if (!rowManageable) {
          setStatus(rowManageReason || 'This tenant role cannot remove the selected membership.', 'warning');
          return;
        }
        const membershipId = String(card.getAttribute('data-membership-id') || '').trim();
        const userId = String(card.getAttribute('data-user-id') || '').trim();
        const revokeReason = String(card.querySelector('[data-tenant-staff-revoke-reason]')?.value || '').trim();
        if (!window.confirm('Revoke access for this tenant staff member?')) {
          return;
        }
        setActionButtonBusy(button, true, 'Revoking...');
        try {
          await apiRequest('/admin/api/platform/tenant-staff/revoke', {
            method: 'POST',
            body: {
              tenantId,
              membershipId,
              userId,
              revokeReason,
            },
          });
          setStatus('Tenant staff access revoked.', 'success');
          await refreshState({ silent: true });
        } catch (error) {
          setStatus(String(error?.message || error), 'danger');
        } finally {
          setActionButtonBusy(button, false);
        }
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.getElementById('tenantV4RefreshBtn');
    refreshButton?.addEventListener('click', () => refreshState({ silent: false }));
    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element
        ? event.target.closest('a[href^="#"], a[href^="/tenant"]')
        : null;
      if (!link) return;
      const target = String(link.getAttribute('href') || '').trim();
      if (!target || target === '#') return;
      if (target.startsWith('#')) {
        const hashTarget = target.replace(/^#/, '').trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(PAGE_ALIASES, hashTarget)) return;
      }
      if (!target.startsWith('#') && !target.startsWith('/tenant')) return;
      navigateTenantRoute(target);
      event.preventDefault();
    });
    window.addEventListener('popstate', () => {
      const surfaceState = renderCurrentPage();
      if (!surfaceState?.notice) {
        setStatus(t('tenant.app.status.ready', 'Ready'), 'success');
      }
    });
    window.addEventListener('ui-language-change', () => {
      const surfaceState = renderCurrentPage();
      if (!surfaceState?.notice && state.payload && !state.refreshing) {
        setStatus(t('tenant.app.status.ready', 'Ready'), 'success');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshState({ silent: true });
    });
    window.setInterval(() => {
      if (!document.hidden) refreshState({ silent: true });
    }, 60000);
    bootstrapLegacyTenantRoute();
    refreshState({ silent: false });
  });
})();

