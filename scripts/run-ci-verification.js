'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseEnvFile, mergeEnvMaps } = require('../src/utils/loadEnvFiles');

const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts', 'ci');
const IS_WINDOWS = process.platform === 'win32';
const GENERATED_SCHEMA_PATH = path.join(
  process.cwd(),
  'node_modules',
  '.prisma',
  'client',
  'schema.prisma',
);
const CHILD_MAX_BUFFER_BYTES = 32 * 1024 * 1024;

const DEFAULT_STEPS = [
  { id: 'lint', label: 'Lint', command: ['run', 'lint'] },
  { id: 'test', label: 'Test', command: ['test'] },
  { id: 'doctor', label: 'Doctor', command: ['run', 'doctor'] },
  { id: 'doctor-topology', label: 'Topology Doctor', command: ['run', 'doctor:topology'] },
  { id: 'security-check', label: 'Security Check', command: ['run', 'security:check'] },
  { id: 'readiness', label: 'Readiness', command: ['run', 'readiness:full'] },
  { id: 'smoke', label: 'Local Smoke', command: ['run', 'smoke:local-ci'] },
];

const JSON_REPORT_COMMANDS = {
  doctor: ['node', 'scripts/doctor.js', '--json'],
  'doctor-topology': ['node', 'scripts/doctor-topology.js', '--json'],
  'security-check': ['node', 'scripts/security-check.js', '--json'],
  readiness: ['node', 'scripts/readiness-gate.js', '--json'],
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readGeneratedProvider() {
  if (!fs.existsSync(GENERATED_SCHEMA_PATH)) {
    return String(process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || 'sqlite')
      .trim()
      .toLowerCase();
  }
  const text = fs.readFileSync(GENERATED_SCHEMA_PATH, 'utf8');
  const match = text.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/m);
  return String(match?.[1] || process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || 'sqlite')
    .trim()
    .toLowerCase();
}

function buildVerificationEnv() {
  const rootBase = parseEnvFile(path.resolve(process.cwd(), '.env.example'));
  const rootOverlay = parseEnvFile(path.resolve(process.cwd(), '.env.test.example'));
  const rootCurrent = parseEnvFile(path.resolve(process.cwd(), '.env'));
  const portalBase = parseEnvFile(
    path.resolve(process.cwd(), 'apps', 'web-portal-standalone', '.env.example'),
  );
  const portalOverlay = parseEnvFile(
    path.resolve(process.cwd(), 'apps', 'web-portal-standalone', '.env.test.example'),
  );
  const provider = readGeneratedProvider();
  const mergedRoot = mergeEnvMaps(rootBase, rootOverlay);
  if (provider === 'postgresql' && /^postgres(?:ql)?:\/\//i.test(String(rootCurrent.DATABASE_URL || '').trim())) {
    mergedRoot.DATABASE_URL = String(rootCurrent.DATABASE_URL || '').trim();
    mergedRoot.DATABASE_PROVIDER = 'postgresql';
    mergedRoot.PRISMA_SCHEMA_PROVIDER = 'postgresql';
  }
  return {
    ...process.env,
    ...mergedRoot,
    ...mergeEnvMaps(portalBase, portalOverlay),
    CI: 'true',
    NODE_ENV: 'test',
    BOT_ENABLE_RENTBIKE_SERVICE: 'false',
    BOT_ENABLE_DELIVERY_WORKER: 'false',
    WORKER_ENABLE_RENTBIKE: 'true',
    WORKER_ENABLE_DELIVERY: 'true',
  };
}

function runNpmStep(step) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const command = IS_WINDOWS ? 'cmd' : 'npm';
  const commandArgs = IS_WINDOWS ? ['/c', 'npm', ...step.command] : step.command;
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    env: buildVerificationEnv(),
    maxBuffer: CHILD_MAX_BUFFER_BYTES,
  });
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - started;
  const logFile = path.join(ARTIFACT_DIR, `${step.id}.log`);
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const displayCommand = `${IS_WINDOWS ? 'cmd /c npm' : 'npm'} ${step.command.join(' ')}`;
  fs.writeFileSync(
    logFile,
    [
      `$ ${displayCommand}`,
      '',
      stdout.trimEnd(),
      stderr ? `\n${stderr.trimEnd()}` : '',
      '',
    ].join('\n'),
    'utf8',
  );
  return {
    id: step.id,
    label: step.label,
    command: displayCommand,
    startedAt,
    finishedAt,
    durationMs,
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    status: result.status === 0 ? 'passed' : 'failed',
    logFile: path.relative(process.cwd(), logFile).replace(/\\/g, '/'),
  };
}

