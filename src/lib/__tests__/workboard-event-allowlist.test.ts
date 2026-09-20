import { readFileSync } from "node:fs";

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
        "workboard.card_content_viewed": [
          "kind",
          "via",
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
        "workboard.display_mode_toggled": [
          "mode",
        ],
        "workboard.drop_prompt_answered": [
          "answer",
        ],
        "workboard.element_resized": [
          "element_kind",
          "method",
          "axis",
        ],
        "workboard.example_viewed": [
          "via",
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
          "relation",
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
        "workboard.work_added": [
          "source",
          "via",
          "count",
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
      () => helpers.noteWorkboardRelationship("o", "created", "context"),
      () => helpers.noteWorkboardRelationship("o", "relation_changed", "informed"),
      () => helpers.noteWorkboardReviewOpened("o", "thread"),
      () => helpers.noteWorkboardTrailSelected("o", "ai_work", "exact"),
      () => helpers.noteWorkboardCardMenuOpened("o", "frame", "shared"),
      () => helpers.noteWorkboardChangeSaved("o", "node", "create"),
      () => helpers.noteWorkboardSaveFailed("o", "node", "network"),
      () => helpers.noteWorkboardConflictResolved("o", "node", "latest"),
      () => helpers.noteWorkboardElementResized("o", "card", "pointer", "both"),
      () => helpers.noteWorkboardDropPromptAnswered("o", "yes"),
      () => helpers.noteWorkboardStructureToggled("o", "structured"),
      () => helpers.noteWorkboardDisplayModeToggled("o", "preview"),
      () => helpers.noteWorkboardCardContentViewed("o", "chat"),
      () => helpers.noteWorkboardCardContentViewed("o", "document", "open"),
      () => helpers.noteWorkboardSaveErrorResolved("o", "board", "retry"),
      () => helpers.noteWorkboardContextChanged("o", "cleared"),
      () => helpers.noteWorkboardUndoUsed("o", "move", "undo"),
      () => helpers.noteWorkboardWorkAdded("o", "inbox", "header", 3),
      () => helpers.noteWorkboardWorkAdded("o", "connector", "context_menu", 1),
      () => helpers.noteHighlightChanged("o", "created", "engagement", 120),
      () => helpers.noteHighlightChanged("o", "archived", "just_me", 4),
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
    expect(Object.keys(WORKBOARD_EVENT_DIMS)).toHaveLength(23);
  });

  it("keeps the additive open path for previewed document and deck cards", () => {
    const mocked = vi.mocked(logEvent);
    helpers.noteWorkboardCardContentViewed("o", "deck", "open");
    expect(mocked).toHaveBeenLastCalledWith("workboard.card_content_viewed", "o", {
      kind: "deck",
      via: "open",
    });
  });

  it("reports each highlight's actual visibility without changing the action schema", () => {
    const mocked = vi.mocked(logEvent);
    helpers.noteHighlightChanged("o", "created", "engagement", 120);
    expect(mocked).toHaveBeenLastCalledWith(
      "workboard.annotation_changed",
      "o",
      expect.objectContaining({ action: "created", visibility: "engagement" }),
    );

    helpers.noteHighlightChanged("o", "archived", "just_me", 4);
    expect(mocked).toHaveBeenLastCalledWith(
      "workboard.annotation_changed",
      "o",
      expect.objectContaining({ action: "archived", visibility: "just_me" }),
    );

    const source = readFileSync("src/components/canvas-lab/canvas-lab-telemetry.ts", "utf8");
    expect(source).not.toContain('action: "created" | "edited" | "archived" | "updated"');
  });
});
