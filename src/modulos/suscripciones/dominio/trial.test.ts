import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, trialEndsOn } from "./trial";

describe("trialEndsOn", () => {
  it("lasts 20 days", () => {
    expect(TRIAL_DAYS).toBe(20);
  });

  it("matches the spec example: signup on November 4 works through November 24", () => {
    expect(trialEndsOn("2026-11-04")).toBe("2026-11-24");
  });

  it("crosses months and years", () => {
    expect(trialEndsOn("2026-12-20")).toBe("2027-01-09");
    expect(trialEndsOn("2028-02-15")).toBe("2028-03-06");
  });
});
