import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_BOOKINGS_PER_IP_HOUR,
  MAX_UPCOMING_WEB_PER_CUSTOMER,
} from "./booking-limits";

// The same numbers in TypeScript and in the migration that enforces them.
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261112300000_add_booking_limits.sql",
  ),
  "utf8",
);

function constant(name: string): number {
  const match = new RegExp(
    `function private\\.${name}\\(\\)[\\s\\S]*?select (\\d+)`,
  ).exec(sql);
  return Number(match?.[1]);
}

describe("booking limits", () => {
  it("match the database", () => {
    expect(constant("max_bookings_per_ip_hour")).toBe(MAX_BOOKINGS_PER_IP_HOUR);
    expect(constant("max_upcoming_web_per_customer")).toBe(
      MAX_UPCOMING_WEB_PER_CUSTOMER,
    );
  });

  it("are the founder's", () => {
    expect(MAX_BOOKINGS_PER_IP_HOUR).toBe(10);
    expect(MAX_UPCOMING_WEB_PER_CUSTOMER).toBe(5);
  });
});
