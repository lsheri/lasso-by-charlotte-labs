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

- [ ] R4.1: Keep the grouping naming popup at a constant readable screen-pixel size while its position follows pan and zoom.
