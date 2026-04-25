(function () {
  'use strict';

  const TITLE_LOCK_DELAY_MS = 200;
  const OVERLAY_SELECTOR = '#ownerV4AppRoot';
  const TOPBAR_ID = 'ownerUnifiedTopbar';
  const SIDEBAR_ID = 'ownerUnifiedSidebar';
  const CONTRAST_KEY = 'owner-stitch-contrast';
  const LOCALE_KEY = 'owner-stitch-locale';
  const STITCH_DOCUMENT_TITLE = String(window.__OWNER_STITCH_TITLE__ || document.title || 'SCUM Owner Plane');
  const DISABLED_REASONS = [];
  const DEFERRED_ACTIONS = [];
  const BRAND_HEADING_PATTERNS = [
    'aegis command',
    'scum command',
    'control plane',
    'platform control',
    'scum managed services',
    'platform authority',
    'master operator',
    'owner plane',
  ];
  const TOPBAR_SHELL_VERSION = '20260418-owner-topbar-1';
  const SIDEBAR_SHELL_VERSION = '20260418-owner-sidebar-1';
  const SIDEBAR_EXPANDABLE_GROUPS = new Set(['core', 'operations', 'governance']);
  const PAGE_SECTION_LIMIT = 0;
  const ROUTE_COPY = {
    '/owner': 'Platform Overview',
    '/owner/dashboard': 'Platform Overview',
    '/owner/tenants': 'Tenant Management',
    '/owner/tenants/new': 'Tenant Provisioning',
    '/owner/tenants/context': 'Tenant Dossier',
    '/owner/packages': 'Package Management',
    '/owner/packages/create': 'Create Package',
    '/owner/packages/entitlements': 'Package Entitlements',
    '/owner/packages/detail': 'Package Detail',
    '/owner/subscriptions': 'Subscription Management',
    '/owner/subscriptions/registry': 'Subscription Registry',
    '/owner/subscriptions/detail': 'Subscription Detail',
    '/owner/billing': 'Billing Overview',
    '/owner/billing/recovery': 'Billing Recovery',
    '/owner/billing/attempts': 'Payment Attempts',
    '/owner/billing/invoice': 'Invoice Detail',
    '/owner/billing/attempt': 'Payment Attempt Detail',
    '/owner/runtime': 'Runtime Overview',
    '/owner/runtime/overview': 'Runtime Overview',
    '/owner/runtime/create-server': 'Create Server Record',
    '/owner/runtime/provision-runtime': 'Provision Runtime',
    '/owner/runtime/fleet-diagnostics': 'Runtime Diagnostics',
    '/owner/runtime/agents-bots': 'Agents and Bots Detail',
    '/owner/analytics': 'Analytics Overview',
    '/owner/analytics/overview': 'Analytics Overview',
    '/owner/analytics/risk': 'Risk Queue',
    '/owner/analytics/packages': 'Package Usage',
    '/owner/jobs': 'Queues and Jobs',
    '/owner/automation': 'Automation and Notifications',
    '/owner/incidents': 'Incidents and Alerts',
    '/owner/support': 'Support and Diagnostics',
    '/owner/support/context': 'Support Context',
    '/owner/audit': 'Audit Trail',
    '/owner/security': 'Security Overview',
    '/owner/security/overview': 'Security Overview',
    '/owner/access': 'Access Posture',
    '/owner/diagnostics': 'Diagnostics and Evidence',
    '/owner/settings': 'Settings Overview',
    '/owner/settings/overview': 'Settings Overview',
    '/owner/settings/admin-users': 'Admin Users',
    '/owner/settings/services': 'Managed Services',
    '/owner/settings/access-policy': 'Access Policy',
    '/owner/settings/portal-policy': 'Portal Policy',
    '/owner/settings/billing-policy': 'Billing Policy',
    '/owner/settings/runtime-policy': 'Runtime Policy',
    '/owner/control': 'Platform Controls',
    '/owner/recovery': 'Recovery Overview',
    '/owner/recovery/overview': 'Recovery Overview',
    '/owner/recovery/create': 'Create Backup',
    '/owner/recovery/preview': 'Restore Preview',
    '/owner/recovery/restore': 'Restore Apply',
    '/owner/recovery/history': 'Restore History',
    '/owner/recovery/tenant-backup': 'Tenant Backup Detail',
  };

  const NAV_ITEMS = {
    overview: { href: '/owner', icon: 'dashboard', label: 'Overview' },
    tenants: {
      href: '/owner/tenants',
      icon: 'groups',
      label: 'Tenants',
      children: [
        { href: '/owner/tenants', label: 'Tenant list' },
        { href: '/owner/tenants/new', label: 'Create tenant' },
      ],
    },
    packages: {
      href: '/owner/packages',
      icon: 'inventory_2',
      label: 'Packages',
      children: [
        { href: '/owner/packages', label: 'Catalog' },
        { href: '/owner/packages/create', label: 'Create package' },
        { href: '/owner/packages/entitlements', label: 'Entitlements' },
      ],
    },
    subscriptions: {
      href: '/owner/subscriptions',
      icon: 'subscriptions',
      label: 'Subscriptions',
      children: [
        { href: '/owner/subscriptions', label: 'Renewal queue' },
        { href: '/owner/subscriptions/registry', label: 'Registry' },
      ],
    },
    billing: {
      href: '/owner/billing',
      icon: 'payments',
      label: 'Billing',
      children: [
        { href: '/owner/billing', label: 'Invoices' },
        { href: '/owner/billing/recovery', label: 'Recovery' },
        { href: '/owner/billing/attempts', label: 'Attempts' },
      ],
    },
    runtime: {
      href: '/owner/runtime/overview',
      matchHrefs: ['/owner/runtime'],
      icon: 'monitor_heart',
      label: 'Runtime',
      children: [
        { href: '/owner/runtime/overview', label: 'Overview' },
        { href: '/owner/runtime/create-server', label: 'Create server' },
        { href: '/owner/runtime/provision-runtime', label: 'Provision' },
        { href: '/owner/runtime/agents-bots', label: 'Agents & Bots' },
        { href: '/owner/runtime/fleet-diagnostics', label: 'Diagnostics' },
      ],
    },
    incidents: { href: '/owner/incidents', icon: 'warning', label: 'Incidents' },
    jobs: { href: '/owner/jobs', icon: 'dns', label: 'Jobs' },
    analytics: {
      href: '/owner/analytics/overview',
      matchHrefs: ['/owner/analytics', '/owner/observability'],
      icon: 'analytics',
      label: 'Analytics',
      children: [
        { href: '/owner/analytics/overview', label: 'Overview' },
        { href: '/owner/analytics/risk', label: 'Risk queue' },
        { href: '/owner/analytics/packages', label: 'Package usage' },
      ],
    },
    automation: { href: '/owner/automation', icon: 'robot_2', label: 'Automation' },
    support: { href: '/owner/support', icon: 'contact_support', label: 'Support' },
    recovery: {
      href: '/owner/recovery/overview',
      matchHrefs: ['/owner/recovery'],
      icon: 'settings_backup_restore',
      label: 'Recovery',
      children: [
        { href: '/owner/recovery/overview', label: 'Overview' },
        { href: '/owner/recovery/create', label: 'Create backup' },
        { href: '/owner/recovery/preview', label: 'Preview' },
        { href: '/owner/recovery/restore', label: 'Restore' },
        { href: '/owner/recovery/history', label: 'History' },
      ],
    },
    audit: { href: '/owner/audit', icon: 'history_edu', label: 'Audit' },
    security: {
      href: '/owner/security/overview',
      matchHrefs: ['/owner/security'],
      icon: 'security',
      label: 'Security',
      children: [
        { href: '/owner/security/overview', label: 'Overview' },
        { href: '/owner/access', label: 'Access' },
        { href: '/owner/diagnostics', label: 'Diagnostics' },
      ],
    },
    settings: {
      href: '/owner/settings/overview',
      matchHrefs: ['/owner/settings'],
      icon: 'settings',
      label: 'Settings',
      children: [
        { href: '/owner/settings/overview', label: 'Overview' },
        { href: '/owner/settings/access-policy', label: 'Access policy' },
        { href: '/owner/settings/portal-policy', label: 'Portal policy' },
        { href: '/owner/settings/billing-policy', label: 'Billing policy' },
        { href: '/owner/settings/runtime-policy', label: 'Runtime policy' },
        { href: '/owner/control', label: 'Platform controls' },
        { href: '/owner/settings/admin-users', label: 'Admin users' },
        { href: '/owner/settings/services', label: 'Managed services' },
      ],
    },
  };

  const NAV_GROUPS = [
    {
      id: 'core',
      label: 'Core',
      items: [
        NAV_ITEMS.overview,
        NAV_ITEMS.tenants,
        NAV_ITEMS.packages,
        NAV_ITEMS.subscriptions,
        NAV_ITEMS.billing,
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        NAV_ITEMS.runtime,
        NAV_ITEMS.incidents,
        NAV_ITEMS.jobs,
        NAV_ITEMS.analytics,
        NAV_ITEMS.automation,
        NAV_ITEMS.support,
        NAV_ITEMS.recovery,
      ],
    },
    {
      id: 'governance',
      label: 'Governance',
      items: [
        NAV_ITEMS.audit,
        NAV_ITEMS.security,
        NAV_ITEMS.settings,
      ],
    },
  ];

  const WORKFLOW_TARGET_RULES = [
    { href: '/owner/packages/create#owner-packages-create-form', patterns: ['create package', 'new package'] },
    { href: '/owner/packages#owner-packages-workspace', patterns: ['update specifications', 'duplicate package', 'delete package'] },
    { href: '/owner/packages/entitlements#owner-packages-entitlements-workspace', patterns: ['entitlement matrix', 'feature matrix', 'package entitlements'] },
    { href: '/owner/subscriptions#owner-subscriptions-actions', patterns: ['create subscription', 'manual renewal', 'notify tenant', 'export ledger', 'ledger export'] },
    { href: '/owner/subscriptions/registry#owner-subscriptions-registry-workspace', patterns: ['subscription registry', 'review subscriptions'] },
    { href: '/owner/billing#owner-billing-invoices-workspace', patterns: ['create invoice', 'download report'] },
    { href: '/owner/billing/recovery#owner-billing-recovery-queue', patterns: ['billing recovery', 'revenue recovery', 'past due recovery'] },
    { href: '/owner/billing/attempts#owner-billing-attempts-workspace', patterns: ['create checkout session', 'payment attempt'] },
    { href: '/owner/runtime/create-server#owner-runtime-server-workspace', patterns: ['create server record', 'register server'] },
    { href: '/owner/runtime/provision-runtime#owner-runtime-provisioning-workspace', patterns: ['provision', 'issue setup token', 'revoke token', 'revoke provision'] },
    { href: '/owner/runtime/agents-bots#owner-runtime-workspace', patterns: ['scan agent', 'scan bot', 'remote update', 'revoke device'] },
    { href: '/owner/runtime/fleet-diagnostics#owner-runtime-workspace', patterns: ['view logs', 'ping services'] },
    { href: '/owner/jobs#owner-runtime-shared-ops', patterns: ['restart service', 'bulk agent restart'] },
    { href: '/owner/analytics#owner-analytics-workspace', patterns: ['open observability', 'bot telemetry', 'trace network'] },
    { href: '/owner/analytics/risk#owner-risk-queue', patterns: ['risk queue', 'review risk'] },
    { href: '/owner/analytics/packages#owner-analytics-packages-workspace', patterns: ['package usage', 'adoption'] },
    { href: '/owner/audit#ownerLiveAuditWorkspace', patterns: ['generate full audit report', 'export audit', 'review identity', 'verify operator', 'revoke session', 'block ip'] },
    { href: '/owner/settings#owner-settings-workspace', patterns: ['save settings', 'add variable'] },
    { href: '/owner/settings/access-policy#owner-settings-access-policy', patterns: ['access policy', 'session policy', 'owner access'] },
    { href: '/owner/settings/portal-policy#owner-settings-portal-policy', patterns: ['portal policy', 'player portal policy'] },
    { href: '/owner/settings/billing-policy#owner-settings-billing-policy', patterns: ['billing policy', 'payment provider settings'] },
    { href: '/owner/settings/runtime-policy#owner-settings-runtime-policy', patterns: ['runtime policy', 'orchestration policy'] },
    { href: '/owner/settings/admin-users#owner-settings-admin-users', patterns: ['create admin user', 'admin users'] },
    { href: '/owner/settings/services#owner-settings-managed-services', patterns: ['managed services', 'restart services'] },
    { href: '/owner/automation#ownerLiveAutomationWorkspace', patterns: ['retry all', 'flush buffer', 'new deployment'] },
    { href: '/owner/recovery/preview#owner-recovery-preview-workspace', patterns: ['confirm restore', 'confirm_restore', 'initiate restore', 'restore preview'] },
    { href: '/owner/recovery/create#owner-recovery-create-workspace', patterns: ['create backup'] },
    { href: '/owner/recovery/restore#owner-recovery-restore-workspace', patterns: ['restore backup'] },
    { href: '/owner/diagnostics', patterns: ['run diagnostics', 'export diagnostics'] },
    { href: '/owner/support', patterns: ['open support case', 'open dead-letter', 'clear queue', 'retry delivery'] },
    { href: '/owner/access', patterns: ['re-auth steam'] },
    { href: '/owner/packages#ownerLivePackagesWorkspace', patterns: ['สร้างข้อมูลสำรอง'] },
    { href: '/owner/recovery/overview', patterns: ['กู้คืน'] },
    { href: '/owner/diagnostics', patterns: ['ส่งออก'] },
    { href: '/owner/settings/overview#ownerLiveSettingsWorkspace', patterns: ['อัปเดต'] },
    { href: '/owner/support', patterns: ['ลองใหม่'] },
  ];

  const ROUTE_RULES = [
    { href: '/owner/tenants/new', patterns: ['create tenant', 'new tenant', '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32\u0e43\u0e2b\u0e21\u0e48'] },
    { href: '/owner/runtime/create-server', patterns: ['create server record', 'register server', 'open create server'] },
    { href: '/owner/runtime/provision-runtime', patterns: ['provision runtime', 'issue setup token', 'setup token', 'open provision'] },
    { href: '/owner/packages/create', patterns: ['create package', 'new package'] },
    { href: '/owner/packages/entitlements', patterns: ['package entitlements', 'feature matrix'] },
    { href: '/owner/subscriptions/registry', patterns: ['subscription registry'] },
    { href: '/owner/billing/recovery', patterns: ['billing recovery', 'recovery queue'] },
    { href: '/owner/billing/attempts', patterns: ['payment attempts', 'attempt registry'] },
    { href: '/owner/analytics/risk', patterns: ['risk queue', 'revenue risk'] },
    { href: '/owner/analytics/packages', patterns: ['package usage', 'package adoption'] },
    { href: '/owner/recovery/create', patterns: ['create backup'] },
    { href: '/owner/recovery/preview', patterns: ['restore preview'] },
    { href: '/owner/recovery/restore', patterns: ['restore apply', 'guarded restore'] },
    { href: '/owner/recovery/history', patterns: ['restore history', 'recovery history'] },
    { href: '/owner/settings/admin-users', patterns: ['admin users', 'owner admins'] },
    { href: '/owner/settings/services', patterns: ['managed services', 'service control'] },
    { href: '/owner/settings/access-policy', patterns: ['access policy'] },
    { href: '/owner/settings/portal-policy', patterns: ['portal policy'] },
    { href: '/owner/settings/billing-policy', patterns: ['billing policy'] },
    { href: '/owner/settings/runtime-policy', patterns: ['runtime policy'] },
    { href: '/owner/tenants', patterns: ['table view', '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 table view', '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23'] },
    { href: '/owner', patterns: ['dashboard view', '\u0e2a\u0e23\u0e38\u0e1b dashboard view', '\u0e2a\u0e23\u0e38\u0e1b'] },
    { href: '/owner/tenants/context', patterns: ['tenant dossier', 'view tenant dashboard', 'open tenant', 'open tenant dossier'] },
    { href: '/owner/support/context', patterns: ['support context', 'open support case'] },
    { href: '/owner/access', patterns: ['open access view', 'access posture', 'access'] },
    { href: '/owner/diagnostics', patterns: ['quick diagnostics', 'diagnostics and evidence', 'open diagnostics', 'diagnostics'] },
    { href: '/owner/control', patterns: ['platform controls', 'open control', 'control workspace'] },
    { href: '/owner/automation', patterns: ['automation and notifications', 'open automation', 'automation'] },
    { href: '/owner/runtime/fleet-diagnostics', patterns: ['fleet runtime diagnostics', 'runtime diagnostics', 'log pipeline diagnostics', 'fleet health'] },
    { href: '/owner/runtime/agents-bots', patterns: ['delivery agents', 'server bots', 'fleet: agents', 'fleet: bots', 'agents and bots detail'] },
    { href: '/owner/billing/attempt', patterns: ['payment attempt detail', 'open payment attempt'] },
    { href: '/owner/billing/invoice', patterns: ['invoice detail'] },
    { href: '/owner/packages/detail', patterns: ['package detail', 'detailed comparison'] },
    { href: '/owner/subscriptions/detail', patterns: ['subscription detail'] },
    { href: '/owner/recovery/tenant-backup', patterns: ['backup detail', 'backup details'] },
    { href: '/owner/jobs', patterns: ['open jobs', 'jobs queue', 'queue jobs', 'jobs'] },
    { href: '/owner/analytics/overview', patterns: ['open analytics', 'analytics overview', 'open observability', 'observability', 'system logs', 'bot telemetry', 'agent posture', 'trace network'] },
    { href: '/owner/incidents', patterns: ['incidents and alerts', 'link to new incident', 'incidents', 'alerts', '\u0e40\u0e2b\u0e15\u0e38\u0e01\u0e32\u0e23\u0e13\u0e4c'] },
    { href: '/owner/support', patterns: ['support and diagnostics', 'support overview', 'open support', 'support'] },
    { href: '/owner/security/overview', patterns: ['security dashboard', 'security overview', 'open security', 'security'] },
    { href: '/owner/audit', patterns: ['security audit', 'open audit', 'audit'] },
    { href: '/owner/recovery/overview', patterns: ['system recovery', 'recovery overview', 'maintenance and recovery', 'open recovery', 'recovery', 'restore'] },
    { href: '/owner/settings/overview', patterns: ['settings overview', 'platform settings', 'settings and environment', 'open settings', 'settings'] },
    { href: '/owner/runtime/overview', patterns: ['open runtime overview', 'runtime overview', 'open runtime health', 'runtime health', 'runtime', 'fleet overview', 'fleet', 'health'] },
    { href: '/owner/billing', patterns: ['billing overview', 'back to billing', 'billing'] },
    { href: '/owner/subscriptions', patterns: ['billing and subscriptions', 'subscriptions and billing', 'subscriptions', 'subscription'] },
    { href: '/owner/packages', patterns: ['package management', 'packages'] },
    { href: '/owner/tenants', patterns: ['tenant management', 'tenant list', 'tenants', '\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32', '\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32'] },
    { href: '/owner', patterns: ['platform overview', 'dashboard overview', 'dashboard home', 'home', 'overview', 'platform', '\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21'] },
  ];

  const HASH_ROUTE_RULES = [
    { pattern: '#tenants', href: '/owner/tenants' },
    { pattern: '#subscriptions', href: '/owner/subscriptions' },
    { pattern: '#packages', href: '/owner/packages' },
    { pattern: '#runtime-health', href: '/owner/runtime/overview' },
    { pattern: '#runtime', href: '/owner/runtime/overview' },
    { pattern: '#audit', href: '/owner/audit' },
    { pattern: '#analytics', href: '/owner/analytics/overview' },
    { pattern: '#automation', href: '/owner/automation' },
    { pattern: '#security', href: '/owner/security/overview' },
    { pattern: '#support', href: '/owner/support' },
    { pattern: '#billing', href: '/owner/billing' },
    { pattern: '#recovery', href: '/owner/recovery/overview' },
  ];

  const ICON_ALIASES = {
    group: 'groups',
    package: 'inventory_2',
    package_2: 'inventory_2',
    card_membership: 'subscriptions',
    monitoring: 'analytics',
    health_and_safety: 'monitor_heart',
    local_shipping: 'lan',
    robot: 'robot_2',
    settings_suggest: 'robot_2',
    history: 'history_edu',
    shield_person: 'shield',
    shield_with_heart: 'shield',
    corporate_fare: 'groups',
    description: 'docs',
    cloud_done: 'api_status',
    add_circle: 'add',
    add_circle_outline: 'add',
    file_download: 'download',
    person_add: 'groups',
    verified_user: 'verified',
    account_balance_wallet: 'payments',
    dns: 'database',
    restart_alt: 'refresh',
    history_restore: 'settings_backup_restore',
    report: 'warning',
    help_outline: 'help',
    tuning: 'tune',
  };

  const ICON_PATHS = {
    dashboard: '<rect x="4" y="4" width="7" height="7" rx="1.25"></rect><rect x="13" y="4" width="7" height="4.5" rx="1.25"></rect><rect x="13" y="10.5" width="7" height="9.5" rx="1.25"></rect><rect x="4" y="13" width="7" height="7" rx="1.25"></rect>',
    groups: '<path d="M4.5 19.5v-1.2a3.6 3.6 0 0 1 3.6-3.6h3.8a3.6 3.6 0 0 1 3.6 3.6v1.2"></path><circle cx="10" cy="8.2" r="3.1"></circle><path d="M16.2 15.2a3.3 3.3 0 0 1 3.3 3.3v1"></path><path d="M15.6 5.9a2.7 2.7 0 1 1 0 5.4"></path>',
    inventory_2: '<path d="M4.5 7.8 12 4l7.5 3.8-7.5 3.8Z"></path><path d="M4.5 7.8V16.2L12 20l7.5-3.8V7.8"></path><path d="M12 11.6V20"></path>',
    subscriptions: '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M7.5 9h9"></path><path d="M7.5 13h6.5"></path><path d="M7.5 16.5h4"></path>',
    payments: '<rect x="3.5" y="6.5" width="17" height="11" rx="2"></rect><path d="M3.5 10h17"></path><path d="M7.5 14h3"></path>',
    monitor_heart: '<rect x="4" y="5" width="16" height="11" rx="2"></rect><path d="M10 19h4"></path><path d="M8 15l1.8-3 2.1 4 1.9-3 1.2 2"></path>',
    lan: '<rect x="10" y="4" width="4" height="4" rx="1"></rect><rect x="4" y="16" width="4" height="4" rx="1"></rect><rect x="16" y="16" width="4" height="4" rx="1"></rect><path d="M12 8v4"></path><path d="M6 16v-2h12v2"></path>',
    warning: '<path d="M12 4.5 20 19.5H4L12 4.5Z"></path><path d="M12 9v4.5"></path><circle cx="12" cy="16.6" r=".7" fill="currentColor" stroke="none"></circle>',
    analytics: '<path d="M5 19V9"></path><path d="M12 19V5"></path><path d="M19 19v-7"></path><path d="M3.5 19.5h17"></path>',
    robot_2: '<rect x="7" y="7" width="10" height="9" rx="2"></rect><path d="M12 4v3"></path><path d="M4.5 10.5h2.5"></path><path d="M17 10.5h2.5"></path><circle cx="10" cy="11.5" r=".8" fill="currentColor" stroke="none"></circle><circle cx="14" cy="11.5" r=".8" fill="currentColor" stroke="none"></circle><path d="M10 14.4h4"></path>',
    history_edu: '<path d="M12 8.5V12l2.4 1.5"></path><path d="M4.8 8.8A7.5 7.5 0 1 1 5.6 17"></path><path d="M4.5 4.8v4h4"></path>',
    security: '<path d="M12 3.8 19 6.4v5c0 4.1-2.7 7.9-7 9.3-4.3-1.4-7-5.2-7-9.3v-5Z"></path><path d="M9.8 11.6 11.3 13l3.2-3.4"></path>',
    contact_support: '<path d="M7.5 18.5v-2.1a4.5 4.5 0 0 1 9 0v2.1"></path><path d="M6 13.8H4.8A1.8 1.8 0 0 1 3 12v-1.5A1.8 1.8 0 0 1 4.8 8.7H6"></path><path d="M18 13.8h1.2A1.8 1.8 0 0 0 21 12v-1.5a1.8 1.8 0 0 0-1.8-1.8H18"></path><path d="M8.5 18.5h7"></path><path d="M7.5 8.6a4.5 4.5 0 0 1 9 0"></path>',
    settings_backup_restore: '<path d="M7 7a7 7 0 1 1-1.5 7.1"></path><path d="M4.5 7.2h4.1V3"></path><path d="M12 8.8v3.8l2.8 1.6"></path>',
    settings: '<circle cx="12" cy="12" r="2.6"></circle><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.9-1.1L14.3 3h-4.6l-.3 2.9a7.6 7.6 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.9 1.1l.3 2.9h4.6l.3-2.9a7.6 7.6 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1Z"></path>',
    biotech: '<path d="M10 3.5h4"></path><path d="M11 3.5v6.2l-4 6.4a2.4 2.4 0 0 0 2 3.9h6a2.4 2.4 0 0 0 2-3.9l-4-6.4V3.5"></path><path d="M9.2 14h5.6"></path><path d="M9.8 11h4.4"></path>',
    admin_panel_settings: '<path d="M12 3.8 19 6.4v5c0 4.1-2.7 7.9-7 9.3-4.3-1.4-7-5.2-7-9.3v-5Z"></path><path d="M9.2 12.2h5.6"></path><path d="M12 9.4v5.6"></path>',
    shield: '<path d="M12 3.8 19 6.4v5c0 4.1-2.7 7.9-7 9.3-4.3-1.4-7-5.2-7-9.3v-5Z"></path>',
    notifications: '<path d="M6.5 16.5h11"></path><path d="M8.2 16.5V11a3.8 3.8 0 1 1 7.6 0v5.5"></path><path d="M9.8 19a2.2 2.2 0 0 0 4.4 0"></path>',
    dark_mode: '<path d="M18.5 15.4A7 7 0 1 1 8.6 5.5a5.8 5.8 0 0 0 9.9 9.9Z"></path>',
    refresh: '<path d="M20 6v5h-5"></path><path d="M4 18v-5h5"></path><path d="M19 11a7 7 0 0 0-12-4.7L5 8"></path><path d="M5 13a7 7 0 0 0 12 4.7l2-1.7"></path>',
    search: '<circle cx="11" cy="11" r="5.6"></circle><path d="m19 19-3.1-3.1"></path>',
    language: '<circle cx="12" cy="12" r="8"></circle><path d="M4.5 12h15"></path><path d="M12 4.2c1.9 2.1 3 4.9 3 7.8s-1.1 5.7-3 7.8c-1.9-2.1-3-4.9-3-7.8s1.1-5.7 3-7.8Z"></path>',
    account_circle: '<circle cx="12" cy="8.5" r="3.2"></circle><path d="M5.6 18.8a7.3 7.3 0 0 1 12.8 0"></path>',
    add: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    info: '<circle cx="12" cy="12" r="8"></circle><path d="M12 10.4v4.2"></path><circle cx="12" cy="7.7" r=".7" fill="currentColor" stroke="none"></circle>',
    edit: '<path d="m4.5 19.5 4.3-1 8.3-8.3-3.3-3.3-8.3 8.3-1 4.3Z"></path><path d="m12.8 6.9 3.3 3.3"></path>',
    account_tree: '<rect x="5" y="4.5" width="4" height="4" rx="1"></rect><rect x="15" y="4.5" width="4" height="4" rx="1"></rect><rect x="10" y="15.5" width="4" height="4" rx="1"></rect><path d="M7 8.5v3h10v-3"></path><path d="M12 11.5v4"></path>',
    delete_forever: '<path d="M5 7h14"></path><path d="M9 7V5.5h6V7"></path><path d="M7.5 7.5v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-10"></path><path d="m9.5 10 5 5"></path><path d="m14.5 10-5 5"></path>',
    workspace_premium: '<path d="M12 4.5 14 9l5 .5-3.8 3.1 1.2 4.9L12 15.1 7.6 17.5l1.2-4.9L5 9.5 10 9l2-4.5Z"></path>',
    open_in_new: '<path d="M14 5h5v5"></path><path d="M10 14 19 5"></path><path d="M19 13v5H5V6h5"></path>',
    tune: '<path d="M5 6h10"></path><path d="M5 12h14"></path><path d="M5 18h9"></path><circle cx="17" cy="6" r="2"></circle><circle cx="9" cy="12" r="2"></circle><circle cx="16" cy="18" r="2"></circle>',
    equalizer: '<path d="M6 18V9"></path><path d="M12 18V6"></path><path d="M18 18v-4"></path>',
    military_tech: '<path d="M12 5.5 17.5 8v3.5c0 3.3-2.1 6.4-5.5 7.5-3.4-1.1-5.5-4.2-5.5-7.5V8Z"></path><path d="M9.5 12.3 11.2 14l3.3-3.6"></path>',
    close: '<path d="m6 6 12 12"></path><path d="M18 6 6 18"></path>',
    key: '<circle cx="8.5" cy="12" r="3.5"></circle><path d="M12 12h8"></path><path d="M17 12v2"></path><path d="M19 12v2"></path>',
    terminal: '<path d="m5 8 3 3-3 3"></path><path d="M10 16h6"></path>',
    database: '<ellipse cx="12" cy="6.5" rx="6.5" ry="2.8"></ellipse><path d="M5.5 6.5v6.8c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V6.5"></path><path d="M5.5 10c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8"></path>',
    visibility: '<path d="M2.8 12s3.4-5.5 9.2-5.5S21.2 12 21.2 12s-3.4 5.5-9.2 5.5S2.8 12 2.8 12Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
    verified: '<path d="m7.8 12.6 2.2 2.2 5-5"></path><path d="M12 3.8 18 6.4v5c0 3.8-2.4 7.2-6 8.6-3.6-1.4-6-4.8-6-8.6v-5Z"></path>',
    arrow_upward: '<path d="M12 19V5"></path><path d="m6.5 10.5 5.5-5.5 5.5 5.5"></path>',
    download: '<path d="M12 5v9"></path><path d="m7.5 10.5 4.5 4.5 4.5-4.5"></path><path d="M5 19h14"></path>',
    filter_list: '<path d="M5 7h14"></path><path d="M8 12h8"></path><path d="M11 17h2"></path>',
    person_search: '<circle cx="10" cy="9" r="3"></circle><path d="M4.5 18.2a6 6 0 0 1 11 0"></path><circle cx="17.5" cy="17.5" r="2.5"></circle><path d="m19.4 19.4 1.8 1.8"></path>',
    target: '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3.2"></circle><circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none"></circle>',
    chevron_left: '<path d="m14.5 6-6 6 6 6"></path>',
    chevron_right: '<path d="m9.5 6 6 6-6 6"></path>',
    fingerprint: '<path d="M12 4.5c-3.3 0-6 2.7-6 6v1.2"></path><path d="M18 10.7c0-3.3-2.7-6-6-6"></path><path d="M9 20c-1.5-1.4-2.2-3.4-2.2-5.6v-1.7"></path><path d="M12 20c1.7-1.7 2.6-4 2.6-6.5v-1.1"></path><path d="M15.6 20c1.5-1.3 2.4-3.3 2.4-5.4v-2.1"></path>',
    hub: '<circle cx="12" cy="12" r="2.2"></circle><circle cx="5.5" cy="7" r="1.7"></circle><circle cx="18.5" cy="7" r="1.7"></circle><circle cx="5.5" cy="17" r="1.7"></circle><circle cx="18.5" cy="17" r="1.7"></circle><path d="M10.2 10.7 6.8 8.4"></path><path d="M13.8 10.7l3.4-2.3"></path><path d="M10.2 13.3 6.8 15.6"></path><path d="M13.8 13.3l3.4 2.3"></path>',
    help: '<circle cx="12" cy="12" r="8"></circle><path d="M9.6 9.6a2.5 2.5 0 1 1 4.8 1c-.6 1-1.8 1.4-2.4 2.2-.3.4-.4.8-.4 1.2"></path><circle cx="12" cy="16.9" r=".7" fill="currentColor" stroke="none"></circle>',
    api_status: '<path d="M6 16.5h3.2"></path><path d="M7.6 16.5V9.2"></path><path d="M10.4 16.5h3.2"></path><path d="M12 16.5V6.5"></path><path d="M14.8 16.5H18"></path><path d="M16.4 16.5V11"></path>',
    docs: '<path d="M7 5.5h8l3 3V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V7a1.5 1.5 0 0 1 1-1.5Z"></path><path d="M15 5.5V9h3"></path><path d="M9 12h6"></path><path d="M9 15h4"></path>',
    logout: '<path d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v9A1.5 1.5 0 0 0 6.5 18H10"></path><path d="M13 8.5 18.5 12 13 15.5"></path><path d="M18 12H9"></path>',
    fallback: '<rect x="5" y="5" width="14" height="14" rx="3"></rect><path d="M9 12h6"></path>',
  };

  const DEFERRED_PATTERNS = [
    'open live',
    'create package',
    'create subscription',
    'create checkout session',
    'create invoice',
    'update specifications',
    'duplicate package',
    'delete package',
    'manual renewal',
    'notify tenant',
    'revoke session',
    'review identity',
    'verify operator',
    'run diagnostics',
    'open dead-letter',
    'scan agent',
    'scan bot',
    'request full heap dump',
    'clear queue',
    'retry delivery',
    'acknowledge all',
    'clear cleared',
    'acknowledge',
    'clear',
    'investigate',
    'block ip',
    'generate full audit report',
    'save settings',
    'add variable',
    'create admin user',
    'restart service',
    'confirm_restore',
    'confirm restore',
    'initiate restore',
    'create backup',
    'restore backup',
    'export audit',
    'export diagnostics',
    'download report',
    'download health',
    'export pdf',
    'save note',
    'retry all',
    'provision',
    'bulk agent restart',
    'revoke provision',
    'revoke token',
    'revoke device',
    'remote update',
    'view logs',
    'new deployment',
    'flush buffer',
    'ping services',
    're-auth steam',
    '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e2a\u0e33\u0e23\u0e2d\u0e07',
    '\u0e01\u0e39\u0e49\u0e04\u0e37\u0e19',
    '\u0e2a\u0e48\u0e07\u0e2d\u0e2d\u0e01',
    '\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15',
    '\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48',
  ];

  function normalizeText(value) {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[_|:/()]/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, ' and ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeIconName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  function resolveIconName(value) {
    const raw = normalizeIconName(value);
    return ICON_ALIASES[raw] || raw || 'fallback';
  }

  function buildIconSvg(name) {
    const resolved = resolveIconName(name);
    const glyph = ICON_PATHS[resolved] || ICON_PATHS.fallback;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
  }

  function extractElementLabel(element) {
    if (!element) return '';
    const text = String(element.textContent || '').trim();
    if (text) return text;
    const aria = String(element.getAttribute?.('aria-label') || '').trim();
    if (aria) return aria;
    const title = String(element.getAttribute?.('title') || '').trim();
    if (title) return title;
    const iconText = Array.from(element.querySelectorAll?.('.material-symbols-outlined') || [])
      .map((node) => node.getAttribute('data-icon') || node.dataset.ownerSvg || '')
      .join(' ')
      .trim();
    return iconText;
  }

  function containsAny(source, patterns) {
    return patterns.some((pattern) => source.includes(normalizeText(pattern)));
  }

  function currentPath() {
    return String(window.location.pathname || '').trim().toLowerCase() || '/owner';
  }

  function resolveCurrentRouteCopy() {
    const path = currentPath();
    if (ROUTE_COPY[path]) return ROUTE_COPY[path];
    const prefixed = Object.keys(ROUTE_COPY).find((route) => route !== '/owner' && path.startsWith(`${route}/`));
    return ROUTE_COPY[prefixed] || 'Owner Surface';
  }

  function matchesCurrentPath(href) {
    const route = String(href || '').trim().toLowerCase();
    const path = currentPath();
    if (!route) return false;
    if (route === '/owner') return path === '/owner' || path === '/owner/';
    return path === route || path.startsWith(`${route}/`);
  }

  function normalizeRouteList(items) {
    return Array.from(new Set((Array.isArray(items) ? items : [])
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)));
  }

  function buildItemMatchTargets(item, includeChildren = true) {
    const targets = [
      item && item.href,
      ...(Array.isArray(item && item.matchHrefs) ? item.matchHrefs : []),
    ];
    if (includeChildren) {
      (Array.isArray(item && item.children) ? item.children : []).forEach((child) => {
        targets.push(child && child.href, ...(Array.isArray(child && child.matchHrefs) ? child.matchHrefs : []));
      });
    }
    return normalizeRouteList(targets);
  }

  function itemHasActiveRoute(item, includeChildren = true) {
    return buildItemMatchTargets(item, includeChildren).some((target) => matchesCurrentPath(target));
  }

  function elementHasActiveRoute(element) {
    if (!element) return false;
    const matchTargets = normalizeRouteList(String(element.dataset.ownerMatchTargets || '')
      .split('|')
      .map((entry) => entry.trim()));
    if (matchTargets.length) {
      return matchTargets.some((target) => matchesCurrentPath(target));
    }
    return matchesCurrentPath(element.getAttribute('href'));
  }

  function groupHasActiveRoute(group) {
    return Array.isArray(group?.items) && group.items.some((item) => itemHasActiveRoute(item));
  }

  function findSidebarSubmenu(root, parentRoute) {
    const target = String(parentRoute || '').trim();
    if (!root || !target) return null;
    return Array.from(root.querySelectorAll('[data-owner-slot="sidebar-submenu"]'))
      .find((node) => String(node.dataset.ownerParentRoute || '').trim() === target) || null;
  }

  function findSidebarSubmenuToggle(root, parentRoute) {
    const target = String(parentRoute || '').trim();
    if (!root || !target) return null;
    return Array.from(root.querySelectorAll('[data-owner-slot="sidebar-submenu-toggle"]'))
      .find((node) => String(node.dataset.ownerParentRoute || '').trim() === target) || null;
  }

  function iconMarkup(name) {
    const resolved = resolveIconName(name);
    return `<span class="material-symbols-outlined owner-shell-icon" data-icon="${resolved}" aria-hidden="true"></span>`;
  }

  function syncMaterialIcons(scope = document) {
    const root = scope && scope.querySelectorAll ? scope : document;
    root.querySelectorAll('.material-symbols-outlined').forEach((node) => {
      const iconName = resolveIconName(node.getAttribute('data-icon') || node.dataset.ownerSvg || node.textContent);
      if (!iconName) return;
      if (node.dataset.ownerSvg === iconName && node.querySelector('svg')) return;
      node.dataset.ownerSvg = iconName;
      node.setAttribute('data-icon', iconName);
      node.textContent = '';
      node.innerHTML = buildIconSvg(iconName);
    });
  }

  function sidebarLinkMarkup(item, options = {}) {
    const level = options.level === 'child' ? 'child' : 'primary';
    const hasChildren = level === 'primary' && options.hasChildren === true;
    const active = itemHasActiveRoute(item, level !== 'child');
    const matchTargets = buildItemMatchTargets(item, level !== 'child');
    return [
      `<a href="${item.href}" data-owner-slot="sidebar-link" data-owner-nav-level="${level}" data-owner-match-targets="${escapeHtml(matchTargets.join('|'))}"${hasChildren ? ' data-owner-nav-has-children="true"' : ''}${active ? ' class="is-owner-active" data-owner-active="true"' : ''}>`,
      item.icon ? iconMarkup(item.icon) : '<span data-owner-slot="sidebar-link-spacer" aria-hidden="true"></span>',
      `<span>${item.label}</span>`,
      '</a>',
    ].join('');
  }

  function sidebarItemMarkup(item) {
    const children = Array.isArray(item?.children) ? item.children : [];
    if (!children.length) {
      return sidebarLinkMarkup(item);
    }
    const parentRoute = String(item?.href || '').trim();
    const submenuVisible = itemHasActiveRoute(item);
    return [
      `<div data-owner-slot="sidebar-item" data-owner-parent-route="${escapeHtml(parentRoute)}" data-owner-has-children="true" data-owner-submenu-open="${submenuVisible ? 'true' : 'false'}">`,
      '  <div data-owner-slot="sidebar-item-row">',
      sidebarLinkMarkup(item, { hasChildren: true }),
      `    <button type="button" data-owner-slot="sidebar-submenu-toggle" data-owner-parent-route="${escapeHtml(parentRoute)}" aria-expanded="${submenuVisible ? 'true' : 'false'}"><span data-owner-slot="sidebar-submenu-state">${submenuVisible ? '−' : '+'}</span></button>`,
      '  </div>',
      `  <div data-owner-slot="sidebar-submenu" data-owner-parent-route="${escapeHtml(parentRoute)}" data-owner-submenu-visible="${submenuVisible ? 'true' : 'false'}"${submenuVisible ? '' : ' hidden'}>${children.map((child) => sidebarLinkMarkup(child, { level: 'child' })).join('')}</div>`,
      '</div>',
    ].join('');
  }

  function sidebarGroupMarkup(group) {
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!items.length) return '';
    const expandable = SIDEBAR_EXPANDABLE_GROUPS.has(String(group?.id || '').trim().toLowerCase());
    const expanded = groupHasActiveRoute(group) || !expandable;
    return [
      `<section data-owner-slot="sidebar-group" data-owner-group="${group.id || 'group'}" data-owner-expandable="${expandable ? 'true' : 'false'}" data-owner-expanded="${expanded ? 'true' : 'false'}">`,
      expandable
        ? `  <button type="button" data-owner-slot="sidebar-group-toggle" aria-expanded="${expanded ? 'true' : 'false'}"><span>${group.label || 'Group'}</span><span data-owner-slot="sidebar-group-state">${expanded ? '−' : '+'}</span></button>`
        : `  <div data-owner-slot="sidebar-group-label">${group.label || 'Group'}</div>`,
      `  <nav data-owner-slot="sidebar-nav-group"${expanded ? '' : ' hidden'}>`,
        items.map((item) => sidebarItemMarkup(item)).join(''),
        '  </nav>',
      '</section>',
    ].join('');
  }

  function setSidebarGroupExpanded(section, expanded) {
    if (!section) return;
    const next = expanded ? 'true' : 'false';
    section.dataset.ownerExpanded = next;
    const toggle = section.querySelector('[data-owner-slot="sidebar-group-toggle"]');
    const nav = section.querySelector('[data-owner-slot="sidebar-nav-group"]');
    const state = section.querySelector('[data-owner-slot="sidebar-group-state"]');
    if (toggle) toggle.setAttribute('aria-expanded', next);
    if (nav) nav.hidden = !expanded;
    if (state) state.textContent = expanded ? '−' : '+';
  }

  function toggleSidebarGroup(root, section) {
    if (!root || !section || section.dataset.ownerExpandable !== 'true') return;
    const willExpand = section.dataset.ownerExpanded !== 'true';
    root.dataset.ownerManualGroup = willExpand ? String(section.dataset.ownerGroup || '').trim() : '__collapsed__';
    Array.from(root.querySelectorAll('[data-owner-slot="sidebar-group"][data-owner-expandable="true"]')).forEach((node) => {
      setSidebarGroupExpanded(node, node === section ? willExpand : false);
    });
    syncSidebarSubmenus(root);
  }

  function syncSidebarGroups(sidebar) {
    const root = sidebar || document.getElementById(SIDEBAR_ID);
    if (!root) return;
    const groups = Array.from(root.querySelectorAll('[data-owner-slot="sidebar-group"]'));
    if (!groups.length) return;
    const manualGroup = String(root.dataset.ownerManualGroup || '').trim();
    const hasManualGroup = manualGroup.length > 0;
    groups.forEach((section) => {
      const expandable = section.dataset.ownerExpandable === 'true';
      const active = Boolean(section.querySelector('[data-owner-active="true"]'));
      if (!expandable) {
        setSidebarGroupExpanded(section, true);
        return;
      }
      let shouldExpand = active;
      if (hasManualGroup) {
        shouldExpand = manualGroup !== '__collapsed__' && section.dataset.ownerGroup === manualGroup;
      }
      setSidebarGroupExpanded(section, shouldExpand);
    });
    syncSidebarSubmenus(root);
  }

  function setSidebarSubmenuExpanded(root, parentRoute, expanded) {
    const submenu = findSidebarSubmenu(root, parentRoute);
    const toggle = findSidebarSubmenuToggle(root, parentRoute);
    const item = toggle?.closest('[data-owner-slot="sidebar-item"]') || submenu?.closest('[data-owner-slot="sidebar-item"]') || null;
    const next = expanded ? 'true' : 'false';
    if (submenu) {
      submenu.hidden = !expanded;
      submenu.dataset.ownerSubmenuVisible = next;
    }
    if (item) {
      item.dataset.ownerSubmenuOpen = next;
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', next);
      const state = toggle.querySelector('[data-owner-slot="sidebar-submenu-state"]');
      if (state) state.textContent = expanded ? '−' : '+';
    }
  }

  function toggleSidebarSubmenu(root, parentRoute, group) {
    if (!root || !parentRoute) return;
    if (group?.dataset.ownerExpandable === 'true') {
      const targetGroup = String(group.dataset.ownerGroup || '').trim();
      root.dataset.ownerManualGroup = targetGroup || '__collapsed__';
      Array.from(root.querySelectorAll('[data-owner-slot="sidebar-group"][data-owner-expandable="true"]')).forEach((node) => {
        setSidebarGroupExpanded(node, node === group);
      });
    }
    const submenu = findSidebarSubmenu(root, parentRoute);
    const willExpand = submenu ? submenu.hidden : true;
    root.dataset.ownerManualSubmenu = willExpand ? parentRoute : '__collapsed__';
    syncSidebarSubmenus(root);
  }

  function syncSidebarSubmenus(sidebar) {
    const root = sidebar || document.getElementById(SIDEBAR_ID);
    if (!root) return;
    const manualParent = String(root.dataset.ownerManualSubmenu || '').trim();
    const hasManualParent = manualParent.length > 0;
    Array.from(root.querySelectorAll('[data-owner-slot="sidebar-submenu"]')).forEach((submenu) => {
      const parentRoute = String(submenu.dataset.ownerParentRoute || '').trim();
      const item = submenu.closest('[data-owner-slot="sidebar-item"]');
      const group = submenu.closest('[data-owner-slot="sidebar-group"]');
      const groupExpanded = !group || group.dataset.ownerExpanded === 'true';
      const parentLink = item?.querySelector('[data-owner-slot="sidebar-link"][data-owner-nav-has-children="true"]');
      const active = elementHasActiveRoute(parentLink) || matchesCurrentPath(parentRoute);
      let shouldExpand = active;
      if (hasManualParent) {
        shouldExpand = manualParent !== '__collapsed__' && manualParent === parentRoute;
      }
      if (item) {
        item.dataset.ownerHasChildren = 'true';
      }
      setSidebarSubmenuExpanded(root, parentRoute, groupExpanded && shouldExpand);
    });
  }

  function wireSidebarGroupToggles(sidebar) {
    const root = sidebar || document.getElementById(SIDEBAR_ID);
    if (!root || root.dataset.ownerGroupsWired === 'true') {
      syncSidebarGroups(root);
      return;
    }
    Array.from(root.querySelectorAll('[data-owner-slot="sidebar-group-toggle"]')).forEach((toggle) => {
      if (toggle.dataset.ownerToggleBound === 'true') return;
      toggle.addEventListener('click', (event) => {
        const section = toggle.closest('[data-owner-slot="sidebar-group"]');
        if (!section || section.dataset.ownerExpandable !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
        toggleSidebarGroup(root, section);
      });
      toggle.dataset.ownerToggleBound = 'true';
    });
    root.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-owner-slot="sidebar-group-toggle"]');
      if (!toggle || !root.contains(toggle)) return;
      const section = toggle.closest('[data-owner-slot="sidebar-group"]');
      if (!section || section.dataset.ownerExpandable !== 'true') return;
      event.preventDefault();
      event.stopPropagation();
      toggleSidebarGroup(root, section);
    });
    root.dataset.ownerGroupsWired = 'true';
    syncSidebarGroups(root);
  }

  function wireSidebarSubmenuToggles(sidebar) {
    const root = sidebar || document.getElementById(SIDEBAR_ID);
    if (!root || root.dataset.ownerSubmenusWired === 'true') {
      syncSidebarSubmenus(root);
      return;
    }
    Array.from(root.querySelectorAll('[data-owner-slot="sidebar-submenu-toggle"]')).forEach((toggle) => {
      if (toggle.dataset.ownerToggleBound === 'true') return;
      toggle.addEventListener('click', (event) => {
        const parentRoute = String(toggle.dataset.ownerParentRoute || '').trim();
        if (!parentRoute) return;
        event.preventDefault();
        event.stopPropagation();
        toggleSidebarSubmenu(root, parentRoute, toggle.closest('[data-owner-slot="sidebar-group"]'));
      });
      toggle.dataset.ownerToggleBound = 'true';
    });
    root.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-owner-slot="sidebar-submenu-toggle"]');
      if (!toggle || !root.contains(toggle)) return;
      const parentRoute = String(toggle.dataset.ownerParentRoute || '').trim();
      if (!parentRoute) return;
      event.preventDefault();
      event.stopPropagation();
      toggleSidebarSubmenu(root, parentRoute, toggle.closest('[data-owner-slot="sidebar-group"]'));
    });
    root.dataset.ownerSubmenusWired = 'true';
    syncSidebarSubmenus(root);
  }

  function extractCurrentPageSections(detail) {
    const rawSections = Array.isArray(detail?.sections)
      ? detail.sections
      : Array.from(document.querySelectorAll('#ownerStitchLiveData [data-owner-section-label]')).map((node) => ({
          id: String(node.id || '').trim(),
          label: String(node.getAttribute('data-owner-section-label') || '').trim(),
          kind: String(node.getAttribute('data-owner-section') || 'panel'),
        }));
    const deduped = [];
    const seen = new Set();
    const labelTops = new Map();
    rawSections.forEach((entry) => {
      const id = String(entry?.id || '').trim();
      const label = String(entry?.label || '').replace(/\s+/g, ' ').trim();
      if (!id || !label) return;
      const labelKey = normalizeText(label);
      const node = document.getElementById(id);
      const top = node ? Math.round(node.getBoundingClientRect().top + window.scrollY) : -1;
      const text = node ? String(node.innerText || '').replace(/\s+/g, ' ').trim() : '';
      if (node && text.length < 28) return;
      const topBucket = top >= 0 ? Math.round(top / 24) : -1;
      const key = normalizeText(`${labelKey} ${topBucket}`);
      if (!key || seen.has(key)) return;
      const previousTop = labelTops.get(labelKey);
      if (typeof previousTop === 'number' && top >= 0 && Math.abs(previousTop - top) < 24) return;
      seen.add(key);
      if (top >= 0) labelTops.set(labelKey, top);
      deduped.push({
        id,
        label,
        kind: String(entry?.kind || 'panel'),
      });
    });
    if (deduped.length < 2) return [];
    return deduped.slice(0, PAGE_SECTION_LIMIT);
  }

  function pageSectionMarkup(sections) {
    return '';
  }

  function syncSidebarPageSections(detail) {
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    sidebar.querySelectorAll('[data-owner-slot="sidebar-page-sections"]').forEach((node) => node.remove());
  }

  function sanitizeSidebarChrome(sidebar) {
    const root = sidebar || document.getElementById(SIDEBAR_ID);
    if (!root) return;
    root.querySelectorAll('[data-owner-slot="sidebar-page-sections"]').forEach((node) => node.remove());
    root.querySelectorAll('[data-owner-slot="sidebar-nav-group"]').forEach((nav) => {
      Array.from(nav.children || []).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        const slot = String(child.dataset.ownerSlot || '').trim();
        if (slot === 'sidebar-page-sections') {
          child.remove();
          return;
        }
        if (slot === 'sidebar-link' && String(child.dataset.ownerNavLevel || '').trim() === 'child') {
          child.remove();
        }
      });
    });
    root.querySelectorAll('[data-owner-slot="sidebar-group-state"]').forEach((node) => {
      const value = String(node.textContent || '').trim();
      node.textContent = value === '+' ? '+' : '-';
    });
    root.querySelectorAll('[data-owner-slot="sidebar-page-sections-label"]').forEach((node) => {
      node.textContent = document.documentElement.lang?.toLowerCase().startsWith('th') ? 'หมวดในหน้านี้' : 'On this page';
    });
  }

  function ensureChromeNode(selector, tagName, className, insert) {
    let node = document.querySelector(selector);
    if (node) return node;
    node = document.createElement(tagName);
    if (className) node.className = className;
    insert(node);
    return node;
  }

  function pruneLegacyChrome(main, topbar, sidebar) {
    Array.from(document.body.children || []).forEach((child) => {
      if (!child || child === main || child === topbar || child === sidebar) return;
      if (child.id === 'ownerLegacyOverlay' || child.id === 'ownerDeferredNotice') return;
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') return;
      const tag = String(child.tagName || '').toLowerCase();
      if (!['header', 'nav', 'aside'].includes(tag)) return;
      child.setAttribute('hidden', 'hidden');
      child.style.display = 'none';
      child.dataset.ownerBridgeSkip = 'true';
    });
    Array.from(document.querySelectorAll('.topbar, .sidebar')).forEach((node) => {
      if (!node || node === topbar || node === sidebar) return;
      if (node.id === TOPBAR_ID || node.id === SIDEBAR_ID) return;
      if (node.dataset?.ownerShell === 'topbar' || node.dataset?.ownerShell === 'sidebar') return;
      if (node.closest('#ownerLegacyOverlay')) return;
      node.setAttribute('hidden', 'hidden');
      node.style.display = 'none';
      node.dataset.ownerBridgeSkip = 'true';
    });
  }

  function topbarNeedsRemount(topbar, activeRoute) {
    if (!topbar) return true;
    if (topbar.dataset.ownerShellMounted !== 'true') return true;
    if (topbar.dataset.ownerShellRoute !== activeRoute) return true;
    if (topbar.dataset.ownerShellVersion !== TOPBAR_SHELL_VERSION) return true;
    if (!topbar.querySelector('[data-owner-slot="topbar-route"]')) return true;
    return false;
  }

  function sidebarNeedsRemount(sidebar, activeRoute) {
    if (!sidebar) return true;
    if (sidebar.dataset.ownerShellMounted !== 'true') return true;
    if (sidebar.dataset.ownerShellRoute !== activeRoute) return true;
    if (sidebar.dataset.ownerShellVersion !== SIDEBAR_SHELL_VERSION) return true;
    if (!sidebar.querySelector('[data-owner-slot="sidebar-groups"]')) return true;
    if (!sidebar.querySelector('[data-owner-slot="sidebar-item-row"]')) return true;
    if (!sidebar.querySelector('[data-owner-slot="sidebar-link"] .owner-shell-icon')) return true;
    if (sidebar.querySelector('[data-owner-slot="sidebar-page-sections"]')) return true;
    const hasInvalidTopLevelChildLink = Array.from(sidebar.querySelectorAll('[data-owner-slot="sidebar-nav-group"]'))
      .some((nav) => Array.from(nav.children || []).some((child) => (
        child instanceof HTMLElement
        && String(child.dataset.ownerSlot || '').trim() === 'sidebar-link'
        && String(child.dataset.ownerNavLevel || '').trim() === 'child'
      )));
    if (hasInvalidTopLevelChildLink) return true;
    return false;
  }

  function renderUnifiedShell() {
    const main = document.querySelector('main');
    if (!main) return;
    const activeRoute = currentPath();

    const legacyShell = main.parentElement && main.parentElement !== document.body
      ? main.parentElement
      : null;
    if (legacyShell && !main.dataset.ownerShellHoisted) {
      document.body.appendChild(main);
      main.dataset.ownerShellHoisted = 'true';
    }

    const topbar = ensureChromeNode(
      `#${TOPBAR_ID}`,
      'nav',
      'topbar',
      (node) => document.body.insertBefore(node, document.body.firstChild),
    );
    topbar.id = TOPBAR_ID;
    topbar.className = 'topbar';
    topbar.dataset.ownerShell = 'topbar';
    if (topbarNeedsRemount(topbar, activeRoute)) {
      topbar.innerHTML = [
        '<div data-owner-chrome="topnav">',
        '  <span data-owner-slot="topbar-brand">AEGIS COMMAND</span>',
        `  <span data-owner-slot="topbar-route">${resolveCurrentRouteCopy()}</span>`,
        '</div>',
        '<div class="owner-topbar-tools">',
        `  <button type="button" class="topbar__pill" aria-label="Refresh">${iconMarkup('refresh')}<span>Refresh</span></button>`,
        '  <button type="button" class="topbar__pill" aria-label="Language">TH/EN</button>',
        '  <button type="button" class="topbar__pill" aria-label="Logout">Logout</button>',
        '</div>',
      ].join('');
      topbar.dataset.ownerShellMounted = 'true';
      topbar.dataset.ownerShellVersion = TOPBAR_SHELL_VERSION;
    }
    topbar.dataset.ownerShellRoute = activeRoute;
    const routeNode = topbar.querySelector('[data-owner-slot="topbar-route"]');
    if (routeNode) {
      routeNode.textContent = resolveCurrentRouteCopy();
    }

    const aside = ensureChromeNode(
      `#${SIDEBAR_ID}`,
      'aside',
      'sidebar',
      (node) => document.body.insertBefore(node, main),
    );
    aside.id = SIDEBAR_ID;
    aside.className = 'sidebar';
    aside.dataset.ownerShell = 'sidebar';
    if (sidebarNeedsRemount(aside, activeRoute)) {
      aside.innerHTML = [
        '<div data-owner-slot="sidebar-brand-wrap">',
        '  <div style="display:flex;align-items:center;gap:12px;">',
        `    <div style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(21,215,255,.12);border:1px solid rgba(21,215,255,.24);color:#15d7ff;">${iconMarkup('shield')}</div>`,
        '    <div>',
        '      <div data-owner-slot="sidebar-title">Platform Owner</div>',
        '      <div data-owner-slot="sidebar-subtitle">Operational Control Plane</div>',
        '    </div>',
        '  </div>',
        '</div>',
        '<div data-owner-slot="sidebar-groups">',
        NAV_GROUPS.map(sidebarGroupMarkup).join(''),
        '</div>',
      ].join('');
      aside.dataset.ownerShellMounted = 'true';
      aside.dataset.ownerShellVersion = SIDEBAR_SHELL_VERSION;
      aside.dataset.ownerGroupsWired = 'false';
      aside.dataset.ownerSubmenusWired = 'false';
      aside.dataset.ownerManualGroup = '';
      aside.dataset.ownerManualSubmenu = '';
    }
    aside.dataset.ownerShellRoute = activeRoute;
    syncSidebarGroups(aside);
    wireSidebarGroupToggles(aside);
    wireSidebarSubmenuToggles(aside);

    pruneLegacyChrome(main, topbar, aside);
    if (legacyShell && legacyShell !== main && !legacyShell.closest('#ownerLegacyOverlay')) {
      legacyShell.setAttribute('hidden', 'hidden');
      legacyShell.style.display = 'none';
      legacyShell.dataset.ownerBridgeSkip = 'true';
    }
    main.dataset.ownerChrome = 'workspace';
  }

  function resolveRouteFromText(value) {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    for (const rule of ROUTE_RULES) {
      if (containsAny(normalized, rule.patterns)) {
        return rule.href;
      }
    }
    return '';
  }

  function resolveWorkflowTarget(value) {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    for (const rule of WORKFLOW_TARGET_RULES) {
      if (containsAny(normalized, rule.patterns)) {
        return rule.href;
      }
    }
    return '';
  }

  function resolveRouteFromHref(value) {
    const href = String(value || '').trim().toLowerCase();
    if (!href || !href.startsWith('#')) return '';
    if (href === '#owner-control-workspace') return '__overlay__';
    const direct = HASH_ROUTE_RULES.find((rule) => href === rule.pattern);
    if (direct) return direct.href;
    if (href.startsWith('#tenant-')) return '/owner/tenants/context';
    if (href.startsWith('#support-') || href.startsWith('#case-')) return '/owner/support/context';
    if (href.startsWith('#invoice-')) return '/owner/billing/invoice';
    if (href.startsWith('#attempt-')) return '/owner/billing/attempt';
    if (href.startsWith('#backup-')) return '/owner/recovery/tenant-backup';
    return '';
  }

  function shouldDeferAction(value) {
    const normalized = normalizeText(value);
    if (!normalized) return false;
    if (normalized === 'close' || normalized === 'cancel') return false;
    return containsAny(normalized, DEFERRED_PATTERNS);
  }

  function rememberDeferredAction(label, reason) {
    DEFERRED_ACTIONS.push({
      label: normalizeText(label),
      route: currentPath(),
      reason: String(reason || '').trim() || 'deferred',
    });
  }

  function injectBridgeStyle() {
    if (document.getElementById('ownerStitchBridgeStyle')) return;
    const style = document.createElement('style');
    style.id = 'ownerStitchBridgeStyle';
    style.textContent = [
      'body.is-owner-high-contrast { filter: saturate(1.05) brightness(1.03); }',
      '.is-owner-active { font-weight: 800 !important; }',
      '[data-owner-bridge="deferred"] { display: none !important; }',
      '#ownerDeferredNotice { position: fixed; right: 20px; bottom: 20px; z-index: 10000; max-width: 360px; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); background: rgba(17,21,25,.96); color: #e8f1f5; font: 600 12px/1.5 Inter,Segoe UI,sans-serif; box-shadow: 0 18px 40px rgba(0,0,0,.35); transform: translateY(8px); opacity: 0; pointer-events: none; transition: opacity 140ms ease, transform 140ms ease; }',
      '#ownerDeferredNotice.is-visible { opacity: 1; transform: translateY(0); }',
      '#ownerDeferredNotice strong { display: block; margin-bottom: 4px; color: #15d7ff; font-weight: 800; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function isVisible(element) {
    if (!element || element.closest('[hidden]')) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isOwnerMutationSurface(element) {
    if (!element) return false;
    if (element.closest('#owner-control-workspace')) return true;
    if (element.closest('[data-owner-action]')) return true;
    if (element.closest('form[data-owner-form]')) return true;
    if (element.closest('a[download]')) return true;
    return typeof element.matches === 'function'
      && element.matches('[data-owner-action], form[data-owner-form], a[download]');
  }

  function shouldSkipBridge(element) {
    return Boolean(
      element?.closest?.('[data-owner-bridge-skip="true"]')
      || isOwnerMutationSurface(element)
    );
  }

  function isBrandHeading(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    return BRAND_HEADING_PATTERNS.some((pattern) => normalized.includes(pattern));
  }

  function isTopChromeElement(element) {
    if (!element) return false;
    if (element.closest('.topbar')) return true;
    if ((element.closest('header') || element.closest('nav')) && !element.closest('main')) return true;
    return false;
  }

  function findHeaderBlock(primary, main) {
    if (!primary || !main) return null;
    let current = primary.parentElement;
    while (current && current !== main) {
      const children = Array.from(current.children || []);
      const hasPeerActions = children.some((child) => {
        if (child === primary || child.contains(primary)) return false;
        return Boolean(child.querySelector('a,button'));
      });
      if (hasPeerActions) return current;
      current = current.parentElement;
    }
    return primary.closest('header')?.closest('main') ? primary.closest('header') : primary.parentElement;
  }

  function isLikelyPrimaryAction(text, className, bridgeType) {
    const normalized = normalizeText(text);
    const normalizedClass = normalizeText(className);
    if (bridgeType === 'overlay') return true;
    if (normalizedClass.includes('button primary') || normalizedClass.includes('bg cyan') || normalizedClass.includes('primary container')) {
      return true;
    }
    return /(^| )(create|open|run|generate|new|save|restore|provision|issue|dispatch|confirm|activate|apply)( |$)/.test(normalized);
  }

  function tagPrimaryHeading(main) {
    const headings = Array.from(main.querySelectorAll('h1,h2,h3')).filter((element) => {
      if (!isVisible(element)) return false;
      if (element.closest('aside') || element.closest('nav')) return false;
      if (isTopChromeElement(element)) return false;
      const text = String(element.textContent || '').trim();
      if (!text || text.length < 5) return false;
      if (/^[\d\s.$%:/-]+$/.test(text)) return false;
      if (isBrandHeading(text)) return false;
      return true;
    });

    const primary = headings.find((heading) => heading.tagName === 'H1') || headings[0];
    if (!primary) return;
    primary.dataset.ownerRole = 'page-heading';

    const headerBlock = primary.closest('.page-header')
      || findHeaderBlock(primary, main);
    if (headerBlock) {
      headerBlock.dataset.ownerLayout = 'page-header';
      const actionContainer = Array.from(headerBlock.children || []).find((child) => {
        if (child === primary || child.contains(primary)) return false;
        return child.querySelector('button, a');
      });
      if (actionContainer) {
        actionContainer.dataset.ownerLayout = 'page-actions';
      }
      const subtitle = headerBlock.querySelector('p');
      if (subtitle && isVisible(subtitle)) {
        subtitle.dataset.ownerRole = 'page-subtitle';
      }
    }

    headings.slice(1).forEach((heading) => {
      if (!heading.dataset.ownerRole) {
        heading.dataset.ownerRole = 'section-heading';
      }
    });
  }

  function classifyMainControl(element, normalizedText, className) {
    if (!element || !element.closest('main')) return '';
    const rect = element.getBoundingClientRect();
    const withinHeaderActions = Boolean(
      element.closest('.actions')
      || element.closest('[data-owner-layout="page-actions"]'),
    );
    const compactByShape = rect.width <= 72 || rect.height <= 34;
    const compactByClass = /(?:^|\s)(?:text-xs|text-\[10px\]|text-\[11px\]|p-1|p-1\.5|px-3 py-1\.5|w-8|h-8)(?:\s|$)/.test(className);
    const iconOnly = normalizedText.split(' ').length <= 2 && rect.width <= 52;
    const cardLike = Boolean(element.querySelector('div,p,strong,article,section,img'));

    if (withinHeaderActions) {
      return compactByShape || compactByClass || iconOnly ? 'compact-action' : 'action';
    }

    if (cardLike || rect.width > 260) return '';
    if (iconOnly || compactByShape || compactByClass) return 'compact-action';
    if (rect.height >= 34 && rect.height <= 52 && rect.width <= 220) return 'action';
    return '';
  }

  function tagControls() {
    document.querySelectorAll('a,button').forEach((element) => {
      if (!isVisible(element) || element.closest('#ownerLegacyOverlay') || shouldSkipBridge(element)) return;
      if (element.dataset.ownerUi) return;
      if (element.closest('#ownerStitchLiveData')) return;
      const label = extractElementLabel(element);
      const normalizedText = normalizeText(label);
      const className = element.getAttribute('class') || '';

      if (element.classList.contains('topbar__pill')) {
        element.dataset.ownerUi = 'pill';
        return;
      }

      if (isTopChromeElement(element) && (!normalizedText || normalizedText.length <= 24)) {
        element.dataset.ownerUi = normalizedText ? 'pill' : 'toolbar';
        if (element.tagName === 'BUTTON' && !normalizedText) {
          element.dataset.ownerUi = 'toolbar';
        }
        if (element.tagName === 'BUTTON' && /refresh|language|dark mode|dark mode light mode|notifications|logout|sign out|th en|english|thai|contrast/.test(normalizedText)) {
          element.dataset.ownerUi = 'toolbar';
        }
        return;
      }

      const mainControlType = classifyMainControl(element, normalizedText, className);
      if (mainControlType) {
        element.dataset.ownerUi = mainControlType;
        if (mainControlType === 'action') {
          element.dataset.ownerTone = isLikelyPrimaryAction(label, className, element.dataset.ownerBridge || '') ? 'primary' : 'secondary';
        }
      }
    });

    document.querySelectorAll('main input, main select, main textarea').forEach((field) => {
      if (!isVisible(field) || field.id === 'ownerLanguageSelect' || shouldSkipBridge(field)) return;
      if (field.closest('#ownerStitchLiveData')) return;
      field.dataset.ownerUi = 'field';
    });
  }

  function tagShellChrome() {
    const chrome = document.getElementById(TOPBAR_ID) || document.querySelector('.topbar');
    if (chrome) {
      chrome.dataset.ownerChrome = 'topbar';
      chrome.querySelector('nav')?.setAttribute('data-owner-chrome', 'topnav');
    }

    const aside = document.getElementById(SIDEBAR_ID) || document.querySelector('.sidebar');
    if (aside) {
      aside.dataset.ownerChrome = 'sidebar';
      aside.querySelectorAll('a').forEach((link) => {
        link.dataset.ownerSlot = 'sidebar-link';
      });
    }

    const main = document.querySelector('main');
    if (main) {
      main.dataset.ownerChrome = 'workspace';
    }
  }

  function applyProductionPolish() {
    document.body.classList.add('owner-stitch-polished');
    document.body.classList.add('owner-shell-ready');
    renderUnifiedShell();
    tagShellChrome();
    const main = document.querySelector('main');
    if (!main) return;
    tagPrimaryHeading(main);
    tagControls();
  }

  function updateTextWhenVisible(candidates, matcher, nextText) {
    for (const selector of candidates) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        const text = normalizeText(node.textContent);
        if (!text || !matcher(text, node)) continue;
        node.textContent = nextText;
        return true;
      }
    }
    return false;
  }

  function harmonizeOwnerShellCopy() {
    const routeNode = document.querySelector('[data-owner-slot="topbar-route"]');
    if (routeNode) {
      routeNode.textContent = resolveCurrentRouteCopy();
    }
    const localeButton = document.querySelector('#ownerUnifiedTopbar [aria-label="Language"]');
    if (localeButton) {
      const lang = String(document.documentElement.lang || '').trim().toLowerCase();
      localeButton.textContent = lang.startsWith('th') ? 'TH/EN' : 'EN/TH';
    }
    document.querySelectorAll('[data-owner-slot="sidebar-link"]').forEach((link) => {
      const active = elementHasActiveRoute(link);
      link.classList.toggle('is-owner-active', active);
      link.dataset.ownerActive = active ? 'true' : 'false';
    });
  }

  function suppressEmbeddedChromeClutter() {
    const clutterTexts = [
      'docs',
      'api status',
      'logout',
      'sign out',
      'th/en',
      'language (th/en)',
      'search command',
    ];
    document.querySelectorAll('main a, main button, main label, main input, main [role="button"]').forEach((node) => {
      if (
        !node
        || node.closest(`#${TOPBAR_ID}`)
        || node.closest(`#${SIDEBAR_ID}`)
        || node.closest('.owner-live-route-actions')
      ) {
        return;
      }
      const text = normalizeText(
        node.getAttribute?.('aria-label')
        || node.getAttribute?.('placeholder')
        || node.textContent
        || '',
      );
      if (!text) return;
      if (clutterTexts.some((entry) => text === entry || text.includes(entry))) {
        node.setAttribute('hidden', 'hidden');
        node.style.display = 'none';
        node.dataset.ownerBridgeSkip = 'true';
      }
    });
  }

  function applyContrastMode(mode) {
    const enabled = mode === 'high';
    document.body.classList.toggle('is-owner-high-contrast', enabled);
    try {
      if (enabled) {
        window.sessionStorage.setItem(CONTRAST_KEY, 'high');
      } else {
        window.sessionStorage.removeItem(CONTRAST_KEY);
      }
    } catch {}
  }

  function toggleContrastMode() {
    applyContrastMode(document.body.classList.contains('is-owner-high-contrast') ? 'default' : 'high');
  }

  function openLegacyOverlay(focusSelector) {
    const overlay = document.getElementById('ownerLegacyOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    const closeButton = document.getElementById('ownerLegacyOverlayClose');
    window.setTimeout(() => {
      closeButton?.focus();
      if (!focusSelector) return;
      document.querySelector(focusSelector)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }, 40);
  }

  function closeLegacyOverlay() {
    const overlay = document.getElementById('ownerLegacyOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  function postLogout() {
    fetch('/admin/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).finally(() => {
      window.location.assign('/owner/login');
    });
  }

  function setLocale(locale) {
    const next = String(locale || '').trim().toLowerCase().startsWith('th') ? 'th' : 'en';
    document.documentElement.lang = next;
    try {
      window.sessionStorage.setItem(LOCALE_KEY, next);
    } catch {}

    const hiddenSelect = document.getElementById('ownerLanguageSelect');
    if (hiddenSelect) hiddenSelect.value = next;

    document.querySelectorAll('select').forEach((select) => {
      if (select.id === 'ownerLanguageSelect') return;
      const options = Array.from(select.options || []);
      const match = options.find((option) => normalizeText(option.value || option.textContent || '') === next);
      if (match) {
        select.value = match.value;
      }
    });

    const i18n = window.AdminUiI18n;
    if (i18n?.setLocale) {
      void i18n.setLocale(next);
    }
  }

  function cycleLocale() {
    const i18n = window.AdminUiI18n;
    const source = String(i18n?.getLocale?.() || document.documentElement.lang || 'en').toLowerCase();
    setLocale(source.startsWith('th') ? 'en' : 'th');
  }

  function resolveLocaleFromText(normalizedText) {
    if (!normalizedText) return false;
    if (normalizedText === 'en' || normalizedText === 'english' || normalizedText.includes('english us') || normalizedText === 'th en') {
      return 'en';
    }
    if (normalizedText === 'th' || normalizedText.includes('thai th') || normalizedText.includes('\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22')) {
      return 'th';
    }
    return '';
  }

  function isLocaleSelect(select) {
    if (!select) return false;
    if (select.id === 'ownerLanguageSelect') return true;
    if (shouldSkipBridge(select)) return false;
    const sourceText = normalizeText([
      select.getAttribute('aria-label'),
      select.getAttribute('title'),
      select.name,
      select.id,
      select.closest('label')?.textContent,
      select.parentElement?.textContent,
    ].filter(Boolean).join(' '));
    if (sourceText.includes('language')) return true;
    const options = Array.from(select.options || []).map((option) => normalizeText(option.value || option.textContent || ''));
    if (!options.length) return false;
    return options.every((option) => (
      !option
      || option === 'en'
      || option === 'th'
      || option === 'english'
      || option === 'thai'
      || option.includes('english')
      || option.includes('thai')
      || option.includes('\u0e20\u0e32\u0e29\u0e32\u0e44\u0e17\u0e22')
    ));
  }

  function rememberDisabledControl(element, reason) {
    element.setAttribute('aria-disabled', 'true');
    element.setAttribute('title', reason);
    DISABLED_REASONS.push({
      label: normalizeText(element.textContent || element.getAttribute('aria-label') || 'unknown'),
      reason,
    });
  }

  function markActiveNav(element) {
    const href = String(element.getAttribute('href') || '').trim();
    if (href.startsWith('/owner') && elementHasActiveRoute(element)) {
      element.classList.add('is-owner-active');
      element.dataset.ownerActive = 'true';
    }
  }

  function navigateOwnerSurface(target) {
    const nextTarget = String(target || '').trim();
    if (!nextTarget) return;
    if (typeof window.__navigateOwnerStitchRoute === 'function' && nextTarget.startsWith('/owner')) {
      window.__navigateOwnerStitchRoute(nextTarget);
      return;
    }
    window.location.assign(nextTarget);
  }

  function setRouteTarget(element, route) {
    const target = String(route || '').trim();
    if (!target) return;
    element.dataset.ownerBridge = 'route';
    element.dataset.ownerRouteTarget = target;
  }

  function bindRouteNavigation(element, route) {
    const target = String(route || '').trim();
    if (!target) return;
    setRouteTarget(element, target);
    element.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateOwnerSurface(target);
    });
  }

  function openDetailsAncestors(node) {
    if (!node || typeof node.closest !== 'function') return;
    const detailsNodes = [];
    let current = node.closest('details');
    while (current) {
      detailsNodes.push(current);
      current.open = true;
      current = current.parentElement?.closest?.('details') || null;
    }
    detailsNodes.forEach((details) => {
      const state = details.querySelector('.owner-live-disclosure-state');
      if (state && state.textContent.trim() === '+') {
        state.textContent = document.documentElement.lang?.toLowerCase().startsWith('th') ? 'เพิ่มเติม' : 'More';
      }
    });
  }

  function revealHashTarget(options = {}) {
    const hash = String(window.location.hash || '').trim();
    if (!hash || hash === '#') return false;
    const targetId = decodeURIComponent(hash.slice(1));
    const clearLocalHash = () => {
      if (!targetId.startsWith('owner-live-section-')) return;
      history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    if (!targetId) {
      clearLocalHash();
      return false;
    }
    const target = document.getElementById(targetId);
    if (!target) {
      clearLocalHash();
      window.scrollTo({ top: 0, left: 0, behavior: options.smooth === false ? 'auto' : 'smooth' });
      return false;
    }
    openDetailsAncestors(target);
    if (options.scroll !== false) {
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: options.smooth === false ? 'auto' : 'smooth', block: 'start' });
        clearLocalHash();
      }, 32);
    } else {
      clearLocalHash();
    }
    return true;
  }

  function ensureDeferredNotice() {
    let notice = document.getElementById('ownerDeferredNotice');
    if (notice) return notice;
    notice = document.createElement('div');
    notice.id = 'ownerDeferredNotice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    document.body.appendChild(notice);
    return notice;
  }

  let deferredNoticeTimer = null;

  function showDeferredNotice(label, reason) {
    const notice = ensureDeferredNotice();
    const safeLabel = String(label || '').trim() || 'คำสั่งนี้';
    const safeReason = String(reason || '').trim() || 'ฟังก์ชันนี้ยังไม่เปิดบนหน้า Owner ใหม่';
    notice.innerHTML = `<strong>${safeLabel}</strong>${safeReason}`;
    notice.classList.add('is-visible');
    if (deferredNoticeTimer) window.clearTimeout(deferredNoticeTimer);
    deferredNoticeTimer = window.setTimeout(() => {
      notice.classList.remove('is-visible');
    }, 2200);
  }

  function bindDeferredAction(element, label, reason) {
    element.dataset.ownerBridge = 'deferred';
    rememberDisabledControl(element, reason);
    element.addEventListener('click', (event) => {
      event.preventDefault();
      rememberDeferredAction(label, reason);
      showDeferredNotice(label, reason);
    });
  }

  function wireAnchor(anchor) {
    if (!anchor) return;
    if (shouldSkipBridge(anchor)) return;
    if (anchor.dataset.ownerWired === 'true') return;

    const rawHref = String(anchor.getAttribute('href') || '').trim();
    const label = extractElementLabel(anchor) || rawHref;
    const normalizedText = normalizeText(label);

    if (anchor.dataset.ownerNavHasChildren === 'true' && rawHref.startsWith('/owner')) {
      anchor.dataset.ownerBridge = 'sidebar-parent-toggle';
      anchor.addEventListener('click', (event) => {
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        const root = document.getElementById(SIDEBAR_ID) || anchor.closest('[data-owner-shell="sidebar"]');
        if (!root) return;
        const group = anchor.closest('[data-owner-slot="sidebar-group"]');
        toggleSidebarSubmenu(root, rawHref, group);
      });
      markActiveNav(anchor);
      anchor.dataset.ownerWired = 'true';
      return;
    }

    if (rawHref.startsWith('#') && rawHref.length > 1) {
      anchor.dataset.ownerBridge = 'section';
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById(rawHref.slice(1));
        if (!target) return;
        openDetailsAncestors(target);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      anchor.dataset.ownerWired = 'true';
      return;
    }

    if (rawHref.startsWith('/owner') || rawHref.startsWith('/landing')) {
      bindRouteNavigation(anchor, rawHref);
      markActiveNav(anchor);
      anchor.dataset.ownerWired = 'true';
      return;
    }

    const routeFromHref = resolveRouteFromHref(rawHref);
    if (routeFromHref === '__overlay__') {
      bindDeferredAction(anchor, label, 'ฟังก์ชันนี้ยังใช้ผ่านหน้าปฏิบัติการเดิมอยู่ และยังไม่เปิดบนหน้าใหม่');
      anchor.dataset.ownerWired = 'true';
      return;
    }
    if (routeFromHref) {
      anchor.setAttribute('href', routeFromHref);
      bindRouteNavigation(anchor, routeFromHref);
      markActiveNav(anchor);
      anchor.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'logout' || normalizedText === 'sign out' || normalizedText.includes('\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a')) {
      anchor.setAttribute('href', '#');
      anchor.dataset.ownerBridge = 'logout';
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        postLogout();
      });
      anchor.dataset.ownerWired = 'true';
      return;
    }

    if (
      normalizedText === 'api status'
      || normalizedText === 'docs'
      || normalizedText.includes('api statu')
      || normalizedText.includes(' doc')
      || normalizedText.endsWith('doc')
    ) {
      const route = '/owner/diagnostics';
      anchor.setAttribute('href', route);
      bindRouteNavigation(anchor, route);
      anchor.dataset.ownerWired = 'true';
      return;
    }

    const route = resolveRouteFromText(normalizedText);
    if (route) {
      anchor.setAttribute('href', route);
      bindRouteNavigation(anchor, route);
      markActiveNav(anchor);
      anchor.dataset.ownerWired = 'true';
      return;
    }

    const workflowTarget = resolveWorkflowTarget(normalizedText);
    if (workflowTarget) {
      anchor.setAttribute('href', workflowTarget);
      bindRouteNavigation(anchor, workflowTarget);
      anchor.dataset.ownerWired = 'true';
      return;
    }

    if (
      anchor.hasAttribute('data-open-live-workspace')
      || rawHref === '#'
      || rawHref === ''
      || rawHref.toLowerCase().startsWith('javascript:')
      || shouldDeferAction(normalizedText)
    ) {
      bindDeferredAction(anchor, label, 'ฟังก์ชันนี้ยังไม่เปิดจากหน้าใหม่ ให้ใช้ flow ปฏิบัติการหลักเดิมชั่วคราว');
      anchor.dataset.ownerWired = 'true';
      return;
    }

    bindDeferredAction(anchor, label, 'รายการนี้ยังไม่มีปลายทางที่รองรับบนหน้า Owner ใหม่');
    anchor.dataset.ownerWired = 'true';
  }

  function wireButton(button) {
    if (!button) return;
    if (shouldSkipBridge(button)) return;
    if (button.dataset.ownerWired === 'true') return;
    if (button.matches?.('[data-owner-slot="sidebar-group-toggle"], [data-owner-slot="sidebar-submenu-toggle"]')) {
      button.dataset.ownerBridge = 'sidebar-toggle';
      button.dataset.ownerWired = 'true';
      return;
    }

    const label = extractElementLabel(button);
    const normalizedText = normalizeText(label);
    if (!normalizedText) return;

    if (
      normalizedText === 'refresh'
      || normalizedText === '\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a'
      || normalizedText === '\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15'
    ) {
      button.dataset.ownerBridge = 'refresh';
      button.addEventListener('click', () => window.location.reload());
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'language' || normalizedText === 'language th en' || normalizedText.includes('language th') || normalizedText === 'th en') {
      button.dataset.ownerBridge = 'locale';
      button.addEventListener('click', cycleLocale);
      button.dataset.ownerWired = 'true';
      return;
    }

    const explicitLocale = resolveLocaleFromText(normalizedText);
    if (explicitLocale) {
      button.dataset.ownerBridge = 'locale';
      button.addEventListener('click', () => {
        setLocale(explicitLocale);
      });
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'dark mode' || normalizedText === 'dark mode light mode' || normalizedText === 'dark mode light mode') {
      button.dataset.ownerBridge = 'contrast';
      button.addEventListener('click', toggleContrastMode);
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'dark mode' || normalizedText === 'dark mode light mode' || normalizedText === 'dark_mode' || normalizedText === 'contrast') {
      button.dataset.ownerBridge = 'contrast';
      button.addEventListener('click', toggleContrastMode);
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'notifications' || normalizedText === 'notifications active') {
      const route = '/owner/automation';
      setRouteTarget(button, route);
      button.addEventListener('click', () => {
        navigateOwnerSurface(route);
      });
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'logout' || normalizedText === 'sign out' || normalizedText.includes('\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a')) {
      button.dataset.ownerBridge = 'logout';
      button.addEventListener('click', postLogout);
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText.includes('confirm restore') || normalizedText.includes('confirm_restore')) {
      bindDeferredAction(button, label, 'คำสั่งกู้คืนจริงยังถูกปิดบนหน้าใหม่เพื่อป้องกันการกระทบระบบหลัก');
      button.dataset.ownerWired = 'true';
      return;
    }

    const route = resolveRouteFromText(normalizedText);
    if (route) {
      setRouteTarget(button, route);
      button.addEventListener('click', () => {
        navigateOwnerSurface(route);
      });
      button.dataset.ownerWired = 'true';
      return;
    }

    const workflowTarget = resolveWorkflowTarget(normalizedText);
    if (workflowTarget) {
      setRouteTarget(button, workflowTarget);
      button.addEventListener('click', () => {
        navigateOwnerSurface(workflowTarget);
      });
      button.dataset.ownerWired = 'true';
      return;
    }

    if (button.hasAttribute('data-open-live-workspace') || shouldDeferAction(normalizedText)) {
      bindDeferredAction(button, label, 'ฟังก์ชันนี้ยังไม่เปิดจากหน้าใหม่ ให้ใช้ workflow เดิมชั่วคราว');
      button.dataset.ownerWired = 'true';
      return;
    }

    if (/^\d+$/.test(normalizedText) || normalizedText === '...' || normalizedText === 'all' || normalizedText === 'new' || normalizedText === 'paid' || normalizedText === 'failed' || normalizedText === 'draft' || normalizedText === 'success' || normalizedText === 'failure' || normalizedText === 'all events') {
      bindDeferredAction(button, label, 'ตัวกรองหรือปุ่มย่อยนี้ยังไม่เปิดใช้งานบนหน้าใหม่');
      button.dataset.ownerWired = 'true';
      return;
    }

    if (normalizedText === 'close') {
      const overlay = document.getElementById('ownerLegacyOverlay');
      if (overlay && overlay.hidden === false) {
        button.addEventListener('click', closeLegacyOverlay);
      } else {
        bindDeferredAction(button, label, 'ไม่มีหน้าต่างปฏิบัติการที่เปิดอยู่');
      }
      button.dataset.ownerWired = 'true';
      return;
    }

    if (
      normalizedText === 'api status'
      || normalizedText === 'docs'
      || normalizedText.includes('api statu')
      || normalizedText.includes(' doc')
      || normalizedText.endsWith('doc')
    ) {
      const route = '/owner/diagnostics';
      setRouteTarget(button, route);
      button.addEventListener('click', () => {
        navigateOwnerSurface(route);
      });
      button.dataset.ownerWired = 'true';
      return;
    }

    bindDeferredAction(button, label, 'ปุ่มนี้ยังไม่ผูกกับ flow ใหม่ของ Owner');
    button.dataset.ownerWired = 'true';
  }

  function patchNavigation() {
    document.querySelectorAll('a').forEach(wireAnchor);
    document.querySelectorAll('button').forEach(wireButton);
  }

  function bridgeVisibleLanguageControl() {
    const selects = Array.from(document.querySelectorAll('select')).filter(isLocaleSelect);
    selects.forEach((select) => {
      if (select.dataset.ownerLocaleWired === 'true') return;
      select.addEventListener('change', () => {
        const selectedText = normalizeText(select.value || select.selectedOptions?.[0]?.textContent || '');
        setLocale(resolveLocaleFromText(selectedText) || 'en');
      });
      select.dataset.ownerLocaleWired = 'true';
    });
  }

  function wireOverlayClose() {
    document.getElementById('ownerLegacyOverlayClose')?.addEventListener('click', closeLegacyOverlay);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLegacyOverlay();
    });
  }

  function lockDocumentTitle() {
    const titleElement = document.querySelector('title');
    if (!titleElement) return;
    const restore = () => {
      if (document.title !== STITCH_DOCUMENT_TITLE) {
        document.title = STITCH_DOCUMENT_TITLE;
      }
    };
    restore();
    window.setTimeout(restore, TITLE_LOCK_DELAY_MS);
    const observer = new MutationObserver(restore);
    observer.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function reportBridgeState() {
    window.__OWNER_STITCH_DISABLED__ = DISABLED_REASONS.slice();
    window.__OWNER_STITCH_DEFERRED__ = DEFERRED_ACTIONS.slice();
  }

  let refreshBindingsTimer = null;

  function scheduleRefreshBindings() {
    if (refreshBindingsTimer) window.clearTimeout(refreshBindingsTimer);
    refreshBindingsTimer = window.setTimeout(() => {
      refreshBindingsTimer = null;
      refreshBridgeBindings();
    }, 40);
  }

  function observeDynamicContent() {
    const main = document.querySelector('main');
    if (!main || window.__OWNER_STITCH_OBSERVER__) return;
    const observer = new MutationObserver((mutations) => {
      const shouldRefresh = mutations.some((mutation) => {
        if (mutation.type !== 'childList') return false;
        const added = Array.from(mutation.addedNodes || []);
        return added.some((node) => {
          if (!(node instanceof Element)) return false;
          return node.matches?.('a,button,select,main *') || Boolean(node.querySelector?.('a,button,select'));
        });
      });
      if (shouldRefresh) scheduleRefreshBindings();
    });
    observer.observe(main, {
      childList: true,
      subtree: true,
    });
    window.__OWNER_STITCH_OBSERVER__ = observer;
  }

  function refreshBridgeBindings() {
    applyProductionPolish();
    syncMaterialIcons(document);
    syncSidebarGroups(document.getElementById(SIDEBAR_ID));
    syncSidebarPageSections(window.__OWNER_STITCH_LAST_RENDER__ || null);
    sanitizeSidebarChrome(document.getElementById(SIDEBAR_ID));
    patchNavigation();
    bridgeVisibleLanguageControl();
    harmonizeOwnerShellCopy();
    suppressEmbeddedChromeClutter();
    const revealedHashTarget = revealHashTarget({ scroll: false });
    if (!revealedHashTarget && !window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    reportBridgeState();
  }

  function initOwnerStitchBridge() {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    injectBridgeStyle();
    applyContrastMode((() => {
      try {
        return window.sessionStorage.getItem(CONTRAST_KEY) || 'default';
      } catch {
        return 'default';
      }
    })());
    wireOverlayClose();
    refreshBridgeBindings();
    lockDocumentTitle();
    window.setTimeout(refreshBridgeBindings, 80);
    observeDynamicContent();
    window.addEventListener('owner-live-rendered', (event) => {
      window.__OWNER_STITCH_LAST_RENDER__ = event?.detail || null;
      refreshBridgeBindings();
    });
    window.addEventListener('owner-state-updated', () => {
      scheduleRefreshBindings();
    });
    window.addEventListener('ui-language-change', () => {
      scheduleRefreshBindings();
    });
    window.addEventListener('hashchange', () => {
      window.setTimeout(() => revealHashTarget({ smooth: false }), 16);
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initOwnerStitchBridge, { once: true });
  } else {
    initOwnerStitchBridge();
  }
})();
