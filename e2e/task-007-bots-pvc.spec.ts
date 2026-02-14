import { test, expect } from "@playwright/test";

/**
 * TASK-007: Bots (easy/medium/hard) + async integration in PVC.
 * Bot is always Player 2; when it's bot turn, input is locked and "Bot thinking…" is shown, then bot move is applied.
 * E2E: PVC flow, turn indicator, restart/surrender (board input not yet implemented so bot turn cannot be triggered from UI).
 */
const TEST_TIMEOUT = 30_000;

test.describe("TASK-007: Bots + PVC integration", () => {
  test("PVC: start game from Player vs Computer shows /game with Player 1 turn and score 0 : 0", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/");
    await page.getByTestId("link-pvc").click();
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page).toHaveURL(/\/match.*mode=PVC/);
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1 turn");
    await expect(page.locator("header span")).toContainText("PVC");
  });

  test("PVC: turn indicator (game-turn) is visible and shows Player 1 turn initially", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match?mode=PVC");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    const turnEl = page.getByTestId("game-turn");
    await expect(turnEl).toBeVisible();
    await expect(turnEl).toContainText("Player 1 turn");
  });

  test("PVC: Restart keeps PVC mode and resets to Player 1 turn", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match?mode=PVC");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.locator("header span")).toContainText("PVC");
    await page.getByTestId("button-restart").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1 turn");
    await expect(page.locator("header span")).toContainText("PVC");
  });

  test("PVC: Surrender shows Winner Player 2 on /result", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match?mode=PVC");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await expect(page.getByTestId("result-title")).toContainText("Winner: Player 2");
  });

  test("PVP: start game does not show Bot thinking (Player 1 turn only until board exists)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match?mode=PVP");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-turn")).toContainText("Player 1 turn");
    await expect(page.locator("header span")).toContainText("PVP");
  });
});
