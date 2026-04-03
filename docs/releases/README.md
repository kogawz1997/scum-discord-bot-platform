# Release Notes

Language:

- English: `README.md`
- Thai: [README_TH.md](./README_TH.md)

This folder contains per-version release notes.

Difference from [CHANGELOG.md](../../CHANGELOG.md):

- `CHANGELOG.md` is the accumulated change record tied to release automation
- release notes in this folder summarize operator impact, review notes, limits, and deployment conditions for a specific version

Current entries:

- [TEMPLATE](./TEMPLATE.md)
- [v1.0.0](./v1.0.0.md)

Guardrail:

- `npm run check:release-notes` verifies that `docs/releases/v<package-version>.md` exists for the current `package.json` version

