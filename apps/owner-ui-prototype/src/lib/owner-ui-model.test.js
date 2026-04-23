import { describe, expect, it } from "vitest";
import { OWNER_VISUAL_SYSTEM, resolveOwnerBackendStatus } from "./owner-ui-model.js";

describe("owner-ui-model", () => {
  it("keeps the owner control plane visually restrained", () => {
    expect(OWNER_VISUAL_SYSTEM.accent).toBe("cyan");
    expect(OWNER_VISUAL_SYSTEM.sidebar.fixedDesktop).toBe(true);
    expect(OWNER_VISUAL_SYSTEM.sidebar.showSubmenuMetaBadges).toBe(false);
    expect(OWNER_VISUAL_SYSTEM.cards.maxRadius).toBe(12);
    expect(OWNER_VISUAL_SYSTEM.cards.glow).toBe("minimal");
  });

  it("turns backend availability into operator-readable states", () => {
    expect(resolveOwnerBackendStatus({ source: "backend", live: true }).label).toBe("Live backend data");
    expect(resolveOwnerBackendStatus({ source: "auth-required", live: false }).label).toBe("Login required");
    expect(resolveOwnerBackendStatus({ source: "backend-partial", live: true, errors: ["500 failed"] }).label).toBe("Partial backend data");
    expect(resolveOwnerBackendStatus({ source: "error", live: false, errors: ["network failed"] }).label).toBe("Endpoint failed");
    expect(resolveOwnerBackendStatus({ source: "offline", live: false, endpointStatus: [] }).label).toBe("Missing backend");
  });

  it("reports endpoint failures without hiding the requested backend slice", () => {
    const status = resolveOwnerBackendStatus({
      source: "error",
      live: false,
      errors: ["overview: 500 Server Error for /owner/api/platform/overview"],
      endpointStatus: [
        {
          key: "overview",
          path: "/owner/api/platform/overview",
          ok: false,
          status: 500,
        },
      ],
    });

    expect(status.tone).toBe("critical");
    expect(status.detail).toContain("/owner/api/platform/overview");
    expect(status.action).toBe("Check owner-web/admin-web, endpoint permissions, then refresh.");
  });
});