function runJsonReport(step) {
  const commandArgs = JSON_REPORT_COMMANDS[step.id];
  if (!commandArgs) return null;
  const command = commandArgs[0];
  const args = commandArgs.slice(1);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    env: buildVerificationEnv(),
    maxBuffer: CHILD_MAX_BUFFER_BYTES,
  });
  if (result.status !== 0) {
    throw new Error(`JSON report failed for ${step.id}: ${String(result.stderr || result.stdout || '').trim()}`);
  }
  const targetPath = path.join(ARTIFACT_DIR, `${step.id}.json`);
  fs.writeFileSync(targetPath, `${String(result.stdout || '').trim()}\n`, 'utf8');
  const report = JSON.parse(String(result.stdout || '').trim());
  return {
    path: path.relative(process.cwd(), targetPath).replace(/\\/g, '/'),
    report,
  };
}

function writeSummary(results) {
  const contractSummary = results
    .filter((entry) => entry.contract && typeof entry.contract === 'object')
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      kind: entry.contract.kind || null,
      status: entry.contract.status || null,
      ok: entry.contract.ok !== false,
      summary: entry.contract.summary || '',
      checkCount: Number(entry.contract.checkCount || 0),
      warningCount: Number(entry.contract.warningCount || 0),
      errorCount: Number(entry.contract.errorCount || 0),
      jsonReport: entry.jsonReport || null,
    }));
  const summary = {
    generatedAt: new Date().toISOString(),
    envProfile: 'test-ci',
    packageName: (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
        return pkg.name || null;
      } catch {
        return null;
      }
    })(),
    nodeVersion: process.version,
    status: results.every((entry) => entry.status === 'passed') ? 'passed' : 'failed',
    steps: results,
    contractSummary,
  };
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'verification-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  const lines = [
    '# Verification Summary',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Env Profile: ${summary.envProfile}`,
    `- Package: ${summary.packageName || '-'}`,
    `- Node: ${summary.nodeVersion}`,
    `- Overall: ${summary.status.toUpperCase()}`,
    '',
    '| Step | Status | Duration (ms) | Log | JSON | Contract |',
    '| --- | --- | ---: | --- | --- | --- |',
    ...results.map((entry) =>
      `| ${entry.label} | ${entry.status} | ${entry.durationMs} | ${entry.logFile} | ${entry.jsonReport || '-'} | ${entry.contract ? `${entry.contract.status || '-'} / ${entry.contract.warningCount || 0}w / ${entry.contract.errorCount || 0}e` : '-'} |`),
    '',
  ];
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'verification-contract.json'),
    `${JSON.stringify({
      generatedAt: summary.generatedAt,
      status: summary.status,
      steps: contractSummary,
    }, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'verification-summary.md'),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  return summary;
}

function main() {
  ensureDir(ARTIFACT_DIR);
  const results = [];
  for (const step of DEFAULT_STEPS) {
    console.log(`[ci-verify] ${step.label}`);
    const result = runNpmStep(step);
    const jsonReport = result.status === 'passed' ? runJsonReport(step) : null;
    if (jsonReport) {
      result.jsonReport = jsonReport.path;
      result.contract = {
        kind: String(jsonReport.report?.kind || '').trim() || null,
        status: String(jsonReport.report?.status || '').trim() || null,
        ok: jsonReport.report?.ok !== false,
        summary: String(jsonReport.report?.summary || '').trim(),
        checkCount: Array.isArray(jsonReport.report?.checks) ? jsonReport.report.checks.length : 0,
        warningCount: Array.isArray(jsonReport.report?.warnings) ? jsonReport.report.warnings.length : 0,
        errorCount: Array.isArray(jsonReport.report?.errors) ? jsonReport.report.errors.length : 0,
      };
    }
    results.push(result);
    if (result.status !== 'passed') {
      break;
    }
  }
  const summary = writeSummary(results);
  if (summary.status !== 'passed') {
    process.exit(1);
  }
}

main();
