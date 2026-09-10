# Coach roster and packet presentation ports

## Data impact
- Presentation only. No user action, surface behavior, flow, query, route, or event schema changes.
- Existing clicks, form submissions, visibility rules, and event calls remain in place.
- No consent-related code or database work is touched.

## Coaching roster
- Keep the existing hand-built three-line heading, adding the italic treatment to “you coach.”
- Preserve `CoachLinkPeople`, the error toast effect, the empty-state invite, and the full subject-row button with profile switching, all three cache refreshes, and navigation.
- Restyle subject rows as a responsive table with PERSON, ENGAGEMENT, SHARED WITH YOU, and LAST NOTE columns.
- Keep both shared-work counts, the multi-workspace organization line, loading state, and the conditional “New since your last note” line.
- Add a 320px right rail with the two requested visibility cards and handwritten closing line.

## Coaching packet
- Keep the complete page hook sequence and all early-return behavior unchanged.
- Add the handwritten breadcrumb and retain the unsplit subject name as the page title.
- Preserve the exact section order, task grouping, empty state, shared briefs, engagement brief, newer-material indicator, decision source counts, and title-only honesty line.
- Restyle shared task groups as notebook cards and add 20px source marks to real shared work items without changing `TaskWorkflow` or its open action.
- Add the requested right rail explaining that the packet is built only from shared work.
- Keep `CoachOutcomeCard`, `FirmChecksCard`, `NoteComposer`, and `CoachChat` mounted in their current order with every existing control and access gate.
- Restyle only the NoteComposer container treatment; retain all three required fields, citation choices, validation, and Share note action.
- Do not add the withheld-item panel, suggested-question block, archived pills, unsupported metadata, or any withheld-work count or mention.

## Invariants and validation
- Preserve `canEdit={false}`, `role !== "coach"`, `canWrite`, and the access-denial branch.
- Preserve all six requested outcome test IDs and the four named event/performance calls verbatim.
- Keep `micro-label`, `micro-label-section`, and `micro-label-ai` on their existing semantic headings.
- Confirm no hooks were added, removed, reordered, or conditionally mounted.
- Check changed files for raw colors and forbidden bare letter-spacing utilities.
- Run TypeScript validation and every relevant coaching, packet, note, and access test found in the repository.
- Provide separate before/after control inventories for the roster and packet. Do not deploy or perform database work.
