import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 4 PR6, the brand guard: under Charlotte no surface shows the Lasso name or the Lasso loop mark
 * (Liam, 15 Nov 2026: the brand is all or nothing).
 *
 * It walks the signed-out pages that follow ?brand=charlotte and the main signed-in surfaces, reads everything a
 * person can see or a screen reader can hear (text, tab title, aria-label, placeholder, title and alt), and fails on
 * any "lasso" outside the two lists below.
 *
 * Run against a local dev server (never paste the password into a chat or commit it):
 *   runpane secrets exec --project lasso-by-charlotte-labs --only LASSO_QA_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 bunx playwright test brand-guard
 */

const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";

/**
 * Wording that changes only at the flip, because pilots' Claude still lists the connector as Lasso and the MCP server
 * still announces itself as Lasso. Each entry is removed the day the flip ships; the list must end empty.
 */
const FLIP_ONLY: RegExp[] = [];

/** Words the QA account itself wrote on its boards and chats. User content is never rebranded. */
const USER_CONTENT: RegExp[] = [];

type Surface = { id: string; path: string; auth: boolean; open?: (page: Page) => Promise<void> };

const SURFACES: Surface[] = [
  { id: "sign-in", path: "/auth?brand=charlotte", auth: false },
  { id: "reset-password", path: "/reset-password?brand=charlotte", auth: false },
  { id: "why", path: "/why?brand=charlotte", auth: false },
  { id: "trust", path: "/trust?brand=charlotte", auth: false },
  { id: "landing", path: "/?brand=charlotte", auth: false },
  { id: "plans", path: "/plans?brand=charlotte", auth: false },
  { id: "join", path: "/join?brand=charlotte", auth: false },
  { id: "board-invite", path: "/board-invite?brand=charlotte", auth: false },
  { id: "no-access", path: "/no-access?brand=charlotte", auth: false },
  { id: "home", path: "/home", auth: true },
  { id: "all-work", path: "/work", auth: true },
  { id: "board", path: "/home", auth: true, open: openFirstBoard },
  {
    id: "ask",
    path: "/home",
    auth: true,
    open: async (page) => {
      await openFirstBoard(page);
      const box = page.getByPlaceholder(/^Ask |^What do you want to think through/).last();
      if (!(await box.isVisible())) await page.locator('[aria-label="Charlotte"]').first().click();
      await box.waitFor({ state: "visible", timeout: 15_000 });
    },
  },
  {
    id: "share-dialog",
    path: "/home",
    auth: true,
    open: async (page) => {
      await openFirstBoard(page);
      await page.locator('[aria-label="Share"]').first().click();
      await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    },
  },
  // Both open as panels over All work.
  { id: "settings", path: "/settings", auth: true },
  { id: "sources", path: "/connectors", auth: true },
];

async function openFirstBoard(page: Page): Promise<void> {
  const board = page.locator('a[href*="/canvas-lab"]').first();
  await board.waitFor({ state: "attached", timeout: 30_000 });
  await page.goto((await board.getAttribute("href")) ?? "/home", { waitUntil: "domcontentloaded" });
  await page
    .locator('[data-toolbar-control], [aria-label="Charlotte"]')
    .first()
    .waitFor({ timeout: 60_000 });
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
  // Only an allowed signed-in account can turn Charlotte on; it sticks for the rest of the walk.
  await page.goto("/home?brand=charlotte", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-skin") === "charlotte",
    null,
    {
      timeout: 30_000,
    },
  );
}

/** Everything on screen a person reads or hears, one entry per text node or attribute. */
async function readable(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out = [`title: ${document.title}`];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, noscript, [hidden]")) continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = node.textContent?.trim();
      if (text) out.push(text);
    }
    for (const attr of ["aria-label", "placeholder", "title", "alt"]) {
      for (const el of document.querySelectorAll(`[${attr}]`))
        out.push(`${attr}: ${el.getAttribute(attr)}`);
    }
    return out;
  });
}

test("brand guard: no Lasso under Charlotte", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const hits: string[] = [];
  let signedIn = false;

  for (const surface of SURFACES) {
    if (surface.auth && !signedIn) {
      expect(PASSWORD, "LASSO_QA_PASSWORD is not set").not.toBe("");
      await signIn(page);
      signedIn = true;
    }
    await page.goto(surface.path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await surface.open?.(page);
    await page.waitForTimeout(1_000);
    await expect(page.locator("html"), `${surface.id} is not under Charlotte`).toHaveAttribute(
      "data-skin",
      "charlotte",
    );

    const marks = await page.locator('[data-brand-mark="lasso"]').count();
    if (marks) hits.push(`${surface.id}: ${marks} Lasso loop mark(s)`);
    const lines = await readable(page);
    // A blank or failed page has nothing to say, so it must not pass as clean.
    expect(lines.length, `${surface.id} rendered almost nothing`).toBeGreaterThan(5);
    for (const line of lines) {
      if (!/lasso/i.test(line)) continue;
      if ([...FLIP_ONLY, ...USER_CONTENT].some((allowed) => allowed.test(line))) continue;
      hits.push(`${surface.id}: ${line.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  }

  const unique = [...new Set(hits)];
  for (const hit of unique) console.log(`LASSO ${hit}`);
  expect(unique, "Lasso shown under Charlotte").toEqual([]);
});
