'use strict';

/** Runtime profiles used by entrypoints, health, and topology logs. */

const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { getTenantDbIsolationMode } = require('../utils/tenantDbIsolation');
const { getTenantDatabaseTopologyMode } = require('../utils/tenantDatabaseTopology');
const { getBotFeatureFlags, getWorkerFeatureFlags } = require('./featureFlags');
const {
  parseBooleanEnv,
  parseIntegerEnv,
  parseTextEnv,
} = require('./schema');

function getBotRuntimeProfile(env = process.env) {
  const isTestRuntime =
    String(env.NODE_ENV || '').trim().toLowerCase() === 'test';
  return Object.freeze({
    runtime: 'bot',
    isTestRuntime,
    database: resolveDatabaseRuntime({
      databaseUrl: env.DATABASE_URL,
      provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
    }),
    tenantDbIsolationMode: getTenantDbIsolationMode(env),
    tenantDbTopologyMode: getTenantDatabaseTopologyMode(env),
    features: getBotFeatureFlags(env, { isTestRuntime }),
    health: Object.freeze({
      host: parseTextEnv(env.BOT_HEALTH_HOST, '127.0.0.1'),
      port: parseIntegerEnv(env.BOT_HEALTH_PORT, 0, 0),
    }),
  });
}

function getWorkerRuntimeProfile(env = process.env) {
  const features = getWorkerFeatureFlags(env);
  return Object.freeze({
    runtime: 'worker',
    database: resolveDatabaseRuntime({
      databaseUrl: env.DATABASE_URL,
      provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
    }),
    tenantDbIsolationMode: getTenantDbIsolationMode(env),
    tenantDbTopologyMode: getTenantDatabaseTopologyMode(env),
    features,
    heartbeatMs: parseIntegerEnv(env.WORKER_HEARTBEAT_MS, 60_000, 10_000),
    health: Object.freeze({
      host: parseTextEnv(env.WORKER_HEALTH_HOST, '127.0.0.1'),
      port: parseIntegerEnv(env.WORKER_HEALTH_PORT, 0, 0),
    }),
    executionMode: parseTextEnv(env.DELIVERY_EXECUTION_MODE, 'rcon').toLowerCase(),
    deliveryNativeProofMode: parseTextEnv(env.DELIVERY_NATIVE_PROOF_MODE, 'disabled').toLowerCase(),
    tenantMode: parseTextEnv(
      env.PLATFORM_TENANT_MODE || env.PLATFORM_DEFAULT_TENANT_ID ? 'scoped' : 'single',
      'single',
    ),
  });
}

function getWatcherRuntimeProfile(env = process.env) {
  return Object.freeze({
    runtime: 'watcher',
    enabled: parseBooleanEnv(env.SCUM_WATCHER_ENABLED, true),
    logPath: parseTextEnv(env.SCUM_LOG_PATH, ''),
    health: Object.freeze({
      host: parseTextEnv(env.SCUM_WATCHER_HEALTH_HOST, '127.0.0.1'),
      port: parseIntegerEnv(env.SCUM_WATCHER_HEALTH_PORT, 0, 0),
    }),
  });
}

module.exports = {
  getBotRuntimeProfile,
  getWatcherRuntimeProfile,
  getWorkerRuntimeProfile,
};
