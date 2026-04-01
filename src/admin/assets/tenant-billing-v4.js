(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantBillingV4 = factory();
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
    const rows = Array.isArray(values) ? values : [values];
    for (const value of rows) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return fallback || '';
  }

  function formatNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : (fallback || '0');
  }

  function formatMoney(cents, currency) {
    const amount = Number(cents || 0) / 100;
    const normalizedCurrency = String(currency || 'USD').trim().toUpperCase() || 'USD';
    try {
      return new Intl.NumberFormat('th-TH', { style: 'currency', currency: normalizedCurrency }).format(amount);
    } catch {
      return normalizedCurrency + ' ' + amount.toFixed(2);
    }
  }

  function formatDateTime(value, fallback) {
    if (!value) return fallback || 'ยังไม่มีเวลา';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? (fallback || 'ยังไม่มีเวลา')
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function normalizeSubscriptionState(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['trial', 'trialing'].includes(normalized)) return 'trial';
    if (['active', 'paid'].includes(normalized)) return 'active';
    if (['expired', 'ended'].includes(normalized)) return 'expired';
    if (['suspended', 'past_due', 'failed', 'canceled', 'cancelled', 'void', 'disputed'].includes(normalized)) return 'suspended';
    return normalized || 'unknown';
  }

  function subscriptionStateTone(value) {
    const normalized = normalizeSubscriptionState(value);
    if (normalized === 'active') return 'success';
    if (normalized === 'trial') return 'info';
    if (normalized === 'expired') return 'warning';
    if (normalized === 'suspended') return 'danger';
    return 'muted';
  }

  function humanizeFeatureKey(value) {
    const key = String(value || '').trim();
    if (!key) return 'ฟีเจอร์ที่ไม่ทราบชื่อ';
    const dictionary = {
      delivery_agent: 'ตัวส่งของ',
      server_bot: 'บอทเซิร์ฟเวอร์',
      restart_server: 'รีสตาร์ตเซิร์ฟเวอร์',
      orders_module: 'คำสั่งซื้อ',
      player_module: 'ผู้เล่น',
      wallet_module: 'กระเป๋าเงิน',
      donation_module: 'ผู้สนับสนุน',
      analytics_module: 'สรุปข้อมูล',
      event_module: 'กิจกรรม',
      sync_agent: 'งานซิงก์',
      execute_agent: 'งานส่งของ',
      agentRuntimes: 'ตัวช่วยที่เชื่อมอยู่',
      apiKeys: 'คีย์ API',
      webhooks: 'เว็บฮุก',
    };
    if (dictionary[key]) return dictionary[key];
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (match) { return match.toUpperCase(); });
  }

  function buildQuotaRows(rawQuotas) {
    const quotas = rawQuotas && typeof rawQuotas === 'object' ? rawQuotas : {};
    return Object.entries(quotas).map(function ([key, row]) {
      const limit = Number(row && row.limit);
      const used = Number(row && row.used);
      const remaining = Number(row && row.remaining);
      const limitKnown = Number.isFinite(limit);
      const usedKnown = Number.isFinite(used);
      const remainingKnown = Number.isFinite(remaining);
      const nearLimit = limitKnown && usedKnown && limit > 0 && used >= limit;
      return {
        key,
        label: humanizeFeatureKey(key),
        used: usedKnown ? formatNumber(used, '0') : '-',
        limit: limitKnown ? formatNumber(limit, '0') : 'unlimited',
        remaining: remainingKnown ? formatNumber(Math.max(remaining, 0), '0') : '-',
        tone: nearLimit ? 'warning' : 'info',
        detail: limitKnown
          ? `ใช้ไป ${usedKnown ? formatNumber(used, '0') : '-'} จาก ${formatNumber(limit, '0')}`
          : 'แพ็กเกจนี้ยังไม่รายงานเพดานใช้งานของส่วนนี้',
      };
    });
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

  function createTenantBillingV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const subscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
    const billingOverview = state.billingOverview && typeof state.billingOverview === 'object' ? state.billingOverview : {};
    const invoices = Array.isArray(state.billingInvoices) ? state.billingInvoices : [];
    const attempts = Array.isArray(state.billingPaymentAttempts) ? state.billingPaymentAttempts : [];
    const quotaSnapshot = state.quota && typeof state.quota === 'object' ? state.quota : {};
    const packageInfo = state.overview && state.overview.tenantFeatureAccess && state.overview.tenantFeatureAccess.package
      ? state.overview.tenantFeatureAccess.package
      : {};
    const currentSubscription = subscriptions[0] || quotaSnapshot.subscription || null;
    const subscriptionState = normalizeSubscriptionState(currentSubscription && currentSubscription.status);
    const featureKeys = Array.isArray(quotaSnapshot.enabledFeatureKeys) && quotaSnapshot.enabledFeatureKeys.length
      ? quotaSnapshot.enabledFeatureKeys
      : Array.isArray(packageInfo.features)
        ? packageInfo.features
        : [];
    const features = featureKeys.map(function (key) {
      return {
        key,
        label: humanizeFeatureKey(key),
      };
    });
    const quotaRows = buildQuotaRows(quotaSnapshot.quotas);
    const lockedActions = Object.entries(state.featureEntitlements && state.featureEntitlements.actions || {})
      .filter(function (entry) { return entry[1] && entry[1].locked; })
      .map(function (entry) {
        return {
          key: entry[0],
          reason: firstNonEmpty([entry[1].reason], 'Locked by package'),
        };
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
        title: 'การเงินและแพ็กเกจ',
        subtitle: 'ดูสถานะการสมัครใช้ ฟีเจอร์ที่ถูกล็อก และประวัติใบแจ้งหนี้ก่อนตัดสินใจอัปเกรด',
        statusChips: [
          { label: firstNonEmpty([packageInfo.name, packageInfo.id, subscriptions[0] && subscriptions[0].planId], 'ยังไม่มีข้อมูลแพ็กเกจ'), tone: 'info' },
          { label: subscriptions.length ? firstNonEmpty([subscriptionState], 'active') : 'ยังไม่มีการสมัครใช้', tone: subscriptions.length ? subscriptionStateTone(subscriptionState) : 'warning' },
        ],
      },
      summaryStrip: [
        { label: 'แพ็กเกจปัจจุบัน', value: firstNonEmpty([packageInfo.name, packageInfo.id], 'ยังไม่ทราบ'), detail: 'ฟีเจอร์ด้านล่างอ้างอิงจากสิทธิ์ที่แพ็กเกจกำหนดให้ tenant นี้', tone: 'info' },
        { label: 'ยอดที่รับแล้ว', value: formatMoney(billingOverview.summary && billingOverview.summary.collectedCents || 0, subscriptions[0] && subscriptions[0].currency || 'USD'), detail: 'ใบแจ้งหนี้ที่ชำระแล้วซึ่งระบบบันทึกไว้', tone: 'success' },
        { label: 'ใบแจ้งหนี้ที่ยังเปิดอยู่', value: formatNumber(billingOverview.summary && billingOverview.summary.openInvoiceCount || 0), detail: 'รายการที่ยังรอการชำระหรือรอจัดการต่อ', tone: (billingOverview.summary && billingOverview.summary.openInvoiceCount) ? 'warning' : 'muted' },
        { label: 'การทำงานที่ถูกล็อก', value: formatNumber(lockedActions.length), detail: lockedActions.length ? 'ใช้หน้านี้ดูว่าการอัปเกรดจะปลดล็อกอะไรเพิ่มได้บ้าง' : 'ตอนนี้ยังไม่พบการทำงานที่ถูกล็อก', tone: lockedActions.length ? 'warning' : 'success' },
        { label: 'ฟีเจอร์ที่เปิดอยู่', value: formatNumber(features.length), detail: features.length ? 'ฟีเจอร์ที่ backend เปิดให้ tenant นี้ใช้งานอยู่ตอนนี้' : 'ยังไม่มีรายการฟีเจอร์ที่เปิดใช้งานส่งกลับมา', tone: features.length ? 'success' : 'muted' },
      ],
      subscriptions: subscriptions.slice(0, 6),
      invoices: invoices.slice(0, 8),
      attempts: attempts.slice(0, 8),
      lockedActions: lockedActions.slice(0, 10),
      features: features.slice(0, 24),
      quotaRows: quotaRows.slice(0, 12),
      currentSubscriptionState: subscriptionState,
    };
  }

  function buildTenantBillingV4Html(model) {
    const safe = model || createTenantBillingV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="/pricing">ดูแพ็กเกจที่สูงขึ้น</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สิ่งที่ควรทำก่อน</div>',
      '<h2 class="tdv4-section-title">ตรวจแพ็กเกจที่เหมาะกว่า</h2>',
      '<p class="tdv4-section-copy">ใช้เมื่อฟีเจอร์ที่ล็อกเริ่มกระทบงานประจำวัน และอยากดูว่าควรขยับแพ็กเกจหรือไม่</p>',
      '<div class="tdv4-action-list"><a class="tdv4-button tdv4-button-primary" href="/pricing">ดูตัวเลือกแพ็กเกจ</a><button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-billing-refresh>รีเฟรชข้อมูลการเงิน</button></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สถานะการสมัครใช้</div>',
      '<h2 class="tdv4-section-title">รายการสมัครใช้</h2>',
      safe.subscriptions.length ? safe.subscriptions.map(function (row) {
        const normalizedStatus = normalizeSubscriptionState(row.status);
        return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(subscriptionStateTone(normalizedStatus)) + '"><div class="tdv4-list-main"><strong>' + escapeHtml(firstNonEmpty([row.planId, row.id], 'การสมัครใช้')) + '</strong><p>รอบบิล: ' + escapeHtml(firstNonEmpty([row.billingCycle], '-')) + ' | ต่ออายุ: ' + escapeHtml(formatDateTime(row.renewsAt, 'ยังไม่มีวันต่ออายุ')) + '</p></div><div class="tdv4-chip-row">' + renderBadge(firstNonEmpty([normalizedStatus], 'unknown'), subscriptionStateTone(normalizedStatus)) + renderBadge(formatMoney(row.amountCents, row.currency), 'success') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีข้อมูลการสมัครใช้</strong><p>ระบบการเงินยังไม่ส่งรายการการสมัครใช้กลับมาสำหรับ tenant นี้</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สิทธิ์จากแพ็กเกจ</div>',
      '<h2 class="tdv4-section-title">ฟีเจอร์ที่เปิดอยู่</h2>',
      safe.features.length ? safe.features.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-success"><div class="tdv4-list-main"><strong>' + escapeHtml(row.label) + '</strong><p>' + escapeHtml(row.key) + '</p></div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีรายการฟีเจอร์</strong><p>tenant นี้ยังไม่ส่งรายการฟีเจอร์จากสิทธิ์แพ็กเกจกลับมา</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">เพดานการใช้งาน</div>',
      '<h2 class="tdv4-section-title">ขีดจำกัดของแพ็กเกจตอนนี้</h2>',
      safe.quotaRows.length ? safe.quotaRows.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(row.tone) + '"><div class="tdv4-list-main"><strong>' + escapeHtml(row.label) + '</strong><p>' + escapeHtml(row.detail) + '</p></div><div class="tdv4-chip-row">' + renderBadge('ใช้แล้ว ' + row.used, 'info') + renderBadge('เพดาน ' + row.limit, 'muted') + renderBadge('เหลือ ' + row.remaining, row.tone) + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีข้อมูลเพดานใช้งาน</strong><p>tenant นี้ยังไม่ส่งข้อมูลโควตาการใช้งานกลับมา</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ใบแจ้งหนี้</div>',
      '<h2 class="tdv4-section-title">ใบแจ้งหนี้ล่าสุด</h2>',
      safe.invoices.length ? safe.invoices.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-info"><div class="tdv4-list-main"><strong>' + escapeHtml(firstNonEmpty([row.id], 'ใบแจ้งหนี้')) + '</strong><p>ครบกำหนด ' + escapeHtml(formatDateTime(row.dueAt, 'ยังไม่มีวันครบกำหนด')) + ' | ชำระแล้ว ' + escapeHtml(formatDateTime(row.paidAt, 'ยังไม่ชำระ')) + '</p></div><div class="tdv4-chip-row">' + renderBadge(firstNonEmpty([row.status], 'unknown'), 'info') + renderBadge(formatMoney(row.amountCents, row.currency), 'success') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีใบแจ้งหนี้</strong><p>ประวัติใบแจ้งหนี้จะขึ้นที่นี่เมื่อระบบการเงินเริ่มทำงานรอบแรก</p></div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สิ่งที่ถูกล็อก</div>',
      '<h2 class="tdv4-section-title">งานที่แพ็กเกจยังไม่เปิดให้ใช้</h2>',
      safe.lockedActions.length ? safe.lockedActions.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-warning"><div class="tdv4-list-main"><strong>' + escapeHtml(row.key) + '</strong><p>' + escapeHtml(row.reason) + '</p></div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีงานที่ถูกล็อก</strong><p>แพ็กเกจปัจจุบันยังไม่รายงานการปิดสิทธิ์ของ tenant ในตอนนี้</p></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">ความพยายามชำระเงิน</div>',
      '<h2 class="tdv4-section-title">การชำระเงินล่าสุด</h2>',
      safe.attempts.length ? safe.attempts.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-' + escapeHtml(String(row.status || '').trim().toLowerCase() === 'failed' ? 'warning' : 'info') + '"><div class="tdv4-list-main"><strong>' + escapeHtml(firstNonEmpty([row.provider, row.id], 'รายการชำระเงิน')) + '</strong><p>' + escapeHtml(firstNonEmpty([row.errorDetail, row.errorCode, 'ยังไม่มีข้อผิดพลาดที่บันทึกไว้'])) + '</p></div><div class="tdv4-chip-row">' + renderBadge(firstNonEmpty([row.status], 'unknown'), 'info') + renderBadge(formatMoney(row.amountCents, row.currency), 'success') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>ยังไม่มีประวัติการชำระเงิน</strong><p>ส่วนนี้จะแสดงเมื่อระบบบันทึกการพยายามชำระเงินเข้ามาแล้ว</p></div>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantBillingV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantBillingV4 requires a root element');
    const model = source && source.header && Array.isArray(source.subscriptions)
      ? source
      : createTenantBillingV4Model(source);
    rootElement.innerHTML = buildTenantBillingV4Html(model);
    return model;
  }

  return {
    buildTenantBillingV4Html: buildTenantBillingV4Html,
    createTenantBillingV4Model: createTenantBillingV4Model,
    renderTenantBillingV4: renderTenantBillingV4,
  };
});
