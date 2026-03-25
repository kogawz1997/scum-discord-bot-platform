# Fix Master List Status

Last updated: `2026-03-25`

This document maps the original `fix.txt` master list from [../artifacts/root-quarantine/2026-03-20/fix.txt](../artifacts/root-quarantine/2026-03-20/fix.txt) to the current repository state.

Use this file when the question is "how far have we gone against the original fix master list?" rather than "what still fails the current repo validation bar?"

## Status Labels

- `Closed`: repo-local foundations are in place for the current workstation bar
- `Partial`: meaningful repo-local work exists, but the item is not complete
- `Runtime-blocked`: cannot be closed from the repo alone; needs live infrastructure or external runtime proof
- `Deferred`: valid later work, but not a rational gate for the current baseline

## Phase A - Core Critical

| #   | Item                                     | Status            | Current read                                                                                                                                                                                                 |
| --- | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Reduce console-agent dependency          | `Partial`         | Health classification, preflight diagnostics, auto-restart telemetry, and fallback guidance exist, but execution still depends on a real Windows session and SCUM client window.                             |
| 2   | Complete tenant isolation across the app | `Closed`          | The workstation baseline is already `schema-per-tenant`, tenant-aware paths route through topology-aware Prisma targets, and the repo now treats this as the standard multi-tenant deployment target.        |
| 3   | Expand native proof across environments  | `Runtime-blocked` | Representative native proof is strong on this workstation, but a fully verified second server configuration and second workstation/runtime capture are still open.                                           |
| 4   | Production-grade restore / rollback      | `Partial`         | Restore preview, verification, rollback state, and guarded maintenance flow exist, but full automated disaster recovery still requires more maturity and live drills.                                        |
| 5   | Centralized config control through admin | `Partial`         | Admin now exposes a broad env catalog with policy/apply metadata, validation, restart guidance, audit, and owner-facing Discord admin-log language control, but not every env/config switch is surfaced yet. |

## Phase B - Production Hardening

| #   | Item                            | Status    | Current read                                                                                                                                                                                                        |
| --- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Delivery analytics / metrics    | `Partial` | Queue visibility, lifecycle reporting, and operator guidance exist, but richer per-item, per-server, and latency analytics are still incomplete.                                                                    |
| 7   | Admin operational tools         | `Partial` | Support bundles, lifecycle planner, diagnostics export, and restart/maintenance presets exist, but the full bulk-retry/selective-resend/stuck-order toolkit is not complete.                                        |
| 8   | API / data contract consistency | `Partial` | Contract helpers and serialization fixes exist, but the whole product is not yet normalized under one response/error/versioning scheme.                                                                             |
| 9   | Real observability              | `Partial` | Health, doctor, readiness, smoke, admin runtime views, and owner observability workbenches exist, but a mature metrics/alert/dashboard posture is still short of a harder ops bar.                                  |
| 10  | Security hardening              | `Partial` | DB login, Discord SSO, TOTP 2FA, step-up, security events, secret rotation checks, repo hygiene checks, and runtime-data hygiene now exist, but broader abuse/rate-limit/rotation coverage is still not exhaustive. |

## Phase C - Product / UX / Commercial

| #   | Item                      | Status    | Current read                                                                                                                                                                                    |
| --- | ------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Admin UX polish           | `Partial` | Owner and tenant are now the primary role-separated surfaces, but deep operational pages still have density that can be refined further.                                                        |
| 12  | Player portal improvement | `Partial` | Login, landing, and post-login workbench flows are rebuilt and clearer, but broader engagement, notifications, and long-tail trust/profile UX are still open.                                   |
| 13  | Deployment simplification | `Partial` | Setup helpers, profiles, split-topology docs, and short-path bootstrap flows exist, but onboarding is not yet truly one-click across environments.                                              |
| 14  | Documentation polish      | `Partial` | Architecture, topology, env, evidence, runbook, operator, and fix-status docs exist and are current, but the docs set can still become tighter and easier for first-time operators.             |
| 15  | Commercial readiness      | `Partial` | Licensing, quota visibility, marketplace offers, onboarding docs, and support-case packaging exist, but a broader productized billing/commercial layer is still not the repo's strongest claim. |

## Phase D - Advanced

| #   | Item                      | Status     | Current read                                                                                                                                                      |
| --- | ------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | Performance tuning        | `Deferred` | Important later, but not the right gate for the current product baseline.                                                                                         |
| 17  | Smarter queue system      | `Partial`  | Queue lifecycle, dead-letter visibility, action planning, and poison/stuck guidance exist, but priority and adaptive queue behavior are still additive hardening. |
| 18  | Plugin / extension system | `Deferred` | Valid long-term extensibility work, not a practical current gate.                                                                                                 |
| 19  | Multi-region readiness    | `Deferred` | Distribution-scale work, not part of the current product baseline.                                                                                                |
| 20  | Automation / self-healing | `Partial`  | Managed restart automation, cooldown state, and guarded owner controls exist, but broader self-healing is still advanced follow-on work.                          |

## Practical Read

- Against the current repository validation bar, the required repo-local backlog is closed.
- The repository now also includes:
  - package-driven feature access resolution
  - one-time setup-token agent activation
  - device binding and long-lived scoped agent credentials
  - explicit read routes for package, feature, provisioning, device, and credential visibility
- The remaining hard blockers are runtime and infrastructure proof items, not missing local code edits.
- The strongest still-open `fix.txt` items are:
  1. console-agent dependency on Windows and SCUM session reality
  2. multi-environment native proof
  3. production-grade restore / rollback maturity
  4. broader centralized config coverage

## Related Documents

- [WORKLIST.md](./WORKLIST.md)
- [PRODUCT_READY_GAP_MATRIX.md](./PRODUCT_READY_GAP_MATRIX.md)
- [../PROJECT_HQ.md](../PROJECT_HQ.md)
- [CONFIG_MATRIX.md](./CONFIG_MATRIX.md)
