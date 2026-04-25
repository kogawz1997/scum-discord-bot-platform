# Owner Panel UI/UX Redesign Brief

เอกสารนี้สรุปข้อมูลฝั่ง Owner/Owen Panel สำหรับนำไปออกแบบหน้าเว็บใหม่ โดยโฟกัสเฉพาะข้อมูลที่ใช้กับงาน UI/UX, sitemap, page structure, data display, component, table, action, state และ flow

> หมายเหตุ: เอกสารนี้ไม่ได้ยืนยันว่า feature ทั้งหมด production-ready แล้ว แต่จัดระเบียบจากสิ่งที่ repo มีและสิ่งที่ Owner Panel ควรรองรับในระบบ managed-service / SaaS-style SCUM platform

## 1. Source of Truth สำหรับออกแบบ

ใช้ไฟล์/กลุ่มข้อมูลเหล่านี้เป็นหลัก:

| ใช้ทำอะไร                           | Source                                  |
| ----------------------------------- | --------------------------------------- |
| โครงเมนู / information architecture | `src/admin/assets/owner-vnext.js`       |
| route / endpoint / flow map         | `docs/stitch/ROUTE_API_MAP.md`          |
| entity / database model             | `prisma/schema.prisma`                  |
| runtime role separation             | `src/contracts/agent/agentContracts.js` |
| owner runtime entrypoint            | `apps/owner-web/server.js`              |
| owner shell ปัจจุบัน                | `src/admin/owner-console.html`          |
| owner legacy app logic              | `src/admin/assets/owner-v4-app.js`      |

ไม่ควรใช้เป็น source หลัก:

| ไม่ควรยึดเป็นหลัก                   | เหตุผล                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| `stitch/owner-pages`                | เป็น static/design artifact หลายหน้า ไม่ใช่ product flow จริงทั้งหมด |
| `owner-console.html` อย่างเดียว     | nav เก่ามีแค่บางหน้า ไม่ครอบคลุม Owner scope จริง                    |
| hardcoded text ใน `owner-v4-app.js` | มี Thai mojibake / text repair logic เยอะ                            |
| screenshot PNG                      | ใช้ดู mood/layout ได้ แต่ไม่ใช่ data contract                        |

## 2. บทบาทของ Owner Panel

Owner ไม่ใช่ผู้เล่น และไม่ใช่ tenant admin

Owner คือผู้ดูแลทั้ง platform จึงต้องเห็นภาพรวมระดับระบบ:

1. วันนี้ระบบโดยรวมปกติไหม
2. tenant ไหนมีปัญหา
3. runtime ไหน offline หรือ outdated
4. subscription/payment ไหนเสี่ยง
5. มี incident หรือ support case ไหนต้องจัดการ
6. agent/bot ของ tenant ไหนติดตั้งไม่ครบ
7. config/restart/backup ไหน fail
8. มี security/audit event ไหนน่าสงสัย
9. package/feature ไหนถูกใช้เยอะ
10. platform พร้อมให้บริการต่อไหม

## 3. Main Navigation ที่แนะนำ

ใช้ sidebar หลัก 3 กลุ่ม:

### Platform

1. Overview
2. Tenants
3. Tenant Detail
4. Tenant Provisioning
5. Packages
6. Package Detail
7. Entitlements
8. Subscriptions
9. Subscription Detail
10. Billing
11. Invoice Detail
12. Payment Attempts

### Operations

13. Runtime Health
14. Agents & Bots
15. Delivery Agents
16. Server Bots
17. Jobs & Queues
18. Config Jobs
19. Restart Plans
20. Backups & Recovery
21. Incidents
22. Observability
23. Support
24. Diagnostics

### Governance

25. Audit Logs
26. Security Events
27. Access Control
28. Admin Users
29. API Keys
30. Webhooks
31. Notifications
32. Automation
33. Platform Controls
34. Settings

## 4. Global Layout ทุกหน้า

### App Shell

ควรมี:

- left sidebar
- top search
- tenant quick search
- global health indicator
- notification bell
- language switcher EN/TH
- current environment badge เช่น `Production`, `Staging`, `Local`
- signed-in owner profile
- quick actions button

### Top Bar Data

| UI                 | Data                                       |
| ------------------ | ------------------------------------------ |
| Platform status    | healthy / degraded / incident              |
| Online runtimes    | Delivery Agents online, Server Bots online |
| Pending risks      | failed jobs, unpaid invoices, offline bots |
| Current owner user | name, role, session                        |
| Locale             | English / Thai                             |
| Refresh state      | last updated time                          |

### Global Search

ควรค้นหาได้:

- tenant name
- tenant slug
- server name
- owner email
- invoice id
- subscription id
- agent id
- bot id
- support case
- audit event
- API key prefix

### Quick Actions

- Create tenant
- Create package
- Provision agent
- Provision server bot
- Create support case
- Open diagnostics
- Run health check
- View failed jobs
- View unpaid invoices

## 5. Owner Overview

### เป้าหมาย

ให้ Owner รู้ทันทีว่า platform มีปัญหาอะไรบ้าง และควรจัดการอะไรเป็นอันดับแรก

### Platform Health Summary

Cards:

| Card                    | Data                                   |
| ----------------------- | -------------------------------------- |
| Total tenants           | จำนวน tenant ทั้งหมด                   |
| Active tenants          | tenant ใช้งานอยู่                      |
| Suspended tenants       | tenant ถูกระงับ                        |
| Preview / trial tenants | tenant ที่ยังไม่จ่าย                   |
| Healthy tenants         | tenant ไม่มีปัญหา                      |
| At-risk tenants         | tenant มี runtime/billing/config issue |

### Revenue Summary

Cards:

| Card                      | Data                 |
| ------------------------- | -------------------- |
| Active subscriptions      | subscription active  |
| Monthly recurring revenue | รายได้ recurring     |
| Unpaid invoices           | invoice ค้างจ่าย     |
| Failed payments           | payment attempt fail |
| Expiring trials           | trial ใกล้หมด        |
| Cancelled subscriptions   | subscription ยกเลิก  |

### Runtime Summary

Cards:

| Card                    | Data                     |
| ----------------------- | ------------------------ |
| Delivery Agents online  | agent online             |
| Delivery Agents offline | agent offline            |
| Server Bots online      | bot online               |
| Server Bots offline     | bot offline              |
| Outdated runtimes       | version เก่า             |
| Last heartbeat risk     | runtime ไม่ส่ง heartbeat |

### Operations Risk

List/table:

- failed delivery jobs
- failed config jobs
- pending restart plans
- failed backup
- failed restore
- queue backlog
- dead-letter jobs
- server bot disconnected
- delivery agent disconnected

### Security / Audit Snapshot

แสดง:

- recent login failures
- suspicious session
- API key created/revoked
- setup token created/used/expired
- package changed
- tenant suspended
- config applied
- restart executed
- backup restored

### Support Snapshot

แสดง:

- open support cases
- high priority cases
- tenant with repeated failures
- unresolved incidents
- cases waiting for owner action

### Main CTA

- View at-risk tenants
- Open runtime health
- View unpaid invoices
- View incidents
- Run platform diagnostics

## 6. Tenants

### เป้าหมาย

จัดการ tenant ทั้งหมดในระบบ

### Table Columns

| Column          | Description                             |
| --------------- | --------------------------------------- |
| Tenant name     | ชื่อ server/community                   |
| Slug            | unique tenant slug                      |
| Status          | active / preview / suspended / disabled |
| Package         | current package                         |
| Subscription    | active / trial / overdue / cancelled    |
| Delivery Agent  | online / offline / missing              |
| Server Bot      | online / offline / missing              |
| Runtime version | current / outdated                      |
| Billing risk    | paid / unpaid / failed                  |
| Last activity   | last seen / last sync                   |
| Locale          | EN / TH                                 |
| Risk            | badges                                  |
| Actions         | view / suspend / diagnostics            |

### Filters

- status
- package
- subscription status
- runtime status
- missing Delivery Agent
- missing Server Bot
- unpaid invoice
- trial/preview
- locale
- created date

### Row Badges

- `Missing Server Bot`
- `Delivery Offline`
- `Payment Failed`
- `Trial Ending`
- `Config Failed`
- `Restart Pending`
- `Suspended`
- `Outdated Runtime`

### Row Actions

- View tenant
- Open diagnostics
- Change package
- Suspend tenant
- Resume tenant
- Create support case
- Provision agent/bot
- View billing
- View audit logs

## 7. Tenant Detail / Tenant Dossier

หน้านี้ควรเป็นหน้าหลักที่สุดรองจาก Overview

### เป้าหมาย

รวมทุกอย่างของ tenant หนึ่งรายไว้ที่เดียว

### Header

แสดง:

- tenant name
- tenant slug
- status
- package
- subscription status
- owner email
- locale
- created date
- risk score
- quick action buttons

### Tabs

1. Summary
2. Subscription
3. Billing
4. Agents & Bots
5. Config
6. Restart
7. Backups
8. Support
9. Audit
10. Diagnostics
11. Linked Identities
12. Feature Access

### Summary Tab

Cards:

- subscription status
- package
- billing health
- delivery agent status
- server bot status
- last log sync
- last config apply
- last restart
- open support cases
- recent incidents

### Subscription Tab

Data:

- current plan
- package id
- package name
- billing interval
- start date
- renew date
- trial end
- cancel state
- active entitlements
- limits

Actions:

- change package
- pause subscription
- cancel subscription
- extend trial
- apply discount
- view subscription events

### Billing Tab

Data:

- customer
- invoices
- payment attempts
- failed payments
- payment method status
- billing events

Actions:

- retry payment
- resend invoice
- mark invoice
- open payment attempt detail
- create manual invoice

### Agents & Bots Tab

ต้องแยก Delivery Agent กับ Server Bot ชัดเจน

#### Delivery Agent

Data:

- runtime id
- machine name
- version
- status
- last heartbeat
- scope: `execute_only`
- delivery jobs
- announce support
- bound device
- credential status

Actions:

- provision Delivery Agent
- rotate credential
- revoke credential
- view jobs
- view heartbeat history

#### Server Bot

Data:

- runtime id
- machine name
- version
- status
- last heartbeat
- scope: `sync_only`
- log sync status
- config access status
- backup status
- restart permission
- bound device

Actions:

- provision Server Bot
- rotate credential
- revoke credential
- view sync logs
- view config jobs
- view restart history

### Config Tab

Data:

- current config snapshot
- pending config jobs
- failed config jobs
- last applied config
- backup before apply
- fields requiring restart

Actions:

- view config
- compare diff
- apply config
- rollback config
- create backup
- open failed job

### Restart Tab

Data:

- restart plans
- restart type
- scheduled time
- countdown announcements
- execution status
- post-restart health
- restart history

Actions:

- restart now
- schedule restart
- safe restart
- cancel restart
- view announcements
- verify health

### Backups Tab

Data:

- backup list
- backup type
- created by
- created at
- related config job
- restore status

Actions:

- create backup
- restore backup
- compare backup
- download/export if supported

### Support Tab

Data:

- support cases
- open issues
- linked runtime evidence
- linked billing evidence
- incident timeline

Actions:

- create case
- add note
- attach diagnostics
- close case

### Audit Tab

Data:

- actor
- action
- tenant scope
- before/after metadata
- timestamp
- IP/session
- risk level

Filters:

- action type
- actor
- date
- runtime
- billing
- security
- config/restart

### Diagnostics Tab

Data:

- tenant health summary
- runtime checks
- queue checks
- billing checks
- config checks
- restart checks
- Discord checks
- server bot checks
- delivery agent checks

Actions:

- run diagnostics
- export report
- attach to support case

## 8. Create / Provision Tenant

### Flow

#### Step 1: Tenant Info

Fields:

- tenant name
- slug
- owner name
- owner email
- locale
- timezone
- server type
- notes

#### Step 2: Package

Fields:

- package
- billing interval
- trial/preview
- enabled modules
- limits

#### Step 3: Runtime Setup

Options:

- create Delivery Agent setup token
- create Server Bot setup token
- copy install command
- show setup token expiry
- show machine binding note

#### Step 4: Billing

Fields:

- billing customer
- invoice mode
- payment provider
- trial end
- subscription start

#### Step 5: Review

Show:

- tenant info
- package
- entitlements
- billing
- setup tokens
- risks

#### Step 6: Created State

Show:

- tenant created
- setup token copy buttons
- next steps
- open tenant detail

## 9. Packages

### เป้าหมาย

จัดการ package ที่ tenant ซื้อได้

### Table Columns

| Column          | Description               |
| --------------- | ------------------------- |
| Package name    | ชื่อ package              |
| Status          | active / draft / archived |
| Price           | monthly/yearly            |
| Tenant count    | tenant ที่ใช้อยู่         |
| Feature count   | จำนวน feature             |
| Limits          | server/agent/module limit |
| Trial allowed   | yes/no                    |
| Preview allowed | yes/no                    |
| Created/updated | timestamp                 |

### Package Features

- shop
- wallet
- delivery
- config editor
- restart control
- donation
- event system
- bot modules
- stats
- leaderboard
- killfeed
- raid request
- audit logs
- analytics
- automation
- Discord integration
- multi-language

### Actions

- create package
- edit package
- duplicate package
- archive package
- view tenants
- compare packages

## 10. Package Detail

### Sections

1. Basic info
2. Pricing
3. Entitlements
4. Limits
5. Preview mode
6. Trial settings
7. Tenant usage
8. Change history

### Entitlement Matrix

| Feature         | Enabled | Limit                | Preview behavior | Locked message  |
| --------------- | ------- | -------------------- | ---------------- | --------------- |
| Config editor   | yes/no  | field/category limit | visible locked   | upgrade message |
| Restart control | yes/no  | monthly limit        | preview only     | upgrade         |
| Donations       | yes/no  | campaign limit       | hidden/locked    | upgrade         |
| Events          | yes/no  | event limit          | visible locked   | upgrade         |
| Stats           | yes/no  | retention days       | visible sample   | upgrade         |
| Raid system     | yes/no  | request limit        | hidden/locked    | upgrade         |

### Important UX

ทุก feature ต้องมี 3 state:

1. Enabled
2. Disabled
3. Preview locked

## 11. Entitlements

### เป้าหมาย

ให้ Owner เห็นว่า feature ไหนเปิดให้ package ไหน

### Layout

Matrix view:

- Rows = features
- Columns = packages

ตัวอย่าง:

| Feature       | Free   | Basic   | Pro     | Enterprise |
| ------------- | ------ | ------- | ------- | ---------- |
| Shop          | locked | enabled | enabled | enabled    |
| Delivery      | locked | limited | enabled | enabled    |
| Config editor | locked | locked  | enabled | enabled    |
| Restart       | locked | locked  | limited | enabled    |
| Audit logs    | locked | limited | enabled | enabled    |
| Automation    | locked | locked  | locked  | enabled    |

### Filters

- by feature group
- by package
- by tenant
- by locked/preview/enabled

## 12. Subscriptions

### Table Columns

