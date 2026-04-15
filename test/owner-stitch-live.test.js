const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function readOwnerStitchLiveSource() {
  return fs.readFileSync('C:\\new\\src\\admin\\assets\\owner-stitch-live.js', 'utf8');
}

test('owner stitch live routes recovery into the control workspace shell', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /'recovery',/);
  assert.match(source, /if \(routeKey === 'recovery' \|\| routeKey === 'recovery-create' \|\| routeKey === 'recovery-preview' \|\| routeKey === 'recovery-restore' \|\| routeKey === 'recovery-history'\) return routeKey;/);
  assert.match(source, /recovery:\s*\{ label: 'Open recovery workspace', href: '#owner-recovery-workspace', tone: 'primary', localFocus: true \}/);
  assert.match(source, /function usesRecoveryWorkspace\(routeKey\)\s*{\s*return routeKey === 'backup-detail';\s*}/);
});

test('owner stitch live keeps backup detail on the runtime recovery workbench', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /function renderRecoveryWorkspace\(currentSnapshot, meta\)/);
  assert.match(source, /OwnerRuntimeHealthV4\.createOwnerRuntimeHealthV4Model/);
  assert.match(source, /OwnerRuntimeHealthV4\.buildOwnerRuntimeHealthV4Html/);
  assert.match(source, /currentRoute:\s*'recovery'/);
});

