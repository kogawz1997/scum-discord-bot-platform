# Tenant Server Config V4 Implementation Spec

สถานะเอกสาร: implementation-ready draft  
อัปเดตล่าสุด: 2026-03-26  
อ้างอิงร่วม: [TENANT_V4_WIREFRAMES_TH.md](./TENANT_V4_WIREFRAMES_TH.md), [TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)

เอกสารนี้กำหนดวิธีทำหน้า `Server Config` ของ Tenant ให้ใช้ง่ายแบบแผงควบคุมจริง โดยยังคง backend/config flow เดิมไว้ก่อน

## 1. Scope

- route เป้าหมาย:
  - `/tenant/config`
  - `/tenant/config/:sectionKey`
  - `/tenant/config/backups`
  - `/tenant/config/rollback`
- บทบาทหลัก:
  - tenant owner
  - tenant admin
  - tenant staff ตามสิทธิ์

## 2. Current repo baseline

ไฟล์ฐานที่เกี่ยวข้อง:

- [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js)
- [C:\new\src\admin\api\adminGetRoutes.js](C:/new/src/admin/api/adminGetRoutes.js)
- [C:\new\src\services\platformService.js](C:/new/src/services/platformService.js)

สิ่งที่ระบบมีอยู่ตอนนี้:

- tenant config read ผ่าน `/admin/api/platform/tenant-config?tenantId={id}`
- tenant config edit ในรูป JSON patch groups
- preview diff ฝั่งหน้าเว็บผ่าน:
  - `featureFlags`
  - `configPatch`
  - `portalEnvPatch`

สรุปตรง ๆ:

- ของปัจจุบันยังไม่ใช่ schema-driven `.ini` editor เต็มรูป
- แต่เรามีฐาน “safe patch + preview” อยู่แล้ว
- หน้า V4 ต้องยกระดับ UX ก่อน โดยไม่ทำให้ contract เดิมพัง

## 3. Page goal

หน้า config ต้องตอบคำถาม 4 อย่าง:

1. ตอนนี้กำลังแก้ค่าหมวดไหน
2. อะไรเปลี่ยนไปบ้าง
3. ต้อง restart/apply ไหม
4. ถ้าพัง rollback จากไหน

## 4. Visual thesis

`controlled settings workspace`

ความรู้สึก:

- เรียบ
- ระวัง
- อ่านง่าย
- ให้ความมั่นใจว่ากำลังแก้ของจริง ไม่ใช่ sandbox

## 5. Layout structure

```text
┌ Page header
│ ├ Title: การตั้งค่าเซิร์ฟเวอร์
│ ├ Subtitle: แก้ค่าทีละหมวดพร้อม preview ก่อนบันทึก
│ └ Primary action: บันทึก / บันทึกและใช้ทันที
├ Left section rail
├ Main config form
├ Bottom change summary
└ Right rail
  ├ restart-required badges
  ├ backup history
  ├ validation notes
  └ advanced/raw editor
```

## 6. Information architecture

### 6.1 `/tenant/config`

เป็นหน้า entry ของงาน config

ต้องมี:

- section categories
- recently changed groups
- pending draft changes
- backup history shortcut
- warning if current draft differs from live

### 6.2 `/tenant/config/:sectionKey`

เป็นหน้าทำงานจริง

ต้องมี:

- section sidebar
- grouped fields
- inline validation
- preview summary
- save actions

### 6.3 `/tenant/config/backups`

ดู backup และ restore entry

### 6.4 `/tenant/config/rollback`

ใช้ยืนยัน rollback แบบมี guardrails

## 7. Transitional implementation model

เนื่องจาก backend ปัจจุบันยังใช้ patch groups อยู่ ให้ทำ 2 ชั้น:

### Layer 1: UX layer ใหม่

ผู้ใช้เห็น:

- หมวดการตั้งค่า
- ฟิลด์แบบอ่านง่าย
- ป้ายว่าต้อง restart หรือไม่
- preview ว่าแก้อะไรไปบ้าง

### Layer 2: compatibility layer เดิม

ระบบแปลงค่ากลับเป็น:

- `featureFlags`
- `configPatch`
- `portalEnvPatch`

ดังนั้น:

- หน้าใหม่ไม่ต้องรอ backend ใหม่ถึงเริ่มทำได้
- และยังไม่ทำให้ API เดิมพัง

## 8. Current data mapping

| Block                   | Current state key                          | Endpoint / source                                 |
| ----------------------- | ------------------------------------------ | ------------------------------------------------- |
| tenant config live data | `state.tenantConfig`                       | `/admin/api/platform/tenant-config?tenantId={id}` |
| feature flag draft      | `tenantConfigForm.elements.featureFlags`   | current DOM form                                  |
| config patch draft      | `tenantConfigForm.elements.configPatch`    | current DOM form                                  |
| portal env draft        | `tenantConfigForm.elements.portalEnvPatch` | current DOM form                                  |
| preview diff            | `state.configPreview`                      | `buildConfigPreview()`                            |
| changed key summary     | `summarizeConfigDiff()`                    | current browser logic                             |

