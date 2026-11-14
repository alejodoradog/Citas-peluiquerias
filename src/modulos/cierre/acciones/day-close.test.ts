import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs on the server; the session and the database are
// stand-ins, so the test sees what is saved and where the owner goes.
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/fechas/fechas", async (original) => ({
  ...(await original<typeof import("@/lib/fechas/fechas")>()),
  now: () => new Date("2026-11-07T15:00:00Z"),
}));
vi.mock("@/modulos/cuentas/guards", () => ({
  requireOwner: async () => ({ kind: "owner", barbershop: { id: "shop-1" } }),
}));
vi.mock("@/modulos/barberias/datos/setup", () => ({
  barbershopNeedsSetup: async () => false,
}));
const saveCommission = vi.fn(async () => true);
vi.mock("../datos/day-close", () => ({ saveCommission }));
const loadSubscriptionNotice = vi.fn(
  async (): Promise<{ notice: { kind: string } } | null> => null,
);
vi.mock("@/modulos/suscripciones/datos/notice", () => ({
  loadSubscriptionNotice,
}));

const { setCommission } = await import("./day-close");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function redirectOf(call: () => Promise<void>) {
  try {
    await call();
  } catch (error) {
    if (error instanceof Redirect) return error.to;
    throw error;
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setCommission", () => {
  it("saves the percentage of the active barbershop and goes back to the day", async () => {
    expect(
      await redirectOf(() =>
        setCommission(form({ comision: "40", dia: "2026-11-05" })),
      ),
    ).toBe("/panel/cierre?dia=2026-11-05&guardado=1");
    expect(saveCommission).toHaveBeenCalledWith("shop-1", 40);
  });

  it("refuses a percentage that is not offered, without saving", async () => {
    expect(
      await redirectOf(() =>
        setCommission(form({ comision: "42", dia: "2026-11-05" })),
      ),
    ).toBe("/panel/cierre?dia=2026-11-05&aviso=1");
    expect(saveCommission).not.toHaveBeenCalled();
  });

  it("goes back to today from a day that is not one", async () => {
    saveCommission.mockResolvedValueOnce(false);
    expect(
      await redirectOf(() =>
        setCommission(form({ comision: "40", dia: "/evil" })),
      ),
    ).toBe("/panel/cierre?dia=2026-11-07&aviso=1");
  });

  it("says the barbershop is paused when that is why it did not save (task 5.5)", async () => {
    saveCommission.mockResolvedValueOnce(false);
    loadSubscriptionNotice.mockResolvedValueOnce({
      notice: { kind: "paused" },
    });
    expect(
      await redirectOf(() =>
        setCommission(form({ comision: "40", dia: "2026-11-05" })),
      ),
    ).toBe("/panel/cierre?dia=2026-11-05&aviso=pausada");
    expect(loadSubscriptionNotice).toHaveBeenCalledWith("shop-1", "2026-11-07");
  });
});
