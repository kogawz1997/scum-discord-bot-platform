# Config Matrix

Last updated: **2026-03-27**

This document is the operator-facing matrix for core configuration. It is not a complete dump of every env key. For the full list, see [ENV_REFERENCE_TH.md](./ENV_REFERENCE_TH.md).

## Categories

- `Required`: must exist for the role to boot correctly
- `Optional`: feature-dependent or deployment-dependent
- `Production-only`: should be set or hardened before production use
- `UI scope`:
  - `runtime`: editable from admin web without restart
  - `restart`: editable from admin web but restart is required
  - `env-only`: must be changed in env/file
  - `no-ui`: should not be exposed in admin web

## Shared Runtime

| Key                        | Required | Production-only | Used by | UI scope | Notes                                                              |
| -------------------------- | -------- | --------------- | ------- | -------- | ------------------------------------------------------------------ |
| `NODE_ENV`                 | Yes      | Yes             | all     | env-only | `production` for live deployments                                  |
| `DATABASE_PROVIDER`        | Yes      | Yes             | all     | env-only | runtime standard is `postgresql`                                   |
| `DATABASE_URL`             | Yes      | Yes             | all     | no-ui    | secret-bearing; do not expose raw value in UI                      |
| `TENANT_DB_ISOLATION_MODE` | Optional | Yes             | all     | env-only | `application`, `postgres-rls-foundation`, or `postgres-rls-strict` |
| `TENANT_DB_TOPOLOGY_MODE`  | Optional | Yes             | all     | env-only | `shared`, `schema-per-tenant`, or `database-per-tenant`            |
| `PERSIST_REQUIRE_DB`       | Yes      | Yes             | all     | restart  | should stay `true` in production                                   |
| `PERSIST_LEGACY_SNAPSHOTS` | Yes      | Yes             | all     | restart  | should stay `false` in production                                  |
| `BOT_DATA_DIR`             | Optional | Yes             | all     | env-only | production and DB-only mode should prefer external OS-managed path |

## Discord Bot

