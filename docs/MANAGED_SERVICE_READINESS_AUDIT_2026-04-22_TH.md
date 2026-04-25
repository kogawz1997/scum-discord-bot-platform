# 1. Executive Summary

Audit date: 2026-04-22

This repository is already beyond a small Discord bot or single admin tool. It contains a broad SCUM control-plane platform with multiple web surfaces, runtime agents, persistence, package/entitlement logic, billing scaffolding, player portal flows, config jobs, restart orchestration, diagnostics, audit/security stores, and many tests.

What the project is now:

- A managed-service prototype with substantial backend/runtime foundations.
- A mixed codebase containing production-oriented modules, legacy bot/player data models, standalone web surfaces, owner/tenant/player UI assets, and stitch/prototype screens.
- A project with many readiness docs and scripts, but not yet a clean commercial release state.

What it is closest to becoming:

- Closest level: Managed-Service Prototype.
- Next realistic target: Managed-Service Ready, after P0/P1 gaps are closed and verified end-to-end.
- It is not yet SaaS Foundation or Commercial-Ready Service because tenant isolation, commercial lifecycle, UI completion, runtime operational proof, and support/monitoring are not proven at production depth.

Overall maturity rating:

- Managed-Service Prototype.
- Post-audit hardening update on 2026-04-22: the P0 tenant-isolation slice now
  has central mutation guards and passing targeted tests for purchase creation,
  player account upsert/unbind, raid mutations, delivery queue/dead-letter
  restore, tenant-owned admin notification/security events, tenant-owned
  delivery audit writes, event/giveaway/ticket/VIP tenant store mutations, and
  moderation/top-panel/welcome-pack/bounty tenant store mutations.
  This improves the persistence/security posture, but it does not yet make the
  whole platform sellable because broader legacy store/service mutations,
  commercial lifecycle, runtime boundary proof, and production UI flows still
  need verification.
- Overall score: 2.7 / 5.

# 2. What is Already Strong

- Runtime separation has real code behind it. `apps/agent/server.js` loads `src/delivery-agent.js`, while `apps/server-bot/server.js` starts `src/services/scumServerBotRuntime.js`. `src/utils/agentRuntimeProfile.js` defines `sync_only` and `execute_only` scopes, and `src/domain/agents/agentRegistryService.js` enforces strict role/scope during provisioning and activation.
- Delivery Agent vs Server Bot intent is clear in implementation. `src/services/rconDelivery.js` owns delivery queue, retry/dead-letter handling, delivery command generation, teleport/spawn profiles, and announce support. `src/services/scumServerBotRuntime.js` is sync/config/server-control oriented, uses role `sync`, scope `sync_only`, and handles config jobs, backups, rollback, restart/start/stop templates.
- Control plane has broad real backend coverage. `src/adminWebServer.js` imports and wires services for tenants, subscriptions, package catalog, agents, purchases, delivery, raids, killfeed, notifications, audit, observability, automation, diagnostics, config, restart, and workspace auth.
- Persistence foundation is substantial. `prisma/schema.prisma` contains platform models for tenants, subscriptions, users, identities, verification/password-reset tokens, billing, package catalog, config jobs, restart plans, security events, request logs, control-plane agents, provisioning tokens, devices, credentials, sessions, and sync runs.
- Package and feature gating exists in code. `src/domain/billing/productEntitlementService.js` builds tenant/player section and action locks, while `src/admin/api/tenantRouteEntitlements.js` and `apps/web-portal-standalone/api/playerRouteEntitlements.js` enforce denied feature responses at API boundaries.
- Config editing is not just a UI stub. `src/services/serverBotConfigSchemaService.js`, `src/services/platformServerConfigService.js`, and `src/services/scumServerBotRuntime.js` provide typed metadata, validation, config jobs, backups, temp-file writes, atomic rename, rollback, and restart-required metadata.
- Security baseline is better than typical prototype code. `src/utils/env.js` enforces production secret/origin/secure-cookie/2FA checks, `src/admin/runtime/adminEnvRuntime.js` has session TTL/idle/max-session/rate-limit settings, and `src/admin/runtime/adminHttpRuntime.js` emits security headers including CSP, frame deny, nosniff, and cross-origin policies.
- Test coverage is broad in count and scope. The repository has about 282 `*.test.js` files and about 41 `*.integration.test.js` files under `test/`, covering agent provisioning, tenant isolation, portal auth/runtime, platform services, restart orchestration, route entitlements, delivery, stores, and UI assets.

