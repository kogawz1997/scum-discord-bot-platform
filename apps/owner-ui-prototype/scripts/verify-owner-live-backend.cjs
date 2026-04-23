const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const baseUrl = (process.env.OWNER_API_BASE || process.env.OWNER_UI_URL || "http://127.0.0.1:5177").replace(/\/+$/, "");
const authCookie = process.env.OWNER_AUTH_COOKIE || "";
const authCookieFile = process.env.OWNER_AUTH_COOKIE_FILE || "";
const ownerUsername = process.env.OWNER_USERNAME || "";
const ownerPassword = process.env.OWNER_PASSWORD || "";
const ownerOtp = process.env.OWNER_OTP || "";
const outputDir = "output/live-backend";
const listOnly = process.argv.includes("--list");
const endpointTimeoutMs = Math.max(1000, Number(process.env.OWNER_VERIFY_ENDPOINT_TIMEOUT_MS || 8000));

const SAMPLE_PARAMS = {
  tenantId: process.env.OWNER_TEST_TENANT_ID || "tenant-a",
  serverId: process.env.OWNER_TEST_SERVER_ID || "server-a",
  runtimeKey: process.env.OWNER_TEST_RUNTIME_KEY || "server-bot-main",
};

const UNSAFE_ENDPOINT_KEYS = new Set([
  "tenants.mutate",
  "packages.create",
  "packages.update",
  "packages.delete",
  "subscriptions.create",
  "subscriptions.update",
  "billing.invoiceUpdate",
  "billing.attemptUpdate",
  "billing.checkoutSession",
  "fleet.provision",
  "fleet.revokeDevice",
  "fleet.revokeProvision",
  "fleet.revokeToken",
  "delivery.deadLetterRetry",
  "delivery.deadLetterDelete",
  "backup.create",
  "backup.restore",
  "notifications.ack",
  "notifications.clear",
  "automation.run",
  "runtime.restartService",
]);

const DOWNLOAD_ENDPOINT_KEYS = new Set([
  "security.auditExport",
  "tenants.supportCaseExport",
]);

const STREAM_ENDPOINT_KEYS = new Set([
  "overview.live",
]);

function flattenApiMap(node, prefix = "") {
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") return [{ key: nextKey, path: value }];
    return flattenApiMap(value, nextKey);
  });
}

function expandPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_match, key) => encodeURIComponent(SAMPLE_PARAMS[key] || `sample-${key}`));
}

function isReadOnlyEndpoint(endpoint) {
  if (UNSAFE_ENDPOINT_KEYS.has(endpoint.key)) return false;
  if (DOWNLOAD_ENDPOINT_KEYS.has(endpoint.key)) return false;
  if (STREAM_ENDPOINT_KEYS.has(endpoint.key)) return false;
  if (!endpoint.path.startsWith("/owner/api/") && !endpoint.path.startsWith("/admin/api/")) return false;
  return true;
}

function cookieFromSetCookieHeaders(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  const fallback = response.headers.get("set-cookie");
  const rawCookies = values.length ? values : (fallback ? [fallback] : []);
  return rawCookies
    .map((cookie) => String(cookie).split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function cookieFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return "";

  const netscapeCookies = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\t+/))
    .filter((parts) => parts.length >= 7)
    .map((parts) => `${parts[5]}=${parts[6]}`);

  if (netscapeCookies.length) return netscapeCookies.join("; ");
  return content.replace(/\r?\n/g, "; ");
}

async function loginCookie() {
  if (!ownerUsername || !ownerPassword) return "";
  const body = { username: ownerUsername, password: ownerPassword };
  if (ownerOtp) body.otp = ownerOtp;

  const response = await fetch(`${baseUrl}/owner/api/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Owner login failed with ${response.status}: ${errorText.slice(0, 180)}`);
  }
  return cookieFromSetCookieHeaders(response);
}

async function resolveAuthCookie() {
  if (authCookie) return { cookie: authCookie, mode: "env-cookie" };
  if (authCookieFile) return { cookie: cookieFromFile(authCookieFile), mode: "cookie-file" };
  const cookie = await loginCookie();
  return { cookie, mode: cookie ? "login" : "none" };
}

