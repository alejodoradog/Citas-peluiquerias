import { describe, expect, it } from "vitest";
import { fromBogota, getWeekday, toBogotaTime } from "@/lib/fechas/fechas";
import { DEFAULT_BARBERSHOP_HOURS } from "@/modulos/barberias/dominio/hours";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import {
  MAX_NOTICE_MINUTES,
  availableDays,
  availableSlots,
  bookingWindow,
  firstAvailableBarber,
  type AvailabilityBarber,
  type AvailabilityInput,
} from "./availability";
import { bookingDuration } from "./booking";

// 6:00 a. m. in Bogotá on Tuesday, November 10, 2026 (11:00 UTC).
const NOW = new Date("2026-11-10T11:00:00Z");
// Thursday: the default hours open it 9:00 a. m. to 8:00 p. m.
const THURSDAY = "2026-11-12";

const at = (date: string, time: string) => fromBogota(date, time);
const interval = (date: string, from: string, to: string) => ({
  start: at(date, from),
  end: at(date, to),
});

const barber = (
  id: string,
  fields: Partial<AvailabilityBarber> = {},
): AvailabilityBarber => ({
  id,
  sortOrder: 0,
  usesBarbershopHours: true,
  shifts: [],
  ...fields,
});

const input = (fields: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  now: NOW,
  fromDate: THURSDAY,
  toDate: THURSDAY,
  durationMinutes: 30,
  minNoticeMinutes: 60,
  shopHours: DEFAULT_BARBERSHOP_HOURS,
  holidayOpenings: [],
  barbers: [barber("ana")],
  blocks: [],
  appointments: [],
  ...fields,
});

// The Bogotá start times of one day, optionally only where a barber is free.
function times(
  fields: Partial<AvailabilityInput>,
  date = fields.fromDate ?? THURSDAY,
  barberId?: string,
): string[] {
  const day = availableSlots(
    input({ fromDate: date, toDate: date, ...fields }),
  ).find((d) => d.date === date);
  return (day?.slots ?? [])
    .filter((slot) => !barberId || slot.barberIds.includes(barberId))
    .map((slot) => toBogotaTime(slot.start));
}

describe("the dates these tests rely on", () => {
  it("fall on the weekdays they say", () => {
    expect(getWeekday("2026-11-10")).toBe(2);
    expect(getWeekday(THURSDAY)).toBe(4);
    expect(getWeekday("2026-11-15")).toBe(0);
    expect(getWeekday("2026-11-16")).toBe(1);
  });
});

