import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "@/modulos/barberias/dominio/slug";
import { routes } from "./routes";

// Top-level URL segments of src/app, looking through route groups "(x)".
function topLevelSegments(dir: string): string[] {
  return (
    readdirSync(dir, { withFileTypes: true })
      // "_x" folders are private; "%5Fx" ones serve /_x, which no link can take
      // (slugs start with a letter or digit).
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith("_") &&
          !entry.name.startsWith("%5F"),
      )
      .flatMap((entry) =>
        entry.name.startsWith("(")
          ? topLevelSegments(join(dir, entry.name))
          : [entry.name],
      )
  );
}

const reserved: readonly string[] = RESERVED_SLUGS;

describe("routes", () => {
  it("reserves every top-level folder of the app as a barbershop link", () => {
    const segments = topLevelSegments(join(process.cwd(), "src", "app"));
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(reserved, `src/app/${segment}`).toContain(segment);
    }
  });

  it("reserves the first segment of every named route", () => {
    for (const path of Object.values(routes)) {
      const first = path.split("/")[1];
      if (first) expect(reserved, path).toContain(first);
    }
  });
});
