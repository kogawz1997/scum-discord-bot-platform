# OWNER API DETAILED REFERENCE

อัปเดตล่าสุด: 2026-04-24

เอกสารนี้เป็น reference แบบละเอียดสำหรับ `Owner API` และ `platform/runtime API` ที่มีอยู่จริงใน repo ปัจจุบัน เพื่อให้ทีมเว็บเชื่อมระบบกลับมาใช้งานได้กับ backend ที่มีอยู่แล้ว

เอกสารนี้ตั้งใจตอบ 4 เรื่องหลัก:

- endpoint ไหนมีจริง
- endpoint นั้นใช้ทำอะไร
- frontend ควรส่งอะไรเข้าไป
- backend ข้างหลังเป็น service/file อะไร และมีข้อจำกัดอะไร

## 1. ภาพรวมการทำงานของ API surface

### 1.1 Surface alias

ฝั่งเว็บ `Owner` ไม่ได้คุยกับ backend route family ใหม่โดยตรง แต่ใช้ alias แบบนี้:

- `'/owner/api/*'` -> normalize เป็น `'/admin/api/*'`
- `'/tenant/api/*'` -> normalize เป็น `'/admin/api/*'`

สรุป:

- ถ้าทำหน้า `Owner` ให้ frontend ยิง `'/owner/api/*'`
- ถ้าจะ debug backend จริงในโค้ด ให้ดู route ใน `'/admin/api/*'`

อ้างอิง:

- `src/admin/runtime/adminServerRuntime.js`

### 1.2 การคุมสิทธิ์ระดับ surface

แม้ route หลายตัวใน `admin/api` จะเปิดให้ role ระดับ `mod` หรือ `admin` เรียกได้ แต่ถ้าเรียกผ่าน `'/owner/api/*'` จะโดน gate อีกชั้น:

- owner surface ต้องเป็น `role=owner`
- และต้องไม่เป็น tenant-scoped session

สรุป:

- Owner frontend ใช้ได้เฉพาะ platform owner session จริง
- tenant-scoped admin เรียก `'/owner/api/*'` ไม่ได้

### 1.3 Auth model ปัจจุบัน

ฝั่ง Owner web ใช้:

- same-origin cookie/session
- login/logout ผ่าน mutation API
- step-up/2FA มีใน backend ถ้า config เปิด

runtime/public API ใช้:

- platform API key scopes
- setup token สำหรับ activation flow บางตัว

## 2. รูปแบบ response ร่วมกัน

### 2.1 JSON response มาตรฐาน

success:

```json
{
  "ok": true,
  "data": {}
}
```

error:

```json
{
  "ok": false,
  "error": "reason-or-message"
}
```

บาง endpoint ใส่ `data.message`, `retryAfterSec`, หรือรายละเอียดเสริมใน `data`

### 2.2 Download/export endpoints

export endpoints หลายตัวไม่ได้ตอบ JSON ปกติ แต่ส่ง file download:

- `format=json`
- `format=csv`

frontend ต้องรองรับ:

- download response
- filename จาก header/metadata
- content type `application/json` หรือ `text/csv`

### 2.3 Error/status code ที่เจอบ่อย

- `400` bad request / payload invalid / validation fail
- `401` unauthenticated / invalid login / OTP required
- `403` forbidden / scope mismatch / surface-access-denied / tenant restriction
- `404` resource not found / download token not found
- `405` method-not-allowed
- `429` rate-limited

## 3. Auth / Session API

### 3.1 `POST /owner/api/login`

จริงใน backend:

- `POST /admin/api/login`

ใช้สำหรับ:

- owner login
- admin/owner login surface

body:

- `username`
- `password`
- `otp` เมื่อเปิด 2FA

พฤติกรรม:

- login rate limit
- ถ้า 2FA เปิดแต่ไม่ส่ง OTP จะได้ `401` และ `requiresOtp: true`
- success จะเซ็ต session cookie

success data:

- `user`
- `role`
- `tenantId`
- `sessionTtlHours`

อ้างอิง:

- `src/admin/api/adminAuthPostRoutes.js`

### 3.2 `POST /owner/api/logout`

จริงใน backend:

- `POST /admin/api/logout`

ใช้สำหรับ:

- clear session ปัจจุบัน

success data:

- `loggedOut: true`

### 3.3 `POST /owner/api/auth/session/revoke`

จริงใน backend:

- `POST /admin/api/auth/session/revoke`

ใช้สำหรับ:

- revoke session รายตัว
- revoke ทุก session ของ user
- revoke current session

body แบบที่ใช้ได้:

- `sessionId`
- `targetUser`
- `reason`
- `current: true`

behavior:

- ถ้า revoke current session จะ clear cookie ให้ด้วย

### 3.4 `GET /owner/api/me`

จริงใน backend:

- `GET /admin/api/me`

ใช้สำหรับ:

- bootstrap user session
- current role
- tenant binding
- step-up state
- tenant access summary

