'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const { sendTestDeliveryCommand } = require('../src/services/rconDelivery');
const {
  buildCoverageMarkdown,
  buildCoverageSummary,
  evaluateEnvironmentCoverage,
} = require('./build-native-proof-coverage-report');
const {
  addShopItem,
  deleteShopItem,
} = require('../src/store/memoryStore');

const DEFAULT_ENVIRONMENT_REGISTRY_PATH = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-environments.json',
);
const DEFAULT_COVERAGE_JSON_OUT = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-coverage-summary.json',
);
const DEFAULT_COVERAGE_MARKDOWN_OUT = path.resolve(
  process.cwd(),
  'docs',
  'assets',
  'live-native-proof-coverage-summary.md',
);

const DEFAULT_CASES = Object.freeze([
  Object.freeze({
    label: 'consumable-water',
    gameItemId: 'Water_05l',
    quantity: 1,
    deliveryClass: 'consumable',
    deliveryProfile: 'spawn_only',
    expectedProofStrategy: 'world-spawn-delta',
  }),
  Object.freeze({
    label: 'weapon-m1911',
    gameItemId: 'Weapon_M1911',
    quantity: 1,
    deliveryClass: 'weapon',
    deliveryProfile: 'spawn_only',
    expectedProofStrategy: 'world-spawn-delta',
  }),
  Object.freeze({
    label: 'magazine-m1911',
    gameItemId: 'Magazine_M1911',
    quantity: 1,
    deliveryClass: 'magazine',
    deliveryProfile: 'spawn_only',
    expectedProofStrategy: 'world-spawn-delta',
  }),
]);

function trimText(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function sleep(ms) {
  const delay = Math.max(0, Math.trunc(Number(ms) || 0));
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    steamId: String(process.env.PREFLIGHT_DELIVERY_TEST_STEAM_ID || '').trim(),
    inGameName: String(process.env.PREFLIGHT_DELIVERY_TEST_INGAME_NAME || '').trim(),
    userId: 'native-proof-matrix',
    delayMs: 2500,
    jsonOut: '',
    markdownOut: '',
    casesJson: '',
    cases: [],
    environmentId: '',
    environmentRegistryPath: '',
    coverageJsonOut: '',
    coverageMarkdownOut: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const part = String(argv[index] || '').trim();
    if (!part) continue;
    if (part === '--steam-id' && argv[index + 1]) {
      options.steamId = trimText(argv[index + 1], 120);
      index += 1;
      continue;
    }
    if (part.startsWith('--steam-id=')) {
      options.steamId = trimText(part.slice('--steam-id='.length), 120);
      continue;
    }
    if (part === '--user-id' && argv[index + 1]) {
      options.userId = trimText(argv[index + 1], 120) || options.userId;
      index += 1;
      continue;
    }
    if (part.startsWith('--user-id=')) {
      options.userId = trimText(part.slice('--user-id='.length), 120) || options.userId;
      continue;
    }
    if (part === '--in-game-name' && argv[index + 1]) {
      options.inGameName = trimText(argv[index + 1], 160) || options.inGameName;
      index += 1;
      continue;
    }
    if (part.startsWith('--in-game-name=')) {
      options.inGameName = trimText(part.slice('--in-game-name='.length), 160) || options.inGameName;
      continue;
    }
    if (part === '--delay-ms' && argv[index + 1]) {
      options.delayMs = Math.max(0, Math.trunc(Number(argv[index + 1]) || options.delayMs));
      index += 1;
      continue;
    }
    if (part.startsWith('--delay-ms=')) {
      options.delayMs = Math.max(0, Math.trunc(Number(part.slice('--delay-ms='.length)) || options.delayMs));
      continue;
    }
    if (part === '--json-out' && argv[index + 1]) {
      options.jsonOut = trimText(argv[index + 1], 1000);
      index += 1;
      continue;
    }
    if (part.startsWith('--json-out=')) {
      options.jsonOut = trimText(part.slice('--json-out='.length), 1000);
      continue;
    }
    if (part === '--markdown-out' && argv[index + 1]) {
      options.markdownOut = trimText(argv[index + 1], 1000);
      index += 1;
      continue;
    }
    if (part.startsWith('--markdown-out=')) {
      options.markdownOut = trimText(part.slice('--markdown-out='.length), 1000);
      continue;
    }
    if (part === '--environment-id' && argv[index + 1]) {
      options.environmentId = trimText(argv[index + 1], 160);
      index += 1;
      continue;
    }
    if (part.startsWith('--environment-id=')) {
      options.environmentId = trimText(part.slice('--environment-id='.length), 160);
      continue;
    }
    if (part === '--environment-registry' && argv[index + 1]) {
      options.environmentRegistryPath = trimText(argv[index + 1], 1000);
      index += 1;
      continue;
    }
    if (part.startsWith('--environment-registry=')) {
      options.environmentRegistryPath = trimText(part.slice('--environment-registry='.length), 1000);
      continue;
    }
    if (part === '--coverage-json-out' && argv[index + 1]) {
      options.coverageJsonOut = trimText(argv[index + 1], 1000);
      index += 1;
      continue;
    }
    if (part.startsWith('--coverage-json-out=')) {
      options.coverageJsonOut = trimText(part.slice('--coverage-json-out='.length), 1000);
      continue;
    }
    if (part === '--coverage-markdown-out' && argv[index + 1]) {
      options.coverageMarkdownOut = trimText(argv[index + 1], 1000);
      index += 1;
      continue;
    }
    if (part.startsWith('--coverage-markdown-out=')) {
      options.coverageMarkdownOut = trimText(part.slice('--coverage-markdown-out='.length), 1000);
      continue;
    }
    if (part === '--cases-json' && argv[index + 1]) {
      options.casesJson = trimText(argv[index + 1], 1000);
      index += 1;
      continue;
    }
    if (part.startsWith('--cases-json=')) {
      options.casesJson = trimText(part.slice('--cases-json='.length), 1000);
      continue;
    }
    if (part === '--case' && argv[index + 1]) {
      options.cases.push(trimText(argv[index + 1], 500));
      index += 1;
      continue;
    }
    if (part.startsWith('--case=')) {
      options.cases.push(trimText(part.slice('--case='.length), 500));
    }
  }

  return options;
}

