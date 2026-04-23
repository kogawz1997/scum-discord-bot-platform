Design the Tenant Admin Panel UI for an existing SCUM managed-service platform. Redesign frontend only. Do not change backend APIs, auth, routes, cookies, or business logic.

Use the attached files as source-of-truth context, especially:

- `docs/stitch/SOURCE_OF_TRUTH.md`
- `docs/stitch/ROUTE_API_MAP.md`
- `output/playwright/all-web-surfaces-20260327/tenant-login.png`
- `output/playwright/all-web-surfaces-20260327/tenant-dashboard.png`
- `output/playwright/all-web-surfaces-20260327/tenant-server-status.png`
- `output/playwright/all-web-surfaces-20260327/tenant-server-config.png`
- `output/playwright/all-web-surfaces-20260327/tenant-orders.png`
- `output/playwright/all-web-surfaces-20260327/tenant-players.png`
- `output/playwright/all-web-surfaces-20260327/tenant-delivery-agents.png`
- `output/playwright/all-web-surfaces-20260327/tenant-server-bots.png`
- `output/playwright/all-web-surfaces-20260327/tenant-restart-control.png`
- `src/admin/tenant-console.html`
- `src/admin/assets/tenant-v4-app.js`

Hard constraints:

- Keep same-origin cookie/session auth.
- Keep existing API families working exactly as-is: `/tenant/api/*`, `/admin/api/*`, `/platform/api/*`.
- Do not introduce a new backend or replace current entitlements logic.
- Keep Delivery Agent and Server Bot as separate runtime roles.
- All copy must be i18n-ready for English and Thai.

Design goals:

- operational admin UI for a tenant running a SCUM community
- modern, premium, practical, high-signal
- emphasis on server control, orders, players, runtime health, and guarded actions

Design these pages and states:

- tenant dashboard
- onboarding
- server status
- server config editor
- logs sync
- restart control
- Delivery Agent management
- Server Bot management
- orders and shop operations
- donations
- events
- bot modules
- players
- staff and roles
- billing
- settings
- diagnostics

Important UX rules:

- Preserve backend-driven feature/package gating, locked actions, upgrade CTAs, and preview/trial states.
- Config and restart flows must show validation, backup, rollback, restart-required, and risk confirmation clearly.
- Agent provisioning must show setup token, binding, status, version, session/device health, and separation by runtime type.
- Support empty, partial, loading, error, and degraded states.
- Preserve current route responsibilities and the shell-driven section model unless improved without breaking behavior.

Deliver:

1. visual direction
2. shared/admin component patterns
3. page-by-page tenant IA and layout plan
4. forms, tables, and action patterns
5. state model for locked, degraded, running, and risky flows
6. migration notes showing compatibility with existing backend routes and payloads

Do not propose backend rewrites. Treat this as a frontend redesign over an existing operational tenant surface.
