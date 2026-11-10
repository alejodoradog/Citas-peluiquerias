import { beforeEach, describe, expect, it, vi } from "vitest";

// The action runs on the server; the session and Storage are stand-ins.
vi.mock("server-only", () => ({}));

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";

const requireOwner = vi.fn(async () => ({ barbershop: { id: SHOP } }));
vi.mock("@/modulos/cuentas/guards", () => ({ requireOwner }));

const signImageUpload = vi.fn<(path: string) => Promise<string | null>>(
  async () => "firma",
);
vi.mock("../datos/images", () => ({ signImageUpload }));

const { requestImageUpload } = await import("./images");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestImageUpload", () => {
  it.each([
    ["barbers", "image/webp", "webp"],
    ["logo", "image/webp", "webp"],
    ["cover", "image/jpeg", "jpg"],
  ] as const)(
    "signs a new %s key in the owner's barbershop",
    async (kind, mime, extension) => {
      const ticket = await requestImageUpload(kind, mime);
      expect(ticket).toEqual({
        ok: true,
        path: expect.stringMatching(
          new RegExp(`^${SHOP}/${kind}/[0-9a-f-]{36}\\.${extension}$`),
        ),
        token: "firma",
      });
      expect(signImageUpload).toHaveBeenCalledWith(
        ticket.ok ? ticket.path : "",
      );
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
    });
    expect(signImageUpload).not.toHaveBeenCalled();
  });

  it("says so when Storage gives no URL (quota, policies)", async () => {
    signImageUpload.mockResolvedValueOnce(null);
    expect(await requestImageUpload("logo", "image/webp")).toEqual({
      ok: false,
    });
  });
});
