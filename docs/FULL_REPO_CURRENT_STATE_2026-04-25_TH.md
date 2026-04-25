# Full Repo Current State (2026-04-25)

เอกสารนี้สรุปสภาพปัจจุบันของทั้ง repository ในระดับ "ทั้ง repo" และจับคู่กับไฟล์ manifest ที่มีทุก path จริง

- manifest ทุกไฟล์: [FULL_REPO_FILE_MANIFEST_2026-04-25.md](./FULL_REPO_FILE_MANIFEST_2026-04-25.md)
- action list เชิงผลิตภัณฑ์: [MANAGED_SERVICE_ACTION_LIST_2026-04-25_TH.md](./MANAGED_SERVICE_ACTION_LIST_2026-04-25_TH.md)
- ดัชนีไฟล์เชิงอธิบายเดิม: [PROJECT_DETAIL_FILE_INDEX_TH.md](./PROJECT_DETAIL_FILE_INDEX_TH.md)

## ภาพรวมทั้ง repo

- จำนวนไฟล์ทั้งหมดใน working tree ตอน audit: `81,405` ไฟล์
- จำนวนไฟล์ใน analytical scope ที่เป็น repo-owned code/docs/test/deploy/scripts เป็นหลัก: ประมาณ `1,187` ไฟล์
- สรุปเชิงปฏิบัติ:
  - repo นี้ "ใหญ่" เพราะมี data, img, dependencies, และ local artifacts เยอะมาก
  - ถ้าดูเฉพาะ product/system implementation จริง ขนาดยังอยู่ในระดับที่ audit และวาง roadmap ได้

## หมวดไฟล์ใหญ่ตาม top-level directory

### `.claude` - 2 ไฟล์

- บทบาทปัจจุบัน:
  - tooling/local workspace support
- สถานะ:
  - ไม่ใช่ product runtime หลัก
- หมายเหตุ:
  - manifest อาจมีไฟล์ใต้ `.claude/worktrees/...` จาก local workspace context ด้วย

### `.githooks` - 4 ไฟล์

- บทบาทปัจจุบัน:
  - git workflow hooks
- สถานะ:
  - support infrastructure

### `.github` - 7 ไฟล์

- บทบาทปัจจุบัน:
  - CI/release automation
- สถานะ:
  - มีจริงและช่วยเรื่อง release/CI แต่ไม่ใช่หลักฐานว่าระบบ production-ready แล้ว

### `.playwright-cli` - 73 ไฟล์

- บทบาทปัจจุบัน:
  - browser automation/tooling support
- สถานะ:
  - support tooling

### `apps` - 8,273 ไฟล์

- บทบาทปัจจุบัน:
  - รวม entrypoints และ app surfaces ของระบบ
- สถานะ:
  - เป็นโฟลเดอร์ product-facing สำคัญที่สุดชุดหนึ่ง
- หมายเหตุสำคัญ:
  - ตัวเลขนี้รวม `node_modules` ย่อยบางส่วน
  - ถ้านับเฉพาะ app files ที่เป็นของระบบจริงและตัด nested dependencies ออก เหลือประมาณ `201` ไฟล์
- สภาพปัจจุบัน:
  - `admin-web`, `owner-web`, `tenant-web` เป็น runtime wrappers มากกว่าจะเป็นแอปแยกที่แยกขาด
  - `web-portal-standalone` เป็น app ที่มีโครงสร้างจริงหนาที่สุด
  - `server-bot` และ `agent` มี runtime role จริง
  - มี `owner-ui-prototype` อยู่เป็น transitional/prototype surface

### `artifacts` - 2 ไฟล์

- บทบาทปัจจุบัน:
  - local/generated outputs
- สถานะ:
  - ไม่ใช่ product source

### `data` - 62,510 ไฟล์

- บทบาทปัจจุบัน:
  - data-heavy directory
  - ใช้เก็บฐานข้อมูล/ไฟล์ข้อมูล/artefacts เชิง runtime หรือ supporting content
- สถานะ:
  - ไม่ควรตีความเป็น product code scope
- ความหมายต่อการ audit:
  - ทำให้ repo ใหญ่มาก
  - ต้องแยกออกจาก code maturity เวลา review ความพร้อมระบบ

