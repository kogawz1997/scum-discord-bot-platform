# Project HQ

Language:

- English: [PROJECT_HQ.md](./PROJECT_HQ.md)
- Thai: `PROJECT_HQ_TH.md`

[![CI](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/ci.yml/badge.svg)](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/ci.yml)
[![Release](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/release.yml/badge.svg)](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/release.yml)

อัปเดตล่าสุด: **2026-03-31**

เอกสารนี้คือ factual status register ของ repository และ workstation ปัจจุบัน ต้องยึดกับโค้ด, tests, artifacts และ live runtime checks ไม่ควรใช้เป็นหน้า sales

## ชุดเอกสารอ้างอิง

- ภาพรวม repository: [README.md](./README.md)
- ดัชนี docs: [docs/README.md](./docs/README.md)
- verification status: [docs/VERIFICATION_STATUS_TH.md](./docs/VERIFICATION_STATUS_TH.md)
- evidence map: [docs/EVIDENCE_MAP_TH.md](./docs/EVIDENCE_MAP_TH.md)
- architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- runtime topology: [docs/RUNTIME_TOPOLOGY.md](./docs/RUNTIME_TOPOLOGY.md)
- worklist: [docs/WORKLIST.md](./docs/WORKLIST.md)
- product-ready gap matrix: [docs/PRODUCT_READY_GAP_MATRIX.md](./docs/PRODUCT_READY_GAP_MATRIX.md)
- database strategy: [docs/DATABASE_STRATEGY.md](./docs/DATABASE_STRATEGY.md)
- PostgreSQL cutover checklist: [docs/POSTGRESQL_CUTOVER_CHECKLIST.md](./docs/POSTGRESQL_CUTOVER_CHECKLIST.md)
- migration / rollback / restore: [docs/MIGRATION_ROLLBACK_POLICY_TH.md](./docs/MIGRATION_ROLLBACK_POLICY_TH.md)
- release policy: [docs/RELEASE_POLICY.md](./docs/RELEASE_POLICY.md)

## สถานะปัจจุบัน

### สิ่งที่ยืนยันได้จาก repo

- runtime ถูกแยกเป็น `bot`, `worker`, `watcher`, `admin web`, `player portal`, `server bot` และ `console-agent`
- มี runtime entry wrappers ใต้ `apps/admin-web`, `apps/api`, `apps/discord-bot`, `apps/worker`, `apps/watcher`, `apps/agent`, `apps/server-bot`, และ `apps/web-portal-standalone`
- PostgreSQL + Prisma เป็น persistence foundation หลักของ workstation นี้
- admin auth มี DB login, Discord SSO code paths, TOTP 2FA, step-up auth, session handling และ security event logging
- มี domain boundaries สำหรับ agents, servers, sync ingestion และ delivery routing
- SCUM-specific adapters และ parsers อยู่ใต้ `src/integrations/scum/`
- surfaces ฝั่ง owner, tenant, public และ player มีจริงในโค้ดและผูกกับ runtime entrypoints แล้ว
- รองรับ tenant DB topology แบบ `shared`, `schema-per-tenant`, และ `database-per-tenant`; เครื่องนี้กำลังใช้ `schema-per-tenant`

### ความจริงของ runtime บนเครื่องนี้ ณ 2026-03-31

ตรวจยืนยันบน workstation นี้แล้ว:

- Local PostgreSQL เข้าถึงได้ที่ `127.0.0.1:55432`
- มีการ rerun Prisma client generation สำหรับ PostgreSQL ผ่าน `scripts/prisma-with-provider.js`
- `npm run platform:schema:upgrade` ผ่านบนเครื่องนี้
- `pm2` รายงาน runtime หลัก `online`
- `scum-admin-web` เปิดใช้งาน local และ `POST /admin/api/login` ตอบ `200 OK`
- health endpoint ของ `scum-bot` ตอบ `ok=true` และ `discordReady=true`
- health endpoint ของ `scum-server-bot` ตอบ `ready=true`

### caveats ของ runtime ปัจจุบัน

