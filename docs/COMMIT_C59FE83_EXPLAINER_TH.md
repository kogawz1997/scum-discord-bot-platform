# คำอธิบาย Commit `c59fe83`

Read in English: [COMMIT_C59FE83_EXPLAINER.md](./COMMIT_C59FE83_EXPLAINER.md)
ภาคผนวกรายไฟล์: [COMMIT_C59FE83_FILE_MATRIX_TH.md](./COMMIT_C59FE83_FILE_MATRIX_TH.md)

## Commit นี้คืออะไร

Commit `c59fe83` เป็นก้อนงาน hardening ใหญ่ของแพลตฟอร์ม managed service ไม่ใช่ฟีเจอร์เดี่ยว 1 ตัว แต่เป็นการปิดช่องว่างของหลาย subsystem ที่เชื่อมกันอยู่แล้วในระบบเดิม

ก้อนหลักของงานนี้คือ:

1. Public server routes และ tenant branding สำหรับ `/s/:slug`
2. Identity / account-state cohesion ระหว่าง preview, player และ workspace
3. Billing และ monitoring hardening
4. การเชื่อมหน้า Owner, Tenant และ Player ให้เห็นข้อมูลที่ใช้งานได้จริงขึ้น
5. Admin security และ observability
6. Prisma / persistence / tenant isolation hardening
7. Delivery audit และ snapshot consistency
8. การเพิ่ม regression tests และเก็บ test ที่แดงให้กลับมาเขียว

## ไฟล์ใหม่ที่เพิ่ม

- [src/services/platformPortalBrandingService.js](/C:/new/src/services/platformPortalBrandingService.js)
- [test/admin-security-runtime.test.js](/C:/new/test/admin-security-runtime.test.js)
- [test/delivery-audit-store.test.js](/C:/new/test/delivery-audit-store.test.js)
- [test/platform-monitoring-service.test.js](/C:/new/test/platform-monitoring-service.test.js)
- [test/platform-portal-branding-service.test.js](/C:/new/test/platform-portal-branding-service.test.js)
- [test/prisma-runtime-profile.test.js](/C:/new/test/prisma-runtime-profile.test.js)

## ก้อนงานหลัก

### 1. Public server routes และ branding

ไฟล์หลัก:

- [apps/web-portal-standalone/api/publicPlatformRoutes.js](/C:/new/apps/web-portal-standalone/api/publicPlatformRoutes.js)
- [apps/web-portal-standalone/runtime/portalPageRoutes.js](/C:/new/apps/web-portal-standalone/runtime/portalPageRoutes.js)
- [apps/web-portal-standalone/runtime/portalBootstrapRuntime.js](/C:/new/apps/web-portal-standalone/runtime/portalBootstrapRuntime.js)
- [src/services/platformPortalBrandingService.js](/C:/new/src/services/platformPortalBrandingService.js)
- [src/services/platformService.js](/C:/new/src/services/platformService.js)

หน้าที่:

- เพิ่ม public tenant-isolated routes จริงภายใต้ `/s/:slug`
- เพิ่ม API คู่กันภายใต้ `/api/public/server/:slug/...`
- เพิ่มระบบ branding แบบปลอดภัยสำหรับ public/player surfaces

logic หลัก:

- `getPlatformTenantBySlug(...)` ใช้หา tenant จาก slug
- `buildTenantPortalBranding(...)` อ่าน brand config ของ tenant แล้ว normalize เป็น `siteName`, `siteDetail`, `logo`, `banner`, `colors`, `themeTokens`
- public API จะ compose ข้อมูลหลักของ tenant หนึ่งก้อน แล้วแยกคืนเป็น section `workspace`, `stats`, `shop`, `events`, `donate`
- หน้า HTML `/s/:slug` render shell ก่อน แล้ว fetch API ของตัวเองอีกที ทำให้หน้าเว็บกับ API ใช้ข้อมูลชุดเดียวกัน

ผลที่ได้:

- `/s/:slug` จากเดิมที่ยังไม่เป็น product surface ชัด ตอนนี้กลายเป็น public tenant route ของจริงแล้ว

### 2. Identity / account-state cohesion

ไฟล์หลัก:

- [src/services/platformIdentityService.js](/C:/new/src/services/platformIdentityService.js)
- [src/services/platformWorkspaceAuthService.js](/C:/new/src/services/platformWorkspaceAuthService.js)
- [src/services/publicPreviewService.js](/C:/new/src/services/publicPreviewService.js)
- [apps/web-portal-standalone/api/playerGeneralRoutes.js](/C:/new/apps/web-portal-standalone/api/playerGeneralRoutes.js)

หน้าที่:

- ลดอาการ identity state drift ระหว่าง preview, player และ workspace
- ทำ linked-account status ให้สื่อจาก source เดียวกันมากขึ้น
- ทำ token flow ให้ปลอดภัยทั้ง SQLite และ PostgreSQL

