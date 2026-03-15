# REPO STRUCTURE

เอกสารนี้อธิบายโครงสร้าง repo ปัจจุบัน, ขอบเขตของแต่ละโฟลเดอร์, และแนวทางจัดระเบียบเพื่อให้ขยายเป็น monorepo อย่างมีวินัยโดยไม่ทำให้ระบบ production สะดุด

## 1. โครงสร้างปัจจุบัน

- `src/`
  logic หลักของ bot, worker, admin web, service layer, store และ utility
- `apps/web-portal-standalone/`
  player portal standalone รวม server, public assets และ script เฉพาะฝั่ง portal
- `scripts/`
  automation, security hardening, smoke/readiness, bootstrap, Windows helper และเครื่องมือ operational
- `test/`
  ชุด integration และ regression tests
- `docs/`
  เอกสารใช้งาน, go-live, limitations, SLA, deployment และ commercial showcase
- `deploy/`
  PM2, nginx example และ helper สำหรับ production runtime
- `prisma/`
  schema, migrations และ database layer
- `data/`
  state file ที่ persist จาก runtime บางส่วนซึ่งไม่ควรถือเป็น source-of-truth หลักแทน DB

## 2. ขอบเขตที่ควรยึด

- โค้ดฝั่ง `src/services/` ควรถือเป็น orchestration/business logic
- โค้ดฝั่ง `src/store/` ควรถือเป็น persistence boundary
- route/controller ควรอยู่ใกล้ entrypoint ของ runtime และพยายามไม่แบก business logic หนัก
- script ใน `scripts/` ควรเป็นเครื่องมือ deploy/ops ไม่ใช่ที่ซ่อน logic ของระบบหลัก
- test ใหม่ควรอยู่ใน `test/` และตั้งชื่อให้ชัดว่าเป็น `integration`, `failure-path`, `smoke` หรือ `unit`

## 3. แนวทาง monorepo ระยะยาว

ถ้าจะขยายต่อโดยไม่ต้อง rewrite ทั้ง repo ให้ยึดทิศทางนี้:

- `apps/`
  รวม runtime ที่ deploy แยกจากกัน เช่น player portal, future admin frontend, public landing
- `packages/`
  ย้าย module กลางที่ใช้ข้าม runtime ได้ เช่น config schema, shared auth, observability client, domain utilities
- `services/`
  ถ้าบาง runtime โตจนแยก deployment artifact ชัด อาจแยกเป็น package หรือ service directory เฉพาะ
- `docs/`
  เก็บ runbook, SLA, contract และ customer handoff แยกจาก source code ชัดเจน

## 4. กติกา hygiene ที่ใช้ต่อจากนี้

- ห้ามเพิ่ม logic ใหม่แบบ ad-hoc ลง entrypoint ถ้าควรอยู่ใน service layer
- ห้ามอ้าง `.env.backup-*` เป็นแหล่ง config ระยะยาว
- secret rotation ต้องผ่าน script ที่มีอยู่แทนการแก้มือ
- feature production-critical ต้องมีอย่างน้อย 1 integration test และ 1 failure-path test
- เอกสารใน `README.md`, `PROJECT_HQ.md`, `docs/SYSTEM_UPDATES.md` ต้องอัปเดตพร้อมกันเมื่อมี capability ใหม่ระดับ runtime

## 5. สถานะปัจจุบัน

- repo นี้ยังไม่ใช่ monorepo เต็มรูปแบบ แต่มีโครงสร้างที่พร้อม migrate ไปจุดนั้นได้
- `apps/web-portal-standalone/` เป็น app boundary แรกที่ชัดแล้ว
- service/store separation ฝั่ง backend ถูกยกขึ้นมามากพอสำหรับการแยก package ในรอบถัดไป
- operational scripts, deploy assets และ docs ถูกแยกเป็นหมวดแล้ว ทำให้ handoff production ง่ายขึ้น
