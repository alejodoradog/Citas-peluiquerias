import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSlug,
  parseNewSlug,
  RESERVED_SLUGS,
  SLUG_CHANGE_LIMIT,
  SLUG_CHANGE_WINDOW_DAYS,
  SLUG_SET_ASIDE_DAYS,
  slugCandidate,
  slugFromName,
  slugSetAsideSince,
  slugSetAsideUntil,
} from "./slug";

function latestMigrationWith(text: string): string | undefined {
  const migrations = join(process.cwd(), "supabase", "migrations");
  return readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(join(migrations, file), "utf8"))
    .filter((sql) => sql.includes(text))
    .at(-1);
}

describe("parseNewSlug", () => {
  it.each([
    ["la-esquina", "la-esquina"],
    ["  La Esquina  ", "la-esquina"],
    ["Peluquería Ñoño", "peluqueria-nono"],
    ["la_esquina!!", "la-esquina"],
    ["--la--esquina--", "la-esquina"],
    ["barberia2", "barberia2"],
  ])("turns %s into %s", (input, slug) => {
    expect(parseNewSlug(input, "actual")).toEqual({ ok: true, slug });
  });

  it("never pads, cuts or numbers what the owner typed", () => {
    expect(parseNewSlug("jl", "actual")).toEqual({
      ok: false,
      error: "slug_invalid",
    });
    expect(parseNewSlug("a".repeat(61), "actual")).toEqual({
      ok: false,
      error: "slug_invalid",
    });
    expect(parseNewSlug("a".repeat(60), "actual")).toEqual({
      ok: true,
      slug: "a".repeat(60),
    });
  });

  it("refuses an empty link or one without letters or digits", () => {
    for (const input of ["", "   ", "!!!", "---"]) {
      expect(parseNewSlug(input, "actual")).toEqual({
        ok: false,
        error: "slug_invalid",
      });
    }
  });

  it("refuses the app's own routes", () => {
    for (const reserved of RESERVED_SLUGS.filter((slug) => slug.length >= 3)) {
      expect(parseNewSlug(reserved, "actual")).toEqual({
        ok: false,
        error: "slug_reserved",
      });
    }
    expect(parseNewSlug(" Panel ", "actual")).toEqual({
      ok: false,
      error: "slug_reserved",
    });
  });

  it("says when it is the link the barbershop already has", () => {
    expect(parseNewSlug("La Esquina", "la-esquina")).toEqual({
      ok: false,
      error: "slug_same",
    });
  });
});

describe("SLUG_CHANGE_LIMIT", () => {
  it("matches the limit the database enforces", () => {
    const sql = latestMigrationWith("slug_change_limit");
    const rule = sql?.match(
      /c\.changed_at > now\(\) - interval '(\d+) days'\s*\)\s*>= (\d+) then/,
    );
    expect(Number(rule?.[1])).toBe(SLUG_CHANGE_WINDOW_DAYS);
    expect(Number(rule?.[2])).toBe(SLUG_CHANGE_LIMIT);
  });
});

describe("SLUG_SET_ASIDE_DAYS", () => {
  it("is the 3 months of decision P12", () => {
    expect(SLUG_SET_ASIDE_DAYS).toBe(90);
  });

  it("matches the time the database keeps a link set aside", () => {
    const sql = latestMigrationWith("set_aside_since");
    const rule = sql?.match(
      /set_aside_since timestamptz := now\(\) - interval '(\d+) days';/,
    );
    expect(Number(rule?.[1])).toBe(SLUG_SET_ASIDE_DAYS);
    // And the database frees the links with that instant, nothing else.
    expect(sql).toMatch(/h\.retired_at <= set_aside_since;/);
  });

  it("keeps a link set aside 90 days after it was left, not a moment more", () => {
    const left = new Date("2026-11-10T22:00:00Z");
    const until = slugSetAsideUntil(left);
    expect(until.toISOString()).toBe("2027-02-08T22:00:00.000Z");
    // Still set aside a moment before, free from that instant on: the
    // database frees links left at or before slugSetAsideSince.
    expect(left > slugSetAsideSince(new Date(until.getTime() - 1))).toBe(true);
    expect(left > slugSetAsideSince(until)).toBe(false);
  });
});

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

describe("isSlug", () => {
  it("accepts the links the database accepts", () => {
    for (const slug of ["la-esquina", "abc", "barberia-2", "a".repeat(60)]) {
      expect(isSlug(slug)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of [
      "ab",
      "a".repeat(61),
      "La-Esquina",
      "la_esquina",
      "-esquina",
      "esquina-",
      "la--esquina",
      "la esquina",
      "barbería",
      "",
    ]) {
      expect(isSlug(value)).toBe(false);
    }
  });
});
