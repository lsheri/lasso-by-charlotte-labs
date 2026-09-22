# Unit R4 plan: paper previews and card expansion

## Data impact
- Changes only visual treatment, preview proportions, and how an existing card opens.
- No user action, route, copy, stored data, consent behavior, event name, payload, or dimension changes.
- No SQL, table, policy, function, trigger, or data edits.

## Current contract to preserve
### Controls
- Card face open, keyboard open, card menu, context selection, fit, branch, move, hide, delete, take-out-of-context, drag, resize, connect, comment-chip, and trail controls.
- Expanded view actions: Summarize, Branch, Back to the workboard, passage selection, Highlight, Comment, Reply, Edit, Remove, visibility choice, and comment navigation.
- Document preview actions: previous page, next page, and open larger.

### Render states
- Sticky and preview modes; mapped, unmapped, private, selected, focused, read-only, dimmed, failed-preview, and absent-preview states.
- Expanded thread, document, and local-note content; loading/error/empty thread content; comments absent/present/editing/replying; highlights mine/team/stale/cross-turn; writable and read-only review.

### Existing event calls
- `workboard.card_content_viewed` remains `{ kind, via }`; card-preview scrolling will no longer be a reachable `via: "scroll"` path, while document page changes and opening keep their current calls.
- `workboard.review_opened` remains `{ format }`.
- `workboard.card_menu_opened`, `workboard.node_created`, `workboard.annotation_changed`, and `workboard.highlight_changed` retain their current names and payloads.
- No new event is added.

## Build
1. Add R4 regression checks first for paper shadows without strokes/rings, restored clipping, no sticky height floor, unchanged flat-surface borders, still chat excerpts, portrait default previews, landscape deck previews, shared inset padding, and the enlarged paper treatment.
2. Introduce semantic paper-shadow and preview tokens. Paper uses a tight ink-tinted contact shadow plus a softer ink-tinted ambient shadow; flat surfaces retain the 2px graphite border.
3. Make `ChatPreviewWindow` explicitly support a clipped card excerpt and a scrolling expanded reader. Remove card scroll callbacks and wheel handling, retain the exact vendor-border wrapper, and add the bottom fade only to excerpts.
4. Put preview content behind one shared 3:4 default aspect rule and key the 16:9 exception from `WorkboardFilePreview.kind === "slide"` through a data attribute. Use one shared inset value for conversation and document preview bodies.
5. Restyle `FocusOverlay` as the enlarged paper object: same paper ground, layered shadow, folded corner, vendor/date/menu header order, vendor border, full-height scrolling conversation, and paper-language comments and annotations. Preserve every existing handler, branch, state, and event call.
6. Animate the enlarged paper from the originating board card bounds using a short scale-and-settle transform. Reduced motion renders the final state immediately.
7. Re-run focused R4 and adjacent card/workboard checks, type safety, and the preview build. Compare the controls, states, and event inventories above against the result before reporting.

## Expected files
- `src/styles.css`
- `src/components/work/ChatPreviewWindow.tsx`
- `src/components/work/WorkCardPreview.tsx`
- `src/components/canvas-lab/LabPaper.tsx`
- `src/components/canvas-lab/LabPreview.tsx`
- `src/components/canvas-lab/LabCard.tsx`
- `src/components/canvas-lab/FocusOverlay.tsx`
- `src/pages/CanvasLabPage.tsx`
- Focused R4 tests and directly affected R3 assertions
- `roadmap.md`

## Assumptions
- The enlarged same-object treatment applies to the workboard expansion defect described here; existing non-board viewers keep their functionality and treatment.
- The expanded header's menu is the existing action set represented in the same trailing position, not a new control or copied card menu.
- No copy changes means all current labels and status text remain byte-for-byte unchanged.
