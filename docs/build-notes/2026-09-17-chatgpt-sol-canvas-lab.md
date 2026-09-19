# Canvas Lab Build Notes

- Built from: ChatGPT Sol
- Build date and time: 2026-09-17 20:14 UTC
- Initial implementation commit: b1998d921016f3be14fa0ddf36936639223808aa
- Project: Lasso Coaching Hub
- Status: Unpublished hidden prototype

## 1. Why this exists

Canvas Lab is a "context board": the spatial clarity and freedom of a FigJam board, combined with Lasso's persistent, permission-aware engagement context. A FigJam board gives a team an open plane where work can be arranged, grouped, and discussed spatially. What it cannot do is carry the engagement's real context: who may see what, where each artefact came from, which turn of a conversation supplied a sentence, or which permission boundary a card sits behind.

Canvas Lab pairs the two. A user can zoom out to see the shape of the engagement (brief, workstreams, evidence, decisions, conversations) as movable cards on one board, then zoom into a live document or a familiar full chat without ever losing where it sits on the board. Selected objects become explicit, visible context for a persistent chat composer, so AI work starts from a context the user deliberately chose rather than something inferred invisibly.

The working inspiration was collaborating with a principal engagement manager who runs engagements out of FigJam: the consulting work itself (briefs, workstreams, evidence, calls, conversations) became dramatically easier to see, arrange, inspect, discuss, and reuse once it lived on a board. Canvas Lab asks what that board looks like when every node on it already knows its provenance, its permissions, and its source.

## 2. Experience implemented

- Hidden route `/engagements/{id}/canvas-lab`, reachable only by an authenticated user who navigates there manually; not in global navigation.
- A Cards/Live toggle: Cards shows the spatial board; Live opens a live artefact (document or conversation) in the focused reader.
- Pan and zoom on the board, with local card movement (drag to reposition; positions are prototype-local).
- Spatial frames grouping the board: brief, workstreams, evidence, decisions, and conversations.
- Selected-context chips above a persistent composer: selecting cards makes them the explicit context for the next prompt.
- A focused document/chat reader for zooming into a full artefact while keeping the board as the surrounding frame.
- Local comments and passage notes attached to cards and selected passages.
- Local chat, summarize, and branch flows from the composer (prototype-local drafts, no AI calls).
- A workspace plus canvas instructions demonstration, showing how standing instructions could sit alongside the board.
- A collaboration and ownership legend explaining what each card type is and who may do what to it.

Narrow screens render a readable stacked list instead of the canvas.

## 3. Real data used

The prototype reads only from existing, permission-filtered readers: the engagement itself (visible to the signed-in user under existing access rules), tasks/workstreams, mapped work items, decisions/calls, and the signed-in profile's identity. All queries go through the existing read-only data paths used elsewhere in the engagement screens. Nothing is written back.

## 4. Intentionally local-only

Prototype state resets on refresh and is never persisted:

- Card layout and positions.
- Comments and passage notes/highlights.
- Context selections (chips).
- Canvas and workspace instructions.
- Chat drafts, summarize outputs, and branches.
- Example presence (the second avatar is labelled as an example, not a real person).

The AI connection is intentionally off: chat and summarize show the user's prompt and say plainly that the connection is off.

## 5. Data and consent impact

- Existing data is read-only; no writes anywhere in the prototype.
- Existing events affected: none.
- New events: none. All prototype interactions are untracked in this build.
- Database, schema, RLS, or server changes: none.
- Consent behavior: unchanged. No consent surfaces touched, no stamping changes.
- Deployment: not published. The route is hidden and the prototype is unpublished.

## 6. Collaboration model being tested

- Your source: arrange and open. You can move your own work items around the board and open them in the reader.
- Teammate source: read, summarize, branch, comment. A teammate's work can never be edited or deleted by you.
- Your draft: edit locally.
- Example presence is illustrative only. It is not realtime and carries no live user data.

## 7. Files added in the initial build

