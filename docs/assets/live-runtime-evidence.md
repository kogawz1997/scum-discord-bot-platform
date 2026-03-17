# Live Runtime Evidence

Captured on: `2026-03-17`

This file records live runtime observations from the current workstation after the latest validation pass.

## Schema-Per-Tenant Runtime

Observed from the active runtime and PostgreSQL on `2026-03-17`:

- `TENANT_DB_TOPOLOGY_MODE=schema-per-tenant`
- `PLATFORM_DEFAULT_TENANT_ID=1259096998045421672`
- PostgreSQL schema `tenant_1259096998045421672` exists
- `npm test` and `node scripts/readiness-gate.js --production` passed after the cutover

Observed from runtime health and PostgreSQL:

- worker `healthz` stayed `ready=true` after the cutover
- `public."DeliveryAudit"` currently has `173` rows
- `tenant_1259096998045421672."DeliveryAudit"` currently has `201` rows
- recent tenant-schema delivery-audit rows include:
  - `failed` for `m1911-test` at `2026-03-17T08:29:53.601Z`
  - `worker-picked` for `m1911-test` at `2026-03-17T08:29:53.587Z`
  - `attempt` for `m1911-test` at `2026-03-17T08:29:53.580Z`

This is the current workstation evidence that live runtime writes are landing under the tenant schema rather than only the shared `public` schema.

## Console Agent

Observed via `http://127.0.0.1:3213/healthz`:

- `status=ready`
- `ready=true`
- `statusCode=READY`

Observed via `http://127.0.0.1:3213/preflight`:

- `resolvedWindowTitle="SCUM  "`
- `processId=60820`
- `switchToAdminChannel=true`

## Watcher

Observed via `http://127.0.0.1:3212/healthz`:

- `status=ready`
- `ready=true`
- `fileExists=true`
- `logPath=Z:\SteamLibrary\steamapps\common\SCUM Server\SCUM\Saved\Logs\SCUM.log`

The watcher health payload exposed a recent parsed command event:

```text
type=admin-command
playerName=CokeTAMTHAI
steamId=76561199274778326
command=Announce [OPS] watcher-proof-20260316-192047
```

## Live Agent Command

Live command sent through `POST http://127.0.0.1:3213/execute`:

```text
#Announce [OPS] watcher-proof-20260316-192047
```

The runtime returned:

- `ok=true`
- `accepted=true`
- `resolvedWindowTitle="SCUM  "`

The server log recorded the command:

```text
[2026.03.16-12.20.49:463][765]LogSCUM: '76561199274778326:CokeTAMTHAI(1)' Command: 'Announce [OPS] watcher-proof-20260316-192047'
```

## Live Native Delivery Proof

Native proof was executed against:

- `SCUM.log`: `Z:\SteamLibrary\steamapps\common\SCUM Server\SCUM\Saved\Logs\SCUM.log`
- `SCUM.db`: `Z:\SteamLibrary\steamapps\common\SCUM Server\SCUM\Saved\SaveFiles\SCUM.db`

Observed player:

- `steamId=76561199274778326`
- `playerName=CokeTAMTHAI`

Baseline state was captured from `SCUM.db`, then the live native-proof matrix sent representative commands through the live agent:

```text
#SpawnItem Water_05l 1
#SpawnItem BakedBeans 1
#SpawnItem Emergency_bandage 1
#SpawnItem Weapon_M1911 1
#SpawnItem Weapon_AK47 1
#SpawnItem Magazine_M1911 1 StackCount 100
#SpawnItem Backpack_02_01 1
#SpawnItem Cal_7_62x39mm_Ammobox 1
```

The log recorded the command:

```text
LogSCUM: '76561199274778326:CokeTAMTHAI(1)' Command: 'SpawnItem Water_05l 1'
```

After the save state advanced, native proof succeeded for each case with:

- `ok=true`
- `code=READY`
- `proofType=inventory-state`
- `strategy=world-spawn-delta`

Representative spawned entities observed in `SCUM.db`:

- `Water_05l_ES`
- `BakedBeans_ES`
- `Emergency_bandage_ES`
- `Weapon_M1911_ES`
- `Weapon_AK47_ES`
- `Magazine_M1911_ES`
- `Backpack_02_01_ES`
- `Cal_7_62x39mm_Ammobox_ES`

See [live-native-proof-matrix.md](./live-native-proof-matrix.md) and [live-native-proof-matrix.json](./live-native-proof-matrix.json) for the full evidence bundle.

Wrapper-profile note:

- `teleport_spawn` now has a passing representative case with `#TeleportTo "CokeTAMTHAI"` followed by `#SpawnItem Weapon_M1911 1`
- `announce_teleport_spawn` now has a passing representative case with `#Announce Delivering Announce Teleport Bandage to CokeTAMTHAI`, `#TeleportTo "CokeTAMTHAI"`, and `#SpawnItem Emergency_bandage 1`
- both wrapper-profile cases produced `world-spawn-delta` proof from `SCUM.db`
- the wrapper-profile evidence bundle is tracked in [live-native-proof-wrapper-matrix.md](./live-native-proof-wrapper-matrix.md) and [live-native-proof-wrapper-matrix.json](./live-native-proof-wrapper-matrix.json)

Experimental note:

- representative `ammo` proof now passes on `2026-03-17` with `Cal_7_62x39mm_Ammobox` via `world-spawn-delta`
- repeated live attempts on `2026-03-17` for loose-round IDs `Ammo_762` and `Cal_7_62x39mm` still did not produce a confirmed `SCUM.db` delta on this workstation
- the unsupported case list is tracked in [live-native-proof-experimental-cases.json](./live-native-proof-experimental-cases.json)
- a second server-configuration sample with `EnableSpawnOnGround=True` is captured in [live-native-proof-enable-spawn-on-ground-matrix.md](./live-native-proof-enable-spawn-on-ground-matrix.md) and [live-native-proof-enable-spawn-on-ground-retry.md](./live-native-proof-enable-spawn-on-ground-retry.md), but it remains partial
- a same-workstation `rcon` runtime attempt is recorded in [live-native-proof-rcon-attempt.md](./live-native-proof-rcon-attempt.md) and [live-native-proof-rcon-attempt.json](./live-native-proof-rcon-attempt.json); it is blocked by `connect ECONNREFUSED 127.0.0.1:27015`

## What This Proves

- the local console-agent can focus the live SCUM window and submit a command
- the live SCUM server log is reachable by the watcher runtime
- the watcher can parse recent admin command events from the real log
- native delivery proof can read live `SCUM.db` state on this workstation
- native delivery proof can confirm representative spawned item classes through world-spawn delta after a captured baseline
- native delivery proof can also confirm representative `teleport_spawn` and `announce_teleport_spawn` wrapper profiles by proving the spawned item state, not just the wrapper commands

## What This Does Not Prove

- broader native proof coverage for every delivery item type and every server configuration
- behavior on another workstation without the same Windows session, SCUM client, `SCUM.db`, and `SCUM.log` paths
- any `database-per-tenant` deployment evidence
- a second live tenant-topology workstation/environment
