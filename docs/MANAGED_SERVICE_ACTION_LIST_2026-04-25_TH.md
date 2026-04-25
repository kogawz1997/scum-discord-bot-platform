# Managed Service Action List (2026-04-25)

เอกสารนี้สรุปจากการ audit repository ณ วันที่ 2026-04-25 โดยโฟกัสคำถามว่า "ตอนนี้ทั้งโปรเจคควรปรับอะไร และควรเพิ่มอะไร" สำหรับการขยับจาก prototype ไปสู่ managed service / SaaS-style platform ที่ใช้งานเชิงพาณิชย์ได้จริง

ไฟล์ที่เกี่ยวข้อง:

- สรุปสถานะทั้ง repo: [FULL_REPO_CURRENT_STATE_2026-04-25_TH.md](./FULL_REPO_CURRENT_STATE_2026-04-25_TH.md)
- manifest ทุกไฟล์ใน working tree: [FULL_REPO_FILE_MANIFEST_2026-04-25.md](./FULL_REPO_FILE_MANIFEST_2026-04-25.md)

## สถานะปัจจุบัน

- ระดับปัจจุบัน: `Managed-Service Prototype`
- ใช้งานได้ตอนนี้: ได้ในรูปแบบ operator-led หรือทีมดูแลยังช่วยประกบ
- ยังไม่ควรขายแบบ self-serve เต็มรูปแบบ เพราะ boundary, security, identity, onboarding, และ ops hardening ยังไม่พอ

## รายละเอียดปัจจุบัน

### ภาพรวม repository ตอนนี้

- โครงสร้างหลักมีครบระดับ platform จริง ไม่ใช่ repo ทดลองเล็ก ๆ แล้ว โดยมี `apps/`, `src/`, `prisma/`, `deploy/`, `docs/`, และ `test/`
- ใน `apps/` มีหลาย surface และ runtime จริง เช่น `api`, `owner-web`, `tenant-web`, `server-bot`, `agent`, `worker`, `watcher`, `discord-bot`, และ `web-portal-standalone`
- แต่ web surfaces ยังไม่ converge สะอาด เพราะ `owner-web` และ `tenant-web` ยังเป็น thin runtime wrappers ขณะที่ owner production path ยัง stitch เข้ากับ prototype assets อยู่
- `web-portal-standalone` เป็น surface ที่ดู complete กว่าส่วนอื่นในเชิง runtime structure เพราะมี `api`, `auth`, `public`, `runtime`, และ env profiles ของตัวเอง

### สิ่งที่มีของจริงแล้วในปัจจุบัน

- มี multi-tenant persistence model จริงใน `prisma/schema.prisma` ครอบคลุม tenant, subscription, identity, agent, config, restart, billing, notifications, audit, raid, killfeed, และ automation
- มี agent provisioning lifecycle จริง ทั้ง setup token, activation, device binding, heartbeat, runtime scope separation
- มี `Server Bot` runtime ของจริงสำหรับ config sync / config write / backup / verify / start-stop/restart probes
- มี config system ของจริงที่เป็น schema-driven และรองรับ snapshot, backup, validation, atomic write, rollback direction
- มี restart orchestration ของจริงพร้อม plan, announcement, execution history, และ health verification fields
- มี self-service public auth/billing foundation จริง เช่น signup, login, password reset, email verification, preview, checkout session, billing webhook
- มี entitlement / package gating จาก backend จริง ไม่ใช่ frontend toggle เฉย ๆ
- มี identity model จริงสำหรับ email, Discord, Google, Steam, และ in-game player profile linkage

### สิ่งที่เป็น partial ในปัจจุบัน

- `Delivery Agent` ยังไม่แยกเป็น production runtime boundary ที่สะอาด เพราะ `src/delivery-agent.js` ยังเป็น alias ไปที่ `src/scum-console-agent.js`
- Owner surface ยังไม่จบเชิงสถาปัตยกรรม เพราะ `src/admin/runtime/adminPageRuntime.js` ยังพึ่ง `apps/owner-ui-prototype/dist`
- Player/Tenant/Owner features หลายหมวดมี route กับ service จริง แต่ระดับความสมบูรณ์ไม่เท่ากัน บางระบบยังเป็น overview layer หรือ management shell มากกว่าผลิตภัณฑ์ที่ลึกครบ
- Donations / events / modules / raids / stats มีของจริงบางส่วน แต่ยังไม่ใช่โดเมนที่ harden แล้วเท่ากับ billing, config, restart, และ agent provisioning
- i18n infrastructure มีจริง แต่ยังต้องซ่อม text hygiene เพราะใน source มี mojibake repair logic อยู่
- docs ของ repo เองยังประเมินหลายหัวข้อเป็น `Partial` โดยเฉพาะ commercial readiness, security hardening, observability, admin operational tools, และ player portal improvement

