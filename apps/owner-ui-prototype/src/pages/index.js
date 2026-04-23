/**
 * Page Components Export
 * Each page receives clean props: { data, source, live, recordId, onRun, errors }
 */

import { OverviewPage } from "./OverviewPage";
import { TenantsPage } from "./TenantsPage";
import { TenantDossierPage } from "./TenantDossierPage";
import { PackagesPage } from "./PackagesPage";
import { PackageDetailPage } from "./PackageDetailPage";
import { BillingPage } from "./BillingPage";
import { InvoiceDetailPage } from "./InvoiceDetailPage";
import { PaymentDetailPage } from "./PaymentDetailPage";
import { SubscriptionsPage } from "./SubscriptionsPage";
import { SubscriptionDetailPage } from "./SubscriptionDetailPage";
import { FleetPage } from "./FleetPage";
import { FleetDiagnosticsPage } from "./FleetDiagnosticsPage";
import { ObservabilityPage } from "./ObservabilityPage";
import { DiagnosticsPage } from "./DiagnosticsPage";
import { IncidentsPage } from "./IncidentsPage";
import { SupportPage } from "./SupportPage";
import { SupportContextPage } from "./SupportContextPage";
import { RecoveryPage } from "./RecoveryPage";
import { BackupDetailPage } from "./BackupDetailPage";
import { SecurityPage } from "./SecurityPage";
import { AccessPosturePage } from "./AccessPosturePage";
import { SettingsPage } from "./SettingsPage";
import { PlatformControlsPage } from "./PlatformControlsPage";
import { AutomationPage } from "./AutomationPage";
import { CreateTenantPage } from "./CreateTenantPage";

export {
  OverviewPage, TenantsPage, TenantDossierPage, PackagesPage, PackageDetailPage,
  BillingPage, InvoiceDetailPage, PaymentDetailPage, SubscriptionsPage, SubscriptionDetailPage,
  FleetPage, FleetDiagnosticsPage, ObservabilityPage, DiagnosticsPage, IncidentsPage,
  SupportPage, SupportContextPage, RecoveryPage, BackupDetailPage, SecurityPage,
  AccessPosturePage, SettingsPage, PlatformControlsPage, AutomationPage, CreateTenantPage,
};

const PAGE_COMPONENTS = {
  overview: OverviewPage,
  tenants: TenantsPage,
  "tenant-dossier": TenantDossierPage,
  packages: PackagesPage,
  "package-detail": PackageDetailPage,
  billing: BillingPage,
  "invoice-detail": InvoiceDetailPage,
  "payment-attempt-detail": PaymentDetailPage,
  subscriptions: SubscriptionsPage,
  "subscription-detail": SubscriptionDetailPage,
  fleet: FleetPage,
  "fleet-diagnostics": FleetDiagnosticsPage,
  observability: ObservabilityPage,
  "diagnostics-evidence": DiagnosticsPage,
  incidents: IncidentsPage,
  support: SupportPage,
  "support-context": SupportContextPage,
  recovery: RecoveryPage,
  "backup-detail": BackupDetailPage,
  security: SecurityPage,
  "access-posture": AccessPosturePage,
  settings: SettingsPage,
  "platform-controls": PlatformControlsPage,
  automation: AutomationPage,
  "create-tenant": CreateTenantPage,
};

export function getPageComponent(pageKey) {
  return PAGE_COMPONENTS[pageKey] || null;
}
