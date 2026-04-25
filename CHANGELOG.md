# Changelog

Language:

- English: `CHANGELOG.md`
- Thai: [CHANGELOG_TH.md](./CHANGELOG_TH.md)

All notable changes to this project will be documented in this file.

Operator-facing release notes live under `docs/releases/` and are written separately from this changelog.

The release process is automated through GitHub Actions and release tagging.
See `.github/workflows/release.yml` for the source of truth.

## [1.1.0](https://github.com/kogawz1997/scum-discord-bot-platform/compare/scum-th-platform-v1.0.0...scum-th-platform-v1.1.0) (2026-04-25)


### Features

* i18n locale files, billing expiry sweeper, owner UI sweep action ([3c972f3](https://github.com/kogawz1997/scum-discord-bot-platform/commit/3c972f376e155bc78b8e737e668af6cb89d2a389))

## [Unreleased]

- CI verification now publishes workflow-backed status artifacts instead of relying on hardcoded test counts in docs.
- `ci:verify` now runs with a deterministic test-safe env overlay, so local verification no longer depends on the current `.env`.
- Added env profile preparation scripts for development, test, and production.
- Updated test env overlays to use split-runtime topology defaults and stronger non-placeholder admin token values.
- Added local smoke stack automation for clean-room CI installs.
- Added delivery capability matrix, DB migration path notes, ADR, and evidence bundle support per order.
- Extended secret scanning to allow tracked profile example env files while keeping generated split env files and backup files blocked.
- Tightened git hooks so `pre-push` scans the whole repo, not just currently staged files.
