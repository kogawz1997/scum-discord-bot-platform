Design the Owner Panel UI for an existing SCUM managed-service platform. Redesign frontend only. Do not change backend APIs, auth, routes, cookies, or business logic.

Use the attached files as source-of-truth context, especially:

- `docs/stitch/SOURCE_OF_TRUTH.md`
- `docs/stitch/ROUTE_API_MAP.md`
- `output/playwright/all-web-surfaces-20260327/owner-login.png`
- `output/playwright/all-web-surfaces-20260327/owner-dashboard.png`
- `output/playwright/all-web-surfaces-20260327/owner-tenants.png`
- `output/playwright/all-web-surfaces-20260327/owner-runtime.png`
- `src/admin/owner-console.html`
- `src/admin/assets/owner-v4-app.js`

Hard constraints:

- Keep same-origin cookie/session auth.
- Keep existing API families working exactly as-is: `/owner/api/*`, `/admin/api/*`, `/platform/api/*`.
- Do not introduce a new backend or JWT/localStorage auth.
- Keep multi-tenant behavior, package gating, audit, observability, automation, and runtime separation intact.
- All copy must be i18n-ready for English and Thai.

Design goals:

- premium operational control-plane UI
- dark, tactical, high-trust, information-dense
- distinct owner-level feel focused on platform oversight, risk, revenue, fleet, incidents, and security

Design these pages and states:

- platform overview
- tenant management
- package catalog and feature matrix
- subscriptions and billing overview
- runtime health and incidents
- observability and automation
- audit and security
- support and diagnostics
- agent fleet and provisioning visibility

Important UX rules:

- Separate Delivery Agent from Server Bot clearly in all language and layouts.
- Show tenant scope, package scope, runtime health, risk states, and operator consequences clearly.
- Support locked states, upgrade prompts, degraded states, empty states, and live operational states.
- Prefer serious control-room patterns: dense tables, timelines, filters, alerts, drawers, approval/risk modals.
- Preserve current route responsibilities even if you improve page IA.
- Preserve current live update assumptions such as `/admin/api/live`.

Deliver:

1. visual direction
2. design tokens
3. component system
4. page-by-page layout plan
5. interaction model
6. migration notes showing how this UI maps to the existing backend contract without backend changes

Do not propose backend rewrites. Treat this as a frontend redesign over an existing live control plane.
