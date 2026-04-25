const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function readOwnerBridgeSource() {
  return fs.readFileSync('C:\\new\\src\\admin\\assets\\owner-stitch-bridge.js', 'utf8');
}

function readOwnerStitchPolishSource() {
  return fs.readFileSync('C:\\new\\src\\admin\\assets\\owner-stitch-polish.css', 'utf8');
}

test('owner stitch bridge leaves owner control mutations to the owner app runtime', () => {
  const source = readOwnerBridgeSource();

  assert.match(source, /function isOwnerMutationSurface\(element\)/);
  assert.match(source, /element\.closest\('#owner-control-workspace'\)/);
  assert.match(source, /element\.closest\('\[data-owner-action\]'\)/);
  assert.match(source, /element\.closest\('form\[data-owner-form\]'\)/);
  assert.match(source, /element\.closest\('a\[download\]'\)/);
  assert.match(source, /function shouldSkipBridge\(element\) \{[\s\S]*isOwnerMutationSurface\(element\)/);
});

test('owner stitch bridge reuses in-place owner navigation when the stitched host is active', () => {
  const source = readOwnerBridgeSource();

  assert.match(source, /function navigateOwnerSurface\(target\)/);
  assert.match(source, /typeof window\.__navigateOwnerStitchRoute === 'function'/);
  assert.match(source, /window\.__navigateOwnerStitchRoute\(nextTarget\)/);
  assert.match(source, /function bindRouteNavigation\(element, route\) \{[\s\S]*navigateOwnerSurface\(target\)/);
});

test('owner stitch bridge exposes focused submenu routes in the main sidebar', () => {
  const source = readOwnerBridgeSource();

  assert.match(source, /'\/owner\/analytics\/overview': 'Analytics Overview'/);
  assert.match(source, /'\/owner\/runtime\/overview': 'Runtime Overview'/);
  assert.match(source, /'\/owner\/security\/overview': 'Security Overview'/);
  assert.match(source, /'\/owner\/settings\/overview': 'Settings Overview'/);
  assert.match(source, /'\/owner\/recovery\/overview': 'Recovery Overview'/);
  assert.match(source, /matchHrefs: \['\/owner\/runtime'\]/);
  assert.match(source, /matchHrefs: \['\/owner\/analytics', '\/owner\/observability'\]/);
  assert.match(source, /matchHrefs: \['\/owner\/settings'\]/);
  assert.match(source, /const parentLink = item\?\.\querySelector\('\[data-owner-slot="sidebar-link"\]\[data-owner-nav-has-children="true"\]'\);/);
  assert.match(source, /const active = elementHasActiveRoute\(parentLink\) \|\| matchesCurrentPath\(parentRoute\);/);
  assert.match(source, /href: '\/owner\/packages\/create'/);
  assert.match(source, /href: '\/owner\/packages\/entitlements'/);
  assert.match(source, /href: '\/owner\/subscriptions\/registry'/);
  assert.match(source, /href: '\/owner\/billing\/recovery'/);
  assert.match(source, /href: '\/owner\/billing\/attempts'/);
  assert.match(source, /href: '\/owner\/runtime\/create-server'/);
  assert.match(source, /href: '\/owner\/runtime\/provision-runtime'/);
  assert.match(source, /href: '\/owner\/runtime\/agents-bots'/);
  assert.match(source, /href: '\/owner\/runtime\/fleet-diagnostics'/);
  assert.match(source, /href: '\/owner\/jobs'/);
  assert.match(source, /href: '\/owner\/analytics\/risk'/);
  assert.match(source, /href: '\/owner\/analytics\/packages'/);
  assert.match(source, /href: '\/owner\/access'/);
  assert.match(source, /href: '\/owner\/diagnostics'/);
  assert.match(source, /href: '\/owner\/control'/);
  assert.match(source, /href: '\/owner\/settings\/access-policy'/);
  assert.match(source, /href: '\/owner\/settings\/portal-policy'/);
  assert.match(source, /href: '\/owner\/settings\/billing-policy'/);
  assert.match(source, /href: '\/owner\/settings\/runtime-policy'/);
  assert.match(source, /href: '\/owner\/settings\/admin-users'/);
  assert.match(source, /href: '\/owner\/settings\/services'/);
  const settingsChildren = source.match(/settings: \{[\s\S]*?children: \[([\s\S]*?)\]\s*,\s*\},/)?.[1] || '';
  assert.doesNotMatch(settingsChildren, /href: '\/owner\/automation'/);
  assert.match(source, /href: '\/owner\/recovery\/create'/);
  assert.match(source, /href: '\/owner\/recovery\/preview'/);
  assert.match(source, /href: '\/owner\/recovery\/restore'/);
  assert.match(source, /href: '\/owner\/recovery\/history'/);
  assert.match(source, /href: '\/owner\/runtime\/overview', label: 'Overview'/);
  assert.match(source, /href: '\/owner\/analytics\/overview', label: 'Overview'/);
  assert.match(source, /href: '\/owner\/security\/overview',[\s\S]*label: 'Overview'/);
  assert.match(source, /href: '\/owner\/settings\/overview', label: 'Overview'/);
  assert.match(source, /href: '\/owner\/recovery\/overview', label: 'Overview'/);
  assert.match(source, /data-owner-slot=\"sidebar-submenu-toggle\"/);
  assert.match(source, /data-owner-nav-has-children=\"true\"/);
  assert.match(source, /data-owner-slot=\"sidebar-submenu\"/);
  assert.match(source, /data-owner-has-children=\"true\"/);
  assert.match(source, /data-owner-submenu-open=\"\$\{submenuVisible \? 'true' : 'false'\}\"/);
  assert.match(source, /function wireSidebarSubmenuToggles\(sidebar\)/);
  assert.match(source, /root\.dataset\.ownerManualSubmenu = willExpand \? parentRoute : '__collapsed__';/);
  assert.match(source, /item\.dataset\.ownerSubmenuOpen = next;/);
  assert.match(source, /item\.dataset\.ownerHasChildren = 'true';/);
  assert.match(source, /Array\.from\(root\.querySelectorAll\('\[data-owner-slot=\"sidebar-group\"\]\[data-owner-expandable=\"true\"\]'\)\)\.forEach\(\(node\) => \{\s*setSidebarGroupExpanded\(node, node === group\);/);
  assert.match(source, /options\.level === 'child'/);
  assert.match(source, /data-owner-nav-level=\"\$\{level\}\"/);
});

test('owner stitch bridge leaves sidebar group toggles to the dedicated group handler', () => {
  const source = readOwnerBridgeSource();

  assert.match(source, /const TOPBAR_SHELL_VERSION = '20260418-owner-topbar-1';/);
  assert.match(source, /const SIDEBAR_SHELL_VERSION = '20260418-owner-sidebar-1';/);
  assert.match(source, /function sidebarNeedsRemount\(sidebar, activeRoute\)/);
  assert.match(source, /sidebar\.dataset\.ownerShellVersion !== SIDEBAR_SHELL_VERSION/);
  assert.match(source, /!sidebar\.querySelector\('\[data-owner-slot="sidebar-item-row"\]'\)/);
  assert.match(source, /!sidebar\.querySelector\('\[data-owner-slot="sidebar-link"\] \.owner-shell-icon'\)/);
  assert.match(source, /sidebar\.querySelector\('\[data-owner-slot="sidebar-page-sections"\]'\)/);
  assert.match(source, /const hasInvalidTopLevelChildLink = Array\.from\(sidebar\.querySelectorAll\('\[data-owner-slot="sidebar-nav-group"\]'\)\)/);
  assert.match(source, /String\(child\.dataset\.ownerNavLevel \|\| ''\)\.trim\(\) === 'child'/);
  assert.match(source, /data-owner-slot=\"sidebar-group-toggle\"/);
  assert.match(source, /function wireButton\(button\) \{[\s\S]*button\.matches\?\.\('\[data-owner-slot=\"sidebar-group-toggle\"\], \[data-owner-slot=\"sidebar-submenu-toggle\"\]'\)[\s\S]*return;/);
  assert.match(source, /function wireSidebarGroupToggles\(sidebar\)/);
  assert.match(source, /root\.dataset\.ownerManualGroup = willExpand \? String\(section\.dataset\.ownerGroup \|\| ''\)\.trim\(\) : '__collapsed__';/);
  assert.match(source, /const manualGroup = String\(root\.dataset\.ownerManualGroup \|\| ''\)\.trim\(\);/);
  assert.match(source, /anchor\.dataset\.ownerNavHasChildren === 'true' && rawHref\.startsWith\('\/owner'\)/);
  assert.match(source, /root\.querySelectorAll\('\[data-owner-slot="sidebar-page-sections"\]'\)\.forEach\(\(node\) => node\.remove\(\)\);/);
});

test('owner stitch polish keeps submenu toggles visible before a submenu is open', () => {
  const source = readOwnerStitchPolishSource();

  assert.doesNotMatch(
    source,
    /\[data-owner-slot="sidebar-item"\]\s+\[data-owner-slot="sidebar-submenu-toggle"\]\s*\{[\s\S]*?display:\s*none\s*!important;/,
  );
  assert.match(
    source,
    /\[data-owner-slot="sidebar-item"\]\[data-owner-has-children="true"\]\s+\[data-owner-slot="sidebar-submenu-toggle"\]\s*\{[\s\S]*?display:\s*inline-flex\s*!important;/,
  );
});
