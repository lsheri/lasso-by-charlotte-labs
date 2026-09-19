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