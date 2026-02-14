/**
 * TASK-015: Visual checkpoint — capture scenario (territory + captured points).
 * Scripted sequence of moves (PVP, 20×20) that produces a capture per GDS:
 * one P2 point enclosed by P1 ring; after capturing move: territory overlay
 * inside contour, captured point dimmed/marked, score 1 : 0.
 */
import { test, expect } from "@playwright/test";

const VIEWPORT = { width: 1280, height: 720 };
const TEST_TIMEOUT = 60_000;

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

/** Click at board intersection (x, y). Board layout read from canvas-container's [data-board-*]. */
async function clickAtIntersection(
  page: import("@playwright/test").Page,
  x: number,
  y: number
) {
  const boardInner = page
    .getByTestId("canvas-container")
    .locator("[data-board-step]")
    .first();
  await expect(boardInner).toHaveAttribute("data-board-step", /.+/, {
    timeout: 5000,
  });
  const originX = Number(await boardInner.getAttribute("data-board-origin-x"));
  const originY = Number(await boardInner.getAttribute("data-board-origin-y"));
  const step = Number(await boardInner.getAttribute("data-board-step"));
  expect(
    Number.isFinite(originX) && Number.isFinite(originY) && Number.isFinite(step)
  ).toBe(true);
  const box = await boardInner.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + originX + x * step;
  const centerY = box!.y + originY + y * step;
  await page.mouse.click(centerX, centerY);
}

/**
 * Scripted moves to produce one capture: P2 point at (1,1) enclosed by P1.
 * After move 15: P1 score +1, territory at (2,1),(1,2),(2,2), captured at (1,1).
 */
const CAPTURE_MOVES: Array<{ x: number; y: number }> = [
  { x: 0, y: 1 },   // 1 P1
  { x: 1, y: 1 },   // 2 P2 (inside)
  { x: 0, y: 2 },   // 3 P1
  { x: 5, y: 5 },   // 4 P2
  { x: 1, y: 0 },   // 5 P1
  { x: 5, y: 6 },   // 6 P2
  { x: 2, y: 0 },   // 7 P1
  { x: 6, y: 5 },   // 8 P2
  { x: 3, y: 1 },   // 9 P1
  { x: 6, y: 6 },   // 10 P2
  { x: 3, y: 2 },   // 11 P1
  { x: 7, y: 5 },   // 12 P2
  { x: 1, y: 3 },   // 13 P1
  { x: 7, y: 6 },   // 14 P2
  { x: 2, y: 3 },   // 15 P1 -> capture
];

test.describe("TASK-015: Visual checkpoint — capture scenario", () => {
  test.use({ viewport: VIEWPORT });

  test("after capturing move: territory overlay, captured point, score 1 : 0", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    const boardInner = page
      .getByTestId("canvas-container")
      .locator("[data-board-step]")
      .first();
    await expect(boardInner).toHaveAttribute("data-board-step", /.+/, {
      timeout: 15_000,
    });

    for (const move of CAPTURE_MOVES) {
      await clickAtIntersection(page, move.x, move.y);
      await page.waitForTimeout(80);
    }

    await expect(page.getByTestId("game-score")).toContainText("1 : 0", {
      timeout: 5000,
    });
    await expect(page.getByTestId("game-turn")).toContainText("Player 2", {
      timeout: 3000,
    });

    await expect(page).toHaveScreenshot("capture-after-move.png", {
      fullPage: true,
    });

    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });
});
