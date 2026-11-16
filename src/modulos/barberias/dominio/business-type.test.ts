import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/supabase/database.types";
import { BUSINESS_TYPES, isBusinessType } from "./business-type";

describe("business types", () => {
  it("are the ones the database accepts, in the same order", () => {
    expect([...BUSINESS_TYPES]).toEqual([
      ...Constants.public.Enums.business_type,
    ]);
  });

  it("tells a kind of business from anything else", () => {
    expect(isBusinessType("dentistry")).toBe(true);
    expect(isBusinessType("casino")).toBe(false);
    expect(isBusinessType("")).toBe(false);
    expect(isBusinessType(undefined)).toBe(false);
  });
});
