# Refactor Plan

This file tracks the structural work that is still worth doing after the current hardening round.

## Completed in current state

- Runtime flag parsing moved into [src/config/](../src/config/).
- Bot and worker startup wiring moved into [src/bootstrap/](../src/bootstrap/).
- Admin control-panel env registry moved into [src/config/adminEditableConfig.js](../src/config/adminEditableConfig.js).
- Readiness and smoke checks now fail on required runtimes that report `ready: false`.
- Player portal startup validation and health payload assembly moved into [apps/web-portal-standalone/runtime/portalRuntime.js](../apps/web-portal-standalone/runtime/portalRuntime.js).
- Player portal page routing and canonical redirect handling moved into [apps/web-portal-standalone/runtime/portalPageRoutes.js](../apps/web-portal-standalone/runtime/portalPageRoutes.js).
- Player portal request dispatch and cleanup timer moved into [apps/web-portal-standalone/runtime/portalRequestRuntime.js](../apps/web-portal-standalone/runtime/portalRequestRuntime.js).
- Player portal page/static asset loading moved into [apps/web-portal-standalone/runtime/portalPageAssetRuntime.js](../apps/web-portal-standalone/runtime/portalPageAssetRuntime.js).
- Player portal HTTP listen/error/signal wiring moved into [apps/web-portal-standalone/runtime/portalServerLifecycle.js](../apps/web-portal-standalone/runtime/portalServerLifecycle.js).
- Worker health payload assembly moved into [src/bootstrap/workerHealthRuntime.js](../src/bootstrap/workerHealthRuntime.js).
- Bot ready/runtime boot logic moved into [src/bootstrap/botReadyRuntime.js](../src/bootstrap/botReadyRuntime.js).
- Bot message moderation and welcome listeners moved into [src/bootstrap/botCommunityRuntime.js](../src/bootstrap/botCommunityRuntime.js).
- Bot interaction handling moved into [src/discord/interactions/botInteractionRuntime.js](../src/discord/interactions/botInteractionRuntime.js).
- Bot ops-alert routing moved into [src/bootstrap/botOpsAlertRuntime.js](../src/bootstrap/botOpsAlertRuntime.js).
- Admin GET/query routing now has a dedicated module at [src/admin/api/adminGetRoutes.js](../src/admin/api/adminGetRoutes.js).
- Admin auth/session revoke, login/logout, public/platform/SSO, and portal-bridge handlers now have dedicated modules under [src/admin/api/](../src/admin/api/).
- Admin page/template/static asset loading moved into [src/admin/runtime/adminPageRuntime.js](../src/admin/runtime/adminPageRuntime.js).
- Admin HTTP/cookie/TOTP/response helpers moved into [src/admin/runtime/adminHttpRuntime.js](../src/admin/runtime/adminHttpRuntime.js).
- Admin request/origin/body helpers and restore-maintenance gating moved into [src/admin/runtime/adminRequestRuntime.js](../src/admin/runtime/adminRequestRuntime.js).
- Admin access/session/cookie gating helpers moved into [src/admin/runtime/adminAccessRuntime.js](../src/admin/runtime/adminAccessRuntime.js).
- Admin control-panel env/application helpers moved into [src/admin/runtime/adminControlPanelRuntime.js](../src/admin/runtime/adminControlPanelRuntime.js).
- Admin login/rate-limit/security-event helpers moved into [src/admin/runtime/adminSecurityRuntime.js](../src/admin/runtime/adminSecurityRuntime.js).
- Admin live/SSE/metrics helpers moved into [src/admin/runtime/adminLiveRuntime.js](../src/admin/runtime/adminLiveRuntime.js).
- Admin security event export helpers moved into [src/admin/runtime/adminSecurityExportRuntime.js](../src/admin/runtime/adminSecurityExportRuntime.js).
- Admin request handler composition moved into [src/admin/runtime/adminServerRuntime.js](../src/admin/runtime/adminServerRuntime.js).
- Admin Discord OAuth client calls moved into [src/admin/auth/adminDiscordOauthClient.js](../src/admin/auth/adminDiscordOauthClient.js).
- Admin dashboard CSS and large UI helper groups moved into [src/admin/assets/](../src/admin/assets/).
- Admin audit/dataset and observability browser helpers moved into dedicated assets under [src/admin/assets/](../src/admin/assets/).
- Player general/profile/social/reward API handlers now have a dedicated module at [apps/web-portal-standalone/api/playerGeneralRoutes.js](../apps/web-portal-standalone/api/playerGeneralRoutes.js).
- Shared runtime health normalization now lives at [src/utils/runtimeStatus.js](../src/utils/runtimeStatus.js).
- Player portal runtime URL/path helpers now live under [apps/web-portal-standalone/runtime/portalRuntime.js](../apps/web-portal-standalone/runtime/portalRuntime.js).
- Player portal env/body/player helper assembly now lives under [apps/web-portal-standalone/runtime/portalHelperRuntime.js](../apps/web-portal-standalone/runtime/portalHelperRuntime.js).
- Player portal response/security/notification helper assembly now lives under [apps/web-portal-standalone/runtime/portalResponseRuntime.js](../apps/web-portal-standalone/runtime/portalResponseRuntime.js).
- Player portal reward/wheel/timezone helper assembly now lives under [apps/web-portal-standalone/runtime/portalRewardRuntime.js](../apps/web-portal-standalone/runtime/portalRewardRuntime.js).
- Admin config-editor/simple-config browser helpers now live under [src/admin/assets/dashboard-config.js](../src/admin/assets/dashboard-config.js).
- Admin shop catalog/browser helpers now live under [src/admin/assets/dashboard-shop.js](../src/admin/assets/dashboard-shop.js).
- Admin browser shell/common helpers now live under [src/admin/assets/dashboard-shell.js](../src/admin/assets/dashboard-shell.js).

