# Production Roadmap P0-P3

เอกสารนี้สรุปงานที่ `ยังเหลือทั้งหมด` หลังรอบ security/runtime hardening ล่าสุด เพื่อพาโปรเจกต์จาก `Managed-Service Prototype` ไปสู่ `Commercial-Ready Service`

อัปเดตล่าสุด: `2026-04-01`

## เป้าหมาย

- ทำให้ระบบพร้อมใช้งานจริงแบบ `managed service / SaaS-style SCUM platform`
- ปิดช่องว่างด้าน `data`, `auth`, `runtime boundary`, `billing`, `ops`, และ `product completeness`
- ให้ทีมสามารถหยิบงานต่อได้เป็นลำดับ `P0 -> P1 -> P2 -> P3`

## วิธีอ่าน

- `P0` = ต้องทำก่อนขายจริง
- `P1` = ทำต่อทันทีหลังฐานระบบนิ่ง
- `P2` = เติมความครบของ product vision
- `P3` = งานยกระดับเชิง commercial / scale / polish

คำว่า `จุดเริ่มต้นใน repo` คือไฟล์หรือโมดูลที่ควรเริ่มอ่านก่อนลงมือ

---

## P0 Must Fix First

### P0-1. ย้าย state สำคัญออกจากไฟล์ไปฐานข้อมูล

- เป้าหมาย: เลิกพึ่ง JSON/file store สำหรับ state สำคัญของ platform
- เหตุผล: ตอนนี้ recovery, audit, multi-instance, consistency ยังอ่อนเพราะ state กระจายอยู่ในไฟล์
- จุดเริ่มต้นใน repo:
  - [controlPlaneRegistryRepository.js](/C:/new/src/data/repositories/controlPlaneRegistryRepository.js)
  - [publicPreviewAccountStore.js](/C:/new/src/store/publicPreviewAccountStore.js)
  - [src/store](/C:/new/src/store)
  - [schema.prisma](/C:/new/prisma/schema.prisma)
- งานย่อย:
  - ระบุรายการ state ที่ยัง file-backed ทั้งหมด
  - ออกแบบ Prisma schema สำหรับ agent, device, provisioning, session, sync, preview account, audit trail
  - เขียน migration จาก file store -> DB
  - ทำ compatibility path สำหรับ import state เดิม
  - ปิด write path เก่าเมื่อ migration ผ่าน
- Done เมื่อ:
  - state สำคัญทั้งหมดถูกอ่าน/เขียนผ่าน DB
  - file store เหลือเฉพาะ cache หรือ artifact ที่ไม่ critical
  - มี migration test และ smoke test หลัง cutover

### P0-2. ทำ production persistence ให้เป็น PostgreSQL-first จริง

- เป้าหมาย: ให้ production path พึ่ง PostgreSQL เป็นหลัก ไม่ใช่มี fallback แบบกำกวม
- จุดเริ่มต้นใน repo:
  - [schema.prisma](/C:/new/prisma/schema.prisma)
  - [DATABASE_STRATEGY.md](/C:/new/docs/DATABASE_STRATEGY.md)
  - [DB_ENGINE_MIGRATION_PATH_TH.md](/C:/new/docs/DB_ENGINE_MIGRATION_PATH_TH.md)
- งานย่อย:
  - ปรับ schema/provider strategy ให้ชัดระหว่าง dev/test/prod
  - เก็บกวาด code path ที่ assume SQLite/file persistence
  - บังคับ production env ให้ใช้ PostgreSQL path เท่านั้น
  - เพิ่ม DB bootstrap, migration, rollback, backup/restore script ที่ใช้งานจริง
- Done เมื่อ:
  - production env บูตไม่ได้ถ้าไม่ใช่ PostgreSQL
  - migration รันซ้ำได้แบบ reproducible
  - integration tests ใช้ schema ที่สอดคล้องกับ production path

### P0-3. Incident / Restore / Recovery Drill

