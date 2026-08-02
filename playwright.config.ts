import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.E2E_BASE_URL?.trim();
const localBaseURL = "http://127.0.0.1:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/playwright",
  reporter: process.env.CI
    ? [
        ["line"],
        ["json", { outputFile: "release-evidence/playwright-report.json" }],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : [["list"]],
  use: {
    baseURL: externalBaseURL || localBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1",
        url: localBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://e2e.invalid",
          VITE_SUPABASE_PUBLISHABLE_KEY:
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e2e_placeholder",
          SUPABASE_URL: process.env.SUPABASE_URL || "https://e2e.invalid",
          SUPABASE_PUBLISHABLE_KEY:
            process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e2e_placeholder",
        },
      },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
