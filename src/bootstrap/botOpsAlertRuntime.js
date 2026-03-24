'use strict';

/**
 * Discord ops-alert bridge used by the bot runtime.
 * Keep alert formatting and Discord fan-out outside bot.js so bootstrap stays small.
 */

const { EmbedBuilder } = require('discord.js');

const OPS_ALERT_I18N = Object.freeze({
  en: Object.freeze({
    fallbackFieldName: 'Details',
    titles: Object.freeze({
      'queue-pressure': 'Delivery Queue Pressure',
      'queue-stuck': 'Delivery Queue Stuck',
      'fail-rate': 'Delivery Fail Rate Spike',
      'login-failure-spike': 'Admin Login Failure Spike',
      'delivery-reconcile-anomaly': 'Delivery Reconcile Anomaly',
      'delivery-abuse-suspected': 'Delivery Abuse Suspected',
      'tenant-quota-exceeded': 'Tenant Quota Exceeded',
      'tenant-quota-near-limit': 'Tenant Quota Near Limit',
      'runtime-offline': 'Runtime Offline',
      'runtime-degraded': 'Runtime Degraded',
      'platform-auto-backup-created': 'Platform Auto Backup Created',
      'platform-auto-backup-failed': 'Platform Auto Backup Failed',
      'platform-auto-restart-started': 'Platform Auto Recovery Started',
      'platform-auto-restart-succeeded': 'Platform Auto Recovery Succeeded',
      'platform-auto-restart-failed': 'Platform Auto Recovery Failed',
      'platform-auto-monitoring-followup-failed': 'Post-Recovery Monitoring Failed',
      'agent-version-outdated': 'Agent Version Outdated',
      'agent-runtime-stale': 'Agent Runtime Stale',
      'platform-webhook-failed': 'Platform Webhook Failed',
    }),
    fieldLabels: Object.freeze({
      queue: 'Queue',
      threshold: 'Threshold',
      overdueMs: 'Overdue (ms)',
      thresholdMs: 'Threshold (ms)',
      code: 'Purchase Code',
      failRate: 'Fail Rate',
      attempts: 'Attempts',
      failures: 'Failures',
      windowMs: 'Window (ms)',
      topIps: 'Top IPs',
      count: 'Count',
      types: 'Types',
      codes: 'Sample Codes',
      tenant: 'Tenant',
      quota: 'Quota',
      used: 'Used',
      limit: 'Limit',
      remaining: 'Remaining',
      runtime: 'Runtime',
      service: 'Service',
      reason: 'Reason',
      url: 'URL',
      backup: 'Backup',
      note: 'Note',
      error: 'Error',
      event: 'Event',
      target: 'Target',
      version: 'Version',
      min: 'Min Version',
      lastSeenAt: 'Last Seen',
      exitCode: 'Exit Code',
      details: 'Details',
    }),
  }),
  th: Object.freeze({
    fallbackFieldName: 'รายละเอียด',
    titles: Object.freeze({
      'queue-pressure': 'แรงกดดันคิวการส่ง',
      'queue-stuck': 'คิวการส่งค้าง',
      'fail-rate': 'อัตราล้มเหลวของการส่งพุ่ง',
      'login-failure-spike': 'ความล้มเหลวการล็อกอินแอดมินพุ่ง',
      'delivery-reconcile-anomaly': 'ผิดปกติจากการตรวจทานการส่ง',
      'delivery-abuse-suspected': 'สงสัยการใช้งานการส่งผิดปกติ',
      'tenant-quota-exceeded': 'ผู้เช่าใช้โควตาเกิน',
      'tenant-quota-near-limit': 'ผู้เช่าใกล้ชนขีดจำกัดโควตา',
      'runtime-offline': 'รันไทม์ออฟไลน์',
      'runtime-degraded': 'รันไทม์เสื่อมสภาพ',
      'platform-auto-backup-created': 'สร้างแบ็กอัปอัตโนมัติสำเร็จ',
      'platform-auto-backup-failed': 'สร้างแบ็กอัปอัตโนมัติล้มเหลว',
      'platform-auto-restart-started': 'เริ่มกู้คืนอัตโนมัติของแพลตฟอร์ม',
      'platform-auto-restart-succeeded': 'กู้คืนอัตโนมัติของแพลตฟอร์มสำเร็จ',
      'platform-auto-restart-failed': 'กู้คืนอัตโนมัติของแพลตฟอร์มล้มเหลว',
      'platform-auto-monitoring-followup-failed': 'การติดตามผลหลังการกู้คืนล้มเหลว',
      'agent-version-outdated': 'เวอร์ชันเอเจนต์ล้าสมัย',
      'agent-runtime-stale': 'เอเจนต์ไม่ได้รายงานสถานะล่าสุด',
      'platform-webhook-failed': 'Platform webhook ล้มเหลว',
    }),
    fieldLabels: Object.freeze({
      queue: 'คิว',
      threshold: 'เกณฑ์',
      overdueMs: 'ค้าง (ms)',
      thresholdMs: 'เกณฑ์ (ms)',
      code: 'รหัสคำสั่งซื้อ',
      failRate: 'อัตราล้มเหลว',
      attempts: 'จำนวนครั้ง',
      failures: 'จำนวนล้มเหลว',
      windowMs: 'ช่วงเวลา (ms)',
      topIps: 'IP สูงสุด',
      count: 'จำนวน',
      types: 'ประเภท',
      codes: 'รหัสตัวอย่าง',
      tenant: 'ผู้เช่า',
      quota: 'โควตา',
      used: 'ใช้ไป',
      limit: 'ขีดจำกัด',
      remaining: 'คงเหลือ',
      runtime: 'รันไทม์',
      service: 'บริการ',
      reason: 'สาเหตุ',
      url: 'URL',
      backup: 'แบ็กอัป',
      note: 'หมายเหตุ',
      error: 'ข้อผิดพลาด',
      event: 'เหตุการณ์',
      target: 'เป้าหมาย',
      version: 'เวอร์ชัน',
      min: 'เวอร์ชันขั้นต่ำ',
      lastSeenAt: 'พบล่าสุด',
      exitCode: 'รหัสออก',
      details: 'รายละเอียด',
    }),
  }),
});

