import { writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

// Board files directly: the demo-firm index collects them with import.meta.glob, which Playwright cannot run.
import { b07 } from "../../src/lib/demo-firm/boards/b07-willowmere";
import { b14 } from "../../src/lib/demo-firm/boards/b14-hollisford";
import { b20 } from "../../src/lib/demo-firm/boards/b20-copperline";
import { b24 } from "../../src/lib/demo-firm/boards/b24-harborlight-arts";

const DEMO_BOARDS = [b07, b14, b20, b24];

/**
 * Red pen on a deployed build (it needs the server's AI key): runs it as Kestrel Bay demo people on each active
 * board's red pen deck and checks that the planted unsupported claims come out Unsupported or Weak. Results land in
 * test-results/red-pen-live.json. Run it before a buyer sees the feature, not in every PR.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=https://lasso.charlotte-labs.com RED_PEN_BOARDS=b7=<board id> bunx playwright test red-pen-live
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const TARGETS = (process.env["RED_PEN_BOARDS"] ?? "")
  .split(",")
  .filter(Boolean)
  .map((pair) => pair.split("=") as [string, string]);

test("red pen catches the planted unsupported claims", async ({ browser }) => {
  test.skip(!PASSWORD || TARGETS.length === 0, "needs DEMO_FIRM_PASSWORD and RED_PEN_BOARDS");
  test.setTimeout(TARGETS.length * 5 * 60_000);
  const report: unknown[] = [];
  for (const [key, boardId] of TARGETS) {
    const board = DEMO_BOARDS.find((entry) => entry.key === key)!;
    const deck = board.items.find((item) => item.unsupported?.length)!;
    // A fresh context per board: the session lives in local storage, so clearing cookies does not sign out.
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.locator("input#email").fill(`${board.team[0]}@kestrelbay.test`);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
    await page.goto(`/engagements/${boardId}/canvas-lab`, { waitUntil: "domcontentloaded" });
    await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
    await page.getByText("reading the workboard").waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    const card = page.locator("[data-node-id]").filter({ hasText: deck.title.slice(0, 24) }).first();
    await card.click({ position: { x: 20, y: 60 } });
    await card.getByRole("button", { name: "Card options" }).click();
    await page.getByRole("menuitem", { name: "Red pen" }).click();
    const dialog = page.getByTestId("red-pen");
    await dialog.waitFor({ timeout: 15_000 });
    await dialog.getByRole("button", { name: /Check this deliverable|Check again/ }).click();
    // The last check's summary shows while a new one runs, so wait for the run itself to end.
    await dialog.getByRole("button", { name: "Checking claims against this board's sources" }).waitFor({ timeout: 15_000 }).catch(() => undefined);
    await dialog.getByRole("button", { name: "Check again" }).waitFor({ timeout: 4 * 60_000 });
    await page.waitForTimeout(1_000);
    const rows = await dialog.locator("[data-red-pen-claim]").evaluateAll((nodes) =>
      nodes.map((node) => ({ grade: node.getAttribute("data-red-pen-claim"), text: node.textContent ?? "" })),
    );
    const planted = deck.unsupported!.map((sentence) => {
      const row = rows.find((entry) => entry.text.includes(sentence.slice(0, 40)));
      return { sentence, grade: row?.grade ?? "not listed" };
    });
    report.push({ board: key, deck: deck.title, claims: rows.length, grades: rows.map((row) => row.grade), planted });
    await page.screenshot({ path: `test-results/red-pen-live-${key}.png` });
    // A planted claim graded Sourced would be a false pass.
    expect.soft(planted.filter((entry) => entry.grade === "sourced"), `${key}: planted claims graded Sourced`).toEqual([]);
    // Written after every board, so a later failure keeps what already ran.
    writeFileSync("test-results/red-pen-live.json", JSON.stringify(report, null, 2));
    await context.close();
  }
});
