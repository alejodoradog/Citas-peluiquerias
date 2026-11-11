import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  addDays,
  formatBogotaDate,
  formatBogotaDayMonth,
  formatBogotaDayMonthYear,
  formatCalendarDay,
  formatMonthYear,
  formatShortWallClock,
  formatWallClock,
  formatBogotaTime,
  fromBogota,
  getWeekday,
  isBogotaDate,
  now,
  startOfBogotaDay,
  toBogotaDate,
  toBogotaTime,
} from "./fechas";

const SERVER_ZONES = [
  { zone: "UTC", offsetMinutes: 0 },
  { zone: "America/Bogota", offsetMinutes: 300 },
  { zone: "Asia/Tokyo", offsetMinutes: -540 },
];

describe.each(SERVER_ZONES)(
  "with the server in $zone",
  ({ zone, offsetMinutes }) => {
    beforeAll(() => {
      vi.stubEnv("TZ", zone);
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it("really runs in that zone", () => {
      expect(new Date(2026, 0, 1, 12).getTimezoneOffset()).toBe(offsetMinutes);
    });

    describe("day change", () => {
      it("is still the previous day one minute before midnight", () => {
        const instant = new Date("2026-11-03T04:59:00Z");

        expect(toBogotaDate(instant)).toBe("2026-11-02");
        expect(toBogotaTime(instant)).toBe("23:59");
      });

      it("is the new day at midnight", () => {
        const instant = new Date("2026-11-03T05:00:00Z");

        expect(toBogotaDate(instant)).toBe("2026-11-03");
        expect(toBogotaTime(instant)).toBe("00:00");
      });

      it("crosses the year boundary", () => {
        expect(toBogotaDate(new Date("2027-01-01T04:59:00Z"))).toBe(
          "2026-12-31",
        );
        expect(toBogotaDate(new Date("2027-01-01T05:00:00Z"))).toBe(
          "2027-01-01",
        );
      });
    });

    describe("fromBogota", () => {
      it("converts Colombian time to the UTC instant", () => {
        expect(fromBogota("2026-11-03", "14:30").toISOString()).toBe(
          "2026-11-03T19:30:00.000Z",
        );
      });

      it("moves late evening to the next UTC day", () => {
        expect(fromBogota("2026-12-31", "23:30").toISOString()).toBe(
          "2027-01-01T04:30:00.000Z",
        );
      });

      it("round-trips through a leap day", () => {
        const instant = fromBogota("2028-02-29", "00:00");

        expect(toBogotaDate(instant)).toBe("2028-02-29");
        expect(toBogotaTime(instant)).toBe("00:00");
      });

      it.each([
        ["2026-02-30", "10:00"],
        ["2026-02-29", "10:00"],
        ["2026-13-01", "10:00"],
        ["2026-1-1", "10:00"],
        ["2026-11-03", "24:00"],
        ["2026-11-03", "10:60"],
        ["2026-11-03", "9:00"],
        ["no-es-fecha", "10:00"],
      ])("rejects %s %s", (date, time) => {
        expect(() => fromBogota(date, time)).toThrow(RangeError);
      });
    });

    describe("startOfBogotaDay", () => {
      it("is midnight in Colombia, 05:00 UTC", () => {
        expect(startOfBogotaDay("2026-11-03").toISOString()).toBe(
          "2026-11-03T05:00:00.000Z",
        );
      });
    });

    describe("addDays", () => {
      it("crosses month and year boundaries", () => {
        expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
        expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
        expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
      });

      it("rejects an impossible date", () => {
        expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
      });
    });

    describe("getWeekday", () => {
      it("uses 0 for Sunday and 6 for Saturday", () => {
        expect(getWeekday("2026-11-01")).toBe(0);
        expect(getWeekday("2026-11-02")).toBe(1);
        expect(getWeekday("2026-11-07")).toBe(6);
      });
    });

    describe("formatting", () => {
      const instant = new Date("2026-11-03T04:59:00Z");

      it("shows the Colombian day in Spanish", () => {
        expect(formatBogotaDate(instant)).toBe("lunes, 2 de noviembre de 2026");
      });

      it("shows the Colombian time", () => {
        expect(formatBogotaTime(instant).replace(/\s/g, " ")).toBe(
          "11:59 p. m.",
        );
      });
    });
  },
);

describe("now", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the clock, which tests can fix", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T05:00:00Z"));

    expect(now().toISOString()).toBe("2026-11-03T05:00:00.000Z");
  });
});

describe("formatWallClock", () => {
  it.each([
    ["09:00", "9:00 a. m."],
    ["09:00:00", "9:00 a. m."],
    ["00:30", "12:30 a. m."],
    ["12:00", "12:00 p. m."],
    ["20:00", "8:00 p. m."],
    ["21:45", "9:45 p. m."],
  ])("reads %s as %s", (time, text) => {
    expect(formatWallClock(time)).toBe(text);
  });

  it("rejects text that is not a time", () => {
    expect(() => formatWallClock("9am")).toThrow(RangeError);
  });
});

describe("formatBogotaDayMonth", () => {
  it("writes the day and the month in Bogotá", () => {
    expect(formatBogotaDayMonth(startOfBogotaDay("2026-11-24"))).toBe(
      "24 de noviembre",
    );
  });
});

describe("formatBogotaDayMonthYear", () => {
  it("writes the day, the month and the year in Bogotá", () => {
    expect(formatBogotaDayMonthYear(startOfBogotaDay("2027-02-10"))).toBe(
      "10 de febrero de 2027",
    );
  });

  it("takes the day of Bogotá, not of UTC", () => {
    // 2027-01-01 03:00 UTC is still the last day of 2026 in Bogotá.
    expect(formatBogotaDayMonthYear(new Date("2027-01-01T03:00:00Z"))).toBe(
      "31 de diciembre de 2026",
    );
  });
});

describe("isBogotaDate", () => {
  it.each(["2026-11-16", "2028-02-29"])("takes %s", (date) => {
    expect(isBogotaDate(date)).toBe(true);
  });

  it.each([
    "2026-02-30",
    "2027-02-29",
    "2026-13-01",
    "16/11/2026",
    "",
    "2026-11-16T00:00",
  ])("refuses %s", (date) => {
    expect(isBogotaDate(date)).toBe(false);
  });
});

describe("formatCalendarDay", () => {
  it.each([
    ["2026-11-16", "lunes 16 de noviembre"],
    ["2026-12-24", "jueves 24 de diciembre"],
    ["2027-01-01", "viernes 1 de enero"],
  ])("writes %s as %s, whatever the server zone", (date, text) => {
    expect(formatCalendarDay(date)).toBe(text);
  });
});

describe("formatShortWallClock", () => {
  it("drops the a. m. or p. m.", () => {
    expect(formatShortWallClock("09:15")).toBe("9:15");
    expect(formatShortWallClock("14:00")).toBe("2:00");
    expect(formatShortWallClock("00:30")).toBe("12:30");
  });
});

describe("formatMonthYear", () => {
  it("names the month and the year of a Bogotá date", () => {
    expect(formatMonthYear("2026-11-01")).toBe("noviembre de 2026");
    expect(formatMonthYear("2027-01-31")).toBe("enero de 2027");
  });
});
