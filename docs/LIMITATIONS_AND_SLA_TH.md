# LIMITATIONS AND SLA

เอกสารนี้สรุปข้อจำกัดที่ต้องสื่อสารตรง ๆ เวลาส่งมอบงาน และ baseline SLA ที่ควรใช้กับระบบนี้ใน production

## 1. ข้อจำกัดเชิงระบบ

- `agent mode` พึ่งพา Windows session และ SCUM admin client จริง
- การยืนยัน delivery ตอนนี้แข็งแรงระดับ command execution, timeline, audit และ post-spawn verification policy แต่ยังไม่ใช่ game-native inventory proof ทุกกรณี
- tenant isolation ฝั่ง public platform API ถูกทำให้แยก scope แล้ว แต่ข้อมูล commerce บางชุดยังใช้ shared tables ระดับระบบ จึงต้องอาศัย service-layer guard ร่วมด้วย
- restore ถูกเพิ่ม preview token, maintenance gate, rollback backup และ schema guard แล้ว แต่ยังควรทำใน maintenance window เสมอ
- SQLite ยังเหมาะกับ single-host / low-concurrency มากกว่า horizontal scale

## 2. ข้อจำกัดเชิงปฏิบัติการ

- ห้ามเปิด delivery worker ซ้ำทั้ง `bot` และ `worker`
- ห้าม lock Windows session ถ้าใช้ `agent mode`
- reverse proxy, HTTPS, Discord OAuth redirect และ cookie scope ต้องตรงกับ split-origin ที่ตั้งไว้
- secret rotation ต้องตามด้วย runtime reload และการนำ `ADMIN_WEB_2FA_SECRET` ใหม่ไป import ใน authenticator app

## 3. Baseline SLA ที่แนะนำ

สำหรับ deployment แบบ single-host production:

- Availability target:
  `99.0%` ต่อเดือน สำหรับ control plane หลัก (`bot`, `worker`, `watcher`, `admin web`, `player portal`)
- Detection target:
  incident สำคัญควรถูกพบภายใน `5 นาที` ผ่าน monitoring/alerting
- Recovery target:
  runtime crash ทั่วไปควร recover ภายใน `15 นาที`
- Restore target:
  ใช้ snapshot/backup restore ใน maintenance window เท่านั้น และควรมี restore preview ผ่านก่อนทุกครั้ง

## 4. สิ่งที่ควรถือว่าอยู่นอก SLA

- ปัญหาที่เกิดจาก Discord outage, SCUM server outage, BattlEye issue หรือ Windows desktop session ภายนอกระบบนี้
- การส่งของล้มเหลวเพราะ admin client ถูกปิด, หาย focus หรืออยู่ผิด channel ใน `agent mode`
- ความเสียหายจากการ restore โดยข้ามขั้น preview/confirmation/runbook
- ปัญหาที่เกิดจากการใช้ secret/token เก่าหลัง rotate แล้วแต่ยังไม่ reload runtime

## 5. การสื่อสารกับลูกค้า

ควรสื่อสารให้ชัดว่า:

- ระบบนี้พร้อม production แต่มี dependency ภายนอกที่ต้องดูแล
- `agent mode` เป็น pragmatic automation ที่พิสูจน์ใช้งานจริงแล้ว แต่ไม่ใช่ official SCUM server API
- monitoring, preflight, failover, timeline และ reconcile ถูกทำมาเพื่อลดความเสี่ยง "พังเงียบ" และช่วย debug production ให้เร็วขึ้น
- ถ้าจะขยายเป็นหลาย tenant หรือขายต่อ ควรมีแผน migrate ไป DB server และแยก deployment boundary ให้ชัดขึ้น
