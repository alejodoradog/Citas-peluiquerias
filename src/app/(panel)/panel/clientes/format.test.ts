import { describe, expect, it } from "vitest";
import { customerSince, noShowSentence, shortDay, timeOf } from "./format";

// 2026-11-11 21:00 in Bogotá.
const now = new Date("2026-11-12T02:00:00Z");
// hh:mm in Bogotá on a day of 2026.
const at = (date: string, time: string) => new Date(`${date}T${time}:00-05:00`);

describe("the days of D-40 and D-41", () => {
  it("writes today, a day of this year and one of another", () => {
    expect(shortDay(at("2026-11-11", "10:20"), now)).toBe("hoy");
    expect(shortDay(at("2026-10-24", "17:00"), now)).toBe("24 oct");
    expect(shortDay(at("2025-12-03", "09:00"), now)).toBe("3 dic 2025");
  });

  it("writes the time as the design does", () => {
    expect(timeOf(at("2026-11-11", "16:00"))).toBe("4:00 p. m.");
    expect(timeOf(at("2026-11-11", "10:20"))).toBe("10:20 a. m.");
  });

  it("says since when, with the month in full", () => {
    expect(customerSince(at("2026-08-14", "12:00"))).toBe(
      "Cliente desde agosto 2026",
    );
  });
});

describe("the no-show alert of D-41", () => {
  const tail = "Puedes pedirle un abono antes de su próxima cita.";

  it("names two days as the design does", () => {
    expect(
      noShowSentence(
        [at("2026-11-07", "10:00"), at("2026-10-12", "11:00")],
        now,
      ),
    ).toBe(`No llegó el 7 de nov ni el 12 de oct. ${tail}`);
  });

  it("lists three, with today and another year", () => {
    expect(
      noShowSentence(
        [
          at("2026-11-11", "10:00"),
          at("2026-10-12", "11:00"),
          at("2025-12-03", "11:00"),
        ],
        now,
      ),
    ).toBe(`No llegó hoy, el 12 de oct ni el 3 de dic de 2025. ${tail}`);
  });

  it("counts the rest after three", () => {
    const days = [
      at("2026-11-07", "10:00"),
      at("2026-10-12", "11:00"),
      at("2026-09-02", "11:00"),
      at("2026-08-02", "11:00"),
      at("2026-07-02", "11:00"),
    ];
    expect(noShowSentence(days, now)).toBe(
      `No llegó el 7 de nov, el 12 de oct, el 2 de sep ni otras 2 veces. ${tail}`,
    );
    expect(noShowSentence(days.slice(0, 4), now)).toBe(
      `No llegó el 7 de nov, el 12 de oct, el 2 de sep ni otra vez. ${tail}`,
    );
  });

  it("names a single day", () => {
    expect(noShowSentence([at("2026-11-07", "10:00")], now)).toBe(
      `No llegó el 7 de nov. ${tail}`,
    );
  });
});
