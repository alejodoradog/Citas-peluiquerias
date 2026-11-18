import { beforeEach, describe, expect, it, vi } from "vitest";

// Task 8.16: saving a professional invites them, by the same action as
// "Invitar". The database, Auth and the invitation are stand-ins: the test
// sees whether the invitation was asked for, for whom, and what the owner is
// sent to see. The professional is saved however the invitation ends.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const BARBER = "bbbbbbbb-0000-4000-8000-000000000000";
const SERVICE = "cccccccc-0000-4000-8000-000000000000";

vi.mock("@/modulos/cuentas/guards", () => ({
  requireOwner: async () => ({
    kind: "owner",
    barbershop: { id: SHOP, name: "El Parche" },
  }),
}));

type Access = {
  state: "none" | "invited" | "active" | "revoked";
  sentAt: null;
  expiresAt: null;
};
let access: Access | null = { state: "none", sentAt: null, expiresAt: null };
const readAccountStatus = vi.fn(async (_id: string) => access);
vi.mock("@/modulos/cuentas/datos/professional-access", () => ({
  barberOfShop: vi.fn(),
  accountToDelete: vi.fn(),
  deleteAuthAccount: vi.fn(),
  readAccountStatus,
}));

let invitation: { ok: true } | { ok: false; error: string } = { ok: true };
const inviteProfessional = vi.fn(async (_id: string) => invitation);
vi.mock("@/modulos/cuentas/acciones/professional-access", () => ({
  inviteProfessional,
}));

type Current = {
  id: string;
  email: string | null;
  active: boolean;
  is_owner: boolean;
  photo_path: string | null;
};
let current: Current = {
  id: BARBER,
  email: null,
  active: true,
  is_owner: false,
  photo_path: null,
};
const insertBarber = vi.fn(async () => ({ ok: true as const, id: BARBER }));
const updateBarberRow = vi.fn(async () => ({ ok: true as const, id: BARBER }));
const setBarberServices = vi.fn(async () => true);
vi.mock("../datos/barbers", () => ({
  insertBarber,
  updateBarberRow,
  setBarberServices,
  getBarber: vi.fn(async () => current),
  listActiveServiceOptions: vi.fn(async () => [{ id: SERVICE, name: "Corte" }]),
  photoInUse: vi.fn(async () => false),
}));
vi.mock("../datos/images", () => ({
  removeImages: vi.fn(),
  imageExists: vi.fn(),
}));

const { createBarber, updateBarber } = await import("./barbers");

function form(email: string, extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("displayName", "Kevin");
  data.set("email", email);
  data.append("serviceIds", SERVICE);
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Redirect) return error.to;
    throw error;
  }
  return null;
}

const create = (email: string) =>
  redirectOf(() => createBarber({ status: "idle" }, form(email)));
const update = (email: string) =>
  redirectOf(() =>
    updateBarber({ status: "idle" }, form(email, { barberId: BARBER })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  access = { state: "none", sentAt: null, expiresAt: null };
  invitation = { ok: true };
  current = {
    id: BARBER,
    email: null,
    active: true,
    is_owner: false,
    photo_path: null,
  };
});

describe("createBarber", () => {
  it("invites a new professional with an email and says it went", async () => {
    expect(await create("kevin@correo.com")).toBe(
      `/panel/profesionales?invitacion=sent&profesional=${BARBER}`,
    );
    expect(inviteProfessional).toHaveBeenCalledExactlyOnceWith(BARBER);
  });

  it("does not invite a professional without an email", async () => {
    expect(await create("")).toBe("/panel/profesionales");
    expect(inviteProfessional).not.toHaveBeenCalled();
  });

  it("keeps the professional and says why when the invitation does not go out", async () => {
    invitation = { ok: false, error: "email_taken" };
    expect(await create("kevin@correo.com")).toBe(
      `/panel/profesionales?invitacion=email_taken&profesional=${BARBER}`,
    );
    expect(insertBarber).toHaveBeenCalledOnce();
    expect(setBarberServices).toHaveBeenCalledOnce();

    invitation = { ok: false, error: "invitation_limit" };
    expect(await create("kevin@correo.com")).toContain(
      "invitacion=invitation_limit",
    );
    invitation = { ok: false, error: "auth_failed" };
    expect(await create("kevin@correo.com")).toContain(
      "invitacion=auth_failed",
    );
  });

  it("keeps the professional when the invitation breaks unexpectedly", async () => {
    inviteProfessional.mockRejectedValueOnce(new Error("boom"));
    expect(await create("kevin@correo.com")).toContain("invitacion=unknown");
    expect(insertBarber).toHaveBeenCalledOnce();
  });

  it("never puts the email in the address", async () => {
    expect(await create("kevin@correo.com")).not.toContain("kevin");
  });
});

describe("updateBarber", () => {
  it("invites when an email is put on a professional without account", async () => {
    expect(await update("kevin@correo.com")).toBe(
      `/panel/profesionales?invitacion=sent&profesional=${BARBER}`,
    );
    expect(inviteProfessional).toHaveBeenCalledExactlyOnceWith(BARBER);
  });

  it("invites when the email changes and there is no account nor invitation", async () => {
    current = { ...current, email: "viejo@correo.com" };
    access = { state: "revoked", sentAt: null, expiresAt: null };
    await update("nuevo@correo.com");
    expect(inviteProfessional).toHaveBeenCalledOnce();
  });

  it("does not invite when the email does not change", async () => {
    current = { ...current, email: "kevin@correo.com" };
    expect(await update("Kevin@Correo.com")).toBe("/panel/profesionales");
    expect(inviteProfessional).not.toHaveBeenCalled();
    expect(readAccountStatus).not.toHaveBeenCalled();
  });

  it("does not resend when an invitation is pending or the account exists", async () => {
    access = { state: "invited", sentAt: null, expiresAt: null };
    expect(await update("kevin@correo.com")).toBe("/panel/profesionales");
    access = { state: "active", sentAt: null, expiresAt: null };
    expect(await update("otro@correo.com")).toBe("/panel/profesionales");
    expect(inviteProfessional).not.toHaveBeenCalled();
  });

  it("does not invite when the database cannot say the state", async () => {
    access = null;
    expect(await update("kevin@correo.com")).toBe("/panel/profesionales");
    expect(inviteProfessional).not.toHaveBeenCalled();
  });

  it("never invites the owner who attends nor an inactive professional", async () => {
    current = { ...current, is_owner: true };
    expect(await update("kevin@correo.com")).toBe("/panel/profesionales");
    current = { ...current, is_owner: false, active: false };
    expect(await update("kevin@correo.com")).toBe("/panel/profesionales");
    expect(inviteProfessional).not.toHaveBeenCalled();
    expect(updateBarberRow).toHaveBeenCalledTimes(2);
  });

  it("keeps the changes and says why when the invitation does not go out", async () => {
    invitation = { ok: false, error: "auth_rate_limited" };
    expect(await update("kevin@correo.com")).toBe(
      `/panel/profesionales?invitacion=auth_rate_limited&profesional=${BARBER}`,
    );
    expect(updateBarberRow).toHaveBeenCalledOnce();
  });
});
