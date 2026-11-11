import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, trialEndsOn, trialHasEnded } from "./trial";

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

describe("trialHasEnded", () => {
  it("keeps the trial through its last day and ends it the next one", () => {
    expect(trialHasEnded("2026-11-24", "2026-11-23")).toBe(false);
    expect(trialHasEnded("2026-11-24", "2026-11-24")).toBe(false);
    expect(trialHasEnded("2026-11-24", "2026-11-25")).toBe(true);
    expect(trialHasEnded("2026-12-31", "2027-01-01")).toBe(true);
  });
});

describe("TRIAL_DAYS", () => {
  it("matches the days the signup trigger gives in the database", () => {
    const migrations = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(migrations)
      .sort()
      .map((file) => readFileSync(join(migrations, file), "utf8"))
      .filter((text) =>
        text.includes("function private.register_owner_on_signup"),
      )
      .at(-1);
    const days = /at time zone 'America\/Bogota'\)::date \+ (\d+)/.exec(
      sql ?? "",
    )?.[1];
    expect(Number(days)).toBe(TRIAL_DAYS);
  });
});
