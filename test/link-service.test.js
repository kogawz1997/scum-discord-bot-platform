const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/linkService.js');
const storePath = path.resolve(__dirname, '../src/store/linkStore.js');
const identityPath = path.resolve(__dirname, '../src/services/platformIdentityService.js');
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
  installMock(prismaPath, mocks.prisma);
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
  clearModule(identityPath);
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
