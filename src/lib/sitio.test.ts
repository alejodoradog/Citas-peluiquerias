import { describe, expect, it } from "vitest";
import { displayBookingUrl, publicBookingUrl } from "./sitio";

describe("booking links", () => {
  it("builds the public link of a barbershop", () => {
    expect(publicBookingUrl("barberia-el-parche")).toBe(
      "https://yapoin.com/barberia-el-parche",
    );
  });

  it("shows it without the protocol", () => {
    expect(displayBookingUrl("barberia-el-parche")).toBe(
      "yapoin.com/barberia-el-parche",
    );
  });
});