const MULTILINE_ALERT_FIELDS = new Set([
  'topIps',
  'types',
  'codes',
  'reason',
  'url',
  'note',
  'error',
  'target',
  'lastSeenAt',
]);

const EXTRA_OPS_ALERT_TITLES = Object.freeze({
  en: Object.freeze({
    'backup-failed': 'Backup Failed',
    'dead-letter-threshold': 'Dead-letter Threshold Reached',
    'consecutive-failures': 'Consecutive Delivery Failures',
  }),
  th: Object.freeze({
    'backup-failed': '\u0e01\u0e32\u0e23\u0e2a\u0e33\u0e23\u0e2d\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27',
    'dead-letter-threshold': '\u0e40\u0e14\u0e14\u0e40\u0e25\u0e15\u0e40\u0e15\u0e2d\u0e23\u0e4c\u0e40\u0e01\u0e34\u0e19\u0e40\u0e01\u0e13\u0e11\u0e4c',
    'consecutive-failures': '\u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27\u0e15\u0e48\u0e2d\u0e40\u0e19\u0e37\u0e48\u0e2d\u0e07',
  }),
});

const EXTRA_OPS_ALERT_FIELD_LABELS = Object.freeze({
  en: Object.freeze({
    source: 'Source',
    serviceKey: 'Service Key',
    stderr: 'stderr',
    stdout: 'stdout',
    message: 'Message',
    status: 'Status',
    state: 'State',
    tenantId: 'Tenant ID',
    tenantSlug: 'Tenant Slug',
    minimumVersion: 'Min Version',
    runtimeKey: 'Runtime Key',
    runtimeLabel: 'Runtime Label',
    generatedAt: 'Generated At',
  }),
  th: Object.freeze({
    source: '\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e17\u0e35\u0e48\u0e21\u0e32',
    serviceKey: '\u0e04\u0e35\u0e22\u0e4c\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23',
    stderr: 'stderr',
    stdout: 'stdout',
    message: '\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21',
    status: '\u0e2a\u0e16\u0e32\u0e19\u0e30',
    state: '\u0e2a\u0e16\u0e32\u0e19\u0e30',
    tenantId: '\u0e23\u0e2b\u0e31\u0e2a\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32',
    tenantSlug: '\u0e2a\u0e25\u0e31\u0e01\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32',
    minimumVersion: '\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e0a\u0e31\u0e19\u0e02\u0e31\u0e49\u0e19\u0e15\u0e48\u0e33',
    runtimeKey: '\u0e04\u0e35\u0e22\u0e4c\u0e23\u0e31\u0e19\u0e44\u0e17\u0e21\u0e4c',
    runtimeLabel: '\u0e0a\u0e37\u0e48\u0e2d\u0e23\u0e31\u0e19\u0e44\u0e17\u0e21\u0e4c',
    generatedAt: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e40\u0e21\u0e37\u0e48\u0e2d',
  }),
});

