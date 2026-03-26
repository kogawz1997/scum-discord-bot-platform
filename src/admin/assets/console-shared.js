(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getI18n() {
    return window.AdminUiI18n || null;
  }

  function t(key, fallback, params) {
    return getI18n()?.t?.(key, fallback, params) ?? fallback ?? key;
  }

  async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const response = await fetch(path, {
      method,
      headers,
      body,
      credentials: 'same-origin',
    });
    if (response.status === 401) {
      window.location.href = '/admin/login';
      throw new Error('Unauthorized');
    }
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { ok: response.ok, error: text || response.statusText };
    }
    if (!response.ok || parsed.ok === false) {
      throw new Error(parsed.error || response.statusText || 'Request failed');
    }
    return parsed.data;
  }

  function formatNumber(value, fallback = '-') {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString(getI18n()?.getLocale?.() || 'en-US') : fallback;
  }

  function formatDateTime(value, fallback = '-') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    return parsed.toLocaleString(getI18n()?.getLocale?.() || 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function formatStatusTone(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'neutral';
    if (['active', 'ready', 'ok', 'healthy', 'delivered', 'success', 'connected', 'owner', 'enabled'].includes(text)) {
      return 'success';
    }
    if (['warn', 'warning', 'trialing', 'degraded', 'pending', 'delivering', 'stale', 'queued', 'review'].includes(text)) {
      return 'warning';
    }
    if (['error', 'failed', 'offline', 'inactive', 'suspended', 'delivery_failed', 'danger'].includes(text)) {
      return 'danger';
    }
    return 'info';
  }

  function makePill(label, tone) {
    const resolvedTone = tone || formatStatusTone(label);
    return `<span class="pill pill-${escapeHtml(resolvedTone)}">${escapeHtml(label || '-')}</span>`;
  }

  function normalizeAgentRoleToken(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    if (['sync', 'read', 'reader', 'watch', 'watcher', 'monitor'].includes(text)) return 'sync';
    if (['execute', 'write', 'writer', 'command', 'delivery', 'rcon'].includes(text)) return 'execute';
    if (['hybrid', 'sync-execute', 'sync_execute', 'both'].includes(text)) return 'hybrid';
    return '';
  }

  function normalizeAgentScopeToken(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    if (['sync_only', 'sync-only', 'read-only', 'readonly'].includes(text)) return 'sync_only';
    if (['execute_only', 'execute-only', 'write-only', 'writeonly'].includes(text)) return 'execute_only';
    if (['sync_execute', 'sync-execute', 'hybrid', 'both'].includes(text)) return 'sync_execute';
    return '';
  }

  function inferAgentRuntimeProfile(row = {}) {
    const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
    const explicitRole = normalizeAgentRoleToken(meta.agentRole || meta.role || meta.mode);
    const explicitScope = normalizeAgentScopeToken(meta.agentScope || meta.scope);
    let agentRole = explicitRole;
    if (!agentRole && explicitScope === 'sync_only') agentRole = 'sync';
    if (!agentRole && explicitScope === 'execute_only') agentRole = 'execute';
    if (!agentRole && explicitScope === 'sync_execute') agentRole = 'hybrid';
    if (!agentRole) {
      const signalText = [
        row.runtimeKey,
        row.channel,
        meta.kind,
        meta.type,
        ...(Array.isArray(meta.capabilities) ? meta.capabilities : []),
      ]
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
      const hasSync = ['sync', 'watch', 'watcher', 'read', 'monitor', 'log'].some((token) => signalText.includes(token));
      const hasExecute = ['execute', 'delivery', 'command', 'rcon', 'console-agent', 'reconcile'].some((token) => signalText.includes(token));
      if (hasSync && hasExecute) agentRole = 'hybrid';
      else if (hasSync) agentRole = 'sync';
      else if (hasExecute) agentRole = 'execute';
    }
    const agentScope = explicitScope
      || (agentRole === 'sync' ? 'sync_only' : '')
      || (agentRole === 'execute' ? 'execute_only' : '')
      || (agentRole === 'hybrid' ? 'sync_execute' : '');
    return { agentRole, agentScope };
  }

  function getAgentRuntimeRoleLabel(role) {
    if (role === 'sync') return t('common.agentRoleSync', 'Sync agent');
    if (role === 'execute') return t('common.agentRoleExecute', 'Execute agent');
    if (role === 'hybrid') return t('common.agentRoleHybrid', 'Hybrid agent');
    return '';
  }

  function getAgentRuntimeScopeLabel(scope) {
    if (scope === 'sync_only') return t('common.agentScopeSyncOnly', 'Read path only');
    if (scope === 'execute_only') return t('common.agentScopeExecuteOnly', 'Write path only');
    if (scope === 'sync_execute') return t('common.agentScopeHybrid', 'Read + write path');
    return '';
  }

  function renderAgentRuntimeMeta(row = {}) {
    const profile = inferAgentRuntimeProfile(row);
    const chips = [];
    const roleLabel = getAgentRuntimeRoleLabel(profile.agentRole);
    const scopeLabel = getAgentRuntimeScopeLabel(profile.agentScope);
    if (roleLabel) chips.push(makePill(roleLabel, profile.agentRole === 'hybrid' ? 'success' : 'info'));
    if (scopeLabel) chips.push(makePill(scopeLabel, 'neutral'));
    if (chips.length === 0) return '';
    return `<div class="tag-row">${chips.join('')}</div>`;
  }

  function joinNotificationParts(parts = []) {
    return parts.filter(Boolean).join(' • ');
  }

  function localizeAdminNotification(item = {}) {
    const data = item?.data && typeof item.data === 'object' ? item.data : {};
    const kind = String(item?.kind || item?.type || '').trim().toLowerCase();
    const runtime = String(data.runtimeLabel || data.runtimeKey || 'runtime').trim() || t('admin.notifications.runtimeFallback', 'runtime');
    const service = String(data.serviceKey || data.runtimeKey || data.runtimeLabel || '-').trim() || '-';
    const backup = String(data.backup || '-').trim() || '-';
    const reason = String(data.reason || '').trim();
    const error = String(data.error || data.stderr || '').trim();
    const note = String(data.note || '').trim();
    const targetUrl = String(data.targetUrl || '').trim();
    const eventType = String(data.eventType || '').trim();
    const tenantId = String(data.tenantId || '').trim();
    const version = String(data.version || '').trim();
    const minimumVersion = String(data.minimumVersion || '').trim();
    const lastSeenAt = String(data.lastSeenAt || '').trim();
    const rollbackBackup = String(data.rollbackBackup || data.rollbackStatus || '').trim();
    const sampleType = Array.isArray(data.sample) && data.sample.length > 0
      ? String(data.sample[0]?.type || '').trim()
      : '';
    const count = Number.isFinite(Number(data.count)) ? formatNumber(data.count, '0') : '';
    const threshold = Number.isFinite(Number(data.threshold)) ? formatNumber(data.threshold, '0') : '';
    const failures = Number.isFinite(Number(data.failures)) ? formatNumber(data.failures, '0') : '';
    const windowMs = Number.isFinite(Number(data.windowMs)) ? formatNumber(data.windowMs, '0') : '';
    const exitCode = Number.isFinite(Number(data.exitCode)) ? formatNumber(data.exitCode, '0') : '';
    const lastPurchaseCode = String(data.lastPurchaseCode || data.purchaseCode || '').trim();

    let title = String(item?.title || item?.type || t('admin.notifications.defaultTitle', 'Notification')).trim();
    let detail = String(item?.detail || item?.message || '').trim();

    if (kind === 'dead-letter-threshold') {
      title = t('admin.notifications.deadLetterThreshold.title', 'Dead-letter threshold reached');
      detail = joinNotificationParts([
        t('admin.notifications.deadLetterThreshold.detail', 'Dead letters reached the configured threshold.'),
        count ? t('admin.notifications.meta.count', 'count {value}', { value: count }) : '',
        threshold ? t('admin.notifications.meta.threshold', 'threshold {value}', { value: threshold }) : '',
      ]);
    } else if (kind === 'consecutive-failures') {
      title = t('admin.notifications.consecutiveFailures.title', 'Consecutive delivery failures');
      detail = joinNotificationParts([
        t('admin.notifications.consecutiveFailures.detail', 'Delivery failures crossed the configured threshold.'),
        failures ? t('admin.notifications.meta.failures', 'failures {value}', { value: failures }) : '',
        threshold ? t('admin.notifications.meta.threshold', 'threshold {value}', { value: threshold }) : '',
        lastPurchaseCode ? t('admin.notifications.meta.code', 'code {value}', { value: lastPurchaseCode }) : '',
      ]);
    } else if (kind === 'login-failure-spike') {
      title = t('admin.notifications.loginFailureSpike.title', 'Admin login failure spike');
      detail = joinNotificationParts([
        t('admin.notifications.loginFailureSpike.detail', 'Admin login failures spiked in the current window.'),
        failures ? t('admin.notifications.meta.failures', 'failures {value}', { value: failures }) : '',
        windowMs ? t('admin.notifications.meta.windowMs', 'window {value} ms', { value: windowMs }) : '',
      ]);
    } else if (kind === 'runtime-offline') {
      title = t('admin.notifications.runtimeOffline.title', 'Runtime offline');
      detail = joinNotificationParts([
        t('admin.notifications.runtimeOffline.detail', '{runtime} is offline.', { runtime }),
        reason ? t('admin.notifications.meta.reason', 'reason {value}', { value: reason }) : '',
      ]);
    } else if (kind === 'runtime-degraded') {
      title = t('admin.notifications.runtimeDegraded.title', 'Runtime degraded');
      detail = joinNotificationParts([
        t('admin.notifications.runtimeDegraded.detail', '{runtime} needs attention.', { runtime }),
        reason ? t('admin.notifications.meta.reason', 'reason {value}', { value: reason }) : '',
      ]);
    } else if (kind === 'platform-webhook-failed') {
      title = t('admin.notifications.platformWebhookFailed.title', 'Platform webhook failed');
      detail = joinNotificationParts([
        t('admin.notifications.platformWebhookFailed.detail', 'A platform webhook dispatch failed.'),
        eventType ? t('admin.notifications.meta.event', 'event {value}', { value: eventType }) : '',
        targetUrl ? t('admin.notifications.meta.target', 'target {value}', { value: targetUrl }) : '',
        error ? t('admin.notifications.meta.error', 'error {value}', { value: error }) : '',
      ]);
    } else if (kind === 'agent-version-outdated') {
      title = t('admin.notifications.agentVersionOutdated.title', 'Agent version outdated');
      detail = joinNotificationParts([
        t('admin.notifications.agentVersionOutdated.detail', 'An agent runtime is below the minimum version.'),
        tenantId ? t('admin.notifications.meta.tenant', 'tenant {value}', { value: tenantId }) : '',
        version ? t('admin.notifications.meta.version', 'version {value}', { value: version }) : '',
        minimumVersion ? t('admin.notifications.meta.minimum', 'min {value}', { value: minimumVersion }) : '',
      ]);
    } else if (kind === 'agent-runtime-stale') {
      title = t('admin.notifications.agentRuntimeStale.title', 'Agent runtime stale');
      detail = joinNotificationParts([
        t('admin.notifications.agentRuntimeStale.detail', 'An agent runtime stopped checking in recently.'),
        tenantId ? t('admin.notifications.meta.tenant', 'tenant {value}', { value: tenantId }) : '',
        lastSeenAt ? t('admin.notifications.meta.lastSeen', 'last seen {value}', { value: formatDateTime(lastSeenAt, lastSeenAt) }) : '',
      ]);
    } else if (kind === 'agent-circuit-open') {
      const consecutiveFailures = Number.isFinite(Number(data.consecutiveFailures))
        ? formatNumber(data.consecutiveFailures, '0')
        : '';
      const circuitOpenUntil = String(data.circuitOpenUntil || '').trim();
      const lastFailureCode = String(data.lastFailureCode || '').trim();
      const lastFailureMessage = String(data.lastFailureMessage || '').trim();
      title = t('admin.notifications.agentCircuitOpen.title', 'Agent circuit open');
      detail = joinNotificationParts([
        t('admin.notifications.agentCircuitOpen.detail', 'The delivery agent opened its circuit breaker after repeated failures.'),
        consecutiveFailures ? t('admin.notifications.meta.failures', 'failures {value}', { value: consecutiveFailures }) : '',
        threshold ? t('admin.notifications.meta.threshold', 'threshold {value}', { value: threshold }) : '',
        lastFailureCode ? t('admin.notifications.meta.lastCode', 'last code {value}', { value: lastFailureCode }) : '',
        lastFailureMessage ? t('admin.notifications.meta.lastMessage', 'last message {value}', { value: lastFailureMessage }) : '',
        circuitOpenUntil ? t('admin.notifications.meta.openUntil', 'open until {value}', { value: formatDateTime(circuitOpenUntil, circuitOpenUntil) }) : '',
      ]);
    } else if (kind === 'delivery-reconcile-anomaly') {
      title = t('admin.notifications.deliveryReconcileAnomaly.title', 'Delivery reconcile anomaly');
      detail = joinNotificationParts([
        t('admin.notifications.deliveryReconcileAnomaly.detail', 'Reconcile found delivery rows that need review.'),
        count ? t('admin.notifications.meta.count', 'count {value}', { value: count }) : '',
        sampleType ? t('admin.notifications.meta.sample', 'sample {value}', { value: sampleType }) : '',
      ]);
    } else if (kind === 'delivery-abuse-suspected') {
      title = t('admin.notifications.deliveryAbuseSuspected.title', 'Delivery abuse suspected');
      detail = joinNotificationParts([
        t('admin.notifications.deliveryAbuseSuspected.detail', 'Abuse heuristics flagged recent delivery activity.'),
        count ? t('admin.notifications.meta.count', 'count {value}', { value: count }) : '',
        sampleType ? t('admin.notifications.meta.sample', 'sample {value}', { value: sampleType }) : '',
      ]);
    } else if (kind === 'platform-auto-backup-created') {
      title = t('admin.notifications.platformAutoBackupCreated.title', 'Platform auto backup created');
      detail = joinNotificationParts([
        t('admin.notifications.platformAutoBackupCreated.detail', 'The automatic platform backup completed successfully.'),
        t('admin.notifications.meta.backup', 'backup {value}', { value: backup }),
        note ? t('admin.notifications.meta.note', 'note {value}', { value: note }) : '',
      ]);
    } else if (kind === 'platform-auto-backup-failed') {
      title = t('admin.notifications.platformAutoBackupFailed.title', 'Platform auto backup failed');
      detail = joinNotificationParts([
        t('admin.notifications.platformAutoBackupFailed.detail', 'The automatic platform backup failed.'),
        error ? t('admin.notifications.meta.error', 'error {value}', { value: error }) : '',
      ]);
    } else if (kind === 'platform-auto-restart-started') {
      title = t('admin.notifications.platformAutoRestartStarted.title', 'Platform auto recovery started');
      detail = joinNotificationParts([
        t('admin.notifications.platformAutoRestartStarted.detail', 'Automatic recovery started for {runtime}.', { runtime }),
        t('admin.notifications.meta.service', 'service {value}', { value: service }),
        reason ? t('admin.notifications.meta.reason', 'reason {value}', { value: reason }) : '',
      ]);
    } else if (kind === 'platform-auto-restart-succeeded') {
      title = t('admin.notifications.platformAutoRestartSucceeded.title', 'Platform auto recovery succeeded');
      detail = joinNotificationParts([
        t('admin.notifications.platformAutoRestartSucceeded.detail', '{runtime} recovered successfully.', { runtime }),
        t('admin.notifications.meta.service', 'service {value}', { value: service }),
        exitCode ? t('admin.notifications.meta.exit', 'exit {value}', { value: exitCode }) : '',
      ]);
    } else if (kind === 'platform-auto-restart-failed') {
      title = t('admin.notifications.platformAutoRestartFailed.title', 'Platform auto recovery failed');
      detail = joinNotificationParts([
        t('admin.notifications.platformAutoRestartFailed.detail', '{runtime} could not be recovered automatically.', { runtime }),
        t('admin.notifications.meta.service', 'service {value}', { value: service }),
        exitCode ? t('admin.notifications.meta.exit', 'exit {value}', { value: exitCode }) : '',
        error ? t('admin.notifications.meta.error', 'error {value}', { value: error }) : '',
      ]);
    } else if (kind === 'platform-auto-monitoring-followup-failed') {
      title = t('admin.notifications.platformAutoMonitoringFollowupFailed.title', 'Post-recovery monitoring failed');
      detail = joinNotificationParts([
        t('admin.notifications.platformAutoMonitoringFollowupFailed.detail', 'Follow-up monitoring failed after recovering {runtime}.', { runtime }),
        error ? t('admin.notifications.meta.error', 'error {value}', { value: error }) : '',
      ]);
    } else if (kind === 'restore') {
      title = t('admin.notifications.backupRestoreComplete.title', 'Backup restore complete');
      detail = joinNotificationParts([
        t('admin.notifications.backupRestoreComplete.detail', 'Backup restore completed.'),
        t('admin.notifications.meta.backup', 'backup {value}', { value: backup }),
      ]);
    } else if (kind === 'restore-started') {
      title = t('admin.notifications.backupRestoreStarted.title', 'Backup restore started');
      detail = joinNotificationParts([
        t('admin.notifications.backupRestoreStarted.detail', 'Backup restore started.'),
        t('admin.notifications.meta.backup', 'backup {value}', { value: backup }),
        rollbackBackup ? t('admin.notifications.meta.rollback', 'rollback {value}', { value: rollbackBackup }) : '',
      ]);
    } else if (kind === 'restore-failed') {
      title = t('admin.notifications.backupRestoreFailed.title', 'Backup restore failed');
      detail = joinNotificationParts([
        t('admin.notifications.backupRestoreFailed.detail', 'Backup restore failed.'),
        t('admin.notifications.meta.backup', 'backup {value}', { value: backup }),
        rollbackBackup ? t('admin.notifications.meta.rollback', 'rollback {value}', { value: rollbackBackup }) : '',
        error ? t('admin.notifications.meta.error', 'error {value}', { value: error }) : '',
      ]);
    } else if (kind === 'restore-rollback') {
      title = t('admin.notifications.backupRestoreRollback.title', 'Backup restore rolled back');
      detail = joinNotificationParts([
        t('admin.notifications.backupRestoreRollback.detail', 'Restore rollback completed.'),
        t('admin.notifications.meta.backup', 'backup {value}', { value: backup }),
        rollbackBackup ? t('admin.notifications.meta.rollback', 'rollback {value}', { value: rollbackBackup }) : '',
      ]);
    }

    return {
      title: title || t('admin.notifications.defaultTitle', 'Notification'),
      detail,
    };
  }

  function renderStats(container, cards) {
    if (!container) return;
    const rows = Array.isArray(cards) ? cards.filter(Boolean) : [];
    container.innerHTML = rows.length
      ? rows.map((card) => {
          const valueText = String(card.value ?? '-');
          const valueClass = valueText.length > 14 ? 'stat-value is-long' : 'stat-value';
          return [
            '<article class="stat-card">',
            `<span class="stat-kicker">${escapeHtml(card.kicker || '')}</span>`,
            `<strong class="${valueClass}">${escapeHtml(valueText)}</strong>`,
            `<h3 class="stat-title">${escapeHtml(card.title || '')}</h3>`,
            card.detail ? `<p class="stat-detail">${escapeHtml(card.detail)}</p>` : '',
            Array.isArray(card.tags) && card.tags.length
              ? `<div class="tag-row">${card.tags.map((tag) => makePill(tag)).join('')}</div>`
              : '',
            '</article>',
          ].join('');
        }).join('')
      : `<div class="empty-state">${escapeHtml(t('shared.emptySummary', 'No summary available.'))}</div>`;
  }

  function renderTable(container, options = {}) {
    if (!container) return;
    const columns = Array.isArray(options.columns) ? options.columns : [];
    const rows = Array.isArray(options.rows) ? options.rows : [];
    if (!columns.length || !rows.length) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(options.emptyText || t('shared.emptyData', 'No data found.'))}</div>`;
      return;
    }
    const shellClass = ['table-shell', options.shellClass || ''].filter(Boolean).join(' ');
    const tableClass = String(options.tableClass || '').trim();
    container.innerHTML = [
      `<div class="${escapeHtml(shellClass)}"><table${tableClass ? ` class="${escapeHtml(tableClass)}"` : ''}>`,
      '<thead><tr>',
      columns.map((column) => {
        const headerClass = String(column.headerClass || '').trim();
        return `<th${headerClass ? ` class="${escapeHtml(headerClass)}"` : ''}>${escapeHtml(column.label || '')}</th>`;
      }).join(''),
      '</tr></thead>',
      '<tbody>',
      rows.map((row) => [
        '<tr>',
        columns.map((column) => {
          const raw = typeof column.render === 'function' ? column.render(row) : row?.[column.key];
          const cellClass = String(column.cellClass || '').trim();
          return `<td${cellClass ? ` class="${escapeHtml(cellClass)}"` : ''}>${raw == null ? '' : raw}</td>`;
        }).join(''),
        '</tr>',
      ].join('')).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function renderList(container, items, renderer, emptyText) {
    if (!container) return;
    const rows = Array.isArray(items) ? items : [];
    container.innerHTML = rows.length
      ? rows.map((item) => renderer(item)).join('')
      : `<div class="empty-state">${escapeHtml(emptyText || t('shared.emptyEntries', 'No entries yet.'))}</div>`;
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(text || '');
    }
  }

  function setBusy(button, busy, pendingLabel) {
    if (!button) return;
    if (!button.dataset.idleLabel) {
      button.dataset.idleLabel = button.textContent || '';
    }
    button.disabled = Boolean(busy);
    button.textContent = busy ? String(pendingLabel || t('shared.working', 'Working...')) : button.dataset.idleLabel;
  }

  function ensureToastStack() {
    let stack = document.getElementById('consoleToastStack');
    if (stack) return stack;
    stack = document.createElement('div');
    stack.id = 'consoleToastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
    return stack;
  }

  function showToast(message, tone = 'info') {
    const stack = ensureToastStack();
    const toast = document.createElement('article');
    toast.className = `toast toast-${tone}`;
    toast.innerHTML = `<strong>${escapeHtml(String(message || 'Done'))}</strong>`;
    stack.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('toast-exit');
      window.setTimeout(() => {
        toast.remove();
      }, 240);
    }, 2800);
  }

  function wireCommandPalette(options = {}) {
    const {
      openButtonId,
      panelId,
      searchId,
      listId,
      emptyId,
      closeButtonId,
      getActions,
    } = options;
    const panel = document.getElementById(panelId);
    const searchInput = document.getElementById(searchId);
    const list = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    const openButton = openButtonId ? document.getElementById(openButtonId) : null;
    const closeButton = closeButtonId ? document.getElementById(closeButtonId) : null;
    if (!panel || !searchInput || !list || typeof getActions !== 'function') {
      return {
        open() {},
        close() {},
        refresh() {},
      };
    }

    let actions = [];
    let activeIndex = 0;

    function render() {
      const query = String(searchInput.value || '').trim().toLowerCase();
      const filtered = actions.filter((item) => {
        if (!query) return true;
        return `${item.label || ''} ${item.meta || ''}`.toLowerCase().includes(query);
      });
      activeIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));
      list.innerHTML = filtered.map((item, index) => [
        `<button type="button" class="palette-item${index === activeIndex ? ' active' : ''}" data-index="${index}">`,
        `<span class="palette-title">${escapeHtml(item.label || 'Action')}</span>`,
        item.meta ? `<span class="palette-meta">${escapeHtml(item.meta)}</span>` : '',
        '</button>',
      ].join('')).join('');
      empty.hidden = filtered.length > 0;
      Array.from(list.querySelectorAll('.palette-item')).forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.index || 0);
          filtered[index]?.run?.();
          close();
        });
      });
      return filtered;
    }

    function refresh() {
      actions = getActions().filter(Boolean);
      return render();
    }

    function open() {
      refresh();
      panel.hidden = false;
      panel.removeAttribute('hidden');
      panel.setAttribute('aria-hidden', 'false');
      document.body.classList.add('palette-open');
      window.setTimeout(() => {
        searchInput.focus();
        searchInput.select();
      }, 0);
    }

    function close() {
      panel.hidden = true;
      panel.setAttribute('hidden', 'hidden');
      panel.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('palette-open');
      searchInput.value = '';
    }

    searchInput.addEventListener('input', () => {
      activeIndex = 0;
      render();
    });

    searchInput.addEventListener('keydown', (event) => {
      const filtered = render();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0));
        render();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        filtered[activeIndex]?.run?.();
        close();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });

    panel.addEventListener('click', (event) => {
      if (event.target === panel) {
        close();
      }
    });

    if (openButton) openButton.addEventListener('click', open);
    if (closeButton) {
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      });
      closeButton.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      });
    }

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (panel.hidden) {
          open();
        } else {
          close();
        }
        return;
      }
      if (!typing && event.key === '/') {
        event.preventDefault();
        open();
        return;
      }
      if (event.key === 'Escape' && !panel.hidden) {
        event.preventDefault();
        close();
      }
    });

    refresh();
    return { open, close, refresh };
  }

  // Each console is now page-mode rather than one long dashboard.
  // This controller owns which owner/tenant page is visible and keeps the
  // sidebar, summary block, and current-page state in sync.
  function wireWorkspaceSwitcher(options = {}) {
    const {
      switchId,
      summaryId,
      hintId,
      navListId,
      defaultWorkspace,
      workspaces = [],
      sectionsByWorkspace = {},
      sectionAliases = {},
    } = options;
    const switchRoot = switchId ? document.getElementById(switchId) : null;
    const summaryRoot = summaryId ? document.getElementById(summaryId) : null;
    const hintRoot = hintId ? document.getElementById(hintId) : null;
    const navList = navListId ? document.getElementById(navListId) : null;
    const sectionWorkspace = new Map();
    Object.entries(sectionsByWorkspace).forEach(([workspaceKey, sectionIds]) => {
      (Array.isArray(sectionIds) ? sectionIds : []).forEach((sectionId) => {
        sectionWorkspace.set(sectionId, workspaceKey);
      });
    });
    const workspaceList = Array.isArray(workspaces) ? workspaces.filter((item) => item?.key) : [];
    const aliasLookup = Object.entries(sectionAliases || {}).reduce((lookup, [aliasId, sectionId]) => {
      const normalizedAliasId = String(aliasId || '').trim();
      const normalizedSectionId = String(sectionId || '').trim();
      if (normalizedAliasId && normalizedSectionId) {
        lookup.set(normalizedAliasId, normalizedSectionId);
      }
      return lookup;
    }, new Map());
    let currentWorkspace = workspaceList.some((item) => item.key === defaultWorkspace)
      ? defaultWorkspace
      : (workspaceList[0]?.key || '');
    let currentSectionId = ((sectionsByWorkspace[currentWorkspace] || []).find((sectionId) => document.getElementById(sectionId)) || '');

    function resolveSectionId(sectionId) {
      const normalizedSectionId = String(sectionId || '').trim();
      return aliasLookup.get(normalizedSectionId) || normalizedSectionId;
    }

    function getResolvedCurrentSectionId() {
      return resolveSectionId(currentSectionId);
    }

    function getSectionLabel(sectionId) {
      if (!navList || !sectionId) return sectionId;
      const resolvedSectionId = resolveSectionId(sectionId);
      const link = navList.querySelector(`a[href="#${sectionId}"]`) || navList.querySelector(`a[href="#${resolvedSectionId}"]`);
      return String(link?.textContent || '').trim() || sectionId;
    }

    function renderSummary() {
      const active = workspaceList.find((item) => item.key === currentWorkspace);
      if (hintRoot) {
        hintRoot.textContent = String(
          active?.sidebarHint
          || active?.description
          || active?.summary
          || ''
        );
      }
      if (!summaryRoot || !active) return;
      const sectionCount = (sectionsByWorkspace[active.key] || []).length;
      const tags = [
        currentSectionId ? `<span class="pill pill-success">${escapeHtml(getSectionLabel(currentSectionId))}</span>` : '',
        sectionCount ? `<span class="pill pill-neutral">${escapeHtml(t('shared.pageCount', '{count} pages', { count: sectionCount }))}</span>` : '',
      ].filter(Boolean).join('');
      summaryRoot.innerHTML = [
        `<div class="workspace-summary-copy">`,
        `<span class="section-kicker">${escapeHtml(active.label || active.title || 'Workspace')}</span>`,
        `<strong>${escapeHtml(active.title || active.label || active.key)}</strong>`,
        `</div>`,
        tags ? `<div class="tag-row">${tags}</div>` : '',
      ].join('');
    }

    function emitSurfaceChange() {
      window.dispatchEvent(new CustomEvent('surface-section-change', {
        detail: {
          workspace: currentWorkspace || '',
          section: getResolvedCurrentSectionId() || '',
          rawSection: currentSectionId || '',
          label: getSectionLabel(currentSectionId) || '',
        },
      }));
    }

    function renderSwitch() {
      if (!switchRoot) return;
      switchRoot.innerHTML = workspaceList.map((workspace) => [
        `<button type="button" class="workspace-tab${workspace.key === currentWorkspace ? ' active' : ''}" data-workspace="${escapeHtml(workspace.key)}" aria-pressed="${workspace.key === currentWorkspace ? 'true' : 'false'}">`,
        `<span class="workspace-tab-label">${escapeHtml(workspace.label || workspace.title || workspace.key)}</span>`,
        '</button>',
      ].join('')).join('');
      Array.from(switchRoot.querySelectorAll('[data-workspace]')).forEach((button) => {
        button.addEventListener('click', () => {
          setWorkspace(button.dataset.workspace, { focus: true });
        });
      });
    }

    function applyWorkspace() {
      const resolvedCurrentSectionId = getResolvedCurrentSectionId();
      const activePrimarySections = (() => {
        const primaryLink = Array.from(document.querySelectorAll('[data-primary-section],[data-primary-sections]')).find((link) => {
          const sections = String(
            link.getAttribute('data-primary-sections')
            || link.getAttribute('data-primary-section')
            || ''
          )
            .split(',')
            .map((value) => String(value || '').trim())
            .filter(Boolean);
          return sections.includes(currentSectionId) || sections.includes(resolvedCurrentSectionId);
        });
        if (!primaryLink) return null;
        return new Set(
          String(
            primaryLink.getAttribute('data-primary-sections')
            || primaryLink.getAttribute('data-primary-section')
            || ''
          )
            .split(',')
            .map((value) => resolveSectionId(String(value || '').trim()))
            .filter(Boolean)
        );
      })();
      document.body.dataset.currentWorkspace = currentWorkspace || '';
      document.body.dataset.currentSection = currentSectionId || '';
      sectionWorkspace.forEach((workspaceKey, sectionId) => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const isActive = !(Boolean(currentWorkspace) && (workspaceKey !== currentWorkspace || sectionId !== resolvedCurrentSectionId));
        section.hidden = !isActive;
        section.classList.toggle('surface-section-active', isActive);
      });
      if (navList) {
        Array.from(navList.querySelectorAll('a[href^="#"]')).forEach((link) => {
          const sectionId = String(link.getAttribute('href') || '').replace(/^#/, '');
          const resolvedNavSectionId = resolveSectionId(sectionId);
          const workspaceKey = sectionWorkspace.get(resolvedNavSectionId);
          link.dataset.workspace = workspaceKey || '';
          const shouldHideForWorkspace = Boolean(workspaceKey) && workspaceKey !== currentWorkspace;
          const shouldHideForPrimary = Boolean(activePrimarySections && !activePrimarySections.has(resolvedNavSectionId));
          link.hidden = shouldHideForWorkspace || shouldHideForPrimary;
          const isActive = sectionId === currentSectionId || resolvedNavSectionId === resolvedCurrentSectionId;
          link.classList.toggle('nav-link-active', isActive);
          if (isActive) {
            link.setAttribute('aria-current', 'page');
          } else {
            link.removeAttribute('aria-current');
          }
        });
        Array.from(navList.querySelectorAll('[data-nav-group]')).forEach((group) => {
          const visibleLinks = Array.from(group.querySelectorAll('a[href^="#"]')).filter((link) => !link.hidden);
          group.hidden = visibleLinks.length === 0;
          group.classList.toggle('nav-group-active', visibleLinks.some((link) => link.classList.contains('nav-link-active')));
        });
      }
      Array.from(document.querySelectorAll('[data-primary-section],[data-primary-sections]')).forEach((link) => {
        const sections = String(
          link.getAttribute('data-primary-sections')
          || link.getAttribute('data-primary-section')
          || ''
        )
          .split(',')
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        const isActive = sections.includes(currentSectionId) || sections.includes(resolvedCurrentSectionId);
        link.classList.toggle('surface-primary-link-active', isActive);
        if (isActive) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });
      renderSummary();
      renderSwitch();
      emitSurfaceChange();
    }

    function setWorkspace(workspaceKey, options = {}) {
      if (!workspaceList.some((item) => item.key === workspaceKey)) {
        return;
      }
      currentWorkspace = workspaceKey;
      if (!currentSectionId || sectionWorkspace.get(getResolvedCurrentSectionId()) !== workspaceKey) {
        currentSectionId = (sectionsByWorkspace[currentWorkspace] || []).find((sectionId) => document.getElementById(sectionId)) || '';
      }
      applyWorkspace();
      if (options.focus !== false) {
        const firstSectionId = (sectionsByWorkspace[currentWorkspace] || []).find((sectionId) => document.getElementById(sectionId));
        if (firstSectionId) {
          openSection(firstSectionId, { block: 'start' });
        }
      }
    }

    function openSection(sectionId, options = {}) {
      const resolvedSectionId = resolveSectionId(sectionId);
      const workspaceKey = sectionWorkspace.get(resolvedSectionId);
      currentSectionId = sectionId;
      if (workspaceKey && workspaceKey !== currentWorkspace) {
        currentWorkspace = workspaceKey;
        applyWorkspace();
      } else {
        applyWorkspace();
      }
      const targetId = options.targetId || resolvedSectionId;
      const block = options.block || 'start';
      if (!options.skipHash) {
        window.history.replaceState(null, '', `#${sectionId}`);
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById(targetId)?.scrollIntoView({
            behavior: 'smooth',
            block,
          });
        });
      });
    }

    if (navList) {
      navList.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const sectionId = String(link.getAttribute('href') || '').replace(/^#/, '');
        if (!sectionId) return;
        event.preventDefault();
        openSection(sectionId, { block: 'start' });
      });
    }

    renderSwitch();
    applyWorkspace();
    const initialHash = String(window.location.hash || '').replace(/^#/, '');
    if (initialHash && (sectionWorkspace.has(initialHash) || aliasLookup.has(initialHash))) {
      openSection(initialHash, { block: 'start' });
    }
    window.addEventListener('hashchange', () => {
      const nextHash = String(window.location.hash || '').replace(/^#/, '');
      if (!nextHash || (!(sectionWorkspace.has(nextHash) || aliasLookup.has(nextHash))) || nextHash === currentSectionId) {
        return;
      }
      openSection(nextHash, { block: 'start', skipHash: true });
    });

    return {
      getWorkspace() {
        return currentWorkspace;
      },
      getSection() {
        return currentSectionId;
      },
      setWorkspace,
      openSection,
      refresh: applyWorkspace,
    };
  }

  // Shared sidebar shell for owner/tenant consoles.
  // Use this if you want to change how the left menu collapses on desktop or
  // behaves like a drawer on smaller screens.
  function wireSidebarShell(options = {}) {
    const {
      body = document.body,
      sidebarId,
      navListId,
      toggleButtonId,
      backdropId,
      mobileBreakpoint = 1180,
    } = options;
    const sidebar = sidebarId ? document.getElementById(sidebarId) : null;
    const navList = navListId ? document.getElementById(navListId) : null;
    const toggleButton = toggleButtonId ? document.getElementById(toggleButtonId) : null;
    const backdrop = backdropId ? document.getElementById(backdropId) : null;
    if (!body || !sidebar || !toggleButton) {
      return {
        open() {},
        close() {},
        refresh() {},
      };
    }

    function isMobileLayout() {
      return window.innerWidth <= mobileBreakpoint;
    }

    function syncBackdrop() {
      if (!backdrop) return;
      backdrop.hidden = !(isMobileLayout() && body.classList.contains('sidebar-open'));
    }

    function syncToggleState() {
      const expanded = isMobileLayout()
        ? body.classList.contains('sidebar-open')
        : !body.classList.contains('sidebar-collapsed');
      toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function open() {
      if (isMobileLayout()) {
        body.classList.add('sidebar-open');
      } else {
        body.classList.remove('sidebar-collapsed');
      }
      syncBackdrop();
      syncToggleState();
    }

    function close() {
      if (isMobileLayout()) {
        body.classList.remove('sidebar-open');
      } else {
        body.classList.add('sidebar-collapsed');
      }
      syncBackdrop();
      syncToggleState();
    }

    function toggle() {
      if (isMobileLayout()) {
        if (body.classList.contains('sidebar-open')) {
          close();
        } else {
          open();
        }
        return;
      }
      body.classList.toggle('sidebar-collapsed');
      syncBackdrop();
      syncToggleState();
    }

    function refresh() {
      if (!isMobileLayout()) {
        body.classList.remove('sidebar-open');
      }
      syncBackdrop();
      syncToggleState();
    }

    toggleButton.addEventListener('click', toggle);
    backdrop?.addEventListener('click', close);
    navList?.addEventListener('click', () => {
      if (isMobileLayout()) {
        close();
      }
    });
    window.addEventListener('resize', refresh);
    refresh();

    return { open, close, refresh };
  }

  function connectLiveStream(options = {}) {
    const {
      url = '/admin/api/live',
      events = [],
      onEvent,
      onOpen,
      onError,
    } = options;
    if (typeof window.EventSource !== 'function') {
      return { close() {} };
    }
    const source = new EventSource(url);
    source.addEventListener('open', () => {
      if (typeof onOpen === 'function') onOpen();
    });
    events.forEach((name) => {
      source.addEventListener(name, (event) => {
        let payload = null;
        try {
          payload = event?.data ? JSON.parse(event.data) : null;
        } catch {
          payload = { raw: event.data };
        }
        if (typeof onEvent === 'function') {
          onEvent(name, payload);
        }
      });
    });
    source.onerror = () => {
      if (typeof onError === 'function') onError();
    };
    return {
      close() {
        source.close();
      },
    };
  }

  // Shared UI helpers consumed by owner-console.js and tenant-console.js.
  window.ConsoleSurface = {
    api,
    connectLiveStream,
    escapeHtml,
    formatDateTime,
    formatNumber,
    formatStatusTone,
    localizeAdminNotification,
    makePill,
    renderAgentRuntimeMeta,
    renderList,
    renderStats,
    renderTable,
    setBusy,
    setText,
    showToast,
    wireCommandPalette,
    wireSidebarShell,
    wireWorkspaceSwitcher,
  };
})();
