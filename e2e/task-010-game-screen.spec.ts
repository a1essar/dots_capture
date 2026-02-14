import { test, expect } from "@playwright/test";

/**
 * TASK-010: UI Game screen + controller integration.
 * E2E verifies: top bar, status panel (score, turn), canvas container with Pixi,
 * Surrender/Restart buttons; stable data-testids. Console errors collected and allowlisted.
 */
const TEST_TIMEOUT = 30_000;

const CONSOLE_ALLOWLIST: (string | RegExp)[] = [
  "favicon",
  "404",
  "Failed to load resource",
  /^Could not load (favicon|resource)/i,
];

function attachConsoleCollector(
  page: { on: (event: string, handler: (arg: unknown) => void) => void },
  collected: { errors: string[] }
) {
  page.on("console", (msg) => {
    if (msg.type() === "error") collected.errors.push(msg.text());
  });
  page.on("pageerror", (e) =>
    collected.errors.push(`pageerror: ${e.message}`)
  );
}

function isAllowlisted(text: string): boolean {
  return CONSOLE_ALLOWLIST.some((allow) =>
    typeof allow === "string" ? text.includes(allow) : allow.test(text)
  );
}

async function goToGame(page: import("@playwright/test").Page) {
  await page.goto("/match");
  await expect(page.getByTestId("screen-match")).toBeVisible({ timeout: 10_000 });
  const startBtn = page.getByTestId("link-start-game");
  await startBtn.waitFor({ state: "visible", timeout: 5000 });
  await expect(startBtn).toBeEnabled({ timeout: 5000 });
  await startBtn.click();
  await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 20_000 });
}

test.describe("TASK-010: Game screen layout + controller integration", () => {
  test("Game screen has top bar, status panel, canvas container, action bar", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("link-back-menu")).toContainText("Back to Menu");
    await expect(page.getByTestId("game-score")).toBeVisible();
    await expect(page.getByTestId("game-turn")).toBeVisible();
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    await expect(page.getByTestId("button-surrender")).toBeVisible();
    await expect(page.getByTestId("button-restart")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Canvas container has Pixi canvas element", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    const container = page.getByTestId("canvas-container");
    await expect(container).toBeVisible();
    const canvas = container.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Score shows initial 0 : 0 and turn shows Player 1", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await expect(page.getByTestId("game-score")).toContainText("0");
    await expect(page.getByTestId("game-score")).toContainText(":");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
    await expect(page.getByTestId("game-turn")).toContainText("turn");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Surrender button navigates to result screen", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await page.getByTestId("button-surrender").click();
    await expect(page).toHaveURL(/\/result/);
    await expect(page.getByTestId("screen-result")).toBeVisible({ timeout: 10_000 });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Restart button resets score and keeps on game screen", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await expect(page.getByTestId("game-score")).toContainText("0");
    await page.getByTestId("button-restart").click();
    await expect(page).toHaveURL(/\/game/);
    await expect(page.getByTestId("screen-game")).toBeVisible();
    await expect(page.getByTestId("game-score")).toContainText("0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("PVC: game screen shows turn indicator (Player 1 or Bot thinking)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match?mode=PVC");
    await expect(page.getByTestId("link-start-game")).toBeEnabled({ timeout: 5000 });
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 20_000 });
    const turnEl = page.getByTestId("game-turn");
    await expect(turnEl).toBeVisible();
    await expect(turnEl).toContainText(/Player 1|Bot thinking/i);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
