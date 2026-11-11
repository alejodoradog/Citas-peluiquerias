import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getColombianHolidays } from "./festivos";

// Decision 0005, point 16: the public booking (task 3.3) checks holidays in
// SQL (private.colombian_holidays). The pgTAP test compares the SQL function
// with the list between its markers; this test compares that same list with
// festivos.ts, so the two copies cannot drift apart.
const FIRST_YEAR = 2024;
const LAST_YEAR = 2032;

function listInPgTap(): string[] {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase",
      "tests",
      "database",
      "28_public_booking.test.sql",
    ),
    "utf8",
  );
  const start = sql.indexOf("-- holidays:begin");
  const end = sql.indexOf("-- holidays:end");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
}

describe("Colombian holidays in SQL", () => {
  it("are the ones festivos.ts gives, one per day, 2024 to 2032", () => {
    const expected: string[] = [];
    for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
      expected.push(...new Set(getColombianHolidays(year)));
    }
    expect(listInPgTap()).toEqual(expected);
  });
});
