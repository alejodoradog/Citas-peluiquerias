import { describe, expect, it, vi } from "vitest";

// The module guards itself against client bundles; tests run in Node.
vi.mock("server-only", () => ({}));

const { hashLinkToken, newLinkToken, newLinkTokenHash } =
  await import("./link-token");

describe("link tokens", () => {
  it("are 32 random bytes, written for a URL", () => {
    const token = newLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(newLinkToken()).not.toBe(token);
  });

  it("are stored as the SHA-256 hex the database accepts", () => {
    expect(hashLinkToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(newLinkTokenHash()).toMatch(/^[0-9a-f]{64}$/);
    expect(newLinkTokenHash()).not.toBe(newLinkTokenHash());
  });
});
