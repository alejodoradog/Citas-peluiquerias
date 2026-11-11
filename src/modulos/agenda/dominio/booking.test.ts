import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_BOOKING_MINUTES,
  MAX_SERVICES_PER_BOOKING,
  OCCUPYING_STATUSES,
  bookingDuration,
  eligibleBarbers,
  takesTheTime,
} from "./booking";

const service = (id: string, durationMinutes: number) => ({
  id,
  durationMinutes,
});

describe("bookingDuration", () => {
  it("adds the chosen services: corte 40 + barba 20 = 60 (spec example)", () => {
    expect(
      bookingDuration([service("corte", 40), service("barba", 20)]),
    ).toEqual({ ok: true, minutes: 60 });
  });

  it("takes one service alone", () => {
    expect(bookingDuration([service("cejas", 5)])).toEqual({
      ok: true,
      minutes: 5,
    });
  });

  it("takes up to 5 services and up to 480 minutes", () => {
    expect(MAX_SERVICES_PER_BOOKING).toBe(5);
    expect(MAX_BOOKING_MINUTES).toBe(480);
    const five = ["a", "b", "c", "d", "e"].map((id) => service(id, 95));
    expect(bookingDuration(five)).toEqual({ ok: true, minutes: 475 });
    expect(bookingDuration([service("a", 240), service("b", 240)])).toEqual({
      ok: true,
      minutes: 480,
    });
  });

  it("refuses no service, more than 5 and the same service twice", () => {
    expect(bookingDuration([])).toEqual({ ok: false, error: "services_empty" });
    const six = ["a", "b", "c", "d", "e", "f"].map((id) => service(id, 10));
    expect(bookingDuration(six)).toEqual({
      ok: false,
      error: "services_too_many",
    });
    expect(bookingDuration([service("a", 10), service("a", 10)])).toEqual({
      ok: false,
      error: "services_repeated",
    });
  });

  it("refuses a duration the database would not hold", () => {
    for (const minutes of [0, 4, 7, 245, 12.5, Number.NaN]) {
      expect(bookingDuration([service("a", minutes)])).toEqual({
        ok: false,
        error: "service_duration_invalid",
      });
    }
  });

  it("refuses a sum over 480 minutes", () => {
    expect(
      bookingDuration([service("a", 240), service("b", 240), service("c", 5)]),
    ).toEqual({ ok: false, error: "booking_too_long" });
  });
});

describe("eligibleBarbers", () => {
  const barbers = [
    { id: "ana", active: true, serviceIds: ["corte", "barba"] },
    { id: "beto", active: true, serviceIds: ["corte"] },
    { id: "caro", active: false, serviceIds: ["corte", "barba"] },
  ];

  it("keeps only active barbers who offer every chosen service", () => {
    expect(
      eligibleBarbers(barbers, ["corte", "barba"]).map((b) => b.id),
    ).toEqual(["ana"]);
    expect(eligibleBarbers(barbers, ["corte"]).map((b) => b.id)).toEqual([
      "ana",
      "beto",
    ]);
  });

  it("leaves out a deactivated barber even if they offer everything", () => {
    expect(eligibleBarbers(barbers, ["barba"]).map((b) => b.id)).toEqual([
      "ana",
    ]);
  });

  it("finds nobody for a service no one offers", () => {
    expect(eligibleBarbers(barbers, ["tinte"])).toEqual([]);
  });
});

describe("statuses that take the time", () => {
  it("are confirmed, attended and no_show; cancelled ones free it", () => {
    expect(takesTheTime("confirmed")).toBe(true);
    expect(takesTheTime("attended")).toBe(true);
    expect(takesTheTime("no_show")).toBe(true);
    expect(takesTheTime("cancelled_by_customer")).toBe(false);
    expect(takesTheTime("cancelled_by_barbershop")).toBe(false);
  });

  it("match the appointments exclusion constraint", () => {
    const migrations = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(migrations)
      .sort()
      .map((file) => readFileSync(join(migrations, file), "utf8"))
      .filter((text) =>
        /tstzrange\(starts_at, ends_at, '\[\)'\) with &&/.test(text),
      )
      .at(-1);
    const list = /where \(status in \(([^)]*)\)\)/.exec(sql ?? "")?.[1];
    const statuses = (list ?? "")
      .split(",")
      .map((value) => value.trim().replace(/'/g, ""));
    expect([...statuses].sort()).toEqual([...OCCUPYING_STATUSES].sort());
  });
});