const AGENT_CIRCUIT_TITLES = Object.freeze({
  en: 'Agent Circuit Open',
  th: '\u0e27\u0e07\u0e08\u0e23\u0e1b\u0e49\u0e2d\u0e07\u0e01\u0e31\u0e19\u0e40\u0e2d\u0e40\u0e08\u0e19\u0e15\u0e4c\u0e40\u0e1b\u0e34\u0e14\u0e17\u0e33\u0e07\u0e32\u0e19',
});

const AGENT_CIRCUIT_FIELD_LABELS = Object.freeze({
  en: Object.freeze({
    consecutiveFailures: 'Consecutive Failures',
    lastFailureCode: 'Last Failure Code',
    lastFailureMessage: 'Last Failure Message',
    circuitOpenedAt: 'Opened At',
    circuitOpenUntil: 'Open Until',
  }),
  th: Object.freeze({
    consecutiveFailures: '\u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27\u0e15\u0e48\u0e2d\u0e40\u0e19\u0e37\u0e48\u0e2d\u0e07',
    lastFailureCode: '\u0e23\u0e2b\u0e31\u0e2a\u0e04\u0e27\u0e32\u0e21\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14',
    lastFailureMessage: '\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e04\u0e27\u0e32\u0e21\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14',
    circuitOpenedAt: '\u0e40\u0e1b\u0e34\u0e14\u0e27\u0e07\u0e08\u0e23\u0e40\u0e21\u0e37\u0e48\u0e2d',
    circuitOpenUntil: '\u0e25\u0e47\u0e2d\u0e01\u0e08\u0e19\u0e16\u0e36\u0e07',
  }),
});

function trimText(value, maxLen = 160) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

function normalizeOpsAlertLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('th')) return 'th';
  return 'en';
}

function getOpsAlertLocaleBundle(locale) {
  return OPS_ALERT_I18N[normalizeOpsAlertLanguage(locale)] || OPS_ALERT_I18N.en;
}

function formatCount(value, locale = 'en') {
  const count = Number(value || 0);
  if (!Number.isFinite(count)) return '0';
  return Math.trunc(count).toLocaleString(
    normalizeOpsAlertLanguage(locale) === 'th' ? 'th-TH' : 'en-US',
  );
}

function getOpsAlertSeverity(kind) {
  if (
    kind === 'fail-rate'
    || kind === 'queue-stuck'
    || kind === 'backup-failed'
    || kind === 'dead-letter-threshold'
    || kind === 'consecutive-failures'
    || kind === 'runtime-offline'
    || kind === 'runtime-degraded'
    || kind === 'platform-webhook-failed'
    || kind === 'platform-auto-backup-failed'
    || kind === 'platform-auto-restart-failed'
    || kind === 'platform-auto-monitoring-followup-failed'
    || kind === 'agent-circuit-open'
  ) {
    return 'ERROR';
  }
  if (
    kind === 'platform-auto-backup-created'
    || kind === 'platform-auto-restart-started'
    || kind === 'platform-auto-restart-succeeded'
  ) {
    return 'INFO';
  }
  return 'WARN';
}

