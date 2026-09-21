# CG2: AI conversations filter congruency

## Scope and data impact
- Change only the AI conversations page and its existing congruency test file.
- The existing tool, engagement, and search filters will keep every loaded conversation rendered; non-matches will use the shared dimmed-and-disabled wrapper.
- No consent code, database work, event names, event dimensions, or event timing changes.
- `chatlib.filter_changed` remains the existing record for tool and engagement filter changes.

## Before-change inventory

### Interactive controls
- Page header: Ask Lasso button and Add a chat yourself dialog trigger.
- Source chooser: Captured, Asked Lasso, Everything.
- Asked-session rows and their existing open/delete actions.
- Ask Lasso slide-over close behavior and embedded Ask surface.
- Search input and Enter submission.
- Tool filter buttons.
- Preview/Sticky view buttons.
- Engagement filter buttons, including Everything and Unmapped.
- What recurs/Hide analysis toggle and existing analysis actions.
- Subjects and links/Hide subjects toggle and subject-panel actions.
- Every conversation card, its source link, and Analyse action.
- Existing page coverage controls, mobile peek controls, analysis panel controls, desktop reader close button, source link, and reader action bar.

### Render states
- Coach versus non-coach controls.
- Captured, Asked Lasso, and Everything source views.
- Asked-session list present or absent.
- Ask panel open or closed.
- Genuine zero-conversation state.
- Search/tool/engagement filters matching some, all, or zero conversations.
- Preview and Sticky card forms.
- Month groups and undated group.
- Recurring analysis closed, running, streamed, failed, or complete.
- Subjects panel closed or open.
- Mobile peek closed or open; desktop reader closed or open.
- Analysis panel closed or open.

### Existing event calls
- `chatlib.filter_changed`: `{ filter: "tool" | "engagement", selected: "all" | "one" }`, with `profile_id` used by the server call, after state changes.
- `chatlib.view_changed`: existing view/source value and `profile_id`.
- `chatlib.reader_closed`: existing view, close method, and `profile_id`.
- Existing search, card-open, analysis, Ask, paste, source-link, and child-component records remain untouched.

## Implementation
- Compute each conversation's match against search, tool, and engagement filters while preserving the complete thread list and month positions.
- Wrap each rendered conversation with `DimmedDisabled`, passing both `dimmed` and `disabled` from that match.
- Remove only the filtered-zero empty branch; preserve the genuine zero-conversation state exactly.
- Keep filter handlers and `chatlib.filter_changed` unchanged.
- Add real-page checks to the existing congruency test file for partial matches, zero matches, disabled wrappers, preserved rows, preserved genuine-empty behavior, and absence of green/lime filter-match styling.

## After-change contract
- Every control and render state above remains available.
- The only behavior change is that filtered non-matches remain in place, dimmed and non-interactive; filtered zero keeps the full list visible and dimmed.
- No new controls, copy, events, or dimensions.
