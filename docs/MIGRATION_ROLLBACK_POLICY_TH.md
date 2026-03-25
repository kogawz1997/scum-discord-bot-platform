# Migration / Rollback / Restore Policy

เอกสารนี้ใช้เป็น policy กลางสำหรับการย้าย schema, การ deploy migration, การ rollback release, และการ restore snapshot ใน production โดยแยกสถานะให้ชัดว่าอะไร `implemented`, อะไร `verified`, และอะไรยัง `experimental`

อัปเดตล่าสุด: **2026-03-25**

---

## 1. สถานะปัจจุบัน

### Implemented

- Prisma migration path สำหรับ schema หลักของระบบ
- production guardrails: `doctor`, `security:check`, `readiness:prod`, `smoke:postdeploy`
- safe restore guardrails:
  - dry-run diff
  - preview token + expiry
  - confirm backup name
  - maintenance gate ระหว่าง restore
  - rollback backup อัตโนมัติ
  - restore status ติดตามย้อนหลังได้
- step-up auth สำหรับงานเสี่ยง เช่น `config`, `backup`, `restore`, `bulk delivery retry`, `platform secret surfaces`
- restore รองรับ snapshot ที่ไม่มี collection ใหม่บางชุด โดย fallback เป็น empty/runtime defaults แทนการพัง

### Verified

- admin restore / preview / status flow ผ่าน integration tests
- role-matrix และ step-up protected routes ผ่าน tests
- snapshot restore compatibility กับ backup ที่ไม่มีฟิลด์ auth/runtime รุ่นใหม่ ผ่าน tests
- backup parser รองรับ `schemaVersion=1`, legacy wrapped payload ที่ไม่มี `schemaVersion`, และ legacy raw snapshot payload ผ่าน tests
- production checks ผ่าน `lint`, `test`, `doctor`, `security:check`, `readiness:prod`

### Experimental / Operational Dependency

- live migration บน dataset ขนาดใหญ่ยังต้องทำใน maintenance window
- rollback ข้ามหลาย release พร้อม schema drift มากกว่า 1 generation ยังไม่ควรทำแบบข้ามขั้น
- game-side effects จาก restore หรือ delivery ยังขึ้นกับ runtime ภายนอก เช่น Windows session, SCUM client, และ topology production จริง

---

## 2. Evidence Map

| เรื่อง                                      | Source / Route                                                                | Evidence                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| restore preview + execute                   | `POST /admin/api/backup/restore`, `GET /admin/api/backup/restore/status`      | `test/admin-api.integration.test.js`                                 |
| step-up policy สำหรับ route เสี่ยง          | `src/utils/adminPermissionMatrix.js`                                          | `test/admin-permission-matrix.test.js`                               |
| restore compatibility กับ snapshot รุ่นเก่า | `src/services/adminSnapshotService.js`                                        | `test/admin-snapshot-compatibility.test.js`                          |
| backup parser compatibility matrix          | `normalizeAdminBackupPayload(...)`                                            | `test/admin-snapshot-compatibility.test.js`                          |
| restore state + rollback backup             | `src/services/adminSnapshotService.js`, `src/store/adminRestoreStateStore.js` | `docs/OPERATIONS_MANUAL_TH.md`, `docs/GO_LIVE_CHECKLIST_TH.md`       |
| production readiness boundary               | `scripts/doctor.js`, `scripts/security-check.js`, `scripts/readiness-gate.js` | `npm run doctor`, `npm run security:check`, `npm run readiness:prod` |

---

## 3. Migration Policy

ก่อน deploy migration ทุกครั้ง:

1. ยืนยันว่า branch/release ตรงกับ environment ที่จะอัปเกรด
2. รัน `npm run lint` และ `npm test`
3. รัน `npm run doctor` และ `npm run security:check`
4. สร้าง backup ล่าสุดก่อนทุกครั้ง
5. ถ้า migration กระทบ data shape หรือ runtime config ให้สร้าง restore preview และเก็บ diff ไว้
6. deploy code + migration ใน maintenance window ถ้ามีความเสี่ยงต่อ queue, wallet, purchase, หรือ delivery runtime

ข้อกำหนด:

- production ต้องใช้ DB path ที่ชัดเจนและห้ามพึ่ง legacy snapshot เป็น persistence หลัก
- migration ต้องเป็น forward-only ในรอบ deploy ปกติ
- ถ้าต้องเปลี่ยน config สำคัญ ให้ใช้ step-up auth และบันทึก audit/security events ทุกครั้ง

