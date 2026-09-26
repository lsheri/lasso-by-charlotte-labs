import { expect, test } from "@playwright/test";

const desktopSizes = [
  { width: 1372, height: 732 },
  { width: 1512, height: 807 },
];

test("landing header, progress rail, and paper caption keep the S4 contract", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1372, height: 732 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lb-header .lb-step-nav")).toHaveCount(0);
  await expect(page.locator(".lb-progress-dot")).toHaveCount(10);
  expect((await page.locator(".lb-header").boundingBox())?.height ?? 999).toBeLessThanOrEqual(64);
  await page.getByRole("button", { name: "Circle", exact: true }).last().click();
  await expect(page.locator(".lb-progress-rail")).toHaveAttribute("data-step", "5");
  await expect(page.locator('.lb-progress-dot[data-current="true"]')).toHaveAttribute(
    "aria-label",
    "Circle",
  );
  const caption = page.locator('.lb-caption[data-phase="incoming"]');
  await expect(caption).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(caption).not.toHaveCSS("background-color", "rgb(22, 24, 26)");
  await context.close();
});

for (const viewport of desktopSizes) {
  test(`landing proof connector renders with normal motion at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    test.setTimeout(45_000);
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ask", exact: true }).last().click();
    await expect(page.getByTestId("landing-proof-card")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("landing-proof-connector")).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width);
    await context.close();
  });
}

test("playable demo rail and board text meet the buyer-readable floor", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1372, height: 732 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/demo", { waitUntil: "networkidle" });
  const sample = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".demo-sandbox-stage");
    const scale = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
    const visibleLeaves = (root: string, board: boolean) =>
      Array.from(document.querySelectorAll<HTMLElement>(`${root} *`))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            element.children.length === 0 &&
            Boolean(element.textContent?.trim()) &&
            box.width > 0 &&
            box.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            !element.closest(".demo-sandbox-deck-art")
          );
        })
        .slice(0, 20)
        .map((element) => ({
          text: element.textContent?.trim(),
          effective: Number.parseFloat(getComputedStyle(element).fontSize) * (board ? scale : 1),
        }));
    return {
      rail: visibleLeaves(".demo-sandbox-ask", false),
      board: visibleLeaves(".demo-sandbox-stage", true),
    };
  });
  expect(sample.rail).toHaveLength(20);
  expect(sample.board).toHaveLength(20);
  for (const node of [...sample.rail, ...sample.board])
    expect(node.effective, node.text).toBeGreaterThanOrEqual(12);
  await context.close();
});

test("story captions and visible text stay readable across settled desktop steps", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 1372, height: 732 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  for (const name of [
    "One canvas",
    "Workstreams",
    "Deliverable",
    "A number",
    "Ask Lasso",
    "The chat",
    "Open questions",
    "Share",
    "Try it",
  ]) {
    await page.getByRole("button", { name, exact: true }).last().click();
    const caption = page.locator('.lb-caption[data-phase="incoming"]');
    await expect(caption).toBeVisible();
    await expect(caption.locator(".lb-caption-text > span")).toContainText(new RegExp(name, "i"));
    const geometry = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('.lb-caption[data-phase="incoming"]');
      const stage = document.querySelector<HTMLElement>(".lb-stage-window");
      if (!card || !stage) return null;
      const cardBox = card.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const panel = document.querySelector<HTMLElement>(".lb-answer-sheet");
      const boardRight =
        panel && getComputedStyle(panel).display !== "none"
          ? panel.getBoundingClientRect().left
          : stageBox.right;
      const body = card.querySelector("p");
      const visible = Array.from(
        stage.querySelectorAll<HTMLElement>("span,p,strong,small,h3,b,a,button"),
      )
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            Boolean(element.textContent?.trim()) &&
            box.width > 0 &&
            box.height > 0 &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            !element.closest(".lb-deck-slide:not(.lb-slide-number)")
          );
        })
        .slice(0, 20)
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            text: element.textContent?.trim(),
            size: Number.parseFloat(style.fontSize),
            height: element.getBoundingClientRect().height,
          };
        });
      return {
        delta: Math.abs(
          cardBox.left + cardBox.width / 2 - (stageBox.left + (boardRight - stageBox.left) / 2),
        ),
        bodySize: body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0,
        visible,
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.delta ?? 999).toBeLessThanOrEqual(24);
    expect(geometry?.bodySize ?? 0).toBeGreaterThanOrEqual(19);
    for (const node of geometry?.visible ?? [])
      expect(Math.min(node.size, node.height), node.text).toBeGreaterThanOrEqual(12);
  }
  await context.close();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`phone story fits every focused section at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".lb-header")).toBeVisible();
    expect((await page.locator(".lb-header").boundingBox())?.height ?? 999).toBeLessThanOrEqual(56);
    const sections = page.locator(".lb-phone-step");
    await expect(sections).toHaveCount(11);
    for (let index = 0; index < 11; index += 1) {
      const section = sections.nth(index);
      await section.scrollIntoViewIfNeeded();
      if (index >= 2)
        await expect(page.locator(".lb-progress-rail")).toHaveAttribute("data-step", `${index}`);
      const result = await section.evaluate((element) => {
        const visibleText = Array.from(
          element.querySelectorAll<HTMLElement>("span,p,strong,small,h1,h2,h3,a,button"),
        )
          .filter((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return (
              Boolean(node.textContent?.trim()) &&
              box.width > 0 &&
              box.height > 0 &&
              style.visibility !== "hidden"
            );
          })
          .filter((node) => !node.closest(".lb-phone-thumbnails"));
        return {
          innerScroll: element.scrollHeight > element.clientHeight + 1,
          narrowText: visibleText
            .filter((node) => Number.parseFloat(getComputedStyle(node).fontSize) < 14)
            .map((node) => node.textContent?.trim()),
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      if (index !== 7) expect(result.innerScroll, `step ${index + 1}`).toBe(false);
      expect(result.narrowText, `step ${index + 1}`).toEqual([]);
      expect(result.pageWidth).toBe(viewport.width);
      if (viewport.width === 390)
        await page.screenshot({ path: testInfo.outputPath(`phone-story-${index + 1}.png`) });
    }
    await context.close();
  });
}

