# Production Rollout Plan 2026-04-03

เอกสารนี้ใช้ในวัน deploy จริง โดยสมมติว่าการตรวจใน repo-local และ staging ผ่านแล้ว

## 1. Preconditions

ต้องพร้อมก่อนเริ่ม:

- PR ถูก review และ merge แล้ว
- staging validation ผ่าน
- มี backup ล่าสุด
- มี rollback owner ชัดเจน
- operator ที่ทำงานมีสิทธิ์ step-up / access ครบ
- รู้ target topology ชัดว่าเครื่องไหนเป็น:
  - control plane
  - server bot machine
  - delivery agent machine

## 2. Pre-Deploy Commands

รันก่อนเริ่ม rollout:

```bash
npm run doctor
npm run security:check
npm run readiness:prod
```

ถ้ามี runtime profile หรือ provider เปลี่ยน:

```bash
npm run db:generate
npm run db:migrate:deploy
```

## 3. Deployment Order

ลำดับที่แนะนำ:

1. control plane web/services
2. background runtimes (`worker`, `watcher`, `bot`)
3. `Server Bot`
4. `Delivery Agent`
5. smoke checks

ถ้าใช้ PM2:

```bash
npm run pm2:reload:prod
npm run pm2:reload:prod:verify
```

## 4. Immediate Post-Deploy Checks

### Web Surfaces

- owner login ผ่าน
- tenant login ผ่าน
- player portal เปิดได้
- public slug route เปิดได้

### Runtime Surfaces

- `Server Bot` online
- `Delivery Agent` online
- runtime page แสดง:
  - machine name
  - version
  - last seen
  - latest error ถ้ามี

### Billing / Identity

- preview signup เปิดได้
- billing page แสดง current plan/status ได้
- linked account summary ไม่เพี้ยน

## 5. First 30 Minutes

เช็ก:

- notification center
- `Logs & Sync`
- runtime supervisor
- config jobs
- restart history
- delivery audit / support case signals

อย่างน้อยให้ลอง:

- 1 config read / status check
- 1 restart probe
- 1 delivery preflight หรือ simulator
- 1 player/shop/order flow

## 6. Rollback Triggers

ให้เตรียม rollback ทันทีถ้าเจออย่างใดอย่างหนึ่ง:

- admin/tenant/player login ใช้งานไม่ได้
- `Server Bot` หรือ `Delivery Agent` ไม่กลับมา online
- config/restart flow พังใน tenant หลัก
- billing หรือ entitlement state เพี้ยนชัดเจน
- security/readiness checks degrade อย่างมีนัยสำคัญ

## 7. Rollback Order

1. หยุด write traffic ที่เสี่ยงก่อน
2. rollback application/runtime release
3. ถ้าปัญหาอยู่ที่ schema/data ให้ใช้ backup ล่าสุดตาม policy
4. หลัง rollback ให้รัน:

```bash
npm run doctor
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
```

อ้างอิง policy:

- [C:\new\docs\MIGRATION_ROLLBACK_POLICY_TH.md](/C:/new/docs/MIGRATION_ROLLBACK_POLICY_TH.md)

## 8. Evidence To Keep

เก็บสิ่งเหล่านี้ทุกครั้ง:

- commit / branch ที่ deploy
- backup name
- เวลาเริ่มและจบ rollout
- smoke output
- readiness output
- runtime inventory / validation output
- note สั้น ๆ ถ้ามี caveat หลัง deploy

## 9. Exit Criteria

ถือว่ารอบ deploy ผ่านเมื่อ:

- web surfaces หลักใช้งานได้
- runtimes หลัก online และ stable
- readiness/smoke ผ่าน
- ไม่มี blocker severity สูงค้าง
- operator handoff สำเร็จ