function normalizeMatrixCase(raw = {}, fallbackIndex = 0, defaults = {}) {
  const gameItemId = trimText(raw.gameItemId || raw.id, 160);
  if (!gameItemId) return null;
  const quantity = Math.max(1, Math.trunc(Number(raw.quantity || 1) || 1));
  return Object.freeze({
    label: trimText(raw.label, 120) || `case-${fallbackIndex + 1}`,
    itemId: trimText(raw.itemId, 160) || null,
    itemName: trimText(raw.itemName, 160) || null,
    gameItemId,
    quantity,
    deliveryClass: trimText(raw.deliveryClass || raw.className || '', 120) || null,
    deliveryProfile: trimText(raw.deliveryProfile || raw.profile || '', 120) || null,
    deliveryTeleportMode: trimText(raw.deliveryTeleportMode || raw.teleportMode || '', 120) || null,
    deliveryTeleportTarget: trimText(raw.deliveryTeleportTarget || raw.teleportTarget || '', 160) || null,
    deliveryReturnTarget: trimText(raw.deliveryReturnTarget || raw.returnTarget || '', 160) || null,
    inGameName: trimText(raw.inGameName || defaults.inGameName || '', 160) || null,
    expectedProofStrategy: trimText(
      raw.expectedProofStrategy || raw.expectedStrategy || '',
      120,
    ) || null,
    notes: trimText(raw.notes || raw.note || '', 300) || null,
  });
}

function parseInlineCase(raw, fallbackIndex = 0) {
  const text = trimText(raw, 500);
  if (!text) return null;
  const [label, gameItemId, quantityText] = text.split(':');
  return normalizeMatrixCase(
    {
      label,
      gameItemId,
      quantity: quantityText,
    },
    fallbackIndex,
    {},
  );
}

