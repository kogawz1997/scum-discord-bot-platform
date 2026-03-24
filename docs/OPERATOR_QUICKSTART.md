# Operator Quickstart

This document is the shortest operator path for the current platform.

If you want the even shorter bootstrap-first path for a fresh setup, start with [FIFTEEN_MINUTE_SETUP.md](./FIFTEEN_MINUTE_SETUP.md).

Use it when you need to answer one of these questions quickly:

- Is the system healthy right now?
- Which page should I open first?
- Which document should I read for this incident?
- What should I validate before reopening traffic?

## 1. Open The Right Surface

- Platform owner login: `/owner/login`
- Platform owner console: `/owner`
- Tenant admin login: `/tenant/login`
- Tenant admin console: `/tenant`
- Player-facing checks and login: `/player` / `/player/login`

Do not use legacy pages first unless the main surface clearly does not expose the workflow you need.
Treat `/admin/legacy` as compatibility fallback only.

## 2. Five-Minute Health Check

Run these first:

```bash
npm run doctor
npm run security:check
npm run security:rotation:check
```

What they answer:

- `doctor`
  - runtime health
  - PostgreSQL-first topology checks
  - split-origin drift
  - duplicate worker ownership
- `security:check`
  - cookie/origin/OAuth drift
  - security policy posture
- `security:rotation:check`
  - which secrets affect which runtimes
  - what must reload after rotation
  - what validation must happen before reopen

## 3. If Something Looks Wrong

### Delivery is stuck or players report missing items

Open:

- Owner: `Observability`
- Tenant: `Commerce + Delivery`
- Tenant: `Transactions`

Use:

- Delivery lifecycle watch
- Delivery case
- Delivery lab
- Bulk recovery only after runtime review

Read next:

- [DELIVERY_CAPABILITY_MATRIX_TH.md](./DELIVERY_CAPABILITY_MATRIX_TH.md)
- [RESTART_ANNOUNCEMENT_PRESET.md](./RESTART_ANNOUNCEMENT_PRESET.md)
- [LIMITATIONS_AND_SLA_TH.md](./LIMITATIONS_AND_SLA_TH.md)

### Admin login / session / SSO problems

Open:

- Owner: `Security + Audit`

Run:

```bash
npm run security:check
npm run security:rotation:check
```

Read next:

- [SPLIT_ORIGIN_AND_2FA_GUIDE.md](./SPLIT_ORIGIN_AND_2FA_GUIDE.md)
- [SECRET_ROTATION_RUNBOOK.md](./SECRET_ROTATION_RUNBOOK.md)

### Discord admin-log output language or readability issue

Open:

- Owner: `Control Center`

Use:

- `Discord admin-log language`

What it changes:

- owner-facing Discord ops alerts between Thai and English
- persisted control-panel env state for `ADMIN_LOG_LANGUAGE`

### Backup / restore / rollback incident

Open:

- Owner: `Recovery`

Read next:

- [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)

### Tenant support / onboarding / quota / packaging question

Open:

- Owner: `Tenant Fleet`
- Owner: `Commercial + Policy`

Use:

- Tenant support case
- Tenant diagnostics export
- Quota pressure
- Marketplace / subscription / license context

Read next:

- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [SUBSCRIPTION_POLICY_TH.md](./SUBSCRIPTION_POLICY_TH.md)

## 4. Deployment Profiles

Treat these as distinct profiles:

- `local-dev`
  - scratch work
  - can tolerate simplified inputs
  - never use as evidence for production claims
- `single-host-prod`
  - one host
  - PostgreSQL runtime
  - split-origin admin/player surfaces
- `machine-a-control-plane`
  - Discord/API/database/shop logic
  - owner / tenant / player web surfaces
  - worker runtime
- `machine-b-game-bot`
  - SCUM client workstation
  - console-agent
  - watcher if the live `SCUM.log` lives here
- `multi-tenant-prod`
  - PostgreSQL-first
  - tenant topology selected intentionally
  - owner / tenant / player surfaces split

Do not treat SQLite as the default production path.

Read next:

- [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
- [POSTGRESQL_CUTOVER_CHECKLIST.md](./POSTGRESQL_CUTOVER_CHECKLIST.md)
- [SINGLE_HOST_PRODUCTION_PROFILE.md](./SINGLE_HOST_PRODUCTION_PROFILE.md)
- [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)

Quick commands:

```bash
npm run env:preview:single-host-prod
npm run env:prepare:single-host-prod
npm run env:preview:machine-a-control-plane
npm run env:prepare:machine-a-control-plane
npm run env:preview:machine-b-game-bot
npm run env:prepare:machine-b-game-bot
npm run env:preview:multi-tenant-prod
npm run env:prepare:multi-tenant-prod
```

## 5. Short Problem Map

- Delivery queue / dead-letter / poison handling
  - [DELIVERY_CAPABILITY_MATRIX_TH.md](./DELIVERY_CAPABILITY_MATRIX_TH.md)
  - `/tenant` -> `Commerce + Delivery`
- Secret rotation / reload / reopen
  - [SECRET_ROTATION_RUNBOOK.md](./SECRET_ROTATION_RUNBOOK.md)
  - `/owner` -> `Security + Audit`
- Runtime topology / worker ownership
  - [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
  - [RUNTIME_BOUNDARY_EXPLAINER.md](./RUNTIME_BOUNDARY_EXPLAINER.md)
  - [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
  - `npm run doctor`
- Database topology / tenant routing
  - [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
  - [DATA_OWNERSHIP_MAP.md](./DATA_OWNERSHIP_MAP.md)
- Restore / rollback
  - [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
  - [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)
- Product readiness / what is still open
  - [WORKLIST.md](./WORKLIST.md)
  - [PRODUCT_READY_GAP_MATRIX.md](./PRODUCT_READY_GAP_MATRIX.md)

## 6. Important Truths To Keep Saying Out Loud

- Do not claim native proof is complete across every environment yet.
- Do not claim console-agent is independent from Windows session / SCUM client reality.
- Do not claim every config is editable from the web UI.
- Do not reopen traffic after secret rotation without post-reload validation.
- Do not run production on SQLite.
