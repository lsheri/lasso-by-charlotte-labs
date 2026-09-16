import { expect, type Page } from "@playwright/test";

/**
 * Shared walking gear for the QA specs. Product code is never imported here:
 * these tests must see the app exactly as a first time person does.
 */
export const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";

export const SHOTS = "/mnt/documents/qa-screens";

export const findings: string[] = [];

export function step(name: string, selector: string, ok: boolean): void {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} [${selector}]`);
}

/** A step the walk depends on. A failure stops the spec. */
export async function run(
  _page: Page,
  name: string,
  selector: string,
  body: () => Promise<void>,
): Promise<void> {
  try {
    await body();
    step(name, selector, true);
  } catch (error) {
    step(name, selector, false);
    throw error;
  }
}

/**
 * A step that reports on the product rather than the walk. A failure is
 * written down and the walk carries on, so one wrong screen never hides the
 * rest of the report.
 */
export async function check(
  name: string,
  selector: string,
  body: () => Promise<void>,
): Promise<boolean> {
  try {
    await body();
    step(name, selector, true);
    return true;
  } catch (error) {
    step(name, selector, false);
    findings.push(`${name}: ${(error as Error).message.split("\n")[0]}`);
    return false;
  }
}

export function reportFindings(label: string): void {
  console.log(`--- product findings, ${label} ---`);
  if (findings.length === 0) console.log("none");
  for (const line of findings) console.log(`FINDING ${line}`);
}

export async function signIn(page: Page, email: string, from: RegExp): Promise<void> {
  await run(page, "landing loads", 'goto "/"', async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  await run(page, "open the front door", `link ${from}`, async () => {
    const link = page.getByRole("link", { name: from }).first();
    if (await link.count()) await link.click();
    else await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth/, { timeout: 60_000 });
  });

  await run(page, "sign in", 'input#email, input[type="password"]', async () => {
    await page.getByPlaceholder("you@yourfirm.com").fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/(onboarding|work)/, { timeout: 60_000 });
  });
}

export async function openYourData(page: Page): Promise<void> {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /^Your data/ })
    .first()
    .click();
  await expect(page.locator('input[name="personal-data-level"]').first()).toBeVisible({
    timeout: 60_000,
  });
}

/** Picks a level in a tier list and confirms it. Returns false when blocked. */
export async function pickLevel(page: Page, name: string, label: string): Promise<boolean> {
  const choice = page
    .locator(`label:has(input[name="${name}"])`)
    .filter({ hasText: label })
    .first();
  await choice.scrollIntoViewIfNeeded();
  const radio = choice.locator("input").first();
  if (await radio.isDisabled()) return false;
  if (await radio.isChecked()) return true;
  await choice.click();
  const save = page.getByRole("button", { name: /save this level/i });
  await save.click();
  await expect(save).toBeHidden({ timeout: 60_000 });
  return true;
}

export const THREAD = [
  "Me: the discount ladder stops at 12 percent because anything deeper erases the pilot margin.",
  "Assistant: noted. I will hold the floor at 12 percent in the pricing page.",
].join("\n");

export async function pasteThread(page: Page): Promise<void> {
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /paste a thread/i }).first().click();
  const box = page.getByRole("dialog").locator("textarea").first();
  await box.fill(THREAD);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /(save|add|paste|bring)/i })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60_000 });
}
