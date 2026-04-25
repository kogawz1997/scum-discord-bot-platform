# OWNER API / BACKEND MAP

อัปเดตล่าสุด: 2026-04-24

เอกสารนี้สรุป `API` และ `backend` ที่ฝั่งเว็บ `Owner` ควรใช้จริงใน repo ปัจจุบัน เพื่อให้ทีม frontend/web ต่อกลับมาแล้วใช้งานได้กับของที่มีอยู่จริง โดยอิงจาก route และ service ใน source code ไม่ใช่จาก mockup หรือ placeholder page

## 1. กติกาหลัก

- ฝั่งเว็บ `Owner` ให้เรียก `'/owner/api/*'`
- backend จะ normalize `'/owner/api/*'` ไปเป็น `'/admin/api/*'` ภายใน
- ห้ามเปลี่ยน contract route ถ้ายังต้องการให้ frontend กลับมาต่อกับ backend เดิมได้
- auth model ปัจจุบันเป็น same-origin cookie/session
- `Delivery Agent` และ `Server Bot` เป็นคนละ runtime role ต้องแยกกันเสมอ
- endpoint ที่อยู่ในเอกสารนี้คือของที่ “มี route จริงใน repo” แต่ไม่ได้หมายความว่าผ่าน smoke test สดทุกตัวในรอบนี้

## 2. จุดอ้างอิงในโค้ด

- owner-to-admin route normalization: `src/admin/runtime/adminServerRuntime.js`
- owner GET routes หลัก: `src/admin/api/adminGetRoutes.js`
- billing GET: `src/admin/api/adminBillingGetRoutes.js`
- billing POST: `src/admin/api/adminBillingPostRoutes.js`
- diagnostics GET: `src/admin/api/adminDiagnosticsGetRoutes.js`
- observability GET: `src/admin/api/adminObservabilityGetRoutes.js`
- delivery ops GET: `src/admin/api/adminDeliveryOpsGetRoutes.js`
- notifications GET/POST: `src/admin/api/adminNotificationGetRoutes.js`, `src/admin/api/adminNotificationPostRoutes.js`
- platform POST routes: `src/admin/api/adminPlatformPostRoutes.js`
- runtime config GET: `src/admin/api/adminRuntimeConfigGetRoutes.js`
- runtime control POST: `src/admin/api/adminRuntimeControlPostRoutes.js`
- runtime/public integration routes: `src/admin/api/adminPublicRoutes.js`

## 3. Primary Owner Web Contract

ส่วนนี้คือ endpoint หลักที่ฝั่งเว็บ `Owner` ควรใช้เป็นฐานในการเชื่อมหน้าใช้งานจริง

### 3.1 Auth / Session / Security

Routes:

- `GET /owner/api/me`
- `GET /owner/api/auth/providers`
- `GET /owner/api/auth/role-matrix`
- `GET /owner/api/auth/security-events`
- `GET /owner/api/auth/security-events/export`
- `GET /owner/api/security/rotation-check`
- `GET /owner/api/security/rotation-check/export`
- `GET /owner/api/auth/sessions`
- `GET /owner/api/auth/users`
- `GET /owner/api/control-panel/settings`
- `GET /owner/api/control-panel/commands`
- `GET /owner/api/health`

Use for:

- current operator/session
- auth provider display
- role/access matrix
- security event feed
- session management UI
- rotation/security posture
- control panel settings page

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`
- services: `src/services/platformWorkspaceAuthService.js`, `src/services/adminAuditService.js`

### 3.2 Platform Overview / Owner Dashboard

Routes:

- `GET /owner/api/platform/overview`
- `GET /owner/api/platform/billing/overview`
- `GET /owner/api/notifications`
- `GET /owner/api/platform/ops-state`
- `GET /owner/api/runtime/supervisor`
- `GET /owner/api/live`

Use for:

- top-level KPI cards
- billing health summary
- notification/incident summary
- platform operational state
- runtime supervisor summary
- liveness/live status widgets

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminBillingGetRoutes.js`, `src/admin/api/adminNotificationGetRoutes.js`
- services: `src/services/platformService.js`, `src/services/platformBillingLifecycleService.js`, `src/services/runtimeSupervisorService.js`

### 3.3 Tenants / Staff / Server Registry

Routes:

- `GET /owner/api/platform/tenants`
- `GET /owner/api/platform/servers`
- `GET /owner/api/platform/server-discord-links`
- `GET /owner/api/platform/tenant-staff`
- `GET /owner/api/platform/tenant-role-matrix`
- `POST /owner/api/platform/tenant`
- `POST /owner/api/platform/tenant-staff`
- `POST /owner/api/platform/tenant-staff/role`
- `POST /owner/api/platform/tenant-staff/revoke`
- `POST /owner/api/platform/server`
- `POST /owner/api/platform/server-discord-link`

Use for:

- tenant list / tenant detail
- server registry
- Discord link management
- tenant staff management
- tenant role assignment
- create/update tenant
- add/revoke staff
- create server / attach server integrations

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminPlatformPostRoutes.js`
- services: `src/services/platformTenantRegistryService.js`, `src/services/platformTenantStaffService.js`, `src/services/platformTenantStateService.js`

### 3.4 Packages / Features / Quota / Entitlements

Routes:

- `GET /owner/api/platform/packages`
- `GET /owner/api/platform/features`
- `GET /owner/api/platform/quota`
- `GET /owner/api/platform/tenant-feature-access`
- `GET /owner/api/feature-access`
- `POST /owner/api/platform/package`
- `POST /owner/api/platform/package/update`
- `POST /owner/api/platform/package/delete`

Use for:

- package catalog
- feature matrix
- quota summary
- tenant entitlement inspection
- locked-state or gated navigation logic

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminPlatformPostRoutes.js`
- services: `src/services/platformService.js`, `src/services/platformCommercialService.js`

### 3.5 Subscriptions / Licenses / Billing

Routes:

- `GET /owner/api/platform/subscriptions`
- `GET /owner/api/platform/licenses`
- `GET /owner/api/platform/billing/overview`
- `GET /owner/api/platform/billing/invoices`
- `GET /owner/api/platform/billing/payment-attempts`
- `GET /owner/api/platform/billing/export`
- `POST /owner/api/platform/subscription`
- `POST /owner/api/platform/subscription/update`
- `POST /owner/api/platform/billing/invoice/update`
- `POST /owner/api/platform/billing/payment-attempt/update`
- `POST /owner/api/platform/billing/checkout-session`
- `POST /owner/api/platform/license`
- `POST /owner/api/platform/license/accept-legal`

Use for:

- subscription management
- license lifecycle
- invoice list/detail
- payment attempt list/detail
- billing export
- checkout/session tooling

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminBillingGetRoutes.js`, `src/admin/api/adminBillingPostRoutes.js`, `src/admin/api/adminPlatformPostRoutes.js`
- services: `src/services/platformService.js`, `src/services/platformBillingLifecycleService.js`

Important integration note:

- billing lifecycle มีโค้ดจริงทั้ง local provider และ external provider
- ถ้าจะใช้ payment provider ภายนอกจริง ต้องมี env/config ครบก่อน

### 3.6 API Keys / Webhooks / Marketplace / Platform Actions

Routes:

- `GET /owner/api/platform/apikeys`
- `GET /owner/api/platform/webhooks`
- `GET /owner/api/platform/marketplace`
- `GET /owner/api/platform/reconcile`
- `POST /owner/api/platform/apikey`
- `POST /owner/api/platform/webhook`
- `POST /owner/api/platform/webhook/test`
- `POST /owner/api/platform/marketplace`
- `POST /owner/api/platform/reconcile`
- `POST /owner/api/platform/monitoring/run`
- `POST /owner/api/platform/automation/run`

Use for:

- API key management
- webhook management
- webhook test action
- marketplace/admin integration management
- manual reconcile
- owner-triggered monitoring
- owner-triggered automation

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminPlatformPostRoutes.js`
- services: `src/services/platformIntegrationService.js`, `src/services/platformMarketplaceService.js`, `src/services/platformMonitoringService.js`, `src/services/platformAutomationService.js`, `src/services/platformDeliveryReconcileService.js`

### 3.7 Runtime Fleet / Presence / Sessions

Routes:

