'use strict';

function createPlatformTenantRegistryService(deps) {
  const {
    prisma,
    trimText,
    createId,
    normalizeSlug,
    normalizeTenantType,
    normalizeStatus,
    normalizeLocale,
    stringifyMeta,
    sanitizeTenantRow,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    ensureTenantDatabaseTargetProvisioned,
    emitPlatformEvent,
  } = deps;

  async function createTenant(input = {}, actor = 'system') {
    const id = trimText(input.id, 120) || createId('tenant');
    const slug = normalizeSlug(input.slug || input.name);
    const name = trimText(input.name, 180);
    if (!slug || !name) {
      return { ok: false, reason: 'invalid-tenant' };
    }
    const parentTenantId = trimText(input.parentTenantId, 120) || null;
    if (parentTenantId && parentTenantId === id) {
      return { ok: false, reason: 'tenant-parent-self' };
    }
    if (parentTenantId) {
      const parentTenant = await prisma.platformTenant.findUnique({ where: { id: parentTenantId } });
      if (!parentTenant) {
        return { ok: false, reason: 'tenant-parent-not-found' };
      }
    }
    const rowData = {
      slug,
      name,
      type: normalizeTenantType(input.type),
      status: normalizeStatus(input.status, ['active', 'trialing', 'paused', 'suspended', 'inactive']),
      locale: normalizeLocale(input.locale),
      ownerName: trimText(input.ownerName, 180) || null,
      ownerEmail: trimText(input.ownerEmail, 180) || null,
      parentTenantId,
      metadataJson: stringifyMeta(input.metadata),
    };
    try {
      const row = await prisma.platformTenant.upsert({
        where: { id },
        update: rowData,
        create: {
          id,
          ...rowData,
        },
      });
      if (getTenantDatabaseTopologyMode() !== 'shared') {
        ensureTenantDatabaseTargetProvisioned(row.id, {
          env: process.env,
          mode: getTenantDatabaseTopologyMode(),
        });
      }
      await emitPlatformEvent('platform.tenant.upserted', {
        tenantId: row.id,
        tenantSlug: row.slug,
        actor,
      }, { tenantId: row.id });
      return { ok: true, tenant: sanitizeTenantRow(row) };
    } catch (error) {
      if (error?.code === 'P2002') {
        return { ok: false, reason: 'tenant-slug-conflict' };
      }
      throw error;
    }
  }

  async function listPlatformTenants(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: trimText(options.tenantId, 120) || null,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform tenant listing',
      env: options.env || process.env,
    });
    const take = Math.max(1, Math.min(5000, Number.isFinite(Number(options.limit))
      ? Math.max(1, Math.trunc(Number(options.limit)))
      : 100));
    const where = {};
    if (tenantId) where.id = tenantId;
    if (options.status) where.status = normalizeStatus(options.status, ['active', 'trialing', 'paused', 'suspended', 'inactive']);
    if (options.type) where.type = normalizeTenantType(options.type);
    const rows = await prisma.platformTenant.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    });
    return rows.map(sanitizeTenantRow);
  }

  async function getPlatformTenantById(tenantId) {
    const id = trimText(tenantId, 120);
    if (!id) return null;
    const row = await prisma.platformTenant.findUnique({ where: { id } });
    return sanitizeTenantRow(row);
  }

  async function getPlatformTenantBySlug(slugValue) {
    const slug = normalizeSlug(slugValue);
    if (!slug) return null;
    const row = await prisma.platformTenant.findFirst({
      where: { slug },
      orderBy: { updatedAt: 'desc' },
    });
    return sanitizeTenantRow(row);
  }

  return {
    createTenant,
    listPlatformTenants,
    getPlatformTenantById,
    getPlatformTenantBySlug,
  };
}

module.exports = {
  createPlatformTenantRegistryService,
};
