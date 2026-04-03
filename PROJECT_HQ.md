# Project HQ

Language:

- English: `PROJECT_HQ.md`
- Thai: [PROJECT_HQ_TH.md](./PROJECT_HQ_TH.md)

[![CI](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/ci.yml/badge.svg)](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/ci.yml)
[![Release](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/release.yml/badge.svg)](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/release.yml)

Last updated: **2026-03-31**

This document is the factual status register for the repository and the current workstation. It should stay grounded in code, tests, artifacts, and live runtime checks. Do not use it as a sales page.

## Reference Set

- Repository overview: [README.md](./README.md)
- Docs index: [docs/README.md](./docs/README.md)
- Verification status: [docs/VERIFICATION_STATUS_TH.md](./docs/VERIFICATION_STATUS_TH.md)
- Evidence map: [docs/EVIDENCE_MAP_TH.md](./docs/EVIDENCE_MAP_TH.md)
- Architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- Runtime topology: [docs/RUNTIME_TOPOLOGY.md](./docs/RUNTIME_TOPOLOGY.md)
- Worklist: [docs/WORKLIST.md](./docs/WORKLIST.md)
- Product-ready gap matrix: [docs/PRODUCT_READY_GAP_MATRIX.md](./docs/PRODUCT_READY_GAP_MATRIX.md)
- Database strategy: [docs/DATABASE_STRATEGY.md](./docs/DATABASE_STRATEGY.md)
- PostgreSQL cutover checklist: [docs/POSTGRESQL_CUTOVER_CHECKLIST.md](./docs/POSTGRESQL_CUTOVER_CHECKLIST.md)
- Migration / rollback / restore: [docs/MIGRATION_ROLLBACK_POLICY_TH.md](./docs/MIGRATION_ROLLBACK_POLICY_TH.md)
- Release policy: [docs/RELEASE_POLICY.md](./docs/RELEASE_POLICY.md)

## Current State

### Confirmed In Repo

- Runtime is split into `bot`, `worker`, `watcher`, `admin web`, `player portal`, `server bot`, and `console-agent`
- Runtime entry wrappers exist under `apps/admin-web`, `apps/api`, `apps/discord-bot`, `apps/worker`, `apps/watcher`, `apps/agent`, `apps/server-bot`, and `apps/web-portal-standalone`
- PostgreSQL + Prisma are the active persistence foundation for this workstation, with provider-aware Prisma tooling and upgrade scripts
- Admin auth code includes DB login, Discord SSO code paths, TOTP 2FA, step-up auth, session handling, and security event logging
- Control-plane domain boundaries exist for agents, servers, sync ingestion, and delivery routing
- SCUM-specific adapters and parsers live under `src/integrations/scum/`
- Owner, tenant, public, and player web surfaces all exist in code and are wired into runtime entrypoints
- Tenant DB topology support exists for `shared`, `schema-per-tenant`, and `database-per-tenant`; this workstation is using `schema-per-tenant`

### Current Local Runtime Truth On 2026-03-31

Verified directly on this workstation during the current audit:

- Local PostgreSQL is reachable at `127.0.0.1:55432`
- Prisma client generation for PostgreSQL was rerun through `scripts/prisma-with-provider.js`
- `npm run platform:schema:upgrade` completed successfully on this workstation
- `pm2` currently reports these runtimes `online`:
  - `scum-admin-web`
  - `scum-bot`
  - `scum-worker`
  - `scum-watcher`
  - `scum-console-agent`
  - `scum-server-bot`
  - `scum-web-portal`
- `scum-admin-web` is reachable locally and `POST /admin/api/login` returned `200 OK`
- `scum-bot` health endpoint returned `ok=true` and `discordReady=true`
- `scum-server-bot` health endpoint returned `ready=true` with recent successful job polling

### Current Local Runtime Caveats

- `scum-bot` is online, but its error log still contains production-guard and schema-alignment issues:
  - `Production requires ADMIN_WEB_STEP_UP_ENABLED=true`
  - `Production requires ADMIN_WEB_2FA_ENABLED=true`
  - `The table public.ControlPlaneServer does not exist in the current database`
