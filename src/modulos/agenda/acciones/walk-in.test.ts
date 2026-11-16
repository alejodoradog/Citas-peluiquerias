import { beforeEach, describe, expect, it, vi } from "vitest";

// Task 7.7: the actions of "Cita al momento". The database calls are
// stand-ins: the test sees what would be sent and where each one goes.
// Above all, that the professional's sends no professional nor
// establishment, and that the owner's establishment is the session's.
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
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

type Result =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string; clash: unknown };
let result: Result = { ok: true, appointmentId: "new" };
const createMyWalkIn = vi.fn<(...args: unknown[]) => Promise<Result>>(
  async () => result,
);
const createOwnerWalkIn = vi.fn<(...args: unknown[]) => Promise<Result>>(
  async () => result,
);
vi.mock("../datos/walk-in", () => ({ createMyWalkIn, createOwnerWalkIn }));

let guard = "pass";
const requireProfessional = vi.fn(async () => {
  if (guard !== "pass") throw new Redirect(guard);
  return { kind: "professional" };
});
let needsSetup = false;
const requireOwner = vi.fn(async () => {
  if (guard !== "pass") throw new Redirect(guard);
  return { barbershop: { id: "shop-of-the-session", needsSetup } };
});
vi.mock("@/modulos/cuentas/guards", () => ({
  requireProfessional,
  requireOwner,
}));

const { createMyWalkInAction, createOwnerWalkInAction } =
  await import("./walk-in");

const CORTE = "5e000000-0000-4000-8000-000000000001";
const BARBA = "5e000000-0000-4000-8000-000000000002";
const BARBER = "ba000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const one of Array.isArray(value) ? value : [value])
      data.append(name, one);
  }
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

const IDLE = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  guard = "pass";
  needsSetup = false;
  result = { ok: true, appointmentId: "new" };
});

describe("createMyWalkInAction (the professional)", () => {
  it("sends the services and the name only, then goes back to the agenda", async () => {
    const outcome = await run(() =>
      createMyWalkInAction(
        IDLE,
        form({
          servicios: [CORTE, BARBA],
          nombre: " Pedro ",
          // A forged professional and establishment are ignored.
          profesional: BARBER,
          barberia: "otra",
        }),
      ),
    );
    expect(outcome).toEqual({ redirectedTo: "/mi-agenda" });
    expect(createMyWalkIn).toHaveBeenCalledWith({
      serviceIds: [CORTE, BARBA],
      customerName: "Pedro",
    });
  });
  it("does nothing without the guard", async () => {
    guard = "/nueva-clave";
    expect(
      await run(() => createMyWalkInAction(IDLE, form({ servicios: [CORTE] }))),
    ).toEqual({
      redirectedTo: "/nueva-clave",
    });
    expect(createMyWalkIn).not.toHaveBeenCalled();
  });
  it("refuses no services before asking the database", async () => {
    const state = await createMyWalkInAction(IDLE, form({ nombre: "Ana" }));
    expect(state).toEqual({
      status: "invalid",
      fieldErrors: { servicios: "services_required" },
      values: { nombre: "Ana" },
    });
    expect(createMyWalkIn).not.toHaveBeenCalled();
  });
  it("brings back the clash, with what and how much is free", async () => {
    const clash = {
      kind: "appointment",
      at: new Date(),
      freeMinutes: 20,
      neededMinutes: 40,
    };
    result = { ok: false, error: "walk_in_clash", clash };
    expect(
      await createMyWalkInAction(IDLE, form({ servicios: [CORTE] })),
    ).toEqual({
      status: "failed",
      error: "walk_in_clash",
      values: { nombre: "" },
      clash,
    });
  });
  it("a name the database refuses is an error of the field", async () => {
    result = { ok: false, error: "customer_name_invalid", clash: null };
    expect(
      await createMyWalkInAction(
        IDLE,
        form({ servicios: [CORTE], nombre: "x" }),
      ),
    ).toEqual({
      status: "invalid",
      fieldErrors: { nombre: "customer_name_invalid" },
      values: { nombre: "x" },
    });
  });
  it("a session that is no longer of a professional goes to its agenda", async () => {
    result = { ok: false, error: "not_professional", clash: null };
    expect(
      await run(() => createMyWalkInAction(IDLE, form({ servicios: [CORTE] }))),
    ).toEqual({
      redirectedTo: "/mi-agenda",
    });
  });
});

describe("createOwnerWalkInAction (the owner)", () => {
  it("uses the establishment of the session and the chosen professional, then the agenda", async () => {
    const outcome = await run(() =>
      createOwnerWalkInAction(
        IDLE,
        form({
          profesional: BARBER,
          servicios: [CORTE],
          nombre: "",
          barberia: "otra",
        }),
      ),
    );
    expect(outcome).toEqual({ redirectedTo: "/panel" });
    expect(createOwnerWalkIn).toHaveBeenCalledWith(
      "shop-of-the-session",
      BARBER,
      {
        serviceIds: [CORTE],
        customerName: null,
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/panel");
  });
  it("refuses a professional that is not an id, and no services, at once", async () => {
    expect(
      await createOwnerWalkInAction(IDLE, form({ profesional: "x" })),
    ).toEqual({
      status: "invalid",
      fieldErrors: {
        profesional: "barber_not_found",
        servicios: "services_required",
      },
      values: { nombre: "", profesional: "x" },
    });
    expect(createOwnerWalkIn).not.toHaveBeenCalled();
  });
  it("a professional of another establishment is an error of the field", async () => {
    result = { ok: false, error: "barber_not_found", clash: null };
    expect(
      await createOwnerWalkInAction(
        IDLE,
        form({ profesional: BARBER, servicios: [CORTE] }),
      ),
    ).toEqual({
      status: "invalid",
      fieldErrors: { profesional: "barber_not_found" },
      values: { nombre: "", profesional: BARBER },
    });
  });
  it("an owner who has not finished the setup goes to it", async () => {
    needsSetup = true;
    expect(
      await run(() =>
        createOwnerWalkInAction(
          IDLE,
          form({ profesional: BARBER, servicios: [CORTE] }),
        ),
      ),
    ).toEqual({ redirectedTo: "/panel/configurar" });
    expect(createOwnerWalkIn).not.toHaveBeenCalled();
  });
});
