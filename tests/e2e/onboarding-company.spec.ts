import { expect, test, type Page } from "@playwright/test";

/**
 * Walks the real company setup as a QA person. Nothing here is seeded behind
 * the app: the account exists in auth only, so every screen is the one a new
 * person sees.
 */
const EMAIL = "qa.company.admin@qaprobe.test";
const PASSWORD = process.env["LASSO_QA_PASSWORD"] ?? "";

const NAV_GROUPS = [
  "What landed",
  "Where it goes",
  "Look back",
  "Your coach",
  "Run the firm",
];

const THREAD = [
  "Me: the discount ladder stops at 12 percent because anything deeper erases the pilot margin.",
  "Assistant: noted. I will hold the floor at 12 percent in the pricing page.",
].join("\n");

function step(name: string, selector: string, ok: boolean): void {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} [${selector}]`);
}

async function run(page: Page, name: string, selector: string, body: () => Promise<void>) {
  try {
    await body();
    step(name, selector, true);
  } catch (error) {
    step(name, selector, false);
    throw error;
  }
}

test("company person walks setup, pastes a thread and sets their data level", async ({ page }) => {
  expect(PASSWORD, "LASSO_QA_PASSWORD must be set in the environment").not.toBe("");

  await run(page, "landing loads", 'goto "/"', async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  await run(page, "open sign in", 'link name="Sign in"', async () => {
    const link = page.getByRole("link", { name: /sign in/i }).first();
    if (await link.count()) await link.click();
    else await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth/);
  });

  await run(page, "sign in", 'input#email, input[type="password"]', async () => {
    await page.getByPlaceholder("you@yourfirm.com").fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/(onboarding|work)/, { timeout: 60_000 });
  });

  const chooser = page.getByRole("heading", { name: "Who is this for?" });
  const needsSetup = await chooser
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (needsSetup) {
    await run(page, "choose for my company", 'heading "Who is this for?"', async () => {
      // The company card is the first of the three.
      await page.getByRole("button", { name: /^continue$/i }).first().click();
      await expect(page.getByLabel("Workspace name")).toBeVisible();
    });

    await run(page, "create workspace", 'button "Create workspace"', async () => {
      await page.getByLabel("Display name").fill("QA Company Admin");
      await page.getByLabel("Workspace name").fill("QA Firm");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await expect(page.getByRole("button", { name: /i'll do this later/i }).first()).toBeVisible({
        timeout: 60_000,
      });
    });

    await run(page, "skip the rest of setup", 'button "I\'ll do this later"', async () => {
      await page.getByRole("button", { name: /i'll do this later/i }).first().click();
      await page.waitForURL(/\/work/, { timeout: 60_000 });
    });
  } else {
    step("setup already done, straight to Inbox", "url /work", true);
  }


  await run(page, "lands on Inbox", 'heading "Inbox"', async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /inbox/i }).first()).toBeVisible();
  });

  for (const group of NAV_GROUPS) {
    await run(page, `sidebar group ${group}`, `text="${group}"`, async () => {
      await expect(page.getByText(group, { exact: true }).first()).toBeVisible();
    });
  }

  await run(page, "paste a thread", 'button "Paste a thread"', async () => {
    await page.getByRole("button", { name: /paste a thread/i }).first().click();
    const box = page.getByRole("dialog").locator("textarea").first();
    await box.fill(THREAD);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /(save|add|paste|bring)/i })
      .last()
      .click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60_000 });
  });

  await run(page, "card appears in Not claimed yet", 'text="Not claimed yet"', async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Not claimed yet").first()).toBeVisible({ timeout: 60_000 });
  });

  await run(page, "set personal data level to c", 'radio[name="personal-data-level"]', async () => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /^Your data/ })
      .first()
      .click();

    await expect(page.locator('input[name="personal-data-level"]').first()).toBeVisible({
      timeout: 60_000,
    });

    const choice = page
      .locator('label:has(input[name="personal-data-level"])')
      .filter({ hasText: "Work details" })
      .first();
    await choice.scrollIntoViewIfNeeded();
    await choice.click();
    await page.getByRole("button", { name: /save this level/i }).click();
    await expect(page.getByRole("button", { name: /save this level/i })).toBeHidden({
      timeout: 60_000,
    });
  });

});