- เป้าหมาย: พิสูจน์ว่ากู้ระบบกลับมาได้จริง
- จุดเริ่มต้นใน repo:
  - [adminSnapshotService.js](/C:/new/src/services/adminSnapshotService.js)
  - [platformMonitoringService.js](/C:/new/src/services/platformMonitoringService.js)
  - [INCIDENT_RESPONSE.md](/C:/new/docs/INCIDENT_RESPONSE.md)
  - [MIGRATION_ROLLBACK_POLICY_TH.md](/C:/new/docs/MIGRATION_ROLLBACK_POLICY_TH.md)
- งานย่อย:
  - กำหนด RTO/RPO
  - เขียน runbook สำหรับ DB outage, bad deploy, bad config push, agent compromise, queue corruption
  - ซ้อม restore จาก clean environment
  - ทำ smoke tests หลัง restore
  - เก็บหลักฐาน drill และ postmortem
- Done เมื่อ:
  - restore ผ่านอย่างน้อย 3 รอบติด
  - มี runbook และผลวัดเวลาจริง
  - คนอื่นในทีมทำตามเอกสารแล้วกู้ได้

### P0-4. Cross-Machine E2E จริง

- เป้าหมาย: พิสูจน์ topology จริงระหว่าง control-plane, delivery-agent, server-bot, watcher
- จุดเริ่มต้นใน repo:
  - [machine-validation.js](/C:/new/scripts/machine-validation.js)
  - [MACHINE_VALIDATION_GUIDE_TH.md](/C:/new/docs/MACHINE_VALIDATION_GUIDE_TH.md)
  - [TWO_MACHINE_AGENT_TOPOLOGY.md](/C:/new/docs/TWO_MACHINE_AGENT_TOPOLOGY.md)
- งานย่อย:
  - เตรียม staging topology 2 เครื่อง
  - ทดสอบ provisioning -> activation -> heartbeat -> sync -> config apply -> restart verify
  - ทดสอบ reconnect/failure paths
  - เก็บ artifacts/report ต่อรอบ
- Done เมื่อ:
  - flow สำคัญผ่านบน 2 เครื่องจริง
  - machine validation และ smoke run ตรงกับผลใช้งานจริง

### P0-5. Unified Identity และ auth lifecycle ให้ครบ

- เป้าหมาย: รวม `email + Discord + Steam + in-game` เป็น identity model เดียว
- จุดเริ่มต้นใน repo:
  - [platformWorkspaceAuthService.js](/C:/new/src/services/platformWorkspaceAuthService.js)
  - [platformIdentityService.js](/C:/new/src/services/platformIdentityService.js)
  - [linkService.js](/C:/new/src/services/linkService.js)
  - [portalAuthRuntime.js](/C:/new/apps/web-portal-standalone/auth/portalAuthRuntime.js)
- งานย่อย:
  - ออกแบบ canonical identity graph
  - ทำ link/unlink/merge/conflict rules
  - ทำ verification state ให้ชัด
  - ทำ recovery / rebind / account-ownership checks
  - เพิ่ม audit log สำหรับ identity changes
- Done เมื่อ:
  - ผู้ใช้ 1 คนมี model เดียวและ link ได้หลาย provider
  - ไม่มี flow สำคัญที่ต้องดูหลาย store เพื่อรู้สถานะ account

### P0-6. ปิด loop restart/config/runtime management ให้ครบ

- เป้าหมาย: ให้ server-bot / watcher / config flow ใช้งานจริงได้แบบ managed service
- จุดเริ่มต้นใน repo:
  - [platformServerConfigService.js](/C:/new/src/services/platformServerConfigService.js)
  - [scumServerBotRuntime.js](/C:/new/src/services/scumServerBotRuntime.js)
  - [serverControlJobService.js](/C:/new/src/domain/servers/serverControlJobService.js)
  - [scumLogWatcherRuntime.js](/C:/new/src/services/scumLogWatcherRuntime.js)
