You are auditing this repository as a senior software architect and product-readiness reviewer.

This is an evaluation task first, not an implementation task.
Do NOT start by editing files.
Do NOT jump into refactoring immediately.
First inspect the repository and produce a full readiness assessment.

==================================================
GOAL
==================================================

Audit the current project and determine how ready it is to become a production-grade managed service / SaaS-style SCUM platform.

You must review the repository against the full system goals below and produce a structured readiness report.

==================================================
PROJECT MODEL TO AUDIT AGAINST
==================================================

The intended platform includes:

1. Three web surfaces:

- Owner Panel
- Tenant Admin Panel
- Player Portal

2. Two separate runtime roles:

- Delivery Agent
  - runs on a machine with SCUM game client open
  - handles delivery jobs and may send in-game announce commands
- Server Bot
  - runs on the server-side machine
  - handles SCUM.log sync, config editing, backup, restart/start/stop

These two runtime roles must remain clearly separated.

3. Product requirements:

- multi-tenant
- feature/package gating
- preview mode before purchase
- self-service signup
- linked identities across Discord/Web/Steam/In-game
- config editor
- restart orchestration
- donation system
- event system
- bot modules system
- player stats / leaderboard / killfeed
- raid request / raid window / raid summary system
- multi-language support (at least English + Thai)
- notifications, audit logs, analytics, automation

==================================================
IMPORTANT AUDIT RULES
==================================================

- Do NOT assume the system is complete unless the repo clearly proves it
- Do NOT claim a feature exists just because there is a placeholder page or route
- Distinguish clearly between:
  - fully implemented
  - partially implemented
  - scaffolded / placeholder
  - missing
- If something exists only in docs but not code, say so
- If something exists only in code but not wired into product flows, say so
- Be strict and practical

==================================================
AREAS TO AUDIT
==================================================

Audit ALL of these areas:

1. Repository architecture

- apps/
- src/
- runtime separation
- domain separation
- SCUM integration boundaries
- config/bootstrap structure
- docs/test/deploy structure

2. Backend / control plane

- auth
- tenants
- packages
- subscriptions
- agents/bots
- provisioning
- activation
- config flow
- restart flow
- sync flow
- delivery flow
- donation/events/modules
- raid system
- notifications
- analytics
- audit logging
- automation/scheduling

3. Database / persistence

- schema quality
- tenant isolation
- agent records
- token lifecycle
- linked identities
- orders
- logs
- donations
- events
- raids
- notifications
- audit logs

4. Owner Panel readiness

- overview
- tenant management
- package management
- provisioning flows
- billing/revenue
- support/diagnostics
- audit/security

5. Tenant Admin Panel readiness

- dashboard
- package awareness
- server config
- restart control
- Delivery Agent management
- Server Bot management
- shop/orders/delivery
- donations/events/modules
- staff/permissions
- Discord integration
- diagnostics

6. Player Portal readiness

- wallet
- shop
- orders
- delivery
- stats
- leaderboards
- killfeed
- donations/supporters
- events
- linked accounts
- profile

7. Identity linking readiness

- Discord login
- email signup/login
- Google login if present
- linked account model
- Steam linking
- in-game player matching
- verification flow

8. Delivery Agent readiness

- provisioning
- activation
- binding
- reconnect
- status
- job handling
- announce support
- separation from server management

9. Server Bot readiness

- provisioning
- activation
- log sync
- config read/write
- backup
- verification
- restart/start/stop
- diagnostics
- separation from delivery

10. Config system readiness

- schema-driven config metadata
- UI field typing
- backend validation
- backup
- temp file writing
- rollback
- restart-required metadata

11. Restart orchestration readiness

- restart now
- delayed restart
- safe restart
- countdown announce
- history
- health verification after restart

12. Package / feature gating readiness

- backend enforcement
- frontend enforcement
- preview mode
- locked states
- dynamic navigation
- entitlement resolution

13. Internationalization readiness

- translation key usage
- locale files
- language switcher
- hardcoded text
- Discord message translation readiness

14. Productization / commercial readiness

- self-service signup
- preview mode
- package purchase flow
- trial flow
- billing/subscription lifecycle
- tenant onboarding
- support readiness

15. Security / operations readiness

- token hashing
- setup token lifecycle
- device binding
- role enforcement
- tenant isolation
- audit logging
- monitoring
- alerts
- diagnostics
- abuse/rate-limit signals

==================================================
SCORING MODEL
==================================================

For each major area, score it from:
0 = missing
1 = very weak
2 = partial
3 = mostly working
4 = strong
5 = production-ready

Also assign one overall maturity level:

- Hobby / Internal Tool
- Advanced Internal Platform
- Managed-Service Prototype
- Managed-Service Ready
- SaaS Foundation
- Commercial-Ready Service

==================================================
OUTPUT FORMAT
==================================================

Return your findings in exactly these sections:

1. Executive Summary

- What the project is now
- What it is closest to becoming
- Overall maturity rating

2. What is Already Strong

- List only the strongest areas with evidence

3. What is Partial / Unfinished

- List partial systems and what is missing

4. What is Missing

- List systems that are not really present yet

5. Detailed Readiness Checklist
   For each audit area:

- Score (0-5)
- Status: implemented / partial / placeholder / missing
- Evidence from repo
- Main gaps
- Risk level

6. Critical Gaps Before Real Service Launch

- List the must-fix items before offering this as a serious managed service

7. Recommended Priority Order
   Group work into:

- P0 (must fix first)
- P1
- P2
- P3

8. Final Verdict

- Can this be used now?
- Can this be sold now?
- What level is it at today?

==================================================
IMPORTANT BEHAVIOR
==================================================

Do NOT implement changes in this run.
Do NOT produce code first.
Do NOT give vague praise.
Be concrete, repo-grounded, and strict.

Start by auditing the repository structure and then produce the full readiness report.
