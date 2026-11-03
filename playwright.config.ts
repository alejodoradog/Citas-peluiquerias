import { defineConfig, devices } from "@playwright/test";

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
