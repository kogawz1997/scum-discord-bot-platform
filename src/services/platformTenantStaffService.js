'use strict';

const { prisma } = require('../prisma');
const {
  ensurePlatformIdentityTables,
  ensurePlatformUserIdentity,
} = require('./platformIdentityService');
const {
  buildTenantActorAccessSummary,
  buildTenantStatusOptions,
  canActorManageTenantMembership,
  getAssignableRoleOptions,
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

function parseJsonObject(value) {
  if (value == null || String(value).trim() === '') return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRole(value) {
  return normalizeTenantRole(value);
}

function normalizeStatus(value) {
  return normalizeTenantMembershipStatus(value);
}

function normalizeActorContext(actor) {
  if (actor && typeof actor === 'object' && !Array.isArray(actor)) {
    return {
      id: trimText(actor.id || actor.actor || actor.user, 200) || 'system',
      role: normalizeRole(actor.role || 'viewer'),
      userId: trimText(actor.userId, 160) || null,
      identity: normalizeEmail(actor.email) || trimText(actor.user || actor.actor, 200).toLowerCase() || null,
    };
  }
  const actorId = trimText(actor, 200) || 'system';
  return {
    id: actorId,
    role: 'viewer',
    userId: null,
    identity: actorId.toLowerCase(),
  };
}

function buildMembershipAccess(role, status) {
  return buildTenantActorAccessSummary({
    role,
    status,
  });
}

function buildManagementSummary(row, actorContext, activeOwnerCount) {
  const actor = normalizeActorContext(actorContext);
  const roleOptions = getAssignableRoleOptions(actor.role)
    .filter((candidateRole) => canActorManageTenantMembership({
      actorRole: actor.role,
      actorIdentity: actor.identity,
      targetRole: row.role,
      targetIdentity: row.user.email || row.email || '',
      desiredRole: candidateRole,
      action: 'update',
    }).allowed);
  let statusOptions = buildTenantStatusOptions(row.status);
  const basePolicy = canActorManageTenantMembership({
    actorRole: actor.role,
    actorIdentity: actor.identity,
    targetRole: row.role,
    targetIdentity: row.user.email || row.email || '',
    action: 'update',
  });
  let canManage = basePolicy.allowed;
  let reason = basePolicy.reason || '';

  if (row.role === 'owner' && row.status === 'active' && activeOwnerCount <= 1) {
    canManage = false;
    reason = 'At least one active owner must remain on this tenant.';
    statusOptions = ['active'];
  }

  return {
    canManage,
    reason,
    roleOptions: canManage && roleOptions.length ? roleOptions : [row.role],
    statusOptions: canManage ? statusOptions : [row.status],
  };
}

function normalizeStaffRow(row, options = {}) {
  if (!row) return null;
  const role = normalizeRole(row.role);
  const status = normalizeStatus(row.status);
  const access = buildMembershipAccess(role, status);
  const normalized = {
    membershipId: trimText(row.membershipId || row.id, 160) || null,
    userId: trimText(row.userId, 160) || null,
    tenantId: trimText(row.tenantId, 160) || null,
    membershipType: trimText(row.membershipType, 80) || 'tenant',
    role,
    status,
    isPrimary: row.isPrimary === true || Number(row.isPrimary) === 1,
    invitedAt: toIso(row.invitedAt),
    acceptedAt: toIso(row.acceptedAt),
    revokedAt: toIso(row.revokedAt),
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : parseJsonObject(row.metadataJson),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    user: {
      id: trimText(row.userId || row.user?.id, 160) || null,
      email: normalizeEmail(row.primaryEmail || row.email || row.user?.email) || null,
      displayName: trimText(row.displayName || row.user?.displayName, 200) || null,
      locale: trimText(row.locale || row.user?.locale, 16) || 'en',
      status: trimText(row.userStatus || row.user?.status, 40) || 'active',
    },
    access,
    enabledPermissionKeys: access.enabledPermissionKeys.slice(),
  };
  const management = buildManagementSummary(
    normalized,
    options.actor,
    Number(options.activeOwnerCount || 0),
  );
  return {
    ...normalized,
    management,
  };
}

async function findMembershipRecord(db, membershipId, tenantId, userId = null) {
  const normalizedMembershipId = trimText(membershipId, 160);
  const normalizedTenantId = trimText(tenantId, 160);
  const normalizedUserId = trimText(userId, 160);
  if (!normalizedTenantId) return null;
  const rows = normalizedMembershipId
    ? await db.$queryRaw`
        SELECT
          m.id AS "membershipId",
          m."userId" AS "userId",
          m."tenantId" AS "tenantId",
          m."membershipType" AS "membershipType",
          m.role AS "role",
          m.status AS "status",
          m."isPrimary" AS "isPrimary",
          m."invitedAt" AS "invitedAt",
          m."acceptedAt" AS "acceptedAt",
          m."revokedAt" AS "revokedAt",
          m."metadataJson" AS "metadataJson",
          m."createdAt" AS "createdAt",
          m."updatedAt" AS "updatedAt",
          u."primaryEmail",
          u."displayName",
          u.locale,
          u.status AS "userStatus"
        FROM platform_memberships m
        LEFT JOIN platform_users u ON u.id = m."userId"
        WHERE m.id = ${normalizedMembershipId}
          AND m."tenantId" = ${normalizedTenantId}
        LIMIT 1
      `
    : await db.$queryRaw`
        SELECT
          m.id AS "membershipId",
          m."userId" AS "userId",
          m."tenantId" AS "tenantId",
          m."membershipType" AS "membershipType",
          m.role AS "role",
          m.status AS "status",
          m."isPrimary" AS "isPrimary",
          m."invitedAt" AS "invitedAt",
          m."acceptedAt" AS "acceptedAt",
          m."revokedAt" AS "revokedAt",
          m."metadataJson" AS "metadataJson",
          m."createdAt" AS "createdAt",
          m."updatedAt" AS "updatedAt",
          u."primaryEmail",
          u."displayName",
          u.locale,
          u.status AS "userStatus"
        FROM platform_memberships m
        LEFT JOIN platform_users u ON u.id = m."userId"
        WHERE m."userId" = ${normalizedUserId}
          AND m."tenantId" = ${normalizedTenantId}
          AND m."membershipType" = 'tenant'
        ORDER BY m."updatedAt" DESC
        LIMIT 1
      `;
  return normalizeStaffRow(Array.isArray(rows) ? rows[0] : null);
}

async function countActiveOwners(db, tenantId) {
  const normalizedTenantId = trimText(tenantId, 160);
  if (!normalizedTenantId) return 0;
  const rows = await db.$queryRaw`
    SELECT COUNT(*) AS "count"
    FROM platform_memberships
    WHERE "tenantId" = ${normalizedTenantId}
      AND "membershipType" = 'tenant'
      AND role = ${'owner'}
      AND status = ${'active'}
  `;
  return Math.max(0, Number(Array.isArray(rows) ? rows[0]?.count || 0 : 0) || 0);
}

async function listTenantStaffMemberships(tenantId, options = {}, db = prisma) {
  const normalizedTenantId = trimText(tenantId, 160);
  if (!normalizedTenantId) return [];
  await ensurePlatformIdentityTables(db);
  const limit = Math.max(1, Math.min(500, Number(options.limit || 100) || 100));
  const actor = normalizeActorContext(options.actor || {
    role: options.actorRole,
    email: options.actorEmail,
    user: options.actorUser,
  });
  const rows = await db.$queryRaw`
    SELECT
      m.id AS "membershipId",
      m."userId" AS "userId",
      m."tenantId" AS "tenantId",
      m."membershipType" AS "membershipType",
      m.role AS "role",
      m.status AS "status",
      m."isPrimary" AS "isPrimary",
      m."invitedAt" AS "invitedAt",
      m."acceptedAt" AS "acceptedAt",
      m."revokedAt" AS "revokedAt",
      m."metadataJson" AS "metadataJson",
      m."createdAt" AS "createdAt",
      m."updatedAt" AS "updatedAt",
      u."primaryEmail",
      u."displayName",
      u.locale,
      u.status AS "userStatus"
    FROM platform_memberships m
    LEFT JOIN platform_users u ON u.id = m."userId"
    WHERE m."tenantId" = ${normalizedTenantId}
      AND m."membershipType" = 'tenant'
    ORDER BY m."updatedAt" DESC
    LIMIT ${limit}
  `;
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => normalizeStaffRow(row)).filter(Boolean) : [];
  const activeOwnerCount = normalizedRows.filter((row) => row.role === 'owner' && row.status === 'active').length;
  return normalizedRows.map((row) => normalizeStaffRow(row, { actor, activeOwnerCount }));
}

async function inviteTenantStaff(input = {}, actor = 'system', db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  const email = normalizeEmail(input.email);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  if (!email) return { ok: false, reason: 'email-required' };
  const now = new Date();
  const actorContext = normalizeActorContext(actor);
  const role = normalizeRole(input.role);
  const invitePolicy = canActorManageTenantMembership({
    actorRole: actorContext.role,
    actorIdentity: actorContext.identity,
    desiredRole: role,
    targetIdentity: email,
    action: 'invite',
  });
  if (!invitePolicy.allowed) {
    return { ok: false, reason: 'tenant-staff-role-forbidden', statusCode: 403, message: invitePolicy.reason };
  }
  const result = await ensurePlatformUserIdentity({
    provider: 'email_staff',
    providerUserId: email,
    email,
    displayName: trimText(input.displayName, 200) || email.split('@')[0],
    locale: trimText(input.locale, 16) || 'en',
    tenantId,
    role,
    membershipType: 'tenant',
    identityMetadata: {
      source: 'tenant-staff-invite',
      actor: actorContext.id,
    },
    membershipMetadata: {
      source: 'tenant-staff-invite',
      actor: actorContext.id,
      invitedBy: actorContext.id,
      inviteState: 'pending',
    },
  }, db);
  if (!result?.ok || !result.membership) {
    return { ok: false, reason: result?.reason || 'tenant-staff-invite-failed' };
  }
  const existingMembership = await findMembershipRecord(db, result.membership.id, tenantId);
  if (existingMembership) {
    const existingPolicy = canActorManageTenantMembership({
      actorRole: actorContext.role,
      actorIdentity: actorContext.identity,
      targetRole: existingMembership.role,
      targetIdentity: existingMembership.user?.email || email,
      desiredRole: role,
      action: 'update',
    });
    if (!existingPolicy.allowed) {
      return { ok: false, reason: 'tenant-staff-role-forbidden', statusCode: 403, message: existingPolicy.reason };
    }
  }
  await db.$executeRaw`
    UPDATE platform_memberships
    SET
      role = ${role},
      status = ${'invited'},
      "invitedAt" = COALESCE("invitedAt", ${now}),
      "acceptedAt" = ${null},
      "metadataJson" = ${JSON.stringify({
        ...(result.membership?.metadata || {}),
        source: 'tenant-staff-invite',
        actor: actorContext.id,
        invitedBy: actorContext.id,
        inviteState: 'pending',
      })},
      "updatedAt" = ${now}
    WHERE id = ${result.membership.id}
  `;
  return {
    ok: true,
    staff: normalizeStaffRow(await findMembershipRecord(db, result.membership.id, tenantId), {
      actor: actorContext,
      activeOwnerCount: await countActiveOwners(db, tenantId),
    }),
  };
}

async function updateTenantStaffRole(input = {}, actor = 'system', db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const now = new Date();
  const actorContext = normalizeActorContext(actor);
  const existing = await findMembershipRecord(db, input.membershipId, tenantId, input.userId);
  if (!existing) return { ok: false, reason: 'tenant-staff-not-found' };
  const nextRole = normalizeRole(input.role || existing.role);
  const nextStatus = normalizeStatus(input.status || existing.status);
  const policy = canActorManageTenantMembership({
    actorRole: actorContext.role,
    actorIdentity: actorContext.identity,
    targetRole: existing.role,
    targetIdentity: existing.user?.email || '',
    desiredRole: nextRole,
    action: 'update',
  });
  if (!policy.allowed) {
    return { ok: false, reason: 'tenant-staff-role-forbidden', statusCode: 403, message: policy.reason };
  }
  const activeOwnerCount = await countActiveOwners(db, tenantId);
  if (
    existing.role === 'owner'
    && existing.status === 'active'
    && activeOwnerCount <= 1
    && (nextRole !== 'owner' || nextStatus !== 'active')
  ) {
    return {
      ok: false,
      reason: 'tenant-last-owner-required',
      statusCode: 409,
      message: 'At least one active owner must remain on this tenant.',
    };
  }
  const acceptedAt = existing.acceptedAt ? new Date(existing.acceptedAt) : now;
  await db.$executeRaw`
    UPDATE platform_memberships
    SET
      role = ${nextRole},
      status = ${nextStatus},
      "acceptedAt" = ${acceptedAt},
      "metadataJson" = ${JSON.stringify({
        ...existing.metadata,
        source: 'tenant-staff-role-update',
        actor: actorContext.id,
      })},
      "updatedAt" = ${now}
    WHERE id = ${existing.membershipId}
  `;
  return {
    ok: true,
    staff: normalizeStaffRow(await findMembershipRecord(db, existing.membershipId, tenantId), {
      actor: actorContext,
      activeOwnerCount: await countActiveOwners(db, tenantId),
    }),
  };
}

async function revokeTenantStaffMembership(input = {}, actor = 'system', db = prisma) {
  const tenantId = trimText(input.tenantId, 160);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const now = new Date();
  const actorContext = normalizeActorContext(actor);
  const existing = await findMembershipRecord(db, input.membershipId, tenantId, input.userId);
  if (!existing) return { ok: false, reason: 'tenant-staff-not-found' };
  const policy = canActorManageTenantMembership({
    actorRole: actorContext.role,
    actorIdentity: actorContext.identity,
    targetRole: existing.role,
    targetIdentity: existing.user?.email || '',
    action: 'revoke',
  });
  if (!policy.allowed) {
    return { ok: false, reason: 'tenant-staff-role-forbidden', statusCode: 403, message: policy.reason };
  }
  const activeOwnerCount = await countActiveOwners(db, tenantId);
  if (existing.role === 'owner' && existing.status === 'active' && activeOwnerCount <= 1) {
    return {
      ok: false,
      reason: 'tenant-last-owner-required',
      statusCode: 409,
      message: 'At least one active owner must remain on this tenant.',
    };
  }
  await db.$executeRaw`
    UPDATE platform_memberships
    SET
      status = 'revoked',
      "revokedAt" = ${now},
      "metadataJson" = ${JSON.stringify({
        ...existing.metadata,
        source: 'tenant-staff-revoke',
        actor: actorContext.id,
        revokeReason: trimText(input.revokeReason, 240) || null,
      })},
      "updatedAt" = ${now}
    WHERE id = ${existing.membershipId}
  `;
  const staff = normalizeStaffRow(await findMembershipRecord(db, existing.membershipId, tenantId), {
    actor: actorContext,
    activeOwnerCount: await countActiveOwners(db, tenantId),
  });
  return {
    ok: true,
    staff: staff
      ? {
        ...staff,
        revokedAt: staff.revokedAt || now.toISOString(),
      }
      : null,
  };
}

module.exports = {
  inviteTenantStaff,
  listTenantStaffMemberships,
  revokeTenantStaffMembership,
  updateTenantStaffRole,
};
