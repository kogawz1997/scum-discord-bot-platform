(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantServerConfigV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const FALLBACK_NAV_GROUPS = [
    {
      label: 'ภาพรวม',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
        { label: 'สถานะเซิร์ฟเวอร์', href: '#server-status' },
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config', current: true },
      ],
    },
    {
      label: 'งานประจำวัน',
      items: [
        { label: 'คำสั่งซื้อ', href: '#orders' },
        { label: 'ผู้เล่น', href: '#players' },
      ],
    },
    {
      label: 'เครื่องมือ',
      items: [
        { label: 'Delivery Agent', href: '#delivery-agents' },
        { label: 'Server Bot', href: '#server-bots' },
        { label: 'รีสตาร์ต', href: '#restart-control' },
      ],
    },
  ];

  const CONFIG_PATCH_BASIC_GROUPS = [
    {
      key: 'operations',
      title: 'การทำงานประจำวัน',
      description: 'ค่าที่กระทบคิวงาน การแจ้งเตือน และการดูแลเซิร์ฟเวอร์',
      fields: [
        {
          key: 'serverLabel',
          label: 'ชื่อที่ใช้ในระบบ',
          description: 'ชื่อที่ทีมงานเห็นในแผงควบคุมและงานซัพพอร์ต',
          type: 'text',
          defaultValue: '',
        },
        {
          key: 'deliveryQueueBatchSize',
          label: 'จำนวนงานต่อรอบ',
          description: 'จำนวนงานส่งของที่ให้ระบบหยิบไปทำในหนึ่งรอบ',
          type: 'number',
          defaultValue: 10,
          min: 1,
          max: 100,
        },
        {
          key: 'restartGraceMinutes',
          label: 'เวลารอก่อนรีสตาร์ต',
          description: 'กำหนดเวลานับถอยหลังก่อนรีสตาร์ตเซิร์ฟเวอร์',
          type: 'number',
          defaultValue: 10,
          min: 0,
          max: 120,
        },
      ],
    },
    {
      key: 'support',
      title: 'การดูแลผู้เล่น',
      description: 'ตั้งค่าที่เกี่ยวกับข้อความและการติดต่อทีมงาน',
      fields: [
        {
          key: 'maintenanceModeEnabled',
          label: 'โหมดบำรุงรักษา',
          description: 'เปิดเมื่ออยากลดงานใหม่ระหว่างกำลังแก้ปัญหา',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'killfeedRelayEnabled',
          label: 'ส่ง killfeed ไปยัง Discord',
          description: 'ใช้เมื่อต้องการให้กิจกรรมในเกมไปแสดงในชุมชน',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'supportContactLabel',
          label: 'ข้อความติดต่อทีมงาน',
          description: 'ข้อความสั้นที่ใช้บอกผู้เล่นว่าควรติดต่อทีมงานทางไหน',
          type: 'text',
          defaultValue: '',
        },
        {
          key: 'discordLogLanguage',
          label: 'ภาษาของข้อความบันทึก',
          description: 'ภาษาที่ใช้กับข้อความแจ้งเตือนและบันทึกใน Discord',
          type: 'select',
          defaultValue: 'th-TH',
          options: [
            { value: 'th-TH', label: 'ไทย' },
            { value: 'en-US', label: 'English' },
          ],
        },
      ],
    },
  ];

  const PORTAL_ENV_BASIC_GROUPS = [
    {
      key: 'portal-look',
      title: 'หน้าตาพอร์ทัลผู้เล่น',
      description: 'ค่าที่มีผลกับบรรยากาศและการนำเสนอของหน้าเว็บผู้เล่น',
      fields: [
        {
          key: 'publicTheme',
          label: 'ธีมพอร์ทัล',
          description: 'เลือกธีมหลักของพอร์ทัลผู้เล่น',
          type: 'select',
          defaultValue: 'scum-dark',
          options: [
            { value: 'scum-dark', label: 'SCUM Dark' },
            { value: 'midnight-ops', label: 'Midnight Ops' },
            { value: 'field-station', label: 'Field Station' },
          ],
        },
      ],
    },
    {
      key: 'portal-home',
      title: 'ข้อมูลบนหน้าแรก',
      description: 'กำหนดว่าผู้เล่นจะเห็นข้อมูลชุมชนและสถานะอะไรบ้าง',
      fields: [
        {
          key: 'communityFeedEnabled',
          label: 'แสดงฟีดชุมชน',
          description: 'ใช้แสดงกิจกรรมล่าสุด กิจกรรมชุมชน หรือข่าวสำคัญ',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'walletBadgeEnabled',
          label: 'แสดงสถานะกระเป๋าเงิน',
          description: 'ให้ผู้เล่นเห็นยอดและสถานะกระเป๋าเงินได้ทันที',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ];

  function trimText(value, maxLen = 400) {
    const text = String(value ?? '').trim();
    return !text ? '' : text.slice(0, maxLen);
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
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const text = trimText(value, 300);
      if (text) return text;
    }
    return fallback;
  }

  function stringifyPretty(value) {
    try {
      return JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2);
    } catch {
      return '{}';
    }
  }

  function formatNumber(value, fallback = '-') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : fallback;
  }

  function formatDateTime(value, fallback = 'ยังไม่พบข้อมูล') {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? fallback
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function humanizeIdentifier(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function boolLabel(value) {
    return value ? 'เปิด' : 'ปิด';
  }

  function statusTone(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['ready', 'online', 'healthy', 'active', 'succeeded'].includes(normalized)) return 'success';
    if (['processing', 'queued', 'stale', 'degraded', 'missing'].includes(normalized)) return 'warning';
    if (['failed', 'error', 'offline'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function statusLabel(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'ready') return 'พร้อมใช้งาน';
    if (normalized === 'missing') return 'ยังไม่โหลดค่าจริง';
    if (normalized === 'processing') return 'กำลังประมวลผล';
    if (normalized === 'failed' || normalized === 'error') return 'เกิดข้อผิดพลาด';
    if (normalized === 'offline') return 'ออฟไลน์';
    return normalized ? humanizeIdentifier(normalized) : 'ไม่ทราบสถานะ';
  }

  function normalizeCapabilities(value) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[,\n]+/g)
        : [];
    return raw.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
  }

  function isServerBotEntry(row) {
    const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
    const role = trimText(meta.agentRole || meta.role || row.role, 80).toLowerCase();
    const scope = trimText(meta.agentScope || meta.scope || row.scope, 80).toLowerCase();
    if (['sync', 'hybrid'].includes(role) || ['sync_only', 'sync-only', 'synconly', 'sync_execute', 'sync-execute'].includes(scope)) {
      return true;
    }
    const text = [
      row?.runtimeKey,
      row?.channel,
      row?.name,
      row?.status,
      row?.role,
      row?.scope,
      meta.agentRole,
      meta.agentScope,
      ...normalizeCapabilities(meta.capabilities || meta.features),
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
    return ['sync', 'watcher', 'watch', 'log', 'config', 'restart', 'read', 'monitor'].some((token) => text.includes(token));
  }

  function buildConfigEmptyState(kind, title, detail, actionLabel, actionHref) {
    return {
      kind: trimText(kind, 80) || 'general',
      title: firstNonEmpty([title], ''),
      detail: firstNonEmpty([detail], ''),
      actionLabel: firstNonEmpty([actionLabel], 'ตรวจ Server Bot'),
      actionHref: firstNonEmpty([actionHref], '#server-bots'),
    };
  }

  function coerceBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    const text = String(value ?? '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(text)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(text)) return false;
    return fallback;
  }

  function coerceNumber(value, fallback = null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function normalizeOptions(options) {
    if (!Array.isArray(options)) return [];
    return options
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          const value = firstNonEmpty([entry.value, entry.key], '');
          return {
            value,
            label: firstNonEmpty([entry.label, entry.title, value], value),
          };
        }
        const text = trimText(entry, 120);
        return text ? { value: text, label: text } : null;
      })
      .filter(Boolean);
  }

  function normalizeSettingValue(setting, rawValue, fallbackValue) {
    const type = String(setting?.type || 'string').trim().toLowerCase();
    if (type === 'boolean') {
      return coerceBoolean(rawValue, coerceBoolean(fallbackValue, false));
    }
    if (type === 'number') {
      const fallbackNumber = coerceNumber(fallbackValue, null);
      return coerceNumber(rawValue, fallbackNumber);
    }
    return rawValue == null ? String(fallbackValue ?? '') : String(rawValue);
  }

  function formatSettingValue(setting, value) {
    const type = String(setting?.type || 'string').trim().toLowerCase();
    if (type === 'boolean') return boolLabel(coerceBoolean(value, false));
    if (type === 'number') return formatNumber(value, '-');
    const options = normalizeOptions(setting?.options);
    const match = options.find((entry) => String(entry.value) === String(value));
    if (match) return match.label;
    const text = trimText(value, 120);
    return text || 'ยังไม่ได้ตั้ง';
  }

  function serializeSettingAttrValue(setting, value) {
    const type = String(setting?.type || 'string').trim().toLowerCase();
    if (type === 'boolean') return coerceBoolean(value, false) ? 'true' : 'false';
    if (type === 'number') {
      const numeric = coerceNumber(value, null);
      return numeric == null ? '' : String(numeric);
    }
    return value == null ? '' : String(value);
  }

  function shouldUseTextarea(setting) {
    const type = String(setting?.type || 'string').trim().toLowerCase();
    if (type !== 'string') return false;
    const key = String(setting?.key || '').trim().toLowerCase();
    return key.includes('message') || key.includes('description') || key.includes('motd');
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function isDiscoveredLiveSetting(setting) {
    const description = trimText(setting?.description, 240).toLowerCase();
    return description.startsWith('discovered from the live ');
  }

  function buildSettingSearchText(setting) {
    return normalizeSearchText([
      setting?.label,
      setting?.description,
      setting?.section,
      setting?.key,
      setting?.file,
      setting?.sourceFileLabel,
    ].filter(Boolean).join(' '));
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return `<section class="tdv4-nav-group"><div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div><div class="tdv4-nav-items">${(Array.isArray(group.items) ? group.items : []).map((item) => `<a class="tdv4-nav-link${item.current ? ' tdv4-nav-link-current' : ''}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`).join('')}</div></section>`;
  }

  function buildFeatureOptions(source) {
    const access = source?.overview?.tenantFeatureAccess || {};
    const packageFeatures = new Set(
      Array.isArray(access?.package?.features)
        ? access.package.features.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    );
    const patch = source?.tenantConfig?.featureFlags && typeof source.tenantConfig.featureFlags === 'object'
      ? source.tenantConfig.featureFlags
      : {};
    const featureRows = Array.isArray(access?.features) ? access.features : [];
    return featureRows.map((feature) => {
      const key = firstNonEmpty([feature.key, feature.id], '');
      const packageEnabled = packageFeatures.has(key);
      const overrideDefined = Object.prototype.hasOwnProperty.call(patch, key);
      const enabled = overrideDefined ? Boolean(patch[key]) : packageEnabled;
      return {
        key,
        label: firstNonEmpty([feature.title, feature.label, humanizeIdentifier(key)], humanizeIdentifier(key)),
        description: firstNonEmpty([feature.description, 'เปิดหรือปิดโมดูลที่ผู้เช่ารายนี้ใช้งานได้ทันที'], ''),
        enabled,
        packageEnabled,
        badge: overrideDefined ? 'กำหนดเอง' : 'ตามแพ็กเกจ',
        tone: overrideDefined ? 'warning' : packageEnabled ? 'success' : 'muted',
      };
    }).filter((entry) => entry.key);
  }

  function buildBasicFieldValue(definition, sourceValue) {
    const type = String(definition.type || 'text').trim().toLowerCase();
    if (type === 'boolean') return coerceBoolean(sourceValue, Boolean(definition.defaultValue));
    if (type === 'number') {
      const fallback = Number.isFinite(Number(definition.defaultValue)) ? Number(definition.defaultValue) : 0;
      const value = coerceNumber(sourceValue, fallback);
      return value == null ? fallback : value;
    }
    return sourceValue == null || sourceValue === '' ? String(definition.defaultValue ?? '') : String(sourceValue);
  }

  function buildBasicField(definition, sourceValue, sourceKind) {
    const value = buildBasicFieldValue(definition, sourceValue);
    return {
      ...definition,
      sourceKind,
      value,
      currentLabel: definition.type === 'boolean'
        ? boolLabel(Boolean(value))
        : definition.type === 'number'
          ? formatNumber(value, String(definition.defaultValue ?? '-'))
          : String(value || 'ใช้ค่ามาตรฐาน'),
      defaultLabel: definition.type === 'boolean'
        ? boolLabel(Boolean(definition.defaultValue))
        : definition.type === 'number'
          ? formatNumber(definition.defaultValue, '-')
          : String(definition.defaultValue ?? 'ใช้ค่ามาตรฐาน'),
      isOverridden: sourceValue != null && String(sourceValue) !== '',
    };
  }

  function buildOverrideEditor(title, description, editorId, value, actionPrefix) {
    return {
      title,
      description,
      editorId,
      value: stringifyPretty(value),
      actionPrefix,
    };
  }

  function buildWorkspaceCategories(source) {
    const workspace = source?.serverConfigWorkspace && typeof source.serverConfigWorkspace === 'object'
      ? source.serverConfigWorkspace
      : {};
    const categories = Array.isArray(workspace.categories) ? workspace.categories : [];
    return categories
      .map((category) => {
        const groups = (Array.isArray(category.groups) ? category.groups : [])
          .map((group) => {
            const settings = (Array.isArray(group.settings) ? group.settings : [])
              .map((setting) => {
                const defaultValue = Object.prototype.hasOwnProperty.call(setting, 'defaultValue')
                  ? setting.defaultValue
                  : null;
                const currentValue = normalizeSettingValue(setting, setting.currentValue, defaultValue);
                const normalized = {
                  ...setting,
                  inputType: String(setting.type || 'string').trim().toLowerCase(),
                  currentValue,
                  currentValueAttr: serializeSettingAttrValue(setting, currentValue),
                  defaultValueAttr: serializeSettingAttrValue(setting, defaultValue),
                  currentLabel: formatSettingValue(setting, currentValue),
                  defaultLabel: formatSettingValue(setting, defaultValue),
                  options: normalizeOptions(setting.options),
                  sourceFileLabel: firstNonEmpty([setting.sourceFileLabel, setting.file], setting.file || ''),
                  rawKey: [trimText(setting.section, 120), trimText(setting.key, 120)].filter(Boolean).join(' / '),
                };
                return {
                  ...normalized,
                  isBasic: !isDiscoveredLiveSetting(normalized),
                  searchText: buildSettingSearchText(normalized),
                };
              })
              .filter((setting) => setting.file && setting.key);
            return {
              key: firstNonEmpty([group.key], 'general'),
              label: firstNonEmpty([group.label, humanizeIdentifier(group.key)], humanizeIdentifier(group.key)),
              settings,
              settingCount: settings.length,
              basicSettingCount: settings.filter((setting) => setting.isBasic !== false).length,
            };
          })
          .filter((group) => group.settings.length > 0);
        return {
          key: firstNonEmpty([category.key], 'general'),
          label: firstNonEmpty([category.label, humanizeIdentifier(category.key)], humanizeIdentifier(category.key)),
          description: firstNonEmpty([category.description], ''),
          groups,
          settingCount: groups.reduce((sum, group) => sum + group.settings.length, 0),
          basicSettingCount: groups.reduce((sum, group) => sum + group.basicSettingCount, 0),
        };
      })
      .filter((category) => category.groups.length > 0);
  }

  function normalizeLineListEntries(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
      .map((entry) => trimText(entry, 240))
      .filter((entry) => {
        if (!entry) return false;
        if (seen.has(entry)) return false;
        seen.add(entry);
        return true;
      });
  }

  function formatLineListSummary(entries) {
    const count = Array.isArray(entries) ? entries.length : 0;
    return count ? `${formatNumber(count, '0')} รายการ` : 'ยังไม่มีรายการ';
  }

  function buildAccessListSettings(files) {
    const rows = Array.isArray(files) ? files : [];
    return rows
      .filter((file) => file?.file === 'AdminUsers.ini' || file?.file === 'BannedUsers.ini')
      .map((file) => {
        const entries = normalizeLineListEntries(file?.rawEntries);
        const isAdminList = file?.file === 'AdminUsers.ini';
        return {
          id: isAdminList ? 'security.adminUsers' : 'security.bannedUsers',
          file: String(file.file || '').trim(),
          section: '',
          key: 'entries',
          label: isAdminList ? 'รายชื่อผู้ดูแล' : 'รายชื่อผู้ถูกแบน',
          description: isAdminList
            ? 'เพิ่ม Steam ID หรือชื่อบัญชีที่ต้องการให้มีสิทธิ์ผู้ดูแล'
            : 'เพิ่ม Steam ID หรือชื่อบัญชีที่ต้องการบล็อกจากเซิร์ฟเวอร์',
          inputType: 'line-list',
          currentValue: entries,
          currentValueAttr: JSON.stringify(entries),
          defaultValueAttr: '[]',
          currentLabel: formatLineListSummary(entries),
          defaultLabel: 'ยังไม่มีรายการ',
          options: [],
          sourceFileLabel: firstNonEmpty([file.label, file.file], file.file || ''),
          rawKey: 'รายการ',
          requiresRestart: false,
          isBasic: true,
          searchText: normalizeSearchText([
            isAdminList ? 'admin users' : 'banned users',
            file?.label,
            file?.file,
          ].filter(Boolean).join(' ')),
          hasCurrentValue: entries.length > 0,
          entryPlaceholder: isAdminList ? 'เช่น 76561198000000000' : 'เช่น 76561198000000000',
          emptyLabel: isAdminList ? 'ยังไม่มีผู้ดูแลเพิ่มเติม' : 'ยังไม่มีรายชื่อผู้ถูกแบน',
        };
      });
  }

  function appendAccessListsToCategories(categories, files) {
    const accessListSettings = buildAccessListSettings(files);
    if (!accessListSettings.length) return categories;

    const nextCategories = Array.isArray(categories)
      ? categories.map((category) => ({
          ...category,
          groups: Array.isArray(category.groups) ? category.groups.map((group) => ({ ...group })) : [],
        }))
      : [];
    const securityIndex = nextCategories.findIndex((category) => category.key === 'security');
    const accessListGroup = {
      key: 'access-lists',
      label: 'ผู้ดูแลและการแบน',
      settings: accessListSettings,
      settingCount: accessListSettings.length,
      basicSettingCount: accessListSettings.length,
    };

    if (securityIndex >= 0) {
      nextCategories[securityIndex].groups = [
        ...nextCategories[securityIndex].groups,
        accessListGroup,
      ];
      nextCategories[securityIndex].settingCount = nextCategories[securityIndex].groups.reduce(
        (sum, group) => sum + (Array.isArray(group.settings) ? group.settings.length : 0),
        0,
      );
      nextCategories[securityIndex].basicSettingCount = nextCategories[securityIndex].groups.reduce(
        (sum, group) => sum + Number(group.basicSettingCount || 0),
        0,
      );
      return nextCategories;
    }

    return [
      ...nextCategories,
      {
        key: 'security',
        label: 'ความปลอดภัยและผู้ดูแล',
        description: 'จัดการรายชื่อผู้ดูแลและผู้ถูกแบนโดยไม่ต้องเปิดไฟล์เอง',
        groups: [accessListGroup],
        settingCount: accessListSettings.length,
        basicSettingCount: accessListSettings.length,
      },
    ];
  }

  function buildAdvancedWorkspaceCategory(workspace, files) {
    const snapshotFiles = Array.isArray(workspace?.advanced?.rawSnapshot?.files)
      ? workspace.advanced.rawSnapshot.files
      : [];
    const fileRows = (Array.isArray(files) ? files : []).map((file) => ({
      file: firstNonEmpty([file.file], ''),
      label: firstNonEmpty([file.label, file.file], file.file || 'Config file'),
      exists: file?.exists !== false,
      lastModifiedAt: firstNonEmpty([file.lastModifiedAt], ''),
      readError: firstNonEmpty([file.readError], ''),
      parseMode: firstNonEmpty([file.parseMode], 'ini'),
    })).filter((file) => file.file);
    if (!fileRows.length && !snapshotFiles.length) {
      return null;
    }
    return {
      key: 'advanced',
      label: 'Advanced',
      description: 'Technical sources, raw snapshot data, and file-level verification details from Server Bot.',
      groups: [],
      settingCount: fileRows.length,
      mode: 'advanced',
      advancedSummary: {
        snapshotStatus: firstNonEmpty([workspace?.snapshotStatus], 'missing'),
        snapshotCollectedAt: firstNonEmpty([workspace?.snapshotCollectedAt], ''),
        snapshotUpdatedBy: firstNonEmpty([workspace?.snapshotUpdatedBy], ''),
        snapshotUpdatedAt: firstNonEmpty([workspace?.snapshotUpdatedAt], ''),
        lastError: firstNonEmpty([workspace?.lastError], ''),
        files: fileRows,
        rawSnapshot: workspace?.advanced?.rawSnapshot || { files: [] },
      },
    };
  }

  function appendAdvancedWorkspaceCategory(categories, workspace, files) {
    const nextCategories = Array.isArray(categories)
      ? categories.map((category) => ({ ...category }))
      : [];
    const advancedCategory = buildAdvancedWorkspaceCategory(workspace, files);
    if (!advancedCategory) {
      return nextCategories.filter((category) => category.key !== 'advanced');
    }
    const existingIndex = nextCategories.findIndex((category) => category.key === 'advanced');
    if (existingIndex >= 0) {
      nextCategories[existingIndex] = advancedCategory;
      return nextCategories;
    }
    return [...nextCategories, advancedCategory];
  }

  function createTenantServerConfigV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const workspace = state.serverConfigWorkspace && typeof state.serverConfigWorkspace === 'object'
      ? state.serverConfigWorkspace
      : {};
    const activeServerId = trimText(state?.activeServer?.id || state?.servers?.[0]?.id, 160);
    const hasServers = Array.isArray(state.servers) && state.servers.length > 0;
    const files = Array.isArray(workspace.files) ? workspace.files : [];
    const serverBotRows = (Array.isArray(state.agents) ? state.agents : []).filter(isServerBotEntry);
    const serverBotProvisioning = (Array.isArray(state.agentProvisioning) ? state.agentProvisioning : []).filter(isServerBotEntry);
    const selectedServerBots = serverBotRows.filter((row) => {
      const rowServerId = firstNonEmpty([row?.meta?.serverId, row?.serverId, row?.tenantServerId], '');
      return !activeServerId || !rowServerId || rowServerId === activeServerId;
    });
    const selectedServerProvisioning = serverBotProvisioning.filter((row) => {
      const rowServerId = firstNonEmpty([row?.serverId, row?.meta?.serverId, row?.tenantServerId], '');
      return !activeServerId || !rowServerId || rowServerId === activeServerId;
    });
    const categories = appendAdvancedWorkspaceCategory(
      appendAccessListsToCategories(buildWorkspaceCategories(state), files),
      workspace,
      files,
    );
    const backups = Array.isArray(workspace.backups) ? workspace.backups : [];
    const snapshotStatus = firstNonEmpty([workspace.snapshotStatus], 'missing');
    const editableCategories = categories.filter((category) => category.key !== 'advanced');
    const workspaceReady = snapshotStatus === 'ready' && editableCategories.length > 0;
    const totalSettingCount = editableCategories.reduce((sum, category) => sum + Number(category.settingCount || 0), 0);
    const basicSettingCount = editableCategories.reduce((sum, category) => sum + Number(category.basicSettingCount || 0), 0);
    const featureOptions = buildFeatureOptions(state);
    const configPatch = state?.tenantConfig?.configPatch && typeof state.tenantConfig.configPatch === 'object'
      ? state.tenantConfig.configPatch
      : {};
    const portalEnvPatch = state?.tenantConfig?.portalEnvPatch && typeof state.tenantConfig.portalEnvPatch === 'object'
      ? state.tenantConfig.portalEnvPatch
      : {};
    const firstField = editableCategories[0]?.groups?.[0]?.settings?.[0] || null;
    const emptyState = !hasServers
      ? buildConfigEmptyState(
          'missing-server',
          'ยังไม่มีเซิร์ฟเวอร์',
          'สร้างหรือเลือกเซิร์ฟเวอร์ก่อน จึงจะโหลดค่าจริงและไฟล์ตั้งค่าของเซิร์ฟเวอร์นี้ได้',
          'ไปหน้าเซิร์ฟเวอร์',
          '#server-status',
        )
      : selectedServerBots.length === 0 && selectedServerProvisioning.length === 0
        ? buildConfigEmptyState(
            'missing-server-bot',
            'ยังไม่มี Server Bot',
            'สร้าง Server Bot สำหรับเซิร์ฟเวอร์นี้ก่อน เพื่อให้ระบบอ่านไฟล์ตั้งค่าและส่งค่าจริงกลับมา',
            'ไปหน้า Server Bot',
            '#server-bots',
          )
        : selectedServerBots.length === 0 && selectedServerProvisioning.length > 0
          ? buildConfigEmptyState(
              'pending-server-bot',
              'กำลังรอติดตั้ง Server Bot',
              'ตอนนี้มีโทเค็นสำหรับเซิร์ฟเวอร์นี้แล้ว ให้นำคำสั่งติดตั้งไปใช้บนเครื่องเซิร์ฟเวอร์ แล้วรีเฟรชหน้านี้อีกครั้ง',
              'ไปหน้า Server Bot',
              '#server-bots',
            )
          : snapshotStatus === 'failed' || snapshotStatus === 'error'
            ? buildConfigEmptyState(
                'snapshot-error',
                'อ่านไฟล์ตั้งค่าไม่สำเร็จ',
                firstNonEmpty([workspace.lastError], 'ให้ตรวจสิทธิ์เข้าถึงโฟลเดอร์ config ของ Server Bot แล้วลองใหม่อีกครั้ง'),
                'ตรวจ Server Bot',
                '#server-bots',
              )
            : snapshotStatus === 'processing'
              ? buildConfigEmptyState(
                  'snapshot-processing',
                  'กำลังโหลดค่าจริงจาก Server Bot',
                  'ระบบกำลังรอ snapshot ล่าสุดจากเครื่องเซิร์ฟเวอร์ ให้รอสักครู่แล้วรีเฟรชหน้านี้อีกครั้ง',
                  'ไปหน้า Server Bot',
                  '#server-bots',
                )
              : buildConfigEmptyState(
                  'missing-snapshot',
                  'ยังไม่โหลดค่าจริงจาก Server Bot',
                  selectedServerBots.length
                    ? 'Server Bot เชื่อมต่อแล้ว แต่ยังไม่ส่ง snapshot กลับมา ให้ตรวจสิทธิ์เข้าถึงไฟล์ตั้งค่าแล้วลองรีเฟรชอีกครั้ง'
                    : 'ให้ตรวจว่า Server Bot ออนไลน์ เข้าถึงไฟล์ config ได้ และส่ง snapshot กลับเข้าระบบแล้ว',
                  'ตรวจ Server Bot',
                  '#server-bots',
                );

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงผู้เช่า',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'Tenant Workspace',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : FALLBACK_NAV_GROUPS,
      },
      header: {
        title: 'ตั้งค่าเซิร์ฟเวอร์',
        subtitle: 'จัดการค่าหลักของเซิร์ฟเวอร์ SCUM จากหน้าเว็บ โดยไม่ต้องเปิดไฟล์ตั้งค่าเอง',
        serverName: firstNonEmpty([
          state?.activeServer?.name,
          state?.activeServer?.slug,
          state?.activeServer?.id,
          'ยังไม่เลือกเซิร์ฟเวอร์',
        ]),
      },
      status: {
        label: statusLabel(snapshotStatus),
        tone: statusTone(snapshotStatus),
        detail: workspaceReady
          ? `ดึงค่าจริงจาก Server Bot ล่าสุดเมื่อ ${formatDateTime(workspace.snapshotCollectedAt, 'ไม่ทราบเวลา')}`
          : snapshotStatus === 'missing'
            ? 'ยังไม่พบ snapshot จาก Server Bot ให้ตรวจการเชื่อมต่อแล้วลองรีเฟรชอีกครั้ง'
            : firstNonEmpty([workspace.lastError], 'ยังไม่พร้อมโหลดค่าจริงจากไฟล์เซิร์ฟเวอร์'),
        updatedAt: workspace.snapshotCollectedAt || workspace.snapshotUpdatedAt || null,
        updatedBy: firstNonEmpty([workspace.snapshotUpdatedBy, state?.tenantConfig?.updatedBy], ''),
      },
      workspace: {
        available: workspaceReady,
        categories,
        editableCategories,
        activeCategoryKey: editableCategories.find((category) => Number(category.basicSettingCount || 0) > 0)?.key || categories[0]?.key || '',
        lastError: firstNonEmpty([workspace.lastError], ''),
        files,
        backups,
        rawSnapshot: workspace?.advanced?.rawSnapshot || { files: [] },
        totalSettingCount,
        basicSettingCount,
      },
      help: firstField
        ? {
            title: firstField.label,
            description: firstField.description || 'เลือกค่าเพื่อดูรายละเอียดเพิ่มเติม',
            meta: `ไฟล์ ${firstField.sourceFileLabel} · ${firstField.rawKey} · ${firstField.requiresRestart ? 'ต้องรีสตาร์ต' : 'ใช้ได้ทันที'}`,
            badges: [
              { label: `ค่าปัจจุบัน: ${firstField.currentLabel}`, tone: 'info' },
              { label: `ค่าเริ่มต้น: ${firstField.defaultLabel}`, tone: 'muted' },
              firstField.requiresRestart ? { label: 'ต้องรีสตาร์ต', tone: 'warning' } : null,
            ].filter(Boolean),
          }
        : {
            title: 'เลือกหมวดที่ต้องการ',
            description: 'เมื่อเลือกค่า ระบบจะสรุปคำอธิบาย ค่าเริ่มต้น และเงื่อนไขการใช้งานไว้ให้ด้านนี้',
            meta: 'ยังไม่มีค่าที่พร้อมแก้ไข',
            badges: [],
          },
      featureFlags: {
        items: featureOptions,
        editor: buildOverrideEditor(
          'แก้แบบ JSON ขั้นสูง',
          'ใช้เมื่ออยากระบุ override เพิ่มเติมที่ไม่ได้อยู่ในสวิตช์ด้านบน',
          'tdv4-editor-featureFlags',
          state?.tenantConfig?.featureFlags,
          'feature-flags',
        ),
      },
      configPatch: {
        groups: CONFIG_PATCH_BASIC_GROUPS.map((group) => ({
          ...group,
          fields: group.fields.map((field) => buildBasicField(field, configPatch[field.key], 'config')),
        })),
        editor: buildOverrideEditor(
          'แก้แบบ JSON ขั้นสูง',
          'ใช้สำหรับคีย์ระบบที่ยังไม่มีฟอร์มเฉพาะ แต่ยังต้องการเก็บเป็น tenant patch',
          'tdv4-editor-configPatch',
          configPatch,
          'config-patch',
        ),
      },
      portalEnvPatch: {
        groups: PORTAL_ENV_BASIC_GROUPS.map((group) => ({
          ...group,
          fields: group.fields.map((field) => buildBasicField(field, portalEnvPatch[field.key], 'portal')),
        })),
        editor: buildOverrideEditor(
          'แก้แบบ JSON ขั้นสูง',
          'ใช้สำหรับคีย์พอร์ทัลผู้เล่นที่ยังไม่ได้ทำเป็นช่องกรอกเฉพาะ',
          'tdv4-editor-portalEnvPatch',
          portalEnvPatch,
          'portal-env',
        ),
      },
      emptyState,
    };
  }

  function renderFieldControl(setting) {
    const attrs = [
      'data-server-config-field',
      `data-setting-file="${escapeHtml(setting.file)}"`,
      `data-setting-section="${escapeHtml(setting.section || '')}"`,
      `data-setting-key="${escapeHtml(setting.key)}"`,
      `data-setting-type="${escapeHtml(setting.inputType)}"`,
      `data-current-value="${escapeHtml(setting.currentValueAttr)}"`,
      `data-default-value="${escapeHtml(setting.defaultValueAttr)}"`,
      `data-setting-label="${escapeHtml(setting.label)}"`,
      `data-setting-description="${escapeHtml(setting.description || '')}"`,
      `data-setting-file-label="${escapeHtml(setting.sourceFileLabel || setting.file)}"`,
      `data-setting-raw-key="${escapeHtml(setting.rawKey || setting.key)}"`,
      `data-setting-current-label="${escapeHtml(setting.currentLabel)}"`,
      `data-setting-default-label="${escapeHtml(setting.defaultLabel)}"`,
      `data-setting-requires-restart="${setting.requiresRestart ? 'true' : 'false'}"`,
    ].join(' ');

    if (setting.inputType === 'line-list') {
      const entries = normalizeLineListEntries(setting.currentValue);
      const rows = (entries.length ? entries : ['']).map((entry) => [
        '<div class="tdv4-line-list-row">',
        `<input class="tdv4-basic-input tdv4-line-list-input" type="text" value="${escapeHtml(entry)}" placeholder="${escapeHtml(setting.entryPlaceholder || '')}" data-line-list-entry>`,
        '<button class="tdv4-button tdv4-button-secondary tdv4-line-list-remove" type="button" data-line-list-remove>ลบ</button>',
        '</div>',
      ].join('')).join('');
      return [
        '<div class="tdv4-line-list-editor" data-line-list-editor>',
        `<input class="tdv4-line-list-source" type="hidden" value="${escapeHtml(setting.currentValueAttr)}" ${attrs}>`,
        `<div class="tdv4-line-list-summary"><span class="tdv4-line-list-count" data-line-list-count>${escapeHtml(formatLineListSummary(entries))}</span><span class="tdv4-config-setting-rawkey">${escapeHtml(entries.length ? 'แก้ไขได้ทันทีจากหน้าเว็บ' : setting.emptyLabel || 'ยังไม่มีรายการ')}</span></div>`,
        `<div class="tdv4-line-list-list" data-line-list-list>${rows}</div>`,
        '<div class="tdv4-line-list-actions">',
        '<button class="tdv4-button tdv4-button-secondary tdv4-line-list-add" type="button" data-line-list-add>เพิ่มรายการ</button>',
        '</div>',
        '</div>',
      ].join('');
    }

    if (setting.inputType === 'boolean') {
      return [
        '<div class="tdv4-basic-toggle-row">',
        '<label class="tdv4-switch">',
        `<input class="tdv4-flag-toggle" type="checkbox" ${attrs}${setting.currentValue ? ' checked' : ''}>`,
        '<span class="tdv4-switch-track"><span class="tdv4-switch-thumb"></span></span>',
        '</label>',
        `<div class="tdv4-basic-toggle-hint">${escapeHtml(boolLabel(setting.currentValue))}</div>`,
        '</div>',
      ].join('');
    }

    if (setting.options.length) {
      return [
        `<select class="tdv4-basic-input" ${attrs}>`,
        setting.options.map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(setting.currentValue) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join(''),
        '</select>',
      ].join('');
    }

    if (shouldUseTextarea(setting)) {
      return `<textarea class="tdv4-basic-input" rows="4" ${attrs}>${escapeHtml(setting.currentValue)}</textarea>`;
    }

    if (setting.inputType === 'number') {
      const minAttr = setting.min != null ? ` min="${escapeHtml(setting.min)}"` : '';
      const maxAttr = setting.max != null ? ` max="${escapeHtml(setting.max)}"` : '';
      const stepAttr = String(setting.currentValue).includes('.') || String(setting.defaultValue).includes('.') ? ' step="0.1"' : ' step="1"';
      return `<input class="tdv4-basic-input" type="number" value="${escapeHtml(setting.currentValueAttr)}" ${attrs}${minAttr}${maxAttr}${stepAttr}>`;
    }

    return `<input class="tdv4-basic-input" type="text" value="${escapeHtml(setting.currentValueAttr)}" ${attrs}>`;
  }

  function renderSetting(setting) {
    const badges = [
      renderBadge(`ค่าปัจจุบัน ${setting.currentLabel}`, 'info'),
      renderBadge(`ค่าเริ่มต้น ${setting.defaultLabel}`, 'muted'),
      setting.requiresRestart ? renderBadge('ต้องรีสตาร์ต', 'warning') : '',
      setting.hasCurrentValue === false ? renderBadge('ยังใช้ค่าเริ่มต้น', 'muted') : '',
    ].filter(Boolean).join('');

    return [
      `<article class="tdv4-config-setting" data-setting-card="${escapeHtml(setting.id)}" data-input-type="${escapeHtml(setting.inputType)}" data-setting-key="${escapeHtml(setting.key)}" data-setting-basic="${setting.isBasic === false ? 'false' : 'true'}" data-setting-requires-restart="${setting.requiresRestart ? 'true' : 'false'}" data-setting-search="${escapeHtml(setting.searchText || '')}">`,
      '<div class="tdv4-config-setting-main">',
      '<div class="tdv4-config-setting-copy">',
      '<div class="tdv4-config-setting-title-row">',
      `<strong class="tdv4-config-setting-title">${escapeHtml(setting.label)}</strong>`,
      setting.requiresRestart ? renderBadge('รีสตาร์ต', 'warning') : '',
      '</div>',
      `<p class="tdv4-config-setting-description">${escapeHtml(setting.description || 'ยังไม่มีคำอธิบายเพิ่มเติม')}</p>`,
      `<div class="tdv4-config-setting-meta">${badges}</div>`,
      `<div class="tdv4-config-setting-rawkey">${escapeHtml(setting.sourceFileLabel)} · ${escapeHtml(setting.rawKey)}</div>`,
      '</div>',
      `<div class="tdv4-config-setting-control">${renderFieldControl(setting)}</div>`,
      '</div>',
      '</article>',
    ].join('');
  }

  function renderBasicField(field) {
    const metaBadges = [
      field.isOverridden ? renderBadge('กำหนดเอง', 'warning') : renderBadge('ใช้ค่ามาตรฐาน', 'muted'),
      renderBadge(`ค่าปัจจุบัน ${field.currentLabel}`, 'info'),
    ].join('');

    if (field.type === 'boolean') {
      return [
        '<label class="tdv4-basic-field tdv4-basic-field-boolean">',
        '<div class="tdv4-basic-field-copy">',
        `<div class="tdv4-basic-field-label">${escapeHtml(field.label)}</div>`,
        `<div class="tdv4-basic-field-detail">${escapeHtml(field.description)}</div>`,
        `<div class="tdv4-basic-field-meta-row">${metaBadges}</div>`,
        '</div>',
        '<div class="tdv4-basic-toggle-row">',
        '<span class="tdv4-switch">',
        `<input class="tdv4-flag-toggle" type="checkbox" data-${field.sourceKind === 'portal' ? 'portal-env' : 'config-patch'}-field="${escapeHtml(field.key)}" data-field-type="boolean" data-default-value="${field.defaultValue ? 'true' : 'false'}"${field.value ? ' checked' : ''}>`,
        '<span class="tdv4-switch-track"><span class="tdv4-switch-thumb"></span></span>',
        '</span>',
        `<div class="tdv4-basic-toggle-hint">${escapeHtml(boolLabel(Boolean(field.value)))}</div>`,
        '</div>',
        '</label>',
      ].join('');
    }

    if (field.type === 'select') {
      return [
        '<label class="tdv4-basic-field">',
        '<div class="tdv4-basic-field-copy">',
        `<div class="tdv4-basic-field-label">${escapeHtml(field.label)}</div>`,
        `<div class="tdv4-basic-field-detail">${escapeHtml(field.description)}</div>`,
        `<div class="tdv4-basic-field-meta-row">${metaBadges}</div>`,
        '</div>',
        `<select class="tdv4-basic-input" data-${field.sourceKind === 'portal' ? 'portal-env' : 'config-patch'}-field="${escapeHtml(field.key)}" data-field-type="select" data-default-value="${escapeHtml(field.defaultValue)}">`,
        normalizeOptions(field.options).map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(field.value) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join(''),
        '</select>',
        '</label>',
      ].join('');
    }

    return [
      '<label class="tdv4-basic-field">',
      '<div class="tdv4-basic-field-copy">',
      `<div class="tdv4-basic-field-label">${escapeHtml(field.label)}</div>`,
      `<div class="tdv4-basic-field-detail">${escapeHtml(field.description)}</div>`,
      `<div class="tdv4-basic-field-meta-row">${metaBadges}</div>`,
      '</div>',
      `<input class="tdv4-basic-input" type="${field.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(String(field.value ?? ''))}" data-${field.sourceKind === 'portal' ? 'portal-env' : 'config-patch'}-field="${escapeHtml(field.key)}" data-field-type="${escapeHtml(field.type === 'number' ? 'number' : 'text')}" data-default-value="${escapeHtml(String(field.defaultValue ?? ''))}"${field.min != null ? ` min="${escapeHtml(field.min)}"` : ''}${field.max != null ? ` max="${escapeHtml(field.max)}"` : ''}>`,
      '</label>',
    ].join('');
  }

  function renderOverrideEditor(editor, actions) {
    return [
      '<details class="tdv4-advanced-editor">',
      `<summary class="tdv4-advanced-editor-summary">${escapeHtml(editor.title)}</summary>`,
      `<div class="tdv4-editor-label">${escapeHtml(editor.description)}</div>`,
      `<textarea id="${escapeHtml(editor.editorId)}" class="tdv4-editor">${escapeHtml(editor.value)}</textarea>`,
      '<div class="tdv4-config-page-actions">',
      actions.map((action) => `<button class="tdv4-button ${action.primary ? 'tdv4-button-primary' : 'tdv4-button-secondary'}" type="button" data-config-action="${escapeHtml(action.value)}">${escapeHtml(action.label)}</button>`).join(''),
      '</div>',
      '</details>',
    ].join('');
  }

  function renderCategory(category, current) {
    return [
      `<section class="tdv4-config-category-panel${current ? ' tdv4-config-category-panel-current' : ''}" data-config-category-panel="${escapeHtml(category.key)}"${current ? '' : ' hidden'}>`,
      '<div class="tdv4-config-category-empty tdv4-readable-empty" data-config-category-empty hidden><strong>ไม่พบค่าที่ตรงกับตัวกรอง</strong><p>ลองล้างคำค้นหรือสลับเป็นมุมมองค่าจริงทั้งหมด</p></div>',
      `<header class="tdv4-config-layout-panel"><h2 class="tdv4-config-column-title">${escapeHtml(category.label)}</h2><p class="tdv4-config-column-copy">${escapeHtml(category.description || 'จัดการค่ากลุ่มนี้ตามความต้องการของเซิร์ฟเวอร์')}</p></header>`,
      ...category.groups.map((group) => [
        `<article class="tdv4-config-group-card" data-config-group="${escapeHtml(group.key)}" data-group-total-count="${escapeHtml(group.settingCount)}" data-group-basic-count="${escapeHtml(group.basicSettingCount)}">`,
        '<div class="tdv4-config-group-head">',
        `<h3 class="tdv4-config-group-title">${escapeHtml(group.label)}</h3>`,
        `<span class="tdv4-config-group-count" data-config-group-count>${escapeHtml(String(group.settings.length))} ค่า</span>`,
        '</div>',
        `<div class="tdv4-config-group-list">${group.settings.map(renderSetting).join('')}</div>`,
        '</article>',
      ].join('')),
      '</section>',
    ].join('');
  }

  function renderAdvancedConfigCategory(category, current) {
    const summary = category?.advancedSummary && typeof category.advancedSummary === 'object'
      ? category.advancedSummary
      : {};
    const fileRows = Array.isArray(summary.files) ? summary.files : [];
    const fileList = fileRows.length
      ? fileRows.map((file) => [
        '<div class="tdv4-readable-row">',
        '<div class="tdv4-readable-key">',
        `<div class="tdv4-readable-key-title">${escapeHtml(file.label || file.file || 'Config file')}</div>`,
        `<div class="tdv4-readable-key-code">${escapeHtml(file.file || '')}</div>`,
        '</div>',
        `<div class="tdv4-readable-value">${renderBadge(file.exists ? 'พร้อมอ่าน' : 'ยังไม่พบ', file.exists ? 'success' : 'warning')}</div>`,
        '</div>',
      ].join('')).join('')
      : '<div class="tdv4-readable-empty"><strong>ยังไม่มีไฟล์ที่ตรวจพบ</strong><p>รอ snapshot ล่าสุดจาก Server Bot เพื่อแสดงไฟล์ config และสถานะการอ่าน</p></div>';

    return [
      `<section class="tdv4-config-category-panel${current ? ' tdv4-config-category-panel-current' : ''}" data-config-category-panel="${escapeHtml(category.key)}" data-config-category-mode="advanced"${current ? '' : ' hidden'}>`,
      `<header class="tdv4-config-layout-panel"><h2 class="tdv4-config-column-title">${escapeHtml(category.label)}</h2><p class="tdv4-config-column-copy">${escapeHtml(category.description || 'Technical details from Server Bot')}</p></header>`,
      '<article class="tdv4-config-group-card">',
      '<div class="tdv4-config-group-head">',
      '<h3 class="tdv4-config-group-title">Server Bot Snapshot</h3>',
      `<span class="tdv4-config-group-count">${escapeHtml(statusLabel(summary.snapshotStatus || 'missing'))}</span>`,
      '</div>',
      '<div class="tdv4-readable-list">',
      `<div class="tdv4-readable-row"><div class="tdv4-readable-key"><div class="tdv4-readable-key-title">Snapshot Status</div><div class="tdv4-readable-key-code">server-config snapshot</div></div><div class="tdv4-readable-value">${renderBadge(statusLabel(summary.snapshotStatus || 'missing'), statusTone(summary.snapshotStatus || 'missing'))}</div></div>`,
      `<div class="tdv4-readable-row"><div class="tdv4-readable-key"><div class="tdv4-readable-key-title">Collected At</div><div class="tdv4-readable-key-code">latest server-bot read</div></div><div class="tdv4-readable-value">${escapeHtml(formatDateTime(summary.snapshotCollectedAt, 'ยังไม่ทราบเวลา'))}</div></div>`,
      `<div class="tdv4-readable-row"><div class="tdv4-readable-key"><div class="tdv4-readable-key-title">Updated By</div><div class="tdv4-readable-key-code">bot identity</div></div><div class="tdv4-readable-value">${escapeHtml(summary.snapshotUpdatedBy || '-')}</div></div>`,
      summary.lastError
        ? `<div class="tdv4-readable-row"><div class="tdv4-readable-key"><div class="tdv4-readable-key-title">Last Error</div><div class="tdv4-readable-key-code">server-bot read/write verification</div></div><div class="tdv4-readable-value">${escapeHtml(summary.lastError)}</div></div>`
        : '',
      '</div>',
      '</article>',
      '<article class="tdv4-config-group-card">',
      '<div class="tdv4-config-group-head">',
      '<h3 class="tdv4-config-group-title">Source Files</h3>',
      `<span class="tdv4-config-group-count">${escapeHtml(String(fileRows.length))} files</span>`,
      '</div>',
      `<div class="tdv4-readable-list">${fileList}</div>`,
      '<details class="tdv4-details-panel tdv4-panel">',
      '<summary class="tdv4-details-summary">Raw snapshot</summary>',
      '<p class="tdv4-config-column-copy">ใช้สำหรับตรวจข้อมูลดิบที่ Server Bot อ่านกลับมา ไม่ใช่มุมหลักสำหรับการแก้ค่าปกติ</p>',
      `<textarea class="tdv4-editor" readonly>${escapeHtml(stringifyPretty(summary.rawSnapshot || { files: [] }))}</textarea>`,
      '</details>',
      '</article>',
      '</section>',
    ].join('');
  }

  function renderServerConfigCategory(category, current) {
    if (category?.advancedSummary) {
      return renderAdvancedConfigCategory(category, current);
    }
    const html = renderCategory(category, current);
    const categoryMode = category?.mode === 'advanced' ? 'advanced' : 'basic';
    return html.replace(
      `data-config-category-panel="${escapeHtml(category.key)}"`,
      `data-config-category-panel="${escapeHtml(category.key)}" data-config-category-mode="${escapeHtml(categoryMode)}"`,
    );
  }

  function buildTenantServerConfigV4Html(model) {
    const safe = model && typeof model === 'object' ? model : createTenantServerConfigV4Model({});
    const configCategoryList = safe.workspace.categories.map((category) => [
      `<button class="tdv4-config-category-button${category.key === safe.workspace.activeCategoryKey ? ' is-current' : ''}" type="button" data-config-category-tab="${escapeHtml(category.key)}" data-config-category-mode="${escapeHtml(category.mode === 'advanced' ? 'advanced' : 'basic')}" data-config-category-total="${escapeHtml(category.settingCount)}" data-config-category-basic="${escapeHtml(category.basicSettingCount ?? category.settingCount)}" aria-pressed="${category.key === safe.workspace.activeCategoryKey ? 'true' : 'false'}"${category.mode === 'advanced' ? ' hidden' : ''}>`,
      `<span class="tdv4-config-category-name">${escapeHtml(category.label)}</span>`,
      `<span class="tdv4-config-category-meta" data-config-category-meta>${escapeHtml(category.basicSettingCount ?? category.settingCount)} ค่า</span>`,
      '</button>',
    ].join('')).join('');

    const backupList = safe.workspace.backups.length
      ? safe.workspace.backups.map((backup) => {
        const changedKeys = Array.isArray(backup.changeSummary)
          ? backup.changeSummary.map((entry) => firstNonEmpty([entry.key, entry.file], '')).filter(Boolean).slice(0, 3)
          : [];
        return [
          '<div class="tdv4-config-backup-row">',
          '<div class="tdv4-config-backup-main">',
          `<strong>${escapeHtml(firstNonEmpty([backup.file], 'Backup'))}</strong>`,
          `<span class="tdv4-config-setting-value">${escapeHtml(formatDateTime(backup.createdAt, 'ไม่ทราบเวลา'))}</span>`,
          `<span class="tdv4-config-setting-rawkey">${escapeHtml(firstNonEmpty([backup.changedBy], 'ไม่ทราบผู้แก้ไข'))}${changedKeys.length ? ` · ${escapeHtml(changedKeys.join(', '))}` : ''}</span>`,
          '</div>',
          `<button class="tdv4-button tdv4-button-secondary" type="button" data-server-config-rollback="${escapeHtml(backup.id)}">กู้คืน</button>`,
          '</div>',
        ].join('');
      }).join('')
      : '<div class="tdv4-readable-empty"><strong>ยังไม่มี backup</strong><p>เมื่อมีการบันทึกค่าผ่าน Server Bot ระบบจะเก็บสำเนาไว้ให้กู้คืนจากหน้านี้</p></div>';

    const fileList = safe.workspace.files.length
      ? safe.workspace.files.map((file) => [
        '<div class="tdv4-readable-row">',
        '<div class="tdv4-readable-key">',
        `<div class="tdv4-readable-key-title">${escapeHtml(firstNonEmpty([file.label, file.file], file.file || 'Config file'))}</div>`,
        `<div class="tdv4-readable-key-code">${escapeHtml(file.file || '')}</div>`,
        '</div>',
        `<div class="tdv4-readable-value">${renderBadge(file.exists ? 'พบไฟล์' : 'ยังไม่พบไฟล์', file.exists ? 'success' : 'warning')}</div>`,
        '</div>',
      ].join('')).join('')
      : '<div class="tdv4-readable-empty"><strong>ยังไม่พบแหล่งไฟล์</strong><p>ระบบจะสรุปไฟล์ config ที่อ่านได้เมื่อ Server Bot ส่ง snapshot เข้ามาแล้ว</p></div>';

    const featureFlagList = safe.featureFlags.items.length
      ? safe.featureFlags.items.map((feature) => [
        '<label class="tdv4-flag-control">',
        '<div class="tdv4-flag-copy">',
        `<div class="tdv4-flag-title">${escapeHtml(feature.label)}</div>`,
        `<div class="tdv4-basic-field-detail">${escapeHtml(feature.description)}</div>`,
        '<div class="tdv4-flag-meta">',
        renderBadge(feature.badge, feature.tone),
        feature.packageEnabled ? renderBadge('แพ็กเกจเปิด', 'success') : renderBadge('แพ็กเกจยังไม่เปิด', 'muted'),
        '</div>',
        `<div class="tdv4-flag-key">${escapeHtml(feature.key)}</div>`,
        '</div>',
        '<div class="tdv4-basic-toggle-row">',
        '<span class="tdv4-switch">',
        `<input class="tdv4-flag-toggle" type="checkbox" data-feature-flag-toggle data-feature-flag-key="${escapeHtml(feature.key)}"${feature.enabled ? ' checked' : ''}>`,
        '<span class="tdv4-switch-track"><span class="tdv4-switch-thumb"></span></span>',
        '</span>',
        `<div class="tdv4-basic-toggle-hint">${escapeHtml(boolLabel(feature.enabled))}</div>`,
        '</div>',
        '</label>',
      ].join('')).join('')
      : '<div class="tdv4-readable-empty"><strong>ยังไม่มีฟีเจอร์ให้ตั้งจากหน้านี้</strong><p>ฟีเจอร์ของ tenant จะขึ้นที่นี่เมื่อระบบโหลด catalog และสิทธิ์ของแพ็กเกจครบแล้ว</p></div>';

    const workspaceBody = safe.workspace.available
      ? [
        '<section class="tdv4-config-layout-panel"><div class="tdv4-config-layout">',
        '<aside class="tdv4-config-category-sidebar"><article class="tdv4-panel tdv4-config-category-panel-card"><div class="tdv4-section-kicker">หมวดการตั้งค่า</div><h2 class="tdv4-section-title">เลือกหมวดที่ต้องการแก้</h2><p class="tdv4-section-copy">เริ่มจากค่าพื้นฐานก่อน ค้นหาคีย์ที่ต้องการ แล้วค่อยสลับไปดูค่าจริงทั้งหมดเมื่อจำเป็น</p><div class="tdv4-config-toolbar"><label class="tdv4-config-search"><span class="tdv4-config-search-label">ค้นหาค่า</span><div class="tdv4-config-search-input-row"><input class="tdv4-basic-input tdv4-config-search-input" type="search" data-config-search-input placeholder="เช่น MaxPlayers, Respawn หรือ Welcome"><button class="tdv4-button tdv4-button-secondary tdv4-config-search-clear" type="button" data-config-search-clear>ล้าง</button></div></label><div class="tdv4-config-toolbar-row"><div class="tdv4-config-view-switch" role="tablist" aria-label="Config scope switch"><button class="tdv4-config-view-button is-current" type="button" data-config-scope-tab="basic" aria-pressed="true">ค่าพื้นฐาน</button><button class="tdv4-config-view-button" type="button" data-config-scope-tab="all" aria-pressed="false">ค่าจริงทั้งหมด</button></div><div class="tdv4-config-filter-switch" role="tablist" aria-label="Config quick filter"><button class="tdv4-config-filter-button is-current" type="button" data-config-filter-tab="all" aria-pressed="true">ทั้งหมด</button><button class="tdv4-config-filter-button" type="button" data-config-filter-tab="dirty" aria-pressed="false">แก้ค้าง</button><button class="tdv4-config-filter-button" type="button" data-config-filter-tab="restart" aria-pressed="false">ต้องรีสตาร์ต</button></div></div><div class="tdv4-config-filter-summary" data-config-filter-summary>กำลังดูค่าพื้นฐาน ${escapeHtml(safe.workspace.basicSettingCount)} จาก ${escapeHtml(safe.workspace.totalSettingCount)} ค่า</div></div><div class="tdv4-config-category-list">',
        configCategoryList,
        '</div></article></aside>',
        '<section class="tdv4-config-settings-column">',
        '<article class="tdv4-panel tdv4-config-results-empty" data-config-results-empty hidden><strong>ไม่พบค่าที่ตรงกับตัวกรอง</strong><p>ลองล้างคำค้น เปลี่ยนเป็นค่าจริงทั้งหมด หรือกลับไปดูทุกค่าก่อน</p></article>',
        safe.workspace.categories.map((category) => renderServerConfigCategory(category, category.key === safe.workspace.activeCategoryKey)).join(''),
        '</section>',
        '<aside class="tdv4-config-context-column"><div class="tdv4-config-context-stack">',
        '<article class="tdv4-panel tdv4-config-help-panel">',
        '<div class="tdv4-section-kicker">ค่าที่กำลังเลือก</div>',
        `<h3 class="tdv4-section-title" data-server-config-help-title>${escapeHtml(safe.help.title)}</h3>`,
        `<p class="tdv4-section-copy" data-server-config-help-description>${escapeHtml(safe.help.description)}</p>`,
        `<div class="tdv4-config-key-row">${safe.help.badges.map((badge) => renderBadge(badge.label, badge.tone)).join('')}</div>`,
        `<div class="tdv4-config-setting-rawkey" data-server-config-help-meta>${escapeHtml(safe.help.meta)}</div>`,
        '</article>',
        '<article class="tdv4-panel tdv4-config-backups-panel"><div class="tdv4-section-kicker">Backup history</div><h3 class="tdv4-section-title">ประวัติการสำรอง</h3><div class="tdv4-config-backup-list">',
        backupList,
        '</div></article>',
        '<article class="tdv4-panel tdv4-config-files-panel"><div class="tdv4-section-kicker">Config files</div><h3 class="tdv4-section-title">แหล่งไฟล์</h3><div class="tdv4-readable-list">',
        fileList,
        '</div></article>',
        '</div></aside></div></section>',
      ].join('')
      : [
        `<section class="tdv4-config-layout-panel"><article class="tdv4-panel tdv4-readable-empty" data-server-config-empty-kind="${escapeHtml(safe.emptyState.kind || 'general')}">`,
        `<strong>${escapeHtml(safe.emptyState.title)}</strong>`,
        `<p>${escapeHtml(safe.emptyState.detail)}</p>`,
        `<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" data-server-config-empty-action href="${escapeHtml(safe.emptyState.actionHref)}">${escapeHtml(safe.emptyState.actionLabel)}</a></div>`,
        '</article></section>',
      ].join('');

    return [
      '<div class="tdv4-app"><div class="tdv4-topbar"><div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div>`,
      '</div></div></div>',
      '<div class="tdv4-shell tdv4-config-shell">',
      `<aside class="tdv4-sidebar">${safe.shell.navGroups.map(renderNavGroup).join('')}</aside>`,
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-config-hero"><div class="tdv4-config-hero-copy">',
      `<h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p>`,
      `<div class="tdv4-chip-row">${renderBadge(safe.status.label, safe.status.tone)}${renderBadge(safe.header.serverName, 'muted')}</div>`,
      '<div class="tdv4-config-mode-switch" role="tablist" aria-label="Config mode switch">',
      '<button class="tdv4-config-mode-button is-current" type="button" data-config-mode-tab="basic" aria-pressed="true">โหมดใช้งานง่าย</button>',
      '<button class="tdv4-config-mode-button" type="button" data-config-mode-tab="advanced" aria-pressed="false">โหมดขั้นสูง</button>',
      '</div>',
      '</div><div class="tdv4-pagehead-actions tdv4-pagehead-actions-stack">',
      '<div class="tdv4-section-kicker">การบันทึกค่า</div>',
      '<p class="tdv4-config-action-caption">เลือกได้ว่าจะเก็บ draft, ใช้ค่าทันที หรือบันทึกพร้อมรีสตาร์ตเซิร์ฟเวอร์</p>',
      '<button class="tdv4-button tdv4-button-secondary" type="button" data-server-config-save-mode="save_only">บันทึกอย่างเดียว</button>',
      '<button class="tdv4-button tdv4-button-primary" type="button" data-server-config-save-mode="save_apply">บันทึกและใช้ค่า</button>',
      '<button class="tdv4-button tdv4-button-secondary" type="button" data-server-config-save-mode="save_restart">บันทึกแล้วรีสตาร์ต</button>',
      '</div></section>',
      '<section class="tdv4-config-layout-panel"><div class="tdv4-config-savebar"><div class="tdv4-config-savebar-copy">',
      '<strong>สถานะล่าสุด</strong>',
      `<span>${escapeHtml(safe.status.detail)}</span>`,
      `<span>${escapeHtml(safe.status.updatedAt ? `อัปเดตเมื่อ ${formatDateTime(safe.status.updatedAt)}` : 'ยังไม่ทราบเวลาอัปเดต')}${safe.status.updatedBy ? ` · โดย ${escapeHtml(safe.status.updatedBy)}` : ''}</span>`,
      '</div><div class="tdv4-config-savebar-actions"><span class="tdv4-badge tdv4-badge-info" data-server-config-change-count>ยังไม่มีค่าที่แก้ค้างอยู่</span><span class="tdv4-badge tdv4-badge-warning" data-server-config-restart-count hidden>ต้องรีสตาร์ต</span></div></div></section>',
      workspaceBody,
      '<section class="tdv4-config-layout-panel" data-config-mode-section="advanced" hidden><div class="tdv4-config-section-grid">',
      '<article class="tdv4-panel tdv4-config-mode-panel"><div class="tdv4-section-kicker">Tenant modules</div><h2 class="tdv4-section-title">Feature Flags</h2><p class="tdv4-section-copy">ใช้เปิดหรือปิดโมดูลของผู้เช่ารายนี้แบบไม่ต้องแก้ JSON เอง</p><div class="tdv4-flag-grid">',
      featureFlagList,
      '</div>',
      renderOverrideEditor(safe.featureFlags.editor, [
        { value: 'save', label: 'บันทึก Feature Flags', primary: true },
      ]),
      '</article>',
      '<article class="tdv4-panel tdv4-config-mode-panel"><div class="tdv4-section-kicker">Platform overrides</div><h2 class="tdv4-section-title">Server Settings</h2><p class="tdv4-section-copy">ค่าระดับแพลตฟอร์มสำหรับงานประจำวันของผู้เช่ารายนี้</p>',
      safe.configPatch.groups.map((group) => `<section class="tdv4-config-field-group"><div class="tdv4-config-field-group-title">${escapeHtml(group.title)}</div><p class="tdv4-config-field-group-copy">${escapeHtml(group.description)}</p><div class="tdv4-basic-field-grid">${group.fields.map(renderBasicField).join('')}</div></section>`).join(''),
      renderOverrideEditor(safe.configPatch.editor, [
        { value: 'save', label: 'บันทึกอย่างเดียว', primary: false },
        { value: 'apply', label: 'บันทึกและใช้ค่า', primary: true },
        { value: 'restart', label: 'บันทึกแล้วไปหน้ารีสตาร์ต', primary: false },
      ]),
      '</article>',
      '<article class="tdv4-panel tdv4-config-mode-panel"><div class="tdv4-section-kicker">Player portal</div><h2 class="tdv4-section-title">Portal Settings</h2><p class="tdv4-section-copy">ค่าที่มีผลกับประสบการณ์ของผู้เล่นในพอร์ทัลเว็บ</p>',
      safe.portalEnvPatch.groups.map((group) => `<section class="tdv4-config-field-group"><div class="tdv4-config-field-group-title">${escapeHtml(group.title)}</div><p class="tdv4-config-field-group-copy">${escapeHtml(group.description)}</p><div class="tdv4-basic-field-grid">${group.fields.map(renderBasicField).join('')}</div></section>`).join(''),
      renderOverrideEditor(safe.portalEnvPatch.editor, [
        { value: 'save', label: 'บันทึกอย่างเดียว', primary: false },
        { value: 'apply', label: 'บันทึกและใช้ค่า', primary: true },
      ]),
      '</article></div></section>',
      '<section class="tdv4-config-layout-panel" data-config-mode-section="advanced" hidden><details class="tdv4-details-panel tdv4-panel"><summary class="tdv4-details-summary">ดู snapshot ดิบจาก Server Bot</summary><p class="tdv4-config-column-copy">ใช้มุมนี้เพื่อตรวจค่าดิบและไฟล์ที่ bot อ่านกลับมา ไม่ใช่มุมหลักสำหรับผู้ใช้งานทั่วไป</p>',
      `<textarea class="tdv4-editor" readonly>${escapeHtml(stringifyPretty(safe.workspace.rawSnapshot))}</textarea>`,
      '</details></section>',
      '</main></div></div>',
    ].join('');
  }

  function renderTenantServerConfigV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantServerConfigV4 requires a root element');
    }
    const model = source && source.header && source.workspace
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
