import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_LINK_HOURS } from "./email-link";

describe("EMAIL_LINK_HOURS", () => {
  it("matches the link expiry Supabase Auth enforces locally", () => {
    const config = readFileSync(
      join(process.cwd(), "supabase", "config.toml"),
      "utf8",
    );
    const seconds = Number(config.match(/^otp_expiry\s*=\s*(\d+)/m)?.[1]);
    expect(seconds).toBe(EMAIL_LINK_HOURS * 60 * 60);
  });
});
