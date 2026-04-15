(function () {
  'use strict';

  const PAGE_ALIASES = {
    '': 'dashboard',
    overview: 'dashboard',
    dashboard: 'dashboard',
    tenants: 'tenants',
    packages: 'tenants',
    'packages-create': 'tenants',
    'packages-entitlements': 'tenants',
    'package-detail': 'tenants',
    subscriptions: 'tenants',
    'subscriptions-registry': 'tenants',
    'subscription-detail': 'tenants',
    billing: 'tenants',
    'billing-recovery': 'tenants',
    'billing-attempts': 'tenants',
    'invoice-detail': 'tenants',
    'attempt-detail': 'tenants',
    commercial: 'tenants',
    quota: 'tenants',
    fleet: 'runtime',
    'fleet-assets': 'runtime',
    incidents: 'runtime',
    observability: 'runtime',
    jobs: 'runtime',
    audit: 'runtime',
    security: 'runtime',
    support: 'runtime',
    control: 'runtime',
    access: 'runtime',
    recovery: 'runtime',
    'recovery-create': 'runtime',
    'recovery-preview': 'runtime',
    'recovery-restore': 'runtime',
    'recovery-history': 'runtime',
    runtime: 'runtime',
    'runtime-health': 'runtime',
    'runtime-create-server': 'runtime',
    'runtime-provision-runtime': 'runtime',
    'agents-bots': 'runtime',
    'fleet-diagnostics': 'runtime',
    settings: 'dashboard',
    automation: 'dashboard',
    diagnostics: 'runtime',
    analytics: 'runtime',
    'analytics-risk': 'runtime',
    'analytics-packages': 'runtime',
    'settings-admin-users': 'dashboard',
    'settings-services': 'dashboard',
    'settings-access-policy': 'dashboard',
    'settings-portal-policy': 'dashboard',
    'settings-billing-policy': 'dashboard',
    'settings-runtime-policy': 'dashboard',
  };

  const PATH_PAGE_ALIASES = {
    '': 'overview',
    dashboard: 'overview',
    tenants: 'tenants',
    packages: 'packages',
    subscriptions: 'subscriptions',
    runtime: 'runtime',
    recovery: 'recovery',
    analytics: 'analytics',
    audit: 'audit',
    settings: 'settings',
    automation: 'automation',
    billing: 'billing',
    access: 'access',
    diagnostics: 'diagnostics',
    control: 'control',
    support: 'support',
  };

  const PAGE_TITLE_KEYS = {
    dashboard: 'owner.app.page.dashboard',
    tenants: 'owner.app.page.tenants',
    runtime: 'owner.app.page.runtime',
  };

  const ROUTE_TITLE_FALLBACKS = {
    dashboard: 'ภาพรวมระบบ',
    overview: 'ภาพรวมระบบ',
    tenants: 'ลูกค้าและแพ็กเกจ',
    packages: 'แพ็กเกจและสิทธิ์ใช้งาน',
    subscriptions: 'การสมัครใช้และการต่ออายุ',
    billing: 'การเงินและการต่ออายุ',
    runtime: 'สถานะระบบและเหตุการณ์',
    'runtime-health': 'สถานะระบบและเหตุการณ์',
    'agents-bots': 'การจัดการ Agent และ Bot',
    'fleet-diagnostics': 'สถานะฟลีตและการวินิจฉัย',
    incidents: 'เหตุการณ์และสัญญาณ',
    observability: 'คำขอและความช้า',
    jobs: 'งานรอและบอท',
      support: 'งานดูแลลูกค้า',
    security: 'ความปลอดภัย',
    audit: 'หลักฐานและบันทึก',
    settings: 'ตั้งค่า',
  };

  const OWNER_ROUTE_PRESENTATION = {
    overview: {
      workspaceLabel: 'ศูนย์ควบคุมแพลตฟอร์ม',
      kicker: 'ศูนย์ควบคุมเจ้าของระบบ',
      title: 'ภาพรวมเจ้าของระบบ',
      subtitle: 'ดูลูกค้า รายได้ สุขภาพระบบ และเรื่องที่ควรจัดการก่อนจากหน้าเดียว',
      primaryAction: { label: 'เปิดรายชื่อลูกค้า', href: '#tenants' },
      railHeader: 'บริบทเจ้าของระบบ',
      railCopy: 'ดูรายได้ งานดูแลลูกค้า และจุดเสี่ยงได้จากด้านขวา',
    },
    settings: {
      workspaceLabel: 'ตั้งค่าและนโยบาย',
      kicker: 'ตั้งค่าและนโยบาย',
      title: 'ตั้งค่าและนโยบาย',
      subtitle: 'ทบทวนกติกา สิทธิ์ และมาตรฐานที่ต้องใช้ตรงกันทั้งแพลตฟอร์ม',
      primaryAction: { label: 'เปิดบันทึกออดิท', href: '#audit' },
      railHeader: 'บริบทนโยบาย',
      railCopy: 'เก็บเรื่องสิทธิ์ หลักฐาน และแนวทางดูแลลูกค้าไว้ในมุมเดียวกัน',
      sectionTitles: {
        settings: {
          title: 'นโยบายและเครื่องมือที่ควรเปิดต่อ',
          copy: 'เริ่มจากกติกาที่กระทบลูกค้าหลายรายก่อน แล้วค่อยไล่งานเชิงปฏิบัติการ',
        },
      },
    },
    tenants: {
      workspaceLabel: 'ทะเบียนลูกค้า',
      kicker: 'ทะเบียนลูกค้าและสถานะเชิงพาณิชย์',
      title: 'ลูกค้าและสถานะเชิงพาณิชย์',
      subtitle: 'ดูแพ็กเกจ การต่ออายุ โควตา และบริบทลูกค้าจากหน้าเดียว',
      primaryAction: { label: 'สร้างลูกค้ารายใหม่', href: '#create-tenant' },
      railHeader: 'บริบทเจ้าของระบบ',
      railCopy: 'เก็บงานดูแลลูกค้าและงานเชิงพาณิชย์ไว้ใกล้ทะเบียนลูกค้า',
    },
    packages: {
      workspaceLabel: 'แพ็กเกจและสิทธิ์ใช้งาน',
      kicker: 'แพ็กเกจและสิทธิ์ใช้งาน',
      title: 'แพ็กเกจและสิทธิ์ใช้งาน',
      subtitle: 'ทบทวนว่าลูกค้าแต่ละรายอยู่แผนใด และได้สิทธิ์อะไรบ้างก่อนเปลี่ยนแพ็กเกจ',
      primaryAction: { label: 'ดูการสมัครใช้', href: '#subscriptions' },
      railHeader: 'บริบทแพ็กเกจ',
      railCopy: 'เริ่มจากแผนที่ใช้อยู่จริง แล้วค่อยตามเรื่องการต่ออายุและโควตา',
      sectionTitles: {
        packages: {
      title: 'รายชื่อลูกค้าตามแพ็กเกจ',
      copy: 'เปิดดูจากทะเบียนเดียวกันได้เลยว่าลูกค้ารายไหนอยู่แผนใด และควรย้ายหรือคงแผนเดิม',
        },
      },
    },
    subscriptions: {
      workspaceLabel: 'การสมัครใช้และการต่ออายุ',
      kicker: 'การสมัครใช้และการต่ออายุ',
      title: 'การสมัครใช้และการต่ออายุ',
      subtitle: 'โฟกัสรายการที่ใกล้ต่ออายุ หมดอายุ หรือเสี่ยงสะดุดบริการก่อนเรื่องอื่น',
      primaryAction: { label: 'ดูรายการใกล้ต่ออายุ', href: '#subscriptions' },
      railHeader: 'บริบทการต่ออายุ',
      railCopy: 'เริ่มจากลูกค้าที่ใกล้หมดอายุก่อน เพื่อไม่ให้ทีมดูแลลูกค้ารับแรงกระแทก',
      sectionTitles: {
        packages: {
      title: 'รายชื่อลูกค้าที่ต้องตามเรื่องการสมัครใช้',
          copy: 'ใช้ตารางนี้คัดรายที่ต้องทบทวนเรื่องการต่ออายุ แพ็กเกจ และสิทธิ์ใช้งานในรอบเดียว',
        },
      },
    },
    billing: {
      workspaceLabel: 'การเงินและการต่ออายุ',
      kicker: 'การเงินและการต่ออายุ',
      title: 'การเงินและการต่ออายุ',
      subtitle: 'รวมรายการที่กระทบรายได้ การต่ออายุ และโควตาไว้ในมุมเดียว',
      primaryAction: { label: 'เปิดรายการเสี่ยงรายได้', href: '#billing' },
      railHeader: 'บริบทการเงิน',
      railCopy: 'มุมนี้ใช้ตัดสินใจเรื่องต่ออายุ รายได้ และลูกค้าที่เริ่มชนขอบความเสี่ยง',
      sectionTitles: {
        billing: {
          title: 'เริ่มจากเรื่องที่กระทบรายได้ก่อน',
          copy: 'โฟกัสกับรายที่หมดอายุ ใกล้ต่ออายุ หรือเริ่มชนโควตาก่อนงานเชิงสำรวจอื่น',
        },
      },
    },
    'create-tenant': {
      workspaceLabel: 'สร้างลูกค้ารายใหม่',
      kicker: 'สร้างลูกค้ารายใหม่',
      title: 'สร้างลูกค้ารายใหม่',
      subtitle: 'เริ่มจากข้อมูลหลักของลูกค้า แล้วค่อยผูกแพ็กเกจ การสมัครใช้ และงานดูแลลูกค้าต่อ',
      primaryAction: { label: 'กลับไปดูทะเบียนลูกค้า', href: '#tenants' },
      railHeader: 'บริบทการเริ่มต้นใช้งาน',
      railCopy: 'เมื่อสร้างลูกค้าเสร็จ ให้ตามด้วยแพ็กเกจ การสมัครใช้ และการตั้งค่าที่จำเป็น',
    },
    support: {
      workspaceLabel: 'งานดูแลลูกค้าแพลตฟอร์ม',
      kicker: 'งานดูแลลูกค้าแพลตฟอร์ม',
      title: 'งานดูแลลูกค้าแพลตฟอร์ม',
      subtitle: 'เริ่มจากลูกค้าและเรื่องที่กำลังคุยอยู่ แล้วค่อยไล่หลักฐานและบริบทระบบต่อ',
      primaryAction: { label: 'เปิดเหตุการณ์ล่าสุด', href: '#incidents' },
      railHeader: 'บริบทงานดูแลลูกค้า',
      railCopy: 'เก็บบริบทของลูกค้า หลักฐาน และเรื่องเชิงพาณิชย์ไว้ใกล้กันเพื่อให้คุยกับลูกค้าได้ต่อเนื่อง',
      sectionTitles: {
        incidents: {
          title: 'เคสงานดูแลลูกค้าและสัญญาณล่าสุด',
          copy: 'เริ่มจาก feed นี้ก่อนเปิดเครื่องมือย้อนเหตุการณ์หรือวินิจฉัยระบบ เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่า',
        },
      },
    },
    security: {
      workspaceLabel: 'ความปลอดภัยแพลตฟอร์ม',
      kicker: 'ความปลอดภัยแพลตฟอร์ม',
      title: 'ความปลอดภัยแพลตฟอร์ม',
      subtitle: 'ทบทวนสิทธิ์ การเข้าถึง และสัญญาณที่ต้องยืนยันก่อนลงมือ',
      primaryAction: { label: 'เปิดบันทึกออดิท', href: '#audit' },
      railHeader: 'บริบทความปลอดภัย',
      railCopy: 'งานด้านสิทธิ์ การเข้าถึง และหลักฐานควรถูกวางคู่กับบริบทของเหตุการณ์เสมอ',
      sectionTitles: {
        incidents: {
          title: 'สัญญาณด้านความปลอดภัยและงานดูแลลูกค้า',
          copy: 'ใช้ feed นี้แยกเรื่องสิทธิ์และเหตุผิดปกติออกจากงานดูแลลูกค้าทั่วไป เพื่อไม่ให้ประเด็นสำคัญหลุด',
        },
      },
    },
    runtime: {
      workspaceLabel: 'สถานะระบบ',
      kicker: 'โต๊ะปฏิบัติการและเหตุการณ์',
      title: 'สถานะระบบและเหตุการณ์',
      subtitle: 'ดูความพร้อมของบริการ สัญญาณผิดปกติ และแรงกดดันของคำขอในมุมเดียว',
      primaryAction: { label: 'เปิดคำขอและความช้า', href: '#observability' },
      railHeader: 'บริบทการปฏิบัติการ',
      railCopy: 'เก็บหลักฐานและงานติดตามของเจ้าของระบบไว้ใกล้มือเสมอขณะตรวจบริการหรือเหตุการณ์',
    },
    'runtime-health': {
      workspaceLabel: 'สถานะระบบ',
      kicker: 'โต๊ะปฏิบัติการและเหตุการณ์',
      title: 'สถานะบริการ',
      subtitle: 'ดูว่าบริการใดพร้อม บริการใดยังต้องจับตา และบอทตัวใดเริ่มไม่เสถียร',
      primaryAction: { label: 'เปิดคำขอและความช้า', href: '#observability' },
      railHeader: 'บริบทการปฏิบัติการ',
      railCopy: 'เก็บหลักฐานและงานติดตามของเจ้าของระบบไว้ใกล้มือเสมอขณะตรวจบริการหรือเหตุการณ์',
    },
    'agents-bots': {
      workspaceLabel: 'Agent & Bot registry',
      kicker: 'Agent & Bot registry',
      title: 'Agent & Bot registry',
      subtitle: 'Separate Delivery Agent provisioning and Server Bot inventory from the rest of the runtime workspace.',
      primaryAction: { label: 'Open runtime registry', href: '/owner/runtime/agents-bots' },
      railHeader: 'Runtime registry',
      railCopy: 'Keep server records, setup tokens, and bound runtimes together when reviewing the active delivery and server fleet.',
    },
    'fleet-diagnostics': {
      workspaceLabel: 'Fleet diagnostics',
      kicker: 'Fleet diagnostics',
      title: 'Fleet diagnostics',
      subtitle: 'Review activation drift, health signals, and runtime mismatches before opening shared recovery tools.',
      primaryAction: { label: 'Open fleet diagnostics', href: '/owner/runtime/fleet-diagnostics' },
      railHeader: 'Fleet diagnostics',
      railCopy: 'Use this route to inspect runtime health separately from provisioning and recovery actions.',
    },
    incidents: {
      workspaceLabel: 'เหตุการณ์และสัญญาณ',
      kicker: 'เหตุการณ์และสัญญาณ',
      title: 'เหตุการณ์และสัญญาณ',
      subtitle: 'เปิดดูสัญญาณที่ใหม่และรุนแรงที่สุดก่อน เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่า',
      primaryAction: { label: 'เปิดรายการเหตุการณ์', href: '#incidents' },
      railHeader: 'บริบทเหตุการณ์',
      railCopy: 'ให้เหตุการณ์ หลักฐาน และบริการที่เกี่ยวกันอยู่ในมุมเดียวเพื่อช่วยตัดสินใจได้เร็ว',
      sectionTitles: {
        incidents: {
          title: 'สัญญาณที่เจ้าของระบบควรรู้ตอนนี้',
          copy: 'เริ่มจาก feed นี้ก่อนเปิดงานดูแลลูกค้าหรือเครื่องมือย้อนเหตุการณ์ เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่า',
        },
      },
    },
    observability: {
      workspaceLabel: 'คำขอและความช้า',
      kicker: 'คำขอและความช้า',
      title: 'คำขอและความช้า',
      subtitle: 'ไล่จุดร้อน ข้อผิดพลาด และความช้าของระบบก่อนตัดสินใจแก้ปัญหา',
      primaryAction: { label: 'เปิดจุดร้อนของคำขอ', href: '#observability' },
      railHeader: 'บริบทคำขอ',
      railCopy: 'รวมคำขอที่ช้า ข้อผิดพลาด และแนวทางเช็กต่อไว้ในชุดเดียว',
      sectionTitles: {
        observability: {
          title: 'จุดร้อนของคำขอ',
          copy: 'สรุปคำขอแบบกะทัดรัดช่วยให้เจ้าของระบบตัดสินใจได้เร็วกว่าการมองกราฟใหญ่เต็มหน้า',
        },
      },
    },
    jobs: {
      workspaceLabel: 'งานรอและบอท',
      kicker: 'งานรอและบอท',
      title: 'งานรอและบอท',
      subtitle: 'แยกงานส่งของ งานที่ล้มเหลว และรายชื่อบอทให้ดูง่ายจากมุมเดียว',
      primaryAction: { label: 'เปิดรายชื่อบอท', href: '#jobs' },
      railHeader: 'บริบทงานคิว',
      railCopy: 'ให้สถานะของบอทส่งของและบอทเซิร์ฟเวอร์มองเห็นได้ตลอด โดยไม่ปนกับมุมมองงานประจำวันของลูกค้า',
      sectionTitles: {
        jobs: {
          title: 'ทะเบียนเอเจนต์และคิวที่ต้องตามต่อ',
          copy: 'ให้สถานะของบอทส่งของและบอทเซิร์ฟเวอร์มองเห็นได้ตลอด โดยไม่ปนกับมุมมองงานประจำวันของลูกค้า',
        },
      },
    },
    audit: {
      workspaceLabel: 'หลักฐานและบันทึก',
      kicker: 'หลักฐานและบันทึก',
      title: 'หลักฐานและบันทึก',
      subtitle: 'ย้อนดูหลักฐาน คำขอ และสัญญาณที่ต้องเก็บไว้ก่อนลงมือทำเรื่องเสี่ยง',
      primaryAction: { label: 'เปิดคำขอและความช้า', href: '#observability' },
      railHeader: 'บริบทหลักฐาน',
      railCopy: 'งานดูแลลูกค้าและงานรีวิวความปลอดภัยควรใช้หลักฐานชุดเดียวกัน',
      sectionTitles: {
        observability: {
          title: 'หลักฐานของคำขอและจุดร้อน',
          copy: 'ใช้ส่วนนี้เก็บบริบทของ request, latency และข้อผิดพลาดก่อนสรุปเป็น incident หรือออดิท',
        },
      },
    },
  };

  Object.assign(ROUTE_TITLE_FALLBACKS, {
    tenants: 'ลูกค้าและแพ็กเกจ',
    packages: 'แพ็กเกจและสิทธิ์ใช้งาน',
    subscriptions: 'การสมัครใช้และต่ออายุ',
    billing: 'การเงินและต่ออายุ',
    runtime: 'สถานะบริการและเหตุการณ์',
    'runtime-health': 'สถานะบริการและเหตุการณ์',
    incidents: 'เหตุการณ์และสัญญาณ',
    observability: 'คำขอและความหน่วง',
    jobs: 'งานคิวและบอต',
    support: 'งานดูแลลูกค้า',
    security: 'ความปลอดภัย',
    audit: 'หลักฐานและบันทึก',
    settings: 'ตั้งค่า',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.overview, {
    primaryAction: { label: 'เปิดรายชื่อลูกค้า', href: '#tenants' },
    railCopy: 'ดูรายได้ บริการหลัก และจุดเสี่ยงของแพลตฟอร์มจากด้านขวา',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.settings, {
    railCopy: 'เก็บเรื่องสิทธิ์ หลักฐาน และแนวทางดูแลลูกค้าไว้ในมุมเดียวกัน',
    sectionTitles: {
      settings: {
        title: 'นโยบายและเครื่องมือที่ควรเปิดต่อ',
        copy: 'เริ่มจากกติกาที่กระทบลูกค้าหลายรายก่อน แล้วค่อยไล่งานเชิงปฏิบัติการ',
      },
    },
  });

  OWNER_ROUTE_PRESENTATION.control = {
    workspaceLabel: 'Platform controls',
    kicker: 'Platform controls',
    title: 'Platform controls',
    subtitle: 'Keep legacy control routes on the shared settings, service, and automation workspace without changing existing backend flows.',
    primaryAction: { label: 'Open platform controls', href: '#owner-control-workspace' },
    railHeader: 'Control context',
    railCopy: 'Legacy control routes continue to use the same owner control forms, settings endpoints, and service actions.',
  };

  OWNER_ROUTE_PRESENTATION.access = {
    workspaceLabel: 'Access posture',
    kicker: 'Access posture',
    title: 'Access and operator sessions',
    subtitle: 'Review active sessions, access signals, and security evidence before revoking or escalating.',
    primaryAction: { label: 'Focus audit workspace', href: '#audit' },
    railHeader: 'Access context',
    railCopy: 'Legacy access routes stay wired to the current audit and security evidence surfaces.',
  };

  OWNER_ROUTE_PRESENTATION.diagnostics = {
    workspaceLabel: 'Diagnostics and evidence',
    kicker: 'Diagnostics and evidence',
    title: 'Diagnostics and evidence',
    subtitle: 'Review export-ready diagnostics, request evidence, and notification backlog from the current owner governance flow.',
    primaryAction: { label: 'Focus audit workspace', href: '#audit' },
    railHeader: 'Diagnostics context',
    railCopy: 'Legacy diagnostics routes stay mapped to the current audit, export, and evidence workspaces.',
  };

  Object.assign(OWNER_ROUTE_PRESENTATION.tenants, {
    railCopy: 'เก็บงานดูแลลูกค้าและงานเชิงพาณิชย์ไว้ใกล้ทะเบียนลูกค้า',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.packages, {
    subtitle: 'ทบทวนว่าลูกค้าแต่ละรายอยู่แผนใด และได้สิทธิ์อะไรบ้างก่อนเปลี่ยนแพ็กเกจ',
    sectionTitles: {
      packages: {
        title: 'รายชื่อลูกค้าตามแพ็กเกจ',
        copy: 'เปิดดูจากทะเบียนเดียวกันได้เลยว่าลูกค้ารายไหนอยู่แผนใด และควรย้ายหรือคงแผนเดิม',
      },
    },
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.subscriptions, {
    railCopy: 'เริ่มจากลูกค้าที่ใกล้หมดอายุก่อน เพื่อไม่ให้ทีมดูแลลูกค้ารับแรงกระแทก',
    sectionTitles: {
      packages: {
        title: 'รายชื่อลูกค้าที่ต้องตามเรื่องการสมัครใช้',
        copy: 'ใช้ตารางนี้คัดรายที่ต้องทบทวนเรื่องการต่ออายุ แพ็กเกจ และสิทธิ์ใช้งานในรอบเดียว',
      },
    },
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.billing, {
    railCopy: 'มุมนี้ใช้ตัดสินใจเรื่องต่ออายุ รายได้ และลูกค้าที่เริ่มชนขอบความเสี่ยง',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION['create-tenant'], {
    subtitle: 'เริ่มจากข้อมูลหลักของลูกค้า แล้วค่อยผูกแพ็กเกจ การสมัครใช้ และงานดูแลลูกค้าต่อ',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.support, {
    workspaceLabel: 'งานดูแลลูกค้า',
    kicker: 'งานดูแลลูกค้า',
    title: 'งานดูแลลูกค้า',
    subtitle: 'เริ่มจากลูกค้าและเรื่องที่กำลังคุยอยู่ แล้วค่อยไล่หลักฐานและบริบทระบบต่อ',
    railHeader: 'บริบทงานดูแลลูกค้า',
    railCopy: 'เก็บบริบทของลูกค้า หลักฐาน และเรื่องเชิงพาณิชย์ไว้ใกล้กันเพื่อให้คุยกับลูกค้าได้ต่อเนื่อง',
    sectionTitles: {
      incidents: {
        title: 'เคสดูแลลูกค้าและสัญญาณล่าสุด',
        copy: 'เริ่มจาก feed นี้ก่อนเปิดเครื่องมือ replay หรือ diagnostics เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่า',
      },
    },
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.runtime, {
    title: 'สถานะบริการและเหตุการณ์',
    railCopy: 'เก็บหลักฐานและงานติดตามของเจ้าของระบบไว้ใกล้มือเสมอขณะตรวจสถานะบริการหรือเหตุการณ์',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION['runtime-health'], {
    railCopy: 'เก็บหลักฐานและงานติดตามของเจ้าของระบบไว้ใกล้มือเสมอขณะตรวจสถานะบริการหรือเหตุการณ์',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION['agents-bots'], {
    title: 'Agent และ Bot ทั้งแพลตฟอร์ม',
    subtitle: 'จัด provisioning ของ Delivery Agent และ Server Bot โดยไม่ปนกับงาน incident หรือ recovery',
    railCopy: 'หน้านี้เน้นการสร้าง server record, ออก setup token, และตรวจ runtime inventory ของทั้งแพลตฟอร์ม',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION['fleet-diagnostics'], {
    title: 'Fleet diagnostics',
    subtitle: 'ดู runtime ที่มีปัญหาและความเสี่ยงของฟลีตก่อนค่อยใช้ shared recovery controls',
    railCopy: 'หน้านี้เน้น health drift, pending activation, และสัญญาณ request failure ของ Owner surface',
  });

  Object.assign(OWNER_ROUTE_PRESENTATION.audit, {
    railCopy: 'งานดูแลลูกค้าและงานรีวิวความปลอดภัยควรใช้หลักฐานชุดเดียวกัน',
  });

  OWNER_ROUTE_PRESENTATION.recovery = {
    workspaceLabel: 'Recovery and backup',
    kicker: 'Recovery and backup',
    title: 'Recovery and backup',
    subtitle: 'Inspect backup inventory, restore previews, and recovery history before applying shared restore actions.',
    primaryAction: { label: 'Open recovery controls', href: '#owner-control-workspace' },
    railHeader: 'Recovery context',
    railCopy: 'Keep backup inventory, restore history, and dry-run previews visible together before any live recovery step.',
  };

  const state = {
    payload: null,
    refreshing: false,
    timerId: null,
    requestId: 0,
    ownerUi: {
      selectedRuntimeKey: '',
      runtimeBootstrap: null,
      restorePreview: null,
      automationPreview: null,
      supportCaseTenantId: '',
      supportCase: null,
      supportCaseLoading: false,
      supportCaseRequestId: 0,
      supportDeadLettersTenantId: '',
      supportDeadLetters: [],
      supportDeadLettersLoading: false,
      supportDeadLettersRequestId: 0,
    },
  };

  const NATIVE_OWNER_FORM_ACTIONS = new Set([
    'export-tenant-diagnostics',
    'export-tenant-support-case',
    'export-delivery-lifecycle',
  ]);

  const OWNER_OVERVIEW_FALLBACK = {
    analytics: {
      tenants: { total: 0, active: 0, trialing: 0, reseller: 0 },
      subscriptions: { total: 0, active: 0, mrrCents: 0 },
      delivery: { queueDepth: 0, failedJobs: 0, failureRatePct: 0, lastSyncAt: null },
    },
    publicOverview: null,
    permissionCatalog: [],
    plans: [],
    packages: [],
    features: [],
    tenantFeatureAccess: null,
    opsState: null,
    automationState: null,
    automationConfig: null,
    tenantConfig: null,
  };

  const OWNER_CONTROL_PANEL_SETTINGS_FALLBACK = {
    env: { root: {}, portal: {} },
    envGroups: { root: [], portal: [] },
    envPolicy: { root: {}, portal: {} },
    adminUsers: [],
    managedServices: [],
    files: { root: null, portal: null },
    applyPolicy: { reloadSafe: [], restartRequired: [] },
    reloadRequired: true,
  };

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
    if (!text || !/(\u00C3|\u00C2|\u00E0|\u00E2|\u00EF|\u00BF)/.test(text) || typeof TextDecoder !== 'function') return text;
    try {
      const bytes = Uint8Array.from(Array.from(text, (char) => {
        const codePoint = char.codePointAt(0);
        return CP1252_REVERSE_MAP.get(codePoint) ?? (codePoint & 0xff);
      }));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return text;
    }
  }

  function t(key, fallback, params) {
    const normalizedFallback = repairMojibakeText(fallback);
    return window.AdminUiI18n?.t?.(key, normalizedFallback, params) || normalizedFallback || key;
  }

  function applyI18n(rootNode = document) {
    window.AdminUiI18n?.apply?.(rootNode);
  }

  function ownerUiLocale() {
    const rawLocale = String(
      document.getElementById('ownerLanguageSelect')?.value
      || window.AdminUiI18n?.getLocale?.()
      || document.documentElement.lang
      || ''
    ).trim().toLowerCase();
    return rawLocale.startsWith('th') ? 'th' : 'en';
  }

  function ownerText(english, thai) {
    return ownerUiLocale() === 'th' ? repairMojibakeText(thai) : repairMojibakeText(english);
  }

  function resolveSafeWindowOpenUrl(rawUrl) {
    const text = trimText(rawUrl, 800);
    if (!text) return '';
    try {
      const resolved = new URL(text, window.location.origin);
      if (!['http:', 'https:'].includes(resolved.protocol)) {
        return '';
      }
      return resolved.href;
    } catch {
      return '';
    }
  }

  function withOwnerBusyState(target, work) {
    if (!target || typeof work !== 'function') {
      return Promise.resolve();
    }
    if (target.dataset.ownerBusy === '1') {
      return Promise.resolve();
    }
    const supportsDisabled = 'disabled' in target;
    const previousDisabled = supportsDisabled ? Boolean(target.disabled) : false;
    const previousAriaDisabled = target.getAttribute('aria-disabled');
    target.dataset.ownerBusy = '1';
    target.setAttribute('aria-disabled', 'true');
    if (supportsDisabled) {
      target.disabled = true;
    }
    return Promise.resolve()
      .then(() => work())
      .finally(() => {
        delete target.dataset.ownerBusy;
        if (previousAriaDisabled == null) {
          target.removeAttribute('aria-disabled');
        } else {
          target.setAttribute('aria-disabled', previousAriaDisabled);
        }
        if (supportsDisabled) {
          target.disabled = previousDisabled;
        }
      });
  }

  function buildOwnerActionConfirmMessage(action, button) {
    const tenantLabel = trimText(button?.dataset.tenantName || button?.dataset.tenantId, 160) || ownerText('this tenant', 'ลูกค้ารายนี้');
    const runtimeLabel = trimText(button?.dataset.displayName || button?.dataset.runtimeKey || button?.dataset.serviceLabel, 160) || ownerText('this runtime', 'บริการนี้');
    const userLabel = trimText(button?.dataset.sessionUser, 160) || ownerText('this operator', 'ผู้ปฏิบัติงานรายนี้');
    const invoiceId = trimText(button?.dataset.invoiceId, 160) || ownerText('this invoice', 'ใบแจ้งหนี้นี้');
    const attemptId = trimText(button?.dataset.attemptId, 160) || ownerText('this payment attempt', 'รายการชำระเงินนี้');
    const subscriptionId = trimText(button?.dataset.subscriptionId, 160) || ownerText('this subscription', 'การสมัครใช้นี้');
    const deadLetterCode = trimText(button?.dataset.purchaseCode || button?.dataset.code, 160) || ownerText('this dead-letter job', 'งานค้างผิดปกตินี้');
    const targetStatus = formatOwnerActionStatus(trimText(button?.dataset.targetStatus, 80));

    if (action === 'set-tenant-status') {
      return ownerText(`Change ${tenantLabel} to ${targetStatus}?`, `เปลี่ยนสถานะของ ${tenantLabel} เป็น ${targetStatus} ใช่หรือไม่?`);
    }
    if (action === 'reissue-runtime-token') {
      return ownerText(`Issue a new setup token for ${runtimeLabel}? Existing device binding may need to reconnect.`, `ออก setup token ใหม่ให้ ${runtimeLabel} ใช่หรือไม่? เครื่องที่ผูกอยู่เดิมอาจต้องเชื่อมต่อใหม่`);
    }
    if (action === 'reset-runtime-binding') {
      return ownerText(`Reset the device binding for ${runtimeLabel}?`, `รีเซ็ตการผูกเครื่องของ ${runtimeLabel} ใช่หรือไม่?`);
    }
    if (action === 'revoke-runtime') {
      return ownerText(`Revoke the active token or credential for ${runtimeLabel}?`, `ยกเลิก token หรือ credential ของ ${runtimeLabel} ใช่หรือไม่?`);
    }
    if (action === 'restart-managed-service') {
      return ownerText(`Restart ${runtimeLabel} now?`, `รีสตาร์ต ${runtimeLabel} ตอนนี้ใช่หรือไม่?`);
    }
    if (action === 'revoke-admin-session') {
      return ownerText(`Revoke the current session for ${userLabel}?`, `ยกเลิกเซสชันของ ${userLabel} ใช่หรือไม่?`);
    }
    if (action === 'clear-acknowledged-notifications') {
      return ownerText('Clear all acknowledged Owner notifications now?', 'ล้างการแจ้งเตือน Owner ที่รับทราบแล้วทั้งหมดใช่หรือไม่?');
    }
    if (action === 'update-billing-invoice-status') {
      return ownerText(`Update ${invoiceId} to ${targetStatus}?`, `อัปเดต ${invoiceId} เป็นสถานะ ${targetStatus} ใช่หรือไม่?`);
    }
    if (action === 'update-payment-attempt-status') {
      return ownerText(`Update ${attemptId} to ${targetStatus}?`, `อัปเดต ${attemptId} เป็นสถานะ ${targetStatus} ใช่หรือไม่?`);
    }
    if (action === 'retry-billing-checkout') {
      return ownerText(`Create a new checkout session for ${tenantLabel}?`, `สร้าง checkout session ใหม่ให้ ${tenantLabel} ใช่หรือไม่?`);
    }
    if (action === 'cancel-billing-subscription') {
      return ownerText(`Cancel ${subscriptionId} for ${tenantLabel}?`, `ยกเลิก ${subscriptionId} ของ ${tenantLabel} ใช่หรือไม่?`);
    }
    if (action === 'reactivate-billing-subscription') {
      return ownerText(`Reactivate ${subscriptionId} for ${tenantLabel}?`, `เปิดใช้งาน ${subscriptionId} ของ ${tenantLabel} อีกครั้งใช่หรือไม่?`);
    }
    if (action === 'retry-dead-letter') {
      return ownerText(`Retry dead-letter job ${deadLetterCode} for ${tenantLabel}?`, `ส่งงานค้างผิดปกติ ${deadLetterCode} ของ ${tenantLabel} กลับเข้าคิวใช่หรือไม่?`);
    }
    if (action === 'clear-dead-letter') {
      return ownerText(`Delete dead-letter job ${deadLetterCode} for ${tenantLabel}?`, `ลบงานค้างผิดปกติ ${deadLetterCode} ของ ${tenantLabel} ใช่หรือไม่?`);
    }
    return '';
  }

  function confirmOwnerAction(action, button) {
    const message = buildOwnerActionConfirmMessage(action, button);
    if (!message || typeof window.confirm !== 'function') {
      return true;
    }
    return window.confirm(message);
  }

  const OWNER_ACTIVE_TEXT_MAP = {
    English: 'อังกฤษ',
    'Español': 'สเปน',
    Owner: 'เจ้าของระบบ',
    Admin: 'ผู้ดูแลระบบ',
    Moderator: 'ผู้ช่วยดูแล',
    Starter: 'เริ่มต้น',
    Growth: 'เติบโต',
    'server-bot': 'บอตเซิร์ฟเวอร์',
    'delivery-agent': 'บอตส่งของ',
    unlimited: 'ไม่จำกัด',
    ผู้เช่า: 'ลูกค้า',
    ซัพพอร์ต: 'งานดูแลลูกค้า',
    'สุขภาพรันไทม์': 'สถานะบริการ',
    'เปิดเคสซัพพอร์ต': 'เปิดเคสงานดูแลลูกค้า',
    'งานซัพพอร์ต': 'งานดูแลลูกค้า',
    'บริบทซัพพอร์ต': 'บริบทงานดูแลลูกค้า',
    'เครื่องมือซัพพอร์ต': 'เครื่องมืองานดูแลลูกค้า',
    'Customer detail': 'รายละเอียดลูกค้า',
    'Customer operations and commercial controls': 'การจัดการลูกค้าและการควบคุมเชิงพาณิชย์',
    'Open support case': 'เปิดเคสดูแลลูกค้า',
    'Open customer list': 'เปิดรายชื่อลูกค้า',
    'Support case': 'เคสดูแลลูกค้า',
    'Support case not found': 'ไม่พบเคสดูแลลูกค้า',
    'No immediate support actions': 'ยังไม่มีงานที่ต้องทำทันที',
    'Retry': 'ลองส่งใหม่',
    'Clear': 'ล้างรายการ',
    'Customer': 'ลูกค้า',
    'Current package': 'แพ็กเกจปัจจุบัน',
    'Subscription': 'การสมัครใช้',
    'Runtime status': 'สถานะบอท',
    'Quota': 'โควตา',
    'Support signals': 'สัญญาณงานดูแลลูกค้า',
    'Runtime': 'บอท',
    'Type': 'ประเภท',
    'Status': 'สถานะ',
    'Version': 'เวอร์ชัน',
    'Last seen': 'พบล่าสุด',
    'Actions': 'การทำงาน',
    'Customer record': 'ข้อมูลลูกค้า',
    'Edit customer metadata': 'แก้ไขข้อมูลลูกค้า',
    'Customer name': 'ชื่อลูกค้า',
    'Owner name': 'ชื่อผู้ดูแลหลัก',
    'Owner email': 'อีเมลผู้ดูแลหลัก',
    'Locale': 'ภาษา',
    'Parent tenant': 'ลูกค้าต้นทาง',
    'Save customer record': 'บันทึกข้อมูลลูกค้า',
    'Reactivate customer': 'เปิดใช้งานลูกค้าอีกครั้ง',
    'Suspend customer': 'ระงับลูกค้า',
    'Commercial control': 'การควบคุมเชิงพาณิชย์',
    'Assign or change package': 'กำหนดหรือเปลี่ยนแพ็กเกจ',
    'Package': 'แพ็กเกจ',
    'Plan ID': 'รหัสแผน',
    'Billing cycle': 'รอบการชำระ',
    'Subscription status': 'สถานะการสมัครใช้',
    'Amount (cents)': 'ยอดเงิน (สตางค์)',
    'Currency': 'สกุลเงิน',
    'Renews at': 'ต่ออายุเมื่อ',
    'External ref': 'อ้างอิงภายนอก',
    'Save package assignment': 'บันทึกการกำหนดแพ็กเกจ',
    'Alert': 'การแจ้งเตือน',
    'Severity': 'ระดับ',
    'When': 'เวลา',
    'Method': 'วิธีเรียก',
    'Path': 'เส้นทาง',
    'Detail': 'รายละเอียด',
    'Signal': 'สัญญาณ',
    'Count': 'จำนวน',
    'Onboarding step': 'ขั้นตอนเริ่มต้น',
    'Scope': 'ขอบเขต',
    'Required': 'จำเป็น',
    'Optional': 'เพิ่มเติม',
    'Analytics': 'การวิเคราะห์',
    'Platform and business analytics': 'ภาพรวมแพลตฟอร์มและธุรกิจ',
    'Total customers': 'ลูกค้าทั้งหมด',
    'Active customers': 'ลูกค้าที่ใช้งานอยู่',
    'Services online': 'บริการที่ออนไลน์',
    'Failed jobs': 'งานที่ล้มเหลว',
    'Customer count': 'จำนวนลูกค้า',
    'Features': 'ฟีเจอร์',
    'No package description yet.': 'ยังไม่มีคำอธิบายแพ็กเกจ',
    'Yes': 'มี',
    'No': 'ไม่มี',
    'Open': 'เปิด',
    'MRR': 'รายได้ประจำ',
    'Cycle': 'รอบบิล',
    'Amount': 'ยอดเงิน',
    'Expiring accounts': 'บัญชีที่ใกล้ต่ออายุ',
    'Subscription lifecycle': 'วงจรการสมัครใช้งาน',
    'Renewals and billing watch': 'การต่ออายุและการเฝ้าระวังการเงิน',
    'Subscriptions and renewals': 'การสมัครใช้งานและการต่ออายุ',
    'Follow contracts that are expiring, suspended, or at risk before they become service-impacting incidents.': 'ติดตามสัญญาที่ใกล้หมดอายุ ถูกระงับ หรือเริ่มมีความเสี่ยงก่อนจะกลายเป็นปัญหาที่กระทบบริการ',
    'Commercial risk': 'ความเสี่ยงเชิงพาณิชย์',
    'Billing follow-up': 'รายการติดตามการเงิน',
    'Expiring soon': 'ใกล้หมดอายุ',
    'Within 14 days': 'ภายใน 14 วัน',
    'Package catalog': 'แค็ตตาล็อกแพ็กเกจ',
    'Active package definitions': 'แพ็กเกจที่เปิดใช้อยู่',
    'Review package usage before changing entitlement definitions or moving tenants across plans.': 'ทบทวนการใช้งานแพ็กเกจก่อนเปลี่ยนสิทธิ์หรือย้ายลูกค้าข้ามแผน',
    'Use this registry to move between customer records, entitlement posture, renewals, and support context.': 'ใช้ทะเบียนนี้สลับดูข้อมูลลูกค้า สิทธิ์ใช้งาน การต่ออายุ และบริบทงานดูแลลูกค้าได้จากจุดเดียว',
    'No tenant selected': 'ยังไม่ได้เลือกลูกค้า',
    'Open a tenant route from the registry to load a focused tenant dossier here.': 'เปิดเส้นทางของลูกค้าจากทะเบียนเพื่อโหลดแฟ้มข้อมูลที่ต้องโฟกัสไว้ตรงนี้',
    'Recovery queue': 'คิวกู้คืนรายได้',
    'Resolve billing issues before they grow': 'จัดการปัญหาการเงินก่อนลุกลาม',
    'Prioritized billing follow-up items surface the owner actions that already exist in the workspace so support can recover revenue faster.': 'รายการติดตามการเงินที่จัดลำดับแล้วจะพาไปยัง action เดิมใน workspace เพื่อให้ทีมงานกู้รายได้ได้เร็วขึ้น',
    'No urgent billing recovery work': 'ยังไม่มีงานกู้รายได้เร่งด่วน',
    'No urgent billing recovery work is waiting right now.': 'ตอนนี้ยังไม่มีงานกู้รายได้เร่งด่วนที่รออยู่',
    'Platform policy': 'นโยบายแพลตฟอร์ม',
    'Shared settings and automation': 'การตั้งค่ากลางและระบบอัตโนมัติ',
    'Review env policy, managed services, admin users, and automation posture while keeping the current backend contract intact.': 'ทบทวนนโยบาย env บริการที่จัดการอยู่ บัญชีผู้ดูแล และสถานะระบบอัตโนมัติ โดยยังคงสัญญา backend เดิมไว้',
    'Admin users': 'บัญชีผู้ดูแล',
    'Reload policy': 'นโยบายการโหลดใหม่',
    'Policy context': 'บริบทของนโยบาย',
    'Settings changes still flow through existing env and auth mutations.': 'การเปลี่ยนค่าตั้งค่ายังคงวิ่งผ่าน mutation ของ env และ auth เดิม',
    Active: 'ใช้งานอยู่',
    Role: 'บทบาท',
    'Tenant scope': 'ขอบเขตลูกค้า',
    Platform: 'แพลตฟอร์ม',
    'Admin Web': 'เว็บเจ้าของระบบ',
    'Standalone owner and tenant admin web runtime': 'เว็บแยกของเจ้าของระบบและผู้ดูแลลูกค้า',
    'Discord command and automation runtime': 'รันไทม์คำสั่ง Discord และงานอัตโนมัติ',
    Worker: 'ตัวประมวลผลงาน',
    'Delivery and background job worker': 'ตัวประมวลผลงานส่งของและงานเบื้องหลัง',
    'SCUM Watcher': 'ตัวติดตาม SCUM.log',
    'SCUM log watcher and sync runtime': 'รันไทม์ติดตาม SCUM log และซิงก์ข้อมูล',
    'Server-side sync, config, backup, and server control runtime': 'รันไทม์ฝั่งเซิร์ฟเวอร์สำหรับซิงก์ คอนฟิก สำรองข้อมูล และควบคุมเซิร์ฟเวอร์',
    'Player Portal': 'พอร์ทัลผู้เล่น',
    'Standalone public and player portal': 'เว็บสาธารณะและพอร์ทัลผู้เล่นแบบแยก',
    'Execution runtime for in-game delivery and managed SCUM commands': 'รันไทม์สำหรับการส่งของในเกมและคำสั่ง SCUM แบบควบคุม',
    'Primary action': 'งานหลัก',
    'Update renewals without leaving this page': 'อัปเดตการต่ออายุได้จากหน้านี้ทันที',
    'Handle the accounts that are expiring, past due, or high-risk first, then open the customer record only when you need more detail.': 'เริ่มจากบัญชีที่ใกล้หมดอายุ ค้างชำระ หรือมีความเสี่ยงสูงก่อน แล้วค่อยเปิดหน้าลูกค้าเมื่อจำเป็นต้องดูรายละเอียดเพิ่ม',
    'No customer records yet': 'ยังไม่มีข้อมูลลูกค้า',
    'Create the first customer before you manage subscriptions from this page.': 'สร้างลูกค้ารายแรกก่อน แล้วจึงกลับมาจัดการการสมัครใช้งานจากหน้านี้',
    'No subscription rows yet': 'ยังไม่มีรายการสมัครใช้งาน',
    'No subscriptions are due to expire in the next 14 days.': 'ยังไม่มีรายการสมัครใช้งานที่ใกล้หมดอายุใน 14 วันข้างหน้า',
    'Review and save subscription terms from this card.': 'ตรวจและบันทึกเงื่อนไขการต่ออายุได้จากการ์ดนี้ทันที',
    'Create the first subscription for this customer from this card.': 'สร้างการสมัครใช้งานครั้งแรกของลูกค้ารายนี้จากการ์ดนี้ได้เลย',
    'ลอง checkout ใหม่': 'เปิดลิงก์ชำระเงินใหม่',
    'เปลี่ยนสถานะใบแจ้งหนี้หรือเริ่ม checkout ใหม่ได้จากหน้านี้ โดยไม่ต้องออกจาก workspace ของ Owner': 'เปลี่ยนสถานะใบแจ้งหนี้หรือเปิดลิงก์ชำระเงินใหม่ได้จากหน้านี้ โดยไม่ต้องออกจากพื้นที่งานของเจ้าของระบบ',
    'บันทึกผลการชำระหรือเริ่ม checkout ใหม่เมื่อลูกค้าต้องการลิงก์ชำระเงินชุดใหม่': 'บันทึกผลการชำระหรือเปิดลิงก์ชำระเงินใหม่เมื่อลูกค้าต้องการลิงก์ชำระเงินชุดใหม่',
    'อัปเดตนโยบายการชำระเงินและ checkout': 'อัปเดตนโยบายการชำระเงินและลิงก์ชำระเงิน',
    'ดูแลผู้ให้บริการชำระเงิน checkout base URL และคีย์ Stripe ให้ตรงกับ flow เชิงพาณิชย์ที่ใช้งานจริง': 'ดูแลผู้ให้บริการชำระเงิน URL หลักของหน้าชำระเงิน และคีย์ Stripe ให้ตรงกับ flow เชิงพาณิชย์ที่ใช้งานจริง',
    'ถ้าเว้นไว้ระบบจะ derive จากชื่อให้อัตโนมัติ': 'ถ้าเว้นไว้ ระบบจะสร้างจากชื่อให้อัตโนมัติ',
    'ส่งออก diagnostics': 'ส่งออกข้อมูลวินิจฉัย',
    'ทบทวน billing และการต่ออายุ': 'ทบทวนการเงินและการต่ออายุ',
    'วางปุ่มส่งออก diagnostics และเปิดเคสไว้ใกล้ทะเบียนผู้เช่า เพื่อให้เจ้าของระบบไล่งานได้ในหนึ่งหรือสองคลิก': 'วางปุ่มส่งออกข้อมูลวินิจฉัยและเปิดเคสไว้ใกล้ทะเบียนลูกค้า เพื่อให้เจ้าของระบบไล่งานได้ในหนึ่งหรือสองคลิก',
    'งานซัพพอร์ตไม่ควรถูกซ่อนไว้ลึกใน hash section เก่า': 'งานดูแลลูกค้าไม่ควรถูกซ่อนไว้ลึกในส่วนเก่าของหน้า',
    'ดูมุม billing ก่อนเปลี่ยนแพ็กเกจหรือสิทธิ์ใช้งาน': 'ดูกลุ่มการเงินก่อนเปลี่ยนแพ็กเกจหรือสิทธิ์ใช้งาน',
    'สร้าง อัปเดต และเก็บถาวรแพ็กเกจเชิงพาณิชย์จากหน้า Owner โดยยังคุมรหัสแพ็กเกจและสิทธิ์ฟีเจอร์ไว้ที่แพลตฟอร์ม': 'สร้าง อัปเดต และเก็บถาวรแพ็กเกจเชิงพาณิชย์จากหน้าเจ้าของระบบ โดยยังคุมรหัสแพ็กเกจและสิทธิ์ฟีเจอร์ไว้ที่แพลตฟอร์ม',
    'Admin Web SSO Discord Enabled': 'เปิดใช้ Discord SSO สำหรับเว็บเจ้าของระบบ',
    'Enable Discord SSO for admin web · บันทึกแล้วต้องรีสตาร์ต': 'เปิดใช้ Discord SSO สำหรับเว็บเจ้าของระบบ · บันทึกแล้วต้องรีสตาร์ต',
    'Admin Web SSO Default Role': 'บทบาทเริ่มต้นของ SSO ฝั่งเว็บเจ้าของระบบ',
    'Default admin role when SSO mapping does not match · บันทึกแล้วต้องรีสตาร์ต': 'บทบาทเริ่มต้นเมื่อการจับคู่ SSO ไม่ตรง · บันทึกแล้วต้องรีสตาร์ต',
    'Admin Web 2FA Enabled': 'เปิดใช้ 2FA ของเว็บเจ้าของระบบ',
    'Require TOTP for admin login · บันทึกแล้วต้องรีสตาร์ต': 'บังคับใช้ TOTP สำหรับการเข้าสู่ระบบของ Owner · บันทึกแล้วต้องรีสตาร์ต',
    'Admin Web Step Up Enabled': 'เปิดใช้การยืนยันเพิ่มสำหรับเว็บเจ้าของระบบ',
    'Require step-up auth for sensitive admin actions · บันทึกแล้วต้องรีสตาร์ต': 'บังคับใช้การยืนยันเพิ่มกับงานเจ้าของระบบที่มีความเสี่ยง · บันทึกแล้วต้องรีสตาร์ต',
    'Admin Web Step Up TTL Minutes': 'อายุเซสชันยืนยันเพิ่มของเว็บเจ้าของระบบ (นาที)',
    'Step-up session TTL in minutes · บันทึกแล้วต้องรีสตาร์ต': 'อายุเซสชันยืนยันเพิ่มเป็นนาที · บันทึกแล้วต้องรีสตาร์ต',
    'Delivery Reconcile Anomaly': 'ความผิดปกติของการกระทบยอดการส่งของ',
    'Platform Event: agent heartbeat': 'เหตุการณ์แพลตฟอร์ม: สัญญาณการทำงานของบอท',
    'Admin Security Event': 'เหตุการณ์ความปลอดภัยของผู้ดูแล',
    'Admin Web Session TTL Hours': 'อายุเซสชันของเว็บเจ้าของระบบ (ชั่วโมง)',
    'Admin session TTL in hours · บันทึกแล้วต้องรีสตาร์ต': 'อายุเซสชันผู้ดูแลเป็นชั่วโมง · บันทึกแล้วต้องรีสตาร์ต',
    'Admin idle timeout in minutes · บันทึกแล้วต้องรีสตาร์ต': 'หมดเวลาไม่ใช้งานของผู้ดูแลเป็นนาที · บันทึกแล้วต้องรีสตาร์ต',
    'Max concurrent admin sessions per user · บันทึกแล้วต้องรีสตาร์ต': 'จำนวนเซสชันผู้ดูแลพร้อมกันสูงสุดต่อคน · บันทึกแล้วต้องรีสตาร์ต',
    'Use secure cookies for Owner Web · บันทึกแล้วต้องรีสตาร์ต': 'ใช้คุกกี้แบบปลอดภัยสำหรับเว็บเจ้าของระบบ · บันทึกแล้วต้องรีสตาร์ต',
    'Enable HSTS headers on Owner Web · บันทึกแล้วต้องรีสตาร์ต': 'เปิดส่วนหัว HSTS สำหรับเว็บเจ้าของระบบ · บันทึกแล้วต้องรีสตาร์ต',
    'Reject cross-site admin writes · บันทึกแล้วต้องรีสตาร์ต': 'ปฏิเสธการเขียนข้ามไซต์ของผู้ดูแล · บันทึกแล้วต้องรีสตาร์ต',
    'Comma-separated trusted admin origins · บันทึกแล้วต้องรีสตาร์ต': 'รายชื่อแหล่งที่มาที่ผู้ดูแลเชื่อถือ คั่นด้วยจุลภาค · บันทึกแล้วต้องรีสตาร์ต',
    'Admin Log Language': 'ภาษาของบันทึกผู้ดูแล',
    'Language used for Discord admin-log operational alerts · บันทึกแล้วรีโหลดได้ทันที': 'ภาษาที่ใช้กับการแจ้งเตือนบันทึกผู้ดูแลผ่าน Discord · บันทึกแล้วรีโหลดได้ทันที',
    'Web Portal Base URL': 'URL หลักของพอร์ทัลผู้เล่น',
    'Canonical player portal URL · บันทึกแล้วต้องรีสตาร์ต': 'URL หลักของพอร์ทัลผู้เล่น · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Allowed Discord Ids': 'รายการ Discord ID ที่อนุญาตของพอร์ทัลผู้เล่น',
    'Allowlist of Discord ids for portal access · บันทึกแล้วต้องรีสตาร์ต': 'รายการ Discord ID ที่อนุญาตให้เข้าพอร์ทัล · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Player Open Access': 'เปิดให้ผู้เล่นเข้าพอร์ทัลได้อิสระ',
    'Allow player portal without guild membership · บันทึกแล้วต้องรีสตาร์ต': 'อนุญาตให้เข้าพอร์ทัลได้โดยไม่ต้องเป็นสมาชิกกิลด์ · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Require Guild Member': 'บังคับเป็นสมาชิกกิลด์ก่อนเข้าพอร์ทัล',
    'Require guild membership for portal access · บันทึกแล้วต้องรีสตาร์ต': 'บังคับเป็นสมาชิกกิลด์ก่อนเข้าพอร์ทัล · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Secure Cookie': 'คุกกี้แบบปลอดภัยของพอร์ทัลผู้เล่น',
    'Use secure cookies in player portal · บันทึกแล้วต้องรีสตาร์ต': 'ใช้คุกกี้แบบปลอดภัยในพอร์ทัลผู้เล่น · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Enforce Origin Check': 'บังคับตรวจสอบแหล่งที่มาของพอร์ทัลผู้เล่น',
    'Reject cross-site player portal writes · บันทึกแล้วต้องรีสตาร์ต': 'ปฏิเสธการเขียนข้ามไซต์ของพอร์ทัลผู้เล่น · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Session TTL Hours': 'อายุเซสชันของพอร์ทัลผู้เล่น (ชั่วโมง)',
    'Player session TTL in hours · บันทึกแล้วต้องรีสตาร์ต': 'อายุเซสชันผู้เล่นเป็นชั่วโมง · บันทึกแล้วต้องรีสตาร์ต',
    'Web Portal Cookie Samesite': 'นโยบาย SameSite ของคุกกี้พอร์ทัลผู้เล่น',
    'SameSite policy for player portal cookies · บันทึกแล้วต้องรีสตาร์ต': 'นโยบาย SameSite สำหรับคุกกี้พอร์ทัลผู้เล่น · บันทึกแล้วต้องรีสตาร์ต',
    'Platform Billing Provider': 'ผู้ให้บริการชำระเงินของแพลตฟอร์ม',
    'Owner web': 'เว็บเจ้าของระบบ',
    'Standalone owner and tenant owner web bot': 'เว็บแยกของเจ้าของระบบและผู้ดูแลลูกค้า',
    'Discord Bot': 'บอต Discord',
    'Discord command and automation bot': 'บอตคำสั่ง Discord และงานอัตโนมัติ',
    Worker: 'ตัวประมวลผลงาน',
    'Delivery and background job worker': 'ตัวประมวลผลงานส่งของและงานเบื้องหลัง',
    'SCUM Watcher': 'ตัวติดตาม SCUM.log',
    'SCUM log watcher and sync bot': 'บอตติดตาม SCUM.log และซิงก์ข้อมูล',
    'Server-side sync, config, backup, and server control bot': 'บอตฝั่งเซิร์ฟเวอร์สำหรับซิงก์ คอนฟิก สำรองข้อมูล และควบคุมเซิร์ฟเวอร์',
    'Console Agent': 'บอตคอนโซล',
    'Execution bot for managed SCUM commands': 'บอตประมวลคำสั่ง SCUM ที่ระบบดูแลให้',
    'Player Portal': 'พอร์ทัลผู้เล่น',
    'Standalone public and player portal': 'เว็บสาธารณะและพอร์ทัลผู้เล่นแบบแยก',
    'ยอดรับเงินเดือนนี้ / MRR ล่าสุด': 'ยอดรับเงินเดือนนี้ / รายได้ประจำล่าสุด',
    'Owner เห็นบอตส่งของและบอตเซิร์ฟเวอร์ทั้งแพลตฟอร์มจากมุม registry, binding และวงจรชีวิตของโทเค็น โดยไม่ปนกับปุ่มคุมเซิร์ฟเวอร์รายวัน': 'เจ้าของระบบมองเห็นบอตส่งของและบอตเซิร์ฟเวอร์ทั้งแพลตฟอร์มจากมุมทะเบียนบริการ การผูกเครื่อง และวงจรชีวิตของโทเค็น โดยไม่ปนกับปุ่มคุมเซิร์ฟเวอร์รายวัน',
    'ใช้ workspace นี้เพื่อตัดเซสชันที่ยังใช้งาน รับทราบการแจ้งเตือน และตรวจหลักฐานก่อนที่ปัญหาระดับแพลตฟอร์มจะลุกลาม': 'ใช้พื้นที่งานนี้เพื่อตัดเซสชันที่ยังใช้งาน รับทราบการแจ้งเตือน และตรวจหลักฐานก่อนที่ปัญหาระดับแพลตฟอร์มจะลุกลาม',
    'หน้า Owner Settings ใช้สำหรับนโยบายแพลตฟอร์ม สิทธิ์ และบริการส่วนกลางเท่านั้น งานของลูกค้าแต่ละรายยังอยู่ในพื้นที่ Tenant': 'หน้าตั้งค่าเจ้าของระบบใช้สำหรับนโยบายแพลตฟอร์ม สิทธิ์ และบริการส่วนกลางเท่านั้น งานของลูกค้าแต่ละรายยังอยู่ในพื้นที่ผู้ดูแลลูกค้า',
    'ใช้หน้านี้เพื่ออัปเดตกติกาสิทธิ์ของ Owner นโยบายพอร์ทัลผู้เล่น บัญชีผู้ดูแล และบริการส่วนกลาง โดยไม่ต้องแก้ไฟล์ฝั่งเซิร์ฟเวอร์โดยตรง': 'ใช้หน้านี้เพื่ออัปเดตกติกาสิทธิ์ของเจ้าของระบบ นโยบายพอร์ทัลผู้เล่น บัญชีผู้ดูแล และบริการส่วนกลาง โดยไม่ต้องแก้ไฟล์ฝั่งเซิร์ฟเวอร์โดยตรง',
    'บัญชีของ Owner และทีมปฏิบัติการแพลตฟอร์ม': 'บัญชีของเจ้าของระบบและทีมปฏิบัติการแพลตฟอร์ม',
    'อัปเดตนโยบายสิทธิ์ของ Owner': 'อัปเดตนโยบายสิทธิ์ของเจ้าของระบบ',
    'ปรับสิทธิ์การเข้าถึงของ Owner นโยบาย session และกติกาความปลอดภัยได้จากหน้าเว็บนี้โดยตรง': 'ปรับสิทธิ์การเข้าถึงของเจ้าของระบบ นโยบายเซสชัน และกติกาความปลอดภัยได้จากหน้าเว็บนี้โดยตรง',
    'วางทะเบียนผู้เช่า บริบทซัพพอร์ต และสถานะเชิงพาณิชย์ไว้ใกล้กัน เพื่อให้งานของเจ้าของระบบอ่านง่ายและตัดสินใจได้เร็ว': 'วางทะเบียนลูกค้า บริบทงานดูแลลูกค้า และสถานะเชิงพาณิชย์ไว้ใกล้กัน เพื่อให้งานของเจ้าของระบบอ่านง่ายและตัดสินใจได้เร็ว',
    'เริ่มจากเรื่องรายได้ ซัพพอร์ต และผู้เช่าที่เสี่ยงก่อน แล้วค่อยลงรายละเอียด': 'เริ่มจากเรื่องรายได้ งานดูแลลูกค้า และลูกค้าที่เสี่ยงก่อน แล้วค่อยลงรายละเอียด',
    'ตอนนี้ยังไม่พบผู้เช่าที่เข้าโซนใกล้ต่ออายุในชุดข้อมูลนี้': 'ตอนนี้ยังไม่พบลูกค้าที่เข้าโซนใกล้ต่ออายุในชุดข้อมูลนี้',
    'ยังไม่พบผู้เช่าที่เป็นเคสด่วน': 'ยังไม่พบลูกค้าที่เป็นเคสด่วน',
    'ใช้พื้นที่นี้เช็กผู้เช่าที่มีความเสี่ยงสูงก่อนจะขยับไปแก้เรื่องอื่น': 'ใช้พื้นที่นี้เช็กลูกค้าที่มีความเสี่ยงสูงก่อนจะขยับไปแก้เรื่องอื่น',
    'เปิดรายละเอียดผู้เช่ารายนี้ต่อเพื่อดูสุขภาพระบบ บริบทซัพพอร์ต และสถานะเชิงพาณิชย์ในหน้าถัดไป': 'เปิดรายละเอียดลูกค้ารายนี้ต่อเพื่อดูสถานะบริการ บริบทงานดูแลลูกค้า และสถานะเชิงพาณิชย์ในหน้าถัดไป',
    'ยังไม่ bind เครื่อง': 'ยังไม่ผูกเครื่อง',
    'ใช้เฉพาะคีย์ฟีเจอร์ที่ถูกต้อง แต่ละบรรทัดจะกลายเป็น entitlement หนึ่งรายการ': 'ใช้เฉพาะคีย์ฟีเจอร์ที่ถูกต้อง แต่ละบรรทัดจะกลายเป็นสิทธิ์ใช้งานหนึ่งรายการ',
    'เปลี่ยนสถานะใบแจ้งหนี้หรือเปิดลิงก์ชำระเงินใหม่ได้จากหน้านี้ โดยไม่ต้องออกจากพื้นที่งานของ Owner': 'เปลี่ยนสถานะใบแจ้งหนี้หรือเปิดลิงก์ชำระเงินใหม่ได้จากหน้านี้ โดยไม่ต้องออกจากพื้นที่งานของเจ้าของระบบ',
  };

  Object.assign(OWNER_ACTIVE_TEXT_MAP, {
    'Bot Log': 'บันทึกบอท',
    'Bot Log + Delivery': 'บันทึกบอท + ส่งของ',
    'Full Option': 'ฟังก์ชันเต็ม',
    'Server Only': 'เซิร์ฟเวอร์เท่านั้น',
    'Discord log sync and basic operational visibility.': 'ซิงก์ Discord log และมองเห็นสถานะการทำงานพื้นฐาน',
    'Managed delivery plus player-facing commerce and sync.': 'จัดการส่งของแบบควบคุมได้ พร้อมหน้าร้านและการซิงก์ฝั่งผู้เล่น',
    'Full managed server operations with hosting, settings, and delivery.': 'จัดการเซิร์ฟเวอร์แบบเต็มรูปแบบ รวมทั้งโฮสต์ ค่าตั้ง และการส่งของ',
    'Managed server controls without log and delivery add-ons.': 'ควบคุมเซิร์ฟเวอร์ได้ โดยไม่รวมส่วนเสริมด้าน log และการส่งของ',
    'Server Hosting': 'โฮสต์เซิร์ฟเวอร์',
    'Server Settings': 'การตั้งค่าเซิร์ฟเวอร์',
    'Server Status': 'สถานะเซิร์ฟเวอร์',
    'Bot Delivery': 'การส่งของของบอท',
    'Discord Integration': 'การเชื่อมต่อ Discord',
    'Log Dashboard': 'แผงบันทึกระบบ',
    'Delivery Dashboard': 'แผงการส่งของ',
    'Shop Module': 'โมดูลร้านค้า',
    'Orders Module': 'โมดูลคำสั่งซื้อ',
    'Player Module': 'โมดูลผู้เล่น',
    'Donation Module': 'โมดูลโดเนต',
    'Event Module': 'โมดูลกิจกรรม',
    'Event Auto Reward': 'รางวัลอัตโนมัติของกิจกรรม',
    'Wallet Module': 'โมดูลวอลเล็ต',
    'Promo Module': 'โมดูลโปรโมชั่น',
    'Ranking Module': 'โมดูลจัดอันดับ',
    'Restart Announce Module': 'โมดูลประกาศก่อนรีสตาร์ต',
    'Support Module': 'โมดูลช่วยเหลือ',
    'Staff Roles': 'บทบาททีมงาน',
    'Analytics Module': 'โมดูลวิเคราะห์',
    'Sync Agent': 'บอทซิงก์',
    'Execute Agent': 'บอทส่งของ',
    Provider: 'ผู้ให้บริการ',
    Collected: 'รับเงินแล้ว',
    'Open invoices': 'ใบแจ้งหนี้ที่ยังเปิด',
    'Disputed invoices': 'ใบแจ้งหนี้ที่มีข้อโต้แย้ง',
    'Refunded invoices': 'ใบแจ้งหนี้ที่คืนเงินแล้ว',
    'Invoices waiting for billing review': 'ใบแจ้งหนี้ที่รอฝ่ายการเงินตรวจสอบ',
    'Invoices already refunded': 'ใบแจ้งหนี้ที่คืนเงินแล้ว',
    'Cancel subscription': 'ยกเลิกการสมัครใช้งาน',
    'Reactivate subscription': 'เปิดการสมัครใช้งานอีกครั้ง',
    'No extra actions': 'ไม่มีคำสั่งเพิ่มเติม',
  });

  Object.assign(OWNER_ACTIVE_TEXT_MAP, {
    BOT_LOG: 'บันทึกบอท',
    BOT_LOG_DELIVERY: 'บันทึกบอท + ส่งของ',
    FULL_OPTION: 'จัดการเต็มรูปแบบ',
    SERVER_ONLY: 'เฉพาะเซิร์ฟเวอร์',
    'BOT_LOG · Bot Log': 'บันทึกบอท',
    'BOT_LOG_DELIVERY · Bot Log + Delivery': 'บันทึกบอท + ส่งของ',
    'FULL_OPTION · Full Option': 'จัดการเต็มรูปแบบ',
    'SERVER_ONLY · Server Only': 'เฉพาะเซิร์ฟเวอร์',
    platform_local: 'ระบบภายในแพลตฟอร์ม',
    Trial: 'ทดลองใช้',
    Pro: 'โปร',
    'Trial 14 days': 'ทดลองใช้ 14 วัน',
    'Pro Monthly': 'โปร รายเดือน',
    monthly: 'รายเดือน',
    quarterly: 'รายไตรมาส',
    yearly: 'รายปี',
    draft: 'แบบร่าง',
    archived: 'เก็บถาวร',
  });

  function translateOwnerActiveText(value) {
    const text = trimText(value, 400);
    if (!text) return '';
    if (OWNER_ACTIVE_TEXT_MAP[text]) return OWNER_ACTIVE_TEXT_MAP[text];
    return text
      .replace(/^Renews (.+)$/u, 'ต่ออายุ $1')
      .replace(/^Current status:\s*/u, 'สถานะปัจจุบัน: ')
      .replace(/^Queue depth\s+/u, 'คิวค้าง ')
      .replace(/Delivery Agent/gu, 'บอทส่งของ')
      .replace(/Server Bot/gu, 'บอทเซิร์ฟเวอร์')
      .replace(/\bOwner\b/giu, 'เจ้าของระบบ')
      .replace(/\bAdmin Web\b/giu, 'เว็บเจ้าของระบบ')
      .replace(/\bOwner Web\b/giu, 'เว็บเจ้าของระบบ')
      .replace(/\bOwner Panel\b/giu, 'เจ้าของระบบ')
      .replace(/\bTenant Admin\b/giu, 'ผู้ดูแลลูกค้า')
      .replace(/ผู้เช่า/gu, 'ลูกค้า')
      .replace(/ซัพพอร์ต/gu, 'ดูแลลูกค้า')
      .replace(/\bworkspace\b/giu, 'พื้นที่งาน')
      .replace(/\bsession\b/giu, 'เซสชัน')
      .replace(/\bregistry\b/giu, 'ทะเบียนบริการ')
      .replace(/\bbinding\b/giu, 'การผูกเครื่อง')
      .replace(/\bbind\b/giu, 'ผูก')
      .replace(/\boffline\b/giu, 'ออฟไลน์')
      .replace(/\bentitlement\b/giu, 'สิทธิ์ใช้งาน')
      .replace(/diagnostics/giu, 'วินิจฉัยระบบ')
      .replace(/billing/giu, 'การเงิน')
      .replace(/service rows/gu, 'แถวบริการ')
      .replace(/dead letters/gu, 'งานค้างผิดพลาด')
      .replace(/delivery anomalies/gu, 'ความผิดปกติของการส่งของ')
      .replace(/request errors/gu, 'คำขอผิดพลาด');
  }

  function finalizeOwnerActiveText(value) {
    const text = translateOwnerActiveText(value);
    return String(text || '').trim()
      .replace(/\bdirect\b/gu, 'ขายตรง')
      .replace(/\btrialing\b/gu, 'กำลังทดลองใช้')
      .replace(/\btrial\b/gu, 'ทดลองใช้')
      .replace(/\bactive\b/gu, 'ใช้งานอยู่')
      .replace(/\bsuccess\b/gu, 'ปกติ')
      .replace(/Invoice:\s*no-invoice/gu, 'ใบแจ้งหนี้: ไม่มี')
      .replace(/(\d+)\s+failed payment attempts need recovery/gu, '$1 รายการชำระเงินล้มเหลวและต้องติดตาม')
      .replace(/(\d+)\s+invoices are still open or past due/gu, '$1 ใบแจ้งหนี้ยังเปิดอยู่หรือค้างชำระ')
      .replace(/(\d+)\s+invoices were marked disputed/gu, '$1 ใบแจ้งหนี้ถูกทำเครื่องหมายว่ามีข้อโต้แย้ง')
      .replace(/(\d+)\s+invoices were marked refunded/gu, '$1 ใบแจ้งหนี้ถูกคืนเงินแล้ว')
      .replace(/(\d+)\s+paid invoices/gu, '$1 ใบแจ้งหนี้ที่จ่ายแล้ว')
      .replace(/(\d+)\s+failed payment attempts/gu, '$1 รายการชำระที่ล้มเหลว');
  }

  function normalizeOwnerActiveText(value) {
    return repairMojibakeText(finalizeOwnerActiveText(value)).trim()
      .replace(/\bBOT_LOG_DELIVERY\b/gu, 'บันทึกบอท + ส่งของ')
      .replace(/\bBOT_LOG\b/gu, 'บันทึกบอท')
      .replace(/\bFULL_OPTION\b/gu, 'จัดการเต็มรูปแบบ')
      .replace(/\bSERVER_ONLY\b/gu, 'เฉพาะเซิร์ฟเวอร์')
      .replace(/\bplatform_local\b/gu, 'ระบบภายในแพลตฟอร์ม')
      .replace(/\bmonthly\b/gu, 'รายเดือน')
      .replace(/\bquarterly\b/gu, 'รายไตรมาส')
      .replace(/\byearly\b/gu, 'รายปี')
      .replace(/\bdraft\b/gu, 'แบบร่าง')
      .replace(/\barchived\b/gu, 'เก็บถาวร');
  }

  function normalizeOwnerActiveTextV2(value) {
    return String(normalizeOwnerActiveText(value) || '').trim()
      .replace(/เว็บเจ้าของระบบ เซสชัน Idle Minutes/giu, 'เวลาหมดอายุเมื่อไม่ใช้งานของเว็บเจ้าของระบบ (นาที)')
      .replace(/เว็บเจ้าของระบบ เซสชัน Max Per User/giu, 'จำนวนเซสชันพร้อมกันสูงสุดต่อผู้ใช้ของเว็บเจ้าของระบบ')
      .replace(/เว็บเจ้าของระบบ Secure Cookie/giu, 'คุกกี้แบบปลอดภัยของเว็บเจ้าของระบบ')
      .replace(/Use secure cookies for เว็บเจ้าของระบบ/giu, 'ใช้คุกกี้แบบปลอดภัยกับเว็บเจ้าของระบบ')
      .replace(/เว็บเจ้าของระบบ HSTS Enabled/giu, 'การเปิดใช้ HSTS ของเว็บเจ้าของระบบ')
      .replace(/Enable HSTS headers on เว็บเจ้าของระบบ/giu, 'เปิดใช้ส่วนหัว HSTS บนเว็บเจ้าของระบบ')
      .replace(/Enforce Origin Check/giu, 'บังคับตรวจแหล่งที่มา')
      .replace(/เว็บเจ้าของระบบ Allowed Origins/giu, 'แหล่งที่มาที่อนุญาตของเว็บเจ้าของระบบ')
      .replace(/Language used for Discord admin-log operational การแจ้งเตือน/giu, 'ภาษาที่ใช้กับการแจ้งเตือนบันทึกผู้ดูแลผ่าน Discord')
      .replace(/TOTP สำหรับการเข้าสู่ระบบของ Owner/giu, 'TOTP สำหรับการเข้าสู่ระบบของเจ้าของระบบ')
      .replace(/Standalone เจ้าของระบบ and tenant เว็บเจ้าของระบบ บอท/giu, 'เว็บแยกของเจ้าของระบบและผู้ดูแลลูกค้า')
      .replace(/Discord command and automation บอท/giu, 'บอตคำสั่ง Discord และงานอัตโนมัติ')
      .replace(/SCUM log watcher and sync บอท/giu, 'บอตติดตาม SCUM.log และซิงก์ข้อมูล')
      .replace(/Server-side sync, config, backup, and server control บอท/giu, 'บอตฝั่งเซิร์ฟเวอร์สำหรับซิงก์ คอนฟิก สำรองข้อมูล และควบคุมเซิร์ฟเวอร์')
      .replace(/Execution บอท for managed SCUM commands/giu, 'บอตประมวลคำสั่ง SCUM ที่ระบบดูแลให้')
      .replace(/\bcookie\b/giu, 'คุกกี้')
      .replace(/\bThai\b/giu, 'ไทย')
      .replace(/\bunlimited\b/giu, 'ไม่จำกัด')
      .replace(/\bBOT_LOG_DELIVERY\b/giu, 'บันทึกบอท + ส่งของ')
      .replace(/\bBOT_LOG\b/giu, 'บันทึกบอท')
      .replace(/\bFULL_OPTION\b/giu, 'จัดการเต็มรูปแบบ')
      .replace(/\bSERVER_ONLY\b/giu, 'เฉพาะเซิร์ฟเวอร์')
      .replace(/\bplatform_local\b/giu, 'ระบบภายในแพลตฟอร์ม')
      .replace(/\btrialing\b/giu, 'กำลังทดลองใช้')
      .replace(/\btrial\b/giu, 'ทดลองใช้')
      .replace(/\bactive\b/giu, 'ใช้งานอยู่')
      .replace(/\bmonthly\b/giu, 'รายเดือน')
      .replace(/\bquarterly\b/giu, 'รายไตรมาส')
      .replace(/\byearly\b/giu, 'รายปี')
      .replace(/\bdraft\b/giu, 'แบบร่าง')
      .replace(/\barchived\b/giu, 'เก็บถาวร')
      .replace(/\binvoice\b/giu, 'ใบแจ้งหนี้')
      .replace(/\bruntime\b/giu, 'บอท');
  }

  function localizeOwnerElementText(node) {
    if (!(node instanceof Element)) return;
    if (node.closest('[data-owner-static-copy="1"]')) return;
    const insideOwnerShell = node.closest('.ownerx-shell');
    const insideControlWorkspace = node.closest('#owner-control-workspace');
    if (insideOwnerShell && !insideControlWorkspace) return;
    const tags = new Set(['A', 'BUTTON', 'TH', 'TD', 'LABEL', 'OPTION', 'P', 'SPAN', 'STRONG', 'SMALL', 'H1', 'H2', 'H3', 'H4', 'DIV', 'LI']);
    if (tags.has(node.tagName) && node.children.length === 0) {
      const rawText = trimText(node.textContent, 400);
      const translated = normalizeOwnerActiveTextV2(rawText);
      if (translated && translated !== rawText) {
        node.textContent = translated;
      }
    }
    if (node.hasAttribute('title')) {
      const rawTitle = trimText(node.getAttribute('title'), 400);
      const translatedTitle = normalizeOwnerActiveTextV2(rawTitle);
      if (translatedTitle && translatedTitle !== rawTitle) {
        node.setAttribute('title', translatedTitle);
      }
    }
    ['placeholder', 'aria-label'].forEach((attribute) => {
      if (!node.hasAttribute(attribute)) return;
      const rawValue = trimText(node.getAttribute(attribute), 400);
      const translated = normalizeOwnerActiveTextV2(rawValue);
      if (translated && translated !== rawValue) {
        node.setAttribute(attribute, translated);
      }
    });
  }

  function localizeOwnerActivePage(scopeNode = document) {
    if (!(scopeNode instanceof Element || scopeNode instanceof Document)) return;
    const rootNode = scopeNode instanceof Document ? scopeNode.documentElement : scopeNode;
    scopeNode.querySelectorAll('*').forEach((node) => localizeOwnerElementText(node));
    if (rootNode && typeof document !== 'undefined' && typeof NodeFilter !== 'undefined') {
      const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        const parent = textNode.parentElement;
        if (parent) {
          const insideOwnerShell = parent.closest('.ownerx-shell');
          const insideControlWorkspace = parent.closest('#owner-control-workspace');
          if (!parent.closest('[data-owner-static-copy="1"]') && (!insideOwnerShell || insideControlWorkspace)) {
            const rawText = trimText(textNode.nodeValue, 400);
            const translated = normalizeOwnerActiveTextV2(rawText);
            if (translated && translated !== rawText) {
              textNode.nodeValue = textNode.nodeValue.replace(rawText, translated);
            }
          }
        }
        textNode = walker.nextNode();
      }
    }
  }

  let ownerControlWorkspaceLocaleObserver = null;

  function observeOwnerControlWorkspaceLocalization(rootNode) {
    if (ownerControlWorkspaceLocaleObserver) {
      ownerControlWorkspaceLocaleObserver.disconnect();
      ownerControlWorkspaceLocaleObserver = null;
    }
    if (!(rootNode instanceof Element) || typeof MutationObserver === 'undefined') return;
    ownerControlWorkspaceLocaleObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          localizeOwnerActivePage(rootNode);
          return;
        }
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              localizeOwnerActivePage(node);
            } else if (node instanceof Text && node.parentElement) {
              localizeOwnerActivePage(node.parentElement);
            }
          });
        }
      }
    });
    ownerControlWorkspaceLocaleObserver.observe(rootNode, {
      childList: true,
      subtree: true,
      characterData: true,
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

  function trimText(value, maxLen = 240) {
    const text = repairMojibakeText(value).trim();
    if (!text) return '';
    return text.length <= maxLen ? text : text.slice(0, maxLen);
  }

  function toIsoDateTime(value) {
    const text = trimText(value, 80);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toISOString();
  }

  function root() {
    return document.getElementById('ownerV4AppRoot');
  }

  function statusNode() {
    return document.getElementById('ownerV4Status');
  }

  function setStatus(message, tone) {
    const node = statusNode();
    if (!node) return;
    node.textContent = normalizeOwnerActiveTextV2(String(message || '').trim());
    node.dataset.tone = tone || 'muted';
  }

  function renderMessageCard(title, detail) {
    const target = root();
    if (!target) return;
    target.innerHTML = [
      '<section style="padding:32px;border:1px solid rgba(212,186,113,.18);border-radius:24px;background:rgba(13,17,14,.92);box-shadow:0 24px 56px rgba(0,0,0,.28)">',
      `<h1 style="margin:0 0 12px;font:700 32px/1.05 'IBM Plex Sans Thai','Segoe UI',sans-serif;color:#f4efe4">${escapeHtml(normalizeOwnerActiveTextV2(title))}</h1>`,
      `<p style="margin:0;color:rgba(244,239,228,.74);font:400 15px/1.7 'IBM Plex Sans Thai','Segoe UI',sans-serif">${escapeHtml(normalizeOwnerActiveTextV2(detail))}</p>`,
      '</section>',
    ].join('');
  }

  async function api(path, fallback, options = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 && controller
      ? window.setTimeout(() => controller.abort(), options.timeoutMs)
      : null;
    const method = trimText(options.method || 'GET', 12) || 'GET';
    const headers = {
      Accept: 'application/json',
      ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
    };
    let body;
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    try {
      const response = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers,
        body,
        signal: controller ? controller.signal : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        if (response.status === 401) {
          window.location.href = '/owner/login';
          return fallback;
        }
        throw new Error(String(payload?.error || `คำขอล้มเหลว (${response.status})`));
      }
      return payload?.data ?? fallback;
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      if (aborted && options.allowTimeoutFallback) {
        return fallback;
      }
      throw error;
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  function optionalOwnerRead(path, fallback, timeoutMs = 2500) {
    return api(path, fallback, {
      timeoutMs,
      allowTimeoutFallback: true,
    }).catch(() => fallback);
  }

  function safeOwnerRead(path, fallback, warnings, label, options = {}) {
    return api(path, fallback, {
      timeoutMs: 3000,
      allowTimeoutFallback: true,
      ...(options && typeof options === 'object' ? options : {}),
    }).catch(() => {
      if (Array.isArray(warnings) && label) {
        warnings.push(label);
      }
      return fallback;
    });
  }

  function applyOwnerSurfaceStatus() {
    if (!state.payload || state.refreshing) return;
    const warningCount = Array.isArray(state.payload.__loadWarnings)
      ? state.payload.__loadWarnings.length
      : 0;
    if (warningCount > 0) {
      setStatus(`โหลดข้อมูล Owner ได้บางส่วน (${warningCount} แหล่งข้อมูลยังไม่พร้อม)`, 'warning');
      return;
    }
    setStatus(t('owner.app.status.ready', 'พร้อมใช้งาน'), 'success');
  }

  function resolveOwnerRouteFromSegments(rawSegments) {
    const segments = Array.isArray(rawSegments) ? rawSegments.filter(Boolean) : [];
    if (!segments.length) return '';
    if (segments[0] === 'dashboard') return 'overview';
    if (segments[0] === 'packages' && segments[1] === 'create') return 'packages-create';
    if (segments[0] === 'packages' && segments[1] === 'entitlements') return 'packages-entitlements';
    if (segments[0] === 'packages' && segments[1]) {
      return `package-${decodeURIComponent(segments[1]).trim().toLowerCase()}`;
    }
    if (segments[0] === 'tenants' && segments[1] === 'new') {
      return 'create-tenant';
    }
    if (segments[0] === 'tenants' && segments[1]) {
      return `tenant-${decodeURIComponent(segments[1]).trim().toLowerCase()}`;
    }
    if (segments[0] === 'support' && segments[1]) {
      return `support-${decodeURIComponent(segments[1]).trim().toLowerCase()}`;
    }
    if (segments[0] === 'subscriptions' && segments[1] === 'registry') return 'subscriptions-registry';
    if (segments[0] === 'subscriptions' && segments[1]) {
      return `subscription-${decodeURIComponent(segments[1]).trim().toLowerCase()}`;
    }
    if (segments[0] === 'billing' && segments[1] === 'recovery') return 'billing-recovery';
    if (segments[0] === 'billing' && segments[1] === 'invoice' && segments[2]) {
      return `invoice-${decodeURIComponent(segments[2]).trim().toLowerCase()}`;
    }
    if (segments[0] === 'billing' && segments[1] === 'invoice') return 'invoice-detail';
    if (segments[0] === 'billing' && segments[1] === 'attempt' && segments[2]) {
      return `attempt-${decodeURIComponent(segments[2]).trim().toLowerCase()}`;
    }
    if (segments[0] === 'billing' && segments[1] === 'attempt') return 'attempt-detail';
    if (segments[0] === 'billing' && segments[1] === 'attempts') return 'billing-attempts';
    if (segments[0] === 'runtime' && segments[1]) {
      const runtimeSegment = decodeURIComponent(segments[1]).trim().toLowerCase();
      if (runtimeSegment === 'overview') return 'runtime';
      if (runtimeSegment === 'create-server') return 'runtime-create-server';
      if (runtimeSegment === 'provision-runtime') return 'runtime-provision-runtime';
      return runtimeSegment;
    }
    if (segments[0] === 'analytics' && segments[1] === 'overview') return 'analytics';
    if (segments[0] === 'analytics' && segments[1] === 'risk') return 'analytics-risk';
    if (segments[0] === 'analytics' && segments[1] === 'packages') return 'analytics-packages';
    if (segments[0] === 'recovery' && segments[1] === 'overview') return 'recovery';
    if (segments[0] === 'recovery' && segments[1] === 'create') return 'recovery-create';
    if (segments[0] === 'recovery' && segments[1] === 'preview') return 'recovery-preview';
    if (segments[0] === 'recovery' && segments[1] === 'restore') return 'recovery-restore';
    if (segments[0] === 'recovery' && segments[1] === 'history') return 'recovery-history';
    if (segments[0] === 'security' && segments[1] === 'overview') return 'security';
    if (segments[0] === 'settings' && segments[1] === 'overview') return 'settings';
    if (segments[0] === 'settings' && segments[1] === 'admin-users') return 'settings-admin-users';
    if (segments[0] === 'settings' && segments[1] === 'services') return 'settings-services';
    if (segments[0] === 'settings' && segments[1] === 'access-policy') return 'settings-access-policy';
    if (segments[0] === 'settings' && segments[1] === 'portal-policy') return 'settings-portal-policy';
    if (segments[0] === 'settings' && segments[1] === 'billing-policy') return 'settings-billing-policy';
    if (segments[0] === 'settings' && segments[1] === 'runtime-policy') return 'settings-runtime-policy';
    return PATH_PAGE_ALIASES[segments[0]] || segments[segments.length - 1] || segments[0];
  }

  function getRawPathRoute() {
    const path = String(window.location.pathname || '').trim().toLowerCase();
    if (!path.startsWith('/owner')) return '';
    const relative = path.slice('/owner'.length).replace(/^\/+/, '');
    if (!relative) return '';
    const segments = relative.split('/').filter(Boolean);
    if (!segments.length) return '';
    return resolveOwnerRouteFromSegments(segments);
  }

  function isOwnerStitchHost() {
    return Boolean(window.__OWNER_STITCH_ROUTE__);
  }

  function isKnownOwnerRouteAlias(rawRoute) {
    const normalizedRoute = String(rawRoute || '').trim().toLowerCase();
    return Boolean(
      normalizedRoute
      && (
        Object.prototype.hasOwnProperty.call(PAGE_ALIASES, normalizedRoute)
        || normalizedRoute === 'create-tenant'
        || normalizedRoute.startsWith('tenant-')
        || normalizedRoute.startsWith('support-')
        || normalizedRoute.startsWith('package-')
        || normalizedRoute.startsWith('subscription-')
        || normalizedRoute.startsWith('invoice-')
        || normalizedRoute.startsWith('attempt-')
      )
    );
  }

  function bootstrapLegacyOwnerRoute() {
    if (isOwnerStitchHost()) return;
    const rawHashRoute = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!isKnownOwnerRouteAlias(rawHashRoute)) return;
    const canonicalPath = buildCanonicalOwnerPath(rawHashRoute, resolveOwnerPage(rawHashRoute));
    window.history.replaceState({}, '', `${canonicalPath}${window.location.search || ''}`);
  }

  function resolveOwnerPage(rawRoute) {
    const raw = String(rawRoute || '').trim().toLowerCase();
    if (!raw) return 'dashboard';
    if (PAGE_ALIASES[raw]) return PAGE_ALIASES[raw];
    if (
      raw === 'create-tenant'
      || raw.startsWith('tenant-')
      || raw.startsWith('support-')
      || raw.startsWith('package-')
      || raw.startsWith('subscription-')
      || raw.startsWith('invoice-')
      || raw.startsWith('attempt-')
    ) {
      return 'tenants';
    }
    return 'dashboard';
  }

  function buildCanonicalOwnerPath(rawRoute, page) {
    const normalizedRoute = String(rawRoute || '').trim().toLowerCase();
    if (normalizedRoute.startsWith('tenant-')) {
      return `/owner/tenants/${encodeURIComponent(normalizedRoute.slice('tenant-'.length))}`;
    }
    if (normalizedRoute.startsWith('support-')) {
      return `/owner/support/${encodeURIComponent(normalizedRoute.slice('support-'.length))}`;
    }
    if (normalizedRoute.startsWith('package-')) {
      return `/owner/packages/${encodeURIComponent(normalizedRoute.slice('package-'.length))}`;
    }
    if (normalizedRoute.startsWith('subscription-')) {
      return `/owner/subscriptions/${encodeURIComponent(normalizedRoute.slice('subscription-'.length))}`;
    }
    if (normalizedRoute.startsWith('invoice-')) {
      return `/owner/billing/invoice/${encodeURIComponent(normalizedRoute.slice('invoice-'.length))}`;
    }
    if (normalizedRoute.startsWith('attempt-')) {
      return `/owner/billing/attempt/${encodeURIComponent(normalizedRoute.slice('attempt-'.length))}`;
    }
    if (normalizedRoute === 'create-tenant') return '/owner/tenants/new';
    if (normalizedRoute === 'packages') return '/owner/packages';
    if (normalizedRoute === 'packages-create') return '/owner/packages/create';
    if (normalizedRoute === 'packages-entitlements') return '/owner/packages/entitlements';
    if (normalizedRoute === 'subscriptions') return '/owner/subscriptions';
    if (normalizedRoute === 'subscriptions-registry') return '/owner/subscriptions/registry';
    if (normalizedRoute === 'billing') return '/owner/billing';
    if (normalizedRoute === 'billing-recovery') return '/owner/billing/recovery';
    if (normalizedRoute === 'billing-attempts') return '/owner/billing/attempts';
    if (normalizedRoute === 'audit') return '/owner/audit';
    if (normalizedRoute === 'security') return '/owner/security/overview';
    if (normalizedRoute === 'settings') return '/owner/settings/overview';
    if (normalizedRoute === 'settings-admin-users') return '/owner/settings/admin-users';
    if (normalizedRoute === 'settings-services') return '/owner/settings/services';
    if (normalizedRoute === 'settings-access-policy') return '/owner/settings/access-policy';
    if (normalizedRoute === 'settings-portal-policy') return '/owner/settings/portal-policy';
    if (normalizedRoute === 'settings-billing-policy') return '/owner/settings/billing-policy';
    if (normalizedRoute === 'settings-runtime-policy') return '/owner/settings/runtime-policy';
    if (normalizedRoute === 'automation') return '/owner/automation';
    if (normalizedRoute === 'observability' || normalizedRoute === 'analytics') return '/owner/analytics/overview';
    if (normalizedRoute === 'analytics-risk') return '/owner/analytics/risk';
    if (normalizedRoute === 'analytics-packages') return '/owner/analytics/packages';
    if (normalizedRoute === 'recovery') return '/owner/recovery/overview';
    if (normalizedRoute === 'recovery-create') return '/owner/recovery/create';
    if (normalizedRoute === 'recovery-preview') return '/owner/recovery/preview';
    if (normalizedRoute === 'recovery-restore') return '/owner/recovery/restore';
    if (normalizedRoute === 'recovery-history') return '/owner/recovery/history';
    if (normalizedRoute === 'runtime-create-server') return '/owner/runtime/create-server';
    if (normalizedRoute === 'runtime-provision-runtime') return '/owner/runtime/provision-runtime';
    if (normalizedRoute === 'agents-bots') return '/owner/runtime/agents-bots';
    if (normalizedRoute === 'fleet-diagnostics') return '/owner/runtime/fleet-diagnostics';
    if (normalizedRoute === 'runtime' || normalizedRoute === 'runtime-health') return '/owner/runtime/overview';
    if (normalizedRoute === 'incidents') return '/owner/incidents';
    if (normalizedRoute === 'jobs') return '/owner/jobs';
    if (normalizedRoute === 'support') return '/owner/support';
    if (normalizedRoute === 'control') return '/owner/control';
    if (normalizedRoute === 'access') return '/owner/access';
    if (normalizedRoute === 'diagnostics') return '/owner/diagnostics';
    if (
      normalizedRoute === 'tenants'
      || normalizedRoute === 'create-tenant'
      || normalizedRoute === 'commercial'
      || normalizedRoute === 'quota'
      || page === 'tenants'
    ) {
      return '/owner/tenants';
    }
    return '/owner';
  }

  function canonicalizeOwnerLinks(scopeNode) {
    const rootNode = scopeNode instanceof Element ? scopeNode : document;
    rootNode.querySelectorAll('a[href^="#"], a[href^="/owner"]').forEach((link) => {
      if (link.dataset.ownerLocalFocus === '1') return;
      const target = trimText(link.getAttribute('href'), 160);
      if (!target || target === '#') return;
      let rawRoute = '';
      if (target.startsWith('/owner')) {
        const relative = target.slice('/owner'.length).replace(/^\/+/, '');
        const segments = relative.split('/').filter(Boolean);
        if (!segments.length) {
          rawRoute = 'overview';
        } else {
          rawRoute = resolveOwnerRouteFromSegments(segments);
        }
      } else {
        rawRoute = target.replace(/^#/, '').trim().toLowerCase();
      }
      if (!rawRoute) return;
      const page = resolveOwnerPage(rawRoute);
      const canonicalPath = buildCanonicalOwnerPath(rawRoute, page);
      if (canonicalPath && target !== canonicalPath) {
        link.setAttribute('href', canonicalPath);
      }
    });
  }

  function routeTargetSelector(route) {
    const normalized = String(route || '').trim().toLowerCase();
    if (!normalized) return '';
    const escaped = normalized
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    return `#${escaped}, [data-owner-focus-route~="${escaped}"]`;
  }

  function focusCurrentRoute(rawRoute, page) {
    const route = String(rawRoute || '').trim().toLowerCase() || (page === 'runtime' ? 'runtime-health' : page === 'tenants' ? 'tenants' : 'overview');
    const fallbackRoute = window.OwnerControlV4?.normalizeOwnerControlRoute?.(route);
    const selectors = [routeTargetSelector(route)];
    if (fallbackRoute && fallbackRoute !== route) {
      selectors.push(routeTargetSelector(fallbackRoute));
    }
    const selector = selectors.find(Boolean);
    if (!selector) return;
    const node = selectors.reduce((match, current) => match || (current ? document.querySelector(current) : null), null);
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.classList.remove('odv4-focus-target-active');
      node.classList.add('odv4-focus-target-active');
      node.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      window.setTimeout(() => {
        node.classList.remove('odv4-focus-target-active');
      }, 1600);
    });
  }

  function focusLocalTarget(targetValue) {
    const target = trimText(targetValue, 160);
    if (!target || target === '#') return;
    const node = target.startsWith('#')
      ? document.getElementById(target.slice(1))
      : document.querySelector(target);
    if (!node) return;
    node.classList.remove('odv4-focus-target-active');
    node.classList.add('odv4-focus-target-active');
    node.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    window.setTimeout(() => {
      node.classList.remove('odv4-focus-target-active');
    }, 1600);
  }

  function parseNumericValue(value) {
    const raw = trimText(value, 80);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatOwnerActionStatus(status) {
    const normalizedStatus = trimText(status, 80).toLowerCase().replace(/_/g, ' ');
    if (!normalizedStatus) return 'ไม่ทราบสถานะ';
    return normalizeOwnerActiveTextV2(normalizedStatus);
  }

  function resetOwnerSupportCaseCache() {
    state.ownerUi.supportCaseTenantId = '';
    state.ownerUi.supportCase = null;
    state.ownerUi.supportCaseLoading = false;
  }

  function buildOwnerIdentityFollowupReason(action, existingReason) {
    const reason = trimText(existingReason, 400);
    if (action === 'resolve-identity-followup') {
      return reason
        ? `Owner resolved follow-up: ${reason}`
        : 'Owner resolved the identity follow-up from the support workspace.';
    }
    if (action === 'reassign-identity-followup') {
      return reason
        ? `Owner reassigned follow-up to tenant: ${reason}`
        : 'Owner reassigned the identity follow-up to the tenant workspace.';
    }
    return reason;
  }

  function buildFormPayload(form) {
    const payload = {};
    const formData = new FormData(form);
    formData.forEach((value, key) => {
      payload[key] = typeof value === 'string' ? value.trim() : value;
    });
    return payload;
  }

  function assignNestedValue(target, path, value) {
    const segments = String(path || '').split('.').map((segment) => segment.trim()).filter(Boolean);
    if (!segments.length) return target;
    let pointer = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (!pointer[segment] || typeof pointer[segment] !== 'object' || Array.isArray(pointer[segment])) {
        pointer[segment] = {};
      }
      pointer = pointer[segment];
    }
    pointer[segments[segments.length - 1]] = value;
    return target;
  }

  function buildStructuredFormPayload(form) {
    const payload = {};
    const formData = new FormData(form);
    formData.forEach((value, key) => {
      const normalizedValue = typeof value === 'string' ? value.trim() : value;
      if (String(key || '').includes('.')) {
        assignNestedValue(payload, key, normalizedValue);
        return;
      }
      payload[key] = normalizedValue;
    });
    return payload;
  }

  function findTenantRowById(tenantId) {
    const normalizedTenantId = trimText(tenantId, 160);
    return Array.isArray(state.payload?.tenants)
      ? state.payload.tenants.find((row) => trimText(row?.id, 160) === normalizedTenantId) || null
      : null;
  }

  function buildOwnerControlModel(rawRoute) {
    if (!state.payload || !window.OwnerControlV4?.createOwnerControlV4Model) return null;
    return window.OwnerControlV4.createOwnerControlV4Model(state.payload, {
      currentRoute: rawRoute,
      selectedRuntimeKey: state.ownerUi.selectedRuntimeKey,
      runtimeBootstrap: state.ownerUi.runtimeBootstrap,
      automationPreview: state.ownerUi.automationPreview,
      supportCase: state.ownerUi.supportCase,
      supportCaseLoading: state.ownerUi.supportCaseLoading,
      supportDeadLetters: state.ownerUi.supportDeadLetters,
      supportDeadLettersLoading: state.ownerUi.supportDeadLettersLoading,
    });
  }

  function getSupportContextTenantId(rawRoute) {
    const normalizedRoute = trimText(rawRoute, 200).toLowerCase();
    if (normalizedRoute.startsWith('support-')) {
      return trimText(normalizedRoute.slice('support-'.length), 160);
    }
    if (normalizedRoute.startsWith('tenant-')) {
      return trimText(normalizedRoute.slice('tenant-'.length), 160);
    }
    return '';
  }

  function isSupportContextRoute(rawRoute) {
    return trimText(rawRoute, 200).toLowerCase().startsWith('support-');
  }

  function requestSupportCaseForRoute(rawRoute, options = {}) {
    const tenantId = getSupportContextTenantId(rawRoute);
    if (!tenantId) return;
    const force = options && options.force === true;
    if (
      !force
      && state.ownerUi.supportCaseTenantId === tenantId
      && (state.ownerUi.supportCaseLoading || state.ownerUi.supportCase)
    ) {
      return;
    }
    state.ownerUi.supportCaseTenantId = tenantId;
    state.ownerUi.supportCase = null;
    state.ownerUi.supportCaseLoading = true;
    state.ownerUi.supportCaseRequestId += 1;
    const requestId = state.ownerUi.supportCaseRequestId;
    optionalOwnerRead(
      `/admin/api/platform/tenant-support-case?tenantId=${encodeURIComponent(tenantId)}&limit=25`,
      null,
      3500,
    ).then((bundle) => {
      if (state.ownerUi.supportCaseRequestId !== requestId) return;
      state.ownerUi.supportCaseTenantId = tenantId;
      state.ownerUi.supportCase = bundle;
      state.ownerUi.supportCaseLoading = false;
      renderCurrentPage();
    }).catch(() => {
      if (state.ownerUi.supportCaseRequestId !== requestId) return;
      state.ownerUi.supportCaseTenantId = tenantId;
      state.ownerUi.supportCase = null;
      state.ownerUi.supportCaseLoading = false;
      renderCurrentPage();
    });
  }

  function requestSupportDeadLettersForRoute(rawRoute, options = {}) {
    const tenantId = getSupportContextTenantId(rawRoute);
    if (!tenantId || !isSupportContextRoute(rawRoute)) return;
    const force = options && options.force === true;
    if (
      !force
      && state.ownerUi.supportDeadLettersTenantId === tenantId
      && (state.ownerUi.supportDeadLettersLoading || state.ownerUi.supportDeadLetters.length > 0)
    ) {
      return;
    }
    state.ownerUi.supportDeadLettersTenantId = tenantId;
    state.ownerUi.supportDeadLetters = [];
    state.ownerUi.supportDeadLettersLoading = true;
    state.ownerUi.supportDeadLettersRequestId += 1;
    const requestId = state.ownerUi.supportDeadLettersRequestId;
    optionalOwnerRead(
      `/admin/api/delivery/dead-letter?tenantId=${encodeURIComponent(tenantId)}&limit=25`,
      [],
      3500,
    ).then((rows) => {
      if (state.ownerUi.supportDeadLettersRequestId !== requestId) return;
      state.ownerUi.supportDeadLettersTenantId = tenantId;
      state.ownerUi.supportDeadLetters = Array.isArray(rows) ? rows : [];
      state.ownerUi.supportDeadLettersLoading = false;
      renderCurrentPage();
    }).catch(() => {
      if (state.ownerUi.supportDeadLettersRequestId !== requestId) return;
      state.ownerUi.supportDeadLettersTenantId = tenantId;
      state.ownerUi.supportDeadLetters = [];
      state.ownerUi.supportDeadLettersLoading = false;
      renderCurrentPage();
    });
  }

  function applyOwnerWorkspacePrimaryAction(controlRoot) {
    const primaryActionNode = document.querySelector('.odv4-pagehead-actions .odv4-button-primary');
    if (!primaryActionNode || !controlRoot) return;
    const label = trimText(controlRoot.dataset.ownerPrimaryLabel, 160);
    const href = trimText(controlRoot.dataset.ownerPrimaryHref, 160);
    if (label) primaryActionNode.textContent = label;
    if (href) primaryActionNode.setAttribute('href', href);
    if (controlRoot.dataset.ownerPrimaryLocalFocus === '1') {
      primaryActionNode.dataset.ownerLocalFocus = '1';
    } else {
      delete primaryActionNode.dataset.ownerLocalFocus;
    }
  }

  function mountOwnerControlWorkspace(rawRoute) {
    const target = root();
    if (!target || !state.payload || !window.OwnerControlV4?.buildOwnerControlV4Html) return;
    const model = buildOwnerControlModel(rawRoute);
    const html = window.OwnerControlV4.buildOwnerControlV4Html(model);
    const mainNode = target.querySelector('.odv4-main');
    if (!mainNode) return;
    const existing = mainNode.querySelector('#owner-control-workspace');
    existing?.remove();
    if (!html) return;
    const mount = document.createElement('div');
    mount.innerHTML = html;
    const controlRoot = mount.firstElementChild;
    if (!controlRoot) return;
    const insertAfter = mainNode.querySelector('.odv4-kpi-strip');
    if (insertAfter?.parentNode === mainNode && insertAfter.nextSibling) {
      mainNode.insertBefore(controlRoot, insertAfter.nextSibling);
    } else if (insertAfter?.parentNode === mainNode) {
      mainNode.appendChild(controlRoot);
    } else {
      mainNode.prepend(controlRoot);
    }
    applyI18n(controlRoot);
    applyOwnerWorkspacePrimaryAction(controlRoot);
  }

  async function ownerMutation(path, body, options = {}) {
    const result = await api(path, null, {
      method: options.method || 'POST',
      body,
    });
    return result;
  }

  async function handleOwnerFormSubmit(form) {
    const action = trimText(form?.dataset.ownerForm, 80);
    if (!action) return;
    const payload = buildStructuredFormPayload(form);
    if (action === 'backup-create') {
      if (!window.confirm('Create a new platform backup now?')) return;
      state.ownerUi.restorePreview = null;
      await ownerMutation('/admin/api/backup/create', {
        note: trimText(payload.note, 260) || null,
        includeSnapshot: String(payload.includeSnapshot || 'true').trim().toLowerCase() !== 'false',
      });
      await refreshState({ silent: true });
      setStatus('สร้าง backup แล้ว', 'success');
        navigateOwnerRoute('/owner/recovery/overview');
      return;
    }
    if (action === 'backup-preview') {
      const backup = trimText(payload.backup, 260);
      if (!backup) {
        throw new Error('เลือก backup ก่อนรัน dry-run preview');
      }
      const preview = await ownerMutation('/admin/api/backup/restore', {
        backup,
        dryRun: true,
      });
      state.ownerUi.restorePreview = preview || null;
      renderCurrentPage();
      setStatus('สร้าง restore preview แล้ว', 'success');
      navigateOwnerRoute('/owner/recovery/overview');
      return;
    }
    if (action === 'backup-restore') {
      const backup = trimText(payload.backup, 260);
      const confirmBackup = trimText(payload.confirmBackup, 260);
      const previewToken = trimText(payload.previewToken, 260);
      if (!backup) {
        throw new Error('ต้องเลือก backup จาก preview ก่อนกู้คืน');
      }
      if (!previewToken) {
        throw new Error('ต้องรัน dry-run preview ก่อนกู้คืน');
      }
      if (!confirmBackup) {
        throw new Error('พิมพ์ชื่อ backup เพื่อยืนยันการกู้คืน');
      }
      if (!window.confirm(`Restore ${backup} now? This action applies the previewed backup to the shared control plane.`)) return;
      await ownerMutation('/admin/api/backup/restore', {
        backup,
        dryRun: false,
        confirmBackup,
        previewToken,
      });
      state.ownerUi.restorePreview = null;
      await refreshState({ silent: true });
      setStatus('รัน restore แล้ว', 'success');
        navigateOwnerRoute('/owner/recovery/overview');
      return;
    }
    if (action === 'create-platform-server') {
      const tenantId = trimText(payload.tenantId, 160);
      const name = trimText(payload.name, 160);
      if (!tenantId || !name) {
        throw new Error('Tenant and server name are required');
      }
      const created = await ownerMutation('/owner/api/platform/server', {
        tenantId,
        name,
        slug: trimText(payload.slug, 160) || null,
        status: trimText(payload.status, 80) || 'active',
        locale: trimText(payload.locale, 40) || 'th',
        guildId: trimText(payload.guildId, 160) || null,
      });
      state.ownerUi.runtimeBootstrap = {
        bootstrap: {
          tenantId,
          serverId: trimText(created?.id || created?.serverId, 160),
          guildId: trimText(created?.guildId || payload.guildId, 160),
          agentId: '',
          runtimeKey: '',
          displayName: '',
        },
      };
      await refreshState({ silent: true });
      setStatus(`Created server record: ${trimText(created?.name || name, 160)}`, 'success');
      navigateOwnerRoute('/owner/runtime/provision-runtime');
      return;
    }
    if (action === 'provision-runtime') {
      const runtimeKind = trimText(payload.runtimeKind, 80).toLowerCase();
      const strictProfile = runtimeKind === 'delivery-agents'
        ? { role: 'execute', scope: 'execute_only', runtimeKind: 'delivery-agents' }
        : runtimeKind === 'server-bots'
          ? { role: 'sync', scope: 'sync_only', runtimeKind: 'server-bots' }
          : null;
      if (!strictProfile) {
        throw new Error('Choose a valid runtime role before issuing a setup token');
      }
      const tenantId = trimText(payload.tenantId, 160);
      const serverId = trimText(payload.serverId, 160);
      const agentId = trimText(payload.agentId, 160);
      const runtimeKey = trimText(payload.runtimeKey, 160);
      const displayName = trimText(payload.displayName, 160) || runtimeKey || agentId;
      const minimumVersion = trimText(payload.minimumVersion, 80) || '1.0.0';
      if (!tenantId || !serverId || !agentId || !runtimeKey) {
        throw new Error('Tenant, server ID, agent ID, and runtime key are required');
      }
      const result = await ownerMutation('/owner/api/platform/agent-provision', {
        tenantId,
        serverId,
        guildId: trimText(payload.guildId, 160) || null,
        agentId,
        runtimeKey,
        role: strictProfile.role,
        scope: strictProfile.scope,
        runtimeKind: strictProfile.runtimeKind,
        displayName,
        name: displayName,
        minimumVersion,
      });
      state.ownerUi.selectedRuntimeKey = trimText(result?.bootstrap?.runtimeKey || runtimeKey, 160);
      state.ownerUi.runtimeBootstrap = result;
      await refreshState({ silent: true });
      setStatus(`Issued setup token for ${displayName}`, 'success');
      navigateOwnerRoute('/owner/runtime/provision-runtime');
      return;
    }
    if (action === 'create-tenant') {
      const created = await ownerMutation('/owner/api/platform/tenant', {
        name: payload.name,
        slug: payload.slug,
        ownerName: payload.ownerName,
        ownerEmail: payload.ownerEmail,
        type: payload.type,
        status: payload.status,
        locale: payload.locale,
      });
      const tenantId = trimText(created?.id || payload.slug || payload.name, 160);
      state.ownerUi.runtimeBootstrap = null;
      await refreshState({ silent: true });
      setStatus('สร้างลูกค้าแล้ว', 'success');
      if (tenantId) {
        navigateOwnerRoute(`/owner/tenants/${encodeURIComponent(tenantId)}`);
      } else {
        navigateOwnerRoute('/owner/tenants');
      }
      return;
    }
    if (action === 'update-tenant') {
      const tenantId = trimText(payload.id, 160);
      await ownerMutation('/owner/api/platform/tenant', {
        id: tenantId,
        name: payload.name,
        slug: payload.slug,
        ownerName: payload.ownerName,
        ownerEmail: payload.ownerEmail,
        type: payload.type,
        status: payload.status,
        locale: payload.locale,
        parentTenantId: payload.parentTenantId,
      });
      state.ownerUi.runtimeBootstrap = null;
      await refreshState({ silent: true });
      setStatus('อัปเดตข้อมูลลูกค้าแล้ว', 'success');
      navigateOwnerRoute(`/owner/tenants/${encodeURIComponent(tenantId)}`);
      return;
    }
    if (action === 'update-subscription') {
      const subscriptionId = trimText(payload.subscriptionId, 160);
      const body = {
        tenantId: payload.tenantId,
        subscriptionId,
        packageId: payload.packageId,
        planId: payload.planId,
        billingCycle: payload.billingCycle,
        status: payload.status,
        amountCents: parseNumericValue(payload.amountCents),
        currency: payload.currency,
        renewsAt: payload.renewsAt ? toIsoDateTime(payload.renewsAt) : null,
        externalRef: payload.externalRef,
        metadata: {
          packageId: payload.packageId,
        },
      };
      const endpoint = subscriptionId
        ? '/owner/api/platform/subscription/update'
        : '/owner/api/platform/subscription';
      await ownerMutation(endpoint, body);
      await refreshState({ silent: true });
      setStatus(subscriptionId ? 'อัปเดตแพ็กเกจของลูกค้าแล้ว' : 'สร้างการสมัครใช้งานแล้ว', 'success');
      navigateOwnerRoute(`/owner/tenants/${encodeURIComponent(trimText(payload.tenantId, 160))}`);
      return;
    }
    if (action === 'quick-update-subscription') {
      const subscriptionId = trimText(payload.subscriptionId, 160);
      const body = {
        tenantId: payload.tenantId,
        subscriptionId,
        packageId: payload.packageId,
        planId: payload.planId,
        billingCycle: payload.billingCycle,
        status: payload.status,
        amountCents: parseNumericValue(payload.amountCents),
        currency: payload.currency,
        renewsAt: payload.renewsAt ? toIsoDateTime(payload.renewsAt) : null,
        externalRef: payload.externalRef,
        metadata: {
          packageId: payload.packageId,
        },
      };
      const endpoint = subscriptionId
        ? '/owner/api/platform/subscription/update'
        : '/owner/api/platform/subscription';
      await ownerMutation(endpoint, body);
      await refreshState({ silent: true });
      setStatus('อัปเดตการสมัครใช้งานแล้ว', 'success');
      navigateOwnerRoute('/owner/subscriptions');
      return;
    }
    if (action === 'create-package') {
      await ownerMutation('/owner/api/platform/package', {
        id: payload.id,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        position: parseNumericValue(payload.position),
        featureText: payload.featureText,
      });
      await refreshState({ silent: true });
      setStatus('สร้างแพ็กเกจแล้ว', 'success');
      navigateOwnerRoute('/owner/packages');
      return;
    }
    if (action === 'update-package') {
      await ownerMutation('/owner/api/platform/package/update', {
        id: payload.id,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        position: parseNumericValue(payload.position),
        featureText: payload.featureText,
      });
      await refreshState({ silent: true });
      setStatus('อัปเดตแพ็กเกจแล้ว', 'success');
      navigateOwnerRoute('/owner/packages');
      return;
    }
    if (action === 'update-control-panel-env') {
      const result = await ownerMutation('/owner/api/control-panel/env', payload);
      await refreshState({ silent: true });
      const changedCount = Number(result?.applySummary?.totalChanged || 0);
      const restartRequired = Boolean(result?.reloadRequired);
      const message = changedCount > 0
        ? `บันทึกการตั้งค่าระบบ ${changedCount} รายการแล้ว${restartRequired ? ' (ต้องรีสตาร์ตบริการ)' : ''}`
        : 'ยังไม่มีการตั้งค่าระบบที่เปลี่ยนแปลง';
      setStatus(message, restartRequired ? 'warning' : 'success');
          navigateOwnerRoute('/owner/settings/overview');
      return;
    }
    if (action === 'upsert-admin-user') {
      await ownerMutation('/owner/api/auth/user', {
        username: payload.username,
        role: payload.role,
        password: payload.password,
        isActive: payload.isActive === 'true',
        tenantId: trimText(payload.tenantId, 160) || null,
      });
      await refreshState({ silent: true });
      setStatus('บันทึกบัญชี Owner แล้ว', 'success');
          navigateOwnerRoute('/owner/settings/overview');
    }
  }

  async function handleOwnerAction(button) {
    const action = trimText(button?.dataset.ownerAction, 80);
    if (!action) return;
    if (!confirmOwnerAction(action, button)) return;
    if (action === 'inspect-runtime') {
      state.ownerUi.selectedRuntimeKey = trimText(button.dataset.runtimeKey, 160);
      state.ownerUi.runtimeBootstrap = null;
      navigateOwnerRoute('/owner/runtime/agents-bots');
      return;
    }
    if (action === 'set-tenant-status') {
      const tenantId = trimText(button.dataset.tenantId, 160);
      const tenant = findTenantRowById(tenantId);
      if (!tenant) {
        throw new Error('ไม่พบลูกค้าที่เลือก');
      }
      await ownerMutation('/owner/api/platform/tenant', {
        id: tenantId,
        name: tenant.name,
        slug: tenant.slug,
        ownerName: tenant.ownerName,
        ownerEmail: tenant.ownerEmail,
        type: tenant.type,
        status: trimText(button.dataset.targetStatus, 80) || tenant.status,
        locale: tenant.locale,
        parentTenantId: tenant.parentTenantId,
      });
      await refreshState({ silent: true });
      setStatus('อัปเดตสถานะลูกค้าแล้ว', 'success');
      navigateOwnerRoute(`/owner/tenants/${encodeURIComponent(tenantId)}`);
      return;
    }
    if (action === 'reissue-runtime-token') {
      const result = await ownerMutation('/owner/api/platform/agent-provision', {
        tenantId: button.dataset.tenantId,
        serverId: button.dataset.serverId,
        guildId: button.dataset.guildId,
        agentId: button.dataset.agentId,
        runtimeKey: button.dataset.runtimeKey,
        role: button.dataset.role,
        scope: button.dataset.scope,
        runtimeKind: button.dataset.runtimeKind,
        displayName: button.dataset.displayName,
        name: button.dataset.displayName || button.dataset.runtimeKey,
        minimumVersion: button.dataset.minimumVersion,
      });
      state.ownerUi.selectedRuntimeKey = trimText(button.dataset.runtimeKey, 160);
      state.ownerUi.runtimeBootstrap = result;
      await refreshState({ silent: true });
      setStatus('ออก setup token ใหม่แล้ว', 'success');
      navigateOwnerRoute('/owner/runtime/provision-runtime');
      return;
    }
    if (action === 'reset-runtime-binding') {
      await ownerMutation('/owner/api/platform/agent-device/revoke', {
        tenantId: button.dataset.tenantId,
        deviceId: button.dataset.deviceId,
        runtimeKind: button.dataset.runtimeKind,
      });
      state.ownerUi.runtimeBootstrap = null;
      await refreshState({ silent: true });
      setStatus('รีเซ็ตการผูกบริการแล้ว', 'success');
      navigateOwnerRoute('/owner/runtime/agents-bots');
      return;
    }
    if (action === 'revoke-runtime') {
      const apiKeyId = trimText(button.dataset.apiKeyId, 160);
      const tokenId = trimText(button.dataset.tokenId, 160);
      const path = apiKeyId
        ? '/owner/api/platform/agent-token/revoke'
        : '/owner/api/platform/agent-provision/revoke';
      await ownerMutation(path, {
        tenantId: button.dataset.tenantId,
        apiKeyId,
        tokenId,
        runtimeKind: button.dataset.runtimeKind,
      });
      state.ownerUi.runtimeBootstrap = null;
      await refreshState({ silent: true });
      setStatus('ยกเลิกสิทธิ์บริการแล้ว', 'success');
      navigateOwnerRoute('/owner/runtime/agents-bots');
      return;
    }
    if (action === 'restart-managed-service') {
      await ownerMutation('/owner/api/runtime/restart-service', {
        service: trimText(button.dataset.serviceKey, 160),
      });
      await refreshState({ silent: true });
      setStatus(`เริ่มรีสตาร์ตบริการแล้ว: ${trimText(button.dataset.serviceLabel, 160) || 'บริการ'}`, 'success');
          navigateOwnerRoute('/owner/settings/overview');
      return;
    }
    if (action === 'run-platform-automation') {
      const dryRun = trimText(button.dataset.dryRun, 8) === 'true';
      if (!dryRun && !window.confirm('Run shared platform automation now?')) return;
      const result = await ownerMutation('/admin/api/platform/automation/run', {
        force: true,
        dryRun,
      });
      state.ownerUi.automationPreview = result || null;
      if (!dryRun) {
        await refreshState({ silent: true });
      }
      const actionCount = Array.isArray(result?.actions) ? result.actions.length : 0;
      const baseMessage = dryRun
        ? `Generated automation dry-run report (${actionCount} action${actionCount === 1 ? '' : 's'})`
        : `Ran shared automation (${actionCount} action${actionCount === 1 ? '' : 's'})`;
      const detail = trimText(result?.reason, 120);
      setStatus(detail ? `${baseMessage}: ${detail}` : baseMessage, dryRun ? 'success' : 'warning');
      navigateOwnerRoute('/owner/settings/overview');
      return;
    }
    if (action === 'revoke-admin-session') {
      await ownerMutation('/owner/api/auth/session/revoke', {
        sessionId: trimText(button.dataset.sessionId, 160),
        reason: 'owner-audit-revoke',
      });
      await refreshState({ silent: true });
      setStatus(`ยกเลิกเซสชันแล้ว: ${trimText(button.dataset.sessionUser, 160) || 'บัญชีผู้ดูแล'}`, 'success');
      navigateOwnerRoute('/owner/audit');
      return;
    }
    if (action === 'acknowledge-notification') {
      const notificationId = trimText(button.dataset.notificationId, 160);
      const returnRoute = trimText(button.dataset.returnRoute, 240);
      if (!notificationId) {
        throw new Error('ไม่พบการแจ้งเตือนที่เลือก');
      }
      await ownerMutation('/owner/api/notifications/ack', {
        ids: [notificationId],
      });
      await refreshState({ silent: true });
      setStatus('รับทราบการแจ้งเตือนแล้ว', 'success');
      navigateOwnerRoute(returnRoute || '/owner/audit');
      return;
    }
    if (action === 'resolve-identity-followup' || action === 'reassign-identity-followup') {
      const tenantId = trimText(button.dataset.tenantId, 160);
      const userId = trimText(button.dataset.userId, 160);
      const playerLabel = trimText(button.dataset.playerLabel, 160) || userId;
      const returnRoute = trimText(button.dataset.returnRoute, 240);
      const followupAction = trimText(button.dataset.followupAction, 80) || 'review';
      const supportIntent = trimText(button.dataset.supportIntent, 80) || 'review';
      const currentOutcome = trimText(button.dataset.supportOutcome, 80) || 'reviewing';
      const notificationId = trimText(button.dataset.notificationId, 160);
      const acknowledged = trimText(button.dataset.acknowledged, 8) === '1';
      if (!tenantId || !userId) {
        throw new Error('Identity follow-up action is missing required fields');
      }
      const isResolve = action === 'resolve-identity-followup';
      await ownerMutation('/admin/api/player/identity/review', {
        tenantId,
        userId,
        steamId: trimText(button.dataset.steamId, 160) || null,
        supportIntent,
        supportOutcome: isResolve
          ? 'resolved'
          : currentOutcome === 'resolved'
            ? 'reviewing'
            : currentOutcome,
        supportReason: buildOwnerIdentityFollowupReason(action, button.dataset.supportReason),
        supportSource: 'owner',
        followupAction,
      });
      if (notificationId && !acknowledged) {
        await ownerMutation('/owner/api/notifications/ack', {
          ids: [notificationId],
        });
      }
      resetOwnerSupportCaseCache();
      await refreshState({ silent: true });
      setStatus(
        isResolve
          ? `Resolved identity follow-up for ${playerLabel}`
          : `Reassigned identity follow-up for ${playerLabel}`,
        isResolve ? 'success' : 'warning',
      );
      navigateOwnerRoute(returnRoute || `/owner/support/${encodeURIComponent(tenantId)}`);
      return;
    }
    if (action === 'clear-acknowledged-notifications') {
      await ownerMutation('/owner/api/notifications/clear', {
        acknowledgedOnly: true,
      });
      await refreshState({ silent: true });
      setStatus('ล้างการแจ้งเตือนที่รับทราบแล้ว', 'success');
      navigateOwnerRoute('/owner/audit');
      return;
    }
    if (action === 'update-billing-invoice-status') {
      const invoiceId = trimText(button.dataset.invoiceId, 160);
      const status = trimText(button.dataset.targetStatus, 80);
      if (!invoiceId || !status) {
        throw new Error('ข้อมูลการทำงานกับใบแจ้งหนี้ยังไม่ครบ');
      }
      await ownerMutation('/owner/api/platform/billing/invoice/update', {
        tenantId: trimText(button.dataset.tenantId, 160),
        invoiceId,
        status,
        paidAt: status === 'paid'
          ? new Date().toISOString()
          : ['past_due', 'failed'].includes(status)
            ? null
            : undefined,
        metadata: {
          source: 'owner-panel',
          action: 'invoice-status-update',
        },
      });
      await refreshState({ silent: true });
      setStatus(`อัปเดตสถานะใบแจ้งหนี้แล้ว: ${formatOwnerActionStatus(status)}`, status === 'paid' ? 'success' : 'warning');
      navigateOwnerRoute('/owner/subscriptions');
      return;
    }
    if (action === 'update-payment-attempt-status') {
      const attemptId = trimText(button.dataset.attemptId, 160);
      const status = trimText(button.dataset.targetStatus, 80);
      if (!attemptId || !status) {
        throw new Error('ข้อมูลการทำงานกับรายการชำระเงินยังไม่ครบ');
      }
      const payload = {
        tenantId: trimText(button.dataset.tenantId, 160),
        attemptId,
        status,
        completedAt: ['succeeded', 'failed', 'canceled'].includes(status) ? new Date().toISOString() : null,
        errorCode: status === 'failed' ? 'owner-marked-failed' : '',
        errorDetail: status === 'failed' ? 'Marked as failed from Owner billing console' : '',
        metadata: {
          source: 'owner-panel',
          action: 'payment-attempt-update',
        },
      };
      await ownerMutation('/owner/api/platform/billing/payment-attempt/update', payload);
      await refreshState({ silent: true });
      setStatus(`อัปเดตสถานะรายการชำระเงินแล้ว: ${formatOwnerActionStatus(status)}`, status === 'succeeded' ? 'success' : 'warning');
      navigateOwnerRoute('/owner/subscriptions');
      return;
    }
    if (action === 'retry-billing-checkout') {
      const result = await ownerMutation('/owner/api/platform/billing/checkout-session', {
        tenantId: trimText(button.dataset.tenantId, 160),
        invoiceId: trimText(button.dataset.invoiceId, 160),
        subscriptionId: trimText(button.dataset.subscriptionId, 160),
        planId: trimText(button.dataset.planId, 120),
        packageId: trimText(button.dataset.packageId, 120),
        billingCycle: trimText(button.dataset.billingCycle, 40),
        amountCents: parseNumericValue(button.dataset.amountCents),
        currency: trimText(button.dataset.currency, 12) || 'THB',
        successUrl: '/payment-result',
        cancelUrl: '/checkout',
        metadata: {
          source: 'owner-panel',
          action: 'retry-checkout',
        },
      });
      const checkoutUrl = resolveSafeWindowOpenUrl(result?.session?.checkoutUrl);
      if (checkoutUrl && typeof window.open === 'function') {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      }
      await refreshState({ silent: true });
      setStatus(
        checkoutUrl
          ? ownerText('Opened the new checkout link in a new tab.', 'เปิดลิงก์ชำระเงินใหม่ในแท็บใหม่แล้ว')
          : ownerText('Created a new checkout session, but the returned link was not opened automatically.', 'สร้าง checkout session ใหม่แล้ว แต่ระบบไม่ได้เปิดลิงก์ให้อัตโนมัติ'),
        checkoutUrl ? 'success' : 'warning',
      );
      navigateOwnerRoute('/owner/subscriptions');
      return;
    }
    if (action === 'cancel-billing-subscription' || action === 'reactivate-billing-subscription') {
      const tenantId = trimText(button.dataset.tenantId, 160);
      const subscriptionId = trimText(button.dataset.subscriptionId, 160);
      const planId = trimText(button.dataset.planId, 120);
      if (!tenantId || !subscriptionId || !planId) {
        throw new Error('Subscription billing action is missing required fields');
      }
      const isCancel = action === 'cancel-billing-subscription';
      await ownerMutation('/owner/api/platform/subscription/update', {
        tenantId,
        subscriptionId,
        packageId: trimText(button.dataset.packageId, 120),
        planId,
        billingCycle: trimText(button.dataset.billingCycle, 40) || 'monthly',
        status: isCancel ? 'canceled' : 'active',
        amountCents: parseNumericValue(button.dataset.amountCents),
        currency: trimText(button.dataset.currency, 12) || 'THB',
        canceledAt: isCancel ? new Date().toISOString() : null,
        externalRef: trimText(button.dataset.externalRef, 200),
        metadata: {
          packageId: trimText(button.dataset.packageId, 120),
          source: 'owner-panel',
          action: isCancel ? 'subscription-cancel' : 'subscription-reactivate',
        },
      });
      await refreshState({ silent: true });
      setStatus(isCancel ? 'Subscription canceled' : 'Subscription reactivated', isCancel ? 'warning' : 'success');
      navigateOwnerRoute('/owner/subscriptions');
      return;
    }
    if (action === 'delete-package') {
      const packageId = trimText(button.dataset.packageId, 120).toUpperCase();
      const packageTitle = trimText(button.dataset.packageTitle, 180) || packageId;
      if (!packageId) {
        throw new Error('ไม่พบแพ็กเกจที่เลือก');
      }
      if (typeof window.confirm === 'function' && !window.confirm(`ลบแพ็กเกจ "${packageTitle}" ใช่หรือไม่?`)) {
        return;
      }
      await ownerMutation('/owner/api/platform/package/delete', {
        packageId,
      });
      await refreshState({ silent: true });
      setStatus('ลบแพ็กเกจแล้ว', 'success');
      navigateOwnerRoute('/owner/packages');
      return;
    }
    if (action === 'retry-dead-letter' || action === 'clear-dead-letter') {
      const tenantId = trimText(button.dataset.tenantId, 160);
      const code = trimText(button.dataset.purchaseCode || button.dataset.code, 160);
      const returnRoute = trimText(button.dataset.returnRoute, 240);
      if (!tenantId || !code) {
        throw new Error('ข้อมูลการจัดการงานค้างผิดปกติยังไม่ครบ');
      }
      await ownerMutation(
        action === 'retry-dead-letter'
          ? '/admin/api/delivery/dead-letter/retry'
          : '/admin/api/delivery/dead-letter/delete',
        {
          tenantId,
          code,
          guildId: trimText(button.dataset.guildId, 160) || undefined,
        },
      );
      resetOwnerSupportCaseCache();
      state.ownerUi.supportDeadLettersTenantId = '';
      state.ownerUi.supportDeadLetters = [];
      state.ownerUi.supportDeadLettersLoading = false;
      await refreshState({ silent: true });
      setStatus(action === 'retry-dead-letter' ? `ส่งงานค้างผิดปกติกลับเข้าคิวแล้ว: ${code}` : `ล้างงานค้างผิดปกติแล้ว: ${code}`, 'success');
      navigateOwnerRoute(returnRoute || `/owner/support/${encodeURIComponent(tenantId)}`);
    }
  }

  function routePresentationFor(rawRoute, page) {
    const normalizedRoute = String(rawRoute || '').trim().toLowerCase();
    if (normalizedRoute.startsWith('support-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('support-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.support || {}),
        workspaceLabel: 'Support context',
        kicker: 'Customer support dossier',
        title: 'Support context',
        subtitle: 'Keep customer evidence, dead letters, and follow-up actions together without leaving the Owner surface.',
        primaryAction: { label: 'Open tenant dossier', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute.startsWith('tenant-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('tenant-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.tenants || {}),
        workspaceLabel: 'Tenant dossier',
        kicker: 'Tenant command context',
        title: 'Tenant dossier',
        subtitle: 'Review package posture, renewals, quota pressure, and follow-up actions for the selected tenant.',
        primaryAction: { label: 'Open tenant dossier', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute && OWNER_ROUTE_PRESENTATION[normalizedRoute]) {
      return OWNER_ROUTE_PRESENTATION[normalizedRoute];
    }
    return OWNER_ROUTE_PRESENTATION[page] || OWNER_ROUTE_PRESENTATION.overview;
    if (normalizedRoute.startsWith('support-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('support-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.support || {}),
        workspaceLabel: 'งานดูแลลูกค้า',
        kicker: 'งานดูแลลูกค้า',
        title: 'งานดูแลลูกค้า',
        subtitle: 'ใช้บริบทของลูกค้ารายนี้เพื่อตรวจสัญญาณช่วยเหลือ จุดติด onboarding และงานถัดไป โดยไม่ต้องสลับกลับไปหน้าแก้ข้อมูลทั่วไป',
        primaryAction: { label: 'กลับไปหน้ารายละเอียดลูกค้า', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute.startsWith('tenant-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('tenant-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.tenants || {}),
        workspaceLabel: 'รายละเอียดลูกค้า',
        kicker: 'รายละเอียดลูกค้า',
        title: 'รายละเอียดลูกค้า',
        subtitle: 'ใช้บริบทของลูกค้ารายนี้เพื่อตรวจแพ็กเกจ การสมัครใช้ โควตา และสถานะบริการจากหน้าเดียว',
        primaryAction: { label: 'เปิดหน้าลูกค้ารายนี้', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute.startsWith('support-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('support-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.support || {}),
        workspaceLabel: 'งานดูแลลูกค้า',
        kicker: 'งานดูแลลูกค้า',
        title: 'งานดูแลลูกค้า',
        subtitle: 'ใช้บริบทของลูกค้ารายนี้เพื่อคุยกับลูกค้า ดูหลักฐาน และตามงานต่อโดยไม่หลุดบริบท',
        primaryAction: { label: 'กลับไปหน้าลูกค้ารายนี้', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute.startsWith('tenant-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('tenant-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.tenants || {}),
        workspaceLabel: 'รายละเอียดลูกค้า',
        kicker: 'รายละเอียดลูกค้า',
        title: 'รายละเอียดลูกค้า',
        subtitle: 'ใช้บริบทของลูกค้ารายนี้ต่อเพื่อดูสถานะเชิงพาณิชย์ งานดูแลลูกค้า และโควตาในหน้าเดียว',
        primaryAction: { label: 'เปิดงานดูแลของลูกค้ารายนี้', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute.startsWith('support-')) {
      const tenantId = encodeURIComponent(normalizedRoute.slice('support-'.length));
      return {
        ...(OWNER_ROUTE_PRESENTATION.support || {}),
        workspaceLabel: 'เคสงานดูแลลูกค้า',
        kicker: 'เคสงานดูแลลูกค้า',
        title: 'เคสงานดูแลลูกค้า',
        subtitle: 'ใช้บริบทของลูกค้ารายนี้เพื่อคุยกับลูกค้า ดูหลักฐาน และตามงานต่อโดยไม่หลุดบริบท',
        primaryAction: { label: 'กลับไปดูลูกค้ารายนี้', href: `/owner/tenants/${tenantId}` },
      };
    }
    if (normalizedRoute && OWNER_ROUTE_PRESENTATION[normalizedRoute]) {
      return OWNER_ROUTE_PRESENTATION[normalizedRoute];
    }
    return OWNER_ROUTE_PRESENTATION[page] || OWNER_ROUTE_PRESENTATION.overview;
  }

  function applyRouteSectionPresentation(route, presentation) {
    const sectionUpdates = presentation && presentation.sectionTitles && typeof presentation.sectionTitles === 'object'
      ? presentation.sectionTitles
      : {};
    Object.entries(sectionUpdates).forEach(([sectionId, config]) => {
      const section = document.getElementById(sectionId);
      if (!section || !config) return;
      const titleNode = section.querySelector('.odv4-section-title');
      const copyNode = section.querySelector('.odv4-section-copy');
      if (titleNode && config.title) {
        titleNode.textContent = String(config.title || '').trim();
      }
      if (copyNode && config.copy) {
        copyNode.textContent = String(config.copy || '').trim();
      }
    });
  }

  function applyOwnerRoutePresentation(rawRoute, page) {
    const presentation = routePresentationFor(rawRoute, page);
    const normalizedRoute = trimText(rawRoute, 120).toLowerCase();
    const preserveStaticCopy = normalizedRoute === 'control' || normalizedRoute === 'access' || normalizedRoute === 'diagnostics';
    const workspaceNode = document.querySelector('.odv4-workspace-label');
    const kickerNode = document.querySelector('.odv4-pagehead .odv4-section-kicker');
    const titleNode = document.querySelector('.odv4-page-title');
    const subtitleNode = document.querySelector('.odv4-page-subtitle');
    const primaryActionNode = document.querySelector('.odv4-pagehead-actions .odv4-button-primary');
    const railHeaderNode = document.querySelector('.odv4-rail-header');
    const railCopyNode = document.querySelector('.odv4-rail-copy');

    if (workspaceNode && presentation.workspaceLabel) {
      workspaceNode.textContent = String(presentation.workspaceLabel || '').trim();
      if (preserveStaticCopy) workspaceNode.setAttribute('data-owner-static-copy', '1');
    }
    if (kickerNode && presentation.kicker) {
      kickerNode.textContent = String(presentation.kicker || '').trim();
      if (preserveStaticCopy) kickerNode.setAttribute('data-owner-static-copy', '1');
    }
    if (titleNode && presentation.title) {
      titleNode.textContent = String(presentation.title || '').trim();
      if (preserveStaticCopy) titleNode.setAttribute('data-owner-static-copy', '1');
    }
    if (subtitleNode && presentation.subtitle) {
      subtitleNode.textContent = String(presentation.subtitle || '').trim();
      if (preserveStaticCopy) subtitleNode.setAttribute('data-owner-static-copy', '1');
    }
    if (primaryActionNode && presentation.primaryAction) {
      primaryActionNode.textContent = String(presentation.primaryAction.label || '').trim();
      primaryActionNode.setAttribute('href', String(presentation.primaryAction.href || '#').trim() || '#');
      delete primaryActionNode.dataset.ownerLocalFocus;
      if (preserveStaticCopy) primaryActionNode.setAttribute('data-owner-static-copy', '1');
    }
    if (railHeaderNode && presentation.railHeader) {
      railHeaderNode.textContent = String(presentation.railHeader || '').trim();
      if (preserveStaticCopy) railHeaderNode.setAttribute('data-owner-static-copy', '1');
    }
    if (railCopyNode && presentation.railCopy) {
      railCopyNode.textContent = String(presentation.railCopy || '').trim();
      if (preserveStaticCopy) railCopyNode.setAttribute('data-owner-static-copy', '1');
    }
    applyRouteSectionPresentation(rawRoute, presentation);
  }

  function navigateOwnerRoute(nextTarget) {
    const targetValue = String(nextTarget || '').trim();
    if (!targetValue || targetValue === '#') return;
    let rawRoute = '';
    if (targetValue.startsWith('/owner')) {
      const relative = targetValue.slice('/owner'.length).replace(/^\/+/, '');
      const segments = relative.split('/').filter(Boolean);
      if (!segments.length) {
        rawRoute = 'overview';
      } else {
        rawRoute = resolveOwnerRouteFromSegments(segments);
      }
    } else {
      const normalizedHash = targetValue.startsWith('#') ? targetValue : `#${targetValue}`;
      rawRoute = normalizedHash.replace(/^#/, '').trim().toLowerCase();
    }
    const page = resolveOwnerPage(rawRoute);
    const canonicalPath = buildCanonicalOwnerPath(rawRoute, page);
    if (isOwnerStitchHost()) {
      const nextUrl = `${canonicalPath}${window.location.search || ''}`;
      window.__OWNER_STITCH_ROUTE__ = canonicalPath;
      if (`${window.location.pathname}${window.location.search || ''}` !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
      renderCurrentPage();
      focusCurrentRoute(rawRoute, page);
      return;
    }
    if (window.location.pathname !== canonicalPath) {
      window.history.pushState({}, '', canonicalPath);
      renderCurrentPage();
      focusCurrentRoute(rawRoute, page);
    return;
  }

  function syncOwnerStitchRouteFromLocation() {
    if (!isOwnerStitchHost()) return;
    window.__OWNER_STITCH_ROUTE__ = String(window.location.pathname || '').trim() || '/owner';
  }
    renderCurrentPage();
    focusCurrentRoute(rawRoute, page);
  }

  async function loadQuotaSnapshots(rows) {
    const tenants = Array.isArray(rows) ? rows : [];
    const selected = tenants.slice(0, 12);
    const snapshots = await Promise.all(selected.map(async (row) => {
      const tenantId = String(row?.id || '').trim();
      if (!tenantId) return null;
      try {
        return await api(`/owner/api/platform/quota?tenantId=${encodeURIComponent(tenantId)}`, null);
      } catch {
        return null;
      }
    }));
    return snapshots.filter(Boolean);
  }

  async function loadOwnerOptionalPayload() {
    const [
      agents,
      agentRegistry,
      agentProvisioning,
      agentDevices,
      agentCredentials,
      sessions,
      notifications,
      securityEvents,
      runtimeSupervisor,
      requestLogs,
      deliveryLifecycle,
      restoreState,
      restoreHistory,
      backupFiles,
    ] = await Promise.all([
      optionalOwnerRead('/owner/api/platform/agents?limit=50', [], 2500),
      optionalOwnerRead('/owner/api/platform/agent-registry?limit=200', [], 2500),
      optionalOwnerRead('/owner/api/platform/agent-provisioning?limit=200', [], 2500),
      optionalOwnerRead('/owner/api/platform/agent-devices?limit=200', [], 2500),
      optionalOwnerRead('/owner/api/platform/agent-credentials?limit=200', [], 2500),
      optionalOwnerRead('/owner/api/auth/sessions', [], 2500),
      optionalOwnerRead('/owner/api/notifications?limit=20', { items: [] }, 2500),
      optionalOwnerRead('/owner/api/auth/security-events?limit=20', [], 2500),
      optionalOwnerRead('/owner/api/runtime/supervisor', null, 2500),
      optionalOwnerRead('/owner/api/observability/requests?limit=20&onlyErrors=true', { metrics: {}, items: [] }, 2500),
      optionalOwnerRead('/owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000', {}, 2500),
      optionalOwnerRead('/admin/api/backup/restore/status', {}, 2500),
      optionalOwnerRead('/admin/api/backup/restore/history?limit=12', [], 2500),
      optionalOwnerRead('/admin/api/backup/list', [], 2500),
    ]);
    return {
      agents,
      agentRegistry,
      agentProvisioning,
      agentDevices,
      agentCredentials,
      sessions,
      notifications: Array.isArray(notifications?.items) ? notifications.items : [],
      securityEvents,
      runtimeSupervisor,
      requestLogs,
      deliveryLifecycle,
      restoreState,
      restoreHistory,
      backupFiles,
    };
  }

  async function refreshState(options = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    const loadWarnings = [];
    const requestId = Date.now();
    state.requestId = requestId;
    if (!options.silent) {
      setStatus(t('owner.app.status.loading', 'กำลังโหลดข้อมูล Owner...'), 'info');
      renderMessageCard(
        t('owner.app.card.loadingTitle', 'กำลังเตรียมข้อมูลของ Owner'),
        t('owner.app.card.loadingDetail', 'กำลังโหลดรายชื่อลูกค้า สุขภาพบริการ และเหตุการณ์ล่าสุดของแพลตฟอร์ม'),
      );
    }
    try {
      const me = await api('/owner/api/me', null);
      if (me?.tenantId) {
        window.location.href = '/tenant';
        return;
      }
      const [
        overview,
        tenants,
        subscriptions,
        licenses,
        billingOverview,
        billingInvoices,
        billingPaymentAttempts,
        controlPanelSettings,
      ] = await Promise.all([
        safeOwnerRead('/owner/api/platform/overview', OWNER_OVERVIEW_FALLBACK, loadWarnings, 'overview', {
          timeoutMs: 2500,
          allowTimeoutFallback: true,
        }),
        safeOwnerRead('/owner/api/platform/tenants?limit=50', [], loadWarnings, 'tenants'),
        safeOwnerRead('/owner/api/platform/subscriptions?limit=50', [], loadWarnings, 'subscriptions'),
        safeOwnerRead('/owner/api/platform/licenses?limit=50', [], loadWarnings, 'licenses'),
        safeOwnerRead('/owner/api/platform/billing/overview', { provider: null, summary: {} }, loadWarnings, 'billing-overview'),
        safeOwnerRead('/owner/api/platform/billing/invoices?limit=50', [], loadWarnings, 'billing-invoices'),
        safeOwnerRead('/owner/api/platform/billing/payment-attempts?limit=50', [], loadWarnings, 'billing-payment-attempts'),
        safeOwnerRead('/owner/api/control-panel/settings', OWNER_CONTROL_PANEL_SETTINGS_FALLBACK, loadWarnings, 'control-panel-settings', {
          timeoutMs: 2500,
          allowTimeoutFallback: true,
        }),
      ]);

      state.payload = {
        me,
        overview,
        tenants,
        subscriptions,
        licenses,
        billingOverview,
        billingInvoices,
        billingPaymentAttempts,
        controlPanelSettings,
        agents: [],
        agentRegistry: [],
        agentProvisioning: [],
        agentDevices: [],
        agentCredentials: [],
        sessions: [],
        notifications: [],
        securityEvents: [],
        runtimeSupervisor: null,
        requestLogs: { metrics: {}, items: [] },
        deliveryLifecycle: {},
        restoreState: {},
        restoreHistory: [],
        backupFiles: [],
        tenantQuotaSnapshots: [],
        __loadWarnings: loadWarnings,
      };
      const supportTenantId = getSupportContextTenantId(getRawPathRoute());
      if (supportTenantId) {
        state.ownerUi.supportCaseTenantId = supportTenantId;
        state.ownerUi.supportCase = null;
        state.ownerUi.supportCaseLoading = false;
        state.ownerUi.supportDeadLettersTenantId = supportTenantId;
        state.ownerUi.supportDeadLetters = [];
        state.ownerUi.supportDeadLettersLoading = false;
      }
      renderCurrentPage();
      setStatus(t('owner.app.status.deepLoading', 'กำลังโหลดรายละเอียดลูกค้า...'), 'info');

      loadOwnerOptionalPayload()
        .then((optionalPayload) => {
          if (state.requestId !== requestId || !state.payload) return;
          state.payload = {
            ...state.payload,
            ...optionalPayload,
          };
          renderCurrentPage();
        })
        .catch(() => {});

      loadQuotaSnapshots(tenants)
        .then((tenantQuotaSnapshots) => {
          if (state.requestId !== requestId || !state.payload) return;
          state.payload = {
            ...state.payload,
            tenantQuotaSnapshots,
          };
          renderCurrentPage();
          applyOwnerSurfaceStatus();
        })
        .catch(() => {
          if (state.requestId !== requestId) return;
          applyOwnerSurfaceStatus();
        });
    } catch (error) {
      renderMessageCard(
        t('owner.app.card.loadFailedTitle', 'โหลดพื้นที่ Owner ไม่สำเร็จ'),
        String(error?.message || error),
      );
      setStatus(t('owner.app.status.loadFailed', 'โหลดไม่สำเร็จ'), 'danger');
    } finally {
      state.refreshing = false;
    }
  }

  function publishOwnerStitchStateSnapshot(snapshot) {
    const detail = snapshot && typeof snapshot === 'object'
      ? {
          ...snapshot,
          updatedAt: Date.now(),
        }
      : {
          payload: null,
          rawRoute: '',
          page: '',
          pathname: String(window.__OWNER_STITCH_ROUTE__ || window.location.pathname || '').trim(),
          updatedAt: Date.now(),
        };
    window.__OWNER_STITCH_STATE__ = detail;
    window.dispatchEvent(new CustomEvent('owner-state-updated', { detail }));
  }

  function renderCurrentPage() {
    const target = root();
    if (!target) return;
    if (!state.payload) {
      publishOwnerStitchStateSnapshot(null);
      if (state.refreshing) {
        renderMessageCard(
          t('owner.app.card.loadingTitle', 'กำลังเตรียมข้อมูลของ Owner'),
          t('owner.app.card.loadingDetail', 'กำลังโหลดรายชื่อลูกค้า สุขภาพบริการ และเหตุการณ์ล่าสุดของแพลตฟอร์ม'),
        );
      } else {
        renderMessageCard(
          t('owner.app.card.emptyTitle', 'ยังไม่มีข้อมูล'),
          t('owner.app.card.emptyDetail', 'รอให้ระบบดึงข้อมูลล่าสุดของ Owner ให้ครบก่อน'),
        );
      }
      return;
    }

    const rawRoute = getRawPathRoute();
    const page = resolveOwnerPage(rawRoute);
    document.body.dataset.ownerPage = page;
    document.body.dataset.ownerRoute = rawRoute || page;
    const canonicalPath = buildCanonicalOwnerPath(rawRoute, page);
    if (!isOwnerStitchHost() && window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', `${canonicalPath}${window.location.search || ''}`);
    }
    const renderOptions = { currentRoute: rawRoute, currentPage: page };
    const renderPayload = {
      ...state.payload,
      ownerUi: {
        ...state.ownerUi,
        restorePreview: state.ownerUi.restorePreview,
        automationPreview: state.ownerUi.automationPreview,
        supportCase: state.ownerUi.supportCase,
        supportCaseLoading: state.ownerUi.supportCaseLoading,
        supportDeadLetters: state.ownerUi.supportDeadLetters,
        supportDeadLettersLoading: state.ownerUi.supportDeadLettersLoading,
      },
    };
    publishOwnerStitchStateSnapshot({
      payload: renderPayload,
      rawRoute,
      page,
      pathname: String(window.__OWNER_STITCH_ROUTE__ || window.location.pathname || '').trim(),
    });
    let usedVNext = false;
    let renderResult = null;
    if (window.OwnerVNext?.renderOwnerVNext) {
      try {
        renderResult = window.OwnerVNext.renderOwnerVNext(target, renderPayload, renderOptions) || null;
        usedVNext = true;
      } catch (error) {
        console.error('OwnerVNext render failed, falling back to legacy owner renderer.', error);
      }
    }
    if (!usedVNext) {
      if (page === 'tenants') {
        window.OwnerTenantsV4.renderOwnerTenantsV4(target, state.payload, renderOptions);
      } else if (page === 'runtime') {
        window.OwnerRuntimeHealthV4.renderOwnerRuntimeHealthV4(target, {
          ...state.payload,
          restorePreview: state.ownerUi.restorePreview,
        }, renderOptions);
      } else {
        window.OwnerDashboardV4.renderOwnerDashboardV4(target, state.payload, renderOptions);
      }
    }
    requestSupportCaseForRoute(rawRoute);
    requestSupportDeadLettersForRoute(rawRoute);
    applyI18n(target);
    canonicalizeOwnerLinks(target);
    if (!usedVNext) {
      applyOwnerRoutePresentation(rawRoute, page);
    }
    mountOwnerControlWorkspace(rawRoute);
    const ownerControlWorkspace = document.getElementById('owner-control-workspace');
    if (ownerControlWorkspace) {
      applyI18n(ownerControlWorkspace);
      localizeOwnerActivePage(ownerControlWorkspace);
      observeOwnerControlWorkspaceLocalization(ownerControlWorkspace);
    } else if (!usedVNext) {
      observeOwnerControlWorkspaceLocalization(null);
      localizeOwnerActivePage(document.body);
    } else {
      observeOwnerControlWorkspaceLocalization(null);
    }
    focusCurrentRoute(rawRoute, page);
    const titleFallback = usedVNext
      ? trimText(target.querySelector('.ownerx-page-title')?.textContent, 200)
        || trimText(renderResult?.meta?.title, 200)
        || 'Platform overview'
      : normalizeOwnerActiveTextV2(routePresentationFor(rawRoute, page).title || ROUTE_TITLE_FALLBACKS[rawRoute] || ROUTE_TITLE_FALLBACKS[page] || 'Platform overview');
    const ownerSurfaceLabel = ownerUiLocale() === 'th' ? 'เจ้าของระบบ' : 'Owner';
    document.title = `SCUM TH Platform | ${ownerSurfaceLabel} | ${titleFallback}`;
  }

  let ownerAppInitialized = false;

  function initOwnerApp() {
    if (ownerAppInitialized) return;
    ownerAppInitialized = true;
    const refreshButton = document.getElementById('ownerV4RefreshBtn');
    refreshButton?.addEventListener('click', () => refreshState({ silent: false }));
    window.__navigateOwnerStitchRoute = navigateOwnerRoute;
    window.addEventListener('popstate', () => {
      syncOwnerStitchRouteFromLocation();
      renderCurrentPage();
    });
    document.addEventListener('submit', async (event) => {
      const form = event.target instanceof HTMLFormElement
        ? event.target
        : null;
      if (!form || !form.dataset.ownerForm) return;
      if (form.dataset.ownerBusy === '1') return;
      const formAction = trimText(form.dataset.ownerForm, 80);
      if (NATIVE_OWNER_FORM_ACTIONS.has(formAction)) {
        return;
      }
      event.preventDefault();
      try {
        await withOwnerBusyState(form, async () => {
          setStatus('กำลังบันทึกการเปลี่ยนแปลงของ Owner...', 'info');
          await handleOwnerFormSubmit(form);
        });
      } catch (error) {
        setStatus(trimText(error?.message || error || 'Owner action failed', 200), 'danger');
      }
    });
    document.addEventListener('click', async (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-owner-action]')
        : null;
      if (!button) return;
      if (button.dataset.ownerBusy === '1') return;
      event.preventDefault();
      try {
        await withOwnerBusyState(button, async () => {
          setStatus('กำลังดำเนินการคำสั่งของ Owner...', 'info');
          await handleOwnerAction(button);
        });
      } catch (error) {
        setStatus(trimText(error?.message || error || 'Owner action failed', 200), 'danger');
      }
    });
    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element
        ? event.target.closest('a[href^="#"], a[href^="/owner"]')
        : null;
      if (!link) return;
      if (link.dataset.ownerLocalFocus === '1') {
        event.preventDefault();
        focusLocalTarget(link.getAttribute('href'));
        return;
      }
      const target = String(link.getAttribute('href') || '').trim();
      if (!target || target === '#') return;
      if (!target.startsWith('#') && !target.startsWith('/owner')) return;
      if (target.startsWith('#') && !isKnownOwnerRouteAlias(target.replace(/^#/, ''))) return;
      navigateOwnerRoute(target);
      event.preventDefault();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshState({ silent: true });
    });
    state.timerId = window.setInterval(() => {
      if (!document.hidden) refreshState({ silent: true });
    }, 60000);
    window.addEventListener('ui-language-change', () => {
      renderCurrentPage();
      applyOwnerSurfaceStatus();
    });
    bootstrapLegacyOwnerRoute();
    refreshState({ silent: false });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initOwnerApp, { once: true });
  } else {
    initOwnerApp();
  }
})();
