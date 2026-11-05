import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emailSchema, MAX_EMAIL_LENGTH } from "./credentials";

describe("emailSchema", () => {
  it("stores what the database accepts: trimmed and in lowercase", () => {
    expect(emailSchema.parse(" Ana@Example.COM ")).toBe("ana@example.com");
  });

  it("rejects an email longer than the limit", () => {
    const longest = `${"a".repeat(MAX_EMAIL_LENGTH - "@example.com".length)}@example.com`;
    expect(emailSchema.safeParse(longest).success).toBe(true);
    expect(emailSchema.safeParse(`a${longest}`).success).toBe(false);
  });

  it("uses the same limit as private.is_email in the database", () => {
    const migrations = join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(migrations)
      .sort()
      .map((file) => readFileSync(join(migrations, file), "utf8"))
      .filter((text) => text.includes("function private.is_email"))
      .at(-1);

    expect(sql?.match(/char_length\(value\) <= (\d+)/)?.[1]).toBe(
      String(MAX_EMAIL_LENGTH),
    );
  });
});
