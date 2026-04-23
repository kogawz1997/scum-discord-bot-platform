# Route And API Map

This is a curated summary of the current frontend-to-backend contract for Stitch work. It is not a replacement for the source files; it is the fastest route-aware summary to keep redesign work aligned with the current implementation.

## Cross-Cutting Rules

- Owner and Tenant admin flows currently mix surface aliases and admin endpoints.
- Player and Public flows are served from the standalone portal runtime.
- Browser calls are same-origin and cookie-based.
- Feature/package gating comes from backend state, not UI-only rules.
- Admin live updates currently use SSE at `/admin/api/live`.

## Owner Panel

### Current Entry Points

- login: `/owner/login`
- shell root: `/owner`
- current shell model: one shell with page sections and path aliases

### Current Section Aliases In The Browser Shell

Current section keys in `owner-v4-app.js`:

- `dashboard`
- `overview`
- `tenants`
- `packages`
- `subscriptions`
- `billing`
- `runtime`
- `runtime-health`
- `incidents`
- `observability`
- `jobs`
- `audit`
- `security`
- `support`
- `recovery`
- `settings`

Current path aliases:

- `/owner`
- `/owner/tenants`
- `/owner/packages`
- `/owner/subscriptions`
- `/owner/runtime`
- `/owner/recovery`
- `/owner/analytics`
- `/owner/audit`
- `/owner/settings`

### Primary Read Endpoints Used By The Owner UI

- `/owner/api/me`
- `/owner/api/platform/overview`
- `/owner/api/platform/tenants?limit=50`
- `/owner/api/platform/subscriptions?limit=50`
- `/owner/api/platform/licenses?limit=50`
- `/owner/api/platform/billing/overview`
- `/owner/api/platform/billing/invoices?limit=50`
- `/owner/api/platform/billing/payment-attempts?limit=50`
- `/owner/api/platform/quota?tenantId=...`
- `/owner/api/control-panel/settings`
- `/owner/api/platform/agents?limit=50`
- `/owner/api/platform/agent-registry?limit=200`
- `/owner/api/platform/agent-provisioning?limit=200`
- `/owner/api/platform/agent-devices?limit=200`
- `/owner/api/platform/agent-credentials?limit=200`
- `/owner/api/auth/sessions`
- `/owner/api/notifications?limit=20`
- `/owner/api/auth/security-events?limit=20`
- `/owner/api/runtime/supervisor`
- `/owner/api/observability/requests?limit=20&onlyErrors=true`
- `/owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000`
- `/admin/api/backup/list`
- `/admin/api/backup/restore/status`
- `/admin/api/backup/restore/history?limit=12`
- `/admin/api/platform/tenant-support-case?tenantId=...`
- `/admin/api/delivery/dead-letter?tenantId=...`
- `/admin/api/live`

### Primary Mutation Endpoints Used By The Owner UI

- `/owner/api/platform/tenant`
- `/owner/api/platform/subscription`
- `/owner/api/platform/subscription/update`
- `/owner/api/platform/package`
- `/owner/api/platform/package/update`
- `/owner/api/platform/package/delete`
- `/owner/api/control-panel/env`
- `/owner/api/auth/user`
- `/owner/api/platform/agent-provision`
- `/owner/api/platform/agent-device/revoke`
- `/owner/api/platform/agent-provision/revoke`
- `/owner/api/platform/agent-token/revoke`
- `/owner/api/runtime/restart-service`
- `/owner/api/auth/session/revoke`
- `/owner/api/notifications/ack`
- `/owner/api/notifications/clear`
- `/owner/api/platform/billing/invoice/update`
- `/owner/api/platform/billing/payment-attempt/update`
- `/owner/api/platform/billing/checkout-session`
- `/admin/api/platform/automation/run`
- `/admin/api/player/identity/review`
- `/admin/api/backup/create`
- `/admin/api/backup/restore`

### Auth Notes

- current owner login UI posts to `/owner/api/login`
- owner/admin auth remains cookie/session based

## Tenant Admin Panel

### Current Entry Points

- login: `/tenant/login`
- shell root: `/tenant`
- common scoped URL pattern: `/tenant?tenantId=<tenantId>#<section>`

### Current Section Aliases In The Browser Shell

Current section keys in `tenant-v4-app.js`:

- `dashboard`
- `onboarding`
- `server-status`
- `server-config`
- `logs-sync`
- `orders`
- `donations`
- `analytics`
- `events`
- `modules`
- `players`
- `staff`
- `roles`
- `settings`
- `billing`
- `delivery-agents`
- `server-bots`
- `restart-control`

