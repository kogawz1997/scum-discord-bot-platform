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

`prisma/schema.prisma` is the in-repo compatibility template.
Provider-specific runtime and migration operations must use the schema rendered by
`scripts/prisma-with-provider.js`, and `src/prisma.js` now exposes a runtime profile helper
so the active runtime provider can be inspected explicitly instead of inferred from the
template alone.

## Tenant isolation foundation

- `TENANT_DB_ISOLATION_MODE=postgres-rls-strict` enables PostgreSQL tenant session context helpers and strict guardrails for tenant-scoped platform/admin paths.
- RLS policies are installable for tenant-scoped platform tables, `platform_tenant_configs`, and tenant-tagged delivery tables.
- Tenant-aware application service paths now route through tenant-scoped Prisma targets across platform, tenant-config, analytics, quota, webhook, reconcile, purchase/admin-commerce, delivery persistence, player/account-wallet, player portal, community/admin store, and SCUM webhook/community automation surfaces when tenant context or a configured default tenant is present.
- Provider-backed integration coverage now exercises tenant-scoped player/community/admin/dashboard/webhook paths in `test/player-tenant-topology.integration.test.js`, `test/community-tenant-topology.integration.test.js`, `test/admin-tenant-boundary.integration.test.js`, `test/admin-dashboard-audit-tenant-topology.integration.test.js`, `test/platform-tenant-config-service.integration.test.js`, and `test/scum-webhook.integration.test.js`.
- The current workstation now runs `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` in `.env`; schema `tenant_1259096998045421672` is provisioned for the default tenant, and local verification passed with `npm test` plus `node scripts/readiness-gate.js --production` on `2026-03-17`.

## Tenant DB topology model

- `TENANT_DB_TOPOLOGY_MODE=shared` keeps the current shared PostgreSQL database model.
- `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` resolves a tenant-scoped datasource URL by changing the PostgreSQL `schema=` query parameter.
- `TENANT_DB_TOPOLOGY_MODE=database-per-tenant` resolves a tenant-scoped datasource URL by rewriting the PostgreSQL database name.
- `scripts/tenant-database-topology.js` can preview and provision schema-per-tenant or database-per-tenant targets, then run `prisma db push` against the resolved target.
- `scripts/cutover-shared-to-tenant-schema.js` exists for same-database cutover from shared PostgreSQL into the active schema-per-tenant target on a workstation like this one.
- Repository target for multi-tenant deployments is `schema-per-tenant`; `database-per-tenant` remains supported for stricter isolation or dedicated-tenant tiers.
- `src/prisma.js` exposes tenant-scoped datasource routing so tenant-aware application paths can run against the selected topology instead of only the shared datasource.
- Selecting `schema-per-tenant` or `database-per-tenant` is now an operational deployment choice rather than a missing application rollout task.

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

- No read-replica path
- No automated failover between database providers
