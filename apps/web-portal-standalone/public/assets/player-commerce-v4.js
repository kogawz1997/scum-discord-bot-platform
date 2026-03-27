(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./player-v4-shared.js'));
    return;
  }
  root.PlayerCommerceV4 = factory(root.PlayerV4Shared);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (shared) {
  'use strict';

  if (!shared) {
    throw new Error('PlayerCommerceV4 requires PlayerV4Shared');
  }

  const {
    createPlayerNavGroups,
    escapeHtml,
    firstNonEmpty,
    formatAmount,
    formatDateTime,
    formatNumber,
    listCount,
    orderStatusLabel,
    renderBadges,
    renderKeyValueList,
    renderNavGroups,
    renderProductGrid,
    renderRailCards,
    renderSummaryStrip,
    renderTable,
    toneForStatus,
  } = shared;

  function pendingOrders(orders) {
    return (Array.isArray(orders) ? orders : []).filter((row) => {
      const status = String(row?.status || '').trim().toLowerCase();
      return status === 'pending' || status === 'queued' || status === 'delivering';
    });
  }

  function renderWorkflowCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="plv4-task-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="plv4-section-kicker">${escapeHtml(item.label || '')}</span>`,
      `<strong>${escapeHtml(item.title || '')}</strong>`,
      `<p class="plv4-inline-copy">${escapeHtml(item.body || '')}</p>`,
      `<div class="plv4-action-row"><a class="${item.primary ? 'plv4-button plv4-button-primary' : 'plv4-button'}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.actionLabel || 'เปิดดูต่อ')}</a></div>`,
      '</article>',
    ].join('')).join('');
  }

  function createPlayerCommerceV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const me = state.me || {};
    const wallet = state.walletLedger?.wallet || {};
    const cart = state.cart || {};
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const steamLink = state.steamLink || {};
    const cartRows = Array.isArray(cart.rows) ? cart.rows : [];
    const actionableOrders = pendingOrders(orders);
    const riskyOrders = orders.filter((row) => String(row?.status || '').trim().toLowerCase() === 'delivery_failed');
    const walletBalance = Number(wallet.balance || 0);
    const highlightedProducts = (Array.isArray(state.shopItems) ? state.shopItems : []).slice(0, 6).map((item) => ({
      name: firstNonEmpty([item.name, item.id], 'สินค้า'),
      description: firstNonEmpty([item.description], 'ไอเทมหรือบริการที่เปิดขายอยู่ในระบบนี้'),
      price: formatAmount(item.price, '0'),
      kind: firstNonEmpty([item.kind], 'item'),
      requiresSteamLink: Boolean(item.requiresSteamLink),
      tone: item.requiresSteamLink && !steamLink.linked ? 'warning' : item.kind === 'vip' ? 'info' : 'muted',
      primaryAction: 'ดูสินค้า',
      secondaryAction: 'ดูกระเป๋าเงิน',
    }));
    const primaryAction = riskyOrders.length > 0
      ? { label: 'เปิดออเดอร์ที่ต้องตรวจ (แนะนำ)', href: '#orders' }
      : actionableOrders.length > 0
        ? { label: 'ดูออเดอร์ที่กำลังรอ (แนะนำ)', href: '#orders' }
        : !steamLink.linked
          ? { label: 'ผูก Steam ก่อนซื้อ (แนะนำ)', href: '#profile' }
          : cart.totalUnits > 0
            ? { label: 'ตรวจตะกร้าก่อนชำระ (แนะนำ)', href: '#cart' }
            : walletBalance <= 0
              ? { label: 'เติมยอดก่อนซื้อ (แนะนำ)', href: '#wallet' }
              : { label: 'เปิดร้านค้า (แนะนำ)', href: '#shop' };
    const secondaryActions = [
      { label: 'เปิดร้านค้า', href: '#shop' },
      { label: 'ดูกระเป๋าเงิน', href: '#wallet' },
    ];
    const workflowCards = [
      {
        label: 'สถานะตอนนี้',
        title: riskyOrders.length > 0 ? 'เริ่มจากออเดอร์ที่มีปัญหาก่อน' : actionableOrders.length > 0 ? 'มีออเดอร์ที่กำลังรออยู่' : 'พร้อมเริ่มซื้อของรอบถัดไป',
        body: riskyOrders.length > 0
          ? 'เปิดหน้าคำสั่งซื้อก่อนเพื่อดูสถานะล่าสุดและเตรียมข้อมูลไว้คุยกับทีมงาน'
          : actionableOrders.length > 0
            ? 'เช็กออเดอร์ที่กำลังรอหรือกำลังส่งของก่อน เพื่อไม่ให้พลาดรายการที่ยังค้างอยู่'
            : 'ถ้ายังไม่มีของค้าง ระบบพร้อมให้คุณเติมยอดหรือเริ่มซื้อสินค้ารอบใหม่ได้เลย',
        actionLabel: primaryAction.label,
        href: primaryAction.href,
        tone: riskyOrders.length > 0 ? 'danger' : actionableOrders.length > 0 ? 'warning' : 'success',
        primary: true,
      },
      {
        label: 'ความพร้อมก่อนจ่าย',
        title: steamLink.linked ? 'บัญชีพร้อมรับของในเกม' : 'ยังต้องผูก Steam ก่อนซื้อของในเกม',
        body: steamLink.linked
          ? 'ระบบจะพร้อมสร้างคำสั่งซื้อและส่งของตาม flow ปกติหลังชำระเสร็จ'
          : 'ผูก Steam ให้เรียบร้อยก่อน เพื่อไม่ให้ซื้อของแล้วต้องย้อนกลับมาแก้การเชื่อมบัญชี',
        actionLabel: steamLink.linked ? 'ไปที่ร้านค้า' : 'ไปหน้าบัญชี',
        href: steamLink.linked ? '#shop' : '#profile',
        tone: steamLink.linked ? 'success' : 'warning',
      },
      {
        label: 'กระเป๋าเงิน',
        title: walletBalance > 0 ? 'มีเครดิตพร้อมใช้งาน' : 'ควรเติมยอดก่อนเลือกสินค้า',
        body: walletBalance > 0
          ? `ตอนนี้คุณมี ${formatAmount(wallet.balance, '0')} พร้อมใช้สำหรับซื้อของและบริการ`
          : 'เริ่มจากเติมยอดก่อน แล้วค่อยกลับมาเลือกสินค้าเพื่อลดการสลับไปมาระหว่างขั้นตอน',
        actionLabel: walletBalance > 0 ? 'ดูกระเป๋าเงิน' : 'เติมยอด',
        href: '#wallet',
        tone: walletBalance > 0 ? 'info' : 'muted',
      },
    ];

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'พอร์ทัลผู้เล่น',
        workspaceLabel: firstNonEmpty([me.user], 'Commerce Workspace'),
        environmentLabel: 'ชุมชนผู้เล่น',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : createPlayerNavGroups('shop'),
      },
      notice: state?.__surfaceNotice || null,
      header: {
        title: 'ร้านค้า กระเป๋าเงิน และคำสั่งซื้อ',
        subtitle: 'ซื้อของ เติมยอด ดูออเดอร์ และติดตามการส่งของจาก workflow เดียวที่เข้าใจง่าย',
        statusChips: [
          { label: steamLink.linked ? 'พร้อมซื้อไอเทมในเกม' : 'ต้องผูก Steam ก่อนซื้อไอเทมในเกม', tone: steamLink.linked ? 'success' : 'warning' },
          { label: `${formatNumber(cart.totalUnits, '0')} ชิ้นในตะกร้า`, tone: cart.totalUnits > 0 ? 'info' : 'muted' },
          { label: `${formatNumber(actionableOrders.length, '0')} รายการกำลังรอ`, tone: actionableOrders.length > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(riskyOrders.length, '0')} รายการต้องตรวจต่อ`, tone: riskyOrders.length > 0 ? 'danger' : 'muted' },
        ],
        primaryAction,
        secondaryActions,
      },
      summaryStrip: [
        { label: 'ยอดคงเหลือ', value: formatAmount(wallet.balance, '0'), detail: 'ยอดพร้อมใช้สำหรับซื้อของและบริการ', tone: 'success' },
        { label: 'ในตะกร้า', value: formatNumber(cart.totalUnits, '0'), detail: `${formatAmount(cart.totalPrice, '0')} เหรียญในรายการปัจจุบัน`, tone: cart.totalUnits > 0 ? 'info' : 'muted' },
        { label: 'ออเดอร์กำลังรอ', value: formatNumber(actionableOrders.length, '0'), detail: 'รวม pending, queued และ delivering', tone: actionableOrders.length > 0 ? 'warning' : 'success' },
        { label: 'ต้องตรวจต่อ', value: formatNumber(riskyOrders.length, '0'), detail: 'คำสั่งซื้อที่อาจต้องใช้ทีมงานช่วยตรวจสอบ', tone: riskyOrders.length > 0 ? 'danger' : 'muted' },
        { label: 'ประวัติรีดีม', value: formatNumber(listCount(state.redeemHistory), '0'), detail: 'ติดตามโค้ดที่ใช้ไปแล้วและผลล่าสุด', tone: 'info' },
      ],
      cartFacts: [
        { label: 'จำนวนรายการในตะกร้า', value: formatNumber(cartRows.length, '0') },
        { label: 'จำนวนชิ้นรวม', value: formatNumber(cart.totalUnits, '0') },
        { label: 'มูลค่ารวม', value: formatAmount(cart.totalPrice, '0') },
        { label: 'ไอเทมหายจากแคตตาล็อก', value: formatNumber(listCount(cart.missingItemIds), '0') },
      ],
      workflowCards,
      highlightedProducts,
      ordersTable: orders.slice(0, 8).map((row) => ({
        code: firstNonEmpty([row.purchaseCode, row.code], '-'),
        itemName: firstNonEmpty([row.itemName, row.itemId], 'ไม่ทราบรายการ'),
        status: orderStatusLabel(row.statusText || row.status),
        statusTone: toneForStatus(row.status || row.statusText),
        total: formatAmount(row.totalPrice || row.price || row.amount, '0'),
        createdAt: formatDateTime(row.createdAt || row.updatedAt),
      })),
      ledgerTable: (Array.isArray(state.walletLedger?.items) ? state.walletLedger.items : []).slice(0, 6).map((row) => ({
        createdAt: formatDateTime(row.createdAt),
        delta: `${Number(row.delta || 0) > 0 ? '+' : ''}${formatAmount(row.delta, '0')}`,
        balanceAfter: formatAmount(row.balanceAfter, '0'),
        reason: firstNonEmpty([row.reasonLabel, row.reason], '-'),
        reference: firstNonEmpty([row.reference], '-'),
      })),
      railCards: [
        {
          label: 'ความพร้อมก่อนซื้อ',
          title: steamLink.linked ? 'บัญชีพร้อมชำระและรับของ' : 'ต้องผูก Steam ก่อนจ่ายไอเทมในเกม',
          body: steamLink.linked ? 'ถ้าจะซื้อไอเทมในเกม คุณสามารถไปต่อที่ตะกร้าหรือซื้อทันทีได้' : 'ระบบจะกันการซื้อไอเทมในเกมไว้ก่อนจนกว่าจะผูก Steam เพื่อลดปัญหาส่งของไม่ถึง',
          meta: steamLink.linked ? firstNonEmpty([steamLink.inGameName, steamLink.steamId], 'มี Steam link แล้ว') : 'ไปที่หน้าโปรไฟล์เพื่อผูกบัญชี',
          tone: steamLink.linked ? 'success' : 'warning',
        },
        {
          label: 'ขั้นตอนที่แนะนำ',
          title: cart.totalUnits > 0 ? 'เช็กตะกร้าแล้วค่อยชำระ' : 'เติมยอดก่อนเปิดร้านค้า',
          body: cart.totalUnits > 0 ? 'ตรวจจำนวนชิ้นและยอดรวมก่อนกด checkout แล้วค่อยไปดูคำสั่งซื้อเพื่อเช็กสถานะต่อ' : 'ถ้ายังไม่พร้อมซื้อ ให้เริ่มที่ wallet ก่อน แล้วค่อยกลับมา browse สินค้าทีละหมวด',
          meta: actionableOrders.length > 0 ? `${formatNumber(actionableOrders.length, '0')} ออเดอร์กำลังรออยู่แล้ว` : 'ไม่มีออเดอร์ค้างในตอนนี้',
          tone: actionableOrders.length > 0 ? 'info' : 'muted',
        },
        {
          label: 'เมื่อเกิดปัญหา',
          title: riskyOrders.length > 0 ? 'มีรายการที่ควรเปิดดูทันที' : 'ใช้ order code ทุกครั้งที่ติดต่อทีมงาน',
          body: riskyOrders.length > 0 ? 'เปิดหน้าคำสั่งซื้อก่อนเพื่อดูสถานะและเตรียม purchase code ให้พร้อม' : 'ถ้าการชำระหรือการส่งของผิดปกติ ให้เตรียม order code, SteamID และเวลาที่เกิดเหตุไว้ก่อน',
          meta: riskyOrders.length > 0 ? riskyOrders[0].purchaseCode || riskyOrders[0].code || '-' : 'หน้า Support จะช่วยสรุปสิ่งที่ต้องเตรียมให้',
          tone: riskyOrders.length > 0 ? 'danger' : 'info',
        },
      ],
    };
  }

  function buildPlayerCommerceV4Html(model) {
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
      '<span class="plv4-surface-label">ร้านค้าและคำสั่งซื้อ</span>',
      '<strong class="plv4-sidebar-title">เริ่มจากสิ่งที่ต้องทำตอนนี้</strong>',
      '<p class="plv4-sidebar-copy">ร้านค้า กระเป๋าเงิน คำสั่งซื้อ และการส่งของควรต่อกันเป็น workflow เดียว ไม่ใช่หลายหน้าที่ต้องเดาเอง</p>',
      '</div>',
      renderNavGroups(model.shell.navGroups),
      '</aside>',
      '<main class="plv4-main plv4-stack">',
      '<section class="plv4-pagehead">',
      '<div class="plv4-stack">',
      '<span class="plv4-section-kicker">ศูนย์ซื้อขายของผู้เล่น</span>',
      `<h1 class="plv4-page-title">${escapeHtml(model.header.title || '')}</h1>`,
      `<p class="plv4-page-subtitle">${escapeHtml(model.header.subtitle || '')}</p>`,
      `<div class="plv4-badge-row">${renderBadges(model.header.statusChips)}</div>`,
      '</div>',
      '<div class="plv4-pagehead-actions"><div class="plv4-stack">',
      `<a class="plv4-button plv4-button-primary" href="${escapeHtml(model.header.primaryAction.href || '#')}">${escapeHtml(model.header.primaryAction.label || '')}</a>`,
      Array.isArray(model.header.secondaryActions) && model.header.secondaryActions.length
        ? `<div class="plv4-action-row">${model.header.secondaryActions.map((action) => `<a class="plv4-button" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`).join('')}</div>`
        : '',
      '</div></div>',
      '</section>',
      model.notice
        ? `<section class="plv4-panel plv4-tone-${escapeHtml(model.notice.tone || 'warning')}"><div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">Access</span><h2 class="plv4-section-title">${escapeHtml(model.notice.title || '')}</h2><p class="plv4-section-copy">${escapeHtml(model.notice.detail || '')}</p></div></div></section>`
        : '',
      `<section class="plv4-summary-strip">${renderSummaryStrip(model.summaryStrip)}</section>`,
      '<section class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ควรทำอะไรต่อ</span><h2 class="plv4-section-title">ไปต่อจากสถานะตอนนี้</h2><p class="plv4-section-copy">เริ่มจากการกระทำที่ช่วยให้จบงานเร็วที่สุดก่อน แล้วค่อยเลื่อนลงไปดูรายละเอียดของร้านค้า กระเป๋าเงิน และออเดอร์</p></div></div>',
      `<div class="plv4-task-grid">${renderWorkflowCards(model.workflowCards)}</div>`,
      '</section>',
      '<section class="plv4-content-grid plv4-content-grid-two">',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ร้านค้า</span><h2 class="plv4-section-title">สินค้าแนะนำ</h2><p class="plv4-section-copy">เริ่มจากสินค้าเด่นและบริการที่ผู้เล่นเปิดใช้บ่อยที่สุดก่อน</p></div></div>',
      `<div class="plv4-product-grid">${renderProductGrid(model.highlightedProducts)}</div>`,
      '</article>',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">ตะกร้า</span><h2 class="plv4-section-title">ภาพรวมตะกร้าปัจจุบัน</h2><p class="plv4-section-copy">ตรวจยอดรวม จำนวนชิ้น และสิ่งที่ควรรู้ก่อน checkout</p></div></div>',
      renderKeyValueList(model.cartFacts, 'ยังไม่มีสินค้าในตะกร้า'),
      '</article>',
      '</section>',
      '<section class="plv4-content-grid plv4-content-grid-two">',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">คำสั่งซื้อ</span><h2 class="plv4-section-title">คำสั่งซื้อและการส่งของ</h2><p class="plv4-section-copy">เปิดดูรายการล่าสุดได้จากที่เดียวโดยไม่ต้องสลับหลายแท็บ</p></div></div>',
      renderTable(
        [
          { label: 'Code', render: (row) => `<span class="plv4-code">${escapeHtml(row.code)}</span>` },
          { label: 'รายการ', render: (row) => escapeHtml(row.itemName) },
          { label: 'สถานะ', render: (row) => renderBadges([{ label: row.status, tone: row.statusTone }]) },
          { label: 'ยอดรวม', render: (row) => escapeHtml(row.total) },
          { label: 'เวลา', render: (row) => escapeHtml(row.createdAt) },
        ],
        model.ordersTable,
        'ยังไม่มีคำสั่งซื้อสำหรับแสดง'
      ),
      '</article>',
      '<article class="plv4-panel">',
      '<div class="plv4-panel-head"><div class="plv4-stack"><span class="plv4-section-kicker">กระเป๋าเงิน</span><h2 class="plv4-section-title">รายการเงินล่าสุด</h2><p class="plv4-section-copy">ดูการเคลื่อนไหวของกระเป๋าเงินเพื่อยืนยันว่าเหรียญเข้าออกเมื่อไร</p></div></div>',
      renderTable(
        [
          { label: 'เวลา', render: (row) => escapeHtml(row.createdAt) },
          { label: 'Delta', render: (row) => escapeHtml(row.delta) },
          { label: 'Balance', render: (row) => escapeHtml(row.balanceAfter) },
          { label: 'เหตุผล', render: (row) => escapeHtml(row.reason) },
          { label: 'อ้างอิง', render: (row) => `<span class="plv4-code">${escapeHtml(row.reference)}</span>` },
        ],
        model.ledgerTable,
        'ยังไม่มีรายการในกระเป๋าเงิน'
      ),
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

  function renderPlayerCommerceV4(target, source) {
    if (!target) return null;
    const model = createPlayerCommerceV4Model(source);
    target.innerHTML = buildPlayerCommerceV4Html(model);
    return model;
  }

  return {
    buildPlayerCommerceV4Html,
    createPlayerCommerceV4Model,
    renderPlayerCommerceV4,
  };
});
