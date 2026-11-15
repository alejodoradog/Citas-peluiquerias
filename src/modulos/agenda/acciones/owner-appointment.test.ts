import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run on the server; the session and the database are
// stand-ins, so the test sees what would be written and where it goes next.
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
const APPOINTMENT = "cccccccc-0000-4000-8000-000000000000";

const requireOwner = vi.fn(async () => ({
  barbershop: { id: SHOP, needsSetup: false },
}));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const setOwnerAppointmentStatus = vi.fn(async () => ({
  ok: true as const,
  value: undefined,
}));
const findCustomers = vi.fn(async () => []);
vi.mock("../datos/owner-appointment", () => ({
  changeOwnerAppointmentServices: vi.fn(),
  createManualAppointment: vi.fn(),
  createOwnerBlock: vi.fn(),
  deleteOwnerBlock: vi.fn(),
  findCustomers,
  rescheduleOwnerAppointment: vi.fn(),
  setOwnerAppointmentStatus,
}));

const { cancelOwnerAppointment, searchCustomers } =
  await import("./owner-appointment");

function cancelForm() {
  const data = new FormData();
  data.set("cita", APPOINTMENT);
  return data;
}

async function cancel() {
  try {
    return await cancelOwnerAppointment({ status: "idle" }, cancelForm());
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the owner's appointment actions", () => {
  it("cancel in the owner's barbershop and go back to D-34", async () => {
    expect(await cancel()).toEqual({
      redirectedTo: `/panel/citas/${APPOINTMENT}?hecho=cancelled`,
    });
    expect(setOwnerAppointmentStatus).toHaveBeenCalledWith(
      APPOINTMENT,
      "cancelled_by_barbershop",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/panel");
  });

  it("send an owner who has not finished the wizard back to it, writing nothing", async () => {
    requireOwner.mockResolvedValueOnce({
      barbershop: { id: SHOP, needsSetup: true },
    });
    expect(await cancel()).toEqual({ redirectedTo: "/panel/configurar" });
    expect(setOwnerAppointmentStatus).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("search the customers of the owner's barbershop only", async () => {
    await searchCustomers("Car");
    expect(findCustomers).toHaveBeenCalledWith(SHOP, "Car");
  });
});
