# คู่มือปฏิบัติการ SCUM TH Platform

อัปเดตล่าสุด: **2026-03-25**

เอกสารนี้เป็นคู่มือปฏิบัติการหลักสำหรับ owner และ operator ที่ต้องดูแลระบบจริงบนเครื่องหรือ environment เป้าหมาย

เอกสารที่เกี่ยวข้อง:

- ภาพรวมระบบ: [../README.md](../README.md)
- Quickstart: [OPERATOR_QUICKSTART.md](./OPERATOR_QUICKSTART.md)
- Env reference: [ENV_REFERENCE_TH.md](./ENV_REFERENCE_TH.md)
- Production env gap: [PRODUCTION_ENV_GAP_TH.md](./PRODUCTION_ENV_GAP_TH.md)
- สถาปัตยกรรม: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Runtime boundary: [RUNTIME_BOUNDARY_EXPLAINER.md](./RUNTIME_BOUNDARY_EXPLAINER.md)
- นโยบาย restore/rollback: [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)

## 1. โครง runtime ปัจจุบัน

ระบบแบ่ง runtime หลักดังนี้:

1. `bot`
2. `worker`
3. `watcher`
4. `admin web`
5. `player portal`
6. `console-agent` แบบ optional

route หลักของเว็บ:

- owner: `/owner`
- server admin: `/tenant`
- player: `/player`
- legacy fallback: `/admin/legacy`

## 2. คำสั่งตรวจ baseline

ก่อนแตะ production หรือหลังแก้ config สำคัญ ให้ใช้ baseline นี้:

```bash
npm run doctor
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
```

คำสั่งเสริมที่ควรรันเมื่อต้องแตะ secret หรือ topology:

```bash
npm run security:rotation:check
npm run doctor:topology:prod
```

## 3. Health endpoints

- bot: `http://127.0.0.1:3210/healthz`
- worker: `http://127.0.0.1:3211/healthz`
- watcher: `http://127.0.0.1:3212/healthz`
- console-agent: `http://127.0.0.1:3213/healthz`
- admin web: `http://127.0.0.1:3200/healthz`
- player portal: `http://127.0.0.1:3300/healthz`

## 4. Admin web baseline

ค่า production ที่ควรใช้:

```env
ADMIN_WEB_ALLOWED_ORIGINS=https://admin.example.com
ADMIN_WEB_SECURE_COOKIE=true
ADMIN_WEB_HSTS_ENABLED=true
ADMIN_WEB_TRUST_PROXY=true
ADMIN_WEB_SESSION_COOKIE_PATH=/
ADMIN_WEB_2FA_ENABLED=true
ADMIN_WEB_STEP_UP_ENABLED=true
ADMIN_WEB_LOCAL_RECOVERY=false
```

หมายเหตุ:

- route หลักตอนนี้คือ `/owner` และ `/tenant`
- `/admin` ยังใช้เป็น entry/compatibility path ได้ แต่ไม่ใช่ primary operator surface
- `ADMIN_WEB_SESSION_COOKIE_PATH` ต้องเป็น `/` ไม่ใช่ `/admin`

## 5. Player portal baseline

```env
WEB_PORTAL_BASE_URL=https://player.example.com
WEB_PORTAL_LEGACY_ADMIN_URL=https://admin.example.com/admin
WEB_PORTAL_SECURE_COOKIE=true
WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true
WEB_PORTAL_DISCORD_REDIRECT_PATH=/auth/discord/callback
```

## 6. Delivery modes

### RCON mode

ใช้เมื่อ server รองรับ remote command ตรง:

```env
DELIVERY_EXECUTION_MODE=rcon
RCON_HOST=127.0.0.1
RCON_PORT=27015
RCON_PASSWORD=...
```

### Agent mode

ใช้เมื่อ delivery ต้องผ่าน SCUM client หรือ console-agent:

```env
DELIVERY_EXECUTION_MODE=agent
SCUM_CONSOLE_AGENT_BASE_URL=http://127.0.0.1:3213
SCUM_CONSOLE_AGENT_TOKEN=...
SCUM_CONSOLE_AGENT_EXEC_TEMPLATE=...
```

ข้อจำกัด:

- agent mode ยังพึ่ง Windows session และ SCUM client จริง
- ห้ามอ้างว่างานนี้เสร็จทุก environment ถ้ายังไม่มี live proof จากเครื่องปลายทางจริง

## 7. Database และ runtime-data

production baseline:

```env
DATABASE_PROVIDER=postgresql
PRISMA_SCHEMA_PROVIDER=postgresql
PERSIST_REQUIRE_DB=true
PERSIST_LEGACY_SNAPSHOTS=false
```

หมายเหตุ:

- mutable runtime state และ PostgreSQL runtime dumps ไม่ควรถูก track ใน repo
- ถ้าตั้ง `BOT_DATA_DIR` เอง ระบบจะใช้ path นั้น
- ถ้าไม่ตั้ง:
  - local/dev แบบไม่บังคับ DB-only จะใช้ `./data`
  - production หรือ `PERSIST_REQUIRE_DB=true` จะใช้ external OS-managed state dir อัตโนมัติ

## 8. owner / server admin / player role split

- `Owner`
  - ดู tenant ทั้งระบบ
  - runtime, security, recovery, commercial
  - ใช้ตรวจ incident และกำหนด policy ระดับแพลตฟอร์ม