- งานย่อย:
  - restart now
  - delayed restart
  - countdown announce
  - start/stop
  - safe restart
  - post-restart health verify
  - history / retry / rollback
- Done เมื่อ:
  - restart flow มี end-to-end test
  - operator ดูย้อนหลังได้ว่าใครสั่งอะไร ผลเป็นอย่างไร

### P0-7. Agent lifecycle และ runtime separation ให้พิสูจน์ได้จริง

- เป้าหมาย: แยก Delivery Agent, Server Bot, Watcher ในเชิง runtime และ ops จริง
- จุดเริ่มต้นใน repo:
  - [agentContracts.js](/C:/new/src/contracts/agent/agentContracts.js)
  - [platformAgentPresenceService.js](/C:/new/src/services/platformAgentPresenceService.js)
  - [controlPlaneSyncClient.js](/C:/new/src/integrations/scum/adapters/controlPlaneSyncClient.js)
  - [scumConsoleAgent.js](/C:/new/src/services/scumConsoleAgent.js)
- งานย่อย:
  - พิสูจน์ least privilege ทุก scope
  - rotate / revoke / rebind token
  - device/session records
  - compromise response flow
  - per-role runbook
- Done เมื่อ:
  - token หลุด 1 ตัวไม่ลากทั้งระบบ
  - revoke แล้ว role เดิมใช้ต่อไม่ได้

### P0-8. Full integration regression หลัง hardening

- เป้าหมาย: ให้ patch security/runtime ที่เพิ่งทำไม่ทิ้ง latent regression
- จุดเริ่มต้นใน repo:
  - [test](/C:/new/test)
  - [admin-api.integration.test.js](/C:/new/test/admin-api.integration.test.js)
  - [platform-agent-api.integration.test.js](/C:/new/test/platform-agent-api.integration.test.js)
- งานย่อย:
  - จัด env สำหรับ integration suite
  - แก้ test ที่พึ่ง legacy behavior
  - เพิ่ม CI matrix สำหรับ startup guard / runtime guard / route hardening
- Done เมื่อ:
  - integration suite หลักผ่านใน CI
  - ไม่มี test สำคัญที่ถูก skip เพราะ env ไม่พร้อม

### P0-9. เอกสารและ env examples ให้ตรงกับกฎใหม่

- เป้าหมาย: ลด drift ระหว่าง code กับคู่มือ
- จุดเริ่มต้นใน repo:
  - [ENV_REFERENCE_TH.md](/C:/new/docs/ENV_REFERENCE_TH.md)
  - [ENV_PROFILES_TH.md](/C:/new/docs/ENV_PROFILES_TH.md)
  - [GO_LIVE_CHECKLIST_TH.md](/C:/new/docs/GO_LIVE_CHECKLIST_TH.md)
- งานย่อย:
  - อัปเดต startup hard-fail rules
  - อัปเดต watcher transport rules
  - อัปเดต token-in-URL changes
  - เพิ่ม smoke / validation commands ใน go-live docs
- Done เมื่อ:
  - operator ใหม่ตั้งค่าระบบตาม docs แล้วบูตผ่าน

---

## P1 Foundation After Core Is Stable

### P1-1. Billing lifecycle จริง

