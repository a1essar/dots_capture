/**
 * TASK-014: Visual checkpoint — Game board initial + after 1 move.
 * Deterministic: fixed viewport, default 20×20 preset, animations disabled.
 * Screenshots: empty board, then after placing one point at known intersection (1,1).
 * Verify: grid/intersections visible, point at expected position, panels do not overlap canvas.
 */
import { test, expect } from "@playwright/test";

const VIEWPORT = { width: 1280, height: 720 };
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

function disableAnimationsForScreenshot(page: {
  addInitScript: (fn: () => void) => Promise<void>;
}) {
  return page.addInitScript(() => {
    const target = document.head || document.documentElement;
    if (!target) return;
    const style = document.createElement("style");
    style.textContent =
      "* { transition: none !important; animation: none !important; animation-duration: 0s !important; }";
    target.appendChild(style);
  });
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

test.describe("TASK-014: Visual checkpoint — Game board", () => {
  test.use({ viewport: VIEWPORT });

  test("initial empty board screenshot matches baseline", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    const canvas = page.getByTestId("canvas-container").locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const boardInner = page.getByTestId("canvas-container").locator("[data-board-step]").first();
    await expect(boardInner).toHaveAttribute("data-board-step", /.+/, { timeout: 5000 });
    await expect(page).toHaveScreenshot("game-board-initial.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("after one move at known intersection (1,1) screenshot matches baseline", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    const canvas = page.getByTestId("canvas-container").locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const boardInner = page.getByTestId("canvas-container").locator("[data-board-step]").first();
    await expect(boardInner).toHaveAttribute("data-board-step", /.+/, { timeout: 5000 });

    const originX = Number(await boardInner.getAttribute("data-board-origin-x"));
    const originY = Number(await boardInner.getAttribute("data-board-origin-y"));
    const step = Number(await boardInner.getAttribute("data-board-step"));
    expect(Number.isFinite(originX) && Number.isFinite(originY) && Number.isFinite(step)).toBe(true);

    const ix = 1;
    const iy = 1;
    const box = await boardInner.boundingBox();
    expect(box).not.toBeNull();
    const centerX = box!.x + originX + ix * step;
    const centerY = box!.y + originY + iy * step;
    await page.mouse.click(centerX, centerY);

    await expect(page.getByTestId("game-turn")).toContainText("Player 2", { timeout: 5000 });
    await expect(page).toHaveScreenshot("game-board-after-one-move.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