describe("availableSlots: hours", () => {
  it("offers every 15 minutes from opening to the last start that fits", () => {
    const slots = times({});
    expect(slots[0]).toBe("09:00");
    expect(slots[1]).toBe("09:15");
    expect(slots.at(-1)).toBe("19:30");
    expect(slots).toHaveLength(43);
  });

  it("gives each slot its end, start + duration, in UTC", () => {
    const [slot] = availableSlots(input())[0]!.slots;
    expect(slot!.start.toISOString()).toBe("2026-11-12T14:00:00.000Z");
    expect(slot!.end.toISOString()).toBe("2026-11-12T14:30:00.000Z");
    expect(slot!.barberIds).toEqual(["ana"]);
  });

  it("offers nothing the day the barbershop is closed", () => {
    // The default hours close on Sunday.
    expect(times({}, "2026-11-15")).toEqual([]);
  });

  it("offers nothing the day the barber rests", () => {
    const mondayOnly = barber("ana", {
      usesBarbershopHours: false,
      shifts: [{ weekday: 1, start: "09:00", end: "18:00" }],
    });
    expect(times({ barbers: [mondayOnly] })).toEqual([]);
  });

  it("never lets an appointment cross the lunch break of a split shift", () => {
    const split: WeeklyShift[] = [
      { weekday: 4, start: "09:00", end: "13:00" },
      { weekday: 4, start: "14:00", end: "20:00" },
    ];
    const slots = times({ shopHours: split, durationMinutes: 60 });
    expect(slots).toContain("12:00");
    for (const time of ["12:15", "12:30", "12:45", "13:00", "13:30", "13:45"]) {
      expect(slots).not.toContain(time);
    }
    expect(slots).toContain("14:00");
    expect(slots.at(-1)).toBe("19:00");
  });

  it("joins shifts that touch: 9-13 and 13-20 have no break", () => {
    const touching: WeeklyShift[] = [
      { weekday: 4, start: "09:00", end: "13:00" },
      { weekday: 4, start: "13:00", end: "20:00" },
    ];
    expect(times({ shopHours: touching, durationMinutes: 60 })).toContain(
      "12:30",
    );
  });

  it("fits a long service whole before closing", () => {
    const slots = times({ durationMinutes: 120 });
    expect(slots.at(-1)).toBe("18:00");
    expect(times({ durationMinutes: 480 })).toEqual([
      "09:00",
      "09:15",
      "09:30",
      "09:45",
      "10:00",
      "10:15",
      "10:30",
      "10:45",
      "11:00",
      "11:15",
      "11:30",
      "11:45",
      "12:00",
    ]);
  });

  it("offers nothing when the service is longer than the shift", () => {
    const short: WeeklyShift[] = [{ weekday: 4, start: "09:00", end: "10:00" }];
    expect(times({ shopHours: short, durationMinutes: 75 })).toEqual([]);
  });

  it("cuts a barber's own hours to the barbershop's", () => {
    const early = barber("ana", {
      usesBarbershopHours: false,
      shifts: [{ weekday: 4, start: "07:00", end: "22:00" }],
    });
    const slots = times({ barbers: [early] });
    expect(slots[0]).toBe("09:00");
    expect(slots.at(-1)).toBe("19:30");

    const edges = barber("ana", {
      usesBarbershopHours: false,
      shifts: [
        { weekday: 4, start: "08:00", end: "10:00" },
        { weekday: 4, start: "19:00", end: "21:00" },
      ],
    });
    expect(times({ barbers: [edges] })).toEqual([
      "09:00",
      "09:15",
      "09:30",
      "19:00",
      "19:15",
      "19:30",
    ]);
  });

  it("uses the barber's own hours inside the barbershop's", () => {
    const afternoon = barber("ana", {
      usesBarbershopHours: false,
      shifts: [{ weekday: 4, start: "14:00", end: "16:00" }],
    });
    const slots = times({ barbers: [afternoon], durationMinutes: 60 });
    expect(slots).toEqual(["14:00", "14:15", "14:30", "14:45", "15:00"]);
  });

  it("reads the database's times with seconds and a shift until midnight", () => {
    const late: WeeklyShift[] = [
      { weekday: 4, start: "22:00:00", end: "24:00:00" },
    ];
    expect(times({ shopHours: late, durationMinutes: 60 })).toEqual([
      "22:00",
      "22:15",
      "22:30",
      "22:45",
      "23:00",
    ]);
  });

  it("starts on the quarter hour even when a shift does not", () => {
    const own = barber("ana", {
      usesBarbershopHours: false,
      shifts: [{ weekday: 4, start: "09:10", end: "10:00" }],
    });
    expect(times({ barbers: [own] })).toEqual(["09:15", "09:30"]);
  });
});

