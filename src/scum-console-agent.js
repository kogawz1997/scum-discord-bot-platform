require('dotenv').config();

const { startScumConsoleAgent } = require('./services/scumConsoleAgent');
const { assertDeliveryAgentEnv } = require('./utils/env');

assertDeliveryAgentEnv(process.env);

const runtime = startScumConsoleAgent();

async function shutdown(signal) {
  console.log(`[scum-console-agent] shutting down (${signal})`);
  await runtime.close().catch(() => null);
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
