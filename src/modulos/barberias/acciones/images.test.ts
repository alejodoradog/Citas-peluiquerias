import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageReservation } from "../datos/images";

// The action runs on the server; the session and Storage are stand-ins.
vi.mock("server-only", () => ({}));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const OTHER_SHOP = "bbbbbbbb-0000-4000-8000-000000000000";
const LOGO_KEY = `${SHOP}/logo/11111111-1111-4111-8111-111111111111.webp`;

const calls: string[] = [];

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const reserveImageUpload = vi.fn<(path: string) => Promise<ImageReservation>>(
  async () => {
    calls.push("reserve");
    return "reserved";
  },
);
const signImageUpload = vi.fn<(path: string) => Promise<string | null>>(
  async () => {
    calls.push("sign");
    return "firma";
  },
);
const imageInUse = vi.fn<(path: string) => Promise<boolean>>(async () => false);
const removeImages = vi.fn<(paths: readonly string[]) => Promise<void>>(
  async () => {},
);
vi.mock("../datos/images", () => ({
  reserveImageUpload,
  signImageUpload,
  imageInUse,
  removeImages,
}));

const { requestImageUpload, discardImageUpload } = await import("./images");

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

describe("requestImageUpload", () => {
  it.each([
    ["barbers", "image/webp", "webp"],
    ["logo", "image/webp", "webp"],
    ["cover", "image/jpeg", "jpg"],
  ] as const)(
    "reserves, then signs, a new %s key in the owner's barbershop",
    async (kind, mime, extension) => {
      const ticket = await requestImageUpload(kind, mime);
      expect(ticket).toEqual({
        ok: true,
        path: expect.stringMatching(
          new RegExp(`^${SHOP}/${kind}/[0-9a-f-]{36}\\.${extension}$`),
        ),
        token: "firma",
      });
      const path = ticket.ok ? ticket.path : "";
      expect(reserveImageUpload).toHaveBeenCalledExactlyOnceWith(path);
      expect(signImageUpload).toHaveBeenCalledExactlyOnceWith(path);
      // Storage signs no key that was not reserved first.
      expect(calls).toEqual(["reserve", "sign"]);
    },
  );

  it.each([
    ["a kind the bucket does not have", "avatars", "image/webp"],
    ["a kind that names a path", "../logo", "image/webp"],
    ["a prototype key", "toString", "image/webp"],
    ["a format the bucket refuses", "logo", "image/png"],
    ["no format", "cover", ""],
  ])("refuses %s", async (_case, kind, mime) => {
    expect(await requestImageUpload(kind as never, mime)).toEqual({
      ok: false,
      error: "photo_upload_failed",
    });
    expect(reserveImageUpload).not.toHaveBeenCalled();
    expect(signImageUpload).not.toHaveBeenCalled();
  });

  it("says the quota is full and signs nothing", async () => {
    reserveImageUpload.mockResolvedValueOnce("quota");
    expect(await requestImageUpload("barbers", "image/webp")).toEqual({
      ok: false,
      error: "photo_quota",
    });
    expect(signImageUpload).not.toHaveBeenCalled();
  });

  it("signs nothing when the reservation fails otherwise", async () => {
    reserveImageUpload.mockResolvedValueOnce("failed");
    expect(await requestImageUpload("logo", "image/webp")).toEqual({
      ok: false,
      error: "photo_upload_failed",
    });
    expect(signImageUpload).not.toHaveBeenCalled();
  });

  it("says so when Storage gives no URL (policies)", async () => {
    signImageUpload.mockResolvedValueOnce(null);
    expect(await requestImageUpload("logo", "image/webp")).toEqual({
      ok: false,
      error: "photo_upload_failed",
    });
  });
});

describe("discardImageUpload", () => {
  it("deletes an upload of the owner's barbershop that nothing uses", async () => {
    await discardImageUpload("logo", LOGO_KEY);
    expect(imageInUse).toHaveBeenCalledExactlyOnceWith(LOGO_KEY);
    expect(removeImages).toHaveBeenCalledExactlyOnceWith([LOGO_KEY]);
  });

  it("never deletes an image a barber, the logo or the cover uses", async () => {
    imageInUse.mockResolvedValueOnce(true);
    await discardImageUpload("logo", LOGO_KEY);
    expect(removeImages).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a key of another barbershop",
      "logo",
      `${OTHER_SHOP}/logo/11111111-1111-4111-8111-111111111111.webp`,
    ],
    ["a key of another kind", "cover", LOGO_KEY],
    ["a kind the bucket does not have", "avatars", LOGO_KEY],
    ["a path out of the folder", "logo", `${SHOP}/logo/../../${OTHER_SHOP}`],
    ["no key", "logo", ""],
    ["something that is not a key", "logo", 42],
  ])("refuses %s", async (_case, kind, path) => {
    await discardImageUpload(kind as never, path as never);
    expect(imageInUse).not.toHaveBeenCalled();
    expect(removeImages).not.toHaveBeenCalled();
  });
});
