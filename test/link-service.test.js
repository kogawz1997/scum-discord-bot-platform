const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/linkService.js');
const storePath = path.resolve(__dirname, '../src/store/linkStore.js');
const identityPath = path.resolve(__dirname, '../src/services/platformIdentityService.js');
const registryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function loadService(mocks) {
  clearModule(servicePath);
  installMock(storePath, mocks.linkStore);
  installMock(identityPath, mocks.platformIdentityService);
  installMock(registryPath, mocks.registry || { listServerDiscordLinks() { return []; } });
  installMock(prismaPath, mocks.prisma);
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
  clearModule(identityPath);
  clearModule(registryPath);
  clearModule(prismaPath);
});

test('link service returns centralized identity summary after steam bind', async () => {
  const service = loadService({
    linkStore: {
      normalizeSteamId(value) {
        return String(value || '').trim();
      },
      getLinkBySteamId() {
        return null;
      },
      getLinkByUserId() {
        return null;
      },
      setLink({ steamId, userId, inGameName }) {
        return { ok: true, steamId, userId, inGameName };
      },
      unlinkByUserId() {
        return null;
      },
      unlinkBySteamId() {
        return null;
      },
    },
    platformIdentityService: {
      async ensurePlatformPlayerIdentity() {
        return {
          ok: true,
          user: { id: 'platform-user-1' },
          profile: { id: 'platform-profile-1' },
        };
      },
      async getPlatformUserIdentitySummary() {
        return {
          ok: true,
          identitySummary: {
            linkedAccounts: {
              steam: {
                linked: true,
                verified: true,
                value: '76561199012345678',
              },
            },
          },
        };
      },
      async clearPlatformPlayerSteamLink() {
        return { ok: false, reason: 'not-used' };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-link-test';
      },
    },
  });

  const result = await service.bindSteamLinkForUser({
    userId: '123456789012345678',
    steamId: '76561199012345678',
    inGameName: 'Identity Survivor',
  });

  assert.equal(result.ok, true);
  assert.equal(result.identity.userId, 'platform-user-1');
  assert.equal(result.identity.profileId, 'platform-profile-1');
  assert.equal(result.identitySummary.linkedAccounts.steam.verified, true);
});

test('link service forwards centralized identity summary after steam unlink', async () => {
  const service = loadService({
    linkStore: {
      normalizeSteamId(value) {
        return String(value || '').trim();
      },
      getLinkBySteamId() {
        return null;
      },
      getLinkByUserId() {
        return null;
      },
      setLink() {
        return { ok: false, reason: 'not-used' };
      },
      unlinkByUserId(userId) {
        return userId ? { userId, steamId: '76561199012345678' } : null;
      },
      unlinkBySteamId(steamId) {
        return steamId ? { userId: '123456789012345678', steamId } : null;
      },
    },
    platformIdentityService: {
      async ensurePlatformPlayerIdentity() {
        return { ok: false, reason: 'not-used' };
      },
      async getPlatformUserIdentitySummary() {
        return null;
      },
      async clearPlatformPlayerSteamLink() {
        return {
          ok: true,
          identitySummary: {
            linkedAccounts: {
              steam: {
                linked: false,
                verified: false,
                value: null,
              },
            },
          },
        };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-link-test';
      },
    },
  });

  const result = await service.removeSteamLink({
    userId: '123456789012345678',
    tenantId: 'tenant-link-test',
  });

  assert.equal(result.ok, true);
  assert.equal(result.removed.userId, '123456789012345678');
  assert.equal(result.identitySummary.linkedAccounts.steam.linked, false);
});

test('link service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    linkStore: {
      normalizeSteamId(value) {
        return String(value || '').trim();
      },
      getLinkBySteamId() {
        return null;
      },
      getLinkByUserId() {
        return null;
      },
      setLink() {
        return { ok: true };
      },
      unlinkByUserId() {
        return null;
      },
      unlinkBySteamId() {
        return null;
      },
    },
    platformIdentityService: {
      async ensurePlatformPlayerIdentity() {
        return { ok: true };
      },
      async getPlatformUserIdentitySummary() {
        return { ok: true, identitySummary: null };
      },
      async clearPlatformPlayerSteamLink() {
        return { ok: true, identitySummary: null };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.bindSteamLinkForUser({
      userId: '123456789012345678',
      steamId: '76561199012345678',
      env: {
        DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }),
    /requires tenantId/i,
  );
});

