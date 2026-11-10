import { describe, expect, it, vi } from "vitest";
import {
  COVER_COMPRESSION,
  PHOTO_FORMATS,
  acceptedFormat,
  fitWithin,
  isImageFile,
  shrinkToFit,
} from "./compress";
import { IMAGE_MAX_BYTES } from "./keys";

describe("fitWithin", () => {
  it("shrinks a landscape photo to 400 px wide", () => {
    expect(fitWithin(4032, 3024, 400)).toEqual({ width: 400, height: 300 });
  });

  it("shrinks a portrait photo to 400 px tall", () => {
    expect(fitWithin(3024, 4032, 400)).toEqual({ width: 300, height: 400 });
  });

  it("keeps a square square", () => {
    expect(fitWithin(1000, 1000, 400)).toEqual({ width: 400, height: 400 });
  });

  it("never blows up a small image", () => {
    expect(fitWithin(120, 80, 400)).toEqual({ width: 120, height: 80 });
  });

  it("keeps at least one pixel on a very thin image", () => {
    expect(fitWithin(8000, 2, 400)).toEqual({ width: 400, height: 1 });
  });

  it("refuses an image without size", () => {
    expect(() => fitWithin(0, 100, 400)).toThrow(RangeError);
    expect(() => fitWithin(Number.NaN, 100, 400)).toThrow(RangeError);
  });
});

describe("acceptedFormat", () => {
  it("takes WebP first and JPEG second", () => {
    expect(PHOTO_FORMATS).toEqual(["image/webp", "image/jpeg"]);
  });

  it("accepts the blob when it came out as asked", () => {
    expect(acceptedFormat("image/webp", "image/webp")).toBe("image/webp");
    expect(acceptedFormat("image/jpeg", "image/jpeg")).toBe("image/jpeg");
  });

  it("moves on when Safari answers WebP with a PNG", () => {
    expect(acceptedFormat("image/webp", "image/png")).toBeNull();
    expect(acceptedFormat("image/webp", undefined)).toBeNull();
  });
});

describe("isImageFile", () => {
  it("accepts any image the browser names", () => {
    expect(isImageFile({ type: "image/png" })).toBe(true);
    expect(isImageFile({ type: "image/heic" })).toBe(true);
  });

  it("refuses what is not an image", () => {
    expect(isImageFile({ type: "application/pdf" })).toBe(false);
    expect(isImageFile({ type: "" })).toBe(false);
  });
});

describe("shrinkToFit", () => {
  const sized = (size: number) => ({ size });

  it("keeps the first encoding that fits", async () => {
    const encode = vi.fn(async (quality: number) => sized(quality * 1000));
    expect(await shrinkToFit([0.8, 0.6, 0.4], 700, encode)).toEqual(sized(600));
    expect(encode.mock.calls.map(([quality]) => quality)).toEqual([0.8, 0.6]);
  });

  it("encodes once when the first one fits", async () => {
    const encode = vi.fn(async () => sized(10));
    await shrinkToFit([0.8, 0.6], 700, encode);
    expect(encode).toHaveBeenCalledOnce();
  });

  it("hands back the last one when none fits, for the caller to refuse", async () => {
    expect(
      await shrinkToFit([0.8, 0.6], 100, async (quality) =>
        sized(quality * 1000),
      ),
    ).toEqual(sized(600));
  });

  it("gives up on a format the browser cannot encode", async () => {
    expect(await shrinkToFit([0.8, 0.6], 100, async () => null)).toBeNull();
  });
});

describe("COVER_COMPRESSION", () => {
  it("draws the cover at 1200 px and aims under 100 KB (decision 0007)", () => {
    expect(COVER_COMPRESSION.maxSide).toBe(1200);
    expect(COVER_COMPRESSION.maxBytes).toBe(100 * 1024);
    expect(COVER_COMPRESSION.maxBytes).toBeLessThan(IMAGE_MAX_BYTES);
  });

  it("tries less quality each time", () => {
    const qualities = COVER_COMPRESSION.qualities;
    expect(qualities.length).toBeGreaterThan(1);
    for (let i = 1; i < qualities.length; i++) {
      expect(qualities[i]).toBeLessThan(qualities[i - 1]!);
    }
  });
});
