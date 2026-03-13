'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const PORTAL_ENV_PATH = path.join(
  ROOT_DIR,
  'apps',
  'web-portal-standalone',
  '.env',
);

loadMergedEnvFiles({
  basePath: ROOT_ENV_PATH,
  overlayPath: fs.existsSync(PORTAL_ENV_PATH) ? PORTAL_ENV_PATH : null,
});

const args = new Set(process.argv.slice(2));
const isProduction =
  args.has('--production')
  || String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

function isTruthy(value, fallback = false) {
  if (value == null || String(value).trim() === '') return fallback;
  const text = String(value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function readPort(value, fallback = 0) {
  const raw = String(value == null ? fallback : value).trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function pushPort(portMap, errors, port, label) {
  if (!port) return;
  if (!portMap.has(port)) {
    portMap.set(port, [label]);
    return;
  }
  portMap.get(port).push(label);
  errors.push(`Port conflict on ${port}: ${portMap.get(port).join(', ')}`);
}

function main() {
  const env = process.env;
  const errors = [];
  const warnings = [];

  const botAdmin = isTruthy(env.BOT_ENABLE_ADMIN_WEB, true);
  const botWebhook = isTruthy(env.BOT_ENABLE_SCUM_WEBHOOK, true);
  const botRent = isTruthy(env.BOT_ENABLE_RENTBIKE_SERVICE, true);
  const botDelivery = isTruthy(env.BOT_ENABLE_DELIVERY_WORKER, true);

  const workerRent = isTruthy(env.WORKER_ENABLE_RENTBIKE, true);
  const workerDelivery = isTruthy(env.WORKER_ENABLE_DELIVERY, true);

  const workerEnabled = workerRent || workerDelivery;
  const botServiceEnabled = botRent || botDelivery;

  let topology = 'unknown';
  if (botServiceEnabled && !workerEnabled) {
    topology = 'legacy-bot-only';
  } else if (!botServiceEnabled && workerEnabled) {
    topology = 'split-runtime';
  } else if (botServiceEnabled && workerEnabled) {
    topology = 'hybrid-overlap';
  } else {
    topology = 'missing-workers';
  }

  if (botRent && workerRent) {
    errors.push(
      'Duplicate rent bike service detected: BOT_ENABLE_RENTBIKE_SERVICE=true and WORKER_ENABLE_RENTBIKE=true',
    );
  }

  if (botDelivery && workerDelivery) {
    errors.push(
      'Duplicate delivery worker detected: BOT_ENABLE_DELIVERY_WORKER=true and WORKER_ENABLE_DELIVERY=true',
    );
  }

  if (!botRent && !workerRent) {
    warnings.push('No rent bike consumer is enabled in current topology');
  }

  if (!botDelivery && !workerDelivery) {
    warnings.push('No delivery worker is enabled in current topology');
  }

  if (isProduction) {
    if (botRent) {
      errors.push(
        'Production split topology requires BOT_ENABLE_RENTBIKE_SERVICE=false',
      );
    }
    if (botDelivery) {
      errors.push(
        'Production split topology requires BOT_ENABLE_DELIVERY_WORKER=false',
      );
    }
    if (!workerEnabled) {
      errors.push(
        'Production split topology requires worker to enable at least one service',
      );
    }
    if (!botAdmin) {
      errors.push(
        'Production split topology requires BOT_ENABLE_ADMIN_WEB=true',
      );
    }
  }

  const portalMode =
    String(env.WEB_PORTAL_MODE || '').trim().toLowerCase() || 'player';
  const legacyAdminUrl = String(env.WEB_PORTAL_LEGACY_ADMIN_URL || '').trim();
  if (
    portalMode === 'player'
    && legacyAdminUrl
    && /\/admin\/?$/i.test(legacyAdminUrl)
    && /127\.0\.0\.1:3200|localhost:3200/i.test(legacyAdminUrl)
    && !botAdmin
  ) {
    errors.push(
      'WEB_PORTAL_LEGACY_ADMIN_URL points to local admin web but BOT_ENABLE_ADMIN_WEB=false',
    );
  }

  const portMap = new Map();
  pushPort(
    portMap,
    errors,
    botAdmin ? readPort(env.ADMIN_WEB_PORT, 3200) : 0,
    'admin-web',
  );
  pushPort(
    portMap,
    errors,
    botWebhook ? readPort(env.SCUM_WEBHOOK_PORT, 3100) : 0,
    'scum-webhook',
  );
  pushPort(
    portMap,
    errors,
    readPort(env.BOT_HEALTH_PORT, 0),
    'bot-health',
  );
  pushPort(
    portMap,
    errors,
    readPort(env.WORKER_HEALTH_PORT, 0),
    'worker-health',
  );
  pushPort(
    portMap,
    errors,
    readPort(env.SCUM_WATCHER_HEALTH_PORT, 0),
    'watcher-health',
  );
  pushPort(
    portMap,
    errors,
    readPort(env.SCUM_CONSOLE_AGENT_PORT, 0),
    'scum-console-agent',
  );
  pushPort(
    portMap,
    errors,
    readPort(env.WEB_PORTAL_PORT, 3300),
    'player-web',
  );

  const deliveryExecutionMode = String(
    env.DELIVERY_EXECUTION_MODE || 'rcon',
  ).trim().toLowerCase() || 'rcon';
  if (deliveryExecutionMode === 'agent' && !String(env.SCUM_CONSOLE_AGENT_TOKEN || '').trim()) {
    errors.push('DELIVERY_EXECUTION_MODE=agent requires SCUM_CONSOLE_AGENT_TOKEN');
  }

  console.log(`[topology] mode: ${topology}`);
  console.log(
    `[topology] bot(admin=${botAdmin ? 'on' : 'off'}, webhook=${botWebhook ? 'on' : 'off'}, rent=${botRent ? 'on' : 'off'}, delivery=${botDelivery ? 'on' : 'off'})`,
  );
  console.log(
    `[topology] worker(rent=${workerRent ? 'on' : 'off'}, delivery=${workerDelivery ? 'on' : 'off'})`,
  );

  for (const warning of warnings) {
    console.warn(`[topology] WARN: ${warning}`);
  }

  if (errors.length > 0) {
    console.error('[topology] FAILED');
    for (const error of errors) {
      console.error(`[topology] ERROR: ${error}`);
    }
    process.exit(1);
  }

  console.log('[topology] PASS');
}

main();
