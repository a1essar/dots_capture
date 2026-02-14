import { test, expect } from "@playwright/test";

test("app loads and start screen is visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("screen-start")).toBeVisible();
});

test("navigation to all routes works", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("link-pvp").click();
  await expect(page.getByTestId("screen-match")).toBeVisible();

  await page.getByTestId("link-start-game").click();
  await expect(page.getByTestId("screen-game")).toBeVisible();

  await page.getByTestId("button-surrender").click();
  await expect(page.getByTestId("screen-result")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByTestId("screen-settings")).toBeVisible();

  await page.getByTestId("link-back").click();
  await expect(page.getByTestId("screen-start")).toBeVisible();
});
