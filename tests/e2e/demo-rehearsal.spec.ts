import { writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * The 30-minute buyer demo, rehearsed on the deployed site before each session (firm-brain-review RECOMMENDATION
 * section 9). Each person signs in in a fresh browser and walks their part of the script; each step records pass or
 * fail with what it saw, in test-results/demo-rehearsal.json. Nothing is written: no draft, no sharing change. The
 * live draft has its own check (proposal-draft-live). Table writes from the browser are blocked.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com bunx playwright test demo-rehearsal
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MARROWFIELD = process.env["DEMO_BOARD"] ?? "4a4abc70-32af-4cdb-8772-3850f9d673bc";
const MONEY = /[$£€]\s?\d/;

type Step = { person: string; minute: string; step: string; ok: boolean; saw: string };
const steps: Step[] = [];

async function as(browser: Browser, person: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  // Read only: a table write from the browser (a board records "viewed" when opened) never leaves. Reads and RPCs go.
  await context.route(/supabase\.co\/rest\/v1\//, (route) => {
    const request = route.request();
    const table = request.url().split("/rest/v1/")[1] ?? "";
    if (["GET", "HEAD", "OPTIONS"].includes(request.method()) || table.startsWith("rpc/")) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${person}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
  return page;
}

function record(person: string, minute: string, step: string, ok: boolean, saw: string) {
  steps.push({ person, minute, step, ok, saw: saw.replace(/\s+/g, " ").slice(0, 300) });
  expect.soft(ok, `${minute} ${person}: ${step} (${saw.slice(0, 120)})`).toBe(true);
}

async function openProposalPanel(page: Page) {
  await page.goto(`/engagements/${MARROWFIELD}/canvas-lab`, { waitUntil: "domcontentloaded" });
  const toolbar = page.getByRole("toolbar", { name: "Board controls" });
  await toolbar.waitFor({ timeout: 60_000 });
  await toolbar.locator('[data-toolbar-control="more"]').click();
  await page.getByRole("menuitem", { name: "Start a proposal" }).click();
  const panel = page.getByTestId("proposal-start");
  await panel.waitFor({ timeout: 15_000 });
  return panel;
}

/** The answer's status as the server sent it ("answered", "not_found", "about_people"...), from the Ask reply. */
const ASK_STATUS = /"k":\["status","summary"[^\]]*\],"v":\[\{"t":1,"s":"(\w+)"/;

/**
 * Asks from Home the way the person does. An admin's Home answers in place (`data-firm-answer`); for a lead or a
 * member, Home turns the orb and opens the answer on the Firm brain canvas (D-85, #279), so the status is read from
 * the server's reply and the words from the canvas answer card once they stop changing.
 */
async function ask(page: Page, question: string): Promise<{ status: string; text: string }> {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const box = page.getByTestId("ask-the-firm");
  await box.waitFor({ timeout: 30_000 });
  const reply = page.waitForResponse(async (res) => res.url().includes("_serverFn") && ASK_STATUS.test(await res.text().catch(() => "")), { timeout: 120_000 });
  await box.getByLabel("Question for the firm").fill(question);
  await box.getByRole("button", { name: "Ask" }).click();
  const status = (await reply.then((res) => res.text())).match(ASK_STATUS)?.[1] ?? "";
  const inPlace = box.locator("[data-firm-answer]");
  const onCanvas = page.getByTestId("canvas-answer").last();
  await inPlace.or(onCanvas).first().waitFor({ timeout: 60_000 });
  if (await inPlace.count()) return { status, text: await inPlace.innerText() };
  await expect(page).toHaveURL(/\/firm-brain/);
  await expect(onCanvas).not.toHaveAttribute("data-answer-status", "pending", { timeout: 120_000 });
  let text = "";
  for (let tries = 0; tries < 30; tries += 1) {
    const now = await onCanvas.innerText();
    if (now === text) break;
    text = now;
    await page.waitForTimeout(700);
  }
  return { status, text };
}

test.beforeEach(() => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
});

test.afterAll(() => {
  writeFileSync("test-results/demo-rehearsal.json", JSON.stringify(steps, null, 2));
});

test("minutes 2 to 14: Harper reads the notes, sees precedents and good proposals, no fees", async ({ browser }) => {
  test.setTimeout(6 * 60_000);
  const page = await as(browser, "quinn");
  const panel = await openProposalPanel(page);
  await panel.getByRole("button", { name: "Read the notes" }).click();
  await expect(panel.getByRole("button", { name: "Read the notes" })).toBeEnabled({ timeout: 90_000 });
  const problem = await panel.getByRole("textbox").nth(1).inputValue();
  record("quinn", "4", "brief filled from the notes", /diabetes|prediabetes/i.test(problem), problem);

  await panel.getByRole("button", { name: "Find precedents" }).click();
  await panel.locator("[data-precedent]").first().waitFor({ timeout: 120_000 });
  const precedents = await panel.locator("[data-precedent]").allTextContents();
  const close = await panel.locator('[data-precedent="close"]').allTextContents();
  record("quinn", "5", "St. Brigid and Cedarmere among the precedents", ["weight management", "behavioral health"].every((name) => precedents.some((text) => text.toLowerCase().includes(name))), precedents.join(" | "));
  record("quinn", "5", "at least one close match", close.length >= 1, `${close.length} close`);
  record("quinn", "6", "a lesson on a precedent", (await panel.locator("[data-precedent-lesson]").count()) >= 1, "lessons");
  record("quinn", "6", "coverage line says some engagements are not shared", ((await panel.locator("[data-proposal-coverage]").textContent()) ?? "").includes("not shared"), (await panel.locator("[data-proposal-coverage]").textContent()) ?? "");
  const good = await panel.locator("[data-good-proposal]").count();
  record("quinn", "9", "what good looks like lists the firm's proposals", good >= 6, `${good} proposals`);
  record("quinn", "9", "Harper sees no past fees", (await panel.locator("[data-past-fees]").count()) === 0 && !MONEY.test((await panel.textContent()) ?? ""), "no fee panel");
  record("quinn", "10", "the Draft button is offered after the precedents", await panel.getByRole("button", { name: "Draft the proposal" }).isVisible(), "draft button");
  await page.context().close();
});

test("minutes 17 to 19: Maren sees what we charged before, as a list", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const page = await as(browser, "hollis");
  const panel = await openProposalPanel(page);
  await panel.getByRole("textbox").nth(1).fill("Diabetes prevention service line for a regional health system");
  await panel.getByRole("button", { name: "Find precedents" }).click();
  await panel.locator("[data-precedent]").first().waitFor({ timeout: 120_000 });
  const fees = await panel.locator("[data-past-fee]").allTextContents();
  record("hollis", "18", "past fees shown to the partner", fees.length >= 1 && fees.every((row) => MONEY.test(row)), fees.join(" | "));
  record("hollis", "18", "no range line", !/\$\d+k?\s*(to|-)\s*\$\d/.test((await panel.textContent()) ?? ""), "no range");
  await page.context().close();
});

test("minutes 20 to 26: Ask the firm finds, refuses and stays out of unshared work", async ({ browser }) => {
  test.setTimeout(8 * 60_000);
  const page = await as(browser, "quinn");
  const obesity = await ask(page, "Have we worked on obesity care?");
  record("quinn", "20", "obesity care finds the weight management work", obesity.status === "answered" && /weight management/i.test(obesity.text), obesity.text);
  const lessons = await ask(page, "What have we learned about getting client data on time?");
  record("quinn", "22", "lessons about client data come back with sources", lessons.status === "answered", lessons.text);
  const staffing = await ask(page, "Have we done commercial diligence on a staffing business?");
  record("quinn", "24", "staffing diligence says not found", staffing.status === "not_found" && !/Sorrel|clinical staffing platform/i.test(staffing.text), staffing.text);
  const quartzline = await ask(page, "What do we know about Quartzline?");
  record("quinn", "25", "the unshared Quartzline engagement gives nothing", quartzline.status === "not_found" && !/semiconductor|tape-out/i.test(quartzline.text), quartzline.text);
  const people = await ask(page, "Who is our best person for health system work?");
  record("quinn", "26", "a question ranking people is refused", people.status === "about_people", people.text);
  await page.context().close();
});

test("minute 19: an analyst asking the firm sees no fees", async ({ browser }) => {
  test.setTimeout(4 * 60_000);
  const page = await as(browser, "yilmaz");
  const answer = await ask(page, "What did we charge St. Brigid?");
  record("yilmaz", "19", "no fee figure reaches an analyst", !MONEY.test(answer.text), answer.text);
  await page.context().close();
});
