import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ANSWER_DRAG_MIME, KEEP_ANSWER_ANNOUNCEMENT, KEEP_ANSWER_LABEL, isAnswerDrag, parseAnswerDrop } from "@/lib/answer-card";
import { ASK_LASSO_MAKING_RULES } from "@/lib/reflect-shared";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const page = read("src/pages/CanvasLabPage.tsx");
const surface = read("src/components/reflect/AskSurface.tsx");
const run = read("src/lib/reflect-run.server.ts");

describe("B4 put on board", () => {
  beforeEach(() => logEvent.mockReset());

  it("uses the new label and announcement", () => {
    expect(KEEP_ANSWER_LABEL).toBe("Put on board");
    expect(KEEP_ANSWER_ANNOUNCEMENT).toBe("Put on the board.");
    expect(page).toContain("setAnnouncement(KEEP_ANSWER_ANNOUNCEMENT)");
  });

  it("only accepts drops carrying the answer type", () => {
    expect(ANSWER_DRAG_MIME).toBe("application/x-lasso-answer");
    expect(isAnswerDrag(["text/plain"])).toBe(false);
    expect(isAnswerDrag(["text/plain", ANSWER_DRAG_MIME])).toBe(true);
    expect(isAnswerDrag(null)).toBe(false);
    expect(parseAnswerDrop("nope")).toBeNull();
    expect(parseAnswerDrop(JSON.stringify({ messageId: 3, text: "Hi", reads: [{ id: "a", depth: "full" }] }))).toEqual({ messageId: 3, text: "Hi", reads: [{ id: "a", depth: "full" }] });
    expect(page).toMatch(/onDragOver=\{\(event\) => \{ if \(!canAddWork \|\| !isAnswerDrag\(event\.dataTransfer\.types\)\) return; event\.preventDefault\(\); event\.dataTransfer\.dropEffect = "copy";/);
    expect(page).toContain('onDrop={(event) => { if (!isAnswerDrag(event.dataTransfer.types)) return;');
  });

  it("keepAnswerAsCard honours a drop point", () => {
    expect(page).toContain('keepAnswerAsCard(answer: KeptAnswer, options?: { at?: Point; via?: "button" | "drag" })');
    expect(page).toContain("at = options.at;");
    expect(page).toContain('keepAnswerAsCard(answer, { at: stagePoint(event.clientX, event.clientY), via: "drag" })');
  });

  it("adds the via dim only when passed", async () => {
    const { noteWorkboardNodeCreated } = await import("@/components/canvas-lab/canvas-lab-telemetry");
    noteWorkboardNodeCreated("org", "answer");
    expect(logEvent).toHaveBeenLastCalledWith("workboard.node_created", "org", { kind: "answer", judgment_type: "none" });
    noteWorkboardNodeCreated("org", "answer", undefined, "drag");
    expect(logEvent).toHaveBeenLastCalledWith("workboard.node_created", "org", { kind: "answer", judgment_type: "none", via: "drag" });
  });

  it("the server guard keeps via on node_created and strips unknown keys", async () => {
    const { guardWorkboardEvent } = await import("@/lib/workboard-event-allowlist");
    const kept = guardWorkboardEvent("workboard.node_created", { kind: "answer", judgment_type: "none", via: "drag" });
    expect(kept).toEqual({ keep: true, dims: { kind: "answer", judgment_type: "none", via: "drag" } });
    const stripped = guardWorkboardEvent("workboard.node_created", { kind: "answer", judgment_type: "none", via: "drag", text: "hello" });
    expect(stripped).toEqual({ keep: true, dims: { kind: "answer", judgment_type: "none", via: "drag" } });
  });

  it("shows the grip only where the keep action exists", () => {
    expect(surface).toContain("const canDragAnswer = !!keep && !isMobile && !coarse;");
    expect(surface).toContain('aria-label="Drag onto the board"');
    expect(surface).toContain("canDrag={canDragAnswer}");
    expect(surface).toContain("{canDrag ? (");
    expect(read("src/styles.css")).toContain('body[data-answer-drag="true"] .canvas-lab-surface iframe { pointer-events: none; }');
  });

  it("tells Lasso it never claims and asks before a document", () => {
    expect(ASK_LASSO_MAKING_RULES).toContain("Never say you added, saved, created, placed or drafted something onto the board or into a document.");
    expect(ASK_LASSO_MAKING_RULES).toContain("before drafting ask one short question confirming they want it drafted");
    expect(run).toContain('surface === "ask_lasso" ? [{ role: "system" as const, content: ASK_LASSO_MAKING_RULES }]');
  });
});