- `scum-web-portal` is online, but its error log still reports optional player-data failures for `lucky-wheel-config` caused by `normalizeHttpUrl is not a function`
- `scum-server-bot` is healthy now, but earlier boot attempts on this workstation failed due to missing control-plane URL and missing platform agent token; treat it as configured for this machine, not yet universal proof for every deployment
- Admin DB login is verified locally; Discord SSO code exists, but admin-role assignment through the current Discord guild was not revalidated in this pass because the live guild role set does not currently prove the configured `Owner/Admin/Moderator` mapping

### Partial / Unfinished

- Billing and subscription lifecycle exist in code but are not yet proven as a production-grade commercial flow end-to-end
- Unified identity has a foundation in schema and services, but email, Discord, Steam, and in-game verification are not yet a clean finished product flow
- Persistence is stronger than before but still not fully normalized; some core paths still mix Prisma, raw SQL, and fallback persistence patterns
- Owner, tenant, and player surfaces are real, but several product systems remain partial or thin:
  - donation / supporter
  - modules / plugin management
  - raid request / raid window / raid summary
  - killfeed as a first-class player product surface
  - deeper analytics / reporting
- Service boundaries are improved, but `apps/api/server.js` still fronts the admin monolith and large service files remain broad
- i18n exists, but there are still hardcoded strings and older encoding-quality issues across docs/UI assets

## Current Workstation Notes

- Database provider in `.env`: `postgresql`
- Runtime database endpoint: `127.0.0.1:55432`
- `TENANT_DB_ISOLATION_MODE=postgres-rls-strict`
- `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant`
- Local admin web: `http://127.0.0.1:3200/admin`
- `scum-bot` health: `http://127.0.0.1:3210/healthz`
- `scum-server-bot` health: `http://127.0.0.1:3214/healthz`
- `DELIVERY_EXECUTION_MODE` on this workstation is still agent-based and remains Windows-session dependent

These notes are machine-specific. Keep them aligned with the active `.env` and PM2 profile when this workstation changes.

## Validation Notes

Current repo-level validation stack remains:

- `npm run lint`
- `npm run test:policy`
- `npm test`
- `npm run doctor`
- `npm run security:check`
- `npm run readiness:prod`
- `npm run smoke:postdeploy`

Current workstation checks performed for this update:

- PostgreSQL reachability check on `127.0.0.1:55432`
- Prisma PostgreSQL client generation
- `npm run platform:schema:upgrade`
- `pm2 describe` for the main runtimes
- local health checks for `scum-bot` and `scum-server-bot`
- local admin login POST against `http://127.0.0.1:3200/admin/api/login`

Important interpretation rule:

- treat repo-local code and tests as implementation proof
- treat PM2/health/login checks from this workstation as current local runtime proof
- do not treat one workstation's runtime proof as universal environment proof

## Remaining Gaps

Use [docs/WORKLIST.md](./docs/WORKLIST.md) as the detailed open backlog.

Short form:

- local runtime proof is stronger again, but startup/log cleanliness is not yet production-clean for every runtime
- commercial readiness is still below launch level
- identity, persistence normalization, donation/modules/raid systems, analytics depth, and UX/i18n polish remain open tracks

## Review Warnings

- Do not claim `database-per-tenant` is the active runtime here; this workstation is still `schema-per-tenant`
- Do not claim Discord admin SSO is fully revalidated on this workstation from this pass
- Do not claim every setting is editable from admin web
- Do not claim Delivery Agent execution is independent of Windows session and SCUM client state
- Do not claim commercial billing, donations, raids, or module management are finished product systems
- Do not use old March 2026 runtime claims without checking the current machine state first

## Summary

The repository is materially stronger than a prototype and the current workstation can boot the main runtime stack again with live PostgreSQL, working admin login, healthy bot/server-bot health endpoints, and active worker/watcher/console-agent processes. However, this is still not a clean commercial-ready service: billing, identity, product systems, persistence normalization, and some runtime warnings/log issues remain open.
