# Customer Onboarding

Last updated: **2026-03-15**

This document is for production deployment and handoff. It describes the supported topology, prerequisites, validation steps, and limits that should be stated to the customer.

## Deployment Topology

Current example split-origin deployment:

- Player portal: `https://player.genz.noah-dns.online`
- Admin portal: `https://admin.genz.noah-dns.online/admin`

Runtime roles:

- `bot`: Discord gateway, command handling, admin web, SCUM webhook receiver
- `worker`: delivery queue and rent bike runtime
- `watcher`: reads `SCUM.log` and posts events into `/scum-event`
- `web`: standalone player portal
- `console-agent`: bridge between API calls and SCUM admin client

## Customer Deliverables

- Discord bot for economy, shop, reward, moderation, and community operations
- Admin web for config, audit, runtime status, security events, and restore workflows
- Player portal for wallet, purchase history, redeem, profile, and Steam linking
- Worker runtime for queue processing
- Optional watcher runtime for `SCUM.log`
- Optional console-agent runtime for agent-based execution

## Prerequisites

1. Node.js 20+
2. npm
3. PostgreSQL for production
4. A real Discord application and bot token
5. If `agent` execution is required:
   - an unlocked Windows session
   - a running SCUM client logged in with the required admin context
6. If PM2 will be used:

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
  - `BOT_ENABLE_ADMIN_WEB=true`
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
npm run start:scum-agent
npm run start:web-standalone
```

### Start with PM2

```bat
npm run pm2:start:prod
pm2 status
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
- player portal: `http://127.0.0.1:3300/healthz`
- console-agent: `http://127.0.0.1:3213/healthz`

Required validation commands:

```bat
npm run doctor
npm run security:check
npm run readiness:prod
```

`readiness:prod` now includes `smoke:postdeploy`, so it checks both static/config validation and live HTTP/runtime checks.

## What To Show During Handoff

- Admin runtime overview
- Control panel and raw config boundaries
- Security events, active sessions, and step-up protected routes
- Backup / restore preview flow
- Player portal login, wallet, purchase history, redeem, and Steam link
- Evidence links from CI artifacts and docs

## What Must Be Stated Clearly

- `agent` execution depends on Windows session state and a live SCUM client
- Admin web does not yet cover every env/config setting
- Tenant isolation has a PostgreSQL RLS foundation for selected tenant-scoped tables, but it is not database-per-tenant
- Watcher readiness depends on a real `SCUM.log` path
- Restore is guarded and should still be treated as a maintenance operation

## Reference Documents

- [README.md](../README.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [OPERATIONS_MANUAL_TH.md](./OPERATIONS_MANUAL_TH.md)
- [GO_LIVE_CHECKLIST_TH.md](./GO_LIVE_CHECKLIST_TH.md)
- [LIMITATIONS_AND_SLA_TH.md](./LIMITATIONS_AND_SLA_TH.md)