function getOpsAlertColor(severity) {
  if (severity === 'ERROR') return 0xed4245;
  if (severity === 'INFO') return 0x57f287;
  return 0xfee75c;
}

function getOpsAlertTitle(kind, locale = 'en') {
  const bundle = getOpsAlertLocaleBundle(locale);
  const extraTitles = EXTRA_OPS_ALERT_TITLES[normalizeOpsAlertLanguage(locale)] || EXTRA_OPS_ALERT_TITLES.en;
  const cleanKind = String(kind || 'ops-alert').trim();
  if (bundle.titles[cleanKind]) return bundle.titles[cleanKind];
  if (cleanKind === 'agent-circuit-open') {
    return AGENT_CIRCUIT_TITLES[normalizeOpsAlertLanguage(locale)] || AGENT_CIRCUIT_TITLES.en;
  }
  if (extraTitles[cleanKind]) return extraTitles[cleanKind];
  return cleanKind.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Operational Alert';
}

function buildOpsAlertHeader(kind, label) {
  return `[OPS][${getOpsAlertSeverity(kind)}] ${label}`;
}

function buildLine(key, value) {
  const text = trimText(value, 220);
  if (!text) return null;
  return `${key}=${text}`;
}

function serializeOpsAlertValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry && typeof entry === 'object' ? JSON.stringify(entry) : String(entry)))
      .join(', ');
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function prettifyOpsAlertField(key, locale = 'en') {
  const bundle = getOpsAlertLocaleBundle(locale);
  const extraFieldLabels = EXTRA_OPS_ALERT_FIELD_LABELS[normalizeOpsAlertLanguage(locale)] || EXTRA_OPS_ALERT_FIELD_LABELS.en;
  const clean = String(key || '').trim();
  if (!clean) return bundle.fallbackFieldName;
  if (AGENT_CIRCUIT_FIELD_LABELS[normalizeOpsAlertLanguage(locale)]?.[clean]) {
    return AGENT_CIRCUIT_FIELD_LABELS[normalizeOpsAlertLanguage(locale)][clean];
  }
  return bundle.fieldLabels[clean] || extraFieldLabels[clean] || clean;
}

function summarizeSampleByType(sample) {
  const counts = new Map();
  for (const row of Array.isArray(sample) ? sample : []) {
    const type = String(row?.type || 'unknown').trim() || 'unknown';
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([type, count]) => `${type} x${count}`);
}

function summarizeSampleCodes(sample) {
  return (Array.isArray(sample) ? sample : [])
    .map((row) => trimText(row?.code, 18))
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}

function humanizeKind(kind, locale = 'en') {
  return getOpsAlertTitle(kind, locale);
}

