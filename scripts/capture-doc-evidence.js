'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function resolveEdgePath() {
  for (const candidate of EDGE_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Microsoft Edge was not found in the default install paths');
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'scum-doc-capture/1.0' },
      });
      if (res.status > 0) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function captureScreenshot(edgePath, url, outputPath, options = {}) {
  const virtualTimeBudgetMs = Math.max(1000, Number(options.virtualTimeBudgetMs || 5000));
  return new Promise((resolve, reject) => {
    const child = spawn(edgePath, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--run-all-compositor-stages-before-draw',
      `--virtual-time-budget=${virtualTimeBudgetMs}`,
      '--window-size=1600,1200',
      `--screenshot=${outputPath}`,
      url,
    ], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    child.on('exit', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve();
        return;
      }
      reject(new Error(`Edge screenshot failed for ${url} (exit ${code})`));
    });
    child.on('error', reject);
  });
}

function tryBuildDemoGif(outputDir) {
  if (process.platform !== 'win32') return false;
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'build-doc-demo-gif.ps1');
  if (!fs.existsSync(scriptPath)) return false;
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-OutputPath',
    path.join(outputDir, 'platform-demo.gif'),
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status === 0) return true;
  console.warn('[capture-doc-evidence] demo GIF build skipped:', String(result.stderr || result.stdout || '').trim());
  return false;
}

async function main() {
  const { merged } = loadMergedEnvFiles({
    basePath: path.resolve(process.cwd(), '.env'),
    overlayPath: path.resolve(process.cwd(), 'apps', 'web-portal-standalone', '.env'),
    overrideExisting: true,
  });

  const edgePath = resolveEdgePath();
  const outputDir = path.resolve(process.cwd(), 'docs', 'assets');
  fs.mkdirSync(outputDir, { recursive: true });

  const [adminPort, playerPort] = await Promise.all([getFreePort(), getFreePort()]);

  process.env.NODE_ENV = 'capture';
  process.env.DATABASE_URL = String(process.env.DATABASE_URL || merged.DATABASE_URL || '').trim();
  process.env.DATABASE_PROVIDER = String(
    process.env.DATABASE_PROVIDER || merged.DATABASE_PROVIDER || 'postgresql',
  ).trim();
  process.env.PRISMA_SCHEMA_PROVIDER = String(
    process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || 'postgresql',
  ).trim();
  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(adminPort);
  process.env.ADMIN_WEB_USER = process.env.ADMIN_WEB_USER || 'capture_admin';
  process.env.ADMIN_WEB_PASSWORD = process.env.ADMIN_WEB_PASSWORD || 'capture_password';
  process.env.ADMIN_WEB_TOKEN = process.env.ADMIN_WEB_TOKEN || 'capture_token';
  process.env.ADMIN_WEB_ALLOW_TOKEN_QUERY = 'true';
  process.env.ADMIN_WEB_SSO_DISCORD_ENABLED = 'false';
  process.env.ADMIN_WEB_2FA_ENABLED = 'false';
  process.env.ADMIN_WEB_SECURE_COOKIE = 'false';
  process.env.ADMIN_WEB_HSTS_ENABLED = 'false';
  process.env.ADMIN_WEB_ALLOWED_ORIGINS = '';
  process.env.WEB_PORTAL_HOST = '127.0.0.1';
  process.env.WEB_PORTAL_PORT = String(playerPort);
  process.env.WEB_PORTAL_BASE_URL = `http://127.0.0.1:${playerPort}`;
  process.env.WEB_PORTAL_LEGACY_ADMIN_URL = `http://127.0.0.1:${adminPort}/admin`;
  process.env.WEB_PORTAL_PLAYER_OPEN_ACCESS = 'true';
  process.env.WEB_PORTAL_SECURE_COOKIE = 'false';
  process.env.WEB_PORTAL_CAPTURE_TOKEN = process.env.WEB_PORTAL_CAPTURE_TOKEN || 'capture_portal_token';
  process.env.WEB_PORTAL_DISCORD_CLIENT_ID =
    process.env.WEB_PORTAL_DISCORD_CLIENT_ID || 'capture_portal_client_id';
  process.env.WEB_PORTAL_DISCORD_CLIENT_SECRET =
    process.env.WEB_PORTAL_DISCORD_CLIENT_SECRET || 'capture_portal_client_secret';

  const childEnv = {
    ...process.env,
    NODE_ENV: 'capture',
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
    PRISMA_SCHEMA_PROVIDER: process.env.PRISMA_SCHEMA_PROVIDER,
  };

  const fakeClient = {
    guilds: { cache: new Map() },
    channels: { fetch: async () => null },
  };

  const { startAdminWebServer } = require(path.resolve(process.cwd(), 'src', 'adminWebServer.js'));
  const adminServer = startAdminWebServer(fakeClient);
  if (!adminServer.listening) {
    await once(adminServer, 'listening');
  }

  const portalChild = spawn(
    process.execPath,
    [path.resolve(process.cwd(), 'apps', 'web-portal-standalone', 'server.js')],
    {
      cwd: process.cwd(),
      env: childEnv,
      stdio: 'ignore',
    },
  );

  try {
    await Promise.all([
      waitForHttp(`http://127.0.0.1:${adminPort}/admin/healthz`),
      waitForHttp(`http://127.0.0.1:${playerPort}/healthz`),
    ]);

    await captureScreenshot(
      edgePath,
      `http://127.0.0.1:${adminPort}/admin/login`,
      path.join(outputDir, 'admin-login.png'),
      { virtualTimeBudgetMs: 2500 },
    );
    await captureScreenshot(
      edgePath,
      `http://127.0.0.1:${adminPort}/admin?token=${encodeURIComponent(process.env.ADMIN_WEB_TOKEN)}`,
      path.join(outputDir, 'admin-dashboard.png'),
      { virtualTimeBudgetMs: 7000 },
    );
    await captureScreenshot(
      edgePath,
      `http://127.0.0.1:${playerPort}/`,
      path.join(outputDir, 'player-landing.png'),
      { virtualTimeBudgetMs: 4000 },
    );
    await captureScreenshot(
      edgePath,
      `http://127.0.0.1:${playerPort}/player/login`,
      path.join(outputDir, 'player-login.png'),
      { virtualTimeBudgetMs: 2500 },
    );
    await captureScreenshot(
      edgePath,
      `http://127.0.0.1:${playerPort}/player/capture-auth?token=${encodeURIComponent(process.env.WEB_PORTAL_CAPTURE_TOKEN)}`,
      path.join(outputDir, 'player-dashboard.png'),
      { virtualTimeBudgetMs: 7000 },
    );
    await captureScreenshot(
      edgePath,
      `http://127.0.0.1:${playerPort}/showcase`,
      path.join(outputDir, 'player-showcase.png'),
      { virtualTimeBudgetMs: 4000 },
    );
    tryBuildDemoGif(outputDir);

    console.log('[capture-doc-evidence] wrote admin/player screenshots to docs/assets');
  } finally {
    if (!portalChild.killed) {
      portalChild.kill('SIGTERM');
    }
    await new Promise((resolve) => {
      portalChild.once('exit', () => resolve());
      setTimeout(resolve, 3000).unref?.();
    });
    await new Promise((resolve) => adminServer.close(resolve));
  }
}

main().catch((error) => {
  console.error('[capture-doc-evidence] failed:', error.message);
  process.exit(1);
});
