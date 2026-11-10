import { describe, expect, it } from "vitest";
import { DEFAULT_BARBERSHOP_HOURS, type WeeklyShift } from "./hours";
import {
  DEFAULT_DAY_SHIFT,
  TIME_OPTIONS,
  WEEK_DAYS,
  dayField,
  daysOutsideShop,
  draftFromShifts,
  isWithinShop,
  parseWeekForm,
  shiftsFromDraft,
  splitShift,
  toMinutes,
  toRpcShifts,
  validateWeek,
  type WeekDraft,
} from "./weekly-hours";

const shift = (weekday: number, start: string, end: string): WeeklyShift => ({
  weekday,
  start,
  end,
});

describe("TIME_OPTIONS", () => {
  it("offers every quarter hour of the day, from 00:00 to 23:45", () => {
    expect(TIME_OPTIONS).toHaveLength(96);
    expect(TIME_OPTIONS[0]).toBe("00:00");
    expect(TIME_OPTIONS[1]).toBe("00:15");
    expect(TIME_OPTIONS).toContain("09:00");
    expect(TIME_OPTIONS).toContain("13:30");
    expect(TIME_OPTIONS.at(-1)).toBe("23:45");
    expect(TIME_OPTIONS).not.toContain("24:00");
  });

  it("is sorted and has no repeats", () => {
    expect([...TIME_OPTIONS].sort()).toEqual(TIME_OPTIONS);
    expect(new Set(TIME_OPTIONS).size).toBe(TIME_OPTIONS.length);
  });
});

describe("toMinutes", () => {
  it("counts minutes from midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:15")).toBe(555);
    expect(toMinutes("23:45")).toBe(1425);
  });
});

