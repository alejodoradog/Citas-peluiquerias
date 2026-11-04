import { describe, expect, it } from "vitest";
import { parseRegistration } from "./registration";

const valid = {
  ownerName: "  Carlos Pérez ",
  barbershopName: " Barbería El Parche ",
  phone: "300 123 4567",
  email: " Carlos@Example.COM ",
  password: "una-clave-segura",
};

describe("parseRegistration", () => {
  it("cleans and normalizes a valid registration", () => {
    expect(parseRegistration(valid)).toEqual({
      success: true,
      data: {
        ownerName: "Carlos Pérez",
        barbershopName: "Barbería El Parche",
        phone: "+573001234567",
        email: "carlos@example.com",
        password: "una-clave-segura",
      },
    });
  });

  it.each([
    ["ownerName", "   ", "owner_name_required"],
    ["ownerName", "x".repeat(101), "owner_name_too_long"],
    ["barbershopName", "", "barbershop_name_required"],
    ["barbershopName", "x".repeat(101), "barbershop_name_too_long"],
    ["phone", "123", "phone_invalid"],
    ["email", "carlos@", "email_invalid"],
    ["password", "corta", "password_too_short"],
    ["password", "x".repeat(73), "password_too_long"],
  ])("rejects an invalid %s with %s", (field, value, code) => {
    const result = parseRegistration({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[field as keyof typeof valid]).toBe(code);
    }
  });

  it("measures the password limit in bytes, as bcrypt does", () => {
    expect(
      parseRegistration({ ...valid, password: "a".repeat(72) }).success,
    ).toBe(true);
    // 37 accented letters are 74 bytes.
    const result = parseRegistration({ ...valid, password: "á".repeat(37) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.password).toBe("password_too_long");
    }
  });

  it("rejects missing fields", () => {
    const result = parseRegistration({});
    expect(result.success).toBe(false);
  });
});