| Column           | Description                    |
| ---------------- | ------------------------------ |
| Tenant           | tenant name                    |
| Package          | current package                |
| Status           | active/trial/overdue/cancelled |
| Billing interval | monthly/yearly                 |
| Start date       | subscription start             |
| Renewal date     | next billing                   |
| Trial end        | if any                         |
| Revenue          | amount                         |
| Invoice state    | paid/unpaid/failed             |
| Risk             | badges                         |

### Filters

- active
- trial
- overdue
- cancelled
- payment failed
- package
- renewal date
- tenant

### Actions

- view subscription
- change package
- extend trial
- cancel
- reactivate
- view invoices

## 13. Subscription Detail

### Sections

- subscription summary
- tenant
- package
- billing customer
- invoice timeline
- payment attempts
- package changes
- subscription events
- entitlement changes
- audit log

### Actions

- change package
- retry payment
- extend trial
- cancel subscription
- resume subscription
- add internal note

## 14. Billing Overview

### Revenue Cards

- MRR
- active paying tenants
- unpaid invoices
- failed payments
- trial conversion
- cancelled subscriptions

### Tables

- invoices
- payment attempts
- customers
- billing events
- high-risk accounts

### Risk Queue

List tenants with:

- failed payment
- unpaid invoice
- trial ending
- no billing customer
- subscription mismatch

### Actions

- retry payment
- resend invoice
- open tenant billing
- export billing report

## 15. Invoice Detail

### Data

- invoice id
- tenant
- customer
- subscription
- amount
- currency
- status
- due date
- paid date
- payment attempts
- provider reference
- line items
- metadata
- audit events

### Actions

- retry
- mark paid if manual mode
- void/cancel if supported
- resend
- open payment attempt
- open tenant

## 16. Payment Attempt Detail

### Data

- attempt id
- invoice id
- provider
- status
- failure reason
- provider error code
- created at
- completed at
- amount
- tenant
- customer
- raw event metadata

### Actions

- retry
- open invoice
- open tenant
- create support case

## 17. Runtime Health / Fleet Overview

### เป้าหมาย

ดู runtime ทุกตัวทั้ง platform

### Cards

- Delivery Agents online
- Delivery Agents offline
- Server Bots online
- Server Bots offline
- outdated runtimes
- missing runtimes
- reconnecting
- failed heartbeats

### Table Columns

| Column         | Description                 |
| -------------- | --------------------------- |
| Runtime        | agent/bot name              |
| Type           | Delivery Agent / Server Bot |
| Tenant         | tenant name                 |
| Status         | online/offline/degraded     |
| Version        | current/outdated            |
| Last heartbeat | timestamp                   |
| Machine        | machine/device binding      |
| Scope          | execute_only/sync_only      |
| Jobs           | active/failed               |
| Risk           | badges                      |

### Important UX Rule

Delivery Agent กับ Server Bot ต้องแยก visually ชัดมาก

ใช้ badge:

- Delivery Agent = `Delivery / Execute`
- Server Bot = `Server / Sync`

## 18. Agents & Bots Detail

### Sections

- runtime identity
- tenant binding
- credential state
- machine binding
- version
- last seen
- heartbeat history
- permissions/scope
- job history
- diagnostics
- audit events

### Actions

- rotate credential
- revoke credential
- create replacement setup token
- mark compromised
- view logs
- open tenant
- run diagnostics

## 19. Provision Agent / Bot

### Flow

1. Select tenant
2. Select runtime type
   - Delivery Agent
   - Server Bot
3. Generate setup token
4. Waiting for activation
5. Activated

### Setup Token State

Show:

- token
- expiry
- install command
- allowed role
- allowed scope
- one-time use warning
- pending
- heartbeat not received
- machine not bound
- activated
- failed
- expired

### Activated State

Show:

- machine fingerprint
- runtime version
- last heartbeat
- credential status

## 20. Jobs & Queues

### Data

- delivery jobs
- config jobs
- restart jobs
- backup jobs
- sync jobs
- failed jobs
- dead-letter jobs
- retry count
- claimed by runtime
- tenant
- created at
- updated at

### Filters

- job type
- status
- tenant
- runtime
- failed only
- retryable
- dead-letter

### Actions

- retry job
- cancel job
- view job detail
- open tenant
- open runtime
- create support case

## 21. Config Jobs

### Data

- tenant
- config category
- job type
- requested by
- status
- requires restart
- backup created
- diff available
- failure reason
- applied by Server Bot
- timestamp

### Actions

- view diff
- retry
- rollback
- open backup
- open tenant
- view audit

## 22. Restart Plans

### Data

- tenant
- restart type
- scheduled time
- countdown enabled
- announcement language
- server bot status
- delivery agent announce status
- current phase
- health verification result
- created by
- status

### Restart Types

- restart now
- delayed restart
- safe restart
- restart after config apply

### Actions

- create restart plan
- cancel
- force if allowed
- view countdown
- view execution
- verify health

### Risk UI

- ถ้า Server Bot offline ต้อง block restart
- ถ้า Delivery Agent offline ต้อง warning ว่า announce อาจไม่ทำงาน
- ถ้ามี active queue ต้อง warning ก่อน restart

## 23. Backups & Recovery

### Data

- tenant
- backup id
- type
- source
- created at
- created by
- size
- related config job
- restore status
- verification status

### Actions

- create backup
- restore
- compare
- download/export
- open tenant
- open config job

### Restore Flow

1. select backup
2. review metadata
3. show impacted config/files
4. require confirmation
5. create restore job
6. wait for Server Bot
7. verify
8. audit log

## 24. Incidents

### Data

- incident id
- title
- severity
- tenant
- affected runtime
- status
- started at
- resolved at
- linked logs
- linked jobs
- linked audit events

### Severity

- critical
- high
- medium
- low

### Actions

- create incident
- assign owner
- attach diagnostics
- link support case
- mark resolved
- open tenant
- open runtime

## 25. Observability

### Sections

- request logs
- API errors
- runtime heartbeats
- queue latency
- job failures
- webhook failures
- billing provider failures
- sync failures
- restart failures

### Charts

- request volume
- error rate
- job failure rate
- online runtimes over time
- billing failures over time
- tenant activity

### Filters

- tenant
- route
- runtime
- status code
- error type
- time range

## 26. Support

### Main Layout

แนะนำ layout แบบ 3 columns:

| Area   | Content                             |
| ------ | ----------------------------------- |
| Left   | tenant/search/case list             |
| Center | case timeline                       |
| Right  | tenant health facts + quick actions |

### Case Data

- case id
- tenant
- severity
- status
- category
- assigned owner
- created at
- last update
- linked diagnostics
- linked audit events
- linked runtime/job/config/billing evidence

### Case Categories

- billing
- runtime offline
- delivery issue
- config issue
- restart issue
- Discord issue
- account/linking issue
- package/feature issue

### Actions

- create case
- add note
- attach diagnostics
- escalate
- resolve
- open tenant
- run diagnostics

## 27. Diagnostics

### Diagnostics Checks

| Check                  | Result    |
| ---------------------- | --------- |
| Tenant exists          | pass/fail |
| Subscription active    | pass/fail |
| Package valid          | pass/fail |
| Delivery Agent online  | pass/fail |
| Server Bot online      | pass/fail |
| Last heartbeat fresh   | pass/fail |
| Config jobs healthy    | pass/fail |
| Restart jobs healthy   | pass/fail |
| Backup available       | pass/fail |
| Billing healthy        | pass/fail |
| Discord connected      | pass/fail |
| Queue healthy          | pass/fail |
| Recent security events | pass/fail |

### Actions

- run full diagnostics
- run billing diagnostics
- run runtime diagnostics
- run config diagnostics
- export report
- attach to support case

## 28. Audit Logs

### Table Columns

| Column     | Description                |
| ---------- | -------------------------- |
| Time       | timestamp                  |
| Actor      | owner/admin/system/runtime |
| Tenant     | tenant scope               |
| Action     | action name                |
| Target     | affected object            |
| Risk       | low/medium/high/critical   |
| Result     | success/fail               |
| IP/session | if available               |

### Important Audit Actions

- tenant created
- tenant suspended
- package changed
- subscription changed
- invoice modified
- setup token generated
- agent activated
- credential rotated
- config changed
- restart scheduled
- restart executed
- backup restored
- user role changed
- API key created/revoked
- webhook changed

### Filters

- tenant
- actor
- action
- risk
- date
- result

## 29. Security Events

### Data

- failed login
- suspicious session
- API key activity
- setup token activity
- credential rotation
- device binding mismatch
- rate limit events
- permission denied
- webhook failure
- origin/CORS issue
- 2FA events

### Actions

- revoke session
- revoke API key
- rotate credential
- lock tenant
- require password reset
- open audit event
- create incident

## 30. Access Control

### Sections

- owner users
- roles
- permissions
- sessions
- API keys
- tenant access
- action permissions

### Role Examples

- Owner
- Platform Admin
- Support
- Billing Admin
- Operations Admin
- Read-only Auditor

### Permission Groups

- tenant manage
- billing manage
- package manage
- runtime manage
- config manage
- restart manage
- backup restore
- security manage
- audit read
- support manage

## 31. Admin Users

### Data

- name
- email
- role
- 2FA status
- last login
- active sessions
- status
- created date

### Actions

- invite user
- change role
- disable user
- revoke sessions
- require 2FA
- reset password

## 32. API Keys

### Data

- key prefix
- owner
- scopes
- status
- created at
- last used
- expires at
- tenant scope/global scope

### Actions

- create key
- rotate
- revoke
- view audit
- restrict scopes

## 33. Webhooks

### Data

- endpoint URL
- event types
- status
- last delivery
- failure count
- secret status
- tenant/global scope

### Actions

- create webhook
- rotate secret
- disable
- test delivery
- view attempts

## 34. Notifications

### Data

- notification id
- type
- severity
- tenant
- message
- status
- created at
- read/ack state
- linked action

### Types

- billing
- runtime
- security
- support
- config
- restart
- system

### Actions

- acknowledge
- clear
- open linked object
- create incident

## 35. Automation

### Data

- automation name
- status
- trigger
- last run
- next run
- success/fail count
- target tenants
- created by

### Automation Examples

- daily health check
- invoice risk scan
- runtime offline alert
- backup verification
- restart reminder
- support case escalation
- package entitlement sync

### Actions

- create automation
- run now
- pause
- edit
- view run history

## 36. Platform Controls

หน้านี้เป็น high-risk operations ต้องออกแบบระวังมาก

### Controls

- restart service
- reload config
- run reconcile
- clear cache
- run monitoring check
- rotate platform secrets
- force sync
- maintenance mode

### UX Rules

- ทุก action ต้องมี confirmation
- action เสี่ยงต้องพิมพ์ชื่อ tenant หรือ action เพื่อ confirm
- ต้องโชว์ impact ก่อนทำ
- ต้องสร้าง audit log
- ต้องมี result state

## 37. Recovery

### Data

- backup status
- restore state
- recovery jobs
- failed recovery
- tenant restore history
- platform restore history

### Actions

- create backup
- restore tenant
- restore config
- verify backup
- view restore history

## 38. Settings

### Sections

- platform profile
- default locale
- billing provider
- runtime policy
- security policy
- notification policy
- package defaults
- support settings
- Discord integration settings
- environment settings

### Important UX

Settings ต้องแยกเป็น:

1. Safe settings
2. Risky settings
3. Runtime settings
4. Secret settings

Secret fields ห้ามโชว์ค่าจริง

## 39. Component Library ที่ควรออกแบบ

### Core Components

- AppShell
- Sidebar
- TopBar
- GlobalSearch
- TenantSearch
- PageHeader
- MetricCard
- RiskCard
- StatusBadge
- RuntimeBadge
- PackageBadge
- SubscriptionBadge
- HealthIndicator
- DataTable
- FilterBar
- EmptyState
- LoadingState
- ErrorState
- AuditTimeline
- EventTimeline
- ActionDrawer
- ConfirmationModal
- RiskConfirmationModal
- DiffViewer
- Stepper
- Wizard
- Toast
- NotificationCenter

### Specialized Components

- TenantHealthCard
- RuntimeStatusCard
- AgentProvisioningWizard
- SetupTokenPanel
- EntitlementMatrix
- PackageFeatureMatrix
- BillingRiskQueue
- RestartPlanTimeline
- ConfigDiffPreview
- BackupRestorePanel
- DiagnosticsChecklist
- SupportCaseTimeline
- AuditLogTable
- SecurityEventTable
- JobQueueTable

## 40. Status Badge System

### Tenant Status

- Active
- Preview
- Trial
- Suspended
- Disabled
- Archived

### Subscription Status

- Active
- Trial
- Past due
- Cancelled
- Expired
- Pending

### Runtime Status

- Online
- Offline
- Degraded
- Pending activation
- Expired setup token
- Outdated
- Revoked

### Job Status

- Pending
- Claimed
- Running
- Completed
- Failed
- Retryable
- Dead-letter
- Cancelled

### Risk Level

- Low
- Medium
- High
- Critical

## 41. Empty States

ออกแบบ empty state ให้ครบ:

| Page          | Empty State                          |
| ------------- | ------------------------------------ |
| Tenants       | ยังไม่มี tenant, CTA create tenant   |
| Agents        | ยังไม่มี agent, CTA provision        |
| Server Bots   | ยังไม่มี server bot, CTA provision   |
| Packages      | ยังไม่มี package, CTA create package |
| Subscriptions | ยังไม่มี subscription                |
| Billing       | ยังไม่มี invoice                     |
| Support       | ไม่มี case เปิดอยู่                  |
| Audit         | ไม่มี event ในช่วงเวลานี้            |
| Notifications | ไม่มี notification                   |
| Incidents     | ไม่มี incident                       |
| Backups       | ยังไม่มี backup                      |

## 42. Loading / Error / Risk States

ทุกหน้าควรมี:

### Loading

- skeleton table
- loading cards
- last updated placeholder

### Error

- API unavailable
- unauthorized
- tenant not found
- runtime offline
- billing provider error
- permission denied
- stale data warning

### Risk

- action blocked
- action requires Server Bot online
- action requires Delivery Agent online
- action requires active subscription
- action requires permission
- action requires confirmation

## 43. UX Priority สำหรับ Owner ใหม่

ถ้าจะออกแบบจริง ให้เรียงความสำคัญแบบนี้:

1. Owner Overview
2. Tenants
3. Tenant Detail
4. Runtime Health
5. Agents & Bots
6. Packages
7. Entitlements
8. Subscriptions
9. Billing
10. Support
11. Diagnostics
12. Audit Logs
13. Security
14. Config Jobs
15. Restart Plans
16. Backups & Recovery
17. Incidents
18. Observability
19. Settings
20. Platform Controls

## 44. Design Direction

ควรเป็น UI แบบ:

- data-dense
- operator-focused
- clear hierarchy
- enterprise dashboard
- status/risk driven
- fast filtering
- strong tables
- clear badges
- timeline-heavy
- confirmation-heavy สำหรับ risky action
- ไม่ควรทำเหมือน landing page
- ไม่ควรใช้ visual decoration เยอะ
- ไม่ควรใช้ gradient/card สวยๆ แต่ข้อมูลไม่ชัด

