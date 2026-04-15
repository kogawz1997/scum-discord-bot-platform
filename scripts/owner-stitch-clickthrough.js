'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const BASE_URL = String(
  process.env.OWNER_STITCH_QA_BASE_URL
  || process.env.OWNER_WEB_BASE_URL
  || `http://${process.env.OWNER_WEB_HOST || '127.0.0.1'}:${process.env.OWNER_WEB_PORT || '3201'}`,
).replace(/\/+$/, '');
const ADMIN_BASE_URL = String(
  process.env.ADMIN_WEB_BASE_URL
  || `http://${process.env.ADMIN_WEB_HOST || '127.0.0.1'}:${process.env.ADMIN_WEB_PORT || '3200'}`,
).replace(/\/+$/, '');

const REPORT_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
}).format(new Date()).replace(/-/g, '');

const LOGIN_URL = `${ADMIN_BASE_URL}/owner/login`;
const OUTPUT_DIR = path.resolve(process.cwd(), 'output', 'playwright');
const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  `owner-stitch-clickthrough-${REPORT_DATE}.json`,
);

const ROUTES = [
  '/owner',
  '/owner/tenants',
  '/owner/tenants/new',
  '/owner/tenants/acme',
  '/owner/packages',
  '/owner/packages/detail',
  '/owner/subscriptions',
  '/owner/subscriptions/detail',
  '/owner/billing',
  '/owner/billing/invoice',
  '/owner/billing/attempt',
  '/owner/runtime',
  '/owner/runtime/fleet-diagnostics',
  '/owner/runtime/agents-bots',
  '/owner/analytics',
  '/owner/automation',
  '/owner/incidents',
  '/owner/support',
  '/owner/support/case-123',
  '/owner/audit',
  '/owner/security',
  '/owner/access',
  '/owner/diagnostics',
  '/owner/settings',
  '/owner/control',
  '/owner/recovery',
  '/owner/recovery/tenant-backup',
];

const CLICK_CHECKS = [
  { route: '/owner', label: 'Tenants', expectPath: '/owner/tenants' },
  { route: '/owner/tenants', label: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32\u0e43\u0e2b\u0e21\u0e48', expectPath: '/owner/tenants/new' },
  { route: '/owner/packages', label: 'Billing', expectPath: '/owner/billing' },
  { route: '/owner/subscriptions', label: 'Open Payment Attempt', expectPath: '/owner/billing/attempt' },
  { route: '/owner/billing', label: 'Quick Diagnostics', expectPath: '/owner/diagnostics' },
  { route: '/owner/analytics', label: 'Run Automation', expectPath: '/owner/automation' },
  { route: '/owner/incidents', label: 'Open Tenant', expectPath: '/owner/tenants/context' },
  { route: '/owner/support', label: 'Open Support Case', expectPath: '/owner/support/context' },
  { route: '/owner/audit', label: 'Open Access View', expectPath: '/owner/access' },
  { route: '/owner/control', label: 'Open Recovery', expectPath: '/owner/recovery' },
  { route: '/owner/automation', label: 'Open Observability', expectPath: '/owner/analytics' },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveChromePath() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Chrome or Edge was not found on this machine.');
  }
  return found;
}

function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const input = String(value || '').replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of input) {
    const index = alphabet.indexOf(ch);
    if (index >= 0) {
      bits += index.toString(2).padStart(5, '0');
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, step = 30, digits = 6) {
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % (10 ** digits)).padStart(digits, '0');
}

async function getPageWebSocketUrl(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = Array.isArray(targets)
        ? targets.find((entry) => entry.type === 'page')
        : null;
      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {}
    await wait(250);
  }
  throw new Error('Timed out while waiting for Chrome DevTools Protocol.');
}

class CdpClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const slot = this.pending.get(message.id);
        if (!slot) return;
        this.pending.delete(message.id);
        if (message.error) {
          slot.reject(new Error(message.error.message));
        } else {
          slot.resolve(message.result);
        }
        return;
      }
      const listeners = this.events.get(message.method) || [];
      listeners.forEach((listener) => listener(message.params || {}));
    });
  }

  on(method, listener) {
    const listeners = this.events.get(method) || [];
    listeners.push(listener);
    this.events.set(method, listeners);
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      const handler = (params) => {
        clearTimeout(timer);
        const listeners = this.events.get(method) || [];
        this.events.set(method, listeners.filter((listener) => listener !== handler));
        resolve(params);
      };
      this.on(method, handler);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function navigate(cdp, url) {
  const loadEvent = cdp.once('Page.loadEventFired', 20000).catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loadEvent;
  await waitForDocumentReady(cdp, 10000);
  await wait(1200);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitForDocumentReady(cdp, timeoutMs = 10000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    try {
      const state = await evaluate(
        cdp,
        '(() => ({ readyState: document.readyState, hasBody: Boolean(document.body) }))()',
      );
      if (state?.hasBody && (state.readyState === 'interactive' || state.readyState === 'complete')) {
        return true;
      }
    } catch {}
    await wait(200);
  }
  throw new Error('Timed out waiting for DOM readiness');
}

async function waitForLoginOutcome(cdp, timeoutMs = 20000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = await evaluate(
      cdp,
      `(() => ({
        path: location.pathname,
        title: document.title,
        otpVisible: Boolean(document.getElementById('otpWrap') && !document.getElementById('otpWrap').hidden),
        submitDisabled: Boolean(document.getElementById('loginSubmit')?.disabled),
        errorText: String(document.getElementById('errorBox')?.textContent || '').trim(),
      }))()`,
    );
    if (state?.path === '/owner') {
      return state;
    }
    if (state?.path === '/owner/login' && !state.submitDisabled && (state.otpVisible || state.errorText)) {
      return state;
    }
    await wait(250);
  }
  throw new Error('Timed out waiting for owner login outcome');
}

async function loginInBrowser(cdp) {
  await navigate(cdp, LOGIN_URL);
  const username = String(process.env.ADMIN_WEB_USER || '').trim();
  const password = String(process.env.ADMIN_WEB_PASSWORD || '').trim();
  const secret = String(process.env.ADMIN_WEB_2FA_SECRET || '').trim();
  if (!username || !password) {
    throw new Error('ADMIN_WEB_USER or ADMIN_WEB_PASSWORD is missing.');
  }
  await evaluate(
    cdp,
    `(() => {
      document.getElementById('usernameInput').value = ${JSON.stringify(username)};
      document.getElementById('passwordInput').value = ${JSON.stringify(password)};
      document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return true;
    })()`,
  );
  let state = await waitForLoginOutcome(cdp, 20000);
  if (state?.path === '/owner') {
    await wait(1200);
    return;
  }

  if (state?.path === '/owner/login' && state.otpVisible) {
    if (!secret) {
      throw new Error('Owner login requested OTP, but ADMIN_WEB_2FA_SECRET is missing.');
    }
    const otp = generateTotp(secret);
    await evaluate(
      cdp,
      `(() => {
        document.getElementById('otpInput').value = ${JSON.stringify(otp)};
        document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return true;
      })()`,
    );
    state = await waitForLoginOutcome(cdp, 20000);
  }

  if (!state || state.path !== '/owner') {
    throw new Error(`Owner login did not land on /owner. Received ${JSON.stringify(state)}`);
  }
  await wait(1200);
  await navigate(cdp, `${BASE_URL}/owner`);
  const ownerState = await evaluate(cdp, '(() => ({ path: location.pathname, title: document.title }))()');
  if (!ownerState || ownerState.path !== '/owner') {
    throw new Error(`Owner session did not carry to ${BASE_URL}. Received ${JSON.stringify(ownerState)}`);
  }
}

function buildInspectionExpression() {
  return `(() => {
    const items = [...document.querySelectorAll('a,button')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\\s+/g, ' ').trim(),
      href: el.getAttribute('href') || '',
      bridge: el.dataset.ownerBridge || '',
      routeTarget: el.dataset.ownerRouteTarget || '',
      action: el.dataset.ownerAction || '',
      form: el.closest('form')?.dataset.ownerForm || '',
      type: el.getAttribute('type') || '',
      embedded: !!el.closest('[data-owner-bridge-skip="true"]'),
      hidden: !!el.closest('[hidden]'),
    })).filter((item) => item.text && !item.hidden);

    const unwired = items.filter((item) => {
      if (item.embedded) {
        if (item.action || item.form) return false;
        if (item.tag === 'button' && item.type === 'submit') return false;
        if (item.tag === 'a' && (item.href.startsWith('/owner') || item.href.startsWith('#'))) return false;
      }
      if (item.bridge) return false;
      if (item.tag === 'a' && (item.href.startsWith('/owner') || item.href.startsWith('/landing'))) return false;
      return true;
    });

    const counts = items.reduce((acc, item) => {
      const key = item.bridge || (item.tag === 'a' && item.href.startsWith('/') ? 'href' : 'none');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      title: document.title,
      path: location.pathname,
      totalItems: items.length,
      counts,
      unwired,
    };
  })()`;
}

