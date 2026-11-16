import { describe, expect, it } from "vitest";
import { toWalkInFailure } from "./walk-in-errors";

// Task 7.7: the hints of the walk-in functions, as the screen reacts to them.
describe("toWalkInFailure", () => {
  it("a clash carries its detail", () => {
    expect(
      toWalkInFailure({
        hint: "walk_in_clash",
        details:
          '{"kind": "closure", "at": "2026-11-16T22:00:00+00:00", "until": null, "freeMinutes": 15, "neededMinutes": 30}',
      }),
    ).toEqual({
      error: "walk_in_clash",
      clash: {
        kind: "closure",
        at: new Date("2026-11-16T22:00:00Z"),
        freeMinutes: 15,
        neededMinutes: 30,
      },
    });
  });
  it("a clash without a readable detail is still a clash", () => {
    expect(toWalkInFailure({ hint: "walk_in_clash", details: "?" })).toEqual({
      error: "walk_in_clash",
      clash: null,
    });
  });
  it("passes the known hints", () => {
    for (const hint of [
      "not_professional",
      "read_only",
      "barber_inactive",
      "barber_not_found",
      "service_inactive",
      "customer_name_invalid",
      "not_found",
    ]) {
      expect(toWalkInFailure({ hint })).toEqual({ error: hint, clash: null });
    }
  });
  it("reads the paused trigger as read only, and the exclusion as taken", () => {
    expect(toWalkInFailure({ hint: "barbershop_read_only" }).error).toBe(
      "read_only",
    );
    expect(toWalkInFailure({ code: "23P01" }).error).toBe("slot_taken");
  });
  it("anything else is unknown", () => {
    expect(toWalkInFailure({ code: "42501", hint: null }).error).toBe(
      "unknown",
    );
  });
});
