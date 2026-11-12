import { describe, expect, it } from "vitest";
import { toManageRefusal } from "./manage-errors";

describe("toManageRefusal", () => {
  it("maps the hints of add_manage_appointment", () => {
    expect(toManageRefusal({ hint: "link_invalid" })).toBe("link_invalid");
    expect(toManageRefusal({ hint: "too_late" })).toBe("too_late");
    expect(toManageRefusal({ hint: "not_accepting" })).toBe("not_accepting");
    expect(toManageRefusal({ hint: "same_time" })).toBe("same_time");
    expect(toManageRefusal({ hint: "services_changed" })).toBe(
      "services_changed",
    );
  });

  it("treats every reason the new time cannot be booked as taken", () => {
    for (const hint of [
      "slot_taken",
      "blocked",
      "outside_hours",
      "closed",
      "booking_notice",
      "outside_booking_window",
      "slot_invalid",
      "barber_inactive",
    ]) {
      expect(toManageRefusal({ hint })).toBe("slot_gone");
    }
    expect(toManageRefusal({ code: "23P01" })).toBe("slot_gone");
  });

  it("anything else is unknown", () => {
    expect(toManageRefusal({})).toBe("unknown");
    expect(toManageRefusal({ hint: null, code: "08006" })).toBe("unknown");
  });
});