### `deploy` - 23 ไฟล์

- บทบาทปัจจุบัน:
  - deployment/runtime topology
  - PM2, systemd, docker, role entrypoints
- สถานะ:
  - มีของจริงและสะท้อนว่าระบบคิดเรื่อง multi-role deployment แล้ว
- จุดเด่น:
  - มี split-machine profiles สำหรับ control plane และ game-bot machine

### `docs` - 142 ไฟล์

- บทบาทปัจจุบัน:
  - documentation, architecture, rollout, wireframes, readiness docs
- สถานะ:
  - ใหญ่และค่อนข้างจริงจัง
- หมายเหตุ:
  - docs ของ repo เองยังยืนยันว่าหลายหัวข้อเป็น `Partial`
  - เป็นแหล่งหลักฐานสำคัญในการ audit รอบนี้

### `img` - 2,156 ไฟล์

- บทบาทปัจจุบัน:
  - static image assets / reference material
- สถานะ:
  - ไม่ใช่ code maturity signal โดยตรง

### `node_modules` - 5,114 ไฟล์

- บทบาทปัจจุบัน:
  - dependency tree
- สถานะ:
  - ไม่ควรรวมใน analytical judgment ของ readiness

### `output` - 9 ไฟล์

- บทบาทปัจจุบัน:
  - generated runtime/test output
- สถานะ:
  - ไม่ใช่ product source

### `owen scum` - 11 ไฟล์

- บทบาทปัจจุบัน:
  - supplemental project material / external content
- สถานะ:
  - peripheral

### `prisma` - 29 ไฟล์

- บทบาทปัจจุบัน:
  - schema, migrations, persistence definitions
- สถานะ:
  - เป็นหนึ่งในส่วนที่แข็งแรงของ repo
- ความหมายต่อระบบ:
  - บอกชัดว่าระบบถูกออกแบบเป็น multi-tenant control plane จริง

### `scripts` - 71 ไฟล์

- บทบาทปัจจุบัน:
  - tooling, readiness checks, helpers, validation flows
- สถานะ:
  - support infrastructure ที่มีประโยชน์จริง

### `scum_items-main` - 2,116 ไฟล์

- บทบาทปัจจุบัน:
  - data/reference asset set
- สถานะ:
  - ไม่ใช่ product source หลัก

### `src` - 374 ไฟล์

- บทบาทปัจจุบัน:
  - แกน business logic, runtimes, services, contracts, admin assets, integrations
- สถานะ:
  - เป็น core implementation scope หลัก
- สภาพปัจจุบัน:
  - มี logic จริงจำนวนมาก
  - แต่ maturity กระจายไม่เท่ากันทุกโดเมน

### `stitch` - 87 ไฟล์

- บทบาทปัจจุบัน:
  - stitched pages / transitional surface integration
- สถานะ:
  - transitional architecture support
- ความหมาย:
  - เป็นสัญญาณว่าบางส่วนของ UI architecture ยังไม่ converge

### `stitch_scum_owner_panel_redesign (1)` - 0 ไฟล์

- บทบาทปัจจุบัน:
  - placeholder/unused folder
- สถานะ:
  - ไม่สะท้อน product maturity

### `stitch_scum_tenant_control_panel` - 40 ไฟล์

- บทบาทปัจจุบัน:
  - stitched tenant UI/reference assets
- สถานะ:
  - transitional support

### `test` - 291 ไฟล์

- บทบาทปัจจุบัน:
  - unit, integration, route, readiness, and regression coverage
- สถานะ:
  - coverage breadth ดี
- ข้อสังเกต:
  - มี test ครอบคลุมหลาย domain สำคัญจริง
  - แต่การมี test เยอะ ไม่ได้แปลว่าผ่าน production bar โดยอัตโนมัติ

### `vendor` - 1 ไฟล์

- บทบาทปัจจุบัน:
  - external/vendor support file
- สถานะ:
  - peripheral

### `น` - 29 ไฟล์

- บทบาทปัจจุบัน:
  - additional local/support content
- สถานะ:
  - peripheral

## Root-level files ปัจจุบัน

