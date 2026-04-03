'use strict';

const crypto = require('node:crypto');

const { prisma } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const {
  ensurePlatformIdentityTables,
  ensurePlatformUserPasswordColumn,
  getPlatformUserPasswordColumnState,
  invalidateIdentitySchemaCaches,
} = require('./platformIdentitySchemaService');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeEmail(value) {
  return trimText(value, 200).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'platform') {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function createRawToken(prefix = 'rst') {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}.${crypto.randomBytes(20).toString('hex')}`;
}

function parseJsonObject(value) {
  if (value == null || String(value).trim() === '') return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyJsonObject(value) {
  return JSON.stringify(
    value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {},
  );
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPrismaClientLike(db) {
  return Boolean(
    db
    && typeof db === 'object'
    && typeof db.$transaction === 'function'
    && typeof db.$disconnect === 'function',
  );
}

function getPlatformIdentityDelegates(db = prisma, env = process.env) {
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  if (!db || typeof db !== 'object') {
    return null;
  }
  const delegates = {
    users: db.platformUser,
    identities: db.platformUserIdentity,
    memberships: db.platformMembership,
    profiles: db.platformPlayerProfile,
    verificationTokens: db.platformVerificationToken,
    passwordResetTokens: db.platformPasswordResetToken,
  };
  if (Object.values(delegates).every((delegate) => delegate && typeof delegate === 'object')) {
    if (!runtime.isServerEngine && isPrismaClientLike(db)) {
      return null;
    }
    return delegates;
  }
  if (!runtime.isServerEngine) {
    return null;
  }
  const error = new Error(
    'Platform identity delegates are unavailable for the active server-engine runtime. Run Prisma generate and database migrations before using identity flows.',
  );
  error.code = 'PLATFORM_IDENTITY_DELEGATES_REQUIRED';
  error.statusCode = 500;
  error.identityRuntime = runtime;
  throw error;
}

function normalizeRowLookupKey(value) {
  return String(value || '')
    .trim()
    .replace(/[_\s-]+/g, '')
    .toLowerCase();
}

function getRowValue(row, ...keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined) {
      return row[key];
    }
  }
  const lookup = new Map();
  for (const [key, value] of Object.entries(row)) {
    lookup.set(normalizeRowLookupKey(key), value);
  }
  for (const key of keys) {
    const resolved = lookup.get(normalizeRowLookupKey(key));
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

function normalizeUserRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    primaryEmail: normalizeEmail(getRowValue(row, 'primaryEmail')),
    displayName: trimText(getRowValue(row, 'displayName'), 200) || null,
    locale: trimText(getRowValue(row, 'locale'), 16) || 'en',
    status: trimText(getRowValue(row, 'status'), 40) || 'active',
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizeIdentityRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    provider: trimText(getRowValue(row, 'provider'), 80) || null,
    providerUserId: trimText(getRowValue(row, 'providerUserId'), 200) || null,
    providerEmail: normalizeEmail(getRowValue(row, 'providerEmail')),
    displayName: trimText(getRowValue(row, 'displayName'), 200) || null,
    avatarUrl: trimText(getRowValue(row, 'avatarUrl'), 600) || null,
    verifiedAt: getRowValue(row, 'verifiedAt') ? new Date(getRowValue(row, 'verifiedAt')).toISOString() : null,
    linkedAt: getRowValue(row, 'linkedAt') ? new Date(getRowValue(row, 'linkedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
  };
}

function normalizeMembershipRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    tenantId: trimText(getRowValue(row, 'tenantId'), 160) || null,
    membershipType: trimText(getRowValue(row, 'membershipType'), 80) || 'tenant',
    role: trimText(getRowValue(row, 'role'), 80) || 'member',
    status: trimText(getRowValue(row, 'status'), 40) || 'active',
    isPrimary: getRowValue(row, 'isPrimary') === true || Number(getRowValue(row, 'isPrimary')) === 1,
    acceptedAt: getRowValue(row, 'acceptedAt') ? new Date(getRowValue(row, 'acceptedAt')).toISOString() : null,
    revokedAt: getRowValue(row, 'revokedAt') ? new Date(getRowValue(row, 'revokedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizePlayerProfileRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    tenantId: trimText(getRowValue(row, 'tenantId'), 160) || null,
    discordUserId: trimText(getRowValue(row, 'discordUserId'), 200) || null,
    steamId: trimText(getRowValue(row, 'steamId'), 200) || null,
    inGameName: trimText(getRowValue(row, 'inGameName'), 200) || null,
    verificationState: trimText(getRowValue(row, 'verificationState'), 80) || 'unverified',
    linkedAt: getRowValue(row, 'linkedAt') ? new Date(getRowValue(row, 'linkedAt')).toISOString() : null,
    lastSeenAt: getRowValue(row, 'lastSeenAt') ? new Date(getRowValue(row, 'lastSeenAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizeTokenRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    previewAccountId: trimText(getRowValue(row, 'previewAccountId'), 160) || null,
    email: normalizeEmail(getRowValue(row, 'email')) || null,
    purpose: trimText(getRowValue(row, 'purpose'), 80) || null,
    tokenPrefix: trimText(getRowValue(row, 'tokenPrefix'), 120) || null,
    expiresAt: getRowValue(row, 'expiresAt') ? new Date(getRowValue(row, 'expiresAt')).toISOString() : null,
    consumedAt: getRowValue(row, 'consumedAt') ? new Date(getRowValue(row, 'consumedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

async function findUserById(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.users.findUnique({
      where: { id: normalizedUserId },
    });
    return normalizeUserRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT id, primaryEmail, displayName, locale, status, metadataJson, createdAt, updatedAt
    FROM platform_users
    WHERE id = ${normalizedUserId}
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function findUserByPrimaryEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.users.findUnique({
      where: { primaryEmail: normalizedEmail },
    });
    return normalizeUserRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT id, primaryEmail, displayName, locale, status, metadataJson, createdAt, updatedAt
    FROM platform_users
    WHERE primaryEmail = ${normalizedEmail}
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function findIdentityByProvider(db, provider, providerUserId) {
  const normalizedProvider = trimText(provider, 80).toLowerCase();
  const normalizedProviderUserId = trimText(providerUserId, 200);
  if (!normalizedProvider || !normalizedProviderUserId) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.identities.findUnique({
      where: {
        provider_providerUserId: {
          provider: normalizedProvider,
          providerUserId: normalizedProviderUserId,
        },
      },
    });
    return normalizeIdentityRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT id, userId, provider, providerUserId, providerEmail, displayName, avatarUrl, verifiedAt, linkedAt, metadataJson
    FROM platform_user_identities
    WHERE provider = ${normalizedProvider}
      AND providerUserId = ${normalizedProviderUserId}
    LIMIT 1
  `;
  return normalizeIdentityRow(Array.isArray(rows) ? rows[0] : null);
}