for (const viewport of [
  { width: 1372, height: 732 },
  { width: 1512, height: 807 },
  { width: 1920, height: 1080 },
]) {
  test(`step-one hero has no visible board-card ghosting at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="landing-board-stage"]')).toHaveAttribute(
      "data-step",
      "1",
    );
    const result = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(".lb-hero-copy")?.getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".lb-board-card"));
      if (!hero) return { layerOpacity: 1, intersections: cards.length };
      const intersections = cards.filter((card) => {
        const box = card.getBoundingClientRect();
        const opacity = Number.parseFloat(getComputedStyle(card).opacity);
        return (
          opacity > 0 &&
          box.left < hero.right &&
          box.right > hero.left &&
          box.top < hero.bottom &&
          box.bottom > hero.top
        );
      }).length;
      const layer = document.querySelector<HTMLElement>(".lb-board-layer");
      return {
        layerOpacity: layer ? Number.parseFloat(getComputedStyle(layer).opacity) : 1,
        intersections,
      };
    });
    expect(result.layerOpacity).toBe(0);
    expect(result.intersections).toBe(0);
    await context.close();
  });
}

test("story zones always resolve to one matching visible step", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 1372, height: 732 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  const pageHeight = await page.evaluate(() => {
    const lastZone = document.querySelector<HTMLElement>('[data-lb-step="9"]');
    return lastZone ? lastZone.offsetTop + lastZone.offsetHeight - window.innerHeight : 0;
  });
  let previousStep = "";
  for (let y = 0; y <= pageHeight; y += 80) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "auto" }), y);
    await page.waitForTimeout(20);
    const captions = page.locator('.lb-caption[data-phase="incoming"]:visible');
    await expect(captions).toHaveCount(1);
    const captionStep = await captions.getAttribute("data-step");
    if (captionStep !== previousStep) {
      await page.waitForTimeout(720);
      previousStep = captionStep ?? "";
    }
    const state = await page.evaluate(() => ({
      board: document.querySelector<HTMLElement>('[data-testid="landing-board-stage"]')?.dataset
        .step,
      caption: document.querySelector<HTMLElement>('.lb-caption[data-phase="incoming"]')?.dataset
        .step,
    }));
    expect(state.board).toBe(state.caption);
  }
  await context.close();
});

for (const viewport of [
  ...desktopSizes,
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`landing page has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width);
    await context.close();
  });
}

