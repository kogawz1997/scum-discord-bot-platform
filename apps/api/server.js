'use strict';

require('dotenv').config();

const { startAdminWebServer } = require('../../src/adminWebServer');
const { assertAdminRuntimeEnv } = require('../../src/utils/env');
const {
  assertControlPlaneRuntimeReadiness,
} = require('../../src/utils/controlPlaneRuntimeReadiness');

const defaultClient = {
  guilds: { cache: new Map() },
  channels: { fetch: async () => null },
};

let serverInstance = null;

function startApiServer(client = defaultClient) {
  assertAdminRuntimeEnv(process.env);
  assertControlPlaneRuntimeReadiness({
    env: process.env,
  });
  if (serverInstance?.listening) {
    return serverInstance;
  }
  serverInstance = startAdminWebServer(client);
  return serverInstance;
}

if (require.main === module) {
  startApiServer();
}

module.exports = {
  startApiServer,
};
