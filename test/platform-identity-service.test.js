const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';
process.env.PRISMA_TEST_DATABASE_URL = 'file:./prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';

const { prisma } = require('../src/prisma');
const {
  clearPlatformPlayerSteamLink,
  completeEmailVerification,
  completePasswordReset,
  buildLinkedAccountSummary,
  ensurePlatformIdentityTables,
  ensurePlatformPlayerIdentity,
  ensurePlatformUserIdentity,
  getPlatformUserIdentitySummary,
  getIdentitySummaryForPreviewAccount,
  issueEmailVerificationToken,
  issuePasswordResetToken,
} = require('../src/services/platformIdentityService');

async function cleanupIdentityFixtures() {
  await ensurePlatformIdentityTables(prisma);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_verification_tokens
    WHERE email = 'identity-test@example.com'
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_password_reset_tokens
    WHERE email = 'identity-test@example.com'
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_player_profiles
    WHERE discordUserId IN ('123456789012345678', '223456789012345678')
       OR steamId IN ('76561199012345678', '76561199022345678')
       OR userId IN (
         SELECT id FROM platform_users WHERE primaryEmail = 'identity-test@example.com'
       )
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_memberships
    WHERE tenantId = 'tenant-identity-test'
       OR userId IN (
         SELECT userId FROM platform_user_identities
         WHERE providerUserId IN (
           'preview-account-identity-test',
           '123456789012345678',
           '223456789012345678',
           '76561199012345678',
           '76561199022345678'
         )
       )
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_user_identities
    WHERE providerEmail = 'identity-test@example.com'
       OR providerUserId IN (
         'preview-account-identity-test',
         '123456789012345678',
         '223456789012345678',
         '76561199012345678',
         '76561199022345678'
       )
  `).catch(() => null);
  await prisma.$executeRawUnsafe("DELETE FROM platform_users WHERE primaryEmail = 'identity-test@example.com'").catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_users
    WHERE id NOT IN (
      SELECT DISTINCT userId FROM platform_user_identities
    )
      AND id NOT IN (
        SELECT DISTINCT userId FROM platform_player_profiles
      )
      AND displayName IN ('Discord Only Player', 'Identity Player')
  `).catch(() => null);
}

test('platform identity service creates unified user, identity, membership, and reset token', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  const ensured = await ensurePlatformUserIdentity({
    provider: 'email_preview',
    providerUserId: 'preview-account-identity-test',
    email: 'identity-test@example.com',
    displayName: 'Identity Test',
    locale: 'th',
    tenantId: 'tenant-identity-test',
    role: 'owner',
    membershipType: 'tenant',
    identityMetadata: { source: 'test' },
    membershipMetadata: { source: 'test' },
  });

  assert.equal(ensured.ok, true);
  assert.equal(String(ensured.user?.primaryEmail || ''), 'identity-test@example.com');
  assert.deepEqual(
    ensured.identities.map((entry) => entry.provider),
    ['email_preview'],
  );
  assert.equal(String(ensured.membership?.tenantId || ''), 'tenant-identity-test');

  const summary = await getIdentitySummaryForPreviewAccount({
    id: 'preview-account-identity-test',
    email: 'identity-test@example.com',
  });
  assert.equal(String(summary?.user?.primaryEmail || ''), 'identity-test@example.com');
  assert.equal(summary?.memberships?.length, 1);

  const reset = await issuePasswordResetToken({
    email: 'identity-test@example.com',
    userId: ensured.user.id,
    previewAccountId: 'preview-account-identity-test',
    metadata: { source: 'test' },
  });
  assert.equal(reset.ok, true);
  assert.match(String(reset.rawToken || ''), /^rst_/);

  const verification = await issueEmailVerificationToken({
    email: 'identity-test@example.com',
    userId: ensured.user.id,
    previewAccountId: 'preview-account-identity-test',
    metadata: { source: 'test' },
  });
  assert.equal(verification.ok, true);
  assert.match(String(verification.rawToken || ''), /^vfy_/);

  const verified = await completeEmailVerification({
    token: verification.rawToken,
    email: 'identity-test@example.com',
  });
  assert.equal(verified.ok, true);

  const resetComplete = await completePasswordReset({
    token: reset.rawToken,
    email: 'identity-test@example.com',
  });
  assert.equal(resetComplete.ok, true);
});

