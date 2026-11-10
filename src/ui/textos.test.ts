import { describe, expect, it } from "vitest";
import { textos } from "./textos";

// Every string of the copy, calling the ones that take values with samples.
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const sample = Array.from({ length: value.length }, (_, i) =>
      i === 0 ? "valor@correo.com" : 1,
    );
    return allStrings((value as (...args: unknown[]) => unknown)(...sample));
  }
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(allStrings);
  }
  return [];
}

describe("textos", () => {
  it("names the product Yapoin", () => {
    expect(textos.marca).toBe("Yapoin");
  });

  it("never uses the provisional names of the design or the repo", () => {
    for (const text of allStrings(textos)) {
      expect(text).not.toMatch(/silla/i);
      expect(text).not.toBe("Barberías");
    }
  });

  it("has no empty copy", () => {
    for (const text of allStrings(textos)) {
      expect(text.trim()).not.toBe("");
    }
  });

  it("says how long the email links last", () => {
    expect(textos.cuentas.registro.revisaCorreo.avisoCuerpo).toContain(
      "24 horas",
    );
  });
});
