# Commit `c59fe83` File Matrix

Read in Thai: [COMMIT_C59FE83_FILE_MATRIX_TH.md](./COMMIT_C59FE83_FILE_MATRIX_TH.md)

This appendix lists every file touched by commit `c59fe83` and explains its role in the change set.

## Added Files

- `src/services/platformPortalBrandingService.js` - New branding builder for public/player surfaces. Normalizes site name, logo, banner, color tokens, and theme presets from tenant config.
- `test/admin-security-runtime.test.js` - New regression coverage for admin security signals, warning-level events, and notification suppression behavior.
- `test/delivery-audit-store.test.js` - New regression coverage for delivery-audit dedupe and replace/upsert behavior.
- `test/platform-monitoring-service.test.js` - New monitoring coverage for subscription-risk and ops-alert generation.
- `test/platform-portal-branding-service.test.js` - New unit tests for tenant portal branding normalization and theme token output.
- `test/prisma-runtime-profile.test.js` - New tests for Prisma runtime-profile/provider-truth helpers.

## Environment and Config Examples

- `.env.example` - Adds `SCUM_CONSOLE_AGENT_ALLOW_MANAGED_SERVER_CONTROL=false` so managed server control stays explicitly gated.
- `.env.production.example` - Adds the same managed-server-control env for production templates.

## Public and Player Surface Files

- `apps/web-portal-standalone/api/playerGeneralRoutes.js` - Uses centralized identity summary and returns more coherent player/profile state.
- `apps/web-portal-standalone/api/publicPlatformRoutes.js` - Implements `/api/public/server/:slug/(workspace|stats|shop|events|donate)` and composes tenant-isolated public workspace payloads.
- `apps/web-portal-standalone/public/assets/player-auth-v1.js` - Updates player auth UI wiring so login/account flows match the newer identity and portal state model.
- `apps/web-portal-standalone/public/assets/player-control-v4.js` - Adjusts player control bindings and state usage to align with updated player/profile/public flows.
- `apps/web-portal-standalone/public/assets/player-v4-app.js` - Extends player app copy, state rendering, and public/server-aware UI behavior.
- `apps/web-portal-standalone/public/assets/player-v4-base.css` - Adds styling support for the new public/player shell behavior and branding-driven visual elements.
- `apps/web-portal-standalone/public/assets/player-v4-shared.js` - Adds shared helpers used by the updated player/public pages.
- `apps/web-portal-standalone/public/player-login.html` - Updates player login shell to work with the newer auth surface and portal navigation expectations.
- `apps/web-portal-standalone/runtime/portalBootstrapRuntime.js` - Injects new dependencies used by public server pages such as tenant lookup, branding, stats, events, shop, and donations.
- `apps/web-portal-standalone/runtime/portalPageRoutes.js` - Implements `/s/:slug`, `/s/:slug/stats`, `/s/:slug/shop`, `/s/:slug/events`, and `/s/:slug/donate` page routes and the client-side shell for those pages.

## Documentation and Provider Truth

- `docs/DATABASE_STRATEGY.md` - Clarifies compatibility-template vs rendered-provider runtime truth.
- `prisma/schema.prisma` - Adds source-of-truth notes so the literal provider in the template is not mistaken for production runtime truth.
- `scripts/prisma-with-provider.js` - Adds clearer rendered-schema metadata/banner so generated provider-specific schemas explain themselves.
- `scripts/run-tests-with-provider.js` - Makes provider-aware test setup/cleanup more reliable, especially around PostgreSQL tenant schema cleanup.

## Admin API Routes

- `src/admin/api/adminCommerceDeliveryPostRoutes.js` - Adds validation/guard improvements and better coverage-aligned behavior for commerce delivery actions.
- `src/admin/api/adminConfigPostRoutes.js` - Hardens config mutation inputs and integrates more cleanly with security/runtime checks.
- `src/admin/api/adminDeliveryOpsGetRoutes.js` - Exposes delivery audit reads through an extracted route slice for owner/admin operational visibility.
- `src/admin/api/adminGetRoutes.js` - Wires new async export/security/observability behavior and exposes additional owner/admin datasets.
- `src/admin/api/adminPlatformPostRoutes.js` - Extends platform-side mutation handling for package/runtime/billing flows covered by the new tests.
- `src/admin/api/adminPublicRoutes.js` - Improves split-surface redirect logic, loopback portal preference, player routing, and public owner/tenant flow behavior.
- `src/admin/api/adminRuntimeControlPostRoutes.js` - Tightens runtime action validation and request guard behavior for restart/config/runtime control mutations.