Path alias hints currently handled by the shell:

- `/tenant`
- `/tenant/onboarding`
- `/tenant/server`
- `/tenant/config`
- `/tenant/restarts`
- `/tenant/delivery-agents`
- `/tenant/server-bots`
- `/tenant/logs-sync`
- `/tenant/players`
- `/tenant/orders`
- `/tenant/donations`
- `/tenant/analytics`
- `/tenant/events`
- `/tenant/modules`
- `/tenant/staff`
- `/tenant/roles`
- `/tenant/settings`
- `/tenant/billing`

### Primary Read Endpoints Used By The Tenant UI

- `/tenant/api/me`
- `/admin/api/platform/overview?tenantId=...`
- `/admin/api/platform/reconcile?tenantId=...&windowMs=...`
- `/admin/api/platform/quota?tenantId=...`
- `/admin/api/platform/tenant-config?tenantId=...`
- `/admin/api/platform/servers?tenantId=...`
- `/admin/api/platform/subscriptions?tenantId=...`
- `/admin/api/platform/licenses?tenantId=...`
- `/admin/api/platform/apikeys?tenantId=...`
- `/admin/api/platform/webhooks?tenantId=...`
- `/admin/api/platform/agents?tenantId=...`
- `/admin/api/platform/agent-provisioning?tenantId=...`
- `/admin/api/platform/agent-devices?tenantId=...`
- `/admin/api/platform/agent-credentials?tenantId=...`
- `/admin/api/platform/agent-sessions?tenantId=...`
- `/admin/api/dashboard/cards?tenantId=...`
- `/admin/api/shop/list?tenantId=...`
- `/admin/api/donations/overview?tenantId=...`
- `/admin/api/modules/overview?tenantId=...`
- `/admin/api/delivery/queue?tenantId=...`
- `/admin/api/delivery/dead-letter?tenantId=...`
- `/admin/api/delivery/lifecycle?tenantId=...`
- `/admin/api/player/accounts?tenantId=...`
- `/admin/api/platform/tenant-staff?tenantId=...`
- `/admin/api/platform/tenant-role-matrix?tenantId=...`
- `/admin/api/notifications?tenantId=...`
- `/admin/api/delivery/runtime`
- `/admin/api/purchase/statuses`
- `/admin/api/audit/query?tenantId=...`
- `/admin/api/feature-access?tenantId=...`
- `/admin/api/event/list?tenantId=...`
- `/admin/api/raid/list?tenantId=...`
- `/admin/api/platform/servers/:serverId/config?tenantId=...`
- `/admin/api/platform/servers/:serverId/config/jobs?tenantId=...`
- `/admin/api/platform/restart-plans?tenantId=...&serverId=...`
- `/admin/api/platform/restart-executions?tenantId=...&serverId=...`
- `/admin/api/platform/server-discord-links?tenantId=...&serverId=...`
- `/admin/api/platform/sync-runs?tenantId=...&serverId=...`
- `/admin/api/platform/sync-events?tenantId=...&serverId=...`
- `/admin/api/killfeed/list?tenantId=...&serverId=...`
- `/admin/api/platform/billing/overview?tenantId=...`
- `/admin/api/platform/billing/invoices?tenantId=...`
- `/admin/api/platform/billing/payment-attempts?tenantId=...`
- `/admin/api/purchase/list?tenantId=...&userId=...`
- `/admin/api/player/identity?tenantId=...&userId=...`
- `/admin/api/delivery/detail?tenantId=...&code=...`

### Primary Mutation Endpoints Used By The Tenant UI

- `/admin/api/platform/runtime-download/prepare`
- `/admin/api/platform/tenant-config`
- `/admin/api/platform/servers/:serverId/config/apply`
- `/admin/api/platform/servers/:serverId/config/rollback`
- `/admin/api/platform/servers/:serverId/restart`
- `/admin/api/platform/servers/:serverId/control/:action`
- `/admin/api/platform/agent-provision`
- `/admin/api/platform/agent-provision/revoke`
- `/admin/api/platform/agent-device/revoke`
- `/admin/api/platform/agent-runtime/revoke`
- `/admin/api/platform/agent-token/revoke`
- `/admin/api/platform/agent-token/rotate`
- `/admin/api/platform/servers/:serverId/probes/:action`
- `/admin/api/platform/server-discord-link`
- `/admin/api/delivery/dead-letter/retry`
- `/admin/api/delivery/retry`
- `/admin/api/delivery/cancel`
- `/admin/api/event/create`
- `/admin/api/event/update`
- `/admin/api/event/start`
- `/admin/api/event/end`
- `/admin/api/raid/request/review`
- `/admin/api/raid/window/create`
- `/admin/api/raid/summary/create`
- `/admin/api/platform/billing/checkout-session`
- `/admin/api/shop/add`
- `/admin/api/shop/update`
- `/admin/api/shop/delete`
- `/admin/api/shop/status`
- `/admin/api/player/steam/bind`
- `/admin/api/player/steam/unbind`
- `/admin/api/player/identity/review`
- `/admin/api/platform/tenant-staff`
- `/admin/api/platform/tenant-staff/role`
- `/admin/api/platform/tenant-staff/revoke`

