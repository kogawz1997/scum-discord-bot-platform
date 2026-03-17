'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const { sendTestDeliveryCommand } = require('../src/services/rconDelivery');

const DEFAULT_CASES = Object.freeze([
  Object.freeze({ label: 'consumable-water', gameItemId: 'Water_05l', quantity: 1 }),
  Object.freeze({ label: 'weapon-m1911', gameItemId: 'Weapon_M1911', quantity: 1 }),
  Object.freeze({ label: 'magazine-m1911', gameItemId: 'Magazine_M1911', quantity: 1 }),
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
    userId: 'native-proof-matrix',
    delayMs: 2500,
    jsonOut: '',
    markdownOut: '',
    casesJson: '',
    cases: [],
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

function normalizeMatrixCase(raw = {}, fallbackIndex = 0) {
  const gameItemId = trimText(raw.gameItemId || raw.id, 160);
  if (!gameItemId) return null;
  const quantity = Math.max(1, Math.trunc(Number(raw.quantity || 1) || 1));
  return Object.freeze({
    label: trimText(raw.label, 120) || `case-${fallbackIndex + 1}`,
    gameItemId,
    quantity,
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
      .map((entry, index) => normalizeMatrixCase(entry, index))
      .filter(Boolean);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return DEFAULT_CASES;
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
  const lines = [
    '# Live Native Proof Matrix',
    '',
    `Captured on: \`${run.generatedAt || new Date().toISOString()}\``,
    '',
    `steamId: \`${run.steamId || '-'}\``,
    `executionMode: \`${run.executionMode || '-'}\``,
    `nativeProofMode: \`${run.nativeProofMode || '-'}\``,
    '',
    '## Cases',
    '',
  ];

  for (const entry of Array.isArray(run.results) ? run.results : []) {
    lines.push(`### ${entry.label || entry.gameItemId || 'case'}`);
    lines.push('');
    lines.push(`- gameItemId: \`${entry.gameItemId || '-'}\``);
    lines.push(`- quantity: \`${entry.quantity || 1}\``);
    lines.push(`- verificationOk: \`${entry.verificationOk === true}\``);
    lines.push(`- nativeProofOk: \`${entry.ok === true}\``);
    lines.push(`- code: \`${entry.code || '-'}\``);
    lines.push(`- proofType: \`${entry.proofType || '-'}\``);
    lines.push(`- strategy: \`${entry.strategy || '-'}\``);
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
    const response = await sendTestDeliveryCommand({
      gameItemId: current.gameItemId,
      itemName: current.label,
      quantity: current.quantity,
      steamId: options.steamId,
      userId: options.userId,
      purchaseCode,
    });
    results.push(
      buildCaseSummary({
        ...response,
        label: current.label,
        gameItemId: current.gameItemId,
        quantity: current.quantity,
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

  console.log(JSON.stringify(run, null, 2));
  if (results.some((entry) => entry.ok !== true || entry.verificationOk !== true)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[live-native-proof-matrix] failed:', error?.stack || error?.message || error);
  process.exitCode = 1;
});
