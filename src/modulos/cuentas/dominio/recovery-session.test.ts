import { describe, expect, it } from "vitest";
import {
  cameFromRecentRecovery,
  recoveryLinkIsFresh,
} from "./recovery-session";

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

describe("recoveryLinkIsFresh", () => {
  const now = Date.parse("2026-11-10T15:00:00Z");

  it("accepts a recovery link sent within the hour", () => {
    expect(recoveryLinkIsFresh("2026-11-10T14:01:00Z", now)).toBe(true);
    expect(recoveryLinkIsFresh("2026-11-10T14:00:00Z", now)).toBe(true);
  });

  it("rejects one sent more than an hour ago, though Auth keeps it 24 hours", () => {
    expect(recoveryLinkIsFresh("2026-11-10T13:59:59Z", now)).toBe(false);
    expect(recoveryLinkIsFresh("2026-11-09T16:00:00Z", now)).toBe(false);
  });

  it("leaves it to Auth when the send time is unknown", () => {
    expect(recoveryLinkIsFresh(undefined, now)).toBe(true);
    expect(recoveryLinkIsFresh(null, now)).toBe(true);
    expect(recoveryLinkIsFresh("no es fecha", now)).toBe(true);
  });
});
