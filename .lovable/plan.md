# Unit 12: one persistent tour board

## Data and scope gate
- This changes only the existing five-step tour presentation and its current local interactions.
- Existing actions remain covered: file drag or tap, one-click or Space selection, marquee selection, grouping, Ask, Keep, Escape, and Backspace.
- No telemetry calls exist in the permitted tour files, so no event is added or changed.
- No consent surface, event stamping, schema, database, storage, upload, network request, or product behavior changes.

## Control and state contract
**Before:** Add work, file drag/tap/keyboard drop, Select, one-click/Space/marquee, Group/Enter/marquee, Ask, Keep/drag, toolbar controls, Back, Skip; idle, file picker, dragging, landed, selected, grouped, Ask closed/open/generating/settled, answer dragging/landed, hint, and reduced-motion settled states.

**After:** The same controls, signatures, test IDs, keyboard paths, completion guards, and render states. Only the board presentation becomes persistent and additive across acts.

## Build
- Export one typed layout constant from the tour content module. It will contain all five primary work cards, four loose chat work cards, artifact strip, whiteboard image, deck image, and reserved answer slot with fixed percentage position, width basis, rotation, and earliest visible act.
- Build one shared board component that renders every visible item from that constant and accepts only state flags for visibility, outlines, selection, grouping, glow, source highlights, connectors, answer visibility, and Ask visibility.
- Keep the first primary work-card slot empty in Act 1 until the existing file gesture completes. Keep the other board content visible from Act 1, show the deck only in Act 5, and reserve the answer slot from Act 1 without rendering its contents.
- Preserve one board box, canvas origin, zoom, chrome, rail, header, and toolbar across all five acts. The Ask panel will be an overlay so opening it cannot resize or reposition the board.
- Preserve the Act 2 lime outline exception and interactions. Draw the Act 3 purple region around the three unchanged source work cards; retain it through Acts 4 and 5.
- Highlight source work cards in place as Act 4 claims appear. In Act 5, land the answer in its reserved slot and measure three connectors to the unchanged source work cards.
- Remove the parallel Act 4 framed-source scene and Act 5 mini-source/image-strip scene after the shared board replaces them.

## Tests and verification
- Keep every existing test name and test file. Update selectors only where the shared board requires it.
- Add one invariant test covering all four registers and all five acts. For each shared visible layout item, compare rendered `left`, `top`, `width`, and `rotation` exactly across acts.
- Run focused tour tests and the full suite once; compare outside failures with the accepted 30 tests across 12 files.
- At 1280 and 390, capture all five acts, print every item rect for Acts 1–5 at 1280, and run pairwise overlap checks for every visible work card and artifact in every act.
- Do not publish.
