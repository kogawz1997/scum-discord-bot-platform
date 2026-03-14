const { spawn } = require('node:child_process');

const UNSUPPORTED_SHELL_CHARS = new Set(['&', '|', ';', '>', '<']);

function trimText(value, maxLen = 1200) {
  const text = String(value || '');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function substituteTemplateToken(template, vars) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    if (!(key in vars)) return `{${key}}`;
    const value = vars[key];
    if (value == null) return '';
    return String(value);
  });
}

function tokenizeCommandTemplate(template) {
  const input = String(template || '').trim();
  if (!input) {
    throw new Error('command template is empty');
  }

  const tokens = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (UNSUPPORTED_SHELL_CHARS.has(ch)) {
      throw new Error(
        `unsupported shell operator "${ch}" in command template; use executable + args only`,
      );
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (quote) {
    throw new Error('command template has an unmatched quote');
  }
  if (current) {
    tokens.push(current);
  }
  if (tokens.length === 0) {
    throw new Error('command template produced no executable token');
  }

  return {
    executable: tokens[0],
    args: tokens.slice(1),
    tokens,
  };
}

function quoteDisplayToken(token) {
  const text = String(token || '');
  if (text === '') return '""';
  if (!/[\s"]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function buildDisplayCommand(executable, args) {
  return [executable, ...(Array.isArray(args) ? args : [])]
    .map((token) => quoteDisplayToken(token))
    .join(' ')
    .trim();
}

function normalizeExecError(error, stdout, stderr, displayCommand, exitCode, signal) {
  const err = error instanceof Error ? error : new Error(String(error || 'Command failed'));
  err.stdout = trimText(stdout);
  err.stderr = trimText(stderr);
  err.displayCommand = displayCommand;
  err.exitCode = exitCode;
  err.signal = signal;
  return err;
}

function executeParsedCommand(executable, args, options = {}) {
  const timeoutMs = Math.max(1, Math.trunc(Number(options.timeoutMs || 15000)));
  const maxBuffer = Math.max(1024, Math.trunc(Number(options.maxBuffer || 1024 * 1024 * 4)));
  const displayCommand = buildDisplayCommand(executable, args);

  if (String(executable || '').trim().toLowerCase() === 'echo') {
    return Promise.resolve({
      stdout: trimText(args.join(' ')),
      stderr: '',
      exitCode: 0,
      signal: null,
      displayCommand,
      executable,
      args: args.slice(),
    });
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      windowsHide: options.windowsHide !== false,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;
    let timer = null;

    function finishError(error, exitCode = null, signal = null) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(normalizeExecError(error, stdout, stderr, displayCommand, exitCode, signal));
    }

    function finishSuccess(exitCode = 0, signal = null) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        stdout: trimText(stdout),
        stderr: trimText(stderr),
        exitCode,
        signal,
        displayCommand,
        executable,
        args: args.slice(),
      });
    }

    function appendChunk(target, chunk) {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
      const bytes = Buffer.byteLength(text);
      if (target === 'stdout') {
        stdout += text;
        stdoutBytes += bytes;
        if (stdoutBytes > maxBuffer) {
          child.kill();
          finishError(new Error('Command stdout exceeded maxBuffer'));
        }
        return;
      }

      stderr += text;
      stderrBytes += bytes;
      if (stderrBytes > maxBuffer) {
        child.kill();
        finishError(new Error('Command stderr exceeded maxBuffer'));
      }
    }

    child.stdout?.on('data', (chunk) => appendChunk('stdout', chunk));
    child.stderr?.on('data', (chunk) => appendChunk('stderr', chunk));
    child.on('error', (error) => finishError(error));
    child.on('close', (exitCode, signal) => {
      if (timedOut) {
        return finishError(new Error(`Command timed out after ${timeoutMs}ms`), exitCode, signal);
      }
      if (exitCode !== 0) {
        return finishError(
          new Error(`Command exited with code ${exitCode}${signal ? ` (${signal})` : ''}`),
          exitCode,
          signal,
        );
      }
      return finishSuccess(exitCode, signal);
    });

    timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });
}

async function executeCommandTemplate(template, vars = {}, options = {}) {
  const parsed = tokenizeCommandTemplate(template);
  const executable = substituteTemplateToken(parsed.executable, vars);
  const args = parsed.args.map((token) => substituteTemplateToken(token, vars));
  const extraArgs = Array.isArray(options.extraArgs)
    ? options.extraArgs.map((token) => String(token))
    : [];
  return executeParsedCommand(executable, [...args, ...extraArgs], options);
}

function validateCommandTemplate(template) {
  tokenizeCommandTemplate(template);
  return true;
}

module.exports = {
  buildDisplayCommand,
  executeCommandTemplate,
  executeParsedCommand,
  substituteTemplateToken,
  tokenizeCommandTemplate,
  validateCommandTemplate,
};
