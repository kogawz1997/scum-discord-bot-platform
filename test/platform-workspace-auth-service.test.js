const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';
process.env.PRISMA_TEST_DATABASE_URL = 'file:./prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';

const { prisma } = require('../src/prisma');
const { ensurePlatformPlayerIdentity } = require('../src/services/platformIdentityService');
const {
  requestPlayerMagicLink,
  consumePlayerMagicLink,
} = require('../src/services/platformWorkspaceAuthService');

const MAGIC_EMAIL = 'magiclink-test@example.com';
const MAGIC_DISCORD_ID = '333456789012345678';

async function cleanupWorkspaceAuthFixtures() {
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_verification_tokens
    WHERE email = '${MAGIC_EMAIL}'
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_player_profiles
    WHERE discordUserId = '${MAGIC_DISCORD_ID}'
       OR userId IN (
         SELECT id FROM platform_users WHERE primaryEmail = '${MAGIC_EMAIL}'
       )
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_memberships
    WHERE userId IN (
      SELECT id FROM platform_users WHERE primaryEmail = '${MAGIC_EMAIL}'
    )
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_user_identities
    WHERE providerEmail = '${MAGIC_EMAIL}'
       OR providerUserId = '${MAGIC_DISCORD_ID}'
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_users
    WHERE primaryEmail = '${MAGIC_EMAIL}'
  `).catch(() => null);
}

async function seedMagicLinkUser() {
  return ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: MAGIC_DISCORD_ID,
    providerEmail: MAGIC_EMAIL,
    email: MAGIC_EMAIL,
    displayName: 'Magic Link User',
    discordUserId: MAGIC_DISCORD_ID,
    verificationState: 'discord_verified',
  });
}

test('workspace auth requestPlayerMagicLink works in strict postgres mode with explicit global profile access', async (t) => {
  await cleanupWorkspaceAuthFixtures();
  t.after(cleanupWorkspaceAuthFixtures);

  const previousDebug = process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS;
  process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS = 'true';

  try {
    const seeded = await seedMagicLinkUser();
    assert.equal(seeded.ok, true);

    const result = await requestPlayerMagicLink({
      email: MAGIC_EMAIL,
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }, prisma);

    assert.equal(result.ok, true);
    assert.equal(result.requested, true);
    assert.equal(result.queued, true);
    assert.match(String(result.debugToken || ''), /^player_m_/);
  } finally {
    if (previousDebug === undefined) {
      delete process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS;
    } else {
      process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS = previousDebug;
    }
  }
});

test('workspace auth consumePlayerMagicLink works in strict postgres mode with explicit global profile access', async (t) => {
  await cleanupWorkspaceAuthFixtures();
  t.after(cleanupWorkspaceAuthFixtures);

  const previousDebug = process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS;
  process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS = 'true';

  try {
    const seeded = await seedMagicLinkUser();
    assert.equal(seeded.ok, true);

    const requested = await requestPlayerMagicLink({
      email: MAGIC_EMAIL,
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }, prisma);

    assert.equal(requested.ok, true);
    assert.ok(requested.debugToken);

    const consumed = await consumePlayerMagicLink({
      token: requested.debugToken,
      email: MAGIC_EMAIL,
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }, prisma);

    assert.equal(consumed.ok, true);
    assert.equal(String(consumed.user?.primaryEmail || ''), MAGIC_EMAIL);
    assert.equal(String(consumed.discordUserId || ''), MAGIC_DISCORD_ID);
    assert.equal(String(consumed.profile?.discordUserId || ''), MAGIC_DISCORD_ID);
  } finally {
    if (previousDebug === undefined) {
      delete process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS;
    } else {
      process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS = previousDebug;
    }
  }
});