## Admin Assets and Pages

- `src/admin/assets/owner-control-v4.js` - Adds commercial urgency, jobs workspace, delivery audit visibility, expiring-tenant controls, and richer owner operational surfaces.
- `src/admin/assets/owner-v4-app.js` - Loads additional optional datasets such as restart executions, sync runs/events, and delivery audit for owner pages.
- `src/admin/assets/tenant-login-v1.js` - Updates tenant login UI behavior to fit the newer auth and split-surface flow.
- `src/admin/assets/tenant-server-config-v4.js` - Improves runtime/config wording and config-related page behavior.
- `src/admin/assets/tenant-v4-app.js` - Polishes tenant-facing copy, runtime wording, and navigation/state wiring.
- `src/admin/tenant-login.html` - Updates tenant login HTML shell to match the current tenant auth surface.

## Admin Runtime and Server Wiring

- `src/admin/runtime/adminObservabilityRuntime.js` - Includes `platformOps` in observability snapshots.
- `src/admin/runtime/adminRequestRuntime.js` - Makes request helpers safer for partial or mocked request objects used in tests and route slices.
- `src/admin/runtime/adminRouteHandlersRuntime.js` - Wires new route dependencies for delivery audit, security, and operational slices.
- `src/admin/runtime/adminSecurityExportRuntime.js` - Makes security export row building async-aware.
- `src/admin/runtime/adminSecurityRuntime.js` - Adds richer security signals, warning-level events, and action-rate-limit handling refinements.
- `src/adminWebServer.js` - Wires updated runtime factories and route dependencies into the real admin server.

## Core Prisma / Runtime Layer

- `src/prisma.js` - Moves test database defaulting earlier, improves runtime-profile behavior, and avoids stale provider/runtime assumptions during tests.
- `src/prismaClientLoader.js` - Resolves requested provider more defensively using `DATABASE_URL` when the generated provider and env disagree.

## Core Services

- `src/services/adminSnapshotService.js` - Deduplicates delivery audit rows during backup/restore and verifies logical counts instead of raw duplicates.
- `src/services/platformBillingLifecycleService.js` - Hardens billing webhook verification, delegate detection, and billing lifecycle persistence behavior.
- `src/services/platformIdentityService.js` - Adds linked-account summary, next-step computation, preview identity summary, runtime-aware token timestamps, and more robust token completion behavior.
- `src/services/platformMonitoringService.js` - Emits actionable alerts for subscription risk, quota pressure, delivery anomalies, and stale runtimes with cooldown tracking.
- `src/services/platformService.js` - Adds tenant slug lookup support and strengthens tenant creation/slug handling for public routes.
- `src/services/platformTenantStaffService.js` - Fixes PostgreSQL raw SQL casing/timestamp handling for tenant staff invite/update/revoke flows.
- `src/services/platformWorkspaceAuthService.js` - Hardens purpose-token and tenant staff invite acceptance flows, including runtime-aware timestamp writes and PostgreSQL-safe column access.
- `src/services/publicPreviewService.js` - Decorates preview accounts with richer identity/commercial state derived from real identity and billing signals.
- `src/services/scumConsoleAgent.js` - Enforces explicit env gating for managed server control from the console agent.

## Stores and Utilities

- `src/store/deliveryAuditStore.js` - Deduplicates audit rows and persists replacements with upsert-based idempotent behavior.
- `src/utils/adminPermissionMatrix.js` - Expands role matrix handling to cover the `mod` role consistently.
- `src/utils/tenantDbIsolation.js` - Makes RLS/tenant-isolation install migration-first and throws explicit errors when required tables are missing.

## Test Files Updated

### Admin and Platform API tests