test('link service forwards tenant scope to scoped link store operations', async () => {
  const calls = [];
  const service = loadService({
    linkStore: {
      normalizeSteamId(value) {
        return String(value || '').trim();
      },
      getLinkBySteamId(_steamId, options = {}) {
        calls.push(['getLinkBySteamId', options.tenantId || null]);
        return null;
      },
      getLinkByUserId(_userId, options = {}) {
        calls.push(['getLinkByUserId', options.tenantId || null]);
        return null;
      },
      setLink({ steamId, userId }, options = {}) {
        calls.push(['setLink', options.tenantId || null]);
        return { ok: true, steamId, userId };
      },
      unlinkByUserId(userId, options = {}) {
        calls.push(['unlinkByUserId', options.tenantId || null]);
        return userId ? { userId, steamId: '76561199012345678' } : null;
      },
      unlinkBySteamId(_steamId, options = {}) {
        calls.push(['unlinkBySteamId', options.tenantId || null]);
        return null;
      },
    },
    platformIdentityService: {
      async ensurePlatformPlayerIdentity() {
        return { ok: true, user: { id: 'platform-user-1' }, profile: { id: 'profile-1' } };
      },
      async getPlatformUserIdentitySummary() {
        return { ok: true, identitySummary: null };
      },
      async clearPlatformPlayerSteamLink() {
        return { ok: true, identitySummary: null };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-link-test';
      },
    },
  });

  const bound = await service.bindSteamLinkForUser({
    userId: '123456789012345678',
    steamId: '76561199012345678',
    tenantId: 'tenant-link-test',
  });
  assert.equal(bound.ok, true);

  const removed = await service.removeSteamLink({
    userId: '123456789012345678',
    tenantId: 'tenant-link-test',
  });
  assert.equal(removed.ok, true);

  assert.deepEqual(calls, [
    ['getLinkByUserId', 'tenant-link-test'],
    ['getLinkBySteamId', 'tenant-link-test'],
    ['setLink', 'tenant-link-test'],
    ['unlinkByUserId', 'tenant-link-test'],
  ]);
});

test('link service read helpers forward tenant scope to link store', async () => {
  const calls = [];
  const service = loadService({
    linkStore: {
      normalizeSteamId(value) {
        return String(value || '').trim();
      },
      getLinkBySteamId(steamId, options = {}) {
        calls.push(['getLinkBySteamId', steamId, options.tenantId || null]);
        return { steamId, userId: 'user-1' };
      },
      getLinkByUserId(userId, options = {}) {
        calls.push(['getLinkByUserId', userId, options.tenantId || null]);
        return { steamId: '76561199012345678', userId };
      },
      setLink() {
        return { ok: false, reason: 'not-used' };
      },
      unlinkByUserId() {
        return null;
      },
      unlinkBySteamId() {
        return null;
      },
    },
    platformIdentityService: {
      async ensurePlatformPlayerIdentity() {
        return { ok: false, reason: 'not-used' };
      },
      async getPlatformUserIdentitySummary() {
        return null;
      },
      async clearPlatformPlayerSteamLink() {
        return null;
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-link-test';
      },
    },
  });

  const byUser = service.getSteamLinkByUserId('user-1', { tenantId: 'tenant-link-test' });
  const bySteam = service.getSteamLinkBySteamId('76561199012345678', { tenantId: 'tenant-link-test' });

  assert.equal(String(byUser?.steamId || ''), '76561199012345678');
  assert.equal(String(bySteam?.userId || ''), 'user-1');
  assert.deepEqual(calls, [
    ['getLinkByUserId', 'user-1', 'tenant-link-test'],
    ['getLinkBySteamId', '76561199012345678', 'tenant-link-test'],
  ]);
});

test('link service can resolve tenant scope from guild mapping', async () => {
  const calls = [];
  const service = loadService({
    linkStore: {
      normalizeSteamId(value) {
        return String(value || '').trim();
      },
      getLinkBySteamId(_steamId, options = {}) {
        calls.push(['getLinkBySteamId', options.tenantId || null]);
        return null;
      },
      getLinkByUserId(_userId, options = {}) {
        calls.push(['getLinkByUserId', options.tenantId || null]);
        return null;
      },
      setLink({ steamId, userId }, options = {}) {
        calls.push(['setLink', options.tenantId || null]);
        return { ok: true, steamId, userId };
      },
      unlinkByUserId(userId, options = {}) {
        calls.push(['unlinkByUserId', options.tenantId || null]);
        return userId ? { userId, steamId: '76561199012345678' } : null;
      },
      unlinkBySteamId() {
        return null;
      },
    },
    platformIdentityService: {
      async ensurePlatformPlayerIdentity() {
        return { ok: true, user: { id: 'platform-user-1' }, profile: { id: 'profile-1' } };
      },
      async getPlatformUserIdentitySummary() {
        return { ok: true, identitySummary: null };
      },
      async clearPlatformPlayerSteamLink() {
        return { ok: true, identitySummary: null };
      },
    },
    registry: {
      listServerDiscordLinks(options = {}) {
        if (String(options.guildId || '') === 'guild-1') {
          return [{ tenantId: 'tenant-guild-1', guildId: 'guild-1', serverId: 'server-1' }];
        }
        return [];
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  const bound = await service.bindSteamLinkForUser({
    userId: '123456789012345678',
    steamId: '76561199012345678',
    guildId: 'guild-1',
  });
  assert.equal(bound.ok, true);

  const byUser = service.getSteamLinkByUserId('123456789012345678', { guildId: 'guild-1' });
  assert.equal(byUser, null);

  const removed = await service.removeSteamLink({
    userId: '123456789012345678',
    guildId: 'guild-1',
  });
  assert.equal(removed.ok, true);

  assert.deepEqual(calls, [
    ['getLinkByUserId', 'tenant-guild-1'],
    ['getLinkBySteamId', 'tenant-guild-1'],
    ['setLink', 'tenant-guild-1'],
    ['getLinkByUserId', 'tenant-guild-1'],
    ['unlinkByUserId', 'tenant-guild-1'],
  ]);
});
