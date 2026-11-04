import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugCandidate, slugFromName } from "./slug";

describe("slugFromName", () => {
  it.each([
    ["Barbería El Parche", "barberia-el-parche"],
    ["  La Peluquería de Ñoño  ", "la-peluqueria-de-nono"],
    ["Cortes & Barbas #1", "cortes-barbas-1"],
    ["BARBER--SHOP", "barber-shop"],
  ])("turns %s into %s", (name, expected) => {
    expect(slugFromName(name)).toBe(expected);
  });

  it("matches the database format", () => {
    for (const name of [
      "Barbería El Parche",
      "JL",
      "Ñ",
      "Panel",
      "x".repeat(200),
    ]) {
      const slug = slugFromName(name);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slug.length).toBeGreaterThanOrEqual(3);
      expect(slug.length).toBeLessThanOrEqual(50);
    }
  });

  it("pads names that are too short", () => {
    expect(slugFromName("JL")).toBe("jl-barberia");
    expect(slugFromName("!!")).toBe("barberia");
  });

  it("never returns a reserved route", () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(slugFromName(reserved)).not.toBe(reserved);
    }
    expect(slugFromName("Panel")).toBe("panel-barberia");
  });
});

describe("slugCandidate", () => {
  it("adds a number after the first attempt", () => {
    expect(slugCandidate("el-parche", 1)).toBe("el-parche");
    expect(slugCandidate("el-parche", 2)).toBe("el-parche-2");
    expect(slugCandidate("el-parche", 10)).toBe("el-parche-10");
  });
});

describe("RESERVED_SLUGS", () => {
  it("matches the list the database enforces", () => {
    const migrations = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(migrations)
      .sort()
      .map((file) => readFileSync(join(migrations, file), "utf8"))
      .filter((text) => text.includes("barbershops_slug_not_reserved"))
      .at(-1);
    const list = sql?.match(
      /barbershops_slug_not_reserved\s+check \(slug not in \(([^)]*)\)/,
    )?.[1];
    const inDatabase = [...(list ?? "").matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(inDatabase.sort()).toEqual([...RESERVED_SLUGS].sort());
  });
});
