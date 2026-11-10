import { z } from "zod";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

// Booking and cancellation policies of a barbershop (D-60; spec,
// "Disponibilidad" and "Cancelación y reprogramación"):
// - the minimum notice to book, in minutes (barbershops.min_booking_notice_minutes,
//   0 to 10080 in the database);
// - until how many hours before customers may cancel or move their
//   appointment from the email link (barbershops.cancellation_notice_hours,
//   0 to 168). The barbershop can always cancel.

// How far ahead customers may book. Fixed for every barbershop; the
// availability engine (task 3.1) uses it.
export const BOOKING_WINDOW_DAYS = 30;

export type Policies = {
  minBookingNoticeMinutes: number;
  cancellationNoticeHours: number;
};

// The spec's defaults, the same as the columns' (decision 0006).
export const DEFAULT_POLICIES: Policies = {
  minBookingNoticeMinutes: 60,
  cancellationNoticeHours: 2,
};

// What D-60 offers (decision P9 of task 2.4, provisional): 0, 15 and 30
// minutes; 1, 2, 3, 6, 12, 24 and 48 hours.
export const MIN_BOOKING_NOTICE_OPTIONS: readonly number[] = [
  0, 15, 30, 60, 120, 180, 360, 720, 1440, 2880,
];
// 0, 1, 2, 3, 4, 6, 12, 24 and 48 hours.
export const CANCELLATION_NOTICE_OPTIONS: readonly number[] = [
  0, 1, 2, 3, 4, 6, 12, 24, 48,
];

export type PolicyErrorCode =
  "min_booking_notice_invalid" | "cancellation_notice_invalid";

// The options with the saved value among them, in order: a value saved
// another way (the seed data, say) shows as it is and can be kept.
export function optionsWith(
  options: readonly number[],
  saved: number,
): number[] {
  return options.includes(saved)
    ? [...options]
    : [...options, saved].sort((a, b) => a - b);
}

// A select's value: digits only, one of the allowed numbers.
function choice(allowed: readonly number[], code: PolicyErrorCode) {
  return z.string({ error: code }).transform((value, ctx) => {
    const number = /^\d{1,5}$/.test(value) ? Number(value) : NaN;
    if (!allowed.includes(number)) {
      ctx.addIssue({ code: "custom", message: code });
      return z.NEVER;
    }
    return number;
  });
}

// The form of D-60 as sent: "minBookingNotice" in minutes and
// "cancellationNotice" in hours. Each takes one of its options or the value
// already saved.
export function parsePoliciesForm(
  input: unknown,
  saved: Policies,
): ParseResult<Policies, PolicyErrorCode> {
  const schema = z
    .object({
      minBookingNotice: choice(
        optionsWith(MIN_BOOKING_NOTICE_OPTIONS, saved.minBookingNoticeMinutes),
        "min_booking_notice_invalid",
      ),
      cancellationNotice: choice(
        optionsWith(CANCELLATION_NOTICE_OPTIONS, saved.cancellationNoticeHours),
        "cancellation_notice_invalid",
      ),
    })
    .transform(({ minBookingNotice, cancellationNotice }) => ({
      minBookingNoticeMinutes: minBookingNotice,
      cancellationNoticeHours: cancellationNotice,
    }));
  return parseWith(schema, input);
}
