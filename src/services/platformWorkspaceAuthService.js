'use strict';

const crypto = require('node:crypto');

const { prisma } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const {
  ensurePlatformUserPasswordColumn,
  ensurePlatformUserIdentity,
  issueEmailVerificationToken,
} = require('./platformIdentityService');
const {
  createSubscription,
  createTenant,
} = require('./platformService');
const {
  getPackageById,
} = require('../domain/billing/packageCatalogService');
const {
  buildTenantActorAccessSummary,
  getTenantRoleOrder,
  normalizeTenantMembershipStatus,
  normalizeTenantRole,
} = require('./platformTenantAccessService');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeEmail(value) {
  return trimText(value, 200).toLowerCase();
}

function normalizeLocale(value) {
  const locale = trimText(value, 16).toLowerCase();
  return ['th', 'en'].includes(locale) ? locale : 'en';
}

function normalizePackageId(value) {
  const requested = trimText(value, 120).toUpperCase();
  if (requested && getPackageById(requested)) return requested;
  return 'BOT_LOG_DELIVERY';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'scum-community';
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

function createRawToken(prefix = 'tok') {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}.${crypto.randomBytes(20).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toSqlTimestampValue(value, env = process.env) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const runtime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  return runtime.isServerEngine ? parsed : parsed.toISOString();
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordHash(password, passwordHash) {
  const text = trimText(passwordHash, 512);
  if (!text.startsWith('scrypt$')) return false;
  const [, salt, digest] = text.split('$');
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = crypto.scryptSync(String(password || ''), salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
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
    locale: normalizeLocale(getRowValue(row, 'locale')),
    status: trimText(getRowValue(row, 'status'), 40) || 'active',
    passwordHash: trimText(getRowValue(row, 'passwordHash'), 512) || null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

function normalizeMembershipRow(row) {
  if (!row) return null;
  const role = normalizeTenantRole(getRowValue(row, 'role'));
  const status = normalizeTenantMembershipStatus(getRowValue(row, 'status'));
  const access = buildTenantActorAccessSummary({
    role,
    status,
  });
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    tenantId: trimText(getRowValue(row, 'tenantId'), 160) || null,
    membershipType: trimText(getRowValue(row, 'membershipType'), 80) || 'tenant',
    role,
    status,
    isPrimary: getRowValue(row, 'isPrimary') === true || Number(getRowValue(row, 'isPrimary')) === 1,
    acceptedAt: getRowValue(row, 'acceptedAt') ? new Date(getRowValue(row, 'acceptedAt')).toISOString() : null,
    revokedAt: getRowValue(row, 'revokedAt') ? new Date(getRowValue(row, 'revokedAt')).toISOString() : null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
    access,
  };
}

function normalizeProfileRow(row) {
  if (!row) return null;
  return {
    id: trimText(getRowValue(row, 'id'), 160) || null,
    userId: trimText(getRowValue(row, 'userId'), 160) || null,
    tenantId: trimText(getRowValue(row, 'tenantId'), 160) || null,
    discordUserId: trimText(getRowValue(row, 'discordUserId'), 200) || null,
    steamId: trimText(getRowValue(row, 'steamId'), 200) || null,
    inGameName: trimText(getRowValue(row, 'inGameName'), 200) || null,
    verificationState: trimText(getRowValue(row, 'verificationState'), 80) || 'unverified',
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
    email: normalizeEmail(getRowValue(row, 'email')),
    purpose: trimText(getRowValue(row, 'purpose'), 80) || null,
    tokenPrefix: trimText(getRowValue(row, 'tokenPrefix'), 120) || null,
    metadata: parseJsonObject(getRowValue(row, 'metadataJson')),
    expiresAt: getRowValue(row, 'expiresAt') ? new Date(getRowValue(row, 'expiresAt')).toISOString() : null,
    consumedAt: getRowValue(row, 'consumedAt') ? new Date(getRowValue(row, 'consumedAt')).toISOString() : null,
    createdAt: getRowValue(row, 'createdAt') ? new Date(getRowValue(row, 'createdAt')).toISOString() : null,
    updatedAt: getRowValue(row, 'updatedAt') ? new Date(getRowValue(row, 'updatedAt')).toISOString() : null,
  };
}

async function ensurePasswordColumn(db = prisma) {
  await ensurePlatformUserPasswordColumn(db, { env: process.env });
}

async function findPlatformUserByEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT id, "primaryEmail", "displayName", locale, status, "metadataJson", "passwordHash", "createdAt", "updatedAt"
    FROM platform_users
    WHERE "primaryEmail" = ${normalizedEmail}
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function findPlatformUserById(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return null;
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT id, "primaryEmail", "displayName", locale, status, "metadataJson", "passwordHash", "createdAt", "updatedAt"
    FROM platform_users
    WHERE id = ${normalizedUserId}
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function findPlatformUserByIdentityEmail(db, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT u.id, u."primaryEmail", u."displayName", u.locale, u.status, u."metadataJson", u."passwordHash", u."createdAt", u."updatedAt"
    FROM platform_user_identities i
    INNER JOIN platform_users u ON u.id = i."userId"
    WHERE i."providerEmail" = ${normalizedEmail}
    ORDER BY i."linkedAt" DESC
    LIMIT 1
  `;
  return normalizeUserRow(Array.isArray(rows) ? rows[0] : null);
}

async function listPlatformMembershipsForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return [];
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT id, "userId", "tenantId", "membershipType", role, status, "isPrimary", "acceptedAt", "revokedAt", "metadataJson", "createdAt", "updatedAt"
    FROM platform_memberships
    WHERE "userId" = ${normalizedUserId}
    ORDER BY "isPrimary" DESC, "updatedAt" DESC
  `;
  return Array.isArray(rows) ? rows.map(normalizeMembershipRow).filter(Boolean) : [];
}

async function findLatestPlayerProfileForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return null;
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT id, "userId", "tenantId", "discordUserId", "steamId", "inGameName", "verificationState", "metadataJson", "createdAt", "updatedAt"
    FROM platform_player_profiles
    WHERE "userId" = ${normalizedUserId}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  return normalizeProfileRow(Array.isArray(rows) ? rows[0] : null);
}

async function findDiscordIdentityForUser(db, userId) {
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedUserId) return null;
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT "providerUserId"
    FROM platform_user_identities
    WHERE "userId" = ${normalizedUserId}
      AND provider = ${'discord'}
    ORDER BY "linkedAt" DESC
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  return trimText(row?.providerUserId, 200) || null;
}

function pickPrimaryTenantMembership(memberships = []) {
  const tenantMemberships = (Array.isArray(memberships) ? memberships : [])
    .filter((row) => row?.membershipType === 'tenant' && row?.tenantId && normalizeTenantMembershipStatus(row?.status) === 'active');
  if (!tenantMemberships.length) return null;
  return tenantMemberships
    .slice()
    .sort((left, right) => {
      if (Boolean(left.isPrimary) !== Boolean(right.isPrimary)) {
        return Boolean(right.isPrimary) - Boolean(left.isPrimary);
      }
      const leftRole = getTenantRoleOrder(left.role);
      const rightRole = getTenantRoleOrder(right.role);
      if (leftRole !== rightRole) return rightRole - leftRole;
      return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
    })[0];
}

function findTenantMembershipForTenant(memberships = [], tenantId) {
  const normalizedTenantId = trimText(tenantId, 160);
  if (!normalizedTenantId) return null;
  const tenantMemberships = (Array.isArray(memberships) ? memberships : [])
    .filter((row) => row?.membershipType === 'tenant' && trimText(row?.tenantId, 160) === normalizedTenantId);
  if (!tenantMemberships.length) return null;
  return tenantMemberships
    .slice()
    .sort((left, right) => {
      if (normalizeTenantMembershipStatus(left?.status) === 'active' && normalizeTenantMembershipStatus(right?.status) !== 'active') {
        return -1;
      }
      if (normalizeTenantMembershipStatus(left?.status) !== 'active' && normalizeTenantMembershipStatus(right?.status) === 'active') {
        return 1;
      }
      if (Boolean(left.isPrimary) !== Boolean(right.isPrimary)) {
        return Boolean(right.isPrimary) - Boolean(left.isPrimary);
      }
      const leftRole = getTenantRoleOrder(left.role);
      const rightRole = getTenantRoleOrder(right.role);
      if (leftRole !== rightRole) return rightRole - leftRole;
      return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
    })[0];
}

async function resolveTenantSessionAccessContext(input = {}, db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  const userId = trimText(input.userId, 160);
  const email = normalizeEmail(input.email);
  if (!tenantId) return { ok: false, reason: 'tenant-session-tenant-required' };
  if (!userId && !email) return { ok: false, reason: 'tenant-session-user-required' };

  const user = userId
    ? await findPlatformUserById(db, userId)
    : await findPlatformUserByEmail(db, email)
      || await findPlatformUserByIdentityEmail(db, email);
  if (!user?.id) return { ok: false, reason: 'tenant-user-not-found' };
  if (trimText(user.status, 40).toLowerCase() !== 'active') {
    return { ok: false, reason: 'tenant-user-inactive', user };
  }

  const memberships = await listPlatformMembershipsForUser(db, user.id);
  const membership = findTenantMembershipForTenant(memberships, tenantId);
  if (!membership?.tenantId) {
    return { ok: false, reason: 'tenant-membership-required', user, memberships };
  }
  if (normalizeTenantMembershipStatus(membership.status) !== 'active') {
    return { ok: false, reason: 'tenant-membership-inactive', user, membership, memberships };
  }

  return {
    ok: true,
    user,
    memberships,
    membership,
    authContext: {
      user: user.primaryEmail || user.displayName || membership.tenantId,
      userId: user.id,
      role: membership.role || 'viewer',
      tenantId: membership.tenantId,
      tenantMembershipId: membership.id || null,
      tenantMembershipType: membership.membershipType || 'tenant',
      tenantMembershipStatus: membership.status || 'active',
      authMethod: trimText(input.authMethod, 80) || 'platform-user-password',
    },
  };
}

async function setPlatformUserPassword(input = {}, db = prisma) {
  const userId = trimText(input.userId, 160);
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  if (!userId && !email) return { ok: false, reason: 'user-required' };
  if (password.length < 8) return { ok: false, reason: 'weak-password' };
  await ensurePasswordColumn(db);
  const passwordHash = createPasswordHash(password);
  await db.$executeRaw`
    UPDATE platform_users
    SET
      "passwordHash" = ${passwordHash},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE (CAST(${userId || null} AS TEXT) IS NOT NULL AND id = CAST(${userId || null} AS TEXT))
       OR (CAST(${userId || null} AS TEXT) IS NULL AND "primaryEmail" = CAST(${email || null} AS TEXT))
  `;
  return { ok: true };
}

async function issuePurposeToken(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  const purpose = trimText(input.purpose, 80).toLowerCase();
  if (!purpose) return { ok: false, reason: 'purpose-required' };
  await ensurePasswordColumn(db);
  const rawToken = createRawToken(purpose.slice(0, 8) || 'token');
  const tokenHash = sha256(rawToken);
  const tokenPrefix = rawToken.split('.')[0];
  const ttlMinutes = Math.max(5, Math.min(7 * 24 * 60, Number(input.ttlMinutes || 60) || 60));
  const expiresAtValue = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const expiresAt = expiresAtValue.toISOString();
  const rowId = createId(purpose);
  await db.$executeRaw`
    INSERT INTO platform_verification_tokens (
      id, "userId", "previewAccountId", email, purpose, "tokenType", "tokenPrefix", "tokenHash", target, "expiresAt", "consumedAt", "metadataJson", "createdAt", "updatedAt"
    )
    VALUES (
      ${rowId},
      ${trimText(input.userId, 160) || null},
      ${trimText(input.previewAccountId, 160) || null},
      ${email || null},
      ${purpose},
      ${purpose},
      ${tokenPrefix},
      ${tokenHash},
      ${email || null},
      ${toSqlTimestampValue(expiresAtValue)},
      ${null},
      ${JSON.stringify(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  return {
    ok: true,
    rawToken,
    token: {
      id: rowId,
      userId: trimText(input.userId, 160) || null,
      email: email || null,
      purpose,
      tokenPrefix,
      expiresAt,
    },
  };
}

async function consumePurposeToken(input = {}, db = prisma) {
  const rawToken = trimText(input.token || input.rawToken, 512);
  const purpose = trimText(input.purpose, 80).toLowerCase();
  const email = normalizeEmail(input.email);
  if (!rawToken) return { ok: false, reason: 'token-required' };
  if (!purpose) return { ok: false, reason: 'purpose-required' };
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT id, "userId", "previewAccountId", email, purpose, "tokenPrefix", "tokenHash", "expiresAt", "consumedAt", "metadataJson", "createdAt", "updatedAt"
    FROM platform_verification_tokens
    WHERE "tokenHash" = ${sha256(rawToken)}
      AND purpose = ${purpose}
      AND (CAST(${email || null} AS TEXT) IS NULL OR email = CAST(${email || null} AS TEXT))
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const token = normalizeTokenRow(Array.isArray(rows) ? rows[0] : null);
  if (!token) return { ok: false, reason: 'token-not-found' };
  if (token.consumedAt) return { ok: false, reason: 'token-already-used' };
  const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'token-expired' };
  }
  const consumedAtValue = new Date();
  const consumedAt = consumedAtValue.toISOString();
  await db.$executeRaw`
    UPDATE platform_verification_tokens
    SET
      "consumedAt" = ${toSqlTimestampValue(consumedAtValue)},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${token.id}
  `;
  return {
    ok: true,
    token: {
      ...token,
      consumedAt,
    },
  };
}

async function findPurposeTokenPreview(input = {}, db = prisma) {
  const rawToken = trimText(input.token || input.rawToken, 512);
  const purpose = trimText(input.purpose, 80).toLowerCase();
  const email = normalizeEmail(input.email);
  if (!rawToken) return { ok: false, reason: 'token-required' };
  if (!purpose) return { ok: false, reason: 'purpose-required' };
  await ensurePasswordColumn(db);
  const rows = await db.$queryRaw`
    SELECT id, "userId", "previewAccountId", email, purpose, "tokenPrefix", "tokenHash", "expiresAt", "consumedAt", "metadataJson", "createdAt", "updatedAt"
    FROM platform_verification_tokens
    WHERE "tokenHash" = ${sha256(rawToken)}
      AND purpose = ${purpose}
      AND (CAST(${email || null} AS TEXT) IS NULL OR email = CAST(${email || null} AS TEXT))
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const token = normalizeTokenRow(Array.isArray(rows) ? rows[0] : null);
  if (!token) return { ok: false, reason: 'token-not-found' };
  if (token.consumedAt) return { ok: false, reason: 'token-already-used' };
  const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'token-expired' };
  }
  return {
    ok: true,
    token,
  };
}