- `GET /owner/api/platform/agents`
- `GET /owner/api/platform/agent-registry`
- `GET /owner/api/platform/agent-provisioning`
- `GET /owner/api/platform/runtime-download`
- `GET /owner/api/platform/agent-devices`
- `GET /owner/api/platform/agent-credentials`
- `GET /owner/api/platform/agent-runtimes`
- `GET /owner/api/platform/agent-sessions`
- `GET /owner/api/platform/sync-runs`
- `GET /owner/api/platform/sync-events`
- `POST /owner/api/platform/agent-token`
- `POST /owner/api/platform/agent-provision`
- `POST /owner/api/platform/runtime-download/prepare`
- `POST /owner/api/platform/agent-provision/revoke`
- `POST /owner/api/platform/agent-token/revoke`
- `POST /owner/api/platform/agent-device/revoke`
- `POST /owner/api/platform/agent-runtime/revoke`
- `POST /owner/api/platform/agent-token/rotate`

Use for:

- runtime fleet overview
- runtime/session inspection
- provisioning and credential lifecycle
- download prep for managed runtime packages
- revoke / rotate / reissue actions

Critical UI rule:

- หน้าเว็บต้องแยก `Delivery Agent` และ `Server Bot` ออกจากกันเสมอ
- ห้าม merge เป็นคำกลาง ๆ เช่น “runtime node” หรือ “agent” เดียว

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminPlatformPostRoutes.js`, `src/admin/api/adminDiagnosticsGetRoutes.js`
- services: `src/services/platformAgentRuntimeService.js`, `src/services/platformAgentPresenceService.js`, `src/services/platformService.js`

Important integration note:

- ข้อมูล freshness ขึ้นกับ heartbeat/session/sync จาก runtime จริง
- ถ้า runtime machine ยังไม่ออนไลน์ หน้าเว็บจะได้ข้อมูลว่างหรือ stale ตามจริง

### 3.8 Restart / Config / Server Control

Routes:

- `GET /owner/api/platform/restart-plans`
- `GET /owner/api/platform/restart-executions`
- `GET /owner/api/platform/tenant-config`
- `GET /owner/api/platform/tenant-configs`
- `POST /owner/api/platform/servers/:serverId/config/save`
- `POST /owner/api/platform/servers/:serverId/config/apply`
- `POST /owner/api/platform/servers/:serverId/config/rollback`
- `POST /owner/api/platform/servers/:serverId/config/jobs/:jobId/retry`
- `POST /owner/api/platform/servers/:serverId/restart`
- `POST /owner/api/platform/servers/:serverId/control/start`
- `POST /owner/api/platform/servers/:serverId/control/stop`
- `POST /owner/api/platform/servers/:serverId/probes/sync`
- `POST /owner/api/platform/servers/:serverId/probes/config-access`
- `POST /owner/api/platform/servers/:serverId/probes/restart`

Use for:

- restart plan/execution pages
- config history / config workspace inspection
- save/apply/rollback flows
- retry config jobs
- restart/start/stop controls
- sync/config-access/restart probes

Backend ownership:

- routes: `src/admin/api/adminRuntimeConfigGetRoutes.js`, `src/admin/api/adminRuntimeControlPostRoutes.js`
- services: `src/services/platformServerConfigService.js`, `src/services/platformRestartOrchestrationService.js`, `src/services/platformRestartCompatibilityService.js`

Important integration note:

- action เหล่านี้จะเห็นผลจริงเมื่อ `Server Bot` online และมาดึง job ไปทำ
- frontend ควรมอง action พวกนี้เป็น job-based orchestration ไม่ใช่ synchronous instant action

### 3.9 Observability / Diagnostics / Evidence

Routes:

- `GET /owner/api/observability`
- `GET /owner/api/observability/requests`
- `GET /owner/api/observability/export`
- `GET /owner/api/platform/tenant-diagnostics`
- `GET /owner/api/platform/tenant-diagnostics/export`
- `GET /owner/api/platform/tenant-support-case`
- `GET /owner/api/platform/tenant-support-case/export`
- `GET /owner/api/delivery/lifecycle`
- `GET /owner/api/delivery/lifecycle/export`
- `GET /owner/api/snapshot`
- `GET /owner/api/snapshot/export`

Use for:

- observability overview
- request/error inspection
- tenant diagnostics bundle
- support case export
- delivery lifecycle evidence
- platform snapshot export

Backend ownership:

- routes: `src/admin/api/adminObservabilityGetRoutes.js`, `src/admin/api/adminDiagnosticsGetRoutes.js`, `src/admin/api/adminGetRoutes.js`
- services: `src/services/adminObservabilityService.js`, `src/services/tenantDiagnosticsService.js`, `src/services/deliveryLifecycleService.js`, `src/services/adminSnapshotService.js`

### 3.10 Delivery Support / Rescue Views

Routes:

- `GET /owner/api/delivery/queue`
- `GET /owner/api/delivery/dead-letter`
- `GET /owner/api/delivery/runtime`
- `GET /owner/api/delivery/capabilities`
- `GET /owner/api/delivery/command-template`
- `GET /owner/api/delivery/detail`
- `GET /owner/api/purchase/statuses`
- `GET /owner/api/dashboard/cards`
- `GET /owner/api/player/accounts`
- `GET /owner/api/player/dashboard`
- `GET /owner/api/player/identity`

Use for:

- queue and dead-letter rescue tooling
- delivery runtime/capability inspection
- delivery detail drilldown
- player identity support context
- support-side player/account troubleshooting

Backend ownership:

- routes: `src/admin/api/adminDeliveryOpsGetRoutes.js`
- services: `src/services/deliveryLifecycleService.js`, `src/services/playerOpsService.js`, `src/services/platformIdentityService.js`, `src/services/platformIdentitySchemaService.js`

### 3.11 Notifications

Routes:

- `GET /owner/api/notifications`
- `GET /owner/api/notifications/export`
- `POST /owner/api/notifications/ack`
- `POST /owner/api/notifications/clear`

Use for:

- notification inbox
- export/audit view
- acknowledge flow
- clear acknowledged flow

Backend ownership:

- routes: `src/admin/api/adminNotificationGetRoutes.js`, `src/admin/api/adminNotificationPostRoutes.js`
- services: `src/services/adminAuditService.js`, `src/services/adminLiveBus.js`

### 3.12 Backup / Recovery

Routes:

- `GET /owner/api/backup/list`
- `GET /owner/api/backup/restore/status`
- `GET /owner/api/backup/restore/history`
- `POST /owner/api/backup/create`
- `POST /owner/api/backup/restore`

Use for:

- backup inventory
- restore status/history
- create backup
- trigger restore

Backend ownership:

- routes: `src/admin/api/adminGetRoutes.js`, `src/admin/api/adminPlatformPostRoutes.js`
- services: `src/services/platformServerConfigService.js`

### 3.13 Community / Signal Feeds Available to Owner

Routes:

- `GET /owner/api/event/list`
- `GET /owner/api/raid/list`
- `GET /owner/api/killfeed/list`

Use for:

- owner-level visibility into tenant/game activity signals
- read-only event/raid/killfeed screens or support context embeds

Backend ownership:

- routes: `src/admin/api/adminCommunityGetRoutes.js`
- services: `src/services/eventService.js`, `src/services/raidService.js`, `src/services/killFeedService.js`

## 4. Secondary Owner-Callable Endpoints

endpoint กลุ่มนี้มี route จริงและ owner surface สามารถเรียกผ่าน alias ได้ แต่ไม่ควรใช้เป็นแกนหลักของ Owner information architecture ถ้ายังไม่จำเป็น

Routes:

- `GET /owner/api/items/catalog`
- `GET /owner/api/items/weapons-catalog`
- `GET /owner/api/items/manifest-catalog`
- `GET /owner/api/shop/list`
- `GET /owner/api/purchase/list`
- `GET /owner/api/portal/player/dashboard`
- `GET /owner/api/portal/shop/list`
- `GET /owner/api/portal/purchase/list`
- `GET /owner/api/portal/bounty/list`

Use for:

- support/read-only inspection
- admin preview
- cross-surface debugging

## 5. Runtime / Public Integration Endpoints

ส่วนนี้เป็น backend integration contract สำหรับ runtime machines, activation, sync, และ public/platform bootstrap ไม่ใช่ Owner web page contract หลัก

Routes:

- `GET /platform/api/v1/public/overview`
- `GET /platform/api/v1/public/packages`
- `GET /platform/api/v1/tenant/self`
- `GET /platform/api/v1/quota/self`
- `GET /platform/api/v1/features/self`
- `GET /platform/api/v1/analytics/overview`
- `POST /platform/api/v1/agent/heartbeat`
- `POST /platform/api/v1/agent/activate`
- `POST /platform/api/v1/agent/register`
- `POST /platform/api/v1/agent/session`
- `POST /platform/api/v1/agent/sync`
- `POST /platform/api/v1/server-config/snapshot`
- `GET /platform/api/v1/server-config/jobs/next`
- `POST /platform/api/v1/server-config/jobs/result`
- `POST /platform/api/v1/delivery/reconcile`
- `POST /platform/api/v1/webhooks/test`

Use for:

- runtime activation
- heartbeat/status
- session tracking
- sync reporting
- server config snapshot/job execution
- delivery reconcile
- public/platform bootstrap reads

Backend ownership:

- routes: `src/admin/api/adminPublicRoutes.js`
- services: `src/services/platformService.js`, `src/services/platformServerConfigService.js`, `src/services/platformDeliveryReconcileService.js`, `src/services/platformAgentRuntimeService.js`

Important integration note:

- endpoint กลุ่มนี้ไว้ให้ runtime machine หรือ integration client เรียก
- ไม่ควรออกแบบหน้า Owner ให้ยิงกลุ่มนี้ตรง ๆ ถ้ามี owner alias อยู่แล้ว

## 6. Backend Ownership Map by Domain

### Platform / tenant / commercial

Core files:

- `src/services/platformService.js`
- `src/services/platformCommercialService.js`
- `src/services/platformTenantRegistryService.js`
- `src/services/platformTenantStaffService.js`
- `src/services/platformTenantStateService.js`

ครอบคลุม:

- tenants
- packages
- features
- quota
- subscriptions
- licenses
- api keys
- webhooks
- marketplace

### Billing lifecycle

Core files:

- `src/services/platformBillingLifecycleService.js`

ครอบคลุม:

- checkout session
- invoice state
- payment attempts
- subscription billing state
- billing webhook processing

### Runtime registry / credentials / presence

Core files:

- `src/services/platformAgentRuntimeService.js`
- `src/services/platformAgentPresenceService.js`

ครอบคลุม:

- heartbeat
- runtime listing
- session/runtime state
- agent presence

### Config / restart / backup / server actions

Core files:

- `src/services/platformServerConfigService.js`
- `src/services/platformRestartOrchestrationService.js`
- `src/services/platformRestartCompatibilityService.js`
- `src/services/scumServerBotRuntime.js`

ครอบคลุม:

- config jobs
- save/apply/rollback
- restart plans/executions
- probes
- backup/restore support

### Diagnostics / support / evidence

Core files:

- `src/services/tenantDiagnosticsService.js`
- `src/services/adminObservabilityService.js`
- `src/services/deliveryLifecycleService.js`
- `src/services/adminSnapshotService.js`

ครอบคลุม:

- tenant diagnostics bundle
- support case bundle
- observability
- lifecycle evidence
- snapshot/export

## 7. ข้อควรระวังสำหรับทีมเว็บ

- ถ้าจะให้เว็บ `Owner` กลับมาเชื่อมได้จริง ให้ยึด `'/owner/api/*'` เท่านั้น
- อย่าเอา mockup action ที่ไม่มี route จริงมาใส่ เช่น remote console ปลอม หรือ deploy action ปลอม
- runtime action หลายตัวเป็น async orchestration ผ่าน job ไม่ใช่กดแล้วสำเร็จทันที
- server control/config/restart จะทำงานจริงต่อเมื่อ `Server Bot` online
- runtime presence/session/sync จะมีค่าได้ต่อเมื่อ `Delivery Agent` หรือ `Server Bot` heartbeat/sync เข้ามา
- billing external provider ต้องพึ่ง env/provider config เพิ่มเติม
- endpoint บางตัวเป็น read-only support surface ไม่ควรใช้เป็น primary IA ของ Owner

## 8. แนะนำการใช้งานเอกสารนี้

- ใช้เอกสารนี้เป็น source of truth ตอน map หน้า Owner กับ backend
- เวลาสั่งออกแบบ UI ให้ยึด section `Primary Owner Web Contract`
- เวลาทำ runtime installer/provision/activation ให้ยึด section `Runtime / Public Integration Endpoints`
- ถ้าจะเพิ่มหน้าใหม่ใน Owner ให้เช็คก่อนว่ามี route จริงในไฟล์ที่อ้างไว้หรือไม่
