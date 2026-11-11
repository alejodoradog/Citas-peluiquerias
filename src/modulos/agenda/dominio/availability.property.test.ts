import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  getColombianHolidays,
  isColombianHoliday,
} from "@/lib/fechas/festivos";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import {
  availableSlots,
  firstAvailableBarber,
  type AvailabilityInput,
  type DayAvailability,
} from "./availability";

// Properties of the gate of phase 3 (docs/plan.md): no slot offered clashes
// with an appointment or a block, leaves the hours of the barbershop or the
// barber, falls on a closed holiday, breaks the minimum notice or goes past
// 30 days; and every slot starts on the quarter hour and fits whole. The
// oracle below checks them on its own: it walks every quarter hour by brute
// force, reads the shifts as given (not joined, not cut) and turns Bogotá
// into UTC with the fixed -5 hours instead of src/lib/fechas.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const BOGOTA_OFFSET = 5 * 60 * MINUTE;
// Fixed so a failure reproduces; fast-check prints the counterexample.
const PARAMS = { seed: 31_2026, numRuns: 150 };

// Bogotá wall clock <-> UTC, written apart from src/lib/fechas.
const dayStart = (date: string) =>
  Date.parse(`${date}T00:00:00Z`) + BOGOTA_OFFSET;
const bogotaDate = (ms: number) =>
  new Date(ms - BOGOTA_OFFSET).toISOString().slice(0, 10);
const bogotaMinute = (ms: number) => ((ms - BOGOTA_OFFSET) % DAY) / MINUTE;
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const plusDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const shiftMinute = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Minutes between min and max: three times in four on the quarter hour.
const quarterOrAny = (min: number, max: number) =>
  fc.oneof(
    {
      weight: 3,
      arbitrary: fc
        .integer({ min: Math.ceil(min / 15), max: Math.floor(max / 15) })
        .map((n) => n * 15),
    },
    { weight: 1, arbitrary: fc.integer({ min, max }) },
  );

// A shift on a 5-minute grid, possibly off the quarter hour, ending by midnight.
const shiftArb: fc.Arbitrary<WeeklyShift> = fc
  .record({
    weekday: fc.integer({ min: 0, max: 6 }),
    start: fc.integer({ min: 0, max: 286 }),
    length: fc.integer({ min: 1, max: 160 }),
  })
  .map(({ weekday, start, length }) => ({
    weekday,
    start: clock(start * 5),
    end: clock(Math.min(start + length, 288) * 5),
  }));

const inputArb: fc.Arbitrary<AvailabilityInput> = fc
  .record({
    // Any instant of 2026-2028, to the second.
    now: fc
      .integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2028, 11, 31) })
      .map((ms) => new Date(Math.floor(ms / 1000) * 1000)),
    fromOffset: fc.integer({ min: -3, max: 33 }),
    days: fc.integer({ min: 0, max: 5 }),
    durationMinutes: fc.integer({ min: 1, max: 96 }).map((n) => n * 5),
    minNoticeMinutes: fc.oneof(
      fc.constantFrom(0, 15, 30, 60, 120, 1440),
      fc.integer({ min: 0, max: 10_080 }),
    ),
    // Weekdays without hours appear often: a closed day.
    shopHours: fc.array(shiftArb, { maxLength: 10 }),
    barbers: fc.array(
      fc.record({
        sortOrder: fc.integer({ min: 0, max: 3 }),
        usesBarbershopHours: fc.boolean(),
        shifts: fc.array(shiftArb, { maxLength: 10 }),
      }),
      { minLength: 1, maxLength: 4 },
    ),
    // Minutes from the start of the first day. Most land on the quarter hour,
    // as real appointments and closures do, so ends that touch a slot (the
    // half-open edge) come up often; the rest fall anywhere, to the second.
    blocks: fc.array(
      fc.record({
        barber: fc.integer({ min: -1, max: 3 }),
        offset: quarterOrAny(-1440, 8 * 1440),
        length: quarterOrAny(1, 3 * 1440),
        seconds: fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 59 })),
      }),
      { maxLength: 5 },
    ),
    appointments: fc.array(
      fc.record({
        barber: fc.integer({ min: 0, max: 3 }),
        offset: quarterOrAny(-480, 7 * 1440),
        length: fc.integer({ min: 1, max: 96 }).map((n) => n * 5),
      }),
      { maxLength: 16 },
    ),
    openAll: fc.boolean(),
    openSome: fc.integer({ min: 0, max: 2 ** 20 }),
  })
  .map((raw) => {
    const today = bogotaDate(raw.now.getTime());
    const fromDate = plusDays(today, raw.fromOffset);
    const base = dayStart(fromDate);
    const ids = raw.barbers.map((_, i) => `b${i}`);
    const year = Number(today.slice(0, 4));
    const holidays = [
      ...getColombianHolidays(year),
      ...getColombianHolidays(year + 1),
    ];
    return {
      now: raw.now,
      fromDate,
      toDate: plusDays(fromDate, raw.days),
      durationMinutes: raw.durationMinutes,
      minNoticeMinutes: raw.minNoticeMinutes,
      shopHours: raw.shopHours,
      holidayOpenings: holidays.filter(
        (_, i) => raw.openAll || (raw.openSome >> (i % 20)) & 1,
      ),
      barbers: raw.barbers.map((b, i) => ({ id: ids[i]!, ...b })),
      blocks: raw.blocks.map((b) => {
        const start = base + b.offset * MINUTE + b.seconds * 1000;
        return {
          barberId: b.barber < 0 ? null : (ids[b.barber % ids.length] ?? null),
          start: new Date(start),
          end: new Date(start + b.length * MINUTE),
        };
      }),
      appointments: raw.appointments.map((a) => {
        const start = base + a.offset * MINUTE;
        return {
          barberId: ids[a.barber % ids.length]!,
          start: new Date(start),
          end: new Date(start + a.length * MINUTE),
        };
      }),
    };
  });

