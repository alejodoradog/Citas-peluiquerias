import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs on the server; here the session and the database are
// stand-ins, so the test sees exactly what would be written.
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
const OTHER_SHOP = "bbbbbbbb-0000-4000-8000-000000000000";

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const barbershopNeedsSetup = vi.fn(async () => false);
const setBarbershopHours = vi.fn<
  (
    shop: string,
    shifts: ReadonlyArray<{ weekday: number; start: string; end: string }>,
  ) => Promise<"saved" | "overlap" | "closed" | "failed">
>(async () => "saved");
vi.mock("../datos/setup", () => ({ barbershopNeedsSetup, setBarbershopHours }));

const { saveShopHours } = await import("./shop-hours");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const week = (shifts: unknown) => form({ shifts: JSON.stringify(shifts) });

async function run(data: FormData) {
  try {
    return await saveShopHours({ status: "idle" }, data);
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveShopHours", () => {
  it("saves the week in the owner's barbershop and comes back saved", async () => {
    const result = await run(
      week([
        { weekday: 6, start: "08:00", end: "21:00" },
        { weekday: 1, start: "14:00", end: "20:00" },
        { weekday: 1, start: "09:00", end: "13:00" },
      ]),
    );
    expect(setBarbershopHours).toHaveBeenCalledWith(SHOP, [
      { weekday: 1, start: "09:00", end: "13:00" },
      { weekday: 1, start: "14:00", end: "20:00" },
      { weekday: 6, start: "08:00", end: "21:00" },
    ]);
    expect(result).toEqual({ redirectedTo: "/panel/horario?guardado=1" });
    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/panel/mas",
        "/panel/horario",
        "/panel/barberos",
        "/panel/barberos/[id]",
        "/panel/barberos/[id]/horario",
      ]),
    );
  });

  it("ignores any barbershop the browser sends", async () => {
    const data = week([{ weekday: 1, start: "09:00", end: "18:00" }]);
    data.set("barbershopId", OTHER_SHOP);
    await run(data);
    expect(setBarbershopHours).toHaveBeenCalledWith(SHOP, expect.any(Array));
  });

  it("refuses a barbershop closed every day", async () => {
    expect(await run(week([]))).toEqual({
      status: "failed",
      error: "hours_required",
      values: { shifts: "[]" },
    });
    expect(setBarbershopHours).not.toHaveBeenCalled();
  });

  it("marks each day that breaks a rule", async () => {
    const result = await run(
      week([
        { weekday: 1, start: "09:00", end: "13:00" },
        { weekday: 1, start: "12:00", end: "18:00" },
        { weekday: 2, start: "18:00", end: "09:00" },
      ]),
    );
    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: { day1: "hours_overlap", day2: "hours_order" },
    });
    expect(setBarbershopHours).not.toHaveBeenCalled();
  });

  it("treats a week the screen could not send as unknown", async () => {
    for (const data of [
      form({ shifts: "not json" }),
      form({}),
      week([{ weekday: 9, start: "09:00", end: "18:00" }]),
      week([
        { weekday: 1, start: "09:00", end: "18:00", barbershop_id: OTHER_SHOP },
      ]),
      form({ shifts: "x".repeat(5_000) }),
    ]) {
      expect(await run(data)).toMatchObject({
        status: "failed",
        error: "unknown",
      });
    }
    expect(setBarbershopHours).not.toHaveBeenCalled();
  });

  it("does not echo back a week longer than a screen could send", async () => {
    expect(await run(form({ shifts: "x".repeat(5_000) }))).toEqual({
      status: "failed",
      error: "unknown",
      values: { shifts: "" },
    });
  });

  it("explains what the database refuses", async () => {
    setBarbershopHours.mockResolvedValueOnce("overlap");
    expect(
      await run(week([{ weekday: 1, start: "09:00", end: "18:00" }])),
    ).toMatchObject({ status: "failed", error: "hours_overlap" });
    setBarbershopHours.mockResolvedValueOnce("closed");
    expect(
      await run(week([{ weekday: 1, start: "09:00", end: "18:00" }])),
    ).toMatchObject({ status: "failed", error: "hours_required" });
    setBarbershopHours.mockResolvedValueOnce("failed");
    expect(
      await run(week([{ weekday: 1, start: "09:00", end: "18:00" }])),
    ).toMatchObject({ status: "failed", error: "unknown" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sends an owner without the setup back to the wizard", async () => {
    barbershopNeedsSetup.mockResolvedValueOnce(true);
    expect(
      await run(week([{ weekday: 1, start: "09:00", end: "18:00" }])),
    ).toEqual({ redirectedTo: "/panel/configurar" });
    expect(setBarbershopHours).not.toHaveBeenCalled();
  });
});
