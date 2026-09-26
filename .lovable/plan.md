# Unit L4.1 proof polish

## Data impact
- Presentation-only changes to the existing proof card, board framing, and public conversation reader.
- No user action, flow, event name, payload, or dimension changes. Existing `landing.proof_link_opened { step, target }` coverage remains unchanged.
- No consent or database work.

## Current controls and states
- Proof card controls: four collapsed turn rows, open turn 4, show slide 3.
- Reader control: Back to the story.
- Existing Ask replay states: typing, reading, streaming, done; loading and unavailable board states remain unchanged.
- Existing telemetry calls remain identical: `landing.viewed`, `landing.story_section_viewed`, `landing.section_jumped`, `landing.proof_link_opened`, `landing.pilot_cta_clicked`, `landing.pilot_requested`, and `landing.usecase_played` with their current payloads.

## Changes
- Recompose the proof card into a compact fixed-height presentation with a large `$1.4M`, concise source line, four expandable turn rows, proportional 2.1-total bar, corrected unconfirmed sentence, and unchanged actions.
- Keep the proof card top fixed beneath the Ask panel header after it appears, instead of scrolling the thread to its bottom.
- Reframe step 6 so the source card is fully visible and terminate the connector at its nearest edge. Restrict the question connector to step 5.
- Restyle deep-linked turns 2 through 6 with a soft green tint. Give turn 4 a 3px left bar, a start label, and a 96px scroll offset.
- Add focused tests for bar proportions, card viewport position, connector step isolation, and capitalization. Verify at 1372×732 and 1512×807.

## After-change control check
- Re-list the controls, render states, and telemetry calls to confirm no existing behavior was removed or renamed.
