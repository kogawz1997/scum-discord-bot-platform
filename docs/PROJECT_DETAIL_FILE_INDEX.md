# Project Detail File Index

Read in Thai: [PROJECT_DETAIL_FILE_INDEX_TH.md](./PROJECT_DETAIL_FILE_INDEX_TH.md)

This index covers the files that carry project-level detail for the SCUM managed-service platform.

Scope:

- repository overview files
- deployment and runtime topology files
- app entrypoints
- core control-plane and product services
- project documentation under `docs/`

It intentionally does not try to explain every test file or every static asset in the repository.

## Suggested Reading Order

1. [../README.md](../README.md)
2. [../PROJECT_HQ.md](../PROJECT_HQ.md)
3. [ARCHITECTURE.md](./ARCHITECTURE.md)
4. [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
5. [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
6. [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
7. [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
8. [PRODUCT_READY_GAP_MATRIX.md](./PRODUCT_READY_GAP_MATRIX.md)

## Root-Level Repository Files

- [../README.md](../README.md) - main project overview and repository entrypoint.
- [../PROJECT_HQ.md](../PROJECT_HQ.md) - high-level project framing and working status.
- [../PROJECT_REVIEW.md](../PROJECT_REVIEW.md) - repository-level review context and findings.
- [../AGENTS.md](../AGENTS.md) - repository-specific operating instructions used during audits and implementation.
- [../SECURITY.md](../SECURITY.md) - security disclosure and security-process context.
- [../CHANGELOG.md](../CHANGELOG.md) - release history and shipped changes.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) - contribution workflow and repo expectations.
- [../package.json](../package.json) - runtime roles, scripts, and executable surfaces.
- [../Dockerfile](../Dockerfile) - container build entrypoint for deployment.
- [../setup-easy.cmd](../setup-easy.cmd) - local/bootstrap helper for easier setup.

## Environment and Deployment Files

- [../.env.example](../.env.example) - baseline environment template.
- [../.env.development.example](../.env.development.example) - local development profile.
- [../.env.machine-a-control-plane.example](../.env.machine-a-control-plane.example) - split-topology control-plane example.
- [../.env.machine-b-game-bot.example](../.env.machine-b-game-bot.example) - split-topology game-bot machine example.
- [../.env.multi-tenant-prod.example](../.env.multi-tenant-prod.example) - multi-tenant production environment example.
- [../.env.production.example](../.env.production.example) - production deployment template.
- [../.env.production.split](../.env.production.split) - split deployment environment example.
- [../.env.single-host-prod.example](../.env.single-host-prod.example) - single-host production example.
- [../.env.test.example](../.env.test.example) - test-runtime environment template.
- [../deploy/docker-compose.production.yml](../deploy/docker-compose.production.yml) - production compose topology.
- [../deploy/pm2.ecosystem.config.cjs](../deploy/pm2.ecosystem.config.cjs) - main PM2 runtime topology.
- [../deploy/pm2.local.config.cjs](../deploy/pm2.local.config.cjs) - local PM2 profile.
- [../deploy/pm2.machine-a-control-plane.config.cjs](../deploy/pm2.machine-a-control-plane.config.cjs) - split deployment config for control plane.
- [../deploy/pm2.machine-b-game-bot.config.cjs](../deploy/pm2.machine-b-game-bot.config.cjs) - split deployment config for game-bot machine.
- [../deploy/pm2.scum-agent.config.cjs](../deploy/pm2.scum-agent.config.cjs) - dedicated agent-oriented PM2 config.
- [../deploy/entrypoints/start-role.js](../deploy/entrypoints/start-role.js) - role-based process bootstrap.
- [../deploy/systemd/scum-bot.service](../deploy/systemd/scum-bot.service) - systemd service definition for bot runtime.
- [../deploy/systemd/scum-watcher.service](../deploy/systemd/scum-watcher.service) - systemd watcher runtime definition.
- [../deploy/systemd/scum-web-portal.service](../deploy/systemd/scum-web-portal.service) - systemd web portal definition.
- [../deploy/systemd/scum-worker.service](../deploy/systemd/scum-worker.service) - systemd worker definition.

## App Entrypoints and Web Surfaces

- [../apps/admin-web/server.js](../apps/admin-web/server.js) - admin web surface entrypoint.
- [../apps/owner-web/server.js](../apps/owner-web/server.js) - owner panel web entrypoint.
- [../apps/tenant-web/server.js](../apps/tenant-web/server.js) - tenant admin panel web entrypoint.
- [../apps/web-portal-standalone/server.js](../apps/web-portal-standalone/server.js) - standalone player/public portal entrypoint.
- [../apps/api/server.js](../apps/api/server.js) - shared API runtime entrypoint.
- [../apps/discord-bot/server.js](../apps/discord-bot/server.js) - Discord bot runtime entrypoint.
- [../apps/agent/server.js](../apps/agent/server.js) - Delivery Agent runtime entrypoint.
- [../apps/server-bot/server.js](../apps/server-bot/server.js) - Server Bot runtime entrypoint.
- [../apps/worker/server.js](../apps/worker/server.js) - background worker runtime entrypoint.
- [../apps/watcher/server.js](../apps/watcher/server.js) - watcher runtime entrypoint.

## Player and Public Portal Files

- [../apps/web-portal-standalone/README.md](../apps/web-portal-standalone/README.md) - portal-specific overview.
- [../apps/web-portal-standalone/api/publicPlatformRoutes.js](../apps/web-portal-standalone/api/publicPlatformRoutes.js) - public product routes, signup, preview, and `/s/:slug` API surface.
- [../apps/web-portal-standalone/api/playerGeneralRoutes.js](../apps/web-portal-standalone/api/playerGeneralRoutes.js) - player profile, stats, support, and linked-account route surface.
- [../apps/web-portal-standalone/api/playerCommerceRoutes.js](../apps/web-portal-standalone/api/playerCommerceRoutes.js) - player commerce, wallet, shop, and order flows.
- [../apps/web-portal-standalone/api/playerRouteEntitlements.js](../apps/web-portal-standalone/api/playerRouteEntitlements.js) - player-side entitlement enforcement.
- [../apps/web-portal-standalone/auth/portalAuthRuntime.js](../apps/web-portal-standalone/auth/portalAuthRuntime.js) - portal auth runtime.
- [../apps/web-portal-standalone/auth/publicPreviewAuthRuntime.js](../apps/web-portal-standalone/auth/publicPreviewAuthRuntime.js) - preview auth runtime.
- [../apps/web-portal-standalone/runtime/portalBootstrapRuntime.js](../apps/web-portal-standalone/runtime/portalBootstrapRuntime.js) - dependency bootstrap for portal runtime.
- [../apps/web-portal-standalone/runtime/portalRuntime.js](../apps/web-portal-standalone/runtime/portalRuntime.js) - main portal runtime composition.
- [../apps/web-portal-standalone/runtime/portalPageRoutes.js](../apps/web-portal-standalone/runtime/portalPageRoutes.js) - HTML page routes including `/s/:slug`.
- [../apps/web-portal-standalone/runtime/portalSurfaceRuntime.js](../apps/web-portal-standalone/runtime/portalSurfaceRuntime.js) - surface routing and composition.
- [../apps/web-portal-standalone/runtime/portalServerLifecycle.js](../apps/web-portal-standalone/runtime/portalServerLifecycle.js) - portal server lifecycle handling.
- [../apps/web-portal-standalone/public/assets/portal-i18n.js](../apps/web-portal-standalone/public/assets/portal-i18n.js) - public/player locale runtime.
- [../apps/web-portal-standalone/public/assets/player-v4-app.js](../apps/web-portal-standalone/public/assets/player-v4-app.js) - main player app client shell.
- [../apps/web-portal-standalone/public/assets/player-control-v4.js](../apps/web-portal-standalone/public/assets/player-control-v4.js) - player dashboard behavior.
- [../apps/web-portal-standalone/public/assets/player-commerce-v4.js](../apps/web-portal-standalone/public/assets/player-commerce-v4.js) - client-side commerce flow.
- [../apps/web-portal-standalone/public/assets/player-home-v4.js](../apps/web-portal-standalone/public/assets/player-home-v4.js) - player home/dashboard surface.
- [../apps/web-portal-standalone/public/assets/player-stats-events-support-v4.js](../apps/web-portal-standalone/public/assets/player-stats-events-support-v4.js) - player stats, events, and support surface.
- [../apps/web-portal-standalone/public/assets/player-auth-v1.js](../apps/web-portal-standalone/public/assets/player-auth-v1.js) - player auth UI behavior.

## Control Plane, Admin, Owner, and Tenant Files

- [../src/adminWebServer.js](../src/adminWebServer.js) - main control-plane HTTP server wiring.
- [../src/admin/api/adminGetRoutes.js](../src/admin/api/adminGetRoutes.js) - main read surface for owner/admin/tenant control plane.
- [../src/admin/api/adminPlatformPostRoutes.js](../src/admin/api/adminPlatformPostRoutes.js) - platform-level write actions.
- [../src/admin/api/adminRuntimeControlPostRoutes.js](../src/admin/api/adminRuntimeControlPostRoutes.js) - runtime control actions such as restarts and runtime operations.
- [../src/admin/api/adminConfigPostRoutes.js](../src/admin/api/adminConfigPostRoutes.js) - config mutation routes.
- [../src/admin/api/adminPublicRoutes.js](../src/admin/api/adminPublicRoutes.js) - public/admin onboarding and activation routes.
- [../src/admin/api/adminBillingGetRoutes.js](../src/admin/api/adminBillingGetRoutes.js) - billing read surface.
- [../src/admin/api/adminBillingPostRoutes.js](../src/admin/api/adminBillingPostRoutes.js) - billing write surface.
- [../src/admin/api/adminNotificationGetRoutes.js](../src/admin/api/adminNotificationGetRoutes.js) - notifications read routes.
- [../src/admin/api/adminNotificationPostRoutes.js](../src/admin/api/adminNotificationPostRoutes.js) - notifications action routes.
- [../src/admin/api/tenantRouteEntitlements.js](../src/admin/api/tenantRouteEntitlements.js) - tenant-side entitlement enforcement.
- [../src/admin/api/tenantRoutePermissions.js](../src/admin/api/tenantRoutePermissions.js) - tenant-side permission enforcement.
- [../src/admin/runtime/adminAccessRuntime.js](../src/admin/runtime/adminAccessRuntime.js) - tenant/role access checks and tenant-boundary enforcement.
- [../src/admin/runtime/adminSecurityRuntime.js](../src/admin/runtime/adminSecurityRuntime.js) - admin security signals, rate limits, and security event behavior.
- [../src/admin/runtime/adminObservabilityRuntime.js](../src/admin/runtime/adminObservabilityRuntime.js) - admin observability aggregation.
- [../src/admin/assets/admin-i18n.js](../src/admin/assets/admin-i18n.js) - admin/tenant locale runtime.
- [../src/admin/assets/owner-v4-app.js](../src/admin/assets/owner-v4-app.js) - owner surface bootstrap and state loading.
- [../src/admin/assets/owner-control-v4.js](../src/admin/assets/owner-control-v4.js) - owner panel logic and operational/commercial controls.
- [../src/admin/assets/tenant-v4-app.js](../src/admin/assets/tenant-v4-app.js) - tenant panel bootstrap and navigation shell.
- [../src/admin/assets/tenant-dashboard-v4.js](../src/admin/assets/tenant-dashboard-v4.js) - tenant dashboard surface.
- [../src/admin/assets/tenant-billing-v4.js](../src/admin/assets/tenant-billing-v4.js) - tenant billing UI.
- [../src/admin/assets/tenant-onboarding-v4.js](../src/admin/assets/tenant-onboarding-v4.js) - onboarding checklist and next-step UI.
- [../src/admin/assets/tenant-server-config-v4.js](../src/admin/assets/tenant-server-config-v4.js) - config editor UI.
- [../src/admin/assets/tenant-restart-control-v4.js](../src/admin/assets/tenant-restart-control-v4.js) - restart orchestration UI.
- [../src/admin/assets/tenant-delivery-agents-v4.js](../src/admin/assets/tenant-delivery-agents-v4.js) - Delivery Agent management surface.
- [../src/admin/assets/tenant-server-bots-v4.js](../src/admin/assets/tenant-server-bots-v4.js) - Server Bot management surface.
- [../src/admin/assets/tenant-orders-v4.js](../src/admin/assets/tenant-orders-v4.js) - tenant order and delivery operations.
- [../src/admin/assets/tenant-donations-v4.js](../src/admin/assets/tenant-donations-v4.js) - donation admin surface.
- [../src/admin/assets/tenant-events-v4.js](../src/admin/assets/tenant-events-v4.js) - events admin surface.
- [../src/admin/assets/tenant-modules-v4.js](../src/admin/assets/tenant-modules-v4.js) - modules/package-aware tenant surface.
- [../src/admin/assets/tenant-players-v4.js](../src/admin/assets/tenant-players-v4.js) - player/admin management surface.
- [../src/admin/assets/tenant-staff-v4.js](../src/admin/assets/tenant-staff-v4.js) - tenant staff and permissions UI.
- [../src/admin/assets/tenant-settings-v4.js](../src/admin/assets/tenant-settings-v4.js) - tenant settings surface.

## Domain and Core Product Services

- [../src/domain/agents/agentRegistryService.js](../src/domain/agents/agentRegistryService.js) - setup tokens, activation, machine binding, and agent lifecycle.
- [../src/domain/billing/packageCatalogService.js](../src/domain/billing/packageCatalogService.js) - package catalog and package metadata.
- [../src/domain/billing/productEntitlementService.js](../src/domain/billing/productEntitlementService.js) - entitlement resolution for features and limits.
- [../src/services/platformService.js](../src/services/platformService.js) - tenant/platform creation, lookup, and public slug behavior.
- [../src/services/platformBillingLifecycleService.js](../src/services/platformBillingLifecycleService.js) - subscription, invoice, payment attempt, and webhook lifecycle.
- [../src/services/publicPreviewService.js](../src/services/publicPreviewService.js) - preview mode, self-service signup, account preview state, and trial-aware flows.
- [../src/services/platformIdentityService.js](../src/services/platformIdentityService.js) - linked identities, verification, and identity summary logic.
- [../src/services/linkService.js](../src/services/linkService.js) - linked-account actions including Steam-related flows.
- [../src/services/platformWorkspaceAuthService.js](../src/services/platformWorkspaceAuthService.js) - workspace auth, invite acceptance, purpose tokens, and tenant sessions.
- [../src/services/platformTenantAccessService.js](../src/services/platformTenantAccessService.js) - tenant access model and checks.
- [../src/services/platformTenantStaffService.js](../src/services/platformTenantStaffService.js) - tenant staff lifecycle and membership operations.
- [../src/services/platformTenantConfigService.js](../src/services/platformTenantConfigService.js) - tenant config persistence and public/portal-affecting settings.
- [../src/services/platformPortalBrandingService.js](../src/services/platformPortalBrandingService.js) - public/player branding composition from tenant config.
- [../src/services/platformServerConfigService.js](../src/services/platformServerConfigService.js) - config save/apply history and config job orchestration.
- [../src/services/serverBotConfigSchemaService.js](../src/services/serverBotConfigSchemaService.js) - schema-driven config metadata and typed fields.
- [../src/services/serverBotIniService.js](../src/services/serverBotIniService.js) - `.ini` read/write helpers used by Server Bot config flow.
- [../src/services/platformRestartOrchestrationService.js](../src/services/platformRestartOrchestrationService.js) - restart plans, announcements, history, and execution flow.
- [../src/services/restartScheduler.js](../src/services/restartScheduler.js) - restart scheduling support layer.
- [../src/services/scumServerBotRuntime.js](../src/services/scumServerBotRuntime.js) - server-side SCUM bot runtime logic.
- [../src/services/scumLogWatcherRuntime.js](../src/services/scumLogWatcherRuntime.js) - SCUM log watching and sync support.
- [../src/services/scumConsoleAgent.js](../src/services/scumConsoleAgent.js) - Delivery Agent / console-side runtime behavior.
- [../src/services/rconDelivery.js](../src/services/rconDelivery.js) - delivery command execution layer.
- [../src/services/deliveryLifecycleService.js](../src/services/deliveryLifecycleService.js) - delivery queue, attempts, dead letters, and recovery behavior.
- [../src/services/runtimeSupervisorService.js](../src/services/runtimeSupervisorService.js) - runtime supervision and process monitoring.
- [../src/services/runtimeHealthServer.js](../src/services/runtimeHealthServer.js) - health endpoint/runtime health reporting.
- [../src/services/platformMonitoringService.js](../src/services/platformMonitoringService.js) - ops alerts, quota signals, and runtime/subscription risk monitoring.
- [../src/services/platformAutomationService.js](../src/services/platformAutomationService.js) - automation and recurring operational routines.
- [../src/services/adminAuditService.js](../src/services/adminAuditService.js) - audit logging and audit queries.
- [../src/services/adminSnapshotService.js](../src/services/adminSnapshotService.js) - backup/restore and snapshot management.
- [../src/services/adminObservabilityService.js](../src/services/adminObservabilityService.js) - higher-level observability aggregation.
- [../src/services/adminDashboardService.js](../src/services/adminDashboardService.js) - dashboard aggregation across control-plane surfaces.
- [../src/services/tenantDiagnosticsService.js](../src/services/tenantDiagnosticsService.js) - diagnostics and setup-state analysis.
- [../src/services/platformAnalyticsService.js](../src/services/platformAnalyticsService.js) - platform analytics aggregation.
- [../src/services/eventService.js](../src/services/eventService.js) - event system behavior.
- [../src/services/tenantDonationOverviewService.js](../src/services/tenantDonationOverviewService.js) - donation overview and aggregation.
- [../src/services/raidService.js](../src/services/raidService.js) - raid request, window, and summary logic.
- [../src/services/statsService.js](../src/services/statsService.js) - stats ingestion and read model.
- [../src/services/killFeedService.js](../src/services/killFeedService.js) - killfeed logic.
- [../src/services/leaderboardPanels.js](../src/services/leaderboardPanels.js) - leaderboard composition.
- [../src/services/shopService.js](../src/services/shopService.js) - player shop logic.
- [../src/services/cartService.js](../src/services/cartService.js) - cart lifecycle.
- [../src/services/purchaseService.js](../src/services/purchaseService.js) - order and purchase processing.
- [../src/services/purchaseStateMachine.js](../src/services/purchaseStateMachine.js) - purchase state transitions.
- [../src/services/rewardService.js](../src/services/rewardService.js) - reward claim and grant flow.
- [../src/services/coinService.js](../src/services/coinService.js) - wallet/coin accounting.
- [../src/services/vipService.js](../src/services/vipService.js) - VIP product and status logic.
- [../src/services/welcomePackService.js](../src/services/welcomePackService.js) - welcome pack flow.
- [../src/services/rentBikeService.js](../src/services/rentBikeService.js) - rent-bike flow.
- [../src/services/giveawayService.js](../src/services/giveawayService.js) - giveaway feature logic.
- [../src/services/ticketService.js](../src/services/ticketService.js) - support ticket flow.
- [../src/services/moderationService.js](../src/services/moderationService.js) - moderation features.

## Persistence and Store Files

- [../src/store/adminNotificationStore.js](../src/store/adminNotificationStore.js) - notification persistence.
- [../src/store/adminSecurityEventStore.js](../src/store/adminSecurityEventStore.js) - security event persistence.
- [../src/store/adminRequestLogStore.js](../src/store/adminRequestLogStore.js) - request logging persistence.
- [../src/store/adminRestoreStateStore.js](../src/store/adminRestoreStateStore.js) - restore-state persistence.
- [../src/store/deliveryAuditStore.js](../src/store/deliveryAuditStore.js) - delivery audit persistence.
- [../src/store/deliveryEvidenceStore.js](../src/store/deliveryEvidenceStore.js) - delivery evidence persistence.
- [../src/store/platformAutomationStateStore.js](../src/store/platformAutomationStateStore.js) - automation state persistence.
- [../src/store/platformOpsStateStore.js](../src/store/platformOpsStateStore.js) - ops-state persistence.
- [../src/store/playerAccountStore.js](../src/store/playerAccountStore.js) - player account persistence.
- [../src/store/publicPreviewAccountStore.js](../src/store/publicPreviewAccountStore.js) - preview-account persistence.
- [../src/store/runtimeStateStore.js](../src/store/runtimeStateStore.js) - runtime status persistence.
- [../src/store/eventStore.js](../src/store/eventStore.js) - event data persistence.
- [../src/store/statsStore.js](../src/store/statsStore.js) - stats persistence.
- [../src/store/linkStore.js](../src/store/linkStore.js) - linked-account persistence.
- [../src/store/ticketStore.js](../src/store/ticketStore.js) - ticket persistence.
- [../src/store/vipStore.js](../src/store/vipStore.js) - VIP persistence.
- [../src/store/redeemStore.js](../src/store/redeemStore.js) - redeem/reward persistence.
- [../src/store/rentBikeStore.js](../src/store/rentBikeStore.js) - rent-bike persistence.
- [../src/store/cartStore.js](../src/store/cartStore.js) - cart persistence.
- [../src/store/bountyStore.js](../src/store/bountyStore.js) - bounty persistence.
- [../src/store/giveawayStore.js](../src/store/giveawayStore.js) - giveaway persistence.
- [../src/store/moderationStore.js](../src/store/moderationStore.js) - moderation persistence.

## Data Layer and Isolation Files

- [../src/utils/tenantDbIsolation.js](../src/utils/tenantDbIsolation.js) - tenant isolation and RLS installation behavior.
- [../prisma/schema.prisma](../prisma/schema.prisma) - Prisma schema template for the platform data layer.
- [../src/prisma.js](../src/prisma.js) - Prisma runtime bootstrap and provider profile logic.
- [../src/prismaClientLoader.js](../src/prismaClientLoader.js) - generated client loader and provider matching.

## Documentation Files in `docs/`

### Core Architecture and System Design

- [README.md](./README.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
- [RUNTIME_BOUNDARY_EXPLAINER.md](./RUNTIME_BOUNDARY_EXPLAINER.md)
- [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
- [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
- [DATA_LAYER_MIGRATION.md](./DATA_LAYER_MIGRATION.md)
- [DATA_OWNERSHIP_MAP.md](./DATA_OWNERSHIP_MAP.md)
- [REPO_STRUCTURE_TH.md](./REPO_STRUCTURE_TH.md)
- [REPO_PRESENTATION.md](./REPO_PRESENTATION.md)
- [SYSTEM_MAP_GITHUB_EN.md](./SYSTEM_MAP_GITHUB_EN.md)
- [SYSTEM_MAP_GITHUB_TH.md](./SYSTEM_MAP_GITHUB_TH.md)
- [WEB_SURFACES_V4_BLUEPRINT_TH.md](./WEB_SURFACES_V4_BLUEPRINT_TH.md)
- [WEB_SURFACES_V4_SITEMAP_TH.md](./WEB_SURFACES_V4_SITEMAP_TH.md)

### Product, Readiness, Roadmap, and Audit

- [PRODUCT_READY_GAP_MATRIX.md](./PRODUCT_READY_GAP_MATRIX.md)
- [PRODUCTION_ROADMAP_P0_P3_TH.md](./PRODUCTION_ROADMAP_P0_P3_TH.md)
- [PRODUCTION_ENV_GAP_TH.md](./PRODUCTION_ENV_GAP_TH.md)
- [DB_ENGINE_MIGRATION_PATH_TH.md](./DB_ENGINE_MIGRATION_PATH_TH.md)
- [DELIVERY_CAPABILITY_MATRIX_TH.md](./DELIVERY_CAPABILITY_MATRIX_TH.md)
- [VERIFICATION_STATUS_TH.md](./VERIFICATION_STATUS_TH.md)
- [WORKLIST.md](./WORKLIST.md)
- [PRACTICAL_ADOPTION_PLAN.md](./PRACTICAL_ADOPTION_PLAN.md)
- [FIX_MASTERLIST_STATUS.md](./FIX_MASTERLIST_STATUS.md)
- [SYSTEM_UPDATES.md](./SYSTEM_UPDATES.md)
- [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)
- [COMMIT_C59FE83_README.md](./COMMIT_C59FE83_README.md)
- [COMMIT_C59FE83_EXPLAINER.md](./COMMIT_C59FE83_EXPLAINER.md)
- [COMMIT_C59FE83_EXPLAINER_TH.md](./COMMIT_C59FE83_EXPLAINER_TH.md)
- [COMMIT_C59FE83_FILE_MATRIX.md](./COMMIT_C59FE83_FILE_MATRIX.md)
- [COMMIT_C59FE83_FILE_MATRIX_TH.md](./COMMIT_C59FE83_FILE_MATRIX_TH.md)
- [PROJECT_DETAIL_FILE_INDEX_README.md](./PROJECT_DETAIL_FILE_INDEX_README.md)

### Deployment, Operations, and Runbooks

- [DEPLOYMENT_STORY.md](./DEPLOYMENT_STORY.md)
- [FIFTEEN_MINUTE_SETUP.md](./FIFTEEN_MINUTE_SETUP.md)
- [OPERATOR_QUICKSTART.md](./OPERATOR_QUICKSTART.md)
- [OPERATIONS_MANUAL_TH.md](./OPERATIONS_MANUAL_TH.md)
- [RUNTIME_OPERATOR_CHECKLIST.md](./RUNTIME_OPERATOR_CHECKLIST.md)
- [GO_LIVE_CHECKLIST_TH.md](./GO_LIVE_CHECKLIST_TH.md)
- [POSTGRESQL_CUTOVER_CHECKLIST.md](./POSTGRESQL_CUTOVER_CHECKLIST.md)
- [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- [SECRET_ROTATION_RUNBOOK.md](./SECRET_ROTATION_RUNBOOK.md)
- [SINGLE_HOST_PRODUCTION_PROFILE.md](./SINGLE_HOST_PRODUCTION_PROFILE.md)
- [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
- [ENV_PROFILES_TH.md](./ENV_PROFILES_TH.md)
- [ENV_REFERENCE_TH.md](./ENV_REFERENCE_TH.md)
- [MACHINE_VALIDATION_GUIDE_TH.md](./MACHINE_VALIDATION_GUIDE_TH.md)
- [DELIVERY_NATIVE_PROOF_COVERAGE.md](./DELIVERY_NATIVE_PROOF_COVERAGE.md)

### Commercial, Subscription, and Customer Docs

- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [SUBSCRIPTION_POLICY_TH.md](./SUBSCRIPTION_POLICY_TH.md)
- [LIMITATIONS_AND_SLA_TH.md](./LIMITATIONS_AND_SLA_TH.md)
- [LEGAL_TERMS_TH.md](./LEGAL_TERMS_TH.md)
- [PRIVACY_POLICY_TH.md](./PRIVACY_POLICY_TH.md)

### UI, Surface, and Product Specs

- [OWNER_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./OWNER_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)
- [OWNER_RUNTIME_HEALTH_INCIDENTS_V4_IMPLEMENTATION_SPEC_TH.md](./OWNER_RUNTIME_HEALTH_INCIDENTS_V4_IMPLEMENTATION_SPEC_TH.md)
- [OWNER_TENANTS_V4_IMPLEMENTATION_SPEC_TH.md](./OWNER_TENANTS_V4_IMPLEMENTATION_SPEC_TH.md)
- [OWNER_V4_WIREFRAMES_TH.md](./OWNER_V4_WIREFRAMES_TH.md)
- [TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_DELIVERY_AGENTS_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_DELIVERY_AGENTS_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_ORDERS_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_ORDERS_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_PLAYERS_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_PLAYERS_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_RESTART_CONTROL_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_RESTART_CONTROL_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_SERVER_BOTS_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_SERVER_BOTS_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_SERVER_CONFIG_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_SERVER_CONFIG_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_SERVER_STATUS_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_SERVER_STATUS_V4_IMPLEMENTATION_SPEC_TH.md)
- [TENANT_V4_WIREFRAMES_TH.md](./TENANT_V4_WIREFRAMES_TH.md)
- [PLAYER_COMMERCE_V4_IMPLEMENTATION_SPEC_TH.md](./PLAYER_COMMERCE_V4_IMPLEMENTATION_SPEC_TH.md)
- [PLAYER_HOME_V4_IMPLEMENTATION_SPEC_TH.md](./PLAYER_HOME_V4_IMPLEMENTATION_SPEC_TH.md)
- [PLAYER_STATS_EVENTS_SUPPORT_V4_IMPLEMENTATION_SPEC_TH.md](./PLAYER_STATS_EVENTS_SUPPORT_V4_IMPLEMENTATION_SPEC_TH.md)
- [PLAYER_V4_WIREFRAMES_TH.md](./PLAYER_V4_WIREFRAMES_TH.md)

### Security, Identity, and Governance

- [ADMIN_DAILY_OPERATIONS_TH.md](./ADMIN_DAILY_OPERATIONS_TH.md)
- [ADMIN_SSO_ROLE_MAPPING_TH.md](./ADMIN_SSO_ROLE_MAPPING_TH.md)
- [SPLIT_ORIGIN_AND_2FA_GUIDE.md](./SPLIT_ORIGIN_AND_2FA_GUIDE.md)
- [CONFIG_MATRIX.md](./CONFIG_MATRIX.md)
- [EVIDENCE_MAP_TH.md](./EVIDENCE_MAP_TH.md)

### Release and Policy

- [RELEASE_POLICY.md](./RELEASE_POLICY.md)
- [RESTART_ANNOUNCEMENT_PRESET.md](./RESTART_ANNOUNCEMENT_PRESET.md)

### ADRs

- [adr/README.md](./adr/README.md)
- [adr/ADR-0001-custom-control-plane.md](./adr/ADR-0001-custom-control-plane.md)
- [adr/ADR-0002-postgresql-runtime-standard.md](./adr/ADR-0002-postgresql-runtime-standard.md)
- [adr/ADR-0003-tenant-isolation-model.md](./adr/ADR-0003-tenant-isolation-model.md)
- [adr/ADR-0004-agent-mode-operational-boundary.md](./adr/ADR-0004-agent-mode-operational-boundary.md)
- [adr/ADR-0005-delivery-backend-strategy.md](./adr/ADR-0005-delivery-backend-strategy.md)

### Release Notes

- [releases/README.md](./releases/README.md)
- [releases/TEMPLATE.md](./releases/TEMPLATE.md)
- [releases/v1.0.0.md](./releases/v1.0.0.md)

### Showcase and Supporting Assets

- [SHOWCASE_TH.md](./SHOWCASE_TH.md)
- [FIIX_BRIEF.md](./FIIX_BRIEF.md)
- [fiix.txt](./fiix.txt)
- [assets/README.md](./assets/README.md)
- [assets/CAPTURE_CHECKLIST.md](./assets/CAPTURE_CHECKLIST.md)
- [assets/admin-dashboard.png](./assets/admin-dashboard.png)
- [assets/admin-login.png](./assets/admin-login.png)
- [assets/architecture-overview.svg](./assets/architecture-overview.svg)
- [assets/platform-demo.gif](./assets/platform-demo.gif)
- [assets/player-dashboard.png](./assets/player-dashboard.png)
- [assets/player-landing.png](./assets/player-landing.png)
- [assets/player-login.png](./assets/player-login.png)
- [assets/player-showcase.png](./assets/player-showcase.png)
- [assets/runtime-validation-contract.svg](./assets/runtime-validation-contract.svg)
- [assets/live-runtime-evidence.md](./assets/live-runtime-evidence.md)
- [assets/live-native-proof-cases.json](./assets/live-native-proof-cases.json)
- [assets/live-native-proof-coverage-summary.md](./assets/live-native-proof-coverage-summary.md)
- [assets/live-native-proof-coverage-summary.json](./assets/live-native-proof-coverage-summary.json)
- [assets/live-native-proof-environments.json](./assets/live-native-proof-environments.json)
- [assets/live-native-proof-experimental-cases.json](./assets/live-native-proof-experimental-cases.json)
- [assets/live-native-proof-matrix.md](./assets/live-native-proof-matrix.md)
- [assets/live-native-proof-matrix.json](./assets/live-native-proof-matrix.json)
- [assets/live-native-proof-extra-matrix.md](./assets/live-native-proof-extra-matrix.md)
- [assets/live-native-proof-extra-matrix.json](./assets/live-native-proof-extra-matrix.json)
- [assets/live-native-proof-wrapper-matrix.md](./assets/live-native-proof-wrapper-matrix.md)
- [assets/live-native-proof-wrapper-matrix.json](./assets/live-native-proof-wrapper-matrix.json)
- [assets/live-native-proof-rcon-attempt.md](./assets/live-native-proof-rcon-attempt.md)
- [assets/live-native-proof-rcon-attempt.json](./assets/live-native-proof-rcon-attempt.json)
- [assets/live-native-proof-enable-spawn-on-ground-matrix.md](./assets/live-native-proof-enable-spawn-on-ground-matrix.md)
- [assets/live-native-proof-enable-spawn-on-ground-cases.json](./assets/live-native-proof-enable-spawn-on-ground-cases.json)
- [assets/live-native-proof-enable-spawn-on-ground-matrix.json](./assets/live-native-proof-enable-spawn-on-ground-matrix.json)
- [assets/live-native-proof-enable-spawn-on-ground-retry.md](./assets/live-native-proof-enable-spawn-on-ground-retry.md)
- [assets/live-native-proof-enable-spawn-on-ground-retry.json](./assets/live-native-proof-enable-spawn-on-ground-retry.json)

## Note

If you want, the next step can be a second document that goes even deeper:

- one line of purpose for every file in `docs/`
- one line of purpose for every major file in `src/`, `apps/`, and `deploy/`

This file is the repository-level navigation layer first.
