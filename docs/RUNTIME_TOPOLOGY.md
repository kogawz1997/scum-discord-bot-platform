# Runtime Topology

This document describes the runtime split that the repository currently supports and the files that own each boundary.

## Active Runtime Roles

| Role          | Entry                                                                           | Main responsibility                                                                 | Health                     |
| ------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| Bot           | [apps/discord-bot/server.js](../apps/discord-bot/server.js)                     | Discord gateway, command dispatch, optional admin web mount, optional webhook mount | `BOT_HEALTH_PORT`          |
| Worker        | [apps/worker/server.js](../apps/worker/server.js)                               | Delivery worker, rent bike queue, worker heartbeat                                  | `WORKER_HEALTH_PORT`       |
| Watcher       | [apps/watcher/server.js](../apps/watcher/server.js)                             | SCUM log tailing plus sync forwarding to control plane                              | `SCUM_WATCHER_HEALTH_PORT` |
| Admin Web     | [apps/admin-web/server.js](../apps/admin-web/server.js)                         | Admin auth, config, audit, observability, backup/restore                            | `ADMIN_WEB_PORT`           |
| Player Portal | [apps/web-portal-standalone/server.js](../apps/web-portal-standalone/server.js) | Player login, wallet, shop, profile, redeem                                         | `WEB_PORTAL_PORT`          |
| Console Agent | [apps/agent/server.js](../apps/agent/server.js)                                 | Agent-side command execution bridge                                                 | `SCUM_CONSOLE_AGENT_PORT`  |
| API shim      | [apps/api/server.js](../apps/api/server.js)                                     | Compatibility bootstrap for the centralized control-plane HTTP surface              | `ADMIN_WEB_PORT`           |

## Startup Boundaries

- Staged runtime wrappers now live under [apps/](../apps/).
- Bot bootstrap helpers live under [src/bootstrap/](../src/bootstrap/).
- Runtime flag parsing lives under [src/config/](../src/config/).
- Shared env assertions remain in [src/utils/env.js](../src/utils/env.js).
- Runtime supervisor logic lives in [src/services/runtimeSupervisorService.js](../src/services/runtimeSupervisorService.js).
- Agent contracts and scope normalization live under [src/contracts/agent/](../src/contracts/agent/).
- Centralized control-plane registry/domain boundaries live under:
  - [src/data/repositories/controlPlaneRegistryRepository.js](../src/data/repositories/controlPlaneRegistryRepository.js)
  - [src/domain/servers/](../src/domain/servers/)
  - [src/domain/agents/](../src/domain/agents/)
  - [src/domain/sync/](../src/domain/sync/)
  - [src/domain/delivery/](../src/domain/delivery/)
- SCUM-specific adapters/parsers now live under [src/integrations/scum/](../src/integrations/scum/).

## Control Plane Routes

The centralized HTTP layer now terminates agent traffic instead of allowing Discord/web to talk to game-side machines directly.

- `POST /platform/api/v1/agent/register`
  - used after activation
  - scoped registration
  - binds agent identity to tenant/server/guild/runtime context
- `POST /platform/api/v1/agent/activate`
  - one-time setup token activation
  - binds a machine fingerprint to one agent device
  - issues the long-lived scoped credential used after install
- `POST /platform/api/v1/agent/session`
  - heartbeat/session refresh
  - updates online/offline freshness
- `POST /platform/api/v1/agent/sync`
  - read/sync path only
  - validates payload, normalizes, persists sync runs/events, and updates projections

Admin-side control-plane routes now also expose:

- `POST /admin/api/platform/server`
- `POST /admin/api/platform/server-discord-link`
- `POST /admin/api/platform/agent-provision`
- `POST /admin/api/platform/agent-token`
- `POST /admin/api/platform/agent-token/revoke`
- `POST /admin/api/platform/agent-token/rotate`
- `GET /admin/api/platform/packages`
- `GET /admin/api/platform/features`
- `GET /admin/api/platform/tenant-feature-access`
- `GET /admin/api/platform/servers`
- `GET /admin/api/platform/server-discord-links`
- `GET /admin/api/platform/agent-registry`
- `GET /admin/api/platform/agent-provisioning`
- `GET /admin/api/platform/agent-devices`
- `GET /admin/api/platform/agent-credentials`
- `GET /admin/api/platform/agent-sessions`
- `GET /admin/api/platform/sync-runs`
- `GET /admin/api/platform/sync-events`

## Supported Topologies

### Split runtime

- `bot`: Discord-facing runtime only
- `worker`: delivery and queue ownership
- `watcher`: optional
- `console-agent`: optional
- `admin web` and `player portal`: separate HTTP surfaces

This is the target production topology.

### Two-machine agent split

- `Machine A`
  - `bot`
  - `admin web`
  - `worker`
  - `player portal`
  - PostgreSQL
- `Machine B`
  - `watcher`
  - `console-agent`
  - SCUM client

Use this when the control plane should stay separate from the Windows / SCUM execution node.

### Reduced local topology

- `bot` only, with selected background services enabled
- `watcher` disabled
- `console-agent` optional or disabled

This exists for local development and targeted verification.

## Current Constraints

- Delivery can run in `rcon` or `agent` mode, but agent mode still depends on a live SCUM window and Windows session.
- Read/sync and write/execute are now split by role and scope, but a `hybrid` agent identity remains supported as a compatibility bridge.
- Agent provisioning now uses a one-time setup token plus device binding before the long-lived credential is issued.
- Tenant-aware application paths are topology-ready through selected schema/database-per-tenant routing plus PostgreSQL RLS strict mode; this workstation now boots with `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` and default tenant `1259096998045421672`.
- Watcher health is allowed to report `disabled` when the runtime is intentionally turned off.
- Runtime state should not be tracked inside the repository in production or DB-only mode; persistence now defaults to external OS-managed state paths unless explicitly overridden.
- Owner/admin runtime views now expose `sync`, `execute`, and `hybrid` agent role/scope hints so operator responsibility is visible from the control plane.

See [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md) for the package catalog, feature gating model, setup-token activation, and device-binding flow.

## Review Checklist

- Bot and worker must not own the same queue service at the same time.
- Admin and player web surfaces must keep separate cookie scope and canonical origins.
- Required runtimes must report `ready`, not just HTTP `200`.
- Production should use PostgreSQL, not SQLite, for the live runtime database.
