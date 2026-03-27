# คู่มือสคริปต์ทดสอบข้ามเครื่อง

อัปเดตล่าสุด: `2026-03-27`

คู่มือนี้อธิบายสคริปต์ `machine-validation` ที่ใช้ตรวจว่าแต่ละเครื่องใน topology ของระบบพร้อมสำหรับการรันบทบาทของตัวเองหรือยัง โดยแยกตาม role แบบชัดเจน

- `control-plane`
  - Owner/Admin/Player web
  - bot
  - worker
  - database / readiness / preflight
- `delivery-agent`
  - เครื่องที่เปิด `console-agent`
  - เครื่องที่มี SCUM client และใช้ส่งคำสั่งในเกม
- `server-bot`
  - เครื่องที่ดูแล `watcher + server config + sync`
  - เครื่องที่อ่าน `SCUM.log`, sync, backup, apply/restart config
- `game-node`
  - เครื่องที่รวม `delivery-agent + server-bot` ไว้ด้วยกัน
  - ตรงกับ `Machine B` ใน topology สองเครื่องของ repo นี้

สคริปต์จะเขียนรายงาน JSON ลงใน `[C:/new/artifacts/machine-validation](C:/new/artifacts/machine-validation)` ทุกครั้ง เพื่อให้เก็บหลักฐานและเทียบผลจากหลายเครื่องได้ง่าย

## ไฟล์และคำสั่งที่เพิ่มให้

- สคริปต์หลัก: [C:/new/scripts/machine-validation.js](C:/new/scripts/machine-validation.js)
- คำสั่งใน `package.json`: [C:/new/package.json](C:/new/package.json)

คำสั่งพร้อมใช้:

```bat
npm run machine:validate
npm run machine:validate:control-plane
npm run machine:validate:delivery-agent
npm run machine:validate:server-bot
npm run machine:validate:game-node
```

## สิ่งที่สคริปต์ตรวจให้

### `control-plane`

- `doctor.js`
- `security-check.js`
- `doctor-topology.js`
- web portal doctor
- `readiness-gate.js`
- `preflight-prod.js`

เหมาะกับเครื่องที่เปิดระบบหลักของแพลตฟอร์มทั้งหมด และต้องการเช็กก่อน deploy หรือหลัง start service แล้ว

### `delivery-agent`

- โครงสร้าง topology ของเครื่อง
- config ของ `SCUM console-agent`
- health endpoint ของ `console-agent`
- `console-agent /preflight`

เหมาะกับเครื่องที่เปิด SCUM client และใช้ execute delivery job

### `server-bot`

- topology ของเครื่อง
- control-plane URL / token / tenant / server id
- การเข้าถึง control-plane จากเครื่องนี้
- command template สำหรับ apply/restart
- การอ่าน config snapshot จาก `SCUM_SERVER_CONFIG_ROOT`
- watcher health

เหมาะกับเครื่องที่ทำงานฝั่ง `log sync + config + restart`

### `game-node`

- รวมการตรวจของ `delivery-agent`
- รวมการตรวจของ `server-bot`

เหมาะกับเครื่องแบบ `Machine B` ที่รัน watcher + console-agent ด้วยกัน

## ขั้นตอนติดตั้งเบื้องต้น

ทำทุกเครื่องก่อน:

1. ติดตั้ง Node.js `20+`
2. clone repo นี้ลงเครื่อง
3. เข้าโฟลเดอร์ repo
4. รัน:

```bat
npm install
```

5. ยืนยันว่ามีไฟล์ `.env` ที่ถูกต้องสำหรับเครื่องนั้น

ถ้าใช้ topology ตาม repo เดิม ให้เริ่มจาก profile ที่มีอยู่แล้ว:

```bat
npm run env:preview:machine-a-control-plane
npm run env:prepare:machine-a-control-plane

npm run env:preview:machine-b-game-bot
npm run env:prepare:machine-b-game-bot
```

