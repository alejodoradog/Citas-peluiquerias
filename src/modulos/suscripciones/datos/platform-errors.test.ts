import { describe, expect, it } from "vitest";
import { toPlatformRefusal } from "./platform-errors";

describe("toPlatformRefusal", () => {
  it("reads the hint of Reactivar first", () => {
    expect(
      toPlatformRefusal({
        code: "23514",
        hint: "subscription_payment_required",
      }),
    ).toBe("payment_required");
  });

  it("says a payment is already registered (task 5.4b, M1)", () => {
    expect(
      toPlatformRefusal({ code: "23505", hint: "payment_already_registered" }),
    ).toBe("already_registered");
    expect(
      toPlatformRefusal({ code: "22023", hint: "payment_day_out_of_range" }),
    ).toBe("invalid");
  });

  it("maps the SQL states the functions raise", () => {
    expect(toPlatformRefusal({ code: "42501" })).toBe("not_allowed");
    expect(toPlatformRefusal({ code: "P0002" })).toBe("not_found");
    expect(toPlatformRefusal({ code: "22023" })).toBe("invalid");
    expect(toPlatformRefusal({ code: "23514", hint: null })).toBe("invalid");
    expect(toPlatformRefusal({ code: "08006" })).toBe("unknown");
    expect(toPlatformRefusal({})).toBe("unknown");
  });
});
