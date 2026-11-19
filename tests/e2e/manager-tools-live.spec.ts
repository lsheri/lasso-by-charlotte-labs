import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Firm Brain Build Spec step 8, manager tools, on the deployed site with the Kestrel Bay demo firm. Hollis (admin)
 * pins the Medrova engagement on the Marrowfield board; Quinn, who owns Marrowfield, reads it and has no way to see
 * who pinned; the picker offers only engagements shared with the firm; Yilmaz and Pereira ask the database directly
 * and get only what the rules allow, never who pinned or who marked; Hollis marks and unmarks an exemplar; the
 * common questions card shows its empty state. Every write is removed again, even when a step fails. Writes
 * test-results/manager-tools.json.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... \
 *     bunx playwright test manager-tools-live
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MARROWFIELD = process.env["DEMO_BOARD"] ?? "4a4abc70-32af-4cdb-8772-3850f9d673bc";
const MEDROVA = process.env["MEDROVA_BOARD"] ?? "d108b328-7c12-47b0-9a1a-f22de64179fc";
const URL_BASE = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const API_KEY = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
const EMPTY = "Not enough people have asked yet. A kind of question appears here once five people have asked it.";
const NAMES = /Hollis|Quinn|Yilmaz|Pereira|pinned by|added by|marked by/i;

type Step = { person: string; step: string; ok: boolean; saw: string };
const steps: Step[] = [];

function record(person: string, step: string, ok: boolean, saw: string) {
  steps.push({ person, step, ok, saw: saw.replace(/\s+/g, " ").slice(0, 300) });
  expect.soft(ok, `${person}: ${step} (${saw.slice(0, 160)})`).toBe(true);
}

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

type Rest = { status: number; rows: Record<string, unknown>[] };

