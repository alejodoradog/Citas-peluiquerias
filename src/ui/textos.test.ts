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
      // The whole word: "casilla" (the box of task 6.5) is fine.
      expect(text).not.toMatch(/(^|[^\p{L}])silla($|[^\p{L}])/iu);
      expect(text).not.toBe("Barberías");
    }
  });

  // Task 7.1: Yapoin serves any business that works by appointment. The
  // only places that name a barbershop are the examples of kinds of business
  // (the word that turns on the home and the landing pages, their demo, and
  // the kinds the sign-up offers, task 7.2).
  it("speaks of establishments and professionals, not of barbershops", () => {
    const { inicio, landing, cuentas, ...rest } = textos;
    const { tipos: _kindsOffered, ...registro } = cuentas.registro;
    const product = { ...rest, cuentas: { ...cuentas, registro } };
    for (const text of allStrings(product)) {
      expect(text).not.toMatch(/barber|peluquer/iu);
      expect(text).not.toMatch(/(^|[^\p{L}])(cortan|corto)($|[^\p{L}])/iu);
    }
    const {
      negocios: _homeKinds,
      descripcion: _homeDescription,
      ...home
    } = inicio;
    const { negocios: _kinds, demo: _demo, ...page } = landing;
    for (const text of [...allStrings(home), ...allStrings(page)]) {
      expect(text).not.toMatch(/barber|peluquer/iu);
    }
  });

  it("has no empty copy", () => {
    for (const text of allStrings(textos)) {
      expect(text.trim()).not.toBe("");
    }
  });

  it("writes the D-62 message like the design, with the link last", () => {
    expect(
      textos.compartir.mensaje(
        "Barbería La Esquina",
        "yapoin.com/barberia-la-esquina",
      ),
    ).toBe(
      "¡Ya puedes reservar tu cita en Barbería La Esquina sin escribirnos! Elige servicio, profesional y hora aquí: yapoin.com/barberia-la-esquina",
    );
  });

  it("says how long the email links last", () => {
    expect(textos.cuentas.registro.revisaCorreo.avisoCuerpo).toContain(
      "24 horas",
    );
  });
});
