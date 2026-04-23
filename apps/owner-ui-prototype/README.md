# Owner UI Prototype

Isolated React prototype for the SCUM Owner/Owen control plane redesign.

This app is intentionally separate from the current `apps/owner-web` runtime. It does not replace the production Owner Panel.

The prototype now uses a backend-first data layer:

- It calls the real Owner/Admin endpoints through the Vite dev proxy.
- It does not silently replace unavailable backend data with mock records by default.
- If the backend is reachable but the browser is not authenticated, the dashboard links to a separate prototype login surface at `/login`.
- The login surface is implemented separately in `src/OwnerLoginPage.jsx` and posts to `/owner/api/login`.
- If only some backend slices are available, it marks the page as partial live data and keeps the real returned records.
- Page actions are resolved through `src/lib/owner-actions.js`; actions without required payloads, confirmations, or endpoints are disabled instead of pretending to work.
- The footer shows whether the current page is using live backend data, partial backend data, or blocked/offline data.

## Run

```powershell
cd C:\new\apps\owner-ui-prototype
npm install
npm run dev
```

Open `http://127.0.0.1:5177`.

Open `http://127.0.0.1:5177/login` for the separate Owner login surface.

## Prototype routes

- `/` and `/overview` - platform overview
- `/tenants` - tenant management
- `/packages` - package management
- `/billing` - billing and ledger
- `/subscriptions` - subscription oversight
- `/fleet` - Delivery Agent and Server Bot fleet
- `/observability` - telemetry and diagnostics
- `/incidents` - notifications and alert handling
- `/support` - support diagnostics
- `/recovery` - backup and restore readiness
- `/security` - audit and security
- `/settings` - runtime and integration settings
- `/login` - separate Owner login surface

By default, API calls proxy to `http://127.0.0.1:3201`, which is the current Owner web runtime target. Override it if needed:

```powershell
$env:OWNER_UI_PROXY_TARGET="http://127.0.0.1:3201"
npm run dev
```

## Notes

- Uses Vite + React + Tailwind + lucide-react + framer-motion.
- Local `src/components/ui/*` files provide the minimal shadcn-style component API needed by the prototype.
- Backend API paths are mapped in `src/lib/owner-adapters.js`.
- Page loading is implemented in `src/lib/owner-api.js`.
- Owner login/logout helpers are implemented in `src/lib/owner-auth.js`.
- Safe/readiness actions are mapped where a real endpoint exists. Risky actions still require explicit payload and confirmation before they can run.

## Verification

Run unit tests and a production build:

```powershell
npm test
npm run build
```

Run browser QA with mocked live backend data. This checks the main support/i18n flow and every Owner route in desktop and mobile viewports:

```powershell
npm run verify:browser
```

The route smoke report is written to `output/playwright/owner-route-smoke-report.json`.

Run a read-only live backend smoke check against a real Owner/Admin backend:

```powershell
$env:OWNER_API_BASE="http://127.0.0.1:3201"
$env:OWNER_USERNAME="owner"
$env:OWNER_PASSWORD="<password>"
npm run verify:live
```

You can also provide a cookie directly:

```powershell
$env:OWNER_AUTH_COOKIE="owner_session=..."
npm run verify:live
```

Or use a cookie file without printing secrets to the console:

```powershell
$env:OWNER_AUTH_COOKIE_FILE="C:\new\owner.cookies"
npm run verify:live
```

`verify:live` only calls read-only JSON endpoints. Mutation and download endpoints are intentionally skipped.