ตัวอย่างไฟล์อ้างอิง:

- `[C:/new/.env.machine-a-control-plane.example](C:/new/.env.machine-a-control-plane.example)`
- `[C:/new/.env.machine-b-game-bot.example](C:/new/.env.machine-b-game-bot.example)`

## วิธีตั้งค่าแบบละเอียดตาม role

### 1. เครื่อง `control-plane`

เครื่องนี้ควรมีค่าอย่างน้อย:

- `NODE_ENV=production`
- `DATABASE_PROVIDER=postgresql`
- `PRISMA_SCHEMA_PROVIDER=postgresql`
- `DATABASE_URL=...`
- `PERSIST_REQUIRE_DB=true`
- `PERSIST_LEGACY_SNAPSHOTS=false`
- `ADMIN_WEB_ALLOWED_ORIGINS=...`
- `ADMIN_WEB_SECURE_COOKIE=true`
- `ADMIN_WEB_SESSION_COOKIE_PATH=/`
- `DELIVERY_EXECUTION_MODE=agent`
- `SCUM_CONSOLE_AGENT_BASE_URL=http://<machine-b>:3213`
- `SCUM_CONSOLE_AGENT_TOKEN=<same token as machine B>`
- `BOT_HEALTH_PORT=...`
- `WORKER_HEALTH_PORT=...`
- `WEB_PORTAL_BASE_URL=...`
- `WEB_PORTAL_DISCORD_CLIENT_ID=...`
- `WEB_PORTAL_DISCORD_CLIENT_SECRET=...`

ถ้าใช้ profile สำเร็จรูป:

```bat
npm run env:prepare:machine-a-control-plane
```

จากนั้น start runtime:

```bat
npm run pm2:start:machine-a-control-plane
```

แล้วรัน validator:

```bat
npm run machine:validate:control-plane -- --production
```

ถ้าต้องการยิง `delivery test-send` จริงระหว่าง preflight:

```bat
npm run machine:validate:control-plane -- --production --with-delivery-test
```

ถ้าต้องการเช็กแค่ static/readiness และยังไม่อยากรัน preflight:

```bat
npm run machine:validate:control-plane -- --production --skip-preflight
```

### 2. เครื่อง `delivery-agent`

เครื่องนี้ต้องเน้น `console-agent` เป็นหลัก และอย่างน้อยควรมี:

- `SCUM_CONSOLE_AGENT_HOST=0.0.0.0` หรือ host ที่ต้องการ bind
- `SCUM_CONSOLE_AGENT_PORT=3213`
- `SCUM_CONSOLE_AGENT_TOKEN=<token ที่ control-plane ใช้เรียก>`
- `SCUM_CONSOLE_AGENT_BACKEND=exec` หรือ `process`

ถ้าใช้ `exec`:

- `SCUM_CONSOLE_AGENT_EXEC_TEMPLATE` ต้องมี `{command}`

ถ้าใช้ `process` และเปิด autostart:

- `SCUM_CONSOLE_AGENT_AUTOSTART=true`
- `SCUM_CONSOLE_AGENT_SERVER_EXE=<path ไป server exe>`

เครื่องนี้ควรมี Windows session ที่ unlock อยู่ และ SCUM client พร้อมรับคำสั่งจริง

start runtime:

```bat
npm run start:scum-agent
```

หรือถ้าคุณมี PM2 profile ของตัวเองก็ใช้ตัวนั้นได้

จากนั้นรัน validator:

```bat
npm run machine:validate:delivery-agent -- --production
```

สิ่งที่สคริปต์นี้เช็กให้:

- token มีหรือไม่
- backend ถูกต้องหรือไม่
- exec template ปลอดภัยหรือไม่
- health endpoint ของ agent ขึ้นหรือไม่
- `/preflight` ผ่านหรือไม่

### 3. เครื่อง `server-bot`

