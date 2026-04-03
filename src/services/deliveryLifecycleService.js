'use strict';

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function nowIso() {
  return new Date().toISOString();
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildScopeLabel(tenantId) {
  return trimText(tenantId, 120) || 'global';
}

function classifyQueueEntry(row, thresholds, nowMs) {
  const attempts = asInt(row?.attempts, 0);
  const retryable = typeof row?.retryable === 'boolean' ? row.retryable : null;
  const referenceAt =
    parseDateOrNull(row?.nextAttemptAt)
    || parseDateOrNull(row?.updatedAt)
    || parseDateOrNull(row?.createdAt);
  const ageMs = referenceAt ? Math.max(0, nowMs - referenceAt.getTime()) : 0;
  const isOverdue = ageMs >= thresholds.pendingOverdueMs;
  const isRetryHeavy = attempts >= thresholds.retryHeavyAttempts;
  const isPoisonCandidate =
    attempts >= thresholds.poisonAttempts
    || (retryable === false && attempts >= thresholds.retryHeavyAttempts);
  let signalKey = 'queued';
  let tone = 'info';
  if (isPoisonCandidate) {
    signalKey = 'poisonCandidate';
    tone = 'danger';
  } else if (isOverdue) {
    signalKey = 'overdue';
    tone = 'warning';
  } else if (isRetryHeavy) {
    signalKey = 'retryHeavy';
    tone = 'warning';
  }
  return {
    purchaseCode: trimText(row?.purchaseCode || row?.code, 120),
    tenantId: trimText(row?.tenantId, 120),
    status: trimText(row?.status, 80) || 'queued',
    attempts,
    retryable,
    signalKey,
    tone,
    ageMs,
    at: referenceAt ? referenceAt.toISOString() : null,
    errorCode: trimText(row?.lastErrorCode, 120) || null,
    detail:
      trimText(row?.lastError, 240)
      || trimText(row?.recoveryHint, 240)
      || trimText(row?.reason, 240)
      || null,
  };
}

function classifyDeadLetterEntry(row, thresholds, nowMs) {
  const attempts = asInt(row?.attempts, 0);
  const retryable = typeof row?.retryable === 'boolean' ? row.retryable : null;
  const referenceAt =
    parseDateOrNull(row?.updatedAt)
    || parseDateOrNull(row?.createdAt)
    || parseDateOrNull(row?.lastAttemptAt);
  const ageMs = referenceAt ? Math.max(0, nowMs - referenceAt.getTime()) : 0;
  const isPoisonCandidate =
    attempts >= thresholds.poisonAttempts
    || retryable === false;
  let signalKey = 'deadLetter';
  let tone = 'warning';
  if (isPoisonCandidate) {
    signalKey = 'poisonCandidate';
    tone = 'danger';
  } else if (retryable === true) {
    signalKey = 'retryableDeadLetter';
    tone = 'warning';
  } else if (retryable === false) {
    signalKey = 'nonRetryableDeadLetter';
    tone = 'danger';
  }
  return {
    purchaseCode: trimText(row?.purchaseCode || row?.code, 120),
    tenantId: trimText(row?.tenantId, 120),
    status: trimText(row?.status, 80) || 'dead-letter',
    attempts,
    retryable,
    signalKey,
    tone,
    ageMs,
    at: referenceAt ? referenceAt.toISOString() : null,
    errorCode: trimText(row?.lastErrorCode, 120) || null,
    detail:
      trimText(row?.reason, 240)
      || trimText(row?.lastError, 240)
      || trimText(row?.recoveryHint, 240)
      || null,
  };
}

function buildSignalRows(summary, thresholds) {
  const rows = [];
  if (summary.poisonCandidateCount > 0) {
    rows.push({
      key: 'poisonCandidate',
      tone: 'danger',
      count: summary.poisonCandidateCount,
      detail: `Attempts >= ${thresholds.poisonAttempts} or marked non-retryable.`,
    });
  }
  if (summary.overdueCount > 0) {
    rows.push({
      key: 'overdue',
      tone: 'warning',
      count: summary.overdueCount,
      detail: `Queue entries have waited longer than ${Math.round(thresholds.pendingOverdueMs / 60000)} minutes.`,
    });
  }
  if (summary.retryHeavyCount > 0) {
    rows.push({
      key: 'retryHeavy',
      tone: 'warning',
      count: summary.retryHeavyCount,
      detail: `Queue or dead-letter entries reached ${thresholds.retryHeavyAttempts}+ attempts.`,
    });
  }
  if (summary.retryableDeadLetters > 0) {
    rows.push({
      key: 'retryableDeadLetter',
      tone: 'warning',
      count: summary.retryableDeadLetters,
      detail: 'Dead-letter entries still marked retryable and ready for guided recovery.',
    });
  }
  if (summary.nonRetryableDeadLetters > 0) {
    rows.push({
      key: 'nonRetryableDeadLetter',
      tone: 'danger',
      count: summary.nonRetryableDeadLetters,
      detail: 'Dead-letter entries require operator review before replaying.',
    });
  }
  if (!rows.length) {
    rows.push({
      key: 'healthy',
      tone: 'success',
      count: 0,
      detail: 'No overdue, poison-candidate, or dead-letter pressure was detected in the sampled lifecycle state.',
    });
  }
  return rows;
}

function buildTopErrors(queueRows, deadLetterRows) {
  const counts = new Map();
  for (const row of [...queueRows, ...deadLetterRows]) {
    const key =
      trimText(row?.lastErrorCode, 120)
      || trimText(row?.reason, 120)
      || trimText(row?.lastError, 120)
      || 'UNKNOWN';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      count,
      tone: key === 'UNKNOWN' ? 'neutral' : (count >= 3 ? 'danger' : 'warning'),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return String(left.key).localeCompare(String(right.key));
    })
    .slice(0, 8);
}

