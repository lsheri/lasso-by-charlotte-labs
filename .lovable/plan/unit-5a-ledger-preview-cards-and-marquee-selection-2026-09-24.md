# Unit 5a: Ledger preview cards and marquee selection

## Data impact
- Remove the Inbox and All conversations Preview/Sticky controls and their preference reads/writes.
- Keep every existing event name and allowlist entry; stop only the removed controls' sticky-mode emissions.
- Add no user action, event, consent change, database change, or server behavior.
- The marquee change only prevents browser text selection during a box drag.

## Build
1. Finish the required before-inventory of every card renderer/style hook, mode read, pinned test, card control/state, summary source, and document preview path.
2. Make `WorkNote` the shared fixed-height Ledger preview card, with brand edge, one date, selectable title/summary, document thumbnail/detail, source link, engagement code, and non-selectable chrome.
3. Convert conversation, Inbox, board, and home card surfaces to the shared presentation while preserving every action in existing menus. Move conversation metadata and Analyse into the existing menu.
4. Remove Preview/Sticky controls, sticky branches, preference reads/writes, fold/tint/flip presentation, and obsolete keyframes. Preserve `nb-sticky-wave` because it is the conversation arrival wave.
5. Set Inbox and conversation card geometry to 118px and update exact lane arithmetic.
6. Prevent text selection for the full marquee lifecycle, clearing any existing selection at drag start and removing `select-none` on release or cancellation.

## Verification
- Update fold, tint, flip, toggle, turn-count, thumbnail, brand-edge, marquee-lifecycle, and lane-geometry tests.
- Run the requested focused suites, u11, u2, cg1, cg2, canvas-lab-marquee tests, and type safety.
- Run the unchanged Inbox and Conversations browser checks at all four sizes.
- Verify `/work` at 1440×900: no folds, border and brand edge colors, document thumbnail, no residual selected text after a board marquee, and capture the Inbox screenshot.
- Report before/after inventories, summary and thumbnail findings, exact test/live results, and any out-of-scope change.