| Key                            | Required | Production-only | Used by | UI scope | Notes                                                                                       |
| ------------------------------ | -------- | --------------- | ------- | -------- | ------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`                | Yes      | Yes             | bot     | no-ui    | secret                                                                                      |
| `BOT_ENABLE_ADMIN_WEB`         | Optional | No              | bot     | restart  | controls admin web bootstrap                                                                |
| `BOT_ENABLE_SCUM_WEBHOOK`      | Optional | No              | bot     | restart  | controls webhook receiver                                                                   |
| `BOT_ENABLE_RESTART_SCHEDULER` | Optional | No              | bot     | runtime  | runtime feature flag                                                                        |
| `BOT_ENABLE_RENTBIKE_SERVICE`  | Optional | No              | bot     | restart  | should stay off in split runtime                                                            |
| `BOT_ENABLE_DELIVERY_WORKER`   | Optional | No              | bot     | restart  | should stay off in split runtime; must not be `true` together with `WORKER_ENABLE_DELIVERY` |
| `BOT_HEALTH_HOST`              | Optional | Yes             | bot     | env-only | health bind address                                                                         |
| `BOT_HEALTH_PORT`              | Optional | Yes             | bot     | env-only | health bind port                                                                            |

## Worker

| Key                      | Required | Production-only | Used by | UI scope | Notes                                                                                             |
| ------------------------ | -------- | --------------- | ------- | -------- | ------------------------------------------------------------------------------------------------- |
| `WORKER_ENABLE_DELIVERY` | Optional | No              | worker  | restart  | should be on for split worker role; must not be `true` together with `BOT_ENABLE_DELIVERY_WORKER` |
| `WORKER_ENABLE_RENTBIKE` | Optional | No              | worker  | restart  | feature-dependent                                                                                 |
| `WORKER_HEALTH_HOST`     | Optional | Yes             | worker  | env-only | health bind address                                                                               |
| `WORKER_HEALTH_PORT`     | Optional | Yes             | worker  | env-only | health bind port                                                                                  |
| `WORKER_HEARTBEAT_MS`    | Optional | No              | worker  | restart  | heartbeat interval                                                                                |

## Watcher

| Key                        | Required | Production-only | Used by | UI scope | Notes                                              |
| -------------------------- | -------- | --------------- | ------- | -------- | -------------------------------------------------- |
| `SCUM_LOG_PATH`            | Optional | Yes             | watcher | env-only | real log path required if watcher is enabled       |
| `SCUM_WATCHER_ENABLED`     | Optional | No              | watcher | restart  | can disable watcher cleanly                        |
| `SCUM_WATCHER_REQUIRED`    | Optional | No              | watcher | restart  | controls whether degraded watcher fails validation |
| `SCUM_WATCHER_HEALTH_HOST` | Optional | Yes             | watcher | env-only | health bind address                                |
| `SCUM_WATCHER_HEALTH_PORT` | Optional | Yes             | watcher | env-only | health bind port                                   |

## Delivery / RCON / Agent

| Key                                | Required | Production-only | Used by         | UI scope | Notes                                                                                                            |
| ---------------------------------- | -------- | --------------- | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `DELIVERY_EXECUTION_MODE`          | Yes      | No              | bot, worker     | restart  | `rcon` or `agent`                                                                                                |
| `DELIVERY_NATIVE_PROOF_MODE`       | Optional | No              | delivery        | restart  | `disabled`, `optional`, or `required`                                                                            |
| `DELIVERY_NATIVE_PROOF_SCRIPT`     | Optional | Yes             | delivery        | restart  | external inventory/state proof script path; `scripts/delivery-native-proof-template.ps1` is the bundled template |
| `RCON_HOST`                        | Optional | Yes             | delivery        | env-only | required for RCON path                                                                                           |
| `RCON_PORT`                        | Optional | Yes             | delivery        | env-only | required for RCON path                                                                                           |
| `RCON_PASSWORD`                    | Optional | Yes             | delivery        | no-ui    | secret                                                                                                           |
| `SCUM_CONSOLE_AGENT_BASE_URL`      | Optional | Yes             | delivery, agent | env-only | required for remote agent path                                                                                   |
| `SCUM_CONSOLE_AGENT_TOKEN`         | Optional | Yes             | delivery, agent | no-ui    | secret                                                                                                           |
| `SCUM_CONSOLE_AGENT_REQUIRED`      | Optional | No              | delivery        | restart  | allows optional degraded agent with fallback                                                                     |
| `SCUM_CONSOLE_AGENT_EXEC_TEMPLATE` | Optional | Yes             | agent           | env-only | required for exec backend                                                                                        |

## Sync Agent / Control Plane Routing

| Key                           | Required | Production-only | Used by | UI scope | Notes                                                                                          |
| ----------------------------- | -------- | --------------- | ------- | -------- | ---------------------------------------------------------------------------------------------- |
| `SCUM_SYNC_TRANSPORT`         | Optional | No              | watcher | restart  | `webhook`, `control-plane`, or `dual`; use `control-plane` or `dual` for scoped sync ingestion |
| `SCUM_SYNC_CONTROL_PLANE_URL` | Optional | Yes             | watcher | env-only | canonical control-plane origin for sync payload posts                                          |
| `SCUM_SYNC_AGENT_TOKEN`       | Optional | Yes             | watcher | no-ui    | scoped agent token for read/sync path                                                          |
| `SCUM_TENANT_ID`              | Optional | Yes             | watcher | env-only | explicit tenant scope for sync payloads                                                        |
| `SCUM_SERVER_ID`              | Optional | Yes             | watcher | env-only | explicit server scope for sync payloads                                                        |
| `SCUM_SYNC_AGENT_ID`          | Optional | Yes             | watcher | env-only | stable agent identity for sync path                                                            |
| `SCUM_SYNC_RUNTIME_KEY`       | Optional | Yes             | watcher | env-only | runtime identity associated with the sync agent                                                |
| `SCUM_SYNC_AGENT_VERSION`     | Optional | No              | watcher | env-only | agent version reported to control plane                                                        |
| `SCUM_AGENT_CHANNEL`          | Optional | No              | watcher | env-only | optional channel or workstation label                                                          |
| `PLATFORM_API_BASE_URL`       | Optional | Yes             | agent   | env-only | fallback control-plane base URL for staged agent clients                                       |
| `PLATFORM_AGENT_TOKEN`        | Optional | Yes             | agent   | no-ui    | fallback scoped agent token for staged agent clients                                           |

Operator rule:

- use separate tokens for sync/read and execute/write when possible
- `hybrid` remains supported as a compatibility bridge, not the preferred long-term posture
- Discord/web/admin must still route through the control plane; these keys are for game-side agents only
- initial provisioning should use a one-time setup token plus bootstrap payload from owner control, then switch to the long-lived scoped credential issued during activation

## Package / Feature Access

The managed-service surface now resolves access by feature rather than by raw package name alone.

Current package ids:

- `BOT_LOG`
- `BOT_LOG_DELIVERY`
- `FULL_OPTION`
- `SERVER_ONLY`

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

Practical operator rule:

- package implies the default feature set
- tenant feature overrides can enable or disable specific features without changing the underlying plan id
- read access is exposed through the control plane, not by direct runtime probing

## Admin Web

| Key                                   | Required | Production-only | Used by   | UI scope | Notes                                    |
| ------------------------------------- | -------- | --------------- | --------- | -------- | ---------------------------------------- |
| `ADMIN_WEB_PORT`                      | Yes      | Yes             | admin web | env-only | bind port                                |
| `ADMIN_WEB_HOST`                      | Optional | Yes             | admin web | env-only | bind host                                |
| `ADMIN_WEB_PASSWORD`                  | Yes      | Yes             | admin web | no-ui    | bootstrap/admin recovery path            |
| `ADMIN_WEB_TOKEN`                     | Yes      | Yes             | admin web | no-ui    | secret                                   |
| `ADMIN_WEB_2FA_ENABLED`               | Yes      | Yes             | admin web | restart  | should be `true` in production           |
| `ADMIN_WEB_2FA_SECRET`                | Yes      | Yes             | admin web | no-ui    | secret                                   |
| `ADMIN_WEB_STEP_UP_ENABLED`           | Yes      | Yes             | admin web | restart  | should be `true` in production           |
| `ADMIN_WEB_SSO_DISCORD_ENABLED`       | Optional | No              | admin web | restart  | SSO feature flag                         |
| `ADMIN_WEB_SSO_DISCORD_CLIENT_ID`     | Optional | Yes             | admin web | restart  | OAuth client id                          |
| `ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET` | Optional | Yes             | admin web | no-ui    | secret                                   |
| `ADMIN_WEB_SSO_DISCORD_GUILD_ID`      | Optional | Yes             | admin web | restart  | guild scope for SSO                      |
| `ADMIN_WEB_SECURE_COOKIE`             | Yes      | Yes             | admin web | restart  | should be `true` in production           |
| `ADMIN_WEB_ENFORCE_ORIGIN_CHECK`      | Yes      | Yes             | admin web | restart  | should be `true` in production           |
| `ADMIN_WEB_ALLOWED_ORIGINS`           | Optional | Yes             | admin web | restart  | comma-separated allowlist                |
| `ADMIN_LOG_LANGUAGE`                  | Optional | No              | admin web | runtime  | owner-facing Discord ops alerts language |

## Player Portal

| Key                                | Required | Production-only | Used by | UI scope | Notes                          |
| ---------------------------------- | -------- | --------------- | ------- | -------- | ------------------------------ |
| `WEB_PORTAL_PORT`                  | Yes      | Yes             | web     | env-only | bind port                      |
| `WEB_PORTAL_HOST`                  | Optional | Yes             | web     | env-only | bind host                      |
| `WEB_PORTAL_BASE_URL`              | Yes      | Yes             | web     | restart  | canonical public URL           |
| `WEB_PORTAL_DISCORD_CLIENT_ID`     | Optional | Yes             | web     | no-ui    | OAuth                          |
| `WEB_PORTAL_DISCORD_CLIENT_SECRET` | Optional | Yes             | web     | no-ui    | secret                         |
| `WEB_PORTAL_DISCORD_GUILD_ID`      | Optional | Yes             | web     | restart  | guild membership enforcement   |
| `WEB_PORTAL_SECURE_COOKIE`         | Yes      | Yes             | web     | restart  | should be `true` in production |
| `WEB_PORTAL_ENFORCE_ORIGIN_CHECK`  | Yes      | Yes             | web     | restart  | should be `true` in production |
| `WEB_PORTAL_COOKIE_SAMESITE`       | Optional | Yes             | web     | restart  | cookie isolation policy        |

## Current Admin UI Coverage

Current state:

- some runtime, bot, delivery, sync-routing, and feature settings are editable through admin UI
- some env-backed settings can be edited but still require restart
- admin env metadata now covers runtime identity and bind settings, persistence flags, bot and watcher health settings, SSO role mapping, login/rate-limit settings, cookie/origin policy, sync/control-plane routing keys, agent tuning, tenant DB topology settings, native delivery proof settings, and portal OAuth/map settings
- the control-panel catalog now exposes grouped sections, field labels, select options for the highest-value mode switches, and numeric bounds for ports and timing/threshold keys
- grouped catalog and grouped live-value payloads are now available from the admin settings API so the owner surface can render structured config workspaces instead of one flat key list
- owner control now also covers `ADMIN_LOG_LANGUAGE` for the Discord `#admin-log` workflow
- secrets and low-level bind/topology settings remain env-only by design

