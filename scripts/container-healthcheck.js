'use strict';

function normalizeLoopbackHost(host) {
  const value = String(host || '').trim() || '127.0.0.1';
  if (value === '0.0.0.0' || value === '::') return '127.0.0.1';
  return value;
}

function asPort(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const port = Math.trunc(parsed);
  if (port <= 0 || port > 65535) return 0;
  return port;
}

function resolveHealthUrl(role) {
  switch (role) {
    case 'bot':
      return `http://${normalizeLoopbackHost(process.env.BOT_HEALTH_HOST)}:${asPort(process.env.BOT_HEALTH_PORT)}/healthz`;
    case 'worker':
      return `http://${normalizeLoopbackHost(process.env.WORKER_HEALTH_HOST)}:${asPort(process.env.WORKER_HEALTH_PORT)}/healthz`;
    case 'watcher':
      return `http://${normalizeLoopbackHost(process.env.SCUM_WATCHER_HEALTH_HOST)}:${asPort(process.env.SCUM_WATCHER_HEALTH_PORT)}/healthz`;
    case 'web':
      return `http://${normalizeLoopbackHost(process.env.WEB_PORTAL_HOST)}:${asPort(process.env.WEB_PORTAL_PORT)}/healthz`;
    case 'console-agent':
      return `http://${normalizeLoopbackHost(process.env.SCUM_CONSOLE_AGENT_HOST)}:${asPort(process.env.SCUM_CONSOLE_AGENT_PORT)}/healthz`;
    case 'migrate':
      return null;
    default:
      return null;
  }
}

async function main() {
  const role = String(process.env.APP_ROLE || process.argv[2] || 'bot').trim().toLowerCase() || 'bot';
  const url = resolveHealthUrl(role);
  if (!url) {
    process.exit(0);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload || payload.ok !== true) {
      process.exit(1);
    }
    process.exit(0);
  } catch {
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

void main();
