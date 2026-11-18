import { writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * The two inputs a real firm needs for past fees and precedents (Liam, 18 Nov: "if we demo it it must be real"):
 * a SOW's fee terms, set by an admin or lead, and how an engagement ended, set by the board's editors. Runs as demo
 * people on the Kestrel Bay firm and leaves every row as it found it: the suggestion is never saved on the real SOW,
 * terms saved on a review note are removed again, and the outcome goes back to still running.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 bunx playwright test real-inputs-live
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const BRIGHTPATH = "43d2fe21-92aa-4970-9f2f-5bd9a43c768f";
const QUILLBROOK = "9a7efe85-e92c-4dd5-a488-e2c6f386f824";
const report: Record<string, unknown> = {};

async function as(browser: Browser, person: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  if (process.env["DEBUG_NET"]) {
    page.on("response", async (response) => {
      const url = response.url();
      if (!/_serverFn|rest\/v1\/engagements/.test(url) || response.request().method() === "OPTIONS") return;
      const body = await response.text().catch(() => "");
      console.log("NET", response.request().method(), response.status(), url.slice(0, 140), response.request().postData()?.slice(0, 200), body.slice(0, 300));
    });
  }
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(`${person}@kestrelbay.test`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
  return page;
}

async function openBoard(page: Page, boardId: string) {
  await page.goto(`/engagements/${boardId}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.getByText("reading the workboard").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);
}

async function cardMenu(page: Page, title: string) {
  const card = page.locator("[data-node-id]").filter({ hasText: title.slice(0, 24) }).first();
  await card.click({ position: { x: 20, y: 60 } });
  await card.getByRole("button", { name: "Card options" }).click();
}

async function feeTerms(page: Page, title: string) {
  await cardMenu(page, title);
  await page.getByRole("menuitem", { name: "Fee terms…" }).click();
  const dialog = page.getByTestId("sow-terms");
  await dialog.waitFor({ timeout: 15_000 });
  await expect(dialog.getByRole("button", { name: "Read from the document" })).toBeEnabled({ timeout: 15_000 });
  return dialog;
}

test.beforeEach(() => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
});

test.afterAll(() => {
  writeFileSync("test-results/real-inputs-live.json", JSON.stringify(report, null, 2));
});

test("an admin reads fee terms from a SOW, and saves and removes terms on a document", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const page = await as(browser, "hollis");
  await openBoard(page, BRIGHTPATH);

  let dialog = await feeTerms(page, "SOW: Brightpath membership plan pricing");
  const fee = dialog.getByLabel("Fee, as written");
  const weeks = dialog.getByLabel("Length in weeks");
  await expect(fee).toHaveValue("$120k");
  await fee.fill("");
  await weeks.fill("");
  await dialog.getByRole("button", { name: "Read from the document" }).click();
  await dialog.locator("[data-sow-terms-note], [role=alert]").first().waitFor({ timeout: 60_000 });
  report["suggested"] = { fee: await fee.inputValue(), weeks: await weeks.inputValue(), note: await dialog.locator("[data-sow-terms-note]").textContent().catch(() => null) };
  expect(await fee.inputValue()).toBe("$120k");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await dialog.waitFor({ state: "hidden" });

  dialog = await feeTerms(page, "Partner review notes on pricing draft v1");
  await expect(dialog.getByLabel("Fee, as written")).toHaveValue("");
  await dialog.getByLabel("Fee, as written").fill("£12,500 a month");
  await dialog.getByLabel("Length in weeks").fill("6");
  await dialog.getByRole("button", { name: "Save fee terms" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });

  dialog = await feeTerms(page, "Partner review notes on pricing draft v1");
  await expect(dialog.getByLabel("Fee, as written")).toHaveValue("£12,500 a month");
  await expect(dialog.getByLabel("Length in weeks")).toHaveValue("6");
  report["saved"] = true;
  await dialog.getByRole("button", { name: "Remove fee terms" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });

  dialog = await feeTerms(page, "Partner review notes on pricing draft v1");
  await expect(dialog.getByLabel("Fee, as written")).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Remove fee terms" })).toHaveCount(0);
  report["removed"] = true;
  await page.context().close();
});

test("a manager has no fee terms on any card", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const page = await as(browser, "quinn");
  await openBoard(page, QUILLBROOK);
  await cardMenu(page, "Intake call: Quillbrook CEO");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Fee terms…" })).toHaveCount(0);
  report["managerSeesFeeTerms"] = false;
  await page.context().close();
});

test("the board owner sets how it ended and sets it back to still running", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const page = await as(browser, "quinn");
  await openBoard(page, QUILLBROOK);
  const open = async () => {
    await page.getByRole("toolbar", { name: "Board controls" }).locator('[data-toolbar-control="more"]').click();
    await page.getByRole("menuitem", { name: "How it ended…" }).click();
    const dialog = page.getByTestId("board-outcome");
    await dialog.waitFor({ timeout: 15_000 });
    return dialog;
  };
  let dialog = await open();
  await expect(dialog.getByLabel("Plan")).toHaveValue("running");
  await dialog.getByLabel("Plan").selectOption("ran");
  await dialog.getByLabel("Extension").selectOption("no");
  await dialog.getByLabel(/What we would do differently/).fill("Agree the data request in week one");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });

  dialog = await open();
  await expect(dialog.getByLabel("Plan")).toHaveValue("ran");
  await expect(dialog.getByLabel("Extension")).toHaveValue("no");
  await expect(dialog.getByLabel(/What we would do differently/)).toHaveValue("Agree the data request in week one.");
  report["outcomeSaved"] = true;
  await dialog.getByLabel("Plan").selectOption("running");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });

  dialog = await open();
  await expect(dialog.getByLabel("Plan")).toHaveValue("running");
  report["outcomeCleared"] = true;
  await page.context().close();
});
