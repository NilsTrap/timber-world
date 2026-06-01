import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Portal E2E Tests
 *
 * Run with: npx playwright test
 * Run specific test: npx playwright test epic6
 * Run with UI: npx playwright test --ui
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Headless in CI (the runner has no display server, so a headed browser
    // cannot launch); headed locally for debugging.
    headless: !!process.env.CI,
    // Slow down actions for better visibility
    // launchOptions: { slowMo: 500 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Run local dev server before starting tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
