# ดัชนีเอกสาร

Language:

- English: [README.md](./README.md)
- Thai: `README_TH.md`

ใช้หน้านี้เพื่อเลือกชุดเอกสารตามกลุ่มผู้อ่าน แทนการไล่อ่านทั้ง repo แบบสุ่ม

## เอกสารสำหรับ Operator

- [OPERATOR_QUICKSTART.md](./OPERATOR_QUICKSTART.md)
- [FIFTEEN_MINUTE_SETUP.md](./FIFTEEN_MINUTE_SETUP.md)
- [SINGLE_HOST_PRODUCTION_PROFILE.md](./SINGLE_HOST_PRODUCTION_PROFILE.md)
- [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
- [RESTART_ANNOUNCEMENT_PRESET.md](./RESTART_ANNOUNCEMENT_PRESET.md)
- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [GO_LIVE_CHECKLIST_TH.md](./GO_LIVE_CHECKLIST_TH.md)
- [OPERATIONS_MANUAL_TH.md](./OPERATIONS_MANUAL_TH.md)
- [SECRET_ROTATION_RUNBOOK.md](./SECRET_ROTATION_RUNBOOK.md)
- [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
- [CONFIG_MATRIX.md](./CONFIG_MATRIX.md)
- [LIMITATIONS_AND_SLA_TH.md](./LIMITATIONS_AND_SLA_TH.md)

## เอกสารสำหรับ Developer / Architect

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SYSTEM_MAP_GITHUB_TH.md](./SYSTEM_MAP_GITHUB_TH.md)
- [SYSTEM_MAP_GITHUB_EN.md](./SYSTEM_MAP_GITHUB_EN.md)
- [PROJECT_DETAIL_FILE_INDEX_README.md](./PROJECT_DETAIL_FILE_INDEX_README.md)
- [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
- [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
- [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
- [PRODUCT_READY_GAP_MATRIX.md](./PRODUCT_READY_GAP_MATRIX.md)
- [WORKLIST.md](./WORKLIST.md)
- [REFACTOR_PLAN.md](./REFACTOR_PLAN.md)
- [EVIDENCE_MAP_TH.md](./EVIDENCE_MAP_TH.md)
- [VERIFICATION_STATUS_TH.md](./VERIFICATION_STATUS_TH.md)
- [adr/README.md](./adr/README.md)

## เอกสารสำหรับ Product / Customer / Admin

- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [ADMIN_SSO_ROLE_MAPPING_TH.md](./ADMIN_SSO_ROLE_MAPPING_TH.md)
- [SPLIT_ORIGIN_AND_2FA_GUIDE.md](./SPLIT_ORIGIN_AND_2FA_GUIDE.md)
- [SHOWCASE_TH.md](./SHOWCASE_TH.md)
- [SUBSCRIPTION_POLICY_TH.md](./SUBSCRIPTION_POLICY_TH.md)
- [LEGAL_TERMS_TH.md](./LEGAL_TERMS_TH.md)
- [PRIVACY_POLICY_TH.md](./PRIVACY_POLICY_TH.md)

## route หลักของระบบตอนนี้

- `/owner` และ `/owner/login` สำหรับ owner
- `/tenant` และ `/tenant/login` สำหรับ tenant admin
- `/player` และ `/player/login` สำหรับ player portal
- `/admin/legacy` เป็น compatibility path เท่านั้น

## runtime entrypoints หลัก

- `apps/discord-bot/server.js`
- `apps/admin-web/server.js`
- `apps/api/server.js`
- `apps/worker/server.js`
- `apps/watcher/server.js`
- `apps/agent/server.js`
- `apps/web-portal-standalone/server.js`

## ถ้าจะอ่านต่อ

- [../README_TH.md](../README_TH.md)
- [PROJECT_DETAIL_FILE_INDEX_TH.md](./PROJECT_DETAIL_FILE_INDEX_TH.md)
- [assets/README.md](./assets/README.md)
- [releases/README.md](./releases/README.md)