- `src/routes/_authenticated/engagements.$id.canvas-lab.tsx` (route)
- `src/pages/CanvasLabPage.tsx` (page)
- `src/components/canvas-lab/canvas-lab-model.ts`
- `src/components/canvas-lab/LabCard.tsx`
- `src/components/canvas-lab/ContextComposer.tsx`
- `src/components/canvas-lab/FocusOverlay.tsx`
- `src/components/canvas-lab/PermissionLegend.tsx`
- `src/components/canvas-lab/__tests__/canvas-lab-model.test.ts`
- `src/routeTree.gen.ts` (generated update for the new route)
- `roadmap.md` (entry for the Canvas Lab build)

## 8. Verification completed

- Canvas Lab model tests passed (`canvas-lab-model.test.ts`).
- Design token guard passed (no raw colour literals; tokens only).
- Build/type checks were clean for the Canvas Lab route, page, and components.

## 9. Learnings and next decisions

- The inbox should remain intake and triage rather than becoming the infinite canvas. Overloading it would blur both jobs.
- The engagement canvas should become the primary workspace; the existing engagement tabs can evolve into lenses or drawers over the same board rather than separate pages.
- Spatial overview and focused reading are complementary. Do not render every full artefact at once; the board shows shape, the reader shows content.
- Explicit selected context is more trustworthy than invisible context. Users should always see exactly what the AI will see.
- Realtime multiplayer, persistent generic nodes, anchored passage comments, persisted AI branches, canvas/workspace instructions, and MCP connectors all require deliberate backend and data work before they can leave the prototype.
- Before any production move: define additive telemetry events with content-free payloads and matching portal-side updates, confirm the permission model per card type, and run user tests with engagement managers and coaches.

## 10. Open questions for testing

- Cards vs Live as the default view.
- Bottom composer vs right dock for the persistent chat.
- Whether comments should live on passages, on cards, or on both.
- How much coach work should be visible to the engagement owner.
- When a branched chat inherits the full context versus the selected context only.
- Which connectors matter first, including Granola/Fathom and LLM conversation imports.
- Whether the canvas replaces the engagement tabs or opens full screen from them.

## 11. Post-build routing correction — 2026-09-18 UTC

- The first route file, `src/routes/_authenticated/engagements.$id.canvas-lab.tsx`, was accidentally generated as a child of the engagement detail route `engagements.$id.tsx`.
- The engagement detail route renders EngagementPage directly and has no Outlet, so visiting `/engagements/{id}/canvas-lab` displayed the normal engagement screen instead of CanvasLabPage.
- The route was moved to TanStack Router's non-nested filename convention, `src/routes/_authenticated/engagements.$id_.canvas-lab.tsx`, keeping the public URL exactly `/engagements/$id/canvas-lab`. The generated route tree now parents Canvas Lab to the authenticated layout, and the engagement detail route is unchanged with no children.
- Lesson for future routes: verify route parentage in `src/routeTree.gen.ts` (the `parentRoute` field), not only that the path string exists. A focused regression test, `src/routes/__tests__/canvas-lab-route.test.ts`, now asserts the parentage, the preserved URL, and the absence of the old nested file.

## 12. Second prototype pass — 2026-09-18 UTC

### Design reasoning

The second pass reframed Canvas Lab as an Engagement Workboard rather than a general-purpose canvas. The board now follows consulting work: Foundation, each real workstream, Decisions, and Outputs. Conversations and source material sit inside the workstream they support. Native chat remains a small local sidecar built only from context the person explicitly selects.

### Controls before and after

Before, EngagementPage: Brief & Comms, Work, Canvas, and Share view controls; the Canvas branch rendered EngagementCanvasView. EngagementCanvasView provided WorkNote opening, pointer and keyboard movement, link drawing/review/removal, zoom/reset, shelf placement, and draft, empty, loading, and data states. It emitted `canvas.opened` with banded `node_band`, `link_band`, and `shelf_band`, plus `canvas.zoomed` with `direction` and `method`. EngagementPage emitted `engagement.view_changed` when the view changed.