test('platform identity service links discord and steam into a shared player profile', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  const discord = await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '123456789012345678',
    providerEmail: 'identity-test@example.com',
    email: 'identity-test@example.com',
    displayName: 'Identity Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    verificationState: 'discord_verified',
    profileMetadata: { source: 'discord-test' },
  });
  assert.equal(discord.ok, true);
  assert.equal(String(discord.profile?.discordUserId || ''), '123456789012345678');

  const steam = await ensurePlatformPlayerIdentity({
    provider: 'steam',
    providerUserId: '76561199012345678',
    email: 'identity-test@example.com',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    steamId: '76561199012345678',
    inGameName: 'Identity Survivor',
    verificationState: 'steam_linked',
    profileMetadata: { source: 'steam-test' },
  });
  assert.equal(steam.ok, true);
  assert.equal(String(steam.user?.id || ''), String(discord.user?.id || ''));
  assert.equal(String(steam.profile?.steamId || ''), '76561199012345678');
  assert.equal(String(steam.profile?.discordUserId || ''), '123456789012345678');
});

test('platform identity service can summarize linked user identities by discord and tenant scope', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  const discord = await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '123456789012345678',
    providerEmail: 'identity-test@example.com',
    email: 'identity-test@example.com',
    displayName: 'Identity Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    verificationState: 'discord_verified',
  });

  await ensurePlatformPlayerIdentity({
    provider: 'steam',
    providerUserId: '76561199012345678',
    email: 'identity-test@example.com',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    steamId: '76561199012345678',
    inGameName: 'Identity Survivor',
    verificationState: 'fully_verified',
  });

  const summary = await getPlatformUserIdentitySummary({
    discordUserId: '123456789012345678',
    tenantId: 'tenant-identity-test',
  });

  assert.equal(summary.ok, true);
  assert.equal(String(summary.user?.id || ''), String(discord.user?.id || ''));
  assert.equal(String(summary.profile?.steamId || ''), '76561199012345678');
  assert.equal(String(summary.profile?.verificationState || ''), 'fully_verified');
  assert.equal(summary.identities.some((entry) => entry.provider === 'discord'), true);
  assert.equal(summary.identities.some((entry) => entry.provider === 'steam'), true);
  assert.equal(summary.memberships.some((entry) => String(entry.tenantId || '') === 'tenant-identity-test'), true);
  assert.equal(summary.identitySummary.linkedAccounts.email.linked, true);
  assert.equal(summary.identitySummary.linkedAccounts.discord.linked, true);
  assert.equal(summary.identitySummary.linkedAccounts.steam.linked, true);
  assert.equal(summary.identitySummary.activeMembership.role, 'player');
  assert.equal(summary.identitySummary.readiness.hasActiveMembership, true);
});

test('platform identity service reuses discord-linked user when steam link has no email', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  const discord = await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '223456789012345678',
    displayName: 'Discord Only Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '223456789012345678',
    verificationState: 'discord_verified',
  });

  const steam = await ensurePlatformPlayerIdentity({
    provider: 'steam',
    providerUserId: '76561199022345678',
    tenantId: 'tenant-identity-test',
    discordUserId: '223456789012345678',
    steamId: '76561199022345678',
    inGameName: 'Steam Survivor',
    verificationState: 'steam_linked',
  });

  assert.equal(discord.ok, true);
  assert.equal(steam.ok, true);
  assert.equal(String(steam.user?.id || ''), String(discord.user?.id || ''));
  assert.equal(String(steam.profile?.discordUserId || ''), '223456789012345678');
});

