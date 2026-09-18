# Canvas Lab Phase 3: durable reasoning records

## Scope and required gate

Phase 3 makes the hidden Workboard durable and multiuser while keeping Lasso focused on evidence, human judgment, decisions, and finished work. It does not add drawing tools, shapes, cursors, freehand input, model selection, or general whiteboard features.

**Data impact:** this changes existing Workboard actions from browser-local changes into shared durable records. It introduces stored user-authored judgment text and may later store comments, selected excerpts, branch prompts, and Workboard instructions. It does not change original chats, work items, production provenance, or consent state by itself.

**Architect stop:** storing selected excerpts, comments, branch prompts, and Workboard instructions touches the consent boundary. The first slice must not include those four content classes until the architect approves storage purpose, retention, access, deletion, and whether any may be sent to AI. Existing consent wording and `CONSENT_TEXT_VERSION` remain untouched unless the architect separately directs a consent change.

No database work is performed by the build agent. The architect owns migrations, grants, policies, functions, generated types, and any backfill.

## 1. Current controls, states, and events

### Current controls

- Workboard navigation drawer: open, close, Escape, role-aware links, Add workstream, Back to engagement.
- Board: pan, Fit, zoom in, zoom out, modifier-wheel zoom.
- Work rail: collapse, reopen, narrow-screen Board/Working from switch, remove context chip, six prompt starters, instructions disclosure and text, Add draft thread, restore removed record.
- Reasoning guide: add Source, AI work, Human judgment, Decision, or Deliverable; Human judgment offers six existing judgment types.
- Cards: pointer drag, arrow-key movement, Use/Remove context, Preview, conditional Branch, Remove from canvas for real records, Delete local node for local records, edit local note text.
- Card relationships: four anchors, pointer-drag preview, click/keyboard two-step creation, Escape cancellation, relationship selection, Remove relationship, Delete/Backspace removal.
- Reader: close, summarize, branch, select a passage, enter a margin note, submit the note.
- Deliverable review: one-click open, grouped trail selection, exact passage/item focus, close.

### Current render states

Opening and reduced-motion opening; loading; error; empty; populated; navigation open; rail open/collapsed; narrow board/rail; pan; zoom; card drag; keyboard focus; selected context; card menu; connector idle/preview/armed/rejected; selected relationship; hidden records; local edit; focused reader; deliverable review loading/error/empty/item/exact focus; local comments; local instructions; local workstreams; local draft threads.

### Current event contract

Keep these names and payloads unchanged. They continue to describe interactions, not confirmed persistence:

- `canvas.opened` with existing banded node/link/shelf dimensions.
- `workboard.rail_toggled` `{ state }`.
- `workboard.node_created` `{ kind, judgment_type }`.
- `workboard.node_edited` `{ kind }`.
- `workboard.node_deleted` `{ kind }`.
- `workboard.record_visibility_changed` `{ action, record_kind }`.
- `workboard.relationship_changed` `{ action }`.
- `workboard.review_opened` `{ format }`.
- `workboard.trail_item_selected` `{ group, focus }`.
- `workboard.card_menu_opened` `{ node_kind, ownership }`.

All remain content-free and use the existing consent-stamped `recordEvent` path.

## 2. Canonical records versus additive Workboard records

### Keep canonical in existing records

- Engagement identity, title, brief, client, and access remain in `engagements` and `engagement_members`.
- Workstreams remain canonical `tasks`; their names and details are never copied into Workboard content.
- Original chats, calls, documents, decks, sheets, email, messages, and images remain canonical `work_items` plus `turns` and document versions.
- Decisions remain canonical `decisions`; a Workboard card references a decision and never duplicates or edits its wording.
- Existing work-to-work provenance remains in `work_item_links`; persisted span provenance remains in `span_links`.
- Production `canvas_nodes` remains the owner-specific production canvas placement table. Phase 3 must not extend or reinterpret it.

### New additive records

Architect-owned names may vary, but the contract should separate these concerns:

