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

## Unit P2: Workboard document and deck previews
- [x] Load first-page or first-slide previews only for visible cards in Preview mode
- [x] Keep silent excerpt fallback and show document-version counts
- [x] Preserve mapped teammate reader access and add `via: open`
- [x] Add focused tests and confirm a clean preview build

## F2 Preview, Sticky, and card floor
- [x] Separate the document-first Preview drawing from the paper Sticky drawing
- [x] Add page navigation and larger-open controls where content supports them
- [x] Raise the card resize floor and share it with persisted geometry validation
- [x] Preserve Preview defaults, fallback behavior, actions, states, and existing events
- [x] Run focused tests and confirm a clean preview build

## F4 context area removal and fit consistency
- [x] Pin lazy recreation, removal labels, and fit width before implementation
- [x] Archive and restore the context area without changing its cards
- [x] Record removal through the archived board frame
- [x] Make Fit content share the card resize floor
- [x] Run focused and board checks and confirm a clean preview build

## F5 card geometry compatibility
- [x] Reproduce seeded blank-board cards being refused by save geometry validation
- [x] Restore the record floor while preserving the readable resize floor
- [x] Seed new cards at or above the readable floor
- [x] Pin the seeded, interaction, and record floor relationship
- [x] Run focused checks, type check, and confirm a clean preview build

## F6 structured-board row spacing
- [x] Reproduce overlapping seeded rows on a structured board
- [x] Derive the vertical row step from card height and retained clear space
- [x] Confirm horizontal spacing, Fit behavior, and standard-frame fallback geometry
- [x] Run focused checks and type check

## F7 Fit content width preservation
- [x] Reproduce a widened card resetting to the default width
- [x] Preserve current width within the interaction and record limits
- [x] Verify focused checks, types, and preview build

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

## Canvas Interaction Polish (approved 2026-09-18)
- [x] Separate paper selection, four corner resize handles, and four edge connection anchors
- [x] Add durable card and frame resize with pointer, keyboard, cancellation, and Fit content
- [x] Add local Structured / Freeform mode and explicit Structured-only workstream reassignment
- [x] Add consent-stamped resize and structure events; retain existing save/conflict behavior
- [x] Complete focused tests, typecheck, and token/language guards
- [x] Confirm the automatic preview build
- [x] Polish 2c-ii follow-up: reliable judgment focus, collision-free creation, paperclip clearance, and consistent Add hit areas
- [ ] Complete Liam visual verification
- [ ] Phase 3 Slice 2 remains blocked on explicit consent and retention approval for durable comments, highlights, and locators

## Workboard frame actions (approved 2026-09-19)
- [x] Add one workstream menu without removing frame select, Fit, resize, count, or local status
- [x] Rename custom workstreams locally and through versioned durable frame updates
- [x] Soft-remove empty custom workstreams with client and server guards
- [x] Add the approved additive frame and shared menu dimensions
- [ ] Verify right-click, keyboard menu opening, rename, and removal as Liam in the authenticated preview

## Workboard frames part two (approved 2026-09-19)
- [x] Restore frame pointer access while preserving broad relationship hit targets
- [x] Hide empty frame menus for coaches
- [x] Make virtual seed frames contain all seeded cards
- [x] Add Structured-only card drop confirmation
- [x] Add role-appropriate empty-frame guidance
- [x] Share workstream creation between drawer and inline controls
- [x] Complete focused tests, typecheck, token/language checks, and preview build

## Workboard click, selection, and handles (approved 2026-09-19)
- [x] Separate focused-card handles from in-context presentation
- [x] Correct card semantics and context announcements
- [x] Keep Workboard handles, anchors, outlines, and frame menu legible at every zoom
- [x] Ignore sub-four-pixel pointer jitter at drag end
- [x] Complete focused tests, typecheck, token/language checks, and preview build

## Workboard human judgment (approved 2026-09-19)
- [x] Replace the Human judgment details control with a pointer-safe controlled chooser
- [x] Close the chooser on choice, Escape, and outside pointerdown
- [x] Reveal and focus a newly created judgment without changing zoom
- [x] Show durable judgment authorship accurately without changing edit permissions
- [x] Keep the context paperclip clear of card titles at every zoom

