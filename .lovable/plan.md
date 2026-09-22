# R2 grouping movement and unnamed guidance

## Scope and data impact
- Change grouping dragging so the dragged grouping and cards whose centre starts inside it move by the same delta.
- Apply movement identically to named and unnamed groupings without changing claim membership.
- Hide the existing empty-frame guidance only for unnamed groupings.
- Preserve existing board save records and failure reporting. No new events, dimensions, consent work, SQL, tables, or schema changes.

## Before-change inventory

### Interactive controls
- Grouping: select, open options menu, fit to cards, rename, remove, four resize handles, naming input, dismiss naming, and optional add-workstream control.
- Board movement: card drag, grouping/frame drag path, card and frame resize, keyboard card movement, and board pan.

### Render states
- Grouping selected or unselected; named workstream or unnamed paint; naming bar open or closed; editable or read-only; empty or populated; local, saving, saved, failed, forbidden, or conflicted.
- Existing loading, unavailable, blank-board, guide-panel, structured/freeform, and save banners remain unchanged.

### Existing event calls in scope
- Frame options: `workboard.card_menu_opened` with `{ node_kind: "frame", ownership: "shared" }`.
- Frame resize: `workboard.element_resized` with existing kind, method, and axis dimensions.
- Naming: `workboard.region_named` with existing `state`, `claimed`, `fill_family`, and `fill_strength` dimensions.
- Persistence reports continue through existing `workboard.change_saved` and `workboard.save_failed` paths. Grouping dragging has no dedicated action event and gains none.

## Implementation
- Add a pure geometry helper that snapshots card IDs and offsets from the grouping at drag start using centre-point containment.
- Move only that snapshot with the dragged grouping. Overlap is resolved by the grouping whose drag started, so each card moves once.
- On release, persist the grouping first in the existing fire-and-forget path, then persist every moved card through the same node update/reporting path used by direct card movement.
- Keep resize paths frame-only and leave claim helpers untouched.
- Suppress guidance when `region` is true and `frame.name` is empty; preserve every existing named and non-grouping sentence exactly.
- Add focused checks first for inside/outside geometry, named/unnamed parity, overlap, resize separation, persistence wiring, guidance, and unchanged paint claim behavior.

## After-change contract
- Every listed control, state, and event remains reachable with unchanged names and payloads.
- Only grouping drag gains geometric child movement and unnamed paint loses contradictory guidance.