ไฟล์ root สำคัญตอนนี้แบ่งได้เป็น 5 กลุ่ม:

### 1. Repo control / metadata

- `AGENTS.md`
- `package.json`
- `package-lock.json`
- `eslint.config.cjs`
- `Dockerfile`
- `release-please-config.json`
- `.release-please-manifest.json`

สถานะ:

- เป็นไฟล์ที่กำหนด behavior ของ repo และ runtime/scripts จริง

### 2. Project narrative / review docs

- `README.md`, `README_TH.md`
- `PROJECT_HQ.md`, `PROJECT_HQ_TH.md`
- `PROJECT_REVIEW.md`, `PROJECT_REVIEW_TH.md`
- `CHANGELOG.md`, `CHANGELOG_TH.md`
- `SECURITY.md`, `SECURITY_TH.md`
- `CONTRIBUTING.md`, `CONTRIBUTING_TH.md`

สถานะ:

- เป็นแหล่งหลักฐานสำคัญ เพราะ repo เองยอมรับว่า commercial/security/ops หลายส่วนยังไม่จบ

### 3. Environment and runtime templates

- `.env.example`
- `.env.development.example`
- `.env.machine-a-control-plane.example`
- `.env.machine-b-game-bot.example`
- `.env.multi-tenant-prod.example`
- `.env.production.example`
- `.env.production.split`
- `.env.single-host-prod.example`
- `.env.test.example`
- `setup-easy.cmd`

สถานะ:

- สะท้อนว่าระบบคิดเรื่องหลาย topology จริง

### 4. Local runtime artifacts / sensitive local files

- `.env`
- `owner.cookies`

สถานะ:

- เป็น local state
- ไม่ควรใช้เป็นหลักฐาน maturity ของ product

### 5. Data/reference manifests

- `scum_item_category_manifest.json`
- `scum_weapons_from_wiki.json`

สถานะ:

- เป็น domain/reference support files

## สภาพปัจจุบันของโค้ดที่เป็นของระบบเอง

ถ้าดูเฉพาะส่วนที่ใช้ตัดสิน readiness จริง ให้โฟกัส:

- `apps` แบบตัด nested dependencies: `201` ไฟล์
- `src`: `374` ไฟล์
- `prisma`: `29` ไฟล์
- `deploy`: `23` ไฟล์
- `docs`: `142` ไฟล์
- `test`: `291` ไฟล์
- `scripts`: `71` ไฟล์

ข้อสรุป:

- codebase ที่เป็นของระบบเองไม่ได้เล็ก แต่ก็ไม่ใหญ่เกิน audit
- breadth สูงมาก แปลว่ามีหลายระบบจริง
- แต่ breadth สูงกว่า maturity ในหลาย domain

## ข้อสรุปเชิงสถาปัตยกรรมของทั้ง repo ตอนนี้

- repo นี้ไม่ใช่ hobby toy แล้ว
- repo นี้มีฐานเป็น managed-service control plane จริง
- ส่วนที่แข็งที่สุดตอนนี้คือ:
  - persistence model
  - config system
  - restart orchestration
  - agent provisioning foundation
  - backend entitlement model
- ส่วนที่ยังเป็น debt ชัดคือ:
  - Delivery Agent boundary
  - owner/admin/tenant surface convergence
  - i18n hygiene
  - commercial operations completeness
  - security hardening completeness
  - identity cohesion

## วิธีใช้ไฟล์ชุดนี้ต่อ

1. ถ้าต้องการดูทุก path จริง ใช้ [FULL_REPO_FILE_MANIFEST_2026-04-25.md](./FULL_REPO_FILE_MANIFEST_2026-04-25.md)
2. ถ้าต้องการดูว่าตอนนี้ระบบอยู่ตรงไหนและต้องทำอะไรต่อ ใช้ [MANAGED_SERVICE_ACTION_LIST_2026-04-25_TH.md](./MANAGED_SERVICE_ACTION_LIST_2026-04-25_TH.md)
3. ถ้าต้องการดัชนีไฟล์เชิงอธิบายของส่วนสำคัญ ใช้ [PROJECT_DETAIL_FILE_INDEX_TH.md](./PROJECT_DETAIL_FILE_INDEX_TH.md)
