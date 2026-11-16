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
  (...args: unknown[]) => Promise<"saved" | "location_required" | "failed">
>(async () => "saved");
vi.mock("../datos/setup", () => ({ completeBarbershopSetup }));

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
});
