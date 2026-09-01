# Landing story framing — problem vs. solution distinction

The first two story sections on the logged-out landing page currently read as peers:
1. "Where the work now happens" (the scattered, real-life state)
2. "How the work was made" (the Lasso record state)

The founder wants visitors to immediately feel that section 1 is the unsolved problem and section 2 is the Lasso solution, with better marketing language and possibly a marker/label to make the scroll story clear.

## Approach chosen

I created three parallel drafts of the home page so the founder can compare the options live:

1. **Draft: before/after labels** (var_01m1fc44tafj1b0etjpb87m239)
   - Section 1: micro-label "WITHOUT A RECORD", headline "The work is scattered, and the reasoning disappears."
   - Section 2: micro-label "WITH LASSO", headline "The same work, kept as it was made."
   - Minimal change; relies on the labels to carry the before/after signal.

2. **Draft: rewritten headlines** (var_01m1fc45d0fj4tqhnk3ef9pq4d)
   - Keeps the existing micro-labels but rewrites both headlines and body copy into a direct problem/solution pair.
   - Section 1 headline: "Work happens in chat windows — then the tab closes and it's gone."
   - Section 2 headline: "Lasso keeps the record of how it was made."
   - No new UI elements; copy alone carries the turn.

3. **Draft: combined framing + transition** (var_01m1fc4g8pfky9t6a8wdpx68w3)
   - Section 1: micro-label "THE PROBLEM", headline "The work is scattered, and the reasoning disappears."
   - Adds a short centered transition sentence between the sections: "That is the gap Lasso closes."
   - Section 2: micro-label "THE SOLUTION", headline "The same work, kept as it was made."
   - Strongest before/after signal; uses labels, copy, and a connecting beat.

All three drafts leave the rest of the landing page untouched (CTAs, other story sections, footer, navigation, videos). Each draft updates the landing-page test file if the changed strings are asserted, and runs the suite.

## Next step

Review the three drafts and pick the one that feels right. I will then accept the chosen draft into main, ensure the landing-page tests and full suite pass, and report the result. No other files change unless the selected draft requires it.

## Data platform gate

This is a landing-page copy and micro-label change only. No new user actions, surfaces, or flows are added; no telemetry events or consent surfaces are touched; no schema changes are made. The existing `landing.viewed` event is unaffected.
