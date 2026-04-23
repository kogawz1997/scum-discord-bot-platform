'use strict';

const { spawnSync } = require('node:child_process');
const {
  createValidationCheck,
  createValidationReport,
} = require('../src/utils/runtimeStatus');

const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';
const isProduction = args.has('--production');
const withAudit = args.has('--with-audit');
const skipSmoke = args.has('--skip-smoke');
const asJson = args.has('--json');

if (args.has('--help') || args.has('-h')) {
  console.log('Usage: node scripts/readiness-gate.js [--production] [--with-audit] [--skip-smoke]');
  console.log('');
  console.log('Runs readiness checks in sequence and exits non-zero on first failure.');
  console.log('');
  console.log('Options:');
  console.log('  --production  Include production doctor checks');
  console.log('  --with-audit  Include npm audit --omit=dev');
  console.log('  --skip-smoke  Skip post-deploy smoke checks in production mode');
  process.exit(0);
}

function runStep(label, command, commandArgs, options = {}) {
  if (!options.quiet) {
    console.log(`\n[readiness] ${label}`);
  }
  const result = spawnSync(command, commandArgs, {
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
    encoding: options.capture ? 'utf8' : undefined,
    maxBuffer: options.capture ? 32 * 1024 * 1024 : undefined,
  });
  return result;
}

function runNpm(commandArgs, options = {}) {
  if (isWindows) {
    return runStep(`npm ${commandArgs.join(' ')}`, 'cmd', ['/c', 'npm', ...commandArgs], options);
  }
  return runStep(`npm ${commandArgs.join(' ')}`, 'npm', commandArgs, options);
}

function buildScriptSequence(options = {}) {
  const scripts = [
    'lint',
    'test:policy',
    'security:check',
    'doctor',
    'doctor:topology',
    'doctor:web-standalone',
  ];
  if (options.isProduction) {
    scripts.push('doctor:topology:prod');
    scripts.push('doctor:web-standalone:prod');
    scripts.push('smoke:persistence');
    if (!options.skipSmoke) {
      scripts.push('smoke:postdeploy');
    }
  }
  return scripts;
}

function extractStepDetail(result) {
  if (result?.error) {
    return String(result.error.message || result.error);
  }
  const lines = String(result?.stderr || result?.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  const preferred = lines.findLast((line) => (
    /\bPASS\b/i.test(line)
    || /\bFAILED\b/i.test(line)
    || /\bERROR\b/i.test(line)
    || /\bWARN\b/i.test(line)
    || /SECURITY_CHECK:/i.test(line)
    || /WEB_PORTAL_DOCTOR:/i.test(line)
    || /^\[smoke\]/i.test(line)
    || /^\[topology\]/i.test(line)
    || /^OK:/i.test(line)
  ));
  if (preferred) {
    return preferred;
  }
  if (result?.status === 0) {
    return 'step completed';
  }
  return lines.at(-1) || '';
}

function buildReadinessReport(stepResults, options = {}) {
  return createValidationReport({
    kind: 'readiness',
    checks: stepResults.map((entry) => createValidationCheck(entry.name, {
      ok: entry.ok,
      detail: entry.detail || '',
      data: {
        exitCode: entry.exitCode,
      },
    })),
    warnings: [],
    errors: stepResults
      .filter((entry) => !entry.ok)
      .map((entry) => `${entry.name} failed${entry.detail ? `: ${entry.detail}` : ''}`),
    data: {
      production: options.isProduction === true,
      withAudit: options.withAudit === true,
      skipSmoke: options.skipSmoke === true,
      sequence: stepResults.map((entry) => entry.script),
    },
  });
}

function main() {
  const scripts = buildScriptSequence({
    isProduction,
    skipSmoke,
  });
  const stepResults = [];

  for (const scriptName of scripts) {
    const result = runNpm(['run', scriptName], { capture: asJson, quiet: asJson });
    const entry = {
      name: scriptName,
      script: scriptName,
      ok: result.status === 0,
      exitCode: result.status || 0,
      detail: '',
    };
    if (asJson) {
      entry.detail = extractStepDetail(result);
    }
    stepResults.push(entry);
    if (result.status !== 0) {
      if (!asJson) {
        console.error(`[readiness] FAILED at: npm run ${scriptName}`);
        process.exit(result.status || 1);
      }
      const report = buildReadinessReport(stepResults, {
        isProduction,
        withAudit,
        skipSmoke,
      });
      console.log(JSON.stringify(report, null, 2));
      process.exit(result.status || 1);
    }
  }

  if (withAudit) {
    const result = runNpm(['audit', '--omit=dev'], { capture: asJson, quiet: asJson });
    const entry = {
      name: 'audit',
      script: 'npm audit --omit=dev',
      ok: result.status === 0,
      exitCode: result.status || 0,
      detail: asJson ? extractStepDetail(result) : '',
    };
    stepResults.push(entry);
    if (result.status !== 0) {
      if (!asJson) {
        console.error('[readiness] FAILED at: npm audit --omit=dev');
        process.exit(result.status || 1);
      }
      const report = buildReadinessReport(stepResults, {
        isProduction,
        withAudit,
        skipSmoke,
      });
      console.log(JSON.stringify(report, null, 2));
      process.exit(result.status || 1);
    }
  }

  const report = buildReadinessReport(stepResults, {
    isProduction,
    withAudit,
    skipSmoke,
  });
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n[readiness] PASS');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReadinessReport,
  buildScriptSequence,
  extractStepDetail,
};