response data หลัก:

- `user`
- `role`
- `tenantId`
- `authMethod`
- `session`
- `stepUpRequired`
- `stepUpActive`
- `tenantConfig`
- `tenantAccess`

### 3.5 `GET /owner/api/auth/providers`

ใช้สำหรับ:

- login provider config UI
- 2FA config summary
- Discord SSO readiness
- session cookie policy display

response data หลัก:

- `loginSource`
- `password`
- `discordSso`
- `discordSsoRoleMapping`
- `twoFactor`
- `sessionCookie`
- `sessionPolicy`
- `stepUp`
- `roleMatrix`

### 3.6 `GET /owner/api/auth/role-matrix`

ใช้สำหรับ:

- role matrix page
- permission inspector

response data หลัก:

- `summary`
- `roles`
- `permissions`

### 3.7 `GET /owner/api/auth/security-events`

query:

- `limit`
- `type`
- `severity`
- `actor`
- `targetUser`
- `sessionId`

ใช้สำหรับ:

- security event feed
- audit/security panel

### 3.8 `GET /owner/api/auth/security-events/export`

query:

- `format=json|csv`
- filter ชุดเดียวกับ security events

### 3.9 `GET /owner/api/security/rotation-check`

ใช้สำหรับ:

- secret rotation posture
- owner security report

### 3.10 `GET /owner/api/security/rotation-check/export`

query:

- `format=json|csv`

### 3.11 `GET /owner/api/auth/sessions`

ใช้สำหรับ:

- active session list
- session revoke UI

note:

- owner-only
- tenant-scoped filtering ถูกใช้ถ้ามี tenant auth context

### 3.12 `GET /owner/api/auth/users`

ใช้สำหรับ:

- admin/operator user list
- owner access page

## 4. Health / Control Panel API

### 4.1 `GET /owner/api/control-panel/settings`

query:

- `tenantId`

ใช้สำหรับ:

- owner settings screen
- environment/config overview
- per-tenant settings context

### 4.2 `GET /owner/api/control-panel/commands`

ใช้สำหรับ:

- command registry UI
- available control-plane commands

### 4.3 `GET /owner/api/health`

ใช้สำหรับ:

- overall health page
- runtime supervisor status
- automation/restore status

response data หลัก:

- `now`
- `guilds`
- `role`
- `runtimeSupervisor`
- `automationState`
- `automationConfig`
- `backupRestore`

## 5. Owner Dashboard / Overview API

### 5.1 `GET /owner/api/platform/overview`

query:

- `tenantId`

รวมข้อมูลจากหลาย service:

- analytics
- public overview
- tenant feature access
- ops state
- automation state
- tenant config
- package catalog
- feature catalog
- plan catalog
- permission catalog

ใช้สำหรับ:

- owner overview dashboard
- platform snapshot
- tenant-scoped overview

service backing:

- `platformService`
- `platformAnalyticsService`
- `platformAutomationService`
- `platformTenantConfigService`

### 5.2 `GET /owner/api/platform/ops-state`

ใช้สำหรับ:

- operational state widget
- readiness summaries

### 5.3 `GET /owner/api/runtime/supervisor`

query:

- `refresh=true|false|1|0`

ใช้สำหรับ:

- runtime supervisor card
- force refresh state

### 5.4 `GET /owner/api/live`

ใช้สำหรับ:

- live surface status
- polling/heartbeat UI indicator

## 6. Tenants / Servers / Staff API

### 6.1 `GET /owner/api/platform/tenants`

query:

- `tenantId`
- `limit`
- `status`
- `type`

ใช้สำหรับ:

- tenant list
- tenant filter view
- tenant inspection

### 6.2 `POST /owner/api/platform/tenant`

body field ที่ backend อ่าน:

- `id`
- `slug`
- `name`
- `type`
- `status`
- `locale`
- `ownerName`
- `ownerEmail`
- `parentTenantId`
- `metadata`

ใช้สำหรับ:

- create tenant
- update tenant record แบบ control-plane

note:

- tenant-scoped admin ถูก block

### 6.3 `GET /owner/api/platform/servers`

query:

- `tenantId`
- `serverId`

ใช้สำหรับ:

- server registry
- filter by tenant/server

### 6.4 `POST /owner/api/platform/server`

body field:

- `id`
- `tenantId`
- `slug`
- `name`
- `status`
- `locale`
- `guildId`
- `metadata`

ใช้สำหรับ:

- create platform server record

### 6.5 `GET /owner/api/platform/server-discord-links`

query:

- `tenantId`
- `serverId`
- `guildId`

ใช้สำหรับ:

- Discord integration listing
- server-to-guild mapping screens

### 6.6 `POST /owner/api/platform/server-discord-link`

body field:

- `id`
- `tenantId`
- `serverId`
- `guildId`
- `status`
- `metadata`

ใช้สำหรับ:

- create server Discord link

