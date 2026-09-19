# Workboard links polish 2c-iii

Built the approved frontend-only Workboard link pass.

- Added directed arrowheads, hover emphasis, and an editable-only midpoint remove control.
- Kept line weight, arrowheads, hit strokes, and the remove target readable at every zoom.
- Routed midpoint removal through the existing durable archive and `workboard.relationship_changed { action: "removed" }` path.
- Rejected duplicate directed pairs regardless of anchors while allowing reverse links.
- Added short-lived visible rejection notes and preserved the existing polite announcement.
- Cleared selected relationships when the board, a card, or a frame takes focus, and on Escape.
- Corrected durable versus unsaved relationship removal copy.
- No database, consent, schema, portal, production canvas, landing page, or AskDock changes.

## Exact inventory

Before controls: relationship stroke selection, header Remove relationship, Delete/Backspace removal, four card anchors by pointer or keyboard.

After controls: the same controls plus an editor-only hover/selected × that invokes the same removal path. No creation flow or relation choice was added.

Before states: idle, connecting, preview, rejected announcement, cancelled, created, selected.

After states: the same states plus local hover emphasis, directed arrowheads, and a short-lived visible rejection note. Empty, card, frame, and Escape interactions now clear relationship selection.

Before and after events: `workboard.relationship_changed` with existing `started`, `created`, `removed`, `cancelled`, and `rejected` actions. The × emits `removed` exactly once through the shared path. No event or event field was added.