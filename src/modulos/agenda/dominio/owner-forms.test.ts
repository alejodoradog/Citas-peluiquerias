import { describe, expect, it } from "vitest";
import { fromBogota } from "@/lib/fechas/fechas";
import { parseManualCustomer, parseServiceIds, parseSlot } from "./owner-forms";

const ID = "5e000000-0000-4000-8000-000000000001";
const ID2 = "5e000000-0000-4000-8000-000000000002";

describe("parseSlot", () => {
  it("reads the barber, the day and a quarter hour of Bogotá", () => {
    expect(
      parseSlot({ barbero: ID, dia: "2026-11-12", hora: "15:45" }),
    ).toEqual({
      success: true,
      data: { barberId: ID, start: fromBogota("2026-11-12", "15:45") },
    });
  });

  it("refuses a barber that is not an id", () => {
    expect(
      parseSlot({ barbero: "uno", dia: "2026-11-12", hora: "15:45" }),
    ).toEqual({ success: false, errors: { barbero: "barber_not_found" } });
  });

  it("refuses a time that is not a quarter hour or a day that does not exist", () => {
    for (const [dia, hora] of [
      ["2026-11-12", "15:40"],
      ["2026-02-30", "10:00"],
      ["2026-11-12", "24:00"],
    ]) {
      expect(parseSlot({ barbero: ID, dia: dia!, hora: hora! })).toEqual({
        success: false,
        errors: { hora: "slot_invalid" },
      });
    }
  });
});

describe("parseServiceIds", () => {
  it("takes 1 to 5 distinct ids", () => {
    expect(parseServiceIds([ID, ID2])).toEqual([ID, ID2]);
    expect(parseServiceIds([])).toBeNull();
    expect(parseServiceIds([ID, ID])).toBeNull();
    expect(parseServiceIds(["uno"])).toBeNull();
    expect(parseServiceIds(Array.from({ length: 6 }, () => ID))).toBeNull();
  });
});

describe("parseManualCustomer", () => {
  const empty = { cliente: "", nombre: "", correo: "", celular: "" };

  it("takes a chosen customer by id", () => {
    expect(parseManualCustomer({ ...empty, cliente: ID })).toEqual({
      success: true,
      data: { id: ID },
    });
    expect(parseManualCustomer({ ...empty, cliente: "x" })).toEqual({
      success: false,
      errors: { cliente: "customer_not_found" },
    });
  });

  it("creates one with only a name", () => {
    expect(parseManualCustomer({ ...empty, nombre: "  Juan  " })).toEqual({
      success: true,
      data: { name: "Juan", email: null, phone: null },
    });
  });

  it("keeps an email in lowercase and a mobile in E.164", () => {
    expect(
      parseManualCustomer({
        ...empty,
        nombre: "Juan",
        correo: " Juan@Correo.com ",
        celular: "300 765 4321",
      }),
    ).toEqual({
      success: true,
      data: { name: "Juan", email: "juan@correo.com", phone: "+573007654321" },
    });
  });

  it("says what to fix", () => {
    expect(
      parseManualCustomer({
        cliente: "",
        nombre: " ",
        correo: "no-es",
        celular: "123",
      }),
    ).toEqual({
      success: false,
      errors: {
        nombre: "customer_name_invalid",
        correo: "customer_email_invalid",
        celular: "customer_phone_invalid",
      },
    });
    expect(
      parseManualCustomer({ ...empty, nombre: "x".repeat(101) }).success,
    ).toBe(false);
  });
});
