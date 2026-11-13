import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OWNER_REFUSALS, toOwnerRefusal } from "./owner-appointment-errors";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261112700000_add_owner_appointment_actions.sql",
  ),
  "utf8",
);

describe("toOwnerRefusal", () => {
  it("keeps every hint the panel functions raise", () => {
    const hints = new Set(
      [...sql.matchAll(/hint = '([a-z_]+)'/g)].map((match) => match[1]!),
    );
    // The time hints come from owner_time_problem and owner_slot_problem.
    for (const hint of [
      "slot_invalid",
      "too_early",
      "outside_booking_window",
      "closed",
      "outside_hours",
      "blocked",
      "slot_taken",
    ]) {
      hints.add(hint);
    }
    for (const hint of hints) {
      expect(toOwnerRefusal({ hint })).toBe(hint);
    }
    expect(new Set(OWNER_REFUSALS)).toEqual(
      new Set([...hints, "customer_name_invalid"]),
    );
  });

  it("turns the exclusion constraint into slot_taken", () => {
    expect(toOwnerRefusal({ code: "23P01", hint: null })).toBe("slot_taken");
  });

  it("calls anything else unknown", () => {
    expect(toOwnerRefusal({ hint: "otra_cosa" })).toBe("unknown");
    expect(toOwnerRefusal({})).toBe("unknown");
  });
});