# 3. What is Partial / Unfinished

- Owner Panel is only partially productized. `apps/owner-web/server.js` is a standalone surface, but `src/admin/runtime/adminPageRuntime.js` maps many `/owner/*` paths to files under `stitch/owner-pages`, and owner assets include placeholder visuals. This proves routing and visual coverage, not complete product-grade workflows.
- Tenant Admin Panel has many operational modules, but full end-to-end readiness is not proven. There are API routes and assets for config, restart, delivery agents, server bots, logs sync, players, orders, donations, events, modules, staff, analytics, and diagnostics. The remaining risk is whether every UI action is wired to real backend state and validated under real tenant permissions/packages.
- Player Portal has real auth and commerce routes, but mixed legacy/platform linkage remains. `apps/web-portal-standalone/api/playerCommerceRoutes.js` and `playerGeneralRoutes.js` cover shop, cart, orders, wallet, stats, profile, support, raids, donations, and killfeed; however, identity linking and player matching still depend on both platform identity services and legacy stores/models.
- Billing/subscription system is scaffolded into code, but not commercially complete. `src/services/platformService.js`, billing routes, package catalog, invoices, payment attempts, and checkout session routes exist. Missing proof includes payment provider webhook lifecycle, dunning, cancellation, refund/support workflows, and purchase-to-entitlement activation across all surfaces.
- Restart orchestration is partial. `PlatformRestartPlan`, `PlatformRestartAnnouncement`, and `PlatformRestartExecution` exist, and config save/apply/rollback can schedule restart plans. However, safe restart, countdown announce, and post-restart health verification need stronger proof.
- Internationalization is partial. Locale files exist at `apps/web-portal-standalone/public/assets/locales/en` and `th`, but many JS assets still contain hardcoded Thai/English strings. This means translation key discipline is not complete.
- Security/operations are partial. There are strong app-level controls, but the codebase still uses many `innerHTML` rendering sinks in browser assets, which requires systematic sanitization/Trusted Types/CSP verification before public multi-tenant exposure.
- Release state is not clean. `git status --short` shows a very large dirty worktree across env examples, apps, Prisma schemas/db, scripts, source files, tests, stitch assets, and untracked owner prototype files. This is normal during active development, but not acceptable as a production-release baseline.

# 4. What is Missing

- A proven clean production release path. The repo has scripts and docs, but the current worktree state is too dirty to call release-ready.
- Hard tenant isolation across all persistence paths. The current P0 slice now guards several critical tenant-owned write paths, including event/giveaway/ticket/VIP/moderation/top-panel/welcome-pack/bounty tenant stores, but legacy models still include nullable `tenantId` or global identifiers, and broader donation/module/reward/support-case paths still need the same level of proof.
- A fully verified self-service commercial funnel: signup -> preview/trial -> package purchase -> subscription active -> entitlement activation -> tenant onboarding -> runtime agent install -> live server validation.
- Formal customer support operations: support case lifecycle, safe support access, tenant incident timeline, evidence bundle export, escalation states, and customer-facing status visibility.
- Complete external monitoring and alerting. Internal notifications, request logs, security events, platform monitoring, and automation state exist, but production SLOs, alert routing, on-call runbooks, and hosted observability are not proven.
- Complete i18n for web and Discord/system messaging. Current locale files are not enough to prove English + Thai readiness across every surface.
- Formal destructive-action governance. Restart/start/stop/config write/rollback/token issue/permission changes need consistent approval, audit log, actor, tenant, reason, before/after state, and recovery flow.
- Production-grade browser security cleanup. Public and admin assets use many `innerHTML` patterns; these may be safe in some constant-template cases, but they need systematic review because API/user-derived values are rendered in several UI paths.

