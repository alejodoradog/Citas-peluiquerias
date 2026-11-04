import type { ParseResult } from "@/lib/validacion/parse";

// What a form action sends back to its screen (decision 0005).
// - idle: nothing submitted yet.
// - invalid: some fields need fixing; values echo what was typed.
// - failed: the data was valid but the action could not complete.
// - done: it worked; notice says which success message to show, if any.
// Errors and notices are codes; screens map them to src/ui/textos.ts.
export type FormState<
  Field extends string,
  Code extends string,
  Notice extends string = never,
> =
  | { status: "idle" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<string, Code | "invalid">>;
      values: Partial<Record<Field, string>>;
    }
  | { status: "failed"; error: Code; values: Partial<Record<Field, string>> }
  | { status: "done"; notice?: Notice };

export const IDLE = { status: "idle" } as const;

// Reads the named text fields of a form, validates them, and keeps what the
// person typed to echo it back, except secret fields such as passwords.
export function readForm<Field extends string, Data, Code extends string>(
  formData: FormData,
  {
    fields,
    secret = [],
    parse,
  }: {
    fields: readonly Field[];
    secret?: readonly Field[];
    parse: (input: Record<Field, string>) => ParseResult<Data, Code>;
  },
):
  | { valid: true; data: Data; values: Partial<Record<Field, string>> }
  | { valid: false; state: FormState<Field, Code, never> } {
  const input = Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as Record<Field, string>;

  const values = Object.fromEntries(
    fields
      .filter((field) => !secret.includes(field))
      .map((field) => [field, input[field]]),
  ) as Partial<Record<Field, string>>;

  const parsed = parse(input);
  if (!parsed.success) {
    return {
      valid: false,
      state: { status: "invalid", fieldErrors: parsed.errors, values },
    };
  }
  return { valid: true, data: parsed.data, values };
}
