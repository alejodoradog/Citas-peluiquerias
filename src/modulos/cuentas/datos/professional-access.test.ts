import { beforeEach, describe, expect, it, vi } from "vitest";

// The two calls with the service key (task 7.6b): what reaches Auth.
vi.mock("server-only", () => ({}));

const inviteUserByEmail = vi.fn(async () => ({ error: null as unknown }));
const deleteUser = vi.fn(async () => ({ error: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { inviteUserByEmail, deleteUser } },
  }),
}));
const rpc = vi.fn(async () => ({ data: null as unknown, error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));

const {
  accountToDelete,
  deleteAuthAccount,
  inviteInDatabase,
  sendAuthInvitation,
} = await import("./professional-access");

beforeEach(() => vi.clearAllMocks());

describe("sendAuthInvitation", () => {
  it("sends the establishment under a key no database trigger reads", async () => {
    await sendAuthInvitation("ana@example.com", {
      redirectTo: "https://yapoin.com/auth/confirm",
      establishment: "El Parche",
    });
    expect(inviteUserByEmail).toHaveBeenCalledWith("ana@example.com", {
      redirectTo: "https://yapoin.com/auth/confirm",
      data: { invited_to: "El Parche" },
    });
    // register_owner_on_signup opens a barbershop for barbershop_name, and
    // record_terms_acceptance keeps terms_version: never sent.
    const [, options] = inviteUserByEmail.mock.calls[0] as unknown as [
      string,
      { data: Record<string, unknown> },
    ];
    expect(Object.keys(options.data)).toEqual(["invited_to"]);
  });

  it("says Auth's rate limit, without its message", async () => {
    inviteUserByEmail.mockResolvedValueOnce({
      error: { status: 429, message: "ana@example.com rate limited" },
    });
    expect(
      await sendAuthInvitation("ana@example.com", {
        redirectTo: undefined,
        establishment: "El Parche",
      }),
    ).toEqual({ ok: false, error: "auth_rate_limited" });
  });
});

describe("the database answers", () => {
  it("reads invite_barber's row", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ status: "invited", email: "ana@example.com" }],
      error: null,
    });
    expect(await inviteInDatabase("b")).toEqual({
      ok: true,
      status: "invited",
      email: "ana@example.com",
    });
    expect(rpc).toHaveBeenCalledWith("invite_barber", { p_barber_id: "b" });
  });

  it("maps a refusal by its hint", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { hint: "invitation_limit" } as never,
    });
    expect(await inviteInDatabase("b")).toEqual({
      ok: false,
      error: "invitation_limit",
    });
  });

  it("names an account to delete only when the database returns one", async () => {
    rpc.mockResolvedValueOnce({ data: "acc-1", error: null });
    expect(await accountToDelete("b")).toBe("acc-1");
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await accountToDelete("b")).toBeNull();
    rpc.mockResolvedValueOnce({
      data: "acc-1",
      error: { message: "x" } as never,
    });
    expect(await accountToDelete("b")).toBeNull();
  });

  it("deletes in Auth the id it is given", async () => {
    expect(await deleteAuthAccount("acc-1")).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("acc-1");
  });
});
