# รายการไฟล์ทั้งหมดของ Commit `c59fe83`

Read in English: [COMMIT_C59FE83_FILE_MATRIX.md](./COMMIT_C59FE83_FILE_MATRIX.md)

เอกสารนี้สรุปทุกไฟล์ที่ถูกแตะใน commit `c59fe83` และอธิบายว่าแต่ละไฟล์มีบทบาทอะไรในชุดงานนี้

## ไฟล์ใหม่ที่เพิ่ม

- `src/services/platformPortalBrandingService.js` - service ใหม่สำหรับสร้าง branding ของหน้า public/player จาก tenant config เช่น site name, logo, banner และ color tokens
- `test/admin-security-runtime.test.js` - test ใหม่สำหรับ security signals, warning events และ notification suppression
- `test/delivery-audit-store.test.js` - test ใหม่สำหรับ delivery audit dedupe และ replace/upsert behavior
- `test/platform-monitoring-service.test.js` - test ใหม่สำหรับ monitoring alerts และ subscription-risk reporting
- `test/platform-portal-branding-service.test.js` - test ใหม่สำหรับ branding normalization และ theme token output
- `test/prisma-runtime-profile.test.js` - test ใหม่สำหรับ runtime-profile และ provider-truth helpers ของ Prisma

## Environment และตัวอย่าง config

- `.env.example` - เพิ่ม `SCUM_CONSOLE_AGENT_ALLOW_MANAGED_SERVER_CONTROL=false` เพื่อให้การควบคุม managed server ผ่าน console agent ต้องเปิดใช้งานแบบ explicit
- `.env.production.example` - เพิ่ม env ตัวเดียวกันใน production template

## กลุ่ม Public และ Player Surface

- `apps/web-portal-standalone/api/playerGeneralRoutes.js` - ใช้ identity summary กลางมากขึ้น ทำให้ player/profile state ตอบสอดคล้องกว่าเดิม
- `apps/web-portal-standalone/api/publicPlatformRoutes.js` - เพิ่ม API จริงสำหรับ `/api/public/server/:slug/(workspace|stats|shop|events|donate)`
- `apps/web-portal-standalone/public/assets/player-auth-v1.js` - ปรับ auth UI ฝั่ง player ให้ตรงกับ flow identity และ portal state รุ่นใหม่
- `apps/web-portal-standalone/public/assets/player-control-v4.js` - ปรับ state bindings ของ player control ให้สอดคล้องกับ flow ใหม่
- `apps/web-portal-standalone/public/assets/player-v4-app.js` - ขยาย logic และ copy ของ player app ให้รองรับ public/server-aware behavior
- `apps/web-portal-standalone/public/assets/player-v4-base.css` - เพิ่ม style รองรับ shell และ branding ใหม่ของ player/public
- `apps/web-portal-standalone/public/assets/player-v4-shared.js` - เพิ่ม shared helpers สำหรับหน้า player/public รุ่นใหม่
- `apps/web-portal-standalone/public/player-login.html` - ปรับ shell ของ player login ให้เข้ากับ auth surface ปัจจุบัน
- `apps/web-portal-standalone/runtime/portalBootstrapRuntime.js` - inject dependency ใหม่ที่ใช้ใน public server pages เช่น tenant lookup, branding, stats, events, shop, donations
- `apps/web-portal-standalone/runtime/portalPageRoutes.js` - เพิ่ม page routes จริงของ `/s/:slug`, `/s/:slug/stats`, `/s/:slug/shop`, `/s/:slug/events`, `/s/:slug/donate`

## กลุ่ม docs และ provider truth

- `docs/DATABASE_STRATEGY.md` - อธิบาย runtime truth กับ rendered-provider path ให้ชัดขึ้น
- `prisma/schema.prisma` - เพิ่ม note ว่าไฟล์นี้เป็น compatibility template ไม่ใช่ production truth ตรง ๆ
- `scripts/prisma-with-provider.js` - เพิ่ม metadata/banner ของ rendered schema ให้รู้ว่า generate จากอะไรและ provider ไหน
- `scripts/run-tests-with-provider.js` - ทำ provider-aware test cleanup ให้เสถียรขึ้น โดยเฉพาะการลบ tenant schemas ใน PostgreSQL

## กลุ่ม Admin API

- `src/admin/api/adminCommerceDeliveryPostRoutes.js` - เพิ่ม validation/guard ฝั่ง commerce delivery actions
- `src/admin/api/adminConfigPostRoutes.js` - ทำให้ config mutation routes ตรวจ input และเชื่อมกับ security/runtime guards ดีขึ้น
- `src/admin/api/adminDeliveryOpsGetRoutes.js` - เปิดให้อ่าน delivery audit ผ่าน route slice แยก
- `src/admin/api/adminGetRoutes.js` - ปรับ async wiring สำหรับ export/security/observability และ expose dataset เพิ่ม
- `src/admin/api/adminPlatformPostRoutes.js` - ขยาย behavior ฝั่ง package/runtime/billing mutations ตาม test ใหม่
- `src/admin/api/adminPublicRoutes.js` - ปรับ split-surface redirects, local player portal routing, owner/tenant/player public flow
- `src/admin/api/adminRuntimeControlPostRoutes.js` - เพิ่ม validation ของ restart/config/runtime control mutations