1. **`workboards`**: one active Workboard per engagement, with `id`, `org_id`, `engagement_id`, `created_by`, `created_at`, `updated_at`, and `version`. Unique active row per engagement.
2. **`workboard_frames`**: shared frame identity and layout. Fields include board, stable key, kind `foundation | task | decisions | outputs | custom`, optional `task_id`, custom label only when kind is custom, geometry, order, author/updater, version, timestamps, and `deleted_at`.
3. **`workboard_nodes`**: shared placement plus either a canonical reference or authored content. Reference columns are explicit nullable foreign keys such as `work_item_id` and `decision_id`; the engagement brief uses a closed reference kind rather than copied text. Authored kinds are the existing human-judgment and draft kinds, with `author_profile_id`, title/body, existing judgment type, frame, geometry, version, timestamps, and `deleted_at`. A database rule enforces exactly one valid shape: canonical reference or authored node.
4. **`workboard_links`**: directed, explicit relationships between two active Workboard nodes, including `from_anchor`, `to_anchor`, a closed relation vocabulary, author, version, timestamps, and `deleted_at`. Reject self-links and active exact duplicates.
5. **`workboard_annotations`**, after consent approval only: author-owned comment/highlight tied to a source node and a structured locator. Prefer item/turn/section/offset plus snippet hash. Store an excerpt snapshot only when exact replay cannot be derived from the immutable source version and the architect approves it.
6. **`workboard_revisions`**: append-only change history written transactionally for create, update, archive, and restore. Store actor, entity kind/id, revision, action, timestamp, and the minimum prior/new fields needed to explain the change. Full prose snapshots require the same retention approval as the prose itself.
7. **Workboard instructions**, after consent approval only: either a single versioned board record or a dedicated author/version table. Never place this prose in event dimensions.

Do not create a second copy of source content. Reference cards resolve current display data through existing permission-filtered readers.

## 3. Permissions and admin behavior

All reads and writes use authenticated server functions with `requireSupabaseAuth`, `resolveProfile`, and the caller-scoped database client. Never accept `owner_id`, `author_profile_id`, `org_id`, or admin status from the browser. Derive them from the verified session and active profile.

- **Read:** active engagement members may read Workboard structure. A canonical reference is returned only when that caller can also read the referenced source through its existing policy. Links and annotations with an unavailable endpoint are omitted rather than revealing titles, IDs, or excerpts.
- **Original records:** nobody edits another person's original chat, work item, decision, or source through the Workboard. Preview remains read-only.
- **Shared structure:** non-coach engagement members may arrange shared frames/reference cards and create or archive explicit links. This is a proposed rule requiring product approval.
- **Authored records:** the author may edit, archive, and restore their own judgment, draft, comment, highlight, prompt, or instruction record. Teammates may read, comment, summarize, or branch when they can read the source, but may not rewrite another person's authored content.
- **Coach members:** may read only source material already available under existing coaching access, and may add their own comment or branch if product approves. They do not rearrange the shared board by default.
- **Engagement admins:** `lead`/`admin` access does not grant prose-edit rights. They may archive or restore shared structure and may hide another author's record from the shared board with a required closed reason, but cannot rewrite it. The original row and revision history remain. Permanent erasure uses a separate retention process, not a card menu action.

Policies must check active org plus engagement access on every table. Grants are `authenticated` for the exact allowed operations and `service_role` for maintenance only; no `anon` grants. Every new public table requires grants before RLS and policies in the same architect migration.

## 4. Relationship and review rules

- Persist direction explicitly. The source is `from_node_id`; the resulting or informed record is `to_node_id`.
- Start with a closed relation vocabulary: `informed | produced | revised | cited | context`. Do not infer the relation from position, frame, node kind, title, or timing.
- “What fed this” begins at the reviewed deliverable and walks only active inbound explicit links, recursively, with cycle detection and a bounded depth. It includes only endpoints the viewer may read.
- Notes/highlights appear only when attached to the reviewed node or a node reached through that explicit traversal.
- Existing `span_links` and sourced decisions remain separate canonical evidence and may be shown beside the Workboard trail. Phase 3 never converts a spatial link into a production provenance claim.
- Missing, archived, or forbidden endpoints are ignored without an error or inferred replacement.

## 5. Shared state, personal state, and concurrency

### Shared and durable now

Workboard identity; frame identity and geometry; canonical reference placement and shared hide/archive state; authored human-judgment nodes; explicit links; authorship; timestamps; row versions; soft deletion; revision history.

### Keep per-user and browser-local

Viewport, zoom, rail state, current selection, keyboard focus, open menu, open reader/review, temporary relationship preview, unsent composer text, and temporary selected context. These do not affect the shared reasoning record.

**Recommendation:** defer per-user saved layout. Shared card/frame placement is sufficient for the first durable release. Add personal viewport/layout only after research shows users need different arrangements of the same record.

### Concurrency

- Every mutable shared row has integer `version`, `updated_at`, and `updated_by`.
- Mutations include `expected_version`; updates succeed only when it matches. Create commands include an idempotency key.
- Each successful mutation and its revision row are committed atomically.
- Position saves occur on drag end or completed keyboard move, not every pointer movement. A newer placement wins only after a version-aware retry.
- A stale prose edit is never merged automatically. Keep the person's local draft visible and offer `Load latest` or `Retry my change` after showing who changed it and when.
- A stale archive/link operation refreshes the entity and reports that it changed; it does not silently recreate or remove anything.

