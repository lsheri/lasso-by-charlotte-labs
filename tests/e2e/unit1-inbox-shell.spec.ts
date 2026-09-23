import { test, type Page } from "@playwright/test";

import { signIn } from "./qa-helpers";

/** Unit 1 verification: measures the Inbox shell. Reports, never fails on findings. */

const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const SHOTS = process.env["LASSO_SHOT_DIR"] ?? "test-results";

async function measure(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const r = (el: Element | null) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) };
    };
    const header = document.querySelector("header");
    const every = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Everything");
    let chipRow: Element | null = every ?? null;
    while (chipRow && chipRow.parentElement && !/h-\[46px\]/.test((chipRow as HTMLElement).className || "")) chipRow = chipRow.parentElement;
    if (chipRow && !/h-\[46px\]/.test((chipRow as HTMLElement).className || "")) chipRow = every?.parentElement ?? null;
    const shell = document.querySelector('[data-testid="board-shell"]');
    const stage = document.querySelector('[data-testid="board-shell-stage"]') as HTMLElement | null;
    const tf = stage ? getComputedStyle(stage).transform : "none";
    let scale: number | null = null, tx: number | null = null, ty: number | null = null;
    const mm = tf.match(/matrix\(([^)]+)\)/);
    if (mm) { const p = mm[1].split(",").map(Number); scale = +p[0].toFixed(4); tx = Math.round(p[4]); ty = Math.round(p[5]); }
    const lanes = Array.from(document.querySelectorAll("[data-board-lane]")) as HTMLElement[];
    const src = document.querySelector('[data-board-frame="inbox-sources"]');
    const sr = r(src), shr = r(shell);
    const inside = sr && shr ? sr.top >= shr.top && sr.left >= shr.left && sr.top + sr.height <= shr.top + shr.height && sr.left + sr.width <= shr.left + shr.width : null;
    return {
      scrollHeight: document.scrollingElement?.scrollHeight ?? -1,
      innerHeight: window.innerHeight,
      header: r(header)?.height ?? null,
      headerTagCount: document.querySelectorAll("header").length,
      inboxHeaderH16: r(Array.from(document.querySelectorAll(".h-16")).find((e) => e.textContent?.includes("Inbox")) ?? null)?.height ?? null,
      chipRow: r(chipRow)?.height ?? null,
      shell: shr,
      transform: tf, scale, tx, ty,
      lanes: lanes.map((l) => `${l.style.width}x${l.style.height}`),
      firstLaneRenderedWidth: r(lanes[0] ?? null)?.width ?? null,
      sources: sr, sourcesInside: inside,
      toolbar: r(document.querySelector('[data-testid="board-shell-toolbar"]')),
      mains: document.querySelectorAll("main").length,
    };
  });
  console.log(`MEASURE ${label} ${JSON.stringify(m)}`);
}

async function openMenu(page: Page) {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Bring work in/ }).first().click();
  await page.waitForTimeout(300);
}

const dialogVisible = (page: Page) => page.locator('[role="dialog"]').first().isVisible().catch(() => false);

async function result(name: string, fn: () => Promise<string>) {
  try { console.log(`RESULT ${name} :: ${await fn()}`); }
  catch (e) { console.log(`RESULT ${name} :: FAIL error ${(e as Error).message.split("\n")[0]}`); }
}

