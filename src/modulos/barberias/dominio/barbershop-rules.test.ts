import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canAddBarbershop,
  canDeleteBarbershop,
  confirmsBarbershopName,
  MAX_BARBERSHOPS_PER_ACCOUNT,
} from "./barbershop-rules";

function latestMigrationWith(text: string): string | undefined {
  const migrations = join(process.cwd(), "supabase", "migrations");
  return readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(join(migrations, file), "utf8"))
    .filter((sql) => sql.includes(text))
    .at(-1);
}

describe("MAX_BARBERSHOPS_PER_ACCOUNT", () => {
  it("is the 4 sedes the founder set", () => {
    expect(MAX_BARBERSHOPS_PER_ACCOUNT).toBe(4);
  });

  it("matches the limit create_barbershop enforces", () => {
    const sql = latestMigrationWith("hint = 'barbershop_limit'");
    const rule = sql?.match(
      /and b\.deleted_at is null\s*\)\s*>= (\d+) then\s*raise exception 'an account holds at most (\d+) barbershops'/,
    );
    expect(Number(rule?.[1])).toBe(MAX_BARBERSHOPS_PER_ACCOUNT);
    expect(Number(rule?.[2])).toBe(MAX_BARBERSHOPS_PER_ACCOUNT);
  });
});

describe("canAddBarbershop", () => {
  it.each([
    [1, true],
    [3, true],
    [4, false],
    [5, false],
  ])("with %i sedes: %s", (count, expected) => {
    expect(canAddBarbershop(count)).toBe(expected);
  });
});

describe("canDeleteBarbershop", () => {
  it.each([
    [0, false],
    [1, false],
    [2, true],
    [4, true],
  ])("with %i sedes: %s", (count, expected) => {
    expect(canDeleteBarbershop(count)).toBe(expected);
  });
});

describe("confirmsBarbershopName", () => {
  it("accepts the name as written", () => {
    expect(confirmsBarbershopName("Sede Sur", "Sede Sur")).toBe(true);
  });

  it("ignores capitals and extra spaces", () => {
    expect(confirmsBarbershopName("  sede   SUR ", "Sede Sur")).toBe(true);
  });

  it("keeps accents, since they make another name", () => {
    expect(confirmsBarbershopName("Peluqueria", "Peluquería")).toBe(false);
    expect(confirmsBarbershopName("peluquería", "Peluquería")).toBe(true);
  });

  it("treats the composed and decomposed forms of an accent alike", () => {
    expect(confirmsBarbershopName("Peluquería", "Peluquería")).toBe(true);
  });

  it.each([[""], ["Sede"], ["Sede Sur 2"], [null], [undefined], [42]])(
    "refuses anything else (%s)",
    (typed) => {
      expect(confirmsBarbershopName(typed, "Sede Sur")).toBe(false);
    },
  );
});
