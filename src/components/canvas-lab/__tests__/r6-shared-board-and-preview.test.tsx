// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SharedBoardView, buildSharedBoardModel } from "@/components/canvas-lab/SharedBoardView";
import { CARD_HEIGHT, CARD_WIDTH, fitWorkboardViewport } from "@/components/canvas-lab/canvas-lab-model";
import type { SharedBoardDto } from "@/lib/board-share-shared";
import { serializeWorkboardTextBody, type WorkboardNodeDto } from "@/lib/canvas-lab-shared";

const SHARED_VIEW = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
const SHARE_DIALOG = readFileSync("src/components/canvas-lab/ShareDialog.tsx", "utf8");
const LINK_SECTION = readFileSync("src/components/canvas-lab/ShareBoardDialog.tsx", "utf8");
const STYLES = readFileSync("src/styles.css", "utf8");

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 700 });
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as typeof ResizeObserver;
});

afterEach(cleanup);

describe("R6 shared board opening", () => {
  it("uses the owner board fit calculation and keeps negative content inside the padded viewport", () => {
    const fitted = fitWorkboardViewport(
      { width: 1000, height: 700 },
      [],
      [
        { id: "left", x: -240, y: -100, width: 280, height: 220 },
        { id: "right", x: 680, y: 420, width: 280, height: 220 },
      ],
      new Map(),
      null,
    );
    const left = fitted.bounds.x * fitted.zoom + fitted.pan.x;
    const top = fitted.bounds.y * fitted.zoom + fitted.pan.y;
    const right = (fitted.bounds.x + fitted.bounds.width) * fitted.zoom + fitted.pan.x;
    const bottom = (fitted.bounds.y + fitted.bounds.height) * fitted.zoom + fitted.pan.y;

    expect(left).toBeGreaterThanOrEqual(32);
    expect(top).toBeGreaterThanOrEqual(32);
    expect(right).toBeLessThanOrEqual(968.001);
    expect(bottom).toBeLessThanOrEqual(668.001);
    expect(SHARED_VIEW).toContain("fitWorkboardViewport");
    expect(SHARED_VIEW).toContain("ResizeObserver");
  });

  it("renders the shared stage with a fitted transform before exposing its cards", async () => {
    const rendered = renderShared(sharedBoard());
    const stage = rendered.getByTestId("shared-board-stage");
    await waitFor(() => expect(stage.style.visibility).toBe("visible"));
    expect(stage.style.transform).toMatch(/^translate\([^)]*px, [^)]*px\) scale\([^)]+\)$/);
  });
});

function renderShared(board: SharedBoardDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SharedBoardView board={board} />
    </QueryClientProvider>,
  );
}

function node(partial: Partial<WorkboardNodeDto> & Pick<WorkboardNodeDto, "id" | "kind">): WorkboardNodeDto {
  return {
    frameId: null, workItemId: null, decisionId: null, authorProfileId: "author-1", authorName: "A teammate",
    title: "", body: "", judgmentType: null, x: 0, y: 0, w: 0, h: 0, hidden: false, version: 1,
    referenceReadable: true, createdAt: null, linkedItemRemovedAt: null, ...partial,
  };
}

function sharedBoard(): SharedBoardDto {
  return {
    board: {
      id: "shared", engagementId: "", version: 1, frames: [], links: [], viewerProfileId: null,
      canEditStructure: false, archivedContextFrame: null,
      nodes: [
        node({ id: "n-chat", kind: "work_item", workItemId: "w-chat", x: -240, y: -100 }),
        node({ id: "n-text", kind: "text", body: serializeWorkboardTextBody({ text: "Plain words", size: "label", weight: "medium", colour: "ink" }), x: 680, y: 420, w: 240, h: 60 }),
      ],
    },
    seed: {
      brief: null,
      tasks: [],
      decisions: [],
      work: [{ id: "w-chat", title: "Pricing chat", type: "ai_thread", source: "claude", visibility: "mapped", captured_at: "2026-09-20T00:00:00.000Z", content_ref: null, taskIds: [] } as unknown as SharedBoardDto["seed"]["work"][number]],
    },
    cardPreviews: {},
    filePreviews: {},
    turns: { "w-chat": [{ id: "t1", turn_no: 1, role: "user", content: "Hello", ts: null, model: null }] },
    expiresAt: "2026-09-23T00:00:00.000Z",
  };
}