describe("WEEK_DAYS", () => {
  it("goes from Monday to Sunday", () => {
    expect(WEEK_DAYS).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});

describe("parseWeekForm", () => {
  it("accepts an empty week: every day off", () => {
    expect(parseWeekForm([])).toEqual({ status: "valid", shifts: [] });
  });

  it("accepts one or two shifts a day and sorts them Monday first", () => {
    const result = parseWeekForm([
      shift(0, "10:00", "14:00"),
      shift(1, "14:00", "18:00"),
      shift(1, "09:00", "12:00"),
      shift(6, "08:00", "13:00"),
    ]);
    expect(result).toEqual({
      status: "valid",
      shifts: [
        shift(1, "09:00", "12:00"),
        shift(1, "14:00", "18:00"),
        shift(6, "08:00", "13:00"),
        shift(0, "10:00", "14:00"),
      ],
    });
  });

  it("lets two shifts touch, as the database does (half-open)", () => {
    expect(
      parseWeekForm([shift(2, "09:00", "12:00"), shift(2, "12:00", "18:00")])
        .status,
    ).toBe("valid");
  });

  it("refuses a shift that does not end after it starts", () => {
    expect(parseWeekForm([shift(1, "12:00", "09:00")])).toEqual({
      status: "invalid",
      errors: { 1: "hours_order" },
    });
    expect(parseWeekForm([shift(3, "09:00", "09:00")])).toEqual({
      status: "invalid",
      errors: { 3: "hours_order" },
    });
  });

  it("refuses two shifts of a day that overlap", () => {
    expect(
      parseWeekForm([shift(5, "09:00", "13:00"), shift(5, "12:45", "18:00")]),
    ).toEqual({ status: "invalid", errors: { 5: "hours_overlap" } });
    // Also when one holds the other, in any order.
    expect(
      parseWeekForm([shift(5, "10:00", "11:00"), shift(5, "09:00", "18:00")]),
    ).toEqual({ status: "invalid", errors: { 5: "hours_overlap" } });
  });

  it("refuses a third shift in a day", () => {
    expect(
      parseWeekForm([
        shift(1, "08:00", "09:00"),
        shift(1, "10:00", "11:00"),
        shift(1, "12:00", "13:00"),
      ]),
    ).toEqual({ status: "invalid", errors: { 1: "hours_too_many" } });
  });

  it("refuses times off the 15-minute grid or out of the day", () => {
    for (const [start, end] of [
      ["09:10", "12:00"],
      ["09:00", "12:05"],
      ["9:00", "12:00"],
      ["09:00", "24:00"],
      ["09:00:00", "12:00:00"],
      ["", "12:00"],
      ["aa:bb", "12:00"],
    ] as const) {
      expect(parseWeekForm([shift(4, start, end)]), `${start}-${end}`).toEqual({
        status: "invalid",
        errors: { 4: "hours_invalid" },
      });
    }
  });

  it("reports the first rule each day breaks, and only those days", () => {
    expect(
      parseWeekForm([
        shift(1, "09:00", "12:00"),
        shift(2, "09:07", "08:00"),
        shift(3, "12:00", "09:00"),
        shift(3, "08:00", "10:00"),
        shift(3, "11:00", "12:00"),
        shift(0, "10:00", "12:00"),
        shift(0, "11:00", "13:00"),
      ]),
    ).toEqual({
      status: "invalid",
      errors: { 2: "hours_invalid", 3: "hours_too_many", 0: "hours_overlap" },
    });
  });

  it("calls anything that is not a week malformed", () => {
    for (const input of [
      null,
      undefined,
      "[]",
      42,
      {},
      [null],
      ["09:00"],
      [{ weekday: 7, start: "09:00", end: "12:00" }],
      [{ weekday: -1, start: "09:00", end: "12:00" }],
      [{ weekday: 1.5, start: "09:00", end: "12:00" }],
      [{ weekday: "1", start: "09:00", end: "12:00" }],
      [{ weekday: 1, start: 900, end: "12:00" }],
      [{ weekday: 1, start: "09:00" }],
      [{ weekday: 1, start: "09:00", end: "12:00", barber_id: "x" }],
      Array.from({ length: 29 }, () => shift(1, "09:00", "10:00")),
    ]) {
      expect(parseWeekForm(input), JSON.stringify(input)).toEqual({
        status: "malformed",
      });
    }
  });
});

describe("daysOutsideShop and isWithinShop", () => {
  const shop = DEFAULT_BARBERSHOP_HOURS; // Mon-Fri 9-20, Sat 8-21, Sun closed.

  it("accepts shifts inside the barbershop's hours, edges included", () => {
    const week = [
      shift(1, "09:00", "12:00"),
      shift(1, "14:00", "18:00"),
      shift(5, "09:00", "20:00"),
      shift(6, "08:00", "21:00"),
    ];
    expect(daysOutsideShop(week, shop)).toEqual([]);
    expect(isWithinShop(week, shop)).toBe(true);
    expect(isWithinShop([], shop)).toBe(true);
  });

  it("refuses a shift that starts early or ends late", () => {
    expect(daysOutsideShop([shift(1, "06:00", "08:00")], shop)).toEqual([1]);
    expect(daysOutsideShop([shift(2, "08:45", "12:00")], shop)).toEqual([2]);
    expect(daysOutsideShop([shift(6, "15:00", "21:15")], shop)).toEqual([6]);
    expect(isWithinShop([shift(3, "19:00", "20:15")], shop)).toBe(false);
  });

  it("refuses any shift on a day the barbershop is closed", () => {
    expect(daysOutsideShop([shift(0, "10:00", "12:00")], shop)).toEqual([0]);
  });

  it("lists every day out of the barbershop's hours, Monday first", () => {
    expect(
      daysOutsideShop(
        [
          shift(0, "10:00", "12:00"),
          shift(1, "09:00", "12:00"),
          shift(1, "19:00", "21:00"),
          shift(4, "07:00", "10:00"),
        ],
        shop,
      ),
    ).toEqual([1, 4, 0]);
  });

  it("needs each shift to fit inside one shift of the barbershop", () => {
    const split = [shift(1, "09:00", "13:00"), shift(1, "15:00", "20:00")];
    expect(isWithinShop([shift(1, "09:00", "13:00")], split)).toBe(true);
    expect(isWithinShop([shift(1, "15:30", "19:00")], split)).toBe(true);
    // Across the barbershop's break.
    expect(isWithinShop([shift(1, "12:00", "16:00")], split)).toBe(false);
    // Within the break.
    expect(isWithinShop([shift(1, "13:15", "14:45")], split)).toBe(false);
  });

  it("joins barbershop shifts that touch", () => {
    const touching = [shift(2, "09:00", "13:00"), shift(2, "13:00", "20:00")];
    expect(isWithinShop([shift(2, "10:00", "18:00")], touching)).toBe(true);
    // Overlapping ones too, in any order, and one inside another.
    const loose = [
      shift(2, "12:00", "20:00"),
      shift(2, "09:00", "13:00"),
      shift(2, "14:00", "15:00"),
    ];
    expect(isWithinShop([shift(2, "09:00", "20:00")], loose)).toBe(true);
  });

  it("compares the same day only", () => {
    expect(
      isWithinShop([shift(6, "08:00", "09:00")], [shift(5, "08:00", "21:00")]),
    ).toBe(false);
  });

  it("refuses everything when the barbershop has no hours", () => {
    expect(isWithinShop([shift(1, "09:00", "10:00")], [])).toBe(false);
  });
});

describe("validateWeek", () => {
  const shop = DEFAULT_BARBERSHOP_HOURS;

  it("passes a week that is valid and inside the barbershop's hours", () => {
    const result = validateWeek([shift(1, "09:00", "12:00")], shop);
    expect(result).toEqual({
      status: "valid",
      shifts: [shift(1, "09:00", "12:00")],
    });
  });

  it("marks the days outside the barbershop's hours", () => {
    expect(
      validateWeek(
        [shift(1, "06:00", "08:00"), shift(2, "09:00", "12:00")],
        shop,
      ),
    ).toEqual({ status: "invalid", errors: { 1: "hours_outside_shop" } });
  });

  it("reports a day's own errors before the barbershop's hours", () => {
    expect(
      validateWeek(
        [shift(1, "06:00", "05:00"), shift(2, "06:00", "08:00")],
        shop,
      ),
    ).toEqual({ status: "invalid", errors: { 1: "hours_order" } });
  });

  it("passes malformed input through", () => {
    expect(validateWeek("nada", shop)).toEqual({ status: "malformed" });
  });
});

describe("toRpcShifts", () => {
  it("sends { weekday, start, end } Monday first, without anything else", () => {
    const extra = { ...shift(0, "10:00", "12:00"), id: "x" };
    expect(
      toRpcShifts([
        extra,
        shift(1, "14:00", "18:00"),
        shift(1, "09:00", "12:00"),
      ]),
    ).toEqual([
      { weekday: 1, start: "09:00", end: "12:00" },
      { weekday: 1, start: "14:00", end: "18:00" },
      { weekday: 0, start: "10:00", end: "12:00" },
    ]);
    expect(toRpcShifts([])).toEqual([]);
  });
});

describe("draftFromShifts and shiftsFromDraft", () => {
  it("turns saved shifts into the editor's week and back", () => {
    const saved = [
      shift(1, "09:00:00", "12:00:00"),
      shift(1, "14:00", "18:00"),
      shift(6, "08:00", "13:00"),
    ];
    const draft = draftFromShifts(saved);
    expect(draft[1]).toEqual({
      works: true,
      shifts: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "18:00" },
      ],
    });
    expect(draft[6]).toEqual({
      works: true,
      shifts: [{ start: "08:00", end: "13:00" }],
    });
    expect(draft[0]).toEqual({ works: false, shifts: [] });
    expect(Object.keys(draft).sort()).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(shiftsFromDraft(draft)).toEqual([
      shift(1, "09:00", "12:00"),
      shift(1, "14:00", "18:00"),
      shift(6, "08:00", "13:00"),
    ]);
  });

  it("keeps the first two shifts of a day, by start", () => {
    const draft = draftFromShifts([
      shift(2, "16:00", "17:00"),
      shift(2, "08:00", "09:00"),
      shift(2, "10:00", "11:00"),
    ]);
    expect(draft[2].shifts).toEqual([
      { start: "08:00", end: "09:00" },
      { start: "10:00", end: "11:00" },
    ]);
  });

  it("leaves out the days that do not work, even with shifts kept", () => {
    const draft: WeekDraft = {
      ...draftFromShifts([]),
      1: { works: false, shifts: [{ start: "09:00", end: "12:00" }] },
      3: { works: true, shifts: [DEFAULT_DAY_SHIFT] },
    };
    expect(shiftsFromDraft(draft)).toEqual([shift(3, "09:00", "18:00")]);
  });

  it("copies the barbershop's default hours into a valid week", () => {
    const week = shiftsFromDraft(draftFromShifts(DEFAULT_BARBERSHOP_HOURS));
    expect(validateWeek(week, DEFAULT_BARBERSHOP_HOURS)).toEqual({
      status: "valid",
      shifts: [...DEFAULT_BARBERSHOP_HOURS],
    });
  });
});

