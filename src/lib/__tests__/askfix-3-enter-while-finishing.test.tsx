// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const flag = { on: true };
vi.mock("@/lib/feature-flags", () => ({
  flagEnabled: (name: string) => (name === "ask-v2" ? flag.on : false),
}));
vi.mock("@/hooks/use-engagement-page", () => ({
  useEngagementPage: () => ({ data: { tasks: [] } }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { AskComposer } from "@/components/reflect/AskSurface";
import { ASK_QUEUE_COPY, queuedStillWanted, shouldQueueAskOnEnter } from "@/lib/ask-queue";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }),
    });
  }
});
afterEach(() => {
  cleanup();
  flag.on = true;
});

const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 };

describe("ASK-FIX-3 rules", () => {
  it("holds only a plain Enter, with words in the box, while an answer is in flight", () => {
    expect(shouldQueueAskOnEnter(enter, false, "Next steps?", true)).toBe(true);
    expect(shouldQueueAskOnEnter(enter, false, "Next steps?", false)).toBe(false);
    expect(shouldQueueAskOnEnter(enter, false, "   ", true)).toBe(false);
    expect(shouldQueueAskOnEnter({ ...enter, shiftKey: true }, false, "x", true)).toBe(false);
    expect(shouldQueueAskOnEnter({ ...enter, isComposing: true }, false, "x", true)).toBe(false);
    expect(shouldQueueAskOnEnter(enter, true, "x", true)).toBe(false);
  });
  it("a held question goes only if the box still says it", () => {
    expect(queuedStillWanted("Next steps?", "  Next steps? ")).toBe(true);
    expect(queuedStillWanted("Next steps?", "Next steps for Ben?")).toBe(false);
    expect(queuedStillWanted("Next steps?", "")).toBe(false);
    expect(queuedStillWanted(null, "x")).toBe(false);
  });
  it("plain words, no em dash", () => {
    expect(ASK_QUEUE_COPY.waiting).toBe("Sends when this answer is done.");
    expect(Object.values(ASK_QUEUE_COPY).join(" ")).not.toMatch(/—/);
  });
});

function fakeAsk(over: Partial<Record<string, unknown>>): AskLasso {
  return {
    draft: "What are the next steps?",
    pending: true,
    queued: null,
    queueSend: vi.fn(),
    cancelQueued: vi.fn(),
    submit: vi.fn(),
    onDraftChange: vi.fn(),
    composerRef: { current: null },
    mention: null,
    mentionMatches: [],
    mapped: [],
    selectedItems: [],
    draftPointed: [],
    pointedNow: [],
    ...over,
  } as unknown as AskLasso;
}

describe("ASK-FIX-3 the composer", () => {
  it("under ask-v2, Enter while the answer finishes holds the question and adds no new line", () => {
    const ask = fakeAsk({});
    render(<AskComposer ask={ask} mobile engagementId="e" />);
    const box = screen.getByRole("textbox");
    const notPrevented = fireEvent.keyDown(box, { key: "Enter", keyCode: 13 });
    expect(notPrevented).toBe(false);
    expect(ask.queueSend).toHaveBeenCalledTimes(1);
    expect(ask.submit).not.toHaveBeenCalled();
  });
  it("shows the waiting line with Cancel; Cancel and Esc drop the hold", () => {
    const ask = fakeAsk({ queued: "What are the next steps?" });
    render(<AskComposer ask={ask} mobile engagementId="e" />);
    expect(screen.getByTestId("ask-queued").textContent).toContain(ASK_QUEUE_COPY.waiting);
    fireEvent.click(screen.getByRole("button", { name: ASK_QUEUE_COPY.cancel }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(ask.cancelQueued).toHaveBeenCalledTimes(2);
  });
  it("flag off is today's composer: nothing held, no line", () => {
    flag.on = false;
    const ask = fakeAsk({ queued: "x" });
    render(<AskComposer ask={ask} mobile engagementId="e" />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", keyCode: 13 });
    expect(ask.queueSend).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ask-queued")).toBeNull();
  });
  it("when idle, Enter still sends as before", () => {
    const ask = fakeAsk({ pending: false });
    render(<AskComposer ask={ask} mobile engagementId="e" />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", keyCode: 13 });
    expect(ask.submit).toHaveBeenCalledTimes(1);
    expect(ask.queueSend).not.toHaveBeenCalled();
  });
});

describe("ASK-FIX-3 the hook sends it once the answer is done", () => {
  const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
  it("waits for pending to clear, clears the hold, and sends only if the box still says it", () => {
    expect(hook).toMatch(
      /if \(pending \|\| queued === null\) return;\s*const text = queued;\s*setQueued\(null\);\s*const wanted = queuedStillWanted\(text, draft\);\s*noteWorkboardAskHeld\(orgId, wanted \? "sent" : "cancelled"\);\s*if \(wanted\) void send\(text\);/,
    );
    expect(hook).toMatch(/\}, \[pending, queued\]\);/);
  });
  it("editing the box drops the hold", () => {
    expect(hook).toMatch(/if \(queued !== null && value\.trim\(\) !== queued\) \{ noteWorkboardAskHeld\(orgId, "cancelled"\); setQueued\(null\); \}/);
  });
  it("send itself is unchanged: one in flight at a time", () => {
    expect(hook).toContain("if (!message || pending) return;");
  });
});
