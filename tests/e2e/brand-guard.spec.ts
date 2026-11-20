import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 4 PR6, the brand guard: under Charlotte no surface shows the Lasso name or the Lasso loop mark
 * (Liam, 15 Nov 2026: the brand is all or nothing).
 *
 * It walks the signed-out pages that follow ?brand=charlotte and the main signed-in surfaces, reads everything a
 * person can see or a screen reader can hear (text, tab title, aria-label, placeholder, title and alt), and fails on
 * any "lasso" outside the two lists below.
 *
 * 19 Nov 2026, the Lasso mode: Slate / Spool script is a whole brand whose name is Lasso, so the guard runs both ways.
 * With LASSO_BRAND_GUARD_LOOK=slate-spool it turns that look on and fails on any "Charlotte" (the company's own name,
 * Charlotte Labs, and its domain are not the product) and on any Charlotte C or Lasso loop mark. Without it, it runs
 * as before and also fails on any Spool script mark or icon file. Each mode also checks the tab's icon files.
 *
 * Run against a local dev server (never paste the password into a chat or commit it):
 *   runpane secrets exec --project lasso-by-charlotte-labs --only LASSO_QA_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 bunx playwright test brand-guard
 */

const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";

/** Which look the walk turns on. Each has the other brand's name and marks as its forbidden list. */
const SLATE = process.env["LASSO_BRAND_GUARD_LOOK"] === "slate-spool";
const LOOK = SLATE
  ? {
      label: "Slate / Spool script (Lasso)",
      param: "slate-spool",
      theme: "slate-spool" as string | null,
      askLabel: "Ask Lasso",
      forbidden: /charlotte/i,
      // The maker's name and its domain stay: "Lasso by Charlotte Labs", lasso.charlotte-labs.com.
      notTheProduct: /charlotte[ -]labs/gi as RegExp | null,
      forbiddenMarks: ["charlotte", "lasso"],
      iconFiles: (href: string) => href.includes("/slate-"),
    }
  : {
      label: "Charlotte",
      param: "charlotte",
      theme: null as string | null,
      askLabel: "Charlotte",
      forbidden: /lasso/i,
      notTheProduct: null as RegExp | null,
      forbiddenMarks: ["lasso", "slate-spool"],
      iconFiles: (href: string) => !href.includes("/slate-"),
    };

/**
 * Wording that changes only at the flip, because pilots' Claude still lists the connector as Lasso and the MCP server
 * still announces itself as Lasso. Each entry is removed the day the flip ships; the list must end empty.
 */
const FLIP_ONLY: RegExp[] = [];

/** Words the QA account itself wrote on its boards and chats. User content is never rebranded. */
const USER_CONTENT: RegExp[] = [];

type Surface = { id: string; path: string; auth: boolean; open?: (page: Page) => Promise<void> };

const SURFACES: Surface[] = [
  { id: "sign-in", path: `/auth?brand=${LOOK.param}`, auth: false },
  { id: "reset-password", path: `/reset-password?brand=${LOOK.param}`, auth: false },
  { id: "why", path: `/why?brand=${LOOK.param}`, auth: false },
  { id: "trust", path: `/trust?brand=${LOOK.param}`, auth: false },
  { id: "landing", path: `/?brand=${LOOK.param}`, auth: false },
  { id: "plans", path: `/plans?brand=${LOOK.param}`, auth: false },
  { id: "join", path: `/join?brand=${LOOK.param}`, auth: false },
  { id: "board-invite", path: `/board-invite?brand=${LOOK.param}`, auth: false },
  { id: "no-access", path: `/no-access?brand=${LOOK.param}`, auth: false },
  { id: "demo-sources", path: `/demo/sources?brand=${LOOK.param}`, auth: false },
  { id: "tour-preview", path: `/tour-preview?brand=${LOOK.param}`, auth: false },
  { id: "home", path: "/home", auth: true },
  { id: "firm-brain", path: "/firm-brain", auth: true },
  { id: "all-work", path: "/work", auth: true },
  { id: "board", path: "/home", auth: true, open: openFirstBoard },
  {
    id: "ask",
    path: "/home",
    auth: true,
    open: async (page) => {
      await openFirstBoard(page);
      const box = page.getByPlaceholder(/^Ask |^What do you want to think through/).last();
      if (!(await box.isVisible())) await page.locator(`[aria-label="${LOOK.askLabel}"]`).first().click();
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
    .locator(`[data-toolbar-control], [aria-label="${LOOK.askLabel}"]`)
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
  await page.goto(`/home?brand=${LOOK.param}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (theme) =>
      document.documentElement.getAttribute("data-skin") === "charlotte" &&
      document.documentElement.getAttribute("data-brand-theme") === theme,
    LOOK.theme,
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

test(`brand guard: one brand only under ${LOOK.label}`, async ({ page }) => {
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

    const theme = await page.locator("html").getAttribute("data-brand-theme");
    expect(theme, `${surface.id} is not in the ${LOOK.label} look`).toBe(LOOK.theme);

    for (const mark of LOOK.forbiddenMarks) {
      const marks = await page.locator(`[data-brand-mark="${mark}"]`).count();
      if (marks) hits.push(`${surface.id}: ${marks} ${mark} mark(s)`);
    }
    const icons = await page
      .locator('head link[rel~="icon"], head link[rel="apple-touch-icon"], head link[rel="manifest"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(icons.length, `${surface.id} has no icon links`).toBeGreaterThan(0);
    for (const href of icons) {
      if (!LOOK.iconFiles(href)) hits.push(`${surface.id}: icon file ${href}`);
    }
    const lines = await readable(page);
    // A blank or failed page has nothing to say, so it must not pass as clean.
    expect(lines.length, `${surface.id} rendered almost nothing`).toBeGreaterThan(5);
    for (const line of lines) {
      if (!LOOK.forbidden.test(LOOK.notTheProduct ? line.replace(LOOK.notTheProduct, "") : line)) continue;
      if ([...FLIP_ONLY, ...USER_CONTENT].some((allowed) => allowed.test(line))) continue;
      hits.push(`${surface.id}: ${line.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  }

  const unique = [...new Set(hits)];
  for (const hit of unique) console.log(`LASSO ${hit}`);
  expect(unique, `another brand shown under ${LOOK.label}`).toEqual([]);
});
