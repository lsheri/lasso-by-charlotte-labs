// @vitest-environment jsdom
// Mock block copied from secd1b-section-marker-ui.test.tsx (telemetry mock, cleanup, fake Date).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOARD_JUMP_COPY, BoardJumpControls } from "@/components/canvas-lab/BoardJumpControls";
import { adjacentSection, hasPeriodSection, markedSectionAt, sectionForDate } from "@/lib/board-section";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";
import { logEvent } from "@/lib/telemetry";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
// Wednesday 21 Oct 2026, local time.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 21, 12)); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

const w42 = { id: "section:w42", periodStart: "2026-10-12", periodEnd: "2026-10-18" };
const w43 = { id: "section:w43", periodStart: "2026-10-19", periodEnd: "2026-10-25" };
const w45 = { id: "section:w45", periodStart: "2026-11-02", periodEnd: "2026-11-08" };
const n1 = { id: "section:n1", sequenceNo: 1 };
const n2 = { id: "section:n2", sequenceNo: 2 };
const n3 = { id: "section:n3", sequenceNo: 3 };

describe("SECD-2 choosing", () => {
  it("goes to the section covering the date", () => {
    expect(sectionForDate([w45, w42, w43], "2026-10-21")).toBe("section:w43");
  });
  it("goes to the nearest when none covers, earlier or later", () => {
    expect(sectionForDate([w42, w45], "2026-10-20")).toBe("section:w42"); // 2 days after w42 vs 13 before w45
    expect(sectionForDate([w42, w45], "2026-10-31")).toBe("section:w45"); // 13 after w42 vs 2 before w45
  });
  it("goes to the nearest when the only sections are earlier", () => {
    expect(sectionForDate([w42, w43], "2027-03-01")).toBe("section:w43");
  });
  it("next and previous within periods follow date order, not array order", () => {
    const all = [w45, w42, w43];
    expect(adjacentSection(all, "section:w43", "next")).toBe("section:w45");
    expect(adjacentSection(all, "section:w43", "previous")).toBe("section:w42");
    expect(adjacentSection(all, "section:w45", "next")).toBeNull();
  });
  it("next and previous within numbers follow number order", () => {
    const all = [n3, n1, n2];
    expect(adjacentSection(all, "section:n2", "next")).toBe("section:n3");
    expect(adjacentSection(all, "section:n2", "previous")).toBe("section:n1");
    expect(adjacentSection(all, "section:n1", "previous")).toBeNull();
  });
  it("a board with both kinds keeps two separate orders", () => {
    const all = [n2, w43, n1, w42];
    expect(adjacentSection(all, "section:w42", "next")).toBe("section:w43");
    expect(adjacentSection(all, "section:w43", "next")).toBeNull();
    expect(adjacentSection(all, "section:n1", "next")).toBe("section:n2");
    expect(sectionForDate(all, "2026-10-21")).toBe("section:w43");
  });
  it("a board with no markers has nowhere to go", () => {
    const plain = [{ id: "section:a" }, { id: "section:b" }];
    expect(hasPeriodSection(plain)).toBe(false);
    expect(sectionForDate(plain, "2026-10-21")).toBeNull();
    expect(adjacentSection(plain, "section:a", "next")).toBeNull();
    expect(hasPeriodSection([n1, n2])).toBe(false);
  });
  it("finds the marked section under the view centre, ignoring unmarked ones", () => {
    const rects = [{ id: "section:plain", x: 0, y: 0, width: 100, height: 100 }, { ...w43, x: 0, y: 0, width: 400, height: 300 }];
    expect(markedSectionAt(rects, { x: 50, y: 50 })).toBe("section:w43");
    expect(markedSectionAt(rects, { x: 900, y: 50 })).toBeNull();
  });
});

describe("SECD-2 controls", () => {
  it("are hidden when no section carries a period", () => {
    const { container } = render(<BoardJumpControls orgId="org" sections={[n1, n2]} currentId={null} phone={false} onJump={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
  it("are never on the public shared board", () => {
    const source = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
    expect(source).not.toContain("BoardJumpControls");
  });
  it("phone shows only This week", () => {
    render(<BoardJumpControls orgId="org" sections={[w42, w43]} currentId="section:w43" phone onJump={vi.fn()} />);
    expect(screen.getByRole("button", { name: "This week" })).toBeTruthy();
    expect(screen.queryByLabelText(BOARD_JUMP_COPY.date)).toBeNull();
    expect(screen.queryByRole("button", { name: BOARD_JUMP_COPY.next })).toBeNull();
    expect(screen.queryByRole("button", { name: BOARD_JUMP_COPY.previous })).toBeNull();
  });
  it("This week jumps to today's section and fires the event once", () => {
    const onJump = vi.fn();
    render(<BoardJumpControls orgId="org" sections={[w42, w43, w45]} currentId={null} phone={false} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "This week" }));
    expect(onJump).toHaveBeenCalledExactlyOnceWith("section:w43");
    expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.board_jumped", "org", { to: "this_week" });
  });
  it("the date picker jumps and fires to date once", () => {
    const onJump = vi.fn();
    render(<BoardJumpControls orgId="org" sections={[w42, w43, w45]} currentId={null} phone={false} onJump={onJump} />);
    fireEvent.change(screen.getByLabelText(BOARD_JUMP_COPY.date), { target: { value: "2026-11-04" } });
    expect(onJump).toHaveBeenCalledExactlyOnceWith("section:w45");
    expect(logEvent).toHaveBeenCalledExactlyOnceWith("workboard.board_jumped", "org", { to: "date" });
  });
  it("Next and Previous move in date order and fire once each", () => {
    const onJump = vi.fn();
    render(<BoardJumpControls orgId="org" sections={[w45, w42, w43]} currentId="section:w43" phone={false} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: BOARD_JUMP_COPY.next }));
    expect(onJump).toHaveBeenLastCalledWith("section:w45");
    expect(logEvent).toHaveBeenLastCalledWith("workboard.board_jumped", "org", { to: "next" });
    fireEvent.click(screen.getByRole("button", { name: BOARD_JUMP_COPY.previous }));
    expect(onJump).toHaveBeenLastCalledWith("section:w42");
    expect(logEvent).toHaveBeenLastCalledWith("workboard.board_jumped", "org", { to: "previous" });
    expect(logEvent).toHaveBeenCalledTimes(2);
  });
  it("the event keeps only its entry, never a date", () => {
    expect(guardWorkboardEvent("workboard.board_jumped", { to: "date", day: "2026-11-04", person: "x" })).toEqual({ keep: true, dims: { to: "date" } });
  });
  it("copy has no em dash or activity-counting words", () => {
    const text = Object.values(BOARD_JUMP_COPY).join(" ").toLowerCase();
    expect(text).not.toContain("\u2014");
    for (const word of ["overdue", "late", "behind", "stale", "missed"]) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});
