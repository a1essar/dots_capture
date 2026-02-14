import { test, expect } from "@playwright/test";

/**
 * TASK-021: Fix error in browser console at /game screen (PixiBoardView).
 * E2E verifies: no console error when reaching /game; game screen and canvas mount without throwing.
 */
const TEST_TIMEOUT = 30_000;

async function goToGame(page: import("@playwright/test").Page) {
  await page.goto("/match");
  await expect(page.getByTestId("screen-match")).toBeVisible({ timeout: 10_000 });
  const startBtn = page.getByTestId("link-start-game");
  await startBtn.waitFor({ state: "visible", timeout: 5000 });
  await expect(startBtn).toBeEnabled({ timeout: 5000 });
  await startBtn.click();
  await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 20_000 });
}

test.describe("TASK-021: No console error at /game (PixiBoardView)", () => {
  test("No console error when reaching game screen and PixiBoardView mounts", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error") {
        const text = msg.text();
        consoleErrors.push(text);
      }
    });

    await goToGame(page);

    const pixiErrors = consoleErrors.filter(
      (t) =>
        t.includes("PixiBoardView") ||
        t.includes("above error occurred") ||
        t.includes("Error boundary")
    );
    expect(
      pixiErrors,
      `Expected no PixiBoardView/React error in console. Got: ${consoleErrors.join("; ") || "none"}`
    ).toHaveLength(0);
  });

  test("Game screen and canvas container visible without crash", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await goToGame(page);
    await expect(page.getByTestId("screen-game")).toBeVisible();
    const container = page.getByTestId("canvas-container");
    await expect(container).toBeVisible();
    await expect(container.locator("canvas")).toBeVisible();
  });
});
