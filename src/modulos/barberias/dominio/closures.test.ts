import { describe, expect, it } from "vitest";
import {
  CLOSURE_END_TIMES,
  CLOSURE_START_TIMES,
  MAX_CLOSURE_DAYS,
  describeClosure,
  parseClosureForm,
} from "./closures";

// 10:00 a. m. in Bogotá on Tuesday, November 10, 2026.
const NOW = new Date("2026-11-10T15:00:00Z");

const form = (fields: Partial<Record<string, string>> = {}) => ({
  fromDate: "2026-12-24",
  toDate: "2026-12-24",
  allDay: "on",
  fromTime: "09:00",
  toTime: "24:00",
  reason: "",
  ...fields,
});

describe("closure times", () => {
  it("start every 15 minutes of the day and end up to midnight", () => {
    expect(CLOSURE_START_TIMES[0]).toBe("00:00");
    expect(CLOSURE_START_TIMES.at(-1)).toBe("23:45");
    expect(CLOSURE_START_TIMES).toHaveLength(96);
    expect(CLOSURE_END_TIMES[0]).toBe("00:15");
    expect(CLOSURE_END_TIMES.at(-1)).toBe("24:00");
    expect(CLOSURE_END_TIMES).toHaveLength(96);
    expect(MAX_CLOSURE_DAYS).toBe(31);
  });
});

describe("parseClosureForm", () => {
  it("closes whole days from midnight to midnight in Bogotá", () => {
    expect(parseClosureForm(form({ toDate: "2026-12-26" }), NOW)).toEqual({
      success: true,
      data: {
        startsAt: new Date("2026-12-24T05:00:00Z"),
        endsAt: new Date("2026-12-27T05:00:00Z"),
        reason: null,
      },
    });
  });

  it("closes from an hour to the end of the day", () => {
    expect(
      parseClosureForm(
        form({ allDay: "", fromTime: "14:00", reason: "  Nochebuena " }),
        NOW,
      ),
    ).toEqual({
      success: true,
      data: {
        startsAt: new Date("2026-12-24T19:00:00Z"),
        endsAt: new Date("2026-12-25T05:00:00Z"),
        reason: "Nochebuena",
      },
    });
  });

  it("closes from an hour of one day to an hour of another", () => {
    const result = parseClosureForm(
      form({
        allDay: "",
        fromTime: "18:00",
        toDate: "2026-12-26",
        toTime: "11:00",
      }),
      NOW,
    );
    expect(result).toEqual({
      success: true,
      data: {
        startsAt: new Date("2026-12-24T23:00:00Z"),
        endsAt: new Date("2026-12-26T16:00:00Z"),
        reason: null,
      },
    });
  });

  it("closes the rest of today, which already started", () => {
    const result = parseClosureForm(
      form({ fromDate: "2026-11-10", toDate: "2026-11-10" }),
      NOW,
    );
    expect(result).toMatchObject({
      success: true,
      data: { startsAt: new Date("2026-11-10T05:00:00Z") },
    });
  });

  it("ignores the hours of a whole-day closure", () => {
    expect(
      parseClosureForm(form({ fromTime: "", toTime: "nope" }), NOW),
    ).toMatchObject({ success: true });
  });

  it("takes up to 31 days", () => {
    expect(parseClosureForm(form({ toDate: "2027-01-23" }), NOW)).toMatchObject(
      { success: true },
    );
    expect(parseClosureForm(form({ toDate: "2027-01-24" }), NOW)).toEqual({
      success: false,
      errors: { toDate: "closure_too_long" },
    });
  });

  it.each([
    [{ fromDate: "" }, { fromDate: "closure_date_invalid" }],
    [{ fromDate: "2026-02-30" }, { fromDate: "closure_date_invalid" }],
    [{ toDate: "24/12/2026" }, { toDate: "closure_date_invalid" }],
    [{ toDate: "2026-12-23" }, { toDate: "closure_order" }],
    [
      { allDay: "", fromTime: "14:00", toTime: "14:00" },
      { toTime: "closure_order" },
    ],
    [{ allDay: "", fromTime: "14:10" }, { fromTime: "closure_time_invalid" }],
    [{ allDay: "", fromTime: "24:00" }, { fromTime: "closure_time_invalid" }],
    [{ allDay: "", toTime: "00:00" }, { toTime: "closure_time_invalid" }],
    [{ allDay: "", toTime: "" }, { toTime: "closure_time_invalid" }],
    [
      { fromDate: "2026-11-09", toDate: "2026-11-09" },
      { toDate: "closure_past" },
    ],
    [
      {
        fromDate: "2026-11-10",
        toDate: "2026-11-10",
        allDay: "",
        fromTime: "08:00",
        toTime: "10:00",
      },
      { toTime: "closure_past" },
    ],
    [{ reason: "a".repeat(201) }, { reason: "closure_reason_too_long" }],
    [
      { fromDate: "9999-12-31", toDate: "9999-12-31" },
      { toDate: "closure_date_invalid" },
    ],
  ])("refuses %o", (fields, errors) => {
    expect(parseClosureForm(form(fields), NOW)).toEqual({
      success: false,
      errors,
    });
  });

  it("counts the reason in characters, as the database does", () => {
    expect(
      parseClosureForm(form({ reason: "💈".repeat(200) }), NOW),
    ).toMatchObject({ success: true });
  });
});

