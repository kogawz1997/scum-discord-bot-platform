const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const baseUrl = process.env.OWNER_UI_URL || "http://127.0.0.1:5177";
const outputDir = "output/playwright";

const tenants = [
  {
    id: "tenant-a",
    tenantId: "tenant-a",
    slug: "alpha-base",
    name: "Alpha Base",
    status: "active",
    plan: "Pro",
    tier: "Pro Ops",
    region: "TH",
    mrr: 7900,
    owner: "Nok",
  },
];

const subscriptions = [
  {
    id: "sub-alpha",
    tenantId: "tenant-a",
    tenant: "Alpha Base",
    status: "active",
    plan: "Pro Ops",
    packageName: "Pro Ops",
    renewal: "2026-05-22",
  },
];

const invoices = [
  {
    id: "inv-42",
    invoice: "inv-42",
    tenantId: "tenant-a",
    tenant: "Alpha Base",
    status: "paid",
    amount: 7900,
    currency: "THB",
    due: "2026-04-30",
  },
];

const paymentAttempts = [
  {
    id: "pay-1",
    paymentAttemptId: "pay-1",
    tenantId: "tenant-a",
    invoiceId: "inv-42",
    status: "succeeded",
    amount: 7900,
  },
];

const packages = [
  {
    id: "pkg-pro",
    sku: "pkg-pro",
    name: "Pro Ops",
    status: "active",
    price: 7900,
    features: ["orders", "restart", "leaderboard"],
  },
];

const runtimes = [
  {
    id: "runtime-7",
    runtimeId: "runtime-7",
    tenantId: "tenant-a",
    tenant: "Alpha Base",
    role: "Server Bot",
    type: "server-bot",
    status: "online",
    version: "1.4.2",
  },
];

function items(value) {
  return { items: value };
}

