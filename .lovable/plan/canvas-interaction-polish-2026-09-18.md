# Canvas Interaction Polish

## Scope and data impact

This pass changes only the hidden authenticated `/engagements/$id/canvas-lab` Workboard. It improves selection geometry, adds durable card and frame resizing, and adds a browser-local Structured / Freeform view choice. It does not add general whiteboard tools.

- **Shared data changed:** card `x/y/w/h`, frame `x/y/w/h`, and an explicitly chosen card-to-workstream assignment. Existing row versions, revision records, permissions, and conflict handling remain authoritative.
- **Local-only data:** Structured / Freeform mode, active element, in-progress resize, connector preview, viewport, zoom, rail, selection, menus, and unsent context.
- **New actions and event coverage:** resize completion uses `workboard.element_resized`; display-mode changes use `workboard.structure_toggled`; successful durable writes continue to emit `workboard.change_saved`.
- **Consent impact:** none. No consent state, text, ledger, stamping, or egress behavior changes. Both new events use the existing `logEvent` to consent-stamped `recordEvent` path.
- **Event schema impact:** additive. The portal event catalog must add both names and their closed dimensions before interpreting them.
- **Database impact:** none. Applied migration `0001` and generated types confirm `workboard_nodes` and `workboard_frames` already have numeric `w` and `h`; `frame_update` already accepts `w/h`. Card dimensions require only client-safe DTO/input and server mapping additions. No SQL, migration, policy, grant, trigger, or generated-type edit is planned.
- **Excluded:** production `EngagementCanvasView`, production provenance, AskDock, `/`, routes, auth, consent surfaces, deployment, and publishing.

## Before inventory

### Controls

1. Shell: open/close navigation menu, role-appropriate navigation, back to engagement, and Add workstream.
2. View: Fit board, zoom out, zoom in, modifier-wheel zoom, background pan, narrow-screen Board / Working from switch, and work-rail collapse/reopen.
3. Cards: pointer drag, arrow-key move, Enter/Space context selection, editable own judgment text, four edge connection anchors, pointer connector drag, click/keyboard two-step connection, touch/narrow ellipsis, right-click, Shift+F10, and Context Menu key.
4. Card menu: Use as context / Remove context, Preview, conditional Branch, Remove from canvas, Delete local node, or the disabled author-only removal explanation.
5. Relationships: select by pointer or keyboard, remove selected relationship, and Escape to cancel an armed connection.
6. Reasoning work: five scaffold add actions, six judgment choices, Foundation guide, restore hidden records, six prompt starters, local instructions, and Add draft thread.
7. Reading: focused reader close, summarize, branch, passage selection, local note entry/submission, deliverable reasoning review, trail selection, and review close.
8. Conflict: Load latest and Retry my change.

### Render and interaction states

- Opening and reduced-motion opening answer.
- Engagement loading, error, empty, and populated board.
- Durable board loading; not saved, saving, saved, read-only, save failure, and conflict.
- Navigation menu open/closed; rail open/collapsed; narrow board/rail view.
- Pan and zoom; card dragging; keyboard-focused card; selected context; hidden/restored record.
- Connector idle, armed source, live preview, rejected, cancelled, created, and selected relationship.
- Card menu open/closed with ownership-specific actions.
- Local judgment editing; local draft thread; local comments and instructions.
- Focus reader and deliverable review loading, error, empty, item, and exact-focus states.

### Existing Workboard events

`workboard.rail_toggled`, `node_created`, `node_deleted`, `node_edited`, `record_visibility_changed`, `relationship_changed`, `review_opened`, `trail_item_selected`, `card_menu_opened`, `change_saved`, `save_failed`, and `conflict_resolved`. Their current closed payloads remain unchanged. The existing `canvas.opened` call also remains unchanged.

## After inventory

Every control and state above remains. The following are additive or visually corrected:

1. **Card selection geometry:** the 2px green outline follows only the rendered paper. The in-context line remains inside that paper. Four 8px rounded-square corner handles sit centered on the outline. Four 8px circular connection anchors sit at edge midpoints, 11px outside the paper. Resize handles and anchors use distinct shape, position, cursor, label, and focus treatment. Only an armed connection anchor fills green.
2. **Card resize:** four pointer-operable and keyboard-focusable corner handles. Pointer Shift preserves the starting aspect ratio. Arrow keys resize from the focused corner; Shift uses the larger keyboard increment. Escape restores the starting rectangle without saving. Double-clicking a corner and a menu action both invoke Fit content.
3. **Frame resize:** selectable frame boundary with four accessible corner handles and a compact frame menu containing Fit contents. Resizing changes only the boundary. Member cards are never scaled or clipped, and shrinking is constrained so visible members remain inside the frame with header/paper clearance.
4. **Display mode:** a compact Structured / Freeform segmented control in the Workboard header. Structured renders frames and exposes explicit Move to workstream choices in the existing card menu. Freeform hides frame boundaries while preserving membership, positions, and links; card hover/focus may reveal its workstream label. Dragging never changes membership in either mode.
5. **Explicit reassignment:** in Structured mode, eligible editors can choose a target workstream from the card menu. The change uses the existing versioned node update and `workboard.change_saved`; it is not inferred from overlap or proximity.
6. **New states:** selected frame, card-resizing, frame-resizing, fit-content measurement, Structured, Freeform, and resize cancellation. Existing save/error/forbidden/conflict states handle resize and reassignment writes without a parallel status system.

