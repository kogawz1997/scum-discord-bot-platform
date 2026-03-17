# Worklist

This file is the source of truth for work that is still open after the current validation pass.

Repo-side review and hardening backlog is closed for the current bar. The remaining items are broader runtime coverage and architecture rollout, not failing repo validation.

## Status Labels

- `partial`: implemented for the current surface, but not rolled out everywhere
- `runtime-blocked`: depends on live infrastructure outside the repo
- `deferred`: valid future work, but not required for the current validation bar

## Open Items

### 1. Expand tenant DB topology beyond the current migrated surface

- Status: `partial`
- Current state:
  - PostgreSQL RLS strict mode is active for the current tenant-scoped surface
  - tenant DB topology resolver and provisioning exist for `shared`, `schema-per-tenant`, and `database-per-tenant`
  - tenant-aware platform, tenant-config, purchase/admin-commerce, shop, delivery persistence, player/account-wallet paths, and community/admin stores already route through tenant-scoped Prisma targets when tenant context is present or a default tenant is configured
- What is still open:
  - the whole application is not migrated to `schema-per-tenant` or `database-per-tenant`
  - shared/global/admin paths still remain on the shared datasource unless explicitly migrated
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
- Acceptance:
  - choose the long-term topology target
  - migrate the remaining tenant-aware runtime paths onto that topology
  - document the operational consequences of the selected model

### 2. Expand native delivery proof coverage beyond the current workstation matrix

- Status: `runtime-blocked`
- Current state:
  - native proof reads live `SCUM.db` state on this workstation
  - current live matrix is captured under [assets/live-native-proof-matrix.md](./assets/live-native-proof-matrix.md) and [assets/live-native-proof-matrix.json](./assets/live-native-proof-matrix.json)
  - representative live proof is verified for `Water_05l`, `Weapon_M1911`, `Magazine_M1911`, and `Weapon_AK47`
  - experimental cases that currently do not prove out on this workstation are tracked separately in [assets/live-native-proof-experimental-cases.json](./assets/live-native-proof-experimental-cases.json)
  - proof remains game-state based through inventory/world-spawn delta, not just command-log evidence
- What is still open:
  - broader coverage across more delivery classes
  - broader coverage across more SCUM server configurations
  - broader coverage across more than one workstation/runtime
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
