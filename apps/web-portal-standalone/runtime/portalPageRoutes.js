'use strict';

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

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
  return new Intl.NumberFormat('th-TH').format(numeric);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatPercent(value, fallback = '-') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return `${(numeric * 100).toFixed(numeric > 0 && numeric < 0.995 ? 1 : 0)}%`;
}

function formatCurrencyAmount(cents, currency = 'THB', fallback = '-') {
  const numeric = Number(cents);
  if (!Number.isFinite(numeric)) return fallback;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'THB').trim() || 'THB',
      maximumFractionDigits: 0,
    }).format(numeric / 100);
  } catch {
    return `${formatNumber(numeric / 100, '0')} ${String(currency || 'THB').trim() || 'THB'}`;
  }
}

function badge(label, tone = 'muted') {
  return `<span class="site-badge tone-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function renderPublicTable(columns, rows, emptyText) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    return `<div class="public-server-empty">${escapeHtml(emptyText)}</div>`;
  }
  return [
    '<div class="public-server-table-wrap"><table class="public-server-table"><thead><tr>',
    columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join(''),
    '</tr></thead><tbody>',
    safeRows.map((row) => `<tr>${columns.map((column) => `<td>${column.render(row)}</td>`).join('')}</tr>`).join(''),
    '</tbody></table></div>',
  ].join('');
}

function matchPublicServerPage(pathname) {
  const match = /^\/s\/([^/]+)(?:\/(stats|shop|events|donate))?\/?$/.exec(String(pathname || ''));
  if (!match) return null;
  try {
    return {
      slug: decodeURIComponent(match[1]),
      section: match[2] || null,
    };
  } catch {
    return {
      slug: match[1],
      section: match[2] || null,
    };
  }
}

function createPublicStatusModel(overview) {
  const analytics = overview?.analytics || {};
  const analyticsOverview = analytics?.overview || {};
  const posture = analytics?.posture || {};
  const delivery = analytics?.delivery || {};
  const tenants = analytics?.tenants || {};
  const subscriptions = analytics?.subscriptions || {};
  const licenses = analytics?.licenses || {};
  const api = analytics?.api || {};
  const agent = analytics?.agent || {};
  const billing = overview?.billing || {};
  const legal = overview?.legal || {};
  const marketplace = overview?.marketplace || {};

  const activeTenants = Number(
    analyticsOverview.activeTenants
      ?? tenants.active
      ?? tenants.total
      ?? 0,
  ) || 0;
  const activeSubscriptions = Number(
    analyticsOverview.activeSubscriptions
      ?? subscriptions.active
      ?? subscriptions.total
      ?? 0,
  ) || 0;
  const activeLicenses = Number(
    analyticsOverview.activeLicenses
      ?? licenses.active
      ?? licenses.total
      ?? 0,
  ) || 0;
  const activeApiKeys = Number(
    analyticsOverview.activeApiKeys
      ?? api.apiKeys
      ?? 0,
  ) || 0;
  const activeWebhooks = Number(
    analyticsOverview.activeWebhooks
      ?? api.webhooks
      ?? 0,
  ) || 0;
  const totalRuntimes = Number(
    analyticsOverview.totalAgentRuntimes
      ?? agent.runtimes
      ?? 0,
  ) || 0;
  const offlineRuntimes = Array.isArray(posture.offlineAgentRuntimes)
    ? posture.offlineAgentRuntimes.length
    : Math.max(Number(agent.outdated || 0) || 0, 0);
  const readyRuntimes = Number(
    analyticsOverview.onlineAgentRuntimes
      ?? Math.max(totalRuntimes - offlineRuntimes, 0),
  ) || 0;
  const unresolvedTickets = Array.isArray(posture.unresolvedTickets)
    ? posture.unresolvedTickets.length
    : 0;
  const failedWebhooks = Array.isArray(posture.failedWebhooks)
    ? posture.failedWebhooks.length
    : 0;
  const expiringSubscriptions = Array.isArray(posture.expiringSubscriptions)
    ? posture.expiringSubscriptions.length
    : 0;
  const expiringLicenses = Array.isArray(posture.expiringLicenses)
    ? posture.expiringLicenses.length
    : 0;
  const queueJobs = Number(delivery.queueJobs || 0) || 0;
  const deadLetters = Number(delivery.deadLetters || 0) || 0;
  const deliverySuccessRate = Number(delivery.successRate || 0) || 0;
  const purchaseCount30d = Number(delivery.purchaseCount30d || 0) || 0;

  let health = {
    label: 'Operational',
    tone: 'success',
    detail: 'No public platform issues are currently elevated.',
  };
  if (failedWebhooks > 0 || offlineRuntimes > 0 || deadLetters > 0) {
    health = {
      label: 'Needs attention',
      tone: 'warning',
      detail: 'Runtime, delivery, or webhook signals need operator follow-up.',
    };
  } else if (unresolvedTickets > 0 || expiringSubscriptions > 0 || expiringLicenses > 0 || queueJobs > 0) {
    health = {
      label: 'Watch closely',
      tone: 'info',
      detail: 'The platform is operating, but there are items worth tracking.',
    };
  }

  return {
    generatedAt: overview?.generatedAt || null,
    brandName: overview?.brand?.name || 'SCUM TH Platform',
    brandDescription: overview?.brand?.description || 'Public platform status and service posture.',
    billingCurrency: billing.currency || analyticsOverview.currency || 'THB',
    activeTenants,
    activeSubscriptions,
    activeLicenses,
    activeApiKeys,
    activeWebhooks,
    readyRuntimes,
    totalRuntimes,
    offlineRuntimes,
    unresolvedTickets,
    failedWebhooks,
    expiringSubscriptions,
    expiringLicenses,
    queueJobs,
    deadLetters,
    deliverySuccessRate,
    purchaseCount30d,
    mrrCents: Number(subscriptions.mrrCents || analyticsOverview.totalRevenueCents || 0) || 0,
    packageCount: Array.isArray(billing.packages) ? billing.packages.length : 0,
    planCount: Array.isArray(billing.plans) ? billing.plans.length : 0,
    featureCount: Array.isArray(billing.features) ? billing.features.length : 0,
    marketplaceEnabled: marketplace.enabled === true,
    marketplaceOfferCount: Array.isArray(marketplace.offers) ? marketplace.offers.length : 0,
    trialEnabled: overview?.trial?.enabled === true,
    legalDocCount: Array.isArray(legal.docs) ? legal.docs.length : 0,
    legalDocs: Array.isArray(legal.docs) ? legal.docs : [],
    failedWebhookRows: Array.isArray(posture.failedWebhooks) ? posture.failedWebhooks.slice(0, 8) : [],
    offlineRuntimeRows: Array.isArray(posture.offlineAgentRuntimes) ? posture.offlineAgentRuntimes.slice(0, 8) : [],
    unresolvedTicketRows: Array.isArray(posture.unresolvedTickets) ? posture.unresolvedTickets.slice(0, 8) : [],
    health,
  };
}

function renderPublicStatusPage(overview) {
  const model = createPublicStatusModel(overview);
  const watchItems = [
    {
      label: 'Failed webhooks',
      value: formatNumber(model.failedWebhooks, '0'),
      detail: 'Outbound platform webhooks that need retry or review.',
      tone: model.failedWebhooks > 0 ? 'warning' : 'success',
    },
    {
      label: 'Offline runtimes',
      value: `${formatNumber(model.readyRuntimes, '0')} / ${formatNumber(model.totalRuntimes, '0')}`,
      detail: 'Ready runtime count compared with the total registered runtime fleet.',
      tone: model.offlineRuntimes > 0 ? 'warning' : 'success',
    },
    {
      label: 'Delivery backlog',
      value: `${formatNumber(model.queueJobs, '0')} queued / ${formatNumber(model.deadLetters, '0')} dead letters`,
      detail: 'Delivery queue depth and dead-letter pressure in the current window.',
      tone: model.deadLetters > 0 ? 'warning' : (model.queueJobs > 0 ? 'info' : 'success'),
    },
    {
      label: 'Support pressure',
      value: formatNumber(model.unresolvedTickets, '0'),
      detail: 'Unresolved support tickets that still need operator follow-up.',
      tone: model.unresolvedTickets > 0 ? 'info' : 'success',
    },
  ];

  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>SCUM TH Platform | Platform Status</title>`,
    '<link rel="stylesheet" href="/player/assets/ui/platform-site-v3.css?v=20260327-live-1">',
    '<style>',
    '.status-main{padding:32px 24px 56px;display:grid;gap:24px;max-width:1280px;margin:0 auto;}',
    '.status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;}',
    '.status-panel,.status-metric{border:1px solid var(--site-border);background:var(--site-surface);border-radius:24px;box-shadow:var(--site-shadow);}',
    '.status-panel{padding:24px;display:grid;gap:16px;}',
    '.status-hero{padding:28px;}',
    '.status-panel-head{display:grid;gap:8px;}',
    '.status-kicker{color:var(--site-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;}',
    '.status-panel h1,.status-panel h2{margin:0;font-size:clamp(1.35rem,2vw,2.25rem);}',
    '.status-panel p{margin:0;color:var(--site-text-soft);line-height:1.6;}',
    '.status-chip-row{display:flex;flex-wrap:wrap;gap:10px;}',
    '.status-metric{padding:20px;display:grid;gap:8px;}',
    '.status-metric span{color:var(--site-text-muted);font-size:.84rem;}',
    '.status-metric strong{font-size:1.6rem;}',
    '.status-metric small{color:var(--site-text-soft);line-height:1.5;}',
    '.status-list{display:grid;gap:12px;}',
    '.status-list-item{border:1px solid var(--site-border);border-radius:18px;padding:14px 16px;background:rgba(255,255,255,.02);display:grid;gap:6px;}',
    '.status-table-wrap{overflow:auto;}',
    '.status-table{width:100%;border-collapse:collapse;}',
    '.status-table th,.status-table td{padding:12px 10px;border-top:1px solid var(--site-border);text-align:left;vertical-align:top;}',
    '.status-table th{color:var(--site-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;}',
    '.status-empty{padding:16px;border:1px dashed var(--site-border);border-radius:18px;color:var(--site-text-soft);}',
    '@media (max-width: 720px){.status-main{padding:20px 14px 40px}.status-panel,.status-metric{border-radius:20px}}',
    '</style></head><body class="public-v3"><div class="site-shell">',
    '<header class="site-topbar"><div class="site-topbar-main">',
    '<a class="site-brand" href="/landing"><span class="site-brand-mark">SCUM</span><span class="site-brand-copy">',
    `<strong class="site-brand-title">${escapeHtml(model.brandName)}</strong>`,
    `<span class="site-brand-detail">${escapeHtml(model.brandDescription)}</span>`,
    '</span></a>',
    '<nav class="site-nav" aria-label="Primary">',
    '<a class="site-nav-link" href="/landing">Overview</a>',
    '<a class="site-nav-link" href="/pricing">Packages</a>',
    '<a class="site-nav-link is-active" href="/status">Status</a>',
    '<a class="site-nav-link" href="/login">Access</a>',
    '</nav></div><div class="site-topbar-tools">',
    '<a class="site-button" href="/player/login">Open Player Portal</a>',
    '<a class="site-button site-button-primary" href="/signup">Create Workspace</a>',
    '</div></header>',
    '<main class="status-main">',
    '<section class="status-panel status-hero">',
    '<div class="status-panel-head">',
    '<span class="status-kicker">Platform Status</span>',
    '<h1>Public status for runtimes, delivery, and operator pressure</h1>',
    '<p>This page exposes a customer-safe status summary built from public platform overview data. It is meant for fast checks, not internal incident triage.</p>',
    '</div>',
    `<div class="status-chip-row">${badge(model.health.label, model.health.tone)}${badge(`Updated ${formatDateTime(model.generatedAt)}`, 'info')}${badge(`${formatPercent(model.deliverySuccessRate, '0%')} delivery success`, model.deliverySuccessRate >= 0.98 ? 'success' : 'warning')}</div>`,
    `<p>${escapeHtml(model.health.detail)}</p>`,
    '</section>',
    '<section class="status-grid">',
    `<article class="status-metric"><span>Active tenants</span><strong>${escapeHtml(formatNumber(model.activeTenants, '0'))}</strong><small>Current tenant communities using the platform.</small></article>`,
    `<article class="status-metric"><span>Runtime availability</span><strong>${escapeHtml(formatNumber(model.readyRuntimes, '0'))} / ${escapeHtml(formatNumber(model.totalRuntimes, '0'))}</strong><small>Ready runtimes compared with the known runtime fleet.</small></article>`,
    `<article class="status-metric"><span>Failed webhooks</span><strong>${escapeHtml(formatNumber(model.failedWebhooks, '0'))}</strong><small>Webhook deliveries that still need retry or review.</small></article>`,
    `<article class="status-metric"><span>Unresolved tickets</span><strong>${escapeHtml(formatNumber(model.unresolvedTickets, '0'))}</strong><small>Open support items still visible in the current posture window.</small></article>`,
    `<article class="status-metric"><span>Delivery queue</span><strong>${escapeHtml(formatNumber(model.queueJobs, '0'))}</strong><small>Queued deliveries across the tracked runtime window.</small></article>`,
    `<article class="status-metric"><span>Dead letters</span><strong>${escapeHtml(formatNumber(model.deadLetters, '0'))}</strong><small>Deliveries that could not complete and require recovery.</small></article>`,
    '</section>',
    '<section class="status-grid">',
    '<article class="status-panel"><div class="status-panel-head"><span class="status-kicker">Watch items</span><h2>What operators are watching now</h2><p>These counts summarize the most visible pressure signals without exposing owner-only internals.</p></div>',
    `<div class="status-list">${watchItems.map((item) => `<div class="status-list-item"><div>${badge(item.label, item.tone)}</div><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.detail)}</p></div>`).join('')}</div>`,
    '</article>',
    '<article class="status-panel"><div class="status-panel-head"><span class="status-kicker">Commercial footprint</span><h2>Public product readiness signals</h2><p>This section summarizes the currently exposed plan catalog and legal surface.</p></div>',
    `<div class="status-list">`,
    `<div class="status-list-item"><div>${badge('Subscriptions', model.activeSubscriptions > 0 ? 'success' : 'muted')}</div><strong>${escapeHtml(formatNumber(model.activeSubscriptions, '0'))} active</strong><p>${escapeHtml(formatCurrencyAmount(model.mrrCents, model.billingCurrency, `0 ${model.billingCurrency}`))} monthly recurring revenue signal.</p></div>`,
    `<div class="status-list-item"><div>${badge('Licenses', model.activeLicenses > 0 ? 'success' : 'muted')}</div><strong>${escapeHtml(formatNumber(model.activeLicenses, '0'))} active</strong><p>${escapeHtml(formatNumber(model.expiringLicenses, '0'))} expiring soon, ${escapeHtml(formatNumber(model.expiringSubscriptions, '0'))} subscriptions worth tracking.</p></div>`,
    `<div class="status-list-item"><div>${badge('Catalog', model.packageCount > 0 ? 'info' : 'muted')}</div><strong>${escapeHtml(formatNumber(model.packageCount, '0'))} packages / ${escapeHtml(formatNumber(model.planCount, '0'))} plans</strong><p>${escapeHtml(formatNumber(model.featureCount, '0'))} public features listed. Trial is ${model.trialEnabled ? 'enabled' : 'disabled'}.</p></div>`,
    `<div class="status-list-item"><div>${badge('Marketplace', model.marketplaceEnabled ? 'info' : 'muted')}</div><strong>${escapeHtml(formatNumber(model.marketplaceOfferCount, '0'))} live offers</strong><p>${escapeHtml(formatNumber(model.legalDocCount, '0'))} legal documents are exposed from the public site.</p></div>`,
    `</div></article>`,
    '</section>',
    '<section class="status-grid">',
    `<article class="status-panel"><div class="status-panel-head"><span class="status-kicker">Webhook review</span><h2>Recent webhook pressure</h2></div>${renderPublicTable([
      { label: 'Target', render: (row) => escapeHtml(row?.name || row?.targetUrl || '-') },
      { label: 'Status', render: (row) => badge(row?.status || 'failed', 'warning') },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row?.updatedAt || row?.lastAttemptAt)) },
    ], model.failedWebhookRows, 'No failed webhook entries are currently exposed in the public posture window.')}</article>`,
    `<article class="status-panel"><div class="status-panel-head"><span class="status-kicker">Runtime pressure</span><h2>Offline runtimes and support load</h2></div>${renderPublicTable([
      { label: 'Runtime', render: (row) => escapeHtml(row?.runtimeKey || row?.name || '-') },
      { label: 'Status', render: (row) => badge(row?.status || 'offline', 'warning') },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row?.updatedAt || row?.lastHeartbeatAt)) },
    ], model.offlineRuntimeRows, 'No offline runtime rows are currently exposed.')}<div style="height:12px"></div>${renderPublicTable([
      { label: 'Ticket', render: (row) => escapeHtml(row?.title || row?.id || '-') },
      { label: 'Status', render: (row) => badge(row?.status || 'open', 'info') },
      { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row?.updatedAt || row?.createdAt)) },
    ], model.unresolvedTicketRows, 'No unresolved support items are currently exposed.')}</article>`,
    '</section>',
    '<section class="status-panel"><div class="status-panel-head"><span class="status-kicker">References</span><h2>Public links</h2><p>These links stay on the customer-facing surface.</p></div>',
    `<div class="status-chip-row">${model.legalDocs.map((doc) => `<a class="site-button" href="${escapeHtml(doc?.url || '#')}">${escapeHtml(doc?.title || 'Legal document')}</a>`).join('')}<a class="site-button" href="/pricing">View packages</a><a class="site-button site-button-primary" href="/signup">Create workspace</a></div>`,
    '</section>',
    '</main></div></body></html>',
  ].join('');
}

