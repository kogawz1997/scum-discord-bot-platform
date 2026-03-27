# Two-Machine Agent Topology

Last updated: `2026-03-25`

Use this topology when you want the control plane and the SCUM execution node
to live on different machines:

- `Machine A`
  - Discord bot
  - admin web
  - player portal
  - worker
  - PostgreSQL
  - wallet / shop / audit / tenant logic
- `Machine B`
  - SCUM client
  - console-agent
  - watcher when `SCUM.log` is local to the SCUM workstation

This is the cleanest production split currently supported in-repo for
`agent`-based delivery without rolling the platform back into a bot-only host.

## Why Use This Split

- isolates Windows-session / SCUM-window risk to one machine
- keeps business state on the control-plane host
- lets the owner / tenant / player surfaces stay on the control plane
- makes it easier to restart or replace the game workstation without moving the platform database

## Prepare Env Profiles

### Machine A

Preview:

```bat
npm run env:preview:machine-a-control-plane
```

Write `.env` files:

```bat
npm run env:prepare:machine-a-control-plane
```

Bootstrap:

```bat
npm run platform:bootstrap:machine-a-control-plane:win
```

### Machine B

Preview:

```bat
npm run env:preview:machine-b-game-bot
```

Write `.env` files:

```bat
npm run env:prepare:machine-b-game-bot
```

Bootstrap:

```bat
npm run platform:bootstrap:machine-b-game-bot:win
```

## Runtime Ownership

### Machine A: control plane

Run:

```bat
npm run pm2:start:machine-a-control-plane
```

This PM2 profile owns:

- `scum-bot`
- `scum-worker`
- `scum-web-portal`

Machine A expects:

- PostgreSQL local or reachable from the control-plane host
- `DELIVERY_EXECUTION_MODE=agent`
- `SCUM_CONSOLE_AGENT_BASE_URL` pointing to Machine B
- watcher disabled locally unless `SCUM.log` also exists on A

### Machine B: game bot execution node

Run:

```bat
npm run pm2:start:machine-b-game-bot
```

This PM2 profile owns:

- `scum-watcher`
- `scum-console-agent`

Machine B expects:

- a live SCUM client session
- watcher log access if `SCUM.log` is local here
- `SCUM_WEBHOOK_URL` pointing back to Machine A
- `SCUM_CONSOLE_AGENT_TOKEN` matching the token Machine A uses

## Agent Activation on Machine B

Recommended flow:

1. Owner creates a one-time setup token from the control plane
2. Machine B receives bootstrap containing:
   - `setupToken`
   - `tenantId`
   - `serverId`
   - `guildId`
   - `agentId`
   - `role`
   - `scope`
3. Agent activates against Machine A
4. Machine B receives a long-lived scoped credential
5. Only then should heartbeat, session, sync, or execute traffic start

Do not reuse a setup token across machines. Device binding is intentionally one-machine-only.

## Validation

### Machine A

Run:

```bat
npm run machine:validate:control-plane -- --production
```

### Machine B

Run:

```bat
npm run machine:validate:game-node -- --production
```

If you split Machine B into separate runtime hosts, use:

```bat
npm run machine:validate:delivery-agent -- --production
npm run machine:validate:server-bot -- --production
```

Detailed setup and role-specific env guidance:

- [MACHINE_VALIDATION_GUIDE_TH.md](./MACHINE_VALIDATION_GUIDE_TH.md)

## Important Limits

- this split reduces operational blast radius but does not remove the SCUM client / Windows-session dependency
- native proof across multiple workstations is still a separate evidence task
- Machine B should not own PostgreSQL migrations or platform schema upgrades

## Minimum Evidence Before Calling This Topology "Ready"

- Machine A validation passes:
  - `npm run machine:validate:control-plane -- --production`
- Machine B validation passes:
  - `npm run machine:validate:game-node -- --production`
- one end-to-end execute flow is captured from Machine A to Machine B
- one sync flow is captured from Machine B back to Machine A
- an operator note exists confirming that Windows session remained interactive during the test

## Related Docs

- [RUNTIME_BOUNDARY_EXPLAINER.md](./RUNTIME_BOUNDARY_EXPLAINER.md)
- [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
- [CUSTOMER_ONBOARDING.md](./CUSTOMER_ONBOARDING.md)
- [OPERATOR_QUICKSTART.md](./OPERATOR_QUICKSTART.md)
