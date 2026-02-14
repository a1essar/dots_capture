/**
 * TASK-018: Feature — potential capture highlight (toggle-driven).
 * E2E verifies: when "Highlight potential capture" is enabled, hovering at an
 * intersection that would create a capture shows an unobtrusive overlay;
 * when disabled, no overlay. Uses scripted pre-capture state (14 moves) and
 * hover at (2,3) which would capture. Console errors collected and allowlisted.
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
  await expect(page.getByTestId("screen-match")).toBeVisible({
    timeout: 10_000,
  });
  const startBtn = page.getByTestId("link-start-game");
  await startBtn.waitFor({ state: "visible", timeout: 5000 });
  await expect(startBtn).toBeEnabled({ timeout: 5000 });
  await startBtn.click();
  await expect(page.getByTestId("screen-game")).toBeVisible({
    timeout: 20_000,
  });
}

/** Click at board intersection (x, y). */
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

/** Hover at board intersection (x, y) without clicking. */
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

/** 14 moves: pre-capture state (P2 at (1,1) almost enclosed; next move (2,3) by P1 captures). */
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

test.describe("TASK-018: Potential capture highlight", () => {
  test.use({ viewport: VIEWPORT });

  test("when highlight enabled: overlay visible on hover at capturing intersection", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    for (const move of MOVES_BEFORE_CAPTURE) {
      await clickAtIntersection(page, move.x, move.y);
      await page.waitForTimeout(80);
    }
    await hoverAtIntersection(page, CAPTURING_HOVER.x, CAPTURING_HOVER.y);
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("potential-capture-overlay-on.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });

  test("when highlight disabled: no overlay on hover at same intersection", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
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
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    for (const move of MOVES_BEFORE_CAPTURE) {
      await clickAtIntersection(page, move.x, move.y);
      await page.waitForTimeout(80);
    }
    await hoverAtIntersection(page, CAPTURING_HOVER.x, CAPTURING_HOVER.y);
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot("potential-capture-overlay-off.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });

  test("potential capture highlight: no critical console errors with setting on", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    for (const move of MOVES_BEFORE_CAPTURE) {
      await clickAtIntersection(page, move.x, move.y);
      await page.waitForTimeout(80);
    }
    await hoverAtIntersection(page, CAPTURING_HOVER.x, CAPTURING_HOVER.y);
    await page.waitForTimeout(200);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });
});
