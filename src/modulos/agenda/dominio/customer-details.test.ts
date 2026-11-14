import { describe, expect, it } from "vitest";
import { parseCustomerDetails } from "./customer-details";

describe("parseCustomerDetails", () => {
  it("needs the box of the data policy (task 6.5)", () => {
    expect(
      parseCustomerDetails({ name: "Ana", email: "ana@correo.com", phone: "" }),
    ).toMatchObject({ success: false, errors: { acepto: "privacy_required" } });
  });

  it("trims the name, lowercases the email and normalizes the mobile", () => {
    expect(
      parseCustomerDetails({
        acepto: "on",
        name: "  Camila Rojas ",
        email: " Camila@Correo.COM",
        phone: "300 123 4567",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Camila Rojas",
        email: "camila@correo.com",
        phone: "+573001234567",
      },
    });
  });

  it("leaves the phone out when it is empty", () => {
    expect(
      parseCustomerDetails({
        acepto: "on",
        name: "Ana",
        email: "ana@correo.com",
        phone: " ",
      }),
    ).toMatchObject({ success: true, data: { phone: null } });
  });

  it("refuses control characters in the name", () => {
    expect(
      parseCustomerDetails({
        acepto: "on",
        name: "Ana\nBcc: x@y.co",
        email: "ana@correo.com",
        phone: "",
      }),
    ).toMatchObject({ success: false, errors: { name: "name_invalid" } });
  });

  it("refuses what the database would refuse", () => {
    expect(
      parseCustomerDetails({
        acepto: "on",
        name: "a".repeat(101),
        email: "ana@",
        phone: "+1 555 123 4567",
      }),
    ).toEqual({
      success: false,
      errors: {
        name: "name_too_long",
        email: "email_invalid",
        phone: "phone_invalid",
      },
    });
    expect(
      parseCustomerDetails({ name: "", email: "ana@correo.com", phone: "" }),
    ).toMatchObject({ success: false, errors: { name: "name_required" } });
  });
});
