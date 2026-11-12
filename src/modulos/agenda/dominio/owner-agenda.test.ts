import { describe, expect, it } from "vitest";
import { fromBogota, toBogotaTime } from "@/lib/fechas/fechas";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { barberWorkingIntervals } from "./availability";
import {
  NEW_BOOKING_HOURS,
  appointmentLook,
  barberDay,
  gridHours,
  parseAgendaQuery,
  shortCustomerName,
  shownBarbers,
  splitAtHours,
  weekOf,
  weekSummary,
  type AgendaAppointment,
  type AgendaBarber,
  type AgendaBlock,
  type AgendaData,
} from "./owner-agenda";

// Saturday, November 7, 2026 (the day of D-30) and Monday the 9th.
const SATURDAY = "2026-11-07";
const MONDAY = "2026-11-09";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const at = (date: string, time: string) => fromBogota(date, time);
const hhmm = (instant: Date) => toBogotaTime(instant);

// Open 9:00 to 19:00 every day.
const SHOP: WeeklyShift[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  start: "09:00",
  end: "19:00",
}));

const barber = (
  id: string,
  fields: Partial<AgendaBarber> = {},
): AgendaBarber => ({
  id,
  name: id === ID_A ? "Mario" : "Kevin",
  sortOrder: id === ID_A ? 1 : 2,
  active: true,
  usesBarbershopHours: true,
  shifts: [],
  ...fields,
});

const appointment = (
  fields: Partial<AgendaAppointment> & { start: Date; end: Date },
): AgendaAppointment => ({
  id: `cita-${fields.start.toISOString()}`,
  barberId: ID_A,
  status: "confirmed",
  source: "web",
  createdAt: new Date("2026-11-01T12:00:00Z"),
  customerName: "Luis García",
  serviceNames: ["Corte"],
  ...fields,
});

const block = (
  fields: Partial<AgendaBlock> & { start: Date; end: Date },
): AgendaBlock => ({
  id: `bloqueo-${fields.start.toISOString()}`,
  barberId: ID_A,
  reason: "Almuerzo",
  ...fields,
});

const data = (
  fields: Partial<Omit<AgendaData, "barbers">> = {},
): Omit<AgendaData, "barbers"> => ({
  shopHours: SHOP,
  holidayOpenings: [],
  appointments: [],
  blocks: [],
  ...fields,
});

describe("parseAgendaQuery", () => {
  it("defaults to today, the day view and every barber", () => {
    expect(parseAgendaQuery({}, SATURDAY)).toEqual({
      view: "dia",
      date: SATURDAY,
      barberId: null,
    });
  });

  it("reads the week view, a day and a barber", () => {
    expect(
      parseAgendaQuery(
        { vista: "semana", dia: MONDAY, barbero: ID_A },
        SATURDAY,
      ),
    ).toEqual({ view: "semana", date: MONDAY, barberId: ID_A });
  });

  it("ignores what is not a view, a real day or an id", () => {
    expect(
      parseAgendaQuery(
        { vista: "mes", dia: "2026-02-30", barbero: "todos" },
        SATURDAY,
      ),
    ).toEqual({ view: "dia", date: SATURDAY, barberId: null });
    expect(
      parseAgendaQuery({ dia: [MONDAY, MONDAY], barbero: [ID_A] }, SATURDAY),
    ).toEqual({ view: "dia", date: SATURDAY, barberId: null });
  });
});

describe("appointmentLook", () => {
  const now = at(SATURDAY, "10:50");

  it("follows the state of the appointment", () => {
    expect(appointmentLook({ ...base(), status: "attended" }, now)).toBe(
      "attended",
    );
    expect(appointmentLook({ ...base(), status: "no_show" }, now)).toBe(
      "no_show",
    );
    expect(appointmentLook(base(), now)).toBe("confirmed");
  });

  it("calls a confirmed web booking of the last 24 hours new", () => {
    const hoursAgo = (hours: number) =>
      new Date(now.getTime() - hours * 3_600_000);
    expect(appointmentLook({ ...base(), createdAt: hoursAgo(1) }, now)).toBe(
      "new",
    );
    expect(
      appointmentLook(
        { ...base(), createdAt: hoursAgo(NEW_BOOKING_HOURS - 0.01) },
        now,
      ),
    ).toBe("new");
    expect(
      appointmentLook(
        { ...base(), createdAt: hoursAgo(NEW_BOOKING_HOURS) },
        now,
      ),
    ).toBe("confirmed");
    expect(
      appointmentLook(
        { ...base(), status: "attended", createdAt: hoursAgo(1) },
        now,
      ),
    ).toBe("attended");
  });

  it("draws a confirmed manual appointment as manual, never as new", () => {
    expect(
      appointmentLook({ ...base(), source: "manual", createdAt: now }, now),
    ).toBe("manual");
  });

  function base() {
    return {
      status: "confirmed" as const,
      source: "web" as const,
      createdAt: new Date("2026-11-01T12:00:00Z"),
    };
  }
});

