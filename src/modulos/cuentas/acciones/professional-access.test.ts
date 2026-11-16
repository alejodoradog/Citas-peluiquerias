import { beforeEach, describe, expect, it, vi } from "vitest";

// "Invitar" and "Quitar acceso" (task 7.6b). The database and Auth are
// stand-ins: the test sees what reaches each, in which order, and above all
// that the service key (deleteAuthAccount, sendAuthInvitation) only ever acts
// on what the database answered, after it answered.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://yapoin.com" }),
}));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const BARBER = "bbbbbbbb-0000-4000-8000-000000000000";
const STALE = "cccccccc-0000-4000-8000-000000000000";

const requireOwner = vi.fn(async () => ({
  kind: "owner",
  barbershop: { id: SHOP, name: "El Parche" },
}));
vi.mock("../guards", () => ({ requireOwner }));

type Invite =
  | {
      ok: true;
      status: "invited" | "email_taken" | "revoked_account_pending";
      email: string | null;
    }
  | { ok: false; error: string };
const calls: string[] = [];
// What barber_account_to_delete answers next.
const stale: string[] = [];
// What invite_barber answers next (then: invited).
const invites: Invite[] = [];
const barberOfShop = vi.fn(async (_shop: string, id: string) => {
  calls.push("barberOfShop");
  return { id };
});
const inviteInDatabase = vi.fn<(id: string) => Promise<Invite>>(async () => {
  calls.push("invite_barber");
  return (
    invites.shift() ?? { ok: true, status: "invited", email: "ana@example.com" }
  );
});
const revokeInDatabase = vi.fn<
  (id: string) => Promise<{ ok: true } | { ok: false; error: string }>
>(async () => {
  calls.push("revoke_barber_account");
  return { ok: true };
});
const accountToDelete = vi.fn<(id: string) => Promise<string | null>>(
  async () => {
    calls.push("barber_account_to_delete");
    return stale.shift() ?? null;
  },
);
const deleteAuthAccount = vi.fn<(id: string) => Promise<boolean>>(async () => {
  calls.push("deleteUser");
  return true;
});
const sendAuthInvitation = vi.fn<
  (
    email: string,
    options: { redirectTo: string | undefined; establishment: string },
  ) => Promise<{ ok: true } | { ok: false; error: string }>
>(async () => {
  calls.push("inviteUserByEmail");
  return { ok: true };
});
vi.mock("../datos/professional-access", () => ({
  barberOfShop,
  inviteInDatabase,
  revokeInDatabase,
  accountToDelete,
  deleteAuthAccount,
  sendAuthInvitation,
}));

const { inviteProfessional, revokeProfessionalAccess } =
  await import("./professional-access");

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  stale.length = 0;
  invites.length = 0;
});

const serviceKey = () =>
  calls.filter((call) => call === "deleteUser" || call === "inviteUserByEmail");

