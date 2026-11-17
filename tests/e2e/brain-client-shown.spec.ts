import { expect, test, type Page } from "@playwright/test";

/**
 * Firm brain phase 1, Shown to client (16 Nov). Walks the mark as the QA company admin, whose workspace alone has
 * the company-brain flag in PostHog, and checks a personal workspace never sees it.
 *
 * Run against a local dev server (never paste the password into a chat or commit it):
 *   runpane secrets exec --project lasso-by-charlotte-labs --only LASSO_QA_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 bunx playwright test brain-client-shown
 */
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";
const MEMO = "tests/e2e/fixtures/qa-memo.docx";
const OCCASION = "QA SteerCo";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

async function openFirstBoard(page: Page): Promise<void> {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const board = page.locator('a[href*="/canvas-lab"]').first();
  await board.waitFor({ state: "attached", timeout: 30_000 });
  await page.goto((await board.getAttribute("href")) ?? "/home", { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
}

async function memoCard(page: Page) {
  return page.getByRole("group", { name: /qa-memo/i }).first();
}

async function ensureMemo(page: Page): Promise<void> {
  // The board's cards arrive after the toolbar; give the memo from an earlier run time to appear before adding another.
  if (await (await memoCard(page)).isVisible({ timeout: 15_000 }).catch(() => false)) return;
  await page.getByRole("button", { name: "Add work" }).click();
  await page.getByRole("tab", { name: /from your computer/i }).click();
  await page.locator('input[type="file"]').first().setInputFiles(MEMO);
  const addIt = page.getByRole("button", { name: /^add it$/i });
  if (await addIt.isVisible({ timeout: 5_000 }).catch(() => false)) await addIt.click();
  await (await memoCard(page)).waitFor({ timeout: 90_000 });
  await page.keyboard.press("Escape");
}

async function openMenu(page: Page): Promise<void> {
  const card = await memoCard(page);
  await card.hover();
  await card.getByRole("button", { name: "Card options" }).click();
}

/** Removes every mark on the memo, one at a time, waiting for the list to shrink after each. */
async function clearMarks(page: Page): Promise<void> {
  await openMenu(page);
  const again = page.getByRole("menuitem", { name: "Shown to client…" });
  if (!(await again.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await page.keyboard.press("Escape");
    return;
  }
  await again.click();
  const dialog = page.getByRole("dialog", { name: "Shown to client" });
  const removes = dialog.getByRole("button", { name: "Remove" });
  for (let left = await removes.count(); left > 0; left -= 1) {
    await removes.first().click();
    await expect(removes).toHaveCount(left - 1, { timeout: 20_000 });
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

test("Shown to client: mark, see, remove as the QA company admin", async ({ page }) => {
  test.skip(!PASSWORD, "needs LASSO_QA_PASSWORD from the Pane secret");
  test.setTimeout(2 * 60_000);
  await signIn(page, "qa.company.admin@qaprobe.test");
  await openFirstBoard(page);
  await ensureMemo(page);
  await clearMarks(page);

  await openMenu(page);
  await page.getByRole("menuitem", { name: "Mark as shown to client" }).click();
  const dialog = page.getByRole("dialog", { name: "Shown to client" });
  await dialog.getByPlaceholder("SteerCo 3").fill(OCCASION);
  await dialog.getByRole("button", { name: "Mark as shown" }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  const line = (await memoCard(page)).locator("[data-client-shown]");
  await expect(line).toContainText(`Shown to client`, { timeout: 20_000 });
  await expect(line).toContainText(OCCASION);
  await page.screenshot({ path: "test-results/brain-client-shown-marked.png" });

  await clearMarks(page);
  await expect(line).toHaveCount(0, { timeout: 20_000 });
});

test("Shown to client: a personal workspace never sees it", async ({ page }) => {
  test.skip(!PASSWORD, "needs LASSO_QA_PASSWORD from the Pane secret");
  test.setTimeout(3 * 60_000);
  await signIn(page, "qa.personal@qaprobe.test");
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const board = page.locator('a[href*="/canvas-lab"]').first();
  if (!(await board.isVisible({ timeout: 15_000 }).catch(() => false))) {
    await expect(page.locator("[data-client-shown]")).toHaveCount(0);
    return;
  }
  await openFirstBoard(page);
  const card = page.locator(".canvas-lab-card").first();
  if (!(await card.count())) return;
  await card.hover();
  await card.getByRole("button", { name: "Card options" }).click();
  await expect(page.getByRole("menuitem", { name: /shown to client/i })).toHaveCount(0);
  await expect(page.locator("[data-client-shown]")).toHaveCount(0);
});