function formatOpsAlertMessage(payload = {}, options = {}) {
  const kind = String(payload.kind || 'alert');
  const locale = normalizeOpsAlertLanguage(
    options.locale
      || payload.locale
      || process.env.ADMIN_LOG_LANGUAGE
      || 'en',
  );

  if (kind === 'queue-pressure') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('queue', formatCount(payload.queueLength || 0, locale)),
      buildLine('threshold', payload.threshold || '-'),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'queue-stuck') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('overdueMs', formatCount(payload.oldestDueMs || 0, locale)),
      buildLine('thresholdMs', payload.thresholdMs || '-'),
      buildLine('queue', formatCount(payload.queueLength || 0, locale)),
      buildLine('code', payload.purchaseCode || '-'),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'fail-rate') {
    const failRate = Number(payload.failRate || 0);
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('failRate', failRate.toFixed(3)),
      buildLine('attempts', formatCount(payload.attempts || 0, locale)),
      buildLine('failures', formatCount(payload.failures || 0, locale)),
      buildLine('threshold', payload.threshold || '-'),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'login-failure-spike') {
    const topIps = Array.isArray(payload.topIps) ? payload.topIps.join(',') : '-';
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('failures', formatCount(payload.failures || 0, locale)),
      buildLine('windowMs', payload.windowMs || '-'),
      buildLine('threshold', payload.threshold || '-'),
      buildLine('topIps', topIps),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'delivery-reconcile-anomaly' || kind === 'delivery-abuse-suspected') {
    const sampleTypes = summarizeSampleByType(payload.sample);
    const sampleCodes = summarizeSampleCodes(payload.sample);
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('count', formatCount(payload.count || 0, locale)),
      buildLine('types', sampleTypes.join(', ')),
      buildLine('codes', sampleCodes),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'tenant-quota-exceeded' || kind === 'tenant-quota-near-limit') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('tenant', payload.tenantSlug || payload.tenantId || '-'),
      buildLine('quota', payload.quotaKey || '-'),
      buildLine('used', formatCount(payload.used || 0, locale)),
      buildLine('limit', formatCount(payload.limit || 0, locale)),
      buildLine('remaining', formatCount(payload.remaining || 0, locale)),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'runtime-offline' || kind === 'runtime-degraded') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('runtime', payload.runtimeLabel || payload.runtimeKey || 'runtime'),
      buildLine('reason', payload.reason || '-'),
      buildLine('url', payload.url || '-'),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'platform-auto-backup-created' || kind === 'platform-auto-backup-failed') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('backup', payload.backup || '-'),
      buildLine('note', payload.note || '-'),
      buildLine('error', payload.error || '-'),
    ].filter(Boolean).join('\n');
  }
  if (
    kind === 'platform-auto-restart-started'
    || kind === 'platform-auto-restart-succeeded'
    || kind === 'platform-auto-restart-failed'
    || kind === 'platform-auto-monitoring-followup-failed'
  ) {
    const exitCode = Number(payload.exitCode);
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('runtime', payload.runtimeLabel || payload.runtimeKey || 'runtime'),
      buildLine('service', payload.serviceKey || payload.service || '-'),
      buildLine('reason', payload.reason || '-'),
      Number.isFinite(exitCode) ? buildLine('exitCode', String(Math.trunc(exitCode))) : null,
      buildLine('error', payload.error || payload.stderr || ''),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'agent-version-outdated' || kind === 'agent-runtime-stale') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('tenant', payload.tenantId || '-'),
      buildLine('runtime', payload.runtimeKey || '-'),
      buildLine('version', payload.version || '-'),
      buildLine('min', payload.minimumVersion || '-'),
      buildLine('lastSeenAt', payload.lastSeenAt || '-'),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'agent-circuit-open') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('consecutiveFailures', formatCount(payload.consecutiveFailures || 0, locale)),
      buildLine('threshold', payload.threshold || '-'),
      buildLine('lastFailureCode', payload.lastFailureCode || '-'),
      buildLine('lastFailureMessage', payload.lastFailureMessage || '-'),
      buildLine('circuitOpenedAt', payload.circuitOpenedAt || '-'),
      buildLine('circuitOpenUntil', payload.circuitOpenUntil || '-'),
    ].filter(Boolean).join('\n');
  }
  if (kind === 'platform-webhook-failed') {
    return [
      buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
      buildLine('event', payload.eventType || '-'),
      buildLine('target', payload.targetUrl || '-'),
      buildLine('error', payload.error || '-'),
    ].filter(Boolean).join('\n');
  }
  const genericLines = Object.entries(payload || {})
    .filter(([key]) => key !== 'kind' && key !== 'locale')
    .map(([key, value]) => buildLine(key, serializeOpsAlertValue(value)))
    .filter(Boolean);
  return [
    buildOpsAlertHeader(kind, getOpsAlertTitle(kind, locale)),
    ...genericLines,
  ].join('\n');
}

