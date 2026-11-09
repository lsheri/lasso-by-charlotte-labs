import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

const { noteWorkboardAskHeld, noteWorkboardAskView } = await import("@/components/canvas-lab/canvas-lab-telemetry");
const { guardWorkboardEvent } = await import("@/lib/workboard-event-allowlist");

beforeEach(() => logEvent.mockClear());

describe("COV-1: coverage dims, event names unchanged", () => {
  it("H7 hand-offs carry their choice and route", () => {
    noteWorkboardAskView("o1", "handoff_opened", "b", { choice: "chat_and_used", route: "link" });
    expect(logEvent).toHaveBeenCalledWith("workboard.ask_view", "o1", { action: "handoff_opened", draft: "b", choice: "chat_and_used", route: "link" });
  });
  it("the held question is queued, then sent or cancelled; never its text", () => {
    noteWorkboardAskHeld("o1", "queued");
    noteWorkboardAskHeld("o1", "sent");
    expect(logEvent).toHaveBeenNthCalledWith(1, "workboard.ask_view", "o1", { action: "question_held", held: "queued" });
    expect(logEvent).toHaveBeenNthCalledWith(2, "workboard.ask_view", "o1", { action: "question_held", held: "sent" });
  });
  it("a pinned answer's edit Cancel and the tip's Got it", () => {
    noteWorkboardAskView("o1", "pin_edit_cancelled", "b");
    noteWorkboardAskView("o1", "pin_tip_dismissed", "b");
    expect(logEvent).toHaveBeenNthCalledWith(1, "workboard.ask_view", "o1", { action: "pin_edit_cancelled", draft: "b" });
    expect(logEvent).toHaveBeenNthCalledWith(2, "workboard.ask_view", "o1", { action: "pin_tip_dismissed", draft: "b" });
  });
  it("the server guard keeps the new dims and still drops anything else", () => {
    const kept = guardWorkboardEvent("workboard.ask_view", { action: "handoff_opened", draft: "b", choice: "full_board", route: "file", held: "sent", text: "secret" } as never);
    expect(kept).toEqual({ keep: true, dims: { action: "handoff_opened", draft: "b", choice: "full_board", route: "file", held: "sent" } });
  });
  it("the call sites send them", () => {
    const draft = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    const card = readFileSync("src/components/canvas-lab/LabAnswerCard.tsx", "utf8");
    const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
    expect(draft).toContain('noteWorkboardAskView(props.orgId, "handoff_opened", draft, { choice, route });');
    expect(card).toContain('noteWorkboardAskView(orgId, "pin_edit_cancelled", "b");');
    expect(card).toContain('noteWorkboardAskView(orgId, "pin_tip_dismissed", "b"); dismissTip();');
    expect(hook).toContain('if (queued === null) noteWorkboardAskHeld(orgId, "queued");');
    expect(hook).toContain('noteWorkboardAskHeld(orgId, wanted ? "sent" : "cancelled");');
  });
});
