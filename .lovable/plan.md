# All AI Conversations and Look back

## Data impact

- **Changed actions and surfaces:** remove the Subjects and links action, the Captured / Asked Lasso / Everything chooser, and the conversation board's fit and zoom controls. Move the existing Asked Lasso history entry into Look back. Keep Add a chat, Ask Lasso, search, filters, card opening, card menus, the reader, and analysis actions.
- **Event coverage:** keep every existing event name and closed value. Removed controls simply stop emitting `chatlib.panel_opened { panel: "subjects" }` and `chatlib.view_changed` for the removed source choices. Opening the relocated historical view uses the existing `chatlib.view_changed { view: "asked" }`. Search remains covered by `chatlib.search`; tool and engagement choices by `chatlib.filter_changed`; reader closure by `chatlib.reader_closed`; supporting panels by `chatlib.panel_opened`; original-chat links by `chatlib.source_opened`.
- **Consent:** no consent surface, consent state, consent stamping, or data-sharing behavior changes.
- **Event schema:** no event name, payload, or dimension changes. Existing vocabulary values remain additive-only.
- **Database:** no database or SQL work.

## Classification

This is a **redesign**, not a skin. The month hierarchy changes from side-by-side board lanes to vertically stacked sections, and historical Ask Lasso chats move from a page chooser into navigation.

## Current controls and states

**Controls before**
- Subjects and links
- Captured / Asked Lasso / Everything chooser
- Add a chat
- Ask Lasso
- Search your chats
- Tool choices
- Engagement choices and What recurs
- Conversation count and coverage disclosure
- Board fit and zoom controls
- Conversation card open and card menu actions
- Asked Lasso session open and delete
- Reader close by button, Escape, or reselect
- Existing analysis and source-link actions

**States before**
- Empty library
- No search matches
- Populated month lanes, including compact empty-month spines
- Cards dimmed and unavailable when they do not match a selected tool or engagement
- Coach-restricted Ask controls
- Reader open or closed
- Asked Lasso history empty or populated
- Analysis working, error, and results

## Planned result

### All AI Conversations
- Rename the page heading and primary navigation label to **All AI Conversations**. Update the route metadata to match.
- Keep **Add a chat** and **Ask Lasso** in the header.
- Remove **Subjects and links** and its panel from this page.
- Remove the Captured / Asked Lasso / Everything chooser. The default page shows the captured AI conversations.
- Keep search, tool choices, engagement choices, What recurs, and the count disclosure.
- Replace the pan-and-zoom month board with a normal vertically scrolling month stack:
  - newest month first;
  - month heading above its cards;
  - cards arranged left to right in a responsive grid;
  - additional conversations wrap onto another row within the same month;
  - existing 118px `WorkNote` cards and all card handlers remain intact;
  - intervening empty months remain represented as compact labeled rows, preserving the current chronological state;
  - no fit, zoom, lane paging, or horizontal board movement on this page.
- Preserve the empty library, no-match, dimmed choice, reader, coach, and analysis states.

### Look back
- Add **Past Ask Lasso chats** as the active historical destination, using the existing `/ai-record` page with an explicit validated history view in the URL.
- The history view shows the existing `AskedSessions` list and opens the same Ask Lasso reader. Session deletion remains available.
- Render **Find it** and **Decision log** as visibly muted, unavailable rows with `aria-disabled`, keyboard-safe behavior, and a **Coming soon** tooltip. They will not navigate.
- Apply the same labels in the phone navigation sheet so mobile and desktop do not disagree.

## Controls and states after

**Controls after**
- Add a chat
- Ask Lasso
- Search your chats
- Tool choices
- Engagement choices and What recurs
- Conversation count and coverage disclosure
- Conversation card open and every existing card menu action
- Reader close by button, Escape, or reselect
- Past Ask Lasso chat open and delete
- Existing analysis and source-link actions

**Removed or relocated**
- Subjects and links: removed
- Captured / Asked Lasso / Everything chooser: removed
- Board fit and zoom: removed with the board layout
- Asked Lasso history: relocated to Look back as Past Ask Lasso chats
- Find it and Decision log: shown but unavailable, with Coming soon guidance

**States after**
- All existing content, reader, coach, and analysis states remain.
- Month content gains responsive one-row or multi-row wrapping.
- Historical Ask Lasso remains empty or populated as it is today.
- Look back gains explicit unavailable states for Find it and Decision log.

## Files

- `src/pages/AiRecordPage.tsx`: remove the retired header actions and source chooser, read the validated history view, preserve current data and handlers, and compose the new month stack.
- `src/components/work/ConversationMonthStack.tsx` or an equivalent focused presentational component: render stacked month sections and wrapping `WorkNote` cards without duplicating card markup.
- `src/routes/_authenticated/ai-record.tsx`: validate the history view and update page metadata.
- `src/components/layout/nav-config.ts`: rename All AI Conversations, add Past Ask Lasso chats, and mark Find it and Decision log unavailable.
- `src/components/layout/SidebarNav.tsx`: render unavailable rows accessibly with the existing tooltip component and preserve normal navigation behavior elsewhere.
- `src/components/layout/MobileTabBar.tsx`: mirror the renamed destination, history entry, and unavailable items in the phone sheet.
- `src/styles.css`: add token-based layout and unavailable-row styling only where utilities are insufficient.
- Update the existing conversation geometry, navigation, naming, and page tests rather than weakening them.

## Verification

- Add or update tests proving months stack vertically, cards wrap horizontally, card height stays 118px, and empty months remain compact.
- Prove Subjects and links and the three-way chooser are absent while Add a chat and Ask Lasso remain.
- Prove the page and navigation say All AI Conversations.
- Prove Past Ask Lasso chats opens the historical view, the existing `view: "asked"` event fires, session open/delete still work, and no second history query is introduced.
- Prove Find it and Decision log cannot navigate, expose `aria-disabled`, and show Coming soon on pointer hover and keyboard focus.
- Re-run conversation, navigation, search, reader, wording, and event-allowlist tests plus type safety.
- Verify live at 1542×1075 and 1440×900, then at a narrow phone width: month order, wrapping, no horizontal page overflow, history navigation, tooltips, reader opening, and Add a chat / Ask Lasso access.
