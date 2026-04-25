const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');

const {
  createAdminStandaloneSurfaceRuntime,
} = require('../src/admin/runtime/adminStandaloneSurfaceRuntime');

function createResponse() {
  const chunks = [];
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  res.statusCode = 200;
  res.headers = {};
  res.body = '';
  res.writeHead = (statusCode, headers) => {
    res.statusCode = statusCode;
    res.headers = headers;
  };
  const originalEnd = res.end.bind(res);
  res.end = (chunk, encoding, callback) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding || 'utf8'));
    }
    res.body = Buffer.concat(chunks).toString('utf8');
    return originalEnd(callback);
  };
  return res;
}

function createReq(url, options = {}) {
  return {
    method: options.method || 'GET',
    url,
    headers: options.headers || {},
    async *[Symbol.asyncIterator]() {
      if (options.body) {
        yield Buffer.from(options.body);
      }
    },
  };
}

function createFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-standalone-surface-'));
  const assetsDir = path.join(root, 'assets');
  const scumItemsDir = path.join(root, 'scum-items');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(scumItemsDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'login.html'), '<h1>owner-login</h1>');
  fs.writeFileSync(path.join(root, 'tenant-login.html'), '<h1>tenant-login</h1>');
  fs.writeFileSync(path.join(root, 'owner-console.html'), '<h1>owner-shell</h1>');
  fs.writeFileSync(path.join(root, 'tenant-console.html'), '<h1>tenant-shell</h1>');
  fs.writeFileSync(path.join(assetsDir, 'control-plane-shell-v4.css'), 'body{}');
  return { root, assetsDir, scumItemsDir };
}

test('owner standalone surface serves owner shell and redirects tenant paths to tenant base', async () => {
  const fixture = createFixtureRoot();
  const runtime = createAdminStandaloneSurfaceRuntime({
    surface: 'owner',
    host: '127.0.0.1',
    port: 3201,
    adminBaseUrl: 'http://127.0.0.1:3200',
    ownerBaseUrl: 'http://127.0.0.1:3201',
    tenantBaseUrl: 'http://127.0.0.1:3202',
    playerBaseUrl: 'http://127.0.0.1:3300',
    assetsDirPath: fixture.assetsDir,
    scumItemsDirPath: fixture.scumItemsDir,
    loginHtmlPath: path.join(fixture.root, 'login.html'),
    tenantLoginHtmlPath: path.join(fixture.root, 'tenant-login.html'),
    ownerConsoleHtmlPath: path.join(fixture.root, 'owner-console.html'),
    tenantConsoleHtmlPath: path.join(fixture.root, 'tenant-console.html'),
    fetchImpl: async () => new Response('proxied', { status: 200 }),
  });

  const ownerRes = createResponse();
  await runtime.handleRequest(createReq('/owner/tenants'), ownerRes);
  assert.equal(ownerRes.statusCode, 200);
  assert.match(ownerRes.body, /SCUM Owner UI Prototype/);
  assert.match(ownerRes.body, /<div id="root"><\/div>/);
  assert.match(ownerRes.body, /\/assets\/index-/);

  const ownerLoginRes = createResponse();
  await runtime.handleRequest(createReq('/owner/login'), ownerLoginRes);
  assert.equal(ownerLoginRes.statusCode, 200);
  assert.match(ownerLoginRes.body, /SCUM Owner UI Prototype/);
  assert.match(ownerLoginRes.body, /<div id="root"><\/div>/);
  assert.match(ownerLoginRes.body, /\/assets\/index-/);

  const tenantRedirectRes = createResponse();
  await runtime.handleRequest(createReq('/tenant'), tenantRedirectRes);
  assert.equal(tenantRedirectRes.statusCode, 302);
  assert.equal(tenantRedirectRes.headers.Location, 'http://127.0.0.1:3202/tenant');
});

