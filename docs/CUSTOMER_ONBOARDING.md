# Customer Onboarding

Last updated: **2026-04-02**

This document is for production deployment and customer handoff. It describes the supported topology, prerequisites, validation steps, and operational limits that should be stated clearly.

## Deployment Topology

Current example split-origin deployment:

- Player portal: `https://player.genz.noah-dns.online`
- Admin portal: `https://admin.genz.noah-dns.online/admin`

Runtime roles:

- `owner-web`: platform owner surface
- `tenant-web`: tenant admin surface
- `admin-web`: shared admin/control-plane HTTP surface
- `bot`: Discord gateway, command handling, SCUM webhook receiver
- `worker`: delivery queue and rent-bike runtime
- `watcher`: reads `SCUM.log` and posts events into `/scum-event`
- `server-bot`: server-side runtime for log sync, config, backup, and restart/start/stop
- `delivery-agent`: runtime on a machine with the SCUM client open for delivery and in-game execution
- `web`: standalone player portal

Recommended split:

- `Machine A`: owner-web, tenant-web, admin-web, bot, worker, player portal, PostgreSQL
- `Machine B`: Server Bot on the server-side machine with real config/log access
- `Machine C`: Delivery Agent on the SCUM client workstation when in-game execution is required

For the short operator-friendly explanation of these boundaries, see [RUNTIME_BOUNDARY_EXPLAINER.md](./RUNTIME_BOUNDARY_EXPLAINER.md).

## Customer Deliverables

- Discord bot for economy, shop, reward, moderation, and community operations
- Owner and Tenant web surfaces for package awareness, onboarding, runtime management, config, audit, notifications, and support workflows
- Player portal for wallet, shop, order history, delivery status, profile, and linked-account flows
- Worker runtime for queue processing
- Optional watcher runtime for `SCUM.log`
- Server Bot runtime for server-side sync/config/restart
- Optional Delivery Agent runtime for in-game delivery execution

## Prerequisites

1. Node.js 20+
2. npm
3. PostgreSQL for production
4. A real Discord application and bot token
5. If `Delivery Agent` execution is required:
   - an unlocked Windows session
   - a running SCUM client logged in with the required admin context
6. If `Server Bot` will manage server config/restart:
   - access to the real `SCUM.log` path
   - access to the real server config directory
7. If PM2 will be used:

```bat
npm i -g pm2
```

## Environment Preparation

1. Root env

```bat
copy .env.production.example .env
```

2. Player portal env

```bat
copy apps\web-portal-standalone\.env.production.example apps\web-portal-standalone\.env
```

If you want the supported profile overlays for a production-style single-host or multi-tenant deployment, use:

```bat
npm run env:prepare:single-host-prod
```

or:

```bat
npm run env:prepare:multi-tenant-prod
```

If you want the control plane, server-side automation, and SCUM execution workstation split across hosts, use:

```bat
npm run env:prepare:machine-a-control-plane
npm run env:prepare:machine-b-server-bot
npm run env:prepare:machine-c-delivery-agent
```

See [SINGLE_HOST_PRODUCTION_PROFILE.md](./SINGLE_HOST_PRODUCTION_PROFILE.md) for the profile-specific assumptions and bootstrap flow.
See [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md) for the split-host control-plane and game-runtime model.

## Required Root Env Values

In [`.env`](../.env):

- `NODE_ENV=production`
- `DATABASE_PROVIDER=postgresql`
- `DATABASE_URL=<postgresql://...>`
- `PERSIST_REQUIRE_DB=true`
- `PERSIST_LEGACY_SNAPSHOTS=false`
- `DISCORD_TOKEN=<real token>`
- `SCUM_WEBHOOK_SECRET=<real secret>`
- `ADMIN_WEB_PASSWORD=<real password>`
- `ADMIN_WEB_TOKEN=<real token>`
- `ADMIN_WEB_2FA_ENABLED=true`
- `ADMIN_WEB_STEP_UP_ENABLED=true`

Split runtime defaults:

- bot
  - `BOT_ENABLE_ADMIN_WEB=false`
  - `BOT_ENABLE_RENTBIKE_SERVICE=false`
  - `BOT_ENABLE_DELIVERY_WORKER=false`
