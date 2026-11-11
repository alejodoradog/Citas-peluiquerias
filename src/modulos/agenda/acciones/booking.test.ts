import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewPublicBooking } from "../datos/public-booking";

// The action runs on the server; the profile and book_appointment are
// stand-ins, so the test sees exactly what would be sent to the database.
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

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const SERVICE = "11111111-1111-4111-8111-111111111111";
const BARBER = "33333333-3333-4333-8333-333333333333";

const loadPublicProfile = vi.fn(async (slug: string) =>
  slug === "la-esquina" ? { id: SHOP, slug: "la-esquina" } : null,
);
type Result =
  | { ok: true; appointmentId: string; barberId: string }
  | { ok: false; error: { code?: string; hint?: string | null } };
const createPublicBooking = vi.fn(
  async (booking: NewPublicBooking): Promise<Result> => ({
    ok: true,
    appointmentId: "eeeeeeee-0000-4000-8000-000000000000",
    barberId: booking.barberId ?? BARBER,
  }),
);
vi.mock("../datos/public-booking", () => ({
  loadPublicProfile,
  createPublicBooking,
}));

// A token easy to look for; the hash is the real one.
let tokens = 0;
vi.mock("@/lib/tokens/link-token", async () => {
  const { createHash } = await import("node:crypto");
  return {
    newLinkToken: () => `token-en-claro-${++tokens}`,
    hashLinkToken: (token: string) =>
      createHash("sha256").update(token, "utf8").digest("hex"),
  };
});

const { bookAppointment } = await import("./booking");

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(name, item);
    }
  }
  return data;
}

const VALID = {
  slug: "la-esquina",
  servicios: SERVICE,
  barbero: BARBER,
  dia: "2026-11-24",
  hora: "10:30",
  name: "  Camila Rojas ",
  email: " Camila@Correo.COM ",
  phone: "300 123 4567",
};

async function run(data: FormData) {
  try {
    return await bookAppointment({ status: "idle" }, data);
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bookAppointment", () => {
  it("books with the details normalized and only the hash of the token", async () => {
    const result = await run(form(VALID));
    expect(createPublicBooking).toHaveBeenCalledTimes(1);
    const sent = createPublicBooking.mock.calls[0]![0];
    expect(sent).toMatchObject({
      barbershopId: SHOP,
      barberId: BARBER,
      serviceIds: [SERVICE],
      name: "Camila Rojas",
      email: "camila@correo.com",
      phone: "+573001234567",
    });
    expect(sent.startsAt.toISOString()).toBe("2026-11-24T15:30:00.000Z");
    expect(sent.manageTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(sent)).not.toContain("token-en-claro");
    expect(result).toEqual({
      redirectedTo: `/la-esquina/reservar/confirmada?servicios=${SERVICE}&barbero=${BARBER}&dia=2026-11-24&hora=10%3A30`,
    });
  });

  it("a new token on every booking", async () => {
    await run(form(VALID));
    await run(form(VALID));
    const [first, second] = createPublicBooking.mock.calls.map(
      ([booking]) => booking.manageTokenHash,
    );
    expect(first).not.toBe(second);
  });

  it("sends no barber for el primero disponible and says who was assigned", async () => {
    const result = await run(form({ ...VALID, barbero: "primero", phone: "" }));
    expect(createPublicBooking.mock.calls[0]![0]).toMatchObject({
      barberId: null,
      phone: null,
    });
    expect(result).toEqual({
      redirectedTo: `/la-esquina/reservar/confirmada?servicios=${SERVICE}&barbero=${BARBER}&dia=2026-11-24&hora=10%3A30&asignado=1`,
    });
  });

  it("refuses invalid details before calling the database", async () => {
    const result = await run(
      form({ ...VALID, name: " ", email: "no", phone: "123" }),
    );
    expect(createPublicBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: {
        name: "name_required",
        email: "email_invalid",
        phone: "phone_invalid",
      },
    });
  });

  it("goes back to the times of the day when the slot is gone (C-07)", async () => {
    createPublicBooking.mockResolvedValueOnce({
      ok: false,
      error: { code: "P0001", hint: "slot_taken" },
    });
    expect(await run(form(VALID))).toEqual({
      redirectedTo: `/la-esquina/reservar?servicios=${SERVICE}&barbero=${BARBER}&dia=2026-11-24&paso=hora&tomada=10%3A30`,
    });
  });

  it("shows the barbershop when it no longer takes bookings (C-17)", async () => {
    createPublicBooking.mockResolvedValueOnce({
      ok: false,
      error: { hint: "not_accepting" },
    });
    expect(await run(form(VALID))).toEqual({ redirectedTo: "/la-esquina" });
  });

  it("asks to choose again when a service changed, and keeps the details", async () => {
    createPublicBooking.mockResolvedValueOnce({
      ok: false,
      error: { hint: "service_inactive" },
    });
    expect(await run(form(VALID))).toMatchObject({
      status: "failed",
      error: "services_changed",
      values: { name: "  Camila Rojas " },
    });
  });

  it("fails without a known barbershop or with an incomplete selection", async () => {
    expect(await run(form({ ...VALID, slug: "otra" }))).toMatchObject({
      status: "failed",
      error: "unknown",
    });
    expect(await run(form({ ...VALID, hora: "10:05" }))).toMatchObject({
      status: "failed",
      error: "unknown",
    });
    expect(createPublicBooking).not.toHaveBeenCalled();
  });

  it("reports anything else as unknown", async () => {
    createPublicBooking.mockResolvedValueOnce({ ok: false, error: {} });
    expect(await run(form(VALID))).toMatchObject({
      status: "failed",
      error: "unknown",
    });
  });
});
