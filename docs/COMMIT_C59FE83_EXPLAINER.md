# Commit `c59fe83` Explainer

Read in Thai: [COMMIT_C59FE83_EXPLAINER_TH.md](./COMMIT_C59FE83_EXPLAINER_TH.md)
File-by-file appendix: [COMMIT_C59FE83_FILE_MATRIX.md](./COMMIT_C59FE83_FILE_MATRIX.md)

## What This Commit Is

Commit `c59fe83` is a broad managed-service hardening pass. It does not introduce one isolated feature. Instead, it tightens several connected parts of the existing platform so the repository is more internally consistent, easier to operate, and better covered by tests.

This commit mainly covers:

1. Public server routes and tenant branding for `/s/:slug`
2. Identity and account-state cohesion across preview, player, and workspace flows
3. Billing and monitoring hardening
4. Owner, tenant, and player surface wiring
5. Admin security and observability improvements
6. Prisma/provider/persistence hardening
7. Delivery audit and snapshot consistency fixes
8. Test expansion and regression stabilization

## Files Added

- [src/services/platformPortalBrandingService.js](/C:/new/src/services/platformPortalBrandingService.js)
- [test/admin-security-runtime.test.js](/C:/new/test/admin-security-runtime.test.js)
- [test/delivery-audit-store.test.js](/C:/new/test/delivery-audit-store.test.js)
- [test/platform-monitoring-service.test.js](/C:/new/test/platform-monitoring-service.test.js)
- [test/platform-portal-branding-service.test.js](/C:/new/test/platform-portal-branding-service.test.js)
- [test/prisma-runtime-profile.test.js](/C:/new/test/prisma-runtime-profile.test.js)

## Major Change Areas

### 1. Public server routes and branding

Primary files:

- [apps/web-portal-standalone/api/publicPlatformRoutes.js](/C:/new/apps/web-portal-standalone/api/publicPlatformRoutes.js)
- [apps/web-portal-standalone/runtime/portalPageRoutes.js](/C:/new/apps/web-portal-standalone/runtime/portalPageRoutes.js)
- [apps/web-portal-standalone/runtime/portalBootstrapRuntime.js](/C:/new/apps/web-portal-standalone/runtime/portalBootstrapRuntime.js)
- [src/services/platformPortalBrandingService.js](/C:/new/src/services/platformPortalBrandingService.js)
- [src/services/platformService.js](/C:/new/src/services/platformService.js)

Purpose:

- Add public tenant-isolated server pages under `/s/:slug`
- Add matching JSON API under `/api/public/server/:slug/...`
- Add safe tenant-controlled branding for public and player surfaces

Core logic:

- `getPlatformTenantBySlug(...)` resolves a tenant from its public slug.
- `buildTenantPortalBranding(...)` normalizes site name, detail text, logo, banner, colors, and theme tokens from tenant config.
- Public API builds one server workspace payload, then returns section-specific views for `workspace`, `stats`, `shop`, `events`, and `donate`.
- Public HTML pages render a shell and fetch workspace data from the API, so the page and API stay aligned.

Why it matters:

- This turns the public tenant route from a missing/scaffolded concept into a real product surface.

### 2. Identity and account-state cohesion

Primary files:

- [src/services/platformIdentityService.js](/C:/new/src/services/platformIdentityService.js)
- [src/services/platformWorkspaceAuthService.js](/C:/new/src/services/platformWorkspaceAuthService.js)
- [src/services/publicPreviewService.js](/C:/new/src/services/publicPreviewService.js)
- [apps/web-portal-standalone/api/playerGeneralRoutes.js](/C:/new/apps/web-portal-standalone/api/playerGeneralRoutes.js)

Purpose:

- Reduce identity-state drift between preview, player, and workspace flows
- Make linked-account status more consistent
- Harden token handling across SQLite and PostgreSQL runtimes

Core logic:

- `buildLinkedAccountSummary(...)` produces a single linked-account summary from users, identities, memberships, and player profile data.
- `buildIdentityNextSteps(...)` computes actionable missing steps like linking Discord or Steam.
- `getIdentitySummaryForPreviewAccount(...)` uses preview account id or email to resolve the real identity state behind a preview account.
- `issueEmailVerificationToken(...)`, `issuePasswordResetToken(...)`, `completeEmailVerification(...)`, and `completePasswordReset(...)` were hardened so timestamp writes use runtime-aware values.
- `acceptTenantStaffInvite(...)` was tightened to consume invite tokens safely, activate memberships, and resolve the resulting tenant session context.

Why it matters:

- The platform already had identity pieces. This commit makes those pieces behave more like one system.

### 3. Billing and monitoring hardening

Primary files:

- [src/services/platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
- [src/services/platformMonitoringService.js](/C:/new/src/services/platformMonitoringService.js)
- [src/admin/assets/owner-control-v4.js](/C:/new/src/admin/assets/owner-control-v4.js)
- [src/admin/assets/owner-v4-app.js](/C:/new/src/admin/assets/owner-v4-app.js)

Purpose:

- Harden webhook verification and billing lifecycle processing
- Emit richer monitoring alerts for subscription risk and runtime drift
- Surface those signals in the Owner UI

Core logic:

- Billing now supports webhook secret verification with `PLATFORM_BILLING_WEBHOOK_SECRET`.
- `processBillingWebhookEvent(...)` centralizes invoice, payment-attempt, and subscription-event updates.
- Monitoring scans subscriptions and emits alerts for expiring, past-due, suspended, and expired subscriptions.
- Monitoring also emits alerts for stale runtimes, delivery anomalies, and quota pressure.
- Owner workspace now loads and displays more operational evidence in one place.

Why it matters:

- This raises the repo from “there is billing code” to “operators can reason about billing and runtime risk more practically.”

### 4. Admin security and observability

Primary files:

- [src/admin/runtime/adminSecurityRuntime.js](/C:/new/src/admin/runtime/adminSecurityRuntime.js)
- [src/admin/runtime/adminRequestRuntime.js](/C:/new/src/admin/runtime/adminRequestRuntime.js)
- [src/admin/runtime/adminSecurityExportRuntime.js](/C:/new/src/admin/runtime/adminSecurityExportRuntime.js)
- [src/admin/runtime/adminObservabilityRuntime.js](/C:/new/src/admin/runtime/adminObservabilityRuntime.js)
- [src/admin/api/adminGetRoutes.js](/C:/new/src/admin/api/adminGetRoutes.js)
- [src/adminWebServer.js](/C:/new/src/adminWebServer.js)

Purpose:

- Improve security event recording and observability wiring
- Make request helpers safer with partial or mocked request objects
- Expose more platform ops state in admin observability outputs

Core logic:

- Security runtime now records richer signals and supports non-spam warning events.
- Action-level rate limits remain local, but the event model and tracking are clearer.
- Security export now correctly awaits async row building.
- Observability runtime includes `platformOps`.

### 5. Persistence and provider truth

Primary files:

- [src/prisma.js](/C:/new/src/prisma.js)
- [src/prismaClientLoader.js](/C:/new/src/prismaClientLoader.js)
- [prisma/schema.prisma](/C:/new/prisma/schema.prisma)
- [scripts/prisma-with-provider.js](/C:/new/scripts/prisma-with-provider.js)
- [scripts/run-tests-with-provider.js](/C:/new/scripts/run-tests-with-provider.js)
- [src/utils/tenantDbIsolation.js](/C:/new/src/utils/tenantDbIsolation.js)

Purpose:

- Clarify provider/runtime behavior
- Stabilize provider-specific test execution
- Make tenant isolation setup fail explicitly instead of creating missing tables silently

Core logic:

- `prisma.js` now initializes test database defaults earlier and exposes clearer runtime profile behavior.
- `prismaClientLoader.js` resolves requested provider more defensively using `DATABASE_URL`.
- `schema.prisma` and `prisma-with-provider.js` now explain the compatibility-template vs rendered-provider model more explicitly.
- `run-tests-with-provider.js` drops tenant schemas in a less lock-heavy way.
- `tenantDbIsolation.js` now throws `TENANT_DB_ISOLATION_TABLE_REQUIRED` when required tables are missing instead of silently creating them.

### 6. Delivery audit and snapshot consistency

Primary files:

- [src/store/deliveryAuditStore.js](/C:/new/src/store/deliveryAuditStore.js)
- [src/services/adminSnapshotService.js](/C:/new/src/services/adminSnapshotService.js)

Purpose:

- Stop duplicate delivery audit rows from causing restore drift
- Make snapshot verification count logical audit rows instead of raw duplicates

Core logic:

- `dedupeAuditRows(...)` normalizes and deduplicates by id.
- `replaceDeliveryAudit(...)` now replaces state using deduped rows and persists with `upsert(...)`.
- Snapshot build/restore paths dedupe delivery audit rows before counting or restoring them.

## New Internal or Config Dependencies

No new npm packages were added.

New or more important runtime/config dependencies:

- `PLATFORM_BILLING_WEBHOOK_SECRET`
- `SCUM_CONSOLE_AGENT_ALLOW_MANAGED_SERVER_CONTROL`

These are wired through:

- [src/services/platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
- [src/services/scumConsoleAgent.js](/C:/new/src/services/scumConsoleAgent.js)
- [src/config/adminEditableConfig.js](/C:/new/src/config/adminEditableConfig.js)
- [src/utils/env.js](/C:/new/src/utils/env.js)
- [C:\new\.env.example](/C:/new/.env.example)
- [C:\new\.env.production.example](/C:/new/.env.production.example)

## Main Risks

### 1. The commit is wide

It touches multiple subsystems at once. The test suite is green, but review should still happen by subsystem, not by quick skim.

### 2. Public `/s/:slug` is real but still product-thin

The route is now implemented, but the merchandising, content depth, and UX polish are still lighter than a fully mature public community site.

### 3. Identity is more coherent, but not fully complete

This does not create a complete account center. Google login and some self-service link/unlink/recovery journeys are still outside this commit.

### 4. Runtime-aware timestamp handling is now important

The new token write paths rely on runtime-aware timestamp conversion so the same logic works on SQLite and PostgreSQL. Future raw SQL added without the same pattern could regress.

### 5. Tenant isolation is stricter

`installTenantDbIsolation(...)` now fails explicitly if required tables are not present. That is better for correctness, but environments that previously depended on implicit table creation will now break earlier.

### 6. Main branch was not updated directly

This work was committed and pushed to:

- branch: `codex/managed-service-readiness-hardening`
- commit: `c59fe83`

It was not pushed directly to `origin/main` because remote `main` advanced and caused a large rebase conflict set.

## Verification Status

This commit was verified locally with:

- `npm.cmd test`
- `npm.cmd run lint:text`

Both passed at the end of the work.
