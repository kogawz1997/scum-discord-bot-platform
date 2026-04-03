(function () {
  'use strict';

  const PLAYER_PAGE_KEYS = window.PlayerControlV4?.PLAYER_PAGE_KEYS || [
    'home',
    'stats',
    'leaderboard',
    'shop',
    'orders',
    'delivery',
    'events',
    'donations',
    'profile',
    'support',
  ];

  const PAGE_TITLE_LABELS = {
    home: 'หน้าหลัก',
    stats: 'สถิติ',
    leaderboard: 'อันดับ',
    shop: 'ร้านค้า',
    orders: 'คำสั่งซื้อ',
    delivery: 'การส่งของ',
    events: 'กิจกรรม',
    donations: 'สนับสนุนเซิร์ฟเวอร์',
    profile: 'โปรไฟล์',
    support: 'ช่วยเหลือ',
  };

  const state = {
    payload: null,
    refreshing: false,
  };

  function t(key, fallback, params) {
    return window.PortalUiI18n?.t?.(key, fallback, params) || fallback || key;
  }

  function applyI18n(rootNode = document) {
    window.PortalUiI18n?.apply?.(rootNode);
  }

  function applyPlayerBranding(branding) {
    const rootStyle = document.documentElement?.style;
    if (!rootStyle) return;
    const tokens = branding?.themeTokens && typeof branding.themeTokens === 'object'
      ? branding.themeTokens
      : {};
    const assign = (name, value) => {
      if (value) {
        rootStyle.setProperty(name, String(value));
        return;
      }
      rootStyle.removeProperty(name);
    };
    assign('--plv4-accent', tokens.primary || branding?.primaryColor || null);
    assign('--plv4-surface', tokens.surface || null);
    assign('--plv4-surface-soft', tokens.surface || null);
    assign('--plv4-text', tokens.text || null);
    assign('--plv4-media-image', branding?.bannerUrl ? `url("${String(branding.bannerUrl).replace(/"/g, '\\"')}")` : null);
    if (document.body) {
      document.body.dataset.playerBrandTheme = String(branding?.theme || 'default');
    }
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
    return document.getElementById('playerV4AppRoot');
  }

  function statusNode() {
    return document.getElementById('playerV4Status');
  }

  function serverSelectNode() {
    return document.getElementById('playerServerSelect');
  }

  function setStatus(message, tone) {
    const node = statusNode();
    if (!node) return;
    node.textContent = String(message || '').trim();
    node.dataset.tone = tone || 'muted';
  }

  function buildServerOptionLabel(item) {
    const name = String(item?.name || item?.label || item?.id || '').trim() || 'Server';
    const status = String(item?.status || '').trim().toLowerCase();
    if (status === 'active') return name;
    return `${name} (${status || 'inactive'})`;
  }

  function renderServerSelector(serverScope) {
    const node = serverSelectNode();
    if (!node) return;
    const items = Array.isArray(serverScope?.items) ? serverScope.items : [];
    const activeServerId = String(serverScope?.activeServerId || '').trim();
    const selectionRequired = serverScope?.selectionRequired === true;
    const effectiveServerName = String(
      serverScope?.activeServerName
      || serverScope?.effectiveServerName
      || '',
    ).trim();

    if (!items.length) {
      node.innerHTML = '<option value="">No server</option>';
      node.disabled = true;
      node.title = 'No server is registered for this player scope yet';
      return;
    }

    const parts = [];
    if (selectionRequired) {
      parts.push('<option value="">Choose server</option>');
    }
    for (const item of items) {
      const id = String(item?.id || '').trim();
      if (!id) continue;
      parts.push(
        `<option value="${escapeHtml(id)}">${escapeHtml(buildServerOptionLabel(item))}</option>`,
      );
    }
    node.innerHTML = parts.join('');
    node.disabled = state.refreshing || items.length === 0;
    node.value = activeServerId || (selectionRequired ? '' : String(items[0]?.id || '').trim());
    node.title = effectiveServerName
      ? `Current server: ${effectiveServerName}`
      : 'Select the player server scope';
  }

  function renderMessageCard(title, detail) {
    const target = root();
    if (!target) return;
    target.innerHTML = [
      '<section style="padding:32px;border:1px solid rgba(212,186,113,.18);border-radius:24px;background:rgba(13,17,14,.92);box-shadow:0 24px 56px rgba(0,0,0,.28)">',
      `<h1 style="margin:0 0 12px;font:700 32px/1.05 'IBM Plex Sans Thai','Segoe UI',sans-serif;color:#f4efe4">${escapeHtml(title)}</h1>`,
      `<p style="margin:0;color:rgba(244,239,228,.74);font:400 15px/1.7 'IBM Plex Sans Thai','Segoe UI',sans-serif">${escapeHtml(detail)}</p>`,
      '</section>',
    ].join('');
  }

  function humanizeErrorCode(code) {
    const text = String(code || '').trim();
    if (!text) return '';
    return text
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function extractPlayerErrorMessage(payload, response) {
    const errorCode = String(payload?.error || '').trim().toLowerCase();
    if (errorCode === 'daily-cooldown' && payload?.data?.remainingText) {
      return `รางวัลรายวันยังติดคูลดาวน์ (${payload.data.remainingText} คงเหลือ)`;
    }
    if (errorCode === 'weekly-cooldown' && payload?.data?.remainingText) {
      return `รางวัลรายสัปดาห์ยังติดคูลดาวน์ (${payload.data.remainingText} คงเหลือ)`;
    }
    return String(
      payload?.data?.message
      || payload?.data?.detail
      || payload?.message
      || humanizeErrorCode(payload?.error)
      || `คำขอล้มเหลว (${response.status})`,
    );
  }

  async function apiRequest(path, options = {}, fallback) {
    const method = String(options?.method || 'GET').trim().toUpperCase() || 'GET';
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      if (response.status === 401) {
        window.location.href = '/player/login';
        return fallback;
      }
      throw new Error(extractPlayerErrorMessage(payload, response));
    }
    return payload?.data ?? fallback;
  }

  async function api(path, fallback) {
    return apiRequest(path, {}, fallback);
  }

  function safePlayerRead(path, fallback, warnings, label) {
    return api(path, fallback).catch(() => {
      if (Array.isArray(warnings) && label) {
        warnings.push(label);
      }
      return fallback;
    });
  }

  function applyPlayerSurfaceStatus(surfaceState) {
    if (surfaceState?.notice) {
      setStatus(surfaceState.notice.detail, surfaceState.notice.tone || 'warning');
      return;
    }
    if (state.payload?.serverScope?.selectionRequired) {
      setStatus('Choose the player server you want to view before continuing with live data changes', 'warning');
      return;
    }
    if (!state.payload || state.refreshing) return;
    const warningCount = Array.isArray(state.payload.__loadWarnings)
      ? state.payload.__loadWarnings.length
      : 0;
    if (warningCount > 0) {
      setStatus(`พร้อมใช้งาน แต่ยังมี ${warningCount} ส่วนที่โหลดช้ากว่าปกติ`, 'warning');
      return;
    }
    if (warningCount > 0) {
      setStatus(`โหลดข้อมูลผู้เล่นได้บางส่วน (${warningCount} แหล่งข้อมูลยังไม่พร้อม)`, 'warning');
      return;
    }
    setStatus(t('player.app.status.ready', 'พร้อมใช้งาน'), 'success');
  }

  function currentPage() {
    return resolvePlayerPageKey(getRawPathRoute());
  }

  function getRawPathRoute() {
    const path = String(window.location.pathname || '').trim().toLowerCase();
    if (!path.startsWith('/player')) return '';
    const relative = path.slice('/player'.length).replace(/^\/+/, '');
    return relative.split('/')[0] || '';
  }

  function resolvePlayerPageKey(rawTarget) {
    if (typeof window.PlayerControlV4?.resolvePlayerPageKey === 'function') {
      return window.PlayerControlV4.resolvePlayerPageKey(rawTarget);
    }
    const normalized = String(rawTarget || '').trim().toLowerCase();
    return PLAYER_PAGE_KEYS.includes(normalized) ? normalized : 'home';
  }

  function buildCanonicalPlayerPath(pageKey) {
    if (typeof window.PlayerControlV4?.buildCanonicalPlayerPath === 'function') {
      return window.PlayerControlV4.buildCanonicalPlayerPath(pageKey);
    }
    return `/player/${PLAYER_PAGE_KEYS.includes(pageKey) ? pageKey : 'home'}`;
  }

  function isKnownPlayerRouteAlias(rawTarget) {
    const normalized = String(rawTarget || '').trim().toLowerCase();
    return [
      '',
      'player',
      'home',
      'shop',
      'wallet',
      'cart',
      'commerce',
      'orders',
      'delivery',
      'donations',
      'stats',
      'leaderboard',
      'leaderboards',
      'activity',
      'events',
      'support',
      'profile',
    ].includes(normalized);
  }

  function bootstrapLegacyPlayerRoute() {
    const rawHash = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!isKnownPlayerRouteAlias(rawHash)) return;
    const canonicalPath = buildCanonicalPlayerPath(resolvePlayerPageKey(rawHash));
    window.history.replaceState({}, '', `${canonicalPath}${window.location.search || ''}`);
  }

  function canonicalizePlayerLinks(scopeNode) {
    const rootNode = scopeNode instanceof Element ? scopeNode : document;
    rootNode.querySelectorAll('a[href^="#"], a[href^="/player/"]').forEach((link) => {
      const target = String(link.getAttribute('href') || '').trim();
      if (!target || target === '#') return;
      const rawTarget = target.startsWith('/player/')
        ? target.slice('/player/'.length).split('/')[0]
        : target.replace(/^#/, '');
      if (target.startsWith('#') && !isKnownPlayerRouteAlias(rawTarget)) return;
      const pageKey = resolvePlayerPageKey(rawTarget);
      const canonicalPath = buildCanonicalPlayerPath(pageKey);
      if (canonicalPath && target !== canonicalPath) {
        link.setAttribute('href', canonicalPath);
      }
    });
  }

  function navigatePlayerRoute(nextTarget) {
    const rawTarget = String(nextTarget || '').trim();
    if (!rawTarget || rawTarget === '#') return;
    const pageKey = rawTarget.startsWith('/player/')
      ? resolvePlayerPageKey(rawTarget.slice('/player/'.length).split('/')[0])
      : resolvePlayerPageKey(rawTarget.replace(/^#/, ''));
    const canonicalPath = buildCanonicalPlayerPath(pageKey);
    if (window.location.pathname !== canonicalPath) {
      window.history.pushState({}, '', `${canonicalPath}${window.location.search || ''}`);
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
      return;
    }
    const surfaceState = renderCurrentPage();
    applyPlayerSurfaceStatus(surfaceState);
  }

  function isSectionEnabled(featureAccess, key) {
    return Boolean(featureAccess?.sections?.[key]?.enabled);
  }

  function hasAnyFeature(featureAccess, featureKeys) {
    const enabled = Array.isArray(featureAccess?.enabledFeatureKeys)
      ? featureAccess.enabledFeatureKeys
      : [];
    const featureSet = new Set(enabled.map((value) => String(value || '').trim()).filter(Boolean));
    return (Array.isArray(featureKeys) ? featureKeys : [featureKeys]).some((key) => featureSet.has(String(key || '').trim()));
  }

  function buildPlayerSurfaceState(featureAccess, requestedPage) {
    const resolvedPage = PLAYER_PAGE_KEYS.includes(requestedPage) ? requestedPage : 'home';
    const navGroups = typeof window.PlayerControlV4?.createPlayerPortalNavGroups === 'function'
      ? window.PlayerControlV4.createPlayerPortalNavGroups(resolvedPage, featureAccess)
      : [];
    const accessEntry = featureAccess?.sections?.[resolvedPage] || null;
    const notice = accessEntry && accessEntry.enabled === false
      ? {
          tone: 'warning',
          title: t('player.notice.lockedTitle', `${PAGE_TITLE_LABELS[resolvedPage] || 'This area'} is not open on this server yet`),
          detail: t(
            'player.notice.lockedDetail',
            'You can still open this page, but the current server package has not enabled the live features behind it yet.',
          ),
        }
      : null;

    return {
      resolvedPage,
      navGroups,
      notice,
    };
  }

  async function refreshState(options = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    const loadWarnings = [];
    if (!options.silent) {
      setStatus(t('player.app.status.loading', 'กำลังโหลดข้อมูลผู้เล่น...'), 'info');
      renderMessageCard(
        t('player.app.card.loadingTitle', 'กำลังเตรียมข้อมูลผู้เล่น'),
        t('player.app.card.loadingDetail', 'กำลังโหลดบัญชี ร้านค้า คำสั่งซื้อ และอัปเดตของชุมชน'),
      );
    }
    try {
      const [
        me,
        serverScope,
        featureAccess,
        dashboard,
        serverInfo,
        profile,
        steamLink,
        linkHistory,
        notifications,
        party,
      ] = await Promise.all([
        api('/player/api/me', {}),
        safePlayerRead('/player/api/servers', {
          items: [],
          count: 0,
          activeServerId: null,
          activeServerName: null,
          effectiveServerId: null,
          effectiveServerName: null,
          selectionRequired: false,
        }, loadWarnings, 'servers'),
        safePlayerRead('/player/api/feature-access', {
          enabledFeatureKeys: [],
          sections: {},
          pages: {},
        }, loadWarnings, 'feature-access'),
        safePlayerRead('/player/api/dashboard', {}, loadWarnings, 'dashboard'),
        safePlayerRead('/player/api/server/info', {}, loadWarnings, 'server-info'),
        safePlayerRead('/player/api/profile', {}, loadWarnings, 'profile'),
        safePlayerRead('/player/api/linksteam/me', {}, loadWarnings, 'steam-link'),
        safePlayerRead('/player/api/linksteam/history', { items: [] }, loadWarnings, 'steam-link-history'),
        safePlayerRead('/player/api/notifications?limit=10', [], loadWarnings, 'notifications'),
        safePlayerRead('/player/api/party', {}, loadWarnings, 'party'),
      ]);

      const [
        walletLedger,
        shopItems,
        cart,
        orders,
        redeemHistory,
        stats,
        leaderboard,
        missions,
        bounties,
        wheelState,
        raids,
        killfeed,
        supportTickets,
      ] = await Promise.all([
        hasAnyFeature(featureAccess, ['wallet_module'])
          ? safePlayerRead('/player/api/wallet/ledger?limit=20', { wallet: {}, items: [] }, loadWarnings, 'wallet-ledger')
          : Promise.resolve({ wallet: {}, items: [], locked: true }),
        isSectionEnabled(featureAccess, 'shop') || isSectionEnabled(featureAccess, 'donations')
          ? safePlayerRead('/player/api/shop/list?limit=80', [], loadWarnings, 'shop-items')
          : Promise.resolve({ items: [], locked: true }),
        isSectionEnabled(featureAccess, 'shop') || isSectionEnabled(featureAccess, 'donations')
          ? safePlayerRead('/player/api/cart', {}, loadWarnings, 'cart')
          : Promise.resolve({ rows: [], missingItemIds: [], totalUnits: 0, totalPrice: 0, locked: true }),
        isSectionEnabled(featureAccess, 'orders') || isSectionEnabled(featureAccess, 'delivery')
          ? safePlayerRead('/player/api/purchase/list?limit=25&includeHistory=1', [], loadWarnings, 'orders')
          : Promise.resolve({ items: [], locked: true }),
        isSectionEnabled(featureAccess, 'orders') || isSectionEnabled(featureAccess, 'delivery')
          ? safePlayerRead('/player/api/redeem/history?limit=20', [], loadWarnings, 'redeem-history')
          : Promise.resolve({ items: [], locked: true }),
        isSectionEnabled(featureAccess, 'stats')
          ? safePlayerRead('/player/api/stats/me', {}, loadWarnings, 'stats')
          : Promise.resolve({ locked: true }),
        isSectionEnabled(featureAccess, 'leaderboard')
          ? safePlayerRead('/player/api/leaderboard?type=kills&limit=20', {}, loadWarnings, 'leaderboard')
          : Promise.resolve({ items: [], locked: true }),
        isSectionEnabled(featureAccess, 'events')
          ? safePlayerRead('/player/api/missions', {}, loadWarnings, 'missions')
          : Promise.resolve({ missions: [], locked: true }),
        isSectionEnabled(featureAccess, 'events')
          ? safePlayerRead('/player/api/bounty/list?limit=10', { items: [] }, loadWarnings, 'bounties')
          : Promise.resolve({ items: [], locked: true }),
        isSectionEnabled(featureAccess, 'events')
          ? safePlayerRead('/player/api/wheel/state?limit=10', {}, loadWarnings, 'wheel-state')
          : Promise.resolve({ enabled: false, history: [], locked: true }),
        isSectionEnabled(featureAccess, 'events')
          ? safePlayerRead('/player/api/raids', {}, loadWarnings, 'raids')
          : Promise.resolve({ myRequests: [], windows: [], summaries: [], locked: true }),
        isSectionEnabled(featureAccess, 'events')
          ? safePlayerRead('/player/api/killfeed?limit=20', { items: [] }, loadWarnings, 'killfeed')
          : Promise.resolve({ items: [], locked: true }),
        isSectionEnabled(featureAccess, 'support')
          ? safePlayerRead('/player/api/support/tickets', { items: [], total: 0, openItem: null }, loadWarnings, 'support-tickets')
          : Promise.resolve({ items: [], total: 0, openItem: null, locked: true }),
      ]);

      state.payload = {
        me,
        branding: me?.branding || null,
        serverScope,
        featureAccess,
        dashboard,
        serverInfo,
        walletLedger,
        shopItems: Array.isArray(shopItems?.items) ? shopItems.items : (Array.isArray(shopItems) ? shopItems : []),
        cart,
        orders: Array.isArray(orders?.items) ? orders.items : (Array.isArray(orders) ? orders : []),
        redeemHistory: Array.isArray(redeemHistory?.items) ? redeemHistory.items : (Array.isArray(redeemHistory) ? redeemHistory : []),
        profile,
        steamLink,
        linkHistory,
        notifications: Array.isArray(notifications?.items) ? notifications.items : (Array.isArray(notifications) ? notifications : []),
        stats,
        leaderboard,
        missions,
        bounties,
        wheelState,
        raids,
        killfeed: Array.isArray(killfeed?.items) ? killfeed.items : (Array.isArray(killfeed) ? killfeed : []),
        supportTickets: Array.isArray(supportTickets?.items) ? supportTickets.items : [],
        supportOpenTicket: supportTickets?.openItem && typeof supportTickets.openItem === 'object'
          ? supportTickets.openItem
          : null,
        party,
        lastRefreshedAt: new Date().toISOString(),
        __loadWarnings: loadWarnings,
      };
      renderServerSelector(serverScope);
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
    } catch (error) {
      renderMessageCard(
        t('player.app.card.loadFailedTitle', 'โหลดพอร์ทัลผู้เล่นไม่สำเร็จ'),
        String(error?.message || error),
      );
      setStatus(t('player.app.status.loadFailed', 'โหลดไม่สำเร็จ'), 'danger');
    } finally {
      state.refreshing = false;
    }
  }

  function renderCurrentPage() {
    const target = root();
    if (!target) return null;
    if (!state.payload) {
      renderMessageCard(
        t('player.app.card.emptyTitle', 'No player data yet'),
        t('player.app.card.emptyDetail', 'Wait for the latest player data to load.'),
      );
      return null;
    }

    const requestedPage = currentPage();
    const surfaceState = buildPlayerSurfaceState(state.payload.featureAccess, requestedPage);
    const renderState = {
      ...state.payload,
      __surfaceShell: {
        navGroups: surfaceState.navGroups,
        serverScope: state.payload.serverScope || null,
      },
      __surfaceNotice: surfaceState.notice,
    };
    const page = surfaceState.resolvedPage;
    document.body.dataset.playerPage = page;
    document.body.dataset.playerRoute = requestedPage || page;
    const canonicalPath = buildCanonicalPlayerPath(page);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', `${canonicalPath}${window.location.search || ''}`);
    }
    const model = window.PlayerControlV4?.renderPlayerControlV4
      ? window.PlayerControlV4.renderPlayerControlV4(target, renderState, { page })
      : window.PlayerHomeV4.renderPlayerHomeV4(target, renderState);
    applyPlayerBranding(state.payload.branding || null);
    applyI18n(target);
    canonicalizePlayerLinks(target);
    document.title = `${String(state.payload.branding?.siteName || 'SCUM TH Platform')} | Player | ${String(model?.pageTitle || PAGE_TITLE_LABELS[page] || 'หน้าแรก')}`;
    return surfaceState;
  }

  function setActionBusy(control, busy, busyLabel) {
    if (!control) return;
    if (!control.dataset.originalLabel) {
      control.dataset.originalLabel = control.textContent || '';
    }
    control.disabled = Boolean(busy);
    control.textContent = busy ? String(busyLabel || 'กำลังทำงาน...') : control.dataset.originalLabel;
  }

  async function runPlayerAction(control, busyLabel, work) {
    setActionBusy(control, true, busyLabel);
    try {
      return await work();
    } finally {
      setActionBusy(control, false);
    }
  }

  async function completePlayerAction(message, options = {}) {
    await refreshState({ silent: true });
    if (options?.navigateTo) {
      navigatePlayerRoute(buildCanonicalPlayerPath(resolvePlayerPageKey(options.navigateTo)));
    } else {
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
    }
    setStatus(String(message || 'เสร็จแล้ว'), 'success');
  }

  async function handlePlayerServerSelection(selectNode) {
    if (!selectNode) return;
    const serverId = String(selectNode.value || '').trim();
    if (!serverId) {
      setStatus('Choose a server before continuing', 'warning');
      return;
    }
    selectNode.disabled = true;
    try {
      const result = await apiRequest('/player/api/session/server', {
        method: 'POST',
        body: { serverId },
      }, null);
      await refreshState({ silent: true });
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
      setStatus(
        String(result?.message || `Now viewing ${result?.activeServerName || serverId}`),
        'success',
      );
    } finally {
      renderServerSelector(state.payload?.serverScope || null);
    }
  }

  async function handlePlayerActionClick(button) {
    if (!button) return;
    if (button.hasAttribute('data-player-cart-add')) {
      const itemId = String(button.getAttribute('data-player-cart-add') || '').trim();
      if (!itemId) return;
      await runPlayerAction(button, 'กำลังเพิ่ม...', async () => {
        const result = await apiRequest('/player/api/cart/add', {
          method: 'POST',
          body: { itemId, quantity: 1 },
        }, null);
        await completePlayerAction(result?.message || 'เพิ่มรายการลงตะกร้าแล้ว');
      });
      return;
    }

    if (button.hasAttribute('data-player-cart-remove')) {
      const itemId = String(button.getAttribute('data-player-cart-remove') || '').trim();
      const quantity = Number(button.getAttribute('data-player-cart-remove-quantity') || '1');
      if (!itemId) return;
      await runPlayerAction(button, 'กำลังลบ...', async () => {
        const result = await apiRequest('/player/api/cart/remove', {
          method: 'POST',
          body: {
            itemId,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          },
        }, null);
        await completePlayerAction(result?.message || 'นำรายการออกจากตะกร้าแล้ว');
      });
      return;
    }

    if (button.hasAttribute('data-player-cart-clear')) {
      await runPlayerAction(button, 'กำลังล้าง...', async () => {
        await apiRequest('/player/api/cart/clear', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction('ล้างตะกร้าแล้ว');
      });
      return;
    }

    if (button.hasAttribute('data-player-cart-checkout')) {
      await runPlayerAction(button, 'กำลังสั่งซื้อ...', async () => {
        const result = await apiRequest('/player/api/cart/checkout', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(
          Array.isArray(result?.purchases) && result.purchases.length
            ? `สั่งซื้อเรียบร้อยแล้ว (${result.purchases.length} คำสั่งซื้อ)`
            : (result?.message || 'สั่งซื้อเรียบร้อยแล้ว'),
          { navigateTo: 'orders' },
        );
      });
      return;
    }

    if (button.hasAttribute('data-player-reward-claim')) {
      const rewardKind = String(button.getAttribute('data-player-reward-claim') || '').trim().toLowerCase();
      if (!['daily', 'weekly'].includes(rewardKind)) return;
      await runPlayerAction(button, rewardKind === 'weekly' ? 'กำลังรับรางวัลรายสัปดาห์...' : 'กำลังรับรางวัลรายวัน...', async () => {
        const result = await apiRequest(`/player/api/${rewardKind}/claim`, {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(result?.message || `${rewardKind === 'weekly' ? 'รับรางวัลรายสัปดาห์แล้ว' : 'รับรางวัลรายวันแล้ว'}`);
      });
      return;
    }

    if (button.hasAttribute('data-player-email-verification-request')) {
      await runPlayerAction(button, 'Sending verification email...', async () => {
        const result = await apiRequest('/player/api/profile/email-verification/request', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(
          result?.alreadyVerified
            ? (result?.message || 'Email is already verified.')
            : (result?.message || 'Email verification was queued for this account.'),
          { navigateTo: 'profile' },
        );
      });
      return;
    }

    if (button.hasAttribute('data-player-support-ticket-close')) {
      const channelId = String(button.getAttribute('data-player-support-ticket-close') || '').trim();
      if (!channelId) return;
      await runPlayerAction(button, 'กำลังปิดคำขอช่วยเหลือ...', async () => {
        const result = await apiRequest('/player/api/support/tickets/close', {
          method: 'POST',
          body: { channelId },
        }, null);
        await completePlayerAction(result?.message || 'ปิดคำขอช่วยเหลือแล้ว', { navigateTo: 'support' });
      });
      return;
    }

  }

  async function handlePlayerFormSubmit(form) {
    if (!form) return;
    if (form.hasAttribute('data-player-redeem-form')) {
      const code = String(form.elements.code?.value || '').trim();
      if (!code) {
        setStatus('กรอกโค้ดก่อนส่งแบบฟอร์ม', 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, 'กำลังใช้โค้ด...', async () => {
        const result = await apiRequest('/player/api/redeem', {
          method: 'POST',
          body: { code },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || 'ใช้โค้ดเรียบร้อยแล้ว');
      });
      return;
    }

    if (form.hasAttribute('data-player-steam-link-form')) {
      const steamId = String(form.elements.steamId?.value || '').trim();
      if (!steamId) {
        setStatus('กรอก SteamID ก่อนส่งแบบฟอร์ม', 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, 'กำลังเชื่อม Steam...', async () => {
        const result = await apiRequest('/player/api/linksteam/set', {
          method: 'POST',
          body: { steamId },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || 'เชื่อม SteamID เรียบร้อยแล้ว');
      });
      return;
    }

    if (form.hasAttribute('data-player-raid-request-form')) {
      const requestText = String(form.elements.requestText?.value || '').trim();
      const preferredWindow = String(form.elements.preferredWindow?.value || '').trim();
      if (!requestText) {
        setStatus('Describe the raid request before submitting the form', 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, 'Submitting raid request...', async () => {
        const result = await apiRequest('/player/api/raids/request', {
          method: 'POST',
          body: {
            requestText,
            preferredWindow,
          },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || 'Raid request submitted');
      });
      return;
    }

    if (form.hasAttribute('data-player-support-ticket-form')) {
      const reason = String(form.elements.reason?.value || '').trim();
      if (reason.length < 10) {
        setStatus('อธิบายปัญหาอย่างน้อย 10 ตัวอักษรก่อนส่งคำขอช่วยเหลือ', 'warning');
        return;
      }
      const category = String(form.elements.category?.value || 'player-support').trim() || 'player-support';
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, 'กำลังส่งคำขอช่วยเหลือ...', async () => {
        const result = await apiRequest('/player/api/support/tickets', {
          method: 'POST',
          body: {
            category,
            reason,
          },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || 'ส่งคำขอช่วยเหลือแล้ว', { navigateTo: 'support' });
      });
      return;
    }

    if (form.hasAttribute('data-player-support-appeal-form')) {
      const reason = String(form.elements.reason?.value || '').trim();
      if (reason.length < 10) {
        setStatus('Please describe the appeal in at least 10 characters before submitting', 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, 'Submitting appeal...', async () => {
        const result = await apiRequest('/player/api/support/tickets', {
          method: 'POST',
          body: {
            category: 'appeal',
            reason,
          },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || 'Appeal submitted', { navigateTo: 'support' });
      });
      return;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const refreshButton = document.getElementById('playerV4RefreshBtn');
    const serverSelect = serverSelectNode();
    renderServerSelector(null);
    refreshButton?.addEventListener('click', () => refreshState({ silent: false }));
    serverSelect?.addEventListener('change', () => {
      handlePlayerServerSelection(serverSelect).catch((error) => {
        renderServerSelector(state.payload?.serverScope || null);
        setStatus(String(error?.message || error || 'Failed to switch player server'), 'danger');
      });
    });
    document.addEventListener('submit', (event) => {
      const form = event.target instanceof HTMLFormElement
        ? event.target
        : null;
      if (!form) return;
      if (
        !form.hasAttribute('data-player-redeem-form')
        && !form.hasAttribute('data-player-steam-link-form')
        && !form.hasAttribute('data-player-raid-request-form')
        && !form.hasAttribute('data-player-support-ticket-form')
        && !form.hasAttribute('data-player-support-appeal-form')
      ) {
        return;
      }
      event.preventDefault();
      handlePlayerFormSubmit(form).catch((error) => {
        setStatus(String(error?.message || error || 'ทำรายการของผู้เล่นไม่สำเร็จ'), 'danger');
      });
    });
    document.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-player-cart-add],[data-player-cart-remove],[data-player-cart-clear],[data-player-cart-checkout],[data-player-reward-claim],[data-player-email-verification-request],[data-player-support-ticket-close]')
        : null;
      if (!button) return;
      event.preventDefault();
      handlePlayerActionClick(button).catch((error) => {
        setStatus(String(error?.message || error || 'ทำรายการของผู้เล่นไม่สำเร็จ'), 'danger');
      });
    });
    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element
        ? event.target.closest('a[href^="#"], a[href^="/player/"]')
        : null;
      if (!link) return;
      const target = String(link.getAttribute('href') || '').trim();
      if (!target || target === '#') return;
      if (target.startsWith('#') && !isKnownPlayerRouteAlias(target.replace(/^#/, ''))) return;
      navigatePlayerRoute(target);
      event.preventDefault();
    });
    window.addEventListener('popstate', () => {
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshState({ silent: true });
    });
    window.addEventListener('ui-language-change', () => {
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
    });
    window.setInterval(() => {
      if (!document.hidden) refreshState({ silent: true });
    }, 60000);
    bootstrapLegacyPlayerRoute();
    refreshState({ silent: false });
  });
})();
