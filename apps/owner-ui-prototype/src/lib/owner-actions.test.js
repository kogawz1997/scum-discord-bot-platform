import { describe, expect, it } from "vitest";
import {
  OWNER_ACTIONS,
  getPageActions,
  resolveOwnerAction,
  runOwnerAction,
} from "./owner-actions.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? "Unauthorized" : "OK",
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

describe("owner-actions", () => {
  it("exposes consistent page actions for the owner pages", () => {
    expect(getPageActions("fleet").map((action) => action.key)).toEqual(expect.arrayContaining([
      "refresh",
      "createPlatformServer",
      "provisionDeliveryAgent",
      "provisionServerBot",
    ]));
    expect(getPageActions("settings").map((action) => action.key)).toContain("restartOwnerRuntime");
    expect(getPageActions("support").map((action) => action.key)).toEqual(expect.arrayContaining([
      "exportSupport",
      "exportTenantDiagnostics",
      "openSupportCase",
    ]));
  });

  it("disables backend actions when the page is not backed by a live session", () => {
    const state = resolveOwnerAction("createRestorePoint", {
      source: "auth-required",
      live: false,
    });

    expect(state.enabled).toBe(false);
    expect(state.reason).toMatch(/login/i);
  });

  it("disables risky actions until the required payload and confirmation are present", () => {
    const state = resolveOwnerAction("restartOwnerRuntime", {
      source: "backend",
      live: true,
    });

    expect(state.enabled).toBe(false);
    expect(state.reason).toMatch(/services/i);

    const ready = resolveOwnerAction("restartOwnerRuntime", {
      source: "backend",
      live: true,
      payload: {
        services: ["owner-web"],
        confirmText: "RESTART",
      },
    });
    expect(ready.enabled).toBe(true);
  });

  it("runs safe backend actions with JSON credentials", async () => {
    const calls = [];
    const result = await runOwnerAction("runMonitoring", {
      source: "backend",
      live: true,
      fetchImpl: async (path, options) => {
        calls.push({ path, options });
        return jsonResponse(200, { ok: true, data: { checked: true } });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0].path).toBe("/owner/api/platform/monitoring/run");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.credentials).toBe("include");
  });

  it("keeps page navigation actions wired for buttons used by the new pages", async () => {
    const navigations = [];
    const result = await runOwnerAction("gotoInvoiceDetail", {
      source: "backend",
      live: true,
      payload: { recordId: "inv-42" },
      onNavigate: (page, options) => navigations.push({ page, options }),
    });

    expect(result.ok).toBe(true);
    expect(navigations).toEqual([
      { page: "invoice-detail", options: { recordId: "inv-42" } },
    ]);
  });

  it("builds tenant support-case export URLs from the selected tenant payload", async () => {
    const opened = [];
    const result = await runOwnerAction("openSupportCase", {
      source: "backend",
      live: true,
      payload: {
        tenantId: "tenant-a",
        format: "csv",
      },
      openUrl: (url) => opened.push(url),
    });

    expect(result.ok).toBe(true);
    expect(opened).toEqual([
      "/admin/api/platform/tenant-support-case/export?tenantId=tenant-a&format=csv",
    ]);
  });

  it("maps old owner-v4 runtime and governance actions to real backend endpoints", async () => {
    const actions = [
      ["createPlatformServer", "/owner/api/platform/server"],
      ["reissueRuntimeToken", "/owner/api/platform/agent-provision"],
      ["resetRuntimeBinding", "/owner/api/platform/agent-device/revoke"],
      ["revokeRuntime", "/owner/api/platform/agent-runtime/revoke"],
      ["updateControlPanelEnv", "/owner/api/control-panel/env"],
      ["upsertAdminUser", "/owner/api/auth/user"],
      ["runPlatformAutomation", "/admin/api/platform/automation/run"],
    ];

    for (const [actionKey, endpoint] of actions) {
      expect(OWNER_ACTIONS[actionKey].endpoint).toBe(endpoint);
    }
  });
});
