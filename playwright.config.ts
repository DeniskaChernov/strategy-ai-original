import { defineConfig } from "@playwright/test";

/** Smoke E2E — запуск: npx playwright test (требует dev-сервер или BASE_URL). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000",
    headless: true,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm start",
        port: 4000,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
