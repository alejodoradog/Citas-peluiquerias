import { describe, expect, it } from "vitest";
import {
  getColombianHolidayList,
  getColombianHolidays,
  isColombianHoliday,
} from "./festivos";

// Expected dates come from published calendars, not from these rules:
// El Universal (2026 and 2027) and the Ministerio del Interior for 2026-07-13.
const HOLIDAYS_2026 = [
  "2026-01-01",
  "2026-01-12",
  "2026-03-23",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-18",
  "2026-06-08",
  "2026-06-15",
  "2026-06-29",
  "2026-07-13",
  "2026-07-20",
  "2026-08-07",
  "2026-08-17",
  "2026-10-12",
  "2026-11-02",
  "2026-11-16",
  "2026-12-08",
  "2026-12-25",
];

const HOLIDAYS_2027 = [
  "2027-01-01",
  "2027-01-11",
  "2027-03-22",
  "2027-03-25",
  "2027-03-26",
  "2027-05-01",
  "2027-05-10",
  "2027-05-31",
  "2027-06-07",
  "2027-07-05",
  "2027-07-12",
  "2027-07-20",
  "2027-08-07",
  "2027-08-16",
  "2027-10-18",
  "2027-11-01",
  "2027-11-15",
  "2027-12-08",
  "2027-12-25",
];

describe("getColombianHolidays", () => {
  it("matches the published 2026 calendar", () => {
    expect(getColombianHolidays(2026)).toEqual(HOLIDAYS_2026);
  });

  it("matches the published 2027 calendar, with Easter in March", () => {
    expect(getColombianHolidays(2027)).toEqual(HOLIDAYS_2027);
  });

  it("leaves out the Chiquinquirá holiday before Ley 2578 of 2026", () => {
    const holidays = getColombianHolidays(2025);

    expect(holidays).toHaveLength(18);
    expect(holidays).not.toContain("2025-07-14");
  });
});

describe("isColombianHoliday", () => {
  it("keeps a movable holiday that already falls on Monday", () => {
    expect(isColombianHoliday("2027-11-01")).toBe(true);
  });

  it("moves a holiday to the next Monday, leaving its original date free", () => {
    expect(isColombianHoliday("2026-01-12")).toBe(true);
    expect(isColombianHoliday("2026-01-06")).toBe(false);
  });

  it("does not move a fixed holiday that falls on a weekend", () => {
    expect(isColombianHoliday("2027-05-01")).toBe(true);
    expect(isColombianHoliday("2027-05-03")).toBe(false);
  });

  it("is false for an ordinary day", () => {
    expect(isColombianHoliday("2026-11-03")).toBe(false);
  });
});

describe("getColombianHolidayList", () => {
  it("names each 2026 holiday with a stable key, in date order", () => {
    expect(getColombianHolidayList(2026)).toEqual([
      { date: "2026-01-01", keys: ["new_year"] },
      { date: "2026-01-12", keys: ["epiphany"] },
      { date: "2026-03-23", keys: ["saint_joseph"] },
      { date: "2026-04-02", keys: ["holy_thursday"] },
      { date: "2026-04-03", keys: ["good_friday"] },
      { date: "2026-05-01", keys: ["labor_day"] },
      { date: "2026-05-18", keys: ["ascension"] },
      { date: "2026-06-08", keys: ["corpus_christi"] },
      { date: "2026-06-15", keys: ["sacred_heart"] },
      { date: "2026-06-29", keys: ["saints_peter_and_paul"] },
      { date: "2026-07-13", keys: ["chiquinquira"] },
      { date: "2026-07-20", keys: ["independence_day"] },
      { date: "2026-08-07", keys: ["battle_of_boyaca"] },
      { date: "2026-08-17", keys: ["assumption"] },
      { date: "2026-10-12", keys: ["columbus_day"] },
      { date: "2026-11-02", keys: ["all_saints"] },
      { date: "2026-11-16", keys: ["cartagena_independence"] },
      { date: "2026-12-08", keys: ["immaculate_conception"] },
      { date: "2026-12-25", keys: ["christmas"] },
    ]);
  });

  it("gives the 2027 dates the same keys", () => {
    const list = getColombianHolidayList(2027);

    expect(list.map((holiday) => holiday.date)).toEqual(HOLIDAYS_2027);
    expect(list.find((holiday) => holiday.date === "2027-03-25")).toEqual({
      date: "2027-03-25",
      keys: ["holy_thursday"],
    });
    expect(list.find((holiday) => holiday.date === "2027-11-15")).toEqual({
      date: "2027-11-15",
      keys: ["cartagena_independence"],
    });
  });

  it("keeps one row for two holidays moved to the same Monday", () => {
    // 2025: Saints Peter and Paul (Sunday the 29th) and the Sacred Heart.
    const list = getColombianHolidayList(2025);

    expect(list.filter((holiday) => holiday.date === "2025-06-30")).toEqual([
      { date: "2025-06-30", keys: ["saints_peter_and_paul", "sacred_heart"] },
    ]);
    expect(new Set(list.map((holiday) => holiday.date)).size).toBe(
      list.length,
    );
  });
});
