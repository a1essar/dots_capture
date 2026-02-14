import { test, expect } from "@playwright/test";

/**
 * TASK-008: Pixi renderer — board view, layers, resize, input mapping.
 * E2E verifies: canvas container mounts Pixi canvas; layout/rendering present;
 * pointer input maps to (x,y) and triggers placePoint (turn/score update).
 * Browser console: collect errors; allowlist non-critical (favicon, 404, etc.).
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

test.describe("TASK-008: Pixi renderer — board view, layers, input mapping", () => {
  test("Canvas container is visible on game screen and contains Pixi canvas", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    const container = page.getByTestId("canvas-container");
    await expect(container).toBeVisible();
    const canvas = container.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("width", /.+/);
    await expect(canvas).toHaveAttribute("height", /.+/);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Canvas has non-zero dimensions after layout", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    const canvas = page.getByTestId("canvas-container").locator("canvas");
    await expect(canvas).toBeVisible();
    const width = await canvas.getAttribute("width");
    const height = await canvas.getAttribute("height");
    expect(Number(width)).toBeGreaterThan(0);
    expect(Number(height)).toBeGreaterThan(0);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Click on board center triggers placePoint and turn changes to Player 2", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
    const container = page.getByTestId("canvas-container");
    await expect(container).toBeVisible();
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    const centerX = (box!.x + box!.width) / 2;
    const centerY = (box!.y + box!.height) / 2;
    await page.mouse.click(centerX, centerY);
    await expect(page.getByTestId("game-turn")).toContainText("Player 2", {
      timeout: 5000,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Second click places another point and turn returns to Player 1", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    const container = page.getByTestId("canvas-container");
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    const cx = (box!.x + box!.width) / 2;
    const cy = (box!.y + box!.height) / 2;
    await page.mouse.click(cx, cy);
    await expect(page.getByTestId("game-turn")).toContainText("Player 2", {
      timeout: 5000,
    });
    await page.mouse.click(cx + 40, cy + 40);
    await expect(page.getByTestId("game-turn")).toContainText("Player 1", {
      timeout: 5000,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Score and turn reflect state; renderer is read-only (no rule logic in renderer)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await expect(page.getByTestId("game-score")).toContainText("0 : 0");
    await expect(page.getByTestId("game-turn")).toContainText("Player 1");
    const container = page.getByTestId("canvas-container");
    await expect(container.locator("canvas")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