describe("availableSlots: holidays", () => {
  // Monday, November 16, 2026: Independence of Cartagena moved to Monday.
  const HOLIDAY = "2026-11-16";

  it("closes a Colombian holiday by default", () => {
    expect(times({}, HOLIDAY)).toEqual([]);
  });

  it("opens a holiday the barbershop opens, with that weekday's hours", () => {
    const slots = times({ holidayOpenings: [HOLIDAY] }, HOLIDAY);
    expect(slots[0]).toBe("09:00");
    expect(slots.at(-1)).toBe("19:30");
  });

  it("ignores an opening on a day that is not a holiday", () => {
    expect(times({ holidayOpenings: [THURSDAY] })).toEqual(times({}));
  });

  it("follows Easter and the Monday holidays across the end of the month", () => {
    // 2027: Saint Joseph on Monday March 22; Holy Thursday and Good Friday on
    // March 25 and 26; Thursday April 1 is a working day.
    const now = new Date("2027-03-20T12:00:00Z");
    const days = availableSlots(
      input({ now, fromDate: "2027-03-20", toDate: "2027-04-02" }),
    );
    const closed = days.filter((d) => d.slots.length === 0).map((d) => d.date);
    expect(closed).toEqual([
      "2027-03-21",
      "2027-03-22",
      "2027-03-25",
      "2027-03-26",
      "2027-03-28",
    ]);
    expect(days.map((d) => d.date)).toContain("2027-04-01");
  });

  it("closes the Emiliani Monday of Epiphany, not January 6", () => {
    const now = new Date("2027-01-04T12:00:00Z");
    const open = availableDays(
      input({ now, fromDate: "2027-01-04", toDate: "2027-01-12" }),
    );
    expect(open).toContain("2027-01-06");
    expect(open).not.toContain("2027-01-11");
  });
});

describe("availableSlots: closures and blocks", () => {
  it("closes the whole barbershop for several days", () => {
    const closure = {
      barberId: null,
      start: at("2026-11-12", "00:00"),
      end: at("2026-11-14", "00:00"),
    };
    const days = availableSlots(
      input({
        barbers: [barber("ana"), barber("beto")],
        blocks: [closure],
        fromDate: "2026-11-12",
        toDate: "2026-11-14",
      }),
    );
    expect(days.map((d) => d.slots.length > 0)).toEqual([false, false, true]);
  });

  it("closes from 2 p. m. on: the last 30-minute slot is 1:30 p. m.", () => {
    const fromTwo = {
      barberId: null,
      start: at(THURSDAY, "14:00"),
      end: at("2026-11-13", "00:00"),
    };
    const slots = times({ blocks: [fromTwo] });
    expect(slots.at(-1)).toBe("13:30");
    expect(slots).not.toContain("13:45");
  });

  it("blocks only the barber it names", () => {
    const anaBusy = {
      barberId: "ana",
      ...interval(THURSDAY, "09:00", "20:00"),
    };
    const fields = {
      barbers: [barber("ana"), barber("beto")],
      blocks: [anaBusy],
    };
    expect(times(fields, THURSDAY, "ana")).toEqual([]);
    expect(times(fields, THURSDAY, "beto")).toHaveLength(43);
  });

  it("leaves free a slot that ends when a block starts or starts when it ends", () => {
    const block = { barberId: "ana", ...interval(THURSDAY, "11:00", "12:00") };
    const slots = times({ blocks: [block] });
    expect(slots).toContain("10:30");
    expect(slots).not.toContain("10:45");
    expect(slots).not.toContain("11:45");
    expect(slots).toContain("12:00");
  });
});