## 6. Data contract and server API

Add a client-safe shared schema module and authenticated server-function module. Prefer a typed discriminated command API over generic CRUD.

- `getWorkboard({ engagement_id, profile_id })` returns board/version, shared frames, visible nodes, visible links, approved annotations, permission flags, and authorship labels. It never returns content from an unreadable canonical source.
- `mutateWorkboard({ engagement_id, profile_id, command, idempotency_key })` accepts closed commands for frame create/update/archive, node create/edit/move/archive/restore, and link create/archive. Each update carries `expected_version`.
- Later consent-approved commands add annotation create/edit/archive and instructions update.
- Return typed outcomes: `saved`, `conflict`, `forbidden`, `not_found`, `validation_error`. A conflict includes the latest safe row metadata and content only when the caller can read it.
- Keep persistence helpers in `*.server.ts`; components import only `*.functions.ts`.

## 7. Control, state, and event changes

### Control changes

All current controls remain. Their successful mutations become durable. `Workboard · Not saved` becomes `Saving`, `Saved`, `Could not save`, or `Newer version available`. Local-only labels are removed only for content included in the approved slice.

New conflict controls are limited to `Load latest` and `Retry my change`. No manual Save button is needed. Comments, highlights, prompts, and instructions retain their current local behavior until their consent gate is approved and implemented.

### New states

Initial durable load; no Workboard row yet; lazy first save; saving; saved; offline/pending; forbidden; validation failure; stale version; source removed or permission lost; archived record; partial read with unavailable endpoints.

### Additive events

Do not change existing event names, payloads, or meaning. Add:

| Event | Closed dimensions | Trigger |
| --- | --- | --- |
| `workboard.change_saved` | `entity: board|frame|node|relationship|annotation|instructions`, `action: create|update|archive|restore` | Server confirms a durable mutation |
| `workboard.save_failed` | `entity: board|frame|node|relationship|annotation|instructions`, `reason: conflict|permission|network|validation|unknown` | A durable mutation fails |
| `workboard.conflict_resolved` | `entity: frame|node|relationship|annotation|instructions`, `choice: latest|retry` | Person uses one of the two conflict controls |

All use `logEvent` to the existing `recordEvent` path with normal consent stamping. No IDs, names, coordinates, prose, excerpts, prompts, version numbers, or exact counts enter event dimensions. Add all names and closed vocabularies to the in-repo event catalog/tests and the portal catalog in the same release. The portal-side update is required before rollout.

## 8. Incremental rollout

### Slice 0: architect decisions and contract approval

Approve the consent/content boundary, shared-layout editor rule, coach rule, admin moderation rule, relation vocabulary/direction, retention duration, revision detail, and conflict behavior. Architect authors and applies schema, grants, policies, indexes, and transactional revision logic.

### Slice 1: smallest useful durable record

- Lazy-create one Workboard per engagement on the first mutation.
- Derive Foundation/task/Decisions/Outputs frames and canonical source cards from existing records without copying source content.
- Persist frame overrides, canonical card placement/hide state, authored human-judgment nodes, and explicit links.
- Load that shared state for every allowed member; preserve current local viewport and temporary context.
- Make “What fed this” use the explicit durable graph plus existing canonical span/decision evidence.
- Keep comments/highlights, draft prompts/branches, and instructions local and visibly labelled until separately approved.

### Slice 2: consent-approved annotations

Persist comments and highlights with structured locators, author-only editing, soft deletion, and source-version-safe replay.

### Slice 3: consent-approved branches and instructions

Persist draft branch records and Workboard instructions. AI execution remains separate and out of scope unless later approved.

### Defaults and backfill

No bulk backfill. Existing engagements open with a deterministic virtual board derived from their current brief, tasks, work, and decisions. The first durable mutation creates the Workboard and stores only deltas plus authored records. Existing production canvas positions and links are not imported automatically. An explicit future import would require its own product decision and event contract.

### Rollback

Gate durable reads/writes behind a Lab-only feature flag. Rollback disables mutation calls and returns to deterministic local state without deleting durable rows. Schema rollback is forward-only: retain rows and policies, revoke feature access if necessary, and use an architect-approved retention process for eventual removal. Never drop user-authored records as an application rollback.

## 9. Acceptance criteria and tests

### Database and permissions

