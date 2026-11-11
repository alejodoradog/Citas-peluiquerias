import { describe, expect, it } from "vitest";
import { parseNewBarbershop } from "./new-barbershop";

describe("parseNewBarbershop", () => {
  it("trims the name and stores the WhatsApp in E.164", () => {
    expect(
      parseNewBarbershop({
        name: "  Barbería El Parche Norte ",
        whatsappPhone: "300 123 4567",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Barbería El Parche Norte",
        whatsappPhone: "+573001234567",
      },
    });
  });

  it("leaves the WhatsApp out when it is empty, so the owner's is used", () => {
    expect(
      parseNewBarbershop({ name: "Sede Sur", whatsappPhone: "  " }),
    ).toEqual({
      success: true,
      data: { name: "Sede Sur", whatsappPhone: null },
    });
  });

  it("asks for a name, at most 100 characters", () => {
    expect(parseNewBarbershop({ name: "   ", whatsappPhone: "" })).toEqual({
      success: false,
      errors: { name: "barbershop_name_required" },
    });
    expect(
      parseNewBarbershop({ name: "x".repeat(101), whatsappPhone: "" }),
    ).toEqual({
      success: false,
      errors: { name: "barbershop_name_too_long" },
    });
  });

  it("refuses a WhatsApp that is not a Colombian mobile", () => {
    expect(
      parseNewBarbershop({ name: "Sede Sur", whatsappPhone: "601 123 4567" }),
    ).toEqual({ success: false, errors: { whatsappPhone: "phone_invalid" } });
  });
});
