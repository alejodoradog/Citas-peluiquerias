import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopLocation } from "../dominio/profile";

// The actions run on the server; here the session and the database are
// stand-ins, so the test sees exactly what would be written.
vi.mock("server-only", () => ({}));
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
const requireOwner = vi.fn(async () => ({
  barbershop: { id: SHOP, needsSetup: true },
}));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const getShopProfile = vi.fn<
  (shop: string) => Promise<{ location: ShopLocation | null }>
>(async () => ({ location: { latitude: 3.4516, longitude: -76.532 } }));
const saveShopLocation = vi.fn<
  (shop: string, location: ShopLocation) => Promise<boolean>
>(async () => true);
vi.mock("../datos/shop-profile", () => ({ getShopProfile, saveShopLocation }));

const completeBarbershopSetup = vi.fn<
  (
    ...args: unknown[]
  ) => Promise<
    "saved" | "already_done" | "location_required" | "plan_limit" | "failed"
  >
>(async () => "saved");
vi.mock("../datos/setup", () => ({ completeBarbershopSetup }));

type Member = {
  id: string;
  email: string | null;
  active: boolean;
  is_owner: boolean;
};
const team: Member[] = [];
const listBarbers = vi.fn(async (_shop: string) => team);
vi.mock("../datos/barbers", () => ({ listBarbers }));

const inviteAfterSaving = vi.fn(async (_id: string) => "sent" as string);
vi.mock("@/modulos/cuentas/acciones/invite-after-saving", () => ({
  inviteAfterSaving,
}));

const { completeSetup, saveSetupLocation } = await import("./setup");

