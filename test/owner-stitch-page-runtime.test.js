const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createAdminPageRuntime,
} = require('C:\\new\\src\\admin\\runtime\\adminPageRuntime.js');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createRuntime() {
  const noopHeaders = (headers = {}) => headers;
  const noopSendText = () => {};

  return createAdminPageRuntime({
    dashboardHtmlPath: path.resolve('C:\\new\\src\\admin\\login.html'),
    ownerConsoleHtmlPath: path.resolve('C:\\new\\src\\admin\\owner-console.html'),
    tenantConsoleHtmlPath: path.resolve('C:\\new\\src\\admin\\tenant-console.html'),
    loginHtmlPath: path.resolve('C:\\new\\src\\admin\\login.html'),
    ownerLoginHtmlPath: path.resolve('C:\\new\\src\\admin\\owner-login.html'),
    tenantLoginHtmlPath: path.resolve('C:\\new\\src\\admin\\tenant-login.html'),
    assetsDirPath: path.resolve('C:\\new\\src\\admin\\assets'),
    scumItemsDirPath: path.resolve('C:\\new\\img\\scum_items'),
    buildSecurityHeaders: noopHeaders,
    sendText: noopSendText,
  });
}

test('owner stitch runtime serves the platform overview file for /owner', () => {
  const runtime = createRuntime();
  const html = runtime.getOwnerSurfaceHtml('/owner');

  assert.match(html, /SCUM Owner Plane - Platform Overview/);
  assert.match(html, /owner-stitch-bridge\.js/);
  assert.match(html, /ownerLegacyOverlay/);
  assert.match(html, /ownerV4AppRoot/);
  assert.match(html, /__OWNER_STITCH_TITLE__/);
  assert.match(html, /owner-stitch-polish\.css/);
  assert.match(html, /id="ownerShellBoot"/);
  assert.match(html, /owner-live-timeout/);
  assert.match(html, /Loading live control surface/);
  assert.doesNotMatch(html, /body\.owner-live-timeout main\[data-owner-stitched="true"\]/);
  assert.doesNotMatch(html, /googleusercontent\.com/);
  assert.match(html, /<main data-owner-stitched="true" data-owner-chrome="workspace" data-owner-route="\/owner">/);
  assert.match(html, /id="ownerStitchSurface"/);
  assert.match(html, /id="ownerStitchLiveData"/);
  assert.match(html, /Customer &amp; Revenue/);
  assert.doesNotMatch(html, /Overview class menu/);
  assert.doesNotMatch(html, /id="owner-overview-class-commercial"/);
});

test('owner stitch runtime maps billing detail and recovery detail routes to dedicated stitch pages', () => {
  const runtime = createRuntime();
  const invoiceHtml = runtime.getOwnerSurfaceHtml('/owner/billing/invoice');
  const recoveryHtml = runtime.getOwnerSurfaceHtml('/owner/recovery/tenant-backup');

  assert.match(invoiceHtml, /SCUM Owner Plane - Invoice Detail/);
  assert.match(recoveryHtml, /SCUM Owner Plane - Tenant Backup Detail/);
  assert.match(invoiceHtml, /owner-stitch-bridge\.js/);
  assert.match(recoveryHtml, /owner-stitch-bridge\.js/);
  assert.doesNotMatch(invoiceHtml, /Owner classes/);
  assert.doesNotMatch(recoveryHtml, /Owner classes/);
  assert.doesNotMatch(invoiceHtml, /googleusercontent\.com/);
  assert.doesNotMatch(recoveryHtml, /googleusercontent\.com/);
});

test('owner stitch runtime maps owner-only gap routes to stitched placeholders', () => {
  const runtime = createRuntime();

  const createTenantHtml = runtime.getOwnerSurfaceHtml('/owner/tenants/new');
  const tenantContextHtml = runtime.getOwnerSurfaceHtml('/owner/tenants/acme');
  const supportContextHtml = runtime.getOwnerSurfaceHtml('/owner/support/case-123');
  const accessHtml = runtime.getOwnerSurfaceHtml('/owner/access');
  const diagnosticsHtml = runtime.getOwnerSurfaceHtml('/owner/diagnostics');
  const controlHtml = runtime.getOwnerSurfaceHtml('/owner/control');
  const automationHtml = runtime.getOwnerSurfaceHtml('/owner/automation');

  assert.match(createTenantHtml, /SCUM Owner Plane - Create Tenant/);
  assert.match(tenantContextHtml, /SCUM Owner Plane - Tenant Dossier/);
  assert.match(supportContextHtml, /SCUM Owner Plane - Support Context/);
  assert.match(accessHtml, /SCUM Owner Plane - Access Posture/);
  assert.match(diagnosticsHtml, /SCUM Owner Plane - Diagnostics and Evidence/);
  assert.match(controlHtml, /SCUM Owner Plane - Platform Controls/);
  assert.match(automationHtml, /SCUM Owner Plane - Automation and Notifications/);
});

