'use strict';

const {
  normalizeConfigUpdatePayload,
  normalizeRestartServerPayload,
} = require('../../contracts/jobs/jobContracts');

function buildRestartAnnouncementPlan(delaySeconds = 0, prefix = 'เซิร์ฟเวอร์จะรีสตาร์ต') {
  const totalDelay = Math.max(0, Number(delaySeconds) || 0);
  const checkpoints = [300, 60, 30, 10].filter((seconds) => seconds <= totalDelay);
  return checkpoints.map((seconds) => ({
    delaySeconds: seconds,
    message: `${prefix}ในอีก ${seconds} วินาที`,
  }));
}

function createServerControlJobService() {
  function createConfigUpdateJob(input = {}) {
    const payload = normalizeConfigUpdatePayload(input);
    return {
      ok: Boolean(payload.tenantId && payload.serverId),
      reason: payload.tenantId && payload.serverId ? 'ready' : 'tenant-server-required',
      job: payload,
    };
  }

  function createRestartServerJob(input = {}) {
    const payload = normalizeRestartServerPayload({
      ...input,
      announcementPlan: Array.isArray(input.announcementPlan) && input.announcementPlan.length > 0
        ? input.announcementPlan
        : buildRestartAnnouncementPlan(input.delaySeconds, input.announcementPrefix),
    });
    return {
      ok: Boolean(payload.tenantId && payload.serverId),
      reason: payload.tenantId && payload.serverId ? 'ready' : 'tenant-server-required',
      job: payload,
    };
  }

  return {
    buildRestartAnnouncementPlan,
    createConfigUpdateJob,
    createRestartServerJob,
  };
}

module.exports = {
  buildRestartAnnouncementPlan,
  createServerControlJobService,
};
