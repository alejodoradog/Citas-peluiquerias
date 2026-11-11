import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The query listSetAsideLinks builds, recorded call by call.
const calls: [string, ...unknown[]][] = [];
let rows: { slug: string; retired_at: string }[] = [];
const query = {
  select: (...args: unknown[]) => (calls.push(["select", ...args]), query),
  eq: (...args: unknown[]) => (calls.push(["eq", ...args]), query),
  gt: (...args: unknown[]) => (calls.push(["gt", ...args]), query),
  order: (...args: unknown[]) => (calls.push(["order", ...args]), query),
  then: (resolve: (value: unknown) => unknown) =>
    resolve({ data: rows, error: null }),
};
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (...args: unknown[]) => (calls.push(["from", ...args]), query),
  }),
}));
vi.mock("@/lib/fechas/fechas", () => ({
  now: () => new Date("2026-11-10T22:00:00Z"),
}));

const { bookingLinkWriteError, listSetAsideLinks } =
  await import("./booking-link");

describe("listSetAsideLinks", () => {
  it("lists the barbershop's links left less than 90 days ago, newest first, with until when", async () => {
    calls.length = 0;
    rows = [{ slug: "la-esquina", retired_at: "2026-11-10T21:00:00+00:00" }];
    expect(await listSetAsideLinks("shop-1")).toEqual([
      { slug: "la-esquina", until: new Date("2027-02-08T21:00:00Z") },
    ]);
    expect(calls).toEqual([
      ["from", "barbershop_slug_history"],
      ["select", "slug, retired_at"],
      ["eq", "barbershop_id", "shop-1"],
      ["gt", "retired_at", "2026-08-12T22:00:00.000Z"],
      ["order", "retired_at", { ascending: false }],
      ["order", "slug"],
    ]);
  });
});

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