# 5. Detailed Readiness Checklist

## 1. Repository architecture

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: top-level `apps/`, `src/`, `prisma/`, `docs/`, `scripts/`, `deploy/`, `test/`; separate app entrypoints for owner, tenant, player portal, agent, server bot, worker, watcher, API, Discord bot.
- Main gaps: production modules, legacy modules, owner prototype, and stitch artifacts coexist; ownership boundaries are not fully clean; current worktree is heavily dirty.
- Risk level: Medium.

## 2. Backend / control plane

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `src/adminWebServer.js`; `src/admin/api/adminAuthPostRoutes.js`, `adminBillingGetRoutes.js`, `adminBillingPostRoutes.js`, `adminCommerceDeliveryPostRoutes.js`, `adminPlatformPostRoutes.js`, `adminRuntimeControlPostRoutes.js`, `adminDiagnosticsGetRoutes.js`, `adminPublicRoutes.js`.
- Main gaps: broad code coverage exists, but commercial-grade flow proof is missing across provisioning, activation, billing lifecycle, config/restart, sync, delivery, donations/events/modules, raids, analytics, audit, and automation.
- Risk level: High.

## 3. Database / persistence

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `prisma/schema.prisma` includes platform, billing, identity, agent, config, restart, notification, security, request-log, and package models. It also includes legacy models such as `Purchase`, `PlayerAccount`, `KillFeedEvent`, and shop/player stores.
- Main gaps: legacy/global data paths and nullable tenant fields remain; tenant isolation is now proven for several P0 write paths, but not mandatory everywhere; SQLite/PostgreSQL/multi-provider strategy increases migration risk.
- Risk level: High.

## 4. Owner Panel readiness

- Score: 2 / 5.
- Status: partial / placeholder.
- Evidence from repo: `apps/owner-web/server.js`, `apps/owner-ui-prototype/`, `src/admin/owner-console.html`, owner assets, and `stitch/owner-pages`. `src/admin/runtime/adminPageRuntime.js` maps many owner routes to stitch HTML templates.
- Main gaps: routes and screens exist, but many owner flows are stitch/prototype-backed. Tenant creation, package management, billing recovery, support, diagnostics, audit/security, and runtime operations need product-grade wiring and verification.
- Risk level: High.

## 5. Tenant Admin Panel readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `apps/tenant-web/server.js`, `src/admin/tenant-console.html`, tenant assets, `adminRuntimeControlPostRoutes.js`, `adminConfigPostRoutes.js`, tenant entitlement/permission gates, config/restart/agent/server-bot routes.
- Main gaps: every page/button must be verified against real backend state; package awareness and locked states must be consistent; diagnostics/support actions need production polish.
- Risk level: High.

## 6. Player Portal readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `apps/web-portal-standalone/server.js`, `playerCommerceRoutes.js`, `playerGeneralRoutes.js`, portal auth runtime, public platform routes, player assets, locale files.
- Main gaps: wallet/shop/orders/delivery/stats/leaderboard/killfeed/raids/profile exist in routes/assets, but hardcoded UI text and legacy identity/player data paths remain; end-to-end order-to-delivery proof is still required.
- Risk level: Medium-High.

## 7. Identity linking readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `apps/web-portal-standalone/auth/portalAuthRuntime.js` supports Discord and Google OAuth; `src/services/platformIdentityService.js` handles platform users, identities, memberships, profiles, linked summaries, Steam/in-game fields, verification/password reset tokens; `src/commands/linksteam.js` exists.
- Main gaps: full verification flow across Discord/Web/Steam/In-game is not proven; in-game player matching needs stricter lifecycle and conflict handling; legacy identity compatibility remains.
- Risk level: High.

