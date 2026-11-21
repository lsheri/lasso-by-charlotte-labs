// 21 Nov 2026, click path cards (QA round 2 of PR 304): the chat's way back to a step card after a change of page.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  awaitCard,
  CARD_RETURN_WAIT_MS,
  cardIsHere,
  cardNeverCame,
  pageOf,
  registerCardReturn,
  reopenCard,
  resetCardReturns,
  takeAwaited,
} from "@/lib/step-card-return";

afterEach(() => {
  resetCardReturns();
  vi.useRealTimers();
});

describe("the way back to a card", () => {
  it("reopens a card that is still here, and forgets one that has gone", () => {
    const reopen = vi.fn();
    const off = registerCardReturn("approval:p1", reopen);
    expect(cardIsHere("approval:p1")).toBe(true);
    expect(reopenCard("approval:p1")).toBe(true);
    expect(reopen).toHaveBeenCalledTimes(1);
    off();
    expect(cardIsHere("approval:p1")).toBe(false);
    expect(reopenCard("approval:p1")).toBe(false);
  });
  it("opens a card awaited from another page as soon as it mounts there, once", () => {
    vi.useFakeTimers();
    awaitCard("lead-final:p2");
    const reopen = vi.fn();
    registerCardReturn("lead-final:p2", reopen);
    vi.runAllTimers();
    expect(reopen).toHaveBeenCalledTimes(1);
    expect(cardNeverCame("lead-final:p2")).toBe(false);
  });
  it("says a card never came when the wait runs out, or when another card mounts instead", () => {
    const now = 1_000_000;
    awaitCard("approval:gone", now);
    registerCardReturn("approval:other", vi.fn(), now + 10);
    expect(cardNeverCame("approval:gone")).toBe(true);
    awaitCard("approval:late", now);
    const late = vi.fn();
    registerCardReturn("approval:late", late, now + CARD_RETURN_WAIT_MS + 1);
    expect(late).not.toHaveBeenCalled();
  });
  it("an unregister from an older mount never drops a newer one", () => {
    const off = registerCardReturn("proposal-flow", vi.fn());
    registerCardReturn("proposal-flow", vi.fn());
    off();
    expect(cardIsHere("proposal-flow")).toBe(true);
  });
  it("a list owner takes the key it waits for once, only for its own prefix and only in time", () => {
    const now = 2_000_000;
    awaitCard("lead-doc:p1:i1", now);
    expect(takeAwaited("approval:", now)).toBeNull();
    expect(takeAwaited("lead-doc:", now + CARD_RETURN_WAIT_MS + 1)).toBeNull();
    expect(takeAwaited("lead-doc:", now)).toBe("lead-doc:p1:i1");
    expect(takeAwaited("lead-doc:", now)).toBeNull();
  });
  it("compares pages, not queries", () => {
    expect(pageOf("/proposals?lead=x")).toBe("/proposals");
    expect(pageOf("/proposals/")).toBe("/proposals");
    expect(pageOf("")).toBe("/");
  });
});
