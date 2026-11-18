import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, startOfBogotaDay, toBogotaDate } from "@/lib/fechas/fechas";

// createOwnerBlockAction (task 8.14) on the server; the session and the
// database are stand-ins, so the test sees what would be written.
vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
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
const OWNER_ROW = "bbbbbbbb-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";

const requireOwner = vi.fn(async () => ({
  barbershop: { id: SHOP, needsSetup: false },
}));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

type Written = { ok: true; value: string } | { ok: false; error: string };
const createOwnerBlock = vi.fn<(...args: unknown[]) => Promise<Written>>(
  async () => ({ ok: true, value: "b" }),
);
const findOwnerBarber = vi.fn<
  (...args: unknown[]) => Promise<{ id: string; name: string } | null>
>(async () => ({ id: OWNER_ROW, name: "Carlos" }));
vi.mock("../datos/owner-appointment", () => ({
  changeOwnerAppointmentServices: vi.fn(),
  createManualAppointment: vi.fn(),
  createOwnerBlock,
  deleteOwnerBlock: vi.fn(),
  findCustomers: vi.fn(),
  findOwnerBarber,
  rescheduleOwnerAppointment: vi.fn(),
  setOwnerAppointmentStatus: vi.fn(),
}));

const { createOwnerBlockAction } = await import("./owner-appointment");

const tomorrow = addDays(toBogotaDate(new Date()), 1);

function blockForm(fields: Record<string, string>) {
  const data = new FormData();
  const all = {
    dia: tomorrow,
    desde: "10:00",
    hasta: "11:00",
    motivo: "errand",
    ...fields,
  };
  for (const [name, value] of Object.entries(all)) data.set(name, value);
  return data;
}

async function block(fields: Record<string, string>) {
  try {
    return await createOwnerBlockAction({ status: "idle" }, blockForm(fields));
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createOwnerBlockAction", () => {
  it("blocks the owner's own row, found by the server, for the whole day", async () => {
    // Even if the browser names another professional, "Mi agenda" is the owner's.
    expect(
      await block({ para: "mine", profesional: OTHER, todoElDia: "on" }),
    ).toEqual({ redirectedTo: `/panel?dia=${tomorrow}` });
    expect(findOwnerBarber).toHaveBeenCalledWith(SHOP);
    expect(createOwnerBlock).toHaveBeenCalledWith(SHOP, {
      barberId: OWNER_ROW,
      start: startOfBogotaDay(tomorrow),
      end: startOfBogotaDay(addDays(tomorrow, 1)),
      reason: "Diligencia",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/panel");
  });

  it("blocks another professional by the id the database checks", async () => {
    await block({ para: "barber", profesional: OTHER, motivo: "other" });
    expect(findOwnerBarber).not.toHaveBeenCalled();
    expect(createOwnerBlock).toHaveBeenCalledWith(
      SHOP,
      expect.objectContaining({ barberId: OTHER, reason: null }),
    );
  });

  it("closes the whole establishment with no professional", async () => {
    await block({ para: "shop", profesional: OTHER });
    expect(createOwnerBlock).toHaveBeenCalledWith(
      SHOP,
      expect.objectContaining({ barberId: null }),
    );
  });

  it("refuses an owner who does not attend, writing nothing", async () => {
    findOwnerBarber.mockResolvedValueOnce(null);
    expect(await block({ para: "mine" })).toMatchObject({
      status: "invalid",
      fieldErrors: { para: "barber_not_found" },
    });
    expect(createOwnerBlock).not.toHaveBeenCalled();
  });

  it("refuses an unknown choice or a professional without an id", async () => {
    expect(await block({ para: "todos" })).toMatchObject({
      status: "invalid",
      fieldErrors: { para: "invalid" },
    });
    expect(await block({ para: "barber", profesional: "x" })).toMatchObject({
      status: "invalid",
      fieldErrors: { profesional: "barber_not_found" },
    });
    expect(createOwnerBlock).not.toHaveBeenCalled();
  });

  it("says when the hours are already closed, keeping what was chosen", async () => {
    createOwnerBlock.mockResolvedValueOnce({
      ok: false,
      error: "already_closed",
    });
    expect(await block({ para: "mine", todoElDia: "on" })).toMatchObject({
      status: "failed",
      error: "already_closed",
      values: { para: "mine", todoElDia: "on", dia: tomorrow },
    });
  });

  it("checks the hours before asking the database", async () => {
    expect(
      await block({ para: "shop", desde: "11:00", hasta: "10:00" }),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { hasta: "end_before_start" },
      values: { para: "shop" },
    });
    expect(createOwnerBlock).not.toHaveBeenCalled();
  });

  it("acts only on the session's establishment, after the wizard", async () => {
    requireOwner.mockResolvedValueOnce({
      barbershop: { id: SHOP, needsSetup: true },
    });
    expect(await block({ para: "shop" })).toEqual({
      redirectedTo: "/panel/configurar",
    });
    expect(createOwnerBlock).not.toHaveBeenCalled();
  });
});
