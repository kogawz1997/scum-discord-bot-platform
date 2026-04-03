# PR Description 2026-04-03

ใช้ข้อความด้านล่างเป็นฐานสำหรับเปิด PR จาก branch `codex/local-runtime-finish`

## Title

`Complete runtime productization, repo-local hardening, and release handoff`

## Summary

PR นี้ปิดก้อน repo-local หลักของรอบปัจจุบัน และเตรียม handoff สำหรับ staging/release ต่อ โดยโฟกัสที่:

- core data และ identity consistency
- billing และ runtime productization
- owner / tenant / player surface polish
- security + readiness sweep
- delivery audit restore hardening
- release / staging / runtime handoff docs

## What Changed

### 1. Core Data + Identity

- ปรับ preview identity state ให้ derive จาก centralized platform identity summary
- ทำให้ linked account summary สะท้อน email, Discord, Steam, และ player-match state ได้สอดคล้องกว่าเดิม

หลักฐาน:

- [C:\new\src\services\platformIdentityService.js](/C:/new/src/services/platformIdentityService.js)
- [C:\new\src\services\publicPreviewService.js](/C:/new/src/services/publicPreviewService.js)

### 2. Commercial + Runtime Productization

- เพิ่ม billing webhook replay safety ระดับ repo
- ปรับ product-facing runtime wording ไปใช้ `Delivery Agent`
- คง compatibility runtime key `console-agent` ไว้เพื่อไม่หักของเดิม

หลักฐาน:

- [C:\new\src\services\platformBillingLifecycleService.js](/C:/new/src/services/platformBillingLifecycleService.js)
- [C:\new\src\delivery-agent.js](/C:/new/src/delivery-agent.js)
- [C:\new\apps\agent\server.js](/C:/new/apps/agent/server.js)
- [C:\new\deploy\pm2.ecosystem.config.cjs](/C:/new/deploy/pm2.ecosystem.config.cjs)

### 3. Surface Polish

- เก็บ owner commercial/support wording
- เก็บ tenant runtime wording
- เก็บ player wording และ portal i18n overrides

หลักฐาน:

- [C:\new\src\admin\assets\owner-control-v4.js](/C:/new/src/admin/assets/owner-control-v4.js)
- [C:\new\src\admin\assets\tenant-v4-app.js](/C:/new/src/admin/assets/tenant-v4-app.js)
- [C:\new\apps\web-portal-standalone\public\assets\player-v4-app.js](/C:/new/apps/web-portal-standalone/public/assets/player-v4-app.js)
- [C:\new\apps\web-portal-standalone\public\assets\portal-i18n.js](/C:/new/apps/web-portal-standalone/public/assets/portal-i18n.js)

### 4. Security + Readiness Sweep

- บันทึก tenant-scope mismatch เป็น security signal
- ปิด regression sweep ฝั่ง security/readiness

หลักฐาน:

- [C:\new\src\admin\runtime\adminAccessRuntime.js](/C:/new/src/admin/runtime/adminAccessRuntime.js)
- [C:\new\src\admin\runtime\adminSecurityRuntime.js](/C:/new/src/admin/runtime/adminSecurityRuntime.js)
- [C:\new\src\adminWebServer.js](/C:/new/src/adminWebServer.js)

### 5. Delivery Audit Restore Hardening

- replace/restore paths ของ delivery audit ตอนนี้ dedupe และ upsert ได้ปลอดภัยกว่าเดิม
- snapshot preview/restore counts ใช้ logical unique rows

หลักฐาน:

- [C:\new\src\store\deliveryAuditStore.js](/C:/new/src/store/deliveryAuditStore.js)
- [C:\new\src\services\adminSnapshotService.js](/C:/new/src/services/adminSnapshotService.js)

### 6. Release / Staging Handoff Docs

- อัปเดต verification status, runtime operator checklist, และ go-live checklist
- เพิ่ม release handoff doc สำหรับ staging/release decision

หลักฐาน:

- [C:\new\docs\VERIFICATION_STATUS_TH.md](/C:/new/docs/VERIFICATION_STATUS_TH.md)
- [C:\new\docs\RUNTIME_OPERATOR_CHECKLIST.md](/C:/new/docs/RUNTIME_OPERATOR_CHECKLIST.md)
- [C:\new\docs\GO_LIVE_CHECKLIST_TH.md](/C:/new/docs/GO_LIVE_CHECKLIST_TH.md)
- [C:\new\docs\RELEASE_HANDOFF_2026-04-03_TH.md](/C:/new/docs/RELEASE_HANDOFF_2026-04-03_TH.md)

## Validation

- `npm test`
- `npm run lint:text`

เอกสารอ้างอิง:

- [C:\new\docs\VERIFICATION_STATUS_TH.md](/C:/new/docs/VERIFICATION_STATUS_TH.md)
- [C:\new\docs\RELEASE_HANDOFF_2026-04-03_TH.md](/C:/new/docs/RELEASE_HANDOFF_2026-04-03_TH.md)

## Operator Impact

- runtime/operator-facing wording เปลี่ยนไปทาง `Delivery Agent`
- repo-local validation และ handoff พร้อมขึ้น
- ยังต้องทำ external proof ต่อก่อน deploy จริง

## Still External / Not Proven By Repo Alone

- live SCUM client proof สำหรับ `Delivery Agent`
- live server machine proof สำหรับ `Server Bot`
- live billing provider behavior
- Discord OAuth / guild role mapping proof
- additional environment proof beyond this workstation
