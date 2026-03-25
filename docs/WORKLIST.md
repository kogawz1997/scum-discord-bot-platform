# Worklist

This file is the source of truth for work that is still open after the current validation pass.

Last updated: `2026-03-25`

Repo-side review and hardening backlog is closed for the current bar. The remaining items below are runtime evidence and operator-maturity tracks, not failing repo validation.

## Status Labels

- `runtime-blocked`: depends on live infrastructure outside the repo
- `deferred`: valid future work, but not required for the current validation bar

## Recently Closed

### 1. Complete tenant DB topology routing across application service paths

- Status: `closed`
- Current state:
  - PostgreSQL RLS strict mode is active for the current tenant-scoped surface
  - tenant DB topology resolver and provisioning exist for `shared`, `schema-per-tenant`, and `database-per-tenant`
  - tenant-aware platform, tenant-config, purchase/admin-commerce, shop, delivery persistence, player/account-wallet, player portal, community/admin store, SCUM webhook, and guild-automation surfaces now route through tenant-scoped Prisma targets when tenant context is present or a default tenant is configured
  - provider-backed integration coverage now includes tenant-scoped player and community/admin store paths, admin boundary/dashboard aggregation, platform tenant config, and SCUM webhook/community automation routes in [../test/player-tenant-topology.integration.test.js](../test/player-tenant-topology.integration.test.js), [../test/community-tenant-topology.integration.test.js](../test/community-tenant-topology.integration.test.js), [../test/admin-tenant-boundary.integration.test.js](../test/admin-tenant-boundary.integration.test.js), [../test/admin-dashboard-audit-tenant-topology.integration.test.js](../test/admin-dashboard-audit-tenant-topology.integration.test.js), [../test/platform-tenant-config-service.integration.test.js](../test/platform-tenant-config-service.integration.test.js), and [../test/scum-webhook.integration.test.js](../test/scum-webhook.integration.test.js)
  - this workstation cut over to `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant` on `2026-03-17`; the live runtime now boots with default tenant `1259096998045421672`, provisions schema `tenant_1259096998045421672`, and passes `npm test` plus `node scripts/readiness-gate.js --production`
- Operational note:
  - repository target for multi-tenant deployments is `schema-per-tenant`; `database-per-tenant` remains supported for higher-isolation tiers, but is not the active runtime on this workstation
- Main files:
  - [docs/DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md)
  - [src/utils/tenantDbIsolation.js](../src/utils/tenantDbIsolation.js)
  - [src/utils/tenantDatabaseTopology.js](../src/utils/tenantDatabaseTopology.js)
  - [src/prisma.js](../src/prisma.js)
  - [src/services/platformService.js](../src/services/platformService.js)
  - [src/services/platformTenantConfigService.js](../src/services/platformTenantConfigService.js)
  - [src/services/purchaseService.js](../src/services/purchaseService.js)
  - [src/services/shopService.js](../src/services/shopService.js)
  - [src/services/deliveryPersistenceDb.js](../src/services/deliveryPersistenceDb.js)
  - [src/services/rconDelivery.js](../src/services/rconDelivery.js)

## Open Items

### 1. Expand native delivery proof coverage beyond the current workstation matrix

- Status: `runtime-blocked`
- Current state:
  - native proof reads live `SCUM.db` state on this workstation
  - current live matrices are captured under [assets/live-native-proof-matrix.md](./assets/live-native-proof-matrix.md), [assets/live-native-proof-matrix.json](./assets/live-native-proof-matrix.json), [assets/live-native-proof-wrapper-matrix.md](./assets/live-native-proof-wrapper-matrix.md), and [assets/live-native-proof-wrapper-matrix.json](./assets/live-native-proof-wrapper-matrix.json)
  - an alternate server-configuration sample with `EnableSpawnOnGround=True` is captured under [assets/live-native-proof-enable-spawn-on-ground-matrix.md](./assets/live-native-proof-enable-spawn-on-ground-matrix.md) and [assets/live-native-proof-enable-spawn-on-ground-retry.md](./assets/live-native-proof-enable-spawn-on-ground-retry.md), but it is still partial rather than a full second verified matrix
  - a same-workstation `rcon` runtime attempt is captured under [assets/live-native-proof-rcon-attempt.md](./assets/live-native-proof-rcon-attempt.md) and [assets/live-native-proof-rcon-attempt.json](./assets/live-native-proof-rcon-attempt.json); it is blocked by `ECONNREFUSED` on `127.0.0.1:27015`
  - environment tracking now exists under [assets/live-native-proof-environments.json](./assets/live-native-proof-environments.json), [assets/live-native-proof-coverage-summary.md](./assets/live-native-proof-coverage-summary.md), and [assets/live-native-proof-coverage-summary.json](./assets/live-native-proof-coverage-summary.json)
  - representative live proof is verified for `Water_05l`, `BakedBeans`, `Emergency_bandage`, `Weapon_M1911`, `Weapon_AK47`, `Magazine_M1911`, `Backpack_02_01`, `Cal_7_62x39mm_Ammobox`, and representative `teleport_spawn` / `announce_teleport_spawn` wrapper profiles
  - delivery-class coverage and operator guidance are documented in [DELIVERY_NATIVE_PROOF_COVERAGE.md](./DELIVERY_NATIVE_PROOF_COVERAGE.md)
  - the machine-readable case list now records delivery class, delivery profile, and expected proof strategy in [assets/live-native-proof-cases.json](./assets/live-native-proof-cases.json)
  - experimental cases that currently do not prove out on this workstation are tracked separately in [assets/live-native-proof-experimental-cases.json](./assets/live-native-proof-experimental-cases.json); repeated `2026-03-17` live attempts for loose-round IDs `Ammo_762` and `Cal_7_62x39mm` still did not yield a confirmed game-state delta, while `Cal_7_62x39mm_Ammobox` now passes as the representative ammo case
  - proof remains game-state based through inventory/world-spawn delta, not just command-log evidence
