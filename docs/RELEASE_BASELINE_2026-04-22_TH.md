# Release Baseline 2026-04-22

This baseline records the managed-service P0 hardening round for the SCUM TH
platform. It replaces the initial audit-only baseline after the production
readiness gate was brought to a passing state on the local production profile.

## Scope

- Branch: `codex/managed-service-p0-hardening`
- Priority round: P0 only
- Goal: make the current production readiness gate pass without weakening the
  runtime separation or the production posture checks.
- Runtime profile used for final verification: PM2 production stack from
  `deploy/pm2.ecosystem.config.cjs`

## Runtime Setup Applied Locally

- Generated the provider-rendered Prisma client for PostgreSQL:
  `npm.cmd run db:generate:postgresql`
- Started the repository local PostgreSQL cluster on `127.0.0.1:55432`:
  `npm.cmd run postgres:local:setup`
- Replaced the stale PM2 local stack with the PM2 production stack:
  `npm.cmd run pm2:start:prod`
- Enabled admin TOTP enforcement in the untracked local `.env`:
  `ADMIN_WEB_2FA_ENABLED=true`

The `.env` file is intentionally not tracked by git. Do not commit local secret
values.

## P0 Fixes Landed In This Round

- Fixed release gate hygiene by moving root temporary owner proof files out of
  the repository root.
- Fixed ESLint blocker classes in Owner assets:
  duplicate declarations, duplicate translation keys, and unreachable route
  branches.
- Fixed control-plane registry hydration race:
  DB hydration now merges with in-memory mutations instead of overwriting
  server/agent/session state created while repository initialization is still
  pending.
- Confirmed PostgreSQL production persistence profile:
  checked-in source schema remains SQLite-compatible, while runtime uses the
  generated PostgreSQL Prisma client.

## Final Verification

### Targeted Gates

- `npm.cmd run lint:eslint`: PASS
- `node scripts/run-tests-with-provider.js test/platform-agent-api.integration.test.js test/platform-agent-provisioning.integration.test.js`: PASS
- `npm.cmd run smoke:persistence`: PASS
- `npm.cmd run smoke:postdeploy`: PASS

### Full Production Gate

- `npm.cmd run readiness:prod`: PASS

Final gate included:

- lint
- policy tests
- security check
- doctor
- topology doctor
- standalone player portal doctor
- production topology doctor
- production standalone player portal doctor
- persistence smoke
- post-deploy smoke

Observed final test count:

- `test:policy`: 145 passed, 0 failed

Observed final production smoke:

- admin health: PASS
- admin login page: PASS
- player health: PASS
- player login page: PASS
- player root redirect: PASS
- legacy admin redirect: PASS
- player API auth gate: PASS
- player Discord OAuth start: PASS
- bot health: PASS
- worker health: PASS
- watcher health: PASS
- console-agent health: PASS

## Current PM2 Production Runtime

The final runtime check showed these apps online:

- `scum-admin-web`
- `scum-bot`
- `scum-console-agent`
- `scum-server-bot`
- `scum-watcher`
- `scum-web-portal`
- `scum-worker`

## Remaining Notes

- Admin Discord SSO is still disabled, so the post-deploy smoke skips admin
  OAuth start. This is acceptable for the current P0 round but should be
  revisited in P1/P2 productization.
- The production readiness gate now proves the local configured runtime can
  start and answer health/smoke checks. It does not prove external DNS,
  reverse-proxy TLS, real billing, or real multi-tenant onboarding are
  production complete.
- The repository still has many pre-existing dirty files unrelated to this P0
  round. Do not treat this branch as release-clean until the intended diff is
  curated.

## Decision

P0 gate result: PASS.

Managed-service maturity after this round: still not commercial-ready, but the
local production readiness baseline is no longer blocked by lint, policy tests,
persistence smoke, or post-deploy smoke.

## P0 Round 2 Tenant Isolation Progress

Status: in progress, not fully closed.

Changes made:

- Added `assertTenantMutationScope` as a central guard for tenant-owned writes.
- Added `test/tenant-mutation-scope-hardening.test.js`.
- Wired direct purchase creation through the tenant mutation guard before
  persistence.
