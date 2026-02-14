import { test, expect } from "@playwright/test";

const ROUTE_TIMEOUT = 30_000;

test.describe("TASK-001: Bootstrap routes", () => {
  test("route / shows start screen", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/");
    await expect(page.getByTestId("screen-start")).toBeVisible();
  });

  test("route /match shows match screen", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/match");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });

  test("route /game without state redirects to /match", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });

  test("route /game with started match shows game screen", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
  });

  test("route /result without finished state redirects to /game or /match", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await page.goto("/result");
    // Full page load to /result loses in-memory state -> redirect to /match. If state were preserved (in-app nav), would redirect to /game.
    await expect(
      page.getByTestId("screen-match").or(page.getByTestId("screen-game"))
    ).toBeVisible();
  });

  test("route /result with finished game shows result screen", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
  });

  test("route /settings shows settings screen", async ({ page }) => {
    test.setTimeout(ROUTE_TIMEOUT);
    await page.goto("/settings");
    await expect(page.getByTestId("screen-settings")).toBeVisible();
  });
});
