# Canvas Lab Phase 2 plan

## Goal
Turn the hidden Engagement Workboard into a compact reasoning workspace without changing the production canvas or any non-Lab workflow. The board remains an unpublished, in-memory prototype. It helps a person work backward from a deliverable through source context, AI exchanges, human judgment, and decisions without claiming relationships the record does not support.

## Data impact and implementation gate

- **New local actions/surfaces:** collapse/reopen the work rail; add five reasoning-trail node types; choose one of six human-judgment types; edit a local note; hide/restore a real record; delete a local node; enter connector mode; create/select/remove a local relationship; open and navigate the one-click deliverable trail.
- **Existing event retained:** Workboard mount continues to call `noteCanvasOpenedFn` once, producing `canvas.opened` with the existing banded `{ node_band, link_band, shelf_band }` dimensions and consent stamping. No event name, payload, or dimension changes.
- **Consent:** no changes to consent state, ledger, consent copy, consent surfaces, or event stamping.
- **Storage:** existing permission-filtered reads only. Every new node, hidden item, relationship, note, instruction, and rail preference is React state that resets on refresh.
- **Portal:** no portal-side changes under the requested no-new-event constraint.

There is one binding conflict to resolve before implementation: project rules prohibit shipping an untracked new user action, while this request prohibits a new event schema. The actions above cannot truthfully reuse `canvas.opened`. Implementation should remain blocked until the architect either grants an explicit telemetry exception for this unpublished prototype or approves additive events with a matching portal update. Nothing in this plan bypasses `recordEvent` or repurposes an existing field.

## A. Exact files and components to change

### Existing files
- `src/pages/CanvasLabPage.tsx`
  - Make the work rail a non-overlapping sibling of the canvas.
  - Own local hidden IDs, local links, active tool, selected link/node, trail focus, and add/restore actions.
  - Keep current engagement read, mount event, pan, zoom, fit, menu, loading/error/empty states, and mobile fallback.
- `src/components/canvas-lab/canvas-lab-model.ts`
  - Add typed local process nodes, six human-judgment variants, local relationships, hide/remove helpers, and deterministic staggered placement.
  - Add pure selectors for the Foundation guide and grouped reasoning trail.
- `src/components/canvas-lab/LabCard.tsx`
  - Add green selected/focused treatment and a compact selected-item toolbar.
  - Real records offer `Remove from canvas`; local records offer `Delete local node`.
  - Preserve `WorkNote`, source marks, ownership restrictions, preview, context, branch, pointer drag, and keyboard movement.
- `src/components/canvas-lab/ContextComposer.tsx`
  - Convert the bottom composer into the compact content of the right work rail.
  - Preserve selected chips, six prompt starters, instructions, honest AI-off wording, and `Add draft thread`.
- `src/components/canvas-lab/FocusOverlay.tsx`
  - Keep the existing reader/comments path for non-deliverables.
  - Route a deliverable directly into the Lab-only reasoning review, without `AnalysisConfirm` or `draftLineage`.
  - Replace Lab-only yellow selection/note emphasis with green tokens.
- `src/styles.css`
  - Add only `.canvas-lab-*` rail, process-guide, relationship, selection, and narrow-layout rules.
  - Change `::highlight(canvas-lab-selection)` to the existing green wash.
- `src/lib/motion-registry.ts`
  - Add an event only if the rail or relationship feedback moves. Every added event gets an equivalent reduced-motion state. No screen chooses an animation directly.
- `src/components/canvas-lab/__tests__/canvas-lab-model.test.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-second-pass.test.ts`
- `src/routes/__tests__/canvas-lab-route.test.ts` only to reconfirm route isolation, not to change routing.
- `docs/build-notes/2026-09-17-chatgpt-sol-canvas-lab.md`
  - Append a Phase 2 section. Do not rewrite prior notes.
- `roadmap.md`
  - Add a lean Phase 2 checklist and retain existing blocked visual-verification work.

### New Lab-only components
- `src/components/canvas-lab/WorkRail.tsx`
  - Paperclip-style context header, selected chips, textarea, starters, instructions, submit, collapse/reopen control, and hidden-record restore drawer.
- `src/components/canvas-lab/ReasoningTrailGuide.tsx`
  - Five clearly labelled scaffold squares and an add action for each node type.
- `src/components/canvas-lab/CanvasLabReview.tsx`
  - Read-only, one-click deliverable review with compact left trail and deliverable pane.
- `src/components/canvas-lab/FoundationGuide.tsx`
  - Brief, real workstream questions/details, latest real mapped-work status, and clearly labelled prototype prompts for unresolved issues when no record exists.

### Explicitly unchanged
`EngagementCanvasView`, `WhatFedThisButton`, production provenance behavior, server functions, generated files, database/schema/RLS, consent code/copy, telemetry schema, `/`, `/landing-next`, AskDock, and all non-Lab routes.

