import { describe, expect, it } from "vitest";
import { summarizeBarber, summarizeBarberHours } from "./barber-summary";

const active = {
  uses_barbershop_hours: true,
  deactivated_at: null,
  service_ids: ["a", "b", "c"],
};

describe("summarizeBarber", () => {
  it("sums up an active barber with the access to their agenda (task 7.6c)", () => {
    expect(summarizeBarber(active, "active")).toBe(
      "Horario del establecimiento · 3 servicios · con acceso",
    );
  });

  it("says when they have their own hours, one service, and each state of the access", () => {
    expect(
      summarizeBarber(
        { ...active, uses_barbershop_hours: false, service_ids: ["a"] },
        "no_email",
      ),
    ).toBe("Horario propio · 1 servicio · sin correo");
    expect(summarizeBarber(active, "not_invited")).toMatch(/ · sin invitar$/);
    expect(summarizeBarber(active, "invited")).toMatch(/ · invitado$/);
    expect(summarizeBarber(active, "expired")).toMatch(
      / · invitación vencida$/,
    );
    expect(summarizeBarber(active, "revoked")).toMatch(/ · sin acceso$/);
  });

  it("says nothing of the access of the owner who attends", () => {
    expect(summarizeBarber(active, null)).toBe(
      "Horario del establecimiento · 3 servicios",
    );
  });

  it("never mentions a link", () => {
    for (const kind of [
      "no_email",
      "inactive",
      "not_invited",
      "invited",
      "expired",
      "active",
      "revoked",
    ] as const) {
      expect(summarizeBarber(active, kind)).not.toMatch(/link/i);
    }
  });

  it("says since when an inactive barber is gone, in Bogotá", () => {
    expect(
      summarizeBarber(
        {
          ...active,
          // 9:00 p. m. of November 2 in Bogotá.
          deactivated_at: "2026-11-03T02:00:00+00:00",
        },
        "inactive",
      ),
    ).toBe("Se fue el 2 de noviembre · sin acceso");
  });
});

describe("summarizeBarberHours", () => {
  it("names the barbershop's hours", () => {
    expect(summarizeBarberHours(true, [])).toBe("Horario del establecimiento");
  });

  it("sums up their own week", () => {
    expect(
      summarizeBarberHours(false, [
        { weekday: 1, start: "09:00", end: "18:00" },
        { weekday: 2, start: "09:00", end: "18:00" },
      ]),
    ).toBe("Lun a mar 9:00 a. m. – 6:00 p. m.");
  });

  it("falls back to 'Horario propio' without shifts", () => {
    expect(summarizeBarberHours(false, [])).toBe("Horario propio");
  });
});