describe("splitShift", () => {
  it("leaves an hour's break in the middle of a long shift", () => {
    expect(splitShift({ start: "09:00", end: "20:00" })).toEqual([
      { start: "09:00", end: "14:00" },
      { start: "15:00", end: "20:00" },
    ]);
    expect(splitShift({ start: "08:00", end: "21:00" })).toEqual([
      { start: "08:00", end: "14:00" },
      { start: "15:00", end: "21:00" },
    ]);
    expect(splitShift({ start: "09:00", end: "11:00" })).toEqual([
      { start: "09:00", end: "09:30" },
      { start: "10:30", end: "11:00" },
    ]);
  });

  it("keeps the 15-minute grid", () => {
    const [first, second] = splitShift({ start: "09:15", end: "18:30" });
    for (const time of [first.start, first.end, second.start, second.end]) {
      expect(TIME_OPTIONS).toContain(time);
    }
    expect(first.end < second.start).toBe(true);
  });

  it("adds a second shift after a short one", () => {
    expect(splitShift({ start: "09:00", end: "10:00" })).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "10:15", end: "11:15" },
    ]);
  });

  it("never goes past 23:45", () => {
    const [, second] = splitShift({ start: "22:30", end: "23:30" });
    expect(second).toEqual({ start: "23:45", end: "23:45" });
  });

  it("gives two shifts that pass the checks", () => {
    const [first, second] = splitShift({ start: "09:00", end: "20:00" });
    expect(
      parseWeekForm([
        { weekday: 1, ...first },
        { weekday: 1, ...second },
      ]).status,
    ).toBe("valid");
  });
});

describe("dayField", () => {
  it("names each day's field by its weekday", () => {
    expect(dayField(1)).toBe("day1");
    expect(dayField(0)).toBe("day0");
  });
});
