const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Writable } = require('node:stream');

const {
  createAdminRequestHandler,
} = require('../src/admin/runtime/adminServerRuntime');

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
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.writeHead = (statusCode, headers = {}) => {
    res.statusCode = statusCode;
    res.headers = { ...res.headers, ...headers };
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

function buildHandler(overrides = {}) {
  const calls = {
    getPath: null,
    mutationPath: null,
  };
  const handler = createAdminRequestHandler({
    crypto,
    client: null,
    host: '127.0.0.1',
    port: 3200,
    allowedOrigins: [],
    setRequestMeta(req, patch) {
      req.__adminRequestMeta = {
        ...(req.__adminRequestMeta || {}),
        ...patch,
      };
    },
    deriveRouteGroup(pathname) {
      return pathname;
    },
    getClientIp() {
      return '127.0.0.1';
    },
    getRequestOrigin() {
      return 'http://127.0.0.1:3200';
    },
    recordAdminRequestLog() {},
    async handleAdminPublicRoute() {
      return false;
    },
    hasValidSession() {
      return false;
    },
    isSafeHttpMethod(method) {
      return String(method || 'GET').toUpperCase() === 'GET';
    },
    violatesBrowserOriginPolicy() {
      return false;
    },
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    getAuthContext: () => overrides.auth || null,
    buildClearSessionCookie() {
      return 'scum_admin_session=; Max-Age=0';
    },
    invalidateSession(sessionId) {
      calls.invalidatedSessionId = sessionId;
    },
    async readJsonBody() {
      return overrides.body || {};
    },
    async handleAdminAuthPostRoute(context) {
      if (typeof overrides.handleAdminAuthPostRoute === 'function') {
        return overrides.handleAdminAuthPostRoute(context);
      }
      return false;
    },
    shouldBypassRestoreMaintenance() {
      return false;
    },
    isAdminRestoreMaintenanceActive() {
      return false;
    },
    sendRestoreMaintenanceUnavailable(res) {
      res.writeHead(503);
      res.end('maintenance');
    },
    async handleAdminAuditRoute() {
      return false;
    },
    async handleAdminGetRoute({ pathname, res }) {
      calls.getPath = pathname;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: pathname }));
      return true;
    },
    getAdminPermissionForPath() {
      return { minRole: 'owner' };
    },
    requiredRoleForPostPath() {
      return 'owner';
    },
    ensureRole(_req, _urlObj, _minRole, _res) {
      return overrides.auth || null;
    },
    ensureStepUpAuth(_req, _res, auth) {
      return auth;
    },
    async handleMutationAction(_client, _req, _urlObj, pathname, _body, res) {
      calls.mutationPath = pathname;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: pathname }));
      return undefined;
    },
    publishAdminLiveUpdate() {},
    sendText(res, statusCode, text) {
      res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(text);
    },
    resolveTenantSessionAccessContext: overrides.resolveTenantSessionAccessContext,
    resolveAdminSessionAccessContext: overrides.resolveAdminSessionAccessContext,
  });

  return {
    handler,
    calls,
  };
}

test('tenant-scoped auth cannot call owner surface API', async () => {
  const { handler, calls } = buildHandler({
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });
  const res = createResponse();

  await handler(createReq('/owner/api/platform/overview'), res);

  assert.equal(res.statusCode, 403);
  assert.equal(calls.getPath, null);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, 'surface-access-denied');
  assert.equal(payload.data.surface, 'owner');
});

test('platform owner auth cannot call tenant surface API without tenant scope', async () => {
  const { handler, calls } = buildHandler({
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });
  const res = createResponse();

  await handler(createReq('/tenant/api/platform/overview'), res);

  assert.equal(res.statusCode, 403);
  assert.equal(calls.getPath, null);
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, 'surface-access-denied');
  assert.equal(payload.data.surface, 'tenant');
});

test('tenant-scoped auth can call tenant surface API and it normalizes to admin API internally', async () => {
  const { handler, calls } = buildHandler({
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });
  const res = createResponse();

  await handler(createReq('/tenant/api/platform/overview'), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.getPath, '/admin/api/platform/overview');
});

test('platform owner auth can call owner surface mutations and they normalize to admin API internally', async () => {
  const { handler, calls } = buildHandler({
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });
  const res = createResponse();

  await handler(createReq('/owner/api/platform/tenant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantName: 'Example' }),
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.mutationPath, '/admin/api/platform/tenant');
});

test('owner surface login is allowed without an existing owner session', async () => {
  const { handler } = buildHandler({
    auth: null,
    body: {
      username: 'owner-user',
      password: 'secret',
    },
    async handleAdminAuthPostRoute({ pathname, body, res }) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        path: pathname,
        data: {
          role: 'owner',
          username: body.username,
        },
      }));
      return true;
    },
  });
  const res = createResponse();

  await handler(createReq('/owner/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner-user', password: 'secret' }),
  }), res);

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.path, '/admin/api/login');
  assert.equal(payload.data.role, 'owner');
});

test('owner surface me request reaches the admin me handler without an existing session', async () => {
  const { handler, calls } = buildHandler({
    auth: null,
  });
  const res = createResponse();

  await handler(createReq('/owner/api/me'), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.getPath, '/admin/api/me');
});

test('tenant surface me request reaches the admin me handler without an existing session', async () => {
  const { handler, calls } = buildHandler({
    auth: null,
  });
  const res = createResponse();

  await handler(createReq('/tenant/api/me'), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.getPath, '/admin/api/me');
});

test('tenant API rejects stale tenant session when membership revalidation fails', async () => {
  const { handler, calls } = buildHandler({
    auth: {
      mode: 'session',
      sessionId: 'session-tenant-1',
      user: 'tenant-admin@example.com',
      userId: 'platform-user-1',
      primaryEmail: 'tenant-admin@example.com',
      role: 'admin',
      tenantId: 'tenant-1',
      authMethod: 'platform-user-password',
    },
    resolveTenantSessionAccessContext: async () => ({
      ok: false,
      reason: 'tenant-membership-inactive',
    }),
  });
  const res = createResponse();

  await handler(createReq('/tenant/api/platform/overview'), res);

  assert.equal(res.statusCode, 401);
  assert.equal(calls.getPath, null);
  assert.equal(calls.invalidatedSessionId, 'session-tenant-1');
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, 'tenant-membership-inactive');
});

test('owner API rejects stale platform admin session when the account becomes inactive', async () => {
  const { handler, calls } = buildHandler({
    auth: {
      mode: 'session',
      sessionId: 'session-owner-1',
      user: 'owner-runtime',
      role: 'owner',
      tenantId: null,
      authMethod: 'password-db',
    },
    resolveAdminSessionAccessContext: async () => ({
      ok: false,
      reason: 'admin-user-inactive',
    }),
  });
  const res = createResponse();

  await handler(createReq('/owner/api/platform/overview'), res);

  assert.equal(res.statusCode, 401);
  assert.equal(calls.getPath, null);
  assert.equal(calls.invalidatedSessionId, 'session-owner-1');
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
  const payload = JSON.parse(res.body);
  assert.equal(payload.error, 'admin-user-inactive');
});
