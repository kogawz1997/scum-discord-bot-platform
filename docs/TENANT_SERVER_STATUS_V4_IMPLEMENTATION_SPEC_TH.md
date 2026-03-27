# Tenant Server Status V4 Implementation Spec

สถานะเอกสาร: implementation-ready draft  
อัปเดตล่าสุด: 2026-03-26  
อ้างอิงร่วม: [TENANT_V4_WIREFRAMES_TH.md](./TENANT_V4_WIREFRAMES_TH.md), [TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)

เอกสารนี้กำหนดวิธีทำหน้า `Server Status` สำหรับ Tenant โดยใช้ข้อมูลจริงจากระบบปัจจุบัน และจัดใหม่ให้เป็นหน้าที่ตอบคำถามเดียวชัด ๆ:

`เซิร์ฟเวอร์ยังพร้อมใช้งานไหม และถ้ามีปัญหาเราควรไปต่อที่ไหน`

## 1. Scope

- route เป้าหมาย: `/tenant/status`
- หน้าหลักสำหรับ:
  - tenant owner
  - tenant admin
  - tenant staff
  - moderator
- owner เข้าดูได้เมื่อเลือก tenant context แล้ว

## 2. Current repo baseline

ไฟล์ฐานที่เกี่ยวข้อง:

- [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js)
- [C:\new\src\admin\api\adminGetRoutes.js](C:/new/src/admin/api/adminGetRoutes.js)
- [C:\new\src\services\platformService.js](C:/new/src/services/platformService.js)
- [C:\new\src\services\platformMonitoringService.js](C:/new/src/services/platformMonitoringService.js)

จุดที่ระบบมีอยู่แล้วและใช้ต่อได้:

- incident aggregation
- delivery runtime status
- notifications
- reconcile summary
- delivery lifecycle
- activity feed

## 3. Page goal

หน้า `/tenant/status` ต้องช่วยได้ 3 อย่าง:

1. ดูว่าสถานะระบบตอนนี้ปกติไหม
2. แยกว่าปัญหามาจาก runtime, queue, sync, หรือ config
3. พาไปหน้าที่ถูกต้องโดยไม่ต้องเดา

## 4. Visual thesis

`calm operations board`

ความรู้สึกที่ต้องได้:

- เหมือนหน้า health center ของ hosting panel
- ใช้สีสถานะอย่างมีวินัย
- ไม่มีการ์ดเกินจำเป็น
- เห็นปัญหาเด่นกว่าข้อมูลรอง

## 5. Layout structure

```text
┌ Page header
│ ├ Title: สถานะเซิร์ฟเวอร์
│ ├ Subtitle: ดูสุขภาพ runtime, sync, queue, และคำเตือนล่าสุด
│ └ Primary action: เปิดการวินิจฉัยระบบ
├ Row A: status strip
├ Row B:
│ ├ Left: incident summary
│ └ Right: runtime readiness
├ Row C:
│ ├ Left: queue + delivery health
│ └ Right: sync + freshness
└ Row D:
  ├ Main: timeline / latest issues
  └ Right rail: recommended next step
```

## 6. Sections

### 6.1 Status strip

ต้องมี 5 ช่อง:

- server readiness
- delivery runtime
- sync freshness
- queue pressure
- current incident count

แต่ละช่องมี:

- ค่าหลัก
- คำอธิบาย 1 บรรทัด
- badge 1-2 อัน

### 6.2 Incident summary

ใช้ incident rows ที่ระบบรวมไว้อยู่แล้ว

แสดง:

- high severity incidents
- dead letters
- queued deliveries
- tenant-tagged notifications

ต้องมี filter เล็ก:

- severity
- kind
- source

### 6.3 Runtime readiness

ใช้ `deliveryRuntime` เป็นฐาน

แสดง:

- current runtime status
- mode
- updated at
- if attention needed: reason or hint

ถ้าระบบยังไม่พร้อม:

- แสดง CTA ไป `Diagnostics`

### 6.4 Queue and delivery health

ใช้:

- `state.queueItems`
- `state.deadLetters`
- `state.deliveryLifecycle`
- analytics.delivery จาก overview

แสดง:

- queue depth
- dead-letter count
- success rate
- overdue or retry-heavy signal

### 6.5 Sync and freshness

ใช้:

- overview analytics
- reconcile generated time
- notifications หรือ issue rows ที่เกี่ยวกับ sync

แสดง:

- last sync
- freshness posture
- sync error count
- current window for reconcile

### 6.6 Latest issues timeline

ใช้:

- `buildTenantIncidentRows()`
- `state.liveEvents`
- notifications ล่าสุด

แสดงเป็นลิสต์เวลา:

