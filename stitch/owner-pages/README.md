# Owner Stitch Page Map

This folder consolidates the current Owner-focused Stitch exports into one place with descriptive file names.

## Included

| New file prefix | Page name | Source folder |
| --- | --- | --- |
| `00-owner-shared-theme.*` | Shared theme / common owner visual system | `owner_v2_shared.css` |
| `01-owner-platform-overview.*` | Platform Overview | `production_ready_v2_1` |
| `02-owner-tenant-management.*` | Tenant Management | `production_ready_v2_2` |
| `03-owner-package-management.*` | Package Management | `production_ready_2` |
| `04-owner-package-detail.*` | Package Detail | `aegis_command_v2` |
| `05-owner-billing-and-subscriptions.*` | Billing and Subscriptions | `production_ready_v2_3` |
| `06-owner-subscriptions-detail.*` | Subscription Detail | `subscriptions_detail` |
| `07-owner-billing-overview.*` | Billing Overview | `production_ready_1` |
| `08-owner-invoice-detail.*` | Invoice Detail | `production_ready_10` |
| `09-owner-payment-attempt-detail.*` | Payment Attempt Detail | `production_ready_9` |
| `10-owner-fleet-overview.*` | Fleet Overview | `fleet_overview` |
| `11-owner-fleet-runtime-diagnostics.*` | Fleet Runtime Diagnostics | `production_ready_4` |
| `12-owner-agents-and-bots-detail.*` | Agents and Bots Detail | `agents_bots_detail` |
| `13-owner-observability-and-jobs.*` | Observability and Jobs | `observability_jobs` |
| `14-owner-incidents-and-alerts.*` | Incidents and Alerts | `production_ready_5` |
| `15-owner-support-and-diagnostics.*` | Support and Diagnostics | `production_ready_3` |
| `16-owner-maintenance-and-recovery.*` | Maintenance and Recovery | `production_ready_6` |
| `17-owner-tenant-backup-details.*` | Tenant Backup Details | `tenant_backup_details` |
| `18-owner-audit-and-security.*` | Audit and Security | `production_ready_7` |
| `19-owner-settings-and-environment.*` | Settings and Environment | `production_ready_8` |
| `20-owner-create-tenant.*` | Create Tenant | local stitched shell |
| `21-owner-tenant-dossier.*` | Tenant Dossier | local stitched shell |
| `22-owner-support-context.*` | Support Context | local stitched shell |
| `23-owner-access-posture.*` | Access Posture | local stitched shell |
| `24-owner-diagnostics-and-evidence.*` | Diagnostics and Evidence | local stitched shell |
| `25-owner-platform-controls.*` | Platform Controls | local stitched shell |
| `26-owner-automation-and-notifications.*` | Automation and Notifications | local stitched shell |

## Not Present Yet In `C:\new\stitch`

These Owner routes still do not have a dedicated Stitch export in the current folder set:

- Owner login
- deeper restore preview flow beyond the current recovery detail page

## Next Integration Step

Use this folder as the single source for Owner page integration into the project:

1. Map each real Owner route to one file in this folder.
2. Keep the current backend and API contracts unchanged.
3. Patch navigation, buttons, and data loading to call the existing Owner/Admin endpoints.
4. Only pages still missing from this folder should be recreated manually.