describe("availableSlots: appointments", () => {
  it("lets an appointment end exactly when another starts", () => {
    const taken = { barberId: "ana", ...interval(THURSDAY, "10:00", "10:30") };
    const slots = times({ appointments: [taken] });
    expect(slots).toContain("09:30");
    expect(slots).not.toContain("09:45");
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:15");
    expect(slots).toContain("10:30");
  });

  it("only takes the time of the barber who has it", () => {
    const taken = { barberId: "ana", ...interval(THURSDAY, "10:00", "10:30") };
    const day = availableSlots(
      input({
        barbers: [barber("ana"), barber("beto")],
        appointments: [taken],
      }),
    )[0]!;
    const ten = day.slots.find((s) => toBogotaTime(s.start) === "10:00");
    expect(ten?.barberIds).toEqual(["beto"]);
  });

  it("handles overlapping and contained busy times", () => {
    const busy = [
      { barberId: "ana", ...interval(THURSDAY, "10:00", "11:00") },
      { barberId: "ana", ...interval(THURSDAY, "10:30", "12:00") },
      { barberId: "ana", ...interval(THURSDAY, "10:45", "11:15") },
    ];
    const slots = times({ appointments: busy, durationMinutes: 15 });
    expect(slots).toContain("09:45");
    for (const time of ["10:00", "10:30", "11:00", "11:45"]) {
      expect(slots).not.toContain(time);
    }
    expect(slots).toContain("12:00");
  });

  it("frees the time of a cancelled appointment: the caller leaves it out", () => {
    // availableSlots receives only appointments that take the time
    // (takesTheTime, booking.test.ts); a cancelled one is not passed.
    expect(times({ appointments: [] })).toHaveLength(43);
  });

  it("looks for the sum of the chosen services", () => {
    const duration = bookingDuration([
      { id: "corte", durationMinutes: 40 },
      { id: "barba", durationMinutes: 20 },
    ]);
    expect(duration.ok && duration.minutes).toBe(60);
    const slots = times({
      durationMinutes: duration.ok ? duration.minutes : 0,
    });
    expect(slots.at(-1)).toBe("19:00");
  });

  it("keeps the evening in its Bogotá day although UTC is the next day", () => {
    // Saturday 8:00 a. m. to 9:00 p. m.; 7:30-8:30 p. m. in Bogotá is
    // 00:30-01:30 UTC on Sunday.
    const saturday = "2026-11-14";
    const late = { barberId: "ana", ...interval(saturday, "19:30", "20:30") };
    expect(late.start.toISOString()).toBe("2026-11-15T00:30:00.000Z");
    const slots = times({ appointments: [late] }, saturday);
    expect(slots).toContain("19:00");
    expect(slots).not.toContain("19:15");
    expect(slots).not.toContain("20:00");
    expect(slots.at(-1)).toBe("20:30");
    // Sunday (closed) gets nothing from Saturday's evening.
    expect(times({ appointments: [late] }, "2026-11-15")).toEqual([]);
  });

  it("orders each slot's barbers by sortOrder, then id", () => {
    const barbers = [
      barber("zoe", { sortOrder: 1 }),
      barber("beto", { sortOrder: 2 }),
      barber("ana", { sortOrder: 2 }),
    ];
    const [slot] = availableSlots(input({ barbers }))[0]!.slots;
    expect(slot!.barberIds).toEqual(["zoe", "ana", "beto"]);
  });

  it("offers nothing without barbers", () => {
    expect(times({ barbers: [] })).toEqual([]);
  });
});