logic หลัก:

- `buildLinkedAccountSummary(...)` รวมข้อมูล user, identities, memberships, player profile มาเป็น summary เดียว
- `buildIdentityNextSteps(...)` บอก next step ที่ผู้ใช้ยังขาด เช่น link Discord หรือ Steam
- `getIdentitySummaryForPreviewAccount(...)` ใช้ preview account id หรือ email เพื่อ resolve identity state จริง
- token paths เช่น `issueEmailVerificationToken(...)`, `issuePasswordResetToken(...)`, `completeEmailVerification(...)`, `completePasswordReset(...)`, `issuePurposeToken(...)`, `acceptTenantStaffInvite(...)`
  ใช้ `toSqlTimestampValue(...)` เพื่อส่งค่าเวลาที่ถูกชนิดตาม runtime
- `publicPreviewService` ใช้ summary กลางนี้ไป decorate preview account
- `playerGeneralRoutes` ใช้ summary กลางตอนตอบ player profile

ผลที่ได้:

- ระบบเดิมที่มีชิ้นส่วน identity อยู่แล้ว ถูกเชื่อมให้เป็นก้อนเดียวมากขึ้น โดยไม่ต้องสร้าง auth ใหม่ทั้งระบบ

### 3. Billing และ monitoring hardening

ไฟล์หลัก:

