'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_ENV_PATH = path.resolve(process.cwd(), '.env');
const PORTAL_ENV_PATH = path.resolve(
  process.cwd(),
  'apps',
  'web-portal-standalone',
  '.env',
);

function parseArgs(argv) {
  const out = {
    write: false,
    forceDiscordPlaceholder: false,
    discordToken: '',
    portalDiscordClientSecret: '',
    adminSsoDiscordClientSecret: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--write') out.write = true;
    if (token === '--force-discord-placeholder') {
      out.forceDiscordPlaceholder = true;
      continue;
    }
    if (token.startsWith('--discord-token=')) {
      out.discordToken = token.slice('--discord-token='.length);
      continue;
    }
    if (token.startsWith('--portal-discord-secret=')) {
      out.portalDiscordClientSecret = token.slice(
        '--portal-discord-secret='.length,
      );
      continue;
    }
    if (token.startsWith('--admin-sso-discord-secret=')) {
      out.adminSsoDiscordClientSecret = token.slice(
        '--admin-sso-discord-secret='.length,
      );
      continue;
    }
    if (token === '--discord-token' && argv[i + 1]) {
      out.discordToken = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--portal-discord-secret' && argv[i + 1]) {
      out.portalDiscordClientSecret = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--admin-sso-discord-secret' && argv[i + 1]) {
      out.adminSsoDiscordClientSecret = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`env file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split(/\r?\n/);
}

function isEnvPair(line) {
  return /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line);
}

function setEnvValue(lines, key, value) {
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => {
    if (!isEnvPair(line)) return false;
    const left = line.split('=')[0].trim();
    return left === key;
  });
  if (index >= 0) {
    lines[index] = `${prefix}${value}`;
  } else {
    lines.push(`${prefix}${value}`);
  }
}

function getEnvValue(lines, key) {
  const row = lines.find((line) => {
    if (!isEnvPair(line)) return false;
    return line.split('=')[0].trim() === key;
  });
  if (!row) return '';
  const index = row.indexOf('=');
  if (index < 0) return '';
  return row.slice(index + 1).trim();
}

function isLikelyPlaceholder(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  const patterns = [
    'your_',
    'example',
    'changeme',
    'replace',
    'rotate_in_',
    'rotate_me',
    'token_here',
    'password_here',
    'put_a_',
    'placeholder',
    'xxx',
  ];
  return patterns.some((pattern) => text.includes(pattern));
}

function applyRootProduction(lines, options) {
  setEnvValue(lines, 'NODE_ENV', 'production');
  setEnvValue(lines, 'PERSIST_REQUIRE_DB', 'true');
  setEnvValue(lines, 'PERSIST_LEGACY_SNAPSHOTS', 'false');

  setEnvValue(lines, 'SCUM_WEBHOOK_SECRET', randomSecret(32));
  setEnvValue(lines, 'ADMIN_WEB_PASSWORD', randomSecret(24));
  setEnvValue(lines, 'ADMIN_WEB_TOKEN', randomSecret(32));
  setEnvValue(lines, 'RCON_PASSWORD', randomSecret(24));

  setEnvValue(lines, 'ADMIN_WEB_SECURE_COOKIE', 'true');
  setEnvValue(lines, 'ADMIN_WEB_HSTS_ENABLED', 'true');
  setEnvValue(lines, 'ADMIN_WEB_ALLOW_TOKEN_QUERY', 'false');
  setEnvValue(lines, 'ADMIN_WEB_ENFORCE_ORIGIN_CHECK', 'true');
  setEnvValue(lines, 'ADMIN_WEB_TRUST_PROXY', 'true');
  setEnvValue(lines, 'ADMIN_WEB_ALLOWED_ORIGINS', 'https://genz.noah-dns.online');

  // Split runtime (bot/web/worker)
  setEnvValue(lines, 'BOT_ENABLE_ADMIN_WEB', 'true');
  setEnvValue(lines, 'BOT_ENABLE_RENTBIKE_SERVICE', 'false');
  setEnvValue(lines, 'BOT_ENABLE_DELIVERY_WORKER', 'false');
  setEnvValue(lines, 'BOT_HEALTH_HOST', '127.0.0.1');
  setEnvValue(lines, 'BOT_HEALTH_PORT', '3210');

  setEnvValue(lines, 'WORKER_ENABLE_RENTBIKE', 'true');
  setEnvValue(lines, 'WORKER_ENABLE_DELIVERY', 'true');
  setEnvValue(lines, 'WORKER_HEALTH_HOST', '127.0.0.1');
  setEnvValue(lines, 'WORKER_HEALTH_PORT', '3211');

  setEnvValue(lines, 'SCUM_WATCHER_HEALTH_HOST', '127.0.0.1');
  setEnvValue(lines, 'SCUM_WATCHER_HEALTH_PORT', '3212');

  if (options.forceDiscordPlaceholder) {
    setEnvValue(lines, 'DISCORD_TOKEN', 'ROTATE_IN_DISCORD_DEVELOPER_PORTAL');
    setEnvValue(
      lines,
      'ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET',
      'ROTATE_IN_DISCORD_DEVELOPER_PORTAL',
    );
    return;
  }

  if (options.discordToken) {
    setEnvValue(lines, 'DISCORD_TOKEN', options.discordToken);
  }
  if (options.adminSsoDiscordClientSecret) {
    setEnvValue(
      lines,
      'ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET',
      options.adminSsoDiscordClientSecret,
    );
  }
}

function applyPortalProduction(lines, options) {
  setEnvValue(lines, 'NODE_ENV', 'production');
  setEnvValue(lines, 'WEB_PORTAL_MODE', 'player');
  setEnvValue(lines, 'WEB_PORTAL_HOST', '0.0.0.0');
  setEnvValue(lines, 'WEB_PORTAL_PORT', '3300');
  setEnvValue(lines, 'WEB_PORTAL_BASE_URL', 'https://genz.noah-dns.online');
  setEnvValue(lines, 'WEB_PORTAL_LEGACY_ADMIN_URL', 'https://genz.noah-dns.online/admin');
  setEnvValue(lines, 'WEB_PORTAL_DISCORD_REDIRECT_PATH', '/auth/discord/callback');
  setEnvValue(lines, 'WEB_PORTAL_SECURE_COOKIE', 'true');
  setEnvValue(lines, 'WEB_PORTAL_ENFORCE_ORIGIN_CHECK', 'true');
  setEnvValue(lines, 'WEB_PORTAL_COOKIE_SAMESITE', 'Lax');

  if (options.forceDiscordPlaceholder) {
    setEnvValue(
      lines,
      'WEB_PORTAL_DISCORD_CLIENT_SECRET',
      'ROTATE_IN_DISCORD_DEVELOPER_PORTAL',
    );
    return;
  }

  if (options.portalDiscordClientSecret) {
    setEnvValue(
      lines,
      'WEB_PORTAL_DISCORD_CLIENT_SECRET',
      options.portalDiscordClientSecret,
    );
  }
}

function writeLines(filePath, lines) {
  const body = `${lines.join('\n').replace(/\n+$/g, '')}\n`;
  fs.writeFileSync(filePath, body, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootLines = readLines(ROOT_ENV_PATH);
  const portalLines = readLines(PORTAL_ENV_PATH);

  applyRootProduction(rootLines, args);
  applyPortalProduction(portalLines, args);

  if (!args.write) {
    console.log('[rotate-production-secrets] dry-run complete');
    console.log('[rotate-production-secrets] use --write to apply changes');
    console.log(
      '[rotate-production-secrets] optional args: --discord-token --portal-discord-secret --admin-sso-discord-secret',
    );
    process.exit(0);
  }

  writeLines(ROOT_ENV_PATH, rootLines);
  writeLines(PORTAL_ENV_PATH, portalLines);

  console.log('[rotate-production-secrets] applied:');
  console.log(`- ${ROOT_ENV_PATH}`);
  console.log(`- ${PORTAL_ENV_PATH}`);

  const rootDiscordToken = getEnvValue(rootLines, 'DISCORD_TOKEN');
  const portalDiscordSecret = getEnvValue(
    portalLines,
    'WEB_PORTAL_DISCORD_CLIENT_SECRET',
  );
  const adminSsoDiscordSecret = getEnvValue(
    rootLines,
    'ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET',
  );

  if (
    args.forceDiscordPlaceholder
    || isLikelyPlaceholder(rootDiscordToken)
    || isLikelyPlaceholder(portalDiscordSecret)
  ) {
    console.log(
      '[rotate-production-secrets] ACTION REQUIRED: set real Discord Bot Token and OAuth Client Secret from Discord Developer Portal.',
    );
  }
  if (adminSsoDiscordSecret && isLikelyPlaceholder(adminSsoDiscordSecret)) {
    console.log(
      '[rotate-production-secrets] ACTION REQUIRED: set ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET or disable ADMIN_WEB_SSO_DISCORD_ENABLED.',
    );
  }
}

main();
