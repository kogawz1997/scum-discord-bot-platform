# Live Native Proof Matrix

Captured on: `2026-03-17T05:09:36.531Z`

steamId: `76561199274778326`
executionMode: `agent`
nativeProofMode: `required`

## Delivery Class Summary

- `consumable`: 0/1 cases proved | expected: baseline-delta or world-spawn-delta
- `weapon`: 0/1 cases proved | expected: baseline-delta or world-spawn-delta
- `magazine`: 1/1 cases proved | expected: baseline-delta or world-spawn-delta
- `ammo`: 1/1 cases proved | expected: baseline-delta or world-spawn-delta
- `teleport wrapper profiles`: 1/1 cases proved | expected: baseline-delta or world-spawn-delta

## Cases

### config-water

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
- notes: Alternate server configuration sample with EnableSpawnOnGround=True.
- detail: Native delivery proof timed out after 30000ms
- commandSummary: `#SpawnItem Water_05l 1`

### config-weapon-m1911

- gameItemId: `Weapon_M1911`
- quantity: `1`
- deliveryClass: `weapon`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `baseline-delta or world-spawn-delta`
- verificationOk: `false`
- nativeProofOk: `false`
- code: `DELIVERY_NATIVE_PROOF_TIMEOUT`
- proofType: `external-script`
- strategy: `-`
- notes: Alternate server configuration sample with EnableSpawnOnGround=True.
- detail: Native delivery proof timed out after 30000ms
- commandSummary: `#SpawnItem Weapon_M1911 1`

### config-magazine-m1911

- gameItemId: `Magazine_M1911`
- quantity: `1`
- deliveryClass: `magazine`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `baseline-delta or world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Alternate server configuration sample with EnableSpawnOnGround=True.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Magazine_M1911 1 StackCount 100`

### config-ammo-ammobox-762

- gameItemId: `Cal_7_62x39mm_Ammobox`
- quantity: `1`
- deliveryClass: `ammo`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `baseline-delta or world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Alternate server configuration sample with EnableSpawnOnGround=True.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Cal_7_62x39mm_Ammobox 1`

### config-announce-teleport-bandage

- gameItemId: `Emergency_bandage`
- quantity: `1`
- deliveryClass: `teleport wrapper profiles`
- deliveryProfile: `announce_teleport_spawn`
- expectedProofStrategy: `baseline-delta or world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Alternate server configuration sample with EnableSpawnOnGround=True.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#Announce Delivering Config Announce Teleport Bandage to CokeTAMTHAI | #TeleportTo "CokeTAMTHAI" | #SpawnItem Emergency_bandage 1`