function bodyFor(url, method) {
  const path = url.pathname;

  if (method !== "GET") return { ok: true, data: { id: "action-1", status: "queued" } };
  if (path === "/owner/api/me") return { ok: true, data: { user: "owner" } };
  if (path.includes("/platform/tenants")) return items(tenants);
  if (path.includes("/platform/subscriptions")) return items(subscriptions);
  if (path.includes("/platform/licenses")) return items(packages);
  if (path.includes("/platform/billing/invoices")) return items(invoices);
  if (path.includes("/platform/billing/payment-attempts")) return items(paymentAttempts);
  if (path.includes("/platform/billing/overview")) return items([{ id: "bill-ov-1", status: "ok" }]);
  if (path.includes("/platform/agent-registry")) return items(runtimes);
  if (path.includes("/platform/agent-provisioning")) return items([{ id: "prov-1", runtimeId: "runtime-7", tenantId: "tenant-a", status: "activated" }]);
  if (path.includes("/platform/agent-devices")) return items([{ id: "device-1", runtimeId: "runtime-7", status: "bound" }]);
  if (path.includes("/platform/agent-credentials")) return items([{ id: "cred-1", runtimeId: "runtime-7", status: "rotated" }]);
  if (path.includes("/platform/agent-sessions")) return items([{ id: "session-1", runtimeId: "runtime-7", status: "connected" }]);
  if (path.includes("/platform/sync-runs")) return items([{ id: "sync-1", runtimeId: "runtime-7", status: "ok" }]);
  if (path.includes("/platform/agents")) return items(runtimes);
  if (path.includes("/platform/servers")) return items([{ id: "server-1", tenantId: "tenant-a", status: "online" }]);
  if (path.includes("/platform/tenant-configs")) return items([{ id: "cfg-1", tenantId: "tenant-a", status: "synced" }]);
  if (path.includes("/platform/overview")) {
    return {
      totals: { tenants: 1, mrr: 7900, tickets: 1, incidents: 0 },
      kpis: [{ label: "Tenant Health", value: "98%", trend: "+2%" }],
      alerts: [],
    };
  }
  if (path.includes("/auth/security-events")) return items([{ id: "sec-1", tenantId: "tenant-a", status: "reviewed" }]);
  if (path.includes("/auth/sessions")) return items([{ id: "auth-session-1", status: "active" }]);
  if (path.includes("/auth/role-matrix")) return items([{ id: "role-owner", role: "owner", status: "active" }]);
  if (path.includes("/auth/users")) return items([{ id: "user-owner", name: "Owner Admin", status: "active" }]);
  if (path.includes("/security/rotation-check")) return items([{ id: "rotation-1", status: "fresh" }]);
  if (path.includes("/audit/query")) return items([{ id: "audit-1", actor: "owner", action: "login", target: "Alpha Base" }]);
  if (path.includes("/runtime/supervisor")) return items([{ id: "supervisor-1", status: "online" }]);
  if (path.includes("/observability/requests")) return items([{ id: "diag-1", tenantId: "tenant-a", status: "ok", check: "SCUM.log sync" }]);
  if (path.endsWith("/owner/api/observability")) return items([{ id: "obs-1", status: "healthy" }]);
  if (path.includes("/delivery/lifecycle")) return items([{ id: "delivery-1", tenantId: "tenant-a", status: "queued" }]);
  if (path.includes("/platform/ops-state")) return items([{ id: "ops-1", status: "nominal" }]);
  if (path.includes("/platform/reconcile")) return items([{ id: "reconcile-1", status: "clean" }]);
  if (path.includes("/backup/list")) return items([{ id: "backup-1", tenantId: "tenant-a", status: "complete" }]);
  if (path.includes("/backup/restore/status")) return items([{ id: "restore-status-1", status: "ready" }]);
  if (path.includes("/backup/restore/history")) return items([{ id: "restore-1", status: "complete" }]);
  if (path.includes("/tenant-support-case/export")) {
    return { ok: true, data: { tenantId: url.searchParams.get("tenantId"), format: url.searchParams.get("format") } };
  }
  if (path.includes("/tenant-support-case")) return { ok: true, data: { tenantId: url.searchParams.get("tenantId"), signals: { total: 1 } } };
  if (path.includes("/notifications")) return items([{ id: "note-1", tenantId: "tenant-a", status: "sent" }]);
  if (path.includes("/control-panel/settings")) return items([{ id: "settings-1", status: "active" }]);
  if (path.includes("/platform/apikeys")) return items([{ id: "key-1", status: "masked" }]);
  if (path.includes("/platform/webhooks")) return items([{ id: "webhook-1", status: "active" }]);
  if (path.includes("/platform/marketplace")) return items([{ id: "market-1", status: "connected" }]);
  if (path.includes("/platform/restart-plans")) return items([{ id: "restart-plan-1", status: "scheduled" }]);
  if (path.includes("/platform/restart-executions")) return items([{ id: "restart-exec-1", status: "complete" }]);

  return items([]);
}

async function installRoutes(context) {
  await context.route("**/owner/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(bodyFor(url, route.request().method())),
    });
  });
  await context.route("**/admin/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(bodyFor(url, route.request().method())),
    });
  });
}

const DETAIL_RECORD_IDS = {
  "tenant-dossier": "tenant-a",
  "package-detail": "pkg-pro",
  "invoice-detail": "inv-42",
  "payment-attempt-detail": "pay-1",
  "subscription-detail": "sub-alpha",
  "runtime-detail": "runtime-7",
  "diagnostics-evidence": "diag-1",
  "support-context": "delivery-1",
  "backup-detail": "backup-1",
  "access-posture": "sec-1",
};

async function loadRoutes() {
  const moduleUrl = pathToFileURL(`${process.cwd()}/src/lib/owner-routes.js`).href;
  const routes = await import(moduleUrl);
  return {
    pageKeys: routes.OWNER_PAGE_KEYS,
    buildOwnerPagePath: routes.buildOwnerPagePath,
  };
}

