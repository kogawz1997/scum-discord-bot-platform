# Standalone SCUM Player Portal

Language:

- English: `README.md`
- Thai: [README_TH.md](./README_TH.md)

This app runs the player-facing portal as its own process and keeps the player path separate from the admin control plane.

The player portal does not talk directly to the game-side machine. Player-facing reads and writes must still resolve through the shared control-plane and persistence boundaries.

Current primary routes:

- `/player` for the player portal
- `/player/login` for Discord sign-in
- `/landing` for the public role-entry landing page
- `/showcase` and `/trial` for public-facing product pages

Admin routes are not served from this app:

- `/admin*` redirects to the configured admin origin through `WEB_PORTAL_LEGACY_ADMIN_URL`

## Current Role Split

- `Owner`
  - platform-wide oversight
  - tenant fleet, runtime, security, recovery
- `Admin`
  - tenant-scoped server operations
  - commerce, delivery, support, config
- `Player`
  - wallet, orders, redeem, profile, Steam link

Public pages served from this app:

- `/landing`
- `/showcase`
- `/trial`

The portal intentionally keeps player flows separate from owner/admin operations so role boundaries stay clear.

## Player Capabilities

- Discord OAuth login
- Player dashboard and account summary
- Wallet and transaction history
- Shop, cart, checkout, and purchase history
- Redeem flow and redeem history
- Steam link flow
- Missions, wheel, party, bounty, and notification views

## Required Environment

At minimum configure:

- `WEB_PORTAL_MODE=player`
- `WEB_PORTAL_BASE_URL=http://127.0.0.1:3300`
- `WEB_PORTAL_LEGACY_ADMIN_URL=http://127.0.0.1:3200/admin`
- `WEB_PORTAL_DISCORD_CLIENT_ID=...`
- `WEB_PORTAL_DISCORD_CLIENT_SECRET=...`

Recommended additional settings:

- `WEB_PORTAL_SECURE_COOKIE=true` for HTTPS deployments
- `WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true`
- `WEB_PORTAL_MAP_EMBED_ENABLED=true`

See [../../docs/ENV_REFERENCE_TH.md](../../docs/ENV_REFERENCE_TH.md) for the broader env catalog.

## Discord OAuth

Discord Developer Portal redirect URIs:

- Local:
  - `http://127.0.0.1:3300/auth/discord/callback`
- Production:
  - `https://player.genz.noah-dns.online/auth/discord/callback`

## Start

From the repository root:

```bash
npm run start:web-standalone
```

Health check:

```bash
curl http://127.0.0.1:3300/healthz
```

## Validation

Recommended checks before deploy or reopen:

```bash
npm run doctor:web-standalone
npm run doctor:web-standalone:prod
npm run readiness:prod
npm run smoke:postdeploy
```

## Production Notes

- The player portal is a primary route, not a legacy view.
- Owner and tenant admin work should stay in the admin web surfaces.
- This app must not replace owner/admin security flows.
- Keep Discord OAuth, session, and route behavior aligned with the main platform docs.

See also:

- [../../README.md](../../README.md)
- [../../docs/OPERATOR_QUICKSTART.md](../../docs/OPERATOR_QUICKSTART.md)
- [../../docs/PRODUCT_READY_GAP_MATRIX.md](../../docs/PRODUCT_READY_GAP_MATRIX.md)