หน้าฝั่ง Owner ต้องให้ความรู้สึกว่าเป็น control room ไม่ใช่ marketing dashboard

## 45. Final Sitemap

ลิสต์หน้าที่ควรทำทั้งหมด:

1. Owner Overview
2. Tenants
3. Tenant Detail
4. Create Tenant
5. Tenant Provisioning
6. Packages
7. Create Package
8. Package Detail
9. Entitlement Matrix
10. Subscriptions
11. Subscription Detail
12. Billing Overview
13. Invoice Detail
14. Payment Attempt Detail
15. Runtime Health
16. Agents & Bots
17. Delivery Agent Detail
18. Server Bot Detail
19. Provision Runtime
20. Jobs & Queues
21. Config Jobs
22. Restart Plans
23. Backups & Recovery
24. Incidents
25. Observability
26. Support Cases
27. Support Case Detail
28. Diagnostics
29. Audit Logs
30. Security Events
31. Access Control
32. Admin Users
33. API Keys
34. Webhooks
35. Notifications
36. Automation
37. Platform Controls
38. Settings

## 46. Recommended First 5 Screens

เริ่มออกแบบจาก 5 หน้านี้ก่อน เพราะจะกำหนด structure, status system, table pattern, badge system, action pattern และ risk confirmation pattern ให้ทั้ง Owner Panel ใหม่

1. Owner Overview
2. Tenants
3. Tenant Detail
4. Runtime Health
5. Agents & Bots

## 47. Owner UI Design Principles

1. Owner ต้องเห็น risk ก่อน decorative content
2. ทุก table ต้อง filter/sort/search ได้
3. ทุก risky action ต้องมี confirmation และ audit trail
4. Runtime role ต้องแยกชัดเจนเสมอ: Delivery Agent != Server Bot
5. Tenant Detail ต้องเป็นศูนย์กลางของการ support
6. Package UI ต้องแสดง entitlement matrix ไม่ใช่ pricing card อย่างเดียว
7. Billing UI ต้องเน้น risk queue เช่น unpaid, failed payment, trial ending
8. Diagnostics ต้องผูกกับ support case ได้
9. Audit/Security ต้องค้นย้อนกลับได้เร็ว
10. English/Thai ต้องใช้ translation key ไม่ใช่ hardcoded copy

## 48. Owner API / Backend Contract

ส่วนนี้สรุป API/backend ฝั่ง Owner/Owen สำหรับใช้คู่กับการออกแบบหน้าเว็บใหม่ โดยแยกเป็น current contract ที่ repo มีอยู่, endpoint ที่ UI ควรใช้, entity/model ที่เกี่ยวข้อง, mutation/action ที่ต้องออกแบบ confirmation, และ gap ที่ backend ควรเติม

> หมายเหตุ: ส่วนนี้เป็น design/backend brief ไม่ใช่ API reference ที่รับประกัน payload shape ครบทุก field ต้องตรวจ response จริงอีกครั้งก่อน implement UI

### 48.1 Backend Source of Truth

| ใช้ทำอะไร                  | Source                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Owner route/API map        | `docs/stitch/ROUTE_API_MAP.md`                                                                 |
| Owner frontend API calls   | `src/admin/assets/owner-v4-app.js`                                                             |
| Owner standalone bootstrap | `src/admin/runtime/adminStandaloneSurfaceRuntime.js`                                           |
| Owner/API rewrite          | `src/admin/runtime/adminServerRuntime.js`                                                      |
| Admin route handlers       | `src/admin/runtime/adminRouteHandlersRuntime.js`                                               |
| Platform services          | `src/services/platformService.js`                                                              |
| Billing services           | `src/services/platformBillingLifecycleService.js`, `src/services/platformCommercialService.js` |
| Agent registry             | `src/domain/agents/agentRegistryService.js`                                                    |
| Agent contracts            | `src/contracts/agent/agentContracts.js`                                                        |
| Config services            | `src/services/platformServerConfigService.js`, `src/config/adminEditableConfig.js`             |
| Restart services           | `src/services/platformRestartOrchestrationService.js`                                          |
| Database schema            | `prisma/schema.prisma`                                                                         |

### 48.2 Current API Routing Model

Important rules:

- Owner UI เรียก API ผ่าน same-origin cookie/session
- Owner surface ใช้ `/owner/api/...`
- Runtime ฝั่ง admin มี rewrite จาก `/owner/api/...` ไปเป็น `/admin/api/...`
- บาง endpoint ยังเรียก `/admin/api/...` โดยตรง เช่น backup, automation, player identity review
- Live update ใช้ SSE ที่ `/admin/api/live`
- Feature/package gating ต้องมาจาก backend state ไม่ควร hardcode ที่ UI

Auth notes:

- Owner login UI post ไปที่ `/owner/api/login`
- Owner identity ใช้ `/owner/api/me`
- Session/auth ยังเป็น cookie/session based

### 48.3 API Groups ฝั่ง Owner

#### A. Auth / Session / Security

Read:

- `GET /owner/api/me`
- `GET /owner/api/auth/sessions`
- `GET /owner/api/auth/security-events?limit=20`

Mutation:

- `POST /owner/api/login`
- `POST /owner/api/logout`
- `POST /owner/api/auth/user`
- `POST /owner/api/auth/session/revoke`

ใช้กับหน้า:

- Login
- Access Control
- Admin Users
- Security Events
- Audit/Security Snapshot

UI ต้องรองรับ state:

- unauthenticated
- unauthorized
- session expired
- permission denied
- 2FA required ถ้ามี
- revoke session success/failure

#### B. Platform Overview

Read:

- `GET /owner/api/platform/overview`
- `GET /owner/api/platform/quota?tenantId=...`
- `GET /owner/api/control-panel/settings`
- `GET /owner/api/runtime/supervisor`
- `GET /owner/api/observability/requests?limit=20&onlyErrors=true`
- `GET /owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000`
- `GET /admin/api/live`

ใช้กับหน้า:

- Owner Overview
- Runtime Health
- Observability
- Diagnostics

UI ต้องแสดง:

- platform status
- tenant counts
- package/subscription summary
- runtime status
- failed request/error signals
- delivery lifecycle risk
- quota/risk state
- last updated timestamp

#### C. Tenant Management

Read:

- `GET /owner/api/platform/tenants?limit=50`
- `GET /owner/api/platform/quota?tenantId=...`
- `GET /admin/api/platform/tenant-support-case?tenantId=...&limit=25`
- `GET /admin/api/delivery/dead-letter?tenantId=...&limit=25`

Mutation:

- `POST /owner/api/platform/tenant`
- `POST /owner/api/platform/server`

ใช้กับหน้า:

- Tenants
- Tenant Detail
- Create Tenant
- Tenant Provisioning
- Support
- Diagnostics

UI ต้องรองรับ:

- create tenant
- update tenant
- suspend/resume tenant ถ้า backend รองรับผ่าน tenant mutation
- create server record
- tenant risk badges
- tenant support context
- tenant runtime/billing/config summary

#### D. Packages / Entitlements / Licenses

Read:

- `GET /owner/api/platform/licenses?limit=50`
- `GET /owner/api/platform/subscriptions?limit=50`
- `GET /owner/api/platform/overview`

Mutation:

- `POST /owner/api/platform/package`
- `POST /owner/api/platform/package/update`
- `POST /owner/api/platform/package/delete`

ใช้กับหน้า:

- Packages
- Package Detail
- Entitlement Matrix
- Tenant Feature Access

UI ต้องแสดง:

- package name/status
- price/billing interval
- feature matrix
- entitlement state
- limits
- preview behavior
- tenant count using package
- package change history ถ้ามี

#### E. Subscriptions

Read:

- `GET /owner/api/platform/subscriptions?limit=50`
- `GET /owner/api/platform/licenses?limit=50`
- `GET /owner/api/platform/billing/overview`

Mutation:

- `POST /owner/api/platform/subscription`
- `POST /owner/api/platform/subscription/update`

ใช้กับหน้า:

- Subscriptions
- Subscription Detail
- Tenant Detail / Subscription Tab
- Billing Overview

UI ต้องรองรับ:

- create subscription
- update subscription
- change package
- cancel/resume if backend supports via update
- extend trial if backend supports via update
- show subscription events if available

#### F. Billing

Read:

- `GET /owner/api/platform/billing/overview`
- `GET /owner/api/platform/billing/invoices?limit=50`
- `GET /owner/api/platform/billing/payment-attempts?limit=50`

Mutation:

- `POST /owner/api/platform/billing/invoice/update`
- `POST /owner/api/platform/billing/payment-attempt/update`
- `POST /owner/api/platform/billing/checkout-session`

ใช้กับหน้า:

- Billing Overview
- Invoice Detail
- Payment Attempt Detail
- Tenant Detail / Billing Tab
- Revenue Summary

UI ต้องแสดง:

- provider config summary
- revenue summary
- invoice status
- payment attempt status
- failed payment reason
- subscription link
- tenant link
- provider reference
- retry/update/checkout result

#### G. Runtime / Agents / Bots

Read:

- `GET /owner/api/platform/agents?limit=50`
- `GET /owner/api/platform/agent-registry?limit=200`
- `GET /owner/api/platform/agent-provisioning?limit=200`
- `GET /owner/api/platform/agent-devices?limit=200`
- `GET /owner/api/platform/agent-credentials?limit=200`
- `GET /owner/api/runtime/supervisor`

Mutation:

- `POST /owner/api/platform/agent-provision`
- `POST /owner/api/platform/agent-device/revoke`
- `POST /owner/api/platform/agent-provision/revoke`
- `POST /owner/api/platform/agent-token/revoke`
- `POST /owner/api/runtime/restart-service`

ใช้กับหน้า:

- Runtime Health
- Agents & Bots
- Delivery Agent Detail
- Server Bot Detail
- Provision Runtime
- Diagnostics
- Platform Controls

สำคัญมาก:

- Delivery Agent ต้องเป็น `execute_only`
- Server Bot ต้องเป็น `sync_only`
- UI ห้ามปน action ระหว่างสอง role นี้

UI ต้องรองรับ:

- create setup token
- copy setup token/install command
- pending activation
- activated
- expired setup token
- revoke setup token
- revoke device
- revoke credential/token
- last heartbeat
- machine binding
- version drift
- runtime scope
- runtime status

#### H. Delivery / Jobs / Dead Letter

Read:

- `GET /owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000`
- `GET /admin/api/delivery/dead-letter?tenantId=...&limit=25`

Mutation:

- `POST /admin/api/delivery/dead-letter/retry`
- `POST /admin/api/delivery/dead-letter/delete`

ใช้กับหน้า:

- Jobs & Queues
- Runtime Health
- Tenant Detail / Diagnostics
- Support

UI ต้องแสดง:

- queue pressure
- pending overdue jobs
- failed jobs
- dead-letter jobs
- retryable jobs
- claimed by runtime
- related tenant
- related order/delivery if available

#### I. Config Jobs

Current Owner read list ยังไม่ได้ expose เป็น `/owner/api/...` แบบชัดใน route map สำหรับ server config jobs

Tenant side มี pattern:

- `GET /admin/api/platform/servers/:serverId/config/jobs?tenantId=...`

Relevant backend:

- `src/services/platformServerConfigService.js`
- `src/config/adminEditableConfig.js`

ใช้กับหน้า:

- Config Jobs
- Tenant Detail / Config Tab
- Diagnostics
- Support

UI ต้องการ data:

- tenant id/name
- server id/name
- config category
- job type: save/apply/rollback/control
- status
- requested by
- requires restart
- backup created
- diff available
- failure reason
- claimed/completed by Server Bot
- timestamps

Recommended API gap:

- `GET /owner/api/platform/config-jobs?limit=...&status=...`
- `GET /owner/api/platform/config-jobs/:id`
- `GET /owner/api/platform/config-jobs/:id/diff`

#### J. Restart Orchestration

Current route map มี tenant-side restart endpoints ชัดกว่า owner-level aggregation

Relevant backend:

- `src/services/platformRestartOrchestrationService.js`

ใช้กับหน้า:

- Restart Plans
- Tenant Detail / Restart Tab
- Runtime Health
- Diagnostics
- Support

UI ต้องการ data:

- tenant
- server
- restart type
- requested by
- scheduled time
- countdown announcements
- Delivery Agent announce readiness
- Server Bot execution readiness
- status
- execution history
- health verification result
- failure reason

Recommended API gap:

- `GET /owner/api/platform/restart-plans?limit=...&status=...`
- `GET /owner/api/platform/restart-executions?limit=...`
- `POST /owner/api/platform/servers/:serverId/restart`
- `POST /owner/api/platform/restart-plans/:id/cancel`

#### K. Backups / Recovery

Read:

- `GET /admin/api/backup/list`
- `GET /admin/api/backup/restore/status`
- `GET /admin/api/backup/restore/history?limit=12`

Mutation:

- `POST /admin/api/backup/create`
- `POST /admin/api/backup/restore`

ใช้กับหน้า:

- Backups & Recovery
- Tenant Detail / Backups Tab
- Recovery
- Platform Controls

UI ต้องรองรับ:

- create backup
- preview restore
- execute restore
- restore in progress
- restore blocked
- restore history
- latest backup
- backup detail
- confirmation before restore

#### L. Notifications

Read:

- `GET /owner/api/notifications?limit=20`

Mutation:

- `POST /owner/api/notifications/ack`
- `POST /owner/api/notifications/clear`

ใช้กับหน้า:

- Notification Center
- Owner Overview
- Runtime Health
- Billing
- Security

UI ต้องแสดง:

- severity
- linked tenant
- linked object
- read/ack state
- created timestamp
- action shortcut

#### M. Automation

Mutation:

- `POST /admin/api/platform/automation/run`

ใช้กับหน้า:

- Automation
- Platform Controls
- Diagnostics

Recommended API gap:

- `GET /owner/api/platform/automation`
- `GET /owner/api/platform/automation/runs?limit=...`
- `POST /owner/api/platform/automation/:id/run`
- `POST /owner/api/platform/automation/:id/pause`

#### N. Player Identity Review

Mutation:

- `POST /admin/api/player/identity/review`

ใช้กับหน้า:

- Tenant Detail / Linked Identities
- Security Events
- Support

UI ต้องรองรับ:

- pending identity review
- approve/reject
- linked Discord/Web/Steam/In-game accounts
- evidence
- audit trail

Recommended API gap:

- `GET /owner/api/player/identity/pending?tenantId=...`
- `GET /owner/api/player/identity/:id`

### 48.4 Page-to-API Map

