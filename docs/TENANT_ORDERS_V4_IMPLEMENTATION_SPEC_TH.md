# Tenant Orders V4 Implementation Spec

สถานะเอกสาร: implementation-ready draft  
อัปเดตล่าสุด: 2026-03-26  
อ้างอิงร่วม: [TENANT_V4_WIREFRAMES_TH.md](./TENANT_V4_WIREFRAMES_TH.md), [TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)

เอกสารนี้กำหนดวิธีทำหน้า `Orders` ของ Tenant ให้เป็นหน้าทำงานจริงสำหรับทีมดูแลผู้เล่น โดยรวม `คำสั่งซื้อ + สถานะการส่งของ + delivery case` ไว้ใน flow เดียวที่เข้าใจง่าย

## 1. Scope

- route เป้าหมาย:
  - `/tenant/orders`
  - `/tenant/orders/:orderId`
  - `/tenant/delivery`
  - `/tenant/delivery/results`
  - `/tenant/delivery/proofs`
- surface เริ่มต้นที่ควรทำก่อน: `/tenant/orders`

## 2. Current repo baseline

ไฟล์ฐานที่เกี่ยวข้อง:

- [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js)
- [C:\new\src\admin\api\adminGetRoutes.js](C:/new/src/admin/api/adminGetRoutes.js)

ข้อมูลและ flow ที่มีอยู่จริงตอนนี้:

- purchase lookup by user + status
- purchase status catalog
- queue list
- dead-letter list
- delivery detail case
- delivery lifecycle
- audit query

## 3. Page goal

หน้า Orders ต้องตอบคำถาม 4 อย่าง:

1. ผู้เล่นคนนี้ซื้ออะไรไป
2. ตอนนี้ order อยู่สถานะไหน
3. ถ้าของยังไม่เข้า ปัญหาอยู่ที่ queue, dead-letter, หรือ player context
4. ต้องทำอะไรต่อโดยไม่เดา

## 4. Visual thesis

`support-first transaction workspace`

ความรู้สึก:

- เหมือนหน้าทำงาน support/operations จริง
- เน้นการอ่านสถานะเร็ว
- มีหลักฐานพอให้ตัดสินใจ
- ไม่รกด้วยข้อมูลที่ไม่ช่วย resolve ปัญหา

## 5. Layout structure

```text
┌ Page header
│ ├ Title: คำสั่งซื้อและการส่งของ
│ ├ Subtitle: ค้นคำสั่งซื้อ ดูสถานะ และเปิดเคสการส่งของ
│ └ Primary action: ค้นคำสั่งซื้อ
├ Row A: transaction summary strip
├ Row B:
│ ├ Left: search and filters
│ └ Right: status legend / support note
├ Row C:
│ ├ Left: order table
│ └ Right: selected order summary
└ Row D:
  ├ Left: delivery case workspace
  └ Right rail: next step + related support shortcuts
```

## 6. Main sections

### 6.1 Transaction summary strip

ต้องมี:

- total visible orders
- queued deliveries
- dead letters
- latest success rate

### 6.2 Search and filters

ต้องมี:

- Discord user id / player id
- status filter
- date or time scope ในเฟสถัดไป

primary action:

- โหลดคำสั่งซื้อ

### 6.3 Order table

ใช้รายการ purchase เป็นแกน

columns ขั้นต่ำ:

- purchase code
- item / product
- status
- player
- amount
- created at
- action

action สำคัญ:

- `เปิดเคส`

### 6.4 Selected order summary

อยู่ด้านขวาของตาราง

ต้องมี:

- order id
- player
- payment amount
- status
- delivery state
- related queue/dead-letter hint

### 6.5 Delivery case workspace

เป็นหัวใจของหน้า Orders

หน้าที่:

- รวม purchase context
- queue/dead-letter/runtime artifacts
- timeline
- audit count
- recommended next actions

### 6.6 Right rail

ต้องมี:

- support shortcuts
  - wallet support
  - Steam support
  - delivery lab
- next step recommendation
- status legend

## 7. Current data mapping

| Block                      | Current state key             | Endpoint                                                                        |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| purchase lookup form state | `state.purchaseLookup`        | client-side state                                                               |
| purchase table data        | `state.purchaseLookup.items`  | `/admin/api/purchase/list?...`                                                  |
| known statuses             | `state.purchaseStatusCatalog` | `/admin/api/purchase/statuses`                                                  |
| queue list                 | `state.queueItems`            | `/admin/api/delivery/queue?tenantId={id}&limit=20`                              |
| dead-letter list           | `state.deadLetters`           | `/admin/api/delivery/dead-letter?tenantId={id}&limit=20`                        |
| delivery detail            | `state.deliveryCase`          | `/admin/api/delivery/detail?tenantId={id}&code={purchaseCode}&limit=80`         |
| lifecycle report           | `state.deliveryLifecycle`     | `/admin/api/delivery/lifecycle?tenantId={id}&limit=80&pendingOverdueMs=1200000` |
| audit rows                 | `state.audit`                 | `/admin/api/audit/query?...`                                                    |

