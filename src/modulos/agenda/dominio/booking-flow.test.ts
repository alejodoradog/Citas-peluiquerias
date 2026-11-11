import { describe, expect, it } from "vitest";
import {
  bookingQuery,
  dayPart,
  FIRST_AVAILABLE,
  openingOf,
  readBookingParams,
  weekRows,
  windowDays,
} from "./booking-flow";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const BARBER = "33333333-3333-4333-8333-333333333333";

describe("readBookingParams", () => {
  it("starts at the services with nothing chosen", () => {
    expect(readBookingParams({})).toEqual({
      serviceIds: [],
      barber: null,
      date: null,
      time: null,
      step: "servicios",
      taken: null,
    });
  });

  it("walks to the first missing choice", () => {
    expect(readBookingParams({ servicios: A }).step).toBe("barbero");
    expect(
      readBookingParams({ servicios: [A, B], barbero: FIRST_AVAILABLE }).step,
    ).toBe("hora");
    expect(
      readBookingParams({
        servicios: A,
        barbero: BARBER,
        dia: "2026-11-24",
        hora: "10:30",
      }).step,
    ).toBe("datos");
  });

  it("goes back to an earlier step when asked, never forward", () => {
    const full = {
      servicios: A,
      barbero: BARBER,
      dia: "2026-11-24",
      hora: "10:30",
    };
    expect(readBookingParams({ ...full, paso: "hora" }).step).toBe("hora");
    expect(readBookingParams({ servicios: A, paso: "datos" }).step).toBe(
      "barbero",
    );
    expect(readBookingParams({ ...full, paso: "otro" }).step).toBe("datos");
  });

  it("drops what is not well formed", () => {
    const read = readBookingParams({
      servicios: [A, A.toUpperCase(), "1; drop table", B],
      barbero: "<script>",
      dia: "2026-02-30",
      hora: "10:05",
      tomada: "25:00",
    });
    expect(read.serviceIds).toEqual([A, B]);
    expect(read.barber).toBeNull();
    expect(read.date).toBeNull();
    expect(read.taken).toBeNull();
  });

  it("refuses more than 5 services and repeated single values", () => {
    const six = Array.from(
      { length: 6 },
      (_, i) => `${String(i).repeat(8)}-1111-4111-8111-111111111111`,
    );
    expect(readBookingParams({ servicios: six }).serviceIds).toEqual([]);
    expect(
      readBookingParams({ servicios: A, barbero: [BARBER, BARBER] }).barber,
    ).toBeNull();
  });

  it("keeps a time only with its day, and choices only after the services", () => {
    expect(
      readBookingParams({ servicios: A, barbero: BARBER, hora: "10:30" }).time,
    ).toBeNull();
    expect(
      readBookingParams({ barbero: BARBER, dia: "2026-11-24" }),
    ).toMatchObject({ barber: null, date: null });
    expect(readBookingParams({ tomada: "10:30" }).taken).toBe("10:30");
  });
});

describe("bookingQuery", () => {
  it("writes only the parts given, in order", () => {
    expect(bookingQuery({})).toBe("");
    expect(
      bookingQuery({
        serviceIds: [A, B],
        barber: FIRST_AVAILABLE,
        date: "2026-11-24",
        time: "10:30",
        step: "datos",
        taken: "09:00",
      }),
    ).toBe(
      `?servicios=${A}&servicios=${B}&barbero=primero&dia=2026-11-24&hora=10%3A30&paso=datos&tomada=09%3A00`,
    );
  });

  it("reads back what it writes", () => {
    const query = bookingQuery({
      serviceIds: [A],
      barber: BARBER,
      date: "2026-11-24",
      time: "10:30",
    });
    const params: Record<string, string | string[]> = {};
    for (const [key, value] of new URLSearchParams(query)) {
      const previous = params[key];
      params[key] = previous
        ? [...(Array.isArray(previous) ? previous : [previous]), value]
        : value;
    }
    expect(readBookingParams(params)).toMatchObject({
      serviceIds: [A],
      barber: BARBER,
      date: "2026-11-24",
      time: "10:30",
      step: "datos",
    });
  });
});

describe("dayPart", () => {
  it("splits the day at noon and 6 p. m.", () => {
    expect(dayPart("06:00")).toBe("morning");
    expect(dayPart("11:45")).toBe("morning");
    expect(dayPart("12:00")).toBe("afternoon");
    expect(dayPart("17:45")).toBe("afternoon");
    expect(dayPart("18:00")).toBe("evening");
  });
});

describe("openingOf", () => {
  const hours = [
    { weekday: 1, start: "09:00:00", end: "13:00:00" },
    { weekday: 1, start: "14:00:00", end: "19:00:00" },
    { weekday: 6, start: "08:00", end: "12:00" },
  ];

  it("goes from the first opening to the last closing", () => {
    expect(openingOf("2026-11-09", hours, [])).toEqual({
      start: "09:00",
      end: "19:00",
    });
  });

  it("is null on a closed day", () => {
    expect(openingOf("2026-11-08", hours, [])).toBeNull();
  });

  it("is null on a holiday the barbershop does not open, and open on one it does", () => {
    expect(openingOf("2026-11-16", hours, [])).toBeNull();
    expect(openingOf("2026-11-16", hours, ["2026-11-16"])).toEqual({
      start: "09:00",
      end: "19:00",
    });
  });
});

describe("weekRows", () => {
  it("joins consecutive days with the same hours, closed ones too", () => {
    const hours = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      start: "09:00:00",
      end: "20:00:00",
    }));
    expect(
      weekRows([...hours, { weekday: 6, start: "08:00", end: "21:00" }]),
    ).toEqual([
      { fromDay: 1, toDay: 5, shifts: [{ start: "09:00", end: "20:00" }] },
      { fromDay: 6, toDay: 6, shifts: [{ start: "08:00", end: "21:00" }] },
      { fromDay: 0, toDay: 0, shifts: [] },
    ]);
  });

  it("keeps split shifts in order", () => {
    expect(
      weekRows([
        { weekday: 1, start: "14:00", end: "19:00" },
        { weekday: 1, start: "09:00", end: "13:00" },
      ])[0],
    ).toEqual({
      fromDay: 1,
      toDay: 1,
      shifts: [
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "19:00" },
      ],
    });
  });
});

describe("windowDays", () => {
  it("lists every day, both ends included", () => {
    expect(windowDays("2026-11-30", "2026-12-02")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });
});
