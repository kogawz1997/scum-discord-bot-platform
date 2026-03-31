(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantRolesV4 = factory();
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
        { role: 'owner', label: 'Owner', description: 'Full tenant control.', permissionLabels: [], manageableRoles: ['owner', 'admin', 'staff', 'viewer'], assignableRoles: ['owner', 'admin', 'staff', 'viewer'] },
        { role: 'admin', label: 'Admin', description: 'Daily operations control.', permissionLabels: [], manageableRoles: ['staff', 'viewer'], assignableRoles: ['staff', 'viewer'] },
        { role: 'staff', label: 'Staff', description: 'Operational support.', permissionLabels: [], manageableRoles: [], assignableRoles: [] },
        { role: 'viewer', label: 'Viewer', description: 'Read-only access.', permissionLabels: [], manageableRoles: [], assignableRoles: [] },
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
    const roleMatrix = (Array.isArray(roleMatrixRows) ? roleMatrixRows : []).find(function (entry) {
      return String(entry.role || '').trim().toLowerCase() === role;
    }) || null;
    const permissionLabels = access && access.permissions && typeof access.permissions === 'object'
      ? Object.keys(access.permissions).map(function (key) {
        const permission = access.permissions[key];
        return permission && permission.allowed ? firstNonEmpty([permission.label, key], '') : '';
      }).filter(Boolean)
      : (roleMatrix ? roleMatrix.permissionLabels.slice() : []);
    return {
      role: role,
      roleLabel: firstNonEmpty([access && access.roleLabel, roleMatrix && roleMatrix.label, humanizeRole(role)]),
      roleDescription: firstNonEmpty([access && access.roleDescription, roleMatrix && roleMatrix.description, '']),
      permissionLabels: permissionLabels,
      permissionCount: Number(access && access.permissionCount) || permissionLabels.length,
      canManageStaff: Boolean(access && access.permissions && access.permissions.manage_staff && access.permissions.manage_staff.allowed),
      manageStaffDescription: firstNonEmpty([
        access && access.permissions && access.permissions.manage_staff && access.permissions.manage_staff.description,
        'Invite teammates, change roles, disable access, and revoke memberships.',
      ]),
    };
  }

  function membershipRows(state) {
    const roleMatrixRows = createRoleMatrixRows(state);
    const roleMatrixByRole = roleMatrixRows.reduce(function (acc, row) {
      acc[row.role] = row;
      return acc;
    }, {});
    return (Array.isArray(state.staffMemberships) ? state.staffMemberships : []).map(function (row) {
      const role = firstNonEmpty([row.role, 'viewer']).toLowerCase();
      const management = row.management && typeof row.management === 'object' ? row.management : {};
      const accessPermissions = row.access && row.access.permissions && typeof row.access.permissions === 'object'
        ? Object.keys(row.access.permissions).map(function (key) {
          const permission = row.access.permissions[key];
          return permission && permission.allowed ? firstNonEmpty([permission.label, key], '') : '';
        }).filter(Boolean)
        : [];
      const permissionLabels = accessPermissions.length
        ? accessPermissions
        : ((roleMatrixByRole[role] && roleMatrixByRole[role].permissionLabels) ? roleMatrixByRole[role].permissionLabels.slice() : []);
      return {
        membershipId: firstNonEmpty([row.membershipId, row.id]),
        userId: firstNonEmpty([row.userId, row.user && row.user.id]),
        displayName: firstNonEmpty([row.displayName, row.user && row.user.displayName, row.primaryEmail, row.email, 'Unknown teammate']),
        email: firstNonEmpty([row.primaryEmail, row.email, '-']),
        role: role,
        status: firstNonEmpty([row.status, 'active']).toLowerCase(),
        permissionLabels: permissionLabels,
        permissionSummary: permissionLabels.length ? formatNumber(permissionLabels.length) + ' permissions' : 'Read only',
        management: {
          canManage: management.canManage !== false,
          reason: firstNonEmpty([management.reason], ''),
          roleOptions: Array.isArray(management.roleOptions) && management.roleOptions.length ? management.roleOptions.slice() : [role],
          statusOptions: Array.isArray(management.statusOptions) && management.statusOptions.length ? management.statusOptions.slice() : [firstNonEmpty([row.status, 'active']).toLowerCase()],
        },
      };
    });
  }

  function createTenantRolesV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const roleMatrixRows = createRoleMatrixRows(state);
    const currentAccess = createCurrentAccessSummary(state, roleMatrixRows);
    const rows = membershipRows(state);
    const previewMode = Boolean(
      state.tenantConfig && state.tenantConfig.previewMode
      || state.overview && state.overview.tenantConfig && state.overview.tenantConfig.previewMode
      || state.overview && state.overview.opsState && state.overview.opsState.previewMode
    );
    const manageEntitlement = state.featureEntitlements && state.featureEntitlements.actions && state.featureEntitlements.actions.can_manage_staff;
    const locked = Boolean(manageEntitlement && manageEntitlement.locked);
    const canManage = !previewMode && !locked && currentAccess.canManageStaff;
    const roleCounts = roleMatrixRows.map(function (roleEntry) {
      return {
        role: roleEntry.role,
        label: roleEntry.label,
        count: rows.filter(function (row) { return String(row.role || '').trim().toLowerCase() === roleEntry.role; }).length,
      };
    });
    const permissionRows = [];
    roleMatrixRows.forEach(function (roleEntry) {
      (Array.isArray(roleEntry.permissionLabels) ? roleEntry.permissionLabels : []).forEach(function (label) {
        const existing = permissionRows.find(function (entry) { return entry.label === label; });
        if (existing) {
          existing.roles.push(roleEntry.label);
          return;
        }
        permissionRows.push({
          label: label,
          roles: [roleEntry.label],
        });
      });
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
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state.__surfaceShell && state.__surfaceShell.navGroups) ? state.__surfaceShell.navGroups : [],
      },
      header: {
        title: 'Roles & Permissions',
        subtitle: 'Assign the least access needed for day-to-day work without leaking owner-only controls.',
        statusChips: [
          { label: currentAccess.roleLabel + ' access', tone: 'info' },
          { label: canManage ? 'role assignment ready' : (locked ? 'locked by package' : 'view only'), tone: canManage ? 'success' : 'warning' },
          { label: formatNumber(rows.length) + ' assignments', tone: 'info' },
        ],
      },
      canManage: canManage,
      lockReason: firstNonEmpty([
        manageEntitlement && manageEntitlement.reason,
        !currentAccess.canManageStaff ? currentAccess.manageStaffDescription : '',
        previewMode ? 'Preview mode cannot change role assignments.' : '',
      ], ''),
      roleOptions: ['owner', 'admin', 'staff', 'viewer'],
      statusOptions: ['active', 'invited', 'disabled', 'revoked'],
      summaryStrip: roleCounts.map(function (item) {
        return {
          label: item.label,
          value: formatNumber(item.count),
          detail: 'Current team members in this role',
          tone: item.count ? 'info' : 'muted',
        };
      }),
      currentAccess: currentAccess,
      roles: roleMatrixRows.map(function (entry) {
        return {
          title: entry.label,
          detail: entry.description,
          permissionLabels: entry.permissionLabels.slice(),
          manageableRoles: entry.manageableRoles.slice(),
          assignableRoles: entry.assignableRoles.slice(),
        };
      }),
      permissionRows: permissionRows,
      memberships: rows,
    };
  }

  function renderAssignmentRow(entry, model) {
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
      '<div class="tdv4-staff-card-head"><div class="tdv4-data-main"><strong>' + escapeHtml(entry.displayName) + '</strong><span class="tdv4-kpi-detail">' + escapeHtml(entry.email) + '</span></div><div class="tdv4-chip-row">' + renderBadge(entry.role, 'info') + renderBadge(entry.status, toneForStatus(entry.status)) + '</div></div>',
      '<div class="tdv4-kpi-detail">' + escapeHtml(entry.permissionSummary) + '</div>',
      '<div class="tdv4-chip-row">' + permissionBadges + '</div>',
      (rowReason ? '<div class="tdv4-kpi-detail">' + escapeHtml(rowReason) + '</div>' : ''),
      '<div class="tdv4-staff-controls">',
      '<label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Role</span><select class="tdv4-basic-input" data-tenant-staff-role title="' + escapeHtml(rowReason) + '"' + disabled + '>' + renderOptionList(entry.management.roleOptions, entry.role) + '</select></label>',
      '<label class="tdv4-form-field"><span class="tdv4-mini-stat-label">Status</span><select class="tdv4-basic-input" data-tenant-staff-status title="' + escapeHtml(rowReason) + '"' + disabled + '>' + renderOptionList(entry.management.statusOptions, entry.status) + '</select></label>',
      '<label class="tdv4-form-field tdv4-form-field-span"><span class="tdv4-mini-stat-label">Revoke reason</span><input class="tdv4-basic-input" type="text" data-tenant-staff-revoke-reason placeholder="Optional note for audit log"' + disabled + '></label>',
      '<button class="tdv4-button tdv4-button-primary" type="button" data-tenant-staff-role-update title="' + escapeHtml(rowReason) + '"' + disabled + '>Assign role</button>',
      '<button class="tdv4-button tdv4-button-secondary" type="button" data-tenant-staff-revoke title="' + escapeHtml(rowReason) + '"' + disabled + '>Remove access</button>',
      '</div>',
      '</article>',
    ].join('');
  }

  function buildTenantRolesV4Html(model) {
    const safe = model || createTenantRolesV4Model({});
    return [
      '<div class="tdv4-app">',
      '<header class="tdv4-topbar"><div class="tdv4-brand-row"><div class="tdv4-brand-mark">' + escapeHtml(safe.shell.brand) + '</div><div class="tdv4-brand-copy"><div class="tdv4-surface-label">' + escapeHtml(safe.shell.surfaceLabel) + '</div><div class="tdv4-workspace-label">' + escapeHtml(safe.shell.workspaceLabel) + '</div></div></div></header>',
      '<div class="tdv4-shell">',
      '<aside class="tdv4-sidebar">' + (Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups.map(renderNavGroup).join('') : '') + '</aside>',
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead tdv4-panel">',
      '<div><h1 class="tdv4-page-title">' + escapeHtml(safe.header.title) + '</h1><p class="tdv4-page-subtitle">' + escapeHtml(safe.header.subtitle) + '</p><div class="tdv4-chip-row">' + safe.header.statusChips.map(function (chip) { return renderBadge(chip.label, chip.tone); }).join('') + '</div></div>',
      '<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" href="#tenant-role-assignments">Assign role</a></div>',
      '</section>',
      '<section class="tdv4-kpi-strip">' + safe.summaryStrip.map(renderSummaryCard).join('') + '</section>',
      '<section class="tdv4-dual-grid">',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Status</div>',
      '<h2 class="tdv4-section-title">Role definitions</h2>',
      '<div class="tdv4-list">' + safe.roles.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-info"><div class="tdv4-list-main"><strong>' + escapeHtml(row.title) + '</strong><p>' + escapeHtml(row.detail) + '</p><div class="tdv4-chip-row">' + (row.permissionLabels.length ? row.permissionLabels.map(function (label) { return renderBadge(label, 'muted'); }).join('') : renderBadge('read only', 'muted')) + '</div><p class="tdv4-kpi-detail">Can manage: ' + escapeHtml((row.manageableRoles.length ? row.manageableRoles.join(', ') : 'none')) + ' | Can assign: ' + escapeHtml((row.assignableRoles.length ? row.assignableRoles.join(', ') : 'none')) + '</p></div></article>';
      }).join('') + '</div>',
      '</section>',
      '<section class="tdv4-panel">',
      '<div class="tdv4-section-kicker">Secondary actions</div>',
      '<h2 class="tdv4-section-title">Permission coverage</h2>',
      '<div class="tdv4-list">' + (safe.permissionRows.length ? safe.permissionRows.map(function (row) {
        return '<article class="tdv4-list-item tdv4-tone-muted"><div class="tdv4-list-main"><strong>' + escapeHtml(row.label) + '</strong><p>' + escapeHtml(row.roles.join(', ')) + '</p></div></article>';
      }).join('') : '<article class="tdv4-list-item tdv4-tone-muted"><div class="tdv4-list-main"><strong>No permission data</strong><p>Role permissions will appear here after the role matrix is loaded.</p></div></article>') + '</div>',
      '</section>',
      '<section class="tdv4-panel" id="tenant-role-assignments">',
      '<div class="tdv4-section-kicker">Primary action</div>',
      '<h2 class="tdv4-section-title">Assign role</h2>',
      '<p class="tdv4-section-copy">' + escapeHtml(safe.canManage ? 'Use the assignment list below to move people between roles or change status.' : (safe.lockReason || 'You can review assignments, but role changes are locked right now.')) + '</p>',
      safe.memberships.length ? safe.memberships.map(function (entry) { return renderAssignmentRow(entry, safe); }).join('') : '<div class="tdv4-empty-state"><strong>No assignments yet</strong><p>Invite staff first, then return here to review access levels.</p></div>',
      '</section>',
      '</section>',
      '</main>',
      '</div>',
      '</div>',
    ].join('');
  }

  function renderTenantRolesV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantRolesV4 requires a root element');
    const model = source && source.header && Array.isArray(source.memberships)
      ? source
      : createTenantRolesV4Model(source);
    rootElement.innerHTML = buildTenantRolesV4Html(model);
    return model;
  }

  return {
    buildTenantRolesV4Html: buildTenantRolesV4Html,
    createTenantRolesV4Model: createTenantRolesV4Model,
    renderTenantRolesV4: renderTenantRolesV4,
  };
});
