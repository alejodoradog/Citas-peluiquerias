import { describe, expect, it } from "vitest";
import { parseRegistration } from "./registration";

const valid = {
  ownerName: "  Carlos Pérez ",
  barbershopName: " Barbería El Parche ",
  businessType: "barbershop",
  phone: "300 123 4567",
  email: " Carlos@Example.COM ",
  password: "una-clave-segura",
  acepto: "on",
};

describe("parseRegistration", () => {
  it("needs the box of the terms and the data policy (task 6.5)", () => {
    const { acepto: _box, ...withoutBox } = valid;
    expect(parseRegistration(withoutBox)).toMatchObject({
      success: false,
      errors: { acepto: "terms_required" },
    });
    expect(parseRegistration({ ...valid, acepto: "si" }).success).toBe(false);
  });

  it("cleans and normalizes a valid registration", () => {
    expect(parseRegistration(valid)).toEqual({
      success: true,
      data: {
        ownerName: "Carlos Pérez",
        barbershopName: "Barbería El Parche",
        businessType: "barbershop",
        businessTypeOther: null,
        phone: "+573001234567",
        email: "carlos@example.com",
        password: "una-clave-segura",
      },
    });
  });

  it("needs the kind of business (task 7.2)", () => {
    const { businessType: _kind, ...withoutKind } = valid;
    for (const input of [
      withoutKind,
      { ...valid, businessType: "" },
      { ...valid, businessType: "casino" },
    ]) {
      expect(parseRegistration(input)).toMatchObject({
        success: false,
        errors: { businessType: "business_type_required" },
      });
    }
  });

  it('asks which one when the kind is "other", and keeps it trimmed', () => {
    const other = { ...valid, businessType: "other" };
    expect(parseRegistration(other)).toMatchObject({
      success: false,
      errors: { businessTypeOther: "business_type_other_required" },
    });
    expect(
      parseRegistration({ ...other, businessTypeOther: "   " }),
    ).toMatchObject({
      success: false,
      errors: { businessTypeOther: "business_type_other_required" },
    });
    expect(
      parseRegistration({ ...other, businessTypeOther: "x".repeat(61) }),
    ).toMatchObject({
      success: false,
      errors: { businessTypeOther: "business_type_other_too_long" },
    });
    expect(
      parseRegistration({ ...other, businessTypeOther: "  Tatuajes " }),
    ).toMatchObject({
      success: true,
      data: { businessType: "other", businessTypeOther: "Tatuajes" },
    });
  });

  it('keeps the text of "other" as plain text on one line', () => {
    expect(
      parseRegistration({
        ...valid,
        businessType: "other",
        businessTypeOther: "Estudio\n\tde\u202E  tatuajes\u200B",
      }),
    ).toMatchObject({
      success: true,
      data: { businessTypeOther: "Estudio de tatuajes" },
    });
  });

  it('drops what was written for "other" when the kind is another', () => {
    expect(
      parseRegistration({ ...valid, businessTypeOther: "Tatuajes" }),
    ).toMatchObject({
      success: true,
      data: { businessType: "barbershop", businessTypeOther: null },
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
