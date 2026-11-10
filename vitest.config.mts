import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    // Logic runs in Node; components render in a DOM (jsdom).
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/ui/pruebas/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/modulos/*/dominio/**/*.ts", "src/ui/**/*.tsx"],
      exclude: ["**/*.test.*", "src/ui/pruebas/**"],
      thresholds: {
        "src/modulos/*/dominio/**": {
          lines: 90,
          branches: 90,
          functions: 90,
          statements: 90,
        },
        "src/ui/**": { lines: 80 },
      },
    },
  },
});
