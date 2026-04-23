Design the Player Portal UI for an existing SCUM managed-service platform. Redesign frontend only. Do not change backend APIs, auth, routes, cookies, or business logic.

Use the attached files as source-of-truth context, especially:

- `docs/stitch/SOURCE_OF_TRUTH.md`
- `docs/stitch/ROUTE_API_MAP.md`
- `output/playwright/all-web-surfaces-20260327/player-login.png`
- `output/playwright/all-web-surfaces-20260327/player-home.png`
- `output/playwright/all-web-surfaces-20260327/player-commerce.png`
- `output/playwright/all-web-surfaces-20260327/player-stats.png`
- `apps/web-portal-standalone/public/player-core.html`
- `apps/web-portal-standalone/public/assets/player-v4-app.js`
- `apps/web-portal-standalone/public/assets/player-auth-v1.js`

Hard constraints:

- Keep same-origin cookie/session auth.
- Keep existing API families working exactly as-is: `/player/api/*`.
- Do not replace backend identity or account logic.
- Preserve package and feature gating coming from backend.
- All copy must be i18n-ready for English and Thai.

Design goals:

- premium player-facing portal
- game-adjacent, atmospheric, clean, trustworthy
- strong focus on wallet, shop, delivery, stats, identity, and support

Design these pages and states:

- home
- wallet
- shop
- cart and checkout
- orders
- delivery tracking
- stats
- leaderboard
- events
- donations and supporters
- profile
- linked identities
- support

Important UX rules:

- Support Discord, email, Steam, and in-game identity concepts.
- Make locked features and package limitations understandable without breaking flows.
- Show async states clearly: queued, processing, delivered, failed, retry, pending verification.
- Keep operational clarity for purchases, delivery, profile verification, and support tickets.
- Preserve current shell sections and `/player/api/*` dependencies.

Deliver:

1. visual direction
2. player design tokens and components
3. page-by-page layout plan
4. navigation model
5. interaction patterns for commerce, identity, and support
6. migration notes showing how the new UI keeps the current `/player/api` contract unchanged

Do not propose backend rewrites. Treat this as a frontend redesign over an existing live player portal.
