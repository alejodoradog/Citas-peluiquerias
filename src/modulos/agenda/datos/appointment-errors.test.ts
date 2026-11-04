import { describe, expect, it } from "vitest";
import { toAppointmentWriteError } from "./appointment-errors";

describe("toAppointmentWriteError", () => {
  it("recognizes a slot another booking already took", () => {
    expect(
      toAppointmentWriteError({
        code: "23P01",
        message:
          'conflicting key value violates exclusion constraint "appointments_no_overlap"',
      }),
    ).toBe("slot_taken");
  });

  it("does not blame the slot for other exclusion constraints", () => {
    expect(
      toAppointmentWriteError({
        code: "23P01",
        message: 'violates exclusion constraint "another_constraint"',
      }),
    ).toBe("unknown");
  });

  it("treats any other database error as unknown", () => {
    expect(
      toAppointmentWriteError({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toBe("unknown");
    expect(toAppointmentWriteError({})).toBe("unknown");
  });
});