function renderPublicChangeFeedPage(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const latest = safeEntries[0] || null;

  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>SCUM TH Platform | Change Feed</title>',
    '<link rel="stylesheet" href="/player/assets/ui/platform-site-v3.css?v=20260327-live-1">',
    '<style>',
    '.change-main{padding:32px 24px 56px;display:grid;gap:24px;max-width:1280px;margin:0 auto;}',
    '.change-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);gap:20px;align-items:start;}',
    '.change-card,.change-entry{border:1px solid var(--site-border);background:var(--site-surface);border-radius:24px;box-shadow:var(--site-shadow);}',
    '.change-card{padding:24px;display:grid;gap:16px;}',
    '.change-card h1,.change-card h2,.change-entry h3{margin:0;}',
    '.change-card p,.change-entry p{margin:0;color:var(--site-text-soft);line-height:1.6;}',
    '.change-kicker{color:var(--site-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;}',
    '.change-stack{display:grid;gap:16px;}',
    '.change-entry{padding:20px;display:grid;gap:14px;}',
    '.change-meta{display:flex;flex-wrap:wrap;gap:10px;}',
    '.change-list{display:grid;gap:8px;padding:0;margin:0;list-style:none;}',
    '.change-list li{padding-left:16px;position:relative;color:var(--site-text-soft);}',
    '.change-list li::before{content:"";position:absolute;left:0;top:.7em;width:6px;height:6px;border-radius:999px;background:var(--site-accent, #d6b26e);}',
    '.change-empty{padding:20px;border:1px dashed var(--site-border);border-radius:20px;color:var(--site-text-soft);}',
    '@media (max-width: 900px){.change-grid{grid-template-columns:1fr}.change-main{padding:20px 14px 40px}}',
    '</style></head><body class="public-v3"><div class="site-shell">',
    '<header class="site-topbar"><div class="site-topbar-main">',
    '<a class="site-brand" href="/landing"><span class="site-brand-mark">SCUM</span><span class="site-brand-copy"><strong class="site-brand-title">SCUM TH Platform</strong><span class="site-brand-detail">Public release notes and operator-facing change summaries.</span></span></a>',
    '<nav class="site-nav" aria-label="Primary">',
    '<a class="site-nav-link" href="/landing">Overview</a>',
    '<a class="site-nav-link" href="/pricing">Packages</a>',
    '<a class="site-nav-link" href="/status">Status</a>',
    '<a class="site-nav-link is-active" href="/changes">Changes</a>',
    '<a class="site-nav-link" href="/login">Access</a>',
    '</nav></div><div class="site-topbar-tools">',
    '<a class="site-button" href="/docs/releases/README.md">Release docs</a>',
    '<a class="site-button site-button-primary" href="/signup">Create Workspace</a>',
    '</div></header>',
    '<main class="change-main">',
    '<section class="change-card">',
    '<span class="change-kicker">Change Feed</span>',
    '<h1>Release notes tied to repository versions</h1>',
    '<p>This page turns the release notes already tracked in the repository into a customer-facing change feed. It stays grounded in <code>docs/releases</code> instead of maintaining a separate content store.</p>',
    `<div class="change-meta">${latest ? `${badge(`Latest ${latest.version}`, 'info')}${latest.referenceDate ? badge(`Reference ${latest.referenceDate}`, 'muted') : ''}` : badge('No published releases yet', 'muted')}</div>`,
    '</section>',
    '<section class="change-grid">',
    '<div class="change-stack">',
    safeEntries.length
      ? safeEntries.map((entry) => [
        '<article class="change-entry">',
        `<div class="change-meta">${badge(entry.version, 'info')}${entry.referenceDate ? badge(entry.referenceDate, 'muted') : ''}${entry.operatorImpact.length ? badge(`${formatNumber(entry.operatorImpact.length, '0')} operator notes`, 'warning') : ''}</div>`,
        `<h3>${escapeHtml(entry.title || entry.version)}</h3>`,
        `<p>${escapeHtml(entry.summary || 'No release summary has been written yet.')}</p>`,
        entry.highlights.length
          ? `<ul class="change-list">${entry.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
          : '',
        `<div class="change-meta"><a class="site-button site-button-primary" href="${escapeHtml(entry.url || '#')}">Open release note</a></div>`,
        '</article>',
      ].join('')).join('')
      : '<div class="change-empty">No versioned release notes are published yet.</div>',
    '</div>',
    '<aside class="change-stack">',
    '<article class="change-card">',
    '<span class="change-kicker">How to read this</span>',
    '<h2>What this feed includes</h2>',
    '<ul class="change-list"><li>Versioned release notes from the repository</li><li>Operator impact cues for deploy and support teams</li><li>Links back to full markdown evidence</li></ul>',
    '</article>',
    `<article class="change-card"><span class="change-kicker">Latest release</span><h2>${escapeHtml(latest?.title || 'No release note yet')}</h2><p>${escapeHtml(latest?.summary || 'Publish a versioned release note in docs/releases to populate this section.')}</p>${latest?.knownLimitations?.length ? `<ul class="change-list">${latest.knownLimitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</article>`,
    '<article class="change-card"><span class="change-kicker">References</span><h2>Related public docs</h2><div class="change-meta"><a class="site-button" href="/docs/releases/README.md">Release notes guide</a><a class="site-button" href="/status">Platform status</a><a class="site-button" href="/pricing">Packages</a></div></article>',
    '</aside>',
    '</section>',
    '</main></div></body></html>',
  ].join('');
}

function renderPublicServerPage(snapshot, section) {
  const tenant = snapshot?.tenant || {};
  const featureAccess = snapshot?.featureAccess || {};
  const sections = featureAccess.sections || {};
  const servers = Array.isArray(snapshot?.servers) ? snapshot.servers : [];
  const shopItems = Array.isArray(snapshot?.shopItems) ? snapshot.shopItems : [];
  const leaderboard = Array.isArray(snapshot?.leaderboard) ? snapshot.leaderboard : [];
  const killfeed = Array.isArray(snapshot?.killfeed) ? snapshot.killfeed : [];
  const raidWindows = Array.isArray(snapshot?.raidWindows) ? snapshot.raidWindows : [];
  const raidSummaries = Array.isArray(snapshot?.raidSummaries) ? snapshot.raidSummaries : [];
  const donations = snapshot?.donations || {};
  const supporters = Array.isArray(snapshot?.supporters) ? snapshot.supporters : [];
  const summary = donations.summary || {};
  const currentSection = ['stats', 'shop', 'events', 'donate'].includes(section) ? section : 'stats';
  const sectionEnabled = sections[currentSection]?.enabled !== false;
  const sectionMeta = {
    stats: {
      title: 'สถิติชุมชน',
      subtitle: 'ดูอันดับ การต่อสู้ล่าสุด และภาพรวมการเล่นของเซิร์ฟเวอร์นี้',
    },
    shop: {
      title: 'ร้านค้าชุมชน',
      subtitle: 'ดูรายการที่เปิดขายและแพ็กเกจที่ใช้ในชุมชนนี้ได้ก่อนล็อกอิน',
    },
    events: {
      title: 'กิจกรรมและช่วงเวลาเรด',
      subtitle: 'รวมตารางกิจกรรม สรุปผล และความเคลื่อนไหวที่ผู้เล่นควรรู้',
    },
    donate: {
      title: 'สนับสนุนเซิร์ฟเวอร์',
      subtitle: 'ดูแพ็กเกจสนับสนุน ความเคลื่อนไหวล่าสุด และภาพรวมผู้สนับสนุนของชุมชนนี้',
    },
  };

  let bodyHtml = '';
  if (!sectionEnabled) {
    bodyHtml = [
      '<section class="public-server-card public-server-card-hero">',
      '<div class="public-server-stack">',
      `<span class="public-server-kicker">ยังไม่เปิดใช้งาน</span><h1>${escapeHtml(sectionMeta[currentSection].title)}</h1>`,
      '<p>ส่วนนี้ยังไม่เปิดในแพ็กเกจปัจจุบันของเซิร์ฟเวอร์นี้ แต่คุณยังดูส่วนอื่นของชุมชนได้ตามปกติ</p>',
      `<div class="public-server-actions"><a class="site-button" href="/s/${encodeURIComponent(tenant.slug || '')}/stats">กลับไปหน้าสถิติ</a><a class="site-button site-button-primary" href="/signup">สร้างพื้นที่ของคุณเอง</a></div>`,
      '</div></section>',
    ].join('');
  } else if (currentSection === 'stats') {
    bodyHtml = [
      '<section class="public-server-metrics">',
      `<article class="public-server-metric"><span>เซิร์ฟเวอร์</span><strong>${formatNumber(servers.length, '0')}</strong><small>รายการที่ผูกกับ tenant นี้</small></article>`,
      `<article class="public-server-metric"><span>ผู้เล่นในอันดับ</span><strong>${formatNumber(leaderboard.length, '0')}</strong><small>อ่านจากข้อมูลสถิติที่มีอยู่ตอนนี้</small></article>`,
      `<article class="public-server-metric"><span>การต่อสู้ล่าสุด</span><strong>${formatNumber(killfeed.length, '0')}</strong><small>รายการจาก killfeed ล่าสุด</small></article>`,
      `<article class="public-server-metric"><span>อัปเดต</span><strong>${escapeHtml(formatDateTime(snapshot.generatedAt))}</strong><small>เวลาที่สร้างหน้าสาธารณะนี้</small></article>`,
      '</section>',
      '<section class="public-server-grid">',
      `<article class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">อันดับ</span><h2>ผู้เล่นเด่นของชุมชน</h2></div>${renderPublicTable([
        { label: 'ผู้เล่น', render: (row) => escapeHtml(row.userId || '-') },
        { label: 'Kills', render: (row) => escapeHtml(formatNumber(row.kills, '0')) },
        { label: 'Deaths', render: (row) => escapeHtml(formatNumber(row.deaths, '0')) },
        { label: 'KD', render: (row) => escapeHtml(Number(row.kd || 0).toFixed(2)) },
      ], leaderboard, 'ยังไม่มีข้อมูลอันดับสำหรับเซิร์ฟเวอร์นี้')}</article>`,
      `<article class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">การต่อสู้ล่าสุด</span><h2>Killfeed ล่าสุด</h2></div>${renderPublicTable([
        { label: 'ผู้ชนะ', render: (row) => escapeHtml(row.killerName || '-') },
        { label: 'เป้าหมาย', render: (row) => escapeHtml(row.victimName || '-') },
        { label: 'อาวุธ', render: (row) => escapeHtml(row.weapon || '-') },
        { label: 'เวลา', render: (row) => escapeHtml(formatDateTime(row.occurredAt)) },
      ], killfeed.slice(0, 10), 'ยังไม่มีรายการการต่อสู้ล่าสุด')}</article>`,
      '</section>',
    ].join('');
  } else if (currentSection === 'shop') {
    bodyHtml = [
      '<section class="public-server-metrics">',
      `<article class="public-server-metric"><span>ของที่เปิดขาย</span><strong>${formatNumber(shopItems.length, '0')}</strong><small>รายการที่เปิดให้ผู้เล่นเห็นตอนนี้</small></article>`,
      `<article class="public-server-metric"><span>แพ็กเกจสนับสนุน</span><strong>${formatNumber(summary.supporterPackages, '0')}</strong><small>ผู้เล่นช่วยพยุงชุมชนผ่านแพ็กเกจนี้ได้</small></article>`,
      `<article class="public-server-metric"><span>ยอดสนับสนุนล่าสุด</span><strong>${formatNumber(summary.supporterPurchases30d, '0')}</strong><small>นับจากรายการสนับสนุนในช่วงล่าสุด</small></article>`,
      `<article class="public-server-metric"><span>CTA</span><strong>ล็อกอิน</strong><small>ซื้อและติดตามคำสั่งซื้อจาก Player Portal</small></article>`,
      '</section>',
      `<section class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">ร้านค้า</span><h2>รายการที่เปิดขาย</h2><p>หน้าสาธารณะนี้ไว้ให้ผู้เล่นดูแคตตาล็อกก่อนเข้าพอร์ทัลจริง</p></div>${renderPublicTable([
        { label: 'รายการ', render: (row) => escapeHtml(row.name || row.id || '-') },
        { label: 'ประเภท', render: (row) => escapeHtml(row.kind || 'item') },
        { label: 'ราคา', render: (row) => escapeHtml(formatNumber(row.price, '0')) },
        { label: 'รายละเอียด', render: (row) => escapeHtml(row.description || '-') },
      ], shopItems.slice(0, 12), 'ยังไม่มีรายการร้านค้าที่เปิดขายในตอนนี้')}<div class="public-server-actions"><a class="site-button" href="/player/login">เข้า Player Portal</a><a class="site-button site-button-primary" href="/signup">สร้างเซิร์ฟเวอร์ของคุณ</a></div></section>`,
    ].join('');
  } else if (currentSection === 'events') {
    bodyHtml = [
      '<section class="public-server-metrics">',
      `<article class="public-server-metric"><span>ช่วงเวลาเรด</span><strong>${formatNumber(raidWindows.length, '0')}</strong><small>หน้าต่างเวลาที่กำหนดไว้</small></article>`,
      `<article class="public-server-metric"><span>สรุปกิจกรรม</span><strong>${formatNumber(raidSummaries.length, '0')}</strong><small>ผลกิจกรรมหรือการเรดล่าสุด</small></article>`,
      `<article class="public-server-metric"><span>Killfeed</span><strong>${formatNumber(killfeed.length, '0')}</strong><small>ความเคลื่อนไหวที่เกิดขึ้นจริงในเกม</small></article>`,
      `<article class="public-server-metric"><span>เซิร์ฟเวอร์</span><strong>${escapeHtml(servers[0]?.name || tenant.name || '-')}</strong><small>เครื่องหลักของชุมชนนี้</small></article>`,
      '</section>',
      '<section class="public-server-grid">',
      `<article class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">ช่วงเวลา</span><h2>Raid windows</h2></div>${renderPublicTable([
        { label: 'ชื่อช่วง', render: (row) => escapeHtml(row.title || '-') },
        { label: 'เริ่ม', render: (row) => escapeHtml(formatDateTime(row.startsAt)) },
        { label: 'จบ', render: (row) => escapeHtml(formatDateTime(row.endsAt)) },
        { label: 'สถานะ', render: (row) => badge(row.status || '-', row.status === 'live' ? 'success' : 'info') },
      ], raidWindows.slice(0, 8), 'ยังไม่มีช่วงเวลาเรดที่เปิดเผยในตอนนี้')}</article>`,
      `<article class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">สรุปผล</span><h2>กิจกรรมล่าสุด</h2></div>${renderPublicTable([
        { label: 'ผลลัพธ์', render: (row) => escapeHtml(row.outcome || '-') },
        { label: 'หมายเหตุ', render: (row) => escapeHtml(row.notes || '-') },
        { label: 'เวลา', render: (row) => escapeHtml(formatDateTime(row.createdAt)) },
      ], raidSummaries.slice(0, 8), 'ยังไม่มีสรุปกิจกรรมล่าสุด')}</article>`,
      '</section>',
    ].join('');
  } else {
    bodyHtml = [
      '<section class="public-server-metrics">',
      `<article class="public-server-metric"><span>แพ็กเกจสนับสนุน</span><strong>${formatNumber(summary.supporterPackages, '0')}</strong><small>แพ็กเกจที่ผู้เล่นใช้สนับสนุนชุมชนได้</small></article>`,
      `<article class="public-server-metric"><span>ผู้สนับสนุนที่ใช้งานอยู่</span><strong>${formatNumber(summary.activeSupporters30d, '0')}</strong><small>นับจากรายการที่ส่งสำเร็จล่าสุด</small></article>`,
      `<article class="public-server-metric"><span>รายได้จากการสนับสนุน</span><strong>${formatNumber(summary.supporterRevenueCoins30d, '0')}</strong><small>เหรียญรวมในหน้าต่างเวลารายงาน</small></article>`,
      `<article class="public-server-metric"><span>อัปเดตล่าสุด</span><strong>${escapeHtml(formatDateTime(summary.lastPurchaseAt || snapshot.generatedAt))}</strong><small>รายการล่าสุดที่ระบบมองเห็นได้</small></article>`,
      '</section>',
      '<section class="public-server-grid">',
      `<article class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">แพ็กเกจ</span><h2>แพ็กเกจสนับสนุนยอดนิยม</h2></div>${renderPublicTable([
        { label: 'แพ็กเกจ', render: (row) => escapeHtml(row.name || row.id || '-') },
        { label: 'ซื้อ', render: (row) => escapeHtml(formatNumber(row.purchases30d, '0')) },
        { label: 'รายได้', render: (row) => escapeHtml(formatNumber(row.revenueCoins30d, '0')) },
        { label: 'สถานะล่าสุด', render: (row) => badge(row.latestStatus || '-', row.latestStatus === 'delivered' ? 'success' : 'info') },
      ], donations.topPackages || [], 'ยังไม่มีข้อมูลแพ็กเกจสนับสนุน')}</article>`,
      `<article class="public-server-card"><div class="public-server-card-head"><span class="public-server-kicker">ผู้สนับสนุน</span><h2>ชุมชนที่ช่วยพยุงเซิร์ฟเวอร์นี้</h2></div>${renderPublicTable([
        { label: 'ผู้สนับสนุน', render: (row) => escapeHtml(row.label || '-') },
        { label: 'แพ็กเกจล่าสุด', render: (row) => escapeHtml(row.latestPackage || '-') },
        { label: 'สถานะ', render: (row) => badge(row.latestStatus || '-', row.latestStatus === 'delivered' ? 'success' : 'info') },
        { label: 'ล่าสุดเมื่อ', render: (row) => escapeHtml(formatDateTime(row.lastPurchaseAt)) },
      ], supporters, 'ยังไม่มีรายชื่อผู้สนับสนุนที่เปิดเผยในตอนนี้')}<div class="public-server-actions"><a class="site-button" href="/player/login">เข้า Player Portal</a><a class="site-button site-button-primary" href="/signup">เปิดระบบของคุณเอง</a></div></article>`,
      '</section>',
    ].join('');
  }

  return [
    '<!doctype html><html lang="th"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>SCUM TH Platform | ${escapeHtml(sectionMeta[currentSection].title)} | ${escapeHtml(tenant.name || 'SCUM')}</title>`,
    '<link rel="stylesheet" href="/player/assets/ui/platform-site-v3.css?v=20260327-live-1">',
    '<style>',
    '.public-server-main{padding:32px 24px 56px;display:grid;gap:24px;max-width:1280px;margin:0 auto;}',
    '.public-server-card,.public-server-metric{border:1px solid var(--site-border);background:var(--site-surface);border-radius:24px;box-shadow:var(--site-shadow);}',
    '.public-server-card{padding:24px;display:grid;gap:16px;}',
    '.public-server-card-hero{padding:28px;}',
    '.public-server-card-head{display:grid;gap:8px;}',
    '.public-server-kicker{color:var(--site-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;}',
    '.public-server-card h1,.public-server-card h2{margin:0;font-size:clamp(1.35rem,2vw,2.25rem);}',
    '.public-server-card p{margin:0;color:var(--site-text-soft);line-height:1.6;}',
    '.public-server-stack{display:grid;gap:10px;}',
    '.public-server-actions{display:flex;flex-wrap:wrap;gap:12px;}',
    '.public-server-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;}',
    '.public-server-metric{padding:20px;display:grid;gap:8px;}',
    '.public-server-metric span{color:var(--site-text-muted);font-size:.84rem;}',
    '.public-server-metric strong{font-size:1.6rem;}',
    '.public-server-metric small{color:var(--site-text-soft);line-height:1.5;}',
    '.public-server-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;}',
    '.public-server-table-wrap{overflow:auto;}',
    '.public-server-table{width:100%;border-collapse:collapse;}',
    '.public-server-table th,.public-server-table td{padding:12px 10px;border-top:1px solid var(--site-border);text-align:left;vertical-align:top;}',
    '.public-server-table th{color:var(--site-text-muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;}',
    '.public-server-empty{padding:16px;border:1px dashed var(--site-border);border-radius:18px;color:var(--site-text-soft);}',
    '.site-badge{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;border:1px solid var(--site-border);font-size:.78rem;font-weight:700;}',
    '.site-badge.tone-success{background:rgba(135,187,133,.16);color:var(--site-success);}',
    '.site-badge.tone-info{background:rgba(138,167,213,.16);color:var(--site-info);}',
    '.site-badge.tone-warning{background:rgba(217,173,103,.16);color:var(--site-warning);}',
    '.site-badge.tone-muted{background:rgba(255,255,255,.04);color:var(--site-text-soft);}',
    '.public-server-chip-row{display:flex;flex-wrap:wrap;gap:10px;}',
    '@media (max-width: 720px){.public-server-main{padding:20px 14px 40px}.site-topbar{padding:14px}.public-server-card,.public-server-metric{border-radius:20px}}',
    '</style></head><body class="public-v3"><div class="site-shell">',
    '<header class="site-topbar"><div class="site-topbar-main">',
    `<a class="site-brand" href="/s/${encodeURIComponent(tenant.slug || '')}/stats"><span class="site-brand-mark">SCUM</span><span class="site-brand-copy"><span class="site-brand-title">${escapeHtml(tenant.name || 'SCUM community')}</span><span class="site-brand-detail">พอร์ทัลสาธารณะของเซิร์ฟเวอร์</span></span></a>`,
    '<nav class="site-nav">',
    `<a class="site-nav-link${currentSection === 'stats' ? ' is-active' : ''}" href="/s/${encodeURIComponent(tenant.slug || '')}/stats">สถิติ</a>`,
    `<a class="site-nav-link${currentSection === 'shop' ? ' is-active' : ''}" href="/s/${encodeURIComponent(tenant.slug || '')}/shop">ร้านค้า</a>`,
    `<a class="site-nav-link${currentSection === 'events' ? ' is-active' : ''}" href="/s/${encodeURIComponent(tenant.slug || '')}/events">กิจกรรม</a>`,
    `<a class="site-nav-link${currentSection === 'donate' ? ' is-active' : ''}" href="/s/${encodeURIComponent(tenant.slug || '')}/donate">สนับสนุน</a>`,
    '</nav></div><div class="site-topbar-tools"><a class="site-button" href="/player/login">เข้า Player Portal</a><a class="site-button site-button-primary" href="/signup">สร้างพื้นที่ของคุณ</a></div></header>',
    `<main class="public-server-main"><section class="public-server-card public-server-card-hero"><div class="public-server-stack"><span class="public-server-kicker">${escapeHtml(tenant.slug || '-')}</span><h1>${escapeHtml(sectionMeta[currentSection].title)}</h1><p>${escapeHtml(sectionMeta[currentSection].subtitle)}</p><div class="public-server-chip-row">${badge(tenant.status || 'active', tenant.status === 'active' ? 'success' : 'warning')}${badge(`${formatNumber(servers.length, '0')} servers`, 'info')}${badge(`อัปเดต ${formatDateTime(snapshot.generatedAt)}`, 'muted')}</div></div></section>${bodyHtml}</main>`,
    '</div></body></html>',
  ].join('');
}

function createPortalPageRoutes(deps) {
  const {
    allowCaptureAuth,
    captureAuthToken,
    createCaptureSession,
    buildSessionCookie,
    tryServePortalStaticAsset,
    tryServeStaticScumIcon,
    buildAdminProductUrl,
    buildLegacyAdminUrl,
    getCanonicalRedirectUrl,
    readJsonBody,
    sendJson,
    sendHtml,
    sendFavicon,
    buildHealthPayload,
    tryServePublicDoc,
    getLandingHtml,
    getDashboardHtml,
    getPricingHtml,
    getSignupHtml,
    getForgotPasswordHtml,
    getVerifyEmailHtml,
    getCheckoutHtml,
    getPaymentResultHtml,
    getPreviewHtml,
    getShowcaseHtml,
    getTrialHtml,
    getPlayerHtml,
    getLegacyPlayerHtml,
    getPlatformPublicOverview,
    getReleaseFeedEntries,
    isDiscordStartPath,
    isDiscordCallbackPath,
    isGoogleStartPath,
    isGoogleCallbackPath,
    handleDiscordStart,
    handleDiscordCallback,
    handleGoogleStart,
    handleGoogleCallback,
    getSession,
    getPreviewSession,
    getAuthLoginHtml,
    renderPlayerLoginPage,
    getPublicServerPortalSnapshot,
  } = deps;
  const servePortalStaticAsset = typeof tryServePortalStaticAsset === 'function'
    ? tryServePortalStaticAsset
    : async () => false;
  const serveLegacyPlayerHtml = typeof getLegacyPlayerHtml === 'function'
    ? getLegacyPlayerHtml
    : getPlayerHtml;
  const readBody = typeof readJsonBody === 'function'
    ? readJsonBody
    : async () => ({});

  return async function handlePortalPageRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
      method,
    } = context;

    if (await servePortalStaticAsset(req, res, pathname)) {
      return true;
    }

    if (await tryServeStaticScumIcon(req, res, pathname)) {
      return true;
    }

    if (pathname.startsWith('/admin')) {
      const target = buildLegacyAdminUrl(pathname, urlObj.search);
      if (!target) {
        sendJson(res, 503, {
          ok: false,
          error: 'Legacy admin URL is invalid',
        });
        return true;
      }
      sendRedirect(res, target);
      return true;
    }

    const canonicalRedirectUrl = getCanonicalRedirectUrl(req);
    if (canonicalRedirectUrl && (method === 'GET' || method === 'HEAD')) {
      sendRedirect(res, canonicalRedirectUrl);
      return true;
    }

    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
      sendFavicon(res);
      return true;
    }

    if (allowCaptureAuth && pathname === '/player/capture-auth' && method === 'POST') {
      const body = await readBody(req);
      const token = String(body?.token || '').trim();
      if (!token || token !== String(captureAuthToken || '').trim()) {
        sendJson(res, 403, {
          ok: false,
          error: 'Capture auth token is invalid',
        });
        return true;
      }
      const sessionId = createCaptureSession();
      res.writeHead(302, {
        Location: '/player',
        'Set-Cookie': buildSessionCookie(sessionId, req),
      });
      res.end();
      return true;
    }

    if (pathname === '/healthz' && method === 'GET') {
      sendJson(res, 200, buildHealthPayload());
      return true;
    }

    if (method === 'GET' && tryServePublicDoc(pathname, res)) {
      return true;
    }

    if (pathname === '/') {
      sendRedirect(res, '/landing');
      return true;
    }

    if (pathname === '/showcase/' && method === 'GET') {
      sendRedirect(res, '/showcase');
      return true;
    }

    if (pathname === '/landing/' && method === 'GET') {
      sendRedirect(res, '/landing');
      return true;
    }

    if (pathname === '/landing' && method === 'GET') {
      sendHtml(res, 200, getLandingHtml());
      return true;
    }

    if (pathname === '/dashboard/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/dashboard' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/pricing/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/pricing' && method === 'GET') {
      sendHtml(res, 200, getPricingHtml());
      return true;
    }

    if (pathname === '/status/' && method === 'GET') {
      sendRedirect(res, '/status');
      return true;
    }

    if (pathname === '/status' && method === 'GET') {
      const overview = typeof getPlatformPublicOverview === 'function'
        ? await getPlatformPublicOverview().catch(() => null)
        : null;
      sendHtml(res, 200, renderPublicStatusPage(overview));
      return true;
    }

    if ((pathname === '/releases/' || pathname === '/changes/' || pathname === '/releases') && method === 'GET') {
      sendRedirect(res, '/changes');
      return true;
    }

    if (pathname === '/changes' && method === 'GET') {
      const entries = typeof getReleaseFeedEntries === 'function'
        ? getReleaseFeedEntries()
        : [];
      sendHtml(res, 200, renderPublicChangeFeedPage(entries));
      return true;
    }

    if (pathname === '/signup/' && method === 'GET') {
      sendRedirect(res, '/signup');
      return true;
    }

    if (pathname === '/signup' && method === 'GET') {
      sendHtml(res, 200, getSignupHtml());
      return true;
    }

    if (pathname === '/forgot-password/' && method === 'GET') {
      sendRedirect(res, '/forgot-password');
      return true;
    }

    if (pathname === '/forgot-password' && method === 'GET') {
      sendHtml(res, 200, getForgotPasswordHtml());
      return true;
    }

    if (pathname === '/verify-email/' && method === 'GET') {
      sendRedirect(res, '/verify-email');
      return true;
    }

    if (pathname === '/verify-email' && method === 'GET') {
      sendHtml(res, 200, getVerifyEmailHtml());
      return true;
    }

    if (pathname === '/checkout/' && method === 'GET') {
      sendRedirect(res, '/checkout');
      return true;
    }

    if (pathname === '/checkout' && method === 'GET') {
      sendHtml(res, 200, getCheckoutHtml());
      return true;
    }

    if (pathname === '/payment-result/' && method === 'GET') {
      sendRedirect(res, '/payment-result');
      return true;
    }

    if (pathname === '/payment-result' && method === 'GET') {
      sendHtml(res, 200, getPaymentResultHtml());
      return true;
    }

    if (pathname === '/preview/' && method === 'GET') {
      const target = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl('/tenant/onboarding')
        : '/tenant/onboarding';
      sendRedirect(res, target);
      return true;
    }

    if (pathname === '/preview' && method === 'GET') {
      const target = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl('/tenant/onboarding')
        : '/tenant/onboarding';
      sendRedirect(res, target);
      return true;
    }

    if (pathname === '/showcase' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    const publicServerPage = matchPublicServerPage(pathname);
    if (publicServerPage && method === 'GET') {
      if (!publicServerPage.section) {
        sendRedirect(res, `/s/${encodeURIComponent(publicServerPage.slug)}/stats`);
        return true;
      }
      if (typeof getPublicServerPortalSnapshot !== 'function') {
        sendHtml(res, 503, '<!doctype html><html><body>Public server pages are unavailable.</body></html>');
        return true;
      }
      const snapshot = await getPublicServerPortalSnapshot(publicServerPage.slug);
      if (!snapshot?.tenant?.id) {
        sendHtml(res, 404, '<!doctype html><html><body>Public server not found.</body></html>');
        return true;
      }
      sendHtml(res, 200, renderPublicServerPage(snapshot, publicServerPage.section));
      return true;
    }

    if (pathname === '/trial/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/trial' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/api/platform/public/overview' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: await getPlatformPublicOverview(),
      });
      return true;
    }

    if (pathname === '/player/') {
      sendRedirect(res, '/player');
      return true;
    }

    if (pathname === '/player/legacy/' && method === 'GET') {
      sendRedirect(res, '/player/legacy');
      return true;
    }

    if (pathname === '/player/login/') {
      sendRedirect(res, '/player/login');
      return true;
    }

    if (isDiscordStartPath(pathname) && method === 'GET') {
      await handleDiscordStart(req, res);
      return true;
    }

    if (isDiscordCallbackPath(pathname) && method === 'GET') {
      await handleDiscordCallback(req, res, urlObj);
      return true;
    }

    if (isGoogleStartPath(pathname) && method === 'GET') {
      await handleGoogleStart(req, res);
      return true;
    }

    if (isGoogleCallbackPath(pathname) && method === 'GET') {
      await handleGoogleCallback(req, res, urlObj);
      return true;
    }

    if (pathname === '/login' && method === 'GET') {
      sendHtml(res, 200, getAuthLoginHtml());
      return true;
    }

    if (pathname === '/player/login' && method === 'GET') {
      const session = getSession(req);
      if (session) {
        sendRedirect(res, '/player');
        return true;
      }
      sendHtml(
        res,
        200,
        renderPlayerLoginPage(String(urlObj.searchParams.get('error') || '')),
      );
      return true;
    }

    if (
      (pathname === '/player' || pathname.startsWith('/player/'))
      && pathname !== '/player/login'
      && pathname !== '/player/legacy'
      && !pathname.startsWith('/player/api/')
      && method === 'GET'
    ) {
      const session = getSession(req);
      if (!session) {
        sendRedirect(res, '/player/login');
        return true;
      }
      sendHtml(res, 200, getPlayerHtml());
      return true;
    }

    if (pathname === '/player/legacy' && method === 'GET') {
      const session = getSession(req);
      if (!session) {
        sendRedirect(res, '/player/login');
        return true;
      }
      sendHtml(res, 200, serveLegacyPlayerHtml());
      return true;
    }

    return false;
  };
}

module.exports = {
  createPortalPageRoutes,
};