### 6.7 `GET /owner/api/platform/tenant-staff`

query:

- `tenantId`
- `limit`

ใช้สำหรับ:

- tenant staff list

### 6.8 `POST /owner/api/platform/tenant-staff`

body field:

- `tenantId`
- `email`
- `displayName`
- `role`
- `locale`

ใช้สำหรับ:

- invite tenant staff

backend checks:

- tenant permission `manage_staff`
- entitlement action `can_manage_staff`

### 6.9 `POST /owner/api/platform/tenant-staff/role`

body field:

- `tenantId`
- `membershipId`
- `role`

ใช้สำหรับ:

- change tenant staff role

### 6.10 `POST /owner/api/platform/tenant-staff/revoke`

body field:

- `tenantId`
- `membershipId`
- `reason`

ใช้สำหรับ:

- revoke tenant staff membership

### 6.11 `GET /owner/api/platform/tenant-role-matrix`

query:

- `tenantId`

ใช้สำหรับ:

- tenant role matrix page

response data หลัก:

- `tenantId`
- `currentAccess`
- `roles`

## 7. Packages / Features / Quota / Entitlements API

### 7.1 `GET /owner/api/platform/packages`

ใช้สำหรับ:

- package list
- package catalog

### 7.2 `POST /owner/api/platform/package`

body field:

- `id`
- `name`
- `title`
- `description`
- `status`
- `position`
- `features`
- `featureText`
- `price`
- `amountCents`
- `currency`
- `billingCycle`
- `planId`
- `trialPlanId`
- `limits`
- `metadata`

ใช้สำหรับ:

- create package catalog entry

### 7.3 `POST /owner/api/platform/package/update`

body field ใกล้เคียงกับ create:

- `id`
- `name`
- `title`
- `description`
- `status`
- `position`
- `features`
- `featureText`
- `price`
- `amountCents`
- `currency`
- `billingCycle`
- `planId`
- `trialPlanId`
- `limits`
- `metadata`

ใช้สำหรับ:

- update package catalog entry

### 7.4 `POST /owner/api/platform/package/delete`

body field:

- `id`

ใช้สำหรับ:

- delete package catalog entry

### 7.5 `GET /owner/api/platform/features`

ใช้สำหรับ:

- feature matrix
- package builder UI

### 7.6 `GET /owner/api/platform/quota`

query:

- `tenantId`

ใช้สำหรับ:

- tenant quota snapshot

### 7.7 `GET /owner/api/platform/tenant-feature-access`

query:

- `tenantId`

ใช้สำหรับ:

- tenant entitlement view
- feature lock UI

### 7.8 `GET /owner/api/feature-access`

query:

- tenant scope ผ่าน auth หรือ `tenantId`

ใช้สำหรับ:

- frontend lock state
- scoped access resolution

## 8. Subscription / License / Billing API

### 8.1 `GET /owner/api/platform/subscriptions`

query:

- `tenantId`
- `limit`
- `status`

ใช้สำหรับ:

- subscription list

### 8.2 `POST /owner/api/platform/subscription`

body field:

- `id`
- `tenantId`
- `planId`
- `packageId`
- `billingCycle`
- `status`
- `currency`
- `amountCents`
- `intervalDays`
- `startedAt`
- `renewsAt`
- `canceledAt`
- `externalRef`
- `metadata`

ใช้สำหรับ:

- create subscription record

### 8.3 `POST /owner/api/platform/subscription/update`

body field:

- `tenantId`
- `subscriptionId`
- `planId`
- `billingCycle`
- `status`
- `currency`
- `amountCents`
- `renewsAt`
- `canceledAt`
- `externalRef`
- `packageId`
- `metadata`

ใช้สำหรับ:

- update subscription billing state

note:

- tenant-scoped admin ถูก block

### 8.4 `GET /owner/api/platform/licenses`

query:

- `tenantId`
- `limit`
- `status`

ใช้สำหรับ:

- license list

### 8.5 `POST /owner/api/platform/license`

body field:

- `id`
- `tenantId`
- `licenseKey`
- `status`
- `seats`
- `issuedAt`
- `expiresAt`
- `legalDocVersion`
- `legalAcceptedAt`
- `metadata`

ใช้สำหรับ:

- issue license

### 8.6 `POST /owner/api/platform/license/accept-legal`

body field:

- `tenantId`
- `licenseId`
- `legalDocVersion`
- `metadata`

ใช้สำหรับ:

- mark legal acceptance on license

### 8.7 `GET /owner/api/platform/billing/overview`

query:

- `tenantId`
- `invoiceLimit`
- `attemptLimit`

ใช้สำหรับ:

- billing health cards
- provider summary

response data หลัก:

- `provider`
- `summary.invoiceCount`
- `summary.openInvoiceCount`
- `summary.paidInvoiceCount`
- `summary.collectedCents`
- `summary.failedAttemptCount`

