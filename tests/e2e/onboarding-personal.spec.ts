import { expect, test } from "@playwright/test";

import {
  PASSWORD,
  SHOTS,
  check,
  openYourData,
  pasteThread,
  pickLevel,
  reportFindings,
  run,
  signIn,
  step,
} from "./qa-helpers";

const EMAIL = "qa.personal@qaprobe.test";

test("solo person walks setup and sets a full data level", async ({ page }) => {
  expect(PASSWORD, "LASSO_QA_PASSWORD must be set in the environment").not.toBe("");

  await signIn(page, EMAIL, /start your record/i);

  const chooser = page.getByRole("heading", { name: "Who is this for?" });
  const needsSetup = await chooser
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (needsSetup) {
    await run(page, "choose just for me", 'card "Just for me"', async () => {
      // Second card of the three on the chooser.
      await page.getByRole("button", { name: /^continue$/i }).nth(1).click();
      await expect(page.getByLabel("Display name")).toBeVisible();
    });

    await run(page, "create the workspace", 'button "Create workspace"', async () => {
      await page.getByLabel("Display name").fill("QA Solo");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.waitForURL(/\/(work|onboarding)/, { timeout: 60_000 });
    });

    const later = page.getByRole("button", { name: /i'll do this later/i }).first();
    if (await later.count()) {
      await run(page, "skip the rest of setup", 'button "I\'ll do this later"', async () => {
        await later.click();
        await page.waitForURL(/\/work/, { timeout: 60_000 });
      });
    }
  } else {
    step("setup already done, straight to Inbox", "url /work", true);
  }

  await run(page, "lands on Inbox", 'heading "Inbox"', async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /inbox/i }).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  for (const group of ["What landed", "Where it goes", "Look back"]) {
    await check(`sidebar group ${group}`, `text="${group}"`, async () => {
      await expect(page.getByText(group, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    });
  }

  for (const group of ["Your coach", "Run the firm"]) {
    await check(`sidebar hides ${group}`, `text="${group}"`, async () => {
      await expect(page.getByText(group, { exact: true })).toHaveCount(0);
    });
  }

  await check("members item reads Your coaches", 'link "Your coaches"', async () => {
    const item = page.locator('a[href="/members"]').first();
    if ((await item.count()) === 0) throw new Error("no people or coaches item is offered");
    const label = (await item.innerText()).trim();
    if (!/your coaches/i.test(label)) {
      throw new Error(`the item reads "${label}" in a solo workspace`);
    }
  });

  await check("solo admin can reach the workspace level", 'radio[name="org-data-level"]', async () => {
    await page.goto("/members", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[name="org-data-level"]').first()).toBeVisible({
      timeout: 20_000,
    });
  });



  await run(page, "paste a thread", 'button "Paste a thread"', async () => {
    await pasteThread(page);
  });

  await check("card appears in Not claimed yet", 'text="Not claimed yet"', async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Not claimed yet").first()).toBeVisible({ timeout: 60_000 });
  });

  await run(page, "open Your data", 'button "Your data"', async () => {
    await openYourData(page);
  });

  await check("set personal level to full work content", 'radio "Full work content"', async () => {
    const done = await pickLevel(page, "personal-data-level", "Full work content");
    if (!done) throw new Error("the highest level is blocked by the workspace ceiling");
  });

  await check("tier d switch, if offered", 'switch "Include shared work content"', async () => {
    const toggle = page.getByRole("switch", { name: /include shared work content/i }).first();
    if ((await toggle.count()) === 0) {
      throw new Error("no shared work content switch is offered on the personal surface");
    }
    if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  });

  await page.screenshot({ path: `${SHOTS}/personal-your-data.png` });
  step("screenshot Your data", `${SHOTS}/personal-your-data.png`, true);

  reportFindings("personal");
});
