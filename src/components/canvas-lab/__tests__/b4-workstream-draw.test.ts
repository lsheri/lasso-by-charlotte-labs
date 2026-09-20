import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { logEvent } from "@/lib/telemetry";
import { noteWorkboardWorkstreamDrawn } from "@/components/canvas-lab/canvas-lab-telemetry";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";
import {
  defaultWorkstreamName,
  drawnRect,
  drawnRectUsable,
  movePromptText,
  splitClaims,
  type ClaimCandidate,
} from "@/lib/workstream-draw";

function card(id: string, frame: string, x: number, y: number, workItemId: string | null = `item-${id}`): ClaimCandidate {
  return { id, frame, x, y, width: 100, height: 60, workItemId };
}

const BOX = { x: 0, y: 0, width: 400, height: 300 };

describe("drawing a workstream", () => {
  it("normalises a drag in any direction and ignores a tiny one", () => {
    expect(drawnRect({ x: 300, y: 200 }, { x: 100, y: 50 })).toEqual({ x: 100, y: 50, width: 200, height: 150 });
    expect(drawnRectUsable(drawnRect({ x: 0, y: 0 }, { x: 10, y: 10 }))).toBe(false);
    expect(drawnRectUsable(BOX)).toBe(true);
  });

  it("claims a card only when it is fully inside the box", () => {
    const inside = card("in", "foundation", 20, 20);
    const overlapping = card("edge", "foundation", 350, 260);
    const outside = card("out", "foundation", 900, 900);
    const split = splitClaims(BOX, [inside, overlapping, outside]);
    expect(split.silent.map((entry) => entry.id)).toEqual(["in"]);
    expect(split.ask).toHaveLength(0);
    expect(split.frameOnly).toHaveLength(0);
  });

  it("moves base-frame and board-home cards without asking", () => {
    const split = splitClaims(
      BOX,
      [
        card("foundation", "foundation", 0, 0),
        card("decisions", "decisions", 110, 0),
        card("outputs", "outputs", 220, 0),
        card("home", "task:home-task", 0, 70),
      ],
      { defaultHomeFrameIds: ["task:home-task"] },
    );
    expect(split.silent.map((entry) => entry.id)).toEqual(["foundation", "decisions", "outputs", "home"]);
    expect(split.ask).toHaveLength(0);
  });

  it("collects a card that already sits in another workstream", () => {
    const split = splitClaims(
      BOX,
      [card("claimed", "task:other", 0, 0), card("loose", "foundation", 120, 0)],
      { defaultHomeFrameIds: ["task:home-task"] },
    );
    expect(split.ask.map((entry) => entry.id)).toEqual(["claimed"]);
    expect(split.silent.map((entry) => entry.id)).toEqual(["loose"]);
  });

  it("gives a judgment, decision or draft the outline only", () => {
    const split = splitClaims(BOX, [card("judgment", "task:other", 0, 0, null)]);
    expect(split.frameOnly.map((entry) => entry.id)).toEqual(["judgment"]);
    expect(split.ask).toHaveLength(0);
    expect(split.silent).toHaveLength(0);
  });

  it("leaves placements untouched when the answer is leave them", async () => {
    const split = splitClaims(
      BOX,
      [card("claimed", "task:other", 0, 0), card("loose", "foundation", 120, 0)],
      {},
    );
    const moved: string[] = [];
    const move = async (entry: ClaimCandidate) => { moved.push(entry.id); return true; };
    for (const entry of split.silent) await move(entry);
    const answer: "yes" | "keep" = "keep";
    if (answer === "yes") for (const entry of split.ask) await move(entry);
    expect(moved).toEqual(["loose"]);
  });

  it("names the box and words the prompt plainly", () => {
    expect(defaultWorkstreamName([])).toBe("New workstream");
    expect(defaultWorkstreamName(["New workstream"])).toBe("New workstream 2");
    expect(movePromptText(1)).toBe("Move 1 card into this workstream?");
    expect(movePromptText(3)).toBe("Move 3 cards into this workstream?");
  });

  it("reports one drawn workstream with a count and whether it asked", () => {
    const mocked = vi.mocked(logEvent);
    mocked.mockClear();
    noteWorkboardWorkstreamDrawn("org", 4, "true");
    expect(mocked).toHaveBeenCalledTimes(1);
    const [name, , dims] = mocked.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(name).toBe("workboard.workstream_drawn");
    expect(dims).toEqual({ claimed: 4, asked: "true" });
    expect(guardWorkboardEvent(name, dims as never)).toEqual({ keep: true, dims });
  });
});
