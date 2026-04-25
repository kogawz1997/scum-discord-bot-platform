# รายงานประเมินความพร้อม Managed Service / SaaS SCUM

วันที่ประเมิน: 2026-04-25  
พื้นที่ตรวจ: `C:\new`  
โหมดงาน: audit ก่อน แล้วตามด้วย remediation เฉพาะจุดที่พิสูจน์ได้ในเครื่องนี้

## 1. Executive Summary

ตอนนี้โปรเจคนี้ไม่ใช่แค่ Discord bot แล้ว แต่เป็น control plane สำหรับ SCUM ที่มีหลาย web surface, runtime agent, schema, service layer, test, doctor และ release gate ค่อนข้างเยอะแล้ว โครงหลักที่ repo พิสูจน์ได้คือมี Owner Panel, Tenant Admin Panel, Player Portal, Delivery Agent, Server Bot, package/feature gating, identity, config job, restart orchestration, audit/security log และ automation บางส่วน

สิ่งที่โปรเจคใกล้จะเป็นที่สุดคือ **Managed-Service Prototype** ที่มีแกนระบบจริง ไม่ใช่แค่หน้า mock แต่ยังไม่ถึงระดับ **Managed-Service Ready** หรือ **Commercial-Ready Service** เพราะ production readiness ผ่านได้เฉพาะตอนเปิด local smoke runtime ให้ครบ ยังไม่มีหลักฐาน live proof ครบทั้ง flow สมัคร, จ่ายเงิน, provision tenant, bind agent, sync log, แก้ config, restart server, ส่งของ, แจ้งเตือน และ support ในสภาพแวดล้อม production จริง

คะแนนรวมปัจจุบัน: **3/5**

Overall maturity rating: **Managed-Service Prototype**

สถานะ validation ล่าสุดหลังรอบทำต่อ:

- `npm run readiness:full -- --json` ผ่าน 6 checks
- `npm run doctor -- --json` ผ่าน 20 checks
- `npm run security:check -- --json` ผ่าน 8 checks
- เปิด PostgreSQL local ที่ `127.0.0.1:55432` แล้ว `npm run smoke:persistence` ผ่าน 33 checks
- `cmd /c npm run db:migrate:deploy:postgresql` ผ่านแล้ว โดยวิ่งผ่าน provider-aware wrapper ไปที่ PostgreSQL platform schema upgrade ไม่ติด `P3005`
- `cmd /c npm run db:migrate:deploy:safe` ผ่านแล้ว หลังแก้ให้ safe wrapper โหลด `.env` และเรียก deploy wrapper เดียวกัน
- เปิด admin web, player portal และ console agent แล้ว `npm run smoke:postdeploy -- --json` ผ่าน
- `npm run readiness:prod -- --json` ผ่านครบ 10 checks เมื่อเปิด service smoke ที่จำเป็นและปิด optional health ports ของ bot/worker/watcher ที่ยังไม่ได้รันในรอบนี้
- `cmd /c npm run readiness:prod -- --json --skip-smoke` ผ่าน 9 checks หลังแก้ migration wrapper โดยรวม lint, policy tests, security, doctor, topology prod และ persistence smoke

สรุปแบบตรงไปตรงมา: ใช้เป็น internal/staging platform ได้ถ้าตั้ง env, DB และ runtime smoke ให้ครบ แต่ยังไม่ควรเปิดขายเป็น SaaS จริงจนกว่าจะปิด billing, onboarding, live SCUM proof, monitoring, full runtime health และ UX acceptance ให้ครบ

## 2. What is Already Strong

