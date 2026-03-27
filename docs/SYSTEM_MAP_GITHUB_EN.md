# System Map For GitHub

Last updated: **2026-03-27**

This document is written for GitHub-first viewing and uses Mermaid blocks that GitHub can render directly.
Its goal is to show the current platform shape in one place, with the main flows separated clearly enough for operators, reviewers, and contributors.

## 1. Platform Overview

```mermaid
flowchart LR
  subgraph Users["Users"]
    OWNER["Owner"]
    TENANT["Tenant Admin"]
    PLAYER["Player"]
    DISCORDUSER["Discord User"]
  end

  subgraph Web["Web Surfaces"]
    OWNERWEB["Owner Panel"]
    TENANTWEB["Tenant Admin Panel"]
    PUBLICWEB["Public / Auth"]
    PLAYERWEB["Player Portal"]
  end

  subgraph Core["Control Plane"]
    BOT["Discord Bot"]
    ADMINAPI["Admin API"]
    PLAYERAPI["Player / Public API"]
    WORKER["Worker"]
    MONITOR["Monitoring / Audit / Notifications"]
    DB[("PostgreSQL + Prisma")]
  end

  subgraph Game["Game-side Runtime"]
    WATCHER["Server Bot / Watcher"]
    AGENT["Delivery Agent"]
    LOG["SCUM.log"]
    CLIENT["SCUM Client"]
  end

  subgraph External["External Services"]
    DISCORD["Discord Gateway / OAuth"]
  end

  OWNER --> OWNERWEB
  TENANT --> TENANTWEB
  PLAYER --> PUBLICWEB
  PLAYER --> PLAYERWEB
  DISCORDUSER --> DISCORD

  OWNERWEB --> ADMINAPI
  TENANTWEB --> ADMINAPI
  PUBLICWEB --> PLAYERAPI
  PLAYERWEB --> PLAYERAPI

  DISCORD --> BOT
  BOT --> DB
  ADMINAPI --> DB
  PLAYERAPI --> DB
  WORKER --> DB
  MONITOR --> DB

  LOG --> WATCHER
  WATCHER --> ADMINAPI
  WATCHER --> DB

  WORKER --> AGENT
  AGENT --> CLIENT
  AGENT --> ADMINAPI
  AGENT --> DB

  BOT --> MONITOR
  ADMINAPI --> MONITOR
  PLAYERAPI --> MONITOR
  WORKER --> MONITOR
```

## 2. Role Separation Across The Three Web Surfaces

```mermaid
flowchart TB
  subgraph Owner["Owner Panel"]
    O1["Platform Overview"]
    O2["Tenants / Packages / Quotas"]
    O3["Runtime Health / Incidents"]
    O4["Audit / Security / Restore"]
  end

  subgraph Tenant["Tenant Admin Panel"]
    T1["Daily Operations Dashboard"]
    T2["Server Status / Server Config"]
    T3["Orders / Delivery / Players"]
    T4["Delivery Agent / Server Bot"]
    T5["Diagnostics / Audit / Restart"]
  end

  subgraph Player["Player Portal"]
    P1["Home / Trust State"]
    P2["Shop / Wallet / Orders"]
    P3["Delivery / Redeem / Profile"]
    P4["Stats / Leaderboards / Activity"]
  end
```

## 3. Delivery Agent vs Server Bot

```mermaid
flowchart LR
  subgraph DeliveryAgent["Delivery Agent"]
    D1["Receive delivery job"]
    D2["Execute in game"]
    D3["Report delivery result"]
    D4["Optional in-game announce"]
  end

  subgraph ServerBot["Server Bot / Watcher"]
    S1["Read SCUM.log"]
    S2["Sync events / state"]
    S3["Config / backup / apply"]
    S4["Restart / health support"]
  end

  D1 --> D2 --> D3
  D2 --> D4
  S1 --> S2
  S3 --> S4
```

## 4. Order And Delivery Flow

```mermaid
flowchart LR
  PLAYER["Player / Admin Action"] --> ORDER["Order / Purchase API"]
  ORDER --> DB[("PostgreSQL")]
  ORDER --> QUEUE["Worker Queue"]
  QUEUE --> MODE{"Execution Mode"}
  MODE -->|agent| AGENT["Delivery Agent"]
  MODE -->|rcon| RCON["RCON Path"]
  AGENT --> CLIENT["SCUM Client"]
  AGENT --> RESULT["Delivery Result / Evidence"]
  RCON --> RESULT
  RESULT --> DB
```

## 5. Log, Sync, And Visibility Flow

```mermaid
flowchart LR
  LOG["SCUM.log"] --> WATCHER["Server Bot / Watcher"]
  WATCHER --> SYNC["Sync Ingestion"]
  SYNC --> DB[("PostgreSQL")]
  DB --> OWNER["Owner Panel"]
  DB --> TENANT["Tenant Panel"]
  DB --> PLAYER["Player Activity / Stats"]
```

## 6. Provisioning And Activation Flow

```mermaid
flowchart LR
  OWNER["Owner / Admin"] --> PROVISION["Provision Runtime"]
  PROVISION --> TOKEN["One-time Setup Token"]
  TOKEN --> RUNTIME["Agent / Bot Installer"]
  RUNTIME --> ACTIVATE["/platform/api/v1/agent/activate"]
  ACTIVATE --> BIND["Device Binding"]
  BIND --> CREDS["Long-lived Credential"]
  CREDS --> SESSION["Heartbeat / Session Refresh"]
  SESSION --> REGISTRY["Runtime Registry / Status"]
  REGISTRY --> OWNERVIEW["Owner / Tenant Runtime Views"]
```

## 7. Config, Diagnostics, And Restart Flow

```mermaid
flowchart LR
  TENANT["Tenant Admin Panel"] --> CONFIG["Config / Diagnostics / Restart UI"]
  CONFIG --> ADMINAPI["Admin API"]
  ADMINAPI --> PLATFORM["Platform Service"]
  PLATFORM --> SNAPSHOT["Snapshot / Restore / Audit"]
  PLATFORM --> RUNTIME["Server Bot / Watcher / Worker"]
  SNAPSHOT --> DB[("PostgreSQL")]
  RUNTIME --> DB
```

## 8. Current System Inventory By Domain

### Web

- Owner Panel
- Tenant Admin Panel
- Public / Auth
- Player Portal

### Runtime

- Discord Bot
- Worker
- Server Bot / Watcher
- Delivery Agent

### Core Platform

- auth / RBAC / session
- package / feature gating
- tenant / preview / quota
- provisioning / activation / heartbeat / sync
- observability / audit / notifications / diagnostics

### Commerce And Community

- shop / cart / wallet / orders / delivery
- redeem / VIP / giveaways / events
- stats / leaderboards / tickets / moderation

### Data

- PostgreSQL
- Prisma
- schema-per-tenant topology

## 9. How To Read This Map

- Start with `Platform Overview` for the high-level system shape
- Use `Role Separation Across The Three Web Surfaces` to see how Owner, Tenant, and Player differ
- Use `Delivery Agent vs Server Bot` when reviewing runtime responsibilities
- Use the flow sections for the key paths: delivery, sync, provisioning, and config/restart

## Related Docs

- [SYSTEM_MAP_GITHUB_TH.md](./SYSTEM_MAP_GITHUB_TH.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
- [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
