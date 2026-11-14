import { describe, expect, it } from "vitest";
import {
  COMMISSION_OPTIONS,
  closeCsv,
  commissionOf,
  dayClose,
  parseCloseDay,
  parseCommission,
  type CloseAppointment,
  type CloseBarber,
} from "./day-close";

const barbers: CloseBarber[] = [
  { id: "andres", name: "Andrés", isOwner: false, sortOrder: 2 },
  { id: "mario", name: "Mario", isOwner: true, sortOrder: 1 },
  { id: "kevin", name: "Kevin", isOwner: false, sortOrder: 3 },
  { id: "julian", name: "Julián", isOwner: false, sortOrder: 4 },
];

const attended = (barberId: string, ...prices: number[]): CloseAppointment => ({
  barberId,
  status: "attended",
  lines: prices.map((priceCop) => ({ priceCop })),
});

describe("dayClose (D-64)", () => {
  const appointments: CloseAppointment[] = [
    attended("mario", 35000, 15000),
    attended("mario", 50000),
    attended("andres", 25000, 15000),
    attended("andres", 25000),
    { barberId: "kevin", status: "no_show", lines: [{ priceCop: 25000 }] },
    { barberId: "kevin", status: "confirmed", lines: [{ priceCop: 25000 }] },
    { barberId: "andres", status: "confirmed", lines: [{ priceCop: 25000 }] },
    {
      barberId: "kevin",
      status: "cancelled_by_customer",
      lines: [{ priceCop: 25000 }],
    },
  ];

  it("adds up what was attended, from the prices each line copied", () => {
    const close = dayClose({ appointments, barbers, commissionPercent: 40 });
    expect(close).toMatchObject({
      totalCop: 165000,
      servicesAttended: 6,
      noShows: 1,
      pending: 2,
    });
  });

  it("lists the barbers with something attended, in the team's order (decision C8)", () => {
    const close = dayClose({ appointments, barbers, commissionPercent: 40 });
    expect(close.byBarber).toEqual([
      // The owner who also cuts has no commission (decision C2).
      {
        barberId: "mario",
        name: "Mario",
        attended: 3,
        totalCop: 100000,
        commissionCop: null,
      },
      {
        barberId: "andres",
        name: "Andrés",
        attended: 3,
        totalCop: 65000,
        commissionCop: 26000,
      },
    ]);
  });

  it("shows no commission while the barbershop has none (decision C1)", () => {
    const close = dayClose({ appointments, barbers, commissionPercent: 0 });
    expect(close.byBarber.map((row) => row.commissionCop)).toEqual([
      null,
      null,
    ]);
  });

  it("is empty on a day without appointments", () => {
    expect(
      dayClose({ appointments: [], barbers, commissionPercent: 40 }),
    ).toEqual({
      totalCop: 0,
      servicesAttended: 0,
      noShows: 0,
      pending: 0,
      byBarber: [],
    });
  });

  it("names a barber who left the team by what it knows", () => {
    const close = dayClose({
      appointments: [attended("gone", 20000)],
      barbers,
      commissionPercent: 40,
    });
    expect(close.byBarber).toEqual([
      {
        barberId: "gone",
        name: "",
        attended: 1,
        totalCop: 20000,
        commissionCop: 8000,
      },
    ]);
  });
});

describe("commissionOf", () => {
  it("rounds to the peso, half a peso up", () => {
    expect(commissionOf(105000, 40)).toBe(42000);
    expect(commissionOf(12345, 35)).toBe(4321);
    expect(commissionOf(12347, 35)).toBe(4321);
    expect(commissionOf(10001, 50)).toBe(5001);
    expect(commissionOf(0, 40)).toBe(0);
  });
});

describe("parseCommission", () => {
  it("takes 0 to 100 in steps of 5", () => {
    expect(COMMISSION_OPTIONS).toHaveLength(21);
    expect(parseCommission("40")).toBe(40);
    expect(parseCommission("0")).toBe(0);
    expect(parseCommission("42")).toBeNull();
    expect(parseCommission("105")).toBeNull();
    expect(parseCommission("abc")).toBeNull();
  });
});

describe("parseCloseDay (decision C4)", () => {
  const today = "2026-11-07";
  it("opens today, or a past day, never a future one", () => {
    expect(parseCloseDay(undefined, today)).toBe(today);
    expect(parseCloseDay("2026-11-01", today)).toBe("2026-11-01");
    expect(parseCloseDay("2026-11-08", today)).toBe(today);
    expect(parseCloseDay("nope", today)).toBe(today);
    expect(parseCloseDay(["2026-11-01"], today)).toBe(today);
  });
});

describe("closeCsv (decision C3)", () => {
  it("writes one row per barber and the totals, in whole pesos", () => {
    const close = dayClose({
      appointments: [
        attended("mario", 50000),
        attended("andres", 25000, 15000),
      ],
      barbers,
      commissionPercent: 40,
    });
    const csv = closeCsv(close, {
      heading: ["Barbero", "Servicios atendidos", "Total", "Comisión"],
      totals: "Total",
    });
    expect(csv).toBe(
      [
        "﻿Barbero;Servicios atendidos;Total;Comisión",
        "Mario;1;50000;",
        "Andrés;2;40000;16000",
        "Total;3;90000;16000",
        "",
      ].join("\r\n"),
    );
  });

  it("quotes a name that could break a row", () => {
    const close = dayClose({
      appointments: [attended("x", 1000)],
      barbers: [
        { id: "x", name: 'Juan "El; Mono"', isOwner: false, sortOrder: 1 },
      ],
      commissionPercent: 0,
    });
    expect(
      closeCsv(close, { heading: ["a", "b", "c", "d"], totals: "T" }),
    ).toContain('"Juan ""El; Mono""";1;1000;');
  });
});
