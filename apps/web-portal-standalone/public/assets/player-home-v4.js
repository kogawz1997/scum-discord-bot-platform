(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./player-v4-shared.js'));
    return;
  }
  root.PlayerHomeV4 = factory(root.PlayerV4Shared);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (shared) {
  'use strict';

  if (!shared) {
    throw new Error('PlayerHomeV4 requires PlayerV4Shared');
  }

  const {
    createPlayerNavGroups,
    escapeHtml,
    firstNonEmpty,
    formatAmount,
    formatDateTime,
    formatNumber,
    formatRelative,
    listCount,
    orderStatusLabel,
    renderBadges,
    renderFeed,
    renderKeyValueList,
    renderNavGroups,
    renderRailCards,
    renderSummaryStrip,
    renderTaskGroups,
    toneForStatus,
  } = shared;

  function buildLatestOrder(source) {
    const row = source?.dashboard?.latestOrder || (Array.isArray(source?.orders) ? source.orders[0] : null) || null;
    if (!row) return null;
    return {
      code: firstNonEmpty([row.purchaseCode, row.code], '-'),
      itemName: firstNonEmpty([row.itemName, row.itemId, row.productName], 'ยังไม่มีคำสั่งซื้อล่าสุด'),
      status: orderStatusLabel(row.statusText || row.status),
      statusTone: toneForStatus(row.status || row.statusText),
      createdAt: formatDateTime(row.createdAt || row.updatedAt),
    };
  }

  function buildFeed(source) {
    const notifications = Array.isArray(source?.notifications) ? source.notifications : [];
    const dashboardAnnouncements = Array.isArray(source?.dashboard?.announcements) ? source.dashboard.announcements : [];
    const raidTimes = Array.isArray(source?.serverInfo?.raidTimes) ? source.serverInfo.raidTimes : [];
    const announcementRows = dashboardAnnouncements
      .concat(raidTimes)
      .filter(Boolean)
      .slice(0, 3)
      .map((text, index) => ({
        category: 'ชุมชน',
        tone: 'info',
        title: index === 0 ? 'ประกาศที่ควรรู้ตอนนี้' : 'ช่วงเวลาและกิจกรรม',
        detail: String(text || '').trim(),
        meta: 'ประกาศจากเซิร์ฟเวอร์',
        action: { label: 'ไปหน้ากิจกรรม', href: '#events' },
      }));
    const notificationRows = notifications.slice(0, 6).map((item) => ({
      category: item.type || 'บัญชี',
      tone: toneForStatus(item.severity || item.type),
      title: firstNonEmpty([item.title, item.message], 'อัปเดตสำหรับผู้เล่น'),
      detail: firstNonEmpty([item.detail, item.message], 'มีอัปเดตใหม่ในบัญชีของคุณ'),
      meta: formatRelative(item.createdAt || item.at),
      action: /purchase|delivery|order/i.test(`${item.type || ''} ${item.title || ''} ${item.detail || ''}`)
        ? { label: 'ดูคำสั่งซื้อ', href: '#orders' }
        : { label: 'ดูบัญชี', href: '#profile' },
    }));
    return notificationRows.concat(announcementRows).slice(0, 8);
  }

  function buildCommunityFacts(source) {
    const serverInfo = source?.serverInfo?.serverInfo || {};
    const status = source?.serverInfo?.status || {};
    const missions = source?.dashboard?.missionsSummary || {};
    return [
      { label: 'เซิร์ฟเวอร์', value: firstNonEmpty([serverInfo.name], 'SCUM Community Server') },
      { label: 'ผู้เล่นออนไลน์', value: formatNumber(status.onlinePlayers, '0') },
      { label: 'ช่องสูงสุด', value: formatNumber(serverInfo.maxPlayers, '0') },
      { label: 'รางวัลรายวัน', value: missions.dailyClaimable ? 'พร้อมรับ' : 'รอคูลดาวน์' },
      { label: 'รางวัลรายสัปดาห์', value: missions.weeklyClaimable ? 'พร้อมรับ' : 'รอคูลดาวน์' },
      { label: 'ซิงก์ล่าสุด', value: source?.lastRefreshedAt ? formatDateTime(source.lastRefreshedAt) : 'ยังไม่ระบุ' },
    ];
  }

  function createPlayerHomeV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const me = state.me || {};
    const profile = state.profile || {};
    const wallet = state.walletLedger?.wallet || state.dashboard?.wallet || {};
    const steamLink = state.steamLink || {};
    const latestOrder = buildLatestOrder(state);
    const missions = state.dashboard?.missionsSummary || {};
    const feedRows = buildFeed(state);
    const displayName = firstNonEmpty([profile.displayName, profile.username, me.user], 'Player');
    const accountStatus = firstNonEmpty([profile.accountStatus, me.accountStatus], 'active');
    const pendingOrders = (Array.isArray(state.orders) ? state.orders : []).filter((row) => {
      const status = String(row?.status || '').trim().toLowerCase();
      return status === 'pending' || status === 'queued' || status === 'delivering';
    }).length;
    const missionsList = Array.isArray(state.missions?.missions) ? state.missions.missions : [];
    const bountyList = Array.isArray(state.bounties?.items)
      ? state.bounties.items
      : (Array.isArray(state.bounties) ? state.bounties : []);
    const leaderboardItems = Array.isArray(state.leaderboard?.items) ? state.leaderboard.items : [];
    const primaryAction = pendingOrders > 0
      ? { label: 'ดูออเดอร์ที่กำลังรอ (แนะนำ)', href: '#orders' }
      : missions.dailyClaimable || missions.weeklyClaimable || missionsList.length > 0 || bountyList.length > 0 || feedRows.length > 0
        ? { label: 'เปิดหน้ากิจกรรม (แนะนำ)', href: '#events' }
        : leaderboardItems.length > 0
          ? { label: 'ดูสถิติและอันดับ (แนะนำ)', href: '#stats' }
          : { label: latestOrder ? 'ดูคำสั่งซื้อล่าสุด' : 'เปิดร้านค้า', href: latestOrder ? '#orders' : '#shop' };

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'พอร์ทัลผู้เล่น',
        workspaceLabel: displayName,
        environmentLabel: 'ชุมชนผู้เล่น',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : createPlayerNavGroups('home'),
      },
      notice: state?.__surfaceNotice || null,
      header: {
        title: 'ภาพรวมผู้เล่น',
        subtitle: 'ดูความพร้อมของบัญชี กระเป๋าเงิน คำสั่งซื้อ และประกาศของชุมชนจากหน้าหลักเดียว',
        statusChips: [
          { label: steamLink.linked ? 'ผูก Steam แล้ว' : 'ยังไม่ผูก Steam', tone: steamLink.linked ? 'success' : 'warning' },
          { label: pendingOrders > 0 ? `${formatNumber(pendingOrders)} รายการกำลังรอ` : 'ไม่มีออเดอร์ค้าง', tone: pendingOrders > 0 ? 'warning' : 'success' },
          { label: `บัญชี ${firstNonEmpty([accountStatus], 'active')}`, tone: toneForStatus(accountStatus) },
          { label: state.lastRefreshedAt ? `อัปเดต ${formatRelative(state.lastRefreshedAt)}` : 'ยังไม่ซิงก์ล่าสุด', tone: 'info' },
        ],
        primaryAction,
      },
      summaryStrip: [
        { label: 'ยอดคงเหลือ', value: formatAmount(wallet.balance, '0'), detail: 'กระเป๋าเงินที่ใช้ซื้อของและรับรางวัลในพอร์ทัล', tone: 'success' },
        {
          label: 'คำสั่งซื้อล่าสุด',
          value: latestOrder ? latestOrder.status : 'ยังไม่มี',
          detail: latestOrder ? `${latestOrder.itemName} · ${latestOrder.createdAt}` : 'เมื่อซื้อของแล้วจะเห็นสถานะล่าสุดตรงนี้',
          tone: latestOrder ? latestOrder.statusTone : 'muted',
        },
        {
          label: 'ความพร้อมของบัญชี',
          value: steamLink.linked ? 'พร้อมรับของ' : 'ต้องผูก Steam',
          detail: steamLink.linked
            ? firstNonEmpty([steamLink.inGameName, steamLink.steamId], 'มีบัญชีเกมพร้อมแล้ว')
            : 'ผูก Steam ก่อนซื้อไอเทมที่ต้องส่งเข้าเกม',
          tone: steamLink.linked ? 'success' : 'warning',
        },
        {
          label: 'รางวัลประจำวัน',
          value: missions.dailyClaimable ? 'พร้อมรับ' : 'คูลดาวน์',
          detail: missions.dailyClaimable ? 'รับรางวัลรายวันได้ทันที' : 'ตรวจหน้ากระเป๋าเงินเพื่อดูเวลาที่เหลือ',
          tone: missions.dailyClaimable ? 'success' : 'info',
        },
        {
          label: 'ประกาศและชุมชน',
          value: formatNumber(feedRows.length, '0'),
          detail: 'มีอัปเดตบัญชี คำสั่งซื้อ และประกาศของเซิร์ฟเวอร์ในที่เดียว',
          tone: feedRows.length > 0 ? 'info' : 'muted',
        },
      ],
      taskGroups: [
        {
          tone: 'success',
          tag: 'เริ่มซื้อและเติมเงิน',
          title: 'ซื้อของและเติมยอดให้พร้อม',
          detail: 'เริ่มจากดูกระเป๋าเงินก่อน แล้วค่อยเปิดร้านค้าเมื่อพร้อมซื้อไอเทมหรือสนับสนุนเซิร์ฟเวอร์',
          actions: [
            { label: 'เปิดกระเป๋าเงิน', href: '#wallet', primary: true },
            { label: 'เปิดร้านค้า', href: '#shop' },
          ],
        },
        {
          tone: latestOrder ? latestOrder.statusTone : 'info',
          tag: 'ติดตามคำสั่งซื้อ',
          title: 'ดูว่าออเดอร์ของคุณไปถึงไหนแล้ว',
          detail: latestOrder
            ? `ตอนนี้ ${latestOrder.itemName} อยู่ในสถานะ ${latestOrder.status} ให้เปิดดู timeline ก่อนติดต่อทีมงาน`
            : 'เมื่อสั่งซื้อแล้วให้กลับมาที่หน้าคำสั่งซื้อเพื่อติดตามผลและดูสิ่งที่ต้องทำต่อ',
          actions: [
            { label: latestOrder ? 'ดูคำสั่งซื้อล่าสุด' : 'ดูคำสั่งซื้อทั้งหมด', href: '#orders', primary: true },
            { label: 'ดูการส่งของ', href: '#delivery' },
          ],
        },
        {
          tone: missions.dailyClaimable || missions.weeklyClaimable || leaderboardItems.length > 0 ? 'info' : (steamLink.linked ? 'success' : 'warning'),
          tag: 'ชุมชนและกิจกรรม',
          title: 'ดูสถิติ อันดับ และกิจกรรมที่กำลังเปิด',
          detail: missions.dailyClaimable || missions.weeklyClaimable
            ? 'มีรางวัลหรือกิจกรรมที่พร้อมให้กดรับอยู่ตอนนี้ ให้เริ่มจากหน้ากิจกรรมก่อนแล้วค่อยกลับมาดูโปรไฟล์'
            : leaderboardItems.length > 0
              ? 'ถ้าอยากดูอันดับหรือเช็กผลงานล่าสุด ให้เริ่มจากหน้าสถิติและกิจกรรมของชุมชนก่อน'
              : steamLink.linked
                ? 'บัญชีเกมพร้อมแล้ว คุณจึงไปต่อที่หน้าสถิติ กิจกรรม หรือโปรไฟล์ได้เลย'
                : 'ผูก Steam ก่อน แล้วค่อยไปต่อที่หน้าสถิติและกิจกรรม เพื่อหลีกเลี่ยงปัญหาบัญชีไม่ตรงกัน',
          actions: [
            { label: 'เปิดหน้าสถิติ', href: '#stats', primary: true },
            { label: 'ดูกิจกรรม', href: '#events' },
          ],
        },
      ],
      communityFacts: buildCommunityFacts(state),
      feedRows,
      railCards: [
        {
          label: 'ความพร้อมของบัญชี',
          title: steamLink.linked ? 'บัญชีพร้อมรับของแล้ว' : 'ยังต้องผูก Steam',
          body: steamLink.linked ? 'บัญชีนี้มี Steam link และพร้อมใช้กับไอเทมที่ส่งเข้าเกมแล้ว' : 'ถ้าจะซื้อไอเทมในเกม ให้เริ่มจากผูก Steam และตรวจชื่อในเกมก่อน',
          meta: steamLink.linked ? firstNonEmpty([steamLink.inGameName, steamLink.steamId], 'มี Steam link แล้ว') : 'ไปที่หน้าโปรไฟล์เพื่อผูกบัญชี',
          tone: steamLink.linked ? 'success' : 'warning',
        },
        {
          label: 'สรุปเซิร์ฟเวอร์',
          title: firstNonEmpty([state?.serverInfo?.serverInfo?.name], 'SCUM Community Server'),
          body: firstNonEmpty([state?.serverInfo?.serverInfo?.description], 'พื้นที่ชุมชนที่ใช้เล่น ซื้อของ รับรางวัล และติดตามกิจกรรม'),
          meta: `${formatNumber(state?.serverInfo?.status?.onlinePlayers, '0')} คนออนไลน์ · ${formatNumber(state?.serverInfo?.serverInfo?.maxPlayers, '0')} ช่อง`,
          tone: 'info',
        },
        {
          label: 'ต้องการความช่วยเหลือ',
          title: latestOrder && latestOrder.statusTone === 'danger' ? 'มีออเดอร์ที่ควรเปิดเคส' : 'รู้ก่อนว่าควรเตรียมอะไร',
          body: latestOrder && latestOrder.statusTone === 'danger'
            ? 'เริ่มจากเตรียม purchase code, SteamID และเวลาเกิดปัญหาก่อนติดต่อแอดมิน'
            : 'ถ้ามีปัญหาเรื่องการซื้อหรือการส่งของ ให้ไปหน้า Support เพื่อดู checklist ก่อนติดต่อทีมงาน',
          meta: latestOrder ? latestOrder.code : 'ใช้หน้า Support เป็นจุดเริ่มต้นเมื่อมีปัญหา',
          tone: latestOrder && latestOrder.statusTone === 'danger' ? 'danger' : 'muted',
        },
      ],
    };
  }

  function buildPlayerHomeV4Html(model) {
    return [
      '<div class="plv4-app">',
      '<header class="plv4-topbar">',
      '<div class="plv4-brand-row">',
      `<span class="plv4-brand-mark">${escapeHtml(model.shell.brand || 'SCUM')}</span>`,
      '<div class="plv4-brand-copy">',
      `<span class="plv4-surface-label">${escapeHtml(model.shell.surfaceLabel || '')}</span>`,
      `<strong class="plv4-workspace-label">${escapeHtml(model.shell.workspaceLabel || '')}</strong>`,
      '</div>',
      '</div>',
      `<div class="plv4-topbar-actions">${renderBadges([{ label: model.shell.environmentLabel || 'ชุมชนผู้เล่น', tone: 'info' }])}</div>`,
      '</header>',
      '<div class="plv4-shell">',
      '<aside class="plv4-sidebar">',
      '<div class="plv4-stack">',
      '<span class="plv4-surface-label">ผู้เล่น</span>',
      '<strong class="plv4-sidebar-title">เมนูหลัก</strong>',
      '<p class="plv4-sidebar-copy">เริ่มจากงานที่ใช้บ่อยก่อน แล้วค่อยลึกลงไปที่คำสั่งซื้อ กิจกรรม หรือการช่วยเหลือเมื่อจำเป็น</p>',
      '</div>',
      renderNavGroups(model.shell.navGroups),
      '</aside>',
      '<main class="plv4-main plv4-stack">',
      '<section class="plv4-pagehead">',
      '<div class="plv4-stack">',
      '<span class="plv4-section-kicker">ศูนย์ผู้เล่น</span>',
      `<h1 class="plv4-page-title">${escapeHtml(model.header.title || '')}</h1>`,
      `<p class="plv4-page-subtitle">${escapeHtml(model.header.subtitle || '')}</p>`,
      `<div class="plv4-badge-row">${renderBadges(model.header.statusChips)}</div>`,
      '</div>',
      '<div class="plv4-pagehead-actions">',
      `<a class="plv4-button plv4-button-primary" href="${escapeHtml(model.header.primaryAction.href || '#')}">${escapeHtml(model.header.primaryAction.label || '')}</a>`,
      '</div>',
      '</section>',
      model.notice
        ? `<section class="plv4-panel plv4-tone-${escapeHtml(model.notice.tone || 'warning')}"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">Access</span><h2 class="plv4-section-title">${escapeHtml(model.notice.title || '')}</h2><p class="plv4-section-copy">${escapeHtml(model.notice.detail || '')}</p></div></div></section>`
        : '',
      `<section class="plv4-summary-strip">${renderSummaryStrip(model.summaryStrip)}</section>`,
      '<section class="plv4-content-grid plv4-content-grid-two">',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">เริ่มจากตรงนี้</span><h2 class="plv4-section-title">งานที่ผู้เล่นใช้บ่อยที่สุด</h2><p class="plv4-section-copy">รวบทางลัดที่ช่วยให้ซื้อของ เช็กออเดอร์ และเตรียมบัญชีได้ในไม่กี่คลิก</p></div></div>',
      `<div class="plv4-product-grid">${renderTaskGroups(model.taskGroups)}</div>`,
      '</article>',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ชุมชนและการแจ้งเตือน</span><h2 class="plv4-section-title">อัปเดตที่ควรรู้ตอนนี้</h2><p class="plv4-section-copy">รวมทั้งประกาศของเซิร์ฟเวอร์ สถานะคำสั่งซื้อ และสิ่งที่เกี่ยวกับบัญชีของคุณ</p></div></div>',
      `<div class="plv4-feed-list">${renderFeed(model.feedRows, 'ตอนนี้ยังไม่มีอัปเดตใหม่สำหรับผู้เล่น')}</div>`,
      '</article>',
      '</section>',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">สรุปเซิร์ฟเวอร์</span><h2 class="plv4-section-title">ภาพรวมชุมชนและรางวัล</h2><p class="plv4-section-copy">ข้อมูลที่ใช้ประกอบการตัดสินใจว่าเข้าพอร์ทัลครั้งนี้ควรไปต่อจุดไหนก่อน</p></div></div>',
      renderKeyValueList(model.communityFacts, 'ยังไม่มีข้อมูลสรุปจากเซิร์ฟเวอร์'),
      '</article>',
      '</main>',
      '<aside class="plv4-rail"><div class="plv4-rail-sticky plv4-rail-list">',
      renderRailCards(model.railCards),
      '</div></aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderPlayerHomeV4(target, source) {
    if (!target) return null;
    const model = createPlayerHomeV4Model(source);
    target.innerHTML = buildPlayerHomeV4Html(model);
    return model;
  }

  return {
    buildPlayerHomeV4Html,
    createPlayerHomeV4Model,
    renderPlayerHomeV4,
  };
});
