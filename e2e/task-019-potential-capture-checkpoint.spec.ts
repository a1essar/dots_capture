/**
 * TASK-019: Checkpoint — potential capture highlight overlay.
 * Visual checkpoint: reach known pre-capture board state (scripted moves),
 * enable/disable "Highlight potential capture" setting, hover at the
 * intersection that would capture; verify by screenshot that overlay is
 * present only when enabled and absent when disabled.
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

/** Ensure "Highlight potential capture" is On, then go to match (do not start game). */
async function setHighlightOnAndGoToMatch(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  await expect(page.getByTestId("screen-settings")).toBeVisible({
    timeout: 10_000,
  });
  const toggle = page.getByTestId("toggle-highlight-capture");
  await expect(toggle).toBeVisible();
  if ((await toggle.textContent())?.trim() === "Off") {
    await toggle.click();
    await page.waitForTimeout(100);
  }
  await page.goto("/match");
  await expect(page.getByTestId("screen-match")).toBeVisible({
    timeout: 10_000,
  });
}

/** Ensure "Highlight potential capture" is Off, then go to match (do not start game). */
async function setHighlightOffAndGoToMatch(
  page: import("@playwright/test").Page
) {
  await page.goto("/settings");
  await expect(page.getByTestId("screen-settings")).toBeVisible({
    timeout: 10_000,
  });
  const toggle = page.getByTestId("toggle-highlight-capture");
  await expect(toggle).toBeVisible();
  if ((await toggle.textContent())?.trim() === "On") {
    await toggle.click();
    await page.waitForTimeout(100);
  }
  await page.goto("/match");
  await expect(page.getByTestId("screen-match")).toBeVisible({
    timeout: 10_000,
  });
}

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

async function hoverAtIntersection(
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
  await page.mouse.move(centerX, centerY);
}

/** Pre-capture state: 14 moves; P2 at (1,1) almost enclosed; P1 hover at (2,3) would capture. */
const MOVES_BEFORE_CAPTURE: Array<{ x: number; y: number }> = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 0, y: 2 },
  { x: 5, y: 5 },
  { x: 1, y: 0 },
  { x: 5, y: 6 },
  { x: 2, y: 0 },
  { x: 6, y: 5 },
  { x: 3, y: 1 },
  { x: 6, y: 6 },
  { x: 3, y: 2 },
  { x: 7, y: 5 },
  { x: 1, y: 3 },
  { x: 7, y: 6 },
];
const CAPTURING_HOVER = { x: 2, y: 3 };

test.describe("TASK-019: Checkpoint — potential capture highlight overlay", () => {
  test.use({ viewport: VIEWPORT });

  test("checkpoint: overlay visible when highlight enabled", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await setHighlightOnAndGoToMatch(page);
    const startBtn = page.getByTestId("link-start-game");
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();
    await expect(page.getByTestId("screen-game")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    for (const move of MOVES_BEFORE_CAPTURE) {
      await clickAtIntersection(page, move.x, move.y);
      await page.waitForTimeout(80);
    }
    await hoverAtIntersection(page, CAPTURING_HOVER.x, CAPTURING_HOVER.y);
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("checkpoint-overlay-enabled.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });

  test("checkpoint: overlay absent when highlight disabled", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await setHighlightOffAndGoToMatch(page);
    const startBtn = page.getByTestId("link-start-game");
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();
    await expect(page.getByTestId("screen-game")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    for (const move of MOVES_BEFORE_CAPTURE) {
      await clickAtIntersection(page, move.x, move.y);
      await page.waitForTimeout(80);
    }
    await hoverAtIntersection(page, CAPTURING_HOVER.x, CAPTURING_HOVER.y);
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("checkpoint-overlay-disabled.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });
});
