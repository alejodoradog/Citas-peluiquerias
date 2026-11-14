import { describe, expect, it } from "vitest";
import { hasLink } from "./links";

describe("hasLink", () => {
  it("finds what a mail client would turn into a link", () => {
    for (const value of [
      "https://falso.co",
      "Paga en falso.co",
      "www.x.net",
      "bit.ly/abc",
      "x：//y",
    ]) {
      expect(hasLink(value)).toBe(true);
    }
  });

  it("lets ordinary names and addresses pass", () => {
    for (const value of [
      "Camila Rojas",
      "Barbería J.R.",
      "Cra. 15 # 82-40",
      "Corte + Barba",
    ]) {
      expect(hasLink(value)).toBe(false);
    }
  });
});
