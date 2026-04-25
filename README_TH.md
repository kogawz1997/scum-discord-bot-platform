# SCUM TH Platform

ไฟล์นี้เป็น README ภาษาไทยของโปรเจค เนื้อหาหลักตอนนี้ย้ายให้ [README.md](./README.md) เป็นภาษาไทยแล้ว เพื่อให้หน้าโปรเจคบน GitHub แสดงข้อมูลที่คนไทยอ่านเข้าใจทันที

อัปเดตล่าสุด: **2026-04-25**

## สรุปสั้น

SCUM TH Platform คือระบบ control plane สำหรับจัดการแพลตฟอร์ม SCUM แบบหลายเซิร์ฟ หลายลูกค้า และหลาย runtime โดยแยกหน้าใช้งานหลักเป็น:

- `Owner Panel` สำหรับเจ้าของแพลตฟอร์ม
- `Tenant Admin Panel` สำหรับแอดมินของแต่ละเซิร์ฟ
- `Player Portal` สำหรับผู้เล่น

runtime หลักแยกเป็น:

- `Delivery Agent` สำหรับเครื่องที่เปิด SCUM client และทำงานส่งของในเกม
- `Server Bot` สำหรับเครื่องเซิร์ฟเวอร์ที่ดู log, config, backup และ restart

## สถานะจริง

โปรเจคนี้อยู่ในระดับ **Managed-Service Prototype** ที่มี backend จริงหลายส่วนแล้ว โดยเฉพาะฝั่ง Owner/control plane และ runtime integration แต่ยังไม่ควรเรียกว่า commercial-ready เต็มรูปแบบจนกว่าจะพิสูจน์ flow production ครบ เช่น billing จริง, tenant isolation, runtime หลายเครื่อง, backup restore, monitoring และ support workflow

ฝั่ง Owen/Owner ใช้ prototype UI เป็นเว็บหลักปัจจุบัน โดยไฟล์ `owen scum/`, `น/`, และ `apps/owner-ui-prototype` เป็น reference สำคัญของหน้าที่แสดงผ่าน `http://127.0.0.1:3202/owner`

## อ่านต่อ

- หน้าโปรเจคหลัก: [README.md](./README.md)
- Owner API/backend map: [docs/OWNER_API_BACKEND_MAP_TH.md](./docs/OWNER_API_BACKEND_MAP_TH.md)
- Owner API detailed reference: [docs/OWNER_API_DETAILED_REFERENCE_TH.md](./docs/OWNER_API_DETAILED_REFERENCE_TH.md)
- Readiness audit: [docs/MANAGED_SERVICE_READINESS_AUDIT_2026-04-22_TH.md](./docs/MANAGED_SERVICE_READINESS_AUDIT_2026-04-22_TH.md)
- Release baseline: [docs/RELEASE_BASELINE_2026-04-22_TH.md](./docs/RELEASE_BASELINE_2026-04-22_TH.md)
