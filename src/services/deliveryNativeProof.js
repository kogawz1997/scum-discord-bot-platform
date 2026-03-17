'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  inferScumSavefileDbPath,
  loadScumSavefileInventoryState,
} = require('./deliveryNativeInventoryProof');

function trimText(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizeDeliveryNativeProofMode(value, fallback = 'disabled') {
  const raw = trimText(value, 40).toLowerCase();
  if (!raw) return fallback;
  if (['disabled', 'disable', 'off', 'none', 'false', '0'].includes(raw)) return 'disabled';
  if (['optional', 'warn', 'soft', 'on', 'true', '1'].includes(raw)) return 'optional';
  if (['required', 'strict', 'hard'].includes(raw)) return 'required';
  return fallback;
}

function resolveScriptPath(scriptPath) {
  const raw = trimText(scriptPath, 1000);
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function resolveBundledNativeProofScript(env = process.env) {
  const inferredDbPath = inferScumSavefileDbPath(env);
  if (!inferredDbPath || !fs.existsSync(inferredDbPath)) {
    return '';
  }
  const bundledPath = path.resolve(process.cwd(), 'scripts', 'delivery-native-proof-scum-savefile.js');
  return fs.existsSync(bundledPath) ? bundledPath : '';
}

function resolveConfiguredNativeProofScript(scriptPath, env = process.env) {
  const explicitPath = resolveScriptPath(scriptPath);
  if (explicitPath) return explicitPath;
  return resolveBundledNativeProofScript(env);
}

async function captureNativeProofBaseline(payload = {}, settings = {}, options = {}) {
  const env = options.env || process.env;
  const bundledPath = resolveBundledNativeProofScript(env);
  const resolvedPath = resolveConfiguredNativeProofScript(settings?.nativeProofScript, env);
  if (!bundledPath || !resolvedPath) return null;
  if (path.resolve(bundledPath) !== path.resolve(resolvedPath)) {
    return null;
  }
  const steamId = trimText(payload?.steamId, 120);
  if (!steamId) return null;
  const state = await loadScumSavefileInventoryState(steamId, options);
  if (!state?.ok) {
    return {
      ok: false,
      code: state?.code || 'DELIVERY_NATIVE_PROOF_BASELINE_UNAVAILABLE',
      detail: state?.detail || 'Failed to capture native proof baseline',
    };
  }
  return {
    ok: true,
    capturedAt: new Date().toISOString(),
    databasePath: state.databasePath,
    player: state.player,
    entityCursor: state.entityCursor || null,
    observed: state.observed,
  };
}

function resolveInvocation(scriptPath) {
  const resolvedPath = resolveConfiguredNativeProofScript(scriptPath);
  if (!resolvedPath) return null;
  const extension = path.extname(resolvedPath).toLowerCase();
  if (extension === '.js' || extension === '.cjs' || extension === '.mjs') {
    return {
      command: process.execPath,
      args: [resolvedPath],
      resolvedPath,
    };
  }
  if (extension === '.ps1') {
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolvedPath],
      resolvedPath,
    };
  }
  if (extension === '.cmd' || extension === '.bat') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', resolvedPath],
      resolvedPath,
    };
  }
  return {
    command: resolvedPath,
    args: [],
    resolvedPath,
  };
}

