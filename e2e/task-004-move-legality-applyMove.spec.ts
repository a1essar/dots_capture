import { test, expect } from "@playwright/test";

const TEST_TIMEOUT = 30_000;

test.describe("TASK-004: Move legality + applyMove (no capture) — controller integration", () => {
  test("Game screen shows initial state from GameState (Player 1, score 0:0)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });

  test("Restart resets to same settings and initial game state (moveHistory/currentPlayer)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await page.getByTestId("button-restart").click();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });

  test("Score and turn elements reflect GameState used by placePoint controller", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toBeVisible();
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });

  test("Surrender leaves result screen; Rematch returns to game with initial state", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await page.getByTestId("link-rematch").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });
});
