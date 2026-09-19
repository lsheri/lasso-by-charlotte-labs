# Workboard polish 2c-v — undo, toast, bring to front (2026-09-19)

Frontend only. No SQL, no migrations, no consent changes. Base a45a532.

## Data impact
- One new event: `workboard.undo_used` { action, direction }, both closed unions, no ids or content. Routed through the existing consent-stamped `logEvent` path via `noteWorkboardUndoUsed`.
- Two value corrections, no new or repurposed field:
  - `workboard.card_menu_opened.node_kind` now says `deliverable` for a work card whose item is a deliverable (was `source`).
  - `workboard.change_saved.action` on a retried change carries the original action (create / archive / restore / update) instead of always `update`.
- Portal catalog entry owed for `workboard.undo_used` (architect, outside this chat).
- Undo's inverse writes log only `change_saved` / `save_failed` from the persist path. No inverse `node_created`, `node_deleted`, `record_visibility_changed` or `relationship_changed`.

## Controls, before
CanvasLabPage: Fit, zoom in, zoom out, zoom readout, Structured/Freeform, rail toggle, Load latest, Retry my change, Retry, Discard, drop prompt Yes / Keep, inline "+ workstream" (open, name input, save, cancel), board keyboard (Enter/Space context, arrows move, Delete, Escape). LabCard: card root keys, textarea, 4 anchors, 4 resize handles, menu. LabCardMenu: Add to context, Open, Branch, Remove from canvas, Delete, Fit contents, Move to workstream. LabFrame: select, 4 resize handles, menu trigger, rename input. LabFrameMenu: Fit contents, Rename, Remove. ReasoningTrailGuide: 5 Add triggers, 6 judgment choices. WorkRail: toggle, chip ×, Clear, ask textarea, 6 starters, Instructions toggle, instructions textarea, Add draft thread, restore rows, Show the board.

17 events: rail_toggled, node_created, node_deleted, node_edited, record_visibility_changed, relationship_changed, review_opened, trail_item_selected, card_menu_opened, change_saved, save_failed, conflict_resolved, element_resized, drop_prompt_answered, structure_toggled, save_error_resolved, context_changed.

## Controls, after
Everything above, unchanged, plus only:
- Undo toast (message + Undo button), bottom left of the board surface, 6 s, role="status", absolutely positioned so the canvas never moves.
- Delete hint beside a focused real record: "Real work is removed from the board, not deleted. Use Remove from canvas." No event.
- Keyboard undo / redo: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y. Ignored inside inputs, textareas and contenteditable, and while a menu, the reader or the review is open.
- 18th event: `workboard.undo_used`.
- Cards raise above their neighbours on press or focus with a local z-index counter. DOM order and tab order are untouched, frames stay below.
- Judgment chooser options counter-scale with the stage so each stays at least 24 px tall.
- The inline workstream name input takes the caret when it opens.

## Recorded actions
move (drag and coalesced keyboard nudges), resize (card and frame), hide, restore, remove_note, relationship_add, relationship_remove, workstream_move. Bounded at 20; a new action clears redo. Coaches get no stack. Stacks clear on Load latest, Discard and a fresh load. Inverses always read the entity's current durable version and surface conflicts through the existing banners.

## Files
canvas-lab-undo.ts (new), LabUndoToast.tsx (new), canvas-lab-model.ts, canvas-lab-telemetry.ts, telemetry-shared.ts, CanvasLabPage.tsx, LabCard.tsx, ReasoningTrailGuide.tsx, styles.css, canvas-lab-undo.test.ts (new), roadmap.md.
