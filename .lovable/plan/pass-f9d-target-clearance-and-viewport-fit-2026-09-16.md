# Pass F9d: target clearance and viewport fit

## Data impact
- Presentation geometry only. No user action, consent surface, stored data, search, lineage, telemetry event, payload, or dimension changes.
- No consent-related code is touched.

## Preserved controls and states
- Controls: Choose something else; source selection by click, arrows, J/K; Keep as a source or Enter; Not this one, Backspace, or X; open conversation; Keep all; Done; Look for something else; close or Escape; mobile detail open and close.
- States: reading with seeded grid and renewing lines; reduced motion; settled with evidence ordering, weighted arrows, captions, review states and expansion; kept; missing source; desktop canvas; mobile list and detail.
- Telemetry in scoped files: none before and none after.

## Changes
- Restore conditional expanded-card positioning, shifting left only enough to remain within the stage.
- Treat the settled target card as a fixed 250 by 220 pixel obstacle centered at 455, 418; source cards move around it and the target never moves.
- Scale the fixed stage by the smaller width or available-height ratio, and center it horizontally when height limits scaling.
- Extend the 10 and 16 candidate rectangle tests to include target-card clearance.

## Verification
- Run only the focused Find it test file.
- Confirm the preview build is clean and report the resulting checkpoint.
