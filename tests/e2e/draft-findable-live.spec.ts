import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Liam's decision D-6 (19 Nov 2026): a proposal draft on a board shared with the firm is findable by topic in Ask the
 * firm. On the deployed site: a lead who is not on Marrowfield asks three topical questions that never name the
 * client. While the board is unshared no answer shows a trace of it; once its owner shares it, each answer cites the
 * board and says the work is a proposal; unshared again, the trace is gone. A standard member's answer shows no money.
 * The board is always left unshared, as it was. Each share or un-share notifies the firm's admins and leads: those
 * rows are left for the runner to list afterwards. Writes test-results/draft-findable-live.json.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com bunx playwright test draft-findable-live --workers=1
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MARROWFIELD = process.env["DRAFT_BOARD"] ?? "4a4abc70-32af-4cdb-8772-3850f9d673bc";
const BOARD_TITLE = "Diabetes prevention service line (proposal)";
const TRACES = /Marrowfield|Diabetes prevention service line \(proposal\)/;
const MONEY = /[$£€]\s?\d/;
const QUESTIONS = [
  "Have we done a diabetes prevention service line before?",
  "Have we worked on prediabetes for a health system?",
  "Have we done diabetes prevention work before?",
];

async function as(browser: Browser, person: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await context.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${person}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
  return page;
}

type Answer = {
  question: string;
  status: string;
  cites: boolean;
  saysProposal: boolean;
  trace: boolean;
  money: boolean;
  seconds: number;
  text: string;
};

async function ask(page: Page, question: string): Promise<Answer> {
  const started = Date.now();
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const box = page.getByTestId("ask-the-firm");
  await box.waitFor({ timeout: 30_000 });
  // 20 Nov 2026 (D-97): Ask the firm is the chat pill, on every page. Open it first; the answer builds in the chat.
  if ((await box.getAttribute("data-mode")) === "shut") await box.getByRole("button", { name: /^Open the .+ helper$/ }).click();
  await box.getByLabel("Question for the firm").waitFor({ state: "visible", timeout: 10_000 });
  await box.getByLabel("Question for the firm").fill(question);
  await box.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = box.locator("[data-firm-answer]");
  await answer.waitFor({ timeout: 120_000 });
  const status = (await answer.getAttribute("data-firm-answer")) ?? "";
  const text = await box.innerText();
  const shown = await answer.innerText();
  return {
    question,
    status,
    // Cited means answered with the board named on a source card; a "nearest" line under Not found is not a citation.
    cites: status === "answered" && shown.includes(BOARD_TITLE),
    saysProposal: /proposal/i.test(shown.replaceAll(BOARD_TITLE, "")),
    trace: TRACES.test(text),
    money: MONEY.test(text),
    seconds: Math.round((Date.now() - started) / 1000),
    text: text.slice(0, 1_500),
  };
}

async function setSharing(page: Page, on: boolean) {
  await page.goto(`/engagements/${MARROWFIELD}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const toggle = page
    .getByTestId("firm-share-section")
    .getByRole("switch", { name: "Share with firm" });
  await toggle.waitFor({ timeout: 15_000 });
  await expect(toggle).toBeEnabled({ timeout: 15_000 });
  if ((await toggle.getAttribute("aria-checked")) === String(on)) return;
  await toggle.click();
  if (!on)
    await page.getByRole("alertdialog").getByRole("button", { name: "Stop sharing" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on), { timeout: 15_000 });
  await page.keyboard.press("Escape");
}

test("a shared proposal draft is found by topic, and gone again when sharing is off", async ({
  browser,
}) => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
  test.setTimeout(20 * 60_000);
  const owner = await as(browser, "quinn");
  const lead = await as(browser, "castellano");
  const report: Record<string, unknown> = {};
  const save = () => {
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/draft-findable-live.json", JSON.stringify(report, null, 2));
  };
  try {
    await setSharing(owner, false);
    const before = await ask(lead, QUESTIONS[0]!);
    report["unsharedBefore"] = before;
    expect(before.trace, "no trace while the board is unshared").toBe(false);

    await setSharing(owner, true);
    report["shared"] = true;
    const shared: Answer[] = [];
    for (const question of QUESTIONS) shared.push(await ask(lead, question));
    report["sharedAnswers"] = shared;
    const member = await ask(owner, QUESTIONS[0]!);
    report["standardMember"] = member;
    for (const answer of shared) {
      expect.soft(answer.cites, `cites the board: ${answer.question}`).toBe(true);
      expect.soft(answer.saysProposal, `says it is a proposal: ${answer.question}`).toBe(true);
    }
    expect.soft(member.cites, "the board's owner is cited it too").toBe(true);
    expect(member.money, "a standard member sees no money").toBe(false);
  } finally {
    await setSharing(owner, false);
    report["restoredUnshared"] = true;
    save();
  }

  const after = await ask(lead, QUESTIONS[0]!);
  report["unsharedAfter"] = after;
  save();
  expect(after.trace, "no trace once sharing is off again").toBe(false);
  await owner.context().close();
  await lead.context().close();
});