function uniqueCodes(rows, predicate, limit = 12) {
  const seen = new Set();
  const values = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof predicate === 'function' && !predicate(row)) continue;
    const code = trimText(row?.purchaseCode || row?.code, 120);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    values.push(code);
    if (values.length >= limit) break;
  }
  return values;
}

function buildActionPlan(summary, runtime, queueWatch, deadLetterWatch, topErrors) {
  const overdueQueueCodes = uniqueCodes(
    queueWatch,
    (row) => row.signalKey === 'overdue' && row.retryable !== false,
  );
  const queueRetryCodes = uniqueCodes(
    queueWatch,
    (row) => row.retryable !== false && (row.signalKey === 'overdue' || row.signalKey === 'retryHeavy'),
  );
  const deadLetterRetryCodes = uniqueCodes(
    deadLetterWatch,
    (row) => row.retryable !== false && row.signalKey === 'retryableDeadLetter',
  );
  const poisonReviewCodes = uniqueCodes(
    [...queueWatch, ...deadLetterWatch],
    (row) => row.signalKey === 'poisonCandidate' || row.signalKey === 'nonRetryableDeadLetter',
  );
  const runtimeNeedsReview =
    runtime?.enabled === false
    || runtime?.workerStarted === false
    || summary.overdueCount > 0;
  const topError = Array.isArray(topErrors) ? topErrors[0] || null : null;
  const actions = [];

  if (runtimeNeedsReview) {
    actions.push({
      key: 'review-runtime-before-retry',
      tone: summary.overdueCount > 0 ? 'warning' : 'danger',
      count: Math.max(summary.overdueCount, summary.queueCount, 0),
      codes: overdueQueueCodes,
      topErrorKey: topError?.key || null,
    });
  }

  if (queueRetryCodes.length > 0) {
    actions.push({
      key: 'retry-queue-batch',
      tone: 'warning',
      count: queueRetryCodes.length,
      codes: queueRetryCodes,
      topErrorKey: topError?.key || null,
    });
  }

  if (deadLetterRetryCodes.length > 0) {
    actions.push({
      key: 'retry-dead-letter-batch',
      tone: 'warning',
      count: deadLetterRetryCodes.length,
      codes: deadLetterRetryCodes,
      topErrorKey: topError?.key || null,
    });
  }

  if (poisonReviewCodes.length > 0) {
    actions.push({
      key: 'hold-poison-candidates',
      tone: 'danger',
      count: poisonReviewCodes.length,
      codes: poisonReviewCodes,
      topErrorKey: topError?.key || null,
    });
  }

  if (topError && topError.key && topError.key !== 'UNKNOWN') {
    actions.push({
      key: 'inspect-top-error',
      tone: topError.count >= 3 ? 'warning' : 'info',
      count: topError.count,
      codes: [],
      topErrorKey: topError.key,
    });
  }

  if (!actions.length) {
    actions.push({
      key: 'lifecycle-stable',
      tone: 'success',
      count: 0,
      codes: [],
      topErrorKey: null,
    });
  }

  return {
    actions,
    codeSets: {
      overdueQueueCodes,
      queueRetryCodes,
      deadLetterRetryCodes,
      poisonReviewCodes,
    },
  };
}

