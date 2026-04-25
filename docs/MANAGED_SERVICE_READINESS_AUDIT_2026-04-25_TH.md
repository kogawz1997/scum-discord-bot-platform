## 1. Executive Summary

วันที่ประเมิน: 2026-04-25
ขอบเขต: ตรวจ repo ปัจจุบันใน `C:\new` เทียบกับเป้าหมาย managed service / SaaS-style SCUM platform โดยไม่แก้โค้ดระบบ

สิ่งที่โปรเจคเป็นตอนนี้: โปรเจคนี้ไม่ใช่แค่ Discord bot หรือเว็บ mock แล้ว แต่เป็น managed-service prototype ที่มี control plane, tenant/player APIs, runtime agent separation, schema ฐานข้อมูล, feature entitlement, config/restart orchestration และ UI หลาย surface ในระดับที่เริ่มจับเป็นระบบจริงได้

สิ่งที่โปรเจคใกล้จะเป็น: ใกล้กับ SaaS Foundation มากกว่า internal tool เพราะมี multi-tenant model, package catalog, public signup/checkout code, agent registry, server bot runtime และ player portal แต่ยังไม่ถึงระดับขายจริง เพราะยังขาด proof แบบ end-to-end production, billing lifecycle ที่พิสูจน์กับเงินจริง, i18n ที่สะอาด, UX ที่จบทุก flow, operational runbook, monitoring/alert ที่ใช้รับลูกค้าจริง และหลักฐานว่า tenant isolation ใช้จริงบน production database ครบ

Overall maturity rating: Managed-Service Prototype
คะแนนรวมโดยประมาณ: 3/5

สรุปแบบตรง: ใช้เป็น pilot/internal managed service ได้ถ้ามีทีม operator คุมอยู่ใกล้ ๆ แต่ยังไม่ควรเปิดขายเป็น SaaS หรือ managed service จริงกับลูกค้าทั่วไป จนกว่าจะปิด gap ด้าน database/runtime proof, billing, onboarding, agent installer, config/restart safety, i18n, monitoring และ customer support lifecycle

หลักฐานที่ใช้ประกอบ: ตรวจโครงสร้าง `apps/`, `src/`, `prisma/`, `scripts/`, `deploy/`, `docs/`, `test/`; รัน `npm.cmd run lint:syntax`, `npm.cmd run doctor -- --json`, `npm.cmd run doctor:topology -- --json`, `npm.cmd run doctor:web-standalone -- --json`, `npm.cmd run security:check -- --json`

ข้อสังเกตสำคัญ: คำสั่ง doctor หลักผ่าน แต่มี stderr ว่า `controlPlaneRegistryRepository init failed` จาก Prisma datasource/provider mismatch ลักษณะ `sqlite` ต้องใช้ `DATABASE_URL` ที่ขึ้นต้นด้วย `file:` จุดนี้ต้องถือเป็น risk ก่อน production ถึงแม้ command exit code เป็น 0

## 2. What is Already Strong

- Runtime separation ระหว่าง Delivery Agent กับ Server Bot ทำได้ค่อนข้างดี มี `apps/agent/server.js`, `src/delivery-agent.js`, `src/scum-console-agent.js` สำหรับ role `execute` และมี `apps/server-bot/server.js`, `src/services/scumServerBotRuntime.js` สำหรับ role `sync`
- Contract ของ agent ชัดเจนใน `src/contracts/agent/agentContracts.js` มี role/scope แยก `execute_only` กับ `sync_only` และมี error สำหรับ role/scope mismatch ไม่ใช่แค่ convention ในเอกสาร
- Backend/control plane มี surface เยอะและไม่ใช่ placeholder ล้วน มี route กลุ่ม platform, tenant, public, player, billing, config, restart, delivery, community, raid, audit, notification และ observability อยู่ใน `src/admin/api/` กับ `apps/web-portal-standalone/api/`
- Database schema ครอบคลุม domain ใหญ่หลายชุดใน `prisma/schema.prisma` เช่น tenant, package, subscription, license, API key, webhook, agent runtime/session/device/token, player profile, wallet, shop, purchase, config snapshot/job/backup, restart plan/execution, raid, event, notification, audit/security log
- Feature/package gating มีฐานจริงใน `src/domain/billing/packageCatalogService.js`, `src/domain/billing/productEntitlementService.js`, `src/admin/api/tenantRouteEntitlements.js` และถูกใช้ทั้ง backend/frontend บางส่วน
- Config และ restart มี backend ที่เป็นระบบ ไม่ใช่แค่ปุ่ม UI มี `src/services/platformServerConfigService.js`, `src/services/serverBotConfigSchemaService.js`, `src/services/platformRestartOrchestrationService.js`, `src/services/scumServerBotRuntime.js`
- Tenant Admin Panel มี navigation และ page coverage กว้างใน `src/admin/assets/tenant-v4-app.js` รวม server config, restart, log sync, orders, analytics, players, donations, events, modules, delivery agents, server bots, staff, roles, billing
- Player Portal มี API และ UI coverage เยอะใน `apps/web-portal-standalone/public/assets/player-v4-app.js` และ route ต่าง ๆ รองรับ shop, orders, cart, wallet, stats, leaderboard, killfeed, raids, profile, Steam link, notifications, support
- Security baseline ไม่แย่ มี `src/utils/env.js`, `src/admin/auth/adminAuthRuntime.js`, token hashing ในหลาย model/service, session lifecycle, 2FA/step-up, secure cookie/HSTS/origin checks และ `npm.cmd run security:check -- --json` ผ่าน
- Test coverage เชิงจำนวนสูง มี test หลายร้อยไฟล์ รวม integration/e2e และ test สำหรับ agent contracts, tenant boundary, entitlement, restart orchestration, config service, delivery, player ops, owner prototype

