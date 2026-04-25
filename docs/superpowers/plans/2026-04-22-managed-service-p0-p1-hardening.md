# Managed Service P0/P1 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current managed-service prototype into a verifiable Managed-Service Ready baseline by closing the P0/P1 gaps found in `docs/MANAGED_SERVICE_READINESS_AUDIT_2026-04-22_TH.md`.

**Architecture:** Treat this as a sequence of independently verifiable hardening workstreams. Do tenant isolation, runtime boundary, billing entitlement lifecycle, and destructive-action auditability before UI polish. Each workstream must add or update tests first, then change production code, then run the narrow tests and the readiness gate.

**Tech Stack:** Node.js, vanilla browser JS, Prisma, SQLite/PostgreSQL provider scripts, custom HTTP runtimes, SCUM Delivery Agent, SCUM Server Bot, PM2 deployment profiles, existing test runner via `node scripts/run-tests-with-provider.js`.

---

## Scope Split

The audit covers multiple independent subsystems. Do not attempt to fix all of them in one patch. Execute in this order:

1. P0 release baseline and tenant isolation.
2. P0 runtime boundary.
3. P0 billing/subscription/entitlement lifecycle.
4. P0 destructive-action audit governance.
5. P1 owner panel productization.
6. P1 tenant/player e2e verification.
7. P2 browser security and i18n cleanup.

This file is the umbrella plan. If a task expands beyond a single reviewable patch, create a focused child plan under `docs/superpowers/plans/` before coding.

## Current Execution Status

- P0 round 1 / Task 1: closed on 2026-04-22.
- Evidence file: `docs/RELEASE_BASELINE_2026-04-22_TH.md`
- Final command: `npm.cmd run readiness:prod`
- Result: PASS
- Runtime used: PM2 production stack with PostgreSQL Prisma client and local PostgreSQL on `127.0.0.1:55432`.
- P0 round 2 / Task 2: in progress on 2026-04-22.
- Added central tenant mutation guard and wired purchase creation through it.
- Extended the guard to player account upsert/unbind, raid mutations, and
  delivery queue/dead-letter restore mutations.
- Delivery queue/dead-letter restore now rejects tenantless rows and requires
  explicit `allowGlobal` for platform-level multi-tenant restore paths.
- Tenant-owned admin notification/security event writes now use the central
  guard, while intentionally global ops/security alerts remain allowed.
- Tenant-owned delivery audit writes now use the central guard; tenant purchase
  delivery audit actions require tenant scope unless the caller explicitly marks
  an event as platform-global.
- Event, giveaway, ticket, and VIP membership legacy store mutations now use
  the central tenant mutation guard through `tenantStoreScope`.
- Moderation punishment, top panel message, welcome pack claim, and bounty
  legacy store mutations now use the central tenant mutation guard through
  `tenantStoreScope`.
- Fixed SQLite `platform_tenant_configs` DateTime compatibility repair for db-only Prisma writes discovered by the tenant boundary verification.
- Latest targeted command:
  `node scripts/run-tests-with-provider.js test/tenant-mutation-scope-hardening.test.js test/tenant-store-scope.test.js test/tenant-db-isolation.test.js test/tenant-database-topology.test.js test/prisma-tenant-topology.test.js test/player-account-store.test.js test/player-account.integration.test.js test/raid-service.persistence.test.js test/raid-service.strict.test.js test/rcon-delivery-scope.test.js test/rcon-delivery-routing-context.test.js test/rcon-delivery.integration.test.js test/delivery-audit-store.test.js test/delivery-persistence-db.test.js test/delivery-lifecycle-service.test.js test/admin-notification-store.test.js test/admin-security-event-store.test.js test/cart-store.test.js test/cart-service.test.js test/cart-redeem-prisma.integration.test.js test/shop-service.test.js test/shop-vip-services.integration.test.js test/event-service.test.js test/event-services.integration.test.js test/giveaway-service.test.js test/ticket-service.test.js test/vip-service.test.js test/vip-event-ticket-scum-prisma.integration.test.js test/moderation-service.test.js test/moderation-giveaway-top-panel-delivery-audit-prisma.integration.test.js test/leaderboard-panels.test.js test/welcome-pack-service.test.js test/reward-service.test.js test/reward-service.integration.test.js test/reward-services.integration.test.js test/player-stats-events-support-v4.test.js test/player-tenant-topology.integration.test.js test/community-tenant-topology.integration.test.js test/platform-agent-api.integration.test.js test/platform-agent-provisioning.integration.test.js`