async function acceptTenantStaffInvite(input = {}, db = prisma) {
  const requestedEmail = normalizeEmail(input.email);
  const password = String(input.password || '');
  const displayName = trimText(input.displayName, 200);
  const requestedLocale = trimText(input.locale, 16) ? normalizeLocale(input.locale) : '';
  const transactionRunner = typeof db.$transaction === 'function'
    ? db.$transaction.bind(db)
    : async (callback) => callback(db);

  return transactionRunner(async (tx) => {
    const preview = await findPurposeTokenPreview({
      token: input.token || input.inviteToken,
      purpose: 'tenant_staff_invite',
      email: requestedEmail || undefined,
    }, tx);
    if (!preview?.ok || !preview?.token) return preview;

    const inviteToken = preview.token;
    const inviteEmail = requestedEmail || inviteToken.email;
    const tenantId = trimText(input.tenantId || inviteToken.metadata?.tenantId, 160);
    const membershipId = trimText(input.membershipId || inviteToken.metadata?.membershipId, 160);
    const inviteUserId = trimText(inviteToken.userId || inviteToken.metadata?.userId, 160);

    if (!tenantId || !membershipId) {
      return { ok: false, reason: 'tenant-staff-invite-invalid' };
    }

    const user = inviteUserId
      ? await findPlatformUserById(tx, inviteUserId)
      : await findPlatformUserByEmail(tx, inviteEmail)
        || await findPlatformUserByIdentityEmail(tx, inviteEmail);
    if (!user?.id) return { ok: false, reason: 'tenant-user-not-found' };
    if (trimText(user.status, 40).toLowerCase() !== 'active') {
      return { ok: false, reason: 'tenant-user-inactive' };
    }

    if (password) {
      if (password.length < 8) return { ok: false, reason: 'weak-password' };
      const passwordResult = await setPlatformUserPassword({
        userId: user.id,
        password,
      }, tx);
      if (!passwordResult?.ok) return passwordResult;
    } else if (!user.passwordHash) {
      return { ok: false, reason: 'password-required' };
    }

    if (displayName || requestedLocale) {
      await tx.$executeRaw`
        UPDATE platform_users
        SET
          "displayName" = COALESCE(CAST(${displayName || null} AS TEXT), "displayName"),
          locale = COALESCE(CAST(${requestedLocale || null} AS TEXT), locale),
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `;
    }

    const memberships = await listPlatformMembershipsForUser(tx, user.id);
    const membership = memberships.find((row) => row?.id === membershipId)
      || findTenantMembershipForTenant(memberships, tenantId);
    if (!membership?.id || membership.membershipType !== 'tenant' || membership.tenantId !== tenantId) {
      return { ok: false, reason: 'tenant-membership-required' };
    }

    const membershipStatus = normalizeTenantMembershipStatus(membership.status);
    if (membershipStatus === 'disabled' || membershipStatus === 'revoked') {
      return { ok: false, reason: 'tenant-membership-inactive' };
    }

    const acceptedAtValue = new Date();
    const consumedAtValue = new Date();
    const acceptedAt = acceptedAtValue.toISOString();
    const consumedAt = consumedAtValue.toISOString();
    const updateCount = await tx.$executeRaw`
      UPDATE platform_verification_tokens
      SET
        "consumedAt" = ${toSqlTimestampValue(consumedAtValue)},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${inviteToken.id}
        AND "consumedAt" IS NULL
    `;
    if (!Number(updateCount || 0)) {
      return { ok: false, reason: 'token-already-used' };
    }

    await tx.$executeRaw`
      UPDATE platform_memberships
      SET
        status = ${'active'},
        "acceptedAt" = COALESCE("acceptedAt", ${toSqlTimestampValue(acceptedAtValue)}),
        "revokedAt" = ${null},
        "metadataJson" = ${JSON.stringify({
          ...(membership.metadata || {}),
          source: 'tenant-staff-invite-accept',
          inviteState: 'accepted',
          acceptedAt,
        })},
        "updatedAt" = ${toSqlTimestampValue(acceptedAtValue)}
      WHERE id = ${membership.id}
    `;

    const resolved = await resolveTenantSessionAccessContext({
      tenantId,
      userId: user.id,
      email: inviteEmail,
      authMethod: 'tenant-staff-invite',
    }, tx);
    if (!resolved?.ok || !resolved?.membership?.tenantId) {
      return { ok: false, reason: resolved?.reason || 'tenant-membership-required' };
    }

    return {
      ok: true,
      token: {
        ...inviteToken,
        consumedAt,
      },
      user: resolved.user,
      membership: resolved.membership,
      memberships: resolved.memberships,
    };
  });
}

