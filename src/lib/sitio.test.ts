import { describe, expect, it } from "vitest";
import {
  displayBookingUrl,
  posterFileName,
  publicBookingUrl,
  qrFileName,
} from "./sitio";

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

describe("downloaded files", () => {
  it("names the QR and the poster after the barbershop's link", () => {
    expect(qrFileName("barberia-el-parche")).toBe(
      "qr-yapoin-barberia-el-parche.png",
    );
    expect(posterFileName("barberia-el-parche")).toBe(
      "afiche-yapoin-barberia-el-parche.png",
    );
  });
});
