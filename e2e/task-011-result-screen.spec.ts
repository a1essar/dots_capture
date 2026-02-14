import { test, expect } from "@playwright/test";

/**
 * TASK-011: UI Result screen.
 * E2E verifies: winner/draw title, final score, Rematch and Back to Menu actions;
 * route guards (result only when GameState.status === "finished"); transitions from finished state.
 * Console errors collected and allowlisted.
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

async function goToResult(page: import("@playwright/test").Page) {
  await goToGame(page);
  await page.getByTestId("button-surrender").click();
  await expect(page.getByTestId("screen-result")).toBeVisible({ timeout: 10_000 });
}

test.describe("TASK-011: Result screen", () => {
  test("Result screen shows winner/draw title, final score, Rematch and Back to Menu", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToResult(page);
    await expect(page.getByTestId("result-title")).toBeVisible();
    await expect(page.getByTestId("result-title")).toContainText(/Winner: Player 2|Draw/);
    await expect(page.getByTestId("result-score")).toBeVisible();
    await expect(page.getByTestId("result-score")).toContainText(/Final score:|: \d+/);
    await expect(page.getByTestId("link-rematch")).toBeVisible();
    await expect(page.getByTestId("link-rematch")).toContainText("Rematch");
    await expect(page.getByTestId("link-back-menu")).toBeVisible();
    await expect(page.getByTestId("link-back-menu")).toContainText("Back to Menu");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Surrender as P1 shows Winner: Player 2 and final score on /result", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToResult(page);
    await expect(page).toHaveURL(/\/result/);
    await expect(page.getByTestId("result-title")).toContainText("Winner: Player 2");
    await expect(page.getByTestId("result-score")).toContainText("0 : 0");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Result route guard: direct /result with no state redirects to /match", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/result");
    await expect(page.getByTestId("screen-match")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/match/);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Result route guard: in-app navigate to /result while game in progress redirects to /game", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await page.evaluate(() => {
      window.history.pushState({}, "", "/result");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/game/);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Rematch navigates to /game with new game and same settings", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToResult(page);
    await page.getByTestId("link-rematch").click();
    await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/game/);
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Back to Menu from result navigates to / and clears game state", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToResult(page);
    await page.getByTestId("link-back-menu").click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByTestId("screen-start")).toBeVisible({ timeout: 5000 });
    await page.goto("/game");
    await expect(page.getByTestId("screen-match")).toBeVisible({ timeout: 10_000 });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