### จุดเสี่ยงปัจจุบันที่เห็นชัด

- มี security gap ที่จับต้องได้ทันที คือ webhook secret ยังเก็บเป็น plaintext field ใน schema ขณะที่ token ประเภทอื่นหลายตัวถูก hash แล้ว
- runtime boundary และชื่อเรียกของ execution role ยังปนกันระหว่าง product language ใหม่กับ legacy naming เดิม
- web surface architecture ยังมี transition debt ทำให้ ownership, deploy path, และ regression control ยากกว่าที่ควร
- commercial flow ยังมี foundation แต่ยังไม่ถึงระดับ provider-grade operations
- identity cohesion ยังไม่ถึงจุดที่ปล่อย self-serve แบบเชื่อมั่นได้เต็มที่

### คะแนนสภาพปัจจุบันแบบย่อ

- Repository architecture: `3/5` - มีของจริงเยอะ แต่ยังมี wrapper/prototype transition debt
- Backend / control plane: `3/5` - ฟีเจอร์ breadth กว้าง แต่ maturity ไม่เท่ากันทุกโดเมน
- Database / persistence: `4/5` - ฐานข้อมูลค่อนข้างแข็งแรงและออกแบบมาเพื่อ platform จริง
- Owner Panel: `2/5` - surface กว้าง แต่ยังไม่ clean และยังไม่ถึง operator-grade สมบูรณ์
- Tenant Admin Panel: `3/5` - ใช้งานได้จริงมากกว่า owner บางส่วน แต่ยังมี domain depth gap
- Player Portal: `3/5` - มีของจริงเยอะและเป็น standalone runtime ที่ชัดกว่า แต่ยังไม่ productized ครบ
- Identity linking: `3/5` - foundation ดี แต่ยังไม่ cohesive พอสำหรับขายแบบ self-serve เต็มรูปแบบ
- Delivery Agent: `2/5` - มี runtime จริง แต่ยังไม่ cleanly productized
- Server Bot: `4/5` - เป็นหนึ่งในส่วนที่พร้อมที่สุดของ repo ตอนนี้
- Config system: `4/5` - แข็งแรงและใกล้ production ที่สุดชุดหนึ่ง
- Restart orchestration: `4/5` - มีของจริงและมี persistence/history ที่ดี
- Package / feature gating: `4/5` - มี backend enforcement ชัดเจน
- Internationalization: `2/5` - มีระบบ แต่ยังไม่สะอาดพอ
- Productization / commercial readiness: `2/5` - ยังไม่ถึงระดับขายจริงแบบมั่นใจ
- Security / operations readiness: `3/5` - มีฐานดี แต่ hardening ยังไม่พอ

## สรุปสั้นที่สุด

### สิ่งที่ต้องปรับ

1. แยก `Delivery Agent` และ `Server Bot` ให้สะอาดจริงทั้งชื่อ runtime, provisioning, update path, และเอกสาร
2. รวม web surfaces ให้เป็น production path เดียว ลด wrapper/prototype debt
3. ปิด security gap ที่ยังเห็นชัด โดยเฉพาะ secret storage, rate limit, audit completeness, และ token lifecycle
4. ทำ identity linking ให้เป็น flow เดียวที่ครบตั้งแต่ email -> Discord -> Steam -> in-game verification
5. เก็บ i18n และ encoding hygiene ให้สะอาด โดยเฉพาะภาษาไทย
6. ทำ onboarding/commercial flow ให้จบจริงตั้งแต่ signup -> preview -> purchase -> tenant activation -> first successful runtime

### สิ่งที่ต้องเพิ่ม

1. installer / updater / version channel สำหรับ runtime agents
2. support tooling สำหรับ stuck jobs, retries, dead letters, fleet diagnostics, recovery bundles
3. provider-grade billing operations เช่น failed payment recovery, refund/dispute workflow, subscription rescue
4. module lifecycle จริง เช่น versioning, compatibility, enable/disable, rollback
5. live observability และ alerting ที่พร้อมใช้งานเชิงปฏิบัติการ
6. deployment proof และ rollout evidence หลาย environment

## Priority Worklist

## P0

### P0-1. Clean runtime boundary ระหว่าง Delivery Agent และ Server Bot

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - เปลี่ยน runtime naming ให้ชัดทุกชั้น
  - ตัดการพึ่งชื่อ legacy `console-agent`
  - แยก packaging, activation, provisioning, docs, monitoring ให้เป็นสอง runtime ที่ชัด
- ทำไมต้องทำ:
  - ตอนนี้ backend role/scope ค่อนข้างถูกต้องแล้ว แต่ execution/runtime naming ยังมี debt ทำให้ product boundary ไม่สะอาด
