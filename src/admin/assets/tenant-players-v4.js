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

  function isOwnerScopedTenantView(state) {
    const authTenantId = firstNonEmpty([state?.me?.tenantId], '');
    const scopedTenantId = firstNonEmpty([state?.tenantId], '');
    const role = firstNonEmpty([state?.me?.role], '').toLowerCase();
    return role === 'owner' && !authTenantId && Boolean(scopedTenantId);
  }

  function appendTenantScopeToHref(href, state) {
    const target = firstNonEmpty([href], '');
    if (!target || !target.startsWith('/tenant') || !isOwnerScopedTenantView(state)) return target;
    const tenantId = firstNonEmpty([state?.tenantId], '');
    if (!tenantId) return target;
    const url = new URL(target, 'https://tenant.local');
    url.searchParams.set('tenantId', tenantId);
    return `${url.pathname}${url.search}`;
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
    const requestedUserId = firstNonEmpty([state?.selectedUserId], '');
    const selected = players.find((row) => {
      const rowUserId = firstNonEmpty([row?.discordId, row?.userId, row?.id], '');
      return requestedUserId && rowUserId === requestedUserId;
    }) || players[0] || null;
    if (!selected) return null;

    const userId = firstNonEmpty([selected?.discordId, selected?.userId, selected?.id]);
    const purchases = Array.isArray(state?.purchaseLookup?.items)
      ? state.purchaseLookup.items.filter((item) => String(item?.userId || item?.discordId || '').trim() === userId)
      : [];
    const lastPurchase = purchases[0] || null;

    return {
      userId,
      name: extractPlayerName(selected),
      discordId: firstNonEmpty([selected?.discordId, selected?.userId, '-']),
      steamId: firstNonEmpty([selected?.steamId, '-']),
      inGameName: firstNonEmpty([selected?.inGameName, selected?.steamName, '-']),
      status: playerStatusLabel(selected),
      updatedAt: formatDateTime(selected?.updatedAt || selected?.createdAt),
      linked: Boolean(selected?.steamId || selected?.steam?.id),
      lastPurchase,
      ordersHref: userId
        ? appendTenantScopeToHref(`/tenant/orders?userId=${encodeURIComponent(userId)}`, state)
        : '/tenant/orders',
      deliveryHref: lastPurchase
        ? appendTenantScopeToHref(
          `/tenant/orders?userId=${encodeURIComponent(userId)}&code=${encodeURIComponent(firstNonEmpty([lastPurchase?.code, lastPurchase?.purchaseCode], ''))}`,
          state,
        )
        : (userId ? appendTenantScopeToHref(`/tenant/orders?userId=${encodeURIComponent(userId)}`, state) : '/tenant/orders'),
      recentDeliveryIssue: state?.deliveryCase && String(state.deliveryCase?.purchase?.userId || '').trim() === userId
        ? firstNonEmpty([state.deliveryCase?.deadLetter?.reason, state.deliveryCase?.latestCommandSummary, 'Open delivery case'])
        : '',
    };
  }

  function recommendIdentityAction(issueKey, selected) {
    const normalizedKey = String(issueKey || '').trim().toLowerCase();
    if (normalizedKey === 'steam-mismatch') return 'relink';
    if (normalizedKey === 'link-steam') return 'bind';
    if (normalizedKey === 'verify-email') return 'review';
    if (normalizedKey === 'discord-mismatch') return 'conflict';
    if (normalizedKey === 'membership-required') return 'review';
    if (normalizedKey === 'in-game-pending') return selected?.linked ? 'review' : 'bind';
    return selected?.linked ? 'review' : 'bind';
  }

  function normalizeIdentityIntent(action, selected) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    if (normalizedAction === 'set') return 'bind';
    if (normalizedAction === 'remove' || normalizedAction === 'unbind') return 'unlink';
    if (['bind', 'unlink', 'relink', 'conflict', 'review'].includes(normalizedAction)) {
      return normalizedAction;
    }
    return selected?.linked ? 'review' : 'bind';
  }

  function resolveIdentityActionButtonLabel(intent) {
    switch (String(intent || '').trim().toLowerCase()) {
      case 'bind':
        return 'Prepare Steam bind';
      case 'unlink':
        return 'Prepare Steam unlink';
      case 'relink':
        return 'Prepare Steam relink';
      case 'conflict':
        return 'Review conflict handoff';
      default:
        return 'Review handoff';
    }
  }

  function resolveIdentityIntentSummary(intent) {
    switch (String(intent || '').trim().toLowerCase()) {
      case 'bind':
        return 'Prepare Steam bind';
      case 'unlink':
        return 'Review Steam unlink';
      case 'relink':
        return 'Prepare Steam relink';
      case 'conflict':
        return 'Review identity conflict';
      default:
        return 'Review handoff and linked account evidence';
    }
  }

  function resolveIdentitySubmitLabel(intent, actionValue) {
    const normalizedAction = String(actionValue || '').trim().toLowerCase();
    if (normalizedAction === 'review') {
      if (String(intent || '').trim().toLowerCase() === 'conflict') {
        return 'Record conflict handoff';
      }
      return 'Record support review';
    }
    switch (String(intent || '').trim().toLowerCase()) {
      case 'bind':
        return 'Bind Steam now';
      case 'unlink':
        return 'Unlink Steam now';
      case 'relink':
        return 'Save replacement Steam';
      default:
        return 'Apply identity support action';
    }
  }

  function resolveDefaultWorkflowAction(intent) {
    const normalizedIntent = String(intent || '').trim().toLowerCase();
    if (normalizedIntent === 'review' || normalizedIntent === 'conflict') return 'review';
    if (normalizedIntent === 'unlink') return 'remove';
    return 'set';
  }

  function resolveDefaultFollowupAction(intent, actionValue, selected, issueRows, trail) {
    const latestFollowup = firstNonEmpty([
      trail?.[0]?.followupAction,
    ], '');
    if (latestFollowup) return normalizeIdentityIntent(latestFollowup, selected);
    const normalizedIntent = normalizeIdentityIntent(intent, selected);
    const normalizedAction = String(actionValue || '').trim().toLowerCase();
    if (normalizedAction === 'review') {
      if (normalizedIntent === 'relink') return 'bind';
      if (normalizedIntent === 'conflict') return 'conflict';
      if (normalizedIntent === 'bind') return 'bind';
      if (normalizedIntent === 'unlink') return 'unlink';
      const issueFollowup = Array.isArray(issueRows)
        ? issueRows.find((item) => String(item?.recommendedAction || '').trim())
        : null;
      return issueFollowup ? normalizeIdentityIntent(issueFollowup.recommendedAction, selected) : (selected?.linked ? 'review' : 'bind');
    }
    if (normalizedAction === 'remove') {
      return normalizedIntent === 'relink' ? 'bind' : 'review';
    }
    return 'review';
  }

  function normalizeSupportOutcome(value, fallback = 'reviewing') {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (['resolved', 'pending-verification', 'pending-player-reply', 'reviewing'].includes(normalized)) {
      return normalized;
    }
    return String(fallback || 'reviewing').trim().toLowerCase() || 'reviewing';
  }

  function formatSupportOutcomeLabel(value) {
    switch (normalizeSupportOutcome(value)) {
      case 'resolved':
        return 'Resolved';
      case 'pending-verification':
        return 'Pending verification';
      case 'pending-player-reply':
        return 'Pending player reply';
      default:
        return 'Reviewing';
    }
  }

  function buildIdentitySupportTrail(state, selected) {
    if (!selected?.userId) return [];
    const rows = Array.isArray(state?.notifications) ? state.notifications : [];
    return rows
      .filter((row) => {
        const eventType = firstNonEmpty([row?.data?.eventType, row?.kind], '');
        const userId = firstNonEmpty([row?.data?.userId], '');
        return eventType === 'platform.player.identity.support' && userId === selected.userId;
      })
      .sort((left, right) => {
        const leftTime = new Date(firstNonEmpty([left?.createdAt, left?.updatedAt, left?.data?.occurredAt], 0)).getTime() || 0;
        const rightTime = new Date(firstNonEmpty([right?.createdAt, right?.updatedAt, right?.data?.occurredAt], 0)).getTime() || 0;
        return rightTime - leftTime;
      })
      .slice(0, 4)
      .map((row) => ({
        intent: normalizeIdentityIntent(firstNonEmpty([row?.data?.supportIntent, row?.data?.action], 'review'), selected),
        actionLabel: resolveIdentityActionButtonLabel(firstNonEmpty([row?.data?.supportIntent, row?.data?.action], 'review')),
        outcome: normalizeSupportOutcome(firstNonEmpty([row?.data?.supportOutcome], 'reviewing')),
        outcomeLabel: formatSupportOutcomeLabel(firstNonEmpty([row?.data?.supportOutcome], 'reviewing')),
        reason: firstNonEmpty([row?.data?.supportReason, row?.message], ''),
        source: firstNonEmpty([row?.data?.supportSource, row?.source], 'tenant'),
        actor: firstNonEmpty([row?.data?.actor], 'admin-web'),
        followupAction: normalizeIdentityIntent(firstNonEmpty([row?.data?.followupAction], 'review'), selected),
        at: formatDateTime(firstNonEmpty([row?.createdAt, row?.updatedAt, row?.data?.occurredAt], '')),
      }));
  }

  function buildIdentityWorkflowState(state, selected) {
    const context = state?.selectedPlayerIdentity && typeof state.selectedPlayerIdentity === 'object'
      ? state.selectedPlayerIdentity
      : {};
    const identitySummary = context?.identitySummary && typeof context.identitySummary === 'object'
      ? context.identitySummary
      : {};
    const linkedAccounts = identitySummary?.linkedAccounts && typeof identitySummary.linkedAccounts === 'object'
      ? identitySummary.linkedAccounts
      : {};
    const steamValue = firstNonEmpty([
      linkedAccounts?.steam?.value,
      context?.account?.steamId,
      context?.steamLink?.steamId,
      selected?.steamId && selected.steamId !== '-' ? selected.steamId : '',
    ], '');
    const issueRows = []
      .concat(Array.isArray(identitySummary?.conflicts) ? identitySummary.conflicts.map((item) => ({ ...item, issueType: 'conflict' })) : [])
      .concat(Array.isArray(identitySummary?.attention) ? identitySummary.attention.map((item) => ({ ...item, issueType: 'attention' })) : [])
      .map((item) => ({
        key: firstNonEmpty([item?.key], 'identity-review'),
        issueType: firstNonEmpty([item?.issueType], 'attention'),
        tone: firstNonEmpty([item?.tone], 'warning'),
        title: firstNonEmpty([item?.title], 'Identity review'),
        detail: firstNonEmpty([item?.detail], ''),
        recommendedAction: recommendIdentityAction(item?.key, selected),
      }));

    const trail = buildIdentitySupportTrail(state, selected);
    const latestTrail = trail[0] || null;
    const intent = normalizeIdentityIntent(
      firstNonEmpty([state?.selectedIdentityAction, latestTrail?.intent], ''),
      selected,
    );
    const actionValue = resolveDefaultWorkflowAction(intent);
    const followupAction = resolveDefaultFollowupAction(intent, actionValue, selected, issueRows, trail);
    const outcome = normalizeSupportOutcome(firstNonEmpty([state?.selectedSupportOutcome, latestTrail?.outcome], 'reviewing'));

    return {
      intent,
      actionValue,
      source: firstNonEmpty([state?.selectedSupportSource, latestTrail?.source], ''),
      reason: firstNonEmpty([state?.selectedSupportReason, latestTrail?.reason], ''),
      outcome,
      steamValue,
      linkedAccounts,
      issues: issueRows,
      trail,
      followupAction,
      hasIdentityData: Object.keys(identitySummary).length > 0,
      hasVerifiedEmail: Boolean(linkedAccounts?.email?.linked && linkedAccounts?.email?.verified),
      hasLinkedSteam: Boolean(linkedAccounts?.steam?.linked || steamValue),
      hasInGameProfile: Boolean(linkedAccounts?.inGame?.linked),
      nextStepLabel: resolveIdentityActionButtonLabel(followupAction),
      submitLabel: resolveIdentitySubmitLabel(intent, actionValue),
      outcomeLabel: formatSupportOutcomeLabel(outcome),
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
    const identityWorkflow = buildIdentityWorkflowState(state, selected);
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
        ordersHref: firstNonEmpty([row?.discordId, row?.userId], '')
          ? appendTenantScopeToHref(
            `/tenant/orders?userId=${encodeURIComponent(firstNonEmpty([row?.discordId, row?.userId], ''))}`,
            state,
          )
          : '/tenant/orders',
      })),
      selected,
      identityWorkflow,
      links: {
        staffHref: appendTenantScopeToHref('/tenant/staff', state),
        rolesHref: appendTenantScopeToHref('/tenant/roles', state),
      },
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
      `<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-player-select="${escapeHtml(row.discordId)}">Open context</button><a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(row.ordersHref)}">Open orders</a></div>`,
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

  function renderIdentityIssueCard(item, selectedUserId, supportSource, supportOutcome) {
    const actionLabel = resolveIdentityActionButtonLabel(item?.recommendedAction);
    return [
      `<article class="tdv4-panel tdv4-tone-${escapeHtml(item?.tone || 'warning')}">`,
      `<div class="tdv4-section-kicker">${escapeHtml(item?.issueType === 'conflict' ? 'Identity conflict' : 'Identity attention')}</div>`,
      `<h3 class="tdv4-section-title">${escapeHtml(item?.title || 'Identity review')}</h3>`,
      `<p class="tdv4-section-copy">${escapeHtml(item?.detail || '')}</p>`,
      '<div class="tdv4-action-list">',
      `<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-player-identity-action="${escapeHtml(item?.recommendedAction || 'review')}" data-tenant-player-user-id="${escapeHtml(selectedUserId || '')}" data-tenant-player-support-reason="${escapeHtml(item?.detail || '')}" data-tenant-player-support-source="${escapeHtml(supportSource || 'tenant')}" data-tenant-player-support-outcome="${escapeHtml(supportOutcome || 'reviewing')}">${escapeHtml(actionLabel)}</button>`,
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-player-identity-action="review" data-tenant-player-user-id="${escapeHtml(selectedUserId || '')}" data-tenant-player-support-reason="${escapeHtml(item?.detail || '')}" data-tenant-player-support-source="${escapeHtml(supportSource || 'tenant')}" data-tenant-player-support-outcome="${escapeHtml(supportOutcome || 'reviewing')}">Review handoff</button>`,
      '</div>',
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
    const workflow = safeModel.identityWorkflow || {};
    const selectedUserId = safeModel.selected?.userId || '';
    const identityIssueCards = Array.isArray(workflow.issues) && workflow.issues.length
      ? workflow.issues.map((item) => renderIdentityIssueCard(item, selectedUserId, workflow.source || 'tenant', workflow.outcome || 'reviewing')).join('')
      : '<div class="tdv4-empty-state">No identity conflicts or recovery warnings are active for this player right now.</div>';
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
      '<div class="tdv4-data-header"><span>Player</span><span>Discord</span><span>Steam / In-game</span><span>Status</span><span>Updated</span><span>Actions</span></div>',
      '<div class="tdv4-data-table">',
      ...(Array.isArray(safeModel.players) && safeModel.players.length
        ? safeModel.players.map((row) => renderPlayerRow(row, safeModel.selected?.discordId))
        : ['<div class="tdv4-empty-state">No players found for this tenant yet.</div>']),
      '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Primary action</div>',
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
            `<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="button" data-tenant-player-open-orders="${escapeHtml(safeModel.selected.userId)}">Open order history</button><a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(safeModel.selected.deliveryHref)}">Open delivery case</a><button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-player-identity-action="${escapeHtml(workflow.hasLinkedSteam ? 'remove' : 'set')}" data-tenant-player-user-id="${escapeHtml(safeModel.selected.userId)}" data-tenant-player-support-reason="${escapeHtml(workflow.reason || safeModel.selected.recentDeliveryIssue || '')}" data-tenant-player-support-source="${escapeHtml(workflow.source || 'tenant')}" data-tenant-player-support-outcome="${escapeHtml(workflow.outcome || 'reviewing')}">${escapeHtml(workflow.hasLinkedSteam ? 'Prepare unlink / relink' : 'Prepare Steam bind')}</button></div>`,
            '</div>',
          ].join('')
        : '<div class="tdv4-empty-state">Choose a player from the table first.</div>'),
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Identity ops</div>',
      '<h2 class="tdv4-section-title">Review, relink, or hand off without leaving the player workspace</h2>',
      `<p class="tdv4-page-subtitle">${escapeHtml(workflow.reason ? 'Owner or support handoff context is attached to this player already. Review the note, then run Steam bind or unlink actions from the same page.' : 'Keep the handoff note, Steam operation, and player order context together so support does not lose the trail mid-escalation.')}</p>`,
      (safeModel.selected
        ? [
            workflow.reason
              ? `<div class="tdv4-empty-state" data-tenant-player-handoff><strong>${escapeHtml(workflow.source ? `${workflow.source} handoff` : 'Support handoff')}</strong><p>${escapeHtml(workflow.reason)}</p></div>`
              : '<div class="tdv4-empty-state" data-tenant-player-handoff><strong>No handoff note is attached yet.</strong><p>Use the quick actions below to prepare Steam bind/unlink work or keep reviewing the selected player.</p></div>',
            '<div class="tdv4-support-grid">',
            `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Discord</div><div class="tdv4-mini-stat-value">${escapeHtml(safeModel.selected.discordId)}</div></article>`,
            `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Steam</div><div class="tdv4-mini-stat-value">${escapeHtml(workflow.steamValue || safeModel.selected.steamId || '-')}</div></article>`,
            `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Verified email</div><div class="tdv4-mini-stat-value">${escapeHtml(workflow.hasVerifiedEmail ? 'ready' : 'needs review')}</div></article>`,
            `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Support outcome</div><div class="tdv4-mini-stat-value">${escapeHtml(workflow.outcomeLabel || 'Reviewing')}</div></article>`,
            `<article class="tdv4-mini-stat"><div class="tdv4-mini-stat-label">Recommended next step</div><div class="tdv4-mini-stat-value">${escapeHtml(workflow.nextStepLabel || 'Review handoff and linked account evidence')}</div></article>`,
            '</div>',
            '<div class="tdv4-action-list">',
            `<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-player-identity-action="${escapeHtml(workflow.intent || (workflow.hasLinkedSteam ? 'review' : 'bind'))}" data-tenant-player-user-id="${escapeHtml(safeModel.selected.userId)}" data-tenant-player-support-reason="${escapeHtml(workflow.reason || '')}" data-tenant-player-support-source="${escapeHtml(workflow.source || 'tenant')}" data-tenant-player-support-outcome="${escapeHtml(workflow.outcome || 'reviewing')}">${escapeHtml(resolveIdentityActionButtonLabel(workflow.intent || (workflow.hasLinkedSteam ? 'review' : 'bind')))}</button>`,
            `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-player-identity-action="unlink" data-tenant-player-user-id="${escapeHtml(safeModel.selected.userId)}" data-tenant-player-support-reason="${escapeHtml(workflow.reason || '')}" data-tenant-player-support-source="${escapeHtml(workflow.source || 'tenant')}" data-tenant-player-support-outcome="${escapeHtml(workflow.outcome || 'reviewing')}">Prepare Steam unlink</button>`,
            `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-player-identity-action="review" data-tenant-player-user-id="${escapeHtml(safeModel.selected.userId)}" data-tenant-player-support-reason="${escapeHtml(workflow.reason || safeModel.selected.recentDeliveryIssue || '')}" data-tenant-player-support-source="${escapeHtml(workflow.source || 'tenant')}" data-tenant-player-support-outcome="${escapeHtml(workflow.outcome || 'reviewing')}">Review handoff</button>`,
            '</div>',
            `<div class="tdv4-card-grid" data-tenant-player-identity-issues>${identityIssueCards}</div>`,
            `<form class="tdv4-form-grid" data-tenant-player-support-form>
              <label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Support action</span>
                <select class="tdv4-basic-input" name="action" data-tenant-player-support-action>
                  <option value="review"${workflow.actionValue === 'review' ? ' selected' : ''}>Record review only</option>
                  <option value="set"${workflow.actionValue === 'set' ? ' selected' : ''}>Bind Steam</option>
                  <option value="remove"${workflow.actionValue === 'remove' ? ' selected' : ''}>Unlink Steam</option>
                </select>
              </label>
              <label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Discord user</span>
                <input class="tdv4-basic-input" type="text" name="userId" value="${escapeHtml(safeModel.selected.userId)}" readonly>
              </label>
              <label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Steam ID</span>
                <input class="tdv4-basic-input" type="text" name="steamId" value="${escapeHtml(workflow.steamValue || '')}" placeholder="7656119..." data-tenant-player-support-steam>
              </label>
              <label class="tdv4-form-field"><span class="tdv4-mini-stat-label">In-game name</span>
                <input class="tdv4-basic-input" type="text" name="inGameName" value="${escapeHtml(safeModel.selected.inGameName && safeModel.selected.inGameName !== '-' ? safeModel.selected.inGameName : '')}">
              </label>
              <label class="tdv4-form-field tdv4-form-field-span"><span class="tdv4-mini-stat-label">Handoff note</span>
                <textarea class="tdv4-basic-input" name="supportReason" rows="3" data-tenant-player-support-reason>${escapeHtml(workflow.reason || '')}</textarea>
              </label>
              <label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Support outcome</span>
                <select class="tdv4-basic-input" name="supportOutcome">
                  <option value="reviewing"${workflow.outcome === 'reviewing' ? ' selected' : ''}>Reviewing</option>
                  <option value="resolved"${workflow.outcome === 'resolved' ? ' selected' : ''}>Resolved</option>
                  <option value="pending-verification"${workflow.outcome === 'pending-verification' ? ' selected' : ''}>Pending verification</option>
                  <option value="pending-player-reply"${workflow.outcome === 'pending-player-reply' ? ' selected' : ''}>Pending player reply</option>
                </select>
              </label>
              <label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Next step</span>
                <select class="tdv4-basic-input" name="followupAction">
                  <option value="review"${workflow.followupAction === 'review' ? ' selected' : ''}>Review handoff</option>
                  <option value="bind"${workflow.followupAction === 'bind' ? ' selected' : ''}>Prepare Steam bind</option>
                  <option value="unlink"${workflow.followupAction === 'unlink' ? ' selected' : ''}>Prepare Steam unlink</option>
                  <option value="relink"${workflow.followupAction === 'relink' ? ' selected' : ''}>Prepare Steam relink</option>
                  <option value="conflict"${workflow.followupAction === 'conflict' ? ' selected' : ''}>Review conflict handoff</option>
                </select>
              </label>
              <input type="hidden" name="supportIntent" value="${escapeHtml(workflow.intent || 'review')}">
              <input type="hidden" name="supportSource" value="${escapeHtml(workflow.source || 'tenant')}">
              <div class="tdv4-action-list">
                <button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-player-support-submit>${escapeHtml(workflow.submitLabel || 'Apply identity support action')}</button>
                <button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-player-open-orders="${escapeHtml(safeModel.selected.userId)}">Open order history</button>
              </div>
            </form>`,
            (Array.isArray(workflow.trail) && workflow.trail.length
              ? [
                  '<div class="tdv4-card-grid" data-tenant-player-support-trail>',
                  ...workflow.trail.map((entry) => [
                    '<article class="tdv4-panel tdv4-tone-info">',
                    '<div class="tdv4-section-kicker">Recent support trail</div>',
                    `<h3 class="tdv4-section-title">${escapeHtml(entry.actionLabel)}</h3>`,
                    `<p class="tdv4-section-copy">${escapeHtml(entry.reason || 'No handoff note recorded.')}</p>`,
                    `<div class="tdv4-chip-row">${renderBadge(entry.outcomeLabel, 'info')}${renderBadge(entry.source, 'muted')}${entry.followupAction ? renderBadge(`Next ${resolveIdentityActionButtonLabel(entry.followupAction)}`, 'warning') : ''}</div>`,
                    `<div class="tdv4-kpi-detail">${escapeHtml(`Actor ${entry.actor} · ${entry.at}`)}</div>`,
                    '</article>',
                  ].join('')),
                  '</div>',
                ].join('')
              : '<div class="tdv4-empty-state" data-tenant-player-support-trail><strong>No support trail recorded yet.</strong><p>Once review, bind, or unlink actions are submitted from this workspace, the latest support trail will appear here.</p></div>'),
          ].join('')
        : '<div class="tdv4-empty-state">Choose a player from the table first.</div>'),
      '</section>',
      '<section class="tdv4-panel tdv4-staff-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Manage team access from the dedicated team pages</h2>',
      '<p class="tdv4-page-subtitle">Keep this page focused on player support. Open the Staff page to invite users, and open Roles to review permissions.</p>',
      '<div class="tdv4-action-list">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safeModel.links?.staffHref || '/tenant/staff')}">Open staff</a>`,
      `<a class="tdv4-button tdv4-button-secondary" href="${escapeHtml(safeModel.links?.rolesHref || '/tenant/roles')}">Open roles &amp; permissions</a>`,
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
