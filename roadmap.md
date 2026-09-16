## F9 Find it storyboard canvas
- [x] Preserve controls, states, events, and persistence
- [x] Match the reading scatter with animated tracing lines
- [x] Match the settled source arc with inline expansion
- [x] Keep the compact mobile list and detail sheet
- [x] Update and run focused Find it tests
- [ ] Capture populated desktop reading and settled screenshots
  - Blocked: the available signed-in account has no eligible Find it target.

## F9c fixed-stage canvas geometry
- [x] Scale one 1166 by 836 stage from its container width
- [x] Keep reading and settled positions in stage pixels
- [x] Add lane geometry, cross-column collision handling, and exact arrow endpoints
- [x] Stagger captions and render them above cards
- [x] Verify collision-free placement at 10 and 16 candidates
- [x] Run focused tests and confirm a clean preview build

## V1 evidence circle
- [x] Add optional turn and sentence focus to conversation viewers
- [x] Scroll to available evidence and draw the persistent green circle
- [x] Wire Find it search and settled results
- [x] Wire Decisions, Waiting on you, lineage prompts, Journey, and Work Artifact references
- [x] Preserve top-open behavior where no turn is available
- [x] Add focused conversation viewer tests
- [ ] Coach notes and engagement bench turn focus
  - Blocked: these records carry task or work-item scope, not conversation turn data.

## D4 Your calls storyboard
- [x] Re-layout the existing decision review flow as a dated notebook timeline
- [x] Preserve source focus, manual logging, reasoning, discard, loading, empty, and error states
- [x] Add truthful confirmed, reasoning, and awaiting counts
- [x] Add focused grouping, state, count, and filter tests

## Pass S1 — record search speed and forgiveness
- [x] Trigram index on turns.content (additive migration)
- [x] Number canonicalization with per-hit confirmation
- [x] Thread search tiers: exact, all words, similar, under "closest matches"
- [x] S2: conversations found from their summaries, under "matched from the summary"
