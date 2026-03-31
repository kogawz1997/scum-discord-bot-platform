const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/prisma');
const {
  ensurePlatformIdentityTables,
} = require('../src/services/platformIdentityService');
const {
  inviteTenantStaff,
  listTenantStaffMemberships,
  revokeTenantStaffMembership,
  updateTenantStaffRole,
} = require('../src/services/platformTenantStaffService');

const hasPostgresDatabaseUrl = /^postgres(?:ql)?:\/\//i.test(String(process.env.DATABASE_URL || '').trim());

async function cleanupTenantStaffFixtures() {
  await ensurePlatformIdentityTables(prisma);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_memberships
    WHERE tenantId = 'tenant-staff-test'
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_user_identities
    WHERE provider = 'email_staff'
      AND providerUserId = 'staff@example.com'
  `).catch(() => null);
  await prisma.$executeRawUnsafe(`
    DELETE FROM platform_users
    WHERE primaryEmail = 'staff@example.com'
  `).catch(() => null);
}

test('platform tenant staff service invites, lists, updates, and revokes tenant staff', {
  skip: !hasPostgresDatabaseUrl && 'DATABASE_URL is not configured for PostgreSQL integration tests.',
}, async (t) => {
  try {
    await cleanupTenantStaffFixtures();
  } catch (error) {
    const message = String(error?.message || error);
    if (/validating datasource|postgresql:\/\//i.test(message)) {
      t.skip('PostgreSQL integration fixtures are not available in this environment.');
      return;
    }
    throw error;
  }
  t.after(cleanupTenantStaffFixtures);

  const invited = await inviteTenantStaff({
    tenantId: 'tenant-staff-test',
    email: 'staff@example.com',
    displayName: 'Staff Example',
    role: 'manager',
    locale: 'th',
  }, { actor: 'test-suite', role: 'owner', email: 'owner@example.com' });

  assert.equal(invited.ok, true);
  assert.equal(String(invited.staff?.tenantId || ''), 'tenant-staff-test');
  assert.equal(String(invited.staff?.role || ''), 'admin');
  assert.equal(String(invited.staff?.status || ''), 'invited');
  assert.deepEqual(invited.staff?.management?.roleOptions, ['owner', 'admin', 'staff', 'viewer']);

  const listed = await listTenantStaffMemberships('tenant-staff-test', {
    actor: { role: 'owner', email: 'owner@example.com' },
  });
  assert.equal(listed.length, 1);
  assert.equal(String(listed[0]?.user?.email || ''), 'staff@example.com');
  assert.equal(listed[0]?.management?.canManage, true);

  const updated = await updateTenantStaffRole({
    tenantId: 'tenant-staff-test',
    membershipId: invited.staff.membershipId,
    role: 'admin',
    status: 'active',
  }, { actor: 'test-suite', role: 'owner', email: 'owner@example.com' });

  assert.equal(updated.ok, true);
  assert.equal(String(updated.staff?.role || ''), 'admin');
  assert.equal(String(updated.staff?.status || ''), 'active');

  const revoked = await revokeTenantStaffMembership({
    tenantId: 'tenant-staff-test',
    membershipId: invited.staff.membershipId,
    revokeReason: 'test cleanup',
  }, { actor: 'test-suite', role: 'owner', email: 'owner@example.com' });

  assert.equal(revoked.ok, true);
  assert.equal(String(revoked.staff?.status || ''), 'revoked');
  assert.ok(revoked.staff?.revokedAt);
});
