// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { useResolveGrace } from "@/components/verify/VerifyThreadReader";
import type { VerifyThreadRequest } from "@/components/verify/verify-thread-state";

type Props = { req: VerifyThreadRequest | null };
import { RESOLVE_GRACE_MS } from "@/lib/verify-thread-shared";

const READER = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");
const STORY = readFileSync("src/components/verify/TurnCardStory.tsx", "utf8");
const CSS = readFileSync("src/styles.css", "utf8");

function request(over: Partial<VerifyThreadRequest>): VerifyThreadRequest {
  return { runId: null, itemId: "item-a", itemTitle: "Thread A", ...over };
}

describe("pass 133.1 grace disarm after skip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cut-before-resolve: the resolve gets NO grace, holding stays false", () => {
    const { result, rerender } = renderHook(
      ({ req }: Props) => useResolveGrace(req),
      { initialProps: { req: request({}) } },
    );
    // Skip during the pending phase.
    act(() => result.current.cut());
    // The run resolves.
    rerender({ req: request({ runId: "run-1" }) });
    expect(result.current.holding).toBe(false);
    // Not just "not yet": no timer is armed either.
    act(() => vi.advanceTimersByTime(RESOLVE_GRACE_MS + 100));
    expect(result.current.holding).toBe(false);
  });

  it("a fresh pending request re-arms the grace", () => {
    const { result, rerender } = renderHook(
      ({ req }: Props) => useResolveGrace(req),
      { initialProps: { req: request({}) } },
    );
    act(() => result.current.cut());
    rerender({ req: request({ runId: "run-1" }) });
    expect(result.current.holding).toBe(false);

    // Reader closes, then a NEW pending request opens (different item).
    rerender({ req: null });
    rerender({ req: request({ itemId: "item-b" }) });
    rerender({ req: request({ itemId: "item-b", runId: "run-2" }) });
    expect(result.current.holding).toBe(true);

    // The hold still ends after the grace beat on its own.
    act(() => vi.advanceTimersByTime(RESOLVE_GRACE_MS + 100));
    expect(result.current.holding).toBe(false);
  });

  it("cut during an active hold ends it immediately", () => {
    const { result, rerender } = renderHook(
      ({ req }: Props) => useResolveGrace(req),
      { initialProps: { req: request({}) } },
    );
    rerender({ req: request({ runId: "run-1" }) });
    expect(result.current.holding).toBe(true);
    act(() => result.current.cut());
    expect(result.current.holding).toBe(false);
    act(() => vi.advanceTimersByTime(RESOLVE_GRACE_MS + 100));
    expect(result.current.holding).toBe(false);
  });
});

describe("pass 133.1 page-turn fade", () => {
  it("fades the outgoing page over PAGE_FADE_MS instead of cutting", () => {
    expect(STORY).toContain("PAGE_FADE_MS");
    expect(STORY).toContain("usePageTurnFade");
    expect(STORY).toContain("nb-page-fade");
    expect(CSS).toMatch(/\.nb-journey-node\.nb-page-fade\s*\{[^}]*opacity:\s*0/);
    expect(CSS).toContain("transition: opacity 400ms ease");
  });

  it("owns and cleans the fade timer", () => {
    expect(STORY).toContain("window.clearTimeout(timer.current)");
    // Reduced motion never reaches the fade: the static path returns first.
    expect(STORY.indexOf("data-reduced=\"true\"")).toBeGreaterThan(-1);
  });
});