Before, Canvas Lab: Back; example presence; Cards/Live; fit and zoom; pan; select, move, open, and branch; permanent ownership legend; context removal; composer submit; instruction toggle and local instruction text; narrow list; focused reader close, summarize, branch, passage selection, note body, and note submit. Its states were loading, desktop board, narrow list, focused reader, selected context, local comments, local instructions, local draft threads, pan, zoom, drag, and keyboard focus. It emitted no events.

After, EngagementPage and EngagementCanvasView: every existing control, render state, server action, and event above remains. One `Open workboard` link appears above the existing Canvas.

After, Workboard: menu open/close/Escape and role-appropriate navigation; back to engagement; fit, zoom in, zoom out, modifier-wheel zoom, and pan; local Add workstream; card drag and keyboard movement; Use as context/Remove context; Preview; teammate and draft Branch; context chip removal; six starter prompts; instruction drawer and local instruction text; Add draft thread; focused reader close, summarize, branch, source tracing for deliverables, passage selection, note body, and note submit. Its states are opening, reduced-motion opening status, loading, error, empty, populated board, menu open, focused reader, selected context, local comments, local instructions, local workstreams, local draft threads, pan, zoom, drag, keyboard focus, and narrow-screen guidance. Example presence, the permanent legend, and Cards/Live are absent.

After telemetry: Workboard mount calls existing `noteCanvasOpenedFn` once with `{ nodes: <local node count>, links: 0, shelf: 0, profile_id }`. That path continues to emit `canvas.opened` through `recordEvent`, which applies the existing consent stamp and bands those three counts. No other Workboard action emits an event.

### Data and consent impact

- One new user-facing action: `Open workboard` in the existing engagement Canvas tab.
- The Workboard reuses `canvas.opened` through `noteCanvasOpenedFn`, with the local node count and zero links and shelf. No event name, field, or dimension changed.
- All workboard actions, placement, highlights, comments, instructions, and draft threads remain local and reset on refresh.
- The existing permission-filtered engagement read is unchanged.
- No consent surface, consent stamping, database schema, migration, RLS, event plumbing, or deployment change.
- Portal changes: none.

### Implementation

- Full-screen shell above the normal app chrome, with a 52px rail, Lasso mark, close control, role-appropriate navigation drawer, title, Workboard/Not saved status, and fit/zoom controls.
- The opening resolves `canvas.unfolded` through the motion registry to a brief three-panel unfold. Reduced motion receives the static `Workboard open` status.
- Dynamic workstream frames derive from real engagement tasks. Real work uses the shared WorkNote presentation; brief, call, and local draft nodes remain folded-paper cards.
- Selected source nodes connect to draft threads with local graphite curves.
- The compact composer includes visible context, six starter prompts, the `Add draft thread` action, and honest AI-off wording.
- The focused reader keeps existing document/thread readers and local notes. Selection is highlighted using the CSS Custom Highlight API when available. Deliverables expose the existing What fed this control.

### Files and verification

Changed application files: `EngagementPage.tsx`, `CanvasLabPage.tsx`, the Canvas Lab model/card/composer/focus files, `motion-registry.ts`, the route metadata, and Canvas-Lab-scoped rules in `styles.css`. Focused tests cover dynamic frame creation/mapping, fake-presence removal, prompt starters, full-screen shell, the preserved production canvas call, and reduced-motion registration.

### Limitations

- The AI connection remains off. Draft threads do not produce generated answers.
- Frames, positions, highlights, notes, and drafts are not saved.
- There is no realtime collaboration or collaborator presence.
- The CSS Custom Highlight API is best-effort. On browsers without it, the selected quote remains visible beside its numbered note.
- The Workboard is unpublished and remains behind its hidden authenticated route.

### Second-pass verification correction