describe("describeClosure", () => {
  const at = (iso: string) => new Date(iso);

  it("reads a single whole day", () => {
    expect(
      describeClosure(at("2026-12-24T05:00:00Z"), at("2026-12-25T05:00:00Z")),
    ).toEqual({ kind: "day", date: "2026-12-24" });
  });

  it("reads several whole days, the last one included", () => {
    expect(
      describeClosure(at("2026-12-24T05:00:00Z"), at("2026-12-27T05:00:00Z")),
    ).toEqual({ kind: "days", from: "2026-12-24", to: "2026-12-26" });
  });

  it("reads a closure from an hour to the end of the day", () => {
    expect(
      describeClosure(at("2026-12-24T19:00:00Z"), at("2026-12-25T05:00:00Z")),
    ).toEqual({ kind: "from", date: "2026-12-24", time: "14:00" });
  });

  it("reads a closure from the start of the day to an hour", () => {
    expect(
      describeClosure(at("2026-12-24T05:00:00Z"), at("2026-12-24T16:00:00Z")),
    ).toEqual({ kind: "until", date: "2026-12-24", time: "11:00" });
  });

  it("reads hours within one day", () => {
    expect(
      describeClosure(at("2026-12-24T14:00:00Z"), at("2026-12-24T19:00:00Z")),
    ).toEqual({
      kind: "between",
      date: "2026-12-24",
      from: "09:00",
      to: "14:00",
    });
  });

  it("reads a span over several days, ending at midnight as 24:00", () => {
    expect(
      describeClosure(at("2026-12-24T23:00:00Z"), at("2026-12-26T16:00:00Z")),
    ).toEqual({
      kind: "span",
      from: { date: "2026-12-24", time: "18:00" },
      to: { date: "2026-12-26", time: "11:00" },
    });
    expect(
      describeClosure(at("2026-12-24T23:00:00Z"), at("2026-12-27T05:00:00Z")),
    ).toEqual({
      kind: "span",
      from: { date: "2026-12-24", time: "18:00" },
      to: { date: "2026-12-26", time: "24:00" },
    });
  });

  it("uses Bogotá days, not UTC ones, at the edges of the day", () => {
    // 11:00 p. m. on the 24th in Bogotá is already the 25th in UTC.
    expect(
      describeClosure(at("2026-12-25T04:00:00Z"), at("2026-12-25T05:00:00Z")),
    ).toEqual({ kind: "from", date: "2026-12-24", time: "23:00" });
  });
});
