import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run on the server; the session and the database calls are
// stand-ins, so the test sees who may act, what is sent and where it goes.
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

const requireSuperAdmin = vi.fn(async () => ({
  kind: "super_admin",
  name: "Admin",
}));
vi.mock("@/modulos/cuentas/guards", () => ({ requireSuperAdmin }));

type Result = { ok: true } | { ok: false; error: string };
const ok = async (): Promise<Result> => ({ ok: true });
const registerPayment = vi.fn(ok);
const voidPayment = vi.fn(ok);
const suspendBarbershop = vi.fn(ok);
const reactivateBarbershop = vi.fn(ok);
const extendTrial = vi.fn(ok);
const loadPlatformBarbershop = vi.fn(async () => ({
  trialEndsOn: "2026-11-24",
}));
vi.mock("../datos/platform", () => ({
  currentPlan: async () => ({ code: "standard", monthlyPriceCop: 25000 }),
  registerPayment,
  voidPayment,
  suspendBarbershop,
  reactivateBarbershop,
  extendTrial,
  loadPlatformBarbershop,
}));

const actions = await import("./platform");

const SHOP = "aaaaaaaa-0000-4000-8000-000000000001";
const PAYMENT = "bbbbbbbb-0000-4000-8000-000000000001";
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

describe("registerPayment (P-03)", () => {
  const valid = {
    barberia: SHOP,
    metodo: "nequi",
    referencia: " NEQ-1 ",
    fecha: "2026-11-07",
  };

  it("registers a month of the plan and goes back to P-02", async () => {
    expect(await run(() => actions.registerPayment(IDLE, form(valid)))).toEqual(
      {
        redirectedTo: `/admin/barberias/${SHOP}?hecho=pago`,
      },
    );
    expect(requireSuperAdmin).toHaveBeenCalled();
    expect(registerPayment).toHaveBeenCalledWith({
      barbershopId: SHOP,
      plan: "standard",
      method: "nequi",
      reference: "NEQ-1",
      paidOn: "2026-11-07",
    });
  });

  it("shows what to fix without calling the database", async () => {
    expect(
      await actions.registerPayment(IDLE, form({ ...valid, referencia: "" })),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { referencia: "reference_required" },
    });
    expect(registerPayment).not.toHaveBeenCalled();
  });

  it("says why the database refused", async () => {
    registerPayment.mockResolvedValueOnce({ ok: false, error: "not_allowed" });
    expect(await actions.registerPayment(IDLE, form(valid))).toMatchObject({
      status: "failed",
      error: "not_allowed",
    });
  });

  it("never builds a path from something that is not an id", async () => {
    expect(
      await run(() =>
        actions.registerPayment(IDLE, form({ ...valid, barberia: "../panel" })),
      ),
    ).toEqual({ redirectedTo: "/admin" });
    expect(registerPayment).not.toHaveBeenCalled();
  });

  it("stops anyone who is not the super admin", async () => {
    requireSuperAdmin.mockRejectedValueOnce(new Redirect("/panel"));
    expect(await run(() => actions.registerPayment(IDLE, form(valid)))).toEqual(
      {
        redirectedTo: "/panel",
      },
    );
    expect(registerPayment).not.toHaveBeenCalled();
  });
});

describe("voidPayment (decision P4)", () => {
  it("voids with its reason", async () => {
    expect(
      await run(() =>
        actions.voidPayment(
          IDLE,
          form({ barberia: SHOP, pago: PAYMENT, motivo: " Duplicado " }),
        ),
      ),
    ).toEqual({ redirectedTo: `/admin/barberias/${SHOP}?hecho=anulado` });
    expect(voidPayment).toHaveBeenCalledWith(PAYMENT, "Duplicado");
  });

  it("asks for a reason", async () => {
    expect(
      await actions.voidPayment(
        IDLE,
        form({ barberia: SHOP, pago: PAYMENT, motivo: " " }),
      ),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { motivo: "reason_required" },
    });
    expect(voidPayment).not.toHaveBeenCalled();
  });
});

describe("suspend, reactivate and extend", () => {
  it("suspends (P-05) and reactivates (decision P5)", async () => {
    expect(
      await run(() =>
        actions.suspendBarbershop(IDLE, form({ barberia: SHOP })),
      ),
    ).toEqual({
      redirectedTo: `/admin/barberias/${SHOP}?hecho=suspendida`,
    });
    reactivateBarbershop.mockResolvedValueOnce({
      ok: false,
      error: "payment_required",
    });
    expect(
      await actions.reactivateBarbershop(IDLE, form({ barberia: SHOP })),
    ).toMatchObject({
      status: "failed",
      error: "payment_required",
    });
  });

  it("extends the trial from its current end (P-04)", async () => {
    expect(
      await run(() =>
        actions.extendTrial(IDLE, form({ barberia: SHOP, dias: "7" })),
      ),
    ).toEqual({ redirectedTo: `/admin/barberias/${SHOP}?hecho=extendida` });
    expect(extendTrial).toHaveBeenCalledWith(SHOP, "2026-12-01");
    expect(
      await actions.extendTrial(IDLE, form({ barberia: SHOP, dias: "9" })),
    ).toMatchObject({
      status: "invalid",
    });
  });
});
