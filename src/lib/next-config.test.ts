import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// The barber's private agenda (/b/<token>, task 4.4): the token is the whole
// credential, so it never leaks through the Referer, a cache or a search
// engine.
describe("next.config headers", () => {
  it("protects every barber agenda link", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const agenda = rules.find((rule) => rule.source === "/b/:path*");
    expect(agenda?.headers).toEqual(
      expect.arrayContaining([
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Robots-Tag", value: "noindex" },
      ]),
    );
  });
});