- The engagement entry now has the handwritten title `open the workboard`, the exact reset explanation, and the existing `Open workboard` link. EngagementCanvasView remains directly below and unchanged.
- Focused deliverable provenance now passes only the open deliverable to WhatFedThisButton and keeps its existing confirmation flow.
- The selected-text highlight is removed when the focused reader closes. Its pending quote number follows the existing note count, with the non-supporting-browser fallback unchanged.
- Composer drafts now stack in the first selected context node's frame, or Foundation without context. Branch and summarize drafts stay with their source frame.
- Seven pilot frames now begin in four columns and two rows. Fit continues to use active frame bounds.
- Modifier-wheel zoom prevents browser zoom before applying the existing workboard zoom; ordinary vertical scrolling is unchanged.
- Verification run: `bunx vitest run src/components/canvas-lab/__tests__/canvas-lab-model.test.ts src/components/canvas-lab/__tests__/canvas-lab-second-pass.test.ts src/routes/__tests__/canvas-lab-route.test.ts src/lib/__tests__/pass190-motion.test.tsx` passed 33 tests; `bunx vitest run src/lib/__tests__/pass83-tokens.test.ts` passed 2 tests; `bunx tsgo --noEmit` passed. The preview build completed successfully at 2026-09-18 08:10 UTC.

## 13. Phase 2 implementation — 2026-09-18 UTC

### Design reasoning

Phase 2 keeps the prototype focused on the reasoning and judgment layer for AI-assisted consulting. The only new canvas mechanics are those needed to arrange a consulting record, add clearly local reasoning notes, and draw a bounded local relationship. There are no generic shapes, freehand tools, cursors, or model choices. The persistent composer now occupies a compact right rail instead of covering the board. A deliverable opens a Lab-only read of the reasoning trail in one click while production provenance behavior remains unchanged.

### Controls before and after

Before Phase 2, the Workboard provided: menu open/close/Escape and role-appropriate navigation; back to engagement; fit, zoom in/out, modifier-wheel zoom, and pan; local Add workstream; card pointer and keyboard movement; Use as context/Remove context; Preview; teammate and draft Branch; context-chip removal; six prompt starters; instructions disclosure and local instructions; Add draft thread; focused-reader close, summarize, branch, text selection, local note text, and note submit. States were opening/reduced motion, loading, error, empty, populated, menu, selected context, dragging, keyboard focus, pan/zoom, local workstreams/drafts/comments/instructions, focused reader, and narrow-screen guidance. The only event was `canvas.opened` with banded node, link, and shelf counts.

After Phase 2, every control and state above remains. Added controls are: work-rail collapse/reopen; narrow-screen Board/Working from switch; five reasoning-scaffold add actions; six Human judgment choices; editable short local note; Remove from canvas for real records; Delete local node for local records; Add from engagement restore list; Connect start, source, target, Escape cancel, relationship selection, and relationship removal; and grouped reasoning-trail selection and close. Added states are open/collapsed rail, narrow board/rail view, scaffold, local node and judgment type, hidden-record list, connector idle/source/invalid/selected, and deliverable review loading/error/empty/item/exact-focus. Delete and Backspace remove only a local node or selected local relationship. They never delete a real record.

The rail starts open and preserves context, draft text, and instructions while collapsed because its composer remains mounted but hidden. The five scaffold squares are explicitly a guide and have no implied relationships. New nodes, notes, hidden records, and relationships say or behave as local-only and reset on refresh.

### Deliverable reasoning review

Preview on a deliverable opens `CanvasLabReview` directly. It does not mount `AnalysisConfirm`, call lineage drafting, or call production review/write functions. The review uses existing permission-filtered span-audit and rendition reads. Its left trail is grouped as Context, AI work, Human judgment, and Decisions. An available stored turn or span receives exact focus. When no stored locator exists, the whole item is shown with the honest line `No exact passage is attached. The whole item is open.` Closing restores the existing board state because pan, zoom, selection, and rail state remain owned by CanvasLabPage.

### Foundation and local model

Foundation now includes Start here: the real brief, questions derived only from current task names/details, latest status from the newest dated mapped item, and an unresolved-issues fallback explicitly labelled `Prototype prompt`. Placement uses deterministic frame lanes for adds, branches, and restored records. Removing a real record hides it in local state. Deleting a local node also removes its local relationships and context selection. Connect is the bounded click-source/click-target version, rejects self and duplicate links, supports Escape, and never calls production relationship writes.

### Data, consent, and events

