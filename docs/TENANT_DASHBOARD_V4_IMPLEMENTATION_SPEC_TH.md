# Tenant Dashboard V4 Implementation Spec

สถานะเอกสาร: implementation-ready draft  
อัปเดตล่าสุด: 2026-03-26  
อ้างอิงร่วม: [TENANT_V4_WIREFRAMES_TH.md](./TENANT_V4_WIREFRAMES_TH.md), [WEB_SURFACES_V4_BLUEPRINT_TH.md](./WEB_SURFACES_V4_BLUEPRINT_TH.md), [WEB_SURFACES_V4_SITEMAP_TH.md](./WEB_SURFACES_V4_SITEMAP_TH.md)

เอกสารนี้ใช้สำหรับเริ่มลงมือทำ `Tenant Dashboard V4` จากของจริงในโปรเจกต์ โดยไม่เปลี่ยน auth, session, route หรือ API contract เดิม

## 1. Scope

เริ่มจากหน้า:

- route: `/tenant`
- หน้าเป้าหมาย: Dashboard
- บทบาทหลัก: `tenant_owner`, `tenant_admin`, `tenant_staff`, `moderator`
- owner สามารถเข้ามาดูผ่าน tenant context ได้ แต่ไม่ควรเห็น owner-only actions ในหน้านี้

เอกสารนี้ครอบคลุม:

- visual direction
- layout hierarchy
- component list
- data mapping จาก endpoint ที่มีอยู่จริง
- DOM hook reuse plan
- implementation phases

## 2. Current repo baseline

ไฟล์ที่เป็นฐานตอนนี้:

- [C:\new\src\admin\tenant-console.html](C:/new/src/admin/tenant-console.html)
- [C:\new\src\admin\assets\tenant-console.js](C:/new/src/admin/assets/tenant-console.js)
- [C:\new\src\admin\api\adminGetRoutes.js](C:/new/src/admin/api/adminGetRoutes.js)
- [C:\new\src\services\platformService.js](C:/new/src/services/platformService.js)
- [C:\new\src\services\adminDashboardService.js](C:/new/src/services/adminDashboardService.js)

หมายเหตุสำคัญ:

- ตอนนี้เครื่องนี้อยู่ใน `Discord-only` mode ทำให้หน้า HTML เป็น stub
- spec นี้จึงเป็น “แบบเริ่มลงมือ” สำหรับตอนที่เราจะเปิด tenant web กลับมา
- route `/tenant` ต้องคงเดิม
- API contracts เดิมต้องคงเดิม

## 3. Visual thesis

`dark hosting control panel with calm tactical character`

ความรู้สึกที่ต้องได้:

- ทันสมัย
- มืออาชีพ
- ใช้งานเร็ว
- มีอารมณ์ SCUM เบา ๆ
- ไม่เป็นเกม UI

สิ่งที่ต้องหลีกเลี่ยง:

- hero ใหญ่
- card mosaic เต็มหน้า
- glow หนัก
- คำอธิบายยาวก่อนถึงเนื้องาน

## 4. Content plan

Tenant Dashboard ต้องมี 4 งานเท่านั้น:

1. บอกสุขภาพระบบตอนนี้
2. พาไปงานประจำวันให้เร็ว
3. เตือนปัญหาที่ค้างอยู่
4. บอกสิ่งที่ควรทำต่อ

ดังนั้น layout ต้องแบ่งเป็น:

- status strip
- task hub
- issue center
- operational context

## 5. Interaction thesis

motion ที่ควรมี:

- header และ KPI fade-up เบา ๆ ตอนโหลดเสร็จ
- quick action tiles ยกตัวเล็กน้อยตอน hover
- incident list และ activity list ใช้ subtle highlight เมื่อมี selection

motion ที่ไม่ควรมี:

- parallax
- moving background
- animation ต่อเนื่องที่รบกวนการทำงาน

## 6. Layout structure

```text
┌ Tenant top bar
├ Tenant sidebar
└ Main stage
  ├ Page header
  │ ├ Title + one-line description
  │ ├ Status chips
  │ └ Primary action
  ├ Row A: KPI strip
  ├ Row B: Task hub
  ├ Row C:
  │ ├ Left: incident / warning center
  │ └ Right: operational context
  └ Row D:
    ├ Left: delivery + reconcile insight
    └ Right rail: next step / notifications / package posture
```

## 7. Page sections

### 7.1 Page header

หน้าที่:

- บอกว่าตอนนี้เป็น tenant ไหน
- บอก package และ operational tone
- มี action หลักเพียง 1 อย่าง

โครง:

- `title`: ชื่อ tenant
- `subtitle`: งานประจำวันของเซิร์ฟเวอร์นี้
- `status chips`:
  - package
  - server status
  - delivery runtime
  - last sync
- `primary action`:
  - ถ้า runtime พร้อม: `ดูสถานะเซิร์ฟเวอร์`
  - ถ้า runtime ยังไม่พร้อม: `ตั้งค่า runtime`

