import { test, expect } from "@playwright/test";

/**
 * TASK-006: Game lifecycle — restart, surrender, finish, winner/draw, route guards.
 * Covers: surrender => finish with opponent winner; /result shows correct winner and score;
 * restart => same settings; back to menu clears state; rematch => new game same settings;
 * route guard for /result (finished only).
 */
const TEST_TIMEOUT = 30_000;

test.describe("TASK-006: Game lifecycle — restart, surrender, finish, winner/draw", () => {
  test("Surrender as Player 1 shows Winner: Player 2 and final score on /result", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await expect(page.getByTestId("result-title")).toContainText("Winner: Player 2");
    await expect(page.getByTestId("result-score")).toContainText("0 : 0");
  });

  test("/result route guard: in-app navigate to /result while game in progress redirects to /game", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await page.evaluate(() => {
      window.history.pushState({}, "", "/result");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page).toHaveURL(/\/game/);
  });

  test("/result route guard: direct /result with no state redirects to /match", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/result");
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page).toHaveURL(/\/match/);
  });

  test("Restart keeps same settings (score and turn reset, still on /game)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    const titleBefore = await page.locator("header span").textContent();
    await page.getByTestId("button-restart").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
    const titleAfter = await page.locator("header span").textContent();
    expect(titleAfter).toBe(titleBefore);
  });

  test("Rematch creates new game with same settings and navigates to /game", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await expect(page.getByTestId("result-title")).toContainText("Winner: Player 2");
    await page.getByTestId("link-rematch").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });

  test("Back to Menu from /result clears game state; /game then redirects to /match", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await page.getByTestId("link-back-menu").click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });
});
