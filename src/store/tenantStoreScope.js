const {
  prisma,
  getTenantScopedPrismaClient,
  resolveDefaultTenantId,
  resolveTenantScopedDatasourceUrl,
} = require('../prisma');

function resolveTenantStoreScope(options = {}) {
  const tenantId = resolveDefaultTenantId(options);
  if (!tenantId) {
    return {
      tenantId: null,
      datasourceKey: '__default__',
      db: prisma,
    };
  }

  return {
    tenantId,
    datasourceKey: resolveTenantScopedDatasourceUrl(tenantId, options) || tenantId,
    db: getTenantScopedPrismaClient(tenantId, options),
  };
}

module.exports = {
  resolveTenantStoreScope,
};
