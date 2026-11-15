import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// src/ui/shop-map.tsx serves MapLibre's worker from public/maplibre (decision
// 0009): after updating maplibre-gl, copy it again from node_modules.
describe("MapLibre's worker", () => {
  it("is the one of the installed maplibre-gl", () => {
    const read = (...path: string[]) =>
      readFileSync(join(process.cwd(), ...path), "utf8");
    expect(read("public", "maplibre", "maplibre-gl-worker.mjs")).toBe(
      read("node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs"),
    );
  });
});
