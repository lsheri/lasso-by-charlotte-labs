# PASS 86 — AUDIT ONLY. Notebook port 4/6: Ask dock, binder baseline law, mobile Ask sheet, plus the founder scoping fix

## 1. Part 1 traces — what is actually unscoped today

### (a) Chat history on an engagement

The only chat history rendered on an engagement page is the ReflectDock session list. `EngagementPage.tsx:343-352` mounts `ReflectDock`; nothing else on that page lists sessions.

`ReflectDock.tsx:129-152` already filters: it reads the person's 50 most recent `chat_sessions` on the caller's client and keeps a row only when

- `context_scope.mode === "engagements"` and the ids include this engagement, or
- `context_scope.mode === "items"` and any id is a work item mapped into this engagement.

Scope shape stored in `chat_sessions.context_scope` is `{ mode: "whole" | "engagements" | "tasks" | "items", ids: string[] }` (`src/lib/reflect-shared.ts:8-11`).

So the full-list symptom the founder saw is **not** a missing engagement filter — it is three real gaps in that filter:

1. `mode: "tasks"` sessions fall through to `return false`, so chats scoped to a workstream of this engagement are silently missing. That is a related chat being dropped, the opposite error, and it is in the same code the fix touches.
2. The `items` branch matches against `mappedItemsForEngagement(useWorkItems(), engagementId)`, a client-side read of the whole work list. Before that query settles, `mappedIds` is empty and item-scoped sessions vanish, then pop in.
3. The filter lives inline in the dock. Whatever replaces the dock must not lose it, and the mobile sheet needs the same rule.

**Proposed rule (single shared helper, `src/lib/reflect-scope-shape.ts`):**

```ts
sessionRelatedToEngagement(scope, { engagementId, mappedItemIds, taskIds }): boolean
// whole        -> false  (founder's call: a whole-record chat is not "related to" this engagement)
// engagements  -> scope.ids.includes(engagementId)
// tasks        -> scope.ids.some(id => taskIds.has(id))
// items        -> scope.ids.some(id => mappedItemIds.has(id))
```

`taskIds` comes free from the existing `getEngagementPage` payload (`payload.tasks[].id`), so the tasks branch costs no new read. Whole-record chats stay off the engagement list and remain visible on the Reflect page, which is where they belong.

### (b) Decisions under an engagement

Already correctly scoped, evidence:

- `EngagementDecisions.tsx:30` -> `useEngagementDecisions(engagementId)` (`src/hooks/use-decisions.ts:24-32`) -> `useEngagementSlice(..., payload => payload.decisions)`.
- `src/lib/engagement-page.server.ts:52-57`: `from("decisions").select("*").eq("engagement_id", engagementId).in("status", ["draft","confirmed"])`.

The unfiltered read is `fetchDecisions()` / `useDecisions()` (`use-decisions.ts:10-22`), no `engagement_id` filter — but it is only used by the standalone `/decisions` page, which is meant to be the full list. **No change needed for decisions.** No new filter, no RPC, no schema.

### (c) Inventory of other lists on the engagement page

| Surface | Scoped today? |
| --- | --- |
| Analyses (`useChatAnalyses`) | In-memory per dock session only, cleared on new/open session. No stored history list. Scoped. |
| Workstreams / work rows | `tasks` read is `.eq("engagement_id", ...)`. Scoped. |
| Coaches, membership, lineage, firm checks | All keyed by `engagement_id`. Scoped. |
| 1:1 brief, AI record pointer | Own scope args. Scoped. |

Flagged, not fixed this pass: none found unscoped. Only the chat-history rule above ships.

## 2. Ask dock — what replaces, what wraps

`ReflectDock.tsx` is 597 lines and holds the machinery worth keeping: session create/update, `@` mention narrowing, scope-follows-selection, `streamChatRequest`, manifests, answer sources, analyses chips, save-for-1:1.