function parseOpsAlertSummary(text, options = {}) {
  const locale = normalizeOpsAlertLanguage(options.locale || 'en');
  const lines = String(text || '')
    .split('\n')
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const header = lines.shift();
  const match = /^\[OPS\]\[(?<severity>[A-Z]+)\]\s+(?<title>.+)$/.exec(header);
  if (!match?.groups) return null;
  const fields = lines
    .map((line) => {
      const separator = line.indexOf('=');
      if (separator <= 0) {
        return {
          name: prettifyOpsAlertField('details', locale),
          value: trimText(line, 1024),
          inline: false,
        };
      }
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim() || '-';
      return {
        name: prettifyOpsAlertField(key, locale),
        value: trimText(value, 1024),
        inline: !MULTILINE_ALERT_FIELDS.has(key),
      };
    })
    .filter((field) => field.value);
  return {
    severity: match.groups.severity,
    title: match.groups.title,
    fields,
  };
}

function formatOpsAlertDiscordPayload(payload = {}, options = {}) {
  const locale = normalizeOpsAlertLanguage(
    options.locale
      || payload.locale
      || process.env.ADMIN_LOG_LANGUAGE
      || 'en',
  );
  const text = formatOpsAlertMessage(payload, { locale });
  const parsed = parseOpsAlertSummary(text, { locale });
  const timestamp = options.at || payload.generatedAt || payload.createdAt || null;

  if (!parsed) {
    const embed = new EmbedBuilder()
      .setColor(getOpsAlertColor(getOpsAlertSeverity(String(payload.kind || 'alert'))))
      .setTitle(humanizeKind(payload.kind, locale))
      .setDescription(`\`\`\`json\n${trimText(JSON.stringify(payload, null, 2), 3900)}\n\`\`\``)
      .setFooter({
        text: `OPS \u2022 ${getOpsAlertSeverity(String(payload.kind || 'alert'))}${payload.source ? ` \u2022 ${trimText(payload.source, 60)}` : ''}`,
      });
    if (timestamp) {
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) {
        embed.setTimestamp(date);
      }
    }
    return { embeds: [embed] };
  }

  const embed = new EmbedBuilder()
    .setColor(getOpsAlertColor(parsed.severity))
    .setTitle(parsed.title)
    .setFooter({
      text: `OPS \u2022 ${parsed.severity}${payload.source ? ` \u2022 ${trimText(payload.source, 60)}` : ''}`,
    });

  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      embed.setTimestamp(date);
    }
  }

  if (parsed.fields.length > 0) {
    embed.addFields(parsed.fields.slice(0, 25));
  } else {
    embed.setDescription(text);
  }

  return { embeds: [embed] };
}

function createBindOpsAlertRoute({
  adminLiveBus,
  channels,
  logger = console,
}) {
  let bound = false;

  return function bindOpsAlertRoute(clientInstance) {
    if (bound) return;
    bound = true;

    adminLiveBus.on('update', async (evt) => {
      try {
        if (evt?.type !== 'ops-alert') return;
        const message = formatOpsAlertDiscordPayload(evt?.payload || {}, {
          at: evt?.at || null,
        });

        for (const guild of clientInstance.guilds.cache.values()) {
          const channel =
            guild.channels.cache.find(
              (candidate) =>
                candidate.name === channels.adminLog
                && candidate.isTextBased
                && candidate.isTextBased(),
            )
            || guild.channels.cache.find(
              (candidate) =>
                candidate.name === channels.shopLog
                && candidate.isTextBased
                && candidate.isTextBased(),
            );
          if (!channel) continue;
          await channel.send(message).catch(() => null);
        }
      } catch (error) {
        logger.error('[ops-alert-route] failed to send alert to Discord', error);
      }
    });
  };
}

module.exports = {
  createBindOpsAlertRoute,
  formatOpsAlertDiscordPayload,
  formatOpsAlertMessage,
};