describe("S3a shared board is the owner's board, read only", () => {
  it("sizes a card stored at 0 by 0 the way the live board does", () => {
    const model = buildSharedBoardModel(sharedBoard());
    const chat = model.nodes.find((entry) => entry.workItemId === "w-chat");
    expect(chat?.width).toBe(CARD_WIDTH);
    expect(chat?.height).toBe(CARD_HEIGHT);
    expect(chat?.ownership).toBe("teammate");
  });

  it("shows a text block's words, never its stored JSON", () => {
    const rendered = renderShared(sharedBoard());
    expect((rendered.getByLabelText("Text block words") as HTMLTextAreaElement).value).toBe("Plain words");
    expect(rendered.getByTestId("shared-board-view").textContent ?? "").not.toContain("{");
  });

  it("offers no anchor, handle, menu or card writing control", () => {
    const rendered = renderShared(sharedBoard());
    const root = rendered.getByTestId("shared-board-view");
    expect(root.querySelectorAll(".canvas-lab-anchor, .canvas-lab-resize-handle, [data-testid='answer-drag-grip']")).toHaveLength(0);
    expect(root.querySelector("[data-read-only='false']")).toBeNull();
    expect(SHARED_VIEW).not.toMatch(/useServerFn|persist|mutate/);
  });
});

describe("R6 share dialog contrast", () => {
  it("keeps required explanatory copy off the lowest contrast token", () => {
    const readableBlocks = [
      SHARE_DIALOG.slice(SHARE_DIALOG.indexOf("ACCESS_CHOICES.map"), SHARE_DIALOG.indexOf("{problem ?")),
      SHARE_DIALOG.slice(SHARE_DIALOG.indexOf("Already on this board"), SHARE_DIALOG.indexOf("</section>", SHARE_DIALOG.indexOf("Already on this board"))),
      LINK_SECTION.slice(LINK_SECTION.indexOf("shareExposureSentence"), LINK_SECTION.indexOf("{freshUrl ?")),
      LINK_SECTION.slice(LINK_SECTION.indexOf("Live links"), LINK_SECTION.indexOf("</section>")),
    ];
    for (const block of readableBlocks) {
      expect(block).not.toContain("text-soft");
    }
    expect(readableBlocks.join("\n")).toContain("text-foreground");
    expect(readableBlocks.join("\n")).toContain("text-muted-foreground");
  });
});

describe("R6 conversation preview growth", () => {
  it("uses 112px as a minimum, fills available height, and has no fade", () => {
    const body = STYLES.slice(STYLES.indexOf(".chat-preview-window__body {"), STYLES.indexOf(".nb-preview-content {"));
    expect(body).toContain("min-height: var(--nb-chat-preview-height)");
    expect(body).not.toMatch(/\n\s*height:\s*var\(--nb-chat-preview-height\)/);
    expect(body).toContain("flex: 1 1 auto");
    expect(body).not.toContain("mask-image");
    expect(STYLES).toContain("--nb-chat-preview-height: 112px");
  });

  it("leaves the established paper, vendor, and preview-shape rules in place", () => {
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"claude\"]");
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"chatgpt\"]");
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"gemini\"]");
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"copilot\"]");
    expect(STYLES).toContain("aspect-ratio: 3 / 4");
    expect(STYLES).toContain("aspect-ratio: 16 / 9");
    expect(STYLES).toContain("var(--nb-paper-shadow-contact)");
    expect(STYLES).toContain("var(--nb-paper-shadow-ambient)");
  });
});