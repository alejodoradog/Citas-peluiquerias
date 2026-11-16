import { describe, expect, it } from "vitest";
import { chartBars, seriesTotal } from "./platform-metrics";

describe("chartBars", () => {
  it("measures each bar against the tallest one", () => {
    expect(
      chartBars([
        { start: "2026-11-02", value: 2 },
        { start: "2026-11-09", value: 8 },
        { start: "2026-11-16", value: 0 },
      ]).map((b) => b.share),
    ).toEqual([0.25, 1, 0]);
  });

  it("gives empty bars when nothing happened", () => {
    expect(
      chartBars([
        { start: "2026-10-01", value: 0 },
        { start: "2026-11-01", value: 0 },
      ]).map((b) => b.share),
    ).toEqual([0, 0]);
    expect(chartBars([])).toEqual([]);
  });

  it("keeps the start and the value", () => {
    expect(chartBars([{ start: "2026-11-01", value: 25000 }])).toEqual([
      { start: "2026-11-01", value: 25000, share: 1 },
    ]);
  });
});

describe("seriesTotal", () => {
  it("adds the values", () => {
    expect(
      seriesTotal([
        { start: "2026-10-01", value: 25000 },
        { start: "2026-11-01", value: 40000 },
      ]),
    ).toBe(65000);
    expect(seriesTotal([])).toBe(0);
  });
});
