'use strict';

const JOB_TYPES = Object.freeze([
  'delivery_job',
  'config_update',
  'restart_server',
  'sync_log',
]);

const RESTART_MODES = Object.freeze(['immediate', 'delayed', 'safe_restart']);
const SERVER_CONTROL_MODES = Object.freeze(['script', 'service', 'process']);

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeJobType(value, fallback = 'delivery_job') {
  const text = trimText(value, 80).toLowerCase();
  return JOB_TYPES.includes(text) ? text : fallback;
}

function normalizeRestartMode(value, fallback = 'delayed') {
  const text = trimText(value, 80).toLowerCase();
  return RESTART_MODES.includes(text) ? text : fallback;
}

function normalizeServerControlMode(value, fallback = 'process') {
  const text = trimText(value, 80).toLowerCase();
  return SERVER_CONTROL_MODES.includes(text) ? text : fallback;
}

function normalizeInteger(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function normalizeObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function baseJobPayload(input = {}, type) {
  return {
    jobType: normalizeJobType(type || input.jobType),
    tenantId: trimText(input.tenantId, 120),
    serverId: trimText(input.serverId, 120),
    guildId: trimText(input.guildId, 120) || null,
    agentId: trimText(input.agentId, 120) || null,
    requestedBy: trimText(input.requestedBy, 120) || 'system',
    metadata: normalizeObject(input.metadata),
  };
}

function normalizeDeliveryJobPayload(input = {}) {
  return {
    ...baseJobPayload(input, 'delivery_job'),
    orderId: trimText(input.orderId, 120) || null,
    purchaseCode: trimText(input.purchaseCode, 120) || null,
    command: trimText(input.command, 400) || null,
    proofMode: trimText(input.proofMode, 120) || null,
  };
}

function normalizeConfigUpdatePayload(input = {}) {
  return {
    ...baseJobPayload(input, 'config_update'),
    configFile: trimText(input.configFile, 240) || null,
    requiresRestart: input.requiresRestart === true,
    patch: normalizeObject(input.patch),
    schema: normalizeObject(input.schema),
  };
}

function normalizeRestartServerPayload(input = {}) {
  return {
    ...baseJobPayload(input, 'restart_server'),
    restartMode: normalizeRestartMode(input.restartMode),
    controlMode: normalizeServerControlMode(input.controlMode),
    delaySeconds: normalizeInteger(input.delaySeconds, 0, 0),
    reason: trimText(input.reason, 240) || null,
    announcementPlan: Array.isArray(input.announcementPlan)
      ? input.announcementPlan.map((entry) => ({
        delaySeconds: normalizeInteger(entry?.delaySeconds, 0, 0),
        message: trimText(entry?.message, 320) || null,
      })).filter((entry) => entry.message)
      : [],
  };
}

function normalizeSyncLogPayload(input = {}) {
  return {
    ...baseJobPayload(input, 'sync_log'),
    runtimeKey: trimText(input.runtimeKey, 160) || null,
    sourcePath: trimText(input.sourcePath, 320) || null,
    freshnessAt: trimText(input.freshnessAt, 80) || null,
  };
}

module.exports = {
  JOB_TYPES,
  RESTART_MODES,
  SERVER_CONTROL_MODES,
  normalizeConfigUpdatePayload,
  normalizeDeliveryJobPayload,
  normalizeJobType,
  normalizeRestartServerPayload,
  normalizeServerControlMode,
  normalizeSyncLogPayload,
};