async function findMembership(db, userId, tenantId, membershipType = 'tenant') {
  const normalizedUserId = trimText(userId, 160);
  const normalizedTenantId = trimText(tenantId, 160) || null;
  const normalizedMembershipType = trimText(membershipType, 80) || 'tenant';
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.memberships.findFirst({
      where: {
        userId: normalizedUserId,
        membershipType: normalizedMembershipType,
        tenantId: normalizedTenantId,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return normalizeMembershipRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT id, userId, tenantId, membershipType, role, status, isPrimary, acceptedAt, revokedAt, metadataJson, createdAt, updatedAt
    FROM platform_memberships
    WHERE userId = ${normalizedUserId}
      AND membershipType = ${normalizedMembershipType}
      AND (
        (${normalizedTenantId} IS NULL AND tenantId IS NULL)
        OR tenantId = ${normalizedTenantId}
      )
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizeMembershipRow(Array.isArray(rows) ? rows[0] : null);
}

async function listIdentitiesForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return [];
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const rows = await delegates.identities.findMany({
      where: { userId: normalizedUserId },
      orderBy: { linkedAt: 'asc' },
    });
    return Array.isArray(rows) ? rows.map(normalizeIdentityRow).filter(Boolean) : [];
  }
  const rows = await db.$queryRaw`
    SELECT id, userId, provider, providerUserId, providerEmail, displayName, avatarUrl, verifiedAt, linkedAt, metadataJson
    FROM platform_user_identities
    WHERE userId = ${normalizedUserId}
    ORDER BY linkedAt ASC
  `;
  return Array.isArray(rows) ? rows.map(normalizeIdentityRow).filter(Boolean) : [];
}

async function listMembershipsForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return [];
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const rows = await delegates.memberships.findMany({
      where: { userId: normalizedUserId },
      orderBy: { updatedAt: 'desc' },
    });
    return Array.isArray(rows) ? rows.map(normalizeMembershipRow).filter(Boolean) : [];
  }
  const rows = await db.$queryRaw`
    SELECT id, userId, tenantId, membershipType, role, status, isPrimary, acceptedAt, revokedAt, metadataJson, createdAt, updatedAt
    FROM platform_memberships
    WHERE userId = ${normalizedUserId}
    ORDER BY updatedAt DESC
  `;
  return Array.isArray(rows) ? rows.map(normalizeMembershipRow).filter(Boolean) : [];
}

