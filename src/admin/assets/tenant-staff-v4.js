(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantStaffV4 = factory();
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

  function toneForStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['active', 'accepted'].includes(normalized)) return 'success';
    if (['invited', 'pending'].includes(normalized)) return 'warning';
    if (['revoked', 'disabled'].includes(normalized)) return 'danger';
    return 'muted';
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

  function renderOptionList(values, selectedValue) {
    const selected = String(selectedValue || '').trim().toLowerCase();
    return (Array.isArray(values) ? values : []).map(function (value) {
      const text = String(value || '').trim();
      return '<option value="' + escapeHtml(text) + '"' + (text.toLowerCase() === selected ? ' selected' : '') + '>' + escapeHtml(text) + '</option>';
    }).join('');
  }

  function humanizeRole(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'Viewer';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function createRoleMatrixRows(state) {
    const rows = Array.isArray(state.tenantRoleMatrix && state.tenantRoleMatrix.roles)
      ? state.tenantRoleMatrix.roles
      : [];
    if (!rows.length) {
      return [
        { role: 'owner', label: 'Owner', description: 'Full tenant control.', permissionLabels: [], permissionKeys: [], manageableRoles: ['owner', 'admin', 'staff', 'viewer'], assignableRoles: ['owner', 'admin', 'staff', 'viewer'] },
        { role: 'admin', label: 'Admin', description: 'Daily operations control.', permissionLabels: [], permissionKeys: [], manageableRoles: ['staff', 'viewer'], assignableRoles: ['staff', 'viewer'] },
        { role: 'staff', label: 'Staff', description: 'Operational support.', permissionLabels: [], permissionKeys: [], manageableRoles: [], assignableRoles: [] },
        { role: 'viewer', label: 'Viewer', description: 'Read-only access.', permissionLabels: [], permissionKeys: [], manageableRoles: [], assignableRoles: [] },
      ];
    }
    return rows.map(function (row) {
      const permissions = Array.isArray(row.permissions) ? row.permissions : [];
      const enabledPermissions = permissions.filter(function (entry) {
        return Boolean(entry && entry.allowed);
      });
      return {
        role: firstNonEmpty([row.role, 'viewer']).toLowerCase(),
        label: firstNonEmpty([row.label, humanizeRole(row.role)]),
        description: firstNonEmpty([row.description, '']),
        permissionLabels: enabledPermissions.map(function (entry) {
          return firstNonEmpty([entry.label, entry.key], '');
        }).filter(Boolean),
        permissionKeys: enabledPermissions.map(function (entry) {
          return firstNonEmpty([entry.key], '');
        }).filter(Boolean),
        manageableRoles: Array.isArray(row.manageableRoles) ? row.manageableRoles.slice() : [],
        assignableRoles: Array.isArray(row.assignableRoles) ? row.assignableRoles.slice() : [],
      };
    });
  }

  function createCurrentAccessSummary(state, roleMatrixRows) {
    const access = state.tenantRoleMatrix && state.tenantRoleMatrix.currentAccess
      ? state.tenantRoleMatrix.currentAccess
      : state.me && state.me.tenantAccess
        ? state.me.tenantAccess
        : null;
    const role = firstNonEmpty([access && access.role, state.me && state.me.role, 'viewer']).toLowerCase();
    const roleMatrix = (Array.isArray(roleMatrixRows) ? roleMatrixRows : []).find(function (row) {
      return String(row.role || '').trim().toLowerCase() === role;
    }) || null;
    const permissions = access && access.permissions && typeof access.permissions === 'object'
      ? Object.keys(access.permissions).map(function (key) {
        return access.permissions[key] && access.permissions[key].allowed
          ? firstNonEmpty([access.permissions[key].label, key], '')
          : '';
      }).filter(Boolean)
      : (roleMatrix ? roleMatrix.permissionLabels.slice() : []);
    return {
      role: role,
      roleLabel: firstNonEmpty([access && access.roleLabel, roleMatrix && roleMatrix.label, humanizeRole(role)]),
      roleDescription: firstNonEmpty([access && access.roleDescription, roleMatrix && roleMatrix.description, '']),
      permissionLabels: permissions,
      permissionCount: Number(access && access.permissionCount) || permissions.length,
      assignableRoles: Array.isArray(access && access.assignableRoles)
        ? access.assignableRoles.slice()
        : (roleMatrix ? roleMatrix.assignableRoles.slice() : []),
      canManageStaff: Boolean(access && access.permissions && access.permissions.manage_staff && access.permissions.manage_staff.allowed),
      manageStaffDescription: firstNonEmpty([
        access && access.permissions && access.permissions.manage_staff && access.permissions.manage_staff.description,
        'Invite teammates, change roles, disable access, and revoke memberships.',
      ]),
    };
  }

  function createPermissionLabels(row, roleMatrixByRole) {
    const permissions = row && row.access && row.access.permissions && typeof row.access.permissions === 'object'
      ? Object.keys(row.access.permissions).map(function (key) {
        const entry = row.access.permissions[key];
        return entry && entry.allowed ? firstNonEmpty([entry.label, key], '') : '';
      }).filter(Boolean)
      : [];
    if (permissions.length) return permissions;
    const roleEntry = roleMatrixByRole[String(row && row.role || '').trim().toLowerCase()];
    return roleEntry ? roleEntry.permissionLabels.slice() : [];
  }

  function createMembershipRows(state) {
    const roleMatrixRows = createRoleMatrixRows(state);
    const roleMatrixByRole = roleMatrixRows.reduce(function (acc, row) {
      acc[row.role] = row;
      return acc;
    }, {});
    const memberships = Array.isArray(state.staffMemberships) ? state.staffMemberships : [];
    return memberships.map(function (row) {
      const role = firstNonEmpty([row.role, 'viewer']).toLowerCase();
      const status = firstNonEmpty([row.status, 'active']).toLowerCase();
      const management = row.management && typeof row.management === 'object' ? row.management : {};
      const permissionLabels = createPermissionLabels(row, roleMatrixByRole);
      return {
        membershipId: firstNonEmpty([row.membershipId, row.id]),
        userId: firstNonEmpty([row.userId, row.user && row.user.id]),
        displayName: firstNonEmpty([row.displayName, row.user && row.user.displayName, row.primaryEmail, row.email, 'Unknown teammate']),
        email: firstNonEmpty([row.primaryEmail, row.email, '-']),
        role: role,
        status: status,
        locale: firstNonEmpty([row.locale, row.user && row.user.locale, 'en']),
        invitedAt: formatDateTime(firstNonEmpty([row.invitedAt, row.createdAt], ''), 'No invite time'),
        updatedAt: formatDateTime(firstNonEmpty([row.updatedAt, row.acceptedAt, row.createdAt], ''), 'No updates yet'),
        isPrimary: Boolean(row.isPrimary),
        permissionLabels: permissionLabels,
        permissionSummary: permissionLabels.length ? formatNumber(permissionLabels.length) + ' permissions' : 'Read only',
        management: {
          canManage: management.canManage !== false,
          reason: firstNonEmpty([management.reason], ''),
          roleOptions: Array.isArray(management.roleOptions) && management.roleOptions.length
            ? management.roleOptions.slice()
            : [role],
          statusOptions: Array.isArray(management.statusOptions) && management.statusOptions.length
            ? management.statusOptions.slice()
            : [status],
        },
      };
    });
  }

  function createTenantStaffV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const roleMatrixRows = createRoleMatrixRows(state);
    const currentAccess = createCurrentAccessSummary(state, roleMatrixRows);
    const rows = createMembershipRows(state);
    const previewMode = Boolean(
      state.tenantConfig && state.tenantConfig.previewMode
      || state.overview && state.overview.tenantConfig && state.overview.tenantConfig.previewMode
      || state.overview && state.overview.opsState && state.overview.opsState.previewMode
    );
    const manageEntitlement = state.featureEntitlements && state.featureEntitlements.actions && state.featureEntitlements.actions.can_manage_staff;
    const locked = Boolean(manageEntitlement && manageEntitlement.locked);
    const canManage = !previewMode && !locked && currentAccess.canManageStaff;
    const invited = rows.filter(function (row) { return String(row.status || '').trim().toLowerCase() === 'invited'; }).length;
    const active = rows.filter(function (row) { return String(row.status || '').trim().toLowerCase() === 'active'; }).length;
    const disabled = rows.filter(function (row) {
      const status = String(row.status || '').trim().toLowerCase();
      return status === 'disabled' || status === 'revoked';
    }).length;
    const inviteRoleOptions = Array.isArray(currentAccess.assignableRoles) && currentAccess.assignableRoles.length
      ? currentAccess.assignableRoles.slice()
      : [];

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state.tenantLabel,
          state.tenantConfig && state.tenantConfig.name,
          state.overview && state.overview.tenantName,
          state.me && state.me.tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state.__surfaceShell && state.__surfaceShell.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Staff',
        subtitle: 'Invite teammates, assign the right role, and remove access when work changes.',
        statusChips: [
          { label: formatNumber(rows.length) + ' team members', tone: 'info' },
          { label: formatNumber(invited) + ' invited', tone: invited ? 'warning' : 'muted' },
          { label: currentAccess.roleLabel + ' access', tone: 'info' },
          { label: canManage ? 'management ready' : (locked ? 'locked by package' : 'view only'), tone: canManage ? 'success' : 'warning' },
        ],
      },
      canManage: canManage,
      lockReason: firstNonEmpty([
        manageEntitlement && manageEntitlement.reason,
        !currentAccess.canManageStaff ? currentAccess.manageStaffDescription : '',
        previewMode ? 'Preview mode cannot change staff access.' : '',
      ], ''),
      roleOptions: ['owner', 'admin', 'staff', 'viewer'],
      statusOptions: ['active', 'invited', 'disabled', 'revoked'],
      inviteRoleOptions: inviteRoleOptions,
      currentAccess: currentAccess,
      roleMatrixRows: roleMatrixRows,
      summaryStrip: [
        { label: 'Active', value: formatNumber(active), detail: 'People with current access to this tenant', tone: 'success' },
        { label: 'Invited', value: formatNumber(invited), detail: 'People who still need to accept access', tone: invited ? 'warning' : 'muted' },
        { label: 'Disabled', value: formatNumber(disabled), detail: 'Access paused or removed from this tenant', tone: disabled ? 'warning' : 'muted' },
        { label: 'Your access', value: currentAccess.roleLabel, detail: currentAccess.permissionCount ? formatNumber(currentAccess.permissionCount) + ' enabled permissions' : 'Read-only access', tone: currentAccess.permissionCount ? 'info' : 'muted' },
      ],
      memberships: rows,
    };
  }

  function renderStaffCard(entry, model) {
    const rowCanManage = Boolean(model.canManage && entry && entry.management && entry.management.canManage);
    const disabled = rowCanManage ? '' : ' disabled';
    const rowReason = firstNonEmpty([
      !model.canManage ? model.lockReason : '',
      entry && entry.management ? entry.management.reason : '',
    ], '');
    const permissionBadges = entry.permissionLabels.length
      ? entry.permissionLabels.slice(0, 6).map(function (label) { return renderBadge(label, 'muted'); }).join('')
      : renderBadge('read only', 'muted');
    return [
      '<article class="tdv4-panel tdv4-staff-card" data-tenant-staff-card data-membership-id="' + escapeHtml(entry.membershipId) + '" data-user-id="' + escapeHtml(entry.userId) + '" data-tenant-staff-manageable="' + (rowCanManage ? 'true' : 'false') + '" data-tenant-staff-manage-reason="' + escapeHtml(rowReason) + '">',
      '<div class="tdv4-staff-card-head"><div class="tdv4-data-main"><strong>' + escapeHtml(entry.displayName) + '</strong><span class="tdv4-kpi-detail">' + escapeHtml(entry.email) + '</span></div><div class="tdv4-chip-row">' + renderBadge(entry.role, 'info') + renderBadge(entry.status, toneForStatus(entry.status)) + (entry.isPrimary ? renderBadge('primary', 'success') : '') + '</div></div>',
      '<div class="tdv4-kpi-detail">Invited ' + escapeHtml(entry.invitedAt) + ' | Updated ' + escapeHtml(entry.updatedAt) + ' | Locale ' + escapeHtml(entry.locale) + ' | ' + escapeHtml(entry.permissionSummary) + '</div>',
      '<div class="tdv4-chip-row">' + permissionBadges + '</div>',
      (rowReason ? '<div class="tdv4-kpi-detail">' + escapeHtml(rowReason) + '</div>' : ''),
      '<div class="tdv4-staff-controls">',
      '<label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Role</span><select class="tdv4-basic-input" data-tenant-staff-role title="' + escapeHtml(rowReason) + '"' + disabled + '>' + renderOptionList(entry.management.roleOptions, entry.role) + '</select></label>',
      '<label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Status</span><select class="tdv4-basic-input" data-tenant-staff-status title="' + escapeHtml(rowReason) + '"' + disabled + '>' + renderOptionList(entry.management.statusOptions, entry.status) + '</select></label>',
      '<label class="tdv4-form-field tdv4-form-field-span"><span class="tdv4-mini-stat-label">Revoke reason</span><input class="tdv4-basic-input" type="text" data-tenant-staff-revoke-reason placeholder="Optional note for audit log"' + disabled + '></label>',
      '<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-staff-role-update title="' + escapeHtml(rowReason) + '"' + disabled + '>Save access</button>',
      '<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-staff-revoke title="' + escapeHtml(rowReason) + '"' + disabled + '>Remove user</button>',
      '</div>',
      '</article>',
    ].join('');
  }

  function buildTenantStaffV4Html(model) {
    const safe = model || createTenantStaffV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="#tenant-staff-invite">Invite user</a><a class="tdv4-button tdv4-button-secondary" href="/tenant/roles">Review role matrix</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel" id="tenant-staff-invite">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Invite user</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(safe.canManage ? 'Add a teammate with the right starting role and locale.' : (safe.lockReason || 'You can inspect staff, but changes are locked right now.')) + '</p>',
      '<form class="tdv4-runtime-form" data-tenant-staff-invite-form>',
      '<div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Email</div><div class="tdv4-basic-field-detail">Used for the staff invite and future login</div></div><input class="tdv4-basic-input" type="email" name="email" placeholder="staff@example.com"' + (safe.canManage ? '' : ' disabled') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Display name</div><div class="tdv4-basic-field-detail">Visible label inside tenant workspaces</div></div><input class="tdv4-basic-input" type="text" name="displayName" placeholder="Operations lead"' + (safe.canManage ? '' : ' disabled') + '></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Role</div><div class="tdv4-basic-field-detail">Starting access level for this teammate</div></div><select class="tdv4-basic-input" name="role"' + (safe.canManage && safe.inviteRoleOptions.length ? '' : ' disabled') + '>' + renderOptionList(safe.inviteRoleOptions, safe.inviteRoleOptions[0] || 'viewer') + '</select></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Locale</div><div class="tdv4-basic-field-detail">Default language for the invite target</div></div><select class="tdv4-basic-input" name="locale"' + (safe.canManage ? '' : ' disabled') + '><option value="en">en</option><option value="th">th</option></select></label>',
      '</div>',
      '<div class="tdv4-action-list"><button class="tdv4-button tdv4-button-primary" type="submit" data-tenant-staff-invite-submit' + (safe.canManage && safe.inviteRoleOptions.length ? '' : ' disabled') + '>Invite user</button></div>',
      '</form>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Details / history</div>',
      '<h2 class="tdv4-section-title">Current team</h2>',
      '<p class="tdv4-section-copy">Each entry supports role assignment and removal without leaving this page.</p>',
      safe.memberships.length ? safe.memberships.map(function (entry) { return renderStaffCard(entry, safe); }).join('') : '<div class="tdv4-empty-state"><strong>No staff yet</strong><p>Invite the first teammate from the form on the left.</p></div>',
      '</section>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantStaffV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantStaffV4 requires a root element');
    const model = source && source.header && Array.isArray(source.memberships)
      ? source
      : createTenantStaffV4Model(source);
    rootElement.innerHTML = buildTenantStaffV4Html(model);
    return model;
  }

  return {
    buildTenantStaffV4Html: buildTenantStaffV4Html,
    createTenantStaffV4Model: createTenantStaffV4Model,
    renderTenantStaffV4: renderTenantStaffV4,
  };
});