test("unit1 inbox shell", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, EMAIL, /sign in/i).catch((e) => console.log(`SIGNIN note ${String(e).split("\n")[0]} url=${page.url()}`));
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Everything" }).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  const honesty = await page.getByRole("button", { name: /Nothing is hidden\.$/ }).first().textContent().catch(() => null);
  console.log(`ITEMS honesty=${JSON.stringify(honesty)}`);

  for (const [w, h] of [[1440, 900], [1280, 800], [1094, 658], [1440, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(600);
    await measure(page, `${w}x${h}`);
    if (w === 1094) await page.screenshot({ path: `${SHOTS}/unit1-1094x658.png`, fullPage: true });
  }
  await page.screenshot({ path: `${SHOTS}/unit1-1440x900.png`, fullPage: true });

  await result("menu entries", async () => {
    await openMenu(page);
    const items = await page.locator('[role="menu"] [role="menuitem"], [role="menu"] button').allInnerTexts();
    return `${items.length ? "PASS" : "FAIL"} ${JSON.stringify(items.map((t) => t.trim()).filter(Boolean))}`;
  });
  await result("Paste a thread", async () => {
    await page.locator('[role="menu"]').getByText(/Paste a thread/).first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const v = await dialogVisible(page); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    return `${v ? "PASS" : "FAIL"} dialog visible=${v}`;
  });
  await result("Import AI history", async () => {
    await openMenu(page);
    await page.locator('[role="menu"]').getByText(/Import AI history/).first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const v = await dialogVisible(page); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    return `${v ? "PASS" : "FAIL"} dialog visible=${v}`;
  });
  await result("Upload files", async () => {
    await openMenu(page);
    const chooser = page.waitForEvent("filechooser", { timeout: 1500 }).then(() => true).catch(() => false);
    await page.locator('[role="menu"]').getByText(/Upload files/).first().click({ timeout: 5000 });
    const fc = await chooser; const d = await dialogVisible(page);
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    return `${fc || d ? "PASS" : "FAIL"} filechooser=${fc} dialog=${d}`;
  });
  await result("Connected apps", async () => {
    await openMenu(page);
    await page.locator('[role="menu"]').getByText(/Connected apps/).first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const v = await dialogVisible(page); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    return `${v ? "PASS" : "FAIL"} settings dialog visible=${v} url=${page.url()}`;
  });
  await result("Arrived chip", async () => {
    const chip = page.getByRole("button", { name: /^Arrived/ }).first();
    if (!(await chip.count())) return "N/A no Arrived chip rendered";
    await chip.click(); await page.waitForTimeout(300);
    const v = await page.locator('[aria-label="Arrived"]').first().isVisible().catch(() => false);
    await page.keyboard.press("Escape");
    return `${v ? "PASS" : "FAIL"} arrived panel visible=${v}`;
  });
  await result("Nothing is hidden", async () => {
    const b = page.getByRole("button", { name: /Nothing is hidden\.$/ }).first();
    if (!(await b.count())) return "FAIL button absent";
    await b.click(); await page.waitForTimeout(300);
    const pop = page.locator("[data-radix-popper-content-wrapper]").first();
    const v = await pop.isVisible().catch(() => false);
    const txt = v ? (await pop.innerText()).slice(0, 120).replace(/\n/g, " | ") : "";
    await page.keyboard.press("Escape");
    return `${v ? "PASS" : "FAIL"} popover visible=${v} text="${txt}"`;
  });
  await result("Unmapped/Everything toggle", async () => {
    const errs: string[] = []; page.on("pageerror", (e) => errs.push(e.message));
    const un = page.getByRole("button", { name: /^Unmapped/ }).first();
    const ev = page.getByRole("button", { name: "Everything" }).first();
    await un.click(); await page.waitForTimeout(400);
    const a1 = [await un.getAttribute("class"), await ev.getAttribute("class")];
    await ev.click(); await page.waitForTimeout(400);
    const a2 = [await un.getAttribute("class"), await ev.getAttribute("class")];
    const toggled = a1[0] !== a2[0] && a1[1] !== a2[1];
    return `${toggled && !errs.length ? "PASS" : "FAIL"} classesToggled=${toggled} errors=${errs.length}`;
  });
  await result("Suggest mapping", async () => {
    const n = await page.getByRole("button", { name: /Suggest mapping|Thinking/ }).count();
    const un = await page.getByRole("button", { name: /^Unmapped/ }).first().innerText();
    return `INFO present=${n > 0} unmappedChip="${un.trim()}"`;
  });
});