test('tenant standalone surface serves tenant login locally and rewrites admin API traffic into tenant surface API', async () => {
  const fixture = createFixtureRoot();
  let proxiedUrl = null;
  const runtime = createAdminStandaloneSurfaceRuntime({
    surface: 'tenant',
    host: '127.0.0.1',
    port: 3202,
    adminBaseUrl: 'http://127.0.0.1:3200',
    ownerBaseUrl: 'http://127.0.0.1:3201',
    tenantBaseUrl: 'http://127.0.0.1:3202',
    playerBaseUrl: 'http://127.0.0.1:3300',
    assetsDirPath: fixture.assetsDir,
    scumItemsDirPath: fixture.scumItemsDir,
    loginHtmlPath: path.join(fixture.root, 'login.html'),
    tenantLoginHtmlPath: path.join(fixture.root, 'tenant-login.html'),
    ownerConsoleHtmlPath: path.join(fixture.root, 'owner-console.html'),
    tenantConsoleHtmlPath: path.join(fixture.root, 'tenant-console.html'),
    fetchImpl: async (url) => {
      proxiedUrl = url;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const loginRes = createResponse();
  await runtime.handleRequest(createReq('/tenant/login'), loginRes);
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body, '<h1>tenant-login</h1>');

  const apiRes = createResponse();
  await runtime.handleRequest(createReq('/admin/api/me'), apiRes);
  assert.equal(apiRes.statusCode, 200);
  assert.equal(proxiedUrl, 'http://127.0.0.1:3200/tenant/api/me');
  assert.match(String(apiRes.headers['content-type'] || ''), /application\/json/i);
});

test('owner standalone surface rewrites admin API traffic into owner surface API', async () => {
  const fixture = createFixtureRoot();
  let proxiedUrl = null;
  const runtime = createAdminStandaloneSurfaceRuntime({
    surface: 'owner',
    host: '127.0.0.1',
    port: 3201,
    adminBaseUrl: 'http://127.0.0.1:3200',
    ownerBaseUrl: 'http://127.0.0.1:3201',
    tenantBaseUrl: 'http://127.0.0.1:3202',
    playerBaseUrl: 'http://127.0.0.1:3300',
    assetsDirPath: fixture.assetsDir,
    scumItemsDirPath: fixture.scumItemsDir,
    loginHtmlPath: path.join(fixture.root, 'login.html'),
    tenantLoginHtmlPath: path.join(fixture.root, 'tenant-login.html'),
    ownerConsoleHtmlPath: path.join(fixture.root, 'owner-console.html'),
    tenantConsoleHtmlPath: path.join(fixture.root, 'tenant-console.html'),
    fetchImpl: async (url) => {
      proxiedUrl = url;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const apiRes = createResponse();
  await runtime.handleRequest(createReq('/admin/api/platform/overview'), apiRes);
  assert.equal(apiRes.statusCode, 200);
  assert.equal(proxiedUrl, 'http://127.0.0.1:3200/owner/api/platform/overview');
  assert.match(String(apiRes.headers['content-type'] || ''), /application\/json/i);
});

test('standalone surface returns 502 json when upstream control plane is unavailable', async () => {
  const fixture = createFixtureRoot();
  const runtime = createAdminStandaloneSurfaceRuntime({
    surface: 'owner',
    host: '127.0.0.1',
    port: 3201,
    adminBaseUrl: 'http://127.0.0.1:3200',
    ownerBaseUrl: 'http://127.0.0.1:3201',
    tenantBaseUrl: 'http://127.0.0.1:3202',
    playerBaseUrl: 'http://127.0.0.1:3300',
    assetsDirPath: fixture.assetsDir,
    scumItemsDirPath: fixture.scumItemsDir,
    loginHtmlPath: path.join(fixture.root, 'login.html'),
    tenantLoginHtmlPath: path.join(fixture.root, 'tenant-login.html'),
    ownerConsoleHtmlPath: path.join(fixture.root, 'owner-console.html'),
    tenantConsoleHtmlPath: path.join(fixture.root, 'tenant-console.html'),
    fetchImpl: async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:3200');
    },
  });

  const apiRes = createResponse();
  await runtime.handleRequest(createReq('/owner/api/platform/overview'), apiRes);
  assert.equal(apiRes.statusCode, 502);
  assert.match(String(apiRes.headers['content-type'] || apiRes.headers['Content-Type'] || ''), /application\/json/i);
  const payload = JSON.parse(apiRes.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'surface_upstream_unavailable');
  assert.equal(payload.data.surface, 'owner');
});
