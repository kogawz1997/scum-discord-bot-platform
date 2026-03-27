'use strict';

const { startWatcher } = require('../../src/services/scumLogWatcherRuntime');
const { startScumServerBotRuntime } = require('../../src/services/scumServerBotRuntime');

if (require.main === module) {
  const watcher = startWatcher();
  const serverBot = startScumServerBotRuntime();
  void serverBot.start().catch((error) => {
    console.error('[scum-server-bot] startup failed', error?.message || error);
  });

  const shutdown = async () => {
    await Promise.allSettled([
      watcher?.close?.(),
      serverBot?.close?.(),
    ]);
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

module.exports = {
  startWatcher,
  startScumServerBotRuntime,
};
