/**
 * TASK-013: Visual checkpoint — Start + Match screens.
 * Deterministic rendering: fixed viewport, animations/transitions disabled for stable screenshots.
 * Baselines: toHaveScreenshot(); verify layout, buttons visible, no overflow.
 * Console errors collected and allowlisted.
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

function disableAnimationsForScreenshot(page: { addInitScript: (fn: () => void) => Promise<void> }) {
  return page.addInitScript(() => {
    const target = document.head || document.documentElement;
    if (!target) return;
    const style = document.createElement("style");
    style.textContent =
      "* { transition: none !important; animation: none !important; animation-duration: 0s !important; }";
    target.appendChild(style);
  });
}

test.describe("TASK-013: Visual smoke — Start + Match screens", () => {
  test.use({ viewport: VIEWPORT });

  test("Start screen screenshot matches baseline", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await page.goto("/");
    await expect(page.getByTestId("screen-start")).toBeVisible();
    await expect(page.getByTestId("start-card")).toBeVisible();
    await expect(page).toHaveScreenshot("start-screen.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Match screen (PVP) screenshot matches baseline", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await page.goto("/match?mode=PVP");
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page.getByTestId("match-form")).toBeVisible();
    await expect(page).toHaveScreenshot("match-screen-pvp.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Match screen (PVC) screenshot matches baseline", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await page.goto("/match?mode=PVC");
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page.getByTestId("match-form")).toBeVisible();
    await expect(page).toHaveScreenshot("match-screen-pvc.png", {
      fullPage: true,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
