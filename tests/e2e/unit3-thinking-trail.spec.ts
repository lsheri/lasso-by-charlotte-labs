import { expect, test } from "@playwright/test";

import { signIn } from "./qa-helpers";

const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const SHOTS = process.env["LASSO_SHOT_DIR"] ?? "test-results";

test("unit3 thinking line and response inputs", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, EMAIL, /sign in/i).catch((error) => console.log(`SIGNIN note ${String(error).split("\n")[0]} url=${page.url()}`));
  await page.goto("/ai-record", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "All conversations" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Ask Lasso" }).first().click();
  const dialog = page.getByRole("dialog", { name: /Ask Lasso/i });
  await expect(dialog).toBeVisible();
  console.log("RESULT Ask Lasso :: PASS open=true");

  const audit = dialog.getByRole("button", { name: /Read what went into this response/i });
  if ((await audit.count()) === 0) {
    const past = dialog.getByRole("button", { name: "Past chats", exact: true });
    if (await past.count()) {
      await past.click();
      await page.waitForTimeout(800);
      const history = dialog.locator("button").filter({ hasNotText: "New session" });
      for (let index = 0; index < Math.min(await history.count(), 8); index += 1) {
        const candidate = history.nth(index);
        const text = (await candidate.innerText({ timeout: 1_000 }).catch(() => "")).trim();
        if (!text || ["Messages", "Past chats", "Close"].includes(text)) continue;
        await candidate.click({ timeout: 1_000 }).catch(() => undefined);
        await page.waitForTimeout(700);
        if (await audit.count()) break;
      }
    }
  }

  if (await audit.count()) {
    const line = audit.first();
    console.log(`AUDIT closed=${JSON.stringify((await line.innerText()).replace(/\s+/g, " ").trim())}`);
    const before = await line.locator("span").first().getAttribute("class");
    await line.click();
    const headers = await dialog.locator("[data-audit-group] h4").allInnerTexts();
    const rows = Object.fromEntries(await Promise.all(["read", "also-in", "not-read"].map(async (group) => [group, await dialog.locator(`[data-audit-group="${group}"] p`).count()])));
    const after = await line.locator("span").first().getAttribute("class");
    console.log(`AUDIT open=${JSON.stringify({ headers, rows, caretRotated: !before?.includes("rotate-90") && after?.includes("rotate-90") })}`);
    await dialog.screenshot({ path: `${SHOTS}/unit3-audit-open.png` });
  } else {
    console.log("AUDIT unavailable=no past response with a manifest");
  }

  const composer = dialog.getByPlaceholder("What do you want to think through? Type @ to point at a piece of work. Type / for a workstream.");
  const send = dialog.getByRole("button", { name: "Send", exact: true });
  if ((await composer.count()) && (await send.count()) && (await send.isEnabled())) {
    await composer.fill("What is in this record?");
    await send.click();
    const samples: Array<{ rows: number; live: number; phase: string | null; elapsed: string | null }> = [];
    for (let index = 0; index < 40; index += 1) {
      await page.waitForTimeout(500);
      samples.push(await dialog.evaluate((root) => {
        const rows = [...root.querySelectorAll<HTMLElement>("[data-trail-state]")];
        const working = [...root.querySelectorAll<HTMLElement>("div")].find((element) => element.querySelector('[data-lasso-thinking-mark="loop"]') && /\d+:\d{2}/.test(element.textContent ?? ""));
        const elapsed = working?.textContent?.match(/\d+:\d{2}/)?.[0] ?? null;
        const phase = working?.querySelectorAll("span")[1]?.textContent ?? null;
        return { rows: rows.length, live: rows.findIndex((row) => row.classList.contains("live")), phase, elapsed };
      }));
      if (await dialog.getByRole("button", { name: /Read what went into this response/i }).count()) break;
    }
    console.log(`TRAIL samples=${JSON.stringify(samples)}`);
    console.log(`TRAIL maxRows=${Math.max(...samples.map((sample) => sample.rows))}`);
    const completed = dialog.getByRole("button", { name: /Read what went into this response/i }).last();
    console.log(`AUDIT completed=${JSON.stringify(await completed.count() ? (await completed.innerText()).replace(/\s+/g, " ").trim() : "not completed within 20s")}`);
  } else {
    console.log("TRAIL unavailable=composer could not send from this surface");
  }
});