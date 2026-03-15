'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const APP_ROOT = process.cwd();
const role = String(process.argv[2] || process.env.APP_ROLE || 'bot').trim().toLowerCase() || 'bot';

function resolveRoleCommand(appRole) {
  const prismaBin = path.join(APP_ROOT, 'node_modules', '.bin', 'prisma');
  switch (appRole) {
    case 'bot':
      return {
        command: process.execPath,
        args: [path.join(APP_ROOT, 'src', 'bot.js')],
      };
    case 'worker':
      return {
        command: process.execPath,
        args: [path.join(APP_ROOT, 'src', 'worker.js')],
      };
    case 'watcher':
      return {
        command: process.execPath,
        args: [path.join(APP_ROOT, 'src', 'services', 'scumLogWatcherRuntime.js')],
      };
    case 'web':
      return {
        command: process.execPath,
        args: [path.join(APP_ROOT, 'apps', 'web-portal-standalone', 'server.js')],
      };
    case 'console-agent':
      return {
        command: process.execPath,
        args: [path.join(APP_ROOT, 'src', 'scum-console-agent.js')],
      };
    case 'migrate':
      return {
        command: prismaBin,
        args: ['migrate', 'deploy'],
      };
    default:
      throw new Error(`unsupported APP_ROLE: ${appRole}`);
  }
}

function main() {
  const target = resolveRoleCommand(role);
  const child = spawn(target.command, target.args, {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      APP_ROLE: role,
    },
    stdio: 'inherit',
    shell: false,
  });

  const forward = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.once('SIGINT', () => forward('SIGINT'));
  process.once('SIGTERM', () => forward('SIGTERM'));
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
