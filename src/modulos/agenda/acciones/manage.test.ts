import { beforeEach, describe, expect, it, vi } from "vitest";

// The actions run on the server; the database calls are stand-ins, so the
// test sees what would be sent and where the customer goes.
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

type Result = { ok: true } | { ok: false; error: string };
const cancelManagedAppointment = vi.fn<(token: string) => Promise<Result>>(
  async () => ({ ok: true }),
);
const rescheduleManagedAppointment = vi.fn<
  (token: string, startsAt: Date) => Promise<Result>
>(async () => ({ ok: true }));
vi.mock("../datos/manage-appointment", () => ({
  cancelManagedAppointment,
  rescheduleManagedAppointment,
}));

const { cancelAppointment, rescheduleAppointment } = await import("./manage");

const TOKEN = "a".repeat(43);

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

describe("cancelAppointment", () => {
  it("cancels by the token and shows C-12", async () => {
    const result = await run(() =>
      cancelAppointment({ status: "idle" }, form({ token: TOKEN })),
    );
    expect(cancelManagedAppointment).toHaveBeenCalledWith(TOKEN);
    expect(result).toEqual({ status: "done" });
  });

  it("goes back to the link when it stopped working or it is too late", async () => {
    for (const error of ["link_invalid", "too_late"]) {
      cancelManagedAppointment.mockResolvedValueOnce({ ok: false, error });
      expect(
        await run(() =>
          cancelAppointment({ status: "idle" }, form({ token: TOKEN })),
        ),
      ).toEqual({ redirectedTo: `/c/${TOKEN}` });
    }
  });

  it("says when it could not cancel", async () => {
    cancelManagedAppointment.mockResolvedValueOnce({
      ok: false,
      error: "unknown",
    });
    expect(
      await run(() =>
        cancelAppointment({ status: "idle" }, form({ token: TOKEN })),
      ),
    ).toEqual({ status: "failed", error: "unknown", values: {} });
  });
});

describe("rescheduleAppointment", () => {
  const VALID = { token: TOKEN, dia: "2026-11-24", hora: "16:45" };

  it("moves to the Bogotá time and says so on C-09", async () => {
    const result = await run(() =>
      rescheduleAppointment({ status: "idle" }, form(VALID)),
    );
    const [token, startsAt] = rescheduleManagedAppointment.mock.calls[0]!;
    expect(token).toBe(TOKEN);
    expect(startsAt.toISOString()).toBe("2026-11-24T21:45:00.000Z");
    expect(result).toEqual({ redirectedTo: `/c/${TOKEN}?cambiada=1` });
  });

  it("refuses a day or a time that is not one, before the database", async () => {
    for (const fields of [
      { ...VALID, dia: "2026-02-30" },
      { ...VALID, hora: "16:40" },
      { ...VALID, hora: "" },
    ]) {
      expect(
        await run(() =>
          rescheduleAppointment({ status: "idle" }, form(fields)),
        ),
      ).toEqual({ status: "failed", error: "slot_gone", values: {} });
    }
    expect(rescheduleManagedAppointment).not.toHaveBeenCalled();
  });

  it("goes back to choose when the time was taken", async () => {
    rescheduleManagedAppointment.mockResolvedValueOnce({
      ok: false,
      error: "slot_gone",
    });
    expect(
      await run(() => rescheduleAppointment({ status: "idle" }, form(VALID))),
    ).toEqual({
      redirectedTo: `/c/${TOKEN}?paso=cambiar&dia=2026-11-24&tomada=16%3A45`,
    });
  });

  it("goes back to the link when it stopped working or it is too late", async () => {
    for (const error of ["link_invalid", "too_late"]) {
      rescheduleManagedAppointment.mockResolvedValueOnce({ ok: false, error });
      expect(
        await run(() => rescheduleAppointment({ status: "idle" }, form(VALID))),
      ).toEqual({ redirectedTo: `/c/${TOKEN}` });
    }
  });

  it("says the other refusals on C-10", async () => {
    for (const error of ["not_accepting", "same_time", "unknown"]) {
      rescheduleManagedAppointment.mockResolvedValueOnce({ ok: false, error });
      expect(
        await run(() => rescheduleAppointment({ status: "idle" }, form(VALID))),
      ).toEqual({ status: "failed", error, values: {} });
    }
  });
});
