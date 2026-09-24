// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import type { ContextManifest } from "@/lib/context-manifest";

const mocks = vi.hoisted(() => ({ emitClientEvent: vi.fn() }));

vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: mocks.emitClientEvent }));
vi.mock("@/components/reflect/LassoThinkingMark", () => ({
  LassoThinkingMark: ({ kind, size, className }: { kind: string; size: number; className?: string }) => (
    <span data-lasso-thinking-mark={kind} data-size={size} className={className} />
  ),
}));

const manifest: ContextManifest = {
  engagement: { id: "engagement-1", name: "Northstar" },
  brief_included: true,
  firm_checks_applied: 2,
  items: [
    { id: "read-1", title: "Interview notes", kind: "note", detail: "420 words" },
    { id: "read-2", title: "Working deck", kind: "deck", detail: "8 slides" },
  ],
  excluded: [{ title: "Private note", reason: "not available for this question" }],
  assembled_at: "2026-09-22T08:00:00.000Z",
};

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("ThinkingTrail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T01:00:00.000Z"));
    setReducedMotion(false);
    mocks.emitClientEvent.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows a rolling window of at most three pending rows with only the last live", () => {
    const { container } = render(
      <ThinkingTrail
        items={Array.from({ length: 7 }, (_, index) => ({ id: `selected-${index}`, title: `Selected ${index}` }))}
        finalPhase="Writing…"
      />,
    );
    const rows = container.querySelectorAll("[data-trail-state]");
    expect(rows).toHaveLength(3);
    expect([...rows].map((row) => row.textContent)).toEqual(["Selected 4", "Selected 5", "Selected 6"]);
    expect(container.querySelectorAll("[data-trail-state].live")).toHaveLength(1);
    expect(rows[2]?.classList.contains("live")).toBe(true);
    expect(screen.getByText("Reading your work")).toBeTruthy();
  });

  it("uses only the last three server-confirmed rows and summarizes confirmed inputs", () => {
    const sevenItemManifest: ContextManifest = {
      ...manifest,
      items: Array.from({ length: 7 }, (_, index) => ({ id: `read-${index}`, title: `Read ${index}`, kind: "document", detail: `${index + 1} pages` })),
    };
    const { container } = render(<ThinkingTrail items={[]} finalPhase="Writing…" manifest={sevenItemManifest} />);
    expect(container.querySelectorAll('[data-trail-state="read"]')).toHaveLength(3);
    expect(screen.getByText("Read 7 pieces of work, the brief, 2 firm checks")).toBeTruthy();
    expect(screen.getByText("Writing…")).toBeTruthy();
    expect(screen.queryByText("Private note")).toBeNull();
  });

  it("counts only real wall-clock elapsed time", () => {
    render(<ThinkingTrail items={[]} finalPhase="Writing…" />);
    expect(screen.getByText("0:00")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByText("1:05")).toBeTruthy();
  });

  it("adds no motion classes under reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(<ThinkingTrail items={[]} finalPhase="Writing…" manifest={manifest} />);
    expect(container.querySelector(".nb-trail-window-enter")).toBeNull();
    expect(container.querySelector(".nb-trail-window-leave")).toBeNull();
    expect(container.querySelector(".nb-audit-settle")).toBeNull();
  });
});

describe("ContextAudit", () => {
  beforeEach(() => {
    setReducedMotion(false);
    mocks.emitClientEvent.mockClear();
  });
  afterEach(cleanup);

  it("is closed by default and shows the complete line count", () => {
    render(<ContextAudit manifest={manifest} />);
    const button = screen.getByRole("button", { name: /Read what went into this response5/i });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("heading", { name: "Read" })).toBeNull();
  });

  it("opens grouped rows and emits count bands once without titles or reasons", () => {
    const { container } = render(<ContextAudit manifest={manifest} />);
    const button = screen.getByRole("button", { name: /Read what went into this response5/i });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("heading", { name: "Read" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Also in" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Not read" })).toBeTruthy();
    expect(container.querySelector('[data-audit-group="read"]')?.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector('[data-audit-group="also-in"]')?.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector('[data-audit-group="not-read"]')?.querySelectorAll("p")).toHaveLength(1);
    expect(mocks.emitClientEvent).toHaveBeenCalledOnce();
    expect(mocks.emitClientEvent).toHaveBeenCalledWith("reflect.trail_opened", {
      read_band: "1-10",
      also_in_band: "1-10",
      not_read_band: "1-10",
    });
    expect(JSON.stringify(mocks.emitClientEvent.mock.calls)).not.toContain("Interview notes");
    expect(JSON.stringify(mocks.emitClientEvent.mock.calls)).not.toContain("not available");
  });

  it("honours a custom label and omits settle motion when reduced", () => {
    setReducedMotion(true);
    const { container } = render(<ContextAudit manifest={manifest} buttonLabel="Response inputs" />);
    expect(screen.getByRole("button", { name: /Response inputs5/i })).toBeTruthy();
    expect(container.querySelector(".nb-audit-settle")).toBeNull();
  });
});