- One active Workboard per engagement; valid foreign keys; closed kind/anchor/relation values; self/duplicate links rejected; all public tables have explicit grants and RLS.
- Signed-in author can create and mutate only their authored content; a caller-supplied alternate author/org cannot take effect.
- Teammate can read allowed original work and create their own branch/comment where approved, but cannot edit another author's original work or judgment.
- Coach and admin behavior matches the approved matrix.
- Removing engagement access immediately removes Workboard access. No dangling link or annotation reveals an unavailable source.
- Authenticated write tests inspect stored author/org. Guest requests are rejected; guest rows are not part of this product.

### Concurrency and history

- Stale version returns a typed conflict and leaves the newer row untouched.
- Retry uses the latest version; `Load latest` discards only the local pending edit after confirmation.
- Every create/update/archive/restore has one matching revision entry with actor and timestamp.
- Soft-deleted records disappear from normal reads, remain available to authorized history reads, and can be restored when policy allows.

### Product behavior

- Refresh preserves Slice 1 frames, placement, hidden state, judgments, and explicit links across two authorized users.
- Viewport, zoom, rail, selection, and unsent context remain personal and reset without changing shared state.
- Empty/first-use, loading, partial permission, failed save, conflict, offline, removed-source, and archived states render honestly.
- “What fed this” returns only explicit reachable records plus existing canonical evidence; proximity and shared frames add nothing.
- Existing Canvas Lab focused suites, route isolation, production canvas tests, provenance tests, TypeScript, token guard, build, and Liam-only authenticated desktop/narrow verification pass.

## 10. Likely files for implementation

### Architect-owned database work

- New migration file(s) under `supabase/migrations/` for Workboard tables, grants, RLS, indexes, constraints, and atomic revision behavior.
- Regenerated `src/integrations/supabase/types.ts` after the architect applies the migration.

### Application contract and data access

- New `src/lib/canvas-lab-shared.ts` for schemas, commands, results, permission flags, and durable DTOs.
- New `src/lib/canvas-lab.functions.ts` for authenticated read/mutation entry points.
- New `src/lib/canvas-lab.server.ts` for caller-scoped assembly and mutation helpers.
- New `src/hooks/use-canvas-lab.ts` for query, optimistic pending state, invalidation, and typed conflicts.

### Existing Lab files

- `src/pages/CanvasLabPage.tsx`
- `src/components/canvas-lab/canvas-lab-model.ts`
- `LabCard.tsx`, `LabCardMenu.tsx`, `WorkRail.tsx`, `FocusOverlay.tsx`, `CanvasLabReview.tsx`, and only the smallest new save/conflict presentation component if needed.
- `src/components/canvas-lab/canvas-lab-telemetry.ts`
- `src/lib/telemetry-shared.ts`
- Focused model, server-contract, permissions, concurrency, event, route, provenance, and interaction tests.
- Append-only update to `docs/build-notes/2026-09-17-chatgpt-sol-canvas-lab.md` and the existing roadmap item.

Production `EngagementCanvasView`, production canvas functions/tables, production provenance writes, AskDock, landing page, consent code, and deployment files remain untouched.

## 11. Explicitly deferred

- Realtime cursors, presence, live drag broadcasting, and simultaneous free-text editing.
- Per-user saved viewport or alternate personal arrangements.
- Shapes, freehand drawing, sticky-note palettes, resize handles, connectors beyond reasoning relationships, templates, voting, timers, reactions, and presentation mode.
- Generic file uploads, connector marketplace, model marketplace, autonomous agents, or AI-generated board rearrangement.
- Automatic relationship inference from proximity, frame, topic, wording, or timing.
- Automatic import of production canvas layout or conversion of Workboard links into production provenance.
- Durable AI answers, branch execution, comments/highlights, excerpts, and instructions until their specific consent and retention decisions are approved.

## Decisions required before build

1. **Architect:** approve the isolated table contract, grants/RLS matrix, revision strategy, retention duration, and deletion process.
2. **Architect and consent owner:** decide whether durable judgment text is covered today, and separately decide storage/AI use/retention for comments, highlights, excerpt snapshots, prompts, and instructions.
3. **Product:** confirm who may rearrange shared frames/reference cards: all non-coach members, owners only, or named editors.
4. **Product:** confirm coach ability to add comments/branches and whether coaches may see the shared spatial arrangement when source access is narrower.
5. **Product and architect:** confirm admins may archive/restore another author's record with a reason but may never rewrite its prose.
6. **Product:** approve directed relationship vocabulary and inbound-only “What fed this” traversal.
7. **Product:** approve optimistic conflicts with `Load latest` and `Retry my change`, with no automatic prose merge.
8. **Portal owner:** add the three new event names and closed dimensions before rollout, plus complete the nine outstanding Phase 2 catalog entries.
