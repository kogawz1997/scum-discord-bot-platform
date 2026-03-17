# Release Policy

This document defines how releases in this repository should be described and reviewed.

## Scope

This policy applies to:

- `CHANGELOG.md`
- automated releases created by `release-please`
- per-version notes in [`docs/releases/`](./releases)
- deployment and upgrade communication sent to operators or customers

## Versioning

The repository uses semantic versioning:

- `MAJOR`: breaking runtime, API, config, schema, or operational behavior
- `MINOR`: backward-compatible features, new admin/runtime capabilities, or new supported flows
- `PATCH`: backward-compatible fixes, hardening, test additions, or documentation corrections

Do not ship a release without deciding whether it is:

- config-neutral
- config-changing
- migration-required
- rollback-sensitive

## Required Release Notes Content

Every tagged release should have:

1. a generated entry in `CHANGELOG.md`
2. a per-version note in `docs/releases/`
3. upgrade notes when operators must change env, schema, topology, or runtime expectations

Each release note should state:

- what changed
- operator impact
- migration or restart requirements
- known limitations
- evidence or verification references
- runtime-dependent evidence scope when claims depend on live SCUM, Windows session state, `SCUM.db`, or `SCUM.log`

## Required Upgrade Flags

If a release changes any of the following, the note must state it explicitly:

- `.env` keys or required secrets
- Prisma schema or migration sequence
- runtime topology
- health/readiness/smoke expectations
- tenant boundary behavior
- delivery backend behavior

## Breaking Change Rules

Treat the release as breaking if it changes:

- public API contracts
- admin API contracts used by automation
- required env names or meanings
- schema assumptions that prevent direct rollback
- runtime ownership rules such as worker/bot role boundaries

## Evidence Standard

Release notes should link to at least one of:

- test file or test suite
- CI artifact
- smoke or readiness command
- migration or rollback runbook
- code path implementing the change

Avoid release notes that only restate intent without implementation evidence.

If a release note mentions native proof, watcher readiness, or console-agent behavior, it must also state whether the evidence is:

- current-workstation only
- reproduced on more than one workstation/runtime
- reproduced across more than one SCUM server configuration

## Review Checklist

Before merging a release-affecting PR, confirm:

- `npm run lint`
- `npm test`
- `npm run doctor`
- `npm run security:check`
- `npm run readiness:prod`

If the release changes deployed runtime behavior, also confirm:

- `npm run smoke:postdeploy`

## Related Files

- [CHANGELOG.md](../CHANGELOG.md)
- [docs/releases/README.md](./releases/README.md)
- [docs/releases/TEMPLATE.md](./releases/TEMPLATE.md)
- [docs/MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
