import { test, type Page } from "@playwright/test";

import { signIn } from "./qa-helpers";

/** Unit 2 verification: measures the All conversations shell and reports findings. */
const EMAIL = "liam@charlotte-labs.com";
const SHOTS = process.env["LASSO_SHOT_DIR"] ?? "test-results";

async function measure(page: Page, label: string) {
  const measured = await page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom), right: Math.round(box.right) };
    };
    const heading = Array.from(document.querySelectorAll("h1")).find((element) => element.textContent?.trim() === "All conversations");
    const header = heading?.closest("header") ?? null;
    const chipRow = header?.nextElementSibling ?? null;
    const shell = document.querySelector('[data-testid="board-shell"]');
    const stage = document.querySelector('[data-testid="board-shell-stage"]') as HTMLElement | null;
    const transform = stage ? getComputedStyle(stage).transform : "none";
    let scale: number | null = transform === "none" ? 1 : null;
    let tx: number | null = null;
    let ty: number | null = null;
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (matrix) {
      const parts = matrix[1].split(",").map(Number);
      scale = Number(parts[0].toFixed(4));
      tx = Math.round(parts[4]);
      ty = Math.round(parts[5]);
    }
    const lanes = Array.from(document.querySelectorAll("[data-board-lane]")) as HTMLElement[];
    const shellRect = rect(shell);
    const firstLaneRect = rect(lanes[0] ?? null);
    const controls = Array.from(chipRow?.querySelectorAll("button") ?? []).map((button) => (button.textContent ?? "").trim().replace(/\s+/g, " "));
    const visibleCards = Array.from(document.querySelectorAll("[data-board-node]")).filter((node) => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
    });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: { scrollHeight: document.scrollingElement?.scrollHeight ?? -1, mainCount: document.querySelectorAll("main").length },
      header: rect(header),
      chipRow: rect(chipRow),
      shell: shellRect,
      toolbar: rect(document.querySelector('[data-testid="board-shell-toolbar"]')),
      transform,
      scale,
      tx,
      ty,
      laneCount: lanes.length,
      lanes: lanes.map((lane) => ({ style: `${lane.style.width}x${lane.style.height}`, rect: rect(lane) })),
      firstLaneInside: firstLaneRect && shellRect ? firstLaneRect.top >= shellRect.top && firstLaneRect.left >= shellRect.left && firstLaneRect.bottom <= shellRect.bottom && firstLaneRect.right <= shellRect.right : null,
      controls,
      noticeCount: document.querySelectorAll('[role="alert"], [data-testid*="notice"]').length,
      cardCount: document.querySelectorAll("[data-board-node]").length,
      visibleCardCount: visibleCards.length,
      countText: Array.from(chipRow?.querySelectorAll("button") ?? []).map((button) => button.textContent?.trim() ?? "").find((text) => /Showing |Nothing is deleted here/.test(text)) ?? null,
    };
  });
  console.log(`MEASURE ${label} ${JSON.stringify(measured)}`);
  return measured;
}

async function result(name: string, body: () => Promise<string>) {
  try { console.log(`RESULT ${name} :: ${await body()}`); }
  catch (error) { console.log(`RESULT ${name} :: FAIL ${(error as Error).message.split("\n")[0]}`); }
}