- Latest targeted result: PASS, 149 passed / 0 failed / 2 skipped.
- Latest RLS status command: `npm.cmd run db:tenant-isolation:status`
- Latest RLS status result: PASS, strict PostgreSQL RLS active with policies present for all listed tenant isolation tables.
- Latest hygiene/readiness commands after
  moderation/top-panel/welcome-pack/bounty guard:
  `npm.cmd run format:check` PASS, `npm.cmd run lint:syntax` PASS,
  `npm.cmd run db:tenant-isolation:status` PASS, and
  `npm.cmd run readiness:prod` PASS.
- P0 round 3 / Task 3: completed in this pass.
- Added strict runtime role/scope mismatch rejection for agent tokens and
  setup-token activation.
- Platform sync ingestion now requires the issued sync token binding to match
  the submitted agent/server/guild, and the public sync route no longer accepts
  generic `agent:write` as a sync substitute.
- Server-config snapshot/claim/result service boundaries reject explicit
  Delivery Agent runtime profiles before persistence.
- Insufficient platform API scope denials now emit
  `platform-api-insufficient-scope` security signals.
- Runtime checks:
  `npm.cmd run runtime:check:server-bot` PASS.
  `npm.cmd run runtime:check:delivery-agent` initially failed because the
  local shell lacked `SCUM_AGENT_ID` and `SCUM_AGENT_RUNTIME_KEY`; rerun with
  test-safe env values PASS.
- Latest Task 3 targeted command:
  `node scripts/run-tests-with-provider.js test/runtime-profile.test.js test/agent-contracts.test.js test/agent-registry-platform-apikey-scope.test.js test/platform-agent-provisioning.integration.test.js test/platform-server-bot-provisioning.integration.test.js test/platform-agent-api.integration.test.js test/platform-agent-presence-service.test.js test/platform-server-config-runtime-boundary.test.js test/platform-server-config-service.integration.test.js test/rcon-delivery-scope.test.js test/bot-interaction-runtime-scope.test.js test/sync-ingestion-service.test.js`
- Latest Task 3 targeted result: PASS, 30 passed / 0 failed.
- Latest policy/syntax after Task 3:
  `npm.cmd run lint:syntax` PASS and `npm.cmd run test:policy` PASS, 145 passed / 0 failed.
- P0 round 4 / Task 4: completed in this pass.
- Added `test/platform-commercial-lifecycle.integration.test.js` proving preview,
  trial, checkout, paid conversion, payment success, entitlement unlock, cancel,
  and entitlement lock behavior end-to-end.
- Subscription lifecycle status is now canonicalized to `preview`, `trialing`,
  `active`, `past_due`, `cancelled`, or `expired` before entitlement checks.
- Billing/commercial lifecycle aliases now record operator-readable events for
  preview/trial/checkout/payment/package/cancel/entitlement lock and unlock
  transitions while preserving legacy billing event names.
- Admin backup restore now passes explicit global restore scope through
  tenant-guarded legacy stores, so platform-level restore/rollback remains
  possible without weakening tenant-scoped mutations.
- Latest Task 4 targeted command:
  `node scripts/run-tests-with-provider.js test/platform-commercial-lifecycle.integration.test.js test/platform-billing-lifecycle-service.test.js test/player-route-entitlements.test.js`
- Latest Task 4 targeted result: PASS, 27 passed / 0 failed.
- Latest Task 4 route regression command:
  `node scripts/run-tests-with-provider.js test/platform-billing-lifecycle-service.test.js test/platform-billing-product-model.test.js test/platform-subscription-billing.integration.test.js test/product-entitlement-service.test.js test/player-route-entitlements.test.js test/public-preview-service.test.js test/public-platform-routes.test.js test/admin-api.integration.test.js test/platform-admin-api.integration.test.js test/admin-billing-post-routes.test.js`
- Latest Task 4 route regression result: PASS, 48 passed / 0 failed.
- P0 round 5 / Task 5: completed in this pass.
- Admin audit query/export now supports governance/destructive-action events
  from the admin security event stream with tenant/action/target/request/job
  filters.
- Config save/apply/rollback jobs, restart plans/executions, server
  start/stop jobs, agent provisioning/activation, package changes, staff role
  changes, tenant config updates, admin user updates, and runtime service
  restarts now carry operator-readable governance metadata.
- Governance audit payloads standardize tenant ID, actor ID/role, action type,
  target type/id, reason, request/job ID, result status, and before/after state
  where available; provisioning/activation audit paths avoid raw setup token and
  API key leakage.
- Latest Task 5 targeted command:
  `node scripts/run-tests-with-provider.js test/admin-audit-route.test.js test/admin-audit-service.scope.test.js test/platform-restart-orchestration-service.test.js test/platform-restart-orchestration-service.mode.test.js test/admin-platform-governance-audit-route.test.js test/platform-server-config-service.test.js test/agent-registry-platform-apikey-scope.test.js test/admin-config-post-routes.test.js test/admin-route-handlers-runtime.test.js`
