# ADR-0003: Tenant Isolation Is Application-Scoped With PostgreSQL RLS Foundation

## Status

Accepted

## Context

The repository has tenant-aware billing, quota, config, analytics, and audit foundations. PostgreSQL is the runtime standard on this workstation. The codebase now also has a PostgreSQL RLS foundation for selected tenant-scoped tables. Full database-per-tenant isolation still does not exist.

## Decision

Tenant isolation is currently enforced in two layers:

- API and route scope checks
- service-layer tenant scope
- PostgreSQL tenant session context for selected tenant-scoped service paths
- PostgreSQL RLS policies for tenant-scoped platform tables, `platform_tenant_configs`, and tenant-tagged delivery tables

The repository must not claim full DB-level tenant isolation until a broader model such as schema-per-tenant or database-per-tenant exists.

## Consequences

Advantages:

- tenant-scoped platform reads and writes can be protected below the API layer
- the repository has a concrete path from application-only scope to stronger PostgreSQL isolation
- future tenant rollout work can build on one install/status toolchain

Costs:

- global and mixed-scope paths still need application-layer review
- strict mode is limited to the tenant-scoped platform/admin surface that now uses PostgreSQL RLS session enforcement
- future migration to schema-per-tenant or database-per-tenant still needs a platform decision

## Evidence

- `src/utils/tenantDbIsolation.js`
- `scripts/postgres-tenant-rls.js`
- `src/services/platformService.js`
- `src/services/platformTenantConfigService.js`
- `test/tenant-db-isolation.test.js`
- `test/platform-service.integration.test.js`
- `test/platform-tenant-config-service.integration.test.js`
