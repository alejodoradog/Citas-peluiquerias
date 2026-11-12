import { describe, expect, it } from "vitest";
import { toBarberRefusal } from "./barber-errors";

describe("toBarberRefusal", () => {
  it("keeps the hints the screens react to", () => {
    for (const hint of [
      "link_invalid",
      "read_only",
      "not_yours",
      "not_confirmed",
      "too_early",
      "barber_inactive",
      "overlaps_appointment",
      "overlaps_block",
      "range_invalid",
    ]) {
      expect(toBarberRefusal({ hint })).toBe(hint);
    }
  });

  it("turns anything else into unknown", () => {
    expect(toBarberRefusal({ hint: "status_invalid" })).toBe("unknown");
    expect(toBarberRefusal({ code: "08006" })).toBe("unknown");
    expect(toBarberRefusal({ hint: null })).toBe("unknown");
  });
});