- Latest Task 5 targeted result: PASS, 37 passed / 0 failed.
- Latest Task 5 hygiene/readiness commands:
  `npm.cmd run format:check` PASS, `npm.cmd run lint:syntax` PASS, and
  `npm.cmd run test:policy` PASS, 145 passed / 0 failed.
- Owner UI verification after Task 5:
  `npm.cmd test` PASS, 42 passed / 0 failed; `npm.cmd run build` PASS;
  `npm.cmd run verify:browser` PASS, 52 page/viewport route smoke pairs;
  `npm.cmd run verify:live` PASS, 43 read-only backend endpoints / 0
  failures; `http://127.0.0.1:5177/overview` returned HTTP 200.

## File Structure Map

Primary backend and runtime files:

- `src/utils/tenantDbIsolation.js`: tenant isolation enforcement and scope assertions.
- `src/store/tenantStoreScope.js`: tenant-aware store execution helpers.
- `src/services/platformService.js`: cross-tenant reads, tenant provisioning, subscriptions, package resolution.
- `src/domain/agents/agentRegistryService.js`: provisioning token, activation, device binding, role/scope enforcement.
- `src/utils/agentRuntimeProfile.js`: canonical sync/execute role and scope resolution.
- `src/services/platformAgentPresenceService.js`: runtime registration, server-bot job access, token/session behavior.
- `src/services/rconDelivery.js`: Delivery Agent job execution, delivery queue, retries, announce support.
- `src/services/scumServerBotRuntime.js`: Server Bot sync/config/start/stop/restart execution.
- `src/services/platformBillingLifecycleService.js`: billing customers, invoices, subscription events.
- `src/services/platformCommercialService.js`: commercial funnel and checkout context.
- `src/domain/billing/productEntitlementService.js`: tenant/player locks and entitlement resolution.
- `src/admin/api/adminBillingPostRoutes.js`: owner/admin billing mutations.
- `apps/web-portal-standalone/api/publicPlatformRoutes.js`: public signup/preview/trial/commercial routes.
- `src/services/platformServerConfigService.js`: config jobs, backups, rollback, restart scheduling.
- `src/services/platformRestartOrchestrationService.js`: restart plan, announcement, execution, health state.
- `src/services/adminAuditService.js`: audit dataset and export behavior.
- `src/admin/audit/adminAuditRoutes.js`: audit API exposure.
- `src/admin/runtime/adminPageRuntime.js`: owner/tenant route rendering and stitch fallback boundaries.

Primary UI files:

- `src/admin/assets/owner-v4-app.js`: owner shell/navigation/action wiring.
- `src/admin/assets/owner-dashboard-v4.js`: owner overview.
- `src/admin/assets/owner-tenants-v4.js`: owner tenant management.
- `src/admin/assets/owner-runtime-health-v4.js`: runtime/fleet health.
- `src/admin/assets/tenant-v4-app.js`: tenant shell/navigation/action wiring.
- `src/admin/assets/tenant-console.js`: tenant admin shared UI behavior.
- `apps/web-portal-standalone/public/assets/player-v4-app.js`: player shell/navigation.
- `apps/web-portal-standalone/public/assets/player-control-v4.js`: player portal control/data rendering.
- `apps/web-portal-standalone/public/assets/portal-i18n.js`: player locale runtime.
- `src/admin/assets/admin-i18n.js`: admin/owner/tenant locale runtime.

Primary schema and migration files:

- `prisma/schema.prisma`: production provider schema.
- `prisma/schema.sqlite.prisma`: local/test provider schema.
- `prisma/migrations/*`: migration history.
- `scripts/platform-schema-upgrade.js`: platform schema upgrade helper.
- `scripts/postgres-platform-schema-upgrade.js`: PostgreSQL platform schema upgrade helper.
- `scripts/postgres-tenant-rls.js`: PostgreSQL tenant isolation/RLS helper.

Primary tests to extend:

- `test/tenant-db-isolation.test.js`
- `test/tenant-store-isolation-batch2.test.js`
- `test/platform-agent-provisioning.integration.test.js`
- `test/agent-registry-platform-apikey-scope.test.js`
- `test/rcon-delivery-scope.test.js`
- `test/platform-billing-lifecycle-service.test.js`
- `test/player-route-entitlements.test.js`
- `test/platform-restart-orchestration-service.test.js`
- `test/platform-restart-orchestration-service.mode.test.js`
- `test/admin-audit-route.test.js`
- `test/admin-audit-service.scope.test.js`
- `test/owner-stitch-placeholder-copy.test.js`
- `test/owner-vnext-route-smoke.test.js`
- `test/tenant-v4-app-surface-redirect.test.js`
- `test/web-portal-standalone.player-mode.integration.test.js`
- `test/ui-i18n-runtime.test.js`
- `test/player-portal-i18n.test.js`

