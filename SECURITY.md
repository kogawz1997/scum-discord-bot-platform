# Security Policy

Language:

- English: `SECURITY.md`
- Thai: [SECURITY_TH.md](./SECURITY_TH.md)

## Reporting

For security issues, do not open a public issue with secrets, tokens, database URLs, or exploit details.

Report by sending:

- affected component
- environment scope
- reproduction steps
- impact estimate
- any logs with secrets redacted

If the issue is in a live deployment, rotate affected secrets first.

## Repository Security Expectations

- do not commit `.env` files, backups, key files, or dumped secrets
- run `npm run security:scan-secrets` before push
- run `npm run security:check` before production changes
- keep `ADMIN_WEB_2FA_ENABLED=true` and `ADMIN_WEB_STEP_UP_ENABLED=true` in production
- keep `PERSIST_REQUIRE_DB=true` and `PERSIST_LEGACY_SNAPSHOTS=false` in production

## Supported Runtime Baseline

Current supported baseline for production reviews:

- Node.js 20+
- PostgreSQL runtime path
- split-origin admin/player deployment
- CI verification and smoke checks available

## Scope Notes

This repository contains:

- admin web
- player portal
- Discord bot
- worker runtime
- watcher runtime
- optional console-agent

Security review should consider cross-runtime boundaries, not only the bot process.
