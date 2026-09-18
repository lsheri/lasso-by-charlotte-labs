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

Before: Back; example presence; Cards/Live; fit and zoom; pan; select, move, open, branch; permanent ownership legend; composer and instruction toggle; narrow list; focused reader; local passage notes, summarize, and branch.

After: the existing production Canvas controls and states remain unchanged, with one new `Open workboard` link above it. The Workboard keeps back/menu, fit and zoom, pan, select, move, preview, focus, branch, local context, draft threads, notes, and the narrow fallback. It removes example presence, the permanent legend, and Cards/Live. It adds a local menu drawer, local Add workstream control, six prompt starters, and compact instructions.

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
