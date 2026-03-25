# Platform Package and Agent Model

Last updated: **2026-03-25**

This document describes the current managed-service model implemented in the repository for package gating and agent provisioning.

## Package Catalog

The repository now resolves feature access by package rather than assuming one hard-coded product tier.

Current package ids:

- `BOT_LOG`
- `BOT_LOG_DELIVERY`
- `FULL_OPTION`
- `SERVER_ONLY`

Feature access is resolved through `src/domain/billing/packageCatalogService.js` using:

- subscription plan id
- subscription metadata
- tenant feature overrides from `platform_tenant_configs`

Current feature keys:

- `server_hosting`
- `server_settings`
- `server_status`
- `bot_log`
- `bot_delivery`
- `discord_integration`
- `log_dashboard`
- `delivery_dashboard`
- `shop_module`
- `orders_module`
- `player_module`
- `sync_agent`
- `execute_agent`

## Plan Mapping

The current in-repo mapping is:

- `trial-14d` -> `BOT_LOG_DELIVERY`
- `platform-starter` -> `BOT_LOG_DELIVERY`
- `platform-growth` -> `FULL_OPTION`

This mapping is additive and compatibility-safe. It does not remove existing plan ids or break current subscription rows.

## Effective Feature Resolution

Effective tenant feature access is calculated from:

1. the package implied by the active plan or explicit subscription metadata
2. tenant feature overrides stored in `platform_tenant_configs.featureFlags`

Current read endpoints:

- `GET /admin/api/platform/packages`
- `GET /admin/api/platform/features`
- `GET /admin/api/platform/tenant-feature-access?tenantId=...`
- `GET /platform/api/v1/features/self`

Current overview responses also expose package and feature catalog summaries through:

- `GET /admin/api/platform/overview`
- `GET /platform/api/v1/public/overview`

## Agent Roles

The control plane now distinguishes:

- `sync`
  - read-only log/state ingestion
- `execute`
  - write/execute delivery and command jobs
- `hybrid`
  - compatibility bridge when one deployed agent performs both paths

Scopes remain explicit:

- `sync_only`
- `execute_only`
- `sync_execute`

The repository keeps read/sync and write/execute responsibilities separate in contracts and routing even when `hybrid` is still allowed.

## Agent Provisioning Flow

The owner-facing provisioning flow is now:

1. Owner creates a provisioning token from admin web
2. Control plane stores only the hashed token
3. Owner receives a one-time bootstrap payload
4. Agent starts with:
   - `setupToken`
   - `tenantId`
   - `serverId`
   - `guildId`
   - `agentId`
   - `agentType`
   - `role`
   - `scope`
   - `runtimeKey`
5. Agent activates against the control plane
6. Device is bound to one machine fingerprint
7. Control plane issues a long-lived scoped credential
8. Registration/session/heartbeat/sync use the long-lived credential

Current write endpoints:

- `POST /admin/api/platform/agent-provision`
- `POST /platform/api/v1/agent/activate`
- `POST /platform/api/v1/agent/register`
- `POST /platform/api/v1/agent/session`
- `POST /platform/api/v1/agent/heartbeat`
- `POST /platform/api/v1/agent/sync`

Current read endpoints:

- `GET /admin/api/platform/agent-registry`
- `GET /admin/api/platform/agent-provisioning`
- `GET /admin/api/platform/agent-devices`
- `GET /admin/api/platform/agent-credentials`
- `GET /admin/api/platform/agent-sessions`
- `GET /admin/api/platform/sync-runs`
- `GET /admin/api/platform/sync-events`

## Device Binding

Activation now records:

- provisioning token status
- bound device id
- machine fingerprint hash
- issued credential id
- last seen timestamps

The strongest safe version implemented in this repository is:

- one-time setup token
- hashed token at rest
- one-device binding during activation
- long-lived scoped credential issued after activation
- explicit credential/device/session registry on the control plane

## Security Notes

- UI surfaces still do not talk directly to the game-side machine
- Discord/web/admin all route through control-plane logic
- tokens are hashed at rest
- credentials are scoped to tenant/server/guild/agent/role/scope
- revocation and rotation still use the existing platform API key path

## Current Limitation

The repository now supports activation, device binding, and scoped control-plane registration, but it does **not** claim to eliminate the runtime dependency of the execute path on:

- a live Windows session
- a live SCUM client

That limitation remains real and is documented in runtime topology and product-ready backlog documents.
