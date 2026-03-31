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

  function firstNonEmpty(values, fallback = '') {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : fallback;
  }

  function toneForStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['active', 'started', 'running'].includes(normalized)) return 'success';
    if (['scheduled', 'draft', 'queued', 'pending'].includes(normalized)) return 'warning';
    if (['ended', 'closed', 'finished'].includes(normalized)) return 'muted';
    return 'info';
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

  function createTenantEventsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const rows = Array.isArray(state?.events) ? state.events : [];
    const activeCount = rows.filter((row) => String(row?.status || '').trim().toLowerCase() === 'active').length;
    const locked = Boolean(state?.featureEntitlements?.actions?.can_manage_events?.locked);
    const lockReason = String(state?.featureEntitlements?.actions?.can_manage_events?.reason || '').trim();

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Events',
        subtitle: 'Create, schedule, activate, and close community events from one workspace.',
        statusChips: [
          { label: `${formatNumber(rows.length)} events tracked`, tone: 'info' },
          { label: `${formatNumber(activeCount)} active`, tone: activeCount ? 'success' : 'muted' },
          { label: locked ? 'package locked' : 'management ready', tone: locked ? 'warning' : 'success' },
        ],
        primaryAction: { label: 'Create event', href: '#event-create' },
      },
      summaryStrip: [
        { label: 'Active now', value: formatNumber(activeCount), detail: 'Events already open to players', tone: activeCount ? 'success' : 'muted' },
        { label: 'Planned', value: formatNumber(rows.filter((row) => String(row?.status || '').trim().toLowerCase() !== 'active').length), detail: 'Scheduled or closed events in the list', tone: 'info' },
        { label: 'Participants', value: formatNumber(rows.reduce((sum, row) => sum + Number(Array.isArray(row?.participants) ? row.participants.length : 0), 0)), detail: 'Known participants across visible events', tone: 'info' },
        { label: 'Status', value: locked ? 'Locked' : 'Ready', detail: locked ? lockReason || 'Upgrade package to manage events.' : 'Create and operate events from this page.', tone: locked ? 'warning' : 'success' },
      ],
      partialNote: 'Create, update, activate, and deactivate are available here. Player join flows still happen outside this admin page.',
      locked,
      lockReason,
      events: rows.map((row) => ({
        id: firstNonEmpty([row?.id], ''),
        name: firstNonEmpty([row?.name, 'Untitled event']),
        time: firstNonEmpty([row?.time, '-']),
        reward: firstNonEmpty([row?.reward, '-']),
        status: firstNonEmpty([row?.status, 'draft']),
        participantsCount: Array.isArray(row?.participants) ? row.participants.length : 0,
      })),
    };
  }

  function buildTenantEventsV4Html(model) {
    const safe = model || createTenantEventsV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div>`,
      '</div></div></header>',
      '<div class="tdv4-shell">',
      `<aside class="tdv4-sidebar">${(Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups : []).map(renderNavGroup).join('')}</aside>`,
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p>`,
      `<div class="tdv4-chip-row">${safe.header.statusChips.map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div>`,
      '</div>',
      `<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="${escapeHtml(safe.header.primaryAction.href)}">${escapeHtml(safe.header.primaryAction.label)}</a></div>`,
      '</section>',
      `<section class="tdv4-kpi-strip">${safe.summaryStrip.map(renderSummaryCard).join('')}</section>`,
      `<section class="tdv4-panel tdv4-tone-${safe.locked ? 'warning' : 'info'}"><div class="tdv4-section-kicker">Partial</div><h2 class="tdv4-section-title">Event management scope</h2><p class="tdv4-section-copy">${escapeHtml(safe.partialNote)}</p>${safe.locked ? `<div class="tdv4-chip-row">${renderBadge(safe.lockReason || 'Locked by package', 'warning')}</div>` : ''}</section>`,
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" id="event-create">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Create event</h2>',
      '<p class="tdv4-section-copy">Set the event name, schedule, and reward before opening it to players.</p>',
      '<form class="tdv4-runtime-form" data-tenant-event-form>',
      '<div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Event name</div><div class="tdv4-basic-field-detail">Visible label for staff and players</div></div><input class="tdv4-basic-input" type="text" name="name" placeholder="Weekend arena"></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Schedule</div><div class="tdv4-basic-field-detail">Free-form schedule text used by the current backend</div></div><input class="tdv4-basic-input" type="text" name="time" placeholder="2026-04-02 20:00 ICT"></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Reward</div><div class="tdv4-basic-field-detail">Player-facing reward summary</div></div><input class="tdv4-basic-input" type="text" name="reward" placeholder="5,000 coins + VIP crate"></label>',
      '</div>',
      `<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-event-create${safe.locked ? ' disabled' : ''}>Create event</button></div>`,
      '</form>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Existing events</h2>',
      '<p class="tdv4-section-copy">Update the schedule and reward, then activate or close events here as needed.</p>',
      safe.events.length
        ? safe.events.map((row) => [
            `<article class="tdv4-panel tdv4-tone-${escapeHtml(toneForStatus(row.status))}" data-tenant-event-card data-event-id="${escapeHtml(row.id)}">`,
            `<div class="tdv4-section-kicker">Event #${escapeHtml(row.id)}</div>`,
            `<h3 class="tdv4-section-title">${escapeHtml(row.name)}</h3>`,
            `<p class="tdv4-section-copy">Schedule: ${escapeHtml(row.time)} · Reward: ${escapeHtml(row.reward)}</p>`,
            `<div class="tdv4-chip-row">${renderBadge(row.status, toneForStatus(row.status))}${renderBadge(`${formatNumber(row.participantsCount)} participants`, 'info')}</div>`,
            '<div class="tdv4-runtime-form-fields">',
            `<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Event name</div><div class="tdv4-basic-field-detail">Update the player-facing event title</div></div><input class="tdv4-basic-input" type="text" data-event-name value="${escapeHtml(row.name)}"></label>`,
            `<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Schedule</div><div class="tdv4-basic-field-detail">Free-form schedule text used by the backend</div></div><input class="tdv4-basic-input" type="text" data-event-time value="${escapeHtml(row.time)}"></label>`,
            `<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Reward</div><div class="tdv4-basic-field-detail">Player-facing reward summary</div></div><input class="tdv4-basic-input" type="text" data-event-reward value="${escapeHtml(row.reward)}"></label>`,
            '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Winner user ID</div><div class="tdv4-basic-field-detail">Optional when closing the event</div></div><input class="tdv4-basic-input" type="text" data-event-winner-user-id placeholder="discord user id"></label>',
            '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Reward coins</div><div class="tdv4-basic-field-detail">Optional coin grant when ending the event</div></div><input class="tdv4-basic-input" type="number" min="0" step="1" value="0" data-event-reward-coins></label>',
            '</div>',
            '<div class="tdv4-action-list">',
            `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-event-action="update" data-event-id="${escapeHtml(row.id)}"${safe.locked ? ' disabled' : ''}>Save details</button>`,
            `<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-event-action="start" data-event-id="${escapeHtml(row.id)}"${safe.locked ? ' disabled' : ''}>Activate event</button>`,
            `<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-event-action="end" data-event-id="${escapeHtml(row.id)}"${safe.locked ? ' disabled' : ''}>Deactivate event</button>`,
            '</div>',
            '</article>',
          ].join('')).join('')
        : '<div class="tdv4-empty-state"><strong>No events yet</strong><p>Create the first event from the form on the left.</p></div>',
      '</section>',
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
