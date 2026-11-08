// @vitest-environment jsdom
// ASK-FIX: the question shows in the thread the moment it is sent, and the composer clears at once.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/work/ThreadViewerById", () => ({ ThreadViewerById: () => null }));
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));
vi.mock("@/hooks/use-has-live-coach-link", () => ({ useHasLiveCoachLink: () => false }));

import { MessagesTab } from "@/components/reflect/AskSurface";
import type { AskLasso } from "@/components/reflect/use-ask-lasso";

const hook = readFileSync(resolve(process.cwd(), "src/components/reflect/use-ask-lasso.ts"), "utf8");
const send = hook.slice(hook.indexOf("async function send("), hook.indexOf("return {", hook.indexOf("async function send(")));

function fakeAsk(over: Partial<Record<string, unknown>>): AskLasso {
  return {
    messages: [],
    asked: null,
    pending: false,
    streamed: "",
    pointedNow: [],
    selectedItems: [],
    liveManifest: null,
    sourcesByMessage: {},
    coverage: null,
    bottomRef: { current: null },
    profile: { display_name: "Liam" },
    ...over,
  } as unknown as AskLasso;
}

describe("ASK-FIX question visible while Lasso works", () => {
  afterEach(cleanup);

  it("shows the asked question in the thread while pending, before the saved copy returns", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    render(<MessagesTab ask={fakeAsk({ asked: "What did the CFO say about tier 3?", pending: true, messages: [{ id: "m0", role: "user", content: "An earlier question", created_at: "2026-11-08T20:00:00Z" }] })} />);
    expect(screen.getByTestId("asked-now").textContent).toContain("What did the CFO say about tier 3?");
  });

  it("does not show it twice once the saved copy is back", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    const content = "What did the CFO say about tier 3?";
    render(<MessagesTab ask={fakeAsk({ asked: content, pending: true, messages: [{ id: "m1", role: "user", content, created_at: "2026-11-08T21:00:00Z" }] })} />);
    expect(screen.queryByTestId("asked-now")).toBeNull();
  });

  it("sets asked and clears the composer as soon as the send starts, before any waiting", () => {
    const start = send.indexOf("setPending(true);");
    const firstAwait = send.indexOf("await ");
    expect(send.indexOf("setAsked(message);")).toBeGreaterThan(start);
    expect(send.indexOf("setAsked(message);")).toBeLessThan(firstAwait);
    expect(send.indexOf('setDraft("");')).toBeLessThan(firstAwait);
    expect(send.slice(send.indexOf("awaitPrime"))).not.toContain('setDraft("")');
  });

  it("gives the words back on failure and clears asked when done", () => {
    expect(send).toContain("setDraft((current) => current || message);");
    expect(send.slice(send.indexOf("} finally {"))).toContain("setAsked(null);");
    expect(hook).toContain("}, [messages?.length, pending, asked]);");
  });

  it("leaves the cache warm-up path untouched", () => {
    expect(hook).toMatch(/shouldPrimeForDraft\(/);
    expect(send).toContain("await awaitPrime(resolvedScope ?? scopeForSelection());");
  });
});