## 3. What is Partial / Unfinished

- Owner Panel มี prototype และ adapter ไป backend หลายจุด แต่ยังต้องพิสูจน์ว่า owner flows หลักทุกอันจบจริง เช่น tenant provisioning, package update, billing issue, support escalation, diagnostics, audit/security action
- Tenant Admin Panel มีหน้าเยอะและเรียก endpoint หลายตัว แต่บางหน้าเป็น operational console แบบกว้าง ยังไม่เห็น proof ว่าทุก action ใช้กับ production-like backend/agent จริงครบตั้งแต่ต้นจนจบ
- Player Portal มีฟีเจอร์เยอะ แต่ยังต้องพิสูจน์ checkout/order/delivery/profile/linked identity แบบ end-to-end กับ tenant package และ agent จริง
- Identity linking มี Discord OAuth, Google OAuth บางส่วน, email flow, Steam bind/unbind และ platform identity model แต่ verification flow ระหว่าง web/Discord/Steam/in-game ยังต้อง hardened และทดสอบเป็น customer journey เดียว
- Billing/subscription มี local billing และ Stripe checkout/webhook code แต่ยังไม่พอจะเรียกว่า commercial-ready จนกว่าจะพิสูจน์เงินจริง, webhook reconciliation, invoice/payment failure, refund/cancel/downgrade, tax/legal และ support process
- Delivery Agent มี runtime, heartbeat, job routing, announce support, token/session model แต่ยังต้องพิสูจน์ installer/update/reconnect/device rotation และ failure recovery บนเครื่องที่เปิด SCUM client จริง
- Server Bot มี runtime สำหรับ sync/config/restart/start/stop/backup/rollback แต่ยังต้องพิสูจน์กับ filesystem/permission/process manager จริง และต้องมี runbook เมื่อ restart/config apply ล้มเหลว
- Config editor มี schema-driven metadata และ backend validation แต่ UI/i18n ยังมี mojibake หลายจุด และยังต้องพิสูจน์ backup/rollback/temp write/verification กับ config file จริงทุกประเภท
- Restart orchestration มี safe restart, delayed restart, announce, history และ verification model แต่ต้องทดสอบกับ real server lifecycle และ edge cases เช่น delivery queue ค้าง, server bot offline, game server start fail
- Internationalization มี locale runtime และไฟล์ EN/TH แล้ว แต่ยังมี hardcoded text, mojibake และ Discord/runtime messages ที่ยังไม่เป็น translation key ทั้งหมด
- Operations มี doctor/security/topology scripts แต่ยังไม่เท่ากับ production operations เพราะยังขาด alert routing, SLO, incident runbook, backup restore drill, customer-facing status และ capacity/load proof

## 4. What is Missing