test('owner stitch runtime serves every Owner sidebar child route through the stitched shell', () => {
  const runtime = createRuntime();
  const routes = [
    ['/owner/packages/create', 'SCUM Owner Plane - Create Package', 'commerce'],
    ['/owner/packages/entitlements', 'SCUM Owner Plane - Package Entitlements', 'commerce'],
    ['/owner/subscriptions/registry', 'SCUM Owner Plane - Subscription Registry', 'commerce'],
    ['/owner/billing/recovery', 'SCUM Owner Plane - Billing Recovery', 'commerce'],
    ['/owner/billing/attempts', 'SCUM Owner Plane - Payment Attempts', 'commerce'],
    ['/owner/analytics/risk', 'SCUM Owner Plane - Risk Queue', 'analytics'],
    ['/owner/analytics/packages', 'SCUM Owner Plane - Package Usage', 'analytics'],
    ['/owner/settings/admin-users', 'SCUM Owner Plane - Admin Users', 'governance'],
    ['/owner/settings/services', 'SCUM Owner Plane - Managed Services', 'governance'],
    ['/owner/settings/access-policy', 'SCUM Owner Plane - Access Policy', 'governance'],
    ['/owner/settings/portal-policy', 'SCUM Owner Plane - Portal Policy', 'governance'],
    ['/owner/settings/billing-policy', 'SCUM Owner Plane - Billing Policy', 'governance'],
    ['/owner/settings/runtime-policy', 'SCUM Owner Plane - Runtime Policy', 'governance'],
    ['/owner/recovery/create', 'SCUM Owner Plane - Create Backup', 'recovery'],
    ['/owner/recovery/preview', 'SCUM Owner Plane - Restore Preview', 'recovery'],
    ['/owner/recovery/restore', 'SCUM Owner Plane - Restore Apply', 'recovery'],
    ['/owner/recovery/history', 'SCUM Owner Plane - Recovery History', 'recovery'],
  ];

  routes.forEach(([pathname, title, visual]) => {
    const html = runtime.getOwnerSurfaceHtml(pathname);

    assert.match(html, new RegExp(escapeRegex(title)), pathname);
    assert.match(html, new RegExp(`data-owner-route-visual="${escapeRegex(visual)}"`), pathname);
    assert.match(html, /owner-stitch-bridge\.js/, pathname);
    assert.match(html, new RegExp(`data-owner-route="${escapeRegex(pathname)}"`), pathname);
    assert.match(html, /owner-live-route-shell/, pathname);
    assert.match(html, /data-owner-ui="action"/, pathname);
    assert.doesNotMatch(html, /surface-body surface-owner/, pathname);
  });
});

test('owner stitch runtime keeps one primary action per owner workspace header', () => {
  const runtime = createRuntime();
  const routes = ['/owner/subscriptions', '/owner/analytics', '/owner/recovery'];

  routes.forEach((pathname) => {
    const html = runtime.getOwnerSurfaceHtml(pathname);
    const primaryActions = html.match(/data-owner-tone="primary"/g) || [];

    assert.equal(primaryActions.length, 1, pathname);
  });
});

test('owner stitch runtime maps runtime subtopic routes to the stitched fleet overview shell', () => {
  const runtime = createRuntime();
  const createServerHtml = runtime.getOwnerSurfaceHtml('/owner/runtime/create-server');
  const provisionHtml = runtime.getOwnerSurfaceHtml('/owner/runtime/provision-runtime');
  const runtimeOverviewHtml = runtime.getOwnerSurfaceHtml('/owner/runtime/overview');

  assert.match(createServerHtml, /SCUM Owner Plane - Create Server Record/);
  assert.match(provisionHtml, /SCUM Owner Plane - Provision Runtime/);
  assert.match(runtimeOverviewHtml, /SCUM Owner Plane - Runtime Overview/);
  assert.match(createServerHtml, /owner-stitch-bridge\.js/);
  assert.match(provisionHtml, /owner-stitch-bridge\.js/);
  assert.match(createServerHtml, /data-owner-route="\/owner\/runtime\/create-server"/);
  assert.match(provisionHtml, /data-owner-route="\/owner\/runtime\/provision-runtime"/);
  assert.match(runtimeOverviewHtml, /data-owner-route="\/owner\/runtime\/overview"/);
});

test('owner stitch runtime maps focused overview aliases to the same owner shell', () => {
  const runtime = createRuntime();

  const dashboardHtml = runtime.getOwnerSurfaceHtml('/owner/dashboard');
  const analyticsHtml = runtime.getOwnerSurfaceHtml('/owner/analytics/overview');
  const securityHtml = runtime.getOwnerSurfaceHtml('/owner/security/overview');
  const settingsHtml = runtime.getOwnerSurfaceHtml('/owner/settings/overview');
  const recoveryHtml = runtime.getOwnerSurfaceHtml('/owner/recovery/overview');

  assert.match(dashboardHtml, /SCUM Owner Plane - Platform Overview/);
  assert.match(analyticsHtml, /SCUM Owner Plane - Analytics Overview/);
  assert.match(securityHtml, /SCUM Owner Plane - Security Overview/);
  assert.match(settingsHtml, /SCUM Owner Plane - Settings Overview/);
  assert.match(recoveryHtml, /SCUM Owner Plane - Recovery Overview/);
});

test('owner stitch runtime removes the shared class menu from every owner route family', () => {
  const runtime = createRuntime();
  const routes = [
    '/owner',
    '/owner/tenants',
    '/owner/tenants/new',
    '/owner/tenants/acme',
    '/owner/packages',
    '/owner/subscriptions',
    '/owner/billing',
    '/owner/support',
    '/owner/support/case-123',
    '/owner/runtime',
    '/owner/runtime/create-server',
    '/owner/runtime/provision-runtime',
    '/owner/runtime/agents-bots',
    '/owner/incidents',
    '/owner/jobs',
    '/owner/analytics',
    '/owner/automation',
    '/owner/audit',
    '/owner/security',
    '/owner/access',
    '/owner/diagnostics',
    '/owner/settings',
    '/owner/control',
    '/owner/recovery',
    '/owner/recovery/tenant-backup',
  ];

  routes.forEach((pathname) => {
    const html = runtime.getOwnerSurfaceHtml(pathname);

    assert.doesNotMatch(html, /Owner classes/, pathname);
    assert.doesNotMatch(html, /owner-live-class-link/, pathname);
    assert.doesNotMatch(html, /data-owner-route-class=/, pathname);
    assert.match(html, /owner-live-route-shell/, pathname);
  });
});
