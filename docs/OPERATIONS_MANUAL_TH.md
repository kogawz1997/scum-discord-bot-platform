# คู่มือใช้งานและตั้งค่าระบบ SCUM TH Bot

คู่มือนี้เป็นคู่มือปฏิบัติการหลักของโปรเจกต์ ใช้สำหรับ:

- ติดตั้งระบบครั้งแรก
- ตั้งค่า `.env`
- รันแบบแยก `bot / worker / watcher / web / console-agent`
- ตั้งค่า `agent mode` สำหรับส่งของอัตโนมัติใน SCUM
- ใช้งาน Admin Web / Player Portal
- ทดสอบระบบจริง
- แก้ปัญหาที่เจอบ่อย

ถ้าต้องการดูภาพรวมโครงการและ roadmap ให้ดู [PROJECT_HQ.md](../PROJECT_HQ.md)

---

## 1. ภาพรวมระบบ

โปรเจกต์นี้มี runtime หลักดังนี้

1. `bot`
- Discord bot หลัก
- คำสั่ง slash/button/modal
- economy, shop, VIP, ticket, bounty, event

2. `worker`
- งาน background
- auto delivery
- rent bike queue
- retry/dead-letter/watchdog

3. `watcher`
- อ่าน `SCUM.log`
- parse join / leave / kill / restart
- ส่งเข้า webhook ของบอท

4. `admin web`
- เว็บแอดมินหลัก
- config / audit / backup / observability / delivery tools

5. `player portal standalone`
- เว็บผู้เล่น login ผ่าน Discord
- dashboard / shop / order / wallet / redeem

6. `console agent`
- bridge สำหรับยิงคำสั่งในเกม SCUM ผ่าน admin client ที่เปิดค้างไว้
- ใช้เมื่อ `BattlEye RCon` login ได้แต่ `#SpawnItem` ไม่ execute จริง

---

## 2. โหมดส่งของที่รองรับ

ระบบส่งของรองรับ 2 แบบ

### 2.1 `rcon` mode

ใช้:

- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD`
- `RCON_PROTOCOL`

เหมาะเมื่อเซิร์ฟเวอร์รับคำสั่ง `#SpawnItem` ผ่าน remote command ได้จริง

### 2.2 `agent` mode

ใช้:

- worker
- local console agent
- SCUM client จริงที่ล็อกอินด้วยบัญชีแอดมิน

flow:

```text
Purchase
-> Delivery Queue
-> Worker
-> Console Agent
-> SCUM Admin Client
-> #Teleport / #SpawnItem / #Announce
```

สถานะปัจจุบันของเครื่องนี้:

- `BattlEye RCon` ใช้เช็ก transport ได้
- แต่การส่งของจริงใช้ `agent mode`

---

## 3. สิ่งที่ต้องมีล่วงหน้า

### 3.1 ฝั่ง Node/ระบบ

- Node.js 20+
- npm
- Windows ถ้าจะใช้ `agent mode` แบบ admin client
- SQLite / Prisma ใช้งานได้

### 3.2 ฝั่ง Discord

- Bot token
- Client ID
- Guild ID

### 3.3 ฝั่ง SCUM

- SCUM Dedicated Server
- access ไปยัง `SCUM.log`
- ถ้าใช้ `agent mode`:
  - เปิดเกม SCUM client จริง
  - ล็อกอินด้วยบัญชีแอดมิน
  - อยู่ในเซิร์ฟเวอร์ค้างไว้

---

## 4. ไฟล์ `.env` ที่ต้องรู้

### 4.1 root `.env`

ไฟล์หลักของระบบทั้งหมดอยู่ที่:

- [`.env`](../.env)

ไฟล์ตัวอย่าง:

- [`.env.example`](../.env.example)
- [`.env.production.example`](../.env.production.example)

### 4.2 player portal `.env`

อยู่ที่:

- [`apps/web-portal-standalone/.env`](../apps/web-portal-standalone/.env)

ไฟล์ตัวอย่าง:

- [`apps/web-portal-standalone/.env.example`](../apps/web-portal-standalone/.env.example)
- [`apps/web-portal-standalone/.env.production.example`](../apps/web-portal-standalone/.env.production.example)

---

## 5. ค่าหลักใน root `.env`

### 5.1 Discord

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
```

### 5.2 Database

```env
DATABASE_URL="file:./prisma/dev.db"
PERSIST_REQUIRE_DB=true
PERSIST_LEGACY_SNAPSHOTS=false
```

production ควรใช้:

- `PERSIST_REQUIRE_DB=true`
- `PERSIST_LEGACY_SNAPSHOTS=false`

### 5.3 SCUM watcher / webhook

```env
SCUM_LOG_PATH=C:\\Path\\To\\SCUM.log
SCUM_WEBHOOK_PORT=3100
SCUM_WEBHOOK_SECRET=
SCUM_WEBHOOK_URL=http://127.0.0.1:3100/scum-event
```

### 5.4 Runtime split

ค่าที่แนะนำเมื่อแยก process:

```env
BOT_ENABLE_SCUM_WEBHOOK=true
BOT_ENABLE_RESTART_SCHEDULER=true
BOT_ENABLE_ADMIN_WEB=true
BOT_ENABLE_RENTBIKE_SERVICE=false
BOT_ENABLE_DELIVERY_WORKER=false
BOT_ENABLE_OPS_ALERT_ROUTE=true

WORKER_ENABLE_RENTBIKE=true
WORKER_ENABLE_DELIVERY=true
```

หมายเหตุ:

- ถ้าใช้ `worker` แยก process แล้ว อย่าเปิด `BOT_ENABLE_DELIVERY_WORKER=true`
- ถ้าเปิดทั้ง bot และ worker พร้อมกัน จะเสี่ยง duplicate runtime

### 5.5 Admin Web

```env
ADMIN_WEB_HOST=127.0.0.1
ADMIN_WEB_PORT=3200
ADMIN_WEB_ALLOWED_ORIGINS=https://genz.noah-dns.online
ADMIN_WEB_SECURE_COOKIE=true
ADMIN_WEB_TRUST_PROXY=true
```

### 5.6 Delivery แบบ `agent mode`

ค่าหลัก:

```env
DELIVERY_EXECUTION_MODE=agent

SCUM_CONSOLE_AGENT_HOST=127.0.0.1
SCUM_CONSOLE_AGENT_PORT=3213
SCUM_CONSOLE_AGENT_TOKEN=put_a_strong_agent_token_here
SCUM_CONSOLE_AGENT_BACKEND=exec
SCUM_CONSOLE_AGENT_COMMAND_TIMEOUT_MS=15000

DELIVERY_AGENT_COMMAND_DELAY_MS=600
DELIVERY_AGENT_POST_TELEPORT_DELAY_MS=2000

DELIVERY_AGENT_TELEPORT_MODE=vehicle
DELIVERY_AGENT_TELEPORT_TARGET=50118
DELIVERY_AGENT_RETURN_TARGET=

DELIVERY_AGENT_PRE_COMMANDS_JSON=["#TeleportToVehicle {teleportTargetRaw}"]
DELIVERY_AGENT_POST_COMMANDS_JSON=[]
```

ค่าของ bridge script:

```env
SCUM_CONSOLE_AGENT_EXEC_TEMPLATE=powershell -NoProfile -ExecutionPolicy Bypass -File scripts/send-scum-admin-command.ps1 -WindowTitle "SCUM" -SwitchToAdminChannel -AdminChannelTabs 3 -Command "{command}"
```

ความหมาย:

- `DELIVERY_AGENT_COMMAND_DELAY_MS`
  - delay ปกติระหว่างคำสั่ง
- `DELIVERY_AGENT_POST_TELEPORT_DELAY_MS`
  - delay พิเศษหลังคำสั่ง teleport ก่อนเริ่ม spawn
- `DELIVERY_AGENT_TELEPORT_MODE=vehicle`
  - ให้ใช้ `#TeleportToVehicle`
- `DELIVERY_AGENT_TELEPORT_TARGET=50118`
  - จุดส่งของคงที่

