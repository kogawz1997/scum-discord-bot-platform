const crypto = require('node:crypto');
const fs = require('node:fs');

const { prisma } = require('../prisma');
const { atomicWriteJson, getFilePath, isDbPersistenceEnabled } = require('./_persist');

const MAX_NOTIFICATIONS = 500;
const FILE_PATH = getFilePath('admin-notifications.json');

const notifications = [];
let initPromise = null;
let writeQueue = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function trimText(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function createId(prefix = 'admin-note') {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  return `${prefix}-${suffix}`;
}

function normalizeNotification(entry = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
  const acknowledgedAt = entry.acknowledgedAt ? new Date(entry.acknowledgedAt) : null;
  return {
    id: String(entry.id || createId()),
    type: String(entry.type || 'notice').trim() || 'notice',
    source: String(entry.source || 'system').trim() || 'system',
    kind: String(entry.kind || 'notice').trim() || 'notice',
    severity: String(entry.severity || 'info').trim() || 'info',
    title: trimText(entry.title || entry.kind || 'Notification', 180),
    message: trimText(entry.message || '', 600),
    entityKey: String(entry.entityKey || '').trim() || null,
    data: entry.data && typeof entry.data === 'object' ? entry.data : null,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    acknowledgedAt:
      acknowledgedAt && !Number.isNaN(acknowledgedAt.getTime())
        ? acknowledgedAt
        : null,
    acknowledgedBy: String(entry.acknowledgedBy || '').trim() || null,
  };
}

function getNotificationTenantId(entry = {}) {
  return trimText(
    entry?.tenantId
      || entry?.data?.tenantId
      || entry?.data?.tenant?.id,
    160,
  ) || null;
}

function parseDataJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  const text = trimText(value, 5000);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function serializeNotificationRow(row) {
  const normalized = normalizeNotification(row);
  if (!normalized) return null;
  return {
    id: normalized.id,
    type: normalized.type,
    source: normalized.source,
    kind: normalized.kind,
    severity: normalized.severity,
    title: normalized.title,
    message: normalized.message,
    entityKey: normalized.entityKey,
    dataJson: normalized.data ? JSON.stringify(normalized.data) : null,
    acknowledgedAt: normalized.acknowledgedAt || null,
    acknowledgedBy: normalized.acknowledgedBy || null,
    createdAt: normalized.createdAt,
  };
}

function getNotificationDelegate(client = prisma) {
  if (!client || typeof client !== 'object') return null;
  const delegate = client.platformAdminNotification;
  if (!delegate || typeof delegate.findMany !== 'function') return null;
  return delegate;
}

function getPersistenceMode() {
  const explicit = String(process.env.ADMIN_NOTIFICATION_STORE_MODE || '').trim().toLowerCase();
  if (explicit === 'file') return 'file';
  if (explicit === 'db') return 'db';
  if (typeof isDbPersistenceEnabled === 'function' && isDbPersistenceEnabled()) {
    return 'db';
  }
  return 'auto';
}

function shouldFallbackToFile(error) {
  const code = String(error?.code || '').trim().toUpperCase();
  if (['P2021', 'P2022', 'P1017'].includes(code)) return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('no such table')
    || message.includes('does not exist')
    || message.includes('unknown table')
    || message.includes('error validating datasource')
    || message.includes('url must start with the protocol')
    || message.includes('platformadminnotification');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getNotificationDelegate();
  if (mode === 'file' || !delegate) {
    return fileWork();
  }
  try {
    return await dbWork(delegate);
  } catch (error) {
    if (mode === 'db' || !shouldFallbackToFile(error)) {
      throw error;
    }
    return fileWork();
  }
}

function queueWrite(work, label) {
  writeQueue = writeQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[adminNotificationStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function writeSnapshotToDisk() {
  atomicWriteJson(FILE_PATH, notifications);
}

async function writeSnapshotToDatabase(delegate = getNotificationDelegate()) {
  if (!delegate) return;
  const rows = dedupeNotifications(notifications)
    .map(serializeNotificationRow)
    .filter(Boolean);
  await delegate.deleteMany({});
  if (rows.length > 0 && typeof delegate.upsert === 'function') {
    for (const row of rows) {
      await delegate.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    }
    return;
  }
  if (rows.length > 0) {
    await delegate.createMany({ data: rows });
  }
}

async function writeSnapshot() {
  return runWithPreferredPersistence(
    (delegate) => writeSnapshotToDatabase(delegate),
    async () => writeSnapshotToDisk(),
  );
}

async function hydrateFromDisk() {
  try {
    if (!fs.existsSync(FILE_PATH)) return;
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    notifications.length = 0;
    for (const row of Array.isArray(parsed) ? parsed : []) {
      const normalized = normalizeNotification(row);
      if (!normalized) continue;
      notifications.push(normalized);
    }
    notifications.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (notifications.length > MAX_NOTIFICATIONS) {
      notifications.splice(0, notifications.length - MAX_NOTIFICATIONS);
    }
  } catch (error) {
    console.error('[adminNotificationStore] failed to hydrate:', error.message);
  }
}

async function hydrateFromDatabase(delegate = getNotificationDelegate()) {
  if (!delegate) return;
  const rows = await delegate.findMany({
    orderBy: { createdAt: 'asc' },
    take: MAX_NOTIFICATIONS,
  });
  notifications.length = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const normalized = normalizeNotification({
      ...row,
      data: parseDataJson(row.dataJson),
    });
    if (!normalized) continue;
    notifications.push(normalized);
  }
  const deduped = dedupeNotifications(notifications);
  notifications.length = 0;
  notifications.push(...deduped);
}

function dedupeNotifications(sourceRows = []) {
  const deduped = new Map();
  for (const row of Array.isArray(sourceRows) ? sourceRows : []) {
    const normalized = normalizeNotification(row);
    if (!normalized) continue;
    deduped.set(normalized.id, normalized);
  }
  return Array.from(deduped.values())
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-MAX_NOTIFICATIONS);
}

function initAdminNotificationStore() {
  if (!initPromise) {
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    ).catch(async (error) => {
      if (getPersistenceMode() === 'db' || !shouldFallbackToFile(error)) {
        throw error;
      }
      console.error('[adminNotificationStore] failed to hydrate from prisma:', error.message);
      await hydrateFromDisk();
    });
  }
  return initPromise;
}