- What is still open:
  - a fully verified second SCUM server configuration, not just the partial `EnableSpawnOnGround=True` sample
  - a verified second workstation/runtime capture; the current same-workstation `rcon` attempt is blocked
- Main files:
  - [src/services/deliveryNativeProof.js](../src/services/deliveryNativeProof.js)
  - [src/services/deliveryNativeInventoryProof.js](../src/services/deliveryNativeInventoryProof.js)
  - [src/services/rconDelivery.js](../src/services/rconDelivery.js)
  - [scripts/delivery-native-proof-scum-savefile.js](../scripts/delivery-native-proof-scum-savefile.js)
  - [scripts/run-live-native-proof-matrix.js](../scripts/run-live-native-proof-matrix.js)
  - [docs/assets/live-runtime-evidence.md](./assets/live-runtime-evidence.md)
- Acceptance:
  - coverage is documented per delivery class
  - proof remains based on game state
  - operator docs explain where inventory delta vs world-spawn delta is expected

### 2. Reduce console-agent dependency to an operationally manageable baseline

- Status: `runtime-blocked`
- Current state:
  - the control plane, scoped agent registration, setup-token activation, device binding, and long-lived credential flow now exist in-repo
  - two-machine guidance is documented in [TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
  - classified health/preflight diagnostics, heartbeat/session tracking, and failover/circuit-breaker logic exist for the current console-agent boundary
  - execution still depends on a live Windows session and SCUM client window on the execution workstation
- What is still open:
  - repeated proof on more than one real execution workstation
  - operator evidence showing how the platform behaves through client/window interruption and recovery
  - a stronger non-interactive execution path, if the platform ever claims to remove this dependency
- Main files:
  - [src/integrations/scum/adapters/consoleAgentClient.js](../src/integrations/scum/adapters/consoleAgentClient.js)
  - [src/domain/agents/agentRegistryService.js](../src/domain/agents/agentRegistryService.js)
  - [src/domain/delivery/agentExecutionRoutingService.js](../src/domain/delivery/agentExecutionRoutingService.js)
  - [src/services/rconDelivery.js](../src/services/rconDelivery.js)
  - [docs/TWO_MACHINE_AGENT_TOPOLOGY.md](./TWO_MACHINE_AGENT_TOPOLOGY.md)
- Acceptance:
  - limitation remains documented honestly
  - machine-binding, scoped credentials, and heartbeat visibility stay intact
  - operator runbooks describe what "ready" evidence looks like

### 3. Mature restore / rollback from controlled tooling to repeatable operator recovery

- Status: `runtime-blocked`
- Current state:
  - restore preview, rollback backup, guarded maintenance gates, and operator-facing recovery phases exist
  - maturity ladder and rollback guidance are documented in [MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
- What is still open:
  - repeatable rehearsal evidence run by another operator
  - explicit recovery timing/SLO evidence on more than one environment
  - a stronger "restore under stress" story for production-grade incidents
- Main files:
  - [docs/MIGRATION_ROLLBACK_POLICY_TH.md](./MIGRATION_ROLLBACK_POLICY_TH.md)
  - [docs/OPERATIONS_MANUAL_TH.md](./OPERATIONS_MANUAL_TH.md)
  - [src/services/platformService.js](../src/services/platformService.js)
- Acceptance:
  - restore phases remain auditable
  - rollback prerequisites are documented
  - operator rehearsal evidence exists outside the repo

### 4. Expand centralized config control until the highest-value runtime keys are covered from admin

- Status: `runtime-blocked`
- Current state:
  - admin control now covers a broader env catalog, including sync/control-plane routing, delivery, webhook, and runtime ownership keys
  - current coverage is documented in [CONFIG_MATRIX.md](./CONFIG_MATRIX.md)
- What is still open:
  - full long-tail coverage of every env/config switch is still incomplete
  - some low-level topology/runtime keys remain intentionally runtime-only rather than safely editable from the web
  - production proof still needs operator validation that the covered set is enough for real environment changes without ad-hoc `.env` editing
- Main files:
  - [src/config/adminEditableConfig.js](../src/config/adminEditableConfig.js)
  - [docs/CONFIG_MATRIX.md](./CONFIG_MATRIX.md)
  - [docs/OPERATIONS_MANUAL_TH.md](./OPERATIONS_MANUAL_TH.md)
- Acceptance:
  - highest-value keys for runtime routing and control-plane ownership are covered
  - unsafe keys remain explicitly runtime-only
  - any remaining manual-only keys are documented, not hidden

## Deferred Process Items

### 3. Keep release notes current for future releases

- Status: `deferred`
- Current state:
  - release policy exists
  - release notes index and template exist
  - current release notes are already linked from the main docs
- What is still open:
  - future releases must keep following the policy
- Main files:
  - [docs/releases/README.md](./releases/README.md)
  - [docs/releases/TEMPLATE.md](./releases/TEMPLATE.md)
  - [docs/RELEASE_POLICY.md](./RELEASE_POLICY.md)
