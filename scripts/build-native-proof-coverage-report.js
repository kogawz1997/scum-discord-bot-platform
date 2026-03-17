'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REGISTRY_PATH = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-environments.json',
);
const DEFAULT_ITEM_MATRIX_PATH = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-matrix.json',
);
const DEFAULT_WRAPPER_MATRIX_PATH = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-wrapper-matrix.json',
);
const DEFAULT_EXPERIMENTAL_PATH = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-experimental-cases.json',
);
const DEFAULT_JSON_OUT = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-coverage-summary.json',
);
const DEFAULT_MARKDOWN_OUT = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-coverage-summary.md',
);

function trimText(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function resolveFilePath(filePath, fallbackPath) {
  const raw = trimText(filePath, 1000);
  const target = raw || fallbackPath;
  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    registryPath: DEFAULT_REGISTRY_PATH,
    itemMatrixPath: DEFAULT_ITEM_MATRIX_PATH,
    wrapperMatrixPath: DEFAULT_WRAPPER_MATRIX_PATH,
    experimentalPath: DEFAULT_EXPERIMENTAL_PATH,
    jsonOut: DEFAULT_JSON_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const part = trimText(argv[index], 1000);
    if (!part) continue;
    if (part === '--registry' && argv[index + 1]) {
      options.registryPath = resolveFilePath(argv[index + 1], options.registryPath);
      index += 1;
      continue;
    }
    if (part.startsWith('--registry=')) {
      options.registryPath = resolveFilePath(part.slice('--registry='.length), options.registryPath);
      continue;
    }
    if (part === '--item-matrix' && argv[index + 1]) {
      options.itemMatrixPath = resolveFilePath(argv[index + 1], options.itemMatrixPath);
      index += 1;
      continue;
    }
    if (part.startsWith('--item-matrix=')) {
      options.itemMatrixPath = resolveFilePath(
        part.slice('--item-matrix='.length),
        options.itemMatrixPath,
      );
      continue;
    }
    if (part === '--wrapper-matrix' && argv[index + 1]) {
      options.wrapperMatrixPath = resolveFilePath(argv[index + 1], options.wrapperMatrixPath);
      index += 1;
      continue;
    }
    if (part.startsWith('--wrapper-matrix=')) {
      options.wrapperMatrixPath = resolveFilePath(
        part.slice('--wrapper-matrix='.length),
        options.wrapperMatrixPath,
      );
      continue;
    }
    if (part === '--experimental' && argv[index + 1]) {
      options.experimentalPath = resolveFilePath(argv[index + 1], options.experimentalPath);
      index += 1;
      continue;
    }
    if (part.startsWith('--experimental=')) {
      options.experimentalPath = resolveFilePath(
        part.slice('--experimental='.length),
        options.experimentalPath,
      );
      continue;
    }
    if (part === '--json-out' && argv[index + 1]) {
      options.jsonOut = resolveFilePath(argv[index + 1], options.jsonOut);
      index += 1;
      continue;
    }
    if (part.startsWith('--json-out=')) {
      options.jsonOut = resolveFilePath(part.slice('--json-out='.length), options.jsonOut);
      continue;
    }
    if (part === '--markdown-out' && argv[index + 1]) {
      options.markdownOut = resolveFilePath(argv[index + 1], options.markdownOut);
      index += 1;
      continue;
    }
    if (part.startsWith('--markdown-out=')) {
      options.markdownOut = resolveFilePath(
        part.slice('--markdown-out='.length),
        options.markdownOut,
      );
    }
  }

  return options;
}

function readJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeEnvironmentEntry(entry = {}, fallbackIndex = 0) {
  const rawStatus = trimText(entry.status, 80).toLowerCase();
  const status = rawStatus || 'pending';
  return {
    id: trimText(entry.id, 160) || `environment-${fallbackIndex + 1}`,
    status,
    label: trimText(entry.label, 200) || `Environment ${fallbackIndex + 1}`,
    runtimeKind: trimText(entry.runtimeKind, 120) || null,
    scumServerProfile: trimText(entry.scumServerProfile, 200) || null,
    workstationProfile: trimText(entry.workstationProfile, 200) || null,
    topologyMode: trimText(entry.topologyMode, 120) || null,
    executionMode: trimText(entry.executionMode, 120) || null,
    nativeProofMode: trimText(entry.nativeProofMode, 120) || null,
    proofSources: Array.isArray(entry.proofSources)
      ? entry.proofSources.map((value) => trimText(value, 120)).filter(Boolean)
      : [],
    coverageGoal: trimText(entry.coverageGoal, 240) || null,
    notes: trimText(entry.notes, 500) || null,
    itemMatrixPath: trimText(entry.itemMatrixPath, 500) || null,
    wrapperMatrixPath: trimText(entry.wrapperMatrixPath, 500) || null,
    capturedAt: trimText(entry.capturedAt, 120) || null,
  };
}

