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

for (const viewport of [{ width: 1372, height: 732 }, { width: 390, height: 844 }]) {
  test(`playable demo restores a dragged card at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
    test.setTimeout(30_000);
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/demo", { waitUntil: "networkidle" });
    const card = page.getByTestId("demo-play-card-0");
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