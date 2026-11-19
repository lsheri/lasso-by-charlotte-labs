import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Junior tools (Firm Brain Build Spec step 7), run as the Kestrel Bay analyst against a deployed build with
 * company-brain on. She opens a walk-through from Home, runs Prepare me for a role the firm has spoken to and for one
 * it has not, cites a line into one of her own items, and checks the line and its link in the item reader. The cited
 * line, and any offer she dismissed on the way, are removed again in a finally, so the demo firm ends as it began.
 * Not exercised here: when a source stops being shared, its cited words are deleted on the owner's next read (unit
 * tests cover it); this check never turns sharing off.
 * Each step records pass or fail with what it saw in test-results/junior-tools.json.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=<url> bunx playwright test junior-tools-live --workers=1
 *
 * The once-only offer has no "show it again" control in the app, so that step runs only when the spec can put the
 * item back itself: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (the public values the app ships with) and it
 * clears the mark on her own item with her own session. Without them the offer is looked at but never pressed.
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const PERSON = process.env["JUNIOR_PERSON"] ?? "yilmaz";
const WALK = process.env["JUNIOR_WALK"] ?? "method:stakeholder_interviews";
const ROLE_WITH_CALLS = process.env["JUNIOR_ROLE_WITH_CALLS"] ?? "chief_medical_officer";
const ROLE_WITHOUT_CALLS = process.env["JUNIOR_ROLE_WITHOUT_CALLS"] ?? "chief_nursing_officer";
const SUPABASE_URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
const SUPABASE_KEY =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";
const OUT = "test-results/junior-tools.json";
const MONEY = /[$£€]\s?\d|\b(?:USD|GBP|EUR)\s?\d/i;

type Step = { step: string; ok: boolean; saw: string };
const steps: Step[] = [];

function record(step: string, ok: boolean, saw: string) {
  steps.push({ step, ok, saw: saw.replace(/\s+/g, " ").slice(0, 300) });
  expect.soft(ok, `${step} (${saw.slice(0, 120)})`).toBe(true);
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

async function signIn(page: Page, key: string): Promise<void> {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${key}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

async function openHome(page: Page): Promise<Locator> {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const tools = page.getByTestId("junior-tools");
  await tools.waitFor({ timeout: 60_000 });
  return tools;
}

/** The text of a source as the firm reader's preview serves it to this person, or null when it will not open. */
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

async function prepare(page: Page, role: string): Promise<{ status: string; box: Locator }> {
  const tools = await openHome(page);
  const box = tools.getByTestId("prepare-me");
  const pick = box.getByTestId("prepare-me-role");
  await expect(pick).toBeEnabled({ timeout: 60_000 });
  await pick.selectOption(role);
  await box.getByTestId("prepare-me-submit").click();
  await expect(box).not.toHaveAttribute("data-prepare", "closed", { timeout: 90_000 });
  return { status: (await box.getAttribute("data-prepare")) ?? "", box };
}

/** Open one of her items in the All work reader by its title. */
async function openInAllWork(page: Page, title: string): Promise<boolean> {
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  const row = page.getByLabel(title, { exact: true }).first();
  try {
    await row.waitFor({ timeout: 60_000 });
    await row.click();
    return true;
  } catch {
    return false;
  }
}

/** Her session's access token, read from the browser, for the one clean-up the app has no control for. */
async function accessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const raw = window.localStorage.getItem(window.localStorage.key(index) ?? "");
      if (!raw || !raw.includes("access_token")) continue;
      try {
        const token = (JSON.parse(raw) as { access_token?: unknown }).access_token;
        if (typeof token === "string") return token;
      } catch {
        // Not a session entry.
      }
    }
    return null;
  });
}

/** Clear the offer mark on her own item, with her own session, leaving every other key of its meta as it was. */
async function clearOfferMark(page: Page, itemId: string): Promise<string> {
  const token = await accessToken(page);
  if (!token) return "no session to clear it with";
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const url = `${SUPABASE_URL}/rest/v1/work_items?id=eq.${itemId}`;
  const read = await page.request.get(`${url}&select=meta`, { headers });
  if (!read.ok()) return `read failed (${read.status()})`;
  const rows = (await read.json()) as Array<{ meta: Record<string, unknown> | null }>;
  const meta = { ...(rows[0]?.meta ?? {}) };
  if (!("walk_offer" in meta)) return "nothing to clear";
  delete meta["walk_offer"];
  const write = await page.request.patch(url, { headers: { ...headers, Prefer: "return=minimal" }, data: { meta } });
  return write.ok() ? "cleared" : `write failed (${write.status()})`;
}

