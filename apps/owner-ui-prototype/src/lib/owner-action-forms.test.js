import { describe, expect, it } from "vitest";
import {
  buildActionPayload,
  getActionForm,
  getInitialActionValues,
} from "./owner-action-forms.js";

describe("owner-action-forms", () => {
  it("exposes forms for actions that require backend payloads", () => {
    expect(getActionForm("createTenant")?.fields.map((field) => field.name)).toEqual(["name", "slug"]);
    expect(getActionForm("restartOwnerRuntime")?.danger).toBe(true);
    expect(getActionForm("createRestorePoint")?.fields.map((field) => field.name)).toEqual(["note", "includeSnapshot"]);
    expect(getActionForm("runMonitoring")?.fields.map((field) => field.name)).toEqual(["source", "scope"]);
    expect(getActionForm("openSupportCase")?.fields.map((field) => field.name)).toEqual(["tenantId", "format"]);
  });

  it("builds comma-separated list payloads for bulk endpoints", () => {
    expect(buildActionPayload("acknowledgeNotifications", { ids: "a, b, , c" })).toEqual({
      ids: ["a", "b", "c"],
    });
    expect(buildActionPayload("restartOwnerRuntime", { services: "owner-web, admin-web", confirmText: "RESTART" })).toEqual({
      services: ["owner-web", "admin-web"],
      confirmText: "RESTART",
    });
  });

  it("presets confirmation defaults for dangerous forms", () => {
    expect(getInitialActionValues("confirmRestore").confirmText).toBe("RESTORE");
    expect(getInitialActionValues("restartOwnerRuntime").confirmText).toBe("RESTART");
  });
});
