import { describe, expect, it } from "vitest";
import { cameFromRecentRecovery } from "./recovery-session";

const NOW = 1_800_000_000;

describe("cameFromRecentRecovery", () => {
  it("accepts a session opened by a recovery link within the hour", () => {
    expect(
      cameFromRecentRecovery(
        [{ method: "recovery", timestamp: NOW - 120 }],
        NOW,
      ),
    ).toBe(true);
    expect(
      cameFromRecentRecovery([{ method: "otp", timestamp: NOW - 3599 }], NOW),
    ).toBe(true);
  });

  it("rejects a session opened with the password", () => {
    expect(
      cameFromRecentRecovery(
        [{ method: "password", timestamp: NOW - 60 }],
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects a recovery older than an hour", () => {
    expect(
      cameFromRecentRecovery(
        [{ method: "recovery", timestamp: NOW - 3601 }],
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects missing or compact claims", () => {
    expect(cameFromRecentRecovery(undefined, NOW)).toBe(false);
    expect(cameFromRecentRecovery(["recovery"], NOW)).toBe(false);
  });
});