Plan: **wrap, do not rewrite.** Split the file into
- `src/components/reflect/use-ask-lasso.ts` — the whole state/behaviour hook, lifted verbatim from the current body, plus the new session-scoping helper.
- `src/components/reflect/AskDock.tsx` — desktop right-panel shell (tabs, resize grip, greeting/suggestions, scope chip).
- `src/components/reflect/AskSheet.tsx` — mobile full-screen sheet using the same hook.
- `ReflectDock.tsx` becomes a thin adapter that renders `AskDock`/`AskSheet` by viewport, keeping the existing props so `EngagementPage` and the pass-82 `enabled: open` guards on every internal query (`dock-sessions`, `engagement-brief-present`, `reflect-messages`) survive untouched.

Tabs: Messages / History / Analyses, graphite icons `messages` / `history` / `analyses` (add the three icon defs if absent from `notebook/icons.tsx`). Empty state: greeting plus two suggestion cards. Scope chip sits in the composer row.

## 3. Binder CSS port and the 28px baseline law

Add to `src/styles.css` (tokens near the existing `--nb-*` block):

```
--nb-baseline: 1.75rem;   /* 28px at 16px root, scales with Dynamic Type */
```

- `.nb-binder` — clipping container, `background: var(--nb-white)`.
- `.nb-binder-body` — `line-height: var(--nb-baseline)` and a `repeating-linear-gradient` at `var(--nb-baseline)` pitch with a 1px `--nb-rule` line, `background-attachment: local` so rules scroll with content. Top padding is a whole multiple of the pitch so text baselines snap just above each rule.
- `.nb-binder-line`, `.nb-binder-label` — per-line and gutter-label helpers.
- `.nb-binder-inset` — plain white card with the 4px white ring for anything that cannot hold the grid: code blocks, tables, images, source cards, analysis blocks, thinking trail. `MarkdownMessage` gets a `binder` variant that routes `pre`/`table`/`img` into the inset.
- `.nb-title-strip` — the one decorative ruled strip, behind the engagement page title.

Because the pitch is rem-based, 200% text scales the rules with the type ramp and the law holds.

Loading: `.nb-dot` three pulsing grey dots replaces `ThinkingIndicator` output inside the dock/sheet only. Streaming keeps the existing pipe; presentation adds a word-chunk fade-in and the "Reading your work" first phase. No spinner or shimmer anywhere in the dock. `prefers-reduced-motion` renders dots and fades static.

## 4. Dock state persistence

A module-level `ask-dock-state.ts` context (open, active tab, session id, engagement key) so in-session navigation keeps the dock as it was; width and open persist to `localStorage` under one key (`lasso.askdock`). No new storage schema, no query-key changes. Resize grip is pointer-draggable and keyboard-operable (`role="separator"`, arrow keys, 320–560 clamp).

## 5. Mobile sheet and the coach cut

Owner: the pass-85 Ask tab opens `AskSheet` full-screen — tabs across the top, binder paper unchanged, composer pinned above the keyboard (`enterKeyHint="send"`, `inputMode="text"`), scope chip as a full-width 48px tappable row above the composer, sheet layered over dialogs.

Coach: **honest cut.** Turning the coach Ask tab on this pass means fitting `CoachChat` (subject + engagement scoped, exchange-list shaped, no sessions table) into a tabbed sheet whose History tab has no coach-side session store to read. Proposal: this pass ships the coach tab **still hidden**, and pass 87 adds a `CoachAskSheet` — same binder shell, Messages tab only, wired to the existing `CoachChat` machinery and its packet scope. That keeps the pass presentational and avoids inventing a coach session history.

## 6. Risks and boundaries

- `ReflectPage` keeps its current full-page layout this pass; the full-page binder restyle rides pass 87/88. Confirmed as proposed.
- The dock split is the main regression risk: the pass-82 `enabled: open` guards and the scope-follows-selection effect must move verbatim. Covered by a new test asserting the queries stay gated and by the existing pass-82 key tests.
- Untouched: context selection, manifests, `ai_reads`, quote guards, zero-scope refusal, COACH_POLL, query keys, telemetry dims, streaming/holdback machinery, SQL, schema, RLS, routes.
- One green primary per screen: the Send button is the dock's only filled green.

## 7. Architect items

None.
