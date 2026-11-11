import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { imageReservationError } = await import("./images");

describe("imageReservationError", () => {
  it("reads the quota of reserve_image_upload", () => {
    expect(imageReservationError({ code: "23514", hint: "image_quota" })).toBe(
      "quota",
    );
  });

  it.each([
    ["a refused path or account", { code: "42501", hint: null }],
    ["another check", { code: "23514", hint: null }],
    ["the hint with another code", { code: "42501", hint: "image_quota" }],
    ["no code", {}],
  ])("treats %s as a failure", (_case, error) => {
    expect(imageReservationError(error)).toBe("failed");
  });
});