- หลักฐาน end-to-end production golden path เดียวที่วิ่งครบ: signup -> verify email -> choose package -> checkout -> webhook -> tenant onboarding -> create server -> provision Server Bot -> provision Delivery Agent -> config sync -> player purchase -> delivery -> audit/notification
- Commercial/legal readiness เช่น terms, privacy, refund policy, invoice/tax handling, customer cancellation, chargeback handling, data retention policy, DPA/tenant data export
- Customer support operations ที่ใช้จริง เช่น ticket SLA, incident escalation, owner support workflow, customer diagnostics export, runbook สำหรับ agent/server bot offline
- Installer/updater UX สำหรับ Delivery Agent และ Server Bot ที่ลูกค้าติดตั้งเองได้ พร้อม rotation/revoke/recovery แบบปลอดภัย
- Production monitoring ที่พิสูจน์แล้ว เช่น alerts ไป Discord/Slack/email, uptime checks, queue depth alert, failed delivery alert, failed restart alert, webhook failure alert
- Load/performance proof สำหรับหลาย tenant พร้อมกัน เช่น API rate limits, queue pressure, DB index/capacity, background job throughput, portal traffic
- i18n ที่สะอาดครบทุก surface ไม่มี mojibake และไม่มีข้อความสำคัญ hardcoded ใน JS/Discord/runtime command
- Security review ระดับ commercial เช่น abuse/rate limit ทุก auth/payment/player APIs, privilege escalation test, tenant isolation penetration test, secret rotation runbook

## 5. Detailed Readiness Checklist

| Audit area                                | Score (0-5) | Status  | Evidence from repo                                                                                                                                                                                     | Main gaps                                                                                                                                                                                    | Risk level  |
| ----------------------------------------- | ----------: | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1. Repository architecture                |           3 | partial | มี `apps/admin-web`, `apps/api`, `apps/agent`, `apps/server-bot`, `apps/owner-ui-prototype`, `apps/web-portal-standalone`, `src/domain`, `src/services`, `prisma`, `deploy`, `scripts`, `test`         | โครงสร้างใหญ่และเริ่มแยก role ดี แต่ยังมี legacy/runtime หลายทาง, prototype ปน production, worktree มี generated/db artifacts และ docs หลายชุดที่ยังไม่ชัดว่า source of truth ไหน            | Medium      |
| 2. Backend / control plane                |           3 | partial | `src/admin/api/*`, public platform routes, player routes, platform service, billing lifecycle, config/restart/delivery/raid/community routes                                                           | Endpoint coverage กว้างมาก แต่ยังต้องพิสูจน์ flow จบจริงทุก domain, enforce tenant/feature/role ครบทุก mutation, และลด fallback/legacy behavior ที่อาจหลุด production                        | High        |
| 3. Database / persistence                 |           3 | partial | `prisma/schema.prisma` มี tenant, package, subscription, agent, token, config, restart, wallet, shop, orders, identities, raids, events, notifications, audit/security logs; มี migrations             | Schema ครอบคลุมแต่ยังมี risk จาก provider/URL mismatch ตอน doctor, ต้องพิสูจน์ Postgres migrations, RLS/tenant isolation, seed/backup/restore และ retention policy                           | High        |
| 4. Owner Panel readiness                  |           3 | partial | `apps/owner-ui-prototype`, `src/admin/assets/owner-*`, owner API adapter/tests, smoke reports                                                                                                          | UI และ backend mapping เยอะ แต่ยังเป็น prototype ชัดเจนบางส่วน, มี mojibake บางหน้า, ต้องพิสูจน์ tenant/package/provisioning/billing/support/security actions บน live backend                | Medium      |
| 5. Tenant Admin Panel readiness           |           3 | partial | `src/admin/assets/tenant-v4-app.js`, `tenant-server-config-v4.js`, `tenant-donations-v4.js`, `tenant-events-v4.js`, `tenant-modules-v4.js`, `tenant-delivery-agents-v4.js`, `tenant-server-bots-v4.js` | Page coverage ดี แต่ UX/action completion ต้องทดสอบจริง, บาง copy/i18n เสีย, donation/events/modules ยังดูเป็น module console มากกว่า product flow ที่จบสำหรับลูกค้าทั่วไป                   | High        |
| 6. Player Portal readiness                |           3 | partial | `apps/web-portal-standalone/public/assets/player-v4-app.js`, `player-control-v4.js`, player API routes สำหรับ shop/orders/wallet/stats/leaderboard/killfeed/raids/profile/support                      | มี feature เยอะ แต่ต้องพิสูจน์ purchase/delivery/identity/profile/notification flow กับ tenant package และ agent จริง, UX locked/preview/error state ต้องครบกว่านี้                          | Medium-High |
| 7. Identity linking readiness             |           3 | partial | `portalAuthRuntime.js` รองรับ Discord/Google/email บางส่วน, `PlatformUserIdentity`, `PlatformPlayerProfile`, Steam link routes, player account store                                                   | Model มีแล้วแต่ต้อง hardened verification, duplicate identity handling, unlink/relink audit, in-game matching proof, account takeover protection และ user-facing recovery                    | High        |
| 8. Delivery Agent readiness               |           3 | partial | `apps/agent/server.js`, `src/scum-console-agent.js`, `agentExecutionRoutingService.js`, `rconDelivery.js`, role `execute`/scope `execute_only`, heartbeat/job/preflight/announce                       | Runtime concept ดี แต่ต้องมี installer/update, reconnect/backoff, device binding UX, token rotation, offline recovery, real SCUM client proof และ job idempotency/load proof                 | High        |
| 9. Server Bot readiness                   |           3 | partial | `apps/server-bot/server.js`, `src/services/scumServerBotRuntime.js`, server config job polling, backups, rollback, start/stop/restart probes, role `sync`/scope `sync_only`                            | Backend/runtime ดี แต่ต้องพิสูจน์ permissions/process manager/config file paths จริง, failure recovery, health verification, backup restore drill และ separation test ใน deployment          | High        |
| 10. Config system readiness               |           3 | partial | `serverBotConfigSchemaService.js`, `platformServerConfigService.js`, config snapshots/jobs/backups, typed schema, restart-required metadata, temp write/rename/verify in Server Bot runtime            | Schema-driven foundation มี แต่ต้องแก้ mojibake, validate ทุก field กับ SCUM config จริง, rollback UX, config diff/review, permissions และ audit trail ทุก change                            | High        |
| 11. Restart orchestration readiness       |           3 | partial | `platformRestartOrchestrationService.js`, restart plan/announcement/execution models, safe restart blockers, delayed restart, health verification, `restartScheduler.js` legacy announcements          | Logic มีแต่ต้องทดสอบกับ real server lifecycle, countdown announce, cancellation, server not coming back, delivery queue conflict, multi-tenant scheduling และ operator override              | High        |
| 12. Package / feature gating readiness    |           4 | partial | `packageCatalogService.js`, `productEntitlementService.js`, `tenantRouteEntitlements.js`, tenant/player feature-access, locked/preview states in UI                                                    | โครงสร้าง entitlement แข็งกว่า area อื่น แต่ต้อง audit ว่าทุก backend mutation บังคับ package จริง, dynamic navigation ตรงกันทุกหน้า, billing lifecycle sync กับ entitlement ไม่มี race      | Medium      |
| 13. Internationalization readiness        |           2 | partial | `admin-i18n.js`, `portal-i18n.js`, locale files EN/TH ใน admin และ portal                                                                                                                              | มีระบบ locale แล้ว แต่ยังมี hardcoded Thai/English, mojibake ใน Owner/tenant config/schema, Discord/runtime messages ยังไม่ผ่าน translation layer ครบ                                        | Medium-High |
| 14. Productization / commercial readiness |           2 | partial | public signup/login/checkout/session routes, preview account service, package catalog, billing lifecycle, Stripe/local billing code                                                                    | ยังไม่ commercial-ready เพราะต้องมี full self-service onboarding, real payment proof, invoice/refund/cancel/downgrade, support/legal/docs, customer success flow และ deployment runbook      | High        |
| 15. Security / operations readiness       |           3 | partial | `env.js`, `adminAuthRuntime.js`, token hashing fields, platform API key hash, provisioning token hash, 2FA/step-up, security event store, audit routes, doctor/security scripts                        | Security foundation ดี แต่ต้องปิด provider mismatch, rate-limit/abuse ทุกจุด, tenant isolation proof, secret rotation, alerting, monitoring, audit retention, incident response และ pen test | High        |

