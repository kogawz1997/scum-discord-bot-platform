(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerTenantsV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    { label: 'แพลตฟอร์ม', items: [
      { label: 'ภาพรวม', href: '#overview' },
      { label: 'ลูกค้า', href: '#tenants', current: true },
      { label: 'แพ็กเกจ', href: '#packages' },
      { label: 'การสมัครใช้', href: '#subscriptions' },
    ] },
    { label: 'ปฏิบัติการ', items: [
      { label: 'สุขภาพรันไทม์', href: '#runtime-health' },
      { label: 'เหตุการณ์', href: '#incidents' },
      { label: 'ซัพพอร์ต', href: '#support' },
      { label: 'ออดิท', href: '#audit' },
    ] },
    { label: 'ธุรกิจ', items: [
      { label: 'การเงิน', href: '#billing' },
      { label: 'ความปลอดภัย', href: '#security' },
      { label: 'ตั้งค่า', href: '#settings' },
    ] },
  ];

  function normalizeTenantNavRoute(currentRoute) {
    const route = String(currentRoute || 'tenants').trim().toLowerCase() || 'tenants';
    if (route.startsWith('tenant-')) return 'tenants';
    if (route.startsWith('support-')) return 'support';
    if (route === 'create-tenant') return 'tenants';
    return route;
  }

  function cloneNavGroups(groups, currentRoute) {
    const route = normalizeTenantNavRoute(currentRoute);
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
  function formatCurrencyCents(value, currency = 'THB') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: String(currency || 'THB').trim().toUpperCase() || 'THB',
      maximumFractionDigits: 2,
    }).format(numeric / 100);
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
  function toneForStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['active', 'licensed', 'healthy', 'online'].includes(raw)) return 'success';
    if (['trial', 'preview', 'warning', 'expiring'].includes(raw)) return 'warning';
    if (['expired', 'suspended', 'offline', 'failed'].includes(raw)) return 'danger';
    return 'muted';
  }
  function quotaTone(entry) {
    if (!entry || typeof entry !== 'object') return 'muted';
    if (entry.exceeded === true) return 'danger';
    if (entry.unlimited) return 'info';
    const limit = Number(entry.limit || 0);
    const used = Number(entry.used || 0);
    if (!Number.isFinite(limit) || limit <= 0) return 'muted';
    if (used >= limit) return 'danger';
    if (used / limit >= 0.75) return 'warning';
    return 'success';
  }
  function summarizeQuota(snapshot) {
    const quotas = snapshot && snapshot.quotas && typeof snapshot.quotas === 'object' ? snapshot.quotas : {};
    const hot = Object.entries(quotas).filter(([, value]) => ['warning', 'danger'].includes(quotaTone(value)));
    if (hot.length === 0) return { text: 'โควตาอยู่ในเกณฑ์ปกติ', tone: 'success' };
    return {
      text: hot.slice(0, 2).map(([key, value]) => {
        const used = formatNumber(value && value.used, '0');
        const limit = value && value.unlimited ? 'ไม่จำกัด' : formatNumber(value && value.limit, '0');
        return `${key}: ${used}/${limit}`;
      }).join(' · '),
      tone: hot.some(([, value]) => quotaTone(value) === 'danger') ? 'danger' : 'warning',
    };
  }

  function buildRows(state) {
    const tenants = Array.isArray(state.tenants) ? state.tenants : [];
    const subscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
    const licenses = Array.isArray(state.licenses) ? state.licenses : [];
    const billingInvoices = Array.isArray(state.billingInvoices) ? state.billingInvoices : [];
    const billingPaymentAttempts = Array.isArray(state.billingPaymentAttempts) ? state.billingPaymentAttempts : [];
    const quotaSnapshots = Array.isArray(state.tenantQuotaSnapshots) ? state.tenantQuotaSnapshots : [];
    const quotaMap = new Map(quotaSnapshots.map((row) => [String(row.tenantId || row.tenant && row.tenant.id || ''), row]));
    return tenants.map((tenant) => {
      const tenantId = String(tenant.id || '').trim();
      const subscription = subscriptions.find((row) => String(row.tenantId || row.ownerTenantId || '').trim() === tenantId) || {};
      const license = licenses.find((row) => String(row.tenantId || row.ownerTenantId || '').trim() === tenantId) || {};
      const invoices = billingInvoices.filter((row) => String(row?.tenantId || '').trim() === tenantId);
      const attempts = billingPaymentAttempts.filter((row) => String(row?.tenantId || '').trim() === tenantId);
      const latestInvoice = invoices[0] || null;
      const latestAttempt = attempts[0] || null;
      const outstandingCents = invoices
        .filter((row) => ['draft', 'open', 'past_due'].includes(String(row?.status || '').trim().toLowerCase()))
        .reduce((sum, row) => sum + Number(row?.amountCents || 0), 0);
      const collectedCents = invoices
        .filter((row) => String(row?.status || '').trim().toLowerCase() === 'paid')
        .reduce((sum, row) => sum + Number(row?.amountCents || 0), 0);
      const quota = summarizeQuota(quotaMap.get(tenantId));
      return {
        tenantId,
        name: tenant.name || tenant.slug || tenantId || 'ผู้เช่าที่ไม่ทราบชื่อ',
        owner: firstNonEmpty([tenant.ownerName, tenant.ownerEmail, '-']),
        packageName: firstNonEmpty([subscription.packageName, subscription.planName, tenant.plan, tenant.type, 'ยังไม่กำหนดแพ็กเกจ']),
        status: firstNonEmpty([subscription.status, tenant.status, 'active']),
        statusTone: toneForStatus(subscription.status || tenant.status),
        licenseState: firstNonEmpty([license.status, license.state, 'ยังไม่มีไลเซนส์']),
        quotaText: quota.text,
        quotaTone: quota.tone,
        invoiceState: latestInvoice ? firstNonEmpty([latestInvoice.status], 'open') : 'no-invoice',
        invoiceStateTone: toneForStatus(latestInvoice?.status || (outstandingCents > 0 ? 'warning' : 'muted')),
        outstandingAmount: outstandingCents > 0 ? formatCurrencyCents(outstandingCents, latestInvoice?.currency || 'THB') : 'ไม่มีค้างชำระ',
        collectedAmount: collectedCents > 0 ? formatCurrencyCents(collectedCents, latestInvoice?.currency || 'THB') : 'ยังไม่มีรายการรับเงิน',
        paymentAttemptState: latestAttempt ? firstNonEmpty([latestAttempt.status, latestAttempt.provider], latestAttempt.provider || '-') : '-',
        updatedAt: tenant.updatedAt || tenant.createdAt,
        renewsAt: subscription.renewsAt || subscription.expiresAt || subscription.endsAt,
      };
    });
  }

  function buildTenantRouteView(currentRoute, context = {}) {
    const route = normalizeTenantNavRoute(currentRoute);
    const spotlight = context.spotlight || null;
    const spotlightHref = spotlight && spotlight.tenantId ? `#tenant-${spotlight.tenantId}` : '#tenants';
    const hasExpiring = Number(context.expiringCount || 0) > 0;
    const hasUrgent = Number(context.dangerCount || 0) > 0;
    const base = {
      pageKicker: 'ทะเบียนลูกค้าและสถานะเชิงพาณิชย์',
      headerTitle: 'ลูกค้าและสถานะเชิงพาณิชย์',
      headerSubtitle: 'รวมแผน การต่ออายุ โควตา และบริบทลูกค้าไว้ในหน้าเดียวเพื่อให้ตัดสินใจได้เร็ว',
      primaryAction: hasUrgent
        ? { label: 'เปิดรายการที่ต้องจัดการก่อน (แนะนำ)', href: '#billing' }
        : hasExpiring
          ? { label: 'ดูรายการใกล้ต่ออายุ (แนะนำ)', href: '#subscriptions' }
          : { label: 'สร้างลูกค้ารายใหม่', href: '#create-tenant' },
      secondaryActions: [
        { label: 'ดูลูกค้าทั้งหมด', href: '#tenants' },
        { label: 'เปิดเคสซัพพอร์ต', href: '#support' },
      ],
      nextActionsKicker: 'ควรทำอะไรก่อน',
      nextActionsTitle: 'เริ่มจากเรื่องที่กระทบรายได้และบริการก่อน',
      nextActionsCopy: 'เริ่มจากเรื่องรายได้ ซัพพอร์ต และผู้เช่าที่เสี่ยงก่อน แล้วค่อยลงรายละเอียด',
      registryKicker: 'ทะเบียน',
      registryTitle: 'รายชื่อลูกค้า',
      registryCopy: 'ตารางนี้ตั้งใจทำให้หาลูกค้าและตัดสินใจต่อได้เร็ว ไม่ใช่กำแพงข้อมูล',
      spotlightKicker: 'ลูกค้าที่ควรเปิดดูก่อน',
      spotlightEmptyTitle: 'ลูกค้าที่ควรเปิดดูก่อน',
      spotlightTitleMode: 'name',
      spotlightCopy: 'ใช้การ์ดนี้ช่วยชี้ว่าควรเปิดลูกค้ารายใดก่อนลงลึก',
      spotlightEmptyCopy: 'เลือกลูกค้าจากทะเบียนเพื่อดูสุขภาพระบบ บริบทซัพพอร์ต และสถานะเชิงพาณิชย์ต่อทันที',
      spotlightNextTitle: 'อยู่ในบริบทของลูกค้ารายนี้ต่อ',
      spotlightNextItems: ['เปิดเคสซัพพอร์ต', 'ส่งออก diagnostics', 'ทบทวน billing และการต่ออายุ'],
      blockOrder: ['nextActions', 'registry', 'spotlight'],
      railHeader: 'บริบทเจ้าของระบบ',
      railCopy: 'เก็บงานซัพพอร์ตและงานเชิงพาณิชย์ไว้ใกล้ทะเบียนลูกค้า เพื่อไม่ให้หลุดบริบท',
    };

    if (route === 'packages') {
      return {
        ...base,
        pageKicker: 'แพ็กเกจและสิทธิ์ใช้งาน',
        headerTitle: 'แพ็กเกจและสิทธิ์ใช้งาน',
        headerSubtitle: 'ดูว่าผู้เช่าแต่ละรายอยู่แพ็กเกจใด และได้สิทธิ์อะไรบ้างก่อนเปลี่ยนแผน',
        primaryAction: { label: 'ดูแพ็กเกจที่ถูกใช้งาน (แนะนำ)', href: '#packages' },
        secondaryActions: [
          { label: 'ดูการสมัครใช้', href: '#subscriptions' },
          { label: 'กลับไปรายชื่อผู้เช่า', href: '#tenants' },
        ],
        nextActionsKicker: 'แพ็กเกจ',
        nextActionsTitle: 'เริ่มจากแพ็กเกจที่กระทบผู้เช่ามากที่สุด',
        nextActionsCopy: 'แยกก่อนว่าควรตรวจสิทธิ์ การต่ออายุ หรือผู้เช่าที่อยู่ผิดแผน',
        registryKicker: 'ผู้เช่าตามแพ็กเกจ',
        registryTitle: 'รายชื่อผู้เช่าตามแพ็กเกจ',
        registryCopy: 'ดูได้ทันทีว่าผู้เช่ารายไหนอยู่แผนใด และควรย้ายหรือคงแผนเดิม',
      };
    }

    if (route === 'subscriptions') {
      return {
        ...base,
        pageKicker: 'การสมัครใช้และการต่ออายุ',
        headerTitle: 'การสมัครใช้และการต่ออายุ',
        headerSubtitle: 'ไล่รายการที่ใกล้ต่ออายุ หมดอายุ หรือเสี่ยงสะดุดบริการก่อนเรื่องอื่น',
        primaryAction: { label: 'ดูรายการใกล้ต่ออายุ (แนะนำ)', href: '#subscriptions' },
        secondaryActions: [
          { label: 'ดูการเงิน', href: '#billing' },
          { label: 'กลับไปรายชื่อผู้เช่า', href: '#tenants' },
        ],
        nextActionsKicker: 'การต่ออายุ',
        nextActionsTitle: 'เริ่มจากรายการที่ใกล้หมดอายุก่อน',
        nextActionsCopy: 'จัดการรายการใกล้ต่ออายุให้เรียบร้อยก่อน เพื่อลดแรงกระแทกต่อทีมซัพพอร์ต',
        registryKicker: 'ผู้เช่าที่ต้องตามต่อ',
        registryTitle: 'รายชื่อผู้เช่าที่ต้องตามเรื่องการสมัครใช้',
        registryCopy: 'ใช้ตารางนี้คัดรายที่ต้องทบทวนเรื่องการต่ออายุ แผน และสิทธิ์ใช้งานในรอบเดียว',
      };
    }

    if (route === 'billing') {
      return {
        ...base,
        pageKicker: 'การเงินและการต่ออายุ',
        headerTitle: 'การเงินและการต่ออายุ',
        headerSubtitle: 'รวมรายการที่กระทบรายได้ การต่ออายุ และโควตาไว้ในมุมเดียวเพื่อใช้ตัดสินใจ',
        primaryAction: { label: 'ดูรายการเสี่ยงรายได้ (แนะนำ)', href: '#billing' },
        secondaryActions: [
          { label: 'ดูการสมัครใช้', href: '#subscriptions' },
          { label: 'เปิดซัพพอร์ต', href: '#support' },
        ],
        nextActionsKicker: 'รายได้',
        nextActionsTitle: 'เริ่มจากเรื่องที่กระทบรายได้ก่อน',
        nextActionsCopy: 'โฟกัสรายที่หมดอายุ ใกล้ต่ออายุ หรือเริ่มชนโควตาก่อนงานอื่น',
      };
    }

    if (route === 'support') {
      return {
        ...base,
        pageKicker: 'ซัพพอร์ตและบริบทลูกค้า',
        headerTitle: 'ซัพพอร์ตและบริบทลูกค้า',
        headerSubtitle: 'เริ่มจากผู้เช่าที่กำลังคุยกับทีมอยู่ แล้วค่อยไล่หลักฐาน การเงิน และบริบทระบบต่อ',
        primaryAction: { label: 'เปิดผู้เช่าที่กำลังตามอยู่ (แนะนำ)', href: spotlightHref },
        secondaryActions: [
          { label: 'เปิดเคสซัพพอร์ต', href: '#support' },
          { label: 'ดูการเงินที่เกี่ยวข้อง', href: '#billing' },
        ],
        nextActionsKicker: 'งานซัพพอร์ต',
        nextActionsTitle: 'เริ่มจากบริบทของผู้เช่าที่กำลังคุยอยู่',
        nextActionsCopy: 'เริ่มจากผู้เช่าและหลักฐานที่เกี่ยวกับเคสก่อน แล้วค่อยดูทะเบียนและการต่ออายุ',
        spotlightKicker: 'เคสที่กำลังตามอยู่',
        spotlightEmptyTitle: 'ยังไม่มีเคสที่ปักหมุดไว้',
        spotlightEmptyCopy: 'เมื่อมีผู้เช่าที่กำลังคุยกับทีมงาน ระบบจะปักหมุดไว้ให้กลับมาทำต่อได้ง่าย',
        spotlightNextTitle: 'อยู่กับเคสนี้ต่อ',
        spotlightNextItems: ['เปิดเคสซัพพอร์ต', 'ส่งออก diagnostics', 'ดูการต่ออายุและโควตา'],
        blockOrder: ['spotlight', 'nextActions', 'registry'],
        railHeader: 'บริบทงานซัพพอร์ต',
        railCopy: 'เก็บบริบทของผู้เช่า หลักฐาน และเรื่องเชิงพาณิชย์ไว้ใกล้กันเพื่อให้คุยกับลูกค้าได้ต่อ',
      };
    }

    if (route === 'security') {
      return {
        ...base,
        pageKicker: 'ความปลอดภัยของผู้เช่า',
        headerTitle: 'ความปลอดภัยของผู้เช่า',
        headerSubtitle: 'ใช้หน้านี้ทบทวนสิทธิ์ การเข้าถึง และบริบทผู้เช่าที่ต้องจับตา ก่อนแตะงานเชิงปฏิบัติการอื่น',
        primaryAction: { label: 'เปิดบันทึกออดิท (แนะนำ)', href: '#audit' },
        secondaryActions: [
          { label: 'ดูผู้เช่าที่มีความเสี่ยง', href: '#billing' },
          { label: 'เปิดบริบทซัพพอร์ต', href: '#support' },
        ],
        nextActionsKicker: 'ความปลอดภัย',
        nextActionsTitle: 'เริ่มจากรายการที่ต้องยืนยันสิทธิ์และหลักฐานก่อน',
        nextActionsCopy: 'ใช้มุมมองนี้แยกเรื่องสิทธิ์และออดิทออกจากงานซัพพอร์ตทั่วไป เพื่อไม่ให้ประเด็นสำคัญหลุด',
        blockOrder: ['nextActions', 'spotlight', 'registry'],
        railHeader: 'บริบทความปลอดภัย',
        railCopy: 'งานด้านสิทธิ์ การเข้าถึง และหลักฐานควรถูกวางคู่กับบริบทของผู้เช่าเสมอ',
      };
    }

    if (route === 'settings') {
      return {
        ...base,
        pageKicker: 'ตั้งค่าและนโยบาย',
        headerTitle: 'ตั้งค่าและนโยบาย',
        headerSubtitle: 'ใช้หน้านี้ทบทวนแนวทางการดูแลผู้เช่า สิทธิ์ใช้งาน และเรื่องที่ต้องคุมให้สม่ำเสมอทั้งแพลตฟอร์ม',
        primaryAction: { label: 'เปิดรายการที่ต้องกำหนดต่อ (แนะนำ)', href: '#settings' },
        secondaryActions: [
          { label: 'ดูความปลอดภัย', href: '#security' },
          { label: 'กลับไปรายชื่อผู้เช่า', href: '#tenants' },
        ],
        nextActionsKicker: 'นโยบาย',
        nextActionsTitle: 'เริ่มจากกติกาที่กระทบผู้เช่าหลายรายก่อน',
        nextActionsCopy: 'ใช้มุมนี้ทบทวนสิ่งที่ควรคุมเป็นมาตรฐาน เช่น การต่ออายุ สิทธิ์ใช้งาน และแนวทางซัพพอร์ต',
      };
    }

    return base;
  }

  function createOwnerTenantsV4Model(source, options = {}) {
    const state = source && typeof source === 'object' ? source : {};
    const currentRoute = String(options.currentRoute || 'tenants').trim().toLowerCase() || 'tenants';
    const rows = buildRows(state);
    const activeCount = rows.filter((row) => row.statusTone === 'success').length;
    const warningCount = rows.filter((row) => row.statusTone === 'warning').length;
    const dangerCount = rows.filter((row) => row.statusTone === 'danger').length;
    const expiringRows = rows.filter((row) => row.statusTone === 'warning');
    const urgentRows = rows.filter((row) => row.statusTone === 'danger');
    const spotlight = rows.find((row) => row.tenantId === String(state.supportCase && state.supportCase.tenantId || '').trim()) || rows[0] || null;
    const routeView = buildTenantRouteView(currentRoute, {
      spotlight,
      expiringCount: expiringRows.length,
      dangerCount,
    });
    const nextActions = [
      {
        label: 'รายได้และการต่ออายุ',
        title: expiringRows.length > 0 ? 'มีผู้เช่าใกล้ต่ออายุที่ควรทบทวน' : 'สถานะการต่ออายุยังนิ่ง',
        body: expiringRows.length > 0
          ? `${formatNumber(expiringRows.length, '0')} รายกำลังเข้าโซนเตือนเรื่องแพ็กเกจ การต่ออายุ หรือไลเซนส์`
          : 'ตอนนี้ยังไม่พบผู้เช่าที่เข้าโซนใกล้ต่ออายุในชุดข้อมูลนี้',
        actionLabel: expiringRows.length > 0 ? 'ดูรายการใกล้ต่ออายุ' : 'ดูแพ็กเกจทั้งหมด',
        actionHref: expiringRows.length > 0 ? '#subscriptions' : '#packages',
        tone: expiringRows.length > 0 ? 'warning' : 'success',
      },
      {
        label: 'ผู้เช่าที่ต้องรีบดู',
        title: urgentRows.length > 0 ? 'มีผู้เช่าที่เสี่ยงหรือหยุดให้บริการ' : 'ยังไม่พบผู้เช่าที่เป็นเคสด่วน',
        body: urgentRows.length > 0
          ? `${formatNumber(urgentRows.length, '0')} รายอยู่ในกลุ่มหมดอายุ ถูกพัก หรือมีสัญญาณเสี่ยงสูงที่ควรเปิดดูทันที`
          : 'ใช้พื้นที่นี้เช็กผู้เช่าที่มีความเสี่ยงสูงก่อนจะขยับไปแก้เรื่องอื่น',
        actionLabel: urgentRows.length > 0 ? 'เปิดรายการด่วน' : 'ดูสุขภาพระบบ',
        actionHref: urgentRows.length > 0 ? '#billing' : '#runtime-health',
        tone: urgentRows.length > 0 ? 'danger' : 'muted',
      },
      {
        label: 'งานซัพพอร์ต',
        title: spotlight ? `อยู่กับ ${spotlight.name} ต่อได้เลย` : 'ยังไม่มีผู้เช่าที่ถูกปักหมุดไว้',
        body: spotlight
          ? 'เปิดรายละเอียดผู้เช่ารายนี้ต่อเพื่อดูสุขภาพระบบ บริบทซัพพอร์ต และสถานะเชิงพาณิชย์ในหน้าถัดไป'
          : 'เมื่อมีผู้เช่าที่กำลังคุยกับทีมงาน ระบบจะปักหมุดให้กลับมาต่อได้ง่าย',
        actionLabel: spotlight ? 'เปิดผู้เช่ารายนี้' : 'เปิดหน้าซัพพอร์ต',
        actionHref: spotlight ? `#tenant-${spotlight.tenantId}` : '#support',
        tone: spotlight ? 'info' : 'muted',
      },
    ];
    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงเจ้าของระบบ',
        workspaceLabel: routeView.headerTitle || 'ทะเบียนผู้เช่า',
        environmentLabel: 'ระดับแพลตฟอร์ม',
        navGroups: cloneNavGroups(NAV_GROUPS, currentRoute),
      },
      header: {
        title: routeView.headerTitle || 'ผู้เช่าและสถานะเชิงพาณิชย์',
        subtitle: routeView.headerSubtitle || 'รวมแพ็กเกจ การสมัครใช้ โควตา และบริบทซัพพอร์ตไว้ในหน้าเดียวเพื่อช่วยให้เจ้าของระบบตัดสินใจได้เร็ว',
        statusChips: [
          { label: `${formatNumber(rows.length, '0')} ผู้เช่า`, tone: 'info' },
          { label: `${formatNumber(activeCount, '0')} ปกติ`, tone: 'success' },
          { label: `${formatNumber(warningCount, '0')} ต้องจับตา`, tone: warningCount > 0 ? 'warning' : 'muted' },
          { label: `${formatNumber(dangerCount, '0')} ด่วน`, tone: dangerCount > 0 ? 'danger' : 'muted' },
        ],
        primaryAction: routeView.primaryAction || { label: 'สร้างผู้เช่า', href: '#create-tenant' },
        secondaryActions: Array.isArray(routeView.secondaryActions) ? routeView.secondaryActions : [],
      },
      summaryStrip: [
        { label: 'ปกติ', value: formatNumber(activeCount, '0'), detail: 'ผู้เช่าที่เดินระบบได้ตามปกติ', tone: 'success' },
        { label: 'ใกล้ต่ออายุ', value: formatNumber(expiringRows.length, '0'), detail: 'ใช้ตามเรื่องแพ็กเกจ การสมัครใช้ และไลเซนส์ก่อนสะดุดจริง', tone: expiringRows.length > 0 ? 'warning' : 'muted' },
        { label: 'ด่วน', value: formatNumber(dangerCount, '0'), detail: 'หมดอายุ ถูกพัก หรือมีความเสี่ยงสูง', tone: dangerCount > 0 ? 'danger' : 'muted' },
        { label: 'บริบทซัพพอร์ต', value: String(state.supportCase ? 'กำลังติดตาม' : 'ว่างอยู่'), detail: 'สถานะเคสที่เจ้าของระบบกำลังดูต่ออยู่', tone: state.supportCase ? 'info' : 'muted' },
      ],
      rows,
      spotlight,
      nextActions,
      billingSummary: state.billingOverview?.summary || null,
      billingProvider: state.billingOverview?.provider || null,
      routeView,
      railCards: [
        { title: 'เครื่องมือซัพพอร์ต', body: 'วางปุ่มส่งออก diagnostics และเปิดเคสไว้ใกล้ทะเบียนผู้เช่า เพื่อให้เจ้าของระบบไล่งานได้ในหนึ่งหรือสองคลิก', meta: 'งานซัพพอร์ตไม่ควรถูกซ่อนไว้ลึกใน hash section เก่า', tone: 'info' },
        { title: 'ทบทวนเชิงพาณิชย์', body: `${formatNumber(warningCount + dangerCount, '0')} รายยังต้องทบทวนเรื่องต่ออายุ โควตา หรือไลเซนส์`, meta: 'ดูมุม billing ก่อนเปลี่ยนแพ็กเกจหรือสิทธิ์ใช้งาน', tone: warningCount + dangerCount > 0 ? 'warning' : 'success' },
      ],
    };
  }

  function renderNavGroups(items) {
    return (Array.isArray(items) ? items : []).map((group) => [
      '<section class="odv4-nav-group">',
      `<span class="odv4-nav-group-label">${escapeHtml(group.label || '')}</span>`,
      '<div class="odv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items : []).map((item) => `<a class="${item.current ? 'odv4-nav-link odv4-nav-link-current' : 'odv4-nav-link'}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label || '')}</a>`),
      '</div></section>',
    ].join('')).join('');
  }
  function renderChips(items) {
    return (Array.isArray(items) ? items : []).map((item) => `<span class="odv4-badge odv4-badge-${escapeHtml(item.tone || 'muted')}">${escapeHtml(item.label || '')}</span>`).join('');
  }
  function renderSummaryStrip(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-kpi odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-kpi-label">${escapeHtml(item.label || '')}</span>`,
      `<strong class="odv4-kpi-value">${escapeHtml(item.value || '-')}</strong>`,
      `<p class="odv4-kpi-detail">${escapeHtml(item.detail || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }
  function renderTable(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return [
        '<div class="odv4-table">',
        '<div class="odv4-table-head cols-6"><span>ผู้เช่า</span><span>แพ็กเกจ</span><span>การสมัครใช้</span><span>โควตา</span><span>อัปเดตล่าสุด</span><span>การกระทำ</span></div>',
        '<div class="odv4-empty-state"><div class="odv4-stack"><strong>ยังไม่มีผู้เช่า</strong><span>เริ่มจากสร้างผู้เช่ารายแรกก่อน แล้วค่อยผูกแพ็กเกจ การสมัครใช้ และงานซัพพอร์ต</span><div class="odv4-action-list"><a class="odv4-button odv4-button-primary" href="#create-tenant">สร้างผู้เช่า</a></div></div></div>',
        '</div>',
      ].join('');
    }
    return [
      '<div class="odv4-table">',
      '<div class="odv4-table-head cols-6"><span>ผู้เช่า</span><span>แพ็กเกจ</span><span>การสมัครใช้</span><span>โควตา</span><span>อัปเดตล่าสุด</span><span>การกระทำ</span></div>',
      ...items.map((row) => [
        `<div id="tenant-${escapeHtml(row.tenantId)}" class="odv4-table-row cols-6 odv4-focus-target" data-owner-focus-route="tenant-${escapeHtml(row.tenantId)} support-${escapeHtml(row.tenantId)}">`,
        `<div class="odv4-table-cell"><strong>${escapeHtml(row.name)}</strong><span class="odv4-table-note">${escapeHtml(row.owner)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-muted">${escapeHtml(row.packageName)}</span><span class="odv4-table-note">${escapeHtml(row.licenseState)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(row.statusTone)}">${escapeHtml(row.status)}</span>${row.renewsAt ? `<span class="odv4-table-note">${escapeHtml(formatRelative(row.renewsAt))}</span>` : ''}<span class="odv4-table-note">Invoice: ${escapeHtml(row.invoiceState)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(row.quotaTone)}">${escapeHtml(row.quotaTone)}</span><span class="odv4-table-note">${escapeHtml(row.quotaText)}</span><span class="odv4-table-note">${escapeHtml(row.outstandingAmount)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(formatDateTime(row.updatedAt))}</span></div>`,
        `<div class="odv4-table-actions"><a class="odv4-table-button odv4-table-button-primary" href="#tenant-${escapeHtml(row.tenantId)}">เปิดรายละเอียด</a><a class="odv4-table-button" href="#support-${escapeHtml(row.tenantId)}">ซัพพอร์ต</a></div>`,
        '</div>',
      ].join('')),
      '</div>',
    ].join('');
  }
  function renderSpotlight(spotlight, routeView = {}) {
    const kicker = routeView.spotlightKicker || 'ผู้เช่าที่ควรเปิดดูก่อน';
    const emptyTitle = routeView.spotlightEmptyTitle || 'ผู้เช่าที่ควรเปิดดูก่อน';
    const emptyCopy = routeView.spotlightEmptyCopy || 'เลือกผู้เช่าจากทะเบียนเพื่อดูสุขภาพระบบ บริบทซัพพอร์ต และสถานะเชิงพาณิชย์ต่อทันที';
    const spotlightTitleMode = routeView.spotlightTitleMode || 'name';
    const detailTitle = spotlightTitleMode === 'name' ? (spotlight && spotlight.name) : (routeView.spotlightTitle || spotlight && spotlight.name);
    const spotlightCopy = routeView.spotlightCopy || 'ใช้การ์ดนี้ช่วยให้เห็นงานถัดไปชัดก่อนลงลึกไปยังหน้ารายละเอียดของผู้เช่า';
    const nextTitle = routeView.spotlightNextTitle || 'อยู่ในบริบทของผู้เช่ารายนี้ต่อ';
    const nextItems = Array.isArray(routeView.spotlightNextItems) && routeView.spotlightNextItems.length
      ? routeView.spotlightNextItems
      : ['เปิดเคสซัพพอร์ต', 'ส่งออก diagnostics', 'ทบทวน billing และการต่ออายุ'];
    if (!spotlight) {
      return [
        '<section class="odv4-panel">',
        `<div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(kicker)}</span><h2 class="odv4-section-title">${escapeHtml(emptyTitle)}</h2><p class="odv4-section-copy">${escapeHtml(emptyCopy)}</p></div>`,
        '<div class="odv4-empty-state">ยังไม่มีผู้เช่าเด่นให้เปิดดูต่อ</div>',
        '</section>',
      ].join('');
    }
    return [
      '<section class="odv4-panel">',
      `<div class="odv4-section-head"><span class="odv4-section-kicker">${escapeHtml(kicker)}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(detailTitle || spotlight.name)}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(spotlightCopy)}</p></div>`,
      '<div class="odv4-runbook-grid">',
      `<article class="odv4-runbook-card"><span class="odv4-table-label">แพ็กเกจ</span><strong>${escapeHtml(spotlight.packageName)}</strong></article>`,
      `<article class="odv4-runbook-card"><span class="odv4-table-label">การสมัครใช้</span><strong>${escapeHtml(spotlight.status)}</strong></article>`,
      `<article class="odv4-runbook-card"><span class="odv4-table-label">โควตา</span><strong>${escapeHtml(spotlight.quotaText)}</strong></article>`,
      '</div>',
      `<div class="odv4-panel" style="margin-top:16px;"><div class="odv4-section-head"><span class="odv4-section-kicker">งานถัดไป</span><h3 class="odv4-section-title">${escapeHtml(nextTitle)}</h3></div><ul class="odv4-bullet-list">${nextItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`,
      '</section>',
    ].join('');
  }

  function renderNextActionCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-runbook-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-table-label">${escapeHtml(item.label || '')}</span>`,
      `<strong>${escapeHtml(item.title || '')}</strong>`,
      `<p>${escapeHtml(item.body || '')}</p>`,
      `<div class="odv4-action-list"><a class="odv4-button odv4-button-secondary" href="${escapeHtml(item.actionHref || '#')}">${escapeHtml(item.actionLabel || 'เปิดดูต่อ')}</a></div>`,
      '</article>',
    ].join('')).join('');
  }
  function renderRailCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-rail-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<h4 class="odv4-rail-title">${escapeHtml(item.title || '')}</h4><p class="odv4-rail-copy">${escapeHtml(item.body || '')}</p><div class="odv4-rail-detail">${escapeHtml(item.meta || '')}</div>`,
      '</article>',
    ].join('')).join('');
  }

  function buildOwnerTenantsV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : createOwnerTenantsV4Model({});
    const routeView = safeModel.routeView && typeof safeModel.routeView === 'object' ? safeModel.routeView : {};
    const nextActionsSection = [
      '<section class="odv4-panel"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.nextActionsKicker || 'ควรทำอะไรก่อน')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.nextActionsTitle || 'เริ่มจากเรื่องที่กระทบรายได้และบริการก่อน')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.nextActionsCopy || 'เจ้าของระบบควรเห็นงานเชิงพาณิชย์ ซัพพอร์ต และผู้เช่าที่เสี่ยงอยู่เหนือรายละเอียด registry เสมอ')}</p></div>`,
      safeModel.billingSummary
        ? `<div class="odv4-runbook-grid" style="margin-bottom:16px;"><article class="odv4-runbook-card odv4-tone-info"><span class="odv4-table-label">Provider</span><strong>${escapeHtml(safeModel.billingProvider?.provider || 'platform_local')}</strong><p>${escapeHtml(safeModel.billingProvider?.mode || 'platform_local')}</p></article><article class="odv4-runbook-card odv4-tone-success"><span class="odv4-table-label">Collected</span><strong>${escapeHtml(formatCurrencyCents(safeModel.billingSummary.collectedCents || 0))}</strong><p>${escapeHtml(`${formatNumber(safeModel.billingSummary.paidInvoiceCount || 0)} paid invoices`)}</p></article><article class="odv4-runbook-card odv4-tone-warning"><span class="odv4-table-label">Open invoices</span><strong>${escapeHtml(formatNumber(safeModel.billingSummary.openInvoiceCount || 0))}</strong><p>${escapeHtml(`${formatNumber(safeModel.billingSummary.failedAttemptCount || 0)} failed payment attempts`)}</p></article></div>`
        : '',
      `<div class="odv4-runbook-grid">${renderNextActionCards(safeModel.nextActions)}</div>`,
      '</section>',
    ].join('');
    const registrySection = [
      '<section class="odv4-panel"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.registryKicker || 'ทะเบียน')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.registryTitle || 'รายชื่อผู้เช่า')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.registryCopy || 'ตารางนี้ตั้งใจทำให้เรียบและอ่านง่าย เพื่อให้เป็น registry ที่ใช้งานจริง ไม่ใช่กำแพงการ์ดที่ทำให้หางานไม่เจอ')}</p></div>`,
      renderTable(safeModel.rows),
      '</section>',
    ].join('');
    const spotlightSection = renderSpotlight(safeModel.spotlight, routeView);
    const orderedBlocks = [];
    const blockMap = {
      nextActions: `<div id="billing" class="odv4-focus-target" data-owner-focus-route="billing settings">${nextActionsSection}</div>`,
      registry: `<div id="packages" class="odv4-focus-target" data-owner-focus-route="tenants packages subscriptions create-tenant">${registrySection}</div>`,
      spotlight: `<div id="support" class="odv4-focus-target" data-owner-focus-route="support">${spotlightSection}</div>`,
    };
    const order = Array.isArray(routeView.blockOrder) && routeView.blockOrder.length
      ? routeView.blockOrder
      : ['nextActions', 'registry', 'spotlight'];
    order.forEach((key) => {
      if (blockMap[key]) {
        orderedBlocks.push(blockMap[key]);
      }
    });
    return [
      '<div class="odv4-app"><header class="odv4-topbar"><div class="odv4-brand-row">',
      `<div class="odv4-brand-mark">${escapeHtml(safeModel.shell.brand || 'SCUM')}</div><div class="odv4-brand-copy"><span class="odv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel || '')}</span><strong class="odv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel || '')}</strong></div>`,
      '</div><div class="odv4-topbar-actions"><span class="odv4-badge odv4-badge-muted">ระดับแพลตฟอร์ม</span><a class="odv4-button odv4-button-secondary" href="#overview">ภาพรวม</a><a class="odv4-button odv4-button-secondary" href="#support">ซัพพอร์ต</a></div></header>',
      '<div class="odv4-shell"><aside class="odv4-sidebar"><div class="odv4-stack"><span class="odv4-sidebar-title">เมนูเจ้าของระบบ</span><p class="odv4-sidebar-copy">วางทะเบียนผู้เช่า บริบทซัพพอร์ต และสถานะเชิงพาณิชย์ไว้ใกล้กัน เพื่อให้งานของเจ้าของระบบอ่านง่ายและตัดสินใจได้เร็ว</p></div>',
      renderNavGroups(safeModel.shell.navGroups),
      '</aside><main class="odv4-main"><section class="odv4-pagehead"><div class="odv4-stack"><span class="odv4-section-kicker">ทะเบียนงานลูกค้าและผู้เช่า</span>',
      `<h1 class="odv4-page-title">${escapeHtml(safeModel.header.title || '')}</h1><p class="odv4-page-subtitle">${escapeHtml(safeModel.header.subtitle || '')}</p><div class="odv4-chip-row">${renderChips(safeModel.header.statusChips)}</div></div>`,
      '<div class="odv4-pagehead-actions"><div class="odv4-stack">',
      `<a class="odv4-button odv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label || 'Create')}</a>`,
      Array.isArray(safeModel.header.secondaryActions) && safeModel.header.secondaryActions.length
        ? `<div class="odv4-action-list">${safeModel.header.secondaryActions.map((action) => `<a class="odv4-button odv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`).join('')}</div>`
        : '',
      '</div></div></section>',
      `<section class="odv4-kpi-strip">${renderSummaryStrip(safeModel.summaryStrip)}</section>`,
      orderedBlocks.join(''),
      `</main><aside class="odv4-rail"><div class="odv4-rail-sticky"><div class="odv4-rail-header">${escapeHtml(routeView.railHeader || 'บริบทเจ้าของระบบ')}</div><p class="odv4-rail-copy">${escapeHtml(routeView.railCopy || 'เก็บงานซัพพอร์ตและงานเชิงพาณิชย์ไว้ใกล้ทะเบียนผู้เช่า เพื่อไม่ให้เจ้าของระบบหลุดบริบทตอนกำลังไล่งาน')}</p>${renderRailCards(safeModel.railCards)}</div></aside></div></div>`,
    ].join('');
  }

  function renderOwnerTenantsV4(target, source, options) {
    if (!target) throw new Error('Owner tenants V4 target is required');
    target.innerHTML = buildOwnerTenantsV4Html(createOwnerTenantsV4Model(source, options));
    return target;
  }

  return {
    createOwnerTenantsV4Model,
    buildOwnerTenantsV4Html,
    renderOwnerTenantsV4,
  };
});
