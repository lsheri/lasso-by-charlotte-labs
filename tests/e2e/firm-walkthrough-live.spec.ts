import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { DEMO_PEOPLE } from "../../src/lib/demo-firm/people";

/**
 * The walk-through pass bar (Firm Brain Build Spec step 6), run as Kestrel Bay demo people against a deployed build,
 * because walk-throughs need the server's AI and admin keys. Six questions, each as the situation or method it is
 * about, three times each. Leaks, a quote that is not word for word in its source, a staff name and a money figure
 * are hard failures; thin data must be said every time; the number of habits is scored. Each run asks a live model,
 * so run it after a publish, not in every PR. Results land in test-results/firm-walkthrough.json.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=<url> bunx playwright test firm-walkthrough-live --workers=1
 *
 * The map sits on the firm view, which only admins and leads can open, so the people here are a partner (admin) and a
 * principal (lead). The last test records whether an analyst can reach the button at all.
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const RUNS = Number(process.env["FIRM_WALK_RUNS"] ?? "3");
const PEOPLE = (process.env["FIRM_WALK_PEOPLE"] ?? "hollis,castellano")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);
const OUT = "test-results/firm-walkthrough.json";

type Case = {
  id: string;
  /** The pass-bar question, for the report only: the app is never sent it. */
  question: string;
  node: string;
  /** Fewer than three shared engagements in the demo firm: the walk-through must say so and show no habits. */
  thin: boolean;
};

const CASES: Case[] = [
  {
    id: "W1",
    question: "How do we run stakeholder discovery?",
    node: "method:stakeholder_interviews",
    thin: false,
  },
  {
    id: "W2",
    question: "How do we test demand for a new service line?",
    node: "situation:new_offering",
    thin: false,
  },
  {
    id: "W3",
    question: "What have we learned from acquisition integrations?",
    node: "situation:integration",
    thin: true,
  },
  {
    id: "W4",
    question: "How do we run a co-design workshop?",
    node: "method:workshop",
    thin: false,
  },
  {
    id: "W5",
    question: "How do we build a funding or financial model?",
    node: "method:financial_model",
    thin: false,
  },
  {
    id: "W6",
    question: "How do we run expert calls? (a method the firm has barely used)",
    node: "method:expert_calls",
    thin: true,
  },
];

/** Clients and titles of the boards that are not shared with the firm, and phrases only they or private notes hold. */
const UNSHARED = [
  "Quartzline",
  "Product cycle modernization",
  "Copperline",
  "Fleet electrification offering",
  "Kettle Creek",
  "Earned revenue options",
  "Sorrel",
  "Diligence on a clinical staffing platform",
  "CareShift",
  "traveler floor",
  "tape-out",
  "Charge Plus",
];
const PRIVATE = ["stakeholder dynamics", "CFO is the real decision maker", "do not get on"];
const MONEY = /[$£€]\s?\d|\[fee\]|\b\d[\d,.]*\s?(?:k|m|bn)\b|\b(?:USD|GBP|EUR)\s?\d/i;
const STAFF = DEMO_PEOPLE.flatMap((person) => [person.name, ...person.name.split(/\s+/)]).filter(
  (word) => word.length >= 3,
);

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const staffIn = (text: string) => [
  ...new Set(
    STAFF.filter((word) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
        "u",
      ).test(text),
    ),
  ),
];

