# Roadmap

- [ ] MOT-3 A: blocked because pending includes session setup before the read; no beads applied.
- [x] MOT-3 B: discussed-work tick draw verified at 1280/390, reduced motion visible, tsgo clean; one suite had no outside-baseline failures.

- [ ] MOT-2: acceptance blocked by outside-baseline be6 full-suite failure and unavailable signed-in verification; implementation remains preview-only.

- [x] WI-1e: owner-only All work reader rename and full work-menu source audit; focused menu tests passed.
- [ ] WI-1e: signed-in owner/non-owner menu and real-save board verification; blocked by external unmanaged authentication. Preview showed a loading shell at 1280 and Sign in at 390.

- [x] DC-3: merged Your data by product type and role, preserved consent contracts, aliased old section, moved workspace controls from People; 38 targeted tests passed, full-suite results reported in chat; no database work or manual build.
- [ ] DC-3: authenticated Settings visual and real-save verification at 1280 and 390; blocked by external unmanaged authentication. Both preview visits reached Sign in; role and save behavior are mock-tested only.

- [x] DC-2: truthful Trust copy and signup/setup notice; pinned hash and render tests; public signup/sign-in and Trust visually checked at 1280 and 390. Setup is render-tested only because hosted authentication is external unmanaged. Full-suite results reported in chat; preview only, no database work or manual build.

- [x] FS-1: restore normal Home scrolling without changing welcome, feedback, or cards; hide partner-only coaching group and run regression checks.
- [ ] FS-1: inspect real signed-in Home preview states; blocked by external unmanaged authentication. Illustrative fixture scrolling and populated previews verified at 1440x710, 1280, and 390.

- [x] MAP-UX: default board placement, optional workstreams, unified labels, and behavioral regression tests.
- [ ] MAP-UX: signed-in visual verification at 1280 and 390; blocked by external unmanaged authentication, both preview captures were blank.

- [x] MOB-1b: phone-only bottom clearance, explicit subtitle spacing, and shell scroll boundary.
- [ ] MOB-1b: confirm signed-in Show more clearance and desktop comparison; blocked by external unmanaged authentication.

- [x] MOB-1: phone-only work list, header controls, card reuse, and regression checks.
- [ ] MOB-1: signed-in visual comparison at 390 and 1280; blocked by external unmanaged authentication.

- [x] Build the local-only five-act first-run tour, including the final copy, chat-link example, and anchored answer connectors.
- [x] Fill the tour with a second AI workstream, linked artifact, final image cards, and an Act 1 drag hint.
- [x] PF1: inherit one existing conversation placement for destination-free attachments without moving the conversation.
- [x] Add per-attachment placement receipts and explicit inbox notes.
- [x] Add handler-driven regression tests for all requested placement cases.
- [x] Run the full Vitest suite and bun run build after the final edit.
- [x] Put placement on the existing per-attachment receipts as a separate `placement` field; no second array.
- [x] Unit 11: clarify Act 2 targets and one-click grouping, then restyle Act 3 grouping and verify both widths.
- [x] Unit 12: replace five changing tour scenes with one fixed-layout board and verify invariant geometry across every act and register.
- [x] Unit 14: enlarge the Act 5 finished deck and connect it to its source work and Claude chat.
- [x] Fix expired invite wording and Ask Lasso Enter behavior without changing existing actions or event payloads.
- [x] SB-C1a: add sidebar container colour, reversible archive actions, and the grouped create tile.
- [x] TVd: add shared active-target glow, sequential target handoffs, and teaching callout bubbles without copy or geometry changes.
- [x] Verify TVd targets and callouts at 1280px and 390px; run the full suite once and build once.
- [x] Report real Ask Lasso scopes, controls, and any board presentation renderer from source evidence.
- [x] TVe: run two Act 1 conversations concurrently, gate Next on both pushes, and move Act 2 progression to its local sidebar workboard row.
- [x] Verify TVe at 1280px and 390px, then run the full suite once after the final edit and build once.
- [x] TVf: replace the Act 3 deck and screenshot previews, remove three crowded cards, and preserve remaining geometry.
- [x] TVg: teach the three real Ask scopes in Acts 4 to 6 and derive the Act 3 piece count.
- [x] TVh: isolate Act 8 to its three sources, kept answer, sourced slide, and connectors without moving board items.
- [x] TVi: replace all eight acts' instructional copy and keep every exact-string guard current.

- [x] UNI-1: merge individual sharing pages while preserving business pages, shared actions, and disclosure recording; regression tests pass.
- [ ] UNI-1: visually verify signed-in pages at 1280 and 390; blocked by external unmanaged authentication, both pages reach Sign in.

- [x] PERF-2a: the signed-in gate reads identity and profiles from cache
