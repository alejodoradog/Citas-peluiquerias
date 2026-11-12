import { describe, expect, it } from "vitest";
import { fromBogota } from "@/lib/fechas/fechas";
import {
  blockDayOptions,
  blockTimeOptions,
  canMark,
  dayItems,
  parseBarberQuery,
  parseBlockForm,
  todaySummary,
  weekDays,
  type BarberAgendaData,
  type BarberAppointment,
  type BarberBlock,
} from "./barber-agenda";

// Saturday 7 November 2026, 10:00 in Bogotá.
const TODAY = "2026-11-07";
const NOW = fromBogota(TODAY, "10:00");

function appointment(
  id: string,
  date: string,
  time: string,
  minutes: number,
  extra: Partial<BarberAppointment> = {},
): BarberAppointment {
  const start = fromBogota(date, time);
  return {
    id,
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    status: "confirmed",
    source: "manual",
    createdAt: fromBogota("2026-11-01", "09:00"),
    customerName: "Felipe R.",
    serviceNames: ["Corte"],
    ...extra,
  };
}

function block(
  id: string,
  date: string,
  from: string,
  to: string,
  extra: Partial<BarberBlock> = {},
): BarberBlock {
  return {
    id,
    start: fromBogota(date, from),
    end: fromBogota(date, to),
    own: true,
    reason: "Almuerzo",
    ...extra,
  };
}

function data(extra: Partial<BarberAgendaData> = {}): BarberAgendaData {
  return {
    barber: { id: "b1", name: "Kevin Mora", active: true },
    barbershop: { name: "Barbería La Esquina", writable: true },
    schedule: { usesBarbershopHours: true, shifts: [] },
    shopHours: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      start: "09:00",
      end: "19:00",
    })),
    holidayOpenings: [],
    appointments: [],
    blocks: [],
    ...extra,
  };
}

describe("parseBarberQuery", () => {
  it("opens today's day by default", () => {
    expect(parseBarberQuery({}, TODAY)).toEqual({ view: "dia", date: TODAY });
  });

  it("reads the week and a day", () => {
    expect(parseBarberQuery({ vista: "semana" }, TODAY)).toEqual({
      view: "semana",
      date: TODAY,
    });
    expect(parseBarberQuery({ dia: "2026-11-10" }, TODAY).date).toBe(
      "2026-11-10",
    );
  });

  it("keeps the days from a week back to 30 days ahead, and today otherwise", () => {
    expect(parseBarberQuery({ dia: "2026-10-31" }, TODAY).date).toBe(
      "2026-10-31",
    );
    expect(parseBarberQuery({ dia: "2026-10-30" }, TODAY).date).toBe(TODAY);
    expect(parseBarberQuery({ dia: "2026-12-07" }, TODAY).date).toBe(
      "2026-12-07",
    );
    expect(parseBarberQuery({ dia: "2026-12-08" }, TODAY).date).toBe(TODAY);
    expect(parseBarberQuery({ dia: "no-es-fecha" }, TODAY).date).toBe(TODAY);
    expect(parseBarberQuery({ dia: ["2026-11-10"] }, TODAY).date).toBe(TODAY);
  });
});

