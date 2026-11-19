import { writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Firm brain event QA (18 Nov 2026, Liam: "events QAd for posthog tracking"). Clicks, on the deployed site as demo
 * people, every firm brain control whose event had no traffic: open a source in Ask the firm, swap a precedent, copy a
 * draft's questions, confirm a draft section, open a Red pen claim. Then check each event in PostHog (see the PR).
 * Writes test-results/events-qa-live.json with when each click happened. Leaves no data behind except one confirmed
 * section on the kept Tarnhollow draft.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com bunx playwright test events-qa-live --workers=1
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MARROWFIELD = "4a4abc70-32af-4cdb-8772-3850f9d673bc";
const TARNHOLLOW = "cbb016d6-ba58-46f1-b38f-a05601bf7764";
const PARTNERSHIP_BOARD = "49d7fa6b-75df-4831-bec2-2c4b340af76a";
const PARTNERSHIP_DECK = "Partnership deck draft v2";
const clicked: Record<string, string> = {};

async function as(browser: Browser, person: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${person}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
  return page;
}

async function proposalPanel(page: Page, board: string) {
  await page.goto(`/engagements/${board}/canvas-lab`, { waitUntil: "domcontentloaded" });
  const toolbar = page.getByRole("toolbar", { name: "Board controls" });
  await toolbar.waitFor({ timeout: 60_000 });
  await toolbar.locator('[data-toolbar-control="more"]').click();
  await page.getByRole("menuitem", { name: "Start a proposal" }).click();
  const panel = page.getByTestId("proposal-start");
  await panel.waitFor({ timeout: 15_000 });
  return panel;
}

test.beforeEach(() => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
});

test.afterAll(() => {
  writeFileSync("test-results/events-qa-live.json", JSON.stringify(clicked, null, 2));
});

test("firm_ask.source_opened: Harper opens a source under an answer", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const page = await as(browser, "quinn");
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const box = page.getByTestId("ask-the-firm");
  await box.waitFor({ timeout: 30_000 });
  await box.getByLabel("Question for the firm").fill("Have we done post-merger integration before?");
  await box.getByRole("button", { name: "Ask" }).click();
  await box.locator('[data-firm-answer="answered"]').waitFor({ timeout: 120_000 });
  const source = box.locator("[data-firm-source] button, [data-firm-source] a, button[data-firm-source]").first();
  await expect(source).toBeVisible({ timeout: 15_000 });
  await source.click();
  clicked["firm_ask.source_opened"] = new Date().toISOString();
  await page.waitForTimeout(3_000);
  await page.context().close();
});

test("proposal_draft.precedent_swapped: Harper swaps a precedent on Marrowfield", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const page = await as(browser, "quinn");
  const panel = await proposalPanel(page, MARROWFIELD);
  await panel.getByRole("textbox").nth(1).fill("Diabetes prevention service line for a regional health system");
  await panel.getByRole("button", { name: "Find precedents" }).click();
  await panel.locator("[data-precedent]").first().waitFor({ timeout: 120_000 });
  const swap = panel.locator("select[aria-label^='Swap']").first();
  await expect(swap).toBeVisible({ timeout: 15_000 });
  const option = await swap.locator("option").nth(1).getAttribute("value");
  expect(option, "a precedent to swap in").toBeTruthy();
  await swap.selectOption(option!);
  clicked["proposal_draft.precedent_swapped"] = new Date().toISOString();
  await page.waitForTimeout(3_000);
  await page.context().close();
});

test("proposal_draft.questions_copied and section_confirmed: Harper on the kept Tarnhollow draft", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const page = await as(browser, "quinn");
  const panel = await proposalPanel(page, TARNHOLLOW);
  const draft = panel.getByTestId("proposal-draft");
  await draft.waitFor({ timeout: 30_000 });
  await draft.getByRole("button", { name: "Copy questions" }).click();
  clicked["proposal_draft.questions_copied"] = new Date().toISOString();
  const confirm = draft.getByRole("button", { name: "Confirm section" }).first();
  await confirm.click();
  clicked["proposal_draft.section_confirmed"] = new Date().toISOString();
  await expect(draft.locator('[data-draft-status="confirmed"]').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await page.context().close();
});

test("red_pen.claim_opened: Thandi opens a sourced claim on her deck", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const page = await as(browser, "mbeki");
  await page.goto(`/engagements/${PARTNERSHIP_BOARD}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2_500);
  const card = page.locator("[data-node-id]").filter({ hasText: PARTNERSHIP_DECK.slice(0, 22) }).first();
  await card.click({ position: { x: 20, y: 60 } });
  await card.getByRole("button", { name: "Card options" }).click();
  await page.getByRole("menuitem", { name: "Red pen" }).click();
  const dialog = page.getByTestId("red-pen");
  await dialog.waitFor({ timeout: 15_000 });
  const summary = dialog.locator("[data-red-pen-claim] details summary").first();
  await expect(summary).toBeVisible({ timeout: 30_000 });
  await summary.click();
  clicked["red_pen.claim_opened"] = new Date().toISOString();
  await page.waitForTimeout(3_000);
  await page.context().close();
});
