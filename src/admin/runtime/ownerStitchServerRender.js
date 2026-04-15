'use strict';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  const objectValue = asObject(value);
  if (Array.isArray(objectValue.items)) return objectValue.items;
  if (Array.isArray(objectValue.rows)) return objectValue.rows;
  if (Array.isArray(objectValue.list)) return objectValue.list;
  if (Array.isArray(objectValue.data)) return objectValue.data;
  return [];
}

function trimText(value, maxLen) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (Number.isFinite(maxLen) && maxLen > 0 && text.length > maxLen) {
    return `${text.slice(0, maxLen - 1)}...`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePath(value) {
  const raw = String(value || '/owner').split('?')[0].split('#')[0].trim();
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.replace(/\/+$/, '') || '/owner';
}

function pathSegments(pathname) {
  return normalizePath(pathname).split('/').filter(Boolean);
}

function segmentAt(pathname, index) {
  const value = pathSegments(pathname)[index] || '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatNumber(value, fallback = '0') {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-US').format(numeric)
    : fallback;
}

function formatCurrency(value, currency = 'THB', divisor = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: trimText(currency, 8).toUpperCase() || 'THB',
    maximumFractionDigits: 2,
  }).format(numeric / divisor);
}

function mergeArrays() {
  return Array.from(arguments).flatMap((value) => toArray(value)).filter(Boolean);
}

