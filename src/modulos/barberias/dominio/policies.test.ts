import { describe, expect, it } from "vitest";
import {
  BOOKING_WINDOW_DAYS,
  CANCELLATION_NOTICE_OPTIONS,
  DEFAULT_POLICIES,
  MIN_BOOKING_NOTICE_OPTIONS,
  optionsWith,
  parsePoliciesForm,
  type Policies,
} from "./policies";

const saved: Policies = {
  minBookingNoticeMinutes: 60,
  cancellationNoticeHours: 2,
};

describe("booking and cancellation policies", () => {
  it("lets people book up to 30 days ahead (spec, Disponibilidad)", () => {
    expect(BOOKING_WINDOW_DAYS).toBe(30);
  });

  it("defaults to 1 hour of notice and cancelling up to 2 hours before", () => {
    expect(DEFAULT_POLICIES).toEqual({
      minBookingNoticeMinutes: 60,
      cancellationNoticeHours: 2,
    });
    expect(MIN_BOOKING_NOTICE_OPTIONS).toContain(60);
    expect(CANCELLATION_NOTICE_OPTIONS).toContain(2);
  });

  it("offers the provisional options, 0 included, from shortest to longest", () => {
    expect(MIN_BOOKING_NOTICE_OPTIONS).toEqual([
      0, 15, 30, 60, 120, 180, 360, 720, 1440, 2880,
    ]);
    expect(CANCELLATION_NOTICE_OPTIONS).toEqual([0, 1, 2, 3, 4, 6, 12, 24, 48]);
  });

  it("stays inside the limits the database checks", () => {
    for (const minutes of MIN_BOOKING_NOTICE_OPTIONS) {
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThanOrEqual(10_080);
    }
    for (const hours of CANCELLATION_NOTICE_OPTIONS) {
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThanOrEqual(168);
    }
  });
});

describe("optionsWith", () => {
  it("keeps the list when the saved value is in it", () => {
    expect(optionsWith(CANCELLATION_NOTICE_OPTIONS, 2)).toEqual(
      CANCELLATION_NOTICE_OPTIONS,
    );
  });

  it("adds a saved value from outside the list, in order", () => {
    expect(optionsWith([0, 15, 30, 60], 45)).toEqual([0, 15, 30, 45, 60]);
  });
});

describe("parsePoliciesForm", () => {
  it("reads both choices as numbers", () => {
    expect(
      parsePoliciesForm(
        { minBookingNotice: "120", cancellationNotice: "24" },
        saved,
      ),
    ).toEqual({
      success: true,
      data: { minBookingNoticeMinutes: 120, cancellationNoticeHours: 24 },
    });
  });

  it("accepts no notice at all", () => {
    expect(
      parsePoliciesForm(
        { minBookingNotice: "0", cancellationNotice: "0" },
        saved,
      ),
    ).toEqual({
      success: true,
      data: { minBookingNoticeMinutes: 0, cancellationNoticeHours: 0 },
    });
  });

  it("keeps a saved value that is not one of the options", () => {
    expect(
      parsePoliciesForm(
        { minBookingNotice: "90", cancellationNotice: "5" },
        { minBookingNoticeMinutes: 90, cancellationNoticeHours: 5 },
      ),
    ).toEqual({
      success: true,
      data: { minBookingNoticeMinutes: 90, cancellationNoticeHours: 5 },
    });
  });

  it("refuses anything else, by field", () => {
    for (const [input, errors] of [
      [
        { minBookingNotice: "90", cancellationNotice: "2" },
        { minBookingNotice: "min_booking_notice_invalid" },
      ],
      [
        { minBookingNotice: "60", cancellationNotice: "169" },
        { cancellationNotice: "cancellation_notice_invalid" },
      ],
      [
        { minBookingNotice: "-15", cancellationNotice: "2.5" },
        {
          minBookingNotice: "min_booking_notice_invalid",
          cancellationNotice: "cancellation_notice_invalid",
        },
      ],
      [
        { minBookingNotice: "", cancellationNotice: " 2" },
        {
          minBookingNotice: "min_booking_notice_invalid",
          cancellationNotice: "cancellation_notice_invalid",
        },
      ],
      [
        {},
        {
          minBookingNotice: "min_booking_notice_invalid",
          cancellationNotice: "cancellation_notice_invalid",
        },
      ],
    ] as const) {
      expect(parsePoliciesForm(input, saved)).toEqual({
        success: false,
        errors,
      });
    }
  });
});
