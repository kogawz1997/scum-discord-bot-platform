export const OWNER_VISUAL_SYSTEM = Object.freeze({
  accent: "cyan",
  sidebar: Object.freeze({
    fixedDesktop: true,
    showSubmenuMetaBadges: false,
  }),
  cards: Object.freeze({
    maxRadius: 12,
    glow: "minimal",
  }),
});

function firstFailurePath(endpointStatus = []) {
  const failed = endpointStatus.find((entry) => entry && entry.ok === false);
  return failed?.path || failed?.key || "";
}

function firstError(errors = []) {
  return errors.find((error) => String(error || "").trim()) || "";
}

export function resolveOwnerBackendStatus({
  source = "loading",
  live = false,
  errors = [],
  endpointStatus = [],
} = {}) {
  if (source === "backend" && live) {
    return {
      key: "live",
      tone: "healthy",
      label: "Live backend data",
      detail: "This page is using real owner API responses.",
      action: "Continue operating from this page.",
    };
  }

  if (source === "backend-partial" && live) {
    const detail = firstError(errors) || firstFailurePath(endpointStatus);
    return {
      key: "partial",
      tone: "warning",
      label: "Partial backend data",
      detail: detail
        ? `Some owner API slices failed: ${detail}`
        : "Some owner API slices failed, but at least one live slice loaded.",
      action: "Review failed endpoints before running mutations.",
    };
  }

  if (source === "auth-required") {
    return {
      key: "auth",
      tone: "warning",
      label: "Login required",
      detail: "Protected owner data is blocked until the browser has a valid owner session.",
      action: "Open the separate owner login page, sign in, then refresh.",
    };
  }

  if (endpointStatus.length || errors.length || source === "error") {
    const detail = firstError(errors) || firstFailurePath(endpointStatus) || "Owner endpoint failed.";
    return {
      key: "failed",
      tone: "critical",
      label: "Endpoint failed",
      detail,
      action: "Check owner-web/admin-web, endpoint permissions, then refresh.",
    };
  }

  return {
    key: "missing",
    tone: "critical",
    label: "Missing backend",
    detail: "No owner API slice was returned for this page.",
    action: "Start owner-web/admin-web or verify the Vite proxy target.",
  };
}
