(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./player-v4-shared.js'));
    return;
  }
  root.PlayerStatsEventsSupportV4 = factory(root.PlayerV4Shared);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (shared) {
  'use strict';

  if (!shared) {
    throw new Error('PlayerStatsEventsSupportV4 requires PlayerV4Shared');
  }

  const {
    createPlayerNavGroups,
    escapeHtml,
    firstNonEmpty,
    formatAmount,
    formatNumber,
    formatRelative,
    renderBadges,
    renderFeed,
    renderKeyValueList,
    renderNavGroups,
    renderRailCards,
    renderSummaryStrip,
    renderTable,
    toneForStatus,
  } = shared;

  function renderCommunityActionCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="plv4-task-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="plv4-section-kicker">${escapeHtml(item.label || '')}</span>`,
      `<strong>${escapeHtml(item.title || '')}</strong>`,
      `<p class="plv4-inline-copy">${escapeHtml(item.body || '')}</p>`,
      `<div class="plv4-action-row"><a class="${item.primary ? 'plv4-button plv4-button-primary' : 'plv4-button'}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.actionLabel || 'เปิดดูต่อ')}</a></div>`,
      '</article>',
    ].join('')).join('');
  }

  function createPlayerStatsEventsSupportV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const stats = state.stats || {};
    const leaderboard = state.leaderboard || {};
    const missions = Array.isArray(state.missions?.missions) ? state.missions.missions : [];
    const bounties = Array.isArray(state.bounties?.items) ? state.bounties.items : (Array.isArray(state.bounties) ? state.bounties : []);
    const party = state.party || {};
    const notifications = Array.isArray(state.notifications) ? state.notifications : [];
    const serverInfo = state.serverInfo?.serverInfo || {};
    const wheel = state.wheelState || {};
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const steamLink = state.steamLink || {};
    const supportAlerts = notifications.filter((item) => ['warning', 'error'].includes(String(item?.severity || '').toLowerCase()));
    const claimableMissionCount = missions.filter((row) => row.claimable).length;
    const eventHighlights = missions.slice(0, 3).map((item) => ({
      category: item.category || 'mission',
      tone: item.claimable ? 'success' : 'info',
      title: firstNonEmpty([item.title], 'กิจกรรม'),
      detail: item.claimable ? 'พร้อมรับหรือเริ่มทำได้ทันที' : firstNonEmpty([item.remainingText], 'ดูรายละเอียดเพิ่มเติมจากหน้ากิจกรรม'),
      meta: item.claimable ? 'พร้อมตอนนี้' : 'กำลังนับถอยหลัง',
      action: { label: 'ไปหน้ากิจกรรม', href: '#events' },
    }));
    const communityFeed = notifications.slice(0, 4).map((item) => ({
      category: item.type || 'ชุมชน',
      tone: toneForStatus(item.severity || item.type),
      title: firstNonEmpty([item.title, item.message], 'อัปเดตของชุมชน'),
      detail: firstNonEmpty([item.detail, item.message], 'มีสัญญาณใหม่ที่ผู้เล่นควรรู้'),
      meta: formatRelative(item.createdAt || item.at),
      action: { label: 'ดูรายละเอียด', href: '#activity' },
    })).concat(eventHighlights);

    const myRank = (Array.isArray(leaderboard.items) ? leaderboard.items : []).find((row) => Boolean(row?.isSelf))
      || (Array.isArray(leaderboard.items) ? leaderboard.items[0] : null)
      || null;
    const primaryAction = claimableMissionCount > 0 || bounties.length > 0
      ? { label: 'เปิดกิจกรรมที่รับได้ (แนะนำ)', href: '#events' }
      : supportAlerts.length > 0
        ? { label: 'ดูสิ่งที่ต้องจัดการก่อน (แนะนำ)', href: '#activity' }
        : myRank
          ? { label: 'ดูอันดับของคุณ (แนะนำ)', href: '#stats' }
          : { label: 'เปิดกิจกรรม', href: '#events' };
    const communityActionCards = [
      {
        label: 'กิจกรรม',
        title: claimableMissionCount > 0 ? 'มีภารกิจที่รับได้ตอนนี้' : bounties.length > 0 ? 'มี Bounty ที่ยังเปิดอยู่' : 'ยังไม่มีกิจกรรมที่ต้องรีบรับ',
        body: claimableMissionCount > 0
          ? `ตอนนี้มี ${formatNumber(claimableMissionCount, '0')} ภารกิจที่พร้อมรับหรือเริ่มทำได้ทันที`
          : bounties.length > 0
            ? `มี Bounty เปิดอยู่ ${formatNumber(bounties.length, '0')} รายการ ลองเปิดดูรางวัลหรือเงื่อนไขก่อน`
            : 'กลับมาใช้หน้านี้เพื่อตรวจว่ามีกิจกรรมใหม่เปิดเมื่อไร โดยไม่ต้องไล่ดูหลายหน้า',
        actionLabel: primaryAction.href === '#events' ? primaryAction.label : 'เปิดหน้ากิจกรรม',
        href: '#events',
        tone: claimableMissionCount > 0 || bounties.length > 0 ? 'warning' : 'muted',
        primary: primaryAction.href === '#events',
      },
      {
        label: 'อันดับ',
        title: myRank ? `ตอนนี้คุณอยู่ลำดับ ${formatNumber(myRank.rank, '-')}` : 'ยังไม่มีอันดับของคุณในตาราง',
        body: myRank
          ? 'ใช้ตารางอันดับดูว่าควรไล่คะแนนต่อหรือพอใจตำแหน่งตอนนี้แล้ว'
          : 'เมื่อมีข้อมูลซิงก์เพิ่ม ระบบจะแสดงอันดับของคุณในพื้นที่นี้ทันที',
        actionLabel: 'เปิดตารางอันดับ',
        href: '#stats',
        tone: myRank ? 'success' : 'info',
        primary: primaryAction.href === '#stats',
      },
      {
        label: 'การช่วยเหลือ',
        title: supportAlerts.length > 0 ? 'มีสิ่งที่ควรเปิดดูทันที' : 'ตอนนี้ยังไม่พบสัญญาณเตือนแรง',
        body: supportAlerts.length > 0
          ? 'เริ่มจาก notification หรือออเดอร์ที่เป็น warning/error ก่อน เพื่อลดปัญหาค้างสะสม'
          : 'ถ้ามีปัญหาเรื่องของไม่เข้า กิจกรรมไม่ขึ้น หรือบัญชียังไม่พร้อม ให้เริ่มจาก checklist ใน rail ด้านขวา',
        actionLabel: supportAlerts.length > 0 ? 'เปิดฟีดล่าสุด' : 'ดูคำแนะนำช่วยเหลือ',
        href: '#activity',
        tone: supportAlerts.length > 0 ? 'danger' : 'muted',
        primary: primaryAction.href === '#activity',
      },
    ];

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'พอร์ทัลผู้เล่น',
        workspaceLabel: firstNonEmpty([state?.me?.user], 'Community Workspace'),
        environmentLabel: 'ชุมชนผู้เล่น',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : createPlayerNavGroups('stats'),
      },
      notice: state?.__surfaceNotice || null,
      header: {
        title: 'สถิติ กิจกรรม และการช่วยเหลือ',
        subtitle: 'กลับมาเช็กอันดับ ความคืบหน้า และสิ่งที่กำลังเกิดขึ้นในชุมชนได้จากหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(stats.kills, '0')} สังหาร`, tone: 'info' },
          { label: `KD ${Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00'}`, tone: 'success' },
          { label: `${formatNumber(missions.length, '0')} ภารกิจ`, tone: missions.length > 0 ? 'info' : 'muted' },
          { label: steamLink.linked ? 'บัญชีพร้อมรับของ' : 'ควรผูก Steam', tone: steamLink.linked ? 'success' : 'warning' },
        ],
        primaryAction,
      },
      summaryStrip: [
        { label: 'สังหาร', value: formatNumber(stats.kills, '0'), detail: 'สถิติการกำจัดทั้งหมดของบัญชีนี้', tone: 'info' },
        { label: 'อัตรา K/D', value: Number.isFinite(Number(stats.kd)) ? Number(stats.kd).toFixed(2) : '0.00', detail: 'ใช้อ่านภาพรวมผลงาน ไม่ใช่ดูแค่ kills อย่างเดียว', tone: 'success' },
        { label: 'เวลาเล่น', value: `${formatNumber(Math.floor(Number(stats.playtimeMinutes || 0) / 60), '0')} ชม.`, detail: 'ชั่วโมงเล่นโดยประมาณจากข้อมูลที่ซิงก์เข้าระบบ', tone: 'info' },
        { label: 'ปาร์ตี้', value: formatNumber(party.memberCount, '0'), detail: firstNonEmpty([party.title], 'ยังไม่อยู่ในปาร์ตี้'), tone: party.memberCount > 0 ? 'success' : 'muted' },
        { label: 'โอกาสพิเศษ', value: formatNumber(missions.filter((row) => row.claimable).length + bounties.length, '0'), detail: 'รวมภารกิจพร้อมรับและ bounty ที่ยังเปิดอยู่', tone: missions.some((row) => row.claimable) || bounties.length > 0 ? 'warning' : 'muted' },
      ],
      personalFacts: [
        { label: 'เสียชีวิต', value: formatNumber(stats.deaths, '0') },
        { label: 'เวลาเล่น (นาที)', value: formatNumber(stats.playtimeMinutes, '0') },
        { label: 'ปาร์ตี้ปัจจุบัน', value: firstNonEmpty([party.title], 'ยังไม่อยู่ในปาร์ตี้') },
        { label: 'สมาชิกในปาร์ตี้', value: formatNumber(party.memberCount, '0') },
        { label: 'วงล้อสุ่มรางวัล', value: wheel.enabled ? 'เปิดอยู่' : 'ปิดอยู่' },
        { label: 'Bounty ที่เปิดอยู่', value: formatNumber(bounties.length, '0') },
      ],
      communityActionCards,
      leaderboardRows: (Array.isArray(leaderboard.items) ? leaderboard.items : []).slice(0, 8).map((row) => ({
        rank: formatNumber(row.rank, '-'),
        name: firstNonEmpty([row.name, row.userId], '-'),
        primary: leaderboard.type === 'economy' ? formatAmount(row.balance, '0') : formatNumber(row.kills, '0'),
        secondary: leaderboard.type === 'playtime' ? `${formatNumber(row.playtimeHours, '0')} ชม.` : `KD ${Number.isFinite(Number(row.kd)) ? Number(row.kd).toFixed(2) : '0.00'}`,
        mine: Boolean(row.isSelf),
      })),
      communityFeed,
      eventFacts: [
        { label: 'ภารกิจทั้งหมด', value: formatNumber(missions.length, '0') },
        { label: 'ภารกิจพร้อมรับ', value: formatNumber(missions.filter((row) => row.claimable).length, '0') },
        { label: 'วงล้อสุ่มรางวัล', value: wheel.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน' },
        { label: 'Bounty ที่มองเห็น', value: formatNumber(bounties.length, '0') },
        { label: 'ประกาศเซิร์ฟเวอร์', value: firstNonEmpty([serverInfo.name], 'Community server') },
      ],
      railCards: [
        {
          label: 'อันดับของคุณ',
          title: myRank ? `ลำดับ ${formatNumber(myRank.rank, '-')}` : 'ยังไม่มีอันดับ',
          body: myRank ? `${firstNonEmpty([myRank.name], 'บัญชีนี้')} อยู่ในบอร์ด ${firstNonEmpty([leaderboard.type], 'kills')}` : 'เมื่อมีข้อมูลอันดับมากขึ้น คุณจะเห็นลำดับของตัวเองตรงนี้',
          meta: myRank ? (leaderboard.type === 'economy' ? `${formatAmount(myRank.balance, '0')} เหรียญ` : `KD ${Number.isFinite(Number(myRank.kd)) ? Number(myRank.kd).toFixed(2) : '0.00'}`) : 'กลับมาเช็กใหม่หลังมีข้อมูลซิงก์เพิ่ม',
          tone: myRank ? 'success' : 'muted',
        },
        {
          label: 'จุดที่ควรทำต่อ',
          title: supportAlerts.length > 0 ? 'มีสัญญาณที่ควรเปิดดูทันที' : 'ใช้หน้ากิจกรรมเป็นจุดกลับมาประจำ',
          body: supportAlerts.length > 0 ? 'เริ่มจาก order หรือ notification ที่เป็น warning/error ก่อน เพื่อไม่ให้ปัญหาค้างสะสม' : 'ตอนนี้พอร์ทัลพร้อมใช้เป็นจุดเช็กอันดับ ภารกิจ และประกาศของชุมชนได้ทุกวัน',
          meta: supportAlerts.length > 0 ? firstNonEmpty([supportAlerts[0].title, supportAlerts[0].message], '-') : `${formatNumber(missions.length, '0')} ภารกิจ · ${formatNumber(bounties.length, '0')} bounty`,
          tone: supportAlerts.length > 0 ? 'warning' : 'info',
        },
        {
          label: 'การช่วยเหลือ',
          title: orders.some((row) => String(row?.status || '').toLowerCase() === 'delivery_failed') ? 'เตรียมข้อมูลก่อนคุยกับแอดมิน' : 'ถ้ามีปัญหา เริ่มที่ checklist',
          body: orders.some((row) => String(row?.status || '').toLowerCase() === 'delivery_failed') ? 'เตรียม purchase code, SteamID และเวลาที่เกิดปัญหาไว้ก่อน แล้วค่อยเปิดเคส' : 'หน้า support ควรเริ่มจากดูความพร้อมของบัญชีและคำสั่งซื้อก่อน ไม่ต้องไล่เดาเองว่าเกิดจากอะไร',
          meta: steamLink.linked ? 'บัญชีมี Steam link แล้ว' : 'ยังไม่ผูก Steam',
          tone: orders.some((row) => String(row?.status || '').toLowerCase() === 'delivery_failed') ? 'danger' : 'muted',
        },
      ],
    };
  }

  function buildPlayerStatsEventsSupportV4Html(model) {
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
      '<span class="plv4-surface-label">ชุมชนและกิจกรรม</span>',
      '<strong class="plv4-sidebar-title">พื้นที่ของผู้เล่น</strong>',
      '<p class="plv4-sidebar-copy">ให้ผู้เล่นกลับมาเช็กอันดับ ภารกิจ และสถานะบัญชีได้บ่อย โดยไม่กลายเป็นหน้า social feed ที่รกเกินจำเป็น</p>',
      '</div>',
      renderNavGroups(model.shell.navGroups),
      '</aside>',
      '<main class="plv4-main plv4-stack">',
      '<section class="plv4-pagehead">',
      '<div class="plv4-stack">',
      '<span class="plv4-section-kicker">ศูนย์ชุมชนของผู้เล่น</span>',
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
      '<section class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ควรทำอะไรต่อ</span><h2 class="plv4-section-title">เริ่มจากสิ่งที่พาคุณกลับมาเล่นต่อได้ทันที</h2><p class="plv4-section-copy">กิจกรรม อันดับ และงานที่ต้องจัดการควรถูกยกขึ้นมาก่อนรายละเอียดเชิงลึก เพื่อให้ผู้เล่นรู้ว่าควรกดอะไรต่อ</p></div></div>',
      `<div class="plv4-task-grid">${renderCommunityActionCards(model.communityActionCards)}</div>`,
      '</section>',
      '<section class="plv4-content-grid plv4-content-grid-two">',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">สถิติของฉัน</span><h2 class="plv4-section-title">สรุปสถิติของฉัน</h2><p class="plv4-section-copy">อ่านง่ายและรู้ทันทีว่าภาพรวมการเล่นของบัญชีนี้เป็นอย่างไร</p></div></div>',
      renderKeyValueList(model.personalFacts, 'ยังไม่มีข้อมูลสถิติสำหรับแสดง'),
      '</article>',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">กิจกรรม</span><h2 class="plv4-section-title">กิจกรรมและโอกาสพิเศษ</h2><p class="plv4-section-copy">รวมภารกิจ วงล้อ และ bounty ที่ควรรู้ในช่วงเวลานี้</p></div></div>',
      renderKeyValueList(model.eventFacts, 'ยังไม่มีกิจกรรมให้แสดง'),
      '</article>',
      '</section>',
      '<section class="plv4-content-grid plv4-content-grid-two">',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">อันดับ</span><h2 class="plv4-section-title">อันดับผู้เล่น</h2><p class="plv4-section-copy">ดูบริบทของตัวเองเทียบกับผู้เล่นคนอื่นจากตารางเดียว</p></div></div>',
      renderTable(
        [
          { label: 'Rank', render: (row) => row.mine ? `${escapeHtml(row.rank)} ★` : escapeHtml(row.rank) },
          { label: 'ผู้เล่น', render: (row) => escapeHtml(row.name) },
          { label: 'ค่าหลัก', render: (row) => escapeHtml(row.primary) },
          { label: 'ค่าเสริม', render: (row) => escapeHtml(row.secondary) },
        ],
        model.leaderboardRows,
        'ยังไม่มีข้อมูลอันดับสำหรับแสดง'
      ),
      '</article>',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ฟีดชุมชน</span><h2 class="plv4-section-title">ฟีดของชุมชนและบัญชี</h2><p class="plv4-section-copy">รวมการแจ้งเตือนของผู้เล่นกับสัญญาณกิจกรรมสำคัญไว้ในที่เดียว</p></div></div>',
      `<div class="plv4-feed-list">${renderFeed(model.communityFeed, 'ยังไม่มีอัปเดตชุมชนสำหรับแสดง')}</div>`,
      '</article>',
      '</section>',
      '</main>',
      '<aside class="plv4-rail"><div class="plv4-rail-sticky plv4-rail-list">',
      renderRailCards(model.railCards),
      '</div></aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderPlayerStatsEventsSupportV4(target, source) {
    if (!target) return null;
    const model = createPlayerStatsEventsSupportV4Model(source);
    target.innerHTML = buildPlayerStatsEventsSupportV4Html(model);
    return model;
  }

  return {
    buildPlayerStatsEventsSupportV4Html,
    createPlayerStatsEventsSupportV4Model,
    renderPlayerStatsEventsSupportV4,
  };
});
