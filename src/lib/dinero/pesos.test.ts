import { describe, expect, it } from "vitest";
import { formatPesos, MAX_PRICE_COP, parsePesos } from "./pesos";

describe("parsePesos", () => {
  it.each([
    ["25000", 25000],
    ["25.000", 25000],
    ["$ 25.000", 25000],
    ["$25.000", 25000],
    [" 1.250.000 ", 1250000],
    ["0", 0],
  ])("reads %j as %i", (input, value) => {
    expect(parsePesos(input)).toBe(value);
  });

  it.each(["", "25,5", "-1", "25.00", "abc", "2.5000", "10000000"])(
    "rejects %j",
    (input) => {
      expect(parsePesos(input)).toBeNull();
    },
  );

  it("accepts the maximum", () => {
    expect(parsePesos(String(MAX_PRICE_COP))).toBe(MAX_PRICE_COP);
  });
});

describe("formatPesos", () => {
  it("writes pesos with dots and a dollar sign", () => {
    expect(formatPesos(25000)).toBe("$25.000");
    expect(formatPesos(0)).toBe("$0");
    expect(formatPesos(1250000)).toBe("$1.250.000");
  });
});
