# Detailed Managed-Service Readiness Reassessment (2026-04-25)

เอกสารนี้เป็นการประเมินสถานะปัจจุบันของ repository อีกรอบแบบละเอียด โดยอิงจากโค้ด, โครงสร้าง repo, เอกสารในระบบ, และ test files ที่มีอยู่จริง ณ วันที่ 2026-04-25

ขอบเขตการประเมินรอบนี้:

- ประเมินความพร้อมของโปรเจคในการขยับจาก prototype ไปสู่ production-grade managed service / SaaS-style SCUM platform
- ใช้มาตรฐานเดียวกับเอกสาร audit ก่อนหน้า แต่เพิ่มความละเอียดในจุดเสี่ยงและหลักฐานระดับไฟล์
- รอบนี้ไม่ได้ rerun test suite ทั้ง repo; การประเมินอิงจาก repository inspection เป็นหลัก

## 1. Executive Summary

- ตอนนี้โปรเจคนี้ไม่ใช่ hobby project หรือ internal script set แล้ว แต่ยังไม่ถึงระดับบริการเชิงพาณิชย์ที่เปิดขายได้อย่างมั่นใจ
- จากโค้ดจริง มันคือ control-plane prototype ที่มี subsystem สำคัญหลายส่วนใช้งานได้จริง ได้แก่ multi-tenant persistence, auth/billing foundation, Delivery Agent / Server Bot contract model, config system, restart orchestration, feature gating, และ public onboarding foundation
- สิ่งที่มันใกล้จะเป็นมากที่สุดคือ `Managed-Service Ready`
- แต่สิ่งที่ยังขวางอยู่คือ:
  - runtime boundary ยังไม่สะอาดเต็มที่
  - web surfaces ยังมี convergence debt
  - security / operations ยังไม่ถึงระดับ launch-grade
  - player-facing และ live-ops domains หลายส่วนยัง partial
  - commercial flow ยังมี foundation แต่ยังไม่ครบระดับ provider-grade service
- Overall maturity level: `Managed-Service Prototype`

หลักฐานยืนยันภาพรวม:

- `README.md:13-16` ระบุชัดว่า repo นี้อยู่ระดับ `Managed-Service Prototype`
- `README.md:132-157` ระบุชัดว่ายังไม่ควรมองเป็น public SaaS/self-serve/production money flow

## 2. What is Already Strong

### 2.1 Multi-tenant data model และ platform persistence

จุดนี้แข็งจริงและเป็นหนึ่งในฐานหลักของทั้งระบบ

หลักฐาน:

- `prisma/schema.prisma` มี model ครอบคลุม tenants, subscriptions, identities, agents, provisioning tokens, restart artifacts, config snapshots, notifications, audit, billing, commerce และ player-related data
- `prisma/schema.prisma:754-785` ใช้ `tokenHash` สำหรับ verification/reset token lifecycle
- `prisma/schema.prisma:1235` มี `ControlPlaneAgentProvisioningToken.tokenHash`
- `prisma/schema.prisma:1258` มี `machineFingerprintHash`
- `src/utils/tenantDatabaseTopology.js` และ `src/utils/tenantDbIsolation.js` สะท้อนว่าระบบคิดเรื่อง tenant isolation จริง ไม่ได้ hardcode single-tenant แบบแฝง

ข้อสรุป:

- ฐานข้อมูลไม่ใช่แค่รองรับ feature เล็ก ๆ แต่รองรับการเป็น control plane จริง
- schema breadth อยู่ในระดับแข็งกว่าค่าเฉลี่ยของ prototype ทั่วไปมาก

### 2.2 Runtime contracts และ role/scope separation

แนวคิด separation ระหว่าง Delivery Agent และ Server Bot ถูก encode ไว้จริงใน backend contracts

หลักฐาน:

- `src/contracts/agent/agentContracts.js:53-61` normalize runtime kind เป็น `server-bots` และ `delivery-agents`
- `src/contracts/agent/agentContracts.js:77-91` บังคับความสัมพันธ์ role/scope:
  - `server-bots -> sync / sync_only`
  - `delivery-agents -> execute / execute_only`