/** Asks PostgREST directly from the person's own signed-in browser session, with the address and key the app uses. */
async function rest(page: Page, path: string, init: { method?: string; body?: unknown } = {}): Promise<Rest> {
  return page.evaluate(
    async ({ path, base, key, method, body }) => {
      const entry = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (!entry) throw new Error("no signed in session in this browser");
      const raw = localStorage.getItem(entry) as string;
      const parsed = JSON.parse(raw.startsWith("base64-") ? atob(raw.slice(7)) : raw);
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
      const response = await fetch(`${base}/rest/v1/${path}`, {
        method,
        headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const parsedBody: unknown = await response.json().catch(() => null);
      return { status: response.status, rows: Array.isArray(parsedBody) ? (parsedBody as Record<string, unknown>[]) : [] };
    },
    { path, base: URL_BASE, key: API_KEY, method: init.method ?? "GET", body: init.body },
  );
}

async function openReadingList(page: Page) {
  await page.goto(`/engagements/${MARROWFIELD}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("menuitem", { name: "Reading list" }).click();
  const dialog = page.getByTestId("reading-list");
  await dialog.waitFor({ timeout: 30_000 });
  await expect(dialog.getByRole("status")).toHaveCount(0, { timeout: 30_000 });
  return dialog;
}

/** Removes the Medrova pin from Marrowfield if it is there. Used for the step itself and for cleanup. */
async function removeMedrovaPin(page: Page): Promise<boolean> {
  const dialog = await openReadingList(page);
  const pinned = await rest(page, `board_reading_pins?select=thread_id&board_id=eq.${MARROWFIELD}&thread_id=eq.${MEDROVA}`);
  if (pinned.rows.length === 0) return false;
  const before = await dialog.locator("[data-reading-pin]").count();
  const titles = await rest(page, `engagements?select=title&id=eq.${MEDROVA}`);
  const title = String(titles.rows[0]?.["title"] ?? "");
  await dialog.getByRole("button", { name: `Remove ${title} from the reading list` }).click();
  await expect(dialog.locator("[data-reading-pin]")).toHaveCount(before - 1, { timeout: 30_000 });
  return true;
}

test("manager tools: a reading list, an exemplar mark and common questions, with nobody named", async ({ browser }) => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
  test.skip(!URL_BASE || !API_KEY, "needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
  test.setTimeout(10 * 60_000);
  const hollis = await as(browser, "hollis");
  const quinn = await as(browser, "quinn");
  const yilmaz = await as(browser, "yilmaz");
  const pereira = await as(browser, "pereira");
  const report: Record<string, unknown> = {};
  let pinnedHere = false;
  let markedHere = false;

  try {
    // 1. Nobody but the server writes: a member's own insert is refused. Done before the pin so a refusal is not a
    // duplicate in disguise. Cleanup removes this pin too, should the database ever let it through.
    const write = await rest(yilmaz, "board_reading_pins", { method: "POST", body: { board_id: MARROWFIELD, thread_id: MEDROVA, slot: 3 } });
    record("yilmaz", "a direct insert into the reading list is refused", write.status === 401 || write.status === 403, `status ${write.status}`);
    const mark = await rest(yilmaz, "firm_exemplars", { method: "POST", body: { engagement_id: MEDROVA, work_item_id: MEDROVA } });
    record("yilmaz", "a direct insert of an exemplar mark is refused", mark.status === 401 || mark.status === 403, `status ${mark.status}`);

    // 2. The picker offers only engagements shared with the firm, and never this board itself.
    const dialog = await openReadingList(hollis);
    const already = (await rest(hollis, `board_reading_pins?select=thread_id&board_id=eq.${MARROWFIELD}&thread_id=eq.${MEDROVA}`)).rows.length > 0;
    report["alreadyPinnedAtStart"] = already;
    const picker = dialog.getByLabel("Add an engagement");
    if (!already) {
      await picker.waitFor({ timeout: 15_000 });
      const offered = await picker.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
      const boards = await rest(hollis, "engagements?select=id,shared_with_firm,archived_at&limit=1000");
      const unshared = boards.rows.filter((board) => board["shared_with_firm"] !== true || board["archived_at"] !== null).map((board) => String(board["id"]));
      const leaked = offered.filter((id) => unshared.includes(id));
      report["picker"] = { offered: offered.length, unsharedBoardsHollisCanSee: unshared.length };
      record("hollis", "an unshared board is not offered for pinning", leaked.length === 0 && !offered.includes(MARROWFIELD), `offered ${offered.length}, unshared offered ${leaked.length}, unshared known ${unshared.length}`);
      record("hollis", "Medrova, shared with the firm, is offered", offered.includes(MEDROVA), `offered ${offered.length}`);

      // 3. Hollis pins Medrova on Marrowfield.
      const before = await dialog.locator("[data-reading-pin]").count();
      await picker.selectOption(MEDROVA);
      await dialog.getByRole("button", { name: "Add", exact: true }).click();
      await expect(dialog.locator("[data-reading-pin]")).toHaveCount(before + 1, { timeout: 30_000 });
      pinnedHere = true;
    }
    const hollisText = await dialog.innerText();
    record("hollis", "the pin is on the list, with nobody named", !NAMES.test(hollisText), hollisText);

    // 4. Hollis marks and unmarks an exemplar from the pinned engagement's preview.
    const opener = dialog.getByRole("button", { name: /^Open / }).last();
    if ((await opener.count()) > 0) {
      await opener.click();
      const toggle = hollis.locator("[data-exemplar-toggle]");
      await toggle.waitFor({ timeout: 30_000 });
      const startedMarked = (await toggle.innerText()).trim() === "Remove exemplar mark";
      report["exemplarMarkedAtStart"] = startedMarked;
      if (!startedMarked) {
        await toggle.click();
        await expect(toggle).toHaveText("Remove exemplar mark", { timeout: 30_000 });
        markedHere = true;
        const badge = await hollis.locator("[role=dialog] [data-exemplar]").count();
        record("hollis", "marked work carries the Exemplar badge", badge > 0, `badges ${badge}`);
        const marks = await rest(yilmaz, `firm_exemplars?select=work_item_id&engagement_id=eq.${MEDROVA}`);
        report["yilmazSeesMarks"] = marks.rows.length;
        await toggle.click();
        await expect(toggle).toHaveText("Mark as exemplar", { timeout: 30_000 });
        markedHere = false;
        record("hollis", "the mark comes off again", (await hollis.locator("[role=dialog] [data-exemplar]").count()) === 0, "unmarked");
      }
      await hollis.keyboard.press("Escape");
    } else {
      record("hollis", "the pinned engagement has something to open", false, "no Open button");
    }

    // 5. Quinn owns Marrowfield: reads the list in the app and from the database.
    const quinnDialog = await openReadingList(quinn);
    const quinnText = await quinnDialog.innerText();
    const quinnRows = await rest(quinn, `board_reading_pins?select=thread_id,slot&board_id=eq.${MARROWFIELD}`);
    record("quinn", "reads the pin on her own board", quinnRows.rows.some((row) => row["thread_id"] === MEDROVA), `rows ${quinnRows.rows.length}`);
    record("quinn", "sees nobody named on the list", !NAMES.test(quinnText), quinnText);

    // 6. Direct reads. Who pinned and who marked are not readable by anyone signed in; star is refused with them.
    for (const [name, page] of [["quinn", quinn], ["yilmaz", yilmaz], ["pereira", pereira], ["hollis", hollis]] as const) {
      const who = await rest(page, "board_reading_pins?select=pinned_by");
      const star = await rest(page, "board_reading_pins?select=*");
      const marker = await rest(page, "firm_exemplars?select=marked_by");
      const markStar = await rest(page, "firm_exemplars?select=*");
      const refused = [who, star, marker, markStar].every((answer) => (answer.status === 401 || answer.status === 403) && answer.rows.length === 0);
      record(name, "cannot read who pinned or who marked", refused, `statuses ${[who, star, marker, markStar].map((answer) => answer.status).join(",")}`);
      const pins = await rest(page, "board_reading_pins?select=board_id,thread_id,slot&limit=1000");
      const members = await rest(page, `engagements?select=id&id=in.(${[...new Set(pins.rows.map((row) => String(row["board_id"])))].join(",") || MARROWFIELD})`);
      const readable = new Set(members.rows.map((row) => String(row["id"])));
      const strange = pins.rows.filter((row) => !readable.has(String(row["board_id"])));
      report[`${name}Pins`] = { rows: pins.rows.length, onBoardsTheyCannotRead: strange.length };
      record(name, "reads pins only on boards they can read", pins.status === 200 && strange.length === 0, `rows ${pins.rows.length}, strange ${strange.length}`);
    }

    // 7. Common questions: the empty state, in its exact words, for an admin; no card for an analyst.
    await hollis.goto("/firm", { waitUntil: "domcontentloaded" });
    const card = hollis.getByTestId("common-questions");
    await card.waitFor({ timeout: 60_000 });
    await expect(card.getByRole("status")).toHaveCount(0, { timeout: 30_000 });
    const cardText = await card.innerText();
    const lines = await card.locator("[data-common-question]").count();
    report["commonQuestions"] = { lines };
    record("hollis", "common questions shows the empty state, or only bands", lines === 0 ? cardText.includes(EMPTY) : !/\b[0-4] people\b/.test(cardText), cardText);
    record("hollis", "common questions names nobody", !NAMES.test(cardText), cardText);
    const org = String((await rest(hollis, `engagements?select=org_id&id=eq.${MARROWFIELD}`)).rows[0]?.["org_id"] ?? "");
    const direct = await rest(yilmaz, "rpc/firm_common_question_kinds", { method: "POST", body: { p_org: org } });
    report["yilmazCommonQuestionsRpc"] = { status: direct.status, rows: direct.rows.length };
    record("yilmaz", "the common questions function gives an analyst nothing", direct.rows.length === 0, `status ${direct.status}, rows ${direct.rows.length}`);
  } finally {
    // Take back everything this run wrote, whatever failed above.
    try {
      if (markedHere) {
        const dialog = await openReadingList(hollis);
        await dialog.getByRole("button", { name: /^Open / }).last().click();
        const toggle = hollis.locator("[data-exemplar-toggle]");
        await toggle.waitFor({ timeout: 30_000 });
        if ((await toggle.innerText()).trim() === "Remove exemplar mark") {
          await toggle.click();
          await expect(toggle).toHaveText("Mark as exemplar", { timeout: 30_000 });
        }
        await hollis.keyboard.press("Escape");
      }
      if (pinnedHere) report["pinRemoved"] = await removeMedrovaPin(hollis);
      report["cleanedUp"] = true;
    } catch (error) {
      report["cleanedUp"] = false;
      report["cleanupError"] = error instanceof Error ? error.message.slice(0, 200) : "unknown";
    }
    report["steps"] = steps;
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/manager-tools.json", JSON.stringify(report, null, 2));
  }

  expect(report["cleanedUp"], "every write was taken back").toBe(true);
  for (const page of [hollis, quinn, yilmaz, pereira]) await page.context().close();
});
