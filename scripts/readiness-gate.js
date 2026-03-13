'use strict';

const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';
const isProduction = args.has('--production');
const withAudit = args.has('--with-audit');

if (args.has('--help') || args.has('-h')) {
  console.log('Usage: node scripts/readiness-gate.js [--production] [--with-audit]');
  console.log('');
  console.log('Runs readiness checks in sequence and exits non-zero on first failure.');
  console.log('');
  console.log('Options:');
  console.log('  --production  Include production doctor checks');
  console.log('  --with-audit  Include npm audit --omit=dev');
  process.exit(0);
}

function runStep(label, command, commandArgs) {
  console.log(`\n[readiness] ${label}`);
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`[readiness] FAILED at: ${label}`);
    process.exit(result.status || 1);
  }
}

function runNpm(commandArgs) {
  if (isWindows) {
    runStep(`npm ${commandArgs.join(' ')}`, 'cmd', ['/c', 'npm', ...commandArgs]);
    return;
  }
  runStep(`npm ${commandArgs.join(' ')}`, 'npm', commandArgs);
}

function main() {
  const scripts = [
    'check',
    'security:check',
    'doctor',
    'doctor:topology',
    'doctor:web-standalone',
  ];
  if (isProduction) {
    scripts.push('doctor:topology:prod');
    scripts.push('doctor:web-standalone:prod');
  }

  for (const scriptName of scripts) {
    runNpm(['run', scriptName]);
  }

  if (withAudit) {
    runNpm(['audit', '--omit=dev']);
  }

  console.log('\n[readiness] PASS');
}

main();