Use this rule for review:

- if a key changes process bootstrap, origin, bind, secret, or database wiring, treat it as `env-only` or `restart`
- if a key changes feature behavior but not bootstrap, it may be suitable for runtime UI control

## Role Mapping By Runtime

| Runtime       | Required keys                                                            | Optional keys                                         |
| ------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| bot           | `NODE_ENV`, `DATABASE_PROVIDER`, `DATABASE_URL`, `DISCORD_TOKEN`         | webhook/admin/restart feature flags                   |
| worker        | `NODE_ENV`, `DATABASE_PROVIDER`, `DATABASE_URL`                          | delivery/rentbike worker flags                        |
| watcher       | `NODE_ENV`, `DATABASE_PROVIDER`, `DATABASE_URL` if persistence is needed | `SCUM_LOG_PATH`, watcher flags, sync transport config |
| console-agent | `SCUM_CONSOLE_AGENT_TOKEN` and backend-specific config                   | bind host/port, exec template, process backend config |
| sync agent    | scoped token plus control-plane URL and tenant/server/agent identity     | version/channel labels                                |
| player portal | `WEB_PORTAL_BASE_URL`, OAuth config, DB config                           | cookie/origin hardening options                       |

## Related Documents

- [ENV_REFERENCE_TH.md](./ENV_REFERENCE_TH.md)
- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