for (const viewport of [{ width: 1372, height: 732 }]) {
  test(`landing hero actions and scroll cue work at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    const cue = page.getByTestId("landing-scroll-cue");
    await expect(cue).toBeVisible();
    await page.getByRole("button", { name: "Watch it work", exact: true }).click();
    await expect(page.locator("#usecases")).toBeInViewport();
    await expect(cue).toBeHidden();
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "View a Workboard", exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await context.close();
  });
}

test("use cases sit before the story with one-line titles and no jump controls", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1372, height: 732 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const telemetryBodies: string[] = [];
  page.on("request", (request) => {
    const body = request.postData();
    if (body?.includes("landing.usecase_played")) telemetryBodies.push(body);
  });
  await page.goto("/", { waitUntil: "networkidle" });
  const order = await page.evaluate(() => {
    const hero = document.querySelector(".lb-desktop-hero");
    const usecases = document.querySelector("#usecases");
    const story = document.querySelector(".lb-how-it-works");
    return hero && usecases && story
      ? Boolean(hero.compareDocumentPosition(usecases) & Node.DOCUMENT_POSITION_FOLLOWING) &&
          Boolean(usecases.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING)
      : false;
  });
  expect(order).toBe(true);
  await expect(page.locator("#usecases video")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /See it in the story/ })).toHaveCount(0);
  const titles = page.locator("#usecases .landing-usecase h3");
  await expect(titles).toHaveCount(3);
  for (const title of await titles.all()) {
    const lines = await title.evaluate((element) =>
      Math.round(element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight)),
    );
    expect(lines).toBe(1);
  }
  for (const video of await page.locator("#usecases video").all()) {
    await expect(video).toHaveAttribute("poster", /.+/);
    const ratio = await video.locator("xpath=..").evaluate((element) => {
      const box = element.getBoundingClientRect();
      return box.width / box.height;
    });
    expect(ratio).toBeCloseTo(16 / 9, 1);
  }
  const useCaseHeadings = page.locator("#usecases .landing-usecase h3");
  await expect(useCaseHeadings).toHaveCount(3);
  for (const heading of await useCaseHeadings.all()) {
    const metrics = await heading.evaluate((element) => ({
      height: element.clientHeight,
      size: Number.parseFloat(getComputedStyle(element).fontSize),
    }));
    expect(metrics.height).toBeLessThanOrEqual(metrics.size * 1.3);
  }
  await expect(page.locator("#usecases .landing-section-head h2")).toHaveCSS("font-size", "52px");
  await expect(
    page.locator('#usecases [data-usecase="bring_work_in"] video source[type="video/mp4"]'),
  ).toHaveAttribute("src", /use-bring-work-in\.mp4/);
  await page
    .locator('#usecases [data-usecase="bring_work_in"]')
    .getByRole("button", { name: /Play:/ })
    .click();
  await expect.poll(() => telemetryBodies.length).toBeGreaterThan(0);
  await page
    .locator("#usecases")
    .screenshot({ path: testInfo.outputPath("landing-usecases-1372x732.png") });
  await context.close();
});

test("phone use-case titles stay on one line and cards have no jump controls", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /See it in the story/ })).toHaveCount(0);
  const titles = page.locator("#lb-phone-usecases .landing-usecase h3");
  await expect(titles).toHaveCount(3);
  for (const title of await titles.all()) {
    const lines = await title.evaluate((element) =>
      Math.round(element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight)),
    );
    expect(lines).toBe(1);
  }
  await context.close();
});

test("settled attention steps keep one spotlight and one caption", async ({ browser }) => {
  test.setTimeout(45_000);
  const context = await browser.newContext({
    viewport: { width: 1372, height: 732 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  for (const name of ["Deliverable", "A number", "Ask Lasso", "The chat"]) {
    await page.locator(`.lb-progress-dot[aria-label="${name}"]`).click({ force: true });
    await page.waitForTimeout(800);
    const baseline = await page.evaluate(
      () =>
        (window as Window & { __landingStoryBoardRenderCount?: number })
          .__landingStoryBoardRenderCount ?? 0,
    );
    const samples = await page.evaluate(async () => {
      const values: Array<{ spotlight: number; caption: string | undefined }> = [];
      for (let elapsed = 0; elapsed <= 3_000; elapsed += 100) {
        values.push({
          spotlight: document.querySelectorAll('[data-testid="landing-story-spotlight"]').length,
          caption: document.querySelector<HTMLElement>('.lb-caption[data-phase="incoming"]')?.dataset
            .step,
        });
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      return values;
    });
    expect(new Set(samples.map((sample) => sample.spotlight)).size, name).toBe(1);
    expect(new Set(samples.map((sample) => sample.caption)).size, name).toBe(1);
    const renders = await page.evaluate(
      () =>
        (window as Window & { __landingStoryBoardRenderCount?: number })
          .__landingStoryBoardRenderCount ?? 0,
    );
    expect(renders - baseline, name).toBeLessThan(10);
  }
  await context.close();
});

for (const viewport of desktopSizes) {
  test(`playable demo fits readable content at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    const zoomText = page.locator(".demo-workboard-zoom span");
    await expect
      .poll(async () => Number((await zoomText.textContent())?.replace("%", "") ?? 0))
      .toBeGreaterThanOrEqual(80);
    const proofButtons = page.locator(
      ".demo-sandbox-ask .lb-proof-actions a, .demo-sandbox-ask .lb-proof-actions button",
    );
    await expect(proofButtons).toHaveCount(2);
    for (const button of await proofButtons.all()) {
      expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
    }
    await expect(
      page.locator('[data-testid^="lab-card-demo:"]').filter({ hasText: "slide notes" }),
    ).toHaveCount(0);
    await expect(page.getByText("(slide notes)", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect
      .poll(async () => Number((await zoomText.textContent())?.replace("%", "") ?? 0))
      .toBeGreaterThanOrEqual(80);
    await context.close();
  });
}

for (const viewport of desktopSizes) {
  test(`playable demo content stays contained at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/demo", { waitUntil: "networkidle" });
    await expect(page.locator(".demo-deliverable-main")).toBeVisible();
    const result = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".demo-sandbox-stage");
      const scale = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
      const roots = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid^="lab-card-demo:"], [data-testid^="sticky-demo-"]',
        ),
      );
      const failures: string[] = [];
      for (const root of roots) {
        const rootBox = root.getBoundingClientRect();
        for (const child of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
          const box = child.getBoundingClientRect();
          const style = getComputedStyle(child);
          if (
            box.width === 0 ||
            box.height === 0 ||
            style.display === "none" ||
            style.visibility === "hidden"
          )
            continue;
          if (
            box.left < rootBox.left - 1 ||
            box.right > rootBox.right + 1 ||
            box.top < rootBox.top - 1 ||
            box.bottom > rootBox.bottom + 1
          )
            failures.push(`${root.dataset.testid}: ${child.tagName} escaped`);
        }
        for (const text of Array.from(
          root.querySelectorAll<HTMLElement>("span,p,strong,small,b,textarea"),
        )) {
          const box = text.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          if (text.scrollWidth > text.clientWidth + 1)
            failures.push(`${root.dataset.testid}: ${text.textContent?.trim()} overflowed`);
          if (Number.parseFloat(getComputedStyle(text).fontSize) * scale < 12)
            failures.push(`${root.dataset.testid}: ${text.textContent?.trim()} was too small`);
        }
      }
      const slide = document
        .querySelector<HTMLElement>(".demo-deliverable-main")
        ?.getBoundingClientRect();
      const dates = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".canvas-lab-card:not(.demo-deliverable-node) .nb-paper-body > div:first-child > span:not(:first-of-type)",
        ),
      );
      return {
        failures,
        ratio: slide ? slide.width / slide.height : 0,
        dates: dates.map((date) => date.textContent?.trim()),
        zoom: scale,
      };
    });
    expect(result.failures).toEqual([]);
    expect(result.ratio).toBeGreaterThanOrEqual((16 / 9) * 0.98);
    expect(result.ratio).toBeLessThanOrEqual((16 / 9) * 1.02);
    expect(result.dates).toContain("Aug 28, 2026");
    expect(result.zoom).toBeLessThanOrEqual(0.9);
    await page.getByRole("button", { name: "Show slide 1" }).click();
    await expect(page.getByRole("button", { name: "Show slide 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(
      page.locator(".demo-deliverable-thumbnails").getByRole("button", { name: "Show slide 3" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: testInfo.outputPath(`demo-contained-${viewport.width}x${viewport.height}.png`),
    });
    await context.close();
  });
}

for (const viewport of [
  { width: 1372, height: 732 },
  { width: 390, height: 844 },
]) {
  test(`playable demo restores a dragged card at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
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
    await expect
      .poll(async () => (await card.boundingBox())?.x, { timeout: 2_000 })
      .toBeCloseTo(before.x, 0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(viewport.width);
    await context.close();
  });
}
