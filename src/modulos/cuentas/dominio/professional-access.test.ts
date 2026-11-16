import { describe, expect, it } from "vitest";
import {
  accessActions,
  accessView,
  toAccessRefusal,
  toAuthInviteRefusal,
  type AccountStatus,
} from "./professional-access";

const NOW = new Date("2026-11-16T15:00:00Z");
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

function view(
  status: Partial<AccountStatus> & Pick<AccountStatus, "state">,
  extra: { hasEmail?: boolean; active?: boolean } = {},
) {
  return accessView({
    status: { sentAt: null, expiresAt: null, ...status },
    hasEmail: extra.hasEmail ?? true,
    active: extra.active ?? true,
    now: NOW,
  });
}

describe("accessView", () => {
  it("is active once the account opened its invitation, whatever the rest", () => {
    expect(
      view({ state: "active" }, { hasEmail: false, active: false }),
    ).toEqual({ kind: "active" });
  });

  it("says until when the email link works: 24 hours after it was sent", () => {
    expect(
      view({ state: "invited", sentAt: hours(-2), expiresAt: hours(166) }),
    ).toEqual({ kind: "invited", until: hours(22) });
  });

  it("is expired once the 24 hours (or the 7 days) passed", () => {
    expect(
      view({ state: "invited", sentAt: hours(-24), expiresAt: hours(144) }),
    ).toEqual({ kind: "expired" });
    expect(
      view({ state: "invited", sentAt: hours(-200), expiresAt: hours(-1) }),
    ).toEqual({ kind: "expired" });
  });

  it("asks for an email, then for the professional to be active, before inviting", () => {
    expect(view({ state: "none" }, { hasEmail: false })).toEqual({
      kind: "no_email",
    });
    expect(view({ state: "revoked" }, { active: false })).toEqual({
      kind: "inactive",
    });
    expect(view({ state: "none" })).toEqual({ kind: "not_invited" });
    expect(view({ state: "revoked" })).toEqual({ kind: "revoked" });
  });
});

describe("accessActions", () => {
  it("offers what each state allows", () => {
    expect(accessActions("not_invited")).toEqual({
      invite: "invite",
      revoke: false,
    });
    expect(accessActions("revoked")).toEqual({
      invite: "invite",
      revoke: false,
    });
    expect(accessActions("invited")).toEqual({
      invite: "resend",
      revoke: true,
    });
    expect(accessActions("expired")).toEqual({
      invite: "resend",
      revoke: true,
    });
    expect(accessActions("active")).toEqual({ invite: null, revoke: true });
    expect(accessActions("no_email")).toEqual({ invite: null, revoke: false });
    expect(accessActions("inactive")).toEqual({ invite: null, revoke: false });
  });
});

describe("toAccessRefusal", () => {
  it("keeps the hints of the database it knows, and nothing else", () => {
    expect(toAccessRefusal({ hint: "invitation_limit" })).toBe(
      "invitation_limit",
    );
    expect(toAccessRefusal({ hint: "barber_without_account" })).toBe(
      "barber_without_account",
    );
    expect(toAccessRefusal({ hint: "something else" })).toBe("unknown");
    expect(toAccessRefusal({})).toBe("unknown");
  });

  it("tells Auth's rate limits from its other failures", () => {
    expect(toAuthInviteRefusal({ status: 429 })).toBe("auth_rate_limited");
    expect(toAuthInviteRefusal({ code: "over_email_send_rate_limit" })).toBe(
      "auth_rate_limited",
    );
    expect(toAuthInviteRefusal({ status: 500 })).toBe("auth_failed");
  });
});