function buildVisualExpression() {
  return `(() => {
    const visible = (el) => {
      if (!el || el.closest('[hidden]')) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const measure = (el) => {
      if (!el || !visible(el)) return null;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        text: String(el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\\s+/g, ' ').trim(),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        fontSize: Number.parseFloat(style.fontSize || '0'),
        lineHeight: Number.parseFloat(style.lineHeight || '0'),
        tag: el.tagName.toLowerCase(),
      };
    };

    const main = document.querySelector('main');
    if (!main) {
      return { heading: null, headerActions: [], fields: [], warnings: [{ kind: 'missing-main' }] };
    }

    const heading = [...main.querySelectorAll('h1')].find((el) => visible(el))
      || [...main.querySelectorAll('h2,h3')].find((el) => visible(el));

    let headerBlock = null;
    if (heading) {
      let current = heading.parentElement;
      while (current && current !== main) {
        const children = [...current.children];
        const hasPeerActions = children.some((child) => {
          if (child === heading || child.contains(heading)) return false;
          return Boolean(child.querySelector('a,button'));
        });
        if (hasPeerActions) {
          headerBlock = current;
          break;
        }
        current = current.parentElement;
      }
    }

    const headerActionNodes = headerBlock
      ? [...headerBlock.querySelectorAll('a,button')].filter((el) => {
        if (!visible(el)) return false;
        const rect = el.getBoundingClientRect();
        const text = String(el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
        return rect.width <= 240 && rect.height <= 56 && text.length > 0;
      })
      : [];

    const fieldNodes = [...main.querySelectorAll('input,select,textarea')].filter((el) => visible(el));
    const warnings = [];
    const headingMetric = measure(heading);
    if (!headingMetric) {
      warnings.push({ kind: 'missing-page-heading' });
    } else {
      if (headingMetric.fontSize < 24) warnings.push({ kind: 'heading-small', value: headingMetric.fontSize, text: headingMetric.text });
      if (headingMetric.fontSize > 52) warnings.push({ kind: 'heading-large', value: headingMetric.fontSize, text: headingMetric.text });
    }

    const headerActions = headerActionNodes.map(measure).filter(Boolean);
    headerActions.forEach((item) => {
      if (item.height < 34) warnings.push({ kind: 'header-action-short', value: item.height, text: item.text });
      if (item.height > 48) warnings.push({ kind: 'header-action-tall', value: item.height, text: item.text });
      if (item.fontSize < 11) warnings.push({ kind: 'header-action-font-small', value: item.fontSize, text: item.text });
      if (item.fontSize > 14) warnings.push({ kind: 'header-action-font-large', value: item.fontSize, text: item.text });
    });

    const fields = fieldNodes.map(measure).filter(Boolean);
    fields.forEach((item) => {
      if (item.tag === 'textarea') {
        if (item.height < 84) warnings.push({ kind: 'textarea-short', value: item.height });
        return;
      }
      if (item.height < 34) warnings.push({ kind: 'field-short', value: item.height });
      if (item.height > 48) warnings.push({ kind: 'field-tall', value: item.height });
    });

    return {
      heading: headingMetric,
      headerActions: headerActions.slice(0, 8),
      headerActionCount: headerActions.length,
      fieldCount: fields.length,
      warnings,
    };
  })()`;
}

