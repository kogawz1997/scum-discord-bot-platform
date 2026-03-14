# SCUM Ops Platform Showcase

เอกสารนี้ใช้สำหรับ “โชว์ของ” ให้เห็นว่าระบบนี้ไม่ใช่แค่ Discord bot แต่เป็นแพลตฟอร์มปฏิบัติการสำหรับเซิร์ฟเวอร์ SCUM ที่รวม economy, delivery, admin control plane, player portal, observability และ safety guardrails ไว้ในชุดเดียว

อัปเดตล่าสุด: **2026-03-15**

---

## 1. ภาพรวมแบบสั้น

ระบบนี้รวม runtime หลักไว้ครบ:

- `Discord Bot` สำหรับ command, interaction, announcement และ automation
- `Delivery Worker` สำหรับ queue, retry, dead-letter, audit และ post-spawn verification
- `SCUM Log Watcher` สำหรับ realtime event ingestion จาก `SCUM.log`
- `Admin Web` สำหรับควบคุม config, delivery, backup/restore, audit และ incident handling
- `Player Portal` สำหรับ wallet, purchase history, redeem, profile และ Steam binding
- `Console Agent / SCUM Admin Client Bridge` สำหรับ delivery แบบ agent mode

สิ่งที่ทำให้ดูเป็นแพลตฟอร์มมากกว่าบอท:

- split runtime ชัดเจน `bot / worker / watcher / web / console-agent`
- มี queue lifecycle และหลักฐานต่อออเดอร์ ไม่ใช่ยิงคำสั่งแบบ best effort อย่างเดียว
- มีทั้ง `preflight`, `simulator`, `capability test`, `timeline`, `audit`, `notification center`
- มี safe restore guardrails และ operational tooling สำหรับ production

---

## 2. Capability Matrix

| พื้นที่ | สิ่งที่ทำได้ |
| --- | --- |
| Economy | wallet, ledger, transfer, gift, shop, cart, purchase, VIP, redeem, refund |
| Community Ops | ticket, bounty, event, giveaway, welcome, daily, weekly, wheel |
| SCUM Ops | watcher, kill feed, restart announce, restart scheduler, rent bike queue |
| Delivery | queue, retry, dead-letter, watchdog, preview, simulate, test-send, verify |
| Admin | RBAC, DB login, Discord SSO, 2FA baseline, config editor, backup/restore |
| Observability | dashboard cards, health endpoints, runtime supervisor, readiness, smoke |
| Player Portal | Discord login, wallet, history, shop, redeem, profile, steam link |

---

## 3. จุดขายหลักของระบบส่งของ

### 3.1 Delivery ไม่ได้เป็น black box

ระบบมีรายละเอียดรายออเดอร์แบบ step-based:

- `queued`
- `picked by worker`
- `preflight checked`
- `teleport sent`
- `spawn sent`
- `verify success / failed`
- `completed / dead-letter`

ผลคือแอดมินตอบได้ว่าของพัง “ที่ขั้นไหน” ไม่ต้องไล่ log หลายไฟล์แบบเดาเอง

### 3.2 มี preflight ก่อนยิงจริง

ก่อน test-send หรือ enqueue สามารถตรวจได้ว่า:

- worker online หรือไม่
- console-agent reachable หรือไม่
- delivery mode พร้อมหรือไม่
- command template ใช้ได้หรือไม่
- target ที่ต้องใช้สำหรับ teleport / return ถูกเตรียมหรือยัง

### 3.3 มี dry run และ capability tester

แอดมินสามารถ:

- preview command จาก `itemId` หรือ `gameItemId`
- จำลอง execution plan แบบไม่ยิงจริง
- ทดสอบ `announce / teleport / spawn` แบบ live หรือ dry-run
- เก็บ capability preset ไว้ใช้ซ้ำได้

### 3.4 มี post-spawn verification

delivery runtime รองรับ verification policy:

- `basic`
- `output-match`
- `observer`
- `strict`

ทำให้ระบบไม่ได้จบแค่ “ยิงคำสั่งออกไปแล้ว” แต่มีชั้นยืนยันผลหลังการ execute

---

## 4. Flow ที่ยืนยันใช้งานแล้ว

### Agent Mode