---

### Task 1: Freeze a Clean Release Baseline

**Files:**

- Create: `docs/RELEASE_BASELINE_2026-04-22_TH.md`
- Modify: none in source/runtime code
- Test: existing readiness and policy scripts

- [x] **Step 1: Capture current worktree state**

Run:

```powershell
git status --short > tmp\managed-service-worktree-status-2026-04-22.txt
```

Expected:

- File exists under `tmp\`.
- It shows current dirty files for traceability.

- [x] **Step 2: Run syntax and policy gate**

Run:

```powershell
npm run lint:syntax
npm run test:policy
```

Expected:

- `lint:syntax` passes.
- `test:policy` passes or produces a concrete failing test list to triage before implementation.

- [x] **Step 3: Run production readiness gate**

Run:

```powershell
npm run readiness:prod
```

Expected:

- If it passes, record the output summary in `docs/RELEASE_BASELINE_2026-04-22_TH.md`.
- If it fails, record every failing gate name, command, and remediation owner in the same file.

- [x] **Step 4: Document release baseline**

Write `docs/RELEASE_BASELINE_2026-04-22_TH.md` with these sections:

```markdown
# Release Baseline 2026-04-22

## Worktree State

- Source: `tmp/managed-service-worktree-status-2026-04-22.txt`
- Release branch status: not release-clean until listed dirty files are resolved.

## Gates Run

- `npm run lint:syntax`: PASS/FAIL
- `npm run test:policy`: PASS/FAIL
- `npm run readiness:prod`: PASS/FAIL

## Blocking Failures

- Each failure must include command, failing test/gate, affected files, and next owner.

## Release Decision

