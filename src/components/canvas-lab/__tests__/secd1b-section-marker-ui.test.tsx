// @vitest-environment jsdom
// Mock block copied from sec2-section.test.tsx (telemetry mock, cleanup, props factory).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LabSection, SECTION_MARKER_COPY, nextWeekSectionRect, shiftedSectionMarker } from "@/components/canvas-lab/LabSection";
import { noteWorkboardSection, noteWorkboardSectionMarker } from "@/components/canvas-lab/canvas-lab-telemetry";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";
import { logEvent } from "@/lib/telemetry";
import { readFileSync } from "node:fs";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
// Wednesday 21 Oct 2026, local time.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 21, 12)); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

const base = { id: "section:pricing", name: "Pricing", x: 10, y: 20, width: 400, height: 300 };
const week = { ...base, periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: null };
function props(frame: typeof base & Record<string, unknown> = base) {
  return { frame, title: "Pricing", selected: true, editable: true, onSelect: vi.fn(), onDragStart: vi.fn(), onResizeStart: vi.fn(), onResizeKeyDown: vi.fn(), onResizeKeyUp: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onMenuOpened: vi.fn(), onMarker: vi.fn(), onClearMarker: vi.fn(), onShift: vi.fn(), onNewNextWeek: vi.fn() };
}
function openMenu() { fireEvent.contextMenu(screen.getByText("Pricing")); }
function item(name: string) { return screen.getByRole("menuitem", { name }); }