async function registerTenantOwnerAccount(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  const displayName = trimText(input.displayName || input.ownerName, 180) || trimText(email.split('@')[0], 120);
  const communityName = trimText(input.communityName || input.serverName, 180);
  const locale = normalizeLocale(input.locale);
  const packageId = normalizePackageId(input.packageId);

  if (!validateEmail(email)) return { ok: false, reason: 'invalid-email' };
  if (password.length < 8) return { ok: false, reason: 'weak-password' };
  if (!communityName) return { ok: false, reason: 'community-required' };

  const existingUser = await findPlatformUserByEmail(db, email)
    || await findPlatformUserByIdentityEmail(db, email);
  if (existingUser) {
    return { ok: false, reason: 'email-exists' };
  }

  const baseSlug = slugify(communityName);
  let tenantResult = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    tenantResult = await createTenant(
      {
        id: createId('tenant'),
        slug: `${baseSlug}${suffix}`,
        name: communityName,
        type: 'trial',
        status: 'trialing',
        locale,
        ownerName: displayName,
        ownerEmail: email,
        metadata: {
          source: 'public-signup',
          packageId,
          previewMode: true,
        },
      },
      'public-signup',
    );
    if (tenantResult?.ok) break;
    if (tenantResult?.reason !== 'tenant-slug-conflict') break;
  }

  if (!tenantResult?.ok || !tenantResult?.tenant?.id) {
    return { ok: false, reason: tenantResult?.reason || 'tenant-create-failed' };
  }

  const subscriptionResult = await createSubscription(
    {
      tenantId: tenantResult.tenant.id,
      planId: 'trial-14d',
      packageId,
      status: 'trialing',
      billingCycle: 'trial',
      amountCents: 0,
      intervalDays: 14,
      metadata: {
        source: 'public-signup',
        packageId,
        previewMode: true,
      },
    },
    'public-signup',
  );

  const identity = await ensurePlatformUserIdentity(
    {
      provider: 'email',
      providerUserId: email,
      email,
      displayName,
      locale,
      tenantId: tenantResult.tenant.id,
      role: 'owner',
      membershipType: 'tenant',
      identityMetadata: {
        source: 'public-signup',
      },
      membershipMetadata: {
        source: 'public-signup',
        subscriptionId: subscriptionResult?.subscription?.id || null,
      },
      verifiedAt: null,
    },
    db,
  );

  if (!identity?.ok || !identity?.user?.id) {
    return { ok: false, reason: 'platform-user-create-failed' };
  }

  const passwordResult = await setPlatformUserPassword({
    userId: identity.user.id,
    password,
  }, db);
  if (!passwordResult?.ok) return passwordResult;

  await issueEmailVerificationToken({
    email,
    userId: identity.user.id,
    metadata: {
      source: 'public-signup',
      tenantId: tenantResult.tenant.id,
    },
  }, db).catch(() => null);

  const bootstrap = await issuePurposeToken({
    userId: identity.user.id,
    email,
    purpose: 'tenant_bootstrap',
    ttlMinutes: 20,
    metadata: {
      source: 'public-signup',
      tenantId: tenantResult.tenant.id,
      role: 'owner',
    },
  }, db);

  return {
    ok: true,
    user: identity.user,
    tenant: tenantResult.tenant,
    subscription: subscriptionResult?.subscription || null,
    bootstrapToken: bootstrap?.rawToken || null,
  };
}

