import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * The proposal ledger on a deployed build (Firm Brain Build Spec step 9), as three Kestrel Bay people on the unshared
 * Marrowfield opportunity board: Harper Quinn (owner), Maren Hollis (admin) and Elif Yilmaz (analyst).
 *
 * Run proposal-draft-live once on this build first: the "first draft" row is written when a draft is saved, so a
 * draft made before this build has no row.
 *
 * THIS SPEC WRITES, AND CANNOT CLEAN UP AFTER ITSELF. Ledger rows are written by the server's service role only; no
 * signed-in person can delete one through the database, so the test cannot either. It therefore writes only what a
 * real demo would: one "Questions sent" date as Harper and one proposal value as Maren. Every row it wrote or changed
 * is listed with its id in test-results/proposal-ledger.json, for the founder's session to clear. Run it alone.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com VITE_SUPABASE_URL=<url> VITE_SUPABASE_PUBLISHABLE_KEY=<key> \
 *     bunx playwright test proposal-ledger-live --workers=1
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MARROWFIELD = process.env["DEMO_BOARD"] ?? "4a4abc70-32af-4cdb-8772-3850f9d673bc";
const URL_BASE = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const API_KEY = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
const VALUE_TEXT = "380k";
const VALUE_SHOWN = "USD 380,000";
const MONEY = /[$£€]\s?\d|\b(?:USD|GBP|EUR|AUD|CAD|NZD|CHF|SGD)\s?\d/;

type Row = Record<string, unknown>;
type Wrote = { table: string; id: string; what: string; by: string };
const report: { board: string; wrote: Wrote[]; saw: Record<string, unknown> } = { board: MARROWFIELD, wrote: [], saw: {} };

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