flow จริงที่ repo นี้รองรับและยืนยันแล้ว:

```text
Purchase / Admin Test
-> Delivery Queue
-> Worker
-> Console Agent
-> PowerShell Bridge
-> SCUM Admin Client
-> Admin Channel Command
-> Verify
-> Timeline / Audit
```

สิ่งที่พิสูจน์ผ่านแล้วใน environment ปัจจุบัน:

- `#Announce ...`
- `#TeleportToVehicle 50118`
- `#SpawnItem Weapon_M1911 1`
- multi-item delivery
- magazine auto `StackCount 100`

หมายเหตุ:

- ถ้าเซิร์ฟเวอร์ execute `#SpawnItem` ผ่าน RCon ตรงได้ สามารถใช้ `RCon mode`
- ถ้า RCon login ได้แต่ไม่ execute command ได้จริง ระบบใช้ `agent mode` แทน

---

## 5. สิ่งที่แอดมินเห็นจากหน้าเว็บ

### Admin Landing / Showcase

หน้า dashboard สรุปให้เห็นทันที:

- runtime topology พร้อม required / ready / degraded / offline
- delivery runtime mode, queue, dead-letter, verification mode
- capability catalog และ preset count
- player-facing surface และ data counts
- restore guardrails และ notification backlog
- operational evidence จาก delivery audit

### Admin Cockpit

แอดมินทำงานประจำวันได้จากหน้าเดียว:

- ดู queue / dead-letter / audit
- เปิด delivery detail รายออเดอร์
- รัน preflight / simulator / capability test
- แก้ command template รายสินค้า
- ดู notification center และ acknowledge incident
- backup / restore / snapshot export

---

## 6. สิ่งที่ผู้เล่นได้รับ

ผู้เล่นไม่ได้เจอแค่ Discord command แต่มี portal แยก:

- Discord login
- wallet dashboard
- purchase history
- redeem code
- profile / steam link
- player-only experience แยกจาก admin

จุดนี้สำคัญเวลาเอาไปใช้งานจริงหรือขายงาน เพราะภาพรวมดูเป็น “service” มากกว่า “บอทสั่งงาน”

---

## 7. Safety และ Production Guardrails

ระบบมีชั้นป้องกันสำหรับงาน production:

- `doctor`
- `doctor:topology:prod`
- `doctor:web-standalone:prod`
- `security:check`
- `readiness:prod`
- `smoke:postdeploy`
- runtime lock กัน service ซ้ำ
- restore maintenance gate
- auto rollback backup

จุดนี้ช่วยลดความเสี่ยงแบบ:

- เปิด bot/worker ทับกัน
- restore ผิดแล้วเขียนทับ production
- ใช้ secret/dev env ผิดชุด
- topology ตายบางตัวแต่ระบบดูเหมือนยังออนไลน์

---

## 8. สคริปต์เดโมที่ใช้พรีเซนต์ได้ทันที

ลำดับเดโมที่แนะนำ:

1. เปิดหน้า admin dashboard เพื่อโชว์ runtime showcase
2. เปิด delivery runtime เพื่อโชว์ queue, worker, dead-letter และ verification
3. รัน delivery preflight เพื่อโชว์ readiness แบบเจาะ delivery
4. รัน simulator เพื่อโชว์ command plan ก่อนยิงจริง
5. รัน capability test `announce / teleport / spawn`
6. เปิด delivery detail รายออเดอร์เพื่อโชว์ timeline และ step log
7. เปิด notification center และ backup/restore เพื่อโชว์ operations maturity
8. เปิด player portal เพื่อโชว์ wallet, history และ redeem experience

---

## 9. Deliverables ที่ใช้ส่งมอบลูกค้า

ชุดส่งมอบที่ควรโชว์ร่วมกัน:

- Admin Web
- Player Portal
- Runtime topology / health endpoints
- Delivery timeline / preflight / simulator / capability tester
- Backup / restore / snapshot workflow
- Operations manual และ onboarding docs

ถ้าต้องการขายงานในมุม commercial มากขึ้น ควรเสริม:

- screenshot set หรือ demo GIF
- architecture image แบบอ่านง่าย
- preset package สำหรับ deployment หลายรูปแบบ