---

## 6. การติดตั้งครั้งแรก

### 6.1 Windows แบบเร็ว

```bat
npm run setup:easy
```

หรือดับเบิลคลิก `setup-easy.cmd`

### 6.2 แบบ manual

```bat
npm install
copy .env.example .env
copy apps\web-portal-standalone\.env.example apps\web-portal-standalone\.env
npx prisma generate --schema prisma\schema.prisma
npx prisma db push --schema prisma\schema.prisma
```

ถ้าเป็น production:

```bat
copy .env.production.example .env
copy apps\web-portal-standalone\.env.production.example apps\web-portal-standalone\.env
```

---

## 7. การรันระบบ

### 7.1 รันแยกด้วย npm

```bat
npm run start:bot
npm run start:worker
npm run start:watcher
npm run start:web-standalone
npm run start:scum-agent
```

### 7.2 รันด้วย PM2

```bat
npm run pm2:start:prod
```

หรือใช้ helper:

```bat
deploy\start-production-stack.cmd
deploy\reload-production-stack.cmd
deploy\stop-production-stack.cmd
```

### 7.3 ตรวจสถานะ

```bat
pm2 status
```

ควรเห็นอย่างน้อย:

- `scum-bot-local`
- `scum-worker-local`
- `scum-watcher-local`
- `scum-web-portal-local`
- `scum-console-agent-local`

---

## 8. ตั้งค่า SCUM สำหรับ `agent mode`

### 8.1 บัญชีแอดมินในเกม

ต้องมี SteamID ของบัญชีแอดมินใน:

- `AdminUsers.ini`
- ถ้าต้องการสิทธิ์แก้ setting ผ่านตัวละครด้วย ให้ใส่ใน `ServerSettingsAdminUsers.ini`

ตัวอย่าง:

```ini
7656119XXXXXXXXXX[GodMode]
```

หลังแก้ไฟล์:

- `rejoin` หรือ
- `restart server`

อย่างน้อย 1 รอบ

### 8.2 admin client ที่เปิดค้างไว้

ต้องมี SCUM client จริงเปิดค้างอยู่ โดย:

1. ล็อกอินด้วยบัญชีแอดมิน
2. เข้าเซิร์ฟเวอร์เดียวกับที่ต้องการส่งของ
3. เปิด `Admin channel`
4. อย่าเอาเครื่องไปใช้พิมพ์งานอื่นระหว่าง worker ส่งของ

### 8.3 พฤติกรรมของ bridge script ตอนนี้

สคริปต์ [send-scum-admin-command.ps1](../scripts/send-scum-admin-command.ps1) ทำงานแบบนี้:

1. โฟกัสหน้าต่าง `SCUM`
2. กดปุ่มเปิด input
3. ถ้าตั้ง `SwitchToAdminChannel` จะกด `TAB` ตามจำนวน `AdminChannelTabs`
4. ล้างข้อความเดิมในช่อง
5. วางคำสั่งจาก clipboard
6. submit ตามชนิดคำสั่ง

logic submit ปัจจุบัน:

- `#Announce` -> `Enter` 2 รอบ
- `#SpawnItem` -> `Enter` 2 รอบ
- `#TeleportTo` / `#TeleportToVehicle` -> `Enter` 1 รอบ

เหตุผล:

- `announce/spawn` ต้องการรอบปิดแชตเพิ่ม
- `teleport` ถ้ากด 2 รอบอาจทำให้พฤติกรรมไม่เสถียร

---

## 9. การทดสอบระบบส่งของจริง

### 9.1 ทดสอบ command ตรงผ่าน agent

ประกาศ:

```bat
npm run scum:agent:exec -- --command "#Announce TEST-ANNOUNCE"
```

วาร์ปไปจุดส่งของ:

```bat
npm run scum:agent:exec -- --command "#TeleportToVehicle 50118"
```

เสกไอเทม:

```bat
npm run scum:agent:exec -- --command "#SpawnItem Weapon_M1911 1"
```

