'use strict';

function createAdminControlPanelRuntime(options = {}) {
  const {
    config,
    getRequiredCommandAccessRole,
    getAdminEditableEnvFileValues,
    buildAdminEditableEnvSection,
    buildAdminEditableEnvSectionGroups,
    buildAdminEditableEnvCatalog,
    buildAdminEditableEnvCatalogGroups,
    buildAdminEditableEnvPolicySummary,
    getRootEnvFilePath,
    getPortalEnvFilePath,
    listManagedRuntimeServices,
    listAdminUsersFromDb,
    getPlatformTenantConfig,
    hasRoleAtLeast,
    ssoDiscordRedirectUri = '',
  } = options;

  function buildCommandRegistry(client) {
    const disabled = Array.isArray(config.commands?.disabled)
      ? new Set(
        config.commands.disabled
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      )
      : new Set();
    const commandEntries = client?.commands instanceof Map
      ? Array.from(client.commands.values())
      : Array.isArray(client?.commands)
        ? client.commands
        : [];

    return commandEntries
      .map((entry) => {
        const json = typeof entry?.data?.toJSON === 'function'
          ? entry.data.toJSON()
          : null;
        const name = String(json?.name || entry?.data?.name || entry?.name || '').trim();
        if (!name) return null;
        return {
          name,
          description: String(json?.description || entry?.description || '').trim(),
          disabled: disabled.has(name),
          requiredRole: getRequiredCommandAccessRole(name, config.commands),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async function buildControlPanelSettings(client, auth = null, optionsArg = {}) {
    const envValues = getAdminEditableEnvFileValues();
    const authTenantId = String(auth?.tenantId || '').trim() || null;
    const scopedTenantId = String(optionsArg.tenantId || auth?.tenantId || '').trim() || null;
    const envCatalog = authTenantId
      ? { root: [], portal: [] }
      : {
        root: buildAdminEditableEnvCatalog('root'),
        portal: buildAdminEditableEnvCatalog('portal'),
      };
    const envCatalogGroups = authTenantId
      ? { root: [], portal: [] }
      : {
        root: buildAdminEditableEnvCatalogGroups('root'),
        portal: buildAdminEditableEnvCatalogGroups('portal'),
      };

    return {
      env: {
        root: authTenantId ? {} : buildAdminEditableEnvSection('root', envValues.root),
        portal: authTenantId ? {} : buildAdminEditableEnvSection('portal', envValues.portal),
      },
      envGroups: {
        root: authTenantId ? [] : buildAdminEditableEnvSectionGroups('root', envValues.root),
        portal: authTenantId ? [] : buildAdminEditableEnvSectionGroups('portal', envValues.portal),
      },
      envCatalog,
      envCatalogGroups,
      envPolicy: {
        root: buildAdminEditableEnvPolicySummary('root'),
        portal: buildAdminEditableEnvPolicySummary('portal'),
      },
      commands: buildCommandRegistry(client),
      adminUsers:
        auth && hasRoleAtLeast(auth.role, 'owner')
          ? await listAdminUsersFromDb(250, { activeOnly: false })
          : [],
      commandConfig: {
        disabled: Array.isArray(config.commands?.disabled)
          ? config.commands.disabled.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
        permissions:
          config.commands && typeof config.commands.permissions === 'object' && config.commands.permissions
            ? { ...config.commands.permissions }
            : {},
      },
      managedServices: listManagedRuntimeServices(),
      files: {
        root: getRootEnvFilePath(),
        portal: getPortalEnvFilePath(),
      },
      tenantScope: {
        tenantId: authTenantId,
        requestedTenantId: scopedTenantId,
        tenantConfig: scopedTenantId ? await getPlatformTenantConfig(scopedTenantId) : null,
      },
      applyPolicy: {
        reloadSafe: authTenantId
          ? []
          : buildAdminEditableEnvCatalog()
            .filter((field) => field.applyMode === 'reload-safe')
            .map((field) => field.key),
        restartRequired: authTenantId
          ? []
          : buildAdminEditableEnvCatalog()
            .filter((field) => field.applyMode === 'restart-required')
            .map((field) => field.key),
      },
      reloadRequired: true,
    };
  }

  function getDiscordRedirectUri(host, port) {
    if (ssoDiscordRedirectUri) return ssoDiscordRedirectUri;
    return `http://${host}:${port}/admin/auth/discord/callback`;
  }

  return {
    buildCommandRegistry,
    buildControlPanelSettings,
    getDiscordRedirectUri,
  };
}

module.exports = {
  createAdminControlPanelRuntime,
};
