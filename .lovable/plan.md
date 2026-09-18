# Canvas Lab card interaction correction

## Scope and data impact

This is a focused correction to the hidden authenticated Workboard at `/engagements/$id/canvas-lab`. It changes card actions and local relationship creation only. Production `EngagementCanvasView`, production provenance, routes, reads, persistence, consent, database/schema/RLS, server functions, AskDock, the frozen landing page, and deployment remain unchanged.

- Existing card actions keep their current Phase 2 events and local-only behavior.
- Add exactly one event: `workboard.card_menu_opened` with closed dimensions `{ node_kind, ownership }`.
- `node_kind` uses the existing coarse Workboard vocabulary: `source | ai_work | human_judgment | decision | deliverable | draft_thread`. `ownership` is `yours | teammate | draft`.
- The event goes through `logEvent` and the existing `recordEvent` path, retaining schema `v2`, session/sequence, event UUID, consent tier, and ledger stamp. At `t0` it remains workspace-only.
- This additive event requires a matching portal catalog update. No portal work is included here.

## A. Exact controls and states

### Before

**Workboard shell and board**
- Open/close the navigation drawer, role-aware navigation, Add workstream, and Back to engagement.
- Working-from rail collapse/reopen; narrow-screen Board/Working from switch; context-chip removal; six starters; instructions; Add draft thread; restore hidden records.
- Fit, zoom out/in, modifier-wheel zoom, zoom readout, board pan.
- Reasoning scaffold adds five node kinds and offers six Human judgment types.
- Loading, error, empty, populated, opening/reduced-motion opening, rail open/collapsed, narrow board/rail, pan, zoom, node drag, local edits, hidden records, focus reader, deliverable review, and selected relationship states.

**Each card**
- The entire card is focusable and draggable; arrow keys move it.
- Enter/Space toggles Use as context, except during global Connect mode when it chooses a source/target.
- A permanent tray shows Use/Remove context, Preview, conditional Branch, conditional Connect/Source chosen, and Remove from canvas or Delete local node.
- Local notes remain editable in place.
- Context selection, keyboard focus, and connect-source emphasis apply to the outer wrapper, so the green rectangle also encloses the tray and `in context` line.

**Relationships**
- A top-bar Connect button enters/exits global connect mode.
- Card-level Connect buttons choose source and target.
- Escape cancels connect mode.
- Local relationship paths can be selected by pointer or Enter/Space; Remove relationship and Delete/Backspace remove the selected link.
- Context-derived draft curves remain dashed graphite.

**Current Workboard telemetry**
- `canvas.opened`: existing banded mount event.
- `workboard.rail_toggled` `{ state }`.
- `workboard.node_created` `{ kind, judgment_type }`.
- `workboard.node_edited` `{ kind }`.
- `workboard.node_deleted` `{ kind }`.
- `workboard.record_visibility_changed` `{ action, record_kind }`.
- `workboard.relationship_changed` `{ action }` where action is `started | created | removed | cancelled | rejected`.
- `workboard.review_opened` `{ format }`.
- `workboard.trail_item_selected` `{ group, focus }`.

### After

Every unrelated control and render state above remains. Card movement, arrow-key movement, direct Preview, local editing, context state, relationship selection/removal, readers, rail, scaffold, and local-only reset-on-refresh behavior are preserved.

**Removed**
- Top-bar Connect button.
- Global connect-mode state and card-level Connect/Source chosen button.
- Permanent action tray under every card.

**Replaced with**
- A 2px-equivalent Lasso-green outline on the paper boundary only when the card is selected as context or keyboard-focused. The wrapper, anchors, and menu are outside that outline.
- Four small circular anchors centered on top/right/bottom/left. They appear on card hover, card keyboard focus, or while choosing a relationship target. Touch/narrow users retain the ellipsis path, not permanently visible anchors.
- Pointer-drag from an anchor with a live green preview curve; dropping on an anchor uses that side, while dropping on a card chooses its nearest side deterministically.
- Activating an anchor by keyboard/click starts the accessible two-step fallback; activating a target anchor completes it. Escape cancels.
- A compact card menu containing Use/Remove context, Preview, conditional Branch, and exactly one ownership-safe remove action: Remove from canvas for real records or Delete local node for local/chat records.
- Right-click, Shift+F10, ContextMenu/Menu key, and the visible ellipsis button open the same menu. Escape or outside click closes it, and focus returns to the invoking card or ellipsis.
- Existing `in context` status remains within the paper presentation so the outline still hugs only the card.

