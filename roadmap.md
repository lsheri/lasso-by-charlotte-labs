# Roadmap

- [x] R2: Move a dragged grouping with the cards whose centres were inside at drag start.
- [x] R2: Persist the grouping and each moved card through existing per-row save paths.
- [x] R2: Hide guidance for unnamed groupings while preserving named guidance and claim behavior.
- [x] R2: Report the 20-card persistence call count and whether batching already exists.

- [x] R3: Apply shared graphite card and sticky borders, judging 1.5px versus 2px in the rendered app.
- [x] R3: Raise the shared card minimum from 180px to 220px without clipping or changing widths and grids.
- [x] R3: Add one shared bounded chat preview with source-specific border treatments and unknown fallback.
- [x] R3: Add thin graphite borders to shared document preview bodies.
- [x] R3: Compare inbox cards above the fold before and after the 220px height change.

- [x] R4: Replace paper strokes and the sticky white ring with a two-layer ink-tinted shadow; restore paper clipping and compact stickies.
- [x] R4: Make card previews still, faded excerpts with shared inset spacing and 3:4 default / 16:9 slide proportions.
- [x] R4: Restyle the workboard expanded view as the originating paper card, with full-height reader scrolling and reduced-motion handling.
- [x] R4: Move `workboard.card_content_viewed` `{ via: "scroll" }` to expanded conversation scrolling without changing its schema.
- [x] R4: Verify controls, states, events, focused checks, type safety, preview build, and record remaining old-style expansion paths.

- [x] R4.1: Restore 112/180 card floors, preserve the 220 creation default, and rehydrate positive saved heights exactly.
- [x] R4.1: Portal the grouping naming popup to the canvas surface with viewport flip/clamping and no storage.
- [x] R4.1: Keep the grouping naming popup at a constant readable screen-pixel size while its position follows pan and zoom.
- [x] R5: Extend GraphiteIcon for every board-toolbar glyph, reusing existing Lasso gestures where suitable.
- [x] R5: Label Add work, Details, and See an example board while preserving every handler, name, tooltip, state, and event.
- [x] R5: Increase rendered and planned toolbar spacing together and verify narrow-width overflow with the wider pinned Add work control.
- [x] R5: Make Ask Lasso the sole lime, loop-derived, transform-only living toolbar icon with a static reduced-motion state.
- [x] R5.1: Restore the shared hand-drawn Ask Lasso curve and give Sticky cards its own folded-paper gesture.
- [x] R5.1: Restore a grouping's previous local name when workstream creation fails.
- [x] R6: Fit shared boards on open with the owner board calculation.
- [x] R6: Raise required share-dialog copy to readable existing text tokens.
- [x] R6: Let conversation previews grow from a 112px minimum and remove their fade.


## R7 Ask Lasso thinking marks
- [x] Add the four exact canvas marks with lifecycle and reduced-motion safeguards.
- [x] Replace toolbar drift with loop and pending dots with honest-count gather.
- [x] Remove only superseded Ask drift CSS and verify all affected checks.

## P2 Inbox board lanes
- [x] Render the four existing work-type columns as fixed lanes in BoardShell.
- [x] Move only the Preview/Sticky control, filter chips, and count line into the shell toolbar.
- [x] Preserve page-level teaching copy, card dimming/inert behavior, paging, and every surrounding section.
- [x] Replace only obsolete cg1 markup selectors and mutation-check every inbox congruency behavior.

## P3.2 Conversation board density
- [x] Render missing months as narrow timeline spines without card wells.
- [x] Derive month height from visible cards, gaps, padding, header, and overflow row.
- [x] Mutation-check density, fit, and preserved conversation filtering behavior.
