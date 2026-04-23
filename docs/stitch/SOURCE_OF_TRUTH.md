# Source Of Truth For Stitch

Stitch will not infer the current product structure from the repository by itself. If the redesign must preserve existing behavior, use the files below as source-of-truth context.

## Always Attach

- `../WEB_SURFACES_V4_SITEMAP_TH.md`
  - Current page inventory and intended IA for Owner, Tenant, and Player surfaces.
- `../WEB_SURFACES_V4_BLUEPRINT_TH.md`
  - Product and UX blueprint behind the current surfaces.
- `../../output/playwright/all-web-surfaces-20260327/README.md`
  - Current captured URLs and screenshots.
- relevant PNGs from `../../output/playwright/all-web-surfaces-20260327/`
  - Best visual evidence of the current UI.
- `../../src/domain/billing/productEntitlementService.js`
  - Current backend-driven feature/package gating model.
- `../../src/contracts/agent/agentContracts.js`
  - Explicit runtime split between Delivery Agent and Server Bot.

## Owner Panel

Attach these when designing the Owner surface:

- `../../src/admin/owner-console.html`
  - Current Owner shell HTML.
- `../../src/admin/assets/owner-v4-app.js`
  - Current Owner route aliases, page sections, and API usage.
- `../../src/admin/assets/admin-i18n.js`
  - Current translation-key driven UI model.
- `../../src/admin/assets/admin-login-v4.js`
  - Current admin/owner login behavior.

## Tenant Admin Panel

Attach these when designing the Tenant surface:

- `../../src/admin/tenant-console.html`
  - Current Tenant shell HTML.
- `../../src/admin/assets/tenant-v4-app.js`
  - Current Tenant route aliases, page sections, locked-state logic, and API usage.
- `../../src/admin/assets/tenant-login-v1.js`
  - Current tenant login behavior.
- `../../src/admin/assets/admin-i18n.js`
  - Current translation-key driven UI model.

## Player Portal

Attach these when designing the Player surface:

- `../../apps/web-portal-standalone/public/player-core.html`
  - Current authenticated player shell HTML.
- `../../apps/web-portal-standalone/public/assets/player-v4-app.js`
  - Current Player route sections and API usage.
- `../../apps/web-portal-standalone/public/assets/player-auth-v1.js`
  - Current player magic-link/email auth flow.
- `../../apps/web-portal-standalone/public/assets/portal-i18n.js`
  - Current translation-key driven UI model.

## Public/Auth

Attach these when designing public and auth pages:

- `../../apps/web-portal-standalone/public/landing.html`
- `../../apps/web-portal-standalone/public/pricing.html`
- `../../apps/web-portal-standalone/public/signup.html`
- `../../apps/web-portal-standalone/public/login.html`
- `../../apps/web-portal-standalone/public/forgot-password.html`
- `../../apps/web-portal-standalone/public/verify-email.html`
- `../../apps/web-portal-standalone/public/checkout.html`
- `../../apps/web-portal-standalone/public/payment-result.html`
- `../../apps/web-portal-standalone/public/preview.html`
- `../../apps/web-portal-standalone/public/assets/public-auth-v2.js`
  - Current public/auth page behavior and `/api/public/*` usage.
- `../../apps/web-portal-standalone/runtime/portalPageRoutes.js`
  - Canonical public/auth/player routing and redirects.

## Auth, Cookie, and Origin Constraints

Attach these if Stitch starts suggesting cross-origin frontend hosting, JWT auth, or localStorage auth:

- `../../src/admin/auth/adminAuthRuntime.js`
  - Admin cookie/session rules.
- `../../apps/web-portal-standalone/auth/portalAuthRuntime.js`
  - Player portal cookie/session and origin validation rules.
- `../../src/admin/runtime/adminStandaloneSurfaceRuntime.js`
  - Owner/Tenant standalone surface proxying and redirect model.
- `../../apps/web-portal-standalone/runtime/portalRequestRuntime.js`
  - Player/Public request dispatch and auth enforcement.

## What These Files Prove

- routes and page responsibilities already exist
- the frontend is currently HTML plus browser JS, not a server-component UI
- API usage is explicit in client files
- same-origin cookie auth is a hard compatibility constraint
- feature/package gating is backend-driven
- Delivery Agent and Server Bot are separate runtime concepts and must remain separate in UI wording and flows

## What Stitch Should Not Guess

Stitch should not guess:

- that the backend can be changed
- that auth can move to JWT or browser storage
- that feature gating can be hardcoded in the UI
- that Delivery Agent and Server Bot can be merged
- that the current shell routes are disposable

If it needs to improve IA, it must do so without breaking those constraints.
