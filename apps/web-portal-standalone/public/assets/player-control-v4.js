(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./player-v4-shared.js'));
    return;
  }
  root.PlayerControlV4 = factory(root.PlayerV4Shared);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (shared) {
  'use strict';

  if (!shared) {
    throw new Error('PlayerControlV4 requires PlayerV4Shared');
  }

  const {
    badge,
    escapeHtml,
    firstNonEmpty,
    formatAmount,
    formatDateTime,
    formatNumber,
    formatRelative,
    orderStatusLabel,
    renderBadges,
    renderFeed,
    renderKeyValueList,
    renderNavGroups,
    renderProductGrid,
    renderRailCards,
    renderSummaryStrip,
    renderTable,
    renderTaskGroups,
    toneForStatus,
  } = shared;

  const PLAYER_PAGE_KEYS = [
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

  const PAGE_META = {
    home: { path: '/player/home', navLabel: 'หน้าหลัก', docLabel: 'หน้าหลัก', sectionKey: 'home' },
    stats: { path: '/player/stats', navLabel: 'สถิติ', docLabel: 'สถิติ', sectionKey: 'stats' },
    leaderboard: { path: '/player/leaderboard', navLabel: 'อันดับ', docLabel: 'อันดับ', sectionKey: 'leaderboard' },
    shop: { path: '/player/shop', navLabel: 'ร้านค้า', docLabel: 'ร้านค้า', sectionKey: 'shop' },
    orders: { path: '/player/orders', navLabel: 'คำสั่งซื้อ', docLabel: 'คำสั่งซื้อ', sectionKey: 'orders' },
    delivery: { path: '/player/delivery', navLabel: 'การส่งของ', docLabel: 'การส่งของ', sectionKey: 'delivery' },
    events: { path: '/player/events', navLabel: 'กิจกรรม', docLabel: 'กิจกรรม', sectionKey: 'events' },
    donations: { path: '/player/donations', navLabel: 'สนับสนุนเซิร์ฟเวอร์', docLabel: 'สนับสนุนเซิร์ฟเวอร์', sectionKey: 'donations' },
    profile: { path: '/player/profile', navLabel: 'โปรไฟล์', docLabel: 'โปรไฟล์', sectionKey: 'profile' },
    support: { path: '/player/support', navLabel: 'ช่วยเหลือ', docLabel: 'ช่วยเหลือ', sectionKey: 'support' },
  };

  const LEGACY_PAGE_ALIASES = {
    '': 'home',
    player: 'home',
    home: 'home',
    shop: 'shop',
    wallet: 'shop',
    cart: 'shop',
    commerce: 'shop',
    orders: 'orders',
    delivery: 'delivery',
    donations: 'donations',
    stats: 'stats',
    leaderboard: 'leaderboard',
    leaderboards: 'leaderboard',
    activity: 'support',
    events: 'events',
    support: 'support',
    profile: 'profile',
  };

  function localizePlayerStatus(value) {
    const raw = String(value || '').trim();
    const text = raw.toLowerCase();
    if (!text) return '-';
    if (text === 'active') return 'ใช้งานอยู่';
    if (text === 'inactive') return 'ไม่ใช้งาน';
    if (text === 'linked') return 'เชื่อมแล้ว';
    if (text === 'online') return 'ออนไลน์';
    if (text === 'offline') return 'ออฟไลน์';
    if (text === 'delivered') return 'ส่งสำเร็จ';
    if (text === 'delivery_failed' || text === 'delivery failed') return 'ส่งไม่สำเร็จ';
    if (text === 'delivering') return 'กำลังส่งของ';
    if (text === 'processing') return 'กำลังดำเนินการ';
    if (text === 'pending') return 'รอดำเนินการ';
    if (text === 'approved') return 'อนุมัติแล้ว';
    if (text === 'rejected') return 'ปฏิเสธ';
    if (text === 'scheduled') return 'ตั้งเวลาแล้ว';
    if (text === 'completed') return 'เสร็จแล้ว';
    if (text === 'canceled' || text === 'cancelled') return 'ยกเลิกแล้ว';
    if (text === 'live') return 'กำลังเกิดขึ้น';
    if (text === 'used') return 'ใช้แล้ว';
    if (text === 'recorded') return 'บันทึกแล้ว';
    if (text === 'warning') return 'แจ้งเตือน';
    if (text === 'success') return 'สำเร็จ';
    if (text === 'failed') return 'ล้มเหลว';
    return raw;
  }

  function buildCanonicalPlayerPath(pageKey) {
    return PAGE_META[pageKey]?.path || PAGE_META.home.path;
  }

  function localizeVerificationState(value) {
    const raw = String(value || '').trim();
    const text = raw.toLowerCase();
    if (!text) return 'ยังไม่ยืนยัน';
    if (text === 'fully_verified') return 'ยืนยันครบแล้ว';
    if (text === 'verified') return 'ยืนยันแล้ว';
    if (text === 'pending') return 'รอตรวจสอบ';
    if (text === 'unverified') return 'ยังไม่ยืนยัน';
    return raw;
  }

  function localizeYesNo(value) {
    return value ? 'ใช่' : 'ไม่';
  }

  function localizeMembershipRole(value) {
    const raw = String(value || '').trim();
    const text = raw.toLowerCase();
    if (!text) return 'สมาชิก';
    if (text === 'player') return 'ผู้เล่น';
    if (text === 'member') return 'สมาชิก';
    if (text === 'tenant') return 'สมาชิกเซิร์ฟเวอร์';
    if (text === 'tenant_admin' || text === 'tenant-admin') return 'ผู้ดูแลเซิร์ฟเวอร์';
    if (text === 'owner') return 'เจ้าของระบบ';
    if (text === 'guest') return 'ผู้เยี่ยมชม';
    return raw;
  }

  function formatMembershipValue(activeMembership) {
    if (!activeMembership) return 'ยังไม่มีสิทธิ์ใช้งาน';
    const role = localizeMembershipRole(firstNonEmpty([activeMembership.role, activeMembership.membershipType], 'member'));
    const status = localizePlayerStatus(firstNonEmpty([activeMembership.status], 'active'));
    return `${role} (${status})`;
  }

  function formatLinkedAccountValue(account, fallback) {
    if (!account || !account.linked) return fallback || 'ยังไม่เชื่อม';
    const value = firstNonEmpty([account.value], 'เชื่อมแล้ว');
    return `${value}${account.verified ? ' (ยืนยันแล้ว)' : ' (ยังไม่ยืนยัน)'}`;
  }

  function resolvePlayerPageKey(rawPage) {
    const normalized = String(rawPage || '').trim().toLowerCase();
    return LEGACY_PAGE_ALIASES[normalized] || 'home';
  }

  function sectionAccess(featureAccess, pageKey) {
    const sectionKey = PAGE_META[pageKey]?.sectionKey || pageKey;
    return featureAccess?.sections?.[sectionKey] || null;
  }

  function isPageEnabled(featureAccess, pageKey) {
    const entry = sectionAccess(featureAccess, pageKey);
    if (!entry || typeof entry.enabled !== 'boolean') {
      return true;
    }
    return entry.enabled;
  }

  function navLabelForPage(pageKey, featureAccess) {
    const label = PAGE_META[pageKey]?.navLabel || 'Page';
    return isPageEnabled(featureAccess, pageKey) ? label : `${label} (ล็อก)`;
  }

  function createPlayerPortalNavGroups(currentPage, featureAccess) {
    return [
      {
        label: 'หน้าแรก',
        items: [
          {
            label: navLabelForPage('home', featureAccess),
            href: buildCanonicalPlayerPath('home'),
            current: currentPage === 'home',
          },
        ],
      },
      {
        label: 'การเล่น',
        items: [
          {
            label: navLabelForPage('stats', featureAccess),
            href: buildCanonicalPlayerPath('stats'),
            current: currentPage === 'stats',
          },
          {
            label: navLabelForPage('leaderboard', featureAccess),
            href: buildCanonicalPlayerPath('leaderboard'),
            current: currentPage === 'leaderboard',
          },
          {
            label: navLabelForPage('events', featureAccess),
            href: buildCanonicalPlayerPath('events'),
            current: currentPage === 'events',
          },
        ],
      },
      {
        label: 'ร้านค้า',
        items: [
          {
            label: navLabelForPage('shop', featureAccess),
            href: buildCanonicalPlayerPath('shop'),
            current: currentPage === 'shop',
          },
          {
            label: navLabelForPage('orders', featureAccess),
            href: buildCanonicalPlayerPath('orders'),
            current: currentPage === 'orders',
          },
          {
            label: navLabelForPage('delivery', featureAccess),
            href: buildCanonicalPlayerPath('delivery'),
            current: currentPage === 'delivery',
          },
          {
            label: navLabelForPage('donations', featureAccess),
            href: buildCanonicalPlayerPath('donations'),
            current: currentPage === 'donations',
          },
        ],
      },
      {
        label: 'บัญชี',
        items: [
          {
            label: navLabelForPage('profile', featureAccess),
            href: buildCanonicalPlayerPath('profile'),
            current: currentPage === 'profile',
          },
          {
            label: navLabelForPage('support', featureAccess),
            href: buildCanonicalPlayerPath('support'),
            current: currentPage === 'support',
          },
        ],
      },
    ];
  }

  function buildLatestOrder(state) {
    const row = state?.dashboard?.latestOrder || (Array.isArray(state?.orders) ? state.orders[0] : null) || null;
    if (!row) return null;
    return {
      code: firstNonEmpty([row.purchaseCode, row.code], '-'),
      itemName: firstNonEmpty([row.itemName, row.productName, row.itemId], 'ไม่ทราบรายการ'),
      status: orderStatusLabel(row.statusText || row.status),
      statusTone: toneForStatus(row.status || row.statusText),
      createdAt: formatDateTime(row.createdAt || row.updatedAt),
      rawStatus: String(row.status || row.statusText || '').trim().toLowerCase(),
    };
  }

  function isSupporterLikeItem(item) {
    const kind = String(item?.kind || item?.itemKind || '').trim().toLowerCase();
    const haystack = `${item?.name || item?.itemName || ''} ${item?.description || ''}`.toLowerCase();
    return kind === 'vip' || kind === 'supporter' || /support|donation|member|vip/.test(haystack);
  }

  function createCommunityFeed(state) {
    const notifications = Array.isArray(state?.notifications) ? state.notifications : [];
    const announcements = Array.isArray(state?.dashboard?.announcements) ? state.dashboard.announcements : [];
    const raidTimes = Array.isArray(state?.serverInfo?.raidTimes) ? state.serverInfo.raidTimes : [];
    const items = notifications.slice(0, 5).map((item) => ({
      category: item.type || 'Update',
      tone: toneForStatus(item.severity || item.type),
      title: firstNonEmpty([item.title, item.message], 'มีอัปเดตใหม่'),
      detail: firstNonEmpty([item.detail, item.message], 'มีข้อมูลอัปเดตใหม่ในฟีดของพอร์ทัลผู้เล่น'),
      meta: formatRelative(item.createdAt || item.at),
      action: {
        label: /order|delivery|purchase/i.test(`${item.title || ''} ${item.detail || ''} ${item.type || ''}`)
          ? 'เปิดคำสั่งซื้อ'
          : 'เปิดโปรไฟล์',
        href: /order|delivery|purchase/i.test(`${item.title || ''} ${item.detail || ''} ${item.type || ''}`)
          ? buildCanonicalPlayerPath('orders')
          : buildCanonicalPlayerPath('profile'),
      },
    }));
    announcements
      .concat(raidTimes)
      .filter(Boolean)
      .slice(0, 4)
      .forEach((text, index) => {
        items.push({
          category: index === 0 ? 'ชุมชน' : 'ตารางเวลา',
          tone: 'info',
          title: index === 0 ? 'ประกาศจากเซิร์ฟเวอร์' : 'ช่วงเวลาเรด',
          detail: String(text || '').trim(),
          meta: firstNonEmpty([state?.serverInfo?.serverInfo?.name], 'อัปเดตจากเซิร์ฟเวอร์'),
          action: {
            label: 'เปิดหน้ากิจกรรม',
            href: buildCanonicalPlayerPath('events'),
          },
        });
      });
    return items.slice(0, 8);
  }

  function createPlayerFacts(state) {
    const featureAccess = state?.featureAccess || {};
    const wallet = state?.walletLedger?.wallet || state?.dashboard?.wallet || {};
    const orders = Array.isArray(state?.orders) ? state.orders : [];
    const redeemHistory = Array.isArray(state?.redeemHistory) ? state.redeemHistory : [];
    const shopItems = Array.isArray(state?.shopItems) ? state.shopItems : [];
    const notifications = Array.isArray(state?.notifications) ? state.notifications : [];
    const missions = Array.isArray(state?.missions?.missions) ? state.missions.missions : [];
    const bounties = Array.isArray(state?.bounties?.items)
      ? state.bounties.items
      : (Array.isArray(state?.bounties) ? state.bounties : []);
    const leaderboardItems = Array.isArray(state?.leaderboard?.items) ? state.leaderboard.items : [];
    const linkHistory = Array.isArray(state?.linkHistory?.items)
      ? state.linkHistory.items
      : (Array.isArray(state?.linkHistory) ? state.linkHistory : []);
    const raids = state?.raids && typeof state.raids === 'object' ? state.raids : {};
    const raidRequests = Array.isArray(raids?.myRequests) ? raids.myRequests : [];
    const raidWindows = Array.isArray(raids?.windows) ? raids.windows : [];
    const raidSummaries = Array.isArray(raids?.summaries) ? raids.summaries : [];
    const killfeed = Array.isArray(state?.killfeed) ? state.killfeed : [];
    const steamLink = state?.steamLink || {};
    const identitySummary = state?.profile?.identitySummary || {};
    const stats = state?.stats || {};
    const party = state?.party || {};
    const serverInfo = state?.serverInfo?.serverInfo || {};
    const serverStatus = state?.serverInfo?.status || {};
    const cart = state?.cart || {};
    const wheelState = state?.wheelState || {};
    const latestOrder = buildLatestOrder(state);
    const pendingOrders = orders.filter((row) => {
      const status = String(row?.status || '').trim().toLowerCase();
      return status === 'pending' || status === 'queued' || status === 'delivering';
    });
    const failedOrders = orders.filter((row) => String(row?.status || '').trim().toLowerCase() === 'delivery_failed');
    const deliveredOrders = orders.filter((row) => String(row?.status || '').trim().toLowerCase() === 'delivered');
    const myRank = leaderboardItems.find((row) => Boolean(row?.isSelf)) || leaderboardItems[0] || null;
    const supportAlerts = notifications.filter((item) => ['warning', 'error'].includes(String(item?.severity || '').toLowerCase()));
    const supporterItems = shopItems.filter((item) => isSupporterLikeItem(item));
    const supporterItemIds = new Set(
      supporterItems
        .map((item) => String(item?.id || '').trim())
        .filter(Boolean),
    );
    const donationOrders = orders.filter((row) => {
      const itemId = String(row?.itemId || '').trim();
      return supporterItemIds.has(itemId) || isSupporterLikeItem(row);
    });
    const latestDonationOrder = donationOrders[0] || null;
    const activeSupporterOrder = donationOrders.find((row) => {
      const status = String(row?.status || row?.statusText || '').trim().toLowerCase();
      return ['pending', 'queued', 'processing', 'delivering', 'delivered', 'active'].includes(status);
    }) || null;
    return {
      state,
      featureAccess,
      wallet,
      orders,
      redeemHistory,
      shopItems,
      supporterItems,
      donationOrders,
      latestDonationOrder,
      activeSupporterOrder,
      notifications,
      communityFeed: createCommunityFeed(state),
      missions,
      bounties,
      leaderboardItems,
      linkHistory,
      raidRequests,
      raidWindows,
      raidSummaries,
      killfeed,
      steamLink,
      identitySummary,
      stats,
      party,
      serverInfo,
      serverStatus,
      cart,
      wheelState,
      latestOrder,
      pendingOrders,
      failedOrders,
      deliveredOrders,
      myRank,
      supportAlerts,
    };
  }

  function buildNotice(state, pageKey) {
    if (state?.__surfaceNotice) return state.__surfaceNotice;
    const access = sectionAccess(state?.featureAccess, pageKey);
    if (!access || access.enabled !== false) return null;
    return {
      tone: 'warning',
      title: `${PAGE_META[pageKey]?.navLabel || 'หน้านี้'} ยังไม่เปิดให้ใช้กับเซิร์ฟเวอร์นี้`,
      detail: 'หน้านี้เป็นส่วนหนึ่งของพอร์ทัลผู้เล่นจริง แต่แพ็กเกจของเซิร์ฟเวอร์นี้ยังไม่เปิดฟีเจอร์สดให้ใช้งาน',
    };
  }

  function buildShell(state, pageKey) {
    return {
      brand: 'SCUM TH',
      surfaceLabel: 'พอร์ทัลผู้เล่น',
      workspaceLabel: firstNonEmpty([state?.profile?.displayName, state?.me?.user], 'พื้นที่ผู้เล่น'),
      environmentLabel: firstNonEmpty([state?.serverInfo?.serverInfo?.name], 'ชุมชนผู้เล่น SCUM'),
      navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
        ? state.__surfaceShell.navGroups
        : createPlayerPortalNavGroups(pageKey, state?.featureAccess),
    };
  }

  function buildOrdersTable(rows) {
    return renderTable(
      [
        { label: 'รหัส', render: (row) => escapeHtml(firstNonEmpty([row.purchaseCode, row.code], '-')) },
        { label: 'รายการ', render: (row) => escapeHtml(firstNonEmpty([row.itemName, row.productName, row.itemId], '-')) },
        {
          label: 'สถานะ',
          render: (row) => badge(localizePlayerStatus(orderStatusLabel(row.statusText || row.status)), toneForStatus(row.status || row.statusText)),
        },
        { label: 'รวม', render: (row) => escapeHtml(formatAmount(row.totalPrice || row.amount || row.price, '0')) },
        { label: 'อัปเดต', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt)) },
      ],
      rows,
      'ยังไม่มีคำสั่งซื้อของผู้เล่น',
    );
  }

  function buildDeliveryTable(rows) {
    return renderTable(
      [
        { label: 'รหัส', render: (row) => escapeHtml(firstNonEmpty([row.purchaseCode, row.code], '-')) },
        { label: 'รายการ', render: (row) => escapeHtml(firstNonEmpty([row.itemName, row.productName, row.itemId], '-')) },
        {
          label: 'การส่งของ',
          render: (row) => badge(localizePlayerStatus(orderStatusLabel(row.statusText || row.status)), toneForStatus(row.status || row.statusText)),
        },
        {
          label: 'สิ่งที่ควรทำต่อ',
          render: (row) => {
            const status = String(row?.status || '').trim().toLowerCase();
            if (status === 'delivery_failed') return escapeHtml('เตรียมรหัสคำสั่งซื้อไว้แล้วเปิดหน้าช่วยเหลือ');
            if (status === 'delivered') return escapeHtml('เปิดเกมเพื่อตรวจผลการส่งของที่สำเร็จแล้ว');
            return escapeHtml('รอให้คิวการส่งของทำงานเสร็จ');
          },
        },
      ],
      rows,
      'ยังไม่มีกิจกรรมการส่งของให้แสดงตอนนี้',
    );
  }

  function buildLeaderboardTable(rows) {
    return renderTable(
      [
        {
          label: 'อันดับ',
          render: (row) => escapeHtml(`${formatNumber(row.rank, '-')}${row.isSelf ? ' *' : ''}`),
        },
        { label: 'ผู้เล่น', render: (row) => escapeHtml(firstNonEmpty([row.name, row.userId], '-')) },
        { label: 'คิล', render: (row) => escapeHtml(formatNumber(row.kills, '0')) },
        {
          label: 'KD',
          render: (row) => escapeHtml(Number.isFinite(Number(row.kd)) ? Number(row.kd).toFixed(2) : '0.00'),
        },
      ],
      rows,
      'ข้อมูลอันดับจะขึ้นที่นี่หลังเซิร์ฟเวอร์ซิงก์ข้อมูลเรียบร้อย',
    );
  }

  function buildWalletTable(rows) {
    return renderTable(
      [
        { label: 'เวลา', render: (row) => escapeHtml(formatDateTime(row.createdAt)) },
        { label: 'เปลี่ยนแปลง', render: (row) => escapeHtml(`${Number(row.delta || 0) > 0 ? '+' : ''}${formatAmount(row.delta, '0')}`) },
        { label: 'ยอดคงเหลือ', render: (row) => escapeHtml(formatAmount(row.balanceAfter, '0')) },
        { label: 'เหตุผล', render: (row) => escapeHtml(firstNonEmpty([row.reasonLabel, row.reason], '-')) },
      ],
      rows,
      'ยังไม่มีประวัติกระเป๋าเงิน',
    );
  }

  function buildLinkHistoryTable(rows) {
    return renderTable(
      [
        { label: 'เวลา', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.at)) },
        { label: 'ผู้ให้บริการ', render: (row) => escapeHtml(firstNonEmpty([row.provider, row.type], '-')) },
        { label: 'สถานะ', render: (row) => badge(localizePlayerStatus(firstNonEmpty([row.status, row.result], 'บันทึกแล้ว')), toneForStatus(row.status || row.result)) },
        { label: 'ข้อมูลอ้างอิง', render: (row) => escapeHtml(firstNonEmpty([row.reference, row.steamId, row.email], '-')) },
      ],
      rows,
      'ยังไม่มีประวัติการเชื่อมบัญชี',
    );
  }

  function buildRedeemTable(rows) {
    return renderTable(
      [
        { label: 'โค้ด', render: (row) => escapeHtml(firstNonEmpty([row.code], '-')) },
        { label: 'ผลลัพธ์', render: (row) => badge(localizePlayerStatus(firstNonEmpty([row.status, row.result], 'ใช้แล้ว')), toneForStatus(row.status || row.result)) },
        { label: 'เวลา', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.redeemedAt || row.at)) },
      ],
      rows,
      'ยังไม่มีประวัติการรับของรางวัลหรือใช้โค้ด',
    );
  }

  function buildMissionTable(rows) {
    return renderTable(
      [
        { label: 'ภารกิจ', render: (row) => escapeHtml(firstNonEmpty([row.title], 'ภารกิจ')) },
        { label: 'หมวด', render: (row) => escapeHtml(firstNonEmpty([row.category], '-')) },
        {
          label: 'สถานะ',
          render: (row) => badge(row.claimable ? 'รับได้' : firstNonEmpty([row.remainingText], 'กำลังดำเนินการ'), row.claimable ? 'success' : 'info'),
        },
      ],
      rows,
      'ตอนนี้ยังไม่มีภารกิจที่กำลังเปิดอยู่',
    );
  }

  function buildBountyFeed(rows) {
    const items = rows.map((row) => ({
      category: 'ค่าหัว',
      tone: 'warning',
      title: firstNonEmpty([row.title, row.name], 'ภารกิจค่าหัว'),
      detail: firstNonEmpty([row.description, row.rewardLabel], 'ตรวจรายละเอียดกิจกรรมจากฟีดชุมชน'),
      meta: firstNonEmpty([row.rewardLabel], 'มีรางวัลให้รับ'),
      action: {
        label: 'เปิดอันดับ',
        href: buildCanonicalPlayerPath('leaderboard'),
      },
    }));
    return renderFeed(items, 'ตอนนี้ยังไม่มีค่าหัวที่กำลังเปิดอยู่');
  }

  function buildKillFeedFeed(rows) {
    const items = (Array.isArray(rows) ? rows : []).map((row) => {
      const detailParts = [
        firstNonEmpty([row.weapon], 'อาวุธไม่ทราบชนิด'),
        row.distance != null ? `${formatNumber(row.distance, '0')}m` : '',
        firstNonEmpty([row.sector], ''),
      ].filter(Boolean);
      const isPlayerKill = row.playerRole === 'killer';
      const isPlayerDeath = row.playerRole === 'victim';
      return {
        category: isPlayerKill ? 'คิลของคุณ' : isPlayerDeath ? 'คุณถูกจัดการ' : 'ฟีดการต่อสู้',
        tone: isPlayerKill ? 'success' : isPlayerDeath ? 'danger' : 'warning',
        title: `${firstNonEmpty([row.killerName], 'ไม่ทราบชื่อ')} จัดการ ${firstNonEmpty([row.victimName], 'ไม่ทราบชื่อ')}`,
        detail: detailParts.join(' | ') || 'เหตุการณ์การต่อสู้',
        meta: formatDateTime(row.occurredAt || row.createdAt),
        action: {
          label: isPlayerKill || isPlayerDeath ? 'เปิดโปรไฟล์' : 'เปิดหน้าอันดับ',
          href: isPlayerKill || isPlayerDeath
            ? buildCanonicalPlayerPath('profile')
            : buildCanonicalPlayerPath('leaderboard'),
        },
      };
    });
    return renderFeed(items, 'ยังไม่มีฟีดการต่อสู้ให้แสดง');
  }

  function buildRaidRequestTable(rows) {
    return renderTable(
      [
        { label: 'เวลาที่ส่งคำขอ', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.updatedAt)) },
        { label: 'ช่วงเวลาที่อยากได้', render: (row) => escapeHtml(firstNonEmpty([row.preferredWindow], '-')) },
        { label: 'รายละเอียดคำขอ', render: (row) => escapeHtml(firstNonEmpty([row.requestText], '-')) },
        {
          label: 'สถานะ',
          render: (row) => badge(localizePlayerStatus(firstNonEmpty([row.status], 'pending')), toneForStatus(row.status)),
        },
        { label: 'โน้ตจากทีมงาน', render: (row) => escapeHtml(firstNonEmpty([row.decisionNote], '-')) },
      ],
      rows,
      'ยังไม่มีคำขอเรดที่ส่งไว้',
    );
  }

  function buildRaidWindowTable(rows) {
    return renderTable(
      [
        { label: 'ชื่อช่วงเวลา', render: (row) => escapeHtml(firstNonEmpty([row.title], 'ช่วงเวลาเรด')) },
        { label: 'เริ่ม', render: (row) => escapeHtml(formatDateTime(row.startsAt)) },
        { label: 'สิ้นสุด', render: (row) => escapeHtml(formatDateTime(row.endsAt)) },
        {
          label: 'สถานะ',
          render: (row) => badge(localizePlayerStatus(firstNonEmpty([row.status], 'scheduled')), toneForStatus(row.status)),
        },
        { label: 'หมายเหตุ', render: (row) => escapeHtml(firstNonEmpty([row.notes], '-')) },
      ],
      rows,
      'ยังไม่มีช่วงเวลาเรดที่ประกาศไว้',
    );
  }

  function buildRaidSummaryTable(rows) {
    return renderTable(
      [
        { label: 'ประกาศเมื่อ', render: (row) => escapeHtml(formatDateTime(row.createdAt)) },
        { label: 'ผลลัพธ์', render: (row) => escapeHtml(firstNonEmpty([row.outcome], '-')) },
        { label: 'หมายเหตุ', render: (row) => escapeHtml(firstNonEmpty([row.notes], '-')) },
        { label: 'อ้างอิงช่วงเวลา', render: (row) => escapeHtml(firstNonEmpty([row.windowId], '-')) },
      ],
      rows,
      'ยังไม่มีสรุปผลเรดที่เผยแพร่ไว้',
    );
  }

  function buildDisabledAttr(disabled, reason) {
    return [
      disabled ? ' disabled aria-disabled="true"' : '',
      reason ? ` title="${escapeHtml(reason)}"` : '',
    ].join('');
  }

  function sectionEnabledFromFacts(facts, sectionKey) {
    const entry = facts?.state?.featureAccess?.sections?.[sectionKey];
    if (!entry || typeof entry.enabled !== 'boolean') return true;
    return entry.enabled;
  }

  function renderPlayerActionControl(actionConfig, fallbackLabel, fallbackHref, options = {}) {
    const action = typeof actionConfig === 'string'
      ? { label: actionConfig, href: fallbackHref }
      : actionConfig && typeof actionConfig === 'object'
        ? actionConfig
        : { label: fallbackLabel, href: fallbackHref };
    const label = firstNonEmpty([action.label, fallbackLabel], 'เปิด');
    const className = `plv4-button${action.primary === true || options.primary === true ? ' plv4-button-primary' : ''}`;
    const reason = firstNonEmpty([action.reason], '');
    if (action.href) {
      return `<a class="${className}" href="${escapeHtml(action.href || fallbackHref || '#')}"${reason ? ` title="${escapeHtml(reason)}"` : ''}>${escapeHtml(label)}</a>`;
    }
    const dataAttrs = Object.entries(action.data && typeof action.data === 'object' ? action.data : {}).map(([key, value]) => {
      if (value === undefined || value === null || value === false) return '';
      if (value === true) return ` ${String(key)}`;
      return ` ${String(key)}="${escapeHtml(String(value))}"`;
    }).join('');
    return `<button class="${className}" type="button"${dataAttrs}${buildDisabledAttr(action.disabled === true, reason)}>${escapeHtml(label)}</button>`;
  }

  function renderPlayerOfferGrid(items) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      return '<div class="plv4-empty-state">ตอนนี้ยังไม่มีข้อเสนอให้แสดงในมุมมองนี้</div>';
    }
    return rows.map((item) => [
      `<article class="plv4-product-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="plv4-product-meta">${badge(item.kind || 'item', item.kind === 'vip' ? 'info' : 'muted')} ${item.requiresSteamLink ? badge('ต้องเชื่อม Steam', 'warning') : ''}</div>`,
      `<h3 class="plv4-section-title">${escapeHtml(item.name || '-')}</h3>`,
      `<p class="plv4-section-copy">${escapeHtml(item.description || 'ข้อเสนอสำหรับผู้เล่น')}</p>`,
      `<strong class="plv4-product-price">${escapeHtml(item.price || '-')}</strong>`,
      '<div class="plv4-action-row">',
      renderPlayerActionControl(
        item.secondaryAction,
        typeof item.secondaryAction === 'string' ? item.secondaryAction : 'เปิดโปรไฟล์',
        item.secondaryHref || buildCanonicalPlayerPath('profile'),
      ),
      renderPlayerActionControl(
        item.primaryAction,
        typeof item.primaryAction === 'string' ? item.primaryAction : 'เปิดคำสั่งซื้อ',
        item.primaryHref || buildCanonicalPlayerPath('orders'),
        { primary: true },
      ),
      '</div>',
      '</article>',
    ].join('')).join('');
  }

  function buildCartTable(cart) {
    const rows = Array.isArray(cart?.rows) ? cart.rows : [];
    return renderTable(
      [
        {
          label: 'รายการ',
          render: (row) => escapeHtml(firstNonEmpty([row?.item?.name, row?.itemName, row?.itemId], '-')),
        },
        {
          label: 'จำนวน',
          render: (row) => escapeHtml(formatNumber(row?.quantity, '0')),
        },
        {
          label: 'รวม',
          render: (row) => {
            const total = Number(
              row?.lineTotal
              ?? row?.totalPrice
              ?? row?.subtotal
              ?? ((Number(row?.item?.price) || 0) * (Number(row?.quantity) || 0)),
            );
            return escapeHtml(formatAmount(total, '0'));
          },
        },
        {
          label: 'การจัดการ',
          render: (row) => {
            const itemId = firstNonEmpty([row?.itemId, row?.item?.id], '');
            if (!itemId) {
              return escapeHtml('ยังใช้งานไม่ได้');
            }
            return renderPlayerActionControl({
              label: 'ลบออก',
              data: {
                'data-player-cart-remove': itemId,
                'data-player-cart-remove-quantity': String(Math.max(1, Number(row?.quantity || 1) || 1)),
              },
            }, 'ลบออก', null);
          },
        },
      ],
      rows,
      'ตอนนี้รถเข็นยังว่างอยู่',
    );
  }

  function buildSupporterOrderTable(rows) {
    return renderTable(
      [
        { label: 'คำสั่งซื้อ', render: (row) => escapeHtml(firstNonEmpty([row.purchaseCode, row.code], '-')) },
        { label: 'แพ็กเกจ', render: (row) => escapeHtml(firstNonEmpty([row.itemName, row.productName, row.itemId], '-')) },
        {
          label: 'สถานะ',
          render: (row) => badge(localizePlayerStatus(orderStatusLabel(row.statusText || row.status)), toneForStatus(row.status || row.statusText)),
        },
        {
          label: 'ยอดรวม',
          render: (row) => escapeHtml(formatAmount(row.totalPrice, '0')),
        },
        {
          label: 'เปิดเมื่อ',
          render: (row) => escapeHtml(formatDateTime(row.createdAt || row.updatedAt)),
        },
      ],
      rows,
      'ยังไม่มีประวัติการซื้อผู้สนับสนุน',
    );
  }

  function buildRailCommon(facts) {
    return [
      {
        label: 'เซิร์ฟเวอร์',
        title: firstNonEmpty([facts.serverInfo.name], 'เซิร์ฟเวอร์ชุมชน SCUM'),
        body: firstNonEmpty([facts.serverInfo.description], 'ศูนย์รวมสำหรับร้านค้า สถิติ กิจกรรม และการช่วยเหลือของผู้เล่น'),
        meta: `${formatNumber(facts.serverStatus.onlinePlayers, '0')} ออนไลน์`,
        tone: 'info',
      },
      {
        label: 'บัญชี',
        title: facts.steamLink.linked ? 'เชื่อม Steam แล้ว' : 'ยังไม่เชื่อม Steam',
        body: facts.steamLink.linked
          ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'บัญชีพร้อมสำหรับการส่งของ')
          : 'เปิดโปรไฟล์ก่อนซื้อไอเทมในเกมหรือขอความช่วยเหลือเรื่องการส่งของ',
        meta: facts.steamLink.linked ? 'พร้อมส่งของ' : 'โปรไฟล์ยังต้องตรวจ',
        tone: facts.steamLink.linked ? 'success' : 'warning',
      },
      {
        label: 'คำสั่งซื้อล่าสุด',
        title: facts.latestOrder ? facts.latestOrder.code : 'ยังไม่มีคำสั่งซื้อล่าสุด',
        body: facts.latestOrder
          ? `${facts.latestOrder.itemName} • ${facts.latestOrder.status}`
          : 'คำสั่งซื้อล่าสุดของคุณจะขึ้นที่นี่หลังมีการซื้อครั้งแรก',
        meta: facts.latestOrder ? facts.latestOrder.createdAt : 'เริ่มจากร้านค้าเมื่อพร้อม',
        tone: facts.latestOrder ? facts.latestOrder.statusTone : 'muted',
      },
    ];
  }

  function buildHomePageContent(facts) {
    const profile = facts.state?.profile || {};
    const homeTasks = [
      {
        tone: facts.pendingOrders.length > 0 ? 'warning' : 'success',
        tag: 'คำสั่งซื้อ',
        title: facts.pendingOrders.length > 0 ? 'ยังมีคำสั่งซื้อกำลังดำเนินการ' : 'คิวคำสั่งซื้อโล่งแล้ว',
        detail: facts.pendingOrders.length > 0
          ? 'เปิดดูคำสั่งซื้อที่ยังรอหรือกำลังส่งก่อน เพื่อให้รู้ว่ายังมีอะไรค้างอยู่บ้าง'
          : 'ถ้าพร้อมซื้อรอบถัดไป ให้เริ่มจากร้านค้าและดูยอดคงเหลือในกระเป๋าเงินไว้',
        actions: [
          { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders'), primary: true },
          { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop') },
        ],
      },
      {
        tone: facts.steamLink.linked ? 'success' : 'warning',
        tag: 'บัญชี',
        title: facts.steamLink.linked ? 'บัญชีพร้อมสำหรับการส่งของในเกม' : 'เชื่อม Steam ให้เสร็จก่อน',
        detail: facts.steamLink.linked
          ? 'บัญชีผู้เล่นของคุณพร้อมสำหรับการส่งของและติดตามคำสั่งซื้อแล้ว'
          : 'เปิดโปรไฟล์ก่อน เพื่อไม่ให้การยังไม่เชื่อม Steam มาขวางการซื้อไอเทม',
        actions: [
          { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile'), primary: true },
          { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      },
      {
        tone: facts.missions.some((row) => row.claimable) || facts.bounties.length > 0 ? 'info' : 'muted',
        tag: 'ชุมชน',
        title: facts.missions.some((row) => row.claimable) ? 'มีกิจกรรมที่รับรางวัลได้รออยู่' : 'ดูว่าชุมชนกำลังมีกิจกรรมอะไร',
        detail: facts.missions.some((row) => row.claimable)
          ? 'เปิดหน้ากิจกรรมเพื่อดูภารกิจที่รับได้ ค่าหัวที่กำลังเปิด และช่วงเวลาของชุมชนตอนนี้'
          : 'หน้ากิจกรรมคือหน้าหลักสำหรับช่วงเวลา ภารกิจ ประกาศ และค่าหัวของชุมชน',
        actions: [
          { label: 'เปิดกิจกรรม', href: buildCanonicalPlayerPath('events'), primary: true },
          { label: 'เปิดอันดับ', href: buildCanonicalPlayerPath('leaderboard') },
        ],
      },
    ];

    return {
      header: {
        title: 'หน้าหลักผู้เล่น',
        subtitle: 'ดูความพร้อมของบัญชี คำสั่งซื้อ กระเป๋าเงิน และอัปเดตจากชุมชนได้จากหน้าเดียว',
        statusChips: [
          { label: facts.steamLink.linked ? 'เชื่อม Steam แล้ว' : 'ยังไม่เชื่อม Steam', tone: facts.steamLink.linked ? 'success' : 'warning' },
          { label: `${formatNumber(facts.pendingOrders.length, '0')} รายการกำลังดำเนินการ`, tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(facts.communityFeed.length, '0')} อัปเดต`, tone: facts.communityFeed.length > 0 ? 'info' : 'muted' },
          { label: facts.state?.lastRefreshedAt ? `อัปเดต ${formatRelative(facts.state.lastRefreshedAt)}` : 'กำลังรอซิงก์', tone: 'info' },
        ],
        primaryAction: facts.pendingOrders.length > 0
          ? { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') }
          : facts.missions.some((row) => row.claimable) || facts.bounties.length > 0
            ? { label: 'เปิดกิจกรรม', href: buildCanonicalPlayerPath('events') }
            : { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop') },
        secondaryActions: [
          { label: 'โปรไฟล์', href: buildCanonicalPlayerPath('profile') },
          { label: 'ช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      },
      summaryStrip: [
        { label: 'กระเป๋าเงิน', value: formatAmount(facts.wallet.balance, '0'), detail: 'ยอดที่ใช้ได้ตอนนี้', tone: 'success' },
        { label: 'คำสั่งซื้อล่าสุด', value: facts.latestOrder ? localizePlayerStatus(facts.latestOrder.status) : 'ยังไม่มีคำสั่งซื้อ', detail: facts.latestOrder ? facts.latestOrder.code : 'เริ่มจากร้านค้าเมื่อพร้อม', tone: facts.latestOrder ? facts.latestOrder.statusTone : 'muted' },
        { label: 'กิจกรรมที่เปิดอยู่', value: formatNumber(facts.missions.length + facts.bounties.length, '0'), detail: 'ภารกิจและค่าหัวที่เห็นได้ตอนนี้', tone: facts.missions.length + facts.bounties.length > 0 ? 'info' : 'muted' },
        { label: 'ผู้เล่นออนไลน์', value: formatNumber(facts.serverStatus.onlinePlayers, '0'), detail: 'ความเคลื่อนไหวของชุมชนตอนนี้', tone: 'info' },
        { label: 'การแจ้งเตือน', value: formatNumber(facts.supportAlerts.length, '0'), detail: 'คำเตือนที่ควรดูต่อ', tone: facts.supportAlerts.length > 0 ? 'warning' : 'success' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ทำต่อ</span><h2 class="plv4-section-title">เริ่มจากสิ่งที่ควรทำตอนนี้</h2><p class="plv4-section-copy">ให้หน้าหลักโฟกัสสิ่งที่ผู้เล่นทำต่อได้ทันที แทนการยัดข้อมูลเต็มหน้า</p></div></div>',
        `<div class="plv4-task-grid">${renderTaskGroups(homeTasks)}</div></section>`,
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ความเคลื่อนไหวล่าสุด</span><h2 class="plv4-section-title">มีอะไรเปลี่ยนไปบ้าง</h2><p class="plv4-section-copy">คำสั่งซื้อ ประกาศ และอัปเดตจากชุมชนที่ผู้เล่นลงมือทำต่อได้</p></div></div>',
        `<div class="plv4-feed-list">${renderFeed(facts.communityFeed, 'ตอนนี้ยังไม่มีอัปเดตใหม่สำหรับผู้เล่น')}</div></article>`,
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ความพร้อม</span><h2 class="plv4-section-title">ภาพรวมบัญชีและเซิร์ฟเวอร์</h2><p class="plv4-section-copy">ตรวจเรื่องสำคัญก่อนซื้อ รับรางวัล หรือขอความช่วยเหลือ</p></div></div>',
        renderKeyValueList([
          { label: 'ชื่อโปรไฟล์', value: firstNonEmpty([profile.displayName, facts.state?.me?.user], 'ผู้เล่น') },
          { label: 'การเชื่อม Steam', value: facts.steamLink.linked ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'เชื่อมแล้ว') : 'ยังไม่เชื่อม' },
          { label: 'ปาร์ตี้', value: firstNonEmpty([facts.party.title], 'ยังไม่มีปาร์ตี้ตอนนี้') },
          { label: 'เซิร์ฟเวอร์', value: firstNonEmpty([facts.serverInfo.name], 'เซิร์ฟเวอร์ SCUM') },
          { label: 'รางวัลรายวัน', value: facts.state?.dashboard?.missionsSummary?.dailyClaimable ? 'รับได้ตอนนี้' : 'ยังรับไม่ได้' },
          { label: 'รางวัลรายสัปดาห์', value: facts.state?.dashboard?.missionsSummary?.weeklyClaimable ? 'รับได้ตอนนี้' : 'ยังรับไม่ได้' },
        ], 'ยังไม่มีรายละเอียดบัญชี'),
        '</article></section>',
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">คำสั่งซื้อ</span><h2 class="plv4-section-title">ภาพรวมคำสั่งซื้อล่าสุด</h2><p class="plv4-section-copy">ถ้าต้องการรายละเอียดเพิ่มหรือเตรียมข้อมูลสำหรับติดต่อทีมงาน ให้เปิดหน้าคำสั่งซื้อแบบเต็ม</p></div></div>',
        buildOrdersTable(facts.orders.slice(0, 5)),
        '</section>',
      ].join(''),
    };
  }

  function buildStatsPageContent(facts) {
    const stats = facts.stats || {};
    return {
      header: {
        title: 'สถิติของฉัน',
        subtitle: 'ดูสรุปการเล่นของตัวเองก่อน แล้วค่อยไปดูอันดับหรือกิจกรรมเมื่ออยากเห็นภาพรวมมากขึ้น',
        statusChips: [
          { label: `${formatNumber(stats.kills, '0')} kills`, tone: 'info' },
          { label: `KD ${Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00'}`, tone: 'success' },
          { label: `${formatNumber(Math.floor(Number(stats.playtimeMinutes || 0) / 60), '0')}h played`, tone: 'info' },
          { label: `${formatNumber(facts.party.memberCount, '0')} party`, tone: facts.party.memberCount > 0 ? 'success' : 'muted' },
        ],
        primaryAction: { label: 'เปิดอันดับ', href: buildCanonicalPlayerPath('leaderboard') },
        secondaryActions: [
          { label: 'เปิดกิจกรรม', href: buildCanonicalPlayerPath('events') },
          { label: 'เปิดหน้าหลัก', href: buildCanonicalPlayerPath('home') },
        ],
      },
      summaryStrip: [
        { label: 'คิล', value: formatNumber(stats.kills, '0'), detail: 'จำนวนคิลที่ซิงก์ล่าสุด', tone: 'info' },
        { label: 'ตาย', value: formatNumber(stats.deaths, '0'), detail: 'จำนวนการตายที่ซิงก์ล่าสุด', tone: 'muted' },
        { label: 'KD', value: Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00', detail: 'อัตราส่วนผลงานแบบย่อ', tone: 'success' },
        { label: 'เวลาเล่น', value: `${formatNumber(Math.floor(Number(stats.playtimeMinutes || 0) / 60), '0')}h`, detail: 'เวลารวมโดยประมาณ', tone: 'info' },
        { label: 'อันดับของฉัน', value: facts.myRank ? formatNumber(facts.myRank.rank, '-') : '-', detail: facts.myRank ? 'แสดงอยู่บนกระดานอันดับตอนนี้' : 'ยังไม่เห็นอันดับ', tone: facts.myRank ? 'success' : 'muted' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-media-panel"><div class="plv4-media-copy"><span class="plv4-section-kicker">กิจกรรมของชุมชน</span><h2 class="plv4-section-title">รวมภารกิจ ฟีดการต่อสู้ และคำขอเรดไว้จุดเดียว</h2><p class="plv4-section-copy">ใช้หน้านี้เป็นศูนย์กลางของกิจกรรมผู้เล่น ทั้งการรับรางวัล ดูเหตุการณ์ล่าสุด และส่งคำขอเรดให้ทีมงานตรวจได้ทันที</p><div class="plv4-action-row"><a class="plv4-button plv4-button-primary" href="' + buildCanonicalPlayerPath('events') + '">อยู่หน้ากิจกรรมแล้ว</a><a class="plv4-button" href="' + buildCanonicalPlayerPath('leaderboard') + '">เปิดหน้าอันดับ</a></div></div><div class="plv4-media-frame" style="--plv4-media-image: linear-gradient(140deg, rgba(9, 12, 14, 0.18), rgba(9, 12, 14, 0.66)), url(\'/player/assets/ui/visuals/scum/scene-radio.jpg\');"><div class="plv4-media-badge-row"><span class="plv4-badge plv4-badge-info">กิจกรรม</span><span class="plv4-badge plv4-badge-success">' + escapeHtml(`${formatNumber(raidRequestCount, '0')} คำขอเรด`) + '</span></div></div></section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">สถิติส่วนตัว</span><h2 class="plv4-section-title">สรุปการเล่นของคุณ</h2><p class="plv4-section-copy">ใช้หน้านี้เป็นมุมมองสรุปผลงานของตัวเองแบบอ่านง่าย</p></div></div>',
        renderKeyValueList([
          { label: 'คิล', value: formatNumber(stats.kills, '0') },
          { label: 'ตาย', value: formatNumber(stats.deaths, '0') },
          { label: 'KD', value: Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00' },
          { label: 'เวลาเล่น (นาที)', value: formatNumber(stats.playtimeMinutes, '0') },
          { label: 'ปาร์ตี้', value: firstNonEmpty([facts.party.title], 'ยังไม่มีปาร์ตี้ที่กำลังเล่น') },
          { label: 'สมาชิกปาร์ตี้', value: formatNumber(facts.party.memberCount, '0') },
        ], 'ยังไม่มีสถิติที่ซิงก์เข้ามา'),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ความคืบหน้า</span><h2 class="plv4-section-title">ก้าวต่อไปที่ควรไล่ตาม</h2><p class="plv4-section-copy">ใช้หน้ากิจกรรมและอันดับเพื่อเปลี่ยนตัวเลขให้กลายเป็นเป้าหมายที่ชัดขึ้น</p></div></div>',
        renderKeyValueList([
          { label: 'อันดับของฉัน', value: facts.myRank ? formatNumber(facts.myRank.rank, '-') : 'ยังไม่แสดงอันดับ' },
          { label: 'ภารกิจที่รับได้', value: formatNumber(facts.missions.filter((row) => row.claimable).length, '0') },
          { label: 'ค่าหัวที่เปิดอยู่', value: formatNumber(facts.bounties.length, '0') },
          { label: 'สถานะวงล้อ', value: facts.wheelState.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน' },
          { label: 'รีเฟรชล่าสุด', value: facts.state?.lastRefreshedAt ? formatDateTime(facts.state.lastRefreshedAt) : 'ไม่ทราบ' },
        ], 'ยังไม่มีข้อมูลความคืบหน้าให้แสดง'),
        '</article></section>',
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ฟีดชุมชน</span><h2 class="plv4-section-title">อัปเดตที่กระทบกับการเล่นของคุณ</h2><p class="plv4-section-copy">คำเตือน ช่วงเวลากิจกรรม และอัปเดตของบัญชียังคงดูได้จากตรงนี้</p></div></div>',
        `<div class="plv4-feed-list">${renderFeed(facts.communityFeed, 'ตอนนี้ยังไม่มีอัปเดตจากชุมชน')}</div></section>`,
      ].join(''),
    };
  }

  function buildLeaderboardPageContent(facts) {
    const stats = facts.stats || {};
    return {
      header: {
        title: 'อันดับ',
        subtitle: 'เทียบตำแหน่งของคุณกับคนอื่นในชุมชน โดยไม่ปนรายละเอียดบัญชีหรือแอดมิน',
        statusChips: [
          { label: facts.myRank ? `อันดับ ${formatNumber(facts.myRank.rank, '-')}` : 'ยังไม่มีอันดับส่วนตัว', tone: facts.myRank ? 'success' : 'muted' },
          { label: `${formatNumber(facts.leaderboardItems.length, '0')} ผู้เล่น`, tone: facts.leaderboardItems.length > 0 ? 'info' : 'muted' },
          { label: `${formatNumber(stats.kills, '0')} kills`, tone: 'info' },
          { label: `${formatNumber(facts.serverStatus.onlinePlayers, '0')} ออนไลน์`, tone: 'info' },
        ],
        primaryAction: { label: 'เปิดสถิติของฉัน', href: buildCanonicalPlayerPath('stats') },
        secondaryActions: [
          { label: 'เปิดกิจกรรม', href: buildCanonicalPlayerPath('events') },
          { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      },
      summaryStrip: [
        { label: 'อันดับของฉัน', value: facts.myRank ? formatNumber(facts.myRank.rank, '-') : '-', detail: facts.myRank ? 'ตำแหน่งที่มองเห็นตอนนี้' : 'ยังไม่ติดอันดับ', tone: facts.myRank ? 'success' : 'muted' },
        { label: 'คิลของฉัน', value: formatNumber(stats.kills, '0'), detail: 'จำนวนคิลที่ซิงก์ล่าสุด', tone: 'info' },
        { label: 'KD', value: Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00', detail: 'เทียบอัตราส่วนอย่างย่อ', tone: 'success' },
        { label: 'ภารกิจที่เปิดอยู่', value: formatNumber(facts.missions.length, '0'), detail: 'ใช้หน้ากิจกรรมเพื่อลุยต่อ', tone: facts.missions.length > 0 ? 'info' : 'muted' },
        { label: 'คำเตือนช่วยเหลือ', value: formatNumber(facts.supportAlerts.length, '0'), detail: 'คำเตือนที่ควรเคลียร์ก่อนลุยต่อ', tone: facts.supportAlerts.length > 0 ? 'warning' : 'success' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">กระดานอันดับ</span><h2 class="plv4-section-title">ผู้เล่นอันดับต้น</h2><p class="plv4-section-copy">หน้านี้โฟกัสเรื่องอันดับของผู้เล่นอย่างเดียว</p></div></div>',
        buildLeaderboardTable(facts.leaderboardItems.slice(0, 20)),
        '</section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ตำแหน่งของคุณ</span><h2 class="plv4-section-title">ตอนนี้คุณอยู่ตรงไหน</h2><p class="plv4-section-copy">สรุปสั้นสำหรับกระดานอันดับปัจจุบันและตัวเลขของคุณเอง</p></div></div>',
        renderKeyValueList([
          { label: 'อันดับปัจจุบัน', value: facts.myRank ? formatNumber(facts.myRank.rank, '-') : 'ยังไม่ติดอันดับ' },
          { label: 'คิล', value: formatNumber(stats.kills, '0') },
          { label: 'KD', value: Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00' },
          { label: 'เวลาเล่น', value: `${formatNumber(Math.floor(Number(stats.playtimeMinutes || 0) / 60), '0')}h` },
        ], 'ยังไม่มีข้อมูลอันดับส่วนตัว'),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ทำต่อ</span><h2 class="plv4-section-title">ใช้หน้าอันดับให้คุ้ม</h2><p class="plv4-section-copy">กลับไปดูสถิติของตัวเอง หรือเปิดกิจกรรมเพื่อไล่เป้าหมายต่อ</p></div></div>',
        renderKeyValueList([
          { label: 'หน้าที่ควรเปิดต่อ', value: facts.missions.some((row) => row.claimable) ? 'กิจกรรม' : 'สถิติ' },
          { label: 'ภารกิจที่รับได้', value: formatNumber(facts.missions.filter((row) => row.claimable).length, '0') },
          { label: 'ค่าหัวที่เปิดอยู่', value: formatNumber(facts.bounties.length, '0') },
          { label: 'คำเตือน', value: formatNumber(facts.supportAlerts.length, '0') },
        ], 'ยังไม่มีข้อมูลแนะนำต่อ'),
        '</article></section>',
      ].join(''),
    };
  }

  function buildShopPageContent(facts) {
    const shopEnabled = sectionEnabledFromFacts(facts, 'shop') && !Boolean(facts.state?.cart?.locked);
    const cartRows = Array.isArray(facts.cart?.rows) ? facts.cart.rows : [];
    const cartReason = !shopEnabled
      ? 'การสั่งซื้อจากร้านค้าถูกปิดสำหรับแพ็กเกจของเซิร์ฟเวอร์นี้'
      : cartRows.length === 0
        ? 'เพิ่มอย่างน้อยหนึ่งรายการก่อนใช้ปุ่มรถเข็น'
        : '';
    return {
      header: {
        title: 'ร้านค้า',
        subtitle: 'ดูข้อเสนอสำหรับผู้เล่น เช็กยอดคงเหลือ และซื้อของได้แบบไม่ซับซ้อน',
        statusChips: [
          { label: facts.steamLink.linked ? 'พร้อมส่งของในเกม' : 'เชื่อม Steam ก่อนซื้อไอเทมในเกม', tone: facts.steamLink.linked ? 'success' : 'warning' },
          { label: `ยอดคงเหลือ ${formatAmount(facts.wallet.balance, '0')}`, tone: 'success' },
          { label: `${formatNumber(facts.cart.totalUnits, '0')} รายการในรถเข็น`, tone: facts.cart.totalUnits > 0 ? 'info' : 'muted' },
          { label: `${formatNumber(facts.pendingOrders.length, '0')} คำสั่งซื้อกำลังดำเนินการ`, tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
        ],
        primaryAction: !facts.steamLink.linked
          ? { label: 'เปิดโปรไฟล์ก่อน', href: buildCanonicalPlayerPath('profile') }
          : facts.pendingOrders.length > 0
            ? { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') }
            : { label: 'เปิดหน้าช่วยเหลือถ้าจำเป็น', href: buildCanonicalPlayerPath('support') },
        secondaryActions: [
          { label: 'คำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') },
          { label: 'ช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      },
      summaryStrip: [
        { label: 'ยอดคงเหลือ', value: formatAmount(facts.wallet.balance, '0'), detail: 'ยอดกระเป๋าเงินตอนนี้', tone: 'success' },
        { label: 'แคตตาล็อก', value: formatNumber(facts.shopItems.length, '0'), detail: 'ข้อเสนอที่มองเห็นได้ในร้านค้าตอนนี้', tone: facts.shopItems.length > 0 ? 'info' : 'muted' },
        { label: 'รถเข็น', value: formatNumber(facts.cart.totalUnits, '0'), detail: formatAmount(facts.cart.totalPrice, '0'), tone: facts.cart.totalUnits > 0 ? 'info' : 'muted' },
        { label: 'คำสั่งซื้อที่ค้างอยู่', value: formatNumber(facts.pendingOrders.length, '0'), detail: 'เช็กให้เรียบร้อยก่อนซื้อเพิ่ม', tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
        { label: 'แพ็กเกจสนับสนุน', value: formatNumber(facts.supporterItems.length, '0'), detail: 'VIP หรือแพ็กเกจสนับสนุนที่อยู่ในแคตตาล็อก', tone: facts.supporterItems.length > 0 ? 'info' : 'muted' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">รายการแนะนำ</span><h2 class="plv4-section-title">ดูแคตตาล็อกตอนนี้</h2><p class="plv4-section-copy">ข้อเสนอสำหรับผู้เล่นควรอยู่บนหน้าร้านค้า ไม่ควรปนกับสถิติหรือหน้าช่วยเหลือ</p></div></div>',
        `<div class="plv4-product-grid">${renderPlayerOfferGrid(facts.shopItems.slice(0, 8).map((item) => ({
          name: firstNonEmpty([item.name, item.id], 'สินค้า'),
          description: firstNonEmpty([item.description], 'รายการในร้านค้า'),
          price: formatAmount(item.price, '0'),
          kind: firstNonEmpty([item.kind], 'item'),
          requiresSteamLink: Boolean(item.requiresSteamLink),
          tone: item.requiresSteamLink && !facts.steamLink.linked ? 'warning' : 'muted',
          primaryAction: {
            label: 'เพิ่มลงรถเข็น',
            primary: true,
            data: {
              'data-player-cart-add': firstNonEmpty([item.id], ''),
            },
            disabled: !shopEnabled || !item.id || (Boolean(item.requiresSteamLink) && !facts.steamLink.linked),
            reason: !shopEnabled
              ? 'การสั่งซื้อจากร้านค้าถูกปิดสำหรับแพ็กเกจของเซิร์ฟเวอร์นี้'
              : Boolean(item.requiresSteamLink) && !facts.steamLink.linked
                ? 'เชื่อม Steam ในหน้าโปรไฟล์ก่อนเพิ่มไอเทมนี้'
                : '',
          },
          secondaryAction: {
            label: Boolean(item.requiresSteamLink) && !facts.steamLink.linked ? 'เชื่อม Steam' : 'เปิดโปรไฟล์',
            href: buildCanonicalPlayerPath('profile'),
          },
        })))}</div></article>`,
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">รถเข็น</span><h2 class="plv4-section-title">รถเข็นและกระเป๋าเงินตอนนี้</h2><p class="plv4-section-copy">ตรวจรถเข็นก่อนชำระเงิน และดูความเคลื่อนไหวล่าสุดของกระเป๋าเงินไว้ด้วย</p></div></div>',
        `<div class="plv4-action-row">${[
          renderPlayerActionControl({
            label: 'ล้างรถเข็น',
            data: { 'data-player-cart-clear': true },
            disabled: !shopEnabled || cartRows.length === 0,
            reason: cartReason,
          }, 'ล้างรถเข็น', null),
          renderPlayerActionControl({
            label: 'ชำระเงินจากรถเข็น',
            primary: true,
            data: { 'data-player-cart-checkout': true },
            disabled: !shopEnabled || cartRows.length === 0,
            reason: cartReason,
          }, 'ชำระเงินจากรถเข็น', null, { primary: true }),
        ].join('')}</div>`,
        '<p class="plv4-inline-copy">รายการในรถเข็นจะอยู่กับเซสชันนี้ของผู้เล่น คุณจึงรีเฟรชหรือสลับหน้าได้โดยไม่ทำให้ของในรถเข็นหาย</p>',
        buildCartTable(facts.cart),
        '<div class="plv4-stack"><span class="plv4-section-kicker">กระเป๋าเงิน</span><h3 class="plv4-section-title">ความเคลื่อนไหวล่าสุดของกระเป๋าเงิน</h3><p class="plv4-section-copy">ใช้ตารางนี้ยืนยันการซื้อ การคืนเงิน หรือการรับรางวัลล่าสุด</p></div>',
        buildWalletTable((Array.isArray(facts.state?.walletLedger?.items) ? facts.state.walletLedger.items : []).slice(0, 6)),
        '</article></section>',
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ก่อนซื้อ</span><h2 class="plv4-section-title">เช็กลิสต์ความพร้อม</h2><p class="plv4-section-copy">ช่วยให้ร้านค้ายังใช้งานง่าย โดยไม่ต้องเปิดเผยเครื่องมือแอดมินหรือคุมเซิร์ฟเวอร์</p></div></div>',
        renderKeyValueList([
          { label: 'การเชื่อม Steam', value: facts.steamLink.linked ? 'พร้อม' : 'ยังขาด' },
          { label: 'ของในรถเข็น', value: formatNumber(facts.cart.totalUnits, '0') },
          { label: 'ยอดรถเข็น', value: formatAmount(facts.cart.totalPrice, '0') },
          { label: 'คำสั่งซื้อที่กำลังดำเนินการ', value: formatNumber(facts.pendingOrders.length, '0') },
          { label: 'คำสั่งซื้อที่อาจต้องช่วยดู', value: formatNumber(facts.failedOrders.length, '0') },
        ], 'ยังไม่มีข้อมูลความพร้อมของร้านค้า'),
        '</section>',
      ].join(''),
    };
  }

  function buildOrdersPageContent(facts) {
    const redeemEnabled = sectionEnabledFromFacts(facts, 'orders') && !Boolean(facts.state?.walletLedger?.locked);
    const redeemReason = redeemEnabled
      ? ''
      : 'Redeem actions are not available on the current server package.';
    return {
      header: {
        title: 'คำสั่งซื้อของฉัน',
        subtitle: 'ติดตามการซื้อจากหน้าเดียว โดยไม่ต้องสลับปนกับการดูร้านค้าหรือเดาเรื่องการช่วยเหลือ',
        statusChips: [
          { label: `${formatNumber(facts.orders.length, '0')} คำสั่งซื้อทั้งหมด`, tone: facts.orders.length > 0 ? 'info' : 'muted' },
          { label: `${formatNumber(facts.pendingOrders.length, '0')} รายการกำลังดำเนินการ`, tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(facts.failedOrders.length, '0')} รายการที่ต้องตรวจ`, tone: facts.failedOrders.length > 0 ? 'danger' : 'muted' },
          { label: `${formatNumber(facts.redeemHistory.length, '0')} โค้ดที่ใช้แล้ว`, tone: 'info' },
        ],
        primaryAction: facts.failedOrders.length > 0
          ? { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') }
          : { label: 'เปิดการส่งของ', href: buildCanonicalPlayerPath('delivery') },
        secondaryActions: [
          { label: 'ร้านค้า', href: buildCanonicalPlayerPath('shop') },
          { label: 'โปรไฟล์', href: buildCanonicalPlayerPath('profile') },
        ],
      },
      summaryStrip: [
        { label: 'คำสั่งซื้อล่าสุด', value: facts.latestOrder ? facts.latestOrder.code : '-', detail: facts.latestOrder ? localizePlayerStatus(facts.latestOrder.status) : 'ยังไม่มีคำสั่งซื้อล่าสุด', tone: facts.latestOrder ? facts.latestOrder.statusTone : 'muted' },
        { label: 'กำลังรอหรือกำลังส่ง', value: formatNumber(facts.pendingOrders.length, '0'), detail: 'คำสั่งซื้อที่ยังอยู่ในขั้นตอนส่งของ', tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
        { label: 'ส่งของไม่สำเร็จ', value: formatNumber(facts.failedOrders.length, '0'), detail: 'เช็กรหัสคำสั่งซื้อก่อนแล้วค่อยเปิดหน้าช่วยเหลือ', tone: facts.failedOrders.length > 0 ? 'danger' : 'muted' },
        { label: 'ส่งสำเร็จแล้ว', value: formatNumber(facts.deliveredOrders.length, '0'), detail: 'ผลการส่งของที่เสร็จสมบูรณ์', tone: facts.deliveredOrders.length > 0 ? 'success' : 'muted' },
        { label: 'ประวัติการใช้โค้ด', value: formatNumber(facts.redeemHistory.length, '0'), detail: 'ประวัติรางวัลหรือโค้ด', tone: 'info' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">คำสั่งซื้อ</span><h2 class="plv4-section-title">ประวัติคำสั่งซื้อ</h2><p class="plv4-section-copy">ตรวจประวัติการซื้อก่อนจะไปดูการส่งของหรือขอความช่วยเหลือ</p></div></div>',
        buildOrdersTable(facts.orders.slice(0, 20)),
        '</section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">รางวัล</span><h2 class="plv4-section-title">ประวัติการใช้โค้ดและรับรางวัล</h2><p class="plv4-section-copy">ให้โค้ดโบนัสและการรับรางวัลอยู่ให้เห็นคู่กับคำสั่งซื้อ</p></div></div>',
        `<form class="plv4-inline-form" data-player-redeem-form><div class="plv4-form-grid"><label class="plv4-stack"><span class="plv4-section-kicker">โค้ดรับรางวัล</span><input class="plv4-input" type="text" name="code" placeholder="กรอกโค้ดรับรางวัล"${buildDisabledAttr(!redeemEnabled, redeemReason)}></label><button class="plv4-button plv4-button-primary" type="submit"${buildDisabledAttr(!redeemEnabled, redeemReason)}>ใช้โค้ด</button></div><p class="plv4-inline-copy">กรอกโค้ดโบนัสหรือโค้ดกิจกรรมตรงนี้ แล้วค่อยรีเฟรชประวัติด้านล่าง</p></form>`,
        buildRedeemTable(facts.redeemHistory.slice(0, 10)),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">เตรียมก่อนขอช่วย</span><h2 class="plv4-section-title">ควรเตรียมอะไรไว้ก่อนติดต่อทีมงาน</h2><p class="plv4-section-copy">ลดการวนไปมา ด้วยการเตรียมข้อมูลที่ทีมงานมักถามก่อนให้พร้อม</p></div></div>',
        renderKeyValueList([
          { label: 'รหัสคำสั่งซื้อล่าสุด', value: facts.latestOrder ? facts.latestOrder.code : 'ยังไม่มีคำสั่งซื้อ' },
          { label: 'การเชื่อม Steam', value: facts.steamLink.linked ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'เชื่อมแล้ว') : 'ยังไม่เชื่อม' },
          { label: 'คำสั่งซื้อที่ต้องตรวจ', value: formatNumber(facts.failedOrders.length, '0') },
          { label: 'หน้าที่ควรเปิดต่อ', value: facts.failedOrders.length > 0 ? 'ช่วยเหลือ' : 'การส่งของ' },
        ], 'ยังไม่มีข้อมูลเตรียมขอความช่วยเหลือ'),
        '</article></section>',
      ].join(''),
    };
  }

  function buildDeliveryPageContent(facts) {
    const deliveryRows = facts.orders.filter((row) => {
      const status = String(row?.status || '').trim().toLowerCase();
      return status === 'delivered' || status === 'delivering' || status === 'queued' || status === 'pending' || status === 'delivery_failed';
    });
    return {
      header: {
        title: 'สถานะการส่งของ',
        subtitle: 'ติดตามว่ารายการไหนส่งแล้ว รายการไหนยังรอ และเมื่อไรควรเปิดหน้าช่วยเหลือ',
        statusChips: [
          { label: `${formatNumber(facts.deliveredOrders.length, '0')} ส่งสำเร็จ`, tone: facts.deliveredOrders.length > 0 ? 'success' : 'muted' },
          { label: `${formatNumber(facts.pendingOrders.length, '0')} กำลังดำเนินการ`, tone: facts.pendingOrders.length > 0 ? 'warning' : 'muted' },
          { label: `${formatNumber(facts.failedOrders.length, '0')} มีปัญหา`, tone: facts.failedOrders.length > 0 ? 'danger' : 'muted' },
          { label: facts.steamLink.linked ? 'Steam พร้อมใช้งาน' : 'ยังไม่ได้เชื่อม Steam', tone: facts.steamLink.linked ? 'success' : 'warning' },
        ],
        primaryAction: facts.failedOrders.length > 0
          ? { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') }
          : { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') },
        secondaryActions: [
          { label: 'โปรไฟล์', href: buildCanonicalPlayerPath('profile') },
          { label: 'ร้านค้า', href: buildCanonicalPlayerPath('shop') },
        ],
      },
      summaryStrip: [
        { label: 'ส่งสำเร็จ', value: formatNumber(facts.deliveredOrders.length, '0'), detail: 'ผลการส่งของที่เสร็จเรียบร้อยแล้ว', tone: facts.deliveredOrders.length > 0 ? 'success' : 'muted' },
        { label: 'อยู่ในคิว', value: formatNumber(facts.pendingOrders.length, '0'), detail: 'คำสั่งซื้อที่กำลังรอหรือกำลังส่งของ', tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
        { label: 'มีปัญหา', value: formatNumber(facts.failedOrders.length, '0'), detail: 'เปิดหน้าช่วยเหลือหลังตรวจรหัสคำสั่งซื้อแล้ว', tone: facts.failedOrders.length > 0 ? 'danger' : 'muted' },
        { label: 'คำสั่งซื้อล่าสุด', value: facts.latestOrder ? facts.latestOrder.code : '-', detail: facts.latestOrder ? localizePlayerStatus(facts.latestOrder.status) : 'ยังไม่มีคำสั่งซื้อ', tone: facts.latestOrder ? facts.latestOrder.statusTone : 'muted' },
        { label: 'คำเตือน', value: formatNumber(facts.supportAlerts.length, '0'), detail: 'คำเตือนที่อาจกระทบการติดตามงานต่อ', tone: facts.supportAlerts.length > 0 ? 'warning' : 'info' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ประวัติการส่งของ</span><h2 class="plv4-section-title">ติดตามสถานะการส่งไอเทม</h2><p class="plv4-section-copy">หน้านี้โฟกัสผลการส่งของและสิ่งที่ผู้เล่นควรทำต่อเท่านั้น</p></div></div>',
        buildDeliveryTable(deliveryRows.slice(0, 20)),
        '</section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ความพร้อม</span><h2 class="plv4-section-title">เงื่อนไขก่อนส่งของ</h2><p class="plv4-section-copy">ให้เรื่องสำคัญของบัญชียังมองเห็นได้ โดยไม่ต้องเปิดเครื่องมือคุมเซิร์ฟเวอร์</p></div></div>',
        renderKeyValueList([
          { label: 'การเชื่อม Steam', value: facts.steamLink.linked ? 'พร้อม' : 'ยังขาด' },
          { label: 'ชื่อในเกม', value: firstNonEmpty([facts.steamLink.inGameName], 'ยังไม่พร้อมใช้งาน') },
          { label: 'รหัสคำสั่งซื้อล่าสุด', value: facts.latestOrder ? facts.latestOrder.code : 'ยังไม่มีคำสั่งซื้อ' },
          { label: 'จำนวนที่ส่งไม่สำเร็จ', value: formatNumber(facts.failedOrders.length, '0') },
        ], 'ยังไม่มีข้อมูลความพร้อมสำหรับการส่งของ'),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">อัปเดตล่าสุด</span><h2 class="plv4-section-title">มีอะไรเปลี่ยนไปบ้าง</h2><p class="plv4-section-copy">เช็กฟีดนี้ก่อนเปิดหน้าช่วยเหลือ</p></div></div>',
        `<div class="plv4-feed-list">${renderFeed(facts.communityFeed, 'ตอนนี้ยังไม่มีอัปเดตที่เกี่ยวกับการส่งของ')}</div></article></section>`,
      ].join(''),
    };
  }

  function buildEventsPageContent(facts) {
    const missionsSummary = facts.state?.dashboard?.missionsSummary || {};
    const economy = facts.state?.serverInfo?.economy || {};
    const rewardEnabled = !Boolean(facts.state?.walletLedger?.locked);
    const dailyClaimable = rewardEnabled && missionsSummary.dailyClaimable === true;
    const weeklyClaimable = rewardEnabled && missionsSummary.weeklyClaimable === true;
    const raidRequestCount = Array.isArray(facts.raidRequests) ? facts.raidRequests.length : 0;
    const activeRaidWindowCount = Array.isArray(facts.raidWindows)
      ? facts.raidWindows.filter((row) => ['scheduled', 'live'].includes(String(row?.status || '').trim().toLowerCase())).length
      : 0;
    const raidSummaryCount = Array.isArray(facts.raidSummaries) ? facts.raidSummaries.length : 0;
    const killfeedCount = Array.isArray(facts.killfeed) ? facts.killfeed.length : 0;
    const playerCombatCount = Array.isArray(facts.killfeed)
      ? facts.killfeed.filter((row) => row?.involvesPlayer).length
      : 0;
    const dailyReason = !rewardEnabled
      ? 'แพ็กเกจของเซิร์ฟเวอร์นี้ยังไม่เปิดการรับรางวัล'
      : missionsSummary.dailyRemainingMs
        ? `${formatNumber(Math.max(1, Math.round(Number(missionsSummary.dailyRemainingMs || 0) / 60000)), '0')} นาทีคงเหลือ`
        : 'Daily reward is cooling down right now.';
    const weeklyReason = !rewardEnabled
      ? 'แพ็กเกจของเซิร์ฟเวอร์นี้ยังไม่เปิดการรับรางวัล'
      : missionsSummary.weeklyRemainingMs
        ? `${formatNumber(Math.max(1, Math.round(Number(missionsSummary.weeklyRemainingMs || 0) / 3600000)), '0')} ชั่วโมงคงเหลือ`
        : 'Weekly reward is cooling down right now.';
    return {
      header: {
        title: 'กิจกรรมและภารกิจ',
        subtitle: 'รวมภารกิจ ค่าหัว และช่วงเวลาของชุมชนไว้ในหน้าเดียวที่อ่านง่ายสำหรับผู้เล่น',
        statusChips: [
          { label: `${formatNumber(facts.missions.length, '0')} ภารกิจ`, tone: facts.missions.length > 0 ? 'info' : 'muted' },
          { label: `${formatNumber(facts.missions.filter((row) => row.claimable).length, '0')} รับได้`, tone: facts.missions.some((row) => row.claimable) ? 'success' : 'muted' },
          { label: `${formatNumber(facts.bounties.length, '0')} ค่าหัว`, tone: facts.bounties.length > 0 ? 'warning' : 'muted' },
          { label: facts.wheelState.enabled ? 'วงล้อเปิดใช้งาน' : 'วงล้อปิดใช้งาน', tone: facts.wheelState.enabled ? 'info' : 'muted' },
        ],
        primaryAction: { label: 'เปิดอันดับ', href: buildCanonicalPlayerPath('leaderboard') },
        secondaryActions: [
          { label: 'เปิดสถิติ', href: buildCanonicalPlayerPath('stats') },
          { label: 'เปิดหน้าหลัก', href: buildCanonicalPlayerPath('home') },
        ],
      },
      summaryStrip: [
        { label: 'ภารกิจ', value: formatNumber(facts.missions.length, '0'), detail: 'รายการภารกิจที่เปิดอยู่ตอนนี้', tone: facts.missions.length > 0 ? 'info' : 'muted' },
        { label: 'รับได้', value: formatNumber(facts.missions.filter((row) => row.claimable).length, '0'), detail: 'พร้อมรับรางวัลได้ตอนนี้', tone: facts.missions.some((row) => row.claimable) ? 'success' : 'muted' },
        { label: 'ค่าหัว', value: formatNumber(facts.bounties.length, '0'), detail: 'ค่าหัวของชุมชนที่เปิดอยู่', tone: facts.bounties.length > 0 ? 'warning' : 'muted' },
        { label: 'คำขอเรดของคุณ', value: formatNumber(raidRequestCount, '0'), detail: 'คำขอที่ส่งไว้และยังย้อนกลับมาดูได้จากหน้านี้', tone: raidRequestCount > 0 ? 'info' : 'muted' },
        { label: 'ช่วงเวลาเรด', value: formatNumber(activeRaidWindowCount, '0'), detail: 'รอบที่ตั้งเวลาไว้หรือกำลังเปิดอยู่', tone: activeRaidWindowCount > 0 ? 'success' : 'muted' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">กระดานภารกิจ</span><h2 class="plv4-section-title">ภารกิจที่เปิดอยู่ตอนนี้</h2><p class="plv4-section-copy">ใช้หน้ากิจกรรมเป็นจุดหลักสำหรับดูสถานะและช่วงเวลาของภารกิจ</p></div></div>',
        buildMissionTable(facts.missions.slice(0, 12)),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">การรับรางวัล</span><h2 class="plv4-section-title">รางวัลรายวันและรายสัปดาห์</h2><p class="plv4-section-copy">รับรางวัลตามเวลาได้จากตรงนี้เลย โดยไม่ต้องไปหาในหน้ากระเป๋าเงินอื่น</p></div></div>',
        `<div class="plv4-action-row">${[
          renderPlayerActionControl({
            label: `รับรางวัลรายวัน${Number.isFinite(Number(economy.dailyReward)) ? ` (${formatAmount(economy.dailyReward, '0')})` : ''}`,
            primary: true,
            data: { 'data-player-reward-claim': 'daily' },
            disabled: !dailyClaimable,
            reason: dailyClaimable ? '' : dailyReason,
          }, 'รับรางวัลรายวัน', null, { primary: true }),
          renderPlayerActionControl({
            label: `รับรางวัลรายสัปดาห์${Number.isFinite(Number(economy.weeklyReward)) ? ` (${formatAmount(economy.weeklyReward, '0')})` : ''}`,
            primary: true,
            data: { 'data-player-reward-claim': 'weekly' },
            disabled: !weeklyClaimable,
            reason: weeklyClaimable ? '' : weeklyReason,
          }, 'รับรางวัลรายสัปดาห์', null, { primary: true }),
        ].join('')}</div>`,
        renderKeyValueList([
          { label: 'สถานะรายวัน', value: dailyClaimable ? 'รับได้ตอนนี้' : 'อยู่ในคูลดาวน์' },
          { label: 'รายวันคงเหลือ', value: dailyClaimable ? '0 นาที' : firstNonEmpty([missionsSummary.dailyRemainingText], dailyReason || 'ไม่ทราบ') },
          { label: 'สถานะรายสัปดาห์', value: weeklyClaimable ? 'รับได้ตอนนี้' : 'อยู่ในคูลดาวน์' },
          { label: 'รายสัปดาห์คงเหลือ', value: weeklyClaimable ? '0 ชั่วโมง' : firstNonEmpty([missionsSummary.weeklyRemainingText], weeklyReason || 'ไม่ทราบ') },
          { label: 'สถานะวงล้อ', value: facts.wheelState.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน' },
        ], 'ตอนนี้ยังไม่มีข้อมูลการรับรางวัลให้แสดง'),
        '</article></section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">โอกาสจากชุมชน</span><h2 class="plv4-section-title">ค่าหัวและช่วงเวลาพิเศษ</h2><p class="plv4-section-copy">ค่าหัวและไฮไลต์กิจกรรมควรอยู่คู่กับภารกิจ ไม่ควรถูกซ่อนไว้ในสถิติทั่วไป</p></div></div>',
        buildBountyFeed(facts.bounties.slice(0, 8)),
        '</article>',
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ฟีดชุมชน</span><h2 class="plv4-section-title">ประกาศและช่วงเวลา</h2><p class="plv4-section-copy">ฟีดขนาดกระชับสำหรับอัปเดตฝั่งกิจกรรมของผู้เล่น</p></div></div>',
        `<div class="plv4-feed-list">${renderFeed(facts.communityFeed, 'ตอนนี้ยังไม่มีอัปเดตกิจกรรมที่กำลังเปิดอยู่')}</div></section>`,
        '</section>',
        '<section class="plv4-content-grid">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ฟีดการต่อสู้</span><h2 class="plv4-section-title">การต่อสู้ล่าสุด</h2><p class="plv4-section-copy">ดูเหตุการณ์ล่าสุดที่เกี่ยวกับชุมชนและบัญชีที่คุณเชื่อมไว้ได้จากจุดเดียว</p></div></div>',
        `<div class="plv4-feed-list" data-player-killfeed>${buildKillFeedFeed(facts.killfeed.slice(0, 12))}</div>`,
        '</article>',
        '</section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ส่งคำขอเรด</span><h2 class="plv4-section-title">ส่งคำขอเรด</h2><p class="plv4-section-copy">ระบุช่วงเวลาที่ต้องการและรายละเอียดให้ครบ เพื่อให้ทีมงานตรวจคำขอได้จากหน้าเดียวโดยไม่ต้องไล่หาในแชต</p></div></div>',
        '<form class="plv4-inline-form" data-player-raid-request-form>',
        '<div class="plv4-form-grid">',
        '<label class="plv4-stack"><span class="plv4-section-kicker">ช่วงเวลาที่อยากได้</span><input class="plv4-input" type="text" name="preferredWindow" placeholder="เช่น ศุกร์ 21:00 ICT"></label>',
        '<label class="plv4-stack"><span class="plv4-section-kicker">สรุปคำขอ</span><textarea class="plv4-input" name="requestText" rows="4" placeholder="เช่น ขอเปิดเรดฝั่งตะวันตกหลังรวมทีมเรียบร้อย" required></textarea></label>',
        '<button class="plv4-button plv4-button-primary" type="submit" data-player-raid-request-submit>ส่งคำขอเรด</button>',
        '</div>',
        '</form>',
        buildRaidRequestTable(facts.raidRequests.slice(0, 8)),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">กระดานเรด</span><h2 class="plv4-section-title">ช่วงเวลาและสรุปผล</h2><p class="plv4-section-copy">ดูช่วงเวลาเรดที่ประกาศแล้วและสรุปผลล่าสุดโดยไม่ต้องออกจากพอร์ทัลผู้เล่น</p></div></div>',
        buildRaidWindowTable(facts.raidWindows.slice(0, 8)),
        buildRaidSummaryTable(facts.raidSummaries.slice(0, 8)),
        '</article>',
        '</section>',
      ].join(''),
    };
  }

  function buildDonationsPageContent(facts) {
    const donationsEnabled = sectionEnabledFromFacts(facts, 'donations');
    return {
      header: {
        title: 'สนับสนุนเซิร์ฟเวอร์',
        subtitle: 'แยกแพ็กเกจสนับสนุนและบริบทของชุมชนออกจากเครื่องมือแอดมินของผู้เช่าให้ชัด',
        statusChips: [
          { label: `${formatNumber(facts.supporterItems.length, '0')} แพ็กเกจสนับสนุน`, tone: facts.supporterItems.length > 0 ? 'info' : 'muted' },
          { label: `ยอดคงเหลือ ${formatAmount(facts.wallet.balance, '0')}`, tone: 'success' },
          { label: facts.steamLink.linked ? 'บัญชีพร้อมแล้ว' : 'โปรไฟล์ยังต้องตรวจ', tone: facts.steamLink.linked ? 'success' : 'warning' },
          { label: `${formatNumber(facts.communityFeed.length, '0')} อัปเดตจากชุมชน`, tone: 'info' },
        ],
        primaryAction: { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop') },
        secondaryActions: [
          { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile') },
          { label: 'เปิดกิจกรรม', href: buildCanonicalPlayerPath('events') },
        ],
      },
      summaryStrip: [
        { label: 'แพ็กเกจสนับสนุน', value: formatNumber(facts.supporterItems.length, '0'), detail: 'VIP หรือแพ็กเกจสนับสนุนที่เห็นได้ตอนนี้', tone: facts.supporterItems.length > 0 ? 'info' : 'muted' },
        { label: 'กระเป๋าเงิน', value: formatAmount(facts.wallet.balance, '0'), detail: 'ยอดที่ใช้ได้ก่อนสนับสนุน', tone: 'success' },
        { label: 'คำสั่งซื้อล่าสุด', value: facts.latestOrder ? facts.latestOrder.code : '-', detail: facts.latestOrder ? localizePlayerStatus(facts.latestOrder.status) : 'ยังไม่มีการซื้อล่าสุด', tone: facts.latestOrder ? facts.latestOrder.statusTone : 'muted' },
        { label: 'ผู้เล่นออนไลน์', value: formatNumber(facts.serverStatus.onlinePlayers, '0'), detail: 'ความเคลื่อนไหวของชุมชนตอนนี้', tone: 'info' },
        { label: 'ภารกิจที่เปิดอยู่', value: formatNumber(facts.missions.length, '0'), detail: 'ให้จังหวะของชุมชนยังมองเห็นได้', tone: 'info' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">แพ็กเกจสนับสนุน</span><h2 class="plv4-section-title">แพ็กเกจที่ช่วยสนับสนุนชุมชน</h2><p class="plv4-section-copy">ข้อเสนอสำหรับผู้สนับสนุนควรอยู่ในพอร์ทัลผู้เล่น ไม่ใช่ในเครื่องมือแอดมินของผู้เช่า</p></div></div>',
        `<div class="plv4-product-grid">${renderPlayerOfferGrid((facts.supporterItems.length ? facts.supporterItems : facts.shopItems.slice(0, 4)).map((item) => ({
          name: firstNonEmpty([item.name, item.id], 'แพ็กเกจสนับสนุน'),
          description: firstNonEmpty([item.description], 'สนับสนุนเซิร์ฟเวอร์นี้ผ่านแพ็กเกจสำหรับผู้เล่น'),
          price: formatAmount(item.price, '0'),
          kind: firstNonEmpty([item.kind], 'item'),
          requiresSteamLink: Boolean(item.requiresSteamLink),
          tone: 'info',
          primaryAction: {
            label: donationsEnabled ? 'เพิ่มลงรถเข็น' : 'ถูกล็อกอยู่',
            primary: true,
            data: {
              'data-player-cart-add': firstNonEmpty([item.id], ''),
            },
            disabled: !donationsEnabled || !item.id || (Boolean(item.requiresSteamLink) && !facts.steamLink.linked),
            reason: !donationsEnabled
              ? 'แพ็กเกจสนับสนุนถูกล็อกสำหรับแพ็กเกจของเซิร์ฟเวอร์นี้'
              : Boolean(item.requiresSteamLink) && !facts.steamLink.linked
                ? 'เชื่อม Steam ในหน้าโปรไฟล์ก่อนเพิ่มแพ็กเกจนี้'
                : '',
          },
          secondaryAction: {
            label: 'เปิดโปรไฟล์',
            href: buildCanonicalPlayerPath('profile'),
          },
        })))}</div></article>`,
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ทำไมต้องสนับสนุน</span><h2 class="plv4-section-title">ช่วยสนับสนุนได้โดยไม่สับสนกับงานแอดมิน</h2><p class="plv4-section-copy">ผู้เล่นดูแพ็กเกจสนับสนุนและบริบทของชุมชนได้จากตรงนี้ โดยไม่ต้องไปแตะหน้าแอดมิน</p></div></div>',
        `<div class="plv4-action-row">${[
          renderPlayerActionControl({ label: 'เปิดร้านค้าเต็ม', href: buildCanonicalPlayerPath('shop') }, 'เปิดร้านค้าเต็ม', buildCanonicalPlayerPath('shop')),
          renderPlayerActionControl({
            label: 'ชำระเงินจากรถเข็น',
            primary: true,
            data: { 'data-player-cart-checkout': true },
            disabled: !sectionEnabledFromFacts(facts, 'shop') || !Array.isArray(facts.cart?.rows) || facts.cart.rows.length === 0,
            reason: !Array.isArray(facts.cart?.rows) || facts.cart.rows.length === 0 ? 'เพิ่มแพ็กเกจสนับสนุนก่อนชำระเงิน' : '',
          }, 'ชำระเงินจากรถเข็น', null, { primary: true }),
        ].join('')}</div>`,
        renderKeyValueList([
          { label: 'เซิร์ฟเวอร์', value: firstNonEmpty([facts.serverInfo.name], 'เซิร์ฟเวอร์ชุมชน SCUM') },
          { label: 'ชุมชนออนไลน์', value: formatNumber(facts.serverStatus.onlinePlayers, '0') },
          { label: 'แพ็กเกจสนับสนุนตอนนี้', value: formatNumber(facts.supporterItems.length, '0') },
          { label: 'หน้าที่ควรเปิดต่อ', value: facts.supporterItems.length > 0 ? 'ร้านค้า' : 'หน้าหลัก' },
        ], 'ยังไม่มีสรุปผู้สนับสนุนให้แสดง'),
        '</article></section>',
      ].join(''),
    };
  }

  function buildProfilePageContent(facts) {
    const profile = facts.state?.profile || {};
    const steamLinked = facts.steamLink.linked === true;
    const steamLockReason = 'บัญชีนี้เชื่อม Steam อยู่แล้ว ถ้าจะเปลี่ยนหรือลบการเชื่อมตอนนี้ต้องให้ทีมงานช่วยดูให้';
    return {
      header: {
        title: 'บัญชีและการเชื่อมต่อ',
        subtitle: 'รวมโปรไฟล์ บัญชีที่เชื่อมไว้ และการเช็กความพร้อมไว้ในที่เดียวสำหรับผู้เล่น',
        statusChips: [
          { label: `บัญชี ${localizePlayerStatus(firstNonEmpty([profile.accountStatus, facts.state?.me?.accountStatus], 'active'))}`, tone: toneForStatus(firstNonEmpty([profile.accountStatus, facts.state?.me?.accountStatus], 'active')) },
          { label: facts.steamLink.linked ? 'เชื่อม Steam แล้ว' : 'ยังไม่เชื่อม Steam', tone: facts.steamLink.linked ? 'success' : 'warning' },
          { label: `${formatNumber(facts.linkHistory.length, '0')} รายการเชื่อมบัญชี`, tone: facts.linkHistory.length > 0 ? 'info' : 'muted' },
          { label: facts.state?.lastRefreshedAt ? `อัปเดต ${formatRelative(facts.state.lastRefreshedAt)}` : 'กำลังรอซิงก์', tone: 'info' },
        ],
        primaryAction: facts.steamLink.linked
          ? { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop') }
          : { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        secondaryActions: [
          { label: 'คำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') },
          { label: 'หน้าหลัก', href: buildCanonicalPlayerPath('home') },
        ],
      },
      summaryStrip: [
        { label: 'ชื่อที่แสดง', value: firstNonEmpty([profile.displayName, facts.state?.me?.user], 'ผู้เล่น'), detail: 'ชื่อที่ผู้เล่นเห็นตอนนี้', tone: 'info' },
        { label: 'Steam', value: facts.steamLink.linked ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'เชื่อมแล้ว') : 'ยังไม่เชื่อม', detail: 'เช็กความพร้อมสำหรับการส่งของ', tone: facts.steamLink.linked ? 'success' : 'warning' },
        { label: 'อีเมล', value: firstNonEmpty([profile.primaryEmail, facts.state?.me?.primaryEmail], 'ไม่มีอีเมลในการเข้าสู่ระบบครั้งนี้'), detail: 'ช่องทางติดต่อหลักเมื่อการเข้าสู่ระบบนี้มีอีเมล', tone: 'muted' },
        { label: 'ประวัติการเชื่อม', value: formatNumber(facts.linkHistory.length, '0'), detail: 'การเปลี่ยนแปลงการเชื่อมบัญชีที่ถูกบันทึกไว้', tone: facts.linkHistory.length > 0 ? 'info' : 'muted' },
        { label: 'คำสั่งซื้อที่กำลังทำงาน', value: formatNumber(facts.pendingOrders.length, '0'), detail: 'เช็กตรงนี้ก่อนขอความช่วยเหลือ', tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">โปรไฟล์</span><h2 class="plv4-section-title">สรุปบัญชี</h2><p class="plv4-section-copy">ทุกอย่างที่ผู้เล่นควรตรวจให้พร้อมก่อนซื้อหรือขอความช่วยเหลือ</p></div></div>',
        renderKeyValueList([
          { label: 'ชื่อที่แสดง', value: firstNonEmpty([profile.displayName, facts.state?.me?.user], 'ผู้เล่น') },
          { label: 'สถานะบัญชี', value: localizePlayerStatus(firstNonEmpty([profile.accountStatus, facts.state?.me?.accountStatus], 'active')) },
          { label: 'การเชื่อม Steam', value: facts.steamLink.linked ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม' },
          { label: 'ชื่อในเกม', value: firstNonEmpty([facts.steamLink.inGameName], '-') },
          { label: 'Steam ID', value: firstNonEmpty([facts.steamLink.steamId], '-') },
          { label: 'อีเมลหลัก', value: firstNonEmpty([profile.primaryEmail, facts.state?.me?.primaryEmail], 'ไม่มีอีเมลในการเข้าสู่ระบบครั้งนี้') },
        ], 'ยังไม่มีรายละเอียดโปรไฟล์'),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">การเชื่อมต่อ</span><h2 class="plv4-section-title">การเชื่อม Steam และความพร้อม</h2><p class="plv4-section-copy">ให้เงื่อนไขเรื่อง Steam ยังมองเห็นได้ เพื่อให้การซื้อและการส่งของคาดเดาได้ง่าย</p></div></div>',
        steamLinked
          ? [
            renderKeyValueList([
              { label: 'พร้อมรับไอเทมในเกม', value: 'ใช่' },
              { label: 'คำสั่งซื้อที่กำลังทำงาน', value: formatNumber(facts.pendingOrders.length, '0') },
              { label: 'คำสั่งซื้อที่อาจต้องช่วยดู', value: formatNumber(facts.failedOrders.length, '0') },
              { label: 'หน้าที่ควรเปิดต่อ', value: 'ร้านค้า' },
            ], 'ยังไม่มีข้อมูลความพร้อม'),
            `<p class="plv4-inline-copy">${escapeHtml(steamLockReason)}</p>`,
            `<div class="plv4-action-row">${[
              renderPlayerActionControl({ label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') }, 'เปิดหน้าช่วยเหลือ', buildCanonicalPlayerPath('support')),
              renderPlayerActionControl({ label: 'ยังยกเลิกการเชื่อมเองไม่ได้', disabled: true, reason: steamLockReason }, 'ยังยกเลิกการเชื่อมเองไม่ได้', null),
            ].join('')}</div>`,
          ].join('')
          : [
            '<form class="plv4-inline-form" data-player-steam-link-form>',
            '<div class="plv4-form-grid">',
            `<label class="plv4-stack"><span class="plv4-section-kicker">SteamID</span><input class="plv4-input" type="text" name="steamId" inputmode="numeric" placeholder="7656119..." required></label>`,
            '<button class="plv4-button plv4-button-primary" type="submit">เชื่อม SteamID</button>',
            '</div>',
            '<p class="plv4-inline-copy">กรอก SteamID แบบตัวเลข 15-25 หลักที่ตรงกับบัญชีในเกมของคุณก่อนซื้อของที่ต้องส่งในเกม</p>',
            '</form>',
            renderKeyValueList([
              { label: 'พร้อมรับไอเทมในเกม', value: 'ไม่' },
              { label: 'คำสั่งซื้อที่กำลังทำงาน', value: formatNumber(facts.pendingOrders.length, '0') },
              { label: 'คำสั่งซื้อที่อาจต้องช่วยดู', value: formatNumber(facts.failedOrders.length, '0') },
              { label: 'หน้าที่ควรเปิดต่อ', value: 'ช่วยเหลือ' },
            ], 'ยังไม่มีข้อมูลความพร้อม'),
          ].join(''),
        '</article></section>',
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ประวัติการเชื่อมบัญชี</span><h2 class="plv4-section-title">รายการเชื่อมบัญชีล่าสุด</h2><p class="plv4-section-copy">ให้ผู้เล่นดูประวัติผู้ให้บริการและการยืนยันได้ โดยไม่ต้องเปิดเครื่องมือแอดมิน</p></div></div>',
        buildLinkHistoryTable(facts.linkHistory.slice(0, 12)),
        '</section>',
      ].join(''),
    };
  }

  function buildSupportPageContent(facts) {
    const supportTasks = [
      {
        tone: facts.failedOrders.length > 0 ? 'danger' : 'info',
        tag: 'เริ่มตรงนี้',
        title: facts.failedOrders.length > 0 ? 'เช็กรายการที่ส่งไม่สำเร็จก่อน' : 'เริ่มจากเช็กลิสต์ช่วยเหลือก่อน',
        detail: facts.failedOrders.length > 0
          ? 'เปิดดูคำสั่งซื้อที่มีปัญหาก่อนติดต่อทีมงาน เพื่อเตรียมรหัสคำสั่งซื้อไว้'
          : 'เริ่มจากโปรไฟล์ สถานะการส่งของ และประกาศล่าสุดก่อนขอความช่วยเหลือ',
        actions: [
          { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders'), primary: true },
          { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile') },
        ],
      },
      {
        tone: facts.steamLink.linked ? 'success' : 'warning',
        tag: 'เช็กบัญชี',
        title: facts.steamLink.linked ? 'การเชื่อม Steam ดูพร้อมแล้ว' : 'การเชื่อม Steam ยังต้องจัดการ',
        detail: facts.steamLink.linked
          ? 'ถ้าต้องให้ทีมงานช่วย ให้เตรียมชื่อในเกมและรหัสคำสั่งซื้อไว้'
          : 'ถ้าปัญหาเกี่ยวกับการส่งของหรือจับคู่บัญชี ให้เชื่อม Steam ก่อน',
        actions: [
          { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile'), primary: !facts.steamLink.linked },
          { label: 'เปิดการส่งของ', href: buildCanonicalPlayerPath('delivery'), primary: facts.steamLink.linked },
        ],
      },
    ];

    return {
      header: {
        title: 'ช่วยเหลือ',
        subtitle: 'ทำให้การขอความช่วยเหลือเรียบง่าย: เกิดอะไรขึ้น ควรเช็กอะไรก่อน และต้องเตรียมข้อมูลอะไรไว้บ้าง',
        statusChips: [
          { label: `${formatNumber(facts.failedOrders.length, '0')} รายการส่งไม่สำเร็จ`, tone: facts.failedOrders.length > 0 ? 'danger' : 'muted' },
          { label: `${formatNumber(facts.supportAlerts.length, '0')} คำเตือน`, tone: facts.supportAlerts.length > 0 ? 'warning' : 'success' },
          { label: facts.steamLink.linked ? 'เชื่อม Steam แล้ว' : 'ยังไม่เชื่อม Steam', tone: facts.steamLink.linked ? 'success' : 'warning' },
          { label: `${formatNumber(facts.pendingOrders.length, '0')} คำสั่งซื้อที่กำลังดำเนินการ`, tone: facts.pendingOrders.length > 0 ? 'info' : 'muted' },
        ],
        primaryAction: facts.failedOrders.length > 0
          ? { label: 'เปิดคำสั่งซื้อก่อน', href: buildCanonicalPlayerPath('orders') }
          : { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile') },
        secondaryActions: [
          { label: 'การส่งของ', href: buildCanonicalPlayerPath('delivery') },
          { label: 'หน้าหลัก', href: buildCanonicalPlayerPath('home') },
        ],
      },
      summaryStrip: [
        { label: 'ส่งของไม่สำเร็จ', value: formatNumber(facts.failedOrders.length, '0'), detail: 'เช็กรหัสคำสั่งซื้อก่อนคุยกับทีมงาน', tone: facts.failedOrders.length > 0 ? 'danger' : 'muted' },
        { label: 'คำเตือน', value: formatNumber(facts.supportAlerts.length, '0'), detail: 'ประกาศในพอร์ทัลที่อาจอธิบายปัญหาได้', tone: facts.supportAlerts.length > 0 ? 'warning' : 'success' },
        { label: 'Steam พร้อมใช้งาน', value: facts.steamLink.linked ? 'ใช่' : 'ไม่', detail: 'เชื่อม Steam ถ้าปัญหาเกี่ยวกับการส่งของ', tone: facts.steamLink.linked ? 'success' : 'warning' },
        { label: 'รหัสคำสั่งซื้อล่าสุด', value: facts.latestOrder ? facts.latestOrder.code : '-', detail: facts.latestOrder ? localizePlayerStatus(facts.latestOrder.status) : 'ยังไม่มีคำสั่งซื้อล่าสุด', tone: facts.latestOrder ? facts.latestOrder.statusTone : 'muted' },
        { label: 'อัปเดต', value: formatNumber(facts.communityFeed.length, '0'), detail: 'การแจ้งเตือนและประกาศล่าสุด', tone: 'info' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ทำต่อ</span><h2 class="plv4-section-title">เปิดหน้าที่ถูกก่อนขอความช่วยเหลือ</h2><p class="plv4-section-copy">หน้าช่วยเหลือควรลดความสับสน ไม่ใช่สร้างแดชบอร์ดอีกอัน</p></div></div>',
        `<div class="plv4-task-grid">${renderTaskGroups(supportTasks)}</div></section>`,
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">เช็กลิสต์</span><h2 class="plv4-section-title">ควรเตรียมอะไรไว้</h2><p class="plv4-section-copy">เตรียมข้อมูลพวกนี้ไว้ก่อนติดต่อทีมงาน</p></div></div>',
        renderKeyValueList([
          { label: 'รหัสคำสั่งซื้อ', value: facts.latestOrder ? facts.latestOrder.code : 'ยังไม่มีคำสั่งซื้อล่าสุด' },
          { label: 'Steam ID หรือชื่อในเกม', value: facts.steamLink.linked ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'เชื่อมแล้ว') : 'เชื่อม Steam ก่อนถ้าปัญหาเกี่ยวกับการส่งของ' },
          { label: 'จำนวนที่ส่งไม่สำเร็จ', value: formatNumber(facts.failedOrders.length, '0') },
          { label: 'คำเตือนในพอร์ทัล', value: formatNumber(facts.supportAlerts.length, '0') },
        ], 'ยังไม่มีเช็กลิสต์ช่วยเหลือให้แสดง'),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">การแจ้งเตือนล่าสุด</span><h2 class="plv4-section-title">คำเตือนและประกาศ</h2><p class="plv4-section-copy">ดูสิ่งเหล่านี้ก่อนเริ่มคุยกับทีมงาน</p></div></div>',
        `<div class="plv4-feed-list">${renderFeed(facts.communityFeed, 'ตอนนี้ยังไม่มีคำเตือนหรือประกาศล่าสุด')}</div></article></section>`,
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">คำสั่งซื้อที่อาจต้องช่วยดู</span><h2 class="plv4-section-title">ปัญหาการส่งของฝั่งผู้เล่น</h2><p class="plv4-section-copy">โฟกัสผลกระทบที่เกิดกับผู้เล่น ไม่ใช่งานปฏิบัติการของเซิร์ฟเวอร์</p></div></div>',
        buildDeliveryTable(facts.failedOrders.length > 0 ? facts.failedOrders : facts.orders.slice(0, 8)),
        '</section>',
      ].join(''),
    };
  }

  function buildProfilePageContentReady(facts) {
    const profile = facts.state?.profile || {};
    const steamLinked = facts.steamLink.linked === true;
    const steamLockReason = 'บัญชี Steam นี้เชื่อมไว้แล้ว ถ้าต้องการเปลี่ยนหรือถอดการเชื่อม ให้ติดต่อทีมงานเพื่อช่วยตรวจและยืนยันให้ปลอดภัยก่อน';
    const identitySummary = facts.identitySummary || {};
    const linkedAccounts = identitySummary.linkedAccounts || {};
    const activeMembership = identitySummary.activeMembership || null;
    const verificationState = firstNonEmpty([identitySummary.verificationState], steamLinked ? 'steam_linked' : 'unverified');
    const emailAccount = linkedAccounts.email || {};
    const discordAccount = linkedAccounts.discord || {};
    const steamAccount = linkedAccounts.steam || {};
    const inGameAccount = linkedAccounts.inGame || {};
    const membershipValue = formatMembershipValue(activeMembership);
    const linkedAccountRows = [
      { label: 'สถานะการยืนยันตัวตน', value: localizeVerificationState(verificationState) },
      { label: 'สิทธิ์ที่ใช้งานอยู่', value: membershipValue },
      {
        label: 'อีเมล',
        value: formatLinkedAccountValue(emailAccount, 'ยังไม่เชื่อม'),
      },
      {
        label: 'Discord',
        value: formatLinkedAccountValue(discordAccount, 'ยังไม่เชื่อม'),
      },
      {
        label: 'Steam',
        value: steamAccount.linked
          ? formatLinkedAccountValue({ ...steamAccount, value: firstNonEmpty([steamAccount.value, facts.steamLink.steamId], 'เชื่อมแล้ว') }, 'ยังไม่เชื่อม')
          : 'ยังไม่เชื่อม',
      },
      {
        label: 'โปรไฟล์ในเกม',
        value: inGameAccount.linked
          ? formatLinkedAccountValue({ ...inGameAccount, value: firstNonEmpty([inGameAccount.value, facts.steamLink.inGameName], 'เชื่อมแล้ว') }, 'ยังไม่เชื่อม')
          : 'ยังไม่เชื่อม',
      },
    ];

    return {
      header: {
        title: 'บัญชีและการเชื่อมต่อ',
        subtitle: 'เช็กบัญชีที่เชื่อมไว้ ความพร้อมสำหรับรับของในเกม และสิทธิ์ที่ใช้งานอยู่จากหน้าเดียว',
        statusChips: [
          { label: `บัญชี ${localizePlayerStatus(firstNonEmpty([profile.accountStatus, facts.state?.me?.accountStatus], 'active'))}`, tone: toneForStatus(firstNonEmpty([profile.accountStatus, facts.state?.me?.accountStatus], 'active')) },
          { label: steamLinked ? 'Steam เชื่อมแล้ว' : 'Steam ยังไม่เชื่อม', tone: steamLinked ? 'success' : 'warning' },
          { label: `การยืนยัน ${localizeVerificationState(verificationState)}`, tone: /verified/i.test(verificationState || '') ? 'success' : 'warning' },
          { label: activeMembership ? `สิทธิ์ ${localizeMembershipRole(firstNonEmpty([activeMembership.role, activeMembership.membershipType], 'member'))}` : 'ยังไม่มีสิทธิ์ใช้งาน', tone: activeMembership ? 'info' : 'warning' },
          { label: `${formatNumber(facts.linkHistory.length, '0')} รายการในประวัติการเชื่อม`, tone: facts.linkHistory.length > 0 ? 'info' : 'muted' },
          { label: facts.state?.lastRefreshedAt ? `อัปเดต ${formatRelative(facts.state.lastRefreshedAt)}` : 'รอข้อมูลล่าสุด', tone: 'info' },
        ],
        primaryAction: steamLinked
          ? { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop') }
          : { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        secondaryActions: [
          { label: 'คำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') },
          { label: 'กลับหน้าแรก', href: buildCanonicalPlayerPath('home') },
        ],
      },
      summaryStrip: [
        { label: 'ชื่อที่ใช้แสดง', value: firstNonEmpty([profile.displayName, facts.state?.me?.user], 'ผู้เล่น'), detail: 'ชื่อที่ผู้เล่นคนอื่นและระบบมองเห็นตอนนี้', tone: 'info' },
        { label: 'Steam', value: steamLinked ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'เชื่อมแล้ว') : 'ยังไม่เชื่อม', detail: 'จำเป็นถ้าจะรับของที่ต้องส่งเข้าเกม', tone: steamLinked ? 'success' : 'warning' },
        { label: 'อีเมลหลัก', value: firstNonEmpty([profile.primaryEmail, facts.state?.me?.primaryEmail], 'ยังไม่มีอีเมลในรอบนี้'), detail: 'ใช้กู้บัญชีและรับการแจ้งเตือนสำคัญ', tone: 'muted' },
        { label: 'การยืนยัน', value: localizeVerificationState(verificationState), detail: 'ดูพร้อมกันทั้งบัญชีที่เชื่อมและความพร้อมในเกม', tone: /verified/i.test(verificationState || '') ? 'success' : 'warning' },
        { label: 'สิทธิ์ที่ใช้งาน', value: membershipValue, detail: 'สิทธิ์ของผู้เล่นคนนี้ในชุมชนปัจจุบัน', tone: activeMembership ? 'info' : 'warning' },
        { label: 'คำสั่งซื้อที่ยังไม่จบ', value: formatNumber(facts.pendingOrders.length, '0'), detail: 'เช็กตรงนี้ก่อนติดต่อทีมงานเรื่องการส่งของ', tone: facts.pendingOrders.length > 0 ? 'warning' : 'success' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<section class="plv4-media-panel"><div class="plv4-media-copy"><span class="plv4-section-kicker">ภาพรวมบัญชี</span><h2 class="plv4-section-title">เช็กตัวตนและความพร้อมก่อนซื้อหรือขอความช่วยเหลือ</h2><p class="plv4-section-copy">ถ้าหน้านี้ชัด ผู้เล่นจะรู้เองว่าต้องเชื่อมอะไรเพิ่ม ต้องไปหน้าไหนต่อ และพร้อมรับของในเกมแล้วหรือยัง</p><div class="plv4-action-row"><a class="plv4-button plv4-button-primary" href="' + buildCanonicalPlayerPath(steamLinked ? 'shop' : 'support') + '">' + escapeHtml(steamLinked ? 'ไปที่ร้านค้า' : 'ไปที่หน้าช่วยเหลือ') + '</a><a class="plv4-button" href="' + buildCanonicalPlayerPath('orders') + '">ดูคำสั่งซื้อ</a></div></div><div class="plv4-media-frame" style="--plv4-media-image: linear-gradient(140deg, rgba(9, 12, 14, 0.2), rgba(9, 12, 14, 0.68)), url(\'/player/assets/ui/visuals/scum/feature-identity.jpg\');"><div class="plv4-media-badge-row"><span class="plv4-badge plv4-badge-info">บัญชี</span><span class="plv4-badge ' + (steamLinked ? 'plv4-badge-success' : 'plv4-badge-warning') + '">' + escapeHtml(steamLinked ? 'Steam พร้อมแล้ว' : 'ยังต้องเชื่อม Steam') + '</span></div></div></section>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">โปรไฟล์</span><h2 class="plv4-section-title">สรุปบัญชี</h2><p class="plv4-section-copy">รวมข้อมูลหลักที่ผู้เล่นควรเช็กก่อนซื้อของ เชื่อมบัญชี หรือขอความช่วยเหลือ</p></div></div>',
        renderKeyValueList([
          { label: 'ชื่อที่ใช้แสดง', value: firstNonEmpty([profile.displayName, facts.state?.me?.user], 'ผู้เล่น') },
          { label: 'สถานะบัญชี', value: localizePlayerStatus(firstNonEmpty([profile.accountStatus, facts.state?.me?.accountStatus], 'active')) },
          { label: 'Steam เชื่อมแล้ว', value: localizeYesNo(steamLinked) },
          { label: 'ชื่อในเกม', value: firstNonEmpty([facts.steamLink.inGameName], '-') },
          { label: 'Steam ID', value: firstNonEmpty([facts.steamLink.steamId], '-') },
          { label: 'อีเมลหลัก', value: firstNonEmpty([profile.primaryEmail, facts.state?.me?.primaryEmail], 'ยังไม่มีอีเมลในรอบนี้') },
          { label: 'รหัสผู้ใช้แพลตฟอร์ม', value: firstNonEmpty([profile.platformUserId, facts.state?.me?.platformUserId], '-') },
        ], 'ยังไม่มีรายละเอียดโปรไฟล์ให้แสดง'),
        '</article>',
        '<article class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ตัวตนที่เชื่อมไว้</span><h2 class="plv4-section-title">บัญชีที่เชื่อมและความพร้อม</h2><p class="plv4-section-copy">ดูผู้ให้บริการที่เชื่อมไว้ สิทธิ์ที่ใช้งาน และความพร้อมสำหรับรับของในเกมโดยไม่ต้องเปิดหน้าแอดมิน</p></div></div>',
        `<div data-player-identity-summary>${renderKeyValueList(linkedAccountRows, 'ยังไม่มีข้อมูลความพร้อมของบัญชีที่เชื่อมไว้')}</div>`,
        steamLinked
          ? [
            renderKeyValueList([
              { label: 'พร้อมรับของในเกม', value: 'ใช่' },
              { label: 'คำสั่งซื้อที่ยังไม่จบ', value: formatNumber(facts.pendingOrders.length, '0') },
              { label: 'คำสั่งซื้อที่ควรตามต่อ', value: formatNumber(facts.failedOrders.length, '0') },
              { label: 'หน้าที่ควรเปิดต่อ', value: 'ร้านค้า' },
            ], 'ยังไม่มีรายละเอียดความพร้อมเพิ่มเติม'),
            `<p class="plv4-inline-copy">${escapeHtml(steamLockReason)}</p>`,
            `<div class="plv4-action-row">${[
              renderPlayerActionControl({ label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') }, 'เปิดหน้าช่วยเหลือ', buildCanonicalPlayerPath('support')),
              renderPlayerActionControl({ label: 'ยังไม่เปิดให้ถอดการเชื่อมเอง', disabled: true, reason: steamLockReason }, 'ยังไม่เปิดให้ถอดการเชื่อมเอง', null),
            ].join('')}</div>`,
          ].join('')
          : [
            '<form class="plv4-inline-form" data-player-steam-link-form>',
            '<div class="plv4-form-grid">',
            '<label class="plv4-stack"><span class="plv4-section-kicker">Steam ID</span><input class="plv4-input" type="text" name="steamId" inputmode="numeric" placeholder="7656119..." required></label>',
            '<button class="plv4-button plv4-button-primary" type="submit">เชื่อม Steam ID</button>',
            '</div>',
            '<p class="plv4-inline-copy">ใส่ Steam ID แบบตัวเลข 15-25 หลักที่ตรงกับบัญชีที่ใช้ในเกม ก่อนซื้อของที่ต้องส่งเข้าเกมจริง</p>',
            '</form>',
            renderKeyValueList([
              { label: 'พร้อมรับของในเกม', value: 'ไม่' },
              { label: 'คำสั่งซื้อที่ยังไม่จบ', value: formatNumber(facts.pendingOrders.length, '0') },
              { label: 'คำสั่งซื้อที่ควรตามต่อ', value: formatNumber(facts.failedOrders.length, '0') },
              { label: 'หน้าที่ควรเปิดต่อ', value: 'ช่วยเหลือ' },
            ], 'ยังไม่มีรายละเอียดความพร้อมเพิ่มเติม'),
          ].join(''),
        '</article></section>',
        '<section class="plv4-panel"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ประวัติ</span><h2 class="plv4-section-title">ประวัติการเชื่อมบัญชี</h2><p class="plv4-section-copy">ให้ผู้เล่นย้อนดูการเปลี่ยนแปลงของบัญชีที่เชื่อมไว้และกิจกรรมการยืนยันตัวตนได้จากจุดเดียว</p></div></div>',
        buildLinkHistoryTable(facts.linkHistory.slice(0, 12)),
        '</section>',
      ].join(''),
    };
  }

  function buildDonationsPageContentReady(facts) {
    const donationsEnabled = sectionEnabledFromFacts(facts, 'donations');
    const supporterOffers = facts.supporterItems.length ? facts.supporterItems : facts.shopItems.slice(0, 4);
    const donationOrders = Array.isArray(facts.donationOrders) ? facts.donationOrders : [];
    const latestDonationOrder = facts.latestDonationOrder || null;
    const activeSupporterOrder = facts.activeSupporterOrder || null;
    const latestDonationStatus = String(
      latestDonationOrder?.rawStatus
      || latestDonationOrder?.status
      || latestDonationOrder?.statusText
      || latestDonationOrder?.statusLabel
      || '',
    ).trim().toLowerCase();
    const readinessItems = [];

    if (!donationsEnabled) {
      readinessItems.push({
        tone: 'warning',
        tag: 'แพ็กเกจ',
        title: 'ยังไม่เปิดเครื่องมือผู้สนับสนุน',
        detail: 'แพ็กเกจของเซิร์ฟเวอร์นี้ยังไม่เปิดการซื้อแพ็กเกจผู้สนับสนุน จึงควรรอให้เจ้าของระบบหรือแพ็กเกจปลดสิทธิ์ก่อน',
        actions: [
          { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop'), primary: true },
          { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      });
    }

    if (!facts.steamLink.linked) {
      readinessItems.push({
        tone: 'warning',
        tag: 'บัญชี',
        title: 'เชื่อม Steam ก่อนรับของผู้สนับสนุน',
        detail: 'ถ้าแพ็กเกจผู้สนับสนุนมีของที่ต้องส่งเข้าเกม คุณต้องเชื่อม Steam ในหน้าโปรไฟล์ก่อน',
        actions: [
          { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile'), primary: true },
          { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      });
    }

    if (donationsEnabled && supporterOffers.length === 0) {
      readinessItems.push({
        tone: 'muted',
        tag: 'รายการขาย',
        title: 'ยังไม่มีแพ็กเกจผู้สนับสนุน',
        detail: 'ตอนนี้ยังไม่มีแพ็กเกจผู้สนับสนุนที่เปิดขายในเซิร์ฟเวอร์นี้ แม้หน้าจะพร้อมแล้ว แต่ยังไม่มีอะไรให้เลือกซื้อ',
        actions: [
          { label: 'กลับหน้าแรก', href: buildCanonicalPlayerPath('home'), primary: true },
          { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      });
    }

    if (donationsEnabled && supporterOffers.length > 0 && donationOrders.length === 0) {
      readinessItems.push({
        tone: 'info',
        tag: 'ขั้นถัดไป',
        title: 'เลือกแพ็กเกจผู้สนับสนุน',
        detail: 'เลือกแพ็กเกจที่เปิดขายด้านล่าง เพิ่มลงตะกร้า แล้วค่อยไปจบการชำระเงินจากหน้าร้านค้าของผู้เล่น',
        actions: [
          { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop'), primary: true },
          { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') },
        ],
      });
    }

    if (latestDonationOrder && ['pending', 'queued', 'processing', 'delivering', 'delivery_failed'].includes(latestDonationStatus)) {
      readinessItems.push({
        tone: latestDonationStatus === 'delivery_failed' ? 'warning' : 'info',
        tag: 'การส่งของ',
        title: latestDonationStatus === 'delivery_failed' ? 'การส่งของผู้สนับสนุนต้องตามต่อ' : 'ติดตามคำสั่งซื้อล่าสุดของผู้สนับสนุน',
        detail: latestDonationStatus === 'delivery_failed'
          ? 'คำสั่งซื้อล่าสุดยังต้องให้ทีมงานช่วยตามต่อหรือสั่งส่งใหม่อีกครั้ง'
          : 'คำสั่งซื้อล่าสุดยังอยู่ระหว่างชำระเงินหรือส่งของ ควรเปิดหน้าคำสั่งซื้อทิ้งไว้จนกว่าจะเสร็จ',
        actions: [
          { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders'), primary: true },
          { label: 'เปิดหน้าช่วยเหลือ', href: buildCanonicalPlayerPath('support') },
        ],
      });
    }

    if (!readinessItems.length) {
      readinessItems.push({
        tone: 'success',
        tag: 'พร้อมแล้ว',
        title: 'เส้นทางผู้สนับสนุนพร้อมใช้งาน',
        detail: 'บัญชีเชื่อมครบแล้ว แพ็กเกจมองเห็นได้ และตอนนี้ยังไม่มีเรื่องเร่งด่วนที่ต้องตามต่อ',
        actions: [
          { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop'), primary: true },
          { label: 'เปิดกิจกรรม', href: buildCanonicalPlayerPath('events') },
        ],
      });
    }

    return {
      header: {
        title: 'สนับสนุนเซิร์ฟเวอร์',
        subtitle: 'รวมแพ็กเกจผู้สนับสนุน ความพร้อมของบัญชี และประวัติการซื้อไว้ในมุมมองเดียวของผู้เล่น',
        statusChips: [
          { label: `${formatNumber(supporterOffers.length, '0')} แพ็กเกจผู้สนับสนุน`, tone: supporterOffers.length > 0 ? 'info' : 'muted' },
          { label: `ยอดคงเหลือ ${formatAmount(facts.wallet.balance, '0')}`, tone: 'success' },
          { label: donationsEnabled ? 'เปิดสิทธิ์ผู้สนับสนุนแล้ว' : 'ยังไม่เปิดสิทธิ์ผู้สนับสนุน', tone: donationsEnabled ? 'success' : 'warning' },
          { label: facts.steamLink.linked ? 'Steam พร้อมแล้ว' : 'ยังต้องเชื่อม Steam', tone: facts.steamLink.linked ? 'success' : 'warning' },
        ],
        primaryAction: { label: 'เปิดร้านค้า', href: buildCanonicalPlayerPath('shop') },
        secondaryActions: [
          { label: 'เปิดโปรไฟล์', href: buildCanonicalPlayerPath('profile') },
          { label: 'เปิดคำสั่งซื้อ', href: buildCanonicalPlayerPath('orders') },
        ],
      },
      summaryStrip: [
        { label: 'แพ็กเกจผู้สนับสนุน', value: formatNumber(supporterOffers.length, '0'), detail: 'VIP หรือแพ็กเกจผู้สนับสนุนที่ผู้เล่นเลือกได้ตอนนี้', tone: supporterOffers.length > 0 ? 'info' : 'muted' },
        { label: 'ประวัติการสนับสนุน', value: formatNumber(donationOrders.length, '0'), detail: 'รายการสนับสนุนที่บัญชีนี้เคยซื้อไว้แล้ว', tone: donationOrders.length > 0 ? 'success' : 'muted' },
        { label: 'แพ็กเกจที่ใช้อยู่', value: activeSupporterOrder ? firstNonEmpty([activeSupporterOrder.itemName, activeSupporterOrder.itemId], '-') : 'ยังไม่มี', detail: activeSupporterOrder ? localizePlayerStatus(orderStatusLabel(activeSupporterOrder.statusText || activeSupporterOrder.status)) : 'ตอนนี้ยังไม่มีคำสั่งซื้อผู้สนับสนุนที่กำลังใช้งานอยู่', tone: activeSupporterOrder ? 'success' : 'muted' },
        { label: 'ผู้เล่นออนไลน์ในชุมชน', value: formatNumber(facts.serverStatus.onlinePlayers, '0'), detail: 'ใช้งานสิทธิ์ผู้สนับสนุนและกิจกรรมได้โดยไม่ต้องออกจากพอร์ทัลนี้', tone: 'info' },
      ],
      railCards: buildRailCommon(facts),
      mainHtml: [
        '<section class="plv4-media-panel"><div class="plv4-media-copy"><span class="plv4-section-kicker">หน้าผู้สนับสนุน</span><h2 class="plv4-section-title">ดูแพ็กเกจที่ซื้อได้และความพร้อมของบัญชีก่อนกดจ่าย</h2><p class="plv4-section-copy">หน้านี้ควรตอบผู้เล่นให้ได้ทันทีว่ามีอะไรให้ซื้อ ต้องเชื่อมอะไรเพิ่ม และตอนนี้คำสั่งซื้อผู้สนับสนุนค้างอยู่หรือไม่</p><div class="plv4-action-row"><a class="plv4-button plv4-button-primary" href="' + buildCanonicalPlayerPath('shop') + '">เปิดร้านค้า</a><a class="plv4-button" href="' + buildCanonicalPlayerPath('profile') + '">เปิดโปรไฟล์</a></div></div><div class="plv4-media-frame" style="--plv4-media-image: linear-gradient(140deg, rgba(9, 12, 14, 0.18), rgba(9, 12, 14, 0.68)), url(\'/player/assets/ui/visuals/scum/feature-support.jpg\');"><div class="plv4-media-badge-row"><span class="plv4-badge plv4-badge-info">ผู้สนับสนุน</span><span class="plv4-badge ' + (facts.steamLink.linked ? 'plv4-badge-success' : 'plv4-badge-warning') + '">' + escapeHtml(facts.steamLink.linked ? 'พร้อมรับของในเกม' : 'ยังต้องเชื่อม Steam') + '</span></div></div></section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel" data-player-supporter-offers><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">แพ็กเกจผู้สนับสนุน</span><h2 class="plv4-section-title">แพ็กเกจที่เปิดขายอยู่ตอนนี้</h2><p class="plv4-section-copy">แสดงแพ็กเกจในมุมของผู้เล่นโดยตรง ไม่ปะปนกับหน้าจัดการของฝั่งแอดมิน</p></div></div>',
        `<div class="plv4-product-grid">${renderPlayerOfferGrid(supporterOffers.map((item) => ({
          name: firstNonEmpty([item.name, item.id], 'แพ็กเกจผู้สนับสนุน'),
          description: firstNonEmpty([item.description], 'สนับสนุนชุมชน SCUM นี้ผ่านแพ็กเกจผู้สนับสนุนที่ผู้เล่นเลือกซื้อได้เอง'),
          price: formatAmount(item.price, '0'),
          kind: firstNonEmpty([item.kind], 'item'),
          requiresSteamLink: Boolean(item.requiresSteamLink),
          tone: 'info',
          primaryAction: {
            label: donationsEnabled ? 'เพิ่มลงตะกร้า' : 'ยังถูกล็อก',
            primary: true,
            data: {
              'data-player-cart-add': firstNonEmpty([item.id], ''),
            },
            disabled: !donationsEnabled || !item.id || (Boolean(item.requiresSteamLink) && !facts.steamLink.linked),
            reason: !donationsEnabled
              ? 'การซื้อแพ็กเกจผู้สนับสนุนยังถูกล็อกโดยแพ็กเกจปัจจุบัน'
              : Boolean(item.requiresSteamLink) && !facts.steamLink.linked
                ? 'เชื่อม Steam ในหน้าโปรไฟล์ก่อน แล้วค่อยเพิ่มแพ็กเกจนี้ลงตะกร้า'
                : '',
          },
          secondaryAction: {
            label: 'เปิดโปรไฟล์',
            href: buildCanonicalPlayerPath('profile'),
          },
        })))}</div></article>`,
        '<article class="plv4-panel" data-player-supporter-summary><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">สถานะผู้สนับสนุน</span><h2 class="plv4-section-title">ความพร้อมและสถานะล่าสุด</h2><p class="plv4-section-copy">สรุปให้ชัดก่อนชำระเงินและหลังส่งของ ว่าตอนนี้บัญชีพร้อมแค่ไหนและมีอะไรต้องตามต่อ</p></div></div>',
        renderKeyValueList([
          { label: 'แพ็กเกจปัจจุบัน', value: activeSupporterOrder ? firstNonEmpty([activeSupporterOrder.itemName, activeSupporterOrder.itemId], '-') : 'ยังไม่มี' },
          { label: 'คำสั่งซื้อล่าสุด', value: latestDonationOrder ? firstNonEmpty([latestDonationOrder.purchaseCode, latestDonationOrder.code], '-') : 'ยังไม่มีคำสั่งซื้อผู้สนับสนุน' },
          { label: 'สถานะล่าสุด', value: latestDonationOrder ? localizePlayerStatus(orderStatusLabel(latestDonationOrder.statusText || latestDonationOrder.status)) : 'รอการซื้อครั้งแรก' },
          { label: 'การเชื่อม Steam', value: facts.steamLink.linked ? firstNonEmpty([facts.steamLink.inGameName, facts.steamLink.steamId], 'เชื่อมแล้ว') : 'ยังต้องเชื่อมจากหน้าโปรไฟล์' },
          { label: 'ยอดในกระเป๋าเงิน', value: formatAmount(facts.wallet.balance, '0') },
        ], 'ยังไม่มีสรุปสถานะผู้สนับสนุน'),
        `<div class="plv4-feed-list">${renderFeed((facts.supportAlerts.length ? facts.supportAlerts : facts.communityFeed).slice(0, 3), 'ตอนนี้ยังไม่มีการแจ้งเตือนสำหรับผู้สนับสนุน')}</div>`,
        '</article>',
        '</section>',
        '<section class="plv4-content-grid plv4-content-grid-two">',
        '<article class="plv4-panel" data-player-supporter-readiness><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ขั้นถัดไป</span><h2 class="plv4-section-title">เช็กลิสต์ความพร้อมของผู้สนับสนุน</h2><p class="plv4-section-copy">ระบบจะดันสิ่งที่ยังติดอยู่ขึ้นมาให้เห็นทันที เพื่อให้ผู้เล่นเดิน flow ผู้สนับสนุนได้เองโดยไม่ต้องรอทีมงานบอกทุกครั้ง</p></div></div>',
        `<div class="plv4-task-grid">${renderTaskGroups(readinessItems)}</div>`,
        '</article>',
        '<article class="plv4-panel" data-player-supporter-history><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ประวัติการสนับสนุน</span><h2 class="plv4-section-title">การซื้อผู้สนับสนุนล่าสุด</h2><p class="plv4-section-copy">ติดตามคำสั่งซื้อและสถานะการส่งของตรงนี้ ก่อนค่อยเปิดหน้าคำสั่งซื้อทั้งหมดถ้าจำเป็น</p></div></div>',
        buildSupporterOrderTable(donationOrders.slice(0, 8)),
        `<div class="plv4-action-row">${[
          renderPlayerActionControl({ label: 'เปิดร้านค้าทั้งหมด', href: buildCanonicalPlayerPath('shop') }, 'เปิดร้านค้าทั้งหมด', buildCanonicalPlayerPath('shop')),
          renderPlayerActionControl({
            label: 'ไปชำระเงิน',
            primary: true,
            data: { 'data-player-cart-checkout': true },
            disabled: !sectionEnabledFromFacts(facts, 'shop') || !Array.isArray(facts.cart?.rows) || facts.cart.rows.length === 0,
            reason: !Array.isArray(facts.cart?.rows) || facts.cart.rows.length === 0 ? 'เพิ่มแพ็กเกจผู้สนับสนุนลงตะกร้าก่อน แล้วค่อยไปชำระเงิน' : '',
          }, 'ไปชำระเงิน', null, { primary: true }),
        ].join('')}</div>`,
        '</article>',
        '</section>',
      ].join(''),
    };
  }

  function createPageContent(pageKey, facts) {
    switch (pageKey) {
      case 'home':
        return buildHomePageContent(facts);
      case 'stats':
        return buildStatsPageContent(facts);
      case 'leaderboard':
        return buildLeaderboardPageContent(facts);
      case 'shop':
        return buildShopPageContent(facts);
      case 'orders':
        return buildOrdersPageContent(facts);
      case 'delivery':
        return buildDeliveryPageContent(facts);
      case 'events':
        return buildEventsPageContent(facts);
      case 'donations':
        return buildDonationsPageContentReady(facts);
      case 'profile':
        return buildProfilePageContentReady(facts);
      case 'support':
        return buildSupportPageContent(facts);
      default:
        return {
          header: {
            title: 'พอร์ทัลผู้เล่น',
            subtitle: 'เปิดหน้าที่ต้องการจากเมนูด้านซ้าย',
            statusChips: [{ label: 'ผู้เล่น', tone: 'info' }],
            primaryAction: { label: 'เปิดหน้าหลัก', href: buildCanonicalPlayerPath('home') },
            secondaryActions: [],
          },
          summaryStrip: [],
          railCards: buildRailCommon(facts),
          mainHtml: '<section class="plv4-panel"><div class="plv4-empty-state">เลือกหน้าผู้เล่นจากเมนูนำทาง</div></section>',
        };
    }
  }

  function createPlayerControlV4Model(source, requestedPage) {
    const pageKey = resolvePlayerPageKey(requestedPage);
    const state = source && typeof source === 'object' ? source : {};
    return {
      pageKey,
      pageTitle: PAGE_META[pageKey]?.docLabel || 'ผู้เล่น',
      shell: buildShell(state, pageKey),
      notice: buildNotice(state, pageKey),
      ...createPageContent(pageKey, createPlayerFacts(state)),
    };
  }

  function buildPlayerControlV4Html(model) {
    const safe = model || createPlayerControlV4Model({}, 'home');
    return [
      '<div class="plv4-app">',
      '<header class="plv4-topbar">',
      '<div class="plv4-brand-row">',
      `<span class="plv4-brand-mark">${escapeHtml(safe.shell.brand || 'SCUM')}</span>`,
      '<div class="plv4-brand-copy">',
      `<span class="plv4-surface-label">${escapeHtml(safe.shell.surfaceLabel || '')}</span>`,
      `<strong class="plv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel || '')}</strong>`,
      '</div></div>',
      `<div class="plv4-topbar-actions">${renderBadges([{ label: safe.shell.environmentLabel || 'ชุมชนผู้เล่น', tone: 'info' }])}</div>`,
      '</header>',
      '<div class="plv4-shell">',
      '<aside class="plv4-sidebar">',
      '<div class="plv4-stack">',
      '<span class="plv4-surface-label">ผู้เล่น</span>',
      '<strong class="plv4-sidebar-title">เมนูพอร์ทัล</strong>',
      '<p class="plv4-sidebar-copy">หน้าเรียบง่ายสำหรับหน้าหลัก การเล่น ร้านค้า โปรไฟล์ และการช่วยเหลือ</p>',
      '</div>',
      renderNavGroups(safe.shell.navGroups),
      '</aside>',
      '<main class="plv4-main plv4-stack">',
      '<section class="plv4-pagehead">',
      '<div class="plv4-stack">',
      '<span class="plv4-section-kicker">พื้นที่ผู้เล่น</span>',
      `<h1 class="plv4-page-title">${escapeHtml(safe.header.title || '')}</h1>`,
      `<p class="plv4-page-subtitle">${escapeHtml(safe.header.subtitle || '')}</p>`,
      `<div class="plv4-badge-row">${renderBadges(safe.header.statusChips)}</div>`,
      '</div>',
      '<div class="plv4-pagehead-actions"><div class="plv4-stack">',
      safe.header.primaryAction
        ? `<a class="plv4-button plv4-button-primary" href="${escapeHtml(safe.header.primaryAction.href || '#')}">${escapeHtml(safe.header.primaryAction.label || 'เปิด')}</a>`
        : '',
      Array.isArray(safe.header.secondaryActions) && safe.header.secondaryActions.length
        ? `<div class="plv4-action-row">${safe.header.secondaryActions.map((action) => `<a class="plv4-button" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || 'เปิด')}</a>`).join('')}</div>`
        : '',
      '</div></div>',
      '</section>',
      safe.notice
        ? `<section class="plv4-panel plv4-tone-${escapeHtml(safe.notice.tone || 'warning')}"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">สิทธิ์การใช้งาน</span><h2 class="plv4-section-title">${escapeHtml(safe.notice.title || '')}</h2><p class="plv4-section-copy">${escapeHtml(safe.notice.detail || '')}</p></div></div></section>`
        : '',
      Array.isArray(safe.summaryStrip) && safe.summaryStrip.length
        ? `<section class="plv4-summary-strip">${renderSummaryStrip(safe.summaryStrip)}</section>`
        : '',
      safe.mainHtml || '',
      '</main>',
      '<aside class="plv4-rail"><div class="plv4-rail-sticky plv4-rail-list">',
      renderRailCards(safe.railCards),
      '</div></aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderPlayerControlV4(target, source, options) {
    if (!target) return null;
    const model = createPlayerControlV4Model(source, options?.page || 'home');
    target.innerHTML = buildPlayerControlV4Html(model);
    return model;
  }

  return {
    LEGACY_PAGE_ALIASES,
    PAGE_META,
    PLAYER_PAGE_KEYS,
    buildCanonicalPlayerPath,
    createPlayerControlV4Model,
    createPlayerPortalNavGroups,
    buildPlayerControlV4Html,
    isPageEnabled,
    renderPlayerControlV4,
    resolvePlayerPageKey,
  };
});