function addAdminNotification(entry = {}) {
  const normalized = normalizeNotification(entry);
  if (!normalized) return null;
  const deduped = dedupeNotifications([...notifications, normalized]);
  notifications.length = 0;
  notifications.push(...deduped);
  queueWrite(writeSnapshot, 'add');
  return { ...normalized };
}

function listAdminNotifications(options = {}) {
  const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
  const typeFilter = String(options.type || '').trim().toLowerCase();
  const kindFilter = String(options.kind || '').trim().toLowerCase();
  const severityFilter = String(options.severity || '').trim().toLowerCase();
  const entityKeyFilter = String(options.entityKey || '').trim().toLowerCase();
  const tenantIdFilter = trimText(options.tenantId, 160).toLowerCase();
  const acknowledgedFilter =
    typeof options.acknowledged === 'boolean' ? options.acknowledged : null;

  return notifications
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((row) => {
      if (typeFilter && String(row.type || '').toLowerCase() !== typeFilter) return false;
      if (kindFilter && String(row.kind || '').toLowerCase() !== kindFilter) return false;
      if (severityFilter && String(row.severity || '').toLowerCase() !== severityFilter) return false;
      if (
        entityKeyFilter
        && String(row.entityKey || '').toLowerCase() !== entityKeyFilter
      ) {
        return false;
      }
      if (
        tenantIdFilter
        && String(getNotificationTenantId(row) || '').toLowerCase() !== tenantIdFilter
      ) {
        return false;
      }
      if (acknowledgedFilter === true && !row.acknowledgedAt) return false;
      if (acknowledgedFilter === false && row.acknowledgedAt) return false;
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      ...row,
      tenantId: getNotificationTenantId(row),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      acknowledgedAt:
        row.acknowledgedAt instanceof Date
          ? row.acknowledgedAt.toISOString()
          : row.acknowledgedAt,
    }));
}

