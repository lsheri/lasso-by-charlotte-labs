# Workboard persistence feedback (polish 2c-iv)

Frontend only. No SQL, no migrations, no schema, no consent surfaces.

## Files changed
- `src/lib/telemetry-shared.ts` — two additive event names.
- `src/components/canvas-lab/canvas-lab-telemetry.ts` — `noteWorkboardSaveErrorResolved`, `noteWorkboardContextChanged` with the closed `WorkboardContextAction` union.
- `src/hooks/use-canvas-lab.ts` — `commandEntityKind`, `WorkboardClientResult`, error save state carries `retry` and `entityKind`, thrown calls become `network_error`.
- `src/pages/CanvasLabPage.tsx` — shared `reloadDurableBoard` used by Load latest and Discard, `resolveSaveError`, floating banners, new conflict copy, `onClearContext`, context announcement moved out of the state updater.
- `src/components/canvas-lab/CanvasLabReview.tsx` — groups render only after the record is read; empty human judgment line after load.
- `src/components/canvas-lab/ContextComposer.tsx`, `WorkRail.tsx` — Clear control and prop pass-through.
- `src/styles.css` — `.canvas-lab-banner` overlay.

## Controls after the change
Header status, 6 states (Opening, Saving, Newer version available, Read only, Could not save, Saved, Not saved). Conflict banner: Load latest, Retry my change. Error banner: Retry, Discard. Composer: one x per chip, Clear at two or more chips, ask textarea, 6 prompt starters, Instructions toggle, instructions textarea, Add draft thread. Review: Back to the workboard, trail rows, stitch rows, decision rows, loading line, error line, "No exact passage" line, focused source section.

## Events
Unchanged and still reachable: change_saved, save_failed (reason "network" now reachable), conflict_resolved, review_opened, trail_item_selected, node_created, node_edited, node_deleted, rail_toggled, record_visibility_changed, relationship_changed, card_menu_opened, element_resized, structure_toggled, drop_prompt_answered.
New: `workboard.save_error_resolved {entity, choice}`, `workboard.context_changed {action}`. Portal catalog entries owed for both.
