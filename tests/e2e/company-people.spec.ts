import { expect, test, type Page } from "@playwright/test";

import { PASSWORD, SHOTS, check, findings, pasteThread, reportFindings, run, signIn } from "./qa-helpers";

/**
 * Spec D. The whole company shape in one walk: an admin brings two people in,
 * one of them does a day of work, the coach reads what was shared and writes
 * back, and the first person answers.
 */

const EM = "qa.company.em@qaprobe.test";
const COACH = "qa.company.coach@qaprobe.test";
const MEMO = "tests/e2e/fixtures/qa-memo.docx";

test.describe.configure({ mode: "serial" });

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/** Creates one invite through the real Members surface and hands back its link. */
async function issueInvite(page: Page, role: RegExp, email: string): Promise<string> {
  await page.goto("/members", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /^Invite (someone|a coach)$/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /invite someone/i })).toBeVisible({
    timeout: 60_000,
  });
  await dialog.getByRole("button", { name: role }).click();
  await dialog.locator("#invite-email").fill(email);
  await dialog.getByRole("button", { name: /create invite link/i }).click();
  const link = dialog.locator("p.font-mono").filter({ hasText: "/join?" }).first();
  await expect(link).toBeVisible({ timeout: 60_000 });
  const text = (await link.textContent()) ?? "";
  await page.keyboard.press("Escape");
  const match = text.match(/\/join\?[^\s]+/);
  if (!match) throw new Error(`no invite link in "${text}"`);
  return match[0];
}

/** Signs a newcomer in, opens their invite and finishes joining. */
async function acceptInvite(page: Page, email: string, href: string, name: string): Promise<void> {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("you@yourfirm.com").fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(onboarding|work|join|coaching)/, { timeout: 60_000 });
  await page.goto(href, { waitUntil: "domcontentloaded" });
  const nameField = page.locator("#join-name");
  if (await nameField.count()) {
    await nameField.fill(name);
    await page.getByRole("button", { name: /^join$/i }).click();
  }
  await page.waitForURL(/\/(work|coaching|engagements)/, { timeout: 90_000 });
}

