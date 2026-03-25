const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTROL_PANEL_ENV_FIELDS,
  buildControlPanelEnvCatalog,
  buildControlPanelEnvPatch,
  buildControlPanelEnvPolicySummary,
  buildControlPanelEnvSection,
} = require('../src/config/adminEditableConfig');

test('control panel env registry does not duplicate keys', () => {
  const seen = new Set();
  for (const field of CONTROL_PANEL_ENV_FIELDS) {
    assert.equal(seen.has(field.key), false, `duplicate key: ${field.key}`);
    seen.add(field.key);
  }
});

test('control panel env section hides secrets and normalizes booleans', () => {
  const section = buildControlPanelEnvSection('root', {
    BOT_ENABLE_ADMIN_WEB: 'true',
    RCON_PASSWORD: 'secret-value',
    SCUM_SYNC_AGENT_TOKEN: 'sync-secret-value',
  });

  assert.equal(section.BOT_ENABLE_ADMIN_WEB.value, true);
  assert.equal(section.BOT_ENABLE_ADMIN_WEB.policy, 'admin-editable');
  assert.equal(section.BOT_ENABLE_ADMIN_WEB.applyMode, 'restart-required');
  assert.equal(section.RCON_PASSWORD.configured, true);
  assert.equal(section.RCON_PASSWORD.policy, 'secret-only');
  assert.equal(section.RCON_PASSWORD.value, '');
  assert.equal(section.SCUM_SYNC_AGENT_TOKEN.configured, true);
  assert.equal(section.SCUM_SYNC_AGENT_TOKEN.policy, 'secret-only');
  assert.equal(section.SCUM_SYNC_AGENT_TOKEN.value, '');
});

test('control panel env patch ignores empty secret updates', () => {
  const patch = buildControlPanelEnvPatch({
    root: {
      BOT_ENABLE_ADMIN_WEB: false,
      RCON_PASSWORD: '',
    },
  });

  assert.deepEqual(patch, {
    root: {
      BOT_ENABLE_ADMIN_WEB: 'false',
    },
    portal: {},
  });
});

test('control panel env patch accepts discord admin-log language writes', () => {
  const patch = buildControlPanelEnvPatch({
    root: {
      ADMIN_LOG_LANGUAGE: 'th',
    },
  });

  assert.deepEqual(patch, {
    root: {
      ADMIN_LOG_LANGUAGE: 'th',
    },
    portal: {},
  });
});

test('control panel env catalog exposes policy metadata for every field', () => {
  const catalog = buildControlPanelEnvCatalog();

  assert.equal(catalog.length, CONTROL_PANEL_ENV_FIELDS.length);
  for (const entry of catalog) {
    assert.match(String(entry.policy || ''), /^(admin-editable|runtime-only|secret-only)$/);
    assert.match(String(entry.applyMode || ''), /^(reload-safe|restart-required)$/);
  }
});

test('control panel env policy summary matches catalog totals and exposes important keys', () => {
  const catalog = buildControlPanelEnvCatalog();
  const summary = buildControlPanelEnvPolicySummary();
  const keys = new Set(catalog.map((entry) => entry.key));

  assert.equal(summary.total, catalog.length);
  assert.equal(
    summary.adminEditable + summary.runtimeOnly + summary.secretOnly,
    summary.total,
  );
  assert.equal(summary.reloadSafe + summary.restartRequired, summary.total);
  assert.equal(keys.has('ADMIN_WEB_2FA_ENABLED'), true);
  assert.equal(keys.has('ADMIN_WEB_STEP_UP_ENABLED'), true);
  assert.equal(keys.has('ADMIN_LOG_LANGUAGE'), true);
  assert.equal(keys.has('ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET'), true);
  assert.equal(keys.has('ADMIN_WEB_2FA_SECRET'), true);
  assert.equal(keys.has('ADMIN_WEB_LOGIN_MAX_ATTEMPTS'), true);
  assert.equal(keys.has('ADMIN_WEB_SSO_DISCORD_OWNER_ROLE_NAMES'), true);
  assert.equal(keys.has('DISCORD_TOKEN'), true);
  assert.equal(keys.has('NODE_ENV'), true);
  assert.equal(keys.has('DATABASE_PROVIDER'), true);
  assert.equal(keys.has('BOT_DATA_DIR'), true);
  assert.equal(keys.has('TENANT_DB_TOPOLOGY_MODE'), true);
  assert.equal(keys.has('BOT_HEALTH_HOST'), true);
  assert.equal(keys.has('BOT_HEALTH_PORT'), true);
  assert.equal(keys.has('SCUM_WATCHER_ENABLED'), true);
  assert.equal(keys.has('SCUM_WATCHER_REQUIRED'), true);
  assert.equal(keys.has('SCUM_WATCHER_HEALTH_PORT'), true);
  assert.equal(keys.has('SCUM_SYNC_TRANSPORT'), true);
  assert.equal(keys.has('SCUM_SYNC_CONTROL_PLANE_URL'), true);
  assert.equal(keys.has('SCUM_SYNC_AGENT_TOKEN'), true);
  assert.equal(keys.has('SCUM_TENANT_ID'), true);
  assert.equal(keys.has('SCUM_SERVER_ID'), true);
  assert.equal(keys.has('SCUM_SYNC_AGENT_ID'), true);
  assert.equal(keys.has('SCUM_SYNC_RUNTIME_KEY'), true);
  assert.equal(keys.has('SCUM_SYNC_AGENT_VERSION'), true);
  assert.equal(keys.has('SCUM_AGENT_CHANNEL'), true);
  assert.equal(keys.has('PLATFORM_API_BASE_URL'), true);
  assert.equal(keys.has('PLATFORM_AGENT_TOKEN'), true);
  assert.equal(keys.has('DELIVERY_AGENT_PRE_COMMANDS_JSON'), true);
  assert.equal(keys.has('DELIVERY_NATIVE_PROOF_MODE'), true);
  assert.equal(keys.has('DELIVERY_NATIVE_PROOF_SCRIPT'), true);
  assert.equal(keys.has('WEB_PORTAL_ENFORCE_ORIGIN_CHECK'), true);
  assert.equal(keys.has('WEB_PORTAL_DISCORD_CLIENT_SECRET'), true);
  assert.equal(keys.has('WEB_PORTAL_MAP_EMBED_ENABLED'), true);
  assert.equal(keys.has('WEB_PORTAL_LEGACY_ADMIN_URL'), true);
  assert.equal(keys.has('WEB_PORTAL_PORT'), true);
});

test('control panel env patch rejects runtime-only env keys from admin writes', () => {
  const patch = buildControlPanelEnvPatch({
    root: {
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/scum',
      BOT_ENABLE_ADMIN_WEB: true,
    },
  });

  assert.deepEqual(patch, {
    root: {
      BOT_ENABLE_ADMIN_WEB: 'true',
    },
    portal: {},
  });
});