- `Server Admin`
  - ดูแลเฉพาะ tenant หรือเซิร์ฟเวอร์ของลูกค้า
  - commerce, delivery, support, config
- `Player`
  - wallet, orders, redeem, profile, Steam link

## 9. Agent role และ scope

ระบบตอนนี้แยกภาพ agent ในหน้า owner/admin ได้ชัดขึ้น:

- `Sync agent`
  - เส้นทางอ่านเท่านั้น
  - อ่าน log/state และส่งกลับ control plane
- `Execute agent`
  - เส้นทางเขียน/สั่งงานเท่านั้น
  - รับ job แล้วสั่งงานหรือส่งของ
- `Hybrid agent`
  - เส้นทางอ่าน + เขียน
  - ใช้เมื่อ runtime เดียวรับทั้ง sync และ execute

owner สามารถเปิดหน้า runtime เพื่อตรวจ role/scope เหล่านี้ได้จากในเว็บโดยตรง

## 10. Discord admin-log language

owner สามารถเปลี่ยนภาษา Discord ops alerts จากในเว็บได้ที่:

- `/owner#control`
- field: `Discord admin-log language`

สิ่งที่เปลี่ยน:

- ข้อความ owner-facing ใน `#admin-log`
- persist ลง control-panel env key `ADMIN_LOG_LANGUAGE`

## 11. PM2 และการรันระบบ

รันทีละตัว:

```bash
npm run start:bot
npm run start:worker
npm run start:watcher
npm run start:web-standalone
npm run start:scum-agent
```

รันผ่าน PM2:

```bash
npm run pm2:start:prod
npm run pm2:reload:prod
```

## 12. ข้อจำกัดที่ยังต้องยอมรับ

- native proof ยังต้องเก็บเพิ่มในหลาย environment
- console-agent ยังขึ้นกับ Windows session และ SCUM client
- restore/rollback ยังเป็น guarded flow ไม่ใช่ automatic rollback เต็มรูปแบบ
- admin config control ยังครอบคลุมไม่ทุก setting

## 13. สิ่งที่ต้องทำต่อสำหรับ 4 ก้อนใหญ่ที่ยังไม่ปิด

### 13.1 Native proof หลาย environment

- ต้องมีอย่างน้อย:
  - environment ปัจจุบันที่ผ่านแล้ว
  - server configuration อีกชุดที่ยืนยันซ้ำได้จริง
  - workstation/runtime อีกเครื่องที่มี live capture จริง
- ใช้เอกสารหลัก:
  - [DELIVERY_NATIVE_PROOF_COVERAGE.md](./DELIVERY_NATIVE_PROOF_COVERAGE.md)
  - [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
- ห้ามเคลมว่า proof ครบหลาย environment ถ้ายังไม่มีหลักฐานเพิ่มใน `docs/assets/live-native-proof-*`

### 13.2 Console-agent dependency

- ให้ถือเป็นข้อเท็จจริงเชิง runtime ว่า execute path ยังพึ่ง:
  - Windows interactive session
  - SCUM client หรือหน้าต่างที่เกี่ยวข้อง
- สิ่งที่ควรทำให้ครบใน environment จริง:
  - health endpoint ตอบได้
  - token ถูกตั้งถูกต้อง
  - preflight ผ่าน
  - operator รู้ว่าห้าม lock session
  - มีการเก็บ evidence ของการ recover หลัง agent/offline event

### 13.3 Restore / rollback maturity

- ก่อนถือว่าพร้อมระดับ production ต้องมี:
  - preview diff
  - maintenance gate
  - rollback backup
  - post-restore validation
  - restore drill ที่มีบันทึกหลักฐาน
- เอกสารหลัก:
  - [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
  - [GO_LIVE_CHECKLIST_TH.md](./GO_LIVE_CHECKLIST_TH.md)

### 13.4 Centralized config coverage

- ตอนนี้ owner control ครอบคลุม env หลักของ:
  - admin
  - portal
  - delivery
  - watcher
  - sync/control-plane routing
- แต่ยังไม่ควรถือว่าครอบคลุม “ทุก key” จนกว่าจะ:
  - มี policy ชัดทุก key
  - มี validation/restart guidance ครบ
  - ผ่าน review ว่า key นั้นปลอดภัยพอจะเปิดใน UI

## 14. เช็กลิสต์ก่อนประกาศว่า production พร้อม

1. `doctor`, `security:check`, `readiness:prod`, `smoke:postdeploy` ผ่าน
2. ใช้ PostgreSQL runtime จริง
3. ปิด local recovery
4. เปิด 2FA และ step-up
5. ใช้ HTTPS origins จริง
6. เก็บ evidence ของ delivery/runtime/restore ตาม environment เป้าหมาย
7. ถ้าใช้ `SCUM_SYNC_TRANSPORT=control-plane` หรือ `dual` ต้องยืนยัน:
   - `SCUM_SYNC_CONTROL_PLANE_URL`
   - `SCUM_SYNC_AGENT_TOKEN`
   - `SCUM_TENANT_ID`
   - `SCUM_SERVER_ID`
8. ถ้าใช้ `DELIVERY_EXECUTION_MODE=agent` ต้องยืนยัน:
   - `SCUM_CONSOLE_AGENT_BASE_URL`
   - `SCUM_CONSOLE_AGENT_TOKEN`
   - live Windows session พร้อมใช้งานจริง
