import { describe, expect, it } from "vitest";
import {
  OWNER_LOGIN_PATH,
  OWNER_PAGE_KEYS,
  OWNER_PAGE_PATHS,
  buildOwnerPagePath,
  resolveOwnerRouteFromPath,
  resolveOwnerPageFromPath,
  resolveOwnerPrototypeRoute,
} from "./owner-routes.js";

describe("owner-routes", () => {
  it("keeps the owner login surface separate from the dashboard surface", () => {
    expect(resolveOwnerPrototypeRoute("/")).toBe("dashboard");
    expect(resolveOwnerPrototypeRoute(OWNER_LOGIN_PATH)).toBe("login");
  });

  it("accepts a trailing slash for the login surface", () => {
    expect(resolveOwnerPrototypeRoute("/login/")).toBe("login");
    expect(resolveOwnerPrototypeRoute("/owner/login/")).toBe("login");
  });

  it("defines a stable URL path for every owner page", () => {
    expect(OWNER_PAGE_KEYS).toEqual([
      "overview",
      "tenants",
      "create-tenant",
      "tenant-dossier",
      "packages",
      "package-detail",
      "billing",
      "invoice-detail",
      "payment-attempt-detail",
      "subscriptions",
      "subscription-detail",
      "fleet",
      "fleet-diagnostics",
      "runtime-detail",
      "observability",
      "diagnostics-evidence",
      "incidents",
      "support",
      "support-context",
      "recovery",
      "backup-detail",
      "security",
      "access-posture",
      "settings",
      "platform-controls",
      "automation",
    ]);

    for (const page of OWNER_PAGE_KEYS) {
      expect(OWNER_PAGE_PATHS[page]).toBe(`/${page}`);
      expect(buildOwnerPagePath(page)).toBe(`/${page}`);
      expect(resolveOwnerPageFromPath(`/${page}`)).toBe(page);
    }
  });

  it("uses overview for root and unknown page paths", () => {
    expect(resolveOwnerPageFromPath("/")).toBe("overview");
    expect(resolveOwnerPageFromPath("/unknown")).toBe("overview");
    expect(buildOwnerPagePath("missing")).toBe("/overview");
  });

  it("supports detail URLs with selected record ids", () => {
    expect(resolveOwnerRouteFromPath("/tenant-dossier/tenant-a")).toEqual({
      page: "tenant-dossier",
      recordId: "tenant-a",
    });
    expect(resolveOwnerRouteFromPath("/billing/invoices/inv-42")).toEqual({
      page: "invoice-detail",
      recordId: "inv-42",
    });
    expect(resolveOwnerRouteFromPath("/fleet/runtime/runtime-7")).toEqual({
      page: "runtime-detail",
      recordId: "runtime-7",
    });
    expect(buildOwnerPagePath("tenant-dossier", "tenant-a")).toBe("/tenant-dossier/tenant-a");
    expect(buildOwnerPagePath("invoice-detail", "inv-42")).toBe("/billing/invoices/inv-42");
    expect(buildOwnerPagePath("runtime-detail", "runtime-7")).toBe("/fleet/runtime/runtime-7");
  });

  it("keeps legacy owner-web URLs usable inside the new owner prototype", () => {
    expect(resolveOwnerRouteFromPath("/owner")).toEqual({ page: "overview", recordId: "" });
    expect(resolveOwnerRouteFromPath("/owner/runtime")).toEqual({ page: "fleet", recordId: "" });
    expect(resolveOwnerRouteFromPath("/owner/billing/attempts")).toEqual({ page: "billing", recordId: "" });
    expect(resolveOwnerRouteFromPath("/owner/tenants/tenant-a")).toEqual({
      page: "tenant-dossier",
      recordId: "tenant-a",
    });
    expect(resolveOwnerRouteFromPath("/owner/billing/invoice/inv-42")).toEqual({
      page: "invoice-detail",
      recordId: "inv-42",
    });
    expect(resolveOwnerRouteFromPath("/owner/runtime/agents-bots/runtime-7")).toEqual({
      page: "runtime-detail",
      recordId: "runtime-7",
    });
  });
});