There are no database, SQL, schema, RLS, server-function, consent-copy, consent-state, consent-ledger, or production-route changes. Every new event goes through `logEvent` to the existing authenticated `recordEvent` path. That path stamps schema version `v2`, session and sequence, event UUID, effective consent tier, and ledger version. At `t0` the event remains workspace-only and is not mirrored; at tiers `a` through `d` the existing tier rules apply. Payload is empty for every event. Dimensions use closed, low-cardinality vocabularies and contain no free text, prompt, title, quote, or record ID.

| Event | Dimensions | Effective consent tier | Portal follow-up |
| --- | --- | --- | --- |
| `workboard.rail_toggled` | `state`: `collapsed` or `reopened` | Current stamped tier; `t0` workspace-only | Add the event and `state` vocabulary to the portal catalog |
| `workboard.node_created` | `kind`: source/AI work/human judgment/decision/deliverable/draft thread; `judgment_type`: six approved types or `none` | Current stamped tier; `t0` workspace-only | Add event, kind, and judgment-type vocabularies |
| `workboard.node_edited` | `kind` only | Current stamped tier; `t0` workspace-only | Add event and kind vocabulary |
| `workboard.node_deleted` | `kind` only | Current stamped tier; `t0` workspace-only | Add event and kind vocabulary |
| `workboard.record_visibility_changed` | `action`: hidden/restored; `record_kind`: work/decision/brief | Current stamped tier; `t0` workspace-only | Add event and both vocabularies |
| `workboard.relationship_changed` | `action`: started/created/removed/cancelled/rejected | Current stamped tier; `t0` workspace-only | Add event and action vocabulary |
| `workboard.review_opened` | `format`: thread/document/deck/sheet | Current stamped tier; `t0` workspace-only | Add event and format vocabulary |
| `workboard.trail_item_selected` | `group`: context/AI work/human judgment/decisions; `focus`: exact/item | Current stamped tier; `t0` workspace-only | Add event and both vocabularies |

The existing `canvas.opened` event and its payload are unchanged. Portal changes are required for all eight new event names but were intentionally not performed in this pass.

### Files changed

- `src/pages/CanvasLabPage.tsx`
- `src/components/canvas-lab/CanvasLabReview.tsx`
- `src/components/canvas-lab/ContextComposer.tsx`
- `src/components/canvas-lab/FocusOverlay.tsx`
- `src/components/canvas-lab/FoundationGuide.tsx`
- `src/components/canvas-lab/LabCard.tsx`
- `src/components/canvas-lab/ReasoningTrailGuide.tsx`
- `src/components/canvas-lab/WorkRail.tsx`
- `src/components/canvas-lab/canvas-lab-model.ts`
- `src/components/canvas-lab/canvas-lab-telemetry.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-model.test.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-phase2.test.ts`
- `src/components/canvas-lab/__tests__/canvas-lab-second-pass.test.ts`
- `src/lib/telemetry-shared.ts`
- `src/styles.css`
- `roadmap.md`
- this build note

Production `EngagementCanvasView`, `WhatFedThisButton`, AskDock, the landing page, shared tokens, routes, server functions, and consent code were not changed.

### Verification

- `bunx tsgo --noEmit`: passed.
- `bunx vitest run src/components/canvas-lab/__tests__/canvas-lab-model.test.ts src/components/canvas-lab/__tests__/canvas-lab-second-pass.test.ts src/components/canvas-lab/__tests__/canvas-lab-phase2.test.ts src/routes/__tests__/canvas-lab-route.test.ts src/lib/__tests__/pass190-motion.test.tsx src/lib/__tests__/pass83-tokens.test.ts`: 43 tests passed across 6 files.
- Token guard: included above and passed.
- Motion registry tests: included above and passed.
- Preview build: successful at 2026-09-18 20:17 UTC.
- Authenticated visual verification: not completed. The required Liam session could not be minted without approval in this build context, and no other account was substituted.

### Known limitations

- All Phase 2 nodes, notes, hiding, relationships, rail state, and context remain local and reset on refresh.
- The AI connection remains off and draft threads produce no generated answer.
- Exact focus depends on an existing stored turn or span locator. The review never invents one.
- The hidden route remains unpublished.
- The data portal requires the catalog follow-up listed above before these additive events are interpreted there.