No formatting toolbar, shape palette, freehand tool, generic object type, or frame-with-children move control is added.

## Interaction and geometry design

### Pure geometry

Add model constants and pure helpers for:

- Card default width near 232px and minimum 180x112px, plus conservative maximum bounds.
- Frame minimum dimensions and content-aware shrink limits.
- Four resize corners: northwest, northeast, southeast, southwest.
- Zoom-correct pointer deltas, corner-origin x/y adjustments, clamping, Shift aspect preservation, keyboard increments, and cancellation snapshots.
- Dynamic connector points using each card's actual width and height rather than the current fixed `CARD_WIDTH` assumption.
- Compact, standard, and expanded presentation tiers derived only from current card dimensions.
- Frame Fit contents as the union of visible member-card rectangles plus frame header and padding. Empty frames announce that there is nothing to fit and do not write.

Content reflows inside fixed card dimensions. Lab-scoped CSS removes the shared paper aspect-ratio constraint for these cards and changes line/detail visibility by size tier. It never scales text or card contents. Connector geometry continues to use the measured paper boundary.

### Pointer and keyboard state machine

```text
idle
  -> card move
  -> card resize(corner, starting rectangle, pointer/method)
  -> frame resize(corner, starting rectangle, pointer/method)
  -> connector drag

resize + pointer move -> preview local geometry only
resize + pointer up   -> one versioned durable update, then resize event
resize + Escape       -> restore starting geometry, no write, no resize event
resize + conflict     -> existing Load latest / Retry my change choices
fit content           -> compute rectangle, preview, one versioned update, resize event
```

A resize handle stops card dragging and connector activation. A connection anchor never starts resizing. Menus retain outside-click/Escape close and safe focus return. Geometry transitions are disabled under reduced motion; the final state remains equally clear.

### Persistence and permissions

- Extend node DTO/input/update patches with `w/h`; include them in server reads/inserts and durable merge. Existing rows with `w=0` or `h=0` fall back to the current default/measured size until first resize.
- Persist card resize once on pointer release, completed keyboard resize, or Fit content. Top/left corners write `x/y/w/h`; bottom/right corners write only changed values.
- Persist frame resize/Fit contents through the existing `frame_update` expected-version path, once per completed action.
- Only `canEditStructure` viewers see frame resize/reassignment controls. Canonical reference cards may be resized by editors. An authored judgment may be resized only by its verified author, matching current server and RLS rules. Browser-supplied authority remains irrelevant.
- `Load latest` continues to reconcile all frame/node/link geometry; `Retry my change` reuses the latest version without merging.
- Fit contents moves/resizes only the frame boundary, never its cards.

### Explicit frame-move decision

Do **not** add frame movement with contained cards in this pass. Card coordinates are absolute, and current commands update one row at a time. Moving one frame plus N cards would allow partial success or mixed conflicts without a transaction. Making it safe requires an architect-approved atomic server/database operation, which this no-database pass forbids. Frame resizing and Fit contents are safe single-frame writes and proceed.

## Events

Add exactly:

| Event | Closed dimensions | When emitted |
| --- | --- | --- |
| `workboard.element_resized` | `element_kind`: `card` or `frame`; `method`: `pointer`, `keyboard`, or `fit_content`; `axis`: `horizontal`, `vertical`, or `both` | Once after a completed resize that changed geometry. Never on move, preview, cancellation, or failed no-op. |
| `workboard.structure_toggled` | `state`: `structured` or `freeform` | Once when the local display mode actually changes. |

No raw dimensions, coordinates, IDs, titles, content, workstream names, or counts are sent. `axis` describes which dimensions changed, not direction or magnitude. Durable success/failure also continues through `workboard.change_saved` / `workboard.save_failed`. Current consent stamping and tier behavior are unchanged. The existing portal follow-up remains outstanding for prior Workboard events and must now include these two events and enums.

## File-by-file implementation

