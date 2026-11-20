import { writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Demo minute 26, "off means gone" (RECOMMENDATION section 9, eval A16), on the deployed site. Harper asks about
 * post-merger integration and gets both engagements; Tiago turns firm sharing off on Medrova; Harper asks again and
 * gets only Freightlark, with one fewer engagement read and no trace of Medrova. Sharing is always turned back on,
 * even when a step fails. Writes test-results/sharing-off-live.json.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com bunx playwright test sharing-off-live
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MEDROVA = process.env["MEDROVA_BOARD"] ?? "d108b328-7c12-47b0-9a1a-f22de64179fc";
const QUESTION = "Have we done post-merger integration before?";
const B9 = "Integration of a first acquisition";
const B27 = "Second acquisition integration";
const MEDROVA_TRACES = /Medrova|Project Heron|Integration of a first acquisition/;

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

async function ask(page: Page): Promise<{ status: string; text: string; read: number | null }> {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const box = page.getByTestId("ask-the-firm");
  await box.waitFor({ timeout: 30_000 });
  // 20 Nov 2026 (D-97): Ask the firm is the chat pill, on every page. Open it first; the answer builds in the chat.
  if ((await box.getAttribute("data-mode")) === "shut") await box.getByRole("button", { name: /^Open the .+ helper$/ }).click();
  await box.getByLabel("Question for the firm").waitFor({ state: "visible", timeout: 10_000 });
  await box.getByLabel("Question for the firm").fill(QUESTION);
  await box.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = box.locator("[data-firm-answer]");
  await answer.waitFor({ timeout: 120_000 });
  const text = await box.innerText();
  // The coverage line is uppercased by CSS, so read its text content, not what innerText shows.
  const coverage = (await box.locator("[data-firm-coverage]").textContent()) ?? "";
  const read = /Read (\d+) engagements?/.exec(coverage);
  return { status: (await answer.getAttribute("data-firm-answer")) ?? "", text, read: read ? Number(read[1]) : null };
}

async function setSharing(page: Page, on: boolean) {
  await page.goto(`/engagements/${MEDROVA}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const toggle = page.getByTestId("firm-share-section").getByRole("switch", { name: "Share with firm" });
  await toggle.waitFor({ timeout: 15_000 });
  await expect(toggle).toBeEnabled({ timeout: 15_000 });
  if ((await toggle.getAttribute("aria-checked")) === String(on)) return;
  await toggle.click();
  if (!on) await page.getByRole("alertdialog").getByRole("button", { name: "Stop sharing" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", String(on), { timeout: 15_000 });
  await page.keyboard.press("Escape");
}

test("turning sharing off removes an engagement from the next answer, and on brings it back", async ({ browser }) => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
  test.setTimeout(10 * 60_000);
  const harper = await as(browser, "quinn");
  const tiago = await as(browser, "pereira");
  const report: Record<string, unknown> = {};
  try {
    const before = await ask(harper);
    expect.soft(before.read, "coverage line read").not.toBeNull();
    report["before"] = { status: before.status, read: before.read, b9: before.text.includes(B9), b27: before.text.includes(B27) };
    expect.soft(before.status).toBe("answered");
    expect.soft(before.text, "cites Medrova before").toContain(B9);
    expect.soft(before.text, "cites Freightlark before").toContain(B27);

    await setSharing(tiago, false);
    const off = await ask(harper);
    report["off"] = { status: off.status, read: off.read, b27: off.text.includes(B27), medrovaTrace: MEDROVA_TRACES.test(off.text) };
    expect(off.text, "no trace of Medrova once sharing is off").not.toMatch(MEDROVA_TRACES);
    expect.soft(off.text, "still cites Freightlark").toContain(B27);
    expect.soft(off.read, "one fewer engagement read").toBe(before.read === null ? null : before.read - 1);
  } finally {
    await setSharing(tiago, true);
    report["restored"] = true;
    writeFileSync("test-results/sharing-off-live.json", JSON.stringify(report, null, 2));
  }

  const back = await ask(harper);
  expect.soft(back.text, "Medrova is back once sharing is on").toContain(B9);
  expect.soft(back.read, "the count is back").toBe(report["before"] ? (report["before"] as { read: number | null }).read : null);
  await harper.context().close();
  await tiago.context().close();
});
