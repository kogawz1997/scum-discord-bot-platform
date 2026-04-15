'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { renderOwnerStitchServerSurface } = require('./ownerStitchServerRender');

const OWNER_STITCH_PLACEHOLDER_PATHS = Object.freeze({
  avatar: '/admin/assets/visuals/owner/avatar-placeholder.svg',
  flagEn: '/admin/assets/visuals/owner/flag-en.svg',
  flagTh: '/admin/assets/visuals/owner/flag-th.svg',
  network: '/admin/assets/visuals/owner/network-placeholder.svg',
  datacenter: '/admin/assets/visuals/owner/datacenter-placeholder.svg',
});

function getIconContentType(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  return 'image/webp';
}

function getAssetContentType(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.css') return 'text/css; charset=utf-8';
  if (normalized === '.js') return 'application/javascript; charset=utf-8';
  if (normalized === '.json') return 'application/json; charset=utf-8';
  if (normalized === '.svg') return 'image/svg+xml; charset=utf-8';
  if (normalized === '.png') return 'image/png';
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  if (normalized === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function getAdminAssetCacheControl(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.css' || normalized === '.js' || normalized === '.json') {
    return 'no-store, no-cache, must-revalidate';
  }
  return 'public, max-age=300';
}

function getVisualAssetContentType(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  if (normalized === '.webp') return 'image/webp';
  if (normalized === '.svg') return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}

function createAdminPageRuntime(options = {}) {
  const {
    dashboardHtmlPath,
    ownerConsoleHtmlPath,
    tenantConsoleHtmlPath,
    loginHtmlPath,
    ownerLoginHtmlPath,
    tenantLoginHtmlPath,
    assetsDirPath,
    scumItemsDirPath,
    visualAssetsDirPath,
    ownerStitchPagesDirPath = path.resolve(process.cwd(), 'stitch', 'owner-pages'),
    buildSecurityHeaders,
    sendText,
  } = options;
  const resolvedVisualAssetsDirPath = visualAssetsDirPath
    || path.resolve(
      assetsDirPath,
      'visuals',
    );

  let cachedDashboardHtml = null;
  let cachedOwnerConsoleHtml = null;
  let cachedTenantConsoleHtml = null;
  let cachedLoginHtml = null;
  let cachedOwnerLoginHtml = null;
  let cachedTenantLoginHtml = null;
  const cachedOwnerStitchHtml = new Map();
  let cachedDashboardHtmlMtimeMs = 0;
  let cachedOwnerConsoleHtmlMtimeMs = 0;
  let cachedTenantConsoleHtmlMtimeMs = 0;
  let cachedLoginHtmlMtimeMs = 0;
  let cachedOwnerLoginHtmlMtimeMs = 0;
  let cachedTenantLoginHtmlMtimeMs = 0;

  function readHtmlWithMtime(cacheValue, cacheMtimeMs, filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (!cacheValue || stat.mtimeMs !== cacheMtimeMs) {
        return {
          html: fs.readFileSync(filePath, 'utf8'),
          mtimeMs: stat.mtimeMs,
        };
      }
    } catch {
      if (!cacheValue) {
        throw new Error(`Unable to read HTML template: ${filePath}`);
      }
    }
    return {
      html: cacheValue,
      mtimeMs: cacheMtimeMs,
    };
  }

  function resolveOwnerStitchTemplateName(pathname) {
    const rawPath = String(pathname || '').trim().toLowerCase();
    if (rawPath === '/owner' || rawPath === '/owner/' || rawPath === '/owner/dashboard' || rawPath === '/owner/dashboard/') return '01-owner-platform-overview.html';
    if (rawPath === '/owner/tenants' || rawPath === '/owner/tenants/') return '02-owner-tenant-management.html';
    if (rawPath === '/owner/tenants/new' || rawPath === '/owner/tenants/new/') return '20-owner-create-tenant.html';
    if (rawPath === '/owner/tenants/context' || rawPath === '/owner/tenants/context/') return '21-owner-tenant-dossier.html';
    if (rawPath.startsWith('/owner/tenants/')) return '21-owner-tenant-dossier.html';
    if (rawPath === '/owner/packages' || rawPath === '/owner/packages/') return '03-owner-package-management.html';
    if (rawPath.startsWith('/owner/packages/')) return '04-owner-package-detail.html';
    if (rawPath === '/owner/subscriptions' || rawPath === '/owner/subscriptions/') return '05-owner-billing-and-subscriptions.html';
    if (rawPath.startsWith('/owner/subscriptions/')) return '06-owner-subscriptions-detail.html';
    if (rawPath === '/owner/billing' || rawPath === '/owner/billing/') return '07-owner-billing-overview.html';
    if (rawPath === '/owner/billing/invoice' || rawPath.startsWith('/owner/billing/invoice/')) return '08-owner-invoice-detail.html';
    if (rawPath === '/owner/billing/attempt' || rawPath.startsWith('/owner/billing/attempt/')) return '09-owner-payment-attempt-detail.html';
    if (rawPath === '/owner/runtime' || rawPath === '/owner/runtime/' || rawPath === '/owner/runtime/overview' || rawPath === '/owner/runtime/overview/') return '10-owner-fleet-overview.html';
    if (rawPath === '/owner/runtime/create-server' || rawPath === '/owner/runtime/create-server/') return '10-owner-fleet-overview.html';
    if (rawPath === '/owner/runtime/provision-runtime' || rawPath === '/owner/runtime/provision-runtime/') return '10-owner-fleet-overview.html';
    if (rawPath === '/owner/runtime/fleet-diagnostics' || rawPath.startsWith('/owner/runtime/fleet-diagnostics/')) return '11-owner-fleet-runtime-diagnostics.html';
    if (rawPath === '/owner/runtime/agents-bots' || rawPath.startsWith('/owner/runtime/agents-bots/')) return '12-owner-agents-and-bots-detail.html';
    if (
      rawPath === '/owner/analytics' || rawPath === '/owner/analytics/'
      || rawPath === '/owner/analytics/overview' || rawPath === '/owner/analytics/overview/'
      || rawPath === '/owner/observability' || rawPath === '/owner/observability/'
      || rawPath === '/owner/jobs' || rawPath === '/owner/jobs/'
    ) return '13-owner-observability-and-jobs.html';
    if (rawPath === '/owner/automation' || rawPath === '/owner/automation/') return '26-owner-automation-and-notifications.html';
    if (rawPath === '/owner/incidents' || rawPath === '/owner/incidents/') return '14-owner-incidents-and-alerts.html';
    if (rawPath === '/owner/support' || rawPath === '/owner/support/') return '15-owner-support-and-diagnostics.html';
    if (rawPath === '/owner/support/context' || rawPath === '/owner/support/context/') return '22-owner-support-context.html';
    if (rawPath.startsWith('/owner/support/')) return '22-owner-support-context.html';
    if (rawPath === '/owner/recovery' || rawPath === '/owner/recovery/' || rawPath === '/owner/recovery/overview' || rawPath === '/owner/recovery/overview/') return '16-owner-maintenance-and-recovery.html';
    if (rawPath === '/owner/recovery/tenant-backup' || rawPath.startsWith('/owner/recovery/tenant-backup/')) return '17-owner-tenant-backup-details.html';
    if (
      rawPath === '/owner/audit' || rawPath === '/owner/audit/'
      || rawPath === '/owner/security' || rawPath === '/owner/security/'
      || rawPath === '/owner/security/overview' || rawPath === '/owner/security/overview/'
    ) {
      return '18-owner-audit-and-security.html';
    }
    if (rawPath === '/owner/access' || rawPath === '/owner/access/') return '23-owner-access-posture.html';
    if (rawPath === '/owner/diagnostics' || rawPath === '/owner/diagnostics/') return '24-owner-diagnostics-and-evidence.html';
    if (rawPath === '/owner/control' || rawPath === '/owner/control/') return '25-owner-platform-controls.html';
    if (rawPath === '/owner/settings' || rawPath === '/owner/settings/' || rawPath === '/owner/settings/overview' || rawPath === '/owner/settings/overview/') {
      return '19-owner-settings-and-environment.html';
    }
    return '';
  }

  function normalizeOwnerStitchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, ' and ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveOwnerStitchTitle(pathname, fileName) {
    const rawPath = String(pathname || '').trim().toLowerCase();
    if (rawPath === '/owner' || rawPath === '/owner/' || rawPath === '/owner/dashboard' || rawPath === '/owner/dashboard/') return 'SCUM Owner Plane - Platform Overview';
    if (rawPath === '/owner/tenants' || rawPath === '/owner/tenants/') return 'SCUM Owner Plane - Tenant Management';
    if (rawPath === '/owner/tenants/new' || rawPath === '/owner/tenants/new/') return 'SCUM Owner Plane - Create Tenant';
    if (rawPath.startsWith('/owner/tenants/')) return 'SCUM Owner Plane - Tenant Dossier';
    if (rawPath === '/owner/packages' || rawPath === '/owner/packages/') return 'SCUM Owner Plane - Package Management';
    if (rawPath.startsWith('/owner/packages/')) return 'SCUM Owner Plane - Package Detail';
    if (rawPath === '/owner/subscriptions' || rawPath === '/owner/subscriptions/') return 'SCUM Owner Plane - Billing and Subscriptions';
    if (rawPath.startsWith('/owner/subscriptions/')) return 'SCUM Owner Plane - Subscription Detail';
    if (rawPath === '/owner/billing' || rawPath === '/owner/billing/') return 'SCUM Owner Plane - Billing Overview';
    if (rawPath === '/owner/billing/invoice' || rawPath.startsWith('/owner/billing/invoice/')) return 'SCUM Owner Plane - Invoice Detail';
    if (rawPath === '/owner/billing/attempt' || rawPath.startsWith('/owner/billing/attempt/')) return 'SCUM Owner Plane - Payment Attempt Detail';
    if (rawPath === '/owner/runtime' || rawPath === '/owner/runtime/' || rawPath === '/owner/runtime/overview' || rawPath === '/owner/runtime/overview/') return 'SCUM Owner Plane - Runtime Overview';
    if (rawPath === '/owner/runtime/create-server' || rawPath === '/owner/runtime/create-server/') return 'SCUM Owner Plane - Create Server Record';
    if (rawPath === '/owner/runtime/provision-runtime' || rawPath === '/owner/runtime/provision-runtime/') return 'SCUM Owner Plane - Provision Runtime';
    if (rawPath === '/owner/runtime/fleet-diagnostics' || rawPath.startsWith('/owner/runtime/fleet-diagnostics/')) return 'SCUM Owner Plane - Runtime Diagnostics';
    if (rawPath === '/owner/runtime/agents-bots' || rawPath.startsWith('/owner/runtime/agents-bots/')) return 'SCUM Owner Plane - Runtime Registry';
    if (
      rawPath === '/owner/analytics' || rawPath === '/owner/analytics/'
      || rawPath === '/owner/analytics/overview' || rawPath === '/owner/analytics/overview/'
      || rawPath === '/owner/observability' || rawPath === '/owner/observability/'
      || rawPath === '/owner/jobs' || rawPath === '/owner/jobs/'
    ) {
      return rawPath === '/owner/jobs' || rawPath === '/owner/jobs/' ? 'SCUM Owner Plane - Job Queue' : 'SCUM Owner Plane - Analytics Overview';
    }
    if (rawPath === '/owner/automation' || rawPath === '/owner/automation/') return 'SCUM Owner Plane - Automation and Notifications';
    if (rawPath === '/owner/incidents' || rawPath === '/owner/incidents/') return 'SCUM Owner Plane - Incidents and Alerts';
    if (rawPath === '/owner/support' || rawPath === '/owner/support/') return 'SCUM Owner Plane - Support and Diagnostics';
    if (rawPath.startsWith('/owner/support/')) return 'SCUM Owner Plane - Support Context';
    if (rawPath === '/owner/recovery' || rawPath === '/owner/recovery/' || rawPath === '/owner/recovery/overview' || rawPath === '/owner/recovery/overview/') return 'SCUM Owner Plane - Recovery Overview';
    if (rawPath === '/owner/recovery/tenant-backup' || rawPath.startsWith('/owner/recovery/tenant-backup/')) {
      return 'SCUM Owner Plane - Tenant Backup Detail';
    }
    if (rawPath === '/owner/audit' || rawPath === '/owner/audit/') return 'SCUM Owner Plane - Audit Trail';
    if (rawPath === '/owner/security' || rawPath === '/owner/security/' || rawPath === '/owner/security/overview' || rawPath === '/owner/security/overview/') return 'SCUM Owner Plane - Security Overview';
    if (rawPath === '/owner/access' || rawPath === '/owner/access/') return 'SCUM Owner Plane - Access Posture';
    if (rawPath === '/owner/diagnostics' || rawPath === '/owner/diagnostics/') return 'SCUM Owner Plane - Diagnostics and Evidence';
    if (rawPath === '/owner/control' || rawPath === '/owner/control/') return 'SCUM Owner Plane - Platform Controls';
    if (rawPath === '/owner/settings' || rawPath === '/owner/settings/' || rawPath === '/owner/settings/overview' || rawPath === '/owner/settings/overview/') return 'SCUM Owner Plane - Settings Overview';

    if (fileName === '18-owner-audit-and-security.html') return 'SCUM Owner Plane - Audit and Security';
    if (fileName === '19-owner-settings-and-environment.html') return 'SCUM Owner Plane - Settings and Environment';
    return 'SCUM Owner Plane';
  }

  function resolveOwnerVisualPlaceholder(imgTag) {
    const normalized = normalizeOwnerStitchText(imgTag);
    if (!normalized) return OWNER_STITCH_PLACEHOLDER_PATHS.network;
    if (normalized.includes('alt="en"') || normalized.includes(' english') || normalized.includes('english')) {
      return OWNER_STITCH_PLACEHOLDER_PATHS.flagEn;
    }
    if (normalized.includes('alt="th"') || normalized.includes('ภาษาไทย') || normalized.includes(' thai')) {
      return OWNER_STITCH_PLACEHOLDER_PATHS.flagTh;
    }
    if (normalized.includes('data center') || normalized.includes('server room') || normalized.includes('rack')) {
      return OWNER_STITCH_PLACEHOLDER_PATHS.datacenter;
    }
    if (
      normalized.includes('graph')
      || normalized.includes('network')
      || normalized.includes('diagnostic')
      || normalized.includes('telemetry')
      || normalized.includes('data visualization')
    ) {
      return OWNER_STITCH_PLACEHOLDER_PATHS.network;
    }
    if (
      normalized.includes('profile')
      || normalized.includes('avatar')
      || normalized.includes('portrait')
      || normalized.includes('operator')
      || normalized.includes('administrator')
      || normalized.includes('executive')
      || normalized.includes('owner')
    ) {
      return OWNER_STITCH_PLACEHOLDER_PATHS.avatar;
    }
    return OWNER_STITCH_PLACEHOLDER_PATHS.network;
  }

  function replaceOwnerRemoteVisuals(html) {
    return String(html || '').replace(/<img\b[^>]*\bsrc="https:\/\/lh3\.googleusercontent\.com[^"]+"[^>]*>/gi, (imgTag) => {
      const placeholderPath = resolveOwnerVisualPlaceholder(imgTag);
      return imgTag.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]+"/i, `src="${placeholderPath}"`);
    });
  }

  function replaceOwnerDocumentTitle(html, title) {
    const nextTitle = String(title || 'SCUM Owner Plane');
    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
      return String(html).replace(/<title>[\s\S]*?<\/title>/i, `<title>${nextTitle}</title>`);
    }
    return String(html);
  }

  function readOwnerStitchHtml(fileName) {
    const absolutePath = path.resolve(ownerStitchPagesDirPath, fileName);
    const cached = cachedOwnerStitchHtml.get(absolutePath);
    const result = readHtmlWithMtime(cached?.html || null, cached?.mtimeMs || 0, absolutePath);
    cachedOwnerStitchHtml.set(absolutePath, result);
    return result.html;
  }

  function buildOwnerLegacyHostMarkup() {
    return [
      '<div id="ownerLegacyOverlay" hidden style="position:fixed;inset:0;z-index:9999;background:rgba(10,12,14,0.74);backdrop-filter:blur(8px);padding:32px;overflow:auto;">',
      '  <div style="max-width:1440px;margin:0 auto;">',
      '    <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:16px;">',
      '      <div style="color:#e3e2e4;font:700 14px/1.5 Inter,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;">Owner Live Workspace</div>',
      '      <button id="ownerLegacyOverlayClose" type="button" style="border:1px solid rgba(133,147,153,.24);background:#1f2022;color:#e3e2e4;border-radius:12px;padding:10px 14px;font:700 12px/1 Inter,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;">Close</button>',
      '    </div>',
      '    <div id="ownerLegacyChrome" style="display:block;">',
      '      <span id="ownerV4Status" hidden></span>',
      '      <select id="ownerLanguageSelect" hidden aria-hidden="true" tabindex="-1"></select>',
      '      <button id="ownerV4RefreshBtn" type="button" hidden></button>',
      '      <div id="ownerV4AppRoot"></div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('');
  }

  function patchOwnerStitchHtml(html, pathname, fileName, bootstrapState) {
    const canonicalTitle = resolveOwnerStitchTitle(pathname, fileName);
    const ownerRecoveryVersion = '20260411-owner-recovery-3';
    const serverRenderedSurface = renderOwnerStitchServerSurface(pathname, bootstrapState);
    const serializedBootstrapState = bootstrapState && typeof bootstrapState === 'object'
      ? JSON.stringify(bootstrapState)
      : 'null';
    const injected = [
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="robots" content="noindex,nofollow">',
      '<link rel="stylesheet" href="/admin/assets/control-plane-shell-v4.css?v=20260410-owner-stitch-base-1">',
      '<link rel="stylesheet" href="/admin/assets/owner-dashboard-v4.css?v=20260410-owner-stitch-base-1">',
      '<link rel="stylesheet" href="/admin/assets/owner-tenants-v4.css?v=20260410-owner-stitch-base-1">',
      '<link rel="stylesheet" href="/admin/assets/owner-runtime-health-v4.css?v=20260410-owner-stitch-base-1">',
      '<link rel="stylesheet" href="/admin/assets/owner-control-v4.css?v=20260410-owner-stitch-base-1">',
      '<link rel="stylesheet" href="/admin/assets/owner-vnext.css?v=20260410-owner-stitch-base-1">',
'<link rel="stylesheet" href="/admin/assets/owner-stitch-polish.css?v=20260415-owner-stitch-polish-28">',
      '<style id="owner-stitch-boot-style">body{margin:0;background:#090b0d;color:#eef4f8;}#ownerShellBoot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 100% 0%, rgba(21,215,255,0.08), transparent 24%),linear-gradient(180deg,#0a0d10,#090b0d 40%,#080a0c);color:#eef4f8;z-index:120;transition:opacity .18s ease, visibility .18s ease;}#ownerShellBoot[hidden]{display:none !important;}#ownerShellBoot .owner-shell-boot-card{display:grid;gap:10px;min-width:min(420px,calc(100vw - 32px));max-width:520px;padding:18px 20px;border:1px solid rgba(24,216,255,0.18);border-radius:16px;background:rgba(10,14,18,0.94);box-shadow:0 24px 64px rgba(0,0,0,0.34);}#ownerShellBoot .owner-shell-boot-kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(21,215,255,0.86);}#ownerShellBoot .owner-shell-boot-title{font-size:18px;font-weight:700;}#ownerShellBoot .owner-shell-boot-copy{font-size:14px;color:rgba(238,244,248,0.72);}#ownerShellBoot[data-timeout=\"true\"] .owner-shell-boot-card{border-color:rgba(244,197,107,0.24);box-shadow:0 24px 64px rgba(0,0,0,0.4);}#ownerShellBoot[data-timeout=\"true\"] .owner-shell-boot-kicker{color:rgba(244,197,107,0.92);}body:not(.owner-live-ready) main[data-owner-stitched=\"true\"]{visibility:hidden!important;opacity:0!important;}body.owner-live-ready #ownerShellBoot{opacity:0;visibility:hidden;pointer-events:none;}body.owner-live-ready main[data-owner-stitched=\"true\"]{visibility:visible!important;opacity:1!important;}</style>',
      `<title>${canonicalTitle}</title>`,
      `<script>window.__OWNER_STITCH_ROUTE__=${JSON.stringify(String(pathname || ''))};window.__OWNER_STITCH_TEMPLATE__=${JSON.stringify(String(fileName || ''))};window.__OWNER_STITCH_TITLE__=${JSON.stringify(canonicalTitle)};window.__OWNER_STITCH_RECOVERY_VERSION__=${JSON.stringify(ownerRecoveryVersion)};window.__OWNER_STITCH_STATE__=${serializedBootstrapState};window.__OWNER_STITCH_SERVER_RENDERED__=true;(function(){try{if(String(location.hash||'').startsWith('#owner-live-section-')){history.replaceState(null,'',location.pathname+location.search);}}catch(_){}const key='owner-stitch-recovery:'+${JSON.stringify(String(pathname || ''))}+':'+window.__OWNER_STITCH_RECOVERY_VERSION__;function hasLiveContent(){const node=document.getElementById('ownerStitchLiveData');if(!node)return false;const style=window.getComputedStyle(node);const rect=node.getBoundingClientRect();const child=node.firstElementChild;const childRect=child&&child.getBoundingClientRect?child.getBoundingClientRect():{width:0,height:0};const text=String(node.innerText||'').trim().length;return text>=40&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0.05&&rect.width>=120&&rect.height>=80&&(!child||childRect.height>=40||String(child.innerText||'').trim().length>=40);}function recover(){try{if(hasLiveContent())return;const count=Number(sessionStorage.getItem(key)||'0');if(count>=1)return;sessionStorage.setItem(key,String(count+1));const url=new URL(location.href);url.hash='';url.searchParams.set('_ovr',window.__OWNER_STITCH_RECOVERY_VERSION__);location.replace(url.toString());}catch(_){}}window.addEventListener('load',function(){window.setTimeout(recover,1800);window.setTimeout(recover,3200);},{once:true});})();</script>`,
      '<script>document.addEventListener(\'DOMContentLoaded\',function(){try{var live=document.getElementById(\'ownerStitchLiveData\');if(live&&live.getAttribute(\'data-owner-server-rendered\')===\'true\'){live.innerHTML=\'<section class=\"owner-live-panel owner-live-empty\" data-owner-section=\"panel\" data-owner-section-label=\"Loading\"><strong>Loading owner workspace</strong><div class=\"owner-live-note\">Preparing the interactive Owner workspace before showing live route content.</div></section>\';}}catch(_){}window.setTimeout(function(){try{if(document.body&&!document.body.classList.contains(\'owner-live-ready\')){document.body.classList.add(\'owner-live-timeout\');var boot=document.getElementById(\'ownerShellBoot\');if(boot){boot.setAttribute(\'data-timeout\',\'true\');var title=boot.querySelector(\'.owner-shell-boot-title\');var copy=boot.querySelector(\'.owner-shell-boot-copy\');if(title)title.textContent=\'Still loading the Owner workspace\';if(copy)copy.textContent=\'The live Owner surface is taking longer than expected. Reload this page if it stays on this screen.\';}}}catch(_){}},4500);},{once:true});</script>',
    ].join('');
    const bridgeBundle = [
      buildOwnerLegacyHostMarkup(),
'<script src="/admin/assets/admin-i18n.js?v=20260415-owner-i18n-4"></script>',
      '<script>window.AdminUiI18n&&window.AdminUiI18n.init&&window.AdminUiI18n.init([\'ownerLanguageSelect\']);</script>',
      '<script src="/admin/assets/owner-dashboard-v4.js?v=20260415-owner-dashboard-v4-4"></script>',
'<script src="/admin/assets/owner-tenants-v4.js?v=20260415-owner-tenants-v4-3"></script>',
'<script src="/admin/assets/owner-runtime-health-v4.js?v=20260415-owner-runtime-health-v4-3"></script>',
      '<script src="/admin/assets/owner-control-risk-v4.js?v=20260410-owner-stitch-2"></script>',
    '<script src="/admin/assets/owner-control-v4.js?v=20260415-owner-control-v4-6"></script>',
'<script src="/admin/assets/owner-vnext.js?v=20260415-owner-vnext-3"></script>',
'<script src="/admin/assets/owner-v4-app.js?v=20260415-owner-v4-app-9"></script>',
    '<script src="/admin/assets/owner-stitch-bridge.js?v=20260415-owner-stitch-47"></script>',
'<script src="/admin/assets/owner-stitch-live.js?v=20260415-owner-stitch-live-45"></script>',
    ].join('');
    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      injected,
      '</head>',
      '<body>',
      '<div id="ownerShellBoot" aria-live="polite" role="status"><div class="owner-shell-boot-card"><div class="owner-shell-boot-kicker">Owner workspace</div><div class="owner-shell-boot-title">Loading live control surface</div><div class="owner-shell-boot-copy">Preparing the interactive Owner workspace and suppressing the stitched placeholder shell.</div></div></div>',
      '<noscript><style>#ownerShellBoot{display:none!important;}main[data-owner-stitched="true"]{visibility:visible!important;opacity:1!important;}</style></noscript>',
      `<main data-owner-stitched="true" data-owner-chrome="workspace" data-owner-route="${String(pathname || '').replace(/"/g, '&quot;')}">${serverRenderedSurface}</main>`,
      bridgeBundle,
      '</body>',
      '</html>',
    ].join('');
  }

  async function tryServeAdminStaticAsset(req, res, pathname) {
    if (String(req.method || '').toUpperCase() !== 'GET') return false;
    if (!String(pathname || '').startsWith('/admin/assets/')) return false;

    if (String(pathname || '').startsWith('/admin/assets/locales/')) {
      let relativeName = '';
      try {
        relativeName = decodeURIComponent(String(pathname || '').slice('/admin/assets/locales/'.length));
      } catch {
        return false;
      }
      if (!relativeName || relativeName.includes('..')) {
        sendText(res, 404, 'Not found');
        return true;
      }
      const ext = path.extname(relativeName).toLowerCase();
      if (ext !== '.json') {
        sendText(res, 404, 'Not found');
        return true;
      }
      const localeAssetsDirPath = path.resolve(assetsDirPath, 'locales');
      const absPath = path.resolve(localeAssetsDirPath, relativeName);
      if (!absPath.startsWith(localeAssetsDirPath)) {
        sendText(res, 404, 'Not found');
        return true;
      }
      try {
        const stat = await fs.promises.stat(absPath);
        if (!stat.isFile()) {
          sendText(res, 404, 'Not found');
          return true;
        }
        res.writeHead(200, {
          ...buildSecurityHeaders({
            'Content-Type': getAssetContentType(ext),
            'Cache-Control': getAdminAssetCacheControl(ext),
          }),
        });
        await pipeline(fs.createReadStream(absPath), res);
        return true;
      } catch {
        sendText(res, 404, 'Not found');
        return true;
      }
    }

    if (String(pathname || '').startsWith('/admin/assets/visuals/')) {
      let relativeName = '';
      try {
        relativeName = decodeURIComponent(String(pathname || '').slice('/admin/assets/visuals/'.length));
      } catch {
        return false;
      }
      if (!relativeName || relativeName.includes('..')) {
        sendText(res, 404, 'Not found');
        return true;
      }
      const ext = path.extname(relativeName).toLowerCase();
      if (!new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']).has(ext)) {
        sendText(res, 404, 'Not found');
        return true;
      }
      const absPath = path.resolve(resolvedVisualAssetsDirPath, relativeName);
      if (!absPath.startsWith(resolvedVisualAssetsDirPath)) {
        sendText(res, 404, 'Not found');
        return true;
      }
      try {
        const stat = await fs.promises.stat(absPath);
        if (!stat.isFile()) {
          sendText(res, 404, 'Not found');
          return true;
        }
        res.writeHead(200, {
          ...buildSecurityHeaders({
            'Content-Type': getVisualAssetContentType(ext),
            'Cache-Control': 'public, max-age=86400',
          }),
        });
        await pipeline(fs.createReadStream(absPath), res);
        return true;
      } catch {
        sendText(res, 404, 'Not found');
        return true;
      }
    }

    let relativeName = '';
    try {
      relativeName = decodeURIComponent(String(pathname || '').slice('/admin/assets/'.length));
    } catch {
      return false;
    }
    if (!relativeName || relativeName.includes('/') || relativeName.includes('\\')) {
      sendText(res, 404, 'Not found');
      return true;
    }

    const ext = path.extname(relativeName).toLowerCase();
    if (!new Set(['.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp']).has(ext)) {
      sendText(res, 404, 'Not found');
      return true;
    }

    const absPath = path.resolve(assetsDirPath, relativeName);
    if (!absPath.startsWith(assetsDirPath)) {
      sendText(res, 404, 'Not found');
      return true;
    }

    try {
      const stat = await fs.promises.stat(absPath);
      if (!stat.isFile()) {
        sendText(res, 404, 'Not found');
        return true;
      }
      res.writeHead(200, {
        ...buildSecurityHeaders({
          'Content-Type': getAssetContentType(ext),
          'Cache-Control': getAdminAssetCacheControl(ext),
        }),
      });
      await pipeline(fs.createReadStream(absPath), res);
      return true;
    } catch {
      sendText(res, 404, 'Not found');
      return true;
    }
  }

  async function tryServeStaticScumIcon(req, res, pathname) {
    if (String(req.method || '').toUpperCase() !== 'GET') return false;

    const prefixes = ['/assets/scum-items/', '/admin/assets/scum-items/'];
    const matchedPrefix = prefixes.find((prefix) => String(pathname || '').startsWith(prefix));
    if (!matchedPrefix) return false;

    let relativeName = '';
    try {
      relativeName = decodeURIComponent(String(pathname || '').slice(matchedPrefix.length));
    } catch {
      return false;
    }
    if (!relativeName || relativeName.includes('/') || relativeName.includes('\\')) {
      return false;
    }
    if (relativeName.includes('..')) {
      return false;
    }

    const ext = path.extname(relativeName).toLowerCase();
    if (!new Set(['.webp', '.png', '.jpg', '.jpeg']).has(ext)) {
      return false;
    }

    const absPath = path.resolve(scumItemsDirPath, relativeName);
    if (!absPath.startsWith(scumItemsDirPath)) {
      return false;
    }

    try {
      const stat = await fs.promises.stat(absPath);
      if (!stat.isFile()) {
        sendText(res, 404, 'Not found');
        return true;
      }
      res.writeHead(200, {
        ...buildSecurityHeaders({
          'Content-Type': getIconContentType(ext),
          'Cache-Control': 'public, max-age=86400',
        }),
      });
      await pipeline(fs.createReadStream(absPath), res);
      return true;
    } catch {
      sendText(res, 404, 'Not found');
      return true;
    }
  }

  function getDashboardHtml() {
    const result = readHtmlWithMtime(cachedDashboardHtml, cachedDashboardHtmlMtimeMs, dashboardHtmlPath);
    cachedDashboardHtml = result.html;
    cachedDashboardHtmlMtimeMs = result.mtimeMs;
    return cachedDashboardHtml;
  }

  function getOwnerConsoleHtml() {
    const result = readHtmlWithMtime(cachedOwnerConsoleHtml, cachedOwnerConsoleHtmlMtimeMs, ownerConsoleHtmlPath);
    cachedOwnerConsoleHtml = result.html;
    cachedOwnerConsoleHtmlMtimeMs = result.mtimeMs;
    return cachedOwnerConsoleHtml;
  }

  function getOwnerSurfaceHtml(pathname, bootstrapState) {
    const fileName = resolveOwnerStitchTemplateName(pathname);
    if (!fileName) {
      return getOwnerConsoleHtml();
    }
    try {
      const html = readOwnerStitchHtml(fileName);
      return patchOwnerStitchHtml(html, pathname, fileName, bootstrapState);
    } catch {
      return getOwnerConsoleHtml();
    }
  }

  function getTenantConsoleHtml() {
    const result = readHtmlWithMtime(cachedTenantConsoleHtml, cachedTenantConsoleHtmlMtimeMs, tenantConsoleHtmlPath);
    cachedTenantConsoleHtml = result.html;
    cachedTenantConsoleHtmlMtimeMs = result.mtimeMs;
    return cachedTenantConsoleHtml;
  }

  function getLoginHtml() {
    const result = readHtmlWithMtime(cachedLoginHtml, cachedLoginHtmlMtimeMs, loginHtmlPath);
    cachedLoginHtml = result.html;
    cachedLoginHtmlMtimeMs = result.mtimeMs;
    return cachedLoginHtml;
  }

  function getOwnerLoginHtml() {
    const filePath = ownerLoginHtmlPath || loginHtmlPath;
    const result = readHtmlWithMtime(cachedOwnerLoginHtml, cachedOwnerLoginHtmlMtimeMs, filePath);
    cachedOwnerLoginHtml = result.html;
    cachedOwnerLoginHtmlMtimeMs = result.mtimeMs;
    return cachedOwnerLoginHtml;
  }

  function getTenantLoginHtml() {
    const filePath = tenantLoginHtmlPath || loginHtmlPath;
    const result = readHtmlWithMtime(cachedTenantLoginHtml, cachedTenantLoginHtmlMtimeMs, filePath);
    cachedTenantLoginHtml = result.html;
    cachedTenantLoginHtmlMtimeMs = result.mtimeMs;
    return cachedTenantLoginHtml;
  }

  return {
    tryServeAdminStaticAsset,
    tryServeStaticScumIcon,
    getDashboardHtml,
    getOwnerConsoleHtml,
    getOwnerSurfaceHtml,
    getTenantConsoleHtml,
    getLoginHtml,
    getOwnerLoginHtml,
    getTenantLoginHtml,
  };
}

module.exports = {
  createAdminPageRuntime,
};
