(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantServerBotsV4 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const FALLBACK_NAV_GROUPS = [
    {
      label: 'ภาพรวม',
      items: [
        { label: 'แดชบอร์ด', href: '#dashboard' },
        { label: 'เซิร์ฟเวอร์', href: '#server-status' },
        { label: 'รีสตาร์ต', href: '#restart-control' },
      ],
    },
    {
      label: 'บอต',
      items: [
        { label: 'บอตส่งของ', href: '#delivery-agents' },
        { label: 'บอตเซิร์ฟเวอร์', href: '#server-bots', current: true },
        { label: 'ตั้งค่าเซิร์ฟเวอร์', href: '#server-config' },
      ],
    },
  ];

  const SYNC_SIGNALS = ['sync', 'watcher', 'watch', 'log', 'config', 'restart', 'read', 'monitor'];

  function trimText(value, maxLen = 300) {
    const text = String(value ?? '').trim();
    return !text ? '' : text.slice(0, maxLen);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function firstNonEmpty(values, fallback = '') {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      const text = trimText(value, 240);
      if (text) return text;
    }
    return fallback;
  }

  function formatNumber(value, fallback = '0') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : fallback;
  }

  function formatDateTime(value, fallback = 'ยังไม่มีการซิงก์ล่าสุด') {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? fallback
      : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function statusTone(status) {
    const text = trimText(status, 80).toLowerCase();
    if (['online', 'ready', 'healthy', 'active'].includes(text)) return 'success';
    if (['pending_activation', 'pending-activation', 'draft', 'provisioned', 'degraded', 'stale'].includes(text)) return 'warning';
    if (['offline', 'revoked', 'outdated', 'error', 'failed', 'disabled'].includes(text)) return 'danger';
    return 'muted';
  }

  function normalizeCapabilities(value) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/[,\n]+/g)
        : [];
    return raw.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
  }

  function isServerBot(row) {
    const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
    const role = trimText(meta.agentRole || meta.role || row.role, 80).toLowerCase();
    const scope = trimText(meta.agentScope || meta.scope || row.scope, 80).toLowerCase();
    if (['sync', 'hybrid'].includes(role) || ['sync_only', 'sync-only', 'synconly', 'sync_execute', 'sync-execute'].includes(scope)) {
      return true;
    }
    const text = [
      row?.runtimeKey,
      row?.channel,
      row?.name,
      row?.displayName,
      row?.status,
      row?.role,
      row?.scope,
      meta.agentRole,
      meta.agentScope,
      ...normalizeCapabilities(meta.capabilities || meta.features),
    ]
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');
    return SYNC_SIGNALS.some((token) => text.includes(token));
  }

  function renderBadge(label, tone) {
    return `<span class="tdv4-badge tdv4-badge-${escapeHtml(tone || 'muted')}">${escapeHtml(label)}</span>`;
  }

  function renderNavGroup(group) {
    return `<section class="tdv4-nav-group"><div class="tdv4-nav-group-label">${escapeHtml(group.label)}</div><div class="tdv4-nav-items">${(Array.isArray(group.items) ? group.items : []).map((item) => `<a class="tdv4-nav-link${item.current ? ' tdv4-nav-link-current' : ''}" href="${escapeHtml(item.href || '#')}">${escapeHtml(item.label)}</a>`).join('')}</div></section>`;
  }

  function getAgentId(row) {
    return firstNonEmpty([row?.meta?.agentId, row?.agentId], '');
  }

  function getServerId(row) {
    return firstNonEmpty([row?.meta?.serverId, row?.serverId, row?.tenantServerId], '');
  }

  function getRuntimeKey(row) {
    return firstNonEmpty([row?.runtimeKey, row?.meta?.runtimeKey], '');
  }

  function matchesRuntimeEntry(entry, runtimeRow) {
    const runtimeAgentId = getAgentId(runtimeRow);
    const runtimeServerId = getServerId(runtimeRow);
    const runtimeKey = getRuntimeKey(runtimeRow);
    const entryAgentId = trimText(entry?.agentId, 120);
    const entryServerId = trimText(entry?.serverId, 120);
    const entryRuntimeKey = trimText(entry?.runtimeKey, 160);

    if (runtimeAgentId && entryAgentId && runtimeAgentId === entryAgentId) {
      return !runtimeServerId || !entryServerId || runtimeServerId === entryServerId;
    }
    if (runtimeKey && entryRuntimeKey && runtimeKey === entryRuntimeKey) {
      return !runtimeServerId || !entryServerId || runtimeServerId === entryServerId;
    }
    return false;
  }

  function findWorkspaceSettingValue(state, settingKey) {
    const targetKey = trimText(settingKey, 160).toLowerCase();
    if (!targetKey) return '';
    const workspace = state?.serverConfigWorkspace && typeof state.serverConfigWorkspace === 'object'
      ? state.serverConfigWorkspace
      : null;
    const categories = Array.isArray(workspace?.categories) ? workspace.categories : [];
    for (const category of categories) {
      const groups = Array.isArray(category?.groups) ? category.groups : [];
      for (const group of groups) {
        const settings = Array.isArray(group?.settings) ? group.settings : [];
        for (const setting of settings) {
          if (trimText(setting?.key, 160).toLowerCase() !== targetKey) continue;
          const value = trimText(setting?.currentValue ?? setting?.value, 1600);
          if (value) return value;
        }
      }
    }
    return '';
  }

  function buildProbeReadiness(state) {
    const restartConfigured = Boolean(
      findWorkspaceSettingValue(state, 'SCUM_SERVER_RESTART_TEMPLATE')
      || findWorkspaceSettingValue(state, 'SCUM_SERVER_APPLY_TEMPLATE'),
    );
    return {
      items: [
        { label: 'Sync probe ready', tone: 'success' },
        { label: 'Config access probe ready', tone: 'success' },
        {
          label: restartConfigured ? 'Restart probe ready' : 'Restart probe needs restart template',
          tone: restartConfigured ? 'success' : 'warning',
        },
      ],
      restartConfigured,
      detail: restartConfigured
        ? 'All Server Bot verification actions are ready to run from this page.'
        : 'Set a restart or apply command template in Server Config before running the restart readiness check.',
    };
  }

  function buildRuntimeHistory(state, runtimeRows, selectedServerId) {
    const sessions = Array.isArray(state?.agentSessions) ? state.agentSessions : [];
    return sessions
      .filter((entry) => {
        if (runtimeRows.some((runtimeRow) => matchesRuntimeEntry(entry, runtimeRow))) return true;
        if (selectedServerId && trimText(entry?.serverId, 160) !== selectedServerId) return false;
        return isServerBot(entry);
      })
      .slice(0, 6)
      .map((entry) => ({
        name: firstNonEmpty([entry?.displayName, entry?.runtimeKey, entry?.agentId, 'Server Bot']),
        machine: firstNonEmpty([entry?.hostname, entry?.metadata?.hostname, 'Unknown machine']),
        status: firstNonEmpty([entry?.status, 'active']),
        version: firstNonEmpty([entry?.version, '-']),
        heartbeatAt: formatDateTime(entry?.heartbeatAt),
        sessionId: firstNonEmpty([entry?.sessionId, entry?.id, '-']),
      }));
  }

  function renderRuntimeActions(kind, row) {
    const buttons = [];
    if (row.apiKeyId) {
      buttons.push(
        `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="rotate-token" data-runtime-api-key-id="${escapeHtml(row.apiKeyId)}" data-runtime-name="${escapeHtml(row.name)}">Rotate bot key</button>`,
      );
      buttons.push(
        `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="revoke-token" data-runtime-api-key-id="${escapeHtml(row.apiKeyId)}" data-runtime-name="${escapeHtml(row.name)}">Revoke bot access</button>`,
      );
    }
    if (row.deviceId) {
      buttons.push(
        `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="revoke-device" data-runtime-device-id="${escapeHtml(row.deviceId)}" data-runtime-name="${escapeHtml(row.name)}">Reset binding</button>`,
      );
    }
    if (!buttons.length) {
      return '<div class="tdv4-runtime-inline-note">Wait for the bot to connect and receive credentials before managing it here.</div>';
    }
    return `<div class="tdv4-runtime-inline-note">${escapeHtml(row.manageNote)}</div><div class="tdv4-runtime-action-row">${buttons.join('')}</div>`;
  }

  function renderProvisioningActions(kind, row) {
    return [
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="reissue-provision" data-runtime-token-id="${escapeHtml(row.tokenId)}" data-runtime-server-id-value="${escapeHtml(row.serverId)}" data-runtime-display-name-value="${escapeHtml(row.name)}" data-runtime-runtime-key-value="${escapeHtml(row.runtimeKey)}">Reissue setup token</button>`,
      `<button class="tdv4-button tdv4-button-secondary" type="button" data-runtime-action-kind="${escapeHtml(kind)}" data-runtime-action="revoke-provision" data-runtime-token-id="${escapeHtml(row.tokenId)}" data-runtime-name="${escapeHtml(row.name)}">Revoke setup token</button>`,
    ].join('');
  }

  function buildResultPanel(kind, result) {
    if (!result?.instructions) return '';
    const instructions = result.instructions;
    const tone = trimText(instructions.tone, 40) || 'success';
    const command = trimText(instructions.command, 4000);
    const steps = Array.isArray(instructions.steps) ? instructions.steps.filter(Boolean) : [];
    const facts = Array.isArray(instructions.facts)
      ? instructions.facts.filter((entry) => entry && (entry.label || entry.value))
      : [];
    const downloads = Array.isArray(instructions.downloads)
      ? instructions.downloads.filter((entry) => entry && (entry.key || entry.label))
      : [];
    return [
      `<article class="tdv4-panel tdv4-runtime-result tdv4-tone-${escapeHtml(tone)}">`,
      `<div class="tdv4-section-kicker">${escapeHtml(command ? 'Ready to install' : 'Latest update')}</div>`,
      `<h3 class="tdv4-section-title">${escapeHtml(instructions.title || 'Latest result')}</h3>`,
      `<p class="tdv4-section-copy">${escapeHtml(instructions.detail || '')}</p>`,
      steps.length
        ? `<ol class="tdv4-runtime-step-list">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
        : '',
      facts.length
        ? `<div class="tdv4-list-grid">${facts.map((fact) => `<article class="tdv4-panel tdv4-tone-info"><div class="tdv4-section-kicker">${escapeHtml(fact.label || 'Detail')}</div><p class="tdv4-section-copy">${escapeHtml(fact.value || '')}</p></article>`).join('')}</div>`
        : '',
      downloads.length
        ? `<div class="tdv4-action-list">${downloads.map((entry, index) => `<button class="tdv4-button ${index === 0 ? 'tdv4-button-primary' : 'tdv4-button-secondary'}" type="button" data-runtime-download-kind="${escapeHtml(kind)}" data-runtime-download-key="${escapeHtml(entry.key || '')}">${escapeHtml(entry.label || 'Download file')}</button>`).join('')}</div>`
        : '',
      command ? `<textarea class="tdv4-editor tdv4-runtime-command" readonly>${escapeHtml(command)}</textarea>` : '',
      '</article>',
    ].join('');
  }

  function buildEmptyState(kind, title, detail, actionLabel, actionHref) {
    return {
      kind: trimText(kind, 80) || 'general',
      title: firstNonEmpty([title], ''),
      detail: firstNonEmpty([detail], ''),
      actionLabel: firstNonEmpty([actionLabel], ''),
      actionHref: firstNonEmpty([actionHref], '#server-bots'),
    };
  }

  function createTenantServerBotsV4Model(source) {
    const state = source && typeof source === 'object' ? source : {};
    const runtimeRows = (Array.isArray(state.agents) ? state.agents : []).filter(isServerBot);
    const provisioning = Array.isArray(state.agentProvisioning) ? state.agentProvisioning.filter(isServerBot) : [];
    const devices = Array.isArray(state.agentDevices) ? state.agentDevices : [];
    const credentials = Array.isArray(state.agentCredentials) ? state.agentCredentials : [];
    const online = runtimeRows.filter((row) => statusTone(row.status) === 'success').length;
    const stale = runtimeRows.filter((row) => trimText(row?.status, 80).toLowerCase() === 'stale').length;
    const selectedServerId = String(state?.activeServer?.id || state?.servers?.[0]?.id || '').trim();
    const queueCount = Array.isArray(state.queueItems) ? state.queueItems.length : 0;
    const failedCount = Array.isArray(state.deadLetters) ? state.deadLetters.length : 0;
    const result = state?.__provisioningResult?.['server-bots'] || null;
    const hasServers = Array.isArray(state.servers) && state.servers.length > 0;
    const probeReadiness = buildProbeReadiness(state);
    const history = buildRuntimeHistory(state, runtimeRows, selectedServerId);

    const rows = runtimeRows.map((row) => {
      const device = devices.find((entry) => matchesRuntimeEntry(entry, row) && String(entry?.status || '').trim() !== 'revoked') || null;
      const credential = credentials.find((entry) => matchesRuntimeEntry(entry, row) && String(entry?.status || '').trim() !== 'revoked') || null;
      const capabilities = normalizeCapabilities(row?.meta?.capabilities || row?.meta?.features);
      return {
        name: firstNonEmpty([row?.meta?.agentLabel, row?.displayName, row?.name, row?.runtimeKey, 'Server Bot']),
        server: firstNonEmpty([row?.meta?.serverId, row?.serverId, row?.tenantServerId, 'Unassigned']),
        machine: firstNonEmpty([device?.hostname, row?.hostname, row?.meta?.hostname, row?.meta?.machineFingerprint, 'Unknown host']),
        status: firstNonEmpty([row?.status, 'unknown']),
        lastSeenAt: formatDateTime(row?.lastSeenAt),
        version: firstNonEmpty([row?.version, row?.meta?.version, '-']),
        capabilityLabel: [
          capabilities.some((entry) => entry.includes('sync')) ? 'sync ready' : 'sync pending',
          capabilities.some((entry) => entry.includes('config')) ? 'config ready' : 'config pending',
          capabilities.some((entry) => entry.includes('restart')) ? 'restart ready' : 'restart pending',
        ].join(' | '),
        manageNote: firstNonEmpty([row?.meta?.lastError, row?.reason], 'Ready to inspect logs, config, backup, and restart control.'),
        deviceId: trimText(device?.id, 160),
        apiKeyId: trimText(credential?.apiKeyId || credential?.id, 160),
      };
    });

    const tokens = provisioning.slice(0, 8).map((row) => ({
      tokenId: trimText(row?.id, 160),
      serverId: trimText(row?.serverId, 160),
      name: firstNonEmpty([row?.displayName, row?.name, row?.runtimeKey, 'Server Bot']),
      expiresAt: formatDateTime(row?.expiresAt, 'No expiry yet'),
      status: firstNonEmpty([row?.status, 'pending_activation']),
      runtimeKey: firstNonEmpty([row?.runtimeKey, row?.agentId, '-']),
    }));
    const discordLinks = (Array.isArray(state.serverDiscordLinks) ? state.serverDiscordLinks : [])
      .filter((row) => !selectedServerId || trimText(row?.serverId, 160) === selectedServerId)
      .map((row) => ({
        id: trimText(row?.id, 160),
        serverId: trimText(row?.serverId, 160),
        guildId: firstNonEmpty([row?.guildId, '-']),
        status: firstNonEmpty([row?.status, 'active']),
        updatedAt: formatDateTime(row?.updatedAt || row?.createdAt, 'No updates yet'),
      }));
    const selectedServerTokens = tokens.filter((row) => !selectedServerId || row.serverId === selectedServerId);
    const createEmptyState = hasServers
      ? null
      : buildEmptyState(
          'missing-server',
          'No server yet',
          'Create or assign a server first, then issue a setup token for the machine that can access SCUM.log and server config files.',
          'Open server',
          '#server-status',
        );
    const listEmptyState = rows.length
      ? null
      : selectedServerTokens.length
        ? buildEmptyState(
            'pending-install',
            'กำลังรอติดตั้งบอตเซิร์ฟเวอร์',
            'มี setup token แล้ว ให้นำไฟล์ติดตั้งไปรันบนเครื่องเซิร์ฟเวอร์ จากนั้นค่อยรีเฟรชหน้านี้',
            'ดู setup token',
            '#server-bots',
          )
        : hasServers
          ? buildEmptyState(
              'create-first',
              'ยังไม่มีบอตเซิร์ฟเวอร์',
              'ออก setup token แล้วติดตั้งบอตบนเครื่องที่ดูแล SCUM.log ไฟล์ตั้งค่า การสำรอง และการรีสตาร์ต',
              'สร้างบอตเซิร์ฟเวอร์',
              '#server-bots-provision',
            )
          : createEmptyState;

    return {
      shell: {
        brand: 'SCUM TH',
        surfaceLabel: 'Tenant admin',
        workspaceLabel: firstNonEmpty([
          state?.tenantLabel,
          state?.tenantConfig?.name,
          state?.overview?.tenantName,
          state?.me?.tenantId,
          'Tenant workspace',
        ]),
        navGroups: Array.isArray(state?.__surfaceShell?.navGroups) ? state.__surfaceShell.navGroups : FALLBACK_NAV_GROUPS,
      },
      header: {
        title: 'บอตเซิร์ฟเวอร์',
      subtitle: 'สร้างและดูแลบอตที่รับผิดชอบการซิงก์ log การแก้ไขไฟล์ตั้งค่า การสำรอง และการควบคุมรีสตาร์ต',
        chips: [
          { label: `${formatNumber(online)} online`, tone: online ? 'success' : 'muted' },
          { label: `${formatNumber(stale)} stale`, tone: stale ? 'warning' : 'muted' },
          { label: `${formatNumber(tokens.length)} setup tokens`, tone: tokens.length ? 'warning' : 'muted' },
        ],
      },
      summary: [
        {
          label: 'Ready to sync',
          value: formatNumber(online),
          detail: online ? 'บอตเซิร์ฟเวอร์กำลังส่ง heartbeat ตามปกติ' : 'ยังไม่พบบอตเซิร์ฟเวอร์ส่ง heartbeat',
          tone: online ? 'success' : 'warning',
        },
        {
          label: 'Queue pressure',
          value: formatNumber(queueCount),
          detail: queueCount ? 'Review queue health before editing live config.' : 'No queue pressure detected right now.',
          tone: queueCount ? 'warning' : 'success',
        },
        {
          label: 'Failed work',
          value: formatNumber(failedCount),
          detail: failedCount ? 'Resolve failed jobs before relying on restart/config automation.' : 'No failed jobs are currently visible.',
          tone: failedCount ? 'danger' : 'muted',
        },
      ],
      testActions: [
        {
          label: 'ทดสอบการซิงก์',
          actionKey: 'sync',
        detail: 'Queue a control-plane sync probe and confirm the bot can still report fresh activity.',
        },
        {
          label: 'ทดสอบการอ่านค่าตั้งค่า',
          actionKey: 'config-access',
          detail: 'สั่งให้บอตเซิร์ฟเวอร์ดึง snapshot ค่าตั้งค่าล่าสุด เพื่อยืนยันว่ายังเข้าถึงไฟล์ได้ปกติ',
        },
        {
          label: 'ทดสอบความพร้อมรีสตาร์ต',
          actionKey: 'restart',
          detail: 'Run a restart-readiness check before sending a live restart job.',
        },
      ],
      servers: Array.isArray(state.servers) ? state.servers : [],
      selectedServerId,
      rows,
      history,
      tokens,
      discordLinks,
      result,
      probeReadiness,
      createEmptyState,
      listEmptyState,
    };
  }

  function buildTenantServerBotsV4Html(model) {
    const safe = model && typeof model === 'object' ? model : createTenantServerBotsV4Model({});
    const pageheadActionHref = safe.servers.length ? '#server-bots-provision' : '#server-status';
    const pageheadActionLabel = safe.servers.length ? 'สร้างบอตเซิร์ฟเวอร์' : 'เปิดหน้าเซิร์ฟเวอร์';
    const serverOptions = safe.servers
      .map((server) => `<option value="${escapeHtml(server.id)}"${server.id === safe.selectedServerId ? ' selected' : ''}>${escapeHtml(firstNonEmpty([server.name, server.slug, server.id]))}</option>`)
      .join('');

    const createPanelBody = safe.createEmptyState
      ? [
          `<div class="tdv4-empty-state" data-runtime-empty-kind="${escapeHtml(safe.createEmptyState.kind)}">`,
          `<strong>${escapeHtml(safe.createEmptyState.title)}</strong>`,
          `<p>${escapeHtml(safe.createEmptyState.detail)}</p>`,
          `<div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" data-runtime-empty-action="server-bots" href="${escapeHtml(safe.createEmptyState.actionHref)}">${escapeHtml(safe.createEmptyState.actionLabel)}</a></div>`,
          '</div>',
        ].join('')
      : [
          '<div class="tdv4-runtime-form"><div class="tdv4-runtime-form-fields">',
          '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Server</div><div class="tdv4-basic-field-detail">Choose which server this bot should manage</div></div>',
          `<select class="tdv4-basic-input" data-runtime-server-id="server-bots">${serverOptions || '<option value="">No server yet</option>'}</select></label>`,
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">ชื่อที่แสดง</div><div class="tdv4-basic-field-detail">ชื่อที่จะแสดงในมุมสถานะบอตและการวินิจฉัย</div></div>',
          '<input class="tdv4-basic-input" type="text" data-runtime-display-name="server-bots" value="บอตเซิร์ฟเวอร์"></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">คีย์บอต</div><div class="tdv4-basic-field-detail">รหัสอ้างอิงประจำบอตที่ control plane ใช้ผูกงาน</div></div>',
          '<input class="tdv4-basic-input" type="text" data-runtime-runtime-key="server-bots" value="server-bot"></label>',
          '</div><div class="tdv4-action-list">',
          `<button class="tdv4-button tdv4-button-primary" type="button" data-runtime-provision-button="server-bots"${safe.servers.length ? '' : ' disabled'}>สร้างบอตเซิร์ฟเวอร์</button>`,
          '</div></div>',
        ].join('');

    const listEmptyState = safe.listEmptyState || buildEmptyState(
      'create-first',
      'ยังไม่มีบอตเซิร์ฟเวอร์',
      'ออก setup token แล้วติดตั้งบอตบนเครื่องเซิร์ฟเวอร์ก่อน',
      'สร้างบอตเซิร์ฟเวอร์',
      '#server-bots-provision',
    );

    return [
      '<div class="tdv4-app"><div class="tdv4-topbar"><div class="tdv4-brand-row">',
      `<div class="tdv4-brand-mark">${escapeHtml(safe.shell.brand)}</div>`,
      '<div class="tdv4-brand-copy">',
      `<div class="tdv4-surface-label">${escapeHtml(safe.shell.surfaceLabel)}</div>`,
      `<div class="tdv4-workspace-label">${escapeHtml(safe.shell.workspaceLabel)}</div>`,
      '</div></div></div>',
      '<div class="tdv4-shell tdv4-runtime-shell">',
      `<aside class="tdv4-sidebar">${(Array.isArray(safe.shell.navGroups) ? safe.shell.navGroups : []).map(renderNavGroup).join('')}</aside>`,
      '<main class="tdv4-main tdv4-stack">',
      '<section class="tdv4-pagehead"><div>',
      `<h1 class="tdv4-page-title">${escapeHtml(safe.header.title)}</h1>`,
      `<p class="tdv4-page-subtitle">${escapeHtml(safe.header.subtitle)}</p>`,
      `<div class="tdv4-chip-row">${safe.header.chips.map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div>`,
      '</div><div class="tdv4-pagehead-actions">',
      `<a class="tdv4-button tdv4-button-primary" href="${escapeHtml(pageheadActionHref)}">${escapeHtml(pageheadActionLabel)}</a>`,
      '</div></section>',
      `<section class="tdv4-kpi-strip tdv4-runtime-summary-strip">${safe.summary.map((item) => `<article class="tdv4-kpi tdv4-tone-${escapeHtml(item.tone)}"><div class="tdv4-kpi-label">${escapeHtml(item.label)}</div><div class="tdv4-kpi-value">${escapeHtml(item.value)}</div><div class="tdv4-kpi-detail">${escapeHtml(item.detail)}</div></article>`).join('')}</section>`,
      '<section class="tdv4-dual-grid tdv4-runtime-main-grid">',
      '<article class="tdv4-panel" id="server-bots-provision">',
      '<div class="tdv4-section-kicker">งานหลัก</div>',
      '<h2 class="tdv4-section-title">สร้างบอตเซิร์ฟเวอร์</h2>',
      '<p class="tdv4-section-copy">ออก one-time setup token แล้วนำไฟล์ติดตั้งไปรันบนเครื่องเซิร์ฟเวอร์ จากนั้นรอการ activate และ heartbeat</p>',
      createPanelBody,
      buildResultPanel('server-bots', safe.result),
      '</article>',
      '<article class="tdv4-panel">',
      '<div class="tdv4-section-kicker">สถานะ</div>',
      '<h2 class="tdv4-section-title">บอตเซิร์ฟเวอร์ที่ลงทะเบียนแล้ว</h2>',
      '<p class="tdv4-section-copy">ดูว่าบอตตัวไหนออนไลน์ ผูกกับเครื่องไหน ส่งเวอร์ชันอะไรกลับมา และความสามารถใดพร้อมใช้งานตอนนี้</p>',
      safe.rows.length
        ? `<div class="tdv4-data-table"><div class="tdv4-data-header"><span>ชื่อ</span><span>เซิร์ฟเวอร์</span><span>เครื่อง</span><span>สถานะ</span><span>อัปเดตล่าสุด</span><span>เวอร์ชัน</span><span>ความสามารถ</span><span>จัดการ</span></div>${safe.rows.map((row, index) => `<article class="tdv4-data-row${index === 0 ? ' tdv4-data-row-current' : ''}"><div class="tdv4-data-main"><strong>${escapeHtml(row.name)}</strong><span class="tdv4-kpi-detail">${escapeHtml(row.server)}</span></div><span>${escapeHtml(row.server)}</span><span>${escapeHtml(row.machine)}</span><span>${renderBadge(row.status, statusTone(row.status))}</span><span>${escapeHtml(row.lastSeenAt)}</span><span>${escapeHtml(row.version)}</span><span>${escapeHtml(row.capabilityLabel)}</span><div class="tdv4-runtime-manage-cell">${renderRuntimeActions('server-bots', row)}</div></article>`).join('')}</div>`
        : `<div class="tdv4-empty-state" data-runtime-empty-kind="${escapeHtml(listEmptyState.kind)}"><strong>${escapeHtml(listEmptyState.title)}</strong><p>${escapeHtml(listEmptyState.detail)}</p><div class="tdv4-pagehead-actions"><a class="tdv4-button tdv4-button-primary" data-runtime-empty-action="server-bots" href="${escapeHtml(listEmptyState.actionHref)}">${escapeHtml(listEmptyState.actionLabel)}</a></div></div>`,
      '</article></section>',
      '<section class="tdv4-panel" id="server-bots-tests">',
      '<div class="tdv4-section-kicker">งานรอง</div>',
      '<h2 class="tdv4-section-title">เครื่องมือทดสอบบอต</h2>',
      '<p class="tdv4-section-copy">รันการตรวจเฉพาะจุดก่อนแก้ config หรือส่งงานรีสตาร์ต เพื่อให้ทีมปฏิบัติการเห็นปัญหาได้เร็ว</p>',
      `<div class="tdv4-chip-row">${(Array.isArray(safe.probeReadiness?.items) ? safe.probeReadiness.items : []).map((chip) => renderBadge(chip.label, chip.tone)).join('')}</div>`,
      `<p class="tdv4-kpi-detail">${escapeHtml(safe.probeReadiness?.detail || '')}</p>`,
      '<div class="tdv4-list-grid">',
      ...(Array.isArray(safe.testActions)
        ? safe.testActions.map((item) => `<article class="tdv4-panel tdv4-tone-info"><div class="tdv4-section-kicker">Action</div><h3 class="tdv4-section-title">${escapeHtml(item.label)}</h3><p class="tdv4-section-copy">${escapeHtml(item.detail || '')}</p><div class="tdv4-action-list"><button class="tdv4-button tdv4-button-secondary" type="button" data-server-bot-probe-action="${escapeHtml(item.actionKey || '')}">${escapeHtml(item.label)}</button></div></article>`)
        : []),
      '</div>',
      '</section>',
      '<section class="tdv4-panel" id="server-bots-history">',
      '<div class="tdv4-section-kicker">รายละเอียด / ประวัติ</div>',
      '<h2 class="tdv4-section-title">กิจกรรมล่าสุดของบอต</h2>',
      '<p class="tdv4-section-copy">ประวัติ heartbeat ล่าสุดช่วยยืนยันว่าเครื่องไหน activate ก่อน เครื่องไหนยังถูก bind อยู่ และตอนนี้รายงานเวอร์ชันอะไรกลับมา</p>',
      safe.history.length
        ? `<div class="tdv4-list-grid">${safe.history.map((entry) => `<article class="tdv4-panel tdv4-tone-info"><div class="tdv4-section-kicker">${escapeHtml(entry.status)}</div><h3 class="tdv4-section-title">${escapeHtml(entry.name)}</h3><p class="tdv4-section-copy">${escapeHtml(entry.machine)} · ${escapeHtml(entry.heartbeatAt)}</p><p class="tdv4-kpi-detail">Session ${escapeHtml(entry.sessionId)} · v${escapeHtml(entry.version)}</p></article>`).join('')}</div>`
      : '<div class="tdv4-empty-state"><strong>ยังไม่มี heartbeat</strong><p>เมื่อบอตเชื่อมต่อและเริ่มส่ง session แล้ว ประวัติเครื่องและเวอร์ชันล่าสุดจะแสดงที่นี่</p></div>',
      '</section>',
      '<section class="tdv4-panel" id="server-bots-discord">',
      '<div class="tdv4-section-kicker">การจัดการ Discord</div>',
      '<h2 class="tdv4-section-title">การผูก Guild ของเซิร์ฟเวอร์นี้</h2>',
      '<p class="tdv4-section-copy">เก็บการผูก guild ที่ใช้งานอยู่ไว้ใกล้กับงานของบอตเซิร์ฟเวอร์ เพื่อให้ config, restart และ Discord automation สอดคล้องกัน</p>',
      '<div class="tdv4-runtime-form"><div class="tdv4-runtime-form-fields">',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Server</div><div class="tdv4-basic-field-detail">Choose the server that owns this guild binding</div></div>',
      `<select class="tdv4-basic-input" data-server-discord-link-server>${serverOptions || '<option value="">No server yet</option>'}</select></label>`,
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">Guild ID</div><div class="tdv4-basic-field-detail">Paste the Discord guild ID for this tenant community</div></div>',
      '<input class="tdv4-basic-input" type="text" data-server-discord-link-guild placeholder="123456789012345678"></label>',
      '<label class="tdv4-basic-field"><div class="tdv4-basic-field-copy"><div class="tdv4-basic-field-label">สถานะ</div><div class="tdv4-basic-field-detail">ใช้ draft เฉพาะตอนเตรียมย้ายการใช้งานแบบ staged cutover</div></div>',
      '<select class="tdv4-basic-input" data-server-discord-link-status><option value="active">active</option><option value="draft">draft</option><option value="disabled">disabled</option></select></label>',
      '</div><div class="tdv4-action-list">',
      `<button class="tdv4-button tdv4-button-primary" type="button" data-server-discord-link-create${safe.servers.length ? '' : ' disabled'}>บันทึกการผูก guild</button>`,
      '</div></div>',
      safe.discordLinks.length
        ? `<div class="tdv4-list-grid">${safe.discordLinks.map((row) => `<article class="tdv4-list-item" data-server-discord-link-item><div class="tdv4-list-main"><strong>${escapeHtml(row.guildId)}</strong><p>Server ${escapeHtml(row.serverId || '-')}</p><p>Updated ${escapeHtml(row.updatedAt)}</p></div><div class="tdv4-list-item-actions">${renderBadge(row.status, statusTone(row.status))}</div></article>`).join('')}</div>`
        : '<div class="tdv4-empty-state">ยังไม่มีการผูก Discord guild สำหรับเซิร์ฟเวอร์นี้</div>',
      '</section>',
      '</main>',
      '<aside class="tdv4-rail"><div class="tdv4-rail-sticky">',
      '<article class="tdv4-panel tdv4-rail-card tdv4-tone-info"><div class="tdv4-rail-title">ลำดับติดตั้ง</div><strong class="tdv4-rail-body">สร้าง ติดตั้ง เปิดใช้งาน และยืนยันผล</strong><div class="tdv4-rail-detail">สร้างบอตที่นี่ แล้วนำไฟล์ติดตั้งไปรันบนเครื่องเซิร์ฟเวอร์ จากนั้นรอให้สถานะออนไลน์และ heartbeat ปรากฏ</div></article>',
      '<article class="tdv4-panel tdv4-rail-card tdv4-tone-warning"><div class="tdv4-rail-title">กติกาการผูกเครื่อง</div><strong class="tdv4-rail-body">หนึ่ง setup token ต่อหนึ่งเครื่อง</strong><div class="tdv4-rail-detail">เครื่องแรกที่ activate สำเร็จจะกลายเป็นเครื่องที่ถูก bind หากต้องการย้ายเครื่อง ให้กด Reset binding ก่อน</div></article>',
      '<article class="tdv4-panel tdv4-rail-card tdv4-tone-warning"><div class="tdv4-rail-title">setup token ที่รอใช้งาน</div>',
      safe.tokens.length
      ? safe.tokens.map((row) => `<div class="tdv4-list-item"><div class="tdv4-list-main"><strong>${escapeHtml(row.name)}</strong><p>Bot key: ${escapeHtml(row.runtimeKey)}</p><p>Expires: ${escapeHtml(row.expiresAt)}</p></div><div class="tdv4-list-item-actions">${renderProvisioningActions('server-bots', row)}</div></div>`).join('')
      : '<div class="tdv4-empty-state"><strong>ยังไม่มี setup token ที่รอใช้งาน</strong><p>setup token ใหม่จะปรากฏที่นี่จนกว่าจะถูกใช้โดยบอตเซิร์ฟเวอร์จริง</p></div>',
      '</article></div></aside>',
      '</div></div>',
    ].join('');
  }

  function renderTenantServerBotsV4(rootElement, source) {
    if (!rootElement) throw new Error('renderTenantServerBotsV4 requires a root element');
    const model = source && source.header && Array.isArray(source.rows)
      ? source
      : createTenantServerBotsV4Model(source);
    rootElement.innerHTML = buildTenantServerBotsV4Html(model);
    return model;
  }

  return {
    buildTenantServerBotsV4Html,
    createTenantServerBotsV4Model,
    renderTenantServerBotsV4,
  };
});
