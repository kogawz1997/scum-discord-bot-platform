# Verification Status

This file summarizes repository verification status without hardcoding test counts in many places.

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

Commands used on this workstation:

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

## Reading Rule

- if a claim is backed by code path, test, and artifact, treat it as `verified`
- if a claim is backed by code only, treat it as `implemented`
- if a claim depends on SCUM client state, Windows session state, or external infrastructure, treat it as `runtime-dependent`

## Current Local Runtime Notes

On this workstation as of `2026-03-17`:

- watcher is `ready` against the real `SCUM.log`
- console-agent is `ready` and preflight passes against the live `SCUM` window
- one live agent command was observed in `SCUM.log`
- one live native delivery proof matrix was observed from `SCUM.db` for `Water_05l`, `Weapon_M1911`, `Magazine_M1911`, and `Weapon_AK47`

Summary evidence:

- [assets/live-runtime-evidence.md](./assets/live-runtime-evidence.md)

## What This File Still Does Not Prove

- native proof coverage for every delivery item type or every SCUM server configuration
- full database-per-tenant isolation beyond the current PostgreSQL RLS strict foundation and topology routing
- behavior on another workstation without the same Windows session, SCUM client, `SCUM.db`, and `SCUM.log` paths
