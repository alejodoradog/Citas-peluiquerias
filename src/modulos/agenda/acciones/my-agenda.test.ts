import { beforeEach, describe, expect, it, vi } from "vitest";

// "Mi agenda" by the session (task 7.6b). The database calls are stand-ins:
// the test sees what would be sent and where the professional goes. Above
// all, that nothing the form carries says who the professional is.
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

// Saturday 7 November 2026, 10:00 in Bogotá.
const NOW = new Date("2026-11-07T15:00:00Z");
vi.mock("@/lib/fechas/fechas", async (original) => ({
  ...(await original<typeof import("@/lib/fechas/fechas")>()),
  now: () => NOW,
}));

type Result = { ok: true } | { ok: false; error: string };
const markAppointmentByBarber = vi.fn<
  (source: unknown, id: string, status: string) => Promise<Result>
>(async () => ({ ok: true }));
const deleteTimeBlockByBarber = vi.fn<
  (source: unknown, id: string) => Promise<Result>
>(async () => ({ ok: true }));
const createTimeBlockByBarber = vi.fn<
  (
    source: unknown,
    block: { start: Date; end: Date; reason: string | null },
  ) => Promise<Result>
>(async () => ({ ok: true }));
vi.mock("../datos/barber-agenda", () => ({
  markAppointmentByBarber,
  deleteTimeBlockByBarber,
  createTimeBlockByBarber,
}));

const { markMyAppointment, removeMyBlock, createMyBlock } =
  await import("./my-agenda");

const SESSION = { kind: "session" };
const APPOINTMENT = "a0000000-0000-4000-8000-000000000001";
const BLOCK = "b0000000-0000-4000-8000-000000000001";
const OTHER_BARBER = "c0000000-0000-4000-8000-000000000001";

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

describe("markMyAppointment", () => {
  it("marks by the session, whatever the form says about who", async () => {
    expect(
      await run(() =>
        markMyAppointment(
          form({
            cita: APPOINTMENT,
            estado: "attended",
            volver: "2026-11-06",
            // Planted: the actions never read them.
            token: "a".repeat(43),
            barbero: OTHER_BARBER,
            barbershop_id: OTHER_BARBER,
          }),
        ),
      ),
    ).toEqual({ redirectedTo: "/mi-agenda?dia=2026-11-06" });
    expect(markAppointmentByBarber).toHaveBeenCalledWith(
      SESSION,
      APPOINTMENT,
      "attended",
    );
  });

  it("goes back to the appointment, with why it could not mark", async () => {
    markAppointmentByBarber.mockResolvedValueOnce({
      ok: false,
      error: "not_confirmed",
    });
    expect(
      await run(() =>
        markMyAppointment(
          form({ cita: APPOINTMENT, estado: "no_show", volver: "cita" }),
        ),
      ),
    ).toEqual({
      redirectedTo: `/mi-agenda/citas/${APPOINTMENT}?aviso=not_confirmed`,
    });
  });

  it("sends a session that is no longer of a professional to /mi-agenda, whose guard sends it home", async () => {
    markAppointmentByBarber.mockResolvedValueOnce({
      ok: false,
      error: "not_professional",
    });
    expect(
      await run(() =>
        markMyAppointment(
          form({ cita: APPOINTMENT, estado: "attended", volver: "cita" }),
        ),
      ),
    ).toEqual({ redirectedTo: "/mi-agenda" });
  });

  it("never marks anything but attended or no-show, nor something that is not an id", async () => {
    for (const fields of [
      { estado: "cancelled_by_barbershop", cita: APPOINTMENT },
      { estado: "attended", cita: "../../panel" },
    ]) {
      expect(await run(() => markMyAppointment(form(fields)))).toEqual({
        redirectedTo: "/mi-agenda?aviso=not_yours",
      });
    }
    expect(markAppointmentByBarber).not.toHaveBeenCalled();
  });
});

describe("removeMyBlock", () => {
  it("removes by the session and goes back to the day", async () => {
    expect(
      await run(() =>
        removeMyBlock(form({ bloqueo: BLOCK, volver: "2026-11-08" })),
      ),
    ).toEqual({ redirectedTo: "/mi-agenda?dia=2026-11-08" });
    expect(deleteTimeBlockByBarber).toHaveBeenCalledWith(SESSION, BLOCK);
  });

  it("says why it could not remove it", async () => {
    deleteTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "read_only",
    });
    expect(await run(() => removeMyBlock(form({ bloqueo: BLOCK })))).toEqual({
      redirectedTo: "/mi-agenda?aviso=read_only",
    });
  });
});

describe("createMyBlock", () => {
  const valid = {
    dia: "2026-11-08",
    desde: "13:00",
    hasta: "14:00",
    motivo: "lunch",
  };

  it("blocks by the session and opens its day", async () => {
    expect(
      await run(() => createMyBlock({ status: "idle" }, form(valid))),
    ).toEqual({ redirectedTo: "/mi-agenda?dia=2026-11-08" });
    expect(createTimeBlockByBarber).toHaveBeenCalledWith(SESSION, {
      start: new Date("2026-11-08T18:00:00Z"),
      end: new Date("2026-11-08T19:00:00Z"),
      reason: "Almuerzo",
    });
  });

  it("says why the database refused it, and leaves a lost session", async () => {
    createTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "overlaps_block",
    });
    expect(await createMyBlock({ status: "idle" }, form(valid))).toMatchObject({
      status: "failed",
      error: "overlaps_block",
    });
    createTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "not_professional",
    });
    expect(
      await run(() => createMyBlock({ status: "idle" }, form(valid))),
    ).toEqual({ redirectedTo: "/mi-agenda" });
  });
});