**Added states**
- Card menu closed/open with pointer, keyboard, or ellipsis origin.
- Anchor idle/hover/focus/armed.
- Connector pointer-preview and accessible source-armed states.
- Valid target, rejected target, cancelled drop, and completed local relationship states.

## B. Exact files to edit

### Application
- `src/pages/CanvasLabPage.tsx`
  - Remove the top-bar Connect control and old `connectMode`/`connectSourceId` flow.
  - Own the bounded anchor connector state, live preview point, measured card heights, target resolution, announcements, and existing relationship events.
  - Draw stored curves from their saved anchor sides and the temporary green preview curve.
  - Keep card drag, board pan, link selection/removal, readers, rail, and all existing data paths unchanged.
- `src/components/canvas-lab/LabCard.tsx`
  - Separate the positioned wrapper from the outlined paper boundary.
  - Remove the permanent tray; add four accessible anchor controls and the paper-corner ellipsis.
  - Preserve `WorkNote`, folded-paper rendering, local textarea, source logos, direct card Preview, context state, ownership rules, pointer drag, and arrow-key movement.
- `src/components/canvas-lab/LabCardMenu.tsx` (new, Lab-only)
  - Reuse the existing context-menu primitives and `Button` for one shared menu opened by right-click, keyboard, or ellipsis.
  - Centralize ownership-conditioned menu items, one-open event emission, close behavior, and safe focus return.
- `src/components/canvas-lab/canvas-lab-model.ts`
  - Add `LabAnchor = "top" | "right" | "bottom" | "left"`.
  - Extend local `LabLink` with `fromAnchor` and `toAnchor`; no migration because links are in-memory only.
  - Add pure anchor-point, nearest-side, curve-endpoint, and exact-duplicate validation helpers.
  - Preserve undirected connected-component review grouping and local delete cleanup.
- `src/components/canvas-lab/canvas-lab-telemetry.ts`
  - Add the typed `noteWorkboardCardMenuOpened` helper using `logEvent`.
- `src/lib/telemetry-shared.ts`
  - Add the canonical additive `workboard.card_menu_opened` event.
- `src/styles.css`
  - Add only Canvas-Lab-scoped paper-outline, anchor visibility/state, preview-curve, ellipsis, and menu treatment using existing paper, green, green-wash, rule, graphite, radius, and shadow tokens.

### Tests and notes
- `src/components/canvas-lab/__tests__/canvas-lab-model.test.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-phase2.test.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-second-pass.test.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-card-interactions.test.tsx` (new focused interaction suite)
- `docs/build-notes/2026-09-17-chatgpt-sol-canvas-lab.md` append-only correction note with event, dimensions, consent behavior, and portal follow-up.

The shared context-menu and Button primitives are reused but not modified. No roadmap change is needed for this single correction.

## C. Pointer and keyboard state machine

```text
IDLE
  anchor pointer-down -> POINTER_PREVIEW(source node, source side, pointer)
  anchor click/Enter/Space -> ARMED(source node, source side)
  menu invocation -> MENU_OPEN(node, origin)

POINTER_PREVIEW
  pointer-move -> update preview endpoint in stage coordinates
  pointer-up on target anchor -> validate exact anchored relationship
  pointer-up on target card -> choose nearest side, then validate
  pointer-up elsewhere / Escape -> CANCELLED -> IDLE
  self or exact duplicate -> REJECTED -> IDLE
  valid target -> CREATED -> IDLE

ARMED
  target anchor click/Enter/Space -> validate -> CREATED or REJECTED -> IDLE
  source anchor activated again / Escape / menu opens -> CANCELLED -> IDLE

MENU_OPEN
  menu item -> run existing action -> close -> return focus
  Escape / outside click -> close -> return focus
```

