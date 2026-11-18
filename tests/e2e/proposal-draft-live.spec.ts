import { writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * Start a proposal end to end on a deployed build (it needs the server's AI key): signs in as Harper Quinn on Kestrel
 * Bay, opens the unshared Marrowfield opportunity board, reads its notes into a brief, finds precedents, drafts, and
 * checks the draft never names another client or shows a fee. Screens in both skins land in test-results; the draft
 * itself in test-results/proposal-draft-live-<brief>-<run>.json (use --repeat-each=3 for the pass bar). Each run adds one draft card to the board. Run it alone.
 * BRIEF picks the planted brief (RECOMMENDATION section 11): 1 Marrowfield, 2 Quillbrook (P2: Medrova and Freightlark close,
 * no padded third), 3 Tarnhollow (P3: Ironwillow the one close match, the unshared Sorrel diligence never appears).
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com BRIEF=2 DRAFT_BOARD=<board id> bunx playwright test proposal-draft-live
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const BOARD = process.env["DRAFT_BOARD"] ?? "";
const BRIEF = process.env["BRIEF"] ?? "1";
// Other Kestrel Bay clients whose names must never appear in a draft for a new client.
const OTHER_CLIENTS = ["St. Brigid", "Cedarmere", "Willowmere", "Ashbury", "Hollisford", "Copperline", "Harborlight", "Medrova", "Freightlark", "Haulwise", "Heron", "Ironwillow", "Coldfront", "Wexcombe"];
// The close precedents each brief must find, by client; null when the brief has no fixed set.
const CLOSE: Record<string, string[] | null> = { "1": null, "2": ["Medrova Software", "Freightlark Software"], "3": ["Ironwillow Partners"] };
// Unshared work that must never surface anywhere on the panel or in the draft.
const NEVER = ["Sorrel", "CareShift", "Project Relay"];

test("a proposal draft on an opportunity board", async ({ browser }) => {
  test.skip(!PASSWORD || !BOARD, "needs DEMO_FIRM_PASSWORD and DRAFT_BOARD");
  test.setTimeout(8 * 60_000);
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill("quinn@kestrelbay.test");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });

  await page.goto(`/engagements/${BOARD}/canvas-lab?brand=charlotte`, { waitUntil: "domcontentloaded" });
  const toolbar = page.getByRole("toolbar", { name: "Board controls" });
  await toolbar.waitFor({ timeout: 60_000 });
  await toolbar.locator('[data-toolbar-control="more"]').click();
  await page.getByRole("menuitem", { name: "Start a proposal" }).click();
  const panel = page.getByTestId("proposal-start");
  await panel.waitFor({ timeout: 15_000 });

  await panel.getByRole("button", { name: "Read the notes" }).click();
  await expect(panel.getByRole("button", { name: "Read the notes" })).toBeEnabled({ timeout: 90_000 });
  await panel.getByRole("button", { name: "Find precedents" }).click();
  await panel.getByRole("button", { name: "Draft the proposal" }).waitFor({ timeout: 120_000 });
  const precedents = await panel.locator("[data-precedent]").allTextContents();
  const close = await panel.locator('[data-precedent="close"]').allTextContents();
  await panel.getByRole("button", { name: "Draft the proposal" }).click();
  const draft = panel.getByTestId("proposal-draft");
  await draft.waitFor({ timeout: 4 * 60_000 });

  const sections = await draft.locator("[data-draft-section]").evaluateAll((nodes) =>
    nodes.map((node) => ({ key: node.getAttribute("data-draft-section"), status: node.getAttribute("data-draft-status"), text: node.textContent ?? "" })),
  );
  const questions = await draft.locator("[data-draft-questions] li").allTextContents();
  const checks = await draft.locator("[data-draft-checks] li").allTextContents();
  const all = await draft.textContent();
  const run = `${BRIEF}-${test.info().repeatEachIndex}`;
  const panelText = (await panel.textContent()) ?? "";
  writeFileSync(`test-results/proposal-draft-live-${run}.json`, JSON.stringify({ brief: BRIEF, precedents, close, checks, questions, sections }, null, 2));
  // Viewport shots: an element shot of the scrolling panel leaves blank bands.
  await draft.locator("[data-draft-status-strip]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/proposal-draft-live-${run}-charlotte.png` });

  expect(sections).toHaveLength(9);
  expect(sections.every((section) => section.status !== "confirmed")).toBe(true);
  expect(sections.find((section) => section.key === "fee")!.text).toContain("Fee: for partner decision.");
  expect(all ?? "").not.toMatch(/\$\s?\d/);
  for (const name of OTHER_CLIENTS) expect.soft(all ?? "", `names ${name}`).not.toContain(name);
  expect(questions.length).toBeGreaterThanOrEqual(1);
  expect(questions.length).toBeLessThanOrEqual(6);
  for (const term of NEVER) expect(panelText, `unshared work: ${term}`).not.toContain(term);
  const expected = CLOSE[BRIEF];
  if (expected) {
    expect.soft(close, "close precedents, no padded extra").toHaveLength(expected.length);
    for (const client of expected) expect.soft(close.some((text) => text.includes(client)), `${client} close`).toBe(true);
    if (expected.length === 1) expect.soft(panelText, "says there is only one close match").toContain("1 close match.");
  }

  // The same draft in the Lasso skin: reopening the panel shows the last draft.
  await page.goto(`/engagements/${BOARD}/canvas-lab?brand=lasso`, { waitUntil: "domcontentloaded" });
  await toolbar.waitFor({ timeout: 60_000 });
  await toolbar.locator('[data-toolbar-control="more"]').click();
  await page.getByRole("menuitem", { name: "Start a proposal" }).click();
  await page.getByTestId("proposal-draft").waitFor({ timeout: 30_000 });
  await page.getByTestId("proposal-draft").locator("[data-draft-status-strip]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/proposal-draft-live-${run}-lasso.png` });
  await context.close();
});