- Runtime separation เริ่มแข็งแรงแล้ว มี `apps/agent`, `apps/server-bot`, `src/contracts/agent/agentContracts.js`, `src/domain/agents/agentRegistryService.js` และ test ฝั่ง `platform-agent-api`, `platform-agent-provisioning`, `agent-contracts` ที่บังคับ role/scope แยกระหว่าง sync กับ execute
- Package และ feature gating มีทั้ง catalog, entitlement service, backend enforcement และ frontend locked state ผ่าน `src/domain/billing/packageCatalogService.js`, `src/domain/billing/productEntitlementService.js`, `src/admin/api/tenantRouteEntitlements.js`, `apps/web-portal-standalone/api/playerRouteEntitlements.js`, `src/admin/assets/tenant-v4-app.js`
- Database schema ครอบคลุม business domain กว้างมาก เช่น tenants, subscriptions, licenses, API keys, agents, identities, billing, config jobs, restart plans, notifications, audit/security logs, raids, purchases, wallet และ player profiles ใน `prisma/schema.prisma`
- Tenant Admin Panel เป็น surface ที่ครบที่สุดใน repo มี dashboard, onboarding, server status, config, restart, delivery agents, server bots, logs sync, orders, donations, events, modules, players, staff, roles, billing และ settings ใน `src/admin/assets/tenant-v4-app.js`
- Config system และ restart orchestration มี service layer จริง ไม่ใช่หน้าเปล่า ผ่าน `src/services/platformServerConfigService.js`, `src/services/serverBotConfigSchemaService.js`, `src/services/scumServerBotRuntime.js`, `src/services/platformRestartOrchestrationService.js`
- Player Portal มี API และหน้าใช้งานครบหลายส่วน เช่น signup, login, checkout, shop, cart, wallet, orders, stats, leaderboard, killfeed, raid request, support ticket, Steam link ผ่าน `apps/web-portal-standalone`
- Verification baseline ดี มี `doctor`, `doctor:topology`, `doctor:web-standalone`, `security:check`, `readiness:full`, `test:policy`, `smoke:persistence`, `preflight:prod` และ test จำนวนมากใน `test/`

## 3. What is Partial / Unfinished

- Production persistence และ PostgreSQL deploy path ผ่านแล้วในเครื่องนี้หลังเปิด PostgreSQL local โดย `db:migrate:deploy:postgresql` ไม่ติด `P3005` แล้ว แต่ยังเป็น proof ระดับ local production profile ไม่ใช่ proof ของ production/staging infra จริง
- Billing มี service lifecycle, invoice, payment attempt, Stripe optional และ checkout API แล้ว แต่ยังต้องพิสูจน์ webhook จริง, renewal, dunning, failed payment, refund, tax invoice และ subscription cut-off ใน production
- Self-service signup และ preview มีโครงจริง แต่ยังดูเป็น preview/onboarding foundation มากกว่า full SaaS onboarding ที่สร้าง tenant, subscription, runtime instruction, owner account และ first server flow จบในมือผู้ใช้
- UI มีหลายหน้าและฟีเจอร์เยอะ แต่ยังไม่มีหลักฐาน browser acceptance ล่าสุดในรายงานนี้ และ Owner asset บางจุดมี fallback text ที่ดูเป็น mojibake เมื่ออ่านจากไฟล์ เช่น `src/admin/assets/owner-v4-app.js`
- Multi-tenant isolation มี service/test/topology support แล้ว แต่ยังต้องมี production proof ของ tenant DB/RLS/cutover, backup/restore และ data boundary ใน DB จริง
- Discord/Web/Steam/In-game identity มี model และ service แต่ verification flow แบบจบจริงสำหรับ Steam และ in-game matching ยังไม่แน่นเท่า email/preview identity
- Delivery Agent และ Server Bot มี provisioning/activation/token/device/session แต่ยังต้องพิสูจน์ long-running reconnect, upgrade, offline recovery และ live SCUM machine proof
- Notifications, analytics และ automation มี model/service/API แต่ยังไม่ครบเป็น operational alerting product เช่น external alert channel, SLA, escalation และ owner support workflow

## 4. What is Missing

