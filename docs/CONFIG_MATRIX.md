# Config Matrix

Last updated: **2026-03-16**

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

## Discord Bot

| Key                            | Required | Production-only | Used by | UI scope | Notes                            |
| ------------------------------ | -------- | --------------- | ------- | -------- | -------------------------------- |
| `DISCORD_TOKEN`                | Yes      | Yes             | bot     | no-ui    | secret                           |
| `BOT_ENABLE_ADMIN_WEB`         | Optional | No              | bot     | restart  | controls admin web bootstrap     |
| `BOT_ENABLE_SCUM_WEBHOOK`      | Optional | No              | bot     | restart  | controls webhook receiver        |
| `BOT_ENABLE_RESTART_SCHEDULER` | Optional | No              | bot     | runtime  | runtime feature flag             |
| `BOT_ENABLE_RENTBIKE_SERVICE`  | Optional | No              | bot     | restart  | should stay off in split runtime |
| `BOT_ENABLE_DELIVERY_WORKER`   | Optional | No              | bot     | restart  | should stay off in split runtime |
| `BOT_HEALTH_HOST`              | Optional | Yes             | bot     | env-only | health bind address              |
| `BOT_HEALTH_PORT`              | Optional | Yes             | bot     | env-only | health bind port                 |

## Worker

| Key                      | Required | Production-only | Used by | UI scope | Notes                              |
| ------------------------ | -------- | --------------- | ------- | -------- | ---------------------------------- |
| `WORKER_ENABLE_DELIVERY` | Optional | No              | worker  | restart  | should be on for split worker role |
| `WORKER_ENABLE_RENTBIKE` | Optional | No              | worker  | restart  | feature-dependent                  |
| `WORKER_HEALTH_HOST`     | Optional | Yes             | worker  | env-only | health bind address                |
| `WORKER_HEALTH_PORT`     | Optional | Yes             | worker  | env-only | health bind port                   |
| `WORKER_HEARTBEAT_MS`    | Optional | No              | worker  | restart  | heartbeat interval                 |

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

## Admin Web

| Key                                   | Required | Production-only | Used by   | UI scope | Notes                          |
| ------------------------------------- | -------- | --------------- | --------- | -------- | ------------------------------ |
| `ADMIN_WEB_PORT`                      | Yes      | Yes             | admin web | env-only | bind port                      |
| `ADMIN_WEB_HOST`                      | Optional | Yes             | admin web | env-only | bind host                      |
| `ADMIN_WEB_PASSWORD`                  | Yes      | Yes             | admin web | no-ui    | bootstrap/admin recovery path  |
| `ADMIN_WEB_TOKEN`                     | Yes      | Yes             | admin web | no-ui    | secret                         |
| `ADMIN_WEB_2FA_ENABLED`               | Yes      | Yes             | admin web | restart  | should be `true` in production |
| `ADMIN_WEB_2FA_SECRET`                | Yes      | Yes             | admin web | no-ui    | secret                         |
| `ADMIN_WEB_STEP_UP_ENABLED`           | Yes      | Yes             | admin web | restart  | should be `true` in production |
| `ADMIN_WEB_SSO_DISCORD_ENABLED`       | Optional | No              | admin web | restart  | SSO feature flag               |
| `ADMIN_WEB_SSO_DISCORD_CLIENT_ID`     | Optional | Yes             | admin web | restart  | OAuth client id                |
| `ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET` | Optional | Yes             | admin web | no-ui    | secret                         |
| `ADMIN_WEB_SSO_DISCORD_GUILD_ID`      | Optional | Yes             | admin web | restart  | guild scope for SSO            |
| `ADMIN_WEB_SECURE_COOKIE`             | Yes      | Yes             | admin web | restart  | should be `true` in production |
| `ADMIN_WEB_ENFORCE_ORIGIN_CHECK`      | Yes      | Yes             | admin web | restart  | should be `true` in production |
| `ADMIN_WEB_ALLOWED_ORIGINS`           | Optional | Yes             | admin web | restart  | comma-separated allowlist      |

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

- some runtime, bot, delivery, and feature settings are editable through admin UI
- some env-backed settings can be edited but still require restart
- admin env metadata now covers SSO role mapping, login/rate-limit settings, cookie/origin policy, persistence flags, watcher health settings, agent tuning, tenant DB topology settings, native delivery proof settings, and portal OAuth/map settings
- secrets and low-level bind/topology settings remain env-only by design

Use this rule for review:

- if a key changes process bootstrap, origin, bind, secret, or database wiring, treat it as `env-only` or `restart`
- if a key changes feature behavior but not bootstrap, it may be suitable for runtime UI control

## Role Mapping By Runtime

| Runtime       | Required keys                                                            | Optional keys                                         |
| ------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| bot           | `NODE_ENV`, `DATABASE_PROVIDER`, `DATABASE_URL`, `DISCORD_TOKEN`         | webhook/admin/restart feature flags                   |
| worker        | `NODE_ENV`, `DATABASE_PROVIDER`, `DATABASE_URL`                          | delivery/rentbike worker flags                        |
| watcher       | `NODE_ENV`, `DATABASE_PROVIDER`, `DATABASE_URL` if persistence is needed | `SCUM_LOG_PATH`, watcher flags                        |
| console-agent | `SCUM_CONSOLE_AGENT_TOKEN` and backend-specific config                   | bind host/port, exec template, process backend config |
| player portal | `WEB_PORTAL_BASE_URL`, OAuth config, DB config                           | cookie/origin hardening options                       |

## Related Documents

- [ENV_REFERENCE_TH.md](./ENV_REFERENCE_TH.md)
- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