async function findLegacyPreviewAccountByEmail(email, db = prisma) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  try {
    return await db.platformPreviewAccount.findUnique({
      where: { email: normalizedEmail },
    });
  } catch {
    return null;
  }
}

async function authenticateTenantUser(input = {}, db = prisma) {
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  if (!validateEmail(email) || !password) {
    return { ok: false, reason: 'invalid-credentials' };
  }

  let user = await findPlatformUserByEmail(db, email)
    || await findPlatformUserByIdentityEmail(db, email);

  if (!user || !user.passwordHash) {
    const previewAccount = await findLegacyPreviewAccountByEmail(email, db);
    if (previewAccount && verifyPasswordHash(password, previewAccount.passwordHash)) {
      const imported = await ensurePlatformUserIdentity({
        provider: 'email_preview',
        providerUserId: previewAccount.id || email,
        email,
        displayName: previewAccount.displayName || email,
        locale: previewAccount.locale || 'en',
        tenantId: previewAccount.tenantId || null,
        role: 'owner',
        membershipType: previewAccount.tenantId ? 'tenant' : 'preview',
        verifiedAt: String(previewAccount.verificationState || '').trim().toLowerCase() === 'email_verified'
          ? new Date().toISOString()
          : null,
        identityMetadata: {
          source: 'tenant-login-legacy-import',
          previewAccountId: previewAccount.id,
        },
      }, db);
      if (imported?.ok && imported?.user?.id) {
        await setPlatformUserPassword({
          userId: imported.user.id,
          password,
        }, db);
        user = await findPlatformUserByEmail(db, email);
      }
    }
  }

  if (!user || !user.passwordHash || !verifyPasswordHash(password, user.passwordHash)) {
    return { ok: false, reason: 'invalid-credentials' };
  }

  if (trimText(user.status, 40).toLowerCase() !== 'active') {
    return { ok: false, reason: 'tenant-user-inactive' };
  }

  const memberships = await listPlatformMembershipsForUser(db, user.id);
  const membership = pickPrimaryTenantMembership(memberships);
  if (!membership?.tenantId) return { ok: false, reason: 'tenant-membership-required' };
  if (normalizeTenantMembershipStatus(membership.status) !== 'active') {
    return { ok: false, reason: 'tenant-membership-inactive' };
  }

  return {
    ok: true,
    user,
    memberships,
    membership,
  };
}

