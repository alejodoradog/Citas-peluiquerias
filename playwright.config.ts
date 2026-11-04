import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Load the same variables Next.js loads, so the tests reach the local
// Supabase. In CI they come from the job environment.
loadEnvConfig(process.cwd());

// Never point the tests at a real project: they create accounts.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  supabaseUrl &&
  !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl)
) {
  throw new Error(
    `E2E tests only run against a local Supabase, not ${supabaseUrl}`,
  );
}

const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "mobile-chromium", use: devices["Pixel 7"] }],
  webServer: {
    command: "next dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
