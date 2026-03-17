# Runtime Topology

This document describes the runtime split that the repository currently supports and the files that own each boundary.

## Active Runtime Roles

| Role          | Entry                                                                             | Main responsibility                                                                 | Health                     |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------- |
| Bot           | [src/bot.js](../src/bot.js)                                                       | Discord gateway, command dispatch, optional admin web mount, optional webhook mount | `BOT_HEALTH_PORT`          |
| Worker        | [src/worker.js](../src/worker.js)                                                 | Delivery worker, rent bike queue, worker heartbeat                                  | `WORKER_HEALTH_PORT`       |
| Watcher       | [src/services/scumLogWatcherRuntime.js](../src/services/scumLogWatcherRuntime.js) | SCUM log tailing and webhook forwarding                                             | `SCUM_WATCHER_HEALTH_PORT` |
| Admin Web     | [src/adminWebServer.js](../src/adminWebServer.js)                                 | Admin auth, config, audit, observability, backup/restore                            | `ADMIN_WEB_PORT`           |
| Player Portal | [apps/web-portal-standalone/server.js](../apps/web-portal-standalone/server.js)   | Player login, wallet, shop, profile, redeem                                         | `WEB_PORTAL_PORT`          |
| Console Agent | [src/scum-console-agent.js](../src/scum-console-agent.js)                         | Agent-side command execution bridge                                                 | `SCUM_CONSOLE_AGENT_PORT`  |

## Startup Boundaries

- Bot bootstrap helpers live under [src/bootstrap/](../src/bootstrap/).
- Runtime flag parsing lives under [src/config/](../src/config/).
- Shared env assertions remain in [src/utils/env.js](../src/utils/env.js).
- Runtime supervisor logic lives in [src/services/runtimeSupervisorService.js](../src/services/runtimeSupervisorService.js).

## Supported Topologies

### Split runtime

- `bot`: Discord-facing runtime only
- `worker`: delivery and queue ownership
- `watcher`: optional
- `console-agent`: optional
- `admin web` and `player portal`: separate HTTP surfaces

This is the target production topology.

### Reduced local topology

- `bot` only, with selected background services enabled
- `watcher` disabled
- `console-agent` optional or disabled

This exists for local development and targeted verification.

## Current Constraints

- Delivery can run in `rcon` or `agent` mode, but agent mode still depends on a live SCUM window and Windows session.
- Tenant isolation is enforced through application/config scope plus PostgreSQL RLS strict mode on the current tenant-scoped platform tables; it is still not database-per-tenant isolation.
- Watcher health is allowed to report `disabled` when the runtime is intentionally turned off.

## Review Checklist

- Bot and worker must not own the same queue service at the same time.
- Admin and player web surfaces must keep separate cookie scope and canonical origins.
- Required runtimes must report `ready`, not just HTTP `200`.
- Production should use PostgreSQL, not SQLite, for the live runtime database.
