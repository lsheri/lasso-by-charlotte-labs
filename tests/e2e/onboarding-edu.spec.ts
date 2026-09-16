import { expect, test } from "@playwright/test";

import {
  PASSWORD,
  SHOTS,
  check,
  findings,
  openYourData,
  pasteThread,
  pickLevel,
  reportFindings,
  run,
  signIn,
  step,
} from "./qa-helpers";

const EMAIL = "qa.edu.teacher@qaprobe.test";

const SCHOOL_WORDS = ["Classes", "Assignments", "Projects", "Portfolio"];

test("teacher walks the school setup and reads school words", async ({ page }) => {
  expect(PASSWORD, "LASSO_QA_PASSWORD must be set in the environment").not.toBe("");

  await signIn(page, EMAIL, /sign in/i);

  const chooser = page.getByRole("heading", { name: "Who is this for?" });
  const needsSetup = await chooser
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (needsSetup) {
    await check("chooser offers a school card", 'card "For my school work"', async () => {
      await expect(page.getByText(/school/i).first()).toBeVisible({ timeout: 5_000 });
    });

    await run(page, "take the school door", "/onboarding?intent=edu", async () => {
      await page.goto("/onboarding?intent=edu", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("For my school work")).toBeVisible({ timeout: 60_000 });
    });

    await check("school setup can be named", 'label "Workspace name"', async () => {
      await expect(page.getByLabel("Workspace name")).toBeVisible({ timeout: 5_000 });
      await page.getByLabel("Workspace name").fill("QA School");
    });

    await run(page, "create the workspace", 'button "Create workspace"', async () => {
      await page.getByLabel("Display name").fill("QA School Teacher");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page
        .getByRole("button", { name: /(i'll do this later|continue)/i })
        .first()
        .waitFor({ state: "visible", timeout: 60_000 })
        .catch(async () => {
          const shown = (await page.locator("main").innerText()).slice(0, 400);
          throw new Error(`setup did not move on. Screen said: ${shown.replace(/\s+/g, " ")}`);
        });
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

  await check("sidebar group Your classes", 'text="Your classes"', async () => {
    await expect(page.getByText("Your classes", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  for (const word of SCHOOL_WORDS) {
    await check(`school word ${word}`, `link "${word}"`, async () => {
      await expect(page.getByRole("link", { name: word, exact: true }).first()).toBeVisible({
        timeout: 20_000,
      });
    });
  }

  await check("no consulting words in the sidebar", 'text="Engagements"', async () => {
    await expect(page.getByText("Engagements", { exact: true })).toHaveCount(0);
  });

  await check("paste a thread", 'button "Paste a thread"', async () => {
    await pasteThread(page);
  });

  await check("set personal level to b", 'radio "Usage patterns, linked over time"', async () => {
    await openYourData(page);
    const done = await pickLevel(page, "personal-data-level", "Usage patterns, linked over time");
    if (!done) throw new Error("that level is blocked by the workspace ceiling");
  });

  await page.goto("/work", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /inbox/i }).first()).toBeVisible({
    timeout: 60_000,
  });
  await page.screenshot({ path: `${SHOTS}/edu-inbox.png` });
  step("screenshot Inbox", `${SHOTS}/edu-inbox.png`, true);

  findings.push(
    'the "Who is this for?" chooser offers company, just for me and an invite code only, so a school person has no school door there',
  );
  reportFindings("edu");
});