## 8. Delivery Agent readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `apps/agent/server.js`, `src/delivery-agent.js`, `src/scum-console-agent.js`, `src/services/rconDelivery.js`, agent provisioning/binding code in `agentRegistryService.js`, runtime install/check scripts.
- Main gaps: job handling exists, but production proof still needs reconnect behavior, idempotency across process restarts, version/update flow, native proof under real SCUM client conditions, and operator diagnostics.
- Risk level: High.

## 9. Server Bot readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `apps/server-bot/server.js`, `src/services/scumServerBotRuntime.js`, `src/services/platformAgentPresenceService.js`, config root/backup root, sync-only role/scope, config job polling, server start/stop/restart template hooks.
- Main gaps: config read/write and backup flow are strong, but full SCUM.log sync, restart health verification, production diagnostics, and runtime upgrade path need more proof.
- Risk level: High.

## 10. Config system readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `serverBotConfigSchemaService.js` defines typed config metadata; `platformServerConfigService.js` normalizes types, min/max, requiresRestart, jobs, backups, rollback; `scumServerBotRuntime.js` writes temp files and renames atomically.
- Main gaps: frontend field typing and backend validation parity must be verified; rollback UX and diff/audit evidence need consistent product flow; restart-required metadata must drive UX and orchestration everywhere.
- Risk level: Medium-High.

## 11. Restart orchestration readiness

- Score: 2 / 5.
- Status: partial.
- Evidence from repo: `PlatformRestartPlan`, `PlatformRestartAnnouncement`, `PlatformRestartExecution`; `platformRestartOrchestrationService.js`; config apply/rollback can schedule restart plans and record execution.
- Main gaps: restart-now/delayed paths exist conceptually, but safe restart, countdown announce, command verification, failure recovery, and post-restart health verification are not proven enough for commercial service.
- Risk level: High.

## 12. Package / feature gating readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: `packageCatalogService.js`, `productEntitlementService.js`, `tenantRouteEntitlements.js`, `playerRouteEntitlements.js`, billing/package models and routes.
- Main gaps: backend enforcement must be audited across every mutation; frontend dynamic navigation and locked-state consistency need verification; preview/purchase-to-entitlement activation is not fully proven.
- Risk level: High.

## 13. Internationalization readiness

- Score: 2 / 5.
- Status: partial.
- Evidence from repo: `apps/web-portal-standalone/public/assets/locales/en/portal-ui-extra.json`, `th/portal-ui-extra.json`, admin/player i18n assets.
- Main gaps: many JS assets still contain hardcoded Thai text and hardcoded English operational strings; Discord/system messages are not proven translation-ready.
- Risk level: Medium.

## 14. Productization / commercial readiness

- Score: 2 / 5.
- Status: partial.
- Evidence from repo: public portal pages for pricing/signup/trial/preview, billing routes, platform commercial services, package catalog, docs such as `CUSTOMER_ONBOARDING.md`, `GO_LIVE_CHECKLIST_TH.md`, and `PRODUCT_READY_GAP_MATRIX.md`.
- Main gaps: code and docs exist, but serious managed-service launch needs a verified commercial funnel, payment webhooks, trial conversion, cancellation/dunning, tenant onboarding automation, support workflow, and production release discipline.
- Risk level: High.

## 15. Security / operations readiness

- Score: 3 / 5.
- Status: partial.
- Evidence from repo: production env checks in `src/utils/env.js`; session/rate/2FA config in `adminEnvRuntime.js`; security headers in `adminHttpRuntime.js`; tenant-scope mismatch logging in `adminAccessRuntime.js`; token hashing/device binding in `agentRegistryService.js`; audit/security/request-log stores and Prisma models.
- Main gaps: many browser assets use `innerHTML`; CSRF/origin behavior must be verified across every cookie-authenticated state-changing route; tenant isolation must become mandatory; external monitoring/alerting/runbooks are not fully proven; worktree is not release-clean.
- Risk level: High.

# 6. Critical Gaps Before Real Service Launch

