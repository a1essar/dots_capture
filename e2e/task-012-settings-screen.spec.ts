import { test, expect } from "@playwright/test";

/**
 * TASK-012: UI Settings screen + live renderer options.
 * E2E verifies: Settings screen layout, animations/highlight/point size/line thickness/reduced motion
 * toggles and sliders with data-testid; persistence in localStorage; Back link.
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

async function goToSettings(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  await expect(page.getByTestId("screen-settings")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("TASK-012: Settings screen", () => {
  test("Settings screen is reachable from / and shows all rows and controls", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/");
    await expect(page.getByTestId("screen-start")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("link-settings").click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByTestId("screen-settings")).toBeVisible();
    await expect(page.getByTestId("settings-row-animations")).toBeVisible();
    await expect(page.getByTestId("settings-row-highlight")).toBeVisible();
    await expect(page.getByTestId("settings-row-point-size")).toBeVisible();
    await expect(page.getByTestId("settings-row-line-thickness")).toBeVisible();
    await expect(page.getByTestId("settings-row-reduced-motion")).toBeVisible();
    await expect(page.getByTestId("toggle-animations")).toBeVisible();
    await expect(page.getByTestId("toggle-highlight-capture")).toBeVisible();
    await expect(page.getByTestId("slider-point-size")).toBeVisible();
    await expect(page.getByTestId("slider-line-thickness")).toBeVisible();
    await expect(page.getByTestId("toggle-reduced-motion")).toBeVisible();
    await expect(page.getByTestId("link-back")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Direct /settings shows Settings screen with all data-testids", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    await expect(page.getByTestId("toggle-animations")).toBeVisible();
    await expect(page.getByTestId("toggle-highlight-capture")).toBeVisible();
    await expect(page.getByTestId("slider-point-size")).toBeVisible();
    await expect(page.getByTestId("slider-line-thickness")).toBeVisible();
    await expect(page.getByTestId("toggle-reduced-motion")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Animations toggle flips On/Off and persists to localStorage", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    const toggle = page.getByTestId("toggle-animations");
    const initialText = await toggle.textContent();
    await toggle.click();
    await expect(toggle).not.toHaveText(initialText ?? "");
    const raw = await page.evaluate(() =>
      localStorage.getItem("contours.uiSettings.v1")
    );
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { animations?: boolean };
    expect(typeof parsed.animations).toBe("boolean");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Highlight potential capture toggle flips On/Off", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    const toggle = page.getByTestId("toggle-highlight-capture");
    const initialText = await toggle.textContent();
    await toggle.click();
    await expect(toggle).not.toHaveText(initialText ?? "");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Point size slider changes value and displays number", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    const slider = page.getByTestId("slider-point-size");
    await expect(slider).toHaveAttribute("min", "0.18");
    await expect(slider).toHaveAttribute("max", "0.35");
    await slider.fill("0.25");
    await expect(page.getByTestId("settings-row-point-size")).toContainText(
      "0.25"
    );
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Line thickness slider changes value and displays number", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    const slider = page.getByTestId("slider-line-thickness");
    await expect(slider).toHaveAttribute("min", "0.04");
    await expect(slider).toHaveAttribute("max", "0.15");
    await slider.fill("0.08");
    await expect(page.getByTestId("settings-row-line-thickness")).toContainText(
      "0.08"
    );
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Reduced motion toggle flips On/Off", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    const toggle = page.getByTestId("toggle-reduced-motion");
    const initialText = await toggle.textContent();
    await toggle.click();
    await expect(toggle).not.toHaveText(initialText ?? "");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Back link from Settings navigates to /", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    await page.getByTestId("link-back").click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByTestId("screen-start")).toBeVisible({
      timeout: 5000,
    });
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Settings persist after navigation: change then go to game and back to settings", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await goToSettings(page);
    await page.getByTestId("slider-point-size").fill("0.2");
    await page.getByTestId("link-back").click();
    await expect(page.getByTestId("screen-start")).toBeVisible({
      timeout: 5000,
    });
    await page.goto("/match");
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible({
      timeout: 20_000,
    });
    await page.goto("/settings");
    await expect(page.getByTestId("screen-settings")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("slider-point-size")).toHaveValue("0.2");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