### 7.2 KPI strip

เป้าหมาย:

- ให้สแกน 5-6 ค่าแล้วรู้สภาพระบบ

รายการ:

- package ปัจจุบัน
- server status
- delivery agent status
- server bot status
- last sync
- pending orders

หมายเหตุ:

- ไม่ใส่เกิน 6 ช่อง
- แต่ละช่องต้องมีค่าหลัก 1 ค่า + คำอธิบาย 1 บรรทัด + badge 1-2 อัน

### 7.3 Task hub

เป้าหมาย:

- เป็น “เริ่มจากตรงนี้” ของ tenant

แบ่งเป็น 3 กลุ่ม:

- เซิร์ฟเวอร์และสุขภาพระบบ
- คำสั่งซื้อและซัพพอร์ตผู้เล่น
- ระบบและหลักฐาน

quick actions:

- ดูสถานะเซิร์ฟเวอร์
- เปิดคิวส่งของ
- เปิดกล่องเหตุขัดข้อง
- เปิดประวัติคำสั่งซื้อ
- เปิดฟอร์มช่วยเหลือกระเป๋าเงิน
- เปิดฟอร์มช่วยเหลือ Steam
- เปิดรีวิวการตั้งค่า
- เปิด audit trail
- เปิด flow รีสตาร์ต

### 7.4 Incident center

เป้าหมาย:

- ให้เห็นปัญหาที่ต้องจัดการก่อนทันที

ต้องมี:

- issue counts
- top incident list
- tone ชัดว่าปกติ/ต้องจับตา/วิกฤต

ชนิดข้อมูล:

- dead-letter
- queue pressure
- reconcile anomaly
- abuse findings
- runtime warnings

### 7.5 Operational context

เป้าหมาย:

- ให้คนดูหน้า dashboard รู้ว่าระบบกำลังไปทางไหน

ต้องมี:

- package / entitlement summary
- quota pressure
- runtime integration state
- last notable changes

### 7.6 Delivery and reconcile insight

เป้าหมาย:

- รวมของที่วันนี้กระทบงานจริง

ต้องมี:

- delivery success rate
- queue depth
- dead-letter count
- reconcile anomalies
- abuse findings

### 7.7 Right rail

เป้าหมาย:

- เป็นพื้นที่ context ไม่ใช่พื้นที่หลัก

ใส่ได้เฉพาะ:

- notifications ล่าสุด
- recommendation 1 ข้อ
- package posture
- open support state

ไม่ควรใส่:

- ตารางใหญ่
- form ใหญ่
- hero หรือภาพใหญ่

## 8. Component list

### Core layout components

- `TenantShellV4`
- `TenantSidebarV4`
- `TenantPageHeaderV4`
- `TenantRightRailV4`

### Dashboard components

- `TenantStatusStrip`
- `TenantKpiTile`
- `TenantTaskHub`
- `TenantTaskGroup`
- `TenantIncidentCenter`
- `TenantIssueList`
- `TenantOperationalContext`
- `TenantDeliveryInsight`
- `TenantNotificationRail`
- `TenantNextStepPanel`

### Shared utility components

- `StatusBadge`
- `MetricValue`
- `SectionHeader`
- `EmptyStateInline`
- `ErrorStateInline`
- `LockedStateInline`

## 9. Data mapping from current API

ใช้ของที่มีอยู่จริงใน repo ก่อน โดยไม่สร้าง contract ใหม่ถ้ายังไม่จำเป็น

| Dashboard block                    | Current state key         | Current endpoint                                                                        |
| ---------------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| current user / role / tenant scope | `state.me`                | `/admin/api/me`                                                                         |
| overview analytics                 | `state.overview`          | `/admin/api/platform/overview?tenantId={id}`                                            |
| reconcile summary                  | `state.reconcile`         | `/admin/api/platform/reconcile?tenantId={id}&windowMs=3600000&pendingOverdueMs=1200000` |
| quota posture                      | `state.quota`             | `/admin/api/platform/quota?tenantId={id}`                                               |
| tenant config summary              | `state.tenantConfig`      | `/admin/api/platform/tenant-config?tenantId={id}`                                       |
| package/subscription cards         | `state.subscriptions`     | `/admin/api/platform/subscriptions?tenantId={id}&limit=6`                               |
| licenses                           | `state.licenses`          | `/admin/api/platform/licenses?tenantId={id}&limit=6`                                    |
| API keys quota drilldown           | `state.apiKeys`           | `/admin/api/platform/apikeys?tenantId={id}&limit=12`                                    |
| webhooks quota drilldown           | `state.webhooks`          | `/admin/api/platform/webhooks?tenantId={id}&limit=12`                                   |
| runtime list                       | `state.agents`            | `/admin/api/platform/agents?tenantId={id}&limit=12`                                     |
| dashboard commerce metrics         | `state.dashboardCards`    | `/admin/api/dashboard/cards?tenantId={id}`                                              |
| shop summary                       | `state.shopItems`         | `/admin/api/shop/list?tenantId={id}&limit=24`                                           |
| queue summary                      | `state.queueItems`        | `/admin/api/delivery/queue?tenantId={id}&limit=20`                                      |
| dead-letter summary                | `state.deadLetters`       | `/admin/api/delivery/dead-letter?tenantId={id}&limit=20`                                |
| delivery lifecycle                 | `state.deliveryLifecycle` | `/admin/api/delivery/lifecycle?tenantId={id}&limit=80&pendingOverdueMs=1200000`         |
| player support summary             | `state.players`           | `/admin/api/player/accounts?tenantId={id}&limit=20`                                     |
| unread notifications               | `state.notifications`     | `/admin/api/notifications?acknowledged=false&limit=10`                                  |
| runtime readiness                  | `state.deliveryRuntime`   | `/admin/api/delivery/runtime`                                                           |
| audit snapshot                     | `state.audit`             | `/admin/api/audit/query?...`                                                            |

