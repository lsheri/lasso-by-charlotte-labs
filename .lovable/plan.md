# Unit P2: Workboard document and deck previews

## Data impact
- Adds no new control or flow. Preview mode loads a visual/text rendition only for visible document, deck, and sheet cards.
- Opening a previewed document or deck records the existing `workboard.card_content_viewed` event with `kind` and additive `via: open`, once per card per board session.
- No consent surface, consent stamping, database schema, policy, SQL, or landing-page code changes.
- Portal catalog update required: allow `via: open` for `workboard.card_content_viewed`.

## Control and state contract
### Before
- **LabCard/LabPaper controls:** card focus/select, open, branch, remove from board, delete eligible local work, edit local note, comment chip, four connection anchors, four focused resize handles, fit, frame move, contextual menu, focused chat-preview scrolling.
- **LabCard/LabPaper states:** sticky; preview chat loading/content/empty; document/deck/sheet six-line excerpt; compact/standard/expanded size; selected/in-context; focused; connecting; own/teammate/draft; comments; deleted linked item; local editor.
- **FocusOverlay controls:** summarize, branch, back; text selection; highlight; author visibility toggle/removal; comment/reply/edit/remove; composer post/cancel; go to passage.
- **FocusOverlay states:** chat/document/local note; loading/content/unreadable/failure reader states; no comments/comments/replies; fresh/cross-turn/stale selections; own/team highlights; writable/read-only coach view.
- **Telemetry:** card preview scroll uses `workboard.card_content_viewed {kind: chat, via: scroll}` once per card session; opening uses existing review/open events only.

### After
- Every control above remains unchanged. The version chip is informative, not interactive.
- Every state above remains, with visible-card document preview loading/success/fallback states and a version-count chip. Failure silently returns to the existing six-line excerpt.
- Existing telemetry remains. Opening a document/deck card while Preview mode is active additionally emits `workboard.card_content_viewed {kind: document|deck, via: open}` once per card session.

## Build
- Extend the card-preview model with document preview data and version count.
- Add a session-cached, one-at-a-time client queue. It activates only in Preview mode and receives only on-screen document/deck/sheet ids.
- Use the signed-in browser client for readable item/version metadata and file URLs. Use the existing authenticated extracted-text path for text-page previews.
- Render PDF page one through the existing lazy pdf.js loader; render a first-slide layout from `document_versions.slide_map`; otherwise use the available deck/text reading path; render docx/txt/md extracted text as a clipped page.
- Keep the current six-line excerpt whenever data is absent, unreadable, unsupported, or loading fails. Cards show no error message.
- Show `vN` on document/deck cards when document version rows exist.
- Keep the reader caller-scoped: no owner filter for mapped teammate items, and show “Couldn't open this file” only after the storage read refuses.
- Extend the existing telemetry helper to accept `scroll | open`; do not add an event name or dimension.

## Verification
- Add focused tests for Preview-only and on-screen loading, serial queue behavior, silent excerpt fallback, version chip, teammate-readable file access, and `via: open`.
- Run focused tests and TypeScript checks, then inspect the automatic preview build log. Skip browser checks as requested.
