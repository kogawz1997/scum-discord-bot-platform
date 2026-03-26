(function () {
  'use strict';

  const t = (key, fallback, params) => window.PortalUiI18n?.t?.(key, fallback, params) ?? fallback ?? key;

  // Player portal state stays UI-focused.
  // If you want to change tab order or simplify a player journey later,
  // update this state shape and the matching render* function together.
  const state = {
    activeTab: 'home',
    me: null,
    dashboard: null,
    serverInfo: null,
    walletLedger: null,
    shopItems: [],
    cart: null,
    orders: [],
    redeemHistory: [],
    profile: null,
    steamLink: null,
    steamHistory: [],
    notifications: [],
    selectedOrderCode: '',
    lastRefreshedAt: null,
    filters: {
      shopQuery: '',
      shopKind: 'all',
    },
  };

  let intervalHandle = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const response = await fetch(path, {
      method,
      headers,
      body,
      credentials: 'same-origin',
    });
    if (response.status === 401) {
      window.location.href = '/player/login';
      throw new Error('Unauthorized');
    }
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { ok: response.ok, error: text || response.statusText };
    }
    if (!response.ok || parsed.ok === false) {
      const message = parsed?.data?.message || parsed.error || response.statusText || 'Request failed';
      throw new Error(message);
    }
    return parsed.data;
  }

  function formatNumber(value, fallback = '-') {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString(window.PortalUiI18n?.getLocale?.() || 'en-US') : fallback;
  }

  function formatDateTime(value, fallback = '-') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    return parsed.toLocaleString(window.PortalUiI18n?.getLocale?.() || 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function toneFromStatus(value) {
    const text = String(value || '').trim().toLowerCase();
    if (['active', 'linked', 'delivered', 'success', 'ready', 'online', 'claimable'].includes(text)) return 'success';
    if (['warning', 'warn', 'pending', 'delivering', 'review', 'queued'].includes(text)) return 'warning';
    if (['error', 'failed', 'delivery_failed', 'inactive', 'offline', 'unlinked'].includes(text)) return 'danger';
    return 'info';
  }

  function pill(label, tone) {
    const resolvedTone = tone || toneFromStatus(label);
    return `<span class="pill pill-${escapeHtml(resolvedTone)}">${escapeHtml(label || '-')}</span>`;
  }

  function normalizeOrderStatus(value) {
    return String(value || '').trim().toLowerCase() || 'pending';
  }

  function orderStatusLabel(row) {
    const status = normalizeOrderStatus(row?.status);
    if (status === 'delivered') return t('player.order.delivered', 'Delivered');
    if (status === 'delivery_failed') return t('player.order.needsAttention', 'Needs attention');
    if (status === 'delivering') return t('player.order.delivering', 'Delivering');
    if (status === 'queued') return t('player.order.queued', 'Queued');
    return t('player.order.pending', 'Pending');
  }

  function orderNextStep(row) {
    const status = normalizeOrderStatus(row?.status);
    if (status === 'delivered') {
      return t('player.order.next.completed', 'Completed. You can keep the code for your own records.');
    }
    if (status === 'delivery_failed') {
      return t('player.order.next.failed', 'Support may need to retry the delivery. Keep the purchase code ready before contacting admins.');
    }
    if (status === 'delivering') {
      return t('player.order.next.delivering', 'The system is currently working on the delivery. Wait for the next refresh before retrying anything.');
    }
    if (!state.steamLink?.linked && (row?.itemKind === 'item' || row?.requiresSteamLink)) {
      return t('player.order.next.needsSteam', 'Link your SteamID to reduce delivery issues for in-game items.');
    }
    return t('player.order.next.default', 'No action needed yet. The order is still progressing through the normal flow.');
  }

  function statusDisplayLabel(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'active') return t('player.status.active', 'Active');
    if (text === 'inactive') return t('player.status.inactive', 'Inactive');
    if (text === 'linked') return t('player.status.linked', 'Linked');
    if (text === 'unlinked') return t('player.status.unlinked', 'Unlinked');
    if (text === 'session') return t('player.status.session', 'Session');
    return String(value || '-');
  }

  function findOrderByCode(code) {
    const lookup = String(code || '').trim();
    if (!lookup) return null;
    return state.orders.find((row) => String(row.purchaseCode || row.code || '').trim() === lookup) || null;
  }

  function notificationCategoryKey(item) {
    const text = `${item?.type || ''} ${item?.title || ''} ${item?.detail || ''} ${item?.message || ''}`.toLowerCase();
    if (/(purchase|order|delivery|checkout)/.test(text)) return 'orders';
    if (/(steam|link)/.test(text)) return 'steam';
    if (/(wallet|reward|redeem|coins?)/.test(text)) return 'wallet';
    return 'account';
  }

  function notificationCategoryLabel(item) {
    const category = notificationCategoryKey(item);
    if (category === 'orders') return t('player.category.orders', 'Orders');
    if (category === 'steam') return t('player.category.steam', 'Steam');
    if (category === 'wallet') return t('player.category.wallet', 'Wallet');
    return t('player.category.account', 'Account');
  }

  function extractPurchaseCode(item) {
    const direct = String(
      item?.purchaseCode
      || item?.code
      || item?.data?.purchaseCode
      || item?.data?.code
      || ''
    ).trim();
    if (direct) return direct;
    const text = `${item?.title || ''} ${item?.detail || ''} ${item?.message || ''}`;
    const match = text.match(/\bP[0-9A-Za-z-]{6,}\b/);
    return match ? match[0] : '';
  }

  function notificationActionForItem(item) {
    const purchaseCode = extractPurchaseCode(item);
    if (purchaseCode) {
      return { kind: 'order', label: t('player.actions.openOrder', 'Open order'), code: purchaseCode };
    }
    const category = notificationCategoryKey(item);
    if (category === 'wallet') {
      return { kind: 'tab', label: t('player.actions.openWallet', 'Open wallet'), tab: 'wallet' };
    }
    if (category === 'steam') {
      return { kind: 'tab', label: t('player.actions.openProfile', 'Open profile'), tab: 'profile' };
    }
    if (category === 'orders') {
      return { kind: 'tab', label: t('player.actions.openOrders', 'Open orders'), tab: 'orders' };
    }
    return { kind: 'tab', label: t('player.actions.openHome', 'Open home'), tab: 'home' };
  }

  function ensureToastStack() {
    let stack = document.getElementById('playerToastStack');
    if (stack) return stack;
    stack = document.createElement('div');
    stack.id = 'playerToastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
    return stack;
  }

  function showToast(message, tone = 'info') {
    const stack = ensureToastStack();
    const toast = document.createElement('article');
    toast.className = `toast toast-${tone}`;
    toast.innerHTML = `<strong>${escapeHtml(String(message || 'Done'))}</strong>`;
    stack.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('toast-exit');
      window.setTimeout(() => toast.remove(), 240);
    }, 2800);
  }

  function setStatus(title, detail, tags, tone) {
    $('statusTitle').textContent = title;
    $('statusDetail').textContent = detail;
    $('statusBanner').className = `status-banner status-${tone || 'info'}`;
    $('statusTags').innerHTML = (Array.isArray(tags) ? tags : []).map((tag) => pill(tag)).join('');
  }

  function setButtonBusy(button, busy, pendingLabel) {
    if (!button) return;
    if (!button.dataset.idleLabel) {
      button.dataset.idleLabel = button.textContent || '';
    }
    button.disabled = Boolean(busy);
    button.textContent = busy ? String(pendingLabel || t('common.working', 'Working...')) : button.dataset.idleLabel;
  }

  function renderStats(container, cards) {
    container.innerHTML = (Array.isArray(cards) ? cards : []).map((card) => [
      '<article class="stat-card">',
      `<span class="kicker">${escapeHtml(card.kicker || '')}</span>`,
      `<strong>${escapeHtml(card.value || '-')}</strong>`,
      `<div>${escapeHtml(card.title || '')}</div>`,
      card.detail ? `<p class="muted">${escapeHtml(card.detail)}</p>` : '',
      Array.isArray(card.tags) && card.tags.length ? `<div class="tag-row">${card.tags.map((tag) => pill(tag)).join('')}</div>` : '',
      '</article>',
    ].join('')).join('') || `<div class="empty-state">${escapeHtml(t('player.empty.summary', 'No summary available.'))}</div>`;
  }

  function renderTable(container, columns, rows, emptyText) {
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(emptyText || t('player.empty.table', 'No data yet.'))}</div>`;
      return;
    }
    container.innerHTML = [
      '<div class="table-shell"><table><thead><tr>',
      columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join(''),
      '</tr></thead><tbody>',
      rows.map((row) => [
        '<tr>',
        columns.map((column) => `<td>${column.render(row)}</td>`).join(''),
        '</tr>',
      ].join('')).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function activateTab(tabKey) {
    state.activeTab = tabKey;
    Array.from(document.querySelectorAll('.nav-btn')).forEach((button) => {
      const isActive = button.dataset.tab === tabKey;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    Array.from(document.querySelectorAll('.tab-panel')).forEach((panel) => {
      const isActive = panel.id === `tab-${tabKey}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
    renderPlayerPageContext(tabKey);
  }

  function renderPlayerPageContext(tabKey = state.activeTab || 'home') {
    const titleEl = $('playerPageContextTitle');
    const detailEl = $('playerPageContextDetail');
    const tagsEl = $('playerPageContextTags');
    if (!titleEl || !detailEl || !tagsEl) return;
    const activeButton = document.querySelector(`.nav-btn[data-tab="${tabKey}"]`);
    const sectionLabel = String(activeButton?.textContent || '').trim() || t('player.nav.home', 'คลังของฉัน');
    const detailMap = {
      home: t('player.pagebar.home', 'เริ่มที่หน้านี้เพื่อดูภาพรวมบัญชี กระเป๋าเงิน คำสั่งซื้อล่าสุด และการแจ้งเตือนสำคัญ'),
      wallet: t('player.pagebar.wallet', 'ใช้ดูยอดคงเหลือ เหตุผลของแต่ละรายการ และรอบรับรางวัลในรูปแบบที่อ่านง่าย'),
      shop: t('player.pagebar.shop', 'ใช้เลือกซื้อสินค้า ตรวจสิ่งที่ต้องเชื่อม Steam และดูยอดรวมก่อนชำระเงิน'),
      orders: t('player.pagebar.orders', 'ใช้ติดตามสถานะคำสั่งซื้อ ตรวจหลักฐานการส่งของ และดูว่าควรทำอะไรต่อ'),
      redeem: t('player.pagebar.redeem', 'ใช้กรอกโค้ดแลกรับและดูประวัติการใช้โค้ดจากหน้าเดียว'),
      profile: t('player.pagebar.profile', 'ใช้จัดการบัญชี การเชื่อม Steam และดูสถานะล่าสุดของโปรไฟล์'),
    };
    titleEl.textContent = sectionLabel;
    detailEl.textContent = detailMap[tabKey] || detailMap.home;
    tagsEl.innerHTML = [
      pill(t('common.currentPageLabel', 'หน้าปัจจุบัน {value}', { value: sectionLabel }), 'success'),
      pill(tabKey === 'shop' || tabKey === 'orders' ? t('player.pagebar.tagCommerce', 'งานซื้อขาย') : t('player.pagebar.tagAccount', 'งานบัญชี'), 'neutral'),
    ].join('');
  }

  function filteredShopItems() {
    const query = String(state.filters.shopQuery || '').trim().toLowerCase();
    const kind = String(state.filters.shopKind || 'all').trim().toLowerCase();
    return state.shopItems.filter((row) => {
      const rowKind = String(row.kind || 'item').trim().toLowerCase();
      if (kind !== 'all' && rowKind !== kind) return false;
      if (!query) return true;
      return [row.id, row.name, row.description, row.gameItemId]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(query);
    });
  }

  function itemArtwork(row) {
    const src = String(row.iconUrl || row.itemIconUrl || '').trim();
    if (src) {
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(row.name || row.id || 'Item')}">`;
    }
    return '<span class="metric-value">?</span>';
  }

  function renderHome() {
    const dashboard = state.dashboard || {};
    const steamLinked = Boolean(state.steamLink?.linked);
    const latestOrder = dashboard.latestOrder || state.orders[0] || null;
    const serverInfo = state.serverInfo?.serverInfo || {};
    const status = state.serverInfo?.status || {};

    $('profileAvatar').src = state.me?.avatarUrl || state.profile?.avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="%230d141b"/><circle cx="48" cy="34" r="18" fill="%237b91a8"/><rect x="20" y="58" width="56" height="24" rx="12" fill="%237b91a8"/></svg>';
    $('profileName').textContent = state.profile?.displayName || state.me?.user || t('player.profile.player', 'Player');
    $('profileMeta').textContent = state.profile?.discordId || state.me?.discordId || t('player.profile.discordAccount', 'Discord account');
    $('profileQuickMeta').innerHTML = [
      pill(
        steamLinked
          ? t('player.profile.steamLinked', 'Steam linked')
          : t('player.profile.steamRequired', 'Steam required'),
        steamLinked ? 'success' : 'warning'
      ),
      pill(statusDisplayLabel(state.profile?.accountStatus || 'active'), toneFromStatus(state.profile?.accountStatus || 'active')),
      pill(statusDisplayLabel(state.me?.authMethod || 'session'), 'info'),
    ].join('');
    $('portalMetaTags').innerHTML = [
      pill(
        state.lastRefreshedAt
          ? t('player.meta.synced', 'Synced {time}', { time: formatDateTime(state.lastRefreshedAt) })
          : t('player.meta.syncPending', 'Sync pending'),
        'info'
      ),
      pill(t('player.meta.autoRefresh', 'Auto refresh 45s'), 'neutral'),
      pill(
        steamLinked
          ? t('player.meta.deliveryReady', 'Delivery ready')
          : t('player.meta.steamNeeded', 'Steam needed'),
        steamLinked ? 'success' : 'warning'
      ),
    ].join('');

    $('homeWalletBalance').textContent = formatNumber(dashboard.wallet?.balance || state.walletLedger?.wallet?.balance, '0');
    $('homeLatestOrder').textContent = latestOrder?.itemName || latestOrder?.code || t('player.home.noRecentOrderShort', 'No recent order');
    $('homeLatestOrderDetail').innerHTML = latestOrder
      ? `${pill(orderStatusLabel(latestOrder), toneFromStatus(latestOrder.status || 'pending'))} <span class="muted">${escapeHtml(formatDateTime(latestOrder.createdAt))}</span>`
      : `<span class="muted">${escapeHtml(t('player.home.noRecentOrder', 'No recent order yet.'))}</span>`;
    $('homeLatestOrderBtn').disabled = !latestOrder || !(latestOrder.purchaseCode || latestOrder.code);
    $('homeLatestOrderBtn').dataset.orderCode = latestOrder?.purchaseCode || latestOrder?.code || '';

    $('claimDailyBtn').disabled = !dashboard.missionsSummary?.dailyClaimable;
    $('claimWeeklyBtn').disabled = !dashboard.missionsSummary?.weeklyClaimable;

    renderStats($('homeOverviewStats'), [
      {
        kicker: t('player.home.stat.steamKicker', 'Steam'),
        value: steamLinked ? t('player.home.stat.ready', 'Ready') : t('player.home.stat.required', 'Required'),
        title: t('player.home.stat.steamTitle', 'Steam link status'),
        detail: steamLinked ? t('player.home.stat.steamDetailReady', 'Safe to buy in-game items from this portal.') : t('player.home.stat.steamDetailMissing', 'Link SteamID before buying items that deliver into the game.'),
      },
      {
        kicker: t('player.home.stat.ordersKicker', 'Orders'),
        value: formatNumber(state.orders.length, '0'),
        title: t('player.home.stat.ordersTitle', 'Visible purchase records'),
        detail: t('player.home.stat.ordersDetail', 'Recent order history tied to this Discord account.'),
      },
      {
        kicker: t('player.home.stat.claimsKicker', 'Claims'),
        value: dashboard.missionsSummary?.dailyClaimable || dashboard.missionsSummary?.weeklyClaimable ? t('player.home.stat.open', 'Open') : t('player.home.stat.cooldown', 'Cooldown'),
        title: t('player.home.stat.claimsTitle', 'Daily and weekly rewards'),
        detail: dashboard.missionsSummary?.dailyClaimable
          ? t('player.home.stat.claimsDetailDaily', 'Daily reward can be claimed now.')
          : dashboard.missionsSummary?.weeklyClaimable
            ? t('player.home.stat.claimsDetailWeekly', 'Weekly reward can be claimed now.')
            : t('player.home.stat.claimsDetailCooldown', 'Reward claim is currently on cooldown.'),
      },
      {
        kicker: t('player.home.stat.serverKicker', 'Server'),
        value: formatNumber(status.onlinePlayers, '0'),
        title: t('player.home.stat.serverTitle', 'Players online'),
        detail: t('player.home.stat.serverDetail', '{slots} total slots configured.', { slots: formatNumber(serverInfo.maxPlayers, '0') }),
      },
    ]);

    renderStats($('homeServerStats'), [
      {
        kicker: t('player.home.server.kicker', 'Server'),
        value: serverInfo.name || t('player.home.server.defaultName', 'SCUM Server'),
        title: t('player.home.server.title', 'Current server name'),
        detail: serverInfo.description || t('player.home.server.detail', 'Operational status from the player portal.'),
      },
      {
        kicker: t('player.home.population.kicker', 'Online'),
        value: formatNumber(status.onlinePlayers, '0'),
        title: t('player.home.population.title', 'Current population'),
        detail: t('player.home.population.detail', '{slots} max slots', { slots: formatNumber(serverInfo.maxPlayers, '0') }),
      },
      {
        kicker: t('player.home.economy.kicker', 'Economy'),
        value: formatNumber(state.serverInfo?.economy?.dailyReward, '0'),
        title: t('player.home.economy.title', 'Daily reward ({currency})', { currency: state.serverInfo?.economy?.currencySymbol || t('player.currency.coins', 'Coins') }),
        detail: t('player.home.economy.detail', 'Shown exactly as configured by the tenant economy surface.'),
      },
      {
        kicker: t('player.home.announcements.kicker', 'Announcements'),
        value: formatNumber((dashboard.announcements || []).length, '0'),
        title: t('player.home.announcements.title', 'Portal notices'),
        detail: t('player.home.announcements.detail', 'Latest notices and raid-time summaries pulled into the player surface.'),
      },
    ]);
    renderHomeTaskHub();
    renderFirstRunGuide();
    renderNotificationCenter();
  }

  function renderHomeTaskHub() {
    const container = $('homeTaskHub');
    if (!container) return;
    const latestOrder = state.dashboard?.latestOrder || state.orders[0] || null;
    const latestOrderCode = latestOrder?.purchaseCode || latestOrder?.code || '';
    const steamLinked = Boolean(state.steamLink?.linked);
    const groups = [
      {
        tone: 'success',
        tag: t('player.taskHub.buy.tag', 'shop'),
        title: t('player.taskHub.buy.title', 'Top up and buy'),
        detail: t('player.taskHub.buy.detail', 'Check balance first, then open the shop when you are ready to buy items or support the server.'),
        actions: [
          { tab: 'wallet', label: t('player.taskHub.buy.wallet', 'Open wallet'), primary: true },
          { tab: 'shop', label: t('player.taskHub.buy.shop', 'Open shop') },
        ],
      },
      {
        tone: latestOrder ? 'info' : 'neutral',
        tag: t('player.taskHub.orders.tag', 'orders'),
        title: t('player.taskHub.orders.title', 'Track your current order'),
        detail: latestOrderCode
          ? t('player.taskHub.orders.detailReady', 'A recent order is available. Open it to check the latest status and what to do next.')
          : t('player.taskHub.orders.detail', 'Use the orders area to confirm status, delivery result, and any next step after checkout.'),
        actions: [
          latestOrderCode
            ? { orderCode: latestOrderCode, label: t('player.taskHub.orders.latest', 'Open latest order'), primary: true }
            : { tab: 'orders', label: t('player.taskHub.orders.latestFallback', 'Open orders'), primary: true },
          { tab: 'orders', label: t('player.taskHub.orders.all', 'View order history') },
        ],
      },
      {
        tone: steamLinked ? 'info' : 'warning',
        tag: t('player.taskHub.account.tag', 'account'),
        title: t('player.taskHub.account.title', 'Keep your account ready'),
        detail: steamLinked
          ? t('player.taskHub.account.detailReady', 'Your Steam link is already in place. Review profile and redeem tools from one area.')
          : t('player.taskHub.account.detail', 'Link Steam and keep account details current before buying items that deliver into the game.'),
        actions: [
          { tab: 'profile', label: t('player.taskHub.account.profile', 'Open profile'), primary: true },
          { tab: 'redeem', label: t('player.taskHub.account.redeem', 'Open redeem') },
        ],
      },
    ];
    container.innerHTML = groups.map((group) => [
      '<article class="task-launch-card guide-card">',
      '<div class="task-launch-head">',
      `<div class="feed-meta">${pill(group.tag, group.tone)}</div>`,
      `<strong>${escapeHtml(group.title)}</strong>`,
      `<p>${escapeHtml(group.detail)}</p>`,
      '</div>',
      '<div class="task-launch-actions">',
      ...group.actions.map((action) => action.orderCode
        ? `<button class="button ${action.primary ? 'button-primary' : ''}" type="button" data-task-order="${escapeHtml(action.orderCode)}">${escapeHtml(action.label)}</button>`
        : `<button class="button ${action.primary ? 'button-primary' : ''}" type="button" data-task-tab="${escapeHtml(action.tab || 'home')}">${escapeHtml(action.label)}</button>`),
      '</div>',
      '</article>',
    ].join('')).join('');
  }

  function renderNotificationCenter() {
    const notifications = Array.isArray(state.notifications) ? state.notifications.slice(0, 6) : [];
    const attentionCount = notifications.filter((item) => ['warning', 'warn', 'error'].includes(String(item?.severity || '').toLowerCase())).length;
    const orderCount = notifications.filter((item) => notificationCategoryKey(item) === 'orders').length;
    const accountCount = notifications.filter((item) => notificationCategoryKey(item) !== 'orders').length;

    renderStats($('homeNotificationStats'), [
      {
        kicker: t('player.notifications.kicker', 'Inbox'),
        value: formatNumber(notifications.length, '0'),
        title: t('player.notifications.title', 'Recent player notifications'),
        detail: t('player.notifications.detail', 'Recent wallet, account, and order messages shown in one place.'),
      },
      {
        kicker: t('player.notifications.attentionKicker', 'Attention'),
        value: formatNumber(attentionCount, '0'),
        title: t('player.notifications.attentionTitle', 'Needs review'),
        detail: attentionCount > 0
          ? t('player.notifications.attentionDetailBusy', 'These messages may need action before the next purchase or redeem attempt.')
          : t('player.notifications.attentionDetailClear', 'No warning-level player messages are visible right now.'),
      },
      {
        kicker: t('player.notifications.ordersKicker', 'Orders'),
        value: formatNumber(orderCount, '0'),
        title: t('player.notifications.ordersTitle', 'Purchase or delivery updates'),
        detail: t('player.notifications.ordersDetail', 'Useful when you are tracking a recent checkout or delivery.'),
      },
      {
        kicker: t('player.notifications.accountKicker', 'Account'),
        value: formatNumber(accountCount, '0'),
        title: t('player.notifications.accountTitle', 'Wallet, Steam, and account reminders'),
        detail: t('player.notifications.accountDetail', 'Includes Steam link, wallet, and account trust guidance.'),
      },
    ]);

    $('homeNotifications').innerHTML = notifications.length
      ? notifications.map((item) => {
          const action = notificationActionForItem(item);
          const actionButton = action.kind === 'order'
            ? `<button class="button" type="button" data-notification-order="${escapeHtml(action.code)}">${escapeHtml(action.label)}</button>`
            : `<button class="button" type="button" data-notification-tab="${escapeHtml(action.tab)}">${escapeHtml(action.label)}</button>`;
          return [
            '<article class="feed-item">',
            `<div class="feed-meta">${pill(item.severity || 'info')} ${pill(notificationCategoryLabel(item), 'info')}</div>`,
            `<strong>${escapeHtml(item.title || item.message || item.detail || t('player.notifications.itemDefault', 'Notification'))}</strong>`,
            item.detail ? `<div class="muted">${escapeHtml(item.detail)}</div>` : '',
            `<div class="feed-meta"><span>${escapeHtml(formatDateTime(item.createdAt || item.at))}</span>${item.type ? ` <span class="code">${escapeHtml(item.type)}</span>` : ''}</div>`,
            `<div class="button-row">${actionButton}</div>`,
            '</article>',
          ].join('');
        }).join('')
      : `<div class="empty-state">${escapeHtml(t('player.notifications.empty', 'No player notifications right now.'))}</div>`;
  }

  function renderFirstRunGuide() {
    const container = $('homeFirstRunGuide');
    if (!container) return;
    const latestOrder = state.dashboard?.latestOrder || state.orders[0] || null;
    const balanceKnown = Number.isFinite(Number(state.walletLedger?.wallet?.balance));
    const items = [
      {
        tone: state.steamLink?.linked ? 'success' : 'warning',
        status: state.steamLink?.linked ? t('player.guide.status.ready', 'Ready') : t('player.guide.status.action', 'Needs action'),
        title: t('player.guide.steam.title', 'Link Steam first'),
        detail: state.steamLink?.linked
          ? t('player.guide.steam.detailReady', 'Steam is already linked, so item delivery flows can stay predictable.')
          : t('player.guide.steam.detail', 'Link your SteamID before buying in-game items so delivery does not stall on missing player context.'),
        actionLabel: state.steamLink?.linked ? t('player.actions.openProfile', 'Open profile') : t('player.guide.steam.button', 'Link Steam'),
        actionTab: 'profile',
      },
      {
        tone: balanceKnown ? 'success' : 'info',
        status: balanceKnown ? t('player.guide.status.ready', 'Ready') : t('player.guide.status.review', 'Review'),
        title: t('player.guide.wallet.title', 'Check your wallet'),
        detail: t('player.guide.wallet.detail', 'Review balance, reward cooldowns, and ledger entries before you buy or redeem anything.'),
        actionLabel: t('player.actions.openWallet', 'Open wallet'),
        actionTab: 'wallet',
      },
      {
        tone: latestOrder ? 'info' : 'neutral',
        status: latestOrder ? t('player.guide.status.review', 'Review') : t('player.guide.status.next', 'Next'),
        title: t('player.guide.orders.title', 'Understand order states'),
        detail: latestOrder
          ? t('player.guide.orders.detailReady', 'A recent order is available. Open it once so the timeline and next-step guidance become familiar.')
          : t('player.guide.orders.detail', 'When you buy something, the orders tab is where you confirm the code, state, and next step without needing admin tools.'),
        actionLabel: latestOrder ? t('player.actions.openOrder', 'Open order') : t('player.actions.openOrders', 'Open orders'),
        actionTab: latestOrder ? '' : 'orders',
        orderCode: latestOrder?.purchaseCode || latestOrder?.code || '',
      },
      {
        tone: state.redeemHistory.length > 0 ? 'success' : 'info',
        status: state.redeemHistory.length > 0 ? t('player.guide.status.ready', 'Ready') : t('player.guide.status.review', 'Review'),
        title: t('player.guide.redeem.title', 'Know the redeem flow'),
        detail: t('player.guide.redeem.detail', 'Redeem uses the same trust-first flow as purchases, so it is worth checking where code history and result states appear.'),
        actionLabel: t('player.actions.openRedeem', 'Open redeem'),
        actionTab: 'redeem',
      },
    ];

    container.innerHTML = items.map((item) => {
      const button = item.orderCode
        ? `<button class="button" type="button" data-guide-order="${escapeHtml(item.orderCode)}">${escapeHtml(item.actionLabel)}</button>`
        : `<button class="button" type="button" data-guide-tab="${escapeHtml(item.actionTab)}">${escapeHtml(item.actionLabel)}</button>`;
      return [
        '<article class="tip-card guide-card">',
        `<div class="feed-meta">${pill(item.status, item.tone)}</div>`,
        `<strong>${escapeHtml(item.title)}</strong>`,
        `<p class="muted">${escapeHtml(item.detail)}</p>`,
        `<div class="button-row">${button}</div>`,
        '</article>',
      ].join('');
    }).join('');
  }

  function renderWallet() {
    const wallet = state.walletLedger?.wallet || {};
    const dashboard = state.dashboard || {};
    renderStats($('walletSummaryStats'), [
      {
        kicker: t('player.wallet.balanceKicker', 'Balance'),
        value: formatNumber(wallet.balance, '0'),
        title: t('player.wallet.balanceTitle', 'Current wallet balance'),
        detail: t('player.wallet.balanceDetail', 'Latest stored balance for this player account.'),
      },
      {
        kicker: t('player.wallet.dailyKicker', 'Daily'),
        value: dashboard.missionsSummary?.dailyClaimable ? t('player.wallet.claimable', 'Claimable') : t('player.home.stat.cooldown', 'Cooldown'),
        title: t('player.wallet.dailyTitle', 'Daily reward'),
        detail: dashboard.missionsSummary?.dailyRemainingMs ? t('player.wallet.dailyDetailRemaining', '{minutes} min remaining', { minutes: formatNumber(Math.round(dashboard.missionsSummary.dailyRemainingMs / 1000 / 60), '0') }) : t('player.wallet.dailyDetailReady', 'Ready or no cooldown currently active.'),
      },
      {
        kicker: t('player.wallet.weeklyKicker', 'Weekly'),
        value: dashboard.missionsSummary?.weeklyClaimable ? t('player.wallet.claimable', 'Claimable') : t('player.home.stat.cooldown', 'Cooldown'),
        title: t('player.wallet.weeklyTitle', 'Weekly reward'),
        detail: dashboard.missionsSummary?.weeklyRemainingMs ? t('player.wallet.weeklyDetailRemaining', '{hours} hr remaining', { hours: formatNumber(Math.round(dashboard.missionsSummary.weeklyRemainingMs / 1000 / 60 / 60), '0') }) : t('player.wallet.weeklyDetailReady', 'Ready or no cooldown currently active.'),
      },
    ]);

    renderTable(
      $('walletLedgerTable'),
      [
        { label: t('player.wallet.table.time', 'Time'), render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.createdAt))}</span>` },
        { label: t('player.wallet.table.delta', 'Delta'), render: (row) => escapeHtml(formatNumber(row.delta, '0')) },
        { label: t('player.wallet.table.balanceAfter', 'Balance After'), render: (row) => escapeHtml(formatNumber(row.balanceAfter, '0')) },
        { label: t('player.wallet.table.reason', 'Reason'), render: (row) => escapeHtml(row.reasonLabel || row.reason || '-') },
        { label: t('player.wallet.table.reference', 'Reference'), render: (row) => `<span class="code">${escapeHtml(row.reference || '-')}</span>` },
      ],
      Array.isArray(state.walletLedger?.items) ? state.walletLedger.items : [],
      t('player.wallet.emptyLedger', 'No wallet ledger entries yet.')
    );
  }

  function renderShop() {
    const items = filteredShopItems();
    $('shopGrid').innerHTML = items.length
      ? items.map((item) => [
          '<article class="shop-card">',
          `<div class="shop-thumb">${itemArtwork(item)}</div>`,
          `<div class="meta">${pill(item.kind || 'item', item.kind === 'vip' ? 'info' : 'neutral')} ${item.requiresSteamLink ? pill(t('player.profile.steamRequired', 'Steam required'), 'warning') : ''}</div>`,
          `<h3>${escapeHtml(item.name || item.id || '-')}</h3>`,
          `<div class="muted">${escapeHtml(item.description || t('player.shop.noDescription', 'No description available.'))}</div>`,
          `<strong class="shop-price">${escapeHtml(formatNumber(item.price, '0'))}</strong>`,
          `<div class="button-row">`,
          `<button class="button" type="button" data-add-cart="${escapeHtml(item.id)}">${escapeHtml(t('player.shop.addToCart', 'Add to cart'))}</button>`,
          `<button class="button button-primary" type="button" data-buy-now="${escapeHtml(item.id)}">${escapeHtml(t('player.shop.buyNow', 'Buy now'))}</button>`,
          `</div>`,
          '</article>',
        ].join('')).join('')
      : `<div class="empty-state">${escapeHtml(t('player.shop.empty', 'No items match this filter.'))}</div>`;

    Array.from(document.querySelectorAll('[data-add-cart]')).forEach((button) => {
      button.addEventListener('click', async () => {
        const itemId = button.dataset.addCart || '';
        await runAction(button, async () => {
          await api('/player/api/cart/add', {
            method: 'POST',
            body: { itemId, quantity: 1 },
          });
          showToast(t('player.toast.itemAdded', 'Item added to cart.'), 'success');
          await refreshAll();
        });
      });
    });

    Array.from(document.querySelectorAll('[data-buy-now]')).forEach((button) => {
      button.addEventListener('click', async () => {
        const itemId = button.dataset.buyNow || '';
        await runAction(button, async () => {
          await api('/player/api/shop/buy', {
            method: 'POST',
            body: { itemId },
          });
          showToast(t('player.toast.purchaseCreated', 'Purchase created successfully.'), 'success');
          await refreshAll();
          activateTab('orders');
        });
      });
    });

    const cartRows = Array.isArray(state.cart?.rows) ? state.cart.rows : [];
    renderStats($('cartSummary'), [
      {
        kicker: t('player.shop.cartItemsKicker', 'Items'),
        value: formatNumber(state.cart?.totalUnits, '0'),
        title: t('player.shop.cartItemsTitle', 'Units in cart'),
      },
      {
        kicker: t('player.shop.cartTotalKicker', 'Total'),
        value: formatNumber(state.cart?.totalPrice, '0'),
        title: t('player.shop.cartTotalTitle', 'Coins required'),
      },
      {
        kicker: t('player.shop.cartMissingKicker', 'Missing'),
        value: formatNumber((state.cart?.missingItemIds || []).length, '0'),
        title: t('player.shop.cartMissingTitle', 'Unavailable refs'),
      },
    ]);

    $('cartRows').innerHTML = cartRows.length
      ? cartRows.map((row) => [
          '<article class="feed-item">',
          `<strong>${escapeHtml(row.item?.name || row.itemId || '-')}</strong>`,
          `<div class="feed-meta"><span>${escapeHtml(t('player.shop.cartUnits', '{count} units', { count: formatNumber(row.quantity, '1') }))}</span><span>${escapeHtml(t('player.shop.cartCoins', '{count} coins', { count: formatNumber(row.lineTotal, '0') }))}</span></div>`,
          `<div class="button-row"><button class="button" type="button" data-remove-cart="${escapeHtml(row.itemId)}" data-remove-quantity="${escapeHtml(row.quantity)}">${escapeHtml(t('player.shop.remove', 'Remove'))}</button></div>`,
          '</article>',
        ].join('')).join('')
      : `<div class="empty-state">${escapeHtml(t('player.shop.emptyCart', 'Your cart is empty.'))}</div>`;

    Array.from(document.querySelectorAll('[data-remove-cart]')).forEach((button) => {
      button.addEventListener('click', async () => {
        await runAction(button, async () => {
          await api('/player/api/cart/remove', {
            method: 'POST',
            body: {
              itemId: button.dataset.removeCart,
              quantity: Number(button.dataset.removeQuantity || 1),
            },
          });
          showToast(t('player.toast.itemRemoved', 'Item removed from cart.'), 'info');
          await refreshAll();
        });
      });
    });
  }

  function renderOrders() {
    const pending = state.orders.filter((row) => ['pending', 'delivering'].includes(String(row.status || '').toLowerCase())).length;
    const delivered = state.orders.filter((row) => String(row.status || '').toLowerCase() === 'delivered').length;
    const failed = state.orders.filter((row) => String(row.status || '').toLowerCase() === 'delivery_failed').length;

    renderStats($('ordersSummaryStats'), [
      {
        kicker: t('player.orders.stat.ordersKicker', 'Orders'),
        value: formatNumber(state.orders.length, '0'),
        title: t('player.orders.stat.ordersTitle', 'Visible order records'),
      },
      {
        kicker: t('player.orders.stat.pendingKicker', 'Pending'),
        value: formatNumber(pending, '0'),
        title: t('player.orders.stat.pendingTitle', 'Awaiting completion'),
      },
      {
        kicker: t('player.orders.stat.deliveredKicker', 'Delivered'),
        value: formatNumber(delivered, '0'),
        title: t('player.orders.stat.deliveredTitle', 'Successfully completed'),
      },
      {
        kicker: t('player.orders.stat.failedKicker', 'Failed'),
        value: formatNumber(failed, '0'),
        title: t('player.orders.stat.failedTitle', 'Needs support or retry'),
      },
    ]);

    renderStats($('ordersTrustStats'), [
      {
        kicker: t('player.orders.trust.syncKicker', 'Sync'),
        value: state.lastRefreshedAt ? formatDateTime(state.lastRefreshedAt) : '-',
        title: t('player.orders.trust.syncTitle', 'Latest refresh'),
        detail: t('player.orders.trust.syncDetail', 'The portal refreshes automatically while this tab stays visible.'),
      },
      {
        kicker: t('player.orders.trust.steamKicker', 'Steam'),
        value: state.steamLink?.linked ? t('player.home.stat.ready', 'Ready') : t('player.orders.trust.missing', 'Missing'),
        title: t('player.orders.trust.steamTitle', 'Delivery readiness'),
        detail: state.steamLink?.linked
          ? t('player.orders.trust.steamDetailReady', 'Steam link is present for item delivery flows.')
          : t('player.orders.trust.steamDetailMissing', 'Link SteamID if you buy items that deliver into the game.'),
      },
      {
        kicker: t('player.orders.trust.attentionKicker', 'Attention'),
        value: formatNumber(failed, '0'),
        title: t('player.orders.trust.attentionTitle', 'Orders needing follow-up'),
        detail: failed > 0
          ? t('player.orders.trust.attentionDetailBusy', 'Keep the purchase code and contact tenant admins if the state does not change after refresh.')
          : t('player.orders.trust.attentionDetailClear', 'No failed orders are visible right now.'),
      },
    ]);

    $('ordersTrustFeed').innerHTML = [
      {
        title: t('player.orders.feed.readableTitle', 'Readable status only'),
        detail: t('player.orders.feed.readableDetail', 'Orders show human-friendly states without exposing internal queue implementation details.'),
      },
      {
        title: t('player.orders.feed.codeTitle', 'Every order keeps its code'),
        detail: t('player.orders.feed.codeDetail', 'Use the purchase code as the safest reference when you need support or want to confirm the latest state.'),
      },
      {
        title: t('player.orders.feed.refreshTitle', 'Refresh happens automatically'),
        detail: t('player.orders.feed.refreshDetail', 'You can still refresh manually, but the portal also refreshes in the background while the tab remains visible.'),
      },
    ].map((item) => [
      '<article class="feed-item">',
      `<strong>${escapeHtml(item.title)}</strong>`,
      `<div class="muted">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('')).join('');

    $('ordersFeed').innerHTML = state.orders.length
      ? state.orders.map((row) => [
          '<article class="order-card">',
          `<div class="feed-meta">${pill(orderStatusLabel(row), toneFromStatus(row.status || 'pending'))} <span class="code">${escapeHtml(row.purchaseCode || row.code || '-')}</span></div>`,
          `<strong>${escapeHtml(row.itemName || row.itemId || t('player.orderDetail.purchase', 'Purchase'))}</strong>`,
          `<div class="muted">${escapeHtml(formatDateTime(row.createdAt))}</div>`,
          `<div class="muted">${escapeHtml(orderNextStep(row))}</div>`,
          Array.isArray(row.history) && row.history.length
            ? `<div class="order-timeline">${row.history.slice(0, 4).map((entry) => pill(orderStatusLabel({ status: entry.status || entry.toStatus || 'pending' }), 'info')).join('')}</div>`
            : `<div class="muted">${escapeHtml(t('player.orders.noTimeline', 'No timeline yet.'))}</div>`,
          row.bundle?.lines?.length
            ? `<div class="muted">${escapeHtml(t('player.orders.bundlePreview', 'Bundle: {items}', { items: row.bundle.lines.slice(0, 2).join(', ') }))}</div>`
            : '',
          (row.purchaseCode || row.code)
            ? `<div class="button-row"><button class="button" type="button" data-order-detail="${escapeHtml(row.purchaseCode || row.code)}">${escapeHtml(t('player.orders.viewDetails', 'View details'))}</button></div>`
            : '',
          '</article>',
        ].join('')).join('')
      : `<div class="empty-state">${escapeHtml(t('player.orders.empty', 'No purchase history yet.'))}</div>`;
  }

  function renderOrderDetailDrawer() {
    const backdrop = $('orderDetailBackdrop');
    if (!backdrop) return;
    const row = findOrderByCode(state.selectedOrderCode);
    if (!row) {
      backdrop.hidden = true;
      document.body.classList.remove('drawer-open');
      return;
    }

    const timeline = Array.isArray(row.history) && row.history.length
      ? row.history
      : [{
          status: row.status || 'pending',
          at: row.updatedAt || row.createdAt,
          detail: t('player.orderDetail.currentStoredState', 'Current stored state.'),
        }];
    const bundleLines = Array.isArray(row.bundle?.lines) ? row.bundle.lines : [];
    const quantity = Number(row.quantity || row.bundle?.quantity || 1);
    const code = row.purchaseCode || row.code || '-';

    $('orderDetailTitle').textContent = row.itemName || row.itemId || t('player.orderDetail.purchase', 'Purchase');
    $('orderDetailMeta').textContent = t('player.orderDetail.metaLine', 'Purchase code {code} • created {time}', { code, time: formatDateTime(row.createdAt) });
    $('orderDetailTags').innerHTML = [
      pill(orderStatusLabel(row), toneFromStatus(row.status || 'pending')),
      pill(
        state.steamLink?.linked
          ? t('player.profile.steamLinked', 'Steam linked')
          : t('player.profile.steamRequired', 'Steam required'),
        state.steamLink?.linked ? 'success' : 'warning'
      ),
      pill(row.itemKind || row.kind || 'item', 'neutral'),
    ].join('');

    renderStats($('orderDetailStats'), [
      {
        kicker: t('player.orderDetail.statusKicker', 'Status'),
        value: orderStatusLabel(row),
        title: t('player.orderDetail.stateTitle', 'Current order state'),
        detail: row.updatedAt ? t('player.orderDetail.stateDetail', 'Last updated {time}', { time: formatDateTime(row.updatedAt) }) : t('player.orderDetail.statePendingDetail', 'No later update recorded yet.'),
      },
      {
        kicker: t('player.orderDetail.quantityKicker', 'Quantity'),
        value: formatNumber(quantity, '1'),
        title: t('player.orderDetail.quantityTitle', 'Requested quantity'),
        detail: row.bundle?.lines?.length
          ? t('player.orderDetail.quantityDetailBundle', '{count} bundle lines visible', { count: formatNumber(bundleLines.length, '0') })
          : t('player.orderDetail.quantityDetailSingle', 'Single visible purchase line.'),
      },
      {
        kicker: t('player.orderDetail.amountKicker', 'Amount'),
        value: formatNumber(row.totalPrice || row.price || row.amount, '-'),
        title: t('player.orderDetail.amountTitle', 'Visible transaction amount'),
        detail: t('player.orderDetail.amountDetail', 'Shown exactly as returned by the current player purchase API.'),
      },
      {
        kicker: t('player.orderDetail.supportKicker', 'Support'),
        value: code,
        title: t('player.orderDetail.supportTitle', 'Reference code'),
        detail: t('player.orderDetail.supportDetail', 'Keep this code when you contact admins about a stuck or failed order.'),
      },
    ]);

    $('orderDetailTimeline').innerHTML = timeline.map((entry) => [
      '<article class="feed-item">',
      `<div class="feed-meta">${pill(orderStatusLabel({ status: entry.status || entry.toStatus || 'pending' }), toneFromStatus(entry.status || entry.toStatus || 'pending'))}</div>`,
      `<strong>${escapeHtml(entry.label || entry.message || entry.detail || t('player.orderDetail.timelineUpdated', 'Order state updated'))}</strong>`,
      `<div class="muted">${escapeHtml(formatDateTime(entry.at || entry.createdAt || entry.updatedAt || row.createdAt))}</div>`,
      entry.detail ? `<div class="muted">${escapeHtml(entry.detail)}</div>` : '',
      '</article>',
    ].join('')).join('');

    $('orderDetailBundle').innerHTML = bundleLines.length
      ? bundleLines.map((line) => [
          '<article class="feed-item">',
          `<strong>${escapeHtml(line?.name || line?.itemName || line?.id || line)}</strong>`,
          `<div class="muted">${escapeHtml(t('player.orderDetail.bundleLine', 'Bundle line recorded on this purchase.'))}</div>`,
          '</article>',
        ].join('')).join('')
      : [
          '<article class="feed-item">',
          `<strong>${escapeHtml(row.itemName || row.itemId || t('player.orderDetail.purchaseLine', 'Purchase line'))}</strong>`,
          `<div class="muted">${escapeHtml(t('player.orderDetail.quantityInline', 'Quantity {count}', { count: formatNumber(quantity, '1') }))}</div>`,
          '</article>',
        ].join('');

    $('orderDetailNextStep').innerHTML = [
      '<article class="feed-item">',
      `<strong>${escapeHtml(t('player.orderDetail.nextRecommended', 'Recommended next step'))}</strong>`,
      `<div class="muted">${escapeHtml(orderNextStep(row))}</div>`,
      '</article>',
      ...(normalizeOrderStatus(row.status) === 'delivery_failed'
        ? [[
            '<article class="feed-item">',
            `<strong>${escapeHtml(t('player.orderDetail.supportChecklist', 'Support checklist'))}</strong>`,
            `<div class="muted">${escapeHtml(t('player.orderDetail.supportChecklistDetail', 'Keep code {code}, confirm your Steam link, and wait for the next tenant-admin retry before buying again.', { code }))}</div>`,
            '</article>',
          ].join('')]
        : []),
    ].join('');

    backdrop.hidden = false;
    document.body.classList.add('drawer-open');
  }

  function openOrderDetail(code) {
    if (!findOrderByCode(code)) {
      activateTab('orders');
      setStatus(t('player.status.orderUnavailable', 'Order detail unavailable'), t('player.status.orderUnavailableDetail', 'The portal could not find purchase {code}. Refresh first, then try again.', { code }), [t('player.status.tag.ordersSimple', 'orders')], 'warning');
      return;
    }
    state.selectedOrderCode = String(code || '').trim();
    activateTab('orders');
    renderOrderDetailDrawer();
  }

  function closeOrderDetail() {
    state.selectedOrderCode = '';
    renderOrderDetailDrawer();
  }

  function renderRedeem() {
    renderTable(
      $('redeemHistoryTable'),
      [
        { label: t('player.redeem.table.code', 'Code'), render: (row) => `<span class="code">${escapeHtml(row.code || '-')}</span>` },
        { label: t('player.redeem.table.type', 'Type'), render: (row) => escapeHtml(row.type || '-') },
        { label: t('player.redeem.table.amount', 'Amount'), render: (row) => escapeHtml(formatNumber(row.amount, '-')) },
        { label: t('player.redeem.table.usedAt', 'Used At'), render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.usedAt))}</span>` },
      ],
      state.redeemHistory,
      t('player.redeem.empty', 'No redeem history yet.')
    );
  }

  function renderProfile() {
    renderTable(
      $('profileTable'),
      [
        { label: t('player.profile.table.field', 'Field'), render: (row) => `<strong>${escapeHtml(row.label)}</strong>` },
        { label: t('player.profile.table.value', 'Value'), render: (row) => escapeHtml(row.value || '-') },
      ],
      [
        { label: t('player.profile.field.displayName', 'Display Name'), value: state.profile?.displayName || state.profile?.username || state.me?.user || '-' },
        { label: t('player.profile.field.discordId', 'Discord ID'), value: state.profile?.discordId || state.me?.discordId || '-' },
        { label: t('player.profile.field.accountStatus', 'Account Status'), value: statusDisplayLabel(state.profile?.accountStatus || 'active') },
        { label: t('player.profile.field.createdAt', 'Created At'), value: formatDateTime(state.profile?.createdAt) },
        { label: t('player.profile.field.updatedAt', 'Updated At'), value: formatDateTime(state.profile?.updatedAt) },
      ],
      t('player.profile.empty', 'No profile data.')
    );

    $('steamLinkMeta').innerHTML = [
      '<article class="feed-item">',
      `<div class="feed-meta">${pill(statusDisplayLabel(state.steamLink?.linked ? 'linked' : 'unlinked'), state.steamLink?.linked ? 'success' : 'warning')}</div>`,
      `<strong>${escapeHtml(state.steamLink?.steamId || t('player.profile.noSteamLinked', 'No SteamID linked'))}</strong>`,
      `<div class="muted">${escapeHtml(state.steamLink?.inGameName || t('player.profile.noInGameName', 'No in-game name recorded'))}</div>`,
      `<div class="feed-meta"><span>${escapeHtml(formatDateTime(state.steamLink?.linkedAt))}</span></div>`,
      '</article>',
    ].join('');

    renderTable(
      $('steamHistoryTable'),
      [
        { label: t('player.profile.history.action', 'Action'), render: (row) => escapeHtml(row.action || '-') },
        { label: t('player.profile.history.steamId', 'SteamID'), render: (row) => `<span class="code">${escapeHtml(row.steamId || '-')}</span>` },
        { label: t('player.profile.history.inGameName', 'In-game Name'), render: (row) => escapeHtml(row.inGameName || '-') },
        { label: t('player.profile.history.at', 'At'), render: (row) => `<span class="code">${escapeHtml(formatDateTime(row.at))}</span>` },
      ],
      state.steamHistory,
      t('player.profile.emptySteamHistory', 'No Steam link history yet.')
    );
  }

  // Main player render pass. The portal intentionally keeps a small set of
  // task-oriented tabs: wallet, shop, orders, redeem, and profile.
  function renderAll() {
    const latestOrder = state.dashboard?.latestOrder || state.orders[0] || null;
    const pendingOrders = state.orders.filter((row) => ['pending', 'delivering'].includes(String(row.status || '').toLowerCase())).length;
    setStatus(
      state.me?.user ? t('player.status.signedIn', 'Signed in as {user}', { user: state.me.user }) : t('player.status.ready', 'Player portal ready'),
      t('player.status.detail', 'This portal is optimized for wallet, purchase, redeem, profile, and Steam-link journeys.'),
      [
        t('player.status.tag.wallet', 'wallet {count}', { count: formatNumber(state.walletLedger?.wallet?.balance, '0') }),
        t('player.status.tag.orders', 'orders {count}', { count: formatNumber(state.orders.length, '0') }),
        latestOrder ? t('player.status.tag.latest', 'latest {status}', { status: orderStatusLabel(latestOrder) }) : t('player.status.tag.latestEmpty', 'latest -'),
        t('player.status.tag.pending', 'pending {count}', { count: formatNumber(pendingOrders, '0') }),
        state.lastRefreshedAt
          ? t('player.meta.synced', 'Synced {time}', { time: formatDateTime(state.lastRefreshedAt) })
          : t('player.meta.syncPending', 'Sync pending'),
      ],
      pendingOrders > 0 ? 'warning' : 'info'
    );
    renderHome();
    renderWallet();
    renderShop();
    renderOrders();
    renderRedeem();
    renderProfile();
    renderOrderDetailDrawer();
    window.PortalUiI18n?.translateLiterals?.(document);
  }

  // One refresh cycle loads all player-facing data without changing backend
  // routes. This is the safest place to add/remove a player page dependency.
  async function refreshAll() {
    setButtonBusy($('refreshBtn'), true, `${t('common.refresh', 'Refresh')}...`);
    try {
      const [
        me,
        dashboard,
        serverInfo,
        walletLedger,
        shopList,
        cart,
        purchaseList,
        redeemHistory,
        profile,
        steamLink,
        steamHistory,
        notifications,
      ] = await Promise.all([
        api('/player/api/me'),
        api('/player/api/dashboard'),
        api('/player/api/server/info'),
        api('/player/api/wallet/ledger?limit=20'),
        api('/player/api/shop/list?limit=80'),
        api('/player/api/cart'),
        api('/player/api/purchase/list?limit=25&includeHistory=1'),
        api('/player/api/redeem/history?limit=20'),
        api('/player/api/profile'),
        api('/player/api/linksteam/me'),
        api('/player/api/linksteam/history'),
        api('/player/api/notifications?limit=10'),
      ]);

      state.me = me;
      state.dashboard = dashboard;
      state.serverInfo = serverInfo;
      state.walletLedger = walletLedger;
      state.shopItems = Array.isArray(shopList?.items) ? shopList.items : [];
      state.cart = cart || {};
      state.orders = Array.isArray(purchaseList?.items) ? purchaseList.items : [];
      state.redeemHistory = Array.isArray(redeemHistory?.items) ? redeemHistory.items : [];
      state.profile = profile || {};
      state.steamLink = steamLink || {};
      state.steamHistory = Array.isArray(steamHistory?.items) ? steamHistory.items : [];
      state.notifications = Array.isArray(notifications?.items) ? notifications.items : [];
      state.lastRefreshedAt = new Date().toISOString();
      renderAll();
    } catch (error) {
      setStatus(t('player.status.loadFailed', 'Portal load failed'), String(error.message || error), [t('player.status.tag.retry', 'retry available')], 'danger');
    } finally {
      setButtonBusy($('refreshBtn'), false);
    }
  }

  async function runAction(button, work) {
    setButtonBusy(button, true, t('common.working', 'Working...'));
    try {
      await work();
    } catch (error) {
      setStatus(t('player.status.actionFailed', 'Action failed'), String(error.message || error), [t('player.status.tag.review', 'review required')], 'danger');
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function claimReward(kind) {
    const button = kind === 'weekly' ? $('claimWeeklyBtn') : $('claimDailyBtn');
    const endpoint = kind === 'weekly' ? '/player/api/weekly/claim' : '/player/api/daily/claim';
    await runAction(button, async () => {
      await api(endpoint, { method: 'POST', body: {} });
      showToast(kind === 'weekly' ? t('player.toast.weeklyClaimed', 'Weekly reward claimed.') : t('player.toast.dailyClaimed', 'Daily reward claimed.'), 'success');
      await refreshAll();
      activateTab('wallet');
    });
  }

  async function logout() {
    await runAction($('logoutBtn'), async () => {
      await api('/player/api/logout', { method: 'POST', body: {} });
      window.location.href = '/player/login';
    });
  }

  async function clearCart() {
    await runAction($('cartClearBtn'), async () => {
      await api('/player/api/cart/clear', { method: 'POST', body: {} });
      showToast(t('player.toast.cartCleared', 'Cart cleared.'), 'info');
      await refreshAll();
    });
  }

  async function checkoutCart() {
    await runAction($('cartCheckoutBtn'), async () => {
      await api('/player/api/cart/checkout', { method: 'POST', body: {} });
      showToast(t('player.toast.checkoutDone', 'Checkout completed.'), 'success');
      await refreshAll();
      activateTab('orders');
    });
  }

  async function redeemCode(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const code = String(form.elements.code.value || '').trim();
    if (!code) {
      setStatus(t('player.status.emptyRedeem', 'Redeem code is empty'), t('player.status.emptyRedeemDetail', 'Enter a redeem code before submitting.'), [t('player.status.tag.redeem', 'redeem')], 'danger');
      return;
    }
    await runAction(button, async () => {
      await api('/player/api/redeem', {
        method: 'POST',
        body: { code },
      });
      form.reset();
      showToast(t('player.toast.redeemApplied', 'Redeem code applied.'), 'success');
      await refreshAll();
    });
  }

  async function linkSteam(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const steamId = String(form.elements.steamId.value || '').trim();
    if (!steamId) {
      setStatus(t('player.status.emptySteam', 'SteamID is required'), t('player.status.emptySteamDetail', 'Enter a numeric SteamID before linking.'), [t('player.status.tag.steam', 'steam')], 'danger');
      return;
    }
    await runAction(button, async () => {
      await api('/player/api/linksteam/set', {
        method: 'POST',
        body: { steamId },
      });
      showToast(t('player.toast.steamUpdated', 'Steam link updated.'), 'success');
      await refreshAll();
    });
  }

  async function unlinkSteam() {
    await runAction($('unlinkSteamBtn'), async () => {
      await api('/player/api/linksteam/unset', {
        method: 'POST',
        body: {},
      });
      await refreshAll();
    });
  }

  $('refreshBtn').addEventListener('click', refreshAll);
  $('logoutBtn').addEventListener('click', logout);
  $('claimDailyBtn').addEventListener('click', () => claimReward('daily'));
  $('claimWeeklyBtn').addEventListener('click', () => claimReward('weekly'));
  $('cartClearBtn').addEventListener('click', clearCart);
  $('cartCheckoutBtn').addEventListener('click', checkoutCart);
  $('redeemForm').addEventListener('submit', redeemCode);
  $('steamLinkForm').addEventListener('submit', linkSteam);
  $('unlinkSteamBtn').addEventListener('click', unlinkSteam);
  $('shopSearchInput').addEventListener('input', (event) => {
    state.filters.shopQuery = event.target.value || '';
    renderShop();
  });
  $('shopKindSelect').addEventListener('change', (event) => {
    state.filters.shopKind = event.target.value || 'all';
    renderShop();
  });
  $('homeLatestOrderBtn').addEventListener('click', () => {
    const code = $('homeLatestOrderBtn').dataset.orderCode || '';
    if (code) {
      openOrderDetail(code);
    }
  });
  $('homeNotifications').addEventListener('click', (event) => {
    const orderButton = event.target.closest('[data-notification-order]');
    if (orderButton) {
      openOrderDetail(orderButton.dataset.notificationOrder || '');
      return;
    }
    const tabButton = event.target.closest('[data-notification-tab]');
    if (tabButton) {
      activateTab(tabButton.dataset.notificationTab || 'home');
    }
  });
  $('homeFirstRunGuide').addEventListener('click', (event) => {
    const orderButton = event.target.closest('[data-guide-order]');
    if (orderButton) {
      openOrderDetail(orderButton.dataset.guideOrder || '');
      return;
    }
    const tabButton = event.target.closest('[data-guide-tab]');
    if (tabButton) {
      activateTab(tabButton.dataset.guideTab || 'home');
    }
  });
  $('homeTaskHub').addEventListener('click', (event) => {
    const orderButton = event.target.closest('[data-task-order]');
    if (orderButton) {
      openOrderDetail(orderButton.dataset.taskOrder || '');
      return;
    }
    const tabButton = event.target.closest('[data-task-tab]');
    if (tabButton) {
      activateTab(tabButton.dataset.taskTab || 'home');
    }
  });
  $('ordersFeed').addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-detail]');
    if (!button) return;
    openOrderDetail(button.dataset.orderDetail || '');
  });
  $('orderDetailCloseBtn').addEventListener('click', closeOrderDetail);
  $('orderDetailBackdrop').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeOrderDetail();
    }
  });
  Array.from(document.querySelectorAll('.nav-btn')).forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.selectedOrderCode) {
      closeOrderDetail();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshAll();
    }
  });

  intervalHandle = window.setInterval(() => {
    if (!document.hidden) {
      refreshAll();
    }
  }, 45000);

  window.addEventListener('beforeunload', () => {
    if (intervalHandle) {
      window.clearInterval(intervalHandle);
    }
  });

  window.PortalUiI18n?.init?.(['playerLanguageSelect']);
  renderPlayerPageContext(state.activeTab);
  window.addEventListener('ui-language-change', () => {
    renderPlayerPageContext();
    renderAll();
  });

  refreshAll();
})();