| Owner Page         | Read APIs                                                                                                                                                                                               | Mutation APIs                                                                                                                         | Key Models                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Owner Overview     | `/owner/api/platform/overview`, `/owner/api/platform/billing/overview`, `/owner/api/runtime/supervisor`, `/owner/api/notifications`, `/owner/api/auth/security-events`, `/owner/api/delivery/lifecycle` | none or quick actions                                                                                                                 | `PlatformTenant`, `PlatformSubscription`, `PlatformAgentRuntime`, `PlatformAdminNotification`, `PlatformAdminSecurityEvent` |
| Tenants            | `/owner/api/platform/tenants`, `/owner/api/platform/subscriptions`, `/owner/api/platform/licenses`, `/owner/api/platform/agents`                                                                        | `/owner/api/platform/tenant`                                                                                                          | `PlatformTenant`, `PlatformSubscription`, `PlatformLicense`, `PlatformAgentRuntime`                                         |
| Tenant Detail      | tenant list + filtered quota/support/dead-letter/billing/runtime data                                                                                                                                   | tenant/subscription/agent/billing/support actions                                                                                     | many tenant-scoped models                                                                                                   |
| Create Tenant      | settings/packages/subscription context                                                                                                                                                                  | `/owner/api/platform/tenant`, `/owner/api/platform/subscription`, `/owner/api/platform/server`, `/owner/api/platform/agent-provision` | `PlatformTenant`, `PlatformSubscription`, `ControlPlaneServer`, `PlatformAgentProvisioningToken`                            |
| Packages           | overview/licenses/subscriptions                                                                                                                                                                         | `/owner/api/platform/package`, `/owner/api/platform/package/update`, `/owner/api/platform/package/delete`                             | `PlatformPackageCatalogEntry`, `PlatformLicense`, `PlatformSubscription`                                                    |
| Entitlements       | package/license/overview state                                                                                                                                                                          | package update                                                                                                                        | package catalog/license/subscription models                                                                                 |
| Subscriptions      | `/owner/api/platform/subscriptions`, `/owner/api/platform/billing/overview`                                                                                                                             | `/owner/api/platform/subscription`, `/owner/api/platform/subscription/update`                                                         | `PlatformSubscription`, `PlatformBillingInvoice`, `PlatformSubscriptionEvent`                                               |
| Billing            | `/owner/api/platform/billing/overview`, `/owner/api/platform/billing/invoices`, `/owner/api/platform/billing/payment-attempts`                                                                          | invoice/payment attempt update, checkout session                                                                                      | `PlatformBillingCustomer`, `PlatformBillingInvoice`, `PlatformBillingPaymentAttempt`                                        |
| Runtime Health     | `/owner/api/platform/agents`, registry/provisioning/devices/credentials, supervisor                                                                                                                     | provision/revoke/restart-service                                                                                                      | `PlatformAgentRuntime`, agent registry models, `PlatformApiKey`                                                             |
| Agents & Bots      | agent registry/provisioning/devices/credentials                                                                                                                                                         | provision/revoke/rotate if supported                                                                                                  | runtime/credential/device/provisioning models                                                                               |
| Jobs & Queues      | delivery lifecycle, dead-letter                                                                                                                                                                         | retry/delete dead-letter                                                                                                              | delivery job/dead-letter models                                                                                             |
| Config Jobs        | recommended owner endpoint needed                                                                                                                                                                       | recommended apply/retry/rollback endpoint needed                                                                                      | `PlatformServerConfigJob`, `PlatformServerConfigSnapshot`, `PlatformServerConfigBackup`                                     |
| Restart Plans      | recommended owner endpoint needed                                                                                                                                                                       | recommended create/cancel endpoint needed                                                                                             | `PlatformRestartPlan`, `PlatformRestartAnnouncement`, `PlatformRestartExecution`                                            |
| Backups & Recovery | backup list/status/history                                                                                                                                                                              | backup create/restore                                                                                                                 | backup/restore state models                                                                                                 |
| Support            | tenant support case, diagnostics, tenant context                                                                                                                                                        | support case actions if exposed                                                                                                       | support case + linked evidence                                                                                              |
| Diagnostics        | overview, quota, agents, delivery lifecycle, security, billing, backup                                                                                                                                  | run diagnostics if exposed                                                                                                            | diagnostic result object                                                                                                    |
| Audit Logs         | audit query endpoint should be owner-level                                                                                                                                                              | none mostly                                                                                                                           | audit/request/security event models                                                                                         |
| Security Events    | `/owner/api/auth/security-events`, sessions, API keys                                                                                                                                                   | revoke session/key/token                                                                                                              | security/session/API key models                                                                                             |
| Access Control     | sessions/users/API keys                                                                                                                                                                                 | auth user/session revoke/API key actions                                                                                              | `PlatformUser`, `PlatformMembership`, `PlatformApiKey`                                                                      |
| Webhooks           | endpoint list if exposed                                                                                                                                                                                | create/update/test/rotate if exposed                                                                                                  | `PlatformWebhookEndpoint`                                                                                                   |
| Notifications      | `/owner/api/notifications`                                                                                                                                                                              | ack/clear                                                                                                                             | `PlatformAdminNotification`                                                                                                 |
| Automation         | recommended owner list/run endpoints                                                                                                                                                                    | automation run                                                                                                                        | `PlatformAutomationState`                                                                                                   |
| Platform Controls  | settings/runtime supervisor                                                                                                                                                                             | env update, restart-service, automation run                                                                                           | control-panel/env/runtime models                                                                                            |
| Settings           | `/owner/api/control-panel/settings`                                                                                                                                                                     | `/owner/api/control-panel/env`                                                                                                        | editable config registry                                                                                                    |

### 48.5 Core DTOs ที่ UI ควรขอจาก Backend

#### Tenant DTO

ควรมี:

- `id`
- `slug`
- `name`
- `status`
- `type`
- `locale`
- `ownerName`
- `ownerEmail`
- `createdAt`
- `updatedAt`
- `packageName`
- `subscriptionStatus`
- `billingStatus`
- `deliveryAgentStatus`
- `serverBotStatus`
- `lastRuntimeSeenAt`
- `riskLevel`
- `riskReasons`

#### Subscription DTO

ควรมี:

- `id`
- `tenantId`
- `packageId`
- `status`
- `billingInterval`
- `startedAt`
- `renewsAt`
- `trialEndsAt`
- `cancelledAt`
- `entitlements`
- `limits`
- `billingCustomerId`
- `latestInvoiceId`
- `riskLevel`

#### Billing Invoice DTO

ควรมี:

- `id`
- `tenantId`
- `subscriptionId`
- `customerId`
- `amount`
- `currency`
- `status`
- `dueAt`
- `paidAt`
- `provider`
- `providerInvoiceId`
- `lineItems`
- `paymentAttempts`
- `riskLevel`

#### Payment Attempt DTO

ควรมี:

- `id`
- `invoiceId`
- `tenantId`
- `provider`
- `status`
- `amount`
- `currency`
- `failureCode`
- `failureMessage`
- `providerReference`
- `createdAt`
- `completedAt`

#### Runtime DTO

ควรมี:

- `id`
- `tenantId`
- `runtimeKey`
- `runtimeKind`
- `role`
- `scope`
- `status`
- `version`
- `machineName`
- `deviceId`
- `lastHeartbeatAt`
- `lastSeenAt`
- `credentialStatus`
- `setupTokenStatus`
- `riskLevel`
- `riskReasons`

#### Agent Provisioning DTO

ควรมี:

- `id`
- `tenantId`
- `runtimeKind`
- `role`
- `scope`
- `tokenPrefix`
- `status`
- `expiresAt`
- `createdAt`
- `activatedAt`
- `revokedAt`
- `deviceBound`

#### Job DTO

ควรมี:

- `id`
- `tenantId`
- `type`
- `status`
- `claimedByRuntimeId`
- `attemptCount`
- `maxAttempts`
- `createdAt`
- `updatedAt`
- `lastError`
- `retryable`
- `deadLetter`

#### Config Job DTO

ควรมี:

- `id`
- `tenantId`
- `serverId`
- `category`
- `jobType`
- `status`
- `requiresRestart`
- `backupId`
- `diffSummary`
- `requestedBy`
- `claimedByServerBot`
- `failureReason`
- `createdAt`
- `completedAt`

#### Restart Plan DTO

ควรมี:

- `id`
- `tenantId`
- `serverId`
- `restartType`
- `status`
- `scheduledAt`
- `countdownEnabled`
- `announcementLanguage`
- `deliveryAgentReady`
- `serverBotReady`
- `executionStatus`
- `healthVerificationStatus`
- `createdBy`
- `createdAt`

#### Backup DTO

ควรมี:

- `id`
- `tenantId`
- `serverId`
- `type`
- `source`
- `size`
- `createdBy`
- `createdAt`
- `relatedConfigJobId`
- `restoreStatus`
- `verificationStatus`

#### Audit Event DTO

ควรมี:

- `id`
- `tenantId`
- `actorId`
- `actorType`
- `action`
- `targetType`
- `targetId`
- `riskLevel`
- `result`
- `ip`
- `sessionId`
- `before`
- `after`
- `createdAt`

#### Security Event DTO

ควรมี:

- `id`
- `eventType`
- `severity`
- `tenantId`
- `actorId`
- `ip`
- `sessionId`
- `message`
- `metadata`
- `createdAt`
- `resolvedAt`

### 48.6 Mutation UX Contract

ทุก mutation ฝั่ง Owner ควร return pattern ที่ UI ใช้ร่วมกันได้:

```json
{
  "ok": true,
  "operationId": "op_...",
  "auditId": "aud_...",
  "status": "queued|completed|failed",
  "message": "Human readable result",
  "data": {},
  "next": {
    "pollUrl": "/owner/api/...",
    "redirectUrl": "/owner/..."
  }
}
```

ถ้า error:

```json
{
  "ok": false,
  "code": "PERMISSION_DENIED",
  "message": "Action requires owner permission",
  "details": {},
  "risk": {
    "level": "high",
    "reasons": []
  }
}
```

### 48.7 Backend States ที่ UI ต้องออกแบบให้ครบ

Common resource states:

- loading
- empty
- loaded
- stale
- failed
- unauthorized
- permission denied
- not found
- partial data

Async operation states:

- queued
- pending
- claimed
- running
- waiting for runtime
- waiting for Server Bot
- waiting for Delivery Agent
- completed
- failed
- retryable
- cancelled
- expired

Risk / blocking states:

- blocked by missing permission
- blocked by inactive subscription
- blocked by missing Server Bot
- blocked by missing Delivery Agent
- blocked by offline runtime
- blocked by stale heartbeat
- blocked by unpaid invoice
- blocked by feature entitlement
- blocked by unsafe restart state

### 48.8 API Gaps สำหรับ Owner Redesign

Current repo มี endpoint หลายตัวแล้ว แต่สำหรับ UI ใหม่ควรเติม aggregation endpoint เพื่อลดการ assemble ฝั่ง browser

#### P0 API Gaps

1. `GET /owner/api/platform/owner-dashboard`

   - รวม platform health, revenue risk, runtime risk, support risk, security risk

2. `GET /owner/api/platform/tenant-dossier/:tenantId`

   - รวม tenant profile, subscription, billing, runtimes, config/restart/backups, support, audit, diagnostics

3. `GET /owner/api/platform/runtime-fleet`

   - รวม Delivery Agent + Server Bot พร้อม risk/status/version/heartbeat

4. `GET /owner/api/platform/risk-queue`

   - รวม at-risk tenants, failed payments, offline runtimes, failed jobs, config/restart failures

5. `GET /owner/api/platform/audit-events`
   - owner-level audit query ที่ filter ได้จริง

#### P1 API Gaps

6. `GET /owner/api/platform/config-jobs`
7. `GET /owner/api/platform/restart-plans`
8. `GET /owner/api/platform/backups`
9. `GET /owner/api/platform/support-cases`
10. `GET /owner/api/platform/diagnostics?tenantId=...`
11. `POST /owner/api/platform/diagnostics/run`
12. `GET /owner/api/platform/entitlements/matrix`

#### P2 API Gaps

13. `GET /owner/api/platform/automation`
14. `GET /owner/api/platform/automation/runs`
15. `GET /owner/api/platform/webhook-deliveries`
16. `GET /owner/api/platform/security-posture`
17. `GET /owner/api/platform/billing/risk-queue`

### 48.9 Backend Rules ที่ UI ต้องเคารพ

1. ห้ามให้ UI ตัดสิน entitlement เอง ต้องอิง backend entitlement state
2. ห้ามปน Delivery Agent กับ Server Bot
3. Restart/config/backup action ต้องมี audit event
4. Action ที่ต้องใช้ Server Bot ต้อง block ถ้า Server Bot offline
5. Action ที่ต้อง announce ในเกมต้อง warning ถ้า Delivery Agent offline
6. Setup token เป็น one-time secret ต้องโชว์ครั้งเดียว และมี expiry
7. Credential/API key ต้องโชว์ prefix/status ไม่โชว์ secret เต็ม
8. Billing action ต้องผูก invoice/payment attempt/subscription/tenant ชัดเจน
9. Tenant-scoped data ต้องมี tenant id/slug ใน response เพื่อป้องกันสับสน
10. Owner UI ต้องรองรับ partial failure เพราะหลาย endpoint เป็น optional/fallback ใน frontend ปัจจุบัน

### 48.10 Recommended Backend Contract สำหรับ New Owner UI

#### List Endpoint Pattern

```text
GET /owner/api/platform/{resource}?limit=50&cursor=...&tenantId=...&status=...
```

Response:

```json
{
  "items": [],
  "page": {
    "limit": 50,
    "nextCursor": null
  },
  "summary": {},
  "generatedAt": "2026-04-22T00:00:00.000Z"
}
```

#### Detail Endpoint Pattern

```text
GET /owner/api/platform/{resource}/{id}
```

Response:

```json
{
  "item": {},
  "related": {},
  "permissions": {},
  "availableActions": [],
  "generatedAt": "2026-04-22T00:00:00.000Z"
}
```

#### Mutation Endpoint Pattern

```text
POST /owner/api/platform/{resource}/{action}
```

Response:

```json
{
  "ok": true,
  "operationId": "op_...",
  "auditId": "aud_...",
  "status": "queued",
  "jobId": "job_...",
  "message": "Queued successfully"
}
```

### 48.11 API Priority สำหรับ UI Redesign

ต้องใช้ก่อนออกแบบ 5 หน้าแรก:

1. `GET /owner/api/platform/overview`
2. `GET /owner/api/platform/tenants?limit=50`
3. `GET /owner/api/platform/subscriptions?limit=50`
4. `GET /owner/api/platform/billing/overview`
5. `GET /owner/api/platform/billing/invoices?limit=50`
6. `GET /owner/api/platform/billing/payment-attempts?limit=50`
7. `GET /owner/api/platform/agents?limit=50`
8. `GET /owner/api/platform/agent-registry?limit=200`
9. `GET /owner/api/platform/agent-provisioning?limit=200`
10. `GET /owner/api/runtime/supervisor`
11. `GET /owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000`
12. `GET /owner/api/auth/security-events?limit=20`
13. `GET /owner/api/notifications?limit=20`

ควรเพิ่มเพื่อให้ UI ใหม่ไม่ซับซ้อน:

1. `GET /owner/api/platform/tenant-dossier/:tenantId`
2. `GET /owner/api/platform/runtime-fleet`
3. `GET /owner/api/platform/risk-queue`
4. `GET /owner/api/platform/config-jobs`
5. `GET /owner/api/platform/restart-plans`
6. `GET /owner/api/platform/audit-events`
7. `GET /owner/api/platform/entitlements/matrix`

