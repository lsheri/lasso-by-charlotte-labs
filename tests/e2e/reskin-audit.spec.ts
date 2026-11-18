import { readFileSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

/**
 * Reskin audit (18 Nov 2026, design guardrail). A brand change should need only the skin values. For each signed-in
 * screen this renders the page as Charlotte, then flips <html data-skin> to the proof skin (src/design/skins/proof.css,
 * injected here, never shipped) and compares every visible element. An element whose text colour, background, border
 * or font is identical under both skins did not follow the skin: a literal value or a pinned !important. Vendor marks
 * and images are exempt (their colours belong to the vendor). Writes test-results/reskin-audit.json and a proof-skin
 * screenshot per screen, and fails when distinct leaks rise above the ceiling in src/design/reskin-audit.json.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only DEMO_FIRM_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 bunx playwright test reskin-audit --workers=1
 */
const PASSWORD = process.env["DEMO_FIRM_PASSWORD"] ?? "";
const MARROWFIELD = "4a4abc70-32af-4cdb-8772-3850f9d673bc";
const PROOF_CSS = readFileSync("src/design/skins/proof.css", "utf8");
const CEILING = (JSON.parse(readFileSync("src/design/reskin-audit.json", "utf8")) as { leaks: number }).leaks;

type Snapshot = { sig: string; prop: string; value: string }[];
type Screen = { name: string; open: (page: Page) => Promise<void> };

const board = async (page: Page) => {
  await page.goto(`/engagements/${MARROWFIELD}/canvas-lab`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Board controls" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3_000);
};

const SCREENS: Screen[] = [
  { name: "home", open: async (page) => { await page.goto("/home", { waitUntil: "domcontentloaded" }); await page.getByTestId("ask-the-firm").waitFor({ timeout: 30_000 }).catch(() => undefined); await page.waitForTimeout(2_000); } },
  { name: "board", open: board },
  { name: "board-more-menu", open: async (page) => { await board(page); await page.getByRole("toolbar", { name: "Board controls" }).locator('[data-toolbar-control="more"]').click(); await page.getByRole("menu").waitFor(); } },
  { name: "share-dialog", open: async (page) => { await board(page); await page.getByRole("button", { name: "Share", exact: true }).click(); await page.getByRole("dialog").waitFor(); await page.waitForTimeout(800); } },
  { name: "all-work", open: async (page) => { await page.goto("/work", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3_000); } },
  { name: "settings", open: async (page) => { await page.goto("/settings", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2_500); } },
  { name: "firm", open: async (page) => { await page.goto("/firm", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3_000); } },
  { name: "proposal-panel", open: async (page) => { await board(page); await page.getByRole("toolbar", { name: "Board controls" }).locator('[data-toolbar-control="more"]').click(); await page.getByRole("menuitem", { name: "Start a proposal" }).click(); await page.getByTestId("proposal-start").waitFor({ timeout: 15_000 }); await page.waitForTimeout(1_000); } },
  { name: "board-card-menu", open: async (page) => { await board(page); const card = page.locator("[data-node-id]").first(); await card.click({ position: { x: 20, y: 60 } }); await card.getByRole("button", { name: "Card options" }).click(); await page.getByRole("menu").waitFor(); } },
];
/** The same screens at phone width, where the shell, sidebar and dialogs take other shapes. */
const PHONE_SCREENS = ["home", "board", "all-work"];

/** Every visible element's skin-relevant styles, keyed by a readable signature, in document order. */
async function snapshot(page: Page): Promise<Snapshot[]> {
  return page.evaluate(() => {
    const exempt = (el: Element) => Boolean(el.closest("img, picture, video, canvas, [data-tool-badge], [data-brand], [data-vendor], [data-vendor-mark], [data-illustration], .brand-logo"));
    const transparent = (v: string) => !v || v === "transparent" || /rgba\([^)]*,\s*0\)$/.test(v) || v === "none";
    const sigOf = (el: Element) => {
      const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter((c) => c && !/^(hover|focus|group|data-|aria-|md:|sm:|lg:)/.test(c)).slice(0, 4).join(".") : "";
      const parent = el.parentElement;
      const pcls = parent && typeof parent.className === "string" ? parent.className.split(/\s+/).filter(Boolean)[0] ?? "" : "";
      return `${pcls ? pcls + " > " : ""}${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
    };
    const out: { sig: string; prop: string; value: string }[][] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > window.innerHeight * 2) { out.push([]); continue; }
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0 || exempt(el)) { out.push([]); continue; }
      const sig = sigOf(el);
      const rows: { sig: string; prop: string; value: string }[] = [];
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0);
      if (hasText) {
        rows.push({ sig, prop: "color", value: cs.color });
        rows.push({ sig, prop: "font-family", value: cs.fontFamily });
      }
      if (!transparent(cs.backgroundColor)) rows.push({ sig, prop: "background", value: cs.backgroundColor });
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && !transparent(cs.borderTopColor)) rows.push({ sig, prop: "border", value: cs.borderTopColor });
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement) && !(el instanceof SVGGElement)) {
        if (!transparent(cs.fill) && cs.fill !== "currentcolor") rows.push({ sig, prop: "fill", value: cs.fill });
        if (!transparent(cs.stroke) && cs.stroke !== "currentcolor") rows.push({ sig, prop: "stroke", value: cs.stroke });
      }
      out.push(rows);
    }
    return out;
  });
}

test("a brand change needs only the skin values", async ({ browser }) => {
  test.skip(!PASSWORD, "needs DEMO_FIRM_PASSWORD");
  test.setTimeout(10 * 60_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("input#email").fill("quinn@kestrelbay.test");
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });

  const leaks = new Map<string, { screens: Set<string>; count: number; value: string }>();
  const perScreen: Record<string, number> = {};
  const runs = [
    ...SCREENS.map((screen) => ({ screen, phone: false })),
    ...SCREENS.filter((screen) => PHONE_SCREENS.includes(screen.name)).map((screen) => ({ screen, phone: true })),
  ];
  for (const { screen, phone } of runs) {
    await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await screen.open(page);
    await page.addStyleTag({ content: PROOF_CSS });
    // Stop transitions so the second read sees settled values.
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    await page.evaluate(() => document.documentElement.setAttribute("data-skin", "charlotte"));
    await page.waitForTimeout(300);
    // A planted leak on the first screen proves the audit can see one: a literal colour inside the shell.
    if (screen === SCREENS[0] && !phone)
      await page.evaluate(() => {
        const canary = document.createElement("p");
        canary.className = "reskin-canary";
        canary.textContent = "canary";
        canary.style.cssText = "color:#123456;font-family:Impact;position:fixed;top:0;left:0;z-index:2147483647";
        document.querySelector('[data-lasso="on"]')?.appendChild(canary);
      });
    const before = await snapshot(page);
    await page.evaluate(() => document.documentElement.setAttribute("data-skin", "proof"));
    await page.waitForTimeout(300);
    const after = await snapshot(page);
    const label = `${screen.name}${phone ? "-phone" : ""}`;
    await page.screenshot({ path: `test-results/reskin-proof-${label}.png` });
    let found = 0;
    const length = Math.min(before.length, after.length);
    for (let i = 0; i < length; i += 1) {
      for (const row of before[i]!) {
        const match = after[i]!.find((other) => other.prop === row.prop);
        if (!match || match.value !== row.value) continue;
        const key = `${row.prop} | ${row.sig} | ${row.value}`;
        const entry = leaks.get(key) ?? { screens: new Set<string>(), count: 0, value: row.value };
        entry.screens.add(label);
        entry.count += 1;
        leaks.set(key, entry);
        found += 1;
      }
    }
    perScreen[label] = found;
    if (screen === SCREENS[0] && !phone) await page.evaluate(() => document.querySelector(".reskin-canary")?.remove());
    await page.evaluate(() => document.documentElement.setAttribute("data-skin", "charlotte"));
  }

  const canaryKeys = [...leaks.keys()].filter((key) => key.includes("reskin-canary"));
  expect(canaryKeys.length, "the planted canary (literal colour and font) must be caught, or the audit is blind").toBe(2);
  for (const key of canaryKeys) leaks.delete(key);
  const rows = [...leaks.entries()]
    .map(([key, entry]) => ({ key, screens: [...entry.screens], count: entry.count }))
    .sort((a, b) => b.count - a.count);
  const byProp = rows.reduce<Record<string, number>>((acc, row) => {
    const prop = row.key.split(" | ")[0]!;
    acc[prop] = (acc[prop] ?? 0) + 1;
    return acc;
  }, {});
  writeFileSync("test-results/reskin-audit.json", JSON.stringify({ distinct: rows.length, byProp, perScreen, rows }, null, 2));
  await context.close();
  expect(rows.length, `distinct reskin leaks (ceiling ${CEILING}); see test-results/reskin-audit.json`).toBeLessThanOrEqual(CEILING);
});