### 8.8 `GET /owner/api/platform/billing/invoices`

query:

- `tenantId`
- `status`
- `limit`

ใช้สำหรับ:

- invoice list

### 8.9 `GET /owner/api/platform/billing/payment-attempts`

query:

- `tenantId`
- `provider`
- `status`
- `limit`

ใช้สำหรับ:

- payment attempt list

### 8.10 `GET /owner/api/platform/billing/export`

query:

- `tenantId`
- `status`
- `provider`
- `attemptStatus`
- `invoiceLimit`
- `attemptLimit`
- `format=json|csv`

ใช้สำหรับ:

- full billing export

note:

- owner-only

### 8.11 `POST /owner/api/platform/billing/invoice/update`

body field:

- `tenantId`
- `invoiceId`
- `status`
- `paidAt`
- `externalRef`
- `metadata`

ใช้สำหรับ:

- update invoice status

### 8.12 `POST /owner/api/platform/billing/payment-attempt/update`

body field:

- `tenantId`
- `attemptId`
- `status`
- `completedAt`
- `externalRef`
- `errorCode`
- `errorDetail`
- `metadata`

ใช้สำหรับ:

- update payment attempt status

### 8.13 `POST /owner/api/platform/billing/checkout-session`

owner body field:

- `tenantId`
- `invoiceId`
- `subscriptionId`
- `customerId`
- `idempotencyKey`
- `planId`
- `packageId`
- `billingCycle`
- `currency`
- `amountCents`
- `successUrl`
- `cancelUrl`
- `checkoutUrl`
- `metadata`

tenant self-service branch ใน backend ยังมีอีก flow หนึ่ง แต่ถ้าทำ Owner UI ให้ยึด owner body ข้างบน

ใช้สำหรับ:

- create checkout session
- payment handoff

## 9. API Keys / Webhooks / Marketplace / Reconcile / Automation API

### 9.1 `GET /owner/api/platform/apikeys`

query:

- `tenantId`
- `limit`
- `status`

### 9.2 `POST /owner/api/platform/apikey`

body field:

- `id`
- `tenantId`
- `name`
- `status`
- `scopes`

ใช้สำหรับ:

- create API key

### 9.3 `GET /owner/api/platform/webhooks`

query:

- `tenantId`
- `limit`
- `eventType`

### 9.4 `POST /owner/api/platform/webhook`

body field:

- `id`
- `tenantId`
- `name`
- `eventType`
- `targetUrl`
- `secretValue`
- `enabled`

ใช้สำหรับ:

- create webhook endpoint

### 9.5 `POST /owner/api/platform/webhook/test`

body field:

- `tenantId`
- `eventType`
- `payload`

ใช้สำหรับ:

- fire test webhook event

response data หลัก:

- `tenantId`
- `eventType`
- `results`

### 9.6 `GET /owner/api/platform/marketplace`

query:

- `tenantId`
- `limit`
- `status`
- `locale`

### 9.7 `POST /owner/api/platform/marketplace`

body field:

- `id`
- `tenantId`
- `title`
- `kind`
- `priceCents`
- `currency`
- `status`
- `locale`
- `meta`

### 9.8 `GET /owner/api/platform/reconcile`

query:

- `tenantId`
- `windowMs`
- `pendingOverdueMs`

### 9.9 `POST /owner/api/platform/reconcile`

body field:

- `tenantId`
- `windowMs`
- `pendingOverdueMs`

ใช้สำหรับ:

- manual delivery reconcile

### 9.10 `POST /owner/api/platform/monitoring/run`

body:

- ไม่มี field สำคัญบังคับ

ใช้สำหรับ:

- force monitoring cycle

note:

- tenant-scoped admin ถูก block

### 9.11 `POST /owner/api/platform/automation/run`

body:

- `force`
- `dryRun`

ใช้สำหรับ:

- force automation cycle

note:

- tenant-scoped admin ถูก block

## 10. Runtime Fleet / Provisioning / Credentials API

### 10.1 `GET /owner/api/platform/agent-registry`

query:

- `tenantId`
- `serverId`

ใช้สำหรับ:

- registered runtime entity list

### 10.2 `GET /owner/api/platform/agent-provisioning`

query:

- `tenantId`
- `serverId`
- `agentId`
- `status`

ใช้สำหรับ:

- setup/provision token list

### 10.3 `POST /owner/api/platform/agent-token`

body field:

- `tenantId`
- `apiKeyId`
- `serverId`
- `guildId`
- `agentId`
- `runtimeKey`
- `role`
- `scope`
- `runtimeKind`
- `name`
- `displayName`
- `minimumVersion`

สำคัญ:

- backend บังคับ strict role/scope profile
- runtime role ต้องชัดเจนว่าเป็น Delivery Agent หรือ Server Bot

### 10.4 `POST /owner/api/platform/agent-provision`

body field:

- `id`
- `tokenId`
- `tenantId`
- `serverId`
- `guildId`
- `agentId`
- `runtimeKey`
- `role`
- `scope`
- `runtimeKind`
- `name`
- `displayName`
- `minimumVersion`
- `expiresAt`
- `metadata`

checks:

- permission `manage_runtimes`
- entitlement ตาม runtime action

### 10.5 `POST /owner/api/platform/runtime-download/prepare`

body field:

- `filename`
- `content`
- `mimeType`
- `tenantId`

ใช้สำหรับ:

- prepare file download ชั่วคราว

response data:

- `filename`
- `expiresAt`
- `downloadEndpoint`
- `downloadMethod`
- `downloadToken`

### 10.6 `POST /owner/api/platform/runtime-download`

body field:

- `token`

ใช้สำหรับ:

- consume token จาก prepare step แล้วรับไฟล์กลับ

note:

- backend จะตอบ 404 ถ้า token หมดอายุหรือถูกใช้ไปแล้ว

### 10.7 `GET /owner/api/platform/agent-devices`

query:

- `tenantId`
- `serverId`
- `agentId`
- `status`

### 10.8 `GET /owner/api/platform/agent-credentials`

query:

- `tenantId`
- `serverId`
- `agentId`
- `status`

### 10.9 `GET /owner/api/platform/agent-runtimes`

query:

- `tenantId`
- `serverId`
- `agentId`
- `status`

### 10.10 `GET /owner/api/platform/agent-sessions`

query:

- `tenantId`
- `serverId`
- `agentId`
- `status`

### 10.11 `GET /owner/api/platform/agents`

query:

- `tenantId`
- `limit`
- `status`

ใช้สำหรับ:

- runtime fleet overview

### 10.12 `GET /owner/api/platform/sync-runs`

query:

- `tenantId`
- `serverId`
- `agentId`

### 10.13 `GET /owner/api/platform/sync-events`

query:

- `tenantId`
- `serverId`
- `agentId`

### 10.14 `POST /owner/api/platform/agent-provision/revoke`

body field:

- `tenantId`
- `tokenId`
- `revokeReason`

### 10.15 `POST /owner/api/platform/agent-token/revoke`

body field:

- `tenantId`
- `apiKeyId`

### 10.16 `POST /owner/api/platform/agent-device/revoke`

body field:

- `tenantId`
- `deviceId`
- `revokeReason`

### 10.17 `POST /owner/api/platform/agent-runtime/revoke`

body field:

- `tenantId`
- `runtimeKind`
- `apiKeyId`
- `deviceId`
- `revokeReason`

### 10.18 `POST /owner/api/platform/agent-token/rotate`

body field:

- `tenantId`
- `apiKeyId`
- `name`

## 11. Server Config / Restart / Control API

กลุ่มนี้สำคัญมาก เพราะเป็น job-based orchestration ไม่ใช่ synchronous command

### 11.1 Read API

#### `GET /owner/api/platform/servers/:serverId/config`

query:

- `tenantId`
- `limit`

ใช้สำหรับ:

- config workspace summary

#### `GET /owner/api/platform/servers/:serverId/config/:category`

query:

- `tenantId`
- `limit`

ใช้สำหรับ:

- category-specific config view

#### `GET /owner/api/platform/servers/:serverId/config/jobs`

query:

- `tenantId`
- `jobId`
- `status`
- `queueStatus`
- `jobType`
- `limit`

ใช้สำหรับ:

- config job history

#### `GET /owner/api/platform/servers/:serverId/config/backups`

query:

- `tenantId`
- `limit`

ใช้สำหรับ:

- config backup history

#### `GET /owner/api/platform/restart-plans`

query:

- `tenantId`
- `serverId`
- `status`
- `limit`

#### `GET /owner/api/platform/restart-executions`

query:

- `tenantId`
- `serverId`
- `planId`
- `status`
- `limit`

#### `GET /owner/api/platform/tenant-config`

query:

- `tenantId`

#### `GET /owner/api/platform/tenant-configs`

query:

- `tenantId`
- `limit`

### 11.2 Mutation API

#### `POST /owner/api/platform/servers/:serverId/config/save`

body field:

- `tenantId`
- `applyMode`
- `changes`
- `reason`

allowed `applyMode`:

- `save_only`
- `save_apply`
- `save_restart`

notes:

- `changes` ต้องเป็น array
- max 500 entries
- ถ้า `save_restart` ต้องมี restart permission/entitlement เพิ่ม

#### `POST /owner/api/platform/servers/:serverId/config/apply`

body field:

- `tenantId`
- `applyMode`
- `reason`

default:

- fallback `save_apply`

#### `POST /owner/api/platform/servers/:serverId/config/rollback`

body field:

- `tenantId`
- `backupId`
- `applyMode`
- `reason`

default:

- fallback `save_restart`

#### `POST /owner/api/platform/servers/:serverId/config/jobs/:jobId/retry`

body field:

- `tenantId`