## กลุ่ม Admin UI และหน้า HTML

- `src/admin/assets/owner-control-v4.js` - เพิ่ม jobs workspace, delivery audit visibility, expiring-tenant controls, commercial urgency views
- `src/admin/assets/owner-v4-app.js` - โหลด optional datasets เพิ่ม เช่น restart executions, sync runs/events, delivery audit
- `src/admin/assets/tenant-login-v1.js` - ปรับ tenant login UI ให้ตรงกับ auth flow ปัจจุบัน
- `src/admin/assets/tenant-server-config-v4.js` - ปรับ behavior และ wording ของ config page
- `src/admin/assets/tenant-v4-app.js` - ปรับ copy, runtime wording และ navigation/state wiring ฝั่ง tenant
- `src/admin/tenant-login.html` - ปรับ shell ของ tenant login ให้ตรงกับหน้าใหม่

## กลุ่ม Admin runtime และ server wiring

- `src/admin/runtime/adminObservabilityRuntime.js` - เพิ่ม `platformOps` เข้า observability snapshot
- `src/admin/runtime/adminRequestRuntime.js` - ทำ request helpers ให้ทนกับ partial/mocked requests มากขึ้น
- `src/admin/runtime/adminRouteHandlersRuntime.js` - wire dependency ใหม่ของ delivery audit, security และ operational slices
- `src/admin/runtime/adminSecurityExportRuntime.js` - ทำ security export ให้ await async row building จริง
- `src/admin/runtime/adminSecurityRuntime.js` - เพิ่ม security signals, warning events และ action-rate-limit behavior
- `src/adminWebServer.js` - ผูก runtime factories และ route dependencies ใหม่เข้ากับ admin server จริง

## กลุ่ม Prisma / runtime layer

- `src/prisma.js` - ย้าย test database defaulting ให้เกิดเร็วขึ้น และทำ runtime profile behavior ให้ชัดขึ้น
- `src/prismaClientLoader.js` - resolve provider จาก `DATABASE_URL` อย่างระวังมากขึ้นเมื่อ env กับ generated client ไม่ตรงกัน

## กลุ่ม services หลัก

- `src/services/adminSnapshotService.js` - dedupe delivery audit ตอน backup/restore และนับแบบ logical rows
- `src/services/platformBillingLifecycleService.js` - harden webhook verification, delegate detection และ billing persistence behavior
- `src/services/platformIdentityService.js` - เพิ่ม linked-account summary, next steps, preview identity summary และ runtime-aware token timestamps
- `src/services/platformMonitoringService.js` - ยิง alerts สำหรับ subscription risk, quota pressure, delivery anomalies และ stale runtimes พร้อม cooldown tracking
- `src/services/platformService.js` - เพิ่ม tenant slug lookup และทำ tenant slug handling ให้พร้อมกับ public routes
- `src/services/platformTenantStaffService.js` - แก้ PostgreSQL raw SQL casing/timestamp handling สำหรับ invite/update/revoke tenant staff
- `src/services/platformWorkspaceAuthService.js` - harden purpose-token และ tenant staff invite acceptance flow พร้อม timestamp handling ที่ขึ้นกับ runtime
- `src/services/publicPreviewService.js` - decorate preview account ด้วย identity/commercial state ที่ derive จากข้อมูลจริงมากขึ้น
- `src/services/scumConsoleAgent.js` - บังคับ env gating ชัดเจนก่อนอนุญาต managed server control ผ่าน console agent

## กลุ่ม store และ utility

- `src/store/deliveryAuditStore.js` - dedupe audit rows และ persist replacement ด้วย `upsert(...)`
- `src/utils/adminPermissionMatrix.js` - เพิ่ม `mod` เข้า role matrix อย่างสม่ำเสมอ
- `src/utils/tenantDbIsolation.js` - ทำ tenant isolation install เป็น migration-first และ fail ชัดเมื่อ table ที่ต้องใช้ยังไม่มี

## ไฟล์ test ที่แก้

### กลุ่ม Admin และ Platform API

- `test/admin-api.integration.test.js` - ทำ admin API integration flow ให้เสถียรขึ้นและครอบ delivery/test-send มากขึ้น
- `test/admin-commerce-delivery-route.test.js` - lock behavior ของ delivery route ที่มี validation เข้มขึ้น
- `test/admin-config-post-routes.test.js` - lock behavior ของ config mutation validation
- `test/admin-delivery-ops-get-route.test.js` - ทดสอบ delivery audit และ delivery ops GET routes ที่แยกออกมา
- `test/admin-platform-automation-route.test.js` - ครอบ behavior ใหม่ของ platform/automation routes
- `test/admin-public-routes.test.js` - ครอบ redirect และ split-surface routing ใหม่
- `test/admin-route-handlers-runtime.test.js` - ตรวจ route-handler runtime wiring ชุดใหม่

