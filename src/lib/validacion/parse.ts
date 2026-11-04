import type { z } from "zod";

// Schemas use error codes as messages ("phone_invalid"); screens map each
// code to its copy in src/ui/textos.ts. A message that is not a code (a Zod
// default, in English) becomes "invalid", so copy never leaks from Zod.
const ERROR_CODE = /^[a-z][a-z0-9_]*$/;

// Field errors are keyed by the full path ("hours.3.start"), so nested fields
// keep their own error.
export type ParseResult<Data, Code extends string> =
  | { success: true; data: Data }
  | { success: false; errors: Partial<Record<string, Code | "invalid">> };

export function parseWith<Schema extends z.ZodType, Code extends string>(
  schema: Schema,
  input: unknown,
): ParseResult<z.output<Schema>, Code> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Partial<Record<string, Code | "invalid">> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.map(String).join(".");
    errors[field] ??= ERROR_CODE.test(issue.message)
      ? (issue.message as Code)
      : "invalid";
  }
  return { success: false, errors };
}
