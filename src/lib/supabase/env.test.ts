import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicSupabaseEnv, requireEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireEnv", () => {
  it("returns the value when it is set", () => {
    expect(requireEnv("SOME_VARIABLE", "value")).toBe("value");
  });

  it.each([undefined, ""])("names the variable when it is %j", (value) => {
    expect(() => requireEnv("SOME_VARIABLE", value)).toThrow("SOME_VARIABLE");
  });
});

describe("getPublicSupabaseEnv", () => {
  it("reads the public URL and key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");

    expect(getPublicSupabaseEnv()).toEqual({
      url: "http://localhost:54321",
      publishableKey: "public-key",
    });
  });

  it("fails when the public key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getPublicSupabaseEnv()).toThrow(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });
});
