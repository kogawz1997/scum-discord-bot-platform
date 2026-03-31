(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantSettingsV4 = factory();
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
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : (fallback || '0');
  }

  function formatDateTime(value, fallback) {
    if (!value) return fallback || 'No data yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? (fallback || 'No data yet')
      : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

  function stringifyJson(value) {
    try {
      return JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2);
    } catch {
      return '{}';
    }
  }

  function createTenantSettingsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const tenantConfig = state.tenantConfig && typeof state.tenantConfig === 'object' ? state.tenantConfig : {};
    const links = Array.isArray(state.serverDiscordLinks) ? state.serverDiscordLinks : [];
    const servers = Array.isArray(state.servers) ? state.servers : [];

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state.tenantLabel,
          tenantConfig.name,
          state.overview && state.overview.tenantName,
          state.me && state.me.tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state.__surfaceShell && state.__surfaceShell.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Settings',
        subtitle: 'Save tenant-level config patches and keep Discord integration details in one place.',
        statusChips: [
          { label: tenantConfig.previewMode ? 'preview mode' : 'live tenant', tone: tenantConfig.previewMode ? 'warning' : 'success' },
          { label: formatNumber(links.length) + ' Discord links', tone: links.length ? 'info' : 'muted' },
        ],
      },
      summaryStrip: [
        { label: 'Config patch keys', value: formatNumber(Object.keys(tenantConfig.configPatch || {}).length), detail: 'Tenant-scoped config values currently saved', tone: 'info' },
        { label: 'Portal env keys', value: formatNumber(Object.keys(tenantConfig.portalEnvPatch || {}).length), detail: 'Player portal environment values for this tenant', tone: 'info' },
        { label: 'Feature flags', value: formatNumber(Object.keys(tenantConfig.featureFlags || {}).length), detail: 'Visible here but usually managed from Bot Modules', tone: 'info' },
        { label: 'Discord links', value: formatNumber(links.length), detail: links.length ? 'Server to guild mappings already saved' : 'No Discord guild mapping saved yet', tone: links.length ? 'success' : 'warning' },
      ],
      configPatchJson: stringifyJson(tenantConfig.configPatch),
      portalEnvPatchJson: stringifyJson(tenantConfig.portalEnvPatch),
      links: links.map(function (row) {
        return {
          serverId: firstNonEmpty([row.serverId], '-'),
          guildId: firstNonEmpty([row.guildId], '-'),
          status: firstNonEmpty([row.status], 'active'),
          updatedAt: formatDateTime(firstNonEmpty([row.updatedAt, row.createdAt], ''), 'No updates yet'),
        };
      }),
      hasServerOptions: servers.length > 0,
      serverOptions: servers.map(function (row) {
        return {
          id: firstNonEmpty([row.id], ''),
          label: firstNonEmpty([row.name, row.slug, row.id], 'Server'),
        };
      }),
    };
  }

  function buildTenantSettingsV4Html(model) {
    const safe = model || createTenantSettingsV4Model({});
    const discordLinkDisabled = !safe.hasServerOptions;
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="#tenant-settings-form">Save workspace settings</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" id="tenant-settings-form">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Save workspace settings</h2>',
      '<p class="tdv4-section-copy">These JSON patches are saved through the tenant config service. The page does not write directly to the filesystem.</p>',
      '<form class="tdv4-runtime-form" data-tenant-settings-form>',
      '<div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field tdv4-form-field-span"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Tenant config patch</div><div class="tdv4-basic-field-detail">Tenant-scoped config values saved by the control plane</div></div><textarea class="tdv4-editor" data-tenant-settings-config-patch rows="10">' + escapeHtml(safe.configPatchJson) + '</textarea></label>',
      '<label class="tdv4-basic-field tdv4-form-field-span"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Portal env patch</div><div class="tdv4-basic-field-detail">Values used by the player-facing portal for this tenant</div></div><textarea class="tdv4-editor" data-tenant-settings-portal-env-patch rows="10">' + escapeHtml(safe.portalEnvPatchJson) + '</textarea></label>',
      '</div>',
      '<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-settings-save>Save workspace settings</button></div>',
      '</form>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Add Discord link</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(discordLinkDisabled
        ? 'Add or assign a server first, then link the Discord guild for tenant notifications.'
        : 'Create a server-to-guild mapping for tenant notifications and community tooling.') + '</p>',
      '<div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Server</div><div class="tdv4-basic-field-detail">Server that will use this Discord guild mapping</div></div><select class="tdv4-basic-input" data-server-discord-link-server' + (discordLinkDisabled ? ' disabled' : '') + '><option value="">' + escapeHtml(discordLinkDisabled ? 'No server yet' : 'Choose server') + '</option>' + safe.serverOptions.map(function (row) { return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.label) + '</option>'; }).join('') + '</select></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Guild ID</div><div class="tdv4-basic-field-detail">Discord guild that should receive tenant-side notifications</div></div><input class="tdv4-basic-input" type="text" data-server-discord-link-guild placeholder="123456789012345678"' + (discordLinkDisabled ? ' disabled' : '') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Status</div><div class="tdv4-basic-field-detail">Current state for this mapping</div></div><select class="tdv4-basic-input" data-server-discord-link-status' + (discordLinkDisabled ? ' disabled' : '') + '><option value="active">active</option><option value="disabled">disabled</option></select></label>',
      '</div>',
      '<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-secondary" type="button" data-server-discord-link-create' + (discordLinkDisabled ? ' disabled title="Add a server before saving a Discord link."' : '') + '>Save Discord link</button></div>',
      '</section>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Current Discord links</h2>',
      safe.links.length ? safe.links.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-info"><div class="tdv4-list-main"><strong>Server ' + escapeHtml(row.serverId) + ' -> Guild ' + escapeHtml(row.guildId) + '</strong><p>Updated ' + escapeHtml(row.updatedAt) + '</p></div><div class="tdv4-chip-row">' + renderBadge(row.status, row.status === 'active' ? 'success' : 'warning') + '</div></article>';
      }).join('') : '<div class="tdv4-empty-state"><strong>No Discord links yet</strong><p>' + escapeHtml(discordLinkDisabled ? 'Add a server first, then save the first guild mapping from the form above.' : 'Save the first guild mapping from the form above.') + '</p></div>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantSettingsV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantSettingsV4 requires a root element');
    const model = source && source.header && Array.isArray(source.links)
      ? source
      : createTenantSettingsV4Model(source);
    rootElement.innerHTML = buildTenantSettingsV4Html(model);
    return model;
  }

  return {
    buildTenantSettingsV4Html: buildTenantSettingsV4Html,
    createTenantSettingsV4Model: createTenantSettingsV4Model,
    renderTenantSettingsV4: renderTenantSettingsV4,
  };
});
