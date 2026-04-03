# Release Handoff 2026-04-03

เอกสารนี้สรุปงานรอบล่าสุดสำหรับการส่งต่อจาก branch `codex/local-runtime-finish` ไปยังขั้น `staging`, `review`, และ `release decision`

## 1. Snapshot

- branch: `codex/local-runtime-finish`
- latest commit: `6d5cb14`
- main implementation sweep commit: `d449dd4`
- repo-local status:
  - `npm test` ผ่าน
  - `npm run lint:text` ผ่าน
  - เอกสาร handoff และ runtime validation ถูกอัปเดตแล้ว

## 2. PR Summary

งานรอบนี้ปิดก้อน repo-local หลัก 4 ด้าน และเก็บ hardening เพิ่มอีก 1 ก้อน:

1. `Core Data + Identity`
   - preview identity state ใช้ centralized platform identity summary มากขึ้น
   - linked account summary สะท้อน email, Discord, Steam, และ player-match ได้สอดคล้องกว่าเดิม
   - ไฟล์หลัก:
     - [C:\new\src\services\platformIdentityService.js](/C:/new/src/services/platformIdentityService.js)
     - [C:\new\src\services\publicPreviewService.js](/C:/new/src/services/publicPreviewService.js)

2. `Commercial + Runtime Productization`
   - billing webhook replay handling มี idempotent protection ระดับ repo
   - product-facing runtime wording ย้ายไปใช้ `Delivery Agent`
   - compatibility runtime key `console-agent` ยังอยู่เพื่อไม่หักของเดิม
   - ไฟล์หลัก:
     - [C:\new\src\services\platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
     - [C:\new\src\delivery-agent.js](/C:/new/src/delivery-agent.js)
     - [C:\new\apps\agent\server.js](/C:/new/apps/agent/server.js)
     - [C:\new\deploy\pm2.ecosystem.config.cjs](/C:/new/deploy/pm2.ecosystem.config.cjs)

3. `Surface Polish`
   - owner commercial/support views, tenant runtime wording, และ player wording ถูกเก็บให้สอดคล้องกับ product model ปัจจุบัน
   - ไฟล์หลัก:
     - [C:\new\src\admin\assets\owner-control-v4.js](/C:/new/src/admin/assets/owner-control-v4.js)
     - [C:\new\src\admin\assets\tenant-v4-app.js](/C:/new/src/admin/assets/tenant-v4-app.js)
     - [C:\new\apps\web-portal-standalone\public\assets\player-v4-app.js](/C:/new/apps/web-portal-standalone/public/assets/player-v4-app.js)
     - [C:\new\apps\web-portal-standalone\public\assets\portal-i18n.js](/C:/new/apps/web-portal-standalone/public/assets/portal-i18n.js)

4. `Security + Readiness Sweep`
   - cross-tenant mismatch ถูกบันทึกเป็น security signal ชัดเจน
   - readiness regression ผ่านทั้ง repo
   - ไฟล์หลัก:
     - [C:\new\src\admin\runtime\adminAccessRuntime.js](/C:/new/src/admin/runtime/adminAccessRuntime.js)
     - [C:\new\src\admin\runtime\adminSecurityRuntime.js](/C:/new/src/admin/runtime/adminSecurityRuntime.js)
     - [C:\new\src\adminWebServer.js](/C:/new/src/adminWebServer.js)

5. `Delivery Audit Restore Hardening`
   - replace/restore paths ของ delivery audit ตอนนี้ dedupe และ upsert อย่างปลอดภัยกว่าเดิม
   - snapshot preview/restore counts นับแบบ logical unique rows
   - ไฟล์หลัก:
     - [C:\new\src\store\deliveryAuditStore.js](/C:/new/src/store/deliveryAuditStore.js)
     - [C:\new\src\services\adminSnapshotService.js](/C:/new/src/services/adminSnapshotService.js)

## 3. Validation Already Closed In This Workstation

- `npm test`
- `npm run lint:text`
- runtime/product docs refresh
- repo-local regression for:
  - identity
  - billing lifecycle
  - owner/tenant/player surfaces
  - security boundary logging
  - delivery audit restore behavior

อ้างอิงเอกสารสถานะล่าสุด:

- [C:\new\docs\VERIFICATION_STATUS_TH.md](/C:/new/docs/VERIFICATION_STATUS_TH.md)
- [C:\new\docs\GO_LIVE_CHECKLIST_TH.md](/C:/new/docs/GO_LIVE_CHECKLIST_TH.md)
- [C:\new\docs\RUNTIME_OPERATOR_CHECKLIST.md](/C:/new/docs/RUNTIME_OPERATOR_CHECKLIST.md)

## 4. Staging Validation Plan

### 4.1 Baseline

1. generate Prisma client ตาม provider จริง
2. apply schema/migrations
3. start runtime topology ตาม profile ที่จะใช้จริง
4. รัน baseline commands:

```bash
npm run doctor
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
```

### 4.2 Web Surface Checks

1. `Owner Panel`
   - login ได้
   - tenant detail เปิดได้
   - commercial workspace และ support workspace แสดง billing context
2. `Tenant Admin Panel`
   - onboarding checklist แสดงถูก
   - runtime pages แสดง `Server Bot` และ `Delivery Agent` status
   - config jobs / restart / logs & sync เปิดได้
3. `Player Portal`
   - login/profile ได้
   - shop/orders/supporter/public slug routes เปิดได้
   - wording และ locked states แสดงถูก

### 4.3 Runtime Checks

1. `Server Bot`
   - install จาก setup token
   - env check ผ่าน
   - online ใน control plane
   - config access / restart probe / log sync ผ่าน
2. `Delivery Agent`
   - install จาก setup token
   - env check ผ่าน
   - online ใน control plane
   - preflight / simulator / announce path / test send ผ่าน
   - ยืนยันว่า UI ใช้คำว่า `Delivery Agent` แม้ runtime key ยังเป็น `console-agent`

### 4.4 Identity + Billing Checks

1. preview account ใหม่
   - signup ได้
   - verification state ถูกต้อง
   - linked account summary ไม่หลุดจาก platform identity summary
2. billing
   - checkout flow เปิดได้
   - retry path ไม่สร้าง replay ซ้ำ
   - webhook replay เดิมไม่สร้าง subscription event ซ้ำ

## 5. Release Gate Before Merge / Deploy

ถือว่าพร้อม merge เมื่อ:

- branch review ผ่าน
- `npm test` และ `npm run lint:text` ผ่านบน CI
- staging validation ผ่านอย่างน้อย 1 environment
- runtime proof ผ่านอย่างน้อย:
  - 1 เครื่อง `Server Bot`
  - 1 เครื่อง `Delivery Agent`
- owner/tenant/player smoke ผ่านครบ

## 6. What Still Needs External Proof

รายการนี้ยังทำให้จบใน repo อย่างเดียวไม่ได้:

- SCUM client proof จริงบนเครื่อง `Delivery Agent`
- SCUM server machine proof จริงบน `Server Bot`
- live billing provider behavior:
  - renew
  - fail
  - cancel
  - recovery
- Discord OAuth / guild role mapping proof จริง
- multi-machine หรือ additional environment proof

## 7. Recommended Next Action

1. เปิด PR จาก `codex/local-runtime-finish`
2. ใช้เอกสารนี้คู่กับ [C:\new\docs\GO_LIVE_CHECKLIST_TH.md](/C:/new/docs/GO_LIVE_CHECKLIST_TH.md)
3. รัน staging validation ตามลำดับในหัวข้อ 4
4. เก็บ external proof ก่อนตัดสินใจ deploy จริง
