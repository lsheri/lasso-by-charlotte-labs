// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { AnswerMoreMenu } from "@/components/reflect/AnswerMoreMenu";
import { AnswerRail, ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import type { ContextManifest } from "@/lib/context-manifest";

const mocks = vi.hoisted(() => ({ emitClientEvent: vi.fn() }));

vi.mock("@/components/work/ThreadViewerById", () => ({ ThreadViewerById: () => null }));
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

  it("shows the first three pending rows with only the last live", () => {
    const { container } = render(
      <ThinkingTrail
        items={Array.from({ length: 7 }, (_, index) => ({ id: `selected-${index}`, title: `Selected ${index}` }))}
        finalPhase="Writing…"
      />,
    );
    const rows = container.querySelectorAll("[data-trail-state]");
    expect(rows).toHaveLength(3);
    expect([...rows].map((row) => row.textContent)).toEqual(["Selected 0", "Selected 1", "Selected 2"]);
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

  it("omits empty read and not-read groups", () => {
    const emptyGroups: ContextManifest = { ...manifest, items: [], excluded: [] };
    render(<ContextAudit manifest={emptyGroups} />);
    fireEvent.click(screen.getByRole("button", { name: /Read what went into this response2/i }));
    expect(screen.queryByRole("heading", { name: "Read" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Not read" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Also in" })).toBeTruthy();
  });
});
describe("Unit 6 rail and single disclosure", () => {
  beforeEach(() => setReducedMotion(false));
  afterEach(() => cleanup());

  it("draws the thinking trail beside the lime working rail", () => {
    const { container } = render(<ThinkingTrail items={[{ id: "a", title: "A" }]} finalPhase="Writing" />);
    const rail = container.querySelector(".nb-answer-rail");
    expect(rail?.getAttribute("data-rail-state")).toBe("working");
    expect(rail?.querySelector('[data-testid="thinking-trail-rows"]')).toBeTruthy();
  });

  it("AnswerRail is lime while working and hairline when done", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.nb-answer-rail \{\s*border-left: 2px solid var\(--nb-lasso-green\);\s*padding-left: 12px;/);
    expect(css).toContain('.nb-answer-rail[data-rail-state="done"] { border-left-color: var(--nb-line-hairline); }');
    const { rerender } = render(<AnswerRail state="working"><p>answer</p></AnswerRail>);
    expect(screen.getByTestId("answer-rail").getAttribute("data-rail-state")).toBe("working");
    rerender(<AnswerRail state="done"><p>answer</p></AnswerRail>);
    expect(screen.getByTestId("answer-rail").getAttribute("data-rail-state")).toBe("done");
  });

  it("shows an ai_reads depth as the matching READ row detail and appends unmatched reads", () => {
    const { container } = render(
      <ContextAudit
        manifest={manifest}
        reads={[
          { id: "read-1", title: "Interview notes", type: "note", source_vendor: null, depth: "full" },
          { id: "extra-1", title: "Loose memo", type: "document", source_vendor: null, depth: "extract" },
        ]}
      />,
    );
    expect(container.querySelectorAll("[aria-expanded]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const row = container.querySelector('[data-audit-row="read-1"]');
    expect(row?.querySelector("[data-audit-detail]")?.textContent).toBe("read in full");
    const extra = container.querySelector('[data-audit-row="read:extra-1"]');
    expect(extra?.textContent).toContain("Loose memo");
    expect(extra?.textContent).toContain("summary only");
  });
});

describe("Unit 6 answer footer", () => {
  it("renders Put on board and holds Save for 1:1 in the More menu", async () => {
    const onSave = vi.fn();
    render(
      <div>
        <ContextAudit manifest={manifest} />
        <button type="button">Put on board</button>
        <AnswerMoreMenu onSave={onSave} />
      </div>,
    );
    expect(document.querySelectorAll("[aria-expanded]").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Put on board" })).toBeTruthy();
    expect(screen.queryByText("Save for 1:1")).toBeNull();
    const trigger = screen.getByRole("button", { name: /More/ });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    const item = await screen.findByText("Save for 1:1");
    fireEvent.click(item);
    expect(onSave).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("AskSurface wires one disclosure, Put on board, and the More menu", () => {
    const surface = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
    expect(surface).not.toContain("AnswerSources");
    expect(surface).not.toContain("Show where this came from");
    expect(surface.match(/<ContextAudit/g)).toHaveLength(1);
    expect(surface).toContain("{KEEP_ANSWER_LABEL}");
    expect(surface).toContain("<AnswerMoreMenu");
    expect(surface).toContain('<AnswerRail state="working">');
    expect(surface).toContain('<AnswerRail state="done">');
  });
});
