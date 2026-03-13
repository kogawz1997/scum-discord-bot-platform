# SCUM TH Bot
Discord + SCUM Server Operations Platform

![Node.js](https://img.shields.io/badge/Node.js-20%2B-2f7d32?style=for-the-badge&logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-v14.25.1-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Tests](https://img.shields.io/badge/tests-82%2F82%20passing-15803d?style=for-the-badge)
![Security](https://img.shields.io/badge/security%20check-passed-0f766e?style=for-the-badge)

ระบบบอท Discord สำหรับเซิร์ฟเวอร์ SCUM ที่รวม Economy, Shop, Auto Delivery, Ticket, Admin Web และ Observability ไว้ในโปรเจกต์เดียว

เอกสารสถานะเชิงลึก: [PROJECT_HQ.md](./PROJECT_HQ.md)

คู่มือใช้งานและตั้งค่าหลัก: [docs/OPERATIONS_MANUAL_TH.md](./docs/OPERATIONS_MANUAL_TH.md)

---

## ฟีเจอร์หลัก

- Economy + Wallet + Daily/Weekly
- Shop + Cart + Purchase + Inventory
- Shop/VIP ใช้ service กลางพร้อม rollback และ partial refund ใน cart checkout
- Auto Delivery ผ่าน RCON queue (retry + dead-letter + audit + watchdog)
- Rent Bike รายวัน (1 ครั้ง/วัน/คน + reset/cleanup)
- Ticket / Event / Bounty / Giveaway / VIP / Redeem
- Kill feed แบบ realtime (weapon + distance + hit-zone)
- Admin Web (RBAC owner/admin/mod, login จาก DB, backup/restore, live updates)
- Admin Web มี Audit Center แยกดูย้อนหลัง `wallet / reward / event` พร้อม deep filters `search / user / actor / reason / reference / status / date-from / date-to / window`, exact-match mode (`actor / reference / status`), sort/order, pagination (`page + cursor`) และ saved presets แบบแชร์ผ่าน DB พร้อม visibility `private / role / public`
- Audit/Snapshot/Observability export ทำฝั่ง server ได้โดยตรง (`CSV / JSON / snapshot export`) สำหรับข้อมูลก้อนใหญ่
- Dashboard cards ฝั่งแอดมินใช้ aggregate endpoint แยก (`/admin/api/dashboard/cards`) เพื่อลดการพึ่ง snapshot ก้อนใหญ่สำหรับตัวเลขสรุป
- Player Portal Web แยก (`/player`) สำหรับผู้เล่น (dashboard + shop + inventory + quick actions)
- Observability (metrics time-series, ops alerts, `/healthz`, server-side export)

---

## สถาปัตยกรรมย่อ

```mermaid
flowchart LR
  A[SCUM.log] --> B[Watcher]
  B --> C[Webhook /scum-event]
  C --> D[Discord Bot]
  D --> E[Discord Channels]
  D --> F[(SQLite/Prisma + Persist)]
  G[Admin Dashboard] --> H[Admin API]
  H --> F
  H --> D
  D --> I[RCON Delivery Queue]
```

รายละเอียดเชิงลึกของ runtime split/health checks:
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Quick Start

### ติดตั้งแบบง่าย (Windows, แนะนำ)

รันครั้งเดียวที่โฟลเดอร์โปรเจกต์:

```bash
npm run setup:easy
```

หรือดับเบิลคลิกไฟล์ `setup-easy.cmd`

สคริปต์จะทำให้:

- สร้าง `.env` อัตโนมัติจาก `.env.example` ถ้ายังไม่มี
- สร้าง `apps/web-portal-standalone/.env` อัตโนมัติถ้ายังไม่มี
- ติดตั้ง dependencies (`npm install`)
- `prisma generate` + `prisma db push`

### 1) ติดตั้ง

```bash
npm install
copy .env.example .env
```

ถ้าจะตั้ง production ตั้งต้นจากไฟล์นี้:

```bash
copy .env.production.example .env
```

### 2) ตั้งค่า `.env`

ค่าจำเป็นขั้นต่ำ:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `SCUM_LOG_PATH`
- `SCUM_WEBHOOK_SECRET`
- `DATABASE_URL` (เช่น `file:./prisma/dev.db`)

### ตั้งค่า Auto Spawn จากไฟล์ Wiki/Manifest (ใหม่)

ระบบส่งของรองรับการ map คำสั่งเสกของอัตโนมัติจาก 2 แหล่ง:

- `scum_weapons_from_wiki.json` (อาวุธ + spawn command example)
- `scum_item_category_manifest.json` (ทุกหมวด + spawn format กลาง)

- ถ้ามี `itemCommands` ตรงกับ `itemId` หรือ `gameItemId` ระบบจะใช้ค่านั้นก่อน
- ถ้าไม่เจอ ระบบจะ fallback ไปใช้ `spawn_command_example` จากไฟล์อาวุธ wiki
- ถ้าไม่เจออีก ระบบจะ fallback ไปใช้ template กลางจาก manifest (`#SpawnItem <Item_ID>`)
- ระบบจะแมส `gameItemId/spawn_id` กับ icon จาก `scum_items-main` อัตโนมัติ (ใช้ได้ทั้ง Discord และเว็บ)
- ถ้าต้องการบังคับใช้ไฟล์ไอคอนที่มีในเครื่อง:
  - ตั้ง `SCUM_ITEMS_IGNORE_INDEX_URL=true`
  - ตั้ง `SCUM_ITEMS_BASE_URL` เป็น URL static ของไฟล์จริง เช่น `http://127.0.0.1:3200/assets/scum-items/` หรือโดเมน production ของคุณ
  - ระบบรองรับ route static ไอคอน:
    - Admin web: `/assets/scum-items/<filename>` และ `/admin/assets/scum-items/<filename>`
    - Player portal standalone: `/assets/scum-items/<filename>` และ `/player/assets/scum-items/<filename>`

ปรับพฤติกรรมได้ที่ config:

- `delivery.auto.wikiWeaponCommandFallbackEnabled` (`true`/`false`)
- `delivery.auto.itemManifestCommandFallbackEnabled` (`true`/`false`)

ทดสอบคำสั่งเสกก่อนต่อ RCON จริง:

```bash
npm run preview:spawn -- --item-id vip-7d
npm run preview:spawn -- --game-item-id Weapon_M1911 --quantity 1
```

สคริปต์นี้จะแสดง 2 แบบ:

- คำสั่งสำหรับ dedicated server / RCON
- คำสั่งสำหรับ single-player console

หมายเหตุ:

- single-player ใช้ทดสอบ “รูปแบบคำสั่งเสก” ได้
- แต่ไม่ใช่การทดสอบ RCON transport จริง
- การส่งของจริงยังต้องมี SCUM Dedicated Server + RCON + worker
- ถ้าเซิร์ฟเวอร์ SCUM ใช้ BattlEye RCon ให้ตั้ง:
  - `RCON_PROTOCOL=battleye`
  - `RCON_PORT=<RConPort ใน BEServer_x64.cfg>`

### Agent Mode: Admin client คาไว้ (ใหม่)

กรณี `BattlEye RCon login ได้ แต่ #SpawnItem ไม่ถูก execute` ให้สลับ worker ไปใช้
`agent mode` แทน โดย flow จะเป็น:

```text
delivery worker
-> local console agent
-> admin client / bridge script
-> SCUM
```

ฝั่งแอดมินมีเครื่องมือช่วยตรวจระบบส่งของแล้ว:
- `Delivery Runtime`: ดู queue/dead-letter/worker/agent health
- `Delivery Preview`: พรีวิวคำสั่งที่จะยิงจริงจาก `itemId` หรือ `gameItemId`
- ฟอร์ม `เพิ่มสินค้าใหม่`: ตั้ง `Delivery Profile` รายสินค้าได้
  - `Spawn Only`
  - `Teleport + Spawn`
  - `Announce + Teleport + Spawn`
  - ตั้ง `Teleport Mode` เป็น `Player` หรือ `Vehicle`
  - ระบุ `จุดวาร์ปก่อนส่งของ` ได้ เช่นชื่อผู้เล่น, ชื่อรถ, หรือ alias คงที่
  - และใส่ `pre/post commands` แบบ custom ได้ถ้าต้องการ override behavior ราย item

ค่าที่ต้องตั้ง:

- `DELIVERY_EXECUTION_MODE=agent`
- `SCUM_CONSOLE_AGENT_TOKEN=<token ลับ>`
- รัน agent:

```bash
npm run start:scum-agent
```

ถ้าใช้แบบ `admin client คาไว้` บน Windows:

1. เปิดเกม SCUM จริงด้วยบัญชีแอดมิน/โดรน
2. ล็อกอินค้างไว้ในเซิร์ฟเวอร์
3. ตั้ง agent backend เป็น `exec`
4. ใช้ PowerShell bridge ที่แนบมา:

```env
SCUM_CONSOLE_AGENT_BACKEND=exec
SCUM_CONSOLE_AGENT_EXEC_TEMPLATE=powershell -NoProfile -ExecutionPolicy Bypass -File scripts/send-scum-admin-command.ps1 -WindowTitle "SCUM" -SwitchToAdminChannel -AdminChannelTabs 3 -Command "{command}"
```

หมายเหตุ:
- ถ้า command ไปลง `แชตโลก` แทน `Admin` ให้ปรับ `-AdminChannelTabs` ใน template นี้
- ค่าที่ใช้บ่อยคือ `1`, `2`, หรือ `3` ตามลำดับ channel ของเซิร์ฟเวอร์/ตัว client

ถ้าต้องการให้ worker `วาร์ปไปหาผู้เล่นก่อนเสกของ` ใน agent mode:

```env
DELIVERY_AGENT_PRE_COMMANDS_JSON=["#TeleportTo {teleportTargetQuoted}"]
DELIVERY_AGENT_COMMAND_DELAY_MS=600
DELIVERY_AGENT_POST_TELEPORT_DELAY_MS=2000
```

ถ้าต้องการ `วาร์ปไปรถ/alias คงที่ก่อนเสกของ` เพื่อไม่ต้องพึ่งผู้เล่นออนไลน์:

```env
DELIVERY_AGENT_TELEPORT_MODE=vehicle
DELIVERY_AGENT_TELEPORT_TARGET=AdminBike
```

แล้วตั้งสินค้าในแอดมินเป็น:

- `Delivery Profile = Teleport + Spawn`
- `Teleport Mode = Vehicle`
- `จุดวาร์ปก่อนส่งของ = AdminBike`

ถ้าต้องการวาร์ปกลับจุดยืนเดิมของแอดมินหลังส่งของเสร็จ:

```env
DELIVERY_AGENT_RETURN_TARGET=AdminAnchor
DELIVERY_AGENT_POST_COMMANDS_JSON=["#TeleportTo {returnTargetQuoted}"]
```

หมายเหตุ:

- `teleportTarget` จะใช้ลำดับนี้:
  - ค่า `จุดวาร์ปก่อนส่งของ` รายสินค้า
  - ค่า `DELIVERY_AGENT_TELEPORT_TARGET`
  - `ชื่อในเกม (inGameName)` จากระบบ link
- ถ้า profile ต้องใช้ teleport แต่หา target ไม่เจอ ระบบจะ `retry`
- ถ้าตั้ง `Teleport Mode = Vehicle` จะใช้ `#TeleportToVehicle <idOrAlias>` แทน `#TeleportTo`
- `#TeleportTo` เป็นคำสั่งในเกมผ่านแอดมิน client ที่ค้างอยู่ ไม่ใช่ BattlEye RCon command

5. ให้บัญชีในเกมมีสิทธิ์ admin จริงในฝั่ง SCUM server:

- `AdminUsers.ini` เช่น `7656119xxxxxxxxxx[GodMode]`
- ถ้าจะให้แก้ server settings ผ่านตัวละครนี้ด้วย ให้เพิ่ม SteamID ใน `ServerSettingsAdminUsers.ini`
- หลังแก้ไฟล์ ควร `rejoin` หรือ `restart server` อย่างน้อย 1 รอบก่อนทดสอบ

ลองยิงคำสั่งผ่าน agent แบบตรง ๆ:

```bash
npm run scum:agent:exec -- --command "#ListPlayers"
```

ข้อจำกัด:

- session Windows ต้องไม่ locked
- ตัวเกมต้องมี window โฟกัสได้
- วิธีนี้ pragmatic แต่ไม่ robust เท่า server-side API จริง
- agent รองรับ backend `process` แบบทดลองด้วย ถ้าคุณต้องการให้ agent เป็นคน start `SCUMServer.exe` แล้วส่ง command ทาง stdin เอง

ถ้าทดสอบบน Windows และเคยเปิด `SCUMServer.exe` หลายตัว อย่าปล่อยให้หลาย instance ใช้
save directory เดียวกัน เพราะจะเสี่ยงชนพอร์ต, เกิด DB constraint error และ server tick
ค้างได้

ตรวจ instance ที่กำลังรัน:

```bat
npm run scum:audit
```

ลอง cleanup แบบ preview ก่อน:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/scum-instance-cleanup.ps1 -KeepPid 69992 -WhatIf
```

cleanup จริง (รัน PowerShell แบบ Administrator):

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/scum-instance-cleanup.ps1 -KeepPid 69992
```

ตรวจรายการจากไฟล์ผ่าน Admin API:

- `GET /admin/api/items/weapons-catalog?q=&limit=200`
- `GET /admin/api/items/manifest-catalog?q=&category=&limit=300`

### 3) ลงทะเบียน slash commands

```bash
npm run register-commands
```

### 4) รันระบบ

Terminal 1:

```bash
npm start
```

Terminal 2:

```bash
npm run start:watcher
```

Admin Web:

- `http://127.0.0.1:3200/admin/login`

### โหมดแยก process (แนะนำ production)

runtime แต่ละตัวมีหน้าที่ชัดเจน:

- `bot`: Discord commands, admin web, webhook route, restart scheduler, alerts
- `worker`: rent bike + delivery queue worker
- `watcher`: tail `SCUM.log` แล้วส่ง event เข้า webhook
- `web`: player portal standalone

คำสั่งรันแยก:

1. Bot process:

```bash
npm run start:bot
```

2. Worker process:

```bash
npm run start:worker
```

3. SCUM watcher:

```bash
npm run start:watcher
```

4. Web portal แยก:

```bash
npm run start:web-standalone
```

5. SCUM console agent:

```bash
npm run start:scum-agent
npm run scum:agent:exec -- --command "#ListPlayers"
```

ตัวอย่างไฟล์ PM2 สำหรับรันครบชุดอยู่ที่:

- [deploy/pm2.ecosystem.config.cjs](./deploy/pm2.ecosystem.config.cjs)
- [deploy/pm2.scum-agent.config.cjs](./deploy/pm2.scum-agent.config.cjs)

รันด้วย PM2:

```bash
npm run pm2:start:prod
pm2 status
pm2 logs scum-bot
```

reload env/runtime หลังปรับ `.env`:

```bash
npm run pm2:reload:prod
```

Windows helper แบบคลิกเดียว:

```bat
deploy\start-production-stack.cmd
deploy\reload-production-stack.cmd
deploy\stop-production-stack.cmd
```

### โหมด Docker (production-ready)

มีไฟล์พร้อมใช้:

- [Dockerfile](./Dockerfile)
- [deploy/docker-compose.production.yml](./deploy/docker-compose.production.yml)

รัน:

```bash
docker compose -f deploy/docker-compose.production.yml up -d --build
docker compose -f deploy/docker-compose.production.yml ps
```

หยุด:

```bash
docker compose -f deploy/docker-compose.production.yml down
```

Windows helper:

```bat
deploy\docker-up.cmd
deploy\docker-down.cmd
```

### โหมด systemd (Linux)

ไฟล์ unit ตัวอย่าง:

- [scum-bot.service](./deploy/systemd/scum-bot.service)
- [scum-worker.service](./deploy/systemd/scum-worker.service)
- [scum-watcher.service](./deploy/systemd/scum-watcher.service)
- [scum-web-portal.service](./deploy/systemd/scum-web-portal.service)

ติดตั้งอย่างย่อ:

```bash
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now scum-bot scum-worker scum-watcher scum-web-portal
sudo systemctl status scum-bot
```

---

## การทดสอบ

รันชุดตรวจทั้งหมด:

```bash
npm run check
npm run security:check
```

รันเฉพาะเทสต์:

```bash
npm test
```

สถานะล่าสุด: `79/79 passing`

เช็กความพร้อมก่อนปล่อยขึ้นจริง:

```bash
npm run readiness:full
npm run readiness:prod
# ถ้าต้องการรวม npm audit ด้วย
npm run readiness:prod:audit
```

---

## สถานะ Data Layer (P2)

ย้ายเป็น Prisma แล้ว:

- `memoryStore` (wallet/shop/purchase)
- `WalletLedger` + `PurchaseStatusHistory`
- `linkStore`
- `bountyStore`
- `statsStore`
- `cartStore`
- `redeemStore`
- `vipStore`
- `scumStore`
- `eventStore`
- `ticketStore`
- `weaponStatsStore`
- `welcomePackStore`
- `moderationStore`
- `giveawayStore`
- `topPanelStore`
- `deliveryAuditStore`
- `playerAccountStore` (`PlayerAccount`)
- `config-overrides` (`BotConfig`)
- `delivery queue` (`DeliveryQueueJob`)
- `delivery dead-letter` (`DeliveryDeadLetter`)

สถานะ production baseline:

- บังคับ fail-fast แล้ว: `NODE_ENV=production` ต้องมี `PERSIST_REQUIRE_DB=true`
- บังคับเพิ่มแล้ว: `NODE_ENV=production` ต้องมี `PERSIST_LEGACY_SNAPSHOTS=false`
- production จะใช้ DB เป็น source of truth เท่านั้น
- legacy JSON snapshot ถูกลดบทบาทเป็น backup/migration helper เท่านั้น
- ถ้าจะเปิด snapshot ชั่วคราว ให้ทำเฉพาะ non-production หรือช่วง migration/backup ที่ควบคุมแล้ว

หมายเหตุ: ตอนนี้ `link/bounty/stats/cart/redeem/vip/scum/event/ticket/weaponStats/welcomePack/moderation/giveaway/topPanel/deliveryAudit` ใช้รูปแบบ `in-memory cache + Prisma write-through + startup hydration` เพื่อไม่ให้ API เดิมพัง

### ซ่อมข้อความเพี้ยนในฐานข้อมูล

สแกนอย่างเดียว:

```bash
npm run text:scan
```

ซ่อมจริงพร้อมสำรองไฟล์ DB อัตโนมัติ:

```bash
npm run text:repair
```

หมายเหตุ:

- ถ้าเป็น SQLite local script จะ backup DB ไปที่โฟลเดอร์ `backups/`
- ใช้สำหรับซ่อมข้อความ mojibake เก่าที่อาจค้างอยู่ใน `BotConfig`, `ShopItem`, `DeliveryAudit`, `TicketRecord` และ table อื่นที่มี string fields

---

## ความคืบหน้า Roadmap (ล่าสุด)

- Phase 1 เสร็จ:
  - Data layer migration ส่วน wallet/purchase/cart/redeem/vip/scum/event/ticket/weaponStats/welcomePack/moderation/giveaway/topPanel/deliveryAudit พร้อม migration ใหม่
  - Wallet ledger ครบ audit trail
  - Order/delivery state machine + transition guard + status history
  - Admin security hardening ฝั่ง purchase status API
- Phase 2 เริ่มแล้ว:
  - Player account system (DB model + store)
  - SteamID binding sync อัตโนมัติจาก link store
  - Player dashboard API: `GET /admin/api/player/dashboard?userId=<discordId>`
  - Player accounts API: `GET /admin/api/player/accounts`
  - Player Portal UI แยกที่ `/player` + API เฉพาะผู้เล่น (`/admin/api/portal/*`)
  - Inventory/catalog query-filter สำหรับ player portal
- Phase 3 เริ่มวางฐาน:
  - Shared coin service กลาง (`src/services/coinService.js`)
  - เพิ่ม `src/services/playerOpsService.js` เป็น service กลางสำหรับ `rentbike` + `bounty` + `redeem`
  - เพิ่ม `src/services/purchaseService.js` สำหรับ manual purchase status transition แบบใช้กติกากลางเดียวกัน
  - ย้าย flow เหรียญหลัก (`add/remove/set/gift/event/refund`) ให้ผ่าน coin service มากขึ้น
  - เพิ่ม `src/services/shopService.js` และ `src/services/vipService.js` สำหรับซื้อของ/ซื้อ VIP แบบ rollback-safe
  - เพิ่ม `src/services/wheelService.js`, `src/services/welcomePackService.js`, `src/services/rewardService.js`, `src/services/eventService.js` สำหรับ reward/event flow ที่ rollback-safe และใช้ร่วมกันทั้ง command/web/admin
  - admin bounty/redeem actions ถูกย้ายมาใช้ service layer เดียวกับ command/web แล้ว
  - admin purchase status และ welcome reward actions ใช้ service layer เดียวกับ runtime หลักแล้ว
  - command ฝั่งอ่าน (`balance / board / buy / cart / daily / inventory / online / punishlog / purchase-log / shop / stats / top / weekly / panel-shop query`) ไม่ import store ตรงแล้ว
  - เพิ่ม `src/services/playerQueryService.js` และ cart query wrappers เพื่อรวม read-path เข้าชั้น service เดียวกัน
  - หน้า Admin Dashboard มี Audit Center สำหรับ `wallet / reward / event` พร้อม deep filters `q/user/actor/reason/reference/status/date-from/date-to/window`, exact-match mode, sort/order, pagination (`page + cursor`) และ saved presets แบบแชร์ผ่าน DB พร้อม scope `private / role / public`
  - export `audit/observability` แบบ `CSV/JSON` และ `snapshot export` ทำฝั่ง server แล้ว
  - ย้าย `snapshot/backup/restore` ของแอดมินไป `src/services/adminSnapshotService.js`, `observability query/export` ไป `src/services/adminObservabilityService.js`, `audit query/export + presets` ไป `src/services/adminAuditService.js`, และแยก dashboard cards + cache window ไป `src/services/adminDashboardService.js`
  - `cart checkout` คืนเหรียญเฉพาะรายการที่ล้มอัตโนมัติ
  - เพิ่ม worker entrypoint (`src/worker.js`) + runtime split flags + PM2 manifest

---

## Production Checklist (สรุป)

- หมุน secret ทั้งชุดก่อน deploy
  - `DISCORD_TOKEN`, `SCUM_WEBHOOK_SECRET`, `ADMIN_WEB_PASSWORD`, `ADMIN_WEB_TOKEN`, `RCON_PASSWORD`
  - (อัตโนมัติ) `npm run security:rotate:prod`
  - ใส่ token จริงขณะหมุนได้ด้วย:
    - `node scripts/rotate-production-secrets.js --write --discord-token <token> --portal-discord-secret <secret>`
- ตั้งค่า production security env
  - `NODE_ENV=production`
  - `PERSIST_REQUIRE_DB=true`
  - `PERSIST_LEGACY_SNAPSHOTS=false`
  - `ADMIN_WEB_SECURE_COOKIE=true`
  - `ADMIN_WEB_HSTS_ENABLED=true`
  - `ADMIN_WEB_ALLOW_TOKEN_QUERY=false`
  - `ADMIN_WEB_ENFORCE_ORIGIN_CHECK=true`
- ถ้าแยก process ตาม Phase 3:
  - Bot: `BOT_ENABLE_ADMIN_WEB=true`, `BOT_ENABLE_RENTBIKE_SERVICE=false`, `BOT_ENABLE_DELIVERY_WORKER=false`
  - Worker: `WORKER_ENABLE_RENTBIKE=true`, `WORKER_ENABLE_DELIVERY=true`
  - Watcher: `SCUM_WATCHER_HEALTH_PORT=3212`
  - Web: `WEB_PORTAL_PORT=3300`
- วาง Admin Web หลัง HTTPS reverse proxy
- รันก่อนปล่อยจริง:
  - `npm run readiness:prod`
  - `npm run smoke:postdeploy`
  - (ตัวเลือกเสริม) `npm run readiness:prod:audit`

สคริปต์ใหม่ที่ใช้บ่อย:

- `npm run readiness:full`
  - ตรวจ lint/test/security/doctor สำหรับ environment ปัจจุบัน
- `npm run readiness:prod`
  - เพิ่ม production doctor ของเว็บ standalone เข้าไปด้วย
- `npm run doctor:topology`
  - ตรวจว่า role ของ `bot / worker / watcher / web` ไม่ชนกัน
- `npm run doctor:topology:prod`
  - ตรวจ topology แบบ production split runtime
- `npm run smoke:postdeploy`
  - ตรวจ endpoint สำคัญหลัง deploy (healthz, login pages, redirects, auth gate)
- `npm run text:repair`
  - ซ่อมข้อความเพี้ยนในฐานข้อมูลจริงและสร้าง backup ก่อนเขียน

Windows helper (รันต่อเนื่อง readiness + smoke):

```bat
deploy\run-production-checks.cmd
```

คู่มือ deploy แบบ step-by-step (PM2 + reverse proxy + backup/restore):
- [docs/DEPLOYMENT_STORY.md](./docs/DEPLOYMENT_STORY.md)
- [docs/CUSTOMER_ONBOARDING.md](./docs/CUSTOMER_ONBOARDING.md)

ตัวอย่าง reverse proxy config:
- [deploy/nginx.player-admin.example.conf](./deploy/nginx.player-admin.example.conf)

One-click production (Windows + PM2):

```bat
npm run deploy:oneclick:win
```

หมายเหตุ:
- ถ้า `DISCORD_TOKEN` หรือ `WEB_PORTAL_DISCORD_CLIENT_SECRET` ยังเป็น placeholder ระบบจะหยุดที่ `security:check` เพื่อกัน deploy ผิดค่า

---

## Endpoint สำคัญ

- Admin Web: `GET /admin/login`
- Player Portal: `GET /player`
- Admin Observability: `GET /admin/api/observability`
- Admin Observability Export: `GET /admin/api/observability/export`
- Live stream: `GET /admin/api/live`
- Player Dashboard API: `GET /admin/api/player/dashboard?userId=<discordId>`
- Portal API (ผ่าน standalone): `/player/api/dashboard`, `/player/api/shop/list`, `/player/api/purchase/list`, `/player/api/redeem`, `/player/api/rentbike/request`
- Health check: `GET /healthz`
- SCUM webhook: `POST /scum-event`

---

## เว็บแยก (Discord OAuth)

มีโปรเจคเว็บแยกจากบอทเดิมแล้วที่:

- `apps/web-portal-standalone/`

จุดประสงค์:

- login ผ่าน Discord OAuth
- แยก process ออกจากบอทหลัก
- ให้เว็บนี้เป็น `player-only` แบบไม่พึ่ง `/admin/api`
- route `/admin*` จะ redirect ไป admin เดิมตาม `WEB_PORTAL_LEGACY_ADMIN_URL`

รันได้ด้วย:

```bash
npm run start:web-standalone
```

ตรวจความพร้อมก่อน deploy:

```bash
npm run doctor:web-standalone
npm run doctor:web-standalone:prod
```

เช็กรายละเอียดและ checklist production:

- [apps/web-portal-standalone/README.md](./apps/web-portal-standalone/README.md)

คู่มือติดตั้งแบบละเอียด:

- [apps/web-portal-standalone/README.md](./apps/web-portal-standalone/README.md)

---

## เอกสารเพิ่มเติม

- คู่มือใช้งานและตั้งค่าหลัก: [docs/OPERATIONS_MANUAL_TH.md](./docs/OPERATIONS_MANUAL_TH.md)
- สถานะโครงการ + roadmap + changelog: [PROJECT_HQ.md](./PROJECT_HQ.md)
- Incident runbook: [docs/INCIDENT_RESPONSE.md](./docs/INCIDENT_RESPONSE.md)
- Data migration plan: [docs/DATA_LAYER_MIGRATION.md](./docs/DATA_LAYER_MIGRATION.md)
- Deployment story: [docs/DEPLOYMENT_STORY.md](./docs/DEPLOYMENT_STORY.md)
- Repo presentation checklist: [docs/REPO_PRESENTATION.md](./docs/REPO_PRESENTATION.md)

---

## License

ISC