- Decision: blocked until P0 tasks pass.
```

- [ ] **Step 5: Commit documentation only**

Run:

```powershell
git add docs/RELEASE_BASELINE_2026-04-22_TH.md tmp/managed-service-worktree-status-2026-04-22.txt
git commit -m "docs: capture managed service release baseline"
```

Expected:

- Commit contains only baseline documentation and captured status.

Status note:

- Not completed in this round because the repository already has many pre-existing dirty files and this P0 pass includes source/runtime fixes, not documentation only.

---

### Task 2: Make Tenant Isolation Mandatory for P0 Data Paths

**Files:**

- Modify: `src/utils/tenantDbIsolation.js`
- Modify: `src/store/tenantStoreScope.js`
- Modify: `src/services/platformService.js`
- Modify as needed: legacy stores that write tenant-owned data, especially purchase, player, delivery, raid, donation, event, notification, and audit stores.
- Test: `test/tenant-db-isolation.test.js`
- Test: `test/tenant-store-isolation-batch2.test.js`
- Create if needed: `test/tenant-mutation-scope-hardening.test.js`

- [x] **Step 1: Write failing tests for mutation without tenant scope**

Add tests that prove these tenant-owned writes fail without an explicit tenant scope:

- purchase/order write
- player account/profile write
- delivery queue/dead-letter write
- raid request/window/summary write
- notification/security/audit write

Run:

```powershell
node scripts/run-tests-with-provider.js test/tenant-db-isolation.test.js test/tenant-store-isolation-batch2.test.js test/tenant-mutation-scope-hardening.test.js
```

Expected before implementation:

- New hardening tests fail because at least one legacy path accepts missing tenant scope.

Status note:

- Completed for the current P0 audited write-path set.
- Added `test/tenant-mutation-scope-hardening.test.js` covering the central guard, direct purchase creation, player account upsert, and raid request creation.
- Added rcon delivery integration coverage proving tenantless queue/dead-letter restore rows are rejected.
- Added notification/security coverage proving tenant-owned notification/security writes reject missing tenant scope.
- Added delivery audit coverage proving tenant-owned audit writes and restore rows reject missing tenant scope while explicit platform-global manual audit writes remain allowed.
- Added event/giveaway/ticket/VIP coverage proving legacy tenant store mutations reject missing tenant scope.
- Added moderation/top-panel/welcome-pack/bounty coverage proving the next legacy community/reward store mutations reject missing tenant scope.

- [x] **Step 2: Add one central tenant mutation guard**

Implement a central guard in `src/utils/tenantDbIsolation.js` or extend the existing assertion helpers so tenant-owned mutations reject missing, blank, or mismatched tenant IDs.

Acceptance:

- Guard returns a consistent error code such as `tenant-scope-required` or `tenant-scope-mismatch`.
- Guard allows explicitly documented global/platform-only operations.
- Guard is covered by direct unit tests.

- [ ] **Step 3: Route legacy stores through the guard**

Update store/service write paths so tenant-owned writes use the central guard before persistence.

Acceptance:

- No tenant-owned write path silently falls back to global/shared scope.
- Existing preview/demo paths must pass an explicit preview tenant ID rather than bypassing the guard.

Status note:

- Partially complete in P0 round 2.
- Direct purchase creation, player account upsert/unbind, raid mutations, delivery queue/dead-letter restore mutations, and tenant-owned admin notification/security event writes now use the central guard before persistence.
- Tenant-owned delivery audit writes now use the same guard after separating platform-global manual/admin audit events from tenant purchase delivery audit events.
- Event, giveaway, ticket, VIP membership, moderation punishment, top panel message, welcome pack claim, and bounty legacy store mutations now use the same guard.
- Remaining before checking this step: continue auditing broader tenant-owned legacy stores and direct Prisma writes beyond this P0 slice, especially donations, modules, support cases, analytics/automation side effects, and reward paths outside the guarded welcome pack/bounty slice.

- [x] **Step 4: Verify scoped reads and writes**

Run:

```powershell
node scripts/run-tests-with-provider.js test/tenant-db-isolation.test.js test/tenant-store-isolation-batch2.test.js test/admin-tenant-boundary.integration.test.js test/platform-global-read-scope.test.js
```

Expected:

- All listed tests pass.
- Tests prove tenant A cannot read or mutate tenant B data.

- [x] **Step 5: Verify PostgreSQL tenant isolation tooling**

Run:

```powershell
npm run db:tenant-isolation:status
```

Expected:

- Command returns a JSON status.
- If RLS is not installed locally, the output must clearly say disabled/not-installed without crashing.

---

### Task 3: Prove Delivery Agent and Server Bot Runtime Boundary

**Files:**

- Modify: `src/utils/agentRuntimeProfile.js`
- Modify: `src/domain/agents/agentRegistryService.js`
- Modify: `src/services/platformAgentPresenceService.js`
- Modify: `src/services/rconDelivery.js`
- Modify: `src/services/scumServerBotRuntime.js`
- Modify: `src/admin/api/adminRuntimeControlPostRoutes.js`
- Test: `test/runtime-profile.test.js`
- Test: `test/platform-agent-provisioning.integration.test.js`
- Test: `test/agent-registry-platform-apikey-scope.test.js`
- Test: `test/rcon-delivery-scope.test.js`
- Test: `test/bot-interaction-runtime-scope.test.js`

- [x] **Step 1: Add failing boundary tests**

Add or extend tests to prove:

- A `sync_only` Server Bot token cannot claim delivery jobs.
- An `execute_only` Delivery Agent token cannot claim config/restart/server-control jobs.
- A provisioning token cannot be activated with a different role/scope than it was issued for.
- API keys generated during activation contain only the scopes allowed for the runtime role.

Run:

```powershell
node scripts/run-tests-with-provider.js test/runtime-profile.test.js test/platform-agent-provisioning.integration.test.js test/agent-registry-platform-apikey-scope.test.js test/rcon-delivery-scope.test.js test/bot-interaction-runtime-scope.test.js
```

Expected before implementation:

- Any missing boundary checks fail explicitly.

Status note:

- Added contract/unit/integration coverage for mismatched runtime profiles,
  setup-token activation profile changes, execute-token sync attempts,
  execute-token server-config claim attempts, and server-bot delivery reconcile
  attempts.

- [x] **Step 2: Enforce role/scope at every job-claim boundary**

Update the job claim/report code so runtime role and scope are validated at the boundary, not only during provisioning.

Acceptance:

- Delivery job APIs require execute role/scope.
- Config/restart/sync job APIs require sync role/scope.
- Denied claims return consistent reason codes and write a security/audit signal.

Status note:

- Agent provisioning and activation now reject mismatched strict runtime
  profiles.
- Sync ingestion validates the API key binding role/scope and agent/server/guild
  ownership before recording sync payloads.
- Server config job snapshot/claim/result boundaries reject explicit
  delivery-agent runtime profiles before persistence.
- Platform API insufficient-scope denials now record a security signal with the
  API key, tenant, accepted scope sets, and missing scopes when available.

- [x] **Step 3: Verify runtime scripts still boot with correct roles**

Run:

```powershell
npm run runtime:check:delivery-agent
npm run runtime:check:server-bot
```

Expected:

- Delivery Agent check reports execute/delivery configuration only.
- Server Bot check reports sync/config/server-control configuration only.

Status note:

- `npm.cmd run runtime:check:server-bot`: PASS.
- `npm.cmd run runtime:check:delivery-agent`: PASS after supplying required
  test-safe `SCUM_CONSOLE_AGENT_TOKEN`, `SCUM_AGENT_ID`, and
  `SCUM_AGENT_RUNTIME_KEY` values in the shell.

---

### Task 4: Complete Billing to Entitlement Lifecycle Proof

**Files:**

- Modify: `src/services/platformBillingLifecycleService.js`
- Modify: `src/services/platformCommercialService.js`
- Modify: `src/services/platformService.js`
- Modify: `src/domain/billing/packageCatalogService.js`
- Modify: `src/domain/billing/productEntitlementService.js`
- Modify: `src/admin/api/adminBillingPostRoutes.js`
- Modify: `apps/web-portal-standalone/api/publicPlatformRoutes.js`
- Test: `test/platform-billing-lifecycle-service.test.js`
- Test: `test/player-route-entitlements.test.js`
- Create if needed: `test/platform-commercial-lifecycle.integration.test.js`

- [x] **Step 1: Add failing commercial lifecycle test**

Create an integration test for this exact flow:

1. Create preview tenant.
2. Create trial subscription.
3. Convert to paid package.
4. Record payment success.
5. Resolve tenant entitlements.
6. Resolve player entitlements.
7. Cancel or mark subscription inactive.
8. Confirm locked states return.

Run:

```powershell
node scripts/run-tests-with-provider.js test/platform-billing-lifecycle-service.test.js test/player-route-entitlements.test.js test/platform-commercial-lifecycle.integration.test.js
```

Expected before implementation:

- New test fails at the first missing lifecycle transition or entitlement update.

Status note:

- Added `test/platform-commercial-lifecycle.integration.test.js`; red state
  exposed missing commercial lifecycle aliases/canonical states before the
  production changes were applied.
- Current verification command: `node scripts/run-tests-with-provider.js
test/platform-commercial-lifecycle.integration.test.js
test/platform-billing-lifecycle-service.test.js
test/player-route-entitlements.test.js` PASS, 27 passed / 0 failed.

- [x] **Step 2: Normalize subscription lifecycle states**

Ensure billing/subscription code consistently maps provider or internal states to:

- `preview`
- `trialing`
- `active`
- `past_due`
- `cancelled`
- `expired`

Acceptance:

- Entitlement service receives one canonical lifecycle status.
- UI/API locked states include package, required features, and upgrade CTA.

Status note:

- `productEntitlementService`, `platformService`, and `publicPreviewService`
  now normalize subscription lifecycle values to `preview`, `trialing`,
  `active`, `past_due`, `cancelled`, and `expired`.
- Player and tenant entitlement tests cover active/trial unlocks and past-due,
  expired, cancelled, and preview locks.

- [x] **Step 3: Add lifecycle audit events**

Record subscription lifecycle events for:

- preview created
- trial started
- checkout started
- payment succeeded
- payment failed
- package changed
- subscription cancelled
- entitlement locked
- entitlement unlocked

Acceptance:

- Events are queryable through existing billing/audit routes or a clearly named service method.

Status note:

- `platformCommercialService` and `platformBillingLifecycleService` now record
  operator-readable lifecycle events such as `preview.created`,
  `trial.started`, `checkout.started`, `payment.succeeded`, `package.changed`,
  `subscription.cancelled`, `entitlement.unlocked`, and `entitlement.locked`.
- Existing billing event names are still recorded for backward compatibility.

---

### Task 5: Add Destructive-Action Governance

**Files:**

- Modify: `src/services/adminAuditService.js`
- Modify: `src/admin/audit/adminAuditRoutes.js`
- Modify: `src/services/platformServerConfigService.js`
- Modify: `src/services/platformRestartOrchestrationService.js`
- Modify: `src/admin/api/adminRuntimeControlPostRoutes.js`
- Modify: `src/admin/api/adminConfigPostRoutes.js`
- Modify: `src/domain/agents/agentRegistryService.js`
- Test: `test/admin-audit-route.test.js`
- Test: `test/admin-audit-service.scope.test.js`
- Test: `test/platform-restart-orchestration-service.test.js`
- Test: `test/platform-restart-orchestration-service.mode.test.js`

- [x] **Step 1: Add failing audit coverage tests**

Add tests requiring audit records for:

- config save/apply
- config rollback
- restart now
- delayed restart
- server start
- server stop
- provisioning token issue
- agent activation
- role or package change

Run:

```powershell
node scripts/run-tests-with-provider.js test/admin-audit-route.test.js test/admin-audit-service.scope.test.js test/platform-restart-orchestration-service.test.js test/platform-restart-orchestration-service.mode.test.js
```

Expected before implementation:

- Tests fail for missing audit records or missing actor/tenant/reason metadata.

- [x] **Step 2: Standardize destructive action metadata**

Every destructive action must record:

- tenant ID
- actor ID or runtime ID
- actor role
- action type
- target type
- target ID
- reason
- before state when available
- after state when available
- request ID or job ID
- result status

Acceptance:

- Missing tenant/actor/reason fails validation for non-system actions.
- System actions must use a named system actor such as `system:automation` or `system:server-bot`.

- [x] **Step 3: Surface audit records in Owner and Tenant routes**

Owner view must be able to query across tenants.

Tenant view must only query its own tenant.

Acceptance:

- Tenant-scoped admin cannot query another tenant audit record.
- Owner can filter by tenant, actor, action type, and date.

---

### Task 6: Productize Owner Panel Critical Screens

**Files:**

- Modify: `src/admin/runtime/adminPageRuntime.js`
- Modify: `src/admin/assets/owner-v4-app.js`
- Modify: `src/admin/assets/owner-dashboard-v4.js`
- Modify: `src/admin/assets/owner-tenants-v4.js`
- Modify: `src/admin/assets/owner-runtime-health-v4.js`
- Modify: `src/admin/assets/owner-control-v4.js`
- Modify: `src/admin/assets/owner-stitch-live.js`
- Modify: `src/admin/assets/owner-stitch-bridge.js`
- Test: `test/owner-stitch-placeholder-copy.test.js`
- Test: `test/owner-vnext-route-smoke.test.js`
- Test: `test/owner-control-v4.test.js`
- Test: `test/owner-dashboard-v4.test.js`
- Test: `test/owner-tenants-v4.test.js`

- [ ] **Step 1: Inventory owner routes by source type**

Create an owner route inventory in `docs/OWNER_PANEL_ROUTE_READINESS_2026-04-22_TH.md` with columns:

- route
- source file
- API dependencies
- status: live / partial / stitch-only / placeholder
- blocking gap
- test file

Acceptance:

- Every `/owner/*` path in `adminPageRuntime.js` is listed.
- Stitch-only routes are not marked production-ready.

- [ ] **Step 2: Add failing tests for placeholder leakage**

Extend `test/owner-stitch-placeholder-copy.test.js` so critical owner routes fail when they show placeholder copy as if it were live data.

Critical routes:

- `/owner`
- `/owner/tenants`
- `/owner/packages`
- `/owner/billing`
- `/owner/runtime`
- `/owner/support`
- `/owner/audit`
- `/owner/security`

Run:

```powershell
node scripts/run-tests-with-provider.js test/owner-stitch-placeholder-copy.test.js test/owner-vnext-route-smoke.test.js
```

Expected:

- Routes either render live state, explicit disabled state, or explicit non-production state.

- [ ] **Step 3: Wire owner critical cards to real APIs**

Replace critical fake/static values with read-only API-backed state first.

Acceptance:

- Tenant count comes from platform tenant service.
- Package count comes from package catalog service.
- Billing summary comes from billing overview route.
- Runtime health comes from platform agent/server monitoring.
- Audit/security summaries come from audit/security event stores.

---

### Task 7: Verify Tenant Admin and Player Portal End-to-End Flows

**Files:**

- Modify: `src/admin/assets/tenant-v4-app.js`
- Modify: `src/admin/assets/tenant-console.js`
- Modify: tenant feature assets under `src/admin/assets/tenant-*.js`
- Modify: `apps/web-portal-standalone/public/assets/player-v4-app.js`
- Modify: `apps/web-portal-standalone/public/assets/player-control-v4.js`
- Modify: `apps/web-portal-standalone/api/playerCommerceRoutes.js`
- Modify: `apps/web-portal-standalone/api/playerGeneralRoutes.js`
- Test: `test/tenant-v4-app-surface-redirect.test.js`
- Test: `test/tenant-player-workflow-v4.test.js`
- Test: `test/web-portal-standalone.player-mode.integration.test.js`
- Test: `test/player-profile-route.test.js`
- Test: `test/player-support-route.test.js`

- [ ] **Step 1: Add tenant flow smoke tests**

Tenant flow smoke must cover:

- dashboard load
- package locked state
- server config workspace load
- config save-only request
- config save-restart request
- restart status view
- delivery agent list/provision CTA
- server bot list/provision CTA
- diagnostics bundle request

Run:

```powershell
node scripts/run-tests-with-provider.js test/tenant-v4-app-surface-redirect.test.js test/tenant-player-workflow-v4.test.js test/admin-tenant-diagnostics-route.test.js
```

Expected:

- Tenant flow tests pass without mock-only data unless explicitly running in mock mode.

- [ ] **Step 2: Add player flow smoke tests**

Player flow smoke must cover:

- login/session load
- linked account summary
- Steam link state
- shop load
- cart add/remove
- checkout/order create
- order detail
- delivery status
- stats/leaderboard/killfeed
- raid/support/profile

Run:

```powershell
node scripts/run-tests-with-provider.js test/web-portal-standalone.player-mode.integration.test.js test/player-profile-route.test.js test/player-support-route.test.js test/player-route-entitlements.test.js
```

Expected:

- Player flow tests pass with seeded tenant/player data.
- Missing package feature returns locked state instead of broken UI.

---

### Task 8: Browser Security and i18n Cleanup

**Files:**

- Modify: `apps/web-portal-standalone/public/assets/player-auth-v1.js`
- Modify: `apps/web-portal-standalone/public/assets/player-commerce-v4.js`
- Modify: `apps/web-portal-standalone/public/assets/player-control-v4.js`
- Modify: `apps/web-portal-standalone/public/assets/player-core.js`
- Modify: `apps/web-portal-standalone/public/assets/player-v4-app.js`
- Modify: `src/admin/assets/console-shared.js`
- Modify: `src/admin/assets/dashboard-*.js`
- Modify: `src/admin/assets/admin-i18n.js`
- Modify: `apps/web-portal-standalone/public/assets/portal-i18n.js`
- Modify: locale JSON files under `apps/web-portal-standalone/public/assets/locales/`
- Test: `test/ui-i18n-runtime.test.js`
- Test: `test/player-portal-i18n.test.js`
- Create if needed: `test/browser-rendering-safety.test.js`

- [ ] **Step 1: Add sink inventory**

Create `docs/BROWSER_RENDERING_SECURITY_INVENTORY_2026-04-22_TH.md` with:

- file path
- line range
- sink type: `innerHTML`, `insertAdjacentHTML`, `outerHTML`
- data source: constant, API, URL, storage, user-generated
- required action: keep, escape, replace with DOM API, sanitize

Acceptance:

- Every high-signal sink found in player/admin assets is listed.
- API/user-derived sinks are marked for code cleanup.

- [ ] **Step 2: Add failing tests for unsafe rendering helpers**

Create or extend tests so rendering helpers must escape user-provided strings before injecting into HTML.

Run:

```powershell
node scripts/run-tests-with-provider.js test/ui-i18n-runtime.test.js test/player-portal-i18n.test.js test/browser-rendering-safety.test.js
```

Expected before implementation:

- Tests fail where user/API data can reach HTML string rendering without escaping.

- [ ] **Step 3: Migrate hardcoded user-visible strings to i18n keys**

Move hardcoded Thai/English strings from player and admin assets into locale dictionaries.

Acceptance:

- Language switcher can render English and Thai for affected screens.
- Missing keys fail tests or produce explicit key markers in development.

---

### Task 9: Final Managed-Service Ready Gate

**Files:**

- Create: `docs/MANAGED_SERVICE_READY_GATE_2026-04-22_TH.md`
- Modify: `docs/MANAGED_SERVICE_READINESS_AUDIT_2026-04-22_TH.md`

- [ ] **Step 1: Run complete verification commands**

Run:

```powershell
npm run lint:syntax
npm run test:policy
npm run readiness:prod
npm run security:check
npm run runtime:check:delivery-agent
npm run runtime:check:server-bot
```

Expected:

- Every command passes.
- If a command fails, do not mark the platform Managed-Service Ready.

- [ ] **Step 2: Update readiness audit**

Update `docs/MANAGED_SERVICE_READINESS_AUDIT_2026-04-22_TH.md` only after verification passes.

Acceptance:

- Scores can increase only for areas with passing tests and repo evidence.
- Owner/tenant/player UI readiness can increase only after live route/API tests pass.
- Commercial readiness can increase only after billing entitlement lifecycle tests pass.

- [ ] **Step 3: Write final go/no-go file**

Write `docs/MANAGED_SERVICE_READY_GATE_2026-04-22_TH.md` with:

```markdown
# Managed-Service Ready Gate 2026-04-22

## Decision

- GO or NO-GO

## Required Passing Commands

- `npm run lint:syntax`
- `npm run test:policy`
- `npm run readiness:prod`
- `npm run security:check`
- `npm run runtime:check:delivery-agent`
- `npm run runtime:check:server-bot`

## Evidence

- Command output summaries.
- Test files changed.
- Production files changed.
- Remaining accepted risks.

## Commercial Boundary

- State whether the platform is internal pilot, managed-service ready, or sellable.
```

---

## Self-Review Checklist

- Spec coverage: This plan covers all P0 gaps from the readiness audit and routes P1/P2 work into testable follow-up tasks.
- Placeholder scan: No task uses placeholder labels for unknown ownership. Any broad subsystem has an explicit child-plan rule before coding.
- Type consistency: Existing file/function names are referenced where known; new documents and test files have exact paths.
- Execution safety: No implementation should start from the dirty shared worktree without first capturing baseline state and isolating the work.
- Verification: No maturity score should be raised until the matching commands pass and the evidence is written.
