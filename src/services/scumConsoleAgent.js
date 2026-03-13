'use strict';

const http = require('node:http');
const { exec, spawn } = require('node:child_process');
const path = require('node:path');

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFlag(value, fallback = false) {
  if (value == null || String(value).trim() === '') return fallback;
  const text = String(value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function trimText(value, maxLen = 1200) {
  const text = String(value || '').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function substituteTemplate(template, vars) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    if (!(key in vars)) return `{${key}}`;
    const value = vars[key];
    if (value == null) return '';
    return String(value);
  });
}

function parseJsonArray(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

function normalizeHost(value, fallback = '127.0.0.1') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeBaseUrl(value, host, port) {
  const text = String(value || '').trim();
  if (text) return text.replace(/\/+$/, '');
  return `http://${host}:${port}`;
}

function getAgentSettings(env = process.env) {
  const host = normalizeHost(env.SCUM_CONSOLE_AGENT_HOST, '127.0.0.1');
  const port = Math.max(1, Math.trunc(asNumber(env.SCUM_CONSOLE_AGENT_PORT, 3213)));
  const backend = String(env.SCUM_CONSOLE_AGENT_BACKEND || 'exec').trim().toLowerCase() || 'exec';
  const token = String(env.SCUM_CONSOLE_AGENT_TOKEN || '').trim();
  const commandTimeoutMs = Math.max(
    1000,
    Math.trunc(asNumber(env.SCUM_CONSOLE_AGENT_COMMAND_TIMEOUT_MS, 15000)),
  );
  const allowNonHashCommands = envFlag(
    env.SCUM_CONSOLE_AGENT_ALLOW_NON_HASH,
    false,
  );

  const serverExe = String(env.SCUM_CONSOLE_AGENT_SERVER_EXE || '').trim();
  const serverArgs = parseJsonArray(env.SCUM_CONSOLE_AGENT_SERVER_ARGS_JSON);
  const serverWorkdir = String(env.SCUM_CONSOLE_AGENT_SERVER_WORKDIR || '').trim();
  const autoStartServer = envFlag(env.SCUM_CONSOLE_AGENT_AUTOSTART, false);
  const processResponseWaitMs = Math.max(
    50,
    Math.trunc(asNumber(env.SCUM_CONSOLE_AGENT_PROCESS_RESPONSE_WAIT_MS, 200)),
  );

  return {
    host,
    port,
    baseUrl: normalizeBaseUrl(env.SCUM_CONSOLE_AGENT_BASE_URL, host, port),
    token,
    backend,
    execTemplate: String(env.SCUM_CONSOLE_AGENT_EXEC_TEMPLATE || '').trim(),
    commandTimeoutMs,
    allowNonHashCommands,
    serverExe,
    serverArgs,
    serverWorkdir,
    autoStartServer,
    processResponseWaitMs,
  };
}

function createJsonResponder(res) {
  return (statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`invalid json: ${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

function execShell(command, timeoutMs) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 4,
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({
          stdout: trimText(stdout),
          stderr: trimText(stderr),
        });
      },
    );
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createOutputBuffer(maxEntries = 80) {
  const buffer = [];
  return {
    push(chunk) {
      const text = String(chunk || '');
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        buffer.push(line);
      }
      if (buffer.length > maxEntries) {
        buffer.splice(0, buffer.length - maxEntries);
      }
    },
    list() {
      return buffer.slice();
    },
    tail(limit = 8) {
      return buffer.slice(Math.max(0, buffer.length - limit));
    },
    clear() {
      buffer.length = 0;
    },
  };
}

function startScumConsoleAgent(options = {}) {
  const env = options.env || process.env;
  const settings = getAgentSettings(env);
  const name = String(options.name || 'scum-console-agent').trim() || 'scum-console-agent';

  let managedChild = null;
  let managedChildExit = null;
  let lastCommandAt = null;
  let lastError = null;
  let startedAt = new Date().toISOString();
  let executeCount = 0;
  let executionQueue = Promise.resolve();
  const recentStdout = createOutputBuffer(120);
  const recentStderr = createOutputBuffer(120);
  const recentExecutions = [];

  function pushExecution(entry) {
    recentExecutions.push({
      at: new Date().toISOString(),
      ...entry,
    });
    if (recentExecutions.length > 25) {
      recentExecutions.splice(0, recentExecutions.length - 25);
    }
  }

  function getManagedServerState() {
    return {
      running: Boolean(managedChild && !managedChild.killed),
      pid: managedChild?.pid || null,
      exit: managedChildExit,
      exe: settings.serverExe || null,
      workdir: settings.serverWorkdir || null,
      args: settings.serverArgs,
      stdoutTail: recentStdout.tail(),
      stderrTail: recentStderr.tail(),
    };
  }

  function attachManagedChild(child) {
    managedChild = child;
    managedChildExit = null;
    recentStdout.clear();
    recentStderr.clear();
    child.stdout?.on('data', (chunk) => {
      recentStdout.push(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      recentStderr.push(chunk);
    });
    child.on('exit', (code, signal) => {
      managedChildExit = { code, signal, at: new Date().toISOString() };
      managedChild = null;
    });
  }

  function ensureCommandAllowed(command) {
    const trimmed = String(command || '').trim();
    if (!trimmed) {
      throw new Error('command is required');
    }
    if (!settings.allowNonHashCommands && !trimmed.startsWith('#')) {
      throw new Error(
        'agent only allows SCUM admin commands starting with # by default',
      );
    }
    return trimmed;
  }

  async function ensureManagedServerStarted() {
    if (managedChild && !managedChild.killed) {
      return managedChild;
    }
    if (!settings.serverExe) {
      throw new Error('SCUM_CONSOLE_AGENT_SERVER_EXE is required for process backend');
    }

    const child = spawn(settings.serverExe, settings.serverArgs, {
      cwd: settings.serverWorkdir || path.dirname(settings.serverExe),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
    attachManagedChild(child);
    await wait(settings.processResponseWaitMs);
    return child;
  }

  async function executeWithExecBackend(command) {
    if (!settings.execTemplate) {
      throw new Error('SCUM_CONSOLE_AGENT_EXEC_TEMPLATE is not set');
    }
    const shellCommand = substituteTemplate(settings.execTemplate, { command });
    const result = await execShell(shellCommand, settings.commandTimeoutMs);
    return {
      backend: 'exec',
      accepted: true,
      shellCommand,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  async function executeWithProcessBackend(command) {
    const child = await ensureManagedServerStarted();
    if (!child.stdin || child.stdin.destroyed || !child.stdin.writable) {
      throw new Error('managed server stdin is not writable');
    }
    child.stdin.write(`${command}\n`);
    await wait(settings.processResponseWaitMs);
    return {
      backend: 'process',
      accepted: true,
      pid: child.pid,
      stdout: trimText(recentStdout.tail().join('\n')),
      stderr: trimText(recentStderr.tail().join('\n')),
    };
  }

  async function executeCommand(command) {
    const normalizedCommand = ensureCommandAllowed(command);
    const executeOnce = async () => {
      lastCommandAt = new Date().toISOString();
      executeCount += 1;

      let result;
      if (settings.backend === 'process') {
        result = await executeWithProcessBackend(normalizedCommand);
      } else {
        result = await executeWithExecBackend(normalizedCommand);
      }

      pushExecution({
        ok: true,
        backend: settings.backend,
        command: normalizedCommand,
        stdout: trimText(result.stdout, 250),
        stderr: trimText(result.stderr, 250),
      });
      return result;
    };

    const nextExecution = executionQueue.then(executeOnce);
    executionQueue = nextExecution.catch(() => {});
    return nextExecution;
  }

  function stopManagedServer() {
    if (!managedChild || managedChild.killed) return false;
    managedChild.kill();
    return true;
  }

  if (settings.backend === 'process' && settings.autoStartServer) {
    void ensureManagedServerStarted().catch((error) => {
      lastError = error.message;
      console.error(`[${name}] failed to autostart managed server:`, error.message);
    });
  }

  const server = http.createServer(async (req, res) => {
    const reply = createJsonResponder(res);
    const url = new URL(req.url || '/', `http://${settings.host}:${settings.port}`);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/healthz')) {
      return reply(200, {
        ok: true,
        service: name,
        backend: settings.backend,
        now: new Date().toISOString(),
        startedAt,
        lastCommandAt,
        lastError,
        executeCount,
        managedServer: getManagedServerState(),
      });
    }

    if (req.method !== 'POST') {
      return reply(405, { ok: false, error: 'method-not-allowed' });
    }

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
      || String(req.headers['x-agent-token'] || '').trim();
    if (!settings.token || token !== settings.token) {
      return reply(401, { ok: false, error: 'unauthorized' });
    }

    let body = {};
    try {
      body = await parseRequestBody(req);
    } catch (error) {
      return reply(400, { ok: false, error: error.message });
    }

    if (url.pathname === '/execute') {
      try {
        const result = await executeCommand(body.command);
        return reply(200, { ok: true, result });
      } catch (error) {
        lastError = error.message;
        pushExecution({
          ok: false,
          backend: settings.backend,
          command: String(body.command || '').trim(),
          error: error.message,
        });
        return reply(500, { ok: false, error: error.message });
      }
    }

    if (url.pathname === '/server/start') {
      try {
        if (settings.backend !== 'process') {
          throw new Error('server start is only supported for process backend');
        }
        const child = await ensureManagedServerStarted();
        return reply(200, {
          ok: true,
          started: true,
          pid: child.pid,
        });
      } catch (error) {
        lastError = error.message;
        return reply(500, { ok: false, error: error.message });
      }
    }

    if (url.pathname === '/server/stop') {
      const stopped = stopManagedServer();
      return reply(200, { ok: true, stopped });
    }

    return reply(404, { ok: false, error: 'not-found' });
  });

  server.on('error', (error) => {
    lastError = error.message;
    console.error(`[${name}] server error:`, error.message);
  });

  const ready = new Promise((resolve) => {
    server.listen(settings.port, settings.host, () => {
      console.log(`[${name}] listening at http://${settings.host}:${settings.port}`);
      console.log(`[${name}] backend=${settings.backend}`);
      resolve();
    });
  });

  return {
    settings,
    server,
    ready,
    async close() {
      if (managedChild && !managedChild.killed) {
        managedChild.kill();
      }
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

module.exports = {
  getAgentSettings,
  startScumConsoleAgent,
};
