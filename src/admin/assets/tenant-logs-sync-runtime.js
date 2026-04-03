(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.TenantLogsSyncRuntime = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function firstNonEmpty(values, fallback) {
    const rows = Array.isArray(values) ? values : [values];
    for (const value of rows) {
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return fallback || '';
  }

  function createTenantLogsSyncPageRuntime(deps = {}) {
    const apiRequest = typeof deps.apiRequest === 'function' ? deps.apiRequest : null;
    const buildRuntimeActionNotice = typeof deps.buildRuntimeActionNotice === 'function'
      ? deps.buildRuntimeActionNotice
      : null;
    const currentState = typeof deps.currentState === 'function' ? deps.currentState : (() => null);
    const disableActionNodes = typeof deps.disableActionNodes === 'function'
      ? deps.disableActionNodes
      : (() => {});
    const getRenderServerId = typeof deps.getRenderServerId === 'function'
      ? deps.getRenderServerId
      : (() => '');
    const getRenderTenantId = typeof deps.getRenderTenantId === 'function'
      ? deps.getRenderTenantId
      : (() => '');
    const getServerBotCommandReadiness = typeof deps.getServerBotCommandReadiness === 'function'
      ? deps.getServerBotCommandReadiness
      : (() => ({ restartConfigured: false }));
    const getServerBotProbeLockReason = typeof deps.getServerBotProbeLockReason === 'function'
      ? deps.getServerBotProbeLockReason
      : (() => 'Server Bot checks are not available in the current package.');
    const getTenantActionEntitlement = typeof deps.getTenantActionEntitlement === 'function'
      ? deps.getTenantActionEntitlement
      : (() => null);
    const getTenantPermissionLockReason = typeof deps.getTenantPermissionLockReason === 'function'
      ? deps.getTenantPermissionLockReason
      : ((_renderState, _permissionKey, fallback) => fallback || 'This action is not available.');
    const hasActiveServerBot = typeof deps.hasActiveServerBot === 'function'
      ? deps.hasActiveServerBot
      : (() => false);
    const hasTenantPermission = typeof deps.hasTenantPermission === 'function'
      ? deps.hasTenantPermission
      : (() => false);
    const isSurfacePreview = typeof deps.isSurfacePreview === 'function'
      ? deps.isSurfacePreview
      : (() => false);
    const refreshState = typeof deps.refreshState === 'function'
      ? deps.refreshState
      : (async () => {});
    const renderCurrentPage = typeof deps.renderCurrentPage === 'function'
      ? deps.renderCurrentPage
      : (() => {});
    const setActionButtonBusy = typeof deps.setActionButtonBusy === 'function'
      ? deps.setActionButtonBusy
      : (() => {});
    const setStatus = typeof deps.setStatus === 'function'
      ? deps.setStatus
      : (() => {});
    const confirmAction = typeof deps.confirmAction === 'function'
      ? deps.confirmAction
      : ((message) => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          return window.confirm(message);
        }
        return true;
      });

    async function queueServerBotProbe(renderState, triggerButton) {
      if (!apiRequest) {
        throw new Error('Server Bot probes are not available in this surface.');
      }
      const tenantId = getRenderTenantId(renderState);
      const serverId = getRenderServerId(renderState);
      if (!tenantId || !serverId) {
        throw new Error('Server Bot checks need an active tenant and server scope.');
      }
      const action = String(triggerButton?.getAttribute('data-server-bot-probe-action') || '')
        .trim()
        .toLowerCase();
      if (!['sync', 'config-access', 'restart'].includes(action)) {
        throw new Error('Unknown Server Bot probe action.');
      }
      setActionButtonBusy(triggerButton, true, 'Queueing...');
      try {
        const result = await apiRequest(
          `/admin/api/platform/servers/${encodeURIComponent(serverId)}/probes/${encodeURIComponent(action)}`,
          {
            method: 'POST',
            body: {
              tenantId,
            },
          },
          null,
        );
        const state = currentState();
        if (state?.provisioningResult && buildRuntimeActionNotice) {
          state.provisioningResult['server-bots'] = {
            instructions: buildRuntimeActionNotice(
              action === 'sync'
                ? 'Queued sync test'
                : action === 'config-access'
                  ? 'Queued config access test'
                  : 'Queued restart readiness test',
              'Server Bot will pick up this job from the control plane. Refresh this page and Logs & Sync to inspect the latest result.',
              'info',
            ),
            raw: result,
          };
        }
        renderCurrentPage();
        await refreshState({ silent: true });
        setStatus(
          action === 'sync'
            ? 'Queued a sync probe for the Server Bot.'
            : action === 'config-access'
              ? 'Queued a config access probe for the Server Bot.'
              : 'Queued a restart readiness probe for the Server Bot.',
          'success',
        );
        return result;
      } finally {
        setActionButtonBusy(triggerButton, false);
      }
    }

    function wireServerBotProbeActions(renderState, surfaceState) {
      const buttons = Array.from(document.querySelectorAll('[data-server-bot-probe-action]'));
      if (!buttons.length) return;
      const previewMode = isSurfacePreview(surfaceState, renderState);
      const hasBot = hasActiveServerBot(renderState);
      buttons.forEach((button) => {
        const action = String(button.getAttribute('data-server-bot-probe-action') || '').trim().toLowerCase();
        const commandReadiness = getServerBotCommandReadiness(renderState);
        const entitlementLocked = action
          ? Boolean(
            (action === 'sync'
              ? getTenantActionEntitlement(renderState, 'can_view_sync_status')
              : action === 'config-access'
                ? getTenantActionEntitlement(renderState, 'can_edit_config')
                : getTenantActionEntitlement(renderState, 'can_restart_server'))?.locked,
          )
          : false;
        const restartTemplateMissing = action === 'restart' && !commandReadiness.restartConfigured;
        if (previewMode || entitlementLocked || !hasBot || restartTemplateMissing) {
          button.disabled = true;
          button.title = previewMode
            ? 'Preview mode cannot send Server Bot test jobs.'
            : entitlementLocked
              ? getServerBotProbeLockReason(renderState, action)
              : !hasBot
                ? 'Create or reconnect a Server Bot before running this test.'
                : 'Set SCUM_SERVER_RESTART_TEMPLATE or SCUM_SERVER_APPLY_TEMPLATE in Server Config before running this test.';
          return;
        }
        button.addEventListener('click', async () => {
          try {
            const confirmMessage = action === 'sync'
              ? 'Queue a sync probe for the Server Bot now?'
              : action === 'config-access'
                ? 'Queue a config access probe for the Server Bot now?'
                : 'Queue a restart readiness probe for the Server Bot now?';
            if (!confirmAction(confirmMessage)) return;
            await queueServerBotProbe(renderState, button);
          } catch (error) {
            setStatus(String(error?.message || error), 'danger');
          }
        });
      });
    }

    function wireLogsSyncPage(renderState, surfaceState) {
      const refreshButton = document.querySelector('[data-tenant-logs-sync-refresh]');
      const previewMode = isSurfacePreview(surfaceState, renderState);
      const lockReason = firstNonEmpty([
        renderState?.featureEntitlements?.sections?.logs_sync?.reason,
        'Logs & Sync is locked in the current package.',
      ], 'Logs & Sync is locked in the current package.');
      if (previewMode || renderState?.featureEntitlements?.sections?.logs_sync?.locked) {
        disableActionNodes([refreshButton], previewMode ? 'Preview mode cannot load live sync signals.' : lockReason);
        return;
      }
      refreshButton?.addEventListener('click', async () => {
        setActionButtonBusy(refreshButton, true, 'Refreshing...');
        try {
          await refreshState({ silent: false });
        } finally {
          setActionButtonBusy(refreshButton, false);
        }
      });
      wireServerBotProbeActions(renderState, surfaceState);
      const lockNodeGroups = [
        {
          nodes: Array.from(document.querySelectorAll('[data-server-bot-probe-action="sync"]')),
          locked: Boolean(getTenantActionEntitlement(renderState, 'can_view_sync_status')?.locked)
            || !hasTenantPermission(renderState, 'manage_runtimes'),
          reason: !hasTenantPermission(renderState, 'manage_runtimes')
            ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Sync tests are locked in the current package.')
            : getServerBotProbeLockReason(renderState, 'sync'),
        },
        {
          nodes: Array.from(document.querySelectorAll('[data-server-bot-probe-action="config-access"]')),
          locked: Boolean(getTenantActionEntitlement(renderState, 'can_edit_config')?.locked)
            || !hasTenantPermission(renderState, 'manage_runtimes'),
          reason: !hasTenantPermission(renderState, 'manage_runtimes')
            ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Config access tests are locked in the current package.')
            : getServerBotProbeLockReason(renderState, 'config-access'),
        },
        {
          nodes: Array.from(document.querySelectorAll('[data-server-bot-probe-action="restart"]')),
          locked: Boolean(getTenantActionEntitlement(renderState, 'can_restart_server')?.locked)
            || !hasTenantPermission(renderState, 'manage_runtimes'),
          reason: !hasTenantPermission(renderState, 'manage_runtimes')
            ? getTenantPermissionLockReason(renderState, 'manage_runtimes', 'Restart tests are locked in the current package.')
            : getServerBotProbeLockReason(renderState, 'restart'),
        },
      ];
      lockNodeGroups.forEach((group) => {
        if (!group.locked) return;
        disableActionNodes(group.nodes, group.reason);
      });
    }

    return {
      queueServerBotProbe,
      wireLogsSyncPage,
      wireServerBotProbeActions,
    };
  }

  return {
    createTenantLogsSyncPageRuntime,
  };
});