- หลักฐานใน repo:
  - `src/delivery-agent.js`
  - `src/scum-console-agent.js`
  - `docs/RUNTIME_BOUNDARY_EXPLAINER.md`
  - `src/contracts/agent/agentContracts.js`
- ความเสี่ยงถ้าไม่ทำ:
  - support/debug ยาก
  - product messaging สับสน
  - runtime ownership และ incident handling ไม่ชัด

### P0-2. รวม Owner / Tenant / Admin surface architecture ให้จบ

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ตัด prototype coupling ออกจาก production serving path
  - ทำ owner/tenant/admin surface structure ให้มี source of truth เดียว
  - ลด stitch bridge และ asset coupling ที่ยังเป็น transitional
- ทำไมต้องทำ:
  - ตอนนี้ surface breadth ดี แต่ architecture ยังผสมระหว่าง runtime จริงกับ prototype assets
- หลักฐานใน repo:
  - `apps/owner-web/server.js`
  - `apps/tenant-web/server.js`
  - `apps/admin-web/server.js`
  - `src/admin/runtime/adminPageRuntime.js`
  - `apps/owner-ui-prototype/README.md`
- ความเสี่ยงถ้าไม่ทำ:
  - deploy/debug ยุ่ง
  - ownership ของ frontend ไม่ชัด
  - regression risk สูง

### P0-3. Harden security baseline

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ย้าย secret storage ที่ยังเป็น plaintext ไปเป็น hashed/encrypted-at-rest
  - เพิ่ม distributed rate limiting และ abuse signals
  - ทบทวน credential rotation, revocation, audit completeness
- ทำไมต้องทำ:
  - บางส่วนดีแล้ว เช่น token hash และ device binding แต่ยังมีช่องว่างชัดเจน
- หลักฐานใน repo:
  - `prisma/schema.prisma`
  - `src/services/platformAgentPresenceService.js`
  - `docs/PRODUCT_READY_GAP_MATRIX.md`
- จุดที่น่ากังวล:
  - `PlatformWebhookEndpoint.secretValue` ยังเป็น plaintext
- ความเสี่ยงถ้าไม่ทำ:
  - ไม่ผ่าน bar ของ service เชิงพาณิชย์
  - incident impact สูง

### P0-4. ทำ onboarding / purchase / activation flow ให้จบจริง

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ทำ happy path ให้ครบตั้งแต่ signup -> preview -> billing -> tenant create -> agent activation -> first healthy status
  - เพิ่ม unhappy path handling เช่น verify email ไม่ผ่าน, payment fail, activation token หมดอายุ
- ทำไมต้องทำ:
  - flow foundation มีแล้ว แต่ยังไม่ถึงระดับ production-grade commercial journey
- หลักฐานใน repo:
  - `apps/web-portal-standalone/api/publicPlatformRoutes.js`
  - `src/services/publicPreviewService.js`
  - `src/services/platformBillingLifecycleService.js`
  - `docs/PRODUCT_READY_GAP_MATRIX.md`
- ความเสี่ยงถ้าไม่ทำ:
  - ขายได้ยาก
  - support load สูงมาก

### P0-5. เก็บ i18n และ text encoding hygiene

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ลบ mojibake จาก source และ locale bundles
  - ลด hardcoded text
  - ทำ translation coverage และ copy review สำหรับ EN/TH
- ทำไมต้องทำ:
  - product requirement ระบุว่าต้องรองรับไทยอย่างน้อย แต่ในโค้ดยังมีการ repair mojibake อยู่
- หลักฐานใน repo:
  - `src/admin/assets/admin-i18n.js`
  - `apps/web-portal-standalone/public/assets/portal-i18n.js`
  - `apps/web-portal-standalone/README_TH.md`
- ความเสี่ยงถ้าไม่ทำ:
  - UX เสีย
  - brand trust ต่ำ
  - support ภาษายาก

## P1

### P1-1. ทำ identity linking ให้เป็น product flow เดียว

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ทำ verification state machine ให้ชัด
  - เพิ่ม conflict resolution ระหว่าง Discord / Steam / in-game
  - ทำ manual review/admin override สำหรับ account mismatch
- หลักฐานใน repo:
  - `src/services/platformIdentityService.js`
  - `apps/web-portal-standalone/auth/portalAuthRuntime.js`
- หมายเหตุ:
  - foundation ดี แต่ยังดูเป็น domain capability มากกว่าประสบการณ์ใช้งานที่จบครบ

### P1-2. ยกระดับ support / diagnostics tooling

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - stuck job inspector
  - selective retry / replay tools
  - dead-letter handling
  - tenant diagnostics bundles
  - fleet incident drill-down
- หลักฐานใน repo:
  - มี foundation ในหลาย service/docs แต่ repo เองยัง mark admin operational tools เป็น partial
  - `docs/PRODUCT_READY_GAP_MATRIX.md`