describe("canMark (decisions B2 and B3)", () => {
  it("marks a confirmed appointment that already started", () => {
    expect(canMark(appointment("a", TODAY, "09:20", 40), NOW)).toBe(true);
    expect(canMark(appointment("a", TODAY, "10:00", 40), NOW)).toBe(true);
  });

  it("marks up to a week back, and older ones are the owner's (decision B5)", () => {
    expect(canMark(appointment("a", "2026-10-31", "08:00", 30), NOW)).toBe(
      true,
    );
    expect(canMark(appointment("a", "2026-10-30", "18:00", 30), NOW)).toBe(
      false,
    );
  });

  it("not one that has not started, nor one already marked or cancelled", () => {
    expect(canMark(appointment("a", TODAY, "10:40", 60), NOW)).toBe(false);
    expect(
      canMark(
        appointment("a", TODAY, "09:00", 30, { status: "attended" }),
        NOW,
      ),
    ).toBe(false);
    expect(
      canMark(
        appointment("a", TODAY, "09:00", 30, {
          status: "cancelled_by_customer",
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("dayItems", () => {
  it("lists the appointments and blocks of the day in order", () => {
    const items = dayItems(
      data({
        appointments: [
          appointment("late", TODAY, "17:00", 40),
          appointment("early", TODAY, "09:20", 40, { status: "attended" }),
          appointment("tomorrow", "2026-11-08", "09:00", 30),
        ],
        blocks: [block("lunch", TODAY, "13:00", "14:00")],
      }),
      TODAY,
      NOW,
    );
    expect(items.map((item) => item.id)).toEqual(["early", "lunch", "late"]);
  });

  it("says how each appointment looks and whether it can be marked", () => {
    const [attended, started, coming] = dayItems(
      data({
        appointments: [
          appointment("a", TODAY, "08:00", 30, { status: "attended" }),
          appointment("b", TODAY, "09:30", 60, {
            source: "web",
            createdAt: fromBogota(TODAY, "07:00"),
          }),
          appointment("c", TODAY, "12:20", 20),
        ],
      }),
      TODAY,
      NOW,
    );
    expect(attended).toMatchObject({
      kind: "appointment",
      look: "attended",
      markable: false,
    });
    expect(started).toMatchObject({
      kind: "appointment",
      look: "new",
      markable: true,
    });
    expect(coming).toMatchObject({
      kind: "appointment",
      look: "manual",
      markable: false,
    });
  });

  it("removes only own blocks that have not ended, while the barbershop is writable", () => {
    const blocks = [
      block("past", TODAY, "08:00", "09:00"),
      block("own", TODAY, "13:00", "14:00"),
      block("closure", TODAY, "18:00", "19:00", { own: false, reason: null }),
    ];
    const removable = (writable: boolean) =>
      dayItems(
        data({ blocks, barbershop: { name: "S", writable } }),
        TODAY,
        NOW,
      ).map((item) => item.kind === "block" && item.removable);
    expect(removable(true)).toEqual([false, true, false]);
    expect(removable(false)).toEqual([false, false, false]);
  });
});

describe("todaySummary", () => {
  it("counts today's appointments and the next one to start", () => {
    const summary = todaySummary(
      data({
        appointments: [
          appointment("a", TODAY, "09:20", 40, { status: "attended" }),
          appointment("b", TODAY, "10:40", 60),
          appointment("c", TODAY, "12:20", 20),
          appointment("d", "2026-11-08", "09:00", 30),
        ],
      }),
      TODAY,
      NOW,
    );
    expect(summary.count).toBe(3);
    expect(summary.next).toEqual(fromBogota(TODAY, "10:40"));
  });

  it("has no next one when they all started", () => {
    const summary = todaySummary(
      data({ appointments: [appointment("a", TODAY, "08:00", 30)] }),
      TODAY,
      NOW,
    );
    expect(summary).toEqual({ count: 1, next: null });
  });
});

describe("weekDays", () => {
  const week = [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ];

  it("gives each day its working hours and its appointments", () => {
    const days = weekDays(
      data({
        appointments: [
          appointment("a", "2026-11-09", "10:00", 30),
          appointment("b", "2026-11-09", "11:00", 30),
          appointment("c", "2026-11-14", "09:00", 30),
        ],
      }),
      week,
    );
    expect(days[0]).toEqual({
      date: "2026-11-09",
      hours: { start: "09:00", end: "19:00" },
      count: 2,
    });
    expect(days[5]?.count).toBe(1);
    // Sunday: the barbershop does not open.
    expect(days[6]).toEqual({ date: "2026-11-15", hours: null, count: 0 });
  });

  it("uses the barber's own shifts inside the barbershop's hours", () => {
    const [monday, tuesday] = weekDays(
      data({
        schedule: {
          usesBarbershopHours: false,
          shifts: [{ weekday: 1, start: "08:00", end: "14:00" }],
        },
      }),
      week,
    );
    expect(monday?.hours).toEqual({ start: "09:00", end: "14:00" });
    expect(tuesday?.hours).toBeNull();
  });
});

describe("block options", () => {
  it("offers today to 30 days ahead", () => {
    const days = blockDayOptions(TODAY);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe(TODAY);
    expect(days.at(-1)).toBe("2026-12-07");
  });

  it("offers the quarter hours of a day", () => {
    const times = blockTimeOptions();
    expect(times).toHaveLength(96);
    expect(times[0]).toBe("00:00");
    expect(times[61]).toBe("15:15");
    expect(times.at(-1)).toBe("23:45");
  });
});

describe("parseBlockForm", () => {
  const valid = {
    dia: TODAY,
    desde: "15:00",
    hasta: "16:00",
    motivo: "errand",
  };

  it("turns the form into the instants of the block and its reason", () => {
    expect(parseBlockForm(valid, TODAY, NOW)).toEqual({
      success: true,
      data: {
        start: fromBogota(TODAY, "15:00"),
        end: fromBogota(TODAY, "16:00"),
        reason: "errand",
      },
    });
    expect(
      parseBlockForm({ ...valid, motivo: "other" }, TODAY, NOW),
    ).toMatchObject({
      success: true,
      data: { reason: "other" },
    });
  });

  it("asks for a day in the window, quarter hours and an end after the start", () => {
    const errors = (input: Partial<typeof valid>) => {
      const result = parseBlockForm({ ...valid, ...input }, TODAY, NOW);
      return result.success ? null : result.errors;
    };
    expect(errors({ dia: "2026-12-08" })).toEqual({ dia: "invalid" });
    expect(errors({ desde: "15:10" })).toEqual({ desde: "invalid" });
    expect(errors({ hasta: "15:00" })).toEqual({ hasta: "end_before_start" });
    expect(errors({ motivo: "vacaciones" })).toEqual({ motivo: "invalid" });
  });

  it("does not block what already passed today", () => {
    expect(
      parseBlockForm({ ...valid, desde: "08:00", hasta: "09:00" }, TODAY, NOW),
    ).toEqual({
      success: false,
      errors: { desde: "in_the_past" },
    });
    // The current quarter hour still counts.
    expect(
      parseBlockForm(
        { ...valid, desde: "10:00", hasta: "10:30" },
        TODAY,
        fromBogota(TODAY, "10:10"),
      ).success,
    ).toBe(true);
  });
});
