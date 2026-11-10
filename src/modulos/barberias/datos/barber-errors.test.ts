import { describe, expect, it } from "vitest";
import { toBarberFieldError } from "./barber-errors";

const check = (constraint: string) => ({
  code: "23514",
  message: `new row for relation "barbers" violates check constraint "${constraint}"`,
});

describe("toBarberFieldError", () => {
  it.each([
    ["barbers_display_name_check", "displayName", "invalid"],
    ["barbers_email_check", "email", "email_invalid"],
    ["barbers_notifications_need_email", "email", "notifications_need_email"],
    ["barbers_photo_in_own_folder", "photo", "photo_invalid"],
  ])("maps %s to its field", (constraint, field, code) => {
    expect(toBarberFieldError(check(constraint))).toEqual({ field, code });
  });

  it("leaves other checks and other errors alone", () => {
    expect(toBarberFieldError(check("barbers_other_check"))).toBeNull();
    expect(
      toBarberFieldError({ code: "42501", message: "permission denied" }),
    ).toBeNull();
    expect(toBarberFieldError({})).toBeNull();
  });
});