async function dismiss(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

test("unit2 all conversations shell", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, EMAIL, /sign in/i).catch((error) => console.log(`SIGNIN note ${String(error).split("\n")[0]} url=${page.url()}`));
  await page.goto("/ai-record", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "All conversations" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3000);

  const passes: Array<readonly [number, number]> = [[1440, 900], [1280, 800], [1094, 658], [1440, 900]];
  let firstScale: number | null = null;
  for (const [width, height] of passes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(700);
    const measured = await measure(page, `${width}x${height}`);
    if (firstScale === null && width === 1440 && height === 900) firstScale = measured.scale;
    if (width === 1094) await page.screenshot({ path: `${SHOTS}/unit2-1094x658.png` });
  }
  await page.screenshot({ path: `${SHOTS}/unit2-1440x900.png` });
  console.log(`RESULT stage scale 1440x900 :: ${firstScale === 1 ? "PASS" : "FAIL"} scale=${firstScale}`);

  await result("Preview and Sticky", async () => {
    const preview = page.getByRole("button", { name: "Preview" });
    const sticky = page.getByRole("button", { name: "Sticky" });
    await sticky.click(); await page.waitForTimeout(250);
    const stickyOn = await sticky.getAttribute("aria-pressed");
    await preview.click(); await page.waitForTimeout(250);
    const previewOn = await preview.getAttribute("aria-pressed");
    return `${stickyOn === "true" && previewOn === "true" ? "PASS" : "FAIL"} sticky=${stickyOn} preview=${previewOn}`;
  });
  await result("Add a chat", async () => {
    await page.getByRole("button", { name: "Add a chat" }).click(); await page.waitForTimeout(300);
    const visible = await page.locator('[role="dialog"]').first().isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} dialog=${visible}`;
  });
  await result("Ask Lasso", async () => {
    const button = page.getByRole("button", { name: "Ask Lasso" }).first();
    if (!(await button.count())) return "N/A coach view";
    await button.click(); await page.waitForTimeout(400);
    const visible = await page.getByRole("dialog", { name: /Ask Lasso/ }).isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} panel=${visible}`;
  });
  await result("source tabs", async () => {
    const captured = page.getByRole("button", { name: "Captured", exact: true });
    const asked = page.getByRole("button", { name: "Asked Lasso", exact: true });
    const everything = page.getByRole("button", { name: "Everything", exact: true }).first();
    if (!(await captured.count())) return "N/A coach view";
    await asked.click(); await page.waitForTimeout(300); const askedOn = await asked.getAttribute("aria-pressed");
    await everything.click(); await page.waitForTimeout(300); const everythingOn = await everything.getAttribute("aria-pressed");
    await captured.click(); await page.waitForTimeout(300); const capturedOn = await captured.getAttribute("aria-pressed");
    return `${askedOn === "true" && everythingOn === "true" && capturedOn === "true" ? "PASS" : "FAIL"} asked=${askedOn} everything=${everythingOn} captured=${capturedOn}`;
  });
  await result("Engagements", async () => {
    await page.getByRole("button", { name: /Engagements/ }).click(); await page.waitForTimeout(300);
    const visible = await page.getByRole("group", { name: "Filter by engagement" }).isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} popover=${visible}`;
  });
  await result("Subjects and links", async () => {
    const button = page.getByRole("button", { name: "Subjects and links" }).first();
    if (!(await button.count())) return "FAIL button absent";
    await button.click(); await page.waitForTimeout(350);
    const visible = await page.getByRole("dialog", { name: /Subjects and links/ }).isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} panel=${visible}`;
  });
  await result("coverage", async () => {
    const button = page.getByRole("button", { name: /Nothing is deleted here|Showing .* of/ }).first();
    if (!(await button.count())) return "FAIL count button absent";
    await button.click(); await page.waitForTimeout(350);
    const visible = await page.getByText("nothing here was written by Lasso").isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} popover=${visible}`;
  });
  await result("search", async () => {
    const search = page.getByRole("searchbox", { name: "Search your chats" });
    await search.fill("no-match-unit-two"); await search.press("Enter"); await page.waitForTimeout(300);
    const empty = await page.getByText("No chats match that search.").isVisible().catch(() => false);
    await search.fill(""); await page.waitForTimeout(300);
    return `${empty ? "PASS" : "FAIL"} empty=${empty}`;
  });
  await result("conversation reader", async () => {
    const card = page.locator("[data-board-node]").first();
    if (!(await card.count())) return "N/A no conversation cards";
    await card.click(); await page.waitForTimeout(500);
    const close = page.getByRole("button", { name: "Close the reader" });
    const visible = await close.isVisible().catch(() => false);
    if (visible) await close.click();
    return `${visible ? "PASS" : "FAIL"} reader=${visible}`;
  });
});
