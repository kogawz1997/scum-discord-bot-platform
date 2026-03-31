(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantPlayersV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const NAV_GROUPS = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Server status', href: '#server-status' },
        { label: 'Restart control', href: '#restart-control' },
      ],
    },
    {
      label: 'Commerce and players',
      items: [
        { label: 'Orders', href: '#orders' },
        { label: 'Delivery', href: '#delivery' },
        { label: 'Players', href: '#players', current: true },
      ],
    },
    {
      label: 'Runtime and evidence',
      items: [
        { label: 'Server config', href: '#server-config' },
        { label: 'Server Bot', href: '#server-bots' },
        { label: 'Delivery Agent', href: '#delivery-agents' },
        { label: 'Audit', href: '#audit' },
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

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return new Intl.NumberFormat('en-US').format(numeric);
  }

  function formatDateTime(value) {
    if (!value) return 'No data yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No data yet';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function firstNonEmpty(values, fallback = '') {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function playerStatusLabel(player) {
    if (player?.isActive === false) return 'inactive';
    return 'active';
  }

  function toneForStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['active', 'linked', 'verified'].includes(normalized)) return 'success';
    if (['warning', 'needs-support', 'missing-steam', 'invited'].includes(normalized)) return 'warning';
    if (['inactive', 'failed', 'error', 'revoked', 'disabled'].includes(normalized)) return 'danger';
    return 'muted';
  }

  function extractPlayerName(player) {
    return firstNonEmpty([
      player?.displayName,
      player?.username,
      player?.user,
      player?.discordName,
      player?.discordId,
      'Unknown player',
    ]);
  }

  function extractTenantName(state) {
    return firstNonEmpty([
      state?.tenantConfig?.name,
      state?.overview?.tenantName,
      state?.me?.tenantId,
      'Tenant workspace',
    ]);
  }

  function buildSelectedPlayer(state) {
    const players = Array.isArray(state?.players) ? state.players : [];
    const selected = players[0] || null;
    if (!selected) return null;

    const userId = firstNonEmpty([selected?.discordId, selected?.userId, selected?.id]);
    const purchases = Array.isArray(state?.purchaseLookup?.items)
      ? state.purchaseLookup.items.filter((item) => String(item?.userId || item?.discordId || '').trim() === userId)
      : [];
    const lastPurchase = purchases[0] || null;

    return {
      name: extractPlayerName(selected),
      discordId: firstNonEmpty([selected?.discordId, selected?.userId, '-']),
      steamId: firstNonEmpty([selected?.steamId, '-']),
      inGameName: firstNonEmpty([selected?.inGameName, selected?.steamName, '-']),
      status: playerStatusLabel(selected),
      updatedAt: formatDateTime(selected?.updatedAt || selected?.createdAt),
      linked: Boolean(selected?.steamId || selected?.steam?.id),
      lastPurchase,
      recentDeliveryIssue: state?.deliveryCase && String(state.deliveryCase?.purchase?.userId || '').trim() === userId
        ? firstNonEmpty([state.deliveryCase?.deadLetter?.reason, state.deliveryCase?.latestCommandSummary, 'Open delivery case'])
        : '',
    };
  }

  function createTenantPlayersV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantName = extractTenantName(state);
    const players = Array.isArray(state?.players) ? state.players : [];
    const linkedCount = players.filter((item) => item?.steamId || item?.steam?.id).length;
    const activeCount = players.filter((item) => item?.isActive !== false).length;
    const needsSupportCount = players.filter((item) => (
      !item?.steamId
      || (state?.deliveryCase && String(state.deliveryCase?.purchase?.userId || '').trim() === String(item?.discordId || item?.userId || '').trim())
    )).length;
    const selected = buildSelectedPlayer(state);
    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: tenantName,
        environmentLabel: 'Tenant workspace',
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups)
          ? state.__surfaceShell.navGroups
          : NAV_GROUPS,
      },
      header: {
        title: 'Players',
        subtitle: 'Search player identity, inspect linked accounts, and keep support context nearby.',
        statusChips: [
          { label: `${formatNumber(players.length, '0')} players known`, tone: 'info' },
          { label: `${formatNumber(linkedCount, '0')} linked to Steam`, tone: 'success' },
          { label: `${formatNumber(needsSupportCount, '0')} may need support`, tone: needsSupportCount > 0 ? 'warning' : 'muted' },
        ],
        primaryAction: { label: 'Search players', href: '#player-search' },
      },
      summaryStrip: [
        { label: 'Players known', value: formatNumber(players.length, '0'), detail: 'Accounts visible inside this tenant workspace', tone: 'info' },
        { label: 'Steam linked', value: formatNumber(linkedCount, '0'), detail: 'Useful before looking at orders or delivery evidence', tone: 'success' },
        { label: 'Still active', value: formatNumber(activeCount, '0'), detail: 'Players the workspace still sees as active', tone: 'success' },
        { label: 'Need support', value: formatNumber(needsSupportCount, '0'), detail: 'Missing Steam link or still attached to a delivery issue', tone: needsSupportCount > 0 ? 'warning' : 'muted' },
      ],
      players: players.map((row) => ({
        name: extractPlayerName(row),
        discordId: firstNonEmpty([row?.discordId, row?.userId, '-']),
        steam: firstNonEmpty([row?.steamId, row?.inGameName, '-']),
        status: playerStatusLabel(row),
        updatedAt: formatDateTime(row?.updatedAt || row?.createdAt),
      })),
      selected,
      railCards: [
        {
          title: 'Support shortcuts',
          body: 'Wallet, Steam, orders, and delivery evidence stay one click away.',
          meta: 'Use this page as the starting point when identity, commerce, or delivery signals disagree.',
          tone: 'info',
        },
        {
          title: 'Next best action',
          body: selected
            ? `${selected.name} · ${selected.linked ? 'linked already' : 'still missing Steam'}`
            : 'Choose a player from the table first',
          meta: selected?.recentDeliveryIssue
            ? `Delivery signal: ${selected.recentDeliveryIssue}`
            : 'Open order history or wallet support for the selected player next.',
          tone: selected?.recentDeliveryIssue ? 'warning' : 'muted',
        },
        {
          title: 'Team access moved',
          body: 'Manage invites, roles, and access from the dedicated team pages.',
          meta: 'Use Staff for invitations and user access. Use Roles for the permission matrix.',
          tone: 'info',
        },
      ],
    };
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return [
      '<section class="tdv4-nav-group">',
      `<div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div>`,
      '<div class="tdv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items.map((item) => {
        const currentClass = item.current ? ' tdv4-nav-link-current' : '';
        return `<a class="tdv4-nav-link${currentClass}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`;
      }) : []),
      '</div>',
      '</section>',
    ].join('');
  }

  function renderSummaryCard(item) {
    return [
      `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-kpi-label">${escapeHtml(item.label)}</div>`,
      `<div class="tdv4-kpi-value">${escapeHtml(item.value)}</div>`,
      `<div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div>`,
      '</article>',
    ].join('');
  }

  function renderPlayerRow(row, selectedId) {
    const current = row.discordId === selectedId ? ' tdv4-data-row-current' : '';
    return [
      `<article class="tdv4-data-row${current}">`,
      `<div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong></div>`,
      `<div class="code">${escapeHtml(row.discordId)}</div>`,
      `<div>${escapeHtml(row.steam)}</div>`,
      `<div>${renderBadge(row.status, toneForStatus(row.status))}</div>`,
      `<div class="code">${escapeHtml(row.updatedAt)}</div>`,
      '</article>',
    ].join('');
  }

  function renderRailCard(item) {
    return [
      `<article class="tdv4-panel tdv4-rail-card tdv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<div class="tdv4-rail-title">${escapeHtml(item.title)}</div>`,
      `<strong class="tdv4-rail-body">${escapeHtml(item.body)}</strong>`,
      `<div class="tdv4-rail-detail">${escapeHtml(item.meta)}</div>`,
      '</article>',
    ].join('');
  }

  function renderOptionList(values, selectedValue) {
    const normalizedSelected = String(selectedValue || '').trim().toLowerCase();
    return (Array.isArray(values) ? values : []).map((value) => {
      const normalizedValue = String(value || '').trim();
      const selected = normalizedValue.toLowerCase() === normalizedSelected ? ' selected' : '';
      return `<option value="${escapeHtml(normalizedValue)}"${selected}>${escapeHtml(normalizedValue)}</option>`;
    }).join('');
  }

  function renderStaffCard(entry, staffConfig) {
    const canManage = Boolean(staffConfig?.canManage);
    const revoked = String(entry?.status || '').trim().toLowerCase() === 'revoked';
    const disabled = !canManage || revoked ? ' disabled' : '';
    return [
      `<article class="tdv4-panel tdv4-staff-card" data-tenant-staff-card data-membership-id="${escapeHtml(entry.membershipId)}" data-user-id="${escapeHtml(entry.userId)}">`,
      '<div class="tdv4-staff-card-head">',
      `<div class="tdv4-data-main"><strong>${escapeHtml(entry.displayName)}</strong><span class="tdv4-kpi-detail">${escapeHtml(entry.email)}</span></div>`,
      `<div class="tdv4-chip-row">${renderBadge(entry.role, 'info')}${renderBadge(entry.status, toneForStatus(entry.status))}${entry.isPrimary ? renderBadge('primary', 'success') : ''}</div>`,
      '</div>',
      `<div class="tdv4-kpi-detail">Invited ${escapeHtml(entry.invitedAt)} · Updated ${escapeHtml(entry.updatedAt)} · Locale ${escapeHtml(entry.locale)}</div>`,
      '<div class="tdv4-staff-controls">',
      '<label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Role</span>',
      `<select class="tdv4-basic-input" data-tenant-staff-role${disabled}>${renderOptionList(staffConfig?.roleOptions, entry.role)}</select>`,
      '</label>',
      '<label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Status</span>',
      `<select class="tdv4-basic-input" data-tenant-staff-status${disabled}>${renderOptionList(staffConfig?.statusOptions, entry.status)}</select>`,
      '</label>',
      '<label class="tdv4-form-field tdv4-form-field-span"><span class="tdv4-mini-stat-label">Revoke reason</span>',
      `<input class="tdv4-basic-input" type="text" placeholder="Optional note for audit log" data-tenant-staff-revoke-reason${disabled}>`,
      '</label>',
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-staff-role-update${disabled}>Save access</button>`,
      `<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-staff-revoke${disabled}>Revoke</button>`,
      '</div>',
      '</article>',
    ].join('');
  }

  function buildTenantPlayersV4Html(model) {
    const safeModel = model || createTenantPlayersV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar">',
      '<div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safeModel.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '</div>',
      '</div>',
      '<div class="tdv4-topbar-actions">',
      renderBadge(safeModel.shell.environmentLabel, 'info'),
      renderBadge('Players', 'warning'),
      '</div>',
      '</header>',
      '<div class="tdv4-shell tdv4-players-shell">',
      '<aside class="tdv4-sidebar">',
      `<div class="tdv4-sidebar-title">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-sidebar-copy">Player support starts here: identity, orders, delivery evidence, and staff access in one workspace.</div>',
      ...(Array.isArray(safeModel.shell.navGroups) ? safeModel.shell.navGroups.map(renderNavGroup) : []),
      '</aside>',
      '<main class="tdv4-main">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safeModel.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safeModel.header.subtitle)}</p>`,
      '<div class="tdv4-chip-row">',
      ...(Array.isArray(safeModel.header.statusChips) ? safeModel.header.statusChips.map((chip) => renderBadge(chip.label, chip.tone)) : []),
      '</div>',
      '</div>',
      '<div class="tdv4-pagehead-actions">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label)}</a>`,
      '</div>',
      '</section>',
      '<section class="tdv4-kpi-strip tdv4-players-summary-strip">',
      ...(Array.isArray(safeModel.summaryStrip) ? safeModel.summaryStrip.map(renderSummaryCard) : []),
      '</section>',
      '<section class="tdv4-dual-grid tdv4-players-main-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Player registry</div>',
      '<h2 class="tdv4-section-title">Known players</h2>',
      '<div class="tdv4-data-header"><span>Player</span><span>Discord</span><span>Steam / In-game</span><span>Status</span><span>Updated</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.players) && safeModel.players.length
        ? safeModel.players.map((row) => renderPlayerRow(row, safeModel.selected?.discordId))
        : ['<div class="tdv4-empty-state">No players found for this tenant yet.</div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Selected player</div>',
      '<h2 class="tdv4-section-title">Identity and support context</h2>',
      (safeModel.selected
        ? [
            '<div class="tdv4-selected-player">',
            `<strong>${escapeHtml(safeModel.selected.name)}</strong>`,
            `<div>${renderBadge(safeModel.selected.status, toneForStatus(safeModel.selected.status))}</div>`,
            `<div class="tdv4-kpi-detail">Discord ${escapeHtml(safeModel.selected.discordId)} · Steam ${escapeHtml(safeModel.selected.steamId)} · In-game ${escapeHtml(safeModel.selected.inGameName)}</div>`,
            `<div class="tdv4-kpi-detail">Updated ${escapeHtml(safeModel.selected.updatedAt)}</div>`,
            `<div class="tdv4-chip-row">${renderBadge(safeModel.selected.linked ? 'linked already' : 'missing Steam link', safeModel.selected.linked ? 'success' : 'warning')}${safeModel.selected.recentDeliveryIssue ? renderBadge('delivery issue open', 'warning') : ''}</div>`,
            safeModel.selected.lastPurchase
              ? `<div class="tdv4-kpi-detail">Latest order ${escapeHtml(firstNonEmpty([safeModel.selected.lastPurchase.code, safeModel.selected.lastPurchase.purchaseCode, '-']))} · ${escapeHtml(firstNonEmpty([safeModel.selected.lastPurchase.status, '-']))}</div>`
              : '<div class="tdv4-kpi-detail">No linked order visible for this player yet.</div>',
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state">Choose a player from the table first.</div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Support context</div>',
      '<h2 class="tdv4-section-title">Use this page as the support handoff starting point</h2>',
      '<div class="tdv4-support-grid">',
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Discord</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.selected ? safeModel.selected.discordId : '-')}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Steam</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.selected ? safeModel.selected.steamId : '-')}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Latest issue</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.selected?.recentDeliveryIssue || 'No active issue recorded')}</div></article>`,
      `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Recommended next step</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.selected?.lastPurchase ? 'Open order history or delivery case' : 'Start with identity or Steam linking support')}</div></article>`,
      '</div>',
      '</section>',
      '<section class="tdv4-panel tdv4-staff-panel">',
      '<div class="tdv4-section-kicker">Team access</div>',
      '<h2 class="tdv4-section-title">Manage team access from the dedicated team pages</h2>',
      '<p class="tdv4-page-subtitle">Keep this page focused on player support. Open the Staff page to invite users, and open Roles to review permissions.</p>',
      '<div class="tdv4-action-list">',
      '<a class="tdv4-button tdv4-button-primary" href="/tenant/staff">Open staff</a>',
      '<a class="tdv4-button tdv4-button-secondary" href="/tenant/roles">Open roles &amp; permissions</a>',
      '</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail">',
      '<div class="tdv4-rail-sticky">',
      `<div class="tdv4-rail-header">${escapeHtml(safeModel.shell.workspaceLabel)}</div>`,
      '<div class="tdv4-rail-copy">Keep player support, identity context, and team access close together so escalations do not lose context.</div>',
      ...(Array.isArray(safeModel.railCards) ? safeModel.railCards.map(renderRailCard) : []),
      '</div>',
      '</aside>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantPlayersV4(rootElement, source) {
    if (!rootElement) {
      throw new Error('renderTenantPlayersV4 requires a root element');
    }
    const model = source && source.header && Array.isArray(source.players)
      ? source
      : createTenantPlayersV4Model(source);
    rootElement.innerHTML = buildTenantPlayersV4Html(model);
    return model;
  }

  return {
    buildTenantPlayersV4Html,
    createTenantPlayersV4Model,
    renderTenantPlayersV4,
  };
});
