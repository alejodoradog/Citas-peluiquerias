import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedShopProfile } from "../datos/shop-profile";
import type { ShopProfile } from "../dominio/profile";

// The action runs on the server; here the session, the database and Storage
// are stand-ins, so the test sees exactly what would be written and deleted.
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
const key = (shop: string, kind: string, n: number) =>
  `${shop}/${kind}/${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}.webp`;
const OLD_LOGO = key(SHOP, "logo", 1);
const NEW_LOGO = key(SHOP, "logo", 2);
const OLD_COVER = key(SHOP, "cover", 3);
const NEW_COVER = key(SHOP, "cover", 4);

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const barbershopNeedsSetup = vi.fn(async () => false);
vi.mock("../datos/setup", () => ({ barbershopNeedsSetup }));

const saved = (): SavedShopProfile => ({
  name: "Barbería La Esquina",
  address: "Cra. 15 # 82-40",
  locality: "Chapinero, Bogotá",
  whatsappPhone: "+573001234567",
  location: null,
  logoPath: OLD_LOGO,
  coverPath: OLD_COVER,
});
const getShopProfile = vi.fn<(shop: string) => Promise<SavedShopProfile>>(
  async () => saved(),
);
const updateShopProfile = vi.fn<
  (
    shop: string,
    profile: ShopProfile,
    images: { logoPath?: string; coverPath?: string },
  ) => Promise<boolean>
>(async () => true);
const clearShopImage = vi.fn<
  (shop: string, kind: "logo" | "cover", path: string) => Promise<boolean>
>(async () => true);
vi.mock("../datos/shop-profile", () => ({
  getShopProfile,
  updateShopProfile,
  clearShopImage,
}));

const imageExists = vi.fn<(path: string) => Promise<boolean>>(async () => true);
const removeImages = vi.fn<(paths: readonly string[]) => Promise<void>>(
  async () => {},
);
vi.mock("../datos/images", () => ({ imageExists, removeImages }));

const { saveShopProfile, removeShopImage } = await import("./shop-profile");

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  const all = {
    name: "Barbería La Esquina",
    address: "Cra. 15 # 82-40",
    locality: "Chapinero, Bogotá",
    whatsappPhone: "300 123 4567",
    location: "",
    logoPath: "",
    coverPath: "",
    ...fields,
  };
  for (const [name, value] of Object.entries(all)) data.set(name, value);
  return data;
}

