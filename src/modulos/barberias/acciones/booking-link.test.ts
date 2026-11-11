import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingLinkWriteResult } from "../datos/booking-link";

// The actions run on the server; here the session and the database are
// stand-ins, so the test sees exactly what would be looked up and written.
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

const requireOwner = vi.fn(async () => ({
  barbershop: { id: SHOP, slug: "la-esquina" },
}));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const barbershopNeedsSetup = vi.fn(async () => false);
vi.mock("../datos/setup", () => ({ barbershopNeedsSetup }));

const isSlugAvailable = vi.fn<(slug: string, shop: string) => Promise<boolean>>(
  async () => true,
);
vi.mock("../datos/slugs", () => ({ isSlugAvailable }));

const updateBookingLink = vi.fn<
  (shop: string, slug: string) => Promise<BookingLinkWriteResult>
>(async () => "changed");
vi.mock("../datos/booking-link", () => ({ updateBookingLink }));

const { changeBookingLink, checkBookingLink } = await import("./booking-link");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function run(data: FormData) {
  try {
    return await changeBookingLink({ status: "idle" }, data);
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkBookingLink", () => {
  it("says a free link is available, as it will be saved", async () => {
    expect(await checkBookingLink("  La Esquina Norte ")).toEqual({
      status: "available",
      slug: "la-esquina-norte",
    });
    expect(isSlugAvailable).toHaveBeenCalledWith("la-esquina-norte", SHOP);
  });

  it("says when another barbershop uses it or left it", async () => {
    isSlugAvailable.mockResolvedValueOnce(false);
    expect(await checkBookingLink("el-parche")).toEqual({
      status: "taken",
      slug: "el-parche",
    });
  });

  it("refuses what is not a link without looking it up", async () => {
    expect(await checkBookingLink("jl")).toEqual({
      status: "refused",
      error: "slug_invalid",
    });
    expect(await checkBookingLink("panel")).toEqual({
      status: "refused",
      error: "slug_reserved",
    });
    expect(await checkBookingLink("la-esquina")).toEqual({
      status: "refused",
      error: "slug_same",
    });
    expect(await checkBookingLink("a".repeat(5_000))).toEqual({
      status: "refused",
      error: "slug_invalid",
    });
    expect(await checkBookingLink({ slug: "otra" })).toEqual({
      status: "refused",
      error: "slug_invalid",
    });
    expect(isSlugAvailable).not.toHaveBeenCalled();
  });
});

describe("changeBookingLink", () => {
  it("changes the link of the owner's barbershop and says so on D-61", async () => {
    const result = await run(form({ slug: "La Esquina Norte" }));
    expect(updateBookingLink).toHaveBeenCalledWith(SHOP, "la-esquina-norte");
    expect(result).toEqual({ redirectedTo: "/panel/link?guardado=1" });
    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/panel",
        "/panel/mas",
        "/panel/compartir",
        "/panel/configurar/listo",
        "/panel/link",
        "/la-esquina",
        "/la-esquina-norte",
      ]),
    );
  });

  it("ignores any barbershop the browser sends", async () => {
    await run(
      form({ slug: "nueva", barbershopId: OTHER_SHOP, id: OTHER_SHOP }),
    );
    expect(updateBookingLink).toHaveBeenCalledWith(SHOP, "nueva");
  });

  it("sends an owner who has not finished the wizard back to it", async () => {
    barbershopNeedsSetup.mockResolvedValueOnce(true);
    expect(await run(form({ slug: "nueva" }))).toEqual({
      redirectedTo: "/panel/configurar",
    });
    expect(updateBookingLink).not.toHaveBeenCalled();
  });

  it.each([
    ["jl", "slug_invalid"],
    ["registro", "slug_reserved"],
    ["la-esquina", "slug_same"],
  ])("refuses %s with %s and writes nothing", async (slug, code) => {
    expect(await run(form({ slug }))).toEqual({
      status: "invalid",
      fieldErrors: { slug: code },
      values: { slug },
    });
    expect(updateBookingLink).not.toHaveBeenCalled();
  });

  it("does not echo back a link longer than one could be", async () => {
    expect(await run(form({ slug: "a".repeat(5_000) }))).toEqual({
      status: "invalid",
      fieldErrors: { slug: "slug_invalid" },
      values: { slug: "" },
    });
  });

  it("says under the field when the database finds the link taken", async () => {
    updateBookingLink.mockResolvedValueOnce("slug_taken");
    expect(await run(form({ slug: "el-parche" }))).toEqual({
      status: "invalid",
      fieldErrors: { slug: "slug_taken" },
      values: { slug: "el-parche" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["slug_change_limit", "unknown"] as const)(
    "says %s for the whole form",
    async (error) => {
      updateBookingLink.mockResolvedValueOnce(error);
      expect(await run(form({ slug: "el-parche" }))).toEqual({
        status: "failed",
        error,
        values: { slug: "el-parche" },
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );
});