function buildClickExpression(label, expectPath) {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const needle = normalize(${JSON.stringify(label)});
    const expectedPath = ${JSON.stringify(expectPath || '')};
    let target = [...document.querySelectorAll('a,button')].find((el) => normalize(el.textContent || el.getAttribute('aria-label') || '').includes(needle));
    if (!target && expectedPath) {
      target = [...document.querySelectorAll('a,button')].find((el) => {
        const href = el.getAttribute('href') || '';
        const routeTarget = el.dataset.ownerRouteTarget || '';
        return href === expectedPath || routeTarget === expectedPath;
      });
    }
    if (!target) return { ok: false, reason: 'not-found' };
    return {
      ok: true,
      text: (target.textContent || '').replace(/\\s+/g, ' ').trim(),
      bridge: target.dataset.ownerBridge || '',
      href: target.getAttribute('href') || '',
      routeTarget: target.dataset.ownerRouteTarget || ''
    };
  })()`;
}

async function runClickCheck(cdp, check) {
  await navigate(cdp, `${BASE_URL}${check.route}`);
  const clickResult = await evaluate(cdp, buildClickExpression(check.label, check.expectPath));
  if (!clickResult?.ok) {
    return {
      route: check.route,
      label: check.label,
      ok: false,
      reason: clickResult?.reason || 'click-failed',
    };
  }

  if (check.expectDeferred) {
    await evaluate(
      cdp,
      `(() => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        const needle = normalize(${JSON.stringify(check.label)});
        const target = [...document.querySelectorAll('a,button')].find((el) => normalize(el.textContent || el.getAttribute('aria-label') || '').includes(needle));
        if (target) target.click();
        return true;
      })()`,
    );
    await wait(300);
    const deferredState = await evaluate(
      cdp,
      '(() => ({ noticeVisible: document.getElementById("ownerDeferredNotice")?.classList.contains("is-visible") === true, path: location.pathname }))()',
    );
    return {
      route: check.route,
      label: check.label,
      ok: Boolean(deferredState?.noticeVisible),
      expected: 'deferred',
      actualPath: deferredState?.path || '',
      noticeVisible: Boolean(deferredState?.noticeVisible),
    };
  }

  const navigationTarget = clickResult.routeTarget || clickResult.href || '';
  if (!navigationTarget) {
    return {
      route: check.route,
      label: check.label,
      ok: false,
      expected: check.expectPath,
      actualPath: check.route,
      reason: 'missing-route-target',
      bridge: clickResult.bridge || '',
      href: clickResult.href || '',
      routeTarget: clickResult.routeTarget || '',
    };
  }

  await evaluate(cdp, `window.location.assign(${JSON.stringify(navigationTarget)});`);
  await wait(1200);
  await wait(900);
  const state = await evaluate(cdp, '(() => ({ path: location.pathname, title: document.title }))()');
  return {
    route: check.route,
    label: check.label,
    ok: state?.path === check.expectPath,
    expected: check.expectPath,
    actualPath: state?.path || '',
    title: state?.title || '',
    routeTarget: navigationTarget,
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const chromePath = resolveChromePath();
  const port = 9340;
  const userDataDir = path.resolve(process.cwd(), 'output', 'chrome-owner-stitch-qa');
  fs.mkdirSync(userDataDir, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );

  try {
    const wsUrl = await getPageWebSocketUrl(port);
    const cdp = new CdpClient(wsUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await loginInBrowser(cdp);

    const routeResults = [];
    for (const route of ROUTES) {
      await navigate(cdp, `${BASE_URL}${route}`);
      const snapshot = await evaluate(cdp, buildInspectionExpression());
      const visual = await evaluate(cdp, buildVisualExpression());
      routeResults.push({
        route,
        ...snapshot,
        visual,
      });
    }

    const clickResults = [];
    for (const check of CLICK_CHECKS) {
      clickResults.push(await runClickCheck(cdp, check));
    }

    cdp.close();

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      adminBaseUrl: ADMIN_BASE_URL,
      loginUrl: LOGIN_URL,
      routeResults,
      clickResults,
      summary: {
        totalRoutes: routeResults.length,
        routesWithUnwiredControls: routeResults.filter((route) => Array.isArray(route.unwired) && route.unwired.length > 0).length,
        routesWithVisualWarnings: routeResults.filter((route) => Array.isArray(route.visual?.warnings) && route.visual.warnings.length > 0).length,
        clickFailures: clickResults.filter((item) => !item.ok).length,
      },
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

    const badRoutes = report.routeResults.filter((route) => route.unwired.length > 0);
    const badClicks = report.clickResults.filter((item) => !item.ok);
    const badVisualRoutes = report.routeResults.filter((route) => Array.isArray(route.visual?.warnings) && route.visual.warnings.length > 0);

    if (badRoutes.length || badClicks.length) {
      const problems = [];
      if (badRoutes.length) {
        problems.push(`unwired routes: ${badRoutes.map((route) => route.route).join(', ')}`);
      }
      if (badClicks.length) {
        problems.push(`click failures: ${badClicks.map((item) => `${item.route} -> ${item.label}`).join(', ')}`);
      }
      throw new Error(problems.join(' | '));
    }

    if (badVisualRoutes.length) {
      console.warn(`Owner visual warnings: ${badVisualRoutes.map((route) => route.route).join(', ')}`);
    }

    console.log(`Owner Stitch clickthrough passed. Report: ${OUTPUT_PATH}`);
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
