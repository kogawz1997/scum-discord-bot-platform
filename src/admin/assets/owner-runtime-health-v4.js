(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.OwnerRuntimeHealthV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const CP1252_REVERSE_MAP = new Map([
    [0x20AC, 0x80],
    [0x201A, 0x82],
    [0x0192, 0x83],
    [0x201E, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02C6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8A],
    [0x2039, 0x8B],
    [0x0152, 0x8C],
    [0x017D, 0x8E],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201C, 0x93],
    [0x201D, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02DC, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9A],
    [0x203A, 0x9B],
    [0x0153, 0x9C],
    [0x017E, 0x9E],
    [0x0178, 0x9F],
  ]);

  const NAV_GROUPS = [
    { label: 'แพลตฟอร์ม', items: [
      { label: 'ภาพรวม', href: '#overview' },
      { label: 'ผู้เช่า', href: '#tenants' },
      { label: 'แพ็กเกจ', href: '#packages' },
      { label: 'การสมัครใช้', href: '#subscriptions' },
    ] },
    { label: 'ปฏิบัติการ', items: [
      { label: 'สถานะบริการ', href: '#runtime-health', current: true },
      { label: 'เหตุการณ์', href: '#incidents' },
      { label: 'คำขอและความช้า', href: '#observability' },
      { label: 'งานรอและบอท', href: '#jobs' },
    ] },
    { label: 'ธุรกิจ', items: [
      { label: 'ซัพพอร์ต', href: '#support' },
      { label: 'ความปลอดภัย', href: '#security' },
      { label: 'หลักฐาน', href: '#audit' },
    ] },
  ];

  function normalizeRuntimeNavRoute(currentRoute) {
    const route = String(currentRoute || 'runtime-health').trim().toLowerCase() || 'runtime-health';
    if (route === 'runtime') return 'runtime-health';
    return route;
  }

  function cloneNavGroups(groups, currentRoute) {
    const route = normalizeRuntimeNavRoute(currentRoute);
    return (Array.isArray(groups) ? groups : []).map((group) => ({
      ...group,
      items: (Array.isArray(group.items) ? group.items : []).map((item) => {
        const itemRoute = String(item && item.href || '').replace(/^#/, '').trim().toLowerCase();
        return {
          ...item,
          current: itemRoute === route,
        };
      }),
    }));
  }

  function repairMojibakeText(value) {
    const text = String(value ?? '');
    if (!text || !/(\u00C3|\u00C2|\u00E0|\u00E2|\u00EF|\u00BF)/.test(text) || typeof TextDecoder !== 'function') return text;
    try {
      const bytes = Uint8Array.from(Array.from(text, (char) => {
        const codePoint = char.codePointAt(0);
        return CP1252_REVERSE_MAP.get(codePoint) ?? (codePoint & 0xff);
      }));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return text;
    }
  }

  function escapeHtml(value) {
    return repairMojibakeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('th-TH').format(numeric) : fallback;
  }
  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function formatDateTime(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'ยังไม่ทราบเวลา';
  }
  function firstNonEmpty(values, fallback = '') {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized) return normalized;
    }
    return fallback;
  }
  function looksLikeJsonText(value) {
    const text = String(value ?? '').trim();
    return text.startsWith('{') || text.startsWith('[');
  }
  function extractReadableText(value, fallback = '') {
    if (value == null) return fallback;
    if (typeof value === 'string') {
      const text = String(value).trim();
      if (!text) return fallback;
      if (looksLikeJsonText(text)) {
        try {
          return extractReadableText(JSON.parse(text), fallback);
        } catch {
          return text;
        }
      }
      return text;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => extractReadableText(item, ''))
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ');
      return firstNonEmpty([joined], fallback);
    }
    if (typeof value === 'object') {
      return firstNonEmpty([
        value.title,
        value.label,
        value.message,
        value.detail,
        value.summary,
        value.reason,
        value.source,
        value.path,
        value.code,
      ], fallback);
    }
    return fallback;
  }
  function toneForStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['ready', 'healthy', 'active', 'online'].includes(raw)) return 'success';
    if (['warning', 'degraded', 'stale', 'slow', 'outdated', 'pending_activation', 'pending-activation'].includes(raw)) return 'warning';
    if (['offline', 'failed', 'error', 'expired', 'suspended'].includes(raw)) return 'danger';
    if (['unregistered'].includes(raw)) return 'danger';
    if (['pending', 'draft', 'provisioned'].includes(raw)) return 'info';
    return 'muted';
  }
  function inferAgentRuntimeKind(row) {
    const role = String(row && row.meta && row.meta.agentRole || row && row.role || '').trim().toLowerCase();
    const scope = String(row && row.meta && row.meta.agentScope || row && row.scope || '').trim().toLowerCase();
    if (role === 'sync' || ['sync_only', 'sync-only', 'synconly'].includes(scope)) return 'server-bots';
    if (role === 'execute' || ['execute_only', 'execute-only', 'executeonly'].includes(scope)) return 'delivery-agents';
    const text = [
      row && row.runtimeKey,
      row && row.name,
      row && row.channel,
      row && row.meta && row.meta.agentRole,
      row && row.meta && row.meta.agentScope,
      ...(Array.isArray(row && row.meta && row.meta.capabilities) ? row.meta.capabilities : []),
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
    if (['sync', 'watch', 'watcher', 'log', 'config', 'restart', 'monitor'].some((token) => text.includes(token))) return 'server-bots';
    if (['execute', 'delivery', 'dispatch', 'announce', 'console-agent', 'write'].some((token) => text.includes(token))) return 'delivery-agents';
    return '';
  }
  function buildTenantRuntimeHref(kind, tenantId) {
    const runtimeKind = String(kind || '').trim();
    const scopedTenantId = String(tenantId || '').trim();
    if (!runtimeKind || !scopedTenantId) return '';
    return `/tenant/runtimes/${encodeURIComponent(runtimeKind)}?tenantId=${encodeURIComponent(scopedTenantId)}`;
  }
  function buildOwnerTenantHref(tenantId) {
    const scopedTenantId = String(tenantId || '').trim();
    if (!scopedTenantId) return '';
    return `/owner/tenants/${encodeURIComponent(scopedTenantId)}`;
  }
  function buildOwnerSupportHref(tenantId) {
    const scopedTenantId = String(tenantId || '').trim();
    if (!scopedTenantId) return '';
    return `/owner/support/${encodeURIComponent(scopedTenantId)}`;
  }
  function buildOwnerRuntimeSectionHref(section) {
    const normalized = String(section || '').trim().toLowerCase();
    return normalized ? `#${encodeURIComponent(normalized)}` : '#runtime-health';
  }
  function describeTenantRuntimeLabel(kind) {
    return kind === 'server-bots' ? 'Open Server Bot' : kind === 'delivery-agents' ? 'Open Delivery Agent' : 'Open tenant runtime';
  }
  function trimText(value, maxLen = 240) {
    const text = String(value ?? '').trim();
    return !text ? '' : text.slice(0, maxLen);
  }
  function compareVersions(left, right) {
    const leftParts = trimText(left, 120).split(/[.-]/g).map((value) => Number.parseInt(value, 10) || 0);
    const rightParts = trimText(right, 120).split(/[.-]/g).map((value) => Number.parseInt(value, 10) || 0);
    const maxLen = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLen; index += 1) {
      const leftValue = leftParts[index] || 0;
      const rightValue = rightParts[index] || 0;
      if (leftValue > rightValue) return 1;
      if (leftValue < rightValue) return -1;
    }
    return 0;
  }
  function buildVersionWatch(version, minimumVersion) {
    const currentVersion = trimText(version, 80);
    const minimum = trimText(minimumVersion, 80);
    if (!minimum) {
      return {
        tone: currentVersion ? 'success' : 'warning',
        label: currentVersion ? 'Version reported' : 'Waiting for version',
      };
    }
    if (!currentVersion) {
      return {
        tone: 'warning',
        label: `Need at least ${minimum}`,
      };
    }
    return compareVersions(currentVersion, minimum) >= 0
      ? { tone: 'success', label: `Meets ${minimum}` }
      : { tone: 'danger', label: `Upgrade to ${minimum}` };
  }
  function normalizeRuntimeRows(snapshot) {
    const services = snapshot && snapshot.services;
    if (Array.isArray(services)) return services;
    if (services && typeof services === 'object') {
      return Object.entries(services).map(([name, row]) => ({ name, ...(row && typeof row === 'object' ? row : {}) }));
    }
    return [];
  }
  function buildIncidentFeed(state) {
    const requestItems = Array.isArray(state.requestLogs && state.requestLogs.items)
      ? state.requestLogs.items.map((item) => ({
          source: 'requests',
          severity: Number(item.statusCode || 0) >= 500 ? 'danger' : 'warning',
          title: `${item.method || 'REQ'} ${item.path || item.routeGroup || 'request'}`,
          detail: `${item.statusCode || '-'} ${item.error || item.summary || item.requestId || ''}`.trim(),
          time: item.at || item.createdAt,
        }))
      : [];
    const alertItems = (Array.isArray(state.notifications) ? state.notifications : []).map((item) => ({
      source: 'alerts',
      severity: item.severity || 'warning',
      title: firstNonEmpty([item.title, item.label, 'การแจ้งเตือนของแพลตฟอร์ม']),
      detail: firstNonEmpty([
        extractReadableText(item.detail, ''),
        extractReadableText(item.message, ''),
        'ระบบสังเกตการณ์ตรวจพบสัญญาณที่เจ้าของระบบควรเปิดดู',
      ]),
      time: item.createdAt || item.at,
    }));
    const securityItems = (Array.isArray(state.securityEvents) ? state.securityEvents : []).map((item) => ({
      source: 'security',
      severity: item.severity || 'info',
      title: item.type || 'เหตุการณ์ด้านความปลอดภัย',
      detail: firstNonEmpty([
        extractReadableText(item.detail, ''),
        extractReadableText(item.reason, ''),
        extractReadableText(item.meta, ''),
      ]),
      time: item.createdAt || item.at,
    }));
    return alertItems.concat(securityItems).concat(requestItems)
      .sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime())
      .slice(0, 8);
  }
  function buildHotspots(state) {
    const rows = Array.isArray(state.requestLogs && state.requestLogs.metrics && state.requestLogs.metrics.routeHotspots)
      ? state.requestLogs.metrics.routeHotspots
      : [];
    return rows.slice(0, 5).map((row) => ({
      route: row.routeGroup || row.samplePath || '/',
      requests: formatNumber(row.requests, '0'),
      errors: formatNumber(row.errors, '0'),
      p95LatencyMs: formatNumber(row.p95LatencyMs, '0'),
    }));
  }
  function buildOwnerFleetKey(parts) {
    return [
      trimText(parts && parts.tenantId, 160),
      trimText(parts && parts.serverId, 160),
      trimText(parts && parts.agentId, 160) || trimText(parts && parts.runtimeKey, 160) || trimText(parts && parts.fallbackId, 160) || 'runtime',
    ].join('::');
  }
  function buildOwnerRuntimeFleetRows(state) {
    const tenants = new Map((Array.isArray(state && state.tenants) ? state.tenants : []).map((row) => [trimText(row && row.id, 160), row]));
    const registry = Array.isArray(state && state.agentRegistry) ? state.agentRegistry : [];
    const runtimes = Array.isArray(state && state.agents) ? state.agents : [];
    const provisionings = Array.isArray(state && state.agentProvisioning) ? state.agentProvisioning : [];
    const devices = Array.isArray(state && state.agentDevices) ? state.agentDevices : [];
    const credentials = Array.isArray(state && state.agentCredentials) ? state.agentCredentials : [];
    const rows = new Map();

    function upsert(parts, patch) {
      const key = buildOwnerFleetKey(parts);
      const previous = rows.get(key) || {
        tenantId: '',
        tenantLabel: '',
        serverId: '',
        serverLabel: '',
        agentId: '',
        runtimeKey: '',
        runtime: '',
        role: '',
        scope: '',
        channel: '',
        status: '',
        version: '',
        lastSeenAt: '',
        machineName: '',
        apiKeyId: '',
        deviceId: '',
        provisionTokenId: '',
        provisionStatus: '',
        minimumVersion: '',
      };
      const next = {
        ...previous,
        ...patch,
      };
      if (!next.tenantLabel) {
        next.tenantLabel = firstNonEmpty([
          next.tenantId && tenants.get(next.tenantId) && (tenants.get(next.tenantId).name || tenants.get(next.tenantId).slug),
          next.tenantId,
          'Tenant not attached',
        ]);
      }
      if (!next.runtime) {
        next.runtime = firstNonEmpty([next.runtimeKey, next.agentId], '-');
      }
      if (!next.serverLabel) {
        next.serverLabel = firstNonEmpty([next.serverId, '-']);
      }
      rows.set(key, next);
    }

    registry.forEach((entry) => {
      const runtime = entry && entry.runtime && typeof entry.runtime === 'object' ? entry.runtime : {};
      const binding = Array.isArray(entry && entry.bindings) && entry.bindings.length ? entry.bindings[0] : {};
      const latestSession = Array.isArray(entry && entry.sessions) && entry.sessions.length ? entry.sessions[0] : {};
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      upsert({ tenantId, serverId, agentId, runtimeKey }, {
        tenantId,
        tenantLabel: firstNonEmpty([entry && entry.tenantName, '']),
        serverId,
        serverLabel: firstNonEmpty([entry && entry.serverName, entry && entry.guildId, serverId, '-']),
        agentId,
        runtimeKey,
        runtime: firstNonEmpty([entry && entry.displayName, entry && entry.name, runtimeKey, agentId], 'Runtime'),
        role: firstNonEmpty([entry && entry.role, runtime && runtime.meta && runtime.meta.agentRole], '-'),
        scope: firstNonEmpty([entry && entry.scope, runtime && runtime.meta && runtime.meta.agentScope], '-'),
        channel: firstNonEmpty([runtime && runtime.channel, entry && entry.channel], '-'),
        status: firstNonEmpty([runtime && runtime.status, entry && entry.status], ''),
        version: firstNonEmpty([runtime && runtime.version, latestSession && latestSession.version], '-'),
        lastSeenAt: firstNonEmpty([
          runtime && (runtime.lastSeenAt || runtime.updatedAt || runtime.heartbeatAt),
          latestSession && (latestSession.heartbeatAt || latestSession.updatedAt),
          entry && entry.updatedAt,
        ], ''),
        machineName: firstNonEmpty([
          runtime && runtime.meta && runtime.meta.hostname,
          latestSession && latestSession.hostname,
        ], ''),
        apiKeyId: trimText(binding && binding.apiKeyId, 160),
        deviceId: trimText(binding && binding.deviceId, 160),
        minimumVersion: firstNonEmpty([binding && binding.minVersion, entry && entry.minimumVersion], ''),
      });
    });

    runtimes.forEach((entry) => {
      const meta = entry && entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = firstNonEmpty([entry && entry.serverId, meta.serverId], '');
      const agentId = firstNonEmpty([entry && entry.agentId, meta.agentId], '');
      const runtimeKey = firstNonEmpty([entry && entry.runtimeKey, meta.runtimeKey], '');
      upsert({ tenantId, serverId, agentId, runtimeKey }, {
        tenantId,
        tenantLabel: firstNonEmpty([entry && entry.tenantName, meta.tenantName, '']),
        serverId,
        serverLabel: firstNonEmpty([meta.serverName, meta.serverId, entry && entry.serverId, '-']),
        agentId,
        runtimeKey,
        runtime: firstNonEmpty([entry && entry.displayName, runtimeKey, agentId], 'Runtime'),
        role: firstNonEmpty([meta.agentRole, entry && entry.role], '-'),
        scope: firstNonEmpty([meta.agentScope, entry && entry.scope], '-'),
        channel: firstNonEmpty([entry && entry.channel, meta.channel, meta.agentScope], '-'),
        status: firstNonEmpty([entry && entry.status], ''),
        version: firstNonEmpty([entry && entry.version, meta.version], '-'),
        lastSeenAt: firstNonEmpty([entry && (entry.lastSeenAt || entry.updatedAt || entry.heartbeatAt)], ''),
        machineName: firstNonEmpty([meta.hostname], ''),
      });
    });

    credentials.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      upsert({ tenantId, serverId, agentId, runtimeKey, fallbackId: trimText(entry && entry.apiKeyId, 160) }, {
        tenantId,
        serverId,
        agentId,
        runtimeKey,
        apiKeyId: trimText(entry && entry.apiKeyId, 160),
        deviceId: trimText(entry && entry.deviceId, 160),
        minimumVersion: firstNonEmpty([entry && entry.minVersion], ''),
      });
    });

    devices.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      upsert({ tenantId, serverId, agentId, runtimeKey, fallbackId: trimText(entry && entry.id, 160) }, {
        tenantId,
        serverId,
        agentId,
        runtimeKey,
        deviceId: trimText(entry && entry.id, 160),
        machineName: firstNonEmpty([entry && entry.hostname], ''),
        lastSeenAt: firstNonEmpty([entry && entry.lastSeenAt], ''),
      });
    });

    provisionings.forEach((entry) => {
      const tenantId = trimText(entry && entry.tenantId, 160);
      const serverId = trimText(entry && entry.serverId, 160);
      const agentId = trimText(entry && entry.agentId, 160);
      const runtimeKey = trimText(entry && entry.runtimeKey, 160);
      upsert({ tenantId, serverId, agentId, runtimeKey, fallbackId: trimText(entry && entry.id, 160) }, {
        tenantId,
        serverId,
        agentId,
        runtimeKey,
        runtime: firstNonEmpty([entry && entry.displayName, entry && entry.name, runtimeKey, agentId], 'Runtime'),
        role: firstNonEmpty([entry && entry.role], '-'),
        scope: firstNonEmpty([entry && entry.scope], '-'),
        provisionTokenId: trimText(entry && (entry.tokenId || entry.id), 160),
        provisionStatus: firstNonEmpty([entry && entry.status], ''),
        minimumVersion: firstNonEmpty([entry && entry.minVersion], ''),
      });
    });

    return Array.from(rows.values()).map((row) => {
      const runtimeKind = inferAgentRuntimeKind({
        runtimeKey: row.runtimeKey,
        name: row.runtime,
        channel: row.channel,
        role: row.role,
        scope: row.scope,
      });
      const versionWatch = buildVersionWatch(row.version, row.minimumVersion);
      const normalizedStatus = firstNonEmpty([
        row.status,
        trimText(row.provisionStatus, 80).toLowerCase() === 'pending_activation' ? 'pending_activation' : '',
        row.apiKeyId ? 'offline' : '',
        row.provisionTokenId ? 'pending_activation' : '',
      ], 'unregistered');
      let bindingTone = 'danger';
      let bindingLabel = 'Needs provisioning';
      if (!row.tenantId) {
        bindingTone = 'danger';
        bindingLabel = 'Tenant scope missing';
      } else if (row.deviceId || row.machineName) {
        bindingTone = 'success';
        bindingLabel = 'Machine bound';
      } else if (trimText(row.provisionStatus, 80).toLowerCase() === 'pending_activation') {
        bindingTone = 'warning';
        bindingLabel = 'Pending activation';
      } else if (row.apiKeyId || row.provisionTokenId) {
        bindingTone = 'warning';
        bindingLabel = 'Binding incomplete';
      }
      let attention = { key: 'healthy', label: 'Healthy', tone: 'success', rank: 0 };
      if (!row.tenantId) {
        attention = { key: 'missing-tenant-scope', label: 'Tenant scope missing', tone: 'danger', rank: 6 };
      } else if (!runtimeKind) {
        attention = { key: 'missing-runtime-kind', label: 'Runtime type missing', tone: 'danger', rank: 5 };
      } else if (!row.apiKeyId && !row.provisionTokenId) {
        attention = { key: 'needs-provisioning', label: 'Needs provisioning', tone: 'danger', rank: 5 };
      } else if (versionWatch.tone === 'danger') {
        attention = { key: 'version-gap', label: versionWatch.label, tone: 'danger', rank: 4 };
      } else if (toneForStatus(normalizedStatus) === 'danger') {
        attention = { key: 'runtime-offline', label: 'Runtime offline', tone: 'danger', rank: 4 };
      } else if (bindingTone !== 'success') {
        attention = { key: 'binding-gap', label: bindingLabel, tone: 'warning', rank: 3 };
      } else if (toneForStatus(normalizedStatus) !== 'success') {
        attention = { key: 'runtime-watch', label: 'Needs operator review', tone: 'warning', rank: 2 };
      }
      return {
        ...row,
        status: normalizedStatus,
        runtimeKind,
        versionWatchTone: versionWatch.tone,
        versionWatchLabel: versionWatch.label,
        bindingTone,
        bindingLabel,
        handoffHref: buildTenantRuntimeHref(runtimeKind, row.tenantId),
        handoffLabel: describeTenantRuntimeLabel(runtimeKind),
        attentionKey: attention.key,
        attentionLabel: attention.label,
        attentionTone: attention.tone,
        attentionRank: attention.rank,
      };
    }).sort((left, right) => {
      if (right.attentionRank !== left.attentionRank) return right.attentionRank - left.attentionRank;
      return (parseDate(right.lastSeenAt)?.getTime() || 0) - (parseDate(left.lastSeenAt)?.getTime() || 0);
    });
  }
  function buildOwnerRuntimeFleetWatch(rows) {
    const items = Array.isArray(rows) ? rows : [];
    const needsProvisioning = items.filter((row) => row.attentionKey === 'needs-provisioning').length;
    const pendingActivation = items.filter((row) => trimText(row.provisionStatus, 80).toLowerCase() === 'pending_activation').length;
    const bindingGaps = items.filter((row) => row.attentionKey === 'binding-gap').length;
    const versionGaps = items.filter((row) => row.versionWatchTone === 'danger').length;
    const scopeIssues = items.filter((row) => row.attentionKey === 'missing-tenant-scope' || row.attentionKey === 'missing-runtime-kind').length;
    const offlineOrStale = items.filter((row) => toneForStatus(row.status) !== 'success').length;
    return [
      {
        label: 'Needs provisioning',
        value: formatNumber(needsProvisioning, '0'),
        detail: needsProvisioning ? 'These runtimes still lack an active credential or provisioning token.' : 'Every visible runtime has a credential or provisioning path.',
        tone: needsProvisioning ? 'danger' : 'success',
      },
      {
        label: 'Pending activation',
        value: formatNumber(pendingActivation, '0'),
        detail: pendingActivation ? 'Provisioning exists but the target machine has not activated yet.' : 'No pending activation tokens are blocking the visible fleet.',
        tone: pendingActivation ? 'warning' : 'success',
      },
      {
        label: 'Binding gaps',
        value: formatNumber(bindingGaps, '0'),
        detail: bindingGaps ? 'At least one runtime still needs a machine binding before it is trustworthy.' : 'All visible runtimes have a machine binding.',
        tone: bindingGaps ? 'warning' : 'success',
      },
      {
        label: 'Version gaps',
        value: formatNumber(versionGaps, '0'),
        detail: versionGaps ? 'Some runtimes are below the visible minimum version target.' : 'Visible runtimes meet the version floor where one is configured.',
        tone: versionGaps ? 'danger' : 'success',
      },
      {
        label: 'Scope issues',
        value: formatNumber(scopeIssues, '0'),
        detail: scopeIssues ? 'Review runtimes that are missing tenant scope or runtime kind before routing incidents.' : 'Tenant scope and runtime kind are present for visible runtimes.',
        tone: scopeIssues ? 'danger' : 'success',
      },
      {
        label: 'Offline or stale',
        value: formatNumber(offlineOrStale, '0'),
        detail: offlineOrStale ? 'These runtimes need operator review before relying on delivery, sync, or restart work.' : 'Visible runtimes are reporting healthy status.',
        tone: offlineOrStale ? 'warning' : 'success',
      },
    ];
  }
  function buildOwnerRuntimeAttentionRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter((row) => row.attentionRank > 0).slice(0, 8);
  }
  function buildOwnerRuntimeAttentionGroups(rows) {
    const items = Array.isArray(rows) ? rows : [];
    const groups = [
      {
        key: 'needs-provisioning',
        label: 'Needs provisioning',
        tone: 'danger',
        detail: 'Create or repair the provisioning path before this runtime is treated as ready.',
        predicate: (row) => row.attentionKey === 'needs-provisioning',
      },
      {
        key: 'pending-activation',
        label: 'Pending activation',
        tone: 'warning',
        detail: 'The machine still has a token or draft binding that has not activated yet.',
        predicate: (row) => trimText(row.provisionStatus, 80).toLowerCase() === 'pending_activation',
      },
      {
        key: 'binding-gap',
        label: 'Binding gaps',
        tone: 'warning',
        detail: 'A runtime exists, but it still needs a stable machine binding before it is trustworthy.',
        predicate: (row) => row.attentionKey === 'binding-gap',
      },
      {
        key: 'version-gap',
        label: 'Version gaps',
        tone: 'danger',
        detail: 'These runtimes are below the current minimum version target.',
        predicate: (row) => row.versionWatchTone === 'danger',
      },
      {
        key: 'scope-issues',
        label: 'Scope issues',
        tone: 'danger',
        detail: 'Tenant scope or runtime type is incomplete, so routing and remediation stay ambiguous.',
        predicate: (row) => row.attentionKey === 'missing-tenant-scope' || row.attentionKey === 'missing-runtime-kind',
      },
      {
        key: 'offline-or-stale',
        label: 'Offline or stale',
        tone: 'warning',
        detail: 'These runtimes are not reporting healthy status and need operator review before use.',
        predicate: (row) => toneForStatus(row.status) !== 'success',
      },
    ];
    return groups.map((group) => {
      const matches = items.filter(group.predicate);
      return {
        key: group.key,
        label: group.label,
        tone: group.tone,
        detail: group.detail,
        count: matches.length,
        rows: matches.slice(0, 8),
      };
    }).filter((group) => group.count > 0);
  }
  function normalizeBackupFiles(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        id: trimText(item && item.id, 160),
        file: trimText(item && item.file, 260),
        sizeBytes: Number(item && item.sizeBytes || 0),
        createdAt: item && item.createdAt,
        updatedAt: item && item.updatedAt,
      }))
      .filter((item) => item.file || item.id)
      .sort((left, right) => (parseDate(right.updatedAt)?.getTime() || 0) - (parseDate(left.updatedAt)?.getTime() || 0));
  }
  function normalizeRestoreHistory(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => ({
        operationId: trimText(item && item.operationId, 160),
        status: trimText(item && item.status, 80).toLowerCase() || 'idle',
        backup: trimText(item && item.backup, 260),
        confirmBackup: trimText(item && item.confirmBackup, 260),
        rollbackBackup: trimText(item && item.rollbackBackup, 260),
        rollbackStatus: trimText(item && item.rollbackStatus, 80).toLowerCase() || 'none',
        lastError: trimText(item && item.lastError, 400),
        actor: trimText(item && item.actor, 160),
        recordedAt: item && (item.recordedAt || item.endedAt || item.updatedAt || item.startedAt),
        warnings: Array.isArray(item && item.warnings) ? item.warnings.filter(Boolean) : [],
        verification: item && item.verification && typeof item.verification === 'object' ? item.verification : null,
      }))
      .filter((item) => item.backup || item.operationId)
      .sort((left, right) => (parseDate(right.recordedAt)?.getTime() || 0) - (parseDate(left.recordedAt)?.getTime() || 0));
  }
  function buildRestorePhase(restoreState, restorePreview) {
    const state = restoreState && typeof restoreState === 'object' ? restoreState : {};
    const preview = restorePreview && typeof restorePreview === 'object' ? restorePreview : null;
    const status = trimText(state.status, 80).toLowerCase();
    const rollbackStatus = trimText(state.rollbackStatus, 80).toLowerCase();
    if (status === 'running') {
      return {
        key: 'executing',
        tone: 'warning',
        label: 'Restore running',
        detail: firstNonEmpty([
          trimText(state.backup, 160) ? `Shared restore is applying ${trimText(state.backup, 160)} right now.` : '',
          'Shared restore is running. Keep operators out of sensitive workflows until verification finishes.',
        ]),
      };
    }
    if (status === 'succeeded') {
      return {
        key: 'completed',
        tone: 'success',
        label: 'Restore completed',
        detail: state.verification && state.verification.ready === true
          ? 'Verification checks passed for the latest restore cycle.'
          : 'The latest restore finished. Review verification details before declaring recovery complete.',
      };
    }
    if (status === 'failed' && rollbackStatus === 'succeeded') {
      return {
        key: 'rolled-back',
        tone: 'warning',
        label: 'Restore rolled back',
        detail: firstNonEmpty([
          trimText(state.lastError, 220),
          'The restore failed and the rollback backup was applied to keep the control plane stable.',
        ]),
      };
    }
    if (status === 'failed') {
      return {
        key: 'failed',
        tone: 'danger',
        label: 'Restore failed',
        detail: firstNonEmpty([
          trimText(state.lastError, 220),
          'The latest restore failed. Review the preview and history before retrying.',
        ]),
      };
    }
    if (preview || state.previewBackup || state.previewToken) {
      return {
        key: 'previewed',
        tone: 'info',
        label: 'Preview ready',
        detail: state.previewExpiresAt
          ? `Preview guard expires ${formatDateTime(state.previewExpiresAt)}.`
          : 'A dry-run preview is ready for guarded restore.',
      };
    }
    return {
      key: 'idle',
      tone: 'muted',
      label: 'Recovery idle',
      detail: 'Create a backup or run a dry-run preview before using guarded restore.',
    };
  }
  function buildRecoveryStrip(restoreState, restorePreview, backupFiles, restoreHistory) {
    const state = restoreState && typeof restoreState === 'object' ? restoreState : {};
    const preview = restorePreview && typeof restorePreview === 'object' ? restorePreview : null;
    const phase = buildRestorePhase(state, preview);
    const warningCount = Array.isArray(preview && preview.warnings)
      ? preview.warnings.length
      : Array.isArray(state.warnings)
        ? state.warnings.length
        : 0;
    const lastHistory = Array.isArray(restoreHistory) && restoreHistory.length ? restoreHistory[0] : null;
    const previewToken = trimText(preview && preview.previewToken, 180) || trimText(state.previewToken, 180);
    return [
      {
        label: 'Recovery phase',
        value: phase.label,
        detail: phase.detail,
        tone: phase.tone,
      },
      {
        label: 'Backups visible',
        value: formatNumber(Array.isArray(backupFiles) ? backupFiles.length : 0, '0'),
        detail: Array.isArray(backupFiles) && backupFiles.length
          ? `Latest backup updated ${formatDateTime(backupFiles[0].updatedAt || backupFiles[0].createdAt)}.`
          : 'No shared backup files are visible yet.',
        tone: Array.isArray(backupFiles) && backupFiles.length ? 'success' : 'warning',
      },
      {
        label: 'Preview guard',
        value: previewToken ? 'Ready' : 'Missing',
        detail: previewToken
          ? `Warnings ${formatNumber(warningCount, '0')} · ${trimText(preview && preview.backup, 160) || trimText(state.previewBackup, 160) || 'preview source recorded'}`
          : 'Run a dry-run preview to mint a guarded restore token.',
        tone: previewToken ? 'info' : 'warning',
      },
      {
        label: 'Restore history',
        value: formatNumber(Array.isArray(restoreHistory) ? restoreHistory.length : 0, '0'),
        detail: lastHistory
          ? `${firstNonEmpty([lastHistory.backup, lastHistory.operationId], 'Latest restore')} · ${formatDateTime(lastHistory.recordedAt)}`
          : 'No shared restore history has been recorded yet.',
        tone: lastHistory ? 'muted' : 'info',
      },
    ];
  }
  function buildRuntimeRouteView(currentRoute, context = {}) {
    const route = normalizeRuntimeNavRoute(currentRoute);
    const feedCount = Number(context.feedCount || 0);
    const hotspotCount = Number(context.hotspotCount || 0);
    const staleAgents = Number(context.staleAgents || 0);
    const degradedRuntimeCount = Number(context.degradedRuntimeCount || 0);
    const base = {
      pageKicker: 'สถานะระบบและเหตุการณ์',
      headerTitle: 'สถานะระบบและเหตุการณ์',
      headerSubtitle: 'ดูความพร้อมของบริการ สัญญาณผิดปกติ และแรงกดดันของคำขอในมุมเดียวเพื่อให้ตัดสินใจได้เร็ว',
      primaryAction: feedCount > 0
        ? { label: 'เปิดเหตุการณ์ล่าสุด (แนะนำ)', href: '#incidents' }
        : { label: 'เปิดคำขอและความช้า', href: '#observability' },
      services: {
        kicker: 'บริการ',
        title: 'บริการที่ต้องเฝ้าดู',
        copy: 'วางบริการหลักและบริการฝั่งเครื่องรันงานไว้ในจุดเดียวเพื่อให้อ่านสภาพระบบได้เร็ว',
      },
      jobs: {
        kicker: 'บอทและเครื่องรันงาน',
        title: 'Delivery Agent และ Server Bot',
        copy: 'ให้สถานะของเครื่องที่รับงานจริงมองเห็นได้ก่อน เพื่อแยกปัญหาที่มาจากคิวกับบริการด้านหลัง',
      },
      incidents: {
        kicker: 'เหตุการณ์',
        title: 'สัญญาณที่เจ้าของระบบควรรู้ตอนนี้',
        copy: 'เริ่มจาก feed นี้ก่อนเปิดซัพพอร์ตหรือเครื่องมือ replay เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่า',
      },
      observability: {
        kicker: 'คำขอและความช้า',
        title: 'จุดร้อนของคำขอ',
        copy: 'สรุปคำขอแบบกะทัดรัดช่วยให้เจ้าของระบบตัดสินใจได้เร็วกว่าการมองกราฟใหญ่เต็มหน้า',
      },
      runbooks: {
        kicker: 'แนวทางปฏิบัติ',
        title: 'ควรเช็กอะไรก่อน',
      },
      blockOrder: ['services', 'jobs', 'incidents', 'observability'],
      railHeader: 'บริบทการปฏิบัติการ',
      railCopy: 'เก็บหลักฐานและงานติดตามของเจ้าของระบบไว้ใกล้มือเสมอขณะตรวจรันไทม์หรือเหตุการณ์',
    };

    if (route === 'incidents') {
      return {
        ...base,
        headerTitle: 'เหตุการณ์และสัญญาณ',
        headerSubtitle: 'เปิดดูสัญญาณใหม่และรุนแรงที่สุดก่อน เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่าซัพพอร์ตหนึ่งเคส',
        primaryAction: { label: 'เปิดรายการเหตุการณ์ (แนะนำ)', href: '#incidents' },
        incidents: {
          kicker: 'Incident Feed',
          title: 'สัญญาณที่ต้องเปิดดูก่อน',
          copy: 'ใช้ feed นี้แยกเหตุที่เพิ่งเกิดและกระทบหลายส่วนออกจากงานประจำวันอื่น',
        },
        observability: {
          kicker: 'ข้อมูลประกอบ',
          title: 'จุดร้อนของคำขอที่เกี่ยวข้อง',
          copy: 'ดึง request และ hotspot ขึ้นมาดูต่อทันทีเมื่อ feed เริ่มหนาแน่นผิดปกติ',
        },
        blockOrder: ['incidents', 'observability', 'services', 'jobs'],
        railHeader: 'บริบทเหตุการณ์',
        railCopy: 'เริ่มจากเหตุการณ์ก่อน แล้วค่อยดึงหลักฐานประกอบจากคำขอและสถานะบริการ',
      };
    }

    if (route === 'observability' || route === 'audit') {
      return {
        ...base,
        pageKicker: route === 'audit' ? 'หลักฐานและบันทึก' : 'คำขอและความช้า',
        headerTitle: route === 'audit' ? 'หลักฐานและบันทึก' : 'คำขอและความช้า',
        headerSubtitle: route === 'audit'
          ? 'ย้อนดูหลักฐานของคำขอ ความช้า และข้อผิดพลาดก่อนสรุปเป็นเหตุการณ์หรือใช้คุยกับทีม'
          : 'ไล่จุดร้อน ข้อผิดพลาด และความช้าของระบบก่อนตัดสินใจแก้ปัญหา',
        primaryAction: { label: route === 'audit' ? 'เปิดหลักฐานของคำขอ (แนะนำ)' : 'เปิดจุดร้อนของคำขอ (แนะนำ)', href: '#observability' },
        observability: {
          kicker: route === 'audit' ? 'หลักฐานของคำขอ' : 'คำขอและความช้า',
          title: route === 'audit' ? 'หลักฐานของคำขอและจุดร้อน' : 'จุดร้อนของคำขอ',
          copy: route === 'audit'
            ? 'ใช้ส่วนนี้เก็บบริบทของ request, latency และข้อผิดพลาดก่อนสรุปเป็น incident หรือออดิท'
            : 'เริ่มจาก route และ error ที่ร้อนที่สุด แล้วค่อยไล่ต่อไปยังบริการที่เกี่ยวข้อง',
        },
        runbooks: {
          kicker: route === 'audit' ? 'สิ่งที่ควรยืนยัน' : 'แนวทางปฏิบัติ',
          title: route === 'audit' ? 'หลักฐานที่ควรเก็บก่อนลงมือ' : 'ควรเช็กอะไรก่อน',
        },
        blockOrder: ['observability', 'incidents', 'services', 'jobs'],
        railHeader: route === 'audit' ? 'บริบทหลักฐาน' : 'บริบทคำขอ',
        railCopy: route === 'audit'
          ? 'งานรีวิวควรใช้หลักฐานของคำขอ เหตุการณ์ และบริการชุดเดียวกัน'
          : 'รวมคำขอที่ช้า ข้อผิดพลาด และแนวทางเช็กต่อไว้ในชุดเดียว',
      };
    }

    if (route === 'jobs') {
      return {
        ...base,
        headerTitle: 'งานรอและบอท',
        headerSubtitle: 'แยกงานส่งของ งานที่ล้มเหลว และรายชื่อบอทให้อ่านง่ายจากมุมเดียว',
        primaryAction: { label: 'เปิดรายชื่อบอท (แนะนำ)', href: '#jobs' },
        jobs: {
          kicker: 'รายชื่อบอท',
          title: 'Delivery Agent และ Server Bot',
          copy: 'เริ่มจากสถานะของเครื่องที่รับงานจริงก่อน แล้วค่อยไล่กลับไปดูบริการและเหตุการณ์',
        },
        services: {
          kicker: 'บริการที่เกี่ยวข้อง',
          title: 'บริการที่คิวต้องพึ่งพา',
          copy: 'ใช้มุมนี้เช็กว่าความล้มเหลวมาจากเครื่องรันงานหรือมาจากบริการที่รองรับอยู่ด้านหลัง',
        },
        blockOrder: ['jobs', 'services', 'incidents', 'observability'],
        railHeader: 'บริบทคิวงาน',
        railCopy: 'ให้สถานะของ Delivery Agent และ Server Bot มองเห็นได้ก่อนคุยเรื่อง retry หรือ replay งาน',
      };
    }

    if (route === 'recovery') {
      return {
        ...base,
        pageKicker: 'สำรองข้อมูลและกู้คืน',
        headerTitle: 'Backup / Restore Manager',
        headerSubtitle: 'ใช้หน้านี้สร้าง shared backup, ตรวจ dry-run preview, และรัน guarded restore โดยไม่ต้องกลับไปหน้า owner console รุ่นเก่า',
        primaryAction: { label: 'เปิด workbench กู้คืน (แนะนำ)', href: '#recovery' },
        recovery: {
          kicker: 'Recovery workbench',
          title: 'Shared backup and guarded restore',
          copy: 'เริ่มจาก backup inventory และ dry-run preview ก่อน แล้วค่อยยืนยัน restore ด้วย preview token เดียวกัน',
        },
        jobs: {
          kicker: 'Runtime context',
          title: 'Delivery Agent และ Server Bot ที่ต้องเฝ้าดู',
          copy: 'หลัง restore ให้ย้อนดู runtime fleet ต่อทันทีเพื่อยืนยันว่า binding และ version ยังอยู่ในเกณฑ์',
        },
        observability: {
          kicker: 'Verification context',
          title: 'จุดร้อนของคำขอหลังการกู้คืน',
          copy: 'ให้ request hotspot และ error ล่าสุดอยู่ใกล้ recovery history เพื่อใช้เทียบก่อนและหลัง restore',
        },
        blockOrder: ['recovery', 'jobs', 'observability', 'incidents'],
        railHeader: 'บริบทการกู้คืน',
        railCopy: 'กู้คืนเฉพาะเมื่อ preview, verification plan, และ rollback posture ชัดพอแล้วเท่านั้น',
      };
    }

    if (route === 'support' || route === 'security') {
      return {
        ...base,
        pageKicker: route === 'security' ? 'ความปลอดภัยและหลักฐาน' : 'ซัพพอร์ตและสัญญาณ',
        headerTitle: route === 'security' ? 'ความปลอดภัยและหลักฐาน' : 'ซัพพอร์ตและสัญญาณ',
        headerSubtitle: route === 'security'
          ? 'แยกสัญญาณด้านสิทธิ์ การเข้าถึง และเหตุผิดปกติออกจากงานซัพพอร์ตทั่วไป'
          : 'ใช้หน้านี้เริ่มจากเหตุการณ์ที่กระทบผู้เช่าจริงก่อน แล้วค่อยดึงหลักฐานจากคำขอและบริการมาประกอบ',
        primaryAction: { label: 'เปิดเหตุการณ์ล่าสุด (แนะนำ)', href: '#incidents' },
        incidents: {
          kicker: route === 'security' ? 'สัญญาณด้านความปลอดภัย' : 'ฟีดเหตุการณ์',
          title: route === 'security' ? 'สัญญาณที่ต้องยืนยันสิทธิ์และหลักฐาน' : 'เหตุการณ์ที่ซัพพอร์ตรู้แล้วจะคุยง่ายขึ้น',
          copy: route === 'security'
            ? 'ใช้ feed นี้แยกเหตุด้านสิทธิ์และเหตุผิดปกติออกจากงานซัพพอร์ตทั่วไป เพื่อไม่ให้ประเด็นสำคัญหลุด'
            : 'เริ่มจากเหตุการณ์ก่อนเปิดเครื่องมือ replay หรือ diagnostics เพื่อไม่ให้หลุดบริบทของลูกค้า',
        },
        observability: {
          kicker: 'หลักฐานของคำขอ',
          title: 'คำขอและความช้าที่ควรดูต่อ',
          copy: 'รวม hotspot และ request error ที่ช่วยตอบได้ว่าเรื่องนี้เกิดจาก runtime, API หรือแรงกดดันของระบบ',
        },
        blockOrder: ['incidents', 'observability', 'jobs', 'services'],
        railHeader: route === 'security' ? 'บริบทความปลอดภัย' : 'บริบทซัพพอร์ต',
        railCopy: route === 'security'
          ? 'สิทธิ์ การเข้าถึง และหลักฐานควรอยู่ใกล้เหตุการณ์และคำขอที่เกี่ยวข้องเสมอ'
          : 'ให้ซัพพอร์ต เอกสารประกอบ และสถานะบริการอยู่ใกล้กันเพื่อคุยกับลูกค้าได้ต่อเนื่อง',
      };
    }

    return base;
  }

  function createOwnerRuntimeHealthV4Model(source, options = {}) {
    const state = source && typeof source === 'object' ? source : {};
    const currentRoute = String(options.currentRoute || 'runtime-health').trim().toLowerCase() || 'runtime-health';
    const runtimeRows = normalizeRuntimeRows(state.runtimeSupervisor).map((row) => ({
      name: row.label || row.name || row.service || '-',
      status: row.status || 'unknown',
      detail: row.detail || row.reason || row.summary || '-',
      updatedAt: row.updatedAt || row.checkedAt || row.lastSeenAt,
    }));
    const agentRows = buildOwnerRuntimeFleetRows(state);
    const fleetWatch = buildOwnerRuntimeFleetWatch(agentRows);
    const attentionRows = buildOwnerRuntimeAttentionRows(agentRows);
    const attentionGroups = buildOwnerRuntimeAttentionGroups(agentRows);
    const feed = buildIncidentFeed(state);
    const hotspots = buildHotspots(state);
    const readyRuntimeCount = runtimeRows.filter((row) => toneForStatus(row.status) === 'success').length;
    const degradedRuntimeCount = runtimeRows.filter((row) => toneForStatus(row.status) === 'warning').length;
    const staleAgents = agentRows.filter((row) => toneForStatus(row.status) !== 'success').length;
    const lifecycle = state.deliveryLifecycle && state.deliveryLifecycle.summary ? state.deliveryLifecycle.summary : {};
    const restoreState = state.restoreState && typeof state.restoreState === 'object' ? state.restoreState : {};
    const restorePreview = state.restorePreview && typeof state.restorePreview === 'object' ? state.restorePreview : null;
    const backupFiles = normalizeBackupFiles(state.backupFiles);
    const restoreHistory = normalizeRestoreHistory(state.restoreHistory);
    const routeView = buildRuntimeRouteView(currentRoute, {
      feedCount: feed.length,
      hotspotCount: hotspots.length,
      staleAgents,
      degradedRuntimeCount,
      deadLetterCount: Number(lifecycle.deadLetterCount || 0),
    });
    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'แผงเจ้าของระบบ',
        workspaceLabel: routeView.headerTitle || 'สถานะบริการ',
        environmentLabel: 'ระดับแพลตฟอร์ม',
        navGroups: cloneNavGroups(NAV_GROUPS, currentRoute),
      },
      header: {
        title: routeView.headerTitle || 'สถานะบริการและเหตุการณ์',
        subtitle: routeView.headerSubtitle || 'โต๊ะปฏิบัติการของเจ้าของระบบสำหรับไล่สัญญาณผิดปกติ ดูความพร้อมของบริการ และตัดสินใจว่าเรื่องใดต้องแก้ก่อน',
        statusChips: [
          { label: `${formatNumber(readyRuntimeCount, '0')}/${formatNumber(runtimeRows.length, '0')} บริการพร้อม`, tone: readyRuntimeCount === runtimeRows.length ? 'success' : 'warning' },
          { label: `${formatNumber(staleAgents, '0')} บอทต้องจับตา`, tone: staleAgents > 0 ? 'warning' : 'success' },
          { label: `${formatNumber(feed.length, '0')} สัญญาณที่ยังเปิดอยู่`, tone: feed.length > 0 ? 'warning' : 'muted' },
          { label: `${formatNumber(Number(state.requestLogs && state.requestLogs.metrics && state.requestLogs.metrics.slowRequests || 0), '0')} คำขอที่ช้า`, tone: Number(state.requestLogs && state.requestLogs.metrics && state.requestLogs.metrics.slowRequests || 0) > 0 ? 'warning' : 'muted' },
        ],
        primaryAction: routeView.primaryAction || { label: 'เปิดคำขอและความช้า', href: '#observability' },
      },
      summaryStrip: [
        { label: 'บริการที่พร้อม', value: formatNumber(readyRuntimeCount, '0'), detail: 'บริการที่รายงานสถานะปกติ', tone: 'success' },
        { label: 'บริการที่ต้องจับตา', value: formatNumber(degradedRuntimeCount, '0'), detail: 'บริการที่เจ้าของระบบควรเปิดดูต่อ', tone: degradedRuntimeCount > 0 ? 'warning' : 'muted' },
        { label: 'สถานะบอท', value: formatNumber(staleAgents, '0'), detail: 'ภาพรวมของ Delivery Agent และ Server Bot', tone: staleAgents > 0 ? 'danger' : 'success' },
        { label: 'งานที่ล้มเหลว', value: formatNumber(lifecycle.deadLetterCount, '0'), detail: 'คิวส่งของที่ไม่ควรปล่อยค้าง', tone: Number(lifecycle.deadLetterCount || 0) > 0 ? 'danger' : 'muted' },
      ],
      runtimeRows,
      agentRows,
      fleetWatch,
      attentionRows,
      attentionGroups,
      restoreState,
      restorePreview,
      backupFiles,
      restoreHistory,
      recoveryStrip: buildRecoveryStrip(restoreState, restorePreview, backupFiles, restoreHistory),
      incidentFeed: feed,
      hotspots,
      routeView,
      runbooks: [
        { title: 'คิวงานเริ่มตึง', body: 'ถ้างานที่ล้มเหลวเพิ่มขึ้นหรืองานค้างหลายขั้น ให้เช็กสถานะ Delivery Agent และ Server Bot ก่อน แล้วค่อยให้ทีมผู้เช่าลอง retry หรือ replay งาน' },
        { title: 'บริการเริ่มไม่เสถียร', body: 'ถ้าบริการเริ่มไม่สดหรือเริ่มไม่เสถียร ให้ยืนยันการติดต่อครั้งล่าสุดและดูการเปลี่ยนแปลงล่าสุดก่อนแตะคิวของผู้เช่า' },
        { title: 'คำขอเริ่มผิดปกติ', body: 'ดูจุดร้อนและข้อผิดพลาดล่าสุดของคำขอก่อน เพื่อแยกว่าเป็นปัญหาจากบอท, API หรือปริมาณงานที่พุ่งขึ้นจากฝั่งเชิงพาณิชย์และซัพพอร์ต' },
      ],
      railCards: [
        { title: 'เส้นทางส่งออกหลักฐาน', body: 'ใช้รายงานคำขอและเครื่องมือวิเคราะห์ก่อนลงมือทำสิ่งที่เสี่ยง หลักฐานควรถูกพาไปกับเหตุการณ์เสมอ', meta: 'งานซัพพอร์ตและงานรีวิวความปลอดภัยควรใช้หลักฐานชุดเดียวกัน', tone: 'info' },
        { title: 'แรงกดดันปัจจุบัน', body: feed.length > 0 ? 'ตอนนี้ฟีดเหตุการณ์ยังมีรายการ ให้เริ่มจากแถวที่ใหม่และรุนแรงที่สุดก่อนเสมอ' : 'ตอนนี้ยังไม่เห็นกลุ่มสัญญาณด่วนจากข้อมูลชุดนี้', meta: hotspots.length > 0 ? `${hotspots[0].route} คือกลุ่มคำขอที่ร้อนที่สุดตอนนี้` : 'ยังไม่มีตัวอย่างจุดร้อนให้ใช้ตัดสินใจ', tone: feed.length > 0 ? 'warning' : 'success' },
      ],
    };
  }

  function renderNavGroups(items) {
    return (Array.isArray(items) ? items : []).map((group) => [
      '<section class="odv4-nav-group">',
      `<span class="odv4-nav-group-label">${escapeHtml(group.label || '')}</span>`,
      '<div class="odv4-nav-items">',
      ...(Array.isArray(group.items) ? group.items : []).map((item) => `<a class="${item.current ? 'odv4-nav-link odv4-nav-link-current' : 'odv4-nav-link'}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label || '')}</a>`),
      '</div></section>',
    ].join('')).join('');
  }
  function renderChips(items) {
    return (Array.isArray(items) ? items : []).map((item) => `<span class="odv4-badge odv4-badge-${escapeHtml(item.tone || 'muted')}">${escapeHtml(item.label || '')}</span>`).join('');
  }
  function renderSummaryStrip(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-kpi odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<span class="odv4-kpi-label">${escapeHtml(item.label || '')}</span>`,
      `<strong class="odv4-kpi-value">${escapeHtml(item.value || '-')}</strong>`,
      `<p class="odv4-kpi-detail">${escapeHtml(item.detail || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }
  function renderRuntimeTable(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state">ยังไม่มีข้อมูลรันไทม์ในตัวอย่างชุดนี้</div>';
    return [
      '<div class="odv4-table">',
      '<div class="odv4-table-head cols-4"><span>บริการ</span><span>สถานะ</span><span>รายละเอียด</span><span>อัปเดตล่าสุด</span></div>',
      ...items.map((row) => [
        '<div class="odv4-table-row cols-4">',
        `<div class="odv4-table-cell"><strong>${escapeHtml(row.name)}</strong></div>`,
        `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(row.status))}">${escapeHtml(row.status || 'unknown')}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-note">${escapeHtml(row.detail)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(formatDateTime(row.updatedAt))}</span></div>`,
        '</div>',
      ].join('')),
      '</div>',
    ].join('');
  }
  function renderAgentTable(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state">ยังไม่มีข้อมูลเอเจนต์ในตัวอย่างชุดนี้</div>';
    return [
      '<div class="odv4-table">',
      '<div class="odv4-table-head cols-5"><span>รันไทม์</span><span>บทบาท</span><span>ช่องทาง</span><span>สถานะ</span><span>เห็นล่าสุด</span></div>',
      ...items.map((row) => [
        '<div class="odv4-table-row cols-5">',
        `<div class="odv4-table-cell"><strong>${escapeHtml(row.runtime)}</strong><span class="odv4-table-note">${escapeHtml(row.version)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-muted">${escapeHtml(row.role)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-note">${escapeHtml(row.channel)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(row.status))}">${escapeHtml(row.status || 'unknown')}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(formatDateTime(row.lastSeenAt))}</span></div>`,
        '</div>',
      ].join('')),
      '</div>',
    ].join('');
  }
  function renderAgentRuntimeFleetTable(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="odv4-empty-state">No agent runtime data in this preview state.</div>';
    }
    return [
      '<div class="odv4-table">',
      '<div class="odv4-table-head cols-6"><span>Runtime</span><span>Role</span><span>Tenant / Server</span><span>Status</span><span>Last seen</span><span>Actions</span></div>',
      ...items.map((row) => {
        const runtimeMeta = [row.version, row.channel].filter((value) => String(value || '').trim()).join(' · ') || '-';
        const runtimeKindNote = row.runtimeKind === 'server-bots'
          ? 'Server Bot runtime'
          : row.runtimeKind === 'delivery-agents'
            ? 'Delivery Agent runtime'
            : 'Runtime type pending';
        const tenantLabel = row.tenantLabel || 'Tenant not attached';
        const serverLabel = row.serverLabel || '-';
        const actionCell = row.handoffHref
          ? `<a class="odv4-button odv4-button-secondary" data-owner-runtime-handoff="${escapeHtml(row.runtimeKind || '')}" href="${escapeHtml(row.handoffHref)}">${escapeHtml(row.handoffLabel || 'Open tenant runtime')}</a>`
          : '<span class="odv4-table-note">Tenant scope missing</span>';
        return [
          '<div class="odv4-table-row cols-6">',
          `<div class="odv4-table-cell"><strong>${escapeHtml(row.runtime)}</strong><span class="odv4-table-note">${escapeHtml(runtimeMeta)}</span></div>`,
          `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-muted">${escapeHtml(row.role)}</span><span class="odv4-table-note">${escapeHtml(runtimeKindNote)}</span></div>`,
          `<div class="odv4-table-cell"><strong>${escapeHtml(tenantLabel)}</strong><span class="odv4-table-note">${escapeHtml(serverLabel)}</span></div>`,
          `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(row.status))}">${escapeHtml(row.status || 'unknown')}</span></div>`,
          `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(formatDateTime(row.lastSeenAt))}</span></div>`,
          `<div class="odv4-table-cell odv4-table-actions">${actionCell}</div>`,
          '</div>',
        ].join('');
      }),
      '</div>',
    ].join('');
  }
  function buildOwnerRuntimeAttentionActions(row) {
    const item = row && typeof row === 'object' ? row : {};
    const actions = [];
    if (item.handoffHref) {
      actions.push({
        key: 'tenant-runtime',
        href: item.handoffHref,
        label: item.handoffLabel || 'Open tenant runtime',
        attentionKey: item.attentionKey || '',
      });
    }
    if (item.tenantId) {
      actions.push({
        key: 'tenant-detail',
        href: buildOwnerTenantHref(item.tenantId),
        label: 'Open tenant detail',
        attentionKey: item.attentionKey || '',
      });
    }
    if (item.tenantId && ['binding-gap', 'version-gap', 'runtime-offline', 'runtime-watch', 'missing-runtime-kind'].includes(item.attentionKey)) {
      actions.push({
        key: 'support',
        href: buildOwnerSupportHref(item.tenantId),
        label: 'Open support case',
        attentionKey: item.attentionKey || '',
      });
    }
    if (['runtime-offline', 'runtime-watch', 'missing-tenant-scope', 'missing-runtime-kind'].includes(item.attentionKey)) {
      actions.push({
        key: 'incidents',
        href: buildOwnerRuntimeSectionHref('incidents'),
        label: 'Review incidents',
        attentionKey: item.attentionKey || '',
      });
    }
    if (item.attentionKey === 'version-gap') {
      actions.push({
        key: 'observability',
        href: buildOwnerRuntimeSectionHref('observability'),
        label: 'Review observability',
        attentionKey: item.attentionKey || '',
      });
    }
    const seen = new Set();
    return actions.filter((action) => {
      const href = String(action && action.href || '').trim();
      if (!href) return false;
      const identity = `${action.key}:${href}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }).slice(0, 4);
  }
  function renderAgentRuntimeAttentionTable(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="odv4-empty-state">No runtime fleet issues need owner follow-up right now.</div>';
    }
    return [
      '<div class="odv4-table" data-owner-runtime-attention-table="true">',
      '<div class="odv4-table-head cols-7"><span>Attention</span><span>Runtime</span><span>Tenant / Server</span><span>Binding</span><span>Status</span><span>Last seen</span><span>Actions</span></div>',
      ...items.map((row) => {
        const actions = buildOwnerRuntimeAttentionActions(row);
        const actionCell = actions.length
          ? `<div class="odvc4-inline-actions">${actions.map((action) => `<a class="odv4-button odv4-button-secondary" data-owner-runtime-action="${escapeHtml(action.key || '')}" data-owner-runtime-attention="${escapeHtml(action.attentionKey || '')}" href="${escapeHtml(action.href || '#')}">${escapeHtml(action.label || 'Open')}</a>`).join('')}</div>`
          : '<span class="odv4-table-note">Resolve scope before handoff</span>';
        return [
          '<div class="odv4-table-row cols-7">',
          `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(row.attentionTone || 'muted')}">${escapeHtml(row.attentionLabel || 'Needs review')}</span><span class="odv4-table-note">${escapeHtml(row.versionWatchLabel || row.bindingLabel || '-')}</span></div>`,
          `<div class="odv4-table-cell"><strong>${escapeHtml(row.runtime || '-')}</strong><span class="odv4-table-note">${escapeHtml([row.version, row.channel].filter((value) => trimText(value, 80)).join(' · ') || '-')}</span></div>`,
          `<div class="odv4-table-cell"><strong>${escapeHtml(row.tenantLabel || 'Tenant not attached')}</strong><span class="odv4-table-note">${escapeHtml(row.serverLabel || '-')}</span></div>`,
          `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(row.bindingTone || 'muted')}">${escapeHtml(row.bindingLabel || '-')}</span></div>`,
          `<div class="odv4-table-cell"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(row.status))}">${escapeHtml(row.status || 'unknown')}</span></div>`,
          `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(formatDateTime(row.lastSeenAt))}</span></div>`,
          `<div class="odv4-table-cell odv4-table-actions">${actionCell}</div>`,
          '</div>',
        ].join('');
      }),
      '</div>',
    ].join('');
  }
  function renderAgentRuntimeAttentionFilters(groups) {
    if (!Array.isArray(groups) || groups.length === 0) return '';
    return [
      '<div class="odvc4-inline-actions" data-owner-runtime-attention-filters="true">',
      ...groups.map((group) => `<a class="odv4-button odv4-button-secondary" data-owner-runtime-attention-filter="${escapeHtml(group.key || '')}" href="#owner-runtime-attention-${escapeHtml(group.key || '')}">${escapeHtml(group.label || 'Needs review')} (${escapeHtml(formatNumber(group.count || 0, '0'))})</a>`),
      '</div>',
    ].join('');
  }
  function renderAgentRuntimeAttentionGroups(groups) {
    if (!Array.isArray(groups) || groups.length === 0) return '';
    return groups.map((group) => [
      `<div class="odv4-section-head" id="owner-runtime-attention-${escapeHtml(group.key || '')}" data-owner-runtime-attention-group="${escapeHtml(group.key || '')}" style="margin-top:16px;">`,
      `<span class="odv4-section-kicker">Attention slice</span><h4 class="odv4-section-title">${escapeHtml(group.label || 'Needs review')}</h4><p class="odv4-section-copy">${escapeHtml(group.detail || '')}</p></div>`,
      renderAgentRuntimeAttentionTable(group.rows),
    ].join('')).join('');
  }
  function renderFeed(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state">ตอนนี้ยังไม่มีรายการใน incident feed</div>';
    return items.map((item) => [
      `<article class="odv4-feed-item odv4-tone-${escapeHtml(toneForStatus(item.severity || 'warning'))}">`,
      `<div class="odv4-feed-meta"><span class="odv4-pill odv4-pill-${escapeHtml(toneForStatus(item.severity || 'warning'))}">${escapeHtml(item.source || 'สัญญาณ')}</span><span>${escapeHtml(formatDateTime(item.time))}</span></div>`,
      `<strong>${escapeHtml(item.title || 'สัญญาณ')}</strong>`,
      item.detail ? `<p>${escapeHtml(item.detail)}</p>` : '',
      '</article>',
    ].join('')).join('');
  }
  function renderHotspots(items) {
    if (!Array.isArray(items) || items.length === 0) return '<div class="odv4-empty-state">ยังไม่มีตัวอย่าง hotspot ของคำขอในตอนนี้</div>';
    return [
      '<div class="odv4-table">',
      '<div class="odv4-table-head cols-4"><span>กลุ่ม route</span><span>คำขอ</span><span>ข้อผิดพลาด</span><span>P95 latency</span></div>',
      ...items.map((row) => [
        '<div class="odv4-table-row cols-4">',
        `<div class="odv4-table-cell"><strong>${escapeHtml(row.route)}</strong></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(row.requests)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(row.errors)}</span></div>`,
        `<div class="odv4-table-cell"><span class="odv4-table-value">${escapeHtml(row.p95LatencyMs)} ms</span></div>`,
        '</div>',
      ].join('')),
      '</div>',
    ].join('');
  }
  function renderRunbooks(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      '<article class="odv4-runbook-card">',
      '<span class="odv4-table-label">แนวทางปฏิบัติ</span>',
      `<strong>${escapeHtml(item.title || '')}</strong><p>${escapeHtml(item.body || '')}</p>`,
      '</article>',
    ].join('')).join('');
  }
  function renderRailCards(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
      `<article class="odv4-rail-card odv4-tone-${escapeHtml(item.tone || 'muted')}">`,
      `<h4 class="odv4-rail-title">${escapeHtml(item.title || '')}</h4><p class="odv4-rail-copy">${escapeHtml(item.body || '')}</p><div class="odv4-rail-detail">${escapeHtml(item.meta || '')}</div>`,
      '</article>',
    ].join('')).join('');
  }
  function renderRecoveryPreviewCard(restoreState, restorePreview) {
    const state = restoreState && typeof restoreState === 'object' ? restoreState : {};
    const preview = restorePreview && typeof restorePreview === 'object' ? restorePreview : null;
    if (!preview) {
      if (state.previewBackup || state.previewToken) {
        return [
          '<article class="odv4-runbook-card">',
          '<strong>Preview guard is active</strong>',
          `<div class="odv4-feed-meta">${escapeHtml(firstNonEmpty([
            trimText(state.previewBackup, 260),
            'A previous dry-run preview is still active for guarded restore.',
          ]))}</div>`,
          `<p>${escapeHtml(state.previewExpiresAt ? `Preview expires ${formatDateTime(state.previewExpiresAt)}.` : 'Run the preview form again to refresh counts, warnings, and verification details in this workspace.')}</p>`,
          '</article>',
        ].join('');
      }
      return '<div class="odv4-empty-state"><strong>No preview data yet</strong><p>Run a dry-run preview to inspect warnings, verification checks, and the restore guard token before applying a shared backup.</p></div>';
    }
    const warningItems = Array.isArray(preview.warnings) ? preview.warnings.slice(0, 4) : [];
    const verificationChecks = Array.isArray(preview.verificationPlan && preview.verificationPlan.checks)
      ? preview.verificationPlan.checks.slice(0, 5)
      : [];
    return [
      '<article class="odv4-runbook-card" data-owner-runtime-preview-card="true">',
      `<strong>${escapeHtml(firstNonEmpty([trimText(preview.backup, 260), 'Restore preview']))}</strong>`,
      `<div class="odv4-chip-row">${renderChips([
        { label: preview.schemaVersion ? `Schema ${preview.schemaVersion}` : 'Schema unknown', tone: 'info' },
        { label: preview.compatibilityMode || 'Current compatibility', tone: 'muted' },
        { label: preview.previewToken ? 'Preview token issued' : 'Preview token missing', tone: preview.previewToken ? 'success' : 'warning' },
      ])}</div>`,
      `<p>${escapeHtml(firstNonEmpty([
        trimText(preview.note, 260),
        'Dry-run preview generated from the selected shared backup.',
      ]))}</p>`,
      warningItems.length
        ? `<div class="odv4-stack"><span class="odv4-table-label">Warnings</span>${warningItems.map((item) => `<div class="odv4-feed-meta">${escapeHtml(item)}</div>`).join('')}</div>`
        : '<div class="odv4-feed-meta">No preview warnings were returned.</div>',
      verificationChecks.length
        ? `<div class="odv4-stack"><span class="odv4-table-label">Verification plan</span>${verificationChecks.map((item) => `<div class="odv4-feed-meta">${escapeHtml(firstNonEmpty([item.label, item.id], 'check'))}${item.detail ? ` · ${escapeHtml(item.detail)}` : ''}</div>`).join('')}</div>`
        : '<div class="odv4-feed-meta">No verification plan entries were returned.</div>',
      '</article>',
    ].join('');
  }
  function renderRecoveryBackupTable(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="odv4-empty-state"><strong>No backup files found</strong><p>Create a shared backup before using preview or restore.</p></div>';
    }
    return [
      '<div class="odv4-table" data-owner-runtime-backup-table="true">',
      '<div class="odv4-table-head cols-4"><span>Backup</span><span>Updated</span><span>Size</span><span>Detail</span></div>',
      items.slice(0, 12).map((item) => [
        '<div class="odv4-table-row cols-4">',
        `<div><strong>${escapeHtml(firstNonEmpty([item.file, item.id], '-'))}</strong><div class="odv4-table-note">${escapeHtml(item.id || '-')}</div></div>`,
        `<div>${escapeHtml(formatDateTime(item.updatedAt || item.createdAt))}</div>`,
        `<div>${escapeHtml(formatNumber(Math.round(Number(item.sizeBytes || 0) / 1024), '0'))} KB</div>`,
        `<div class="odv4-table-note">${escapeHtml(item.createdAt ? `Created ${formatDateTime(item.createdAt)}` : 'Shared backup inventory entry')}</div>`,
        '</div>',
      ].join('')).join(''),
      '</div>',
    ].join('');
  }
  function renderRecoveryHistoryTable(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="odv4-empty-state"><strong>No restore history yet</strong><p>The owner recovery workbench has not recorded a shared restore cycle yet.</p></div>';
    }
    return [
      '<div class="odv4-table" data-owner-runtime-restore-history="true">',
      '<div class="odv4-table-head cols-5"><span>When</span><span>Backup</span><span>Status</span><span>Verification</span><span>Notes</span></div>',
      items.slice(0, 8).map((item) => [
        '<div class="odv4-table-row cols-5">',
        `<div><strong>${escapeHtml(formatDateTime(item.recordedAt))}</strong><div class="odv4-table-note">${escapeHtml(firstNonEmpty([item.actor, item.operationId], '-'))}</div></div>`,
        `<div><strong>${escapeHtml(firstNonEmpty([item.backup, '-']))}</strong>${item.rollbackBackup ? `<div class="odv4-table-note">Rollback ${escapeHtml(item.rollbackBackup)}</div>` : ''}</div>`,
        `<div><span class="odv4-badge odv4-badge-${escapeHtml(toneForStatus(item.status))}">${escapeHtml(item.status || 'idle')}</span>${item.rollbackStatus && item.rollbackStatus !== 'none' ? `<div class="odv4-table-note">Rollback ${escapeHtml(item.rollbackStatus)}</div>` : ''}</div>`,
        `<div>${item.verification && item.verification.ready === true ? '<span class="odv4-badge odv4-badge-success">Ready</span>' : '<span class="odv4-badge odv4-badge-warning">Pending</span>'}</div>`,
        `<div class="odv4-table-note">${escapeHtml(firstNonEmpty([
          item.lastError,
          item.warnings && item.warnings.length ? item.warnings[0] : '',
          'Shared restore cycle recorded.',
        ]))}</div>`,
        '</div>',
      ].join('')).join(''),
      '</div>',
    ].join('');
  }

  function buildOwnerRuntimeHealthV4Html(model) {
    const safeModel = model && typeof model === 'object' ? model : createOwnerRuntimeHealthV4Model({});
    const routeView = safeModel.routeView && typeof safeModel.routeView === 'object' ? safeModel.routeView : {};
    const servicesSection = [
      '<section class="odv4-panel"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.services && routeView.services.kicker || 'ตารางรันไทม์')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.services && routeView.services.title || 'บริการที่ต้องเฝ้าดู')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.services && routeView.services.copy || 'วางชั้นบริการของแพลตฟอร์มและฝั่งรันไทม์ระยะไกลไว้ในจุดเดียวเพื่อให้อ่านสภาพระบบได้เร็ว')}</p></div>`,
      renderRuntimeTable(safeModel.runtimeRows),
      '</section>',
    ].join('');
    const jobsSection = [
      '<section id="jobs" class="odv4-panel odv4-focus-target" data-owner-focus-route="jobs"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.jobs && routeView.jobs.kicker || 'รายชื่อบอท')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.jobs && routeView.jobs.title || 'ทะเบียนเอเจนต์')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.jobs && routeView.jobs.copy || 'ให้สถานะของ Delivery Agent และ Server Bot มองเห็นได้ตลอด โดยไม่ปนกับมุมมองงานประจำวันของผู้เช่า')}</p></div>`,
      `<section class="odv4-kpi-strip" data-owner-runtime-fleet-watch="jobs">${renderSummaryStrip(safeModel.fleetWatch)}</section>`,
      '<div class="odv4-section-head" style="margin-top:16px;"><span class="odv4-section-kicker">Runtime fleet management</span><h3 class="odv4-section-title">Owner attention queue</h3><p class="odv4-section-copy">Review scope issues, provisioning gaps, stale bindings, and version drift before routing tenants into deeper runtime actions.</p></div>',
      renderAgentRuntimeAttentionFilters(safeModel.attentionGroups),
      renderAgentRuntimeAttentionTable(safeModel.attentionRows),
      renderAgentRuntimeAttentionGroups(safeModel.attentionGroups),
      '<div class="odv4-section-head" style="margin-top:16px;"><span class="odv4-section-kicker">Runtime registry</span><h3 class="odv4-section-title">Visible delivery and server runtimes</h3></div>',
      renderAgentRuntimeFleetTable(safeModel.agentRows),
      '</section>',
    ].join('');
    const incidentsSection = [
      '<section class="odv4-panel"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.incidents && routeView.incidents.kicker || 'เหตุการณ์')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.incidents && routeView.incidents.title || 'สัญญาณที่เจ้าของระบบควรรู้ตอนนี้')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.incidents && routeView.incidents.copy || 'เริ่มจาก feed นี้ก่อนเปิดซัพพอร์ตหรือเครื่องมือ replay เพื่อไม่ให้พลาดเรื่องที่กระทบกว้างกว่า')}</p></div>`,
      `<div class="odv4-feed">${renderFeed(safeModel.incidentFeed)}</div>`,
      '</section>',
    ].join('');
    const observabilitySection = [
      '<section class="odv4-panel"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.observability && routeView.observability.kicker || 'คำขอและความช้า')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.observability && routeView.observability.title || 'จุดร้อนของคำขอ')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.observability && routeView.observability.copy || 'สรุปคำขอแบบกะทัดรัดช่วยให้เจ้าของระบบตัดสินใจได้เร็วกว่าการมองกราฟใหญ่เต็มหน้า')}</p></div>`,
      renderHotspots(safeModel.hotspots),
      `<div class="odv4-section-head" style="margin-top:16px;"><span class="odv4-section-kicker">${escapeHtml(routeView.runbooks && routeView.runbooks.kicker || 'แนวทางปฏิบัติ')}</span><h3 class="odv4-section-title">${escapeHtml(routeView.runbooks && routeView.runbooks.title || 'ควรเช็กอะไรก่อน')}</h3></div>`,
      `<div class="odv4-runbook-grid">${renderRunbooks(safeModel.runbooks)}</div></section>`,
    ].join('');
    const previewBackup = firstNonEmpty([
      trimText(safeModel.restorePreview && safeModel.restorePreview.backup, 260),
      trimText(safeModel.restoreState && safeModel.restoreState.previewBackup, 260),
    ], '');
    const previewToken = firstNonEmpty([
      trimText(safeModel.restorePreview && safeModel.restorePreview.previewToken, 260),
      trimText(safeModel.restoreState && safeModel.restoreState.previewToken, 260),
    ], '');
    const backupOptions = (Array.isArray(safeModel.backupFiles) ? safeModel.backupFiles : [])
      .map((item) => {
        const value = firstNonEmpty([item && item.file, item && item.id], '');
        if (!value) return '';
        const note = [
          formatDateTime(item && (item.updatedAt || item.createdAt)),
          `${formatNumber(Math.round(Number(item && item.sizeBytes || 0) / 1024), '0')} KB`,
        ].join(' · ');
        return `<option value="${escapeHtml(value)}"${value === previewBackup ? ' selected' : ''}>${escapeHtml(value)}${note ? ` · ${escapeHtml(note)}` : ''}</option>`;
      })
      .filter(Boolean)
      .join('');
    const fieldStyle = 'width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(212,186,113,.18);background:rgba(9,12,10,.82);color:#f4efe4;font:400 14px/1.5 "IBM Plex Sans Thai","Segoe UI",sans-serif;';
    const recoverySection = [
      '<section id="recovery" class="odv4-panel odv4-focus-target" data-owner-focus-route="recovery" data-owner-runtime-recovery="true"><div class="odv4-section-head">',
      `<span class="odv4-section-kicker">${escapeHtml(routeView.recovery && routeView.recovery.kicker || 'Recovery workbench')}</span>`,
      `<h2 class="odv4-section-title">${escapeHtml(routeView.recovery && routeView.recovery.title || 'Shared backup and guarded restore')}</h2>`,
      `<p class="odv4-section-copy">${escapeHtml(routeView.recovery && routeView.recovery.copy || 'Create a backup, inspect a dry-run preview, and only then apply a guarded restore.')}</p></div>`,
      `<section class="odv4-kpi-strip" data-owner-runtime-fleet-watch="recovery">${renderSummaryStrip(safeModel.recoveryStrip)}</section>`,
      '<div class="odv4-runbook-grid" style="margin-top:16px;">',
      [
        '<article class="odv4-runbook-card">',
        '<span class="odv4-table-label">Create backup</span>',
        '<strong>Capture a shared platform backup</strong>',
        '<p>Create a new backup before touching guarded restore so rollback inventory stays fresh.</p>',
        '<form class="odv4-stack" data-owner-form="backup-create">',
        `<label class="odv4-stack"><span class="odv4-table-label">Operator note</span><textarea name="note" rows="3" style="${fieldStyle}" placeholder="Optional note for this backup run"></textarea></label>`,
        '<label class="odv4-feed-meta" style="display:flex;gap:8px;align-items:flex-start;"><input type="checkbox" name="includeSnapshot" value="true" checked>Include runtime snapshot metadata with this backup</label>',
        '<div class="odv4-chip-row"><button class="odv4-button odv4-button-primary" type="submit">Create backup</button></div>',
        '</form>',
        '</article>',
      ].join(''),
      [
        '<article class="odv4-runbook-card">',
        '<span class="odv4-table-label">Dry-run preview</span>',
        '<strong>Inspect warnings and verification before restore</strong>',
        '<p>Use the latest shared backup inventory entry to mint a preview token and review the verification plan.</p>',
        '<form class="odv4-stack" data-owner-form="backup-preview">',
        `<label class="odv4-stack"><span class="odv4-table-label">Backup file</span><select name="backup" style="${fieldStyle}"><option value="">Select a backup</option>${backupOptions}</select></label>`,
        '<div class="odv4-chip-row"><button class="odv4-button odv4-button-secondary" type="submit">Run preview</button></div>',
        '</form>',
        '</article>',
      ].join(''),
      [
        '<article class="odv4-runbook-card">',
        '<span class="odv4-table-label">Guarded restore</span>',
        '<strong>Apply the previewed backup only with a live token</strong>',
        previewToken
          ? `<p>Preview token is active for <strong>${escapeHtml(previewBackup || 'the selected backup')}</strong>. Type the backup name to confirm the restore.</p>`
          : '<p>Run a dry-run preview first. The live restore form only unlocks when a preview token exists.</p>',
        previewToken
          ? [
              '<form class="odv4-stack" data-owner-form="backup-restore">',
              `<input type="hidden" name="backup" value="${escapeHtml(previewBackup)}">`,
              `<input type="hidden" name="previewToken" value="${escapeHtml(previewToken)}">`,
              `<label class="odv4-stack"><span class="odv4-table-label">Confirm backup name</span><input name="confirmBackup" type="text" autocomplete="off" style="${fieldStyle}" placeholder="${escapeHtml(previewBackup || 'Type the backup file name')}"></label>`,
              '<div class="odv4-chip-row"><button class="odv4-button odv4-button-primary" type="submit">Run guarded restore</button></div>',
              '</form>',
            ].join('')
          : '<div class="odv4-feed-meta">No live preview token is active in this workspace.</div>',
        '</article>',
      ].join(''),
      '</div>',
      `<div class="odv4-section-head" style="margin-top:16px;"><span class="odv4-section-kicker">Preview</span><h3 class="odv4-section-title">Current restore preview</h3></div>${renderRecoveryPreviewCard(safeModel.restoreState, safeModel.restorePreview)}`,
      `<div class="odv4-section-head" style="margin-top:16px;"><span class="odv4-section-kicker">Inventory</span><h3 class="odv4-section-title">Shared backups</h3></div>${renderRecoveryBackupTable(safeModel.backupFiles)}`,
      `<div class="odv4-section-head" style="margin-top:16px;"><span class="odv4-section-kicker">History</span><h3 class="odv4-section-title">Restore history</h3></div>${renderRecoveryHistoryTable(safeModel.restoreHistory)}`,
      '</section>',
    ].join('');
    const blockMap = {
      recovery: recoverySection,
      services: servicesSection,
      jobs: jobsSection,
      incidents: `<div id="incidents" class="odv4-focus-target" data-owner-focus-route="incidents support security">${incidentsSection}</div>`,
      observability: `<div id="observability" class="odv4-focus-target" data-owner-focus-route="observability audit">${observabilitySection}</div>`,
    };
    const blockOrder = Array.isArray(routeView.blockOrder) && routeView.blockOrder.length
      ? routeView.blockOrder
      : ['services', 'jobs', 'incidents', 'observability'];
    const orderedSections = blockOrder.map((key) => blockMap[key]).filter(Boolean);
    const contentBlocks = orderedSections
      .reduce((rows, sectionHtml, index) => {
        if (index % 2 === 0) {
          rows.push([sectionHtml]);
          return rows;
        }
        rows[rows.length - 1].push(sectionHtml);
        return rows;
      }, [])
      .map((row) => `<div class="odv4-split-grid">${row.join('')}</div>`)
      .join('');
    return [
      '<div class="odv4-app"><header class="odv4-topbar"><div class="odv4-brand-row">',
      `<div class="odv4-brand-mark">${escapeHtml(safeModel.shell.brand || 'SCUM')}</div><div class="odv4-brand-copy"><span class="odv4-surface-label">${escapeHtml(safeModel.shell.surfaceLabel || '')}</span><strong class="odv4-workspace-label">${escapeHtml(safeModel.shell.workspaceLabel || '')}</strong></div>`,
      '</div><div class="odv4-topbar-actions"><span class="odv4-badge odv4-badge-muted">ระดับแพลตฟอร์ม</span><a class="odv4-button odv4-button-secondary" href="#incidents">เหตุการณ์</a><a class="odv4-button odv4-button-secondary" href="#observability">คำขอและความช้า</a></div></header>',
      '<div class="odv4-shell"><aside class="odv4-sidebar"><div class="odv4-stack"><span class="odv4-sidebar-title">เมนูเจ้าของระบบ</span><p class="odv4-sidebar-copy">ใช้หน้านี้แยกเรื่องที่เป็นปัญหารันไทม์ออกจากแรงกดดันฝั่งซัพพอร์ตและความผิดปกติของคำขอ ก่อนตัดสินใจไล่แก้ลึกลงไป</p></div>',
      renderNavGroups(safeModel.shell.navGroups),
      '</aside><main class="odv4-main"><section id="runtime-health" class="odv4-pagehead odv4-focus-target" data-owner-focus-route="runtime runtime-health"><div class="odv4-stack"><span class="odv4-section-kicker">',
      `${escapeHtml(routeView.pageKicker || 'โต๊ะปฏิบัติการและเหตุการณ์')}</span>`,
      `<h1 class="odv4-page-title">${escapeHtml(safeModel.header.title || '')}</h1><p class="odv4-page-subtitle">${escapeHtml(safeModel.header.subtitle || '')}</p><div class="odv4-chip-row">${renderChips(safeModel.header.statusChips)}</div></div>`,
      `<div class="odv4-pagehead-actions"><a class="odv4-button odv4-button-primary" href="${escapeHtml(safeModel.header.primaryAction.href || '#')}">${escapeHtml(safeModel.header.primaryAction.label || 'ส่งออก')}</a></div></section>`,
      `<section class="odv4-kpi-strip">${renderSummaryStrip(safeModel.summaryStrip)}</section>`,
      contentBlocks,
      `</main><aside class="odv4-rail"><div class="odv4-rail-sticky"><div class="odv4-rail-header">${escapeHtml(routeView.railHeader || 'บริบทการปฏิบัติการ')}</div><p class="odv4-rail-copy">${escapeHtml(routeView.railCopy || 'เก็บหลักฐานและงานติดตามของเจ้าของระบบไว้ใกล้มือเสมอขณะตรวจรันไทม์หรือเหตุการณ์')}</p>${renderRailCards(safeModel.railCards)}</div></aside></div></div>`,
    ].join('');
  }

  function renderOwnerRuntimeHealthV4(target, source, options) {
    if (!target) throw new Error('Owner runtime health V4 target is required');
    target.innerHTML = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model(source, options));
    return target;
  }

  return {
    createOwnerRuntimeHealthV4Model,
    buildOwnerRuntimeHealthV4Html,
    renderOwnerRuntimeHealthV4,
  };
});
