import { describe, expect, it } from "vitest";
import { fetchOwnerPageData } from "./owner-api.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? "Unauthorized" : status === 500 ? "Server Error" : "OK",
    headers: {
      get(name) {
        return String(name).toLowerCase() === "content-type" ? "application/json" : "";
      },
    },
    async json() {
      return body;
    },
  };
}

describe("owner-api", () => {
  it("does not silently replace an unauthenticated backend with mock data", async () => {
    const result = await fetchOwnerPageData("overview", {
      fetchImpl: async () => jsonResponse(401, { ok: false, error: "unauthorized" }),
    });

    expect(result.source).toBe("auth-required");
    expect(result.live).toBe(false);
    expect(result.data.raw).toBeDefined();
    expect(result.errors[0]).toContain("401");
  });

  it("keeps explicit mock fallback opt-in for design-only review", async () => {
    const result = await fetchOwnerPageData("tenants", {
      allowMockFallback: true,
      fetchImpl: async () => jsonResponse(401, { ok: false, error: "unauthorized" }),
    });

    expect(result.source).toBe("mock");
    expect(result.live).toBe(false);
    expect(result.data.tenants.length).toBeGreaterThan(0);
  });

  it("uses the owner session probe to identify login-required state when feature endpoints are absent", async () => {
    const result = await fetchOwnerPageData("overview", {
      fetchImpl: async (path) => {
        if (path === "/owner/api/me") {
          return jsonResponse(401, { ok: false, error: "unauthorized" });
        }
        return jsonResponse(404, { ok: false, error: "not found" });
      },
    });

    expect(result.source).toBe("auth-required");
    expect(result.live).toBe(false);
    expect(result.endpointStatus.some((entry) => entry.key === "authSession" && entry.status === 401)).toBe(true);
  });

  it("loads only the real backend slices needed by the requested page", async () => {
    const calls = [];
    await fetchOwnerPageData("fleet", {
      fetchImpl: async (path) => {
        calls.push(path);
        return jsonResponse(401, { ok: false, error: "unauthorized" });
      },
    });

    expect(calls).toContain("/owner/api/me");
    expect(calls).toContain("/owner/api/platform/agents?limit=50");
    expect(calls).toContain("/owner/api/platform/servers?limit=50");
    expect(calls).not.toContain("/owner/api/platform/billing/invoices?limit=50");
    expect(calls).not.toContain("/owner/api/platform/licenses?limit=50");
  });

  it("maps owner submenu child pages to the correct parent backend slices", async () => {
    const calls = [];
    await fetchOwnerPageData("invoice-detail", {
      fetchImpl: async (path) => {
        calls.push(path);
        return jsonResponse(401, { ok: false, error: "unauthorized" });
      },
    });

    expect(calls).toContain("/owner/api/platform/billing/invoices?limit=50");
    expect(calls).toContain("/owner/api/platform/billing/payment-attempts?limit=50");
    expect(calls).not.toContain("/owner/api/platform/agents?limit=50");
  });


  it("marks partially available backend data as live but degraded", async () => {
    const result = await fetchOwnerPageData("fleet", {
      fetchImpl: async (path) => {
        if (path.includes("/platform/agents")) {
          return jsonResponse(200, {
            ok: true,
            data: [
              { id: "da_1", runtimeKind: "delivery-agent", status: "online", tenantId: "tenant_1" },
            ],
          });
        }
        return jsonResponse(500, { ok: false, error: "boom" });
      },
    });

    expect(result.source).toBe("backend-partial");
    expect(result.live).toBe(true);
    expect(result.data.fleet.deliveryAgents).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
