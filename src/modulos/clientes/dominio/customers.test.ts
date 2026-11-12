import { describe, expect, it } from "vitest";
import {
  customerListHref,
  databaseFilter,
  dayParts,
  displayPhone,
  listActivity,
  MAX_NOTES_LENGTH,
  MAX_SEARCH_LENGTH,
  NO_SHOW_ALERT_FROM,
  parseCustomerNotes,
  readCustomerListParams,
  showsNoShowAlert,
  sinceParts,
  sortHistory,
  summarizeHistory,
  type HistoryEntry,
} from "./customers";

const entry = (
  id: string,
  startsAt: string,
  status: HistoryEntry["status"],
  priceCop = 25_000,
): HistoryEntry => ({
  id,
  startsAt: new Date(startsAt),
  status,
  priceCop,
  services: ["Corte"],
  barber: "Andrés",
});

describe("the no-show alert", () => {
  it("shows from 2 no-shows, as the spec says", () => {
    expect(NO_SHOW_ALERT_FROM).toBe(2);
    expect(showsNoShowAlert(0)).toBe(false);
    expect(showsNoShowAlert(1)).toBe(false);
    expect(showsNoShowAlert(2)).toBe(true);
    expect(showsNoShowAlert(7)).toBe(true);
  });
});

describe("summarizeHistory", () => {
  const history = [
    entry("a", "2026-10-24T22:00:00Z", "attended", 35_000),
    entry("b", "2026-10-12T16:00:00Z", "no_show"),
    entry("c", "2026-11-07T15:20:00Z", "no_show"),
    entry("d", "2026-09-28T21:20:00Z", "attended"),
    entry("e", "2026-09-20T21:20:00Z", "cancelled_by_customer"),
    entry("f", "2026-09-10T21:20:00Z", "cancelled_by_barbershop"),
    entry("g", "2026-12-01T21:20:00Z", "confirmed"),
  ];

  it("counts attended appointments as visits and what they cost, in whole pesos", () => {
    const summary = summarizeHistory(history);
    expect(summary.visits).toBe(2);
    expect(summary.totalSpentCop).toBe(60_000);
    expect(Number.isInteger(summary.totalSpentCop)).toBe(true);
  });

  it("counts the no-shows and lists their days, the latest first", () => {
    const summary = summarizeHistory(history);
    expect(summary.noShows).toBe(2);
    expect(summary.noShowDays.map((day) => day.toISOString())).toEqual([
      "2026-11-07T15:20:00.000Z",
      "2026-10-12T16:00:00.000Z",
    ]);
  });

  it("is all zeros without appointments", () => {
    expect(summarizeHistory([])).toEqual({
      visits: 0,
      noShows: 0,
      totalSpentCop: 0,
      noShowDays: [],
    });
  });
});