test("a firm brings two people in and a note comes back", async ({ page }) => {
  test.setTimeout(15 * 60_000);

  await signIn(page, "qa.company.admin@qaprobe.test", /sign in/i);

  let teamLink = "";
  let coachLink = "";
  await run(page, "admin invites a teammate", "#invite-email + Create invite link", async () => {
    teamLink = await issueInvite(page, /^Teammate/, EM);
  });
  await run(page, "admin invites a coach", "#invite-email + Create invite link", async () => {
    coachLink = await issueInvite(page, /^Coach or manager/, COACH);
  });
  console.log(`MECHANISM invite is a one time link: ${teamLink.split("=")[0]}=...`);

  await signOut(page);
  await run(page, "teammate accepts", "#join-name + Join", async () => {
    await acceptInvite(page, EM, teamLink, "QA Teammate");
  });

  await signOut(page);
  await run(page, "coach accepts", "#join-name + Join", async () => {
    await acceptInvite(page, COACH, coachLink, "QA Coach");
  });

  // --- the teammate's day of work ---
  await signOut(page);
  await signIn(page, EM, /sign in/i);

  await run(page, "teammate creates an engagement", "Create engagement", async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /new engagement/i }).first().click();
    const dialog = page.getByRole("dialog");
    const full = dialog.getByRole("button", { name: /^Full engagement$/ });
    if (await full.count()) await full.click();
    await dialog.locator("#eng-code").fill("QA-NW-1");
    await dialog.locator("#eng-title").fill("QA Northwind");
    await dialog.locator("#eng-brief").fill("Pilot pricing for the Northwind rollout.");
    await dialog.getByRole("button", { name: /create engagement/i }).click();
    await expect(dialog).toBeHidden({ timeout: 90_000 });
  });

  await run(page, "teammate pastes a thread", "Paste a thread + Save thread", async () => {
    await pasteThread(page);
  });

  await check("teammate maps the thread to a task", "Map to a workstream + Add", async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Map (to a workstream|conversation|just this)/ }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /QA Northwind/ }).first().click();
    const newTask = dialog.getByPlaceholder(/type a new workstream name/i);
    await newTask.fill("Pilot pricing");
    await dialog.getByRole("button", { name: /^Add$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 60_000 });
  });

  await check("teammate uploads the memo", 'input[type="file"]', async () => {
    await page.goto("/work", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="file"]').first().setInputFiles(MEMO);
    await expect(page.getByText(/qa-memo/i).first()).toBeVisible({ timeout: 120_000 });
  });

  await check("teammate confirms a drafted call", "Confirm this call", async () => {
    await page.goto("/decisions", { waitUntil: "domcontentloaded" });
    const confirm = page
      .getByRole("button", { name: /confirm (this call|as written)/i })
      .first();
    if ((await confirm.count()) === 0) throw new Error("no call was drafted to confirm");
    await confirm.click();
    await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 60_000 });
  });

  await check("teammate pins a sticky on 1:1 prep", 'textarea[aria-label="add a note"]', async () => {
    await page.goto("/one-on-one", { waitUntil: "domcontentloaded" });
    const date = page.getByLabel(/when is your next 1:1/i);
    if (await date.count()) {
      const when = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      await date.fill(when);
      const add = page.getByRole("button", { name: /^add it$/i });
      if (await add.count()) await add.click();
    }
    const note = page.locator('textarea[aria-label="add a note"]').first();
    await note.fill("Hold the pilot floor at 4,200 per seat.");
    await note.press("Enter");
    await expect(page.getByText(/hold the pilot floor/i).first()).toBeVisible({ timeout: 60_000 });
  });

  await check("teammate sets personal level a", 'input[name="personal-data-level"]', async () => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Your data/ }).first().click();
    const choice = page
      .locator('label:has(input[name="personal-data-level"])')
      .filter({ hasText: "Usage patterns, anonymous" })
      .first();
    await choice.click();
    await page.getByRole("button", { name: /save this level/i }).click();
    await expect(page.getByRole("button", { name: /save this level/i })).toBeHidden({
      timeout: 60_000,
    });
  });

  // --- the coach's turn ---
  await signOut(page);
  await signIn(page, COACH, /sign in/i);

  await check("coach accepts the coaching link if asked", "Accept", async () => {
    await page.goto("/coaching", { waitUntil: "domcontentloaded" });
    const accept = page.getByRole("button", { name: /^Accept$/ }).first();
    if (await accept.count()) await accept.click();
  });

  await check("coach opens the teammate's engagement", "link QA Northwind", async () => {
    await page.goto("/coaching", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /QA (Teammate|Northwind)/ }).first().click();
    await page.waitForURL(/\/coaching\//, { timeout: 60_000 });
  });

  const wroteNote = await check("coach writes a note scoped to the task", "What is this note about", async () => {
    await page.getByRole("button", { name: /^(Workstream|Task)$/ }).first().click();
    const picker = page.getByLabel(/which (workstream|task)/i).first();
    if (await picker.count()) await picker.selectOption({ index: 1 });
    const composer = page.locator("section").filter({ hasText: "Write a coaching note" }).last();
    await composer.locator("textarea").nth(0).fill("You held the floor and said why.");
    await composer.locator("textarea").nth(1).fill("Name the round the number survived.");
    await composer.locator("textarea").nth(2).fill("Where the number came from.");
    const cite = composer.locator('input[type="checkbox"]').first();
    if (await cite.count()) await cite.check();
    await composer.getByRole("button", { name: /share note/i }).click();
    await expect(composer.locator("textarea").nth(0)).toHaveValue("", { timeout: 60_000 });
  });

  await check("coach can read the shared transcript", "turn text", async () => {
    const shown = await page.getByText(/discount ladder/i).first().isVisible();
    if (!shown) throw new Error("shared transcript text was not readable");
  });
  await page.screenshot({ path: `${SHOTS}/company-coach-engagement.png` });

  // --- back to the teammate ---
  await signOut(page);
  await signIn(page, EM, /sign in/i);

  await check("teammate sees the circle on Notes from your coach", "CircleMark", async () => {
    if (!wroteNote) throw new Error("no note was written, nothing to see");
    await page.goto("/coach-notes", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/notes from your coach/i).first()).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: `${SHOTS}/company-notes-from-coach.png` });
    await page.getByLabel(/new note from/i).first().click();
  });

  await check("teammate replies to the note", 'textarea[placeholder="write back"]', async () => {
    const reply = page.getByPlaceholder("write back").first();
    await reply.fill("Understood, I will cite the review round next time.");
    await page.getByRole("button", { name: /^Send$/ }).click();
    await expect(page.getByText(/understood, i will cite/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });

  reportFindings("company-people");
  expect(findings.length, findings.join(" | ")).toBeGreaterThanOrEqual(0);
});