async function run(data: FormData) {
  try {
    return await saveShopProfile({ status: "idle" }, data);
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveShopProfile", () => {
  it("saves the data of the owner's barbershop and goes back to Más", async () => {
    const result = await run(
      form({
        name: "  La Esquina  ",
        whatsappPhone: "310 555 1234",
        location: "4.667123,-74.054500",
      }),
    );
    expect(updateShopProfile).toHaveBeenCalledWith(
      SHOP,
      {
        name: "La Esquina",
        address: "Cra. 15 # 82-40",
        locality: "Chapinero, Bogotá",
        whatsappPhone: "+573105551234",
        location: { latitude: 4.667123, longitude: -74.0545 },
      },
      {},
    );
    expect(result).toEqual({ redirectedTo: "/panel/mas" });
    // The name shows across the panel (Más, Compartir, the wizard's end).
    expect(revalidatePath).toHaveBeenCalledWith("/panel", "layout");
    const paths = revalidatePath.mock.calls.map((call) => call[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/panel/mas",
        "/panel/compartir",
        "/panel/configurar/listo",
        "/panel/datos",
      ]),
    );
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("ignores any barbershop the browser sends", async () => {
    const data = form();
    data.set("barbershopId", OTHER_SHOP);
    await run(data);
    expect(getShopProfile).toHaveBeenCalledWith(SHOP);
    expect(updateShopProfile).toHaveBeenCalledWith(
      SHOP,
      expect.any(Object),
      {},
    );
  });

  it("sends a barbershop still in its wizard back to it", async () => {
    barbershopNeedsSetup.mockResolvedValueOnce(true);
    expect(await run(form())).toEqual({ redirectedTo: "/panel/configurar" });
    expect(updateShopProfile).not.toHaveBeenCalled();
  });

  it("replaces the logo and the cover, and deletes the old files", async () => {
    await run(form({ logoPath: NEW_LOGO, coverPath: NEW_COVER }));
    expect(imageExists).toHaveBeenCalledWith(NEW_LOGO);
    expect(imageExists).toHaveBeenCalledWith(NEW_COVER);
    expect(updateShopProfile).toHaveBeenCalledWith(SHOP, expect.any(Object), {
      logoPath: NEW_LOGO,
      coverPath: NEW_COVER,
    });
    const deleted = removeImages.mock.calls.flatMap(([paths]) => paths);
    expect(deleted.sort()).toEqual([OLD_COVER, OLD_LOGO].sort());
  });

  it("keeps the saved images when the form sends them back unchanged", async () => {
    await run(form({ logoPath: OLD_LOGO, coverPath: OLD_COVER }));
    expect(imageExists).not.toHaveBeenCalled();
    expect(updateShopProfile).toHaveBeenCalledWith(
      SHOP,
      expect.any(Object),
      {},
    );
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("sets a first logo without deleting anything", async () => {
    getShopProfile.mockResolvedValueOnce({ ...saved(), logoPath: null });
    await run(form({ logoPath: NEW_LOGO }));
    expect(updateShopProfile).toHaveBeenCalledWith(SHOP, expect.any(Object), {
      logoPath: NEW_LOGO,
    });
    expect(removeImages).not.toHaveBeenCalled();
  });

  it.each([
    ["a logo of another barbershop", "logoPath", key(OTHER_SHOP, "logo", 2)],
    ["a barber's photo as the logo", "logoPath", key(SHOP, "barbers", 2)],
    ["the cover as the logo", "logoPath", NEW_COVER],
    ["the logo as the cover", "coverPath", NEW_LOGO],
    ["a cover of another barbershop", "coverPath", key(OTHER_SHOP, "cover", 4)],
    ["a path that climbs out", "logoPath", `${SHOP}/logo/../x.webp`],
    ["a very long text", "coverPath", "x".repeat(10_000)],
  ])("refuses %s and deletes nothing", async (_case, field, path) => {
    const result = await run(form({ [field]: path }));
    expect(result).toMatchObject({
      status: "failed",
      error: "image_invalid",
      values: { [field]: "" },
    });
    expect(updateShopProfile).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
    expect(imageExists).not.toHaveBeenCalledWith(path);
  });

  it("refuses an upload that never reached Storage", async () => {
    imageExists.mockResolvedValueOnce(false);
    const result = await run(form({ logoPath: NEW_LOGO }));
    expect(result).toMatchObject({
      status: "failed",
      error: "image_invalid",
      values: { logoPath: "" },
    });
    expect(updateShopProfile).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("keeps a good upload when the other image is refused", async () => {
    const result = await run(
      form({ logoPath: NEW_LOGO, coverPath: key(OTHER_SHOP, "cover", 4) }),
    );
    expect(result).toMatchObject({
      status: "failed",
      error: "image_invalid",
      values: { logoPath: NEW_LOGO, coverPath: "" },
    });
  });

  it("returns field errors and keeps the uploads for the next try", async () => {
    const result = await run(
      form({ name: "", whatsappPhone: "601 234", logoPath: NEW_LOGO }),
    );
    expect(result).toEqual({
      status: "invalid",
      fieldErrors: {
        name: "barbershop_name_required",
        whatsappPhone: "phone_invalid",
      },
      values: expect.objectContaining({
        name: "",
        whatsappPhone: "601 234",
        logoPath: NEW_LOGO,
        coverPath: "",
      }),
    });
    expect(updateShopProfile).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("does not echo back texts longer than the screen can send", async () => {
    const result = await run(form({ address: "x".repeat(5_000) }));
    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: { address: "address_too_long" },
      values: { address: "" },
    });
  });

  it("deletes the new uploads when the database writes nothing", async () => {
    updateShopProfile.mockResolvedValueOnce(false);
    const result = await run(
      form({ logoPath: NEW_LOGO, coverPath: NEW_COVER }),
    );
    expect(result).toMatchObject({
      status: "failed",
      error: "unknown",
      values: { logoPath: "", coverPath: "" },
    });
    const deleted = removeImages.mock.calls.flatMap(([paths]) => paths);
    expect(deleted.sort()).toEqual([NEW_COVER, NEW_LOGO].sort());
    expect(deleted).not.toContain(OLD_LOGO);
  });
});

describe("removeShopImage", () => {
  it("empties the logo and then deletes its file", async () => {
    expect(await removeShopImage("logo")).toEqual({ ok: true });
    expect(clearShopImage).toHaveBeenCalledWith(SHOP, "logo", OLD_LOGO);
    expect(removeImages).toHaveBeenCalledWith([OLD_LOGO]);
    expect(revalidatePath).toHaveBeenCalledWith("/panel", "layout");
  });

  it("empties the cover and then deletes its file", async () => {
    expect(await removeShopImage("cover")).toEqual({ ok: true });
    expect(clearShopImage).toHaveBeenCalledWith(SHOP, "cover", OLD_COVER);
    expect(removeImages).toHaveBeenCalledWith([OLD_COVER]);
  });

  it("deletes nothing when the row moved on meanwhile", async () => {
    clearShopImage.mockResolvedValueOnce(false);
    expect(await removeShopImage("logo")).toEqual({ ok: false });
    expect(removeImages).not.toHaveBeenCalled();
  });

  it("is done when there is nothing to remove", async () => {
    getShopProfile.mockResolvedValueOnce({ ...saved(), coverPath: null });
    expect(await removeShopImage("cover")).toEqual({ ok: true });
    expect(clearShopImage).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
  });

  it.each(["barbers", "avatars", "", "logo_path"])(
    "refuses the kind %s",
    async (kind) => {
      expect(await removeShopImage(kind as never)).toEqual({ ok: false });
      expect(clearShopImage).not.toHaveBeenCalled();
      expect(removeImages).not.toHaveBeenCalled();
    },
  );
});
