import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The actions run on the server; here the session and the database are
// stand-ins, so the test sees exactly what would be written.
vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));
const revalidateTag = vi.fn();
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
const CLOSURE = "cccccccc-0000-4000-8000-000000000000";

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const barbershopNeedsSetup = vi.fn(async () => false);
vi.mock("../datos/setup", () => ({ barbershopNeedsSetup }));

const setHolidayOpenings = vi.fn<
  (
    shop: string,
    window: { from: string; until: string },
    dates: readonly string[],
  ) => Promise<boolean>
>(async () => true);
const insertClosure = vi.fn<
  (
    shop: string,
    closure: { startsAt: Date; endsAt: Date; reason: string | null },
  ) => Promise<boolean>
>(async () => true);
const deleteClosure = vi.fn<(shop: string, id: string) => Promise<boolean>>(
  async () => true,
);
vi.mock("../datos/holidays", () => ({
  setHolidayOpenings,
  insertClosure,
  deleteClosure,
}));

const { saveHolidayOpenings, addClosure, removeClosure } =
  await import("./holidays");

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of [value].flat()) data.append(name, item);
  }
  return data;
}

async function run<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // 10:00 a. m. in Bogotá on Tuesday, November 10, 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const WINDOW = { from: "2026-11-10", until: "2027-11-09" };

describe("saveHolidayOpenings", () => {
  const save = (data: FormData) =>
    run(() => saveHolidayOpenings({ status: "idle" }, data));

  it("opens the holidays switched on, for the next 12 months of the owner's barbershop", async () => {
    const result = await save(
      form({ open: ["2026-12-25", "2026-11-16"], barbershopId: OTHER_SHOP }),
    );
    expect(setHolidayOpenings).toHaveBeenCalledWith(SHOP, WINDOW, [
      "2026-11-16",
      "2026-12-25",
    ]);
    expect(result).toEqual({
      redirectedTo: "/panel/horario/festivos?guardado=1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/panel/horario/festivos");
  });

  it("closes them all when none is on", async () => {
    await save(form({}));
    expect(setHolidayOpenings).toHaveBeenCalledWith(SHOP, WINDOW, []);
  });

  it("treats a day that is not a holiday of the window as unknown", async () => {
    for (const data of [
      form({ open: "2026-11-17" }),
      form({ open: "2027-11-15" }),
      form({ open: "x" }),
    ]) {
      expect(await save(data)).toEqual({
        status: "failed",
        error: "unknown",
        values: {},
      });
    }
    expect(setHolidayOpenings).not.toHaveBeenCalled();
  });

  it("says so when the database writes nothing", async () => {
    setHolidayOpenings.mockResolvedValueOnce(false);
    expect(await save(form({ open: "2026-11-16" }))).toEqual({
      status: "failed",
      error: "unknown",
      values: {},
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("uses the Bogotá day, not the UTC one, late at night", async () => {
    // 11:30 p. m. of November 15 in Bogotá is already the 16th in UTC.
    vi.setSystemTime(new Date("2026-11-16T04:30:00Z"));
    await save(form({}));
    expect(setHolidayOpenings).toHaveBeenCalledWith(
      SHOP,
      { from: "2026-11-15", until: "2027-11-14" },
      [],
    );
  });

  it("sends an owner without the setup back to the wizard", async () => {
    barbershopNeedsSetup.mockResolvedValueOnce(true);
    expect(await save(form({}))).toEqual({
      redirectedTo: "/panel/configurar",
    });
    expect(setHolidayOpenings).not.toHaveBeenCalled();
  });
});

describe("addClosure", () => {
  const add = (fields: Record<string, string>) =>
    run(() =>
      addClosure(
        { status: "idle" },
        form({
          fromDate: "2026-12-24",
          toDate: "2026-12-24",
          fromTime: "14:00",
          toTime: "24:00",
          reason: "Nochebuena",
          ...fields,
        }),
      ),
    );

  it("closes the owner's whole barbershop", async () => {
    const result = await add({ barbershopId: OTHER_SHOP, barberId: CLOSURE });
    expect(insertClosure).toHaveBeenCalledWith(SHOP, {
      startsAt: new Date("2026-12-24T19:00:00Z"),
      endsAt: new Date("2026-12-25T05:00:00Z"),
      reason: "Nochebuena",
    });
    expect(result).toEqual({ status: "done", notice: "closure_added" });
    expect(revalidatePath).toHaveBeenCalledWith("/panel/horario/festivos");
  });

  it("says what to fix", async () => {
    expect(await add({ toDate: "2026-12-23" })).toMatchObject({
      status: "invalid",
      fieldErrors: { toDate: "closure_order" },
    });
    expect(
      await add({ fromDate: "2026-11-09", toDate: "2026-11-09" }),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { toTime: "closure_past" },
    });
    expect(insertClosure).not.toHaveBeenCalled();
  });

  it("says so when the database writes nothing", async () => {
    insertClosure.mockResolvedValueOnce(false);
    expect(await add({})).toMatchObject({ status: "failed", error: "unknown" });
  });
});

describe("removeClosure", () => {
  it("removes a closure of the owner's barbershop", async () => {
    expect(await run(() => removeClosure(CLOSURE))).toEqual({ ok: true });
    expect(deleteClosure).toHaveBeenCalledWith(SHOP, CLOSURE);
    expect(revalidatePath).toHaveBeenCalledWith("/panel/horario/festivos");
  });

  it("refuses what is not an id without asking the database", async () => {
    for (const id of ["", "1 or 1=1", 42 as unknown as string]) {
      expect(await run(() => removeClosure(id))).toEqual({
        ok: false,
        error: "unknown",
      });
    }
    expect(deleteClosure).not.toHaveBeenCalled();
  });

  it("says so when the database refuses", async () => {
    deleteClosure.mockResolvedValueOnce(false);
    expect(await run(() => removeClosure(CLOSURE))).toEqual({
      ok: false,
      error: "unknown",
    });
  });
});
