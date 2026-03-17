# Live Native Proof Matrix

Captured on: `2026-03-17T03:38:49.454Z`

steamId: `76561199274778326`
executionMode: `agent`
nativeProofMode: `required`

## Delivery Class Summary

- `teleport wrapper profiles`: 2/2 cases proved | expected: world-spawn-delta

## Cases

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
- notes: Teleport wrapper profile proved through native item state on the current workstation.
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
- notes: Announce+teleport wrapper profile proved through native item state on the current workstation.
- detail: Game-state proof matched 1/1 expected item classes using post-baseline spawned entity delta
- commandSummary: `#Announce Delivering Announce Teleport Bandage to CokeTAMTHAI | #TeleportTo "CokeTAMTHAI" | #SpawnItem Emergency_bandage 1`
