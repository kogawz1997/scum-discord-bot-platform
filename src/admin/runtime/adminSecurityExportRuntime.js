'use strict';

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function isAdminSecurityAnomaly(event = {}) {
  const severity = String(event.severity || '').trim().toLowerCase();
  if (severity === 'warn' || severity === 'error') return true;
  const type = String(event.type || '').trim().toLowerCase();
  return /fail|anomaly|mismatch|revoked|denied|blocked|expired/.test(type);
}

function matchesAdminSecurityEventQuery(event = {}, query = '') {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return true;
  return Object.values(event).some((value) => {
    if (value == null) return false;
    try {
      return String(typeof value === 'object' ? JSON.stringify(value) : value)
        .toLowerCase()
        .includes(normalized);
    } catch {
      return String(value).toLowerCase().includes(normalized);
    }
  });
}

function createAdminSecurityExportRuntime(options = {}) {
  async function buildAdminSecurityEventExportRows(urlObj) {
    const q = options.requiredString(urlObj.searchParams.get('q'));
    const anomalyOnly = String(urlObj.searchParams.get('anomalyOnly') || '').trim().toLowerCase() === 'true';
    const rows = await options.listAdminSecurityEvents({
      limit: options.asInt(urlObj.searchParams.get('limit'), 2000) || 2000,
      type: options.requiredString(urlObj.searchParams.get('type')),
      severity: options.requiredString(urlObj.searchParams.get('severity')),
      actor: options.requiredString(urlObj.searchParams.get('actor')),
      targetUser: options.requiredString(urlObj.searchParams.get('targetUser')),
      sessionId: options.requiredString(urlObj.searchParams.get('sessionId')),
    });
    return rows.filter((row) => {
      if (anomalyOnly && !isAdminSecurityAnomaly(row)) return false;
      return matchesAdminSecurityEventQuery(row, q);
    });
  }

  function buildAdminSecurityEventCsv(rows = []) {
    const headers = [
      'id',
      'at',
      'type',
      'severity',
      'actor',
      'targetUser',
      'role',
      'authMethod',
      'sessionId',
      'ip',
      'path',
      'reason',
      'detail',
    ];
    const body = (Array.isArray(rows) ? rows : [])
      .map((row) => headers.map((key) => escapeCsvCell(row?.[key])).join(','))
      .join('\n');
    return `${headers.join(',')}\n${body}${body ? '\n' : ''}`;
  }

  return {
    buildAdminSecurityEventCsv,
    buildAdminSecurityEventExportRows,
  };
}

module.exports = {
  createAdminSecurityExportRuntime,
};
