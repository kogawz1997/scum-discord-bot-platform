# SCUM TH Platform

[![CI](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/ci.yml/badge.svg)](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/ci.yml)
[![Release](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/release.yml/badge.svg)](https://github.com/kogawz1997/Scum-bot-discord-Full-/actions/workflows/release.yml)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-2f7d32?style=for-the-badge&logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-v14.25.1-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=for-the-badge&logo=prisma&logoColor=white)

Last updated: **2026-03-31**

SCUM TH Platform is a control plane for a SCUM community stack built around:

- a Discord bot
- an admin web UI
- a player portal
- a worker runtime
- a watcher runtime
- an optional console-agent

Current workstation note on `2026-03-31`:

- local PostgreSQL is up at `127.0.0.1:55432`
- `scum-admin-web`, `scum-bot`, `scum-worker`, `scum-watcher`, `scum-console-agent`, `scum-server-bot`, and `scum-web-portal` are currently `online` in PM2
- local admin DB login was revalidated against `http://127.0.0.1:3200/admin/api/login`
- `scum-bot` and `scum-server-bot` health endpoints both return healthy responses
- do not treat this as proof that commercial billing, unified identity, donations, raids, modules, analytics, or full Discord admin SSO are finished; see [PROJECT_HQ.md](./PROJECT_HQ.md) and [docs/VERIFICATION_STATUS_TH.md](./docs/VERIFICATION_STATUS_TH.md) for the current strict status

If a statement in this repository is not backed by code, tests, CI artifacts, or runtime logs, treat it as supporting context rather than evidence.

## System At A Glance

For the full GitHub-renderable maps, see:

- [docs/SYSTEM_MAP_GITHUB_TH.md](./docs/SYSTEM_MAP_GITHUB_TH.md)
- [docs/SYSTEM_MAP_GITHUB_EN.md](./docs/SYSTEM_MAP_GITHUB_EN.md)

![Architecture overview](./docs/assets/architecture-overview.svg)

> **What this repo is, in one screen**
>
> `Owner Panel` oversees the platform. `Tenant Panel` runs daily server operations. `Player Portal` handles community and commerce.
> `Server Bot / Watcher` reads and syncs. `Delivery Agent` executes in game.
> Everything converges into the control plane and persists through `PostgreSQL + Prisma`.

```mermaid
flowchart LR
  OWNER["Owner Panel"] --> ADMIN["Admin API / Control Plane"]
  TENANT["Tenant Panel"] --> ADMIN
  PUBLIC["Public / Auth"] --> PLAYER["Player / Public API"]
  PORTAL["Player Portal"] --> PLAYER
  DISCORD["Discord"] --> BOT["Discord Bot"]

  BOT --> DB[("PostgreSQL + Prisma")]
  ADMIN --> DB
  PLAYER --> DB
  WORKER["Worker"] --> DB

  WATCHER["Server Bot / Watcher"] --> ADMIN
  WATCHER --> DB
  AGENT["Delivery Agent"] --> ADMIN
  AGENT --> DB
  AGENT --> SCUM["SCUM Client"]
```

## Primary Documents

- Docs index: [docs/README.md](./docs/README.md)
- Operator quickstart: [docs/OPERATOR_QUICKSTART.md](./docs/OPERATOR_QUICKSTART.md)
- 15-minute setup path: [docs/FIFTEEN_MINUTE_SETUP.md](./docs/FIFTEEN_MINUTE_SETUP.md)
- Single-host production profile: [docs/SINGLE_HOST_PRODUCTION_PROFILE.md](./docs/SINGLE_HOST_PRODUCTION_PROFILE.md)
- Two-machine agent topology: [docs/TWO_MACHINE_AGENT_TOPOLOGY.md](./docs/TWO_MACHINE_AGENT_TOPOLOGY.md)
- Restart announcement preset: [docs/RESTART_ANNOUNCEMENT_PRESET.md](./docs/RESTART_ANNOUNCEMENT_PRESET.md)
- System status: [PROJECT_HQ.md](./PROJECT_HQ.md)
- Verification status: [docs/VERIFICATION_STATUS_TH.md](./docs/VERIFICATION_STATUS_TH.md)
- Evidence map: [docs/EVIDENCE_MAP_TH.md](./docs/EVIDENCE_MAP_TH.md)
- Visual assets: [docs/assets/README.md](./docs/assets/README.md)
- Architecture: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- GitHub system map: [docs/SYSTEM_MAP_GITHUB_TH.md](./docs/SYSTEM_MAP_GITHUB_TH.md)
- GitHub system map (EN): [docs/SYSTEM_MAP_GITHUB_EN.md](./docs/SYSTEM_MAP_GITHUB_EN.md)
- Web surfaces v4 blueprint: [docs/WEB_SURFACES_V4_BLUEPRINT_TH.md](./docs/WEB_SURFACES_V4_BLUEPRINT_TH.md)
- Web surfaces v4 sitemap: [docs/WEB_SURFACES_V4_SITEMAP_TH.md](./docs/WEB_SURFACES_V4_SITEMAP_TH.md)
- Tenant v4 wireframes: [docs/TENANT_V4_WIREFRAMES_TH.md](./docs/TENANT_V4_WIREFRAMES_TH.md)
- Tenant dashboard v4 implementation spec: [docs/TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant server status v4 implementation spec: [docs/TENANT_SERVER_STATUS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_SERVER_STATUS_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant server config v4 implementation spec: [docs/TENANT_SERVER_CONFIG_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_SERVER_CONFIG_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant orders v4 implementation spec: [docs/TENANT_ORDERS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_ORDERS_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant players v4 implementation spec: [docs/TENANT_PLAYERS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_PLAYERS_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant delivery agents v4 implementation spec: [docs/TENANT_DELIVERY_AGENTS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_DELIVERY_AGENTS_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant server bots v4 implementation spec: [docs/TENANT_SERVER_BOTS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_SERVER_BOTS_V4_IMPLEMENTATION_SPEC_TH.md)
- Tenant restart control v4 implementation spec: [docs/TENANT_RESTART_CONTROL_V4_IMPLEMENTATION_SPEC_TH.md](./docs/TENANT_RESTART_CONTROL_V4_IMPLEMENTATION_SPEC_TH.md)
- Owner v4 wireframes: [docs/OWNER_V4_WIREFRAMES_TH.md](./docs/OWNER_V4_WIREFRAMES_TH.md)
- Owner dashboard v4 implementation spec: [docs/OWNER_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md](./docs/OWNER_DASHBOARD_V4_IMPLEMENTATION_SPEC_TH.md)
- Owner tenants v4 implementation spec: [docs/OWNER_TENANTS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/OWNER_TENANTS_V4_IMPLEMENTATION_SPEC_TH.md)
- Owner runtime health and incidents v4 implementation spec: [docs/OWNER_RUNTIME_HEALTH_INCIDENTS_V4_IMPLEMENTATION_SPEC_TH.md](./docs/OWNER_RUNTIME_HEALTH_INCIDENTS_V4_IMPLEMENTATION_SPEC_TH.md)
- Player v4 wireframes: [docs/PLAYER_V4_WIREFRAMES_TH.md](./docs/PLAYER_V4_WIREFRAMES_TH.md)
- Player home v4 implementation spec: [docs/PLAYER_HOME_V4_IMPLEMENTATION_SPEC_TH.md](./docs/PLAYER_HOME_V4_IMPLEMENTATION_SPEC_TH.md)
- Player commerce v4 implementation spec: [docs/PLAYER_COMMERCE_V4_IMPLEMENTATION_SPEC_TH.md](./docs/PLAYER_COMMERCE_V4_IMPLEMENTATION_SPEC_TH.md)
- Player stats, events, and support v4 implementation spec: [docs/PLAYER_STATS_EVENTS_SUPPORT_V4_IMPLEMENTATION_SPEC_TH.md](./docs/PLAYER_STATS_EVENTS_SUPPORT_V4_IMPLEMENTATION_SPEC_TH.md)
- Runtime boundary explainer: [docs/RUNTIME_BOUNDARY_EXPLAINER.md](./docs/RUNTIME_BOUNDARY_EXPLAINER.md)
- Runtime topology: [docs/RUNTIME_TOPOLOGY.md](./docs/RUNTIME_TOPOLOGY.md)
- Package and agent model: [docs/PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./docs/PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
- Worklist: [docs/WORKLIST.md](./docs/WORKLIST.md)
- Product-ready gap matrix: [docs/PRODUCT_READY_GAP_MATRIX.md](./docs/PRODUCT_READY_GAP_MATRIX.md)
- Fix master list status: [docs/FIX_MASTERLIST_STATUS.md](./docs/FIX_MASTERLIST_STATUS.md)
- FIIX brief summary: [docs/FIIX_BRIEF.md](./docs/FIIX_BRIEF.md)
- Preserved raw FIIX prompt: [docs/fiix.txt](./docs/fiix.txt)
- Practical adoption plan: [docs/PRACTICAL_ADOPTION_PLAN.md](./docs/PRACTICAL_ADOPTION_PLAN.md)
- Refactor plan: [docs/REFACTOR_PLAN.md](./docs/REFACTOR_PLAN.md)
- Config matrix: [docs/CONFIG_MATRIX.md](./docs/CONFIG_MATRIX.md)
- Database strategy: [docs/DATABASE_STRATEGY.md](./docs/DATABASE_STRATEGY.md)
- Data ownership map: [docs/DATA_OWNERSHIP_MAP.md](./docs/DATA_OWNERSHIP_MAP.md)
- PostgreSQL cutover checklist: [docs/POSTGRESQL_CUTOVER_CHECKLIST.md](./docs/POSTGRESQL_CUTOVER_CHECKLIST.md)
- Delivery capability matrix: [docs/DELIVERY_CAPABILITY_MATRIX_TH.md](./docs/DELIVERY_CAPABILITY_MATRIX_TH.md)
- Migration / rollback / restore: [docs/MIGRATION_ROLLBACK_POLICY_TH.md](./docs/MIGRATION_ROLLBACK_POLICY_TH.md)
- Limits and SLA notes: [docs/LIMITATIONS_AND_SLA_TH.md](./docs/LIMITATIONS_AND_SLA_TH.md)
- Release notes: [docs/releases/README.md](./docs/releases/README.md)
- Release policy: [docs/RELEASE_POLICY.md](./docs/RELEASE_POLICY.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

## What Works Now

### Runtime and topology

- Staged runtime entrypoints now exist under `apps/api`, `apps/admin-web`, `apps/discord-bot`, `apps/worker`, `apps/watcher`, and `apps/agent`
- Split processes for `bot`, `worker`, `watcher`, `admin web`, `player portal`, and `console-agent`
- Health endpoints for each runtime
- Topology checks, production checks, smoke checks, and PM2 manifests
- Split origin deployment for admin and player surfaces
- Runtime env parsing now has a dedicated boundary under `src/config/`
- Bot and worker startup wiring now lives under `src/bootstrap/`
- Bot ready/runtime boot logic and community listeners are split under `src/bootstrap/`
- Admin route groups are partly split under `src/admin/api/` and `src/admin/audit/`
- Admin page/static loading, request/body parsing, request routing, access/security/control-panel helpers, live/SSE/metrics helpers, and Discord OAuth client calls are split under `src/admin/runtime/` and `src/admin/auth/`
- Player API groups are partly split under `apps/web-portal-standalone/api/`
- Player portal page routing and canonical redirects now live under `apps/web-portal-standalone/runtime/portalPageRoutes.js`
- Player portal page/static loading, response/security helpers, reward/wheel helpers, and HTTP lifecycle wiring now live under `apps/web-portal-standalone/runtime/`
- Control-plane agent contracts now live under `src/contracts/agent/`
- Package/feature gating now resolves through `src/domain/billing/packageCatalogService.js`
- Control-plane registry/domain services now live under `src/data/repositories/controlPlaneRegistryRepository.js`, `src/domain/servers/`, `src/domain/agents/`, `src/domain/sync/`, and `src/domain/delivery/`
- Centralized control-plane routes now accept agent registration, session heartbeat, and sync ingestion through `/platform/api/v1/agent/*`
- Owner control can now mint one-time setup tokens and bootstrap payloads for scoped agent activation

### Persistence

- PostgreSQL is supported as the active runtime database provider
- Prisma generation and migration commands are provider-aware
- SQLite-to-PostgreSQL cutover tooling exists in-repo
- Tests run against isolated provider-specific databases or schemas instead of the live runtime database
- Mutable runtime state and PostgreSQL runtime dumps are no longer meant to live inside the tracked repository tree; production and DB-only persistence now default to external OS-managed state paths
- Tenant DB topology resolver and provisioning script now exist for `shared`, `schema-per-tenant`, and `database-per-tenant`
- Tenant-scoped platform, tenant-config, purchase/shop, delivery persistence, player wallet/account, player portal, community/admin store, and SCUM webhook/community automation paths now resolve Prisma datasource targets through the selected tenant DB topology where tenant context or a default tenant is available
- `schema-per-tenant` is now the repository target for multi-tenant deployments; `database-per-tenant` remains supported for higher-isolation tiers
- This workstation now runs the live runtime with `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` for default tenant `1259096998045421672`

### Admin and player surfaces

- Admin login from database credentials
- Discord SSO for admin
- TOTP 2FA and step-up auth for sensitive routes
- Session revoke, security events, request trail, audit, and restore preview
- Web runtimes are enabled again on this workstation for `owner`, `tenant`, `public`, and `player` surfaces
- Primary role-separated routes now use:
  - `/owner` for platform owner oversight
  - `/tenant` for tenant-scoped server administration
  - `/player` for player-facing portal flows
- `/admin/legacy` now exists as a compatibility fallback only, not the primary operator path
- Owner login works locally on loopback without changing the production auth model; cookie handling now degrades safely only for loopback development
- Owner pages now load without preview-tenant quota `500` failures
- Tenant V4 now uses preview-aware fallback data for preview tenants instead of failing scoped reads
- Public preview flow now works locally through `signup -> preview -> logout -> login -> preview`
- `/player/login` and Discord OAuth start now work locally; the OAuth callback still requires a real Discord sign-in outside automation
- Player portal with wallet, purchase history, redeem, profile, and Steam link flows
- Control panel for a growing subset of runtime and bot settings
- Package catalog, feature catalog, and tenant feature access are now exposed from the control plane
- Control panel env metadata now classifies keys by policy and apply mode
- Control panel env writes now return per-key apply summaries and restart guidance instead of a blanket restart-required response
- Owner control now also exposes `Discord admin-log` language selection so ops alerts can be switched between Thai and English from the web UI
- Owner and tenant runtime tables now classify connected agents by inferred role and scope, including `sync`, `execute`, and `hybrid` paths
- Backup restore preview/live status now include post-restore verification and persisted rollback status
- Bot and worker entrypoints are now mostly bootstrap/runtime composition
- Admin browser shell/common helpers now live under `src/admin/assets/dashboard-shell.js`
- Admin snapshot/session/form runtime helpers now live under `src/admin/assets/dashboard-runtime.js`
- Admin browser DOM refs, mutable state, and event binding/startup wiring now live under `src/admin/assets/dashboard-dom.js`, `src/admin/assets/dashboard-state.js`, and `src/admin/assets/dashboard-bindings.js`
- Admin server lifecycle/bootstrap wiring now lives under `src/admin/runtime/adminServerLifecycleRuntime.js`
- Player portal helper/auth/route bootstrap wiring now lives under `apps/web-portal-standalone/runtime/portalBootstrapRuntime.js`

### Operations and observability

- Runtime supervisor with per-role status
- Control-plane registry now persists explicit tenant/server/guild/agent relationships for agent routing and sync freshness
- Agent provisioning now records setup tokens, devices, credentials, and bound machine fingerprints in the control-plane registry
- Notification center and reconcile findings in admin
- Owner console now supports one-click tenant diagnostics export so support can gather tenant runtime, delivery, request-error, and commercial context from one place
- Owner console now also exposes tenant support-case context, delivery lifecycle reporting, and guarded automation control from the primary surface
- Tenant console now exposes delivery lifecycle signals, action planner guidance, bulk recovery prep, and per-case phase visibility from the scoped surface
- Secret rotation now has a dedicated readiness/check matrix via `npm run security:rotation:check` so operators can see reload targets, validation steps, and split-origin drift before reopening traffic
- Restore, delivery, and guarded config flows now expose explicit operator-facing lifecycle phases in the web UI without changing the underlying business logic
- Discord ops alert formatting now supports web-selected Thai or English output for the owner-facing `#admin-log` workflow
- Backup / restore preview and restore guardrails
- CI artifacts for lint, tests, doctor, security checks, readiness, and smoke
- `doctor`, `security:check`, `readiness`, `smoke`, and `doctor:topology` now share one machine-readable report contract when called with `--json`
- `ci:verify` now writes `verification-contract.json` from the shared JSON contract instead of relying only on raw log parsing
- `lint` now covers syntax, text-encoding scan, ESLint, and formatting checks for repo metadata/docs
- `lint` now also blocks ambiguous temp/proof files from living in the repository root
- User-facing Thai command and leaderboard text is now guarded by `lint:text` plus `test/mojibake-regression.test.js`
- Policy checks now include runtime profile, control-panel config registry, smoke behavior, readiness sequencing, and module docs
- Live runtime proof now exists on this workstation for `console-agent` preflight/execute and watcher `ready` state against a real `SCUM.log`
- Console-agent health/preflight now also expose classified failure reasons, recovery hints, and managed-process auto-restart telemetry
- Watcher health now exposes recent parsed `admin-command` events from the live server log
- Delivery verification now supports a first-party native-proof backend that reads live SCUM save state from `SCUM.db`
- Native proof now supports both inventory delta and world-spawn delta verification on this workstation
- Live runtime evidence now also shows schema `tenant_1259096998045421672` provisioned in PostgreSQL, with delivery-audit writes present under that tenant schema
- First-party native-proof scripts now exist at `scripts/delivery-native-proof-scum-savefile.js` and `scripts/delivery-native-proof-template.ps1`
- Native-proof environment tracking now exists under `docs/assets/live-native-proof-environments.json` and `docs/assets/live-native-proof-coverage-summary.*`

## What Is Partial

- Admin web still does not cover every `.env` or config setting, even though env-catalog writes now return apply summary and restart guidance
- Restore still relies on a guarded maintenance flow rather than fully automatic rollback, even though success now depends on post-restore verification
- Real captures now exist for admin login, authenticated admin dashboard, player landing, player login, authenticated player dashboard, player showcase, and a simple demo GIF under `docs/assets/`
- `src/adminWebServer.js` and `apps/web-portal-standalone/server.js` are now thin bootstrap/composition entrypoints
- `src/admin/dashboard.html` is now a thinner shell, and the browser runtime is split across focused assets under `src/admin/assets/`, though the surface is still large
- Some operator flows are intentionally represented as read-only lifecycle models in the UI, not full workflow engines; this improves clarity without changing current route or runtime contracts

## What Is Runtime-Dependent

- `agent` delivery execution depends on a live Windows session and a working SCUM client window
- Watcher health depends on a real `SCUM.log` path being present and staying readable
- Some SCUM command behavior still depends on the target server configuration and game patch level

## Known Limitations

- SQLite remains in dev/import/compatibility paths, but it is no longer the target runtime path for this workstation
- Admin web is not yet a full replacement for direct env/config editing
- Native-proof environment coverage is still based on one verified workstation; additional server/workstation captures remain open in `docs/assets/live-native-proof-environments.json`
- A second server-configuration sample (`EnableSpawnOnGround=True`) exists but is only partial, and the same-workstation `rcon` runtime attempt is blocked by `ECONNREFUSED 127.0.0.1:27015`
- This workstation now runs `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant`, but this is still only one verified environment; other workstations and `database-per-tenant` deployments require separate runtime evidence
- Native game-state proof is verified on this workstation through `SCUM.db` for representative spawn-item classes, including representative `ammo` via `Cal_7_62x39mm_Ammobox`, plus representative `teleport_spawn` / `announce_teleport_spawn` wrapper profiles; broader server/workstation coverage is still incomplete
- A capture checklist now exists at [docs/assets/CAPTURE_CHECKLIST.md](./docs/assets/CAPTURE_CHECKLIST.md)

## Evidence

Source of truth for verification status:

- `artifacts/ci/verification-summary.json`
- `artifacts/ci/verification-summary.md`
- `artifacts/ci/verification-contract.json`
- `artifacts/ci/lint.log`
- `artifacts/ci/test.log`
- `artifacts/ci/doctor.log`
- `artifacts/ci/security-check.log`
- `artifacts/ci/readiness.log`
- `artifacts/ci/smoke.log`

Standard commands used for local verification:

```bash
npm run lint
npm run check:repo-hygiene
npm run test:policy
npm test
npm run doctor
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
```

Latest repo-local verification on this workstation completed on `2026-03-26` with these commands passing:

- `npm run lint`
- `npm run test:policy`
- `npm test`
- `npm run doctor`
- `npm run security:check`

Additional live browser validation completed on `2026-03-26` for:

- owner login and owner console
- tenant login and tenant console
- public `signup -> preview -> logout -> login -> preview`
- player login and Discord OAuth start redirect

The broader operator stack `npm run readiness:prod` and `npm run smoke:postdeploy` remains part of the standard release bar. The latest full local pass including that broader stack is still `2026-03-24`.

Operational guardrails now enforced by validation:

- production must use PostgreSQL as the primary runtime database
- `schema-per-tenant` / `database-per-tenant` require PostgreSQL
- do not enable delivery worker on both `bot` and `worker`
- split-origin cookie domain drift is checked in `doctor` / `security:check`

Additional live runtime evidence from this workstation:

- watcher `ready` against the configured `SCUM.log`
- console-agent `ready` with successful live preflight
- one live `#Announce` command executed through the agent and observed in `SCUM.log`
- live native proof matrix captured from `SCUM.db` for:
  - `Water_05l`
  - `BakedBeans`
  - `Emergency_bandage`
  - `Weapon_M1911`
  - `Weapon_AK47`
  - `Magazine_M1911`
  - `Backpack_02_01`
  - `Cal_7_62x39mm_Ammobox`
- live wrapper-profile native proof matrix captured from `SCUM.db` for:
  - `teleport_spawn` using `Weapon_M1911`
  - `announce_teleport_spawn` using `Emergency_bandage`
- representative `ammo` proof now passes with `Cal_7_62x39mm_Ammobox`; loose-round IDs `Ammo_762` and `Cal_7_62x39mm` still did not yield a confirmed `SCUM.db` delta on `2026-03-17`

See [docs/assets/live-runtime-evidence.md](./docs/assets/live-runtime-evidence.md).

Package and activation details are summarized in [docs/PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./docs/PLATFORM_PACKAGE_AND_AGENT_MODEL.md).

Environment coverage status is summarized in [docs/assets/live-native-proof-coverage-summary.md](./docs/assets/live-native-proof-coverage-summary.md).

## Architecture Summary

```mermaid
flowchart LR
  A["Discord Bot"] --> B["Control plane routes"]
  C["Admin Web"] --> B
  D["Player Portal"] --> B
  E["Sync Agent"] -->|"read/sync only"| B
  B --> F["Domain + repositories"]
  F --> G["Worker / delivery jobs"]
  G --> H["Execute Agent"]
  E --> I["SCUM log / state readers"]
  H --> J["SCUM command / proof adapters"]
  F --> K["PostgreSQL + projections"]
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for file-level references.

## Quick Start

### Windows quick start

```bash
npm run setup:easy
```

### Prepare local PostgreSQL

```bash
npm run postgres:local:setup
npm run db:generate:postgresql
npm run db:migrate:deploy:postgresql
```

### Operator first path

If you are operating a live environment and need the shortest route:

1. Open [docs/OPERATOR_QUICKSTART.md](./docs/OPERATOR_QUICKSTART.md)
2. Run:

```bash
npm run doctor
npm run security:check
npm run security:rotation:check
```

### Split Machine A / Machine B

If you want the control plane and the SCUM execution node on different hosts:

```bash
npm run setup:15min:machine-a-control-plane
npm run setup:15min:machine-b-game-bot
```

See [docs/TWO_MACHINE_AGENT_TOPOLOGY.md](./docs/TWO_MACHINE_AGENT_TOPOLOGY.md).

### Cut over from SQLite to PostgreSQL

```bash
npm run db:cutover:postgresql -- --source-sqlite prisma/prisma/production.db
```

## Environment Notes

### Database

```env
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:password@127.0.0.1:55432/scum_th_platform?schema=public
PERSIST_REQUIRE_DB=true
PERSIST_LEGACY_SNAPSHOTS=false
```

### Admin web

```env
ADMIN_WEB_SSO_DISCORD_ENABLED=true
ADMIN_WEB_2FA_ENABLED=true
ADMIN_WEB_STEP_UP_ENABLED=true
```

### Delivery-related runtime

```env
DELIVERY_EXECUTION_MODE=agent
SCUM_CONSOLE_AGENT_BASE_URL=http://127.0.0.1:3213
SCUM_CONSOLE_AGENT_TOKEN=put_a_strong_agent_token_here
SCUM_WATCHER_ENABLED=true
SCUM_LOG_PATH=Z:\\SteamLibrary\\steamapps\\common\\SCUM Server\\SCUM\\Saved\\Logs\\SCUM.log
SCUM_CONSOLE_AGENT_REQUIRED=false
DELIVERY_NATIVE_PROOF_MODE=required
DELIVERY_NATIVE_PROOF_TIMEOUT_MS=15000
DELIVERY_NATIVE_PROOF_WAIT_FOR_STATE_MS=15000
DELIVERY_NATIVE_PROOF_POLL_INTERVAL_MS=1500
```

### Web Setup (Admin Web + Player Portal)

#### Admin Web (recommended production baseline)

Admin web runs through the bot runtime entrypoint at `src/adminWebServer.js`.

Recommended production `.env` values:

```env
ADMIN_WEB_HOST=0.0.0.0
ADMIN_WEB_PORT=3200

# CSRF hardening / origin allowlist
ADMIN_WEB_ENFORCE_ORIGIN_CHECK=true
ADMIN_WEB_ALLOWED_ORIGINS=https://admin.genz.noah-dns.online
ADMIN_WEB_TRUST_PROXY=true

# Cookie security
ADMIN_WEB_SECURE_COOKIE=true
ADMIN_WEB_HSTS_ENABLED=true
ADMIN_WEB_SESSION_COOKIE_NAME=scum_admin_session
ADMIN_WEB_SESSION_COOKIE_PATH=/
ADMIN_WEB_SESSION_COOKIE_SAMESITE=Strict

# Auth hardening
ADMIN_WEB_2FA_ENABLED=true
ADMIN_WEB_2FA_SECRET=put_a_strong_totp_secret_here
ADMIN_WEB_STEP_UP_ENABLED=true
ADMIN_WEB_LOCAL_RECOVERY=false

# If Discord SSO is enabled for admin access
ADMIN_WEB_SSO_DISCORD_ENABLED=true
ADMIN_WEB_SSO_DISCORD_CLIENT_ID=...
ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET=...
ADMIN_WEB_SSO_DISCORD_REDIRECT_URI=https://admin.genz.noah-dns.online/admin/auth/discord/callback
ADMIN_WEB_SSO_DISCORD_GUILD_ID=...
```

#### Player Portal (recommended production baseline)

The player portal runs as a separate process from `apps/web-portal-standalone/`.

Recommended portal `.env` values:

```env
WEB_PORTAL_MODE=player
WEB_PORTAL_HOST=0.0.0.0
WEB_PORTAL_PORT=3300

WEB_PORTAL_BASE_URL=https://player.genz.noah-dns.online
WEB_PORTAL_LEGACY_ADMIN_URL=https://admin.genz.noah-dns.online/admin

# Session / cookies
WEB_PORTAL_SESSION_TTL_HOURS=12
WEB_PORTAL_SECURE_COOKIE=true
WEB_PORTAL_COOKIE_SAMESITE=Lax
WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true
WEB_PORTAL_SESSION_COOKIE_NAME=scum_portal_session
WEB_PORTAL_SESSION_COOKIE_PATH=/
WEB_PORTAL_COOKIE_DOMAIN=

# Discord OAuth
WEB_PORTAL_DISCORD_CLIENT_ID=...
WEB_PORTAL_DISCORD_CLIENT_SECRET=...
WEB_PORTAL_DISCORD_REDIRECT_PATH=/auth/discord/callback
```

Notes:

- Primary admin surfaces are `/owner` and `/tenant`.
- `/admin` remains an entry and compatibility path, but it is not the primary operator surface.
- Because owner and tenant live on top-level routes, `ADMIN_WEB_SESSION_COOKIE_PATH=/` is required.

#### Validate Web Deployment

```bash
npm run doctor:web-standalone:prod
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
```

If the smoke script reads base URLs from the environment, set:

```bat
set SMOKE_ADMIN_BASE_URL=https://admin.genz.noah-dns.online/admin
set SMOKE_PLAYER_BASE_URL=https://player.genz.noah-dns.online
```

For the full env reference, see [docs/ENV_REFERENCE_TH.md](./docs/ENV_REFERENCE_TH.md).
