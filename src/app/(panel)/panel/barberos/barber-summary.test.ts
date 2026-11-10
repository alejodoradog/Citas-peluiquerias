import { describe, expect, it } from "vitest";
import { summarizeBarber, summarizeBarberHours } from "./barber-summary";

const active = {
  is_owner: false,
  uses_barbershop_hours: true,
  link_active: true,
  deactivated_at: null,
  service_ids: ["a", "b", "c"],
};

describe("summarizeBarber", () => {
  it("sums up an active barber", () => {
    expect(summarizeBarber(active)).toBe(
      "Horario de la barbería · 3 servicios · Link activo",
    );
  });

  it("says when they have their own hours, one service or no link", () => {
    expect(
      summarizeBarber({
        ...active,
        uses_barbershop_hours: false,
        link_active: false,
        service_ids: ["a"],
      }),
    ).toBe("Horario propio · 1 servicio · Link desactivado");
  });

  it("tells the owner they have no link", () => {
    expect(summarizeBarber({ ...active, is_owner: true })).toBe(
      "Horario de la barbería · 3 servicios · sin link (eres tú)",
    );
  });

  it("says since when an inactive barber is gone, in Bogotá", () => {
    expect(
      summarizeBarber({
        ...active,
        // 9:00 p. m. of November 2 in Bogotá.
        deactivated_at: "2026-11-03T02:00:00+00:00",
      }),
    ).toBe("Se fue el 2 de noviembre · Link activo");
  });
});

describe("summarizeBarberHours", () => {
  it("names the barbershop's hours", () => {
    expect(summarizeBarberHours(true, [])).toBe("Horario de la barbería");
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
