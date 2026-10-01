# GF1 revised plan

## Data impact
- **Coverage:** This retires four guide-panel Add controls and adds one toolbar control. The relocated Human judgment action continues to emit the existing `workboard.node_created` event with `kind: "human_judgment"` and the same optional `judgment_type` dimension. No new event is needed.
- **Consent:** No consent surface, consent stamping, or consent table is touched.
- **Schema and portal:** No event name, payload, or dimension changes. The retired values become quiet but remain in the event catalog and allowlist.
- **Database:** No SQL, migration, policy, function, trigger, seed, or data edit.

## Before controls and states
- Board shell: open menu, close/back, board menu, add-work flow, hidden-card restore, context-area creation, reasoning-trail creation, sharing, details, example board, Ask Lasso, fit, zoom out, zoom to 100%, zoom in, workstream visibility, relationship removal, and overflow menu.
- Add controls: Add work, Add text, Sticky, Add grouping, workstream creation controls, and the guide panel's Source / Context, AI work, Human judgment, Decision, and Deliverable Add controls. Human judgment opens its type choices.
- Board surface: empty-space selection/lasso, touch/middle/Space pan, wheel/zoom behavior, file and answer drops, drawing regions, region naming, cards/nodes, frame selection/move/resize/fit/rename/remove/menu/context actions, relationships, drop prompts, claim prompts, undo, focus/review overlays, and save/conflict/error actions.
- Node controls remain those already supplied by each card type: selection, drag, open, edit, resize, relationship anchors, menus, comments, hide/delete, move-to-workstream, bundle controls, and decoration edge handles.
- Render states: loading, unavailable/error, opening, saved/saving/conflict/read-only/error, empty/non-empty, no frames, one unnamed region, one named region, old `decisions` / `foundation` / `outputs` frames, structured/freeform, selected/focused/dragging/resizing/connecting/drawing, prompts/overlays, and shared read-only.

## Implementation
1. Add **Human judgment** to the existing board toolbar and overflow menu beside Add text, Sticky, and Add grouping, gated by the same `canAddWork` condition.
2. Reuse the current judgment creation and persistence sequence, but anchor the new card at the viewport centre using the same board-position rule as text and sticky. Preserve focus, keyboard selection, saved-node replacement, announcement, and `workboard.node_created` dimensions.
3. Remove both guide render sites, the dead placed-trail branch, and the board-menu action that creates a reasoning trail.
4. Remove guide-only imports, state, handlers, placement reservations, fixed guide rectangles, label lists, trail helpers, and retired local-node branches only after checking all remaining references.
5. Keep `boardHasSeededStructure` because it still controls seeded-board initialization and automatic context-region behavior. Keep trail identity support only where needed to interpret stale saved frame rows without rendering them as ordinary regions.
6. Delete `ReasoningTrailGuide.tsx` and `FoundationGuide.tsx`. Leave the existing-card fallback text `Human judgment` unchanged.
7. Update mixed-purpose tests and replace guide-only tests with GF1 regressions. Add a recursive `src/` scan proving neither retired panel title remains.

## After controls and states
- Every control and render state above remains, except the two retired panels, their five Add controls, their Human judgment type menu, their placed-trail Remove/drag behavior, and the board-menu “Add a reasoning trail” action are gone.
- One **Human judgment** control is added to the normal editable-board toolbar and overflow menu. It is absent on shared read-only boards, matching the other add controls.
- Named and unnamed regions, including stale old frames, continue to render through the ordinary frame component.

## Verification
- Focused tests will assert toolbar placement, existing persistence and telemetry path, shared-board gating, removal on named and old-frame boards, continued named-region rendering, and a real recursive source scan.
- Then run the complete Vitest suite and `bun run build` after the final edit.
- Inspect the authenticated preview at 1280 and 390 only if an authenticated session is available; otherwise report that visual verification is blocked rather than asserting it.
- Do not deploy.
