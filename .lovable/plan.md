# Coach notes and 1:1 presentation ports

## Scope
Update the two requested screens independently, using the existing notebook layout components and changing presentation only.

## Coach notes
- Keep `useProfile()` and `useAllNotesAboutMe(...)` in their current order before the coach branch.
- Give both branches the requested Notes heading and branch-specific subtitle.
- Place subject notes and their existing empty state in the main column.
- Keep the existing `CoachNoteList` call unchanged, including all five props and the existing context callback.
- Add the subject-only right rail with the visibility policy card, three requested counters, and handwritten closing line.
- Leave `CoachNoteList.tsx` and `PacketPage.tsx` untouched.

## 1:1 prep
- Update the page heading and add the requested two-column layout.
- Keep the existing conditional `SavedForOneOnOne` call verbatim in the main column, followed by the handwritten closing line.
- Add the two static right-rail policy cards, including the requested strike marks and no primary action.
- In `SavedForOneOnOne` only, replace the section label with `SectionHeader` and restyle each saved note as a hairline row.
- Preserve both queries, their order and dependency, `sessionIds`, `setDiscussed`, the Discussed checkbox, discussed opacity, and the null-on-empty guard.
- Leave `SaveForOneOnOneDialog` unchanged.

## Validation
- Compare controls before and after for each screen.
- Verify hook order, query guards, event ownership, imports, and exact component calls remain intact.
- Check for raw colors, forbidden letter-spacing classes, new events, and unintended file changes.
- Run TypeScript validation and all coach-note, packet, and 1:1 tests found in the project.
- Do not deploy or make database changes.
