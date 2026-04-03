# Contributing

Language:

- English: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Thai: `CONTRIBUTING_TH.md`

## กติกาพื้นฐาน

- ให้การเปลี่ยนแปลงสอดคล้องกับ architecture และ runtime model ปัจจุบัน
- ห้าม commit secrets, `.env` files, key files หรือ backups
- เอกสารควรอิงข้อเท็จจริงที่มี evidence รองรับ
- อย่าเปลี่ยน production behavior ถ้ายังไม่มี tests หรือ rollback note ที่ชัดเจน

## ก่อนเปิด PR

รัน:

```bash
npm run lint
npm run test:policy
npm test
npm run doctor
npm run security:check
```

ถ้ามีการแก้ markdown, JSON หรือ workflow files ให้ normalize ด้วย:

```bash
npm run format:write
```

ถ้างานนั้นกระทบ deployed runtime behavior ให้รันเพิ่ม:

```bash
npm run readiness:prod
```

## ความคาดหวังด้านเอกสาร

อัปเดต docs เมื่อคุณเปลี่ยน:

- runtime topology
- production validation flow
- env/config requirements
- migration หรือ restore behavior
- tenant boundaries

ไฟล์ที่ควรอัปเดตก่อนเป็นลำดับแรก:

- [README.md](./README.md)
- [PROJECT_HQ.md](./PROJECT_HQ.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/CONFIG_MATRIX.md](./docs/CONFIG_MATRIX.md)

## ความคาดหวังด้านการทดสอบ

เพิ่มหรืออัปเดต tests สำหรับ:

- policy boundaries
- tenant boundaries
- config mutation safety
- migration / restore behavior
- runtime health หรือ smoke behavior

ถ้ามีการเพิ่ม config หรือ bootstrap boundary modules ใหม่ ให้รักษา `npm run check:jsdoc` ให้ผ่านด้วย

## หมายเหตุใน PR

PR ควรระบุ:

- อะไรที่เปลี่ยน
- ทำไมถึงเปลี่ยน
- ตรวจสอบอะไรไปแล้ว
- อะไรที่ยังขึ้นกับ runtime จริง
