# System Map For GitHub

Last updated: **2026-03-27**

เอกสารนี้ทำไว้สำหรับดูบน GitHub โดยตรง และใช้ Mermaid ที่ GitHub เรนเดอร์ได้จริง
เป้าหมายคือให้เห็นภาพรวมระบบปัจจุบันแบบอ่านง่าย เร็ว และดูเป็นระบบ

## 1. ภาพรวมทั้งแพลตฟอร์ม

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

## 2. แยกบทบาทของเว็บทั้ง 3 ฝั่ง

```mermaid
flowchart TB
  subgraph Owner["Owner Panel"]
    O1["ภาพรวมแพลตฟอร์ม"]
    O2["Tenants / Packages / Quotas"]
    O3["Runtime Health / Incidents"]
    O4["Audit / Security / Restore"]
  end

  subgraph Tenant["Tenant Admin Panel"]
    T1["Dashboard งานประจำวัน"]
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

## 3. เส้นแบ่งระหว่าง Delivery Agent และ Server Bot

```mermaid
flowchart LR
  subgraph DeliveryAgent["Delivery Agent"]
    D1["รับ delivery job"]
    D2["execute ในเกม"]
    D3["รายงานผลการส่งของ"]
    D4["อาจส่ง announce ในเกม"]
  end

  subgraph ServerBot["Server Bot / Watcher"]
    S1["อ่าน SCUM.log"]
    S2["sync event / state"]
    S3["ดู config / backup / apply"]
    S4["ช่วยงาน restart / health"]
  end

  D1 --> D2 --> D3
  D2 --> D4
  S1 --> S2
  S3 --> S4
```

## 4. เส้นทางคำสั่งซื้อและการส่งของ

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

## 5. เส้นทาง log, sync, และการมองเห็นเหตุการณ์

```mermaid
flowchart LR
  LOG["SCUM.log"] --> WATCHER["Server Bot / Watcher"]
  WATCHER --> SYNC["Sync Ingestion"]
  SYNC --> DB[("PostgreSQL")]
  DB --> OWNER["Owner Panel"]
  DB --> TENANT["Tenant Panel"]
  DB --> PLAYER["Player Activity / Stats"]
```

## 6. เส้นทาง provisioning และ activation

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

## 7. เส้นทาง config, diagnostics, และ restart

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

## 8. ระบบที่มีอยู่ตอนนี้ แยกเป็นหมวด

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

## 9. อ่านแผนผังนี้ยังไง

- ถ้าดูภาพรวมระบบ ให้เริ่มที่ `ภาพรวมทั้งแพลตฟอร์ม`
- ถ้าดูว่า `Owner`, `Tenant`, `Player` ต่างกันยังไง ให้ดู `แยกบทบาทของเว็บทั้ง 3 ฝั่ง`
- ถ้าดูว่า `Delivery Agent` กับ `Server Bot` ต่างกันยังไง ให้ดู `เส้นแบ่งระหว่าง Delivery Agent และ Server Bot`
- ถ้าดู flow สำคัญ ให้ดู `คำสั่งซื้อและการส่งของ`, `log/sync`, `provisioning`, และ `config/restart`

## Related Docs

- [SYSTEM_MAP_GITHUB_EN.md](./SYSTEM_MAP_GITHUB_EN.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [RUNTIME_TOPOLOGY.md](./RUNTIME_TOPOLOGY.md)
- [PLATFORM_PACKAGE_AND_AGENT_MODEL.md](./PLATFORM_PACKAGE_AND_AGENT_MODEL.md)
- [PROJECT_HQ.md](../PROJECT_HQ.md)
