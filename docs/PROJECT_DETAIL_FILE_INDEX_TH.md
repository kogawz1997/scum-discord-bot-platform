# ดัชนีไฟล์รายละเอียดโปรเจกต์

อ่านภาษาอังกฤษ: [PROJECT_DETAIL_FILE_INDEX.md](./PROJECT_DETAIL_FILE_INDEX.md)

เอกสารนี้รวบรวมไฟล์ที่ใช้ทำความเข้าใจโปรเจกต์ SCUM managed-service ในระดับระบบ

ขอบเขตของไฟล์ชุดนี้:

- ไฟล์อธิบายภาพรวมของ repo
- ไฟล์ deployment และ runtime topology
- entrypoint ของแต่ละ app
- service และ control-plane files ที่นิยามพฤติกรรมหลักของระบบ
- เอกสารทั้งหมดใน `docs/`

เอกสารนี้ไม่ได้พยายามอธิบายทุก test file หรือทุก asset ย่อยใน repo

## ลำดับการอ่านที่แนะนำ

1. [../README.md](../README.md)
2. [../PROJECT_HQ.md](../PROJECT_HQ.md)
3. [ARCHITECTURE.md](./ARCHITECTURE.md)
4. [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
5. [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
6. [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
7. [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
8. [PRODUCT_READY_GAP_MATRIX.md](./PRODUCT_READY_GAP_MATRIX.md)

## ไฟล์ระดับรากของ Repository

- [../README.md](../README.md) - ภาพรวมหลักของโปรเจกต์และจุดเริ่มต้นของ repo
- [../PROJECT_HQ.md](../PROJECT_HQ.md) - สรุประดับโปรเจกต์และสถานะงาน
- [../PROJECT_REVIEW.md](../PROJECT_REVIEW.md) - บันทึก review และมุมมองต่อสภาพ repo
- [../AGENTS.md](../AGENTS.md) - กติกาเฉพาะ repo ที่ใช้กำกับการ audit และ implementation
- [../SECURITY.md](../SECURITY.md) - แนวทางด้าน security และการรายงานช่องโหว่
- [../CHANGELOG.md](../CHANGELOG.md) - ประวัติ release และการเปลี่ยนแปลง
- [../CONTRIBUTING.md](../CONTRIBUTING.md) - แนวทางการมีส่วนร่วมใน repo
- [../package.json](../package.json) - scripts, runtime roles และ executable surfaces ของระบบ
- [../Dockerfile](../Dockerfile) - จุดเริ่มต้นของ container build
- [../setup-easy.cmd](../setup-easy.cmd) - helper สำหรับ bootstrap เครื่องแบบง่าย
- [../scum-log-watcher.js](../scum-log-watcher.js) - utility/runtime เกี่ยวกับการดู SCUM log

## ไฟล์ Environment และ Deployment

- [../.env.example](../.env.example) - template env พื้นฐาน
- [../.env.development.example](../.env.development.example) - profile สำหรับ development
- [../.env.machine-a-control-plane.example](../.env.machine-a-control-plane.example) - ตัวอย่าง env ของเครื่อง control plane ใน split topology
- [../.env.machine-b-game-bot.example](../.env.machine-b-game-bot.example) - ตัวอย่าง env ของเครื่อง game-bot ใน split topology
- [../.env.multi-tenant-prod.example](../.env.multi-tenant-prod.example) - template สำหรับ multi-tenant production
- [../.env.production.example](../.env.production.example) - template production หลัก
- [../.env.production.split](../.env.production.split) - ตัวอย่าง production แบบ split deployment
- [../.env.single-host-prod.example](../.env.single-host-prod.example) - ตัวอย่าง production แบบ host เดียว
- [../.env.test.example](../.env.test.example) - template สำหรับ test runtime
- [../deploy/docker-compose.production.yml](../deploy/docker-compose.production.yml) - production compose topology
- [../deploy/pm2.ecosystem.config.cjs](../deploy/pm2.ecosystem.config.cjs) - PM2 topology หลักของระบบ
- [../deploy/pm2.local.config.cjs](../deploy/pm2.local.config.cjs) - PM2 profile สำหรับ local
- [../deploy/pm2.machine-a-control-plane.config.cjs](../deploy/pm2.machine-a-control-plane.config.cjs) - config ของเครื่อง control plane ใน split deployment
- [../deploy/pm2.machine-b-game-bot.config.cjs](../deploy/pm2.machine-b-game-bot.config.cjs) - config ของเครื่อง game-bot ใน split deployment
- [../deploy/pm2.scum-agent.config.cjs](../deploy/pm2.scum-agent.config.cjs) - PM2 config สำหรับ agent-centric runtime
- [../deploy/entrypoints/start-role.js](../deploy/entrypoints/start-role.js) - bootstrap script สำหรับ start process ตาม role
- [../deploy/systemd/scum-bot.service](../deploy/systemd/scum-bot.service) - systemd service ของ bot runtime
- [../deploy/systemd/scum-watcher.service](../deploy/systemd/scum-watcher.service) - systemd service ของ watcher
- [../deploy/systemd/scum-web-portal.service](../deploy/systemd/scum-web-portal.service) - systemd service ของ web portal
- [../deploy/systemd/scum-worker.service](../deploy/systemd/scum-worker.service) - systemd service ของ worker

## Entrypoint ของ Apps และ Web Surfaces

- [../apps/admin-web/server.js](../apps/admin-web/server.js) - entrypoint ของ admin web
- [../apps/owner-web/server.js](../apps/owner-web/server.js) - entrypoint ของ Owner Panel
- [../apps/tenant-web/server.js](../apps/tenant-web/server.js) - entrypoint ของ Tenant Admin Panel
- [../apps/web-portal-standalone/server.js](../apps/web-portal-standalone/server.js) - entrypoint ของ player/public portal
- [../apps/api/server.js](../apps/api/server.js) - entrypoint ของ shared API runtime
- [../apps/discord-bot/server.js](../apps/discord-bot/server.js) - entrypoint ของ Discord bot
- [../apps/agent/server.js](../apps/agent/server.js) - entrypoint ของ Delivery Agent
- [../apps/server-bot/server.js](../apps/server-bot/server.js) - entrypoint ของ Server Bot
- [../apps/worker/server.js](../apps/worker/server.js) - entrypoint ของ background worker
- [../apps/watcher/server.js](../apps/watcher/server.js) - entrypoint ของ watcher runtime

## ไฟล์ฝั่ง Player และ Public Portal

- [../apps/web-portal-standalone/README.md](../apps/web-portal-standalone/README.md) - ภาพรวมเฉพาะของ portal
- [../apps/web-portal-standalone/api/publicPlatformRoutes.js](../apps/web-portal-standalone/api/publicPlatformRoutes.js) - public product routes, signup, preview และ API ของ `/s/:slug`
- [../apps/web-portal-standalone/api/playerGeneralRoutes.js](../apps/web-portal-standalone/api/playerGeneralRoutes.js) - route หลักของ profile, stats, support และ linked accounts
- [../apps/web-portal-standalone/api/playerCommerceRoutes.js](../apps/web-portal-standalone/api/playerCommerceRoutes.js) - commerce, wallet, shop และ order flows
- [../apps/web-portal-standalone/api/playerRouteEntitlements.js](../apps/web-portal-standalone/api/playerRouteEntitlements.js) - entitlement enforcement ฝั่ง player
- [../apps/web-portal-standalone/auth/portalAuthRuntime.js](../apps/web-portal-standalone/auth/portalAuthRuntime.js) - auth runtime ของ portal
- [../apps/web-portal-standalone/auth/publicPreviewAuthRuntime.js](../apps/web-portal-standalone/auth/publicPreviewAuthRuntime.js) - auth runtime ของ preview mode
- [../apps/web-portal-standalone/runtime/portalBootstrapRuntime.js](../apps/web-portal-standalone/runtime/portalBootstrapRuntime.js) - bootstrap dependency ของ portal runtime
- [../apps/web-portal-standalone/runtime/portalRuntime.js](../apps/web-portal-standalone/runtime/portalRuntime.js) - composition หลักของ portal runtime
- [../apps/web-portal-standalone/runtime/portalPageRoutes.js](../apps/web-portal-standalone/runtime/portalPageRoutes.js) - HTML routes รวมถึง `/s/:slug`
- [../apps/web-portal-standalone/runtime/portalSurfaceRuntime.js](../apps/web-portal-standalone/runtime/portalSurfaceRuntime.js) - routing/composition ระดับ surface
- [../apps/web-portal-standalone/runtime/portalServerLifecycle.js](../apps/web-portal-standalone/runtime/portalServerLifecycle.js) - lifecycle ของ portal server
- [../apps/web-portal-standalone/public/assets/portal-i18n.js](../apps/web-portal-standalone/public/assets/portal-i18n.js) - locale runtime ของ public/player portal
- [../apps/web-portal-standalone/public/assets/player-v4-app.js](../apps/web-portal-standalone/public/assets/player-v4-app.js) - client shell หลักของ player app
- [../apps/web-portal-standalone/public/assets/player-control-v4.js](../apps/web-portal-standalone/public/assets/player-control-v4.js) - behavior ของ player dashboard
- [../apps/web-portal-standalone/public/assets/player-commerce-v4.js](../apps/web-portal-standalone/public/assets/player-commerce-v4.js) - flow ฝั่ง client ของ commerce
- [../apps/web-portal-standalone/public/assets/player-home-v4.js](../apps/web-portal-standalone/public/assets/player-home-v4.js) - surface หลักของ player home
- [../apps/web-portal-standalone/public/assets/player-stats-events-support-v4.js](../apps/web-portal-standalone/public/assets/player-stats-events-support-v4.js) - surface ของ stats, events และ support
- [../apps/web-portal-standalone/public/assets/player-auth-v1.js](../apps/web-portal-standalone/public/assets/player-auth-v1.js) - พฤติกรรม UI ด้าน auth ของ player

## ไฟล์ฝั่ง Control Plane, Admin, Owner และ Tenant

- [../src/adminWebServer.js](../src/adminWebServer.js) - HTTP server หลักของ control plane
- [../src/admin/api/adminGetRoutes.js](../src/admin/api/adminGetRoutes.js) - read surface หลักของ owner/admin/tenant control plane
- [../src/admin/api/adminPlatformPostRoutes.js](../src/admin/api/adminPlatformPostRoutes.js) - write actions ระดับ platform
- [../src/admin/api/adminRuntimeControlPostRoutes.js](../src/admin/api/adminRuntimeControlPostRoutes.js) - runtime control actions เช่น restart และ runtime operations
- [../src/admin/api/adminConfigPostRoutes.js](../src/admin/api/adminConfigPostRoutes.js) - route สำหรับ config mutations
- [../src/admin/api/adminPublicRoutes.js](../src/admin/api/adminPublicRoutes.js) - public/admin onboarding และ activation routes
- [../src/admin/api/adminBillingGetRoutes.js](../src/admin/api/adminBillingGetRoutes.js) - read surface ของ billing
- [../src/admin/api/adminBillingPostRoutes.js](../src/admin/api/adminBillingPostRoutes.js) - write surface ของ billing
- [../src/admin/api/adminNotificationGetRoutes.js](../src/admin/api/adminNotificationGetRoutes.js) - route อ่าน notifications
- [../src/admin/api/adminNotificationPostRoutes.js](../src/admin/api/adminNotificationPostRoutes.js) - route action ของ notifications
- [../src/admin/api/tenantRouteEntitlements.js](../src/admin/api/tenantRouteEntitlements.js) - entitlement enforcement ฝั่ง tenant
- [../src/admin/api/tenantRoutePermissions.js](../src/admin/api/tenantRoutePermissions.js) - permission enforcement ฝั่ง tenant
- [../src/admin/runtime/adminAccessRuntime.js](../src/admin/runtime/adminAccessRuntime.js) - access checks และ tenant-boundary enforcement
- [../src/admin/runtime/adminSecurityRuntime.js](../src/admin/runtime/adminSecurityRuntime.js) - security signals, rate limits และ security-event behavior ของ admin
- [../src/admin/runtime/adminObservabilityRuntime.js](../src/admin/runtime/adminObservabilityRuntime.js) - observability aggregation ฝั่ง admin
- [../src/admin/assets/admin-i18n.js](../src/admin/assets/admin-i18n.js) - locale runtime ของ admin/tenant surfaces
- [../src/admin/assets/owner-v4-app.js](../src/admin/assets/owner-v4-app.js) - bootstrap และ state loading ของ Owner surface
- [../src/admin/assets/owner-control-v4.js](../src/admin/assets/owner-control-v4.js) - logic หลักของ Owner Panel และ operational/commercial controls
- [../src/admin/assets/tenant-v4-app.js](../src/admin/assets/tenant-v4-app.js) - bootstrap และ navigation shell ของ Tenant Panel
- [../src/admin/assets/tenant-dashboard-v4.js](../src/admin/assets/tenant-dashboard-v4.js) - surface ของ tenant dashboard
- [../src/admin/assets/tenant-billing-v4.js](../src/admin/assets/tenant-billing-v4.js) - UI ของ tenant billing
- [../src/admin/assets/tenant-onboarding-v4.js](../src/admin/assets/tenant-onboarding-v4.js) - onboarding checklist และ next-step UI
- [../src/admin/assets/tenant-server-config-v4.js](../src/admin/assets/tenant-server-config-v4.js) - UI ของ config editor
- [../src/admin/assets/tenant-restart-control-v4.js](../src/admin/assets/tenant-restart-control-v4.js) - UI ของ restart orchestration
- [../src/admin/assets/tenant-delivery-agents-v4.js](../src/admin/assets/tenant-delivery-agents-v4.js) - surface สำหรับจัดการ Delivery Agent
- [../src/admin/assets/tenant-server-bots-v4.js](../src/admin/assets/tenant-server-bots-v4.js) - surface สำหรับจัดการ Server Bot
- [../src/admin/assets/tenant-orders-v4.js](../src/admin/assets/tenant-orders-v4.js) - งานด้าน order และ delivery operations ฝั่ง tenant
- [../src/admin/assets/tenant-donations-v4.js](../src/admin/assets/tenant-donations-v4.js) - surface ฝั่ง donation admin
- [../src/admin/assets/tenant-events-v4.js](../src/admin/assets/tenant-events-v4.js) - surface ฝั่ง events admin
- [../src/admin/assets/tenant-modules-v4.js](../src/admin/assets/tenant-modules-v4.js) - surface ของ modules และ package-aware capabilities
- [../src/admin/assets/tenant-players-v4.js](../src/admin/assets/tenant-players-v4.js) - surface สำหรับ player/admin management
- [../src/admin/assets/tenant-staff-v4.js](../src/admin/assets/tenant-staff-v4.js) - UI ของ tenant staff และ permissions
- [../src/admin/assets/tenant-settings-v4.js](../src/admin/assets/tenant-settings-v4.js) - surface ของ tenant settings

## Domain และ Core Product Services

- [../src/domain/agents/agentRegistryService.js](../src/domain/agents/agentRegistryService.js) - setup tokens, activation, machine binding และ lifecycle ของ agent
- [../src/domain/billing/packageCatalogService.js](../src/domain/billing/packageCatalogService.js) - package catalog และ metadata ของ package
- [../src/domain/billing/productEntitlementService.js](../src/domain/billing/productEntitlementService.js) - entitlement resolution สำหรับ features และ limits
- [../src/services/platformService.js](../src/services/platformService.js) - tenant/platform creation, lookup และ public slug behavior
- [../src/services/platformBillingLifecycleService.js](../src/services/platformBillingLifecycleService.js) - lifecycle ของ subscription, invoice, payment attempt และ webhook
- [../src/services/publicPreviewService.js](../src/services/publicPreviewService.js) - preview mode, self-service signup, preview account state และ trial-aware flows
- [../src/services/platformIdentityService.js](../src/services/platformIdentityService.js) - linked identities, verification และ identity summary logic
- [../src/services/linkService.js](../src/services/linkService.js) - action ด้าน linked account โดยเฉพาะ Steam-related flows
- [../src/services/platformWorkspaceAuthService.js](../src/services/platformWorkspaceAuthService.js) - workspace auth, invite acceptance, purpose tokens และ tenant sessions
- [../src/services/platformTenantAccessService.js](../src/services/platformTenantAccessService.js) - tenant access model และ checks
- [../src/services/platformTenantStaffService.js](../src/services/platformTenantStaffService.js) - lifecycle ของ tenant staff และ membership operations
- [../src/services/platformTenantConfigService.js](../src/services/platformTenantConfigService.js) - persistence ของ tenant config และ settings ที่กระทบ public/portal
- [../src/services/platformPortalBrandingService.js](../src/services/platformPortalBrandingService.js) - ประกอบ branding ของ public/player จาก tenant config
- [../src/services/platformServerConfigService.js](../src/services/platformServerConfigService.js) - save/apply history และ config job orchestration
- [../src/services/serverBotConfigSchemaService.js](../src/services/serverBotConfigSchemaService.js) - schema-driven config metadata และ typed fields
- [../src/services/serverBotIniService.js](../src/services/serverBotIniService.js) - helper สำหรับอ่าน/เขียน `.ini` ที่ Server Bot ใช้
- [../src/services/platformRestartOrchestrationService.js](../src/services/platformRestartOrchestrationService.js) - restart plans, announcements, history และ execution flow
- [../src/services/restartScheduler.js](../src/services/restartScheduler.js) - ชั้นช่วยด้าน restart scheduling
- [../src/services/scumServerBotRuntime.js](../src/services/scumServerBotRuntime.js) - logic หลักของ Server Bot ฝั่ง server machine
- [../src/services/scumLogWatcherRuntime.js](../src/services/scumLogWatcherRuntime.js) - logic การดู SCUM log และ sync
- [../src/services/scumConsoleAgent.js](../src/services/scumConsoleAgent.js) - logic หลักของ Delivery Agent ฝั่ง console machine
- [../src/services/rconDelivery.js](../src/services/rconDelivery.js) - ชั้น execution ของ delivery commands
- [../src/services/deliveryLifecycleService.js](../src/services/deliveryLifecycleService.js) - delivery queue, attempts, dead letters และ recovery behavior
- [../src/services/runtimeSupervisorService.js](../src/services/runtimeSupervisorService.js) - runtime supervision และ process monitoring
- [../src/services/runtimeHealthServer.js](../src/services/runtimeHealthServer.js) - health endpoint และ runtime health reporting
- [../src/services/platformMonitoringService.js](../src/services/platformMonitoringService.js) - ops alerts, quota signals และ monitoring ของ runtime/subscription
- [../src/services/platformAutomationService.js](../src/services/platformAutomationService.js) - automation และ recurring operational routines
- [../src/services/adminAuditService.js](../src/services/adminAuditService.js) - audit logging และ audit queries
- [../src/services/adminSnapshotService.js](../src/services/adminSnapshotService.js) - backup/restore และ snapshot management
- [../src/services/adminObservabilityService.js](../src/services/adminObservabilityService.js) - observability aggregation ระดับสูง
- [../src/services/adminDashboardService.js](../src/services/adminDashboardService.js) - dashboard aggregation ข้าม surface
- [../src/services/tenantDiagnosticsService.js](../src/services/tenantDiagnosticsService.js) - diagnostics และ setup-state analysis
- [../src/services/platformAnalyticsService.js](../src/services/platformAnalyticsService.js) - analytics aggregation
- [../src/services/eventService.js](../src/services/eventService.js) - logic ของ event system
- [../src/services/tenantDonationOverviewService.js](../src/services/tenantDonationOverviewService.js) - donation overview และ aggregation
- [../src/services/raidService.js](../src/services/raidService.js) - raid request, raid window และ summary logic
- [../src/services/statsService.js](../src/services/statsService.js) - stats ingestion และ read model
- [../src/services/killFeedService.js](../src/services/killFeedService.js) - logic ของ killfeed
- [../src/services/leaderboardPanels.js](../src/services/leaderboardPanels.js) - การประกอบ leaderboard
- [../src/services/shopService.js](../src/services/shopService.js) - logic ของ shop
- [../src/services/cartService.js](../src/services/cartService.js) - lifecycle ของ cart
- [../src/services/purchaseService.js](../src/services/purchaseService.js) - processing ของ order และ purchase
- [../src/services/purchaseStateMachine.js](../src/services/purchaseStateMachine.js) - state transitions ของ purchase
- [../src/services/rewardService.js](../src/services/rewardService.js) - flow ของ reward claim และ grant
- [../src/services/coinService.js](../src/services/coinService.js) - wallet/coin accounting
- [../src/services/vipService.js](../src/services/vipService.js) - logic ของ VIP product และ status
- [../src/services/welcomePackService.js](../src/services/welcomePackService.js) - flow ของ welcome pack
- [../src/services/rentBikeService.js](../src/services/rentBikeService.js) - flow ของ rent-bike
- [../src/services/giveawayService.js](../src/services/giveawayService.js) - logic ของ giveaway
- [../src/services/ticketService.js](../src/services/ticketService.js) - flow ของ support ticket
- [../src/services/moderationService.js](../src/services/moderationService.js) - feature ฝั่ง moderation

## ไฟล์ด้าน Persistence และ Store

- [../src/store/adminNotificationStore.js](../src/store/adminNotificationStore.js) - persistence ของ notifications
- [../src/store/adminSecurityEventStore.js](../src/store/adminSecurityEventStore.js) - persistence ของ security events
- [../src/store/adminRequestLogStore.js](../src/store/adminRequestLogStore.js) - persistence ของ request logs
- [../src/store/adminRestoreStateStore.js](../src/store/adminRestoreStateStore.js) - persistence ของ restore state
- [../src/store/deliveryAuditStore.js](../src/store/deliveryAuditStore.js) - persistence ของ delivery audit
- [../src/store/deliveryEvidenceStore.js](../src/store/deliveryEvidenceStore.js) - persistence ของ delivery evidence
- [../src/store/platformAutomationStateStore.js](../src/store/platformAutomationStateStore.js) - persistence ของ automation state
- [../src/store/platformOpsStateStore.js](../src/store/platformOpsStateStore.js) - persistence ของ ops state
- [../src/store/playerAccountStore.js](../src/store/playerAccountStore.js) - persistence ของ player accounts
- [../src/store/publicPreviewAccountStore.js](../src/store/publicPreviewAccountStore.js) - persistence ของ preview accounts
- [../src/store/runtimeStateStore.js](../src/store/runtimeStateStore.js) - persistence ของ runtime status
- [../src/store/eventStore.js](../src/store/eventStore.js) - persistence ของ event data
- [../src/store/statsStore.js](../src/store/statsStore.js) - persistence ของ stats
- [../src/store/linkStore.js](../src/store/linkStore.js) - persistence ของ linked accounts
- [../src/store/ticketStore.js](../src/store/ticketStore.js) - persistence ของ tickets
- [../src/store/vipStore.js](../src/store/vipStore.js) - persistence ของ VIP
- [../src/store/redeemStore.js](../src/store/redeemStore.js) - persistence ของ redeem/reward
- [../src/store/rentBikeStore.js](../src/store/rentBikeStore.js) - persistence ของ rent-bike
- [../src/store/cartStore.js](../src/store/cartStore.js) - persistence ของ cart
- [../src/store/bountyStore.js](../src/store/bountyStore.js) - persistence ของ bounty
- [../src/store/giveawayStore.js](../src/store/giveawayStore.js) - persistence ของ giveaway
- [../src/store/moderationStore.js](../src/store/moderationStore.js) - persistence ของ moderation

## ไฟล์ Data Layer และ Isolation

- [../src/utils/tenantDbIsolation.js](../src/utils/tenantDbIsolation.js) - logic ของ tenant isolation และ RLS installation
- [../prisma/schema.prisma](../prisma/schema.prisma) - Prisma schema template ของ data layer
- [../src/prisma.js](../src/prisma.js) - Prisma runtime bootstrap และ provider profile logic
- [../src/prismaClientLoader.js](../src/prismaClientLoader.js) - generated client loader และ provider matching

## เอกสารทั้งหมดใน `docs/`

### สถาปัตยกรรมและการออกแบบระบบ

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

### Product, Readiness, Roadmap และ Audit

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

### Deployment, Operations และ Runbooks

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

### Commercial, Subscription และ Customer Docs

- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [SUBSCRIPTION_POLICY_TH.md](./SUBSCRIPTION_POLICY_TH.md)
- [LIMITATIONS_AND_SLA_TH.md](./LIMITATIONS_AND_SLA_TH.md)
- [LEGAL_TERMS_TH.md](./LEGAL_TERMS_TH.md)
- [PRIVACY_POLICY_TH.md](./PRIVACY_POLICY_TH.md)

### UI, Surface และ Product Specs

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

### Security, Identity และ Governance

- [ADMIN_DAILY_OPERATIONS_TH.md](./ADMIN_DAILY_OPERATIONS_TH.md)
- [ADMIN_SSO_ROLE_MAPPING_TH.md](./ADMIN_SSO_ROLE_MAPPING_TH.md)
- [SPLIT_ORIGIN_AND_2FA_GUIDE.md](./SPLIT_ORIGIN_AND_2FA_GUIDE.md)
- [CONFIG_MATRIX.md](./CONFIG_MATRIX.md)
- [EVIDENCE_MAP_TH.md](./EVIDENCE_MAP_TH.md)

### Release และ Policy

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

### Showcase และ Supporting Assets

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

## หมายเหตุ

ถ้าคุณต้องการ รอบถัดไปผมทำต่อได้อีกชั้นเป็น:

- one-line purpose สำหรับทุกไฟล์ใน `docs/`
- one-line purpose สำหรับทุกไฟล์สำคัญใน `src/`, `apps/`, และ `deploy/`

เอกสารนี้ตั้งใจเป็นชั้นนำทางระดับ repo ก่อน