test('owner stitch live routes detail and operational pages into interactive workspaces', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /if \(routeKey === 'packages'\) return 'packages';/);
  assert.match(source, /if \(routeKey === 'packages-entitlements'\) return 'packages-entitlements';/);
  assert.match(source, /if \(routeKey === 'subscriptions'\) return 'subscriptions';/);
  assert.match(source, /if \(routeKey === 'subscriptions-registry'\) return 'subscriptions-registry';/);
  assert.match(source, /if \(routeKey === 'billing'\) return 'billing';/);
  assert.match(source, /if \(routeKey === 'billing-recovery'\) return 'billing-recovery';/);
  assert.match(source, /if \(routeKey === 'billing-attempts'\) return 'billing-attempts';/);
  assert.match(source, /if \(path === '\/owner\/runtime\/create-server'\) return 'runtime-create-server';/);
  assert.match(source, /if \(path === '\/owner\/runtime\/provision-runtime'\) return 'runtime-provision-runtime';/);
  assert.match(source, /if \(path === '\/owner\/runtime' \|\| path === '\/owner\/runtime\/overview'\) return 'runtime';/);
  assert.match(source, /if \(path === '\/owner\/packages\/create'\) return 'packages-create';/);
  assert.match(source, /if \(path === '\/owner\/packages\/entitlements'\) return 'packages-entitlements';/);
  assert.match(source, /if \(path === '\/owner\/subscriptions\/registry'\) return 'subscriptions-registry';/);
  assert.match(source, /if \(path === '\/owner\/billing\/recovery'\) return 'billing-recovery';/);
  assert.match(source, /if \(path === '\/owner\/billing\/attempts'\) return 'billing-attempts';/);
  assert.match(source, /if \(path === '\/owner\/analytics' \|\| path === '\/owner\/analytics\/overview' \|\| path === '\/owner\/observability'\) return 'analytics';/);
  assert.match(source, /if \(path === '\/owner\/analytics\/risk'\) return 'analytics-risk';/);
  assert.match(source, /if \(path === '\/owner\/analytics\/packages'\) return 'analytics-packages';/);
  assert.match(source, /if \(path === '\/owner\/security' \|\| path === '\/owner\/security\/overview'\) return 'security';/);
  assert.match(source, /if \(path === '\/owner\/settings' \|\| path === '\/owner\/settings\/overview'\) return 'settings';/);
  assert.match(source, /if \(path === '\/owner\/recovery' \|\| path === '\/owner\/recovery\/overview'\) return 'recovery';/);
  assert.match(source, /if \(path === '\/owner\/settings\/access-policy'\) return 'settings-access-policy';/);
  assert.match(source, /if \(path === '\/owner\/settings\/portal-policy'\) return 'settings-portal-policy';/);
  assert.match(source, /if \(path === '\/owner\/settings\/billing-policy'\) return 'settings-billing-policy';/);
  assert.match(source, /if \(path === '\/owner\/settings\/runtime-policy'\) return 'settings-runtime-policy';/);
  assert.match(source, /if \(path === '\/owner\/settings\/admin-users'\) return 'settings-admin-users';/);
  assert.match(source, /if \(path === '\/owner\/settings\/services'\) return 'settings-services';/);
  assert.match(source, /if \(path === '\/owner\/recovery\/history'\) return 'recovery-history';/);
  assert.match(source, /if \(routeKey === 'agents-bots' \|\| routeKey === 'fleet-diagnostics'\) return routeKey;/);
  assert.match(source, /if \(routeKey === 'automation'\) return 'automation';/);
  assert.match(source, /'packages-create': \{ title: 'Create package'/);
  assert.match(source, /'packages-entitlements': \{ title: 'Package entitlements'/);
  assert.match(source, /'subscriptions-registry': \{ title: 'Subscription registry'/);
  assert.match(source, /'billing-recovery': \{ title: 'Billing recovery'/);
  assert.match(source, /'billing-attempts': \{ title: 'Payment attempts'/);
  assert.match(source, /runtime: \{ title: 'Runtime overview'/);
  assert.match(source, /'agents-bots': \{ title: 'Runtime registry'/);
  assert.match(source, /'fleet-diagnostics': \{ title: 'Runtime diagnostics'/);
  assert.match(source, /analytics: \{ title: 'Analytics overview'/);
  assert.match(source, /'analytics-risk': \{ title: 'Risk queue'/);
  assert.match(source, /'analytics-packages': \{ title: 'Package usage'/);
  assert.match(source, /security: \{ title: 'Security overview'/);
  assert.match(source, /settings: \{ title: 'Settings overview'/);
  assert.match(source, /recovery: \{ title: 'Recovery overview'/);
  assert.match(source, /'settings-access-policy': \{ title: 'Access policy'/);
  assert.match(source, /'settings-portal-policy': \{ title: 'Portal policy'/);
  assert.match(source, /'settings-billing-policy': \{ title: 'Billing policy'/);
  assert.match(source, /'settings-runtime-policy': \{ title: 'Runtime policy'/);
  assert.match(source, /'settings-admin-users': \{ title: 'Admin users'/);
  assert.match(source, /'settings-services': \{ title: 'Managed services'/);
  assert.match(source, /'recovery-history': \{ title: 'Recovery history'/);
  assert.match(source, /'runtime-create-server': \{ title: 'Create server record'/);
  assert.match(source, /'runtime-provision-runtime': \{ title: 'Provision runtime'/);
  assert.match(source, /href:\s*'#owner-runtime-route-summary'/);
  assert.match(source, /href:\s*'#owner-packages-create-form'/);
  assert.match(source, /href:\s*'#owner-packages-entitlements-workspace'/);
  assert.match(source, /href:\s*'#owner-subscriptions-registry-workspace'/);
  assert.match(source, /href:\s*'#owner-billing-recovery-queue'/);
  assert.match(source, /href:\s*'#owner-runtime-server-workspace'/);
  assert.match(source, /href:\s*'#owner-runtime-provisioning-workspace'/);
  assert.match(source, /href:\s*'#owner-runtime-shared-ops'/);
  assert.match(source, /href:\s*'#owner-billing-invoices-workspace'/);
  assert.match(source, /href:\s*'#owner-billing-attempts-workspace'/);
  assert.match(source, /href:\s*'#owner-analytics-workspace'/);
  assert.match(source, /href:\s*'#owner-risk-queue'/);
  assert.match(source, /href:\s*'#owner-analytics-packages-workspace'/);
  assert.match(source, /href:\s*'#owner-settings-access-policy'/);
  assert.match(source, /href:\s*'#owner-settings-portal-policy'/);
  assert.match(source, /href:\s*'#owner-settings-billing-policy'/);
  assert.match(source, /href:\s*'#owner-settings-runtime-policy'/);
  assert.match(source, /href:\s*'#owner-settings-admin-users'/);
  assert.match(source, /href:\s*'#owner-settings-managed-services'/);
  assert.match(source, /href:\s*'#owner-recovery-history-workspace'/);
  assert.match(source, /href:\s*'#owner-settings-automation-workspace'/);
});

test('owner stitch live keeps detail routes on custom renderers instead of folding them back into shared workspaces', () => {
  const source = readOwnerStitchLiveSource();
  const controlRouteKeysBlock = source.match(/const CONTROL_ROUTE_KEYS = new Set\(\[[\s\S]*?\]\);/);

  assert.ok(controlRouteKeysBlock, 'CONTROL_ROUTE_KEYS block should exist');
  assert.doesNotMatch(controlRouteKeysBlock[0], /'package-detail'/);
  assert.doesNotMatch(controlRouteKeysBlock[0], /'subscription-detail'/);
  assert.doesNotMatch(controlRouteKeysBlock[0], /'invoice-detail'/);
  assert.doesNotMatch(controlRouteKeysBlock[0], /'attempt-detail'/);
  assert.match(source, /} else if \(routeKey === 'package-detail'\) \{/);
  assert.match(source, /} else if \(routeKey === 'subscription-detail'\) \{/);
  assert.match(source, /} else if \(routeKey === 'invoice-detail'\) \{/);
  assert.match(source, /} else if \(routeKey === 'attempt-detail'\) \{/);
});

test('owner stitch live rerenders over server snapshots and marks the shell ready', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /updatedAt:\s*Number\(currentSnapshot\.updatedAt\)\s*\|\|\s*0/);
  assert.match(source, /if \(usesRecoveryWorkspace\(routeKey\)\)/);
  assert.match(source, /publishExistingServerRender\(root\);/);
  assert.match(source, /document\.body\.classList\.add\('owner-live-ready'\)/);
  assert.match(source, /document\.body\.classList\.remove\('owner-live-timeout'\)/);
  assert.match(source, /function scheduleRenderWhenNeeded\(\)\s*{\s*lastSignature = '';\s*scheduleRender\(\);\s*}/);
});

test('owner stitch live route headers expose focus guidance and highlight chips', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /focus:\s*'Scan commercial risk, tenant posture, and runtime health before drilling into a focused workspace\.'/);
  assert.match(source, /highlights:\s*\['Priority queue', 'Revenue posture', 'Runtime watch'\]/);
  assert.match(source, /class="owner-live-route-focus"/);
  assert.match(source, /class="owner-live-route-highlight"/);
});

test('owner stitch live keeps the route shell but removes the shared owner class menu', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /function wrapOwnerRouteShell\(routeKey, bodyHtml\)/);
  assert.match(source, /class="owner-live-route-shell"/);
  assert.match(source, /data-owner-route-key/);
  assert.doesNotMatch(source, /const OWNER_CLASS_GROUPS = \[/);
  assert.doesNotMatch(source, /owner-live-class-link/);
});

test('owner stitch live resets section filtering without reinserting body topic switchers', () => {
  const source = readOwnerStitchLiveSource();

  assert.match(source, /const sectionFilterState = new Map\(\)/);
  assert.match(source, /function mountSectionSwitcher\(container, routeKey\)/);
  assert.match(source, /Array\.from\(scope\.querySelectorAll\('\[data-owner-filter-ui="switcher"\]'\)\)\.forEach\(\(node\) => node\.remove\(\)\);/);
  assert.match(source, /applySectionFilter\(routeKey, scope, sections, 'all'\);/);
  assert.match(source, /scope\.classList\.toggle\('owner-live-focus-mode', normalizedTarget !== 'all'\)/);
  assert.match(source, /section\.node\.hidden = !visible/);
  assert.match(source, /function renderSectionSwitcherMarkup\(sections\)/);
  assert.doesNotMatch(source, /insertAdjacentHTML\('afterbegin', renderSectionSwitcherMarkup\(sections\)\)/);
});
