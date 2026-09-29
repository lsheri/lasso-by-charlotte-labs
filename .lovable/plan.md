# Unit 3c: make saved containers visible

## Data platform gate
- Coverage: sidebar display and existing create flow only. No user action is added or removed, so no new event is needed.
- Consent: no consent surface, consent state, ledger, or event stamping changes.
- Schema and portal: no event name, payload, or dimension changes. No database work.

## Before and after control rule
### Before
- Controls: destination links; client/folder links; workboard links; per-container New workboard; expand/collapse toggles; New workboard, New client/New term, and New folder; settings; disabled destinations with explanations; shared-work links.
- Render states: guest navigation; standard/partner/school/personal vocabularies; workboards grouped by joined container; top-level folder section; nested folders; quick-folder and clientless synthetic groups; no-workboards line; collapsed shelves; active workboard/task; shared work; empty/hidden role-gated groups.
- Event calls: `shared.board_opened` only in this sidebar. Existing create actions continue to emit their current events inside their own components.

### After
- The same controls, render states, and event calls remain reachable.
- Added normal render coverage for containers with zero workboards and a quiet empty line beneath each expanded empty container.
- Clientless workboards use a quiet non-container heading derived from workspace vocabulary.

## Implementation
1. Read all visible `clients` rows in the signed-in sidebar through `useClients`; keep guest navigation from requesting unrelated container rows.
2. Build the sidebar container tree from those rows plus workboards, rather than reconstructing containers only from workboard joins.
3. Render root clients and folders from that tree, preserving existing nesting and its three visible levels, links, create controls, collapse state, and workboard rows.
4. Label clientless workboards `Not in a client yet`, with `client` replaced by the workspace vocabulary, and style that row as a grouping rather than a created container.
5. Extend the sidebar regression test with `ClientRow[]` fixtures whose containers are absent from the engagement list, covering an empty client and two nested folders.
6. Run the focused sidebar tests, typecheck, full suite, copy/quick-folder greps, then inspect the signed-in preview at 1280px and 390px without creating or changing database rows.

## Assumptions
- “Three levels deep” means root at level 0 plus two nested folder levels, matching the existing sidebar depth cap.
- Existing quick-folder rows retain their current read behavior and remain separate from the clientless-workboard heading.
