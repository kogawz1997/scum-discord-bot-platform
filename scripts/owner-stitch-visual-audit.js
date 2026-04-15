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
const OUTPUT_PATH = path.join(OUTPUT_DIR, `owner-visual-audit-${REPORT_DATE}.json`);
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, `owner-visual-audit-${REPORT_DATE}`);

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

const ACTIVE_ROUTES = String(process.env.OWNER_VISUAL_AUDIT_ROUTES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const AUDIT_ROUTES = ACTIVE_ROUTES.length ? ACTIVE_ROUTES : ROUTES;
const SCREENSHOT_MODE = String(process.env.OWNER_VISUAL_AUDIT_SCREENSHOTS || '').trim().toLowerCase();
const SCREENSHOT_ROUTES = new Set(
  SCREENSHOT_MODE === 'all'
    ? AUDIT_ROUTES
    : String(process.env.OWNER_VISUAL_AUDIT_SCREENSHOT_ROUTES || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
);

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

async function navigate(cdp, url) {
  const loadEvent = cdp.once('Page.loadEventFired', 20000).catch(() => null);
  await cdp.send('Page.navigate', { url });
  await loadEvent;
  await waitForDocumentReady(cdp, 10000);
  await wait(1200);
}

async function waitForLoginOutcome(cdp, timeoutMs = 20000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = await evaluate(
      cdp,
      `(() => ({
        path: location.pathname,
        otpVisible: Boolean(document.getElementById('otpWrap') && !document.getElementById('otpWrap').hidden),
        submitDisabled: Boolean(document.getElementById('loginSubmit')?.disabled),
        errorText: String(document.getElementById('errorBox')?.textContent || '').trim(),
      }))()`,
    );
    if (state?.path === '/owner') return state;
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
  if (state?.path !== '/owner' && state?.otpVisible) {
    if (!secret) {
      throw new Error('OWNER login requested OTP but ADMIN_WEB_2FA_SECRET is missing.');
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
  const ownerState = await evaluate(cdp, '(() => ({ path: location.pathname }))()');
  if (!ownerState || ownerState.path !== '/owner') {
    throw new Error(`Owner session did not carry to ${BASE_URL}. Received ${JSON.stringify(ownerState)}`);
  }
}

function slugFromRoute(route) {
  return route.replace(/^\/+/, '').replace(/[\/:]+/g, '-');
}

async function setViewport(cdp, width = 1440, height = 1024) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function captureScreenshot(cdp, route) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  const filePath = path.join(SCREENSHOT_DIR, `${slugFromRoute(route)}.png`);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  return filePath;
}

function buildAuditExpression() {
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
        letterSpacing: style.letterSpacing,
        tag: el.tagName.toLowerCase(),
      };
    };

    const heading = measure(document.querySelector('[data-owner-role="page-heading"]') || document.querySelector('main h1'));
    const subtitle = measure(document.querySelector('[data-owner-role="page-subtitle"]') || document.querySelector('main .page-copy') || document.querySelector('main h1 + p'));

    const actionNodes = [...document.querySelectorAll('main [data-owner-ui="action"], main .actions a, main .actions button')]
      .filter((el, index, array) => visible(el) && array.indexOf(el) === index);
    const toolbarNodes = [...document.querySelectorAll('.topbar [data-owner-ui="toolbar"], .topbar button')]
      .filter((el, index, array) => visible(el) && array.indexOf(el) === index);
    const pillNodes = [...document.querySelectorAll('.topbar [data-owner-ui="pill"], .topbar a, .topbar__pill')]
      .filter((el, index, array) => visible(el) && array.indexOf(el) === index);
    const navNodes = [...document.querySelectorAll('.sidebar .nav-item')]
      .filter((el) => visible(el));
    const fieldNodes = [...document.querySelectorAll('main [data-owner-ui="field"], main input, main select, main textarea')]
      .filter((el, index, array) => visible(el) && array.indexOf(el) === index);

    const actionMetrics = actionNodes.map(measure).filter(Boolean);
    const toolbarMetrics = toolbarNodes.map(measure).filter(Boolean);
    const pillMetrics = pillNodes.map(measure).filter(Boolean);
    const navMetrics = navNodes.map(measure).filter(Boolean);
    const fieldMetrics = fieldNodes.map(measure).filter(Boolean);

    const summarize = (items) => {
      if (!items.length) {
        return { count: 0 };
      }
      const heights = items.map((item) => item.height);
      const fontSizes = items.map((item) => item.fontSize);
      return {
        count: items.length,
        minHeight: Math.min(...heights),
        maxHeight: Math.max(...heights),
        minFontSize: Math.min(...fontSizes),
        maxFontSize: Math.max(...fontSizes),
        sample: items.slice(0, 6),
      };
    };

    const issues = [];
    if (heading) {
      if (heading.fontSize < 30) issues.push({ kind: 'heading-too-small', value: heading.fontSize, text: heading.text });
      if (heading.fontSize > 48) issues.push({ kind: 'heading-too-large', value: heading.fontSize, text: heading.text });
    } else {
      issues.push({ kind: 'missing-heading' });
    }

    if (subtitle) {
      if (subtitle.fontSize < 13) issues.push({ kind: 'subtitle-too-small', value: subtitle.fontSize, text: subtitle.text });
      if (subtitle.fontSize > 17) issues.push({ kind: 'subtitle-too-large', value: subtitle.fontSize, text: subtitle.text });
    }

    actionMetrics.forEach((item) => {
      if (item.height < 39) issues.push({ kind: 'action-too-short', value: item.height, text: item.text });
      if (item.height > 48) issues.push({ kind: 'action-too-tall', value: item.height, text: item.text });
      if (item.fontSize < 11) issues.push({ kind: 'action-font-too-small', value: item.fontSize, text: item.text });
      if (item.fontSize > 13.5) issues.push({ kind: 'action-font-too-large', value: item.fontSize, text: item.text });
    });

    toolbarMetrics.forEach((item) => {
      if (item.height < 38) issues.push({ kind: 'toolbar-too-short', value: item.height, text: item.text || item.tag });
      if (item.height > 44) issues.push({ kind: 'toolbar-too-tall', value: item.height, text: item.text || item.tag });
    });

    pillMetrics.forEach((item) => {
      if (item.height < 34) issues.push({ kind: 'pill-too-short', value: item.height, text: item.text });
      if (item.height > 44) issues.push({ kind: 'pill-too-tall', value: item.height, text: item.text });
    });

    navMetrics.forEach((item) => {
      if (item.fontSize < 12) issues.push({ kind: 'nav-font-too-small', value: item.fontSize, text: item.text });
      if (item.fontSize > 15) issues.push({ kind: 'nav-font-too-large', value: item.fontSize, text: item.text });
    });

    fieldMetrics.forEach((item) => {
      if (item.tag === 'textarea') {
        if (item.height < 96) issues.push({ kind: 'textarea-too-short', value: item.height, text: item.text });
        return;
      }
      if (item.height < 39) issues.push({ kind: 'field-too-short', value: item.height, text: item.text });
      if (item.height > 48) issues.push({ kind: 'field-too-tall', value: item.height, text: item.text });
    });

    return {
      title: document.title,
      path: location.pathname,
      heading,
      subtitle,
      actions: summarize(actionMetrics),
      toolbar: summarize(toolbarMetrics),
      pills: summarize(pillMetrics),
      nav: summarize(navMetrics),
      fields: summarize(fieldMetrics),
      issues,
    };
  })()`;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const chromePath = resolveChromePath();
  const port = 9341;
  const userDataDir = path.resolve(process.cwd(), 'output', 'chrome-owner-visual-audit');
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
    await setViewport(cdp, 1440, 1024);
    await loginInBrowser(cdp);

    const routeResults = [];
    for (const route of AUDIT_ROUTES) {
      await navigate(cdp, `${BASE_URL}${route}`);
      const audit = await evaluate(cdp, buildAuditExpression());
      if (SCREENSHOT_ROUTES.has(route)) {
        audit.screenshot = await captureScreenshot(cdp, route);
      }
      routeResults.push({ route, ...audit });
    }

    cdp.close();

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      adminBaseUrl: ADMIN_BASE_URL,
      loginUrl: LOGIN_URL,
      routeResults,
      summary: {
        totalRoutes: routeResults.length,
        routesWithIssues: routeResults.filter((route) => Array.isArray(route.issues) && route.issues.length > 0).length,
        issueCount: routeResults.reduce((sum, route) => sum + (Array.isArray(route.issues) ? route.issues.length : 0), 0),
      },
    };

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

    const badRoutes = report.routeResults.filter((route) => route.issues.length > 0);
    if (badRoutes.length) {
      const summary = badRoutes.map((route) => `${route.route}: ${route.issues.map((item) => item.kind).join(', ')}`).join(' | ');
      throw new Error(summary);
    }

    console.log(`Owner visual audit passed. Report: ${OUTPUT_PATH}`);
  } finally {
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
