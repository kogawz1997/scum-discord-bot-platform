'use strict';

require('dotenv').config();

const http = require('node:http');
const path = require('node:path');

const { loadMergedEnvFiles } = require('../../src/utils/loadEnvFiles');
const {
  createDiscordOnlySurfaceServer,
  isDiscordOnlyMode,
} = require('../../src/config/discordOnlyMode');
const { assertStandaloneSurfaceEnv } = require('../../src/utils/env');
const {
  createAdminStandaloneSurfaceRuntime,
} = require('../../src/admin/runtime/adminStandaloneSurfaceRuntime');

loadMergedEnvFiles({
  basePath: path.resolve(process.cwd(), '.env'),
  overlayPath: path.join(__dirname, '.env'),
});

function startOwnerWebServer() {
  if (isDiscordOnlyMode(process.env)) {
    return createDiscordOnlySurfaceServer({
      surface: 'owner-web',
      env: process.env,
      hostEnvKey: 'OWNER_WEB_HOST',
      portEnvKey: 'OWNER_WEB_PORT',
      defaultHost: '127.0.0.1',
      defaultPort: 3201,
    });
  }

  assertStandaloneSurfaceEnv('owner', process.env);

  const runtime = createAdminStandaloneSurfaceRuntime({
    surface: 'owner',
    host: process.env.OWNER_WEB_HOST || '127.0.0.1',
    port: process.env.OWNER_WEB_PORT || '3201',
    defaultPort: 3201,
    adminBaseUrl: process.env.ADMIN_BACKEND_BASE_URL || `http://${process.env.ADMIN_WEB_HOST || '127.0.0.1'}:${process.env.ADMIN_WEB_PORT || '3200'}`,
    ownerBaseUrl: process.env.OWNER_WEB_BASE_URL || `http://${process.env.OWNER_WEB_HOST || '127.0.0.1'}:${process.env.OWNER_WEB_PORT || '3201'}`,
    tenantBaseUrl: process.env.TENANT_WEB_BASE_URL || `http://${process.env.TENANT_WEB_HOST || '127.0.0.1'}:${process.env.TENANT_WEB_PORT || '3202'}`,
    playerBaseUrl: process.env.WEB_PORTAL_BASE_URL || `http://${process.env.WEB_PORTAL_HOST || '127.0.0.1'}:${process.env.WEB_PORTAL_PORT || '3300'}`,
    loginHtmlPath: path.resolve(__dirname, '../../src/admin/owner-login.html'),
  });

  const server = http.createServer((req, res) => {
    void runtime.handleRequest(req, res);
  });

  server.listen(runtime.port, runtime.host);
  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`[owner-web] port ${runtime.port} is already in use`);
      process.exit(1);
      return;
    }
    console.error('[owner-web] server error:', error);
    process.exit(1);
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  return server;
}

if (require.main === module) {
  startOwnerWebServer();
}

module.exports = {
  startOwnerWebServer,
};