## 49. Actual API Payload Examples

ตัวอย่าง payload ด้านล่างเป็นรูปแบบที่ UI ใหม่ควรขอหรือ normalize จาก backend เพื่อให้หน้า Owner ทำงานง่ายขึ้น ไม่ใช่การยืนยันว่า response ปัจจุบันตรงทุก field แล้ว ต้องตรวจ endpoint จริงก่อน implement

### 49.1 Owner Dashboard Payload

Endpoint ที่แนะนำ:

```text
GET /owner/api/platform/owner-dashboard
```

```json
{
  "generatedAt": "2026-04-22T10:30:00.000+07:00",
  "platform": {
    "status": "degraded",
    "riskLevel": "high",
    "riskReasons": ["3 server bots offline", "5 unpaid invoices"]
  },
  "tenants": {
    "total": 128,
    "active": 104,
    "preview": 11,
    "trial": 7,
    "suspended": 6,
    "atRisk": 14
  },
  "revenue": {
    "currency": "THB",
    "mrr": 184500,
    "activeSubscriptions": 98,
    "unpaidInvoices": 5,
    "failedPayments": 3,
    "trialEndingSoon": 4
  },
  "runtime": {
    "deliveryAgentsOnline": 89,
    "deliveryAgentsOffline": 9,
    "serverBotsOnline": 92,
    "serverBotsOffline": 3,
    "outdatedRuntimes": 6,
    "staleHeartbeats": 5
  },
  "operations": {
    "failedJobs": 8,
    "deadLetterJobs": 4,
    "pendingRestartPlans": 2,
    "failedConfigJobs": 3
  },
  "security": {
    "openSecurityEvents": 4,
    "failedLogins24h": 11,
    "apiKeysNeedingRotation": 2
  },
  "support": {
    "openCases": 12,
    "highPriorityCases": 3,
    "waitingOwnerAction": 4
  }
}
```

### 49.2 Tenant List Payload

Endpoint ปัจจุบัน:

```text
GET /owner/api/platform/tenants?limit=50
```

```json
{
  "items": [
    {
      "id": "tenant_01",
      "slug": "bangkok-survival",
      "name": "Bangkok Survival",
      "status": "active",
      "locale": "th",
      "ownerEmail": "owner@example.com",
      "package": { "id": "pkg_pro", "name": "Pro", "status": "active" },
      "subscription": {
        "id": "sub_01",
        "status": "active",
        "renewsAt": "2026-05-22T00:00:00.000+07:00"
      },
      "billing": {
        "status": "paid",
        "latestInvoiceId": "inv_01",
        "failedPaymentCount": 0
      },
      "runtime": {
        "deliveryAgent": {
          "status": "online",
          "version": "1.8.2",
          "lastSeenAt": "2026-04-22T10:28:00.000+07:00"
        },
        "serverBot": {
          "status": "offline",
          "version": "1.8.0",
          "lastSeenAt": "2026-04-22T08:41:00.000+07:00"
        }
      },
      "risk": {
        "level": "high",
        "badges": ["Server Bot Offline", "Config Jobs Waiting"],
        "reasons": ["Server Bot heartbeat stale for 109 minutes"]
      }
    }
  ],
  "page": { "limit": 50, "nextCursor": null },
  "summary": { "total": 128, "atRisk": 14 }
}
```

### 49.3 Tenant Dossier Payload

Endpoint ที่แนะนำ:

```text
GET /owner/api/platform/tenant-dossier/:tenantId
```

```json
{
  "tenant": {
    "id": "tenant_01",
    "slug": "bangkok-survival",
    "name": "Bangkok Survival",
    "status": "active",
    "locale": "th",
    "timezone": "Asia/Bangkok",
    "ownerEmail": "owner@example.com"
  },
  "subscription": {
    "id": "sub_01",
    "packageId": "pkg_pro",
    "packageName": "Pro",
    "status": "active",
    "billingInterval": "monthly",
    "renewsAt": "2026-05-22T00:00:00.000+07:00",
    "entitlements": {
      "configEditor": true,
      "restartControl": true,
      "donations": true,
      "events": true,
      "raidSystem": true
    }
  },
  "billing": {
    "customerId": "cus_01",
    "status": "paid",
    "latestInvoice": {
      "id": "inv_01",
      "status": "paid",
      "amount": 2490,
      "currency": "THB"
    }
  },
  "runtimes": {
    "deliveryAgents": [
      {
        "id": "rt_delivery_01",
        "status": "online",
        "version": "1.8.2",
        "scope": "execute_only"
      }
    ],
    "serverBots": [
      {
        "id": "rt_serverbot_01",
        "status": "offline",
        "version": "1.8.0",
        "scope": "sync_only"
      }
    ]
  },
  "operations": {
    "openConfigJobs": 2,
    "pendingRestartPlans": 1,
    "failedJobs": 1,
    "latestBackupAt": "2026-04-21T23:00:00.000+07:00"
  },
  "support": { "openCases": 1, "latestCaseId": "case_01" },
  "risk": {
    "level": "high",
    "badges": ["Server Bot Offline", "Restart Blocked"],
    "recommendedActions": [
      "Open runtime diagnostics",
      "Regenerate Server Bot setup token if machine changed"
    ]
  }
}
```

### 49.4 Package / Entitlement Payload

Endpoint ที่แนะนำ:

```text
GET /owner/api/platform/entitlements/matrix
```

```json
{
  "packages": [
    {
      "id": "pkg_basic",
      "name": "Basic",
      "status": "active",
      "priceMonthly": 990,
      "currency": "THB"
    },
    { "id": "pkg_pro", "name": "Pro", "status": "active", "priceMonthly": 2490, "currency": "THB" }
  ],
  "features": [
    {
      "key": "shop",
      "group": "Commerce",
      "label": "Shop",
      "packages": {
        "pkg_basic": { "state": "enabled", "limit": "50 items" },
        "pkg_pro": { "state": "enabled", "limit": "unlimited" }
      }
    },
    {
      "key": "restartControl",
      "group": "Server Operations",
      "label": "Restart Control",
      "packages": {
        "pkg_basic": { "state": "locked", "limit": null },
        "pkg_pro": { "state": "enabled", "limit": "30 restarts/month" }
      }
    }
  ]
}
```

### 49.5 Billing Payload

Endpoints ปัจจุบัน:

```text
GET /owner/api/platform/billing/overview
GET /owner/api/platform/billing/invoices?limit=50
GET /owner/api/platform/billing/payment-attempts?limit=50
```

```json
{
  "id": "inv_01",
  "tenantId": "tenant_01",
  "tenantName": "Bangkok Survival",
  "subscriptionId": "sub_01",
  "customerId": "cus_01",
  "status": "unpaid",
  "amount": 2490,
  "currency": "THB",
  "dueAt": "2026-04-25T00:00:00.000+07:00",
  "provider": "stripe",
  "providerInvoiceId": "in_123",
  "lineItems": [{ "label": "Pro Package - Monthly", "quantity": 1, "amount": 2490 }],
  "paymentAttempts": [
    {
      "id": "payatt_01",
      "status": "failed",
      "failureCode": "card_declined",
      "failureMessage": "Card was declined"
    }
  ],
  "risk": {
    "level": "high",
    "badges": ["Payment Failed", "Due Soon"]
  }
}
```

### 49.6 Runtime Fleet Payload

Endpoint ที่แนะนำ:

```text
GET /owner/api/platform/runtime-fleet
```

```json
{
  "items": [
    {
      "id": "rt_delivery_01",
      "tenantId": "tenant_01",
      "tenantName": "Bangkok Survival",
      "runtimeKind": "delivery-agent",
      "role": "execute",
      "scope": "execute_only",
      "status": "online",
      "version": "1.8.2",
      "latestVersion": "1.8.2",
      "machineName": "SHOP-PC-01",
      "lastHeartbeatAt": "2026-04-22T10:28:00.000+07:00",
      "credentialStatus": "active",
      "capabilities": ["delivery_jobs", "in_game_announce"],
      "risk": { "level": "low", "badges": [] }
    },
    {
      "id": "rt_serverbot_01",
      "tenantId": "tenant_01",
      "tenantName": "Bangkok Survival",
      "runtimeKind": "server-bot",
      "role": "sync",
      "scope": "sync_only",
      "status": "offline",
      "version": "1.8.0",
      "latestVersion": "1.8.2",
      "machineName": "SERVER-BOX-01",
      "lastHeartbeatAt": "2026-04-22T08:41:00.000+07:00",
      "credentialStatus": "active",
      "capabilities": ["log_sync", "config_apply", "backup", "restart"],
      "risk": { "level": "high", "badges": ["Offline", "Outdated"] }
    }
  ],
  "summary": {
    "deliveryAgentsOnline": 89,
    "serverBotsOnline": 92,
    "offline": 12,
    "outdated": 6
  }
}
```

### 49.7 Agent Provisioning Payload

Mutation ปัจจุบัน:

```text
POST /owner/api/platform/agent-provision
```

Request:

```json
{
  "tenantId": "tenant_01",
  "runtimeKind": "server-bot",
  "label": "Primary Server Bot",
  "expiresInHours": 72
}
```

Response:

```json
{
  "ok": true,
  "provisioning": {
    "id": "prov_01",
    "tenantId": "tenant_01",
    "runtimeKind": "server-bot",
    "role": "sync",
    "scope": "sync_only",
    "status": "pending",
    "tokenPrefix": "stp_abc",
    "setupToken": "stp_abc.full-secret-visible-once",
    "expiresAt": "2026-04-25T10:30:00.000+07:00"
  },
  "install": {
    "command": "npm run runtime:install:server-bot -- --setup-token stp_abc.full-secret-visible-once",
    "notes": ["Setup token is visible once", "Machine will be bound during activation"]
  }
}
```

### 49.8 Jobs / Config / Restart / Backup / Audit Payloads

Delivery lifecycle:

```json
{
  "summary": { "pending": 18, "overdue": 3, "completed24h": 420, "failed24h": 5, "deadLetter": 4 },
  "items": [
    {
      "id": "job_01",
      "tenantId": "tenant_01",
      "type": "delivery",
      "status": "pending",
      "orderCode": "ORD-1001",
      "claimedByRuntimeId": null,
      "createdAt": "2026-04-22T10:00:00.000+07:00",
      "overdue": true,
      "riskLevel": "medium"
    }
  ]
}
```

Config job:

```json
{
  "id": "cfgjob_01",
  "tenantId": "tenant_01",
  "serverId": "srv_01",
  "category": "server-settings",
  "jobType": "apply",
  "status": "failed",
  "requiresRestart": true,
  "backupId": "backup_01",
  "diffSummary": { "changedFields": 4, "restartRequiredFields": 2 },
  "claimedByServerBot": "rt_serverbot_01",
  "failureReason": "Server Bot offline before apply"
}
```

Restart plan:

```json
{
  "id": "restart_01",
  "tenantId": "tenant_01",
  "serverId": "srv_01",
  "restartType": "safe_restart",
  "status": "blocked",
  "scheduledAt": "2026-04-22T11:00:00.000+07:00",
  "countdownEnabled": true,
  "announcementLanguage": "th",
  "deliveryAgentReady": true,
  "serverBotReady": false,
  "blockers": ["Server Bot offline"]
}
```

Backup:

```json
{
  "id": "backup_01",
  "tenantId": "tenant_01",
  "serverId": "srv_01",
  "type": "config",
  "source": "server-bot",
  "sizeBytes": 124000,
  "createdAt": "2026-04-21T23:00:00.000+07:00",
  "relatedConfigJobId": "cfgjob_01",
  "restoreStatus": "available",
  "verificationStatus": "verified"
}
```

Audit event:

```json
{
  "id": "audit_01",
  "tenantId": "tenant_01",
  "actorId": "user_01",
  "actorType": "owner_user",
  "action": "restart.schedule",
  "targetType": "restart_plan",
  "targetId": "restart_01",
  "riskLevel": "high",
  "result": "success",
  "ip": "203.0.113.10",
  "createdAt": "2026-04-22T10:10:00.000+07:00"
}
```

Security event:

```json
{
  "id": "secevt_01",
  "eventType": "setup_token_reused",
  "severity": "high",
  "tenantId": "tenant_01",
  "ip": "203.0.113.20",
  "message": "Setup token was attempted after it was consumed",
  "metadata": { "tokenPrefix": "stp_abc", "runtimeKind": "server-bot" },
  "createdAt": "2026-04-22T10:18:00.000+07:00"
}
```

Notification:

```json
{
  "id": "notif_01",
  "type": "runtime",
  "severity": "critical",
  "tenantId": "tenant_01",
  "title": "Server Bot offline",
  "message": "Bangkok Survival server bot has not sent a heartbeat for 109 minutes.",
  "status": "unread",
  "linkedObject": {
    "type": "runtime",
    "id": "rt_serverbot_01",
    "url": "/owner/runtime/agents-bots/rt_serverbot_01"
  },
  "createdAt": "2026-04-22T10:20:00.000+07:00"
}
```

Diagnostics:

```json
{
  "tenantId": "tenant_01",
  "generatedAt": "2026-04-22T10:30:00.000+07:00",
  "overall": { "status": "failed", "riskLevel": "high" },
  "checks": [
    { "key": "subscription.active", "label": "Subscription active", "status": "pass" },
    {
      "key": "runtime.serverBotOnline",
      "label": "Server Bot online",
      "status": "fail",
      "message": "Last heartbeat was 109 minutes ago",
      "recommendedAction": "Open runtime detail"
    }
  ]
}
```

## 50. Permission / Role Matrix

ใช้ matrix นี้เป็น baseline สำหรับออกแบบ Owner UI ใหม่ ต้อง sync กับ backend permission จริงก่อน implement

### 50.1 Owner Roles

| Role              | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| Owner             | สิทธิ์สูงสุดของ platform                                                  |
| Platform Admin    | จัดการ tenants, packages, subscriptions, settings ส่วนใหญ่                |
| Operations Admin  | จัดการ runtimes, jobs, config, restart, backup                            |
| Billing Admin     | จัดการ billing, invoices, subscriptions, payment attempts                 |
| Support           | ดู tenant context, diagnostics, support cases, retry non-destructive jobs |
| Security Admin    | ดู security events, sessions, API keys, audit, revoke access              |
| Read-only Auditor | อ่านข้อมูลและ audit เท่านั้น                                              |

### 50.2 Page Access Matrix

