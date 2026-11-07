# TOTAL-4

Compact the existing Ask dock and expose the read details already returned by the app. Preview only.

## Changes
- Bottom-right width follows 34% of available width, bounded at 320–400px. Default floating height is capped at 52%; manual sizing and explicit expansion preserve the larger behavior. Locked docks stay full-height.
- Show the scope's reading count above the composer throughout a pending answer, without changing the existing reading animation.
- Add the loaded scope's item and character counts beneath its label, hidden for an empty scope.
- Derive each saved assistant answer's coverage from its stored manifest, retaining the existing live streaming note.

## Data and controls
Existing controls, handlers, loading/error/empty states and event calls stay intact. No new user action, event, consent change, schema change, fetch, or model call. Existing Ask events cover the unchanged flow.

## Technical details
Use the current selected/pointed work-item objects and parseManifest; do not edit model-calling files. Keep scope calculations shared between the chip and reading line. Tests pin geometry, scope counts, streaming persistence and reopened coverage, including the supplied 20-item/642k example as explicitly illustrative test input.

## Verification
Baseline: all 10 requested test files pass, 98 tests. Run those same tests after changes and a negative control. Inspect at 1280 and 390. Real D8 verification requires an available signed-in session; report it as unverified if unavailable.