function resolveDeliveryLifecycleDeps(overrides = {}) {
  const resolved = {
    ...(overrides && typeof overrides === 'object' ? overrides : {}),
  };
  if (
    !resolved.getDeliveryRuntimeSnapshotSync
    || !resolved.listFilteredDeliveryQueue
    || !resolved.listFilteredDeliveryDeadLetters
  ) {
    const rconDelivery = require('./rconDelivery');
    resolved.getDeliveryRuntimeSnapshotSync =
      resolved.getDeliveryRuntimeSnapshotSync || rconDelivery.getDeliveryRuntimeSnapshotSync;
    resolved.listFilteredDeliveryQueue =
      resolved.listFilteredDeliveryQueue || rconDelivery.listFilteredDeliveryQueue;
    resolved.listFilteredDeliveryDeadLetters =
      resolved.listFilteredDeliveryDeadLetters || rconDelivery.listFilteredDeliveryDeadLetters;
  }
  return resolved;
}

async function buildDeliveryLifecycleReport(options = {}) {
  const scopedTenantId = trimText(options.tenantId, 120) || null;
  const limit = Math.max(20, Math.min(500, asInt(options.limit, 120, 20)));
  const thresholds = {
    pendingOverdueMs: Math.max(60 * 1000, asInt(options.pendingOverdueMs, 20 * 60 * 1000, 60 * 1000)),
    retryHeavyAttempts: Math.max(2, asInt(options.retryHeavyAttempts, 3, 2)),
    poisonAttempts: Math.max(3, asInt(options.poisonAttempts, 5, 3)),
  };
  const deps = resolveDeliveryLifecycleDeps(options.deps);
  const [runtime, rawQueueRows, rawDeadLetterRows] = await Promise.all([
    Promise.resolve(deps.getDeliveryRuntimeSnapshotSync()),
    Promise.resolve(
      deps.listFilteredDeliveryQueue({
        limit,
        tenantId: scopedTenantId || undefined,
      }),
    ),
    Promise.resolve(
      deps.listFilteredDeliveryDeadLetters({
        limit,
        tenantId: scopedTenantId || undefined,
      }),
    ),
  ]);

  const queueRows = Array.isArray(rawQueueRows) ? rawQueueRows : [];
  const deadLetterRows = Array.isArray(rawDeadLetterRows) ? rawDeadLetterRows : [];
  const nowMs = Date.now();

  const queueWatch = queueRows
    .map((row) => classifyQueueEntry(row, thresholds, nowMs))
    .sort((left, right) => {
      const toneWeight = { danger: 3, warning: 2, info: 1 };
      const leftWeight = toneWeight[left.tone] || 0;
      const rightWeight = toneWeight[right.tone] || 0;
      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      if (right.attempts !== left.attempts) return right.attempts - left.attempts;
      return right.ageMs - left.ageMs;
    })
    .slice(0, 12);

  const deadLetterWatch = deadLetterRows
    .map((row) => classifyDeadLetterEntry(row, thresholds, nowMs))
    .sort((left, right) => {
      const toneWeight = { danger: 3, warning: 2, info: 1 };
      const leftWeight = toneWeight[left.tone] || 0;
      const rightWeight = toneWeight[right.tone] || 0;
      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      if (right.attempts !== left.attempts) return right.attempts - left.attempts;
      return right.ageMs - left.ageMs;
    })
    .slice(0, 12);

  const summary = {
    queueCount: queueRows.length,
    deadLetterCount: deadLetterRows.length,
    inFlightCount: asInt(runtime?.inFlightCount, 0),
    overdueCount: queueWatch.filter((row) => row.signalKey === 'overdue').length,
    retryHeavyCount: [...queueWatch, ...deadLetterWatch].filter((row) => row.attempts >= thresholds.retryHeavyAttempts).length,
    poisonCandidateCount: [...queueWatch, ...deadLetterWatch].filter((row) => row.signalKey === 'poisonCandidate').length,
    retryableDeadLetters: deadLetterWatch.filter((row) => row.signalKey === 'retryableDeadLetter').length,
    nonRetryableDeadLetters: deadLetterWatch.filter((row) => row.signalKey === 'nonRetryableDeadLetter' || row.signalKey === 'poisonCandidate').length,
    recentSuccessCount: asInt(runtime?.recentSuccessCount, 0),
  };
  const topErrors = buildTopErrors(queueRows, deadLetterRows);

  return {
    generatedAt: nowIso(),
    tenantId: scopedTenantId,
    scope: buildScopeLabel(scopedTenantId),
    thresholds,
    runtime: {
      enabled: Boolean(runtime?.enabled),
      executionMode: trimText(runtime?.executionMode, 80) || 'unknown',
      workerStarted: Boolean(runtime?.workerStarted),
      workerBusy: Boolean(runtime?.workerBusy),
      queueLength: asInt(runtime?.queueLength, queueRows.length),
      deadLetterCount: asInt(runtime?.deadLetterCount, deadLetterRows.length),
      inFlightCount: asInt(runtime?.inFlightCount, 0),
      recentSuccessCount: asInt(runtime?.recentSuccessCount, 0),
    },
    summary,
    signals: buildSignalRows(summary, thresholds),
    queueWatch,
    deadLetterWatch,
    topErrors,
    actionPlan: buildActionPlan(
      summary,
      runtime,
      queueWatch,
      deadLetterWatch,
      topErrors,
    ),
  };
}

