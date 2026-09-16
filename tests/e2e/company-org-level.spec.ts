import { expect, test } from "@playwright/test";

import {
  PASSWORD,
  SHOTS,
  check,
  openYourData,
  pickLevel,
  reportFindings,
  run,
  signIn,
  step,
} from "./qa-helpers";

const EMAIL = "qa.company.admin@qaprobe.test";

test("admin sets the workspace level and the personal ceiling follows", async ({ page }) => {
  expect(PASSWORD, "LASSO_QA_PASSWORD must be set in the environment").not.toBe("");

  await signIn(page, EMAIL, /sign in/i);

  await run(page, "open the workspace data surface", "/members", async () => {
    await page.goto("/members", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[name="org-data-level"]').first()).toBeVisible({
      timeout: 60_000,
    });
  });

  await run(page, "set the workspace level to full work content", 'radio "Full work content"', async () => {
    const done = await pickLevel(page, "org-data-level", "Full work content");
    if (!done) throw new Error("the highest workspace level is not selectable");
  });

  await run(page, "turn the shared work content switch on", 'switch "Include shared work content"', async () => {
    const toggle = page.getByRole("switch", { name: /include shared work content/i }).first();
    await expect(toggle).toBeVisible({ timeout: 60_000 });
    if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true", { timeout: 60_000 });
  });

  await page.screenshot({ path: `${SHOTS}/company-org-data.png` });
  step("screenshot the workspace data settings", `${SHOTS}/company-org-data.png`, true);

  await check("personal page reads the new ceiling", 'text="allows up to: Full work content"', async () => {
    await openYourData(page);
    await expect(page.getByText(/allows up to: Full work content/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  await check("full work content is selectable for a person", 'radio "Full work content"', async () => {
    const radio = page
      .locator('label:has(input[name="personal-data-level"])')
      .filter({ hasText: "Full work content" })
      .first()
      .locator("input");
    await expect(radio).toBeEnabled({ timeout: 20_000 });
  });

  reportFindings("company org level");
});