### 9.2 ทดสอบหลายไอเทมคนละชนิด

ตัวอย่างที่ทดสอบผ่านในเครื่องนี้:

```text
#TeleportToVehicle 50118
#SpawnItem Weapon_M1911 1
#SpawnItem Magazine_M1911 2
#SpawnItem Cal_45_Ammobox 1
```

ผลที่คาดหวัง:

1. วาร์ปไปที่รถ `50118`
2. ได้ `Weapon_M1911`
3. ได้ `Magazine_M1911 x2`
4. ได้ `Cal_45_Ammobox x1`

### 9.3 ทดสอบผ่านระบบซื้อจริง

ลำดับที่ถูก:

1. เปิด admin client ค้างไว้
2. worker online
3. queue ว่าง
4. สร้าง/เลือกสินค้าในร้าน
5. ซื้อสินค้า
6. ดูใน Admin Web:
   - `Delivery Runtime`
   - `Queue`
   - `Dead-letter`
   - `Command Log`

---

## 10. Delivery Profile ของสินค้า

สินค้า item รองรับ profile ต่อรายการ:

### 10.1 `spawn_only`

ยิงเฉพาะ:

```text
#SpawnItem ...
```

### 10.2 `teleport_spawn`

ยิง:

```text
#TeleportTo...
#SpawnItem ...
```

### 10.3 `announce_teleport_spawn`

ยิง:

```text
#Announce ...
#TeleportTo...
#SpawnItem ...
```

### 10.4 Teleport mode

รองรับ 2 แบบ:

1. `player`
- ใช้ `#TeleportTo "{teleportTarget}"`

2. `vehicle`
- ใช้ `#TeleportToVehicle {teleportTargetRaw}`

### 10.5 ค่าที่ตั้งระดับสินค้าได้

- `deliveryProfile`
- `deliveryTeleportMode`
- `deliveryTeleportTarget`
- `deliveryReturnTarget`
- `deliveryPreCommands`
- `deliveryPostCommands`

---

## 11. การใช้งาน Admin Web

เข้าแอดมิน:

- `http://127.0.0.1:3200/admin`
- หรือโดเมน production ของคุณ

สิ่งที่หน้าแอดมินทำได้:

1. ดู runtime
2. ดู queue ส่งของ
3. ดู dead-letter
4. preview คำสั่งส่งของ
5. test send
6. ดู `commandSummary`
7. retry / cancel / delete jobs
8. ดู Audit Center
9. export CSV / JSON / snapshot
10. backup / restore

### 11.1 Audit Center

รองรับ:

- `search`
- `user`
- `reason`
- `actor`
- `reference`
- `status`
- `dateFrom`
- `dateTo`
- `window`
- exact match mode
- sort / order
- page / cursor
- saved presets

---

## 12. การใช้งาน Player Portal

โปรเจกต์เว็บผู้เล่นอยู่ที่:

- [`apps/web-portal-standalone`](../apps/web-portal-standalone)

ความสามารถหลัก:

- login ผ่าน Discord
- dashboard ผู้เล่น
- shop
- wallet
- order history
- redeem
- mission/reward

รัน:

```bat
npm run start:web-standalone
```

คู่มือแยก:

- [apps/web-portal-standalone/README.md](../apps/web-portal-standalone/README.md)

---

## 13. Health Check และ Doctor

### 13.1 doctor

```bat
npm run doctor
npm run doctor:topology:prod
npm run doctor:web-standalone:prod
```

### 13.2 readiness

```bat
npm run readiness:prod
```

### 13.3 smoke test

```bat
npm run smoke:postdeploy
```

### 13.4 health endpoints

- bot: `/healthz`
- worker: `http://127.0.0.1:3211/healthz`
- console agent: `http://127.0.0.1:3213/healthz`

---

## 14. ปัญหาที่เจอบ่อย

### 14.1 ของไม่เข้าเกม

เช็กตามนี้:

1. SCUM admin client เปิดอยู่หรือไม่
2. อยู่ใน server ถูกตัวหรือไม่
3. ช่องอยู่ที่ `Admin` หรือไม่
4. `scum-worker-local` online หรือไม่
5. `scum-console-agent-local` online หรือไม่
6. item ใช้ `gameItemId` canonical ถูกหรือไม่ เช่น `Weapon_M1911`
7. ถ้าใช้ teleport ก่อน spawn ให้เช็กว่า target มีอยู่จริง

### 14.2 คำสั่งไปลงแชตโลก

สาเหตุ:

- `AdminChannelTabs` ไม่ตรงกับ client นี้

วิธีแก้:

- ปรับ `-AdminChannelTabs` ใน `SCUM_CONSOLE_AGENT_EXEC_TEMPLATE`
- ทดสอบ `#Announce TEST` จนแน่ใจว่าไปเป็นประกาศจริง

### 14.3 วาร์ปได้ แต่เสกไม่เข้า

สาเหตุที่เจอบ่อย:

- delay หลัง teleport สั้นเกินไป

วิธีแก้:

- เพิ่ม `DELIVERY_AGENT_POST_TELEPORT_DELAY_MS`

### 14.4 มีตัว `t#...` หลุดในแชต

สาเหตุ:

- แชตค้าง/open state ไม่ตรง
- กดปุ่มเปิด input ซ้ำตอนช่องยังเปิด

วิธีแก้:

- คง logic ล้าง input ก่อน paste
- อย่าใช้งานคีย์บอร์ดเครื่อง agent ระหว่าง worker ทำงาน

### 14.5 PM2 บน Windows เจอ `wmic ENOENT`

ให้ติดตั้ง Windows capability `WMIC`

ตัวอย่าง PowerShell:

```powershell
Add-WindowsCapability -Online -Name "WMIC~~~~0.0.1.0"
```

### 14.6 Prisma schema หาไม่เจอ

ใช้:

```bat
npx prisma generate --schema prisma\schema.prisma
```

และให้รันคำสั่งจาก root ของโปรเจกต์

---

## 15. คำสั่งที่ใช้บ่อย

### ติดตั้ง

```bat
npm install
npx prisma generate --schema prisma\schema.prisma
npx prisma db push --schema prisma\schema.prisma
```

### รัน

```bat
npm run start:bot
npm run start:worker
npm run start:watcher
npm run start:web-standalone
npm run start:scum-agent
```

### PM2

```bat
npm run pm2:start:prod
npm run pm2:reload:prod
pm2 status
```

### ทดสอบ

```bat
npm run lint
npm test
```

### ส่งคำสั่งเข้า SCUM admin client

```bat
npm run scum:agent:exec -- --command "#Announce TEST"
npm run scum:agent:exec -- --command "#TeleportToVehicle 50118"
npm run scum:agent:exec -- --command "#SpawnItem Weapon_M1911 1"
```

### ตรวจ SCUM instance

```bat
npm run scum:audit
```

---

## 16. ค่าที่แนะนำสำหรับ production

```env
NODE_ENV=production
PERSIST_REQUIRE_DB=true
PERSIST_LEGACY_SNAPSHOTS=false
BOT_ENABLE_DELIVERY_WORKER=false
WORKER_ENABLE_DELIVERY=true
WORKER_ENABLE_RENTBIKE=true
DELIVERY_EXECUTION_MODE=agent
DELIVERY_AGENT_COMMAND_DELAY_MS=600
DELIVERY_AGENT_POST_TELEPORT_DELAY_MS=2000
ADMIN_WEB_SECURE_COOKIE=true
ADMIN_WEB_TRUST_PROXY=true
```

และต้อง:

- หมุน secret ทุกตัวเป็นค่าจริง
- ตั้ง Discord OAuth redirect ให้ตรงโดเมนจริง
- รัน `doctor` และ `readiness:prod` ให้ผ่านก่อนปล่อยจริง

---

## 17. เอกสารที่เกี่ยวข้อง

- [README.md](../README.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [docs/DEPLOYMENT_STORY.md](./DEPLOYMENT_STORY.md)
- [apps/web-portal-standalone/README.md](../apps/web-portal-standalone/README.md)

