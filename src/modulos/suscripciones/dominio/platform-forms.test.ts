import { describe, expect, it } from "vitest";
import {
  earliestPaymentDay,
  parseExtendDays,
  parsePaymentForm,
  parseVoidReason,
  paymentDayOptions,
} from "./platform-forms";

const TODAY = "2026-11-07";

describe("parsePaymentForm (P-03)", () => {
  const valid = { metodo: "bre_b", referencia: "  BRB-60214 ", fecha: TODAY };

  it("reads the method, the reference without spaces and the day", () => {
    expect(parsePaymentForm(valid, TODAY)).toEqual({
      success: true,
      data: { method: "bre_b", reference: "BRB-60214", paidOn: TODAY },
    });
  });

  it("asks for a reference of 100 characters at most", () => {
    expect(parsePaymentForm({ ...valid, referencia: " " }, TODAY)).toEqual({
      success: false,
      errors: { referencia: "reference_required" },
    });
    expect(
      parsePaymentForm({ ...valid, referencia: "x".repeat(101) }, TODAY),
    ).toEqual({ success: false, errors: { referencia: "reference_too_long" } });
  });

  it("takes a payment day from a month back to today (decision P8)", () => {
    expect(
      parsePaymentForm({ ...valid, fecha: "2026-10-07" }, TODAY).success,
    ).toBe(true);
    expect(parsePaymentForm({ ...valid, fecha: "2026-10-06" }, TODAY)).toEqual({
      success: false,
      errors: { fecha: "invalid" },
    });
    expect(
      parsePaymentForm({ ...valid, fecha: "2026-11-08" }, TODAY).success,
    ).toBe(false);
  });

  it("refuses a method that is not one", () => {
    expect(parsePaymentForm({ ...valid, metodo: "efectivo" }, TODAY)).toEqual({
      success: false,
      errors: { metodo: "invalid" },
    });
  });

  it("never takes a day before the barbershop existed (task 5.4b, B3)", () => {
    const earliest = earliestPaymentDay(TODAY, "2026-11-02");
    expect(earliest).toBe("2026-11-02");
    expect(
      parsePaymentForm({ ...valid, fecha: "2026-11-02" }, TODAY, earliest)
        .success,
    ).toBe(true);
    expect(
      parsePaymentForm({ ...valid, fecha: "2026-11-01" }, TODAY, earliest),
    ).toEqual({ success: false, errors: { fecha: "invalid" } });
    expect(paymentDayOptions(TODAY, earliest)).toEqual([
      "2026-11-07",
      "2026-11-06",
      "2026-11-05",
      "2026-11-04",
      "2026-11-03",
      "2026-11-02",
    ]);
  });

  it("goes a month back for a barbershop older than that", () => {
    expect(earliestPaymentDay(TODAY, "2026-01-15")).toBe("2026-10-07");
  });

  it("refuses a day that is not a date", () => {
    expect(
      parsePaymentForm({ ...valid, fecha: "2026-10-32" }, TODAY).success,
    ).toBe(false);
  });

  it("offers today and the 31 days before", () => {
    const days = paymentDayOptions(TODAY);
    expect(days[0]).toBe(TODAY);
    expect(days).toHaveLength(32);
    expect(days.at(-1)).toBe("2026-10-07");
  });
});

describe("parseExtendDays (P-04)", () => {
  it("takes only the offered days", () => {
    expect(parseExtendDays("7")).toBe(7);
    expect(parseExtendDays("8")).toBeNull();
    expect(parseExtendDays("")).toBeNull();
  });
});

describe("parseVoidReason (decision P4)", () => {
  it("asks for a reason of 200 characters at most", () => {
    expect(parseVoidReason(" Pago duplicado ")).toEqual({
      success: true,
      data: "Pago duplicado",
    });
    expect(parseVoidReason("  ")).toEqual({
      success: false,
      errors: { motivo: "reason_required" },
    });
    expect(parseVoidReason("x".repeat(201))).toEqual({
      success: false,
      errors: { motivo: "reason_too_long" },
    });
  });
});