async function fetchEndpoint(endpoint, cookie, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const requestBaseUrl = String(options.baseUrl || baseUrl).replace(/\/+$/, "");
  const requestTimeoutMs = Math.max(1, Number(options.timeoutMs || endpointTimeoutMs));
  const expandedPath = expandPath(endpoint.path);
  const startedAt = Date.now();
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), requestTimeoutMs)
    : null;
  let response;
  try {
    response = await fetchImpl(`${requestBaseUrl}${expandedPath}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const isTimeout = error?.name === "AbortError";
    return {
      key: endpoint.key,
      path: expandedPath,
      status: 0,
      ok: false,
      contentType: "",
      parseableJson: false,
      elapsedMs,
      error: isTimeout
        ? `Endpoint timed out after ${requestTimeoutMs}ms`
        : String(error?.message || error),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  const elapsedMs = Date.now() - startedAt;
  const contentType = response.headers.get("content-type") || "";
  let parseableJson = false;
  let bodyPreview = "";

  try {
    if (contentType.includes("application/json")) {
      await response.json();
      parseableJson = true;
    } else {
      bodyPreview = (await response.text()).slice(0, 160);
    }
  } catch (error) {
    bodyPreview = String(error?.message || error).slice(0, 160);
  }

  return {
    key: endpoint.key,
    path: expandedPath,
    status: response.status,
    ok: response.ok,
    contentType,
    parseableJson,
    elapsedMs,
    bodyPreview,
  };
}

async function run() {
  const moduleUrl = pathToFileURL(`${process.cwd()}/src/lib/owner-adapters.js`).href;
  const { REAL_OWNER_API_MAP } = await import(moduleUrl);
  const endpoints = flattenApiMap(REAL_OWNER_API_MAP).filter(isReadOnlyEndpoint);
  const skippedDownloads = flattenApiMap(REAL_OWNER_API_MAP).filter((endpoint) => DOWNLOAD_ENDPOINT_KEYS.has(endpoint.key));
  const skippedStreams = flattenApiMap(REAL_OWNER_API_MAP).filter((endpoint) => STREAM_ENDPOINT_KEYS.has(endpoint.key));

  if (listOnly) {
    for (const endpoint of endpoints) {
      console.log(`${endpoint.key} ${expandPath(endpoint.path)}`);
    }
    console.log(`read-only endpoints: ${endpoints.length}`);
    if (skippedDownloads.length) {
      console.log(`download endpoints skipped for JSON smoke: ${skippedDownloads.length}`);
    }
    if (skippedStreams.length) {
      console.log(`stream endpoints skipped for JSON smoke: ${skippedStreams.length}`);
    }
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const auth = await resolveAuthCookie();
  const results = [];
  for (const endpoint of endpoints) {
    try {
      results.push(await fetchEndpoint(endpoint, auth.cookie));
    } catch (error) {
      results.push({
        key: endpoint.key,
        path: expandPath(endpoint.path),
        status: 0,
        ok: false,
        contentType: "",
        parseableJson: false,
        elapsedMs: 0,
        error: String(error?.message || error),
      });
    }
  }

  const failed = results.filter((result) => !result.ok || !result.parseableJson);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    authMode: auth.mode,
    authCookieProvided: Boolean(auth.cookie),
    checkedEndpoints: results.length,
    failedEndpoints: failed.length,
    skippedDownloadEndpoints: skippedDownloads.map((endpoint) => ({
      key: endpoint.key,
      path: endpoint.path,
    })),
    skippedStreamEndpoints: skippedStreams.map((endpoint) => ({
      key: endpoint.key,
      path: endpoint.path,
    })),
    results,
  };

  fs.writeFileSync(`${outputDir}/owner-live-backend-smoke-report.json`, JSON.stringify(report, null, 2));
  console.log(`owner live backend smoke checked ${results.length} read-only endpoints; failures: ${failed.length}`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  cookieFromFile,
  cookieFromSetCookieHeaders,
  expandPath,
  fetchEndpoint,
  flattenApiMap,
  isReadOnlyEndpoint,
  run,
};
