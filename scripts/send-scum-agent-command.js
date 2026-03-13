'use strict';

require('dotenv').config();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--command' || token === '-c') {
      out.command = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (token === '--url') {
      out.url = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (token === '--token') {
      out.token = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = String(args.command || '').trim();
  if (!command) {
    throw new Error('Usage: node scripts/send-scum-agent-command.js --command "#ListPlayers"');
  }

  const baseUrl =
    String(args.url || process.env.SCUM_CONSOLE_AGENT_BASE_URL || '').trim()
    || `http://${String(process.env.SCUM_CONSOLE_AGENT_HOST || '127.0.0.1').trim()}:${Math.max(
      1,
      Math.trunc(Number(process.env.SCUM_CONSOLE_AGENT_PORT || 3213)),
    )}`;
  const token = String(args.token || process.env.SCUM_CONSOLE_AGENT_TOKEN || '').trim();
  if (!token) {
    throw new Error('SCUM_CONSOLE_AGENT_TOKEN is required');
  }

  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ command }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Agent request failed with status ${res.status}`);
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