- `src/contracts/agent/agentContracts.js:83-87` คืน error `agent-runtime-role-scope-mismatch` ถ้า role/scope ไม่ตรง

ข้อสรุป:

- separation ในระดับ domain contract ถือว่าแข็ง
- ปัญหาอยู่ที่ runtime naming / bootstrap convergence มากกว่าการออกแบบ backend contract

### 2.3 Server Bot subsystem

นี่คือ subsystem ที่ดู mature และน่าใช้จริงที่สุดใน repo ตอนนี้

หลักฐาน:

- `src/services/scumServerBotRuntime.js:343-364` รองรับ `probe_restart`, `server_start`, `server_stop`, `rollback`
- `src/services/scumServerBotRuntime.js:389-401` ทำ config write แล้ว verify ผลลัพธ์
- `src/services/scumServerBotRuntime.js:44-52` มี helper สำหรับ atomic copy / write pattern
- `test/platform-server-bot-provisioning.integration.test.js` แสดงว่ามี provisioning/integration coverage จริง

ข้อสรุป:

- server-side operational runtime มี substance จริง
- ใกล้ production กว่าส่วน player/domain อื่นอย่างชัดเจน

### 2.4 Config system

ระบบ config management เป็นอีกส่วนที่ออกแบบจริงจังและมีองค์ประกอบครบ

หลักฐาน:

- `src/services/platformServerConfigService.js:99-103` นิยาม apply mode ชัดเจน `save_only`, `save_apply`, `save_restart`
- `src/services/platformServerConfigService.js:271` รองรับ `requiresRestart`
- `src/services/platformServerConfigService.js:322-361` สร้าง discovered settings จาก live snapshot data
- `src/services/platformServerConfigService.js:661-753` build workspace จาก snapshot, category definition, discovered keys
- `src/services/platformServerConfigService.js:1151-1173` และ `1239-1270` ผูก config apply/rollback เข้ากับ restart governance
- `src/services/platformServerConfigService.js:1511-1586` เก็บ snapshot/backup artifacts หลัง job สำเร็จ
- `test/platform-server-config-service.integration.test.js` ยืนยันว่ามี integration coverage

ข้อสรุป:

- นี่คือ subsystem ที่พร้อมสุดชุดหนึ่งในระบบ
- ถ้าถามว่าอะไร “เกือบ production-ready” จริงใน repo นี้ คำตอบอยู่ใน config/restart/server-bot path

### 2.5 Restart orchestration

restart orchestration ไม่ได้เป็นแค่ปุ่มยิง restart ตรง ๆ แต่มี orchestration model ที่คิดครบพอสมควร

หลักฐาน:

- `src/services/platformRestartOrchestrationService.js:71-73` ใช้ plan/announcement/execution delegates
- `src/services/platformRestartOrchestrationService.js:127-155` normalize plan row พร้อม health fields
- `src/services/platformRestartOrchestrationService.js:160-201` normalize announcement/execution rows
- `src/services/platformRestartOrchestrationService.js:363-393` derive health status
- `src/services/platformRestartOrchestrationService.js:397-433` evaluate restart safety และ block เมื่อ runtime ที่ต้องใช้ไม่พร้อม
- `src/services/platformRestartOrchestrationService.js:1124-1291` list history/executions ภายใต้ tenant scope
- `test/platform-restart-orchestration-service.test.js` มี coverage จริง

ข้อสรุป:

- restart flow มี maturity สูงกว่างาน admin tooling ทั่วไป
- มีรากฐานเพียงพอจะพัฒนาเป็น managed-service operations feature จริง

### 2.6 Public auth / signup / billing foundation

public platform flow ไม่ใช่ mockup

หลักฐาน:

- `apps/web-portal-standalone/api/publicPlatformRoutes.js:183-229` สมัครสมาชิก
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:232-263` login
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:277-320` password reset
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:323-360` email verification
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:369-415` create checkout session
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:418-437` resolve checkout session
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:439-462` finalize checkout
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:465-496` webhook
- `src/services/platformBillingLifecycleService.js:257-266` ตรวจ Stripe webhook signature

ข้อสรุป:

- signup/billing foundation มีของจริง
- แต่ยังไม่ใช่หลักฐานว่าพร้อมขายแบบ provider-grade

### 2.7 Identity foundation

identity linking เป็นหนึ่งในส่วนที่ออกแบบลึกพอสมควร

หลักฐาน:

- `src/services/platformIdentityService.js:196-205` normalize linked identity profile
- `src/services/platformIdentityService.js:471-730` สร้าง linked account summary
- `src/services/platformIdentityService.js:498-536` สรุปสถานะ email/discord/steam/in-game
- `src/services/platformIdentityService.js:556-615` ตรวจ conflict เช่น `discord-mismatch`, `steam-mismatch`
- `src/services/platformIdentityService.js:617-679` สร้าง attention items
- `src/services/platformIdentityService.js:1379-1474` ออก token แบบ hash-based
- `apps/web-portal-standalone/auth/portalAuthRuntime.js:577-723` มี Discord OAuth flow จริง
- `apps/web-portal-standalone/auth/portalAuthRuntime.js:733-859` มี Google OAuth flow จริง

ข้อสรุป:

- identity model ไม่อ่อน
- ช่องว่างหลักคือ product flow cohesion และการพิสูจน์ end-to-end มากกว่า absence ของ data model

## 3. What is Partial / Unfinished

### 3.1 Runtime boundary ยังไม่ clean เต็มที่

นี่คือจุดสำคัญมาก เพราะมันกระทบทั้ง architecture clarity, operator mental model และ product packaging

หลักฐาน:

- `src/delivery-agent.js:4` comment ยังบอกว่าต้อง preserve existing `console-agent` bootstrap
- `src/delivery-agent.js:5` ยัง `require('./scum-console-agent')`
- `docs/RUNTIME_BOUNDARY_EXPLAINER.md:20` ยังอธิบาย execution bridge ด้วยชื่อ `console-agent`
- `src/services/scumConsoleAgent.js:279` ถึงแม้จะตั้ง display name เป็น `Delivery Agent` แล้ว แต่ implementation backbone ยังเป็น console-agent lineage

ผลกระทบ:

- สำหรับ operator หรือทีม support ภายนอก boundary ยังไม่สะอาดพอ
- สำหรับ packaging/deployment/update docs จะยังมี friction สูง
- สำหรับ codebase ระยะยาวจะเกิด legacy drift ระหว่าง naming เชิง product กับ naming เชิง implementation

ข้อสรุป:

- แนวคิด separation ถูกต้อง
- implementation boundary ยังต้องเก็บอีกมากก่อนใช้เป็น managed service ที่ทีมอื่นรับช่วงได้ง่าย

### 3.2 Web surface convergence ยังเป็น transitional architecture

Owner/Tenant/Admin มีของจริง แต่ production path ยังไม่สะอาด

หลักฐาน:

- `apps/owner-web/server.js` และ `apps/tenant-web/server.js` เป็น wrapper บาง ๆ
- `apps/admin-web/server.js` เป็นตัว start server
- `src/admin/runtime/adminPageRuntime.js:65` ชี้ไป `apps/owner-ui-prototype/dist`
- `src/admin/runtime/adminPageRuntime.js:523` resolve asset path จาก prototype dist
- `src/admin/runtime/adminPageRuntime.js:648` อ่าน `index.html` จาก prototype dist
- `src/admin/runtime/adminPageRuntime.js:349-361` inject owner runtime scripts หลายตัวผ่าน stitch layer
- `apps/owner-ui-prototype/README.md:3-5` ระบุชัดว่าเป็น isolated React prototype และไม่ได้แทน production Owner Panel

ผลกระทบ:

- surface breadth มีจริง แต่การรวมระบบยังไม่เด็ด
- เพิ่มต้นทุนในการ debug, release, ownership, และ UX consistency

ข้อสรุป:

- นี่ไม่ใช่ missing UI
- แต่มันยังไม่ใช่ clean product architecture

### 3.3 Identity linking ยังไม่จบเป็น productized journey

แม้ data model จะแข็ง แต่ flow ยังไม่คมพอจะบอกว่าจบ

หลักฐาน:

- `apps/web-portal-standalone/auth/portalAuthRuntime.js:785` Google account ต้องเป็น verified email
- `apps/web-portal-standalone/auth/portalAuthRuntime.js:828` require linked player identity
- `apps/web-portal-standalone/auth/portalAuthRuntime.js:838` require Google account to map into a Discord-linked player identity

ผลกระทบ:

- auth paths ยังไม่เท่ากัน
- Google ดูเป็น secondary augmentation มากกว่า primary first-class login
- ถ้าเกิด conflict หรือ dispute case ระหว่าง Discord/Steam/in-game ยังไม่เห็น end-to-end support flow ที่สมบูรณ์

ข้อสรุป:

- identity foundation ดี
- identity product journey ยัง partial

### 3.4 Player-facing systems หลายส่วนยังไม่ลึกเท่ากัน

มี route/service จริงหลายตัว แต่ maturity ไม่เท่ากัน

หลักฐาน:

- `src/services/tenantDonationOverviewService.js:50-83` เน้น readiness/overview/checklist
- `src/services/tenantDonationOverviewService.js:155-328` aggregate purchases/supporters/revenue ได้ แต่ยังไม่พิสูจน์ donation product lifecycle ครบ
- `src/services/tenantModuleOverviewService.js:14-92` และ `225-329` สะท้อน module readiness layer มากกว่าระบบ module lifecycle เต็มตัว
- `src/services/raidService.js:9-18` import compatibility services
- `src/services/raidService.js:186-226` ยังมี compatibility bootstrap path
- `src/store/statsStore.js:12-16` ใช้ in-memory `Map`
- `src/services/killFeedService.js:65-77` ยอมทำงานต่อแม้ไม่มี killfeed tables

ผลกระทบ:

- feature list ดูกว้าง แต่ depth ยังไม่เสมอกัน
- บางระบบพร้อมสำหรับ internal/live pilot มากกว่าพร้อมสำหรับ product commitment

ข้อสรุป:

- โดเมนเหล่านี้ไม่ใช่ missing
- แต่ยังอยู่ระดับ partial ถึง transitional

### 3.5 Security / ops hardening ยังไม่ถึงระดับ launch-grade

หลักฐานว่ามีพื้นฐานดี:

- `prisma/schema.prisma:754-785` ใช้ token hashing
- `src/services/platformAgentPresenceService.js:113-125` migrate legacy plaintext presence state ไป encrypted-at-rest ถ้ามี secret
- `src/services/platformAgentPresenceService.js:231-258` เก็บ raw key แบบเข้ารหัสเมื่อ config พร้อม
- `src/adminWebServer.js:467-474`, `495-500`, `664-678`, `1026-1044` มี session hardening, user-agent binding, 2FA, step-up support

หลักฐานว่าช่องว่างยังมี:

- `prisma/schema.prisma:594-600` `PlatformWebhookEndpoint.secretValue` ยังเป็น plaintext field
- `apps/web-portal-standalone/api/publicPlatformRoutes.js:66-107` rate limiting ยังเป็น in-memory/process-local
- `apps/web-portal-standalone/auth/portalAuthRuntime.js:12-18` ยังมี dev fallback สำหรับ session secret ถ้า env ไม่ถูกตั้ง
- `docs/PRODUCT_READY_GAP_MATRIX.md:47-53` ยัง mark security hardening / observability / commercial readiness เป็น partial

ข้อสรุป:

- security foundation มีจริง
- แต่ยังไม่ควรเรียกว่า production hardening เสร็จแล้ว

## 4. What is Missing

### 4.1 Packaging / field deployment story ที่แยกสอง runtime แบบสมบูรณ์

ยังไม่เห็น packaging story ที่ครบถ้วนสำหรับ:

- Delivery Agent installer/update/recovery
- Server Bot installer/update/recovery
- versioned rollout / rollback แบบภาคสนาม

### 4.2 Provider-grade commercial operations

แม้ checkout/webhook จะมี แต่ยังไม่เห็นระบบที่ชัดพอสำหรับ:

- dunning / failed payment recovery
- refund / dispute handling
- revenue support operations
- support-led subscription corrections

### 4.3 Mature service observability

มี monitoring/automation foundation แต่ยังไม่เห็นระดับ operations suite เต็มตัว เช่น:

- centralized runtime dashboards ที่ mature
- alert routing ที่พร้อม incident handling จริง
- support bundle / trace bundle ที่ operator ใช้ทุกวัน
- fleet-wide diagnostics ที่ครบระดับบริการเชิงพาณิชย์

### 4.4 Module ecosystem lifecycle

ยังไม่เห็น version-governed module ecosystem แบบเต็มรูป:

- version compatibility contracts
- staged rollout
- rollback semantics
- module dependency governance แบบ productized

## 5. Detailed Readiness Checklist

### 5.1 Repository architecture

- Score: `3/5`
- Status: `partial`
- Evidence:
  - `apps/owner-web/server.js`
  - `apps/tenant-web/server.js`
  - `apps/admin-web/server.js`
  - `src/admin/runtime/adminPageRuntime.js:65`
  - `src/admin/runtime/adminPageRuntime.js:648`
  - `apps/owner-ui-prototype/README.md:3`
- Main gaps:
  - owner surface ยังผูกกับ prototype dist
  - runtime topology จริงยังถูกเสิร์ฟผ่าน transitional stitch path
  - architecture ownership ยังไม่ clean ตาม product surfaces
- Risk level: `High`

### 5.2 Backend / control plane

- Score: `3/5`
- Status: `partial`
- Evidence:
  - `src/services/platformBillingLifecycleService.js`
  - `src/services/platformIdentityService.js`
  - `src/services/platformMonitoringService.js`
  - `src/services/platformAutomationService.js`
  - `src/services/platformRestartOrchestrationService.js`
  - `src/services/platformServerConfigService.js`
- Main gaps:
  - capability breadth สูง แต่ maturity ไม่เท่ากัน
  - บาง services เป็น orchestration/readiness layer มากกว่าผลิตภัณฑ์สมบูรณ์
- Risk level: `High`

### 5.3 Database / persistence

- Score: `4/5`
- Status: `implemented`
- Evidence:
  - `prisma/schema.prisma`
  - `src/utils/tenantDatabaseTopology.js`
  - `src/utils/tenantDbIsolation.js`
- Main gaps:
  - plaintext secret field ยังมี
  - บาง gameplay-related domains ยังมี in-memory/compatibility persistence path
- Risk level: `Medium`

### 5.4 Owner Panel readiness

- Score: `2/5`
- Status: `partial`
- Evidence:
  - `src/admin/runtime/adminPageRuntime.js:349-361`
  - `src/admin/runtime/adminPageRuntime.js:648`
  - `apps/owner-ui-prototype/README.md:3-5`
- Main gaps:
  - ยังพึ่ง prototype assets
  - support/revenue/security workflows ยังไม่เห็น maturity เท่ากับ backend core
  - production UX ownership ยังไม่เด็ด
- Risk level: `High`

### 5.5 Tenant Admin Panel readiness

- Score: `3/5`
- Status: `partial`
- Evidence:
  - admin runtime + tenant/server/delivery related services ใน `src/services`
  - docs/specs ฝั่ง tenant มี breadth สูง
- Main gaps:
  - diagnostics/live support depth ยังไม่พอ
  - บาง flows ดูพร้อมใช้งานแต่ยังไม่พิสูจน์ end-to-end จริง
- Risk level: `Medium`

### 5.6 Player Portal readiness

- Score: `3/5`
- Status: `partial`
- Evidence:
  - `apps/web-portal-standalone/api/publicPlatformRoutes.js`
  - `apps/web-portal-standalone/auth/portalAuthRuntime.js`
  - player-related routes/services/tests ใน repo
- Main gaps:
  - wallet/shop/orders/delivery/stats/donations/events depth ยังไม่เสมอกัน
  - account/profile/identity journey ยังไม่ cohesive พอ
- Risk level: `Medium`

### 5.7 Identity linking readiness

- Score: `3/5`
- Status: `partial`
- Evidence:
  - `src/services/platformIdentityService.js:471-730`
  - `apps/web-portal-standalone/auth/portalAuthRuntime.js:577-859`
- Main gaps:
  - Google login ยังไม่เป็น first-class standalone path
  - Steam/in-game verification dispute flow ยังไม่ชัด
  - productized account recovery / operator resolution ยังไม่ครบ
- Risk level: `High`

### 5.8 Delivery Agent readiness

- Score: `2/5`
- Status: `partial`
- Evidence:
  - `src/delivery-agent.js:5`
  - `src/services/scumConsoleAgent.js:52-156`
  - `src/services/scumConsoleAgent.js:273-279`
- Main gaps:
  - legacy bootstrap alias
  - operational fragility จากการพึ่ง Windows session / SCUM client / focus state
  - packaging/update/install story ยังไม่พอ
- Risk level: `High`

### 5.9 Server Bot readiness

- Score: `4/5`
- Status: `implemented`
- Evidence:
  - `src/services/scumServerBotRuntime.js:343-401`
  - `test/platform-server-bot-provisioning.integration.test.js`
- Main gaps:
  - live environment proof และ diagnostics polish ยังต้องเพิ่ม
- Risk level: `Medium`

### 5.10 Config system readiness

- Score: `4/5`
- Status: `implemented`
- Evidence:
  - `src/services/platformServerConfigService.js:99-103`
  - `src/services/platformServerConfigService.js:271`
  - `src/services/platformServerConfigService.js:661-753`
  - `src/services/platformServerConfigService.js:1511-1586`
- Main gaps:
  - schema coverage ทุก setting category ยังต้องเก็บ
  - UX consistency ระหว่าง surfaces ยังต้องเก็บ
- Risk level: `Medium`

### 5.11 Restart orchestration readiness

- Score: `4/5`
- Status: `implemented`
- Evidence:
  - `src/services/platformRestartOrchestrationService.js:397-433`
  - `src/services/platformRestartOrchestrationService.js:1124-1291`
  - `test/platform-restart-orchestration-service.test.js`
- Main gaps:
  - health verification หลัง restart ยังต้องเก็บ evidence path เพิ่ม
  - operator-safe UX ยังพัฒนาได้อีก
- Risk level: `Medium`

### 5.12 Package / feature gating readiness

- Score: `4/5`
- Status: `implemented`
- Evidence:
  - `src/domain/billing/productEntitlementService.js`
  - package/preview/billing/public routes ที่เชื่อม entitlement จริง
- Main gaps:
  - locked-state UX และ dynamic nav consistency ยังไม่ครบทุก surface
- Risk level: `Medium`

### 5.13 Internationalization readiness

- Score: `2/5`
- Status: `partial`
- Evidence:
  - `src/admin/assets/admin-i18n.js`
  - `apps/web-portal-standalone/public/assets/portal-i18n.js`
- Main gaps:
  - hardcoded copy ยังน่าจะกระจายอยู่
  - encoding hygiene ยังไม่มั่นใจเต็มที่
  - Discord/notification/message localization ยังไม่เห็นครบ
- Risk level: `Medium`

### 5.14 Productization / commercial readiness

- Score: `2/5`
- Status: `partial`
- Evidence:
  - `apps/web-portal-standalone/api/publicPlatformRoutes.js`
  - `src/services/platformBillingLifecycleService.js`
  - `README.md:132-157`
- Main gaps:
  - onboarding ยังไม่พิสูจน์ end-to-end ถึง first success
  - failed payment / refund / dispute / support flows ยังไม่ชัด
  - ยังไม่มีหลักฐานว่าพร้อมเปิด self-serve เชิงพาณิชย์
- Risk level: `High`

### 5.15 Security / operations readiness

- Score: `3/5`
- Status: `partial`
- Evidence:
  - `prisma/schema.prisma:754-785`
  - `prisma/schema.prisma:594-600`
  - `src/services/platformAgentPresenceService.js:113-125`
  - `apps/web-portal-standalone/api/publicPlatformRoutes.js:66-107`
  - `src/services/platformMonitoringService.js:227-458`
- Main gaps:
  - plaintext secret ยังมี
  - distributed rate limit / abuse controls ยังไม่พอ
  - monitoring foundation มี แต่ยังไม่ใช่ mature service operations stack
- Risk level: `High`

## 6. Critical Gaps Before Real Service Launch

### 6.1 Runtime naming / boundary cleanup

ต้องแยก `Delivery Agent` ออกจาก `console-agent` ให้สะอาดทั้ง:

- entrypoint
- docs
- packaging
- provisioning
- update path
- diagnostics naming

### 6.2 Surface convergence cleanup

ต้องตัด dependency ของ production runtime ออกจาก `owner-ui-prototype/dist` และทำให้ Owner/Tenant/Player paths เป็น production surfaces ที่ owner ชัดเจน

### 6.3 Security baseline hardening

ต้องปิดช่องโหว่ที่เห็นชัดก่อน:

- secret storage แบบ plaintext
- process-local rate limiting
- environment fallback behavior ที่เหมาะกับ dev มากกว่า production
- broader audit / alert / abuse posture

### 6.4 End-to-end onboarding proof

ต้องพิสูจน์เส้นทางจริงให้ครบ:

- signup
- preview
- package select
- checkout
- tenant activation
- agent/server-bot binding
- first successful config/restart/delivery outcome

### 6.5 Product depth ใน player/live-ops domains

ต้องยกระดับ donations, modules, raids, stats, killfeed, delivery support flows จาก partial/compatibility-heavy ไปสู่ productized systems

### 6.6 Mature support/ops tooling

ต้องมี diagnostics, alerting, fleet health, incident support, recovery tooling ที่ทีม support ใช้ได้จริงทุกวัน

## 7. Recommended Priority Order

### P0

- Clean runtime boundary ระหว่าง Delivery Agent กับ Server Bot ให้จบ
- เลิกผูก production owner/admin path กับ prototype dist
- ปิด security hardening gaps ที่เห็นชัด
- ทำ onboarding/commercial critical path ให้พิสูจน์ได้จริง end-to-end

### P1

- ทำ identity verification journey ให้ cohesive
- ยกระดับ Delivery Agent reliability และ recovery model
- เพิ่ม diagnostics/support tooling ระดับใช้งานจริง
- เก็บ restart/config operator experience ให้ปลอดภัยและตรวจสอบได้มากขึ้น

### P2

- เพิ่มความลึกให้ player portal, donations, modules, raids, stats, killfeed
- เก็บ i18n ให้ครบ English + Thai ทั้งเว็บและข้อความประกอบ
- ขยาย billing ops ไปสู่ failed payment / refund / dispute / support operations

### P3

- polish analytics/automation
- ทำ module ecosystem/versioning story ให้เป็น platform จริง
- เก็บ UX debt และ admin/operator ergonomics ทุก surface

## 8. Final Verdict

- Can this be used now?

  - ใช้ได้ในลักษณะ operator-led managed setup หรือ internal production-like environment ที่ทีมหลักยังช่วยดู runtime, support, provisioning, และ incident handling เอง

- Can this be sold now?

  - ยังไม่ควรขายเป็น serious self-serve SaaS หรือ managed service ที่รับความคาดหวังด้าน SLA, support, และ commercial operations เต็มรูป

- What level is it at today?
  - `Managed-Service Prototype`

## Bottom Line

ถ้าสรุปแบบตรงที่สุด:

- จุดแข็งของโปรเจคนี้คือ backend/control-plane foundation, data model, config/restart/server-bot path, entitlement model, identity foundation, และ public onboarding/billing foundation
- จุดที่ยังทำให้ “ยังไม่ใช่ของพร้อมขาย” คือ runtime boundary, surface convergence, security hardening, player/live-ops product depth, และ service-grade operations readiness
- ดังนั้นคำตัดสินที่แม่นสุดตอนนี้คือ:
  - “มีฐานจริงและลึกกว่าคำว่า prototype ทั่วไป”
  - “แต่ยังไม่ใช่ managed service ที่พร้อมเปิดเชิงพาณิชย์แบบมั่นใจ”
