// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => false }));
vi.mock("@/hooks/use-engagement-page", () => ({ useEngagementPage: () => ({ data: { tasks: [] } }) }));
vi.mock("@/components/oneonone/SaveForOneOnOne", () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock("@/components/work/ThreadViewerById", () => ({ ThreadViewerById: () => null }));
vi.mock("@/components/reflect/ContextTrail", () => ({
  AnswerRail: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextAudit: () => <div>Context</div>, ThinkingTrail: () => null,
}));
vi.mock("@/components/reflect/LassoThinkingMark", () => ({ LassoThinkingMark: () => null }));
vi.mock("@/components/reflect/AnswerMoreMenu", () => ({ AnswerMoreMenu: () => null }));
vi.mock("@/components/canvas-lab/ask-draft/AskReadingLines", () => ({ AskReadingLines: () => null }));
vi.mock("@/components/canvas-lab/ask-draft/AskPlacing", () => ({ AskPlacingGhost: () => null }));
vi.mock("@/components/canvas-lab/canvas-lab-telemetry", () => ({ noteWorkboardAskView: vi.fn(), noteWorkboardAskMoved: vi.fn(), noteWorkboardContextChanged: vi.fn() }));

import { AskReadChip, AskSurface, MessagesTab } from "@/components/reflect/AskSurface";
import { AskDraftSurface } from "@/components/canvas-lab/ask-draft/AskDraftSurface";

// Illustrative input pins the owner's exact acceptance counts, never a fallback.
const items = Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, title: `Work ${i}`, meta: { text_chars: i < 19 ? (i === 0 ? 30000 : 34000) : 0 } }));
const manifest = {
  items: items.map((item, i) => ({ ...item, kind: "item", detail: i < 19 ? "read as written" : "no stored text", chars_in: i < 19 ? 1 : 0, chars_total: i < 19 ? 1 : 0 })),
  read_set: { chars_in: 642000, chars_total: 642000, share: 1 },
};
const answer = { id: "1", role: "assistant", content: "An answer", created_at: "2026-11-07T06:12:00Z", context_manifest: manifest };
const expected = "Read as written: 19 items. No stored text: 1 item. 100% of the selected text was in front of Lasso.";
function ask(overrides: Record<string, unknown> = {}): AskLasso {
  return {
    messages: [], mapped: items, selectedItems: items, draftPointed: [], pointedNow: [], pending: false,
    streamed: "", draft: "", profile: { display_name: "Liam" }, bottomRef: { current: null }, composerRef: { current: null },
    sourcesByMessage: {}, liveManifest: null, coverage: null, pickerOpen: false, error: null,
    mention: null, mentionMatches: [], sessions: [], historySettled: true, setPickerOpen: vi.fn(),
    ...overrides,
  } as unknown as AskLasso;
}
afterEach(() => { cleanup(); document.querySelectorAll("main").forEach((el) => el.remove()); vi.restoreAllMocks(); });