- `scum-bot` ยังมี warning ใน error log เรื่อง production guard และ schema alignment
- `scum-web-portal` ยังมี optional player-data failures บางตัวใน log
- `scum-server-bot` เคย boot fail มาก่อนเพราะขาด control-plane URL และ platform agent token ดังนั้นให้ถือว่า proof นี้ผูกกับเครื่องนี้
- admin DB login ถูกยืนยันแล้ว แต่ Discord SSO role mapping ของ guild จริงยังไม่ได้พิสูจน์ซ้ำในรอบนี้

### ส่วนที่ยัง partial / unfinished

- billing และ subscription lifecycle มีอยู่ในโค้ด แต่ยังไม่ใช่ commercial flow ระดับ production-grade แบบ end-to-end
- unified identity มี foundation แล้ว แต่ email, Discord, Steam และ in-game verification ยังไม่ใช่ product flow ที่จบสมบูรณ์
- persistence ดีขึ้นแต่ยังไม่ fully normalized บาง path ยังผสม Prisma, raw SQL และ fallback logic
- surfaces ของ owner, tenant และ player มีจริง แต่บางระบบยังบางหรือยัง partial เช่น donations, modules, raids, killfeed product surface, analytics เชิงลึก
- service boundaries ดีขึ้นแต่ยังมี service ใหญ่หลายก้อน
- i18n มีระบบแล้ว แต่ยังมี hardcoded strings และ encoding debt บางส่วน

## หมายเหตุของ workstation นี้

- database provider ใน `.env`: `postgresql`
- runtime database endpoint: `127.0.0.1:55432`
- `TENANT_DB_ISOLATION_MODE=postgres-rls-strict`
- `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant`
- local admin web: `http://127.0.0.1:3200/admin`
- `scum-bot` health: `http://127.0.0.1:3210/healthz`
- `scum-server-bot` health: `http://127.0.0.1:3214/healthz`
- `DELIVERY_EXECUTION_MODE` ยังเป็น agent-based และยังขึ้นกับ Windows session

## Validation Notes

ชุด validation ระดับ repo ปัจจุบัน:

- `npm run lint`
- `npm run test:policy`
- `npm test`
- `npm run doctor`
- `npm run security:check`
- `npm run readiness:prod`
- `npm run smoke:postdeploy`

การตรวจที่ทำบนเครื่องนี้สำหรับอัปเดตนี้:

- PostgreSQL reachability check
- Prisma PostgreSQL client generation
- `npm run platform:schema:upgrade`
- `pm2 describe` ของ runtimes หลัก
- local health checks ของ `scum-bot` และ `scum-server-bot`
- local admin login POST

กติกาการตีความ:

- repo-local code และ tests = implementation proof
- PM2/health/login checks บน workstation นี้ = local runtime proof
- proof จาก workstation เดียว ไม่เท่ากับ universal environment proof

## ช่องว่างที่ยังเหลือ

ใช้ [docs/WORKLIST.md](./docs/WORKLIST.md) เป็น backlog หลัก

สรุปสั้น:

- local runtime proof แข็งขึ้น แต่ยังไม่ clean ทุก runtime
- commercial readiness ยังต่ำกว่าระดับ launch
- identity, persistence normalization, donations/modules/raids, analytics และ UX/i18n polish ยังเป็น open tracks

## Review Warnings

- อย่าอ้างว่า `database-per-tenant` เป็น runtime topology ของเครื่องนี้
- อย่าอ้างว่า Discord admin SSO ถูกพิสูจน์ครบในรอบนี้
- อย่าอ้างว่าทุก setting แก้จาก admin web ได้หมดแล้ว
- อย่าอ้างว่า Delivery Agent ไม่ขึ้นกับ Windows session และ SCUM client state
- อย่าอ้างว่า commercial billing, donations, raids หรือ module management เสร็จสมบูรณ์แล้ว

## สรุป

repository นี้แข็งแรงกว่า prototype ไปมาก และ workstation นี้สามารถบูต runtime stack หลักได้อีกครั้งด้วย live PostgreSQL, working admin login, healthy bot/server-bot endpoints และมี worker/watcher/console-agent ทำงานอยู่ อย่างไรก็ดีมันยังไม่ใช่ commercial-ready service ที่สะอาดสมบูรณ์ เพราะ billing, identity, product systems, persistence normalization และ runtime warnings/log issues ยังเหลืออยู่
