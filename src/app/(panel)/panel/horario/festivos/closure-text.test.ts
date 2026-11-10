import { describe, expect, it } from "vitest";
import { closureTitle, holidayDay, holidayNames } from "./closure-text";

const at = (iso: string) => new Date(iso);

describe("closureTitle", () => {
  it.each([
    [
      "2026-12-24T19:00:00Z",
      "2026-12-25T05:00:00Z",
      "Jueves 24 de diciembre · desde 2:00 p. m.",
    ],
    [
      "2026-12-24T05:00:00Z",
      "2026-12-25T05:00:00Z",
      "Jueves 24 de diciembre · todo el día",
    ],
    [
      "2026-12-24T05:00:00Z",
      "2026-12-24T16:00:00Z",
      "Jueves 24 de diciembre · hasta 11:00 a. m.",
    ],
    [
      "2026-12-24T14:00:00Z",
      "2026-12-24T19:00:00Z",
      "Jueves 24 de diciembre · 9:00 a. m. – 2:00 p. m.",
    ],
    [
      "2026-12-31T05:00:00Z",
      "2027-01-03T05:00:00Z",
      "Del jueves 31 de diciembre al sábado 2 de enero",
    ],
    [
      "2026-12-24T23:00:00Z",
      "2026-12-26T16:00:00Z",
      "Del jueves 24 de diciembre, 6:00 p. m., al sábado 26 de diciembre, 11:00 a. m.",
    ],
    [
      "2026-12-24T23:00:00Z",
      "2026-12-27T05:00:00Z",
      "Del jueves 24 de diciembre, 6:00 p. m., al sábado 26 de diciembre, medianoche",
    ],
  ])("reads %s to %s as «%s»", (from, to, text) => {
    expect(closureTitle(at(from), at(to))).toBe(text);
  });
});

describe("holidays", () => {
  it("writes the day as the design does", () => {
    expect(holidayDay("2026-11-16")).toBe("Lunes 16 de noviembre");
  });

  it("names one holiday, or two on the same day", () => {
    expect(holidayNames(["cartagena_independence"])).toBe(
      "Independencia de Cartagena",
    );
    expect(holidayNames(["saints_peter_and_paul", "sacred_heart"])).toBe(
      "San Pedro y San Pablo · Sagrado Corazón",
    );
  });
});