function uniqueById(rows, keys) {
  const seen = new Set();
  return toArray(rows).filter((row) => {
    const record = asObject(row);
    const key = keys.map((candidate) => trimText(record[candidate], 180)).find(Boolean)
      || JSON.stringify(record);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findRecord(rows, targetId, keys) {
  const id = trimText(targetId, 180);
  return uniqueById(rows, keys || [
    'id',
    'tenantId',
    'subscriptionId',
    'invoiceId',
    'paymentAttemptId',
    'runtimeKey',
    'file',
  ]).find((row) => {
    const record = asObject(row);
    return (keys || Object.keys(record))
      .map((key) => trimText(record[key], 180))
      .includes(id);
  }) || null;
}

function textCell(primary, secondary) {
  const main = escapeHtml(trimText(primary, 180) || '-');
  const sub = trimText(secondary, 220);
  return sub ? `${main}<small>${escapeHtml(sub)}</small>` : main;
}

function metricSection(title, metrics) {
  const items = toArray(metrics).filter((item) => trimText(item.label, 80) || trimText(item.value, 80));
  if (!items.length) return '';
  return `
    <section class="owner-live-panel" data-owner-section="panel" data-owner-section-label="${escapeHtml(title)}">
      <div class="owner-live-head">
        <span data-owner-role="section-heading">${escapeHtml(title)}</span>
      </div>
      <div class="owner-live-grid owner-live-metrics">
        ${items.map((item) => `
          <article class="owner-live-panel owner-live-kv-card owner-live-metric">
            <span data-owner-role="section-heading">${escapeHtml(trimText(item.label, 80))}</span>
            <strong>${escapeHtml(trimText(item.value, 120) || '-')}</strong>
            ${item.detail ? `<div class="owner-live-note">${escapeHtml(trimText(item.detail, 180))}</div>` : ''}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function panelSection(title, detail, extraHtml = '') {
  return `
    <section class="owner-live-panel" data-owner-section="panel" data-owner-section-label="${escapeHtml(title)}">
      <div class="owner-live-head">
        <span data-owner-role="section-heading">${escapeHtml(title)}</span>
        ${detail ? `<p>${escapeHtml(trimText(detail, 240))}</p>` : ''}
      </div>
      ${extraHtml}
    </section>
  `;
}

function emptyState(title, detail) {
  return `
    <section class="owner-live-panel owner-live-empty" data-owner-section="panel" data-owner-section-label="${escapeHtml(title)}">
      <strong>${escapeHtml(title)}</strong>
      <div class="owner-live-note">${escapeHtml(trimText(detail, 220) || 'No live data is available for this route yet.')}</div>
    </section>
  `;
}

function tableSection(title, rows, columns, options = {}) {
  const safeRows = toArray(rows);
  if (!safeRows.length) return emptyState(title, options.emptyMessage || 'No live rows are available yet.');
  const safeColumns = Array.isArray(columns) && columns.length
    ? columns
    : [{ label: 'Item', render: (row) => textCell(row?.id || row?.name || row?.label || '-', '') }];
  return `
    <section class="owner-live-panel" data-owner-section="table" data-owner-section-label="${escapeHtml(title)}">
      <div class="owner-live-head">
        <span data-owner-role="section-heading">${escapeHtml(title)}</span>
        ${options.note ? `<p>${escapeHtml(trimText(options.note, 220))}</p>` : ''}
      </div>
      <div class="odvc4-table-wrap">
        <table class="odvc4-table owner-live-table">
          <thead>
            <tr>${safeColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${safeRows.map((row) => `
              <tr>
                ${safeColumns.map((column) => `<td>${typeof column.render === 'function' ? column.render(row) : textCell(asObject(row)[column.key], '')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function detailCardsSection(title, record, preferredKeys) {
  const source = asObject(record);
  const keys = (preferredKeys || Object.keys(source))
    .filter((key) => source[key] !== null && source[key] !== undefined && typeof source[key] !== 'object')
    .slice(0, 8);
  if (!keys.length) return emptyState(title, 'No detail fields are available for this record.');
  return metricSection(title, keys.map((key) => ({
    label: key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim(),
    value: source[key],
  })));
}

function pageLayout(primarySections, sideSections) {
  const primary = toArray(primarySections).filter(Boolean).join('');
  const side = toArray(sideSections).filter(Boolean).join('');
  if (!side) {
    return `<div class="owner-live-page-main">${primary}</div>`;
  }
  return `
    <div class="owner-live-page-grid">
      <div class="owner-live-page-main">${primary}</div>
      <aside class="owner-live-page-side">${side}</aside>
    </div>
  `;
}

function digestSection(title, detail, items) {
  const rows = toArray(items).filter((item) => trimText(item.label, 80) || trimText(item.value, 120) || trimText(item.note, 200));
  if (!rows.length) return '';
  return panelSection(title, detail, `
    <div class="owner-live-digest">
      ${rows.map((item) => `
        <article class="owner-live-digest-item">
          ${item.label ? `<span data-owner-role="section-heading">${escapeHtml(trimText(item.label, 80))}</span>` : ''}
          ${item.value ? `<strong>${escapeHtml(trimText(item.value, 160))}</strong>` : ''}
          ${item.note ? `<div class="owner-live-note">${escapeHtml(trimText(item.note, 220))}</div>` : ''}
        </article>
      `).join('')}
    </div>
  `);
}

function featureListSection(title, detail, values) {
  const rows = toArray(values).map((value) => trimText(value, 120)).filter(Boolean);
  if (!rows.length) return '';
  return panelSection(title, detail, `
    <div class="owner-live-chip-grid">
      ${rows.map((value) => `<span class="owner-live-chip">${escapeHtml(value)}</span>`).join('')}
    </div>
  `);
}

function firstTextValue(recordValue, keys, maxLen = 160) {
  const record = asObject(recordValue);
  return toArray(keys)
    .map((key) => trimText(record[key], maxLen))
    .find(Boolean) || '';
}

function topCounts(rows, keys, limit = 5) {
  const counts = new Map();
  toArray(rows).forEach((row) => {
    const label = firstTextValue(row, keys, 120);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, Math.max(1, limit))
    .map(([label, count]) => ({ label, count }));
}

function statItem(label, value, note) {
  return {
    label,
    value: trimText(value, 160) || '-',
    note: trimText(note, 220),
  };
}

function gatherCollections(payloadValue) {
  const payload = asObject(payloadValue);
  const overview = asObject(payload.overview);
  return {
    tenants: mergeArrays(payload.tenants, payload.tenantRows, payload.customers, overview.tenants, overview.customers),
    packages: mergeArrays(payload.packages, payload.packageCatalog, overview.packages, asObject(overview.publicOverview).billing?.packages),
    features: mergeArrays(payload.features, overview.features, asObject(asObject(overview.publicOverview).billing).features),
    subscriptions: mergeArrays(payload.subscriptions, payload.billingSubscriptions, overview.subscriptions),
    invoices: mergeArrays(payload.billingInvoices, payload.invoices),
    attempts: mergeArrays(payload.billingPaymentAttempts, payload.paymentAttempts),
    agents: mergeArrays(payload.agents, payload.runtimes, payload.runtimeRows, payload.agentPresence),
    auditEvents: mergeArrays(payload.auditEvents, payload.auditLog, payload.securityEvents),
    backups: mergeArrays(payload.backupFiles, payload.backups, payload.restoreHistory),
  };
}

function routeKeyFromPath(pathname) {
  const path = normalizePath(pathname);
  const parts = pathSegments(path);
  if (path === '/owner' || path === '/owner/dashboard') return 'overview';
  if (path === '/owner/tenants') return 'tenants';
  if (path === '/owner/tenants/new') return 'tenant-create';
  if (parts[0] === 'owner' && parts[1] === 'tenants' && parts[2]) return 'tenant-detail';
  if (path === '/owner/packages') return 'packages';
  if (path === '/owner/packages/create') return 'packages-create';
  if (path === '/owner/packages/entitlements') return 'packages-entitlements';
  if (parts[0] === 'owner' && parts[1] === 'packages' && parts[2]) return 'package-detail';
  if (path === '/owner/subscriptions') return 'subscriptions';
  if (path === '/owner/subscriptions/registry') return 'subscriptions-registry';
  if (parts[0] === 'owner' && parts[1] === 'subscriptions' && parts[2]) return 'subscription-detail';
  if (path === '/owner/billing') return 'billing';
  if (path === '/owner/billing/recovery') return 'billing-recovery';
  if (path === '/owner/billing/attempts') return 'billing-attempts';
  if (path === '/owner/billing/invoice' || (parts[0] === 'owner' && parts[1] === 'billing' && parts[2] === 'invoice')) return 'invoice-detail';
  if (path === '/owner/billing/attempt' || (parts[0] === 'owner' && parts[1] === 'billing' && parts[2] === 'attempt')) return 'attempt-detail';
  if (path === '/owner/runtime' || path === '/owner/runtime/overview') return 'runtime';
  if (path === '/owner/runtime/create-server') return 'runtime-create-server';
  if (path === '/owner/runtime/provision-runtime') return 'runtime-provision-runtime';
  if (path === '/owner/runtime/agents-bots') return 'agents-bots';
  if (path === '/owner/runtime/fleet-diagnostics') return 'fleet-diagnostics';
  if (path === '/owner/incidents') return 'incidents';
  if (path === '/owner/jobs') return 'jobs';
  if (path === '/owner/analytics' || path === '/owner/analytics/overview' || path === '/owner/observability') return 'analytics';
  if (path === '/owner/analytics/risk') return 'analytics-risk';
  if (path === '/owner/analytics/packages') return 'analytics-packages';
  if (path === '/owner/automation') return 'automation';
  if (path === '/owner/support') return 'support';
  if (parts[0] === 'owner' && parts[1] === 'support' && parts[2]) return 'support-detail';
  if (path === '/owner/audit') return 'audit';
  if (path === '/owner/security' || path === '/owner/security/overview') return 'security';
  if (path === '/owner/access') return 'access';
  if (path === '/owner/diagnostics') return 'diagnostics';
  if (path === '/owner/settings' || path === '/owner/settings/overview') return 'settings';
  if (path === '/owner/settings/admin-users') return 'settings-admin-users';
  if (path === '/owner/settings/services') return 'settings-services';
  if (path === '/owner/settings/access-policy') return 'settings-access-policy';
  if (path === '/owner/settings/portal-policy') return 'settings-portal-policy';
  if (path === '/owner/settings/billing-policy') return 'settings-billing-policy';
  if (path === '/owner/settings/runtime-policy') return 'settings-runtime-policy';
  if (path === '/owner/control') return 'control';
  if (path === '/owner/recovery' || path === '/owner/recovery/overview') return 'recovery';
  if (path === '/owner/recovery/create') return 'recovery-create';
  if (path === '/owner/recovery/preview') return 'recovery-preview';
  if (path === '/owner/recovery/restore') return 'recovery-restore';
  if (path === '/owner/recovery/history') return 'recovery-history';
  if (parts[0] === 'owner' && parts[1] === 'recovery' && parts[2] === 'tenant-backup') return 'backup-detail';
  return 'overview';
}

function routeMeta(pathname, routeKey) {
  const detail = segmentAt(pathname, routeKey === 'invoice-detail' || routeKey === 'attempt-detail' || routeKey === 'backup-detail' ? 3 : 2);
  const metaByRoute = {
    overview: { title: 'Platform overview', subtitle: 'Operational summary, tenant posture, billing state, and current platform signals.' },
    tenants: { title: 'Tenant management', subtitle: 'Active tenants, package assignment, and lifecycle posture.' },
    'tenant-create': { title: 'Create tenant', subtitle: 'Provision a new tenant, choose package defaults, and prepare onboarding.' },
    'tenant-detail': { title: `Tenant dossier: ${detail || 'Tenant'}`, subtitle: 'Commercial, runtime, and support context for the selected tenant.' },
    packages: { title: 'Package management', subtitle: 'Service tiers, feature mapping, and adoption across tenants.' },
    'packages-create': { title: 'Create package', subtitle: 'Create a package without mixing the live catalog or entitlement matrix.' },
    'packages-entitlements': { title: 'Package entitlements', subtitle: 'Review the package entitlement matrix separately from package editing.' },
    'package-detail': { title: `Package detail: ${detail || 'Package'}`, subtitle: 'Feature coverage and tenant usage for the selected package.' },
    subscriptions: { title: 'Subscriptions', subtitle: 'Subscription lifecycle, invoice posture, and payment follow-up.' },
    'subscriptions-registry': { title: 'Subscription registry', subtitle: 'Review subscription records separately from invoice or attempt recovery.' },
    'subscription-detail': { title: `Subscription detail: ${detail || 'Subscription'}`, subtitle: 'Subscription status, invoice linkage, and payment history.' },
    billing: { title: 'Billing overview', subtitle: 'Revenue signals, invoices, payment attempts, and commercial risk.' },
    'billing-recovery': { title: 'Billing recovery', subtitle: 'Resolve overdue invoices and failed payment attempts without mixing invoice registry work.' },
    'billing-attempts': { title: 'Payment attempts', subtitle: 'Inspect payment attempt outcomes separately from invoice management.' },
    'invoice-detail': { title: `Invoice detail: ${detail || 'Invoice'}`, subtitle: 'Invoice fields, tenant linkage, and payment evidence.' },
    'attempt-detail': { title: `Payment attempt: ${detail || 'Attempt'}`, subtitle: 'Payment attempt detail and linked invoice context.' },
    runtime: { title: 'Runtime overview', subtitle: 'Delivery Agent and Server Bot posture, queue state, and runtime readiness.' },
    'runtime-create-server': { title: 'Create server record', subtitle: 'Register the control-plane server before provisioning any runtime credentials.' },
    'runtime-provision-runtime': { title: 'Provision runtime', subtitle: 'Issue one-time setup tokens for Delivery Agent and Server Bot roles.' },
    'agents-bots': { title: 'Runtime registry', subtitle: 'Registered runtimes, device binding, and operational state.' },
    'fleet-diagnostics': { title: 'Runtime diagnostics', subtitle: 'Version drift, queue pressure, and runtime verification signals.' },
    incidents: { title: 'Incidents and alerts', subtitle: 'Recent operational alerts, security events, and degraded signals.' },
    jobs: { title: 'Job queue', subtitle: 'Delivery queue, dead letters, and retry posture from current backend data.' },
    analytics: { title: 'Analytics overview', subtitle: 'Request telemetry, hotspots, and current platform activity.' },
    'analytics-risk': { title: 'Risk queue', subtitle: 'Review owner risk signals without mixing package adoption or top-line metrics.' },
    'analytics-packages': { title: 'Package usage', subtitle: 'Inspect package adoption separately from risk and summary metrics.' },
    automation: { title: 'Automation and notifications', subtitle: 'Scheduled work, automation posture, and recovery signals.' },
    support: { title: 'Support and diagnostics', subtitle: 'Support queue posture, diagnostics signals, and dead-letter evidence.' },
    'support-detail': { title: `Support detail: ${detail || 'Support case'}`, subtitle: 'Context for the selected support flow or tenant case.' },
    audit: { title: 'Audit trail', subtitle: 'Operator actions, security events, and current audit evidence.' },
    security: { title: 'Security overview', subtitle: 'Auth events, session posture, and suspicious activity signals.' },
    access: { title: 'Access posture', subtitle: 'Access model, operator surface, and privileged entry points.' },
    diagnostics: { title: 'Diagnostics and evidence', subtitle: 'Request failures, export posture, and evidence bundles.' },
    settings: { title: 'Settings overview', subtitle: 'Managed services, file roots, and apply policy signals.' },
    'settings-admin-users': { title: 'Admin users', subtitle: 'Manage Owner administrators separately from broader platform policy.' },
    'settings-services': { title: 'Managed services', subtitle: 'Review shared managed services separately from automation or policy editing.' },
    'settings-access-policy': { title: 'Access policy', subtitle: 'Adjust owner access, session, and security policy without mixing portal or billing settings.' },
    'settings-portal-policy': { title: 'Portal policy', subtitle: 'Review player-portal policy separately from owner access or runtime settings.' },
    'settings-billing-policy': { title: 'Billing policy', subtitle: 'Configure provider and billing behavior without mixing unrelated platform controls.' },
    'settings-runtime-policy': { title: 'Runtime policy', subtitle: 'Review orchestration and runtime service policy separately from other owner settings.' },
    control: { title: 'Platform controls', subtitle: 'Critical platform actions, runtime guardrails, and recovery entry points.' },
    recovery: { title: 'Recovery overview', subtitle: 'Restore status, backup files, and recovery history.' },
    'recovery-create': { title: 'Create backup', subtitle: 'Create a backup without mixing preview or restore actions.' },
    'recovery-preview': { title: 'Restore preview', subtitle: 'Validate restore impact separately from guarded restore actions.' },
    'recovery-restore': { title: 'Apply restore', subtitle: 'Run a guarded restore with only the required controls visible.' },
    'recovery-history': { title: 'Recovery history', subtitle: 'Review recovery history without mixing current backup or restore actions.' },
    'backup-detail': { title: `Backup detail: ${detail || 'Backup'}`, subtitle: 'Backup metadata and restore context for the selected snapshot.' },
  };
  return {
    ...(metaByRoute[routeKey] || metaByRoute.overview),
    routeKey,
  };
}

function routeVisualPresentation(routeKey) {
  const key = trimText(routeKey, 80).toLowerCase();
  if (key === 'recovery' || key === 'backup-detail') {
    return {
      visual: 'recovery',
      eyebrow: 'Recovery workspace',
      badges: ['Backups', 'Preview guard', 'Restore history'],
      focus: 'Keep backup creation, preview validation, and restore execution visibly separated.',
      highlights: ['Backup create', 'Preview guard', 'Restore apply'],
    };
  }
  if ([
    'packages',
    'package-detail',
    'subscriptions',
    'subscription-detail',
    'billing',
    'invoice-detail',
    'attempt-detail',
  ].includes(key)) {
    return {
      visual: 'commerce',
      eyebrow: 'Commercial operations',
      badges: ['Packages', 'Subscriptions', 'Billing'],
      focus: 'Work catalog, renewals, and billing recovery as separate tracks instead of one long page.',
      highlights: ['Catalog control', 'Renewal queue', 'Invoice recovery'],
    };
  }
  if ([
    'runtime',
    'agents-bots',
    'fleet-diagnostics',
    'incidents',
    'jobs',
    'support',
    'support-detail',
  ].includes(key)) {
    return {
      visual: 'runtime',
      eyebrow: 'Runtime orchestration',
      badges: ['Delivery Agent', 'Server Bot', 'Operations'],
      focus: 'Handle server registration, setup token issue, and runtime review as distinct operator steps.',
      highlights: ['Server record', 'Token issue', 'Registry review'],
    };
  }
  if (key === 'analytics' || key === 'automation') {
    return {
      visual: 'analytics',
      eyebrow: 'Operational telemetry',
      badges: ['Signals', 'Automation', 'Trend watch'],
      focus: 'Keep telemetry, scheduled actions, and operator escalations readable without mixing workflows.',
      highlights: ['Signals', 'Automation runs', 'Escalation queue'],
    };
  }
  if ([
    'audit',
    'security',
    'access',
    'diagnostics',
    'settings',
    'control',
  ].includes(key)) {
    return {
      visual: 'governance',
      eyebrow: 'Governance and security',
      badges: ['Access', 'Security', 'Diagnostics'],
      focus: 'Separate audit evidence, access review, and platform policy so each control surface stays precise.',
      highlights: ['Audit evidence', 'Access review', 'Policy controls'],
    };
  }
  return {
    visual: 'overview',
    eyebrow: 'Owner command center',
    badges: ['Tenants', 'Revenue', 'Runtime watch'],
    focus: 'Scan commercial risk, tenant posture, and runtime health before drilling into a focused workspace.',
    highlights: ['Priority queue', 'Revenue posture', 'Runtime watch'],
  };
}

function wrapOwnerRouteShell(routeKey, bodyHtml) {
  return [
    `<div class="owner-live-route-shell" data-owner-route-key="${escapeHtml(trimText(routeKey, 80).toLowerCase() || 'overview')}">`,
    `<div class="owner-live-route-content">${bodyHtml || ''}</div>`,
    '</div>',
  ].join('');
}

function actionLink(label, href, tone = 'default') {
  const safeLabel = trimText(label, 120);
  const safeHref = trimText(href, 240);
  if (!safeLabel || !safeHref) return '';
  const toneAttr = tone === 'primary' ? ' data-owner-tone="primary"' : '';
  return `<a href="${escapeHtml(safeHref)}" data-owner-ui="action"${toneAttr}>${escapeHtml(safeLabel)}</a>`;
}

function routeActionLinks(pathname, routeKey) {
  switch (routeKey) {
    case 'overview':
      return [
        actionLink('สร้างผู้เช่าใหม่', '/owner/tenants/new', 'primary'),
        actionLink('Subscriptions', '/owner/subscriptions'),
        actionLink('Runtime Overview', '/owner/runtime/overview'),
      ];
    case 'tenants':
      return [
        actionLink('สร้างผู้เช่าใหม่', '/owner/tenants/new', 'primary'),
        actionLink('Billing', '/owner/billing'),
      ];
    case 'tenant-create':
      return [
        actionLink('Tenant List', '/owner/tenants'),
        actionLink('Packages', '/owner/packages'),
      ];
    case 'tenant-detail':
      return [
        actionLink('Tenant List', '/owner/tenants'),
        actionLink('Runtime Overview', '/owner/runtime/overview'),
      ];
    case 'packages':
      return [
        actionLink('Subscriptions', '/owner/subscriptions'),
        actionLink('Billing', '/owner/billing'),
      ];
    case 'package-detail':
      return [
        actionLink('Packages', '/owner/packages'),
        actionLink('Tenants', '/owner/tenants'),
      ];
    case 'subscriptions':
      return [
        actionLink('Billing Overview', '/owner/billing'),
        actionLink('Open Payment Attempt', '/owner/billing/attempt', 'primary'),
      ];
    case 'subscription-detail':
      return [
        actionLink('Subscriptions', '/owner/subscriptions'),
        actionLink('Invoice Detail', '/owner/billing/invoice'),
      ];
    case 'billing':
      return [
        actionLink('Subscriptions', '/owner/subscriptions'),
        actionLink('Billing Recovery', '/owner/billing/recovery'),
        actionLink('Invoice Detail', '/owner/billing/invoice'),
        actionLink('Open Payment Attempt', '/owner/billing/attempt'),
      ];
    case 'billing-recovery':
      return [
        actionLink('Billing Overview', '/owner/billing'),
        actionLink('Payment Attempts', '/owner/billing/attempts'),
      ];
    case 'invoice-detail':
    case 'attempt-detail':
      return [
        actionLink('Billing Overview', '/owner/billing'),
        actionLink('Subscriptions', '/owner/subscriptions'),
      ];
    case 'runtime':
      return [
        actionLink('Create Server', '/owner/runtime/create-server', 'primary'),
        actionLink('Provision Runtime', '/owner/runtime/provision-runtime'),
        actionLink('Runtime Registry', '/owner/runtime/agents-bots'),
      ];
    case 'runtime-create-server':
      return [
        actionLink('Runtime Overview', '/owner/runtime/overview'),
        actionLink('Provision Runtime', '/owner/runtime/provision-runtime', 'primary'),
      ];
    case 'runtime-provision-runtime':
      return [
        actionLink('Create Server', '/owner/runtime/create-server'),
        actionLink('Runtime Registry', '/owner/runtime/agents-bots', 'primary'),
      ];
    case 'agents-bots':
      return [
        actionLink('Runtime Overview', '/owner/runtime/overview'),
        actionLink('Provision Runtime', '/owner/runtime/provision-runtime'),
        actionLink('Runtime Diagnostics', '/owner/runtime/fleet-diagnostics'),
      ];
    case 'fleet-diagnostics':
      return [
        actionLink('Runtime Overview', '/owner/runtime/overview'),
        actionLink('Incidents', '/owner/incidents'),
      ];
    case 'incidents':
      return [
        actionLink('Open Tenant', '/owner/tenants/context', 'primary'),
        actionLink('Audit Trail', '/owner/audit'),
        actionLink('Support', '/owner/support'),
      ];
    case 'jobs':
      return [
        actionLink('Analytics Overview', '/owner/analytics/overview'),
        actionLink('Automation', '/owner/automation'),
      ];
    case 'analytics':
      return [
        actionLink('Jobs', '/owner/jobs', 'primary'),
        actionLink('Automation', '/owner/automation'),
      ];
    case 'automation':
      return [
        actionLink('Analytics Overview', '/owner/analytics/overview'),
        actionLink('Recovery Overview', '/owner/recovery/overview'),
      ];
    case 'support':
      return [
        actionLink('Open Support Case', '/owner/support/context', 'primary'),
        actionLink('Diagnostics', '/owner/diagnostics'),
      ];
    case 'support-detail':
      return [
        actionLink('Support Overview', '/owner/support'),
        actionLink('Access', '/owner/access'),
      ];
    case 'audit':
      return [
        actionLink('Access Posture', '/owner/access'),
        actionLink('Security Overview', '/owner/security/overview'),
      ];
    case 'security':
      return [
        actionLink('Audit Trail', '/owner/audit'),
        actionLink('Access Posture', '/owner/access'),
      ];
    case 'access':
      return [
        actionLink('Security Overview', '/owner/security/overview'),
        actionLink('Diagnostics', '/owner/diagnostics'),
      ];
    case 'diagnostics':
      return [
        actionLink('Support', '/owner/support'),
        actionLink('Recovery Overview', '/owner/recovery/overview'),
      ];
    case 'settings':
      return [
        actionLink('Access Posture', '/owner/access'),
        actionLink('Recovery Overview', '/owner/recovery/overview'),
      ];
    case 'settings-access-policy':
      return [
        actionLink('Settings Overview', '/owner/settings/overview'),
        actionLink('Portal Policy', '/owner/settings/portal-policy'),
      ];
    case 'settings-portal-policy':
      return [
        actionLink('Settings Overview', '/owner/settings/overview'),
        actionLink('Billing Policy', '/owner/settings/billing-policy'),
      ];
    case 'settings-billing-policy':
      return [
        actionLink('Settings Overview', '/owner/settings/overview'),
        actionLink('Runtime Policy', '/owner/settings/runtime-policy'),
      ];
    case 'settings-runtime-policy':
      return [
        actionLink('Settings Overview', '/owner/settings/overview'),
        actionLink('Managed Services', '/owner/settings/services'),
      ];
    case 'settings-admin-users':
      return [
        actionLink('Settings Overview', '/owner/settings/overview'),
        actionLink('Managed Services', '/owner/settings/services'),
      ];
    case 'settings-services':
      return [
        actionLink('Settings Overview', '/owner/settings/overview'),
        actionLink('Platform Controls', '/owner/control'),
      ];
    case 'control':
      return [
        actionLink('Recovery Overview', '/owner/recovery/overview', 'primary'),
        actionLink('Runtime Overview', '/owner/runtime/overview'),
      ];
    case 'recovery':
      return [
        actionLink('Backup Detail', '/owner/recovery/tenant-backup', 'primary'),
        actionLink('Diagnostics', '/owner/diagnostics'),
      ];
    case 'backup-detail':
      return [
        actionLink('Recovery Overview', '/owner/recovery/overview'),
        actionLink('Diagnostics', '/owner/diagnostics'),
      ];
    default:
      return [];
  }
}

function buildOverview(pathname, payloadValue) {
  const overview = asObject(asObject(payloadValue).overview);
  const analytics = asObject(overview.analytics);
  const tenants = asObject(analytics.tenants);
  const subscriptions = asObject(analytics.subscriptions);
  const delivery = asObject(analytics.delivery);
  const collections = gatherCollections(payloadValue);
  const tenantRows = uniqueById(collections.tenants, ['tenantId', 'id']).slice(0, 8);
  const auditRows = uniqueById(collections.auditEvents, ['id']).slice(0, 8);
  const packageCounts = topCounts(collections.tenants, ['packageName', 'packageId', 'planId'], 5);
  const commercialMetrics = metricSection('Commercial posture', [
    { label: 'Tenants', value: formatNumber(tenants.total), detail: `${formatNumber(tenants.trialing)} trialing / ${formatNumber(tenants.active)} active` },
    { label: 'Subscriptions', value: formatNumber(subscriptions.total), detail: `${formatNumber(subscriptions.active)} active` },
    { label: 'MRR', value: formatCurrency(subscriptions.mrrCents, 'THB'), detail: 'Current recurring revenue snapshot' },
    { label: '30d deliveries', value: formatNumber(delivery.purchaseCount30d), detail: `${formatNumber(delivery.deliveredCount)} completed / ${formatNumber(delivery.failedCount)} failed` },
  ]);
  const operationsMetrics = metricSection('Operations watch', [
    { label: 'Security events', value: formatNumber(auditRows.length), detail: 'Rows already visible in the live audit trail.' },
    { label: 'Delivery failures', value: formatNumber(delivery.failedCount), detail: 'Failed delivery work that still needs review.' },
    { label: 'Runtime split', value: '2 roles', detail: 'Delivery Agent and Server Bot stay separated.' },
    { label: 'Checks ready', value: formatNumber((auditRows.length ? 1 : 0) + (delivery.purchaseCount30d ? 1 : 0) + (tenantRows.length ? 1 : 0)), detail: 'Signals available in the overview right now.' },
  ]);
  const commercialWorkspace = pageLayout([
    commercialMetrics,
    tableSection('Tenant snapshot', tenantRows, [
      { label: 'Tenant', render: (row) => textCell(row.tenantName || row.name || row.tenantId || row.id, row.packageName || row.packageId || row.planId) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.subscriptionStatus || 'trialing', 80)) },
      { label: 'Created', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.updatedAt)) },
    ], { note: 'Live tenant rows from the Owner backend.' }),
  ], [
    digestSection('Package spread', 'Top package assignments visible across tenant rows.', packageCounts.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'tenants',
    }))),
    featureListSection('Commercial next steps', 'Follow the customer lane without opening the full platform stack.', [
      tenantRows.length ? 'Tenant posture is available' : '',
      subscriptions.total ? 'Commercial summary is available' : '',
      delivery.failedCount ? 'Failed deliveries need customer follow-through' : '',
    ]),
  ]);
  const operationsWorkspace = pageLayout([
    operationsMetrics,
    tableSection('Recent security events', auditRows, [
      { label: 'Event', render: (row) => textCell(row.type || row.detail || row.reason || row.id, row.actor || row.targetUser || row.ip) },
      { label: 'Severity', render: (row) => escapeHtml(trimText(row.severity || row.level || 'info', 60)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt)) },
    ], { note: 'Current audit and security trail.' }),
  ], [
    digestSection('Operations posture', 'Keep the platform lane focused on runtime discipline and evidence.', [
      statItem('Audit trail rows', formatNumber(auditRows.length), 'Latest security and audit entries visible now.'),
      statItem('Deliveries failed', formatNumber(delivery.failedCount), 'Jobs that still need intervention.'),
      statItem('Runtime roles', 'Delivery + Server', 'Delivery Agent and Server Bot remain separate operating classes.'),
    ]),
    featureListSection('Operations next steps', 'Jump from the lane menu into the relevant control workspace.', [
      auditRows.length ? 'Audit and security trail is available' : '',
      delivery.failedCount ? 'Delivery failures need operator review' : '',
      'Runtime health and recovery remain one click away',
    ]),
  ]);
  return `
    <div class="owner-live-overview-shell">
      <div class="owner-live-overview-content">
        <section class="owner-live-overview-class owner-live-overview-class-commercial" id="owner-overview-commercial" data-owner-section="panel" data-owner-section-label="Customer and revenue overview">
          <section class="owner-live-panel owner-live-overview-hero">
            <div class="owner-live-head">
              <span data-owner-role="section-heading">Customer &amp; Revenue</span>
              <p>Use the commercial class when you need tenant posture, renewals, package spread, and billing risk without mixing in operations noise.</p>
            </div>
            <div class="owner-live-route-actions" data-owner-layout="page-actions">
              ${actionLink('Open tenant registry', '/owner/tenants', 'primary')}
              ${actionLink('Open billing', '/owner/billing')}
            </div>
          </section>
          ${commercialWorkspace}
        </section>
        <section class="owner-live-overview-class owner-live-overview-class-operations" id="owner-overview-operations" data-owner-section="panel" data-owner-section-label="Operations and governance overview">
          <section class="owner-live-panel owner-live-overview-hero owner-live-overview-hero-ops">
            <div class="owner-live-head">
              <span data-owner-role="section-heading">Operations &amp; Governance</span>
              <p>Use the platform class when you want audit evidence, delivery failures, runtime separation, and policy follow-through in one lane.</p>
            </div>
            <div class="owner-live-route-actions" data-owner-layout="page-actions">
${actionLink('Open runtime overview', '/owner/runtime/overview', 'primary')}
${actionLink('Open security overview', '/owner/security/overview')}
            </div>
          </section>
          ${operationsWorkspace}
        </section>
      </div>
    </div>
  `;
}

function buildTenants(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const rows = uniqueById(collections.tenants, ['tenantId', 'id']).slice(0, 20);
  const analytics = asObject(asObject(asObject(payloadValue).overview).analytics).tenants || {};
  const packageCounts = topCounts(rows, ['packageName', 'packageId', 'planId'], 6);
  const billingCounts = topCounts(rows, ['subscriptionStatus', 'billingStatus', 'status'], 6);
  return pageLayout([
    metricSection('Tenant posture', [
      { label: 'Total tenants', value: formatNumber(analytics.total), detail: 'All tenants visible to Owner' },
      { label: 'Active', value: formatNumber(analytics.active), detail: 'Currently active tenants' },
      { label: 'Trialing', value: formatNumber(analytics.trialing), detail: 'Preview or trial tenants' },
    ]),
    tableSection('Tenant inventory', rows, [
      { label: 'Tenant', render: (row) => textCell(row.tenantName || row.name || row.tenantId || row.id, row.slug || row.externalId || row.email) },
      { label: 'Package', render: (row) => escapeHtml(trimText(row.packageName || row.packageId || row.planId || '-', 90)) },
      { label: 'Billing', render: (row) => escapeHtml(trimText(row.subscriptionStatus || row.billingStatus || row.status || '-', 90)) },
      { label: 'Created', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.updatedAt)) },
    ]),
  ], [
    digestSection('Package assignment', 'Most common package mapping across visible tenants.', packageCounts.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'tenants assigned',
    }))),
    digestSection('Billing states', 'Current lifecycle posture across visible tenants.', billingCounts.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'tenant rows',
    }))),
  ]);
}

function buildTenantCreate(pathname, payloadValue) {
  const overview = asObject(asObject(payloadValue).overview);
  const packages = uniqueById(mergeArrays(overview.packages, asObject(overview.publicOverview).billing?.packages), ['id']).slice(0, 6);
  return pageLayout([
    panelSection('Provisioning checklist', 'Prepare a tenant name, package assignment, and operator contact before opening the guarded create-tenant flow.', `
      <div class="owner-live-grid owner-live-metrics">
        <article class="owner-live-panel owner-live-kv-card owner-live-metric"><span data-owner-role="section-heading">Step 1</span><strong>Identity</strong><div class="owner-live-note">Create the tenant and set owner access.</div></article>
        <article class="owner-live-panel owner-live-kv-card owner-live-metric"><span data-owner-role="section-heading">Step 2</span><strong>Package</strong><div class="owner-live-note">Choose the default package and feature posture.</div></article>
        <article class="owner-live-panel owner-live-kv-card owner-live-metric"><span data-owner-role="section-heading">Step 3</span><strong>Runtime</strong><div class="owner-live-note">Prepare Delivery Agent and Server Bot binding.</div></article>
      </div>
    `),
    tableSection('Available packages', packages, [
      { label: 'Package', render: (row) => textCell(row.title || row.name || row.id, row.description) },
      { label: 'Plan', render: (row) => escapeHtml(trimText(row.planId || row.billingCycle || '-', 90)) },
      { label: 'Price', render: (row) => escapeHtml(row.price ? formatCurrency(row.price, row.currency || 'THB') : 'Custom') },
    ], { emptyMessage: 'No packages are available for tenant provisioning yet.' }),
  ], [
    digestSection('Provisioning notes', 'Use the existing backend flow; this page only organizes the required context.', [
      statItem('Package options', formatNumber(packages.length), 'Visible package rows for default assignment.'),
      statItem('Runtime setup', 'Separate', 'Delivery Agent and Server Bot stay distinct during onboarding.'),
      statItem('Tenant flow', 'Guarded', 'Provisioning still uses the current Owner backend contract.'),
    ]),
  ]);
}

function buildPackages(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const rows = uniqueById(collections.packages, ['id']).slice(0, 20);
  const featureRows = uniqueById(collections.features, ['key', 'id']).slice(0, 12);
  const topPlans = topCounts(rows, ['planId', 'billingCycle', 'status'], 5);
  const categories = topCounts(featureRows, ['category', 'group', 'scope'], 6);
  return pageLayout([
    tableSection('Package catalog', rows, [
      { label: 'Package', render: (row) => textCell(row.title || row.name || row.id, row.description) },
      { label: 'Plan', render: (row) => escapeHtml(trimText(row.planId || row.billingCycle || '-', 90)) },
      { label: 'Price', render: (row) => escapeHtml(row.price ? formatCurrency(row.price, row.currency || 'THB') : 'Custom') },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || 'active', 80)) },
    ]),
    tableSection('Feature matrix', featureRows, [
      { label: 'Feature', render: (row) => textCell(row.title || row.name || row.key, row.category) },
      { label: 'Key', render: (row) => escapeHtml(trimText(row.key || row.id || '-', 90)) },
    ], { note: 'Current backend feature catalog.' }),
  ], [
    digestSection('Package posture', 'Visible package and plan coverage from the current backend catalog.', [
      statItem('Packages', formatNumber(rows.length), 'Package rows currently visible to Owner.'),
      statItem('Features', formatNumber(featureRows.length), 'Feature rows currently visible to Owner.'),
      ...topPlans.map((item) => statItem(item.label, formatNumber(item.count), 'package rows')),
    ]),
    digestSection('Feature categories', 'Top categories represented in the current feature matrix.', categories.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'features',
    }))),
  ]);
}

function buildPackageDetail(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const packageId = segmentAt(pathname, 2);
  const record = findRecord(collections.packages, packageId, ['id', 'planId', 'name', 'title']);
  const tenants = uniqueById(collections.tenants, ['tenantId', 'id'])
    .filter((row) => [row.packageId, row.planId, row.packageName].map((value) => trimText(value, 180)).includes(trimText(packageId, 180)))
    .slice(0, 12);
  return pageLayout([
    detailCardsSection('Package details', record || { id: packageId }),
    tableSection('Assigned tenants', tenants, [
      { label: 'Tenant', render: (row) => textCell(row.tenantName || row.name || row.tenantId || row.id, row.subscriptionStatus || row.status) },
      { label: 'Created', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No tenants are currently linked to this package.' }),
  ], [
    digestSection('Package scope', 'Summary of the current package selection.', [
      statItem('Package id', packageId, 'Current route identifier.'),
      statItem('Assigned tenants', formatNumber(tenants.length), 'Visible tenant rows linked to this package.'),
      statItem('Commercial plan', firstTextValue(record, ['planId', 'billingCycle', 'status']) || '-', 'Resolved from the current package record.'),
    ]),
  ]);
}

function buildSubscriptions(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const analytics = asObject(asObject(asObject(payloadValue).overview).analytics).subscriptions || {};
  const subscriptionRows = uniqueById(collections.subscriptions, ['subscriptionId', 'id']).slice(0, 20);
  const invoiceRows = uniqueById(collections.invoices, ['invoiceId', 'id']).slice(0, 12);
  const statusCounts = topCounts(subscriptionRows, ['status', 'subscriptionStatus'], 6);
  return pageLayout([
    metricSection('Subscription posture', [
      { label: 'Subscriptions', value: formatNumber(analytics.total), detail: `${formatNumber(analytics.active)} active` },
      { label: 'MRR', value: formatCurrency(analytics.mrrCents, 'THB'), detail: 'Current recurring revenue snapshot' },
      { label: 'Invoices', value: formatNumber(collections.invoices.length), detail: 'Visible billing invoices' },
      { label: 'Attempts', value: formatNumber(collections.attempts.length), detail: 'Visible payment attempts' },
    ]),
    tableSection('Subscriptions', subscriptionRows, [
      { label: 'Subscription', render: (row) => textCell(row.tenantName || row.name || row.subscriptionId || row.id, row.planId || row.packageId || row.packageName) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.subscriptionStatus || '-', 90)) },
      { label: 'Renewal', render: (row) => escapeHtml(formatDateTime(row.currentPeriodEnd || row.renewAt || row.updatedAt)) },
    ]),
    tableSection('Recent invoices', invoiceRows, [
      { label: 'Invoice', render: (row) => textCell(row.invoiceId || row.id, row.tenantName || row.tenantId || row.subscriptionId) },
      { label: 'Amount', render: (row) => escapeHtml(formatCurrency(row.amountDueCents || row.amountCents || row.totalCents, row.currency || 'THB')) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || '-', 90)) },
    ]),
  ], [
    digestSection('Subscription states', 'Most visible lifecycle states across current subscriptions.', statusCounts.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'subscription rows',
    }))),
    digestSection('Commercial summary', 'Quick summary from live subscription and invoice records.', [
      statItem('Visible subscriptions', formatNumber(subscriptionRows.length), 'Rows on the current page snapshot.'),
      statItem('Visible invoices', formatNumber(invoiceRows.length), 'Recent invoice rows rendered in this view.'),
      statItem('Payment attempts', formatNumber(collections.attempts.length), 'Attempts available for review from billing data.'),
    ]),
  ]);
}

function buildSubscriptionDetail(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const subscriptionId = segmentAt(pathname, 2);
  const record = findRecord(collections.subscriptions, subscriptionId, ['subscriptionId', 'id', 'tenantId']);
  const invoices = uniqueById(collections.invoices, ['invoiceId', 'id'])
    .filter((row) => trimText(row.subscriptionId, 180) === trimText(subscriptionId, 180))
    .slice(0, 12);
  return pageLayout([
    detailCardsSection('Subscription details', record || { subscriptionId }),
    tableSection('Linked invoices', invoices, [
      { label: 'Invoice', render: (row) => textCell(row.invoiceId || row.id, row.status) },
      { label: 'Amount', render: (row) => escapeHtml(formatCurrency(row.amountDueCents || row.amountCents || row.totalCents, row.currency || 'THB')) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt)) },
    ], { emptyMessage: 'No invoices are linked to this subscription yet.' }),
  ], [
    digestSection('Subscription context', 'Current detail route summary.', [
      statItem('Subscription id', subscriptionId, 'Identifier resolved from the route.'),
      statItem('Linked invoices', formatNumber(invoices.length), 'Invoice rows currently linked to this subscription.'),
      statItem('Status', firstTextValue(record, ['status', 'subscriptionStatus']) || '-', 'Resolved from the current subscription record.'),
    ]),
  ]);
}

function buildBilling(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const overview = asObject(payload.billingOverview);
  const summary = asObject(overview.summary);
  const collections = gatherCollections(payloadValue);
  const invoiceRows = uniqueById(collections.invoices, ['invoiceId', 'id']).slice(0, 15);
  const attemptRows = uniqueById(collections.attempts, ['paymentAttemptId', 'id']).slice(0, 12);
  const invoiceStates = topCounts(invoiceRows, ['status'], 6);
  return pageLayout([
    metricSection('Billing summary', [
      { label: 'Provider', value: trimText(overview.provider, 40) || '-', detail: 'Billing provider in current environment' },
      { label: 'Paid today', value: formatCurrency(summary.todayPaidCents || summary.paidTodayCents, 'THB'), detail: 'Paid invoices today' },
      { label: 'Open invoices', value: formatNumber(summary.openInvoices || collections.invoices.length), detail: 'Invoices awaiting payment' },
      { label: 'Failed attempts', value: formatNumber(summary.failedAttempts || collections.attempts.filter((row) => String(row.status || '').toLowerCase().includes('fail')).length), detail: 'Payment attempts needing review' },
    ]),
    tableSection('Invoices', invoiceRows, [
      { label: 'Invoice', render: (row) => textCell(row.invoiceId || row.id, row.tenantName || row.tenantId) },
      { label: 'Amount', render: (row) => escapeHtml(formatCurrency(row.amountDueCents || row.amountCents || row.totalCents, row.currency || 'THB')) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || '-', 80)) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt)) },
    ]),
    tableSection('Payment attempts', attemptRows, [
      { label: 'Attempt', render: (row) => textCell(row.paymentAttemptId || row.id, row.invoiceId || row.subscriptionId) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || '-', 80)) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt)) },
    ]),
  ], [
    digestSection('Invoice states', 'Current invoice breakdown from visible billing rows.', invoiceStates.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'invoice rows',
    }))),
    digestSection('Billing operations', 'Operator summary for the current billing route.', [
      statItem('Invoice rows', formatNumber(invoiceRows.length), 'Visible invoice rows in this route.'),
      statItem('Attempt rows', formatNumber(attemptRows.length), 'Visible payment attempts in this route.'),
      statItem('Commercial provider', trimText(overview.provider, 40) || '-', 'Provider reported by the current environment.'),
    ]),
  ]);
}

function buildInvoiceDetail(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const invoiceId = segmentAt(pathname, 3);
  const record = findRecord(collections.invoices, invoiceId, ['invoiceId', 'id']);
  const attempts = uniqueById(collections.attempts, ['paymentAttemptId', 'id'])
    .filter((row) => trimText(row.invoiceId, 180) === trimText(invoiceId, 180))
    .slice(0, 12);
  return pageLayout([
    detailCardsSection('Invoice details', record || { invoiceId }),
    tableSection('Payment attempts', attempts, [
      { label: 'Attempt', render: (row) => textCell(row.paymentAttemptId || row.id, row.status) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt)) },
    ], { emptyMessage: 'No payment attempts are linked to this invoice yet.' }),
  ], [
    digestSection('Invoice context', 'Current invoice route summary.', [
      statItem('Invoice id', invoiceId, 'Identifier resolved from the route.'),
      statItem('Linked attempts', formatNumber(attempts.length), 'Payment attempts currently linked to this invoice.'),
      statItem('Status', firstTextValue(record, ['status']) || '-', 'Resolved from the current invoice record.'),
    ]),
  ]);
}

function buildAttemptDetail(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const attemptId = segmentAt(pathname, 3);
  const record = findRecord(collections.attempts, attemptId, ['paymentAttemptId', 'id']);
  return pageLayout([
    detailCardsSection('Payment attempt details', record || { paymentAttemptId: attemptId }),
  ], [
    digestSection('Attempt context', 'Current payment attempt route summary.', [
      statItem('Attempt id', attemptId, 'Identifier resolved from the route.'),
      statItem('Status', firstTextValue(record, ['status']) || '-', 'Resolved from the current attempt record.'),
      statItem('Invoice', firstTextValue(record, ['invoiceId', 'subscriptionId']) || '-', 'Closest linked commercial record.'),
    ]),
  ]);
}

function buildRuntime(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const lifecycle = asObject(payload.deliveryLifecycle);
  const runtime = asObject(lifecycle.runtime);
  const summary = asObject(lifecycle.summary);
  const collections = gatherCollections(payloadValue);
  const runtimeRows = uniqueById(collections.agents, ['runtimeKey', 'id', 'agentId']).slice(0, 20);
  const runtimeKinds = topCounts(runtimeRows, ['kind', 'type', 'scope'], 6);
  return pageLayout([
    metricSection('Runtime posture', [
      { label: 'Execution mode', value: trimText(runtime.executionMode, 40) || '-', detail: runtime.enabled ? 'Delivery runtime is enabled' : 'Delivery runtime is disabled' },
      { label: 'Queue length', value: formatNumber(runtime.queueLength), detail: `${formatNumber(summary.overdueCount)} overdue jobs` },
      { label: 'Dead letters', value: formatNumber(runtime.deadLetterCount), detail: `${formatNumber(summary.retryHeavyCount)} retry-heavy jobs` },
      { label: 'Registered runtimes', value: formatNumber(collections.agents.length), detail: 'Current agent and runtime records' },
    ]),
    tableSection('Runtime records', runtimeRows, [
      { label: 'Runtime', render: (row) => textCell(row.label || row.runtimeKey || row.id, row.kind || row.type || row.agentId) },
      { label: 'Version', render: (row) => escapeHtml(trimText(row.version || row.agentVersion || '-', 80)) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.state || '-', 80)) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.lastSeenAt || row.createdAt)) },
    ], { emptyMessage: 'No runtime rows are currently visible.' }),
  ], [
    digestSection('Queue health', 'Operational summary from the current delivery lifecycle payload.', [
      statItem('Pending jobs', formatNumber(summary.pendingCount), 'Pending work visible to the runtime.'),
      statItem('Overdue jobs', formatNumber(summary.overdueCount), 'Jobs that exceeded the expected processing window.'),
      statItem('Retry-heavy jobs', formatNumber(summary.retryHeavyCount), 'Jobs with elevated retry counts.'),
    ]),
    digestSection('Runtime mix', 'Kinds currently visible in agent and bot records.', runtimeKinds.map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'runtime rows',
    }))),
  ]);
}

function buildAgentsBots(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const rows = uniqueById(collections.agents, ['runtimeKey', 'id', 'agentId']).slice(0, 20);
  return pageLayout([
    tableSection('Agents and bots', rows, [
      { label: 'Runtime', render: (row) => textCell(row.label || row.runtimeKey || row.id, row.kind || row.type || row.agentId) },
      { label: 'Scope', render: (row) => escapeHtml(trimText(row.scope || row.tenantId || '-', 80)) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.state || '-', 80)) },
    ], { emptyMessage: 'No Delivery Agent or Server Bot records are visible.' }),
  ], [
    digestSection('Fleet summary', 'Current registered runtime mix.', topCounts(rows, ['kind', 'type', 'scope'], 6).map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'rows',
    }))),
  ]);
}

function buildFleetDiagnostics(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const lifecycle = asObject(payload.deliveryLifecycle);
  const summary = asObject(lifecycle.summary);
  const requestMetrics = asObject(asObject(payload.requestLogs).metrics);
  return pageLayout([
    metricSection('Fleet diagnostics', [
      { label: 'Overdue jobs', value: formatNumber(summary.overdueCount), detail: 'Delivery lifecycle overdue items' },
      { label: 'Retry-heavy jobs', value: formatNumber(summary.retryHeavyCount), detail: 'Jobs with elevated retry counts' },
      { label: 'Slow requests', value: formatNumber(requestMetrics.slowRequests), detail: `p95 ${formatNumber(requestMetrics.p95LatencyMs, '-')} ms` },
      { label: 'Error requests', value: formatNumber(requestMetrics.errors), detail: `${formatNumber(requestMetrics.unauthorized)} unauthorized` },
    ]),
  ], [
    digestSection('Diagnostics context', 'Backend request and lifecycle signals used in this view.', [
      statItem('Latency p95', formatNumber(requestMetrics.p95LatencyMs, '-'), 'Visible request latency metric.'),
      statItem('Unauthorized', formatNumber(requestMetrics.unauthorized), 'Recent unauthorized request count.'),
    ]),
  ]);
}

function buildIncidents(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const lifecycle = asObject(payload.deliveryLifecycle);
  const signals = toArray(lifecycle.signals);
  const events = uniqueById(gatherCollections(payloadValue).auditEvents, ['id']).slice(0, 12);
  return pageLayout([
    tableSection('Current signals', signals, [
      { label: 'Signal', render: (row) => textCell(row.key || row.id, row.detail) },
      { label: 'Tone', render: (row) => escapeHtml(trimText(row.tone || '-', 80)) },
      { label: 'Count', render: (row) => escapeHtml(formatNumber(row.count)) },
    ], { emptyMessage: 'No incident signals are currently active.' }),
    tableSection('Recent security and audit events', events, [
      { label: 'Event', render: (row) => textCell(row.type || row.detail, row.actor || row.ip) },
      { label: 'Severity', render: (row) => escapeHtml(trimText(row.severity || '-', 80)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt)) },
    ]),
  ], [
    digestSection('Signal mix', 'Current tones visible in the incident stream.', topCounts(signals, ['tone', 'key'], 6).map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'signals',
    }))),
  ]);
}

function buildAnalytics(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const requestLogs = asObject(payload.requestLogs);
  const metrics = asObject(requestLogs.metrics);
  const rows = uniqueById(mergeArrays(requestLogs.items, requestLogs.rows, requestLogs.data), ['id', 'requestId']).slice(0, 20);
  return pageLayout([
    metricSection('Request telemetry', [
      { label: 'Total requests', value: formatNumber(metrics.totalRequests), detail: `${formatNumber(metrics.errors)} errors` },
      { label: 'Slow requests', value: formatNumber(metrics.slowRequests), detail: `p95 ${formatNumber(metrics.p95LatencyMs, '-')} ms` },
      { label: 'Unauthorized', value: formatNumber(metrics.unauthorized), detail: 'Recent auth failures' },
      { label: 'Visible rows', value: formatNumber(rows.length), detail: 'Rows in current telemetry snapshot' },
    ]),
    tableSection('Recent request anomalies', rows, [
      { label: 'Request', render: (row) => textCell(row.id || row.requestId || row.path || row.url, row.method || row.routePattern) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.statusCode || '-', 80)) },
      { label: 'Latency', render: (row) => escapeHtml(trimText(row.latencyMs || row.durationMs || '-', 80)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No request telemetry rows are currently visible.' }),
  ], [
    digestSection('Telemetry summary', 'Current request metrics from the backend log stream.', [
      statItem('Errors', formatNumber(metrics.errors), 'Requests currently marked as errors.'),
      statItem('Slow requests', formatNumber(metrics.slowRequests), `p95 ${formatNumber(metrics.p95LatencyMs, '-')} ms`),
      statItem('Unauthorized', formatNumber(metrics.unauthorized), 'Recent auth-related failures.'),
    ]),
  ]);
}

function buildJobs(pathname, payloadValue) {
  const lifecycle = asObject(asObject(payloadValue).deliveryLifecycle);
  const summary = asObject(lifecycle.summary);
  const jobs = uniqueById(mergeArrays(lifecycle.items, lifecycle.jobs, lifecycle.entries, lifecycle.rows), ['id', 'jobId']).slice(0, 20);
  return pageLayout([
    metricSection('Queue state', [
      { label: 'Pending jobs', value: formatNumber(summary.pendingCount), detail: `${formatNumber(summary.overdueCount)} overdue` },
      { label: 'Retry-heavy', value: formatNumber(summary.retryHeavyCount), detail: 'Jobs with elevated retry counts' },
      { label: 'Dead letters', value: formatNumber(summary.deadLetterCount), detail: 'Jobs moved to dead-letter state' },
      { label: 'Visible jobs', value: formatNumber(jobs.length), detail: 'Current lifecycle rows' },
    ]),
    tableSection('Delivery jobs', jobs, [
      { label: 'Job', render: (row) => textCell(row.id || row.jobId || row.deliveryId || row.orderId, row.tenantId || row.scope || row.runtimeKey) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.state || row.phase || '-', 80)) },
      { label: 'Attempts', render: (row) => escapeHtml(formatNumber(row.retryCount || row.attempts || 0)) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt || row.startedAt)) },
    ], { emptyMessage: 'No delivery jobs are currently visible.' }),
  ], [
    digestSection('Queue summary', 'Operational breakdown from the current lifecycle payload.', [
      statItem('Pending', formatNumber(summary.pendingCount), 'Jobs still waiting to be processed.'),
      statItem('Overdue', formatNumber(summary.overdueCount), 'Jobs that exceeded the expected service window.'),
      statItem('Dead letters', formatNumber(summary.deadLetterCount), 'Jobs moved to dead-letter handling.'),
    ]),
  ]);
}

function buildAutomation(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const lifecycle = asObject(payload.deliveryLifecycle);
  const signals = uniqueById(mergeArrays(lifecycle.signals, payload.securityEvents), ['id', 'key', 'type']).slice(0, 16);
  const restoreState = asObject(payload.restoreState);
  return pageLayout([
    metricSection('Automation posture', [
      { label: 'Queue pressure', value: formatNumber(asObject(lifecycle.summary).pendingCount), detail: 'Pending work visible to automation' },
      { label: 'Signals', value: formatNumber(signals.length), detail: 'Signals currently driving operator attention' },
      { label: 'Restore running', value: restoreState.running ? 'Yes' : 'No', detail: trimText(restoreState.phase || restoreState.status || 'Idle', 80) },
    ]),
    tableSection('Automation and notification signals', signals, [
      { label: 'Signal', render: (row) => textCell(row.type || row.key || row.id, row.detail || row.message) },
      { label: 'Tone', render: (row) => escapeHtml(trimText(row.tone || row.severity || row.level || '-', 80)) },
      { label: 'Count', render: (row) => escapeHtml(formatNumber(row.count || 1)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No automation or notification signals are currently visible.' }),
  ], [
    digestSection('Automation summary', 'Current signals and restore posture.', [
      statItem('Visible signals', formatNumber(signals.length), 'Automation and security signals visible to Owner.'),
      statItem('Restore phase', trimText(restoreState.phase || restoreState.status || 'Idle', 80), 'Current restore state from the recovery backend.'),
    ]),
  ]);
}

function buildSupport(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const requestLogs = uniqueById(mergeArrays(asObject(payload.requestLogs).items, asObject(payload.requestLogs).rows), ['id', 'requestId']).slice(0, 10);
  const securityEvents = uniqueById(payload.securityEvents, ['id']).slice(0, 10);
  return pageLayout([
    tableSection('Support-facing error signals', requestLogs, [
      { label: 'Request', render: (row) => textCell(row.id || row.requestId || row.path || row.url, row.method || row.routePattern) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.statusCode || '-', 80)) },
      { label: 'Latency', render: (row) => escapeHtml(trimText(row.latencyMs || row.durationMs || '-', 80)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No request failures are currently visible for support.' }),
    tableSection('Security follow-up', securityEvents, [
      { label: 'Event', render: (row) => textCell(row.type || row.detail || row.reason || row.id, row.actor || row.ip) },
      { label: 'Severity', render: (row) => escapeHtml(trimText(row.severity || row.level || '-', 80)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt)) },
    ], { emptyMessage: 'No security events currently need support review.' }),
  ], [
    digestSection('Support snapshot', 'Current signals that drive diagnostics and operator follow-up.', [
      statItem('Request rows', formatNumber(requestLogs.length), 'Recent request failures or anomalies visible to support.'),
      statItem('Security events', formatNumber(securityEvents.length), 'Security items that may require operator follow-up.'),
    ]),
  ]);
}

function buildSupportDetail(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const routeId = segmentAt(pathname, 2);
  const combined = uniqueById(mergeArrays(asObject(payload.requestLogs).items, payload.securityEvents), ['id', 'requestId']);
  const record = findRecord(combined, routeId, ['id', 'requestId', 'tenantId', 'path', 'type']);
  return pageLayout([
    detailCardsSection('Support detail', record || { id: routeId || 'support-context' }),
  ], [
    digestSection('Support context', 'Current selected support or diagnostics item.', [
      statItem('Record id', routeId || 'support-context', 'Identifier resolved from the route.'),
      statItem('Type', firstTextValue(record, ['type', 'path', 'requestId']) || '-', 'Resolved from the selected item.'),
    ]),
  ]);
}

function buildAudit(pathname, payloadValue) {
  const rows = uniqueById(gatherCollections(payloadValue).auditEvents, ['id']).slice(0, 24);
  return pageLayout([
    tableSection('Audit trail', rows, [
      { label: 'Event', render: (row) => textCell(row.type || row.detail || row.reason || row.id, row.actor || row.targetUser || row.ip) },
      { label: 'Severity', render: (row) => escapeHtml(trimText(row.severity || row.level || '-', 80)) },
      { label: 'Scope', render: (row) => escapeHtml(trimText(row.scope || row.tenantId || row.target || '-', 90)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No audit events are currently visible.' }),
  ], [
    digestSection('Audit summary', 'Current audit distribution from visible records.', topCounts(rows, ['severity', 'level', 'scope'], 6).map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'events',
    }))),
  ]);
}

function buildSecurity(pathname, payloadValue) {
  const rows = uniqueById(asObject(payloadValue).securityEvents, ['id']).slice(0, 20);
  const requestLogMetrics = asObject(asObject(asObject(payloadValue).requestLogs).metrics);
  const highSeverity = rows.filter((row) => ['high', 'critical'].includes(String(row.severity || row.level || '').toLowerCase())).length;
  return pageLayout([
    metricSection('Security posture', [
      { label: 'Visible events', value: formatNumber(rows.length), detail: 'Current security events in Owner scope' },
      { label: 'High severity', value: formatNumber(highSeverity), detail: 'High or critical signals' },
      { label: 'Unauthorized', value: formatNumber(requestLogMetrics.unauthorized), detail: 'Recent unauthorized requests' },
    ]),
    tableSection('Security events', rows, [
      { label: 'Event', render: (row) => textCell(row.type || row.detail || row.reason || row.id, row.actor || row.ip) },
      { label: 'Severity', render: (row) => escapeHtml(trimText(row.severity || row.level || '-', 80)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No security events are currently visible.' }),
  ], [
    digestSection('Security summary', 'Severity mix from current security events.', topCounts(rows, ['severity', 'level', 'type'], 6).map((item) => ({
      label: item.label,
      value: formatNumber(item.count),
      note: 'events',
    }))),
  ]);
}

function buildAccess(pathname, payloadValue) {
  const me = asObject(asObject(payloadValue).me);
  const settings = asObject(asObject(payloadValue).controlPanelSettings);
  return pageLayout([
    metricSection('Access posture', [
      { label: 'Current operator', value: trimText(me.username || me.email || me.id, 120) || '-', detail: trimText(me.role || me.type || 'Owner', 80) },
      { label: 'Tenant scope', value: trimText(me.tenantId, 120) || 'Platform', detail: 'Resolved scope for this Owner session' },
      { label: 'Environment', value: trimText(settings.environmentName || settings.environment || settings.mode, 120) || '-', detail: 'Current control-plane environment' },
    ]),
    detailCardsSection('Session and access settings', {
      username: me.username || me.email,
      role: me.role || me.type,
      tenantId: me.tenantId || 'platform',
      environment: settings.environmentName || settings.environment,
      locale: settings.locale || settings.language || 'en',
    }),
  ], [
    digestSection('Access summary', 'Current operator and environment context.', [
      statItem('Operator', trimText(me.username || me.email || me.id, 120) || '-', 'Current signed-in Owner session.'),
      statItem('Role', trimText(me.role || me.type || 'Owner', 80) || '-', 'Resolved role for this session.'),
      statItem('Locale', trimText(settings.locale || settings.language || 'en', 40) || '-', 'Current UI locale preference.'),
    ]),
  ]);
}

function buildDiagnostics(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const requestRows = uniqueById(mergeArrays(asObject(payload.requestLogs).items, asObject(payload.requestLogs).rows), ['id', 'requestId']).slice(0, 20);
  const backupRows = uniqueById(gatherCollections(payloadValue).backups, ['file', 'id']).slice(0, 12);
  return pageLayout([
    tableSection('Request diagnostics', requestRows, [
      { label: 'Request', render: (row) => textCell(row.id || row.requestId || row.path || row.url, row.method || row.routePattern) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.statusCode || '-', 80)) },
      { label: 'Latency', render: (row) => escapeHtml(trimText(row.latencyMs || row.durationMs || '-', 80)) },
      { label: 'When', render: (row) => escapeHtml(formatDateTime(row.at || row.createdAt || row.updatedAt)) },
    ], { emptyMessage: 'No request diagnostics are currently visible.' }),
    tableSection('Backup evidence', backupRows, [
      { label: 'Snapshot', render: (row) => textCell(row.file || row.id, row.tenantId || row.scope) },
      { label: 'Size', render: (row) => escapeHtml(trimText(row.sizeHuman || row.sizeBytes || '-', 80)) },
      { label: 'Created', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.at || row.updatedAt)) },
    ], { emptyMessage: 'No backup files are currently visible.' }),
  ], [
    digestSection('Diagnostics summary', 'Current diagnostics evidence visible to Owner.', [
      statItem('Request rows', formatNumber(requestRows.length), 'Visible request diagnostics rows.'),
      statItem('Backup files', formatNumber(backupRows.length), 'Visible backup evidence rows.'),
    ]),
  ]);
}

function buildSettings(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const settings = asObject(payload.controlPanelSettings);
  const me = asObject(payload.me);
  const publicOverview = asObject(asObject(payload.overview).publicOverview);
  const localization = asObject(publicOverview.localization);
  const billing = asObject(publicOverview.billing);
  const legal = asObject(publicOverview.legal);
  const supportedLocales = toArray(localization.supportedLocales)
    .map((value) => trimText(value, 40))
    .filter(Boolean);
  const plans = toArray(billing.plans);
  const docs = toArray(legal.docs);
  const warnings = toArray(payload.__loadWarnings);
  const settingKeys = Object.keys(settings)
    .filter((key) => settings[key] !== null && settings[key] !== undefined && typeof settings[key] !== 'object')
    .slice(0, 8);

  return pageLayout([
    metricSection('Environment posture', [
      {
        label: 'Reload required',
        value: settings.reloadRequired ? 'Yes' : 'No',
        detail: settings.reloadRequired ? 'A runtime reload is pending for one or more settings.' : 'No pending reload marker is visible.',
      },
      {
        label: 'Default locale',
        value: trimText(settings.locale || settings.language || localization.defaultLocale, 40) || '-',
        detail: `${formatNumber(supportedLocales.length)} locale${supportedLocales.length === 1 ? '' : 's'} visible`,
      },
      {
        label: 'Visible plans',
        value: formatNumber(plans.length),
        detail: 'Commercial plans exposed by the current public overview.',
      },
      {
        label: 'Legal docs',
        value: formatNumber(docs.length),
        detail: 'Policy documents linked to the current environment.',
      },
    ]),
    detailCardsSection('Control-plane settings', settingKeys.length ? Object.fromEntries(settingKeys.map((key) => [key, settings[key]])) : {
      locale: localization.defaultLocale || '-',
      fallbackLocale: localization.fallbackLocale || '-',
      reloadRequired: settings.reloadRequired ? 'true' : 'false',
    }),
    detailCardsSection('Operator session', {
      user: me.user || me.username || me.email || '-',
      role: me.role || me.type || 'owner',
      authMethod: me.authMethod || '-',
      session: me.session ? 'active' : 'inactive',
      tenantScope: me.tenantId || 'platform',
      stepUpRequired: me.stepUpRequired ? 'yes' : 'no',
    }),
    tableSection('Localization and environment assets', [
      {
        label: 'Supported locales',
        value: supportedLocales.join(', ') || '-',
        detail: localization.fallbackLocale || '-',
      },
      {
        label: 'Brand',
        value: trimText(asObject(publicOverview.brand).name, 120) || '-',
        detail: trimText(asObject(publicOverview.brand).description, 160) || '-',
      },
      {
        label: 'Warnings',
        value: formatNumber(warnings.length),
        detail: warnings.length ? trimText(warnings[0], 180) : 'No current load warnings',
      },
    ], [
      { label: 'Asset', render: (row) => textCell(row.label, row.detail) },
      { label: 'Value', render: (row) => escapeHtml(trimText(row.value, 180) || '-') },
    ], { emptyMessage: 'No localization or environment assets are visible.' }),
    tableSection('Commercial and legal surfaces', [
      ...plans.slice(0, 6).map((plan) => ({
        kind: 'Plan',
        item: plan.name || plan.id,
        detail: trimText(plan.billingCycle || plan.type, 80),
        state: formatCurrency(plan.amountCents, 'THB'),
        updated: plan.intervalDays ? `${formatNumber(plan.intervalDays)} day cycle` : '-',
      })),
      ...docs.slice(0, 6).map((doc) => ({
        kind: 'Legal',
        item: doc.title || doc.id,
        detail: doc.version || '-',
        state: doc.path || doc.url || '-',
        updated: doc.version || '-',
      })),
    ], [
      { label: 'Surface', render: (row) => textCell(row.kind, row.detail) },
      { label: 'Item', render: (row) => escapeHtml(trimText(row.item, 160) || '-') },
      { label: 'State', render: (row) => escapeHtml(trimText(row.state, 120) || '-') },
      { label: 'Context', render: (row) => escapeHtml(trimText(row.updated, 120) || '-') },
    ], { emptyMessage: 'No plan or legal surface data is visible yet.' }),
  ], [
    digestSection('Environment summary', 'Current Owner control-plane configuration snapshot.', [
      statItem('Locales', formatNumber(supportedLocales.length), 'Locales visible in the current environment.'),
      statItem('Plans', formatNumber(plans.length), 'Commercial plans exposed in this environment.'),
      statItem('Warnings', formatNumber(warnings.length), warnings.length ? trimText(warnings[0], 180) : 'No current load warnings.'),
    ]),
  ]);
}

function buildControl(pathname, payloadValue) {
  const lifecycle = asObject(asObject(payloadValue).deliveryLifecycle);
  const restoreState = asObject(asObject(payloadValue).restoreState);
  return pageLayout([
    metricSection('Platform controls', [
      { label: 'Runtime mode', value: trimText(asObject(lifecycle.runtime).executionMode, 80) || '-', detail: 'Current delivery runtime mode' },
      { label: 'Restore phase', value: trimText(restoreState.phase || restoreState.status, 80) || 'Idle', detail: restoreState.running ? 'Restore currently running' : 'No active restore task' },
      { label: 'Signals', value: formatNumber(toArray(lifecycle.signals).length), detail: 'Signals linked to operator controls' },
    ]),
    panelSection('Control guidance', 'Use this route to review current platform control posture before opening a guarded mutation flow.'),
  ], [
    digestSection('Control summary', 'Current control posture from runtime and recovery payloads.', [
      statItem('Runtime mode', trimText(asObject(lifecycle.runtime).executionMode, 80) || '-', 'Resolved from delivery lifecycle runtime state.'),
      statItem('Restore running', restoreState.running ? 'Yes' : 'No', 'Whether a restore task is currently active.'),
    ]),
  ]);
}

function buildRecovery(pathname, payloadValue) {
  const payload = asObject(payloadValue);
  const restoreState = asObject(payload.restoreState);
  const history = uniqueById(payload.restoreHistory, ['id', 'restoreId']).slice(0, 12);
  const backups = uniqueById(payload.backupFiles, ['file', 'id']).slice(0, 12);
  return pageLayout([
    metricSection('Recovery posture', [
      { label: 'Restore running', value: restoreState.running ? 'Yes' : 'No', detail: trimText(restoreState.phase || restoreState.status, 80) || 'Idle' },
      { label: 'History rows', value: formatNumber(history.length), detail: 'Recent restore operations' },
      { label: 'Backup files', value: formatNumber(backups.length), detail: 'Visible backup snapshots' },
    ]),
    tableSection('Restore history', history, [
      { label: 'Restore', render: (row) => textCell(row.id || row.restoreId, row.tenantId || row.scope) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.phase || '-', 80)) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt || row.at)) },
    ], { emptyMessage: 'No restore history is currently visible.' }),
    tableSection('Backup files', backups, [
      { label: 'Snapshot', render: (row) => textCell(row.file || row.id, row.tenantId || row.scope) },
      { label: 'Size', render: (row) => escapeHtml(trimText(row.sizeHuman || row.sizeBytes || '-', 80)) },
      { label: 'Created', render: (row) => escapeHtml(formatDateTime(row.createdAt || row.updatedAt || row.at)) },
    ], { emptyMessage: 'No backup files are currently visible.' }),
  ], [
    digestSection('Recovery summary', 'Current restore and snapshot posture.', [
      statItem('Restore phase', trimText(restoreState.phase || restoreState.status, 80) || 'Idle', 'Latest restore phase visible to Owner.'),
      statItem('History rows', formatNumber(history.length), 'Restore operations currently shown in this view.'),
      statItem('Snapshots', formatNumber(backups.length), 'Backup files currently visible to Owner.'),
    ]),
  ]);
}

function buildBackupDetail(pathname, payloadValue) {
  const backups = uniqueById(gatherCollections(payloadValue).backups, ['file', 'id']);
  const backupId = segmentAt(pathname, 3);
  const record = findRecord(backups, backupId, ['file', 'id']);
  return pageLayout([
    detailCardsSection('Backup detail', record || { file: backupId }),
  ], [
    digestSection('Backup context', 'Current backup route summary.', [
      statItem('Backup id', backupId, 'Identifier resolved from the route.'),
      statItem('Tenant scope', firstTextValue(record, ['tenantId', 'scope']) || '-', 'Current tenant or scope linked to the snapshot.'),
      statItem('Created', formatDateTime(firstTextValue(record, ['createdAt', 'updatedAt', 'at']) || ''), 'Snapshot timestamp.'),
    ]),
  ]);
}

function renderRouteBody(pathname, payloadValue) {
  const routeKey = routeKeyFromPath(pathname);
  switch (routeKey) {
    case 'overview': return buildOverview(pathname, payloadValue);
    case 'tenants': return buildTenants(pathname, payloadValue);
    case 'tenant-create': return buildTenantCreate(pathname, payloadValue);
    case 'tenant-detail': return buildTenantDetail(pathname, payloadValue);
    case 'packages': return buildPackages(pathname, payloadValue);
    case 'packages-create': return buildPackages(pathname, payloadValue);
    case 'packages-entitlements': return buildPackages(pathname, payloadValue);
    case 'package-detail': return buildPackageDetail(pathname, payloadValue);
    case 'subscriptions': return buildSubscriptions(pathname, payloadValue);
    case 'subscriptions-registry': return buildSubscriptions(pathname, payloadValue);
    case 'subscription-detail': return buildSubscriptionDetail(pathname, payloadValue);
    case 'billing': return buildBilling(pathname, payloadValue);
    case 'billing-recovery': return buildBilling(pathname, payloadValue);
    case 'billing-attempts': return buildBilling(pathname, payloadValue);
    case 'invoice-detail': return buildInvoiceDetail(pathname, payloadValue);
    case 'attempt-detail': return buildAttemptDetail(pathname, payloadValue);
    case 'runtime': return buildRuntime(pathname, payloadValue);
    case 'runtime-create-server': return buildRuntime(pathname, payloadValue);
    case 'runtime-provision-runtime': return buildRuntime(pathname, payloadValue);
    case 'agents-bots': return buildAgentsBots(pathname, payloadValue);
    case 'fleet-diagnostics': return buildFleetDiagnostics(pathname, payloadValue);
    case 'incidents': return buildIncidents(pathname, payloadValue);
    case 'jobs': return buildJobs(pathname, payloadValue);
    case 'analytics': return buildAnalytics(pathname, payloadValue);
    case 'analytics-risk': return buildAnalytics(pathname, payloadValue);
    case 'analytics-packages': return buildAnalytics(pathname, payloadValue);
    case 'automation': return buildAutomation(pathname, payloadValue);
    case 'support': return buildSupport(pathname, payloadValue);
    case 'support-detail': return buildSupportDetail(pathname, payloadValue);
    case 'audit': return buildAudit(pathname, payloadValue);
    case 'security': return buildSecurity(pathname, payloadValue);
    case 'access': return buildAccess(pathname, payloadValue);
    case 'diagnostics': return buildDiagnostics(pathname, payloadValue);
    case 'settings': return buildSettings(pathname, payloadValue);
    case 'settings-admin-users': return buildSettings(pathname, payloadValue);
    case 'settings-services': return buildSettings(pathname, payloadValue);
    case 'settings-access-policy': return buildSettings(pathname, payloadValue);
    case 'settings-portal-policy': return buildSettings(pathname, payloadValue);
    case 'settings-billing-policy': return buildSettings(pathname, payloadValue);
    case 'settings-runtime-policy': return buildSettings(pathname, payloadValue);
    case 'control': return buildControl(pathname, payloadValue);
    case 'recovery': return buildRecovery(pathname, payloadValue);
    case 'recovery-create': return buildRecovery(pathname, payloadValue);
    case 'recovery-preview': return buildRecovery(pathname, payloadValue);
    case 'recovery-restore': return buildRecovery(pathname, payloadValue);
    case 'recovery-history': return buildRecovery(pathname, payloadValue);
    case 'backup-detail': return buildBackupDetail(pathname, payloadValue);
    default: return buildOverview(pathname, payloadValue);
  }
}

function buildTenantDetail(pathname, payloadValue) {
  const collections = gatherCollections(payloadValue);
  const tenantId = segmentAt(pathname, 2);
  const record = findRecord(collections.tenants, tenantId, ['tenantId', 'id', 'slug', 'externalId', 'name', 'tenantName']);
  const subscriptions = uniqueById(collections.subscriptions, ['subscriptionId', 'id'])
    .filter((row) => [row.tenantId, row.id, row.slug, row.name].map((value) => trimText(value, 180)).includes(trimText(tenantId, 180)))
    .slice(0, 12);
  const runtimes = uniqueById(collections.agents, ['runtimeKey', 'id', 'agentId'])
    .filter((row) => [row.tenantId, row.scope, row.label].map((value) => trimText(value, 180)).includes(trimText(tenantId, 180)))
    .slice(0, 12);
  return pageLayout([
    detailCardsSection('Tenant details', record || { tenantId }),
    tableSection('Subscriptions', subscriptions, [
      { label: 'Subscription', render: (row) => textCell(row.subscriptionId || row.id, row.planId || row.packageId || row.packageName) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.subscriptionStatus || '-', 80)) },
      { label: 'Renewal', render: (row) => escapeHtml(formatDateTime(row.currentPeriodEnd || row.updatedAt)) },
    ], { emptyMessage: 'No subscriptions are currently linked to this tenant.' }),
    tableSection('Runtime bindings', runtimes, [
      { label: 'Runtime', render: (row) => textCell(row.label || row.runtimeKey || row.id, row.kind || row.type || row.agentId) },
      { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.state || '-', 80)) },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.lastSeenAt || row.createdAt)) },
    ], { emptyMessage: 'No runtime bindings are currently visible for this tenant.' }),
  ], [
    digestSection('Tenant context', 'Current selected tenant summary.', [
      statItem('Tenant id', tenantId, 'Identifier resolved from the route.'),
      statItem('Subscriptions', formatNumber(subscriptions.length), 'Visible subscription rows linked to this tenant.'),
      statItem('Runtime bindings', formatNumber(runtimes.length), 'Visible runtime rows linked to this tenant.'),
    ]),
  ]);
}

function renderRouteHeaderMarkup(routeKey, meta, actionsHtml) {
  const presentation = routeVisualPresentation(routeKey);
  const badgeMarkup = presentation.badges
    .map((label) => `<span class="owner-live-route-badge">${escapeHtml(label)}</span>`)
    .join('');
  const highlightMarkup = Array.isArray(presentation.highlights)
    ? presentation.highlights.map((label) => `<span class="owner-live-route-highlight">${escapeHtml(label)}</span>`).join('')
    : '';
  return [
    `  <section id="ownerStitchRouteHeader" class="owner-live-route-header" data-owner-layout="page-header" data-owner-route-key="${escapeHtml(routeKey)}" data-owner-route-visual="${escapeHtml(presentation.visual)}">`,
    '    <div class="owner-live-route-copy">',
    '      <div class="owner-live-route-topline">',
    `        <span class="owner-live-route-eyebrow">${escapeHtml(presentation.eyebrow)}</span>`,
    `        <div class="owner-live-route-badges">${badgeMarkup}</div>`,
    '      </div>',
    '      <div class="owner-live-route-heading">',
    `        <h1 data-owner-role="page-heading">${escapeHtml(meta.title)}</h1>`,
    `        <p data-owner-role="page-subtitle">${escapeHtml(meta.subtitle)}</p>`,
    '      </div>',
    '      <div class="owner-live-route-brief">',
    `        <p class="owner-live-route-focus">${escapeHtml(presentation.focus || '')}</p>`,
    `        <div class="owner-live-route-highlights">${highlightMarkup}</div>`,
    '      </div>',
    '    </div>',
    '    <div class="owner-live-route-side">',
    '      <div class="owner-live-route-media" aria-hidden="true">',
    '        <span class="owner-live-route-media-glow"></span>',
    '        <span class="owner-live-route-media-image"></span>',
    '        <span class="owner-live-route-media-orbit owner-live-route-media-orbit-a"></span>',
    '        <span class="owner-live-route-media-orbit owner-live-route-media-orbit-b"></span>',
    '      </div>',
    `      <div class="owner-live-route-actions" data-owner-layout="page-actions">${actionsHtml}</div>`,
    '    </div>',
    '  </section>',
  ].join('\n');
}

function renderOwnerStitchServerSurface(pathname, bootstrapState) {
  const routeKey = routeKeyFromPath(pathname);
  const meta = routeMeta(pathname, routeKey);
  const body = renderRouteBody(pathname, asObject(bootstrapState).payload || asObject(bootstrapState));
  const actions = routeActionLinks(pathname, routeKey).filter(Boolean).join('');
  const presentation = routeVisualPresentation(routeKey);
  return [
    `<div id="ownerStitchSurface" data-owner-route-key="${escapeHtml(routeKey)}" data-owner-route-visual="${escapeHtml(presentation.visual)}">`,
    renderRouteHeaderMarkup(routeKey, meta, actions),
    '  <div id="ownerStitchLiveData" data-owner-server-rendered="true">',
    wrapOwnerRouteShell(routeKey, body || emptyState(meta.title, meta.subtitle)),
    '  </div>',
    '</div>',
  ].join('\n');
}

module.exports = {
  renderOwnerStitchServerSurface,
};