async function smokeRoute(page, pageKey, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  const url = new URL(page.url());
  if (url.pathname === "/login") {
    throw new Error(`${pageKey} redirected to login`);
  }

  const bodyText = await page.locator("body").innerText({ timeout: 10000 });
  const banned = [
    "Backend unavailable",
    "Owner login required",
    "Checking session",
    "No tenant rows returned",
  ];
  const found = banned.find((text) => bodyText.includes(text));
  if (found) {
    throw new Error(`${pageKey} rendered blocked state: ${found}`);
  }

  const title = await page.locator("main h1").first().innerText({ timeout: 10000 });
  if (!String(title || "").trim()) {
    throw new Error(`${pageKey} rendered without a page title`);
  }

  return {
    page: pageKey,
    path,
    title,
    url: url.pathname,
  };
}

async function smokeAllRoutes(browser, pageKeys, buildOwnerPagePath) {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installRoutes(desktopContext);
  const desktop = await desktopContext.newPage();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await installRoutes(mobileContext);
  const mobile = await mobileContext.newPage();

  const results = [];
  for (const pageKey of pageKeys) {
    const recordId = DETAIL_RECORD_IDS[pageKey] || "";
    const path = buildOwnerPagePath(pageKey, recordId);
    results.push({
      viewport: "desktop",
      ...(await smokeRoute(desktop, pageKey, path)),
    });
    results.push({
      viewport: "mobile",
      ...(await smokeRoute(mobile, pageKey, path)),
    });
  }

  await desktop.screenshot({ path: `${outputDir}/owner-route-smoke-desktop-final.png`, fullPage: true });
  await mobile.screenshot({ path: `${outputDir}/owner-route-smoke-mobile-final.png`, fullPage: true });
  await desktopContext.close();
  await mobileContext.close();
  return results;
}

async function run() {
  fs.mkdirSync(outputDir, { recursive: true });
  const { pageKeys, buildOwnerPagePath } = await loadRoutes();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installRoutes(context);

  const messages = [];
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
  });

  await page.goto(`${baseUrl}/tenants`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Alpha Base/ }).first().click();
  await page.waitForURL("**/tenant-dossier/tenant-a");
  await page.getByText("Selected ID: tenant-a").waitFor();

  await page.goto(`${baseUrl}/support`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Open Support Case/i }).first().click();
  const form = page.locator("form").filter({ hasText: "Open tenant support case" });
  await form.waitFor();
  await form.getByLabel("Tenant ID").fill("tenant-a");
  const popupPromise = page.waitForEvent("popup", { timeout: 5000 }).catch(() => null);
  await form.getByRole("button", { name: /Open Support Case/i }).click();
  const popup = await popupPromise;
  if (popup) await popup.close();
  await page.getByText(/tenant-support-case\/export\?tenantId=tenant-a&format=json/).waitFor();

  await page.getByTitle("Switch language").click();
  await page.getByText("จัดการหลัก").waitFor();
  await page.getByText("ศูนย์ควบคุม Owner Platform").waitFor();
  await page.getByPlaceholder(/ค้นหา/).waitFor();
  await page.getByTitle(/ปรับโหมด/).click();
  if (!(await page.locator(".owner-theme-contrast").count())) {
    throw new Error("contrast theme class was not applied");
  }
  await page.screenshot({ path: "output/playwright/owner-desktop-support-i18n-check.png", fullPage: true });

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await installRoutes(mobileContext);
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${baseUrl}/support`, { waitUntil: "networkidle" });
  await mobile.getByText("Support & Diagnostics Control Plane").waitFor();
  await mobile.getByRole("button", { name: /Open Support Case/i }).first().click();
  await mobile.locator("form").filter({ hasText: "Open tenant support case" }).waitFor();
  await mobile.screenshot({ path: "output/playwright/owner-mobile-support-check.png", fullPage: true });

  const routeResults = await smokeAllRoutes(browser, pageKeys, buildOwnerPagePath);
  fs.writeFileSync(
    `${outputDir}/owner-route-smoke-report.json`,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl,
      checkedRoutes: routeResults.length,
      results: routeResults,
    }, null, 2),
  );

  if (messages.some((message) => /error/i.test(message))) {
    throw new Error(`console errors: ${messages.join(" | ")}`);
  }

  await browser.close();
  console.log(`owner desktop/mobile support+i18n flow ok; route smoke checked ${routeResults.length} page/viewport pairs`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
