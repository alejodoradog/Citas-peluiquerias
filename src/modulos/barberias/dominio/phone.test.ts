import { describe, expect, it } from "vitest";
import { normalizeColombianMobile } from "./phone";

describe("normalizeColombianMobile", () => {
  it.each([
    ["3001234567", "+573001234567"],
    ["300 123 4567", "+573001234567"],
    ["300-123-4567", "+573001234567"],
    ["(300) 123 4567", "+573001234567"],
    ["+57 300 123 4567", "+573001234567"],
    ["57 3001234567", "+573001234567"],
    ["  3151234567  ", "+573151234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeColombianMobile(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["300123456", "too short"],
    ["30012345678", "too long"],
    ["6011234567", "a landline, not a mobile"],
    ["+1 300 123 4567", "another country"],
    ["300 abc 4567", "letters"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeColombianMobile(input)).toBeNull();
  });
});
