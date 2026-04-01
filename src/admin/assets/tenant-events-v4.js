(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantEventsV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function firstNonEmpty(values, fallback) {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return fallback || '';
  }

  function formatNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : (fallback || '0');
  }

  function formatDateTime(value, fallback) {
    if (!value) return fallback || 'ยังไม่ระบุเวลา';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function formatRelative(value, fallback) {
    if (!value) return fallback || 'ยังไม่มีความเคลื่อนไหวล่าสุด';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 60) return `${formatNumber(diffMinutes)} นาทีที่แล้ว`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${formatNumber(diffHours)} ชั่วโมงที่แล้ว`;
    return `${formatNumber(Math.round(diffHours / 24))} วันที่แล้ว`;
  }

  function normalizeEventTone(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'active' || value === 'live') return 'success';
    if (value === 'scheduled' || value === 'pending') return 'info';
    if (value === 'ended' || value === 'completed') return 'muted';
    return 'warning';
  }

  function localizeEventStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'active' || value === 'live') return 'กำลังจัดอยู่';
    if (value === 'scheduled') return 'ตั้งเวลาแล้ว';
    if (value === 'pending') return 'รอเริ่ม';
    if (value === 'ended' || value === 'completed') return 'ปิดแล้ว';
    return firstNonEmpty([status], 'ยังไม่ทราบสถานะ');
  }

  function localizeRaidStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'approved') return 'อนุมัติแล้ว';
    if (value === 'rejected') return 'ไม่อนุมัติ';
    if (value === 'scheduled') return 'ตั้งเวลาแล้ว';
    if (value === 'active' || value === 'live') return 'กำลังเปิดอยู่';
    if (value === 'completed' || value === 'ended') return 'เสร็จแล้ว';
    if (value === 'pending') return 'รอตัดสินใจ';
    return firstNonEmpty([status], 'ยังไม่ทราบสถานะ');
  }

  function renderBadge(label, tone) {
    return '<span class="tdv4-badge tdv4-badge-' + escapeHtml(tone || 'muted') + '">' + escapeHtml(label) + '</span>';
  }

  function renderNavGroup(group) {
    return [
      '<section class="tdv4-nav-group">',
      '<div class="tdv4-nav-group-label">' + escapeHtml(group.label) + '</div>',
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items.map(function (item) {
        return '<a class="tdv4-nav-link' + (item.current ? ' tdv4-nav-link-current' : '') + '" href="' + escapeHtml(item.href || '#') + '">' + escapeHtml(item.label) + '</a>';
      }) : []),
      '</div>',
      '</section>',
    ].join('');
  }

  function renderSummaryCard(item) {
    return [
      '<article class="tdv4-kpi tdv4-tone-' + escapeHtml(item.tone || 'muted') + '">',
      '<div class="tdv4-kpi-label">' + escapeHtml(item.label) + '</div>',
      '<div class="tdv4-kpi-value">' + escapeHtml(item.value) + '</div>',
      '<div class="tdv4-kpi-detail">' + escapeHtml(item.detail) + '</div>',
      '</article>',
    ].join('');
  }

  function createTenantEventsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const events = Array.isArray(state.events) ? state.events : [];
    const raids = state.raids && typeof state.raids === 'object' ? state.raids : {};
    const raidRequests = Array.isArray(raids.requests) ? raids.requests : [];
    const raidWindows = Array.isArray(raids.windows) ? raids.windows : [];
    const raidSummaries = Array.isArray(raids.summaries) ? raids.summaries : [];
    const killfeed = Array.isArray(state.killfeed) ? state.killfeed : [];
    const activeEvents = events.filter(function (row) {
      return String(row.status || '').trim().toLowerCase() === 'active';
    });
    const pendingRequests = raidRequests.filter(function (row) {
      return String(row.status || '').trim().toLowerCase() === 'pending';
    });
    const scheduledWindows = raidWindows.filter(function (row) {
      return ['scheduled', 'active', 'live'].includes(String(row.status || '').trim().toLowerCase());
    });

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state.tenantLabel,
          state.tenantConfig && state.tenantConfig.name,
          state.overview && state.overview.tenantName,
          state.me && state.me.tenantId,
          'พื้นที่จัดการผู้เช่า',
        ]),
        navGroups: Array.isArray(state.__surfaceShell && state.__surfaceShell.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'กิจกรรมและเรด',
        subtitle: 'ตั้งกิจกรรมใหม่ อนุมัติคำขอเรด และประกาศช่วงเวลาให้ทีมงานกับผู้เล่นเห็นจากหน้าเดียว',
        statusChips: [
          { label: `${formatNumber(events.length)} กิจกรรม`, tone: events.length ? 'info' : 'muted' },
          { label: `${formatNumber(pendingRequests.length)} คำขอเรดรออนุมัติ`, tone: pendingRequests.length ? 'warning' : 'success' },
          { label: `${formatNumber(scheduledWindows.length)} ช่วงเวลาเรด`, tone: scheduledWindows.length ? 'info' : 'muted' },
          { label: `${formatNumber(killfeed.length)} รายการต่อสู้ล่าสุด`, tone: killfeed.length ? 'success' : 'muted' },
        ],
      },
      summaryStrip: [
        { label: 'กิจกรรมที่กำลังเปิดอยู่', value: formatNumber(activeEvents.length), detail: 'ใช้ดูว่าตอนนี้มีอะไรที่ทีมงานต้องคุมอยู่บ้าง', tone: activeEvents.length ? 'success' : 'muted' },
        { label: 'กิจกรรมที่ตั้งเวลาแล้ว', value: formatNumber(events.filter(function (row) { return String(row.status || '').trim().toLowerCase() === 'scheduled'; }).length), detail: 'รายการที่รอถึงเวลาเริ่ม', tone: events.length ? 'info' : 'muted' },
        { label: 'คำขอเรดที่รอทีมงาน', value: formatNumber(pendingRequests.length), detail: 'เปิดดูและตัดสินใจก่อนผู้เล่นตามงานซ้ำ', tone: pendingRequests.length ? 'warning' : 'muted' },
        { label: 'ประกาศสรุปผลแล้ว', value: formatNumber(raidSummaries.length), detail: 'ใช้ยืนยันผลหลังจบเรดหรือกิจกรรมใหญ่', tone: raidSummaries.length ? 'success' : 'muted' },
        { label: 'ฟีดการต่อสู้ล่าสุด', value: formatNumber(killfeed.length), detail: 'หยิบไปอ้างอิงตอนสรุปหรือเช็กบริบทหน้างานได้', tone: killfeed.length ? 'info' : 'muted' },
      ],
      events: events,
      raidRequests: raidRequests,
      raidWindows: raidWindows,
      raidSummaries: raidSummaries,
      killfeed: killfeed,
    };
  }

  function buildTenantEventsV4Html(model) {
    const safe = model || createTenantEventsV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="#tenant-event-create">สร้างกิจกรรมใหม่</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-spotlight-grid">',
      '<article class="tdv4-panel tdv4-tone-info"><div class="tdv4-section-kicker">ควรเริ่มจากตรงไหน</div><h2 class="tdv4-section-title">ดูภาพรวมก่อน แล้วค่อยลงมือแก้หน้างาน</h2><p class="tdv4-section-copy">หน้ากิจกรรมนี้ควรใช้กับ 3 งานหลัก: สร้างกิจกรรมใหม่, ตัดสินใจคำขอเรด, และประกาศช่วงเวลาให้ชุมชนเห็นอย่างเป็นทางการ</p><div class="tdv4-action-list"><a class="tdv4-button tdv4-button-primary" href="#tenant-event-create">เริ่มสร้างกิจกรรม</a><a class="tdv4-button tdv4-button-secondary" href="#tenant-raid-review">ดูคำขอเรด</a><a class="tdv4-button tdv4-button-secondary" href="#tenant-raid-publish">ไปที่ประกาศเรด</a></div></article>',
      '<article class="tdv4-spotlight-media" style="--tdv4-media-image: linear-gradient(135deg, rgba(8, 12, 10, 0.48), rgba(8, 12, 10, 0.18)), url(\'/admin/assets/tenant-panel-scene.svg\');"><div class="tdv4-spotlight-overlay"><span class="tdv4-section-kicker">สนามปฏิบัติการ</span><h3 class="tdv4-section-title">ภาพรวมกิจกรรมที่ผู้เล่นจะรู้สึกทันที</h3><p class="tdv4-section-copy tdv4-spotlight-copy">ถ้าหน้านี้จัดลำดับดี ทีมงานจะเห็นทั้งงานที่ต้องตัดสินใจและประกาศที่ต้องปล่อย โดยไม่ต้องกระโดดไปมาหลายหน้า</p></div></article>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<article class="tdv4-panel" id="tenant-event-create"><div class="tdv4-section-kicker">สร้างกิจกรรมใหม่</div><h2 class="tdv4-section-title">ตั้งกิจกรรมให้พร้อมเปิดได้ทันที</h2><p class="tdv4-section-copy">กรอกชื่อ เวลา และรางวัลให้ครบก่อน จากนั้นทีมงานจะค่อยไปแก้รายละเอียดในรายการด้านล่างได้อีกครั้ง</p><form class="tdv4-inline-form" data-tenant-event-form><div class="tdv4-form-grid"><label class="tdv4-stack"><span class="tdv4-section-kicker">ชื่อกิจกรรม</span><input class="tdv4-basic-input" type="text" name="name" placeholder="เช่น Weekend Arena" required></label><label class="tdv4-stack"><span class="tdv4-section-kicker">เวลาเริ่ม</span><input class="tdv4-basic-input" type="text" name="time" placeholder="เช่น ศุกร์ 20:00 ICT" required></label><label class="tdv4-stack"><span class="tdv4-section-kicker">รางวัล</span><input class="tdv4-basic-input" type="text" name="reward" placeholder="เช่น 5,000 Coins หรือ VIP crate" required></label><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-event-create>สร้างกิจกรรม</button></div></form></article>',
      '<article class="tdv4-panel"><div class="tdv4-section-kicker">ภาพรวมการทำงาน</div><h2 class="tdv4-section-title">สิ่งที่ควรเช็กก่อนเริ่มงาน</h2><div class="tdv4-action-list"><div class="tdv4-note-card"><strong>กิจกรรมที่กำลังเปิดอยู่</strong><p>' + escapeHtml(safe.summaryStrip[0].value) + ' รายการที่ทีมงานยังต้องดูแลอยู่</p></div><div class="tdv4-note-card"><strong>คำขอเรดที่ยังไม่ตัดสินใจ</strong><p>' + escapeHtml(safe.summaryStrip[2].value) + ' รายการที่ควรรีบเคลียร์ก่อนประกาศรอบใหม่</p></div><div class="tdv4-note-card"><strong>ฟีดการต่อสู้ล่าสุด</strong><p>ใช้เป็นบริบทรวดเร็วตอนสรุปผลหรือดูความเคลื่อนไหวของชุมชน</p></div></div></article>',
      '</section>',
      '<section class="tdv4-panel"><div class="tdv4-section-kicker">กิจกรรมที่มีอยู่แล้ว</div><h2 class="tdv4-section-title">แก้รายละเอียดหรือสั่งเริ่มจากรายการเดิม</h2><p class="tdv4-section-copy">เก็บทุกกิจกรรมไว้ในหน้าเดียวเพื่อให้ทีมงานเช็กสถานะ, ปรับข้อมูล, และปิดรอบพร้อมให้รางวัลได้ง่าย</p>' +
        (safe.events.length ? safe.events.map(function (row) {
          const participants = Array.isArray(row.participants) ? row.participants.length : Number(row.participantsCount || 0);
          return [
            '<article class="tdv4-panel tdv4-tone-' + escapeHtml(normalizeEventTone(row.status)) + '" data-tenant-event-card data-event-id="' + escapeHtml(row.id) + '">',
            '<div class="tdv4-section-kicker">กิจกรรม #' + escapeHtml(row.id) + '</div>',
            '<h3 class="tdv4-section-title">' + escapeHtml(firstNonEmpty([row.name], 'กิจกรรม')) + '</h3>',
            '<div class="tdv4-chip-row">' +
              renderBadge(localizeEventStatus(row.status), normalizeEventTone(row.status)) +
              renderBadge(participants ? `${formatNumber(participants)} ผู้เข้าร่วม` : 'ยังไม่มีรายชื่อผู้เข้าร่วม', participants ? 'info' : 'muted') +
            '</div>',
            '<div class="tdv4-form-grid">',
            '<label class="tdv4-stack"><span class="tdv4-section-kicker">ชื่อกิจกรรม</span><input class="tdv4-basic-input" type="text" data-event-name value="' + escapeHtml(firstNonEmpty([row.name], '')) + '"></label>',
            '<label class="tdv4-stack"><span class="tdv4-section-kicker">เวลา</span><input class="tdv4-basic-input" type="text" data-event-time value="' + escapeHtml(firstNonEmpty([row.time], '')) + '"></label>',
            '<label class="tdv4-stack"><span class="tdv4-section-kicker">รางวัล</span><input class="tdv4-basic-input" type="text" data-event-reward value="' + escapeHtml(firstNonEmpty([row.reward], '')) + '"></label>',
            '<label class="tdv4-stack"><span class="tdv4-section-kicker">ผู้ชนะ</span><input class="tdv4-basic-input" type="text" data-event-winner-user-id value="' + escapeHtml(firstNonEmpty([row.winnerUserId], '')) + '" placeholder="user id หรือชื่อที่ใช้ภายในระบบ"></label>',
            '<label class="tdv4-stack"><span class="tdv4-section-kicker">เหรียญรางวัล</span><input class="tdv4-basic-input" type="number" min="0" data-event-reward-coins value="' + escapeHtml(String(Number(row.rewardCoins || 0) || 0)) + '"></label>',
            '<div class="tdv4-stack"><span class="tdv4-section-kicker">บันทึกล่าสุด</span><div class="tdv4-note-card"><strong>' + escapeHtml(formatDateTime(row.updatedAt || row.createdAt || row.time, 'ยังไม่มีเวลาอัปเดต')) + '</strong><p>สถานะตอนนี้: ' + escapeHtml(localizeEventStatus(row.status)) + '</p></div></div>',
            '</div>',
            '<div class="tdv4-action-list">' +
              '<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-event-action="update" data-event-id="' + escapeHtml(row.id) + '">บันทึกรายละเอียด</button>' +
              '<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-event-action="start" data-event-id="' + escapeHtml(row.id) + '">เริ่มกิจกรรม</button>' +
              '<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-event-action="end" data-event-id="' + escapeHtml(row.id) + '">ปิดกิจกรรมและให้รางวัล</button>' +
            '</div>',
            '</article>',
          ].join('');
        }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีกิจกรรมที่สร้างไว้</strong><p>เริ่มจากการสร้างกิจกรรมแรกด้านบน แล้วหน้ารายการนี้จะกลายเป็นจุดแก้ไขและสั่งงานต่อให้ทันที</p></div>') +
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<article class="tdv4-panel" id="tenant-raid-review"><div class="tdv4-section-kicker">คำขอเรดที่รอทีมงานตัดสินใจ</div><h2 class="tdv4-section-title">อ่านบริบท แล้วอนุมัติหรือปฏิเสธตรงนี้</h2><p class="tdv4-section-copy">เก็บโน้ตประกอบการตัดสินใจไว้กับคำขอเลย เพื่อไม่ให้เรื่องหลุดไปอยู่ในแชตอย่างเดียว</p>' +
        (safe.raidRequests.length ? safe.raidRequests.map(function (row) {
          return [
            '<article class="tdv4-note-card tdv4-tone-' + escapeHtml(normalizeEventTone(row.status === 'approved' ? 'active' : row.status)) + '" data-tenant-raid-request-card data-raid-request-id="' + escapeHtml(row.id) + '">',
            '<strong>' + escapeHtml(firstNonEmpty([row.requesterName], 'ผู้เล่นไม่ทราบชื่อ')) + '</strong>',
            '<p>' + escapeHtml(firstNonEmpty([row.requestText], 'ยังไม่มีรายละเอียดคำขอ')) + '</p>',
            '<div class="tdv4-chip-row">' + renderBadge(localizeRaidStatus(row.status), normalizeEventTone(row.status === 'approved' ? 'active' : row.status)) + renderBadge(firstNonEmpty([row.preferredWindow], 'ยังไม่ระบุช่วงเวลา'), 'info') + '</div>',
            '<label class="tdv4-stack"><span class="tdv4-section-kicker">บันทึกของทีมงาน</span><textarea class="tdv4-basic-input tdv4-basic-textarea" rows="3" data-raid-request-note placeholder="เช่น อนุมัติให้เปิดช่วงเวลาเรดวันศุกร์ 21:00">' + escapeHtml(firstNonEmpty([row.decisionNote], '')) + '</textarea></label>',
            '<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="button" data-tenant-raid-review="approved" data-raid-request-id="' + escapeHtml(row.id) + '">อนุมัติคำขอ</button><button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-raid-review="rejected" data-raid-request-id="' + escapeHtml(row.id) + '">ไม่อนุมัติ</button></div>',
            '</article>',
          ].join('');
        }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีคำขอเรดใหม่</strong><p>ถ้าผู้เล่นยังไม่ส่งคำขอเข้ามา ส่วนนี้จะว่างไว้แบบนี้ และคุณสามารถข้ามไปเตรียมช่วงเวลาเรดล่วงหน้าได้</p></div>') +
      '</article>',
      '<article class="tdv4-panel" id="tenant-raid-publish"><div class="tdv4-section-kicker">ประกาศช่วงเวลาเรดและสรุปผล</div><h2 class="tdv4-section-title">ปล่อยประกาศใหม่ แล้วเก็บสรุปหลังจบงานในจุดเดียว</h2><p class="tdv4-section-copy">ใช้ฟอร์มซ้ายมือสร้างช่วงเวลาเรด และฟอร์มขวาสรุปผลหลังจบเพื่อให้ผู้เล่นย้อนดูได้ชัด</p><div class="tdv4-action-list"><div class="tdv4-note-card"><strong>ช่วงเวลาเรดที่ประกาศแล้ว</strong><p>' + escapeHtml(formatNumber(safe.raidWindows.length)) + ' รายการ</p></div><div class="tdv4-note-card"><strong>สรุปผลที่เผยแพร่แล้ว</strong><p>' + escapeHtml(formatNumber(safe.raidSummaries.length)) + ' รายการ</p></div></div></article>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<article class="tdv4-panel"><div class="tdv4-section-kicker">สร้างช่วงเวลาเรด</div><h2 class="tdv4-section-title">ประกาศให้ผู้เล่นรู้ล่วงหน้า</h2><form class="tdv4-inline-form" data-tenant-raid-window-form><div class="tdv4-form-grid"><label class="tdv4-stack"><span class="tdv4-section-kicker">ผูกกับคำขอเรด</span><input class="tdv4-basic-input" type="number" min="0" name="requestId" placeholder="ใส่เลขคำขอถ้ามี"></label><label class="tdv4-stack"><span class="tdv4-section-kicker">ชื่อช่วงเวลา</span><input class="tdv4-basic-input" type="text" name="title" placeholder="เช่น Friday Window" required></label><label class="tdv4-stack"><span class="tdv4-section-kicker">เริ่มเมื่อไร</span><input class="tdv4-basic-input" type="text" name="startsAt" placeholder="เช่น 2026-04-05 21:00 ICT" required></label><label class="tdv4-stack"><span class="tdv4-section-kicker">สิ้นสุดเมื่อไร</span><input class="tdv4-basic-input" type="text" name="endsAt" placeholder="เช่น 2026-04-05 23:00 ICT"></label><label class="tdv4-stack tdv4-stack-full"><span class="tdv4-section-kicker">โน้ตประกาศ</span><textarea class="tdv4-basic-input tdv4-basic-textarea" rows="3" name="notes" placeholder="เช่น เปิดเฉพาะฝั่งตะวันตกและให้ยึดตามกติกาเรดล่าสุด"></textarea></label><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-raid-window-save>บันทึกช่วงเวลาเรด</button></div></form>' +
        (safe.raidWindows.length ? '<div class="tdv4-action-list">' + safe.raidWindows.slice(0, 6).map(function (row) {
          return '<div class="tdv4-note-card"><strong>' + escapeHtml(firstNonEmpty([row.title], 'ช่วงเวลาเรด')) + '</strong><p>' + escapeHtml(formatDateTime(row.startsAt, 'ยังไม่ระบุเวลาเริ่ม')) + ' | ' + escapeHtml(localizeRaidStatus(row.status)) + '</p></div>';
        }).join('') + '</div>' : '<div class="tdv4-empty-state"><strong>ยังไม่มีช่วงเวลาเรดที่ประกาศไว้</strong><p>สร้างรายการแรกจากฟอร์มด้านบน แล้วรายชื่อจะขึ้นตรงนี้ให้ทีมงานเช็กซ้ำได้ทันที</p></div>') +
      '</article>',
      '<article class="tdv4-panel"><div class="tdv4-section-kicker">สรุปผลหลังจบเรด</div><h2 class="tdv4-section-title">บันทึกผลให้ผู้เล่นเห็นภาพเดียวกัน</h2><form class="tdv4-inline-form" data-tenant-raid-summary-form><div class="tdv4-form-grid"><label class="tdv4-stack"><span class="tdv4-section-kicker">ผูกกับคำขอเรด</span><input class="tdv4-basic-input" type="number" min="0" name="requestId" placeholder="ใส่เลขคำขอถ้ามี"></label><label class="tdv4-stack"><span class="tdv4-section-kicker">ผูกกับช่วงเวลาเรด</span><input class="tdv4-basic-input" type="number" min="0" name="windowId" placeholder="ใส่เลขช่วงเวลาเรดถ้ามี"></label><label class="tdv4-stack tdv4-stack-full"><span class="tdv4-section-kicker">ผลลัพธ์</span><input class="tdv4-basic-input" type="text" name="outcome" placeholder="เช่น Raid completed" required></label><label class="tdv4-stack tdv4-stack-full"><span class="tdv4-section-kicker">สรุปเพิ่มเติม</span><textarea class="tdv4-basic-input tdv4-basic-textarea" rows="4" name="notes" placeholder="เช่น 2 ทีมเข้าร่วม, เคลียร์อาคารหลักสำเร็จ, มีข้อสังเกตเรื่องเวลาเริ่ม"></textarea></label><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-raid-summary-save>เผยแพร่สรุปผล</button></div></form>' +
        (safe.raidSummaries.length ? '<div class="tdv4-action-list">' + safe.raidSummaries.slice(0, 6).map(function (row) {
          return '<div class="tdv4-note-card"><strong>' + escapeHtml(firstNonEmpty([row.outcome], 'สรุปผลเรด')) + '</strong><p>' + escapeHtml(firstNonEmpty([row.notes], 'ยังไม่มีบันทึกเพิ่มเติม')) + '</p></div>';
        }).join('') + '</div>' : '<div class="tdv4-empty-state"><strong>ยังไม่มีสรุปผลเรด</strong><p>ใช้ส่วนนี้บันทึกผลหลังจบรอบ เพื่อให้ผู้เล่นกับทีมงานอ้างอิงข้อมูลเดียวกันได้</p></div>') +
      '</article>',
      '</section>',
      '<section class="tdv4-panel"><div class="tdv4-section-kicker">การต่อสู้ล่าสุด</div><h2 class="tdv4-section-title">ดูบริบทหน้างานจากฟีดล่าสุด</h2><p class="tdv4-section-copy">ใช้เช็กภาพรวมความเคลื่อนไหวก่อนประกาศผลหรือก่อนตัดสินใจเรื่องคำขอเรด</p>' +
        (safe.killfeed.length ? '<div class="tdv4-action-list">' + safe.killfeed.slice(0, 10).map(function (row) {
          const detailParts = [
            firstNonEmpty([row.weapon], 'อาวุธไม่ทราบชนิด'),
            row.sector ? `โซน ${row.sector}` : '',
            row.distance != null ? `${formatNumber(row.distance)} เมตร` : '',
          ].filter(Boolean);
          return [
            '<article class="tdv4-note-card">',
            '<strong>' + escapeHtml(firstNonEmpty([row.killerName], 'ผู้เล่นไม่ทราบชื่อ')) + ' จัดการ ' + escapeHtml(firstNonEmpty([row.victimName], 'ผู้เล่นไม่ทราบชื่อ')) + '</strong>',
            '<p>' + escapeHtml(detailParts.join(' | ') || 'ยังไม่มีรายละเอียดเพิ่มเติม') + '</p>',
            '<div class="tdv4-kpi-detail">' + escapeHtml(formatRelative(row.occurredAt || row.createdAt)) + '</div>',
            '</article>',
          ].join('');
        }).join('') + '</div>' : '<div class="tdv4-empty-state"><strong>ยังไม่มีฟีดการต่อสู้ล่าสุด</strong><p>เมื่อระบบซิงก์ข้อมูลเข้ามา ส่วนนี้จะช่วยให้ทีมงานมองภาพรวมก่อนสรุปผลหรือประกาศรอบใหม่ได้ง่ายขึ้น</p></div>') +
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantEventsV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantEventsV4 requires a root element');
    const model = source && source.header && Array.isArray(source.events)
      ? source
      : createTenantEventsV4Model(source);
    rootElement.innerHTML = buildTenantEventsV4Html(model);
    return model;
  }

  return {
    buildTenantEventsV4Html,
    createTenantEventsV4Model,
    renderTenantEventsV4,
  };
});