function parseJsonObject(value) {
  const text = trimText(value, 20000);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeWarnings(value) {
  return Array.isArray(value)
    ? value.map((entry) => trimText(entry, 300)).filter(Boolean).slice(0, 10)
    : [];
}

function normalizeNativeProofResult(base = {}, parsed = null) {
  const proofType = trimText(parsed?.proofType || parsed?.kind || base.proofType || 'external-script', 120)
    || 'external-script';
  const ok = parsed
    ? parsed.ok === true
    : base.ok === true
      ? true
      : base.ok === false
        ? false
        : null;
  return {
    enabled: base.enabled === true,
    executed: base.executed === true,
    required: base.required === true,
    ok,
    code: trimText(
      parsed?.code
        || base.code
        || (ok ? 'READY' : 'DELIVERY_NATIVE_PROOF_FAILED'),
      120,
    ) || (ok ? 'READY' : 'DELIVERY_NATIVE_PROOF_FAILED'),
    proofType,
    detail: trimText(
      parsed?.detail
        || parsed?.message
        || base.detail
        || (ok ? 'Native delivery proof passed' : 'Native delivery proof failed'),
      500,
    ) || (ok ? 'Native delivery proof passed' : 'Native delivery proof failed'),
    warnings: normalizeWarnings(parsed?.warnings),
    evidence:
      parsed?.evidence && typeof parsed.evidence === 'object' && !Array.isArray(parsed.evidence)
        ? parsed.evidence
        : null,
    stdout: trimText(base.stdout, 4000) || null,
    stderr: trimText(base.stderr, 4000) || null,
    exitCode: Number.isInteger(base.exitCode) ? base.exitCode : null,
    command: trimText(base.command, 400) || null,
    scriptPath: trimText(base.scriptPath, 1000) || null,
    timeoutMs: Number.isFinite(base.timeoutMs) ? Math.max(0, Math.trunc(base.timeoutMs)) : null,
  };
}

async function runDeliveryNativeProof(payload = {}, settings = {}) {
  const mode = normalizeDeliveryNativeProofMode(settings?.nativeProofMode, 'disabled');
  const required = mode === 'required';
  if (mode === 'disabled') {
    return normalizeNativeProofResult({
      enabled: false,
      executed: false,
      required,
      ok: null,
      code: 'DELIVERY_NATIVE_PROOF_DISABLED',
      detail: 'Native delivery proof is disabled',
    });
  }

  const resolvedScriptPath = resolveConfiguredNativeProofScript(settings?.nativeProofScript);
  const invocation = resolveInvocation(resolvedScriptPath);
  if (!invocation) {
    return normalizeNativeProofResult({
      enabled: true,
      executed: false,
      required,
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_NOT_CONFIGURED',
      detail: 'Native delivery proof script is not configured',
    });
  }

  if (!fs.existsSync(invocation.resolvedPath)) {
    return normalizeNativeProofResult({
      enabled: true,
      executed: false,
      required,
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_SCRIPT_MISSING',
      detail: `Native delivery proof script not found: ${invocation.resolvedPath}`,
      scriptPath: invocation.resolvedPath,
      command: `${invocation.command} ${invocation.args.join(' ')}`.trim(),
    });
  }

  const timeoutMs = Math.max(
    1000,
    Math.trunc(Number(settings?.nativeProofTimeoutMs || 10000) || 10000),
  );

  return new Promise((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DELIVERY_NATIVE_PROOF_MODE: mode,
      },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (base, parsed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(normalizeNativeProofResult(base, parsed));
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish({
        enabled: true,
        executed: true,
        required,
        ok: false,
        code: 'DELIVERY_NATIVE_PROOF_TIMEOUT',
        detail: `Native delivery proof timed out after ${timeoutMs}ms`,
        stdout,
        stderr,
        exitCode: null,
        command: `${invocation.command} ${invocation.args.join(' ')}`.trim(),
        scriptPath: invocation.resolvedPath,
        timeoutMs,
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });
    child.on('error', (error) => {
      finish({
        enabled: true,
        executed: false,
        required,
        ok: false,
        code: 'DELIVERY_NATIVE_PROOF_EXEC_FAILED',
        detail: trimText(error?.message || 'Failed to execute native delivery proof script', 500),
        stdout,
        stderr,
        exitCode: null,
        command: `${invocation.command} ${invocation.args.join(' ')}`.trim(),
        scriptPath: invocation.resolvedPath,
        timeoutMs,
      });
    });
    child.on('close', (code) => {
      if (timedOut) return;
      const parsed = parseJsonObject(stdout);
      const base = {
        enabled: true,
        executed: true,
        required,
        ok: parsed?.ok === true,
        code:
          parsed
            ? undefined
            : code === 0
              ? 'DELIVERY_NATIVE_PROOF_INVALID_JSON'
              : 'DELIVERY_NATIVE_PROOF_EXEC_FAILED',
        detail:
          parsed
            ? undefined
            : code === 0
              ? 'Native delivery proof script returned invalid JSON'
              : trimText(stderr || stdout || 'Native delivery proof script failed', 500),
        stdout,
        stderr,
        exitCode: Number.isInteger(code) ? code : null,
        command: `${invocation.command} ${invocation.args.join(' ')}`.trim(),
        scriptPath: invocation.resolvedPath,
        timeoutMs,
      };
      finish(base, parsed);
    });

    try {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    } catch (error) {
      finish({
        enabled: true,
        executed: false,
        required,
        ok: false,
        code: 'DELIVERY_NATIVE_PROOF_STDIN_FAILED',
        detail: trimText(error?.message || 'Failed to send payload to native proof script', 500),
        stdout,
        stderr,
        exitCode: null,
        command: `${invocation.command} ${invocation.args.join(' ')}`.trim(),
        scriptPath: invocation.resolvedPath,
        timeoutMs,
      });
    }
  });
}

module.exports = {
  captureNativeProofBaseline,
  normalizeDeliveryNativeProofMode,
  resolveBundledNativeProofScript,
  resolveConfiguredNativeProofScript,
  resolveScriptPath,
  runDeliveryNativeProof,
};
