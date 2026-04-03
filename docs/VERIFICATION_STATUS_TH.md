# Verification Status

This file summarizes verification status without pretending that every repo feature has already been proven live on every environment.

## Source of Truth

Use this set first:

- `.github/workflows/ci.yml`
- `artifacts/ci/verification-summary.json`
- `artifacts/ci/verification-summary.md`
- `artifacts/ci/verification-contract.json`
- `artifacts/ci/lint.log`
- `artifacts/ci/test.log`
- `artifacts/ci/doctor.log`
- `artifacts/ci/security-check.log`
- `artifacts/ci/readiness.log`
- `artifacts/ci/smoke.log`

## Local Command Set

Primary repo-level commands:

```bash
npm run lint
npm run test:policy
npm test
npm run doctor
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
```

Closest local equivalent to CI:

```bash
npm run ci:verify
```

Additional commands used in the current workstation update on `2026-04-03`:

```bash
node scripts/prisma-with-provider.js --provider postgresql generate
npm run postgres:local:start
npm run platform:schema:upgrade
npm run pm2:start:prod
node output/playwright/deep-role-audit.js
node output/playwright/player-capture-verify.js
node scripts/runtime-env-check.js --role server-bot --env-file .runtime/server-bot.env
node scripts/runtime-env-check.js --role delivery-agent --env-file .runtime/delivery-agent.env
npm test
npm run lint:text
```

## Reading Rule

- if a claim is backed by code path, test, and artifact, treat it as `verified`
- if a claim is backed by code only, treat it as `implemented`
- if a claim depends on SCUM client state, Windows session state, Discord/Guild state, or other external infrastructure, treat it as `runtime-dependent`
- if a process is merely `online` but still emits startup/config/runtime warnings, treat it as `online with caveats`, not clean proof

## Current Local Runtime Notes

On this workstation as of `2026-04-03`:

- local PostgreSQL is reachable at `127.0.0.1:55432`
- PostgreSQL Prisma client generation was rerun successfully through `scripts/prisma-with-provider.js`
- `npm run platform:schema:upgrade` completed successfully
- `pm2` reports these runtimes `online`:
  - `scum-owner-web`
  - `scum-tenant-web`
  - `scum-admin-web`
  - `scum-bot`
  - `scum-worker`
  - `scum-watcher`
  - `scum-console-agent` (`Delivery Agent` runtime key)
  - `scum-server-bot`
  - `scum-web-portal`
- local admin web is reachable and `POST /admin/api/login` returned `200 OK`
- local owner web is reachable at `127.0.0.1:3201/healthz`
- local tenant web is reachable at `127.0.0.1:3202/healthz`
- `scum-bot` health returned `ok=true` with `discordReady=true`
- `scum-watcher` health returned `ready=true` and current log-path metadata
- `scum-server-bot` health returned `ready=true`, `status=ready`, and recent successful job completion data
- `scum-web-portal` health returned `200 OK`
- `deep-role-audit.js` passed for `Owner` and `Tenant` without `consoleErrors` / `pageErrors`
- `player-capture-verify.js` passed and confirmed the player home/shop/orders workbench shell
- runtime installer smoke for `install-server-bot.ps1` and `install-delivery-agent.ps1` completed successfully on this workstation
- `pm2 save` was rerun after the latest runtime recovery and browser-audit pass

## 2026-04-03 Repo-Local Closeout

As of `2026-04-03`, the current workstation branch includes the latest repo-local closeout work and has been pushed to:

- branch: `codex/local-runtime-finish`
- commit: `d449dd4`

Treat the items below as closed at repo level on this branch:

- core data and identity consistency:
  - preview identity state now derives from the centralized platform identity summary
  - linked account summary now reflects email, Discord, Steam, and player-match state more consistently
- commercial and runtime productization:
  - billing webhook replay handling is idempotent at the repo layer
  - product-facing runtime wording now uses `Delivery Agent` while retaining `console-agent` as the compatibility runtime key
- surface polish:
  - owner commercial/support views, tenant runtime wording, and player-facing runtime/shop wording were aligned with the current product model
- security and readiness sweep:
  - tenant-scope mismatch attempts now emit explicit security signals
  - repo-local regression sweep completed with `npm test`
  - repo-local text and encoding checks completed with `npm run lint:text`
- delivery audit restore hardening:
  - delivery-audit replace/restore paths now dedupe and upsert safely
  - snapshot preview/restore counts now use logical unique delivery-audit rows

## Current Local Caveats

- `scum-server-bot` is healthy now, but treat this as machine-specific proof, not universal deploy proof
- admin DB login is verified locally, but Discord admin SSO was not counted as verified in this round because the current guild role export does not prove the configured owner/admin/moderator mapping

## Current Repo-Ready Scope Closed In This Round

The current branch/workstation baseline now also includes repo-side completion of the main SaaS-readiness phase plan. Treat the items below as `implemented` at repo level and `verified` where backed by the tests and local browser/runtime checks already listed in this file:

- billing and entitlement hardening:
  - normalized package metadata
  - subscription-state-aware entitlement enforcement
  - tenant billing view with current plan, status, expiry, and upgrade path
- tenant action completion:
  - dashboard quick actions
  - action-driven runtime/config/restart/order/support surfaces
- tenant onboarding:
  - six-step checklist driven by real runtime/config/package state
- runtime provisioning UX hardening:
  - clearer runtime status
  - reissue/reset/revoke flows
  - runtime-level management entry points
- queue and support visibility:
  - config job listing
  - retry flow
  - tenant `Logs & Sync` recovery surface
- logging, audit, and notifications:
  - tenant-scoped notifications
  - config failure, restart result, and subscription-expiring notifications
- security P0 hardening:
  - critical action rate limiting
  - stricter validation on runtime/config/delivery mutation routes
- player monetization and public tenant routes:
  - supporter/community view in player donations
  - tenant public slug routes `/s/:slug`, `/stats`, `/shop`, `/events`, `/donate`

## Prior Repository-Local Evidence Still Relevant

Earlier repository-local validation from the March 2026 hardening rounds is still relevant where it is backed by artifacts and tests:

- repo text and encoding checks
- tenant topology routing tests
- watcher / console-agent proof on this workstation
- native delivery proof matrices already captured in `docs/assets/`
- browser validation artifacts under `output/playwright/`

Treat those as historical repo/workstation evidence, not as a substitute for today's live runtime status.

## What This File Still Does Not Prove

- full Discord OAuth callback completion with a real external login session
- admin Discord SSO role assignment on the current live guild
- a clean production log set for every runtime after the latest PM2 boot
- a full player-portal end-to-end journey on the current workstation after the latest restart
- provider-grade billing lifecycle operations such as live webhook idempotency, renew/fail/cancel recovery, and customer billing-portal behavior
- full live proof of the newer donation/supporter, raid, module/plugin, and public slug product flows across multiple real tenants
- a second verified tenant-topology environment or a `database-per-tenant` deployment
- behavior on another workstation without the same Windows session, SCUM client, `SCUM.db`, and `SCUM.log` paths