async function findPlayerProfile(db, userId, tenantId = null) {
  const normalizedUserId = trimText(userId, 160);
  const normalizedTenantId = trimText(tenantId, 160) || null;
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.profiles.findFirst({
      where: {
        userId: normalizedUserId,
        tenantId: normalizedTenantId,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return normalizePlayerProfileRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT
      id,
      userId,
      tenantId,
      discordUserId,
      steamId,
      inGameName,
      verificationState,
      linkedAt,
      lastSeenAt,
      metadataJson,
      createdAt,
      updatedAt
    FROM platform_player_profiles
    WHERE userId = ${normalizedUserId}
      AND (
        (CAST(${normalizedTenantId} AS TEXT) IS NULL AND tenantId IS NULL)
        OR tenantId = CAST(${normalizedTenantId} AS TEXT)
      )
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizePlayerProfileRow(Array.isArray(rows) ? rows[0] : null);
}

async function findLatestPlayerProfileForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.profiles.findFirst({
      where: { userId: normalizedUserId },
      orderBy: { updatedAt: 'desc' },
    });
    return normalizePlayerProfileRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT
      id,
      userId,
      tenantId,
      discordUserId,
      steamId,
      inGameName,
      verificationState,
      linkedAt,
      lastSeenAt,
      metadataJson,
      createdAt,
      updatedAt
    FROM platform_player_profiles
    WHERE userId = ${normalizedUserId}
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizePlayerProfileRow(Array.isArray(rows) ? rows[0] : null);
}

function findIdentityByProviderName(identities = [], provider) {
  const normalizedProvider = trimText(provider, 80).toLowerCase();
  return identities.find(
    (entry) => trimText(entry?.provider, 80).toLowerCase() === normalizedProvider,
  ) || null;
}

function findActiveMembershipForTenant(memberships = [], tenantId = null) {
  const normalizedTenantId = trimText(tenantId, 160) || null;
  return memberships.find((entry) => trimText(entry?.tenantId, 160) === normalizedTenantId)
    || memberships.find((entry) => trimText(entry?.status, 40).toLowerCase() === 'active')
    || memberships[0]
    || null;
}

function buildLinkedAccountSummary(input = {}) {
  const user = input?.user || null;
  const profile = input?.profile || null;
  const tenantId = trimText(input?.tenantId, 160) || null;
  const identities = Array.isArray(input?.identities) ? input.identities : [];
  const memberships = Array.isArray(input?.memberships) ? input.memberships : [];
  const legacySteamLink = input?.legacySteamLink && typeof input.legacySteamLink === 'object'
    ? input.legacySteamLink
    : null;
  const fallbackEmail = normalizeEmail(input?.fallbackEmail);
  const fallbackDiscordUserId = trimText(input?.fallbackDiscordUserId, 200) || null;

  const emailIdentity = findIdentityByProviderName(identities, 'email_preview');
  const discordIdentity = findIdentityByProviderName(identities, 'discord');
  const steamIdentity = findIdentityByProviderName(identities, 'steam');
  const activeMembership = findActiveMembershipForTenant(memberships, tenantId);
  const profileVerificationState = trimText(profile?.verificationState, 80).toLowerCase() || null;
  const steamLinked = profile
    ? Boolean(profile?.steamId || legacySteamLink?.linked || legacySteamLink?.steamId)
    : Boolean(steamIdentity || legacySteamLink?.linked || legacySteamLink?.steamId);

  const linkedProviders = new Set(
    identities
      .map((entry) => trimText(entry?.provider, 80).toLowerCase())
      .filter(Boolean),
  );
  if (!steamLinked) {
    linkedProviders.delete('steam');
  }
  if (steamLinked) {
    linkedProviders.add('steam');
  }
  if (profile?.discordUserId || fallbackDiscordUserId) {
    linkedProviders.add('discord');
  }
  if (normalizeEmail(user?.primaryEmail) || fallbackEmail) {
    linkedProviders.add('email_preview');
  }

  return {
    linkedProviders: Array.from(linkedProviders.values()),
    verificationState: profileVerificationState,
    memberships: memberships.map((entry) => ({
      tenantId: entry?.tenantId || null,
      membershipType: entry?.membershipType || null,
      role: entry?.role || null,
      status: entry?.status || null,
    })),
    linkedAccounts: {
      email: {
        linked: Boolean(emailIdentity || user?.primaryEmail || fallbackEmail),
        verified: Boolean(emailIdentity?.verifiedAt),
        value: normalizeEmail(user?.primaryEmail)
          || normalizeEmail(emailIdentity?.providerEmail)
          || fallbackEmail
          || null,
      },
      discord: {
        linked: Boolean(discordIdentity || profile?.discordUserId || fallbackDiscordUserId),
        verified: Boolean(discordIdentity?.verifiedAt)
          || Boolean(profile?.discordUserId)
          || Boolean(fallbackDiscordUserId),
        value: trimText(discordIdentity?.providerUserId, 200)
          || trimText(profile?.discordUserId, 200)
          || fallbackDiscordUserId
          || null,
      },
      steam: {
        linked: steamLinked,
        verified: steamLinked && (
          Boolean(steamIdentity?.verifiedAt)
          || ['steam_linked', 'verified', 'fully_verified'].includes(profileVerificationState)
        ),
        value: trimText(profile?.steamId, 200)
          || trimText(legacySteamLink?.steamId, 200)
          || (!profile ? trimText(steamIdentity?.providerUserId, 200) : null)
          || null,
      },
      inGame: {
        linked: Boolean(trimText(profile?.inGameName, 200) || trimText(legacySteamLink?.inGameName, 200)),
        verified: ['verified', 'fully_verified', 'in_game_verified'].includes(profileVerificationState),
        value: trimText(profile?.inGameName, 200)
          || trimText(legacySteamLink?.inGameName, 200)
          || null,
      },
    },
    activeMembership: activeMembership
      ? {
          tenantId: activeMembership.tenantId || null,
          membershipType: activeMembership.membershipType || null,
          role: activeMembership.role || null,
          status: activeMembership.status || null,
        }
      : null,
    readiness: {
      hasEmail: Boolean(emailIdentity || user?.primaryEmail || fallbackEmail),
      hasDiscord: Boolean(discordIdentity || profile?.discordUserId || fallbackDiscordUserId),
      hasSteam: steamLinked,
      hasInGameProfile: Boolean(trimText(profile?.inGameName, 200) || trimText(legacySteamLink?.inGameName, 200)),
      hasActiveMembership: Boolean(activeMembership && trimText(activeMembership?.status, 40).toLowerCase() === 'active'),
    },
  };
}

async function findPlayerProfileByExternalIds(db, input = {}) {
  const tenantId = trimText(input.tenantId, 160) || null;
  const discordUserId = trimText(input.discordUserId, 200) || null;
  const steamId = trimText(input.steamId, 200) || null;
  if (!discordUserId && !steamId) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const filters = [];
    if (discordUserId) {
      filters.push({ discordUserId });
    }
    if (steamId) {
      filters.push({ steamId });
    }
    const row = await delegates.profiles.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: filters,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return normalizePlayerProfileRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT
      id,
      userId,
      tenantId,
      discordUserId,
      steamId,
      inGameName,
      verificationState,
      linkedAt,
      lastSeenAt,
      metadataJson,
      createdAt,
      updatedAt
    FROM platform_player_profiles
    WHERE (CAST(${tenantId} AS TEXT) IS NULL OR tenantId = CAST(${tenantId} AS TEXT))
      AND (
        (CAST(${discordUserId} AS TEXT) IS NOT NULL AND discordUserId = CAST(${discordUserId} AS TEXT))
        OR (CAST(${steamId} AS TEXT) IS NOT NULL AND steamId = CAST(${steamId} AS TEXT))
      )
    ORDER BY updatedAt DESC
    LIMIT 1
  `;
  return normalizePlayerProfileRow(Array.isArray(rows) ? rows[0] : null);
}

async function ensurePlatformUserIdentity(input = {}, db = prisma) {
  const provider = trimText(input.provider || 'email_preview', 80).toLowerCase();
  const providerUserId = trimText(input.providerUserId || input.email, 200);
  const email = normalizeEmail(input.email || input.providerEmail);
  const displayName = trimText(input.displayName, 200) || null;
  const locale = trimText(input.locale, 16) || 'en';
  const tenantId = trimText(input.tenantId, 160) || null;
  const role = trimText(input.role, 80) || 'owner';
  const membershipType = trimText(input.membershipType, 80) || (tenantId ? 'tenant' : 'preview');
  const hasVerifiedAt = Object.prototype.hasOwnProperty.call(input, 'verifiedAt');
  const verifiedAt = !hasVerifiedAt
    ? nowIso()
    : input.verifiedAt
      ? new Date(input.verifiedAt).toISOString()
      : null;
  const identityMetadata = input.identityMetadata && typeof input.identityMetadata === 'object' && !Array.isArray(input.identityMetadata)
    ? input.identityMetadata
    : {};
  const membershipMetadata = input.membershipMetadata && typeof input.membershipMetadata === 'object' && !Array.isArray(input.membershipMetadata)
    ? input.membershipMetadata
    : {};
  const preferredUserId = trimText(input.preferredUserId, 160) || null;

  if (!provider || !providerUserId) {
    return { ok: false, reason: 'identity-provider-required' };
  }

  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  let identity = await findIdentityByProvider(db, provider, providerUserId);
  let user = identity ? await findUserById(db, identity.userId) : null;

  if (!user && email) {
    user = await findUserByPrimaryEmail(db, email);
  }
  if (!user && preferredUserId) {
    user = await findUserById(db, preferredUserId);
  }

  if (!user) {
    const userId = createId('user');
    if (delegates) {
      user = normalizeUserRow(await delegates.users.create({
        data: {
          id: userId,
          primaryEmail: email || null,
          displayName,
          locale,
          status: 'active',
          metadataJson: stringifyJsonObject(input.userMetadata),
        },
      }));
    } else {
      await db.$executeRaw`
        INSERT INTO platform_users (
          id, primaryEmail, displayName, locale, status, metadataJson, createdAt, updatedAt
        )
        VALUES (
          ${userId},
          ${email || null},
          ${displayName},
          ${locale},
          ${'active'},
          ${stringifyJsonObject(input.userMetadata)},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      user = await findUserByPrimaryEmail(db, email) || {
        id: userId,
        primaryEmail: email || null,
        displayName,
        locale,
        status: 'active',
        metadata: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
    }
  } else {
    if (delegates) {
      const updateData = { locale };
      if (email) updateData.primaryEmail = email;
      if (displayName) updateData.displayName = displayName;
      user = normalizeUserRow(await delegates.users.update({
        where: { id: user.id },
        data: updateData,
      }));
    } else {
      await db.$executeRaw`
        UPDATE platform_users
        SET
          primaryEmail = COALESCE(${email || null}, primaryEmail),
          displayName = COALESCE(${displayName}, displayName),
          locale = COALESCE(${locale}, locale),
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;
      user = await findUserByPrimaryEmail(db, email || user.primaryEmail) || user;
    }
  }

  if (!identity) {
    const identityId = createId('ident');
    if (delegates) {
      identity = normalizeIdentityRow(await delegates.identities.create({
        data: {
          id: identityId,
          userId: user.id,
          provider,
          providerUserId,
          providerEmail: email || null,
          displayName,
          avatarUrl: trimText(input.avatarUrl, 600) || null,
          verifiedAt: toDateValue(verifiedAt),
          metadataJson: stringifyJsonObject(identityMetadata),
        },
      }));
    } else {
      await db.$executeRaw`
        INSERT INTO platform_user_identities (
          id, userId, provider, providerUserId, providerEmail, displayName, avatarUrl, verifiedAt, linkedAt, metadataJson, createdAt, updatedAt
        )
        VALUES (
          ${identityId},
          ${user.id},
          ${provider},
          ${providerUserId},
          ${email || null},
          ${displayName},
          ${trimText(input.avatarUrl, 600) || null},
          ${verifiedAt},
          CURRENT_TIMESTAMP,
          ${stringifyJsonObject(identityMetadata)},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      identity = await findIdentityByProvider(db, provider, providerUserId);
    }
  } else {
    if (delegates) {
      const updateData = {
        userId: user.id,
        metadataJson: stringifyJsonObject(identityMetadata),
      };
      if (email) updateData.providerEmail = email;
      if (displayName) updateData.displayName = displayName;
      if (trimText(input.avatarUrl, 600)) updateData.avatarUrl = trimText(input.avatarUrl, 600);
      if (verifiedAt) updateData.verifiedAt = toDateValue(verifiedAt);
      identity = normalizeIdentityRow(await delegates.identities.update({
        where: { id: identity.id },
        data: updateData,
      }));
    } else {
      await db.$executeRaw`
        UPDATE platform_user_identities
        SET
          userId = ${user.id},
          providerEmail = COALESCE(${email || null}, providerEmail),
          displayName = COALESCE(${displayName}, displayName),
          avatarUrl = COALESCE(${trimText(input.avatarUrl, 600) || null}, avatarUrl),
          verifiedAt = COALESCE(${verifiedAt}, verifiedAt),
          metadataJson = ${stringifyJsonObject(identityMetadata)},
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${identity.id}
      `;
      identity = await findIdentityByProvider(db, provider, providerUserId);
    }
  }

  let membership = null;
  if (tenantId || membershipType === 'preview') {
    membership = await findMembership(db, user.id, tenantId, membershipType);
    if (!membership) {
      const membershipId = createId('mship');
      if (delegates) {
        membership = normalizeMembershipRow(await delegates.memberships.create({
          data: {
            id: membershipId,
            userId: user.id,
            tenantId,
            membershipType,
            role,
            status: 'active',
            isPrimary: true,
            acceptedAt: new Date(),
            metadataJson: stringifyJsonObject(membershipMetadata),
          },
        }));
      } else {
        await db.$executeRaw`
          INSERT INTO platform_memberships (
            id, userId, tenantId, membershipType, role, status, isPrimary, acceptedAt, metadataJson, createdAt, updatedAt
          )
          VALUES (
            ${membershipId},
            ${user.id},
            ${tenantId},
            ${membershipType},
            ${role},
            ${'active'},
            ${1},
            CURRENT_TIMESTAMP,
            ${stringifyJsonObject(membershipMetadata)},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
        membership = await findMembership(db, user.id, tenantId, membershipType);
      }
    } else {
      if (delegates) {
        const updateData = {
          role,
          status: 'active',
          isPrimary: true,
          metadataJson: stringifyJsonObject(membershipMetadata),
        };
        if (!membership.acceptedAt) {
          updateData.acceptedAt = new Date();
        }
        membership = normalizeMembershipRow(await delegates.memberships.update({
          where: { id: membership.id },
          data: updateData,
        }));
      } else {
        await db.$executeRaw`
          UPDATE platform_memberships
          SET
            role = COALESCE(${role}, role),
            status = ${'active'},
            isPrimary = CASE WHEN isPrimary = 1 THEN 1 ELSE ${membership.isPrimary ? 1 : 1} END,
            acceptedAt = COALESCE(acceptedAt, CAST(CURRENT_TIMESTAMP AS TEXT)),
            metadataJson = ${stringifyJsonObject(membershipMetadata)},
            updatedAt = CURRENT_TIMESTAMP
          WHERE id = ${membership.id}
        `;
        membership = await findMembership(db, user.id, tenantId, membershipType);
      }
    }
  }

  return {
    ok: true,
    user,
    identity,
    membership,
    identities: await listIdentitiesForUser(db, user.id),
    memberships: await listMembershipsForUser(db, user.id),
  };
}

async function upsertPlatformPlayerProfile(input = {}, db = prisma) {
  const userId = trimText(input.userId, 160);
  const tenantId = trimText(input.tenantId, 160) || null;
  const discordUserId = trimText(input.discordUserId, 200) || null;
  const steamId = trimText(input.steamId, 200) || null;
  const inGameName = trimText(input.inGameName, 200) || null;
  const verificationState = trimText(input.verificationState, 80) || 'unverified';
  const linkedAt = input.linkedAt ? new Date(input.linkedAt).toISOString() : null;
  const lastSeenAt = input.lastSeenAt ? new Date(input.lastSeenAt).toISOString() : nowIso();
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
    ? input.metadata
    : {};

  if (!userId) {
    return { ok: false, reason: 'player-profile-user-required' };
  }

  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  let existing = await findPlayerProfile(db, userId, tenantId);
  if (!existing) {
    const profileId = createId('pprof');
    if (delegates) {
      existing = normalizePlayerProfileRow(await delegates.profiles.create({
        data: {
          id: profileId,
          userId,
          tenantId,
          discordUserId,
          steamId,
          inGameName,
          verificationState,
          linkedAt: toDateValue(linkedAt || nowIso()),
          lastSeenAt: toDateValue(lastSeenAt),
          metadataJson: stringifyJsonObject(metadata),
        },
      }));
    } else {
      await db.$executeRaw`
        INSERT INTO platform_player_profiles (
          id, userId, tenantId, discordUserId, steamId, inGameName, verificationState, linkedAt, lastSeenAt, metadataJson, createdAt, updatedAt
        )
        VALUES (
          ${profileId},
          ${userId},
          ${tenantId},
          ${discordUserId},
          ${steamId},
          ${inGameName},
          ${verificationState},
          ${linkedAt || nowIso()},
          ${lastSeenAt},
          ${stringifyJsonObject(metadata)},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      existing = await findPlayerProfile(db, userId, tenantId);
    }
  } else {
    if (delegates) {
      const updateData = {
        verificationState,
        lastSeenAt: toDateValue(lastSeenAt),
        metadataJson: stringifyJsonObject(metadata),
      };
      if (discordUserId) updateData.discordUserId = discordUserId;
      if (steamId) updateData.steamId = steamId;
      if (inGameName) updateData.inGameName = inGameName;
      if (linkedAt) updateData.linkedAt = toDateValue(linkedAt);
      existing = normalizePlayerProfileRow(await delegates.profiles.update({
        where: { id: existing.id },
        data: updateData,
      }));
    } else {
      await db.$executeRaw`
        UPDATE platform_player_profiles
        SET
          discordUserId = COALESCE(${discordUserId}, discordUserId),
          steamId = COALESCE(${steamId}, steamId),
          inGameName = COALESCE(${inGameName}, inGameName),
          verificationState = COALESCE(${verificationState}, verificationState),
          linkedAt = COALESCE(${linkedAt}, linkedAt),
          lastSeenAt = COALESCE(${lastSeenAt}, lastSeenAt),
          metadataJson = ${stringifyJsonObject(metadata)},
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
      `;
      existing = await findPlayerProfile(db, userId, tenantId);
    }
  }

  return {
    ok: true,
    profile: existing,
  };
}

async function ensurePlatformPlayerIdentity(input = {}, db = prisma) {
  const existingProfile = await findPlayerProfileByExternalIds(db, input);
  const discordIdentity = !existingProfile && input.provider !== 'discord' && input.discordUserId
    ? await findIdentityByProvider(db, 'discord', input.discordUserId)
    : null;
  const steamIdentity = !existingProfile && input.provider !== 'steam' && input.steamId
    ? await findIdentityByProvider(db, 'steam', input.steamId)
    : null;
  const preferredUserId = existingProfile?.userId || discordIdentity?.userId || steamIdentity?.userId || null;
  const identity = await ensurePlatformUserIdentity({
    provider: input.provider,
    providerUserId: input.providerUserId,
    preferredUserId,
    email: input.email,
    providerEmail: input.providerEmail,
    displayName: input.displayName,
    locale: input.locale,
    tenantId: input.tenantId,
    role: input.role || 'player',
    membershipType: input.membershipType || (input.tenantId ? 'tenant' : 'player'),
    verifiedAt: input.verifiedAt,
    avatarUrl: input.avatarUrl,
    userMetadata: input.userMetadata,
    identityMetadata: input.identityMetadata,
    membershipMetadata: input.membershipMetadata,
  }, db);
  if (!identity?.ok || !identity.user?.id) {
    return identity;
  }
  const profile = await upsertPlatformPlayerProfile({
    userId: identity.user.id,
    tenantId: input.tenantId,
    discordUserId: input.discordUserId || (input.provider === 'discord' ? input.providerUserId : null),
    steamId: input.steamId || (input.provider === 'steam' ? input.providerUserId : null),
    inGameName: input.inGameName,
    verificationState: input.verificationState,
    linkedAt: input.linkedAt,
    lastSeenAt: input.lastSeenAt,
    metadata: input.profileMetadata,
  }, db);
  return {
    ...identity,
    profile: profile?.profile || null,
  };
}

async function getIdentitySummaryForPreviewAccount(account = {}, db = prisma) {
  const email = normalizeEmail(account.email);
  const previewAccountId = trimText(account.id, 160);
  if (!email && !previewAccountId) return null;
  await ensurePlatformIdentityTables(db);
  const user = email ? await findUserByPrimaryEmail(db, email) : null;
  if (!user) return null;
  return {
    user,
    identities: await listIdentitiesForUser(db, user.id),
    memberships: await listMembershipsForUser(db, user.id),
    previewAccountId: previewAccountId || null,
  };
}

async function getPlatformUserIdentitySummary(input = {}, db = prisma) {
  const userId = trimText(input.userId || input.platformUserId, 160);
  const email = normalizeEmail(input.email || input.primaryEmail);
  const tenantId = trimText(input.tenantId, 160) || null;
  const discordUserId = trimText(input.discordUserId, 200) || null;
  const steamId = trimText(input.steamId, 200) || null;

  await ensurePlatformIdentityTables(db);

  let user = null;
  if (userId) {
    user = await findUserById(db, userId);
  }
  if (!user && email) {
    user = await findUserByPrimaryEmail(db, email);
  }
  if (!user && discordUserId) {
    const discordIdentity = await findIdentityByProvider(db, 'discord', discordUserId);
    user = discordIdentity?.userId ? await findUserById(db, discordIdentity.userId) : null;
  }
  if (!user && steamId) {
    const steamIdentity = await findIdentityByProvider(db, 'steam', steamId);
    user = steamIdentity?.userId ? await findUserById(db, steamIdentity.userId) : null;
  }

  if (!user) {
    return {
      ok: false,
      reason: 'user-not-found',
      user: null,
      identities: [],
      memberships: [],
      profile: null,
      identitySummary: buildLinkedAccountSummary({
        user: null,
        profile: null,
        identities: [],
        memberships: [],
        tenantId,
        legacySteamLink: input.legacySteamLink || null,
        fallbackEmail: email || input.fallbackEmail || null,
        fallbackDiscordUserId: discordUserId || input.fallbackDiscordUserId || null,
      }),
    };
  }

  const [identities, memberships] = await Promise.all([
    listIdentitiesForUser(db, user.id),
    listMembershipsForUser(db, user.id),
  ]);
  const profile = tenantId
    ? await findPlayerProfile(db, user.id, tenantId)
    : await findLatestPlayerProfileForUser(db, user.id);

  return {
    ok: true,
    user,
    identities,
    memberships,
    profile,
    identitySummary: buildLinkedAccountSummary({
      user,
      profile,
      identities,
      memberships,
      tenantId,
      legacySteamLink: input.legacySteamLink || null,
      fallbackEmail: email || input.fallbackEmail || null,
      fallbackDiscordUserId: discordUserId || input.fallbackDiscordUserId || null,
    }),
  };
}

async function clearPlatformPlayerSteamLink(input = {}, db = prisma) {
  const userId = trimText(input.userId, 160) || null;
  const tenantId = trimText(input.tenantId, 160) || null;
  const discordUserId = trimText(input.discordUserId, 200) || null;
  const steamId = trimText(input.steamId, 200) || null;

  await ensurePlatformIdentityTables(db);

  let profile = null;
  if (userId) {
    profile = tenantId
      ? await findPlayerProfile(db, userId, tenantId)
      : await findLatestPlayerProfileForUser(db, userId);
  }
  if (!profile) {
    profile = await findPlayerProfileByExternalIds(db, {
      tenantId,
      discordUserId,
      steamId,
    });
  }
  if (!profile?.id) {
    return { ok: false, reason: 'player-profile-not-found' };
  }

  const delegates = getPlatformIdentityDelegates(db);
  const nextVerificationState = trimText(profile.discordUserId, 200) ? 'discord_verified' : 'unverified';

  if (delegates) {
    profile = normalizePlayerProfileRow(await delegates.profiles.update({
      where: { id: profile.id },
      data: {
        steamId: null,
        verificationState: nextVerificationState,
      },
    }));
  } else {
    await db.$executeRaw`
      UPDATE platform_player_profiles
      SET
        steamId = ${null},
        verificationState = ${nextVerificationState},
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${profile.id}
    `;
    profile = await findPlayerProfile(db, profile.userId, profile.tenantId);
  }

  const summary = await getPlatformUserIdentitySummary({
    userId: profile.userId,
    tenantId: profile.tenantId,
    discordUserId: profile.discordUserId,
    steamId: null,
  }, db);

  return {
    ok: true,
    profile,
    identitySummary: summary?.identitySummary || null,
  };
}

async function issuePasswordResetToken(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: 'invalid-email' };
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  const rawToken = createRawToken('rst');
  const tokenHash = sha256(rawToken);
  const tokenPrefix = rawToken.split('.')[0];
  const ttlMinutes = Math.max(5, Math.min(24 * 60, Number(input.ttlMinutes || 30) || 30));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const rowId = createId('rst');
  if (delegates) {
    await delegates.passwordResetTokens.create({
      data: {
        id: rowId,
        userId: trimText(input.userId, 160) || null,
        previewAccountId: trimText(input.previewAccountId, 160) || null,
        email,
        tokenPrefix,
        tokenHash,
        expiresAt: toDateValue(expiresAt),
        consumedAt: null,
        metadataJson: stringifyJsonObject(input.metadata),
      },
    });
  } else {
    await db.$executeRaw`
      INSERT INTO platform_password_reset_tokens (
        id, userId, previewAccountId, email, tokenPrefix, tokenHash, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${rowId},
        ${trimText(input.userId, 160) || null},
        ${trimText(input.previewAccountId, 160) || null},
        ${email},
        ${tokenPrefix},
        ${tokenHash},
        ${expiresAt},
        ${null},
        ${stringifyJsonObject(input.metadata)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  }
  return {
    ok: true,
    rawToken,
    token: {
      id: rowId,
      email,
      tokenPrefix,
      expiresAt,
    },
  };
}

async function issueEmailVerificationToken(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: 'invalid-email' };
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  const rawToken = createRawToken('vfy');
  const tokenHash = sha256(rawToken);
  const tokenPrefix = rawToken.split('.')[0];
  const ttlMinutes = Math.max(5, Math.min(7 * 24 * 60, Number(input.ttlMinutes || 60) || 60));
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const rowId = createId('vfy');
  if (delegates) {
    await delegates.verificationTokens.create({
      data: {
        id: rowId,
        userId: trimText(input.userId, 160) || null,
        previewAccountId: trimText(input.previewAccountId, 160) || null,
        email,
        purpose: 'email_verification',
        tokenType: 'email_verification',
        tokenPrefix,
        tokenHash,
        target: email,
        expiresAt: toDateValue(expiresAt),
        consumedAt: null,
        metadataJson: stringifyJsonObject(input.metadata),
      },
    });
  } else {
    await db.$executeRaw`
      INSERT INTO platform_verification_tokens (
        id, userId, previewAccountId, email, purpose, tokenType, tokenPrefix, tokenHash, target, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${rowId},
        ${trimText(input.userId, 160) || null},
        ${trimText(input.previewAccountId, 160) || null},
        ${email},
        ${'email_verification'},
        ${'email_verification'},
        ${tokenPrefix},
        ${tokenHash},
        ${email},
        ${expiresAt},
        ${null},
        ${stringifyJsonObject(input.metadata)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  }
  return {
    ok: true,
    rawToken,
    token: {
      id: rowId,
      email,
      purpose: 'email_verification',
      tokenPrefix,
      expiresAt,
    },
  };
}

async function findPasswordResetTokenByHash(db, tokenHash, email = null) {
  const normalizedHash = trimText(tokenHash, 120);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedHash) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.passwordResetTokens.findFirst({
      where: {
        tokenHash: normalizedHash,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return normalizeTokenRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT id, userId, previewAccountId, email, tokenPrefix, tokenHash, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
    FROM platform_password_reset_tokens
    WHERE tokenHash = ${normalizedHash}
      AND (${normalizedEmail} IS NULL OR email = ${normalizedEmail})
    ORDER BY createdAt DESC
    LIMIT 1
  `;
  return normalizeTokenRow(Array.isArray(rows) ? rows[0] : null);
}

async function findVerificationTokenByHash(db, tokenHash, purpose = 'email_verification', email = null) {
  const normalizedHash = trimText(tokenHash, 120);
  const normalizedPurpose = trimText(purpose, 80) || 'email_verification';
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedHash) return null;
  await ensurePlatformIdentityTables(db);
  const delegates = getPlatformIdentityDelegates(db);
  if (delegates) {
    const row = await delegates.verificationTokens.findFirst({
      where: {
        tokenHash: normalizedHash,
        purpose: normalizedPurpose,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return normalizeTokenRow(row);
  }
  const rows = await db.$queryRaw`
    SELECT id, userId, previewAccountId, email, purpose, tokenPrefix, tokenHash, expiresAt, consumedAt, metadataJson, createdAt, updatedAt
    FROM platform_verification_tokens
    WHERE tokenHash = ${normalizedHash}
      AND purpose = ${normalizedPurpose}
      AND (${normalizedEmail} IS NULL OR email = ${normalizedEmail})
    ORDER BY createdAt DESC
    LIMIT 1
  `;
  return normalizeTokenRow(Array.isArray(rows) ? rows[0] : null);
}

function validateConsumableToken(tokenRow, now = new Date()) {
  if (!tokenRow) return { ok: false, reason: 'token-not-found' };
  if (tokenRow.consumedAt) return { ok: false, reason: 'token-already-used' };
  const expiresAt = tokenRow.expiresAt ? new Date(tokenRow.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'token-expired' };
  }
  return { ok: true };
}

async function completePasswordReset(input = {}, db = prisma) {
  const rawToken = trimText(input.token || input.rawToken, 512);
  const email = normalizeEmail(input.email);
  if (!rawToken) return { ok: false, reason: 'token-required' };
  const delegates = getPlatformIdentityDelegates(db);
  const token = await findPasswordResetTokenByHash(db, sha256(rawToken), email);
  const tokenCheck = validateConsumableToken(token);
  if (!tokenCheck.ok) return tokenCheck;
  const consumedAt = nowIso();
  if (delegates) {
    await delegates.passwordResetTokens.update({
      where: { id: token.id },
      data: { consumedAt: toDateValue(consumedAt) },
    });
  } else {
    await db.$executeRaw`
      UPDATE platform_password_reset_tokens
      SET
        consumedAt = ${consumedAt},
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${token.id}
    `;
  }
  return {
    ok: true,
    token: {
      ...token,
      consumedAt,
    },
  };
}

async function completeEmailVerification(input = {}, db = prisma) {
  const rawToken = trimText(input.token || input.rawToken, 512);
  const email = normalizeEmail(input.email);
  if (!rawToken) return { ok: false, reason: 'token-required' };
  const delegates = getPlatformIdentityDelegates(db);
  const token = await findVerificationTokenByHash(db, sha256(rawToken), 'email_verification', email);
  const tokenCheck = validateConsumableToken(token);
  if (!tokenCheck.ok) return tokenCheck;
  const consumedAt = nowIso();
  if (delegates) {
    await delegates.verificationTokens.update({
      where: { id: token.id },
      data: { consumedAt: toDateValue(consumedAt) },
    });
  } else {
    await db.$executeRaw`
      UPDATE platform_verification_tokens
      SET
        consumedAt = ${consumedAt},
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${token.id}
    `;
  }
  if (token.userId || token.email) {
    if (delegates) {
      if (token.userId && token.email) {
        await delegates.users.updateMany({
          where: {
            id: token.userId,
            primaryEmail: null,
          },
          data: {
            primaryEmail: token.email,
          },
        });
      }
      await delegates.identities.updateMany({
        where: {
          verifiedAt: null,
          OR: [
            ...(token.userId ? [{ userId: token.userId }] : []),
            ...(token.email ? [{ providerEmail: token.email }] : []),
          ],
          AND: [
            {
              OR: [
                { provider: 'email_preview' },
                ...(token.email ? [{ providerEmail: token.email }] : []),
              ],
            },
          ],
        },
        data: {
          verifiedAt: toDateValue(consumedAt),
        },
      });
    } else {
      await db.$executeRaw`
        UPDATE platform_users
        SET
          primaryEmail = COALESCE(primaryEmail, ${token.email || null}),
          updatedAt = CURRENT_TIMESTAMP
        WHERE (${token.userId || null} IS NOT NULL AND id = ${token.userId || null})
           OR (${token.userId || null} IS NULL AND primaryEmail = ${token.email || null})
      `;
      await db.$executeRaw`
        UPDATE platform_user_identities
        SET
          verifiedAt = COALESCE(verifiedAt, ${consumedAt}),
          updatedAt = CURRENT_TIMESTAMP
        WHERE (
          (${token.userId || null} IS NOT NULL AND userId = ${token.userId || null})
          OR (${token.email || null} IS NOT NULL AND providerEmail = ${token.email || null})
        )
          AND (provider = 'email_preview' OR providerEmail = ${token.email || null})
      `;
    }
  }
  return {
    ok: true,
    verification: {
      ...token,
      consumedAt,
    },
  };
}

module.exports = {
  buildLinkedAccountSummary,
  clearPlatformPlayerSteamLink,
  completeEmailVerification,
  completePasswordReset,
  ensurePlatformIdentityTables,
  ensurePlatformPlayerIdentity,
  ensurePlatformUserPasswordColumn,
  ensurePlatformUserIdentity,
  getPlatformUserIdentitySummary,
  getPlatformUserPasswordColumnState,
  getIdentitySummaryForPreviewAccount,
  invalidateIdentitySchemaCaches,
  issueEmailVerificationToken,
  issuePasswordResetToken,
  upsertPlatformPlayerProfile,
};
