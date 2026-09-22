# Unit R4.1 plan: stored card heights and grouping naming popup

## Data impact
- Restores how saved card geometry is read and repositions an existing naming surface.
- No database work, consent behavior, visibility behavior, event name, payload, dimension, or stored value changes.
- The existing `workboard.region_named` call remains fire-and-forget after the local naming change.

## Current contract to preserve
### Controls
- Grouping frame: select, drag, context menu, rename, fit, resize handles, remove, add documents where applicable, and inline workstream creation where applicable.
- Naming prompt: focused name field, Enter to name, Escape to dismiss, visible X dismissal, and click-away dismissal.

### Render states
- Named and unnamed grouping, prompt open and dismissed, rename error, ordinary rename, selected and unselected frame, empty guidance, add-workstream input/error, and save error/conflict banners.
- Dismissal leaves the grouping unnamed as paint and creates no workstream.

### Existing event call
- `workboard.region_named` remains unchanged with `{ state, claimed, fill_family, fill_strength }` and existing `named` / `cleared` values.

## Build
1. Add regression checks first for saved height 150, the unchanged 220px creation default, restored resize/validation floors, popup placement outside clipping ancestors, repeat appearance, dismissal paths, storage absence, and below-placement near the viewport top.
2. Restore `WORKBOARD_CARD_MIN_HEIGHT` to 112 and `CARD_MIN_HEIGHT` to 180. Keep `WORKBOARD_CARD_DEFAULT_SIZE.height` at 220.
3. Replace the three rehydrate clamps so a positive saved height is used exactly and only missing or zero height falls back to 220.
4. Extract the just-drawn naming prompt from `LabFrame` into one sibling overlay mounted directly under the canvas surface, outside the clipped and transformed stage.
5. Position the overlay from the grouping’s board coordinates plus current pan and zoom. Prefer above, flip below when needed, clamp horizontally and vertically within the canvas surface, and recompute as pan, zoom, frame geometry, or viewport size changes.
6. Keep the exact naming copy and focus behavior. X, Escape, and surface click-away clear only the pending prompt; Enter updates local naming first and records through the unchanged existing path afterward.
7. Run focused geometry, grouping, naming, and event checks, then type safety and preview build verification. Use browser screenshots at multiple zoom levels to confirm the overlay is outside the shape, unclipped, and on screen.

## Expected files
- `src/lib/canvas-lab-shared.ts`
- `src/components/canvas-lab/canvas-lab-model.ts`
- `src/components/canvas-lab/LabFrame.tsx`
- A focused presentational naming-popup component under `src/components/canvas-lab/`
- `src/pages/CanvasLabPage.tsx`
- `src/styles.css`
- Focused R4.1 tests and the two reverted R3 assertions
- `roadmap.md`

## Assumptions
- “Portal” means a React portal into the canvas surface element, making the popup a sibling of the transformed stage. This avoids frame/stage clipping while retaining canvas-relative placement.
- Existing menu-driven renaming remains inline in the frame; only the automatic just-drawn naming prompt moves to the popup.
