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

## Pass P1 (scale hygiene) - complete
- Your calls timeline paginates at 25 with a quiet "show earlier calls" control; counts and filters still read the full set.
- Shared-sentence lookup memoized in src/lib/shared-sentence-cache.ts (server memory only, max 200, TTL 10 min, clear() for tests). Nothing persisted.
- No database changes.

## Pass S1b (typo tier) - complete
- Closest matches now fetch candidates with widened 4-character probes from the start, middle and end of each long word, so a misspelling still retrieves rows; app-side scoring and the 0.3 floor stand.
- No database changes; pg_trgm index from S1 accelerates the probes.

## Landing-next Find it clip
- [x] Save uploaded clip and poster as public/videos/find-it.mp4 and find-it-poster.png
- [x] Wire the Find it ClipSlot to ClipPlayer (1440x900, 16/9) on /landing-next only

- Canvas Lab prototype: hidden route /engagements/$id/canvas-lab, additive files under src/components/canvas-lab plus src/pages/CanvasLabPage.tsx. Reads the engagement payload only; all layout, context, comments and chat cards are local and reset on refresh. No schema, no events, no publish.

## Canvas Lab second prototype pass
- [x] Add the single engagement Canvas entry without changing the production canvas
- [x] Reframe the full-screen board around real workstreams, decisions, and outputs
- [x] Keep board actions local while reusing the existing banded canvas opening event
- [x] Add contextual draft starters, instructions, focused reading, and local notes
- [ ] Verify the authenticated desktop and narrow-screen experience in the preview
  - Blocked: the required Liam preview identity needs approval, while the available requesting-user session has no engagement rows.

## Canvas Lab Phase 2
- [x] Move the composer into a collapsible, non-overlapping right work rail
- [x] Add the one-click Lab-only deliverable reasoning review
- [x] Add the five-step reasoning scaffold and six human-judgment node types
- [x] Add local hide, restore, delete, deterministic placement, and bounded Connect mode
- [x] Add Foundation's factual Start here guide and green Lab interaction language
- [x] Add consent-stamped Phase 2 event coverage and document portal follow-up
- [x] Run focused tests, token and motion guards, typecheck, and preview build
- [ ] Verify desktop and narrow-screen behavior as Liam in the authenticated preview
  - Blocked: minting the required Liam session needs approval unavailable in this build context. No other account was substituted.

## Canvas Lab card interaction correction
- [x] Replace the permanent card action tray and global Connect mode with card anchors and one contextual menu
- [x] Preserve existing card actions, local relationship removal, and ownership safeguards
- [x] Add the consent-stamped card-menu event and document the portal catalog follow-up
- [x] Run focused interaction/model/event tests, token guard, and typecheck
- [ ] Verify the authenticated desktop and narrow-screen experience in the preview
  - Blocked unless the required Liam preview session is available. No other account will be substituted.

## Canvas Lab Phase 3 Slice 1 (approved 2026-09-18)
- [x] Architect migration: workboards, workboard_frames, workboard_nodes, workboard_links, workboard_revisions (grants, RLS, constraints, indexes, atomic revision behavior)
- [x] Regenerate types
- [x] Typed contract + authenticated read/mutation server functions + query/mutation hook
- [x] Wire Canvas Lab to durable shared state with honest save/conflict/forbidden states
- [x] Save placement on drag end/keyboard move only
- [x] What-fed-this over explicit durable graph with permission filtering, cycle detection, bounded traversal
- [x] Add workboard.change_saved/save_failed/conflict_resolved events, catalog + tests, portal follow-up
- [x] Permission/concurrency/revision/contract/UI tests; typecheck; token guard; preview build
- [x] Append dated build record; report
- [ ] Liam authenticated visual verification (may be blocked as before)
