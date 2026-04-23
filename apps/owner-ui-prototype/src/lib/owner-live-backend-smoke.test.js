import { describe, expect, it, vi } from "vitest";

import { fetchEndpoint, isReadOnlyEndpoint } from "../../scripts/verify-owner-live-backend.cjs";

describe("owner live backend smoke verifier", () => {
  it("times out a slow endpoint without hanging the full smoke run", async () => {
    const fetchImpl = vi.fn((_url, options = {}) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));

    const result = await fetchEndpoint(
      { key: "slow.endpoint", path: "/owner/api/slow" },
      "scum_admin_session=test",
      {
        baseUrl: "http://127.0.0.1:5177",
        fetchImpl,
        timeoutMs: 10,
      },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.key).toBe("slow.endpoint");
    expect(result.path).toBe("/owner/api/slow");
    expect(result.status).toBe(0);
    expect(result.ok).toBe(false);
    expect(result.parseableJson).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });

  it("excludes live stream endpoints from JSON smoke checks", () => {
    expect(isReadOnlyEndpoint({ key: "overview.live", path: "/admin/api/live" })).toBe(false);
  });
});
