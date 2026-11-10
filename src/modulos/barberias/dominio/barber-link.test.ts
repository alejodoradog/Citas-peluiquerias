import { describe, expect, it } from "vitest";
import { barberLinkState } from "./barber-link";

const SENT = "2026-11-03T15:00:00+00:00";

describe("barberLinkState", () => {
  it("gives the owner no link, whatever the row says", () => {
    expect(
      barberLinkState({ isOwner: true, linkActive: false, linkIssuedAt: null }),
    ).toBe("owner");
    expect(
      barberLinkState({ isOwner: true, linkActive: true, linkIssuedAt: SENT }),
    ).toBe("owner");
  });

  it("calls a link never issued unsent", () => {
    expect(
      barberLinkState({ isOwner: false, linkActive: true, linkIssuedAt: null }),
    ).toBe("unsent");
  });

  it("calls an issued link that works active", () => {
    expect(
      barberLinkState({ isOwner: false, linkActive: true, linkIssuedAt: SENT }),
    ).toBe("active");
  });

  it("calls a link turned off off, sent or not", () => {
    expect(
      barberLinkState({
        isOwner: false,
        linkActive: false,
        linkIssuedAt: SENT,
      }),
    ).toBe("off");
    expect(
      barberLinkState({
        isOwner: false,
        linkActive: false,
        linkIssuedAt: null,
      }),
    ).toBe("off");
  });
});