## 6. Critical Gaps Before Real Service Launch

- ปิด database/runtime mismatch ให้ได้ก่อน โดยเฉพาะ Prisma provider/DATABASE_URL และพิสูจน์ production Postgres migration + tenant isolation + backup/restore
- สร้างและรัน golden path แบบ production-like ครบตั้งแต่ signup ถึง delivery และ audit/notification โดยใช้ backend, DB, Server Bot, Delivery Agent จริง
- ทำ billing/subscription ให้ production-ready: Stripe webhook verification, invoice/payment failure, cancel/downgrade/upgrade, refund, chargeback, package entitlement reconciliation และ audit
- ทำ agent onboarding ให้ลูกค้าใช้งานเองได้: installer, activation, device binding, token rotation/revoke, reconnect, status diagnostics, version/update strategy
- แก้ i18n/mojibake และแยก translation key ให้ครบ Owner, Tenant, Player, Discord message, agent/server-bot status และ error message สำคัญ
- Harden role/permission/feature enforcement ทุก mutation โดยเฉพาะ config save/apply, restart/start/stop, delivery retry/cancel, staff/role, billing, player wallet/shop/order
- พิสูจน์ restart/config safety กับเซิร์ฟเวอร์จริง: backup before write, temp file write, rollback, health check, queue blocker, countdown announce, failure recovery
- ทำ observability/operations จริง: alert, log correlation, queue depth, failed webhook, failed delivery, failed restart, server bot offline, agent offline, incident runbook
- ปิด UX flow สำคัญใน 3 เว็บ: empty/error/loading/locked/preview state, confirmation before destructive action, audit trail visibility, recovery instruction ที่อ่านรู้เรื่อง
- ทำ security review รอบ production: rate limit, brute force, session fixation, account linking abuse, tenant data leakage, API key leakage, setup token expiry, audit retention

