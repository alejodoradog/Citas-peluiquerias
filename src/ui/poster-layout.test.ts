import { describe, expect, it } from "vitest";
import { POSTER, posterLayout, wrapLines } from "./poster-layout";

// One unit per character, so widths are easy to count.
const measure = (text: string) => text.length;

describe("wrapLines", () => {
  it("keeps a short name on one line", () => {
    expect(wrapLines("Barbería La Esquina", 30, measure)).toEqual([
      "Barbería La Esquina",
    ]);
  });

  it("breaks between words, never inside one that fits", () => {
    expect(wrapLines("Barbería La Esquina del Parque", 15, measure)).toEqual([
      "Barbería La",
      "Esquina del",
      "Parque",
    ]);
  });

  it("splits a word longer than the line", () => {
    expect(wrapLines("Barberíaelparchedecali", 10, measure)).toEqual([
      "Barberíael",
      "parchedeca",
      "li",
    ]);
  });

  it("ends the last allowed line with an ellipsis", () => {
    expect(wrapLines("uno dos tres cuatro cinco seis", 9, measure, 2)).toEqual([
      "uno dos",
      "tres cua…",
    ]);
  });

  it("collapses spaces and returns nothing for an empty name", () => {
    expect(wrapLines("  La   Esquina  ", 30, measure)).toEqual(["La Esquina"]);
    expect(wrapLines("   ", 30, measure)).toEqual([]);
  });
});

describe("posterLayout", () => {
  it("is a letter page at 150 dpi", () => {
    expect(POSTER.width).toBe(1275);
    expect(POSTER.height).toBe(1650);
  });

  it("draws the QR in whole pixels, centered, inside the margins", () => {
    const layout = posterLayout(37, 1);
    expect(Number.isInteger(layout.qr.scale)).toBe(true);
    const side = layout.qr.scale * 37;
    expect(layout.qr.x).toBe((POSTER.width - side) / 2);
    expect(layout.qr.x).toBeGreaterThanOrEqual(POSTER.margin);
    expect(side).toBeLessThanOrEqual(POSTER.width - 2 * POSTER.margin);
  });

  it("puts the caption under the QR and the name under the caption", () => {
    const layout = posterLayout(37, 2);
    const qrBottom = layout.qr.y + layout.qr.scale * 37;
    expect(layout.caption.y).toBeGreaterThan(qrBottom);
    expect(layout.name.y[0]).toBeGreaterThan(layout.caption.y);
    expect(layout.name.y[1]! - layout.name.y[0]!).toBe(layout.name.lineHeight);
    expect(layout.caption.x).toBe(POSTER.width / 2);
  });

  it("keeps the whole block centered on the page and inside it", () => {
    for (const lines of [0, 1, 3]) {
      const layout = posterLayout(45, lines);
      const top = layout.qr.y;
      const bottom = layout.bottom;
      expect(top).toBeGreaterThanOrEqual(POSTER.margin);
      expect(bottom).toBeLessThanOrEqual(POSTER.height - POSTER.margin);
      expect(Math.abs(top - (POSTER.height - bottom))).toBeLessThanOrEqual(1);
    }
  });
});
