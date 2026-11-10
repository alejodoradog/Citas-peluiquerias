import { describe, expect, it } from "vitest";
import {
  HOLIDAY_WINDOW_DAYS,
  holidayWindow,
  parseHolidayOpenings,
  upcomingHolidays,
} from "./holidays";

describe("holidayWindow", () => {
  it("runs 12 months from today, today included", () => {
    expect(HOLIDAY_WINDOW_DAYS).toBe(365);
    expect(holidayWindow("2026-11-10")).toEqual({
      from: "2026-11-10",
      until: "2027-11-09",
    });
  });
});

describe("upcomingHolidays", () => {
  it("lists the holidays between both dates, across the new year", () => {
    expect(upcomingHolidays("2026-11-10", "2027-01-31")).toEqual([
      { date: "2026-11-16", keys: ["cartagena_independence"] },
      { date: "2026-12-08", keys: ["immaculate_conception"] },
      { date: "2026-12-25", keys: ["christmas"] },
      { date: "2027-01-01", keys: ["new_year"] },
      { date: "2027-01-11", keys: ["epiphany"] },
    ]);
  });

  it("includes holidays on either end", () => {
    expect(
      upcomingHolidays("2026-11-16", "2026-12-08").map((h) => h.date),
    ).toEqual(["2026-11-16", "2026-12-08"]);
  });

  it("covers a whole window: 19 holidays from November 2026", () => {
    const { from, until } = holidayWindow("2026-11-10");
    const list = upcomingHolidays(from, until);

    expect(list).toHaveLength(19);
    expect(list[0]!.date).toBe("2026-11-16");
    expect(list.at(-1)!.date).toBe("2027-11-01");
  });

  it("is empty when the end comes before the start", () => {
    expect(upcomingHolidays("2026-12-26", "2026-12-24")).toEqual([]);
  });
});

describe("parseHolidayOpenings", () => {
  const window = holidayWindow("2026-11-10");

  it("takes holidays of the window, sorted and without repeats", () => {
    expect(
      parseHolidayOpenings(["2026-12-25", "2026-11-16", "2026-12-25"], window),
    ).toEqual({ status: "valid", dates: ["2026-11-16", "2026-12-25"] });
  });

  it("takes none: every holiday closed", () => {
    expect(parseHolidayOpenings([], window)).toEqual({
      status: "valid",
      dates: [],
    });
  });

  it("drops a holiday that is already past, from a page opened yesterday", () => {
    expect(parseHolidayOpenings(["2026-11-02", "2026-11-16"], window)).toEqual({
      status: "valid",
      dates: ["2026-11-16"],
    });
  });

  it.each([
    ["an ordinary day", ["2026-11-17"]],
    ["a holiday after the window", ["2027-11-15"]],
    ["an impossible date", ["2026-02-30"]],
    ["a date in another format", ["16/11/2026"]],
    ["text", ["navidad"]],
    ["a non-string", [20261116]],
    ["far more dates than a year has", Array(61).fill("2026-11-16")],
  ])("refuses %s as tampered", (_, sent) => {
    expect(parseHolidayOpenings(sent, window)).toEqual({
      status: "malformed",
    });
  });
});