function acknowledgeAdminNotifications(ids = [], actor = 'admin-web') {
  const wanted = new Set(
    (Array.isArray(ids) ? ids : [ids])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
  if (wanted.size === 0) {
    return { total: 0, updated: 0, items: [] };
  }

  const at = nowIso();
  const updated = [];
  for (const row of notifications) {
    if (!wanted.has(String(row.id || ''))) continue;
    row.acknowledgedAt = new Date(at);
    row.acknowledgedBy = String(actor || 'admin-web').trim() || 'admin-web';
    updated.push({
      ...row,
      createdAt: row.createdAt.toISOString(),
      acknowledgedAt: at,
    });
  }
  if (updated.length > 0) {
    queueWrite(writeSnapshot, 'acknowledge');
  }
  return {
    total: wanted.size,
    updated: updated.length,
    items: updated,
  };
}

function clearAdminNotifications(options = {}) {
  const acknowledgedOnly = options.acknowledgedOnly === true;
  const before = notifications.length;
  if (acknowledgedOnly) {
    const remaining = notifications.filter((row) => !row.acknowledgedAt);
    notifications.length = 0;
    notifications.push(...remaining);
  } else {
    notifications.length = 0;
  }
  const removed = Math.max(0, before - notifications.length);
  queueWrite(writeSnapshot, 'clear');
  return { removed, remaining: notifications.length };
}

function pruneAdminNotifications(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const referenceNow = Number.isNaN(now.getTime()) ? new Date() : now;
  const olderThanMs = Math.max(0, Number(options.olderThanMs || 0) || 0);
  const keepLatest = Math.max(0, Number(options.keepLatest || 0) || 0);
  const acknowledgedOnly = options.acknowledgedOnly === true;
  const cutoff = olderThanMs > 0 ? referenceNow.getTime() - olderThanMs : null;

  const sorted = notifications
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const removableIds = new Set();

  sorted.forEach((row, index) => {
    if (index < keepLatest) return;
    if (acknowledgedOnly && !row.acknowledgedAt) return;
    if (cutoff != null) {
      const createdAt = new Date(row.createdAt).getTime();
      if (!Number.isFinite(createdAt) || createdAt > cutoff) return;
    }
    removableIds.add(String(row.id || ''));
  });

  if (removableIds.size === 0) {
    return {
      removed: 0,
      remaining: notifications.length,
      cutoffAt: cutoff != null ? new Date(cutoff).toISOString() : null,
    };
  }

  const remaining = notifications.filter((row) => !removableIds.has(String(row.id || '')));
  notifications.length = 0;
  notifications.push(...remaining);
  queueWrite(writeSnapshot, 'prune');
  return {
    removed: removableIds.size,
    remaining: notifications.length,
    cutoffAt: cutoff != null ? new Date(cutoff).toISOString() : null,
  };
}

function replaceAdminNotifications(nextRows = []) {
  const deduped = dedupeNotifications(nextRows);
  notifications.length = 0;
  notifications.push(...deduped);
  queueWrite(writeSnapshot, 'replace');
  return notifications.length;
}

function waitForAdminNotificationPersistence() {
  return writeQueue;
}

function buildNotificationFromLiveEvent(type, payload = {}) {
  const eventType = String(type || '').trim();
  const data = payload && typeof payload === 'object' ? payload : {};

  if (eventType === 'ops-alert') {
    const kind = String(data.kind || 'ops-alert').trim() || 'ops-alert';
    const severity =
      kind === 'fail-rate'
        || kind === 'queue-stuck'
        || kind === 'backup-failed'
        || kind === 'dead-letter-threshold'
        || kind === 'consecutive-failures'
        || kind === 'runtime-offline'
        || kind === 'runtime-degraded'
        || kind === 'agent-circuit-open'
        || kind === 'platform-webhook-failed'
        || kind === 'platform-auto-backup-failed'
        || kind === 'platform-auto-restart-failed'
        || kind === 'platform-auto-monitoring-followup-failed'
        ? 'error'
        : 'warn';
    let title = 'Operational Alert';
    let message = trimText(JSON.stringify(data), 500);
    if (kind === 'queue-pressure') {
      title = 'Delivery Queue Pressure';
      message = `queue=${Number(data.queueLength || 0)} threshold=${Number(data.threshold || 0)}`;
    } else if (kind === 'queue-stuck') {
      title = 'Delivery Queue Stuck';
      message =
        `overdue=${Number(data.oldestDueMs || 0)}ms queue=${Number(data.queueLength || 0)}`
        + `${data.purchaseCode ? ` code=${data.purchaseCode}` : ''}`;
    } else if (kind === 'fail-rate') {
      title = 'Delivery Fail Rate Spike';
      message =
        `failRate=${Number(data.failRate || 0).toFixed(3)} failures=${Number(data.failures || 0)} `
        + `attempts=${Number(data.attempts || 0)}`;
    } else if (kind === 'dead-letter-threshold') {
      title = 'Dead-Letter Threshold Reached';
      message =
        `deadLetters=${Number(data.deadLetterCount || 0)} threshold=${Number(data.threshold || 0)}`;
    } else if (kind === 'consecutive-failures') {
      title = 'Consecutive Delivery Failures';
      message =
        `consecutive=${Number(data.consecutiveFailures || 0)} threshold=${Number(data.threshold || 0)}`
        + `${data.lastPurchaseCode ? ` code=${data.lastPurchaseCode}` : ''}`;
    } else if (kind === 'login-failure-spike') {
      title = 'Admin Login Failure Spike';
      message =
        `failures=${Number(data.failures || 0)} windowMs=${Number(data.windowMs || 0)}`
        + `${Array.isArray(data.hotIps) && data.hotIps.length > 0 ? ` hotIps=${data.hotIps.map((row) => row.ip).join(',')}` : ''}`;
    } else if (kind === 'runtime-offline') {
      title = 'Runtime Offline';
      message =
        `${String(data.runtimeLabel || data.runtimeKey || 'runtime')} offline`
        + `${data.reason ? ` (${String(data.reason)})` : ''}`
        + `${data.url ? ` @ ${String(data.url)}` : ''}`;
    } else if (kind === 'runtime-degraded') {
      title = 'Runtime Degraded';
      message =
        `${String(data.runtimeLabel || data.runtimeKey || 'runtime')} degraded`
        + `${data.reason ? ` (${String(data.reason)})` : ''}`
        + `${data.url ? ` @ ${String(data.url)}` : ''}`;
    } else if (kind === 'platform-webhook-failed') {
      title = 'Platform Webhook Failed';
      message =
        `${String(data.eventType || 'platform.unknown')} -> ${String(data.targetUrl || '-')}`
        + `${data.error ? ` error=${trimText(data.error, 200)}` : ''}`;
    } else if (kind === 'agent-version-outdated') {
      title = 'Agent Version Outdated';
      message =
        `${String(data.tenantId || 'tenant')} / ${String(data.runtimeKey || 'runtime')}`
        + ` version=${String(data.version || '-')}`
        + ` min=${String(data.minimumVersion || '-')}`;
    } else if (kind === 'agent-runtime-stale') {
      title = 'Agent Runtime Stale';
      message =
        `${String(data.tenantId || 'tenant')} / ${String(data.runtimeKey || 'runtime')}`
        + ` lastSeenAt=${String(data.lastSeenAt || '-')}`;
    } else if (kind === 'agent-circuit-open') {
      title = 'Agent Circuit Open';
      message =
        `consecutiveFailures=${Number(data.consecutiveFailures || 0)} threshold=${Number(data.threshold || 0)}`
        + `${data.lastFailureCode ? ` lastFailureCode=${String(data.lastFailureCode)}` : ''}`
        + `${data.lastFailureMessage ? ` lastFailureMessage=${trimText(data.lastFailureMessage, 120)}` : ''}`;
    } else if (kind === 'delivery-reconcile-anomaly') {
      title = 'Delivery Reconcile Anomaly';
      message =
        `count=${Number(data.count || 0)}`
        + `${Array.isArray(data.sample) && data.sample.length > 0 ? ` sample=${String(data.sample[0]?.type || '-')}` : ''}`;
    } else if (kind === 'delivery-abuse-suspected') {
      title = 'Delivery Abuse Suspected';
      message =
        `count=${Number(data.count || 0)}`
        + `${Array.isArray(data.sample) && data.sample.length > 0 ? ` sample=${String(data.sample[0]?.type || '-')}` : ''}`;
    } else if (kind === 'platform-auto-backup-created') {
      title = 'Platform Auto Backup Created';
      message =
        `backup=${String(data.backup || '-')}`
        + `${data.note ? ` note=${trimText(data.note, 120)}` : ''}`;
    } else if (kind === 'platform-auto-backup-failed') {
      title = 'Platform Auto Backup Failed';
      message = `${data.error ? trimText(data.error, 240) : 'unknown error'}`;
    } else if (kind === 'platform-auto-restart-started') {
      title = 'Platform Auto Recovery Started';
      message =
        `${String(data.runtimeLabel || data.runtimeKey || 'runtime')} -> ${String(data.serviceKey || '-')}`
        + `${data.reason ? ` reason=${trimText(data.reason, 160)}` : ''}`;
    } else if (kind === 'platform-auto-restart-succeeded') {
      title = 'Platform Auto Recovery Succeeded';
      message =
        `${String(data.runtimeLabel || data.runtimeKey || 'runtime')} -> ${String(data.serviceKey || '-')}`
        + `${Number.isFinite(Number(data.exitCode)) ? ` exit=${Number(data.exitCode)}` : ''}`;
    } else if (kind === 'platform-auto-restart-failed') {
      title = 'Platform Auto Recovery Failed';
      message =
        `${String(data.runtimeLabel || data.runtimeKey || 'runtime')} -> ${String(data.serviceKey || '-')}`
        + `${Number.isFinite(Number(data.exitCode)) ? ` exit=${Number(data.exitCode)}` : ''}`
        + `${data.stderr ? ` error=${trimText(data.stderr, 200)}` : ''}`;
    } else if (kind === 'platform-auto-monitoring-followup-failed') {
      title = 'Post-Recovery Monitoring Failed';
      message =
        `${String(data.runtimeLabel || data.runtimeKey || 'runtime')}`
        + `${data.error ? ` error=${trimText(data.error, 200)}` : ''}`;
    }
    return {
      type: 'ops-alert',
      source: String(data.source || 'ops').trim() || 'ops',
      kind,
      severity,
      title,
      message,
      entityKey: String(data.purchaseCode || kind).trim() || kind,
      data,
    };
  }

  if (eventType === 'backup-restore') {
    return {
      type: 'backup',
      source: 'admin-web',
      kind: 'restore',
      severity: 'info',
      title: 'Backup Restore Complete',
      message:
        `backup=${String(data.backup || '-')} actor=${String(data.actor || 'unknown')}`,
      entityKey: String(data.backup || '').trim() || null,
      data,
    };
  }

  if (eventType === 'backup-restore-started') {
    return {
      type: 'backup',
      source: 'admin-web',
      kind: 'restore-started',
      severity: 'warn',
      title: 'Backup Restore Started',
      message:
        `backup=${String(data.backup || '-')} rollback=${String(data.rollbackBackup || '-')}`,
      entityKey: String(data.backup || '').trim() || null,
      data,
    };
  }

  if (eventType === 'backup-restore-failed') {
    return {
      type: 'backup',
      source: 'admin-web',
      kind: 'restore-failed',
      severity: 'error',
      title: 'Backup Restore Failed',
      message:
        `backup=${String(data.backup || '-')} rollback=${String(data.rollbackStatus || 'unknown')}`
        + `${data.error ? ` error=${trimText(data.error, 200)}` : ''}`,
      entityKey: String(data.backup || '').trim() || null,
      data,
    };
  }

  if (eventType === 'backup-restore-rollback') {
    return {
      type: 'backup',
      source: 'admin-web',
      kind: 'rollback',
      severity: 'warn',
      title: 'Backup Restore Rolled Back',
      message:
        `backup=${String(data.backup || '-')} rollback=${String(data.rollbackBackup || '-')}`,
      entityKey: String(data.backup || '').trim() || null,
      data,
    };
  }

  if (eventType === 'backup-restore-rollback-failed') {
    return {
      type: 'backup',
      source: 'admin-web',
      kind: 'rollback-failed',
      severity: 'error',
      title: 'Backup Restore Rollback Failed',
      message:
        `backup=${String(data.backup || '-')} rollback=${String(data.rollbackBackup || '-')}`
        + `${data.error ? ` error=${trimText(data.error, 200)}` : ''}`,
      entityKey: String(data.backup || '').trim() || null,
      data,
    };
  }

  if (eventType === 'backup-create') {
    return {
      type: 'backup',
      source: 'admin-web',
      kind: 'create',
      severity: 'info',
      title: 'Backup Created',
      message:
        `backup=${String(data.backup || '-')} actor=${String(data.actor || 'unknown')}`,
      entityKey: String(data.backup || '').trim() || null,
      data,
    };
  }

  if (eventType === 'server-config-job-result') {
    const failed = ['failed', 'cancelled', 'error'].includes(String(data.status || '').trim().toLowerCase());
    const title = failed ? 'Server Settings Apply Failed' : 'Server Settings Applied';
    return {
      type: 'server-config',
      source: String(data.source || 'server-bot').trim() || 'server-bot',
      kind: failed ? 'config-job-failed' : 'config-job-succeeded',
      severity: failed ? 'error' : 'info',
      title,
      message: [
        String(data.serverName || data.serverId || 'server'),
        data.jobLabel ? `| ${String(data.jobLabel)}` : '',
        data.detail ? `| ${trimText(data.detail, 220)}` : '',
      ].join(' ').trim(),
      entityKey: String(data.jobId || data.serverId || '').trim() || null,
      data,
    };
  }

  if (eventType === 'restart-execution-result') {
    const failed = ['failed', 'error', 'cancelled'].includes(String(data.resultStatus || '').trim().toLowerCase());
    return {
      type: 'restart',
      source: String(data.source || 'server-bot').trim() || 'server-bot',
      kind: failed ? 'restart-failed' : 'restart-succeeded',
      severity: failed ? 'error' : 'info',
      title: failed ? 'Restart Failed' : 'Restart Completed',
      message: [
        String(data.serverName || data.serverId || 'server'),
        data.action ? `| ${String(data.action)}` : '',
        data.detail ? `| ${trimText(data.detail, 220)}` : '',
      ].join(' ').trim(),
      entityKey: String(data.executionId || data.planId || data.serverId || '').trim() || null,
      data,
    };
  }

  if (eventType === 'subscription-expiring') {
    const expiresAt = trimText(data.currentPeriodEnd || data.trialEndsAt, 160) || null;
    return {
      type: 'billing',
      source: String(data.source || 'platform-monitor').trim() || 'platform-monitor',
      kind: 'subscription-expiring',
      severity: 'warn',
      title: 'Subscription Expiring Soon',
      message: [
        String(data.tenantLabel || data.tenantSlug || data.tenantId || 'tenant'),
        data.packageName ? `| ${String(data.packageName)}` : '',
        expiresAt ? `| ends ${expiresAt}` : '',
        Number.isFinite(Number(data.daysRemaining)) ? `| ${Number(data.daysRemaining).toFixed(1)} days left` : '',
      ].join(' ').trim(),
      entityKey: String(data.subscriptionId || data.tenantId || '').trim() || null,
      data,
    };
  }

  if (eventType === 'command-template-update') {
    return {
      type: 'command-template',
      source: 'admin-web',
      kind: String(data.action || 'update').trim() || 'update',
      severity: 'info',
      title: 'Delivery Command Template Updated',
      message:
        `${String(data.lookupKey || '-')} by ${String(data.actor || 'unknown')}`,
      entityKey: String(data.lookupKey || '').trim() || null,
      data,
    };
  }

  if (eventType === 'platform-event') {
    const eventName = String(data.eventType || 'platform.unknown').trim() || 'platform.unknown';
    const label = eventName.replace(/^platform\./, '').replace(/[._-]+/g, ' ').trim();
    return {
      type: 'platform',
      source: String(data.source || 'platform').trim() || 'platform',
      kind: eventName,
      severity: 'info',
      title: `Platform Event: ${label || eventName}`,
      message:
        `${data.tenantId ? `tenant=${String(data.tenantId)} ` : ''}`
        + `${data.actor ? `actor=${String(data.actor)} ` : ''}`
        + `${data.subscriptionId ? `subscription=${String(data.subscriptionId)} ` : ''}`
        + `${data.licenseId ? `license=${String(data.licenseId)} ` : ''}`
        + `${data.apiKeyId ? `apiKey=${String(data.apiKeyId)} ` : ''}`
        + `${data.webhookId ? `webhook=${String(data.webhookId)} ` : ''}`
        + `${data.offerId ? `offer=${String(data.offerId)} ` : ''}`
        + `${data.runtimeKey ? `runtime=${String(data.runtimeKey)} ` : ''}`.trim(),
      entityKey:
        String(
          data.tenantId
          || data.subscriptionId
          || data.licenseId
          || data.apiKeyId
          || data.webhookId
          || data.offerId
          || eventName,
        ).trim() || eventName,
      data,
    };
  }

  return null;
}

function persistAdminLiveEvent(type, payload = {}) {
  const entry = buildNotificationFromLiveEvent(type, payload);
  if (!entry) return null;
  return addAdminNotification(entry);
}

initAdminNotificationStore();

module.exports = {
  addAdminNotification,
  acknowledgeAdminNotifications,
  clearAdminNotifications,
  initAdminNotificationStore,
  listAdminNotifications,
  persistAdminLiveEvent,
  pruneAdminNotifications,
  replaceAdminNotifications,
  waitForAdminNotificationPersistence,
};
