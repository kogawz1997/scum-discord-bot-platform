# Worklist

This file is the source of truth for work that is still open after the current validation pass.

Repo-side review and hardening backlog is closed for the current bar. The remaining item is runtime evidence coverage, not failing repo validation.

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
