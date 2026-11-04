import { describe, expect, it } from "vitest";
import {
  parseSignIn,
  parseNewPassword,
  parseRecoveryRequest,
} from "./credentials";

describe("parseSignIn", () => {
  it("cleans the email and keeps the password as typed", () => {
    expect(
      parseSignIn({
        email: " Ana@Example.com ",
        password: " clave con espacios ",
      }),
    ).toEqual({
      success: true,
      data: { email: "ana@example.com", password: " clave con espacios " },
    });
  });

  it("asks for both fields", () => {
    expect(parseSignIn({ email: "x", password: "" })).toEqual({
      success: false,
      errors: { email: "email_invalid", password: "password_required" },
    });
  });
});

describe("parseRecoveryRequest", () => {
  it("accepts a valid email", () => {
    expect(parseRecoveryRequest({ email: "ana@example.com" })).toEqual({
      success: true,
      data: { email: "ana@example.com" },
    });
  });

  it("rejects an invalid email", () => {
    expect(parseRecoveryRequest({ email: "ana" }).success).toBe(false);
  });
});

describe("parseNewPassword", () => {
  it("accepts matching passwords", () => {
    expect(
      parseNewPassword({
        password: "nueva-clave-1",
        confirmation: "nueva-clave-1",
      }),
    ).toEqual({ success: true, data: { password: "nueva-clave-1" } });
  });

  it("rejects a short password", () => {
    expect(
      parseNewPassword({ password: "corta", confirmation: "corta" }),
    ).toEqual({ success: false, errors: { password: "password_too_short" } });
  });

  it("rejects passwords that do not match", () => {
    expect(
      parseNewPassword({
        password: "nueva-clave-1",
        confirmation: "nueva-clave-2",
      }),
    ).toEqual({
      success: false,
      errors: { confirmation: "password_mismatch" },
    });
  });
});