test.beforeEach(() => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
});

test.afterAll(() => {
  if (!PASSWORD) return;
  mkdirSync("test-results", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ person: PERSON, steps }, null, 2));
});

test("an analyst reads a walk-through, prepares for two roles and cites a line into her own work", async ({
  page,
}) => {
  test.setTimeout(12 * 60_000);
  await signIn(page, PERSON);

  // 1. A walk-through from Home, without the firm view.
  const tools = await openHome(page);
  const pick = tools.getByTestId("how-we-do-this-pick");
  await expect(pick).toBeEnabled({ timeout: 60_000 });
  const offered = await pick.locator("option").evaluateAll((all) => all.map((node) => (node as HTMLOptionElement).value));
  record("Home lists the walk-through she will open", offered.includes(WALK), offered.join(" "));
  await pick.selectOption(WALK);
  const walk = tools.getByTestId("firm-walkthrough");
  let walkStatus = "timeout";
  try {
    await expect(walk).not.toHaveAttribute("data-walk", "closed", { timeout: 150_000 });
    walkStatus = (await walk.getAttribute("data-walk")) ?? "";
  } catch {
    if (await walk.getByRole("alert").count()) walkStatus = "error";
  }
  record("the walk-through opens from Home", ["habits", "thin", "none"].includes(walkStatus), walkStatus);

  // 2. Prepare me for a role the firm has not spoken to: it says so and offers the general walk-through.
  const none = await prepare(page, ROLE_WITHOUT_CALLS);
  const nothing = none.box.locator("[data-prepare-nothing]");
  record(
    "a role with no past calls says so",
    ["none", "empty"].includes(none.status) && (await nothing.count()) === 1,
    `${none.status}: ${await none.box.innerText()}`,
  );
  record(
    "and offers the general walk-through",
    (await nothing.getByTestId("firm-walkthrough-open").count()) === 1,
    await nothing.innerText().catch(() => ""),
  );

  // 3. Prepare me for a role with calls: entries with an engagement and a date, no money, each opening its source.
  const some = await prepare(page, ROLE_WITH_CALLS);
  const entries = some.box.locator("[data-prepare-entry]");
  const count = await entries.count();
  record("a role with past calls shows what was asked or covered", ["questions", "covered"].includes(some.status) && count > 0, `${some.status}, ${count} entries`);
  const shown = await some.box.innerText();
  record("Prepare me shows no money", !MONEY.test(shown), shown);
  let dated = count > 0;
  for (const entry of await entries.all()) {
    const engagement = collapse(await entry.locator("[data-prepare-engagement]").innerText());
    const date = collapse(await entry.locator("[data-prepare-date]").innerText());
    if (!engagement || !/^\d{1,2} \w{3} \d{4}$/.test(date)) dated = false;
  }
  record("each entry names its engagement and date", dated, `${count} entries`);
  const firstSource = some.box.locator("[data-prepare-source]").first();
  const opened = (await firstSource.count()) ? await previewText(page, firstSource) : null;
  record("an entry opens its source", opened !== null, opened ?? "the preview did not open");

  // 4. Cite a line into one of her own items, then take it out again whatever happens.
  const line = some.box.locator("[data-prepare-line]").first();
  const quote = collapse(await line.innerText().catch(() => ""));
  const citeButton = some.box.locator("[data-cite-this]").first();
  let targetId = "";
  let targetTitle = "";
  let offerPressed = false;
  try {
    if (!(await citeButton.count())) {
      record("a line can be cited", false, "no Cite this button under any line");
      return;
    }
    await citeButton.click();
    const dialog = page.getByTestId("cite-this-dialog");
    const target = dialog.getByTestId("cite-this-target");
    await expect(target).toBeEnabled({ timeout: 60_000 });
    const options = await target
      .locator("option")
      .evaluateAll((all) => all.map((node) => ({ value: (node as HTMLOptionElement).value, text: node.textContent ?? "" })));
    const chosen = options.find((option) => option.value);
    if (!chosen) {
      record("she has an item of her own to cite into", false, "the picker listed none");
      return;
    }
    targetId = chosen.value;
    targetTitle = chosen.text.trim();
    const cited = collapse(await dialog.locator("[data-cite-quote]").innerText());
    await target.selectOption(targetId);
    await dialog.getByTestId("cite-this-submit").click();
    await expect(dialog.getByRole("status")).toBeVisible({ timeout: 60_000 });
    record("the line is added to her item", true, `${cited} -> ${targetTitle}`);
    await dialog.getByRole("button", { name: "Done" }).first().click();

    // 5. The line and its link, in the item reader on All work.
    const inReader = await openInAllWork(page, targetTitle);
    record("her item opens from All work", inReader, targetTitle);
    const list = page.getByTestId("item-citations");
    await list.waitFor({ timeout: 60_000 }).catch(() => {});
    const live = list.locator('[data-cited-line="live"]');
    const lines = (await live.locator("blockquote").allInnerTexts()).map(collapse);
    record("the cited line is on her item, word for word", lines.includes(cited) || lines.includes(quote), lines.join(" | "));
    const link = live.locator("[data-cited-open]").first();
    const source = (await link.count()) ? await previewText(page, link) : null;
    record(
      "its link opens the source, which holds the words",
      source !== null && collapse(source).toLowerCase().includes(cited.toLowerCase()),
      source ?? "the preview did not open",
    );

    // 6. The once-only offer, where this item has one. Pressed only when the spec can put it back.
    const offer = page.getByTestId("walk-offer");
    const hasOffer = (await offer.count()) > 0;
    steps.push({ step: "the item reader shows the walk-through offer", ok: true, saw: hasOffer ? "shown" : "not shown for this item" });
    if (hasOffer && SUPABASE_URL && SUPABASE_KEY) {
      await offer.locator("[data-walk-offer-dismiss]").click();
      offerPressed = true;
      await expect(offer).toHaveCount(0, { timeout: 30_000 });
      await openInAllWork(page, targetTitle);
      await page.getByTestId("item-citations").waitFor({ timeout: 60_000 }).catch(() => {});
      record("a dismissed offer stays gone after a reload", (await page.getByTestId("walk-offer").count()) === 0, "reloaded");
    }
  } finally {
    // Take the cited line out again, and the dismissal if one was made.
    if (targetTitle) {
      let removed = 0;
      try {
        if (await openInAllWork(page, targetTitle)) {
          const list = page.getByTestId("item-citations");
          await list.waitFor({ timeout: 30_000 }).catch(() => {});
          for (let guard = 0; guard < 5; guard += 1) {
            const lines = await list.locator("[data-cited-line]").all();
            let mine: Locator | null = null;
            for (const row of lines) {
              const words = collapse(await row.locator("blockquote").innerText().catch(() => ""));
              if (words && (words === quote || quote.includes(words) || words.includes(quote))) mine = row;
            }
            if (!mine) break;
            const before = lines.length;
            await mine.locator("[data-cited-remove]").click();
            await expect(list.locator("[data-cited-line]")).toHaveCount(before - 1, { timeout: 30_000 });
            removed += 1;
          }
        }
      } catch (error) {
        steps.push({ step: "clean-up: remove the cited line", ok: false, saw: String(error).slice(0, 300) });
      }
      steps.push({ step: "clean-up: cited line removed", ok: removed > 0, saw: `${removed} removed from ${targetTitle}` });
      expect.soft(removed, "the cited line was removed again").toBeGreaterThan(0);
    }
    if (offerPressed && targetId) {
      const cleared = await clearOfferMark(page, targetId).catch((error: unknown) => String(error));
      steps.push({ step: "clean-up: offer dismissal cleared", ok: cleared === "cleared", saw: cleared });
      expect.soft(cleared, "the dismissal was cleared again").toBe("cleared");
    }
  }
});