describe("availableSlots: notice and window", () => {
  it("starts at now + the minimum notice, the edge included", () => {
    const now = at(THURSDAY, "08:00");
    expect(times({ now, minNoticeMinutes: 60 })[0]).toBe("09:00");
    expect(times({ now: at(THURSDAY, "08:10"), minNoticeMinutes: 60 })[0]).toBe(
      "09:15",
    );
    expect(
      times({ now: at(THURSDAY, "12:00"), minNoticeMinutes: 120 })[0],
    ).toBe("14:00");
  });

  it("allows a notice of 0: a slot starting right now", () => {
    expect(times({ now: at(THURSDAY, "10:00"), minNoticeMinutes: 0 })[0]).toBe(
      "10:00",
    );
    const justAfter = new Date(at(THURSDAY, "10:00").getTime() + 1000);
    expect(times({ now: justAfter, minNoticeMinutes: 0 })[0]).toBe("10:15");
  });

  it("can push the notice past the day", () => {
    expect(
      times({ now: at(THURSDAY, "18:00"), minNoticeMinutes: 180 }),
    ).toEqual([]);
    expect(
      times({
        now: at("2026-11-11", "12:00"),
        minNoticeMinutes: MAX_NOTICE_MINUTES,
      }),
    ).toEqual([]);
  });

  it("books from today to today + 30 in Bogotá, both included", () => {
    expect(bookingWindow(NOW)).toEqual({
      from: "2026-11-10",
      until: "2026-12-10",
    });
    const days = availableSlots(
      input({ fromDate: "2026-11-01", toDate: "2027-01-31" }),
    );
    expect(days[0]!.date).toBe("2026-11-10");
    expect(days.at(-1)!.date).toBe("2026-12-10");
    expect(days).toHaveLength(31);
    // December 10, 2026 is a Thursday: open until the end of the window.
    expect(days.at(-1)!.slots.length).toBeGreaterThan(0);
  });

  it("counts the window from Bogotá's date, not UTC's", () => {
    // 11:30 p. m. on November 10 in Bogotá is already November 11 in UTC.
    const lateNight = new Date("2026-11-11T04:30:00Z");
    expect(bookingWindow(lateNight)).toEqual({
      from: "2026-11-10",
      until: "2026-12-10",
    });
  });

  it("returns nothing for days wholly outside the window", () => {
    expect(
      availableSlots(input({ fromDate: "2026-12-11", toDate: "2026-12-20" })),
    ).toEqual([]);
    expect(
      availableSlots(input({ fromDate: "2026-11-01", toDate: "2026-11-09" })),
    ).toEqual([]);
    expect(
      availableSlots(input({ fromDate: "2026-11-13", toDate: "2026-11-12" })),
    ).toEqual([]);
  });
});

describe("availableSlots: input the database could not produce", () => {
  it.each([
    ["a duration of 0", { durationMinutes: 0 }],
    ["a duration off the 5-minute step", { durationMinutes: 7 }],
    ["a duration over 480", { durationMinutes: 485 }],
    ["a negative notice", { minNoticeMinutes: -1 }],
    ["a notice over a week", { minNoticeMinutes: MAX_NOTICE_MINUTES + 1 }],
    ["a fractional notice", { minNoticeMinutes: 1.5 }],
    ["an invalid now", { now: new Date(Number.NaN) }],
    ["an invalid date", { fromDate: "2026-02-30" }],
    ["an invalid holiday", { holidayOpenings: ["16/11/2026"] }],
    ["a repeated barber", { barbers: [barber("ana"), barber("ana")] }],
    [
      "an invalid sort order",
      { barbers: [barber("ana", { sortOrder: Number.NaN })] },
    ],
    [
      "a block that ends before it starts",
      { blocks: [{ barberId: null, ...interval(THURSDAY, "12:00", "11:00") }] },
    ],
    [
      "an empty appointment",
      {
        appointments: [
          { barberId: "ana", ...interval(THURSDAY, "12:00", "12:00") },
        ],
      },
    ],
    [
      "a shift time without padding",
      { shopHours: [{ weekday: 4, start: "9:00", end: "18:00" }] },
    ],
    [
      "a shift after midnight",
      { shopHours: [{ weekday: 4, start: "09:00", end: "24:30" }] },
    ],
    [
      "a shift with seconds",
      { shopHours: [{ weekday: 4, start: "09:00:30", end: "18:00" }] },
    ],
    [
      "a shift with 60 minutes",
      { shopHours: [{ weekday: 4, start: "09:60", end: "18:00" }] },
    ],
    [
      "a shift that ends at its start",
      { shopHours: [{ weekday: 4, start: "18:00", end: "18:00" }] },
    ],
  ] as Array<[string, Partial<AvailabilityInput>]>)(
    "throws on %s",
    (_, fields) => {
      expect(() => availableSlots(input(fields))).toThrow(RangeError);
    },
  );
});

describe("availableDays", () => {
  it("lists the days with at least one slot, for the calendar", () => {
    expect(
      availableDays(input({ fromDate: "2026-11-12", toDate: "2026-11-17" })),
    ).toEqual(["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-17"]);
  });
});

