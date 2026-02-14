/**
 * TASK-016: Visual checkpoint — Result screen.
 * Reach finished state via Surrender (stable path), capture screenshot of /result.
 * Verify winner/draw text, final score visible, Rematch and Back to Menu buttons accessible.
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

async function goToResult(page: import("@playwright/test").Page) {
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
  await page.getByTestId("button-surrender").click();
  await expect(page.getByTestId("screen-result")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("TASK-016: Visual checkpoint — Result screen", () => {
  test.use({ viewport: VIEWPORT });

  test("Result screen screenshot: winner text, final score, buttons visible and accessible", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await disableAnimationsForScreenshot(page);
    await goToResult(page);

    await expect(page).toHaveURL(/\/result/);
    await expect(page.getByTestId("result-title")).toBeVisible();
    await expect(page.getByTestId("result-title")).toContainText(
      /Winner: Player 1|Winner: Player 2|Draw/
    );
    await expect(page.getByTestId("result-score")).toBeVisible();
    await expect(page.getByTestId("result-score")).toContainText(
      /Final score:.*\d+.*:.*\d+/
    );
    const rematch = page.getByTestId("link-rematch");
    const backMenu = page.getByTestId("link-back-menu");
    await expect(rematch).toBeVisible();
    await expect(rematch).toBeEnabled();
    await expect(rematch).toContainText("Rematch");
    await expect(backMenu).toBeVisible();
    await expect(backMenu).toBeEnabled();
    await expect(backMenu).toContainText("Back to Menu");

    await expect(page).toHaveScreenshot("result-screen.png", {
      fullPage: true,
    });

    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(
      critical,
      `Browser console errors: ${critical.join("; ")}`
    ).toHaveLength(0);
  });
});