## 7. Recommended Priority Order

| Priority | Work group                      | Concrete work                                                                                                                                                                                    |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | Runtime + DB production proof   | แก้ Prisma/DATABASE_URL mismatch, ยืนยัน Postgres-only production path, รัน migrations/seed/smoke, เปิด tenant isolation strict/RLS proof, ทำ backup/restore drill                               |
| P0       | End-to-end launch path          | ทำ golden path test: signup, verify, package, checkout/webhook, tenant onboarding, server setup, Server Bot activation, Delivery Agent activation, config sync, player purchase, delivery, audit |
| P0       | Security enforcement            | ตรวจทุก mutation ว่ามี auth, role, tenant scope, package entitlement, audit log, rate limit หรือ abuse signal โดยเฉพาะ billing/config/restart/delivery/staff                                     |
| P0       | Agent/Bot operational readiness | ทำ installer/runbook/status/reconnect/token rotation/revoke/versioning สำหรับ Delivery Agent และ Server Bot พร้อม diagnostics สำหรับลูกค้าและ owner                                              |
| P1       | Billing/commercial lifecycle    | ทำ Stripe production checklist, invoice/payment failure, subscription renewal, cancel/downgrade/upgrade, refund/chargeback, entitlement reconciliation, customer billing UI                      |
| P1       | Config/restart hardening        | เพิ่ม config diff/review, rollback UX, restart countdown/cancel/history, safe restart blockers, post-restart verification, failure recovery docs และ tests กับ server จริง                       |
| P1       | UI/UX completion for 3 surfaces | ไล่ Owner/Tenant/Player ทุกหน้าให้มี loading/empty/error/locked/preview state, clear CTA, destructive confirmation, audit visibility และ mobile sanity                                           |
| P1       | i18n cleanup                    | ล้าง mojibake, ดึง hardcoded text สำคัญเข้า locale, รองรับ EN/TH ครบใน web/Discord/runtime status, เพิ่ม test ป้องกัน mojibake                                                                   |
| P2       | Observability + support         | ทำ dashboard/alerts, incident runbook, support diagnostics export, owner support workflow, customer-facing status, log correlation ตาม tenant/server/job                                         |
| P2       | Product packaging               | จัด package/feature matrix, preview/trial rules, onboarding checklist, docs ลูกค้า, pricing copy, locked state copy, upgrade path                                                                |
| P2       | Performance/load                | ทดสอบหลาย tenant, queue pressure, webhook burst, player portal traffic, DB indexes, retention job, background job throughput                                                                     |
| P3       | Polish + marketplace            | ปรับ owner prototype ให้เป็น production app เต็ม, เพิ่ม marketplace/module marketplace, analytics เชิงธุรกิจ, customer success reporting, automation recipes                                     |

## 8. Final Verdict

Can this be used now?
ใช้ได้ในฐานะ internal/pilot managed service ถ้าทีม dev/operator เป็นคนตั้งค่า runtime, monitor ระบบ, แก้ incident เอง และยอมรับว่าบาง flow ยังต้อง manual support

Can this be sold now?
ยังไม่ควรขายจริงแบบ self-service SaaS หรือ managed service สำหรับลูกค้าทั่วไป เพราะ risk ยังสูงใน production DB proof, billing, onboarding, agent installation, config/restart safety, i18n, operations และ support lifecycle

What level is it at today?
ระดับวันนี้คือ Managed-Service Prototype ที่ค่อนข้างก้าวหน้า ใกล้ SaaS Foundation แต่ยังไม่ถึง Managed-Service Ready และยังห่างจาก Commercial-Ready Service

คำตัดสินสุดท้าย: แกนระบบมีทิศทางถูกและมีงาน backend/runtime เยอะกว่าหน้าเว็บหลอก แต่การขายจริงต้องวัดจาก flow ที่ลูกค้าทำเองได้และระบบ recover เองได้ ไม่ใช่แค่มี route/page/schema ครบ ตอนนี้ควรโฟกัส P0 ก่อนทำ feature ใหม่เพิ่ม