## 9. Existing logic to reuse

จาก [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js):

- `fillConfigForm()`
- `buildConfigPreview()`
- `renderConfigPreview()`
- `summarizeConfigDiff()`

แนวทาง:

- ใช้ logic พวกนี้ต่อในช่วงแรก
- เปลี่ยนหน้าตาและลำดับการนำเสนอ
- ค่อยย้ายไป schema-driven form layer ภายหลัง

## 10. Recommended V4 sections

### Section A: Server basics

- server name
- public labels
- high-level toggles

### Section B: Delivery and integrations

- related flags
- integration toggles
- webhook / portal env related values

### Section C: Player-facing controls

- features ที่กระทบ player portal
- rewards / shop related toggles

### Section D: Advanced

- raw patch groups
- feature flags JSON
- portal env patch JSON

หมายเหตุ:

- ในเฟสแรก fields แบบ typed อาจยังไม่ครบทุก key
- แต่ต้องทำ section model ให้รองรับ typed fields ได้ทันทีเมื่อ schema เพิ่มมา

## 11. Page sections

### 11.1 Header

ต้องมี:

- ชื่อหมวด
- คำอธิบายสั้น
- status chip:
  - draft changed / no changes
  - restart required / no restart
- actions:
  - บันทึก
  - บันทึกและใช้ทันที
  - บันทึกและรีสตาร์ต

### 11.2 Section sidebar

ต้องแสดง:

- list ของ config sections
- changed marker
- dangerous/advanced sections แยกอยู่ล่างสุด

### 11.3 Main form

เฟสแรก:

- ใช้ grouped editors ที่ map ไป JSON patch เดิม
- มี helper text ชัดว่าค่าชุดนี้กระทบส่วนไหน

เฟสต่อไป:

- ย้ายไป typed schema form

### 11.4 Change summary

ใช้ข้อมูลจาก `state.configPreview`

แสดง:

- changed groups
- changed top-level keys
- draft keys count
- last preview time

### 11.5 Right rail

มี:

- backup history
- validation notes
- restart-required notes
- advanced/raw editor entry

## 12. Backup and rollback experience

### `/tenant/config/backups`

ต้องมีตาราง:

- backup id
- source group
- created by
- created at
- verification state
- rollback ready

primary action:

- เปิด preview restore

### `/tenant/config/rollback`

ต้องมี:

- selected backup summary
- diff summary
- checklist ก่อน rollback
- confirm action แยกชัด

## 13. Copy rules

ใช้คำแบบนี้:

- การตั้งค่าเซิร์ฟเวอร์
- หมวดการตั้งค่า
- เปลี่ยนแปลงที่รอการบันทึก
- ต้องรีสตาร์ต
- บันทึกและใช้ทันที
- สำรองข้อมูล
- ย้อนกลับการตั้งค่า

ไม่ใช้คำแบบนี้:

- config workbench
- live diff engine
- patch composer
- portal env surface

## 14. Empty / error / locked states

### Empty

- ยังไม่มี draft:
  - แสดงว่า “ยังไม่มีการเปลี่ยนแปลงที่รอบันทึก”

### Error

- โหลด tenant config ไม่ได้:
  - แสดงว่า “โหลดการตั้งค่าไม่สำเร็จ”
  - พร้อมปุ่ม retry

### Locked

- ไม่มีสิทธิ์แก้:
  - เห็นได้
  - save actions disabled
  - แสดงเหตุผลว่าเป็น read-only

## 15. Recommended DOM hook plan

reuse ได้:

- `tenantConfigForm`
- `tenantConfigPreview`

ควรเพิ่ม:

- `tenantConfigSectionRail`
- `tenantConfigHeaderStatus`
- `tenantConfigChangeSummary`
- `tenantConfigBackupRail`
- `tenantConfigAdvancedEntry`

## 16. Build phases

### Phase A

- แยกหน้า config ออกจาก dashboard composition
- สร้าง section layout ใหม่
- reuse form + preview logic เดิม

### Phase B

- เพิ่ม section model
- เพิ่ม clearer save/apply/restart actions
- เพิ่ม backup rail

### Phase C

- เริ่ม map field groups จาก raw JSON ไป typed fields
- ค่อยเก็บ advanced/raw editor ไปไว้ชั้นลึก

## 17. Acceptance criteria

- คนที่ไม่ใช่ dev เปิดหน้าแล้วเข้าใจว่ากำลังแก้หมวดไหน
- รู้ว่ามีอะไรเปลี่ยน
- รู้ว่าต้อง restart หรือไม่
- หา backup/rollback เจอโดยไม่ต้องเดา
- ยังใช้ backend/config contract เดิมได้ในเฟสแรก