type Offer = { date: string; start: number; end: number; barberId: string };

function offers(days: DayAvailability[]): Offer[] {
  return days.flatMap((day) =>
    day.slots.flatMap((slot) =>
      slot.barberIds.map((barberId) => ({
        date: day.date,
        start: slot.start.getTime(),
        end: slot.end.getTime(),
        barberId,
      })),
    ),
  );
}

const covers = (shifts: readonly WeeklyShift[], day: number, minute: number) =>
  shifts.some(
    (s) =>
      s.weekday === day &&
      shiftMinute(s.start) <= minute &&
      minute < shiftMinute(s.end),
  );

const clashes = (
  intervals: ReadonlyArray<{ start: Date; end: Date }>,
  start: number,
  end: number,
) => intervals.some((i) => i.start.getTime() < end && start < i.end.getTime());

// Every minute of the appointment (on the 5-minute grid of the shifts) is
// inside a shift of the barbershop and, with own hours, of the barber.
function withinHours(input: AvailabilityInput, offer: Offer): boolean {
  const barber = input.barbers.find((b) => b.id === offer.barberId)!;
  const day = weekday(offer.date);
  const first = bogotaMinute(offer.start);
  for (
    let minute = first;
    minute < first + input.durationMinutes;
    minute += 5
  ) {
    if (minute >= 1440) return false;
    if (!covers(input.shopHours, day, minute)) return false;
    if (!barber.usesBarbershopHours && !covers(barber.shifts, day, minute))
      return false;
  }
  return true;
}

function busyFor(input: AvailabilityInput, barberId: string) {
  return [
    ...input.blocks.filter(
      (b) => b.barberId === null || b.barberId === barberId,
    ),
    ...input.appointments.filter((a) => a.barberId === barberId),
  ];
}

const closedHoliday = (input: AvailabilityInput, date: string) =>
  isColombianHoliday(date) && !input.holidayOpenings.includes(date);

const windowOf = (input: AvailabilityInput) => {
  const today = bogotaDate(input.now.getTime());
  return { from: today, until: plusDays(today, 30) };
};