- `test/admin-api.integration.test.js` - Stabilizes admin API integration setup and delivery/test-send coverage.
- `test/admin-commerce-delivery-route.test.js` - Covers tightened delivery route validation and behavior.
- `test/admin-config-post-routes.test.js` - Covers config mutation validation and guard behavior.
- `test/admin-delivery-ops-get-route.test.js` - Covers extracted delivery audit and delivery ops GET slices.
- `test/admin-platform-automation-route.test.js` - Covers updated automation/platform route behavior and permissions.
- `test/admin-public-routes.test.js` - Covers split-surface redirects, loopback portal routing, and owner/tenant/player public flow behavior.
- `test/admin-route-handlers-runtime.test.js` - Verifies updated route-handler runtime dependency wiring.

### Snapshot, security, and observability tests

- `test/admin-snapshot-regression.test.js` - Locks the new logical-count behavior for delivery audit backup/restore.
- `test/doctor.integration.test.js` - Prevents shared env leakage from breaking doctor assertions.
- `test/persistence-production-smoke.test.js` - Prevents test env contamination in production-smoke setup.
- `test/platform-monitoring-service.test.js` - Covers monitoring alerts and subscription-risk reporting.
- `test/prisma-runtime-profile.test.js` - Covers provider/runtime truth helpers.

### Owner and UI tests

- `test/owner-control-v4.test.js` - Covers owner jobs workspace, commercial controls, and expiring-tenant controls.
- `test/owner-support-detail-pages.test.js` - Ensures support/detail pages still render with the richer owner commercial workspace.
- `test/owner-v4-app-bootstrap.test.js` - Verifies owner app bootstrap with the new optional datasets.
- `test/player-control-v4.test.js` - Verifies updated player control behavior and copy wiring.
- `test/player-profile-route.test.js` - Covers centralized identity summary in player profile output.
- `test/player-route-entitlements.test.js` - Verifies player route entitlement behavior with the updated public/player flow.
- `test/portal-page-routes.test.js` - Covers `/s/:slug` public page routing and shell behavior.
- `test/public-platform-routes.test.js` - Covers the new public server API routes and tenant isolation by slug.
- `test/public-preview-service.test.js` - Covers richer preview identity and commercial state behavior.
- `test/tenant-server-config-v4.test.js` - Keeps tenant config UI behavior aligned with wording/runtime updates.
- `test/ui-i18n-runtime.test.js` - Ensures updated UI copy/runtime wiring does not regress locale behavior.
- `test/web-portal-standalone.player-mode.integration.test.js` - Keeps player-mode integration aligned with canonical/local portal URL expectations.

### Identity, staff, and billing tests

- `test/platform-billing-lifecycle-service.test.js` - Covers delegate-first billing behavior and webhook/lifecycle hardening.
- `test/platform-identity-service.test.js` - Covers unified identity creation, verification, and summary behavior.
- `test/platform-tenant-staff-service.test.js` - Covers tenant staff invite, list, update, revoke, and acceptance behavior in PostgreSQL mode.
- `test/shop-vip-services.integration.test.js` - Keeps commerce/VIP flow aligned with current entitlement and identity assumptions.

### Prisma, topology, and isolation tests

- `test/prisma-tenant-topology.test.js` - Ensures tenant datasource URL resolution works across shared/schema/database topologies.
- `test/prisma-with-provider.test.js` - Covers rendered-provider schema generation behavior.
- `test/tenant-db-isolation.test.js` - Covers migration-first tenant isolation install behavior and explicit missing-table failures.

### Runtime and delivery tests

- `test/delivery-audit-store.test.js` - Covers idempotent dedupe behavior in the delivery audit store.
- `test/rcon-delivery-routing-context.test.js` - Stabilizes delivery routing context by waiting for registry persistence.
- `test/runtime-supervisor.test.js` - Prevents external env bleed-through in optional runtime supervision tests.
- `test/scum-console-agent.integration.test.js` - Covers stricter managed-server-control gating for the console agent.

## Notes About Scope

This matrix is intentionally file-by-file. It tells you what each touched file was doing in the commit, not the full history of that file.

The commit still has the same main operational risks:

- It is a wide multi-subsystem change.
- Public tenant pages are now real but still lighter than a fully polished customer-facing product.
- Identity/account cohesion is improved but still not a complete self-service account center.
- Runtime-aware timestamp handling is now an important pattern for future raw SQL changes.
- Tenant isolation setup is stricter and can fail earlier in partially migrated environments.
