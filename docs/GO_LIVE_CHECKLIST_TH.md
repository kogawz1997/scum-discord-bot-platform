# Production Go-Live Checklist

เอกสารนี้เป็น checklist สั้นก่อนเปิดใช้งานจริง โดยโฟกัส 4 เรื่อง:

- `security baseline`
- `runtime proof`
- `billing / entitlement correctness`
- `operator validation`

อัปเดตล่าสุด: **2026-04-03**

---

## 1. Security / Auth Hardening

- ใช้ `NODE_ENV=production`
- ใช้ `ADMIN_WEB_SECURE_COOKIE=true`
- ใช้ `ADMIN_WEB_HSTS_ENABLED=true`
- ใช้ `ADMIN_WEB_TRUST_PROXY=true`
- ใช้ `ADMIN_WEB_ENFORCE_ORIGIN_CHECK=true`
- ตั้ง `ADMIN_WEB_ALLOWED_ORIGINS` ให้เป็น `https://...` เท่านั้น
- เปิด `ADMIN_WEB_2FA_ENABLED=true` และใส่ `ADMIN_WEB_2FA_SECRET`
- เปิด `ADMIN_WEB_STEP_UP_ENABLED=true` และตั้ง `ADMIN_WEB_STEP_UP_TTL_MINUTES=15`
- หมุนค่า `ADMIN_WEB_PASSWORD`, `ADMIN_WEB_TOKEN`, `SCUM_WEBHOOK_SECRET`, `SCUM_CONSOLE_AGENT_TOKEN`, Discord OAuth secret, และ billing provider secret ให้เป็นค่าจริง
- แยก origin ของ `owner`, `tenant`, และ `player` ตาม profile production ที่ใช้อยู่
- ยืนยันว่า rate limiting baseline สำหรับ login, runtime activation, config/restart, และ delivery actions ถูกเปิดตาม config ปัจจุบัน

---

## 2. Runtime Topology

runtime ที่ควรแยกจริงใน production profile ปัจจุบัน:

- `scum-owner-web`
- `scum-tenant-web`
- `scum-admin-web`
- `scum-bot`
- `scum-worker`
- `scum-watcher`
- `scum-server-bot`
- `scum-console-agent` (`Delivery Agent` runtime key) บนเครื่องที่เปิด SCUM client
- `scum-web-portal`

ก่อนเปิดจริงให้ยืนยันว่า:

- `Server Bot` และ `Delivery Agent` ยังแยกบทบาทกันชัด
- `Server Bot` ใช้กับงาน log sync, config, backup, restart/start/stop เท่านั้น
- `Delivery Agent` ใช้กับ delivery / in-game execution เท่านั้น
- health endpoint ของทุก process ตอบได้
- PM2 หรือ process manager ตั้ง autorestart แล้ว
- มี monitor ภายนอกหรือ health poller ที่ไม่พึ่ง dashboard อย่างเดียว

---

## 3. Database / Persistence

- ใช้ `PERSIST_REQUIRE_DB=true`
- ใช้ `PERSIST_LEGACY_SNAPSHOTS=false`
- ใช้ PostgreSQL เป็น production path
- รัน migration / generate ให้ครบ
- ทดสอบ backup และ restore แบบ dry-run ก่อนเสมอ
- ยืนยันว่ามี rollback backup สำหรับ restore ล่าสุด
- ยืนยัน tenant topology ที่ใช้อยู่ตรงกับ deployment จริง

---

## 4. Billing / Entitlement

ก่อนเปิดรับ tenant จริง ให้ยืนยันว่า:

- tenant ใหม่ได้ `trial` หรือ package เริ่มต้นตาม flow ที่ตั้งใจไว้
- package metadata แสดง `name`, `price`, `features`, `limits` ถูกต้อง
- entitlement backend บังคับตาม `trial`, `active`, `expired`, `suspended`
- action สำคัญถูกล็อกจริงเมื่อ subscription ไม่อนุญาต
- tenant billing page แสดง:
  - current plan
  - subscription state
  - expiry / current period
  - upgrade path
- ถ้าใช้ provider จริง:
  - webhook secret ถูกตั้งแล้ว
  - return/cancel URL ถูกต้อง
  - checkout/upgrade flow ยิงไป origin ที่ถูกต้อง

---

## 5. Runtime Provisioning / Validation

### Server Bot

1. ออก setup token จาก Tenant UI
2. ติดตั้งผ่าน `scripts/install-server-bot.ps1`
3. รัน `scripts/runtime-env-check.js --role server-bot`
4. เปิด process แล้วดูว่า runtime online
5. ยืนยันว่าแสดง:
   - machine name
   - version
   - last seen
   - latest error ถ้ามี
6. ทดสอบ:
   - config sync
   - config access
   - restart probe

### Delivery Agent

1. ออก setup token จาก Tenant UI
2. ติดตั้งผ่าน `scripts/install-delivery-agent.ps1`
3. รัน `scripts/runtime-env-check.js --role delivery-agent`
4. เปิด process แล้วดูว่า runtime online
5. ยืนยันว่าแสดง:
   - machine name
   - version
   - last seen
   - latest error ถ้ามี
6. ทดสอบ:
   - preflight
   - simulator
   - capability test
   - test send

---

## 6. Commands ที่ควรรันก่อนเปิดจริง

```bash
npm run doctor
npm run doctor:topology:prod
npm run doctor:web-standalone:prod
npm run security:check
npm test
npm run lint:text
npm run readiness:prod
npm run smoke:postdeploy
```

ถ้าใช้ public URL จริง ให้ตั้งค่าฐาน smoke ให้ตรง deployment:

```bash
set SMOKE_ADMIN_BASE_URL=https://admin.example.com/admin
set SMOKE_PLAYER_BASE_URL=https://player.example.com
npm run smoke:postdeploy
```

ถ้าจะยืนยัน runtime installer บนเครื่องเป้าหมาย:

```bash
node scripts/runtime-env-check.js --role server-bot --env-file .runtime/server-bot.env
node scripts/runtime-env-check.js --role delivery-agent --env-file .runtime/delivery-agent.env
node scripts/runtime-inventory-report.js --json
```

---

## 7. หลังเปิดจริง 24 ชั่วโมงแรก

- ดู notification center ว่ามี runtime offline, failed config apply, failed restart, หรือ subscription expiring หรือไม่
- ดู `Logs & Sync` ว่ามี failed jobs หรือ config retry backlog หรือไม่
- ดู runtime supervisor ว่ามี process ไหน degraded/offline หรือไม่
- ตรวจ order จริง 2-3 รายการว่ามี timeline และ action result ครบ
- ตรวจ restart history อย่างน้อย 1 รายการถ้ามีการใช้งาน
- ตรวจ backup ล่าสุดและ restore status อีกครั้ง

---

## 8. สิ่งที่ต้องพูดให้ชัดกับลูกค้า

- `Delivery Agent` ยังพึ่ง Windows session และ SCUM client จริง
- `Server Bot` ต้องเข้าถึง `SCUM.log` และ config path จริง
- บาง proof ยังเป็น machine-specific proof ไม่ใช่ universal proof ทุก environment
- billing/commercial layer พร้อมในระดับ repo/product flow แล้ว แต่ provider-grade operations ยังต้องเฝ้าดูตอนเปิดจริง
- public slug pages และ supporter flows พร้อมใช้งานแล้ว แต่ยังควรติดตามข้อมูลจริงหลังเปิด tenant แรก