### Phase 2 reasoning-review correctness correction

The Lab-only `What fed this` review no longer presents unrelated local notes as support for the open deliverable. A pure local graph helper starts from the reviewed Lab node and follows only explicit local relationships. Links are treated as undirected because the prototype relationship has no semantic direction label, and links with a missing endpoint are ignored.

Human judgment now contains only persisted stitches returned by the existing permission-filtered audit read, local judgment nodes in that connected component, and local comments attached to the reviewed deliverable or another node in that component. Spatial proximity, shared frame, selected context, and node kind never imply a relationship. Every included local entry remains marked `Not saved`. Persisted stitches and explicitly sourced decisions are unchanged.

No control, action, event, payload, surface, persistence, server call, consent behavior, database behavior, or portal requirement changed. Production provenance components and EngagementCanvasView were not changed.

Verification: `bunx tsgo --noEmit` passed. The focused Canvas Lab model, second-pass, Phase 2, route, motion, and token suite passed 48 tests across 6 files. New model cases cover zero links, a direct link, a multi-hop component, a disconnected node, and a missing endpoint. The Phase 2 source regression confirms the review receives the anchor node ID and local links, then filters local judgments and comments through the connected set. The preview build completed successfully at 2026-09-18 20:23 UTC.

### Card interaction correction

The permanent card action tray and global Connect mode were replaced with four card-edge connection anchors and one compact contextual menu. Pointer drag from an anchor previews a green local relationship. Keyboard or click activation provides a two-step source and target path. Stored local relationships retain their source and target sides. The selected outline follows only the paper boundary.

Right-click, Shift+F10, the Context Menu key, and the paper-corner ellipsis open the same ownership-aware actions. Existing context, Preview, Branch, hide, local delete, relationship removal, card movement, and local reset behavior remain available.

One additive event was added: `workboard.card_menu_opened`, with closed dimensions `{ node_kind, ownership }`. It uses the existing consent-stamped event path, remains workspace-only at tier t0, and requires a matching portal catalog update. No identifiers, content, coordinates, or free text are included.

No consent, database, schema, RLS, server, production canvas, provenance, landing-page, AskDock, persistence, deployment, or publishing change was made.

Verification: `bunx tsgo --noEmit` passed. The focused card-interaction, model, Phase 2, second-pass, route, motion, and token suite passed 54 tests across 7 files. The preview build completed successfully at 2026-09-18 20:47 UTC. Authenticated desktop and narrow-screen visual verification was not completed because the required Liam session approval was unavailable; no other account was substituted.

## 2026-09-18 — Phase 3 Slice 1: durable Workboard

**Architect (database, applied via the migration workflow):** `drizzle/migrations/0001_canvas_lab_slice1_workboards.sql` added `workboards`, `workboard_frames`, `workboard_nodes`, `workboard_links`, `workboard_revisions` with grants, RLS, author-only prose guard, soft delete, and automatic revision/version triggers. Generated types refreshed. No production table was modified.

**App (this build):** client-safe contract `src/lib/canvas-lab-shared.ts`; caller-scoped server assembly/mutations `src/lib/canvas-lab.server.ts`; authenticated functions `src/lib/canvas-lab.functions.ts`; save pipeline hook `src/hooks/use-canvas-lab.ts`; page wiring in `CanvasLabPage` (drag end and keyboard moves, hide/restore, judgment create/edit, workstream create, relationship create/remove all persist; deterministic virtual board lazy-materializes on first mutation); durable merge plus inbound-only bounded traversal in the model; `CanvasLabReview` now walks explicit inbound relationships only.

**Permissions:** active non-coach engagement members arrange the board; coaches are read-only (server-checked); authored prose stays author-only (database guard); conflicts offer only Load latest / Retry my change.

**Events added (consent-stamped, content-free):** `workboard.change_saved` {entity, action}, `workboard.save_failed` {entity, reason}, `workboard.conflict_resolved` {entity, choice}. Portal catalog follow-up is owed for these three plus the nine Phase 2 `workboard.*` events.

