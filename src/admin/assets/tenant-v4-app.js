(function () {
  'use strict';

  const PAGE_ALIASES = {
    '': 'dashboard',
    overview: 'dashboard',
    dashboard: 'dashboard',
    status: 'server-status',
    'server-status': 'server-status',
    config: 'server-config',
    'server-config': 'server-config',
    orders: 'orders',
    commerce: 'orders',
    transactions: 'orders',
    delivery: 'orders',
    players: 'players',
    'support-tools': 'players',
    'delivery-agents': 'delivery-agents',
    'server-bots': 'server-bots',
    actions: 'restart-control',
    'restart-control': 'restart-control',
  };

  const PAGE_TITLES = {
    dashboard: 'ภาพรวมงานประจำวัน',
    'server-status': 'สถานะเซิร์ฟเวอร์',
    'server-config': 'ตั้งค่าเซิร์ฟเวอร์',
    orders: 'คำสั่งซื้อและการส่งของ',
    players: 'ผู้เล่นและการช่วยเหลือ',
    'delivery-agents': 'เอเจนต์ส่งของ',
    'server-bots': 'เซิร์ฟเวอร์บอต',
    'restart-control': 'ควบคุมการรีสตาร์ต',
  };

  const PAGE_FEATURE_RULES = {
    dashboard: [],
    'server-status': ['server_status'],
    'server-config': ['server_settings'],
    orders: ['orders_module'],
    players: ['player_module'],
    'delivery-agents': ['execute_agent'],
    'server-bots': ['sync_agent'],
    'restart-control': ['server_hosting'],
  };

  const NAV_GROUP_LABELS = {
    Overview: 'ภาพรวม',
    Server: 'เซิร์ฟเวอร์',
    Operations: 'งานประจำวัน',
    Runtimes: 'รันไทม์',
  };

  const state = {
    payload: null,
    refreshing: false,
    ownerTenantOptions: [],
    provisioningResult: {
      'delivery-agents': null,
      'server-bots': null,
    },
  };

  function resolveTenantLabel(tenantId) {
    const normalizedTenantId = String(tenantId || '').trim();
    if (!normalizedTenantId) return '';
    const rows = Array.isArray(state.ownerTenantOptions) ? state.ownerTenantOptions : [];
    const match = rows.find((row) => String(row?.id || '').trim() === normalizedTenantId);
    return String(match?.name || match?.slug || '').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function root() {
    return document.getElementById('tenantV4AppRoot');
  }

  function statusNode() {
    return document.getElementById('tenantV4Status');
  }

  function selectorNode() {
    return document.getElementById('tenantOwnerScopeSelect');
  }

  function selectorWrapNode() {
    return document.getElementById('tenantOwnerScopeWrap');
  }

  function selectorButtonNode() {
    return document.getElementById('tenantOwnerScopeButton');
  }

  function selectorValueNode() {
    return document.getElementById('tenantOwnerScopeValue');
  }

  function selectorMenuNode() {
    return document.getElementById('tenantOwnerScopeMenu');
  }

  function selectorComboboxNode() {
    return document.querySelector('#tenantOwnerScopeWrap .surface-combobox');
  }

  function setStatus(message, tone) {
    const node = statusNode();
    if (!node) return;
    node.textContent = String(message || '').trim();
    node.dataset.tone = tone || 'muted';
  }

  function renderMessageCard(title, detail) {
    const target = root();
    if (!target) return null;
    target.innerHTML = [
      '<section style="padding:32px;border:1px solid rgba(212,186,113,.18);border-radius:24px;background:rgba(13,17,14,.92);box-shadow:0 24px 56px rgba(0,0,0,.28)">',
      `<h1 style="margin:0 0 12px;font:700 32px/1.05 'IBM Plex Sans Thai','Segoe UI',sans-serif;color:#f4efe4">${escapeHtml(title)}</h1>`,
      `<p style="margin:0;color:rgba(244,239,228,.74);font:400 15px/1.7 'IBM Plex Sans Thai','Segoe UI',sans-serif">${escapeHtml(detail)}</p>`,
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
        window.location.href = '/tenant/login';
        return fallback;
      }
      throw new Error(String(payload?.error || `Request failed (${response.status})`));
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

  function currentPage() {
    const raw = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    return PAGE_ALIASES[raw] || 'dashboard';
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
    if (accessState?.preview) return `${label} (ดูตัวอย่าง)`;
    if (accessState?.locked) return `${label} (ต้องอัปเกรด)`;
    return label;
  }

  function buildTenantSurfaceState(payload, requestedPage) {
    const previewMode = Boolean(
      payload?.tenantConfig?.previewMode
      || payload?.overview?.tenantConfig?.previewMode
      || payload?.overview?.opsState?.previewMode
      || payload?.overview?.opsState?.preview,
    );
    const featureAccess = normalizeFeatureAccess(
      payload?.overview?.tenantFeatureAccess || createEmptyFeatureAccess(payload?.tenantId),
      payload?.tenantId,
      previewMode,
    );
    const pageAccess = Object.fromEntries(
      Object.entries(PAGE_FEATURE_RULES).map(([pageKey, requiredFeatures]) => {
        const enabledByPackage = hasAnyTenantFeature(featureAccess, requiredFeatures);
        const enabled = previewMode ? true : enabledByPackage;
        return [pageKey, {
          enabled,
          locked: !enabled,
          preview: previewMode && !enabledByPackage,
          requiredFeatures: [...requiredFeatures],
        }];
      }),
    );
    const resolvedPage = pageAccess[requestedPage]?.enabled ? requestedPage : 'dashboard';
    const navGroups = [
      {
        label: 'Overview',
        items: [
          {
            label: buildNavItemLabel(PAGE_TITLES.dashboard, pageAccess.dashboard),
            href: '#dashboard',
            current: resolvedPage === 'dashboard',
          },
        ],
      },
      {
        label: 'Server',
        items: [
          {
            label: buildNavItemLabel(PAGE_TITLES['server-status'], pageAccess['server-status']),
            href: '#server-status',
            current: resolvedPage === 'server-status',
          },
          {
            label: buildNavItemLabel(PAGE_TITLES['server-config'], pageAccess['server-config']),
            href: '#server-config',
            current: resolvedPage === 'server-config',
          },
          {
            label: buildNavItemLabel(PAGE_TITLES['restart-control'], pageAccess['restart-control']),
            href: '#restart-control',
            current: resolvedPage === 'restart-control',
          },
        ],
      },
      {
        label: 'Operations',
        items: [
          {
            label: buildNavItemLabel(PAGE_TITLES.orders, pageAccess.orders),
            href: '#orders',
            current: resolvedPage === 'orders',
          },
          {
            label: buildNavItemLabel(PAGE_TITLES.players, pageAccess.players),
            href: '#players',
            current: resolvedPage === 'players',
          },
        ],
      },
      {
        label: 'Runtimes',
        items: [
          {
            label: buildNavItemLabel(PAGE_TITLES['delivery-agents'], pageAccess['delivery-agents']),
            href: '#delivery-agents',
            current: resolvedPage === 'delivery-agents',
          },
          {
            label: buildNavItemLabel(PAGE_TITLES['server-bots'], pageAccess['server-bots']),
            href: '#server-bots',
            current: resolvedPage === 'server-bots',
          },
        ],
      },
    ];
    const visibleNavGroups = navGroups.map((group) => ({
      ...group,
      label: NAV_GROUP_LABELS[group.label] || group.label,
      items: Array.isArray(group.items) ? group.items : [],
    }));
    const notice = !previewMode && resolvedPage !== requestedPage
      ? {
          tone: 'warning',
          title: 'แพ็กเกจปัจจุบันยังไม่เปิดหน้านี้',
          detail: 'สิทธิ์ของผู้เช่ารายนี้ยังไม่ครอบคลุมพื้นที่ทำงานที่เลือก ระบบจึงพากลับมาที่หน้าที่ใช้งานได้ก่อน',
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

  function readTenantIdFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('tenantId') || '').trim();
  }

  function readUserIdFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('userId') || '').trim();
  }

  function readPurchaseCodeFromUrl() {
    const url = new URL(window.location.href);
    return String(url.searchParams.get('code') || '').trim();
  }

  function isPreviewTenantId(value) {
    const text = String(value || '').trim().toLowerCase();
    return text.startsWith('tenant-preview-') || text.startsWith('preview-');
  }

  function pickPreferredTenantId(rows, currentTenantId) {
    const normalizedCurrentTenantId = String(currentTenantId || '').trim();
    const tenants = Array.isArray(rows) ? rows : [];
    if (normalizedCurrentTenantId && tenants.some((row) => String(row?.id || '').trim() === normalizedCurrentTenantId)) {
      return normalizedCurrentTenantId;
    }
    const activeNonPreview = tenants.find((row) => {
      const tenantId = String(row?.id || '').trim();
      const status = String(row?.status || '').trim().toLowerCase();
      return tenantId && !isPreviewTenantId(tenantId) && status !== 'suspended' && status !== 'inactive';
    });
    if (activeNonPreview) return String(activeNonPreview.id || '').trim();
    return String(tenants[0]?.id || '').trim();
  }

  function normalizeTenantBaseLabel(row) {
    return String(row?.name || row?.slug || row?.id || '').trim();
  }

  function shortTenantReference(row, baseLabel) {
    const slug = String(row?.slug || '').trim();
    const id = String(row?.id || '').trim();
    if (slug && slug !== baseLabel) return slug;
    if (!id || id === baseLabel) return '';
    if (id.length <= 24) return id;
    return `${id.slice(0, 12)}...${id.slice(-4)}`;
  }

  function isPreviewTenantRow(row) {
    const tenantId = String(row?.id || '').trim();
    const status = String(row?.status || '').trim().toLowerCase();
    return isPreviewTenantId(tenantId) || ['preview', 'trial', 'trialing'].includes(status);
  }

  function formatTenantStateLabel(row) {
    const status = String(row?.status || '').trim().toLowerCase();
    if (isPreviewTenantRow(row)) return 'ตัวอย่าง';
    if (status === 'suspended') return 'ระงับ';
    if (status === 'inactive') return 'ไม่ใช้งาน';
    if (status === 'draft') return 'ร่าง';
    return '';
  }

  function buildTenantOptionDescriptor(row, duplicateCounts) {
    const baseLabel = normalizeTenantBaseLabel(row);
    if (!baseLabel) {
      return {
        value: '',
        baseLabel: '',
        stateLabel: '',
        reference: '',
        label: '',
      };
    }
    const key = baseLabel.toLowerCase();
    const needsReference = Number(duplicateCounts.get(key) || 0) > 1 || isPreviewTenantRow(row);
    const stateLabel = formatTenantStateLabel(row);
    const reference = needsReference ? shortTenantReference(row, baseLabel) : '';
    const extras = [stateLabel, reference].filter(Boolean);
    return {
      value: String(row?.id || '').trim(),
      baseLabel,
      stateLabel,
      reference,
      label: extras.length ? `${baseLabel} · ${extras.join(' · ')}` : baseLabel,
    };
  }

  function buildTenantOptionDescriptors(rows) {
    const tenants = Array.isArray(rows) ? rows : [];
    const duplicateCounts = tenants.reduce((map, row) => {
      const label = normalizeTenantBaseLabel(row);
      if (!label) return map;
      const key = label.toLowerCase();
      map.set(key, Number(map.get(key) || 0) + 1);
      return map;
    }, new Map());
    return tenants
      .map((row) => buildTenantOptionDescriptor(row, duplicateCounts))
      .filter((row) => row.value && row.label);
  }

  function buildTenantOptionsHtml(rows) {
    return buildTenantOptionDescriptors(rows)
      .map((row) => `<option value="${escapeHtml(row.value)}">${escapeHtml(row.label)}</option>`)
      .join('');
  }

  function setTenantScopeMenuOpen(open) {
    const combobox = selectorComboboxNode();
    const button = selectorButtonNode();
    const menu = selectorMenuNode();
    if (!combobox || !button || !menu) return;
    const nextOpen = Boolean(open);
    combobox.dataset.state = nextOpen ? 'open' : 'closed';
    button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    menu.hidden = !nextOpen;
  }

  function focusCurrentTenantScopeOption() {
    const menu = selectorMenuNode();
    if (!menu) return;
    const currentOption = menu.querySelector('.surface-combobox-option.is-current');
    const fallbackOption = menu.querySelector('.surface-combobox-option');
    (currentOption || fallbackOption)?.focus();
  }

  function renderTenantScopeMenu() {
    const menu = selectorMenuNode();
    const select = selectorNode();
    if (!menu || !select) return;
    const currentTenantId = String(select.value || '').trim();
    const options = buildTenantOptionDescriptors(state.ownerTenantOptions);
    if (!options.length) {
      menu.innerHTML = '<div class="surface-combobox-empty">ยังไม่มีผู้เช่าที่พร้อมให้เลือก</div>';
      return;
    }
    menu.innerHTML = options.map((option) => {
      const isCurrent = option.value === currentTenantId;
      return [
        `<button class="surface-combobox-option${isCurrent ? ' is-current' : ''}" type="button" role="option" aria-selected="${isCurrent ? 'true' : 'false'}" data-value="${escapeHtml(option.value)}">`,
        '<span class="surface-combobox-option-title">',
        `<span class="surface-combobox-option-name">${escapeHtml(option.baseLabel)}</span>`,
        option.stateLabel ? `<span class="surface-combobox-option-badge">${escapeHtml(option.stateLabel)}</span>` : '',
        '</span>',
        option.reference ? `<span class="surface-combobox-option-meta">${escapeHtml(option.reference)}</span>` : '',
        '</button>',
      ].join('');
    }).join('');
  }

  function syncTenantScopeControls() {
    const select = selectorNode();
    const valueNode = selectorValueNode();
    if (!select || !valueNode) return;
    const selectedLabel = String(select.selectedOptions?.[0]?.textContent || 'เลือกผู้เช่า').trim();
    valueNode.textContent = selectedLabel || 'เลือกผู้เช่า';
    renderTenantScopeMenu();
  }

  function buildPreviewOverviewFallback(tenantId) {
    return {
      analytics: {
        overview: {
          activeTenants: 1,
          activeSubscriptions: 0,
          activeLicenses: 0,
          activeApiKeys: 0,
          activeWebhooks: 0,
          onlineAgentRuntimes: 0,
          totalAgentRuntimes: 0,
          totalEvents: 0,
          totalActivity: 0,
          totalTickets: 0,
          totalRevenueCents: 0,
          currency: 'THB',
        },
        posture: {
          expiringSubscriptions: [],
          expiringLicenses: [],
          recentlyRevokedApiKeys: [],
          failedWebhooks: [],
          unresolvedTickets: [],
          offlineAgentRuntimes: [],
        },
        delivery: {
          queueDepth: 0,
          deadLetters: 0,
          failureRatePct: 0,
          lastSyncAt: null,
        },
      },
      tenantFeatureAccess: {
        tenantId,
        package: null,
        features: [],
        enabledFeatureKeys: [],
        featureOverrides: { enabled: [], disabled: [] },
        plan: null,
      },
      tenantConfig: {
        tenantId,
        previewMode: true,
        featureFlags: {},
      },
      opsState: {
        previewMode: true,
      },
      automationState: {
        enabled: false,
      },
      automationConfig: {},
      permissionCatalog: [],
      plans: [],
      packages: [],
      features: [],
    };
  }

  function buildPreviewReconcileFallback(tenantId) {
    return {
      generatedAt: new Date().toISOString(),
      scope: {
        tenantId,
        mode: 'preview-fallback',
      },
      summary: {
        purchases: 0,
        queueJobs: 0,
        deadLetters: 0,
        anomalies: 0,
        abuseFindings: 0,
        windowMs: 3600000,
      },
      anomalies: [],
      abuseFindings: [],
      notes: [
        'ผู้เช่าทดลองรายนี้ยังอยู่ระหว่างจัดเตรียมข้อมูลฝั่ง runtime จึงซ่อนการอ่านข้อมูลหนักไว้ก่อนจนกว่าการจัดเตรียมจะเสร็จ',
      ],
    };
  }

  function buildPreviewTenantConfigFallback(tenantId) {
    return {
      tenantId,
      configPatch: {},
      portalEnvPatch: {},
      featureFlags: {},
      updatedBy: null,
      updatedAt: null,
      previewMode: true,
    };
  }

  function writeTenantIdToUrl(tenantId) {
    const url = new URL(window.location.href);
    if (tenantId) {
      url.searchParams.set('tenantId', tenantId);
    } else {
      url.searchParams.delete('tenantId');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
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

  function renderOwnerTenantSelector(me) {
    const select = selectorNode();
    const wrap = selectorWrapNode();
    if (!select || !wrap) return;
    const isOwner = String(me?.role || '').trim().toLowerCase() === 'owner';
    wrap.hidden = !isOwner;
    if (!isOwner) {
      setTenantScopeMenuOpen(false);
      return;
    }
    select.innerHTML = buildTenantOptionsHtml(state.ownerTenantOptions);
    const currentTenantId = String(state.payload?.tenantId || '').trim();
    if (currentTenantId) {
      select.value = currentTenantId;
    }
    syncTenantScopeControls();
  }

  async function refreshState(options = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    if (!options.silent) {
      setStatus('กำลังโหลดพื้นที่ผู้เช่า...', 'info');
      renderMessageCard('กำลังเตรียมพื้นที่ผู้เช่า', 'กำลังดึงสถานะเซิร์ฟเวอร์ รันไทม์ คำสั่งซื้อ ผู้เล่น และการตั้งค่าที่เกี่ยวข้อง');
    }
    try {
      const me = await api('/admin/api/me', null);
      let scopedTenantId = String(me?.tenantId || '').trim();
      state.ownerTenantOptions = [];

      if (String(me?.role || '').trim().toLowerCase() === 'owner') {
        const tenants = await api('/admin/api/platform/tenants?limit=100', []);
        state.ownerTenantOptions = Array.isArray(tenants) ? tenants : [];
        scopedTenantId = pickPreferredTenantId(state.ownerTenantOptions, readTenantIdFromUrl());
        writeTenantIdToUrl(scopedTenantId);
      }

      if (!scopedTenantId) {
        throw new Error('Tenant scope is required for the tenant admin workspace.');
      }

      const previewTenant = isPreviewTenantId(scopedTenantId);

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
        queueItems,
        deadLetters,
        deliveryLifecycle,
        players,
        notifications,
        deliveryRuntime,
        purchaseStatuses,
        audit,
      ] = await Promise.all([
        previewTenant
          ? Promise.resolve(buildPreviewOverviewFallback(scopedTenantId))
          : api(`/admin/api/platform/overview?tenantId=${encodeURIComponent(scopedTenantId)}`, {}),
        previewTenant
          ? Promise.resolve(buildPreviewReconcileFallback(scopedTenantId))
          : api(`/admin/api/platform/reconcile?tenantId=${encodeURIComponent(scopedTenantId)}&windowMs=3600000&pendingOverdueMs=1200000`, {}),
        api(`/admin/api/platform/quota?tenantId=${encodeURIComponent(scopedTenantId)}`, {}),
        previewTenant
          ? Promise.resolve(buildPreviewTenantConfigFallback(scopedTenantId))
          : api(`/admin/api/platform/tenant-config?tenantId=${encodeURIComponent(scopedTenantId)}`, {}),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/servers?tenantId=${encodeURIComponent(scopedTenantId)}`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/subscriptions?tenantId=${encodeURIComponent(scopedTenantId)}&limit=6`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/licenses?tenantId=${encodeURIComponent(scopedTenantId)}&limit=6`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/apikeys?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/webhooks?tenantId=${encodeURIComponent(scopedTenantId)}&limit=12`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/agents?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/agent-provisioning?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/agent-devices?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/agent-credentials?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []),
        previewTenant ? Promise.resolve([]) : api(`/admin/api/platform/agent-sessions?tenantId=${encodeURIComponent(scopedTenantId)}&limit=40`, []),
        previewTenant ? Promise.resolve(null) : api(`/admin/api/dashboard/cards?tenantId=${encodeURIComponent(scopedTenantId)}`, null),
        previewTenant ? Promise.resolve({ items: [] }) : api(`/admin/api/shop/list?tenantId=${encodeURIComponent(scopedTenantId)}&limit=24`, { items: [] }),
        api(`/admin/api/delivery/queue?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }),
        api(`/admin/api/delivery/dead-letter?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }),
        api(`/admin/api/delivery/lifecycle?tenantId=${encodeURIComponent(scopedTenantId)}&limit=80&pendingOverdueMs=1200000`, {}),
        previewTenant ? Promise.resolve({ items: [] }) : api(`/admin/api/player/accounts?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }),
        api('/admin/api/notifications?acknowledged=false&limit=10', { items: [] }),
        api('/admin/api/delivery/runtime', {}),
        api('/admin/api/purchase/statuses', { knownStatuses: [], allowedTransitions: [] }),
        previewTenant ? Promise.resolve({ items: [] }) : api(`/admin/api/audit/query?tenantId=${encodeURIComponent(scopedTenantId)}&limit=20`, { items: [] }),
      ]);

      const serverRows = Array.isArray(servers) ? servers : [];
      const activeServer = serverRows[0] || null;
      const serverConfigWorkspace = (!previewTenant && activeServer?.id)
        ? await api(
          `/admin/api/platform/servers/${encodeURIComponent(activeServer.id)}/config?tenantId=${encodeURIComponent(scopedTenantId)}`,
          null,
        ).catch(() => null)
        : null;

      const playerRows = Array.isArray(players?.items) ? players.items : [];
      const selectedUserId = readUserIdFromUrl() || pickFirstPlayerId(playerRows);
      const purchaseLookup = (!previewTenant && selectedUserId)
        ? await api(`/admin/api/purchase/list?tenantId=${encodeURIComponent(scopedTenantId)}&userId=${encodeURIComponent(selectedUserId)}&limit=20`, { items: [], userId: selectedUserId, status: '' })
        : { items: [], userId: '', status: '' };
      const selectedCode = readPurchaseCodeFromUrl() || pickFirstPurchaseCode(purchaseLookup?.items);
      const deliveryCase = (!previewTenant && selectedCode)
        ? await api(`/admin/api/delivery/detail?tenantId=${encodeURIComponent(scopedTenantId)}&code=${encodeURIComponent(selectedCode)}&limit=80`, null)
        : null;

      state.payload = {
        me,
        tenantId: scopedTenantId,
        tenantLabel: resolveTenantLabel(scopedTenantId),
        servers: serverRows,
        activeServer,
        serverConfigWorkspace,
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
        queueItems: Array.isArray(queueItems?.items) ? queueItems.items : [],
        deadLetters: Array.isArray(deadLetters?.items) ? deadLetters.items : [],
        deliveryLifecycle,
        players: playerRows,
        notifications: Array.isArray(notifications?.items) ? notifications.items : [],
        deliveryRuntime,
        purchaseStatuses,
        audit,
        purchaseLookup,
        deliveryCase,
      };

      renderOwnerTenantSelector(me);
      const surfaceState = renderCurrentPage();
      setStatus(surfaceState?.notice ? surfaceState.notice.detail : 'พร้อมใช้งาน', surfaceState?.notice ? (surfaceState.notice.tone || 'warning') : 'success');
    } catch (error) {
      renderMessageCard('โหลดพื้นที่ผู้เช่าไม่สำเร็จ', String(error?.message || error));
      setStatus('โหลดข้อมูลผู้เช่าไม่สำเร็จ', 'danger');
    } finally {
      state.refreshing = false;
    }
  }

  function renderCurrentPage() {
    const target = root();
    if (!target) return;
    if (!state.payload) {
      renderMessageCard('ยังไม่มีข้อมูลผู้เช่า', 'รีเฟรชพื้นที่ทำงานหลังจากระบบดึงข้อมูลผู้เช่าล่าสุดเสร็จแล้ว');
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
    const renderers = {
      dashboard: () => window.TenantDashboardV4.renderTenantDashboardV4(target, renderState),
      'server-status': () => window.TenantServerStatusV4.renderTenantServerStatusV4(target, renderState),
      'server-config': () => window.TenantServerConfigV4.renderTenantServerConfigV4(target, renderState),
      orders: () => window.TenantOrdersV4.renderTenantOrdersV4(target, renderState),
      players: () => window.TenantPlayersV4.renderTenantPlayersV4(target, renderState),
      'delivery-agents': () => window.TenantDeliveryAgentsV4.renderTenantDeliveryAgentsV4(target, renderState),
      'server-bots': () => window.TenantServerBotsV4.renderTenantServerBotsV4(target, renderState),
      'restart-control': () => window.TenantRestartControlV4.renderTenantRestartControlV4(target, renderState),
    };
    (renderers[page] || renderers.dashboard)();
    wirePageInteractions(page, renderState, surfaceState);
    if (surfaceState.notice) {
      window.setTimeout(() => {
        setStatus(surfaceState.notice.detail, surfaceState.notice.tone || 'warning');
      }, 0);
    }
    document.title = `SCUM TH Platform | Tenant | ${PAGE_TITLES[page] || 'ภาพรวมงานประจำวัน'}`;
    return surfaceState;
  }

  function setActionButtonBusy(button, busy, label) {
    if (!button) return;
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || '';
    }
    button.disabled = busy;
    button.textContent = busy ? label : button.dataset.originalLabel;
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
    if (!node) return;
    const helpTitle = document.querySelector('[data-server-config-help-title]');
    const helpDescription = document.querySelector('[data-server-config-help-description]');
    const helpMeta = document.querySelector('[data-server-config-help-meta]');
    const badgeRow = helpTitle?.parentElement?.querySelector('.tdv4-config-key-row');
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

  function updateServerConfigSavebar() {
    const changeNode = document.querySelector('[data-server-config-change-count]');
    if (!changeNode) return;
    const changedCount = buildServerConfigChangesFromUi().filter((entry) => entry.changed).length;
    changeNode.textContent = changedCount
      ? `มีค่าที่แก้ค้างอยู่ ${changedCount} จุด`
      : 'ยังไม่มีค่าที่แก้ค้างอยู่';
  }

  function switchServerConfigCategory(categoryKey) {
    const tabs = Array.from(document.querySelectorAll('[data-config-category-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-config-category-panel]'));
    tabs.forEach((tab) => {
      const current = String(tab.getAttribute('data-config-category-tab') || '').trim() === categoryKey;
      tab.classList.toggle('is-current', current);
      tab.setAttribute('aria-pressed', current ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const current = String(panel.getAttribute('data-config-category-panel') || '').trim() === categoryKey;
      panel.hidden = !current;
      panel.classList.toggle('tdv4-config-category-panel-current', current);
    });
    const firstField = document.querySelector(`[data-config-category-panel="${categoryKey}"] [data-server-config-field]`);
    updateServerConfigHelpFromField(firstField);
  }

  function slugifyRuntimeKey(value, fallbackPrefix) {
    const base = String(value || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const safeBase = base || `${fallbackPrefix}-${Date.now()}`;
    return safeBase.length <= 80 ? safeBase : safeBase.slice(0, 80);
  }

  function buildProvisioningInstructions(kind, payload) {
    const bootstrap = payload?.bootstrap || {};
    const setupToken = String(payload?.rawSetupToken || '').trim();
    const runtimeKey = String(bootstrap.runtimeKey || '').trim();
    const platformUrl = `${window.location.protocol}//${window.location.host}`;
    if (!setupToken || !runtimeKey) return null;
    const commonLines = [
      `$env:PLATFORM_API_BASE_URL="${platformUrl}"`,
      `$env:PLATFORM_AGENT_SETUP_TOKEN="${setupToken}"`,
      `$env:PLATFORM_TENANT_ID="${String(bootstrap.tenantId || '').trim()}"`,
      `$env:PLATFORM_SERVER_ID="${String(bootstrap.serverId || '').trim()}"`,
    ];
    if (kind === 'server-bots') {
      return {
        title: 'คำสั่งติดตั้ง Server Bot',
        command: [
          ...commonLines,
          `$env:SCUM_SERVER_BOT_AGENT_ID="${String(bootstrap.agentId || runtimeKey).trim()}"`,
          `$env:SCUM_SERVER_BOT_RUNTIME_KEY="${runtimeKey}"`,
          '$env:SCUM_SERVER_CONFIG_ROOT="C:\\SCUM\\Config"',
          'node C:\\new\\apps\\watcher\\server.js',
        ].join('\n'),
        detail: 'ปรับ SCUM_SERVER_CONFIG_ROOT ให้ตรงกับเครื่องเซิร์ฟเวอร์ก่อนรัน',
      };
    }
    return {
      title: 'คำสั่งติดตั้ง Delivery Agent',
      command: [
        ...commonLines,
        `$env:SCUM_AGENT_ID="${String(bootstrap.agentId || runtimeKey).trim()}"`,
        `$env:SCUM_AGENT_RUNTIME_KEY="${runtimeKey}"`,
        'node C:\\new\\apps\\agent\\server.js',
      ].join('\n'),
      detail: 'รันบนเครื่องที่ใช้ส่งของในเกมและมี SCUM client เปิดอยู่',
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
      configPatch: parseConfigJsonInput(configPatchNode?.value, 'Config Patch', { emptyAsObject: true }),
      portalEnvPatch: parseConfigJsonInput(portalEnvPatchNode?.value, 'Portal Env Patch', { emptyAsObject: true }),
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
    const draft = parseConfigJsonInput(configPatchNode?.value, 'Config Patch', { emptyAsObject: true });
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
    const draft = parseConfigJsonInput(configPatchNode.value, 'Config Patch', { emptyAsObject: true });
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
    const draft = parseConfigJsonInput(portalEnvPatchNode?.value, 'Portal Env Patch', { emptyAsObject: true });
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
    const draft = parseConfigJsonInput(portalEnvPatchNode.value, 'Portal Env Patch', { emptyAsObject: true });
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
        featureFlags: draft.featureFlags,
        configPatch: draft.configPatch,
        portalEnvPatch: draft.portalEnvPatch,
      },
    }, null);
    if (mode === 'restart') {
      setStatus('บันทึกค่าแล้ว กำลังพาไปหน้ารีสตาร์ต', 'warning');
      window.location.hash = '#restart-control';
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
      throw new Error('เลือกเซิร์ฟเวอร์ก่อนสร้าง runtime');
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

  async function queueRuntimeProvisioning(kind, renderState, triggerButton) {
    const serverNode = document.querySelector(`[data-runtime-server-id="${kind}"]`);
    const displayNode = document.querySelector(`[data-runtime-display-name="${kind}"]`);
    const runtimeKeyNode = document.querySelector(`[data-runtime-runtime-key="${kind}"]`);
    const serverId = String(serverNode?.value || '').trim();
    const displayName = String(displayNode?.value || '').trim() || (kind === 'server-bots' ? 'Server Bot' : 'Delivery Agent');
    const runtimeKey = String(runtimeKeyNode?.value || '').trim();
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

  function wireServerConfigPage(renderState, surfaceState) {
    const overrideButtons = Array.from(document.querySelectorAll('[data-config-action]'));
    const saveButtons = Array.from(document.querySelectorAll('[data-server-config-save-mode]'));
    const rollbackButtons = Array.from(document.querySelectorAll('[data-server-config-rollback]'));
    const categoryTabs = Array.from(document.querySelectorAll('[data-config-category-tab]'));
    const fieldNodes = getServerConfigFieldNodes();
    const previewMode = Boolean(surfaceState?.featureAccess?.previewMode);
    const featureFlagsNode = document.getElementById('tdv4-editor-featureFlags');
    const configPatchNode = document.getElementById('tdv4-editor-configPatch');
    const portalEnvPatchNode = document.getElementById('tdv4-editor-portalEnvPatch');

    if (!overrideButtons.length && !saveButtons.length && !fieldNodes.length) return;

    getFeatureFlagToggleNodes().forEach((node) => {
      if (previewMode) {
        node.disabled = true;
      }
      node.addEventListener('change', () => {
        syncFeatureFlagsTextareaFromUi(renderState);
        setStatus('มีการแก้ไขที่ยังไม่บันทึก', 'warning');
      });
    });
    getConfigPatchFieldNodes().forEach((node) => {
      if (previewMode) {
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
      if (previewMode) {
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

    fieldNodes.forEach((node) => {
      if (previewMode) {
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
      if (previewMode) {
        button.disabled = true;
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
      if (previewMode) {
        button.disabled = true;
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
      if (previewMode || !backupId) {
        if (previewMode) {
          button.disabled = true;
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
    if (categoryTabs.length) {
      const currentTab = categoryTabs.find((tab) => tab.classList.contains('is-current')) || categoryTabs[0];
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
    if (!button) return;
    if (Boolean(surfaceState?.featureAccess?.previewMode)) {
      button.disabled = true;
      return;
    }
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

  function wirePageInteractions(page, renderState, surfaceState) {
    if (page === 'server-config') {
      wireServerConfigPage(renderState, surfaceState);
      return;
    }
    if (page === 'delivery-agents') {
      wireRuntimeProvisioningPage('delivery-agents', renderState, surfaceState);
      return;
    }
    if (page === 'server-bots') {
      wireRuntimeProvisioningPage('server-bots', renderState, surfaceState);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.getElementById('tenantV4RefreshBtn');
    const scopeSelect = selectorNode();
    const scopeButton = selectorButtonNode();
    const scopeMenu = selectorMenuNode();
    refreshButton?.addEventListener('click', () => refreshState({ silent: false }));
    scopeSelect?.addEventListener('change', () => {
      syncTenantScopeControls();
      setTenantScopeMenuOpen(false);
      writeTenantIdToUrl(String(scopeSelect.value || '').trim());
      refreshState({ silent: false });
    });
    scopeButton?.addEventListener('click', () => {
      const nextOpen = scopeButton.getAttribute('aria-expanded') !== 'true';
      setTenantScopeMenuOpen(nextOpen);
      if (nextOpen) {
        window.requestAnimationFrame(() => focusCurrentTenantScopeOption());
      }
    });
    scopeButton?.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      setTenantScopeMenuOpen(true);
      window.requestAnimationFrame(() => focusCurrentTenantScopeOption());
    });
    scopeMenu?.addEventListener('click', (event) => {
      const option = event.target.closest('.surface-combobox-option[data-value]');
      if (!option || !scopeSelect) return;
      const nextValue = String(option.getAttribute('data-value') || '').trim();
      if (!nextValue) return;
      if (scopeSelect.value !== nextValue) {
        scopeSelect.value = nextValue;
        scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      syncTenantScopeControls();
      setTenantScopeMenuOpen(false);
    });
    document.addEventListener('click', (event) => {
      const wrap = selectorWrapNode();
      if (!wrap?.contains(event.target)) {
        setTenantScopeMenuOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setTenantScopeMenuOpen(false);
        scopeButton?.focus();
      }
    });
    window.addEventListener('hashchange', () => {
      const surfaceState = renderCurrentPage();
      if (!surfaceState?.notice) {
        setStatus('พร้อมใช้งาน', 'success');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshState({ silent: true });
    });
    window.setInterval(() => {
      if (!document.hidden) refreshState({ silent: true });
    }, 60000);
    refreshState({ silent: false });
  });
})();