- หลักฐาน production run ที่ครบจริงตั้งแต่สมัครจนใช้งาน SCUM: signup -> checkout -> tenant created -> package active -> agent provision -> server bot sync -> config edit -> restart -> delivery -> notification -> audit
- CI/CD หรือ production infra proof ที่ยืนยัน PostgreSQL schema/migration/table readiness กับ DB จริง ไม่ใช่แค่ local Postgres smoke
- Browser E2E/visual acceptance สำหรับ Owner, Tenant และ Player surfaces หลังรวม backend จริง
- Commercial billing ที่พร้อมขายเต็มรูปแบบ เช่น failed payment lifecycle, cancellation, renewal reminder, invoice export, tax/VAT, refund, webhook replay, payment dispute
- Full monitoring stack สำหรับ service จริง เช่น metrics, external alerting, uptime monitor, error tracking, queue lag monitor, agent offline alert
- Customer support workflow ระดับขายจริง เช่น ticket SLA, tenant impersonation policy, audit trail ของ support action, incident timeline, customer-facing status page
- In-game identity verification ที่ปิด loop ได้แน่นอน เช่น Steam ID, Discord, web account และ character name mapping ที่ตรวจจาก SCUM logs หรือ server-side signal
- Release/deployment pipeline ที่พิสูจน์ one-click upgrade, rollback, DB migration rollback และ runtime compatibility ใน production จริง

## 5. Detailed Readiness Checklist