- [src/services/platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
- [src/services/platformMonitoringService.js](/C:/new/src/services/platformMonitoringService.js)
- [src/admin/assets/owner-control-v4.js](/C:/new/src/admin/assets/owner-control-v4.js)
- [src/admin/assets/owner-v4-app.js](/C:/new/src/admin/assets/owner-v4-app.js)

หน้าที่:

- ทำ webhook verification และ billing lifecycle ให้แน่นขึ้น
- เพิ่ม monitoring alerts สำหรับ subscription risk และ runtime drift
- เอาสัญญาณเหล่านี้ไปแสดงใน Owner UI

logic หลัก:

- billing รองรับ `PLATFORM_BILLING_WEBHOOK_SECRET`
- `processBillingWebhookEvent(...)` เป็นตัวกลางจัดการ webhook -> invoice -> payment attempt -> subscription event
- monitoring scan subscriptions แล้วจัดกลุ่ม `expiringSoon`, `pastDue`, `suspended`, `expired`
- มี cooldown ต่อ alert key เพื่อไม่ให้ยิง alert ซ้ำถี่เกินไป
- owner workspace แสดง commercial pressure, restart history, failed requests, sync evidence และ delivery audit รวมกันได้

### 4. Admin security และ observability

ไฟล์หลัก:

- [src/admin/runtime/adminSecurityRuntime.js](/C:/new/src/admin/runtime/adminSecurityRuntime.js)
- [src/admin/runtime/adminRequestRuntime.js](/C:/new/src/admin/runtime/adminRequestRuntime.js)
- [src/admin/runtime/adminSecurityExportRuntime.js](/C:/new/src/admin/runtime/adminSecurityExportRuntime.js)
- [src/admin/runtime/adminObservabilityRuntime.js](/C:/new/src/admin/runtime/adminObservabilityRuntime.js)
- [src/admin/api/adminGetRoutes.js](/C:/new/src/admin/api/adminGetRoutes.js)
- [src/adminWebServer.js](/C:/new/src/adminWebServer.js)

หน้าที่:

- ขยาย security signal และ observability wiring
- ทำ request helpers ให้ทนกับ partial/mocked requests มากขึ้น
- expose `platformOps` ใน admin observability

logic หลัก:

- security runtime บันทึก security events ได้ละเอียดขึ้น
- รองรับ warning signals ที่ไม่ต้องสร้าง notification ทุกครั้ง
- security export path กลายเป็น async ที่ await store จริง
- observability snapshot มี `platformOps` เพิ่ม

### 5. Persistence / Prisma / tenant isolation

ไฟล์หลัก:

- [src/prisma.js](/C:/new/src/prisma.js)
- [src/prismaClientLoader.js](/C:/new/src/prismaClientLoader.js)
- [prisma/schema.prisma](/C:/new/prisma/schema.prisma)
- [scripts/prisma-with-provider.js](/C:/new/scripts/prisma-with-provider.js)
- [scripts/run-tests-with-provider.js](/C:/new/scripts/run-tests-with-provider.js)
- [src/utils/tenantDbIsolation.js](/C:/new/src/utils/tenantDbIsolation.js)

หน้าที่:

- ทำ runtime/provider truth ให้ชัดขึ้น
- ทำ provider-specific tests ให้เสถียรขึ้น
- ทำ tenant isolation เป็น explicit migration-first มากขึ้น

logic หลัก:

- `prisma.js` initialize test database defaults เร็วขึ้น และอธิบาย runtime profile ชัดขึ้น
- `prismaClientLoader.js` detect provider จาก `DATABASE_URL` ได้ดีกว่าเดิม
- `schema.prisma` และ `prisma-with-provider.js` สื่อชัดขึ้นว่า source schema เป็น compatibility template ส่วน runtime truth มาจาก rendered provider schema
- `run-tests-with-provider.js` cleanup tenant schemas แบบ lock-safe ขึ้น
- `tenantDbIsolation.js` จะ throw `TENANT_DB_ISOLATION_TABLE_REQUIRED` ถ้าตารางที่ต้องใช้ยังไม่มี แทนการสร้างให้เงียบ ๆ

### 6. Delivery audit และ snapshot consistency

ไฟล์หลัก:

- [src/store/deliveryAuditStore.js](/C:/new/src/store/deliveryAuditStore.js)
- [src/services/adminSnapshotService.js](/C:/new/src/services/adminSnapshotService.js)

หน้าที่:

- กัน duplicate delivery audit rows
- ทำให้ backup/restore นับ delivery audit แบบ logical rows

logic หลัก:

- `dedupeAuditRows(...)` dedupe ตาม `id`
- `replaceDeliveryAudit(...)` replace state ด้วยข้อมูลที่ dedupe แล้ว และ persist ด้วย `upsert(...)`
- snapshot build/restore จะ dedupe delivery audit ก่อนนับและก่อน restore

### 7. Tenant staff / workspace auth

ไฟล์หลัก:

- [src/services/platformTenantStaffService.js](/C:/new/src/services/platformTenantStaffService.js)
- [src/services/platformWorkspaceAuthService.js](/C:/new/src/services/platformWorkspaceAuthService.js)

หน้าที่:

- จัดการ invite/update/revoke/accept flow ของ tenant staff
- ทำ token/password flow ของ tenant workspace ให้เสถียรขึ้น

logic หลัก:

- quote camelCase columns ให้ถูกใน PostgreSQL
- ส่งค่า timestamp ให้ตรงชนิดจริงของ runtime
- `acceptTenantStaffInvite(...)` จะ consume token, set password ถ้าจำเป็น, activate membership แล้ว resolve tenant session context กลับ

## dependency ใหม่

ไม่มี npm package ใหม่

สิ่งที่เพิ่มคือ internal/config dependencies:

- `PLATFORM_BILLING_WEBHOOK_SECRET`
- `SCUM_CONSOLE_AGENT_ALLOW_MANAGED_SERVER_CONTROL`

ผูกกับไฟล์หลัก:

- [src/services/platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
- [src/services/scumConsoleAgent.js](/C:/new/src/services/scumConsoleAgent.js)
- [src/config/adminEditableConfig.js](/C:/new/src/config/adminEditableConfig.js)
- [src/utils/env.js](/C:/new/src/utils/env.js)
- [C:\new\.env.example](/C:/new/.env.example)
- [C:\new\.env.production.example](/C:/new/.env.production.example)

## ความเสี่ยงที่ควรระวัง

### 1. Commit นี้กว้าง

แตะหลาย subsystem พร้อมกัน ถึงแม้ test suite จะผ่าน แต่ตอน review ควรดูเป็นก้อน ไม่ควร skim ผ่านเร็ว

### 2. `/s/:slug` ยังเป็น public product shell มากกว่า polished community site

route ใช้งานได้จริงแล้ว แต่ content depth, merchandising และ polish ยังไปต่อได้อีก

### 3. identity ดีขึ้น แต่ยังไม่ใช่ account center เต็มตัว

linked summary ดีขึ้นมาก แต่ Google login และ self-service unlink/relink/recovery ยังไม่ครบใน commit นี้

### 4. timestamp handling กลายเป็นจุดสำคัญ

งานนี้แก้หลาย bug ด้วย runtime-aware timestamp conversion ถ้าอนาคตมี raw SQL ใหม่ที่ไม่ใช้ pattern เดียวกัน มีโอกาส regression ซ้ำได้

### 5. tenant isolation เข้มขึ้น

`installTenantDbIsolation(...)` fail เร็วและชัดขึ้น ถ้า migration ไม่ครบ environment เดิมที่เคยพึ่ง implicit create จะเริ่มแตกเร็วขึ้น

### 6. งานยังไม่ได้ merge เข้า `main`

ตอนนี้อยู่บน:

- branch: `codex/managed-service-readiness-hardening`
- commit: `c59fe83`

ไม่ได้ push เข้า `origin/main` ตรง เพราะ remote `main` ขยับและเกิด rebase conflicts จำนวนมาก

## สถานะการยืนยันผล

ยืนยันในเครื่องนี้แล้วด้วย:

- `npm.cmd test`
- `npm.cmd run lint:text`

ทั้งสองคำสั่งผ่านตอนจบงาน
