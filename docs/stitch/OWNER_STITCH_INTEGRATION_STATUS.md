# Owner Stitch Integration Status

## Live route mapping

The Owner surface now serves Stitch-based pages directly on these routes:

| Route | Served page |
| --- | --- |
| `/owner` | `01-owner-platform-overview.html` |
| `/owner/dashboard` | `01-owner-platform-overview.html` |
| `/owner/tenants` | `02-owner-tenant-management.html` |
| `/owner/tenants/new` | `20-owner-create-tenant.html` |
| `/owner/tenants/context` | `21-owner-tenant-dossier.html` |
| `/owner/tenants/:id` | `21-owner-tenant-dossier.html` |
| `/owner/packages` | `03-owner-package-management.html` |
| `/owner/packages/detail` | `04-owner-package-detail.html` |
| `/owner/subscriptions` | `05-owner-billing-and-subscriptions.html` |
| `/owner/subscriptions/detail` | `06-owner-subscriptions-detail.html` |
| `/owner/billing` | `07-owner-billing-overview.html` |
| `/owner/billing/invoice` | `08-owner-invoice-detail.html` |
| `/owner/billing/attempt` | `09-owner-payment-attempt-detail.html` |
| `/owner/runtime` | `10-owner-fleet-overview.html` |
| `/owner/runtime/overview` | `10-owner-fleet-overview.html` |
| `/owner/runtime/fleet-diagnostics` | `11-owner-fleet-runtime-diagnostics.html` |
| `/owner/runtime/agents-bots` | `12-owner-agents-and-bots-detail.html` |
| `/owner/analytics` | `13-owner-observability-and-jobs.html` |
| `/owner/analytics/overview` | `13-owner-observability-and-jobs.html` |
| `/owner/jobs` | `13-owner-observability-and-jobs.html` |
| `/owner/automation` | `26-owner-automation-and-notifications.html` |
| `/owner/incidents` | `14-owner-incidents-and-alerts.html` |
| `/owner/support` | `15-owner-support-and-diagnostics.html` |
| `/owner/support/context` | `22-owner-support-context.html` |
| `/owner/support/:id` | `22-owner-support-context.html` |
| `/owner/recovery` | `16-owner-maintenance-and-recovery.html` |
| `/owner/recovery/overview` | `16-owner-maintenance-and-recovery.html` |
| `/owner/recovery/tenant-backup` | `17-owner-tenant-backup-details.html` |
| `/owner/audit` | `18-owner-audit-and-security.html` |
| `/owner/security` | `18-owner-audit-and-security.html` |
| `/owner/security/overview` | `18-owner-audit-and-security.html` |
| `/owner/access` | `23-owner-access-posture.html` |
| `/owner/settings` | `19-owner-settings-and-environment.html` |
| `/owner/settings/overview` | `19-owner-settings-and-environment.html` |
| `/owner/control` | `25-owner-platform-controls.html` |
| `/owner/diagnostics` | `24-owner-diagnostics-and-evidence.html` |

## Current Owner route structure

The Owner sidebar now treats these surfaces as focused overview routes instead of stacked workspace selectors:

- `/owner` for the platform overview
- `/owner/runtime/overview` for runtime posture
- `/owner/analytics/overview` for analytics summary
- `/owner/security/overview` for security posture
- `/owner/settings/overview` for settings summary
- `/owner/recovery/overview` for recovery summary

The older base paths still resolve, but the sidebar and bridge now point to the explicit overview sub-routes above for consistency.

## No dedicated Stitch export yet

These views do not have a dedicated Owner Stitch file in `C:\new\stitch` right now:

- `/owner/login`
- tenant backup deep drill-down beyond the current recovery detail page

## Current fallback behavior

For the missing dedicated exports above:

- a matching Owner-themed page is created locally when Stitch did not export one
- live actions are delegated into the existing Owner runtime workspace through the Stitch bridge overlay
- backend and API contracts stay unchanged

## Browser QA

- local owner runtime verified on `http://127.0.0.1:3201`
- browser clickthrough now runs through [owner-stitch-clickthrough.js](C:/new/scripts/owner-stitch-clickthrough.js)
- latest report path: `C:\new\output\playwright\owner-stitch-clickthrough-20260410.json`
- the script logs in with the local owner credentials from `.env`, walks every Owner route, checks for unwired controls, and validates a safe set of route and overlay actions

## Controls currently delegated to the live workspace overlay

These controls now route or delegate as follows:

- route buttons go to a real `/owner/*` page
- destructive or state-changing actions open the live Owner workspace overlay
- refresh, locale, logout, and contrast buttons have direct bridge handlers
- unsupported placeholders are kept to overlay delegation instead of dead clicks

## Controls intentionally disabled for now

Only placeholders with no safe route and no safe overlay behavior should remain disabled. The current bridge aims to avoid dead clicks and prefers route or overlay delegation first.