## B. Minimum coherent implementation

### 1. Compact right work rail
- Desktop uses a fixed-width right column in the Workboard layout, so the board viewport shrinks rather than being covered.
- The rail starts open and can collapse to a narrow icon tab with an explicit accessible label; reopening restores its local contents.
- Order: paperclip `Working from` header, selected-context chips, textarea, six existing starters, compact instructions disclosure, AI-off line, `Add draft thread`.
- Narrow screens switch between board and work rail as adjacent views rather than stacking the rail over cards.

### 2. One-click deliverable reasoning review
- Opening a deliverable goes directly to `CanvasLabReview`; no `AnalysisConfirm`, `draftLineage`, or review write runs.
- Reuse the existing permission-filtered `getSpanAudit` and rendition reads without changing them.
- Reuse read-only presentation from `AnchorPane`, `SlidesPane`, source marks, stitch numbering, and current green evidence emphasis where their contracts allow. Extract a small presentational seam only if required; do not alter production behavior.
- Left trail groups:
  - **Context:** linked non-conversation source items and the real brief.
  - **AI work:** linked AI conversations and their available turns/prompts.
  - **Human judgment:** existing span questions/answers plus local Lab judgment nodes and local margin notes, clearly marked `Not saved` where applicable.
  - **Decisions:** engagement decisions whose existing `srcs` refer to this deliverable or a displayed source.
- Selecting a stitch focuses its stored passage, page, slide, or source turn using the existing locator. A document-level link without a locator focuses the item only and says no exact passage is attached. No highlight is guessed.
- Close returns to the unchanged board pan, zoom, selection, and rail state.

### 3. Reasoning-trail scaffold
- Add one compact `Reasoning trail` guide frame without replacing Foundation, real workstream frames, Decisions, or Outputs.
- Show five unconnected squares in order: `Source / Context`, `AI work`, `Human judgment`, `Decision`, `Deliverable`.
- Each square has one accessible add action. Added cards are explicitly local and receive no connecting line until the person creates one.
- Human judgment opens a six-option selector: `Added constraint`, `Corrected AI`, `Rejected option`, `Requested evidence`, `Changed direction`, `Accepted but rewrote`. The resulting local card shows the chosen type and an editable short note.

### 4. Foundation guide
- Keep the real brief verbatim.
- Derive key questions from real task names/details only.
- Derive latest status from the newest dated mapped item only, naming the item and date rather than inferring project health.
- Show unresolved issues only when present in real text; otherwise show clearly prefixed `Prototype prompt` questions. Never invent a client fact.

### 5. Local placement, removal, and restore
- Replace the global chat counter offset with a deterministic frame-and-lane placement helper based on existing nodes, node type, and creation order.
- Repeated branch/add actions stagger across available columns and rows inside their target frame. `branchChatNode` stays near its source without overlap.
- Hiding a real record adds its ID to local hidden state. It never mutates or deletes source data.
- `Add from engagement` lists hidden real records and restores them at the next deterministic position.
- Local drafts/process/judgment nodes can be deleted. Associated local links and context selection are removed in the same state transition.
- Teammate and real-record ownership restrictions remain intact.

### 6. Basic relationship mode
- Implement a small two-step local mode: choose `Connect`, select a source card, then select a target card. Escape cancels.
- Reuse `canLink` for self/duplicate rejection; store `LabLink[]` locally. Do not call production link-writing functions.
- Draw token-based graphite lines normally and Lasso green emphasis when selected. Process guide squares have no implied links.
- A selected local relationship can be removed by its compact toolbar action or Delete/Backspace. An `aria-live` message announces creation, cancellation, rejection, and removal.
- This intentionally omits Miro-style handles, freehand connectors, relation labels, routing, persistence, and multi-select.

### 7. Lasso visual and interaction rules
- Preserve `WorkNote`, `SourceMark`, and existing sticky/folded-paper language.
- Use `--nb-green`, green wash, and semantic tokens for Lab selection rings, focus outlines, text highlights, connector emphasis, and active tool states. Remove Lab-only yellow active/highlight treatment without changing shared production colors.
- Keep explicit labels, `aria-pressed` where applicable, Escape behavior, Enter/Space actions, arrow-key movement, Delete/Backspace safeguards, focus return, and reduced-motion equivalents.

## C. Controls, states, and telemetry inventory

### Before
- **Shell/menu:** open menu; close by X, backdrop, or Escape; role-appropriate navigation; add workstream; back to engagement.
- **View:** Fit; zoom out/in; modifier-wheel zoom; zoom readout; pointer pan.
- **Cards:** pointer move; arrow-key move; Enter/Space context toggle; Use/Remove context; Preview; teammate/chat Branch.
- **Composer:** remove context chip; textarea; six starters; instructions toggle; local instructions textarea; Add draft thread.
- **Focus reader:** close; text selection; local note text/submit; conditional Summarize, Branch, and What fed this.
- **States:** opening/reduced-motion opening; loading; error; empty; populated; menu open; selected context; drag; keyboard focus; pan/zoom; local workstreams/drafts/comments/instructions; focused reader; narrow-screen guidance.
- **Telemetry:** `canvas.opened` once on mount with `{ nodes, links: 0, shelf: 0, profile_id }`, recorded as banded `node_band`, `link_band`, `shelf_band`. No other Lab telemetry.

