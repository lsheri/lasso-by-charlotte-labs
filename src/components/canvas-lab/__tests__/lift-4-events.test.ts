import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

import {
  noteWorkboardWorkLifted,
  noteWorkboardWorkLiftExpanded,
} from "@/components/canvas-lab/canvas-lab-telemetry";
import { LIFT_KINDS, liftKindOf } from "@/lib/lift-view";
import { WORKBOARD_EVENT_DIMS, guardWorkboardEvent } from "@/lib/workboard-event-allowlist";

beforeEach(() => logEvent.mockReset());

describe("LIFT L4: the two lift events carry the kind of work and nothing else", () => {
  it("kind is a closed set: the work type, a chat called a chat, anything else other", () => {
    expect(liftKindOf("ai_thread")).toBe("chat");
    for (const type of ["document", "deck", "sheet", "call", "email", "message", "image"])
      expect(liftKindOf(type)).toBe(type);
    expect(liftKindOf("Series A brief.pdf")).toBe("other");
    expect(liftKindOf(undefined)).toBe("other");
    expect(LIFT_KINDS).toContain(liftKindOf("anything at all"));
  });
  it("a lift sends workboard.work_lifted with kind only", () => {
    noteWorkboardWorkLifted("org", "deck");
    expect(logEvent).toHaveBeenCalledWith("workboard.work_lifted", "org", { kind: "deck" });
  });
  it("an expand sends workboard.work_lift_expanded with kind only", () => {
    noteWorkboardWorkLiftExpanded("org", "chat");
    expect(logEvent).toHaveBeenCalledWith("workboard.work_lift_expanded", "org", { kind: "chat" });
  });
  it("no workspace, no event", () => {
    noteWorkboardWorkLifted(undefined, "deck");
    expect(logEvent).not.toHaveBeenCalled();
  });
  it("the server keeps kind and drops anything else, such as a reading time", () => {
    expect(WORKBOARD_EVENT_DIMS["workboard.work_lifted"]).toEqual(["kind"]);
    expect(WORKBOARD_EVENT_DIMS["workboard.work_lift_expanded"]).toEqual(["kind"]);
    expect(guardWorkboardEvent("workboard.work_lifted", { kind: "deck", seconds: 42 })).toEqual({
      keep: true,
      dims: { kind: "deck" },
    });
  });
  it("the board sends them on a lift and on an expand, and never a duration", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("noteWorkboardWorkLifted(orgId, liftKindOf(cardItem?.type));");
    expect(page).toContain("noteWorkboardWorkLiftExpanded(orgId, liftKindOf(liftedItem.type));");
    expect(page).not.toMatch(/work_lift\w*[^\n]*(duration|seconds|ms)\b/);
  });
});
