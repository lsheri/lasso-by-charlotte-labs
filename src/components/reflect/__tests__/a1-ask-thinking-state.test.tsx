// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/work/ThreadViewerById", () => ({ ThreadViewerById: () => null }));
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));
vi.mock("@/hooks/use-has-live-coach-link", () => ({ useHasLiveCoachLink: () => false }));

import { MessagesTab } from "@/components/reflect/AskSurface";
import { ThinkingTrail } from "@/components/reflect/ContextTrail";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({ matches: reduced && query.includes("reduced"), addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
}
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, title: `Piece ${i}` }));
function fakeAsk(streamed: string, n = 3): AskLasso {
  return {
    messages: [{ id: "m1", role: "user", content: "What did I decide?", created_at: "2026-10-01T05:00:00Z" }],
    asked: "What did I decide?",
    pending: true,
    streamed,
    pointedNow: [],
    selectedItems: items(n),
    liveManifest: null,
    sourcesByMessage: {},
    coverage: null,
    bottomRef: { current: null },
    profile: { display_name: "Liam" },
  } as unknown as AskLasso;
}

describe("A1 Ask Lasso thinking state", () => {
  afterEach(cleanup);

  it("1. while thinking, the Lasso name is absent", () => {
    setReducedMotion(false);
    render(<MessagesTab ask={fakeAsk("")} />);
    expect(screen.queryByText("Lasso")).toBeNull();
  });
  it("2. while thinking, exactly one thinking glyph renders", () => {
    setReducedMotion(false);
    render(<MessagesTab ask={fakeAsk("")} />);
    expect(screen.getAllByTestId("ask-thinking-glyph")).toHaveLength(1);
    expect(document.querySelectorAll("canvas")).toHaveLength(0);
  });
  it("3. on the first character, the Lasso name appears", () => {
    setReducedMotion(false);
    render(<MessagesTab ask={fakeAsk("T")} />);
    expect(screen.getByText("Lasso")).toBeTruthy();
  });
  it("4. answered line counts the sources, singular for one", () => {
    setReducedMotion(false);
    const { rerender } = render(<ThinkingTrail items={items(3)} finalPhase="Writing" ask={{ answered: true }} />);
    expect(screen.getByText("Read 3 pieces of work")).toBeTruthy();
    rerender(<ThinkingTrail key="one" items={items(1)} finalPhase="Writing" ask={{ answered: true }} />);
    expect(screen.getByText("Read 1 piece of work")).toBeTruthy();
  });
  it("5. answered, the three dots are gone", () => {
    setReducedMotion(false);
    const { rerender } = render(<ThinkingTrail items={items(3)} finalPhase="Writing" ask={{ answered: false }} />);
    expect(screen.getByTestId("ask-thinking-dots")).toBeTruthy();
    rerender(<ThinkingTrail items={items(3)} finalPhase="Writing" ask={{ answered: true }} />);
    expect(screen.queryByTestId("ask-thinking-dots")).toBeNull();
  });
  it("6. reduced motion: no element carries the flicker", async () => {
    setReducedMotion(true);
    render(<ThinkingTrail items={items(3)} finalPhase="Writing" ask={{ answered: false }} />);
    await Promise.resolve();
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".nb-trail-row"));
    expect(rows).toHaveLength(3);
    expect(document.querySelectorAll("[data-a1-flicker], .ask-a1-flicker")).toHaveLength(0);
    for (const row of rows) { expect(row.style.animation).toBe(""); expect(row.style.opacity).toBe("0.7"); }
  });
});