| Page               | Owner | Platform Admin | Ops Admin    | Billing Admin | Support      | Security Admin   | Auditor |
| ------------------ | ----- | -------------- | ------------ | ------------- | ------------ | ---------------- | ------- |
| Overview           | full  | read           | read         | read          | read         | read             | read    |
| Tenants            | full  | full           | read         | read          | read         | read             | read    |
| Tenant Detail      | full  | full           | ops-only     | billing-only  | support-only | security-only    | read    |
| Packages           | full  | full           | read         | read          | read         | read             | read    |
| Entitlements       | full  | full           | read         | read          | read         | read             | read    |
| Subscriptions      | full  | full           | read         | full          | read         | read             | read    |
| Billing            | full  | read           | read         | full          | read         | read             | read    |
| Runtime Health     | full  | read           | full         | read          | read         | read             | read    |
| Agents & Bots      | full  | read           | full         | read          | read         | security-revoke  | read    |
| Jobs & Queues      | full  | read           | full         | read          | retry-safe   | read             | read    |
| Config Jobs        | full  | read           | full         | read          | read         | read             | read    |
| Restart Plans      | full  | read           | full         | read          | read         | read             | read    |
| Backups & Recovery | full  | read           | full         | read          | read         | read             | read    |
| Incidents          | full  | full           | full         | read          | full         | read             | read    |
| Support            | full  | full           | read         | read          | full         | read             | read    |
| Diagnostics        | full  | full           | full         | read          | full         | read             | read    |
| Audit Logs         | full  | read           | read         | read          | read         | full             | read    |
| Security Events    | full  | read           | read         | read          | read         | full             | read    |
| Access Control     | full  | limited        | none         | none          | none         | full             | read    |
| API Keys           | full  | limited        | none         | none          | none         | full             | read    |
| Webhooks           | full  | full           | read         | read          | none         | full             | read    |
| Notifications      | full  | full           | own/ops      | own/billing   | own/support  | own/security     | read    |
| Automation         | full  | full           | ops-only     | billing-only  | support-only | security-only    | read    |
| Platform Controls  | full  | limited        | limited      | none          | none         | security-limited | read    |
| Settings           | full  | full           | runtime-only | billing-only  | none         | security-only    | read    |

### 50.3 Action Permission Matrix

| Action                    | Required Role                          | Confirmation | Audit Required | Notes                                      |
| ------------------------- | -------------------------------------- | ------------ | -------------- | ------------------------------------------ |
| Create tenant             | Owner / Platform Admin                 | normal       | yes            | show package/billing/runtime setup summary |
| Suspend tenant            | Owner / Platform Admin                 | high-risk    | yes            | require typed confirmation                 |
| Resume tenant             | Owner / Platform Admin                 | normal       | yes            | show billing/subscription state            |
| Change package            | Owner / Platform Admin / Billing Admin | medium       | yes            | show entitlement diff                      |
| Create subscription       | Owner / Billing Admin                  | medium       | yes            | show invoice/customer impact               |
| Cancel subscription       | Owner / Billing Admin                  | high-risk    | yes            | require reason                             |
| Retry payment             | Owner / Billing Admin                  | normal       | yes            | show last failure                          |
| Mark invoice paid         | Owner / Billing Admin                  | high-risk    | yes            | manual provider mode only                  |
| Create package            | Owner / Platform Admin                 | medium       | yes            | package may affect sales                   |
| Delete/archive package    | Owner                                  | high-risk    | yes            | block if active tenants unless archive     |
| Provision Delivery Agent  | Owner / Ops Admin                      | medium       | yes            | creates one-time setup token               |
| Provision Server Bot      | Owner / Ops Admin                      | medium       | yes            | creates one-time setup token               |
| Revoke setup token        | Owner / Ops Admin / Security Admin     | medium       | yes            | show affected runtime                      |
| Revoke device             | Owner / Ops Admin / Security Admin     | high-risk    | yes            | may disconnect runtime                     |
| Revoke runtime credential | Owner / Ops Admin / Security Admin     | high-risk    | yes            | may stop service                           |
| Retry delivery job        | Owner / Ops Admin / Support            | normal       | yes            | only if retryable                          |
| Delete dead-letter job    | Owner / Ops Admin                      | high-risk    | yes            | require reason                             |
| Apply config              | Owner / Ops Admin                      | high-risk    | yes            | require diff + backup                      |
| Rollback config           | Owner / Ops Admin                      | high-risk    | yes            | require backup selection                   |
| Restart server            | Owner / Ops Admin                      | high-risk    | yes            | block if Server Bot offline                |
| Restore backup            | Owner / Ops Admin                      | critical     | yes            | require typed confirmation                 |
| Revoke session            | Owner / Security Admin                 | medium       | yes            | show user/session                          |
| Revoke API key            | Owner / Security Admin                 | high-risk    | yes            | show integrations impacted                 |
| Rotate webhook secret     | Owner / Security Admin                 | high-risk    | yes            | show delivery impact                       |
| Run automation now        | Owner / scoped admin                   | medium       | yes            | show target tenants                        |
| Restart platform service  | Owner                                  | critical     | yes            | platform control only                      |
| Edit environment setting  | Owner / scoped admin                   | high-risk    | yes            | secret fields masked                       |

### 50.4 UI Permission Rules

1. ถ้าไม่มีสิทธิ์ ให้ซ่อน action หรือ disable พร้อม tooltip เหตุผล
2. ถ้า action มี risk ระดับ high/critical ต้องเปิด confirmation modal
3. critical action ต้องพิมพ์ confirm phrase เช่น tenant slug หรือ action name
4. ทุก mutation ต้องมี audit event id หรือ operation id กลับมาแสดง
5. Owner UI ต้องแสดง `availableActions` จาก backend เมื่อมี เพื่อไม่ให้ frontend เดาสิทธิ์เอง

## 51. Package / Entitlement Matrix

Matrix นี้เป็น template สำหรับออกแบบ UI และคุย backend/package catalog ต่อ ไม่ใช่ข้อมูล package จริงที่ยืนยันแล้ว

### 51.1 Package Tiers แนะนำ

| Package    | Target               | Position                                    |
| ---------- | -------------------- | ------------------------------------------- |
| Preview    | ทดลองก่อนซื้อ        | เห็น feature บางส่วนแบบ locked/sample       |
| Starter    | server เล็ก          | shop/delivery basic                         |
| Growth     | server กลาง          | เพิ่ม stats/events/donations                |
| Pro        | server จริงจัง       | config/restart/raid/automation              |
| Enterprise | managed service เต็ม | custom limits, support, advanced operations |

### 51.2 Feature Groups

| Group               | Features                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| Commerce            | shop, wallet, orders, delivery, purchase history                            |
| Runtime             | Delivery Agent, Server Bot, heartbeat, credentials, runtime diagnostics     |
| Server Operations   | config editor, backup, rollback, restart now, delayed restart, safe restart |
| Community           | donations, supporters, events, bot modules                                  |
| Player Intelligence | stats, leaderboard, killfeed, player profile, linked identities             |
| Raid                | raid request, raid window, raid summary                                     |
| Integrations        | Discord, Steam linking, web identity, webhook                               |
| Governance          | audit logs, security events, role permissions, staff access                 |
| Automation          | scheduled checks, alerts, support escalation, package sync                  |
| Analytics           | revenue, activity, runtime health, operational trends                       |

### 51.3 Entitlement Matrix Template

| Feature             | Preview        | Starter     | Growth            | Pro         | Enterprise |
| ------------------- | -------------- | ----------- | ----------------- | ----------- | ---------- |
| Player Portal       | sample         | enabled     | enabled           | enabled     | enabled    |
| Shop                | locked preview | 50 items    | 200 items         | unlimited   | unlimited  |
| Wallet              | sample         | enabled     | enabled           | enabled     | enabled    |
| Orders              | sample         | enabled     | enabled           | enabled     | enabled    |
| Delivery Agent      | locked         | 1 runtime   | 1 runtime         | 2 runtimes  | custom     |
| Delivery Queue      | sample         | basic       | standard          | priority    | priority   |
| In-game Announce    | locked         | locked      | limited           | enabled     | enabled    |
| Server Bot          | locked         | locked      | 1 runtime         | 1 runtime   | custom     |
| SCUM.log Sync       | locked         | locked      | enabled           | enabled     | enabled    |
| Config Editor       | locked         | locked      | read-only         | edit/apply  | edit/apply |
| Config Backup       | locked         | locked      | manual            | auto/manual | custom     |
| Config Rollback     | locked         | locked      | locked            | enabled     | enabled    |
| Restart Now         | locked         | locked      | locked            | enabled     | enabled    |
| Delayed Restart     | locked         | locked      | locked            | enabled     | enabled    |
| Safe Restart        | locked         | locked      | locked            | enabled     | enabled    |
| Countdown Announce  | locked         | locked      | locked            | enabled     | enabled    |
| Donations           | locked preview | locked      | enabled           | enabled     | enabled    |
| Events              | locked preview | locked      | 3 active          | 10 active   | custom     |
| Bot Modules         | locked         | basic       | standard          | advanced    | custom     |
| Player Stats        | sample         | 7 days      | 30 days           | 180 days    | custom     |
| Leaderboard         | sample         | basic       | standard          | advanced    | custom     |
| Killfeed            | sample         | locked      | enabled           | enabled     | enabled    |
| Raid Request        | locked         | locked      | locked            | enabled     | enabled    |
| Raid Window         | locked         | locked      | locked            | enabled     | enabled    |
| Raid Summary        | locked         | locked      | locked            | enabled     | enabled    |
| Discord Integration | sample         | basic       | standard          | advanced    | custom     |
| Linked Identities   | sample         | Discord/Web | Discord/Web/Steam | all         | all        |
| Audit Logs          | sample         | 7 days      | 30 days           | 180 days    | custom     |
| Analytics           | sample         | basic       | standard          | advanced    | custom     |
| Automation          | locked         | locked      | locked            | basic       | advanced   |
| Support Diagnostics | sample         | basic       | standard          | advanced    | managed    |
| API Keys/Webhooks   | locked         | locked      | limited           | enabled     | custom     |

### 51.4 Entitlement State Names

| State            | Meaning                      | UI Treatment                      |
| ---------------- | ---------------------------- | --------------------------------- |
| `enabled`        | ใช้ได้เต็ม                   | normal state                      |
| `limited`        | ใช้ได้แต่มี limit            | show limit badge                  |
| `read_only`      | ดูได้แต่แก้ไม่ได้            | disabled actions with explanation |
| `preview_locked` | เห็นตัวอย่าง แต่ต้อง upgrade | locked overlay + upgrade CTA      |
| `locked`         | ไม่มีสิทธิ์                  | locked state                      |
| `hidden`         | ไม่ควรแสดงใน package นี้     | hide from tenant/player UI        |

### 51.5 Limit Model ที่ UI ควรรองรับ

```json
{
  "feature": "events",
  "state": "limited",
  "limits": {
    "activeEvents": 3,
    "monthlyParticipants": 500,
    "retentionDays": 30
  },
  "usage": {
    "activeEvents": 2,
    "monthlyParticipants": 410
  }
}
```

### 51.6 Package Change UX Requirements

เมื่อ Owner เปลี่ยน package ให้ tenant ต้องแสดง:

- current package
- new package
- price difference
- billing impact
- feature gained
- feature lost
- limits reduced
- active usage that exceeds new limits
- preview/locked behavior after change
- confirmation before apply

## 52. Owner User Flows

### 52.1 Create Tenant Flow

Goal: สร้าง tenant ใหม่พร้อม package, subscription, runtime setup และ billing baseline

Steps:

1. Owner opens `Create Tenant`
2. Fill tenant info: name, slug, owner email, locale, timezone
3. Select package: Preview/Starter/Growth/Pro/Enterprise
4. Select billing mode: trial, preview, paid, manual invoice
5. Optional: create server record
6. Optional: generate Delivery Agent setup token
7. Optional: generate Server Bot setup token
8. Review summary
9. Confirm create
10. Show created state with next steps

APIs:

- `POST /owner/api/platform/tenant`
- `POST /owner/api/platform/subscription`
- `POST /owner/api/platform/server`
- `POST /owner/api/platform/agent-provision`

Acceptance:

- tenant detail opens after create
- setup token visible once only
- audit event created
- risk summary visible if runtime not activated

### 52.2 Provision Delivery Agent Flow

Goal: ออก setup token สำหรับเครื่องที่เปิด SCUM game client เพื่อทำ delivery jobs และ announce

Steps:

1. Select tenant
2. Select `Delivery Agent`
3. Backend resolves role/scope as `execute` / `execute_only`
4. Generate setup token
5. Show install command
6. Wait for activation
7. Runtime activates and binds machine
8. UI shows online/last heartbeat/version

APIs:

- `POST /owner/api/platform/agent-provision`
- `GET /owner/api/platform/agent-provisioning?limit=200`
- `GET /owner/api/platform/agents?limit=50`

Blocked conditions:

- tenant not active
- package does not include Delivery Agent
- setup token already active if policy only allows one
- current runtime credential compromised

UI warnings:

- Delivery Agent cannot edit server config
- Delivery Agent cannot restart server
- Delivery Agent may announce countdown if allowed

### 52.3 Provision Server Bot Flow

Goal: ออก setup token สำหรับ server-side machine เพื่อ sync logs, edit config, backup, restart/start/stop

Steps:

1. Select tenant
2. Select `Server Bot`
3. Backend resolves role/scope as `sync` / `sync_only`
4. Generate setup token
5. Show install command
6. Wait for activation
7. Runtime activates and binds machine
8. UI verifies log sync/config/restart capability

APIs:

- `POST /owner/api/platform/agent-provision`
- `GET /owner/api/platform/agent-registry?limit=200`
- `GET /owner/api/runtime/supervisor`

UI warnings:

- Server Bot cannot handle item delivery
- Server Bot is required for config apply, backup, restart/start/stop

### 52.4 Change Package Flow

Steps:

1. Open Tenant Detail > Subscription or Packages
2. Click Change Package
3. Select target package
4. Backend returns package diff
5. UI shows gained/lost features and limit changes
6. UI warns about active usage exceeding new package
7. Confirm change
8. Backend updates subscription/license/entitlements
9. UI refreshes Tenant Detail

APIs:

- `GET /owner/api/platform/entitlements/matrix`
- `POST /owner/api/platform/subscription/update`

Critical UI:

- never apply package change without diff
- show locked features after downgrade
- audit event required

### 52.5 Failed Payment Recovery Flow

Steps:

1. Open Billing Risk Queue
2. Select failed invoice/payment attempt
3. Review tenant/subscription/invoice/payment history
4. Choose action: retry, send checkout link, mark manual, create support case
5. Confirm action
6. Show provider response
7. Log event and update risk queue

APIs:

- `GET /owner/api/platform/billing/invoices?limit=50`
- `GET /owner/api/platform/billing/payment-attempts?limit=50`
- `POST /owner/api/platform/billing/payment-attempt/update`
- `POST /owner/api/platform/billing/invoice/update`
- `POST /owner/api/platform/billing/checkout-session`

### 52.6 Restart Server Flow

Steps:

1. Open Tenant Detail > Restart or Restart Plans
2. Select restart type: now, delayed, safe restart
3. Backend checks Server Bot readiness
4. Backend checks Delivery Agent readiness for countdown announce
5. UI shows blockers/warnings
6. Owner confirms
7. Restart plan created
8. Countdown announcements sent if enabled
9. Server Bot executes restart
10. Health verification runs
11. UI shows completed/failed result

UI blockers:

- Server Bot offline: block
- Delivery Agent offline: warn for announce
- active queue: warn
- missing permission: block

