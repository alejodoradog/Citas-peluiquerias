import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toBogotaDate } from "@/lib/fechas/fechas";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { BOOKING_WINDOW_DAYS } from "@/modulos/barberias/dominio/policies";
import { availableSlots, type AvailabilityBarber } from "./availability";

// Decision 0005, point 16: the public booking (task 3.3) enforces the rules
// of this engine again in SQL (book_appointment, migration
// add_public_booking). The pgTAP test 28_public_booking runs a fixture and
// its cases through the SQL; this test runs the very same JSON through
// availableSlots. Both must agree with "ok" in every case.

type Fixture = {
  now: string;
  minNoticeMinutes: number;
  shopHours: WeeklyShift[];
  holidayOpenings: string[];
  barbers: AvailabilityBarber[];
  blocks: { barberId: string | null; start: string; end: string }[];
  appointments: { barberId: string; start: string; end: string }[];
  cases: {
    label: string;
    barberId: string;
    start: string;
    minutes: number;
    ok: boolean;
  }[];
};

function read(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

function fixture(): Fixture {
  const sql = read(
    "supabase",
    "tests",
    "database",
    "28_public_booking.test.sql",
  );
  const start = sql.indexOf("-- engine-fixture:begin");
  const end = sql.indexOf("-- engine-fixture:end");
  const block = sql.slice(start, end);
  return JSON.parse(block.slice(block.indexOf("{"))) as Fixture;
}

describe("the engine and the SQL of book_appointment", () => {
  const data = fixture();

  it("has the cases", () => {
    expect(data.cases).toHaveLength(30);
  });

  it.each(data.cases)("$label", ({ barberId, start, minutes, ok }) => {
    const startsAt = new Date(start);
    const date = toBogotaDate(startsAt);
    const [day] = availableSlots({
      now: new Date(data.now),
      fromDate: date,
      toDate: date,
      durationMinutes: minutes,
      minNoticeMinutes: data.minNoticeMinutes,
      shopHours: data.shopHours,
      holidayOpenings: data.holidayOpenings,
      barbers: data.barbers,
      blocks: data.blocks.map((block) => ({
        barberId: block.barberId,
        start: new Date(block.start),
        end: new Date(block.end),
      })),
      appointments: data.appointments.map((appointment) => ({
        barberId: appointment.barberId,
        start: new Date(appointment.start),
        end: new Date(appointment.end),
      })),
    });
    const slot = day?.slots.find(
      (candidate) => candidate.start.getTime() === startsAt.getTime(),
    );
    expect(slot?.barberIds.includes(barberId) ?? false).toBe(ok);
  });

  it("uses the booking window of the app", () => {
    const sql = readdirSync(join(process.cwd(), "supabase", "migrations"))
      .sort()
      .map((file) => read("supabase", "migrations", file))
      .filter((text) => text.includes("function private.booking_window_days()"))
      .at(-1);
    const days = /private\.booking_window_days\(\)[\s\S]*?select (\d+)/.exec(
      sql ?? "",
    )?.[1];
    expect(Number(days)).toBe(BOOKING_WINDOW_DAYS);
  });
});
