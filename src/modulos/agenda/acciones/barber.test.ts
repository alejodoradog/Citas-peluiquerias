import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run on the server; the database calls are stand-ins, so the
// test sees what would be sent and where the barber goes.
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
  (token: string, id: string, status: string) => Promise<Result>
>(async () => ({ ok: true }));
const deleteTimeBlockByBarber = vi.fn<
  (token: string, id: string) => Promise<Result>
>(async () => ({ ok: true }));
const createTimeBlockByBarber = vi.fn<
  (
    token: string,
    block: { start: Date; end: Date; reason: string | null },
  ) => Promise<Result>
>(async () => ({ ok: true }));
vi.mock("../datos/barber-agenda", () => ({
  markAppointmentByBarber,
  deleteTimeBlockByBarber,
  createTimeBlockByBarber,
}));

vi.mock("@/lib/tokens/link-token", () => ({
  isLinkToken: (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value),
}));

const { markAppointment, removeBlock, createBlock } = await import("./barber");

const TOKEN = "a".repeat(43);
const APPOINTMENT = "a0000000-0000-4000-8000-000000000001";
const BLOCK = "b0000000-0000-4000-8000-000000000001";

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

describe("markAppointment", () => {
  it("marks by the token and goes back to the day it came from", async () => {
    const result = await run(() =>
      markAppointment(
        form({
          token: TOKEN,
          cita: APPOINTMENT,
          estado: "attended",
          volver: "2026-11-06",
        }),
      ),
    );
    expect(markAppointmentByBarber).toHaveBeenCalledWith(
      TOKEN,
      APPOINTMENT,
      "attended",
    );
    expect(result).toEqual({ redirectedTo: `/b/${TOKEN}?dia=2026-11-06` });
  });

  it("goes back to today without a query, or to the appointment (B-03)", async () => {
    expect(
      await run(() =>
        markAppointment(
          form({
            token: TOKEN,
            cita: APPOINTMENT,
            estado: "no_show",
            volver: "2026-11-07",
          }),
        ),
      ),
    ).toEqual({ redirectedTo: `/b/${TOKEN}` });
    expect(
      await run(() =>
        markAppointment(
          form({
            token: TOKEN,
            cita: APPOINTMENT,
            estado: "no_show",
            volver: "cita",
          }),
        ),
      ),
    ).toEqual({ redirectedTo: `/b/${TOKEN}/citas/${APPOINTMENT}` });
  });

  it("says why it could not mark", async () => {
    markAppointmentByBarber.mockResolvedValueOnce({
      ok: false,
      error: "not_confirmed",
    });
    expect(
      await run(() =>
        markAppointment(
          form({
            token: TOKEN,
            cita: APPOINTMENT,
            estado: "attended",
            volver: "cita",
          }),
        ),
      ),
    ).toEqual({
      redirectedTo: `/b/${TOKEN}/citas/${APPOINTMENT}?aviso=not_confirmed`,
    });
  });

  it("sends a link that stopped working to the link (B-05)", async () => {
    markAppointmentByBarber.mockResolvedValueOnce({
      ok: false,
      error: "link_invalid",
    });
    expect(
      await run(() =>
        markAppointment(
          form({ token: TOKEN, cita: APPOINTMENT, estado: "attended" }),
        ),
      ),
    ).toEqual({ redirectedTo: `/b/${TOKEN}` });
  });

  it("never marks anything but attended or no-show, nor something that is not an id", async () => {
    for (const fields of [
      { estado: "cancelled_by_barbershop", cita: APPOINTMENT },
      { estado: "attended", cita: "1; drop table" },
    ]) {
      expect(
        await run(() => markAppointment(form({ token: TOKEN, ...fields }))),
      ).toEqual({
        redirectedTo: `/b/${TOKEN}?aviso=not_yours`,
      });
    }
    expect(markAppointmentByBarber).not.toHaveBeenCalled();
  });

  it("never redirects to something built from what is not a token", async () => {
    expect(
      await run(() =>
        markAppointment(
          form({ token: "../../panel", cita: APPOINTMENT, estado: "attended" }),
        ),
      ),
    ).toEqual({ redirectedTo: "/" });
    expect(markAppointmentByBarber).not.toHaveBeenCalled();
  });
});

describe("removeBlock", () => {
  it("removes by the token and goes back to the day", async () => {
    expect(
      await run(() =>
        removeBlock(
          form({ token: TOKEN, bloqueo: BLOCK, volver: "2026-11-08" }),
        ),
      ),
    ).toEqual({ redirectedTo: `/b/${TOKEN}?dia=2026-11-08` });
    expect(deleteTimeBlockByBarber).toHaveBeenCalledWith(TOKEN, BLOCK);
  });

  it("says why it could not remove it", async () => {
    deleteTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "read_only",
    });
    expect(
      await run(() => removeBlock(form({ token: TOKEN, bloqueo: BLOCK }))),
    ).toEqual({
      redirectedTo: `/b/${TOKEN}?aviso=read_only`,
    });
  });
});

describe("createBlock", () => {
  const valid = {
    token: TOKEN,
    dia: "2026-11-08",
    desde: "13:00",
    hasta: "14:00",
    motivo: "lunch",
  };

  it("saves the block with its reason in Spanish and opens its day", async () => {
    expect(
      await run(() => createBlock({ status: "idle" }, form(valid))),
    ).toEqual({
      redirectedTo: `/b/${TOKEN}?dia=2026-11-08`,
    });
    expect(createTimeBlockByBarber).toHaveBeenCalledWith(TOKEN, {
      start: new Date("2026-11-08T18:00:00Z"),
      end: new Date("2026-11-08T19:00:00Z"),
      reason: "Almuerzo",
    });
  });

  it("saves 'Otro' without a reason", async () => {
    await run(() =>
      createBlock({ status: "idle" }, form({ ...valid, motivo: "other" })),
    );
    expect(createTimeBlockByBarber.mock.calls[0]?.[1].reason).toBeNull();
  });

  it("shows what to fix without calling the database", async () => {
    expect(
      await createBlock({ status: "idle" }, form({ ...valid, hasta: "12:00" })),
    ).toMatchObject({
      status: "invalid",
      fieldErrors: { hasta: "end_before_start" },
    });
    expect(createTimeBlockByBarber).not.toHaveBeenCalled();
  });

  it("says why the database refused it", async () => {
    createTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "overlaps_appointment",
    });
    expect(await createBlock({ status: "idle" }, form(valid))).toEqual({
      status: "failed",
      error: "overlaps_appointment",
      values: {
        dia: "2026-11-08",
        desde: "13:00",
        hasta: "14:00",
        motivo: "lunch",
      },
    });
    createTimeBlockByBarber.mockResolvedValueOnce({
      ok: false,
      error: "too_early",
    });
    expect(await createBlock({ status: "idle" }, form(valid))).toMatchObject({
      status: "invalid",
      fieldErrors: { desde: "in_the_past" },
    });
  });

  it("refuses a token that is not one", async () => {
    expect(
      await createBlock({ status: "idle" }, form({ ...valid, token: "x" })),
    ).toEqual({
      status: "failed",
      error: "link_invalid",
      values: {},
    });
  });
});