async function run<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const SETUP = JSON.stringify({
  services: [
    {
      key: "nuevo-1",
      name: "Consulta",
      price_cop: 80000,
      duration_minutes: 30,
    },
  ],
  barbers: [
    {
      display_name: "Ana",
      email: null,
      is_owner: true,
      service_keys: ["nuevo-1"],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  team.splice(0, team.length);
});

// Task 7.3: the location is required, and only the phone's GPS gives it.
describe("saveSetupLocation", () => {
  it("saves the point in the owner's own establishment and goes on to the team", async () => {
    expect(
      await run(() =>
        saveSetupLocation(
          { status: "idle" },
          form({ location: "3.451647,-76.532013" }),
        ),
      ),
    ).toEqual({ redirectedTo: "/panel/configurar/equipo" });
    expect(saveShopLocation).toHaveBeenCalledWith(SHOP, {
      latitude: 3.451647,
      longitude: -76.532013,
    });
  });

  it("does not go on without a point", async () => {
    const empty: Record<string, string>[] = [
      {},
      { location: "" },
      { location: "  " },
    ];
    for (const fields of empty) {
      expect(
        await run(() => saveSetupLocation({ status: "idle" }, form(fields))),
      ).toMatchObject({
        status: "invalid",
        fieldErrors: { location: "location_required" },
      });
    }
    expect(saveShopLocation).not.toHaveBeenCalled();
  });

  it("refuses what is not a point on the globe", async () => {
    for (const location of ["aquí", "91,0", "3.45", "3.45,-76.53;drop"]) {
      expect(
        await run(() =>
          saveSetupLocation({ status: "idle" }, form({ location })),
        ),
      ).toMatchObject({
        status: "invalid",
        fieldErrors: { location: "location_invalid" },
      });
    }
    expect(saveShopLocation).not.toHaveBeenCalled();
  });

  it("is only for the wizard: a set up owner changes the point in Datos", async () => {
    requireOwner.mockResolvedValueOnce({
      barbershop: { id: SHOP, needsSetup: false },
    });
    expect(
      await run(() =>
        saveSetupLocation(
          { status: "idle" },
          form({ location: "3.45,-76.53" }),
        ),
      ),
    ).toEqual({ redirectedTo: "/panel" });
    expect(saveShopLocation).not.toHaveBeenCalled();
  });

  it("says so when the database writes nothing", async () => {
    saveShopLocation.mockResolvedValueOnce(false);
    expect(
      await run(() =>
        saveSetupLocation(
          { status: "idle" },
          form({ location: "3.45,-76.53" }),
        ),
      ),
    ).toMatchObject({ status: "failed", error: "unknown" });
  });
});

describe("completeSetup", () => {
  it("finishes the wizard of an establishment that has its location", async () => {
    expect(
      await run(() =>
        completeSetup({ status: "idle" }, form({ setup: SETUP })),
      ),
    ).toEqual({ redirectedTo: "/panel/configurar/listo" });
    expect(completeBarbershopSetup).toHaveBeenCalledTimes(1);
  });

  it("goes back to the location step when the database refuses to finish without it", async () => {
    completeBarbershopSetup.mockResolvedValueOnce("location_required");
    expect(
      await run(() =>
        completeSetup({ status: "idle" }, form({ setup: SETUP })),
      ),
    ).toEqual({ redirectedTo: "/panel/configurar/ubicacion" });
  });

  it("sends an owner who skipped the location back to its step", async () => {
    getShopProfile.mockResolvedValueOnce({ location: null });
    expect(
      await run(() =>
        completeSetup({ status: "idle" }, form({ setup: SETUP })),
      ),
    ).toEqual({ redirectedTo: "/panel/configurar/ubicacion" });
    expect(completeBarbershopSetup).not.toHaveBeenCalled();
  });

  it("says the plan allows no more professionals (task 7.8)", async () => {
    completeBarbershopSetup.mockResolvedValueOnce("plan_limit");
    expect(
      await run(() =>
        completeSetup({ status: "idle" }, form({ setup: SETUP })),
      ),
    ).toMatchObject({ status: "failed", error: "plan_limit" });
  });

  // Task 8.17: the invitations go out once the wizard is saved.
  describe("invitations at the end", () => {
    const finish = () =>
      run(() => completeSetup({ status: "idle" }, form({ setup: SETUP })));

    beforeEach(() => {
      team.push(
        { id: "owner", email: "carlos@x.co", active: true, is_owner: true },
        { id: "ana", email: "ana@x.co", active: true, is_owner: false },
        { id: "sin", email: null, active: true, is_owner: false },
        { id: "off", email: "off@x.co", active: false, is_owner: false },
        { id: "beto", email: "beto@x.co", active: true, is_owner: false },
      );
    });

    it("invites each active professional with an email, in order, and not the owner who attends", async () => {
      expect(await finish()).toEqual({
        redirectedTo: "/panel/configurar/listo",
      });
      expect(listBarbers).toHaveBeenCalledWith(SHOP);
      expect(inviteAfterSaving.mock.calls.map(([id]) => id)).toEqual([
        "ana",
        "beto",
      ]);
    });

    it("goes on when an invitation fails or throws", async () => {
      inviteAfterSaving.mockResolvedValueOnce("email_taken");
      inviteAfterSaving.mockRejectedValueOnce(new Error("auth down"));
      expect(await finish()).toEqual({
        redirectedTo: "/panel/configurar/listo",
      });
      expect(inviteAfterSaving).toHaveBeenCalledTimes(2);
    });

    it("still goes to the end when the team cannot be read", async () => {
      listBarbers.mockRejectedValueOnce(new Error("down"));
      expect(await finish()).toEqual({
        redirectedTo: "/panel/configurar/listo",
      });
      expect(inviteAfterSaving).not.toHaveBeenCalled();
    });

    it.each(["plan_limit", "failed", "location_required"] as const)(
      "invites nobody when the transaction answers %s",
      async (answer) => {
        completeBarbershopSetup.mockResolvedValueOnce(answer);
        await finish();
        expect(listBarbers).not.toHaveBeenCalled();
        expect(inviteAfterSaving).not.toHaveBeenCalled();
      },
    );

    it("does not invite again on a second tap (already_done)", async () => {
      completeBarbershopSetup.mockResolvedValueOnce("already_done");
      expect(await finish()).toEqual({
        redirectedTo: "/panel/configurar/listo",
      });
      expect(listBarbers).not.toHaveBeenCalled();
      expect(inviteAfterSaving).not.toHaveBeenCalled();
    });
  });
});
