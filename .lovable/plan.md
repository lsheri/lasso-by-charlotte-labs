# U2 + U3: chat bundles on the workboard (plan only)

Your approach holds, with three corrections: (1) dock **below** the chat, (2) apply the layout **after** positions are stored, at the `visibleNodes` memo, and (3) don't offer "move to workstream" on a piece.

**a. Positions.** Seed: `seedCanvas`/`seedBlankCanvas` (canvas-lab-model.ts:607, 693). Inside a frame, cards go into a grid of `CARD_WIDTH + 18` columns (model:371-376). Durable rows override them through `applyDurableBoard` (CanvasLabPage.tsx:387-400, model:977-1155). The frame's own slot uses the same grid (model:382-393). **Docking to the right overlaps the next card in the grid.** The smallest fix is to dock the pieces in a column **below** the chat card. The frame's slot finder then treats the bundle as one taller block. No seed change is needed.

**b. Fields.** Yes. use-work-items.ts:12 already selects `owner_id, type, orig_conversation_id, ungrouped_at, source_meta`. There is no read change. Also skip items with `ungrouped_at`, to match `groupByConversation` (work-types.ts:101).

**c. What reads positions.** `visibleNodes` (page:406) feeds rendering, marquee (1464, 1519), frame membership (2038), links (LabRelationships) and fit (1733, 1741). Put the `dockBundles` step there so all of these agree. These need changes:
- **Drag** (1441-1567): redirect to the chat, and move the pieces as a group.
- **Resize** (1585): turn it off on pieces.
- **Keyboard move** (1651, 1678): redirect to the chat.
- **Undo** (815, 834): record the chat only.
- **Placement and unhide** (557, 1218, 1238, 1274, 2051): leave as they are. Stored x/y are ignored while a piece is docked.

**d. Actions on a piece.** Its saved position stays as it is and is never written while docked. Hide and delete still work: they remove the piece from the bundle, and the count shrinks. "Move to workstream" (`moveToFrame`, 1958) is left off pieces. On the chat, it moves the chat, and the docked pieces follow on screen. Their stored `frameId` doesn't change.

**e. Two passes, each leaving the board working.**
- **Pass A, derive and dock.** New pure `chatBundles` + `dockBundles` in canvas-lab-model.ts (about 70 lines). Hook them into the `visibleNodes` memo, redirect drag and keyboard to the chat, hide resize and "Move to workstream" on pieces (about 60 lines in CanvasLabPage.tsx). Add a new `LabBundleLinks` SVG layer (about 50 lines) that you can't click or select. Add unit tests.
- **Pass B, minimize and "+N more".** Add a localStorage key next to `workboardStructureModeKey` (page:465, 603). Add the "3 pieces from this chat" control and the "+N more" tile on LabCard, and the event (about 50 lines in the page).

**Data impact.** There is one new user action, covered by `workboard.bundle_toggled {state, pieces}`. Dragging the chat reuses `change_saved`. The allowlist at workboard-event-allowlist.ts:12 gets an additive entry, and the union in telemetry-shared.ts and `d1-event-dim-allowlist` need matching entries. **Portal row owed.** The data platform gate adds one concern: `state` values must pass SAFE_VALUE, so `all_shown` is fine, and `pieces` must be a band such as "1", "2-4" or "5+". Consent is untouched. There is no SQL.

**f. Tripwires.** These are source-text tests on the page:
- b2-one-chat.test.ts:6: no `createChatNode(`
- canvas-lab-hardening
- canvas-lab-polish-2c*
- b3-marquee: the `cardsInMarquee` signature stays the same

Also the `workboard-event-allowlist` test and d1 "covers every name in the canonical union". For styling, only bracket-form `tracking-[...]` is allowed. Copy: "pieces from this chat" passes the language laws. "Lasso draws" is presentation only.

DECIDE: dock below (recommended), and split into Pass A and Pass B.
