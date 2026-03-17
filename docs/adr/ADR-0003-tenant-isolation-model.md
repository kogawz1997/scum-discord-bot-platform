# ADR-0003: Tenant Isolation Uses Topology-Routed Datasources With PostgreSQL RLS Foundation

## Status

Accepted

## Context

The repository has tenant-aware billing, quota, config, analytics, audit, player, community, and delivery foundations. PostgreSQL is the runtime standard on this workstation. The codebase now has PostgreSQL RLS support for tenant-scoped tables and tenant-scoped Prisma datasource routing for `schema-per-tenant` and `database-per-tenant` topologies.

## Decision

Tenant isolation is enforced in these layers:

- API and route scope checks
- service-layer tenant scope
- PostgreSQL tenant session context for tenant-scoped service paths
- PostgreSQL RLS policies for tenant-scoped platform tables, `platform_tenant_configs`, and tenant-tagged delivery tables
- tenant-scoped datasource routing for `schema-per-tenant` or `database-per-tenant` deployments

The repository target for multi-tenant deployments is `schema-per-tenant`. `database-per-tenant` remains supported for stricter isolation tiers. The current workstation now uses `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` in `.env`, so documents must distinguish the verified local runtime mode from unverified `database-per-tenant` or cross-workstation claims.

## Consequences

Advantages:

- tenant-scoped platform reads and writes can be protected below the API layer
- the repository now has a concrete path from application scope to schema/database-per-tenant topology
- future tenant rollout work can build on one install/status toolchain
- the repository now has one live workstation proving schema-per-tenant runtime, not only code/test coverage

Costs:

- live deployments still need an operational choice between `shared`, `schema-per-tenant`, and `database-per-tenant`
- RLS enforcement remains relevant for tenant-tagged shared tables even when datasource topology is stronger
- workstation-local claims must not confuse this verified schema-per-tenant runtime with `database-per-tenant` or other environments that are still unverified

## Evidence

- `src/utils/tenantDbIsolation.js`
- `scripts/postgres-tenant-rls.js`
- `src/services/platformService.js`
- `src/services/platformTenantConfigService.js`
- `test/tenant-db-isolation.test.js`
- `test/platform-service.integration.test.js`
- `test/platform-tenant-config-service.integration.test.js`
