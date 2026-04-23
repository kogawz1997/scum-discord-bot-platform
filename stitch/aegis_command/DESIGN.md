Design the Owner Panel UI for an existing SCUM managed-service platform.
This is an Owner-only redesign task, but it must cover the full platform scope that the Owner needs to see, supervise, diagnose, and control.
This is a frontend redesign only.
Do NOT change backend APIs, auth model, routes, cookies, business logic, or runtime separation.
Do NOT reduce the system into a generic dashboard.
Do NOT omit complex subsystems just because they are operationally dense.
Use the attached repo-derived files and screenshots as the source of truth for current structure, routes, product scope, and compatibility constraints.
==================================================
PRIMARY GOAL
==================================================
Design a complete Owner Panel that acts as the platform-level command and oversight surface for the whole SCUM managed service.
This Owner Panel must allow the platform owner to understand and manage:
- platform health
- tenant health
- package and subscription state
- fleet health
- Delivery Agent readiness
- Server Bot readiness
- operational incidents
- config/restart risk posture
- commerce and player-system performance
- identity and access integrity
- security, audit, diagnostics, and support posture
- commercial and onboarding readiness
This is not a tenant admin panel.
This is not a player portal.
It is the executive-operations control plane above those systems.
==================================================
VISUAL / BRAND DIRECTION
==================================================
The tone must be:
- official
- structured
- formal
- easy to understand
- clean and disciplined
- clearly game-adjacent to SCUM, but not noisy
- not messy
- not arcade-like
- not sci-fi HUD clutter
- not a generic startup SaaS admin template
The panel should feel like:
- an official platform console for a survival-game ecosystem
- premium but restrained
- tactical but readable
- serious and operational
- dark but orderly
- high-trust and high-signal
Preferred visual qualities:
- charcoal / steel / graphite base
- restrained military / industrial accents
- controlled warning and incident colors
- strong typography hierarchy
- compact, readable tables
- clear spacing discipline
- low-noise surfaces
- subtle atmospheric cues only
Avoid:
- neon-heavy visuals
- random card explosions
- glassmorphism overload
- oversized decorative hero sections on operational pages
- cluttered gaming motifs
- overly playful UI
==================================================
NON-NEGOTIABLE PLATFORM CONSTRAINTS
==================================================
Preserve all of the following:
- same-origin cookie/session auth
- existing backend route contracts
- existing business behavior
- existing multi-tenant logic
- existing feature/package gating logic
- existing live update / status polling assumptions
- backend-driven entitlements
- runtime separation between Delivery Agent and Server Bot
- existing route-family expectations
Keep these API families unchanged:
- /owner/api/*
- /admin/api/*
- /platform/api/*
- /tenant/api/*
- /player/api/*
- /api/public/*
Important:
Even if the Owner Panel redesign introduces better information architecture, it must still be compatible with the real backend and current product responsibilities.
==================================================
CRITICAL PRODUCT MODEL
==================================================
The Owner must be able to see and supervise the whole product, including:
1. Three web surfaces
- Owner Panel
- Tenant Admin Panel
- Player Portal
2. Two runtime roles
- Delivery Agent
- game-client-side runtime
- delivery execution
- possible in-game announce capability
- Server Bot
- server-side runtime
- SCUM.log sync
- config editing support
- backup
- restart / start / stop
These two runtime roles must remain clearly separated in:
- language
- navigation
- tables
- provisioning
- diagnostics
- detail panels
- health models
- action controls
==================================================
OWNER SCOPE: EVERYTHING THE OWNER MUST SEE
==================================================
Design the Owner Panel so it includes visibility and control over all major platform systems that matter from owner level.
That includes:
1. Platform / control-plane systems
- platform overview
- environment and maintenance state
- tenant inventory
- package catalog
- feature mapping
- subscription lifecycle
- billing / revenue visibility
- platform notices
- automation posture
- notifications posture
2. Tenant ecosystem oversight
- tenant health
- onboarding progress
- activation state
- current package
- entitlement posture
- operational risk
- support risk
- billing risk
- fleet assignment and runtime readiness
- major usage / pressure indicators
3. Delivery Agent fleet oversight
- provisioning
- activation
- setup token lifecycle
- machine binding
- reconnect posture
- online/offline state
- stale / outdated agents
- delivery readiness
- announce capability posture
- tenant association
4. Server Bot fleet oversight
- provisioning
- activation
- setup token lifecycle
- machine binding
- online/offline state
- log sync freshness
- config management posture
- backup posture
- restart/start/stop readiness
- diagnostics posture
- tenant association
5. Config and restart control oversight
The Owner should be able to see:
- which tenants have config drift
- which servers need restart
- which restarts failed
- backup / rollback posture
- restart history
- verification status after restart
- risk states for config mutations
6. Commerce / monetization oversight
- package uptake
- subscription state
- revenue summary
- payment risk
- failed or expiring subscriptions
- preview / trial conversion posture
- donation and commerce performance visibility
- player order / delivery operational risk visibility
7. Community / gameplay system oversight
Owner must have visibility into platform-wide health of:
- donations
- events
- bot modules
- player stats
- leaderboard
- killfeed
- raid request / raid window / raid summary systems
This does not mean building the Player Portal here.
It means the Owner Panel must expose platform-level oversight, anomalies, adoption, and operational health for these systems.
8. Identity and account-linking oversight
- Discord auth posture
- email auth posture
- linked accounts posture
- Steam linking posture
- in-game identity matching posture
- verification issues
- suspicious identity inconsistencies
- support-linked identity review context
9. Security / audit / operations oversight
- audit log
- security events
- operator sessions
- token posture
- provisioning abuse risk
- runtime integrity issues
- tenant isolation concerns
- support diagnostics
- incident response posture
10. Internationalization / productization oversight
- language readiness
- translation coverage posture if meaningful
- self-service signup readiness
- preview mode visibility
- trial posture
- onboarding readiness
- support readiness
- operational maturity indicators
==================================================
IMPORTANT UX PRINCIPLES
==================================================
The Owner Panel must make it easy to answer:
- What is failing right now?
- Which tenants need intervention?
- Which package/subscription states are risky?
- Which Delivery Agents are unhealthy?
- Which Server Bots are unhealthy?
- Which systems are degraded but not fully down?
- Which player-facing systems are operationally unhealthy?
- Which commercial systems are underperforming or blocked?
- Which actions are dangerous?
- What affects one tenant versus the whole platform?
The UI must support:
- dense but readable operational screens
- quick scanning
- drill-down from summary to evidence
- clear separation of concerns
- risky action clarity
- locked or gated state visibility
- incident and degradation visibility
- audit-sensitive workflows
- live-updating surfaces
- strong evidence-driven context
==================================================
GLOBAL SHELL REQUIREMENTS
==================================================
Design the global Owner shell in detail.
Must include:
- top bar
- left navigation
- page header
- scope/status strip
- main content grid
- right-side context rail when useful
- notification entry point
- profile/access menu
- language switcher
- quick search / command access if appropriate
The shell should clearly communicate:
- Owner context
- platform-level authority
- current platform health posture
- whether a view is platform-wide or tenant-specific
- where dangerous actions live
==================================================
REQUIRED OWNER INFORMATION ARCHITECTURE
==================================================
Design a full Owner IA that covers the complete owner-visible platform.
Required navigation groups:
1. Overview
2. Tenants
3. Packages
4. Subscriptions
5. Billing
6. Runtime Health
7. Fleet
8. Config & Restart Oversight
9. Commerce & Delivery Oversight
10. Community Systems
11. Identity & Access
12. Incidents
13. Audit
14. Security
15. Support & Diagnostics
16. Automation & Notifications
17. Settings
18. Maintenance & Recovery
If you improve the grouping, preserve the meaning and scope.
==================================================
REQUIRED PAGE SET
==================================================
Design each page as a real operational layout, not just a concept tile.
For every page, explicitly define:
- page purpose
- section order
- layout structure
- key components
- primary actions
- secondary actions
- loading state
- empty state
- degraded state
- locked/gated state if relevant
### 1. Owner Login
Needs:
- formal brand tone
- secure sign-in presentation
- trust/security cues
- compact auth layout
- professional entry to the control plane
### 2. Platform Overview
Needs:
- overall platform health header
- KPI strip
- tenant attention queue
- incident summary
- fleet summary
- billing / subscription pulse
- config/restart risk summary
- support / security summary
- quick actions
- platform notices
### 3. Tenants
Needs:
- tenant table
- onboarding state
- package and entitlement summary
- billing/subscription state
- health state
- fleet assignment summary
- detail panel
- tenant risk and attention indicators
### 4. Packages
Needs:
- package catalog
- feature matrix
- entitlement visibility
- upgrade / compatibility context
- package usage / tenant adoption visibility
### 5. Subscriptions
Needs:
- subscription lifecycle table
- expiring / suspended / unpaid risk views
- tenant commercial posture
- conversion / preview / trial awareness if applicable
### 6. Billing
Needs:
- revenue KPIs
- commercial health indicators
- invoice / payment status visibility
- failed payment posture
- financial risk queue
### 7. Runtime Health
Needs:
- service health summary
- platform subsystem health
- Delivery Agent health summary
- Server Bot health summary
- heartbeat / freshness / outage patterns
- degraded-state visibility
### 8. Fleet
This page must be split clearly into:
- Delivery Agents
- Server Bots
For each side show:
- count
- online/offline/outdated
- activation state
- version drift
- machine binding
- tenant association
- action readiness
- diagnostics indicators
### 9. Config & Restart Oversight
Needs:
- config drift visibility
- pending restart visibility
- failed restart visibility
- backup posture
- rollback posture
- verification after restart
- risk and consequence framing
### 10. Commerce & Delivery Oversight
Needs owner-level views into:
- orders volume
- delivery backlog
- failed deliveries
- processing health
- donation performance
- commerce anomalies
- player operational pain signals
### 11. Community Systems
Needs owner-level visibility into:
- events health
- module adoption / failures
- leaderboard/stat pipeline health
- killfeed pipeline health
- raid system posture
- player-facing feature availability
### 12. Identity & Access
Needs:
- Discord auth posture
- email auth posture
- Steam linking posture
- linked identity integrity
- suspicious mismatches
- session/access management
- identity-related support risk
### 13. Incidents
Needs:
- active incidents
- severity filtering
- incident timeline
- affected tenants / systems
- linked evidence
- operator notes / action history
### 14. Audit
Needs:
- searchable audit log
- actor
- action
- target scope
- tenant scope
- time
- severity
- inspection / export affordances
### 15. Security
Needs:
- security overview
- session posture
- token posture
- suspicious behavior
- provisioning abuse risk
- revocation / response affordances
### 16. Support & Diagnostics
Needs:
- support queue
- diagnostics bundles
- tenant-impact grouping
- issue classification
- runtime troubleshooting summaries
- escalation state
### 17. Automation & Notifications
Needs:
- automation status visibility
- notification channels / health
- failed automation visibility
- alert routing posture
- operator awareness tooling
### 18. Settings
Needs:
- platform settings
- commercial settings
- runtime settings
- auth / identity settings
- language / locale settings if relevant
### 19. Maintenance & Recovery
Needs:
- maintenance windows
- backup and restore posture
- recovery tools
- rollback posture
- danger zone actions
- verification and evidence after recovery
==================================================
COMPONENT SYSTEM REQUIREMENTS
==================================================
Create a detailed Owner component system.
At minimum define:
- app shell
- sidebar nav group
- sidebar nav item
- top-bar health slot
- page header
- section header
- KPI card
- metric strip
- filter bar
- dense operational table
- split runtime summary panel
- tenant summary card
- commercial risk card
- health status chip
- severity badge
- incident banner
- timeline block
- audit row
- diagnostics card
- provisioning state card
- config risk card
- restart risk card
- notification center pattern
- right-rail context panel
- empty state panel
- locked state panel
- degraded state panel
- detail drawer
- confirmation modal
- danger modal / danger drawer
- evidence panel
For each component define:
- purpose
- where used
- density level
- visual behavior
- state behavior
- how it supports a formal SCUM-platform tone without clutter
==================================================
STATE DESIGN REQUIREMENTS
==================================================
Explicitly design patterns for:
- loading
- partial load
- stale data
- no data
- locked feature
- preview/trial visibility
- degraded runtime
- failed provisioning
- offline agent/bot
- version drift
- risky mutation
- destructive confirmation
- incident active
- payment risk
- support escalation
- security-sensitive event
- live update state
==================================================
RUNTIME SEPARATION REQUIREMENTS
==================================================
This is critical.
The design must explicitly preserve the distinction between:
- Delivery Agent
- Server Bot
Show exactly how the UI keeps them distinct in:
- nav labels
- overview summaries
- fleet tables
- health cards
- diagnostics
- provisioning
- detail panels
- warning states
- operational language
Do not output a blended “runtime” design that hides the difference.
==================================================
PACKAGE / ENTITLEMENT MODEL REQUIREMENTS
==================================================
Show how the Owner UI handles:
- package definitions
- tenant package assignment
- feature matrix
- locked systems
- restricted actions
- preview mode
- trial mode
- upgrade prompts
- backend-driven entitlement visibility
Do not hardcode package logic into the design narrative.
Treat entitlements as backend-driven data.
==================================================
LAYOUT DISCIPLINE
==================================================
Be explicit and structured.
I want the design broken down into:
- shell
- page grids
- section ordering
- above-the-fold summary
- main-column content
- right-rail content
- table/filter arrangement
- drill-down behavior
Keep the interface:
- readable
- calm
- organized
- information-dense
- not visually overloaded
==================================================
OUTPUT FORMAT
==================================================
Deliver the result in this exact structure:
1. Owner Design Direction
- visual thesis
- tone summary
- color/material direction
- typography direction
- spacing/layout philosophy
2. Global Owner Shell
- top bar
- sidebar
- page header
- status strip
- right rail
- global interactions
3. Owner Information Architecture
- navigation groups
- page hierarchy
- grouping logic
4. Owner Design System
- component inventory
- component purpose
- state patterns
- density rules
5. Page-by-Page Layout Breakdown
For every required Owner page:
- purpose
- section order
- layout structure
- components used
- primary actions
- key states
6. Cross-System Oversight Model
Explain how the Owner sees:
- tenant systems
- player systems
- delivery systems
- bot systems
- identity systems
- commerce systems
- community systems
7. Runtime Separation Model
Explain exactly how Delivery Agent and Server Bot remain distinct everywhere
8. Compatibility Notes
Explain how the redesign still maps to:
- current routes
- current backend APIs
- current cookie/session auth
- current entitlement logic
- current operational behavior
- no backend rewrite
Very important:
Do not give a shallow moodboard.
Do not give only a style concept.
Do not collapse the platform into a few pretty screens.
I want a complete Owner-only control-plane design that covers all systems the platform owner must see.

1. Owner Design Direction
- visual thesis: A high-trust, high-signal, dark-themed operational control plane for a survival-game ecosystem. It prioritizes clarity, data density, and tactical readability over playful or arcade aesthetics. The design supports rapid assessment, drill-down diagnostics, and risk identification for the platform owner.
- tone summary: Official, structured, formal, serious, and operational. It embodies a premium but restrained feel, avoiding clutter while clearly delineating game-adjacent branding.
- color/material direction: A `dark` color mode with a primary palette based on charcoal, steel, and graphite for backgrounds and surfaces (`#121315` neutral). Accents leverage `cyan (#00D1FF)` for primary actions and key data, `amber (#FFB800)` for secondary elements and warnings, and `red (#FF4D4D)` for critical incidents or destructive actions. A restrained military/industrial feel is achieved through subtle material textures and controlled use of accent colors.
- typography direction: Strong typography hierarchy to aid scanning and readability. `publicSans` for headlines ensures a modern, clean, and structured feel. `inter` for body text and labels provides excellent legibility at various sizes, crucial for dense operational tables and information panels.
- spacing/layout philosophy: `Normal (2)` spacing discipline ensures clear separation of elements, preventing visual clutter while maintaining information density. Layouts are grid-based, promoting calm and organization. Focus on compact, readable tables and clear visual grouping.
2. Global Owner Shell
- top bar: Fixed at the top, housing the platform logo (left), a global health summary (center), notification entry point, profile/access menu, and potentially a language switcher (right). Quick search/command access may be integrated here.
- sidebar: Left-aligned, persistent navigation for primary system groups. Collapsible to maximize content area. Each group (e.g., "Overview," "Tenants") contains a hierarchy of pages. Clearly differentiates runtime roles where applicable (e.g., "Fleet" subgrouping for Delivery Agents and Server Bots).
- page header: Below the top bar, providing context for the current view. Includes the page title, a brief description, and relevant page-level actions (e.g., "Add Tenant," "Export Data").
- status strip: A thin strip below the page header, indicating platform-wide status, selected scope (e.g., "Platform-wide," "Tenant: [Name]"), and critical alerts. Uses subtle color coding (e.g., green for healthy, amber for degraded, red for incident).
- right rail: An optional, contextual panel on the right side of the main content grid. Used for displaying details of a selected item (e.g., "Tenant Details," "Incident Timeline"), quick actions related to the context, or supplementary information that shouldn't disrupt the main flow.
- global interactions:
    - Notifications: A bell icon in the top bar leading to a notification center/drawer for system alerts, warnings, and updates.
    - Profile/Access: User avatar/icon in the top bar for account settings, logout, and role/permission visibility.
    - Language Switcher: Icon or dropdown in the top bar to change UI language.
    - Quick Search/Command: A universal search bar or `CMD+K`-style modal for quick navigation and action execution.
3. Owner Information Architecture
- navigation groups:
    1. Overview (Platform health at a glance)
    2. Tenants (Management of tenant accounts and their status)
    3. Packages (Service offerings and feature definitions)
    4. Subscriptions (Tenant subscription lifecycle and state)
    5. Billing (Financial overview, invoices, payments)
    6. Runtime Health (Overall health of platform and connected runtimes)
    7. Fleet (Detailed management and health of Delivery Agents and Server Bots)
    8. Config & Restart Oversight (Configuration management and operational restart workflows)
    9. Commerce & Delivery Oversight (Player-facing commerce and content delivery health)
    10. Community Systems (Oversight of in-game community features)
    11. Identity & Access (User identity, authentication, and security)
    12. Incidents (Platform-wide incident management)
    13. Audit (Historical log of all platform actions)
    14. Security (Security posture and threat detection)
    15. Support & Diagnostics (Tools for support, troubleshooting, and issue resolution)
    16. Automation & Notifications (Platform automation and alert configuration)
    17. Settings (Global platform configuration)
    18. Maintenance & Recovery (Maintenance windows, backup/restore, disaster recovery)
- page hierarchy: Each group leads to a primary overview page, with drill-down capabilities to detail views (often via detail drawers or dedicated sub-pages). For instance, "Fleet" would have "Delivery Agents" and "Server Bots" as primary sub-pages.
- grouping logic: Grouping is based on functional domains and operational responsibilities of the platform owner. Critical operational areas (Runtime Health, Fleet, Config & Restart) are prominent. Cross-cutting concerns like Audit and Security have dedicated top-level groups.
4. Owner Design System
- component inventory:
    - App Shell
    - Sidebar Nav Group
    - Sidebar Nav Item
    - Top-Bar Health Slot
    - Page Header
    - Section Header
    - KPI Card
    - Metric Strip
    - Filter Bar
    - Dense Operational Table
    - Split Runtime Summary Panel
    - Tenant Summary Card
    - Commercial Risk Card
    - Health Status Chip
    - Severity Badge
    - Incident Banner
    - Timeline Block
    - Audit Row
    - Diagnostics Card
    - Provisioning State Card
    - Config Risk Card
    - Restart Risk Card
    - Notification Center Pattern
    - Right-Rail Context Panel
    - Empty State Panel
    - Locked State Panel
    - Degraded State Panel
    - Detail Drawer
    - Confirmation Modal
    - Danger Modal / Danger Drawer
    - Evidence Panel
- component purpose: Each component serves a specific operational need, designed for clarity and information delivery in a `dark`, structured environment. For example, `KPI Cards` offer quick numerical summaries, `Dense Operational Tables` allow for multi-column data review, and `Severity Badges` immediately communicate status.
- state patterns: Consistent visual language for all states.
    - Loading: Skeleton loaders or subtle spinners.
    - Partial Load: Specific sections may show loading indicators while others are loaded.
    - Stale Data: A timestamp and refresh button, or a subtle visual indicator on data that hasn't updated recently.
    - No Data: `Empty State Panels` with clear messages and potential calls to action.
    - Locked Feature: `Locked State Panels` or disabled UI elements with tooltips explaining entitlement requirements.
    - Preview/Trial Visibility: Distinct labels or banners on relevant sections.
    - Degraded Runtime: `Degraded State Panels` or amber `Health Status Chips` with clear explanations.
    - Failed Provisioning: Red `Provisioning State Card` with error details.
    - Offline Agent/Bot: Distinct icon and `Health Status Chip` for offline status.
    - Version Drift: Warning icon and label on `Fleet` tables.
    - Risky Mutation: Confirmation dialogs (`Confirmation Modal` or `Danger Modal`) outlining consequences.
    - Destructive Confirmation: `Danger Modal` or `Danger Drawer` with explicit text input for confirmation.
    - Incident Active: `Incident Banner` at the top of relevant pages, `Severity Badges` on incident lists.
    - Payment Risk: Red `Commercial Risk Card` or `Health Status Chip` on subscription/billing pages.
    - Support Escalation: Distinct icon and `Severity Badge` in support queues.
    - Security-Sensitive Event: Highlighted `Audit Row` or dedicated `Security Event Card`.
    - Live Update State: Subtle visual cues (e.g., pulsating dot) on data that is actively refreshing.
- density rules: `Normal (2)` spacing is applied. Components like `Dense Operational Table` are designed to pack information efficiently without becoming visually overwhelming, relying on strong typography and clear cell borders. `KPI Cards` and `Metric Strips` provide high-level summaries.
5. Page-by-Page Layout Breakdown
### 1. Owner Login
- purpose: Secure authentication for platform owners.
- section order: Brand elements (logo, name), login form (username, password), 'Forgot Password' link, 'Login' button, security/trust cues (e.g., MFA status, legal links).
- layout structure: Centered, compact two-column or single-column form within a minimalist container. No complex grid.
- components used: Page Header (implicit), Login Form (custom), Buttons, Text Inputs, Text Links.
- primary actions: Login.
- key states: Initial, Loading, Error (invalid credentials, MFA required).

### 2. Platform Overview
- purpose: Provide a comprehensive, high-level summary of the entire platform's health and critical operational queues.
- section order:
    1. Overall Platform Health Header (Hero section, current status)
    2. KPI Strip (Key metrics across systems)
    3. Quick Actions (Common owner tasks)
    4. Incident Summary (Active and recent critical incidents)
    5. Tenant Attention Queue (Tenants requiring intervention)
    6. Fleet Summary (Delivery Agents & Server Bots overview)
    7. Billing / Subscription Pulse (Commercial health)
    8. Config / Restart Risk Summary (Pending config changes, restarts)
    9. Support / Security Summary (Open tickets, critical security events)
    10. Platform Notices (System-wide announcements)
- layout structure: A flexible grid, with a prominent header, followed by KPI strip, then 2-3 columns for summaries and queues. Right rail for quick actions/global notices.
- components used: Page Header, KPI Card, Metric Strip, Section Header, Incident Banner, Tenant Summary Card, Split Runtime Summary Panel, Commercial Risk Card, Config Risk Card, Restart Risk Card, Health Status Chip, Quick Action Buttons, Platform Notice Card.
- primary actions: View all incidents, view all tenants, provision new agent/bot.
- key states: Healthy, Degraded (specific sections highlighted), Incident Active (prominent banner).

### 3. Tenants
- purpose: Manage and supervise individual tenant accounts and their associated platform resources.
- section order:
    1. Page Header (Tenant Management)
    2. Filter Bar (Search, status, package filters)
    3. Dense Operational Table (Tenant list)
    4. Detail Drawer (on tenant selection)
- layout structure: Full-width table dominating the main content area, with a filter bar above. Right-rail or overlaying `Detail Drawer` for selected tenant info.
- components used: Page Header, Filter Bar, Dense Operational Table (with columns for onboarding state, package, entitlements, billing, health, fleet assignment, risk indicators), Health Status Chip, Severity Badge, Detail Drawer (Tenant Details).
- primary actions: Add New Tenant (button in Page Header), View Tenant Details (click on row).
- key states: Loading, Empty (no tenants), Degraded (some tenants unhealthy), Filtered Results.

### 4. Packages
- purpose: Define, view, and manage available service packages and their feature mappings.
- section order:
    1. Page Header (Package Catalog)
    2. Filter Bar (Search, status filters)
    3. Package Catalog Grid/Table (List of packages)
    4. Detail Drawer (on package selection)
- layout structure: Grid or table layout for package catalog, with filters above. Detail drawer for package specifics, feature matrix.
- components used: Page Header, Filter Bar, Package Card/Row (showing name, description, price, key features), Feature Matrix (within detail view), Detail Drawer.
- primary actions: Create New Package (button in Page Header), Edit Package (within detail drawer).
- key states: Loading, Empty, Package Active/Inactive, Preview Mode.

### 5. Subscriptions
- purpose: Monitor the lifecycle and status of all tenant subscriptions.
- section order:
    1. Page Header (Subscription Lifecycle)
    2. Filter Bar (Status: Active, Expiring, Suspended, Failed; Tenant search)
    3. Dense Operational Table (Subscription list)
    4. Commercial Risk Queue (Highlighted expiring/unpaid subscriptions)
- layout structure: Main content is a dense table of subscriptions, with a dedicated section above or to the side for high-risk subscriptions.
- components used: Page Header, Filter Bar, Dense Operational Table (with columns for tenant, package, start/end dates, status, payment status, next renewal), Commercial Risk Card, Health Status Chip, Severity Badge.
- primary actions: Manage Subscription (link in table row, opens detail drawer/page).
- key states: Loading, Empty, Expiring, Suspended, Failed Payment.

### 6. Billing
- purpose: Provide financial oversight into platform revenue and payment status.
- section order:
    1. Page Header (Billing & Revenue)
    2. Revenue KPIs (Total revenue, MRR, churn)
    3. Commercial Health Indicators (Payment success rates, risk trends)
    4. Invoice/Payment Status Table (List of recent transactions/invoices)
    5. Financial Risk Queue (Failed payments, high-value expiring subscriptions)
- layout structure: Top section with prominent KPIs, followed by a table for detailed transactions and a side panel or dedicated section for financial risks.
- components used: Page Header, KPI Card, Metric Strip, Commercial Risk Card, Dense Operational Table (for invoices/payments), Severity Badge.
- primary actions: View All Invoices, Export Billing Data.
- key states: Loading, Empty, Payment Risk (highlighted transactions).

### 7. Runtime Health
- purpose: Provide an aggregated view of the health of all platform services and connected runtimes.
- section order:
    1. Page Header (Platform Runtime Health)
    2. Service Health Summary (Platform subsystems)
    3. Delivery Agent Health Summary (Overall agent fleet status)
    4. Server Bot Health Summary (Overall bot fleet status)
    5. Heartbeat / Freshness Patterns (Charts/indicators)
    6. Degraded State Visibility (Summary of current degradations)
- layout structure: A dashboard-like layout with several summary panels. Service health and fleet health sections are prominent.
- components used: Page Header, Section Header, Health Status Card (for services, agents, bots), Metric Strip (heartbeat/freshness), Degraded State Panel, Health Status Chip.
- primary actions: Drill down to Fleet (link), View All Incidents (link).
- key states: All Healthy, Partially Degraded, Major Outage.

### 8. Fleet
- purpose: Provide detailed oversight and management for both Delivery Agent and Server Bot fleets, with clear separation.
- section order:
    1. Page Header (Fleet Management)
    2. Tabbed Navigation (Delivery Agents / Server Bots)
    3. Delivery Agent Overview (Count, online/offline, outdated)
    4. Delivery Agent Table (Detailed list of agents)
    5. Server Bot Overview (Count, online/offline, outdated)
    6. Server Bot Table (Detailed list of bots)
    7. Detail Drawer (on agent/bot selection)
- layout structure: A primary content area split into two distinct sections for Delivery Agents and Server Bots, potentially using tabs or a prominent two-column layout. Each section has its own summary metrics and a dense table.
- components used: Page Header, Tabbed Navigation, Split Runtime Summary Panel (for counts, status), Dense Operational Table (for agents/bots, with columns for activation state, version drift, machine binding, tenant association, diagnostics), Provisioning State Card, Health Status Chip, Detail Drawer.
- primary actions: Provision New Agent/Bot (button in respective sections), Restart Bot (within detail drawer), Disconnect Agent (within detail drawer).
- key states: Online, Offline, Outdated, Activating, Failed Provisioning, Version Drift.

### 9. Config & Restart Oversight
- purpose: Monitor configuration drift, pending restarts, and historical restart outcomes.
- section order:
    1. Page Header (Config & Restart)
    2. Config Drift Visibility (List of tenants/servers with unapplied config)
    3. Pending Restart Visibility (Queue of servers needing restart)
    4. Failed Restart Visibility (History of failed restart attempts)
    5. Backup / Rollback Posture (System-wide backup status)
    6. Restart History (Log of all restarts)
    7. Risk and Consequence Framing (Guidance on dangerous actions)
- layout structure: Multiple distinct sections, using tables and summary cards, clearly separating drift, pending actions, and history.
- components used: Page Header, Section Header, Config Risk Card, Restart Risk Card, Dense Operational Table (for config drift, pending restarts, restart history), Backup Status Card, Warning Banner (for risk framing).
- primary actions: Apply Config (for drift), Initiate Restart (for pending), View Rollback Options.
- key states: No Drift, Pending Changes, Restart Failed, Backup Healthy, Rollback Available.

### 10. Commerce & Delivery Oversight
- purpose: Monitor the operational health and performance of player-facing commerce and content delivery systems.
- section order:
    1. Page Header (Commerce & Delivery)
    2. Orders Volume / Delivery Backlog (KPIs/charts)
    3. Failed Deliveries Summary (Key metrics)
    4. Processing Health (Status of payment/delivery systems)
    5. Donation Performance (Summary for community donations)
    6. Commerce Anomalies (Detected unusual activity)
    7. Player Operational Pain Signals (Aggregated player reports/errors)
- layout structure: A mix of KPI cards, charts, and small summary tables across multiple columns.
- components used: Page Header, KPI Card, Metric Strip, Health Status Card, Dense Operational Table (for anomalies, pain signals), Section Header.
- primary actions: Investigate Order (link), View Delivery Agent Logs.
- key states: All Healthy, Backlog Growing, Processing Degraded, Anomalies Detected.

### 11. Community Systems
- purpose: Provide owner-level visibility into the health and adoption of various in-game community and gameplay systems.
- section order:
    1. Page Header (Community Systems Oversight)
    2. Events Health (Status of ongoing/upcoming events)
    3. Module Adoption / Failures (Key stats for bot modules)
    4. Leaderboard / Stat Pipeline Health (Data processing health)
    5. Killfeed Pipeline Health (Real-time data flow)
    6. Raid System Posture (Health of raid requests/windows)
    7. Player-Facing Feature Availability (Overall status of community features)
- layout structure: A series of health summary cards and small tables for each community system.
- components used: Page Header, Health Status Card, Metric Strip, Dense Operational Table (for module failures, pipeline issues), Section Header.
- primary actions: View Event Details, Investigate Pipeline.
- key states: All Healthy, Partial Degradation, Data Latency, Feature Unavailable.

### 12. Identity & Access
- purpose: Oversee the health and integrity of player and tenant identity, authentication, and access linking.
- section order:
    1. Page Header (Identity & Access)
    2. Auth Posture Summary (Discord, Email, Steam linking status)
    3. Linked Identity Integrity (Mismatches, verification issues)
    4. Suspicious Mismatches / Anomalies (Queue of potential security concerns)
    5. Session / Access Management (Active sessions, token status)
    6. Identity-Related Support Risk (Tenants with identity issues)
- layout structure: Summary cards for overall posture, followed by tables for specific issues and risky items.
- components used: Page Header, Health Status Card, Metric Strip, Dense Operational Table (for mismatches, sessions, support risk), Severity Badge.
- primary actions: Investigate Identity, Revoke Session.
- key states: All Healthy, Verification Pending, Suspicious Activity, Support Escalation.

### 13. Incidents
- purpose: Manage active and historical platform incidents.
- section order:
    1. Page Header (Incidents)
    2. Filter Bar (Severity, Status: Active/Resolved, Affected System/Tenant)
    3. Active Incidents Table (Current critical issues)
    4. Incident Timeline (Chronological view of recent incidents)
    5. Incident Detail Drawer (on selection)
- layout structure: A filterable table for active incidents, with a timeline view below. `Detail Drawer` for selected incidents.
- components used: Page Header, Filter Bar, Dense Operational Table (Incidents, with columns for severity, status, affected systems/tenants), Severity Badge, Incident Banner, Timeline Block, Detail Drawer (Incident details, operator notes, action history, linked evidence).
- primary actions: Create New Incident, Update Incident Status, Resolve Incident.
- key states: Active, Resolved, Critical, Major, Minor.

### 14. Audit
- purpose: Provide a searchable and auditable log of all actions taken within the platform.
- section order:
    1. Page Header (Audit Log)
    2. Filter Bar (Actor, Action, Target, Tenant, Time Range, Severity)
    3. Searchable Audit Log Table (Detailed record of events)
    4. Export Affordances (CSV, JSON)
- layout structure: A comprehensive filter bar above a dense, scrollable table.
- components used: Page Header, Filter Bar, Dense Operational Table (Audit Log, with columns for actor, action, target, scope, time, severity), Audit Row, Export Buttons.
- primary actions: Export Log.
- key states: Loading, No Results, Filtered.

### 15. Security
- purpose: Oversee the platform's security posture and respond to security events.
- section order:
    1. Page Header (Security Overview)
    2. Security Overview (Key metrics, open alerts)
    3. Session Posture (Active sessions, anomalies)
    4. Token Posture (Active API keys, provisioning tokens)
    5. Suspicious Behavior Log (Detected anomalies, potential threats)
    6. Provisioning Abuse Risk (Indicators of potential misuse)
    7. Revocation / Response Affordances (Quick actions for security incidents)
- layout structure: Dashboard with summary cards, tables for suspicious activity, and action buttons for response.
- components used: Page Header, Health Status Card, Metric Strip, Dense Operational Table (Suspicious Behavior, Token Posture), Security Event Card, Danger Button (for revocation).
- primary actions: Revoke Token, Terminate Session, Investigate Event.
- key states: All Clear, Alerts Active, Compromise Detected.

### 16. Support & Diagnostics
- purpose: Facilitate support operations and provide diagnostic tools for troubleshooting.
- section order:
    1. Page Header (Support & Diagnostics)
    2. Support Queue (Open tickets, tenant-impact grouping)
    3. Issue Classification Summary (Trends in support requests)
    4. Diagnostics Bundles (Available data packages for troubleshooting)
    5. Runtime Troubleshooting Summaries (Quick links to agent/bot diagnostics)
    6. Escalation State Overview (Tickets requiring higher attention)
- layout structure: A main table for the support queue, with summary cards for issue trends and diagnostics access.
- components used: Page Header, Filter Bar, Dense Operational Table (Support Queue, with columns for tenant, issue, status, impact, escalation), Diagnostics Card, Health Status Card.
- primary actions: View Ticket Details, Generate Diagnostics Bundle.
- key states: Open, In Progress, Escalated, Resolved, No Tickets.

### 17. Automation & Notifications
- purpose: Oversee the status of platform automation and notification channels.
- section order:
    1. Page Header (Automation & Notifications)
    2. Automation Status Visibility (Health of scheduled tasks, webhooks)
    3. Notification Channels / Health (Email, Slack, PagerDuty integration status)
    4. Failed Automation Visibility (Log of errors)
    5. Alert Routing Posture (Configuration overview)
    6. Operator Awareness Tooling (Summary of on-call tools)
- layout structure: Summary cards for overall health, tables for failures, and configuration views.
- components used: Page Header, Health Status Card, Metric Strip, Dense Operational Table (Failed Automation), Section Header.
- primary actions: View Automation Logs, Test Notification Channel.
- key states: All Active, Failures Present, Channel Down.

### 18. Settings
- purpose: Configure global platform, commercial, runtime, and identity settings.
- section order:
    1. Page Header (Platform Settings)
    2. Tabbed Navigation (Platform, Commercial, Runtime, Auth/Identity, Locale)
    3. Configuration Forms (Specific to each tab)
- layout structure: Tabbed interface, with each tab displaying relevant configuration forms and options.
- components used: Page Header, Tabbed Navigation, Form Fields (text input, toggles, dropdowns), Save Button, Danger Zone Panel.
- primary actions: Save Changes, Reset to Defaults.
- key states: Default, Modified, Saving, Error.

### 19. Maintenance & Recovery
- purpose: Manage maintenance windows, backups, and disaster recovery procedures.
- section order:
    1. Page Header (Maintenance & Recovery)
    2. Maintenance Windows (Scheduled, active, history)
    3. Backup and Restore Posture (Last backup, restore points, health)
    4. Recovery Tools (Links to specific recovery actions)
    5. Rollback Posture (Availability of system rollbacks)
    6. Danger Zone Actions (Critical, irreversible actions)
    7. Verification and Evidence (Post-recovery checks)
- layout structure: Summary cards for posture, tables for scheduled items, and clearly delineated danger zones.
- components used: Page Header, Health Status Card, Dense Operational Table (Maintenance Windows, Backup History), Danger Zone Panel, Confirmation Modal, Danger Modal.
- primary actions: Schedule Maintenance, Initiate Backup, Restore from Backup, Trigger Rollback.
- key states: Scheduled, Active, Backup Healthy, Recovery Point Available, Warning (Danger Zone).

6. Cross-System Oversight Model
The Owner Panel provides a comprehensive cross-system oversight model by aggregating key data points and offering clear drill-down paths:

- **Tenant Systems:** The "Tenants" page lists all tenants with summary health, package, and billing status. Clicking a tenant reveals a `Detail Drawer` containing all associated data: fleet assignments, subscription status, recent activity, and any flags for operational, support, or billing risk. `Tenant Summary Cards` and `Tenant Attention Queues` on the `Platform Overview` page highlight tenants needing intervention.
- **Player Systems:** While not a player portal, the "Community Systems" and "Commerce & Delivery Oversight" pages provide platform-level health indicators. `Community Systems` surfaces aggregate data on event health, bot module adoption/failures, and pipeline health for leaderboards, killfeeds, and raid systems. `Commerce & Delivery Oversight` tracks order volumes, delivery backlogs, failed deliveries, donation performance, and "player operational pain signals" (aggregated error rates, support tickets related to player experience).
- **Delivery Systems (Delivery Agent):** The "Fleet" page distinctly separates Delivery Agents. The `Split Runtime Summary Panel` provides agent counts, online/offline status, and outdated versions. The `Dense Operational Table` lists each agent with its activation state, version drift, machine binding, tenant association, and diagnostic indicators. `Health Status Chips` and `Provisioning State Cards` visually communicate individual agent status. Aggregated agent health is visible on the `Platform Overview` and `Runtime Health` pages.
- **Bot Systems (Server Bot):** Similar to Delivery Agents, Server Bots have their own distinct section on the "Fleet" page. The `Split Runtime Summary Panel` displays bot counts, online/offline status, and log sync freshness. The `Dense Operational Table` shows details like config management posture, backup status, restart readiness, and tenant association. `Diagnostics Cards` provide quick access to server-side logs and health checks. Aggregated bot health is also present on `Platform Overview` and `Runtime Health`.
- **Identity Systems:** The "Identity & Access" page consolidates the health of Discord, Email, and Steam authentication postures. It highlights linked identity integrity issues, suspicious mismatches, and active session management. `Health Status Cards` give a quick overview, and `Dense Operational Tables` list anomalies, with drill-down for investigation.
- **Commerce Systems:** "Billing," "Subscriptions," and "Commerce & Delivery Oversight" provide a full picture. `Billing` focuses on revenue KPIs, invoice status, and financial risk. `Subscriptions` tracks lifecycle, expiring, and failed subscriptions. `Commerce & Delivery Oversight` looks at the operational aspects of order processing and delivery, and donation performance. `Commercial Risk Cards` prominently flag issues across these pages.
- **Community Systems:** As described under Player Systems, this dedicated section monitors the operational health and adoption of features like events, bot modules, leaderboards, killfeeds, and raid systems, providing an executive overview of their platform-wide performance and stability.

7. Runtime Separation Model
The distinction between Delivery Agents and Server Bots is paramount and maintained explicitly across the UI:

- **Navigation Labels:** The primary navigation under "Fleet" will clearly have two distinct sub-items: "Delivery Agents" and "Server Bots." This prevents any ambiguity from the outset.
- **Overview Summaries:** On the `Platform Overview` page, the `Fleet Summary` will explicitly state "Delivery Agents: X healthy, Y degraded" and "Server Bots: A healthy, B degraded," or use a `Split Runtime Summary Panel` dedicated to each.
- **Fleet Tables:** The "Fleet" page itself will be designed with a clear visual separation, potentially using a tabbed interface or two distinct, side-by-side panels. Each panel will contain a `Dense Operational Table` exclusively for its respective runtime, with columns tailored to its unique attributes (e.g., Delivery Agents have "Announce Capability Posture"; Server Bots have "Log Sync Freshness" and "Config Management Posture").
- **Health Cards:** In `Runtime Health` and `Platform Overview`, individual `Health Status Cards` will be labeled "Delivery Agent Health" and "Server Bot Health," never just "Runtime Health" when referring to the fleet components.
- **Diagnostics:** When generating or viewing `Diagnostics Cards`, the UI will require explicit selection of "Delivery Agent Diagnostics" or "Server Bot Diagnostics," ensuring the correct context is always applied.
- **Provisioning:** The provisioning workflow, accessed via `Provisioning State Cards` or direct actions, will explicitly guide the user to "Provision New Delivery Agent" or "Provision New Server Bot."
- **Detail Panels:** When drilling down into an individual agent or bot, the `Detail Drawer` or dedicated detail page will explicitly identify the entity (e.g., "Delivery Agent: [ID]" or "Server Bot: [Name]") and present information relevant only to that runtime type. Actions available within these panels will also be specific (e.g., "Restart Server Bot," "Re-connect Delivery Agent").
- **Warning States:** Any `Severity Badges` or warning messages related to runtimes will specify whether it's a Delivery Agent issue ("Delivery Agent [ID] Offline") or a Server Bot issue ("Server Bot [Name] Config Drift").
- **Operational Language:** All UI text, tooltips, and documentation within the Owner Panel will consistently use the distinct terms "Delivery Agent" and "Server Bot," never a generic "runtime" where specificity is required.

8. Compatibility Notes
The redesign of the Owner Panel prioritizes a modern, operational UI/UX while adhering strictly to existing platform architecture and constraints:

- **Current Routes:** The Information Architecture (IA) is designed to align with existing route families. New UI paths will map logically to `/owner/api/*` endpoints. Navigation and page structures anticipate current `/owner/api/*` routes for tenants, fleets, billing, etc., ensuring that a new frontend can be overlaid without requiring backend route changes. For example, "Tenants" page actions will continue to hit `/owner/api/tenants/[id]` endpoints.
- **Current Backend APIs:** The component system and page layouts are designed to consume data from existing backend API contracts (`/owner/api/*`, `/admin/api/*`, `/platform/api/*`, `/tenant/api/*`, `/player/api/*`, `/api/public/*`). Information density and display logic (e.g., how health status is calculated, how alerts are presented) will be based on the data structures provided by the current APIs. No changes to API request/response schemas are assumed or required.
- **Current Cookie/Session Auth:** The Owner Login page and global shell components (like the profile menu) are designed to integrate seamlessly with the existing same-origin cookie/session authentication model. The UI will simply make standard requests that leverage the browser's cookie handling, without requiring modifications to the authentication flow or token management on the backend.
- **Current Entitlement Logic:** The UI treats entitlements as backend-driven data. Features like `Locked State Panels` or disabled actions (e.g., "Create New Package") will react dynamically to entitlement flags or permissions received from the backend via existing APIs. The design does not hardcode entitlement logic; rather, it reflects the entitlement status provided by the server, preserving existing backend-driven package and feature gating.
- **Current Operational Behavior:** The design explicitly accounts for and visualizes existing operational behaviors. For instance, the separation of Delivery Agents and Server Bots (`Runtime Separation Model`) directly reflects their distinct runtime roles and operational responsibilities. Features like "Config Drift Visibility" and "Pending Restart Visibility" are designed around existing backend capabilities for reporting and acting on these states.
- **No Backend Rewrite:** This frontend redesign explicitly does not necessitate any backend API changes, database schema modifications, or core business logic rewrites. The goal is to build a new, intuitive control plane on top of the existing, stable SCUM managed-service platform's backend, maximizing reusability and minimizing development risk.