## Still partial

### `src/adminWebServer.js`

Current state:

- Config registry moved out.
- Auth/session runtime moved to `src/admin/auth/`.
- POST route groups moved to `src/admin/api/`.
- Public/platform/SSO routing moved to `src/admin/api/adminPublicRoutes.js`.
- GET/query routes now have a dedicated module under `src/admin/api/`.
- Audit/export routes now live under `src/admin/audit/`.
- Legacy inline GET duplication has been removed.
- Login/logout now live in the auth POST route module.
- Page/static loading now lives in `src/admin/runtime/adminPageRuntime.js`.
- HTTP/cookie/TOTP/response helpers now live in `src/admin/runtime/adminHttpRuntime.js`.
- Request/origin/body helpers now live in `src/admin/runtime/adminRequestRuntime.js`.
- Access/session/cookie gating helpers now live in `src/admin/runtime/adminAccessRuntime.js`.
- Control-panel env/application helpers now live in `src/admin/runtime/adminControlPanelRuntime.js`.
- Login/rate-limit/security-event helpers now live in `src/admin/runtime/adminSecurityRuntime.js`.
- Live/SSE/metrics helpers now live in `src/admin/runtime/adminLiveRuntime.js`.
- Security export helpers now live in `src/admin/runtime/adminSecurityExportRuntime.js`.
- Request handler composition now lives in `src/admin/runtime/adminServerRuntime.js`.
- Server lifecycle/bootstrap wiring now lives in `src/admin/runtime/adminServerLifecycleRuntime.js`.
- Discord OAuth HTTP helpers now live in `src/admin/auth/adminDiscordOauthClient.js`.
- Entry file is now mostly dependency wiring, though it still concentrates a large amount of assembly in one place.

Next cut:

- Reduce the remaining dependency assembly only where it lowers review cost materially.
- Keep the entry file focused on composition/bootstrap only.

### `apps/web-portal-standalone/server.js`

Current state:

- Startup validation and health payload logic moved out.
- Auth/session handling moved out.
- Commerce/cart/redeem/bounty/rentbike handlers moved to `apps/web-portal-standalone/api/`.
- General/profile/social/reward/dashboard handlers moved to `apps/web-portal-standalone/api/playerGeneralRoutes.js`.
- Page routing and canonical redirects moved to `apps/web-portal-standalone/runtime/portalPageRoutes.js`.
- Runtime URL/path helpers now live in `apps/web-portal-standalone/runtime/portalRuntime.js`.
- Shared env/body/player helper assembly now lives in `apps/web-portal-standalone/runtime/portalHelperRuntime.js`.
- Response/security/notification helper assembly now lives in `apps/web-portal-standalone/runtime/portalResponseRuntime.js`.
- Reward/wheel/timezone helper assembly now lives in `apps/web-portal-standalone/runtime/portalRewardRuntime.js`.
- Request dispatch and cleanup timer now live in `apps/web-portal-standalone/runtime/portalRequestRuntime.js`.
- Page/static helper assembly now lives in `apps/web-portal-standalone/runtime/portalPageAssetRuntime.js`.
- HTTP server lifecycle wiring now lives in `apps/web-portal-standalone/runtime/portalServerLifecycle.js`.
- Helper/auth/route bootstrap wiring now lives in `apps/web-portal-standalone/runtime/portalBootstrapRuntime.js`.
- `server.js` is now a thin bootstrap entrypoint.

Next cut:

- Keep [apps/web-portal-standalone/server.js](../apps/web-portal-standalone/server.js) thin as new portal work lands.
- Add targeted tests only if new bootstrap responsibilities appear.

### `src/admin/dashboard.html` and browser assets

Current state:

- Inline CSS moved to `src/admin/assets/dashboard.css`.
- Auth/security browser helpers moved to `src/admin/assets/dashboard-auth.js`.
- Delivery/notification browser helpers moved to `src/admin/assets/dashboard-delivery.js`.
- Audit/dataset helpers moved to `src/admin/assets/dashboard-audit.js`.
- Observability/chart helpers moved to `src/admin/assets/dashboard-observability.js`.
- Shell/common helpers moved to `src/admin/assets/dashboard-shell.js`.
- Control-panel helpers moved to `src/admin/assets/dashboard-control.js`.
- Config-editor/simple-config helpers moved to `src/admin/assets/dashboard-config.js`.
- Shop catalog/bundle helpers moved to `src/admin/assets/dashboard-shop.js`.
- Snapshot/session/form runtime helpers moved to `src/admin/assets/dashboard-runtime.js`.
- Browser DOM refs moved to `src/admin/assets/dashboard-dom.js`.
- Browser mutable state moved to `src/admin/assets/dashboard-state.js`.
- Browser event binding/startup wiring moved to `src/admin/assets/dashboard-bindings.js`.
- The HTML shell is much smaller, but the main browser runtime is still large.

Next cut:

- Keep browser assets grouped by concern as new UI work lands.
- Avoid reintroducing a new browser-side monolith.

## Not planned in this pass

- Full TypeScript migration
- Framework rewrite of admin web or player portal
- Database-per-tenant isolation beyond the current PostgreSQL RLS foundation
- Replacing Prisma
- Live agent-mode proof, real watcher log proof, and broader native delivery proof coverage beyond the current workstation

## Acceptance bar for the next refactor pass

- Entry files should mostly parse env, create runtime container, and mount services.
- Runtime-specific env requirements should come from one config boundary.
- Admin route permissions should be testable without loading the whole HTTP server file.
- Tests should continue to pass under the PostgreSQL runtime profile used on this machine.
- Tenant-scoped platform paths should keep working under `TENANT_DB_ISOLATION_MODE=postgres-rls-strict`.
