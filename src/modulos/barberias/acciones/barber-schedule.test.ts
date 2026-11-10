import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs on the server; here the session and the database are
// stand-ins. Only what the action echoes back is checked here; the rules of
// the week have their own tests (dominio/weekly-hours).
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const BARBER = "cccccccc-0000-4000-8000-000000000000";

vi.mock("@/modulos/cuentas/guards", () => ({
  requireOwner: async () => ({ barbershop: { id: SHOP } }),
}));
vi.mock("../datos/setup", () => ({
  barbershopNeedsSetup: async () => false,
  getBarbershopHours: async () => [
    { weekday: 1, start: "09:00", end: "20:00" },
  ],
}));
const setBarberSchedule = vi.fn(async () => "saved" as const);
vi.mock("../datos/barbers", () => ({
  getBarber: async (_shop: string, id: string) =>
    id === BARBER ? { id: BARBER } : null,
  setBarberSchedule,
}));

const { saveBarberSchedule } = await import("./barber-schedule");
const { MAX_WEEK_LENGTH } = await import("./week-field");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveBarberSchedule", () => {
  it("does not echo back a week longer than a screen could send", async () => {
    const result = await saveBarberSchedule(
      { status: "idle" },
      form({ barberId: BARBER, shifts: "x".repeat(MAX_WEEK_LENGTH + 1) }),
    );
    expect(result).toEqual({
      status: "failed",
      error: "unknown",
      values: { usesBarbershopHours: "", shifts: "" },
    });
    expect(setBarberSchedule).not.toHaveBeenCalled();
  });

  it("echoes back a week it refuses, as sent", async () => {
    const shifts = JSON.stringify([
      { weekday: 1, start: "18:00", end: "09:00" },
    ]);
    expect(
      await saveBarberSchedule(
        { status: "idle" },
        form({ barberId: BARBER, shifts }),
      ),
    ).toMatchObject({ status: "invalid", values: { shifts } });
  });
});
