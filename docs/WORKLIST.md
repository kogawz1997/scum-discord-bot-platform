# Worklist

This file is the source of truth for work that is still open after the latest workstation audit.

Last updated: `2026-04-02`

The current workstation is no longer in the broad local-runtime cleanup state. The remaining backlog is now mostly runtime-blocked or product-readiness work rather than basic local bring-up.

## Status Labels

- `open`: required work remains in-repo or on the current runtime profile
- `partial`: implementation exists but is not clean or complete enough
- `runtime-blocked`: depends on live infrastructure or machine-specific setup outside the repo alone
- `deferred`: valid future work, but not first priority

## P0 Local Runtime / Validation Cleanup

### 1. Clean production-profile bot startup on this workstation

- Status: `closed`
- Current state:
  - `scum-bot` is online
  - health endpoint returns `ok=true` and `discordReady=true`
  - latest PM2 logs no longer show the earlier local production-guard / schema-alignment warnings as an active current issue
- What is still open:
  - none on this workstation
- Main files:
  - [../src/bot.js](../src/bot.js)
  - [../src/services/platformService.js](../src/services/platformService.js)
  - [../src/data/repositories/controlPlaneRegistryRepository.js](../src/data/repositories/controlPlaneRegistryRepository.js)
  - [../src/admin/runtime/adminEnvRuntime.js](../src/admin/runtime/adminEnvRuntime.js)

### 2. Revalidate player portal after the latest PM2 recovery

- Status: `closed`
- Current state:
  - `scum-web-portal` is online
  - health endpoint returns `200 OK`
  - `player-capture-verify.js` passed for the current shell/workbench flow
- What is still open:
  - none on this workstation
- Main files:
  - [../apps/web-portal-standalone/runtime/portalBootstrapRuntime.js](../apps/web-portal-standalone/runtime/portalBootstrapRuntime.js)
  - [../apps/web-portal-standalone/api/playerGeneralRoutes.js](../apps/web-portal-standalone/api/playerGeneralRoutes.js)
  - [../apps/web-portal-standalone/public/assets/player-v4-app.js](../apps/web-portal-standalone/public/assets/player-v4-app.js)

### 3. Revalidate Discord admin SSO on a real role mapping

- Status: `runtime-blocked`
- Current state:
  - admin DB login is verified locally
  - Discord SSO code path exists
  - current guild role export on this workstation does not prove the configured admin role mapping
- What is still open:
  - test admin SSO against a guild that actually contains the intended owner/admin/moderator roles
  - confirm role-to-permission mapping end-to-end
- Main files:
  - [../src/admin/auth/adminDiscordOauthClient.js](../src/admin/auth/adminDiscordOauthClient.js)
  - [../src/admin/auth/adminAuthRuntime.js](../src/admin/auth/adminAuthRuntime.js)
  - [../scripts/export-admin-discord-roles.js](../scripts/export-admin-discord-roles.js)

## P1 Product-Readiness Foundation

### 4. Keep runtime install / validation tooling aligned with the current local topology

- Status: `closed`
- Current state:
  - install scripts for `Server Bot` and `Delivery Agent` now generate machine-local env bundles
  - generated bundles are checked immediately through `scripts/runtime-env-check.js`
  - runtime operator checklist has been updated to the new env-check first flow
- What is still open:
  - none on this workstation
- Main files:
  - [../scripts/install-server-bot.ps1](../scripts/install-server-bot.ps1)
  - [../scripts/install-delivery-agent.ps1](../scripts/install-delivery-agent.ps1)
  - [../scripts/runtime-env-check.js](../scripts/runtime-env-check.js)
  - [RUNTIME_OPERATOR_CHECKLIST.md](./RUNTIME_OPERATOR_CHECKLIST.md)
### 5. Finish billing / subscription lifecycle to commercial depth

- Status: `partial`
- Current state:
  - billing and subscription foundation exists in schema/services
  - owner billing views and public checkout foundations exist in code
- What is still open:
  - harden provider-backed renew/fail/cancel/retry flows
  - prove webhook idempotency and invoice lifecycle
  - add owner-facing billing operations deep enough for support/recovery
- Main files:
  - [../src/services/platformBillingLifecycleService.js](../src/services/platformBillingLifecycleService.js)
  - [../src/services/platformService.js](../src/services/platformService.js)
  - [../src/admin/api/adminPlatformPostRoutes.js](../src/admin/api/adminPlatformPostRoutes.js)
  - [../apps/web-portal-standalone/api/publicPlatformRoutes.js](../apps/web-portal-standalone/api/publicPlatformRoutes.js)

### 6. Finish unified identity across email, Discord, Steam, and in-game

- Status: `partial`
- Current state:
  - schema and service foundations exist
  - email preview/login/reset, Discord login, and Steam linking all exist in some form
- What is still open:
  - make identity a single finished user journey instead of separate capability slices
  - complete verification, recovery, linked-account center, and in-game matching flows
