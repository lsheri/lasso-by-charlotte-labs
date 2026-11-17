import { expect, test, type Page } from "@playwright/test";

/**
 * The demo firm as a buyer sees it (16 Nov): signs in as people on the Kestrel Bay boards, photographs Home and two
 * boards. Read only: nothing is clicked that changes anything (Fit only moves the view).
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 DEMO_BOARDS=<id>,<id> bunx playwright test demo-firm-check
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const [ST_BRIGID, ASHBURY] = (process.env["DEMO_BOARDS"] ?? "").split(",");

async function signIn(page: Page, key: string): Promise<void> {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${key}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

async function photographBoard(page: Page, id: string, shot: string): Promise<void> {
  await page.goto(`/engagements/${id}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3_000);
  await page.getByRole("button", { name: "Fit" }).click();
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: `test-results/${shot}.png` });
}

test.beforeEach(async ({ page }) => {
  test.skip(!PASSWORD || !ST_BRIGID || !ASHBURY, "needs DEMO_FIRM_PASSWORD and DEMO_BOARDS");
  await page.setViewportSize({ width: 1600, height: 1000 });
});

test("a manager's Home and the St. Brigid board", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await signIn(page, "pereira");
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Kestrel Bay Advisory").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: "test-results/demo-firm-home.png" });
  await photographBoard(page, ST_BRIGID!, "demo-firm-st-brigid");
});

test("the Ashbury Peak Fund II board", async ({ page }) => {
  test.setTimeout(4 * 60_000);
  await signIn(page, "brennan");
  await photographBoard(page, ASHBURY!, "demo-firm-ashbury");
});
