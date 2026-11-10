import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run on the server; here the session and the database are
// stand-ins, so the test sees exactly what would be written.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const KEVIN = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

type Barber = { id: string; is_owner: boolean };
const barbers: Record<string, Barber> = {
  [KEVIN]: { id: KEVIN, is_owner: false },
  [OWNER]: { id: OWNER, is_owner: true },
};
const getBarber = vi.fn<(shop: string, id: string) => Promise<Barber | null>>(
  async (...[, id]) => barbers[id] ?? null,
);
const writeBarberLinkHash = vi.fn<
  (shop: string, id: string, hash: string) => Promise<boolean>
>(async () => true);
const turnOffBarberLinkRow = vi.fn<
  (shop: string, id: string) => Promise<boolean>
>(async () => true);
vi.mock("../datos/barbers", () => ({
  getBarber,
  writeBarberLinkHash,
  turnOffBarberLinkRow,
}));

const { issueBarberLink, turnOffBarberLink } = await import("./barber-links");
const { hashLinkToken } = await import("@/lib/tokens/link-token");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("issueBarberLink", () => {
  it("stores only the hash of the token it hands back in the link", async () => {
    const result = await issueBarberLink(KEVIN);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const match = /^https:\/\/yapoin\.com\/b\/([A-Za-z0-9_-]{43})$/.exec(
      result.url,
    );
    expect(match).not.toBeNull();
    const token = match![1]!;
    expect(writeBarberLinkHash).toHaveBeenCalledWith(
      SHOP,
      KEVIN,
      hashLinkToken(token),
    );
    // The token itself never reaches the database.
    expect(JSON.stringify(writeBarberLinkHash.mock.calls)).not.toContain(token);
  });

  it("makes a different token every time", async () => {
    const first = await issueBarberLink(KEVIN);
    const second = await issueBarberLink(KEVIN);
    expect(first.ok && second.ok && first.url !== second.url).toBe(true);
  });

  it("uses the owner's barbershop, never one sent by the browser", async () => {
    await issueBarberLink(KEVIN);
    expect(getBarber).toHaveBeenCalledWith(SHOP, KEVIN);
  });

  it("refuses the owner's own barber", async () => {
    expect(await issueBarberLink(OWNER)).toEqual({
      ok: false,
      error: "owner_has_no_link",
    });
    expect(writeBarberLinkHash).not.toHaveBeenCalled();
  });

  it("refuses what is not one of the barbershop's barbers", async () => {
    for (const id of [
      "no-es-un-id",
      "33333333-3333-4333-8333-333333333333",
      42 as unknown as string,
    ]) {
      expect(await issueBarberLink(id)).toEqual({
        ok: false,
        error: "not_found",
      });
    }
    expect(writeBarberLinkHash).not.toHaveBeenCalled();
  });

  it("hands back no link when the write fails", async () => {
    writeBarberLinkHash.mockResolvedValueOnce(false);
    expect(await issueBarberLink(KEVIN)).toEqual({
      ok: false,
      error: "unknown",
    });
  });
});

describe("turnOffBarberLink", () => {
  it("turns off the barber's link", async () => {
    expect(await turnOffBarberLink(KEVIN)).toEqual({ ok: true });
    expect(turnOffBarberLinkRow).toHaveBeenCalledWith(SHOP, KEVIN);
  });

  it("refuses the owner and strangers", async () => {
    expect(await turnOffBarberLink(OWNER)).toEqual({
      ok: false,
      error: "owner_has_no_link",
    });
    expect(await turnOffBarberLink("no-es-un-id")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(turnOffBarberLinkRow).not.toHaveBeenCalled();
  });

  it("says when the write fails", async () => {
    turnOffBarberLinkRow.mockResolvedValueOnce(false);
    expect(await turnOffBarberLink(KEVIN)).toEqual({
      ok: false,
      error: "unknown",
    });
  });
});