function loadMatrixCases(options = {}) {
  const inlineCases = Array.isArray(options.cases)
    ? options.cases
        .map((entry, index) => parseInlineCase(entry, index))
        .filter(Boolean)
    : [];
  if (inlineCases.length > 0) {
    return inlineCases;
  }

  const targetPath = trimText(options.casesJson, 1000);
  if (targetPath) {
    const fullPath = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(process.cwd(), targetPath);
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : parsed?.cases;
    const normalized = (Array.isArray(rows) ? rows : [])
      .map((entry, index) => normalizeMatrixCase(entry, index, options))
      .filter(Boolean);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return DEFAULT_CASES;
}

function normalizeTempCaseId(value, fallback = 'native-proof-case') {
  const text = trimText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || fallback;
}

function needsTemporaryShopItem(matrixCase = {}) {
  return Boolean(
    matrixCase.deliveryProfile
    || matrixCase.deliveryTeleportMode
    || matrixCase.deliveryTeleportTarget
    || matrixCase.deliveryReturnTarget
  );
}

async function withDeliveryTarget(matrixCase = {}, callback = async () => null) {
  const existingItemId = trimText(matrixCase.itemId, 160);
  if (!needsTemporaryShopItem(matrixCase)) {
    return callback({
      itemId: existingItemId || null,
      itemName: trimText(matrixCase.itemName, 160) || null,
    });
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempItemId =
    existingItemId
    || `${normalizeTempCaseId(matrixCase.label || matrixCase.gameItemId)}-${suffix}`;
  const tempItemName =
    trimText(matrixCase.itemName, 160)
    || trimText(matrixCase.label, 120)
    || trimText(matrixCase.gameItemId, 160)
    || tempItemId;
  await addShopItem(
    tempItemId,
    tempItemName,
    0,
    'Temporary live native-proof matrix case',
    {
      kind: 'item',
      deliveryItems: [
        {
          gameItemId: matrixCase.gameItemId,
          quantity: matrixCase.quantity,
        },
      ],
      deliveryProfile: matrixCase.deliveryProfile || undefined,
      deliveryTeleportMode: matrixCase.deliveryTeleportMode || undefined,
      deliveryTeleportTarget: matrixCase.deliveryTeleportTarget || undefined,
      deliveryReturnTarget: matrixCase.deliveryReturnTarget || undefined,
    },
  );
  try {
    return await callback({
      itemId: tempItemId,
      itemName: tempItemName,
    });
  } finally {
    await deleteShopItem(tempItemId).catch(() => null);
  }
}

function buildCaseSummary(result = {}) {
  const verification = result.verification || {};
  const nativeProof = verification.nativeProof || {};
  const evidence = nativeProof.evidence && typeof nativeProof.evidence === 'object'
    ? nativeProof.evidence
    : {};
  return {
    label: trimText(result.label, 120) || null,
    gameItemId: trimText(result.gameItemId, 160) || null,
    quantity: Math.max(1, Math.trunc(Number(result.quantity || 1) || 1)),
    deliveryClass: trimText(result.deliveryClass, 120) || null,
    deliveryProfile: trimText(result.deliveryProfile, 120) || null,
    expectedProofStrategy: trimText(result.expectedProofStrategy, 120) || null,
    notes: trimText(result.notes, 300) || null,
    ok: nativeProof.ok === true,
    verificationOk: verification.ok === true,
    code: trimText(nativeProof.code || verification.code || '', 160) || null,
    proofType: trimText(nativeProof.proofType || '', 120) || null,
    strategy: trimText(evidence.strategy || '', 120) || null,
    detail: trimText(nativeProof.detail || verification.detail || '', 500) || null,
    commandSummary: trimText(result.commandSummary || '', 1000) || null,
    outputs: Array.isArray(result.outputs)
      ? result.outputs.map((row) => ({
          backend: trimText(row?.backend, 120) || null,
          command: trimText(row?.command, 500) || null,
          gameItemId: trimText(row?.gameItemId, 160) || null,
          quantity: Math.max(1, Math.trunc(Number(row?.quantity || 1) || 1)),
        }))
      : [],
    evidence,
  };
}

function buildMarkdownReport(run = {}) {
  const classSummary = new Map();
  for (const entry of Array.isArray(run.results) ? run.results : []) {
    const key = entry.deliveryClass || 'unclassified';
    const summary = classSummary.get(key) || {
      cases: 0,
      proven: 0,
      strategies: new Set(),
    };
    summary.cases += 1;
    if (entry.ok === true && entry.verificationOk === true) {
      summary.proven += 1;
    }
    if (entry.expectedProofStrategy) {
      summary.strategies.add(entry.expectedProofStrategy);
    }
    classSummary.set(key, summary);
  }
  const lines = [
    '# Live Native Proof Matrix',
    '',
    `Captured on: \`${run.generatedAt || new Date().toISOString()}\``,
    '',
    `steamId: \`${run.steamId || '-'}\``,
    `executionMode: \`${run.executionMode || '-'}\``,
    `nativeProofMode: \`${run.nativeProofMode || '-'}\``,
    '',
    '## Delivery Class Summary',
    '',
  ];

  if (classSummary.size === 0) {
    lines.push('- no cases');
  } else {
    for (const [deliveryClass, summary] of classSummary.entries()) {
      const strategies = Array.from(summary.strategies.values());
      lines.push(
        `- \`${deliveryClass}\`: ${summary.proven}/${summary.cases} cases proved`
        + (strategies.length > 0 ? ` | expected: ${strategies.join(', ')}` : ''),
      );
    }
  }

  lines.push(
    '',
    '## Cases',
    '',
  );

  for (const entry of Array.isArray(run.results) ? run.results : []) {
    lines.push(`### ${entry.label || entry.gameItemId || 'case'}`);
    lines.push('');
    lines.push(`- gameItemId: \`${entry.gameItemId || '-'}\``);
    lines.push(`- quantity: \`${entry.quantity || 1}\``);
    if (entry.deliveryClass) {
      lines.push(`- deliveryClass: \`${entry.deliveryClass}\``);
    }
    if (entry.deliveryProfile) {
      lines.push(`- deliveryProfile: \`${entry.deliveryProfile}\``);
    }
    if (entry.expectedProofStrategy) {
      lines.push(`- expectedProofStrategy: \`${entry.expectedProofStrategy}\``);
    }
    lines.push(`- verificationOk: \`${entry.verificationOk === true}\``);
    lines.push(`- nativeProofOk: \`${entry.ok === true}\``);
    lines.push(`- code: \`${entry.code || '-'}\``);
    lines.push(`- proofType: \`${entry.proofType || '-'}\``);
    lines.push(`- strategy: \`${entry.strategy || '-'}\``);
    if (entry.notes) {
      lines.push(`- notes: ${entry.notes}`);
    }
    if (entry.detail) {
      lines.push(`- detail: ${entry.detail}`);
    }
    if (entry.commandSummary) {
      lines.push(`- commandSummary: \`${entry.commandSummary}\``);
    }
    const matched = Array.isArray(entry.evidence?.verification?.matched)
      ? entry.evidence.verification.matched
      : [];
    if (matched.length > 0) {
      lines.push('- matched items:');
      for (const row of matched) {
        lines.push(`  - \`${row.itemId || '-'}\` x${row.matchedQuantity || row.deltaQuantity || 0}`);
      }
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function writeFileIfRequested(targetPath, content) {
  const resolved = trimText(targetPath, 1000);
  if (!resolved) return;
  const fullPath = path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function resolveOptionalPath(targetPath, fallbackPath = '') {
  const resolved = trimText(targetPath, 1000);
  if (!resolved) return fallbackPath ? path.resolve(fallbackPath) : '';
  return path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);
}

function toRelativePath(targetPath) {
  const fullPath = resolveOptionalPath(targetPath);
  if (!fullPath) return null;
  return path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
}

function readJsonFile(filePath, fallbackValue) {
  if (!filePath || !fs.existsSync(filePath)) return fallbackValue;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function updateEnvironmentRegistry(run, options = {}) {
  const environmentId = trimText(options.environmentId, 160);
  if (!environmentId) return null;
  const registryPath = resolveOptionalPath(
    options.environmentRegistryPath,
    DEFAULT_ENVIRONMENT_REGISTRY_PATH,
  );
  const registry = readJsonFile(registryPath, {
    currentEnvironmentId: environmentId,
    environments: [],
  });
  const environments = Array.isArray(registry.environments) ? registry.environments.slice() : [];
  const capturedAt = String(run.generatedAt || new Date().toISOString()).slice(0, 10);
  const entry = {
    ...(environments.find((row) => String(row?.id || '').trim() === environmentId) || {}),
    id: environmentId,
    status: run.results.every((item) => item.ok === true && item.verificationOk === true)
      ? 'verified'
      : 'partial',
    executionMode: run.executionMode || null,
    nativeProofMode: run.nativeProofMode || null,
    itemMatrixPath: toRelativePath(options.jsonOut) || null,
    wrapperMatrixPath: null,
    capturedAt,
  };
  const nextEnvironments = [
    entry,
    ...environments.filter((row) => String(row?.id || '').trim() !== environmentId),
  ];
  const nextRegistry = {
    ...registry,
    currentEnvironmentId: registry.currentEnvironmentId || environmentId,
    environments: nextEnvironments,
  };
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, 'utf8');
  return {
    registryPath,
    registry: nextRegistry,
  };
}

function writeCoverageArtifacts(run, options = {}, registryPayload = null) {
  const registryPath = resolveOptionalPath(
    options.environmentRegistryPath,
    DEFAULT_ENVIRONMENT_REGISTRY_PATH,
  );
  const coverageJsonOut = resolveOptionalPath(
    options.coverageJsonOut,
    DEFAULT_COVERAGE_JSON_OUT,
  );
  const coverageMarkdownOut = resolveOptionalPath(
    options.coverageMarkdownOut,
    DEFAULT_COVERAGE_MARKDOWN_OUT,
  );
  const summary = buildCoverageSummary({
    registry: registryPayload?.registry || readJsonFile(registryPath, {}),
    itemMatrix: run,
    wrapperMatrix: {},
    experimentalCases: readJsonFile(
      path.resolve(process.cwd(), 'docs', 'assets', 'live-native-proof-experimental-cases.json'),
      [],
    ),
  });
  summary.validation = evaluateEnvironmentCoverage(summary);
  fs.mkdirSync(path.dirname(coverageJsonOut), { recursive: true });
  fs.writeFileSync(coverageJsonOut, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(coverageMarkdownOut), { recursive: true });
  fs.writeFileSync(coverageMarkdownOut, buildCoverageMarkdown(summary), 'utf8');
  return summary;
}

async function main() {
  const options = parseArgs();
  if (!options.steamId) {
    throw new Error('--steam-id is required when PREFLIGHT_DELIVERY_TEST_STEAM_ID is empty');
  }

  const cases = loadMatrixCases(options);
  const results = [];
  for (let index = 0; index < cases.length; index += 1) {
    const current = cases[index];
    const purchaseCode = `NPROOF-${Date.now()}-${index + 1}`;
    const response = await withDeliveryTarget(current, async (deliveryTarget = {}) =>
      sendTestDeliveryCommand({
        itemId: deliveryTarget.itemId || undefined,
        gameItemId: deliveryTarget.itemId ? undefined : current.gameItemId,
        itemName: deliveryTarget.itemName || current.itemName || current.label,
        quantity: current.quantity,
        steamId: options.steamId,
        userId: options.userId,
        purchaseCode,
        inGameName: current.inGameName || options.inGameName || undefined,
      }));
    results.push(
      buildCaseSummary({
        ...response,
        label: current.label,
        gameItemId: current.gameItemId,
        quantity: current.quantity,
        deliveryClass: current.deliveryClass,
        deliveryProfile: current.deliveryProfile,
        expectedProofStrategy: current.expectedProofStrategy,
        notes: current.notes,
      }),
    );
    if (index < cases.length - 1) {
      await sleep(options.delayMs);
    }
  }

  const run = {
    generatedAt: new Date().toISOString(),
    steamId: options.steamId,
    executionMode: String(process.env.DELIVERY_EXECUTION_MODE || '').trim() || null,
    nativeProofMode: String(process.env.DELIVERY_NATIVE_PROOF_MODE || '').trim() || null,
    results,
  };

  writeFileIfRequested(options.jsonOut, JSON.stringify(run, null, 2));
  writeFileIfRequested(options.markdownOut, buildMarkdownReport(run));
  const registryPayload = updateEnvironmentRegistry(run, options);
  const coverage = writeCoverageArtifacts(run, options, registryPayload);

  console.log(JSON.stringify({
    ...run,
    coverageValidation: coverage.validation || null,
  }, null, 2));
  if (results.some((entry) => entry.ok !== true || entry.verificationOk !== true)) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[live-native-proof-matrix] failed:', error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCaseSummary,
  buildMarkdownReport,
  loadMatrixCases,
  parseArgs,
  updateEnvironmentRegistry,
  writeCoverageArtifacts,
};
