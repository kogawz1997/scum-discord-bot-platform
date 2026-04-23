import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  Moon,
  Globe,
  RefreshCw,
  Settings,
  Shield,
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  Activity,
  AlertTriangle,
  LifeBuoy,
  RotateCcw,
  Server,
  Bot,
  FileText,
  ChevronRight,
  Plus,
  Eye,
  Zap,
  Wallet,
  Boxes,
  HardDrive,
  Cpu,
  Gauge,
  PanelRight,
  Download,
  Terminal,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Database,
  Layers3,
  BarChart3,
  Wrench,
  Key,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { buildApiMap as buildRealApiMap, fetchOwnerPageData } from "./lib/owner-api.js";
import { getPageActions, resolveOwnerAction, runOwnerAction } from "./lib/owner-actions.js";
import {
  buildActionPayload,
  getActionForm,
  getInitialActionValues,
} from "./lib/owner-action-forms.js";
import { extractItems } from "./lib/owner-adapters.js";
import {
  OWNER_LOGIN_PATH,
  buildOwnerPagePath,
  resolveOwnerRouteFromPath,
} from "./lib/owner-routes.js";
import {
  OverviewPage as NewOverviewPage,
  TenantsPage as NewTenantsPage,
  TenantDossierPage as NewTenantDossierPage,
  CreateTenantPage as NewCreateTenantPage,
  PackagesPage as NewPackagesPage,
  BillingPage as NewBillingPage,
  SubscriptionsPage as NewSubscriptionsPage,
  FleetPage as NewFleetPage,
  ObservabilityPage as NewObservabilityPage,
  IncidentsPage as NewIncidentsPage,
  SupportPage as NewSupportPage,
  RecoveryPage as NewRecoveryPage,
  SecurityPage as NewSecurityPage,
  SettingsPage as NewSettingsPage,
} from "./pages/index.js";

// Pages that have new implementations and should bypass OwnerSubPage
const NEW_PAGE_OVERRIDES = new Set(["tenant-dossier", "create-tenant"]);

/**
 * SCUM Unified Owner Control Plane
 *
 * เป้าหมายของเวอร์ชันนี้:
 * 1) แก้คอนทราสต์สี โดยเฉพาะ cyan/blue ที่กลืนกับพื้นหลัง
 * 2) จัด spacing / card density / section balance ใหม่ให้ดูมืออาชีพขึ้น
 * 3) รองรับ backend จริงด้วย data adapter layer และ page schema ที่ชัดเจน
 * 4) ทำ pattern ให้พร้อมต่อยอดกับ API ที่มีอยู่จริงในโปรเจค
 */

const THEME = {
  bg: "#070A10",
  bgElevated: "#0B1018",
  panel: "#111826",
  panelSoft: "#151D2C",
  panelStrong: "#1A2434",
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(148, 163, 184, 0.22)",
  line: "rgba(255,255,255,0.06)",
  text: "#F7FAFC",
  textStrong: "#FFFFFF",
  textMuted: "#A7B2C2",
  textDim: "#718096",
  cyan: "#35D8FF",
  cyanText: "#8BE9FF",
  cyanBg: "rgba(53, 216, 255, 0.12)",
  cyanBorder: "rgba(53, 216, 255, 0.28)",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  rose: "#F87171",
};

const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, group: "core" },
  { key: "tenants", label: "Tenants", icon: Users, group: "core" },
  { key: "create-tenant", label: "Create Tenant", icon: Plus, group: "core", parent: "tenants" },
  { key: "tenant-dossier", label: "Tenant Dossier", icon: FileText, group: "core", parent: "tenants" },
  { key: "packages", label: "Packages", icon: Package, group: "commercial" },
  { key: "package-detail", label: "Package Detail", icon: Layers3, group: "commercial", parent: "packages" },
  { key: "billing", label: "Billing", icon: CreditCard, group: "commercial" },
  { key: "invoice-detail", label: "Invoice Detail", icon: FileText, group: "commercial", parent: "billing" },
  { key: "payment-attempt-detail", label: "Payment Attempt", icon: CreditCard, group: "commercial", parent: "billing" },
  { key: "subscriptions", label: "Subscriptions", icon: Wallet, group: "commercial" },
  { key: "subscription-detail", label: "Subscription Detail", icon: Wallet, group: "commercial", parent: "subscriptions" },
  { key: "fleet", label: "Fleet", icon: Boxes, group: "runtime" },
  { key: "fleet-diagnostics", label: "Fleet Diagnostics", icon: Gauge, group: "runtime", parent: "fleet" },
  { key: "runtime-detail", label: "Runtime Detail", icon: Server, group: "runtime", parent: "fleet" },
  { key: "observability", label: "Observability", icon: Activity, group: "runtime" },
  { key: "diagnostics-evidence", label: "Diagnostics Evidence", icon: Database, group: "runtime", parent: "observability" },
  { key: "incidents", label: "Incidents", icon: AlertTriangle, group: "ops" },
  { key: "support", label: "Support", icon: LifeBuoy, group: "ops" },
  { key: "support-context", label: "Support Context", icon: FileText, group: "ops", parent: "support" },
  { key: "recovery", label: "Recovery", icon: RotateCcw, group: "ops" },
  { key: "backup-detail", label: "Backup Detail", icon: HardDrive, group: "ops", parent: "recovery" },
  { key: "security", label: "Security", icon: Shield, group: "ops" },
  { key: "access-posture", label: "Access Posture", icon: Shield, group: "ops", parent: "security" },
  { key: "settings", label: "Settings", icon: Settings, group: "system" },
  { key: "platform-controls", label: "Platform Controls", icon: Wrench, group: "system", parent: "settings" },
  { key: "automation", label: "Automation", icon: Zap, group: "system", parent: "settings" },
];

const NAV_GROUPS = [
  { key: "core", label: "Core Management" },
  { key: "commercial", label: "Commercial Plane" },
  { key: "runtime", label: "Fleet & Runtime" },
  { key: "ops", label: "Operations" },
  { key: "system", label: "System" },
];

const navChildren = (parentKey) => NAV.filter((item) => item.parent === parentKey);
const navGroupLabel = (groupKey) => NAV_GROUPS.find((group) => group.key === groupKey)?.label || "Owner";
const menuKeyForPage = (pageKey) => {
  const item = NAV.find((navItem) => navItem.key === pageKey);
  if (item?.parent) return item.parent;
  if (navChildren(pageKey).length) return pageKey;
  return null;
};

const TEXT = {
  en: {
    brandSubtitle: "Platform Owner Control Plane",
    searchPlaceholder: "Search tenants, invoices, runtimes...",
    noSearchResults: "No matching owner records",
    rootAccess: "Root Access",
    ownerAccount: "Owner Admin",
    accountScope: "Global authority",
    localeLabel: "TH",
    themeTitle: "Toggle display density",
    refreshTitle: "Refresh backend data",
    switchLanguageTitle: "Switch language",
    openIncidentsTitle: "Open incidents",
    accountControlsTitle: "Open owner account controls",
    accountControlsMessage: "Owner account controls are connected to the separate login/session surface.",
    expand: "Expand",
    collapse: "Collapse",
    submenu: "submenu",
  },
  th: {
    brandSubtitle: "ศูนย์ควบคุม Owner Platform",
    searchPlaceholder: "ค้นหา tenant, invoice, runtime...",
    noSearchResults: "ไม่พบข้อมูลที่ตรงกัน",
    rootAccess: "สิทธิ์หลัก",
    ownerAccount: "ผู้ดูแล Owner",
    accountScope: "สิทธิ์ส่วนกลาง",
    localeLabel: "EN",
    themeTitle: "ปรับโหมดการแสดงผล",
    refreshTitle: "รีเฟรชข้อมูล backend",
    switchLanguageTitle: "เปลี่ยนภาษา",
    openIncidentsTitle: "เปิดเหตุขัดข้อง",
    accountControlsTitle: "เปิดตัวควบคุมบัญชี Owner",
    accountControlsMessage: "ตัวควบคุมบัญชี Owner เชื่อมกับหน้า login/session ที่แยกออกมา",
    expand: "เปิด",
    collapse: "ปิด",
    submenu: "เมนูย่อย",
  },
};

const t = (locale, key) => TEXT[locale]?.[key] || TEXT.en[key] || key;

const NAV_LABELS = {
  th: {
    overview: "ภาพรวม",
    tenants: "Tenants",
    "create-tenant": "สร้าง Tenant",
    "tenant-dossier": "แฟ้ม Tenant",
    packages: "Packages",
    "package-detail": "รายละเอียด Package",
    billing: "Billing",
    "invoice-detail": "รายละเอียด Invoice",
    "payment-attempt-detail": "Payment Attempt",
    subscriptions: "Subscriptions",
    "subscription-detail": "รายละเอียด Subscription",
    fleet: "Fleet",
    "fleet-diagnostics": "ตรวจ Fleet",
    "runtime-detail": "รายละเอียด Runtime",
    observability: "Observability",
    "diagnostics-evidence": "หลักฐาน Diagnostics",
    incidents: "Incidents",
    support: "Support",
    "support-context": "บริบท Support",
    recovery: "Recovery",
    "backup-detail": "รายละเอียด Backup",
    security: "Security",
    "access-posture": "สถานะสิทธิ์",
    settings: "Settings",
    "platform-controls": "Platform Controls",
    automation: "Automation",
  },
};

const NAV_GROUP_LABELS = {
  th: {
    core: "จัดการหลัก",
    commercial: "การค้าและแพ็กเกจ",
    runtime: "Fleet และ Runtime",
    ops: "ปฏิบัติการ",
    system: "ระบบ",
  },
};

const navItemLabel = (locale, item) => NAV_LABELS[locale]?.[item.key] || item.label;
const navGroupText = (locale, group) => NAV_GROUP_LABELS[locale]?.[group.key] || group.label;

const SEARCH_TARGETS = {
  tenants: { page: "tenant-dossier", type: "Tenant" },
  tenantConfigs: { page: "tenant-dossier", type: "Tenant Config" },
  licenses: { page: "package-detail", type: "Package" },
  invoices: { page: "invoice-detail", type: "Invoice" },
  paymentAttempts: { page: "payment-attempt-detail", type: "Payment" },
  subscriptions: { page: "subscription-detail", type: "Subscription" },
  agents: { page: "runtime-detail", type: "Runtime" },
  registry: { page: "runtime-detail", type: "Runtime" },
  provisioning: { page: "runtime-detail", type: "Provisioning" },
  devices: { page: "runtime-detail", type: "Device" },
  credentials: { page: "runtime-detail", type: "Credential" },
  observabilityErrors: { page: "diagnostics-evidence", type: "Diagnostic" },
  deliveryLifecycle: { page: "support-context", type: "Delivery" },
  backupList: { page: "backup-detail", type: "Backup" },
  securityEvents: { page: "access-posture", type: "Security" },
  sessions: { page: "access-posture", type: "Session" },
  users: { page: "access-posture", type: "User" },
};

function recordIdOf(record = {}) {
  return String(
    record.id ||
    record._id ||
    record.tenantId ||
    record.tenant_id ||
    record.slug ||
    record.invoice ||
    record.invoiceId ||
    record.paymentAttemptId ||
    record.subscriptionId ||
    record.runtimeId ||
    record.serverId ||
    record.name ||
    "",
  );
}

function recordTitleOf(record = {}, fallback = "Record") {
  return String(
    record.name ||
    record.displayName ||
    record.title ||
    record.tenantName ||
    record.tenant ||
    record.slug ||
    record.invoice ||
    record.id ||
    fallback,
  );
}

