import type { z } from "zod";

// Result of validating a form: clean data, or one error code per field.
// Codes are not copy; screens map them to src/ui/textos.ts.
export type ParseResult<Data, Code extends string> =
  | { success: true; data: Data }
  | { success: false; errors: Partial<Record<string, Code>> };

export function parseWith<Schema extends z.ZodType, Code extends string>(
  schema: Schema,
  input: unknown,
): ParseResult<z.output<Schema>, Code> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Partial<Record<string, Code>> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message as Code;
  }
  return { success: false, errors };
}