function normalizeResultEntry(entry = {}) {
  return {
    label: trimText(entry.label, 160) || null,
    gameItemId: trimText(entry.gameItemId, 160) || null,
    deliveryClass: trimText(entry.deliveryClass, 120) || null,
    deliveryProfile: trimText(entry.deliveryProfile, 120) || null,
    expectedProofStrategy: trimText(entry.expectedProofStrategy, 120) || null,
    strategy: trimText(entry.strategy, 120) || null,
    ok: entry.ok === true,
    verificationOk: entry.verificationOk === true,
  };
}

function summarizeClassCoverage(itemResults = []) {
  const classMap = new Map();
  for (const entry of itemResults) {
    const key = entry.deliveryClass || 'unclassified';
    const summary = classMap.get(key) || {
      deliveryClass: key,
      cases: [],
      proved: false,
      strategies: new Set(),
    };
    summary.cases.push(entry.label || entry.gameItemId || 'unnamed-case');
    if (entry.strategy) summary.strategies.add(entry.strategy);
    if (entry.ok && entry.verificationOk) {
      summary.proved = true;
    }
    classMap.set(key, summary);
  }

  return Array.from(classMap.values())
    .map((entry) => ({
      deliveryClass: entry.deliveryClass,
      cases: entry.cases,
      proved: entry.proved,
      strategies: Array.from(entry.strategies).sort(),
    }))
    .sort((left, right) => left.deliveryClass.localeCompare(right.deliveryClass));
}

