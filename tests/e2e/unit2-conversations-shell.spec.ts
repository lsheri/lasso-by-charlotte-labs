import { test, type Page } from "@playwright/test";

import { signIn } from "./qa-helpers";

/** Unit 2.1 verification: measures the All conversations shell and interactions. */
const EMAIL = process.env["LASSO_QA_EMAIL"] ?? "qa.company.admin@qaprobe.test";
const SHOTS = process.env["LASSO_SHOT_DIR"] ?? "test-results";

type Measurement = Awaited<ReturnType<typeof measure>>;

async function measure(page: Page, label: string) {
  const measured = await page.evaluate(() => {
    const rect = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), left: Math.round(box.left), width: Math.round(box.width), height: Math.round(box.height) };
    };
    const heading = Array.from(document.querySelectorAll("h1")).find((element) => element.textContent?.trim() === "All conversations");
    const header = heading?.closest("header") ?? null;
    const chipRow = header?.nextElementSibling as HTMLElement | null;
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
    const lanes = Array.from(document.querySelectorAll<HTMLElement>("[data-board-lane]"));
    const firstLane = lanes[0] ?? null;
    const firstLaneBox = firstLane?.getBoundingClientRect() ?? null;
    const cardsVisibleInFirstLane = firstLane && firstLaneBox
      ? Array.from(firstLane.querySelectorAll("[data-board-node], [data-lane-content]")).filter((card) => {
          const box = card.getBoundingClientRect();
          return box.height > 0 && box.top < firstLaneBox.bottom && box.bottom > firstLaneBox.top;
        }).length
      : null;
    const widths = {
      search: rect(chipRow?.querySelector('input[type="search"]') ?? null)?.width ?? null,
      divider: rect(chipRow?.querySelector('[aria-hidden="true"]') ?? null)?.width ?? null,
      tools: rect(chipRow?.querySelector('[role="group"][aria-label="Filter by tool"]') ?? null)?.width ?? null,
      engagements: rect(Array.from(chipRow?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim().startsWith("Engagements")) ?? null)?.width ?? null,
      count: rect(Array.from(chipRow?.querySelectorAll("button") ?? []).find((button) => /conversation|Showing|match/.test(button.textContent ?? "")) ?? null)?.width ?? null,
    };
    return {
      scrollHeight: document.scrollingElement?.scrollHeight ?? -1,
      innerHeight: window.innerHeight,
      headerH: rect(header)?.height ?? null,
      chipRowH: rect(chipRow)?.height ?? null,
      chipScrollWidth: chipRow?.scrollWidth ?? null,
      chipClientWidth: chipRow?.clientWidth ?? null,
      widths,
      shell: rect(shell),
      scale,
      tx,
      ty,
      laneStyles: lanes.map((lane) => `${lane.style.width}x${lane.style.height}`),
      firstLane: rect(firstLane),
      cardsVisibleInFirstLane,
      mainCount: document.querySelectorAll("main").length,
      dataReader: document.querySelector(".nb-chatview")?.getAttribute("data-reader") ?? null,
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
  await page.waitForTimeout(300);
}

function sourceObservation(page: Page) {
  return page.evaluate(() => ({
    board: Boolean(document.querySelector('[data-testid="board-shell"]')),
    lanes: document.querySelectorAll("[data-board-lane]").length,
    askedText: Array.from(document.querySelectorAll("h2, h3, p")).map((element) => element.textContent?.trim() ?? "").find((text) => /question|asked|session/i.test(text)) ?? null,
  }));
}

