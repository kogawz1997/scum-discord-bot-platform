# Security Policy

Language:

- English: [SECURITY.md](./SECURITY.md)
- Thai: `SECURITY_TH.md`

## การรายงานปัญหาด้าน Security

ถ้าเจอปัญหาด้าน security อย่าเปิด public issue ที่มี secrets, tokens, database URLs หรือรายละเอียด exploit ตรง ๆ

ให้รายงานโดยส่งข้อมูลต่อไปนี้:

- component ที่ได้รับผลกระทบ
- ขอบเขตของ environment
- ขั้นตอนทำซ้ำ
- การประเมินผลกระทบ
- logs ที่ redact ความลับแล้ว

ถ้าปัญหาอยู่ใน live deployment ให้ rotate secrets ที่ได้รับผลกระทบก่อน

## ความคาดหวังด้าน Security ของ Repository

- ห้าม commit `.env`, backups, key files หรือ dumped secrets
- รัน `npm run security:scan-secrets` ก่อน push
- รัน `npm run security:check` ก่อน production changes
- production ต้องเปิด `ADMIN_WEB_2FA_ENABLED=true` และ `ADMIN_WEB_STEP_UP_ENABLED=true`
- production ต้องเปิด `PERSIST_REQUIRE_DB=true` และ `PERSIST_LEGACY_SNAPSHOTS=false`

## Runtime Baseline ที่รองรับ

baseline ปัจจุบันสำหรับ production reviews:

- Node.js 20+
- PostgreSQL runtime path
- split-origin admin/player deployment
- มี CI verification และ smoke checks

## หมายเหตุเรื่องขอบเขต

repository นี้มี:

- admin web
- player portal
- Discord bot
- worker runtime
- watcher runtime
- optional console-agent

เวลา review ด้าน security ต้องมอง trust boundaries ข้าม runtime ไม่ใช่แค่ bot process อย่างเดียว