function summarizeWrapperCoverage(wrapperResults = []) {
  return wrapperResults
    .map((entry) => ({
      label: entry.label || entry.gameItemId || 'unnamed-wrapper-case',
      deliveryProfile: entry.deliveryProfile || null,
      proved: entry.ok && entry.verificationOk,
      strategy: entry.strategy || null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function summarizeExperimentalCases(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      label: trimText(entry.label, 160) || null,
      gameItemId: trimText(entry.gameItemId, 160) || null,
      deliveryClass: trimText(entry.deliveryClass, 120) || null,
      notes: trimText(entry.notes, 500) || null,
    }))
    .filter((entry) => entry.label || entry.gameItemId)
    .sort((left, right) =>
      String(left.label || left.gameItemId).localeCompare(String(right.label || right.gameItemId)));
}

function buildCoverageSummary({
  registry = {},
  itemMatrix = {},
  wrapperMatrix = {},
  experimentalCases = [],
} = {}) {
  const environments = (Array.isArray(registry.environments) ? registry.environments : [])
    .map((entry, index) => normalizeEnvironmentEntry(entry, index));
  const currentEnvironmentId = trimText(registry.currentEnvironmentId, 160) || null;
  const itemResults = (Array.isArray(itemMatrix.results) ? itemMatrix.results : []).map(normalizeResultEntry);
  const wrapperResults = (Array.isArray(wrapperMatrix.results) ? wrapperMatrix.results : [])
    .map(normalizeResultEntry);
  const classCoverage = summarizeClassCoverage(itemResults);
  const wrapperCoverage = summarizeWrapperCoverage(wrapperResults);
  const experimental = summarizeExperimentalCases(experimentalCases);
  const verifiedEnvironments = environments.filter((entry) => entry.status === 'verified');
  const sampledButIncompleteEnvironments = environments.filter((entry) =>
    entry.status === 'partial' || entry.status === 'blocked');
  const pendingEnvironments = environments.filter((entry) => entry.status === 'pending');

  return {
    generatedAt: new Date().toISOString(),
    currentEnvironmentId,
    currentEnvironment: environments.find((entry) => entry.id === currentEnvironmentId) || null,
    environments,
    verifiedEnvironments,
    sampledButIncompleteEnvironments,
    coverage: {
      itemCaseCount: itemResults.length,
      wrapperCaseCount: wrapperResults.length,
      provedDeliveryClasses: classCoverage.filter((entry) => entry.proved).map((entry) => entry.deliveryClass),
      classCoverage,
      wrapperCoverage,
      experimentalCases: experimental,
    },
    openCoverageRequirements: pendingEnvironments.map((entry) => ({
      id: entry.id,
      label: entry.label,
      coverageGoal: entry.coverageGoal || null,
      notes: entry.notes || null,
    })),
  };
}

function buildCoverageMarkdown(summary = {}) {
  const lines = [
    '# Native Proof Environment Coverage',
    '',
    `Generated: \`${summary.generatedAt || ''}\``,
    '',
    '## Current Verified Environment',
    '',
  ];

  if (summary.currentEnvironment) {
    lines.push(`- id: \`${summary.currentEnvironment.id}\``);
    lines.push(`- label: ${summary.currentEnvironment.label}`);
    if (summary.currentEnvironment.workstationProfile) {
      lines.push(`- workstation: ${summary.currentEnvironment.workstationProfile}`);
    }
    if (summary.currentEnvironment.scumServerProfile) {
      lines.push(`- server profile: ${summary.currentEnvironment.scumServerProfile}`);
    }
    if (summary.currentEnvironment.executionMode) {
      lines.push(`- execution mode: \`${summary.currentEnvironment.executionMode}\``);
    }
    if (summary.currentEnvironment.topologyMode) {
      lines.push(`- tenant topology mode: \`${summary.currentEnvironment.topologyMode}\``);
    }
    if (summary.currentEnvironment.proofSources?.length) {
      lines.push(`- proof sources: ${summary.currentEnvironment.proofSources.join(', ')}`);
    }
    if (summary.currentEnvironment.notes) {
      lines.push(`- notes: ${summary.currentEnvironment.notes}`);
    }
  } else {
    lines.push('- no verified environment is registered yet');
  }

  lines.push('', '## Delivery Class Coverage', '', '| Delivery class | Proved on current environment | Strategy | Cases |', '| --- | --- | --- | --- |');
  for (const entry of summary.coverage?.classCoverage || []) {
    lines.push(
      `| ${entry.deliveryClass} | ${entry.proved ? 'yes' : 'no'} | ${entry.strategies.join(', ') || '-'} | ${entry.cases.join(', ')} |`,
    );
  }

  lines.push('', '## Wrapper Profile Coverage', '', '| Label | Delivery profile | Proved | Strategy |', '| --- | --- | --- | --- |');
  for (const entry of summary.coverage?.wrapperCoverage || []) {
    lines.push(
      `| ${entry.label} | ${entry.deliveryProfile || '-'} | ${entry.proved ? 'yes' : 'no'} | ${entry.strategy || '-'} |`,
    );
  }

  lines.push('', '## Additional Captured Environments', '');
  if ((summary.sampledButIncompleteEnvironments || []).length === 0) {
    lines.push('- none');
  } else {
    for (const entry of summary.sampledButIncompleteEnvironments) {
      lines.push(
        `- ${entry.label} [${entry.status}]${entry.coverageGoal ? `: ${entry.coverageGoal}` : ''}${entry.notes ? `; ${entry.notes}` : ''}`,
      );
    }
  }

  lines.push('', '## Experimental Cases', '');
  if ((summary.coverage?.experimentalCases || []).length === 0) {
    lines.push('- none');
  } else {
    for (const entry of summary.coverage.experimentalCases) {
      lines.push(
        `- \`${entry.label || entry.gameItemId}\`${entry.deliveryClass ? ` (${entry.deliveryClass})` : ''}: ${entry.notes || 'no notes'}`,
      );
    }
  }

  lines.push('', '## Remaining Environment Coverage', '');
  if ((summary.openCoverageRequirements || []).length === 0) {
    lines.push('- no pending environment targets are registered');
  } else {
    for (const entry of summary.openCoverageRequirements) {
      lines.push(
        `- ${entry.label}${entry.coverageGoal ? `: ${entry.coverageGoal}` : ''}${entry.notes ? `; ${entry.notes}` : ''}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeOutput(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const options = parseArgs();
  const registry = readJson(options.registryPath, {});
  const itemMatrix = readJson(options.itemMatrixPath, {});
  const wrapperMatrix = readJson(options.wrapperMatrixPath, {});
  const experimentalCases = readJson(options.experimentalPath, []);
  const summary = buildCoverageSummary({
    registry,
    itemMatrix,
    wrapperMatrix,
    experimentalCases,
  });
  writeOutput(options.jsonOut, `${JSON.stringify(summary, null, 2)}\n`);
  writeOutput(options.markdownOut, buildCoverageMarkdown(summary));
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCoverageMarkdown,
  buildCoverageSummary,
  parseArgs,
  summarizeClassCoverage,
  summarizeExperimentalCases,
  summarizeWrapperCoverage,
};