**Still local by design:** viewport, zoom, rail, selection, menus, connector preview, unsent composer text, comments, canvas instructions, draft chat cards. Durable storage of authored judgment text was approved for Slice 1; comments/highlights/excerpts await a consent decision.

**Verification:** tsgo clean; 50 Canvas Lab tests across 6 files pass; token guard passes; preview build succeeds. Full-suite runs show 18 pre-existing failures in unrelated passes (email templates, decisions copy, chat search) that predate this change. Live multiuser RLS/conflict behavior and Liam-identity visual verification remain unverified.

## 2026-09-18 (b) — Slice 1 security and persistence correction

- Migration: `drizzle/migrations/0002_canvas_lab_slice1_workboard_hardening.sql` (additive; 0001 untouched). Editor-only insert/update policies across workboards, nodes and links (frames were already editor-gated), workboards.org_id tied to the engagement, author-only prose/archive on judgment and draft cards, guard triggers rejecting org/board/identity reassignment and requiring the actor to be the caller, service-role bypass when `auth.uid()` is null, unique partial indexes on `client_key` and on each canonical reference.
- Applied policies queried after the migration; all five workboard tables still hold zero rows.
- App: `canvas-lab.server.ts` checks edit rights before `ensureBoard` so a coach mutation cannot lazy-create a board; node update/archive/restore refuse a non-author on judgment and draft cards; `insertNodeIdempotent` returns the existing row on a 23505 so a retry cannot duplicate a card; materialize replays by client key.
- `canvas-lab-model.ts` gives each local card a random `clientKey` (`newLabClientKey`); `CanvasLabPage.deleteNode` persists `node_archive` for the author and refuses a teammate's card; `LabCardMenu` shows "Only the author can remove this" instead of Remove from canvas for a teammate's judgment; Load latest refetches through `useCanvasLab.refresh()` and re-applies the whole durable board (frames, cards, relationships) over the deterministic seed while viewport, rail, selection and unsent composer text stay put.
- No new events. No consent, production canvas/provenance, AskDock, landing, deployment or publishing changes. Portal catalog follow-up still owed for the nine Phase 2 events plus the three persistence events.
- Verification: typecheck clean; 64 tests across 8 files (12 new in `canvas-lab-hardening.test.ts`); token guard passes; preview build succeeds. Live multiuser conflict behaviour and Liam-identity visual verification remain unverified.

## 2026-09-18 (c) — Canvas Interaction Polish

- **Controls added:** four 8px square corner resize handles on editable selected cards and frames; Fit content in the card menu and frame control; a local Structured / Freeform segmented control; Structured-only explicit Move to workstream menu actions. The four 8px circular edge connection anchors remain distinct and sit 11px outside the paper.
- **States added:** card resize, frame resize, cancellation, selected frame, fit-content result, Structured, and Freeform. Existing save, failure, forbidden, Load latest, and Retry states remain the only persistence feedback.
- **Durable data:** existing node and frame `x/y/w/h` columns only. Card content reflows rather than scales. Reassignment writes only the selected node's existing frame reference. No SQL or migration was added. Moving a frame with its cards remains deferred because current writes are not atomic across rows.
- **Local data:** Structured / Freeform choice, in-progress resize, selection, viewport, rail, menus, comments, highlights, instructions, and drafts remain browser-local.
- **Events added:** `workboard.element_resized` with `{element_kind, method, axis}` and `workboard.structure_toggled` with `{state}`. They use `logEvent` through the existing consent-stamped `recordEvent` path and contain no dimensions, positions, ids, or content. Matching portal catalog work remains required.
- **Isolation:** no consent, database/schema, generated type, route, auth, production canvas/provenance, AskDock, landing, deployment, or publishing change.
- **Verification:** TypeScript and the automatic preview build pass; 69 focused interaction, model, persistence, conflict, route, and token tests pass across eight files. Resize boundaries retain member cards, server mutations reject non-finite/out-of-range geometry and cross-board frame reassignment, keyboard changes save at key release, and Escape restores the pre-resize rectangle. Authenticated Liam visual checks remain pending; Phase 3 Slice 2 remains blocked on explicit consent and retention approval.
