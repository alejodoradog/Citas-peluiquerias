import { describe, expect, it } from "vitest";
import {
  PHOTO_FORMATS,
  acceptedFormat,
  fitWithin,
  isImageFile,
} from "./compress";

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
