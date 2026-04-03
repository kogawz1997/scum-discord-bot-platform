# Runtime Operator Checklist

Use this checklist when you are preparing or revalidating the non-web runtimes on a machine.

## 1. Before You Start

- Confirm the machine has `Node.js 20+`
- Confirm the repository is present on disk
- Confirm `.env` is already prepared for the machine profile when needed
- Confirm you have the right tenant/server identifiers and runtime token

## 2. Server Bot Machine

- Generate or reissue the setup token from the tenant panel first
- Prepare the machine-local env bundle:

```bat
npm run runtime:install:server-bot -- ^
  -ControlPlaneUrl https://control-plane.example.com ^
  -SetupToken stp_xxx.yyy ^
  -TenantId tenant-example ^
  -ServerId server-example ^
  -ConfigRoot "D:\SCUMServer\Config" ^
  -LogPath "D:\SCUMServer\SCUM.log" ^
  -Production
```

- Load the generated PowerShell env loader
- Start `apps/server-bot/server.js`
- Start `apps/watcher/server.js` when watcher lives on this machine
- Run the generated env check first:

```bat
npm run runtime:check:server-bot -- --env-file .runtime\server-bot.env --production
```

- Run validation:

```bat
npm run machine:validate:server-bot -- --production
```

- Capture runtime inventory:

```bat
npm run runtime:inventory -- --role server-bot --tenant-id tenant-example --server-id server-example
```

## 3. Delivery Agent Machine

- Confirm the SCUM client session stays unlocked and interactive
- Treat `Delivery Agent` as the operator-facing name; the compatibility runtime key remains `console-agent`
- Prepare the machine-local env bundle:

```bat
npm run runtime:install:delivery-agent -- ^
  -ControlPlaneUrl https://control-plane.example.com ^
  -SetupToken stp_xxx.yyy ^
  -TenantId tenant-example ^
  -ServerId server-example ^
  -ConsoleAgentToken put_a_strong_agent_token_here ^
  -Backend exec ^
  -ExecTemplate "powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\to\send-scum-admin-command.ps1 -Command ""{command}""" ^
  -Production
```

- Load the generated PowerShell env loader
- Start `apps/agent/server.js`
- The process started above loads the current Delivery Agent entrypoint while preserving the existing compatibility runtime key
- Run the generated env check first:

```bat
npm run runtime:check:delivery-agent -- --env-file .runtime\delivery-agent.env --production
```

- Run validation:

```bat
npm run machine:validate:delivery-agent -- --production
```

## 4. Evidence To Keep

- Latest machine-validation JSON report
- Latest runtime inventory JSON report
- Runtime log snippet showing startup success
- Token prefix or credential prefix for the runtime you just installed
- For game-node machines: one note confirming the Windows session stayed interactive

## 5. When Something Fails

- If env check fails, fix the generated `.runtime\*.env` bundle before starting the runtime
- If validation says `awaiting-install`, reissue the setup token and activate again
- If validation says the control plane is unreachable, verify `PLATFORM_API_BASE_URL`
- If config snapshot fails, verify `SCUM_SERVER_CONFIG_ROOT`
- If delivery preflight fails, verify the SCUM window is present and unlocked
