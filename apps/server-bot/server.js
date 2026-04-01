'use strict';

require('dotenv').config();

const { startScumServerBotRuntime } = require('../../src/services/scumServerBotRuntime');
const { assertServerBotEnv } = require('../../src/utils/env');

function installShutdown(runtime) {
  const shutdown = async (code = 0) => {
    await runtime?.close?.().catch(() => null);
    process.exit(code);
  };

  process.once('SIGINT', () => void shutdown(0));
  process.once('SIGTERM', () => void shutdown(0));
}

async function startServerBotRuntime() {
  assertServerBotEnv(process.env);
  const runtime = startScumServerBotRuntime();
  installShutdown(runtime);

  try {
    const started = await runtime.start();
    if (!started?.ok) {
      console.error('[scum-server-bot] startup failed', started?.error || 'unknown-error');
      await runtime.close().catch(() => null);
      process.exit(1);
    }
    return runtime;
  } catch (error) {
    console.error('[scum-server-bot] startup failed', error?.message || error);
    await runtime.close().catch(() => null);
    process.exit(1);
  }
  return null;
}

if (require.main === module) {
  void startServerBotRuntime();
}

module.exports = {
  startScumServerBotRuntime,
  startServerBotRuntime,
};