test('platform identity service builds fallback linked-account summary when only legacy steam link is available', async () => {
  const summary = buildLinkedAccountSummary({
    user: null,
    profile: null,
    identities: [],
    memberships: [],
    tenantId: 'tenant-identity-test',
    fallbackEmail: 'identity-test@example.com',
    fallbackDiscordUserId: '123456789012345678',
    legacySteamLink: {
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'Identity Survivor',
    },
  });

  assert.equal(summary.linkedAccounts.email.linked, true);
  assert.equal(summary.linkedAccounts.discord.linked, true);
  assert.equal(summary.linkedAccounts.steam.linked, true);
  assert.equal(summary.linkedAccounts.inGame.value, 'Identity Survivor');
  assert.equal(summary.readiness.hasSteam, true);
});

test('platform identity service treats standard email identities as linked email accounts', async () => {
  const summary = buildLinkedAccountSummary({
    user: {
      id: 'platform-user-email-test',
      primaryEmail: 'identity-test@example.com',
    },
    profile: null,
    identities: [
      {
        provider: 'email',
        providerEmail: 'identity-test@example.com',
        verifiedAt: '2026-04-01T10:00:00.000Z',
      },
    ],
    memberships: [],
  });

  assert.equal(summary.linkedAccounts.email.linked, true);
  assert.equal(summary.linkedAccounts.email.verified, true);
  assert.equal(summary.linkedAccounts.email.value, 'identity-test@example.com');
});

test('platform identity service derives identity conflicts and attention items from mixed linkage state', () => {
  const summary = buildLinkedAccountSummary({
    user: {
      id: 'platform-user-email-test',
      primaryEmail: 'identity-test@example.com',
    },
    profile: {
      discordUserId: 'discord-profile-id',
      steamId: 'steam-profile-id',
      verificationState: 'pending',
    },
    identities: [
      {
        provider: 'email',
        providerEmail: 'identity-test@example.com',
        verifiedAt: null,
      },
      {
        provider: 'discord',
        providerUserId: 'discord-identity-id',
        verifiedAt: '2026-04-01T10:00:00.000Z',
      },
      {
        provider: 'steam',
        providerUserId: 'steam-identity-id',
        verifiedAt: '2026-04-01T10:00:00.000Z',
      },
    ],
    memberships: [
      {
        tenantId: 'tenant-identity-test',
        membershipType: 'tenant',
        role: 'player',
        status: 'inactive',
      },
    ],
    tenantId: 'tenant-identity-test',
  });

  assert.deepEqual(
    summary.conflicts.map((item) => item.key).sort(),
    ['discord-mismatch', 'steam-mismatch'],
  );
  assert.deepEqual(
    summary.attention.map((item) => item.key).sort(),
    ['in-game-pending', 'membership-required', 'verify-email'],
  );
  assert.equal(summary.readiness.hasSteam, true);
  assert.equal(summary.readiness.hasActiveMembership, false);
  assert.equal(summary.attention.find((item) => item.key === 'verify-email')?.actions?.[0]?.label, 'Send verification email');
  assert.equal(summary.conflicts.find((item) => item.key === 'steam-mismatch')?.actions?.some((action) => action.label === 'Open support'), true);
  assert.equal(summary.conflicts.find((item) => item.key === 'steam-mismatch')?.actions?.some((action) => action.label === 'Send verification email'), true);
});

test('platform identity summary exposes a direct steam disconnect action after email verification', async () => {
  const summary = buildLinkedAccountSummary({
    user: {
      id: 'platform-user-1',
      primaryEmail: 'verified@example.com',
    },
    profile: {
      discordUserId: 'discord-profile-id',
      steamId: 'steam-profile-id',
      verificationState: 'fully_verified',
    },
    identities: [
      {
        provider: 'email_preview',
        providerEmail: 'verified@example.com',
        verifiedAt: '2026-04-01T09:00:00.000Z',
      },
      {
        provider: 'discord',
        providerUserId: 'discord-identity-id',
        verifiedAt: '2026-04-01T09:05:00.000Z',
      },
      {
        provider: 'steam',
        providerUserId: 'steam-identity-id',
        verifiedAt: '2026-04-01T09:10:00.000Z',
      },
    ],
    memberships: [
      {
        tenantId: 'tenant-identity-test',
        membershipType: 'tenant',
        role: 'player',
        status: 'active',
      },
    ],
    tenantId: 'tenant-identity-test',
  });

  const steamMismatch = summary.conflicts.find((item) => item.key === 'steam-mismatch');
  assert.equal(
    steamMismatch?.actions?.some((action) => action.label === 'Disconnect Steam link'),
    true,
  );
  assert.equal(
    steamMismatch?.actions?.some((action) => action.data?.['data-player-steam-unlink'] === true),
    true,
  );
  assert.equal(
    steamMismatch?.actions?.some((action) => action.data?.['data-player-identity-support'] === true),
    true,
  );
});

