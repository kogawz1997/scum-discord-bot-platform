# Live Native Proof Matrix

Captured on: `2026-03-17T03:57:31.391Z`

steamId: `76561199274778326`
executionMode: `agent`
nativeProofMode: `required`

## Delivery Class Summary

- `consumable`: 1/1 cases proved | expected: world-spawn-delta
- `weapon`: 2/2 cases proved | expected: world-spawn-delta
- `magazine`: 1/1 cases proved | expected: world-spawn-delta
- `medical`: 1/1 cases proved | expected: world-spawn-delta
- `food`: 1/1 cases proved | expected: world-spawn-delta
- `gear`: 1/1 cases proved | expected: world-spawn-delta
- `ammo`: 1/1 cases proved | expected: world-spawn-delta
- `teleport wrapper profiles`: 2/2 cases proved | expected: world-spawn-delta

## Cases

### consumable-water

- gameItemId: `Water_05l`
- quantity: `1`
- deliveryClass: `consumable`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative drink/consumable spawn on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Water_05l 1`

### weapon-m1911

- gameItemId: `Weapon_M1911`
- quantity: `1`
- deliveryClass: `weapon`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative sidearm weapon spawn on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Weapon_M1911 1`

### magazine-m1911

- gameItemId: `Magazine_M1911`
- quantity: `1`
- deliveryClass: `magazine`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative magazine spawn with StackCount handling.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Magazine_M1911 1 StackCount 100`

### weapon-ak47

- gameItemId: `Weapon_AK47`
- quantity: `1`
- deliveryClass: `weapon`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative rifle weapon spawn on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Weapon_AK47 1`

### medical-bandage

- gameItemId: `Emergency_bandage`
- quantity: `1`
- deliveryClass: `medical`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative medical supply spawn on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Emergency_bandage 1`

### food-bakedbeans

- gameItemId: `BakedBeans`
- quantity: `1`
- deliveryClass: `food`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative food spawn on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem BakedBeans 1`

### gear-backpack

- gameItemId: `Backpack_02_01`
- quantity: `1`
- deliveryClass: `gear`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative wearable/container gear spawn on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Backpack_02_01 1`

### ammo-ammobox-762

- gameItemId: `Cal_7_62x39mm_Ammobox`
- quantity: `1`
- deliveryClass: `ammo`
- deliveryProfile: `spawn_only`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative ammo proof on this workstation uses the ammobox class because loose-round IDs do not produce a confirmed SCUM.db delta here.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#SpawnItem Cal_7_62x39mm_Ammobox 1`

### teleport-wrapper-m1911

- gameItemId: `Weapon_M1911`
- quantity: `1`
- deliveryClass: `teleport wrapper profiles`
- deliveryProfile: `teleport_spawn`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative teleport wrapper profile proved through spawned item state on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#TeleportTo "CokeTAMTHAI" | #SpawnItem Weapon_M1911 1`

### announce-teleport-bandage

- gameItemId: `Emergency_bandage`
- quantity: `1`
- deliveryClass: `teleport wrapper profiles`
- deliveryProfile: `announce_teleport_spawn`
- expectedProofStrategy: `world-spawn-delta`
- verificationOk: `true`
- nativeProofOk: `true`
- code: `READY`
- proofType: `inventory-state`
- strategy: `world-spawn-delta`
- notes: Representative announce+teleport wrapper profile proved through spawned item state on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#Announce Delivering Announce Teleport Bandage to CokeTAMTHAI | #TeleportTo "CokeTAMTHAI" | #SpawnItem Emergency_bandage 1`