describe("SECD-1b marker line", () => {
  it("renders the marker line beside the title", () => {
    render(<LabSection {...props(week)} />);
    expect(screen.getByTestId("section-marker-line").textContent).toBe("Week of 19 Oct");
  });
  it("gives both marker branches their own 13px type rather than the 45px badge type", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    const markerRule = styles.match(/\.canvas-lab-section-title \[data-testid="section-marker-line"\] \{([^}]+)\}/)?.[1];
    expect(markerRule).toContain("font-size: 13px !important;");
    expect(markerRule).toContain("font-family: var(--font-mono);");
    expect(markerRule).not.toContain("font-size: 45px;");
    const view = render(<LabSection {...props(week)} />);
    expect(screen.getByTestId("section-marker-line").parentElement?.className).toContain("items-baseline");
    view.rerender(<LabSection {...props(week)} editable={false} />);
    expect(screen.getByTestId("section-marker-line").tagName).toBe("SPAN");
  });
  it("renders nothing extra without a marker", () => {
    const view = render(<LabSection {...props()} />);
    expect(screen.queryByTestId("section-marker-line")).toBeNull();
    expect(view.container.querySelector(".canvas-lab-section-title > h2")).toBeTruthy();
  });
  it("clicking the line opens the picker with via line", () => {
    const p = props(week); render(<LabSection {...p} />);
    fireEvent.click(screen.getByTestId("section-marker-line"));
    expect(screen.getByTestId("section-marker-picker")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SECTION_MARKER_COPY.day }));
    expect(p.onMarker).toHaveBeenCalledExactlyOnceWith({ periodStart: "2026-10-21", periodEnd: "2026-10-21", sequenceNo: null }, { kind: "period", preset: "day", via: "line" });
  });
  it("shared board shows the line read-only and offers no menu", () => {
    const p = props(week); render(<LabSection {...p} editable={false} />);
    expect(screen.getByTestId("section-marker-line").tagName).toBe("SPAN");
    fireEvent.click(screen.getByTestId("section-marker-line"));
    expect(screen.queryByTestId("section-marker-picker")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.contextMenu(screen.getByText("Pricing"));
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});

describe("SECD-1b menu", () => {
  it("Set period: Week defaults to the week containing today", () => {
    const p = props(); render(<LabSection {...p} />); openMenu(); fireEvent.click(item("Set period"));
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(p.onMarker).toHaveBeenCalledExactlyOnceWith({ periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: null }, { kind: "period", preset: "week", via: "menu" });
  });
  it("Set period: Month defaults to this month", () => {
    const p = props(); render(<LabSection {...p} />); openMenu(); fireEvent.click(item("Set period"));
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(p.onMarker).toHaveBeenCalledExactlyOnceWith({ periodStart: "2026-10-01", periodEnd: "2026-10-31", sequenceNo: null }, { kind: "period", preset: "month", via: "menu" });
  });
  it("Set period: Custom range opens two date fields", () => {
    const p = props(); render(<LabSection {...p} />); openMenu(); fireEvent.click(item("Set period"));
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-03" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(p.onMarker).toHaveBeenCalledExactlyOnceWith({ periodStart: "2026-11-03", periodEnd: "2026-11-14", sequenceNo: null }, { kind: "period", preset: "custom", via: "menu" });
  });
  it("Set number sets a number and clears dates, preset none", () => {
    const p = props(week); render(<LabSection {...p} />); openMenu(); fireEvent.click(item("Set number"));
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(p.onMarker).toHaveBeenCalledExactlyOnceWith({ periodStart: null, periodEnd: null, sequenceNo: 2 }, { kind: "number", preset: "none", via: "menu" });
  });
  it("Clear marker shows only when there is one", () => {
    const p = props(); const view = render(<LabSection {...p} />); openMenu();
    expect(screen.queryByRole("menuitem", { name: "Clear marker" })).toBeNull();
    cleanup(); const q = props(week); render(<LabSection {...q} />); openMenu();
    fireEvent.click(item("Clear marker")); expect(q.onClearMarker).toHaveBeenCalledOnce();
    void view;
  });
  it("Shift items show only for a week and pass the direction", () => {
    const p = props({ ...base, periodStart: "2026-11-03", periodEnd: "2026-11-14", sequenceNo: null } as never); render(<LabSection {...p} />); openMenu();
    expect(screen.queryByRole("menuitem", { name: "Shift to next week" })).toBeNull();
    cleanup(); const q = props(week); render(<LabSection {...q} />); openMenu();
    fireEvent.click(item("Shift to next week")); expect(q.onShift).toHaveBeenCalledExactlyOnceWith("next");
    openMenu(); fireEvent.click(item("Shift to previous week")); expect(q.onShift).toHaveBeenLastCalledWith("previous");
  });
  it("New section for next week fires only on click", () => {
    const p = props(week); render(<LabSection {...p} />);
    expect(p.onNewNextWeek).not.toHaveBeenCalled();
    openMenu(); fireEvent.click(item("New section for next week")); expect(p.onNewNextWeek).toHaveBeenCalledOnce();
  });
});

describe("SECD-1b rules", () => {
  it("shifting changes dates and not position", () => {
    expect(shiftedSectionMarker(week, "next")).toEqual({ periodStart: "2026-10-26", periodEnd: "2026-11-01", sequenceNo: null });
    expect(shiftedSectionMarker(week, "previous")).toEqual({ periodStart: "2026-10-12", periodEnd: "2026-10-18", sequenceNo: null });
    expect(shiftedSectionMarker(week, "next")).not.toHaveProperty("x");
    expect(shiftedSectionMarker(base, "next")).toBeNull();
  });
  it("next week sibling sits to the right, same size, week after, no contents", () => {
    const rect = nextWeekSectionRect(week, new Date());
    expect(rect).toEqual({ x: 450, y: 20, width: 400, height: 300, marker: { periodStart: "2026-10-26", periodEnd: "2026-11-01", sequenceNo: null } });
    expect(nextWeekSectionRect(base, new Date()).marker).toEqual({ periodStart: "2026-10-26", periodEnd: "2026-11-01", sequenceNo: null });
    noteWorkboardSection("org", "created", undefined, "next_week");
    expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_created", "org", { via: "next_week" });
  });
});

describe("SECD-1b events", () => {
  it("marker_set fires once with closed dims and no values", () => {
    noteWorkboardSectionMarker("org", { action: "set", kind: "number", preset: "none", via: "line" });
    expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_marker_set", "org", { kind: "number", preset: "none", via: "line" });
    expect(guardWorkboardEvent("workboard.section_marker_set", { kind: "period", preset: "week", via: "menu", period_start: "2026-10-19", person: "x" })).toEqual({ keep: true, dims: { kind: "period", preset: "week", via: "menu" } });
  });
  it("marker_cleared fires once with no dims", () => {
    noteWorkboardSectionMarker("org", { action: "cleared" });
    expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_marker_cleared", "org", {});
    expect(guardWorkboardEvent("workboard.section_marker_cleared", { sequence_no: 2 })).toEqual({ keep: true, dims: {} });
  });
  it("section_shifted fires once with direction only", () => {
    noteWorkboardSectionMarker("org", { action: "shifted", direction: "previous" });
    expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.section_shifted", "org", { direction: "previous" });
    expect(guardWorkboardEvent("workboard.section_shifted", { direction: "next", period_end: "x" })).toEqual({ keep: true, dims: { direction: "next" } });
  });
  it("copy has no em dash or banned words", () => {
    const text = Object.values(SECTION_MARKER_COPY).join(" ").toLowerCase();
    expect(text).not.toContain("\u2014");
    for (const word of ["overdue", "late", "behind", "stale"]) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});
