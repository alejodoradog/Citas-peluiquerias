import { describe, expect, it } from "vitest";
import { LIVE_REFRESH_MS, pollsLive } from "./live-agenda";

describe("pollsLive", () => {
  const today = "2026-11-13";

  it("polls the day of today only", () => {
    expect(pollsLive({ view: "dia", date: today, today })).toBe(true);
    expect(pollsLive({ view: "dia", date: "2026-11-14", today })).toBe(false);
    expect(pollsLive({ view: "dia", date: "2026-11-12", today })).toBe(false);
    expect(pollsLive({ view: "semana", date: today, today })).toBe(false);
  });

  it("asks every minute, inside decision 0007's 30 to 60 s", () => {
    expect(LIVE_REFRESH_MS).toBeGreaterThanOrEqual(30_000);
    expect(LIVE_REFRESH_MS).toBeLessThanOrEqual(60_000);
  });
});