- Wired player account upsert/unbind through the tenant mutation guard before
  persistence.
- Wired raid mutations through the tenant mutation guard for request review,
  request creation, window creation, and summary creation.
- Wired delivery queue/dead-letter restore mutations through the tenant
  mutation guard. Non-empty delivery restore data now requires a tenant from
  payload/options, or an explicit platform-level `allowGlobal` restore.
- Wired tenant-owned admin notification/security event writes through the
  tenant mutation guard while preserving intentionally global ops/security
  alerts.
- Wired tenant-owned delivery audit writes and restore rows through the tenant
  mutation guard. Purchase-delivery audit actions now require tenant scope at
  the store boundary unless the caller explicitly marks the event as
  platform-global. Manual/admin test audit call sites in `rconDelivery` now
  declare tenant/global intent instead of writing ambiguous audit rows.
- Wired event/giveaway/ticket/VIP tenant store mutations through the same
  central guard via `tenantStoreScope`. Create/update/replace/remove actions
  for these legacy community/support stores now require tenant scope before
  persistence.
- Wired moderation punishment, top panel message, welcome pack claim, and
  bounty tenant store mutations through `tenantStoreScope`. Create/update,
  claim/revoke, replace, and remove actions for these community/reward stores
  now require tenant scope before persistence.
- Updated delivery persistence and tenant-boundary tests to seed tenant-owned
  delivery state with explicit tenant scope.
- Fixed SQLite `platform_tenant_configs` DateTime compatibility repair for
  Prisma db-only writes, which was blocking the tenant boundary integration
  test under local SQLite provider runs.

Verification:

- `node scripts/run-tests-with-provider.js test/tenant-db-isolation.test.js test/tenant-store-isolation-batch2.test.js test/tenant-mutation-scope-hardening.test.js test/admin-tenant-boundary.integration.test.js test/platform-global-read-scope.test.js test/platform-tenant-config-service.db-only.test.js`:
  PASS, 22 passed / 0 failed.
- `npm.cmd run db:tenant-isolation:status`: PASS, PostgreSQL strict RLS active
  and policies present for all listed tenant isolation tables.
- `node scripts/run-tests-with-provider.js test/tenant-mutation-scope-hardening.test.js test/player-account-store.test.js test/player-account.integration.test.js test/raid-service.strict.test.js test/raid-service.persistence.test.js test/rcon-delivery.integration.test.js test/config-delivery-persistence.integration.test.js test/admin-tenant-boundary.integration.test.js test/admin-snapshot-regression.test.js test/admin-snapshot-compatibility.test.js test/platform-restart-orchestration-service.test.js test/platform-server-config-service.integration.test.js test/admin-notification-store.test.js test/admin-security-event-store.test.js`:
  PASS, 87 passed / 0 failed.
- `node scripts/run-tests-with-provider.js test/tenant-mutation-scope-hardening.test.js test/player-account-store.test.js test/player-account.integration.test.js test/raid-service.strict.test.js test/raid-service.persistence.test.js test/rcon-delivery.integration.test.js test/rcon-delivery-scope.test.js test/delivery-audit-store.test.js test/config-delivery-persistence.integration.test.js test/admin-tenant-boundary.integration.test.js test/admin-snapshot-regression.test.js test/admin-snapshot-compatibility.test.js test/platform-restart-orchestration-service.test.js test/platform-server-config-service.integration.test.js test/admin-notification-store.test.js test/admin-security-event-store.test.js`:
  PASS, 92 passed / 0 failed.
- `npm.cmd run format:check`: PASS.
- `npm.cmd run lint:syntax`: PASS.
- `npm.cmd run db:tenant-isolation:status`: PASS, strict PostgreSQL RLS
  still active with policy present, enabled, and forced for every listed
  tenant-isolated table.
- `npm.cmd run readiness:prod`: PASS after delivery audit guard and
  documentation updates. The gate included lint, policy tests, security check,
  doctor/topology checks, web standalone doctors, persistence smoke, and
  post-deploy smoke.