| Area                                      | Score | Status         | Evidence from repo                                                                                                                                                                                      | Main gaps                                                                                                                                                               | Risk level |
| ----------------------------------------- | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1. Repository architecture                | 3/5   | partial        | มี `apps/admin-web`, `apps/owner-web`, `apps/tenant-web`, `apps/web-portal-standalone`, `apps/agent`, `apps/server-bot`, `src/domain`, `src/services`, `src/store`, `prisma`, `scripts`, `docs`, `test` | โครงใหญ่ดีแต่ยังมี legacy/admin/prototype ปนกัน, owner/tenant standalone ยัง proxy ไป admin backend, ต้องลดความซ้อนก่อน scale team                                      | Medium     |
| 2. Backend / control plane                | 3/5   | partial        | Routes ใน `src/admin/api/*`, services เช่น `platformService`, `platformBillingLifecycleService`, `platformServerConfigService`, `platformRestartOrchestrationService`, `platformIdentityService`        | มีหลายระบบจริงแต่บาง flow ยังไม่พิสูจน์ end-to-end เช่น signup-to-provision, billing-to-entitlement, agent-to-runtime-action                                            | High       |
| 3. Database / persistence                 | 3/5   | partial        | `prisma/schema.prisma` มี PlatformTenant, Subscription, API key, Agent, Identity, Billing, Config, Restart, Notification, Audit, Raid models                                                            | local production smoke และ PostgreSQL deploy wrapper ผ่านแล้ว แต่ยังต้องพิสูจน์ release-safe migration, rollback, RLS และ tenant DB topology ใน staging/production จริง | High       |
| 4. Owner Panel readiness                  | 3/5   | partial        | `apps/owner-web/server.js`, `src/admin/assets/owner-v4-app.js`, `owner-dashboard-v4.js`, `owner-tenants-v4.js`, `owner-runtime-health-v4.js`                                                            | ฟีเจอร์ owner กว้างแต่ยังต้อง browser QA, support/billing workflow ยังไม่ขายจริง, fallback text บางส่วนเสี่ยง encoding/UX                                               | Medium     |
| 5. Tenant Admin Panel readiness           | 3/5   | partial        | `src/admin/assets/tenant-v4-app.js` มี dashboard, config, restart, delivery agents, server bots, logs sync, orders, donations, events, modules, players, staff                                          | เป็น surface ที่พร้อมสุด แต่ยังต้อง live SCUM proof, permission QA, browser E2E และ failure-state UX                                                                    | Medium     |
| 6. Player Portal readiness                | 3/5   | partial        | `apps/web-portal-standalone/public/*.html`, `playerGeneralRoutes.js`, `playerCommerceRoutes.js`, `publicPlatformRoutes.js`                                                                              | มี wallet/shop/orders/stats/raid/support/Steam link แต่ต้องพิสูจน์ checkoutเงินจริง, delivery status จริง, account linking จริง                                         | Medium     |
| 7. Identity linking readiness             | 3/5   | partial        | `PlatformUser`, `PlatformUserIdentity`, `PlatformPlayerProfile`, `PlatformVerificationToken`, `platformIdentityService`, `portalAuthRuntime`, preview auth                                              | Email/preview/Discord/Google มีฐาน แต่ Steam/in-game verification ยังไม่ใช่ flow production-grade ที่ปิด loop ได้ครบ                                                    | High       |
| 8. Delivery Agent readiness               | 3/5   | partial        | `apps/agent/server.js`, `src/delivery-agent.js`, `src/services/scumConsoleAgent.js`, `agentRegistryService`, `agentContracts`                                                                           | แยก execute scope ดี แต่ต้องพิสูจน์ live game client, reconnect, queue drain, offline handling, version upgrade และ announce จริง                                       | High       |
| 9. Server Bot readiness                   | 3/5   | partial        | `apps/server-bot/server.js`, `scumServerBotRuntime.js`, `scumLogWatcherRuntime.js`, `serverBotConfigSchemaService.js`, `serverBotIniService.js`                                                         | มี log/config/restart foundation แต่ต้องพิสูจน์ live SCUM server, file permission, backup restore, start/stop/restart และ diagnostics จริง                              | High       |
| 10. Config system readiness               | 3/5   | partial        | `platformServerConfigService.js`, `serverBotConfigSchemaService.js`, `PlatformServerConfigSnapshot`, `PlatformServerConfigJob`, `PlatformServerConfigBackup`                                            | schema-driven ดี แต่ต้องพิสูจน์ temp write, rollback, verification, restart-required UX และ concurrent edit conflict ในเครื่องจริง                                      | High       |
| 11. Restart orchestration readiness       | 3/5   | partial        | `platformRestartOrchestrationService.js`, `restartScheduler.js`, `PlatformRestartPlan`, `PlatformRestartAnnouncement`, `PlatformRestartExecution`                                                       | มี schedule/history/health concept แต่ต้องพิสูจน์ countdown announce, safe restart, post-restart health และ failure recovery กับ server จริง                            | High       |
| 12. Package / feature gating readiness    | 4/5   | mostly working | `packageCatalogService`, `productEntitlementService`, backend route checks, Tenant locked states, Player feature denied routes                                                                          | โครงค่อนข้างแข็ง แต่ต้อง audit ว่าทุก mutation สำคัญถูกครอบจริง และเชื่อม billing lifecycle production จริง                                                             | Medium     |
| 13. Internationalization readiness        | 2/5   | partial        | `src/admin/assets/admin-i18n.js`, locale files `en/th/es/ja/ko/zh-CN`, Tenant Thai text, Player public pages                                                                                            | ยังมี hardcoded text เยอะ, Discord message translation ยังไม่ชัด, Owner fallback text บางจุดเสี่ยง mojibake, locale coverage ไม่สม่ำเสมอ                                | Medium     |
| 14. Productization / commercial readiness | 2/5   | partial        | public signup/login/checkout/trial/preview pages, `publicPreviewService`, `platformCommercialService`, billing lifecycle service                                                                        | production smoke ผ่านได้เมื่อเปิด runtime ที่จำเป็น แต่ billing/tenant onboarding/support/SLA/legal/live SCUM proof ยังต้องปิด                                          | High       |
| 15. Security / operations readiness       | 3/5   | partial        | `security:check` ผ่าน, API key hashing, setup token hash/prefix, device binding, admin security event, request log, secret scan, doctor gates                                                           | ยังต้องมี production monitoring, rate limit proof, external alerts, key rotation drill, tenant isolation proof และ incident runbook ที่ทดสอบจริง                        | High       |

รายละเอียดแยกตาม requirement สำคัญ:

| Requirement                              | สถานะปัจจุบัน  | หมายเหตุ                                                                                   |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Three web surfaces                       | partial        | Owner/Tenant/Player มี entrypoint และ assets จริง แต่ยังต้อง browser acceptance            |
| Delivery Agent vs Server Bot separation  | mostly working | contracts บังคับ `execute_only` กับ `sync_only` ชัดขึ้น                                    |
| Multi-tenant                             | partial        | model/service/test มี แต่ production DB topology ยังต้องพิสูจน์                            |
| Feature/package gating                   | mostly working | backend และ frontend มี enforcement หลายจุด                                                |
| Preview mode before purchase             | partial        | preview account/service/page มี แต่ยังต้องจบเป็น conversion flow                           |
| Self-service signup                      | partial        | signup/login/checkout API มี แต่ยังไม่ครบ SaaS onboarding production                       |
| Linked identities                        | partial        | model/service มี email/Discord/Google/Steam foundation แต่ in-game verification ยังต้องปิด |
| Config editor                            | partial        | schema/job/backup/service มี แต่ต้อง live proof กับไฟล์จริง                                |
| Restart orchestration                    | partial        | plan/announcement/execution มี แต่ต้อง live server proof                                   |
| Donation system                          | partial        | routes/service/UI มี แต่ payment/accounting จริงยังต้องตรวจ                                |
| Event system                             | partial        | `eventService`, store, tenant events UI มี แต่ automation/reward/live ops ต้องพิสูจน์      |
| Bot modules system                       | partial        | tenant modules overview/UI มี แต่ plugin/module lifecycle ยังไม่ชัดเท่า product จริง       |
| Player stats/leaderboard/killfeed        | partial        | API/service/store มี แต่ขึ้นกับ sync/log ingestion จริง                                    |
| Raid request/window/summary              | partial        | model/service/API มี แต่ product flow/permission/notification ยังต้องพิสูจน์               |
| Multi-language EN+TH                     | partial        | มี key/locale แต่ hardcoded/fallback ยังเยอะ                                               |
| Notifications/audit/analytics/automation | partial        | model/service/API มี แต่ external operation loop ยังไม่ครบ                                 |

## 6. Critical Gaps Before Real Service Launch

- ต้องย้าย proof จาก local Postgres smoke ไปเป็น production/staging infra จริง และทดสอบ `db:migrate:deploy:postgresql`/`db:migrate:deploy:safe` กับฐานข้อมูล staging ที่มี schema/data เหมือน production
- ต้องมี E2E proof หนึ่งเส้นทางเต็ม: customer signup, checkout, tenant created, package active, owner/tenant login, runtime provision, agent activated, sync/run job, config edit, restart, delivery, audit log
- ต้องทดสอบ Delivery Agent บนเครื่องที่เปิด SCUM client จริง และ Server Bot บนเครื่อง server-side จริง พร้อม reconnect/offline/retry/upgrade
- ต้องล็อก tenant isolation ให้พิสูจน์ได้ทั้ง shared DB, tenant schema หรือ tenant DB mode รวมถึง backup/restore และ cross-tenant mutation guard
- ต้องทำ billing production ให้ชัด: Stripe webhook verification, retry, failed payment, cancellation, renewal, invoice, refund และ entitlement lock/unlock
- ต้องทำ browser QA สำหรับ Owner, Tenant และ Player surfaces โดยเฉพาะ locked state, loading/error state, mobile layout, language switch และหน้า checkout/signup
- ต้องจัดการ i18n/hardcoded text และตรวจ encoding ใน owner assets ก่อนเปิดให้ลูกค้าเห็น
- ต้องเพิ่ม monitoring/alerting จริง เช่น agent offline, job stuck, DB error, delivery failure, restart failure, webhook failure, billing failure
- ต้องมี runbook สำหรับ support/incident/rollback ที่ถูกทดสอบจริง ไม่ใช่แค่เอกสาร

## 7. Recommended Priority Order

P0 (must fix first)

