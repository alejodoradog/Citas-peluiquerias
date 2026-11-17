import { beforeEach, describe, expect, it, vi } from "vitest";

// "Cambiar plan" (task 7.8b). The session and the database calls are
// stand-ins: the test sees who may act, what is sent and where it goes.
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

// Saturday 7 November 2026 in Bogotá.
vi.mock("@/lib/fechas/fechas", async (original) => ({
  ...(await original<typeof import("@/lib/fechas/fechas")>()),
  now: () => new Date("2026-11-07T15:00:00Z"),
}));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000001";
const REQUEST = "cccccccc-0000-4000-8000-000000000001";

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
const requireSuperAdmin = vi.fn(async () => ({ kind: "super_admin" }));
vi.mock("@/modulos/cuentas/guards", () => ({
  requireOwner,
  requireSuperAdmin,
}));

type Result = { ok: true } | { ok: false; error: string };
const ok = async (): Promise<Result> => ({ ok: true });
const requestPlanChange = vi.fn(ok);
const cancelPlanChange = vi.fn(ok);
const acceptPlanChange = vi.fn(ok);
const rejectPlanChange = vi.fn(ok);
const voidPlanChange = vi.fn(ok);
const listPlanChanges = vi.fn(async () => [
  {
    id: REQUEST,
    barbershopId: SHOP,
    amountCop: 15000,
    requestedAt: new Date("2026-11-05T15:00:00Z"),
  },
]);
vi.mock("../datos/plan-changes", () => ({
  requestPlanChange,
  cancelPlanChange,
  acceptPlanChange,
  rejectPlanChange,
  voidPlanChange,
  listPlanChanges,
}));

const actions = await import("./plan-changes");
const IDLE = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function run<T>(call: () => Promise<T>) {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestPlanUpgrade", () => {
  it("asks plan 2 for the owner's own establishment", async () => {
    expect(await run(() => actions.requestPlanUpgrade())).toEqual({
      redirectedTo: "/panel/plan?hecho=solicitud",
    });
    expect(requireOwner).toHaveBeenCalled();
    expect(requestPlanChange).toHaveBeenCalledWith(SHOP, "plus");
  });

  it("says why the database refused", async () => {
    requestPlanChange.mockResolvedValueOnce({ ok: false, error: "pending" });
    expect(await actions.requestPlanUpgrade()).toMatchObject({
      status: "failed",
      error: "pending",
    });
  });
});

describe("cancelPlanUpgrade", () => {
  it("needs the id of a request", async () => {
    expect(
      await actions.cancelPlanUpgrade(IDLE, form({ solicitud: "x" })),
    ).toMatchObject({ status: "failed", error: "not_found" });
    expect(cancelPlanChange).not.toHaveBeenCalled();
  });
});

describe("acceptPlanChange", () => {
  const valid = {
    solicitud: REQUEST,
    valor: "15000",
    metodo: "nequi",
    referencia: " NEQ-9 ",
    fecha: "2026-11-06",
  };

  it("registers the payment of the difference and goes back to the list", async () => {
    expect(
      await run(() => actions.acceptPlanChange(IDLE, form(valid))),
    ).toEqual({ redirectedTo: "/admin/solicitudes?hecho=aceptada" });
    expect(requireSuperAdmin).toHaveBeenCalled();
    expect(acceptPlanChange).toHaveBeenCalledWith({
      requestId: REQUEST,
      method: "nequi",
      reference: "NEQ-9",
      paidOn: "2026-11-06",
      amountCop: 15000,
    });
  });

  it("refuses a value that is no longer the request's", async () => {
    expect(
      await actions.acceptPlanChange(IDLE, form({ ...valid, valor: "25000" })),
    ).toMatchObject({ status: "failed", error: "plan_changed" });
    expect(acceptPlanChange).not.toHaveBeenCalled();
  });

  it("never dates the payment before the request", async () => {
    expect(
      await actions.acceptPlanChange(
        IDLE,
        form({ ...valid, fecha: "2026-11-04" }),
      ),
    ).toMatchObject({ status: "invalid" });
    expect(acceptPlanChange).not.toHaveBeenCalled();
  });

  it("says when the request is no longer pending", async () => {
    listPlanChanges.mockResolvedValueOnce([]);
    expect(await actions.acceptPlanChange(IDLE, form(valid))).toMatchObject({
      status: "failed",
      error: "not_found",
    });
  });
});

describe("rejectPlanChange and voidPlanChange", () => {
  it("need a reason", async () => {
    expect(
      await actions.rejectPlanChange(IDLE, form({ solicitud: REQUEST })),
    ).toMatchObject({ status: "invalid" });
    expect(rejectPlanChange).not.toHaveBeenCalled();
  });

  it("void the payment of a difference and go back to the ficha", async () => {
    expect(
      await run(() =>
        actions.voidPlanChange(
          IDLE,
          form({ solicitud: REQUEST, barberia: SHOP, motivo: "repetido" }),
        ),
      ),
    ).toEqual({
      redirectedTo: `/admin/barberias/${SHOP}?hecho=cambioAnulado`,
    });
    expect(voidPlanChange).toHaveBeenCalledWith(REQUEST, "repetido");
  });
});
