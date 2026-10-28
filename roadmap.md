# Roadmap

- [x] WS-REMOVE: mode/control/helper/event removed; inert tour mirror removed with no scripted step change; 12 named files before 148/1, after 143/1, same TourActs count failure; preview build OK. Surface fixture viewed at 1280/390, all controls assigned and phone menu reachable.
- [ ] WS-REMOVE: signed-in populated-board verification blocked by external unmanaged authentication; real board redirects to /auth. Fixture verifies allocation/menu only, not real board behavior.

- [x] TOOLBAR-6: header children/save alerts preserved on canvas; one flat bar at 16px, opening inset 86px; seven files 33/33 before and after, preview build OK. Actual controls/mark/FaceToggle fixture inspected at 1280/390; phone menu opens and canvas press-through works.
- [ ] TOOLBAR-6: real signed-in populated-board verification blocked by external unmanaged authentication; real board redirects to /auth. Fixture only for visual checks.

- [x] TOOLBAR-5: independent floating/header plans, phone overflow, live Ask centring, pointer pass-through; eight matched files green before/after (38 then 39 tests), plus floating-menu guard passes (40 total). Actual surface/Button/mark fixtures viewed at 1280/390 with both menus opened. Preview compilation OK. Preview only; no database work or publish.
- [ ] TOOLBAR-5: real signed-in board and real panning/marquee verification blocked by external unmanaged authentication; correct board URL reaches /auth. Fixture hit tests reach canvas stage beside the pill and register two drag starts. Existing card-face overflow has no menu renderer, unchanged; phone header retains native horizontal scrolling for pinned controls.

- [x] TOOLBAR-4: phase/date wording and reset membership; all five required files pass; 12-file before/after both 154 passed / 16 identical baseline failures; actual Button/LabSection fixtures measured and viewed at 1280/390. Preview only, no database work.
- [ ] TOOLBAR-4: real signed-in board visual verification blocked by external unmanaged authentication; actual component/style fixture verified only. Example is currently outside the tool group, so its added selector membership has no current board effect.

- [x] TOOLBAR-1 / READER-MARK: revised ten retention integers, exact tooltips and vendor mark; 11 focused tests pass before/after; full after 38 files / 127 failed / 4,858 passed, no new failures against same-session before 39 / 128 / 4,857 (sh6c left); vendor fixtures inspected at 1280/390, build OK.
- [ ] TOOLBAR-1 / READER-MARK: real signed-in toolbar and reader verification blocked by external unmanaged authentication; fixture rendering and source comparison verified only.
- [ ] Card-face overflow fallback: separately queued by founder; no fallback today, leave unset in TOOLBAR-1.

- [x] SEC-FILL: explicit saved-section dashes, shared background picker, existing frame persistence, additive events and design row; after and recovered pre-change suites both 38 failing files / 127 failed / 4,858 passed with identical failing-file sets; section fixtures inspected at 1280/390.
- [ ] SEC-FILL: authenticated draw/save/reload verification blocked by external unmanaged authentication; explicit typecheck count unavailable because manual project typechecks are prohibited.

- [x] AI usage pilot: detached exact-cost event and privacy tests implemented; final background suite results reported separately against the latest 38-file baseline.
- [x] Pilot person analytics: browser properties and authenticated mirror join implemented; anonymous/canonical privacy preserved; final full-suite checks recorded separately.

- [x] SECD-3a: desktop section menu, send-time live membership, empty/deleted guards, and additive scope_kind; 14 new tests pass with no new prerequisite failures, tsgo exit 0.
- [ ] SECD-3a: real signed-in question and source-trail read-back blocked by external unmanaged authentication; public Sign in checked at 1280 and 390.

- [x] SEC-2: canvas sections and additive event definitions; 36 focused tests passed; fixture inspected at 1280 and 390. Public shared renderer deferred to SEC-3.
- [ ] SEC-2: real signed-in draw/save/read-back blocked by external unmanaged authentication; explicit TypeScript exit code unavailable because manual project typechecks are prohibited.

- [x] LINK-1: owner-only All work chat-link entry, project clarification, unchanged privacy pin; 24 focused tests passed, full suite once: 4332 passed / 125 failed in the same 38 reported files; preview build OK.
- [ ] LINK-1: explicit tsgo result unavailable because manual project typechecks are prohibited by this environment.
- [ ] LINK-1: authenticated real-save verification at 1280 and 390, blocked by external unmanaged authentication.

- [x] TOOLS-1: wrapper and scoped graphite treatment; control definitions identical; 1280/390 style fixtures inspected; final suite matches all 29 baseline files, 104 failed and 4012 passed. Preview only.
- [ ] TOOLS-1: real signed-in toolbar screenshots and interactions blocked by external unmanaged authentication; both widths redirect to /auth.

- [x] NAV-2a-fix: six isolated runs passed; nested glyph computed stroke rgb(107, 63, 140) in 1280/390 fixtures; mappings unchanged. Final suite compared to fresh baseline: new failing files be5-sticky-text-rich.test.tsx and sh3b-conversations-switch.test.tsx, reported without fixes; f2/pass93 passed.

- [x] BC-1a: pinned JSX restored, glyph wrapper deleted, CSS-only tint and 30-id reorder verified at 1280/390. pass93 12/12 passed before tint and passed in one full suite: 29 failing files, 104 failed, 4012 passed; no outside-baseline files, f2 green. Manual tsgo prohibited.

- [x] NAV-1: sidebar appearance and persistent active-row catch verified on isolated 1280/390 fixtures; controls/events unchanged, one full suite: no outside-baseline failures, f2 green, six watched failures identical.
- [ ] NAV-1: explicit tsgo result unavailable; manual project typechecks are disallowed in this environment.

- [x] MOT-3a: appearance-only beads verified at 1280/390 with moving offsets and visible static reduced motion; tsgo clean, one suite had no outside-baseline files and f2 passed.
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

- [x] IMPORT-1: file-screen error + reading state, import.failed event, dialog test passing.

- [x] SHARE-2: people-first Share dialog, Viewer/Collaborator mapping, full transcripts default, named access list with pending invites, link moved to bottom; invite form defaults to member. New tests 6/6.
- [x] SHARE-2: six older share tests updated (authorized).

- [x] SHARE-2 tests: six assertions updated to new dialog; full suite run once.
- [x] SECD-3b: Sections group in the Ask scope picker (all sections, marked or not), phone sheet wired explicitly, picker door shares the menu door's askSection state with a nonce; context_changed gained the additive "picker" action; 10 new tests pass, tsgo exit 0.
- [ ] SECD-3b: signed-in picker question and source-trail read-back still blocked by external unmanaged authentication.
