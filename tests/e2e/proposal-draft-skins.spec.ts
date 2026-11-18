import { readFileSync } from "node:fs";

import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The proposal draft view in both skins, locally. A local run has no AI key and no firm reader, so the panel's server
 * calls are answered with a real draft recorded on the live site on 18 Nov (fixtures/proposal-draft-live-2026-11-18.json);
 * everything else on the page is the real app. Screens land in test-results/proposal-draft-<skin>.png.
 *
 *   runpane secrets exec --project lasso-by-charlotte-labs --only LASSO_QA_PASSWORD -- \
 *     env LASSO_E2E_BASE_URL=http://127.0.0.1:3199 bunx playwright test proposal-draft-skins
 */
const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";
const RECORDED = JSON.parse(readFileSync(new URL("./fixtures/proposal-draft-live-2026-11-18.json", import.meta.url), "utf8"));

/** The server function a request calls, read from its id (base64 JSON naming the export). */
function serverFnName(url: string): string | null {
  const id = /_serverFn\/([^/?]+)/.exec(url)?.[1];
  if (!id) return null;
  try {
    const decoded = JSON.parse(Buffer.from(id, "base64url").toString("utf8")) as { export?: string };
    return decoded.export?.replace(/_createServerFn_handler$/, "") ?? null;
  } catch {
    return null;
  }
}

/** One string field from a request body in the framework's serialized form ({ k: [keys], v: [{ s: value }] }). */
function serializedField(body: string, field: string): string | null {
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const record = node as { p?: { k?: string[]; v?: { s?: string }[] } };
    const index = record.p?.k?.indexOf(field) ?? -1;
    if (index >= 0) return record.p?.v?.[index]?.s ?? null;
    for (const value of Object.values(node)) {
      const found = Array.isArray(value) ? value.map(walk).find(Boolean) : walk(value);
      if (found) return found;
    }
    return null;
  };
  try {
    return walk(JSON.parse(body));
  } catch {
    return null;
  }
}

async function answerDraftCalls(page: Page) {
  let draft = structuredClone(RECORDED.draft);
  await page.route("**/_serverFn/**", async (route: Route) => {
    const name = serverFnName(route.request().url());
    // The client reads a server function's answer as { result, error, context }.
    const json = (result: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result, error: null, context: {} }) });
    if (name === "latestProposalDraft") return json({ ...RECORDED, draft });
    if (name === "confirmProposalSection") {
      const key = serializedField(route.request().postData() ?? "", "section");
      draft = { ...draft, sections: draft.sections.map((section: { key: string }) => (section.key === key ? { ...section, status: "confirmed" } : section)) };
      return json(draft);
    }
    return route.fallback();
  });
}

for (const skin of ["charlotte", "lasso"] as const) {
  test(`proposal draft view in the ${skin} skin`, async ({ page }) => {
    test.skip(!PASSWORD, "needs LASSO_QA_PASSWORD");
    test.setTimeout(3 * 60_000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await answerDraftCalls(page);
    await page.goto(`/auth?brand=${skin}`, { waitUntil: "domcontentloaded" });
    await page.locator("input#email").fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000 });
    const href = await page.locator('a[href*="/canvas-lab"]').first().getAttribute("href", { timeout: 60_000 });
    await page.goto(`${href}${href!.includes("?") ? "&" : "?"}brand=${skin}`, { waitUntil: "domcontentloaded" });
    const toolbar = page.getByRole("toolbar", { name: "Board controls" });
    await toolbar.waitFor({ timeout: 60_000 });
    await toolbar.locator('[data-toolbar-control="more"]').click();
    await page.getByRole("menuitem", { name: "Start a proposal" }).click();
    const view = page.getByTestId("proposal-draft");
    await view.waitFor({ timeout: 30_000 });

    // Nine sections, none confirmed, the fee never set, and the tag on one line beside the longest heading.
    await expect(view.locator("[data-draft-section]")).toHaveCount(9);
    await expect(view.locator('[data-draft-status="confirmed"]')).toHaveCount(0);
    await expect(view.locator("[data-draft-status-strip]")).toContainText("Fee not set");
    const tag = view.locator('[data-draft-section="assumptions"] span').first();
    const box = await tag.boundingBox();
    expect(box!.height, "status tag wraps onto two lines").toBeLessThan(30);

    await view.locator("[data-draft-status-strip]").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/proposal-draft-${skin}.png` });

    // Confirming one section changes only that section and the count.
    await view.getByRole("button", { name: "Confirm section" }).first().click();
    await expect(view.locator('[data-draft-section="context"]')).toHaveAttribute("data-draft-status", "confirmed");
    await expect(view.locator("[data-draft-status-strip]")).toContainText("8 sections not yet confirmed");
    await page.screenshot({ path: `test-results/proposal-draft-${skin}-confirmed.png` });
  });
}
