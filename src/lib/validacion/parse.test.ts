import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseWith } from "./parse";

describe("parseWith", () => {
  it("returns the clean data", () => {
    const schema = z.object({ name: z.string().trim() });
    expect(parseWith(schema, { name: " Ana " })).toEqual({
      success: true,
      data: { name: "Ana" },
    });
  });

  it("keys nested errors by their full path", () => {
    const schema = z.object({
      hours: z.array(z.object({ start: z.string().min(1, "start_required") })),
    });
    const result = parseWith(schema, {
      hours: [{ start: "09:00" }, { start: "" }],
    });
    expect(result).toEqual({
      success: false,
      errors: { "hours.1.start": "start_required" },
    });
  });

  it("never passes Zod's own messages through as codes", () => {
    const schema = z.object({ age: z.number() });
    expect(parseWith(schema, { age: "diez" })).toEqual({
      success: false,
      errors: { age: "invalid" },
    });
  });
});
