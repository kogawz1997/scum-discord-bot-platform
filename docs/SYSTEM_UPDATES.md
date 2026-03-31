# SYSTEM_UPDATES

Last updated: **2026-03-31**

This file records the latest repository and workstation update in a short, operational format. For the full status register, see [../PROJECT_HQ.md](../PROJECT_HQ.md).

## Latest Update Round

### Newly Revalidated On This Workstation

- Regenerated the Prisma client for `postgresql` through `scripts/prisma-with-provider.js`
- Started local PostgreSQL and confirmed `127.0.0.1:55432` is reachable
- Ran `npm run platform:schema:upgrade` successfully
- Started the PM2 runtime profile and rechecked the main processes
- Revalidated `POST /admin/api/login` on `http://127.0.0.1:3200/admin`
- Revalidated the health endpoints for `scum-bot` and `scum-server-bot`

### Current Runtime Status

Currently online on this workstation:

- `scum-admin-web`
- `scum-bot`
- `scum-worker`
- `scum-watcher`
- `scum-console-agent`
- `scum-server-bot`
- `scum-web-portal`

Important caveats:

- `scum-bot` is online and Discord login succeeds, but the log still contains production-guard and schema-alignment warnings
- `scum-web-portal` is online, but still logs optional player-data failures around `lucky-wheel-config`
- `scum-server-bot` health is currently `ready=true`, but earlier local starts failed until control-plane URL and token settings were corrected

## Completed In This Documentation Round

- Updated the main status documents to match the actual runtime state of `2026-03-31`
- Split "repo capability" from "current machine proof" more clearly
- Replaced the previously garbled `docs/SYSTEM_UPDATES.md` content with a clean current summary

## Ready To Use Now

- local PostgreSQL runtime
- admin web plus admin DB login
- bot health endpoint plus Discord-ready state
- server-bot health endpoint plus sync/config polling state
- worker, watcher, and console-agent PM2 processes

## Still Needs Fixes Or Follow-up

- make `scum-bot` boot cleanly on the current production profile
- resolve `ControlPlaneServer` schema/state alignment
- fix the player-portal `normalizeHttpUrl` warning path
- revalidate Discord admin SSO against a guild with the intended role mapping
- continue the larger product-readiness tracks:
  - billing / commercial lifecycle
  - unified identity
  - persistence normalization
  - donation / modules / raid / analytics
  - i18n / UX polish

## Commands Used Frequently After This Update

```bash
npm run lint
npm test
npm run doctor
npm run security:check
npm run readiness:prod
npm run smoke:postdeploy
npm run platform:schema:upgrade
pm2 describe scum-admin-web
pm2 describe scum-bot
pm2 describe scum-server-bot
```