/** Asks PostgREST directly with this browser's own session: what the database itself lets this person read. */
async function readDirect(page: Page, table: string, columns: string): Promise<Row[]> {
  return page.evaluate(
    async ({ table, columns, base, key, board }) => {
      const entry = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (!entry) throw new Error("no signed in session in this browser");
      const raw = localStorage.getItem(entry) as string;
      const parsed = JSON.parse(raw.startsWith("base64-") ? atob(raw.slice(7)) : raw);
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
      if (!token) throw new Error("session has no access token");
      const response = await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(columns)}&engagement_id=eq.${board}&limit=1000`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
      // A refusal is a pass for our purposes: nothing came back.
      if (response.status === 401 || response.status === 403) return [];
      if (!response.ok) throw new Error(`${table} read failed: ${response.status}`);
      return (await response.json()) as Record<string, unknown>[];
    },
    { table, columns, base: URL_BASE, key: API_KEY, board: MARROWFIELD },
  );
}

/** Opens Start a proposal on Marrowfield; null when this person cannot open the board at all. */
async function openProposalPanel(page: Page) {
  await page.goto(`/engagements/${MARROWFIELD}/canvas-lab`, { waitUntil: "domcontentloaded" });
  const toolbar = page.getByRole("toolbar", { name: "Board controls" });
  if (!(await toolbar.waitFor({ timeout: 45_000 }).then(() => true, () => false))) return null;
  await toolbar.locator('[data-toolbar-control="more"]').click();
  const start = page.getByRole("menuitem", { name: "Start a proposal" });
  if (!(await start.waitFor({ timeout: 5_000 }).then(() => true, () => false))) return null;
  await start.click();
  const panel = page.getByTestId("proposal-start");
  await panel.waitFor({ timeout: 15_000 });
  return panel;
}

const today = (page: Page) => page.evaluate(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10));

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/proposal-ledger.json", JSON.stringify(report, null, 2));
});

test("the owner sees the draft on the line, and sets a date", async ({ browser }) => {
  test.skip(!PASSWORD || !URL_BASE || !API_KEY, "needs DEMO_FIRM_PASSWORD, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
  test.setTimeout(4 * 60_000);
  const page = await as(browser, "quinn");
  const panel = await openProposalPanel(page);
  expect(panel, "Harper opens Start a proposal on her own board").not.toBeNull();
  const line = panel!.getByTestId("proposal-value-line");
  await line.waitFor({ timeout: 30_000 });
  await expect(line).toHaveAttribute("data-ledger-access", "owner");

  const before = await readDirect(page, "proposal_ledger", "id,kind,occurred_at,source_ref");
  report.saw["quinn rows before"] = before;
  const draftRow = before.find((row) => row["kind"] === "draft_completed");
  expect(draftRow, "a draft made on this build has a first draft row (run proposal-draft-live first)").toBeTruthy();
  await expect(line.locator('[data-ledger-step="draft_completed"]')).not.toContainText("Not recorded");
  await expect(line.locator('[data-ledger-figure="sourced"]')).toContainText("sections arrived with a source");
  // Every figure opens to rows the database really holds for this board.
  const ids = new Set(before.map((row) => String(row["id"])));
  for (const figure of await line.locator("[data-ledger-figure] > button").all()) {
    await figure.click();
    const traced = await line.locator("[data-ledger-trace] [data-ledger-row]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-ledger-row") ?? ""));
    expect(traced.length, `rows behind "${await figure.textContent()}"`).toBeGreaterThan(0);
    for (const id of traced) expect(ids.has(id), `row ${id} is a ledger row`).toBe(true);
  }
  // The owner is a manager: no value, set or not, anywhere on her line, and none from the database.
  await expect(line.locator("[data-ledger-value]")).toHaveCount(0);
  expect((await line.innerText()).match(MONEY), "no money on the owner's line").toBeNull();
  expect(await readDirect(page, "proposal_ledger_values", "engagement_id,amount,currency"), "an em owner reads no value").toHaveLength(0);
  await expect(line.locator("[data-ledger-unshared]")).toBeVisible();

  // One date, as in a demo: questions sent today.
  const had = before.find((row) => row["kind"] === "questions_sent");
  const step = line.locator('[data-ledger-step="questions_sent"]');
  await step.getByRole("button", { name: /^(Set date|Change): Questions sent$/ }).click();
  const day = await today(page);
  await step.getByLabel("Questions sent: date").fill(day);
  await step.getByRole("button", { name: "Save" }).click();
  await expect(step.getByLabel("Questions sent: date")).toHaveCount(0, { timeout: 30_000 });
  await expect(step).not.toContainText("Not recorded");
  const after = await readDirect(page, "proposal_ledger", "id,kind,occurred_at,source_ref");
  const sent = after.filter((row) => row["kind"] === "questions_sent");
  expect(sent, "one questions sent row, however many times it is set").toHaveLength(1);
  expect(String(sent[0]!["occurred_at"]).slice(0, 10)).toBe(day);
  report.wrote.push({ table: "proposal_ledger", id: String(sent[0]!["id"]), what: had ? `questions_sent date changed from ${String(had["occurred_at"])} to ${day}` : `questions_sent ${day} (new row)`, by: "quinn" });
  // No column anywhere names a person.
  const all = await readDirect(page, "proposal_ledger", "*");
  report.saw["ledger columns"] = Object.keys(all[0] ?? {});
  expect(Object.keys(all[0] ?? {}).filter((column) => /user|profile|person|owner|author|created_by|actor/i.test(column))).toEqual([]);
  await page.screenshot({ path: "test-results/proposal-ledger-quinn.png" });
  await page.context().close();
});

test("an admin sets the value; the firm card does not count the unshared board", async ({ browser }) => {
  test.skip(!PASSWORD || !URL_BASE || !API_KEY, "needs DEMO_FIRM_PASSWORD, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
  test.setTimeout(4 * 60_000);
  const page = await as(browser, "hollis");
  const panel = await openProposalPanel(page);
  expect(panel, "Maren is on the Marrowfield team and opens Start a proposal").not.toBeNull();
  const line = panel!.getByTestId("proposal-value-line");
  await line.waitFor({ timeout: 30_000 });
  // Marrowfield is not shared with the firm, so the database shows an admin who is not its owner neither its dates
  // nor its value. She can still set the value; the line says who will see it.
  report.saw["hollis access"] = await line.getAttribute("data-ledger-access");
  report.saw["hollis rows (direct)"] = (await readDirect(page, "proposal_ledger", "id,kind")).length;
  const valueBefore = await readDirect(page, "proposal_ledger_values", "engagement_id,amount,currency");
  report.saw["hollis value before (direct)"] = valueBefore;
  await line.getByRole("button", { name: /^(Set value|Change)$/ }).click();
  await line.getByLabel("Proposal value").fill(VALUE_TEXT);
  await line.getByLabel("Currency").selectOption("USD");
  await line.getByRole("button", { name: "Save" }).click();
  await expect(line.getByLabel("Proposal value")).toHaveCount(0, { timeout: 30_000 });
  await expect(line).toContainText(VALUE_SHOWN);
  report.wrote.push({ table: "proposal_ledger_values", id: MARROWFIELD, what: `value set to ${VALUE_SHOWN} (one row per board, keyed by the board id; before: ${JSON.stringify(valueBefore)})`, by: "hollis" });
  await page.screenshot({ path: "test-results/proposal-ledger-hollis-board.png" });

  // The firm card: built from shared proposals only, so nothing from Marrowfield is behind any figure.
  await page.goto("/firm", { waitUntil: "domcontentloaded" });
  const card = page.getByTestId("firm-proposals-card");
  await card.waitFor({ timeout: 60_000 });
  await expect(card.locator("[data-ledger-unshared]")).toBeVisible();
  const quinnRows = (report.saw["quinn rows before"] as Row[] | undefined) ?? [];
  const marrowfield = new Set(quinnRows.map((row) => String(row["id"])));
  const behind: string[] = [];
  for (const figure of await card.locator("[data-ledger-figure] > button").all()) {
    await figure.click();
    behind.push(...(await card.locator("[data-ledger-trace] [data-ledger-row]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-ledger-row") ?? ""))));
  }
  report.saw["firm card"] = (await card.innerText()).replace(/\s+/g, " ").slice(0, 600);
  report.saw["firm card rows"] = behind.length;
  expect(behind.filter((id) => marrowfield.has(id)), "no Marrowfield row behind any firm figure").toEqual([]);
  expect(await card.innerText()).not.toMatch(/Marrowfield|Harper|Quinn/);
  await page.screenshot({ path: "test-results/proposal-ledger-hollis-firm.png", fullPage: true });
  await page.context().close();
});

test("an analyst sees no value, on screen or from the database", async ({ browser }) => {
  test.skip(!PASSWORD || !URL_BASE || !API_KEY, "needs DEMO_FIRM_PASSWORD, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
  test.setTimeout(3 * 60_000);
  const page = await as(browser, "yilmaz");
  expect(await readDirect(page, "proposal_ledger_values", "engagement_id,amount,currency"), "the database returns an analyst no value row").toHaveLength(0);
  report.saw["yilmaz rows (direct)"] = (await readDirect(page, "proposal_ledger", "id,kind")).length;
  const panel = await openProposalPanel(page);
  report.saw["yilmaz opens the panel"] = panel !== null;
  if (panel) {
    await page.waitForTimeout(5_000);
    expect((await panel.innerText()).match(MONEY), "no money on the analyst's panel").toBeNull();
    await expect(panel.locator("[data-ledger-value], [data-ledger-value-form]")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /^(Set value|Change)$/ })).toHaveCount(0);
  }
  await page.goto("/firm", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8_000);
  await expect(page.getByTestId("firm-proposals-card")).toHaveCount(0);
  await page.context().close();
});
