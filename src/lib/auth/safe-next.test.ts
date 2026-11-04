import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps an allowed internal path", () => {
    expect(safeNextPath("/nueva-clave")).toBe("/nueva-clave");
  });

  it.each([
    [null],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/panel/../admin"],
    ["javascript:alert(1)"],
    ["/otra-ruta"],
    ["/nueva-clave?x=https://evil.example"],
  ])("falls back for %s", (next) => {
    expect(safeNextPath(next)).toBe("/panel");
  });
});