### Auth Notes

- current tenant login UI posts to `/tenant/api/auth/login`
- tenant package locks are derived from backend entitlements, not just frontend rules

## Player Portal

### Current Entry Points

- public login page: `/player/login`
- authenticated shell: `/player`
- legacy player shell: `/player/legacy`

### Current Main Sections In The Browser Shell

Current player sections in `player-v4-app.js`:

- `home`
- `stats`
- `leaderboard`
- `shop`
- `orders`
- `delivery`
- `events`
- `donations`
- `profile`
- `support`

### Primary Read Endpoints Used By The Player UI

- `/player/api/me`
- `/player/api/servers`
- `/player/api/feature-access`
- `/player/api/dashboard`
- `/player/api/server/info`
- `/player/api/profile`
- `/player/api/linksteam/me`
- `/player/api/linksteam/history`
- `/player/api/notifications?limit=10`
- `/player/api/party`
- `/player/api/wallet/ledger?limit=20`
- `/player/api/shop/list?limit=80`
- `/player/api/cart`
- `/player/api/purchase/list?limit=25&includeHistory=1`
- `/player/api/redeem/history?limit=20`
- `/player/api/stats/me`
- `/player/api/leaderboard?type=kills&limit=20`
- `/player/api/missions`
- `/player/api/bounty/list?limit=10`
- `/player/api/wheel/state?limit=10`
- `/player/api/raids`
- `/player/api/killfeed?limit=20`
- `/player/api/supporters?limit=10`
- `/player/api/support/tickets?limit=10`

### Primary Mutation Endpoints Used By The Player UI

- `/player/api/session/server`
- `/player/api/cart/add`
- `/player/api/cart/remove`
- `/player/api/cart/clear`
- `/player/api/cart/checkout`
- `/player/api/daily/claim`
- `/player/api/weekly/claim`
- `/player/api/profile/email-verification/request`
- `/player/api/linksteam/unset`
- `/player/api/support/tickets`
- `/player/api/support/tickets/close`
- `/player/api/redeem`
- `/player/api/linksteam/set`
- `/player/api/raids/request`

### Auth Notes

- player email magic-link flow uses:
  - `/player/api/auth/email/request`
  - `/player/api/auth/email/complete`
- player portal auth remains cookie/session based

## Public And Auth Pages

### Current Public/Auth Routes

Canonical public routes currently served by the standalone portal runtime:

- `/landing`
- `/pricing`
- `/status`
- `/changes`
- `/signup`
- `/login`
- `/forgot-password`
- `/verify-email`
- `/checkout`
- `/payment-result`
- `/preview`
- `/trial`
- `/showcase` currently redirects to `/pricing`
- `/` currently redirects to `/landing`

Public per-server pages:

- `/s/:slug`
- `/s/:slug/stats`
- `/s/:slug/shop`
- `/s/:slug/events`
- `/s/:slug/donate`

### Primary Public/Auth API Endpoints Used By The UI

- `/api/public/packages`
- `/api/public/signup`
- `/api/public/product-links`
- `/api/public/password-reset-request`
- `/api/public/password-reset-complete`
- `/api/public/email-verification-request`
- `/api/public/email-verification-complete`
- `/api/public/session`
- `/api/public/checkout/session`
- `/api/public/checkout/session/resolve`
- `/api/public/checkout/complete`
- `/api/public/logout`
- `/api/public/servers/:slug/overview`
- `/api/platform/public/overview`

## Runtime Separation That Must Stay Visible In UI

The UI must continue to present these as separate concepts:

- Delivery Agent
  - delivery execution
  - in-game actions
  - game-client-side runtime
- Server Bot
  - SCUM.log sync
  - server control and config operations
  - server-side runtime

Ground-truth constraint files:

- `../../src/contracts/agent/agentContracts.js`
- `../../src/domain/delivery/agentExecutionRoutingService.js`
- `../../src/services/platformAgentRuntimeService.js`
