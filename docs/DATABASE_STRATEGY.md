# Database Strategy

## Runtime standard

Production runtime is PostgreSQL.

The repository still keeps SQLite compatibility for:

- local import and offline recovery workflows
- local smoke or scratch environments
- compatibility tooling during cutover and restore exercises

## Current implementation

- Runtime provider detection: [src/utils/dbEngine.js](../src/utils/dbEngine.js)
- Prisma wrapper by provider: [scripts/prisma-with-provider.js](../scripts/prisma-with-provider.js)
- Main schema: [prisma/schema.prisma](../prisma/schema.prisma)
- Cutover helper: [scripts/cutover-sqlite-to-postgres.js](../scripts/cutover-sqlite-to-postgres.js)
- PostgreSQL tenant RLS foundation: [src/utils/tenantDbIsolation.js](../src/utils/tenantDbIsolation.js)
- PostgreSQL tenant RLS ops script: [scripts/postgres-tenant-rls.js](../scripts/postgres-tenant-rls.js)
- Tenant DB topology resolver: [src/utils/tenantDatabaseTopology.js](../src/utils/tenantDatabaseTopology.js)
- Tenant-scoped Prisma datasource routing: [src/prisma.js](../src/prisma.js)
- Tenant DB topology ops script: [scripts/tenant-database-topology.js](../scripts/tenant-database-topology.js)

## Tenant isolation foundation

- `TENANT_DB_ISOLATION_MODE=postgres-rls-strict` enables PostgreSQL tenant session context helpers and strict guardrails for tenant-scoped platform/admin paths.
- RLS policies are installable for tenant-scoped platform tables, `platform_tenant_configs`, and tenant-tagged delivery tables.
- Current service coverage is strongest in platform, tenant-config, analytics, quota, webhook, reconcile, purchase/admin-commerce, delivery persistence, player/account-wallet paths, and community/admin stores that already carry explicit tenant context or use a configured default tenant.
- This is not a full rollout yet. Global/admin paths still rely on application-layer checks when they are not running inside tenant DB context.

## Tenant DB topology model

- `TENANT_DB_TOPOLOGY_MODE=shared` keeps the current shared PostgreSQL database model.
- `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` resolves a tenant-scoped datasource URL by changing the PostgreSQL `schema=` query parameter.
- `TENANT_DB_TOPOLOGY_MODE=database-per-tenant` resolves a tenant-scoped datasource URL by rewriting the PostgreSQL database name.
- `scripts/tenant-database-topology.js` can preview and provision schema-per-tenant or database-per-tenant targets, then run `prisma db push` against the resolved target.
- `src/prisma.js` now exposes tenant-scoped datasource routing so platform, tenant-config, tenant-aware purchase/shop services, delivery persistence, player/account-wallet paths, and community/admin stores can run against the selected topology instead of only the shared datasource.
- This is not a full application rollout yet. Global/admin/shared paths still run on the shared runtime datasource unless they are explicitly migrated.

## Operational rules

- Do not run production on SQLite.
- Do not mix SQLite and PostgreSQL env values in the same runtime session.
- Run schema generation and migrate/deploy against the same provider you will boot with.
- Validate restore and smoke checks after any provider change.

## Rollback posture

- Schema changes must go through `db:migrate:deploy` or `db:migrate:deploy:safe`.
- Backups and restore previews are part of the admin web flow.
- A rollback plan must identify whether the rollback is schema-only, data-only, or full runtime rollback.

## Gaps still open

- No full application rollout on schema-per-tenant or database-per-tenant topology yet
- No read-replica path
- No automated failover between database providers