### P1-3. ทำ live observability และ alerting ให้พร้อมใช้งานจริง

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - metrics, thresholds, alerts, runbooks, dashboards
  - restart/config/runtime incidents ต้อง trace และ correlate ได้
- หลักฐานใน repo:
  - `src/services/platformMonitoringService.js`
  - `src/services/platformAnalyticsService.js`
  - `docs/PRODUCT_READY_GAP_MATRIX.md`
- หมายเหตุ:
  - ตอนนี้มีฐาน แต่ยังต่ำกว่ามาตรฐาน mature ops

### P1-4. ทำ Delivery Agent packaging / installer / updater

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - installer ที่ชัด
  - secure bootstrap
  - upgrade path
  - rollback path
  - runtime self-diagnostics
- ทำไม:
  - ตัว runtime มีแล้ว แต่ field-operations model ยังไม่ productized

### P1-5. ทำ Server Bot operator lifecycle ให้พร้อม production

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - bootstrap validation
  - upgrade/rollback workflow
  - environment readiness checks
  - machine drift detection
- หลักฐานใน repo:
  - `src/services/scumServerBotRuntime.js`
  - `deploy/`

## P2

### P2-1. ยกระดับ donation / event / module domains จาก overview ไปสู่ productized workflows

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ทำ CRUD, state transitions, audit, support tools, and user flows ให้ครบ
  - ลดการพึ่ง overview/readiness shell
- หลักฐานใน repo:
  - donation/module/event surfaces และ tests มีอยู่จริง
  - แต่หลายจุดยังเป็น management layer มากกว่าระบบเชิงผลิตภัณฑ์เต็ม

### P2-2. ทำ raid / stats / killfeed ให้เสถียรใน data model เดียว

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ลด compatibility path
  - ลด legacy storage behavior
  - ทำ retention, indexing, query model ให้ชัด
- หลักฐานใน repo:
  - `src/services/raidService.js`
  - `src/store/statsStore.js`
  - `src/services/killFeedService.js`

### P2-3. ทำ commercial ops ให้พร้อม support จริง

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - failed payment recovery
  - invoice dispute/refund flow
  - subscription rescue / downgrade / grace period UX
  - owner revenue operations dashboard ที่ action ได้จริง

### P2-4. ทำ module lifecycle จริง

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - module versioning
  - compatibility contract
  - enable/disable policy
  - rollout/rollback policy
  - tenant entitlement integration

## P3

### P3-1. เก็บ UX polish ทั้งสาม surface

- ประเภท: `ต้องปรับ`
- ทำอะไร:
  - ลดข้อมูลหนาแน่นเกินจำเป็น
  - แยก operational views กับ executive views
  - ลด support burden จาก confusing states

### P3-2. เพิ่ม environment proof และ rollout evidence

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - เพิ่ม live validation หลาย environment
  - เก็บ operational evidence สำหรับ launch gate
- หลักฐานใน repo:
  - `docs/PRODUCT_READY_GAP_MATRIX.md`
  - `docs/DELIVERY_NATIVE_PROOF_COVERAGE.md`

### P3-3. ทำ launch checklist และ go-live gate ที่ enforce ได้

- ประเภท: `ต้องเพิ่ม`
- ทำอะไร:
  - security gate
  - billing gate
  - runtime gate
  - support readiness gate
  - localization gate

## รายการที่ควรเริ่มทำก่อน 10 ข้อ

1. เปลี่ยน `console-agent` debt ให้เป็น `Delivery Agent` boundary ที่สะอาดจริง
2. ตัด production dependency กับ `owner-ui-prototype`
3. เข้ารหัสหรือ hash secrets ที่ยังเก็บตรง
4. เพิ่ม distributed rate limiting และ abuse detection
5. ทำ signup -> preview -> checkout -> tenant activation -> agent activation ให้จบครบ
6. ทำ identity verification journey ระหว่าง email / Discord / Steam / in-game
7. ล้าง mojibake และเก็บ locale coverage ทั้ง EN/TH
8. เพิ่ม stuck job / retry / dead-letter tooling
9. ทำ installer/update/rollback path ของ Delivery Agent และ Server Bot
10. ทำ live alerting / diagnostics / recovery workflow ให้ทีมปฏิบัติการใช้ได้จริง

## Final Recommendation

- ถ้าจะทำให้โปรเจคนี้ "พร้อมขาย" จริง ต้องเริ่มจาก `P0` ทั้งหมดก่อน
- ถ้าจะทำให้โปรเจคนี้ "พร้อมใช้งานภายในแบบจริงจัง" ให้ทำ `P0 + P1`
- ถ้าจะทำให้เป็น "commercial-ready managed service" ต้องมี `P0 + P1 + P2` และมี live environment proof รองรับ