describe("TOTAL-4 read details", () => {
  it("pins 20 items and 642k loaded characters", () => {
    render(<AskReadChip ask={ask()} />);
    expect(screen.getByTestId("ask-read-chip").textContent).toBe("20 items · about 642k characters");
  });
  it("uses narrowed selection, pointed draft, then pending pointed scope", () => {
    const { rerender } = render(<AskReadChip ask={ask({ selectedItems: [items[0]] })} />);
    expect(screen.getByTestId("ask-read-chip").textContent).toBe("1 items · about 30k characters");
    rerender(<AskReadChip ask={ask({ draftPointed: [items[1]] })} />);
    expect(screen.getByTestId("ask-read-chip").textContent).toBe("1 items · about 34k characters");
    rerender(<AskReadChip ask={ask({ pending: true, draftPointed: [items[1]], pointedNow: [items[0]] })} />);
    expect(screen.getByTestId("ask-read-chip").textContent).toBe("1 items · about 30k characters");
  });
  it("hides an empty scope and omits missing character counts", () => {
    const { rerender } = render(<AskReadChip ask={ask({ selectedItems: [] })} />);
    expect(screen.queryByTestId("ask-read-chip")).toBeNull();
    rerender(<AskReadChip ask={ask({ selectedItems: [{ id: "x", title: "X", meta: {} }] })} />);
    expect(screen.getByTestId("ask-read-chip").textContent).toBe("1 items");
  });
  it("places the read chip after the scope label on desktop and phone", () => {
    const props = { tab: "messages" as const, onTab: vi.fn(), engagementId: "board", engagementTitle: "Board", profileId: "p", orgId: "o", onClose: vi.fn() };
    const { rerender } = render(<AskSurface {...props} ask={ask()} />);
    expect(screen.getByTestId("ask-read-chip").previousElementSibling?.textContent).toContain("Change");
    rerender(<AskSurface {...props} mobile ask={ask()} />);
    expect(screen.getByTestId("ask-read-chip").parentElement?.previousElementSibling?.textContent).toContain("Change");
  });
  it("restores saved coverage on reopening with no live session coverage", () => {
    const { rerender } = render(<MessagesTab ask={ask({ messages: [answer] })} />);
    expect(screen.getByTestId("coverage-note").textContent).toBe(expected);
    rerender(<MessagesTab ask={ask()} />);
    expect(screen.queryByTestId("coverage-note")).toBeNull();
    rerender(<MessagesTab ask={ask({ messages: [answer] })} />);
    expect(screen.getByTestId("coverage-note").textContent).toBe(expected);
  });
  it("counts legacy turns/words, summaries and a partial share", () => {
    render(<MessagesTab ask={ask({ messages: [{ ...answer, context_manifest: {
      items: [ { title: "A", detail: "turns 1-3" }, { title: "B", detail: "42 words" }, { title: "C", detail: "summary only" } ],
      read_set: { chars_in: 500, chars_total: 1000, share: 0.5 },
    } }] })} />);
    expect(screen.getByTestId("coverage-note").textContent).toBe("Read as written: 2 items. Read as summary only: 1 item. 50% of the selected text was in front of Lasso.");
  });
  it("omits a perfect stored read and does not duplicate stale live coverage", () => {
    render(<MessagesTab ask={ask({ coverage: { fullCount: 19, noTextCount: 1, summaryCount: 0, share: 1 }, messages: [{ ...answer, context_manifest: { ...manifest, items: manifest.items.slice(0, 19) } }] })} />);
    expect(screen.queryByTestId("coverage-note")).toBeNull();
  });
  it("preserves the live coverage during streaming", () => {
    render(<MessagesTab ask={ask({ pending: true, streamed: "A", coverage: { fullCount: 19, noTextCount: 1, summaryCount: 0, share: 1 } })} />);
    expect(screen.getByTestId("coverage-note").textContent).toBe(expected);
  });
  it("keeps the reading line before and during stream, removes it on completion", () => {
    const host = document.createElement("main"); document.body.appendChild(host);
    const props = { draft: "b" as const, host, tab: "messages" as const, onTab: vi.fn(), engagementId: "board", engagementTitle: "Board", profileId: "p", orgId: "o", onClose: vi.fn() };
    const { rerender } = render(<AskDraftSurface {...props} ask={ask({ pending: true })} />);
    expect(screen.getByTestId("ask-reading-scope").textContent?.trim()).toBe("Reading 20 items as written");
    rerender(<AskDraftSurface {...props} ask={ask({ pending: true, streamed: "A" })} />);
    expect(screen.getByTestId("ask-reading-scope").textContent?.trim()).toBe("Reading 20 items as written");
    rerender(<AskDraftSurface {...props} ask={ask({ messages: [answer] })} />);
    expect(screen.queryByTestId("ask-reading-scope")).toBeNull();
    expect(screen.getByTestId("coverage-note").textContent).toBe(expected);
  });
  it("reads the pointed scope as a singular item", () => {
    const host = document.createElement("main"); document.body.appendChild(host);
    render(<AskDraftSurface draft="b" host={host} tab="messages" onTab={vi.fn()} engagementId="board" engagementTitle="Board" profileId="p" orgId="o" onClose={vi.fn()} ask={ask({ pending: true, pointedNow: [items[0]] })} />);
    expect(screen.getByTestId("ask-reading-scope").textContent?.trim()).toBe("Reading 1 item as written");
  });
});