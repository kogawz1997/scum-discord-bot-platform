# บันทึก Release

Language:

- English: [README.md](./README.md)
- Thai: `README_TH.md`

โฟลเดอร์นี้เก็บ release notes รายเวอร์ชัน

ความต่างจาก [../../CHANGELOG.md](../../CHANGELOG.md):

- `CHANGELOG.md` คือประวัติการเปลี่ยนแปลงสะสมที่ผูกกับ release automation
- release notes ในโฟลเดอร์นี้ใช้สรุปผลกระทบต่อ operator, หมายเหตุ review, ข้อจำกัด และเงื่อนไขการ deploy ของแต่ละเวอร์ชัน

รายการปัจจุบัน:

- [TEMPLATE.md](./TEMPLATE.md)
- [v1.0.0.md](./v1.0.0.md)

Guardrail:

- `npm run check:release-notes` จะตรวจว่า `docs/releases/v<package-version>.md` มีอยู่สำหรับ version ปัจจุบันใน `package.json`
