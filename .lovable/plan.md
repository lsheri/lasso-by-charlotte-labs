# Unit 3: Demo margin notes and guided path

## Assessment

This is a frontend-only addition to the public `/demo` experience. It does not need database work or consent changes. It adds two anonymous event names exactly as specified, so matching portal rows remain an architect task.

The guided path can use the existing real controls without changing product behavior. A small route-local tour state will persist the current step in `sessionStorage`, with every read and write protected so blocked storage simply restarts the notes.

## Before-change control and state inventory

- `/demo`: three demo engagement links and the header `Book a pilot` link; loading, unavailable, and populated states; existing `demo.opened` event.
- `/demo/$code`: back link, board cards, `Book a pilot`, preset chips, answer close button, response-input disclosure, exact-turn links, board pan/zoom, reader close; loading, unavailable, board, closed-answer, open-answer, and open-reader states; existing `demo.opened`, `demo.card_opened`, `demo.preset_opened`, and `demo.turn_opened` events.
- Read-only reader: transcript and `Back to the workboard`; focused-turn waiting and highlighted-turn states; no comments/highlights rail and no write controls.
- Signed-in surfaces remain unchanged.

## Build

1. Add a reusable handwritten `DemoTourNote` that finds a `data-testid` anchor, places itself above or below it, stays within a 390px viewport, and uses the existing paper, pencil, ink, Caveat, and motion tokens. Reduced-motion visitors see it immediately without draw-on motion.
2. Add a demo-tour state helper for steps 1 through 7, completion, skipping, guarded session storage, and same-tab updates.
3. Add stable test IDs to the YellowSigil card, preset chips, response-input disclosure, exact-turn link, highlighted reader turn, reader close, and demo `Book a pilot` link.
4. Wire progression only to the requested real actions: open YSM-01, open preset 1, expand its disclosure, open preset 2, open its exact turn, close the reader, then choose `Book a pilot`. Every note includes `Skip the tour`; skipping ends the session path.
5. If required saved content or its anchor is absent after the demo data/state has settled, advance past the unavailable dependent step instead of leaving the visitor stuck. Navigating elsewhere does not alter progress.
6. Add `demo.step_completed {step, engagement}` and `demo.tour_skipped {step}` through `recordAnonymousEventFn`, each with the existing 1.5 second duplicate guard. Register only those dimensions in the canonical event union and allowlist.
7. Add focused tests for real-action-only progression, skip, storage errors, reduced motion, non-demo absence, missing-anchor handling, and event dimensions. Run the targeted tests and TypeScript check, then inspect the preview at 390px and desktop without publishing.

## After-change control and state inventory

All controls and states above remain. The only additions are one contextual note at a time and its `Skip the tour` text link. The only removed state is an unavailable tour step after its required anchor is confirmed missing. Existing events and payloads remain unchanged; the two new additive events cover progression and skipping.

## Files expected to change

- New demo-tour state and note component files.
- `src/pages/DemoPages.tsx` for route-only rendering and real-action callbacks.
- `src/components/home/HomeEngagementGrid.tsx`, `src/components/reflect/ContextTrail.tsx`, `src/components/canvas-lab/SharedBoardView.tsx`, and `src/components/canvas-lab/FocusOverlay.tsx` only for optional callbacks or stable anchors.
- `src/lib/demo-telemetry.ts`, `src/lib/telemetry-shared.ts`, and `src/lib/event-dim-allowlist.ts` for the two additive events.
- `src/styles.css` for the note’s token-based visual treatment and reduced-motion rule.
- A focused Unit 3 test file.
