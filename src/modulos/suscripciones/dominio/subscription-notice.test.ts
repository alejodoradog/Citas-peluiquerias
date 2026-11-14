import { describe, expect, it } from "vitest";
import { subscriptionNotice } from "./subscription";

const today = "2026-11-20";
const shop = {
  status: "trial" as const,
  plan: null,
  trialEndsOn: "2026-12-10",
  expiresOn: "2026-12-10",
  createdOn: "2026-11-10",
};

describe("subscriptionNotice (task 5.5: D-70, D-71, D-72)", () => {
  it("keeps the trial notice while the trial goes on", () => {
    expect(subscriptionNotice(shop, today)).toEqual({
      kind: "trial",
      until: "2026-12-10",
    });
  });

  it("shows nothing for a paid month far from its end", () => {
    expect(
      subscriptionNotice(
        { ...shop, status: "active", plan: "standard" },
        today,
      ),
    ).toBeNull();
  });

  it("warns from three days before expires_on (D-70)", () => {
    expect(
      subscriptionNotice({ ...shop, expiresOn: "2026-11-24" }, today),
    ).toEqual({ kind: "trial", until: "2026-11-24" });
    expect(
      subscriptionNotice({ ...shop, expiresOn: "2026-11-23" }, today),
    ).toEqual({ kind: "expiring", trial: true, on: "2026-11-23" });
    expect(
      subscriptionNotice(
        { ...shop, status: "active", plan: "standard", expiresOn: today },
        today,
      ),
    ).toEqual({ kind: "expiring", trial: false, on: today });
  });

  it("counts the five days of grace after it (D-71)", () => {
    expect(
      subscriptionNotice({ ...shop, expiresOn: "2026-11-15" }, today),
    ).toEqual({
      kind: "grace",
      expiredOn: "2026-11-15",
      bookingsUntil: "2026-11-20",
    });
  });

  it("pauses on the sixth day, when suspended or awaiting its first payment (D-72)", () => {
    expect(
      subscriptionNotice({ ...shop, expiresOn: "2026-11-14" }, today),
    ).toEqual({ kind: "paused", firstPayment: false });
    expect(subscriptionNotice({ ...shop, status: "suspended" }, today)).toEqual(
      { kind: "paused", firstPayment: false },
    );
    expect(
      subscriptionNotice(
        { ...shop, trialEndsOn: "2026-11-01", expiresOn: "2026-11-01" },
        today,
      ),
    ).toEqual({ kind: "paused", firstPayment: true });
  });
});
