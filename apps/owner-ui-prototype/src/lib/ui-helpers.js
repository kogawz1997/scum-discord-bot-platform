/**
 * Shared UI helper functions for page components
 * These were previously inline in the monolith
 */

export function formatBackendTime(value) {
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

export function pickRecordTitle(record = {}, fallback = "Backend event") {
  return record.title || record.message || record.action || record.path || record.id || fallback;
}

export function recordIdOf(record = {}) {
  return record.id || record.tenantId || record.slug || record.sku || record.packageId || record.invoiceId || record.subscriptionId || record.agentId || record.serverId || "";
}

export function formatCurrency(value, currency = "USD") {
  if (value === undefined || value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function truncate(str, max = 40) {
  if (!str) return "";
  return String(str).length > max ? `${String(str).slice(0, max)}...` : String(str);
}
