# Pass F9c: fixed-stage Find it canvas

## Data impact
- Presentation geometry only. No user action, consent surface, stored data, search, lineage, telemetry event, payload, or dimension changes.
- No consent-related code is touched, so architect review is not required.

## Current and preserved controls
- Choose something else.
- Select a source card by click, Arrow Up/Down, or J/K.
- Keep as a source by button or Enter.
- Reject with Not this one, Backspace, or X.
- Open the referenced conversation when available.
- Keep all remaining sources, Done, Look for something else, Close, and Escape.
- Open and close the mobile source detail.

## Current and preserved render states
- Reading: seeded candidate grid, three or four renewing lines, reduced-motion static state, desktop canvas, mobile list.
- Settled: evidence-ordered arcs, one expanded source, reviewed states, weighted arrows, relation captions, footer actions, mobile detail.
- Kept: confirmed sources only, no expanded card, completion footer.
- Missing source item: unavailable-conversation label and no open action.
- Telemetry in the scoped files: none. Before and after event lists are identical.

## Implementation
- Put every desktop canvas element on one fixed 1166 by 836 pixel stage and scale that stage from a single ResizeObserver container measurement.
- Replace percentage node coordinates with stage pixels while preserving seeded reading placement and line renewal.
- Use the requested two-lane centers and widths, then resolve cross-lane rectangle collisions without moving the expanded card.
- End arrows four pixels before each card's actual left edge.
- Stagger captions along arrows, reject positions intersecting any card, and render accepted captions in a separate layer above cards.
- Update focused Find it tests to assert pixel positioning and collision-free layouts for 10 and 16 candidates with one expanded card.

## Verification
- Run only the focused Find it test file.
- Check the preview build signal and source formatting.
