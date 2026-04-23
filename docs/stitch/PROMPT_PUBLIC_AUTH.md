Design the Public Marketing and Auth UI for an existing SCUM managed-service platform. Redesign frontend only. Do not change backend APIs, auth, routes, cookies, or business logic.

Use the attached files as source-of-truth context, especially:

- `docs/stitch/SOURCE_OF_TRUTH.md`
- `docs/stitch/ROUTE_API_MAP.md`
- `apps/web-portal-standalone/public/landing.html`
- `apps/web-portal-standalone/public/pricing.html`
- `apps/web-portal-standalone/public/signup.html`
- `apps/web-portal-standalone/public/login.html`
- `apps/web-portal-standalone/public/forgot-password.html`
- `apps/web-portal-standalone/public/verify-email.html`
- `apps/web-portal-standalone/public/checkout.html`
- `apps/web-portal-standalone/public/payment-result.html`
- `apps/web-portal-standalone/public/preview.html`
- `apps/web-portal-standalone/public/assets/public-auth-v2.js`
- `apps/web-portal-standalone/runtime/portalPageRoutes.js`

Hard constraints:

- Keep existing public and auth backend behavior unchanged.
- Keep existing API family working exactly as-is: `/api/public/*`.
- Preserve same-origin cookie and session assumptions where applicable.
- Do not invent a new auth architecture.
- All copy must be i18n-ready for English and Thai.

Design goals:

- premium public-facing product experience
- clear path from discovery to signup, preview, checkout, tenant admin entry, and player entry
- commercial-ready feel without looking like a generic SaaS template

Design these pages and states:

- landing page
- pricing and packages
- signup
- login
- forgot password
- verify email
- preview and trial
- checkout result
- product entry routing for Tenant Admin vs Player Portal
- public status page
- public per-server pages where relevant

Important UX rules:

- Explain package value, preview/trial state, and locked features clearly.
- Keep self-service signup and conversion flow simple.
- Support backend-driven product links, checkout states, verification states, and error states.
- Keep routing to Tenant vs Player experiences explicit and low-friction.
- Preserve current `/api/public/*` flows and public page responsibilities.

Deliver:

1. visual direction
2. marketing/auth component system
3. page-by-page layout plan
4. funnel and interaction model
5. copy structure ready for i18n
6. migration notes showing compatibility with current `/api/public` backend flows

Do not propose backend rewrites. Treat this as a frontend redesign over an existing public/auth surface.
