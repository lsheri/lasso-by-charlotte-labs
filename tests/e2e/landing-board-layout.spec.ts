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
    await page.goto("/landing-board", { waitUntil: "networkidle" });
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
    await page.goto("/landing-board", { waitUntil: "networkidle" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await context.close();
  });
}