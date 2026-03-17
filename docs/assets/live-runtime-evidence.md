# Live Runtime Evidence

Captured on: `2026-03-17`

This file records live runtime observations from the current workstation after the latest validation pass.

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
#SpawnItem Weapon_M1911 1
#SpawnItem Magazine_M1911 1 StackCount 100
#SpawnItem Weapon_AK47 1
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
- `Weapon_M1911_ES`
- `Magazine_M1911_ES`
- `Weapon_AK47_ES`

See [live-native-proof-matrix.md](./live-native-proof-matrix.md) and [live-native-proof-matrix.json](./live-native-proof-matrix.json) for the full evidence bundle.

Experimental note:

- `Ammo_762` now resolves through a generic ammo spawn fallback and reaches the live game command path
- native proof on this workstation still does not confirm a matching game-state delta for that case
- the unsupported case list is tracked in [live-native-proof-experimental-cases.json](./live-native-proof-experimental-cases.json)

## What This Proves

- the local console-agent can focus the live SCUM window and submit a command
- the live SCUM server log is reachable by the watcher runtime
- the watcher can parse recent admin command events from the real log
- native delivery proof can read live `SCUM.db` state on this workstation
- native delivery proof can confirm representative spawned item classes through world-spawn delta after a captured baseline

## What This Does Not Prove

- broader native proof coverage for every delivery item type and every server configuration
- behavior on another workstation without the same Windows session, SCUM client, `SCUM.db`, and `SCUM.log` paths
- full database-per-tenant isolation beyond the current PostgreSQL RLS foundation
