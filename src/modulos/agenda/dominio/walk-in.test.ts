import { describe, expect, it } from "vitest";
import {
  parseWalkInBarber,
  parseWalkInClash,
  parseWalkInForm,
  walkInEnd,
  walkInStart,
  walkInTotals,
} from "./walk-in";

// Task 7.7: what the screen of "Cita al momento" shows before asking, and
// how it reads the database's refusal (decision D5).

const CORTE = "5e000000-0000-4000-8000-000000000001";
const BARBA = "5e000000-0000-4000-8000-000000000002";
const OTRO = "5e000000-0000-4000-8000-000000000009";
const SERVICES = [
  { id: CORTE, name: "Corte", durationMinutes: 30, priceCop: 25_000 },
  { id: BARBA, name: "Barba", durationMinutes: 15, priceCop: 12_000 },
];

describe("walkInStart", () => {
  it("rounds the minute down to 5, as the database does", () => {
    expect(walkInStart(new Date("2026-11-16T20:13:59.999Z"))).toEqual(
      new Date("2026-11-16T20:10:00Z"),
    );
  });
  it("keeps an instant that already is a multiple of 5", () => {
    expect(walkInStart(new Date("2026-11-16T20:15:00Z"))).toEqual(
      new Date("2026-11-16T20:15:00Z"),
    );
  });
  it("is never in the future", () => {
    const instant = new Date("2026-11-16T20:14:30Z");
    expect(walkInStart(instant).getTime()).toBeLessThanOrEqual(
      instant.getTime(),
    );
  });
});

describe("walkInTotals and walkInEnd", () => {
  it("adds up the chosen services", () => {
    expect(walkInTotals(SERVICES, [CORTE, BARBA])).toEqual({
      count: 2,
      minutes: 45,
      priceCop: 37_000,
    });
  });
  it("counts nothing for none, nor for an id that is not offered", () => {
    expect(walkInTotals(SERVICES, [])).toEqual({
      count: 0,
      minutes: 0,
      priceCop: 0,
    });
    expect(walkInTotals(SERVICES, [OTRO])).toEqual({
      count: 0,
      minutes: 0,
      priceCop: 0,
    });
  });
  it("ends after the length", () => {
    expect(walkInEnd(new Date("2026-11-16T20:10:00Z"), 45)).toEqual(
      new Date("2026-11-16T20:55:00Z"),
    );
  });
});

describe("parseWalkInForm", () => {
  it("takes the services and a trimmed name", () => {
    expect(
      parseWalkInForm({ servicios: [CORTE], nombre: "  Pedro  " }),
    ).toEqual({
      success: true,
      data: { serviceIds: [CORTE], customerName: "Pedro" },
    });
  });
  it("a blank name is no name", () => {
    expect(parseWalkInForm({ servicios: [CORTE], nombre: "   " })).toEqual({
      success: true,
      data: { serviceIds: [CORTE], customerName: null },
    });
    expect(parseWalkInForm({ servicios: [CORTE], nombre: null })).toMatchObject(
      {
        success: true,
        data: { customerName: null },
      },
    );
  });
  it("refuses no service, a repeated one, more than 5 or something that is not an id", () => {
    for (const servicios of [
      [],
      [CORTE, CORTE],
      Array(6).fill(CORTE),
      ["x"],
      [3],
    ]) {
      expect(parseWalkInForm({ servicios, nombre: "" })).toEqual({
        success: false,
        errors: { servicios: "services_required" },
      });
    }
  });
  it("refuses a name over 100 characters or with control characters", () => {
    expect(
      parseWalkInForm({ servicios: [CORTE], nombre: "a".repeat(101) }),
    ).toEqual({
      success: false,
      errors: { nombre: "customer_name_invalid" },
    });
    expect(
      parseWalkInForm({ servicios: [CORTE], nombre: "Ana\u0007" }),
    ).toEqual({
      success: false,
      errors: { nombre: "customer_name_invalid" },
    });
    expect(
      parseWalkInForm({ servicios: [CORTE], nombre: "a".repeat(100) }).success,
    ).toBe(true);
  });
});

describe("parseWalkInBarber", () => {
  it("takes an id and refuses anything else", () => {
    expect(parseWalkInBarber(CORTE)).toEqual({ success: true, data: CORTE });
    expect(parseWalkInBarber("")).toEqual({
      success: false,
      errors: { profesional: "barber_not_found" },
    });
    expect(parseWalkInBarber(null).success).toBe(false);
  });
});

describe("parseWalkInClash", () => {
  it("reads the detail of the database", () => {
    const detail = JSON.stringify({
      kind: "appointment",
      at: "2026-11-16T20:30:00+00:00",
      until: "2026-11-16T21:00:00+00:00",
      freeMinutes: 20,
      neededMinutes: 40,
      startsAt: "2026-11-16T20:10:00+00:00",
    });
    expect(parseWalkInClash(detail)).toEqual({
      kind: "appointment",
      at: new Date("2026-11-16T20:30:00Z"),
      freeMinutes: 20,
      neededMinutes: 40,
    });
  });
  it("a closed time has no hour", () => {
    expect(
      parseWalkInClash(
        '{"kind": "closed", "at": null, "until": null, "freeMinutes": 0, "neededMinutes": 30}',
      ),
    ).toEqual({ kind: "closed", at: null, freeMinutes: 0, neededMinutes: 30 });
  });
  it("is null for nothing, not JSON, another shape or a clash without its hour", () => {
    expect(parseWalkInClash(null)).toBeNull();
    expect(parseWalkInClash("no json")).toBeNull();
    expect(parseWalkInClash('{"kind": "other"}')).toBeNull();
    expect(
      parseWalkInClash(
        '{"kind": "block", "at": null, "freeMinutes": 0, "neededMinutes": 30}',
      ),
    ).toBeNull();
  });
});
