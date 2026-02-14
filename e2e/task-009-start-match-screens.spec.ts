import { test, expect } from "@playwright/test";

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

test.describe("TASK-009: Start + Match screens (mode/presets/colors/difficulty)", () => {
  test("Start screen has required structure and data-testids", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/");
    await expect(page.getByTestId("screen-start")).toBeVisible();
    await expect(page.getByTestId("start-card")).toBeVisible();
    await expect(page.getByTestId("start-title")).toContainText("Contours");
    await expect(page.getByTestId("start-subtitle")).toBeVisible();
    await expect(page.getByTestId("start-actions")).toBeVisible();
    await expect(page.getByTestId("link-pvp")).toContainText("Player vs Player");
    await expect(page.getByTestId("link-pvc")).toContainText("Player vs Computer");
    await expect(page.getByTestId("link-settings")).toContainText("Settings");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Start → PVP navigates to /match?mode=PVP", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/");
    await page.getByTestId("link-pvp").click();
    await expect(page).toHaveURL(/\/(match)\?mode=PVP/);
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page.getByTestId("match-title")).toContainText("New Match");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Start → PVC navigates to /match?mode=PVC without bot difficulty controls", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/");
    await page.getByTestId("link-pvc").click();
    await expect(page).toHaveURL(/\/(match)\?mode=PVC/);
    await expect(page.getByTestId("screen-match")).toBeVisible();
    await expect(page.getByTestId("match-difficulty")).toHaveCount(0);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Start → Settings navigates to /settings", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/");
    await page.getByTestId("link-settings").click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByTestId("screen-settings")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Match screen has presets 20x20, 30x20, 40x30", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match");
    await expect(page.getByTestId("match-presets")).toBeVisible();
    await expect(page.getByTestId("preset-20x20")).toBeVisible();
    await expect(page.getByTestId("preset-30x20")).toBeVisible();
    await expect(page.getByTestId("preset-40x30")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Match screen has player color pickers and previews", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match");
    await expect(page.getByTestId("match-color-p1")).toBeVisible();
    await expect(page.getByTestId("match-color-p2")).toBeVisible();
    await expect(page.getByTestId("match-preview-p1")).toBeVisible();
    await expect(page.getByTestId("match-preview-p2")).toBeVisible();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Same player colors show error and disable Start Game", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match");
    const p1Blue = page.getByTestId("color-p1-3b82f6");
    const p2Blue = page.getByTestId("color-p2-3b82f6");
    await p1Blue.click();
    await p2Blue.click();
    await expect(page.getByTestId("match-error-colors")).toContainText(
      "Player colors must differ"
    );
    await expect(page.getByTestId("link-start-game")).toBeDisabled();
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Match Back goes to start", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match");
    await page.getByTestId("link-back").click();
    await expect(page.getByTestId("screen-start")).toBeVisible();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("Start Game with valid settings creates GameState and navigates to /game", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match");
    await expect(page.getByTestId("link-start-game")).toBeEnabled();
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/game/);
    await expect(page.getByTestId("game-score")).toContainText("0");
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });

  test("PVC: Start Game navigates to /game", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    const consoleCollected = { errors: [] as string[] };
    attachConsoleCollector(page, consoleCollected);
    await page.goto("/match?mode=PVC");
    await expect(page.getByTestId("link-start-game")).toBeEnabled();
    await page.getByTestId("link-start-game").click();
    await expect(page.getByTestId("screen-game")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/game/);
    const critical = consoleCollected.errors.filter((e) => !isAllowlisted(e));
    expect(critical, `Browser console errors: ${critical.join("; ")}`).toHaveLength(0);
  });
});