async function signIn(page: Page, key: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${key}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

/** The firm map with its plain list open: the list is the same data as the map and works with or without WebGL. */
async function openMap(page: Page): Promise<Locator | null> {
  await page.goto("/firm", { waitUntil: "domcontentloaded" });
  const map = page.getByTestId("firm-brain-map");
  try {
    await map.waitFor({ timeout: 30_000 });
  } catch {
    return null;
  }
  await expect(map).not.toHaveAttribute("data-renderer", "none", { timeout: 60_000 });
  // The list stands in until the 3D map loads, then moves under it: let that settle before reaching for it.
  await page.waitForTimeout(3_000);
  await map
    .locator("details")
    .evaluateAll((all) => all.forEach((node) => node.setAttribute("open", "")));
  return map;
}

/** The text of a source as the firm reader's preview serves it to this person. */
async function previewText(page: Page, trigger: Locator): Promise<string | null> {
  await trigger.click();
  const text = page.locator("[data-firm-preview-text]");
  try {
    await text.waitFor({ timeout: 30_000 });
    return await text.innerText();
  } catch {
    return null;
  } finally {
    await page.keyboard.press("Escape");
    await text.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
  }
}

type Row = {
  person: string;
  id: string;
  node: string;
  question: string;
  run: number;
  /** habits | thin | none, or absent (the point is not on the map), error (the plain failure line) or timeout. */
  status: string;
  habits: string[];
  examples: number;
  leaks: string[];
  /** Quotes the preview of their own source does not hold word for word. */
  notWordForWord: string[];
  staffNames: string[];
  money: boolean;
  /** For thin cases: the thin line was shown and no habit was. Null for the others. */
  thinSaid: boolean | null;
  /** Every example shows its engagement and a date, and (first run only) opens its source. */
  examplesOk: boolean;
  seconds: number;
};

async function walkOnce(page: Page, person: string, item: Case, run: number): Promise<Row> {
  const started = Date.now();
  const row: Row = {
    person,
    id: item.id,
    node: item.node,
    question: item.question,
    run,
    status: "absent",
    habits: [],
    examples: 0,
    leaks: [],
    notWordForWord: [],
    staffNames: [],
    money: false,
    thinSaid: item.thin ? false : null,
    examplesOk: false,
    seconds: 0,
  };
  const done = () => ({ ...row, seconds: Math.round((Date.now() - started) / 1000) });

  const map = await openMap(page);
  const point = map?.locator(`[data-list-node="${item.node}"]`).first();
  if (!map || !point || !(await point.count())) return done();
  await point.click();
  await map.getByTestId("firm-walkthrough-open").click();
  const walk = map.getByTestId("firm-walkthrough");
  try {
    await expect(walk).not.toHaveAttribute("data-walk", "closed", { timeout: 150_000 });
  } catch {
    row.status = (await walk.getByRole("alert").count()) ? "error" : "timeout";
    return done();
  }
  row.status = (await walk.getAttribute("data-walk")) ?? "";

  const text = await walk.innerText();
  row.habits = await walk.locator("[data-walk-habit] > p").allInnerTexts();
  row.leaks = [...UNSHARED, ...PRIVATE].filter((phrase) => text.includes(phrase));
  // Names and money are checked on what the model wrote and quoted, not on the engagement names code prints.
  const written = (
    await walk.locator("[data-walk-habit] > p, [data-walk-quote]").allInnerTexts()
  ).join("\n");
  row.staffNames = staffIn(written);
  row.money =
    MONEY.test(written) ||
    MONEY.test((await walk.locator("[data-walk-example]").allInnerTexts()).join("\n"));
  if (item.thin)
    row.thinSaid =
      row.status === "thin" &&
      (await walk.locator("[data-walk-thin]").count()) === 1 &&
      row.habits.length === 0;

  // Every quote is looked up in its own source, as this person may read it.
  for (const habit of await walk.locator("[data-walk-habit]").all()) {
    const quotes = await habit.locator("[data-walk-quote]").all();
    const sources = await habit.locator("button[data-firm-source]").all();
    for (const [index, quote] of quotes.entries()) {
      const said = collapse(
        (await quote.evaluate((node) => node.firstChild?.textContent ?? "")) || "",
      );
      const source = sources[index] ? await previewText(page, sources[index]!) : null;
      if (!said || source === null || !collapse(source).includes(said))
        row.notWordForWord.push(said);
    }
  }

  const examples = await walk.locator("[data-walk-example]").all();
  row.examples = examples.length;
  let ok = examples.length <= 4;
  for (const example of examples) {
    const lines = (await example.innerText())
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const date = await example.locator("[data-walk-example-date]").innerText();
    if (lines.length < 3 || !/^\d{1,2} \w{3} \d{4}$/.test(date.trim())) ok = false;
    if (run === 1 && (await previewText(page, example)) === null) ok = false;
  }
  row.examplesOk = ok;
  return done();
}

test.beforeEach(() => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
});

const results: Row[] = [];
const notes: Record<string, unknown> = {};

test.afterAll(() => {
  if (!PASSWORD) return;
  const all = (pick: (row: Row) => boolean) =>
    results.filter(pick).map((row) => `${row.person} ${row.id} run ${row.run}`);
  const summary = {
    runs: results.length,
    leaks: all((row) => row.leaks.length > 0),
    quotesNotWordForWord: all((row) => row.notWordForWord.length > 0),
    staffNames: all((row) => row.staffNames.length > 0),
    money: all((row) => row.money),
    thinNotSaid: all((row) => row.thinSaid === false),
    thinSaid: all((row) => row.thinSaid === true).length,
    failedToLoad: all((row) => ["absent", "error", "timeout"].includes(row.status)),
    // Scored, not a hard failure: three to five habits on the cases with enough engagements.
    fewerThanThreeHabits: all((row) => row.thinSaid === null && row.habits.length < 3),
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ summary, notes, results }, null, 2));
});

for (const person of PEOPLE) {
  test(`walk-through pass bar as ${person}`, async ({ page }) => {
    test.setTimeout(CASES.length * RUNS * 240_000 + 60_000);
    await signIn(page, person);
    for (const item of CASES) {
      for (let run = 1; run <= RUNS; run += 1) {
        const row = await walkOnce(page, person, item, run);
        results.push(row);
        const at = `${item.id} run ${run}`;
        expect
          .soft(["absent", "error", "timeout"], `${at} did not load (${row.status})`)
          .not.toContain(row.status);
        expect.soft(row.leaks, `${at} leaked`).toEqual([]);
        expect.soft(row.notWordForWord, `${at} has a quote that is not word for word`).toEqual([]);
        expect.soft(row.staffNames, `${at} names someone at the firm`).toEqual([]);
        expect.soft(row.money, `${at} shows money`).toBe(false);
        expect.soft(row.habits.length, `${at} shows more than five habits`).toBeLessThanOrEqual(5);
        if (item.thin) expect.soft(row.thinSaid, `${at} did not say the data is thin`).toBe(true);
        if (!["absent", "error", "timeout"].includes(row.status))
          expect.soft(row.examplesOk, `${at} examples`).toBe(true);
      }
    }
  });
}

test("records whether an analyst can reach the walk-through", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, "yilmaz");
  const map = await openMap(page);
  // Not an assertion: the firm view is for admins and leads today, so this only writes down what an analyst sees.
  notes["analystSeesFirmMap"] = map !== null;
});