### 52.7 Restore Backup Flow

Steps:

1. Open Recovery or Tenant Detail > Backups
2. Select backup
3. Preview restore
4. Show affected config/files
5. Require typed confirmation
6. Create restore job
7. Wait for Server Bot if tenant/server restore
8. Verify result
9. Show audit event and restore history

APIs:

- `GET /admin/api/backup/list`
- `POST /admin/api/backup/restore` with preview mode
- `POST /admin/api/backup/restore` execute
- `GET /admin/api/backup/restore/status`
- `GET /admin/api/backup/restore/history?limit=12`

### 52.8 Support Case Flow

Steps:

1. Open Support
2. Search tenant or select case
3. Load tenant health, billing, runtime, jobs, audit, diagnostics
4. Add note or attach diagnostics
5. Run targeted diagnostic if needed
6. Create linked action: retry job, regenerate token, send billing link, escalate incident
7. Resolve or escalate

APIs:

- `GET /admin/api/platform/tenant-support-case?tenantId=...`
- `GET /owner/api/platform/quota?tenantId=...`
- `GET /admin/api/delivery/dead-letter?tenantId=...`
- recommended `GET /owner/api/platform/tenant-dossier/:tenantId`

### 52.9 Diagnostics Flow

Steps:

1. Select tenant or full platform
2. Click Run Diagnostics
3. Backend runs checks
4. UI shows pass/warn/fail checklist
5. UI offers recommended actions
6. User can attach result to support case

Recommended APIs:

- `GET /owner/api/platform/diagnostics?tenantId=...`
- `POST /owner/api/platform/diagnostics/run`

### 52.10 Suspend Tenant Flow

Steps:

1. Open Tenant Detail
2. Click Suspend Tenant
3. UI shows impact: portal access, runtime actions, billing, player access
4. User selects reason
5. User types tenant slug
6. Confirm
7. Backend updates tenant status
8. UI shows suspended state and audit event

### 52.11 Rotate/Revoke Credential Flow

Steps:

1. Open Runtime Detail
2. Review tenant, runtime kind, machine binding, last heartbeat
3. Choose rotate/revoke
4. UI shows impact
5. Confirm
6. Backend revokes token/device/credential
7. Optional: create replacement setup token
8. UI waits for reactivation

APIs:

- `POST /owner/api/platform/agent-device/revoke`
- `POST /owner/api/platform/agent-token/revoke`
- `POST /owner/api/platform/agent-provision/revoke`
- `POST /owner/api/platform/agent-provision`

### 52.12 Incident Response Flow

Steps:

1. Signal appears from notification, observability, runtime health, security event, support case
2. Owner opens incident workspace
3. Link tenant/runtime/jobs/audit/security events
4. Assign severity and owner
5. Execute remediation
6. Track timeline
7. Resolve and attach postmortem note

## 53. UI Copy / i18n Map

ต้องย้าย copy ไปเป็น translation keys แทน hardcoded strings โดยรองรับ English + Thai เป็น baseline

### 53.1 Naming Rules

- ใช้ key แบบ namespace ชัดเจน เช่น `owner.overview.title`
- หลีกเลี่ยง sentence ที่ฝัง dynamic data แบบ string concat
- ใช้ interpolation เช่น `{tenantName}`, `{count}`, `{runtimeKind}`
- ทุก error/empty/confirm ต้องมี key
- Discord/email/notification copy ควรใช้ key แยกจาก UI copy

### 53.2 Global Copy Keys

| Key                        | EN                   | TH                 |
| -------------------------- | -------------------- | ------------------ |
| `owner.app.name`           | Owner Panel          | แผงควบคุม Owner    |
| `owner.nav.platform`       | Platform             | แพลตฟอร์ม          |
| `owner.nav.operations`     | Operations           | การปฏิบัติการ      |
| `owner.nav.governance`     | Governance           | การกำกับดูแล       |
| `owner.action.refresh`     | Refresh              | รีเฟรช             |
| `owner.action.search`      | Search               | ค้นหา              |
| `owner.action.filter`      | Filter               | ตัวกรอง            |
| `owner.action.export`      | Export               | ส่งออก             |
| `owner.action.cancel`      | Cancel               | ยกเลิก             |
| `owner.action.confirm`     | Confirm              | ยืนยัน             |
| `owner.action.save`        | Save                 | บันทึก             |
| `owner.action.retry`       | Retry                | ลองใหม่            |
| `owner.action.viewDetails` | View details         | ดูรายละเอียด       |
| `owner.state.loading`      | Loading data         | กำลังโหลดข้อมูล    |
| `owner.state.empty`        | No data found        | ไม่พบข้อมูล        |
| `owner.state.error`        | Something went wrong | เกิดข้อผิดพลาด     |
| `owner.state.stale`        | Data may be stale    | ข้อมูลอาจไม่ล่าสุด |

### 53.3 Overview Copy Keys

| Key                                 | EN                                                                         | TH                                                               |
| ----------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `owner.overview.title`              | Platform overview                                                          | ภาพรวมแพลตฟอร์ม                                                  |
| `owner.overview.subtitle`           | Monitor tenant health, revenue risk, runtime status, and operator actions. | ตรวจสุขภาพ tenant, ความเสี่ยงรายได้, runtime และงานที่ต้องจัดการ |
| `owner.overview.platformHealth`     | Platform health                                                            | สุขภาพแพลตฟอร์ม                                                  |
| `owner.overview.revenueHealth`      | Revenue health                                                             | สุขภาพรายได้                                                     |
| `owner.overview.runtimeHealth`      | Runtime health                                                             | สุขภาพ Runtime                                                   |
| `owner.overview.operationsRisk`     | Operations risk                                                            | ความเสี่ยงการปฏิบัติการ                                          |
| `owner.overview.securitySnapshot`   | Security snapshot                                                          | ภาพรวมความปลอดภัย                                                |
| `owner.overview.supportSnapshot`    | Support snapshot                                                           | ภาพรวมงาน Support                                                |
| `owner.overview.cta.atRiskTenants`  | View at-risk tenants                                                       | ดู tenant ที่มีความเสี่ยง                                        |
| `owner.overview.cta.runtimeHealth`  | Open runtime health                                                        | เปิดสุขภาพ runtime                                               |
| `owner.overview.cta.unpaidInvoices` | View unpaid invoices                                                       | ดู invoice ค้างจ่าย                                              |

### 53.4 Tenant Copy Keys

| Key                                  | EN                                                                             | TH                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `owner.tenants.title`                | Tenants                                                                        | Tenants                                                        |
| `owner.tenants.subtitle`             | Manage tenant status, packages, billing posture, and runtime readiness.        | จัดการสถานะ tenant, package, billing และ runtime               |
| `owner.tenants.empty.title`          | No tenants yet                                                                 | ยังไม่มี tenant                                                |
| `owner.tenants.empty.body`           | Create the first tenant to start provisioning packages, billing, and runtimes. | สร้าง tenant แรกเพื่อเริ่มตั้งค่า package, billing และ runtime |
| `owner.tenants.action.create`        | Create tenant                                                                  | สร้าง tenant                                                   |
| `owner.tenants.action.suspend`       | Suspend tenant                                                                 | ระงับ tenant                                                   |
| `owner.tenants.action.resume`        | Resume tenant                                                                  | เปิดใช้งาน tenant                                              |
| `owner.tenants.confirmSuspend.title` | Suspend tenant?                                                                | ระงับ tenant นี้หรือไม่                                        |
| `owner.tenants.confirmSuspend.body`  | This may block tenant operations and player access depending on policy.        | อาจทำให้การทำงานของ tenant และผู้เล่นถูกจำกัดตาม policy        |

### 53.5 Runtime Copy Keys

| Key                                       | EN                                                                             | TH                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `owner.runtime.title`                     | Runtime health                                                                 | สุขภาพ Runtime                                                     |
| `owner.runtime.deliveryAgent`             | Delivery Agent                                                                 | Delivery Agent                                                     |
| `owner.runtime.serverBot`                 | Server Bot                                                                     | Server Bot                                                         |
| `owner.runtime.scope.executeOnly`         | Execute only                                                                   | ทำงาน execute เท่านั้น                                             |
| `owner.runtime.scope.syncOnly`            | Sync only                                                                      | ทำงาน sync เท่านั้น                                                |
| `owner.runtime.status.online`             | Online                                                                         | ออนไลน์                                                            |
| `owner.runtime.status.offline`            | Offline                                                                        | ออฟไลน์                                                            |
| `owner.runtime.status.degraded`           | Degraded                                                                       | มีปัญหาบางส่วน                                                     |
| `owner.runtime.status.pendingActivation`  | Pending activation                                                             | รอ activate                                                        |
| `owner.runtime.status.expiredToken`       | Setup token expired                                                            | setup token หมดอายุ                                                |
| `owner.runtime.action.provisionDelivery`  | Provision Delivery Agent                                                       | สร้าง Delivery Agent                                               |
| `owner.runtime.action.provisionServerBot` | Provision Server Bot                                                           | สร้าง Server Bot                                                   |
| `owner.runtime.warning.serverBotOffline`  | Server Bot is offline. Server config, backup, and restart actions are blocked. | Server Bot ออฟไลน์ จึงไม่สามารถแก้ config, backup หรือ restart ได้ |
| `owner.runtime.warning.deliveryOffline`   | Delivery Agent is offline. Delivery jobs and in-game announcements may fail.   | Delivery Agent ออฟไลน์ งาน delivery และประกาศในเกมอาจล้มเหลว       |

### 53.6 Billing Copy Keys

| Key                                   | EN                                                               | TH                                                                  |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `owner.billing.title`                 | Billing                                                          | Billing                                                             |
| `owner.billing.subtitle`              | Track revenue, invoices, failed payments, and subscription risk. | ตรวจรายได้, invoices, payment ที่ล้มเหลว และความเสี่ยง subscription |
| `owner.billing.unpaidInvoices`        | Unpaid invoices                                                  | Invoice ค้างจ่าย                                                    |
| `owner.billing.failedPayments`        | Failed payments                                                  | Payment ล้มเหลว                                                     |
| `owner.billing.action.retryPayment`   | Retry payment                                                    | ลองชำระเงินใหม่                                                     |
| `owner.billing.action.resendInvoice`  | Resend invoice                                                   | ส่ง invoice อีกครั้ง                                                |
| `owner.billing.action.createCheckout` | Create checkout link                                             | สร้างลิงก์ชำระเงิน                                                  |
| `owner.billing.confirmMarkPaid.title` | Mark invoice as paid?                                            | ทำเครื่องหมายว่า invoice นี้ชำระแล้วหรือไม่                         |
| `owner.billing.confirmMarkPaid.body`  | Use this only for manual payment reconciliation.                 | ใช้เฉพาะกรณีตรวจยอด manual payment แล้วเท่านั้น                     |

### 53.7 Config / Restart Copy Keys

| Key                               | EN                                                | TH                                            |
| --------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| `owner.config.title`              | Config jobs                                       | งาน Config                                    |
| `owner.config.diff`               | Config diff                                       | ความต่างของ Config                            |
| `owner.config.requiresRestart`    | Requires restart                                  | ต้อง restart                                  |
| `owner.config.action.apply`       | Apply config                                      | Apply config                                  |
| `owner.config.action.rollback`    | Roll back config                                  | Rollback config                               |
| `owner.restart.title`             | Restart plans                                     | แผน Restart                                   |
| `owner.restart.type.now`          | Restart now                                       | Restart ทันที                                 |
| `owner.restart.type.delayed`      | Delayed restart                                   | Restart แบบตั้งเวลา                           |
| `owner.restart.type.safe`         | Safe restart                                      | Safe restart                                  |
| `owner.restart.confirm.title`     | Schedule restart?                                 | สร้างแผน restart หรือไม่                      |
| `owner.restart.blocked.serverBot` | Restart is blocked because Server Bot is offline. | ไม่สามารถ restart ได้เพราะ Server Bot ออฟไลน์ |

### 53.8 Audit / Security Copy Keys

| Key                                  | EN              | TH                         |
| ------------------------------------ | --------------- | -------------------------- |
| `owner.audit.title`                  | Audit logs      | Audit logs                 |
| `owner.audit.actor`                  | Actor           | ผู้กระทำ                   |
| `owner.audit.action`                 | Action          | Action                     |
| `owner.audit.target`                 | Target          | เป้าหมาย                   |
| `owner.audit.result`                 | Result          | ผลลัพธ์                    |
| `owner.security.title`               | Security events | เหตุการณ์ความปลอดภัย       |
| `owner.security.failedLogin`         | Failed login    | Login ล้มเหลว              |
| `owner.security.revokeSession`       | Revoke session  | ยกเลิก session             |
| `owner.security.revokeApiKey`        | Revoke API key  | ยกเลิก API key             |
| `owner.security.confirmRevoke.title` | Revoke access?  | ยกเลิกสิทธิ์เข้าถึงหรือไม่ |

### 53.9 Confirmation Copy Pattern

| Key                                 | EN                                             | TH                                |
| ----------------------------------- | ---------------------------------------------- | --------------------------------- |
| `owner.confirm.risk.high.title`     | Confirm high-risk action                       | ยืนยัน action ที่มีความเสี่ยงสูง  |
| `owner.confirm.risk.critical.title` | Confirm critical action                        | ยืนยัน action ระดับวิกฤต          |
| `owner.confirm.typeToConfirm`       | Type `{phrase}` to confirm.                    | พิมพ์ `{phrase}` เพื่อยืนยัน      |
| `owner.confirm.impact`              | Impact                                         | ผลกระทบ                           |
| `owner.confirm.auditNotice`         | This action will be recorded in the audit log. | action นี้จะถูกบันทึกใน audit log |

## 54. Design Tokens

Tokens ด้านล่างเป็น baseline สำหรับ Owner Panel ใหม่ เน้น operator UI ที่อ่านเร็ว แยก risk ชัด และไม่ใช้ decoration เกินจำเป็น

### 54.1 Visual Thesis

Owner Panel ควรรู้สึกเหมือน control room สำหรับ managed SCUM service: หนักแน่น, อ่านเร็ว, status ชัด, action เสี่ยงถูกควบคุม, และใช้สีเพื่อสื่อความหมายมากกว่าตกแต่ง

### 54.2 Color Tokens

| Token                       | Value     | Use                      |
| --------------------------- | --------- | ------------------------ |
| `color.bg.app`              | `#0f172a` | app background dark mode |
| `color.bg.surface`          | `#111827` | main panels              |
| `color.bg.surfaceSubtle`    | `#1f2937` | secondary surfaces       |
| `color.bg.tableHeader`      | `#182033` | table header             |
| `color.border.default`      | `#2f3a4f` | borders                  |
| `color.border.strong`       | `#475569` | high-emphasis borders    |
| `color.text.primary`        | `#f8fafc` | primary text             |
| `color.text.secondary`      | `#cbd5e1` | secondary text           |
| `color.text.muted`          | `#94a3b8` | muted text               |
| `color.accent.primary`      | `#38bdf8` | primary action/accent    |
| `color.accent.primaryHover` | `#0ea5e9` | primary hover            |
| `color.success`             | `#22c55e` | healthy/success          |
| `color.warning`             | `#f59e0b` | warning                  |
| `color.danger`              | `#ef4444` | high risk/error          |
| `color.critical`            | `#dc2626` | destructive/critical     |
| `color.info`                | `#60a5fa` | info                     |
| `color.locked`              | `#64748b` | locked/disabled          |