describe("inviteProfessional", () => {
  it("asks the database, then sends Auth's invitation to exactly the email it returned", async () => {
    expect(await inviteProfessional(BARBER)).toEqual({ ok: true });
    expect(calls).toEqual([
      "barberOfShop",
      "invite_barber",
      "inviteUserByEmail",
    ]);
    expect(sendAuthInvitation).toHaveBeenCalledWith("ana@example.com", {
      redirectTo: "https://yapoin.com/auth/confirm",
      establishment: "El Parche",
    });
  });

  it.each([
    "barber_not_found",
    "barbershop_read_only",
    "barber_is_owner",
    "barber_inactive",
    "email_required",
    "already_linked",
    "invitation_pending_other_email",
    "invitation_limit",
    "unknown",
  ])("never touches Auth when the database refuses (%s)", async (error) => {
    invites.push({ ok: false, error });
    expect(await inviteProfessional(BARBER)).toEqual({ ok: false, error });
    expect(serviceKey()).toEqual([]);
  });

  it("says a taken email is taken, without Auth, when nothing is the owner's to clean", async () => {
    invites.push({
      ok: true,
      status: "email_taken",
      email: null,
    });
    expect(await inviteProfessional(BARBER)).toEqual({
      ok: false,
      error: "email_taken",
    });
    expect(serviceKey()).toEqual([]);
  });

  it("deletes the account the database names (revoked or orphan), then invites again", async () => {
    invites.push({
      ok: true,
      status: "revoked_account_pending",
      email: null,
    });
    stale.push(STALE);
    expect(await inviteProfessional(BARBER)).toEqual({ ok: true });
    expect(calls).toEqual([
      "barberOfShop",
      "invite_barber",
      "barber_account_to_delete",
      "deleteUser",
      "invite_barber",
      "inviteUserByEmail",
    ]);
    expect(deleteAuthAccount).toHaveBeenCalledWith(STALE);
  });

  it("stops when Auth does not delete the old account", async () => {
    invites.push({
      ok: true,
      status: "email_taken",
      email: null,
    });
    stale.push(STALE);
    deleteAuthAccount.mockResolvedValueOnce(false);
    expect(await inviteProfessional(BARBER)).toEqual({
      ok: false,
      error: "auth_failed",
    });
    expect(sendAuthInvitation).not.toHaveBeenCalled();
  });

  it("leaves the invitation in the database when Auth fails, so it can be sent again", async () => {
    sendAuthInvitation.mockResolvedValueOnce({
      ok: false,
      error: "auth_rate_limited",
    });
    expect(await inviteProfessional(BARBER)).toEqual({
      ok: false,
      error: "auth_rate_limited",
    });
    expect(await inviteProfessional(BARBER)).toEqual({ ok: true });
  });

  it("never asks anything for an id that is not one, or a professional of another barbershop", async () => {
    expect(await inviteProfessional("../../admin")).toEqual({
      ok: false,
      error: "barber_not_found",
    });
    barberOfShop.mockResolvedValueOnce(null as never);
    expect(await inviteProfessional(BARBER)).toEqual({
      ok: false,
      error: "barber_not_found",
    });
    expect(inviteInDatabase).not.toHaveBeenCalled();
    expect(serviceKey()).toEqual([]);
  });

  it("is for owners only", async () => {
    requireOwner.mockRejectedValueOnce(new Error("redirect /ingresar"));
    await expect(inviteProfessional(BARBER)).rejects.toThrow("redirect");
    expect(calls).toEqual([]);
  });
});

describe("revokeProfessionalAccess", () => {
  it("revokes in the database, then deletes only the account it names", async () => {
    stale.push(STALE);
    expect(await revokeProfessionalAccess(BARBER)).toEqual({ ok: true });
    expect(calls).toEqual([
      "barberOfShop",
      "revoke_barber_account",
      "barber_account_to_delete",
      "deleteUser",
    ]);
    expect(deleteAuthAccount).toHaveBeenCalledWith(STALE);
  });

  it("deletes nothing when the database names nothing (a member's account, or only an invitation)", async () => {
    expect(await revokeProfessionalAccess(BARBER)).toEqual({ ok: true });
    expect(serviceKey()).toEqual([]);
  });

  it.each(["barber_not_found", "barber_without_account"])(
    "never touches Auth when the database refuses (%s)",
    async (error) => {
      revokeInDatabase.mockResolvedValueOnce({ ok: false, error });
      expect(await revokeProfessionalAccess(BARBER)).toEqual({
        ok: false,
        error,
      });
      expect(accountToDelete).not.toHaveBeenCalled();
      expect(serviceKey()).toEqual([]);
    },
  );

  it("is done even if Auth fails to delete: the account already reaches nothing", async () => {
    stale.push(STALE);
    deleteAuthAccount.mockResolvedValueOnce(false);
    expect(await revokeProfessionalAccess(BARBER)).toEqual({ ok: true });
  });

  it("never asks anything for an id that is not one", async () => {
    expect(await revokeProfessionalAccess("x")).toEqual({
      ok: false,
      error: "barber_not_found",
    });
    expect(calls).toEqual([]);
  });
});