function buildDeliveryLifecycleCsv(report) {
  const rows = [
    ['generatedAt', report?.generatedAt || nowIso()],
    ['scope', report?.scope || 'global'],
    ['tenantId', report?.tenantId || ''],
    ['queueCount', asInt(report?.summary?.queueCount, 0)],
    ['deadLetterCount', asInt(report?.summary?.deadLetterCount, 0)],
    ['inFlightCount', asInt(report?.summary?.inFlightCount, 0)],
    ['overdueCount', asInt(report?.summary?.overdueCount, 0)],
    ['retryHeavyCount', asInt(report?.summary?.retryHeavyCount, 0)],
    ['poisonCandidateCount', asInt(report?.summary?.poisonCandidateCount, 0)],
    ['retryableDeadLetters', asInt(report?.summary?.retryableDeadLetters, 0)],
    ['nonRetryableDeadLetters', asInt(report?.summary?.nonRetryableDeadLetters, 0)],
    ['recentSuccessCount', asInt(report?.summary?.recentSuccessCount, 0)],
    ['executionMode', report?.runtime?.executionMode || 'unknown'],
    ['workerStarted', report?.runtime?.workerStarted ? 'true' : 'false'],
    ['workerBusy', report?.runtime?.workerBusy ? 'true' : 'false'],
    ['signals', (Array.isArray(report?.signals) ? report.signals : []).map((row) => `${row.key}:${row.count}`).join(' | ')],
    ['topErrors', (Array.isArray(report?.topErrors) ? report.topErrors : []).map((row) => `${row.key}:${row.count}`).join(' | ')],
    ['recommendedActions', (Array.isArray(report?.actionPlan?.actions) ? report.actionPlan.actions : []).map((row) => `${row.key}:${row.count}`).join(' | ')],
  ];
  return `${['key', 'value'].join(',')}\n${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

module.exports = {
  buildDeliveryLifecycleReport,
  buildDeliveryLifecycleCsv,
};