เครื่องนี้ต้องมี config และ sync ฝั่ง server อย่างน้อย:

- `SCUM_SYNC_CONTROL_PLANE_URL=<url ของ control plane>`
  - หรือ `PLATFORM_API_BASE_URL`
- `PLATFORM_AGENT_TOKEN=<long-lived token>`
  - หรือ `PLATFORM_AGENT_SETUP_TOKEN=<setup token>`
- `SCUM_TENANT_ID=<tenant id>`
- `SCUM_SERVER_ID=<server id>`
- `SCUM_SERVER_CONFIG_ROOT=<path ของ config root>`
  - หรือ `SCUM_SERVER_SETTINGS_DIR`
  - หรือ `SCUM_SERVER_DIR`
- `SCUM_SERVER_APPLY_TEMPLATE=<command template>`
- `SCUM_SERVER_RESTART_TEMPLATE=<command template>`
- `SCUM_WATCHER_ENABLED=true`
- `SCUM_WATCHER_HEALTH_PORT=3212`
- `SCUM_LOG_PATH=<path ไป SCUM.log>`

สำคัญมาก: profile `[C:/new/.env.machine-b-game-bot.example](C:/new/.env.machine-b-game-bot.example)` ใน repo ปัจจุบันยังไม่มี `SCUM_SERVER_*` และ `PLATFORM_AGENT_*` ครบทุกตัวสำหรับ server-bot ดังนั้นถ้าคุณใช้ profile นี้เป็นฐาน ต้องเติมเอง

start runtime:

```bat
npm run start:watcher
```

หรือถ้าใช้โหมดรวม watcher + server-bot:

```bat
npm run pm2:start:machine-b-game-bot
```

แล้วรัน validator:

```bat
npm run machine:validate:server-bot -- --production
```

สิ่งที่สคริปต์นี้เช็กให้:

- control-plane URL ใช้ได้ไหม
- token/setup token มีไหม
- tenant/server id ครบไหม
- public overview ของ control-plane reach ได้ไหม
- command template ของ apply/restart ปลอดภัยไหม
- config snapshot อ่านได้ไหม
- watcher health ผ่านไหม

### 4. เครื่อง `game-node`

กรณีนี้คือเครื่องเดียวรับทั้ง `console-agent + watcher + server-bot`

ใช้กับ topology สองเครื่องใน repo นี้ได้ตรงที่สุด:

- `Machine A` = control-plane
- `Machine B` = game-node

เตรียม env:

```bat
npm run env:prepare:machine-b-game-bot
```

แล้วเติมค่าที่ profile ยังไม่ครบสำหรับ `server-bot` เพิ่มเอง:

- `SCUM_SYNC_CONTROL_PLANE_URL`
- `PLATFORM_AGENT_TOKEN` หรือ `PLATFORM_AGENT_SETUP_TOKEN`
- `SCUM_TENANT_ID`
- `SCUM_SERVER_ID`
- `SCUM_SERVER_CONFIG_ROOT`
- `SCUM_SERVER_APPLY_TEMPLATE`
- `SCUM_SERVER_RESTART_TEMPLATE`

start runtime:

```bat
npm run pm2:start:machine-b-game-bot
```

จากนั้นรัน validator:

```bat
npm run machine:validate:game-node -- --production
```

## ตัวอย่างการใช้งานจริง

### ตรวจ Machine A

```bat
npm run machine:validate:control-plane -- --production
```

### ตรวจ Machine B แบบรวม

```bat
npm run machine:validate:game-node -- --production
```

### ตรวจ Machine B เฉพาะ delivery-agent

```bat
npm run machine:validate:delivery-agent -- --production
```

### ตรวจ Machine B เฉพาะ server-bot

```bat
npm run machine:validate:server-bot -- --production
```

### บังคับ control-plane URL ชั่วคราว

```bat
npm run machine:validate:server-bot -- --production --control-plane-url=https://control-plane.example.com
```

