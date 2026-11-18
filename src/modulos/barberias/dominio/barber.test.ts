import { describe, expect, it } from "vitest";
import {
  missingServices,
  nextSortOrder,
  parseBarberForm,
  parseTeamBarberForm,
  splitBarbers,
} from "./barber";

describe("parseBarberForm (wizard)", () => {
  it("reads a barber without email", () => {
    expect(
      parseBarberForm({
        displayName: " Kevin ",
        email: "",
        serviceKeys: ["corte"],
      }),
    ).toEqual({
      success: true,
      data: { displayName: "Kevin", email: null, serviceKeys: ["corte"] },
    });
  });

  it("asks for at least one service", () => {
    expect(
      parseBarberForm({ displayName: "Kevin", email: "", serviceKeys: [] }),
    ).toEqual({
      success: false,
      errors: { serviceKeys: "barber_services_required" },
    });
  });
});

describe("parseTeamBarberForm (D-54)", () => {
  const valid = {
    displayName: "Kevin",
    email: " Kevin.M@Correo.com ",
  };

  it("reads the name and the email in lowercase", () => {
    expect(parseTeamBarberForm(valid)).toEqual({
      success: true,
      data: { displayName: "Kevin", email: "kevin.m@correo.com" },
    });
  });

  it("takes an empty email as none, with no error (task 8.12)", () => {
    expect(parseTeamBarberForm({ displayName: "Kevin", email: "  " })).toEqual({
      success: true,
      data: { displayName: "Kevin", email: null },
    });
  });

  it("ignores a notices field: the database decides them", () => {
    expect(parseTeamBarberForm({ ...valid, emailNotifications: "on" })).toEqual(
      {
        success: true,
        data: { displayName: "Kevin", email: "kevin.m@correo.com" },
      },
    );
  });

  it("rejects a bad email", () => {
    expect(parseTeamBarberForm({ ...valid, email: "kevin@" })).toEqual({
      success: false,
      errors: { email: "email_invalid" },
    });
  });

  it.each([
    ["", "barber_name_required"],
    ["   ", "barber_name_required"],
    ["x".repeat(61), "barber_name_too_long"],
  ])("checks the name %j", (displayName, code) => {
    expect(parseTeamBarberForm({ ...valid, displayName })).toEqual({
      success: false,
      errors: { displayName: code },
    });
  });
});

describe("missingServices", () => {
  it("asks for a service when the barbershop has some", () => {
    expect(missingServices([], 3)).toBe(true);
    expect(missingServices(["a"], 3)).toBe(false);
  });

  it("does not block a barbershop without active services", () => {
    expect(missingServices([], 0)).toBe(false);
  });
});

describe("splitBarbers", () => {
  const barber = (
    display_name: string,
    sort_order: number,
    deactivated_at: string | null = null,
  ) => ({ display_name, sort_order, deactivated_at, active: !deactivated_at });

  it("lists the active ones in the team's order, then by name", () => {
    const { active } = splitBarbers([
      barber("Kevin", 2),
      barber("Mario", 0),
      barber("Ándres", 1),
      barber("Andrea", 1),
    ]);
    expect(active.map((b) => b.display_name)).toEqual([
      "Mario",
      "Andrea",
      "Ándres",
      "Kevin",
    ]);
  });

  it("lists the inactive ones apart, the latest departure first", () => {
    const { active, inactive } = splitBarbers([
      barber("Santiago", 3, "2026-10-01T15:00:00+00:00"),
      barber("Julián", 4, "2026-11-02T15:00:00+00:00"),
      barber("Mario", 0),
    ]);
    expect(active.map((b) => b.display_name)).toEqual(["Mario"]);
    expect(inactive.map((b) => b.display_name)).toEqual(["Julián", "Santiago"]);
  });
});

describe("nextSortOrder", () => {
  it("puts a new barber last", () => {
    expect(nextSortOrder([0, 3, 1])).toBe(4);
  });

  it("starts at zero", () => {
    expect(nextSortOrder([])).toBe(0);
  });
});
