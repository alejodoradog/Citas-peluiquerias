import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // "*.dev.tsx" pages exist only in development and tests, never in a
  // production build (the component catalog at /_catalogo).
  pageExtensions:
    process.env.NODE_ENV === "production"
      ? ["tsx", "ts"]
      : ["tsx", "ts", "dev.tsx"],
  // A barber's private agenda (/b/<token>, task 4.4): the token is the whole
  // credential. No Referer carries it to another site, no cache keeps the
  // page and no search engine lists it.
  async headers() {
    return [
      {
        source: "/b/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