behavior:

- backend เช็ค source job type เดิม
- entitlement/message เปลี่ยนตามชนิด job

#### `POST /owner/api/platform/servers/:serverId/restart`

body field:

- `tenantId`
- `guildId`
- `runtimeKey`
- `requestedBy`
- `restartMode`
- `controlMode`
- `delaySeconds`
- `reason`
- `announcementPlan`
- `metadata`

allowed `restartMode`:

- อิงจาก `RESTART_MODES` ใน contract

notes:

- มี rate limit
- `delaySeconds` สูงสุด 24 ชั่วโมง
- action นี้สร้าง restart plan ไม่ได้ restart ทันทีแบบ sync

#### `POST /owner/api/platform/servers/:serverId/control/start`

body field:

- `tenantId`
- `runtimeKey`
- `reason`

สร้าง job type:

- `server_start`

#### `POST /owner/api/platform/servers/:serverId/control/stop`

body field:

- `tenantId`
- `runtimeKey`
- `reason`

สร้าง job type:

- `server_stop`

#### `POST /owner/api/platform/servers/:serverId/probes/sync`

body field:

- `tenantId`
- `runtimeKey`

สร้าง job type:

- `probe_sync`

#### `POST /owner/api/platform/servers/:serverId/probes/config-access`

body field:

- `tenantId`
- `runtimeKey`

สร้าง job type:

- `probe_config_access`

#### `POST /owner/api/platform/servers/:serverId/probes/restart`

body field:

- `tenantId`
- `runtimeKey`

สร้าง job type:

- `probe_restart`

ข้อควรเข้าใจ:

- กลุ่มนี้ต้องพึ่ง `Server Bot` มาดึง job ไปทำ
- frontend ควร render เป็น queued/running/completed/failure states
- ห้ามทำ UX แบบกดแล้ว assume success ทันที

## 12. Observability / Diagnostics / Support Evidence API

### 12.1 `GET /owner/api/observability`

query:

- `windowMs`
- `series`

ใช้สำหรับ:

- metrics overview

### 12.2 `GET /owner/api/observability/requests`

query:

- `limit`
- `windowMs`
- `statusClass`
- `routeGroup`
- `authMode`
- `requestId`
- `tenantId`
- `path`
- `onlyErrors=true|false`

ใช้สำหรับ:

- request log workbench

note:

- ต้อง role `admin` ใน admin surface

### 12.3 `GET /owner/api/observability/export`

query:

- `windowMs`
- `series`
- `format=json|csv`

### 12.4 `GET /owner/api/platform/tenant-diagnostics`

query:

- `tenantId`
- `limit`
- `windowMs`
- `pendingOverdueMs`

ใช้สำหรับ:

- diagnostics bundle ราย tenant

### 12.5 `GET /owner/api/platform/tenant-diagnostics/export`

query:

- `tenantId`
- `limit`
- `windowMs`
- `pendingOverdueMs`
- `format=json|csv`

### 12.6 `GET /owner/api/platform/tenant-support-case`

query:

- `tenantId`
- `orderCode`
- `playerId`
- `purchaseId`
- `includeAudit`

ใช้สำหรับ:

- support case bundle

### 12.7 `GET /owner/api/platform/tenant-support-case/export`

query:

- ชุดเดียวกับ support case
- `format=json|csv`

### 12.8 `GET /owner/api/delivery/lifecycle`

query:

- `tenantId`
- `limit`
- `pendingOverdueMs`
- `retryHeavyAttempts`
- `poisonAttempts`

ใช้สำหรับ:

- delivery lifecycle report

### 12.9 `GET /owner/api/delivery/lifecycle/export`

query:

- ชุดเดียวกับ lifecycle
- `format=json|csv`

### 12.10 `GET /owner/api/snapshot`

ใช้สำหรับ:

- platform snapshot JSON

### 12.11 `GET /owner/api/snapshot/export`

ใช้สำหรับ:

- snapshot download

## 13. Delivery Support / Player Support API

### 13.1 `GET /owner/api/delivery/queue`

query:

- `tenantId`
- `limit`
- `errorCode`
- `q`

### 13.2 `GET /owner/api/delivery/dead-letter`

query:

- `tenantId`
- `limit`
- `errorCode`
- `q`

### 13.3 `GET /owner/api/delivery/runtime`

ใช้สำหรับ:

- delivery runtime status summary

### 13.4 `GET /owner/api/delivery/capabilities`

ใช้สำหรับ:

- builtin command capabilities
- admin presets

### 13.5 `GET /owner/api/delivery/command-template`

query:

- `lookupKey`
- `itemId`
- `gameItemId`

ใช้สำหรับ:

- resolve delivery command override/template

### 13.6 `GET /owner/api/delivery/detail`

query:

- `code` (required)
- `tenantId`
- `limit`

ใช้สำหรับ:

- purchase/delivery forensic detail

returns เมื่อพบ:

- `purchase`
- `queueJob`
- `deadLetter`
- `auditRows`

### 13.7 `GET /owner/api/purchase/statuses`

query:

- `current`

returns:

- `knownStatuses`
- `currentStatus`
- `allowedTransitions`

### 13.8 `GET /owner/api/dashboard/cards`

query:

- `tenantId`
- `refresh`

ใช้สำหรับ:

- admin/owner dashboard cards summary

### 13.9 `GET /owner/api/player/accounts`

query:

- `tenantId`
- `limit`

### 13.10 `GET /owner/api/player/dashboard`

query:

- `userId` (required)
- `tenantId`

### 13.11 `GET /owner/api/player/identity`

query:

- `userId` (required)
- `tenantId`

returns:

- `account`
- `steamLink`
- `identitySummary`

## 14. Notifications / Inbox API

### 14.1 `GET /owner/api/notifications`

query:

- `limit`
- `type`
- `kind`
- `severity`
- `entityKey`
- `tenantId`
- `acknowledged=true|false`

response:

- `{ items: [...] }`

### 14.2 `GET /owner/api/notifications/export`

query:

- filter ชุดเดียวกับ notifications
- `format=json|csv`

### 14.3 `POST /owner/api/notifications/ack`

body:

- `ids` เป็น array/string array

note:

- tenant-scoped admin ถูก block

### 14.4 `POST /owner/api/notifications/clear`

body:

- `acknowledgedOnly`

## 15. Backup / Recovery API

### 15.1 `GET /owner/api/backup/list`

ใช้สำหรับ:

- shared backup inventory

note:

- owner-only
- tenant-scoped admin ถูก block

### 15.2 `GET /owner/api/backup/restore/status`

ใช้สำหรับ:

- current restore state

### 15.3 `GET /owner/api/backup/restore/history`

query:

- `limit`

### 15.4 `POST /owner/api/backup/create`

body:

- อิง backup creation flow ใน platform route
- ใช้สร้าง backup record/file

### 15.5 `POST /owner/api/backup/restore`

body:

- อิง restore flow ใน platform route

note:

- restore เป็น privileged flow
- frontend ควรใช้ guarded confirmation

## 16. Community Signal APIs ที่ Owner อ่านได้

### 16.1 `GET /owner/api/event/list`

### 16.2 `GET /owner/api/raid/list`

### 16.3 `GET /owner/api/killfeed/list`

ใช้สำหรับ:

- owner-level signal feed
- support context embeds
- read-only monitoring panels

## 17. Public / Runtime / Machine Integration API

กลุ่มนี้ไม่ใช่ Owner page contract หลัก แต่สำคัญมากถ้าจะทำ installer, runtime agent, server bot, หรือ public plan/preview pages

### 17.1 Public read endpoints

#### `GET /platform/api/v1/public/overview`

auth:

- public

ใช้สำหรับ:

- marketing/public overview
- bootstrap public platform view

#### `GET /platform/api/v1/public/packages`

auth:

- public

returns:

- `packages`
- `features`

### 17.2 Tenant-scoped API key endpoints

#### `GET /platform/api/v1/tenant/self`

scope:

- `tenant:read`

returns:

- `tenant`
- `apiKey`
- `scopes`
- `quota`

#### `GET /platform/api/v1/quota/self`

scope:

- `tenant:read`

#### `GET /platform/api/v1/features/self`

scope:

- `tenant:read`

#### `GET /platform/api/v1/analytics/overview`

scope:

- `analytics:read`

### 17.3 Runtime activation / presence

#### `POST /platform/api/v1/agent/heartbeat`

scope:

- `agent:write`

body:

- `runtimeKey`
- `version`
- `channel`
- `status`
- `minRequiredVersion`
- `meta`

#### `POST /platform/api/v1/agent/activate`

auth:

- setup token flow

body:

- `setupToken` หรือ `setup_token`
- `machineFingerprint` หรือ `machine_fingerprint`
- `runtimeKey`
- `displayName` หรือ `name`
- `hostname`
- `version`
- `channel`
- `baseUrl`
- `metadata`

note:

- มี rate limit

#### `POST /platform/api/v1/agent/register`

scope:

- `agent:register` หรือ `agent:write`

body:

- `id`
- `tenantId`
- `serverId`
- `guildId`
- `agentId`
- `runtimeKey`
- `displayName` หรือ `name`
- `role`
- `scope`
- `channel`
- `version`
- `minimumVersion` หรือ `minRequiredVersion`
- `baseUrl`
- `hostname`
- `meta`

returns:

- `agent`
- `binding`

#### `POST /platform/api/v1/agent/session`

scope:

- `agent:session` หรือ `agent:write`

body:

- `sessionId`
- `tenantId`
- `serverId`
- `guildId`
- `agentId`
- `runtimeKey`
- `role`
- `scope`
- `channel`
- `version`
- `heartbeatAt`
- `baseUrl`
- `hostname`
- `diagnostics`
- `meta`