- Main files:
  - [../src/services/platformIdentityService.js](../src/services/platformIdentityService.js)
  - [../src/services/publicPreviewService.js](../src/services/publicPreviewService.js)
  - [../apps/web-portal-standalone/auth/portalAuthRuntime.js](../apps/web-portal-standalone/auth/portalAuthRuntime.js)
  - [../src/services/linkService.js](../src/services/linkService.js)

### 7. Normalize persistence for core paths

- Status: `partial`
- Current state:
  - PostgreSQL + Prisma are active on this workstation
  - some core control-plane and config paths still mix Prisma, raw SQL, and fallback persistence
- What is still open:
  - reduce hybrid persistence in core runtime-sensitive paths
  - make schema/migration ownership clearer for control-plane, config, and identity data
- Main files:
  - [../src/prisma.js](../src/prisma.js)
  - [../src/data/repositories/controlPlaneRegistryRepository.js](../src/data/repositories/controlPlaneRegistryRepository.js)
  - [../src/store/_persist.js](../src/store/_persist.js)
  - [../src/services/platformTenantConfigService.js](../src/services/platformTenantConfigService.js)
  - [../src/services/platformServerConfigService.js](../src/services/platformServerConfigService.js)

## P2 Product Systems Still Not Finished

### 8. Productize tenant staff / permissions and Discord management

- Status: `partial`
- Current state:
  - tenant staff foundation and some tenant Discord UI work exist
- What is still open:
  - complete the staff permission matrix
  - expand tenant-owned Discord setup and diagnostics into a full product workflow
- Main files:
  - [../src/services/platformTenantStaffService.js](../src/services/platformTenantStaffService.js)
  - [../src/admin/assets/tenant-v4-app.js](../src/admin/assets/tenant-v4-app.js)
  - [../src/admin/assets/tenant-server-bots-v4.js](../src/admin/assets/tenant-server-bots-v4.js)

### 9. Build first-class donation, modules, raid, and killfeed systems

- Status: `open`
- Current state:
  - there are supporting building blocks and entitlements
  - there is not yet a finished first-class product system for these areas
- What is still open:
  - donation / supporter lifecycle
  - module/plugin management lifecycle
  - raid request / raid window / raid summary
  - player-facing killfeed product surface
- Main files:
  - [../src/domain/billing/packageCatalogService.js](../src/domain/billing/packageCatalogService.js)
  - [../src/services/eventService.js](../src/services/eventService.js)
  - [../src/services/scumEvents.js](../src/services/scumEvents.js)
  - [../apps/web-portal-standalone/api/playerGeneralRoutes.js](../apps/web-portal-standalone/api/playerGeneralRoutes.js)

### 10. Deepen analytics / reporting

- Status: `partial`
- Current state:
  - dashboards and some summaries exist
- What is still open:
  - add product-grade reporting for revenue, player behavior, delivery quality, restart reliability, and tenant health
- Main files:
  - [../src/services/platformService.js](../src/services/platformService.js)
  - [../src/services/platformMonitoringService.js](../src/services/platformMonitoringService.js)
  - [../src/admin/assets/owner-v4-app.js](../src/admin/assets/owner-v4-app.js)
  - [../src/admin/assets/tenant-v4-app.js](../src/admin/assets/tenant-v4-app.js)

## P3 Polish / Architecture Cleanup

### 11. Finish i18n and UX cleanup

- Status: `partial`
- Current state:
  - locale dictionaries and switchers exist
  - some older text and encoding-quality issues still remain
- What is still open:
  - remove hardcoded text where it still matters
  - clean remaining mojibake/encoding debt
  - improve consistency of loading, error, locked, and empty states
- Main files:
  - [../src/admin/assets/admin-i18n.js](../src/admin/assets/admin-i18n.js)
  - [../apps/web-portal-standalone/public/assets/portal-i18n.js](../apps/web-portal-standalone/public/assets/portal-i18n.js)
  - [../src/admin/assets/owner-v4-app.js](../src/admin/assets/owner-v4-app.js)
  - [../src/admin/assets/tenant-v4-app.js](../src/admin/assets/tenant-v4-app.js)
  - [../apps/web-portal-standalone/public/assets/player-v4-app.js](../apps/web-portal-standalone/public/assets/player-v4-app.js)

### 12. Keep service boundaries moving away from the remaining monolith seams

- Status: `partial`
- Current state:
  - runtime separation is much better than before
  - some boundary seams are still broad, especially around admin/control-plane orchestration
- What is still open:
  - reduce dependence on `apps/api/server.js -> src/adminWebServer.js`
  - keep splitting large multi-concern services into clearer bounded contexts
- Main files:
  - [../apps/api/server.js](../apps/api/server.js)
  - [../src/adminWebServer.js](../src/adminWebServer.js)
  - [../src/services/platformService.js](../src/services/platformService.js)
