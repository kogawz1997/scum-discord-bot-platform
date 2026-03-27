# Tenant Players V4 Implementation Spec

สถานะเอกสาร: implementation-ready draft  
อัปเดตล่าสุด: 2026-03-26  
อ้างอิงร่วม: [TENANT_V4_WIREFRAMES_TH.md](./TENANT_V4_WIREFRAMES_TH.md), [TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)

เอกสารนี้กำหนดวิธีทำหน้า `Players` ของ Tenant ให้เป็นศูนย์กลางการดูแลผู้เล่น ไม่ใช่แค่ตารางรายชื่อ

## 1. Scope

- route เป้าหมาย:
  - `/tenant/players`
  - `/tenant/players/:playerId`
  - `/tenant/players/:playerId/wallet`
- surface เริ่มต้นที่ควรทำก่อน: `/tenant/players`

## 2. Current repo baseline

ไฟล์ฐานที่เกี่ยวข้อง:

- [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js)
- [C:\new\src\admin\api\adminGetRoutes.js](C:/new/src/admin/api/adminGetRoutes.js)

สิ่งที่ระบบมีอยู่จริงตอนนี้:

- player accounts list
- Steam/in-game identity signals
- wallet support shortcut
- Steam support shortcut
- audit query
- purchase lookup ที่ผูกกับ user/player context ได้

## 3. Page goal

หน้า Players ต้องช่วยได้ 4 อย่าง:

1. หา player ได้เร็ว
2. ดู linked account และสถานะตัวตนได้
3. ไปต่อเรื่อง wallet, order, delivery, หรือ Steam support ได้เร็ว
4. เห็นสัญญาณว่าผู้เล่นคนนี้มีปัญหาอะไรค้างอยู่

## 4. Visual thesis

`support-oriented player registry`

ความรู้สึก:

- เป็นระเบียบ
- ไว้ใจได้
- เหมาะกับงาน support
- ไม่ดูเหมือนแค่ user table ธรรมดา

## 5. Layout structure

```text
┌ Page header
│ ├ Title: ผู้เล่น
│ ├ Subtitle: ค้นหาผู้เล่น ดูการเชื่อมบัญชี และเปิดงานซัพพอร์ต
│ └ Primary action: ค้นหาผู้เล่น
├ Row A: player summary strip
├ Row B:
│ ├ Left: filters + players table
│ └ Right: selected player summary
└ Row C:
  ├ Left: linked identity / activity / order context
  └ Right rail: support actions
```

## 6. Main sections

### 6.1 Player summary strip

ต้องมี:

- known players
- linked Steam accounts
- active players
- flagged / needs support

### 6.2 Players table

columns ขั้นต่ำ:

- player
- Discord / user id
- Steam / in-game
- status
- updated

เฟสต่อไปเพิ่มได้:

- wallet
- order count
- flags

### 6.3 Selected player summary

ต้องมี:

- display name
- Discord identity
- Steam identity
- in-game name
- active/inactive state
- last updated

### 6.4 Linked identity and activity context

ใช้สำหรับเชื่อมกับหน้าอื่น

ต้องมี:

- account linking state
- last order status
- recent delivery concern
- recent support context

### 6.5 Right rail

ต้องมี support shortcuts:

- เปิด wallet support
- เปิด Steam support
- เปิด order history
- เปิด delivery case

## 7. Current data mapping

| Block            | Current state key      | Endpoint                                               |
| ---------------- | ---------------------- | ------------------------------------------------------ |
| player list      | `state.players`        | `/admin/api/player/accounts?tenantId={id}&limit=20`    |
| purchase context | `state.purchaseLookup` | `/admin/api/purchase/list?...`                         |
| delivery case    | `state.deliveryCase`   | `/admin/api/delivery/detail?...`                       |
| audit snapshot   | `state.audit`          | `/admin/api/audit/query?...`                           |
| notifications    | `state.notifications`  | `/admin/api/notifications?acknowledged=false&limit=10` |

## 8. Existing logic to reuse

จาก [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js):

- ตาราง `tenantPlayersTable`
- `runTenantSupportToolkitAction()`
- wallet support shortcuts
- Steam support shortcuts
- purchase lookup ที่รับ user id

reuse strategy:

- ใช้ list เดิมเป็นฐานของ `/tenant/players`
- เพิ่ม selected player summary และ support rail
- ค่อยขยายเป็น player detail page ภายหลัง

## 9. Recommended DOM hook plan

reuse ได้:

- `tenantPlayersTable`

ควรเพิ่ม:

- `tenantPlayersSummaryStrip`
- `tenantPlayerSelectedSummary`
- `tenantPlayerIdentityPanel`
- `tenantPlayerSupportRail`
- `tenantPlayerContextPanel`

## 10. Page composition

### 10.1 `/tenant/players`

เป็นหน้าหลักของงานผู้เล่น

ต้องมี:

- summary strip
- table
- selected player summary
- support rail

### 10.2 `/tenant/players/:playerId`

เป็นหน้า detail ของผู้เล่นรายคน

tabs:

- Overview
- Wallet
- Orders
- Delivery
- Activity
- Linked Accounts

### 10.3 `/tenant/players/:playerId/wallet`

เป็นหน้า wallet support โดยเฉพาะ

ใช้เมื่อมีปัญหากระเป๋าเงินหรือ ledger

## 11. Copy rules

ใช้คำแบบนี้:

- ผู้เล่น
- การเชื่อมบัญชี
- บัญชี Discord
- บัญชี Steam
- ชื่อในเกม
- ต้องช่วยเหลือ
- ประวัติคำสั่งซื้อ
- ปัญหาการส่งของ

ไม่ใช้คำแบบนี้:

- identity fabric
- player registry workbench
- support context engine

## 12. Empty / error / locked states

### Empty

- ยังไม่มี player accounts:
  - แสดงว่า “ยังไม่พบผู้เล่นใน tenant นี้”
  - แนะนำให้เช็ก sync/logs ถ้าควรมีข้อมูลแล้ว

### Error

- player accounts โหลดไม่ได้:
  - แสดงว่า “โหลดรายชื่อผู้เล่นไม่สำเร็จ”
  - ให้ปุ่ม retry

### Locked

- ถ้า package ไม่มี player module:
  - หน้านี้เปิดได้แบบ preview
  - support actions จริงถูก lock

## 13. Primary action rules

primary action ของหน้า:

- ปกติ = `ค้นหาผู้เล่น`
- ถ้ามีผู้เล่นที่ถูกเลือกอยู่ = `เปิดประวัติคำสั่งซื้อ`

## 14. Build phases

### Phase A

- ทำ list page ใหม่จาก players table เดิม
- เพิ่ม selected summary + support rail

### Phase B

- ทำ player detail route
- เชื่อม wallet, orders, delivery, linked accounts เป็นแท็บ

### Phase C

- เพิ่ม flags และ support signals
- เพิ่ม empty/preview/locked states ให้ครบ

## 15. Acceptance criteria

- operator หา player ได้เร็ว
- รู้ว่าผู้เล่นผูก Steam หรือยัง
- เปิด flow support ต่อได้ใน 1-2 คลิก
- หน้า players ไม่เป็นแค่ตาราง แต่เป็นจุดเริ่มของการช่วยผู้เล่นจริง
