import { describe, expect, it } from "vitest";
import { resolveOwnerProxyTarget } from "../../vite.config.js";

describe("owner-ui vite config", () => {
  it("defaults the API proxy to the running admin backend instead of the optional owner-web surface", () => {
    expect(resolveOwnerProxyTarget({})).toBe("http://127.0.0.1:3200");
  });

  it("keeps explicit owner UI proxy overrides for dedicated owner-web runs", () => {
    expect(resolveOwnerProxyTarget({ OWNER_UI_PROXY_TARGET: "http://127.0.0.1:3201" })).toBe(
      "http://127.0.0.1:3201",
    );
  });
});
