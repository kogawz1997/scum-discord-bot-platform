# Contributing

Language:

- English: `CONTRIBUTING.md`
- Thai: [CONTRIBUTING_TH.md](./CONTRIBUTING_TH.md)

## Ground Rules

- keep changes aligned with the current architecture and runtime model
- do not commit secrets, `.env` files, key files, or backups
- prefer evidence-backed claims in docs
- avoid changing production behavior without tests or a clear rollback note

## Before You Open A PR

Run:

```bash
npm run lint
npm run test:policy
npm test
npm run doctor
npm run security:check
```

If markdown, JSON, or workflow files changed, normalize them with:

```bash
npm run format:write
```

If the change affects deployed runtime behavior, also run:

```bash
npm run readiness:prod
```

## Documentation Expectations

Update docs when you change:

- runtime topology
- production validation flow
- env/config requirements
- migration or restore behavior
- tenant boundaries

Prefer updating:

- [README.md](./README.md)
- [PROJECT_HQ.md](./PROJECT_HQ.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/CONFIG_MATRIX.md](./docs/CONFIG_MATRIX.md)

## Testing Expectations

Add or update tests for:

- policy boundaries
- tenant boundaries
- config mutation safety
- migration / restore behavior
- runtime health or smoke behavior

If you add new config or bootstrap boundary modules, also keep `npm run check:jsdoc` green.

## PR Notes

Include:

- what changed
- why it changed
- what was verified
- what remains runtime-dependent