### กลุ่ม snapshot, security และ observability

- `test/admin-snapshot-regression.test.js` - lock พฤติกรรมใหม่เรื่อง logical delivery audit counts ตอน backup/restore
- `test/doctor.integration.test.js` - กัน env leakage ที่ทำให้ doctor tests เพี้ยน
- `test/persistence-production-smoke.test.js` - กัน env contamination ใน production-smoke setup
- `test/platform-monitoring-service.test.js` - ครอบ monitoring alerts และ subscription-risk reporting
- `test/prisma-runtime-profile.test.js` - ครอบ provider/runtime truth helpers

### กลุ่ม Owner และ UI

- `test/owner-control-v4.test.js` - ครอบ jobs workspace, commercial controls และ expiring-tenant controls
- `test/owner-support-detail-pages.test.js` - ยืนยันว่า support/detail pages ยัง render ได้กับ owner commercial workspace ที่ใหญ่ขึ้น
- `test/owner-v4-app-bootstrap.test.js` - ยืนยัน owner app bootstrap กับ optional datasets ใหม่
- `test/player-control-v4.test.js` - ทดสอบ player control behavior และ copy wiring ที่เปลี่ยน
- `test/player-profile-route.test.js` - lock identity summary กลางใน player profile output
- `test/player-route-entitlements.test.js` - lock entitlement behavior ฝั่ง player routes
- `test/portal-page-routes.test.js` - ทดสอบ `/s/:slug` page routing และ shell behavior
- `test/public-platform-routes.test.js` - ทดสอบ public server API routes และ tenant isolation ตาม slug
- `test/public-preview-service.test.js` - ทดสอบ preview identity/commercial state แบบใหม่
- `test/tenant-server-config-v4.test.js` - ยืนยัน tenant config UI behavior หลัง wording/runtime update
- `test/ui-i18n-runtime.test.js` - กัน regression ของ locale behavior
- `test/web-portal-standalone.player-mode.integration.test.js` - ทำ player-mode integration ให้ตรงกับ canonical/local portal URLs ชุดใหม่

### กลุ่ม identity, staff และ billing

- `test/platform-billing-lifecycle-service.test.js` - ครอบ delegate-first billing behavior และ webhook/lifecycle hardening
- `test/platform-identity-service.test.js` - ครอบ unified identity creation, verification และ summary behavior
- `test/platform-tenant-staff-service.test.js` - ครอบ invite/list/update/revoke/accept behavior ของ tenant staff บน PostgreSQL path
- `test/shop-vip-services.integration.test.js` - ปรับให้ flow commerce/VIP สอดคล้องกับ entitlement และ identity assumptions ปัจจุบัน

### กลุ่ม Prisma, topology และ isolation

- `test/prisma-tenant-topology.test.js` - ทดสอบ tenant datasource URL resolution ใน topology แบบ shared/schema/database
- `test/prisma-with-provider.test.js` - ทดสอบ rendered-provider schema generation
- `test/tenant-db-isolation.test.js` - ทดสอบ migration-first tenant isolation และ explicit missing-table failures

### กลุ่ม runtime และ delivery

- `test/delivery-audit-store.test.js` - ทดสอบ idempotent dedupe behavior ของ delivery audit store
- `test/rcon-delivery-routing-context.test.js` - ทำ delivery routing context ให้เสถียรขึ้นด้วยการรอ registry persistence
- `test/runtime-supervisor.test.js` - กัน external env bleed-through ใน optional runtime supervision tests
- `test/scum-console-agent.integration.test.js` - ทดสอบ managed-server-control gating ที่เข้มขึ้นของ console agent

## หมายเหตุเรื่องขอบเขต

รายการนี้อธิบายทุกไฟล์ที่ถูกแตะใน commit `c59fe83` ว่าไฟล์นั้นทำหน้าที่อะไรในชุดงานนี้ ไม่ใช่ประวัติทั้งหมดของไฟล์นั้น

ความเสี่ยงหลักของ commit ยังเหมือนเดิม:

- เป็น commit ที่แตะหลาย subsystem พร้อมกัน
- `/s/:slug` ใช้งานได้จริงแล้ว แต่ยังบางกว่าหน้า public product ที่ polish เต็ม
- identity cohesion ดีขึ้น แต่ยังไม่ใช่ account center แบบ self-service เต็มตัว
- runtime-aware timestamp handling กลายเป็น pattern สำคัญสำหรับ raw SQL ในอนาคต
- tenant isolation install เข้มขึ้น และจะ fail เร็วขึ้นถ้า environment migration ไม่ครบ
