import { describe, expect, it } from "vitest";
import {
  coverCrop,
  fitFontSize,
  POSTER,
  POSTER_LINK_WIDTH,
  posterLayout,
  wrapLines,
} from "./poster-layout";

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

describe("fitFontSize", () => {
  // Width grows with the size: one unit per character per point.
  const measureAt = (text: string, size: number) => text.length * size;

  it("keeps the largest size when the link fits", () => {
    expect(fitFontSize("yapoin.com/la", 1000, measureAt, 42, 26)).toBe(42);
  });

  it("shrinks a long link until it fits", () => {
    const link = "yapoin.com/barberia-la-esquina-del-parque";
    const size = fitFontSize(link, 1000, measureAt, 42, 10);
    expect(link.length * size).toBeLessThanOrEqual(1000);
    expect(link.length * (size + 1)).toBeGreaterThan(1000);
  });

  it("never goes under the smallest size, so the link is never cut", () => {
    expect(fitFontSize("x".repeat(500), 1000, measureAt, 42, 26)).toBe(26);
  });
});

describe("coverCrop", () => {
  it("takes the centered square of a wide or tall logo", () => {
    expect(coverCrop(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(coverCrop(300, 500)).toEqual({ sx: 0, sy: 100, side: 300 });
    expect(coverCrop(400, 400)).toEqual({ sx: 0, sy: 0, side: 400 });
  });
});

describe("posterLayout", () => {
  // Links of yapoin.com make QR codes of 25 to 37 modules, plus the quiet
  // zone of 4 modules per side that qrMatrix includes.
  const sizes = [29, 33, 37, 41, 45];

  it("is a letter page at 150 dpi", () => {
    expect(POSTER.width).toBe(1275);
    expect(POSTER.height).toBe(1650);
  });

  it("draws the QR in whole pixels, centered, inside the white card", () => {
    for (const modules of sizes) {
      const { qr, card } = posterLayout(modules, 2, true);
      expect(Number.isInteger(qr.scale)).toBe(true);
      const side = qr.scale * modules;
      expect(qr.x).toBe((POSTER.width - side) / 2);
      expect(qr.x).toBeGreaterThan(card.x);
      expect(qr.y).toBeGreaterThan(card.y);
      expect(qr.x + side).toBeLessThan(card.x + card.width);
      expect(card.x).toBe(POSTER.margin);
      expect(card.x + card.width).toBe(POSTER.width - POSTER.margin);
    }
  });

  it("stacks logo, name, card, caption and link from top to bottom", () => {
    const layout = posterLayout(37, 2, true);
    const logo = layout.logo!;
    expect(logo.x).toBe((POSTER.width - logo.width) / 2);
    expect(layout.name.y[0]).toBeGreaterThanOrEqual(logo.y + logo.height);
    expect(layout.name.y[1]! - layout.name.y[0]!).toBe(layout.name.lineHeight);
    expect(layout.card.y).toBeGreaterThan(layout.name.y[1]!);
    expect(layout.caption.y).toBeGreaterThan(
      layout.qr.y + layout.qr.scale * 37,
    );
    expect(layout.link.y).toBeGreaterThan(layout.caption.y);
    expect(layout.link.y + POSTER.linkHeight).toBeLessThanOrEqual(
      layout.card.y + layout.card.height,
    );
    expect(layout.hint.y).toBeGreaterThan(layout.card.y + layout.card.height);
    expect(layout.hint.y + POSTER.hintHeight).toBe(layout.bottom);
    expect(POSTER_LINK_WIDTH).toBe(layout.card.width - 2 * POSTER.cardPadding);
  });

  it("goes without the logo tile when there is no logo", () => {
    const layout = posterLayout(29, 1, false);
    expect(layout.logo).toBeNull();
    expect(layout.name.y[0]).toBe(layout.top);
  });

  it("keeps the content centered above the band and inside the page", () => {
    for (const modules of sizes) {
      for (const lines of [0, 1, 2]) {
        for (const hasLogo of [false, true]) {
          const layout = posterLayout(modules, lines, hasLogo);
          expect(layout.top).toBeGreaterThanOrEqual(90);
          expect(layout.bottom).toBeLessThanOrEqual(layout.band.y - 90);
          expect(
            Math.abs(layout.top - (layout.band.y - layout.bottom)),
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("puts the Yapoin brand in the band at the foot", () => {
    const { band, comb, brand } = posterLayout(29, 1, true);
    expect(band.y + band.height).toBe(POSTER.height);
    expect(comb.y).toBeGreaterThan(band.y);
    expect(comb.x).toBe((POSTER.width - comb.width) / 2);
    expect(brand.y).toBeGreaterThan(comb.y + comb.height);
    expect(brand.y + POSTER.brandHeight).toBeLessThanOrEqual(POSTER.height);
  });
});