test('platform identity summary for preview accounts includes player profile readiness', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '123456789012345678',
    providerEmail: 'identity-test@example.com',
    email: 'identity-test@example.com',
    displayName: 'Identity Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    verificationState: 'discord_verified',
  });

  await ensurePlatformPlayerIdentity({
    provider: 'steam',
    providerUserId: '76561199012345678',
    email: 'identity-test@example.com',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    steamId: '76561199012345678',
    inGameName: 'Identity Survivor',
    verificationState: 'fully_verified',
  });

  const summary = await getIdentitySummaryForPreviewAccount({
    id: 'preview-account-identity-test',
    email: 'identity-test@example.com',
    tenantId: 'tenant-identity-test',
  });

  assert.ok(summary?.profile);
  assert.equal(summary.profile.steamId, '76561199012345678');
  assert.equal(summary.identitySummary.linkedAccounts.discord.linked, true);
  assert.equal(summary.identitySummary.linkedAccounts.steam.linked, true);
  assert.equal(summary.identitySummary.linkedAccounts.inGame.linked, true);
  assert.equal(summary.identitySummary.readiness.hasInGameProfile, true);
});

test('platform identity service can clear steam link from a shared player profile', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '123456789012345678',
    providerEmail: 'identity-test@example.com',
    email: 'identity-test@example.com',
    displayName: 'Identity Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    verificationState: 'discord_verified',
  });

  await ensurePlatformPlayerIdentity({
    provider: 'steam',
    providerUserId: '76561199012345678',
    email: 'identity-test@example.com',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    steamId: '76561199012345678',
    inGameName: 'Identity Survivor',
    verificationState: 'fully_verified',
  });

  const cleared = await clearPlatformPlayerSteamLink({
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    steamId: '76561199012345678',
  });

  assert.equal(cleared.ok, true);
  assert.equal(cleared.profile.steamId, null);
  assert.equal(cleared.profile.verificationState, 'discord_verified');
  assert.equal(cleared.identitySummary.linkedAccounts.steam.linked, false);
  assert.equal(cleared.identitySummary.linkedAccounts.discord.linked, true);
});

test('platform identity service requires explicit allowGlobal for global identity summary lookups in strict postgres mode', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '123456789012345678',
    providerEmail: 'identity-test@example.com',
    email: 'identity-test@example.com',
    displayName: 'Identity Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    verificationState: 'discord_verified',
  });

  await assert.rejects(
    () => getPlatformUserIdentitySummary({
      discordUserId: '123456789012345678',
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }),
    /platform identity latest profile lookup requires tenantId/i,
  );
});

test('platform identity service allows explicit global identity summary lookups in strict postgres mode', async (t) => {
  await cleanupIdentityFixtures();
  t.after(cleanupIdentityFixtures);

  await ensurePlatformPlayerIdentity({
    provider: 'discord',
    providerUserId: '123456789012345678',
    providerEmail: 'identity-test@example.com',
    email: 'identity-test@example.com',
    displayName: 'Identity Player',
    tenantId: 'tenant-identity-test',
    discordUserId: '123456789012345678',
    verificationState: 'discord_verified',
  });

  const summary = await getPlatformUserIdentitySummary({
    discordUserId: '123456789012345678',
    allowGlobal: true,
    env: {
      DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
      TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
    },
  });

  assert.equal(summary.ok, true);
  assert.equal(String(summary.profile?.discordUserId || ''), '123456789012345678');
});
