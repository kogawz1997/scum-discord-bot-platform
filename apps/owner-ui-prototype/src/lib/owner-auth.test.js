import { describe, expect, it } from "vitest";
import {
  buildOwnerLoginRedirect,
  getOwnerSession,
  loginOwner,
  logoutOwner,
  resolvePostLoginPath,
} from "./owner-auth.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? "Unauthorized" : status === 400 ? "Bad Request" : "OK",
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

describe("owner-auth", () => {
  it("posts owner login credentials through the isolated owner proxy route", async () => {
    const calls = [];
    const result = await loginOwner(
      { username: "owner", password: "secret" },
      {
        fetchImpl: async (path, options) => {
          calls.push({ path, options });
          return jsonResponse(200, { ok: true, data: { user: "owner", role: "owner" } });
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(calls[0].path).toBe("/owner/api/login");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.credentials).toBe("include");
    expect(JSON.parse(calls[0].options.body)).toEqual({
      username: "owner",
      password: "secret",
    });
  });

  it("includes otp only when the operator provides it", async () => {
    const calls = [];
    await loginOwner(
      { username: "owner", password: "secret", otp: "123456" },
      {
        fetchImpl: async (path, options) => {
          calls.push({ path, options });
          return jsonResponse(200, { ok: true, data: { user: "owner" } });
        },
      },
    );

    expect(JSON.parse(calls[0].options.body)).toEqual({
      username: "owner",
      password: "secret",
      otp: "123456",
    });
  });

  it("blocks empty credentials before calling the backend", async () => {
    let called = false;
    const result = await loginOwner(
      { username: "", password: "" },
      {
        fetchImpl: async () => {
          called = true;
          return jsonResponse(400, { ok: false, error: "Invalid request payload" });
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/username/i);
    expect(called).toBe(false);
  });

  it("surfaces backend auth errors and otp-required state", async () => {
    const result = await loginOwner(
      { username: "owner", password: "secret" },
      {
        fetchImpl: async () => jsonResponse(401, { ok: false, error: "OTP required", requiresOtp: true }),
      },
    );

    expect(result.ok).toBe(false);
    expect(result.requiresOtp).toBe(true);
    expect(result.error).toBe("OTP required");
  });

  it("logs out through the owner proxy route with credentials", async () => {
    const calls = [];
    const result = await logoutOwner({
      fetchImpl: async (path, options) => {
        calls.push({ path, options });
        return jsonResponse(200, { ok: true, data: { loggedOut: true } });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0].path).toBe("/owner/api/logout");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.credentials).toBe("include");
  });

  it("checks the current owner session before allowing protected owner pages", async () => {
    const calls = [];
    const result = await getOwnerSession({
      fetchImpl: async (path, options) => {
        calls.push({ path, options });
        return jsonResponse(200, { ok: true, data: { user: "owner", role: "owner" } });
      },
    });

    expect(result.ok).toBe(true);
    expect(calls[0].path).toBe("/owner/api/me");
    expect(calls[0].options.method).toBe("GET");
    expect(calls[0].options.credentials).toBe("include");
  });

  it("builds a safe login redirect with the requested owner page preserved", () => {
    expect(buildOwnerLoginRedirect("/settings", "?tab=runtime")).toBe("/login?next=%2Fsettings%3Ftab%3Druntime");
    expect(buildOwnerLoginRedirect("/login", "")).toBe("/login");
  });

  it("resolves post-login next paths without allowing external redirects", () => {
    expect(resolvePostLoginPath("?next=%2Ffleet")).toBe("/fleet");
    expect(resolvePostLoginPath("?next=https%3A%2F%2Fevil.example")).toBe("/overview");
    expect(resolvePostLoginPath("?next=%2F%2Fevil.example")).toBe("/overview");
    expect(resolvePostLoginPath("?next=%2Flogin")).toBe("/overview");
  });
});
