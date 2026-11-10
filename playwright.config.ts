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
  // One worker on the laptop (7.8 GB of RAM); two in CI.
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    // Every flow, on an Android phone.
    {
      name: "android",
      use: devices["Pixel 7"],
      testIgnore: /fidelidad\.spec\.ts/,
    },
    // Screens tagged @ui on an iPhone (WebKit). The account flows stay on
    // Android: running them twice would hit the Auth rate limits.
    {
      name: "iphone",
      use: devices["iPhone 13"],
      grep: /@ui/,
      testIgnore: /fidelidad\.spec\.ts/,
    },
    // Side by side with the design, at the 390 × 844 of its artboards.
    {
      name: "diseno",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
      testMatch: /fidelidad\.spec\.ts/,
    },
  ],
  webServer: {
    command: "next dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