Light mode optional baseline:

| Token                        | Value     |
| ---------------------------- | --------- |
| `color.light.bg.app`         | `#f8fafc` |
| `color.light.bg.surface`     | `#ffffff` |
| `color.light.border.default` | `#e2e8f0` |
| `color.light.text.primary`   | `#0f172a` |
| `color.light.text.secondary` | `#475569` |

### 54.3 Risk Color Rules

| Risk     | Color    | UI                                     |
| -------- | -------- | -------------------------------------- |
| Low      | green    | subtle badge                           |
| Medium   | amber    | badge + warning icon                   |
| High     | red      | strong badge + prominent row highlight |
| Critical | deep red | blocking banner + confirmation         |

### 54.4 Typography

| Token                  | Value                               | Use                |
| ---------------------- | ----------------------------------- | ------------------ |
| `font.family.sans`     | Inter, system-ui, sans-serif        | all UI             |
| `font.family.mono`     | JetBrains Mono, Consolas, monospace | IDs, logs, tokens  |
| `font.size.xs`         | `12px`                              | metadata, badges   |
| `font.size.sm`         | `14px`                              | table/body         |
| `font.size.md`         | `16px`                              | form/body emphasis |
| `font.size.lg`         | `18px`                              | section heading    |
| `font.size.xl`         | `24px`                              | page heading       |
| `font.size.2xl`        | `32px`                              | dashboard number   |
| `font.weight.regular`  | `400`                               | body               |
| `font.weight.medium`   | `500`                               | labels             |
| `font.weight.semibold` | `600`                               | headings           |
| `lineHeight.tight`     | `1.2`                               | numbers/headings   |
| `lineHeight.normal`    | `1.5`                               | body               |

Rules:

- letter spacing = `0`
- ไม่ใช้ font-size ที่ scale ตาม viewport
- ตัวเลข dashboard ใช้ tabular numbers ถ้า font รองรับ

### 54.5 Spacing

| Token      | Value  |
| ---------- | ------ |
| `space.1`  | `4px`  |
| `space.2`  | `8px`  |
| `space.3`  | `12px` |
| `space.4`  | `16px` |
| `space.5`  | `20px` |
| `space.6`  | `24px` |
| `space.8`  | `32px` |
| `space.10` | `40px` |
| `space.12` | `48px` |

Layout rules:

- page padding desktop: `24px`
- page padding tablet: `20px`
- page padding mobile: `16px`
- table cell padding dense: `8px 12px`
- table cell padding comfortable: `12px 16px`

### 54.6 Radius / Elevation

| Token          | Value                            | Use                    |
| -------------- | -------------------------------- | ---------------------- |
| `radius.sm`    | `4px`                            | badges, inputs         |
| `radius.md`    | `6px`                            | buttons, table filters |
| `radius.lg`    | `8px`                            | cards/panels max       |
| `shadow.none`  | none                             | default                |
| `shadow.focus` | `0 0 0 3px rgba(56,189,248,.35)` | focus ring             |

Rule:

- cards ไม่ควรเกิน `8px` radius
- ไม่ทำ card ซ้อน card

### 54.7 Breakpoints

| Token        | Value    |
| ------------ | -------- |
| `bp.mobile`  | `360px`  |
| `bp.tablet`  | `768px`  |
| `bp.laptop`  | `1024px` |
| `bp.desktop` | `1280px` |
| `bp.wide`    | `1536px` |

Responsive rules:

- desktop: sidebar fixed + content table
- tablet: sidebar collapsible + filters in drawer
- mobile: table turns into list rows for critical pages only
- operator pages should prioritize desktop/tablet because data density is high

### 54.8 Component Density

| Component           | Density                              |
| ------------------- | ------------------------------------ |
| Dashboard cards     | compact, one metric + one trend/risk |
| Data tables         | dense by default                     |
| Forms               | comfortable                          |
| Confirmation modals | comfortable, high readability        |
| Timelines           | compact but scannable                |
| Logs                | mono, dense                          |

### 54.9 Icon Rules

- ใช้ icon สำหรับ action ที่คุ้นเคย เช่น refresh, search, filter, download, warning, lock
- icon ต้องมี tooltip
- destructive icon ต้องมี label หรือ confirmation
- ห้ามใช้ icon ตกแต่งที่ไม่ช่วย scan

### 54.10 Motion Tokens

| Token             | Value                      | Use                 |
| ----------------- | -------------------------- | ------------------- |
| `motion.fast`     | `120ms`                    | hover/focus         |
| `motion.normal`   | `180ms`                    | drawer/modal        |
| `motion.slow`     | `240ms`                    | page section reveal |
| `easing.standard` | `cubic-bezier(.2,.8,.2,1)` | default             |

Allowed motion:

- table row hover
- drawer open/close
- modal entrance
- toast
- live status pulse for online/offline only

Avoid:

- decorative background animation
- bouncing cards
- animated gradients

## 55. Page Acceptance Criteria

ใช้ checklist นี้ตอนออกแบบ, QA, และ dev handoff

### 55.1 Global Acceptance Criteria

ทุกหน้า Owner ต้องผ่าน:

- มี loading state
- มี empty state
- มี error state
- มี stale/partial data state ถ้า endpoint fail บางส่วน
- มี permission denied state
- มี last updated timestamp
- table filter/search/sort ตามความเหมาะสม
- action เสี่ยงต้องมี confirmation
- mutation success/failure ต้องมี feedback
- action สำคัญต้องมี audit/operation id
- responsive ไม่ล้นที่ desktop/tablet/mobile target
- EN/TH copy ต้องใช้ translation key
- status/risk badge ต้องสื่อความหมายชัดเจน

### 55.2 Owner Overview Acceptance

ต้องแสดง:

- platform health
- tenant summary
- revenue summary
- runtime summary
- operations risk
- security snapshot
- support snapshot
- top at-risk tenants
- notification/risk queue

ต้องทำได้:

- refresh data
- open at-risk tenants
- open runtime health
- open unpaid invoices
- open incidents/support
- run diagnostics ถ้ามีสิทธิ์

ต้องรองรับ:

- overview API fail แต่ billing/runtime บางส่วนยังโหลดได้
- ไม่มี risk
- มี critical risk
- user ไม่มีสิทธิ์บาง CTA

### 55.3 Tenants Acceptance

ต้องแสดง:

- tenant name/slug/status
- package/subscription
- billing risk
- Delivery Agent status
- Server Bot status
- runtime last seen
- locale
- risk badges

ต้องทำได้:

- search tenant
- filter by status/package/runtime/billing risk
- open tenant detail
- create tenant
- open diagnostics
- suspend/resume ถ้ามีสิทธิ์

ต้องรองรับ:

- empty tenant list
- many tenants pagination/cursor
- missing runtime
- stale heartbeat
- unpaid invoice

### 55.4 Tenant Detail Acceptance

ต้องแสดง:

- tenant profile
- subscription/package
- billing
- runtimes
- config/restart/backups
- support
- audit
- diagnostics
- linked identities
- feature access

ต้องทำได้:

- switch tabs without losing context
- open related invoice/runtime/job/audit
- run diagnostics
- create support case
- provision runtime
- change package
- view billing

ต้องรองรับ:

- tenant not found
- partial data
- suspended tenant
- missing subscription
- missing runtime
- high-risk tenant

### 55.5 Create Tenant Acceptance

ต้องมี steps:

1. tenant info
2. package
3. runtime setup
4. billing
5. review
6. created state

ต้อง validate:

- name required
- slug required/unique
- owner email valid
- locale selected
- package selected
- billing mode selected

ต้องแสดงหลังสร้าง:

- tenant created
- subscription state
- setup tokens visible once
- next steps
- open tenant detail CTA

### 55.6 Packages / Entitlements Acceptance

Packages ต้องแสดง:

- package name/status
- price
- active tenant count
- feature count
- limits
- trial/preview allowed

Packages ต้องทำได้:

- create package
- edit package
- duplicate package
- archive package
- view tenants using package
- open entitlement matrix

Entitlements ต้องแสดง:

- feature rows
- package columns
- enabled/limited/read-only/preview locked/locked/hidden state
- limits and usage
- feature groups

Entitlements ต้องทำได้:

- filter by feature group
- compare packages
- open package detail
- identify downgrade risks

ต้องรองรับ:

- package has active tenants
- package draft
- package archived
- deleting package blocked

### 55.7 Subscriptions Acceptance

ต้องแสดง:

- tenant
- package
- subscription status
- interval
- renewal date
- trial end
- invoice status
- revenue amount
- risk badges

ต้องทำได้:

- filter active/trial/overdue/cancelled
- open subscription detail
- change package
- extend trial if permitted
- cancel/resume if permitted

### 55.8 Billing Acceptance

ต้องแสดง:

- MRR/revenue summary
- active paying tenants
- unpaid invoices
- failed payments
- trial conversion risk
- invoices table
- payment attempts table

ต้องทำได้:

- open invoice detail
- open payment attempt detail
- retry payment
- create checkout link
- mark invoice only in allowed mode
- create support case from failed payment

ต้องรองรับ:

- billing provider unavailable
- local/manual billing mode
- failed provider response
- partial billing data

### 55.9 Runtime Health Acceptance

ต้องแสดง:

- Delivery Agent online/offline
- Server Bot online/offline
- outdated runtimes
- stale heartbeat
- credential/setup token state
- tenant/runtime mapping

ต้องทำได้:

- filter runtime kind/status/version
- open runtime detail
- provision runtime
- revoke token/device/credential if permitted
- run diagnostics

ต้องบังคับ:

- Delivery Agent กับ Server Bot ต้องแยก visually ชัด
- action ของ Server Bot ห้ามไปอยู่บน Delivery Agent
- action ของ Delivery Agent ห้ามไปอยู่บน Server Bot

### 55.10 Agents & Bots Detail Acceptance

ต้องแสดง:

- runtime identity
- tenant binding
- role/scope
- machine binding
- version
- heartbeat history
- credential state
- setup token state
- job/config/restart relation
- audit events

ต้องทำได้:

- rotate/revoke credential
- revoke device
- create replacement token
- open tenant
- open diagnostics

### 55.11 Jobs & Queues Acceptance

ต้องแสดง:

- job type
- status
- tenant
- runtime claimed
- retry count
- created/updated time
- last error
- dead-letter state

ต้องทำได้:

- filter by job type/status/tenant/runtime
- retry retryable job
- delete dead-letter only with permission
- open tenant/runtime/support case

### 55.12 Config Jobs Acceptance

ต้องแสดง:

- tenant/server
- config category
- job type
- status
- requested by
- requires restart
- backup
- diff summary
- failure reason
- Server Bot relation

ต้องทำได้:

- view diff
- retry
- rollback
- open backup
- open audit

ต้อง block:

- apply/rollback if Server Bot offline
- apply if permission missing

### 55.13 Restart Plans Acceptance

ต้องแสดง:

- tenant/server
- restart type
- scheduled time
- countdown announce
- Delivery Agent announce readiness
- Server Bot execution readiness
- status
- execution history
- health verification

ต้องทำได้:

- create restart plan
- cancel restart plan
- force only if permitted
- verify health

ต้อง block/warn:

- block if Server Bot offline
- warn if Delivery Agent offline
- warn if queue pressure exists
- require typed confirmation for high-risk restart

### 55.14 Backups & Recovery Acceptance

ต้องแสดง:

- backup list
- backup type/source
- created by/time
- size
- related config job
- verification status
- restore history

ต้องทำได้:

- create backup
- preview restore
- execute restore
- verify restore
- open audit event

ต้องบังคับ:

- restore requires typed confirmation
- restore shows impact before execution
- restore creates audit event

### 55.15 Support Acceptance

ต้องแสดง:

- case list
- case detail/timeline
- tenant health facts
- linked billing/runtime/job/config/audit evidence
- severity/status/owner

ต้องทำได้:

- create case
- add note
- attach diagnostics
- escalate
- resolve
- open related object

### 55.16 Diagnostics Acceptance

ต้องแสดง:

- pass/warn/fail checklist
- risk summary
- recommended actions
- generated timestamp
- evidence links

ต้องทำได้:

- run diagnostics
- export report
- attach to support case
- open related failing area

### 55.17 Audit Logs Acceptance

ต้องแสดง:

- time
- actor
- tenant
- action
- target
- result
- risk level
- IP/session if available
- before/after metadata

ต้องทำได้:

- filter by tenant/actor/action/risk/date/result
- open linked object
- export if permitted

### 55.18 Security Events Acceptance

ต้องแสดง:

- event type
- severity
- tenant/user/session/IP
- message
- metadata
- created/resolved time

ต้องทำได้:

- revoke session
- revoke API key
- rotate credential
- create incident
- mark resolved if supported

### 55.19 Access Control Acceptance

ต้องแสดง:

- users
- roles
- permissions
- sessions
- API keys
- tenant/global scope

ต้องทำได้:

- invite user
- change role
- require 2FA
- revoke session
- create/revoke API key

ต้อง block:

- user cannot remove own last owner access
- critical permission changes require confirmation

### 55.20 Notifications Acceptance

ต้องแสดง:

- notification type
- severity
- tenant
- message
- linked object
- read/ack status
- created time

ต้องทำได้:

- acknowledge
- clear
- open linked object
- create incident/support case if relevant

### 55.21 Automation Acceptance

ต้องแสดง:

- automation name
- status
- trigger
- target tenants
- last run
- next run
- success/fail count

ต้องทำได้:

- run now
- pause
- edit if permitted
- view run history

### 55.22 Platform Controls Acceptance

ต้องแสดง:

- control action
- current platform state
- impact
- required permission
- audit notice

ต้องบังคับ:

- critical actions require typed confirmation
- show operation result
- show audit id
- disable if backend reports unsafe state

### 55.23 Settings Acceptance

ต้องแสดง:

- safe settings
- risky settings
- runtime settings
- billing settings
- security settings
- secret settings

ต้องบังคับ:

- secret values masked
- env changes require confirmation
- restart-required settings show badge
- settings save returns operation/audit result

## 56. Final Handoff Checklist

ก่อนส่งให้ designer/dev ควรมีครบ:

1. Sitemap approved
2. Owner IA approved
3. First 5 screens wireframed
4. Role/permission matrix reviewed with backend
5. Entitlement matrix reviewed with product
6. API gaps prioritized
7. DTO shape agreed
8. Risk/confirmation pattern agreed
9. i18n key format agreed
10. Design tokens agreed
11. Acceptance criteria mapped to pages
12. Runtime separation rules documented clearly
13. Backend confirms which endpoints exist now vs need new aggregation endpoints
14. QA plan covers loading/empty/error/partial/permission states
15. UI does not use Stitch static pages as product truth