### ให้ผลลัพธ์ออก JSON ทาง stdout ด้วย

```bat
npm run machine:validate:game-node -- --production --json
```

## ตำแหน่งรายงานผล

ทุกครั้งที่รัน จะมีไฟล์ JSON ใหม่ถูกสร้างใน:

- `[C:/new/artifacts/machine-validation](C:/new/artifacts/machine-validation)`

โครงสร้างหลักของ report:

- `kind`
- `status`
- `summary`
- `checks[]`
- `warnings[]`
- `errors[]`
- `data.role`
- `data.reportFile`

สถานะที่เป็นไปได้:

- `pass`
- `warning`
- `failed`
- `skipped`

## วิธีอ่านผลลัพธ์

ถ้าผลออก `pass`

- เครื่องนั้นผ่านตาม role ที่เลือก
- ยังควรทดสอบ flow จริงเพิ่ม เช่น delivery จริง หรือ sync จริง

ถ้าผลออก `warning`

- เครื่องยังรันได้บางส่วน
- แต่มีจุดที่ควรแก้ก่อนถือว่า production-ready
- เช่น watcher ถูกปิด, restart template ยัง fallback, หรือ control-plane public overview ยังเข้าไม่ได้แต่ `healthz` ยังขึ้น

ถ้าผลออก `failed`

- role นั้นยังไม่พร้อม
- ควรอ่าน `errors[]` ก่อน
- แล้วกลับไปเช็ก env, port, runtime, token, path ตาม check ที่พัง

## ปัญหาที่เจอบ่อย

### `delivery-agent preflight failed`

มักเกิดจาก:

- SCUM client ไม่พร้อม
- Windows session lock
- `SCUM_CONSOLE_AGENT_EXEC_TEMPLATE` ผิด
- token ไม่ตรง

### `server-bot config snapshot failed`

มักเกิดจาก:

- ไม่ได้ตั้ง `SCUM_SERVER_CONFIG_ROOT`
- path ผิด
- เครื่องนี้ไม่มี config files จริง

### `server-bot control-plane config failed`

มักเกิดจาก:

- ไม่มี `PLATFORM_AGENT_TOKEN`
- ไม่มี `PLATFORM_AGENT_SETUP_TOKEN`
- ไม่มี `SCUM_TENANT_ID`
- ไม่มี `SCUM_SERVER_ID`

### `server-bot watcher health failed`

มักเกิดจาก:

- `SCUM_LOG_PATH` ผิด
- watcher ยังไม่ start
- `SCUM_WATCHER_HEALTH_PORT` ไม่ได้ตั้ง

### `control-plane preflight failed`

มักเกิดจาก:

- database ยังไม่พร้อม
- admin web / portal / bot / worker ยังไม่ขึ้นครบ
- `SCUM_CONSOLE_AGENT_BASE_URL` ชี้ไป Machine B ไม่ได้

## ลำดับแนะนำก่อนถือว่าพร้อมใช้งาน

1. ให้ `control-plane` ผ่านก่อน
2. ให้ `delivery-agent` ผ่าน `/preflight`
3. ให้ `server-bot` อ่าน config + reach control-plane ได้
4. ถ้าใช้ Machine B แบบรวม ให้ `game-node` ผ่านทั้งก้อน
5. ค่อยไปต่อที่ end-to-end flow เช่น `test-send`, sync event, config apply/restart

## เอกสารที่เกี่ยวข้อง

- [C:/new/docs/TWO_MACHINE_AGENT_TOPOLOGY.md](C:/new/docs/TWO_MACHINE_AGENT_TOPOLOGY.md)
- [C:/new/docs/RUNTIME_BOUNDARY_EXPLAINER.md](C:/new/docs/RUNTIME_BOUNDARY_EXPLAINER.md)
- [C:/new/docs/OPERATOR_QUICKSTART.md](C:/new/docs/OPERATOR_QUICKSTART.md)
