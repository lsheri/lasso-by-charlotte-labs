# P2: Inbox columns on the board shell

## Data impact
- Presentation-only change: the four existing work-type columns become board lanes.
- No consent surfaces or consent stamping change.
- No event names, payloads, or dimensions change. The existing `work.filter_changed` path remains intact.
- No SQL, table, column, policy, or stored data change.

## Build
- Keep every page section outside the current four-column area exactly where it is.
- Render the existing Preview/Sticky control, placement and engagement chips, and existing count line in `BoardShell`’s toolbar slot.
- Represent the four existing work buckets as fixed `lane:` frames with visible labels and counts.
- Represent each current page entry as lane content in the existing sort order. Positions remain computed by lane index and are never persisted.
- Keep five-item replacement paging within each lane.
- Keep `DimmedDisabled` around individual cards with the current `aria-disabled` and `inert` behavior. Never dim a lane.
- Put `Nothing here yet.` in an empty lane. Put the existing Unmapped teaching sentence in the Unmapped lane only under its current zero-match condition.
- Keep lanes non-draggable, non-resizable, non-nameable, and non-claiming by relying on the existing furniture-only lane behavior.

## Preserved controls, states, and events
- Controls: all bring-work, suggestion, private-work, flagged removal, bulk selection, card actions, paging, Preview/Sticky, and filter controls remain reachable with identical labels and handlers.
- States: loading, full-page empty, errors, empty lane, zero-match Unmapped teaching, zero-match Claimed, dimmed/inert matches, suggestion, selection, and paging states remain.
- Telemetry: `work.filter_changed` keeps its existing exact dimensions and call path. No other telemetry call changes.

## Guard and verification
- Edit only `cg1-inbox-congruency.test.tsx` where old list/column selectors must target board lanes instead.
- Preserve every existing congruency assertion, including full visibility, per-card dimming, `aria-disabled`, `inert`, teaching-line conditions, no green/lime matching, fixed cards, event payload closure, four areas, and five-item replacement.
- Mutation-check each congruency behavior by making one temporary page mutation, proving its focused test fails, restoring exactly, and proving it passes.
- Run the full test suite and confirm the preview build is healthy.
- Confirm `CanvasLabPage.tsx`, `BoardShell.tsx`, and `board-lane.ts` remain byte-for-byte untouched.