- worker
  - `WORKER_ENABLE_RENTBIKE=true`
  - `WORKER_ENABLE_DELIVERY=true`
- watcher
  - `SCUM_WATCHER_HEALTH_PORT=3212`
- web
  - `WEB_PORTAL_PORT=3300`

## Discord OAuth

Configure these redirect URLs in the Discord Developer Portal:

- Player portal: `https://player.genz.noah-dns.online/auth/discord/callback`
- Admin SSO: `https://admin.genz.noah-dns.online/admin/auth/discord/callback`

Required env values:

- `WEB_PORTAL_DISCORD_CLIENT_ID`
- `WEB_PORTAL_DISCORD_CLIENT_SECRET`
- `ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET`

## Database Setup

### Option A: customer-managed PostgreSQL

```bat
npm install
npm run db:generate:postgresql
npm run db:migrate:deploy:postgresql
```

### Option B: local PostgreSQL helper on this workstation

```bat
npm run postgres:local:setup
npm run db:generate:postgresql
npm run db:migrate:deploy:postgresql
```

### Cut over from an existing SQLite runtime

```bat
npm run db:cutover:postgresql -- --source-sqlite prisma/prisma/production.db
```

## Starting the System

### Start services manually

Use separate terminals:

```bat
npm run start:bot
npm run start:worker
npm run start:watcher
npm run start:server-bot
npm run start:agent
npm run start:web-standalone
```

### Start with PM2

```bat
npm run pm2:start:prod
pm2 status
```

For the split Machine A / Machine B / Machine C layout:

```bat
:: Machine A
npm run pm2:start:machine-a-control-plane

:: Machine B
npm run pm2:start:machine-b-server-bot

:: Machine C
npm run pm2:start:machine-c-delivery-agent
```

Reload after env changes:

```bat
npm run pm2:reload:prod
```

## Validation After Startup

Health endpoints:

- bot: `http://127.0.0.1:3210/healthz`
- worker: `http://127.0.0.1:3211/healthz`
- watcher: `http://127.0.0.1:3212/healthz`
- admin web: `http://127.0.0.1:3200/healthz`
- owner web: `http://127.0.0.1:3201/healthz`
- tenant web: `http://127.0.0.1:3202/healthz`
- player portal: `http://127.0.0.1:3300/healthz`
- Delivery Agent / console-agent: `http://127.0.0.1:3213/healthz`
- Server Bot: `http://127.0.0.1:3214/healthz`

Required validation commands:

```bat
npm run doctor
npm run security:check
npm run readiness:prod
```

`readiness:prod` now includes `smoke:postdeploy`, so it checks both static/config validation and live HTTP/runtime checks.

## What To Show During Handoff

- Tenant onboarding checklist and next-step CTA
- Tenant billing state, locked features, and upgrade path
- Runtime tables for `Server Bot` and `Delivery Agent`
- Config editor, restart control, and `Logs & Sync`
- Security events, active sessions, and step-up protected routes
- Player portal login, wallet, shop, order history, donation/supporter view, and public slug pages
- Evidence links from CI artifacts and docs

## What Must Be Stated Clearly

- `Delivery Agent` depends on Windows session state and a live SCUM client
- `Server Bot` depends on real log/config access on the server-side machine
- the recommended way to contain those dependencies is a split runtime topology, not an all-in-one host
- admin and tenant surfaces do not yet cover every environment/config setting
- tenant isolation has a PostgreSQL-first foundation, but rollout proof still matters per environment
- watcher readiness depends on a real `SCUM.log` path
- restore is guarded and should still be treated as a maintenance operation

## Reference Documents

- [README.md](../README.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [OPERATIONS_MANUAL_TH.md](./OPERATIONS_MANUAL_TH.md)
- [GO_LIVE_CHECKLIST_TH.md](./GO_LIVE_CHECKLIST_TH.md)
- [LIMITATIONS_AND_SLA_TH.md](./LIMITATIONS_AND_SLA_TH.md)
- [SINGLE_HOST_PRODUCTION_PROFILE.md](./SINGLE_HOST_PRODUCTION_PROFILE.md)
- [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