---

## 4. Rollback Policy

ถ้า deploy ใหม่ผิดปกติ:

1. หยุด traffic write ที่เสี่ยงก่อน
2. rollback application release ก่อน ถ้าปัญหาอยู่ที่ runtime/code
3. ถ้าข้อมูลเสียหรือ schema/data mismatch ให้ใช้ backup ล่าสุดที่ผ่าน preview แล้ว
4. restore ต้องทำผ่าน flow ที่มี:
   - preview token ที่ยังไม่หมดอายุ
   - confirm backup name
   - maintenance gate
   - rollback backup อัตโนมัติ
5. หลัง rollback/restore ต้องรัน:
   - `npm run doctor`
   - `npm run security:check`
   - `npm run readiness:prod`
   - `npm run smoke:postdeploy`

ห้าม:

- restore ทับ production แบบไม่ดู diff ล่วงหน้า
- rollback ข้าม release หลายชั้นโดยไม่มี backup ของช่วงกลาง
- เปิด write traffic กลับมาก่อน readiness และ smoke ผ่าน

---

## 5. Restore Compatibility Policy

backup schema ปัจจุบันยังยึด `schemaVersion=1` และ restore layer ต้องทนกับการที่ backup เก่าไม่มี collection ใหม่บางตัว เช่น:

- `adminSecurityEvents`
- `adminNotifications`
- `adminCommandCapabilityPresets`
- `platformOpsState`
- `backupRestore`
- `deliveryRuntime`
- `runtimeSupervisor`

compatibility matrix ปัจจุบัน:

| schemaVersion    | รูปแบบไฟล์                                                   | สถานะ                                     |
| ---------------- | ------------------------------------------------------------ | ----------------------------------------- |
| `1`              | current wrapped payload (`{ schemaVersion, snapshot, ... }`) | supported                                 |
| `0` หรือไม่มีค่า | legacy wrapped payload (`{ snapshot, ... }`)                 | supported                                 |
| ไม่มี wrapper    | legacy raw snapshot object                                   | supported                                 |
| `>= 2`           | future payload                                               | blocked จนกว่าจะมี migration/compat layer |

หลักการคือ:

- collection ที่หายไปต้อง fallback เป็น empty list หรือ runtime default
- restore ห้าม throw เพียงเพราะไม่มี metadata รุ่นใหม่
- metadata ใหม่ต้องไม่ทำให้ backup รุ่นเก่าใช้ไม่ได้

---

## 6. Operator Checklist

ก่อน migration หรือ restore จริง:

- มี backup ล่าสุด
- มี rollback owner ชัดเจน
- มี maintenance window
- มีคนถือ 2FA ที่ทำ step-up ได้
- มี evidence ว่า `doctor/security/readiness` ผ่านก่อนเริ่ม

หลังจบงาน:

- เก็บชื่อ backup ที่ใช้
- เก็บผล diff / warning ที่ preview แจ้ง
- บันทึกเวลาที่เริ่มและจบ
- เช็ก runtime supervisor, notification center, และ auth security events ว่าปกติ

---

## 7. Restore / Rollback Maturity Ladder

ให้ใช้กรอบนี้เวลาอธิบายว่า restore/rollback ไปถึงระดับไหนแล้ว:

### Level 1: Guarded manual restore

มีแล้วใน repo ปัจจุบัน:

- preview token
- maintenance gate
- rollback backup อัตโนมัติ
- status ติดตามย้อนหลังได้
- post-restore validation ผ่านคำสั่งมาตรฐาน

### Level 2: Rehearsed operator restore

สิ่งที่ควรมีเพิ่มก่อนเรียกว่าแข็งแรงระดับ production มากขึ้น:

- restore drill ที่ทำจริงบน environment ซ้อม
- evidence ของเวลาเริ่ม/จบ
- evidence ของ post-restore checks
- operator คนอื่นทำตาม runbook เดียวกันได้โดยไม่ต้องเดาเอง

### Level 3: Mature recovery posture

ยังไม่ควรอ้างว่าปิดแล้วจนกว่าจะมี:

- repeated restore drills หลายรอบ
- rollback decision tree ที่ใช้กับ incident จริง
- acceptance เกี่ยวกับ queue, wallet, delivery, และ tenant config หลัง restore
- clear RTO/RPO evidence ต่อ environment
