(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.PlayerV4Shared = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_BLUEPRINT = [
    {
      label: 'เริ่มต้น',
      items: [
        { key: 'home', label: 'หน้าหลัก', href: '#home' },
        { key: 'profile', label: 'บัญชีและความพร้อม', href: '#profile' },
      ],
    },
    {
      label: 'ร้านค้าและกระเป๋าเงิน',
      items: [
        { key: 'shop', label: 'ร้านค้า', href: '#shop' },
        { key: 'wallet', label: 'กระเป๋าเงิน', href: '#wallet' },
        { key: 'orders', label: 'คำสั่งซื้อและการส่งของ', href: '#orders' },
      ],
    },
    {
      label: 'ชุมชนและอันดับ',
      items: [
        { key: 'stats', label: 'สถิติและอันดับ', href: '#stats' },
        { key: 'events', label: 'กิจกรรมและประกาศ', href: '#events' },
        { key: 'support', label: 'การช่วยเหลือ', href: '#support' },
      ],
    },
  ];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return new Intl.NumberFormat('th-TH').format(numeric);
  }

  function formatAmount(value, fallback = '-') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  function formatDateTime(value, fallback = 'ยังไม่มีข้อมูลเวลา') {
    const date = parseDate(value);
    if (!date) return fallback;
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function formatRelative(value, fallback = 'ยังไม่มีสัญญาณล่าสุด') {
    const date = parseDate(value);
    if (!date) return fallback;
    const deltaMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (deltaMinutes < 60) return `${formatNumber(deltaMinutes)} นาทีที่แล้ว`;
    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) return `${formatNumber(deltaHours)} ชั่วโมงที่แล้ว`;
    const deltaDays = Math.round(deltaHours / 24);
    return `${formatNumber(deltaDays)} วันที่แล้ว`;
  }

  function firstNonEmpty(values, fallback = '') {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function buildPlayerBrandMark(siteName, fallback = 'SCUM') {
    const source = firstNonEmpty([siteName], '');
    if (!source) return fallback;
    const parts = source
      .split(/[\s_-]+/g)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    const mark = parts.slice(0, 2).map((entry) => entry.charAt(0).toUpperCase()).join('');
    return firstNonEmpty([mark, source.slice(0, 4).toUpperCase()], fallback);
  }

  function buildPlayerPortalShell(source, options = {}) {
    const state = source && typeof source === 'object' ? source : {};
    const branding = state.branding && typeof state.branding === 'object' ? state.branding : {};
    const navGroups = Array.isArray(options.navGroups) ? options.navGroups : [];
    const fallbackWorkspaceLabel = firstNonEmpty([options.workspaceLabel], 'Player Workspace');
    const fallbackEnvironmentLabel = firstNonEmpty([options.environmentLabel], 'SCUM Player Community');
    return {
      brand: firstNonEmpty([branding.brandMark], buildPlayerBrandMark(branding.siteName, 'SCUM')),
      logoUrl: firstNonEmpty([branding.logoUrl], '') || null,
      bannerUrl: firstNonEmpty([branding.bannerUrl], '') || null,
      siteName: firstNonEmpty([branding.siteName], 'SCUM TH'),
      siteDetail: firstNonEmpty([branding.siteDetail], ''),
      theme: firstNonEmpty([branding.theme], 'scum-dark'),
      themeTokens: branding.themeTokens && typeof branding.themeTokens === 'object' ? branding.themeTokens : null,
      surfaceLabel: firstNonEmpty([branding.siteName, options.surfaceLabel], 'Player Portal'),
      workspaceLabel: fallbackWorkspaceLabel,
      environmentLabel: firstNonEmpty([branding.siteDetail, options.environmentLabel], fallbackEnvironmentLabel),
      navGroups,
    };
  }

  function renderPlayerBrandMark(shell) {
    const safeShell = shell && typeof shell === 'object' ? shell : {};
    if (safeShell.logoUrl) {
      return [
        '<span class="plv4-brand-mark plv4-brand-mark-logo">',
        `<img class="plv4-brand-logo" src="${escapeHtml(safeShell.logoUrl)}" alt="${escapeHtml(firstNonEmpty([safeShell.siteName, safeShell.brand], 'SCUM'))}">`,
        '</span>',
      ].join('');
    }
    return `<span class="plv4-brand-mark">${escapeHtml(firstNonEmpty([safeShell.brand], 'SCUM'))}</span>`;
  }

  function listCount(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function toneForStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['active', 'linked', 'online', 'ready', 'delivered', 'success', 'healthy', 'claimable'].includes(normalized)) return 'success';
    if (['warning', 'warn', 'pending', 'queued', 'processing', 'cooldown', 'review'].includes(normalized)) return 'warning';
    if (['error', 'failed', 'delivery_failed', 'offline', 'inactive', 'missing'].includes(normalized)) return 'danger';
    if (['info', 'session', 'member'].includes(normalized)) return 'info';
    return 'muted';
  }

  function orderStatusLabel(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'delivered') return 'ส่งของสำเร็จ';
    if (normalized === 'delivery_failed') return 'ต้องตรวจต่อ';
    if (normalized === 'delivering') return 'กำลังส่งของ';
    if (normalized === 'queued') return 'รอเข้าคิว';
    if (normalized === 'pending') return 'รอดำเนินการ';
    return firstNonEmpty([value], 'ยังไม่ระบุ');
  }

  function badge(label, tone) {
    return `<span class="plv4-badge plv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label || '-')}</span>`;
  }

  function createPlayerNavGroups(currentKey) {
    return NAV_BLUEPRINT.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({
        label: item.label,
        href: item.href,
        current: item.key === currentKey,
      })),
    }));
  }

  function renderNavGroups(groups) {
    return (Array.isArray(groups) ? groups : []).map((group) => [
      '<section class="plv4-nav-group">',
      `<div class="plv4-nav-group-label">${escapeHtml(group.label || '')}</div>`,
      '<div class="plv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items : []).map((item) => {
        const className = item.current ? 'plv4-nav-link plv4-nav-link-current' : 'plv4-nav-link';
        return `<a class="${className}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label || '')}</a>`;
      }),
      '</div>',
      '</section>',
    ].join('')).join('');
  }

  function renderBadges(items) {
    return (Array.isArray(items) ? items : []).map((item) => badge(item.label, item.tone)).join('');
  }

  function renderSummaryStrip(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="plv4-summary-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="plv4-summary-label">${escapeHtml(item.label || '')}</span>`,
      `<strong class="plv4-summary-value">${escapeHtml(item.value || '-')}</strong>`,
      `<p class="plv4-summary-detail">${escapeHtml(item.detail || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }

  function renderTaskGroups(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="plv4-task-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="plv4-section-kicker">${escapeHtml(item.tag || '')}</span>`,
      `<h3 class="plv4-section-title">${escapeHtml(item.title || '')}</h3>`,
      `<p class="plv4-section-copy">${escapeHtml(item.detail || '')}</p>`,
      '<div class="plv4-action-row">',
      ...(Array.isArray(item.actions) ? item.actions : []).map((action) => {
        const className = action.primary ? 'plv4-button plv4-button-primary' : 'plv4-button';
        return `<a class="${className}" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || '')}</a>`;
      }),
      '</div>',
      '</article>',
    ].join('')).join('');
  }

  function renderFeed(items, emptyText) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      return `<div class="plv4-empty-state">${escapeHtml(emptyText || 'ยังไม่มีรายการในตอนนี้')}</div>`;
    }
    return rows.map((item) => [
      '<article class="plv4-feed-item">',
      `<div class="plv4-feed-meta">${badge(item.category || item.type || 'info', item.tone || 'info')} ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ''}</div>`,
      `<strong>${escapeHtml(item.title || '')}</strong>`,
      item.detail ? `<p>${escapeHtml(item.detail)}</p>` : '',
      item.action ? `<a class="plv4-inline-link" href="${escapeHtml(item.action.href || '#')}">${escapeHtml(item.action.label || 'เปิดดู')}</a>` : '',
      '</article>',
    ].join('')).join('');
  }

  function renderRailCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="plv4-rail-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="plv4-rail-label">${escapeHtml(item.label || '')}</span>`,
      `<h3 class="plv4-rail-title">${escapeHtml(item.title || '')}</h3>`,
      `<p class="plv4-rail-copy">${escapeHtml(item.body || '')}</p>`,
      item.meta ? `<div class="plv4-rail-meta">${escapeHtml(item.meta)}</div>` : '',
      '</article>',
    ].join('')).join('');
  }

  function renderTable(columns, rows, emptyText) {
    const safeColumns = Array.isArray(columns) ? columns : [];
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
      return `<div class="plv4-empty-state">${escapeHtml(emptyText || 'ยังไม่มีข้อมูล')}</div>`;
    }
    return [
      '<div class="plv4-table-shell"><table class="plv4-table"><thead><tr>',
      safeColumns.map((column) => `<th>${escapeHtml(column.label || '')}</th>`).join(''),
      '</tr></thead><tbody>',
      safeRows.map((row) => [
        '<tr>',
        safeColumns.map((column) => `<td>${column.render(row)}</td>`).join(''),
        '</tr>',
      ].join('')).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function renderKeyValueList(items, emptyText) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      return `<div class="plv4-empty-state">${escapeHtml(emptyText || 'ยังไม่มีข้อมูล')}</div>`;
    }
    return [
      '<div class="plv4-kv-list">',
      ...rows.map((item) => [
        '<div class="plv4-kv-row">',
        `<span class="plv4-kv-key">${escapeHtml(item.label || '')}</span>`,
        `<strong class="plv4-kv-value">${escapeHtml(item.value || '-')}</strong>`,
        '</div>',
      ].join('')),
      '</div>',
    ].join('');
  }

  function renderProductGrid(items) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      return '<div class="plv4-empty-state">ยังไม่มีสินค้าในมุมมองนี้</div>';
    }
    return rows.map((item) => [
      `<article class="plv4-product-card plv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="plv4-product-meta">${badge(item.kind || 'item', item.kind === 'vip' ? 'info' : 'muted')} ${item.requiresSteamLink ? badge('ต้องผูก Steam', 'warning') : ''}</div>`,
      `<h3 class="plv4-section-title">${escapeHtml(item.name || '-')}</h3>`,
      `<p class="plv4-section-copy">${escapeHtml(item.description || 'ไม่มีคำอธิบายเพิ่มเติม')}</p>`,
      `<strong class="plv4-product-price">${escapeHtml(item.price || '-')}</strong>`,
      '<div class="plv4-action-row">',
      `<a class="plv4-button" href="#wallet">${escapeHtml(item.secondaryAction || 'ดูกระเป๋าเงิน')}</a>`,
      `<a class="plv4-button plv4-button-primary" href="#shop">${escapeHtml(item.primaryAction || 'เปิดสินค้า')}</a>`,
      '</div>',
      '</article>',
    ].join('')).join('');
  }

  return {
    badge,
    buildPlayerPortalShell,
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
    renderPlayerBrandMark,
    renderKeyValueList,
    renderNavGroups,
    renderProductGrid,
    renderRailCards,
    renderSummaryStrip,
    renderTable,
    renderTaskGroups,
    toneForStatus,
  };
});