## Workboard links (approved 2026-09-19)
- [x] Add directed arrowheads and hover emphasis at every zoom
- [x] Add an editable-only relationship remove control using the existing removal path
- [x] Reject duplicate directed pairs regardless of anchor choice
- [x] Show short-lived visible rejection notes
- [x] Clear selected relationships on board, card, frame, and Escape paths
- [x] Distinguish durable and local relationship removal announcements
- [ ] Verify link geometry and removal as Liam at 45% zoom

## Workboard persistence feedback (approved 2026-09-19)
- [x] Carry the failed change in the save error state and offer Retry and Discard
- [x] Report an unreachable record as a network failure, not a validation failure
- [x] Float both banners over the board so the canvas never shifts
- [x] Claim nothing in "What fed this" until the record has been read
- [x] Clear all context in one move when two or more cards are selected
- [ ] Portal catalog: add workboard.save_error_resolved and workboard.context_changed (architect)

## Workboard polish 2c-v (undo)
- [x] Bounded undo and redo stack for arranging actions, with coalesced keyboard nudges
- [x] Undo toast after Remove from canvas and after removing your own note
- [x] Bring the pressed or focused card to the front locally
- [x] Delete hint on real records instead of silence
- [x] Counter-scale the judgment chooser and focus the inline workstream name
- [x] Say deliverable for a deliverable work card, and carry the original action through a retry
- [ ] Portal catalog: add workboard.undo_used (architect)

## Workboard entry point
- [x] Add always-visible desktop and narrow-screen entry links beside engagement tabs
- [x] Replace the stale Canvas intro while preserving the existing canvas
- [x] Add consent-stamped workboard.opened entry-source coverage and URL cleanup
- [x] Update focused entry and allowlist tests
- [ ] Portal catalog: add workboard.opened with via (architect)

## Workboard polish 2c-v follow-up
- [x] Match the toast step by stable undo id so its Undo control reaches the existing path
- [x] Give the toast Undo control a 44 by 24 pixel minimum hit area

## Workboard polish 2d (paper)
- [x] Use one tier-aware paper treatment for every Workboard card kind
- [x] Keep existing card controls, states, and events unchanged
- [x] Show only record-backed labels and details
- [x] Keep non-item reasoning visible and own judgment editors contained at compact size
- [x] Show a document glyph when a work source has no vendor mark

## Workboard polish 2d follow-up 2
- [x] Keep the paper header and handwritten title from shrinking so compact judgment editors cannot cover the title
- [x] Truncate the header source label with an ellipsis and drop the header date at compact

## Landing unit L1
- [x] Rebuild `/landing-next` as the approved B2B page.
- [x] Add opt-in held clip playback without changing `/` defaults.
- [x] Add anonymous pilot CTA event and focused tests.
- [x] Run landing tests, language scan, typecheck, and inspect build status.

## Landing L1 recheck
- [x] Restore the exact engagement label.
- [x] Keep held clips paused through observer arbitration.
- [x] Re-run landing tests.

## Landing unit L2
- [x] Validate and save pilot requests through a public server function.
- [x] Send the internal pilot email and safely skip Inkbox without its key.
- [x] Wire pending, success, and network-error form states plus success telemetry.
- [x] Add focused schema and landing tests; verify build.

## Project monitoring fixes (2026-09-20)
- [x] Coach note circle: opening a note also refreshes the full notes list (CoachNoteModal)
- [x] Quick-folder Share tab: send path restored via shared ShipBlock (SharedWithSection)
- [x] Connect-to-work sheet: closes itself, settings opens on MCP (ConnectToWorkSheet)
- [ ] engagements insert refused by its access rules (high) - database policy work, left with the architect per rule 2

## Landing sources video pair (2026-09-20)
- [x] Prepare the supplied connector clip and its final-frame poster
- [x] Create the staged Claude-to-Lasso phone clip and its final-frame poster
- [x] Place both clips in the source-finding panel without changing its approved copy or actions
- [x] Verify focused landing tests, typecheck, media metadata, and preview build