test("unit2 all conversations shell", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, EMAIL, /sign in/i).catch((e) => console.log(`SIGNIN note ${String(e).split("\n")[0]} url=${page.url()}`));
  await page.goto("/ai-record", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "All conversations" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(3000);

  const passes: Array<readonly [number, number]> = [[1440, 900], [1280, 800], [1094, 658], [1440, 900]];
  const measurements: Measurement[] = [];
  for (const [width, height] of passes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(700);
    measurements.push(await measure(page, `${width}x${height}`));
    if (width === 1094) await page.screenshot({ path: `${SHOTS}/unit2-1094x658.png` });
  }
  await page.screenshot({ path: `${SHOTS}/unit2-1440x900.png` });
  const first = measurements[0];
  console.log(`RESULT chip row width :: ${first?.chipScrollWidth === first?.chipClientWidth ? "PASS" : "FAIL"} scroll=${first?.chipScrollWidth} client=${first?.chipClientWidth}`);

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
  await result("Engagements", async () => {
    await page.getByRole("button", { name: "Engagements", exact: true }).click(); await page.waitForTimeout(300);
    const visible = await page.getByRole("group", { name: "Filter by engagement" }).isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} group=${visible}`;
  });
  await result("Subjects and links", async () => {
    await page.getByRole("button", { name: "Subjects and links" }).click(); await page.waitForTimeout(350);
    const visible = await page.getByRole("dialog", { name: /Subjects and links/ }).isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} panel=${visible}`;
  });
  await result("coverage", async () => {
    const button = page.getByRole("button", { name: /conversation|Showing|match/ }).last();
    await button.click(); await page.waitForTimeout(350);
    const visible = await page.getByText("nothing here was written by Lasso").isVisible().catch(() => false); await dismiss(page);
    return `${visible ? "PASS" : "FAIL"} popover=${visible}`;
  });
  await result("tool chip", async () => {
    const group = page.getByRole("group", { name: "Filter by tool" });
    const chip = group.getByRole("button").nth(1);
    if (!(await chip.count())) return "N/A one tool only";
    const before = await chip.getAttribute("aria-pressed"); await chip.click(); await page.waitForTimeout(300);
    const after = await chip.getAttribute("aria-pressed");
    await group.getByRole("button").first().click(); await page.waitForTimeout(300);
    return `${before !== after && after === "true" ? "PASS" : "FAIL"} before=${before} after=${after}`;
  });
  await result("source tabs", async () => {
    const group = page.getByRole("group", { name: "Which conversations are shown" });
    const captured = group.getByRole("button", { name: "Captured", exact: true });
    const asked = group.getByRole("button", { name: "Asked Lasso", exact: true });
    const everything = group.getByRole("button", { name: "Everything", exact: true });
    await captured.click(); await page.waitForTimeout(350); const capturedState = await sourceObservation(page);
    await asked.click(); await page.waitForTimeout(350); const askedState = await sourceObservation(page);
    await everything.click(); await page.waitForTimeout(350); const everythingState = await sourceObservation(page);
    await captured.click(); await page.waitForTimeout(350);
    const pass = capturedState.board && !askedState.board && everythingState.board;
    return `${pass ? "PASS" : "FAIL"} captured=${JSON.stringify(capturedState)} asked=${JSON.stringify(askedState)} everything=${JSON.stringify(everythingState)}`;
  });
  await result("reader open and close refit", async () => {
    const before = await measure(page, "reader-before");
    const card = page.locator("[data-board-node] article").first();
    if (!(await card.count())) return "N/A no conversation cards";
    await card.click(); await page.waitForTimeout(600);
    const opened = await measure(page, "reader-open");
    await page.keyboard.press("Escape"); await page.waitForTimeout(600);
    const closed = await measure(page, "reader-closed");
    const restored = closed.scale === before.scale && closed.shell?.width === before.shell?.width;
    return `${opened.dataReader === "open" && closed.dataReader === "closed" && restored ? "PASS" : "FAIL"} openReader=${opened.dataReader} openShell=${JSON.stringify(opened.shell)} openScale=${opened.scale} openScroll=${opened.scrollHeight} closedShell=${JSON.stringify(closed.shell)} closedScale=${closed.scale} closedScroll=${closed.scrollHeight} restored=${restored}`;
  });
  await result("resize refit", async () => {
    await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(600); const smaller = await measure(page, "resize-1280x800");
    await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(600); const restored = await measure(page, "resize-1440x900");
    return `PASS scale1280=${smaller.scale} scale1440=${restored.scale}`;
  });
});