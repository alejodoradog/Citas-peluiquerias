import { beforeEach, describe, expect, it, vi } from "vitest";

// "Eliminar a …" (task 7.6c). The database, Auth and Storage are stand-ins:
// the test sees what reaches each and in which order. Above all, that the
// service key (deleteAuthAccount) only ever deletes what
// barber_account_to_delete answered, after delete_barber answered, and the
// photo deleted is the one the database cleared.
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
const ACCOUNT = "cccccccc-0000-4000-8000-000000000000";
const ORPHAN = "dddddddd-0000-4000-8000-000000000000";
const PHOTO = `${SHOP}/barbers/eeeeeeee-0000-4000-8000-000000000000.webp`;

const calls: string[] = [];
const requireOwner = vi.fn(async () => ({
  kind: "owner",
  barbershop: { id: SHOP, name: "El Parche" },
}));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

let reachable = true;
const barberOfShop = vi.fn(async (_shop: string, id: string) => {
  calls.push("barberOfShop");
  return reachable ? { id } : null;
});
const stale: string[] = [];
const accountToDelete = vi.fn(async () => {
  calls.push("barber_account_to_delete");
  return stale.shift() ?? null;
});
let authWorks = true;
const deleteAuthAccount = vi.fn(async (id: string) => {
  calls.push(`deleteUser:${id}`);
  return authWorks;
});
vi.mock("@/modulos/cuentas/datos/professional-access", () => ({
  barberOfShop,
  accountToDelete,
  deleteAuthAccount,
}));

type Deleted =
  | { ok: true; photoPath: string | null }
  | { ok: false; code: string; upcoming?: number };
let answer: Deleted = { ok: true, photoPath: PHOTO };
const deleteBarberRow = vi.fn(async () => {
  calls.push("delete_barber");
  return answer;
});
vi.mock("../datos/barbers", () => ({ deleteBarberRow }));
const removeImages = vi.fn(async (paths: readonly string[]) => {
  calls.push(`removeImages:${paths.join(",")}`);
});
vi.mock("../datos/images", () => ({ removeImages, imageExists: vi.fn() }));

const { deleteBarber } = await import("./barbers");

async function run(barberId: string) {
  try {
    return await deleteBarber(barberId);
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  stale.length = 0;
  reachable = true;
  authWorks = true;
  answer = { ok: true, photoPath: PHOTO };
});

describe("deleteBarber", () => {
  it("deletes in the database first, then the photo it cleared and each account it hands over, then goes to the team", async () => {
    stale.push(ACCOUNT, ORPHAN);
    expect(await run(BARBER)).toEqual({
      redirectedTo: "/panel/profesionales",
    });
    expect(calls).toEqual([
      "barberOfShop",
      "delete_barber",
      `removeImages:${PHOTO}`,
      "barber_account_to_delete",
      `deleteUser:${ACCOUNT}`,
      "barber_account_to_delete",
      `deleteUser:${ORPHAN}`,
      "barber_account_to_delete",
    ]);
    expect(deleteBarberRow).toHaveBeenCalledWith(BARBER);
  });

  it("touches nothing for an id that is not one, or a professional the owner does not reach", async () => {
    expect(await run("../../panel")).toEqual({
      ok: false,
      error: "barber_not_found",
    });
    reachable = false;
    expect(await run(BARBER)).toEqual({
      ok: false,
      error: "barber_not_found",
    });
    expect(deleteBarberRow).not.toHaveBeenCalled();
    expect(deleteAuthAccount).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("says how many appointments to come stop it, and deletes nothing", async () => {
    answer = { ok: false, code: "has_upcoming_appointments", upcoming: 3 };
    stale.push(ACCOUNT);
    expect(await run(BARBER)).toEqual({
      ok: false,
      error: "has_upcoming_appointments",
      upcoming: 3,
    });
    expect(accountToDelete).not.toHaveBeenCalled();
    expect(deleteAuthAccount).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("passes on the database's other refusals", async () => {
    for (const code of ["barber_is_owner", "barber_not_found", "unknown"]) {
      answer = { ok: false, code };
      expect(await run(BARBER)).toEqual({ ok: false, error: code });
    }
    expect(deleteAuthAccount).not.toHaveBeenCalled();
  });

  it("when Auth fails, says so, and a retry finishes it without deleting twice", async () => {
    stale.push(ACCOUNT);
    authWorks = false;
    expect(await run(BARBER)).toEqual({
      ok: false,
      error: "account_not_deleted",
    });

    // The retry: the database says it is already deleted, so no photo again.
    calls.length = 0;
    authWorks = true;
    stale.push(ACCOUNT);
    answer = { ok: false, code: "barber_deleted" };
    expect(await run(BARBER)).toEqual({
      redirectedTo: "/panel/profesionales",
    });
    expect(calls).toEqual([
      "barberOfShop",
      "delete_barber",
      "barber_account_to_delete",
      `deleteUser:${ACCOUNT}`,
      "barber_account_to_delete",
    ]);
  });

  it("without a photo, deletes no file", async () => {
    answer = { ok: true, photoPath: null };
    await run(BARBER);
    expect(removeImages).not.toHaveBeenCalled();
  });
});
