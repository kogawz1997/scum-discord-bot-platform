(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantDashboardV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const DEFAULT_NAV_GROUPS = [
    {
      label: 'ภาพรวมงานหลัก',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard', current: true },
        { label: 'สถานะเซิร์ฟเวอร์', href: '#server-status' },
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

  const DEFAULT_TASK_GROUPS = [
    {
      tone: 'success',
      tag: 'เริ่มจากตรงนี้',
      title: 'เซิร์ฟเวอร์และสุขภาพระบบ',
      detail: 'ใช้เช็กสถานะเซิร์ฟเวอร์และบอต',
      actions: [
        { label: 'ดูสถานะเซิร์ฟเวอร์', href: '#server-status', primary: true },
        { label: 'เปิดกล่องเหตุขัดข้อง', href: '#incidents' },
        { label: 'เปิดหน้าควบคุมรีสตาร์ต', href: '#restart-control' },
      ],
    },
    {
      tone: 'warning',
      tag: 'ซัพพอร์ตผู้เล่น',
      title: 'คำสั่งซื้อและปัญหาที่ผู้เล่นพบ',
      detail: 'ใช้ดูคำสั่งซื้อ การส่งของ และข้อมูลผู้เล่น',
      actions: [
        { label: 'ดูคำสั่งซื้อล่าสุด', href: '#orders', primary: true },
        { label: 'ดูสถานะการส่งของ', href: '#delivery' },
        { label: 'เปิดข้อมูลผู้เล่น', href: '#players' },
      ],
    },
    {
      tone: 'info',
      tag: 'หลักฐานและการตั้งค่า',
      title: 'ตรวจค่า ใช้หลักฐาน และคุมความเสี่ยง',
      detail: 'ใช้ก่อนเปลี่ยนค่าระบบหรือเมื่อต้องย้อนดูหลักฐาน',
      actions: [
        { label: 'เปิดหน้าตั้งค่าเซิร์ฟเวอร์', href: '#server-config', primary: true },
        { label: 'เปิดบันทึกและหลักฐาน', href: '#audit' },
        { label: 'ดูสถานะบอตและเอเจนต์', href: '#server-bots' },
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
    const deltaDays = Math.round(deltaHours / 24);
    return `${formatNumber(deltaDays)} วันที่แล้ว`;
  }

  function normalizeStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'unknown';
    if (['online', 'ready', 'healthy', 'active'].includes(raw)) return 'online';
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

  function isOpaqueTenantIdentifier(value) {
    const text = String(value ?? '').trim();
    if (!text) return false;
    return /^\d{12,}$/.test(text) || /^tenant[-_][a-z0-9-]{8,}$/i.test(text);
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
        value.kind,
        value.quotaKey,
        value.tenantSlug,
        value.code,
      ], fallback);
    }
    return fallback;
  }

  function looksLikeJsonText(value) {
    const text = String(value ?? '').trim();
    return text.startsWith('{') || text.startsWith('[');
  }

  function joinReadableParts(parts) {
    return parts.filter(Boolean).join(' · ');
  }

  function formatCompactNumber(value, fallback = '') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return formatNumber(numeric, fallback || '0');
  }

  function parseNotificationPayload(item) {
    if (item?.data && typeof item.data === 'object' && !Array.isArray(item.data)) {
      return item.data;
    }
    const rawCandidates = [item?.detail, item?.message];
    for (const candidate of rawCandidates) {
      const text = String(candidate || '').trim();
      if (!looksLikeJsonText(text)) continue;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // fall through to the next candidate
      }
    }
    return {};
  }

  function humanizeQuotaKey(value) {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'apikeys') return 'API key';
    if (key === 'webhooks') return 'เว็บฮุก';
    if (key === 'agentruntimes') return 'รันไทม์';
    if (key === 'subscriptions') return 'การสมัครใช้';
    if (key === 'licenses') return 'ไลเซนส์';
    return firstNonEmpty([String(value || '').trim()], 'โควตา');
  }

  function parseDelimitedNotificationDetail(value) {
    const text = String(value || '').trim();
    if (!text || !text.includes('|')) return null;
    const segments = text
      .split('|')
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    if (segments.length === 0) return null;

    const headline = segments[0];
    const metadata = {};
    segments.slice(1).forEach((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return;
      const key = part.slice(0, separatorIndex).trim().toLowerCase();
      const rawValue = part.slice(separatorIndex + 1).trim();
      if (!key || !rawValue) return;
      metadata[key] = rawValue;
    });

    return { headline, metadata };
  }

  function humanizeSecurityReason(value) {
    const reason = String(value || '').trim().toLowerCase();
    if (reason === 'invalid-credentials') return 'รหัสผ่านหรือข้อมูลเข้าสู่ระบบไม่ถูกต้อง';
    if (reason === 'missing-otp') return 'ไม่ได้กรอกรหัสยืนยันตัวตน';
    if (reason === 'invalid-otp') return 'รหัสยืนยันตัวตนไม่ถูกต้อง';
    if (reason === 'rate-limited') return 'ถูกจำกัดการลองเข้าสู่ระบบชั่วคราว';
    if (reason === 'account-disabled') return 'บัญชีนี้ถูกปิดการใช้งาน';
    if (reason === 'session-rejected') return 'เซสชันนี้ไม่ผ่านการตรวจสอบ';
    return firstNonEmpty([String(value || '').trim()], '');
  }

  function humanizeSecurityHeadline(value) {
    const headline = String(value || '').trim().toLowerCase();
    if (headline === 'admin login failed') return 'มีความพยายามเข้าสู่ระบบผู้ดูแลไม่สำเร็จ';
    if (headline === 'admin login succeeded') return 'มีการเข้าสู่ระบบผู้ดูแลสำเร็จ';
    if (headline === 'admin session revoked') return 'มีการเพิกถอนเซสชันผู้ดูแล';
    if (headline === 'admin permission changed') return 'มีการเปลี่ยนสิทธิ์ของผู้ดูแล';
    return firstNonEmpty([String(value || '').trim()], 'มีเหตุการณ์ด้านความปลอดภัยของผู้ดูแล');
  }

  function humanizeNotificationTitle(item, payload) {
    const kind = String(item?.kind || item?.type || payload?.kind || '').trim().toLowerCase();
    const rawTitle = String(item?.title || item?.label || '').trim();
    const rawDetail = firstNonEmpty([String(item?.detail || '').trim(), String(item?.message || '').trim()], '');
    if (/admin login failed/i.test(rawDetail)) return 'ความพยายามเข้าสู่ระบบไม่สำเร็จ';
    if (/admin login succeeded/i.test(rawDetail)) return 'มีการเข้าสู่ระบบผู้ดูแล';
    if (/admin security event/i.test(rawTitle)) return 'เหตุการณ์ความปลอดภัยของผู้ดูแล';
    if (kind === 'tenant-quota-near-limit') return 'โควตาใกล้เต็ม';
    if (kind === 'tenant-quota-exceeded') return 'โควตาเต็มแล้ว';
    if (kind === 'runtime-offline') return 'รันไทม์ออฟไลน์';
    if (kind === 'runtime-degraded') return 'รันไทม์ต้องตรวจสอบ';
    if (kind === 'agent-runtime-stale') return 'รันไทม์หยุดรายงานสถานะ';
    if (kind === 'agent-version-outdated') return 'เวอร์ชันรันไทม์เก่าเกินไป';
    if (kind === 'delivery-reconcile-anomaly') return 'พบความผิดปกติจากการตรวจ Reconcile';
    if (kind === 'delivery-abuse-suspected') return 'พบสัญญาณการใช้งานผิดปกติ';
    if (kind === 'dead-letter-threshold') return 'dead-letter สูงเกินเกณฑ์';
    if (kind === 'consecutive-failures') return 'การส่งล้มเหลวต่อเนื่อง';
    return firstNonEmpty([
      item?.title,
      item?.label,
      extractReadableText(payload?.title, ''),
      extractReadableText(payload?.label, ''),
      'การแจ้งเตือนล่าสุด',
    ], 'การแจ้งเตือนล่าสุด');
  }

  function humanizeNotificationDetail(item, payload) {
    const kind = String(item?.kind || item?.type || payload?.kind || '').trim().toLowerCase();
    const tenantLabel = firstNonEmpty([payload?.tenantSlug, payload?.tenantId], '');
    const quotaLabel = humanizeQuotaKey(payload?.quotaKey);
    const used = formatCompactNumber(payload?.used, '');
    const limit = formatCompactNumber(payload?.limit, '');
    const remaining = formatCompactNumber(payload?.remaining, '');
    const runtimeLabel = firstNonEmpty([payload?.runtimeLabel, payload?.runtimeKey], 'รันไทม์');
    const reason = firstNonEmpty([payload?.reason, payload?.error, payload?.stderr], '');
    const version = firstNonEmpty([payload?.version], '');
    const minimumVersion = firstNonEmpty([payload?.minimumVersion], '');
    const sample = Array.isArray(payload?.sample) && payload.sample.length > 0
      ? firstNonEmpty([payload.sample[0]?.type, payload.sample[0]?.reason], '')
      : '';
    const count = formatCompactNumber(payload?.count, '');
    const threshold = formatCompactNumber(payload?.threshold, '');
    const delimited = parseDelimitedNotificationDetail(firstNonEmpty([item?.detail, item?.message], ''));

    if (kind === 'tenant-quota-near-limit') {
      return joinReadableParts([
        quotaLabel ? `${quotaLabel} ใกล้ถึงขีดจำกัด` : '',
        tenantLabel ? `ผู้เช่า ${tenantLabel}` : '',
        used && limit ? `ใช้ไป ${used}/${limit}` : '',
        remaining ? `เหลืออีก ${remaining}` : '',
      ]) || 'โควตาของ tenant นี้เหลือน้อยแล้ว ควรตรวจสอบก่อนเปิดงานเพิ่ม';
    }
    if (kind === 'tenant-quota-exceeded') {
      return joinReadableParts([
        quotaLabel ? `${quotaLabel} เต็มแล้ว` : '',
        tenantLabel ? `ผู้เช่า ${tenantLabel}` : '',
        used && limit ? `ใช้ไป ${used}/${limit}` : '',
      ]) || 'โควตาของ tenant นี้เต็มแล้ว ต้องเคลียร์หรืออัปเกรดก่อนใช้งานต่อ';
    }
    if (kind === 'runtime-offline') {
      return joinReadableParts([
        `${runtimeLabel} ออฟไลน์อยู่`,
        reason ? `สาเหตุ ${reason}` : '',
      ]) || 'รันไทม์ไม่ตอบสนอง ควรตรวจสอบการเชื่อมต่อและสถานะบริการ';
    }
    if (kind === 'runtime-degraded') {
      return joinReadableParts([
        `${runtimeLabel} อยู่ในสถานะที่ต้องตรวจสอบ`,
        reason ? `สาเหตุ ${reason}` : '',
      ]) || 'รันไทม์เริ่มมีสัญญาณผิดปกติ ควรตรวจสอบก่อนกระทบผู้เล่น';
    }
    if (kind === 'agent-runtime-stale') {
      return joinReadableParts([
        `${runtimeLabel} ไม่ได้รายงานสถานะล่าสุด`,
        tenantLabel ? `ผู้เช่า ${tenantLabel}` : '',
      ]) || 'รันไทม์หยุดเช็กอินมาระยะหนึ่งแล้ว';
    }
    if (kind === 'agent-version-outdated') {
      return joinReadableParts([
        `${runtimeLabel} ใช้เวอร์ชันเก่า`,
        version ? `ปัจจุบัน ${version}` : '',
        minimumVersion ? `ขั้นต่ำ ${minimumVersion}` : '',
      ]) || 'เวอร์ชันของรันไทม์ต่ำกว่าเกณฑ์ที่ระบบต้องการ';
    }
    if (kind === 'delivery-reconcile-anomaly') {
      return joinReadableParts([
        'การตรวจ Reconcile พบรายการที่ควรตรวจสอบ',
        count ? `จำนวน ${count}` : '',
        sample ? `ตัวอย่าง ${sample}` : '',
      ]) || 'มีรายการส่งของที่ไม่สอดคล้องกัน ควรเปิดตรวจในหน้าหลักฐานต่อ';
    }
    if (kind === 'delivery-abuse-suspected') {
      return joinReadableParts([
        'ระบบพบสัญญาณการใช้งานผิดปกติ',
        count ? `จำนวน ${count}` : '',
        sample ? `ตัวอย่าง ${sample}` : '',
      ]) || 'ควรตรวจสอบพฤติกรรมการใช้งานก่อนทำ retry หรือปรับสิทธิ์';
    }
    if (kind === 'dead-letter-threshold') {
      return joinReadableParts([
        'จำนวน dead-letter แตะเกณฑ์ที่กำหนด',
        count ? `จำนวน ${count}` : '',
        threshold ? `เกณฑ์ ${threshold}` : '',
      ]) || 'จำนวนรายการที่ตก dead-letter สูงกว่าปกติ';
    }
    if (kind === 'consecutive-failures') {
      return joinReadableParts([
        'การส่งล้มเหลวต่อเนื่องเกินเกณฑ์',
        count ? `จำนวน ${count}` : '',
        threshold ? `เกณฑ์ ${threshold}` : '',
      ]) || 'การส่งของกำลังล้มเหลวต่อเนื่อง ควรหยุดดูสาเหตุก่อน retry';
    }

    if (delimited && /admin security event/i.test(String(item?.title || ''))) {
      const actor = firstNonEmpty([delimited.metadata.actor], '');
      const target = firstNonEmpty([delimited.metadata.target], '');
      const ip = firstNonEmpty([delimited.metadata.ip], '');
      const reasonText = humanizeSecurityReason(delimited.metadata.reason);
      return joinReadableParts([
        humanizeSecurityHeadline(delimited.headline),
        actor ? `ผู้ใช้ ${actor}` : '',
        target && target !== actor ? `บัญชีเป้าหมาย ${target}` : '',
        ip ? `IP ${ip}` : '',
        reasonText ? `สาเหตุ ${reasonText}` : '',
      ]) || 'พบเหตุการณ์ด้านความปลอดภัยของผู้ดูแล ควรตรวจสอบต่อในบันทึกความปลอดภัย';
    }

    return firstNonEmpty([
      extractReadableText(item?.detail, ''),
      extractReadableText(item?.message, ''),
      extractReadableText(payload, ''),
      'ติดตามการแจ้งเตือนล่าสุดจากระบบ',
    ], 'ติดตามการแจ้งเตือนล่าสุดจากระบบ');
  }

  function localizeNotificationItem(item) {
    const payload = parseNotificationPayload(item);
    return {
      title: humanizeNotificationTitle(item, payload),
      detail: humanizeNotificationDetail(item, payload),
    };
  }

  function listCount(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function findAgentStatus(agents, matcher) {
    const rows = Array.isArray(agents) ? agents : [];
    const found = rows.find((item) => matcher(String(item?.role || item?.kind || item?.type || '').trim().toLowerCase()));
    return found ? normalizeStatus(found.status || found.state) : 'unknown';
  }

  function hasAgentRecord(agents, matcher) {
    const rows = Array.isArray(agents) ? agents : [];
    return rows.some((item) => matcher(String(item?.role || item?.kind || item?.type || '').trim().toLowerCase()));
  }

  function extractPackageName(legacyState) {
    const subscriptions = Array.isArray(legacyState?.subscriptions) ? legacyState.subscriptions : [];
    const activeSubscription = subscriptions.find((item) => String(item?.status || '').toLowerCase() === 'active') || subscriptions[0];
    return firstNonEmpty([
      activeSubscription?.packageName,
      activeSubscription?.planName,
      legacyState?.dashboardCards?.packageName,
      legacyState?.overview?.packageName,
      legacyState?.overview?.planName,
      legacyState?.tenantConfig?.previewMode || legacyState?.overview?.tenantConfig?.previewMode
        ? 'โหมดดูตัวอย่าง'
        : 'ยังไม่ระบุแพ็กเกจ',
    ]);
  }

  function extractLastSync(legacyState) {
    return firstNonEmpty([
      legacyState?.deliveryRuntime?.lastSyncAt,
      legacyState?.overview?.analytics?.delivery?.lastSyncAt,
      legacyState?.reconcile?.lastRunAt,
      legacyState?.notifications?.[0]?.createdAt,
    ]);
  }

  function hasActivePackage(legacyState) {
    const subscriptions = Array.isArray(legacyState?.subscriptions) ? legacyState.subscriptions : [];
    return subscriptions.some((item) => ['active', 'trial', 'trialing'].includes(String(item?.status || '').trim().toLowerCase()))
      || !String(extractPackageName(legacyState) || '').includes('ยังไม่ระบุแพ็กเกจ');
  }

  function hasServerConfigSnapshot(legacyState) {
    return String(legacyState?.serverConfigWorkspace?.snapshotStatus || '').trim().toLowerCase() === 'ready'
      && Array.isArray(legacyState?.serverConfigWorkspace?.categories)
      && legacyState.serverConfigWorkspace.categories.length > 0;
  }

  function buildIssues(legacyState) {
    const issues = [];
    const deadLetters = listCount(legacyState?.deadLetters);
    const queueDepth = listCount(legacyState?.queueItems);
    const anomalyCount = Number(legacyState?.reconcile?.summary?.anomalies || 0);
    const abuseCount = Number(legacyState?.reconcile?.summary?.abuseFindings || 0);
    const notifications = Array.isArray(legacyState?.notifications) ? legacyState.notifications.slice(0, 3) : [];
    const serverStatus = normalizeStatus(
      legacyState?.overview?.serverStatus
      || legacyState?.dashboardCards?.serverStatus
      || legacyState?.deliveryRuntime?.serverStatus,
    );

    if (serverStatus !== 'online') {
      issues.push({
        tone: 'danger',
        title: 'สถานะเซิร์ฟเวอร์ยังไม่พร้อม',
        detail: 'เปิดหน้าสถานะเซิร์ฟเวอร์ก่อน เพื่อตรวจว่าปัญหาอยู่ที่ไหน',
        meta: statusLabel(serverStatus),
      });
    }
    if (deadLetters > 0) {
      issues.push({
        tone: 'danger',
        title: 'มีงานล้มเหลวค้างอยู่',
        detail: 'ตรวจสาเหตุก่อนสั่งลองใหม่หรือคืนสถานะให้ผู้เล่น',
        meta: `${formatNumber(deadLetters)} รายการ`,
      });
    }
    if (queueDepth > 5) {
      issues.push({
        tone: 'warning',
        title: 'คิวส่งของเริ่มสะสม',
        detail: 'ตรวจภาระงานของ Delivery Agent และงานที่รอนานผิดปกติ',
        meta: `${formatNumber(queueDepth)} รายการ`,
      });
    }
    if (anomalyCount > 0 || abuseCount > 0) {
      issues.push({
        tone: anomalyCount > 0 ? 'warning' : 'danger',
        title: 'พบสัญญาณผิดปกติจากงานตรวจสอบ',
        detail: 'เปิด Audit หรือ Diagnostics เพื่อตรวจรายละเอียดก่อนทำงานต่อ',
        meta: `anomalies ${formatNumber(anomalyCount)} · abuse ${formatNumber(abuseCount)}`,
      });
    }

    notifications.forEach((item) => {
      const localized = localizeNotificationItem(item);
      issues.push({
        tone: toneForStatus(item?.severity || item?.tone || 'degraded'),
        title: localized.title,
        detail: localized.detail,
        meta: formatRelative(item?.createdAt),
      });
    });

    return issues.slice(0, 5);
  }

  function buildContextBlocks(legacyState) {
    const quota = legacyState?.quota?.quotas || {};
    const apiKeysUsed = quota?.apiKeys ? `${formatNumber(quota.apiKeys.used)}/${formatNumber(quota.apiKeys.limit, 'ไม่จำกัด')}` : 'ยังไม่มีข้อมูล';
    const hooksUsed = quota?.webhooks ? `${formatNumber(quota.webhooks.used)}/${formatNumber(quota.webhooks.limit, 'ไม่จำกัด')}` : 'ยังไม่มีข้อมูล';
    const runtimesUsed = quota?.agentRuntimes ? `${formatNumber(quota.agentRuntimes.used)}/${formatNumber(quota.agentRuntimes.limit, 'ไม่จำกัด')}` : 'ยังไม่มีข้อมูล';
    const agents = Array.isArray(legacyState?.agents) ? legacyState.agents : [];
    const executeOnline = findAgentStatus(agents, (role) => role.includes('execute') || role.includes('delivery') || role.includes('console'));
    const syncOnline = findAgentStatus(agents, (role) => role.includes('sync') || role.includes('server') || role.includes('watcher'));

    return [
      {
        label: 'สถานะแพ็กเกจ',
        value: extractPackageName(legacyState),
        detail: 'สรุปสิทธิ์ใช้งานและโมดูลที่เปิดอยู่ใน tenant นี้ เพื่อช่วยตัดสินใจว่าต้องเปิดงานเพิ่มหรืออัปเกรดแพ็กเกจก่อนหรือไม่',
        tone: 'info',
      },
      {
        label: 'โควตาที่ต้องจับตา',
        value: `คีย์ ${apiKeysUsed}`,
        detail: `เว็บฮุก ${hooksUsed} · รันไทม์ ${runtimesUsed}`,
        tone: 'warning',
      },
      {
        label: 'การเชื่อมต่อของรันไทม์',
        value: `Delivery Agent ${statusLabel(executeOnline)}`,
        detail: `Server Bot ${statusLabel(syncOnline)}`,
        tone: executeOnline === 'online' && syncOnline === 'online' ? 'success' : 'warning',
      },
    ];
  }

  function buildHighlights(legacyState) {
    const analytics = legacyState?.overview?.analytics || {};
    const delivery = analytics?.delivery || {};
    const linkedPlayers = (Array.isArray(legacyState?.players) ? legacyState.players : []).filter((item) => item?.steamId || item?.steam_id || item?.steam?.id).length;
    return [
      {
        title: 'ประสิทธิภาพการส่งของ',
        value: `${formatNumber(delivery.successRate, '0')}%`,
        detail: `${formatNumber(delivery.purchaseCount30d, '0')} คำสั่งซื้อในช่วงล่าสุด`,
      },
      {
        title: 'ผู้เล่นที่ผูกบัญชีแล้ว',
        value: formatNumber(linkedPlayers, '0'),
        detail: `${formatNumber(listCount(legacyState?.players), '0')} โปรไฟล์ผู้เล่นที่รู้จักในระบบ`,
      },
      {
        title: 'รายการสินค้าในร้าน',
        value: formatNumber(listCount(legacyState?.shopItems), '0'),
        detail: 'ใช้ยืนยันว่าหน้าร้านพร้อมเปิดขายและมีข้อมูลให้ผู้เล่นเห็นครบ',
      },
    ];
  }

  function buildRailCards(legacyState, issues) {
    const notifications = Array.isArray(legacyState?.notifications) ? legacyState.notifications : [];
    const nextStep = issues[0]
      ? {
          title: 'สิ่งที่ควรทำต่อ',
          body: issues[0].title,
          meta: issues[0].detail,
          tone: issues[0].tone,
        }
      : {
          title: 'สิ่งที่ควรทำต่อ',
          body: 'ภาพรวมวันนี้อยู่ในเกณฑ์พร้อมใช้งาน',
          meta: 'ถัดไปให้ตรวจคำสั่งซื้อใหม่และยืนยันว่า Server Bot ยัง sync ตามเวลาปกติ',
          tone: 'success',
        };

    const firstNotification = notifications[0] ? localizeNotificationItem(notifications[0]) : null;

    return [
      nextStep,
      {
        title: 'การแจ้งเตือนล่าสุด',
        body: notifications.length > 0 ? `${formatNumber(notifications.length)} รายการที่ต้องอ่าน` : 'ยังไม่มีแจ้งเตือนใหม่',
        meta: firstNotification
          ? `${firstNotification.title} · ${formatRelative(notifications[0].createdAt)}`
          : 'เมื่อมีการแจ้งเตือนจากระบบ จะขึ้นตรงนี้เพื่อให้คุณไม่พลาดงานที่ต้องตามต่อ',
        tone: notifications.length > 0 ? 'warning' : 'muted',
      },
      {
        title: 'สถานะแพ็กเกจ',
        body: extractPackageName(legacyState),
        meta: 'แพ็กเกจนี้เป็นฐานของ feature gate, สิทธิ์ใช้โมดูล และขีดจำกัดบางอย่างของ tenant นี้',
        tone: 'info',
      },
    ];
  }

  function buildActivity(legacyState) {
    const notifications = Array.isArray(legacyState?.notifications) ? legacyState.notifications : [];
    const auditItems = Array.isArray(legacyState?.audit?.items) ? legacyState.audit.items : [];
    const feed = [];

    notifications.slice(0, 3).forEach((item) => {
      const localized = localizeNotificationItem(item);
      feed.push({
        tone: toneForStatus(item?.severity || item?.tone || 'degraded'),
        title: localized.title,
        detail: localized.detail,
        meta: formatDateTime(item?.createdAt),
      });
    });

    auditItems.slice(0, 3).forEach((item) => {
      feed.push({
        tone: 'muted',
        title: firstNonEmpty([item?.action, item?.title, 'กิจกรรมของผู้ดูแล']),
        detail: firstNonEmpty([item?.detail, item?.summary, item?.actor, 'มีการเปลี่ยนแปลงจากฝั่งผู้ดูแล']),
        meta: formatDateTime(item?.createdAt || item?.timestamp),
      });
    });

    if (feed.length === 0) {
      feed.push({
        tone: 'muted',
        title: 'ยังไม่มีกิจกรรมใหม่',
        detail: 'เมื่อมีการเปลี่ยนแปลงจากระบบหรือผู้ดูแล หน้านี้จะช่วยให้เห็นลำดับเหตุการณ์ได้เร็วขึ้น',
        meta: 'พร้อมสำหรับข้อมูลจริง',
      });
    }

    return feed.slice(0, 6);
  }

  function pickLatestRow(rows, timestampFields) {
    const list = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
    if (list.length === 0) return null;
    const fields = Array.isArray(timestampFields) && timestampFields.length > 0
      ? timestampFields
      : ['updatedAt', 'completedAt', 'finishedAt', 'occurredAt', 'createdAt', 'requestedAt', 'claimedAt', 'startedAt'];
    return list
      .slice()
      .sort((left, right) => {
        const leftValue = firstNonEmpty(fields.map((field) => left?.[field]), '');
        const rightValue = firstNonEmpty(fields.map((field) => right?.[field]), '');
        const leftTime = parseDate(leftValue)?.getTime() || 0;
        const rightTime = parseDate(rightValue)?.getTime() || 0;
        return rightTime - leftTime;
      })[0] || null;
  }

  function isJobFailureStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['failed', 'error', 'offline', 'revoked', 'dead-letter', 'dead_letter', 'deadletter'].includes(normalized);
  }

  function summarizeJobWatchCandidate(raw, options = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const status = firstNonEmpty([
      options.status,
      raw?.status,
      raw?.resultStatus,
      raw?.healthStatus,
      raw?.severity,
      raw?.state,
      '',
    ], 'unknown');
    const at = firstNonEmpty([
      raw?.updatedAt,
      raw?.completedAt,
      raw?.finishedAt,
      raw?.occurredAt,
      raw?.createdAt,
      raw?.requestedAt,
      raw?.claimedAt,
      raw?.startedAt,
      '',
    ], '');
    const metaPrefix = options.metaLabel ? `${options.metaLabel} · ` : '';
    return {
      title: firstNonEmpty([
        options.title,
        raw?.displayName,
        raw?.jobType,
        raw?.kind,
        raw?.eventType,
        raw?.purchaseCode,
        raw?.code,
        'Workflow signal',
      ]),
      detail: firstNonEmpty([
        extractReadableText(raw?.error, ''),
        extractReadableText(raw?.detail, ''),
        extractReadableText(raw?.message, ''),
        extractReadableText(raw?.summary, ''),
        extractReadableText(raw?.reason, ''),
        extractReadableText(raw?.meta, ''),
        raw?.jobType ? `${raw.jobType} is ${status}` : '',
        'No extra detail yet',
      ], 'No extra detail yet'),
      tone: options.tone || toneForStatus(status),
      status,
      href: options.href || '#logs-sync',
      actionLabel: options.actionLabel || 'Open logs & sync',
      timestamp: at,
      meta: at
        ? `${metaPrefix}${formatDateTime(at)}`
        : `${metaPrefix}${firstNonEmpty([options.fallbackMeta], 'No timestamp yet')}`,
    };
  }

  function buildJobWatch(legacyState, lastSyncAt) {
    const currentJob = summarizeJobWatchCandidate(
      legacyState?.serverConfigWorkspace?.currentJob,
      {
        title: 'Current job',
        href: '#logs-sync',
        actionLabel: 'Open logs & sync',
        metaLabel: 'In progress',
      },
    );
    const latestDeadLetter = summarizeJobWatchCandidate(
      pickLatestRow(legacyState?.deadLetters, ['updatedAt', 'createdAt']),
      {
        title: 'Latest failed delivery job',
        tone: 'danger',
        href: '#orders',
        actionLabel: 'Open orders',
        metaLabel: 'Delivery',
        status: 'failed',
      },
    );
    const latestRestartFailure = summarizeJobWatchCandidate(
      pickLatestRow(
        (Array.isArray(legacyState?.restartExecutions) ? legacyState.restartExecutions : [])
          .filter((row) => isJobFailureStatus(row?.resultStatus || row?.status)),
        ['finishedAt', 'updatedAt', 'createdAt'],
      ),
      {
        title: 'Latest failed restart',
        tone: 'danger',
        href: '#restart-control',
        actionLabel: 'Open restart control',
        metaLabel: 'Restart',
      },
    );
    const latestSyncFailure = summarizeJobWatchCandidate(
      pickLatestRow(
        (Array.isArray(legacyState?.syncRuns) ? legacyState.syncRuns : [])
          .filter((row) => isJobFailureStatus(row?.status || row?.resultStatus || row?.healthStatus)),
        ['finishedAt', 'updatedAt', 'startedAt', 'createdAt'],
      ),
      {
        title: 'Latest failed sync',
        tone: 'warning',
        href: '#logs-sync',
        actionLabel: 'Open logs & sync',
        metaLabel: 'Sync',
      },
    );
    const latestFailure = [latestDeadLetter, latestRestartFailure, latestSyncFailure]
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = parseDate(left?.timestamp)?.getTime() || 0;
        const rightTime = parseDate(right?.timestamp)?.getTime() || 0;
        return rightTime - leftTime;
      })[0] || null;
    const queueDepth = listCount(legacyState?.queueItems);
    const deadLetterCount = listCount(legacyState?.deadLetters);
    const latestSyncRun = pickLatestRow(legacyState?.syncRuns, ['finishedAt', 'startedAt', 'createdAt']);
    const queueTone = deadLetterCount > 0 ? 'danger' : queueDepth > 0 ? 'warning' : 'success';
    const queueRow = {
      title: 'Queue backlog',
      detail: deadLetterCount > 0
        ? `${formatNumber(queueDepth, '0')} queued workflows and ${formatNumber(deadLetterCount, '0')} failed jobs still need operator follow-up.`
        : queueDepth > 0
          ? `${formatNumber(queueDepth, '0')} queued workflows are still waiting for delivery or server processing.`
          : 'No queued or failed workflow is waiting for follow-up right now.',
      meta: deadLetterCount > 0
        ? 'Open orders first, then inspect logs & sync if the runtime looks unhealthy.'
        : queueDepth > 0
          ? 'Open orders to inspect what is waiting next.'
          : 'Queue is clear',
      tone: queueTone,
    };
    const syncRow = {
      title: 'Sync pulse',
      detail: latestSyncRun
        ? firstNonEmpty([
          extractReadableText(latestSyncRun?.detail, ''),
          extractReadableText(latestSyncRun?.summary, ''),
          extractReadableText(latestSyncRun?.message, ''),
          extractReadableText(latestSyncRun?.runtimeKey, ''),
          'Latest sync run is available in Logs & Sync.',
        ], 'Latest sync run is available in Logs & Sync.')
        : 'No sync run has reported back yet. Open Logs & Sync to inspect the next handshake.',
      meta: lastSyncAt
        ? `Last sync ${formatRelative(lastSyncAt)} · ${formatDateTime(lastSyncAt)}`
        : 'No sync timestamp yet',
      tone: latestSyncRun ? toneForStatus(latestSyncRun?.status || latestSyncRun?.resultStatus || latestSyncRun?.healthStatus) : 'muted',
    };
    const rows = [
      currentJob,
      latestFailure,
      queueRow,
      syncRow,
    ].filter(Boolean);
    const primaryAction = latestFailure
      ? { label: latestFailure.actionLabel, href: latestFailure.href }
      : currentJob
        ? { label: currentJob.actionLabel, href: currentJob.href }
        : queueDepth > 0
          ? { label: 'Open orders', href: '#orders' }
          : { label: 'Open server status', href: '#server-status' };

    return {
      title: 'Current and failed jobs',
      detail: 'See the active workflow, the latest failure, and where operators should open next without leaving the dashboard first.',
      badges: [
        { label: currentJob ? `active ${firstNonEmpty([currentJob.status], 'job')}` : 'no active job', tone: currentJob ? currentJob.tone : 'muted' },
        { label: deadLetterCount > 0 ? `${formatNumber(deadLetterCount, '0')} failed jobs` : 'no failed jobs', tone: deadLetterCount > 0 ? 'danger' : 'success' },
        { label: queueDepth > 0 ? `${formatNumber(queueDepth, '0')} queued workflows` : 'queue clear', tone: queueDepth > 0 ? 'warning' : 'success' },
      ],
      primaryAction,
      secondaryActions: [
        { label: 'Open logs & sync', href: '#logs-sync' },
        { label: 'Open restart control', href: '#restart-control' },
        { label: 'Open orders', href: '#orders' },
      ],
      rows,
    };
  }

  function buildSetupFlow(legacyState, serverStatus, executeStatus, syncStatus, issues) {
    const hasSyncRuntime = hasAgentRecord(
      legacyState?.agents,
      (role) => role.includes('sync') || role.includes('server') || role.includes('watcher'),
    );
    const hasExecuteRuntime = hasAgentRecord(
      legacyState?.agents,
      (role) => role.includes('execute') || role.includes('delivery') || role.includes('console'),
    );
    const packageReady = hasActivePackage(legacyState);
    const configReady = hasServerConfigSnapshot(legacyState);
    const readyForDailyWork = serverStatus === 'online'
      && executeStatus === 'online'
      && syncStatus === 'online'
      && configReady;
    const steps = [
      {
        key: 'package',
        title: 'เลือกแพ็กเกจ',
        detail: 'ยืนยันว่าแพ็กเกจเปิดสิทธิ์งานส่งของ บอต และการตั้งค่าเซิร์ฟเวอร์จริงแล้ว',
        href: '#plan',
        ready: packageReady,
      },
      {
        key: 'server-bot',
        title: 'สร้าง Server Bot',
        detail: 'เชื่อม log, สถานะเซิร์ฟเวอร์ และงาน restart ให้พร้อมก่อน',
        href: '#server-bots',
        ready: syncStatus === 'online',
      },
      {
        key: 'delivery-agent',
        title: 'ติดตั้ง Delivery Agent',
        detail: 'ให้ระบบส่งของในเกมและประกาศงานสำคัญได้จริง',
        href: '#delivery-agents',
        ready: executeStatus === 'online',
      },
      {
        key: 'activate',
        title: 'ยืนยันว่าเซิร์ฟเวอร์พร้อมใช้งาน',
        detail: 'ดูสถานะเซิร์ฟเวอร์ คิวงาน และการซิงก์ก่อนเปิดใช้งานเต็มรูปแบบ',
        href: '#server-status',
        ready: serverStatus === 'online',
      },
    ];

    const nextStep = steps.find((item) => !item.ready) || null;
    const hasIssues = Array.isArray(issues) && issues.length > 0;
    const primaryAction = nextStep
      ? { label: `${nextStep.title} (แนะนำ)`, href: nextStep.href }
      : hasIssues
        ? { label: 'เปิดกล่องเหตุขัดข้อง (แนะนำ)', href: '#incidents' }
        : { label: 'ดูสถานะเซิร์ฟเวอร์', href: '#server-status' };

    return {
      title: nextStep ? 'ทำตามลำดับนี้ก่อน' : 'ระบบพร้อมแล้ว',
      detail: nextStep
        ? 'ตั้งระบบหลักให้พร้อมก่อนเปิดงานขายหรือส่งของ'
        : 'เริ่มจากงานประจำวันหรือสัญญาณที่ยังเปิดอยู่',
      primaryAction,
      secondaryActions: nextStep
        ? steps.filter((item) => item.key !== nextStep.key).map((item) => ({ label: item.title, href: item.href }))
        : [
            { label: 'ดูคำสั่งซื้อ', href: '#orders' },
            { label: 'ดูผู้เล่น', href: '#players' },
          ],
      steps,
    };
  }

  function buildSetupFlowV2(legacyState, serverStatus, executeStatus, syncStatus, issues) {
    const hasSyncRuntime = hasAgentRecord(
      legacyState?.agents,
      (role) => role.includes('sync') || role.includes('server') || role.includes('watcher'),
    );
    const hasExecuteRuntime = hasAgentRecord(
      legacyState?.agents,
      (role) => role.includes('execute') || role.includes('delivery') || role.includes('console'),
    );
    const packageReady = hasActivePackage(legacyState);
    const configReady = hasServerConfigSnapshot(legacyState);
    const readyForDailyWork = serverStatus === 'online'
      && executeStatus === 'online'
      && syncStatus === 'online'
      && configReady;
    const steps = [
      {
        key: 'package',
        title: 'เลือกแพ็กเกจ',
        detail: 'ยืนยันว่าแพ็กเกจเปิดสิทธิ์หลักของเซิร์ฟเวอร์นี้แล้ว',
        href: '#plan',
        ready: packageReady,
      },
      {
        key: 'create-server-bot',
        title: 'สร้าง Server Bot',
        detail: 'สร้างตัวดูแลเซิร์ฟเวอร์สำหรับ log, sync และงานควบคุม',
        href: '#server-bots',
        ready: hasSyncRuntime,
      },
      {
        key: 'install-server-bot',
        title: 'ติดตั้ง Server Bot',
        detail: 'ให้ Server Bot ออนไลน์และส่งข้อมูลล่าสุดกลับเข้าระบบ',
        href: '#server-bots',
        ready: syncStatus === 'online',
      },
      {
        key: 'create-delivery-agent',
        title: 'สร้าง Delivery Agent',
        detail: 'สร้างตัวส่งของสำหรับงานที่ต้องทำในเกมจริง',
        href: '#delivery-agents',
        ready: hasExecuteRuntime,
      },
      {
        key: 'install-delivery-agent',
        title: 'ติดตั้ง Delivery Agent',
        detail: 'ให้ตัวส่งของออนไลน์และพร้อมรับงานทันที',
        href: '#delivery-agents',
        ready: executeStatus === 'online',
      },
      {
        key: 'configure-server',
        title: 'ตั้งค่าเซิร์ฟเวอร์',
        detail: 'ตรวจและบันทึกค่าหลักของเซิร์ฟเวอร์ก่อนเปิดใช้งานจริง',
        href: '#server-config',
        ready: configReady,
      },
      {
        key: 'start-using',
        title: 'เริ่มใช้งานจริง',
        detail: 'ตรวจสถานะ คิวงาน และการซิงก์ให้พร้อมสำหรับงานประจำวัน',
        href: '#server-status',
        ready: readyForDailyWork,
      },
    ];

    const completedSteps = steps.filter((item) => item.ready).length;
    const nextStep = steps.find((item) => !item.ready) || null;
    const hasIssues = Array.isArray(issues) && issues.length > 0;
    const primaryAction = nextStep
      ? { label: `${nextStep.title} (แนะนำ)`, href: nextStep.href }
      : hasIssues
        ? { label: 'เปิดกล่องปัญหา (แนะนำ)', href: '#incidents' }
        : { label: 'ดูสถานะเซิร์ฟเวอร์', href: '#server-status' };

    return {
      title: nextStep ? 'ทำตามลำดับนี้ก่อน' : 'ระบบพร้อมใช้งานแล้ว',
      detail: nextStep
        ? `ตั้งค่าระบบหลักให้ครบก่อนเปิดงานจริง ตอนนี้ทำแล้ว ${completedSteps}/${steps.length} ขั้น`
        : 'ระบบหลักพร้อมแล้ว เริ่มดูคิวงาน ผู้เล่น หรือการตั้งค่าต่อได้ทันที',
      primaryAction,
      secondaryActions: nextStep
        ? steps.filter((item) => item.key !== nextStep.key).map((item) => ({ label: item.title, href: item.href }))
        : [
            { label: 'ดูคำสั่งซื้อ', href: '#orders' },
            { label: 'ดูผู้เล่น', href: '#players' },
          ],
      completedSteps,
      steps,
    };
  }

  function buildQuickActions(setupFlow) {
    const nextHref = setupFlow?.primaryAction?.href || '#server-status';
    return [
      {
        key: 'create-server-bot',
        label: 'เปิดหน้า Server Bot',
        href: '#server-bots',
        detail: 'สร้างหรือเชื่อมบอทเซิร์ฟเวอร์สำหรับ log การซิงก์ และงานควบคุมเซิร์ฟเวอร์',
      },
      {
        key: 'create-delivery-agent',
        label: 'เปิดหน้า Delivery Agent',
        href: '#delivery-agents',
        detail: 'สร้างหรือเชื่อมตัวส่งของในเกมสำหรับงานส่งของและประกาศสำคัญ',
      },
      {
        key: 'open-config',
        label: 'เปิดหน้าตั้งค่าเซิร์ฟเวอร์',
        href: '#server-config',
        detail: 'ตรวจและปรับค่าหลักของเซิร์ฟเวอร์ก่อนเปิดใช้งานประจำวัน',
      },
      {
        key: 'restart-server',
        label: 'เปิดหน้าควบคุมการรีสตาร์ต',
        href: '#restart-control',
        detail: nextHref === '#restart-control'
          ? 'เปิดหน้าควบคุมการรีสตาร์ตเพื่อทำขั้นถัดไปให้เสร็จ'
          : 'ใช้เมื่ออยากรีสตาร์ตอย่างเป็นขั้นตอนและบอกผู้เล่นล่วงหน้า',
      },
    ];
  }

  function createTenantDashboardV4Model(legacyState) {
    const state = legacyState && typeof legacyState === 'object' ? legacyState : {};
    const rawTenantName = firstNonEmpty([
      state?.tenantConfig?.name,
      state?.tenantLabel,
      state?.overview?.tenantName,
      state?.overview?.tenant?.name,
      state?.overview?.tenant?.slug,
      state?.me?.tenantName,
      state?.me?.tenantId,
      '',
    ]);
    const tenantName = isOpaqueTenantIdentifier(rawTenantName)
      ? 'พื้นที่ดูแลเซิร์ฟเวอร์'
      : firstNonEmpty([rawTenantName], 'พื้นที่ดูแลเซิร์ฟเวอร์');
    const serverStatus = normalizeStatus(
      state?.overview?.serverStatus
      || state?.dashboardCards?.serverStatus
      || state?.deliveryRuntime?.serverStatus,
    );
    const executeStatus = findAgentStatus(
      state?.agents,
      (role) => role.includes('execute') || role.includes('delivery') || role.includes('console'),
    );
    const syncStatus = findAgentStatus(
      state?.agents,
      (role) => role.includes('sync') || role.includes('server') || role.includes('watcher'),
    );
    const lastSyncAt = extractLastSync(state);
    const issues = buildIssues(state);
    const setupFlow = buildSetupFlowV2(state, serverStatus, executeStatus, syncStatus, issues);
    const setupReady = Array.isArray(setupFlow?.steps) && setupFlow.steps.every((step) => step.ready);
    const readinessPercent = setupFlow?.steps?.length
      ? Math.round((Number(setupFlow.completedSteps || 0) / Number(setupFlow.steps.length)) * 100)
      : 0;
    const nextRequiredStep = Array.isArray(setupFlow?.steps)
      ? setupFlow.steps.find((step) => !step.ready) || null
      : null;
    const quickActions = buildQuickActions(setupFlow);
    const leadingIssue = Array.isArray(issues) && issues.length > 0 ? issues[0] : null;
    const decisionPanel = !setupReady
      ? {
          title: 'ตั้งระบบหลักให้พร้อมก่อน',
          detail: 'เริ่มจากลำดับแนะนำก่อน เพื่อไม่ให้เปิดงานขายหรือส่งของทั้งที่บอตยังไม่พร้อม',
          primaryAction: setupFlow.primaryAction,
          secondaryActions: setupFlow.secondaryActions,
          checkpoints: [
            { label: 'เซิร์ฟเวอร์', value: statusLabel(serverStatus), detail: 'ดูความพร้อมของเซิร์ฟเวอร์', tone: toneForStatus(serverStatus) },
            { label: 'Delivery Agent', value: statusLabel(executeStatus), detail: 'ตัวส่งของในเกม', tone: toneForStatus(executeStatus) },
            { label: 'Server Bot', value: statusLabel(syncStatus), detail: 'ตัวอ่าน log และคุมเซิร์ฟเวอร์', tone: toneForStatus(syncStatus) },
          ],
          leadingIssue,
        }
      : leadingIssue
        ? {
            title: 'ระบบพร้อมแล้ว แต่ยังมีเรื่องที่ต้องดู',
            detail: 'เริ่มจากสัญญาณที่กระทบผู้เล่นหรือคิวงานก่อน แล้วค่อยไปต่อที่งานอื่น',
            primaryAction: {
              label: 'เปิดปัญหาที่ควรจัดการก่อน (แนะนำ)',
              href: '#dashboard-issues',
            },
            secondaryActions: [
              { label: 'ดูสถานะเซิร์ฟเวอร์', href: '#server-status' },
              { label: 'ดูคำสั่งซื้อ', href: '#orders' },
              { label: 'ดูผู้เล่น', href: '#players' },
            ],
          checkpoints: [
              { label: 'เซิร์ฟเวอร์', value: statusLabel(serverStatus), detail: 'พร้อมสำหรับงานประจำวันหรือไม่', tone: toneForStatus(serverStatus) },
              { label: 'งานค้าง', value: formatNumber(listCount(state?.queueItems), '0'), detail: `${formatNumber(listCount(state?.deadLetters), '0')} งานล้มเหลว`, tone: listCount(state?.deadLetters) > 0 ? 'danger' : listCount(state?.queueItems) > 0 ? 'warning' : 'success' },
              { label: 'sync ล่าสุด', value: formatRelative(lastSyncAt), detail: formatDateTime(lastSyncAt), tone: 'muted' },
            ],
            leadingIssue,
          }
        : {
            title: 'ระบบพร้อมสำหรับงานประจำวัน',
            detail: 'ไม่มีสัญญาณเร่งด่วน คุณไปต่อที่คำสั่งซื้อ ผู้เล่น หรือการตั้งค่าได้ทันที',
            primaryAction: {
              label: 'ดูคำสั่งซื้อล่าสุด (แนะนำ)',
              href: '#orders',
            },
            secondaryActions: [
              { label: 'ดูสถานะเซิร์ฟเวอร์', href: '#server-status' },
              { label: 'ดูผู้เล่น', href: '#players' },
              { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
            ],
            checkpoints: [
              { label: 'เซิร์ฟเวอร์', value: statusLabel(serverStatus), detail: 'พร้อมรับงานหรือไม่', tone: toneForStatus(serverStatus) },
              { label: 'Delivery Agent', value: statusLabel(executeStatus), detail: 'พร้อมส่งของ', tone: toneForStatus(executeStatus) },
              { label: 'Server Bot', value: statusLabel(syncStatus), detail: 'พร้อมดูแลเซิร์ฟเวอร์', tone: toneForStatus(syncStatus) },
            ],
            leadingIssue: null,
          };

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงผู้เช่า',
        workspaceLabel: tenantName,
        environmentLabel: 'พื้นที่ผู้เช่า',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : DEFAULT_NAV_GROUPS,
      },
      notice: state?.__surfaceNotice || null,
      header: {
        title: tenantName,
        subtitle: 'ศูนย์งานประจำวันของผู้ดูแลเซิร์ฟเวอร์ เปิดมาแล้วรู้ว่าควรทำอะไรก่อน',
        statusChips: [
          { label: extractPackageName(state), tone: 'info' },
          { label: `เซิร์ฟเวอร์ ${statusLabel(serverStatus)}`, tone: toneForStatus(serverStatus) },
          { label: `Delivery Agent ${statusLabel(executeStatus)}`, tone: toneForStatus(executeStatus) },
          { label: `Server Bot ${statusLabel(syncStatus)}`, tone: toneForStatus(syncStatus) },
          { label: `sync ล่าสุด ${formatRelative(lastSyncAt)}`, tone: 'muted' },
        ],
        primaryAction: setupFlow.primaryAction,
      },
      kpis: [
        {
          label: 'System readiness',
          value: `${formatNumber(readinessPercent, '0')}%`,
          detail: nextRequiredStep
            ? `Next required step: ${nextRequiredStep.title}`
            : 'Core tenant setup is complete and ready for daily operations',
          tone: setupReady ? 'success' : readinessPercent >= 50 ? 'warning' : 'danger',
        },
        {
          label: 'แพ็กเกจปัจจุบัน',
          value: extractPackageName(state),
          detail: 'สิทธิ์หลักของ tenant นี้',
          tone: 'info',
        },
        {
          label: 'สถานะเซิร์ฟเวอร์',
          value: statusLabel(serverStatus),
          detail: 'พร้อมใช้งานหรือไม่',
          tone: toneForStatus(serverStatus),
        },
        {
          label: 'Delivery Agent',
          value: statusLabel(executeStatus),
          detail: 'ตัวส่งของในเกม',
          tone: toneForStatus(executeStatus),
        },
        {
          label: 'Server Bot',
          value: statusLabel(syncStatus),
          detail: 'ตัวอ่าน log และคุมเซิร์ฟเวอร์',
          tone: toneForStatus(syncStatus),
        },
        {
          label: 'sync ล่าสุด',
          value: formatRelative(lastSyncAt),
          detail: formatDateTime(lastSyncAt),
          tone: 'muted',
        },
        {
          label: 'งานที่รอดำเนินการ',
          value: formatNumber(listCount(state?.queueItems), '0'),
          detail: `${formatNumber(listCount(state?.deadLetters), '0')} งานล้มเหลว`,
          tone: listCount(state?.deadLetters) > 0 ? 'warning' : 'success',
        },
      ],
      decisionPanel,
      readiness: {
        percent: readinessPercent,
        completedSteps: Number(setupFlow?.completedSteps || 0),
        totalSteps: Array.isArray(setupFlow?.steps) ? setupFlow.steps.length : 0,
        nextRequiredStep: nextRequiredStep
          ? {
              title: nextRequiredStep.title,
              detail: nextRequiredStep.detail,
              href: nextRequiredStep.href,
            }
          : null,
      },
      setupReady,
      setupFlow,
      quickActions,
      taskGroups: DEFAULT_TASK_GROUPS,
      jobWatch: buildJobWatch(state, lastSyncAt),
      issues,
      contextBlocks: buildContextBlocks(state),
      highlights: buildHighlights(state),
      railCards: buildRailCards(state, issues),
      activity: buildActivity(state),
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

  function renderKpi(item) {
    return [
      `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-kpi-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-kpi-value">${escapeHtml(item.value)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function renderSetupStep(step, index) {
    return [
      `<article class="tdv4-setup-step tdv4-tone-${escapeHtml(step.ready ? 'success' : 'warning')}">`,
      `<div class="tdv4-setup-step-index">${escapeHtml(String(index + 1))}</div>`,
      '<div class="tdv4-setup-step-copy">',
      `<strong class="tdv4-setup-step-title">${escapeHtml(step.title)}</strong>`,
      `<p class="tdv4-kpi-detail">${escapeHtml(step.detail)}</p>`,
      '</div>',
      `<div class="tdv4-setup-step-state">${renderBadge(step.ready ? 'พร้อมแล้ว' : 'ยังต้องทำ', step.ready ? 'success' : 'warning')}</div>`,
      '</article>',
    ].join('');
  }

  function renderSetupStepV2(step, index) {
    return [
      `<article class="tdv4-setup-step tdv4-tone-${escapeHtml(step.ready ? 'success' : 'warning')}">`,
      `<div class="tdv4-setup-step-index">${escapeHtml(String(index + 1))}</div>`,
      '<div class="tdv4-setup-step-copy">',
      `<strong class="tdv4-setup-step-title">${escapeHtml(step.title)}</strong>`,
      `<p class="tdv4-kpi-detail">${escapeHtml(step.detail)}</p>`,
      `<a class="tdv4-setup-step-link" href="${escapeHtml(step.href || '#')}">${escapeHtml(step.ready ? 'เปิดดูอีกครั้ง' : 'ไปทำขั้นนี้')}</a>`,
      '</div>',
      `<div class="tdv4-setup-step-state">${renderBadge(step.ready ? 'พร้อมแล้ว' : 'ยังต้องทำ', step.ready ? 'success' : 'warning')}</div>`,
      '</article>',
    ].join('');
  }

  function renderTaskGroup(group) {
    return [
      `<section class="tdv4-panel tdv4-task-group tdv4-tone-${escapeHtml(group.tone || 'muted')}">`,
      `<div class="tdv4-task-tag">${escapeHtml(group.tag)}</div>`,
      `<h3 class="tdv4-section-title">${escapeHtml(group.title)}</h3>`,
      `<p class="tdv4-section-copy">${escapeHtml(group.detail)}</p>`,
      '<div class="tdv4-action-list">',
      ...(Array.isArray(group.actions) ? group.actions.map((action) => {
        return [
          '<div class="tdv4-action-entry">',
          action.primary ? '<span class="tdv4-action-recommend">แนะนำ</span>' : '',
          `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label)}</a>`,
          '</div>',
        ].join('');
      }) : []),
      '</div>',
      '</section>',
    ].join('');
  }

  function renderIssue(issue) {
    return [
      `<article class="tdv4-list-item tdv4-tone-${escapeHtml(issue.tone || 'muted')}">`,
      '<div class="tdv4-list-main">',
      `<strong>${escapeHtml(issue.title)}</strong>`,
      `<p>${escapeHtml(issue.detail)}</p>`,
      '</div>',
      `<div class="tdv4-list-meta">${escapeHtml(issue.meta)}</div>`,
      '</article>',
    ].join('');
  }

  function renderContextBlock(block) {
    return [
      `<article class="tdv4-panel tdv4-context-block tdv4-tone-${escapeHtml(block.tone || 'muted')}">`,
      `<div class="tdv4-context-label">${escapeHtml(block.label)}</div>`,
      `<div class="tdv4-context-value">${escapeHtml(block.value)}</div>`,
      `<div class="tdv4-context-detail">${escapeHtml(block.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function renderHighlight(item) {
    return [
      '<article class="tdv4-highlight">',
      `<div class="tdv4-highlight-title">${escapeHtml(item.title)}</div>`,
      `<div class="tdv4-highlight-value">${escapeHtml(item.value)}</div>`,
      `<div class="tdv4-highlight-detail">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function renderRailCard(card) {
    return [
      `<article class="tdv4-panel tdv4-rail-card tdv4-tone-${escapeHtml(card.tone || 'muted')}">`,
      `<div class="tdv4-rail-title">${escapeHtml(card.title)}</div>`,
      `<strong class="tdv4-rail-body">${escapeHtml(card.body)}</strong>`,
      `<div class="tdv4-rail-detail">${escapeHtml(card.meta)}</div>`,
      '</article>',
    ].join('');
  }

  function renderActivity(item) {
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

  function renderIssueList(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="tdv4-empty-state"><strong>ยังไม่มีเรื่องเร่งด่วนที่ต้องเปิดดูก่อน</strong><p>ตอนนี้ยังไม่พบปัญหาที่กระทบงานประจำวัน ลองเปิดคำสั่งซื้อหรือสถานะเซิร์ฟเวอร์ต่อได้เลย</p><a class="tdv4-button tdv4-button-secondary" href="#orders">ดูคำสั่งซื้อ</a></div>';
    }
    return items.map(renderIssue).join('');
  }

  function renderActivityList(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="tdv4-empty-state"><strong>ยังไม่มีกิจกรรมล่าสุดให้ติดตาม</strong><p>ถ้ายังไม่มีการเปลี่ยนแปลงใหม่ ให้ใช้เวลานี้ตรวจสถานะเซิร์ฟเวอร์หรือทบทวนการตั้งค่าแทน</p><a class="tdv4-button tdv4-button-secondary" href="#server-status">ดูสถานะเซิร์ฟเวอร์</a></div>';
    }
    return items.map(renderActivity).join('');
  }

  function renderDecisionPanel(panel) {
    if (!panel) return '';
    return [
      '<section class="tdv4-panel tdv4-priority-panel">',
      '<div class="tdv4-priority-grid">',
      '<div class="tdv4-stack">',
      '<span class="tdv4-section-kicker">ควรทำอะไรก่อน</span>',
      `<h2 class="tdv4-section-title">${escapeHtml(panel.title || '')}</h2>`,
      `<p class="tdv4-section-copy">${escapeHtml(panel.detail || '')}</p>`,
      panel.leadingIssue
        ? `<div class="tdv4-priority-note tdv4-tone-${escapeHtml(panel.leadingIssue.tone || 'warning')}"><strong>${escapeHtml(panel.leadingIssue.title || '')}</strong><p>${escapeHtml(panel.leadingIssue.detail || '')}</p></div>`
        : '',
      '<div class="tdv4-priority-checkpoints">',
      ...(Array.isArray(panel.checkpoints) ? panel.checkpoints.map((item) => [
        `<article class="tdv4-priority-item tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
        `<span class="tdv4-kpi-label">${escapeHtml(item.label || '')}</span>`,
        `<strong class="tdv4-kpi-value">${escapeHtml(item.value || '-')}</strong>`,
        `<p class="tdv4-kpi-detail">${escapeHtml(item.detail || '')}</p>`,
        '</article>',
      ].join('')) : []),
      '</div>',
      '</div>',
      '<div class="tdv4-stack tdv4-priority-actions">',
      '<span class="tdv4-action-recommend">แนะนำ</span>',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(panel.primaryAction && panel.primaryAction.href || '#')}">${escapeHtml(panel.primaryAction && panel.primaryAction.label || 'เปิดต่อ')}</a>`,
      '<div class="tdv4-priority-secondary">',
      ...(Array.isArray(panel.secondaryActions) ? panel.secondaryActions.map((action) => `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`) : []),
      '</div>',
      '</div>',
      '</div>',
      '</section>',
    ].join('');
  }

  function renderJobWatchPanel(panel) {
    if (!panel) return '';
    return [
      '<section class="tdv4-panel">',
      '<div class="tdv4-panel-head">',
      '<div class="tdv4-stack">',
      '<span class="tdv4-section-kicker">Job watch</span>',
      `<h2 class="tdv4-section-title">${escapeHtml(panel.title || '')}</h2>`,
      `<p class="tdv4-section-copy">${escapeHtml(panel.detail || '')}</p>`,
      '<div class="tdv4-chip-row">',
      ...(Array.isArray(panel.badges) ? panel.badges.map((chip) => renderBadge(chip.label, chip.tone)) : []),
      '</div>',
      '</div>',
      '<div class="tdv4-action-list">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(panel.primaryAction?.href || '#')}">${escapeHtml(panel.primaryAction?.label || 'Open workflow')}</a>`,
      ...(Array.isArray(panel.secondaryActions)
        ? panel.secondaryActions.map((action) => `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`)
        : []),
      '</div>',
      '</div>',
      '<div class="tdv4-list">',
      Array.isArray(panel.rows) && panel.rows.length > 0
        ? panel.rows.map(renderActivity).join('')
        : '<div class="tdv4-empty-state"><strong>No workflow signal yet</strong><p>Open Logs & Sync or Orders to inspect the next operator action.</p><a class="tdv4-button tdv4-button-secondary" href="#logs-sync">Open logs & sync</a></div>',
      '</div>',
      '</section>',
    ].join('');
  }

  function buildTenantDashboardV4Html(model) {
    const safeModel = model || createTenantDashboardV4Model({});
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
      '<a class="tdv4-button tdv4-button-secondary" href="#server-status">สถานะเซิร์ฟเวอร์</a>',
      '<a class="tdv4-button tdv4-button-secondary" href="#orders">คำสั่งซื้อ</a>',
      '</div>',
      '</header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">ดูว่างานไหนต้องทำก่อน แล้วค่อยไปหน้าที่เกี่ยวข้อง</div>',
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
      `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label)}</a>`,
      '</div>',
      '</section>',
      safeModel.notice
        ? `<section class="tdv4-panel tdv4-tone-${escapeHtml(safeModel.notice.tone || 'warning')}"><div class="tdv4-panel-head"><div class="tdv4-stack"><span class="tdv4-section-kicker">Access</span><h2 class="tdv4-section-title">${escapeHtml(safeModel.notice.title || '')}</h2><p class="tdv4-section-copy">${escapeHtml(safeModel.notice.detail || '')}</p></div></div></section>`
        : '',
      '<section class="tdv4-kpi-strip">',
      ...(Array.isArray(safeModel.kpis) ? safeModel.kpis.map(renderKpi) : []),
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ความพร้อมของระบบ</div>',
      '<h2 class="tdv4-section-title">ตอนนี้พร้อมแค่ไหน และต้องทำอะไรต่อ</h2>',
      `<p class="tdv4-section-copy">${escapeHtml(
        safeModel.readiness && safeModel.readiness.nextRequiredStep
          ? `ตอนนี้พร้อม ${safeModel.readiness.percent}% และควรทำ "${safeModel.readiness.nextRequiredStep.title}" เป็นขั้นถัดไป`
          : `ตอนนี้พร้อม ${safeModel.readiness && typeof safeModel.readiness.percent === 'number' ? safeModel.readiness.percent : 0}% และตั้งค่าหลักครบแล้วสำหรับ tenant นี้`
      )}</p>`,
      '<div class="tdv4-chip-row">',
      renderBadge(`ความพร้อม ${String(safeModel.readiness && safeModel.readiness.percent || 0)}%`, safeModel.setupReady ? 'success' : 'warning'),
      renderBadge(
        `ทำแล้ว ${String(safeModel.readiness && safeModel.readiness.completedSteps || 0)}/${String(safeModel.readiness && safeModel.readiness.totalSteps || 0)} ขั้น`,
        'info'
      ),
      '</div>',
      safeModel.readiness && safeModel.readiness.nextRequiredStep
        ? `<div class="tdv4-priority-note tdv4-tone-warning"><strong>${escapeHtml(safeModel.readiness.nextRequiredStep.title)}</strong><p>${escapeHtml(safeModel.readiness.nextRequiredStep.detail || '')}</p><a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(safeModel.readiness.nextRequiredStep.href || '#')}">ไปทำขั้นถัดไป</a></div>`
        : '<div class="tdv4-empty-state"><strong>ตั้งค่าหลักครบแล้ว</strong><p>Server Bot, Delivery Agent และค่าหลักของเซิร์ฟเวอร์พร้อมสำหรับงานประจำวันแล้ว</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ทางลัด</div>',
      '<h2 class="tdv4-section-title">งานหลักที่ควรเปิดบ่อย</h2>',
      '<p class="tdv4-section-copy">ใช้ทางลัดชุดนี้เพื่อเปิดหน้าที่ต้องเช็กบ่อยโดยไม่ต้องไล่หาในเมนู</p>',
      '<div class="tdv4-action-list">',
      ...(Array.isArray(safeModel.quickActions) ? safeModel.quickActions.map((action) => `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(action.href || '#')}" title="${escapeHtml(action.detail || '')}">${escapeHtml(action.label || '')}</a>`) : []),
      '</div>',
      '</section>',
      '</section>',
      renderDecisionPanel(safeModel.decisionPanel),
      renderJobWatchPanel(safeModel.jobWatch),
      safeModel.setupFlow && !safeModel.setupReady
        ? [
          '<section class="tdv4-panel tdv4-setup-flow-panel">',
          '<div class="tdv4-panel-head">',
          '<div class="tdv4-stack">',
          '<span class="tdv4-section-kicker">ตั้งค่าระบบ</span>',
          `<h2 class="tdv4-section-title">${escapeHtml(safeModel.setupFlow.title || '')}</h2>`,
          `<p class="tdv4-section-copy">${escapeHtml(safeModel.setupFlow.detail || '')}</p>`,
          `<div class="tdv4-chip-row">${renderBadge(`ทำแล้ว ${String(safeModel.setupFlow.completedSteps || 0)}/${String((safeModel.setupFlow.steps || []).length || 0)} ขั้น`, 'info')}</div>`,
          '</div>',
          '<div class="tdv4-action-list tdv4-setup-flow-actions">',
          `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safeModel.setupFlow.primaryAction.href || '#')}">${escapeHtml(safeModel.setupFlow.primaryAction.label || '')}</a>`,
          ...((Array.isArray(safeModel.setupFlow.secondaryActions) ? safeModel.setupFlow.secondaryActions : []).map((action) => `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`)),
          '</div>',
          '</div>',
          '<div class="tdv4-setup-flow-grid">',
          ...((Array.isArray(safeModel.setupFlow.steps) ? safeModel.setupFlow.steps : []).map(renderSetupStepV2)),
          '</div>',
          '</section>',
        ].join('')
        : '',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ตัวเลือกอื่น</div>',
      '<h2 class="tdv4-section-title">งานที่ไปต่อได้</h2>',
      '<p class="tdv4-section-copy">เลือกงานที่กำลังทำได้จากบล็อกนี้</p>',
      '<div class="tdv4-task-grid">',
      ...(Array.isArray(safeModel.taskGroups) ? safeModel.taskGroups.map(renderTaskGroup) : []),
      '</div>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<div class="tdv4-stack">',
      '<section id="dashboard-issues" class="tdv4-panel">',
      '<div class="tdv4-section-kicker">กล่องเหตุที่ต้องจัดการก่อน</div>',
      '<h2 class="tdv4-section-title">ปัญหาที่กระทบงานประจำวัน</h2>',
      '<p class="tdv4-section-copy">เริ่มจากตรงนี้เมื่อมีเรื่องเร่งด่วน</p>',
      '<div class="tdv4-list">',
      renderIssueList(safeModel.issues),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">มุมมองผลกระทบ</div>',
      '<h2 class="tdv4-section-title">ตัวเลขที่ต้องเห็นก่อนเปิดงานต่อ</h2>',
      '<p class="tdv4-section-copy">ใช้ยืนยันว่าร้านค้า การส่งของ และฐานผู้เล่นยังพร้อมใช้งาน</p>',
      '<div class="tdv4-highlight-grid">',
      ...(Array.isArray(safeModel.highlights) ? safeModel.highlights.map(renderHighlight) : []),
      '</div>',
      '</section>',
      '</div>',
      '<div class="tdv4-stack">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">กิจกรรมล่าสุด</div>',
      '<h2 class="tdv4-section-title">ลำดับเหตุการณ์ที่เกี่ยวข้องกับ tenant นี้</h2>',
      '<p class="tdv4-section-copy">ดูการเปลี่ยนแปลงล่าสุดของ tenant นี้ได้จากจุดนี้</p>',
      '<div class="tdv4-list">',
      renderActivityList(safeModel.activity),
      '</div>',
      '</section>',
      `<details class="tdv4-panel tdv4-details-panel"${safeModel.setupReady ? '' : ' open'}>`,
      '<summary class="tdv4-details-summary">บริบทเพิ่มเติมของ tenant</summary>',
      '<div class="tdv4-stack">',
      '<p class="tdv4-section-copy">ใช้ดูโควตา สิทธิ์ใช้งาน และบริบทเพิ่มเติมเมื่อจำเป็น</p>',
      '<div class="tdv4-context-grid">',
      ...(Array.isArray(safeModel.contextBlocks) ? safeModel.contextBlocks.map(renderContextBlock) : []),
      '</div>',
      '</div>',
      '</details>',
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">บริบทสั้น ๆ ที่ช่วยตัดสินใจได้เร็ว โดยไม่แย่งพื้นที่จากหน้าทำงานหลัก</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantDashboardV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantDashboardV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.kpis)
      ? source
      : createTenantDashboardV4Model(source);
    rootElement.innerHTML = buildTenantDashboardV4Html(model);
    return model;
  }

  return {
    buildTenantDashboardV4Html,
    createTenantDashboardV4Model,
    renderTenantDashboardV4,
  };
});