function recordSummaryOf(record = {}) {
  return Object.entries(record || {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ");
}

function buildOwnerSearchResults(data = {}, query = "") {
  const needle = String(query || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const raw = data.raw || {};
  const results = [];
  const seen = new Set();

  for (const [sliceKey, target] of Object.entries(SEARCH_TARGETS)) {
    for (const record of extractItems(raw[sliceKey])) {
      const id = recordIdOf(record);
      const title = recordTitleOf(record, target.type);
      const summary = recordSummaryOf(record);
      const haystack = `${id} ${title} ${summary}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
      const dedupe = `${target.page}:${id || title}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      results.push({
        id,
        page: target.page,
        type: target.type,
        title,
        summary,
      });
    }
  }

  return results.slice(0, 8);
}

const ACTION_ICONS = {
  refresh: RefreshCw,
  gotoTenants: Users,
  gotoFleet: Server,
  gotoIncidents: AlertTriangle,
  runMonitoring: Gauge,
  createTenant: Plus,
  updateTenant: Users,
  setTenantStatus: Shield,
  createPackage: Plus,
  updatePackage: Package,
  deletePackage: XCircle,
  issueLicense: FileText,
  exportBillingLedger: Download,
  createCheckoutSession: Plus,
  createSubscription: Plus,
  updateSubscription: CreditCard,
  cancelSubscription: XCircle,
  reactivateSubscription: CheckCircle2,
  updateInvoiceStatus: FileText,
  updatePaymentAttemptStatus: CreditCard,
  createPlatformServer: Server,
  provisionDeliveryAgent: Plus,
  provisionServerBot: Plus,
  reissueRuntimeToken: RefreshCw,
  resetRuntimeBinding: RotateCcw,
  revokeRuntime: XCircle,
  revokeRuntimeToken: XCircle,
  exportObservability: Download,
  acknowledgeNotifications: CheckCircle2,
  clearAcknowledgedNotifications: XCircle,
  exportSecurityEvents: Download,
  revokeAdminSession: XCircle,
  openSupportCase: Plus,
  exportSupport: Download,
  exportTenantDiagnostics: Download,
  retryDeadLetter: RefreshCw,
  clearDeadLetter: XCircle,
  openDeadLetter: AlertTriangle,
  createRestorePoint: Plus,
  previewRestore: Eye,
  confirmRestore: RotateCcw,
  exportAudit: Download,
  updateControlPanelEnv: Settings,
  upsertAdminUser: Users,
  createApiKey: Key,
  createWebhook: Globe,
  testWebhook: Zap,
  createMarketplaceOffer: Boxes,
  previewPlatformAutomation: Eye,
  runPlatformAutomation: Gauge,
  restartOwnerRuntime: RotateCcw,
};

const OWNER_SUBPAGE_DETAILS = {
  "create-tenant": {
    title: "Create Tenant",
    parent: "tenants",
    category: "Core Management",
    description: "Self-service tenant onboarding path for creating the workspace, selecting a package, and preparing runtime provisioning.",
    focus: ["Tenant identity", "Package assignment", "Provisioning readiness", "Audit trail"],
    actions: ["createTenant"],
    evidence: ["tenants", "tenantConfigs", "subscriptions", "servers"],
    contract: ["Validate slug and display name before mutation.", "Bind package and server choices before activating runtime.", "Show backend response and audit evidence after submit."],
  },
  "tenant-dossier": {
    title: "Tenant Dossier",
    parent: "tenants",
    category: "Core Management",
    description: "Single-tenant command view that consolidates package status, runtime footprint, config state, and support posture.",
    focus: ["Tenant profile", "Runtime units", "Commercial state", "Config coverage"],
    actions: ["gotoTenants"],
    evidence: ["tenants", "subscriptions", "invoices", "agents", "registry"],
    contract: ["Resolve one selected tenant before showing destructive controls.", "Keep delivery-agent and server-bot status separated.", "Surface package gates and support flags in one page."],
  },
  "package-detail": {
    title: "Package Detail",
    parent: "packages",
    category: "Commercial Plane",
    description: "Feature/package detail surface for entitlements, locked states, tenant adoption, and upgrade readiness.",
    focus: ["Entitlements", "Feature gates", "Tenant adoption", "Upgrade paths"],
    actions: ["createPackage"],
    evidence: ["licenses", "subscriptions", "tenants"],
    contract: ["Show exactly which backend feature flags a package unlocks.", "Preview locked modules without enabling backend access.", "Require migration notes before package edits."],
  },
  "invoice-detail": {
    title: "Invoice Detail",
    parent: "billing",
    category: "Commercial Plane",
    description: "Invoice investigation view for amount, tenant, status, payment attempts, and export-ready ledger evidence.",
    focus: ["Invoice status", "Tenant billing owner", "Payment trail", "Ledger export"],
    actions: ["exportBillingLedger"],
    evidence: ["billingOverview", "invoices", "paymentAttempts", "subscriptions"],
    contract: ["Never infer paid status without backend invoice data.", "Display linked payment attempts beside the invoice.", "Keep exports tied to the current billing filter."],
  },
  "payment-attempt-detail": {
    title: "Payment Attempt Detail",
    parent: "billing",
    category: "Commercial Plane",
    description: "Payment attempt drilldown for checkout retries, failure reason, tenant recovery, and subscription impact.",
    focus: ["Checkout session", "Failure reason", "Retry path", "Subscription impact"],
    actions: ["createCheckoutSession", "exportBillingLedger"],
    evidence: ["paymentAttempts", "invoices", "billingOverview", "tenants"],
    contract: ["Require tenant and package IDs for creating checkout sessions.", "Show failed attempts without creating duplicate charges.", "Keep retry controls disabled until backend payload is complete."],
  },
  "subscription-detail": {
    title: "Subscription Detail",
    parent: "subscriptions",
    category: "Commercial Plane",
    description: "Subscription lifecycle page for active package, renewal state, invoice history, and manual override workflow.",
    focus: ["Lifecycle state", "Package lock", "Renewal risk", "Manual override"],
    actions: ["createSubscription", "exportBillingLedger"],
    evidence: ["subscriptions", "licenses", "invoices", "paymentAttempts"],
    contract: ["Show package gates derived from backend subscription state.", "Block manual renewal without tenant and package payload.", "Record owner overrides through the billing action path."],
  },
  "fleet-diagnostics": {
    title: "Fleet Diagnostics",
    parent: "fleet",
    category: "Fleet & Runtime",
    description: "Diagnostics page for runtime health, reconnect status, provisioning queue, device bindings, and sync runs.",
    focus: ["Delivery Agent status", "Server Bot status", "Device binding", "Sync freshness"],
    actions: ["refresh", "provisionDeliveryAgent", "provisionServerBot"],
    evidence: ["agents", "registry", "devices", "agentSessions", "syncRuns"],
    contract: ["Keep Delivery Agent and Server Bot evidence in separate sections.", "Use live registry/device records for status.", "Block scanning controls until a runtime target is selected."],
  },
  "runtime-detail": {
    title: "Runtime Detail",
    parent: "fleet",
    category: "Fleet & Runtime",
    description: "Single runtime drilldown for activation token, machine binding, role separation, version, and reconnect evidence.",
    focus: ["Activation", "Binding", "Role separation", "Reconnect evidence"],
    actions: ["refresh"],
    evidence: ["registry", "provisioning", "credentials", "devices", "agentSessions"],
    contract: ["Never mix delivery jobs with server-management operations.", "Show token status without exposing secret values.", "Require explicit role before runtime mutation."],
  },
  "diagnostics-evidence": {
    title: "Diagnostics Evidence",
    parent: "observability",
    category: "Fleet & Runtime",
    description: "Evidence board for telemetry, reconcile output, queue failures, runtime supervisor state, and export diagnostics.",
    focus: ["Telemetry", "Queue failures", "Reconcile output", "Runtime supervisor"],
    actions: ["exportObservability"],
    evidence: ["observability", "observabilityErrors", "deliveryLifecycle", "reconcile", "runtimeSupervisor"],
    contract: ["Keep raw diagnostics attached to backend endpoint status.", "Separate alerts from support notes.", "Export only from mapped observability endpoints."],
  },
  "support-context": {
    title: "Support Context",
    parent: "support",
    category: "Operations",
    description: "Support workspace that ties tenant symptoms to delivery lifecycle, queue evidence, notifications, and sync runs.",
    focus: ["Case context", "Runtime symptoms", "Queue evidence", "Operator handoff"],
    actions: ["openSupportCase", "runMonitoring", "openDeadLetter"],
    evidence: ["deliveryLifecycle", "observabilityErrors", "notifications", "syncRuns"],
    contract: ["Do not create a fake support case without a mapped endpoint.", "Keep support context read-only until a case exists.", "Link evidence to tenant and runtime IDs."],
  },
  "backup-detail": {
    title: "Backup Detail",
    parent: "recovery",
    category: "Operations",
    description: "Backup and restore detail page for restore readiness, preview token, snapshot list, and recovery history.",
    focus: ["Backup inventory", "Restore preview", "Rollback evidence", "Recovery history"],
    actions: ["createRestorePoint"],
    evidence: ["backupStatus", "backupHistory", "backupList"],
    contract: ["Create restore points through the mapped backup endpoint.", "Require preview token and typed confirmation before restore.", "Display latest restore history before any dangerous action."],
  },
  "access-posture": {
    title: "Access Posture",
    parent: "security",
    category: "Operations",
    description: "Security posture page for sessions, users, role matrix, security events, and audit export evidence.",
    focus: ["Role enforcement", "Session review", "Token posture", "Audit export"],
    actions: ["exportAudit"],
    evidence: ["securityEvents", "sessions", "users", "roleMatrix", "rotationReport", "auditQuery"],
    contract: ["Show role and session data from backend only.", "Do not expose raw tokens in the browser.", "Route destructive access changes through explicit audited actions."],
  },
  "platform-controls": {
    title: "Platform Controls",
    parent: "settings",
    category: "System",
    description: "Owner-only control surface for runtime supervisor, restart plans, environment state, marketplace links, and service restart.",
    focus: ["Runtime supervisor", "Restart plan", "Environment state", "Service safety"],
    actions: ["restartOwnerRuntime"],
    evidence: ["controlPanelSettings", "runtimeSupervisor", "restartPlans", "restartExecutions"],
    contract: ["Require typed confirmation before platform restart.", "Show current supervisor state before controls.", "Keep config writes behind validated settings forms."],
  },
  automation: {
    title: "Automation",
    parent: "settings",
    category: "System",
    description: "Automation hub for monitoring runs, webhooks, marketplace integrations, scheduled checks, and notification readiness.",
    focus: ["Scheduled checks", "Webhook health", "Marketplace modules", "Notification routes"],
    actions: ["runMonitoring"],
    evidence: ["webhooks", "marketplace", "apiKeys", "opsState", "notifications"],
    contract: ["Show integration readiness before enabling automation.", "Keep webhook secrets masked.", "Run monitoring through the mapped owner endpoint."],
  },
};

const toneClass = {
  healthy: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  active: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  synced: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  stable: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  degraded: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  stale: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  critical: "border-red-500/25 bg-red-500/10 text-red-200",
  failed: "border-red-500/25 bg-red-500/10 text-red-200",
  paid: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  locked: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
  neutral: "border-slate-500/20 bg-slate-500/10 text-slate-200",
};

function useBackendData(page, refreshToken = 0) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [source, setSource] = useState("loading");
  const [live, setLive] = useState(false);
  const [errors, setErrors] = useState([]);
  const [endpointStatus, setEndpointStatus] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setErrors([]);
      setEndpointStatus([]);
      try {
        const result = await fetchOwnerPageData(page);
        if (mounted) {
          setData(result.data || {});
          setSource(result.source || "backend");
          setLive(result.live === true);
          setErrors(result.errors || []);
          setEndpointStatus(result.endpointStatus || []);
        }
      } catch (error) {
        if (mounted) {
          setData({});
          setSource("error");
          setLive(false);
          setErrors([error.message]);
          setEndpointStatus([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [page, refreshToken]);

  return { loading, data, source, live, errors, endpointStatus };
}

function buildApiMap() {
  return buildRealApiMap();
}

function AppShell({
  children,
  page,
  setPage,
  rightRail,
  pageTitle,
  pageKicker,
  actions,
  onRefresh,
  onUtilityAction,
  onUnhandledButton,
  locale,
  theme,
  onToggleLocale,
  onToggleTheme,
  searchQuery,
  onSearchQuery,
  searchResults,
  onSelectSearchResult,
  notificationCount = 0,
}) {
  const [openMenu, setOpenMenu] = useState(() => menuKeyForPage(page));

  useEffect(() => {
    setOpenMenu(menuKeyForPage(page));
  }, [page]);

  function openPage(pageKey) {
    setOpenMenu(menuKeyForPage(pageKey));
    setPage(pageKey);
  }

  function toggleSubmenu(parentKey) {
    setOpenMenu((current) => (current === parentKey ? null : parentKey));
  }

  function handleShellClick(event) {
    const button = event.target.closest?.("button");
    if (!button || !event.currentTarget.contains(button)) return;
    if (button.disabled || button.dataset.ownerManaged === "true") return;
    const label = [
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
    ].find((value) => value && String(value).trim());
    onUnhandledButton?.(String(label || "Unlabelled control").trim());
  }

  return (
    <div
      onClick={handleShellClick}
      className={`owner-shell min-h-screen text-white ${theme === "contrast" ? "owner-theme-contrast" : ""}`}
    >
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[268px_minmax(0,1fr)]">
        <aside className="owner-sidebar border-b border-white/5 backdrop-blur-xl xl:sticky xl:top-0 xl:h-screen xl:border-b-0 xl:border-r">
          <div className="flex h-full flex-col px-3.5 py-3">
            <div className="mb-3 rounded-xl border border-white/8 bg-white/[0.028] p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-black leading-tight text-cyan-200">SCUM COMMAND</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t(locale, "brandSubtitle")}</div>
                </div>
                <div className="rounded-lg border border-cyan-400/[0.16] bg-cyan-400/[0.07] p-2 text-cyan-200">
                  <Shield className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="owner-sidebar-scroll min-h-0 flex-1 overflow-y-auto pr-0">
              <div className="space-y-2 pb-2">
              {NAV_GROUPS.map((group) => {
                const items = NAV.filter((n) => n.group === group.key && !n.parent);
                const groupLabel = navGroupText(locale, group);
                return (
                  <div key={group.key}>
                    <div className="mb-1 px-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">{groupLabel}</div>
                    <nav className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const itemLabel = navItemLabel(locale, item);
                        const children = navChildren(item.key);
                        const active = page === item.key;
                        const childActive = children.some((child) => child.key === page);
                        const submenuOpen = children.length > 0 && openMenu === item.key;
                        return (
                          <div key={item.key} className="space-y-0.5">
                            <div
                              className={`group flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                                active || childActive
                                  ? "border-cyan-400/22 bg-cyan-400/[0.075] text-cyan-50 shadow-[inset_3px_0_0_0_rgba(53,216,255,0.85)]"
                                  : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
                              }`}
                            >
                              <a
                                href={buildOwnerPagePath(item.key)}
                                onClick={(event) => {
                                  event.preventDefault();
                                  openPage(item.key);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2"
                              >
                                <Icon className={`h-4 w-4 ${active || childActive ? "text-cyan-300" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                                <span className="truncate text-[13px] font-medium">{itemLabel}</span>
                              </a>
                              {children.length ? (
                                <button
                                  type="button"
                                  data-owner-managed="true"
                                  aria-expanded={submenuOpen}
                                  aria-label={`${submenuOpen ? t(locale, "collapse") : t(locale, "expand")} ${itemLabel} ${t(locale, "submenu")}`}
                                  title={`${submenuOpen ? t(locale, "collapse") : t(locale, "expand")} ${itemLabel} ${t(locale, "submenu")}`}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    toggleSubmenu(item.key);
                                  }}
                                  className="ml-auto grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-black/20 text-zinc-500 transition hover:border-cyan-400/25 hover:text-cyan-200"
                                >
                                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${submenuOpen ? "rotate-90" : ""}`} />
                                </button>
                              ) : null}
                            </div>
                            {submenuOpen ? (
                              <div className="ml-4 space-y-0.5 border-l border-white/[0.08] pl-2.5">
                                {children.map((child) => {
                                  const ChildIcon = child.icon;
                                  const childLabel = navItemLabel(locale, child);
                                  const childSelected = page === child.key;
                                  return (
                                    <a
                                      key={child.key}
                                      href={buildOwnerPagePath(child.key)}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        openPage(child.key);
                                      }}
                                      className={`group flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all ${
                                        childSelected
                                          ? "border-cyan-400/20 bg-cyan-400/[0.085] text-cyan-100"
                                          : "border-transparent text-zinc-500 hover:border-white/10 hover:bg-white/[0.035] hover:text-zinc-200"
                                      }`}
                                    >
                                      <ChildIcon className={`h-3.5 w-3.5 ${childSelected ? "text-cyan-300" : "text-zinc-600 group-hover:text-zinc-400"}`} />
                                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{childLabel}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </nav>
                  </div>
                );
              })}
              </div>
            </div>

            <div className="shrink-0 border-t border-white/5 pt-2.5">
              <div className="rounded-lg border border-white/5 bg-white/[0.025] p-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-[11px] font-bold text-cyan-200">OA</div>
                  <div>
                    <div className="text-[13px] font-semibold">{t(locale, "ownerAccount")}</div>
                    <div className="text-[11px] text-zinc-500">{t(locale, "accountScope")}</div>
                  </div>
                  <Button
                    data-owner-managed="true"
                    variant="ghost"
                    size="icon"
                    title={t(locale, "accountControlsTitle")}
                    onClick={() => onUtilityAction?.(t(locale, "accountControlsMessage"))}
                    className="ml-auto h-8 w-8 text-zinc-500 hover:text-white"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="owner-topbar sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 md:px-5">
              <div className="relative ml-auto w-full min-w-[240px] max-w-[560px] flex-none md:w-[48vw]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(event) => onSearchQuery?.(event.target.value)}
                  placeholder={t(locale, "searchPlaceholder")}
                  className="h-11 rounded-lg border-white/10 bg-white/[0.035] pl-10 text-[13px] text-white placeholder:text-zinc-500 focus-visible:ring-cyan-400/35"
                />
                {searchQuery ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-white/10 bg-[#0b1018]/98 shadow-2xl backdrop-blur-xl">
                    {searchResults.length ? searchResults.map((result) => (
                      <button
                        key={`${result.page}-${result.id}-${result.title}`}
                        type="button"
                        data-owner-managed="true"
                        onClick={() => onSelectSearchResult?.(result)}
                        className="flex w-full items-start gap-3 border-b border-white/5 px-3.5 py-3 text-left last:border-b-0 hover:bg-cyan-400/[0.06]"
                      >
                        <div className="mt-0.5 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">{result.type}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{result.title}</div>
                          <div className="mt-1 truncate text-xs text-zinc-500">{result.summary || result.id || buildOwnerPagePath(result.page)}</div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 text-zinc-600" />
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-sm text-zinc-500">{t(locale, "noSearchResults")}</div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <IconButton icon={RefreshCw} onClick={onRefresh} title={t(locale, "refreshTitle")} />
                <IconButton icon={Globe} label={t(locale, "localeLabel")} onClick={onToggleLocale} title={t(locale, "switchLanguageTitle")} />
                <IconButton icon={Moon} onClick={onToggleTheme} title={t(locale, "themeTitle")} />
                <IconButton icon={Bell} badge={notificationCount > 0 ? String(notificationCount) : undefined} onClick={() => setPage("incidents")} title={t(locale, "openIncidentsTitle")} />
                <div className="h-9 w-px bg-white/10" />
                <div className="hidden items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 md:flex">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">{t(locale, "rootAccess")}</div>
                    <div className="text-[13px] font-semibold">Operator #042</div>
                  </div>
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-xs font-bold text-cyan-200">
                    OP
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-5 md:px-5 md:py-5">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/5 pb-5">
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-cyan-300">{pageKicker}</div>
                <h1 className="text-[26px] font-black leading-tight text-white md:text-[30px]">{pageTitle}</h1>
              </div>
              <div className="flex flex-wrap gap-2">{actions}</div>
            </div>

            <div className={`grid gap-5 ${rightRail ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
              <div className="min-w-0">{children}</div>
              {rightRail ? <div className="min-w-0">{rightRail}</div> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function IconButton({ icon: Icon, label, badge, disabled = false, onClick, title }) {
  return (
    <Button
      data-owner-managed="true"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={title || label || "Owner icon control"}
      className="relative h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-zinc-200 hover:bg-white/[0.06] hover:text-white"
    >
      <Icon className={`${label ? "mr-1.5" : ""} h-4 w-4`} />
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      {badge ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badge}</span> : null}
    </Button>
  );
}

function GlassCard({ title, description, right, children, className = "" }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      {(title || right || description) && (
        <CardHeader className="owner-card-header flex flex-row items-start justify-between gap-3 border-b border-white/5 p-4">
          <div>
            {title ? <CardTitle className="text-[15px] font-bold leading-tight text-white">{title}</CardTitle> : null}
            {description ? <CardDescription className="mt-1 text-[13px] leading-5 text-zinc-400">{description}</CardDescription> : null}
          </div>
          {right}
        </CardHeader>
      )}
      <CardContent className="overflow-x-auto p-4">{children}</CardContent>
    </Card>
  );
}

function ToneBadge({ tone, children }) {
  const cls = toneClass[tone] || toneClass.neutral;
  return <Badge className={`border ${cls} rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]`}>{children}</Badge>;
}

function hasPayloadValues(payload = {}) {
  return Object.values(payload || {}).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function OwnerActionButton({ actionKey, source, live, payload, onRun, onOpen, icon: Icon, children, className = "" }) {
  const actionState = resolveOwnerAction(actionKey, { source, live, payload });
  const form = getActionForm(actionKey);
  const disabled = !actionState.action;
  const openForm = Boolean(form) && (
    (!actionState.enabled && (
      !hasPayloadValues(payload) ||
      /missing required payload|requires confirmation/i.test(actionState.reason || "")
    )) ||
    (actionState.enabled && actionState.action?.kind === "mutation" && !hasPayloadValues(payload))
  );
  const label = children || actionState.action?.label || actionKey;
  const visualClass = !actionState.enabled
    ? "border border-zinc-700 bg-zinc-900/70 text-zinc-500"
    : className || "border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]";
  return (
    <Button
      data-owner-managed="true"
      disabled={disabled}
      onClick={() => {
        if (openForm) {
          onOpen?.(actionKey, payload);
          return;
        }
        onRun(actionKey, payload);
      }}
      title={openForm ? `${form.title}: ${actionState.reason}` : actionState.reason || actionState.action?.endpoint || ""}
      className={`${visualClass} rounded-xl`}
    >
      {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
      {label}
    </Button>
  );
}

function ActionResultBanner({ result }) {
  if (!result) return null;
  const ok = result.ok === true;
  const detail = result.error
    || result.data?.message
    || result.data?.url
    || result.data?.targetPage
    || result.data?.refreshed
    || "Action returned a backend response.";
  return (
    <div className={`owner-status-panel mb-5 rounded-xl border px-4 py-3 text-sm ${ok ? "border-emerald-500/20 text-emerald-200" : "border-red-500/20 text-red-200"}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
        {ok ? "Action completed" : "Action blocked or failed"}
      </div>
      <div className="mt-1 text-xs opacity-80">
        {result.action?.label || "Owner action"}: {String(detail)}
      </div>
    </div>
  );
}

function OwnerActionPanel({ draft, source, live, onClose, onSubmit }) {
  const form = getActionForm(draft?.actionKey);
  const [values, setValues] = useState(() => getInitialActionValues(draft?.actionKey, draft?.preset));
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (draft?.actionKey) {
      setValues(getInitialActionValues(draft.actionKey, draft.preset));
      setFormError("");
    }
  }, [draft?.actionKey, draft?.preset]);

  if (!draft || !form) return null;

  const missingRequired = form.fields
    .filter((field) => field.required)
    .some((field) => !String(values[field.name] || "").trim());

  function updateField(name, value) {
    setFormError("");
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (missingRequired) {
      setFormError("Fill every required field before this owner action can run.");
      return;
    }
    onSubmit(buildActionPayload(draft.actionKey, values));
  }

  return (
    <form onSubmit={handleSubmit} className={`owner-status-panel mb-5 rounded-xl border p-4 ${form.danger ? "border-red-500/25" : "border-cyan-400/20"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-white">{form.title}</div>
          <div className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">{form.description}</div>
        </div>
        <ToneBadge tone={live ? "healthy" : source === "auth-required" ? "warning" : "locked"}>
          {live ? "backend live" : source === "auth-required" ? "login required" : source}
        </ToneBadge>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {form.fields.map((field) => (
          <label key={field.name} className="block">
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              {field.label}{field.required ? <span className="text-red-300"> *</span> : null}
            </div>
            <Input
              value={values[field.name] || ""}
              onChange={(event) => updateField(field.name, event.target.value)}
              placeholder={field.placeholder}
              className="h-11 rounded-xl border-white/10 bg-black/30 text-white placeholder:text-zinc-600 focus-visible:ring-cyan-400/35"
            />
          </label>
        ))}
      </div>
      {formError ? <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-200">{formError}</div> : null}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <Button
          data-owner-managed="true"
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        >
          Cancel
        </Button>
        <Button
          data-owner-managed="true"
          type="submit"
          title={missingRequired ? "Required fields are missing" : form.submitLabel}
          className={`${form.danger ? "bg-red-600 hover:bg-red-500" : "bg-cyan-400 text-black hover:bg-cyan-300"} rounded-xl`}
        >
          {form.submitLabel}
        </Button>
      </div>
    </form>
  );
}

function BackendUnavailableState({ source, errors = [] }) {
  const isAuth = source === "auth-required";
  return (
    <GlassCard title={isAuth ? "Owner login required" : "Backend unavailable"} description="This prototype no longer replaces unavailable backend data with mock records by default.">
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm leading-6 text-amber-100/90">
          {isAuth
            ? "The Owner backend is reachable, but the current browser session is not authenticated. Open the separate login surface, sign in, then return to this dashboard."
            : "The Owner backend did not return any usable API slice. Check that owner-web/admin-web are running, then refresh."}
        </div>
        <div className="space-y-3">
          {isAuth ? (
            <a
              className="flex h-11 items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-black hover:bg-cyan-300"
              href={OWNER_LOGIN_PATH}
            >
              Open Separate Login
            </a>
          ) : null}
          <a
            className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 hover:bg-white/[0.06]"
            href="/owner"
          >
            Open Owner Surface
          </a>
        </div>
      </div>
      {errors.length ? (
        <div className="mt-5 rounded-lg border border-white/5 bg-black/30 p-4 font-mono text-xs leading-6 text-zinc-400">
          {errors.slice(0, 8).map((error) => <div key={error}>{error}</div>)}
        </div>
      ) : null}
    </GlassCard>
  );
}

function DataEmptyState({ title = "No backend records", body = "The endpoint is live, but it returned no rows for this section." }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-1">{body}</div>
    </div>
  );
}

function rawRecordCount(value) {
  const rows = extractItems(value);
  if (rows.length) return rows.length;
  if (value && typeof value === "object") return Object.keys(value).length ? 1 : 0;
  return value ? 1 : 0;
}

function endpointForKey(endpointStatus = [], key) {
  return endpointStatus.find((endpoint) => endpoint.key === key);
}

function previewRecord(record = {}) {
  return Object.entries(record || {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ");
}

function recordsForMeta(meta, data = {}) {
  const raw = data.raw || {};
  return meta.evidence.flatMap((key) => extractItems(raw[key]));
}

function selectedRecordForMeta(meta, data = {}, selectedRecordId = "") {
  const records = recordsForMeta(meta, data);
  if (!selectedRecordId) return records[0] || null;
  const normalizedId = String(selectedRecordId);
  return records.find((record) => recordIdOf(record) === normalizedId) || records[0] || null;
}

function recordDetailPairs(record = {}) {
  return Object.entries(record || {})
    .filter(([, value]) => value !== null && value !== undefined && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 12);
}

function getSubPageNavMeta(meta) {
  const current = NAV.find((item) => item.key === meta.parent) || {};
  const children = navChildren(meta.parent);
  return {
    parentLabel: current.label || meta.parent,
    groupLabel: navGroupLabel(current.group),
    children,
  };
}

function OwnerSubPage({ meta, data = {}, endpointStatus = [], selectedRecordId = "", onNavigate }) {
  const raw = data.raw || {};
  const navMeta = getSubPageNavMeta(meta);
  const selectedRecord = selectedRecordForMeta(meta, data, selectedRecordId);
  const evidenceRows = meta.evidence.map((key) => {
    const endpoint = endpointForKey(endpointStatus, key);
    return {
      key,
      count: rawRecordCount(raw[key]),
      ok: endpoint?.ok === true,
      path: endpoint?.path || "not requested",
      status: endpoint?.ok ? "Live" : endpoint ? `HTTP ${endpoint.status || 0}` : "Mapped",
    };
  });
  const firstEvidence = meta.evidence.map((key) => extractItems(raw[key])).find((rows) => rows.length) || [];
  const previewRows = firstEvidence.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <GlassCard
          title={meta.title}
          description={meta.description}
          right={<ToneBadge tone="stable">{meta.category}</ToneBadge>}
        >
          <div className="mb-5 flex flex-wrap gap-2">
            <ToneBadge tone="neutral">Parent: {navMeta.parentLabel}</ToneBadge>
            <ToneBadge tone="locked">Menu: {navMeta.groupLabel}</ToneBadge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {meta.focus.map((item) => (
              <div key={item} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Focus</div>
                <div className="mt-2 min-h-10 text-sm font-semibold leading-5 text-white">{item}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard title="Submenu Placement" description="Where this route sits in the Owner panel.">
          <MetricPair label="Category" value={navMeta.groupLabel} tone="healthy" />
          <MetricPair label="Parent menu" value={navMeta.parentLabel} />
          <MetricPair label="Route" value={buildOwnerPagePath(Object.keys(OWNER_SUBPAGE_DETAILS).find((key) => OWNER_SUBPAGE_DETAILS[key] === meta))} />
          <MetricPair label="Sibling pages" value={navMeta.children.length} tone="stable" />
        </GlassCard>
      </div>

      <GlassCard title="Live Backend Evidence" description="These counts come from the backend slices mapped for this page.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {evidenceRows.map((row) => (
            <div key={row.key} className="rounded-xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm font-semibold text-cyan-100">{row.key}</div>
                <ToneBadge tone={row.ok ? "healthy" : "warning"}>{row.status}</ToneBadge>
              </div>
              <div className="owner-kpi-value mt-3 text-[28px] font-black text-white">{row.count}</div>
              <div className="mt-2 truncate text-xs text-zinc-500" title={row.path}>{row.path}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard
          title={selectedRecord ? recordTitleOf(selectedRecord, meta.title) : "No selected record"}
          description={selectedRecordId ? `Selected ID: ${selectedRecordId}` : "Showing the first live record returned by this page's backend slices."}
          right={<ToneBadge tone={selectedRecord ? "healthy" : "warning"}>{selectedRecord ? "Selected" : "Waiting"}</ToneBadge>}
        >
          {selectedRecord ? (
            <div className="grid gap-3 md:grid-cols-2">
              {recordDetailPairs(selectedRecord).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">{key}</div>
                  <div className="mt-2 break-words text-sm font-semibold leading-6 text-white">{String(value)}</div>
                </div>
              ))}
            </div>
          ) : (
            <DataEmptyState title="No selectable backend record" body="This detail route is ready for record IDs, but the current backend response did not return a matching row." />
          )}
        </GlassCard>

        <GlassCard title="Implementation Contract" description="Rules this page must follow when wired to production flows.">
          <div className="space-y-3">
            {meta.contract.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-xs font-bold text-cyan-200">{index + 1}</div>
                <div className="text-sm leading-6 text-zinc-300">{item}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard title="Record Preview" description="Open any returned row as a real detail URL.">
          {previewRows.length ? (
            <div className="space-y-3">
              {previewRows.map((row, index) => (
                <button
                  key={recordIdOf(row) || row.key || index}
                  type="button"
                  onClick={() => onNavigate?.(Object.keys(OWNER_SUBPAGE_DETAILS).find((key) => OWNER_SUBPAGE_DETAILS[key] === meta), { recordId: recordIdOf(row) })}
                  className="w-full rounded-xl border border-white/5 bg-black/20 p-4 text-left transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.04]"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Record {index + 1}</div>
                  <div className="mt-2 text-sm leading-6 text-zinc-300">{previewRecord(row) || "Backend row has nested data only."}</div>
                </button>
              ))}
            </div>
          ) : (
            <DataEmptyState
              title="No records returned yet"
              body="The route is wired to backend slices, but the current backend response did not include rows for preview."
            />
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function OwnerSubPageRail({ meta }) {
  const navMeta = getSubPageNavMeta(meta);
  return (
    <div className="space-y-5">
      <GlassCard title="Page Group">
        <MetricPair label="Category" value={navMeta.groupLabel} tone="healthy" />
        <MetricPair label="Parent" value={navMeta.parentLabel} />
        <MetricPair label="Current" value={meta.title} tone="stable" />
      </GlassCard>
      <GlassCard title="Sibling Submenu">
        <div className="space-y-2">
          {navMeta.children.map((child) => {
            const active = child.key === Object.keys(OWNER_SUBPAGE_DETAILS).find((key) => OWNER_SUBPAGE_DETAILS[key] === meta);
            return (
              <div key={child.key} className={`rounded-xl border px-3 py-2 text-sm ${active ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" : "border-white/5 bg-white/[0.03] text-zinc-400"}`}>
                {child.label}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, spark, rightMeta, compact = false }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
      <GlassCard className="h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
            <div className={`owner-kpi-value ${compact ? "mt-2 text-[24px]" : "mt-3 text-[30px]"} font-black text-white`}>{value}</div>
            {sub ? <div className="mt-2 text-[13px] leading-5 text-zinc-400">{sub}</div> : null}
          </div>
          {Icon ? (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
        {rightMeta ? <div className="mt-4 text-sm font-medium text-zinc-300">{rightMeta}</div> : null}
        {spark ? <div className="mt-4 h-2 rounded-full bg-white/5"><div className={`h-2 rounded-full ${spark}`} /></div> : null}
      </GlassCard>
    </motion.div>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-lg font-bold leading-tight text-white">{title}</div>
        {subtitle ? <div className="mt-1 text-[13px] text-zinc-500">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

function ProgressLine({ value, tone = "cyan" }) {
  const color = tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-400" : "bg-cyan-400";
  return (
    <div className="h-2 rounded-full bg-white/5">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function FooterMetric({ label, value, tone }) {
  const text = tone === "critical" ? "text-red-300" : tone === "warning" ? "text-amber-300" : tone === "healthy" ? "text-emerald-400" : "text-cyan-300";
  return (
    <div className="owner-card rounded-xl border p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className={`owner-kpi-value mt-2 text-xl font-black ${text}`}>{value}</div>
    </div>
  );
}

function MetricPair({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-b-0">
      <div className="text-[13px] text-zinc-500">{label}</div>
      <div className={tone === "warning" ? "text-[13px] font-semibold text-amber-300" : tone === "critical" ? "text-[13px] font-semibold text-red-300" : tone === "healthy" ? "text-[13px] font-semibold text-emerald-400" : "text-[13px] font-semibold text-white"}>{value}</div>
    </div>
  );
}

function MiniStatus({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="text-[13px] text-zinc-500">{label}</div>
      <div className={`owner-kpi-value mt-2 text-xl font-bold ${tone === "warning" ? "text-amber-300" : tone === "critical" ? "text-red-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function TimelineItem({ title, sub, danger }) {
  return (
    <div className="flex gap-3 border-b border-white/5 py-3 last:border-b-0">
      <div className={`mt-1 h-2.5 w-2.5 rounded-full ${danger ? "bg-red-400" : "bg-cyan-400"}`} />
      <div>
        <div className={`text-sm font-medium ${danger ? "text-red-300" : "text-white"}`}>{title}</div>
        <div className="text-[13px] text-zinc-500">{sub}</div>
      </div>
    </div>
  );
}

function AuditEvent({ dot = "zinc", title, sub, meta, muted }) {
  const dotClass = {
    cyan: "bg-cyan-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
    zinc: "bg-zinc-500",
  }[dot] || "bg-zinc-500";

  return (
    <div className={`flex gap-4 border-t border-white/5 px-2 py-4 first:border-t-0 ${muted ? "opacity-70" : ""}`}>
      <div className={`mt-1 h-3 w-3 rounded-full ${dotClass}`} />
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="mt-1 leading-6 text-zinc-400">{sub}</div>
        {meta ? <div className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-600">{meta}</div> : null}
      </div>
    </div>
  );
}

function QueueCard({ title, task, progress, note, danger, action }) {
  return (
    <div className={`mb-3 rounded-lg border p-3.5 ${danger ? "border-red-500/20 bg-red-500/[0.05]" : "border-white/5 bg-white/[0.03]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{title}</div>
          <div className="text-xs text-zinc-500">TaskID: {task}</div>
        </div>
        {action ? <Button className="h-8 rounded-lg bg-red-500/20 px-3 text-red-300 hover:bg-red-500/30">{action}</Button> : null}
      </div>
      {typeof progress === "number" ? <div className="mt-3"><ProgressLine value={progress} /></div> : null}
      {note ? <div className="mt-3 text-sm text-zinc-400">{note}</div> : null}
    </div>
  );
}

function IncidentRow({ tone, title, body, meta }) {
  const bar = tone === "critical" ? "bg-red-400" : tone === "warning" ? "bg-amber-400" : "bg-zinc-500";
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
      <div className="flex">
        <div className={`w-1.5 ${bar}`} />
        <div className="flex-1 p-5">
          <div className="mb-2 flex items-center gap-3">
            <ToneBadge tone={tone}>{tone}</ToneBadge>
            <div className="text-base font-bold leading-tight text-white">{title}</div>
          </div>
          <div className="text-sm leading-6 text-zinc-300">{body}</div>
          <div className="mt-3 text-[13px] text-zinc-500">{meta}</div>
        </div>
      </div>
    </div>
  );
}

function SupportRow({ caseId, tenant, origin, issue, severity, status }) {
  return (
    <div className="grid grid-cols-[120px_1.2fr_1fr_120px_120px_80px] items-center border-t border-white/5 px-4 py-4">
      <div className="font-semibold text-cyan-200">{caseId}</div>
      <div>
        <div className="font-semibold text-white">{tenant}</div>
        <div className="text-xs text-zinc-500">{origin}</div>
      </div>
      <div className="text-zinc-300">{issue}</div>
      <div><ToneBadge tone={severity}>{severity}</ToneBadge></div>
      <div className="text-zinc-300">{status}</div>
      <div className="flex justify-end"><Button title="Open support case detail" size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"><Eye className="h-4 w-4" /></Button></div>
    </div>
  );
}

function DLQRow({ code, title, target, attempts, warning }) {
  return (
    <div className="grid grid-cols-[1.2fr_140px_160px] items-center border-t border-white/5 px-2 py-4 first:border-t-0">
      <div>
        <div className={`font-mono font-semibold ${warning ? "text-amber-300" : "text-red-300"}`}>{code}: {title}</div>
        <div className="text-sm text-zinc-500">Target: {target}</div>
      </div>
      <div className="text-zinc-400">Attempts: {attempts}</div>
      <div className="justify-self-end"><Button title="Retry needs a selected dead-letter id" className="rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15">Retry Delivery</Button></div>
    </div>
  );
}

function SecurityEvent({ title, body, action1, action2, critical, warning }) {
  return (
    <div className={`mb-4 rounded-xl border p-4 ${critical ? "border-red-500/20 bg-red-500/[0.05]" : warning ? "border-amber-500/20 bg-amber-500/[0.05]" : "border-white/5 bg-white/[0.03]"}`}>
      <div className={`font-semibold ${critical ? "text-red-300" : warning ? "text-amber-300" : "text-cyan-200"}`}>{title}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-300">{body}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {action1 ? <Button title="Review action needs a dedicated route and payload" className="rounded-xl border border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06]">{action1}</Button> : null}
        {action2 ? <Button title="Review action needs a dedicated route and payload" className="rounded-xl border border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06]">{action2}</Button> : null}
      </div>
    </div>
  );
}

function StatMini({ title, value, sub, tone }) {
  return (
    <GlassCard>
      <div className="text-[13px] text-zinc-500">{title}</div>
      <div className="mt-3 text-[26px] font-black leading-tight text-white">{value}</div>
      <div className={`mt-2 text-[13px] ${tone === "warning" ? "text-amber-300" : tone === "stable" ? "text-cyan-200" : "text-zinc-500"}`}>{sub}</div>
    </GlassCard>
  );
}

function Field({ label, value, tall }) {
  return (
    <div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className={`rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] text-zinc-200 ${tall ? "min-h-[140px]" : "min-h-10"}`}>{value}</div>
    </div>
  );
}

function FleetTable({ columns, rows }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5">
      <div className={`grid bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500 ${columns.length === 5 ? "grid-cols-[1.2fr_180px_180px_220px_120px]" : ""}`}>
        {columns.map((c) => <div key={c}>{c}</div>)}
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1.2fr_180px_180px_220px_120px] items-center border-t border-white/5 px-4 py-4">
          {row.map((cell, i) => <div key={i} className={i === 0 ? "whitespace-pre-line font-semibold text-white" : "text-zinc-300"}>{cell}</div>)}
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />)}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
    </div>
  );
}

function OverviewPage({ data }) {
  const stats = data?.stats || {};
  const stream = data?.tacticalStream || [];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <StatCard label="Revenue Velocity" value={stats.revenueVelocity || "$0"} sub="Daily platform subscription turnover • +12.4%" icon={Wallet} spark="w-[76%] bg-amber-400" />
          <GlassCard title="Active Incidents" right={<ToneBadge tone="critical">Live Monitor</ToneBadge>}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="owner-kpi-value text-[34px] font-black text-white">{stats.incidentsNew || 0}</div>
                <div className="mt-1 text-sm text-red-300">NEW</div>
              </div>
              <div>
                <div className="owner-kpi-value text-[34px] font-black text-white">{stats.incidentsAck || 0}</div>
                <div className="mt-1 text-sm text-amber-300">ACK</div>
              </div>
              <div>
                <div className="owner-kpi-value text-[34px] font-black text-white">{stats.incidentsCleared || 0}</div>
                <div className="mt-1 text-sm text-zinc-400">CLEARED</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard title="Security Posture" right={<Shield className="h-5 w-5 text-cyan-300" />}>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-cyan-400/70 bg-cyan-400/10 text-xl font-black text-cyan-200">{stats.securityScore || 0}%</div>
              <div>
                <div className="text-xl font-bold text-white">Hardened</div>
                <div className="text-sm leading-6 text-zinc-400">Zero critical vulnerabilities detected in last 24h scan.</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="text-zinc-500">Auth Integrity</div>
                <div className="mt-1 font-semibold text-white">Excellent</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <div className="text-zinc-500">DDoS Mitigation</div>
                <div className="mt-1 font-semibold text-white">Standby</div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <StatCard
              label="Delivery Agents"
              value={stats.deliveryAgents?.total || 0}
              sub={`${stats.deliveryAgents?.online || 0} Online • ${stats.deliveryAgents?.latent || 0} Latent`}
              icon={Server}
              spark="w-[86%] bg-cyan-400"
            />
            <StatCard
              label="Server Bots"
              value={stats.serverBots?.total || 0}
              sub={`${stats.serverBots?.active || 0} Active • ${stats.serverBots?.stale || 0} Stale`}
              icon={Bot}
              spark="w-[91%] bg-cyan-400"
            />
          </div>
          <GlassCard title="Live Tactical Stream" right={<ToneBadge tone="active">Live</ToneBadge>}>
            <div className="overflow-hidden rounded-xl border border-white/5">
              <div className="grid grid-cols-[140px_160px_minmax(0,1fr)_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <div>Timestamp</div><div>Origin</div><div>Action</div><div>Status</div>
              </div>
              {stream.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[140px_160px_minmax(0,1fr)_120px] items-start border-t border-white/5 px-4 py-3 text-sm">
                  <div className="font-mono text-zinc-500">{row[0]}</div>
                  <div className="font-semibold text-cyan-200">{row[1]}</div>
                  <div className="text-zinc-300">{row[2]}</div>
                  <div className="justify-self-start"><ToneBadge tone={row[3] === "success" || row[3] === "valid" ? "healthy" : row[3] === "degraded" || row[3] === "flagged" ? "critical" : "stable"}>{row[3]}</ToneBadge></div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <FooterMetric label="Tenant Rows" value={stats.incidentsCleared || 0} tone="healthy" />
        <FooterMetric label="Billing Risks" value={stats.incidentsAck || 0} tone={stats.incidentsAck ? "warning" : "healthy"} />
        <FooterMetric label="Delivery Offline" value={stats.deliveryAgents?.latent || 0} tone={stats.deliveryAgents?.latent ? "warning" : "healthy"} />
        <FooterMetric label="Server Bot Stale" value={stats.serverBots?.stale || 0} tone={stats.serverBots?.stale ? "warning" : "healthy"} />
      </div>
    </div>
  );
}

function TenantsPage({ tenants = [], onOpenTenant }) {
  const activeTenants = tenants.filter((tenant) => String(tenant.status || "").includes("active")).length;
  const criticalTenants = tenants.filter((tenant) => ["critical", "degraded", "warning"].includes(String(tenant.health || tenant.status || "").toLowerCase())).length;
  const runtimeTotal = tenants.reduce((sum, tenant) => sum + Number(tenant.agents || 0) + Number(tenant.bots || 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Tenant Rows" value={tenants.length} sub="Rows returned by owner tenant API" icon={Users} spark="w-[72%] bg-cyan-400" compact />
        <StatCard label="Active Tenants" value={activeTenants} sub={`${criticalTenants} tenants need review`} icon={Activity} spark="w-[64%] bg-amber-400" compact />
        <StatCard label="Mapped Runtimes" value={runtimeTotal} sub="Delivery Agents plus Server Bots in tenant rows" icon={Server} spark="w-[58%] bg-cyan-400" compact />
      </div>

      <GlassCard>
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <div className="text-zinc-500">Filter by Tenant ID, Discord ID, or Server IP...</div>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/5">
          <div className="grid grid-cols-[260px_130px_190px_160px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            <div>Tenant Entity</div><div>Status</div><div>Package Tier</div><div>Fleet Health</div>
          </div>
          {!tenants.length ? (
            <div className="border-t border-white/5 p-4">
              <DataEmptyState title="No tenant rows returned" body="The tenants page is wired to the real owner tenant endpoint. Login or check permissions to load protected tenant records." />
            </div>
          ) : tenants.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              onClick={() => onOpenTenant?.(tenant)}
              className={`grid w-full grid-cols-[260px_130px_190px_160px] items-center border-t border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.03] ${tenant.code === "S3" ? "bg-red-500/[0.03]" : ""}`}
            >
              <div className="flex items-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.05] font-bold text-zinc-300">{tenant.code}</div>
                <div>
                  <div className="font-semibold text-white">{tenant.name}</div>
                  <div className="text-xs text-zinc-500">{tenant.id}</div>
                </div>
              </div>
              <div><ToneBadge tone={tenant.status}>{tenant.status}</ToneBadge></div>
              <div className="font-medium text-zinc-300">{tenant.tier}</div>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <span>Agents {tenant.agents}</span>
                <span>Bots {tenant.bots}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <div>Showing {tenants.length ? `1-${tenants.length}` : "0"} of {tenants.length}</div>
          <div>Rows are loaded from backend slices</div>
        </div>
      </GlassCard>
    </div>
  );
}

function TenantDiagnosticsRail({ tenants = [] }) {
  const criticalTenants = tenants.filter((tenant) => ["critical", "degraded", "warning"].includes(String(tenant.health || tenant.status || "").toLowerCase()));
  const runtimeTotal = tenants.reduce((sum, tenant) => sum + Number(tenant.agents || 0) + Number(tenant.bots || 0), 0);
  const firstTenant = criticalTenants[0] || tenants[0];
  return (
    <div className="space-y-6">
      <GlassCard title="Diagnostic View" description={firstTenant?.name || "No tenant selected"}>
        <div className={`rounded-xl border p-4 ${criticalTenants.length ? "border-amber-500/20 bg-amber-500/10 text-amber-100" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"}`}>
          <div className="font-semibold">{criticalTenants.length ? "Tenant review required" : "No tenant risk rows"}</div>
          <div className="mt-2 text-sm leading-6 opacity-80">
            {criticalTenants.length
              ? `${criticalTenants.length} tenant row(s) report warning, degraded, or critical status from backend data.`
              : "The tenant endpoint did not return warning, degraded, or critical tenant rows."}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniStatus label="Tenant rows" value={tenants.length} tone="stable" />
          <MiniStatus label="Runtimes" value={runtimeTotal} tone="stable" />
          <MiniStatus label="Review rows" value={criticalTenants.length} tone={criticalTenants.length ? "warning" : "stable"} />
          <MiniStatus label="Data source" value="Backend" tone="stable" />
        </div>
      </GlassCard>
      <GlassCard title="Recent Activity">
        {tenants.slice(0, 3).map((tenant) => (
          <TimelineItem
            key={tenant.id}
            title={tenant.name}
            sub={`Status ${tenant.status} / ${tenant.tier}`}
            danger={["critical", "degraded", "warning"].includes(String(tenant.health || tenant.status || "").toLowerCase())}
          />
        ))}
        {!tenants.length ? <DataEmptyState title="No tenant activity" body="Tenant activity appears here after the backend returns tenant rows." /> : null}
      </GlassCard>
      <GlassCard title="Resource Load (Last 1H)">
        <div className="flex h-28 items-end gap-2">
          {(tenants.length ? tenants : [{ id: "empty", cpu: 0 }]).slice(0, 12).map((tenant, i) => {
            const h = Math.max(4, Math.min(100, Number(tenant.cpu || tenant.memory || 0)));
            return (
              <div key={tenant.id || i} className={`w-full rounded-t ${h > 80 ? "bg-red-500" : h > 60 ? "bg-amber-400" : "bg-cyan-400/75"}`} style={{ height: `${h}%` }} />
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">History</Button>
          <Button className="rounded-xl bg-red-600 hover:bg-red-500"><Terminal className="mr-2 h-4 w-4" />SSH Console</Button>
        </div>
      </GlassCard>
    </div>
  );
}

function PackagesPage({ packages = [], onOpenPackage }) {
  const packageCount = packages.length;
  const mappedTenants = packages.reduce((sum, pkg) => sum + Number(pkg.tenants || 0), 0);
  const highestAdoption = packages.slice().sort((a, b) => Number(b.tenants || 0) - Number(a.tenants || 0))[0];
  const visibleFeatures = Array.from(new Set(packages.flatMap((pkg) => pkg.tags || []))).slice(0, 8);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <GlassCard title="Available Tiers" right={<ToneBadge tone="stable">{packageCount} rows</ToneBadge>}>
          <div className="overflow-hidden rounded-xl border border-white/5">
          <div className="grid grid-cols-[180px_minmax(0,1fr)_160px_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            <div>Package Identity</div><div>Entitlements</div><div>Utilization</div><div>Actions</div>
          </div>
            {!packages.length ? (
              <div className="border-t border-white/5 p-4">
                <DataEmptyState title="No package/license rows returned" body="The package page is wired to the real platform license endpoint. Login as an owner or verify the package API data." />
              </div>
            ) : packages.map((pkg) => (
              <div
                key={pkg.sku}
                role="button"
                tabIndex={0}
                onClick={() => onOpenPackage?.(pkg)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onOpenPackage?.(pkg);
                }}
                className="grid w-full grid-cols-[180px_minmax(0,1fr)_160px_120px] items-center border-t border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.03]"
              >
                <div>
                  <div className="font-semibold text-white">{pkg.name}</div>
                  <div className="text-xs text-zinc-500">Tier ID: {pkg.sku}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pkg.tags.map((tag) => <ToneBadge key={tag} tone={tag.includes("Diagnostics") ? "warning" : "stable"}>{tag}</ToneBadge>)}
                </div>
                <div>
                  <div className="font-semibold text-white">{pkg.tenants} Tenants</div>
                  <div className="mt-2"><ProgressLine value={pkg.name === "Standard" ? 70 : pkg.name === "Pro" ? 45 : 18} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03]"><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03]"><Package className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"><XCircle className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard title="Capability Matrix" description="Features returned by package/license endpoints">
            <div className="space-y-4 text-sm">
              {visibleFeatures.length ? visibleFeatures.map((feature) => (
                <div key={String(feature)} className="grid grid-cols-[1fr_80px] items-center border-b border-white/5 pb-3">
                  <div className="text-zinc-300">{feature}</div>
                  <div className="text-right text-cyan-200">mapped</div>
                </div>
              )) : <DataEmptyState title="No feature tags" body="Package rows loaded, but no feature/tag list was returned." />}
            </div>
          </GlassCard>
          <GlassCard title="Package Intelligence">
            <MetricPair label="Highest Adoption" value={highestAdoption?.name || "No package rows"} />
            <MetricPair label="Mapped tenants" value={mappedTenants} tone="stable" />
            <MetricPair label="Data source" value="Owner package API" />
          </GlassCard>
        </div>
      </div>

      <GlassCard title="Package Change Evidence">
        {packages.length ? packages.slice(0, 3).map((pkg) => (
          <AuditEvent
            key={pkg.sku}
            dot="cyan"
            title={pkg.name}
            sub={`Package ${pkg.sku} exposes ${(pkg.tags || []).join(", ") || "no mapped feature tags"}.`}
            meta={`${pkg.tenants || 0} mapped tenants`}
          />
        )) : (
          <DataEmptyState title="No package audit evidence" body="Package history needs backend rows before this section can show real change evidence." />
        )}
      </GlassCard>
    </div>
  );
}

function PackageDetailRail({ packages = [] }) {
  const mappedTenants = packages.reduce((sum, pkg) => sum + Number(pkg.tenants || 0), 0);
  const featureCount = new Set(packages.flatMap((pkg) => pkg.tags || [])).size;
  const selectedPackage = packages[0];
  return (
    <div className="space-y-6">
      <GlassCard title="Tier Capability Matrix" description="Backend package/license summary">
        <MetricPair label="Package rows" value={packages.length} />
        <MetricPair label="Feature tags" value={featureCount} />
        <MetricPair label="Selected row" value={selectedPackage?.name || "No package selected"} />
        <Button className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Detailed Comparison</Button>
      </GlassCard>
      <GlassCard title="Market Reach">
        <div className="owner-kpi-value text-[28px] font-black text-white">{mappedTenants}</div>
        <div className="mt-2 text-zinc-400">Active Tenants</div>
      </GlassCard>
      <GlassCard title="Danger Zone" className="border-red-500/20 bg-red-500/[0.04]">
        <div className="text-sm leading-6 text-red-200/80">Package mutation requires a selected package ID, live backend access, and owner confirmation. No destructive call is sent from this summary card.</div>
        <Button className="mt-5 w-full rounded-xl bg-red-700 hover:bg-red-600">Delete Package</Button>
        <div className="mt-3 text-xs uppercase tracking-[0.22em] text-red-300/70">Multi-factor authorization required</div>
      </GlassCard>
    </div>
  );
}

function BillingPage({ invoices = [], onOpenInvoice }) {
  const paidCount = invoices.filter((row) => String(row.status || "").includes("paid")).length;
  const failedCount = invoices.filter((row) => String(row.status || "").includes("failed")).length;
  const pendingCount = invoices.length - paidCount - failedCount;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_1fr_260px]">
            <StatCard label="Invoices Loaded" value={invoices.length} sub="Rows returned by billing endpoints" icon={Wallet} spark="w-[82%] bg-cyan-400" compact />
            <StatCard label="Failed Payments" value={failedCount} sub={`${pendingCount} pending and ${paidCount} paid`} icon={CreditCard} spark="w-[42%] bg-amber-400" compact />
            <GlassCard title="Payment Success">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-cyan-400/70 text-xl font-black text-cyan-200">{invoices.length ? `${Math.round((paidCount / invoices.length) * 100)}%` : "n/a"}</div>
                <div>
                  <div className="text-lg font-bold text-white">Backend Derived</div>
                  <div className="text-sm text-zinc-500">Invoice status ratio</div>
                </div>
              </div>
              <Button className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Open Payment Attempt</Button>
            </GlassCard>
          </div>

          <GlassCard title="Global Revenue Ledger" right={<div className="flex gap-2"><ToneBadge tone="stable">All</ToneBadge><ToneBadge tone="locked">Paid</ToneBadge><ToneBadge tone="locked">Failed</ToneBadge><ToneBadge tone="locked">Draft</ToneBadge></div>}>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <Search className="h-4 w-4 text-zinc-500" />
              <div className="text-zinc-500">Search Tenant or ID...</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/5">
              <div className="grid grid-cols-[160px_1fr_150px_120px_140px_90px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <div>Invoice ID</div><div>Tenant</div><div>Date</div><div>Status</div><div>Amount</div><div>Actions</div>
              </div>
              {!invoices.length ? (
                <div className="border-t border-white/5 p-4">
                  <DataEmptyState title="No invoice rows returned" body="The billing page is wired to the real owner billing endpoints. Login or check billing permissions to load invoices." />
                </div>
              ) : invoices.map((row) => (
                <div
                  key={row.invoice}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenInvoice?.(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onOpenInvoice?.(row);
                  }}
                  className="grid w-full grid-cols-[160px_1fr_150px_120px_140px_90px] items-center border-t border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="font-semibold text-cyan-200">{row.invoice}</div>
                  <div className="font-medium text-white">{row.tenant}</div>
                  <div className="text-zinc-400">{row.date}</div>
                  <div><ToneBadge tone={row.status}>{row.status}</ToneBadge></div>
                  <div className="font-semibold text-white">{row.amount}</div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03]"><FileText className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03]"><Eye className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard title="High Commercial Risk" className="border-red-500/20 bg-red-500/[0.04]">
            <div className="space-y-4 text-sm">
              {invoices.filter((row) => String(row.status || "").includes("failed")).slice(0, 2).map((row) => (
                <div key={row.invoice} className="rounded-xl border border-red-500/20 bg-black/20 p-4">
                  <div className="font-semibold text-red-300">Failed Payment: {row.tenant}</div>
                  <div className="mt-1 text-zinc-400">{row.invoice} / {row.amount}</div>
                  <button className="mt-3 text-cyan-200">Notify Tenant</button>
                </div>
              ))}
              {!failedCount ? <DataEmptyState title="No failed invoices" body="No failed billing rows were returned by the current backend response." /> : null}
            </div>
          </GlassCard>
          <GlassCard title="Billing Data Health">
            <MetricPair label="Paid invoices" value={paidCount} tone="healthy" />
            <div className="mb-4"><ProgressLine value={invoices.length ? Math.round((paidCount / invoices.length) * 100) : 0} /></div>
            <MetricPair label="Failed invoices" value={failedCount} tone={failedCount ? "critical" : "healthy"} />
            <div><ProgressLine value={invoices.length ? Math.round((failedCount / invoices.length) * 100) : 0} tone={failedCount ? "red" : "green"} /></div>
            <button className="mt-5 flex items-center gap-2 text-cyan-200">View Technical Health <ChevronRight className="h-4 w-4" /></button>
          </GlassCard>
          <GlassCard title="System Updates">
            <TimelineItem title="Stripe webhook verified" sub="2 minutes ago" />
            <TimelineItem title="Auto-invoice batch executed" sub="4 hours ago" />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function SubscriptionsPage({ invoices = [], onOpenSubscription }) {
  const rows = invoices.map((invoice) => [
    invoice.tenant,
    invoice.invoice,
    "OWNER PLAN",
    "Billing cycle",
    "Provider record",
    invoice.status,
    invoice.date,
    invoice.amount,
    invoice.status,
  ]);
  const paidCount = rows.filter((row) => String(row[8]).includes("paid")).length;
  const failedCount = rows.filter((row) => String(row[8]).includes("failed")).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Billing Rows" value={rows.length} sub="Subscription view derived from invoices" icon={Wallet} spark="w-[74%] bg-cyan-400" compact />
        <StatCard label="Failed Rows" value={failedCount} sub="Invoices that need owner review" icon={RotateCcw} spark="w-[18%] bg-amber-400" compact />
        <StatCard label="Paid Ratio" value={rows.length ? `${Math.round((paidCount / rows.length) * 100)}%` : "n/a"} sub="Computed from current backend rows" icon={CheckCircle2} spark="w-[96%] bg-emerald-400" compact />
      </div>
      <GlassCard title="Active Subscriptions" right={<div className="flex items-center gap-3"><div className="rounded-md bg-white/5 px-2 py-1 text-xs text-zinc-400">1,248 total</div><div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"><Search className="h-4 w-4 text-zinc-500" /><span className="text-zinc-500">Filter by Tenant or ID...</span></div></div>}>
        <div className="overflow-hidden rounded-xl border border-white/5">
          <div className="grid grid-cols-[1.2fr_160px_180px_120px_140px_140px_100px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            <div>Tenant Associate</div><div>Tier</div><div>Billing Cycle</div><div>Status</div><div>Renewal</div><div>Amount</div><div>Actions</div>
          </div>
          {!rows.length ? (
            <div className="border-t border-white/5 p-4">
              <DataEmptyState title="No subscription rows returned" body="The subscriptions page is wired to real billing/subscription endpoints. Login or verify owner subscription permissions." />
            </div>
          ) : rows.map((row) => (
            <div
              key={row[1]}
              role="button"
              tabIndex={0}
              onClick={() => onOpenSubscription?.({ id: row[1], invoice: row[1], tenant: row[0] })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpenSubscription?.({ id: row[1], invoice: row[1], tenant: row[0] });
              }}
              className="grid w-full grid-cols-[1.2fr_160px_180px_120px_140px_140px_100px] items-center border-t border-white/5 px-4 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <div>
                <div className="font-semibold text-white">{row[0]}</div>
                <div className="text-xs text-zinc-500">ID: {row[1]}</div>
              </div>
              <div><ToneBadge tone={row[2] === "STANDARD" ? "locked" : "stable"}>{row[2]}</ToneBadge></div>
              <div>
                <div className="text-white">{row[3]}</div>
                <div className="text-xs text-zinc-500">{row[4]}</div>
              </div>
              <div><ToneBadge tone={row[5]}>{row[5]}</ToneBadge></div>
              <div className="text-zinc-300">{row[6]}</div>
              <div>
                <div className="font-semibold text-white">{row[7]}</div>
                <div className={`text-xs ${row[8] === "paid" ? "text-emerald-400" : "text-amber-300"}`}>{row[8].toUpperCase()}</div>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03]"><FileText className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="rounded-lg border border-white/10 bg-white/[0.03]"><Eye className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
      <div className="grid gap-4 md:grid-cols-4">
        <FooterMetric label="Rows Loaded" value={rows.length} tone="healthy" />
        <FooterMetric label="Failed Invoices" value={failedCount} tone={failedCount ? "critical" : "healthy"} />
        <FooterMetric label="Paid Invoices" value={paidCount} tone="stable" />
        <FooterMetric label="Data Source" value="Backend" tone="healthy" />
      </div>
    </div>
  );
}

function FleetPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-4">
        <StatCard label="Active Delivery Agents" value="1,402" sub="+12 Today" icon={Server} spark="w-[86%] bg-cyan-400" compact />
        <StatCard label="Active Server Bots" value="894" sub="Stable" icon={Bot} spark="w-[72%] bg-amber-300" compact />
        <StatCard label="Version Drift" value="4.2%" sub="Critical" icon={Cpu} spark="w-[18%] bg-red-400" compact />
        <StatCard label="Provisioning Capacity" value="98%" sub="Optimal" icon={Gauge} spark="w-[94%] bg-cyan-400" compact />
      </div>
      <GlassCard title="Delivery Agent Fleet" description="Machine binding & announce capabilities" right={<Button className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15">+ Provision Delivery Agent</Button>}>
        <FleetTable
          columns={["Agent ID / Name", "Activation State", "Version Drift", "Tenant Association", "Operational Actions"]}
          rows={[
            ["DA-EU-FRANKFURT-01\nBound to 172.18.92.144", <ToneBadge tone="active">Active / Online</ToneBadge>, "v1.4.12 (Latest)", "SCUM_OFFICIAL_EU", "⚙"],
            ["DA-NA-EAST-04\nConnection Lost (3m ago)", <ToneBadge tone="critical">Degraded / Stale</ToneBadge>, <span className="text-red-300">v1.3.09 △</span>, "SURVIVAL_CORP", "⚙"],
          ]}
        />
      </GlassCard>
      <GlassCard title="Server Bot Fleet" description="Log sync & config management posture" right={<Button className="rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15">+ Provision Server Bot</Button>}>
        <FleetTable
          columns={["Bot Entity / Cluster", "Log Freshness", "Config Posture", "Tenant Association", "Operational Actions"]}
          rows={[
            ["SB-GLOBAL-CLUSTER-A\nInstance: bot-prod-001", "0.4s (Real-time)", <div className="flex gap-2"><ToneBadge tone="healthy">Synced</ToneBadge><ToneBadge tone="healthy">Hardened</ToneBadge></div>, "PVE_REBORN", "◫"],
            ["SB-GLOBAL-CLUSTER-B\nInstance: bot-prod-102", <span className="text-red-300">42.8s (Lagging)</span>, <ToneBadge tone="warning">Config Drift Detected</ToneBadge>, "SCUM_OFFICIAL_NA", "⚠"],
          ]}
        />
      </GlassCard>
    </div>
  );
}

function ConnectedFleetPage({ fleet }) {
  const summary = fleet?.summary || {};
  const deliveryRows = fleet?.deliveryAgents?.length ? fleet.deliveryAgents.map((runtime) => [
    `${runtime.id || "Delivery Agent"}\n${runtime.machineName || runtime.tenantName || "Bound machine pending"}`,
    <ToneBadge tone={runtime.status === "online" || runtime.status === "active" ? "active" : "critical"}>{runtime.status}</ToneBadge>,
    runtime.latestVersion && runtime.version !== runtime.latestVersion ? <span className="text-red-300">{runtime.version} to {runtime.latestVersion}</span> : runtime.version || "unknown",
    runtime.tenantName || runtime.tenantId || "Unassigned",
    "⚙",
  ]) : [
    ["No Delivery Agent data\nBackend returned no runtime rows", <ToneBadge tone="locked">Waiting</ToneBadge>, "unknown", "Unassigned", "⚙"],
  ];
  const serverBotRows = fleet?.serverBots?.length ? fleet.serverBots.map((runtime) => [
    `${runtime.id || "Server Bot"}\n${runtime.machineName || runtime.tenantName || "Bound machine pending"}`,
    runtime.lastHeartbeatAt ? `Last heartbeat: ${new Date(runtime.lastHeartbeatAt).toLocaleString()}` : runtime.status,
    <ToneBadge tone={runtime.status === "online" || runtime.status === "active" ? "healthy" : "warning"}>{runtime.status}</ToneBadge>,
    runtime.tenantName || runtime.tenantId || "Unassigned",
    "◫",
  ]) : [
    ["No Server Bot data\nBackend returned no runtime rows", "unknown", <ToneBadge tone="locked">Waiting</ToneBadge>, "Unassigned", "◫"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-4">
        <StatCard label="Active Delivery Agents" value={String(summary.deliveryAgentsOnline ?? 0)} sub={`${summary.deliveryAgentsOffline ?? 0} offline`} icon={Server} spark="w-[86%] bg-cyan-400" compact />
        <StatCard label="Active Server Bots" value={String(summary.serverBotsOnline ?? 0)} sub={`${summary.serverBotsOffline ?? 0} offline`} icon={Bot} spark="w-[72%] bg-amber-300" compact />
        <StatCard label="Version Drift" value={String(summary.outdated ?? 0)} sub="Outdated runtimes" icon={Cpu} spark="w-[18%] bg-red-400" compact />
        <StatCard label="Provisioning Capacity" value="Live" sub="Backend adapter connected" icon={Gauge} spark="w-[94%] bg-cyan-400" compact />
      </div>
      <GlassCard title="Delivery Agent Fleet" description="Machine binding & announce capabilities" right={<Button className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15">+ Provision Delivery Agent</Button>}>
        <FleetTable
          columns={["Agent ID / Name", "Activation State", "Version Drift", "Tenant Association", "Operational Actions"]}
          rows={deliveryRows}
        />
      </GlassCard>
      <GlassCard title="Server Bot Fleet" description="Log sync & config management posture" right={<Button className="rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15">+ Provision Server Bot</Button>}>
        <FleetTable
          columns={["Bot Entity / Cluster", "Log Freshness", "Config Posture", "Tenant Association", "Operational Actions"]}
          rows={serverBotRows}
        />
      </GlassCard>
    </div>
  );
}

function FleetRail() {
  return (
    <div className="space-y-6">
      <GlassCard title="Instance Detail Viewer">
        <div className="grid h-72 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-zinc-500">
          <div>
            <PanelRight className="mx-auto mb-3 h-8 w-8" />
            Select a fleet unit to view detailed diagnostics and management options.
          </div>
        </div>
      </GlassCard>
      <GlassCard title="Critical Revocation Control" className="border-red-500/20 bg-red-500/[0.04]">
        <div className="text-sm leading-6 text-zinc-400">These actions are irreversible and will immediately disconnect the runtime from the authority plane.</div>
        <div className="mt-5 space-y-3">
          <Button className="w-full rounded-xl bg-red-800 hover:bg-red-700">Revoke Provision</Button>
          <Button className="w-full rounded-xl bg-red-900/80 hover:bg-red-800">Revoke Token</Button>
          <Button className="w-full rounded-xl bg-red-950/80 hover:bg-red-900">Revoke Device</Button>
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200/80">Operator note: high-risk actions require dual-factor authority confirmation.</div>
      </GlassCard>
    </div>
  );
}

function ObservabilityPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px_300px]">
        <GlassCard title="System Logs" right={<div className="flex gap-2"><ToneBadge tone="stable">Errors</ToneBadge><ToneBadge tone="warning">Slow Req</ToneBadge></div>}>
          <div className="rounded-xl border border-white/5 bg-black/40 p-4 font-mono text-[14px] leading-8">
            {[
              ["14:22:01.04", "INFO", "FLEET_MGR", "Agent..."],
              ["14:22:02.11", "INFO", "COMMERCE", "Order ..."],
              ["14:22:04.55", "ERROR", "SV_BOT_22", "Heartbeat timeout"],
              ["14:22:06.12", "INFO", "CORE", "Global sta..."],
              ["14:22:08.89", "WARN", "AGENT_04", "Slow r..."],
              ["14:22:10.02", "INFO", "AUTOMA", "Triggering backup..."],
              ["14:22:12.34", "INFO", "SV_BOT_01", "Configuration ..."],
              ["14:22:15.91", "FATAL", "ROUTING", "Dead letter queue spike"],
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-[100px_90px_130px_1fr] px-2 ${row[1] === "ERROR" || row[1] === "FATAL" ? "bg-red-500/10" : ""}`}>
                <span className="text-zinc-500">{row[0]}</span>
                <span className={row[1] === "INFO" ? "text-cyan-300" : row[1] === "WARN" ? "text-amber-300" : "text-red-300"}>[{row[1]}]</span>
                <span className="text-zinc-400">{row[2]}</span>
                <span className="text-zinc-200">{row[3]}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard title="Job Queue" right={<div className="rounded-md bg-white/5 px-2 py-1 text-xs text-zinc-400">12 Total</div>}>
            <QueueCard title="Database Indexing" task="Job_A291" progress={72} />
            <QueueCard title="Log Compression" task="Job_F112" note="Pending" />
            <QueueCard title="Agent Version Sync" task="Job_X008" danger action="Retry" />
          </GlassCard>
          <GlassCard title="Dead-Letter Queue" className="border-red-500/20 bg-red-500/[0.04]">
            <MetricPair label="Delivery Agents" value="14 msgs" tone="critical" />
            <MetricPair label="Server Bots" value="08 msgs" tone="critical" />
            <Button className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Inspect Bot DLQ</Button>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard title="Inspector">
            <div className="grid h-48 place-items-center rounded-2xl border border-white/5 bg-white/[0.03] text-center text-zinc-500">
              Select a log line or job to inspect metadata and request headers.
            </div>
          </GlassCard>
          <GlassCard title="Operator Logs">
            <TimelineItem title="Admin_Zero initiated Job_A291 (DB Indexing)" sub="14:10:02" />
            <TimelineItem title="System auto-cleared Delivery DLQ (42 stale msgs)" sub="13:45:11" />
            <TimelineItem title="Maintenance mode: DISABLED" sub="12:30:59" />
          </GlassCard>
          <Button className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"><Download className="mr-2 h-4 w-4" />Export Diagnostics</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <FooterMetric label="P99 Latency" value="142ms" tone="stable" />
        <FooterMetric label="Error Rate" value="0.04%" tone="critical" />
        <FooterMetric label="Queue Backlog" value="2,411" tone="warning" />
        <FooterMetric label="Healthy Nodes" value="99.8%" tone="healthy" />
      </div>
    </div>
  );
}

function IncidentsPage() {
  const cards = [
    ["Critical Active", "12", "+2 in last hour", "critical"],
    ["Warnings Pending", "28", "-5 resolved", "warning"],
    ["Acknowledged", "142", "84% response rate", "stable"],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((c) => <StatCard key={c[0]} label={c[0]} value={c[1]} sub={c[2]} icon={AlertTriangle} spark={c[3] === "critical" ? "w-[48%] bg-red-400" : c[3] === "warning" ? "w-[70%] bg-amber-400" : "w-[84%] bg-cyan-400"} compact />)}
      </div>
      <GlassCard right={<div className="flex gap-2"><ToneBadge tone="stable">All</ToneBadge><ToneBadge tone="locked">New</ToneBadge><ToneBadge tone="locked">Acknowledged</ToneBadge><ToneBadge tone="locked">Cleared</ToneBadge></div>}>
        <div className="space-y-4">
          <IncidentRow tone="critical" title="Server Bot Deployment Failure - Fleet Segment A12" body="Deployment agent timed out during container initialization on Node-SCUM-04. Health check failed for 3 consecutive cycles. Manual intervention required." meta="Tenant: Survivalcore Global • Runtime: Server Bot • Region: EU-WEST-1" />
          <IncidentRow tone="warning" title="Log Sync Latency Threshold Exceeded" body="SCUM.log synchronization for Tenant 'OmegaWasteland' is exceeding the 500ms threshold. Current latency: 1240ms. Possible network saturation." meta="Tenant: OmegaWasteland • Runtime: Delivery Agent" />
          <IncidentRow tone="locked" title="Scheduled Maintenance: Backup Routine Completed" body="Weekly full platform backup completed successfully. Integrity checks verified for all 42 tenant databases." meta="ACK BY: ADMIN_SYSTEM" />
          <IncidentRow tone="critical" title="Unauthorized API Key Generation Detected" body="Security audit triggered: Multiple high-privilege API tokens generated from an un-whitelisted IP range. Automatic account suspension in 5 mins." meta="Subsystem: Identity-Service" />
        </div>
      </GlassCard>
    </div>
  );
}

function IncidentsRail() {
  return (
    <div className="space-y-6">
      <GlassCard title="System Health Insights" description="Diagnostics dashboard">
        <div className="rounded-xl border border-white/5 bg-black/30 p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-cyan-300">Live Feed</div>
          <div className="space-y-2 text-sm">
            <div className="text-emerald-400">• Heartbeat: Node-01 OK</div>
            <div className="text-emerald-400">• Heartbeat: Node-02 OK</div>
            <div className="text-red-400">• Timeout: Node-04 Failure</div>
            <div className="text-emerald-400">• Heartbeat: Node-05 OK</div>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <MetricPair label="Fleet Availability" value="92%" tone="stable" />
          <div><ProgressLine value={92} /></div>
          <MetricPair label="Active Incidents" value="High Risk" tone="critical" />
          <div><ProgressLine value={68} tone="red" /></div>
        </div>
        <Button className="mt-6 h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Generate Full Audit Report</Button>
      </GlassCard>
    </div>
  );
}

function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <GlassCard title="Active Support Queue" right={<div className="flex items-center gap-4 text-sm"><span className="text-red-300">04 Urgent</span><span className="text-amber-300">12 Pending</span></div>}>
            <div className="overflow-hidden rounded-xl border border-white/5">
              <div className="grid grid-cols-[120px_1.2fr_1fr_120px_120px_80px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <div>Case ID</div><div>Tenant / Origin</div><div>Issue Category</div><div>Severity</div><div>Status</div><div>Actions</div>
              </div>
              <SupportRow caseId="SC-90422" tenant="SurvivalHardcore_EU" origin="ID: 4492-3312" issue="Server Bot Runtime Failure" severity="critical" status="Investigating" />
              <SupportRow caseId="SC-90421" tenant="GlobalOps_NA" origin="ID: 1102-4452" issue="Delivery Agent Latency" severity="warning" status="Queued" />
            </div>
          </GlassCard>
          <GlassCard title="Dead-Letter Queue (DLQ)" right={<button className="text-cyan-200">Clear Queue</button>}>
            <DLQRow code="ERR_004" title="PAYLOAD_MALFORMED" target="ServerBot_092 | ID: 9x-44a2" attempts="3/3" />
            <DLQRow code="ERR_012" title="AGENT_OFFLINE_FOR_PIPE" target="DeliveryAgent_UA | ID: u2-8812" attempts="1/3" warning />
          </GlassCard>
        </div>
        <div className="space-y-6">
          <GlassCard title="Diagnostic Toolkit">
            <Button className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Scan Agent</Button>
            <Button className="w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Scan Bot</Button>
            <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <div className="font-semibold text-white">Memory Dumps</div>
              <div className="mt-1 text-sm text-zinc-500">Last snapshot: 12m ago</div>
              <Button className="mt-4 w-full rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15">Request Full Heap Dump</Button>
            </div>
          </GlassCard>
          <GlassCard title="Technical Log (Live)">
            <div className="rounded-xl border border-white/5 bg-black/40 p-4 font-mono text-sm leading-7">
              <div className="text-cyan-300">[14:22:01] INFO: Initializing diagnostic sweep for cluster EU-CENTRAL-1</div>
              <div className="text-emerald-400">[14:22:05] OK: Tenant auth verified via session cookie</div>
              <div className="text-amber-300">[14:23:12] WARN: Late heartbeat detected on Node-828</div>
              <div className="text-red-300">[14:23:44] ERROR: BotSyncWorker failed on task [TX_00492]</div>
              <div className="text-red-300">[14:24:00] CRIT: Message moved to Dead-letter queue [dlq_bot_sync]</div>
              <div className="text-cyan-300">[14:24:20] INFO: Operator 0042 initiated Manual Retry for SC-90422</div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function RecoveryPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <StatCard label="Last Backup Integrity" value="99.8%" sub="ตรวจสอบความสมบูรณ์ล่าสุดเมื่อ: 2024-05-20 04:00:12 UTC" icon={HardDrive} spark="w-[98%] bg-cyan-400" compact />
            <StatCard label="View Restore Status" value="0" sub="Active Restores" icon={RotateCcw} spark="w-[8%] bg-zinc-500" compact />
          </div>
          <GlassCard title="View Restore History" right={<div className="flex gap-2"><ToneBadge tone="stable">All Events</ToneBadge><ToneBadge tone="locked">Success</ToneBadge><ToneBadge tone="locked">Failure</ToneBadge></div>}>
            {[
              ["2024-05-20 02:15:44", "BKP_SYS_ROOT_092", "PLATFORM_CORE"],
              ["2024-05-19 23:59:10", "BKP_TENANT_ALPHA_01", "TENANT:ALPHA"],
              ["2024-05-19 18:30:22", "BKP_SYS_CFG_088", "PLATFORM_CORE"],
            ].map((r) => (
              <div key={r[1]} className="grid grid-cols-[180px_1fr_180px] items-center border-t border-white/5 px-2 py-5 first:border-t-0">
                <div className="text-zinc-300">{r[0]}</div>
                <div className="font-semibold text-white">{r[1]}</div>
                <div><ToneBadge tone="stable">{r[2]}</ToneBadge></div>
              </div>
            ))}
          </GlassCard>
        </div>
        <div className="space-y-6">
          <GlassCard title="Backup Detail" description="ID: BKP_SYS_ROOT_092">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <MetricPair label="Created By" value="SYSTEM_AUTO_EXEC" />
              <MetricPair label="Size" value="12.4 GB" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "CORE_AUTH",
                "DATABASE_RELATIONAL",
                "FLEET_REGISTRY",
                "BLOB_STORAGE_REF",
              ].map((t) => <ToneBadge key={t} tone="stable">{t}</ToneBadge>)}
            </div>
            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <div className="font-semibold text-emerald-300">Verification Evidence</div>
              <div className="mt-2 grid gap-2 text-sm text-zinc-300">
                <div className="flex justify-between"><span>Integrity Check</span><span className="text-emerald-400">Passed</span></div>
                <div className="flex justify-between"><span>Checksum (MD5)</span><span>f8a...3e2</span></div>
                <div className="flex justify-between"><span>Encryption</span><span>AES-256-GCM</span></div>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-200/80">ATTENTION REQUIRED: การกู้คืนข้อมูลนี้จะทับค่า config และ runtime state ของระบบ Core ทั้งหมด</div>
            <Button className="mt-5 h-12 w-full rounded-xl bg-red-200 text-red-950 hover:bg-red-100">Confirm Restore</Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function SecurityPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <GlassCard title="Latest Security Events" right={<ToneBadge tone="critical">3 วิกฤต</ToneBadge>}>
          <SecurityEvent title="UNAUTHORIZED API ACCESS" body="ตรวจพบการพยายามเข้าถึง API ล้มเหลวหลายครั้งจาก IP 182.21.44.92 (UK)" action1="Revoke Session" action2="Review Identity" critical />
          <SecurityEvent title="BRUTE FORCE DETECTED" body="ผู้ใช้ 'SurvivalZone' มีแอดมินล็อกอินล้มเหลว 45 ครั้งใน 5 นาที" action1="Open Access View" action2="Review Identity" warning />
          <SecurityEvent title="SUSPICIOUS LOGIN LOCATION" body="Operator #012 ล็อกอินจากภาคที่ไม่ได้รับอนุมัติ (Bangkok, TH)" action1="Verify Operator" />
        </GlassCard>

        <div className="space-y-6">
          <GlassCard title="Audit Log" right={<Button className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">ทุกการกระทำ</Button>}>
            <div className="overflow-hidden rounded-xl border border-white/5">
              <div className="grid grid-cols-[150px_170px_200px_1fr_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <div>Timestamp</div><div>Actor</div><div>Action</div><div>Target</div><div>IP</div>
              </div>
              {[
                ["2023-11-24 14:02:11", "Operator #042", "TENANT_CONFIG_CHANGE", "ScumOps_DE", "192.168..."],
                ["2023-11-24 13:58:45", "AutoAutomation", "RESTART_BOT", "BotServer_02", "INTERNAL"],
                ["2023-11-24 13:45:01", "UNKNOWN_USR", "AUTH_FAILED_LIMIT", "RootAccess_01", "182.21..."],
                ["2023-11-24 13:30:12", "Operator #012", "PASSWORD_RESET", "SupportLead01", "1.10.22..."],
                ["2023-11-24 13:12:44", "Operator #042", "DELIVERY_AGENT_PROVISION", "Agent_9921", "192.168..."],
              ].map((r, i) => (
                <div key={i} className={`grid grid-cols-[150px_170px_200px_1fr_120px] items-center border-t border-white/5 px-4 py-4 ${r[1] === "UNKNOWN_USR" ? "bg-red-500/[0.04]" : ""}`}>
                  <div className="text-zinc-400">{r[0]}</div>
                  <div className="font-semibold text-white">{r[1]}</div>
                  <div><ToneBadge tone={r[2].includes("AUTH") ? "critical" : "locked"}>{r[2]}</ToneBadge></div>
                  <div className="text-cyan-200">{r[3]}</div>
                  <div className="text-zinc-500">{r[4]}</div>
                </div>
              ))}
            </div>
          </GlassCard>
          <div className="grid gap-4 md:grid-cols-3">
            <StatMini title="การยืนยันตัวตน" value="99.8%" sub="MFA ACTIVE" tone="stable" />
            <StatMini title="API Key Health" value="12" sub="EXPIRING SOON" tone="warning" />
            <StatMini title="Active Sessions" value="1,042" sub="+12% vs last hr" tone="stable" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 border-b border-white/5 pb-3 text-sm">
            {[
              "ข้อมูลทั่วไป",
              "สภาพแวดล้อม (ENV)",
              "ผู้ใช้งาน",
              "API Keys",
              "ความปลอดภัย",
            ].map((tab, i) => (
              <button key={tab} className={`rounded-lg px-3 py-2 ${i === 0 ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200" : "text-zinc-500 hover:text-white"}`}>{tab}</button>
            ))}
          </div>
          <GlassCard title="การตั้งค่าแพลตฟอร์ม (PLATFORM SETTINGS)" right={<ToneBadge tone="healthy">Synchronized</ToneBadge>}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Platform Name" value="SCUM GLOBAL COMMAND" />
              <Field label="Master Region" value="Southeast Asia (SEA)" />
            </div>
            <div className="mt-4">
              <Field label="Public Endpoint URL" value="https://api.scum-command.com" />
            </div>
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">การเปลี่ยน Public Endpoint อาจส่งผลต่อการเชื่อมต่อของ Delivery Agents ถัดไป โปรดตรวจสอบสถานะ Fleet ก่อนดำเนินการ</div>
            <div className="mt-5 flex justify-end"><Button className="rounded-xl bg-cyan-400 text-black hover:bg-cyan-300">Save Settings</Button></div>
          </GlassCard>
          <GlassCard title="ตัวแปรสภาพแวดล้อม (EDIT ENV)" right={<button className="text-cyan-200">+ Add Variable</button>}>
            {[
              ["LOG_LEVEL", '"info"'],
              ["MAX_CONCURRENCY", "512"],
              ["DATABASE_URL", "••••••••••••••••••••"],
            ].map((row) => (
              <div key={row[0]} className="grid grid-cols-[180px_1fr_60px] items-center border-t border-white/5 px-2 py-4 first:border-t-0">
                <div className="font-mono text-cyan-200">{row[0]}</div>
                <div className="font-mono text-zinc-400">{row[1]}</div>
                <button className="justify-self-end text-zinc-500 hover:text-white">✎</button>
              </div>
            ))}
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard title="เพิ่มผู้ดูแลระบบใหม่">
            <Field label="Username / Email" value="admin@scum.com" />
            <div className="mt-4"><Field label="Initial Password" value="" /></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15">Superadmin</Button>
              <Button className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Operator</Button>
            </div>
            <Button className="mt-4 h-11 w-full rounded-xl bg-white text-black hover:bg-zinc-200">Create Admin User</Button>
          </GlassCard>
          <GlassCard title="สถาพอร์หลักของระบบ">
            <MetricPair label="Core Engine" value="Active" tone="healthy" />
            <MetricPair label="Uptime" value="24d 12h 45m" />
            <MetricPair label="Memory Usage" value="1.4 GB / 4.0 GB" />
            <div className="mt-4"><ProgressLine value={35} /></div>
            <div className="mt-5 space-y-3 text-sm text-zinc-400">
              <div>• หากเปิดใช้งาน MFA สำหรับบัญชี SuperAdmin ทุกบัญชี</div>
              <div>• เปลี่ยน API Keys ทุกๆ 90 วัน เพื่อความปลอดภัยสูงสุด</div>
            </div>
          </GlassCard>
          <GlassCard title="Scheduled Maintenance">
            <div className="grid h-40 place-items-end rounded-xl border border-white/5 bg-[linear-gradient(180deg,rgba(53,216,255,0.06),rgba(255,255,255,0.02))] p-4 text-left">
              <div>
                <div className="text-xl font-black text-white">Scheduled Maintenance</div>
                <div className="mt-1 text-sm text-zinc-400">หน้าต่างการปรับขยายไฟล์: 12 พ.ย. 02:00 UTC</div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function formatBackendTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pickRecordTitle(record, fallback = "Backend event") {
  return record.title || record.message || record.action || record.path || record.id || fallback;
}

function ConnectedObservabilityPage({ data = {} }) {
  const raw = data.raw || {};
  const requestLogs = extractItems(raw.observabilityErrors);
  const deliveryRows = extractItems(raw.deliveryLifecycle);
  const metrics = raw.observabilityErrors?.metrics || raw.observability?.metrics || {};
  const deliverySummary = raw.deliveryLifecycle?.summary || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <GlassCard title="Backend Request Logs" right={<ToneBadge tone={requestLogs.length ? "warning" : "stable"}>{requestLogs.length} rows</ToneBadge>}>
          {requestLogs.length ? (
            <div className="overflow-hidden rounded-xl border border-white/5">
              <div className="grid grid-cols-[160px_90px_110px_1fr] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <div>Time</div><div>Status</div><div>Method</div><div>Path</div>
              </div>
              {requestLogs.slice(0, 10).map((row, index) => {
                const status = Number(row.statusCode || row.status || 0);
                return (
                  <div key={row.id || index} className={`grid grid-cols-[160px_90px_110px_1fr] items-center border-t border-white/5 px-4 py-3 text-sm ${status >= 500 ? "bg-red-500/[0.05]" : status >= 400 ? "bg-amber-500/[0.04]" : ""}`}>
                    <div className="font-mono text-zinc-500">{formatBackendTime(row.at || row.createdAt || row.time)}</div>
                    <div><ToneBadge tone={status >= 500 ? "critical" : status >= 400 ? "warning" : "healthy"}>{status || "OK"}</ToneBadge></div>
                    <div className="font-mono text-cyan-200">{row.method || "GET"}</div>
                    <div className="truncate text-zinc-300">{row.path || row.pathname || row.url || "unknown"}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataEmptyState title="No request errors" body="The observability endpoint is live and returned no error rows." />
          )}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard title="Delivery Lifecycle">
            <MetricPair label="Failed jobs" value={deliverySummary.failed24h || deliverySummary.failed || 0} tone={deliverySummary.failed24h ? "critical" : "stable"} />
            <MetricPair label="Dead-letter" value={deliverySummary.deadLetter || deliverySummary.deadLetterJobs || 0} tone={deliverySummary.deadLetter ? "critical" : "stable"} />
            <MetricPair label="Lifecycle rows" value={deliveryRows.length} />
          </GlassCard>
          <GlassCard title="Telemetry Metrics">
            <MetricPair label="Requests" value={metrics.total || metrics.count || requestLogs.length} />
            <MetricPair label="Errors" value={metrics.errors || metrics.errorCount || requestLogs.length} tone={requestLogs.length ? "warning" : "stable"} />
            <MetricPair label="P95" value={metrics.p95Ms ? `${metrics.p95Ms}ms` : "n/a"} />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ConnectedIncidentsPage({ data = {} }) {
  const raw = data.raw || {};
  const notifications = extractItems(raw.notifications);
  const securityEvents = extractItems(raw.securityEvents);
  const requestLogs = extractItems(raw.observabilityErrors);
  const deliverySummary = raw.deliveryLifecycle?.summary || {};
  const failedJobs = Number(deliverySummary.failed24h || deliverySummary.failed || 0);
  const criticalCount = securityEvents.length + requestLogs.filter((row) => Number(row.statusCode || row.status || 0) >= 500).length + failedJobs;
  const warningCount = notifications.length + requestLogs.filter((row) => {
    const status = Number(row.statusCode || row.status || 0);
    return status >= 400 && status < 500;
  }).length;

  const incidentRows = [
    ...notifications.map((row) => ({ tone: row.severity || "warning", title: pickRecordTitle(row, "Notification"), meta: row.type || row.category || "notification", body: row.detail || row.message || row.description || "Owner notification" })),
    ...securityEvents.map((row) => ({ tone: row.severity || "critical", title: pickRecordTitle(row, "Security event"), meta: row.actor || row.ip || "security", body: row.detail || row.reason || row.message || "Security event" })),
    ...requestLogs.slice(0, 5).map((row) => ({ tone: Number(row.statusCode || row.status || 0) >= 500 ? "critical" : "warning", title: `${row.method || "GET"} ${row.path || "request"}`, meta: `${row.statusCode || row.status || "ERR"} ${formatBackendTime(row.at || row.createdAt)}`, body: row.error || row.note || "Backend request needs attention" })),
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Critical Active" value={criticalCount} sub="Security, failed jobs, and 5xx request logs" icon={AlertTriangle} spark="w-[48%] bg-red-400" compact />
        <StatCard label="Warnings Pending" value={warningCount} sub="Notifications and 4xx request logs" icon={AlertTriangle} spark="w-[70%] bg-amber-400" compact />
        <StatCard label="Acknowledgement Source" value={notifications.length} sub="Rows from notifications endpoint" icon={CheckCircle2} spark="w-[84%] bg-cyan-400" compact />
      </div>
      <GlassCard right={<ToneBadge tone={incidentRows.length ? "warning" : "healthy"}>{incidentRows.length} live rows</ToneBadge>}>
        {incidentRows.length ? (
          <div className="space-y-4">
            {incidentRows.slice(0, 12).map((row, index) => (
              <IncidentRow key={`${row.title}-${index}`} tone={row.tone} title={row.title} body={row.body} meta={row.meta} />
            ))}
          </div>
        ) : (
          <DataEmptyState title="No live incidents" body="Notifications, security events, and request error logs are currently empty." />
        )}
      </GlassCard>
    </div>
  );
}

function ConnectedSupportPage({ data = {} }) {
  const raw = data.raw || {};
  const deliveryRows = extractItems(raw.deliveryLifecycle);
  const requestLogs = extractItems(raw.observabilityErrors);
  const supportRows = deliveryRows.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <GlassCard title="Live Support Evidence" right={<ToneBadge tone={supportRows.length ? "warning" : "stable"}>{supportRows.length} rows</ToneBadge>}>
            {supportRows.length ? supportRows.map((row, index) => (
              <SupportRow
                key={row.id || index}
                caseId={row.id || row.jobId || `JOB-${index + 1}`}
                tenant={row.tenantName || row.tenantId || "Unknown tenant"}
                origin={row.runtimeKey || row.agentId || row.source || "runtime"}
                issue={row.error || row.status || row.reason || "Delivery lifecycle event"}
                severity={String(row.status || row.severity || "").includes("failed") ? "critical" : "warning"}
                status={row.status || "open"}
              />
            )) : (
              <DataEmptyState title="No support queue endpoint" body="The repo exposes tenant-specific support-case reads, but no global create/list endpoint for this owner prototype yet." />
            )}
          </GlassCard>
          <GlassCard title="Dead-Letter and Error Evidence">
            {requestLogs.slice(0, 4).map((row, index) => (
              <DLQRow
                key={row.id || index}
                code={String(row.statusCode || row.status || "ERR")}
                title={row.path || row.error || "Backend request"}
                target={row.user || row.ip || "owner-api"}
                attempts={row.latencyMs ? `${row.latencyMs}ms` : "n/a"}
                warning={Number(row.statusCode || row.status || 0) < 500}
              />
            ))}
            {!requestLogs.length ? <DataEmptyState title="No dead-letter rows" body="No request error rows are available from the current backend response." /> : null}
          </GlassCard>
        </div>
        <div className="space-y-6">
          <GlassCard title="Diagnostic Toolkit">
            <Button title="Requires tenant/runtime selection" className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Scan Agent</Button>
            <Button title="Requires tenant/runtime selection" className="w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Scan Bot</Button>
            <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <div className="font-semibold text-white">Heap dump</div>
              <div className="mt-1 text-sm text-zinc-500">Blocked: no backend endpoint exists for owner heap dump requests.</div>
              <Button className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]">Request Full Heap Dump</Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ConnectedRecoveryPage({ data = {}, source, live, onRun }) {
  const raw = data.raw || {};
  const backupFiles = extractItems(raw.backupList);
  const restoreHistory = extractItems(raw.backupHistory);
  const restoreStatus = raw.backupStatus?.data || raw.backupStatus || {};
  const selectedBackup = backupFiles[0] || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <StatCard label="Backup Files" value={backupFiles.length} sub="Rows from /backup/list" icon={HardDrive} spark="w-[65%] bg-cyan-400" compact />
            <StatCard label="Restore Active" value={restoreStatus.active ? "Yes" : "No"} sub={restoreStatus.status || "Current restore status"} icon={RotateCcw} spark={restoreStatus.active ? "w-[70%] bg-amber-400" : "w-[8%] bg-zinc-500"} compact />
          </div>
          <GlassCard title="Restore History" right={<ToneBadge tone={restoreHistory.length ? "stable" : "locked"}>{restoreHistory.length} rows</ToneBadge>}>
            {restoreHistory.length ? restoreHistory.slice(0, 8).map((row, index) => (
              <div key={row.id || index} className="grid grid-cols-[180px_1fr_160px] items-center border-t border-white/5 px-2 py-5 first:border-t-0">
                <div className="text-zinc-300">{formatBackendTime(row.at || row.createdAt || row.completedAt)}</div>
                <div className="font-semibold text-white">{row.backup || row.file || row.id || "restore"}</div>
                <div><ToneBadge tone={row.status === "failed" ? "critical" : "stable"}>{row.status || "recorded"}</ToneBadge></div>
              </div>
            )) : (
              <DataEmptyState title="No restore history" body="The restore-history endpoint returned no rows." />
            )}
          </GlassCard>
        </div>
        <div className="space-y-6">
          <GlassCard title="Backup Detail" description={selectedBackup.file || selectedBackup.name || selectedBackup.id || "No backup selected"}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <MetricPair label="Created" value={formatBackendTime(selectedBackup.createdAt || selectedBackup.mtime || selectedBackup.at)} />
              <MetricPair label="Size" value={selectedBackup.size || selectedBackup.bytes || "n/a"} />
            </div>
            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">
              Restore now opens a confirmation form and will only call the backend after previewToken and typed confirmation are present.
            </div>
            <OwnerActionButton
              actionKey="confirmRestore"
              source={source}
              live={live}
              onRun={onRun}
              className="mt-5 h-12 w-full bg-red-200 text-red-950 hover:bg-red-100"
            />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ConnectedSecurityPage({ data = {} }) {
  const raw = data.raw || {};
  const securityEvents = extractItems(raw.securityEvents);
  const sessions = extractItems(raw.sessions);
  const users = extractItems(raw.users);
  const auditRows = extractItems(raw.auditQuery);
  const roleMatrix = raw.roleMatrix?.summary || raw.roleMatrix || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <GlassCard title="Latest Security Events" right={<ToneBadge tone={securityEvents.length ? "critical" : "healthy"}>{securityEvents.length} events</ToneBadge>}>
          {securityEvents.length ? securityEvents.slice(0, 5).map((event, index) => (
            <SecurityEvent
              key={event.id || index}
              title={pickRecordTitle(event, "Security event")}
              body={event.detail || event.reason || event.message || "Security signal from backend"}
              action1="Review"
              critical={String(event.severity || "").includes("critical") || String(event.severity || "").includes("high")}
              warning
            />
          )) : (
            <DataEmptyState title="No security events" body="The security-events endpoint returned no active rows." />
          )}
        </GlassCard>

        <div className="space-y-6">
          <GlassCard title="Audit Log" right={<ToneBadge tone={auditRows.length ? "stable" : "locked"}>{auditRows.length} rows</ToneBadge>}>
            {auditRows.length ? (
              <div className="overflow-hidden rounded-xl border border-white/5">
                <div className="grid grid-cols-[150px_170px_200px_1fr_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  <div>Timestamp</div><div>Actor</div><div>Action</div><div>Target</div><div>IP</div>
                </div>
                {auditRows.slice(0, 10).map((row, index) => (
                  <div key={row.id || index} className="grid grid-cols-[150px_170px_200px_1fr_120px] items-center border-t border-white/5 px-4 py-4">
                    <div className="text-zinc-400">{formatBackendTime(row.at || row.createdAt)}</div>
                    <div className="font-semibold text-white">{row.actor || row.user || "system"}</div>
                    <div><ToneBadge tone={String(row.action || "").includes("AUTH") ? "critical" : "locked"}>{row.action || row.type || "event"}</ToneBadge></div>
                    <div className="text-cyan-200">{row.target || row.path || "platform"}</div>
                    <div className="text-zinc-500">{row.ip || "n/a"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <DataEmptyState title="No audit rows" body="The audit endpoint is mapped, but it returned no rows for the default query." />
            )}
          </GlassCard>
          <div className="grid gap-4 md:grid-cols-3">
            <StatMini title="Role Matrix" value={roleMatrix.roles || roleMatrix.roleCount || "Live"} sub="permissions endpoint" tone="stable" />
            <StatMini title="Users" value={users.length} sub="admin users" tone="warning" />
            <StatMini title="Sessions" value={sessions.length} sub="active sessions" tone="stable" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectedSettingsPage({ data = {}, source, live, onRun }) {
  const raw = data.raw || {};
  const settings = raw.controlPanelSettings?.data || raw.controlPanelSettings || {};
  const runtime = raw.runtimeSupervisor?.data || raw.runtimeSupervisor || {};
  const apiKeys = extractItems(raw.apiKeys);
  const webhooks = extractItems(raw.webhooks);
  const marketplace = extractItems(raw.marketplace);
  const restartPlans = extractItems(raw.restartPlans);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <GlassCard title="Platform Settings" right={<ToneBadge tone="healthy">Read only live</ToneBadge>}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Surface" value={settings.surface || settings.mode || "owner"} />
              <Field label="Environment" value={settings.environment || settings.nodeEnv || "unknown"} />
            </div>
            <div className="mt-4">
              <Field label="Owner API" value={settings.ownerBaseUrl || settings.publicEndpoint || "/owner/api"} />
            </div>
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">
              Direct ENV editing is not enabled in this prototype. The backend route exists, but editing requires a dedicated form, validation, audit preview, and typed confirmation.
            </div>
          </GlassCard>
          <GlassCard title="Integrations">
            <MetricPair label="API keys" value={apiKeys.length} />
            <MetricPair label="Webhooks" value={webhooks.length} />
            <MetricPair label="Marketplace offers" value={marketplace.length} />
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard title="Runtime Supervisor">
            <MetricPair label="Supervisor" value={runtime.status || runtime.state || "unknown"} tone={runtime.status === "healthy" ? "healthy" : "stable"} />
            <MetricPair label="Services" value={extractItems(runtime.services).length || runtime.serviceCount || "n/a"} />
            <MetricPair label="Restart plans" value={restartPlans.length} />
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-sm text-red-100/80">
              Restart now opens a confirmation form and will only call the backend after the operator provides a service list and typed confirmation.
            </div>
            <OwnerActionButton
              actionKey="restartOwnerRuntime"
              source={source}
              live={live}
              onRun={onRun}
              className="mt-4 h-11 w-full bg-red-600 hover:bg-red-500"
            />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function BackendRail() {
  const apiMap = buildApiMap();
  return (
    <div className="space-y-6">
      <GlassCard title="Backend Integration Readiness" description="หน้า UI นี้ถูกจัดให้พร้อมรองรับ API จริง">
        <MetricPair label="Data Layer" value="Adapter Ready" tone="healthy" />
        <MetricPair label="Realtime" value="SSE / WebSocket" tone="stable" />
        <MetricPair label="Forms" value="Mutation Safe" tone="healthy" />
        <MetricPair label="Tables" value="Pagination / Filter" tone="stable" />
      </GlassCard>

      <GlassCard title="Suggested API Surface">
        <div className="space-y-4 text-xs text-zinc-400">
          {Object.entries(apiMap).slice(0, 5).map(([group, endpoints]) => (
            <div key={group} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <div className="mb-2 font-semibold uppercase tracking-[0.22em] text-cyan-200">{group}</div>
              <div className="space-y-1 font-mono">
                {Object.entries(endpoints).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                    <span className="truncate text-zinc-500">{key}:</span>
                    <span className="truncate text-zinc-300" title={value}>{value}</span>
                  </div>
                ))}
                {Object.keys(endpoints).length > 5 ? (
                  <div className="pt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                    + {Object.keys(endpoints).length - 5} more endpoints
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="Entity Contract Suggestions">
        <div className="space-y-3 text-sm text-zinc-400">
          <div>• Tenant: id, code, name, status, tier, agents, bots, cpu, memory</div>
          <div>• Invoice: invoiceId, tenantId, amount, status, attempts, issuedAt</div>
          <div>• Fleet Unit: unitId, region, runtimeVersion, status, drift, tenantId</div>
          <div>• Incident: incidentId, severity, category, runtimeType, acknowledgedBy</div>
          <div>• Settings: general, env, apiKeys, admins, securityFlags</div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function ScumOwnerUnifiedControlPlane() {
  const [routeState, setRouteState] = useState(() => {
    if (typeof window === "undefined") return { page: "overview", recordId: "" };
    return resolveOwnerRouteFromPath(window.location.pathname);
  });
  const [locale, setLocale] = useState(() => (typeof window !== "undefined" && window.localStorage.getItem("owner-ui-locale")) || "en");
  const [theme, setTheme] = useState(() => (typeof window !== "undefined" && window.localStorage.getItem("owner-ui-theme")) || "default");
  const [searchQuery, setSearchQuery] = useState("");
  const page = routeState.page;
  const selectedRecordId = routeState.recordId;
  const [refreshToken, setRefreshToken] = useState(0);
  const [actionResult, setActionResult] = useState(null);
  const [actionDraft, setActionDraft] = useState(null);
  const { loading, data, source, live, errors, endpointStatus } = useBackendData(page, refreshToken);
  const searchResults = useMemo(() => buildOwnerSearchResults(data, searchQuery), [data, searchQuery]);
  const notificationCount = extractItems(data.raw?.notifications).length;

  const refreshData = () => setRefreshToken((value) => value + 1);

  useEffect(() => {
    const handlePopState = () => {
      setRouteState(resolveOwnerRouteFromPath(window.location.pathname));
      setActionResult(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigateToPage(nextPage, options = {}) {
    const nextPath = buildOwnerPagePath(nextPage, options.recordId || "");
    if (typeof window !== "undefined" && window.location.pathname !== nextPath) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({ page: nextPage, recordId: options.recordId || "" }, "", nextPath);
    }
    setRouteState(resolveOwnerRouteFromPath(nextPath));
    setActionResult(null);
    setActionDraft(null);
    setSearchQuery("");
  }

  function buildActionPreset(actionKey, payload = {}) {
    const raw = data.raw || {};
    const firstTenant = (data.tenants || [])[0] || extractItems(raw.tenants)[0] || extractItems(raw.tenantConfigs)[0] || {};
    const firstPackage = (data.packages || [])[0] || extractItems(raw.licenses)[0] || {};
    const firstServer = extractItems(raw.servers)[0] || extractItems(raw.agents)[0] || {};
    const firstBackup = extractItems(raw.backupList)[0] || {};
    const notificationIds = extractItems(raw.notifications).map((item) => item.id).filter(Boolean);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const base = {
      tenantId: firstTenant.id || firstTenant.tenantId || firstTenant.slug || "",
      packageId: firstPackage.sku || firstPackage.id || firstPackage.packageId || "",
      serverId: firstServer.serverId || firstServer.id || "",
      minimumVersion: "1.0.0",
      expiresAt,
      ids: notificationIds.join(", "),
      backup: firstBackup.file || firstBackup.name || firstBackup.id || "",
      confirmBackup: firstBackup.file || firstBackup.name || firstBackup.id || "",
    };

    if (actionKey === "provisionDeliveryAgent") {
      base.runtimeKey = "delivery-agent-main";
      base.name = "Delivery Agent Main";
    }
    if (actionKey === "provisionServerBot") {
      base.runtimeKey = "server-bot-main";
      base.name = "Server Bot Main";
    }

    return { ...base, ...(payload || {}) };
  }

  function handleOpenAction(actionKey, payload) {
    setActionDraft({
      actionKey,
      preset: buildActionPreset(actionKey, payload),
    });
    setActionResult(null);
  }

  async function handleOwnerAction(actionKey, payload) {
    const result = await runOwnerAction(actionKey, {
      source,
      live,
      payload,
      onNavigate: navigateToPage,
      onRefresh: refreshData,
      openUrl: (url) => {
        if (typeof window !== "undefined") {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      },
    });
    setActionResult(result);
    if (result.ok) setActionDraft(null);
    if (result.ok && result.action?.kind === "mutation") {
      refreshData();
    }
    return result;
  }

  function setButtonResult(label, message, ok = true) {
    setActionResult({
      ok,
      action: { label },
      data: ok ? { message } : undefined,
      error: ok ? undefined : message,
    });
  }

  function handleUtilityAction(message) {
    setActionDraft(null);
    setButtonResult("Owner utility", message, true);
  }

  function toggleLocale() {
    setLocale((current) => {
      const next = current === "th" ? "en" : "th";
      if (typeof window !== "undefined") window.localStorage.setItem("owner-ui-locale", next);
      return next;
    });
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "contrast" ? "default" : "contrast";
      if (typeof window !== "undefined") window.localStorage.setItem("owner-ui-theme", next);
      return next;
    });
  }

  function handleSearchSelect(result) {
    navigateToPage(result.page, { recordId: result.id });
  }

  function handleUnhandledButton(label) {
    const normalized = label.toLowerCase();
    setActionDraft(null);

    if (normalized.includes("provision delivery")) {
      handleOpenAction("provisionDeliveryAgent");
      return;
    }
    if (normalized.includes("provision server")) {
      handleOpenAction("provisionServerBot");
      return;
    }
    if (normalized.includes("manual renewal")) {
      handleOpenAction("createSubscription");
      return;
    }
    if (normalized.includes("open payment attempt")) {
      handleOpenAction("createCheckoutSession");
      return;
    }
    if (normalized.includes("confirm restore")) {
      handleOpenAction("confirmRestore");
      return;
    }
    if (normalized.includes("export diagnostics")) {
      handleOwnerAction("exportObservability");
      return;
    }
    if (normalized.includes("full audit") || normalized.includes("ทุกการกระทำ")) {
      handleOwnerAction("exportAudit");
      return;
    }
    if (normalized.includes("history")) {
      navigateToPage("recovery");
      setButtonResult(label, "Opened the recovery history surface.", true);
      return;
    }
    if (normalized.includes("technical health") || normalized.includes("inspect bot dlq")) {
      navigateToPage("observability");
      setButtonResult(label, "Opened observability for runtime and queue health.", true);
      return;
    }
    if (normalized.includes("retry delivery") || normalized.includes("clear queue")) {
      handleOpenAction(normalized.includes("retry") ? "retryDeadLetter" : "clearDeadLetter");
      return;
    }
    if (normalized.includes("scan agent") || normalized.includes("scan bot")) {
      setButtonResult(label, "This diagnostic action needs a selected tenant and runtime ID before it can call backend diagnostics.", false);
      return;
    }
    if (normalized.includes("heap dump")) {
      setButtonResult(label, "No owner heap-dump request endpoint is mapped in this repo, so the prototype blocks the action instead of faking it.", false);
      return;
    }
    if (normalized.includes("ssh console")) {
      setButtonResult(label, "SSH console is intentionally not opened from the browser owner panel. Use runtime diagnostics or server-side access controls.", false);
      return;
    }
    if (normalized.includes("delete package")) {
      handleOpenAction("deletePackage");
      return;
    }
    if (normalized.includes("revoke")) {
      handleOpenAction(normalized.includes("session") ? "revokeAdminSession" : "revokeRuntime");
      return;
    }
    if (normalized.includes("notify tenant")) {
      setButtonResult(label, "No owner tenant-notification endpoint is mapped yet. This is blocked instead of sending a fake notification.", false);
      return;
    }
    if (normalized.includes("save settings") || normalized.includes("add variable") || normalized === "✎") {
      handleOpenAction("updateControlPanelEnv");
      return;
    }
    if (normalized.includes("create admin user")) {
      handleOpenAction("upsertAdminUser");
      return;
    }
    if (normalized.includes("superadmin") || normalized.includes("operator")) {
      handleOpenAction("upsertAdminUser", {
        role: normalized.includes("superadmin") ? "owner" : "operator",
      });
      return;
    }

    setButtonResult(label, `${label} is acknowledged. This control is visible in the owner workflow; backend mutation requires a selected record or a mapped endpoint.`, true);
  }

  function renderAction(actionKey, payload, className = "") {
    const action = getPageActions(page).find((item) => item.key === actionKey);
    const Icon = ACTION_ICONS[actionKey];
    return (
      <OwnerActionButton
        key={actionKey}
        actionKey={actionKey}
        source={source}
        live={live}
        payload={payload}
        onRun={handleOwnerAction}
        onOpen={handleOpenAction}
        icon={Icon}
        className={className}
      >
        {action?.label}
      </OwnerActionButton>
    );
  }

  const guardedContent = (node) => {
    if (loading) return <LoadingState />;
    return (
      <>
        <OwnerActionPanel
          draft={actionDraft}
          source={source}
          live={live}
          onClose={() => setActionDraft(null)}
          onSubmit={(payload) => handleOwnerAction(actionDraft.actionKey, payload)}
        />
        <ActionResultBanner result={actionResult} />
        {node}
      </>
    );
  };

  const config = useMemo(() => {
    const subPageMeta = !NEW_PAGE_OVERRIDES.has(page) && OWNER_SUBPAGE_DETAILS[page];
    if (subPageMeta) {
      return {
        title: subPageMeta.title,
        kicker: `Owner Command / ${subPageMeta.category} / ${getSubPageNavMeta(subPageMeta).parentLabel}`,
        content: guardedContent(<OwnerSubPage meta={subPageMeta} data={data} endpointStatus={endpointStatus} selectedRecordId={selectedRecordId} onNavigate={navigateToPage} />),
        rightRail: <OwnerSubPageRail meta={subPageMeta} />,
        actions: getPageActions(page).map((action) => renderAction(
          action.key,
          undefined,
          action.key === "restartOwnerRuntime"
            ? "bg-red-600 hover:bg-red-500"
            : action.kind === "mutation"
              ? "bg-cyan-400 text-black hover:bg-cyan-300"
              : "",
        )),
      };
    }

    switch (page) {
      case "overview":
        return {
          title: "Platform Overview",
          kicker: "Owner Command / Real-time Supervision",
          content: guardedContent(<NewOverviewPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: null,
          actions: getPageActions("overview").map((action) => renderAction(action.key, undefined, action.key === "runMonitoring" ? "bg-cyan-400 text-black hover:bg-cyan-300" : "")),
        };
      case "tenants":
        return {
          title: "Tenant Management",
          kicker: "Owner Command / Global Supervision",
          content: guardedContent(<NewTenantsPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <TenantDiagnosticsRail tenants={data.tenants || []} />,
          actions: getPageActions("tenants").map((action) => renderAction(action.key)),
        };
      case "tenant-dossier":
        return {
          title: "Tenant Dossier",
          kicker: "Owner Command / Core Management",
          content: guardedContent(<NewTenantDossierPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: null,
          actions: getPageActions("tenant-dossier").map((action) => renderAction(action.key)),
        };
      case "create-tenant":
        return {
          title: "Create Tenant",
          kicker: "Owner Command / Core Management",
          content: guardedContent(<NewCreateTenantPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: null,
          actions: [],
        };
      case "packages":
        return {
          title: "Package Management",
          kicker: "Owner Command / Capability & Entitlements",
          content: guardedContent(<NewPackagesPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <PackageDetailRail packages={data.packages || []} />,
          actions: getPageActions("packages").map((action) => renderAction(action.key, undefined, "bg-cyan-400 text-black hover:bg-cyan-300")),
        };
      case "billing":
        return {
          title: "Billing & Subscriptions",
          kicker: "Owner Command / Commercial Oversight",
          content: guardedContent(<NewBillingPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("billing").map((action) => renderAction(action.key, undefined, action.key === "createCheckoutSession" ? "bg-cyan-400 text-black hover:bg-cyan-300" : "")),
        };
      case "subscriptions":
        return {
          title: "Subscriptions & Billing",
          kicker: "Owner Command / Platform Treasury",
          content: guardedContent(<NewSubscriptionsPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("subscriptions").map((action) => renderAction(action.key, undefined, action.key === "createSubscription" ? "bg-cyan-400 text-black hover:bg-cyan-300" : "")),
        };
      case "fleet":
        return {
          title: "Fleet Operations",
          kicker: "Owner Command / Runtime Control",
          content: guardedContent(<NewFleetPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <FleetRail />,
          actions: getPageActions("fleet").map((action) => renderAction(action.key, undefined, action.key !== "refresh" ? "bg-cyan-400 text-black hover:bg-cyan-300" : "")),
        };
      case "observability":
        return {
          title: "Observability Control",
          kicker: "Owner Command / Telemetry & Queue Supervision",
          content: guardedContent(<NewObservabilityPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("observability").map((action) => renderAction(action.key)),
        };
      case "incidents":
        return {
          title: "Incidents & Alerts",
          kicker: "Owner Command / Defensive Posture",
          content: guardedContent(<NewIncidentsPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <IncidentsRail />,
          actions: getPageActions("incidents").map((action) => renderAction(action.key, {
            ids: extractItems(data.raw?.notifications).map((item) => item.id).filter(Boolean),
          })),
        };
      case "support":
        return {
          title: "Support & Diagnostics",
          kicker: "Owner Command / Live Technical Support",
          content: guardedContent(<NewSupportPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("support").map((action) => renderAction(action.key, undefined, action.key === "openDeadLetter" ? "bg-cyan-400 text-black hover:bg-cyan-300" : "")),
        };
      case "recovery":
        return {
          title: "Maintenance & Recovery",
          kicker: "Owner Command / Recovery Control Unit",
          content: guardedContent(<NewRecoveryPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("recovery").map((action) => renderAction(action.key, undefined, "bg-cyan-400 text-black hover:bg-cyan-300")),
        };
      case "security":
        return {
          title: "Audit & Security",
          kicker: "Owner Command / Security & Governance",
          content: guardedContent(<NewSecurityPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("security").map((action) => renderAction(action.key)),
        };
      case "settings":
        return {
          title: "Settings & Environment",
          kicker: "Owner Command / Platform Configuration",
          content: guardedContent(<NewSettingsPage data={data} source={source} live={live} recordId={selectedRecordId} onRun={handleOwnerAction} errors={errors} />),
          rightRail: <BackendRail />,
          actions: getPageActions("settings").map((action) => renderAction(action.key, undefined, "bg-red-600 hover:bg-red-500")),
        };
      default:
        return {
          title: "Workspace",
          kicker: "Owner Command",
          content: <OverviewPage data={data} />,
          rightRail: null,
          actions: [],
        };
    }
  }, [page, selectedRecordId, loading, data, source, live, errors, endpointStatus, actionResult, actionDraft]);

  const apiStatus = source === "backend"
    ? { label: "API: Backend live", color: "bg-emerald-400" }
    : source === "backend-partial"
      ? { label: `API: Partial backend (${errors.length} fallback warnings)`, color: "bg-amber-400" }
      : source === "mock"
        ? { label: "API: Mock fallback", color: "bg-amber-400" }
        : source === "error"
          ? { label: "API: Error", color: "bg-red-400" }
          : { label: "API: Loading", color: "bg-zinc-500" };

  return (
      <AppShell
        page={page}
        setPage={navigateToPage}
        pageTitle={config.title}
      pageKicker={config.kicker}
      actions={config.actions}
        rightRail={config.rightRail}
        onRefresh={refreshData}
        onUtilityAction={handleUtilityAction}
        onUnhandledButton={handleUnhandledButton}
        locale={locale}
        theme={theme}
        onToggleLocale={toggleLocale}
        onToggleTheme={toggleTheme}
        searchQuery={searchQuery}
        onSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSearchSelect}
        notificationCount={notificationCount}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {config.content}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-white/5 pt-4 text-xs uppercase tracking-[0.22em] text-zinc-600">
        <div className="flex items-center gap-2"><div className={`h-2 w-2 rounded-full ${apiStatus.color}`} /> {apiStatus.label}</div>
        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-400" /> Endpoints: {endpointStatus.filter((entry) => entry.ok).length}/{endpointStatus.length || 0}</div>
        <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-zinc-500" /> Notifications: {notificationCount}</div>
        <div className="ml-auto">SCUM Unified Control Plane / Backend-ready Owner Surface</div>
      </div>
    </AppShell>
  );
}
