import { expect, test, type Page } from "@playwright/test";

import { PASSWORD, signIn } from "./qa-helpers";

const EM = "qa.company.em@qaprobe.test";
const COACH = "qa.company.coach@qaprobe.test";
const POSTER_DIR = "public/videos";

test.use({ viewport: { width: 1440, height: 900 } });

async function settle(page: Page): Promise<void> {
  await page.locator("[data-sonner-toast], [data-sonner-toaster]").evaluateAll((nodes) => {
    for (const node of nodes) node.remove();
  });
  await page.waitForTimeout(250);
}

async function poster(page: Page, id: string): Promise<void> {
  await settle(page);
  await page.screenshot({ path: `${POSTER_DIR}/poster-${id}.jpg`, type: "jpeg", quality: 82 });
}

async function softPoster(
  page: Page,
  id: string,
  build: () => Promise<void>,
): Promise<void> {
  let result = "PASS";
  try {
    await build();
  } catch (error) {
    result = `SOFT-FAIL ${(error as Error).message.split("\n")[0]}`;
  }
  await poster(page, id);
  console.log(`${result} poster-${id} ${page.url()}`);
}

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function pasteNamedThread(page: Page, title: string, text: string): Promise<void> {
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  if (await page.getByText(title, { exact: true }).count()) return;
  await page.getByRole("button", { name: /paste a thread/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Paste a ChatGPT, Claude, or Gemini conversation").fill(text);
  await dialog.locator("#thread-title").fill(title);
  await dialog.getByRole("button", { name: /^claude$/i }).click();
  await dialog.getByRole("button", { name: /save thread/i }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
}

test("poster-inbox", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, EM, /sign in/i);
  await softPoster(page, "inbox", async () => {
    await pasteNamedThread(
      page,
      "Northwind pricing floor",
      "Me: Northwind pricing starts at 4,200 per seat for the pilot.\nAssistant: The pilot floor is 4,200 per seat and the ops team gave it to us.",
    );
    await pasteNamedThread(
      page,
      "Northwind pricing readout",
      "Me: Keep the Northwind pricing floor visible in the readout.\nAssistant: I will cite the second thread beside the 4,200 per seat figure.",
    );
    await page.goto("/work", { waitUntil: "networkidle" });
    await expect(page.getByText(/Northwind pricing/i).first()).toBeVisible({ timeout: 60_000 });
  });
});

test("poster-find-it", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, EM, /sign in/i);
  await softPoster(page, "find-it", async () => {
    await page.goto("/find-it", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /a thread i lost/i }).click();
    await page.getByLabel("What are you looking for?").fill("Northwind pricing");
    await page.getByRole("button", { name: /^Find it$/ }).click();
    const result = page.getByText(/Northwind pricing/i).first();
    await expect(result).toBeVisible({ timeout: 60_000 });
    const open = page.getByRole("button", { name: /^Open$/ }).first();
    if (await open.count()) {
      await open.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
    }
  });
});

test("poster-decisions", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, EM, /sign in/i);
  await softPoster(page, "decisions", async () => {
    await page.goto("/decisions", { waitUntil: "networkidle" });
    const draftFilter = page.getByRole("button", { name: /awaiting your review/i });
    await draftFilter.click();
    const draftAction = page.getByRole("button", { name: /confirm (this call|as written)/i }).first();
    if (!(await draftAction.count())) {
      await page.getByRole("button", { name: /everything/i }).click();
      await expect(page.getByText(/Northwind|pilot|decision/i).first()).toBeVisible({ timeout: 30_000 });
      console.log("SOFT-FAIL poster-decisions no drafted call was available; captured the populated call log");
    } else {
      await expect(draftAction).toBeVisible();
    }
  });
});

test("poster-coach-note", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, COACH, /sign in/i);
  await softPoster(page, "coach-note", async () => {
    await page.goto("/coaching", { waitUntil: "networkidle" });
    const northwind = page.getByRole("button").filter({ hasText: "QA Northwind" }).first();
    await expect(northwind).toBeVisible({ timeout: 60_000 });
    await northwind.click();
    await page.waitForURL(/\/coaching\//, { timeout: 60_000 });

    const existing = page.getByText(/Your pricing floor came from the second thread/i).first();
    if (!(await existing.count())) {
      const composer = page.locator("section").filter({ hasText: "Write a coaching note" }).last();
      await composer.getByRole("button", { name: /^(Workstream|Task)$/ }).first().click();
      const picker = composer.getByLabel(/which (workstream|task)/i);
      if (await picker.count()) await picker.selectOption({ index: 1 });
      const fields = composer.locator("textarea");
      await fields.nth(0).fill("Your pricing floor came from the second thread, worth saying so in the readout");
      await fields.nth(1).fill("Name that source beside the figure.");
      await fields.nth(2).fill("Keep the reasoning visible.");
      const cite = composer.locator('input[type="checkbox"]').first();
      if (await cite.count()) await cite.check();
      await composer.getByRole("button", { name: /share note/i }).click();
      await expect(fields.nth(0)).toHaveValue("", { timeout: 60_000 });
    }

    await signOut(page);
    await signIn(page, EM, /sign in/i);
    await page.goto("/coach-notes", { waitUntil: "networkidle" });
    await expect(page.getByText(/notes from your coach/i).first()).toBeVisible({ timeout: 60_000 });
    const circle = page.getByLabel(/new note from/i).first();
    if (await circle.count()) await circle.click();
    await expect(page.getByText(/pricing floor came from the second thread/i).first()).toBeVisible({ timeout: 60_000 });
  });
});

test("poster-one-on-one", async ({ page }) => {
  test.setTimeout(210_000);
  page.setDefaultTimeout(30_000);
  await signIn(page, EM, /sign in/i);
  await softPoster(page, "one-on-one", async () => {
    await page.goto("/one-on-one", { waitUntil: "networkidle" });
    const stickyText = "Northwind pricing floor, cite the second thread.";
    if (!(await page.getByText(stickyText, { exact: true }).count())) {
      const note = page.locator('textarea[aria-label="add a note"]').first();
      if (!(await note.isEnabled())) {
        const date = page.getByLabel(/when is your next 1:1/i);
        if (!(await date.count())) await page.getByRole("button", { name: /new 1:1/i }).click();
        await page.getByLabel(/when is your next 1:1/i).fill(new Date().toISOString().slice(0, 10));
        await page.getByRole("button", { name: /^add it$/i }).click({ timeout: 30_000 });
      }
      await expect(note).toBeEnabled({ timeout: 30_000 });
      await note.fill(stickyText);
      await note.press("Enter");
    }
    await expect(page.getByText(stickyText, { exact: true })).toBeVisible({ timeout: 60_000 });
  });
});