1. **`src/components/canvas-lab/canvas-lab-model.ts`**: add node width/height, resize corner and display-mode types, size constants, tier/resize/fit helpers, dynamic anchor geometry, and durable merge fallbacks.
2. **`src/components/canvas-lab/LabCard.tsx`**: bind real dimensions to the paper, expose four separate resize handles, preserve four connection anchors and the controlled menu, add fit/reassign callbacks, and keep measured paper bounds.
3. **`src/components/canvas-lab/LabCardMenu.tsx`**: retain all ownership-aware actions; add Fit content and Structured-only Move to workstream choices where permitted.
4. **New `src/components/canvas-lab/LabFrame.tsx`**: isolate frame selection, four corner handles, accessible labels, and Fit contents menu without turning the page into a generic tool surface.
5. **`src/pages/CanvasLabPage.tsx`**: own local mode and resize sessions; coordinate pointer/keyboard/Escape behavior; persist one completed resize; perform explicit frame reassignment; gate controls by permissions/authorship; preserve move/connect/menu/review behavior.
6. **`src/lib/canvas-lab-shared.ts`**: add node `w/h` to DTO/input and allowed node-update geometry fields. No new command type.
7. **`src/lib/canvas-lab.server.ts`**: read/write/validate finite bounded node dimensions and continue existing expected-version, actor, and permission checks. Reuse frame update unchanged apart from shared validation helpers if needed.
8. **`src/components/canvas-lab/canvas-lab-telemetry.ts`** and **`src/lib/telemetry-shared.ts`**: register typed wrappers for only the two approved additive events.
9. **`src/styles.css`**: Canvas-Lab-scoped outline, 8px square handles, 8px circular anchors at 11px offset, cursors, size-tier reflow, frame selection, Freeform label, mode control, focus-visible, touch, and reduced-motion rules using existing tokens only.
10. **Tests**: extend model, card-interaction, Phase 2/3, and hardening suites; add a focused resize/mode test file only if behavior-level coverage is clearer there.
11. **`docs/build-notes/2026-09-17-chatgpt-sol-canvas-lab.md`**: append a UTC-stamped record with exact before/after controls and states, persistence decisions, events/payloads/consent tier, portal dependency, tests, limits, and unpublished status.
12. **`roadmap.md`**: add and complete the bounded polish checkpoint, then leave Phase 3 Slice 2 as the next open phase.

Files explicitly untouched: both applied migrations, generated backend types, production canvas/provenance files, AskDock, landing files, consent files, routes, auth, and deployment configuration.

## Verification

- Pure geometry tests for every corner, min/max clamp, aspect preservation, keyboard increments, cancellation snapshots, size tiers, Fit content, empty-frame no-op, and dynamic anchor points.
- Component interaction tests for eight visually distinct handles, no content overlap, pointer resize, keyboard resize, Escape cancellation, double-click Fit content, focus return, touch menu, and preserved right-click/Shift+F10/Context Menu behavior.
- Persistence tests for node/frame `w/h` round-trip, refresh/reload restoration, one write per completion, no write during preview/cancel, explicit reassignment only, existing-row zero-size fallback, and version increments.
- Conflict tests for card and frame resize using current Load latest / Retry behavior, including full geometry reconciliation and no prose merge.
- Permission tests proving coaches get no resize/reassign affordance and cannot save, editors can resize canonical structure, and only an author can resize their judgment.
- Mode tests proving Freeform hides boundaries without changing membership, coordinates, links, or durable state; moving never reassigns; Structured-only explicit reassignment persists once.
- Event tests asserting exact names and closed payloads, no raw geometry/content, one event per completed action, and no event for cancel/no-op.
- Accessibility tests for labels, focus-visible state, corner semantics, menu access, live announcements, and keyboard-only completion.
- Reduced-motion test ensuring no resize animation while preserving state feedback.
- Run all Canvas Lab and route regressions, relevant server-contract/security tests, TypeScript no-emit, token and prohibited-language guards, and the platform production preview build. Verify desktop and narrow layouts with Playwright only as Liam; if that identity is unavailable, report the visual check as blocked rather than substitute another account.

## Risks and mitigations

- **Handle ambiguity:** square corners and circular edge-midpoint anchors have separate labels, cursors, hit zones, and active states; interaction tests pin all eight.
- **Shared `WorkNote` sizing:** use Lab-scoped wrappers/CSS or additive props only, so other screens do not change.
- **Legacy zero dimensions:** normalize to defaults on read and write only after a person resizes; no backfill.
- **Stale connector curves:** derive all endpoints from current card width/height and measured paper bounds after every resize.
- **Resize versus drag races:** mutually exclusive refs and propagation guards permit only one gesture.
- **Conflict after optimistic resize:** use the existing banner and whole-board reconciliation; never auto-merge geometry or prose.
- **Frame membership confusion:** no geometric inference. Only the explicit menu action changes membership.
- **Atomic frame movement:** explicitly deferred because current single-row commands cannot move a frame and all members safely.

## Return to Phase 3 Slice 2

After this polish passes, the roadmap resumes at **Phase 3 Slice 2: consent-approved comments and highlights with durable locators**. Slice 2 is not implemented here.

Its gate remains explicit: the architect and consent owner must approve what locator and selected-source text may be stored, whether excerpts are stored or resolved from canonical sources, who may read/edit/archive annotations, retention and deletion behavior, downstream AI/egress rules by consent tier, and how unavailable or changed sources resolve without exposing hidden content. Until that decision is recorded, comments, highlights, selected text, and source excerpts remain browser-local.