1. Make tenant isolation non-optional across all data paths.

   - Convert or quarantine legacy global models.
   - Enforce tenant scope at repository/service level, not only route level.
   - Verify PostgreSQL RLS/topology scripts against real deployment.
   - Current progress: central guard and targeted tests now cover purchase,
     player account, raid, delivery queue/dead-letter, tenant-owned
     notification/security events, tenant-owned delivery audit rows,
     event/giveaway/ticket/VIP tenant stores, and
     moderation/top-panel/welcome-pack/bounty tenant stores.

2. Freeze runtime boundaries.

   - Delivery Agent must only execute delivery/in-game command work.
   - Server Bot must only sync logs/config/server-control work.
   - Tokens, scopes, UI actions, API routes, and command templates must prove this separation.

3. Complete the commercial lifecycle.

   - Self-service signup, preview, trial, package purchase, payment webhook, subscription status, entitlement activation, package downgrade/upgrade, cancellation, and dunning must be end-to-end tested.

4. Productize Owner Panel.

   - Replace stitch/prototype-backed owner routes with real stateful screens or clearly mark them as non-production.
   - Prioritize tenant management, package management, billing, provisioning, fleet diagnostics, support, audit/security.

5. Verify Tenant Admin and Player Portal flows with real state.

   - Tenant: config save/apply/rollback, restart, server bot, delivery agent, shop/orders, staff, diagnostics.
   - Player: login, account linking, wallet, shop, order, delivery, stats, events, raid, support/profile.

6. Harden browser security.

   - Audit `innerHTML` sinks.
   - Ensure all API/user-derived values are escaped or rendered through safe DOM APIs.
   - Verify CSP at runtime for owner, tenant, admin, and player surfaces.

7. Complete i18n.

   - Remove hardcoded Thai/English UI strings from browser assets.
   - Add translation coverage for Discord messages, errors, notifications, locked states, and commercial flows.

8. Build production operations.
   - External monitoring, alert routing, incident response, support diagnostics, backup/restore drills, restart failure runbooks, and release checklist.

# 7. Recommended Priority Order

## P0 (must fix first)

- Tenant isolation hardening and proof.
- Runtime boundary audit for Delivery Agent vs Server Bot.
- Auth/session/permission/CSRF/origin enforcement audit.
- Billing/subscription/entitlement lifecycle implementation proof.
- Audit log coverage for destructive actions.
- Clean release branch with migration/readiness gate passing.

## P1

- Owner Panel productization for tenant/package/billing/provisioning/support/security.
- Tenant Admin e2e verification for config, restart, agents, server bots, orders, diagnostics.
- Player Portal e2e verification for login, identity linking, wallet, shop, orders, delivery, stats, raids.
- Server Bot SCUM.log sync and restart health verification.
- Delivery Agent reconnect/idempotency/native proof validation.

## P2

- Full i18n key migration.
- Browser XSS sink cleanup and Trusted Types/CSP strategy.
- Support console, incident timeline, evidence bundle export.
- External monitoring, alerts, SLOs, runbooks.
- Package locked-state and dynamic nav consistency.

## P3

- UI polish after real flows are stable.
- Advanced analytics and automation.
- Marketplace/module packaging.
- Billing optimization and revenue reporting.
- Documentation cleanup and customer-facing onboarding refinements.

# 8. Final Verdict

Can this be used now?

- Yes, as an internal controlled pilot or technical preview.
- It can likely support guided demos and operator-driven validation.
- It should not yet be treated as unattended production infrastructure for paying tenants.

Can this be sold now?

- No, not as a serious managed service.
- The repo has a strong foundation, but the commercial, operational, tenant-isolation, UI-completeness, and release-readiness gaps are still too large.

What level is it at today?

- Current level: Managed-Service Prototype.
- It is stronger than a hobby/internal tool because the repo has real multi-surface architecture, runtime separation, platform schema, provisioning, entitlements, config jobs, and operations scaffolding.
- It is not yet Managed-Service Ready because the product flows and production controls are not fully proven end-to-end.
