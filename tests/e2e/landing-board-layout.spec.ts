import { expect, test } from "@playwright/test";

const desktopSizes = [
  { width: 1372, height: 732 },
  { width: 1512, height: 807 },
];

for (const viewport of desktopSizes) {
  test(`landing proof connector renders with normal motion at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    test.setTimeout(45_000);
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByTestId("landing-proof-card")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("landing-proof-connector")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await context.close();
  });
}

test("story captions and visible text stay readable across settled desktop steps", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1372, height: 732 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  for (const name of ["Canvas", "Workstreams", "Deliverable", "Circle", "Ask", "The turn", "Still open", "Share", "Try it"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const caption = page.locator('.lb-caption[data-phase="incoming"]');
    await expect(caption).toBeVisible();
    const geometry = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('.lb-caption[data-phase="incoming"]');
      const stage = document.querySelector<HTMLElement>(".lb-stage-window");
      if (!card || !stage) return null;
      const cardBox = card.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const panel = document.querySelector<HTMLElement>(".lb-answer-sheet");
      const boardRight = panel && getComputedStyle(panel).display !== "none" ? panel.getBoundingClientRect().left : stageBox.right;
      const body = card.querySelector("p");
      const visible = Array.from(stage.querySelectorAll<HTMLElement>("span,p,strong,small,h3,b,a,button"))
        .filter((element) => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element); return Boolean(element.textContent?.trim()) && box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.opacity !== "0" && !element.closest(".lb-deck-slide:not(.lb-slide-number)"); })
        .slice(0, 20)
        .map((element) => { const style = getComputedStyle(element); return { text: element.textContent?.trim(), size: Number.parseFloat(style.fontSize), height: element.getBoundingClientRect().height }; });
      return { delta: Math.abs((cardBox.left + cardBox.width / 2) - (stageBox.left + (boardRight - stageBox.left) / 2)), bodySize: body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0, visible };
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.delta ?? 999).toBeLessThanOrEqual(24);
    expect(geometry?.bodySize ?? 0).toBeGreaterThanOrEqual(19);
    for (const node of geometry?.visible ?? []) expect(Math.min(node.size, node.height), node.text).toBeGreaterThanOrEqual(12);
  }
  await context.close();
});

test("story caption body is readable on phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  const body = page.locator('.lb-caption[data-phase="incoming"] p');
  await expect(body).toBeVisible();
  expect(await body.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(17);
  await context.close();
});

for (const viewport of [...desktopSizes, { width: 390, height: 844 }]) {
  test(`landing page has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await context.close();
  });
}

for (const viewport of [{ width: 1372, height: 732 }, { width: 390, height: 844 }]) {
  test(`landing hero actions and scroll cue work at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const cue = page.getByTestId("landing-scroll-cue");
    await expect(cue).toBeVisible();
    await page.getByRole("button", { name: "Watch it work", exact: true }).click();
    await expect(page.locator(".lb-stage-window")).toHaveAttribute("data-step", "2");
    await expect(cue).toBeHidden();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "View a Workboard", exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await context.close();
  });
}

for (const viewport of desktopSizes) {
  test(`playable demo fits readable content at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    const zoomText = page.locator(".demo-workboard-zoom span");
    await expect.poll(async () => Number((await zoomText.textContent())?.replace("%", "") ?? 0)).toBeGreaterThanOrEqual(80);
    const proofButtons = page.locator(".demo-sandbox-ask .lb-proof-actions a, .demo-sandbox-ask .lb-proof-actions button");
    await expect(proofButtons).toHaveCount(2);
    for (const button of await proofButtons.all()) {
      expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await expect(page.locator('[data-testid^="lab-card-demo:"]').filter({ hasText: "slide notes" })).toHaveCount(0);
    await expect(page.getByText("(slide notes)", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect.poll(async () => Number((await zoomText.textContent())?.replace("%", "") ?? 0)).toBeGreaterThanOrEqual(80);
    await context.close();
  });
}

for (const viewport of [{ width: 1372, height: 732 }, { width: 390, height: 844 }]) {
  test(`playable demo restores a dragged card at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    test.setTimeout(30_000);
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    const card = page.locator('[data-testid^="lab-card-demo:"]').first();
    await expect(card).toBeVisible();
    const before = await card.boundingBox();
    if (!before) throw new Error("Demo card has no rendered bounds");
    await card.hover();
    await page.mouse.down();
    await page.mouse.move(before.x + 80, before.y + 55, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await card.boundingBox())?.x).not.toBeCloseTo(before.x, 0);
    await page.waitForTimeout(6_000);
    await expect.poll(async () => (await card.boundingBox())?.x, { timeout: 2_000 }).toBeCloseTo(before.x, 0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await context.close();
  });
}