returns:

- `session`
- `agent`

#### `POST /platform/api/v1/agent/sync`

scope:

- `agent:sync`

body:

- `syncRunId`
- `tenantId`
- `serverId`
- `guildId`
- `agentId`
- `runtimeKey`
- `role`
- `scope`
- `channel`
- `version`
- `heartbeatAt`
- `sourceType`
- `sourcePath`
- `freshnessAt`
- `eventCount`
- `snapshot`
- `events`
- `errors`
- `payload`
- `meta`

returns:

- `syncRun`
- `syncEvents`
- `server`
- `agent`

### 17.4 Server config job protocol

#### `POST /platform/api/v1/server-config/snapshot`

scope:

- `config:write` หรือ `agent:sync`

body:

- `tenantId`
- `serverId`
- `runtimeKey`
- `snapshot`
- `lastJobId`
- `lastError`

#### `GET /platform/api/v1/server-config/jobs/next`

scope อย่างใดอย่างหนึ่ง:

- `agent:sync`
- `config:write`
- `server:control`

query:

- `tenantId`
- `serverId`
- `runtimeKey`

ใช้สำหรับ:

- Server Bot claim next job

#### `POST /platform/api/v1/server-config/jobs/result`

scope อย่างใดอย่างหนึ่ง:

- `agent:sync`
- `config:write`
- `server:control`

body:

- `tenantId`
- `serverId`
- `runtimeKey`
- `jobId`
- `status`
- `result`
- `error`
- `backups`
- `snapshot`

ใช้สำหรับ:

- Server Bot report job completion

### 17.5 Reconcile / webhook test

#### `POST /platform/api/v1/delivery/reconcile`

scope:

- `delivery:reconcile`

body:

- `windowMs`
- `pendingOverdueMs`

#### `POST /platform/api/v1/webhooks/test`

scope:

- `webhook:write`

body:

- `eventType`
- `payload`

## 18. Backend ownership map

### 18.1 Owner route handlers

- `src/admin/api/adminAuthPostRoutes.js`
- `src/admin/api/adminGetRoutes.js`
- `src/admin/api/adminBillingGetRoutes.js`
- `src/admin/api/adminBillingPostRoutes.js`
- `src/admin/api/adminPlatformPostRoutes.js`
- `src/admin/api/adminRuntimeConfigGetRoutes.js`
- `src/admin/api/adminRuntimeControlPostRoutes.js`
- `src/admin/api/adminObservabilityGetRoutes.js`
- `src/admin/api/adminDiagnosticsGetRoutes.js`
- `src/admin/api/adminDeliveryOpsGetRoutes.js`
- `src/admin/api/adminNotificationGetRoutes.js`
- `src/admin/api/adminNotificationPostRoutes.js`
- `src/admin/api/adminPublicRoutes.js`

### 18.2 Core backend services

commercial/platform:

- `src/services/platformService.js`
- `src/services/platformCommercialService.js`

billing:

- `src/services/platformBillingLifecycleService.js`

runtime:

- `src/services/platformAgentRuntimeService.js`
- `src/services/platformAgentPresenceService.js`

config/restart:

- `src/services/platformServerConfigService.js`
- `src/services/platformRestartOrchestrationService.js`
- `src/services/platformRestartCompatibilityService.js`

diagnostics/support:

- `src/services/tenantDiagnosticsService.js`
- `src/services/adminObservabilityService.js`
- `src/services/deliveryLifecycleService.js`
- `src/services/adminSnapshotService.js`

identity/player:

- `src/services/platformIdentityService.js`
- `src/services/platformIdentitySchemaService.js`
- `src/services/playerOpsService.js`

## 19. ข้อควรระวังเวลาเอาไปเชื่อมหน้าเว็บ

- ยึด `'/owner/api/*'` เป็น contract ฝั่ง Owner frontend
- อย่าเรียก `'/admin/api/*'` ตรงจากหน้า Owner ถ้าไม่จำเป็น
- route กลุ่ม restart/config/control เป็น async job orchestration
- route กลุ่ม runtime จะดูเหมือน “ไม่มีข้อมูล” ถ้า runtime ยังไม่ heartbeat/sync
- export endpoints ไม่ได้คืน JSON เสมอ
- runtime/public API บางตัวต้องใช้ API key scope ไม่ใช่ cookie session
- `Delivery Agent` กับ `Server Bot` ห้ามรวม model กันใน frontend
- mutation หลายตัวมี entitlement + permission + rate limit ไม่ใช่แค่ payload ถูกแล้วจะผ่านทันที

## 20. เอกสารที่เกี่ยวข้อง

- สรุปย่อสำหรับ map หน้าเว็บ: `docs/OWNER_API_BACKEND_MAP_TH.md`
- reference ละเอียดฉบับนี้: `docs/OWNER_API_DETAILED_REFERENCE_TH.md`
