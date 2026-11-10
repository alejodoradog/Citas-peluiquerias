import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // The packages and any of their subpaths (e.g. @vercel/blob/client).
          patterns: [
            {
              group: [
                "@vercel/kv",
                "@vercel/kv/*",
                "@vercel/blob",
                "@vercel/blob/*",
                "@vercel/postgres",
                "@vercel/postgres/*",
                "@vercel/edge-config",
                "@vercel/edge-config/*",
              ],
              message:
                "Servicio exclusivo de Vercel prohibido (decisión 0007, punto 15): usa Supabase para datos, archivos y configuración.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "src/lib/supabase/database.types.ts",
  ]),
]);

export default eslintConfig;