## 8. Existing logic to reuse

จาก [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js):

- `renderPurchaseStatusOptions()`
- `renderPurchaseInspector()`
- `loadPurchases()`
- `handlePurchaseLookupSubmit()`
- `renderDeliveryCase()`
- `loadDeliveryCase()`
- `getDeliveryCasePhase()`
- `buildDeliveryCaseActions()`

reuse strategy:

- ใช้ logic เดิมในการโหลดและแปลสถานะก่อน
- เปลี่ยน composition ของหน้าให้เป็น orders-first
- เมื่อหน้าตาใหม่นิ่งแล้วค่อยแตกเป็น component ย่อย

## 9. Recommended DOM hook plan

reuse ได้:

- `tenantPurchaseLookupForm`
- `tenantPurchaseTable`
- `tenantDeliveryCaseForm`
- `tenantDeliveryCaseStats`
- `tenantDeliveryCaseMeta`
- `tenantDeliveryCaseTimeline`
- `tenantDeliveryCaseActions`
- `tenantDeliveryCaseExportBtn`

ควรเพิ่ม:

- `tenantOrderSummaryStrip`
- `tenantOrderSelectedSummary`
- `tenantOrderStatusLegend`
- `tenantOrderSupportRail`

## 10. Page composition

### 10.1 `/tenant/orders`

เป็นหน้าหลักของงาน transaction support

ต้องมี:

- summary strip
- search/filter block
- order table
- selected order summary
- delivery case panel

### 10.2 `/tenant/orders/:orderId`

เป็นหน้า detail เมื่ออยากดู order รายตัวเต็ม

tabs:

- Overview
- Items
- Delivery
- Audit
- Support

### 10.3 `/tenant/delivery`

เป็นหน้าที่เน้น queue health

ใช้เมื่อ operator ต้องดูภาพรวมคิว ไม่ใช่ support ราย order

### 10.4 `/tenant/delivery/results`

ใช้ดูผลลัพธ์ delivery ที่เสร็จแล้ว

### 10.5 `/tenant/delivery/proofs`

ใช้ดู proof/evidence โดยเฉพาะ

## 11. Copy rules

ใช้คำแบบนี้:

- คำสั่งซื้อ
- การส่งของ
- คิวส่งของ
- รายการที่ส่งไม่สำเร็จ
- เปิดเคส
- ตรวจหลักฐาน
- สถานะปัจจุบัน

ไม่ใช้คำแบบนี้:

- transaction workbench
- delivery lifecycle hub
- runtime artifact center

## 12. Empty / error / locked states

### Empty

- ยังไม่ได้กรอก player/user id:

  - แสดงว่า “กรอก Discord user ID ก่อนเพื่อดูประวัติคำสั่งซื้อ”

- ไม่มี order:
  - แสดงว่า “ไม่พบคำสั่งซื้อสำหรับผู้เล่นและตัวกรองนี้”

### Error

- purchase lookup ล้มเหลว:

  - แสดงว่า “โหลดคำสั่งซื้อไม่สำเร็จ”
  - ยังรักษาข้อมูลก่อนหน้าไว้ถ้าเหมาะสม

- delivery case ล้มเหลว:
  - แสดงว่า “โหลดเคสการส่งของไม่สำเร็จ”

### Locked

- ถ้า package ไม่มีสิทธิ์ delivery features:
  - หน้า orders ยังเปิดได้
  - delivery-specific action ถูก lock พร้อมเหตุผล

## 13. Primary action rules

primary action ของหน้า:

- ปกติ = `ค้นคำสั่งซื้อ`
- ถ้ามี dead-letter หนัก = `เปิดเคสล่าสุด`

## 14. Build phases

### Phase A

- ย้าย purchase lookup + purchase table ไปหน้าใหม่
- ย้าย delivery case workspace มาประกบขวา/ล่าง

### Phase B

- เติม order summary strip
- เติม selected order summary
- รวม queue/dead-letter context ให้เห็นในหน้าเดียว

### Phase C

- แตก routes ย่อย `/tenant/orders/:orderId`
- แยก proof/result pages ตาม wireframe

## 15. Acceptance criteria

- operator หา order ของผู้เล่นคนหนึ่งได้ในไม่กี่วินาที
- เปิด delivery case ได้จากตารางทันที
- รู้ว่าปัญหาอยู่ที่ queue, dead-letter, runtime, หรือ player context
- ไม่ต้องกระโดดหลายหน้าเพื่อช่วยผู้เล่น 1 เคส
