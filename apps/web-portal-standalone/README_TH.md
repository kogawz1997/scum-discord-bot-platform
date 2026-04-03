# Standalone SCUM Player Portal

Language:

- English: [README.md](./README.md)
- Thai: `README_TH.md`

แอปนี้คือ process แยกสำหรับ player-facing portal โดยตั้งใจแยกเส้นทางผู้เล่นออกจาก admin control plane

player portal จะไม่คุยกับเครื่องเกมโดยตรง การอ่านและเขียนที่เกี่ยวกับผู้เล่นยังต้องผ่าน control plane และ persistence boundary กลาง

## route หลัก

- `/player` สำหรับ player portal
- `/player/login` สำหรับ Discord sign-in
- `/landing` สำหรับหน้า public landing
- `/showcase` และ `/trial` สำหรับหน้าสาธารณะเชิง product

route ฝั่ง admin ไม่ได้เสิร์ฟจากแอปนี้:

- `/admin*` จะ redirect ไปยัง admin origin ที่กำหนดใน `WEB_PORTAL_LEGACY_ADMIN_URL`

## การแยก role

- `Owner` ดูแลแพลตฟอร์มทั้งระบบ
- `Admin` ดูแลเซิร์ฟเวอร์, commerce, delivery, support, config ของ tenant
- `Player` ใช้ wallet, orders, redeem, profile และ Steam link

## ความสามารถฝั่งผู้เล่น

- Discord OAuth login
- dashboard และ account summary
- wallet และ transaction history
- shop, cart, checkout และ purchase history
- redeem flow และประวัติการ redeem
- Steam link flow
- missions, wheel, party, bounty และ notification views

## env ขั้นต่ำ

- `WEB_PORTAL_MODE=player`
- `WEB_PORTAL_BASE_URL=http://127.0.0.1:3300`
- `WEB_PORTAL_LEGACY_ADMIN_URL=http://127.0.0.1:3200/admin`
- `WEB_PORTAL_DISCORD_CLIENT_ID=...`
- `WEB_PORTAL_DISCORD_CLIENT_SECRET=...`

ค่าแนะนำเพิ่มเติม:

- `WEB_PORTAL_SECURE_COOKIE=true`
- `WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true`
- `WEB_PORTAL_MAP_EMBED_ENABLED=true`

ดู env catalog เพิ่มใน [../../docs/ENV_REFERENCE_TH.md](../../docs/ENV_REFERENCE_TH.md)

## การเริ่มใช้งาน

```bash
npm run start:web-standalone
```

health check:

```bash
curl http://127.0.0.1:3300/healthz
```

## การตรวจสอบก่อน deploy

```bash
npm run doctor:web-standalone
npm run doctor:web-standalone:prod
npm run readiness:prod
npm run smoke:postdeploy
```

## ดูต่อ

- [../../README_TH.md](../../README_TH.md)
- [../../docs/OPERATOR_QUICKSTART.md](../../docs/OPERATOR_QUICKSTART.md)
- [../../docs/PRODUCT_READY_GAP_MATRIX.md](../../docs/PRODUCT_READY_GAP_MATRIX.md)
