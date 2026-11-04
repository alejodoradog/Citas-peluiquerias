import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseWith } from "@/lib/validacion/parse";
import { readForm } from "./form-state";

const schema = z.object({
  email: z.string().min(1, "email_required"),
  password: z.string().min(8, "password_too_short"),
});
const parse = (input: unknown) =>
  parseWith<typeof schema, "email_required" | "password_too_short">(
    schema,
    input,
  );

function form(entries: Record<string, string>) {
  const data = new FormData();
  Object.entries(entries).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("readForm", () => {
  it("returns the data and echoes everything but secrets", () => {
    expect(
      readForm(form({ email: "ana@example.com", password: "clave-larga" }), {
        fields: ["email", "password"],
        secret: ["password"],
        parse,
      }),
    ).toEqual({
      valid: true,
      data: { email: "ana@example.com", password: "clave-larga" },
      values: { email: "ana@example.com" },
    });
  });

  it("never echoes a secret back with the errors", () => {
    const result = readForm(form({ email: "", password: "corta" }), {
      fields: ["email", "password"],
      secret: ["password"],
      parse,
    });
    expect(result).toEqual({
      valid: false,
      state: {
        status: "invalid",
        fieldErrors: {
          email: "email_required",
          password: "password_too_short",
        },
        values: { email: "" },
      },
    });
  });

  it("treats missing fields as empty text", () => {
    const result = readForm(new FormData(), {
      fields: ["email", "password"],
      secret: ["password"],
      parse,
    });
    expect(result.valid).toBe(false);
  });
});
