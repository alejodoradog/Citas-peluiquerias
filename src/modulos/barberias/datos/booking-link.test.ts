import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({}));

const { bookingLinkWriteError } = await import("./booking-link");

describe("bookingLinkWriteError", () => {
  it("reads a link another barbershop uses or left as taken", () => {
    // barbershops_slug_key, and guard_barbershop_slug for a link set aside.
    expect(bookingLinkWriteError({ code: "23505", hint: null })).toBe(
      "slug_taken",
    );
    expect(bookingLinkWriteError({ code: "23505", hint: "slug_taken" })).toBe(
      "slug_taken",
    );
  });

  it("reads the limit of changes (P11)", () => {
    expect(
      bookingLinkWriteError({ code: "23514", hint: "slug_change_limit" }),
    ).toBe("slug_change_limit");
  });

  it("reads anything else as unknown", () => {
    for (const error of [
      { code: "23514", hint: null },
      { code: "42501" },
      { code: "PGRST301" },
      {},
    ]) {
      expect(bookingLinkWriteError(error)).toBe("unknown");
    }
  });
});
