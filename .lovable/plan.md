# Unit L4 plan

## Scope and data impact
- Change `/landing-board` and the existing public demo conversations view only.
- Add `landing.proof_link_opened` with closed dimensions `step` and `target`; no existing event changes.
- Expose only demo-org turn excerpts already passed through the public-safe demo path; no database or consent changes.

## Build
- Add a compact provenance proof card to the saved Ask replay, sourced from the demo conversation turns and preset.
- Add board-to-source emphasis, honest scenario bars, deck-title trim, and corrected phone framing.
- Deep-link the existing demo conversation reader with `?item=<public work id>&turn=4&from=story`, highlight turns 2 through 6, and provide a return link to `/landing-board#lb-ask`.
- Extend event and payload allowlists without renaming or repurposing existing fields.

## Verify
- Add focused tests for source-derived figures, deep-link behavior, safe excerpts, wording, connector anchors, and phone fit.
- Check the proof scene and deep-linked reader on desktop and phone.
