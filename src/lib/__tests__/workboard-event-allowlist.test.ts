import { describe, expect, it, vi } from "vitest";

import {
  WORKBOARD_EVENT_DIMS,
  guardWorkboardEvent,
  isWorkboardEvent,
} from "../workboard-event-allowlist";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { logEvent } from "@/lib/telemetry";
import * as helpers from "@/components/canvas-lab/canvas-lab-telemetry";

describe("the workboard allowlist", () => {
  it("pins every name and its dim keys", () => {
    expect(WORKBOARD_EVENT_DIMS).toMatchInlineSnapshot(`
      {
        "workboard.annotation_changed": [
          "kind",
          "action",
          "anchor_kind",
          "visibility",
          "length_band",
          "is_reply",
        ],
        "workboard.card_menu_opened": [
          "node_kind",
          "ownership",
        ],
        "workboard.change_saved": [
          "entity",
          "action",
        ],
        "workboard.conflict_resolved": [
          "entity",
          "choice",
        ],
        "workboard.context_changed": [
          "action",
        ],
        "workboard.drop_prompt_answered": [
          "answer",
        ],
        "workboard.element_resized": [
          "element_kind",
          "method",
          "axis",
        ],
        "workboard.node_created": [
          "kind",
          "judgment_type",
        ],
        "workboard.node_deleted": [
          "kind",
        ],
        "workboard.node_edited": [
          "kind",
        ],
        "workboard.opened": [
          "via",
        ],
        "workboard.rail_toggled": [
          "state",
        ],
        "workboard.record_visibility_changed": [
          "action",
          "record_kind",
        ],
        "workboard.relationship_changed": [
          "action",
        ],
        "workboard.review_opened": [
          "format",
        ],
        "workboard.save_error_resolved": [
          "entity",
          "choice",
        ],
        "workboard.save_failed": [
          "entity",
          "reason",
        ],
        "workboard.structure_toggled": [
          "state",
        ],
        "workboard.trail_item_selected": [
          "group",
          "focus",
        ],
        "workboard.undo_used": [
          "action",
          "direction",
        ],
      }
    `);
  });

  it("knows which names it covers", () => {
    expect(isWorkboardEvent("workboard.rail_toggled")).toBe(true);
    expect(isWorkboardEvent("workitem.captured")).toBe(false);
  });

  it("drops a name it does not know", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(guardWorkboardEvent("workboard.made_up", { state: "collapsed" })).toEqual({
      keep: false,
    });
    expect(warn).toHaveBeenCalledWith("[telemetry] dropped unknown workboard event");
    warn.mockRestore();
  });

  it("strips free text, unknown keys and a payload", () => {
    const result = guardWorkboardEvent("workboard.node_created", {
      kind: "Cure First pricing memo",
      judgment_type: "corrected_ai",
      title: "Cure First pricing memo",
      payload: "anything",
    } as never);
    expect(result).toEqual({ keep: true, dims: { judgment_type: "corrected_ai" } });
  });

  it("keeps a boolean and a finite number, and removes anything else", () => {
    expect(
      guardWorkboardEvent("workboard.change_saved", {
        entity: true,
        action: Number.NaN,
      } as never),
    ).toEqual({ keep: true, dims: { entity: true } });
  });

  it("passes every current helper's output through unchanged", () => {
    const calls: Array<() => void> = [
      () => helpers.noteWorkboardOpened("o", "header"),
      () => helpers.noteWorkboardRail("o", "collapsed"),
      () => helpers.noteWorkboardNodeCreated("o", "source", "corrected_ai"),
      () => helpers.noteWorkboardNodeCreated("o", "source"),
      () => helpers.noteWorkboardNodeDeleted("o", "decision"),
      () => helpers.noteWorkboardNodeEdited("o", "deliverable"),
      () => helpers.noteWorkboardRecordVisibility("o", "hidden", "work"),
      () => helpers.noteWorkboardRelationship("o", "created"),
      () => helpers.noteWorkboardReviewOpened("o", "thread"),
      () => helpers.noteWorkboardTrailSelected("o", "ai_work", "exact"),
      () => helpers.noteWorkboardCardMenuOpened("o", "frame", "shared"),
      () => helpers.noteWorkboardChangeSaved("o", "node", "create"),
      () => helpers.noteWorkboardSaveFailed("o", "node", "network"),
      () => helpers.noteWorkboardConflictResolved("o", "node", "latest"),
      () => helpers.noteWorkboardElementResized("o", "card", "pointer", "both"),
      () => helpers.noteWorkboardDropPromptAnswered("o", "yes"),
      () => helpers.noteWorkboardStructureToggled("o", "structured"),
      () => helpers.noteWorkboardSaveErrorResolved("o", "board", "retry"),
      () => helpers.noteWorkboardContextChanged("o", "cleared"),
      () => helpers.noteWorkboardUndoUsed("o", "move", "undo"),
      () => helpers.noteHighlightChanged("o", "created", 120),
      () => helpers.noteHighlightChanged("o", "archived", 4),
      () =>
        helpers.noteAnnotationChanged("o", {
          kind: "comment",
          action: "created",
          anchorKind: "item",
          visibility: "engagement",
          length: 900,
          isReply: true,
        }),
    ];
    const mocked = vi.mocked(logEvent);
    for (const call of calls) {
      mocked.mockClear();
      call();
      const [name, , dims] = mocked.mock.calls[0] as [string, string, Record<string, unknown>];
      expect(guardWorkboardEvent(name, dims as never)).toEqual({ keep: true, dims });
    }
    expect(Object.keys(WORKBOARD_EVENT_DIMS)).toHaveLength(20);
  });
});
