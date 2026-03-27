# Delivery Native Proof Coverage

This document explains which game-state proof strategy is expected per delivery class and delivery profile.

The native verifier in [src/services/deliveryNativeInventoryProof.js](../src/services/deliveryNativeInventoryProof.js) can currently report three strategy outcomes:

- `baseline-delta`: pre/post inventory state proves the expected items were added during this run.
- `world-spawn-delta`: spawned entity rows after the captured baseline prove the expected items were created during this run.
- `recent-spawned`: weaker fallback observation only. Do not treat this as representative native-proof coverage.

## Repo-side Validation Contract

The repo now treats multi-environment native proof as an explicit validation contract, not just a loose evidence folder.

- [scripts/run-live-native-proof-matrix.js](../scripts/run-live-native-proof-matrix.js) can now write a matrix run, update the environment registry entry for a target environment, and rebuild the shared coverage summary artifacts in one flow
- [scripts/build-native-proof-coverage-report.js](../scripts/build-native-proof-coverage-report.js) now evaluates whether the registered environments satisfy the repo's multi-environment coverage contract
- [docs/assets/live-native-proof-coverage-summary.json](./assets/live-native-proof-coverage-summary.json) and [docs/assets/live-native-proof-coverage-summary.md](./assets/live-native-proof-coverage-summary.md) are the machine-readable and operator-readable outputs of that contract

This closes the repo-side workflow gap. It does **not** mean the repo can fabricate live second-environment evidence by itself.

## Current Workstation Coverage

Current representative cases are defined in [docs/assets/live-native-proof-cases.json](./assets/live-native-proof-cases.json).

Live evidence and environment tracking are captured in:

- [docs/assets/live-native-proof-matrix.md](./assets/live-native-proof-matrix.md)
- [docs/assets/live-native-proof-wrapper-matrix.md](./assets/live-native-proof-wrapper-matrix.md)
- [docs/assets/live-native-proof-environments.json](./assets/live-native-proof-environments.json)
- [docs/assets/live-native-proof-coverage-summary.md](./assets/live-native-proof-coverage-summary.md)
- [docs/assets/live-native-proof-coverage-summary.json](./assets/live-native-proof-coverage-summary.json)
- [docs/assets/live-native-proof-experimental-cases.json](./assets/live-native-proof-experimental-cases.json)

The current verified environment is the local workstation only. Pending environment targets are tracked in `live-native-proof-environments.json` and summarized in the coverage summary files above.

The coverage summary now also carries a validation block that answers, in one place, whether the currently registered environments satisfy the repo's multi-environment acceptance bar.

## Delivery Class Matrix

| Delivery class              | Representative cases                                  | Delivery profile                            | Expected strategy                                                                                                           | Current workstation status                                                                                                  |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `consumable`                | `Water_05l`                                           | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved                                                                                                                      |
| `food`                      | `BakedBeans`                                          | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved                                                                                                                      |
| `medical`                   | `Emergency_bandage`                                   | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved                                                                                                                      |
| `weapon`                    | `Weapon_M1911`, `Weapon_AK47`                         | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved                                                                                                                      |
| `magazine`                  | `Magazine_M1911`                                      | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved                                                                                                                      |
| `gear`                      | `Backpack_02_01`                                      | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved                                                                                                                      |
| `ammo`                      | `Cal_7_62x39mm_Ammobox`                               | `spawn_only`                                | `world-spawn-delta`                                                                                                         | proved; loose-round IDs `Ammo_762` and `Cal_7_62x39mm` still do not produce a confirmed `SCUM.db` delta on this workstation |
| `teleport wrapper profiles` | `teleport-wrapper-m1911`, `announce-teleport-bandage` | `teleport_spawn`, `announce_teleport_spawn` | prove the spawned item with `baseline-delta` or `world-spawn-delta`; use command/audit evidence for teleport/announce steps | proved                                                                                                                      |
| `non-item delivery classes` | coins, VIP, ledger-only rewards                       | n/a                                         | native SCUM item proof is not applicable; use wallet, purchase, and audit evidence                                          | out of scope for SCUM.db item proof                                                                                         |

## Operator Guidance

- Use `baseline-delta` when the server configuration inserts the delivered item directly into the prisoner inventory and the pre/post inventory snapshot changes cleanly.
- Use `world-spawn-delta` when the delivery creates spawned entity rows after the captured baseline cursor. This is the strategy currently proved on this workstation for the representative item classes above.
- Treat `recent-spawned` as diagnostic only. It is useful for troubleshooting but it is not strong enough to claim native proof coverage.
- For `teleport_spawn` and `announce_teleport_spawn`, the teleports and announcements are wrapper steps. The native proof target is still the spawned item, not the teleport itself.
- Do not use command logs alone as proof. A successful claim still requires game-state evidence from `SCUM.db`.

## What Is Still Runtime-Blocked

- loose-round ammo IDs `Ammo_762` and `Cal_7_62x39mm` still do not produce a confirmed `SCUM.db` delta on this workstation, even though representative ammo coverage now passes via `Cal_7_62x39mm_Ammobox`
- more server configurations must be sampled because strategy selection can change with SCUM patch level and server behavior
- more than one workstation/runtime must be sampled before claiming environment-independent coverage
- item IDs without a passing representative case on this workstation remain experimental until a live matrix capture proves them

## Multi-Environment Completion Checklist

Do not mark native proof as "complete across environments" until all of the following are true:

1. one baseline environment has a current representative matrix
2. one additional SCUM server configuration has a full verified matrix, not just a partial sample
3. one additional workstation/runtime has a verified matrix capture
4. each target environment has:
   - environment metadata in `docs/assets/live-native-proof-environments.json`
   - matrix output in `docs/assets/live-native-proof-*.md`
   - machine-readable summary in `docs/assets/live-native-proof-*.json`
5. at least one representative case exists for every delivery class you claim to support there

Repo note:

- the checklist above is now enforced by repo-side tooling and coverage summaries
- the remaining work is to run the capture flow on the missing environments and commit the resulting evidence honestly

## Practical Acceptance

For operator sign-off, keep the acceptance bar simple:

- proof must remain game-state based
- command logs alone are not enough
- a second environment must be independently repeatable by another operator
- if an environment only has partial or experimental evidence, document it as partial instead of passing
