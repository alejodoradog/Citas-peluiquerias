import { describe, expect, it } from "vitest";
import { toBookingRefusal } from "./booking-errors";

describe("toBookingRefusal", () => {
  it.each([
    "slot_taken",
    "blocked",
    "outside_hours",
    "closed",
    "booking_notice",
    "outside_booking_window",
    "slot_invalid",
    "barber_unavailable",
    "barber_inactive",
  ])("sends the customer back to choose a time on %s", (hint) => {
    expect(toBookingRefusal({ code: "P0001", hint })).toBe("slot_gone");
  });

  it("treats the exclusion constraint as a taken slot", () => {
    expect(toBookingRefusal({ code: "23P01" })).toBe("slot_gone");
  });

  it("knows a barbershop that takes no bookings", () => {
    expect(toBookingRefusal({ hint: "not_accepting" })).toBe("not_accepting");
  });

  it.each(["service_inactive", "services_required", "booking_too_long"])(
    "asks to choose the services again on %s",
    (hint) => {
      expect(toBookingRefusal({ hint })).toBe("services_changed");
    },
  );

  it("reports refused customer details", () => {
    expect(toBookingRefusal({ hint: "customer_email_invalid" })).toBe(
      "customer_invalid",
    );
  });

  it("is unknown for anything else", () => {
    expect(toBookingRefusal({ hint: "token_invalid" })).toBe("unknown");
    expect(toBookingRefusal({})).toBe("unknown");
    expect(toBookingRefusal({ hint: null, code: "08006" })).toBe("unknown");
  });
});