### After
All controls and states above remain except the bottom composer moves into the right rail and the deliverable-only What fed this confirmation path becomes the direct Lab review.

Added controls:
- collapse/reopen work rail;
- five scaffold add actions;
- six human-judgment choices and editable local note;
- Add node menu;
- selected-item toolbar;
- Remove from canvas for real records;
- Delete local node for local records;
- Add from engagement restore drawer/list;
- Connect mode, source/target selection, cancel, select/remove relationship;
- direct review trail group/item selection and close.

Added states:
- rail open/collapsed and narrow-screen board/rail view;
- process scaffold;
- local-node editor/type picker;
- hidden-real-record shelf and restore-empty state;
- connector idle/source-selected/invalid/selected states;
- deliverable review loading/error/empty/text/slides/item-focused/exact-passage-focused states.

Telemetry remains `canvas.opened` only pending resolution of the data-platform gate above. No existing event is repurposed.

## D. Focused tests

### Pure model tests
- Five scaffold types and six judgment variants are valid and local-only.
- Local node creation chooses the matching guide lane/frame and deterministic non-overlapping positions.
- Repeated branches stagger near the source.
- Hiding/restoring a real record never deletes it; deleting a local node removes its local links/context.
- Two-step local links reject self-links and duplicates and never create template relationships.
- Active bounds include newly added frames/nodes and still fit at or above the existing floor.
- Foundation selectors use only real brief/task/work data and label fallback prompts.

### Component/interaction tests
- Right rail occupies layout space, collapses, reopens, and preserves draft/context.
- Composer controls and exact six starters remain reachable with accessible names.
- Selected local and real cards expose the correct toolbar actions; Delete/Backspace cannot delete a real record.
- `Add from engagement` restores a hidden real record.
- Connector mode works by pointer and keyboard, Escape cancels, and announcements fire.
- All Lab active/selection/highlight/connector treatments resolve to green tokens; token guard finds no raw colors.
- Deliverable Preview reaches the useful review in one click and never mounts `AnalysisConfirm` or calls draft/review writes.
- Review groups only factual available data, focuses exact stored locators, and uses an honest whole-item fallback.
- Existing non-deliverable focus comments/branch/summarize behavior remains.
- Production `EngagementCanvasView` source remains unchanged and directly below the Workboard entry.
- Existing route isolation and `canvas.unfolded` reduced-motion tests remain green.

### Verification commands
- Focused Canvas Lab model/component/route tests with `bunx vitest run ...`.
- Existing provenance reader tests affected by reused presentation seams.
- `bunx vitest run src/lib/__tests__/pass83-tokens.test.ts`.
- Existing motion registry test suite.
- `bunx tsgo --noEmit`.
- Preview build log must end in `build OK`.
- Authenticated Playwright at 1280×1800 and a narrow viewport, using the required Liam identity only. Verify non-overlap, one-click trail, keyboard removal safeguards, green emphasis, rail persistence, and no runtime/console errors. If the required account remains unavailable, report visual verification as blocked rather than substituting another account.

## E. Risks and smaller alternative

- **Telemetry gate:** this is the only hard blocker. New controls cannot be both untracked and compliant with the project rule. Resolve before code changes.
- **Exact passage/slide focus:** only stored span locators can support exact highlighting. Document-level lineage and decisions may have only item/turn references. The UI must fall back visibly, never infer a passage.
- **Decision grouping:** decisions carry `srcs`, so relevant rows can be selected locally, but they are not first-class span-audit nodes. Phase 2 should show only decisions with an explicit source intersection and open the cited source when possible.
- **PDF cost:** the existing slide reader can inspect up to 60 pages. Keep its current loading/error behavior and lazy page painting.
- **Connector complexity:** the planned click-source/click-target mode is the bounded version. If it threatens the pass, omit arbitrary connectors and retain only existing context-derived draft curves plus chip-based removal. Do not ship inaccessible pointer-only drag handles.
- **Narrow screens:** a side-by-side rail cannot remain readable at phone widths. Use a board/rail switch, not an overlay that obscures cards.
- **Shared provenance components:** if reuse would alter production behavior, create Lab-only wrappers around their existing read data instead of changing shared contracts.

## Documentation
Append a `Phase 2 planning and implementation` section to the existing Canvas Lab build notes after implementation, recording the final control/event inventory, local-only boundaries, exact files, tests actually run, unresolved telemetry decision, and any omitted connector behavior. Do not rewrite earlier sections.
