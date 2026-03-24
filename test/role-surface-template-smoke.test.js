const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('owner console template keeps owner-only incident and commercial controls', () => {
  const html = read(path.join('src', 'admin', 'owner-console.html'));
  assert.match(html, /id="ownerIncidentQueryForm"/);
  assert.match(html, /id="ownerIncidentFeed"/);
  assert.match(html, /id="ownerMarketplaceForm"/);
  assert.match(html, /id="ownerWebhookForm"/);
  assert.match(html, /id="ownerAutomationDryRunBtn"/);
  assert.match(html, /id="ownerAutomationRunBtn"/);
  assert.match(html, /id="ownerAutomationFeed"/);
  assert.match(html, /id="ownerDeliveryLifecycleStats"/);
  assert.match(html, /id="ownerDeliveryLifecycleSignals"/);
  assert.match(html, /id="ownerDeliveryLifecycleErrors"/);
  assert.match(html, /id="ownerDeliveryLifecycleActions"/);
  assert.match(html, /id="ownerRotationStats"/);
  assert.match(html, /id="ownerRotationMatrix"/);
  assert.match(html, /id="ownerRotationIssues"/);
  assert.match(html, /id="ownerSupportCaseForm"/);
  assert.match(html, /id="ownerSupportTenantSelect"/);
  assert.match(html, /id="ownerSupportCaseStats"/);
  assert.match(html, /id="ownerSupportCaseChecklist"/);
  assert.match(html, /id="ownerSupportCaseSignals"/);
  assert.match(html, /id="ownerSupportCaseActions"/);
  assert.match(html, /id="ownerSupportToolkit"/);
  assert.match(html, /id="ownerQuickActions"/);
  assert.match(html, /id="ownerOpsLogLanguageForm"/);
  assert.match(html, /id="ownerLanguageSelect"/);
  assert.match(html, /admin-i18n\.js/);
  assert.match(html, /operational-state-model\.js/);
  assert.doesNotMatch(html, /Legacy Shortcuts/);
  assert.doesNotMatch(html, /id="events"/);
  assert.doesNotMatch(html, /id="governance"/);
});

test('tenant console template keeps scoped incident and operations controls', () => {
  const html = read(path.join('src', 'admin', 'tenant-console.html'));
  assert.match(html, /id="tenantIncidentQueryForm"/);
  assert.match(html, /id="tenantIncidentFeed"/);
  assert.match(html, /id="tenantIncidentExportJsonBtn"/);
  assert.match(html, /id="tenantPlanStats"/);
  assert.match(html, /id="tenantDeliveryLifecycleStats"/);
  assert.match(html, /id="tenantDeliveryLifecycleSignals"/);
  assert.match(html, /id="tenantDeliveryLifecycleErrors"/);
  assert.match(html, /id="tenantDeliveryLifecycleActions"/);
  assert.match(html, /id="tenantDeliveryCaseForm"/);
  assert.match(html, /id="tenantDeliveryCaseStats"/);
  assert.match(html, /id="tenantDeliveryCaseTimeline"/);
  assert.match(html, /id="tenantDeliveryCaseActions"/);
  assert.match(html, /id="tenantDeliveryBulkForm"/);
  assert.match(html, /id="tenantQuickActions"/);
  assert.match(html, /id="tenantPresetGuides"/);
  assert.match(html, /id="tenantModuleGuides"/);
  assert.match(html, /id="tenantSupportToolkit"/);
  assert.match(html, /id="tenantRestartPresetChecklist"/);
  assert.match(html, /id="tenantRestartPresetBtn"/);
  assert.match(html, /id="tenantLanguageSelect"/);
  assert.match(html, /admin-i18n\.js/);
  assert.match(html, /operational-state-model\.js/);
  assert.doesNotMatch(html, /Workbench Shortcuts/);
  assert.doesNotMatch(html, /id="tenantMarketplaceForm"/);
  assert.doesNotMatch(html, /id="tenantMarketplaceTable"/);
});

test('player portal template keeps trust signals, notification center, and order drawer', () => {
  const html = read(path.join('apps', 'web-portal-standalone', 'public', 'player-core.html'));
  assert.match(html, /id="portalMetaTags"/);
  assert.match(html, /id="homeNotificationStats"/);
  assert.match(html, /id="homeFirstRunGuide"/);
  assert.match(html, /id="homeLatestOrderBtn"/);
  assert.match(html, /id="ordersTrustFeed"/);
  assert.match(html, /id="orderDetailBackdrop"/);
  assert.match(html, /id="orderDetailTimeline"/);
  assert.match(html, /id="orderDetailNextStep"/);
  assert.match(html, /id="playerLanguageSelect"/);
  assert.match(html, /portal-i18n\.js/);
});

test('public entry pages include language selector and portal i18n runtime', () => {
  const landing = read(path.join('apps', 'web-portal-standalone', 'public', 'landing.html'));
  const showcase = read(path.join('apps', 'web-portal-standalone', 'public', 'showcase.html'));
  const trial = read(path.join('apps', 'web-portal-standalone', 'public', 'trial.html'));
  assert.match(landing, /id="publicLanguageSelect"/);
  assert.match(landing, /portal-i18n\.js/);
  assert.match(showcase, /id="showcaseLanguageSelect"/);
  assert.match(showcase, /portal-i18n\.js/);
  assert.match(trial, /id="trialLanguageSelect"/);
  assert.match(trial, /portal-i18n\.js/);
});

test('login entry pages keep language selectors and surface-specific i18n runtimes', () => {
  const adminLogin = read(path.join('src', 'admin', 'login.html'));
  const playerLogin = read(path.join('apps', 'web-portal-standalone', 'public', 'login.html'));
  assert.match(adminLogin, /id="adminLanguageSelect"/);
  assert.match(adminLogin, /admin-i18n\.js/);
  assert.match(playerLogin, /id="playerLoginLanguageSelect"/);
  assert.match(playerLogin, /portal-i18n\.js/);
});

test('admin i18n runtime keeps multilingual labels and owner/admin translations intact', () => {
  const i18n = read(path.join('src', 'admin', 'assets', 'admin-i18n.js'));
  assert.match(i18n, /SUPPORTED_LANGUAGES/);
  assert.match(i18n, /'common\.roleOwner': 'Owner'/);
  assert.match(i18n, /'common\.roleAdmin': 'Admin'/);
  assert.match(i18n, /'common\.rolePlayer': 'Player'/);
  assert.match(i18n, /'owner\.surfaceId': 'Platform Owner Console'/);
  assert.match(i18n, /'tenant\.surfaceId': 'Server Admin Console'/);
  assert.match(i18n, /'login\.tenantRoutePill': 'Admin Console'/);
});
