import { describe, expect, it } from "vitest";
import { toServiceFieldError } from "./service-errors";

const violates = (constraint: string) => ({
  code: "23514",
  message: `new row for relation "services" violates check constraint "${constraint}"`,
});

describe("toServiceFieldError", () => {
  it("points each check of services to its field", () => {
    expect(toServiceFieldError(violates("services_price_cop_check"))).toEqual({
      field: "price",
      code: "service_price_invalid",
    });
    expect(
      toServiceFieldError(violates("services_duration_minutes_check")),
    ).toEqual({ field: "duration", code: "service_duration_invalid" });
    expect(toServiceFieldError(violates("services_name_check"))).toEqual({
      field: "name",
      code: "invalid",
    });
  });

  it("leaves other checks and other errors to the caller", () => {
    expect(toServiceFieldError(violates("another_check"))).toBeNull();
    expect(
      toServiceFieldError({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toBeNull();
    expect(toServiceFieldError({})).toBeNull();
  });
});