- เวลา
- หมวด
- summary
- action shortcut

### 6.7 Right rail

มีเพียง 3 บล็อก:

- next recommended step
- open warnings
- quick links:
  - Diagnostics
  - Delivery
  - Config
  - Restart Control

## 7. Current data mapping

| Block               | Current state key         | Endpoint                                                                                |
| ------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| page scope / tenant | `state.me`                | `/admin/api/me`                                                                         |
| overview analytics  | `state.overview`          | `/admin/api/platform/overview?tenantId={id}`                                            |
| reconcile           | `state.reconcile`         | `/admin/api/platform/reconcile?tenantId={id}&windowMs=3600000&pendingOverdueMs=1200000` |
| quota posture       | `state.quota`             | `/admin/api/platform/quota?tenantId={id}`                                               |
| runtime readiness   | `state.deliveryRuntime`   | `/admin/api/delivery/runtime`                                                           |
| notifications       | `state.notifications`     | `/admin/api/notifications?acknowledged=false&limit=10`                                  |
| queue items         | `state.queueItems`        | `/admin/api/delivery/queue?tenantId={id}&limit=20`                                      |
| dead letters        | `state.deadLetters`       | `/admin/api/delivery/dead-letter?tenantId={id}&limit=20`                                |
| lifecycle report    | `state.deliveryLifecycle` | `/admin/api/delivery/lifecycle?tenantId={id}&limit=80&pendingOverdueMs=1200000`         |
| audit summary       | `state.audit`             | `/admin/api/audit/query?...`                                                            |

## 8. Existing logic to reuse

จาก [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js):

- `buildTenantIncidentRows()`
- `getFilteredTenantIncidents()`
- `renderIncidentCenter()`
- `renderNotifications()`
- `renderActivity()`
- `getTenantOperationalSnapshot()`
- `deliveryLifecycleSignalLabel()`
- `deliveryLifecycleSignalTone()`

แนวทาง:

- reuse logic เดิมก่อน
- เปลี่ยน composition ของหน้า
- แยก rendering เป็น component ใหม่ภายหลัง

## 9. Recommended DOM hook plan

reuse ได้ก่อน:

- `tenantIncidentStats`
- `tenantIncidentFeed`
- `tenantNotificationFeed`
- `tenantActivityFeed`
- `tenantDeliveryLifecycleStats`

เพิ่ม hook ใหม่ใน V4:

- `tenantStatusStrip`
- `tenantRuntimeReadiness`
- `tenantSyncHealthPanel`
- `tenantQueueHealthPanel`
- `tenantNextStepPanel`

## 10. Copy rules

ใช้คำแบบนี้:

- สถานะเซิร์ฟเวอร์
- สุขภาพระบบ
- คิวส่งของ
- ปัญหาที่ต้องดู
- พร้อมใช้งาน
- ต้องตรวจต่อ
- การซิงก์ล่าสุด

ไม่ใช้คำแบบนี้:

- runtime command center
- lifecycle center
- trust fabric
- platform posture

## 11. Empty / error states

### Empty

- ไม่มี incident:
  - ขึ้น “ยังไม่พบปัญหาที่ต้องจัดการตอนนี้”

### Error

- runtime status โหลดไม่ได้:
  - แสดงว่า “โหลดสถานะ runtime ไม่สำเร็จ”
  - แต่ incident / queue ยังต้องแสดงต่อถ้าโหลดได้

### Locked / preview

- ถ้า feature ถูก lock:
  - เห็นหน้า status ได้
  - action เชิงลึกเช่น diagnostics export หรือ restart control เป็น locked state

## 12. Primary action rules

primary action ของหน้า:

- ปกติ = `เปิดการวินิจฉัยระบบ`
- ถ้ามีปัญหารุนแรง = `ตรวจเหตุขัดข้องล่าสุด`
- ถ้า runtime ไม่พร้อม = `ตรวจ runtime`

## 13. Build phases

### Phase A

- สร้าง layout ใหม่
- map incident + runtime + queue blocks เข้าตำแหน่งใหม่

### Phase B

- เติม status strip
- เติม next step panel
- ลด text noise

### Phase C

- เก็บ empty / error / preview state
- เก็บภาษาไทยให้เป็นภาษาปฏิบัติการจริง

## 14. Acceptance criteria

- เปิดหน้าแล้วรู้ใน 5 วินาทีว่าเซิร์ฟเวอร์ปกติไหม
- ถ้ามีปัญหา รู้ว่าต้องกดไปหน้าไหนต่อ
- incident, runtime, queue, sync ไม่ปนกันจนงง
- ไม่ต้องเลื่อนยาวเพื่อเห็นสถานะหลัก