- ทำ migration/release drill บน staging ให้พิสูจน์ว่า provider-aware deploy wrapper ใช้ซ้ำได้ ไม่ติด `P3005` และ rollback plan ใช้งานได้เมื่อ schema/data มีอยู่แล้ว
- ทำให้ `npm run readiness:prod -- --json` ผ่านใน staging/production โดยเปิด runtime health จริง ไม่ต้อง override optional ports
- ทำ live E2E proof เส้นทาง tenant จริงหนึ่งราย ตั้งแต่ signup/checkout ถึง agent activation และ server action
- ยืนยัน runtime boundary ด้วย token จริงว่า Delivery Agent ใช้ execute-only และ Server Bot ใช้ sync-only/config-only ตาม design
- ทำ browser acceptance สำหรับ Owner/Tenant/Player อย่างน้อย happy path และ locked path

P1

- ปิด billing lifecycle production: Stripe checkout, webhook, renewal, failed payment, cancellation, invoice และ entitlement update
- ปิด tenant onboarding flow: สร้าง tenant, owner account, server, package, runtime instructions และ first-login checklist
- เพิ่ม monitoring/alerting ที่ operator ใช้จริง พร้อม threshold และ notification channel
- ทำ SCUM live proof สำหรับ config edit, backup, rollback, restart, log sync และ delivery announce
- ตรวจและแก้ i18n/encoding/hardcoded text ที่กระทบลูกค้า โดยเฉพาะ Owner surface

P2

- เพิ่ม browser E2E และ visual regression สำหรับ 3 web surfaces
- ทำ staff/permission matrix ให้ละเอียดขึ้นสำหรับ tenant support, owner support และ sensitive actions
- เพิ่ม audit trail ให้ครบทุก mutation สำคัญ เช่น package change, billing change, config apply, restart, agent revoke, support action
- ปรับ UX ให้ลดความแน่นของ Tenant/Owner console โดยเพิ่ม empty state, recovery action และ guided onboarding
- ทำ identity verification สำหรับ Steam/in-game ให้มี proof จาก log หรือ server-side source

P3

- ทำ marketplace/modules lifecycle ให้เป็น product จริง เช่น install, enable, disable, upgrade, uninstall และ module billing
- เพิ่ม customer-facing status page และ incident communication
- เพิ่ม advanced analytics เช่น revenue cohort, tenant health score, delivery success rate, churn risk
- ทำ migration/rollback drill เป็น release routine
- เตรียม commercial docs เช่น SLA, terms, privacy, refund policy, support policy ให้ผูกกับ product flow

## 8. Final Verdict

Can this be used now?

ใช้ได้ในระดับ internal, demo, staging หรือ managed-service prototype ถ้าทีมตั้ง env และฐานข้อมูลให้ถูก และถ้าทีม operator ยังช่วยดูหลังบ้านเองได้ โปรเจคมีระบบจริงเยอะพอจะทดลองกับลูกค้ากลุ่มเล็กแบบ controlled pilot ได้ แต่ต้องยอมรับว่ายังต้องมีคนเทคนิคเฝ้าดู

Can this be sold now?

ยังไม่ควรขายเป็น SaaS จริงแบบ self-service เต็มรูปแบบ แม้ production readiness gate จะผ่านได้ใน local smoke setup แล้ว เพราะยังไม่มี live proof ครบทุก flow ที่กระทบเงิน ลูกค้า และ server จริง ถ้าจะขายตอนนี้ควรขายเป็น pilot/managed setup เท่านั้น ไม่ใช่บริการเปิดสมัครจ่ายเงินเองแล้วใช้งานได้ทันที

What level is it at today?

ระดับวันนี้คือ **Managed-Service Prototype** คะแนนรวม **3/5** จุดแข็งคือ architecture, schema, service layer, package gating, runtime boundary, PostgreSQL deploy wrapper และ test gate จุดที่ยังกันไม่ให้เป็น commercial-ready คือ production release proof, billing production, live SCUM proof, browser UX acceptance, monitoring/alerting และ onboarding/support loop แบบขายจริง
