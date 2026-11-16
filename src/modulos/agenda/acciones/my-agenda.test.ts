import { beforeEach, describe, expect, it, vi } from "vitest";

// "Mi agenda" by the session (task 7.6b; the only entry since the private
// link went with task 7.6c). The database calls are stand-ins: the test sees
// what would be sent and where the professional goes. Above all, that
// nothing the form carries says who the professional is. The rules of the
// link's actions (task 4.4) are here too, so none was lost with them.
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
  (id: string, status: string) => Promise<Result>
>(async () => ({ ok: true }));
const deleteTimeBlockByBarber = vi.fn<(id: string) => Promise<Result>>(
  async () => ({ ok: true }),
);
const createTimeBlockByBarber = vi.fn<
  (block: { start: Date; end: Date; reason: string | null }) => Promise<Result>
>(async () => ({ ok: true }));
vi.mock("../datos/barber-agenda", () => ({
  markAppointmentByBarber,
  deleteTimeBlockByBarber,
  createTimeBlockByBarber,
}));

// The guard of the pages (review of task 7.6b): a professional who accepted
// the terms, or a redirect home.
let guard = "pass";
const requireProfessional = vi.fn(async () => {
  if (guard !== "pass") throw new Redirect(guard);
  return { kind: "professional", acceptedTerms: true };
});
vi.mock("@/modulos/cuentas/guards", () => ({ requireProfessional }));

const { markMyAppointment, removeMyBlock, createMyBlock } =
  await import("./my-agenda");

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
  guard = "pass";
});

describe("the guard", () => {
  it("a professional who has not accepted the terms does nothing: to accept them first", async () => {
    guard = "/nueva-clave";
    expect(
      await run(() =>
        markMyAppointment(form({ cita: APPOINTMENT, estado: "attended" })),
      ),
    ).toEqual({ redirectedTo: "/nueva-clave" });
    expect(await run(() => removeMyBlock(form({ bloqueo: BLOCK })))).toEqual({
      redirectedTo: "/nueva-clave",
    });
    expect(
      await run(() =>
        createMyBlock(
          { status: "idle" },
          form({
            dia: "2026-11-08",
            desde: "13:00",
            hasta: "14:00",
            motivo: "lunch",
          }),
        ),
      ),
    ).toEqual({ redirectedTo: "/nueva-clave" });
    expect(markAppointmentByBarber).not.toHaveBeenCalled();
    expect(deleteTimeBlockByBarber).not.toHaveBeenCalled();
    expect(createTimeBlockByBarber).not.toHaveBeenCalled();
  });

  it("an owner (or anyone else) goes home, without touching the database", async () => {
    guard = "/panel";
    expect(
      await run(() =>
        markMyAppointment(form({ cita: APPOINTMENT, estado: "attended" })),
      ),
    ).toEqual({ redirectedTo: "/panel" });
    expect(markAppointmentByBarber).not.toHaveBeenCalled();
  });

  it("every action asks the guard", async () => {
    await run(() =>
      markMyAppointment(form({ cita: APPOINTMENT, estado: "attended" })),
    );
    await run(() => removeMyBlock(form({ bloqueo: BLOCK })));
    await run(() => createMyBlock({ status: "idle" }, form({})));
    expect(requireProfessional).toHaveBeenCalledTimes(3);
  });
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
      APPOINTMENT,
      "attended",
    );
  });

  it("goes back to today without a query", async () => {
    expect(
      await run(() =>
        markMyAppointment(
          form({ cita: APPOINTMENT, estado: "no_show", volver: "2026-11-07" }),
        ),
      ),
    ).toEqual({ redirectedTo: "/mi-agenda" });
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
    expect(deleteTimeBlockByBarber).toHaveBeenCalledWith(BLOCK);
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

  it("never removes something that is not an id", async () => {
    expect(
      await run(() => removeMyBlock(form({ bloqueo: "../../panel" }))),
    ).toEqual({ redirectedTo: "/mi-agenda?aviso=not_yours" });
    expect(deleteTimeBlockByBarber).not.toHaveBeenCalled();
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
    expect(createTimeBlockByBarber).toHaveBeenCalledWith({
      start: new Date("2026-11-08T18:00:00Z"),
      end: new Date("2026-11-08T19:00:00Z"),
      reason: "Almuerzo",
    });
  });

  // Task 7.4.
  it("blocks the whole day when the box is checked, whatever the hours say", async () => {
    await run(() =>
      createMyBlock(
        { status: "idle" },
        form({ ...valid, desde: "", hasta: "", todoElDia: "on" }),
      ),
    );
    expect(createTimeBlockByBarber).toHaveBeenCalledWith({
      start: new Date("2026-11-08T05:00:00Z"),
      end: new Date("2026-11-09T05:00:00Z"),
      reason: "Almuerzo",
    });
  });

  it("saves 'Otro' without a reason", async () => {
    await run(() =>
      createMyBlock({ status: "idle" }, form({ ...valid, motivo: "other" })),
    );
    expect(createTimeBlockByBarber.mock.calls[0]?.[0].reason).toBeNull();
  });

  it("shows what to fix without calling the database", async () => {
    expect(
      await createMyBlock(
        { status: "idle" },
        form({ ...valid, hasta: "12:00" }),
      ),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { hasta: "end_before_start" },
    });
    expect(createTimeBlockByBarber).not.toHaveBeenCalled();
  });

  it("keeps what was sent after a refusal, and reads a block in the past as a field to fix", async () => {
    createTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "overlaps_appointment",
    });
    expect(await createMyBlock({ status: "idle" }, form(valid))).toEqual({
      status: "failed",
      error: "overlaps_appointment",
      values: {
        dia: "2026-11-08",
        desde: "13:00",
        hasta: "14:00",
        motivo: "lunch",
        todoElDia: "",
      },
    });
    createTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "too_early",
    });
    expect(await createMyBlock({ status: "idle" }, form(valid))).toMatchObject({
      status: "invalid",
      fieldErrors: { desde: "in_the_past" },
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
