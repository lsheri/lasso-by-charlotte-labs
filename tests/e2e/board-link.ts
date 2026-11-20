import type { Page } from "@playwright/test";

/**
 * The address of a board's canvas, found the way the signed-in person would find it. Home's board cards carry one for
 * everyone but an admin. Since 21 Nov (D-82) an admin's Home is the operating picture and their boards sit in a lower
 * menu section that starts closed, so for them this opens that section and its first shelf and takes the first board.
 */
export async function firstBoardCanvasHref(page: Page): Promise<string> {
  const card = page.locator('a[href*="/canvas-lab"]').first();
  const lower = page.getByTestId("nav-boards-toggle").first();
  await card.or(lower).first().waitFor({ state: "attached", timeout: 30_000 });
  if (!(await card.count()) && (await lower.count())) {
    if ((await lower.getAttribute("aria-expanded")) === "false") await lower.click();
    const section = page.locator("[data-nav-lower-boards]").first();
    const shelf = section.locator('button[aria-expanded="false"]').first();
    const board = section.locator('a[href^="/engagements/"]').first();
    await board.or(shelf).first().waitFor({ state: "attached", timeout: 15_000 });
    if (!(await board.count())) await shelf.click();
    await board.waitFor({ state: "attached", timeout: 15_000 });
    const href = (await board.getAttribute("href")) ?? "";
    const id = /\/engagements\/([^/?#]+)/.exec(href)?.[1];
    if (!id) throw new Error(`no board link in the Boards section (${href})`);
    return `/engagements/${id}/canvas-lab`;
  }
  const href = await card.getAttribute("href");
  if (!href) throw new Error("no board link found");
  return href;
}