describe("firstAvailableBarber", () => {
  const barbers = [
    { id: "ana", sortOrder: 1 },
    { id: "beto", sortOrder: 2 },
    { id: "caro", sortOrder: 2 },
  ];
  const slot = (barberIds: string[]) => ({
    start: at(THURSDAY, "15:00"),
    barberIds,
  });
  const appointment = (barberId: string, date = THURSDAY, time = "10:00") => ({
    barberId,
    start: at(date, time),
  });

  it("chooses the free barber with the fewest appointments that day", () => {
    const appointments = [
      appointment("ana"),
      appointment("ana"),
      appointment("beto"),
    ];
    expect(
      firstAvailableBarber(
        slot(["ana", "beto", "caro"]),
        barbers,
        appointments,
      ),
    ).toBe("caro");
    expect(
      firstAvailableBarber(slot(["ana", "beto"]), barbers, appointments),
    ).toBe("beto");
  });

  it("breaks a tie by sortOrder, then by id", () => {
    expect(
      firstAvailableBarber(slot(["ana", "beto", "caro"]), barbers, []),
    ).toBe("ana");
    expect(firstAvailableBarber(slot(["caro", "beto"]), barbers, [])).toBe(
      "beto",
    );
  });

  it("gives the same answer whatever the order of its input", () => {
    const appointments = [appointment("caro"), appointment("ana")];
    const forward = firstAvailableBarber(
      slot(["ana", "beto", "caro"]),
      barbers,
      appointments,
    );
    const backward = firstAvailableBarber(
      slot(["caro", "beto", "ana"]),
      [...barbers].reverse(),
      [...appointments].reverse(),
    );
    expect(forward).toBe("beto");
    expect(backward).toBe(forward);
  });

  it("counts only the slot's Bogotá day", () => {
    // 7:30 p. m. Wednesday in Bogotá is Thursday in UTC: it is not Thursday's.
    const appointments = [
      appointment("ana", "2026-11-11", "19:30"),
      appointment("ana", "2026-11-13", "09:00"),
      appointment("beto", THURSDAY, "19:30"),
    ];
    expect(
      firstAvailableBarber(slot(["ana", "beto"]), barbers, appointments),
    ).toBe("ana");
  });

  it("returns null when nobody is free", () => {
    expect(firstAvailableBarber(slot([]), barbers, [])).toBeNull();
  });

  it("throws on a barber it does not know", () => {
    expect(() => firstAvailableBarber(slot(["ghost"]), barbers, [])).toThrow(
      RangeError,
    );
  });
});

describe("availableSlots: performance", () => {
  // 10 barbers, 30 days, 20 appointments a day each (6,000 appointments).
  // Generous on purpose so a slow CI machine does not fail it; the real
  // budget (p95 < 300 ms end to end) is measured in task 3.2.
  it("computes a month for 10 busy barbers well under 200 ms", () => {
    const barbers = Array.from({ length: 10 }, (_, i) =>
      barber(`b${i}`, { sortOrder: i }),
    );
    const appointments = [];
    for (let day = 0; day <= 30; day++) {
      const date = new Date(Date.UTC(2026, 10, 10 + day))
        .toISOString()
        .slice(0, 10);
      for (const { id } of barbers) {
        for (let k = 0; k < 20; k++) {
          const start = at(date, "08:00").getTime() + k * 40 * 60_000;
          appointments.push({
            barberId: id,
            start: new Date(start),
            end: new Date(start + 30 * 60_000),
          });
        }
      }
    }
    const fields = input({
      fromDate: "2026-11-10",
      toDate: "2026-12-10",
      barbers,
      appointments,
      blocks: [{ barberId: null, ...interval("2026-11-20", "14:00", "18:00") }],
    });
    availableSlots(fields);
    const runs = Array.from({ length: 3 }, () => {
      const started = performance.now();
      availableSlots(fields);
      return performance.now() - started;
    });
    expect(Math.min(...runs)).toBeLessThan(200);
  });
});