async function consumeTenantBootstrapToken(input = {}, db = prisma) {
  const consumed = await consumePurposeToken({
    token: input.token,
    purpose: 'tenant_bootstrap',
  }, db);
  if (!consumed?.ok || !consumed?.token) return consumed;
  const resolved = await resolveTenantSessionAccessContext({
    tenantId: trimText(consumed.token.metadata?.tenantId, 160) || null,
    userId: consumed.token.userId,
    email: consumed.token.email,
    authMethod: 'tenant-bootstrap',
  }, db);
  if (!resolved?.ok || !resolved?.membership?.tenantId) {
    return { ok: false, reason: resolved?.reason || 'tenant-membership-required' };
  }
  return {
    ok: true,
    token: consumed.token,
    user: resolved.user,
    membership: resolved.membership,
  };
}

async function requestPlayerMagicLink(input = {}, db = prisma) {
  const exposeDebugToken = String(process.env.PLAYER_MAGIC_LINK_DEBUG_TOKENS || '')
    .trim()
    .toLowerCase() === 'true';
  const email = normalizeEmail(input.email);
  if (!validateEmail(email)) return { ok: false, reason: 'invalid-email' };

  const user = await findPlatformUserByEmail(db, email)
    || await findPlatformUserByIdentityEmail(db, email);
  if (!user?.id) {
    return {
      ok: true,
      requested: false,
      queued: false,
      debugToken: null,
    };
  }

  const profile = await findLatestPlayerProfileForUser(db, user.id);
  const discordUserId = profile?.discordUserId || await findDiscordIdentityForUser(db, user.id);
  if (!discordUserId) {
    return {
      ok: true,
      requested: false,
      queued: false,
      debugToken: null,
    };
  }

  const issued = await issuePurposeToken({
    userId: user.id,
    email,
    purpose: 'player_magic_link',
    ttlMinutes: Math.max(5, Math.min(120, Number(input.ttlMinutes || 20) || 20)),
    metadata: {
      source: 'player-email-magic-link',
      tenantId: profile?.tenantId || null,
      discordUserId,
      profileId: profile?.id || null,
    },
  }, db);

  return {
    ok: true,
    requested: true,
    queued: Boolean(issued?.ok),
    debugToken: exposeDebugToken ? issued?.rawToken || null : null,
  };
}

