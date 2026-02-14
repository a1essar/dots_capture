import { test, expect } from "@playwright/test";

const TEST_TIMEOUT = 30_000;

test.describe("TASK-002: App state + routing guards + UI settings persistence", () => {
  test("entering /game without valid state redirects to /match", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page).toHaveURL(/\/(match)?$/);
  });

  test("entering /result with no state redirects to /match", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/result");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });

  test("entering /result with playing state (in-app) redirects to /game", async ({
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
  });

  test("Start Game creates GameState and navigates to /game", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0");
    await expect(page.getByTestId("game-turn")).toBeVisible();
  });

  test("Surrender sets finished state and navigates to /result", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await expect(page.getByTestId("result-title")).toContainText("Winner");
    await expect(page.getByTestId("result-score")).toBeVisible();
  });

  test("Rematch creates new game and navigates to /game", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await page.getByTestId("link-rematch").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0");
  });

  test("Back to Menu from match clears state; /game then redirects to /match", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-back").click();
    await expect(page.getByTestId("screen-start")).toBeVisible();
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });

  test("Back to Menu from game clears state; /game then redirects to /match", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await page.getByTestId("link-back-menu").click();
    await expect(page.getByTestId("screen-start")).toBeVisible();
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });

  test("Back to Menu from result clears state; /game then redirects to /match", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await page.getByTestId("button-surrender").click();
    await expect(page.getByTestId("screen-result")).toBeVisible();
    await page.getByTestId("link-back-menu").click();
    await expect(page.getByTestId("screen-start")).toBeVisible();
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible();
  });

  test("UI settings persist to localStorage and are restored on load", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/settings");
    const initialText = await page.getByTestId("toggle-animations").textContent();
    await page.getByTestId("toggle-animations").click();
    await expect(page.getByTestId("toggle-animations")).not.toContainText(initialText!);
    await page.reload();
    await expect(page.getByTestId("screen-settings")).toBeVisible();
    await expect(page.getByTestId("toggle-animations")).not.toContainText(initialText!);
  });

  test("UI settings apply live on Settings screen", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await page.goto("/settings");
    const before = await page.getByTestId("toggle-highlight-capture").textContent();
    await page.getByTestId("toggle-highlight-capture").click();
    const after = await page.getByTestId("toggle-highlight-capture").textContent();
    expect(before).not.toBe(after);
    await page
      .getByTestId("slider-point-size")
      .evaluate((el) => {
        (el as HTMLInputElement).value = "0.20";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    await expect(page.getByTestId("slider-point-size")).toHaveValue("0.2");
  });
});
