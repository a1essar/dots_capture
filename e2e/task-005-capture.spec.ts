import { test, expect } from "@playwright/test";

/**
 * TASK-005: Capture algorithm (flood-fill + territory + scoring).
 * Core capture is unit-tested in core/capture/capture.test.ts.
 * E2E verifies that game screen displays score and turn from state (applyMove
 * includes computeCapturesAfterMove; score updates on capture). No board UI yet,
 * so we assert initial score/turn and reset flows.
 */
const TEST_TIMEOUT = 30_000;

test.describe("TASK-005: Capture — score and turn from state", () => {
  test("Game screen shows initial score 0 : 0 and Player 1 turn", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });

  test("Score display reflects GameState (capture updates score in applyMove)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    const score = page.getByTestId("game-score");
    await expect(score).toBeVisible();
    await expect(score).toContainText("0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
  });

  test("Restart resets score to 0 : 0 and turn to Player 1", async ({
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

  test("Surrender then Rematch shows game with score 0 : 0", async ({
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
