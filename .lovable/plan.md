# Engagement screen port

## Data impact
- Presentation change only. It does not add, remove, or change a user action or flow.
- Suggestion chips only fill the existing Ask draft and introduce no new event or write path.
- No consent surface, consent stamping, event schema, query, route, or database change.

## Build
1. Add `EngagementStrip`, with its own single `expanded` boolean, expanded workstream/deliverable summary, and one-line collapsed state. It will keep its children mounted in both states so query-owning descendants never mount conditionally.
2. Add an inline Ask wrapper beside the untouched dock implementation. It will call the existing Ask hook with `open` always true, reuse `AskSurface`, retain all chat controls, keep oldest-to-newest ordering and a sticky composer, and offer draft-filling suggestions only while expanded with no messages.
3. Extend `AskSurface` only for presentation slots needed by the inline layout and change “Show my work” to “Show where this came from.” Existing dock and phone call sites keep their current behavior.
4. Recompose `EngagementPage` around the strip and inline Ask while preserving its hook order, owner/coach gates, canvas, brief/coaching/share controls, and all six root-level panels. Derive deliverables from the already-computed engagement items.
5. Record the task in the project roadmap, then verify source invariants, typecheck, the two named Ask suites, and all engagement-related tests. Do not deploy.

## Control inventory to preserve
- Page: Ask Lasso opener, capture coverage, brief disclosure/edit, coaching/share disclosure, invite, 1:1 preparation, sharing sections.
- Canvas: card open, pointer/keyboard movement, drag handle, overflow movement/removal/deletion, mobile move sheet, add workstream, pager dots, live announcements.
- Workstream header: status, task-line edit, reset order, rename, left/right movement, delete confirmation.
- Deliverables: What fed this, Work Artifact and its information control, ship action, connect-to-work sheet.
- Ask: Messages/History/Analyses, New chat/session, history selection/expansion, scope picker, work checklist, mentions and keyboard selection, Save for 1:1, analysis controls/results, composer, Send, Reflect link, and close.
- Root panels: Peek and its action bar, mapping, work date, analysis reader/launcher, 1:1 brief, and journey opening through the unchanged deliverable action.

## Guardrails
- No edits to `AskDock.tsx`, `use-ask-lasso.ts`, the engagement route, or data-layer files.
- `EngagementPage` hook sequence remains unchanged; query-owning children remain mounted independent of strip state.
- Preserve the five named performance/event calls exactly and retain all six overlays as page-root siblings.
- No raw color literals, dark-mode work, or bare tracking utility classes.