## 10. DOM hook reuse plan

ถ้าอยากย้ายหน้าเก่าไปหน้าใหม่แบบไม่หัก logic มากเกินไป ให้ reuse DOM hooks ต่อไปนี้ก่อน:

| Current hook id                | Recommended V4 role               |
| ------------------------------ | --------------------------------- |
| `tenantOverviewStats`          | KPI strip                         |
| `tenantQuickActions`           | task hub                          |
| `tenantIncidentStats`          | issue summary tiles               |
| `tenantIncidentFeed`           | issue list                        |
| `tenantInsightStats`           | reconcile and quota insights      |
| `tenantReconcileFeed`          | reconcile findings feed           |
| `tenantDeliveryLifecycleStats` | delivery insight strip            |
| `tenantPlanStats`              | package/quota/integration context |
| `tenantNotificationFeed`       | right rail notifications          |
| `tenantActivityFeed`           | bottom activity rail              |

แนวทาง:

- เปลี่ยน layout hierarchy ได้
- แต่พยายามให้ container id เดิมยังมีอยู่ เพื่อ reuse render functions ระยะแรก
- ค่อย refactor render layer ภายหลังเมื่อหน้าใหม่นิ่งแล้ว

## 11. Copy rules for this page

คำที่ควรใช้:

- ภาพรวม
- สถานะเซิร์ฟเวอร์
- คำสั่งซื้อ
- การส่งของ
- ผู้เล่น
- ปัญหาที่ต้องดู
- สิ่งที่ควรทำต่อ
- แพ็กเกจปัจจุบัน
- การตั้งค่าเซิร์ฟเวอร์

คำที่ไม่ควรใช้:

- workbench
- lifecycle center
- command strip
- reconcile hub
- platform sandbox

## 12. Empty / error / locked states

### Empty state

- ไม่มี server/runtime:
  - แสดง onboarding checklist
  - CTA = สร้าง Server Bot หรือ Delivery Agent

### Error state

- โหลด overview ไม่ได้:
  - บอกว่าข้อมูลภาพรวมโหลดไม่สำเร็จ
  - ยังให้ section อื่นที่โหลดได้แสดงต่อ

### Locked state

- package ไม่มีสิทธิ์:
  - เห็นโครง block เดิม
  - ปุ่มหลักเป็น `อัปเกรดแพ็กเกจ`

### Preview state

- ดูหน้าได้
- action จริงถูก disable
- มีเหตุผลกำกับชัดเจน

## 13. Build phases

### Phase A: Shell and composition

- สร้าง layout ใหม่ของ `/tenant`
- map DOM hooks เดิมเข้าบล็อกใหม่
- ไม่เปลี่ยน data fetching

### Phase B: Dashboard blocks

- สร้าง page header
- KPI strip
- task hub
- incident center
- delivery/reconcile insight
- right rail

### Phase C: Cleanup

- ตัด wording เก่า
- ลด card ที่ไม่จำเป็น
- ปรับ spacing ตาม 8px system
- ตรวจ empty/error/preview states

## 14. Acceptance criteria

- คนเปิดหน้า `/tenant` แล้วเข้าใจภายใน 5-10 วินาทีว่าควรทำอะไร
- มี primary action ชัด 1 อย่าง
- ปัญหาสำคัญเห็นก่อนข้อมูลรอง
- quick actions ใช้งานได้จริงหรือมี lock state ที่ชัดเจน
- ไม่ต้องเลื่อนนานเพื่อเห็นสถานะหลักของ tenant
- ยังใช้ route เดิม, auth เดิม, และ API contracts เดิมได้

## 15. Next doc after this

เมื่อเริ่ม implement dashboard แล้ว เอกสารถัดไปที่ควรทำต่อคือ:

1. `Tenant Server Status V4 Implementation Spec`
2. `Tenant Server Config V4 Implementation Spec`
3. `Tenant Orders V4 Implementation Spec`
4. `Tenant Players V4 Implementation Spec`
