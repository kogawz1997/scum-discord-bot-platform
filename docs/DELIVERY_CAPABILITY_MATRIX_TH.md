# Delivery Capability Matrix

This document states which delivery features use `RCON`, which require `agent mode`, and what proof exists after execution.

| Capability                  | RCON    | Agent mode | Verification / Fallback                        | Evidence                       |
| --------------------------- | ------- | ---------- | ---------------------------------------------- | ------------------------------ |
| queue / retry / dead-letter | yes     | yes        | shared queue state                             | audit + timeline               |
| preflight before enqueue    | partial | required   | agent failure can block or fail over by policy | audit + preflight report       |
| teleport to player          | no      | yes        | no RCON equivalent for the same workflow       | timeline + outputs             |
| teleport to vehicle target  | no      | yes        | same as above                                  | timeline + outputs             |
| spawn item                  | yes     | yes        | native proof and command-log proof available   | outputs + evidence bundle      |
| multi-item / bundle         | yes     | yes        | step-by-step verification path                 | step log + evidence bundle     |
| magazine `StackCount`       | yes     | yes        | same delivery verifier                         | preview + outputs              |
| post-spawn verification     | partial | yes        | retry / dead-letter on proof failure           | verify audit + evidence bundle |
| capability test / simulate  | yes     | yes        | no proof required                              | simulator + preview            |
| command template override   | yes     | yes        | no proof required                              | audit trail                    |

## Per-order runtime metadata

- `executionMode`
- `backend`
- `commandPath`
- `retryCount`

## Per-order evidence bundle

- `deliveryAudit`
- `statusHistory`
- `timeline`
- `stepLog`
- `latestOutputs`
- `evidence` bundle per `purchaseCode`

## Native proof status

- `DELIVERY_NATIVE_PROOF_MODE=required` is active on this workstation
- the first-party backend now reads `SCUM.db` directly
- proof can succeed through either:
  - inventory delta
  - world-spawn delta
- live proof on this workstation was confirmed with `#SpawnItem Water_05l 1`, `#SpawnItem Weapon_M1911 1`, `#SpawnItem Magazine_M1911 1 StackCount 100`, and `#SpawnItem Weapon_AK47 1`
- `Ammo_762` currently has a generic command fallback but is still experimental on this workstation because native proof does not confirm a matching game-state delta yet
- broader proof coverage across all item classes is still incomplete

## Main files

- `src/services/rconDelivery.js`
- `src/services/deliveryNativeProof.js`
- `src/services/deliveryNativeInventoryProof.js`
- `src/store/deliveryAuditStore.js`
- `src/store/deliveryEvidenceStore.js`
- `src/services/scumConsoleAgent.js`
- `scripts/delivery-native-proof-scum-savefile.js`

## Main tests

- `test/rcon-delivery.integration.test.js`
- `test/delivery-native-inventory-proof.test.js`
- `test/admin-api.integration.test.js`

## Current policy

- `agent mode` always runs preflight before enqueue
- if the agent is not ready and policy allows failover, runtime can switch to `RCON`
- verify failure still routes to retry / dead-letter by policy
- when native proof is enabled, the delivery pipeline calls the native verifier and attaches state evidence
- idempotency guard still prevents duplicate success handling
