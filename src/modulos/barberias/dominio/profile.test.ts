import { describe, expect, it } from "vitest";
import {
  ADDRESS_MAX_LENGTH,
  LOCALITY_MAX_LENGTH,
  displayWhatsapp,
  formatLocation,
  mapsUrl,
  parseShopProfile,
} from "./profile";

const SAVED = { whatsappPhone: "+573001234567" };

function input(overrides: Record<string, string> = {}) {
  return {
    name: "Barbería La Esquina",
    address: "Cra. 15 # 82-40",
    locality: "Chapinero, Bogotá",
    whatsappPhone: "300 123 4567",
    location: "",
    ...overrides,
  };
}

describe("parseShopProfile", () => {
  it("reads the form of D-57, trimmed and normalized", () => {
    expect(
      parseShopProfile(
        input({
          name: "  Barbería La Esquina ",
          address: " Cra. 15 # 82-40 ",
          whatsappPhone: "(310) 555-1234",
          location: "4.667,-74.0545",
        }),
        SAVED,
      ),
    ).toEqual({
      success: true,
      data: {
        name: "Barbería La Esquina",
        address: "Cra. 15 # 82-40",
        locality: "Chapinero, Bogotá",
        whatsappPhone: "+573105551234",
        location: { latitude: 4.667, longitude: -74.0545 },
      },
    });
  });

  it("leaves address, locality and location empty as null", () => {
    const result = parseShopProfile(
      input({ address: "   ", locality: "", location: "" }),
      SAVED,
    );
    expect(result).toMatchObject({
      success: true,
      data: { address: null, locality: null, location: null },
    });
  });

  it("asks for the name, with the rules of the sign-up", () => {
    expect(parseShopProfile(input({ name: "  " }), SAVED)).toEqual({
      success: false,
      errors: { name: "barbershop_name_required" },
    });
    expect(parseShopProfile(input({ name: "x".repeat(101) }), SAVED)).toEqual({
      success: false,
      errors: { name: "barbershop_name_too_long" },
    });
  });

  it("caps the address and the locality as the database does", () => {
    expect(
      parseShopProfile(
        input({
          address: "x".repeat(ADDRESS_MAX_LENGTH + 1),
          locality: "y".repeat(LOCALITY_MAX_LENGTH + 1),
        }),
        SAVED,
      ),
    ).toEqual({
      success: false,
      errors: { address: "address_too_long", locality: "locality_too_long" },
    });
    expect(
      parseShopProfile(
        input({
          address: "x".repeat(ADDRESS_MAX_LENGTH),
          locality: "y".repeat(LOCALITY_MAX_LENGTH),
        }),
        SAVED,
      ).success,
    ).toBe(true);
  });

  it("requires the WhatsApp, a Colombian mobile", () => {
    for (const phone of [
      "",
      "  ",
      "601 234 5678",
      "300 123 456",
      "+1 415 555 0100",
    ]) {
      expect(parseShopProfile(input({ whatsappPhone: phone }), SAVED)).toEqual({
        success: false,
        errors: { whatsappPhone: "phone_invalid" },
      });
    }
  });

  it("keeps a saved WhatsApp from abroad as it is", () => {
    const saved = { whatsappPhone: "+14155550100" };
    expect(
      parseShopProfile(input({ whatsappPhone: " +14155550100 " }), saved),
    ).toMatchObject({ success: true, data: { whatsappPhone: "+14155550100" } });
    // Another one from abroad is still refused.
    expect(
      parseShopProfile(input({ whatsappPhone: "+14155550199" }), saved).success,
    ).toBe(false);
  });

  it.each([
    ["only the latitude", "4.6"],
    ["only the longitude", ",-74.05"],
    ["three numbers", "4.6,-74.05,3"],
    ["a latitude past the pole", "90.0001,-74.05"],
    ["a longitude past the line", "4.6,-180.5"],
    ["words", "norte,sur"],
    ["not a number", "NaN,NaN"],
    ["infinity", "Infinity,1"],
    ["exponents", "1e2,1"],
    ["spaces inside", "4 .6,-74"],
    ["a huge text", `${"9".repeat(500)},1`],
  ])("refuses a location with %s", (_case, location) => {
    expect(parseShopProfile(input({ location }), SAVED)).toEqual({
      success: false,
      errors: { location: "location_invalid" },
    });
  });

  it("accepts the edges of the globe", () => {
    expect(
      parseShopProfile(input({ location: "-90,180" }), SAVED),
    ).toMatchObject({
      success: true,
      data: { location: { latitude: -90, longitude: 180 } },
    });
  });

  it("reports every field at once", () => {
    const result = parseShopProfile(
      input({ name: "", whatsappPhone: "123", location: "x" }),
      SAVED,
    );
    expect(result).toEqual({
      success: false,
      errors: {
        name: "barbershop_name_required",
        whatsappPhone: "phone_invalid",
        location: "location_invalid",
      },
    });
  });
});

describe("formatLocation", () => {
  it("writes six decimals, about 11 cm, and reads back the same", () => {
    const text = formatLocation({
      latitude: 4.66712345678,
      longitude: -74.0545,
    });
    expect(text).toBe("4.667123,-74.054500");
    expect(parseShopProfile(input({ location: text }), SAVED)).toMatchObject({
      success: true,
      data: { location: { latitude: 4.667123, longitude: -74.0545 } },
    });
  });
});

describe("mapsUrl", () => {
  it("opens the point in Google Maps without any key", () => {
    expect(mapsUrl({ latitude: 4.667123, longitude: -74.0545 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=4.667123%2C-74.054500",
    );
  });
});

describe("displayWhatsapp", () => {
  it("shows a Colombian mobile as people write it", () => {
    expect(displayWhatsapp("+573001234567")).toBe("300 123 4567");
  });

  it("shows anything else as it is saved", () => {
    expect(displayWhatsapp("+14155550100")).toBe("+14155550100");
    expect(displayWhatsapp(null)).toBe("");
  });
});