- จุดเริ่มต้นใน repo:
  - [platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
  - [platformService.js](/C:/new/src/services/platformService.js)
- งานย่อย:
  - checkout จริง
  - webhook lifecycle
  - renew / cancel / failed payment / refund
  - invoice state machine
  - entitlement sync
- Done เมื่อ:
  - subscription state สอดคล้องกับ payment state เสมอ

### P1-2. Owner Panel เป็น commercial console

- จุดเริ่มต้นใน repo:
  - [src/admin](/C:/new/src/admin)
  - [OWNER_TENANTS_V4_IMPLEMENTATION_SPEC_TH.md](/C:/new/docs/OWNER_TENANTS_V4_IMPLEMENTATION_SPEC_TH.md)
- งานย่อย:
  - tenant lifecycle actions
  - revenue/subscription views
  - support/diagnostics export
  - audit/security investigation tools

### P1-3. Tenant Admin Panel เป็น operations cockpit

- จุดเริ่มต้นใน repo:
  - [TENANT_SERVER_CONFIG_V4_IMPLEMENTATION_SPEC_TH.md](/C:/new/docs/TENANT_SERVER_CONFIG_V4_IMPLEMENTATION_SPEC_TH.md)
  - [TENANT_SERVER_BOTS_V4_IMPLEMENTATION_SPEC_TH.md](/C:/new/docs/TENANT_SERVER_BOTS_V4_IMPLEMENTATION_SPEC_TH.md)
  - [TENANT_DELIVERY_AGENTS_V4_IMPLEMENTATION_SPEC_TH.md](/C:/new/docs/TENANT_DELIVERY_AGENTS_V4_IMPLEMENTATION_SPEC_TH.md)
- งานย่อย:
  - package awareness / locked state
  - restart history / diagnostics
  - delivery agent management
  - server bot management
  - staff RBAC
  - Discord integration visibility

### P1-4. Monitoring / alerting / support loop

- จุดเริ่มต้นใน repo:
  - [platformMonitoringService.js](/C:/new/src/services/platformMonitoringService.js)
  - [platformAutomationService.js](/C:/new/src/services/platformAutomationService.js)
- งานย่อย:
  - severity / routing / acknowledge / escalation
  - support bundle
  - operator timeline
  - failure pattern detection

### P1-5. Public web / checkout / onboarding polish

- จุดเริ่มต้นใน repo:
  - [publicPlatformRoutes.js](/C:/new/apps/web-portal-standalone/api/publicPlatformRoutes.js)
  - [public-auth-v2.js](/C:/new/apps/web-portal-standalone/public/assets/public-auth-v2.js)
- งานย่อย:
  - browser E2E ของ signup / checkout / payment-result
  - better error states
  - post-payment onboarding flow
  - trust messaging / support CTA

---

## P2 Product Completeness

### P2-1. Donation system จริง

- จุดเริ่มต้นใน repo:
  - [packageCatalogService.js](/C:/new/src/domain/billing/packageCatalogService.js)
- งานย่อย:
  - donation campaigns
  - rewards
  - supporter history
  - tenant/player UI

### P2-2. Raid system จริง

- จุดเริ่มต้นใน repo:
  - [raidService.js](/C:/new/src/services/raidService.js)
  - [playerGeneralRoutes.js](/C:/new/apps/web-portal-standalone/api/playerGeneralRoutes.js)
- งานย่อย:
  - request
  - window
  - summary
  - evidence
  - approval history

### P2-3. Event system / bot modules system

- จุดเริ่มต้นใน repo:
  - [src/services](/C:/new/src/services)
  - [src/admin/assets](/C:/new/src/admin/assets)
- งานย่อย:
  - module registry
  - per-tenant enable/disable
  - module config
  - event lifecycle

### P2-4. Player activity / killfeed / stats completeness

- จุดเริ่มต้นใน repo:
  - [killFeedService.js](/C:/new/src/services/killFeedService.js)
  - [playerGeneralRoutes.js](/C:/new/apps/web-portal-standalone/api/playerGeneralRoutes.js)
- งานย่อย:
  - persisted activity feed
  - filters / privacy
  - richer profile drill-down
  - leaderboards by timeframe

### P2-5. I18n ให้ครบ end-to-end

- จุดเริ่มต้นใน repo:
  - [admin-i18n.js](/C:/new/src/admin/assets/admin-i18n.js)
  - [portal-i18n.js](/C:/new/apps/web-portal-standalone/public/assets/portal-i18n.js)
- งานย่อย:
  - backend message keys
  - Discord/runtime messages
  - email templates
  - hardcoded copy cleanup

### P2-6. Analytics / notifications / automation completeness

- จุดเริ่มต้นใน repo:
  - [platformMonitoringService.js](/C:/new/src/services/platformMonitoringService.js)
  - [platformAutomationService.js](/C:/new/src/services/platformAutomationService.js)
- งานย่อย:
  - product analytics
  - notification center
  - automation history
  - conversion/churn signals

---

## P3 Commercial / Scale / Polish

### P3-1. Self-service onboarding แบบจบใน flow เดียว

- machine prep
- runtime registration
- install instructions
- first-success checklist

### P3-2. Support tooling ระดับ commercial

- support case workflow
- tenant evidence export
- redacted diagnostics bundle
- operator approval flow

### P3-3. Release engineering / CI / deployment maturity

- staging/prod gates
- post-deploy smoke
- rollback automation
- release evidence bundle

### P3-4. Performance / scale / tenancy hardening

- DB performance baselines
- queue pressure tests
- multi-tenant isolation tests
- large-tenant data volume tests

### P3-5. SLA / legal / commercial packaging

- support policy
- uptime policy
- billing policy
- tenant-facing docs

---

## ลำดับทำจริงที่แนะนำ

1. `P0-1` state -> DB
2. `P0-2` PostgreSQL-first cutover
3. `P0-5` unified identity + auth lifecycle
4. `P0-6` restart/config/runtime loop
5. `P0-7` agent lifecycle + separation proof
6. `P0-3` incident / restore / recovery drill
7. `P0-4` cross-machine E2E
8. `P0-8` full integration regression
9. `P0-9` docs/env update
10. `P1-1` billing lifecycle
11. `P1-2` owner panel ops
12. `P1-3` tenant admin ops
13. `P1-4` monitoring / support loop
14. `P1-5` public web polish
15. `P2` product completeness
16. `P3` commercial / scale / polish

---

## คำแนะนำการแบ่งเฟสทำงาน

### Phase A

- P0-1
- P0-2
- P0-5

ผลลัพธ์ที่ควรได้:

- data model เริ่มนิ่ง
- auth/identity ไม่กระจัดกระจาย
- production posture ชัดขึ้นมาก

### Phase B

- P0-6
- P0-7
- P0-3
- P0-4

ผลลัพธ์ที่ควรได้:

- runtime path ใช้งานจริงได้
- recovery path พิสูจน์ได้
- topology จริงเริ่มเชื่อถือได้

### Phase C

- P0-8
- P0-9
- P1-1
- P1-2
- P1-3

ผลลัพธ์ที่ควรได้:

- พร้อม pilot / managed service rollout
- commercial foundation เริ่มครบ

### Phase D

- P1-4
- P1-5
- P2 ทั้งหมด
- P3 ทั้งหมด

ผลลัพธ์ที่ควรได้:

- platform ครบตาม product vision
- เข้าใกล้ commercial-ready service

---

## Definition Of Done ระดับโปรเจกต์

จะถือว่าโปรเจกต์เข้าใกล้ `Commercial-Ready Service` เมื่อมีครบอย่างน้อย:

- production path เป็น PostgreSQL-first จริง
- state สำคัญไม่พึ่ง JSON/file store
- identity/linking ใช้งานจริงครบ
- runtime separation พิสูจน์ได้บนหลายเครื่อง
- restore/recovery drill ผ่าน
- billing lifecycle ใช้งานจริงครบ
- owner/tenant/player flows ผ่าน browser E2E หลัก
- monitoring / audit / support / diagnostics พร้อมใช้งาน
- docs และ env examples ตรงกับ runtime จริง

## หมายเหตุ

- งาน security/runtime hardening ล่าสุดปิดช่องเสี่ยงสำคัญไปแล้วหลายจุด แต่ยังไม่ใช่จุดสิ้นสุดของ production readiness
- roadmap นี้ตั้งใจให้ใช้เป็น `master worklist` หลังจากรอบ hardening ล่าสุด
- ถ้าจะทำต่อ ควรเริ่มที่ `P0-1` ทันที ไม่ควรข้ามไปทำฟีเจอร์ใหม่ก่อน