describe("shortCustomerName", () => {
  it("keeps the first name and the initial of the next word", () => {
    expect(shortCustomerName("Luis García")).toBe("Luis G.");
    expect(shortCustomerName("  camila   rojas pérez ")).toBe("camila R.");
    expect(shortCustomerName("Juan")).toBe("Juan");
    expect(shortCustomerName("Ana Úrsula")).toBe("Ana Ú.");
    expect(shortCustomerName("   ")).toBe("");
  });
});

describe("weekOf", () => {
  it("goes from Monday to Sunday", () => {
    expect(weekOf(SATURDAY)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(weekOf("2026-11-08")[0]).toBe("2026-11-02");
    expect(weekOf(MONDAY)[0]).toBe(MONDAY);
    expect(weekOf("2026-12-31")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("shownBarbers", () => {
  it("shows the active barbers in the team's order", () => {
    const barbers = [
      barber(ID_B),
      barber(ID_A),
      barber("33333333-3333-4333-8333-333333333333", {
        active: false,
        sortOrder: 0,
      }),
    ];
    expect(shownBarbers(barbers, []).map((b) => b.id)).toEqual([ID_A, ID_B]);
  });

  it("keeps an inactive barber while they have appointments", () => {
    const gone = barber(ID_B, { active: false });
    expect(
      shownBarbers([gone], [{ barberId: ID_B, status: "confirmed" }]),
    ).toEqual([gone]);
    expect(
      shownBarbers(
        [gone],
        [{ barberId: ID_B, status: "cancelled_by_customer" }],
      ),
    ).toEqual([]);
  });
});

describe("barberDay", () => {
  // Before the barbershop opens, so the whole day is ahead.
  const early = at(SATURDAY, "06:00");

  it("is free all the hours the barber works", () => {
    const day = barberDay(SATURDAY, barber(ID_A), data(), early);
    expect(day.items).toEqual([
      {
        kind: "free",
        start: at(SATURDAY, "09:00"),
        end: at(SATURDAY, "19:00"),
      },
    ]);
  });

  it("puts appointments and blocks in order, with the free spaces between", () => {
    const cut = appointment({
      start: at(SATURDAY, "09:00"),
      end: at(SATURDAY, "09:40"),
      status: "attended",
    });
    const lunch = block({
      start: at(SATURDAY, "13:00"),
      end: at(SATURDAY, "14:00"),
    });
    const day = barberDay(
      SATURDAY,
      barber(ID_A),
      data({ appointments: [cut], blocks: [lunch] }),
      early,
    );
    expect(
      day.items.map((item) => [item.kind, hhmm(item.start), hhmm(item.end)]),
    ).toEqual([
      ["appointment", "09:00", "09:40"],
      ["free", "09:40", "13:00"],
      ["block", "13:00", "14:00"],
      ["free", "14:00", "19:00"],
    ]);
    expect(day.items[0]).toMatchObject({ look: "attended" });
    expect(day.items[2]).toMatchObject({
      reason: "Almuerzo",
      wholeShop: false,
    });
  });

  it("leaves out cancelled appointments and other barbers' things", () => {
    const day = barberDay(
      SATURDAY,
      barber(ID_A),
      data({
        appointments: [
          appointment({
            start: at(SATURDAY, "10:00"),
            end: at(SATURDAY, "11:00"),
            status: "cancelled_by_barbershop",
          }),
          appointment({
            start: at(SATURDAY, "12:00"),
            end: at(SATURDAY, "13:00"),
            barberId: ID_B,
          }),
        ],
        blocks: [
          block({
            start: at(SATURDAY, "15:00"),
            end: at(SATURDAY, "16:00"),
            barberId: ID_B,
          }),
        ],
      }),
      early,
    );
    expect(day.items).toEqual([
      {
        kind: "free",
        start: at(SATURDAY, "09:00"),
        end: at(SATURDAY, "19:00"),
      },
    ]);
  });

  it("draws a closure of the barbershop in every column, cut to the day", () => {
    const closure = block({
      start: at("2026-11-06", "00:00"),
      end: at("2026-11-08", "00:00"),
      barberId: null,
      reason: null,
    });
    for (const id of [ID_A, ID_B]) {
      const day = barberDay(
        SATURDAY,
        barber(id),
        data({ blocks: [closure] }),
        early,
      );
      expect(day.items).toEqual([
        {
          kind: "block",
          start: at(SATURDAY, "00:00"),
          end: at("2026-11-08", "00:00"),
          id: closure.id,
          reason: null,
          wholeShop: true,
        },
      ]);
    }
  });

  it("offers free spaces only from now on, from a whole 5 minutes", () => {
    const day = barberDay(
      SATURDAY,
      barber(ID_A),
      data(),
      at(SATURDAY, "10:52"),
    );
    expect(day.items).toEqual([
      {
        kind: "free",
        start: at(SATURDAY, "10:55"),
        end: at(SATURDAY, "19:00"),
      },
    ]);
    expect(
      barberDay(SATURDAY, barber(ID_A), data(), at(SATURDAY, "19:00")).items,
    ).toEqual([]);
    expect(
      barberDay("2026-11-06", barber(ID_A), data(), at(SATURDAY, "08:00"))
        .items,
    ).toEqual([]);
  });

  it("skips a gap shorter than 5 minutes", () => {
    const day = barberDay(
      SATURDAY,
      barber(ID_A),
      data({
        appointments: [
          appointment({
            start: at(SATURDAY, "09:00"),
            end: at(SATURDAY, "18:57"),
          }),
        ],
      }),
      early,
    );
    expect(day.items.map((item) => item.kind)).toEqual(["appointment"]);
  });

  it("gives an inactive barber no free space, but keeps their appointments", () => {
    const cut = appointment({
      start: at(SATURDAY, "10:00"),
      end: at(SATURDAY, "10:30"),
    });
    const day = barberDay(
      SATURDAY,
      barber(ID_A, { active: false }),
      data({ appointments: [cut] }),
      early,
    );
    expect(day.items.map((item) => item.kind)).toEqual(["appointment"]);
  });

  it("uses the barber's own hours inside the barbershop's", () => {
    const own = barber(ID_A, {
      usesBarbershopHours: false,
      shifts: [
        { weekday: 6, start: "08:00", end: "12:00" },
        { weekday: 6, start: "14:00", end: "20:00" },
      ],
    });
    const day = barberDay(SATURDAY, own, data(), early);
    expect(day.items.map((item) => [hhmm(item.start), hhmm(item.end)])).toEqual(
      [
        ["09:00", "12:00"],
        ["14:00", "19:00"],
      ],
    );
  });

  it("is closed on a holiday the barbershop does not open", () => {
    // Monday, November 16, 2026: Independencia de Cartagena (moved).
    const holiday = "2026-11-16";
    const now = at("2026-11-15", "08:00");
    expect(barberDay(holiday, barber(ID_A), data(), now).items).toEqual([]);
    expect(
      barberDay(
        holiday,
        barber(ID_A),
        data({ holidayOpenings: [holiday] }),
        now,
      ).items,
    ).toHaveLength(1);
  });
});

describe("splitAtHours", () => {
  const pieces = (from: string, to: string) =>
    splitAtHours({ start: at(SATURDAY, from), end: at(SATURDAY, to) }).map(
      (piece) => [hhmm(piece.start), hhmm(piece.end)],
    );

  it("cuts a free space at each whole hour", () => {
    expect(pieces("09:30", "12:30")).toEqual([
      ["09:30", "10:00"],
      ["10:00", "11:00"],
      ["11:00", "12:00"],
      ["12:00", "12:30"],
    ]);
    expect(pieces("10:00", "11:00")).toEqual([["10:00", "11:00"]]);
  });

  it("joins a piece shorter than 30 minutes to its neighbour", () => {
    expect(pieces("09:40", "12:20")).toEqual([
      ["09:40", "11:00"],
      ["11:00", "12:20"],
    ]);
    expect(pieces("10:55", "11:10")).toEqual([]);
    expect(pieces("10:40", "11:20")).toEqual([["10:40", "11:20"]]);
  });

  it("leaves no piece for a space shorter than 30 minutes", () => {
    expect(pieces("12:20", "12:45")).toEqual([]);
    expect(pieces("12:20", "12:50")).toEqual([["12:20", "12:50"]]);
  });
});

describe("gridHours", () => {
  const early = at(SATURDAY, "06:00");

  it("covers the whole hours anyone works or has an appointment", () => {
    const late = appointment({
      start: at(SATURDAY, "19:30"),
      end: at(SATURDAY, "20:10"),
    });
    const days = [
      barberDay(SATURDAY, barber(ID_A), data({ appointments: [late] }), early),
      barberDay(SATURDAY, barber(ID_B), data(), early),
    ];
    const hours = gridHours(SATURDAY, days)!;
    expect(hhmm(hours.from)).toBe("09:00");
    expect(hhmm(hours.until)).toBe("21:00");
  });

  it("is null when the day is closed, even with a closure", () => {
    const closure = block({
      start: at(SATURDAY, "00:00"),
      end: at("2026-11-08", "00:00"),
      barberId: null,
    });
    const days = [
      barberDay(
        SATURDAY,
        barber(ID_A),
        data({ shopHours: [], blocks: [closure] }),
        early,
      ),
    ];
    expect(gridHours(SATURDAY, days)).toBeNull();
    expect(gridHours(SATURDAY, [])).toBeNull();
  });
});

describe("weekSummary", () => {
  it("counts each day's appointments per barber and how full it is", () => {
    // Closed on Sundays.
    const shopHours = SHOP.filter((shift) => shift.weekday !== 0);
    const appointments = [
      appointment({ start: at(MONDAY, "09:00"), end: at(MONDAY, "11:00") }),
      appointment({
        start: at(MONDAY, "12:00"),
        end: at(MONDAY, "13:00"),
        barberId: ID_B,
        status: "no_show",
      }),
      appointment({
        start: at(MONDAY, "14:00"),
        end: at(MONDAY, "15:00"),
        barberId: ID_B,
        status: "cancelled_by_customer",
      }),
    ];
    const [monday, tuesday, , , , , sunday] = weekSummary(
      weekOf(MONDAY),
      [barber(ID_A), barber(ID_B)],
      data({ shopHours, appointments }),
    );
    expect(monday).toEqual({
      date: MONDAY,
      count: 2,
      perBarber: [
        { barberId: ID_A, name: "Mario", count: 1 },
        { barberId: ID_B, name: "Kevin", count: 1 },
      ],
      // 3 booked hours of 20 worked.
      occupancy: 3 / 20,
      closed: false,
    });
    expect(tuesday).toMatchObject({ count: 0, occupancy: 0, closed: false });
    expect(sunday).toMatchObject({ count: 0, closed: true });
  });

  it("counts only the barbers it is given", () => {
    const [monday] = weekSummary(
      [MONDAY],
      [barber(ID_B)],
      data({
        appointments: [
          appointment({ start: at(MONDAY, "09:00"), end: at(MONDAY, "10:00") }),
        ],
      }),
    );
    expect(monday).toMatchObject({ count: 0, occupancy: 0 });
  });

  it("is never fuller than full", () => {
    const [monday] = weekSummary(
      [MONDAY],
      [barber(ID_A, { usesBarbershopHours: false, shifts: [] })],
      data({
        appointments: [
          appointment({ start: at(MONDAY, "09:00"), end: at(MONDAY, "10:00") }),
        ],
      }),
    );
    // Booked, but the barber has no hours that day: not closed.
    expect(monday).toMatchObject({ count: 1, occupancy: 0, closed: false });
  });
});

describe("barberWorkingIntervals", () => {
  it("is the barbershop's hours, cut to the barber's", () => {
    expect(
      barberWorkingIntervals(
        SATURDAY,
        {
          usesBarbershopHours: false,
          shifts: [{ weekday: 6, start: "07:00", end: "10:30" }],
        },
        SHOP,
        [],
      ),
    ).toEqual([{ start: at(SATURDAY, "09:00"), end: at(SATURDAY, "10:30") }]);
    expect(
      barberWorkingIntervals(
        SATURDAY,
        { usesBarbershopHours: true, shifts: [] },
        [{ weekday: 6, start: "20:00", end: "24:00" }],
        [],
      ),
    ).toEqual([
      { start: at(SATURDAY, "20:00"), end: at("2026-11-08", "00:00") },
    ]);
  });

  it("refuses a date that does not exist", () => {
    expect(() =>
      barberWorkingIntervals(
        "2026-02-30",
        { usesBarbershopHours: true, shifts: [] },
        SHOP,
        [],
      ),
    ).toThrow(RangeError);
  });
});
