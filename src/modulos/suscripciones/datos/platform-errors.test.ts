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

  it("maps the SQL states the functions raise", () => {
    expect(toPlatformRefusal({ code: "42501" })).toBe("not_allowed");
    expect(toPlatformRefusal({ code: "P0002" })).toBe("not_found");
    expect(toPlatformRefusal({ code: "22023" })).toBe("invalid");
    expect(toPlatformRefusal({ code: "23514", hint: null })).toBe("invalid");
    expect(toPlatformRefusal({ code: "08006" })).toBe("unknown");
    expect(toPlatformRefusal({})).toBe("unknown");
  });
});
