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
    pendingSupportDraft: null,
  };

  function t(key, fallback, params) {
    return window.PortalUiI18n?.t?.(key, fallback, params) || fallback || key;
  }

  function applyI18n(rootNode = document) {
    window.PortalUiI18n?.apply?.(rootNode);
  }

  function pageTitleLabel(pageKey) {
    const page = PLAYER_PAGE_KEYS.includes(pageKey) ? pageKey : 'home';
    const keyMap = {
      home: 'common.home',
      stats: 'player.nav.stats',
      leaderboard: 'player.nav.leaderboard',
      shop: 'common.shop',
      orders: 'common.orders',
      delivery: 'player.nav.delivery',
      events: 'player.nav.events',
      donations: 'player.nav.donations',
      profile: 'common.profile',
      support: 'player.nav.support',
    };
    return t(keyMap[page] || 'common.home', PAGE_TITLE_LABELS[page] || 'Home');
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
    const name = String(item?.name || item?.label || item?.id || '').trim() || t('player.app.server.defaultName', 'Server');
    const status = String(item?.status || '').trim().toLowerCase();
    if (status === 'active') return name;
    return t('player.app.server.optionWithStatus', '{name} ({status})', {
      name,
      status: status || t('player.app.server.inactive', 'inactive'),
    });
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
      node.innerHTML = `<option value="">${escapeHtml(t('player.app.server.noneOption', 'No server'))}</option>`;
      node.disabled = true;
      node.title = t('player.app.server.noneTitle', 'No playable server is linked to this player scope yet');
      return;
    }

    const parts = [];
    if (selectionRequired) {
      parts.push(`<option value="">${escapeHtml(t('player.app.server.chooseOption', 'Choose server'))}</option>`);
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
      ? t('player.app.server.currentTitle', 'Current server: {name}', { name: effectiveServerName })
      : t('player.app.server.selectTitle', 'Select the player server scope');
  }

  function applyPendingSupportDraft() {
    if (!state.pendingSupportDraft) return false;
    const form = document.querySelector('[data-player-support-ticket-form]');
    if (!(form instanceof HTMLFormElement)) return false;
    const categoryField = form.elements.category;
    const reasonField = form.elements.reason;
    if (categoryField && typeof categoryField.value === 'string') {
      categoryField.value = String(state.pendingSupportDraft.category || 'identity').trim().toLowerCase() || 'identity';
    }
    if (reasonField && typeof reasonField.value === 'string') {
      reasonField.value = String(state.pendingSupportDraft.reason || '').trim();
      reasonField.focus?.();
      reasonField.setSelectionRange?.(reasonField.value.length, reasonField.value.length);
    }
    setStatus('Identity support context loaded from your profile. Review it and submit when ready.', 'info');
    state.pendingSupportDraft = null;
    return true;
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
      return t('player.app.error.dailyCooldown', 'Daily reward is still on cooldown ({remaining})', {
        remaining: payload.data.remainingText,
      });
    }
    if (errorCode === 'weekly-cooldown' && payload?.data?.remainingText) {
      return t('player.app.error.weeklyCooldown', 'Weekly reward is still on cooldown ({remaining})', {
        remaining: payload.data.remainingText,
      });
    }
    return String(
      payload?.data?.message
      || payload?.data?.detail
      || payload?.message
      || humanizeErrorCode(payload?.error)
      || t('player.app.error.requestFailed', 'Action failed ({status})', { status: response.status }),
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
      setStatus(
        t(
          'player.app.status.chooseServerForChanges',
          'Choose the player server you want to view before continuing with live data changes',
        ),
        'warning',
      );
      return;
    }
    if (!state.payload || state.refreshing) return;
    const warningCount = Array.isArray(state.payload.__loadWarnings)
      ? state.payload.__loadWarnings.length
      : 0;
    if (warningCount > 0) {
      setStatus(
        t('player.app.status.partialWarnings', 'Player data loaded only partially ({count} sources are still unavailable)', { count: warningCount }),
        'warning',
      );
      return;
    }
    setStatus(t('player.app.status.ready', 'Ready'), 'success');
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
          title: t('player.notice.lockedTitle', '{area} is not open on this server yet', {
            area: PAGE_TITLE_LABELS[resolvedPage] || t('player.notice.thisArea', 'This area'),
          }),
          detail: t(
            'player.notice.lockedDetail',
            'You can still browse this page, but the current server package has not enabled the live features behind it yet.',
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
        supporters,
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
        isSectionEnabled(featureAccess, 'donations')
          ? safePlayerRead('/player/api/supporters?limit=10', { items: [], summary: null }, loadWarnings, 'supporters')
          : Promise.resolve({ items: [], summary: null, locked: true }),
        isSectionEnabled(featureAccess, 'support')
          ? safePlayerRead('/player/api/support/tickets?limit=10', { items: [], total: 0 }, loadWarnings, 'support-tickets')
          : Promise.resolve({ items: [], total: 0, locked: true }),
      ]);

      state.payload = {
        me,
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
        supporters,
        supportTickets: Array.isArray(supportTickets?.items) ? supportTickets.items : (Array.isArray(supportTickets) ? supportTickets : []),
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
    applyI18n(target);
    canonicalizePlayerLinks(target);
    if (page === 'support') {
      applyPendingSupportDraft();
    }
    document.title = `SCUM TH Platform | Player | ${String(model?.pageTitle || pageTitleLabel(page) || 'Home')}`;
    return surfaceState;
  }

  function setActionBusy(control, busy, busyLabel) {
    if (!control) return;
    if (!control.dataset.originalLabel) {
      control.dataset.originalLabel = control.textContent || '';
    }
    control.disabled = Boolean(busy);
    control.textContent = busy ? String(busyLabel || t('common.working', 'Working...')) : control.dataset.originalLabel;
  }

  async function runPlayerAction(control, busyLabel, work) {
    setActionBusy(control, true, busyLabel || t('common.working', 'Working...'));
    try {
      return await work();
    } finally {
      setActionBusy(control, false);
    }
  }

  async function completePlayerAction(message, options = {}) {
    const resolvedMessage = String(message || t('player.app.status.done', 'Done'));
    message = resolvedMessage;
    await refreshState({ silent: true });
    if (options?.navigateTo) {
      navigatePlayerRoute(buildCanonicalPlayerPath(resolvePlayerPageKey(options.navigateTo)));
    } else {
      const surfaceState = renderCurrentPage();
      applyPlayerSurfaceStatus(surfaceState);
    }
    setStatus(String(message || t('player.app.status.done', 'Done')), 'success');
  }

  async function handlePlayerServerSelection(selectNode) {
    if (!selectNode) return;
    const serverId = String(selectNode.value || '').trim();
    if (!serverId) {
      setStatus(t('player.app.status.chooseServer', 'Choose a server before continuing'), 'warning');
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
        String(result?.message || t('player.app.status.switchSuccess', 'Live view switched to {name}', { name: result?.activeServerName || serverId })),
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
      await runPlayerAction(button, t('player.app.action.adding', 'Adding...'), async () => {
        const result = await apiRequest('/player/api/cart/add', {
          method: 'POST',
          body: { itemId, quantity: 1 },
        }, null);
        await completePlayerAction(result?.message || t('player.toast.itemAdded', 'Item added to cart.'));
      });
      return;
    }

    if (button.hasAttribute('data-player-cart-remove')) {
      const itemId = String(button.getAttribute('data-player-cart-remove') || '').trim();
      const quantity = Number(button.getAttribute('data-player-cart-remove-quantity') || '1');
      if (!itemId) return;
      await runPlayerAction(button, t('player.app.action.removing', 'Removing...'), async () => {
        const result = await apiRequest('/player/api/cart/remove', {
          method: 'POST',
          body: {
            itemId,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          },
        }, null);
        await completePlayerAction(result?.message || t('player.toast.itemRemoved', 'Item removed from cart.'));
      });
      return;
    }

    if (button.hasAttribute('data-player-cart-clear')) {
      await runPlayerAction(button, t('player.app.action.clearingCart', 'Clearing...'), async () => {
        await apiRequest('/player/api/cart/clear', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(t('player.toast.cartCleared', 'Cart cleared.'));
      });
      return;
    }

    if (button.hasAttribute('data-player-cart-checkout')) {
      await runPlayerAction(button, t('player.app.action.checkingOut', 'Checking out...'), async () => {
        const result = await apiRequest('/player/api/cart/checkout', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(
          Array.isArray(result?.purchases) && result.purchases.length
            ? t('player.app.checkout.successWithCount', 'Checkout completed ({count} orders)', { count: result.purchases.length })
            : (result?.message || t('player.toast.checkoutDone', 'Checkout completed.')),
          { navigateTo: 'orders' },
        );
      });
      return;
    }

    if (button.hasAttribute('data-player-reward-claim')) {
      const rewardKind = String(button.getAttribute('data-player-reward-claim') || '').trim().toLowerCase();
      if (!['daily', 'weekly'].includes(rewardKind)) return;
      await runPlayerAction(button, rewardKind === 'weekly'
        ? t('player.app.action.claimingWeekly', 'Claiming weekly reward...')
        : t('player.app.action.claimingDaily', 'Claiming daily reward...'), async () => {
        const result = await apiRequest('/player/api/' + rewardKind + '/claim', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(result?.message || (rewardKind === 'weekly'
          ? t('player.toast.weeklyClaimed', 'Weekly reward claimed.')
          : t('player.toast.dailyClaimed', 'Daily reward claimed.')));
      });
      return;
    }

    if (button.hasAttribute('data-player-email-verification-request')) {
      const email = String(button.getAttribute('data-player-email-value') || state.payload?.profile?.primaryEmail || state.payload?.me?.primaryEmail || '').trim();
      if (!email) {
        setStatus(t('player.status.emailMissing', 'No email is linked to this player profile yet.'), 'warning');
        return;
      }
      await runPlayerAction(button, t('player.app.action.sendingVerification', 'Sending verification email...'), async () => {
        const result = await apiRequest('/player/api/profile/email-verification/request', {
          method: 'POST',
          body: { email },
        }, null);
        await completePlayerAction(result?.message || t('player.toast.verificationQueued', 'Verification email queued.'));
      });
      return;
    }

    if (button.hasAttribute('data-player-steam-unlink')) {
      await runPlayerAction(button, t('player.app.action.unlinkingSteam', 'Disconnecting Steam link...'), async () => {
        const result = await apiRequest('/player/api/linksteam/unset', {
          method: 'POST',
          body: {},
        }, null);
        await completePlayerAction(result?.message || t('player.toast.steamUnlinked', 'Steam link disconnected.'), { navigateTo: 'profile' });
      });
      return;
    }

    if (button.hasAttribute('data-player-identity-support')) {
      const reason = String(button.getAttribute('data-player-support-reason') || '').trim();
      const category = String(button.getAttribute('data-player-support-category') || 'identity').trim().toLowerCase() || 'identity';
      if (!reason) {
        setStatus(t('player.status.identitySupportMissing', 'Identity recovery details are missing for this action.'), 'warning');
        return;
      }
      await runPlayerAction(button, t('player.app.action.openingIdentityTicket', 'Opening identity support ticket...'), async () => {
        const result = await apiRequest('/player/api/support/tickets', {
          method: 'POST',
          body: { category, reason },
        }, null);
        await completePlayerAction(result?.message || t('player.toast.identityTicketOpened', 'Identity support ticket opened.'), { navigateTo: 'support' });
      });
      return;
    }

    if (button.hasAttribute('data-player-support-prefill')) {
      const reason = String(button.getAttribute('data-player-support-reason') || '').trim();
      const category = String(button.getAttribute('data-player-support-category') || button.getAttribute('data-player-support-prefill') || 'identity').trim().toLowerCase() || 'identity';
      if (!reason) {
        setStatus(t('player.status.identitySupportMissing', 'Identity recovery details are missing for this action.'), 'warning');
        return;
      }
      state.pendingSupportDraft = {
        category,
        reason,
      };
      navigatePlayerRoute(buildCanonicalPlayerPath('support'));
      return;
    }

    if (button.hasAttribute('data-player-support-ticket-close')) {
      const channelId = String(button.getAttribute('data-player-support-ticket-close') || '').trim();
      if (!channelId) return;
      await runPlayerAction(button, 'Closing ticket...', async () => {
        const result = await apiRequest('/player/api/support/tickets/close', {
          method: 'POST',
          body: { channelId },
        }, null);
        await completePlayerAction(result?.message || 'Support ticket closed.', { navigateTo: 'support' });
      });
    }
  }

  async function handlePlayerFormSubmit(form) {
    if (!form) return;
    if (form.hasAttribute('data-player-redeem-form')) {
      const code = String(form.elements.code?.value || '').trim();
      if (!code) {
        setStatus(t('player.status.emptyRedeemDetail', 'Enter a redeem code before submitting.'), 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, t('player.app.action.applyingRedeem', 'Applying code...'), async () => {
        const result = await apiRequest('/player/api/redeem', {
          method: 'POST',
          body: { code },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || t('player.toast.redeemApplied', 'Redeem code applied.'));
      });
      return;
    }

    if (form.hasAttribute('data-player-steam-link-form')) {
      const steamId = String(form.elements.steamId?.value || '').trim();
      if (!steamId) {
        setStatus(t('player.status.emptySteamDetail', 'Enter a numeric SteamID before linking.'), 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, t('player.app.action.linkingSteam', 'Linking Steam...'), async () => {
        const result = await apiRequest('/player/api/linksteam/set', {
          method: 'POST',
          body: { steamId },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || t('player.toast.steamUpdated', 'Steam link updated.'));
      });
      return;
    }

    if (form.hasAttribute('data-player-raid-request-form')) {
      const requestText = String(form.elements.requestText?.value || '').trim();
      const preferredWindow = String(form.elements.preferredWindow?.value || '').trim();
      if (!requestText) {
        setStatus(t('player.app.raid.describeBeforeSubmit', 'Describe the raid request before sending it'), 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, t('player.app.raid.submitting', 'Sending raid request...'), async () => {
        const result = await apiRequest('/player/api/raids/request', {
          method: 'POST',
          body: {
            requestText,
            preferredWindow,
          },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || t('player.app.raid.submitted', 'Raid request sent'));
      });
      return;
    }

    if (form.hasAttribute('data-player-support-ticket-form')) {
      const category = String(form.elements.category?.value || 'support').trim().toLowerCase();
      const reason = String(form.elements.reason?.value || '').trim();
      if (!reason) {
        setStatus('Describe the support request before sending it.', 'warning');
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      await runPlayerAction(button, 'Opening support ticket...', async () => {
        const result = await apiRequest('/player/api/support/tickets', {
          method: 'POST',
          body: { category, reason },
        }, null);
        form.reset();
        await completePlayerAction(result?.message || 'Support ticket opened.', { navigateTo: 'support' });
      });
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
        setStatus(String(error?.message || error || t('player.app.status.switchFailed', 'Failed to switch player server')), 'danger');
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
        ) {
          return;
        }
      event.preventDefault();
      handlePlayerFormSubmit(form).catch((error) => {
        setStatus(String(error?.message || error || t('player.status.actionFailed', 'Action failed')), 'danger');
      });
    });
      document.addEventListener('click', (event) => {
        const button = event.target instanceof Element
          ? event.target.closest('[data-player-cart-add],[data-player-cart-remove],[data-player-cart-clear],[data-player-cart-checkout],[data-player-reward-claim],[data-player-email-verification-request],[data-player-steam-unlink],[data-player-identity-support],[data-player-support-prefill],[data-player-support-ticket-close]')
          : null;
        if (!button) return;
      event.preventDefault();
      handlePlayerActionClick(button).catch((error) => {
        setStatus(String(error?.message || error || t('player.status.actionFailed', 'Action failed')), 'danger');
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
