# Stitch Handoff Pack

This folder prepares a repo-grounded handoff pack for redesigning the current web UI in Stitch without changing the existing backend contract.

Use this pack when the goal is:

- redesign the frontend only
- preserve current routes, API shapes, cookies, and auth behavior
- preserve multi-tenant behavior and feature/package gating
- preserve the Delivery Agent vs Server Bot runtime split

## Non-Negotiables

- Do not replace the backend.
- Do not replace cookie/session auth with JWT or localStorage auth.
- Do not change same-origin assumptions.
- Do not merge Delivery Agent and Server Bot into one runtime concept.
- Do not hardcode feature/package logic that is already enforced by backend data.
- Do not rename routes unless the old routes still work identically.

## Files In This Folder

- `SOURCE_OF_TRUTH.md`
  - Exact repo files Stitch should use as context.
- `ROUTE_API_MAP.md`
  - Curated route/page/API summary by surface.
- `PROMPT_OWNER.md`
  - Ready-to-paste Stitch prompt for Owner Panel.
- `PROMPT_TENANT.md`
  - Ready-to-paste Stitch prompt for Tenant Admin Panel.
- `PROMPT_PLAYER.md`
  - Ready-to-paste Stitch prompt for Player Portal.
- `PROMPT_PUBLIC_AUTH.md`
  - Ready-to-paste Stitch prompt for Public/Auth pages.

## Current Screenshot Set

Use the current captured screens in `../../output/playwright/all-web-surfaces-20260327/` as visual reference. The most useful image files are:

- Owner
  - `owner-login.png`
  - `owner-dashboard.png`
  - `owner-tenants.png`
  - `owner-runtime.png`
- Tenant
  - `tenant-login.png`
  - `tenant-dashboard.png`
  - `tenant-server-status.png`
  - `tenant-server-config.png`
  - `tenant-orders.png`
  - `tenant-players.png`
  - `tenant-delivery-agents.png`
  - `tenant-server-bots.png`
  - `tenant-restart-control.png`
- Player
  - `player-login.png`
  - `player-home.png`
  - `player-commerce.png`
  - `player-stats.png`

The screenshot index is at:

- `../../output/playwright/all-web-surfaces-20260327/README.md`

If Stitch accepts image attachments, prefer attaching the PNG files directly instead of relying only on the screenshot README.

## Recommended Stitch Attachment Set

### Minimum Set For Any Surface

Attach:

- `SOURCE_OF_TRUTH.md`
- `ROUTE_API_MAP.md`
- one surface prompt from this folder
- relevant screenshot PNGs

### Extra Files To Attach When Stitch Needs More Precision

- current shell HTML file for that surface
- current browser runtime JS for that surface
- auth/runtime constraint files if Stitch starts proposing backend/auth changes

## Suggested Workflow

1. Start with one surface only.
2. Attach `SOURCE_OF_TRUTH.md`, `ROUTE_API_MAP.md`, and the prompt for that surface.
3. Attach the relevant screenshots.
4. If Stitch proposes backend changes, attach the auth/runtime files listed in `SOURCE_OF_TRUTH.md`.
5. Review the output against the current route and API map before implementing anything.

## Surface Order

Recommended redesign order:

1. Public/Auth
2. Player
3. Tenant
4. Owner

This order helps establish the shared design language first, then the player experience, then the operational surfaces.
