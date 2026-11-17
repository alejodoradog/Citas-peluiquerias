import { describe, expect, it } from "vitest";
import {
  BOOKING_INTERVAL_OPTIONS,
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
  bookingIntervalMinutes: 15,
};

describe("booking and cancellation policies", () => {
  it("lets people book up to 30 days ahead (spec, Disponibilidad)", () => {
    expect(BOOKING_WINDOW_DAYS).toBe(30);
  });

  it("defaults to 1 hour of notice and cancelling up to 2 hours before", () => {
    expect(DEFAULT_POLICIES).toEqual({
      minBookingNoticeMinutes: 60,
      cancellationNoticeHours: 2,
      bookingIntervalMinutes: 15,
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

  it("offers times every 15, 30 or 60 minutes, 15 by default", () => {
    expect(BOOKING_INTERVAL_OPTIONS).toEqual([15, 30, 60]);
    expect(DEFAULT_POLICIES.bookingIntervalMinutes).toBe(15);
    expect(BOOKING_INTERVAL_OPTIONS).toContain(
      DEFAULT_POLICIES.bookingIntervalMinutes,
    );
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
        {
          minBookingNotice: "120",
          cancellationNotice: "24",
          bookingInterval: "30",
        },
        saved,
      ),
    ).toEqual({
      success: true,
      data: {
        minBookingNoticeMinutes: 120,
        cancellationNoticeHours: 24,
        bookingIntervalMinutes: 30,
      },
    });
  });

  it("accepts no notice at all", () => {
    expect(
      parsePoliciesForm(
        {
          minBookingNotice: "0",
          cancellationNotice: "0",
          bookingInterval: "15",
        },
        saved,
      ),
    ).toEqual({
      success: true,
      data: {
        minBookingNoticeMinutes: 0,
        cancellationNoticeHours: 0,
        bookingIntervalMinutes: 15,
      },
    });
  });

  it("keeps a saved value that is not one of the options", () => {
    expect(
      parsePoliciesForm(
        {
          minBookingNotice: "90",
          cancellationNotice: "5",
          bookingInterval: "60",
        },
        {
          minBookingNoticeMinutes: 90,
          cancellationNoticeHours: 5,
          bookingIntervalMinutes: 15,
        },
      ),
    ).toEqual({
      success: true,
      data: {
        minBookingNoticeMinutes: 90,
        cancellationNoticeHours: 5,
        bookingIntervalMinutes: 60,
      },
    });
  });

  it("refuses anything else, by field", () => {
    for (const [input, errors] of [
      [
        {
          minBookingNotice: "90",
          cancellationNotice: "2",
          bookingInterval: "15",
        },
        { minBookingNotice: "min_booking_notice_invalid" },
      ],
      [
        {
          minBookingNotice: "60",
          cancellationNotice: "169",
          bookingInterval: "15",
        },
        { cancellationNotice: "cancellation_notice_invalid" },
      ],
      [
        {
          minBookingNotice: "-15",
          cancellationNotice: "2.5",
          bookingInterval: "15",
        },
        {
          minBookingNotice: "min_booking_notice_invalid",
          cancellationNotice: "cancellation_notice_invalid",
        },
      ],
      [
        {
          minBookingNotice: "",
          cancellationNotice: " 2",
          bookingInterval: "15",
        },
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
          bookingInterval: "booking_interval_invalid",
        },
      ],
    ] as const) {
      expect(parsePoliciesForm(input, saved)).toEqual({
        success: false,
        errors,
      });
    }
  });

  it("accepts 15, 30 and 60 minutes as the interval", () => {
    for (const interval of [15, 30, 60]) {
      expect(
        parsePoliciesForm(
          {
            minBookingNotice: "60",
            cancellationNotice: "2",
            bookingInterval: String(interval),
          },
          saved,
        ),
      ).toEqual({
        success: true,
        data: {
          minBookingNoticeMinutes: 60,
          cancellationNoticeHours: 2,
          bookingIntervalMinutes: interval,
        },
      });
    }
  });

  it("refuses any other interval, with booking_interval_invalid", () => {
    for (const bookingInterval of ["45", "0", "", "90", "-15", "15.5", " 15"]) {
      expect(
        parsePoliciesForm(
          { minBookingNotice: "60", cancellationNotice: "2", bookingInterval },
          saved,
        ),
      ).toEqual({
        success: false,
        errors: { bookingInterval: "booking_interval_invalid" },
      });
    }
  });

  it("refuses a saved interval outside the list instead of keeping it", () => {
    expect(
      parsePoliciesForm(
        {
          minBookingNotice: "60",
          cancellationNotice: "2",
          bookingInterval: "45",
        },
        { ...saved, bookingIntervalMinutes: 45 },
      ),
    ).toEqual({
      success: false,
      errors: { bookingInterval: "booking_interval_invalid" },
    });
  });
});
