import { describe, expect, it } from "vitest";
import { toBarberRefusal } from "./barber-errors";

describe("toBarberRefusal", () => {
  it("keeps the hints the screens react to", () => {
    for (const hint of [
      "not_professional",
      "read_only",
      "not_yours",
      "not_confirmed",
      "too_early",
      "barber_inactive",
      "overlaps_appointment",
      "overlaps_block",
      "already_closed",
      "range_invalid",
    ]) {
      expect(toBarberRefusal({ hint })).toBe(hint);
    }
  });

  it("reads a paused barbershop of the triggers of task 5.5 as read_only", () => {
    expect(toBarberRefusal({ hint: "barbershop_read_only" })).toBe("read_only");
  });

  it("turns anything else into unknown", () => {
    expect(toBarberRefusal({ hint: "status_invalid" })).toBe("unknown");
    // The private link went with task 7.6c: its refusal means nothing now.
    expect(toBarberRefusal({ hint: "link_invalid" })).toBe("unknown");
    expect(toBarberRefusal({ code: "08006" })).toBe("unknown");
    expect(toBarberRefusal({ hint: null })).toBe("unknown");
  });
});
