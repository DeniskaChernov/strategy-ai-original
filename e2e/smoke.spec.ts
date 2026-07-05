import { test, expect } from "@playwright/test";

test.describe("Strategy AI smoke", () => {
  test("landing loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
  });

  test("app shell route loads", async ({ page }) => {
    await page.goto("/app");
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.locator('link[href*="strategy-shell.css"]')).toHaveCount(1);
  });

  test("health API", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBeDefined();
  });
});
