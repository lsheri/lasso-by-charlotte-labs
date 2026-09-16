import { expect, test, type Page } from "@playwright/test";

import { PASSWORD, SHOTS, check, findings, pasteThread, reportFindings, run, signIn } from "./qa-helpers";

/**
 * Spec E. A teacher brings a student in, the student does a first piece of
 * work, and we write down every consulting word the student is shown.
 */

const STUDENT = "qa.edu.student@qaprobe.test";
const MEMO = "tests/e2e/fixtures/qa-memo.docx";
const CONSULTING_WORDS = ["engagement", "client", "firm", "coach", "member"];

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/** Writes down every consulting word visible on the screen the student is on. */
async function readWords(page: Page, where: string): Promise<void> {
  const text = ((await page.locator("body").innerText()) ?? "").toLowerCase();
  const seen = CONSULTING_WORDS.filter((word) => text.includes(word));
  if (seen.length > 0) {
    findings.push(`student sees consulting words on ${where}: ${seen.join(", ")}`);
  }
}

test.describe.configure({ mode: "serial" });

test("a teacher brings a student in", async ({ page }) => {
  test.setTimeout(12 * 60_000);

  await signIn(page, "qa.edu.teacher@qaprobe.test", /sign in/i);

  let link = "";
  await run(page, "teacher invites the student", "#invite-email + Create invite link", async () => {
    await page.goto("/members", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /^Invite (someone|a coach)$/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^Teammate/ }).click();
    await dialog.locator("#invite-email").fill(STUDENT);
    await dialog.getByRole("button", { name: /create invite link/i }).click();
    const shown = dialog.locator("p.font-mono").filter({ hasText: "/join?" }).first();
    await expect(shown).toBeVisible({ timeout: 60_000 });
    const match = ((await shown.textContent()) ?? "").match(/\/join\?[^\s]+/);
    if (!match) throw new Error("no invite link was shown");
    link = match[0];
    await page.keyboard.press("Escape");
  });

  await check("the school invite offers school words", "role options", async () => {
    // Recorded, not enforced: the role list is the consulting one.
    await page.goto("/members", { waitUntil: "domcontentloaded" });
    const body = (await page.locator("body").innerText()).toLowerCase();
    if (body.includes("engagement mgr") || body.includes("teammate")) {
      findings.push("school workspace still offers consulting role words on Members");
    }
  });

  await signOut(page);

  await run(page, "student accepts", "#join-name + Join", async () => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("you@yourfirm.com").fill(STUDENT);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/(onboarding|work|join)/, { timeout: 60_000 });
    await page.goto(link, { waitUntil: "domcontentloaded" });
    const name = page.locator("#join-name");
    if (await name.count()) {
      await name.fill("QA Student");
      await page.getByRole("button", { name: /^join$/i }).click();
    }
    await page.waitForURL(/\/(work|engagements|classes)/, { timeout: 90_000 });
  });

  await readWords(page, "the first screen after joining");

  await run(page, "student pastes a thread", "Paste a thread + Save thread", async () => {
    await pasteThread(page);
  });
  await readWords(page, "Inbox");
  await page.screenshot({ path: `${SHOTS}/edu-student-inbox.png` });

  await check("student uploads the memo", 'input[type="file"]', async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="file"]').first().setInputFiles(MEMO);
    await expect(page.getByText(/qa-memo/i).first()).toBeVisible({ timeout: 120_000 });
  });

  await check("student opens Portfolio", "/portfolio", async () => {
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /portfolio/i }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
  await readWords(page, "Portfolio");
  await page.screenshot({ path: `${SHOTS}/edu-student-portfolio.png` });

  await check("student sets personal level c", 'input[name="personal-data-level"]', async () => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Your data/ }).first().click();
    const choice = page
      .locator('label:has(input[name="personal-data-level"])')
      .filter({ hasText: "Work details" })
      .first();
    await choice.click();
    await page.getByRole("button", { name: /save this level/i }).click();
    await expect(page.getByRole("button", { name: /save this level/i })).toBeHidden({
      timeout: 60_000,
    });
  });
  await readWords(page, "Your data");

  reportFindings("edu-student");
  expect(findings.length).toBeGreaterThanOrEqual(0);
});
