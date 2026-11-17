import { describe, expect, it } from "vitest";
import { clashLines } from "./clash-message";

// Task 7.7, decision D5: a walk-in that does not fit says with what it
// clashes and how much time is free. 20:30 UTC is 3:30 p. m. in Bogotá.
const AT = new Date("2026-11-16T20:30:00Z");

describe("clashLines", () => {
  it("speaks to the professional about their own appointment", () => {
    expect(
      clashLines(
        { kind: "appointment", at: AT, freeMinutes: 20, neededMinutes: 40 },
        null,
        1,
      ),
    ).toEqual([
      "Tienes una cita a las 3:30 p. m.",
      "Tienes 20 minutos libres; este servicio dura 40.",
    ]);
  });
  it("names the professional in the owner's screen", () => {
    expect(
      clashLines(
        { kind: "block", at: AT, freeMinutes: 1, neededMinutes: 45 },
        "Juan",
        2,
      ),
    ).toEqual([
      "Juan tiene un bloqueo desde las 3:30 p. m.",
      "Juan tiene 1 minuto libre; estos servicios duran 45.",
    ]);
  });
  it("says when the establishment closes or the hours end", () => {
    expect(
      clashLines(
        { kind: "closure", at: AT, freeMinutes: 15, neededMinutes: 30 },
        null,
        1,
      )[0],
    ).toBe("El establecimiento cierra desde las 3:30 p. m.");
    expect(
      clashLines(
        { kind: "closing", at: AT, freeMinutes: 5, neededMinutes: 30 },
        null,
        1,
      )[0],
    ).toBe("Tu horario termina a las 3:30 p. m.");
    expect(
      clashLines(
        { kind: "closing", at: AT, freeMinutes: 5, neededMinutes: 30 },
        "Ana",
        1,
      )[0],
    ).toBe("El horario de Ana termina a las 3:30 p. m.");
  });
  it("with no time free, says so", () => {
    expect(
      clashLines(
        { kind: "closed", at: null, freeMinutes: 0, neededMinutes: 30 },
        null,
        1,
      ),
    ).toEqual([
      "No atiendes a esta hora.",
      "No tienes tiempo libre ahora; este servicio dura 30.",
    ]);
    expect(
      clashLines(
        { kind: "appointment", at: AT, freeMinutes: 0, neededMinutes: 30 },
        "Ana",
        1,
      )[1],
    ).toBe("Ana no tiene tiempo libre ahora; este servicio dura 30.");
  });
  it("without a detail, a general line", () => {
    expect(clashLines(null, null, 1)).toEqual(["Esa hora ya está ocupada."]);
  });
});
