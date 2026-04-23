import { describe, expect, it } from "vitest";
import { shouldPromptForOwnerOtp } from "./OwnerLoginPage.jsx";

describe("OwnerLoginPage OTP prompt state", () => {
  it("hides the OTP field again when the backend no longer requires OTP", () => {
    expect(shouldPromptForOwnerOtp({ ok: false, requiresOtp: true })).toBe(true);
    expect(shouldPromptForOwnerOtp({ ok: false, requiresOtp: false })).toBe(false);
    expect(shouldPromptForOwnerOtp({ ok: true })).toBe(false);
  });
});
