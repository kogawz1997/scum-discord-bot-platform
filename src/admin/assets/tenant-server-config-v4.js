(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantServerConfigV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    {
      label: 'ภาพรวมงานหลัก',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
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
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config', current: true },
        { label: 'Server Bot', href: '#server-bots' },
        { label: 'Delivery Agent', href: '#delivery-agents' },
        { label: 'บันทึกและหลักฐาน', href: '#audit' },
      ],
    },
  ];

  const CONFIG_PATCH_BASIC_FIELDS = [
    {
      key: 'serverName',
      label: 'ชื่อเซิร์ฟเวอร์',
      description: 'ชื่อที่ใช้แสดงในพื้นที่ผู้เล่นหรือข้อความแนะนำหลักของเซิร์ฟเวอร์',
      type: 'text',
      defaultValue: '',
      placeholder: 'SCUM TH Frontier',
    },
    {
      key: 'maxPlayers',
      label: 'จำนวนผู้เล่นสูงสุด',
      description: 'ใช้บอกความจุเป้าหมายของเซิร์ฟเวอร์เพื่อให้ทีมงานและผู้เล่นเห็นตัวเลขเดียวกัน',
      type: 'number',
      defaultValue: 90,
      min: 1,
      max: 200,
    },
    {
      key: 'restartGraceMinutes',
      label: 'เวลารอก่อนรีสตาร์ต (นาที)',
      description: 'ช่วงเวลาที่ใช้เตือนก่อนรีสตาร์ตตามแผนหรือก่อนปิดระบบเพื่อบำรุงรักษา',
      type: 'number',
      defaultValue: 5,
      min: 0,
      max: 120,
    },
    {
      key: 'autoRestartEnabled',
      label: 'เปิดรีสตาร์ตอัตโนมัติ',
      description: 'ให้ระบบใช้แผนรีสตาร์ตอัตโนมัติเมื่อมี flow รองรับแทนการรอคนกดทุกครั้ง',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'maintenanceMode',
      label: 'เปิดโหมดบำรุงรักษา',
      description: 'ใช้ตอนต้องกันงานใหม่ชั่วคราว เช่น ก่อน patch ระบบหรือก่อนตรวจปัญหาที่กระทบผู้เล่น',
      type: 'boolean',
      defaultValue: false,
    },
    {
      key: 'supportContact',
      label: 'ข้อความติดต่อทีมงาน',
      description: 'ข้อความสั้นสำหรับบอกผู้เล่นหรือทีมงานว่าควรติดต่อผ่านช่องทางใดเมื่อเกิดปัญหา',
      type: 'text',
      defaultValue: '',
      placeholder: 'เปิด ticket ใน Discord เพื่อให้ทีมงานตรวจต่อ',
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

  function formatDateTime(value) {
    if (!value) return 'ยังไม่มีข้อมูล';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'ยังไม่มีข้อมูล';
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function stringifyPretty(value) {
    if (!value || typeof value !== 'object') return '{}';
    return JSON.stringify(value, null, 2);
  }

  function firstNonEmpty(values, fallback = '') {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function summarizeConfigDiff(currentValue, draftValue, label) {
    if (draftValue == null) return null;
    const current = currentValue && typeof currentValue === 'object' ? currentValue : {};
    const draft = draftValue && typeof draftValue === 'object' ? draftValue : {};
    const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(draft)]));
    const changedKeys = keys.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(draft[key]));
    return {
      label,
      changedKeys,
      changedCount: changedKeys.length,
      draftKeys: Object.keys(draft).length,
    };
  }

  function humanizeConfigKey(key) {
    const raw = String(key ?? '').trim();
    if (!raw) return '-';
    const spaced = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function formatConfigValueLabel(value) {
    if (value === true) return 'เปิด';
    if (value === false) return 'ปิด';
    if (value == null) return 'ไม่มีค่า';
    if (Array.isArray(value)) {
      if (!value.length) return 'ไม่มีรายการ';
      if (value.length <= 3) return value.map((item) => String(item)).join(', ');
      return `${formatNumber(value.length)} รายการ`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (!keys.length) return 'ไม่มีค่า';
      if (keys.length <= 3) {
        return keys.map((key) => `${key}: ${String(value[key])}`).join(', ');
      }
      return `${formatNumber(keys.length)} ค่า`;
    }
    const normalized = String(value).trim();
    return normalized || 'ไม่มีค่า';
  }

  function getConfigValueTone(value) {
    if (value === true) return 'success';
    if (value === false) return 'danger';
    if (typeof value === 'number') return 'info';
    return 'muted';
  }

  function buildReadableItems(source, limit = 8) {
    const record = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return Object.entries(record).slice(0, limit).map(([key, value]) => ({
      key,
      label: humanizeConfigKey(key),
      valueLabel: formatConfigValueLabel(value),
      valueTone: getConfigValueTone(value),
    }));
  }

  function buildEditorHelp(key, itemCount, changedCount) {
    if (key === 'featureFlags') {
      return {
        headline: itemCount > 0
          ? `กำลังบังคับฟีเจอร์ ${formatNumber(itemCount)} ค่า`
          : 'ยังไม่ได้บังคับเปิดหรือปิดฟีเจอร์เพิ่ม',
        copy: itemCount > 0
          ? 'ค่าชุดนี้จะ override สิทธิ์หรือโมดูลของ tenant รายนี้เหนือค่าแพ็กเกจในบางจุด'
          : 'ตอนนี้ระบบจะอิงสิทธิ์จากแพ็กเกจและ feature gate กลางเป็นหลัก',
        emptyTitle: 'ยังไม่มีการ override feature flags',
        emptyCopy: 'ถ้ายังไม่จำเป็นต้องเปิดหรือปิดฟีเจอร์เฉพาะ tenant นี้ ให้ปล่อยค่าว่างไว้ได้',
        changedLabel: changedCount > 0
          ? `มี ${formatNumber(changedCount)} จุดที่ต่างจากค่าปัจจุบัน`
          : 'ตอนนี้ draft ยังตรงกับค่าที่ใช้งานอยู่',
      };
    }
    if (key === 'configPatch') {
      return {
        headline: itemCount > 0
          ? `มีค่า override ฝั่งระบบ ${formatNumber(itemCount)} ค่า`
          : 'ยังไม่มีค่า override ฝั่งระบบ',
        copy: itemCount > 0
          ? 'ใช้กับค่าการทำงานของ tenant ฝั่ง control plane, runtime และ integration'
          : 'ตอนนี้ tenant นี้จะอิงค่ากลางของระบบสำหรับฝั่ง runtime และ service posture',
        emptyTitle: 'ยังไม่มีการ override config หลัก',
        emptyCopy: 'ถ้ายังไม่ได้ต้องการเปลี่ยนค่าพิเศษของ tenant นี้ สามารถปล่อยส่วนนี้ว่างไว้ได้',
        changedLabel: changedCount > 0
          ? `มี ${formatNumber(changedCount)} จุดที่ต่างจากค่าปัจจุบัน`
          : 'ตอนนี้ draft ยังตรงกับค่าที่ใช้งานอยู่',
      };
    }
    return {
      headline: itemCount > 0
        ? `มีค่า override ฝั่งหน้าเว็บ ${formatNumber(itemCount)} ค่า`
        : 'ยังไม่มีค่า override ฝั่งหน้าเว็บ',
      copy: itemCount > 0
        ? 'ค่าชุดนี้จะกระทบ player portal, public pages หรือ environment patch ฝั่งเว็บ'
        : 'ตอนนี้ portal จะอิงค่ามาตรฐานของระบบโดยยังไม่ต้องมี patch เพิ่ม',
      emptyTitle: 'ยังไม่มีการ override portal env',
      emptyCopy: 'ใช้ส่วนนี้เมื่อจำเป็นต้องปรับพฤติกรรมของ player/public portal สำหรับ tenant นี้เท่านั้น',
      changedLabel: changedCount > 0
        ? `มี ${formatNumber(changedCount)} จุดที่ต่างจากค่าปัจจุบัน`
        : 'ตอนนี้ draft ยังตรงกับค่าที่ใช้งานอยู่',
    };
  }

  function buildFeatureFlagOptions(state, draftFeatureFlags) {
    const featureAccess = state?.overview?.tenantFeatureAccess || {};
    const catalog = Array.isArray(featureAccess.features) ? featureAccess.features : [];
    const packageFeatureSet = new Set(
      Array.isArray(featureAccess?.package?.features)
        ? featureAccess.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const enabledFeatureSet = new Set(
      Array.isArray(featureAccess?.enabledFeatureKeys)
        ? featureAccess.enabledFeatureKeys.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const overrides = draftFeatureFlags && typeof draftFeatureFlags === 'object' && !Array.isArray(draftFeatureFlags)
      ? draftFeatureFlags
      : {};
    return catalog.map((entry) => {
      const key = String(entry?.key || '').trim();
      const overrideValue = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : null;
      const packageEnabled = packageFeatureSet.has(key);
      const effectiveEnabled = enabledFeatureSet.has(key);
      const overrideLabel = overrideValue === true
        ? 'บังคับเปิด'
        : overrideValue === false
          ? 'บังคับปิด'
          : 'ตามแพ็กเกจ';
      return {
        key,
        title: firstNonEmpty([entry?.title, humanizeConfigKey(key), key], key),
        category: String(entry?.category || 'general').trim() || 'general',
        packageEnabled,
        effectiveEnabled,
        overrideValue,
        overrideLabel,
      };
    }).filter((entry) => entry.key);
  }

  function buildConfigPatchBasicFields(draftConfigPatch) {
    const source = draftConfigPatch && typeof draftConfigPatch === 'object' && !Array.isArray(draftConfigPatch)
      ? draftConfigPatch
      : {};
    return CONFIG_PATCH_BASIC_FIELDS.map((field) => {
      const hasOwnValue = Object.prototype.hasOwnProperty.call(source, field.key);
      const rawValue = hasOwnValue ? source[field.key] : field.defaultValue;
      const normalizedValue = field.type === 'boolean'
        ? Boolean(rawValue)
        : field.type === 'number'
          ? (Number.isFinite(Number(rawValue)) ? Number(rawValue) : Number(field.defaultValue || 0))
          : String(rawValue ?? '').trim();
      return {
        ...field,
        value: normalizedValue,
      };
    });
  }

  function buildSectionGroups(liveConfig) {
    const featureFlags = liveConfig?.featureFlags || {};
    const configPatch = liveConfig?.configPatch || {};
    const portalEnvPatch = liveConfig?.portalEnvPatch || {};
    return [
      {
        key: 'server-basics',
        label: 'ค่าหลักของเซิร์ฟเวอร์',
        detail: 'รวมค่าที่เกี่ยวกับ posture ของ tenant, runtime และการตั้งค่าพื้นฐานที่มีผลกับงานประจำวัน',
        keys: Object.keys(configPatch).slice(0, 6),
        source: 'configPatch',
        tone: 'info',
      },
      {
        key: 'delivery-integrations',
        label: 'การส่งของและการเชื่อมต่อ',
        detail: 'รวม feature flags และค่าที่มีผลกับ delivery, integration, webhook และความสามารถที่ผู้เล่นได้รับ',
        keys: Object.keys(featureFlags).slice(0, 8),
        source: 'featureFlags',
        tone: 'warning',
      },
      {
        key: 'player-facing',
        label: 'ค่าที่ผู้เล่นรับผลโดยตรง',
        detail: 'ใช้ดูค่าที่กระทบ player portal, public pages และพฤติกรรมฝั่งหน้าเว็บของ tenant นี้',
        keys: Object.keys(portalEnvPatch).slice(0, 8),
        source: 'portalEnvPatch',
        tone: 'success',
      },
      {
        key: 'advanced',
        label: 'แก้แบบขั้นสูง',
        detail: 'ยังคงรองรับ raw patch เดิมไว้ แต่หน้านี้จะสรุปให้อ่านก่อน เพื่อไม่ต้องไล่ดู JSON ทันที',
        keys: ['featureFlags', 'configPatch', 'portalEnvPatch'],
        source: 'advanced',
        tone: 'danger',
      },
    ];
  }

  function createTenantServerConfigV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const liveConfig = state.liveConfig || state.tenantConfig || {};
    const draft = state.draft || {
      featureFlags: liveConfig.featureFlags || {},
      configPatch: liveConfig.configPatch || {},
      portalEnvPatch: liveConfig.portalEnvPatch || {},
    };
    const tenantName = firstNonEmpty([
      liveConfig.name,
      state?.me?.tenantId,
      'Tenant Workspace',
    ]);

    const previewSections = [
      summarizeConfigDiff(liveConfig.featureFlags, draft.featureFlags, 'Feature Flags'),
      summarizeConfigDiff(liveConfig.configPatch, draft.configPatch, 'Config Patch'),
      summarizeConfigDiff(liveConfig.portalEnvPatch, draft.portalEnvPatch, 'Portal Env Patch'),
    ].filter(Boolean);
    const previewSectionMap = Object.fromEntries(previewSections.map((section) => [section.label, section]));
    const hasChanges = previewSections.some((section) => section.changedCount > 0);
    const restartRequired = previewSections.some((section) => section.changedKeys.some((key) => /restart|rcon|server|runtime|sync/i.test(key)));
    const liveUpdatedAt = firstNonEmpty([liveConfig.updatedAt, state.updatedAt]);

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงผู้เช่า',
        workspaceLabel: tenantName,
        environmentLabel: 'พื้นที่ผู้เช่า',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : NAV_GROUPS,
      },
      header: {
        title: 'ตั้งค่าเซิร์ฟเวอร์',
        subtitle: 'ดูสรุปก่อนว่าแต่ละชุดคุมอะไรอยู่ แล้วค่อยเปิดโหมดแก้ขั้นสูงเมื่อจำเป็นจริง',
        statusChips: [
          { label: hasChanges ? 'มี draft ที่ยังไม่บันทึก' : 'ยังไม่มีการเปลี่ยนแปลง', tone: hasChanges ? 'warning' : 'success' },
          { label: restartRequired ? 'มีค่าที่อาจต้องรีสตาร์ต' : 'ยังไม่พบค่าที่บังคับรีสตาร์ต', tone: restartRequired ? 'danger' : 'muted' },
          { label: `อัปเดตล่าสุด ${formatDateTime(liveUpdatedAt)}`, tone: 'muted' },
        ],
        actions: [
          { label: 'บันทึก', tone: 'primary', action: 'save' },
          { label: 'บันทึกและใช้ทันที', tone: 'secondary', action: 'apply' },
          { label: 'บันทึกแล้วไปหน้ารีสตาร์ต', tone: 'secondary', action: 'restart' },
        ],
      },
      sections: buildSectionGroups(liveConfig),
      summaryCards: previewSections.map((section) => ({
        label: section.label,
        value: section.changedCount > 0 ? `${formatNumber(section.changedCount)} การเปลี่ยนแปลง` : 'ยังไม่ต่างจากค่าปัจจุบัน',
        detail: section.changedKeys.length > 0
          ? section.changedKeys.slice(0, 6).join(', ')
          : `${formatNumber(section.draftKeys)} key ใน draft`,
        tone: section.changedCount > 0 ? 'warning' : 'success',
      })),
      editors: [
        {
          key: 'featureFlags',
          label: 'Feature Flags',
          detail: 'กำหนดว่าจะบังคับเปิดหรือปิดโมดูลใดให้ tenant รายนี้ โดยยังอิง feature gate กลางของระบบ',
          value: stringifyPretty(draft.featureFlags),
          featureOptions: buildFeatureFlagOptions(state, draft.featureFlags),
          items: buildReadableItems(draft.featureFlags),
          changedKeys: previewSectionMap['Feature Flags']?.changedKeys || [],
          ...buildEditorHelp(
            'featureFlags',
            Object.keys(draft.featureFlags || {}).length,
            previewSectionMap['Feature Flags']?.changedCount || 0,
          ),
          tone: 'warning',
        },
        {
          key: 'configPatch',
          label: 'Config Patch',
          detail: 'ใช้สำหรับ override ค่าระบบของ tenant ฝั่ง control plane, runtime และ integration',
          value: stringifyPretty(draft.configPatch),
          basicFields: buildConfigPatchBasicFields(draft.configPatch),
          items: buildReadableItems(draft.configPatch),
          changedKeys: previewSectionMap['Config Patch']?.changedKeys || [],
          ...buildEditorHelp(
            'configPatch',
            Object.keys(draft.configPatch || {}).length,
            previewSectionMap['Config Patch']?.changedCount || 0,
          ),
          tone: 'info',
        },
        {
          key: 'portalEnvPatch',
          label: 'Portal Env Patch',
          detail: 'ใช้ override ค่าที่กระทบ player/public portal และ environment patch ฝั่งหน้าเว็บของ tenant นี้',
          value: stringifyPretty(draft.portalEnvPatch),
          items: buildReadableItems(draft.portalEnvPatch),
          changedKeys: previewSectionMap['Portal Env Patch']?.changedKeys || [],
          ...buildEditorHelp(
            'portalEnvPatch',
            Object.keys(draft.portalEnvPatch || {}).length,
            previewSectionMap['Portal Env Patch']?.changedCount || 0,
          ),
          tone: 'success',
        },
      ],
      rightRail: [
        {
          title: 'ก่อนกดบันทึก',
          body: 'ยืนยันก่อนว่าค่านี้กระทบเฉพาะ tenant นี้จริง',
          meta: 'ถ้าค่าที่แก้มีผลกับ runtime, restart หรือ webhook ควรเช็ก Server Bot, Delivery Agent และสถานะเซิร์ฟเวอร์ก่อน',
          tone: 'info',
        },
        {
          title: 'Backup และ rollback',
          body: 'ควรมีสำเนาก่อนเปลี่ยนค่าทุกครั้ง',
          meta: 'ใช้ history ของ backup และ restore flow เป็นจุดอ้างอิงก่อน replay หรือ rollback',
          tone: 'success',
        },
        {
          title: 'โหมดแก้ขั้นสูง',
          body: 'JSON editor ยังอยู่ แต่ไม่ใช่มุมมองหลักอีกแล้ว',
          meta: 'อ่านสรุปด้านบนก่อนเสมอ แล้วค่อยเปิดโหมดแก้ขั้นสูงเมื่อจำเป็นต้องใส่ patch เองโดยตรง',
          tone: 'warning',
        },
      ],
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

  function renderSummaryCard(card) {
    return [
      `<article class="tdv4-kpi tdv4-tone-${escapeHtml(card.tone || 'muted')}">`,
      `<div class="tdv4-kpi-label">${escapeHtml(card.label)}</div>`,
      `<div class="tdv4-kpi-value">${escapeHtml(card.value)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(card.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function renderEditorReadableItem(item) {
    return [
      '<div class="tdv4-readable-row">',
      '<div class="tdv4-readable-key">',
      `<div class="tdv4-readable-key-title">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-readable-key-code">${escapeHtml(item.key)}</div>`,
      '</div>',
      `<div class="tdv4-readable-value">${renderBadge(item.valueLabel, item.valueTone)}</div>`,
      '</div>',
    ].join('');
  }

  function renderFeatureFlagControl(item) {
    const stateBadgeTone = item.overrideValue === true
      ? 'success'
      : item.overrideValue === false
        ? 'danger'
        : 'muted';
    return [
      '<label class="tdv4-flag-control">',
      '<span class="tdv4-flag-copy">',
      `<span class="tdv4-flag-title">${escapeHtml(item.title)}</span>`,
      `<span class="tdv4-flag-key">${escapeHtml(item.key)}</span>`,
      '<span class="tdv4-flag-meta">',
      renderBadge(item.category, 'muted'),
      renderBadge(item.packageEnabled ? 'แพ็กเกจเปิด' : 'แพ็กเกจปิด', item.packageEnabled ? 'success' : 'muted'),
      renderBadge(item.overrideLabel, stateBadgeTone),
      '</span>',
      '</span>',
      `<input class="tdv4-flag-toggle" type="checkbox" data-feature-flag-toggle data-feature-flag-key="${escapeHtml(item.key)}" data-package-default="${item.packageEnabled ? 'true' : 'false'}"${item.effectiveEnabled ? ' checked' : ''}>`,
      '</label>',
    ].join('');
  }

  function renderConfigPatchField(field) {
    const defaultValue = field.type === 'boolean'
      ? (field.defaultValue ? 'true' : 'false')
      : String(field.defaultValue ?? '');
    if (field.type === 'boolean') {
      return [
        '<label class="tdv4-basic-field tdv4-basic-field-boolean">',
        '<span class="tdv4-basic-field-copy">',
        `<span class="tdv4-basic-field-label">${escapeHtml(field.label)}</span>`,
        `<span class="tdv4-basic-field-detail">${escapeHtml(field.description)}</span>`,
        '</span>',
        '<span class="tdv4-basic-toggle-row">',
        `<input class="tdv4-flag-toggle" type="checkbox" data-config-patch-field="${escapeHtml(field.key)}" data-field-type="boolean" data-default-value="${escapeHtml(defaultValue)}"${field.value ? ' checked' : ''}>`,
        `<span class="tdv4-basic-toggle-hint">${field.value ? 'เปิด' : 'ปิด'}</span>`,
        '</span>',
        '</label>',
      ].join('');
    }
    return [
      '<label class="tdv4-basic-field">',
      `<span class="tdv4-basic-field-label">${escapeHtml(field.label)}</span>`,
      `<span class="tdv4-basic-field-detail">${escapeHtml(field.description)}</span>`,
      `<input class="tdv4-basic-input" type="${escapeHtml(field.type)}" data-config-patch-field="${escapeHtml(field.key)}" data-field-type="${escapeHtml(field.type)}" data-default-value="${escapeHtml(defaultValue)}"${Number.isFinite(Number(field.min)) ? ` min="${escapeHtml(field.min)}"` : ''}${Number.isFinite(Number(field.max)) ? ` max="${escapeHtml(field.max)}"` : ''} value="${escapeHtml(field.value)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}>`,
      '</label>',
    ].join('');
  }

  function renderSectionItem(section, current) {
    const currentClass = current ? ' tdv4-nav-link-current' : '';
    return `<a class="tdv4-nav-link${currentClass}" href="#${escapeHtml(section.key)}">${escapeHtml(section.label)}</a>`;
  }

  function renderEditor(editor) {
    const changedKeys = Array.isArray(editor.changedKeys) ? editor.changedKeys : [];
    const items = Array.isArray(editor.items) ? editor.items : [];
    const featureOptions = Array.isArray(editor.featureOptions) ? editor.featureOptions : [];
    const basicFields = Array.isArray(editor.basicFields) ? editor.basicFields : [];
    return [
      `<section class="tdv4-panel tdv4-tone-${escapeHtml(editor.tone || 'muted')}">`,
      `<div class="tdv4-section-kicker">${escapeHtml(editor.label)}</div>`,
      `<h2 class="tdv4-section-title">${escapeHtml(editor.label)}</h2>`,
      `<p class="tdv4-section-copy">${escapeHtml(editor.detail)}</p>`,
      featureOptions.length > 0
        ? [
          '<div class="tdv4-config-control-block">',
          '<div class="tdv4-readable-summary-title">ฟีเจอร์ที่ปรับได้ทันที</div>',
          '<p class="tdv4-readable-summary-copy">เปิดหรือปิดเฉพาะ tenant นี้ได้จากรายการด้านล่าง ระบบจะคำนวณ patch ให้เองและเขียนกลับไปที่ JSON ขั้นสูงด้านล่างอัตโนมัติ</p>',
          '<div class="tdv4-flag-grid">',
          ...featureOptions.map(renderFeatureFlagControl),
          '</div>',
          '</div>',
        ].join('')
        : '',
      basicFields.length > 0
        ? [
          '<div class="tdv4-config-control-block">',
          '<div class="tdv4-readable-summary-title">ค่าพื้นฐานที่แก้ได้จากฟอร์ม</div>',
          '<p class="tdv4-readable-summary-copy">ใช้ส่วนนี้ก่อนเมื่อคุณต้องการตั้งค่าที่ทีมงานใช้บ่อย ระบบจะ sync ค่ากลับไปที่ JSON ขั้นสูงด้านล่างให้อัตโนมัติ</p>',
          '<div class="tdv4-basic-field-grid">',
          ...basicFields.map(renderConfigPatchField),
          '</div>',
          '</div>',
        ].join('')
        : '',
      '<div class="tdv4-readable-summary">',
      `<div class="tdv4-readable-summary-title">${escapeHtml(editor.headline)}</div>`,
      `<p class="tdv4-readable-summary-copy">${escapeHtml(editor.copy)}</p>`,
      `<div class="tdv4-readable-summary-status">${escapeHtml(editor.changedLabel)}</div>`,
      items.length > 0
        ? [
          '<div class="tdv4-readable-list">',
          ...items.map(renderEditorReadableItem),
          '</div>',
        ].join('')
        : [
          '<div class="tdv4-readable-empty">',
          `<strong>${escapeHtml(editor.emptyTitle)}</strong>`,
          `<p>${escapeHtml(editor.emptyCopy)}</p>`,
          '</div>',
        ].join(''),
      changedKeys.length > 0
        ? `<div class="tdv4-config-key-row">${changedKeys.slice(0, 8).map((key) => renderBadge(key, 'warning')).join('')}</div>`
        : '',
      '</div>',
      '<details class="tdv4-advanced-editor">',
      '<summary class="tdv4-advanced-editor-summary">แก้แบบ JSON ขั้นสูง</summary>',
      `<label class="tdv4-editor-label" for="tdv4-editor-${escapeHtml(editor.key)}">ใช้เมื่อจำเป็นต้องใส่ patch เองโดยตรง</label>`,
      `<textarea class="tdv4-editor" id="tdv4-editor-${escapeHtml(editor.key)}" name="${escapeHtml(editor.key)}">${escapeHtml(editor.value)}</textarea>`,
      '</details>',
      '</section>',
    ].join('');
  }

  function renderRailCard(item) {
    return [
      `<article class="tdv4-panel tdv4-rail-card tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-rail-title">${escapeHtml(item.title)}</div>`,
      `<strong class="tdv4-rail-body">${escapeHtml(item.body)}</strong>`,
      `<div class="tdv4-rail-detail">${escapeHtml(item.meta)}</div>`,
      '</article>',
    ].join('');
  }

  function buildTenantServerConfigV4Html(model) {
    const safeModel = model || createTenantServerConfigV4Model({});
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
      renderBadge('Config', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-config-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">พื้นที่นี้ใช้สำหรับดูความหมายของค่าก่อนบันทึกจริง แยกค่าสำคัญออกจากโหมดแก้ JSON ขั้นสูงให้ชัด</div>',
      ...(Array.isArray(safeModel.shell.navGroups) ? safeModel.shell.navGroups.map(renderNavGroup) : []),
      '<section class="tdv4-nav-group">',
      '<div class="tdv4-nav-group-label">หมวดการตั้งค่า</div>',
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(safeModel.sections) ? safeModel.sections.map((section, index) => renderSectionItem(section, index === 0)) : []),
      '</div>',
      '</section>',
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
      '<div class="tdv4-pagehead-actions tdv4-pagehead-actions-stack">',
      ...(Array.isArray(safeModel.header.actions) ? safeModel.header.actions.map((action, index) => {
        const className = index === 0 ? 'tdv4-button tdv4-button-primary' : 'tdv4-button tdv4-button-secondary';
        return `<button class="${className}" type="button" data-config-action="${escapeHtml(action.action || '')}">${escapeHtml(action.label)}</button>`;
      }) : []),
      '</div>',
      '</section>',
      '<section class="tdv4-kpi-strip tdv4-config-summary-grid">',
      ...(Array.isArray(safeModel.summaryCards) ? safeModel.summaryCards.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">อ่านตามหมวดก่อน แล้วค่อยแก้จริง</div>',
      '<h2 class="tdv4-section-title">ระบบจัดหมวดให้แล้ว</h2>',
      '<p class="tdv4-section-copy">หน้านี้เปลี่ยนจากการโยน JSON ดิบให้ดูทันที มาเป็นการบอกก่อนว่าแต่ละกล่องมีผลกับอะไร เพื่อให้เลือกแก้ได้ถูกจุด</p>',
      '<div class="tdv4-config-section-grid">',
      ...(Array.isArray(safeModel.sections) ? safeModel.sections.map((section) => [
        `<article class="tdv4-panel tdv4-tone-${escapeHtml(section.tone || 'muted')}">`,
        `<div class="tdv4-section-kicker">${escapeHtml(section.source)}</div>`,
        `<h3 class="tdv4-section-title">${escapeHtml(section.label)}</h3>`,
        `<p class="tdv4-section-copy">${escapeHtml(section.detail)}</p>`,
        `<div class="tdv4-config-key-row">${(section.keys.length ? section.keys : ['ยังไม่มี key ตัวอย่าง']).map((key) => renderBadge(key, 'muted')).join('')}</div>`,
        '</article>',
      ].join('')) : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel tdv4-config-mode-panel tdv4-tone-success">',
      '<div class="tdv4-section-kicker">Basic mode</div>',
      '<h2 class="tdv4-section-title">เริ่มจากค่าที่แก้ได้ง่ายก่อน</h2>',
      '<p class="tdv4-section-copy">โหมดนี้เหมาะกับงานประจำวัน เช่น เปิดหรือปิดฟีเจอร์ให้ tenant โดยไม่ต้องอ่าน JSON</p>',
      ...((Array.isArray(safeModel.editors) ? safeModel.editors : []).filter((editor) => editor.key === 'featureFlags').map(renderEditor)),
      '</section>',
      '<details class="tdv4-panel tdv4-config-advanced-panel">',
      '<summary class="tdv4-advanced-editor-summary">Advanced mode</summary>',
      '<div class="tdv4-stack">',
      '<div class="tdv4-section-kicker">Advanced mode</div>',
      '<h2 class="tdv4-section-title">แก้แบบ JSON ขั้นสูงเมื่อจำเป็นจริง</h2>',
      '<p class="tdv4-section-copy">ใช้เมื่อคุณต้อง override ค่าเฉพาะทางของ control plane หรือหน้า portal ที่ยังไม่มีฟอร์มแบบง่ายรองรับ</p>',
      ...((Array.isArray(safeModel.editors) ? safeModel.editors : []).filter((editor) => editor.key !== 'featureFlags').map(renderEditor)),
      '</div>',
      '</details>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">บริบทที่ควรเห็นตลอดระหว่างแก้ค่า เพื่อไม่ให้ไปแตะค่าที่เสี่ยงผิดจังหวะ</div>',
      ...(Array.isArray(safeModel.rightRail) ? safeModel.rightRail.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantServerConfigV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantServerConfigV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.sections)
      ? source
      : createTenantServerConfigV4Model(source);
    rootElement.innerHTML = buildTenantServerConfigV4Html(model);
    return model;
  }

  return {
    buildTenantServerConfigV4Html,
    createTenantServerConfigV4Model,
    renderTenantServerConfigV4,
  };
});
