import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, trialEndsOn, trialHasEnded } from "./trial";

describe("trialEndsOn", () => {
  it("lasts 30 days", () => {
    expect(TRIAL_DAYS).toBe(30);
  });

  it("matches the spec example: signup on November 4 works through December 4", () => {
    expect(trialEndsOn("2026-11-04")).toBe("2026-12-04");
  });

  it("crosses months and years", () => {
    expect(trialEndsOn("2026-12-20")).toBe("2027-01-19");
    expect(trialEndsOn("2028-02-15")).toBe("2028-03-16");
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
  // The signup takes its end from private.new_trial_expires_on; its last
  // definition is the one that counts.
  it("matches the days the database gives at sign-up", () => {
    const migrations = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(migrations)
      .sort()
      .map((file) => readFileSync(join(migrations, file), "utf8"))
      .filter((text) => text.includes("function private.new_trial_expires_on"))
      .at(-1);
    const definition = sql?.slice(
      sql.indexOf("function private.new_trial_expires_on"),
    );
    const days = /at time zone 'America\/Bogota'\)::date \+ (\d+)/.exec(
      definition ?? "",
    )?.[1];
    expect(Number(days)).toBe(TRIAL_DAYS);
  });
});
