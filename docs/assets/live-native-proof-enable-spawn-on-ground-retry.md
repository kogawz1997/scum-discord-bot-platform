# Live Native Proof Matrix

Captured on: `2026-03-17T05:11:32.706Z`

steamId: `76561199274778326`
executionMode: `agent`
nativeProofMode: `required`

## Delivery Class Summary

- `consumable`: 0/1 cases proved | expected: baseline-delta or world-spawn-delta
- `weapon`: 1/1 cases proved | expected: baseline-delta or world-spawn-delta

## Cases

### retry-water

- gameItemId: `Water_05l`
- quantity: `1`
- deliveryClass: `consumable`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `baseline-delta or world-spawn-delta`
- verificationOk: `false`
- nativeProofOk: `false`
- code: `DELIVERY_NATIVE_PROOF_TIMEOUT`
- proofType: `external-script`
- strategy: `-`
- notes: Retry under EnableSpawnOnGround=True with extended proof timeout.
- detail: Native delivery proof timed out after 60000ms
- commandSummary: `#SpawnItem Water_05l 1`

### retry-weapon-m1911

- gameItemId: `Weapon_M1911`
- quantity: `1`
- deliveryClass: `weapon`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `baseline-delta or world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Retry under EnableSpawnOnGround=True with extended proof timeout.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Weapon_M1911 1`