- `node scripts/run-tests-with-provider.js test/tenant-mutation-scope-hardening.test.js test/tenant-store-scope.test.js test/tenant-db-isolation.test.js test/tenant-database-topology.test.js test/prisma-tenant-topology.test.js test/player-account-store.test.js test/player-account.integration.test.js test/raid-service.persistence.test.js test/raid-service.strict.test.js test/rcon-delivery-scope.test.js test/rcon-delivery-routing-context.test.js test/rcon-delivery.integration.test.js test/delivery-audit-store.test.js test/delivery-persistence-db.test.js test/delivery-lifecycle-service.test.js test/admin-notification-store.test.js test/admin-security-event-store.test.js test/cart-store.test.js test/cart-service.test.js test/cart-redeem-prisma.integration.test.js test/shop-service.test.js test/shop-vip-services.integration.test.js test/event-service.test.js test/event-services.integration.test.js test/giveaway-service.test.js test/ticket-service.test.js test/vip-service.test.js test/vip-event-ticket-scum-prisma.integration.test.js test/player-stats-events-support-v4.test.js test/player-tenant-topology.integration.test.js test/community-tenant-topology.integration.test.js test/moderation-giveaway-top-panel-delivery-audit-prisma.integration.test.js test/platform-agent-api.integration.test.js test/platform-agent-provisioning.integration.test.js`:
  PASS, 131 passed / 0 failed / 2 skipped.
- `node scripts/run-tests-with-provider.js test/tenant-mutation-scope-hardening.test.js test/tenant-store-scope.test.js test/tenant-db-isolation.test.js test/tenant-database-topology.test.js test/prisma-tenant-topology.test.js test/player-account-store.test.js test/player-account.integration.test.js test/raid-service.persistence.test.js test/raid-service.strict.test.js test/rcon-delivery-scope.test.js test/rcon-delivery-routing-context.test.js test/rcon-delivery.integration.test.js test/delivery-audit-store.test.js test/delivery-persistence-db.test.js test/delivery-lifecycle-service.test.js test/admin-notification-store.test.js test/admin-security-event-store.test.js test/cart-store.test.js test/cart-service.test.js test/cart-redeem-prisma.integration.test.js test/shop-service.test.js test/shop-vip-services.integration.test.js test/event-service.test.js test/event-services.integration.test.js test/giveaway-service.test.js test/ticket-service.test.js test/vip-service.test.js test/vip-event-ticket-scum-prisma.integration.test.js test/moderation-service.test.js test/moderation-giveaway-top-panel-delivery-audit-prisma.integration.test.js test/leaderboard-panels.test.js test/welcome-pack-service.test.js test/reward-service.test.js test/reward-service.integration.test.js test/reward-services.integration.test.js test/player-stats-events-support-v4.test.js test/player-tenant-topology.integration.test.js test/community-tenant-topology.integration.test.js test/platform-agent-api.integration.test.js test/platform-agent-provisioning.integration.test.js`:
  PASS, 149 passed / 0 failed / 2 skipped.
- `npm.cmd run format:check`: PASS after
  moderation/top-panel/welcome-pack/bounty guard documentation updates.
- `npm.cmd run lint:syntax`: PASS after
  moderation/top-panel/welcome-pack/bounty guard code changes.
- `npm.cmd run db:tenant-isolation:status`: PASS, strict PostgreSQL RLS still
  active with all listed policies present, enabled, and forced.
- `npm.cmd run readiness:prod`: PASS after
  moderation/top-panel/welcome-pack/bounty guard changes. The gate included
  full lint, policy tests, security check, doctor checks, persistence smoke,
  and post-deploy smoke.

Remaining tenant isolation work:

- Continue auditing tenant-owned legacy store/service mutations beyond this P0
  slice, especially donations, modules, broader reward paths outside the
  guarded welcome pack/bounty slice, support cases, analytics/automation side
  effects, and any direct Prisma writes that bypass scoped services.
- Decide whether legacy tenantless delivery jobs should remain supported as
  explicitly platform-global compatibility rows, or whether
  `enqueuePurchaseDelivery` should reject tenantless purchases entirely.
- Add dedicated missing-scope tests for raid window/summary paths if we want
  one test per mutation, even though those code paths now share the guarded raid
  mutation helper and are covered by tenant-scoped persistence tests.
