# Unit R3 plan: card and sticky visual pass

## Data impact
- Changes visual treatment and scroll containment for existing cards, stickies, chat previews, and document previews.
- No user action, route, copy, data visibility, consent behavior, event name, payload, or dimension changes.
- Existing preview scrolling continues through its current callback. No new event is needed.
- No SQL, table, policy, function, trigger, or data edits.

## Current contract to preserve
### Controls
- Card open, menu, select, drag, resize, connect, comment, trail, branch, hide, delete, and move controls.
- Chat attachment open and expansion controls.
- Document page previous, next, open-larger, and start-note controls.

### Render states
- Sticky and preview modes; compact and expanded sizes; mapped, unmapped, private, selected, focused, read-only, and dimmed states.
- Chat previews with turns, absent turns, focused scrolling, and unknown sources.
- Document previews for text, slide, PDF, fallback, loading, empty, and failed rendering.

### Existing event calls
- `workboard.document_created` with `{ via: "workstream" }` remains unchanged.
- Existing board preview-read callbacks and their upstream event calls remain unchanged.
- No event originates from the shared card-border or size styles.

## Build
1. Add failing R3 checks first for shared graphite borders, the taller shared minimum, long-content overflow safety, fixed scrollable chat windows, all four source treatments plus unknown fallback, Ask Lasso colour exclusion, dimming inheritance, and thin document preview borders.
2. Centralize card and sticky dimensions in the existing paper styles: change the shared border from 1px to 1.5px graphite and the shared minimum height from 180px to 220px while preserving widths and grids. Align board card geometry with the same 220px floor so fixed board frames cannot clip taller paper.
3. Add named chat-border tokens beside the existing colour tokens. Use one gradient-wrapper technique for Claude, ChatGPT, Gemini, Copilot, and the graphite fallback, all at the same border weight.
4. Reuse `sourceVendorKey` from `SourceMark.tsx` for source identification. Introduce one presentational chat-window component shared by board and app-card previews, with fixed height, internal vertical scrolling, and wheel handoff at the top and bottom.
5. Give document preview bodies a one-step-thinner graphite border through their shared preview styles, including the workstream document body, without changing content or controls.
6. Re-run focused and adjacent tests, type safety, and the preview build. Compare the control, state, and event inventories above to the result before reporting.

## Expected files
- `src/styles.css`
- `src/lib/canvas-lab-shared.ts`
- `src/components/canvas-lab/canvas-lab-model.ts`
- `src/components/work/ChatPreviewWindow.tsx` (new presentational component)
- `src/components/work/WorkCardPreview.tsx`
- `src/components/canvas-lab/LabPaper.tsx`
- `src/components/canvas-lab/LabPreview.tsx`
- `src/components/engagements/WorkstreamDocument.tsx`
- Focused R3 tests and directly affected existing size assertions

## Assumptions
- “Noticeably taller” means 180px to 220px for preview cards and stickies.
- “Visibly thicker” means 1px to 1.5px for card/sticky borders; document preview bodies remain 1px.
- Existing non-card controls, layout widths, columns, and grids stay unchanged.
