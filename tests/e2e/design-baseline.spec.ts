import { mkdirSync } from "node:fs";
import path from "node:path";

import { test, type Page } from "@playwright/test";

/**
 * Design baseline: one picture of every surface a brand change can touch.
 *
 * This is the "before" set. Every later design PR runs it again and compares.
 * It never asserts on the product; a surface that cannot be reached is logged
 * as SOFT-FAIL and the walk carries on, so one moved button never hides the
 * other pictures.
 *
 * Run (never paste the password into a chat or commit it):
 *   LASSO_QA_EMAIL=... LASSO_QA_PASSWORD=... bunx playwright test design-baseline
 *
 * Options, all by environment variable:
 *   LASSO_E2E_BASE_URL  where the app is (defaults to the Lovable preview)
 *   LASSO_SKIN          "lasso" (default) or any future skin name. A skin other
 *                       than lasso is requested with ?brand=<skin> on first load.
 *   LASSO_SHOT_DIR      where pictures go (default tests/e2e/__baseline__)
 *
 * Adding a skin needs no code here. Adding a surface is one entry in SURFACES.
 */

const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";
const SKIN = process.env["LASSO_SKIN"] ?? "lasso";
const OUT = process.env["LASSO_SHOT_DIR"] ?? "tests/e2e/__baseline__";

const VIEWPORTS = [
  { id: "desktop-1280", width: 1280, height: 900 },
  { id: "phone-375", width: 375, height: 812 },
] as const;

type Viewport = (typeof VIEWPORTS)[number];

type Surface = {
  id: string;
  /** Needs a signed-in session. */
  auth: boolean;
  /** Skip on a viewport where the surface does not exist. */
  only?: Viewport["id"];
  /** Bring the surface on screen. Throwing marks the picture SOFT-FAIL. */
  open: (page: Page) => Promise<void>;
};

async function go(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}

async function openFirstBoard(page: Page): Promise<void> {
  await go(page, "/home");
  const board = page.locator('a[href*="/canvas-lab"]').first();
  await board.waitFor({ state: "attached", timeout: 30_000 });
  const href = await board.getAttribute("href");
  if (!href) throw new Error("no board link found");
  await go(page, href);
  await page.locator('[data-toolbar-control], [aria-label="Ask Lasso"]').first().waitFor({
    timeout: 60_000,
  });
}

const SURFACES: Surface[] = [
  { id: "01-landing", auth: false, open: (p) => go(p, "/") },
  { id: "02-sign-in", auth: false, open: (p) => go(p, "/auth") },
  { id: "03-plans", auth: false, open: (p) => go(p, "/plans") },
  // The first-run tour, shown through its public preview harness so no account is created.
  { id: "04-onboarding-tour", auth: false, open: (p) => go(p, "/tour-preview") },
  { id: "05-home", auth: true, open: (p) => go(p, "/home") },
  { id: "06-all-work", auth: true, open: (p) => go(p, "/work") },
  {
    id: "07-sidebar-open",
    auth: true,
    only: "desktop-1280",
    open: async (p) => {
      await go(p, "/home");
      // Open every collapsed folder so nesting, scope rows and shared rows show.
      for (let i = 0; i < 12; i += 1) {
        const closed = p.locator('nav [aria-label="Expand"]').first();
        if (!(await closed.count())) break;
        await closed.click();
      }
    },
  },
  { id: "08-board-and-toolbar", auth: true, open: openFirstBoard },
  {
    id: "09-ask-idle",
    auth: true,
    open: async (p) => {
      await openFirstBoard(p);
      await p.locator('[aria-label="Ask Lasso"]').first().click();
    },
  },
  {
    // Best effort: a moving state. The picture is taken just after sending.
    id: "10-ask-thinking",
    auth: true,
    open: async (p) => {
      await openFirstBoard(p);
      await p.locator('[aria-label="Ask Lasso"]').first().click();
      const box = p.locator("textarea").last();
      await box.fill("What is on this board?");
      await box.press("Enter");
      await p.locator("[data-lasso-thinking-mark]").first().waitFor({ timeout: 15_000 });
    },
  },
  {
    id: "11-share-dialog",
    auth: true,
    open: async (p) => {
      await openFirstBoard(p);
      await p.locator('[aria-label="Share"]').first().click();
      await p.getByRole("dialog").waitFor({ timeout: 20_000 });
    },
  },
  { id: "12-settings", auth: true, open: (p) => go(p, "/settings") },
  { id: "13-sources", auth: true, open: (p) => go(p, "/connectors") },
  { id: "14-mobile-tab-bar", auth: true, only: "phone-375", open: (p) => go(p, "/home") },
];

async function signIn(page: Page): Promise<void> {
  await go(page, "/auth");
  await page.locator("input#email").fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
}

/** Stops motion and removes toasts so two runs of the same commit match. */
async function settle(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;" +
      "transition-duration:0s!important;caret-color:transparent!important}",
  });
  await page.locator("[data-sonner-toast], [data-sonner-toaster]").evaluateAll((nodes) => {
    for (const node of nodes) node.remove();
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(400);
}

for (const viewport of VIEWPORTS) {
  test(`design baseline, ${SKIN}, ${viewport.id}`, async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    const dir = path.join(OUT, SKIN, viewport.id);
    mkdirSync(dir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // A skin is chosen once, on the first load, the way a person would get it.
    if (SKIN !== "lasso") await go(page, `/?brand=${encodeURIComponent(SKIN)}`);

    let signedIn = false;
    for (const surface of SURFACES) {
      if (surface.only && surface.only !== viewport.id) continue;
      let result = "PASS";
      try {
        if (surface.auth && !signedIn) {
          if (!PASSWORD) throw new Error("LASSO_QA_PASSWORD is not set");
          await signIn(page);
          signedIn = true;
        }
        await surface.open(page);
      } catch (error) {
        result = `SOFT-FAIL ${(error as Error).message.split("\n")[0]}`;
      }
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${surface.id}.png`) });
      console.log(`${result} ${SKIN}/${viewport.id}/${surface.id} ${page.url()}`);
    }

    await context.close();
  });
}
