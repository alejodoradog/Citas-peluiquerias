import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Policies } from "../dominio/policies";

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
vi.mock("../datos/setup", () => ({ barbershopNeedsSetup }));

const getPolicies = vi.fn<(shop: string) => Promise<Policies>>(async () => ({
  minBookingNoticeMinutes: 60,
  cancellationNoticeHours: 2,
}));
const updatePolicies = vi.fn<
  (shop: string, policies: Policies) => Promise<boolean>
>(async () => true);
vi.mock("../datos/policies", () => ({ getPolicies, updatePolicies }));

const { savePolicies } = await import("./policies");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function run(data: FormData) {
  try {
    return await savePolicies({ status: "idle" }, data);
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("savePolicies", () => {
  it("saves both policies in the owner's barbershop and goes back to Más", async () => {
    const result = await run(
      form({ minBookingNotice: "180", cancellationNotice: "24" }),
    );
    expect(updatePolicies).toHaveBeenCalledWith(SHOP, {
      minBookingNoticeMinutes: 180,
      cancellationNoticeHours: 24,
    });
    expect(result).toEqual({ redirectedTo: "/panel/mas" });
    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["/panel/mas", "/panel/reservas"]),
    );
  });

  it("ignores any barbershop the browser sends", async () => {
    await run(
      form({
        minBookingNotice: "60",
        cancellationNotice: "2",
        barbershopId: OTHER_SHOP,
      }),
    );
    expect(getPolicies).toHaveBeenCalledWith(SHOP);
    expect(updatePolicies).toHaveBeenCalledWith(SHOP, expect.any(Object));
  });

  it("keeps a saved value that is not one of the options", async () => {
    getPolicies.mockResolvedValueOnce({
      minBookingNoticeMinutes: 90,
      cancellationNoticeHours: 5,
    });
    await run(form({ minBookingNotice: "90", cancellationNotice: "5" }));
    expect(updatePolicies).toHaveBeenCalledWith(SHOP, {
      minBookingNoticeMinutes: 90,
      cancellationNoticeHours: 5,
    });
  });

  it("refuses values the screen does not offer, by field", async () => {
    expect(
      await run(form({ minBookingNotice: "10080", cancellationNotice: "-1" })),
    ).toEqual({
      status: "invalid",
      fieldErrors: {
        minBookingNotice: "min_booking_notice_invalid",
        cancellationNotice: "cancellation_notice_invalid",
      },
      values: { minBookingNotice: "10080", cancellationNotice: "-1" },
    });
    expect(updatePolicies).not.toHaveBeenCalled();
  });

  it("says so when the database writes nothing", async () => {
    updatePolicies.mockResolvedValueOnce(false);
    expect(
      await run(form({ minBookingNotice: "60", cancellationNotice: "2" })),
    ).toEqual({
      status: "failed",
      error: "unknown",
      values: { minBookingNotice: "60", cancellationNotice: "2" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sends an owner without the setup back to the wizard", async () => {
    barbershopNeedsSetup.mockResolvedValueOnce(true);
    expect(
      await run(form({ minBookingNotice: "60", cancellationNotice: "2" })),
    ).toEqual({ redirectedTo: "/panel/configurar" });
    expect(updatePolicies).not.toHaveBeenCalled();
  });
});