// Brute force: every quarter hour of every day asked for, every barber.
function oracle(input: AvailabilityInput): Offer[] {
  const window = windowOf(input);
  const earliest = input.now.getTime() + input.minNoticeMinutes * MINUTE;
  const result: Offer[] = [];
  for (
    let date = input.fromDate;
    date <= input.toDate;
    date = plusDays(date, 1)
  ) {
    if (date < window.from || date > window.until || closedHoliday(input, date))
      continue;
    for (let minute = 0; minute < 1440; minute += 15) {
      const start = dayStart(date) + minute * MINUTE;
      const end = start + input.durationMinutes * MINUTE;
      if (start < earliest) continue;
      for (const barber of input.barbers) {
        const offer = { date, start, end, barberId: barber.id };
        if (!withinHours(input, offer)) continue;
        if (clashes(busyFor(input, barber.id), start, end)) continue;
        result.push(offer);
      }
    }
  }
  return result;
}

const key = (o: Offer) => `${o.date} ${o.start} ${o.barberId}`;

describe("availableSlots properties", () => {
  it("never offers a time that clashes with an appointment or a block", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const offer of offers(availableSlots(input))) {
          expect(
            clashes(busyFor(input, offer.barberId), offer.start, offer.end),
          ).toBe(false);
        }
      }),
      PARAMS,
    );
  });

  it("never leaves the hours of the barbershop or of the barber", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const offer of offers(availableSlots(input))) {
          expect(withinHours(input, offer)).toBe(true);
        }
      }),
      PARAMS,
    );
  });

  it("never offers a holiday the barbershop does not open", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const offer of offers(availableSlots(input))) {
          expect(closedHoliday(input, offer.date)).toBe(false);
        }
      }),
      PARAMS,
    );
  });

  it("never breaks the minimum notice", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const earliest = input.now.getTime() + input.minNoticeMinutes * MINUTE;
        for (const offer of offers(availableSlots(input))) {
          expect(offer.start).toBeGreaterThanOrEqual(earliest);
        }
      }),
      PARAMS,
    );
  });

  it("never goes past today + 30 days in Bogotá, nor before today", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const window = windowOf(input);
        for (const day of availableSlots(input)) {
          expect(day.date >= window.from && day.date <= window.until).toBe(
            true,
          );
          expect(day.date >= input.fromDate && day.date <= input.toDate).toBe(
            true,
          );
        }
      }),
      PARAMS,
    );
  });

  it("starts every slot on the quarter hour of its Bogotá day and fits it whole", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        for (const offer of offers(availableSlots(input))) {
          expect(bogotaMinute(offer.start) % 15).toBe(0);
          expect(bogotaDate(offer.start)).toBe(offer.date);
          expect(offer.end - offer.start).toBe(input.durationMinutes * MINUTE);
          expect(offer.end).toBeLessThanOrEqual(
            dayStart(plusDays(offer.date, 1)),
          );
        }
      }),
      PARAMS,
    );
  });

  it("offers exactly what the brute-force oracle finds: nothing missing, nothing extra", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const days = availableSlots(input);
        expect(offers(days).map(key).sort()).toEqual(
          oracle(input).map(key).sort(),
        );
        // Slots come in order, one per start, each barber once.
        for (const day of days) {
          const starts = day.slots.map((s) => s.start.getTime());
          expect(starts).toEqual([...new Set(starts)].sort((a, b) => a - b));
          for (const slot of day.slots) {
            expect(new Set(slot.barberIds).size).toBe(slot.barberIds.length);
          }
        }
      }),
      PARAMS,
    );
  });
});

describe("firstAvailableBarber properties", () => {
  it("picks a free barber with the fewest appointments that day, whatever the order", () => {
    fc.assert(
      fc.property(inputArb, fc.nat(), (input, pick) => {
        const slots = availableSlots(input).flatMap((d) => d.slots);
        if (slots.length === 0) return;
        const slot = slots[pick % slots.length]!;
        const chosen = firstAvailableBarber(
          slot,
          input.barbers,
          input.appointments,
        );
        expect(slot.barberIds).toContain(chosen);

        const date = bogotaDate(slot.start.getTime());
        const count = (id: string) =>
          input.appointments.filter(
            (a) => a.barberId === id && bogotaDate(a.start.getTime()) === date,
          ).length;
        const fewest = Math.min(...slot.barberIds.map(count));
        expect(count(chosen!)).toBe(fewest);

        const shuffled = firstAvailableBarber(
          { start: slot.start, barberIds: [...slot.barberIds].reverse() },
          [...input.barbers].reverse(),
          [...input.appointments].reverse(),
        );
        expect(shuffled).toBe(chosen);
      }),
      PARAMS,
    );
  });
});
