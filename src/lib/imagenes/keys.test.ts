import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extensionFor,
  isOwnImageKey,
  newImageKey,
  publicImageUrl,
} from "./keys";

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000000";
const PHOTO = "11111111-1111-4111-8111-111111111111";

describe("newImageKey", () => {
  it("puts a random name in the barbershop's folder of that kind", () => {
    const key = newImageKey(SHOP, "barbers", "webp");
    expect(key).toMatch(
      /^aaaaaaaa-0000-4000-8000-000000000000\/barbers\/[0-9a-f-]{36}\.webp$/,
    );
    expect(isOwnImageKey(key, SHOP, "barbers")).toBe(true);
  });

  it("never repeats a key", () => {
    expect(newImageKey(SHOP, "logo", "jpg")).not.toBe(
      newImageKey(SHOP, "logo", "jpg"),
    );
  });

  it("writes the barbershop in lowercase, as the database compares it", () => {
    expect(newImageKey(SHOP.toUpperCase(), "cover", "jpg")).toMatch(
      new RegExp(`^${SHOP}/cover/`),
    );
  });
});

describe("isOwnImageKey", () => {
  it("accepts a WebP or JPEG key of the barbershop and kind", () => {
    expect(
      isOwnImageKey(`${SHOP}/barbers/${PHOTO}.webp`, SHOP, "barbers"),
    ).toBe(true);
    expect(isOwnImageKey(`${SHOP}/barbers/${PHOTO}.jpg`, SHOP, "barbers")).toBe(
      true,
    );
  });

  it.each([
    ["another barbershop", `${OTHER}/barbers/${PHOTO}.webp`],
    ["another kind", `${SHOP}/logo/${PHOTO}.webp`],
    ["a name that can be guessed", `${SHOP}/barbers/foto.webp`],
    ["another format", `${SHOP}/barbers/${PHOTO}.png`],
    ["a subfolder", `${SHOP}/barbers/x/${PHOTO}.webp`],
    ["a path that climbs out", `${SHOP}/barbers/../${PHOTO}.webp`],
    // PHOTO has no letters, so this one does.
    [
      "capital letters",
      `${SHOP}/barbers/ABCDEF12-1111-4111-8111-111111111111.webp`,
    ],
    ["an empty value", ""],
  ])("refuses %s", (_case, path) => {
    expect(isOwnImageKey(path, SHOP, "barbers")).toBe(false);
  });

  it("refuses anything that is not text", () => {
    expect(isOwnImageKey(null, SHOP, "barbers")).toBe(false);
    expect(isOwnImageKey(42, SHOP, "barbers")).toBe(false);
  });
});

describe("extensionFor", () => {
  it("knows the two formats of the bucket", () => {
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/jpeg")).toBe("jpg");
  });

  it("refuses the rest", () => {
    expect(extensionFor("image/png")).toBeNull();
    expect(extensionFor("toString")).toBeNull();
    expect(extensionFor(undefined)).toBeNull();
  });
});

describe("publicImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("points at the public bucket of the configured Supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
    expect(publicImageUrl(`${SHOP}/barbers/${PHOTO}.webp`)).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/images/${SHOP}/barbers/${PHOTO}.webp`,
    );
  });

  it("fails loudly without the variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => publicImageUrl("x")).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
