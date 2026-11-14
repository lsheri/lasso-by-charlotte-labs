import { mkdirSync } from "node:fs";
import path from "node:path";

import { test, type Page } from "@playwright/test";

import {
  BASELINE_SURFACES,
  VIEWPORTS,
  type BaselineSurface,
  type SurfaceId,
} from "./baseline-surfaces";

/**
 * Design baseline: one picture of every surface a brand change can touch.
 *
 * This is the "before" set. Every later design PR runs it again and compares.
 * It never asserts on the product; a surface that cannot be reached is logged
 * as SOFT-FAIL and the walk carries on, so one moved button never hides the
 * other pictures.
 *
 * Run (never paste the password into a chat or commit it). The QA password lives in a Pane secret,
 * set from the Reset button on /qa/seed:
 *   runpane secrets exec --project lasso-by-charlotte-labs --only LASSO_QA_PASSWORD -- \
 *     bunx playwright test design-baseline
 *
 * Options, all by environment variable:
 *   LASSO_E2E_BASE_URL  where the app is (defaults to the Lovable preview, which
 *                       sends signed-out browsers to a Lovable login; for a local
 *                       run start `bun run dev` and use http://localhost:8080)
 *   LASSO_SKIN          "lasso" (default) or any future skin name. A skin other
 *                       than lasso is requested with ?brand=<skin> right after
 *                       sign-in; signed-out surfaces always show Lasso.
 *   LASSO_SHOT_DIR      where pictures go (default tests/e2e/__baseline__)
 *
 * Adding a skin needs no code here. Adding a surface is one entry in
 * baseline-surfaces.ts and its opener in OPENERS.
 */

const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";
const SKIN = process.env["LASSO_SKIN"] ?? "lasso";
const OUT = process.env["LASSO_SHOT_DIR"] ?? "tests/e2e/__baseline__";

/** Bring a surface on screen. Throwing marks the picture SOFT-FAIL. */
type Opener = (page: Page) => Promise<void>;

async function go(page: Page, route: string): Promise<void> {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  // A picture of someone else's login wall is not a baseline. The Lovable
  // preview, for one, redirects signed-out browsers to lovable.dev.
  const wanted = new URL(response?.request().url() ?? page.url()).origin;
  const landed = new URL(page.url()).origin;
  if (landed !== wanted) throw new Error(`left the app: landed on ${landed}`);
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

const OPENERS: Record<SurfaceId, Opener> = {
  "01-landing": async (p) => {
    await go(p, "/");
    // The logo rain covers the wait for the public demo board; picture the story behind it.
    await p.getByTestId("landing-logo-rain").waitFor({ state: "detached", timeout: 30_000 });
    await p.locator(".lb-phone-loading").first().waitFor({ state: "detached", timeout: 30_000 });
  },
  "02-sign-in": (p) => go(p, "/auth"),
  "03-plans": (p) => go(p, "/plans"),
  // The first-run tour, shown through its public preview harness so no account is created.
  "04-onboarding-tour": (p) => go(p, "/tour-preview"),
  "05-home": (p) => go(p, "/home"),
  "06-all-work": (p) => go(p, "/work"),
  "07-sidebar-open": async (p) => {
    await go(p, "/home");
    // Open every collapsed folder so nesting, scope rows and shared rows show.
    for (let i = 0; i < 12; i += 1) {
      const closed = p.locator('nav [aria-label="Expand"]').first();
      if (!(await closed.count())) break;
      await closed.click();
    }
  },
  "08-board-and-toolbar": openFirstBoard,
  "09-ask-idle": async (p) => {
    await openFirstBoard(p);
    await p.locator('[aria-label="Ask Lasso"]').first().click();
  },
  // Best effort: a moving state. The picture is taken just after sending.
  "10-ask-thinking": async (p) => {
    await openFirstBoard(p);
    await p.locator('[aria-label="Ask Lasso"]').first().click();
    const box = p.locator("textarea").last();
    await box.fill("What is on this board?");
    await box.press("Enter");
    await p.locator("[data-lasso-thinking-mark]").first().waitFor({ timeout: 15_000 });
  },
  "11-share-dialog": async (p) => {
    await openFirstBoard(p);
    await p.locator('[aria-label="Share"]').first().click();
    await p.getByRole("dialog").waitFor({ timeout: 20_000 });
  },
  "12-settings": (p) => go(p, "/settings"),
  "13-sources": (p) => go(p, "/connectors"),
  "14-mobile-tab-bar": (p) => go(p, "/home"),
};

const SURFACES = BASELINE_SURFACES.map((surface): BaselineSurface & { open: Opener } => ({
  ...surface,
  open: OPENERS[surface.id],
}));

async function signIn(page: Page): Promise<void> {
  await go(page, "/auth");
  await page.locator("input#email").fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Leave as soon as the app either lets us in or says why it will not.
  const rejected = page.getByText(/invalid login credentials/i).first();
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 }),
    rejected.waitFor({ timeout: 60_000 }).then(() => {
      throw new Error("the app said: Invalid login credentials");
    }),
  ]);
}

/** Stops motion and removes toasts so two runs of the same commit match. */
async function settle(page: Page): Promise<void> {
  // A page may still be navigating (a client redirect, or a dev server's first
  // reload). Wait for it, and retry if the page changes underneath us.
  for (let attempt = 0; ; attempt += 1) {
    await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    try {
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;" +
          "transition-duration:0s!important;caret-color:transparent!important}",
      });
      await page.locator("[data-sonner-toast], [data-sonner-toaster]").evaluateAll((nodes) => {
        for (const node of nodes) node.remove();
      });
      // A playing video lands on a different frame every run; hold each on its first frame.
      await page.locator("video").evaluateAll((nodes) => {
        for (const node of nodes as HTMLVideoElement[]) {
          node.pause();
          node.currentTime = 0;
        }
      });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      await page.waitForTimeout(1_000);
    }
  }
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

    let signedIn = false;
    let signInError = "";
    for (const surface of SURFACES) {
      if (surface.only && surface.only !== viewport.id) continue;
      let result = "PASS";
      try {
        if (surface.auth && !signedIn) {
          if (!PASSWORD) throw new Error("LASSO_QA_PASSWORD is not set");
          // One failed sign-in is enough; retrying per surface only burns a minute each.
          if (signInError) throw new Error(`skipped, sign-in failed: ${signInError}`);
          try {
            await signIn(page);
          } catch (error) {
            signInError = (error as Error).message.split("\n")[0] ?? "unknown";
            throw new Error(`sign-in failed (check the password): ${signInError}`);
          }
          signedIn = true;
          // A skin is chosen once, after sign-in: only an allowed signed-in account can turn one on (PR1),
          // so the public surfaces before this point always show Lasso.
          if (SKIN !== "lasso") {
            await go(page, `/home?brand=${encodeURIComponent(SKIN)}`);
            // The switch applies once the session is known; wait for it before the next surface navigates.
            await page.waitForFunction(
              (skin) => document.documentElement.getAttribute("data-skin") === skin,
              SKIN,
              { timeout: 30_000 },
            );
          }
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
