/**
 * TASK-017: Visual checkpoint — Settings affect canvas (point size / line thickness).
 * Opens Settings, changes point size and line thickness to extremes, returns to game,
 * captures screenshots before/after. Verifies points and lines noticeably change and
 * remain aligned to intersections (no blur/off-grid).
 */
import { test, expect } from "@playwright/test";

const VIEWPORT = { width: 1280, height: 720 };
const TEST_TIMEOUT = 45_000;

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

async function placePointAt11(page: import("@playwright/test").Page) {
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
  const centerX = box!.x + originX + 1 * step;
  const centerY = box!.y + originY + 1 * step;
  await page.mouse.click(centerX, centerY);
  await expect(page.getByTestId("game-turn")).toContainText("Player 2", {
    timeout: 5000,
  });
}

async function setSettingsExtremes(
  page: import("@playwright/test").Page,
  pointSize: string,
  lineThickness: string
) {
  await page.goto("/settings");
  await expect(page.getByTestId("screen-settings")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("slider-point-size").fill(pointSize);
  await page.getByTestId("slider-line-thickness").fill(lineThickness);
  await page.getByTestId("link-back").click();
  await expect(page.getByTestId("screen-start")).toBeVisible({
    timeout: 5000,
  });
}

test.describe("TASK-017: Visual checkpoint — Settings affect canvas", () => {
  test.use({ viewport: VIEWPORT });

  test("screenshot with default settings (before) matches baseline", async ({
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
    await placePointAt11(page);
    await expect(page).toHaveScreenshot("settings-canvas-default.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });

  test("screenshot with min point size and line thickness (extremes) matches baseline", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await setSettingsExtremes(page, "0.18", "0.04");
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    const canvas = page.getByTestId("canvas-container").locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await placePointAt11(page);
    await expect(page).toHaveScreenshot("settings-canvas-extremes-min.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });

  test("screenshot with max point size and line thickness (extremes) matches baseline", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await setSettingsExtremes(page, "0.35", "0.15");
    await goToGame(page);
    await expect(page.getByTestId("canvas-container")).toBeVisible();
    const canvas = page.getByTestId("canvas-container").locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await placePointAt11(page);
    await expect(page).toHaveScreenshot("settings-canvas-extremes-max.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });
});
