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
  // The private links, where the token is the whole credential: a barber's
  // agenda (/b/<token>, task 4.4), a customer's appointment (/c/<token>,
  // task 3.4) and the confirmation that gives that link (C-08). No Referer
  // carries the token to another site, no cache keeps the page and no
  // search engine lists it.
  async headers() {
    const privateLink = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex" },
    ];
    return [
      { source: "/b/:path*", headers: privateLink },
      { source: "/c/:path*", headers: privateLink },
      { source: "/:slug/reservar/confirmada", headers: privateLink },
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
