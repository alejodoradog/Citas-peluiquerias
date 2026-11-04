import { describe, expect, it } from "vitest";
import { toAccountError } from "./auth-errors";

describe("toAccountError", () => {
  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["user_already_exists", "email_taken"],
    ["email_exists", "email_taken"],
    ["over_request_rate_limit", "rate_limited"],
    ["over_email_send_rate_limit", "rate_limited"],
    ["weak_password", "weak_password"],
    ["same_password", "same_password"],
    ["otp_expired", "link_expired"],
    ["session_not_found", "link_expired"],
    ["unexpected_failure", "unknown"],
  ])("maps %s to %s", (code, expected) => {
    expect(toAccountError({ code })).toBe(expected);
  });

  it("treats errors without a code as unknown", () => {
    expect(toAccountError({})).toBe("unknown");
  });
});