async function consumePlayerMagicLink(input = {}, db = prisma) {
  const consumed = await consumePurposeToken({
    token: input.token,
    purpose: 'player_magic_link',
    email: input.email,
  }, db);
  if (!consumed?.ok || !consumed?.token) return consumed;

  const user = await findPlatformUserByEmail(db, consumed.token.email)
    || (consumed.token.userId ? await findPlatformUserByIdentityEmail(db, consumed.token.email) : null);
  if (!user?.id) return { ok: false, reason: 'user-not-found' };

  const profile = await findLatestPlayerProfileForUser(db, user.id);
  const discordUserId = trimText(consumed.token.metadata?.discordUserId, 200)
    || profile?.discordUserId
    || await findDiscordIdentityForUser(db, user.id);
  if (!discordUserId) return { ok: false, reason: 'player-discord-link-required' };

  return {
    ok: true,
    token: consumed.token,
    user,
    profile,
    discordUserId,
  };
}

module.exports = {
  acceptTenantStaffInvite,
  authenticateTenantUser,
  consumePlayerMagicLink,
  consumePurposeToken,
  consumeTenantBootstrapToken,
  createPasswordHash,
  issuePurposeToken,
  registerTenantOwnerAccount,
  resolveTenantSessionAccessContext,
  requestPlayerMagicLink,
  setPlatformUserPassword,
  verifyPasswordHash,
};