Technical safeguards:
- Anchor pointer-down stops propagation and is the only connector-drag entry. Card body pointer-down continues to move the card.
- Target detection uses the actual anchor when present; a card-body drop uses a pure nearest-side calculation from stage coordinates and the card's measured paper bounds. `ResizeObserver` supplies height without changing layout.
- Stored relationships save both endpoint sides. An exact duplicate means the same directed node IDs and the same two anchor sides; self-links remain invalid.
- Menu and connector states are mutually exclusive. Opening a menu cancels an armed/preview relationship through the existing `cancelled` event.
- While a menu is open, its arrow keys, Enter/Space, Escape, Delete, and Backspace are not intercepted by the board's global shortcuts.
- Existing relationship SVG paths remain focusable/selectable. Delete/Backspace still removes only a selected local link or a local node, never a real record.

## D. Event changes

Add only:

| Event | Trigger | Dimensions | Consent and portal |
| --- | --- | --- | --- |
| `workboard.card_menu_opened` | Once per closed-to-open transition, regardless of right-click, keyboard, or ellipsis | `node_kind`: existing coarse Workboard kind; `ownership`: `yours | teammate | draft` | Existing consent-stamped `recordEvent` path; `t0` workspace-only; add event and both vocabularies to the portal catalog |

All menu actions continue to call their existing helpers. Anchor connection attempts continue to use `workboard.relationship_changed`: `started` once when pointer preview or keyboard arming begins, then exactly one of `created`, `cancelled`, or `rejected`; removal remains `removed`. No IDs, titles, coordinates, content, free text, or prompt data are recorded.

## E. Focused tests and risks

### Pure model tests
- Four anchor sides map to deterministic card-edge points.
- Card-body drop chooses the nearest side consistently, including tie-breaking.
- `addLabLink` stores both anchor sides.
- Self-link and exact anchored duplicate are rejected; valid anchored relationships are created.
- Existing undirected review grouping still works with anchored links.
- Deleting a local node still removes its anchored links and context selection.

### Component and integration tests
- No permanent action tray and no top-bar Connect button remain.
- Selected/focused outline is applied to the paper only.
- Anchors appear for hover/focus/armed states and have accessible side-specific names.
- Pointer anchor drag shows a green preview; anchor and card-body drops resolve the expected target side.
- Keyboard two-step creation, Escape cancellation, rejected self/duplicate, and `aria-live` results work.
- Right-click, Shift+F10, Menu key, and ellipsis open the same ownership-correct menu; outside click/Escape close it; focus returns safely.
- Menu open records `workboard.card_menu_opened` once with only `{ node_kind, ownership }` for every opening path.
- Existing context, Preview, Branch, hide, delete, edit, card drag, arrow movement, relationship removal, and all existing Phase 2 event helpers remain reachable.
- Touch/narrow view keeps the ellipsis available and does not restore the tray.
- Context-derived draft curves stay graphite; stored/preview/selected connector emphasis uses existing green tokens.
- Route isolation, motion, provenance correction, token guard, and the existing Canvas Lab suites remain green.

### Verification
- Run the prior 48-test focused suite plus the new interaction/model/event cases and report the exact new total.
- Run `bunx tsgo --noEmit`, the token guard, and the preview build check.
- Verify desktop and narrow layouts with authenticated Playwright using only the required Liam identity. If unavailable, report that visual verification is blocked rather than substituting another account.
- Do not publish or deploy.

### Risks
- The card root currently owns both drag and keyboard shortcuts. Anchor/menu events must stop propagation so creating a relationship or choosing a menu item never moves the card or toggles context accidentally.
- Radix menu focus handling and the page-level window key listener can conflict. The board listener must yield while the card menu is open.
- WorkNote and folded notes have different heights. Endpoint geometry must use measured paper bounds, not the removed tray or a guessed fixed height.
- Browser context-menu and touch behavior vary. All four opening paths must share one controlled menu and one closed-to-open telemetry boundary.
- The additive event cannot be considered portal-complete until the matching portal catalog update is made outside this change.