describe("sortHistory", () => {
  it("puts the latest first, an appointment to come on top", () => {
    const sorted = sortHistory([
      entry("a", "2026-10-01T15:00:00Z", "attended"),
      entry("b", "2026-12-01T15:00:00Z", "confirmed"),
      entry("c", "2026-11-01T15:00:00Z", "no_show"),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("orders two at the same time by id, and leaves the input alone", () => {
    const input = [
      entry("z", "2026-10-01T15:00:00Z", "attended"),
      entry("y", "2026-10-01T15:00:00Z", "attended"),
    ];
    expect(sortHistory(input).map((e) => e.id)).toEqual(["y", "z"]);
    expect(input.map((e) => e.id)).toEqual(["z", "y"]);
  });
});

describe("listActivity", () => {
  const next = new Date("2026-11-12T21:00:00Z");
  const last = new Date("2026-11-01T21:00:00Z");

  it("says the next appointment first", () => {
    expect(
      listActivity({ email: null, lastVisitAt: last, nextAppointmentAt: next }),
    ).toEqual({ kind: "next", at: next });
  });

  it("then that there is no email to write to", () => {
    expect(
      listActivity({ email: null, lastVisitAt: last, nextAppointmentAt: null }),
    ).toEqual({ kind: "noEmail" });
  });

  it("then the last visit", () => {
    expect(
      listActivity({
        email: "a@b.co",
        lastVisitAt: last,
        nextAppointmentAt: null,
      }),
    ).toEqual({ kind: "last", at: last });
  });

  it("or nothing", () => {
    expect(
      listActivity({
        email: "a@b.co",
        lastVisitAt: null,
        nextAppointmentAt: null,
      }),
    ).toEqual({ kind: "none" });
  });
});

describe("the list's URL", () => {
  it("reads the search and the filter", () => {
    expect(
      readCustomerListParams({ q: "  Diego ", filtro: "inasistencias" }),
    ).toEqual({ search: "Diego", filter: "inasistencias" });
    expect(readCustomerListParams({ filtro: "nuevos" })).toEqual({
      search: "",
      filter: "nuevos",
    });
  });

  it("takes the first of repeated values and cuts long searches", () => {
    const { search, filter } = readCustomerListParams({
      q: ["x".repeat(500), "otro"],
      filtro: ["todos", "nuevos"],
    });
    expect(search).toHaveLength(MAX_SEARCH_LENGTH);
    expect(filter).toBe("todos");
  });

  it("falls back to Todos for anything unknown", () => {
    expect(readCustomerListParams({ filtro: "borrados" }).filter).toBe("todos");
    expect(readCustomerListParams({}).filter).toBe("todos");
  });

  it("writes the search and the filter, leaving the defaults out", () => {
    const base = "/panel/clientes";
    expect(customerListHref(base, { search: "", filter: "todos" })).toBe(base);
    expect(
      customerListHref(base, { search: "Laura Vélez", filter: "nuevos" }),
    ).toBe("/panel/clientes?q=Laura+V%C3%A9lez&filtro=nuevos");
    expect(
      customerListHref(base, { search: "", filter: "inasistencias" }),
    ).toBe("/panel/clientes?filtro=inasistencias");
  });

  it("names the filters as the database does", () => {
    expect(databaseFilter("todos")).toBe("all");
    expect(databaseFilter("inasistencias")).toBe("no_shows");
    expect(databaseFilter("nuevos")).toBe("new");
  });
});

describe("days in Bogotá", () => {
  // 2026-11-11 21:00 in Bogotá.
  const now = new Date("2026-11-12T02:00:00Z");

  it("knows today in Bogotá, not in UTC", () => {
    // 2026-11-11 19:00 in Bogotá, already the 12th in UTC.
    expect(dayParts(new Date("2026-11-12T00:00:00Z"), now)).toEqual({
      today: true,
    });
  });

  it("gives the day and the month, 0-11, without this year", () => {
    expect(dayParts(new Date("2026-10-24T22:00:00Z"), now)).toEqual({
      today: false,
      day: 24,
      month: 9,
      year: null,
    });
  });

  it("adds the year of another year", () => {
    expect(dayParts(new Date("2025-12-03T15:00:00Z"), now)).toEqual({
      today: false,
      day: 3,
      month: 11,
      year: 2025,
    });
  });

  it("gives the month a customer started, in Bogotá", () => {
    // 2026-09-01 00:30 UTC is still August 31 in Bogotá.
    expect(sinceParts(new Date("2026-09-01T00:30:00Z"))).toEqual({
      month: 7,
      year: 2026,
    });
  });
});

describe("displayPhone", () => {
  it("writes a Colombian mobile as people read it", () => {
    expect(displayPhone("+573012223344")).toBe("301 222 3344");
  });

  it("leaves any other number as it is", () => {
    expect(displayPhone("+14155550100")).toBe("+14155550100");
  });
});

describe("parseCustomerNotes", () => {
  it("trims the notes", () => {
    expect(parseCustomerNotes({ notes: "  Degradado bajo.  " })).toEqual({
      success: true,
      data: { notes: "Degradado bajo." },
    });
  });

  it("saves empty notes as none", () => {
    expect(parseCustomerNotes({ notes: "   " })).toEqual({
      success: true,
      data: { notes: null },
    });
  });

  it("refuses notes longer than the database keeps", () => {
    expect(parseCustomerNotes({ notes: "a".repeat(MAX_NOTES_LENGTH) })).toEqual(
      { success: true, data: { notes: "a".repeat(MAX_NOTES_LENGTH) } },
    );
    expect(
      parseCustomerNotes({ notes: "a".repeat(MAX_NOTES_LENGTH + 1) }),
    ).toEqual({ success: false, errors: { notes: "notes_too_long" } });
  });
});
